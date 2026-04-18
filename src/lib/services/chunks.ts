import { createServiceClient } from "@/lib/supabase/service";
import { embedBatch } from "@/lib/processing/embed";
import type { ContentType } from "@/lib/schemas/common";

export type ChunkRow = {
  id: string;
  file_id: string | null;
  agent_id: string;
  content: string;
  content_type: ContentType;
  metadata: Record<string, unknown>;
  position: number;
  edited_by_user: boolean;
  created_at: string;
};

export async function listChunks(
  agent_id: string,
  filters: {
    file_id?: string;
    content_type?: ContentType;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ChunkRow[]> {
  const sb = createServiceClient();
  let q = sb
    .from("chunks")
    .select("id, file_id, agent_id, content, content_type, metadata, position, edited_by_user, created_at")
    .eq("agent_id", agent_id)
    .order("position", { ascending: true });
  if (filters.file_id) q = q.eq("file_id", filters.file_id);
  if (filters.content_type) q = q.eq("content_type", filters.content_type);
  if (filters.limit) q = q.limit(filters.limit);
  if (filters.offset !== undefined && filters.limit) {
    q = q.range(filters.offset, filters.offset + filters.limit - 1);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ChunkRow[];
}

export async function getChunk(id: string): Promise<ChunkRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("chunks")
    .select("id, file_id, agent_id, content, content_type, metadata, position, edited_by_user, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ChunkRow | null;
}

/** Updates content and re-embeds in one round-trip. Marks `edited_by_user`. */
export async function updateChunk(id: string, content: string): Promise<ChunkRow> {
  const [embedding] = await embedBatch([content]);
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("chunks")
    .update({ content, embedding, edited_by_user: true })
    .eq("id", id)
    .select("id, file_id, agent_id, content, content_type, metadata, position, edited_by_user, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as ChunkRow;
}

export async function deleteChunk(id: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.from("chunks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
