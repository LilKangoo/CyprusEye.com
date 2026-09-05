begin;
set transaction isolation level repeatable read;

-- 7 Arches application bridge.  Browser callers receive only typed projections;
-- the independent pricing authority and reviewed-pricing ledgers remain private.
do $application_pricing_bridge_dependencies$
declare v_oracle jsonb;
begin
  if to_regclass('public.hotel_bookings') is null
     or to_regclass('public.hotel_seven_arches_independent_pricing_authority') is null
     or to_regclass('public.hotel_seven_arches_reviewed_pricing_proposals') is null
     or to_regprocedure('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_current_state()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_oracle()') is null
     or to_regprocedure('public.hotel_v2_admin_c_pricing_control_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_2b_access_snapshot(uuid,uuid,text)') is null
     or to_regprocedure('public.hotel_v2_h3_2b_commission_policy(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_2b_commercial(jsonb,numeric,integer,numeric)') is null
     or to_regprocedure('public.hotel_v2_h3_2b_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_h2a_keys_allowed(jsonb,text[])') is null
     or to_regprocedure('public.service_coupon_quote(text,text,numeric,timestamp with time zone,uuid,text[],uuid,text)') is null then
    raise exception using errcode='42883',
      message='hotels_v2_seven_arches_application_bridge_dependency_missing';
  end if;
  if to_regprocedure('public.hotel_v2_public_quote_seven_arches(jsonb)') is not null
     or to_regprocedure('public.hotel_v2_public_create_seven_arches_booking(jsonb)') is not null
     or to_regprocedure('public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)') is not null
     or to_regclass('public.hotel_seven_arches_public_quote_issuances') is not null
     or to_regclass('public.hotel_seven_arches_public_booking_transaction_context') is not null
     or to_regclass('public.hotel_seven_arches_public_booking_receipts') is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_application_bridge_prior_install';
  end if;
  if exists(
    select 1
    from (values
      ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
       'c93374ece2a04386ca3b1e6f1168de3ba5162425d977857d1a4b137626ce6650','s',true,
       array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
       'e895de1ed9bd868f2aaf8b5b21cf17b1a7fdf5a75de33f943991151012fa89eb','s',true,
       array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_reviewed_pricing_current_state()',
       '1374c443a68b4eefbfb361021c0a8d24b51a3200a5995d87a8d7aa114f0835d1','s',true,
       array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_reviewed_pricing_oracle()',
       '50fee36eb4e4c7a11ad0baf0188a9f2042bde3678c5d835b3e8b7ece992ebfef','s',true,
       array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_c_pricing_control_snapshot(uuid)',
       'd6cec06410e28b4138de5776b66f622ad8c9402662672862726e81ecb7ea613a','s',true,
       array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_access_snapshot(uuid,uuid,text)',
       '7f8cb70e2c7034d17f03377cf7ffe3d5648e47dc27800e9ac3542bc95e2bb5b4','s',true,
       array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_h3_2b_commission_policy(uuid)',
       '533a819b7903a4247196955a555a32c4a26b4bea4450814017334c83903ace77','s',true,
       array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_commercial(jsonb,numeric,integer,numeric)',
       '5dec10461b12cec5efb72c9760d7f6126db440107c64af629412034bce0127db','i',true,
       array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_h3_2b_hash(jsonb)',
       'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828','i',false,
       array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_h2a_keys_allowed(jsonb,text[])',
       'ad7d11bdbc9f1351e300ceaf9dc0e69b95464b0f8a4b6cd4fbdb179f77ae65e3','i',false,
       array['search_path=pg_catalog']::text[])
    ) expected(signature,source_hash,volatility,security_definer,configuration)
    left join pg_proc procedure_row
      on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null
       or procedure_row.proowner<>'postgres'::regrole
       or procedure_row.provolatile<>expected.volatility::"char"
       or procedure_row.prosecdef<>expected.security_definer
       or procedure_row.proconfig is distinct from expected.configuration
       or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')<>
          expected.source_hash
       or not has_function_privilege('postgres',procedure_row.oid,'EXECUTE')
       or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
  ) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_application_bridge_dependency_source_drift';
  end if;
  if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() is not true
     or (select count(*) from public.hotel_seven_arches_independent_pricing_authority)<>54 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_application_bridge_upstream_invalid';
  end if;
  v_oracle:=public.hotel_v2_seven_arches_reviewed_pricing_oracle();
  if (v_oracle->>'core_case_count')::integer is distinct from 100
     or (v_oracle->>'core_mismatch_count')::integer is distinct from 0
     or (v_oracle->>'guest_one_case_count')::integer is distinct from 20
     or (v_oracle->>'guest_one_mismatch_count')::integer is distinct from 0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_application_bridge_parity_invalid';
  end if;
end
$application_pricing_bridge_dependencies$;

alter table public.hotel_bookings
  add column pricing_room_type_id uuid,
  add column pricing_room_rate_id uuid,
  add column pricing_schedule_id uuid,
  add column pricing_schedule_tier_id uuid,
  add column pricing_authority_token text,
  add column pricing_quote_fingerprint text,
  add column pricing_quote_expires_at timestamptz,
  add column pricing_allocation jsonb;

alter table public.hotel_bookings
  add constraint hotel_bookings_7a_authority_token_check check(
    pricing_authority_token is null or pricing_authority_token~'^[0-9a-f]{64}$'),
  add constraint hotel_bookings_7a_quote_fingerprint_check check(
    pricing_quote_fingerprint is null or pricing_quote_fingerprint~'^[0-9a-f]{64}$'),
  add constraint hotel_bookings_7a_allocation_check check(
    pricing_allocation is null or jsonb_typeof(pricing_allocation)='array');

