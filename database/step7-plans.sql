-- =====================================================================
--  Falak.io — Step 7: plans, 30-day free trial, limits, manual payments
--  Supabase (project falak-io) → SQL Editor → New query → paste ALL → Run
--  Then run:  notify pgrst, 'reload schema';
--
--  Changes no accounting data. Every business that ALREADY exists gets the
--  Pro plan for free ("complimentary") so nothing changes for them today.
--  You can change any business later in Admin → Plans & payments.
--  New businesses get a 30-day Pro trial (one trial per owner).
--  Safe to run more than once. To undo: step7-undo.sql
-- =====================================================================

-- ---------- plan prices and limits (only the super admin can change) ----------
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_config (key, value) values
  ('plans', '{
     "free":  {"users": 1, "usd": 0,  "try": 0},
     "basic": {"users": 3, "usd": 9,  "try": 299},
     "pro":   {"users": 0, "usd": 19, "try": 649},
     "trialDays": 30
   }'::jsonb),
  ('billing', '{"instructions": "Pay by bank transfer or in cash, then send the receipt on WhatsApp. We switch on your plan the same day."}'::jsonb)
on conflict (key) do nothing;

-- ---------- one subscription row per business ----------
create table if not exists public.subscriptions (
  business_id    uuid primary key references public.businesses(id) on delete cascade,
  plan           text not null default 'pro' check (plan in ('free','basic','pro')),
  trial_ends     timestamptz,
  paid_until     date,
  complimentary  boolean not null default false,
  requested_plan text check (requested_plan in ('basic','pro')),
  requested_at   timestamptz,
  note           text,
  updated_at     timestamptz not null default now()
);

-- ---------- payments you record by hand ----------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan        text not null check (plan in ('basic','pro')),
  months      int  not null check (months between 1 and 36),
  amount      numeric,
  currency    text,
  note        text,
  paid_from   date not null,
  paid_until  date not null,
  created_at  timestamptz not null default now(),
  created_by  text
);
create index if not exists payments_business on public.payments (business_id, created_at desc);

-- who already used a free trial (kept even if that business is deleted)
create table if not exists public.trial_log (
  owner       uuid primary key,
  business_id uuid,
  started_at  timestamptz not null default now()
);
insert into public.trial_log (owner, business_id)
select distinct on (b.owner) b.owner, b.id from public.businesses b order by b.owner, b.created_at
on conflict (owner) do nothing;

-- existing businesses: Pro, complimentary (nothing changes for them)
insert into public.subscriptions (business_id, plan, complimentary, note)
select b.id, 'pro', true, 'Existing before plans started'
from public.businesses b
on conflict (business_id) do nothing;

