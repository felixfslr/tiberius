import { z } from "zod";
import { MessageSchema } from "./common";
import { AgentConfigSchema } from "./agent";

export const SuggestedToolSchema = z.enum([
  "send_calendly_link",
  "attach_document",
  "flag_for_review",
  "none",
]);
export type SuggestedTool = z.infer<typeof SuggestedToolSchema>;

export const ReplyRequestSchema = z.object({
  trigger_message: z.string().min(1).max(4000),
  history: z.array(MessageSchema).max(100).default([]),
  config_override: AgentConfigSchema.partial().optional(),
});
export type ReplyRequest = z.infer<typeof ReplyRequestSchema>;

/**
 * What the generator model produces (validated by `generateObject`).
 * Keep tool_args loose — the agent config is what dictates the expected shape.
 */
export const GeneratedReplySchema = z.object({
  reply_text: z.string().min(1).max(2000),
  reasoning: z
    .string()
    .max(500)
    .describe("Brief rationale: which SOPs/facts guided the reply and why this tone/length."),
  detected_intent: z.string().describe("Primary intent you inferred (matches state.intents)."),
  suggested_tool: SuggestedToolSchema.describe(
    "A tool to attach to the reply, or 'none'. 'flag_for_review' = don't send, route to human.",
  ),
  tool_args: z.object({
    calendly_url: z.string().nullable(),
    document_name: z.string().nullable(),
    review_reason: z.string().nullable(),
  }),
  used_chunk_refs: z
    .array(z.string())
    .describe(
      "IDs of the chunks (kb-N / sop-N / tov-N / convo-N) you actually cited. Empty array if you made no factual claim.",
    ),
});
export type GeneratedReply = z.infer<typeof GeneratedReplySchema>;

/** What the API returns to the caller. */
export const ReplyResponseSchema = z.object({
  reply_text: z.string(),
  confidence: z.number().min(0).max(1),
  confidence_breakdown: z.object({
    retrieval: z.number().min(0).max(1),
    intent: z.number().min(0).max(1),
    groundedness: z.number().min(0).max(1),
    consistency: z.number().min(0).max(1),
  }),
  detected_stage: z.string(),
  detected_intent: z.string(),
  detected_intents: z.array(z.string()),
  suggested_tool: SuggestedToolSchema,
  tool_args: z.record(z.string(), z.any()).default({}),
  reasoning: z.string(),
  retrieved_chunk_ids: z.array(z.string()),
  reply_log_id: z.string().uuid(),
  below_threshold: z.boolean(),
});
export type ReplyResponse = z.infer<typeof ReplyResponseSchema>;
