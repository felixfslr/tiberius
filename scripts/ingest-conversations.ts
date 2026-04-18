import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readdir, readFile } from "node:fs/promises";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3007";
const TRAIN_DIR = "data/conversations/training";

type Message = {
  role: "lead" | "sales";
  sender: string | null;
  content: string;
  ts: string | null;
};
type Convo = {
  id: string;
  messages: Message[];
  outcome: string;
  stages_covered: string[];
  notes?: string | null;
};

/**
 * Serialize a conversation to a chat_history-formatted markdown blob.
 * `---` separators match `chatHistoryChunk` → each message becomes one retrieval chunk.
 */
function serialize(convo: Convo): string {
  const meta = `[META] ${convo.id} — outcome=${convo.outcome}, stages=${convo.stages_covered.join(",")}`;
  const parts: string[] = [meta];
  for (const m of convo.messages) {
    const header = `[${m.role.toUpperCase()}${m.sender ? " — " + m.sender : ""}${m.ts ? ", " + m.ts : ""}]`;
    parts.push(`${header}\n${m.content.trim()}`);
  }
  return parts.join("\n\n---\n\n") + "\n";
}

async function waitForReady(
  sb: SupabaseClient,
  fileId: string,
  timeoutMs = 120_000,
): Promise<string> {
  const started = Date.now();
  let status = "pending";
  let stuck_since = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    const { data } = await sb
      .from("files")
      .select("status")
      .eq("id", fileId)
      .single<{ status: string }>();
    const next = (data?.status ?? "unknown") as string;
    if (next !== status) {
      status = next;
      stuck_since = Date.now();
    }
    if (status === "ready" || status === "failed") return status;
    // Worker-liveness guard: if we've been stuck in 'pending' for 30s, likely no worker running.
    if (status === "pending" && Date.now() - stuck_since > 30_000) {
      throw new Error(
        `File ${fileId} stuck in 'pending' for 30s — is the worker running? (npm run worker:dev)`,
      );
    }
  }
  throw new Error(`Timeout waiting for file ${fileId} to reach 'ready' (last status: ${status})`);
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: agent, error } = await sb
    .from("agents")
    .select("id, name")
    .eq("name", "Ivy Sales Pre-Discovery")
    .single();
  if (error || !agent) throw new Error(`Default agent missing: ${error?.message}`);
  console.log(`Target agent: ${agent.name} (${agent.id})`);

  // Health check: the /files/text endpoint should respond with 401 for an empty Authorization.
  try {
    const hc = await fetch(`${BASE}/api/v1/agents/${agent.id}/files/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (hc.status === 0 || hc.status >= 500) {
      throw new Error(`Dev server at ${BASE} not responding (HTTP ${hc.status})`);
    }
  } catch (e) {
    throw new Error(`Cannot reach dev server at ${BASE}. Start it first: npm run dev. (${(e as Error).message})`);
  }

  // Generate a temp API key scoped to the agent.
  const rawKey = `tib_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const { data: key, error: keyErr } = await sb
    .from("api_keys")
    .insert({
      agent_id: agent.id,
      name: "ingest-conversations",
      key_hash: hash,
      key_prefix: rawKey.slice(0, 8),
    })
    .select("id")
    .single();
  if (keyErr || !key) throw new Error(`API key insert failed: ${keyErr?.message}`);
  console.log(`Created temp API key (prefix ${rawKey.slice(0, 8)})`);

  const files = (await readdir(TRAIN_DIR)).filter((f) => /^convo_\d{2}\.json$/.test(f)).sort();
  console.log(`\nIngesting ${files.length} conversations from ${TRAIN_DIR}/ …\n`);

  const results: Array<{ id: string; file_id?: string; status: string; chunks?: number; error?: string }> = [];

  for (const f of files) {
    const convo = JSON.parse(await readFile(`${TRAIN_DIR}/${f}`, "utf-8")) as Convo;
    const content = serialize(convo);
    const filename = `ivy_pre_discovery_${convo.id}.md`;
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE}/api/v1/agents/${agent.id}/files/text`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${rawKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename, content, file_type: "chat_history" }),
      });
      const body = await res.json();
      if (!res.ok) {
        console.log(`  ✗ ${convo.id} HTTP ${res.status}: ${body?.error?.message ?? "unknown"}`);
        results.push({ id: convo.id, status: "upload_failed", error: body?.error?.message });
        continue;
      }
      const fileId = body.data.id as string;
      const status = await waitForReady(sb, fileId);
      const { count } = await sb
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("file_id", fileId);
      const ms = Date.now() - t0;
      console.log(
        `  ${status === "ready" ? "✓" : "✗"} ${convo.id} → file ${fileId.slice(0, 8)} (${status}, ${count ?? 0} chunks, ${ms}ms)`,
      );
      results.push({ id: convo.id, file_id: fileId, status, chunks: count ?? 0 });
    } catch (e) {
      console.log(`  ✗ ${convo.id} ERROR: ${(e as Error).message}`);
      results.push({ id: convo.id, status: "error", error: (e as Error).message });
    }
  }

  // Cleanup temp API key (files stay).
  await sb.from("api_keys").delete().eq("id", key.id);
  console.log(`\nCleaned up API key.`);

  const ok = results.filter((r) => r.status === "ready").length;
  const totalChunks = results.reduce((a, b) => a + (b.chunks ?? 0), 0);
  console.log(`\n===============================`);
  console.log(`Ingested: ${ok}/${results.length} ready`);
  console.log(`Total chunks: ${totalChunks}`);
  if (ok < results.length) {
    console.log(`Failures:`);
    for (const r of results.filter((r) => r.status !== "ready")) {
      console.log(`  ${r.id}: ${r.status} ${r.error ?? ""}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