-- ---------- the current state of a business ----------
-- state: 'active' | 'trial' | 'expired'
create or replace function public.falak_plan_state(bid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.subscriptions; cfg jsonb; st text; eff text; lim int;
begin
  if public.falak_role(bid) is null then return null; end if;
  select * into s from public.subscriptions where business_id = bid;
  select value into cfg from public.app_config where key = 'plans';
  if s.business_id is null then
    st := 'active'; eff := 'pro';                      -- no row: never block
  elsif s.complimentary or s.plan = 'free' or (s.paid_until is not null and s.paid_until >= current_date) then
    st := 'active'; eff := s.plan;
  elsif s.trial_ends is not null and s.trial_ends > now() then
    st := 'trial'; eff := 'pro';
  else
    st := 'expired'; eff := s.plan;
  end if;
  lim := coalesce((cfg->eff->>'users')::int, 0);
  return jsonb_build_object(
    'plan', coalesce(s.plan, 'pro'), 'effective', eff, 'state', st,
    'trial_ends', s.trial_ends, 'paid_until', s.paid_until, 'complimentary', coalesce(s.complimentary, false),
    'requested_plan', s.requested_plan, 'requested_at', s.requested_at,
    'users_limit', lim,
    'users', (select count(*) from public.members m where m.business_id = bid),
    'super', public.falak_is_super());
end $$;
revoke all on function public.falak_plan_state(uuid) from public;
grant execute on function public.falak_plan_state(uuid) to authenticated;

-- internal: may this business be changed right now, and does it have Pro / Basic features?
create or replace function public.falak_plan_allows(bid uuid, what text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s public.subscriptions; st text; eff text;
begin
  if public.falak_is_super() then return true; end if;
  select * into s from public.subscriptions where business_id = bid;
  if s.business_id is null then return true; end if;
  if s.complimentary or s.plan = 'free' or (s.paid_until is not null and s.paid_until >= current_date) then
    st := 'active'; eff := s.plan;
  elsif s.trial_ends is not null and s.trial_ends > now() then
    st := 'trial'; eff := 'pro';
  else
    st := 'expired'; eff := s.plan;
  end if;
  if what = 'write'   then return st <> 'expired'; end if;
  if what = 'pro'     then return st <> 'expired' and eff = 'pro'; end if;
  if what = 'address' then return st <> 'expired' and eff in ('basic','pro'); end if;
  return false;
end $$;
revoke all on function public.falak_plan_allows(uuid, text) from public;

-- ---------- new businesses: 30-day Pro trial (one per owner) ----------
create or replace function public.falak_on_business_plan() returns trigger
language plpgsql security definer set search_path = public as $$
declare days int; had_trial boolean;
begin
  if public.falak_is_super() then
    insert into public.subscriptions (business_id, plan, complimentary, note)
    values (new.id, 'pro', true, 'Super admin business') on conflict do nothing;
    return new;
  end if;
  select coalesce((value->>'trialDays')::int, 30) into days from public.app_config where key = 'plans';
  select exists (select 1 from public.trial_log t where t.owner = new.owner) into had_trial;
  if had_trial then
    insert into public.subscriptions (business_id, plan, note)
    values (new.id, 'free', 'Second business of the same owner: starts on Free') on conflict do nothing;
  else
    insert into public.subscriptions (business_id, plan, trial_ends)
    values (new.id, 'pro', now() + make_interval(days => coalesce(days, 30))) on conflict do nothing;
    insert into public.trial_log (owner, business_id) values (new.owner, new.id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists falak_business_plan on public.businesses;
create trigger falak_business_plan after insert on public.businesses
  for each row execute function public.falak_on_business_plan();

-- ---------- limits enforced by the database ----------
-- 1) books are read-only after the trial / paid period ends; Pro-only modules
create or replace function public.falak_check_plan_record() returns trigger
language plpgsql security definer set search_path = public as $$
declare bid uuid := coalesce(new.business_id, old.business_id); t text := coalesce(new.type, old.type);
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.businesses where id = old.business_id) then
    return old;                                                     -- business being deleted
  end if;
  if not public.falak_plan_allows(bid, 'write') then
    raise exception 'PLAN_EXPIRED: Your plan has ended. The books are read-only until the owner chooses a plan.';
  end if;
  if t in ('ticket','exchange','hawala','fxrate','cashcount') and tg_op <> 'DELETE'
     and not public.falak_plan_allows(bid, 'pro') then
    raise exception 'PLAN_PRO: This part (Travel / Exchange & Transfers) is included in the Pro plan.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists falak_check_plan_record on public.records;
create trigger falak_check_plan_record before insert or update or delete on public.records
  for each row execute function public.falak_check_plan_record();

-- 2) number of users
create or replace function public.falak_check_plan_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare st jsonb; lim int; n int; s public.subscriptions; eff text; cfg jsonb;
begin
  if public.falak_is_super() then return new; end if;
  if new.role = 'owner' and not exists (select 1 from public.members where business_id = new.business_id) then
    return new;                                                     -- the creator of a new business
  end if;
  if not public.falak_plan_allows(new.business_id, 'write') then
    raise exception 'PLAN_EXPIRED: Your plan has ended. Choose a plan before adding users.';
  end if;
  select * into s from public.subscriptions where business_id = new.business_id;
  if s.business_id is null then return new; end if;
  eff := case when not s.complimentary and s.plan <> 'free' and (s.paid_until is null or s.paid_until < current_date)
                   and s.trial_ends is not null and s.trial_ends > now() then 'pro' else s.plan end;
  select value into cfg from public.app_config where key = 'plans';
  lim := coalesce((cfg->eff->>'users')::int, 0);
  select count(*) into n from public.members where business_id = new.business_id;
  if lim > 0 and n + 1 > lim then
    raise exception 'PLAN_USERS: Your plan allows % user(s). Upgrade to add more.', lim;
  end if;
  return new;
end $$;
drop trigger if exists falak_check_plan_member on public.members;
create trigger falak_check_plan_member before insert on public.members
  for each row execute function public.falak_check_plan_member();

-- 3) company address only on Basic / Pro / trial (only checked when the slug column exists)
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='slug') then
    execute $f$
      create or replace function public.falak_check_plan_slug() returns trigger
      language plpgsql security definer set search_path = public as $g$
      begin
        if new.slug is not null and new.slug is distinct from old.slug
           and not public.falak_plan_allows(new.id, 'address') then
          raise exception 'PLAN_ADDRESS: A company address is included in the Basic and Pro plans.';
        end if;
        return new;
      end $g$ $f$;
    execute 'drop trigger if exists falak_check_plan_slug on public.businesses';
    execute 'create trigger falak_check_plan_slug before update on public.businesses for each row execute function public.falak_check_plan_slug()';
  end if;
end $$;

-- ---------- what owners can do themselves ----------
-- choose the Free plan (only if the business fits in it)
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
revoke all on function public.falak_choose_free(uuid) from public;
grant execute on function public.falak_choose_free(uuid) to authenticated;

