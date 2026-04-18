import { createServiceClient } from "@/lib/supabase/service";
import {
  AgentConfigSchema,
  AgentCreateSchema,
  AgentPatchSchema,
  AgentSchema,
  type Agent,
  type AgentCreate,
  type AgentPatch,
} from "@/lib/schemas/agent";

function parseAgent(row: unknown): Agent {
  // DB stores partial config; merge with defaults before schema-parse.
  const r = row as Record<string, unknown> & { config?: unknown };
  const mergedConfig = AgentConfigSchema.parse({
    ...(typeof r.config === "object" && r.config !== null ? r.config : {}),
  });
  return AgentSchema.parse({ ...r, config: mergedConfig });
}

export async function listAgents(): Promise<Agent[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(parseAgent);
}

export async function getAgent(id: string): Promise<Agent | null> {
  const sb = createServiceClient();
  const { data, error } = await sb.from("agents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? parseAgent(data) : null;
}

export async function createAgent(input: AgentCreate): Promise<Agent> {
  const parsed = AgentCreateSchema.parse(input);
  const config = AgentConfigSchema.parse(parsed.config ?? {});
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("agents")
    .insert({ name: parsed.name, description: parsed.description ?? null, config })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return parseAgent(data);
}

export async function updateAgent(id: string, patch: AgentPatch): Promise<Agent> {
  const parsed = AgentPatchSchema.parse(patch);
  const update: Record<string, unknown> = {};
  if (parsed.name !== undefined) update.name = parsed.name;
  if (parsed.description !== undefined) update.description = parsed.description;
  if (parsed.config !== undefined) {
    const existing = await getAgent(id);
    if (!existing) throw new Error("Agent not found");
    update.config = AgentConfigSchema.parse({ ...existing.config, ...parsed.config });
  }
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("agents")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return parseAgent(data);
}

export async function deleteAgent(id: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.from("agents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Clones an agent: copies the agent row + all chunks (not files; Storage objects
 * would duplicate paths). Clone gets a new id and `name + " (clone)"`.
 */
export async function cloneAgent(id: string): Promise<Agent> {
  const sb = createServiceClient();
  const source = await getAgent(id);
  if (!source) throw new Error("Source agent not found");

  const cloned = await createAgent({
    name: `${source.name} (clone)`,
    description: source.description ?? undefined,
    config: source.config,
  });

  // Copy chunks with the new agent_id. file_id intentionally null (files stay
  // with the source agent). Keep content, content_type, embedding, metadata.
  const { data: chunks, error: chunksErr } = await sb
    .from("chunks")
    .select("content, content_type, embedding, metadata, position")
    .eq("agent_id", id);
  if (chunksErr) throw new Error(chunksErr.message);

  if (chunks && chunks.length) {
    const rows = chunks.map((c) => ({
      agent_id: cloned.id,
      file_id: null,
      content: c.content,
      content_type: c.content_type,
      embedding: c.embedding,
      metadata: c.metadata,
      position: c.position,
      edited_by_user: false,
    }));
    const { error: insertErr } = await sb.from("chunks").insert(rows);
    if (insertErr) throw new Error(insertErr.message);
  }

  return cloned;
}
