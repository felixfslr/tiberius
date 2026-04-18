import { embedMany } from "ai";
import { embeddingModel } from "@/lib/openai";

const BATCH = 96;

/** Embeds values in batches of ~100. Returns embeddings in the same order as input. */
export async function embedBatch(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  const result: number[][] = new Array(values.length);
  for (let i = 0; i < values.length; i += BATCH) {
    const slice = values.slice(i, i + BATCH);
    const { embeddings } = await embedMany({
      model: embeddingModel(),
      values: slice,
    });
    embeddings.forEach((e, j) => {
      result[i + j] = e;
    });
  }
  return result;
}
