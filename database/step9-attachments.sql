-- =====================================================================
--  Falak Hesab — Step 9: attachments (photos and PDFs on transactions)
--  Supabase (project falak-io) → SQL Editor → New query → paste ALL → Run
--
--  Creates a PRIVATE file store "attachments". Files are stored as
--  <business id>/<record id>/<file>. Only people who can see a record can
--  open its files, and only people who can change it can add or delete files.
--  Max 10 MB per file; photos, PDF, Word, Excel, CSV and text only.
--  Changes no accounting data. Safe to run more than once. Undo: step9-undo.sql
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
  'application/pdf','text/plain','text/csv',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- who may read / add / delete a file, decided from the record it belongs to
create or replace function public.falak_att_ok(obj text, act text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare parts text[]; bid uuid; rid uuid; t text;
begin
  parts := string_to_array(obj, '/');
  if coalesce(array_length(parts, 1), 0) <> 3 then return false; end if;
  begin
    bid := parts[1]::uuid; rid := parts[2]::uuid;
  exception when others then return false;
  end;
  if public.falak_role(bid) is null then return false; end if;
  if exists (select 1 from pg_proc where proname = 'falak_mfa_ok') then
    if not public.falak_mfa_ok() then return false; end if;
  end if;
  select r.type into t from public.records r where r.id = rid and r.business_id = bid;
  if act = 'read' then
    if t is null then return public.falak_role(bid) in ('owner','admin'); end if;
    return public.falak_can_see_type(bid, t);
  elsif act = 'write' then
    if t is null then return false; end if;
    return public.falak_can_write(bid, t)
       and (not exists (select 1 from pg_proc where proname = 'falak_plan_allows') or public.falak_plan_allows(bid, 'write'));
  elsif act = 'delete' then
    if t is null then return public.falak_role(bid) in ('owner','admin'); end if;   -- the record was deleted: clean up
    return public.falak_can_write(bid, t)
       and (not exists (select 1 from pg_proc where proname = 'falak_plan_allows') or public.falak_plan_allows(bid, 'write'));
  end if;
  return false;
end $$;
revoke all on function public.falak_att_ok(text, text) from public;
grant execute on function public.falak_att_ok(text, text) to authenticated;

drop policy if exists falak_att_select on storage.objects;
create policy falak_att_select on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.falak_att_ok(name, 'read'));

drop policy if exists falak_att_insert on storage.objects;
create policy falak_att_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.falak_att_ok(name, 'write'));

drop policy if exists falak_att_delete on storage.objects;
create policy falak_att_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.falak_att_ok(name, 'delete'));

notify pgrst, 'reload schema';

-- Done. You should see "Success. No rows returned".
