import { generateObject } from "ai";
import { z } from "zod";
import { miniModel } from "@/lib/openai";
import type { ConversationState, RetrievedChunk } from "./types";
import type { Message } from "@/lib/schemas/common";

const Schema = z.object({
  ranked_indices: z.array(z.number().int().min(0)).max(30),
  reasoning: z.string().max(400).optional(),
});

const SYSTEM = `You rank knowledge chunks for a B2B sales reply.
Higher rank = more directly useful for answering the prospect's incoming message.

Consider:
- Does the chunk contain facts the agent would actually CITE in a reply?
- Is it appropriate for the current sales stage (cold vs scheduling vs post_call)?
- Does it match the prospect's intent (pricing, objection, timeline, etc.)?
- Prefer sops for procedural questions, product_doc for facts, tov_example for tone calibration.

Output indices in descending relevance order. Skip clearly irrelevant chunks.`;

export async function llmRerank(params: {
  candidates: RetrievedChunk[];
  trigger_message: string;
  history: Message[];
  state: ConversationState;
  topN?: number;
}): Promise<RetrievedChunk[]> {
  const { candidates, trigger_message, history, state } = params;
  const topN = params.topN ?? 10;
  if (candidates.length === 0) return [];
  if (candidates.length <= topN) return candidates;

  const historyBlock = history
    .slice(-4)
    .map((m) => `${m.role === "assistant" ? "Agent" : "Prospect"}: ${m.content}`)
    .join("\n");

  const candidateBlock = candidates
    .map(
      (c, i) =>
        `[${i}] (type=${c.content_type}) ${c.content.slice(0, 400).replace(/\n/g, " ")}`,
    )
    .join("\n");

  try {
    const { object } = await generateObject({
      model: miniModel(),
      schema: Schema,
      system: SYSTEM,
      prompt: `CONVERSATION STATE:
stage: ${state.stage}
intents: ${state.intents.join(", ")}
intent_confidence: ${state.intent_confidence.toFixed(2)}
entities: ${state.entities.join(", ") || "(none)"}

HISTORY:
${historyBlock || "(none)"}

INCOMING MESSAGE:
${trigger_message}

CANDIDATE CHUNKS (${candidates.length}):
${candidateBlock}

Return the top ${topN} candidate indices in relevance order.`,
    });

    const unique = Array.from(new Set(object.ranked_indices))
      .filter((i) => i >= 0 && i < candidates.length)
      .slice(0, topN);
    // Include indices the model ranked; then backfill remaining slots with
    // any candidates the model skipped (preserve recall).
    const picked = unique.map((i) => candidates[i]);
    if (picked.length < topN) {
      const missing = candidates.filter((_, i) => !unique.includes(i));
      picked.push(...missing.slice(0, topN - picked.length));
    }
    return picked;
  } catch {
    // Model failure — return top-N by RRF score (candidates are pre-sorted).
    return candidates.slice(0, topN);
  }
}
