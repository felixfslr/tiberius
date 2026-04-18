import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const DEFAULT_AGENT = {
  name: "Ivy Sales Pre-Discovery",
  description:
    "Drafts replies for incoming WhatsApp/Telegram sales messages during the pre-discovery phase.",
  config: {
    confidence_threshold: 0.6,
    calendly_url: "https://calendly.com/ivy-sales/discovery",
    available_documents: [],
  },
};

async function main() {
  const { data: existing, error: listErr } = await sb
    .from("agents")
    .select("id, name")
    .eq("name", DEFAULT_AGENT.name)
    .maybeSingle();
  if (listErr) {
    console.error("Failed to query agents:", listErr);
    process.exit(1);
  }
  if (existing) {
    console.log(
      `Default agent already exists: ${existing.id} (${existing.name})`,
    );
    return;
  }
  const { data, error } = await sb
    .from("agents")
    .insert(DEFAULT_AGENT)
    .select()
    .single();
  if (error) {
    console.error("Failed to seed agent:", error);
    process.exit(1);
  }
  console.log(`Seeded agent: ${data.id} (${data.name})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
