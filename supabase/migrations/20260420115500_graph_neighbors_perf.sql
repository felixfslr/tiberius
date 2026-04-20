-- Performance fix for graph_neighbors.
-- Before: materialized a CTE of all agent chunks then ran a cross-join lateral
-- k-NN sort. For an agent with ~7.8k chunks this was ~60M exact-distance scans
-- per render and blew statement_timeout on /app/agents/:id/knowledge.
--
-- After:
--   1. Query public.chunks directly so the planner can pick
--      chunks_embedding_hnsw for the lateral k-NN.
--   2. Set hnsw.iterative_scan = 'relaxed_order' (pgvector 0.8+) so the
--      agent_id filter works alongside the HNSW approximate scan.
--      Requires the function to be VOLATILE — SET LOCAL is not allowed in
--      STABLE functions.
--   3. Cap the driver set at p_max_nodes (default 500). The graph UI can't
--      meaningfully render more than a few hundred nodes anyway, and 500
--      keeps the total runtime under ~5s even for very large agents.

drop function if exists public.graph_neighbors(uuid, int);
drop function if exists public.graph_neighbors(uuid, int, int);

create or replace function public.graph_neighbors(
  p_agent_id uuid,
  p_k int default 5,
  p_max_nodes int default 500
)
returns table (
  source_id uuid,
  target_id uuid,
  similarity double precision
)
language plpgsql volatile as $$
begin
  set local hnsw.iterative_scan = 'relaxed_order';
  return query
  with driver as (
    select id, embedding
    from public.chunks
    where agent_id = p_agent_id
      and embedding is not null
      and (metadata->>'deprecated') is distinct from 'true'
    order by created_at desc
    limit p_max_nodes
  )
  select
    d.id as source_id,
    n.id as target_id,
    (1 - (d.embedding <=> n.embedding))::double precision as similarity
  from driver d
  cross join lateral (
    select c.id, c.embedding
    from public.chunks c
    where c.agent_id = p_agent_id
      and c.id <> d.id
      and c.embedding is not null
      and (c.metadata->>'deprecated') is distinct from 'true'
    order by c.embedding <=> d.embedding
    limit p_k
  ) n;
end;
$$;
