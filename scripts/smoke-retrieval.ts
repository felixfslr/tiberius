import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { retrieve } from "@/lib/retrieval/pipeline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3007";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SAMPLE_DOCS: Array<{ filename: string; content: string; file_type: string }> = [
  {
    filename: "ivy-glossary.md",
    file_type: "glossary",
    content: `## Ivy
Crypto-native banking and payments platform for crypto exchanges. Focus: pay-ins and pay-outs via faster, cheaper rails (SEPA instant, ACH, FPS, card).

## Pay-in
Fiat transferred from an end-user into a crypto exchange. Ivy settles in seconds via direct banking rails, cheaper than card processors.

## Pay-out
Fiat transferred from an exchange back to an end-user. Ivy handles KYC and compliance automatically.

## Discovery call
30-minute intro meeting to understand the prospect's payment volume, geographies, current rails, and fit with Ivy.

## Valar Ventures
Peter Thiel's VC firm — Ivy's lead investor, backing a $30M round.`,
  },
  {
    filename: "ivy-pricing.md",
    file_type: "product_doc",
    content: `# Ivy pricing overview

We price based on volume and rails used. Our pricing is usage-based, no monthly minimums.

- Pay-ins via SEPA instant: from 0.15% + €0.20 per transaction (tiered on volume)
- Pay-outs via SEPA: from 0.25% + €0.30
- Card pay-ins: ~2.2% all-in (below most card processors because we handle the auth ourselves)
- US ACH: $0.40 flat for business
- FX: mid-market + 30-50bps, depending on corridor

Enterprise deals (>€20M/month in volume): custom pricing, typically sub-15bps blended.

We don't publish public pricing — always qualify volume + geography first before quoting.`,
  },
  {
    filename: "pre-discovery-sops.md",
    file_type: "sop",
    content: `# SOPs for pre-discovery

## When a prospect asks for pricing before a discovery call
Do not quote numbers. Respond: "Pricing depends on volume, geography, and the rails you want to use — happy to walk through this on a 30-min call. Here's my Calendly: {calendly_url}".

## When a prospect mentions a competitor
Acknowledge, don't disparage. Pivot to Ivy's differentiators: speed of settlement, direct bank rails, crypto-native team. Offer to compare side-by-side on a call.

## When a prospect is cold or sending one-liners
Keep replies short (1-2 sentences max). End every reply with an open-ended question that advances toward a call.

## When a prospect asks for a demo
Route to a discovery call first — "Happy to demo, but a 15-min call will let me tailor it to your volumes and corridors."`,
  },
  {
    filename: "tov-examples.md",
    file_type: "tov_example",
    content: `Hey — thanks for the quick reply. Pricing on Ivy depends on your volume and corridors, so quoting cold would be misleading. Do you have 20 min this week for a walk-through? Here's my calendar: calendly.com/ivy-sales/discovery

---

Totally fair. We've had a lot of teams move off BVNK for exactly that reason — our settlement is usually 2-3x faster on SEPA. Want me to put 15 min on the calendar to compare side-by-side?

---

Good question — the short answer is yes, we handle both EU and US flows, with native rails on each side. The longer answer really depends on your settlement timing needs. Got a moment for a call?`,
  },
];

