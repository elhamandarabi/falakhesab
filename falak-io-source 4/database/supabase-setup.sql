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
