import { consola } from "consola";
import { generateObject } from "ai";
import { z } from "zod";
import { miniModel } from "@/lib/openai";
import { FileTypeSchema, type FileType } from "@/lib/schemas/file";

const Schema = z.object({
  type: FileTypeSchema,
  reasoning: z.string().max(200),
});

const SYSTEM_PROMPT = `You classify uploaded knowledge-base documents for Ivy's AI sales assistant into exactly one of these seven types:

- product_doc: marketing pages, product specs, feature overviews, FAQs aimed at prospects
- sop: standard operating procedures, playbooks, internal how-to guides that tell the agent what to do in situation X
- glossary: terminology sheets, definition lists, crypto/fintech jargon references
- chat_history: logs of past customer conversations (WhatsApp, Telegram, Gmail threads) used as context
- convo_snippet: a short isolated piece of one past conversation (one exchange, a Q&A pair)
- tov_example: curated examples of the desired tone-of-voice / reply style the agent should borrow phrasing from
- transcript: call or meeting transcripts (discovery calls, demos, interviews)

Choose the single best fit. Bias rules:
- If the content is a long back-and-forth between a prospect and a rep, prefer chat_history over convo_snippet.
- A single short question+answer exchange pulled out as a reference → convo_snippet.
- Hand-picked "this is how we want to sound" replies → tov_example.
- If it's a procedural "do this, then do that" → sop, even if it mentions product details.
- If uncertain, default to product_doc.`;

export async function classifyFileType(
  text: string,
  filename?: string,
): Promise<FileType> {
  const sample = text.slice(0, 3000).trim();
  if (!sample) return "product_doc";

  const prompt = `Filename: ${filename ?? "(unknown)"}

Document content (first 3000 chars):
<document>
${sample}
</document>

Classify this document into one of the seven types.`;

  try {
    const { object } = await generateObject({
      model: miniModel(),
      schema: Schema,
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0,
    });
    consola.info(
      `classifyFileType(${filename ?? "?"}) -> ${object.type} (${object.reasoning})`,
    );
    return object.type;
  } catch (e) {
    consola.warn(
      `classifyFileType failed for ${filename ?? "?"}: ${e instanceof Error ? e.message : String(e)} — defaulting to product_doc`,
    );
    return "product_doc";
  }
}
