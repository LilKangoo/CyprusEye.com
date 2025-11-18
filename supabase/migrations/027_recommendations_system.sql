-- ============================================================================
-- RECOMMENDATIONS SYSTEM - CyprusEye
-- System rekomendacji miejsc przez administratorów
-- ============================================================================

-- Extensions (if not enabled)
create extension if not exists pgcrypto;
create extension if not exists postgis;

-- ============================================================================
-- TABLE: recommendation_categories
-- Kategorie rekomendacji (zakwaterowanie, restauracje, wynajem aut, plaże, etc.)
-- ============================================================================
create table if not exists public.recommendation_categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_el text,
  name_pl text,
  name_he text,
  name_ru text,
  icon text, -- np. 'hotel', 'restaurant', 'car', 'beach'
  color text default '#FF6B35', -- kolor dla znacznika na mapie
  display_order int default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- TABLE: recommendations
-- Główna tabela rekomendacji
-- ============================================================================
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.recommendation_categories(id) on delete restrict,
  
  -- Podstawowe informacje (wielojęzyczne)
  title_en text not null,
  title_el text,
  title_pl text,
  title_he text,
  title_ru text,
  
  description_en text not null,
  description_el text,
  description_pl text,
  description_he text,
  description_ru text,
  
  -- Lokalizacja
  location_name text not null, -- np. "Larnaka", "Paphos", lub custom
  latitude numeric,
  longitude numeric,
  geography geography(Point, 4326), -- PostGIS point dla zaawansowanych zapytań
  
  -- Media
  image_url text, -- główne zdjęcie
  images jsonb default '[]'::jsonb, -- dodatkowe zdjęcia jako array URL-i
  
  -- Linki i kontakt
  google_url text,
  website_url text,
  phone text,
  email text,
  
  -- Promocje (wielojęzyczne)
  promo_code text,
  discount_text_en text,
  discount_text_el text,
  discount_text_pl text,
  discount_text_he text,
  discount_text_ru text,
  
  offer_text_en text,
  offer_text_el text,
  offer_text_pl text,
  offer_text_he text,
  offer_text_ru text,
  
  -- Metadata
  display_order int default 0, -- kolejność wyświetlania
  priority int default 0, -- priorytet (wyższy = ważniejsze)
  view_count int default 0,
  click_count int default 0,
  
  -- Status
  active boolean default true,
  featured boolean default false, -- wyróżnione rekomendacje
  
  -- Audyt
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Constraints
  constraint check_coordinates check (
    (latitude is null and longitude is null) or 
    (latitude is not null and longitude is not null and 
     latitude between -90 and 90 and 
     longitude between -180 and 180)
  )
);

-- ============================================================================
-- TABLE: recommendation_views
-- Śledzenie wyświetleń rekomendacji
-- ============================================================================
create table if not exists public.recommendation_views (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  user_id uuid references auth.users(id),
  viewed_at timestamptz default now(),
  ip_address text,
  user_agent text
);

-- ============================================================================
-- TABLE: recommendation_clicks
-- Śledzenie kliknięć w linki rekomendacji
-- ============================================================================
create table if not exists public.recommendation_clicks (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  click_type text not null check (click_type in ('google', 'website', 'phone', 'promo')),
  user_id uuid references auth.users(id),
  clicked_at timestamptz default now(),
  ip_address text,
  user_agent text
);

-- ============================================================================
-- INDEXES
-- ============================================================================
create index if not exists idx_recommendation_categories_active 
  on public.recommendation_categories(active, display_order);

create index if not exists idx_recommendations_category 
  on public.recommendations(category_id) where active;

create index if not exists idx_recommendations_active 
  on public.recommendations(active, display_order asc, priority desc, created_at desc);

create index if not exists idx_recommendations_featured 
  on public.recommendations(featured, priority desc) where active;

create index if not exists idx_recommendations_location 
  on public.recommendations(location_name) where active;

create index if not exists idx_recommendations_geography 
  on public.recommendations using gist(geography) where active and geography is not null;

create index if not exists idx_recommendation_views_recommendation 
  on public.recommendation_views(recommendation_id, viewed_at desc);

create index if not exists idx_recommendation_clicks_recommendation 
  on public.recommendation_clicks(recommendation_id, clicked_at desc);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Funkcja do automatycznego tworzenia geography z lat/lng
create or replace function public.sync_recommendation_geography() 
returns trigger language plpgsql as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.geography := ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.geography := null;
  end if;
  return new;
end;
$$;

