import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { generateObject } from "ai";
import { z } from "zod";
import { miniModel } from "@/lib/openai";

const EVAL_DIR = "data/conversations/eval";
const GOLD_JSON = "data/gold/cases.json";
const TEST_SET_JSON = "eval/test_set.json";

type Message = {
  role: "lead" | "sales";
  sender: string | null;
  content: string;
  ts: string | null;
};
type Convo = {
  id: string;
  messages: Message[];
  outcome: string;
  stages_covered: string[];
  notes?: string | null;
};

type TestCase = {
  id: string;
  trigger_message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  must_contain?: string[];
  must_contain_any?: string[];
  must_not_contain?: string[];
  must_not_contain_any_of?: string[];
  min_confidence?: number;
  expected_intent?: string;
  expected_tool_any?: string[];
  notes?: string;
  gold_reply?: string;
  expected_stage?: string;
  expected_outcome?: string;
  source_conversation?: string;
  synthetic?: boolean;
};

const STAGE_ENUM = [
  "cold",
  "qualifying",
  "scheduling",
  "scheduled",
  "post_call",
  "stalled",
  "any",
] as const;

const OUTCOME_ENUM = [
  "keep_engaging",
  "disqualify_politely",
  "schedule_call",
  "handle_objection",
  "answer_factual",
  "pivot_to_call",
] as const;

const INTERESTING_SCHEMA = z.object({
  turns: z
    .array(
      z.object({
        sales_message_index: z
          .number()
          .int()
          .describe("0-based index into the messages[] array, pointing to the sales (Ferdi/Ruben/Jacob) turn that is the GOLD reply"),
        why_interesting: z.string().max(200),
        expected_stage: z.enum(STAGE_ENUM),
        expected_outcome: z.enum(OUTCOME_ENUM),
      }),
    )
    .max(2),
});

const LEGACY_MATCH_SCHEMA = z.object({
  match: z
    .object({
      source_conversation: z.string().describe("e.g. convo_09"),
      sales_message_index: z.number().int(),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("0–1 score; ≥0.7 means a strong match"),
      reason: z.string().max(200),
    })
    .nullable()
    .describe("null if no good match across any conversation"),
});

type LegacySpec = {
  id: string;
  description: string;
  keep_fields: Partial<TestCase>;
  fallback: TestCase;
};

const LEGACY_SCENARIOS: LegacySpec[] = [
  {
    id: "pricing-cold",
    description:
      "The LEAD is asking about pricing/cost/fees before any discovery call has happened. SOP: do not disclose pricing numbers before discovery; pivot to a call.",
    keep_fields: {
      must_not_contain: ["0.15%", "0.25%", "2.2%", "bps"],
      must_contain_any: ["call", "calendly", "discovery", "walk through"],
      min_confidence: 0.5,
      expected_intent: "pricing",
      notes: "SOP: no pricing numbers before discovery. Must pivot to call.",
    },
    fallback: {
      id: "pricing-cold",
      trigger_message:
        "Hey, what does Ivy cost for USDC pay-ins? We move around $50M/month in EU.",
      history: [
        {
          role: "assistant",
          content:
            "Hi — Felix from Ivy. Saw you run sizeable USDC volume. Curious if faster fiat rails would help.",
        },
      ],
      must_not_contain: ["0.15%", "0.25%", "2.2%", "bps"],
      must_contain_any: ["call", "calendly", "discovery", "walk through"],
      min_confidence: 0.5,
      expected_intent: "pricing",
      notes: "SOP: no pricing numbers before discovery. Must pivot to call.",
      synthetic: true,
    },
  },
  {
    id: "competitor-objection",
    description:
      "The LEAD is using or evaluating a competitor (e.g. BVNK, Mollie, Stripe) and pushes back on why they should consider Ivy. SOP: acknowledge, don't disparage, pivot to differentiators.",
    keep_fields: {
      must_not_contain_any_of: ["BVNK is bad", "BVNK is slow", "competitor is inferior"],
      min_confidence: 0.5,
      expected_intent: "competitor",
      notes: "SOP: acknowledge, don't disparage, pivot to differentiators.",
    },
    fallback: {
      id: "competitor-objection",
      trigger_message: "We already use BVNK — why would I switch?",
      history: [],
      must_not_contain_any_of: ["BVNK is bad", "BVNK is slow", "competitor is inferior"],
      must_contain_any: ["faster", "direct", "crypto-native", "side-by-side", "compare"],
      min_confidence: 0.5,
      expected_intent: "competitor",
      notes: "SOP: acknowledge, don't disparage, pivot to differentiators.",
      synthetic: true,
    },
  },
  {
    id: "scheduling-positive",
    description:
      "The LEAD has expressed clear willingness to schedule a call or asked about a time. Sales should send the Calendly link and keep it short.",
    keep_fields: {
      must_contain_any: ["calendly", "calendar", "book", "slot", "meet.getivy"],
      min_confidence: 0.6,
      expected_intent: "scheduling",
      notes: "Should attach Calendly URL and keep it short.",
    },
    fallback: {
      id: "scheduling-positive",
      trigger_message: "Sure, let's find time — do you have anything next week?",
      history: [
        {
          role: "assistant",
          content: "Happy to walk you through — want to grab 20 min?",
        },
      ],
      must_contain_any: ["calendly", "calendar", "book", "slot", "meet.getivy"],
      min_confidence: 0.6,
      expected_intent: "scheduling",
      notes: "Should attach Calendly URL and keep it short.",
      synthetic: true,
    },
  },
  {
    id: "hard-factual-unknown",
    description:
      "The LEAD asks a specific technical or coverage question (e.g. ISO 20022 support, specific country/region coverage, niche compliance claim) that is NOT obviously answerable from general Ivy positioning. The correct move is to flag for review OR route to a call rather than speculate.",
    keep_fields: {
      min_confidence: 0,
      expected_tool_any: ["flag_for_review", "send_calendly_link"],
      notes: "Specific technical claim not in KB — model should either flag or route to call.",
    },
    fallback: {
      id: "hard-factual-unknown",
      trigger_message: "Do you support ISO 20022 native format on all your SEPA rails?",
      history: [],
      min_confidence: 0,
      expected_tool_any: ["flag_for_review", "send_calendly_link"],
      notes: "Specific technical claim not in KB — model should either flag or route to call.",
      synthetic: true,
    },
  },
];

