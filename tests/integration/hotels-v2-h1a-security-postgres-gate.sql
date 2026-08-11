\set ON_ERROR_STOP on

-- Apply exactly the reviewed H1A bridge before the booking lockdown.
\ir ../../supabase/migrations/20260811150000_hotels_v2_h1a_partner_security_bridge.sql
\ir ../../supabase/migrations/20260811180000_hotels_v2_h1a_booking_security_lockdown.sql

begin;

-- Both migrations are data-inert for bookings, Hotel fulfillments, deposits,
-- and coupons. The existing request lifecycle must remain pending/manual.
do $protected_data_and_lifecycle$
declare
  v_before public.hotels_h1a_fixture_fingerprints%rowtype;
  v_booking_after text;
  v_fulfillment_after text;
  v_deposit_after text;
  v_coupon_after text;
begin
  select * into strict v_before from public.hotels_h1a_fixture_fingerprints;

  select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
    into v_booking_after from public.hotel_bookings row_value;
  select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
    into v_fulfillment_after
    from public.partner_service_fulfillments row_value
    where row_value.resource_type = 'hotels';
  select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
    into v_deposit_after
    from public.service_deposit_requests row_value
    where row_value.resource_type = 'hotels';
  select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
    into v_coupon_after
    from public.service_coupon_redemptions row_value
    where row_value.service_type = 'hotels';

  if v_booking_after is distinct from v_before.booking_fingerprint
     or v_fulfillment_after is distinct from v_before.fulfillment_fingerprint
     or v_deposit_after is distinct from v_before.deposit_fingerprint
     or v_coupon_after is distinct from v_before.coupon_fingerprint then
    raise exception 'hotels_h1a_gate_protected_fingerprint_changed';
  end if;

  if exists (
    select 1
    from public.hotel_bookings booking
    join public.partner_service_fulfillments fulfillment
      on fulfillment.booking_id = booking.id
     and fulfillment.resource_type = 'hotels'
    where booking.status <> 'pending'
       or fulfillment.status <> 'pending_acceptance'
       or fulfillment.accepted_at is not null
       or fulfillment.rejected_at is not null
       or fulfillment.contact_revealed_at is not null
  ) then
    raise exception 'hotels_h1a_gate_partner_confirmation_lifecycle_changed';
  end if;
end
$protected_data_and_lifecycle$;

-- Anonymous callers cannot read Hotel bookings at all.
set local role anon;
do $anon_no_select$
begin
  begin
    perform id from public.hotel_bookings limit 1;
    raise exception 'hotels_h1a_gate_anon_select_unexpectedly_allowed';
  exception
    when insufficient_privilege then null;
  end;
end
$anon_no_select$;
reset role;

-- Anonymous creation remains available only as a pending, unowned request;
-- the same role still cannot read the inserted row back.
set local role anon;
insert into public.hotel_bookings (
  id, hotel_id, customer_name, customer_email, arrival_date, departure_date,
  nights, num_adults, total_price, status
) values (
  '61000000-0000-4000-8000-000000000000',
  '50000000-0000-4000-8000-000000000001',
  'Synthetic Anonymous Customer', 'anonymous@example.test',
  '2026-10-20', '2026-10-21', 1, 1, 90, 'pending'
);
reset role;
do $anon_insert_contract$
begin
  if not exists (
    select 1
    from public.hotel_bookings booking
    where booking.id = '61000000-0000-4000-8000-000000000000'
      and booking.user_id is null
      and booking.created_by is null
      and booking.status = 'pending'
  ) then
    raise exception 'hotels_h1a_gate_anon_insert_contract_failed';
  end if;
end
$anon_insert_contract$;

-- Direct RLS is ownership-only. Customer A sees its owned row directly and
-- receives its matching ownerless historical guest row only through the
-- verified-email compatibility RPC.
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000001","email":"customer-a@example.test"}',
  true
);
set local role authenticated;
select 1 / ((select count(*) = 1 from public.hotel_bookings)::integer);
select 1 / ((select count(*) = 1 from public.hotel_bookings
  where id = '60000000-0000-4000-8000-000000000001')::integer);
select 1 / ((select count(*) = 0 from public.hotel_bookings
  where id = '60000000-0000-4000-8000-000000000002')::integer);
select 1 / ((select count(*) = 0 from public.hotel_bookings
  where id = '60000000-0000-4000-8000-000000000003')::integer);
select 1 / ((select count(*) = 2
  from public.customer_get_hotel_bookings(100))::integer);
select 1 / ((select count(*) = 1
  from public.customer_get_hotel_bookings(100)
  where id = '60000000-0000-4000-8000-000000000003'
    and user_id is null
    and created_by is null
    and customer_email = 'customer-a@example.test')::integer);
reset role;

-- Customer B sees only its owned row, both directly and via the customer RPC;
-- Customer A's owned and ownerless-email rows remain unavailable.
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000002","email":"customer-b@example.test"}',
  true
);
set local role authenticated;
select 1 / ((select count(*) = 1 from public.hotel_bookings)::integer);
select 1 / ((select count(*) = 0 from public.hotel_bookings
  where id = '60000000-0000-4000-8000-000000000001')::integer);
