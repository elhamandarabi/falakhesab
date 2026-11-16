-- =====================================================================
--  Falak.io — UNDO Step 3 (puts the access rules back exactly as before)
--  Only use this if something stops working after Step 3.
--  Supabase → SQL Editor → New query → paste → Run
-- =====================================================================
drop trigger if exists falak_guard_member   on public.members;
drop trigger if exists falak_guard_record   on public.records;
drop trigger if exists falak_guard_business on public.businesses;
drop function if exists public.falak_guard_member();
drop function if exists public.falak_guard_record();
drop function if exists public.falak_guard_business();

drop policy if exists mem_insert on public.members;
drop policy if exists mem_update on public.members;
drop policy if exists mem_delete on public.members;
create policy mem_insert on public.members for insert with check (public.falak_role(business_id) in ('owner','admin'));
create policy mem_update on public.members for update using (public.falak_role(business_id) in ('owner','admin'));
create policy mem_delete on public.members for delete using (public.falak_role(business_id) in ('owner','admin'));

drop policy if exists rec_select on public.records;
create policy rec_select on public.records for select using (public.falak_role(business_id) is not null);
drop function if exists public.falak_can_see_type(uuid, text);

-- Done. You should see "Success. No rows returned".
