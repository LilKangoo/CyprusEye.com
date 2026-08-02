begin;

-- Car Rental Multi-City Stage 2C: additive Admin metadata only.
-- This column is not consumed by any public reader in Stage 2C.

alter table public.car_rental_cities
  add column place_types text[] not null default array['city']::text[],
  add constraint car_rental_cities_place_types_check check (
    cardinality(place_types) > 0
    and place_types <@ array[
      'city',
      'airport',
      'hotel',
      'port',
      'station',
      'address'
    ]::text[]
  );

comment on column public.car_rental_cities.place_types is
  'Stage 2C Admin classification only. It has no public runtime effect while mapped availability is disabled.';

commit;