select 1 / ((select count(*) = 1 from public.hotel_bookings
  where id = '60000000-0000-4000-8000-000000000002')::integer);
select 1 / ((select count(*) = 1
  from public.customer_get_hotel_bookings(100))::integer);
select 1 / ((select count(*) = 0
  from public.customer_get_hotel_bookings(100)
  where id in (
    '60000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000003'
  ))::integer);
reset role;

-- Admin retains full read access.
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test"}',
  true
);
set local role authenticated;
select 1 / ((select count(*) = 4 from public.hotel_bookings)::integer);
reset role;

-- service_role keeps direct table access through BYPASSRLS but is deliberately
-- not a caller of either customer or partner-facing RPC.
select set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);
set local role service_role;
select 1 / ((select count(*) = 4 from public.hotel_bookings)::integer);
select 1 / ((not has_function_privilege(
  current_user,
  'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)',
  'EXECUTE'
))::integer);
select 1 / ((not has_function_privilege(
  current_user,
  'public.customer_get_hotel_bookings(integer)',
  'EXECUTE'
))::integer);
reset role;

-- Partner A receives only the exact, non-PII operational row for its own
-- fulfillment. Direct Hotel-booking table access still returns zero rows.
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"30000000-0000-4000-8000-000000000001","email":"partner-a@example.test"}',
  true
);
set local role authenticated;
select 1 / ((select count(*) = 0 from public.hotel_bookings)::integer);
select 1 / ((select count(*) = 1
  from public.partner_get_hotel_booking_operational_context(
    '40000000-0000-4000-8000-000000000001',
    array['60000000-0000-4000-8000-000000000001'::uuid],
    array['50000000-0000-4000-8000-000000000001'::uuid],
    '2026-09-01', '2026-09-04', 10
  ) context_row
  where context_row.fulfillment_id = '70000000-0000-4000-8000-000000000001'
    and context_row.booking_id = '60000000-0000-4000-8000-000000000001'
    and context_row.hotel_id = '50000000-0000-4000-8000-000000000001'
    and context_row.status = 'pending'
    and context_row.room_inventory_units = 2
    and context_row.total_price = 420
)::integer);

-- Referral attribution uses the redacted compatibility wrapper. The exact
-- partner row remains available while customer_name is always NULL.
select 1 / ((select count(*) = 1
  from public.partner_get_referral_attributed_orders_safe(
    '40000000-0000-4000-8000-000000000001', 40
  ) attributed
  where attributed.booking_id = '60000000-0000-4000-8000-000000000001'
    and attributed.service_type = 'hotels'
    and attributed.service_id = '50000000-0000-4000-8000-000000000001'
    and attributed.customer_name is null
    and attributed.total_amount = 420
)::integer);

do $legacy_referral_rpc_is_internal$
begin
  begin
    perform *
    from public.partner_get_referral_attributed_orders(
      '40000000-0000-4000-8000-000000000001', 40
    );
    raise exception 'hotels_h1a_gate_legacy_referral_rpc_unexpectedly_allowed';
  exception
    when insufficient_privilege then null;
  end;
end
$legacy_referral_rpc_is_internal$;

do $partner_a_cannot_impersonate_partner_b$
begin
  begin
    perform *
    from public.partner_get_hotel_booking_operational_context(
      '40000000-0000-4000-8000-000000000002',
      array['60000000-0000-4000-8000-000000000002'::uuid],
      array['50000000-0000-4000-8000-000000000002'::uuid],
      null, null, 10
    );
    raise exception 'hotels_h1a_gate_partner_cross_scope_unexpectedly_allowed';
  exception
    when insufficient_privilege then null;
  end;
end
$partner_a_cannot_impersonate_partner_b$;
reset role;

-- Partner B cannot retrieve Partner A's booking: asking as Partner A is
-- forbidden; asking within its own exact partner scope returns zero.
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"30000000-0000-4000-8000-000000000002","email":"partner-b@example.test"}',
  true
);
set local role authenticated;
select 1 / ((select count(*) = 0
  from public.partner_get_hotel_booking_operational_context(
    '40000000-0000-4000-8000-000000000002',
    array['60000000-0000-4000-8000-000000000001'::uuid],
    array['50000000-0000-4000-8000-000000000001'::uuid],
    null, null, 10
  ))::integer);
do $partner_b_cannot_impersonate_partner_a$
begin
  begin
    perform *
    from public.partner_get_hotel_booking_operational_context(
      '40000000-0000-4000-8000-000000000001',
      array['60000000-0000-4000-8000-000000000001'::uuid],
      array['50000000-0000-4000-8000-000000000001'::uuid],
      null, null, 10
    );
    raise exception 'hotels_h1a_gate_partner_b_cross_scope_unexpectedly_allowed';
  exception
    when insufficient_privilege then null;
  end;
end
$partner_b_cannot_impersonate_partner_a$;
reset role;

