import type { AgentConfig } from "@/lib/schemas/agent";
import type { Message } from "@/lib/schemas/common";
import type { RetrievedChunk, RetrievedContext } from "@/lib/retrieval/types";

export type PromptInput = {
  config: AgentConfig;
  context: RetrievedContext;
  history: Message[];
  trigger_message: string;
};

export type BuiltPrompt = {
  system: string;
  userPrompt: string;
  refs: Map<string, RetrievedChunk>;
};

const LENGTH_HINT: Record<AgentConfig["response_length"], string> = {
  short: "Aim for 1-2 short sentences. No preamble.",
  medium: "Aim for 2-4 sentences. Concise.",
  long: "Aim for 4-8 sentences. Still conversational, not formal.",
};

const TONE_HINT: Record<AgentConfig["tone"], string> = {
  "professional-warm":
    "Professional but warm. Contractions OK. No corporate jargon. Never obsequious.",
  casual: "Casual, friendly. Lowercase openers OK. Like texting a colleague.",
  formal: "Polite, full sentences, no contractions. Slightly reserved.",
  direct: "Blunt, no filler, no small talk. Get to the point.",
  friendly: "Warm, upbeat, personal. Use first names when known.",
};

const PUSHINESS_HINT: Record<AgentConfig["pushiness"], string> = {
  low: "Soft asks. Offer, don't insist. No 'when can we meet' if they haven't signalled interest.",
  medium: "Confident asks. Propose concrete next steps when the moment fits.",
  high: "Drive toward the goal. Ask for the meeting / answer / decision in most replies.",
};

const GOAL_HINT: Record<AgentConfig["goal"], string> = {
  book_discovery_call:
    "Primary objective: book a 30-minute discovery call WHEN the prospect is a plausible fit. If <sops> or <similar_past_convos> show the situation is a disqualification / fit-mismatch / unsupported-region / stack-mismatch pattern, graceful disengagement IS the right answer — do not force a call or re-share a calendar link. Following the SOPs beats pursuing the goal when they conflict.",
  qualify_lead:
    "Primary objective: learn volume, geography, current rails, timelines before pitching.",
  answer_question:
    "Primary objective: answer the prospect's question accurately and concisely.",
  handle_objection:
    "Primary objective: acknowledge the concern, then pivot to Ivy's differentiators.",
  follow_up:
    "Primary objective: re-engage a cooling lead without being pushy.",
};

function formatChunks(
  chunks: RetrievedChunk[],
  prefix: string,
  refs: Map<string, RetrievedChunk>,
  maxLen = 500,
): string {
  if (chunks.length === 0) return `(none)`;
  return chunks
    .map((c, i) => {
      const ref = `${prefix}-${i + 1}`;
      refs.set(ref, c);
      return `[${ref}] ${c.content.slice(0, maxLen).trim()}`;
    })
    .join("\n\n");
}

export function buildPrompt(input: PromptInput): BuiltPrompt {
  const { config, context, history, trigger_message } = input;
  const refs = new Map<string, RetrievedChunk>();

  const system = `You are Tiberius, Ivy's AI sales assistant for WhatsApp and Telegram. Ivy is a crypto-native banking and payments platform for crypto exchanges (pay-ins and pay-outs, faster & cheaper than incumbents). You are in the pre-discovery phase — the goal window runs from the first message until a discovery call is held.

Always produce a single draft reply as one of Ivy's sales team would write it. Ground every factual claim in the structured slots you'll receive; when you can't, acknowledge the gap and say you'll follow up.

Output strictly in the provided JSON schema.`;

  const kb = formatChunks(context.kb_facts, "kb", refs);
  const sops = formatChunks(context.sops, "sop", refs);
  const tov = formatChunks(context.tov_examples, "tov", refs, 700);
  const convo = formatChunks(context.similar_past_convos, "convo", refs, 700);

  const historyBlock =
    history.length === 0
      ? "(this is the first message)"
      : history
          .slice(-12)
          .map(
            (m) =>
              `${m.role === "assistant" ? "AGENT" : "PROSPECT"}: ${m.content}`,
          )
          .join("\n");

  const calendly = config.calendly_url
    ? `Calendly URL: ${config.calendly_url}`
    : "Calendly URL: (none configured — if scheduling, ask for availability instead)";

  const userPrompt = `<agent_config>
Tone: ${config.tone} — ${TONE_HINT[config.tone]}
Response length: ${config.response_length} — ${LENGTH_HINT[config.response_length]}
Pushiness: ${config.pushiness} — ${PUSHINESS_HINT[config.pushiness]}
Goal: ${config.goal} — ${GOAL_HINT[config.goal]}
${calendly}
Confidence threshold: ${config.confidence_threshold}
</agent_config>

<state>
Detected stage: ${context.state.stage}
Detected intents: ${context.state.intents.join(", ")}
Intent confidence: ${context.state.intent_confidence.toFixed(2)}
Detected entities: ${context.entities.join(", ") || "(none)"}
State reasoning: ${context.state.reasoning}
</state>

<kb_facts>
${kb}
</kb_facts>

<sops>
${sops}
</sops>

<tov_examples>
${tov}
</tov_examples>

<similar_past_convos>
${convo}
</similar_past_convos>

<history>
${historyBlock}
</history>

<incoming_message>
${trigger_message}
</incoming_message>

<instructions>
1. Read <state>, <kb_facts>, <sops>, <tov_examples>, <similar_past_convos>, and <history>.
2. Draft ONE reply as an Ivy sales rep. Match the configured tone, length, and pushiness.
3. Only claim facts present in <kb_facts> or <sops>. If the prospect asks for something you cannot back from those slots, acknowledge the gap and offer to follow up or route to the right person.
4. Tool logic:
   - If the prospect is asking to schedule, or our goal is book_discovery_call and the moment fits → suggested_tool="send_calendly_link", tool_args.calendly_url=${config.calendly_url ?? "(unknown)"}.
   - If a specific document in <kb_facts> would be valuable to attach → suggested_tool="attach_document", tool_args.document_name="<filename or short descriptor>".
   - If you are not confident in the facts, or the request needs human judgment (legal/compliance/pricing negotiation) → suggested_tool="flag_for_review", tool_args.review_reason="<why>".
   - Otherwise → "none".
5. used_chunk_refs: list the ids you actually relied on (e.g. ["kb-2","sop-1"]). If you made no factual claim, leave empty.
6. Keep tone consistent with the <tov_examples>. Borrow phrasing patterns but never copy verbatim.
7. Never invent pricing numbers, specific product capabilities, licenses, or integrations that are not in <kb_facts>/<sops>.
</instructions>`;

  return { system, userPrompt, refs };
}
