-- Isolated PostgreSQL 16 gate for 20260811120000_car_fleet_operations.sql.
-- Synthetic fixtures only. Every mutation is rolled back.

begin;

select set_config('request.jwt.claim.role', 'service_role', true);

-- Match the deployed exact-owner-first resource resolver used by the legacy
-- fulfillment wrapper. This fixture helper is transaction-local via rollback.
create or replace function public.partner_service_fulfillment_partner_id_for_resource(
  p_resource_type text,
  p_resource_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case when p_resource_type = 'cars' then offer.owner_partner_id else null end
  from public.car_offers offer
  where offer.id = p_resource_id
$$;

create function pg_temp.fleet_target(
  p_offer_id uuid,
  p_desired jsonb,
  p_target_mode text
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'offer_id', offer.id,
    'expected_updated_at', offer.updated_at,
    'expected_availability', coalesce((
      select jsonb_agg(jsonb_build_object(
        'city_id', availability.city_id,
        'updated_at', availability.updated_at,
        'pickup_enabled', availability.pickup_enabled,
        'return_enabled', availability.return_enabled,
        'is_active', availability.is_active,
        'fee_mode', availability.fee_mode,
        'fee_per_direction', availability.fee_per_direction,
        'fee_note', availability.fee_note
      ) order by availability.city_id)
      from public.car_offer_city_availability availability
      where availability.offer_id = offer.id
    ), '[]'::jsonb),
    'expected_deposit_override', (
      select jsonb_build_object(
        'id', override_row.id,
        'updated_at', override_row.updated_at,
        'mode', override_row.mode,
        'amount', override_row.amount,
        'currency', override_row.currency,
        'include_children', override_row.include_children,
        'enabled', override_row.enabled
      )
      from public.service_deposit_overrides override_row
      where override_row.resource_type = 'cars'
        and override_row.resource_id = offer.id
    ),
    'desired_availability', p_desired,
    'target_availability_mode', p_target_mode
  )
  from public.car_offers offer
  where offer.id = p_offer_id
$$;

create function pg_temp.no_change_operations(
  p_availability_mode text default 'no_change'
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'availability_mode', p_availability_mode,
    'cities', '[]'::jsonb,
    'security_deposit', jsonb_build_object('action', 'no_change', 'amount', null),
    'payment_due', jsonb_build_object(
      'action', 'no_change', 'amount', null, 'currency', 'EUR', 'include_children', true
    ),
    'partner', jsonb_build_object('action', 'no_change', 'partner_id', null)
  )
$$;

create temporary table _fleet_offer_before on commit drop as
select
  offer.id,
  offer.pricing_strategy,
  offer.pricing_profile_id,
  offer.location,
  offer.price_per_day,
  offer.price_3days,
  offer.price_4_6days,
  offer.price_7_10days,
  offer.price_10plus_days,
  offer.owner_partner_id,
  offer.deposit_amount
from public.car_offers offer
where offer.id = 'ca300001-0000-4000-8000-000000000001'::uuid;

insert into public.car_offer_city_availability (
  offer_id, city_id, pickup_enabled, return_enabled, is_active,
  fee_mode, fee_per_direction, fee_note
)
select
  'ca300001-0000-4000-8000-000000000001'::uuid,
  city.id,
  case when city.code = 'larnaca' then false else true end,
  true,
  true,
  'inherit',
  null,
  null
from public.car_rental_cities city
where city.code in ('larnaca', 'ayia-napa');

-- Profile direction flags are compatibility metadata, not mapped route gates.
update public.car_pricing_profile_cities mapping
set pickup_supported = case
      when mapping.city_id = (select id from public.car_rental_cities where code = 'larnaca')
        then true
      else false
    end,
    return_supported = case
      when mapping.city_id = (select id from public.car_rental_cities where code = 'larnaca')
        then false
      else true
    end
where mapping.pricing_profile_id = 'ca210001-0000-4000-8000-000000000001'::uuid
  and mapping.city_id in (
    select city.id from public.car_rental_cities city
    where city.code in ('larnaca', 'ayia-napa')
  );

create temporary table _fleet_rows_before_mode on commit drop as
select city_id, updated_at
from public.car_offer_city_availability
where offer_id = 'ca300001-0000-4000-8000-000000000001'::uuid;

do $mode_only$
declare
  v_receipt jsonb;
begin
  v_receipt := public.admin_apply_car_fleet_bulk_operation(
    jsonb_build_array(pg_temp.fleet_target(
      'ca300001-0000-4000-8000-000000000001'::uuid,
      null,
      'mapped'
    )),
    pg_temp.no_change_operations('mapped')
  );
  if v_receipt ->> 'operation' <> 'fleet_bulk'
     or (v_receipt ->> 'target_count')::integer <> 1 then
    raise exception 'mode-only Fleet receipt mismatch: %', v_receipt;
  end if;
end
$mode_only$;

do $mapped_contract$
begin
  if not exists (
    select 1 from public.car_offers offer
    where offer.id = 'ca300001-0000-4000-8000-000000000001'::uuid
      and offer.pricing_strategy = 'legacy_compat'
      and offer.availability_mode = 'mapped'
  ) then
    raise exception 'legacy pricing + mapped mode was not persisted';
  end if;
  if exists (
    select 1
    from _fleet_rows_before_mode before_state
    join public.car_offer_city_availability availability using (city_id)
    where availability.offer_id = 'ca300001-0000-4000-8000-000000000001'::uuid
      and availability.updated_at is distinct from before_state.updated_at
  ) then
    raise exception 'mode-only operation rewrote availability rows';
  end if;
  if exists (
    select 1
    from _fleet_offer_before before_state
    join public.car_offers offer using (id)
    where offer.pricing_strategy is distinct from before_state.pricing_strategy
       or offer.pricing_profile_id is distinct from before_state.pricing_profile_id
       or offer.location is distinct from before_state.location
       or offer.price_per_day is distinct from before_state.price_per_day
       or offer.price_3days is distinct from before_state.price_3days
       or offer.price_4_6days is distinct from before_state.price_4_6days
       or offer.price_7_10days is distinct from before_state.price_7_10days
       or offer.price_10plus_days is distinct from before_state.price_10plus_days
  ) then
    raise exception 'availability mode switch changed protected legacy pricing';
  end if;
end
$mapped_contract$;

update public.site_settings
set car_multi_city_mapped_enabled = true
where id = 1;

do $directional_public$
begin
  if not public.car_mapped_legacy_offer_route_is_booking_eligible(
       'ca300001-0000-4000-8000-000000000001'::uuid,
       'ayia-napa',
       'larnaca'
     )
     or public.car_mapped_legacy_offer_route_is_booking_eligible(
       'ca300001-0000-4000-8000-000000000001'::uuid,
       'larnaca',
       'ayia-napa'
     )
     or public.car_mapped_legacy_offer_route_is_booking_eligible(
       'ca300001-0000-4000-8000-000000000001'::uuid,
       'larnaca',
       'larnaca'
     ) then
    raise exception 'mapped legacy directional public contract failed';
  end if;
end
$directional_public$;

do $invalid_booking$
begin
  begin
    insert into public.car_bookings (
      id, offer_id, location, pickup_location, return_location,
      pickup_city_code, return_city_code, pickup_date, return_date, status
    ) values (
      'ca3f0000-0000-4000-8000-000000000001'::uuid,
      'ca300001-0000-4000-8000-000000000001'::uuid,
      'larnaca', 'larnaca', 'ayia-napa', 'larnaca', 'ayia-napa',
      '2026-10-01', '2026-10-04', 'pending'
    );
    raise exception 'invalid mapped legacy pickup unexpectedly created a booking';
  exception when check_violation then
    if sqlerrm <> 'mapped_legacy_booking_offer_or_route_not_public_eligible' then
      raise;
    end if;
  end;
  if exists (
    select 1 from public.car_bookings
    where id = 'ca3f0000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'invalid booking survived the guard';
  end if;
end
$invalid_booking$;

insert into public.car_bookings (
  id, offer_id, location, pickup_location, return_location,
  pickup_city_code, return_city_code, pickup_date, return_date,
  status, payment_status
) values (
  'ca3f0000-0000-4000-8000-000000000002'::uuid,
  'ca300001-0000-4000-8000-000000000001'::uuid,
  'larnaca', 'ayia-napa', 'larnaca', 'ayia-napa', 'larnaca',
  '2026-10-01', '2026-10-04', 'pending', 'unpaid'
);

do $manual_partner_workflow$
begin
  if not exists (
    select 1 from public.car_bookings booking
    where booking.id = 'ca3f0000-0000-4000-8000-000000000002'::uuid
      and booking.status = 'pending'
  ) or not exists (
    select 1 from public.partner_service_fulfillments fulfillment
    where fulfillment.booking_id = 'ca3f0000-0000-4000-8000-000000000002'::uuid
      and fulfillment.partner_id = 'ca2f0000-0000-4000-8000-000000000001'::uuid
      and fulfillment.status = 'pending_acceptance'
  ) then
    raise exception 'mapped legacy request bypassed the pending partner workflow';
  end if;
end
$manual_partner_workflow$;

-- One reviewed call changes exact rows, security information, the central
-- payment override and owner. It never exposes pricing/publication fields.
do $complete_bulk$
declare
  v_offer_id constant uuid := 'ca300001-0000-4000-8000-000000000001';
  v_larnaca_id uuid;
  v_ayia_id uuid;
  v_desired jsonb;
  v_operations jsonb;
begin
  select id into v_larnaca_id from public.car_rental_cities where code = 'larnaca';
  select id into v_ayia_id from public.car_rental_cities where code = 'ayia-napa';
  v_desired := jsonb_build_array(
    jsonb_build_object(
      'city_id', v_larnaca_id, 'pickup_enabled', false,
      'return_enabled', true, 'fee_mode', 'override',
      'fee_per_direction', 20, 'fee_note', null
    ),
    jsonb_build_object(
      'city_id', v_ayia_id, 'pickup_enabled', true,
      'return_enabled', true, 'fee_mode', 'inherit',
      'fee_per_direction', null, 'fee_note', null
    )
  );
  v_operations := jsonb_build_object(
    'availability_mode', 'mapped',
    'cities', jsonb_build_array(jsonb_build_object(
      'city_id', v_larnaca_id,
      'pickup', 'disable',
      'return', 'enable',
      'fee_action', 'custom',
      'fee_per_direction', 20
    )),
    'security_deposit', jsonb_build_object('action', 'none', 'amount', null),
    'payment_due', jsonb_build_object(
      'action', 'percent_total', 'amount', 15,
      'currency', 'EUR', 'include_children', true
    ),
    'partner', jsonb_build_object(
      'action', 'assign',
      'partner_id', 'ca2f0000-0000-4000-8000-000000000001'
    )
  );
  perform public.admin_apply_car_fleet_bulk_operation(
    jsonb_build_array(pg_temp.fleet_target(v_offer_id, v_desired, 'mapped')),
    v_operations
  );
end
$complete_bulk$;

do $complete_postconditions$
begin
  if not exists (
    select 1 from public.car_offer_city_availability availability
    join public.car_rental_cities city on city.id = availability.city_id
    where availability.offer_id = 'ca300001-0000-4000-8000-000000000001'::uuid
      and city.code = 'larnaca'
      and availability.pickup_enabled is false
      and availability.return_enabled is true
      and availability.is_active is true
      and availability.fee_mode = 'override'
      and availability.fee_per_direction = 20
  ) or not exists (
    select 1 from public.service_deposit_overrides override_row
    where override_row.resource_type = 'cars'
      and override_row.resource_id = 'ca300001-0000-4000-8000-000000000001'::uuid
      and override_row.mode = 'percent_total'
      and override_row.amount = 15
      and override_row.enabled
  ) or not exists (
    select 1 from public.car_offers offer
    where offer.id = 'ca300001-0000-4000-8000-000000000001'::uuid
      and offer.deposit_amount = 0
      and offer.owner_partner_id = 'ca2f0000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'complete Fleet bulk postcondition failed';
  end if;
end
$complete_postconditions$;

-- Fleet bulk is a one-time exact-row update, not a persistent partner template.
-- The existing individual availability editor must remain authoritative for a
-- later exception on one exact offer.
do $individual_override_after_bulk$
declare
  v_offer_id constant uuid := 'ca300001-0000-4000-8000-000000000001';
  v_larnaca_id uuid;
  v_expected jsonb;
  v_desired jsonb;
begin
  select city.id into v_larnaca_id
  from public.car_rental_cities city
  where city.code = 'larnaca';

  select coalesce(jsonb_agg(jsonb_build_object(
    'city_id', availability.city_id,
    'updated_at', availability.updated_at
  ) order by availability.city_id), '[]'::jsonb)
  into v_expected
  from public.car_offer_city_availability availability
  where availability.offer_id = v_offer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'city_id', availability.city_id,
    'pickup_enabled', case when availability.city_id = v_larnaca_id then true else availability.pickup_enabled end,
    'return_enabled', case when availability.city_id = v_larnaca_id then false else availability.return_enabled end,
    'fee_mode', availability.fee_mode,
    'fee_per_direction', case when availability.city_id = v_larnaca_id then 25 else availability.fee_per_direction end,
    'fee_note', availability.fee_note
  ) order by availability.city_id), '[]'::jsonb)
  into v_desired
  from public.car_offer_city_availability availability
  where availability.offer_id = v_offer_id;

  perform *
  from public.admin_save_car_offer_city_availability_batch(
    v_offer_id,
    v_expected,
    v_desired
  );

  if not exists (
    select 1
    from public.car_offer_city_availability availability
    where availability.offer_id = v_offer_id
      and availability.city_id = v_larnaca_id
      and availability.pickup_enabled is true
      and availability.return_enabled is false
      and availability.is_active is true
      and availability.fee_mode = 'override'
      and availability.fee_per_direction = 25
  ) then
    raise exception 'individual exact-offer override after Fleet bulk failed';
  end if;
