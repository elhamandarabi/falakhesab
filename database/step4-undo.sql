-- Falak.io — UNDO Step 4 (removes the database lock-date and journal checks)
drop trigger if exists falak_check_record on public.records;
drop function if exists public.falak_check_record();
-- Done. You should see "Success. No rows returned".
