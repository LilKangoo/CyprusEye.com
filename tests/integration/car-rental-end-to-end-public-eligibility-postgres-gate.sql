-- PostgreSQL 16 integration gate for 20260810140000.
-- Run with psql -v ON_ERROR_STOP=1 against an isolated Stage 3 + SpeedBikes DB.
-- Every fixture mutation is rolled back.

begin;

do $flags_off$
begin
  if public.car_threshold_offer_has_public_prerequisites(
       'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
     )
     or exists (
       select 1
       from public.resolve_public_threshold_offer_ids('ayia-napa', 'ayia-napa')
     ) then
    raise exception 'flags-off threshold offer leaked';
  end if;
end
$flags_off$;

-- Build a mapped directional fixture from the deterministic Snipper draft.
update public.car_offer_city_availability availability
set pickup_enabled = true,
    return_enabled = false,
    is_active = true
where availability.offer_id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
  and availability.city_id = (
    select city.id from public.car_rental_cities city where city.code = 'ayia-napa'
  );

insert into public.car_offer_city_availability (
  offer_id,
  city_id,
  pickup_enabled,
  return_enabled,
  is_active,
  fee_mode,
  fee_per_direction,
  fee_note
)
select
  'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid,
  city.id,
  false,
  true,
  true,
  'override',
  0,
  'Isolated directional-swap fixture'
from public.car_rental_cities city
where city.code = 'larnaca';

update public.site_settings
set car_multi_city_mapped_enabled = true,
    car_threshold_daily_rates_enabled = true
where id = 1;

update public.car_offers
set stock_count = 1
where id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid;

create temporary table _offer_expected_before_activation on commit drop as
select updated_at
from public.car_offers
where id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid;

select set_config('request.jwt.claim.role', 'service_role', true);

select (public.admin_set_car_threshold_offer_activation_state(
  'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid,
  (select updated_at from _offer_expected_before_activation),
  true
)).id;

do $stale_activation$
begin
  begin
    perform public.admin_set_car_threshold_offer_activation_state(
      'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid,
      (select updated_at from _offer_expected_before_activation),
      true
    );
    raise exception 'stale activation unexpectedly succeeded';
  exception when serialization_failure then
    null;
  end;
end
$stale_activation$;

do $public_contract$
declare
  v_offer_id constant uuid := 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1';
begin
  if not public.car_threshold_offer_has_public_prerequisites(v_offer_id)
     or not public.car_threshold_offer_route_is_public_eligible(
       v_offer_id, 'ayia-napa', 'larnaca'
     )
     or public.car_threshold_offer_route_is_public_eligible(
       v_offer_id, 'larnaca', 'ayia-napa'
     )
     or (select count(*) from public.resolve_public_threshold_offer_ids(
       'ayia-napa', 'larnaca'
     )) <> 1 then
    raise exception 'exact directional public resolver failed';
  end if;
end
$public_contract$;

set local role anon;
select 1 / ((select count(*) = 1 from public.car_offers
  where id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid)::integer);
select 1 / ((select count(*) = 7 from public.car_offer_daily_rate_tiers
  where offer_id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid)::integer);
select 1 / ((select count(*) = 2 from public.car_offer_city_availability
  where offer_id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid)::integer);
reset role;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000099"}',
  true
);
set local role authenticated;
select 1 / ((select count(*) = 0 from public.car_offers
  where id in (
    '2817e6de-25ba-5237-b721-dbc0460a7de4'::uuid,
    'ef800460-cfef-57c1-b3cd-7269f366b00c'::uuid
  ))::integer);
reset role;
select set_config('request.jwt.claims', '{}', true);

-- Prove invalid exact ownership cannot fall through to a resource/location
-- partner even when an explicit fallback mapping exists.
insert into public.partner_resources (
  id, partner_id, resource_type, resource_id
)
values (
  'cae20000-0000-4000-8000-000000000001'::uuid,
  'ca2f0000-0000-4000-8000-000000000001'::uuid,
  'cars',
  'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
);

update public.partners
set status = 'suspended'
where id = '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid;

do $owner_fail_closed$
declare
  v_offer_id constant uuid := 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1';
begin
  if public.partner_service_fulfillment_partner_id_for_car_booking(
       v_offer_id, 'larnaca'
     ) is not null
     or public.car_threshold_offer_has_public_prerequisites(v_offer_id)
     or exists (
       select 1 from public.resolve_public_threshold_offer_ids(
         'ayia-napa', 'larnaca'
       )
     ) then
    raise exception 'threshold exact owner fell back or remained public';
  end if;
