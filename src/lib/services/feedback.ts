import { consola } from "consola";
import { createServiceClient } from "@/lib/supabase/service";
import { embedBatch } from "@/lib/processing/embed";
import { updateChunk } from "@/lib/services/chunks";
import { analyzeFeedback as llmAnalyzeFeedback } from "@/lib/generation/feedback-analysis";
import {
  FeedbackSubmitSchema,
  type FeedbackAnalysis,
  type FeedbackStatus,
  type FeedbackSubmit,
} from "@/lib/schemas/feedback";

export type FeedbackRow = {
  id: string;
  agent_id: string;
  reply_log_id: string | null;
  feedback_text: string;
  retrieved_chunk_ids: string[];
  draft_reply: string | null;
  trigger_message: string | null;
  status: FeedbackStatus;
  suggested_action: FeedbackAnalysis | null;
  error: string | null;
  applied_chunk_id: string | null;
  created_at: string;
  analyzed_at: string | null;
  processed_at: string | null;
};

const COLS =
  "id, agent_id, reply_log_id, feedback_text, retrieved_chunk_ids, draft_reply, trigger_message, status, suggested_action, error, applied_chunk_id, created_at, analyzed_at, processed_at";

// ---------------------------------------------------------------------------
// Write-path: user submits feedback, worker analyzes, user applies, worker
// executes. State machine is enforced at the DB layer via the status check
// constraint; this service only flips states in a defined order.
// ---------------------------------------------------------------------------

/** Create a new pending feedback. Pulls context out of the reply_log. */
export async function submitFeedback(
  input: FeedbackSubmit,
): Promise<{ id: string; agent_id: string }> {
  const parsed = FeedbackSubmitSchema.parse(input);
  const sb = createServiceClient();

  const { data: log, error: logErr } = await sb
    .from("reply_logs")
    .select("id, agent_id, trigger_message, retrieved_chunk_ids, draft")
    .eq("id", parsed.reply_log_id)
    .maybeSingle();
  if (logErr) throw new Error(logErr.message);
  if (!log) throw new Error("reply_log not found");

  const { data, error } = await sb
    .from("feedback")
    .insert({
      agent_id: log.agent_id,
      reply_log_id: log.id,
      feedback_text: parsed.feedback_text,
      retrieved_chunk_ids: log.retrieved_chunk_ids ?? [],
      draft_reply: log.draft,
      trigger_message: log.trigger_message,
      status: "pending",
    })
    .select("id, agent_id")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; agent_id: string };
}

/** Move an analyzed feedback into the applying queue. The worker takes over. */
export async function applyFeedback(feedback_id: string): Promise<void> {
  const sb = createServiceClient();
  const { data: existing, error: readErr } = await sb
    .from("feedback")
    .select("status")
    .eq("id", feedback_id)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!existing) throw new Error("feedback not found");
  if (existing.status !== "analyzed") {
    throw new Error(
      `Cannot apply feedback in status '${existing.status}' (expected 'analyzed')`,
    );
  }
  const { error } = await sb
    .from("feedback")
    .update({ status: "applying", locked_at: null, error: null })
    .eq("id", feedback_id)
    .eq("status", "analyzed"); // optimistic guard
  if (error) throw new Error(error.message);
}

export async function dismissFeedback(feedback_id: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("feedback")
    .update({ status: "dismissed", processed_at: new Date().toISOString() })
    .eq("id", feedback_id);
  if (error) throw new Error(error.message);
}

/** Reset a failed feedback back to pending so the worker re-tries. */
export async function retryFeedback(feedback_id: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("feedback")
    .update({ status: "pending", error: null, locked_at: null })
    .eq("id", feedback_id)
    .eq("status", "failed");
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Read-path
// ---------------------------------------------------------------------------

export async function getFeedback(id: string): Promise<FeedbackRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("feedback")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as FeedbackRow | null;
}

export async function listFeedback(
  agent_id: string,
  filter: { status?: FeedbackStatus | "all"; limit?: number } = {},
): Promise<FeedbackRow[]> {
  const sb = createServiceClient();
  let q = sb
    .from("feedback")
    .select(COLS)
    .eq("agent_id", agent_id)
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 100);
  if (filter.status && filter.status !== "all")
    q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackRow[];
}

// ---------------------------------------------------------------------------
// Worker-side: analyze + apply. These are invoked after a claim_*_feedback()
// RPC has moved the row into the right transient state.
// ---------------------------------------------------------------------------

