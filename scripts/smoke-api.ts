import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3007";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

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
    .insert({ agent_id: agent.id, name: "smoke-test", key_hash: hash, key_prefix: prefix })
    .select("id")
    .single();
  if (keyErr) throw new Error(`Failed to insert key: ${keyErr.message}`);

  console.log(`Agent: ${agent.id} (${agent.name})`);
  console.log(`Created smoke-test key: ${raw} (id=${key.id})`);

  const res = await fetch(`${BASE}/api/v1/agents`, {
    headers: { Authorization: `Bearer ${raw}` },
  });
  const body = await res.json();
  console.log(`GET /api/v1/agents → HTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2));

  await sb.from("api_keys").delete().eq("id", key.id);
  console.log("Cleanup: smoke-test key deleted.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
