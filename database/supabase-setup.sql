-- =====================================================================
--  Falak.io database setup
--  Run this ONCE in Supabase:  SQL Editor → New query → paste → Run
--  Super admin: falaktravelagency11@gmail.com (sees every business)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email       text not null,
  role        text not null default 'user' check (role in ('owner','admin','user','viewer')),
  tabs        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  unique (business_id, email)
);

create table if not exists public.records (
  id          uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  type        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text
);
create index if not exists records_business_type on public.records (business_id, type);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  created_at  timestamptz not null default now()
);

-- ---------- helper functions ----------
create or replace function public.falak_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt()->>'email','')) $$;

create or replace function public.falak_is_super() returns boolean
language sql stable as $$ select public.falak_email() = 'falaktravelagency11@gmail.com' $$;

create or replace function public.falak_role(bid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when public.falak_is_super() then 'owner'
         else (select m.role from public.members m
               where m.business_id = bid and m.email = public.falak_email() limit 1) end
$$;

create or replace function public.falak_can_write(bid uuid, t text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when public.falak_is_super() then true
         else coalesce((select m.role in ('owner','admin') or (m.role = 'user' and t = any(m.tabs))
                        from public.members m
                        where m.business_id = bid and m.email = public.falak_email() limit 1), false) end
$$;

-- creator of a business becomes its owner
create or replace function public.falak_on_business() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (business_id, email, role)
  values (new.id,
          coalesce(nullif(public.falak_email(), ''), (select lower(email) from auth.users where id = new.owner)),
          'owner')
  on conflict (business_id, email) do update set role = 'owner';
  return new;
end $$;
drop trigger if exists falak_business_owner on public.businesses;
create trigger falak_business_owner after insert on public.businesses
  for each row execute function public.falak_on_business();

-- keep a list of everyone who signed up (for the admin page)
create or replace function public.falak_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, lower(new.email)) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists falak_signup on auth.users;
create trigger falak_signup after insert on auth.users
  for each row execute function public.falak_on_signup();
insert into public.profiles (id, email) select id, lower(email) from auth.users on conflict (id) do nothing;

-- ---------- row level security ----------
alter table public.businesses enable row level security;
alter table public.members    enable row level security;
alter table public.records    enable row level security;
alter table public.profiles   enable row level security;

drop policy if exists biz_select on public.businesses;
drop policy if exists biz_insert on public.businesses;
drop policy if exists biz_update on public.businesses;
drop policy if exists biz_delete on public.businesses;
create policy biz_select on public.businesses for select using (public.falak_role(id) is not null);
create policy biz_insert on public.businesses for insert with check (owner = auth.uid());
create policy biz_update on public.businesses for update using (public.falak_role(id) in ('owner','admin'));
create policy biz_delete on public.businesses for delete using (public.falak_role(id) = 'owner');

drop policy if exists mem_select on public.members;
drop policy if exists mem_insert on public.members;
drop policy if exists mem_update on public.members;
drop policy if exists mem_delete on public.members;
create policy mem_select on public.members for select using (public.falak_role(business_id) is not null or email = public.falak_email());
create policy mem_insert on public.members for insert with check (public.falak_role(business_id) in ('owner','admin'));
create policy mem_update on public.members for update using (public.falak_role(business_id) in ('owner','admin'));
create policy mem_delete on public.members for delete using (public.falak_role(business_id) in ('owner','admin'));

drop policy if exists rec_select on public.records;
drop policy if exists rec_insert on public.records;
drop policy if exists rec_update on public.records;
drop policy if exists rec_delete on public.records;
create policy rec_select on public.records for select using (public.falak_role(business_id) is not null);
create policy rec_insert on public.records for insert with check (public.falak_can_write(business_id, type));
create policy rec_update on public.records for update using (public.falak_can_write(business_id, type)) with check (public.falak_can_write(business_id, type));
create policy rec_delete on public.records for delete using (public.falak_can_write(business_id, type));

drop policy if exists prof_select on public.profiles;
create policy prof_select on public.profiles for select using (id = auth.uid() or public.falak_is_super());

-- ---------- change history (who changed what, when) ----------
create table if not exists public.history (
  id          bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  record_id   uuid not null,
  type        text not null,
  action      text not null,
  data        jsonb,
  changed_by  text,
  changed_at  timestamptz not null default now()
);
create index if not exists history_business on public.history (business_id, changed_at desc);
create index if not exists history_record on public.history (record_id);

create or replace function public.falak_on_record_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.businesses where id = old.business_id) then
      insert into public.history (business_id, record_id, type, action, data, changed_by)
      values (old.business_id, old.id, old.type, 'deleted', old.data, nullif(public.falak_email(), ''));
    end if;
    return old;
  end if;
  insert into public.history (business_id, record_id, type, action, data, changed_by)
  values (new.business_id, new.id, new.type, case when tg_op = 'INSERT' then 'created' else 'changed' end, new.data,
          coalesce(nullif(public.falak_email(), ''), new.updated_by));
  return new;
end $$;
drop trigger if exists falak_record_history on public.records;
create trigger falak_record_history after insert or update or delete on public.records
  for each row execute function public.falak_on_record_change();

alter table public.history enable row level security;
drop policy if exists hist_select on public.history;
create policy hist_select on public.history for select using (public.falak_role(business_id) in ('owner','admin'));

