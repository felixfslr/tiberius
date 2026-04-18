import { createServiceClient } from "@/lib/supabase/service";

/**
 * Rich graph data for the v2 view. Unlike `buildGraphData` (which only carries
 * content_type + retrieval count), this pulls the full enrichment metadata
 * (stage, intent, entities, summary) and joins the parent file so we can
 * cluster by source. Same edge structure as buildGraphData.
 */
export type RichNode = {
  id: string;
  content: string;
  content_preview: string;
  content_type: string;
  position: number;
  retrieval_count: number;
  edited_by_user: boolean;
  deprecated: boolean;
  stage: string[];
  intent: string[];
  entities: string[];
  summary: string | null;
  file_id: string | null;
  filename: string | null;
  folder_id: string | null;
  folder_name: string | null;
};

export type RichEdge = {
  source: string;
  target: string;
  weight: number;
  edge_type: "similarity" | "co_retrieval" | "mixed";
};

export type RichGraph = {
  agent_id: string;
  nodes: RichNode[];
  edges: RichEdge[];
  computed_at: string;
  stats: {
    chunk_count: number;
    edge_count: number;
    similarity_edges: number;
    co_retrieval_edges: number;
    unique_stages: string[];
    unique_intents: string[];
    top_entities: { entity: string; count: number }[];
    content_type_counts: Record<string, number>;
  };
};

export async function buildRichGraph(
  agent_id: string,
  opts: { topK?: number } = {},
): Promise<RichGraph> {
  const sb = createServiceClient();
  const topK = opts.topK ?? 5;

  const [chunksRes, filesRes, foldersRes, simRes, coRes, countsRes] =
    await Promise.all([
      sb
        .from("chunks")
        .select(
          "id, file_id, content, content_type, metadata, position, edited_by_user",
        )
        .eq("agent_id", agent_id),
      sb
        .from("files")
        .select("id, filename, folder_id")
        .eq("agent_id", agent_id),
      sb.from("folders").select("id, name").eq("agent_id", agent_id),
      sb.rpc("graph_neighbors", { p_agent_id: agent_id, p_k: topK }),
      sb.rpc("co_retrieval_edges", { p_agent_id: agent_id }),
      sb.rpc("chunk_retrieval_counts", { p_agent_id: agent_id }),
    ]);

  if (chunksRes.error) throw new Error(chunksRes.error.message);
  if (filesRes.error) throw new Error(filesRes.error.message);
  if (foldersRes.error) throw new Error(foldersRes.error.message);
  if (simRes.error) throw new Error(simRes.error.message);
  if (coRes.error) throw new Error(coRes.error.message);
  if (countsRes.error) throw new Error(countsRes.error.message);

  const filesById = new Map<
    string,
    { filename: string; folder_id: string | null }
  >();
  for (const f of filesRes.data ?? []) {
    filesById.set(f.id, { filename: f.filename, folder_id: f.folder_id });
  }
  const foldersById = new Map<string, string>();
  for (const f of foldersRes.data ?? []) {
    foldersById.set(f.id, f.name);
  }
  const countsById = new Map<string, number>(
    (countsRes.data ?? []).map(
      (r: { chunk_id: string; retrieval_count: number | null }) =>
        [r.chunk_id, r.retrieval_count ?? 0] as const,
    ),
  );

  const asArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : typeof v === "string"
        ? [v]
        : [];

  const nodes: RichNode[] = (chunksRes.data ?? []).map((c) => {
    const meta = (c.metadata ?? {}) as Record<string, unknown>;
    const file = c.file_id ? filesById.get(c.file_id) : undefined;
    const preview =
      typeof c.content === "string"
        ? c.content.replace(/\s+/g, " ").trim().slice(0, 200)
        : "";
    const deprecated =
      meta["deprecated"] === true || meta["deprecated"] === "true";
    return {
      id: c.id,
      content: typeof c.content === "string" ? c.content : "",
      content_preview: preview,
      content_type: (c.content_type ?? "unknown") as string,
      position: typeof c.position === "number" ? c.position : 0,
      retrieval_count: countsById.get(c.id) ?? 0,
      edited_by_user: !!c.edited_by_user,
      deprecated,
      stage: asArray(meta["stage"]),
      intent: asArray(meta["intent"]),
      entities: asArray(meta["entities"]),
      summary:
        typeof meta["summary"] === "string"
          ? (meta["summary"] as string)
          : null,
      file_id: c.file_id ?? null,
      filename: file?.filename ?? null,
      folder_id: file?.folder_id ?? null,
      folder_name: file?.folder_id
        ? (foldersById.get(file.folder_id) ?? null)
        : null,
    };
  });

  // Merge edges by canonical key (smaller id first)
  const mergeKey = (a: string, b: string) =>
    a < b ? `${a}|${b}` : `${b}|${a}`;
  type Merged = { weight_sim: number; weight_co: number };
  const merged = new Map<string, Merged>();

  let maxCo = 1;
  for (const e of coRes.data ?? []) {
    if ((e.weight ?? 0) > maxCo) maxCo = e.weight ?? 1;
  }

  for (const n of simRes.data ?? []) {
    const k = mergeKey(n.source_id, n.target_id);
    const cur = merged.get(k) ?? { weight_sim: 0, weight_co: 0 };
    cur.weight_sim = Math.max(cur.weight_sim, n.similarity ?? 0);
    merged.set(k, cur);
  }
  for (const e of coRes.data ?? []) {
    const k = mergeKey(e.a, e.b);
    const cur = merged.get(k) ?? { weight_sim: 0, weight_co: 0 };
    cur.weight_co = (e.weight ?? 0) / maxCo;
    merged.set(k, cur);
  }

  const edges: RichEdge[] = [];
  let simCount = 0;
  let coCount = 0;
  for (const [k, w] of merged) {
    const [source, target] = k.split("|");
    if (!source || !target) continue;
    const hasSim = w.weight_sim > 0;
    const hasCo = w.weight_co > 0;
    const edge_type: RichEdge["edge_type"] =
      hasSim && hasCo ? "mixed" : hasSim ? "similarity" : "co_retrieval";
    const weight = Math.max(w.weight_sim, w.weight_co);
    edges.push({ source, target, weight, edge_type });
    if (hasSim) simCount += 1;
    if (hasCo) coCount += 1;
  }

  // Aggregate stats for sidebar filters.
  const stageSet = new Set<string>();
  const intentSet = new Set<string>();
  const entityCounts = new Map<string, number>();
  const contentTypeCounts: Record<string, number> = {};
  for (const n of nodes) {
    for (const s of n.stage) stageSet.add(s);
    for (const i of n.intent) intentSet.add(i);
    for (const e of n.entities) {
      const key = e.toLowerCase().trim();
      if (!key) continue;
      entityCounts.set(key, (entityCounts.get(key) ?? 0) + 1);
    }
    contentTypeCounts[n.content_type] =
      (contentTypeCounts[n.content_type] ?? 0) + 1;
  }
  const topEntities = [...entityCounts.entries()]
    .map(([entity, count]) => ({ entity, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    agent_id,
    nodes,
    edges,
    computed_at: new Date().toISOString(),
    stats: {
      chunk_count: nodes.length,
      edge_count: edges.length,
      similarity_edges: simCount,
      co_retrieval_edges: coCount,
      unique_stages: [...stageSet].sort(),
      unique_intents: [...intentSet].sort(),
      top_entities: topEntities,
      content_type_counts: contentTypeCounts,
    },
  };
}
