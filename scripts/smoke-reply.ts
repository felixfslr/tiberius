import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3007";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TRIGGERS = [
  {
    label: "PRICING",
    trigger: "Hey, what does Ivy cost for USDC pay-ins? We move around $50M/month in EU.",
    history: [
      { role: "assistant" as const, content: "Hi — Felix from Ivy. Saw you run sizeable USDC volume. Curious if faster fiat rails would help." },
    ],
  },
  {
    label: "COMPETITOR",
    trigger: "We already use BVNK — why would I switch?",
    history: [],
  },
  {
    label: "SCHEDULE",
    trigger: "Sure, let's find time — do you have anything next week?",
    history: [
      { role: "assistant" as const, content: "Happy to walk you through — want to grab 20 min?" },
    ],
  },
];

async function main() {
  const { data: agent } = await sb
    .from("agents")
    .select("id")
    .eq("name", "Ivy Sales Pre-Discovery")
    .single();
  if (!agent) throw new Error("Default agent missing");

  const raw = `tib_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 8);
  const { data: key } = await sb
    .from("api_keys")
    .insert({ agent_id: agent.id, name: "smoke-reply", key_hash: hash, key_prefix: prefix })
    .select("id")
    .single();
  if (!key) throw new Error("key insert failed");

  for (const t of TRIGGERS) {
    console.log(`\n======== ${t.label} ========`);
    console.log(`Trigger: "${t.trigger}"`);
    const started = Date.now();
    const res = await fetch(`${BASE}/api/v1/agents/${agent.id}/reply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${raw}`, "Content-Type": "application/json" },
      body: JSON.stringify({ trigger_message: t.trigger, history: t.history }),
    });
    const body = await res.json();
    if (!res.ok) {
      console.error("FAILED:", body?.error);
      continue;
    }
    const r = body.data;
    const ms = Date.now() - started;
    console.log(`\n→ Reply (${ms}ms):`);
    console.log(`  "${r.reply_text}"`);
    console.log(`  confidence ${r.confidence.toFixed(2)} · stage=${r.detected_stage} intent=${r.detected_intent}`);
    console.log(`  breakdown: retr=${r.confidence_breakdown.retrieval.toFixed(2)} int=${r.confidence_breakdown.intent.toFixed(2)} grnd=${r.confidence_breakdown.groundedness.toFixed(2)} cons=${r.confidence_breakdown.consistency.toFixed(2)}`);
    console.log(`  suggested_tool: ${r.suggested_tool}${r.below_threshold ? " (below threshold)" : ""}`);
    if (r.tool_args && Object.keys(r.tool_args).length) {
      console.log(`  tool_args: ${JSON.stringify(r.tool_args)}`);
    }
    console.log(`  chunks used: ${r.retrieved_chunk_ids.length}`);
    console.log(`  reasoning: ${r.reasoning}`);
  }

  await sb.from("api_keys").delete().eq("id", key.id);
  console.log("\nCleanup done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
