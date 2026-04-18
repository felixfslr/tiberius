-- Knowledge-base folders (flat, per agent) to let users sort files
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists folders_agent_idx on public.folders (agent_id, name);

alter table public.files
  add column if not exists folder_id uuid references public.folders(id) on delete set null;

create index if not exists files_folder_idx on public.files (folder_id);

alter table public.folders enable row level security;

drop policy if exists "authenticated full access" on public.folders;
create policy "authenticated full access" on public.folders
  for all to authenticated using (true) with check (true);
