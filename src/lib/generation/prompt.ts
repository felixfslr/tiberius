import type { AgentConfig } from "@/lib/schemas/agent";
import type { Message } from "@/lib/schemas/common";
import type { RetrievedChunk, RetrievedContext } from "@/lib/retrieval/types";
import type { EngagementStage } from "@/lib/schemas/reply";

export type StageHypothesis = {
  label: EngagementStage;
  probability: number;
  /** Short strategy guidance to make the draft commit to this stance. */
  strategy: string;
};

export type PromptInput = {
  config: AgentConfig;
  context: RetrievedContext;
  history: Message[];
  trigger_message: string;
  /** When set, the draft is generated AS IF this engagement stage is true. */
  stage_hypothesis?: StageHypothesis;
};

export type BuiltPrompt = {
  system: string;
  userPrompt: string;
  refs: Map<string, RetrievedChunk>;
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
  const { config, context, history, trigger_message, stage_hypothesis } = input;
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
${
  stage_hypothesis
    ? `
<stage_hypothesis>
For this draft, write AS IF the prospect's engagement stage is: ${stage_hypothesis.label} (probability ${stage_hypothesis.probability.toFixed(2)}).
Strategy guidance: ${stage_hypothesis.strategy}
This is one of three parallel hypothesis-conditioned drafts. Commit fully to this stance — do not hedge across alternative stages.
</stage_hypothesis>
`
    : ""
}
<instructions>
1. Read <state>, <kb_facts>, <sops>, <tov_examples>, <similar_past_convos>, and <history>.
2. Tone & style: mirror the customer. Read <incoming_message> and match their register (formal vs casual), sentence length, punctuation style, use of contractions, emoji, and greetings/sign-offs. Treat <tov_examples> as a secondary house-style reference — borrow phrasing patterns to stay on-brand, but never copy verbatim, and customer mirroring always wins when the two conflict.
2a. Capitalization is a HARD mirror of <incoming_message>, not <tov_examples> or any other sample:
    - If the incoming message is standard sentence-case (capital at sentence starts, proper nouns capitalized) → you use standard sentence-case.
    - If the incoming message is entirely lowercase → you write entirely lowercase.
    - If the incoming message uses ALL CAPS or mixed patterns → match that.
    Ignore capitalization patterns in <tov_examples> and <similar_past_convos> entirely — they are not the anchor for caps.
3. Only claim facts present in <kb_facts> or <sops>. If the prospect asks for something you cannot back from those slots, acknowledge the gap and offer to follow up or route to the right person.
4. Tool logic:
   - If the prospect is asking to schedule, or <state> indicates scheduling is the natural next move and a Calendly URL is configured → suggested_tool="send_calendly_link", tool_args.calendly_url=${config.calendly_url ?? "(unknown)"}.
   - If a specific document in <kb_facts> would be valuable to attach → suggested_tool="attach_document", tool_args.document_name="<filename or short descriptor>".
   - If you are not confident in the facts, or the request needs human judgment (legal/compliance/pricing negotiation) → suggested_tool="flag_for_review", tool_args.review_reason="<why>".
   - Otherwise → "none".
5. used_chunk_refs: list the ids you actually relied on (e.g. ["kb-2","sop-1"]). If you made no factual claim, leave empty.
6. Never invent pricing numbers, specific product capabilities, licenses, or integrations that are not in <kb_facts>/<sops>.
</instructions>`;

  return { system, userPrompt, refs };
}
