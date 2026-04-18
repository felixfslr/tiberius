import { createServiceClient } from "@/lib/supabase/service";

/**
 * Marks a file as `pending` in the queue. The worker polls for pending files
 * via the `claim_pending_file()` Postgres function, which atomically flips
 * status to `extracting` using FOR UPDATE SKIP LOCKED.
 *
 * This replaces pg-boss to keep the Vercel side passwordless — the upload
 * route only uses PostgREST (service-role key), never a direct Postgres
 * connection.
 */
export async function enqueueProcessFile(file_id: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("files")
    .update({ status: "pending", error: null })
    .eq("id", file_id);
  if (error) throw new Error(`Enqueue failed: ${error.message}`);
}
