-- Expose `files` and `chunks` to Supabase Realtime so the UI can subscribe
-- to status transitions during processing.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'files'
  ) then
    alter publication supabase_realtime add table public.files;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chunks'
  ) then
    alter publication supabase_realtime add table public.chunks;
  end if;
end$$;
