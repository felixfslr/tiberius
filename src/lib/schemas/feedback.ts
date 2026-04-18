import { z } from "zod";
import { UUID } from "./common";

/** Incoming feedback from the Playground UI. */
export const FeedbackSubmitSchema = z.object({
  reply_log_id: UUID,
  feedback_text: z.string().min(3).max(4000),
});
export type FeedbackSubmit = z.infer<typeof FeedbackSubmitSchema>;

/** What the mini-model produces when analyzing feedback against retrieved chunks. */
export const FeedbackAnalysisSchema = z.object({
  issue_summary: z
    .string()
    .min(1)
    .max(400)
    .describe("One-sentence restatement of what the user thinks is wrong."),
  likely_chunk_id: z
    .string()
    .nullable()
    .describe(
      "ID of the chunk most likely responsible. Must be one of the provided chunk IDs, or null if none fits.",
    ),
  action_type: z
    .enum(["edit_chunk", "add_chunk", "deprecate_chunk", "no_action"])
    .describe(
      "edit_chunk: an existing chunk is wrong/outdated. add_chunk: no chunk covers the required info. deprecate_chunk: an existing chunk should no longer be used. no_action: feedback is invalid or out of scope.",
    ),
  edit_proposal: z
    .object({
      old_content_snippet: z
        .string()
        .describe(
          "A short excerpt (<=200 chars) from the existing chunk that's wrong.",
        ),
      new_content: z
        .string()
        .describe(
          "The full replacement content for the chunk. Keep voice and structure consistent with the original.",
        ),
      reasoning: z.string().describe("Why this edit fixes the issue."),
    })
    .nullable()
    .describe(
      "Required for action_type='edit_chunk' and 'add_chunk'. Null otherwise.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How sure the analysis is in the proposed action."),
});
export type FeedbackAnalysis = z.infer<typeof FeedbackAnalysisSchema>;

export const FeedbackStatusSchema = z.enum([
  "pending",
  "analyzing",
  "analyzed",
  "applying",
  "applied",
  "dismissed",
  "failed",
]);
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;
