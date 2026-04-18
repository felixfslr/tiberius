// Env vars come from Node's native `--env-file=...` flag — see package.json
// scripts and ecosystem.config.js. No dotenv dependency in the bundle.

import { consola } from "consola";
import { createClient } from "@supabase/supabase-js";

// Absolute imports resolve through tsup's tsconfig paths.
import { processFile } from "@/lib/processing/pipeline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  consola.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2000);
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

let running = 0;
let stopped = false;

type Claimed = { id: string; file_type: string };

async function claimOne(): Promise<Claimed | null> {
  const { data, error } = await sb.rpc("claim_pending_file");
  if (error) {
    consola.error("claim_pending_file error:", error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { file_id: string; file_file_type: string }
    | null
    | undefined;
  if (!row) return null;
  return { id: row.file_id, file_type: row.file_file_type };
}

async function tick() {
  if (stopped) return;
  while (running < CONCURRENCY) {
    const claimed = await claimOne();
    if (!claimed) break;
    running += 1;
    const t0 = Date.now();
    consola.info(`claimed file ${claimed.id} (${claimed.file_type})`);
    processFile(claimed.id)
      .then((r) => {
        const ms = Date.now() - t0;
        consola.success(`file ${claimed.id} → ${r.chunks} chunks in ${ms}ms`);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        consola.error(`file ${claimed.id} failed:`, msg);
      })
      .finally(() => {
        running -= 1;
      });
  }
}

async function main() {
  consola.success(
    `Worker online. Polling every ${POLL_MS}ms, concurrency=${CONCURRENCY}.`,
  );

  const stop = async (sig: string) => {
    consola.info(`${sig} received, draining ${running} in-flight jobs…`);
    stopped = true;
    while (running > 0) await new Promise((r) => setTimeout(r, 200));
    process.exit(0);
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  // poll loop
  while (!stopped) {
    try {
      await tick();
    } catch (e) {
      consola.error("tick error:", e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => {
  consola.error(e);
  process.exit(1);
});