create table public.hotel_seven_arches_public_quote_issuances(
  quote_fingerprint text primary key check(quote_fingerprint~'^[0-9a-f]{64}$'),
  hotel_id uuid not null check(
    hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
  authority_token text not null check(authority_token~'^[0-9a-f]{64}$'),
  request_fingerprint text not null check(request_fingerprint~'^[0-9a-f]{64}$'),
  quote_payload jsonb not null check(
    jsonb_typeof(quote_payload)='object'
    and quote_payload->>'contract_version'=
      'hotels_v2_seven_arches_public_quote_v1'
    and quote_payload->>'quote_fingerprint'=quote_fingerprint
    and quote_payload->>'hotel_id'=hotel_id::text
    and quote_payload->>'authority_token'=authority_token),
  issued_at timestamptz not null,
  expires_at timestamptz not null check(expires_at=issued_at+interval '15 minutes'),
  issuance_hash text not null unique check(issuance_hash~'^[0-9a-f]{64}$')
);

create table public.hotel_seven_arches_public_booking_transaction_context(
  backend_pid integer not null,
  transaction_id bigint not null,
  booking_id uuid not null unique,
  hotel_id uuid not null check(
    hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
  quote_fingerprint text not null check(quote_fingerprint~'^[0-9a-f]{64}$'),
  authority_token text not null check(authority_token~'^[0-9a-f]{64}$'),
  actor_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  primary key(backend_pid,transaction_id)
);

create table public.hotel_seven_arches_public_booking_receipts(
  sequence_no bigint primary key check(sequence_no>0),
  id uuid not null unique,
  contract_version text not null check(contract_version=
    'hotels_v2_seven_arches_public_booking_receipt_v1'),
  previous_receipt_hash text not null check(previous_receipt_hash~'^[0-9a-f]{64}$'),
  receipt_hash text not null unique check(receipt_hash~'^[0-9a-f]{64}$'),
  booking_id uuid not null unique references public.hotel_bookings(id) on delete restrict,
  hotel_id uuid not null check(
    hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
  quote_fingerprint text not null unique
    references public.hotel_seven_arches_public_quote_issuances(quote_fingerprint)
      on delete restrict
    check(quote_fingerprint~'^[0-9a-f]{64}$'),
  authority_token text not null check(authority_token~'^[0-9a-f]{64}$'),
  request_fingerprint text not null check(request_fingerprint~'^[0-9a-f]{64}$'),
  allocation_fingerprint text not null check(allocation_fingerprint~'^[0-9a-f]{64}$'),
  snapshot_fingerprint text not null check(snapshot_fingerprint~'^[0-9a-f]{64}$'),
  result jsonb not null check(jsonb_typeof(result)='object'),
  created_at timestamptz not null,
  unique(quote_fingerprint,request_fingerprint)
);

alter table public.hotel_seven_arches_public_booking_transaction_context enable row level security;
alter table public.hotel_seven_arches_public_booking_receipts enable row level security;
alter table public.hotel_seven_arches_public_quote_issuances enable row level security;
alter table public.hotel_seven_arches_public_booking_transaction_context owner to postgres;
alter table public.hotel_seven_arches_public_booking_receipts owner to postgres;
alter table public.hotel_seven_arches_public_quote_issuances owner to postgres;
revoke all on table public.hotel_seven_arches_public_booking_transaction_context,
  public.hotel_seven_arches_public_booking_receipts,
  public.hotel_seven_arches_public_quote_issuances
  from public,anon,authenticated,service_role;

create function public.hotel_v2_seven_arches_public_quote_issuance_immutable()
returns trigger language plpgsql set search_path=pg_catalog
as $function$
begin
  raise exception using errcode='55000',
    message='hotels_v2_seven_arches_public_quote_issuance_immutable';
end
$function$;

create trigger hotel_7a_public_quote_issuance_immutable
before update or delete on public.hotel_seven_arches_public_quote_issuances
for each row execute function public.hotel_v2_seven_arches_public_quote_issuance_immutable();

create function public.hotel_v2_seven_arches_public_booking_immutable()
returns trigger language plpgsql set search_path=pg_catalog
as $function$
begin
  raise exception using errcode='55000',
    message='hotels_v2_seven_arches_public_booking_receipt_immutable';
end
$function$;

create trigger hotel_7a_public_booking_receipt_immutable
before update or delete on public.hotel_seven_arches_public_booking_receipts
for each row execute function public.hotel_v2_seven_arches_public_booking_immutable();

create function public.hotel_v2_seven_arches_public_booking_context_guard()
returns trigger language plpgsql volatile security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_count integer;
begin
  if new.hotel_id is distinct from
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid then
    return new;
  end if;
  select count(*)::integer into v_count
  from public.hotel_seven_arches_public_booking_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current()
    and context_row.booking_id=new.id
    and context_row.hotel_id=new.hotel_id
    and context_row.quote_fingerprint=new.pricing_quote_fingerprint
    and context_row.authority_token=new.pricing_authority_token
    and context_row.actor_id is not distinct from auth.uid();
  if v_count<>1
     or new.pricing_quote_fingerprint is null
     or new.pricing_authority_token is null
     or new.pricing_quote_expires_at is null
     or new.pricing_allocation is null
     or jsonb_typeof(new.pricing_allocation)<>'array'
     or jsonb_array_length(new.pricing_allocation) not between 1 and 2 then
    raise exception using errcode='42501',
      message='hotels_v2_seven_arches_public_booking_rpc_required';
  end if;
  delete from public.hotel_seven_arches_public_booking_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current()
    and context_row.booking_id=new.id;
  return new;
end
$function$;

create trigger aa_hotel_7a_public_booking_rpc_guard
before insert on public.hotel_bookings
for each row execute function public.hotel_v2_seven_arches_public_booking_context_guard();

create function public.hotel_v2_seven_arches_public_booking_snapshot_guard()
returns trigger language plpgsql set search_path=pg_catalog
as $function$
begin
  if (old.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
       or new.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
     and (new.hotel_id is distinct from old.hotel_id
       or new.arrival_date is distinct from old.arrival_date
       or new.departure_date is distinct from old.departure_date
       or new.num_adults is distinct from old.num_adults
       or new.num_children is distinct from old.num_children
       or new.nights is distinct from old.nights
       or new.base_price is distinct from old.base_price
       or new.extras_price is distinct from old.extras_price
       or new.coupon_id is distinct from old.coupon_id
       or new.coupon_code is distinct from old.coupon_code
       or new.coupon_discount_amount is distinct from old.coupon_discount_amount
       or new.coupon_partner_id is distinct from old.coupon_partner_id
       or new.coupon_partner_commission_bps is distinct from old.coupon_partner_commission_bps
       or new.final_price is distinct from old.final_price
       or new.total_price is distinct from old.total_price
       or new.selected_extras is distinct from old.selected_extras
       or new.pricing_breakdown is distinct from old.pricing_breakdown
       or new.booking_details is distinct from old.booking_details
       or new.room_type_id is distinct from old.room_type_id
       or new.rate_plan_id is distinct from old.rate_plan_id
       or new.pricing_room_type_id is distinct from old.pricing_room_type_id
       or new.pricing_room_rate_id is distinct from old.pricing_room_rate_id
       or new.pricing_schedule_id is distinct from old.pricing_schedule_id
       or new.pricing_schedule_tier_id is distinct from old.pricing_schedule_tier_id
       or new.pricing_authority_token is distinct from old.pricing_authority_token
       or new.pricing_quote_fingerprint is distinct from old.pricing_quote_fingerprint
       or new.pricing_quote_expires_at is distinct from old.pricing_quote_expires_at
       or new.pricing_allocation is distinct from old.pricing_allocation) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_public_booking_snapshot_immutable';
  end if;
  return new;
end
$function$;

-- Run after the historical `trg_*` coupon mutator on every UPDATE so a
-- lifecycle-only update cannot smuggle a protected snapshot rewrite.
create trigger zz_hotel_7a_public_booking_snapshot_guard
before update on public.hotel_bookings
for each row execute function public.hotel_v2_seven_arches_public_booking_snapshot_guard();

create function public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()
returns boolean language sql stable security definer
set search_path=pg_catalog,public
as $function$
  with ordered as (
    select receipt.*,
      row_number() over(order by receipt.sequence_no) expected_sequence,
      lag(receipt.receipt_hash) over(order by receipt.sequence_no) prior_hash
    from public.hotel_seven_arches_public_booking_receipts receipt
  ), checked as (
    select ordered.sequence_no,
      ordered.sequence_no=ordered.expected_sequence
      and ordered.previous_receipt_hash=coalesce(ordered.prior_hash,
        '5ebf8c71610303ff763cca40cc4fd23238350211c6157a82033bfc8713484dcc')
      and ordered.allocation_fingerprint=public.hotel_v2_h3_2b_hash(
        booking.pricing_allocation)
      and ordered.snapshot_fingerprint=public.hotel_v2_h3_2b_hash(
        jsonb_build_object(
          'pricing_breakdown',booking.pricing_breakdown,
          'booking_details',booking.booking_details,
          'pricing_allocation',booking.pricing_allocation,
          'pricing_quote_fingerprint',booking.pricing_quote_fingerprint,
          'pricing_authority_token',booking.pricing_authority_token))
      and ordered.booking_id=booking.id
      and ordered.hotel_id=booking.hotel_id
      and ordered.quote_fingerprint=booking.pricing_quote_fingerprint
      and ordered.authority_token=booking.pricing_authority_token
      and issuance.hotel_id=ordered.hotel_id
      and issuance.authority_token=ordered.authority_token
      and issuance.quote_payload->>'quote_fingerprint'=ordered.quote_fingerprint
      and issuance.quote_payload->>'quoted_at'=
        to_char(issuance.issued_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      and issuance.quote_payload->>'expires_at'=
        to_char(issuance.expires_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      and issuance.issuance_hash=public.hotel_v2_h3_2b_hash(jsonb_build_object(
        'quote_fingerprint',issuance.quote_fingerprint,
        'hotel_id',issuance.hotel_id,'authority_token',issuance.authority_token,
        'request_fingerprint',issuance.request_fingerprint,
        'quote_payload',issuance.quote_payload,
        'issued_at',(extract(epoch from issuance.issued_at)*1000000)::bigint,
        'expires_at',(extract(epoch from issuance.expires_at)*1000000)::bigint))
      and ordered.result->>'booking_id'=booking.id::text
      and ordered.result->>'quote_fingerprint'=booking.pricing_quote_fingerprint
      and ordered.result->>'contract_version'=
        'hotels_v2_seven_arches_public_booking_result_v1'
      and ordered.result->>'status'='pending'
      and ordered.result->>'currency'='EUR'
      and ordered.result->'customer_total'=to_jsonb(booking.total_price)
      and ordered.result->'coupon_discount'=
        to_jsonb(coalesce(booking.coupon_discount_amount,0))
      and booking.pricing_quote_expires_at is not null
      and booking.pricing_allocation is not null
      and public.hotel_v2_h2a_keys_allowed(ordered.result,array[
        'contract_version','booking_id','status','currency','room_total',
        'extras_total','coupon_discount','customer_total','quote_fingerprint',
        'created_at','replayed'])
      and ordered.result?&array[
        'contract_version','booking_id','status','currency','room_total',
        'extras_total','coupon_discount','customer_total','quote_fingerprint',
        'created_at','replayed']
      and ordered.result->'replayed'='false'::jsonb
      and ordered.receipt_hash=public.hotel_v2_h3_2b_hash(jsonb_build_object(
        'sequence_no',ordered.sequence_no,'id',ordered.id,
        'contract_version',ordered.contract_version,
        'previous_receipt_hash',ordered.previous_receipt_hash,
        'booking_id',ordered.booking_id,'hotel_id',ordered.hotel_id,
        'quote_fingerprint',ordered.quote_fingerprint,
        'authority_token',ordered.authority_token,
        'request_fingerprint',ordered.request_fingerprint,
        'allocation_fingerprint',ordered.allocation_fingerprint,
        'snapshot_fingerprint',ordered.snapshot_fingerprint,
        'result',ordered.result,'created_at',
          (extract(epoch from ordered.created_at)*1000000)::bigint)) valid
    from ordered
    join public.hotel_bookings booking on booking.id=ordered.booking_id
    join public.hotel_seven_arches_public_quote_issuances issuance
      on issuance.quote_fingerprint=ordered.quote_fingerprint
  )
  select case
    when (select count(*) from public.hotel_seven_arches_public_booking_receipts)=0
      then true
    else (select count(*) from checked)=
           (select count(*) from public.hotel_seven_arches_public_booking_receipts)
      and coalesce((select bool_and(coalesce(checked.valid,false)) from checked),false)
    end
$function$;

-- JSON transports legitimately erase PostgreSQL numeric display scale
-- (for example, 210.00 becomes 210).  Bind every quote field while rendering
-- monetary values to one exact representation before hashing.
create function public.hotel_v2_seven_arches_public_quote_fingerprint(p_quote jsonb)
returns text language sql stable security definer
set search_path=pg_catalog,public
as $function$
  select public.hotel_v2_h3_2b_hash(
    (p_quote-array[
      'quote_fingerprint','allocation','selected_extras','extras_total',
      'room_total','customer_total','commission_total','partner_net'])
    ||jsonb_build_object(
      'allocation',coalesce((select jsonb_agg(
        (entry.value-array['nightly_price','stay_total'])||jsonb_build_object(
          'nightly_price',to_char(round((entry.value->>'nightly_price')::numeric,2),
            'FM999999999999999999999999999999990.00'),
          'stay_total',to_char(round((entry.value->>'stay_total')::numeric,2),
            'FM999999999999999999999999999999990.00'))
        order by entry.ordinality)
        from jsonb_array_elements(p_quote->'allocation')
          with ordinality entry(value,ordinality)),'[]'::jsonb),
      'selected_extras',coalesce((select jsonb_agg(
        (extra.value-array['amount','total'])||jsonb_build_object(
          'amount',to_char(round((extra.value->>'amount')::numeric,2),
            'FM999999999999999999999999999999990.00'),
          'total',to_char(round((extra.value->>'total')::numeric,2),
            'FM999999999999999999999999999999990.00'))
        order by extra.ordinality)
        from jsonb_array_elements(p_quote->'selected_extras')
          with ordinality extra(value,ordinality)),'[]'::jsonb),
      'extras_total',to_char(round((p_quote->>'extras_total')::numeric,2),
        'FM999999999999999999999999999999990.00'),
      'room_total',to_char(round((p_quote->>'room_total')::numeric,2),
        'FM999999999999999999999999999999990.00'),
      'customer_total',to_char(round((p_quote->>'customer_total')::numeric,2),
        'FM999999999999999999999999999999990.00'),
      'commission_total',to_char(round((p_quote->>'commission_total')::numeric,2),
        'FM999999999999999999999999999999990.00'),
      'partner_net',to_char(round((p_quote->>'partner_net')::numeric,2),
        'FM999999999999999999999999999999990.00')))
$function$;

create function public.hotel_v2_public_quote_seven_arches_core(p_request jsonb)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper_room constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_upper_rate constant uuid:='7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_ground_room constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_ground_rate constant uuid:='3320590d-632d-423f-80d0-fd021cba7293';
  v_arrival date; v_departure date; v_nights integer; v_guests integer;
  v_room_type uuid; v_room_rate uuid; v_pricing_guests integer;
  v_allocation jsonb; v_allocation_count integer; v_room_total numeric(12,2);
  v_extras_config jsonb; v_selected_ids jsonb; v_selected_extras jsonb;
  v_extras_total numeric(12,2); v_customer_total numeric(12,2);
  v_policy jsonb; v_commercial jsonb; v_state jsonb; v_oracle jsonb;
  v_quoted_at timestamptz:=clock_timestamp(); v_expires_at timestamptz;
  v_canonical jsonb; v_payload jsonb; v_fingerprint text; v_bad boolean;
begin
  if p_request is null or jsonb_typeof(p_request)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_request,array[
       'contract_version','hotel_id','room_type_id','room_rate_id','arrival_date',
       'departure_date','guest_count','selected_extra_ids'])
     or not (p_request?&array[
       'contract_version','hotel_id','room_type_id','room_rate_id','arrival_date',
       'departure_date','guest_count','selected_extra_ids'])
     or p_request->>'contract_version'<>
       'hotels_v2_seven_arches_public_quote_request_v1'
     or jsonb_typeof(p_request->'contract_version')<>'string'
     or jsonb_typeof(p_request->'hotel_id')<>'string'
     or jsonb_typeof(p_request->'arrival_date')<>'string'
     or jsonb_typeof(p_request->'departure_date')<>'string'
     or jsonb_typeof(p_request->'guest_count')<>'number'
     or p_request->>'hotel_id'<>c_hotel::text
     or p_request->>'hotel_id'!~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_request->>'arrival_date'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or p_request->>'departure_date'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or p_request->>'guest_count'!~'^[1-8]$'
     or jsonb_typeof(p_request->'selected_extra_ids')<>'array'
     or jsonb_array_length(p_request->'selected_extra_ids')>100 then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_public_quote_invalid';
  end if;
  begin
    v_arrival:=(p_request->>'arrival_date')::date;
    v_departure:=(p_request->>'departure_date')::date;
    v_guests:=(p_request->>'guest_count')::integer;
  exception when others then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_public_quote_invalid';
  end;
  v_nights:=v_departure-v_arrival;
  if v_arrival<(clock_timestamp() at time zone 'UTC')::date
     or v_nights not between 2 and 365 then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_public_quote_invalid_stay';
  end if;
  if v_guests<=4 then
    if jsonb_typeof(p_request->'room_type_id')<>'string'
       or jsonb_typeof(p_request->'room_rate_id')<>'string'
       or p_request->>'room_type_id'!~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or p_request->>'room_rate_id'!~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode='22023',
        message='hotels_v2_seven_arches_public_quote_room_selection_required';
    end if;
    v_room_type:=(p_request->>'room_type_id')::uuid;
    v_room_rate:=(p_request->>'room_rate_id')::uuid;
    if not ((v_room_type=c_upper_room and v_room_rate=c_upper_rate)
        or (v_room_type=c_ground_room and v_room_rate=c_ground_rate)) then
      raise exception using errcode='22023',
        message='hotels_v2_seven_arches_public_quote_room_identity_invalid';
    end if;
  elsif p_request->'room_type_id'<>'null'::jsonb
     or p_request->'room_rate_id'<>'null'::jsonb then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_public_quote_bundle_room_invalid';
  end if;
  select coalesce(bool_or(jsonb_typeof(entry.value)<>'string'),false)
    or count(*)<>count(distinct entry.value#>>'{}') into v_bad
  from jsonb_array_elements(p_request->'selected_extra_ids') entry(value);
  if v_bad then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_public_quote_extra_invalid';
  end if;
  if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_public_quote_authority_invalid';
  end if;
  v_oracle:=public.hotel_v2_seven_arches_reviewed_pricing_oracle();
  if (v_oracle->>'core_case_count')::integer is distinct from 100
     or (v_oracle->>'core_mismatch_count')::integer is distinct from 0
     or (v_oracle->>'guest_one_case_count')::integer is distinct from 20
     or (v_oracle->>'guest_one_mismatch_count')::integer is distinct from 0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_public_quote_parity_invalid';
  end if;
  v_pricing_guests:=case when v_guests=1 then 2
    when v_guests<=4 then v_guests when v_guests=5 then 2
    when v_guests=6 then 3 else 4 end;
  if v_guests<=4 then
    select jsonb_agg(jsonb_build_object(
      'room_key',authority.room_key,'room_type_id',authority.room_type_id,
      'room_rate_id',authority.room_rate_id,
      'pricing_schedule_id',authority.independent_schedule_id,
      'schedule_tier_id',tier.id,'pricing_guest_count',tier.guest_count,
      'minimum_nights',tier.threshold_nights,'tier_version',tier.version,
      'nightly_price',tier.nightly_rate,'nights',v_nights,
      'stay_total',round(tier.nightly_rate*v_nights,2),'currency','EUR')),
      count(*)::integer,round(sum(tier.nightly_rate*v_nights),2)
      into v_allocation,v_allocation_count,v_room_total
    from public.hotel_seven_arches_independent_pricing_authority authority
    join public.hotel_pricing_schedule_occupancy_tiers tier
      on tier.id=authority.target_tier_id
    where authority.room_type_id=v_room_type and authority.room_rate_id=v_room_rate
      and authority.guest_count=v_pricing_guests
      and authority.threshold_nights=(select max(candidate.threshold_nights)
        from public.hotel_seven_arches_independent_pricing_authority candidate
        where candidate.room_type_id=v_room_type
          and candidate.guest_count=v_pricing_guests
          and candidate.threshold_nights<=least(v_nights,10))
      and authority.current_nightly_rate=tier.nightly_rate
      and authority.current_target_version=tier.version and tier.is_active;
  else
    select jsonb_agg(jsonb_build_object(
      'room_key',authority.room_key,'room_type_id',authority.room_type_id,
      'room_rate_id',authority.room_rate_id,
      'pricing_schedule_id',authority.independent_schedule_id,
      'schedule_tier_id',tier.id,'pricing_guest_count',tier.guest_count,
      'minimum_nights',tier.threshold_nights,'tier_version',tier.version,
      'nightly_price',tier.nightly_rate,'nights',v_nights,
      'stay_total',round(tier.nightly_rate*v_nights,2),'currency','EUR')
      order by authority.room_key desc),count(*)::integer,
      round(sum(tier.nightly_rate*v_nights),2)
      into v_allocation,v_allocation_count,v_room_total
    from public.hotel_seven_arches_independent_pricing_authority authority
    join public.hotel_pricing_schedule_occupancy_tiers tier
      on tier.id=authority.target_tier_id
    where authority.room_key in('upper','ground')
      and authority.guest_count=v_pricing_guests
      and authority.threshold_nights=(select max(candidate.threshold_nights)
        from public.hotel_seven_arches_independent_pricing_authority candidate
        where candidate.room_key=authority.room_key
          and candidate.guest_count=v_pricing_guests
          and candidate.threshold_nights<=least(v_nights,10))
      and authority.current_nightly_rate=tier.nightly_rate
      and authority.current_target_version=tier.version and tier.is_active;
  end if;
  if v_allocation_count<>(case when v_guests<=4 then 1 else 2 end)
     or v_room_total is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_public_quote_authority_resolution_failed';
  end if;
  select hotel.pricing_extras into strict v_extras_config
  from public.hotels hotel where hotel.id=c_hotel;
  if v_extras_config is null or jsonb_typeof(v_extras_config)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(v_extras_config,array['currency','items'])
     or not (v_extras_config?&array['currency','items'])
     or v_extras_config->>'currency'<>'EUR'
     or jsonb_typeof(v_extras_config->'items')<>'array'
     or exists(select 1 from jsonb_array_elements(v_extras_config->'items') item(value)
       where jsonb_typeof(item.value)<>'object'
         or not public.hotel_v2_h2a_keys_allowed(item.value,array[
           'id','label','description','amount','charge_type','is_mandatory','sort_order'])
         or not (item.value?&array['id','label','amount','charge_type','is_mandatory'])
         or item.value->>'id'!~'^[a-z0-9][a-z0-9_-]{0,63}$'
         or jsonb_typeof(item.value->'label')<>'object'
         or item.value->>'amount'!~'^[0-9]+(?:[.][0-9]{1,2})?$'
         or (item.value->>'amount')::numeric<0
         or (item.value?'sort_order' and (
           jsonb_typeof(item.value->'sort_order')<>'number'
           or item.value->>'sort_order'!~'^[0-9]{1,6}$'))
         or item.value->>'charge_type' not in(
           'per_stay','per_night','per_person_per_stay','per_person_per_night')
         or jsonb_typeof(item.value->'is_mandatory')<>'boolean')
     or (select count(*) from jsonb_array_elements(v_extras_config->'items'))<>
        (select count(distinct item.value->>'id')
         from jsonb_array_elements(v_extras_config->'items') item(value)) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_public_quote_extras_contract_invalid';
  end if;
  v_selected_ids:=p_request->'selected_extra_ids';
  if exists(select 1 from jsonb_array_elements_text(v_selected_ids) selected(id)
    where not exists(select 1 from jsonb_array_elements(v_extras_config->'items') item(value)
      where item.value->>'id'=selected.id)) then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_public_quote_extra_invalid';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',item.value->>'id','label',item.value->'label',
      'amount',(item.value->>'amount')::numeric,
      'charge_type',item.value->>'charge_type',
      'is_mandatory',(item.value->>'is_mandatory')::boolean,
      'total',round((item.value->>'amount')::numeric*case item.value->>'charge_type'
        when 'per_night' then v_nights
        when 'per_person_per_stay' then v_guests
        when 'per_person_per_night' then v_guests*v_nights else 1 end,2))
      order by coalesce((item.value->>'sort_order')::integer,0),item.value->>'id')
      filter(where (item.value->>'is_mandatory')::boolean
        or v_selected_ids? (item.value->>'id')),'[]'::jsonb)
    into v_selected_extras
  from jsonb_array_elements(v_extras_config->'items') item(value);
  select coalesce(round(sum((item.value->>'total')::numeric),2),0)
    into v_extras_total from jsonb_array_elements(v_selected_extras) item(value);
  v_customer_total:=round(v_room_total+v_extras_total,2);
  v_policy:=public.hotel_v2_h3_2b_commission_policy(c_hotel);
  if v_policy->>'commission_mode'<>'per_allocated_room_per_night'
     or (v_policy->>'amount')::numeric<>10 or v_policy->>'currency'<>'EUR' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_public_quote_commission_invalid';
  end if;
  v_commercial:=public.hotel_v2_h3_2b_commercial(
    v_policy,v_customer_total,v_allocation_count*v_nights,10);
  v_state:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  if (jsonb_typeof(v_state->'snapshot_token')='string'
       and v_state->>'snapshot_token'~'^[0-9a-f]{64}$') is distinct from true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_public_quote_state_invalid';
  end if;
  v_expires_at:=v_quoted_at+interval '15 minutes';
  v_canonical:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_public_quote_v1',
    'hotel_id',c_hotel,'room_required',v_guests<=4,
    'room_type_id',case when v_guests<=4 then to_jsonb(v_room_type) else 'null'::jsonb end,
    'room_rate_id',case when v_guests<=4 then to_jsonb(v_room_rate) else 'null'::jsonb end,
    'arrival_date',v_arrival,'departure_date',v_departure,'nights',v_nights,
    'guest_count',v_guests,'currency','EUR','allocation',v_allocation,
    'selected_extras',v_selected_extras,'extras_total',v_extras_total,
    'room_total',v_room_total,'customer_total',v_customer_total,
    'commission_total',(v_commercial->>'cypruseye_commission')::numeric,
    'partner_net',(v_commercial->>'partner_net')::numeric,
    'authority_token',v_state->>'snapshot_token');
  v_payload:=v_canonical||jsonb_build_object(
    'quoted_at',to_char(v_quoted_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'expires_at',to_char(v_expires_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  v_fingerprint:=public.hotel_v2_seven_arches_public_quote_fingerprint(v_payload);
  return v_payload||jsonb_build_object('quote_fingerprint',v_fingerprint);
exception when no_data_found or too_many_rows or invalid_text_representation
    or numeric_value_out_of_range then
  raise exception using errcode='22023',
    message='hotels_v2_seven_arches_public_quote_invalid';
end
$function$;

create function public.hotel_v2_public_quote_seven_arches(p_request jsonb)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public
as $function$
declare
  v_internal jsonb;
  v_public jsonb;
  v_issued_at timestamptz;
  v_expires_at timestamptz;
  v_request_fingerprint text;
  v_issuance_hash text;
begin
  v_internal:=public.hotel_v2_public_quote_seven_arches_core(p_request);
  v_public:=v_internal-array['commission_total','partner_net'];
  v_issued_at:=(v_public->>'quoted_at')::timestamptz;
  v_expires_at:=(v_public->>'expires_at')::timestamptz;
  v_request_fingerprint:=public.hotel_v2_h3_2b_hash(p_request);
  v_issuance_hash:=public.hotel_v2_h3_2b_hash(jsonb_build_object(
    'quote_fingerprint',v_public->>'quote_fingerprint',
    'hotel_id',(v_public->>'hotel_id')::uuid,
    'authority_token',v_public->>'authority_token',
    'request_fingerprint',v_request_fingerprint,
    'quote_payload',v_public,
    'issued_at',(extract(epoch from v_issued_at)*1000000)::bigint,
    'expires_at',(extract(epoch from v_expires_at)*1000000)::bigint));
  insert into public.hotel_seven_arches_public_quote_issuances(
    quote_fingerprint,hotel_id,authority_token,request_fingerprint,quote_payload,
    issued_at,expires_at,issuance_hash)
  values(v_public->>'quote_fingerprint',(v_public->>'hotel_id')::uuid,
    v_public->>'authority_token',v_request_fingerprint,v_public,
    v_issued_at,v_expires_at,v_issuance_hash);
  return v_public;
end
$function$;

create function public.hotel_v2_public_create_seven_arches_booking(p_request jsonb)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_genesis constant text:='5ebf8c71610303ff763cca40cc4fd23238350211c6157a82033bfc8713484dcc';
  v_quote jsonb; v_current_quote jsonb; v_quote_request jsonb;
  v_customer jsonb; v_referral jsonb; v_selected_ids jsonb;
  v_request_fingerprint text; v_quote_request_fingerprint text;
  v_existing record; v_issuance record; v_coupon record;
  v_coupon_code text; v_final numeric(12,2); v_discount numeric(12,2):=0;
  v_booking_id uuid:=gen_random_uuid(); v_booking public.hotel_bookings%rowtype;
  v_hotel record; v_allocation_count integer; v_commission numeric(12,2);
  v_sequence bigint; v_previous text; v_created_at timestamptz:=clock_timestamp();
  v_result jsonb; v_snapshot jsonb; v_receipt_hash text;
  v_incoming_timezone text:=current_setting('TimeZone');
begin
  if p_request is null or jsonb_typeof(p_request)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_request,array[
       'contract_version','quote','customer','coupon_code','referral'])
     or not (p_request?&array[
       'contract_version','quote','customer','coupon_code','referral'])
     or jsonb_typeof(p_request->'contract_version')<>'string'
     or p_request->>'contract_version'<>
       'hotels_v2_seven_arches_public_booking_request_v1'
     or jsonb_typeof(p_request->'quote')<>'object'
     or jsonb_typeof(p_request->'customer')<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_request->'customer',array[
       'name','email','phone','notes','language'])
     or not ((p_request->'customer')?&array[
       'name','email','phone','notes','language']) then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_public_booking_invalid';
  end if;
  v_quote:=p_request->'quote'; v_customer:=p_request->'customer';
  if not public.hotel_v2_h2a_keys_allowed(v_quote,array[
       'contract_version','hotel_id','room_required','room_type_id','room_rate_id',
       'arrival_date','departure_date','nights','guest_count','currency','allocation',
       'selected_extras','extras_total','room_total','customer_total',
       'authority_token','quote_fingerprint','quoted_at','expires_at'])
     or not (v_quote?&array[
       'contract_version','hotel_id','room_required','room_type_id','room_rate_id',
       'arrival_date','departure_date','nights','guest_count','currency','allocation',
       'selected_extras','extras_total','room_total','customer_total',
       'authority_token','quote_fingerprint','quoted_at','expires_at'])
     or v_quote->>'contract_version'<>'hotels_v2_seven_arches_public_quote_v1'
     or v_quote->>'hotel_id'<>c_hotel::text
     or jsonb_typeof(v_quote->'quote_fingerprint')<>'string'
     or jsonb_typeof(v_quote->'authority_token')<>'string'
     or jsonb_typeof(v_quote->'quoted_at')<>'string'
     or jsonb_typeof(v_quote->'expires_at')<>'string'
     or v_quote->>'quote_fingerprint'!~'^[0-9a-f]{64}$'
     or v_quote->>'authority_token'!~'^[0-9a-f]{64}$'
     or v_quote->>'quoted_at'!~
       '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$'
     or v_quote->>'expires_at'!~
       '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$'
     or (v_quote->>'quoted_at')::timestamptz>clock_timestamp()+interval '1 second'
     or (v_quote->>'expires_at')::timestamptz<>
       (v_quote->>'quoted_at')::timestamptz+interval '15 minutes'
     or (v_quote->>'expires_at')::timestamptz<=clock_timestamp()
     or jsonb_typeof(v_quote->'selected_extras')<>'array'
     or jsonb_typeof(v_quote->'allocation')<>'array' then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_public_booking_stale_quote';
  end if;
  if jsonb_typeof(v_customer->'name')<>'string'
     or jsonb_typeof(v_customer->'email')<>'string'
     or jsonb_typeof(v_customer->'language')<>'string'
     or v_customer->>'name' is null
     or v_customer->>'name'<>btrim(v_customer->>'name')
     or char_length(v_customer->>'name') not between 2 and 200
     or v_customer->>'name'~'[[:cntrl:]]'
     or v_customer->>'email' is null
     or lower(v_customer->>'email')<>v_customer->>'email'
     or v_customer->>'email'!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or char_length(v_customer->>'email')>320
     or v_customer->>'language' not in('pl','en','he')
     or (v_customer->'phone'<>'null'::jsonb and (
       jsonb_typeof(v_customer->'phone')<>'string'
       or char_length(v_customer->>'phone')>80
       or v_customer->>'phone'~'[[:cntrl:]]'))
     or (v_customer->'notes'<>'null'::jsonb and (
       jsonb_typeof(v_customer->'notes')<>'string'
       or char_length(v_customer->>'notes')>2000
       or v_customer->>'notes'~'[[:cntrl:]]')) then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_public_booking_customer_invalid';
  end if;
  if p_request->'coupon_code'='null'::jsonb then v_coupon_code:=null;
  elsif jsonb_typeof(p_request->'coupon_code')='string'
    and p_request->>'coupon_code'=upper(btrim(p_request->>'coupon_code'))
    and char_length(p_request->>'coupon_code') between 1 and 80
    and p_request->>'coupon_code'!~'[[:cntrl:]]' then
    v_coupon_code:=p_request->>'coupon_code';
  else
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_public_booking_coupon_invalid';
  end if;
  if p_request->'referral'='null'::jsonb then v_referral:=null;
  elsif jsonb_typeof(p_request->'referral')='object'
    and public.hotel_v2_h2a_keys_allowed(p_request->'referral',array[
      'code','source','captured_at'])
    and ((p_request->'referral')?&array['code','source','captured_at'])
    and (p_request#>'{referral,code}'='null'::jsonb or (
      jsonb_typeof(p_request#>'{referral,code}')='string'
      and p_request#>>'{referral,code}'=btrim(p_request#>>'{referral,code}')
      and char_length(p_request#>>'{referral,code}') between 1 and 120
      and p_request#>>'{referral,code}'!~'[[:cntrl:]]'))
    and (p_request#>'{referral,source}'='null'::jsonb or (
      jsonb_typeof(p_request#>'{referral,source}')='string'
      and p_request#>>'{referral,source}'=btrim(p_request#>>'{referral,source}')
      and char_length(p_request#>>'{referral,source}') between 1 and 80
      and p_request#>>'{referral,source}'!~'[[:cntrl:]]'))
    and (p_request#>'{referral,captured_at}'='null'::jsonb or (
      jsonb_typeof(p_request#>'{referral,captured_at}')='string'
      and p_request#>>'{referral,captured_at}'~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:[.][0-9]{1,6})?Z$')) then
    v_referral:=p_request->'referral';
  else
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_public_booking_referral_invalid';
  end if;
  v_selected_ids:=coalesce((select jsonb_agg(extra.value->>'id' order by extra.ordinality)
    from jsonb_array_elements(v_quote->'selected_extras')
      with ordinality extra(value,ordinality)),'[]'::jsonb);
  v_quote_request:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_public_quote_request_v1',
    'hotel_id',c_hotel,'room_type_id',v_quote->'room_type_id',
    'room_rate_id',v_quote->'room_rate_id','arrival_date',v_quote->>'arrival_date',
    'departure_date',v_quote->>'departure_date','guest_count',
    (v_quote->>'guest_count')::integer,'selected_extra_ids',v_selected_ids);
  v_quote_request_fingerprint:=public.hotel_v2_h3_2b_hash(v_quote_request);
  select issuance.* into v_issuance
  from public.hotel_seven_arches_public_quote_issuances issuance
  where issuance.quote_fingerprint=v_quote->>'quote_fingerprint'
  for key share;
  if not found
     or v_issuance.hotel_id<>c_hotel
     or v_issuance.authority_token<>v_quote->>'authority_token'
     or v_issuance.request_fingerprint<>v_quote_request_fingerprint
     or v_issuance.quote_payload is distinct from v_quote
     or v_issuance.issued_at<>(v_quote->>'quoted_at')::timestamptz
     or v_issuance.expires_at<>(v_quote->>'expires_at')::timestamptz
     or v_issuance.expires_at<=clock_timestamp()
     or v_issuance.issuance_hash<>public.hotel_v2_h3_2b_hash(jsonb_build_object(
       'quote_fingerprint',v_issuance.quote_fingerprint,
       'hotel_id',v_issuance.hotel_id,'authority_token',v_issuance.authority_token,
       'request_fingerprint',v_issuance.request_fingerprint,
       'quote_payload',v_issuance.quote_payload,
       'issued_at',(extract(epoch from v_issuance.issued_at)*1000000)::bigint,
       'expires_at',(extract(epoch from v_issuance.expires_at)*1000000)::bigint)) then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_public_booking_stale_quote';
  end if;
  v_current_quote:=public.hotel_v2_public_quote_seven_arches_core(v_quote_request);
  if (v_quote-array['quoted_at','expires_at','quote_fingerprint']) is distinct from
       (v_current_quote-array[
         'quoted_at','expires_at','quote_fingerprint','commission_total','partner_net']) then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_public_booking_stale_quote';
  end if;
  v_request_fingerprint:=public.hotel_v2_h3_2b_hash(p_request);
  if public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()
       is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_public_booking_receipt_chain_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    v_quote->>'quote_fingerprint',420));
  select receipt.request_fingerprint,receipt.result into v_existing
  from public.hotel_seven_arches_public_booking_receipts receipt
  where receipt.quote_fingerprint=v_quote->>'quote_fingerprint';
  if found then
    if v_existing.request_fingerprint=v_request_fingerprint then
      return v_existing.result||jsonb_build_object('replayed',true);
    end if;
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_public_booking_quote_already_consumed';
  end if;
  select hotel.slug,hotel.city into strict v_hotel
  from public.hotels hotel where hotel.id=c_hotel;
  v_final:=(v_quote->>'customer_total')::numeric;
  if v_coupon_code is not null then
    select * into v_coupon from public.service_coupon_quote('hotels',v_coupon_code,
      v_final,((v_quote->>'arrival_date')::date::timestamp at time zone 'UTC'),c_hotel,
      array_remove(array[lower(v_hotel.slug),lower(v_hotel.city)],null),
      auth.uid(),v_customer->>'email');
    if coalesce(v_coupon.is_valid,false) is not true then
      raise exception using errcode='22023',
        message='hotels_v2_seven_arches_public_booking_invalid_coupon';
    end if;
    v_discount:=round(v_coupon.discount_amount,2);
    v_final:=round(v_coupon.final_total,2);
  end if;
  v_allocation_count:=jsonb_array_length(v_quote->'allocation');
  v_commission:=round((v_current_quote->>'commission_total')::numeric,2);
  if v_final<v_commission then
    raise exception using errcode='23514',
      message='hotels_v2_seven_arches_public_booking_commission_exceeds_total';
  end if;
  insert into public.hotel_seven_arches_public_booking_transaction_context(
    backend_pid,transaction_id,booking_id,hotel_id,quote_fingerprint,
    authority_token,actor_id) values(pg_backend_pid(),txid_current(),v_booking_id,
      c_hotel,v_quote->>'quote_fingerprint',v_quote->>'authority_token',auth.uid());
  -- The accepted historical coupon trigger interprets date::timestamptz in the
  -- current TimeZone.  Isolate that trigger call at UTC, then restore the
  -- caller's exact setting on both success and failure.
  perform set_config('TimeZone','UTC',true);
  begin
    insert into public.hotel_bookings(
      id,hotel_id,hotel_slug,customer_name,customer_email,customer_phone,
      arrival_date,departure_date,num_adults,num_children,nights,notes,total_price,
      status,source,created_by,user_id,lang,base_price,coupon_code,
      coupon_discount_amount,final_price,extras_price,selected_extras,
      pricing_breakdown,booking_details,room_type_id,rate_plan_id,
      referral_code,referral_source,referral_captured_at,
      pricing_room_type_id,pricing_room_rate_id,pricing_schedule_id,
      pricing_schedule_tier_id,pricing_authority_token,pricing_quote_fingerprint,
      pricing_quote_expires_at,pricing_allocation)
    values(v_booking_id,c_hotel,v_hotel.slug,v_customer->>'name',v_customer->>'email',
      nullif(v_customer->>'phone',''),(v_quote->>'arrival_date')::date,
      (v_quote->>'departure_date')::date,(v_quote->>'guest_count')::integer,0,
      (v_quote->>'nights')::integer,nullif(v_customer->>'notes',''),v_final,'pending',
      'website',auth.uid(),auth.uid(),v_customer->>'language',
      (v_quote->>'customer_total')::numeric,v_coupon_code,v_discount,v_final,
      (v_quote->>'extras_total')::numeric,
      (select coalesce(jsonb_agg(extra.value->>'id' order by extra.ordinality),'[]'::jsonb)
        from jsonb_array_elements(v_quote->'selected_extras')
          with ordinality extra(value,ordinality)),
      jsonb_build_object('contract_version','hotels_v2_seven_arches_public_pricing_snapshot_v1',
        'allocation',v_quote->'allocation','selected_extras',v_quote->'selected_extras',
        'room_total',(v_quote->>'room_total')::numeric,
        'extras_total',(v_quote->>'extras_total')::numeric,
        'pre_coupon_total',(v_quote->>'customer_total')::numeric,
        'coupon_discount',v_discount,'customer_total',v_final,
        'commission_total',v_commission,'partner_net',round(v_final-v_commission,2)),
      jsonb_build_object('contract_version','hotels_v2_seven_arches_public_booking_snapshot_v1',
        'quote_fingerprint',v_quote->>'quote_fingerprint',
        'authority_token',v_quote->>'authority_token','quoted_at',v_quote->>'quoted_at',
        'expires_at',v_quote->>'expires_at','room_count',v_allocation_count),
      case when v_allocation_count=1 then v_quote->>'room_type_id' else null end,
      '22e47a63-a630-4fb6-8f43-816f2d3fdc17',
      case when v_referral is null then null else nullif(v_referral->>'code','') end,
      case when v_referral is null then null else nullif(v_referral->>'source','') end,
      case when v_referral is null or v_referral->'captured_at'='null'::jsonb then null
        else (v_referral->>'captured_at')::timestamptz end,
      case when v_allocation_count=1 then (v_quote->>'room_type_id')::uuid else null end,
      case when v_allocation_count=1 then (v_quote->>'room_rate_id')::uuid else null end,
      case when v_allocation_count=1 then
        (v_quote#>>'{allocation,0,pricing_schedule_id}')::uuid else null end,
      case when v_allocation_count=1 then
        (v_quote#>>'{allocation,0,schedule_tier_id}')::uuid else null end,
      v_quote->>'authority_token',v_quote->>'quote_fingerprint',
      (v_quote->>'expires_at')::timestamptz,v_quote->'allocation')
    returning * into strict v_booking;
  exception when others then
    perform set_config('TimeZone',v_incoming_timezone,true);
    raise;
  end;
  perform set_config('TimeZone',v_incoming_timezone,true);
  if exists(select 1
      from public.hotel_seven_arches_public_booking_transaction_context context_row
      where context_row.backend_pid=pg_backend_pid()
        and context_row.transaction_id=txid_current()) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_public_booking_context_not_consumed';
  end if;
  v_result:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_public_booking_result_v1',
    'booking_id',v_booking.id,'status',v_booking.status,'currency','EUR',
    'room_total',(v_quote->>'room_total')::numeric,
    'extras_total',(v_quote->>'extras_total')::numeric,
    'coupon_discount',coalesce(v_booking.coupon_discount_amount,0),
    'customer_total',v_booking.total_price,
    'quote_fingerprint',v_quote->>'quote_fingerprint',
    'created_at',to_char(v_booking.created_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'replayed',false);
  perform pg_advisory_xact_lock(hashtextextended(
    'hotel_v2_seven_arches_public_booking_receipt_chain',420));
  select coalesce(max(receipt.sequence_no),0)+1,
    coalesce((select receipt.receipt_hash
      from public.hotel_seven_arches_public_booking_receipts receipt
      order by receipt.sequence_no desc limit 1),c_genesis)
    into v_sequence,v_previous
  from public.hotel_seven_arches_public_booking_receipts receipt;
  v_snapshot:=jsonb_build_object('sequence_no',v_sequence,'id',gen_random_uuid(),
    'contract_version','hotels_v2_seven_arches_public_booking_receipt_v1',
    'previous_receipt_hash',v_previous,'booking_id',v_booking.id,'hotel_id',c_hotel,
    'quote_fingerprint',v_quote->>'quote_fingerprint',
    'authority_token',v_quote->>'authority_token',
    'request_fingerprint',v_request_fingerprint,
    'allocation_fingerprint',public.hotel_v2_h3_2b_hash(v_quote->'allocation'),
    'snapshot_fingerprint',public.hotel_v2_h3_2b_hash(jsonb_build_object(
      'pricing_breakdown',v_booking.pricing_breakdown,
      'booking_details',v_booking.booking_details,
      'pricing_allocation',v_booking.pricing_allocation,
      'pricing_quote_fingerprint',v_booking.pricing_quote_fingerprint,
      'pricing_authority_token',v_booking.pricing_authority_token)),
    'result',v_result,'created_at',
      (extract(epoch from v_created_at)*1000000)::bigint);
  v_receipt_hash:=public.hotel_v2_h3_2b_hash(v_snapshot);
  insert into public.hotel_seven_arches_public_booking_receipts(
    sequence_no,id,contract_version,previous_receipt_hash,receipt_hash,booking_id,
    hotel_id,quote_fingerprint,authority_token,request_fingerprint,
    allocation_fingerprint,snapshot_fingerprint,result,created_at)
  values(v_sequence,(v_snapshot->>'id')::uuid,
    v_snapshot->>'contract_version',v_previous,v_receipt_hash,v_booking.id,c_hotel,
    v_quote->>'quote_fingerprint',v_quote->>'authority_token',v_request_fingerprint,
    v_snapshot->>'allocation_fingerprint',v_snapshot->>'snapshot_fingerprint',
    v_result,v_created_at);
  if public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()
       is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_public_booking_receipt_chain_invalid';
  end if;
  return v_result;
exception when invalid_text_representation or numeric_value_out_of_range
    or datetime_field_overflow then
  raise exception using errcode='22023',
    message='hotels_v2_seven_arches_public_booking_invalid';
end
$function$;

create function public.hotel_v2_partner_get_seven_arches_reviewed_pricing(
  p_partner_id uuid,p_hotel_id uuid
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_access jsonb; v_pricing jsonb; v_state jsonb; v_policy jsonb;
begin
  if p_hotel_id is distinct from
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
     or public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_reviewed_pricing_control_unavailable';
  end if;
  v_access:=public.hotel_v2_h3_2b_access_snapshot(
    p_partner_id,p_hotel_id,'manage_prices');
  v_pricing:=public.hotel_v2_admin_c_pricing_control_snapshot(p_hotel_id);
  v_state:=public.hotel_v2_seven_arches_reviewed_pricing_current_state();
  v_policy:=public.hotel_v2_h3_2b_commission_policy(p_hotel_id);
  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_reviewed_pricing_partner_control_v1',
    'partner_id',p_partner_id,'hotel_id',p_hotel_id,
    'assignment_id',(v_access->>'assignment_id')::uuid,
    'assignment_version',(v_access->>'permission_version')::bigint,
    'access_snapshot_token',public.hotel_v2_h3_2b_hash(v_access),
    'pricing_snapshot_token',v_pricing->>'snapshot_token',
    'evolution_snapshot_token',v_state->>'snapshot_token',
    'commission_policy',jsonb_build_object(
      'commission_mode',v_policy->>'commission_mode',
      'amount',(v_policy->>'amount')::numeric,'currency',v_policy->>'currency'),
    'current_items',coalesce((select jsonb_agg(jsonb_build_object(
      'room_key',authority.room_key,'hotel_id',authority.hotel_id,
      'room_type_id',authority.room_type_id,'room_rate_id',authority.room_rate_id,
      'pricing_schedule_id',authority.independent_schedule_id,
      'schedule_tier_id',authority.target_tier_id,
      'guest_count',authority.guest_count,'minimum_nights',authority.threshold_nights,
      'currency',authority.currency,'current_price',authority.current_nightly_rate,
      'tier_version',authority.current_target_version)
      order by authority.room_key desc,authority.guest_count,authority.threshold_nights)
      from public.hotel_seven_arches_independent_pricing_authority authority),'[]'::jsonb),
    'proposals',coalesce((select jsonb_agg(jsonb_build_object(
      'proposal_id',proposal.id,'status',proposal.status,'reason',proposal.reason,
      'item_count',proposal.item_count,
      'created_at',to_char(proposal.created_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'expires_at',to_char(proposal.expires_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'consumed_at',case when proposal.consumed_at is null then 'null'::jsonb
        else to_jsonb(to_char(proposal.consumed_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) end)
      order by proposal.created_at desc,proposal.id)
      from public.hotel_seven_arches_reviewed_pricing_proposals proposal
      where proposal.partner_id=p_partner_id
        and proposal.assignment_id=(v_access->>'assignment_id')::uuid),'[]'::jsonb));
end
$function$;

alter function public.hotel_v2_seven_arches_public_quote_issuance_immutable()
  owner to postgres;
alter function public.hotel_v2_seven_arches_public_booking_immutable() owner to postgres;
alter function public.hotel_v2_seven_arches_public_booking_context_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_public_booking_snapshot_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()
  owner to postgres;
alter function public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)
  owner to postgres;
alter function public.hotel_v2_public_quote_seven_arches_core(jsonb) owner to postgres;
alter function public.hotel_v2_public_quote_seven_arches(jsonb) owner to postgres;
alter function public.hotel_v2_public_create_seven_arches_booking(jsonb) owner to postgres;
alter function public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)
  owner to postgres;

revoke all on function public.hotel_v2_seven_arches_public_quote_issuance_immutable()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_public_booking_immutable()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_public_booking_context_guard()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_public_booking_snapshot_guard()
  from public,anon,authenticated,service_role;
revoke all on function
  public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()
  from public,anon,authenticated,service_role;
revoke all on function
  public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_public_quote_seven_arches_core(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_public_quote_seven_arches(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_public_create_seven_arches_booking(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function
  public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_public_quote_seven_arches(jsonb)
  to anon,authenticated;
grant execute on function public.hotel_v2_public_create_seven_arches_booking(jsonb)
  to anon,authenticated;
grant execute on function
  public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)
  to authenticated;

do $application_pricing_bridge_postconditions$
begin
  if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() is not true
     or exists(select 1 from (values
       ('public.hotel_seven_arches_public_quote_issuances'::regclass),
       ('public.hotel_seven_arches_public_booking_transaction_context'::regclass),
       ('public.hotel_seven_arches_public_booking_receipts'::regclass)
     ) protected(oid) join pg_class relation on relation.oid=protected.oid
       where relation.relkind<>'r' or relation.relowner<>'postgres'::regrole
         or relation.relrowsecurity is not true or relation.relforcerowsecurity is true)
     or exists(select 1 from pg_policy policy
       where policy.polrelid in(
         'public.hotel_seven_arches_public_quote_issuances'::regclass,
         'public.hotel_seven_arches_public_booking_transaction_context'::regclass,
         'public.hotel_seven_arches_public_booking_receipts'::regclass))
     or exists(select 1 from (values
       ('public.hotel_seven_arches_public_quote_issuances'::regclass),
       ('public.hotel_seven_arches_public_booking_transaction_context'::regclass),
       ('public.hotel_seven_arches_public_booking_receipts'::regclass)
     ) protected(oid) cross join unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name)
       where has_table_privilege(0::oid,protected.oid,privilege.name)
          or has_table_privilege('anon',protected.oid,privilege.name)
          or has_table_privilege('authenticated',protected.oid,privilege.name)
          or has_table_privilege('service_role',protected.oid,privilege.name))
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_public_quote_issuances'::regclass
         and trigger_row.tgname='hotel_7a_public_quote_issuance_immutable'
         and trigger_row.tgfoid=
           'public.hotel_v2_seven_arches_public_quote_issuance_immutable()'::regprocedure
         and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
         and not trigger_row.tgisinternal)
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid='public.hotel_bookings'::regclass
         and trigger_row.tgname='aa_hotel_7a_public_booking_rpc_guard'
         and trigger_row.tgfoid=
           'public.hotel_v2_seven_arches_public_booking_context_guard()'::regprocedure
         and trigger_row.tgtype=7 and trigger_row.tgenabled='O'
         and not trigger_row.tgisinternal)
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid='public.hotel_bookings'::regclass
         and trigger_row.tgname='zz_hotel_7a_public_booking_snapshot_guard'
         and trigger_row.tgfoid=
           'public.hotel_v2_seven_arches_public_booking_snapshot_guard()'::regprocedure
         and trigger_row.tgtype=19 and trigger_row.tgenabled='O'
         and trigger_row.tgattr::text=''
         and pg_get_triggerdef(trigger_row.oid,false) not like '%UPDATE OF%'
         and not trigger_row.tgisinternal)
     or exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid='public.hotel_bookings'::regclass
         and trigger_row.tgname='hotel_7a_public_booking_snapshot_guard'
         and not trigger_row.tgisinternal)
     or exists(select 1 from (values
       ('public.hotel_v2_public_quote_seven_arches(jsonb)'::regprocedure),
       ('public.hotel_v2_public_create_seven_arches_booking(jsonb)'::regprocedure)
     ) api(oid) where not has_function_privilege('anon',api.oid,'EXECUTE')
       or not has_function_privilege('authenticated',api.oid,'EXECUTE')
       or has_function_privilege(0::oid,api.oid,'EXECUTE')
       or has_function_privilege('service_role',api.oid,'EXECUTE'))
     or has_function_privilege('anon',
       'public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)',
       'EXECUTE')
     or not has_function_privilege('authenticated',
       'public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)',
       'EXECUTE')
     or has_function_privilege(0::oid,
       'public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()'::regprocedure,
       'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()'::regprocedure,
       'EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()'::regprocedure,
       'EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()'::regprocedure,
       'EXECUTE')
     or has_function_privilege(0::oid,
       'public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)'::regprocedure,
       'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)'::regprocedure,
       'EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)'::regprocedure,
       'EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)'::regprocedure,
       'EXECUTE')
     or has_function_privilege(0::oid,
       'public.hotel_v2_seven_arches_public_quote_issuance_immutable()'::regprocedure,
       'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_seven_arches_public_quote_issuance_immutable()'::regprocedure,
       'EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_seven_arches_public_quote_issuance_immutable()'::regprocedure,
       'EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_seven_arches_public_quote_issuance_immutable()'::regprocedure,
       'EXECUTE') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_application_bridge_postcondition_failed';
  end if;
end
$application_pricing_bridge_postconditions$;

notify pgrst,'reload schema';
commit;
