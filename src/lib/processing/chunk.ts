import { get_encoding } from "tiktoken";
import type { FileType } from "@/lib/schemas/file";

export type RawChunk = { content: string; position: number };

const CHUNK_TOKENS = 500;
const CHUNK_OVERLAP = 50;

function encoder() {
  return get_encoding("cl100k_base");
}

/** Simple token-based chunking for prose (product_doc, transcript fallback). */
function tokenChunk(text: string): RawChunk[] {
  const enc = encoder();
  const tokens = enc.encode(text);
  const out: RawChunk[] = [];
  let i = 0;
  let pos = 0;
  while (i < tokens.length) {
    const slice = tokens.slice(i, i + CHUNK_TOKENS);
    const decoded = new TextDecoder().decode(enc.decode(slice));
    out.push({ content: decoded.trim(), position: pos++ });
    if (i + CHUNK_TOKENS >= tokens.length) break;
    i += CHUNK_TOKENS - CHUNK_OVERLAP;
  }
  enc.free();
  return out.filter((c) => c.content.length > 20);
}

/** One chunk per glossary entry. Supports `Term: definition`, markdown `## Term`, or `Term\n---\n`. */
function glossaryChunk(text: string): RawChunk[] {
  const normalised = text.replace(/\r\n/g, "\n").trim();
  const out: RawChunk[] = [];

  // Try markdown-header format first.
  const mdSplit = normalised.split(/^##+\s+/m);
  if (mdSplit.length > 2) {
    let pos = 0;
    for (const section of mdSplit) {
      const trimmed = section.trim();
      if (trimmed.length < 10) continue;
      out.push({ content: trimmed, position: pos++ });
    }
    return out;
  }

  // "Term: definition" per line.
  const lines = normalised.split(/\n+/);
  const entries: string[] = [];
  let current: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[\w\s\-&]+:\s/.test(line) && line.length < 300) {
      if (current) entries.push(current);
      current = line;
    } else if (current) {
      current += "\n" + line;
    } else {
      current = line;
    }
  }
  if (current) entries.push(current);
  if (entries.length > 1) {
    return entries.map((c, i) => ({ content: c.trim(), position: i }));
  }

  // Fallback: token chunks.
  return tokenChunk(text);
}

/** Chat history: split on "---" separators, date lines (`[2024-...]`), or double-blank lines between convos. */
function chatHistoryChunk(text: string): RawChunk[] {
  const normalised = text.replace(/\r\n/g, "\n").trim();
  let blocks: string[] = [];

  if (/^---+$/m.test(normalised)) {
    blocks = normalised.split(/^---+$/m).map((b) => b.trim()).filter(Boolean);
  } else {
    blocks = normalised.split(/\n\n\n+/g).map((b) => b.trim()).filter(Boolean);
  }

  // If we got one giant block, fall back to chunking by ~2k tokens instead of 500
  // since chat-history chunks benefit from more context.
  if (blocks.length <= 1) return largeTokenChunks(text);

  return blocks
    .filter((b) => b.length > 30)
    .map((c, i) => ({ content: c, position: i }));
}

function largeTokenChunks(text: string): RawChunk[] {
  const enc = encoder();
  const tokens = enc.encode(text);
  const target = 1500;
  const overlap = 200;
  const out: RawChunk[] = [];
  let i = 0;
  let pos = 0;
  while (i < tokens.length) {
    const slice = tokens.slice(i, i + target);
    const decoded = new TextDecoder().decode(enc.decode(slice));
    out.push({ content: decoded.trim(), position: pos++ });
    if (i + target >= tokens.length) break;
    i += target - overlap;
  }
  enc.free();
  return out;
}

/** ToV examples: split on blank lines between blocks; each block is one example. */
function tovChunk(text: string): RawChunk[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/g)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);
  if (blocks.length <= 1) return tokenChunk(text);
  return blocks.map((c, i) => ({ content: c, position: i }));
}

export function chunkText(text: string, file_type: FileType): RawChunk[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  switch (file_type) {
    case "glossary":
      return glossaryChunk(trimmed);
    case "chat_history":
    case "convo_snippet":
      return chatHistoryChunk(trimmed);
    case "tov_example":
      return tovChunk(trimmed);
    case "transcript":
      return largeTokenChunks(trimmed);
    case "sop":
    case "product_doc":
    default:
      return tokenChunk(trimmed);
  }
}