-- ask for Basic or Pro (you see the request in Admin and switch it on after payment)
create or replace function public.falak_request_plan(bid uuid, p text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.falak_role(bid) not in ('owner','admin') then raise exception 'Only the owner or an administrator can ask for a plan.'; end if;
  if p not in ('basic','pro') then raise exception 'Unknown plan'; end if;
  update public.subscriptions set requested_plan = p, requested_at = now(), updated_at = now() where business_id = bid;
end $$;
revoke all on function public.falak_request_plan(uuid, text) from public;
grant execute on function public.falak_request_plan(uuid, text) to authenticated;

-- ---------- what only the super admin can do ----------
create or replace function public.falak_mark_paid(bid uuid, p text, m int, amt numeric, cur text, nt text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.subscriptions; f date; u date;
begin
  if not public.falak_is_super() then raise exception 'Only the super admin can record payments.'; end if;
  if p not in ('basic','pro') or m < 1 or m > 36 then raise exception 'Choose Basic or Pro and 1 to 36 months.'; end if;
  insert into public.subscriptions (business_id, plan) values (bid, p) on conflict (business_id) do nothing;
  select * into s from public.subscriptions where business_id = bid;
  f := greatest(current_date, coalesce(s.paid_until + 1, current_date));
  u := (f + make_interval(months => m))::date - 1;
  update public.subscriptions set plan = p, paid_until = u, complimentary = false, requested_plan = null,
         requested_at = null, updated_at = now() where business_id = bid;
  insert into public.payments (business_id, plan, months, amount, currency, note, paid_from, paid_until, created_by)
  values (bid, p, m, amt, upper(nullif(cur, '')), nullif(nt, ''), f, u, public.falak_email());
  return jsonb_build_object('paid_from', f, 'paid_until', u);
end $$;
revoke all on function public.falak_mark_paid(uuid, text, int, numeric, text, text) from public;
grant execute on function public.falak_mark_paid(uuid, text, int, numeric, text, text) to authenticated;

create or replace function public.falak_admin_set(bid uuid, action text, val text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.falak_is_super() then raise exception 'Only the super admin can change plans.'; end if;
  insert into public.subscriptions (business_id) values (bid) on conflict (business_id) do nothing;
  if action = 'extend_trial' then
    update public.subscriptions set trial_ends = greatest(coalesce(trial_ends, now()), now()) + make_interval(days => val::int),
           updated_at = now() where business_id = bid;
  elsif action = 'complimentary' then
    update public.subscriptions set complimentary = (val = 'true'), updated_at = now() where business_id = bid;
  elsif action = 'plan' and val in ('free','basic','pro') then
    update public.subscriptions set plan = val, updated_at = now() where business_id = bid;
  elsif action = 'end' then
    update public.subscriptions set complimentary = false, trial_ends = now(), paid_until = current_date - 1,
           updated_at = now() where business_id = bid;
  elsif action = 'note' then
    update public.subscriptions set note = val, updated_at = now() where business_id = bid;
  else
    raise exception 'Unknown action';
  end if;
end $$;
revoke all on function public.falak_admin_set(uuid, text, text) from public;
grant execute on function public.falak_admin_set(uuid, text, text) to authenticated;

-- ---------- who can read what ----------
alter table public.app_config    enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments      enable row level security;

drop policy if exists cfg_select on public.app_config;
create policy cfg_select on public.app_config for select using (true);
drop policy if exists cfg_write on public.app_config;
create policy cfg_write on public.app_config for all to authenticated
  using (public.falak_is_super()) with check (public.falak_is_super());

drop policy if exists sub_select on public.subscriptions;
create policy sub_select on public.subscriptions for select to authenticated
  using (public.falak_is_super() or public.falak_role(business_id) in ('owner','admin'));

drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select to authenticated
  using (public.falak_is_super() or public.falak_role(business_id) in ('owner','admin'));
-- (no insert/update/delete policies: only the functions above can change subscriptions and payments)

-- two-step login (Step 5) also protects the new tables, when Step 5 is installed
do $$
declare t text;
begin
  if exists (select 1 from pg_proc where proname = 'falak_mfa_ok') then
    foreach t in array array['subscriptions','payments'] loop
      execute format('drop policy if exists falak_mfa on public.%I', t);
      execute format('create policy falak_mfa on public.%I as restrictive for all to authenticated using (public.falak_mfa_ok()) with check (public.falak_mfa_ok())', t);
    end loop;
  end if;
end $$;

alter table public.trial_log enable row level security;   -- nobody reads it directly

grant select on public.app_config to anon, authenticated;
grant insert, update, delete on public.app_config to authenticated;
grant select on public.subscriptions, public.payments to authenticated;

-- Done. You should see "Success. No rows returned".
