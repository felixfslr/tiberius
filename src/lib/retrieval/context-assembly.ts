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

  const rerankedIds = new Set(reranked.map((c) => c.id));

  // SOP floor: guarantee at least 2 SOP chunks reach the prompt if they exist in the
  // candidate pool. The rerank LLM tends to favour chat_history for situational queries,
  // which starves the <sops> slot even when relevant rules were retrieved.
  const SOP_FLOOR = 2;
  if (sops.length < SOP_FLOOR) {
    const needed = SOP_FLOOR - sops.length;
    const extras = all_candidates
      .filter((c) => c.content_type === "sop" && !rerankedIds.has(c.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, needed);
    for (const e of extras) {
      sops.push(e);
      rerankedIds.add(e.id);
    }
  }

  // Entity-triggered: pull from all_candidates where source == 'entity' and in reranked.
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