async function pickInterestingTurns(convo: Convo): Promise<
  z.infer<typeof INTERESTING_SCHEMA>["turns"]
> {
  const numbered = convo.messages
    .map(
      (m, i) =>
        `[${i}] role=${m.role}${m.sender ? ` sender=${m.sender}` : ""}${m.ts ? ` ts=${m.ts}` : ""}\n${m.content}`,
    )
    .join("\n\n");
  const { object } = await generateObject({
    model: miniModel(),
    schema: INTERESTING_SCHEMA,
    system: `You pick 1-2 "interesting" sales turns from a pre-discovery conversation to use as evaluation gold replies.

An "interesting" turn is one where the salesperson had to do something non-trivial:
- respond to an objection or pushback
- answer a hard factual or coverage question
- pivot to a call after hesitation
- politely disqualify a prospect
- handle a competitor mention
- make a judgment call on whether to continue engaging

NOT interesting: pure small talk, one-line acknowledgements ("Great!", "Done!"), or formal intros with no judgment.

Return sales_message_index pointing to the SALES turn in messages[]. Classify stage + outcome.`,
    prompt: `Conversation ${convo.id} (outcome=${convo.outcome}, stages=${convo.stages_covered.join(",")}):\n\n${numbered}`,
  });
  // Keep only turns that point to a valid sales message.
  return object.turns.filter((t) => {
    const m = convo.messages[t.sales_message_index];
    return m && m.role === "sales" && m.content.trim().length > 30;
  });
}

async function matchLegacy(
  spec: LegacySpec,
  convos: Convo[],
): Promise<z.infer<typeof LEGACY_MATCH_SCHEMA>["match"]> {
  // Flatten all sales turns with their preceding lead context across eval convos.
  const candidates: { convo_id: string; idx: number; lead_before: string; sales: string }[] = [];
  for (const c of convos) {
    for (let i = 0; i < c.messages.length; i++) {
      const m = c.messages[i];
      if (m.role !== "sales" || m.content.trim().length < 30) continue;
      const prev = [...c.messages.slice(0, i)].reverse().find((x) => x.role === "lead");
      if (!prev) continue;
      candidates.push({
        convo_id: c.id,
        idx: i,
        lead_before: prev.content.slice(0, 500),
        sales: m.content.slice(0, 500),
      });
    }
  }
  if (!candidates.length) return null;

  const block = candidates
    .map(
      (c, k) =>
        `### candidate #${k} (${c.convo_id}, sales_message_index=${c.idx})
LEAD BEFORE: ${c.lead_before}
SALES GOLD: ${c.sales}`,
    )
    .join("\n\n");

  const { object } = await generateObject({
    model: miniModel(),
    schema: LEGACY_MATCH_SCHEMA,
    system: `You find the single best match for a described evaluation scenario among candidate (lead_before, sales_gold) pairs from real sales conversations.

A match is STRONG (confidence ≥ 0.7) only if:
- The LEAD BEFORE message actually enacts the scenario (e.g. asks about pricing, mentions a competitor, requests scheduling, poses a hard factual question).
- The SALES GOLD is a substantive response (not a one-liner).

If nothing hits strongly, return match: null. Do NOT stretch.`,
    prompt: `Scenario: ${spec.id}
Description: ${spec.description}

Candidates:
${block}`,
  });
  if (!object.match || object.match.confidence < 0.7) return null;
  return object.match;
}

