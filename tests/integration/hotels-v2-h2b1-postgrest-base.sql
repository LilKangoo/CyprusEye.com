\set ON_ERROR_STOP on

-- Disposable, local-only H2B.1 fixture. The H2A harness supplies synthetic
-- auth/admin/partner identities and the exact legacy property IDs. This file
-- reshapes only the synthetic 7 Arches row to the reviewed H2B.1 source
-- contract before applying H2B and H2B.1.
\ir hotels-v2-h2a-rpc-hotfix-postgrest-base.sql

update public.hotels
set
  description = jsonb_build_object(
    'en',
    'All apartments are air-conditioned. The property accepts children from 10 years old. For bookings above 4 people accommodation uses 2 apartments.'
  ),
  photos = (
    select jsonb_agg('/images/7a-' || photo_number || '.webp' order by photo_number)
    from generate_series(1, 9) photo_number
  ),
  pricing_model = 'tiered_by_nights',
  pricing_tiers = jsonb_build_object(
    'currency', 'EUR',
    'rules', (
      select jsonb_agg(
        jsonb_build_object(
          'persons', guest_count,
          'min_nights', night_count,
          'price_per_night', guest_count * 25 + (10 - night_count) * 2
        )
        order by guest_count, night_count
      )
      from generate_series(2, 8) guest_count
      cross join generate_series(2, 10) night_count
    )
  ),
  amenities = jsonb_build_array('wifi','air_conditioning','terrace','balcony'),
  max_persons = 8,
  architecture_version = 'legacy'
where id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';

insert into public.hotel_amenities(
  code, category, name_en, name_pl, name_he, is_active
) values
  ('air_conditioning', 'general', 'Air conditioning', 'Klimatyzacja', 'מיזוג אוויר', true),
  ('terrace', 'outdoor', 'Terrace', 'Taras', 'טרסה', true),
  ('balcony', 'room', 'Balcony', 'Balkon', 'מרפסת', true)
on conflict(code) do update set is_active = true;

\ir ../../supabase/migrations/20260811230000_hotels_v2_h2b_calendar_rates_foundation.sql
\ir ../../supabase/migrations/20260811240000_hotels_v2_h2b1_children_shadow_rooms.sql
\ir ../../supabase/migrations/20260811250000_hotels_v2_h2b1_shadow_policy_review_fix.sql
\ir ../../supabase/migrations/20260811260000_hotels_v2_h2b1_shadow_three_way_merge.sql

notify pgrst, 'reload schema';