end
$individual_override_after_bulk$;

-- A stale second target aborts the entire transaction before the first target
-- can receive its reviewed security-deposit change.
create temporary table _stale_bulk_targets on commit drop as
select jsonb_build_array(
  pg_temp.fleet_target(
    'ca300001-0000-4000-8000-000000000001'::uuid, null, 'mapped'
  ),
  pg_temp.fleet_target(
    'ca300001-0000-4000-8000-000000000002'::uuid, null, 'legacy'
  )
) as targets;

update public.car_offers
set updated_at = updated_at + interval '1 second'
where id = 'ca300001-0000-4000-8000-000000000002'::uuid;

do $stale_abort$
begin
  begin
    perform public.admin_apply_car_fleet_bulk_operation(
      (select targets from _stale_bulk_targets),
      jsonb_build_object(
        'availability_mode', 'no_change',
        'cities', '[]'::jsonb,
        'security_deposit', jsonb_build_object('action', 'amount', 'amount', 99),
        'payment_due', jsonb_build_object(
          'action', 'no_change', 'amount', null,
          'currency', 'EUR', 'include_children', true
        ),
        'partner', jsonb_build_object('action', 'no_change', 'partner_id', null)
      )
    );
    raise exception 'stale Fleet batch unexpectedly succeeded';
  exception when serialization_failure then
    null;
  end;
  if (select deposit_amount from public.car_offers
      where id = 'ca300001-0000-4000-8000-000000000001'::uuid) <> 0 then
    raise exception 'stale Fleet batch partially changed the first target';
  end if;
