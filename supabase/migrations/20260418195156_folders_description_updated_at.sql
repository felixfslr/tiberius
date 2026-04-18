-- Folder metadata for the knowledge-base UI
alter table public.folders
  add column if not exists description text;

alter table public.folders
  add column if not exists updated_at timestamptz not null default now();

-- Keep updated_at fresh on updates. Use an inline trigger so the service layer
-- doesn't have to remember to set it on every PATCH.
create or replace function public.folders_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists folders_touch_updated_at on public.folders;
create trigger folders_touch_updated_at
  before update on public.folders
  for each row
  execute function public.folders_touch_updated_at();
