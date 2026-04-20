-- Performance fix for graph_neighbors.
-- Before: materialized a CTE of all agent chunks then ran a cross-join lateral
-- k-NN sort. For agents with thousands of chunks this was O(N²) exact-distance
-- scans per page load and blew past statement_timeout on /app/agents/:id/knowledge.
--
-- After:
--   1. Query public.chunks directly in both the driver and the lateral so the
--      planner can pick the chunks_embedding_hnsw index for the inner sort.
--   2. Add p_max_nodes cap (default 2500) so the graph stays responsive even
--      for agents with very large knowledge bases. The caller can pass a
--      smaller value to budget more aggressively.

drop function if exists public.graph_neighbors(uuid, int);

create or replace function public.graph_neighbors(
  p_agent_id uuid,
  p_k int default 5,
  p_max_nodes int default 2500
)
returns table (
  source_id uuid,
  target_id uuid,
  similarity double precision
)
language sql stable as $$
  with base as (
    select id
    from public.chunks
    where agent_id = p_agent_id
      and embedding is not null
      and (metadata->>'deprecated') is distinct from 'true'
    order by created_at desc
    limit p_max_nodes
  ),
  driver as (
    select c.id, c.embedding
    from public.chunks c
    join base b on b.id = c.id
  )
  select
    d.id as source_id,
    n.id as target_id,
    (1 - (d.embedding <=> n.embedding))::double precision as similarity
  from driver d
  cross join lateral (
    select c2.id, c2.embedding
    from public.chunks c2
    join base b2 on b2.id = c2.id
    where c2.id <> d.id
    order by d.embedding <=> c2.embedding
    limit p_k
  ) n;
$$;
