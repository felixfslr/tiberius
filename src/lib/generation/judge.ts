import { generateObject } from "ai";
import { goldJudgeModel } from "@/lib/openai";
import type { Message } from "@/lib/schemas/common";
import {
  JudgeDecisionSchema,
  type CriticScores,
  type EngagementDistribution,
  type EngagementStage,
  type GeneratedReply,
  type JudgeDecision,
} from "@/lib/schemas/reply";

const SYSTEM = `You are a senior sales-ops reviewer. Three drafts have been generated for the SAME prospect message, each conditioned on a different engagement-stage hypothesis. Multi-dimensional critic scores accompany each.

Your job:
1. Decide which engagement stage is most likely TRUE given the actual conversation (do not blindly trust the hypothesis labels — use the conversation, the stage probability distribution, and what each draft revealed).
2. Pick the single best draft (0, 1, or 2) — OR call "synthesis" if no single draft is best but a clear plan exists for combining their strengths.
3. If you choose "synthesis", write synthesis_plan: 2–4 sentences telling the synthesizer which draft is the structural base and exactly which sentences/ideas to import from the others. Be concrete ("take the opening of Draft 1, the disqualification line from Draft 2, drop Draft 0's Calendly mention because it's premature").
4. If you pick a single draft, set synthesis_plan to null.

Be decisive. Reasoning ≤ 4 sentences. Don't pick synthesis just to be safe — only when it's strictly better than any single draft.`;

export async function judge(params: {
  trigger_message: string;
  history: Message[];
  distribution: EngagementDistribution;
  drafts: Array<{
    hypothesis: EngagementStage;
    reply: GeneratedReply;
    critics: CriticScores;
  }>;
}): Promise<JudgeDecision> {
  const { trigger_message, history, distribution, drafts } = params;

  const recent = history.slice(-8);
  const historyBlock =
    recent.length === 0
      ? "(none)"
      : recent
          .map(
            (m) =>
              `${m.role === "assistant" ? "Agent" : "Prospect"}: ${m.content}`,
          )
          .join("\n");

  const distBlock = `engaged=${distribution.engaged.toFixed(2)} fit_mismatch=${distribution.fit_mismatch.toFixed(2)} qualifying=${distribution.qualifying.toFixed(2)} scheduling=${distribution.scheduling.toFixed(2)} ghosting=${distribution.ghosting.toFixed(2)}
classifier reasoning: ${distribution.reasoning}`;

  const draftBlock = drafts
    .map((d, i) => {
      const c = d.critics;
      return `── DRAFT ${i} (hypothesis: ${d.hypothesis}) ──
${d.reply.reply_text}

intent: ${d.reply.detected_intent} · tool: ${d.reply.suggested_tool} · refs: ${JSON.stringify(d.reply.used_chunk_refs)}
critics: stage_appropriateness=${c.stage_appropriateness.toFixed(2)} groundedness=${c.groundedness.toFixed(2)} tone_match=${c.tone_match.toFixed(2)} intent_match=${c.intent_match.toFixed(2)} → inferred_stage=${c.inferred_stage}
critic_notes: ${c.notes}`;
    })
    .join("\n\n");

  const prompt = `INCOMING MESSAGE:
${trigger_message}

HISTORY:
${historyBlock}

ENGAGEMENT-STAGE DISTRIBUTION:
${distBlock}

DRAFTS:
${draftBlock}`;

  try {
    const { object } = await generateObject({
      model: goldJudgeModel(),
      schema: JudgeDecisionSchema,
      system: SYSTEM,
      prompt,
      temperature: 0.2,
    });
    return object;
  } catch {
    // Fallback: pick the draft with highest mean critic score.
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
    const chosen = (best === 0 || best === 1 || best === 2 ? best : 0) as
      | 0
      | 1
      | 2;
    return {
      chosen,
      reasoning: "Judge LLM failed; fell back to highest mean critic score.",
      synthesis_plan: null,
    };
  }
}
