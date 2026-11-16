-- =====================================================================
--  Falak.io — Step 6: company addresses (falakhesab.com/<company>)
--  Supabase → SQL Editor → New query → paste ALL of this → Run
--
--  Changes no data. Adds an optional "address" (slug) to each business and
--  a small public function that returns ONLY the company name and logo for
--  its sign-in page. No accounting data is ever shown before sign-in.
--  Safe to run more than once. To undo: step6-undo.sql
-- =====================================================================

alter table public.businesses add column if not exists slug text;

do $$ begin
  alter table public.businesses add constraint businesses_slug_format check (
    slug is null or (
      slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
      and slug not in ('admin','api','app','www','mail','login','signup','sign-in','register','reset','share','support',
                       'help','assets','vendor','static','index','falak','falakhesab','falak-io','settings','dashboard',
                       'billing','pricing','terms','privacy','about','contact','blog','docs','status')));
exception when duplicate_object then null; end $$;

create unique index if not exists businesses_slug_key on public.businesses (slug);

-- public: company name + logo for the branded sign-in page (nothing else)
create or replace function public.falak_workspace(s text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('slug', b.slug, 'name', b.name, 'logo', coalesce(b.settings->>'logo', ''))
  from public.businesses b
  where b.slug is not null and b.slug = lower(trim(s))
  limit 1
$$;
revoke all on function public.falak_workspace(text) from public;
grant execute on function public.falak_workspace(text) to anon, authenticated;

-- signed-in owners/admins: is an address still free?
create or replace function public.falak_slug_free(s text, bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.businesses b where b.slug = lower(trim(s)) and b.id <> bid)
$$;
revoke all on function public.falak_slug_free(text, uuid) from public;
grant execute on function public.falak_slug_free(text, uuid) to authenticated;

-- Done. You should see "Success. No rows returned".
