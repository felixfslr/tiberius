import { createServiceClient } from "@/lib/supabase/service";
import { enqueueProcessFile } from "@/lib/queue";
import type { FileType } from "@/lib/schemas/file";

export type FileRecord = {
  id: string;
  agent_id: string;
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
};

function storagePath(agent_id: string, file_id: string, filename: string): string {
  const ext = filename.match(/\.[^.]+$/)?.[0] ?? "";
  return `${agent_id}/${file_id}${ext}`;
}

export async function listFiles(agent_id: string): Promise<FileRecord[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("files")
    .select("*")
    .eq("agent_id", agent_id)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FileRecord[];
}

export async function getFile(id: string): Promise<FileRecord | null> {
  const sb = createServiceClient();
  const { data, error } = await sb.from("files").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as FileRecord | null;
}

export async function uploadFile(
  agent_id: string,
  filename: string,
  mime: string | null,
  bytes: Buffer | Uint8Array,
  file_type: FileType,
): Promise<FileRecord> {
  const sb = createServiceClient();
  // Reserve the row with `status=uploading` so the worker's
  // claim_pending_file() (which filters `status=pending`) won't race us.
  const { data: placeholder, error: insertErr } = await sb
    .from("files")
    .insert({
      agent_id,
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
    .upload(path, bytes, { contentType: mime ?? "application/octet-stream", upsert: true });
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

/** Same as uploadFile, but input is a raw text string (user paste flow). */
export async function uploadText(
  agent_id: string,
  filename: string,
  content: string,
  file_type: FileType,
): Promise<FileRecord> {
  const buf = Buffer.from(content, "utf-8");
  const safeFilename = filename.endsWith(".txt") ? filename : `${filename}.txt`;
  return uploadFile(agent_id, safeFilename, "text/plain", buf, file_type);
}

export async function deleteFile(id: string): Promise<void> {
  const sb = createServiceClient();
  const file = await getFile(id);
  if (!file) return;
  if (file.storage_path && file.storage_path !== "pending") {
    await sb.storage.from("knowledge").remove([file.storage_path]).catch(() => void 0);
  }
  const { error } = await sb.from("files").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Re-run the pipeline for a file (e.g., user edited the raw text, or a failure happened). */
export async function reprocessFile(id: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.from("files").update({ status: "pending", error: null }).eq("id", id);
  if (error) throw new Error(error.message);
  await enqueueProcessFile(id);
}