-- Admin may use the same narrow operational RPC for support workflows.
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test"}',
  true
);
set local role authenticated;
select 1 / ((select count(*) = 1
  from public.partner_get_hotel_booking_operational_context(
    '40000000-0000-4000-8000-000000000001',
    array['60000000-0000-4000-8000-000000000001'::uuid],
    null, null, null, 10
  ))::integer);
reset role;

-- The RPC return contract itself cannot expose Hotel customer PII or raw
-- booking_details (which may contain private notes).
do $rpc_contract_has_no_pii$
declare
  v_result text := lower(pg_get_function_result(
    'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'::regprocedure
  ));
begin
  if v_result ~ '(customer|email|phone|user_id|created_by|booking_details|private_note)' then
    raise exception 'hotels_h1a_gate_partner_rpc_pii_contract_detected: %', v_result;
  end if;

  if v_result not like '%fulfillment_id uuid%'
     or v_result not like '%booking_id uuid%'
     or v_result not like '%hotel_id uuid%'
     or v_result not like '%total_price numeric%'
     or v_result not like '%status text%' then
    raise exception 'hotels_h1a_gate_partner_rpc_operational_contract_incomplete: %', v_result;
  end if;
end
$rpc_contract_has_no_pii$;

-- Browser roles retain only the intentionally exposed RPC/wrapper. Trigger
-- functions and the raw fulfillment writer remain internal to service_role.
do $function_grants$
begin
  if has_function_privilege(
       'anon',
       'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)',
       'EXECUTE'
     )
     or has_function_privilege('anon', 'public.customer_get_hotel_bookings(integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.customer_get_hotel_bookings(integer)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.customer_get_hotel_bookings(integer)', 'EXECUTE')
     or has_function_privilege(
       'service_role',
       'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.partner_get_referral_attributed_orders(uuid,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.partner_get_referral_attributed_orders_safe(uuid,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.partner_get_referral_attributed_orders_safe(uuid,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.partner_get_referral_attributed_orders_safe(uuid,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.upsert_partner_service_fulfillment_from_booking_with_partner(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)',
       'EXECUTE'
     )
     or has_function_privilege('anon', 'public.hotel_bookings_assign_authenticated_owner()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.hotel_bookings_assign_authenticated_owner()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.update_hotel_bookings_updated_at()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.trg_notify_admin_new_hotel_booking()', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_apply_hotel_booking_manual_adjustment(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_apply_hotel_booking_manual_adjustment(uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.hotel_bookings_assign_authenticated_owner()', 'EXECUTE') then
    raise exception 'hotels_h1a_gate_function_grant_contract_failed';
  end if;
end
$function_grants$;

-- The authenticated-owner trigger still executes even though browser roles
-- cannot call it directly. It assigns Customer A and rejects spoofed owner IDs.
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000001","email":"customer-a@example.test"}',
  true
);
set local role authenticated;
insert into public.hotel_bookings (
  id, hotel_id, customer_name, customer_email, arrival_date, departure_date,
  nights, num_adults, total_price, status
) values (
  '61000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'Synthetic Customer A New', 'customer-a@example.test',
  '2026-11-01', '2026-11-02', 1, 1, 100, 'pending'
);
select 1 / ((select count(*) = 1
  from public.hotel_bookings
  where id = '61000000-0000-4000-8000-000000000001'
    and user_id = '20000000-0000-4000-8000-000000000001')::integer);

do $authenticated_owner_spoof_fails$
begin
  begin
    insert into public.hotel_bookings (
      id, hotel_id, user_id, customer_name, customer_email,
      arrival_date, departure_date, nights, num_adults, total_price, status
    ) values (
      '61000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      'Synthetic Spoof', 'customer-a@example.test',
      '2026-11-01', '2026-11-02', 1, 1, 100, 'pending'
    );
    raise exception 'hotels_h1a_gate_authenticated_owner_spoof_unexpectedly_allowed';
  exception
    when insufficient_privilege then null;
  end;
end
$authenticated_owner_spoof_fails$;
reset role;

rollback;

-- Gate-side mutations were rolled back; migrated fixture data and manual
-- partner-confirmation lifecycle remain exactly as seeded.
select 1 / ((select count(*) = 3 from public.hotel_bookings)::integer);
select 1 / ((select count(*) = 2
  from public.partner_service_fulfillments
  where resource_type = 'hotels'
    and status = 'pending_acceptance'
    and accepted_at is null
    and rejected_at is null
    and contact_revealed_at is null)::integer);

select
  true as anon_no_select,
  true as customer_a_own_only,
  true as customer_a_legacy_guest_via_verified_rpc,
  true as customer_b_cross_customer_blocked,
  true as admin_select_all,
  true as service_role_all_access,
  true as exact_partner_rpc_only,
  true as safe_referral_customer_name_redacted,
  true as partner_rpc_has_no_pii,
  true as internal_function_grants_locked,
  true as protected_fingerprints_unchanged,
  true as pending_partner_lifecycle_unchanged,
  true as hotels_v2_h1a_security_postgres_safe;
