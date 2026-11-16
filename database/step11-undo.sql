-- Undo Step 11 (bank transfer payments). Deletes payment requests and their settings.
-- Approved payments stay in the payments table and subscriptions keep their dates.
drop policy if exists falak_receipt_select on storage.objects;
drop policy if exists falak_receipt_insert on storage.objects;
drop function if exists public.falak_receipt_ok(text, text);
drop function if exists public.falak_billing_invoice(uuid, text, date);
drop function if exists public.falak_billing_decide(uuid, text, text, numeric, text, text, date, text);
drop function if exists public.falak_billing_cancel(uuid);
drop function if exists public.falak_billing_report(uuid, jsonb, text);
drop function if exists public.falak_billing_create(uuid, text, int, text, text, jsonb);
drop function if exists public.falak_billing_save(jsonb);
drop function if exists public.falak_billing_public();
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select to authenticated
  using (public.falak_is_super() or public.falak_role(business_id) in ('owner','admin'));
drop table if exists public.payment_requests;
drop table if exists public.billing_config;
drop function if exists public.falak_is_billing_admin();
drop function if exists public.falak_txt(jsonb);
notify pgrst, 'reload schema';
-- The storage bucket 'payment-receipts' is kept (files are evidence). Delete it in Storage if you really want to.
