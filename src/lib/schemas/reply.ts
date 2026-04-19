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
    .describe(
      "Brief rationale: which SOPs/facts guided the reply and how you matched the customer's tone.",
    ),
  detected_intent: z
    .string()
    .describe("Primary intent you inferred (matches state.intents)."),
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

/* ─────────────────────────────────────────────────────────────────────────────
 * Stage-Conditional Tree-of-Drafts
 * ────────────────────────────────────────────────────────────────────────── */

export const ENGAGEMENT_STAGES = [
  "engaged",
  "fit_mismatch",
  "qualifying",
  "scheduling",
  "ghosting",
] as const;
export const EngagementStageSchema = z.enum(ENGAGEMENT_STAGES);
export type EngagementStage = z.infer<typeof EngagementStageSchema>;

/** Probability distribution over the 5 engagement stages. Sum should ≈ 1. */
export const EngagementDistributionSchema = z.object({
  engaged: z.number().min(0).max(1),
  fit_mismatch: z.number().min(0).max(1),
  qualifying: z.number().min(0).max(1),
  scheduling: z.number().min(0).max(1),
  ghosting: z.number().min(0).max(1),
  reasoning: z.string().max(400),
});
export type EngagementDistribution = z.infer<
  typeof EngagementDistributionSchema
>;

export const CriticScoresSchema = z.object({
  stage_appropriateness: z.number().min(0).max(1),
  groundedness: z.number().min(0).max(1),
  tone_match: z.number().min(0).max(1),
  intent_match: z.number().min(0).max(1),
  inferred_stage: EngagementStageSchema,
  notes: z.string().max(300),
});
export type CriticScores = z.infer<typeof CriticScoresSchema>;

export const JudgeChoiceSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal("synthesis"),
]);
export type JudgeChoice = z.infer<typeof JudgeChoiceSchema>;

export const JudgeDecisionSchema = z.object({
  chosen: JudgeChoiceSchema,
  reasoning: z.string().max(600),
  synthesis_plan: z.string().max(600).nullable(),
});
export type JudgeDecision = z.infer<typeof JudgeDecisionSchema>;

export const TreeDraftSchema = z.object({
  hypothesis: EngagementStageSchema,
  hypothesis_probability: z.number().min(0).max(1),
  reply: GeneratedReplySchema,
  critics: CriticScoresSchema,
  latency_ms: z.number().nonnegative(),
});
export type TreeDraft = z.infer<typeof TreeDraftSchema>;

export const TonePolishSourceSchema = z.object({
  reply_log_id: z.string().nullable(),
  content: z.string(),
  origin: z.enum(["reply_logs", "tov_examples"]),
});
export type TonePolishSource = z.infer<typeof TonePolishSourceSchema>;

export const TreeTraceSchema = z.object({
  distribution: EngagementDistributionSchema,
  hypotheses: z.array(EngagementStageSchema).length(3),
  drafts: z.array(TreeDraftSchema).length(3),
  judge: JudgeDecisionSchema,
  synthesis_used: z.boolean(),
  synthesis_text: z.string().nullable(),
  tone_polish: z.object({
    sources: z.array(TonePolishSourceSchema),
    before: z.string(),
    after: z.string(),
    skipped: z.boolean(),
  }),
});
export type TreeTrace = z.infer<typeof TreeTraceSchema>;

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
  tree_trace: TreeTraceSchema.optional(),
});
export type ReplyResponse = z.infer<typeof ReplyResponseSchema>;