-- ---------- public links for invoices and quotes (shared by WhatsApp / email) ----------
create index if not exists records_share_token on public.records ((data->>'shareToken'));
create or replace function public.falak_shared_doc(tok text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'type', r.type, 'doc', r.data,
    'business', jsonb_build_object('name', b.name, 'settings', b.settings),
    'party', (select jsonb_build_object('id', p.id, 'type', p.type, 'data', p.data) from public.records p
              where p.business_id = r.business_id and p.id::text = coalesce(r.data->>'customer', r.data->>'supplier')),
    'taxcodes', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'type', t.type, 'data', t.data)), '[]'::jsonb)
                 from public.records t where t.business_id = r.business_id and t.type = 'taxcode'))
  from public.records r join public.businesses b on b.id = r.business_id
  where length(coalesce(tok, '')) >= 24 and r.data->>'shareToken' = tok
  limit 1
$$;
revoke all on function public.falak_shared_doc(text) from public;
grant execute on function public.falak_shared_doc(text) to anon, authenticated;

-- ---------- live updates (several people at the same time) ----------
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Done. You should see "Success. No rows returned".

-- ---------- Step 3 security fixes (added 2026-10-19) ----------
-- ---------- 1 + 2: protect the Owner ----------
drop policy if exists mem_insert on public.members;
drop policy if exists mem_update on public.members;
drop policy if exists mem_delete on public.members;

create policy mem_insert on public.members for insert
  with check (public.falak_role(business_id) in ('owner','admin')
              and (role <> 'owner' or public.falak_role(business_id) = 'owner'));

create policy mem_update on public.members for update
  using      (public.falak_role(business_id) in ('owner','admin')
              and (role <> 'owner' or public.falak_role(business_id) = 'owner'))
  with check (public.falak_role(business_id) in ('owner','admin')
              and (role <> 'owner' or public.falak_role(business_id) = 'owner'));

create policy mem_delete on public.members for delete
  using (public.falak_role(business_id) in ('owner','admin')
         and (role <> 'owner' or public.falak_is_super()));

create or replace function public.falak_guard_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and new.role <> 'owner' and not public.falak_is_super() then
    raise exception 'The Owner cannot be downgraded. Make someone else Owner first (ask the super admin).';
  end if;
  if new.business_id <> old.business_id then
    raise exception 'A member cannot be moved to another business.';
  end if;
  return new;
end $$;
drop trigger if exists falak_guard_member on public.members;
create trigger falak_guard_member before update on public.members
  for each row execute function public.falak_guard_member();

-- ---------- 3: private payslips ----------
create or replace function public.falak_can_see_type(bid uuid, t text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.falak_is_super() then true
    when t <> 'payslip' then public.falak_role(bid) is not null
    else coalesce((select m.role in ('owner','admin','viewer')
                          or m.tabs && array['payslip','employee','reports']
                   from public.members m
                   where m.business_id = bid and m.email = public.falak_email() limit 1), false)
  end
$$;

drop policy if exists rec_select on public.records;
create policy rec_select on public.records for select
  using (public.falak_can_see_type(business_id, type));

-- ---------- 4: records stay in their business ----------
create or replace function public.falak_guard_record() returns trigger
language plpgsql as $$
begin
  if new.business_id <> old.business_id or new.id <> old.id then
    raise exception 'A record cannot be moved to another business.';
  end if;
  return new;
end $$;
drop trigger if exists falak_guard_record on public.records;
create trigger falak_guard_record before update on public.records
  for each row execute function public.falak_guard_record();

-- ---------- 5: business owner column ----------
create or replace function public.falak_guard_business() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner <> old.owner and not public.falak_is_super() then
    raise exception 'Only the super admin can change the owner of a business.';
  end if;
  return new;
end $$;
drop trigger if exists falak_guard_business on public.businesses;
create trigger falak_guard_business before update on public.businesses
  for each row execute function public.falak_guard_business();

-- Done. You should see "Success. No rows returned".

-- ---------- Step 4 database checks (added 2026-10-23) ----------
create or replace function public.falak_check_record() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lock_date text;
  free_keys text[] := array['cleared','clearedFrom','clearedTo','shareToken'];
  dr numeric; cr numeric;
begin
  -- business being deleted (cascade) → allow
  if tg_op = 'DELETE' and not exists (select 1 from public.businesses where id = old.business_id) then
    return old;
  end if;

  select nullif(settings->>'lockDate', '') into lock_date
    from public.businesses where id = coalesce(new.business_id, old.business_id);

  if lock_date is not null then
    if tg_op in ('UPDATE','DELETE') and nullif(old.data->>'date','') is not null and old.data->>'date' <= lock_date then
      if not (tg_op = 'UPDATE' and (old.data - free_keys) = (new.data - free_keys) and old.type = new.type) then
        raise exception 'Books are locked up to %. This transaction cannot be changed or deleted.', lock_date;
      end if;
    end if;
    if tg_op in ('INSERT','UPDATE') and nullif(new.data->>'date','') is not null and new.data->>'date' <= lock_date
       and not (tg_op = 'UPDATE' and (old.data - free_keys) = (new.data - free_keys)) then
      raise exception 'Books are locked up to %. Choose a later date.', lock_date;
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') and new.type = 'journal' then
    select coalesce(sum(round(coalesce(nullif(l->>'debit','')::numeric, 0), 2)), 0),
           coalesce(sum(round(coalesce(nullif(l->>'credit','')::numeric, 0), 2)), 0)
      into dr, cr
      from jsonb_array_elements(coalesce(new.data->'lines', '[]'::jsonb)) l;
    if dr <> cr then
      raise exception 'Journal entry does not balance: debit % and credit %.', dr, cr;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists falak_check_record on public.records;
create trigger falak_check_record before insert or update or delete on public.records
  for each row execute function public.falak_check_record();

-- Done. You should see "Success. No rows returned".

-- ---------- Step 5 two-step login enforcement (added 2026-10-27) ----------
create or replace function public.falak_mfa_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt()->>'aal','') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;

