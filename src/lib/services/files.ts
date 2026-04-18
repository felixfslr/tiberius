import { createServiceClient } from "@/lib/supabase/service";
import { enqueueProcessFile } from "@/lib/queue";
import type { FileType } from "@/lib/schemas/file";

export type FileRecord = {
  id: string;
  agent_id: string;
  folder_id: string | null;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  file_type: FileType;
  status: string;
  error: string | null;
  metadata: Record<string, unknown>;
  uploaded_at: string;
  processed_at: string | null;
  chunks_count?: number;
};

export async function chunksCountByFile(
  agent_id: string,
): Promise<Map<string, number>> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("chunks")
    .select("file_id")
    .eq("agent_id", agent_id)
    .not("file_id", "is", null);
  if (error) return new Map();
  const map = new Map<string, number>();
  for (const row of (data ?? []) as { file_id: string | null }[]) {
    if (!row.file_id) continue;
    map.set(row.file_id, (map.get(row.file_id) ?? 0) + 1);
  }
  return map;
}

export async function listFilesWithChunks(
  agent_id: string,
  folder?: FolderFilter,
): Promise<FileRecord[]> {
  const [files, counts] = await Promise.all([
    listFiles(agent_id, folder),
    chunksCountByFile(agent_id),
  ]);
  return files.map((f) => ({ ...f, chunks_count: counts.get(f.id) ?? 0 }));
}

export type FolderFilter = "all" | "unsorted" | string;

function storagePath(
  agent_id: string,
  file_id: string,
  filename: string,
): string {
  const ext = filename.match(/\.[^.]+$/)?.[0] ?? "";
  return `${agent_id}/${file_id}${ext}`;
}

export async function listFiles(
  agent_id: string,
  folder?: FolderFilter,
): Promise<FileRecord[]> {
  const sb = createServiceClient();
  let q = sb
    .from("files")
    .select("*")
    .eq("agent_id", agent_id)
    .order("uploaded_at", { ascending: false });
  if (folder === "unsorted") {
    q = q.is("folder_id", null);
  } else if (folder && folder !== "all") {
    q = q.eq("folder_id", folder);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as FileRecord[];
}

export async function moveFile(
  file_id: string,
  folder_id: string | null,
): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("files")
    .update({ folder_id })
    .eq("id", file_id);
  if (error) throw new Error(error.message);
}

export async function getFile(id: string): Promise<FileRecord | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("files")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as FileRecord | null;
}

