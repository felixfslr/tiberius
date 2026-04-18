import { createServiceClient } from "@/lib/supabase/service";
import { embedBatch } from "@/lib/processing/embed";
import type { RetrievedChunk } from "./types";
import type { ChunkMetadata } from "@/lib/schemas/chunk";

type HybridRow = {
  id: string;
  file_id: string | null;
  content: string;
  content_type: string;
  metadata: ChunkMetadata;
  vector_rank: number | null;
  fts_rank: number | null;
  score: number;
};

export async function embedTrigger(text: string): Promise<number[]> {
  const [e] = await embedBatch([text]);
  return e;
}

export async function hybridSearch(params: {
  agent_id: string;
  query_embedding: number[];
  query_text: string;
  k?: number;
  filter?: Record<string, unknown>;
  content_types?: string[];
}): Promise<RetrievedChunk[]> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("hybrid_search", {
    p_agent_id: params.agent_id,
    p_embedding: params.query_embedding as unknown as string, // pgvector JSON cast
    p_query: params.query_text,
    p_k: params.k ?? 20,
    p_filter: params.filter ?? {},
    p_content_types: params.content_types ?? null,
  });
  if (error) throw new Error(`hybrid_search failed: ${error.message}`);
  const rows = (data ?? []) as HybridRow[];
  return rows.map((r) => ({
    id: r.id,
    file_id: r.file_id,
    content: r.content,
    content_type: r.content_type,
    metadata: r.metadata,
    source: "hybrid" as const,
    score: r.score,
  }));
}

export async function vectorSearchMetadata(params: {
  agent_id: string;
  query_embedding: number[];
  k?: number;
  filter: Record<string, unknown>;
  content_types?: string[];
}): Promise<RetrievedChunk[]> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc("search_chunks_vector", {
    p_agent_id: params.agent_id,
    p_embedding: params.query_embedding as unknown as string,
    p_k: params.k ?? 20,
    p_filter: params.filter,
    p_content_types: params.content_types ?? null,
  });
  if (error) throw new Error(`search_chunks_vector failed: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: string;
    file_id: string | null;
    content: string;
    content_type: string;
    metadata: ChunkMetadata;
    distance: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    file_id: r.file_id,
    content: r.content,
    content_type: r.content_type,
    metadata: r.metadata,
    source: "metadata" as const,
    score: 1 - r.distance, // cosine-distance → similarity
  }));
}

/** Finds chunks whose metadata.entities overlap any of the given entities. */
export async function entitySearch(params: {
  agent_id: string;
  entities: string[];
  k?: number;
}): Promise<RetrievedChunk[]> {
  if (params.entities.length === 0) return [];
  const sb = createServiceClient();
  // jsonb "?|" operator: any of these text keys are top-level keys — but we need
  // array overlap, not key existence. Use metadata->entities @> '["..."]'::jsonb
  // for each entity and union. Simpler: read chunks where metadata @> shape and
  // filter client-side (cheap, agent_id-scoped).
  const { data, error } = await sb
    .from("chunks")
    .select("id, file_id, content, content_type, metadata")
    .eq("agent_id", params.agent_id)
    .limit(500);
  if (error) throw new Error(`entity search failed: ${error.message}`);
  const lower = params.entities.map((e) => e.toLowerCase());
  const hits: RetrievedChunk[] = [];
  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as ChunkMetadata;
    const ents = (meta.entities ?? []).map((e: string) => e.toLowerCase());
    const overlap = ents.filter((e: string) => lower.includes(e)).length;
    if (overlap > 0) {
      hits.push({
        id: row.id,
        file_id: row.file_id,
        content: row.content,
        content_type: row.content_type,
        metadata: meta,
        source: "entity",
        score: overlap,
      });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, params.k ?? 15);
}

/** Reciprocal-rank fusion merge across multiple sorted streams. */
export function rrfMerge(
  streams: RetrievedChunk[][],
  opts: { k?: number; topN?: number } = {},
): RetrievedChunk[] {
  const k = opts.k ?? 60;
  const scoreBy = new Map<string, { chunk: RetrievedChunk; score: number; sources: string[] }>();

  for (const stream of streams) {
    stream.forEach((chunk, rank) => {
      const contrib = 1 / (k + rank + 1);
      const existing = scoreBy.get(chunk.id);
      if (existing) {
        existing.score += contrib;
        if (!existing.sources.includes(chunk.source)) {
          existing.sources.push(chunk.source);
        }
      } else {
        scoreBy.set(chunk.id, { chunk, score: contrib, sources: [chunk.source] });
      }
    });
  }

  const merged = Array.from(scoreBy.values())
    .sort((a, b) => b.score - a.score)
    .map(({ chunk, score, sources }) => ({
      ...chunk,
      score,
      // Tag with combined sources for debug; keep the primary source field valid.
      source: (sources[0] ?? chunk.source) as RetrievedChunk["source"],
    }));

  return opts.topN ? merged.slice(0, opts.topN) : merged;
}
