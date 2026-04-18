import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3007";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SAMPLE_GLOSSARY = `## Ivy
Crypto-native banking and payments platform that helps crypto companies with pay-ins and payouts via faster, cheaper rails.

## Pay-in
A transfer of fiat from an end-user to a crypto exchange, typically via bank transfer or card. Ivy makes this instant and low-cost.

## Pay-out
A transfer of fiat from an exchange back to an end-user. Ivy handles KYC+compliance automatically.

## Discovery call
A ~30 minute intro meeting to understand the prospect's payment needs and explore whether Ivy is a fit.

## Valar Ventures
Peter Thiel's VC firm — one of Ivy's lead investors, $30M raised.`;

async function main() {
  const { data: agent, error } = await sb
    .from("agents")
    .select("id, name")
    .eq("name", "Ivy Sales Pre-Discovery")
    .single();
  if (error || !agent) throw new Error(`Default agent missing: ${error?.message}`);

  const raw = `tib_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 8);
  const { data: key, error: keyErr } = await sb
    .from("api_keys")
    .insert({ agent_id: agent.id, name: "smoke-ingest", key_hash: hash, key_prefix: prefix })
    .select("id")
    .single();
  if (keyErr) throw new Error(`Key insert failed: ${keyErr.message}`);

  const up = await fetch(`${BASE}/api/v1/agents/${agent.id}/files/text`, {
    method: "POST",
    headers: { Authorization: `Bearer ${raw}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "ivy-glossary.md",
      content: SAMPLE_GLOSSARY,
      file_type: "glossary",
    }),
  });
  const upBody = await up.json();
  console.log(`upload → HTTP ${up.status}`);
  console.log(JSON.stringify(upBody, null, 2));
  if (!up.ok) {
    await sb.from("api_keys").delete().eq("id", key.id);
    process.exit(1);
  }
  const fileId = upBody.data.id as string;

  // Poll until ready or timeout.
  const started = Date.now();
  let status = upBody.data.status as string;
  while (status !== "ready" && status !== "failed" && Date.now() - started < 120_000) {
    await new Promise((r) => setTimeout(r, 2000));
    const { data: f } = await sb.from("files").select("status").eq("id", fileId).single();
    if (f && f.status !== status) {
      console.log(`  status: ${f.status}`);
      status = f.status;
    }
  }

  const { data: chunks } = await sb
    .from("chunks")
    .select("id, position, content, metadata")
    .eq("file_id", fileId)
    .order("position");
  console.log(`\nFinal status: ${status} — ${chunks?.length ?? 0} chunks`);
  if (chunks) {
    for (const c of chunks.slice(0, 3)) {
      const meta = (c.metadata ?? {}) as { summary?: string; stage?: string[]; intent?: string[] };
      console.log(
        `  #${c.position} [${(meta.stage ?? []).join(",") || "-"} / ${(meta.intent ?? []).join(",") || "-"}] ${(meta.summary ?? "").slice(0, 80)}`,
      );
      console.log(`     "${c.content.slice(0, 100).replace(/\n/g, " ")}…"`);
    }
  }

  // Cleanup — delete file + key (chunks cascade).
  await fetch(`${BASE}/api/v1/agents/${agent.id}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${raw}` },
  });
  await sb.from("api_keys").delete().eq("id", key.id);
  console.log("Cleanup done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
