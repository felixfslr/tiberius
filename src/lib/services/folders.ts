import { createServiceClient } from "@/lib/supabase/service";

export type FolderRecord = {
  id: string;
  agent_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
};

export type FolderWithCount = FolderRecord & { file_count: number };

export async function listFolders(
  agent_id: string,
  parent_id: string | null | undefined = undefined,
): Promise<FolderWithCount[]> {
  const sb = createServiceClient();
  let q = sb
    .from("folders")
    .select("*")
    .eq("agent_id", agent_id)
    .order("name", { ascending: true });
  if (parent_id === null) q = q.is("parent_id", null);
  else if (typeof parent_id === "string") q = q.eq("parent_id", parent_id);
  const { data: folders, error } = await q;
  if (error) throw new Error(error.message);

  // File counts are based on direct children only (folder_id on file).
  const { data: files, error: filesErr } = await sb
    .from("files")
    .select("folder_id")
    .eq("agent_id", agent_id);
  if (filesErr) throw new Error(filesErr.message);

  const counts = new Map<string | null, number>();
  for (const f of files ?? []) {
    const key = (f as { folder_id: string | null }).folder_id;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (folders ?? []).map((f) => ({
    ...(f as FolderRecord),
    file_count: counts.get((f as FolderRecord).id) ?? 0,
  }));
}

export async function getFolderById(id: string): Promise<FolderRecord | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("folders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as FolderRecord | null;
}

/** Builds the path from root → folder (inclusive). Root folder first, leaf last. */
export async function getFolderPath(id: string): Promise<FolderRecord[]> {
  const chain: FolderRecord[] = [];
  let current = await getFolderById(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    if (!current.parent_id) break;
    current = await getFolderById(current.parent_id);
  }
  return chain;
}

/** Counts summary for the *entire* agent (used by root view header stats). */
export async function getFolderCounts(agent_id: string): Promise<{
  all: number;
  unsorted: number;
}> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("files")
    .select("folder_id")
    .eq("agent_id", agent_id);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { folder_id: string | null }[];
  return {
    all: rows.length,
    unsorted: rows.filter((r) => r.folder_id === null).length,
  };
}

export async function createFolder(
  agent_id: string,
  name: string,
  parent_id: string | null = null,
): Promise<FolderRecord> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name required");
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("folders")
    .insert({ agent_id, name: trimmed, parent_id })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as FolderRecord;
}

export async function renameFolder(
  id: string,
  name: string,
): Promise<FolderRecord> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name required");
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("folders")
    .update({ name: trimmed })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as FolderRecord;
}

export async function deleteFolder(id: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.from("folders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Flat list of all folders for an agent — used by "Move to" pickers. */
export async function listAllFolders(
  agent_id: string,
): Promise<FolderRecord[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("folders")
    .select("*")
    .eq("agent_id", agent_id)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as FolderRecord[];
}
