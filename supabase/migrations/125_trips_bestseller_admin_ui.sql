-- Trips bestseller support for admin controls and public ordering.
alter table public.trips
  add column if not exists is_bestseller boolean not null default false;

create index if not exists idx_trips_published_bestseller_sort
  on public.trips (is_published, is_bestseller desc, sort_order asc, created_at desc);
