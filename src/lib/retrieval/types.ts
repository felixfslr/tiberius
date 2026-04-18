import type { ChunkMetadata } from "@/lib/schemas/chunk";
import type { Message } from "@/lib/schemas/common";

export type SalesStage =
  | "cold"
  | "qualifying"
  | "scheduling"
  | "scheduled"
  | "post_call"
  | "stalled";

export const STAGES: SalesStage[] = [
  "cold",
  "qualifying",
  "scheduling",
  "scheduled",
  "post_call",
  "stalled",
];

export const INTENTS = [
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
export type Intent = (typeof INTENTS)[number];

export type ConversationState = {
  stage: SalesStage;
  intents: Intent[];
  intent_confidence: number;
  entities: string[];
  reasoning: string;
};

export type RetrievedChunk = {
  id: string;
  file_id: string | null;
  content: string;
  content_type: string;
  metadata: ChunkMetadata;
  source: "hybrid" | "metadata" | "entity";
  score: number;
};

export type RetrievalInput = {
  agent_id: string;
  trigger_message: string;
  history: Message[];
};

export type RetrievedContext = {
  state: ConversationState;
  entities: string[];
  kb_facts: RetrievedChunk[];
  sops: RetrievedChunk[];
  tov_examples: RetrievedChunk[];
  similar_past_convos: RetrievedChunk[];
  entity_triggered: RetrievedChunk[];
  all_ranked: RetrievedChunk[];
  debug: {
    hybrid_count: number;
    metadata_count: number;
    entity_count: number;
    rerank_input: number;
    rerank_output: number;
    latency_ms: {
      state: number;
      retrieval: number;
      rerank: number;
      total: number;
    };
  };
};
