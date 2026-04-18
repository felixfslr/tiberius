// Env vars come from Node's native `--env-file=...` flag — see package.json
// scripts and ecosystem.config.js. No dotenv dependency in the bundle.

// Polyfill Promise.try (added in Node 22; unpdf/pdfjs calls it internally).
// The Hetzner box runs Node 20. Without this, extract() throws a
// synchronous TypeError that slips past the async handler and hangs the job.
if (typeof (Promise as unknown as { try?: unknown }).try !== "function") {
  (
    Promise as unknown as {
      try: (
        fn: (...a: unknown[]) => unknown,
        ...a: unknown[]
      ) => Promise<unknown>;
    }
  ).try = function (fn, ...args) {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

import { consola } from "consola";
import { createClient } from "@supabase/supabase-js";

// Absolute imports resolve through tsup's tsconfig paths.
import { processFile } from "@/lib/processing/pipeline";
import { runAnalyzeFeedback, runApplyFeedback } from "@/lib/services/feedback";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  consola.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
  process.exit(1);
}

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2000);
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

let running = 0;
let stopped = false;

type Job =
  | { kind: "file"; id: string; file_type: string }
  | { kind: "feedback_analyze"; id: string }
  | { kind: "feedback_apply"; id: string };

async function claimNextJob(): Promise<Job | null> {
  // Priority order: user-visible actions first.
  // 1. applying feedback (user clicked Apply, waiting on worker)
  // 2. pending feedback (LLM analysis, background)
  // 3. pending file (upload processing, background)
  const apply = await sb.rpc("claim_applying_feedback");
  if (apply.error) {
    consola.error("claim_applying_feedback error:", apply.error.message);
  } else {
    const row = (Array.isArray(apply.data) ? apply.data[0] : apply.data) as
      | { fb_id: string }
      | null
      | undefined;
    if (row) return { kind: "feedback_apply", id: row.fb_id };
  }

  const pending = await sb.rpc("claim_pending_feedback");
  if (pending.error) {
    consola.error("claim_pending_feedback error:", pending.error.message);
  } else {
    const row = (
      Array.isArray(pending.data) ? pending.data[0] : pending.data
    ) as { fb_id: string } | null | undefined;
    if (row) return { kind: "feedback_analyze", id: row.fb_id };
  }

  const file = await sb.rpc("claim_pending_file");
  if (file.error) {
    consola.error("claim_pending_file error:", file.error.message);
    return null;
  }
  const row = (Array.isArray(file.data) ? file.data[0] : file.data) as
    | { file_id: string; file_file_type: string }
    | null
    | undefined;
  if (!row) return null;
  return { kind: "file", id: row.file_id, file_type: row.file_file_type };
}

async function runJob(job: Job): Promise<void> {
  const t0 = Date.now();
  try {
    switch (job.kind) {
      case "file":
        consola.info(`claimed file ${job.id} (${job.file_type})`);
        const r = await processFile(job.id);
        consola.success(
          `file ${job.id} → ${r.chunks} chunks in ${Date.now() - t0}ms`,
        );
        return;
      case "feedback_analyze":
        consola.info(`analyzing feedback ${job.id}`);
        await runAnalyzeFeedback(job.id);
        consola.success(`feedback ${job.id} analyzed in ${Date.now() - t0}ms`);
        return;
      case "feedback_apply":
        consola.info(`applying feedback ${job.id}`);
        await runApplyFeedback(job.id);
        consola.success(`feedback ${job.id} applied in ${Date.now() - t0}ms`);
        return;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    consola.error(`${job.kind} ${job.id} failed:`, msg);
  }
}

async function tick() {
  if (stopped) return;
  while (running < CONCURRENCY) {
    const job = await claimNextJob();
    if (!job) break;
    running += 1;
    runJob(job).finally(() => {
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
