import { generateObject } from "ai";
import { replyModel } from "@/lib/openai";
import {
  GeneratedReplySchema,
  type GeneratedReply,
} from "@/lib/schemas/reply";
import type { BuiltPrompt } from "./prompt";

export async function generateReplyOnce(
  prompt: BuiltPrompt,
  temperature = 0.4,
): Promise<GeneratedReply> {
  const { object } = await generateObject({
    model: replyModel(),
    schema: GeneratedReplySchema,
    system: prompt.system,
    prompt: prompt.userPrompt,
    temperature,
  });
  return object;
}