async function ensureUploaded(agent_id: string) {
  // Only upload if we don't already have each file.
  for (const doc of SAMPLE_DOCS) {
    const wantedFilename = doc.filename.endsWith(".txt") ? doc.filename : `${doc.filename}.txt`;
    const { data: existing } = await sb
      .from("files")
      .select("id, status")
      .eq("agent_id", agent_id)
      .eq("filename", wantedFilename)
      .eq("file_type", doc.file_type)
      .maybeSingle();
    if (existing && existing.status === "ready") {
      console.log(`  skip: ${doc.filename} already ready (${existing.id})`);
      continue;
    }
    if (existing) {
      console.log(`  delete old: ${doc.filename} (status=${existing.status})`);
      await sb.storage
        .from("knowledge")
        .remove([`${agent_id}/${existing.id}.txt`])
        .catch(() => void 0);
      await sb.from("files").delete().eq("id", existing.id);
    }
    const res = await fetch(`${BASE}/api/v1/agents/${agent_id}/files/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Service-role-bypass via header? no. We need an API key. Create one on the fly.
      // But we're running against the dev server with no auth header here.
      body: JSON.stringify({
        filename: doc.filename,
        content: doc.content,
        file_type: doc.file_type,
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(
        `upload failed for ${doc.filename}: ${b?.error?.message ?? res.status}`,
      );
    }
    const { data } = await res.json();
    console.log(`  uploaded: ${doc.filename} (${data.id})`);
  }
}

async function waitAllReady(agent_id: string) {
  const started = Date.now();
  while (Date.now() - started < 180_000) {
    const { data } = await sb
      .from("files")
      .select("filename, status")
      .eq("agent_id", agent_id);
    const pending = (data ?? []).filter(
      (f) => f.status !== "ready" && f.status !== "failed",
    );
    if (pending.length === 0) return data ?? [];
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("timeout waiting for files to be ready");
}

async function main() {
  const { data: agent, error } = await sb
    .from("agents")
    .select("id, name")
    .eq("name", "Ivy Sales Pre-Discovery")
    .single();
  if (error || !agent) throw new Error(`Default agent missing: ${error?.message}`);

  // Temporarily accept the dev server only — we need bearer auth. Insert a key.
  const apiKeyHash = "dev-smoke";
  const { createHash, randomBytes } = await import("node:crypto");
  const raw = `tib_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 8);
  await sb.from("api_keys").delete().eq("name", apiKeyHash);
  const { data: k } = await sb
    .from("api_keys")
    .insert({ agent_id: agent.id, name: apiKeyHash, key_hash: hash, key_prefix: prefix })
    .select("id")
    .single();
  if (!k) throw new Error("api key insert failed");

  // Inject Authorization only for calls to our dev server; other fetches
  // (e.g. OpenAI from the retrieval pipeline) must pass through untouched.
  const origFetch = globalThis.fetch;
  globalThis.fetch = ((url, init) => {
    const targetUrl = typeof url === "string" ? url : url instanceof URL ? url.href : (url as Request).url;
    if (targetUrl.startsWith(BASE)) {
      const h = new Headers((init?.headers ?? {}) as HeadersInit);
      h.set("Authorization", `Bearer ${raw}`);
      return origFetch(url, { ...init, headers: h });
    }
    return origFetch(url, init);
  }) as typeof fetch;

  console.log(`Agent: ${agent.id} (${agent.name})`);
  console.log("Uploading sample docs…");
  await ensureUploaded(agent.id);

  console.log("\nWaiting for processing to complete…");
  const files = await waitAllReady(agent.id);
  for (const f of files) {
    console.log(`  ${f.filename}: ${f.status}`);
  }

  const triggers = [
    "Hey, what does Ivy cost for USDC pay-ins? We move around $50M/month in EU.",
    "We already use BVNK, why switch?",
    "Can we schedule a quick call next week?",
  ];

  for (const trigger of triggers) {
    console.log(`\n============================================================`);
    console.log(`TRIGGER: "${trigger}"`);
    console.log(`============================================================`);
    const result = await retrieve({
      agent_id: agent.id,
      trigger_message: trigger,
      history: [],
    });
    console.log(
      `state: stage=${result.state.stage} intents=[${result.state.intents.join(",")}] conf=${result.state.intent_confidence.toFixed(2)}`,
    );
    console.log(`entities: ${result.entities.join(", ") || "(none)"}`);
    console.log(
      `debug: hybrid=${result.debug.hybrid_count} meta=${result.debug.metadata_count} entity=${result.debug.entity_count} rerank=${result.debug.rerank_output}/${result.debug.rerank_input} total=${result.debug.latency_ms.total}ms`,
    );
    console.log(`slots: kb=${result.kb_facts.length} sops=${result.sops.length} tov=${result.tov_examples.length} convo=${result.similar_past_convos.length} entity=${result.entity_triggered.length}`);
    for (const c of result.all_ranked.slice(0, 5)) {
      console.log(
        `  • [${c.content_type}] score=${c.score.toFixed(3)}  "${c.content.slice(0, 90).replace(/\n/g, " ")}…"`,
      );
    }
  }

  // Cleanup the throwaway key.
  await sb.from("api_keys").delete().eq("id", k.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