-- Funkcja do inkrementacji licznika wyświetleń
create or replace function public.increment_recommendation_views(rec_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.recommendations
  set view_count = view_count + 1
  where id = rec_id;
end;
$$;

-- Funkcja do inkrementacji licznika kliknięć
create or replace function public.increment_recommendation_clicks(rec_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.recommendations
  set click_count = click_count + 1
  where id = rec_id;
end;
$$;

-- Funkcja do pobierania rekomendacji w pobliżu
create or replace function public.get_recommendations_nearby(
  user_lat numeric,
  user_lng numeric,
  radius_meters numeric default 50000,
  limit_count int default 20
)
returns table (
  id uuid,
  category_id uuid,
  title_en text,
  title_el text,
  title_pl text,
  description_en text,
  location_name text,
  latitude numeric,
  longitude numeric,
  image_url text,
  google_url text,
  promo_code text,
  discount_text_en text,
  display_order int,
  priority int,
  distance_meters numeric
) language sql stable as $$
  select 
    r.id,
    r.category_id,
    r.title_en,
    r.title_el,
    r.title_pl,
    r.description_en,
    r.location_name,
    r.latitude,
    r.longitude,
    r.image_url,
    r.google_url,
    r.promo_code,
    r.discount_text_en,
    r.display_order,
    r.priority,
    ST_Distance(r.geography, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) as distance_meters
  from public.recommendations r
  where 
    r.active = true
    and r.geography is not null
    and ST_DWithin(
      r.geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
  order by r.display_order asc, r.priority desc, distance_meters asc
  limit limit_count;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger dla updated_at
create trigger set_recommendation_categories_updated_at 
  before update on public.recommendation_categories
  for each row execute procedure public.set_updated_at();

create trigger set_recommendations_updated_at 
  before update on public.recommendations
  for each row execute procedure public.set_updated_at();

-- Trigger dla automatycznego geography
create trigger sync_recommendation_geography_trigger
  before insert or update on public.recommendations
  for each row execute procedure public.sync_recommendation_geography();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

alter table public.recommendation_categories enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_views enable row level security;
alter table public.recommendation_clicks enable row level security;

-- Policies: recommendation_categories
-- Wszyscy mogą czytać aktywne kategorie
create policy recommendation_categories_select_public 
  on public.recommendation_categories for select 
  using (active = true);

-- Admin może wszystko
create policy recommendation_categories_all_admin 
  on public.recommendation_categories for all 
  using (public.is_admin()) 
  with check (public.is_admin());

-- Policies: recommendations
-- Wszyscy mogą czytać aktywne rekomendacje
create policy recommendations_select_public 
  on public.recommendations for select 
  using (active = true);

-- Admin może wszystko
create policy recommendations_all_admin 
  on public.recommendations for all 
  using (public.is_admin()) 
  with check (public.is_admin());

-- Policies: recommendation_views
-- Użytkownicy mogą dodawać swoje wyświetlenia
create policy recommendation_views_insert_public 
  on public.recommendation_views for insert 
  with check (true);

-- Admin może czytać wszystkie
create policy recommendation_views_select_admin 
  on public.recommendation_views for select 
  using (public.is_admin());

-- Policies: recommendation_clicks
-- Użytkownicy mogą dodawać swoje kliknięcia
create policy recommendation_clicks_insert_public 
  on public.recommendation_clicks for insert 
  with check (true);

-- Admin może czytać wszystkie
create policy recommendation_clicks_select_admin 
  on public.recommendation_clicks for select 
  using (public.is_admin());

-- ============================================================================
-- SEED DATA - Domyślne kategorie
-- ============================================================================

insert into public.recommendation_categories (name_en, name_el, name_pl, name_he, name_ru, icon, color, display_order) values
  ('Accommodation', 'Διαμονή', 'Zakwaterowanie', 'לינה', 'Размещение', 'hotel', '#FF6B35', 1),
  ('Restaurants', 'Εστιατόρια', 'Restauracje', 'מסעדות', 'Рестораны', 'restaurant', '#4ECDC4', 2),
  ('Car Rentals', 'Ενοικίαση Αυτοκινήτων', 'Wynajem Aut', 'השכרת רכב', 'Аренда авто', 'directions_car', '#FFE66D', 3),
  ('Beaches', 'Παραλίες', 'Plaże', 'חופים', 'Пляжи', 'beach_access', '#95E1D3', 4),
  ('Activities', 'Δραστηριότητες', 'Aktywności', 'פעילויות', 'Активности', 'local_activity', '#F38181', 5),
  ('Shopping', 'Ψώνια', 'Zakupy', 'קניות', 'Покупки', 'shopping_bag', '#AA96DA', 6),
  ('Nightlife', 'Νυχτερινή Ζωή', 'Życie Nocne', 'חיי לילה', 'Ночная жизнь', 'nightlife', '#FCBAD3', 7),
  ('Services', 'Υπηρεσίες', 'Usługi', 'שירותים', 'Услуги', 'miscellaneous_services', '#A8D8EA', 8)
on conflict do nothing;

-- ============================================================================
-- GRANTS
-- ============================================================================

grant usage on schema public to anon, authenticated;
grant select on public.recommendation_categories to anon, authenticated;
grant select on public.recommendations to anon, authenticated;
grant insert on public.recommendation_views to anon, authenticated;
grant insert on public.recommendation_clicks to anon, authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table public.recommendation_categories is 'Kategorie rekomendacji miejsc (hotele, restauracje, etc.)';
comment on table public.recommendations is 'Rekomendacje miejsc przez administratorów z promocjami i ofertami';
comment on table public.recommendation_views is 'Śledzenie wyświetleń rekomendacji';
comment on table public.recommendation_clicks is 'Śledzenie kliknięć w linki rekomendacji';
comment on function public.get_recommendations_nearby is 'Pobiera rekomendacje w określonym promieniu od podanej lokalizacji';
