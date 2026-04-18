import { generateObject } from "ai";
import { z } from "zod";
import { miniModel } from "@/lib/openai";
import type { Message } from "@/lib/schemas/common";
import {
  INTENTS,
  STAGES,
  type ConversationState,
  type Intent,
  type SalesStage,
} from "./types";

const Schema = z.object({
  stage: z.enum(STAGES as [SalesStage, ...SalesStage[]]),
  intents: z.array(z.enum(INTENTS)).min(1).max(3),
  intent_confidence: z.number().min(0).max(1),
  entities: z.array(z.string()).max(15),
  reasoning: z.string().max(300),
});

const SYSTEM = `You are analyzing a B2B sales conversation between Ivy (a crypto-native banking/payments company) and a prospect (usually a crypto exchange or payments platform).

Classify:
- stage: where the conversation is in the sales funnel.
  - cold: prospect hasn't engaged much, agent is opening.
  - qualifying: asking discovery questions (volume, geography, current provider).
  - scheduling: actively trying to book a call.
  - scheduled: a call is confirmed (date in the future).
  - post_call: discovery call happened, next steps discussion.
  - stalled: prospect went silent or declined.
- intents (1-3): what the prospect is actually trying to get from this message.
- intent_confidence: 0.0-1.0 how sure you are about intents.
- entities: named things in the message (products, geographies, currencies, competitor names, specific crypto terms). Lowercase, short.
- reasoning: one sentence explaining your classification.`;

export async function trackState(
  trigger_message: string,
  history: Message[],
): Promise<ConversationState> {
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
      schema: Schema,
      system: SYSTEM,
      prompt: `HISTORY:\n${historyBlock}\n\nINCOMING MESSAGE:\n${trigger_message}`,
    });
    return {
      stage: object.stage,
      intents: object.intents as Intent[],
      intent_confidence: object.intent_confidence,
      entities: object.entities.map((e) => e.toLowerCase()).filter(Boolean),
      reasoning: object.reasoning,
    };
  } catch {
    // Defensive fallback: never let state-tracking failures block retrieval.
    return {
      stage: "qualifying",
      intents: ["other"],
      intent_confidence: 0,
      entities: [],
      reasoning: "State tracker failed; falling back to safe defaults.",
    };
  }
}