end
$stale_abort$;

-- Exact owner assignment for legacy pricing must support its compatibility
-- region. The Paphos-only partner cannot be silently displayed as Larnaca's
-- operational owner.
do $partner_location_abort$
begin
  begin
    perform public.admin_apply_car_fleet_bulk_operation(
      jsonb_build_array(pg_temp.fleet_target(
        'ca300001-0000-4000-8000-000000000001'::uuid, null, 'mapped'
      )),
      jsonb_build_object(
        'availability_mode', 'no_change',
        'cities', '[]'::jsonb,
        'security_deposit', jsonb_build_object('action', 'no_change', 'amount', null),
        'payment_due', jsonb_build_object(
          'action', 'no_change', 'amount', null,
          'currency', 'EUR', 'include_children', true
        ),
        'partner', jsonb_build_object(
          'action', 'assign',
          'partner_id', 'ca2f0000-0000-4000-8000-000000000002'
        )
      )
    );
    raise exception 'location-incompatible legacy owner unexpectedly succeeded';
  exception when check_violation then
    if sqlerrm <> 'car_fleet_operations_legacy_owner_location_required' then
      raise;
    end if;
  end;
end
$partner_location_abort$;

-- Revert mapped availability only. Exact configured rows stay retained.
do $availability_rollback$
begin
  perform public.admin_apply_car_fleet_bulk_operation(
    jsonb_build_array(pg_temp.fleet_target(
      'ca300001-0000-4000-8000-000000000001'::uuid,
      null,
      'legacy'
    )),
    pg_temp.no_change_operations('legacy')
  );
  if not exists (
    select 1 from public.car_offers offer
    where offer.id = 'ca300001-0000-4000-8000-000000000001'::uuid
      and offer.pricing_strategy = 'legacy_compat'
      and offer.availability_mode = 'legacy'
  ) or (select count(*) from public.car_offer_city_availability
        where offer_id = 'ca300001-0000-4000-8000-000000000001'::uuid) <> 2 then
    raise exception 'availability rollback deleted configuration or changed pricing';
  end if;
end
$availability_rollback$;

rollback;
