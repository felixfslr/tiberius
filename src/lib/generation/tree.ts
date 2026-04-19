import { consola } from "consola";
import type { Message } from "@/lib/schemas/common";
import type { AgentConfig } from "@/lib/schemas/agent";
import type { RetrievedContext } from "@/lib/retrieval/types";
import {
  type CriticScores,
  type EngagementDistribution,
  type EngagementStage,
  type GeneratedReply,
  type JudgeDecision,
  type TreeDraft,
  type TreeTrace,
  type TonePolishSource,
} from "@/lib/schemas/reply";
import { buildPrompt, type StageHypothesis } from "./prompt";
import { generateReplyOnce } from "./reply";
import { classifyEngagement, topStages } from "./stage-classifier";
import { runCritics } from "./critics";
import { judge } from "./judge";
import { synthesize } from "./synthesizer";
import { polishTone } from "./tone-polish";
import { findSimilarFerdiReplies } from "@/lib/services/historical-replies";

/* ────────────────────────────────────────────────────────────────────────── */
/* Stage strategy lookup — keep these tight so drafts diverge sharply.        */
/* ────────────────────────────────────────────────────────────────────────── */

const STRATEGY: Record<EngagementStage, string> = {
  engaged:
    "Lean in. Answer directly, share the most relevant fact, and propose the next concrete step (call, doc, intro). Confident, no hedging.",
  fit_mismatch:
    "Name the gap honestly. Acknowledge that Ivy may not be the right fit for their situation, and either propose disqualification gracefully or pivot to the narrow slice that COULD work. No Calendly push, no marketing fluff.",
  qualifying:
    "Ask 1–2 sharp discovery questions before committing to anything. Volume, geography, current provider, timeline. Don't pitch yet. Short and curious.",
  scheduling:
    "Move them to a calendar slot. Send the Calendly link or propose 2 concrete times. Minimal new info — the goal is the meeting.",
  ghosting:
    "Single short re-engagement line. No new info, no pressure. Either ask one easy yes/no question, or offer a soft out ('happy to circle back next quarter').",
};

function stageHypothesis(
  stage: EngagementStage,
  probability: number,
): StageHypothesis {
  return { label: stage, probability, strategy: STRATEGY[stage] };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Event channel                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export type TreeEvent =
  | {
      type: "retrieval_done";
      data: { stage: string; intents: string[]; num_chunks: number };
    }
  | {
      type: "stage_distribution";
      data: {
        distribution: EngagementDistribution;
        top3: Array<{ stage: EngagementStage; probability: number }>;
      };
    }
  | {
      type: "draft_started";
      data: {
        index: 0 | 1 | 2;
        hypothesis: EngagementStage;
        probability: number;
      };
    }
  | {
      type: "draft_completed";
      data: {
        index: 0 | 1 | 2;
        hypothesis: EngagementStage;
        reply_text: string;
        latency_ms: number;
      };
    }
  | {
      type: "critics_completed";
      data: { index: 0 | 1 | 2; scores: CriticScores };
    }
  | { type: "judge_decision"; data: JudgeDecision }
  | { type: "synthesis_completed"; data: { reply_text: string } }
  | {
      type: "tone_polish_done";
      data: {
        sources: TonePolishSource[];
        before: string;
        after: string;
        skipped: boolean;
      };
    }
  | { type: "error"; data: { message: string; phase: string } };

export type TreeEventHandler = (event: TreeEvent) => void;

/* ────────────────────────────────────────────────────────────────────────── */
/* Orchestrator                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export type TreeInput = {
  config: AgentConfig;
  context: RetrievedContext;
  history: Message[];
  trigger_message: string;
  agent_id: string;
  onEvent?: TreeEventHandler;
};

export type TreeResult = {
  final: GeneratedReply;
  trace: TreeTrace;
  /** The chosen engagement stage (used for log persistence + tone retrieval). */
  chosen_stage: EngagementStage;
};

