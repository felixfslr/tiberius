import { generateObject } from "ai";
import { replyModel } from "@/lib/openai";
import {
  GeneratedReplySchema,
  type EngagementStage,
  type GeneratedReply,
} from "@/lib/schemas/reply";
import type { BuiltPrompt } from "./prompt";

const SYSTEM = `You are synthesizing a final sales reply by following an explicit synthesis plan from a senior reviewer. The plan tells you which of three candidate drafts is the structural base and which sentences/ideas to pull from the others.

Rules:
- Follow the plan literally — don't second-guess which draft to base on.
- Preserve the customer-tone-mirroring instruction: register, length, formality, emoji habits must match the prospect's incoming message (already in <incoming_message>).
- Keep groundedness: every factual claim must trace to one of the chunks referenced in the candidate drafts (used_chunk_refs). Don't invent new claims.
- Output strictly in the JSON schema. used_chunk_refs should be the union of refs from the imported pieces.`;

export async function synthesize(params: {
  basePrompt: BuiltPrompt;
  drafts: Array<{ hypothesis: EngagementStage; reply: GeneratedReply }>;
  synthesisPlan: string;
}): Promise<GeneratedReply> {
  const { basePrompt, drafts, synthesisPlan } = params;

  const draftBlock = drafts
    .map(
      (d, i) =>
        `── DRAFT ${i} (hypothesis: ${d.hypothesis}) ──
${d.reply.reply_text}

intent: ${d.reply.detected_intent} · tool: ${d.reply.suggested_tool} · refs: ${JSON.stringify(d.reply.used_chunk_refs)}`,
    )
    .join("\n\n");

  const prompt = `${basePrompt.userPrompt}

<candidate_drafts>
${draftBlock}
</candidate_drafts>

<synthesis_plan>
${synthesisPlan}
</synthesis_plan>

Produce the final synthesized reply now, following the synthesis_plan exactly.`;

  const { object } = await generateObject({
    model: replyModel(),
    schema: GeneratedReplySchema,
    system: `${basePrompt.system}\n\n${SYSTEM}`,
    prompt,
    temperature: 0.3,
  });
  return object;
}
