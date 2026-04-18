-- Phase G1: RPC functions that feed the knowledge-graph endpoint.
-- - graph_neighbors: top-K nearest neighbors per chunk via pgvector cosine.
-- - co_retrieval_edges: chunk-chunk co-occurrence in reply_logs.retrieved_chunk_ids.

-- Top-K nearest neighbors for every chunk of an agent.
-- Returns one row per (chunk, neighbor) pair, similarity = 1 - cosine_distance.
create or replace function public.graph_neighbors(
  p_agent_id uuid,
  p_k int default 5
)
returns table (
  source_id uuid,
  target_id uuid,
  similarity double precision
)
language sql stable as $$
  with base as (
    select id, embedding
    from public.chunks
    where agent_id = p_agent_id
      and embedding is not null
      and (metadata->>'deprecated') is distinct from 'true'
  )
  select
    b.id as source_id,
    n.id as target_id,
    (1 - (b.embedding <=> n.embedding))::double precision as similarity
  from base b
  cross join lateral (
    select c.id, c.embedding
    from base c
    where c.id <> b.id
    order by b.embedding <=> c.embedding
    limit p_k
  ) n;
$$;

-- Chunk-chunk co-retrieval weights aggregated across reply_logs.
-- Only pairs with weight >= 1 are returned. Pairs are canonicalized (a < b).
create or replace function public.co_retrieval_edges(p_agent_id uuid)
returns table (
  a uuid,
  b uuid,
  weight int
)
language sql stable as $$
  with expanded as (
    select distinct rl.id as log_id, cid
    from public.reply_logs rl,
      lateral unnest(rl.retrieved_chunk_ids) as cid
    where rl.agent_id = p_agent_id
      and rl.retrieved_chunk_ids is not null
      and cardinality(rl.retrieved_chunk_ids) > 1
  ),
  pairs as (
    select
      least(x.cid, y.cid) as a,
      greatest(x.cid, y.cid) as b
    from expanded x
    join expanded y on x.log_id = y.log_id and x.cid < y.cid
  )
  select a, b, count(*)::int as weight
  from pairs
  group by a, b;
$$;

-- Retrieval-count per chunk (used for node-size on the graph).
create or replace function public.chunk_retrieval_counts(p_agent_id uuid)
returns table (
  chunk_id uuid,
  retrieval_count int
)
language sql stable as $$
  select cid as chunk_id, count(*)::int as retrieval_count
  from public.reply_logs rl,
    lateral unnest(rl.retrieved_chunk_ids) as cid
  where rl.agent_id = p_agent_id
  group by cid;
$$;
