import { consola } from "consola";
import { trackState } from "./state-tracker";
import { extractEntities } from "./entity-extractor";
import {
  embedTrigger,
  entitySearch,
  hybridSearch,
  rrfMerge,
  vectorSearchMetadata,
} from "./hybrid-search";
import { llmRerank } from "./rerank";
import { assembleContext } from "./context-assembly";
import type { RetrievalInput, RetrievedContext } from "./types";

export async function retrieve(input: RetrievalInput): Promise<RetrievedContext> {
  const tTotal = Date.now();

  // Compose query text: trigger + most-recent prospect line for context.
  const recentHistory = input.history.slice(-4);
  const lastProspect = [...input.history].reverse().find((m) => m.role === "user")?.content ?? "";
  const queryText = `${input.trigger_message}${lastProspect ? "\n" + lastProspect : ""}`;

  const tState = Date.now();
  const [state, queryEmbedding] = await Promise.all([
    trackState(input.trigger_message, input.history),
    embedTrigger(queryText),
  ]);
  const dtState = Date.now() - tState;

  // Entities: regex/keyword first (cheap), union with LLM-extracted from state.
  const regexEntities = extractEntities(input.trigger_message, recentHistory);
  const allEntities = Array.from(
    new Set([...regexEntities, ...state.entities]),
  ).slice(0, 20);

  const tRetrieval = Date.now();
  const [hybridChunks, metadataChunks, entityChunks] = await Promise.all([
    hybridSearch({
      agent_id: input.agent_id,
      query_embedding: queryEmbedding,
      query_text: queryText,
      k: 20,
    }).catch((e) => {
      consola.warn("hybridSearch failed:", e);
      return [];
    }),
    vectorSearchMetadata({
      agent_id: input.agent_id,
      query_embedding: queryEmbedding,
      k: 15,
      filter: {
        // chunks with stage matching OR intent matching — do two filter queries
        // in parallel. Keep it simple for MVP: single filter on intent since
        // jsonb @> requires exact structure. Fall back to empty filter.
      },
    }).catch((e) => {
      consola.warn("vectorSearchMetadata failed:", e);
      return [];
    }),
    entitySearch({
      agent_id: input.agent_id,
      entities: allEntities,
      k: 10,
    }).catch((e) => {
      consola.warn("entitySearch failed:", e);
      return [];
    }),
  ]);
  const dtRetrieval = Date.now() - tRetrieval;

  const merged = rrfMerge([hybridChunks, metadataChunks, entityChunks], {
    k: 60,
    topN: 25,
  });

  const tRerank = Date.now();
  const reranked = await llmRerank({
    candidates: merged,
    trigger_message: input.trigger_message,
    history: input.history,
    state,
    topN: 10,
  });
  const dtRerank = Date.now() - tRerank;

  const assembled = assembleContext({
    reranked,
    all_candidates: merged,
    state,
    entities: allEntities,
    debug: {
      hybrid_count: hybridChunks.length,
      metadata_count: metadataChunks.length,
      entity_count: entityChunks.length,
      rerank_input: merged.length,
      rerank_output: reranked.length,
      latency_ms: {
        state: dtState,
        retrieval: dtRetrieval,
        rerank: dtRerank,
        total: Date.now() - tTotal,
      },
    },
  });

  return assembled;
}
