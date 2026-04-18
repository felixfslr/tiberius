"use server";

import { revalidatePath } from "next/cache";
import {
  applyFeedback,
  dismissFeedback,
  retryFeedback,
  submitFeedback,
} from "@/lib/services/feedback";
import { FeedbackSubmitSchema } from "@/lib/schemas/feedback";

// These wrappers are called from client components via form actions or
// startTransition. Auth is enforced by the dashboard middleware layer (session
// cookie required to reach /agents/*). No api-key scope here.

export async function submitFeedbackAction(input: {
  reply_log_id: string;
  feedback_text: string;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const parsed = FeedbackSubmitSchema.parse(input);
    const res = await submitFeedback(parsed);
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function applyFeedbackAction(
  agent_id: string,
  feedback_id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await applyFeedback(feedback_id);
    revalidatePath(`/agents/${agent_id}/feedback`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function dismissFeedbackAction(
  agent_id: string,
  feedback_id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await dismissFeedback(feedback_id);
    revalidatePath(`/agents/${agent_id}/feedback`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function retryFeedbackAction(
  agent_id: string,
  feedback_id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await retryFeedback(feedback_id);
    revalidatePath(`/agents/${agent_id}/feedback`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
