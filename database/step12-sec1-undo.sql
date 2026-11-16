-- =====================================================================
--  Falak Hesab — UNDO Step 12 (SEC-1)
--  WARNING: this puts back the ORIGINAL definitions, which REOPEN SEC-1:
--  anyone who knows a business ID (signed in, and signed out too if 'anon' can
--  execute these functions) can again switch a one-user business to Free,
--  delete its company address, and set its requested plan.
--  Use only if Step 12 breaks a legitimate action, and re-apply a fix quickly.
--  Grants are not touched (CREATE OR REPLACE keeps them).
-- =====================================================================
begin;

do $$
declare got text;
begin
  select md5(replace(prosrc, E'\r', '')) into got from pg_proc where oid = 'public.falak_choose_free(uuid)'::regprocedure;
  if got not in ('dd5deef7bce29b49f4b1db4323a73b7f', '26bb845232a954ab6e408659f96a7b2a') then
    raise exception 'STOP: falak_choose_free is not the Step 12 version (md5 %). Nothing was changed.', got;
  end if;
  select md5(replace(prosrc, E'\r', '')) into got from pg_proc where oid = 'public.falak_request_plan(uuid, text)'::regprocedure;
  if got not in ('4106df4ae4d383204d2ed51524c948a5', '5ecdd39d973ef6cf95a6edc28c1dbaa4') then
    raise exception 'STOP: falak_request_plan is not the Step 12 version (md5 %). Nothing was changed.', got;
  end if;
end $$;

create or replace function public.falak_choose_free(bid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare lim int;
begin
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
  if public.falak_role(bid) not in ('owner','admin') then raise exception 'Only the owner or an administrator can ask for a plan.'; end if;
  if p not in ('basic','pro') then raise exception 'Unknown plan'; end if;
  update public.subscriptions set requested_plan = p, requested_at = now(), updated_at = now() where business_id = bid;
end $$;

commit;