async function loadEvalConvos(): Promise<Convo[]> {
  const files = (await readdir(EVAL_DIR)).filter((f) => /^convo_\d{2}\.json$/.test(f)).sort();
  const convos: Convo[] = [];
  for (const f of files) {
    convos.push(JSON.parse(await readFile(`${EVAL_DIR}/${f}`, "utf-8")));
  }
  return convos;
}

function buildCase(
  convo: Convo,
  salesIdx: number,
  id: string,
  extra: Partial<TestCase>,
): TestCase | null {
  const sales = convo.messages[salesIdx];
  if (!sales || sales.role !== "sales") return null;
  const prev = [...convo.messages.slice(0, salesIdx)].reverse().find((m) => m.role === "lead");
  if (!prev) return null;
  const history = convo.messages.slice(0, salesIdx).slice(-10).map((m) => ({
    role: (m.role === "sales" ? "assistant" : "user") as "user" | "assistant",
    content: m.content,
  }));
  // Drop the last entry if it's the same as trigger_message (it will be, since prev=last lead)
  // Actually history is everything BEFORE the trigger. The trigger IS the last lead message.
  const triggerIdx = convo.messages.lastIndexOf(prev);
  const historyBeforeTrigger = convo.messages.slice(0, triggerIdx).slice(-10).map((m) => ({
    role: (m.role === "sales" ? "assistant" : "user") as "user" | "assistant",
    content: m.content,
  }));
  return {
    id,
    trigger_message: prev.content,
    history: historyBeforeTrigger,
    gold_reply: sales.content,
    source_conversation: convo.id,
    ...extra,
  };
}

async function main() {
  const convos = await loadEvalConvos();
  console.log(`Loaded ${convos.length} eval conversations.`);

  const interestingCases: TestCase[] = [];
  for (const convo of convos) {
    const turns = await pickInterestingTurns(convo);
    console.log(`  ${convo.id}: ${turns.length} interesting turn(s)`);
    let k = 1;
    for (const t of turns) {
      const id = `${convo.id}-turn${k++}`;
      const built = buildCase(convo, t.sales_message_index, id, {
        expected_stage: t.expected_stage,
        expected_outcome: t.expected_outcome,
        notes: t.why_interesting,
      });
      if (built) interestingCases.push(built);
    }
  }

  console.log(`\nInteresting turns: ${interestingCases.length} cases.`);
  console.log(`\nMatching legacy scenarios to eval conversations…`);

  const legacyCases: TestCase[] = [];
  for (const spec of LEGACY_SCENARIOS) {
    const match = await matchLegacy(spec, convos);
    if (match) {
      const convo = convos.find((c) => c.id === match.source_conversation);
      if (convo) {
        const built = buildCase(convo, match.sales_message_index, spec.id, {
          ...spec.keep_fields,
          expected_outcome: spec.keep_fields.expected_intent ? undefined : undefined, // keep legacy fields as-is
        });
        if (built) {
          console.log(
            `  ✓ ${spec.id} → ${match.source_conversation}#${match.sales_message_index} (conf=${match.confidence.toFixed(2)}) — ${match.reason}`,
          );
          legacyCases.push(built);
          continue;
        }
      }
    }
    console.log(`  ∅ ${spec.id} → no strong match; keeping synthetic fallback.`);
    legacyCases.push(spec.fallback);
  }

  // Dedupe: if an interesting-turn case points at the same (convo, idx) as a legacy case, drop the interesting one.
  const legacyKeys = new Set(
    legacyCases
      .filter((c) => c.source_conversation)
      .map((c) => `${c.source_conversation}|${c.gold_reply?.slice(0, 80) ?? ""}`),
  );
  const dedupedInteresting = interestingCases.filter(
    (c) => !legacyKeys.has(`${c.source_conversation}|${c.gold_reply?.slice(0, 80) ?? ""}`),
  );

  const allCases = [...legacyCases, ...dedupedInteresting];

  // Write intermediate inspection file
  await mkdir("data/gold", { recursive: true });
  await writeFile(GOLD_JSON, JSON.stringify(allCases, null, 2) + "\n");
  console.log(`\nIntermediate: ${GOLD_JSON}`);

  // Overwrite eval/test_set.json
  await writeFile(TEST_SET_JSON, JSON.stringify(allCases, null, 2) + "\n");
  console.log(`Final test set:  ${TEST_SET_JSON}  (${allCases.length} cases)`);

  const byGroup = {
    synthetic: allCases.filter((c) => c.synthetic).length,
    ivy_real: allCases.filter((c) => !!c.gold_reply).length,
    total: allCases.length,
  };
  console.log(`\nGroups: synthetic=${byGroup.synthetic}, ivy_real=${byGroup.ivy_real}, total=${byGroup.total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
