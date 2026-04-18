-- Hybrid search functions for retrieval pipeline (Phase 3).
-- Combines vector similarity + FTS with Reciprocal Rank Fusion (RRF).

-- =====================================================================
-- Pure vector search (cosine). Metadata filter via jsonb @> operator.
-- =====================================================================
create or replace function public.search_chunks_vector(
  p_agent_id uuid,
  p_embedding vector(1536),
  p_k int default 20,
  p_filter jsonb default '{}'::jsonb,
  p_content_types text[] default null
)
returns table (
  id uuid,
  file_id uuid,
  content text,
  content_type text,
  metadata jsonb,
  distance double precision
)
language sql stable as $$
  select
    c.id,
    c.file_id,
    c.content,
    c.content_type,
    c.metadata,
    (c.embedding <=> p_embedding)::double precision as distance
  from public.chunks c
  where c.agent_id = p_agent_id
    and c.embedding is not null
    and (p_content_types is null or c.content_type = any(p_content_types))
    and (p_filter = '{}'::jsonb or c.metadata @> p_filter)
  order by c.embedding <=> p_embedding
  limit p_k
$$;

-- =====================================================================
-- Full-text search via websearch_to_tsquery.
-- =====================================================================
create or replace function public.search_chunks_fts(
  p_agent_id uuid,
  p_query text,
  p_k int default 20,
  p_filter jsonb default '{}'::jsonb,
  p_content_types text[] default null
)
returns table (
  id uuid,
  file_id uuid,
  content text,
  content_type text,
  metadata jsonb,
  rank real
)
language sql stable as $$
  select
    c.id,
    c.file_id,
    c.content,
    c.content_type,
    c.metadata,
    ts_rank_cd(c.fts, websearch_to_tsquery('english', p_query)) as rank
  from public.chunks c
  where c.agent_id = p_agent_id
    and c.fts @@ websearch_to_tsquery('english', p_query)
    and (p_content_types is null or c.content_type = any(p_content_types))
    and (p_filter = '{}'::jsonb or c.metadata @> p_filter)
  order by rank desc
  limit p_k
$$;

-- =====================================================================
-- Hybrid: RRF fusion of vector + FTS.
-- Returns top-K chunks with fused score. RRF constant = 60 (standard).
-- =====================================================================
create or replace function public.hybrid_search(
  p_agent_id uuid,
  p_embedding vector(1536),
  p_query text,
  p_k int default 20,
  p_filter jsonb default '{}'::jsonb,
  p_content_types text[] default null,
  p_rrf_k int default 60
)
returns table (
  id uuid,
  file_id uuid,
  content text,
  content_type text,
  metadata jsonb,
  vector_rank int,
  fts_rank int,
  score double precision
)
language sql stable as $$
with
  vec as (
    select id, row_number() over () as r
    from public.search_chunks_vector(p_agent_id, p_embedding, p_k * 2, p_filter, p_content_types)
  ),
  fts as (
    select id, row_number() over () as r
    from public.search_chunks_fts(p_agent_id, p_query, p_k * 2, p_filter, p_content_types)
  ),
  fused as (
    select coalesce(v.id, f.id) as id,
           v.r as vector_rank,
           f.r as fts_rank,
           coalesce(1.0 / (p_rrf_k + v.r), 0) + coalesce(1.0 / (p_rrf_k + f.r), 0) as score
    from vec v
    full outer join fts f using (id)
  )
select
  c.id,
  c.file_id,
  c.content,
  c.content_type,
  c.metadata,
  fused.vector_rank::int,
  fused.fts_rank::int,
  fused.score
from fused
join public.chunks c on c.id = fused.id
order by fused.score desc
limit p_k
$$;
