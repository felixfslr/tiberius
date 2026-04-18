import { generateObject } from "ai";
import { z } from "zod";
import { miniModel } from "@/lib/openai";
import type { ConversationState, RetrievedChunk } from "@/lib/retrieval/types";
import type { GeneratedReply } from "@/lib/schemas/reply";

export type ConfidenceBreakdown = {
  retrieval: number;
  intent: number;
  groundedness: number;
  consistency: number;
};

const WEIGHTS = {
  retrieval: 0.25,
  intent: 0.2,
  groundedness: 0.4,
  consistency: 0.15,
} as const;

const GroundednessSchema = z.object({
  covered_ratio: z
    .number()
    .min(0)
    .max(1)
    .describe("Fraction of factual claims in the reply that are supported by the retrieved chunks."),
  unsupported_claims: z
    .array(z.string())
    .max(10)
    .describe("Claims from the reply that are NOT supported (empty if fully grounded)."),
});

function retrievalScore(reranked: RetrievedChunk[]): number {
  if (reranked.length === 0) return 0;
  // Weight: coverage (up to 3 chunks = 1.0) × normalized top-3 score mean.
  const coverage = Math.min(1, reranked.length / 3);
  const top = reranked.slice(0, 3);
  const maxScore = Math.max(...top.map((c) => c.score), 0.0001);
  const norm = top.reduce((acc, c) => acc + c.score / maxScore, 0) / top.length;
  return Math.max(0, Math.min(1, 0.6 * coverage + 0.4 * norm));
}

async function groundednessScore(
  reply: GeneratedReply,
  chunks: RetrievedChunk[],
): Promise<{ score: number; unsupported: string[] }> {
  const factSources = chunks.filter(
    (c) => c.content_type === "product_doc" || c.content_type === "glossary" || c.content_type === "sop",
  );
  if (factSources.length === 0) {
    // No grounding data — penalize moderately.
    return { score: 0.4, unsupported: [] };
  }

  const chunkBlock = factSources
    .map((c, i) => `[${i + 1}] (${c.content_type}) ${c.content.slice(0, 400)}`)
    .join("\n\n");

  try {
    const { object } = await generateObject({
      model: miniModel(),
      schema: GroundednessSchema,
      system: `You are a fact-checker. Given a draft sales reply and a set of reference chunks (facts the reply SHOULD rely on), identify any claim in the reply that is NOT supported by the chunks. Casual openings ("Hey", "Thanks for reaching out"), questions, and offers to schedule are not claims — ignore those. Score: covered_ratio = supported_claims / total_claims.`,
      prompt: `REPLY:\n${reply.reply_text}\n\nREFERENCE CHUNKS:\n${chunkBlock}`,
    });
    return {
      score: object.covered_ratio,
      unsupported: object.unsupported_claims,
    };
  } catch {
    return { score: 0.5, unsupported: [] };
  }
}

function intentScore(state: ConversationState): number {
  return Math.max(0, Math.min(1, state.intent_confidence));
}

/**
 * Self-consistency: if a second draft at a higher temperature comes out similar,
 * the model is "stable" on this case. We skip the 2nd generation for MVP speed
 * but keep the slot so the API shape stays final.
 */
function consistencyScore(): number {
  return 0.7; // neutral default until we wire the 2nd sample + embedding sim
}

export async function computeConfidence(params: {
  reply: GeneratedReply;
  state: ConversationState;
  reranked: RetrievedChunk[];
}): Promise<{ total: number; breakdown: ConfidenceBreakdown; unsupported: string[] }> {
  const retrieval = retrievalScore(params.reranked);
  const intent = intentScore(params.state);
  const { score: groundedness, unsupported } = await groundednessScore(
    params.reply,
    params.reranked,
  );
  const consistency = consistencyScore();

  const breakdown: ConfidenceBreakdown = {
    retrieval,
    intent,
    groundedness,
    consistency,
  };
  const total =
    WEIGHTS.retrieval * retrieval +
    WEIGHTS.intent * intent +
    WEIGHTS.groundedness * groundedness +
    WEIGHTS.consistency * consistency;

  return { total: Math.max(0, Math.min(1, total)), breakdown, unsupported };
}
