import { consola } from "consola";
import { createServiceClient } from "@/lib/supabase/service";
import { getAgent } from "@/lib/services/agents";
import { AgentConfigSchema, type AgentConfig } from "@/lib/schemas/agent";
import {
  type ReplyRequest,
  type ReplyResponse,
  type TreeTrace,
} from "@/lib/schemas/reply";
import { retrieve } from "@/lib/retrieval/pipeline";
import { buildPrompt } from "@/lib/generation/prompt";
import { computeConfidence } from "@/lib/generation/confidence";
import { draftReplyTree, type TreeEventHandler } from "@/lib/generation/tree";

export type FullReplyResult = ReplyResponse & {
  /** For the Playground debug panel: the reranked chunks that fed the prompt. */
  retrieved_chunks: Array<{
    id: string;
    content: string;
    content_type: string;
    score: number;
    source: string;
  }>;
  prompt_preview: string;
  tree_trace: TreeTrace;
};

export async function draftReply(
  agent_id: string,
  input: ReplyRequest,
  onEvent?: TreeEventHandler,
): Promise<FullReplyResult> {
  const agent = await getAgent(agent_id);
  if (!agent) throw new Error("Agent not found");

  const config: AgentConfig = input.config_override
    ? AgentConfigSchema.parse({ ...agent.config, ...input.config_override })
    : agent.config;

  // 1. Retrieve.
  const context = await retrieve({
    agent_id,
    trigger_message: input.trigger_message,
    history: input.history,
  });

  // 2. Tree-of-drafts (replaces single-draft path).
  let treeResult;
  try {
    treeResult = await draftReplyTree({
      config,
      context,
      history: input.history,
      trigger_message: input.trigger_message,
      agent_id,
      onEvent,
    });
  } catch (e) {
    consola.error("draftReplyTree failed:", e);
    throw new Error(
      `Reply generation failed: ${e instanceof Error ? e.message : "unknown"}`,
    );
  }
  const generated = treeResult.final;
  const trace = treeResult.trace;
  const chosenStage = treeResult.chosen_stage;

  // 3. Confidence (unchanged).
  const { total, breakdown, unsupported } = await computeConfidence({
    reply: generated,
    state: context.state,
    reranked: context.all_ranked,
  });

  const below = total < config.confidence_threshold;
  const suggestedTool = below ? "flag_for_review" : generated.suggested_tool;
  const toolArgs = below
    ? {
        ...(generated.tool_args ?? {}),
        review_reason: `Confidence ${total.toFixed(2)} below threshold ${config.confidence_threshold}. Unsupported: ${
          unsupported.join("; ") || "see breakdown"
        }`,
      }
    : (generated.tool_args ?? {});

  // 4. Build a representative prompt preview (no hypothesis injection — for debug only).
  const previewPrompt = buildPrompt({
    config,
    context,
    history: input.history,
    trigger_message: input.trigger_message,
  });

  // 5. Persist reply_log for eval + debug. Trace lands in debug.tree;
  //    chosen engagement stage is duplicated to debug.stage_engagement so the
  //    next call's tone-polish can filter on it.
  const sb = createServiceClient();
  const retrieved_chunk_ids = context.all_ranked.map((c) => c.id);
  const { data: log, error: logErr } = await sb
    .from("reply_logs")
    .insert({
      agent_id,
      trigger_message: input.trigger_message,
      history: input.history,
      retrieved_chunk_ids,
      draft: generated.reply_text,
      confidence: total,
      detected_intent: generated.detected_intent,
      suggested_tool: suggestedTool,
      tool_args: toolArgs,
      reasoning: generated.reasoning,
      confidence_breakdown: { ...breakdown, unsupported },
      debug: {
        stage: context.state.stage,
        stage_engagement: chosenStage,
        intents: context.state.intents,
        entities: context.entities,
        retrieval_debug: context.debug,
        tree: trace,
      },
    })
    .select("id")
    .single();
  if (logErr) consola.warn("reply_log insert failed:", logErr.message);

  return {
    reply_text: generated.reply_text,
    confidence: total,
    confidence_breakdown: breakdown,
    detected_stage: context.state.stage,
    detected_intent: generated.detected_intent,
    detected_intents: context.state.intents,
    suggested_tool: suggestedTool,
    tool_args: toolArgs,
    reasoning: generated.reasoning,
    retrieved_chunk_ids,
    reply_log_id: log?.id ?? "00000000-0000-0000-0000-000000000000",
    below_threshold: below,
    retrieved_chunks: context.all_ranked.map((c) => ({
      id: c.id,
      content: c.content,
      content_type: c.content_type,
      score: c.score,
      source: c.source,
    })),
    prompt_preview: previewPrompt.userPrompt,
    tree_trace: trace,
  };
}
