-- =====================================================================
--  Falak Hesab — UNDO Step 9 (attachments)
--  Removes the access rules. Files already uploaded stay in Storage →
--  attachments until you delete them there. Accounting data is not touched.
-- =====================================================================
drop policy if exists falak_att_select on storage.objects;
drop policy if exists falak_att_insert on storage.objects;
drop policy if exists falak_att_delete on storage.objects;
drop function if exists public.falak_att_ok(text, text);
-- Done. You should see "Success. No rows returned".
