-- =====================================================================
--  Falak.io — Step 8: choose a plan at sign-up + trials for old accounts
--  Supabase (project falak-io) → SQL Editor → New query → paste ALL → Run
--  (needs Step 7 first)
--
--  1. The 4 older businesses that are not yours (they were "Complimentary")
--     get a 30-day free trial from today. Your own businesses stay free.
--  2. New accounts choose Free / Basic / Pro when they sign up:
--     Free starts on Free; Basic or Pro starts a 30-day trial of THAT plan.
--  3. A trial gives the features of the chosen plan (Basic trial = Basic).
--  Changes no accounting data. Safe to run more than once.
-- =====================================================================

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
