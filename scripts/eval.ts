import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { generateObject } from "ai";
import { z } from "zod";
import { miniModel, goldJudgeModel } from "@/lib/openai";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3007";
const TEST_SET_PATH = process.env.EVAL_TEST_SET ?? "eval/test_set.json";
const BASELINE_DIR = "eval/baselines";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TestCaseSchema = z.object({
  id: z.string(),
  trigger_message: z.string(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
  must_contain: z.array(z.string()).optional(),
  must_contain_any: z.array(z.string()).optional(),
  must_not_contain: z.array(z.string()).optional(),
  must_not_contain_any_of: z.array(z.string()).optional(),
  min_confidence: z.number().optional(),
  expected_intent: z.string().optional(),
  expected_tool_any: z.array(z.string()).optional(),
  notes: z.string().optional(),
  // New optional fields (Phase B):
  gold_reply: z.string().optional(),
  expected_stage: z.string().optional(),
  expected_outcome: z.string().optional(),
  source_conversation: z.string().optional(),
  synthetic: z.boolean().optional(),
});
type TestCase = z.infer<typeof TestCaseSchema>;

const JudgeSchema = z.object({
  quality: z.number().min(0).max(5),
  rationale: z.string().max(300),
});

const GoldJudgeSchema = z.object({
  gold_alignment: z.number().min(0).max(5),
  intent_match: z.number().min(0).max(5),
  stage_appropriateness: z.number().min(0).max(5),
  tone_match: z.number().min(0).max(5),
  rationale: z.string().max(300),
});

async function judge(input: {
  trigger: string;
  reply: string;
  notes: string;
}): Promise<{ quality: number; rationale: string }> {
  try {
    const { object } = await generateObject({
      model: miniModel(),
      schema: JudgeSchema,
      system: `You rate sales replies from 0-5 based on: (a) directness/relevance to the incoming message, (b) adherence to the notes/intent, (c) natural human tone (no LLM tells), (d) no hallucinated facts. 5 = excellent; 3 = acceptable; 0 = useless. Return only JSON.`,
      prompt: `INCOMING: ${input.trigger}\n\nREPLY: ${input.reply}\n\nGUIDANCE: ${input.notes || "(none)"}`,
    });
    return object;
  } catch {
    return { quality: 2.5, rationale: "judge failed; defaulted" };
  }
}

async function judgeGoldAlignment(input: {
  trigger: string;
  history: { role: string; content: string }[];
  draft: string;
  gold: string;
  expected_stage?: string;
  expected_outcome?: string;
}): Promise<z.infer<typeof GoldJudgeSchema>> {
  try {
    const histStr = input.history
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n");
    const { object } = await generateObject({
      model: goldJudgeModel(),
      schema: GoldJudgeSchema,
      system: `You compare a DRAFT sales reply against a GOLD human reply in the same conversational context. Rate 0-5 on four independent dimensions:

- gold_alignment: overall closeness in intent, direction, and information content. 5 = DRAFT says what a good salesperson would say here AND resembles GOLD in substance. 3 = DRAFT is reasonable but meaningfully different. 0 = DRAFT misses the situation.
- intent_match: does DRAFT pursue the same conversational move as GOLD (e.g., both pivot to a call / both decline politely / both answer a factual question)? NOT paraphrase similarity.
- stage_appropriateness: given the expected_stage (cold / qualifying / scheduling / scheduled / post_call / stalled), is DRAFT pitched at the right point in the funnel?
- tone_match: similar register, length, directness. Sales tone = warm-professional, concise, low pushiness.

Return JSON only. Rationale ≤300 chars, cite the key difference or similarity.`,
      prompt: `CONTEXT (history, oldest first):
${histStr || "(none)"}

INCOMING: ${input.trigger}

GOLD (what the human actually wrote):
${input.gold}

DRAFT (what the model generated):
${input.draft}

expected_stage: ${input.expected_stage ?? "(unspecified)"}
expected_outcome: ${input.expected_outcome ?? "(unspecified)"}`,
    });
    return object;
  } catch {
    return {
      gold_alignment: 2.5,
      intent_match: 2.5,
      stage_appropriateness: 2.5,
      tone_match: 2.5,
      rationale: "gold judge failed; defaulted",
    };
  }
}

function hits(text: string, needles: string[]): string[] {
  const hay = text.toLowerCase();
  return needles.filter((n) => hay.includes(n.toLowerCase()));
}

type Result = {
  id: string;
  pass: boolean;
  violations: string[];
  quality: number;
  confidence: number;
  reply: string;
  intent: string;
  tool: string;
  latency_ms: number;
  gold_alignment?: number;
  intent_match?: number;
  stage_appropriateness?: number;
  tone_match?: number;
  synthetic?: boolean;
  has_gold?: boolean;
};

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function fmt(n: number): string {
  return isNaN(n) ? "—" : n.toFixed(2);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function groupReport(name: string, rows: Result[]): string {
  if (!rows.length) return `${name}: (none)`;
  const passed = rows.filter((r) => r.pass).length;
  const avgQ = avg(rows.map((r) => r.quality));
  const avgC = avg(rows.map((r) => r.confidence));
  const golds = rows.filter((r) => r.has_gold);
  const goldLine = golds.length
    ? `  gold_alignment=${fmt(avg(golds.map((r) => r.gold_alignment!)))} intent=${fmt(
        avg(golds.map((r) => r.intent_match!)),
      )} stage=${fmt(avg(golds.map((r) => r.stage_appropriateness!)))} tone=${fmt(
        avg(golds.map((r) => r.tone_match!)),
      )}`
    : "";
  return `${name}: ${passed}/${rows.length} pass, quality=${fmt(avgQ)}, conf=${fmt(avgC)}${goldLine ? "\n" + goldLine : ""}`;
}

async function main() {
  const raw = await readFile(TEST_SET_PATH, "utf-8");
  const parsed = z.array(TestCaseSchema).safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error("test_set.json schema error:", parsed.error.issues);
    process.exit(1);
  }
  const cases: TestCase[] = parsed.data;

  const { data: agent } = await sb
    .from("agents")
    .select("id, name")
    .eq("name", "Ivy Sales Pre-Discovery")
    .single();
  if (!agent) throw new Error("Default agent missing");

  const rawKey = `tib_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const { data: key } = await sb
    .from("api_keys")
    .insert({
      agent_id: agent.id,
      name: "eval-runner",
      key_hash: hash,
      key_prefix: rawKey.slice(0, 8),
    })
    .select("id")
    .single();
  if (!key) throw new Error("key insert failed");

  console.log(`Evaluating ${cases.length} cases against ${agent.name}…\n`);

  const results: Result[] = [];

  for (const tc of cases) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/v1/agents/${agent.id}/reply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_message: tc.trigger_message,
        history: tc.history ?? [],
      }),
    });
    const body = await res.json();
    const ms = Date.now() - t0;
    if (!res.ok) {
      console.log(`✗ ${tc.id} — HTTP ${res.status}: ${body?.error?.message}`);
      results.push({
        id: tc.id,
        pass: false,
        violations: ["http_error"],
        quality: 0,
        confidence: 0,
        reply: "",
        intent: "",
        tool: "",
        latency_ms: ms,
        synthetic: tc.synthetic ?? false,
        has_gold: !!tc.gold_reply,
      });
      continue;
    }
    const r = body.data;
    const violations: string[] = [];

    if (tc.must_contain) {
      const missing = tc.must_contain.filter(
        (n) => !r.reply_text.toLowerCase().includes(n.toLowerCase()),
      );
      if (missing.length) violations.push(`missing: ${missing.join(", ")}`);
    }
    if (tc.must_contain_any) {
      const found = hits(r.reply_text, tc.must_contain_any);
      if (found.length === 0) violations.push(`none of: ${tc.must_contain_any.join(" | ")}`);
    }
    if (tc.must_not_contain) {
      const found = hits(r.reply_text, tc.must_not_contain);
      if (found.length) violations.push(`forbidden: ${found.join(", ")}`);
    }
    if (tc.must_not_contain_any_of) {
      const found = hits(r.reply_text, tc.must_not_contain_any_of);
      if (found.length) violations.push(`forbidden-any: ${found.join(", ")}`);
    }
    if (tc.min_confidence !== undefined && r.confidence < tc.min_confidence) {
      violations.push(`confidence ${r.confidence.toFixed(2)} < ${tc.min_confidence}`);
    }
    if (tc.expected_intent && r.detected_intent !== tc.expected_intent) {
      violations.push(`intent ${r.detected_intent} ≠ expected ${tc.expected_intent}`);
    }
    if (tc.expected_tool_any && !tc.expected_tool_any.includes(r.suggested_tool)) {
      violations.push(`tool ${r.suggested_tool} ∉ {${tc.expected_tool_any.join(",")}}`);
    }

    const j = await judge({
      trigger: tc.trigger_message,
      reply: r.reply_text,
      notes: tc.notes ?? "",
    });

    let gold: z.infer<typeof GoldJudgeSchema> | undefined;
    if (tc.gold_reply) {
      gold = await judgeGoldAlignment({
        trigger: tc.trigger_message,
        history: tc.history ?? [],
        draft: r.reply_text,
        gold: tc.gold_reply,
        expected_stage: tc.expected_stage,
        expected_outcome: tc.expected_outcome,
      });
    }

    const pass = violations.length === 0;
    const goldLine = gold
      ? ` gold=${gold.gold_alignment.toFixed(1)}(i=${gold.intent_match.toFixed(1)}/s=${gold.stage_appropriateness.toFixed(1)}/t=${gold.tone_match.toFixed(1)})`
      : "";
    console.log(
      `${pass ? "✓" : "✗"} ${tc.id}  conf=${r.confidence.toFixed(2)}  judge=${j.quality.toFixed(1)}${goldLine}  ${ms}ms`,
    );
    console.log(`   "${r.reply_text.slice(0, 110).replace(/\n/g, " ")}…"`);
    if (!pass) console.log(`   violations: ${violations.join(" | ")}`);
    console.log(`   judge: ${j.rationale}`);
    if (gold) console.log(`   gold:  ${gold.rationale}`);

    results.push({
      id: tc.id,
      pass,
      violations,
      quality: j.quality,
      confidence: r.confidence,
      reply: r.reply_text,
      intent: r.detected_intent,
      tool: r.suggested_tool,
      latency_ms: ms,
      gold_alignment: gold?.gold_alignment,
      intent_match: gold?.intent_match,
      stage_appropriateness: gold?.stage_appropriateness,
      tone_match: gold?.tone_match,
      synthetic: tc.synthetic ?? false,
      has_gold: !!tc.gold_reply,
    });
  }

  await sb.from("api_keys").delete().eq("id", key.id);

  // Aggregation by group
  const syntheticRows = results.filter((r) => r.synthetic);
  const ivyRealRows = results.filter((r) => r.has_gold);

  const avgMs = Math.round(avg(results.map((r) => r.latency_ms)));

  console.log(`\n========================================`);
  console.log(groupReport("overall  ", results));
  console.log(groupReport("synthetic", syntheticRows));
  console.log(groupReport("ivy_real ", ivyRealRows));
  console.log(`Avg latency: ${avgMs}ms`);

  // Write baseline snapshot
  await mkdir(BASELINE_DIR, { recursive: true });
  const snapshotPath = `${BASELINE_DIR}/baseline-${today()}.json`;
  const snapshot = {
    run_at: new Date().toISOString(),
    n_cases: results.length,
    results,
    aggregates: {
      overall: {
        n: results.length,
        pass_rate: results.length ? results.filter((r) => r.pass).length / results.length : 0,
        quality_avg: avg(results.map((r) => r.quality)),
        confidence_avg: avg(results.map((r) => r.confidence)),
      },
      synthetic: {
        n: syntheticRows.length,
        pass_rate: syntheticRows.length
          ? syntheticRows.filter((r) => r.pass).length / syntheticRows.length
          : 0,
        quality_avg: avg(syntheticRows.map((r) => r.quality)),
      },
      ivy_real: {
        n: ivyRealRows.length,
        pass_rate: ivyRealRows.length
          ? ivyRealRows.filter((r) => r.pass).length / ivyRealRows.length
          : 0,
        quality_avg: avg(ivyRealRows.map((r) => r.quality)),
        gold_alignment_avg: avg(ivyRealRows.map((r) => r.gold_alignment ?? NaN)),
        intent_match_avg: avg(ivyRealRows.map((r) => r.intent_match ?? NaN)),
        stage_appropriateness_avg: avg(ivyRealRows.map((r) => r.stage_appropriateness ?? NaN)),
        tone_match_avg: avg(ivyRealRows.map((r) => r.tone_match ?? NaN)),
      },
    },
  };
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`\nBaseline snapshot: ${snapshotPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
