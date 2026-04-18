-- Fix ambiguous column reference in claim_pending_file() — `id` clashes with
-- the function's return-table column name inside the UPDATE/subselect.

drop function if exists public.claim_pending_file();

create or replace function public.claim_pending_file()
returns table (
  file_id uuid,
  file_agent_id uuid,
  file_storage_path text,
  file_mime_type text,
  file_file_type text
)
language plpgsql security definer as $$
declare
  claimed uuid;
begin
  update public.files as f
  set status = 'extracting'
  where f.id = (
    select files.id from public.files
    where files.status = 'pending'
    order by files.uploaded_at asc
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
    f.storage_path,
    f.mime_type,
    f.file_type
  from public.files as f
  where f.id = claimed;
end
$$;

revoke all on function public.claim_pending_file() from public, anon, authenticated;
grant execute on function public.claim_pending_file() to service_role;
