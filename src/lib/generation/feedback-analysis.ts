import { generateObject } from "ai";
import { miniModel } from "@/lib/openai";
import {
  FeedbackAnalysisSchema,
  type FeedbackAnalysis,
} from "@/lib/schemas/feedback";

type RetrievedChunk = {
  id: string;
  content: string;
  content_type: string;
};

type AnalyzeInput = {
  feedback_text: string;
  trigger_message: string | null;
  draft_reply: string | null;
  chunks: RetrievedChunk[];
};

const SYSTEM = `You are a knowledge-base curator for a sales-assistant agent.
The agent drafted a reply using a set of retrieved chunks. The user (the agent operator) says the reply is wrong.
Your job is to find the root cause in the retrieved chunks and propose a concrete fix.

Rules:
- "likely_chunk_id" MUST be one of the chunk IDs provided below, or null. Never invent an ID.
- Prefer action_type='edit_chunk' when an existing chunk contains wrong/outdated info.
- Use 'add_chunk' only when NO chunk covers the info the user wants taught. Include a new chunk content in edit_proposal.new_content — leave old_content_snippet empty.
- Use 'deprecate_chunk' when a chunk is obsolete but no replacement is needed.
- Use 'no_action' when the feedback is off-scope, invalid, or does not imply a knowledge change.
- Keep edit_proposal.new_content faithful to the agent's tone and structure. Do not rewrite everything.
- Set confidence low (<0.5) if the retrieved chunks don't clearly contain the issue — the worker will then flag it for review.`;

function buildUserPrompt(input: AnalyzeInput): string {
  const chunkList = input.chunks
    .map(
      (c, i) =>
        `[chunk ${i + 1}] id=${c.id} type=${c.content_type}\n${c.content}`,
    )
    .join("\n\n---\n\n");
  return [
    `Trigger message (from prospect):\n${input.trigger_message ?? "(not available)"}`,
    `\nAgent's draft reply:\n${input.draft_reply ?? "(not available)"}`,
    `\nOperator's feedback:\n${input.feedback_text}`,
    `\n\nRetrieved chunks that fed the reply:\n\n${chunkList || "(no chunks retrieved)"}`,
  ].join("\n");
}

export async function analyzeFeedback(
  input: AnalyzeInput,
): Promise<FeedbackAnalysis> {
  const { object } = await generateObject({
    model: miniModel(),
    schema: FeedbackAnalysisSchema,
    system: SYSTEM,
    prompt: buildUserPrompt(input),
  });

  // Defensive: the model occasionally ignores the constraint. Null out invented IDs.
  if (
    object.likely_chunk_id &&
    !input.chunks.some((c) => c.id === object.likely_chunk_id)
  ) {
    object.likely_chunk_id = null;
  }
  return object;
}
