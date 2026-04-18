import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { retrieve } from "@/lib/retrieval/pipeline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const PROBE_TRIGGER =
  process.argv.slice(2).join(" ") ||
  "Hey — what's your pricing for USDC pay-outs? We move around $50m/month.";

async function main() {
  const { data: agent, error } = await sb
    .from("agents")
    .select("id, name")
    .eq("name", "Ivy Sales Pre-Discovery")
    .single();
  if (error || !agent) throw new Error(`Default agent missing: ${error?.message}`);

  console.log(`Agent: ${agent.id} (${agent.name})`);
  console.log(`Trigger: "${PROBE_TRIGGER}"\n`);

  const result = await retrieve({
    agent_id: agent.id,
    trigger_message: PROBE_TRIGGER,
    history: [
      { role: "assistant", content: "Hi — curious if Ivy might be useful for your ops." },
      { role: "user", content: "Tell me more." },
    ],
  });

  console.log("State:", JSON.stringify(result.state, null, 2));
  console.log("\nEntities:", result.entities.join(", ") || "(none)");
  console.log("\nDebug:", JSON.stringify(result.debug, null, 2));
  console.log(`\nTop ${result.all_ranked.length} after rerank:`);
  result.all_ranked.forEach((c, i) => {
    console.log(
      `  ${i + 1}. [${c.content_type}] score=${c.score.toFixed(3)} src=${c.source}`,
    );
    console.log(`     "${c.content.slice(0, 120).replace(/\n/g, " ")}…"`);
  });

  console.log("\nBy slot:");
  console.log(`  kb_facts:            ${result.kb_facts.length}`);
  console.log(`  sops:                ${result.sops.length}`);
  console.log(`  tov_examples:        ${result.tov_examples.length}`);
  console.log(`  similar_past_convos: ${result.similar_past_convos.length}`);
  console.log(`  entity_triggered:    ${result.entity_triggered.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
