-- Falak.io — UNDO Step 5 (stop enforcing two-step login in the database)
do $$
declare t text;
begin
  foreach t in array array['businesses','members','records','profiles','history'] loop
    execute format('drop policy if exists falak_mfa on public.%I', t);
  end loop;
end $$;
drop function if exists public.falak_mfa_ok();
-- Done. You should see "Success. No rows returned".
