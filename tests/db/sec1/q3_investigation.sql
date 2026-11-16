-- Q3 (read-only): look for past SEC-1 abuse. Changes nothing.
-- LIMITS: no table records WHO called falak_choose_free / falak_request_plan, and the old company
-- address (slug) is not kept anywhere. These queries find changes that LOOK unusual; confirm each
-- one with the business owner. Supabase → Logs (API / Postgres) may show the RPC calls for the
-- last few days only (retention depends on the plan).

-- 3a. Businesses switched to Free while paid time or a trial was still left.
--     A real owner rarely gives up paid time; an attacker would. Only one-user businesses could be hit.
select b.id, b.name, b.created_at::date,
       (select email from public.members m where m.business_id = b.id and m.role = 'owner' limit 1) as owner_email,
       (select count(*) from public.members m where m.business_id = b.id)                          as members_now,
       s.plan, s.note, s.updated_at as switched_at, s.paid_until, s.trial_ends,
       (s.paid_until is not null and s.paid_until >= s.updated_at::date)                          as paid_time_left_at_switch,
       (s.trial_ends is not null and s.trial_ends > s.updated_at)                                 as trial_left_at_switch,
       b.slug as company_address_now,
       (select max(paid_until) from public.payments p where p.business_id = b.id)                 as last_paid_until_recorded
from public.subscriptions s join public.businesses b on b.id = s.business_id
where s.note = 'Owner chose Free'
order by (s.paid_until >= s.updated_at::date or s.trial_ends > s.updated_at) desc nulls last, s.updated_at desc;

-- 3b. Every open plan request (who asked is not recorded). Ask each owner whether they asked.
select b.id, b.name, s.plan, s.requested_plan, s.requested_at,
       (select email from public.members m where m.business_id = b.id and m.role = 'owner' limit 1) as owner_email
from public.subscriptions s join public.businesses b on b.id = s.business_id
where s.requested_plan is not null
order by s.requested_at desc;

-- 3c. Businesses that once paid for Basic/Pro but have no company address now
--     (the address may have been removed by a Free switch; the old address is not stored).
select b.id, b.name, s.plan, s.note, s.updated_at, max(p.paid_until) as last_paid_until
from public.businesses b join public.subscriptions s on s.business_id = b.id
join public.payments p on p.business_id = b.id
where b.slug is null
group by b.id, b.name, s.plan, s.note, s.updated_at
order by s.updated_at desc;

-- 3d. ONLY if Step 11 was ever installed (skip if this errors with "relation does not exist"):
--     payment requests created, reported or cancelled by someone who is not a current owner/admin
--     of that business and not a payment approver. (A person removed since then also shows here.)
-- select r.ref, r.business_name, r.status, r.created_by, r.reported_by, r.decided_by, r.created_at, r.decided_at
-- from public.payment_requests r
-- where (r.created_by is not null and r.created_by not in (select m.email from public.members m where m.business_id = r.business_id and m.role in ('owner','admin')))
--    or (r.reported_by is not null and r.reported_by not in (select m.email from public.members m where m.business_id = r.business_id and m.role in ('owner','admin')))
--    or (r.status = 'cancelled' and r.decided_by is not null
--        and r.decided_by not in (select m.email from public.members m where m.business_id = r.business_id and m.role in ('owner','admin'))
--        and r.decided_by <> 'falaktravelagency11@gmail.com'
--        and not exists (select 1 from public.billing_config c, jsonb_array_elements_text(coalesce(c.value->'approvers','[]'::jsonb)) e where lower(e) = r.decided_by))
-- order by r.created_at desc;
