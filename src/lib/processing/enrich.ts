import { generateObject } from "ai";
import { z } from "zod";
import { miniModel } from "@/lib/openai";
import type { ChunkMetadata } from "@/lib/schemas/chunk";

const STAGES = [
  "cold",
  "qualifying",
  "scheduling",
  "scheduled",
  "post_call",
  "stalled",
  "any",
] as const;

const INTENTS = [
  "pricing",
  "product_fit",
  "integration",
  "timeline",
  "objection",
  "small_talk",
  "contact_info",
  "scheduling",
  "competitor",
  "compliance",
  "other",
] as const;

const ItemSchema = z.object({
  stage: z.array(z.enum(STAGES)),
  intent: z.array(z.enum(INTENTS)),
  entities: z.array(z.string()),
  summary: z.string(),
});

const BatchSchema = z.object({
  items: z.array(ItemSchema),
});

const BATCH_SIZE = 8;

const SYSTEM_PROMPT = `You classify knowledge-base chunks for a B2B crypto-fiat payments company (Ivy). For each chunk, output:
- stage: which sales stage(s) the chunk is relevant to ("any" if unrestricted).
- intent: which buyer intent(s) the chunk addresses.
- entities: concrete named things (products, competitors, features, regions, crypto terms). Lowercase, short.
- summary: one line (< 120 chars) of what the chunk says.

Return exactly one item per input chunk, in the same order.`;

export async function enrichChunks(texts: string[]): Promise<ChunkMetadata[]> {
  const out: ChunkMetadata[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const prompt =
      batch
        .map(
          (t, j) =>
            `<chunk index="${j}">\n${t.slice(0, 1200)}\n</chunk>`,
        )
        .join("\n\n") + `\n\nReturn ${batch.length} items.`;
    try {
      const { object } = await generateObject({
        model: miniModel(),
        schema: BatchSchema,
        system: SYSTEM_PROMPT,
        prompt,
      });
      for (const item of object.items.slice(0, batch.length)) {
        out.push({
          stage: item.stage,
          intent: item.intent,
          entities: item.entities.map((e) => e.toLowerCase()).filter(Boolean),
          summary: item.summary,
        });
      }
      // If model returned fewer items than expected, pad with empty metadata.
      while (out.length < i + batch.length) {
        out.push({ stage: [], intent: [], entities: [] });
      }
    } catch {
      // On failure, insert empty metadata so the chunk still gets embedded and stored.
      for (let j = 0; j < batch.length; j++) {
        out.push({ stage: [], intent: [], entities: [] });
      }
    }
  }
  return out;
}
