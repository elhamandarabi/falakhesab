-- =====================================================================
--  Falak.io — Step 3: security fixes
--  Supabase → SQL Editor → New query → paste ALL of this → Run
--
--  Changes ONLY who may see / change what. It does not change, move or
--  delete any of your data. Safe to run more than once.
--
--  1. Only the Owner can add, change or remove an Owner.
--     (Admins can no longer remove or downgrade you.)
--  2. An Owner cannot accidentally downgrade themselves.
--  3. Salaries (Payslips) are private: limited users see them only if
--     they have the Payslips, Employees or Reports tab.
--  4. A record cannot be moved from one business into another.
--  5. Only the super admin can change who "owns" a business row.
--
--  To undo: run step3-undo.sql
-- =====================================================================

-- ---------- 1 + 2: protect the Owner ----------
drop policy if exists mem_insert on public.members;
drop policy if exists mem_update on public.members;
drop policy if exists mem_delete on public.members;

create policy mem_insert on public.members for insert
  with check (public.falak_role(business_id) in ('owner','admin')
              and (role <> 'owner' or public.falak_role(business_id) = 'owner'));

create policy mem_update on public.members for update
  using      (public.falak_role(business_id) in ('owner','admin')
              and (role <> 'owner' or public.falak_role(business_id) = 'owner'))
  with check (public.falak_role(business_id) in ('owner','admin')
              and (role <> 'owner' or public.falak_role(business_id) = 'owner'));

create policy mem_delete on public.members for delete
  using (public.falak_role(business_id) in ('owner','admin')
         and (role <> 'owner' or public.falak_is_super()));

create or replace function public.falak_guard_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and new.role <> 'owner' and not public.falak_is_super() then
    raise exception 'The Owner cannot be downgraded. Make someone else Owner first (ask the super admin).';
  end if;
  if new.business_id <> old.business_id then
    raise exception 'A member cannot be moved to another business.';
  end if;
  return new;
end $$;
drop trigger if exists falak_guard_member on public.members;
create trigger falak_guard_member before update on public.members
  for each row execute function public.falak_guard_member();

-- ---------- 3: private payslips ----------
create or replace function public.falak_can_see_type(bid uuid, t text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.falak_is_super() then true
    when t <> 'payslip' then public.falak_role(bid) is not null
    else coalesce((select m.role in ('owner','admin','viewer')
                          or m.tabs && array['payslip','employee','reports']
                   from public.members m
                   where m.business_id = bid and m.email = public.falak_email() limit 1), false)
  end
$$;

drop policy if exists rec_select on public.records;
create policy rec_select on public.records for select
  using (public.falak_can_see_type(business_id, type));

-- ---------- 4: records stay in their business ----------
create or replace function public.falak_guard_record() returns trigger
language plpgsql as $$
begin
  if new.business_id <> old.business_id or new.id <> old.id then
    raise exception 'A record cannot be moved to another business.';
  end if;
  return new;
end $$;
drop trigger if exists falak_guard_record on public.records;
create trigger falak_guard_record before update on public.records
  for each row execute function public.falak_guard_record();

-- ---------- 5: business owner column ----------
create or replace function public.falak_guard_business() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner <> old.owner and not public.falak_is_super() then
    raise exception 'Only the super admin can change the owner of a business.';
  end if;
  return new;
end $$;
drop trigger if exists falak_guard_business on public.businesses;
create trigger falak_guard_business before update on public.businesses
  for each row execute function public.falak_guard_business();

-- Done. You should see "Success. No rows returned".
