import { extractText } from "unpdf";
import mammoth from "mammoth";
import { createServiceClient } from "@/lib/supabase/service";

export type ExtractedText = { text: string; pageCount?: number };

/**
 * Postgres rejects `\u0000` in text columns ("unsupported Unicode escape
 * sequence") and most other C0 control chars are noise anyway. Strip them
 * before anything downstream sees the text.
 */
function sanitize(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\uFFFD/g, ""); // replacement char from broken decodes
}

/** Extracts plain text from a Storage object. Dispatches on mime type. */
export async function extractFromStorage(
  storage_path: string,
  mime_type: string | null,
): Promise<ExtractedText> {
  const sb = createServiceClient();
  const { data, error } = await sb.storage.from("knowledge").download(storage_path);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? "unknown"}`);
  const buf = Buffer.from(await data.arrayBuffer());

  const mt = (mime_type ?? "").toLowerCase();
  if (mt === "application/pdf" || storage_path.toLowerCase().endsWith(".pdf")) {
    const { text, totalPages } = await extractText(new Uint8Array(buf), { mergePages: true });
    const merged = Array.isArray(text) ? text.join("\n\n") : text;
    return { text: sanitize(merged), pageCount: totalPages };
  }

  if (
    mt ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    storage_path.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return { text: sanitize(result.value) };
  }

  // Plain text / markdown / json — try utf-8 decode.
  return { text: sanitize(buf.toString("utf-8")) };
}
