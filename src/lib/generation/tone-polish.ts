import { generateObject } from "ai";
import { z } from "zod";
import { miniModel } from "@/lib/openai";
import type { TonePolishSource } from "@/lib/schemas/reply";

const PolishSchema = z.object({
  polished_reply: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "The reply rewritten to match Ferdi's tone, length, and rhythm. Keep all citations [kb-N], [sop-N], etc. intact.",
    ),
  changes: z
    .string()
    .max(300)
    .describe(
      "One sentence: what you changed (e.g. 'shortened, removed greeting, switched to lowercase opener').",
    ),
});

const SYSTEM = `You polish a draft sales reply to match Ferdi's historical tone.

Rules:
- Read the historical Ferdi replies as the tone target: register, sentence length, contractions, greeting/sign-off habits, emoji usage.
- DO NOT change capitalization. The draft already mirrors the customer's caps style (sentence-case vs lowercase vs ALL CAPS) — keep it exactly as-is. Ignore the historical samples' capitalization even if they're predominantly lowercase.
- Preserve the draft's MEANING, factual claims, and any inline citation markers like [kb-2] or [sop-1] exactly.
- Preserve any tool intent (Calendly link, document attachment) — don't drop calls to action.
- Don't change the language. Don't translate.
- Customer-tone-mirroring still wins if the draft already mirrors the prospect well — Ferdi's style is a SECONDARY anchor, not a hard override.
- If the draft is already a great match for Ferdi's style, return it nearly verbatim and say so in 'changes'.`;

export async function polishTone(params: {
  draft_text: string;
  sources: TonePolishSource[];
}): Promise<{ polished: string; changes: string }> {
  const { draft_text, sources } = params;

  if (sources.length === 0) {
    return { polished: draft_text, changes: "no historical sources — skipped" };
  }

  const sourceBlock = sources
    .map(
      (s, i) =>
        `── Ferdi reply ${i + 1} (${s.origin}) ──\n${s.content.slice(0, 800)}`,
    )
    .join("\n\n");

  try {
    const { object } = await generateObject({
      model: miniModel(),
      schema: PolishSchema,
      system: SYSTEM,
      prompt: `HISTORICAL FERDI REPLIES (tone target):
${sourceBlock}

DRAFT TO POLISH:
${draft_text}`,
      temperature: 0.3,
    });
    return { polished: object.polished_reply, changes: object.changes };
  } catch {
    return { polished: draft_text, changes: "polish failed — kept original" };
  }
}
