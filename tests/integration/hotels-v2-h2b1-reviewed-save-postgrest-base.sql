\set ON_ERROR_STOP on

-- Disposable reconstruction of the deployed Admin re-review state: the
-- exact two shadow rooms and dormant pricing graph already exist, but the
-- property policy is still 15 while the reviewed source contract requires 10.
\ir hotels-v2-h2b1-postgrest-base.sql

update public.hotels
set photos = jsonb_build_array(
  'https://uhnewnycowtrswxrcsez.supabase.co/storage/v1/object/public/hotels/7-ukow/property-01.webp',
  'https://uhnewnycowtrswxrcsez.supabase.co/storage/v1/object/public/hotels/7-ukow/property-02.webp',
  'https://uhnewnycowtrswxrcsez.supabase.co/storage/v1/object/public/hotels/7-ukow/property-03.webp',
  'https://uhnewnycowtrswxrcsez.supabase.co/storage/v1/object/public/hotels/7-ukow/property-04.webp',
  'https://uhnewnycowtrswxrcsez.supabase.co/storage/v1/object/public/hotels/7-ukow/property-05.webp',
  'https://uhnewnycowtrswxrcsez.supabase.co/storage/v1/object/public/hotels/7-ukow/property-06.webp',
  'https://uhnewnycowtrswxrcsez.supabase.co/storage/v1/object/public/hotels/7-ukow/property-07.webp',
  'https://uhnewnycowtrswxrcsez.supabase.co/storage/v1/object/public/hotels/7-ukow/property-08.webp',
  'https://uhnewnycowtrswxrcsez.supabase.co/storage/v1/object/public/hotels/7-ukow/property-09.webp'
)
where id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';

create function pg_temp.reviewed_seed_plan()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $function$
  select jsonb_build_object(
    'hotel_id', hotel.id,
    'expected_property_updated_at', hotel.updated_at,
    'expected_property_policy', jsonb_build_object(
      'children_policy', hotel.children_policy,
      'minimum_child_age', hotel.minimum_child_age
    ),
    'reviewed_at', clock_timestamp(),
    'source_contract', 'seven_arches_two_apartments_v1',
    'expected_legacy_pricing_fingerprint', md5(hotel.pricing_tiers::text),
    'expected_property_policy', jsonb_build_object(
      'children_policy', hotel.children_policy,
      'minimum_child_age', hotel.minimum_child_age
    ),
    'expected_versions', jsonb_build_object(
      'upper_room', 0,
      'ground_room', 0,
      'pricing_schedule', 0,
      'property_party_preview', 0,
      'rate_plan', 0,
      'upper_room_rate', 0,
      'ground_room_rate', 0
    ),
    'property_policy', jsonb_build_object(
      'children_policy', 'minimum_age', 'minimum_child_age', 10
    ),
    'rooms', jsonb_build_array(
      jsonb_build_object(
        'id', 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
        'expected_version', 0,
        'source_key', 'upper_floor_apartment',
        'code', 'upper-floor-apartment',
        'name_i18n', jsonb_build_object(
          'pl', 'Apartament na piętrze', 'en', 'Upper Floor Apartment',
          'he', 'דירה בקומה העליונה'
        ),
        'description_i18n', '{}'::jsonb,
        'gallery', jsonb_build_array(hotel.photos->>0, hotel.photos->>1),
        'amenities', jsonb_build_array('air_conditioning', 'terrace', 'balcony'),
        'max_occupancy', 4,
        'sort_order', 100
      ),
      jsonb_build_object(
        'id', '825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
        'expected_version', 0,
        'source_key', 'ground_floor_apartment',
        'code', 'ground-floor-apartment',
        'name_i18n', jsonb_build_object(
          'pl', 'Apartament na parterze', 'en', 'Ground Floor Apartment',
          'he', 'דירה בקומת הקרקע'
        ),
        'description_i18n', '{}'::jsonb,
        'gallery', jsonb_build_array(hotel.photos->>2, hotel.photos->>3),
        'amenities', jsonb_build_array('air_conditioning', 'terrace'),
        'max_occupancy', 4,
        'sort_order', 200
      )
    ),
    'prepare_pricing_preview', true
  )
  from public.hotels hotel
  where hotel.id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
$function$;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);
select public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  pg_temp.reviewed_seed_plan(),
  '84000000-0000-4000-8000-000000000001'
);
commit;

-- Reconstruct the exact deployed values without firing the synthetic version
-- trigger: Upper v4, Ground v5, both ACTIVE with empty room galleries.
begin;
set local session_replication_role = replica;
update public.hotels
set children_policy = 'minimum_age', minimum_child_age = 15
where id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
update public.hotel_room_types
set
  version = case id
    when 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94' then 4
    when '825c01b7-9f82-492a-9c81-9b1d5cd7acd3' then 5
  end,
  status = 'active',
  gallery = '[]'::jsonb
where id in (
  'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
  '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'
);
commit;

notify pgrst, 'reload schema';
