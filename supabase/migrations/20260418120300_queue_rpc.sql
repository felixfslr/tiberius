-- Postgres-native job queue for file processing.
-- Replaces pg-boss: the worker calls `claim_pending_file()` in a loop.
-- Uses FOR UPDATE SKIP LOCKED so multiple workers can coexist safely.

create or replace function public.claim_pending_file()
returns table (
  id uuid,
  agent_id uuid,
  storage_path text,
  mime_type text,
  file_type text
)
language plpgsql security definer as $$
declare
  claimed uuid;
begin
  -- Atomically grab one pending file and flip its status.
  update public.files f
  set status = 'extracting'
  where f.id = (
    select id from public.files
    where status = 'pending'
    order by uploaded_at asc
    for update skip locked
    limit 1
  )
  returning f.id into claimed;

  if claimed is null then
    return;
  end if;

  return query
  select f.id, f.agent_id, f.storage_path, f.mime_type, f.file_type
  from public.files f
  where f.id = claimed;
end
$$;

revoke all on function public.claim_pending_file() from public, anon, authenticated;
grant execute on function public.claim_pending_file() to service_role;
