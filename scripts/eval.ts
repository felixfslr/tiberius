import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { generateObject } from "ai";
import { z } from "zod";
import { miniModel } from "@/lib/openai";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3007";
const TEST_SET_PATH = process.env.EVAL_TEST_SET ?? "eval/test_set.json";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type TestCase = {
  id: string;
  trigger_message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  must_contain?: string[];
  must_contain_any?: string[];
  must_not_contain?: string[];
  must_not_contain_any_of?: string[];
  min_confidence?: number;
  expected_intent?: string;
  expected_tool_any?: string[];
  notes?: string;
};

const JudgeSchema = z.object({
  quality: z.number().min(0).max(5),
  rationale: z.string().max(300),
});

async function judge(input: {
  trigger: string;
  reply: string;
  notes: string;
}): Promise<{ quality: number; rationale: string }> {
  try {
    const { object } = await generateObject({
      model: miniModel(),
      schema: JudgeSchema,
      system: `You rate sales replies from 0-5 based on: (a) directness/relevance to the incoming message, (b) adherence to the notes/intent, (c) natural human tone (no LLM tells), (d) no hallucinated facts. 5 = excellent; 3 = acceptable; 0 = useless. Return only JSON.`,
      prompt: `INCOMING: ${input.trigger}\n\nREPLY: ${input.reply}\n\nGUIDANCE: ${input.notes || "(none)"}`,
    });
    return object;
  } catch {
    return { quality: 2.5, rationale: "judge failed; defaulted" };
  }
}

function hits(text: string, needles: string[]): string[] {
  const hay = text.toLowerCase();
  return needles.filter((n) => hay.includes(n.toLowerCase()));
}

async function main() {
  const raw = await readFile(TEST_SET_PATH, "utf-8");
  const cases = JSON.parse(raw) as TestCase[];

  const { data: agent } = await sb
    .from("agents")
    .select("id, name")
    .eq("name", "Ivy Sales Pre-Discovery")
    .single();
  if (!agent) throw new Error("Default agent missing");

  const rawKey = `tib_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const { data: key } = await sb
    .from("api_keys")
    .insert({
      agent_id: agent.id,
      name: "eval-runner",
      key_hash: hash,
      key_prefix: rawKey.slice(0, 8),
    })
    .select("id")
    .single();
  if (!key) throw new Error("key insert failed");

  console.log(`Evaluating ${cases.length} cases against ${agent.name}…\n`);

  const results: Array<{
    id: string;
    pass: boolean;
    violations: string[];
    quality: number;
    confidence: number;
    reply: string;
    intent: string;
    tool: string;
    latency_ms: number;
  }> = [];

  for (const tc of cases) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/v1/agents/${agent.id}/reply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_message: tc.trigger_message,
        history: tc.history ?? [],
      }),
    });
    const body = await res.json();
    const ms = Date.now() - t0;
    if (!res.ok) {
      console.log(`✗ ${tc.id} — HTTP ${res.status}: ${body?.error?.message}`);
      results.push({
        id: tc.id,
        pass: false,
        violations: ["http_error"],
        quality: 0,
        confidence: 0,
        reply: "",
        intent: "",
        tool: "",
        latency_ms: ms,
      });
      continue;
    }
    const r = body.data;
    const violations: string[] = [];

    if (tc.must_contain) {
      const missing = tc.must_contain.filter(
        (n) => !r.reply_text.toLowerCase().includes(n.toLowerCase()),
      );
      if (missing.length) violations.push(`missing: ${missing.join(", ")}`);
    }
    if (tc.must_contain_any) {
      const found = hits(r.reply_text, tc.must_contain_any);
      if (found.length === 0) violations.push(`none of: ${tc.must_contain_any.join(" | ")}`);
    }
    if (tc.must_not_contain) {
      const found = hits(r.reply_text, tc.must_not_contain);
      if (found.length) violations.push(`forbidden: ${found.join(", ")}`);
    }
    if (tc.must_not_contain_any_of) {
      const found = hits(r.reply_text, tc.must_not_contain_any_of);
      if (found.length) violations.push(`forbidden-any: ${found.join(", ")}`);
    }
    if (tc.min_confidence !== undefined && r.confidence < tc.min_confidence) {
      violations.push(`confidence ${r.confidence.toFixed(2)} < ${tc.min_confidence}`);
    }
    if (tc.expected_intent && r.detected_intent !== tc.expected_intent) {
      violations.push(`intent ${r.detected_intent} ≠ expected ${tc.expected_intent}`);
    }
    if (tc.expected_tool_any && !tc.expected_tool_any.includes(r.suggested_tool)) {
      violations.push(`tool ${r.suggested_tool} ∉ {${tc.expected_tool_any.join(",")}}`);
    }

    const j = await judge({
      trigger: tc.trigger_message,
      reply: r.reply_text,
      notes: tc.notes ?? "",
    });

    const pass = violations.length === 0;
    console.log(
      `${pass ? "✓" : "✗"} ${tc.id}  conf=${r.confidence.toFixed(2)}  judge=${j.quality.toFixed(1)}  ${ms}ms`,
    );
    console.log(`   "${r.reply_text.slice(0, 110).replace(/\n/g, " ")}…"`);
    if (!pass) console.log(`   violations: ${violations.join(" | ")}`);
    console.log(`   judge: ${j.rationale}`);

    results.push({
      id: tc.id,
      pass,
      violations,
      quality: j.quality,
      confidence: r.confidence,
      reply: r.reply_text,
      intent: r.detected_intent,
      tool: r.suggested_tool,
      latency_ms: ms,
    });
  }

  await sb.from("api_keys").delete().eq("id", key.id);

  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const avgQuality = results.reduce((a, b) => a + b.quality, 0) / total;
  const avgConf = results.reduce((a, b) => a + b.confidence, 0) / total;
  const avgMs = Math.round(results.reduce((a, b) => a + b.latency_ms, 0) / total);

  console.log(`\n========================================`);
  console.log(`Passed: ${passed}/${total}  (${Math.round((passed / total) * 100)}%)`);
  console.log(`Avg judge quality: ${avgQuality.toFixed(2)} / 5.0`);
  console.log(`Avg confidence:    ${avgConf.toFixed(2)}`);
  console.log(`Avg latency:       ${avgMs}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
