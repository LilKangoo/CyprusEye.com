-- Link recommendation categories with POI categories for unified map filtering.

alter table public.recommendation_categories
  add column if not exists poi_category_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'recommendation_categories'
      and constraint_name = 'recommendation_categories_poi_category_id_fkey'
  ) then
    alter table public.recommendation_categories
      add constraint recommendation_categories_poi_category_id_fkey
      foreign key (poi_category_id)
      references public.poi_categories(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_recommendation_categories_poi_category_id
  on public.recommendation_categories(poi_category_id);

-- Backfill links where category names match POI category slugs.
update public.recommendation_categories rc
set poi_category_id = pc.id
from public.poi_categories pc
where rc.poi_category_id is null
  and pc.active = true
  and pc.slug = regexp_replace(lower(coalesce(rc.name_en, '')), '[^a-z0-9]+', '-', 'g');

create or replace function public.sync_recommendation_category_poi_link()
returns trigger
language plpgsql
as $$
declare
  normalized_slug text;
  matched_poi_category_id uuid;
begin
  if NEW.poi_category_id is not null then
    return NEW;
  end if;

  normalized_slug := regexp_replace(lower(coalesce(NEW.name_en, '')), '[^a-z0-9]+', '-', 'g');

  if normalized_slug is null or normalized_slug = '' then
    return NEW;
  end if;

  select pc.id
    into matched_poi_category_id
  from public.poi_categories pc
  where pc.active = true
    and pc.slug = normalized_slug
  order by pc.display_order asc, pc.created_at asc
  limit 1;

  if matched_poi_category_id is not null then
    NEW.poi_category_id := matched_poi_category_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists sync_recommendation_category_poi_link_trigger
  on public.recommendation_categories;

create trigger sync_recommendation_category_poi_link_trigger
before insert or update on public.recommendation_categories
for each row
execute function public.sync_recommendation_category_poi_link();
