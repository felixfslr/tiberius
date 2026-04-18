import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { generateObject } from "ai";
import { z } from "zod";
import { miniModel } from "@/lib/openai";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3007";
const TRAIN_DIR = "data/conversations/training";
const SOPS_DIR = "data/sops";
const MANIFEST = "data/sops/manifest.json";

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
};

const SopSchema = z.object({
  sops: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^[a-z0-9_-]+$/)
          .describe("snake-case slug, e.g. 'disqualify_on_license_mismatch'"),
        title: z.string().max(120),
        trigger_signals: z
          .array(z.string())
          .describe("short phrases describing when this rule applies"),
        rule: z
          .string()
          .describe(
            "imperative guidance for the salesperson, e.g. 'Do not push for a call — politely close the conversation and offer to reconnect if the constraint changes.'",
          ),
        rationale: z.string().max(300),
        example_sources: z
          .array(z.string())
          .describe("convo ids that demonstrate this pattern"),
      }),
    )
    .min(4)
    .max(10),
});

function compact(convo: Convo): string {
  // Compact view: outcome, stages, last 6 messages (mostly the endgame).
  const last = convo.messages.slice(-6).map((m) => {
    const head = `[${m.role}${m.sender ? `/${m.sender}` : ""}]`;
    const body = m.content.slice(0, 600).replace(/\n+/g, " ");
    return `${head} ${body}`;
  });
  return `${convo.id} (outcome=${convo.outcome}, stages=${convo.stages_covered.join(",")})\n${last.join("\n")}`;
}

function renderSop(sop: z.infer<typeof SopSchema>["sops"][number]): string {
  const lines = [
    `# SOP: ${sop.title}`,
    ``,
    `**When this applies:**`,
    ...sop.trigger_signals.map((s) => `- ${s}`),
    ``,
    `**Rule:** ${sop.rule}`,
    ``,
    `**Why:** ${sop.rationale}`,
    ``,
    `**Examples seen in training data:** ${sop.example_sources.join(", ")}`,
    ``,
  ];
  return lines.join("\n");
}

async function loadAllTraining(): Promise<Convo[]> {
  const files = (await readdir(TRAIN_DIR)).filter((f) => /^convo_\d{2}\.json$/.test(f)).sort();
  const out: Convo[] = [];
  for (const f of files) out.push(JSON.parse(await readFile(`${TRAIN_DIR}/${f}`, "utf-8")));
  return out;
}

async function extractSops(convos: Convo[]): Promise<z.infer<typeof SopSchema>["sops"]> {
  const corpus = convos.map(compact).join("\n\n---\n\n");
  const { object } = await generateObject({
    model: miniModel(),
    schema: SopSchema,
    system: `You extract implicit "how we actually handle X" rules from sales-conversation data.

Input: compact views of real pre-discovery sales conversations, with outcomes (call_booked / fit_mismatch / no_response / ongoing / other).

Your job: distill 4-10 rules that describe the salesperson's ACTUAL behavior across these conversations — especially the non-obvious patterns.

Good SOPs are:
- Actionable: tell the salesperson what to DO or NOT DO in a specific situation.
- Grounded: each rule should be demonstrated by at least 2 conversations.
- Non-generic: "be polite" is bad; "when lead lacks the required financial license, politely close the opportunity and offer to reconnect if the constraint changes — don't pivot to a discovery call" is good.
- Cover disqualification / fit-mismatch behavior, because the dataset is full of it.

Each SOP has:
- id (snake_case slug)
- title (short)
- trigger_signals (2-4 short phrases describing when this applies)
- rule (imperative guidance)
- rationale (1-2 sentences, 'why this behavior')
- example_sources (convo ids that demonstrate it)

Do NOT invent patterns that aren't in the data. If you can't find 4 strong patterns, return 4.`,
    prompt: `Training conversations:\n\n${corpus}`,
  });
  return object.sops;
}

