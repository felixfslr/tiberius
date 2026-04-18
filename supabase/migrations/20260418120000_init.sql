-- Tiberius init migration: core tables, indexes, RLS, storage bucket.
-- Safe to apply repeatedly (idempotent via IF NOT EXISTS / CREATE OR REPLACE).

-- =====================================================================
-- Extensions
-- =====================================================================
create extension if not exists vector;
create extension if not exists pg_trgm;
-- gen_random_uuid() is a builtin in Postgres 13+ (no extension needed).

-- =====================================================================
-- Tables
-- =====================================================================

-- Agents (one per use case; e.g. "Ivy Sales Pre-Discovery")
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Files uploaded to an agent's knowledge base
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  file_type text not null default 'product_doc',   -- product_doc|sop|glossary|chat_history|tov_example|transcript
  status text not null default 'pending',          -- pending|extracting|chunking|enriching|embedding|ready|failed
  error text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists files_agent_idx on public.files (agent_id, uploaded_at desc);

-- Chunks (embedding unit, retrieved during reply generation)
create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references public.files(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  content text not null,
  content_type text not null default 'product_doc', -- matches files.file_type taxonomy
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,       -- { stage: string[], intent: string[], entities: string[], ... }
  position int not null default 0,
  edited_by_user boolean not null default false,
  created_at timestamptz not null default now(),
  fts tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored
);

create index if not exists chunks_agent_type_idx on public.chunks (agent_id, content_type);
create index if not exists chunks_fts_idx on public.chunks using gin (fts);
create index if not exists chunks_metadata_idx on public.chunks using gin (metadata jsonb_path_ops);
-- HNSW on embedding for ANN; cosine distance.
create index if not exists chunks_embedding_hnsw on public.chunks using hnsw (embedding vector_cosine_ops);

-- API keys (external callers use bearer tokens; hashed at rest)
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,  -- first 8 chars, shown in UI for identification
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists api_keys_hash_idx on public.api_keys (key_hash);
create index if not exists api_keys_agent_idx on public.api_keys (agent_id);

-- Past conversations (for retrieval of similar past conversations)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  external_id text,
  messages jsonb not null default '[]'::jsonb,     -- [{role, content, ts}]
  metadata jsonb not null default '{}'::jsonb,     -- { outcome, stage_path, intents }
  created_at timestamptz not null default now()
);

create index if not exists conversations_agent_idx on public.conversations (agent_id);

-- Reply logs (every generated draft — for eval + debug)
create table if not exists public.reply_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  trigger_message text not null,
  history jsonb not null default '[]'::jsonb,
  retrieved_chunk_ids uuid[] not null default '{}',
  draft text,
  confidence numeric(4,3),
  detected_intent text,
  suggested_tool text,
  tool_args jsonb,
  reasoning text,
  confidence_breakdown jsonb,      -- { retrieval, intent, groundedness, consistency }
  debug jsonb,                      -- raw prompt, per-stream scores, model id, latency
  created_at timestamptz not null default now()
);

create index if not exists reply_logs_agent_idx on public.reply_logs (agent_id, created_at desc);

-- =====================================================================
-- Updated-at trigger for agents
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agents_set_updated_at on public.agents;
create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Row Level Security
-- Single-workspace hackathon model: any authenticated user can do anything.
-- Service role bypasses RLS automatically (used by worker + server admin).
-- =====================================================================
alter table public.agents enable row level security;
alter table public.files enable row level security;
alter table public.chunks enable row level security;
alter table public.api_keys enable row level security;
alter table public.conversations enable row level security;
alter table public.reply_logs enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array['agents','files','chunks','api_keys','conversations','reply_logs'])
  loop
    execute format(
      'drop policy if exists "authenticated full access" on public.%I',
      t
    );
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end$$;

-- =====================================================================
-- Storage bucket for uploaded knowledge files
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('knowledge', 'knowledge', false)
on conflict (id) do nothing;

-- Authenticated users can read/write objects in the knowledge bucket.
-- Service role bypasses these automatically.
drop policy if exists "knowledge authenticated read" on storage.objects;
create policy "knowledge authenticated read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'knowledge');

drop policy if exists "knowledge authenticated write" on storage.objects;
create policy "knowledge authenticated write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'knowledge');

drop policy if exists "knowledge authenticated update" on storage.objects;
create policy "knowledge authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'knowledge')
  with check (bucket_id = 'knowledge');

drop policy if exists "knowledge authenticated delete" on storage.objects;
create policy "knowledge authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'knowledge');
