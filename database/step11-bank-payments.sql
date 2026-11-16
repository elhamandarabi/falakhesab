-- =====================================================================
--  Falak Hesab — Step 11: subscription payments by bank transfer
--  (manual verification and activation)
--  Supabase (project falak-io) → SQL Editor → New query → paste ALL → Run
--  Needs Steps 3–8 (and Step 5 two-step login if you use it). Safe to run again.
--  Undo: step11-undo.sql
--  Updated 15 Nov 2026 (SEC-1): falak_billing_create, falak_billing_report and
--  falak_billing_cancel refuse callers with no role in the business.
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
