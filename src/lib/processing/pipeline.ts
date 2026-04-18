import { consola } from "consola";
import { createServiceClient } from "@/lib/supabase/service";
import { extractFromStorage } from "./extract";
import { chunkText } from "./chunk";
import { enrichChunks } from "./enrich";
import { embedBatch } from "./embed";
import type { FileType } from "@/lib/schemas/file";

type FileRow = {
  id: string;
  agent_id: string;
  storage_path: string;
  mime_type: string | null;
  file_type: FileType;
};

async function setStatus(
  sb: ReturnType<typeof createServiceClient>,
  file_id: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  const { error } = await sb
    .from("files")
    .update({ status, ...extra })
    .eq("id", file_id);
  if (error) consola.warn(`status update failed for ${file_id}: ${error.message}`);
}

/**
 * Runs the full extract → chunk → enrich → embed pipeline for a file.
 * Called by the worker for each `process_file` job. Idempotent: deletes existing
 * chunks for this file before inserting new ones, so retries recover cleanly.
 */
export async function processFile(file_id: string): Promise<{ chunks: number }> {
  const sb = createServiceClient();
  const { data: file, error } = await sb
    .from("files")
    .select("id, agent_id, storage_path, mime_type, file_type")
    .eq("id", file_id)
    .single<FileRow>();
  if (error || !file) throw new Error(`File not found: ${file_id}`);

  try {
    await setStatus(sb, file.id, "extracting");
    const { text, pageCount } = await extractFromStorage(file.storage_path, file.mime_type);
    if (!text.trim()) throw new Error("Extracted text is empty");

    await setStatus(sb, file.id, "chunking", {
      metadata: { raw_text_length: text.length, page_count: pageCount ?? null },
    });
    const raws = chunkText(text, file.file_type);
    if (raws.length === 0) throw new Error("Chunker produced no chunks");
    consola.info(`File ${file.id}: ${raws.length} chunks`);

    await setStatus(sb, file.id, "enriching");
    const metadatas = await enrichChunks(raws.map((r) => r.content));

    await setStatus(sb, file.id, "embedding");
    const embeddings = await embedBatch(raws.map((r) => r.content));

    // Clear any previous chunks for this file (idempotent retry).
    await sb.from("chunks").delete().eq("file_id", file.id);

    const rows = raws.map((r, i) => ({
      agent_id: file.agent_id,
      file_id: file.id,
      content: r.content,
      content_type: file.file_type,
      metadata: metadatas[i] ?? {},
      embedding: embeddings[i],
      position: r.position,
    }));

    // Insert in batches to avoid row-size limits.
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error: insertErr } = await sb.from("chunks").insert(slice);
      if (insertErr) throw new Error(`Chunk insert failed: ${insertErr.message}`);
    }

    await setStatus(sb, file.id, "ready", {
      processed_at: new Date().toISOString(),
      error: null,
    });
    return { chunks: rows.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    consola.error(`processFile failed for ${file_id}:`, msg);
    await setStatus(sb, file.id, "failed", { error: msg });
    throw e;
  }
}