end
$owner_fail_closed$;

update public.partners
set status = 'active'
where id = '583ee90b-d77c-47ff-97a4-76657a87809f'::uuid;

-- Whole-rowset optimistic concurrency and a cross-row directional swap.
create temporary table _availability_expected_before_swap on commit drop as
select jsonb_agg(
  jsonb_build_object('city_id', availability.city_id, 'updated_at', availability.updated_at)
  order by availability.city_id
) as rows
from public.car_offer_city_availability availability
where availability.offer_id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid;

select count(*)
from public.admin_save_car_offer_city_availability_batch(
  'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid,
  (select rows from _availability_expected_before_swap),
  jsonb_build_array(
    jsonb_build_object(
      'city_id', (select id from public.car_rental_cities where code = 'ayia-napa'),
      'pickup_enabled', false,
      'return_enabled', true,
      'fee_mode', 'override',
      'fee_per_direction', 0,
      'fee_note', 'Final return direction'
    ),
    jsonb_build_object(
      'city_id', (select id from public.car_rental_cities where code = 'larnaca'),
      'pickup_enabled', true,
      'return_enabled', false,
      'fee_mode', 'override',
      'fee_per_direction', 0,
      'fee_note', 'Final pickup direction'
    )
  )
);

do $swap_assertion$
declare
  v_offer_id constant uuid := 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1';
begin
  if not public.car_threshold_offer_route_is_public_eligible(
       v_offer_id, 'larnaca', 'ayia-napa'
     )
     or public.car_threshold_offer_route_is_public_eligible(
       v_offer_id, 'ayia-napa', 'larnaca'
     ) then
    raise exception 'cross-row directional swap did not reach exact final state';
  end if;

  begin
    perform *
    from public.admin_save_car_offer_city_availability_batch(
      v_offer_id,
      (select rows from _availability_expected_before_swap),
      '[]'::jsonb
    );
    raise exception 'stale snapshot unexpectedly succeeded';
  exception when serialization_failure then
    null;
  end;
end
$swap_assertion$;

-- Both-to-one transition: one retained row becomes both directions before the
-- other row is made inactive. The per-row completeness trigger must stay true.
create temporary table _availability_expected_before_collapse on commit drop as
select jsonb_agg(
  jsonb_build_object('city_id', availability.city_id, 'updated_at', availability.updated_at)
  order by availability.city_id
) as rows
from public.car_offer_city_availability availability
where availability.offer_id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid;

select count(*)
from public.admin_save_car_offer_city_availability_batch(
  'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid,
  (select rows from _availability_expected_before_collapse),
  jsonb_build_array(
    jsonb_build_object(
      'city_id', (select id from public.car_rental_cities where code = 'ayia-napa'),
      'pickup_enabled', true,
      'return_enabled', true,
      'fee_mode', 'override',
      'fee_per_direction', 0,
      'fee_note', 'Single retained route'
    ),
    jsonb_build_object(
      'city_id', (select id from public.car_rental_cities where code = 'larnaca'),
      'pickup_enabled', false,
      'return_enabled', false,
      'fee_mode', 'override',
      'fee_per_direction', 0,
      'fee_note', 'Retained inactive row'
    )
  )
);

select 1 / ((select count(*) = 1
  from public.car_offer_city_availability availability
  join public.car_rental_cities city on city.id = availability.city_id
  where availability.offer_id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
    and city.code = 'ayia-napa'
    and availability.is_active
    and availability.pickup_enabled
    and availability.return_enabled)::integer);

do $non_admin_rpc$
begin
  perform set_config(
    'request.jwt.claims',
    '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000099"}',
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform *
    from public.admin_save_car_offer_city_availability_batch(
      'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid,
      '[]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'non-admin batch call unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.admin_set_car_threshold_offer_activation_state(
      'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid,
      (
        select updated_at from public.car_offers
        where id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
      ),
      false
    );
    raise exception 'non-admin activation unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end
$non_admin_rpc$;

select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select (public.admin_set_car_threshold_offer_activation_state(
  'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid,
  (
    select updated_at from public.car_offers
    where id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
  ),
  false
)).id;

select 1 / ((select count(*) = 1
  from public.car_offers offer
  cross join public.site_settings setting
  where offer.id = 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid
    and offer.availability_mode = 'mapped'
    and not offer.is_published
    and offer.is_available
    and offer.submission_status = 'approved'
    and setting.id = 1
    and setting.car_multi_city_mapped_enabled
    and setting.car_threshold_daily_rates_enabled)::integer);

rollback;
