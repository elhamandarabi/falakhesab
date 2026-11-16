-- =====================================================================
--  Falak.io — Step 4: safety checks inside the database
--  Supabase → SQL Editor → New query → paste ALL of this → Run
--
--  Changes no data. Adds two checks that the database itself enforces,
--  so they also apply if someone bypasses the website:
--   1. Lock date: nothing dated on or before the business lock date can be
--      added, changed or deleted. (Marking an old transaction as "cleared"
--      in bank reconciliation and sharing links are still allowed.)
--   2. Journal entries must balance (total debit = total credit).
--  Safe to run more than once.  To undo: run step4-undo.sql
-- =====================================================================

create or replace function public.falak_check_record() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lock_date text;
  free_keys text[] := array['cleared','clearedFrom','clearedTo','shareToken'];
  dr numeric; cr numeric;
begin
  -- business being deleted (cascade) → allow
  if tg_op = 'DELETE' and not exists (select 1 from public.businesses where id = old.business_id) then
    return old;
  end if;

  select nullif(settings->>'lockDate', '') into lock_date
    from public.businesses where id = coalesce(new.business_id, old.business_id);

  if lock_date is not null then
    if tg_op in ('UPDATE','DELETE') and nullif(old.data->>'date','') is not null and old.data->>'date' <= lock_date then
      if not (tg_op = 'UPDATE' and (old.data - free_keys) = (new.data - free_keys) and old.type = new.type) then
        raise exception 'Books are locked up to %. This transaction cannot be changed or deleted.', lock_date;
      end if;
    end if;
    if tg_op in ('INSERT','UPDATE') and nullif(new.data->>'date','') is not null and new.data->>'date' <= lock_date
       and not (tg_op = 'UPDATE' and (old.data - free_keys) = (new.data - free_keys)) then
      raise exception 'Books are locked up to %. Choose a later date.', lock_date;
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') and new.type = 'journal' then
    select coalesce(sum(round(coalesce(nullif(l->>'debit','')::numeric, 0), 2)), 0),
           coalesce(sum(round(coalesce(nullif(l->>'credit','')::numeric, 0), 2)), 0)
      into dr, cr
      from jsonb_array_elements(coalesce(new.data->'lines', '[]'::jsonb)) l;
    if dr <> cr then
      raise exception 'Journal entry does not balance: debit % and credit %.', dr, cr;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists falak_check_record on public.records;
create trigger falak_check_record before insert or update or delete on public.records
  for each row execute function public.falak_check_record();

-- Done. You should see "Success. No rows returned".
