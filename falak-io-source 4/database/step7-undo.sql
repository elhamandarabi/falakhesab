-- =====================================================================
--  Falak.io — UNDO Step 7 (plans and payments)
--  Removes plans, trials, limits and the payment list. Accounting data is not touched.
--  WARNING: the list of payments you recorded is deleted too. Export it first if needed.
-- =====================================================================
drop trigger if exists falak_business_plan on public.businesses;
drop trigger if exists falak_check_plan_record on public.records;
drop trigger if exists falak_check_plan_member on public.members;
drop trigger if exists falak_check_plan_slug on public.businesses;
drop function if exists public.falak_on_business_plan();
drop function if exists public.falak_check_plan_record();
drop function if exists public.falak_check_plan_member();
drop function if exists public.falak_check_plan_slug();
drop function if exists public.falak_plan_state(uuid);
drop function if exists public.falak_plan_allows(uuid, text);
drop function if exists public.falak_choose_free(uuid);
drop function if exists public.falak_request_plan(uuid, text);
drop function if exists public.falak_mark_paid(uuid, text, int, numeric, text, text);
drop function if exists public.falak_admin_set(uuid, text, text);
drop table if exists public.payments;
drop table if exists public.subscriptions;
drop table if exists public.trial_log;
drop table if exists public.app_config;
-- Done. You should see "Success. No rows returned".
