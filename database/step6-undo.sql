-- =====================================================================
--  Falak.io — UNDO Step 6 (company addresses)
--  Removes company addresses. Accounting data is not touched.
-- =====================================================================

drop function if exists public.falak_workspace(text);
drop function if exists public.falak_slug_free(text, uuid);
drop index if exists public.businesses_slug_key;
alter table public.businesses drop constraint if exists businesses_slug_format;
alter table public.businesses drop column if exists slug;

-- Done. You should see "Success. No rows returned".
