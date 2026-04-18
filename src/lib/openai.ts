import { createOpenAI } from "@ai-sdk/openai";
import { serverEnv } from "@/lib/env";

let _client: ReturnType<typeof createOpenAI> | null = null;

function client() {
  if (!_client) {
    _client = createOpenAI({ apiKey: serverEnv().OPENAI_API_KEY });
  }
  return _client;
}

export function replyModel() {
  return client()(serverEnv().OPENAI_MODEL_REPLY);
}

export function miniModel() {
  return client()(serverEnv().OPENAI_MODEL_MINI);
}

export function embeddingModel() {
  return client().embedding(serverEnv().OPENAI_MODEL_EMBED);
}

export function modelIds() {
  const env = serverEnv();
  return {
    reply: env.OPENAI_MODEL_REPLY,
    mini: env.OPENAI_MODEL_MINI,
    embed: env.OPENAI_MODEL_EMBED,
  };
}
