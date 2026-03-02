-- ============================================================================
-- POI CATEGORIES WITH MAP EMOJI ICONS
-- Adds managed category dictionary for POIs and links POIs to categories.
-- Keeps backward compatibility with existing text category field.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.poi_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_pl text,
  icon text not null default '📍',
  color text not null default '#2563eb',
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.poi_categories
  add constraint poi_categories_slug_not_blank
  check (length(trim(slug)) > 0);

alter table public.poi_categories
  add constraint poi_categories_name_en_not_blank
  check (length(trim(name_en)) > 0);

create or replace function public.trg_poi_categories_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_poi_categories_set_updated_at on public.poi_categories;
create trigger trg_poi_categories_set_updated_at
before update on public.poi_categories
for each row
execute function public.trg_poi_categories_set_updated_at();

alter table public.pois
  add column if not exists category text;

alter table public.pois
  add column if not exists category_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'pois'
      and constraint_name = 'pois_category_id_fkey'
  ) then
    alter table public.pois
      add constraint pois_category_id_fkey
      foreign key (category_id)
      references public.poi_categories(id)
      on delete set null;
  end if;
end $$;

insert into public.poi_categories (slug, name_en, name_pl, icon, color, display_order, active)
values
  ('uncategorized', 'Uncategorized', 'Bez kategorii', '📍', '#2563eb', 0, true),
  ('landmark', 'Landmark', 'Zabytek', '🏛️', '#0f766e', 10, true),
  ('beach', 'Beach', 'Plaża', '🏖️', '#0ea5e9', 20, true),
  ('nature', 'Nature', 'Natura', '🌿', '#16a34a', 30, true),
  ('viewpoint', 'Viewpoint', 'Punkt widokowy', '🌄', '#f59e0b', 40, true),
  ('food', 'Food & Drink', 'Jedzenie i napoje', '🍽️', '#f97316', 50, true),
  ('shopping', 'Shopping', 'Zakupy', '🛍️', '#8b5cf6', 60, true),
  ('activity', 'Activity', 'Aktywność', '🎯', '#ef4444', 70, true),
  ('airport', 'Airport', 'Lotnisko', '✈️', '#2563eb', 80, true)
on conflict (slug) do nothing;

insert into public.poi_categories (slug, name_en, name_pl, icon, color, display_order, active)
select
  existing.slug_norm as slug,
  initcap(replace(existing.slug_norm, '-', ' ')) as name_en,
  initcap(replace(existing.slug_norm, '-', ' ')) as name_pl,
  '📍' as icon,
  '#2563eb' as color,
  900 as display_order,
  true as active
from (
  select distinct
    coalesce(
      nullif(
        regexp_replace(
          regexp_replace(lower(trim(coalesce(p.category, ''))), '[^a-z0-9]+', '-', 'g'),
          '(^-|-$)',
          '',
          'g'
        ),
        ''
      ),
      'uncategorized'
    ) as slug_norm
  from public.pois p
) as existing
where existing.slug_norm <> ''
on conflict (slug) do nothing;

update public.pois
set category = 'uncategorized'
where category is null or trim(category) = '';

update public.pois p
set category_id = c.id
from public.poi_categories c
where p.category_id is null
  and c.slug = coalesce(
    nullif(
      regexp_replace(
        regexp_replace(lower(trim(coalesce(p.category, ''))), '[^a-z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      ),
      ''
    ),
    'uncategorized'
  );

create index if not exists idx_pois_category_id on public.pois(category_id);
create index if not exists idx_pois_category on public.pois(category);
create index if not exists idx_poi_categories_active_order on public.poi_categories(active, display_order, name_en);

alter table public.poi_categories enable row level security;

drop policy if exists poi_categories_select_public on public.poi_categories;
create policy poi_categories_select_public
  on public.poi_categories
  for select
  using (active = true or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  ));

drop policy if exists poi_categories_all_admin on public.poi_categories;
create policy poi_categories_all_admin
  on public.poi_categories
  for all
  using (exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  ))
  with check (exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  ));

grant select on public.poi_categories to anon, authenticated;
grant insert, update, delete on public.poi_categories to authenticated;
