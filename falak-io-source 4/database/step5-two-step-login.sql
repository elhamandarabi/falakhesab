-- =====================================================================
--  Falak.io — Step 5: enforce two-step login in the database
--  Supabase → SQL Editor → New query → paste ALL of this → Run
--
--  Changes no data. For people who have turned ON two-step login, the
--  database only answers after they typed their 6-digit code. Someone with
--  only their password gets no data at all. People without two-step login
--  are not affected. Safe to run more than once. To undo: step5-undo.sql
-- =====================================================================

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
