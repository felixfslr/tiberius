-- Phase R1: Reactive Knowledge Editing.
-- Adds feedback table + claim RPCs (analogous to claim_pending_file) and
-- patches retrieval RPCs to exclude soft-deprecated chunks.

-- ========================================================
-- 1. feedback table
-- ========================================================
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  reply_log_id uuid references public.reply_logs(id) on delete set null,
  feedback_text text not null,
  retrieved_chunk_ids uuid[] not null default '{}',
  draft_reply text,
  trigger_message text,
  status text not null default 'pending'
    check (status in ('pending','analyzing','analyzed','applying','applied','dismissed','failed')),
  suggested_action jsonb,
  error text,
  applied_chunk_id uuid references public.chunks(id) on delete set null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  analyzed_at timestamptz,
  processed_at timestamptz
);

create index feedback_agent_status_idx
  on public.feedback (agent_id, status, created_at desc);

create index feedback_pending_idx
  on public.feedback (status, created_at)
  where status in ('pending','applying');

alter table public.feedback enable row level security;

create policy "authenticated full access" on public.feedback
  for all to authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback'
  ) then
    alter publication supabase_realtime add table public.feedback;
  end if;
end$$;

-- ========================================================
-- 2. Queue RPCs for feedback (analogous to claim_pending_file)
-- ========================================================

create or replace function public.claim_pending_feedback()
returns table (
  fb_id uuid,
  fb_agent_id uuid,
  fb_feedback_text text,
  fb_retrieved_chunk_ids uuid[],
  fb_draft_reply text,
  fb_trigger_message text
)
language plpgsql security definer as $$
declare
  claimed uuid;
begin
  update public.feedback as f
  set status = 'analyzing', locked_at = now()
  where f.id = (
    select feedback.id from public.feedback
    where feedback.status = 'pending'
    order by feedback.created_at asc
    for update skip locked
    limit 1
  )
  returning f.id into claimed;

  if claimed is null then
    return;
  end if;

  return query
  select
    f.id,
    f.agent_id,
    f.feedback_text,
    f.retrieved_chunk_ids,
    f.draft_reply,
    f.trigger_message
  from public.feedback as f
  where f.id = claimed;
end
$$;

revoke all on function public.claim_pending_feedback() from public, anon, authenticated;
grant execute on function public.claim_pending_feedback() to service_role;

create or replace function public.claim_applying_feedback()
returns table (
  fb_id uuid,
  fb_agent_id uuid,
  fb_suggested_action jsonb
)
language plpgsql security definer as $$
declare
  claimed uuid;
begin
  -- Reclaim stuck rows after 2 minutes (worker crash recovery).
  update public.feedback as f
  set locked_at = now()
  where f.id = (
    select feedback.id from public.feedback
    where feedback.status = 'applying'
      and (feedback.locked_at is null or feedback.locked_at < now() - interval '2 minutes')
    order by feedback.created_at asc
    for update skip locked
    limit 1
  )
  returning f.id into claimed;

  if claimed is null then
    return;
  end if;

  return query
  select f.id, f.agent_id, f.suggested_action
  from public.feedback as f
  where f.id = claimed;
end
$$;

revoke all on function public.claim_applying_feedback() from public, anon, authenticated;
grant execute on function public.claim_applying_feedback() to service_role;

-- ========================================================
-- 3. Patch retrieval RPCs to exclude soft-deprecated chunks
--    (metadata.deprecated = 'true')
-- ========================================================

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
    and (c.metadata->>'deprecated') is distinct from 'true'
    and (p_content_types is null or c.content_type = any(p_content_types))
    and (p_filter = '{}'::jsonb or c.metadata @> p_filter)
  order by c.embedding <=> p_embedding
  limit p_k
$$;

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
    and (c.metadata->>'deprecated') is distinct from 'true'
    and (p_content_types is null or c.content_type = any(p_content_types))
    and (p_filter = '{}'::jsonb or c.metadata @> p_filter)
  order by rank desc
  limit p_k
$$;

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
where (c.metadata->>'deprecated') is distinct from 'true'
order by fused.score desc
limit p_k
$$;