export async function draftReplyTree(input: TreeInput): Promise<TreeResult> {
  const { config, context, history, trigger_message, agent_id, onEvent } =
    input;
  const emit = (e: TreeEvent) => {
    try {
      onEvent?.(e);
    } catch (err) {
      consola.warn("TreeEvent handler threw:", err);
    }
  };

  emit({
    type: "retrieval_done",
    data: {
      stage: context.state.stage,
      intents: context.state.intents,
      num_chunks: context.all_ranked.length,
    },
  });

  // ── Step 1: classify engagement → distribution ─────────────────────────
  const distribution = await classifyEngagement(trigger_message, history);
  const top3 = topStages(distribution, 3) as Array<{
    stage: EngagementStage;
    probability: number;
  }>;
  // Defensive: ensure exactly 3 distinct stages.
  if (top3.length < 3) {
    throw new Error(`stage classifier returned <3 stages: ${top3.length}`);
  }

  emit({ type: "stage_distribution", data: { distribution, top3 } });

  // ── Step 3: parallel hypothesis-conditioned drafts ─────────────────────
  const hypotheses: StageHypothesis[] = top3.map((s) =>
    stageHypothesis(s.stage, s.probability),
  );

  // Build base prompt once, then derive per-hypothesis prompts.
  const draftPromises = hypotheses.map(async (h, idx) => {
    const i = idx as 0 | 1 | 2;
    emit({
      type: "draft_started",
      data: { index: i, hypothesis: h.label, probability: h.probability },
    });
    const t0 = Date.now();
    const prompt = buildPrompt({
      config,
      context,
      history,
      trigger_message,
      stage_hypothesis: h,
    });
    let reply: GeneratedReply;
    try {
      reply = await generateReplyOnce(prompt, 0.5);
    } catch (e) {
      emit({
        type: "error",
        data: {
          message: `draft ${i} (${h.label}) failed: ${e instanceof Error ? e.message : String(e)}`,
          phase: "draft",
        },
      });
      throw e;
    }
    const latency_ms = Date.now() - t0;
    emit({
      type: "draft_completed",
      data: {
        index: i,
        hypothesis: h.label,
        reply_text: reply.reply_text,
        latency_ms,
      },
    });
    return { hypothesis: h, reply, latency_ms };
  });

  const drafts = await Promise.all(draftPromises);

  // ── Step 4: critics in parallel ────────────────────────────────────────
  const criticPromises = drafts.map(async ({ hypothesis, reply }, idx) => {
    const i = idx as 0 | 1 | 2;
    const scores = await runCritics({
      draft: reply,
      hypothesis: hypothesis.label,
      context,
      history,
      trigger_message,
    });
    emit({ type: "critics_completed", data: { index: i, scores } });
    return scores;
  });
  const critics = await Promise.all(criticPromises);

  // Build TreeDraft array now (used by judge + trace).
  const treeDrafts: TreeDraft[] = drafts.map((d, i) => ({
    hypothesis: d.hypothesis.label,
    hypothesis_probability: d.hypothesis.probability,
    reply: d.reply,
    critics: critics[i]!,
    latency_ms: d.latency_ms,
  }));

  // ── Step 5: judge ──────────────────────────────────────────────────────
  const decision: JudgeDecision = await judge({
    trigger_message,
    history,
    distribution,
    drafts: treeDrafts.map((d) => ({
      hypothesis: d.hypothesis,
      reply: d.reply,
      critics: d.critics,
    })),
  });
  emit({ type: "judge_decision", data: decision });

  // ── Step 6: synthesis (if needed) ──────────────────────────────────────
  let chosenReply: GeneratedReply;
  let chosenIndex: 0 | 1 | 2;
  let synthesisText: string | null = null;
  let synthesisUsed = false;

  if (decision.chosen === "synthesis" && decision.synthesis_plan) {
    synthesisUsed = true;
    // Use the first draft's prompt as the structural base for synthesis (any will do —
    // they share the same context/config/history).
    const basePrompt = buildPrompt({
      config,
      context,
      history,
      trigger_message,
    });
    try {
      const synth = await synthesize({
        basePrompt,
        drafts: treeDrafts.map((d) => ({
          hypothesis: d.hypothesis,
          reply: d.reply,
        })),
        synthesisPlan: decision.synthesis_plan,
      });
      chosenReply = synth;
      synthesisText = synth.reply_text;
      // Choose the index whose hypothesis aligns with judge reasoning best —
      // use the highest-mean-critic draft as the "anchor" for chosen_stage.
      chosenIndex = pickAnchor(treeDrafts);
      emit({
        type: "synthesis_completed",
        data: { reply_text: synth.reply_text },
      });
    } catch (e) {
      emit({
        type: "error",
        data: {
          message: `synthesis failed; falling back to highest-critic draft: ${e instanceof Error ? e.message : String(e)}`,
          phase: "synthesis",
        },
      });
      chosenIndex = pickAnchor(treeDrafts);
      chosenReply = treeDrafts[chosenIndex]!.reply;
      synthesisUsed = false;
    }
  } else {
    chosenIndex =
      decision.chosen === 0 || decision.chosen === 1 || decision.chosen === 2
        ? decision.chosen
        : pickAnchor(treeDrafts);
    chosenReply = treeDrafts[chosenIndex]!.reply;
  }

  const chosen_stage = treeDrafts[chosenIndex]!.hypothesis;

  // ── Step 7: tone polish ────────────────────────────────────────────────
  let polishedText = chosenReply.reply_text;
  const sources = await findSimilarFerdiReplies({
    agent_id,
    stage: chosen_stage,
    tov_fallback: context.tov_examples,
    k: 3,
  });
  let polishSkipped = sources.length === 0;
  if (!polishSkipped) {
    try {
      const result = await polishTone({
        draft_text: chosenReply.reply_text,
        sources,
      });
      polishedText = result.polished;
    } catch (e) {
      consola.warn("polishTone failed:", e);
      polishSkipped = true;
    }
  }
  emit({
    type: "tone_polish_done",
    data: {
      sources,
      before: chosenReply.reply_text,
      after: polishedText,
      skipped: polishSkipped,
    },
  });

  const finalReply: GeneratedReply = {
    ...chosenReply,
    reply_text: polishedText,
  };

  const trace: TreeTrace = {
    distribution,
    hypotheses: top3.map((s) => s.stage) as [
      EngagementStage,
      EngagementStage,
      EngagementStage,
    ],
    drafts: treeDrafts as [TreeDraft, TreeDraft, TreeDraft],
    judge: decision,
    synthesis_used: synthesisUsed,
    synthesis_text: synthesisText,
    tone_polish: {
      sources,
      before: chosenReply.reply_text,
      after: polishedText,
      skipped: polishSkipped,
    },
  };

  return { final: finalReply, trace, chosen_stage };
}

/** Highest-mean critic score → "anchor" draft index. Used as fallback. */
function pickAnchor(drafts: TreeDraft[]): 0 | 1 | 2 {
  const scored = drafts.map((d, i) => ({
    i,
    mean:
      (d.critics.stage_appropriateness +
        d.critics.groundedness +
        d.critics.tone_match +
        d.critics.intent_match) /
      4,
  }));
  scored.sort((a, b) => b.mean - a.mean);
  const best = scored[0]?.i ?? 0;
  return (best === 1 ? 1 : best === 2 ? 2 : 0) as 0 | 1 | 2;
}