export async function uploadFile(
  agent_id: string,
  filename: string,
  mime: string | null,
  bytes: Buffer | Uint8Array,
  file_type: FileType,
  folder_id: string | null = null,
): Promise<FileRecord> {
  const sb = createServiceClient();
  // Reserve the row with `status=uploading` so the worker's
  // claim_pending_file() (which filters `status=pending`) won't race us.
  const { data: placeholder, error: insertErr } = await sb
    .from("files")
    .insert({
      agent_id,
      folder_id,
      filename,
      mime_type: mime,
      size_bytes: bytes.byteLength,
      file_type,
      storage_path: "pending",
      status: "uploading",
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(`Row insert failed: ${insertErr.message}`);

  const path = storagePath(agent_id, placeholder.id, filename);
  const { error: upErr } = await sb.storage
    .from("knowledge")
    .upload(path, bytes, {
      contentType: mime ?? "application/octet-stream",
      upsert: true,
    });
  if (upErr) {
    await sb.from("files").delete().eq("id", placeholder.id);
    throw new Error(`Storage upload failed: ${upErr.message}`);
  }

  // Flip to `pending` only after the object is on disk — this is the hand-off
  // point. enqueueProcessFile() updates status=pending, the worker claims it.
  const { data: row, error: updateErr } = await sb
    .from("files")
    .update({ storage_path: path, status: "pending" })
    .eq("id", placeholder.id)
    .select("*")
    .single();
  if (updateErr) throw new Error(updateErr.message);

  return row as FileRecord;
}

/**
 * Two-step direct-to-storage upload, used to bypass the Vercel API route body
 * size limit (~4.5 MB on Hobby, 10 MB on Pro without Fluid Compute).
 *
 * Step 1: server creates a placeholder files row (status='uploading') and asks
 * Supabase for a signed upload URL. Client is returned the URL + token.
 * Step 2: client uploads the binary DIRECTLY to Supabase Storage using the
 * signed URL. Traffic never touches our serverless function.
 * Step 3: client calls commitUploadedFile() to flip status='pending' once the
 * binary is on disk — worker then picks it up.
 */
export async function createSignedUpload(
  agent_id: string,
  filename: string,
  mime: string | null,
  size_bytes: number,
  file_type: FileType,
  folder_id: string | null = null,
): Promise<{
  file_id: string;
  storage_path: string;
  signed_url: string;
  token: string;
}> {
  const sb = createServiceClient();
  const { data: placeholder, error: insertErr } = await sb
    .from("files")
    .insert({
      agent_id,
      folder_id,
      filename,
      mime_type: mime,
      size_bytes,
      file_type,
      storage_path: "pending",
      status: "uploading",
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(`Row insert failed: ${insertErr.message}`);

  const path = storagePath(agent_id, placeholder.id, filename);
  const { data, error: signErr } = await sb.storage
    .from("knowledge")
    .createSignedUploadUrl(path, { upsert: true });
  if (signErr || !data) {
    await sb.from("files").delete().eq("id", placeholder.id);
    throw new Error(`Signed URL failed: ${signErr?.message ?? "unknown"}`);
  }
  return {
    file_id: placeholder.id,
    storage_path: path,
    signed_url: data.signedUrl,
    token: data.token,
  };
}

/**
 * Finalize a direct-to-storage upload: confirm the object exists in Storage,
 * then flip status='pending' so the worker can claim it.
 */
export async function commitUploadedFile(
  agent_id: string,
  file_id: string,
): Promise<FileRecord> {
  const sb = createServiceClient();
  const { data: file, error: getErr } = await sb
    .from("files")
    .select("*")
    .eq("id", file_id)
    .eq("agent_id", agent_id)
    .single();
  if (getErr || !file) throw new Error(`File not found`);
  if (file.status !== "uploading") {
    // Already committed — idempotent return.
    return file as FileRecord;
  }

  // Verify the object is actually on disk before flipping status. Supabase
  // returns a head-only list; if the path isn't there, the client lied.
  const { data: head, error: headErr } = await sb.storage
    .from("knowledge")
    .list(`${agent_id}`, { search: file_id });
  if (headErr) throw new Error(`Storage head failed: ${headErr.message}`);
  if (!head?.some((obj) => obj.name.startsWith(file_id))) {
    throw new Error("Storage object missing — upload was never completed");
  }

  const path = storagePath(agent_id, file_id, file.filename);
  const { data: updated, error: updateErr } = await sb
    .from("files")
    .update({ storage_path: path, status: "pending" })
    .eq("id", file_id)
    .select("*")
    .single();
  if (updateErr) throw new Error(updateErr.message);
  return updated as FileRecord;
}

/** Same as uploadFile, but input is a raw text string (user paste flow). */
export async function uploadText(
  agent_id: string,
  filename: string,
  content: string,
  file_type: FileType,
  folder_id: string | null = null,
): Promise<FileRecord> {
  const buf = Buffer.from(content, "utf-8");
  const safeFilename = filename.endsWith(".txt") ? filename : `${filename}.txt`;
  return uploadFile(
    agent_id,
    safeFilename,
    "text/plain",
    buf,
    file_type,
    folder_id,
  );
}

export async function deleteFile(id: string): Promise<void> {
  const sb = createServiceClient();
  const file = await getFile(id);
  if (!file) return;
  if (file.storage_path && file.storage_path !== "pending") {
    await sb.storage
      .from("knowledge")
      .remove([file.storage_path])
      .catch(() => void 0);
  }
  const { error } = await sb.from("files").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Re-run the pipeline for a file (e.g., user edited the raw text, or a failure happened). */
export async function reprocessFile(id: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("files")
    .update({ status: "pending", error: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await enqueueProcessFile(id);
}
