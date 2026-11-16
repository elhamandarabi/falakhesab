-- =====================================================================
--  Falak Hesab — Step 12 (SEC-1): non-members must never pass a plan check
--  Run in Supabase (project falak-io) → SQL Editor → New query → paste ALL → Run
--  Changes 2 functions that are installed today (Step 7):
--    falak_choose_free(uuid)        — owner only
--    falak_request_plan(uuid, text) — owner or administrator
--  The only change in each: one new first line that refuses a caller who has
--  no role in that business. Everything else is byte-for-byte the same.
--  Signatures, SECURITY DEFINER, search_path, owner and EXECUTE grants are
--  kept: CREATE OR REPLACE keeps the existing grants, and this file has no
--  GRANT or REVOKE.
--  Safety: the guard below stops WITHOUT changing anything if the installed
--  function is not the exact version that was reviewed (original or already
--  patched). Safe to run twice.
--  Undo: step12-sec1-undo.sql (WARNING: undo reopens the vulnerability).
-- =====================================================================
begin;

do $$
declare got text;
begin
  select md5(replace(prosrc, E'\r', '')) into got from pg_proc where oid = 'public.falak_choose_free(uuid)'::regprocedure;
  if got not in ('26bb845232a954ab6e408659f96a7b2a', 'dd5deef7bce29b49f4b1db4323a73b7f') then
    raise exception 'STOP: falak_choose_free is not the reviewed version (md5 %). Nothing was changed.', got;
  end if;
  select md5(replace(prosrc, E'\r', '')) into got from pg_proc where oid = 'public.falak_request_plan(uuid, text)'::regprocedure;
  if got not in ('5ecdd39d973ef6cf95a6edc28c1dbaa4', '4106df4ae4d383204d2ed51524c948a5') then
    raise exception 'STOP: falak_request_plan is not the reviewed version (md5 %). Nothing was changed.', got;
  end if;
end $$;

-- choose the Free plan (only if the business fits in it)
create or replace function public.falak_choose_free(bid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare lim int;
begin
  if public.falak_role(bid) is null then raise exception 'Only the owner can change the plan.'; end if;   -- SEC-1: not a member of this business
  if public.falak_role(bid) <> 'owner' then raise exception 'Only the owner can change the plan.'; end if;
  select coalesce((value->'free'->>'users')::int, 1) into lim from public.app_config where key = 'plans';
  if lim > 0 and (select count(*) from public.members where business_id = bid) > lim then
    raise exception 'PLAN_USERS: The Free plan allows % user(s). Remove the other users first.', lim;
  end if;
  insert into public.subscriptions (business_id, plan) values (bid, 'free') on conflict (business_id) do nothing;
  update public.subscriptions set plan = 'free', complimentary = false, requested_plan = null, requested_at = null,
         note = 'Owner chose Free', updated_at = now() where business_id = bid;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='slug') then
    execute 'update public.businesses set slug = null where id = $1 and slug is not null' using bid;
  end if;
end $$;

-- ask for Basic or Pro (you see the request in Admin and switch it on after payment)
create or replace function public.falak_request_plan(bid uuid, p text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.falak_role(bid) is null then raise exception 'Only the owner or an administrator can ask for a plan.'; end if;   -- SEC-1: not a member of this business
  if public.falak_role(bid) not in ('owner','admin') then raise exception 'Only the owner or an administrator can ask for a plan.'; end if;
  if p not in ('basic','pro') then raise exception 'Unknown plan'; end if;
  update public.subscriptions set requested_plan = p, requested_at = now(), updated_at = now() where business_id = bid;
end $$;

commit;

-- Check (read-only): both rows should say patched = true
select p.oid::regprocedure as function, position('is null then raise' in p.prosrc) > 0 as patched,
       md5(replace(p.prosrc, E'\r', '')) as body_md5, p.prosecdef as security_definer, p.proconfig as settings
from pg_proc p where p.oid in ('public.falak_choose_free(uuid)'::regprocedure, 'public.falak_request_plan(uuid, text)'::regprocedure);
