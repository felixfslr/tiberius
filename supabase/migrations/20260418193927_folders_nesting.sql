-- Nested folders: self-referential parent_id
alter table public.folders
  add column if not exists parent_id uuid references public.folders(id) on delete cascade;

create index if not exists folders_parent_idx on public.folders (parent_id);
