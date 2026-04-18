import type {
  ConversationState,
  RetrievedChunk,
  RetrievedContext,
} from "./types";

/**
 * Group retrieved chunks into structured slots for the prompt.
 * - kb_facts: product_doc + glossary
 * - sops: sop
 * - tov_examples: tov_example
 * - similar_past_convos: chat_history + convo_snippet + transcript
 * - entity_triggered: any chunk whose source was the entity-stream
 */
export function assembleContext(params: {
  reranked: RetrievedChunk[];
  all_candidates: RetrievedChunk[];
  state: ConversationState;
  entities: string[];
  debug: RetrievedContext["debug"];
}): RetrievedContext {
  const { reranked, all_candidates, state, entities, debug } = params;

  const kb_facts: RetrievedChunk[] = [];
  const sops: RetrievedChunk[] = [];
  const tov_examples: RetrievedChunk[] = [];
  const similar_past_convos: RetrievedChunk[] = [];

  for (const c of reranked) {
    switch (c.content_type) {
      case "sop":
        sops.push(c);
        break;
      case "tov_example":
        tov_examples.push(c);
        break;
      case "chat_history":
      case "convo_snippet":
      case "transcript":
        similar_past_convos.push(c);
        break;
      case "glossary":
      case "product_doc":
      default:
        kb_facts.push(c);
    }
  }

  // Entity-triggered: pull from all_candidates where source == 'entity' and in reranked.
  const rerankedIds = new Set(reranked.map((c) => c.id));
  const entity_triggered = all_candidates
    .filter((c) => c.source === "entity" && rerankedIds.has(c.id))
    .slice(0, 5);

  return {
    state,
    entities,
    kb_facts,
    sops,
    tov_examples,
    similar_past_convos,
    entity_triggered,
    all_ranked: reranked,
    debug,
  };
}