/** Worker path: run the LLM analysis and transition to 'analyzed' or 'failed'. */
export async function runAnalyzeFeedback(feedback_id: string): Promise<void> {
  const sb = createServiceClient();
  const row = await getFeedback(feedback_id);
  if (!row) throw new Error(`feedback ${feedback_id} not found`);

  try {
    const chunks =
      row.retrieved_chunk_ids.length > 0
        ? await fetchChunkContext(row.retrieved_chunk_ids)
        : [];

    const analysis = await llmAnalyzeFeedback({
      feedback_text: row.feedback_text,
      trigger_message: row.trigger_message,
      draft_reply: row.draft_reply,
      chunks,
    });

    const { error } = await sb
      .from("feedback")
      .update({
        status: "analyzed",
        suggested_action: analysis,
        analyzed_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", feedback_id);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    consola.error(`analyzeFeedback(${feedback_id}) failed:`, msg);
    await sb
      .from("feedback")
      .update({ status: "failed", error: msg })
      .eq("id", feedback_id);
    throw e;
  }
}

/** Worker path: execute the approved action and transition to 'applied'/'failed'. */
export async function runApplyFeedback(feedback_id: string): Promise<void> {
  const sb = createServiceClient();
  const row = await getFeedback(feedback_id);
  if (!row) throw new Error(`feedback ${feedback_id} not found`);
  if (!row.suggested_action)
    throw new Error(`feedback ${feedback_id} has no suggested_action`);

  const action = row.suggested_action;

  try {
    let applied_chunk_id: string | null = null;

    switch (action.action_type) {
      case "edit_chunk": {
        if (!action.likely_chunk_id)
          throw new Error("edit_chunk requires likely_chunk_id");
        if (!action.edit_proposal)
          throw new Error("edit_chunk requires edit_proposal");
        const updated = await updateChunk(
          action.likely_chunk_id,
          action.edit_proposal.new_content,
        );
        // Annotate metadata for graph + audit without losing existing keys.
        await patchChunkMetadata(updated.id, {
          edited_by_feedback: feedback_id,
        });
        applied_chunk_id = updated.id;
        break;
      }
      case "add_chunk": {
        if (!action.edit_proposal)
          throw new Error("add_chunk requires edit_proposal");
        applied_chunk_id = await insertChunkFromFeedback(
          row.agent_id,
          action.edit_proposal.new_content,
          feedback_id,
        );
        break;
      }
      case "deprecate_chunk": {
        if (!action.likely_chunk_id)
          throw new Error("deprecate_chunk requires likely_chunk_id");
        await patchChunkMetadata(action.likely_chunk_id, {
          deprecated: true,
          deprecated_at: new Date().toISOString(),
          deprecated_by_feedback: feedback_id,
        });
        applied_chunk_id = action.likely_chunk_id;
        break;
      }
      case "no_action":
        applied_chunk_id = null;
        break;
    }

    const { error } = await sb
      .from("feedback")
      .update({
        status: "applied",
        applied_chunk_id,
        processed_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", feedback_id);
    if (error) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    consola.error(`applyFeedback(${feedback_id}) failed:`, msg);
    await sb
      .from("feedback")
      .update({ status: "failed", error: msg })
      .eq("id", feedback_id);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function fetchChunkContext(
  ids: string[],
): Promise<Array<{ id: string; content: string; content_type: string }>> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("chunks")
    .select("id, content, content_type")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    content: string;
    content_type: string;
  }>;
}

async function patchChunkMetadata(
  chunk_id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const sb = createServiceClient();
  const { data: existing, error: readErr } = await sb
    .from("chunks")
    .select("metadata")
    .eq("id", chunk_id)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!existing) throw new Error(`chunk ${chunk_id} not found`);
  const merged = { ...(existing.metadata ?? {}), ...patch };
  const { error } = await sb
    .from("chunks")
    .update({ metadata: merged })
    .eq("id", chunk_id);
  if (error) throw new Error(error.message);
}

async function insertChunkFromFeedback(
  agent_id: string,
  content: string,
  feedback_id: string,
): Promise<string> {
  const [embedding] = await embedBatch([content]);
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("chunks")
    .insert({
      agent_id,
      file_id: null,
      content,
      content_type: "sop", // sensible default; operators can retype later
      metadata: { added_by_feedback: feedback_id },
      position: 0,
      edited_by_user: true,
      embedding,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}
