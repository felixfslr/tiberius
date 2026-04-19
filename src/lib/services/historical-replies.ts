import { consola } from "consola";
import { createServiceClient } from "@/lib/supabase/service";
import type { RetrievedChunk } from "@/lib/retrieval/types";
import type { EngagementStage, TonePolishSource } from "@/lib/schemas/reply";

/**
 * Find ≤k historical replies suitable for tone-matching the chosen stage.
 *
 * Strategy:
 * 1. Query reply_logs for this agent where debug.stage_engagement = stage,
 *    most recent first, take up to k.
 * 2. If <k found, top up with the agent's most-recent reply_logs regardless
 *    of stage (still real Ferdi outbound style, just not stage-pinned).
 * 3. If still <k, fall back to tov_examples chunks (already curated style).
 *
 * No embedding similarity for v1 — recency + stage match is a fine first cut
 * since tone is roughly stage-invariant within an agent.
 */
export async function findSimilarFerdiReplies(params: {
  agent_id: string;
  stage: EngagementStage;
  tov_fallback: RetrievedChunk[];
  k?: number;
}): Promise<TonePolishSource[]> {
  const { agent_id, stage, tov_fallback, k = 3 } = params;
  const sb = createServiceClient();

  const sources: TonePolishSource[] = [];

  // 1. Stage-matched recent reply_logs.
  try {
    const { data, error } = await sb
      .from("reply_logs")
      .select("id, draft, debug")
      .eq("agent_id", agent_id)
      .filter("debug->>stage_engagement", "eq", stage)
      .order("created_at", { ascending: false })
      .limit(k);
    if (error) throw error;
    for (const row of data ?? []) {
      if (sources.length >= k) break;
      if (typeof row.draft === "string" && row.draft.length > 0) {
        sources.push({
          reply_log_id: row.id,
          content: row.draft,
          origin: "reply_logs",
        });
      }
    }
  } catch (e) {
    consola.warn("findSimilarFerdiReplies stage query failed:", e);
  }

  // 2. Top up with any recent reply_logs (any stage).
  if (sources.length < k) {
    try {
      const need = k - sources.length;
      const exclude = sources
        .map((s) => s.reply_log_id)
        .filter(Boolean) as string[];
      let q = sb
        .from("reply_logs")
        .select("id, draft")
        .eq("agent_id", agent_id)
        .order("created_at", { ascending: false })
        .limit(need + exclude.length);
      if (exclude.length > 0) q = q.not("id", "in", `(${exclude.join(",")})`);
      const { data, error } = await q;
      if (error) throw error;
      for (const row of data ?? []) {
        if (sources.length >= k) break;
        if (typeof row.draft === "string" && row.draft.length > 0) {
          sources.push({
            reply_log_id: row.id,
            content: row.draft,
            origin: "reply_logs",
          });
        }
      }
    } catch (e) {
      consola.warn("findSimilarFerdiReplies recency top-up failed:", e);
    }
  }

  // 3. tov_examples fallback.
  if (sources.length < k) {
    for (const chunk of tov_fallback) {
      if (sources.length >= k) break;
      sources.push({
        reply_log_id: null,
        content: chunk.content.slice(0, 800),
        origin: "tov_examples",
      });
    }
  }

  return sources;
}
