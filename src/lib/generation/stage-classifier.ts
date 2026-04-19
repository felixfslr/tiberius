import { generateObject } from "ai";
import { miniModel } from "@/lib/openai";
import type { Message } from "@/lib/schemas/common";
import {
  EngagementDistributionSchema,
  ENGAGEMENT_STAGES,
  type EngagementDistribution,
  type EngagementStage,
} from "@/lib/schemas/reply";

const SYSTEM = `You analyze a B2B sales conversation between Ivy (crypto-native banking/payments for crypto exchanges) and a prospect, then output a probability distribution over the prospect's engagement stage. The five stages are mutually exclusive — distribute mass according to your real uncertainty.

Stages:
- engaged: prospect is asking real questions, interested, moving forward.
- fit_mismatch: prospect's use case clearly doesn't match Ivy's product (wrong industry, wrong volume tier, regulated-but-incompatible jurisdiction, wants a feature we don't have). They may not yet realize it themselves.
- qualifying: agent should be asking discovery questions (volume, geography, current provider) — prospect hasn't given enough signal yet.
- scheduling: prospect wants to book a call OR has just confirmed a slot, OR the natural next move is a calendar link.
- ghosting: prospect went silent, is unresponsive, gave a soft no, or is clearly disengaging.

Output a probability for EACH stage in [0, 1]. Probabilities should sum to ~1.0 (small drift OK). Use ALL five — assign small but non-zero mass to plausible alternates rather than forcing 1.0 on one. Reason in one sentence: which signals drove your call.`;

export async function classifyEngagement(
  trigger_message: string,
  history: Message[],
): Promise<EngagementDistribution> {
  const recent = history.slice(-10);
  const historyBlock =
    recent.length === 0
      ? "(no prior messages)"
      : recent
          .map(
            (m) =>
              `${m.role === "assistant" ? "Agent" : "Prospect"}: ${m.content}`,
          )
          .join("\n");

  try {
    const { object } = await generateObject({
      model: miniModel(),
      schema: EngagementDistributionSchema,
      system: SYSTEM,
      prompt: `HISTORY:\n${historyBlock}\n\nINCOMING MESSAGE:\n${trigger_message}`,
    });
    return normalize(object);
  } catch {
    // Defensive fallback: never let classifier failures block the tree.
    return {
      engaged: 0.2,
      fit_mismatch: 0.2,
      qualifying: 0.4,
      scheduling: 0.1,
      ghosting: 0.1,
      reasoning: "Classifier failed; falling back to qualifying-leaning prior.",
    };
  }
}

function normalize(d: EngagementDistribution): EngagementDistribution {
  const sum =
    d.engaged + d.fit_mismatch + d.qualifying + d.scheduling + d.ghosting;
  if (sum <= 0) return d;
  return {
    engaged: d.engaged / sum,
    fit_mismatch: d.fit_mismatch / sum,
    qualifying: d.qualifying / sum,
    scheduling: d.scheduling / sum,
    ghosting: d.ghosting / sum,
    reasoning: d.reasoning,
  };
}

/** Top-N stages by descending probability. */
export function topStages(
  d: EngagementDistribution,
  n = 3,
): Array<{ stage: EngagementStage; probability: number }> {
  return ENGAGEMENT_STAGES.map((stage) => ({
    stage,
    probability: d[stage],
  }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, n);
}