async function main() {
  const args = process.argv.slice(2);
  const purge = args.includes("--purge");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: agent } = await sb
    .from("agents")
    .select("id, name")
    .eq("name", "Ivy Sales Pre-Discovery")
    .single();
  if (!agent) throw new Error("Default agent missing");

  if (purge) {
    // Load manifest, delete each file_id via API
    const manifest = JSON.parse(await readFile(MANIFEST, "utf-8")) as { file_id: string }[];
    const rawKey = `tib_${randomBytes(24).toString("base64url")}`;
    const hash = createHash("sha256").update(rawKey).digest("hex");
    const { data: key } = await sb
      .from("api_keys")
      .insert({
        agent_id: agent.id,
        name: "sop-purge",
        key_hash: hash,
        key_prefix: rawKey.slice(0, 8),
      })
      .select("id")
      .single();
    if (!key) throw new Error("key insert failed");
    for (const m of manifest) {
      const res = await fetch(`${BASE}/api/v1/agents/${agent.id}/files/${m.file_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${rawKey}` },
      });
      console.log(`  DELETE ${m.file_id}: HTTP ${res.status}`);
    }
    await sb.from("api_keys").delete().eq("id", key.id);
    await writeFile(MANIFEST, "[]\n");
    console.log("Purged SOP files.");
    return;
  }

  console.log("Loading training conversations…");
  const convos = await loadAllTraining();
  console.log(`  ${convos.length} convos`);

  console.log("\nExtracting SOPs via gpt-5.4-mini…");
  const sops = await extractSops(convos);
  console.log(`  Got ${sops.length} SOPs:`);
  for (const s of sops) console.log(`   - ${s.id}: ${s.title}`);

  await mkdir(SOPS_DIR, { recursive: true });
  for (const sop of sops) {
    await writeFile(`${SOPS_DIR}/${sop.id}.md`, renderSop(sop));
  }
  console.log(`\nWrote ${sops.length} files to ${SOPS_DIR}/`);

  // Ingest
  const rawKey = `tib_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const { data: key } = await sb
    .from("api_keys")
    .insert({
      agent_id: agent.id,
      name: "sop-ingest",
      key_hash: hash,
      key_prefix: rawKey.slice(0, 8),
    })
    .select("id")
    .single();
  if (!key) throw new Error("key insert failed");
  console.log(`\nIngesting via API key ${rawKey.slice(0, 8)}…`);

  const manifest: { id: string; file_id: string; filename: string }[] = [];
  for (const sop of sops) {
    const filename = `ivy_sop_${sop.id}.md`;
    const content = renderSop(sop);
    const res = await fetch(`${BASE}/api/v1/agents/${agent.id}/files/text`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rawKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename, content, file_type: "sop" }),
    });
    const body = await res.json();
    if (!res.ok) {
      console.log(`  ✗ ${sop.id} HTTP ${res.status}: ${body?.error?.message}`);
      continue;
    }
    const fileId = body.data.id as string;
    // Wait for ready
    let status = "pending";
    let stuck = Date.now();
    const started = Date.now();
    while (Date.now() - started < 90_000) {
      await new Promise((r) => setTimeout(r, 1500));
      const { data } = await sb
        .from("files")
        .select("status")
        .eq("id", fileId)
        .single<{ status: string }>();
      const next = data?.status ?? "unknown";
      if (next !== status) {
        status = next;
        stuck = Date.now();
      }
      if (status === "ready" || status === "failed") break;
      if (status === "pending" && Date.now() - stuck > 30_000) {
        throw new Error(`SOP ${sop.id} stuck pending — worker down?`);
      }
    }
    const { count } = await sb
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("file_id", fileId);
    console.log(`  ✓ ${sop.id} → ${fileId.slice(0, 8)} (${status}, ${count ?? 0} chunks)`);
    manifest.push({ id: sop.id, file_id: fileId, filename });
  }

  await sb.from("api_keys").delete().eq("id", key.id);
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nManifest written: ${MANIFEST}`);
  console.log(`Revert with: npx tsx scripts/extract-sops.ts --purge`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
