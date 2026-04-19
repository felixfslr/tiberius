import { generateObject } from "ai";
import { miniModel } from "@/lib/openai";
import type { Message } from "@/lib/schemas/common";
import type { RetrievedContext } from "@/lib/retrieval/types";
import {
  CriticScoresSchema,
  type CriticScores,
  type EngagementStage,
  type GeneratedReply,
} from "@/lib/schemas/reply";

const SYSTEM = `You are a multi-dimensional critic for a B2B sales reply draft.

Score the draft on FOUR independent dimensions (0..1) and identify which engagement stage the draft is ACTUALLY optimized for, given the real conversation context (not the hypothesis it was conditioned on).

Dimensions:
- stage_appropriateness: how well the draft's strategy fits the prospect's true situation, given the conversation.
- groundedness: every factual claim in the draft is supported by retrieved KB/SOP chunks. Casual openings and questions don't count as claims.
- tone_match: register, sentence length, formality, emoji/contraction usage match the prospect's incoming message.
- intent_match: the draft directly addresses what the prospect was actually asking for.

inferred_stage: looking at the actual conversation (not the hypothesis), which engagement stage is this draft best suited for?
notes: one short sentence — the draft's biggest strength or biggest weakness.`;

export async function runCritics(params: {
  draft: GeneratedReply;
  hypothesis: EngagementStage;
  context: RetrievedContext;
  history: Message[];
  trigger_message: string;
}): Promise<CriticScores> {
  const { draft, hypothesis, context, history, trigger_message } = params;

  const recent = history.slice(-8);
  const historyBlock =
    recent.length === 0
      ? "(none)"
      : recent
          .map(
            (m) =>
              `${m.role === "assistant" ? "Agent" : "Prospect"}: ${m.content}`,
          )
          .join("\n");

  const factChunks = context.kb_facts.concat(context.sops).slice(0, 8);
  const chunkBlock =
    factChunks.length === 0
      ? "(none)"
      : factChunks
          .map(
            (c, i) =>
              `[${i + 1}] (${c.content_type}) ${c.content.slice(0, 350)}`,
          )
          .join("\n\n");

  const prompt = `HYPOTHESIS THIS DRAFT WAS CONDITIONED ON: ${hypothesis}

INCOMING MESSAGE:
${trigger_message}

CONVERSATION HISTORY:
${historyBlock}

REFERENCE CHUNKS (for groundedness):
${chunkBlock}

DRAFT REPLY:
${draft.reply_text}

DRAFT METADATA:
detected_intent=${draft.detected_intent}
suggested_tool=${draft.suggested_tool}
used_chunk_refs=${JSON.stringify(draft.used_chunk_refs)}`;

  try {
    const { object } = await generateObject({
      model: miniModel(),
      schema: CriticScoresSchema,
      system: SYSTEM,
      prompt,
    });
    return object;
  } catch {
    return {
      stage_appropriateness: 0.5,
      groundedness: 0.5,
      tone_match: 0.5,
      intent_match: 0.5,
      inferred_stage: hypothesis,
      notes: "Critic failed; neutral fallback scores.",
    };
  }
}
