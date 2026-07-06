-- Special Offers 3B.3A draft only.
-- Adds localized public copy for prizes and linked services.
-- Do not run automatically. Review manually before applying in Supabase.

begin;

do $$
begin
  if to_regprocedure('public.special_offers_set_updated_at()') is null then
    raise exception 'Missing required trigger function public.special_offers_set_updated_at()';
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;
end;
$$;

create table if not exists public.special_offer_prize_translations (
  id uuid primary key default gen_random_uuid(),
  prize_id uuid not null references public.special_offer_prizes(id) on delete cascade,
  lang text not null,
  name text,
  description text,
  restrictions text,
  fulfillment_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_offer_prize_translations_lang_check check (lang in ('pl', 'en', 'he')),
  constraint special_offer_prize_translations_prize_lang_key unique (prize_id, lang)
);

create index if not exists idx_special_offer_prize_translations_prize
  on public.special_offer_prize_translations(prize_id);

create index if not exists idx_special_offer_prize_translations_lang
  on public.special_offer_prize_translations(lang);

create index if not exists idx_special_offer_prize_translations_prize_lang
  on public.special_offer_prize_translations(prize_id, lang);

drop trigger if exists trg_special_offer_prize_translations_set_updated_at
  on public.special_offer_prize_translations;

create trigger trg_special_offer_prize_translations_set_updated_at
  before update on public.special_offer_prize_translations
  for each row
  execute function public.special_offers_set_updated_at();

alter table public.special_offer_prize_translations enable row level security;

revoke all on public.special_offer_prize_translations from public;
revoke all on public.special_offer_prize_translations from anon;
revoke all on public.special_offer_prize_translations from authenticated;

grant select, insert, update, delete on public.special_offer_prize_translations to authenticated;
grant all on public.special_offer_prize_translations to service_role;

drop policy if exists "Admins can select special offer prize translations"
  on public.special_offer_prize_translations;
create policy "Admins can select special offer prize translations"
  on public.special_offer_prize_translations
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Admins can insert special offer prize translations"
  on public.special_offer_prize_translations;
create policy "Admins can insert special offer prize translations"
  on public.special_offer_prize_translations
  for insert
  to authenticated
  with check (public.is_current_user_admin());

drop policy if exists "Admins can update special offer prize translations"
  on public.special_offer_prize_translations;
create policy "Admins can update special offer prize translations"
  on public.special_offer_prize_translations
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Admins can delete special offer prize translations"
  on public.special_offer_prize_translations;
create policy "Admins can delete special offer prize translations"
  on public.special_offer_prize_translations
  for delete
  to authenticated
  using (public.is_current_user_admin());

create table if not exists public.special_offer_link_translations (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.special_offer_links(id) on delete cascade,
  lang text not null,
  label text,
  description text,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_offer_link_translations_lang_check check (lang in ('pl', 'en', 'he')),
  constraint special_offer_link_translations_link_lang_key unique (link_id, lang)
);

create index if not exists idx_special_offer_link_translations_link
  on public.special_offer_link_translations(link_id);

create index if not exists idx_special_offer_link_translations_lang
  on public.special_offer_link_translations(lang);

create index if not exists idx_special_offer_link_translations_link_lang
  on public.special_offer_link_translations(link_id, lang);

drop trigger if exists trg_special_offer_link_translations_set_updated_at
  on public.special_offer_link_translations;

create trigger trg_special_offer_link_translations_set_updated_at
  before update on public.special_offer_link_translations
  for each row
  execute function public.special_offers_set_updated_at();

alter table public.special_offer_link_translations enable row level security;

revoke all on public.special_offer_link_translations from public;
revoke all on public.special_offer_link_translations from anon;
revoke all on public.special_offer_link_translations from authenticated;

grant select, insert, update, delete on public.special_offer_link_translations to authenticated;
grant all on public.special_offer_link_translations to service_role;

drop policy if exists "Admins can select special offer link translations"
  on public.special_offer_link_translations;
create policy "Admins can select special offer link translations"
  on public.special_offer_link_translations
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists "Admins can insert special offer link translations"
  on public.special_offer_link_translations;
create policy "Admins can insert special offer link translations"
  on public.special_offer_link_translations
  for insert
  to authenticated
  with check (public.is_current_user_admin());

drop policy if exists "Admins can update special offer link translations"
  on public.special_offer_link_translations;
create policy "Admins can update special offer link translations"
  on public.special_offer_link_translations
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Admins can delete special offer link translations"
  on public.special_offer_link_translations;
create policy "Admins can delete special offer link translations"
  on public.special_offer_link_translations
  for delete
  to authenticated
  using (public.is_current_user_admin());

comment on table public.special_offer_prize_translations is
  'Localized public-facing Special Offers prize copy. Admin-only in stage 3B.3A.';
comment on column public.special_offer_prize_translations.prize_id is
  'Parent special_offer_prizes row. Operational prize fields remain on the parent row.';
comment on column public.special_offer_prize_translations.lang is
  'Supported campaign language: pl, en, he.';

comment on table public.special_offer_link_translations is
  'Localized public-facing Special Offers link label, description, and URL. Admin-only in stage 3B.3A.';
comment on column public.special_offer_link_translations.link_id is
  'Parent special_offer_links row. resource_id remains on the parent row.';
comment on column public.special_offer_link_translations.url is
  'Localized URL. Admin UI should validate absolute http(s) URLs or relative paths starting with /.';

commit;
