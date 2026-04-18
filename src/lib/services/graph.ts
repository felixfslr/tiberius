import { createServiceClient } from "@/lib/supabase/service";

export type GraphNode = {
  id: string;
  label: string;
  content_preview: string;
  content_type: string;
  size: number;
  edited_by_user: boolean;
  deprecated: boolean;
  retrieval_count: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  weight: number;
  edge_type: "similarity" | "co_retrieval" | "mixed";
};

export type GraphData = {
  agent_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  computed_at: string;
  stats: {
    chunk_count: number;
    edge_count: number;
    similarity_edges: number;
    co_retrieval_edges: number;
  };
};

// Process-local cache keyed by agent_id. TTL 30s.
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { ts: number; data: GraphData }>();

export function invalidateGraphCache(agent_id?: string): void {
  if (agent_id) cache.delete(agent_id);
  else cache.clear();
}

export async function buildGraphData(
  agent_id: string,
  opts: { fresh?: boolean; topK?: number } = {},
): Promise<GraphData> {
  if (!opts.fresh) {
    const hit = cache.get(agent_id);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  }

  const sb = createServiceClient();
  const topK = opts.topK ?? 5;

  const [chunksRes, neighborsRes, coRetRes, countsRes] = await Promise.all([
    sb
      .from("chunks")
      .select("id, content, content_type, metadata, edited_by_user")
      .eq("agent_id", agent_id),
    sb.rpc("graph_neighbors", { p_agent_id: agent_id, p_k: topK }),
    sb.rpc("co_retrieval_edges", { p_agent_id: agent_id }),
    sb.rpc("chunk_retrieval_counts", { p_agent_id: agent_id }),
  ]);

  if (chunksRes.error) throw new Error(chunksRes.error.message);
  if (neighborsRes.error) throw new Error(neighborsRes.error.message);
  if (coRetRes.error) throw new Error(coRetRes.error.message);
  if (countsRes.error) throw new Error(countsRes.error.message);

  const countsById = new Map<string, number>(
    (countsRes.data ?? []).map(
      (r: { chunk_id: string; retrieval_count: number | null }) =>
        [r.chunk_id, r.retrieval_count ?? 0] as const,
    ),
  );

  const nodes: GraphNode[] = (chunksRes.data ?? []).map((c) => {
    const meta = (c.metadata ?? {}) as Record<string, unknown>;
    const retrieval_count = countsById.get(c.id) ?? 0;
    const deprecated =
      meta["deprecated"] === true || meta["deprecated"] === "true";
    const preview =
      typeof c.content === "string" ? c.content.slice(0, 240) : "";
    const label =
      preview.replace(/\s+/g, " ").trim().slice(0, 70) +
      (preview.length > 70 ? "…" : "");
    return {
      id: c.id,
      label,
      content_preview: preview,
      content_type: (c.content_type ?? "unknown") as string,
      retrieval_count,
      size: 4 + Math.log(1 + retrieval_count) * 2.6,
      edited_by_user: !!c.edited_by_user,
      deprecated,
    };
  });

  // Merge edges by canonical key (smaller id first).
  type Merged = { weight_sim: number; weight_co: number };
  const mergeKey = (a: string, b: string) =>
    a < b ? `${a}|${b}` : `${b}|${a}`;
  const merged = new Map<string, Merged>();

  // Max co-retrieval for normalization.
  let maxCoRet = 1;
  for (const e of coRetRes.data ?? []) {
    if ((e.weight ?? 0) > maxCoRet) maxCoRet = e.weight ?? 1;
  }

  for (const n of neighborsRes.data ?? []) {
    const k = mergeKey(n.source_id, n.target_id);
    const cur = merged.get(k) ?? { weight_sim: 0, weight_co: 0 };
    cur.weight_sim = Math.max(cur.weight_sim, n.similarity ?? 0);
    merged.set(k, cur);
  }
  for (const e of coRetRes.data ?? []) {
    const k = mergeKey(e.a, e.b);
    const cur = merged.get(k) ?? { weight_sim: 0, weight_co: 0 };
    cur.weight_co = (e.weight ?? 0) / maxCoRet;
    merged.set(k, cur);
  }

  const edges: GraphEdge[] = [];
  let simCount = 0;
  let coCount = 0;
  for (const [k, w] of merged) {
    const [source, target] = k.split("|");
    if (!source || !target) continue;
    const hasSim = w.weight_sim > 0;
    const hasCo = w.weight_co > 0;
    const edge_type: GraphEdge["edge_type"] =
      hasSim && hasCo ? "mixed" : hasSim ? "similarity" : "co_retrieval";
    const weight = Math.max(w.weight_sim, w.weight_co);
    edges.push({ source, target, weight, edge_type });
    if (hasSim) simCount += 1;
    if (hasCo) coCount += 1;
  }

  const data: GraphData = {
    agent_id,
    nodes,
    edges,
    computed_at: new Date().toISOString(),
    stats: {
      chunk_count: nodes.length,
      edge_count: edges.length,
      similarity_edges: simCount,
      co_retrieval_edges: coCount,
    },
  };

  cache.set(agent_id, { ts: Date.now(), data });
  return data;
}