do $$
declare t text;
begin
  foreach t in array array['businesses','members','records','profiles','history'] loop
    execute format('drop policy if exists falak_mfa on public.%I', t);
    execute format('create policy falak_mfa on public.%I as restrictive for all to authenticated using (public.falak_mfa_ok()) with check (public.falak_mfa_ok())', t);
  end loop;
end $$;

-- Done. You should see "Success. No rows returned".

-- ===================== Step 6: company addresses =====================
alter table public.businesses add column if not exists slug text;

do $$ begin
  alter table public.businesses add constraint businesses_slug_format check (
    slug is null or (
      slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
      and slug not in ('admin','api','app','www','mail','login','signup','sign-in','register','reset','share','support',
                       'help','assets','vendor','static','index','falak','falakhesab','falak-io','settings','dashboard',
                       'billing','pricing','terms','privacy','about','contact','blog','docs','status')));
exception when duplicate_object then null; end $$;

create unique index if not exists businesses_slug_key on public.businesses (slug);

-- public: company name + logo for the branded sign-in page (nothing else)
create or replace function public.falak_workspace(s text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('slug', b.slug, 'name', b.name, 'logo', coalesce(b.settings->>'logo', ''))
  from public.businesses b
  where b.slug is not null and b.slug = lower(trim(s))
  limit 1
$$;
revoke all on function public.falak_workspace(text) from public;
grant execute on function public.falak_workspace(text) to anon, authenticated;

-- signed-in owners/admins: is an address still free?
create or replace function public.falak_slug_free(s text, bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.businesses b where b.slug = lower(trim(s)) and b.id <> bid)
$$;
revoke all on function public.falak_slug_free(text, uuid) from public;
grant execute on function public.falak_slug_free(text, uuid) to authenticated;

-- Done. You should see "Success. No rows returned".

-- ===================== Step 7: plans, trial, limits, payments =====================
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

-- ===================== Step 8: plan at sign-up, trials for older accounts =====================
-- ---------- 1. old complimentary businesses → 30-day trial (only once) ----------
update public.subscriptions s
   set complimentary = false,
       trial_ends    = now() + interval '30 days',
       note          = 'Older account: 30-day trial started with Step 8',
       updated_at    = now()
  from public.businesses b
  join auth.users u on u.id = b.owner
 where s.business_id = b.id
   and s.complimentary
   and s.note = 'Existing before plans started'
   and lower(u.email) <> 'falaktravelagency11@gmail.com';

-- ---------- 2. state: during a trial the business gets the features of its own plan ----------
create or replace function public.falak_plan_state(bid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.subscriptions; cfg jsonb; st text; eff text; lim int;
begin
  if public.falak_role(bid) is null then return null; end if;
  select * into s from public.subscriptions where business_id = bid;
  select value into cfg from public.app_config where key = 'plans';
  if s.business_id is null then
    st := 'active'; eff := 'pro';
  elsif s.complimentary or s.plan = 'free' or (s.paid_until is not null and s.paid_until >= current_date) then
    st := 'active'; eff := s.plan;
  elsif s.trial_ends is not null and s.trial_ends > now() then
    st := 'trial'; eff := s.plan;
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

create or replace function public.falak_plan_allows(bid uuid, what text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s public.subscriptions; st text; eff text;
begin
  if public.falak_is_super() then return true; end if;
  select * into s from public.subscriptions where business_id = bid;
  if s.business_id is null then return true; end if;
  eff := s.plan;
  if s.complimentary or s.plan = 'free' or (s.paid_until is not null and s.paid_until >= current_date) then
    st := 'active';
  elsif s.trial_ends is not null and s.trial_ends > now() then
    st := 'trial';
  else
    st := 'expired';
  end if;
  if what = 'write'   then return st <> 'expired'; end if;
  if what = 'pro'     then return st <> 'expired' and eff = 'pro'; end if;
  if what = 'address' then return st <> 'expired' and eff in ('basic','pro'); end if;
  return false;
end $$;
revoke all on function public.falak_plan_allows(uuid, text) from public;

create or replace function public.falak_check_plan_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; n int; s public.subscriptions; cfg jsonb;
begin
  if public.falak_is_super() then return new; end if;
  if new.role = 'owner' and not exists (select 1 from public.members where business_id = new.business_id) then
    return new;
  end if;
  if not public.falak_plan_allows(new.business_id, 'write') then
    raise exception 'PLAN_EXPIRED: Your plan has ended. Choose a plan before adding users.';
  end if;
  select * into s from public.subscriptions where business_id = new.business_id;
  if s.business_id is null then return new; end if;
  select value into cfg from public.app_config where key = 'plans';
  lim := coalesce((cfg->s.plan->>'users')::int, 0);
  select count(*) into n from public.members where business_id = new.business_id;
  if lim > 0 and n + 1 > lim then
    raise exception 'PLAN_USERS: Your plan allows % user(s). Upgrade to add more.', lim;
  end if;
  return new;
end $$;

-- ---------- 3. new businesses: use the plan chosen at sign-up ----------
create or replace function public.falak_on_business_plan() returns trigger
language plpgsql security definer set search_path = public as $$
declare days int; had_trial boolean; chosen text;
begin
  if public.falak_is_super() then
    insert into public.subscriptions (business_id, plan, complimentary, note)
    values (new.id, 'pro', true, 'Super admin business') on conflict do nothing;
    return new;
  end if;
  select coalesce((value->>'trialDays')::int, 30) into days from public.app_config where key = 'plans';
  select lower(coalesce(u.raw_user_meta_data->>'plan', 'pro')) into chosen from auth.users u where u.id = new.owner;
  if chosen not in ('free','basic','pro') then chosen := 'pro'; end if;
  select exists (select 1 from public.trial_log t where t.owner = new.owner) into had_trial;
  if chosen = 'free' then
    insert into public.subscriptions (business_id, plan, note)
    values (new.id, 'free', 'Chose Free at sign-up') on conflict do nothing;
  elsif had_trial then
    insert into public.subscriptions (business_id, plan, requested_plan, requested_at, note)
    values (new.id, 'free', chosen, now(), 'Trial already used: starts on Free') on conflict do nothing;
  else
    insert into public.subscriptions (business_id, plan, trial_ends, note)
    values (new.id, chosen, now() + make_interval(days => coalesce(days, 30)), 'Chose ' || chosen || ' at sign-up (trial)')
    on conflict do nothing;
    insert into public.trial_log (owner, business_id) values (new.owner, new.id) on conflict do nothing;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';

-- Done. You should see "Success. No rows returned".

-- ===================== Step 9: attachments =====================
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
-- =====================================================================
-- Falak Hesab — Step 10: help chatbot
-- Run once in Supabase → SQL Editor (project falak-io). Safe to run again.
-- Creates the chat_log table. Only the chatbot server function (service role)
-- writes to it; only the super admin can read it (Admin → Chat questions).
-- Questions are kept 90 days, then removed automatically by the function.
-- =====================================================================

create table if not exists public.chat_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid,                       -- empty for website visitors
  who         text not null default 'visitor' check (who in ('visitor','customer')),
  ip_hash     text,                       -- one-way hash, never the real IP
  lang        text,
  page        text,
  question    text not null check (char_length(question) <= 2000),
  answer      text,
  source      text not null default 'ai' check (source in ('ai','faq','limit','error')),
  tokens_in   int,
  tokens_out  int
);

create index if not exists chat_log_created_idx on public.chat_log (created_at desc);
create index if not exists chat_log_ip_idx      on public.chat_log (ip_hash, created_at desc);
create index if not exists chat_log_user_idx    on public.chat_log (user_id, created_at desc);

alter table public.chat_log enable row level security;

drop policy if exists chat_log_super_select on public.chat_log;
create policy chat_log_super_select on public.chat_log
  for select using (public.falak_is_super());

-- no insert/update/delete policies: normal users cannot write or change the log
revoke insert, update, delete on public.chat_log from anon, authenticated;

notify pgrst, 'reload schema';

-- Check: should return 1 row with rls = true
select relname, relrowsecurity as rls from pg_class where relname = 'chat_log';
-- =====================================================================
--  Falak Hesab — Step 11: subscription payments by bank transfer
--  (manual verification and activation)
--  Supabase (project falak-io) → SQL Editor → New query → paste ALL → Run
--  Needs Steps 3–8 (and Step 5 two-step login if you use it). Safe to run again.
--  Undo: step11-undo.sql
--
--  Starts SWITCHED OFF (mode 'off'): customers cannot start a bank payment.
--  Modes:  off  – only the super admin / payment approvers can make TEST requests
--          test – everyone can try the flow; approvals NEVER change a subscription
--          live – real requests; approvals activate or extend the subscription
--  'live' can only be switched on when company details, a real bank account,
--  prices, at least one country, the payment policies and a CONFIRMED tax
--  setting are filled in (checked below).
--
--  Nothing here connects to a bank or moves money. An approver checks the money
--  in the company bank account outside Falak Hesab, then approves in Admin.
-- =====================================================================

-- ---------- settings (one row; only the super admin changes it) ----------
create table if not exists public.billing_config (
  id         int primary key default 1 check (id = 1),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.billing_config (id, value) values (1, jsonb_build_object(
  'mode', 'off',
  'currencies', '[]'::jsonb,                       -- settlement currencies you accept, e.g. ["USD","TRY"]
  'prices', '{}'::jsonb,                           -- per month: {"basic":{"USD":9},"pro":{"USD":19}}
  'durations', '[1,3,6,12]'::jsonb,                -- months a customer can pay for
  'countries', '{}'::jsonb,                        -- {"TR":{"status":"supported","currencies":["TRY","USD"]}}
  'banks', '[]'::jsonb,                            -- [{id,currency,label,bank_name,account_holder,iban,swift,account_no,bank_address,note,test}]
  'company', '{}'::jsonb,                          -- legal name, address, tax office/number, MERSIS, TÜRSAB no, email, phone
  'policies', '{}'::jsonb,                         -- texts YOU supply: fees, processing, amount_rule, partial, overpay, wrong_currency, refund
  'tax', '{"confirmed":false,"prices_include_tax":false,"rules":{},"default":null}'::jsonb,
  'approvers', '[]'::jsonb,                        -- extra emails allowed to verify payments (super admin always can)
  'ref_prefix', 'FH'))
on conflict (id) do nothing;

-- ---------- payment requests (one per "pay for this plan and period") ----------
create table if not exists public.payment_requests (
  id              uuid primary key default gen_random_uuid(),
  ref             text not null unique,                    -- unique payment reference, e.g. FH-7K3M9Q2A
  business_id     uuid not null references public.businesses(id) on delete cascade,
  business_name   text,                                    -- name when the request was made (approvers may not see the business)
  test            boolean not null default true,           -- test requests never change a subscription
  plan            text not null check (plan in ('basic','pro')),
  months          int  not null check (months between 1 and 36),
  country         text not null check (country ~ '^[A-Z]{2}$'),
  currency        text not null check (currency ~ '^[A-Z]{3}$'),
  unit_price      numeric(12,2) not null,
  subtotal        numeric(12,2) not null,
  tax_label       text,
  tax_rate        numeric(6,3),                            -- null = not confirmed / not set
  tax_amount      numeric(12,2),
  total           numeric(12,2) not null,                  -- the amount that must arrive
  bank            jsonb not null,                          -- bank details shown to the customer (snapshot)
  billing         jsonb not null,                          -- company name, address, country, tax id ... (for the invoice)
  status          text not null default 'awaiting_payment'
                  check (status in ('awaiting_payment','awaiting_verification','partially_paid','approved','rejected','cancelled')),
  report          jsonb,                                   -- what the customer said: payer, date, amount, note
  receipt_path    text,                                    -- private file in bucket payment-receipts (optional)
  reported_at     timestamptz,
  reported_by     text,
  received        jsonb not null default '[]'::jsonb,      -- money seen in the bank: [{amount,currency,bank_ref,date,by,at}]
  received_total  numeric(12,2) not null default 0,
  overpaid        numeric(12,2),
  decided_by      text,
  decided_at      timestamptz,
  decision_note   text,
  paid_from       date,
  paid_until      date,
  payment_id      uuid,
  invoice_no      text,                                    -- OFFICIAL tax invoice (made outside Falak Hesab)
  invoice_date    date,
  invoice_by      text,
  created_at      timestamptz not null default now(),
  created_by      text
);
create index if not exists payreq_business on public.payment_requests (business_id, created_at desc);
create index if not exists payreq_status on public.payment_requests (status, created_at);
-- only one open request per business
create unique index if not exists payreq_one_open on public.payment_requests (business_id)
  where status in ('awaiting_payment','awaiting_verification','partially_paid');

-- the existing ledger of approved payments gets a link back to the request
alter table public.payments add column if not exists request_id uuid;
alter table public.payment_requests add column if not exists business_name text;

-- ---------- who may verify payments ----------
create or replace function public.falak_is_billing_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.falak_is_super() or exists (
    select 1 from public.billing_config c, jsonb_array_elements_text(coalesce(c.value->'approvers','[]'::jsonb)) e
    where lower(e) = public.falak_email())
$$;
revoke all on function public.falak_is_billing_admin() from public;
grant execute on function public.falak_is_billing_admin() to authenticated;

-- ---------- settings for customers (no approver list) ----------
create or replace function public.falak_billing_public() returns jsonb
language sql stable security definer set search_path = public as $$
  select (c.value - 'approvers')
         || jsonb_build_object('banks', coalesce((select jsonb_agg(b) from jsonb_array_elements(c.value->'banks') b
                                                  where c.value->>'mode' <> 'live' or coalesce((b->>'test')::boolean, false) = false), '[]'::jsonb),
                               'is_admin', public.falak_is_billing_admin())
  from public.billing_config c where c.id = 1
$$;
revoke all on function public.falak_billing_public() from public;
grant execute on function public.falak_billing_public() to authenticated;

-- a policy text may be one text or {"en": "...", "fa": "...", "ps": "...", "tr": "..."}: the English one must be filled in
create or replace function public.falak_txt(j jsonb) returns text language sql immutable as $$
  select trim(coalesce(case jsonb_typeof(j) when 'string' then j #>> '{}' when 'object' then j ->> 'en' end, ''))
$$;

-- ---------- super admin saves the settings (live needs everything filled in) ----------
create or replace function public.falak_billing_save(v jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare missing text[] := '{}'; m text := coalesce(v->>'mode','off');
begin
  if not public.falak_is_super() then raise exception 'BILLING_AUTH: Only the super admin can change payment settings.'; end if;
  if m not in ('off','test','live') then raise exception 'Unknown mode'; end if;
  if m = 'live' then
    if coalesce(v#>>'{company,legal_name}','') = '' then missing := array_append(missing, 'company legal name'); end if;
    if coalesce(v#>>'{company,address}','') = '' then missing := array_append(missing, 'company address'); end if;
    if coalesce(v#>>'{company,tax_no}','') = '' then missing := array_append(missing, 'company tax number'); end if;
    if not exists (select 1 from jsonb_array_elements(coalesce(v->'banks','[]')) b
                   where coalesce((b->>'test')::boolean,false) = false
                     and (coalesce(b->>'iban','') <> '' or coalesce(b->>'account_no','') <> '')) then
      missing := array_append(missing, 'a real bank account'); end if;
    if exists (select 1 from jsonb_array_elements(coalesce(v->'banks','[]')) b where coalesce((b->>'test')::boolean,false)) then
      missing := array_append(missing, 'remove sample (test) bank accounts'); end if;
    if jsonb_array_length(coalesce(v->'currencies','[]')) = 0 then missing := array_append(missing, 'currencies'); end if;
    if coalesce(v->'prices','{}') = '{}'::jsonb then missing := array_append(missing, 'prices'); end if;
    if not exists (select 1 from jsonb_each(coalesce(v->'countries','{}')) c where c.value->>'status' = 'supported') then
      missing := array_append(missing, 'at least one supported country'); end if;
    if public.falak_txt(v#>'{policies,fees}') = '' then missing := array_append(missing, 'transfer fee policy'); end if;
    if public.falak_txt(v#>'{policies,processing}') = '' then missing := array_append(missing, 'processing time policy'); end if;
    if public.falak_txt(v#>'{policies,amount_rule}') = '' then missing := array_append(missing, 'amount-that-must-arrive policy'); end if;
    if coalesce((v#>>'{tax,confirmed}')::boolean, false) = false then missing := array_append(missing, 'tax setting confirmed by the accountant'); end if;
    if array_length(missing,1) > 0 then
      raise exception 'BILLING_INCOMPLETE: Live payments need: %', array_to_string(missing, ', ');
    end if;
  end if;
  update public.billing_config set value = v, updated_at = now(), updated_by = public.falak_email() where id = 1;
  return public.falak_billing_public();
end $$;
revoke all on function public.falak_billing_save(jsonb) from public;
grant execute on function public.falak_billing_save(jsonb) to authenticated;

-- ---------- customer: start a payment ----------
create or replace function public.falak_billing_create(bid uuid, p_plan text, p_months int, p_country text, p_currency text, p_billing jsonb)
returns public.payment_requests
language plpgsql security definer set search_path = public as $$
declare c jsonb; mode text; cty jsonb; price numeric; sub numeric; rule jsonb; rate numeric; tax numeric; tot numeric;
        bank jsonb; r public.payment_requests; newref text; alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; i int;
        is_test boolean; incl boolean;
begin
  if public.falak_role(bid) is null then raise exception 'BILLING_AUTH: Only the owner or an administrator can pay for the plan.'; end if;   -- SEC-1: not a member of this business
  if public.falak_role(bid) not in ('owner','admin') then raise exception 'BILLING_AUTH: Only the owner or an administrator can pay for the plan.'; end if;
  select value into c from public.billing_config where id = 1;
  mode := coalesce(c->>'mode','off');
  if mode = 'off' and not public.falak_is_billing_admin() then
    raise exception 'BILLING_OFF: Bank transfer payments are not open yet. Please contact support.'; end if;
  is_test := mode <> 'live';
  p_country := upper(trim(p_country)); p_currency := upper(trim(p_currency));
  if p_plan not in ('basic','pro') then raise exception 'BILLING_INPUT: Choose Basic or Pro.'; end if;
  if not (c->'durations' @> to_jsonb(p_months)) then raise exception 'BILLING_INPUT: This payment period is not offered.'; end if;
  cty := c->'countries'->p_country;
  if cty is null or cty->>'status' <> 'supported' then
    raise exception 'BILLING_COUNTRY: Payments from this country are not set up yet. Please contact support.'; end if;
  if not (coalesce(cty->'currencies','[]') @> to_jsonb(p_currency)) or not (c->'currencies' @> to_jsonb(p_currency)) then
    raise exception 'BILLING_CURRENCY: This currency is not accepted for this country.'; end if;
  price := (c->'prices'->p_plan->>p_currency)::numeric;
  if price is null or price <= 0 then raise exception 'BILLING_CURRENCY: No price is set in this currency.'; end if;
  select b into bank from jsonb_array_elements(c->'banks') b
   where b->>'currency' = p_currency and (is_test or coalesce((b->>'test')::boolean,false) = false) limit 1;
  if bank is null then raise exception 'BILLING_BANK: No bank account is set up for this currency yet. Please contact support.'; end if;
  if coalesce(trim(p_billing->>'company'),'') = '' or coalesce(trim(p_billing->>'address'),'') = '' then
    raise exception 'BILLING_INPUT: Company name and address are needed for the invoice.'; end if;
  -- price and tax are calculated here, never taken from the browser
  sub := round(price * p_months, 2);
  rule := coalesce(c->'tax'->'rules'->p_country, c->'tax'->'default');
  rate := nullif(rule->>'rate','')::numeric;
  incl := coalesce((c#>>'{tax,prices_include_tax}')::boolean, false);
  if rate is null then tax := null; tot := sub;
  elsif incl then tax := round(sub - sub / (1 + rate/100), 2); tot := sub;
  else tax := round(sub * rate / 100, 2); tot := sub + tax; end if;
  for i in 1..20 loop
    newref := coalesce(nullif(c->>'ref_prefix',''),'FH') || '-' ||
              (select string_agg(substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1), '') from generate_series(1,8));
    exit when not exists (select 1 from public.payment_requests where ref = newref);
  end loop;
  insert into public.payment_requests (ref, business_id, business_name, test, plan, months, country, currency, unit_price, subtotal,
         tax_label, tax_rate, tax_amount, total, bank, billing, created_by)
  values (newref, bid, (select name from public.businesses where id = bid), is_test, p_plan, p_months, p_country, p_currency, price, sub,
          rule->>'label', rate, tax, tot, bank - 'test' || jsonb_build_object('test', coalesce((bank->>'test')::boolean,false)),
          jsonb_strip_nulls(jsonb_build_object(
            'company', left(p_billing->>'company',200), 'contact', left(p_billing->>'contact',120),
            'address', left(p_billing->>'address',500), 'city', left(p_billing->>'city',120),
            'postal', left(p_billing->>'postal',30), 'country', p_country,
            'tax_id', left(p_billing->>'tax_id',60), 'tax_office', left(p_billing->>'tax_office',120),
            'email', left(p_billing->>'email',200))),
          public.falak_email())
  returning * into r;
  update public.subscriptions set requested_plan = p_plan, requested_at = now(), updated_at = now() where business_id = bid;
  return r;
exception when unique_violation then
  raise exception 'BILLING_OPEN: This business already has an open payment. Finish or cancel it first.';
end $$;
revoke all on function public.falak_billing_create(uuid, text, int, text, text, jsonb) from public;
grant execute on function public.falak_billing_create(uuid, text, int, text, text, jsonb) to authenticated;

-- ---------- customer: "I have paid" (never activates anything) ----------
create or replace function public.falak_billing_report(rid uuid, p_report jsonb, p_receipt text) returns public.payment_requests
language plpgsql security definer set search_path = public as $$
declare r public.payment_requests;
begin
  select * into r from public.payment_requests where id = rid for update;
  if r.id is null or public.falak_role(r.business_id) is null then raise exception 'BILLING_AUTH: Not allowed.'; end if;   -- SEC-1: not a member of this business
  if r.id is null or public.falak_role(r.business_id) not in ('owner','admin') then raise exception 'BILLING_AUTH: Not allowed.'; end if;
  if r.status not in ('awaiting_payment','partially_paid','awaiting_verification') then
    raise exception 'BILLING_DONE: This payment is already %.', r.status; end if;
  if p_receipt is not null and p_receipt <> '' and p_receipt not like r.business_id::text || '/' || r.id::text || '/%' then
    raise exception 'BILLING_INPUT: Wrong receipt file.'; end if;
  update public.payment_requests set status = 'awaiting_verification',
         report = jsonb_strip_nulls(jsonb_build_object('payer', left(p_report->>'payer',200), 'date', left(p_report->>'date',10),
                  'amount', left(p_report->>'amount',20), 'currency', upper(left(p_report->>'currency',3)),
                  'sender_bank', left(p_report->>'sender_bank',200), 'note', left(p_report->>'note',1000))),
         receipt_path = coalesce(nullif(p_receipt,''), receipt_path),
         reported_at = now(), reported_by = public.falak_email()
   where id = rid returning * into r;
  return r;
end $$;
revoke all on function public.falak_billing_report(uuid, jsonb, text) from public;
grant execute on function public.falak_billing_report(uuid, jsonb, text) to authenticated;

-- ---------- customer or approver: cancel an open request with no money recorded ----------
create or replace function public.falak_billing_cancel(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.payment_requests;
begin
  select * into r from public.payment_requests where id = rid for update;
  -- SEC-1: coalesce makes "not a member of this business" count as no (payment approvers are allowed without being members)
  if r.id is null or not (public.falak_is_billing_admin() or coalesce(public.falak_role(r.business_id) in ('owner','admin'), false)) then
    raise exception 'BILLING_AUTH: Not allowed.'; end if;
  if r.status not in ('awaiting_payment','awaiting_verification') or r.received_total > 0 then
    raise exception 'BILLING_DONE: This payment can no longer be cancelled.'; end if;
  update public.payment_requests set status = 'cancelled', decided_by = public.falak_email(), decided_at = now() where id = rid;
  update public.subscriptions set requested_plan = null, requested_at = null where business_id = r.business_id;
end $$;
revoke all on function public.falak_billing_cancel(uuid) from public;
grant execute on function public.falak_billing_cancel(uuid) to authenticated;

-- ---------- approver: record money seen in the bank, approve or reject ----------
-- act: 'receive' (record money, e.g. a part payment), 'approve', 'reject'
-- p_ref must be the request's reference typed again: protects against approving the wrong business.
create or replace function public.falak_billing_decide(rid uuid, act text, p_ref text, p_amount numeric, p_currency text,
                                                      p_bank_ref text, p_date date, p_note text) returns public.payment_requests
language plpgsql security definer set search_path = public as $$
declare r public.payment_requests; s public.subscriptions; f date; u date; pid uuid; note text := nullif(trim(p_note),'');
begin
  if not public.falak_is_billing_admin() then raise exception 'BILLING_AUTH: Only a payment approver can do this.'; end if;
  select * into r from public.payment_requests where id = rid for update;           -- one decision at a time
  if r.id is null then raise exception 'BILLING_INPUT: Payment not found.'; end if;
  if r.status in ('approved','rejected','cancelled') then
    raise exception 'BILLING_DONE: This payment was already % by % at %.', r.status, coalesce(r.decided_by,'?'), r.decided_at; end if;
  if upper(trim(coalesce(p_ref,''))) <> r.ref then
    raise exception 'BILLING_REF: The reference does not match this payment (%). Check you opened the right business.', r.ref; end if;
  if act = 'reject' then
    if note is null then raise exception 'BILLING_INPUT: Write the reason for rejecting.'; end if;
    update public.payment_requests set status = 'rejected', decided_by = public.falak_email(), decided_at = now(), decision_note = note
     where id = rid returning * into r;
    update public.subscriptions set requested_plan = null, requested_at = null where business_id = r.business_id;
    return r;
  end if;
  if act not in ('receive','approve') then raise exception 'Unknown action'; end if;
  if coalesce(p_amount, 0) > 0 then
    if upper(coalesce(p_currency,'')) <> r.currency then
      raise exception 'BILLING_CURRENCY: The money arrived in % but this payment is in %. Do not approve: follow the wrong-currency policy.', upper(p_currency), r.currency; end if;
    if coalesce(trim(p_bank_ref),'') = '' or p_date is null then
      raise exception 'BILLING_INPUT: Enter the bank reference and the date the money arrived.'; end if;
    if exists (select 1 from public.payment_requests x, jsonb_array_elements(x.received) e
               where e->>'currency' = r.currency and lower(e->>'bank_ref') = lower(trim(p_bank_ref))) then
      raise exception 'BILLING_DUPLICATE: Bank reference % was already used for a payment.', trim(p_bank_ref); end if;
    r.received := r.received || jsonb_build_array(jsonb_build_object('amount', round(p_amount,2), 'currency', r.currency,
                  'bank_ref', trim(p_bank_ref), 'date', p_date, 'by', public.falak_email(), 'at', now()));
    r.received_total := r.received_total + round(p_amount,2);
  elsif act = 'receive' then
    raise exception 'BILLING_INPUT: Enter the amount that arrived.';
  end if;
  if act = 'receive' or r.received_total < r.total then
    if act = 'approve' then
      raise exception 'BILLING_PARTIAL: Only % % of % % has arrived. Record it as a part payment and wait for the rest.', r.received_total, r.currency, r.total, r.currency; end if;
    update public.payment_requests set received = r.received, received_total = r.received_total,
           status = case when r.received_total >= r.total then 'awaiting_verification' else 'partially_paid' end,
           decision_note = coalesce(note, decision_note)
     where id = rid returning * into r;
    return r;
  end if;
  -- approve: work out the subscription period
  select * into s from public.subscriptions where business_id = r.business_id for update;
  if s.business_id is not null and s.plan = r.plan and s.paid_until is not null and s.paid_until >= current_date then
    f := s.paid_until + 1;                                            -- renewal / early payment: added after the current paid time
  elsif s.business_id is not null and s.plan = r.plan and s.trial_ends is not null and s.trial_ends > now() then
    f := (s.trial_ends at time zone 'Europe/Istanbul')::date;         -- paid during the trial: starts when the trial ends
  else
    f := current_date;                                                -- new, ended, or a different plan: starts today
    if s.plan is distinct from r.plan and s.paid_until is not null and s.paid_until >= current_date then
      note := coalesce(note || ' · ', '') || format('Plan changed from %s; earlier paid time until %s replaced (handle any credit by hand).', s.plan, s.paid_until);
    end if;
  end if;
  u := (f + make_interval(months => r.months))::date - 1;
  if not r.test then
    insert into public.subscriptions (business_id, plan) values (r.business_id, r.plan) on conflict (business_id) do nothing;
    update public.subscriptions set plan = r.plan, paid_until = u, complimentary = false, requested_plan = null,
           requested_at = null, updated_at = now() where business_id = r.business_id;
    insert into public.payments (business_id, plan, months, amount, currency, note, paid_from, paid_until, created_by, request_id)
    values (r.business_id, r.plan, r.months, r.received_total, r.currency, 'Bank transfer ' || r.ref, f, u, public.falak_email(), r.id)
    returning id into pid;
  else
    note := coalesce(note || ' · ', '') || 'TEST: subscription not changed.';
  end if;
  update public.payment_requests set received = r.received, received_total = r.received_total,
         overpaid = nullif(greatest(r.received_total - r.total, 0), 0),
         status = 'approved', decided_by = public.falak_email(), decided_at = now(), decision_note = note,
         paid_from = f, paid_until = u, payment_id = pid
   where id = rid returning * into r;
  return r;
end $$;
revoke all on function public.falak_billing_decide(uuid, text, text, numeric, text, text, date, text) from public;
grant execute on function public.falak_billing_decide(uuid, text, text, numeric, text, text, date, text) to authenticated;

-- ---------- approver: record the OFFICIAL tax invoice made outside Falak Hesab ----------
create or replace function public.falak_billing_invoice(rid uuid, p_no text, p_date date) returns public.payment_requests
language plpgsql security definer set search_path = public as $$
declare r public.payment_requests;
begin
  if not public.falak_is_billing_admin() then raise exception 'BILLING_AUTH: Only a payment approver can do this.'; end if;
  update public.payment_requests set invoice_no = nullif(trim(p_no),''), invoice_date = p_date, invoice_by = public.falak_email()
   where id = rid and status = 'approved' returning * into r;
  if r.id is null then raise exception 'BILLING_INPUT: Only approved payments get an invoice number.'; end if;
  return r;
end $$;
revoke all on function public.falak_billing_invoice(uuid, text, date) from public;
grant execute on function public.falak_billing_invoice(uuid, text, date) to authenticated;

-- ---------- who can read what ----------
alter table public.billing_config   enable row level security;
alter table public.payment_requests enable row level security;
drop policy if exists bcfg_select on public.billing_config;
create policy bcfg_select on public.billing_config for select to authenticated using (public.falak_is_super());
drop policy if exists payreq_select on public.payment_requests;
create policy payreq_select on public.payment_requests for select to authenticated
  using (public.falak_is_billing_admin() or public.falak_role(business_id) in ('owner','admin'));
-- no insert/update/delete policies: only the functions above change payment requests
revoke insert, update, delete on public.payment_requests from anon, authenticated;
revoke insert, update, delete on public.billing_config from anon, authenticated;
-- approvers also see the payments ledger
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select to authenticated
  using (public.falak_is_billing_admin() or public.falak_role(business_id) in ('owner','admin'));

do $$
declare t text;
begin
  if exists (select 1 from pg_proc where proname = 'falak_mfa_ok') then
    foreach t in array array['payment_requests','billing_config'] loop
      execute format('drop policy if exists falak_mfa on public.%I', t);
      execute format('create policy falak_mfa on public.%I as restrictive for all to authenticated using (public.falak_mfa_ok()) with check (public.falak_mfa_ok())', t);
    end loop;
  end if;
end $$;

-- ---------- private receipts: <business>/<request>/<file> ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.falak_receipt_ok(obj text, act text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare parts text[]; bid uuid; rid uuid; st text;
begin
  parts := string_to_array(obj, '/');
  if coalesce(array_length(parts, 1), 0) <> 3 then return false; end if;
  begin bid := parts[1]::uuid; rid := parts[2]::uuid; exception when others then return false; end;
  if exists (select 1 from pg_proc where proname = 'falak_mfa_ok') and not public.falak_mfa_ok() then return false; end if;
  select status into st from public.payment_requests where id = rid and business_id = bid;
  if st is null then return false; end if;
  if act = 'read' then return public.falak_is_billing_admin() or public.falak_role(bid) in ('owner','admin'); end if;
  if act = 'write' then return public.falak_role(bid) in ('owner','admin') and st in ('awaiting_payment','awaiting_verification','partially_paid'); end if;
  return false;                                                        -- receipts are kept as evidence: no deleting
end $$;
revoke all on function public.falak_receipt_ok(text, text) from public;
grant execute on function public.falak_receipt_ok(text, text) to authenticated;

drop policy if exists falak_receipt_select on storage.objects;
create policy falak_receipt_select on storage.objects for select to authenticated
  using (bucket_id = 'payment-receipts' and public.falak_receipt_ok(name, 'read'));
drop policy if exists falak_receipt_insert on storage.objects;
create policy falak_receipt_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts' and public.falak_receipt_ok(name, 'write'));

notify pgrst, 'reload schema';

-- Check: mode should be 'off'
select value->>'mode' as payment_mode from public.billing_config;

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
