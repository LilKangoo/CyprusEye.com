\set ON_ERROR_STOP on
\ir hotels-v2-seven-arches-reviewed-pricing-evolution-postgres-gate.sql

-- The accepted focused Hotels V2 chain intentionally carries a reduced
-- hotel_bookings fixture.  Restore the committed production booking columns
-- consumed by the application bridge without replaying unrelated migrations.
alter table public.hotel_bookings
  add column if not exists hotel_slug text,
  add column if not exists user_id uuid,
  add column if not exists created_by uuid,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists nights integer,
  add column if not exists notes text,
  add column if not exists source text,
  add column if not exists lang text,
  add column if not exists base_price numeric(12,2),
  add column if not exists final_price numeric(12,2),
  add column if not exists extras_price numeric(12,2),
  add column if not exists selected_extras jsonb default '[]'::jsonb,
  add column if not exists pricing_breakdown jsonb default '{}'::jsonb,
  add column if not exists booking_details jsonb default '{}'::jsonb,
  add column if not exists rate_plan_id text,
  add column if not exists coupon_id uuid,
  add column if not exists coupon_code text,
  add column if not exists coupon_discount_amount numeric(12,2) default 0,
  add column if not exists coupon_partner_id uuid,
  add column if not exists coupon_partner_commission_bps integer,
  add column if not exists referral_code text,
  add column if not exists referral_source text,
  add column if not exists referral_captured_at timestamptz;

-- The focused accepted-chain fixture predates the repository's general coupon
-- migration.  Production has this helper; install a fail-closed signature-exact
-- local stand-in so the application bridge can exercise its no-coupon and
-- invalid-coupon paths without replaying unrelated service migrations.
do $application_bridge_coupon_fixture$
begin
  if to_regprocedure(
      'public.service_coupon_quote(text,text,numeric,timestamp with time zone,uuid,text[],uuid,text)')
       is null then
    execute $ddl$
      create function public.service_coupon_quote(
        p_service_type text,p_coupon_code text,p_base_total numeric,
        p_service_at timestamptz default null,p_resource_id uuid default null,
        p_category_keys text[] default null,p_user_id uuid default null,
        p_user_email text default null)
      returns table(is_valid boolean,message text,coupon_id uuid,coupon_code text,
        discount_type text,discount_value numeric,base_total numeric,
        discount_amount numeric,final_total numeric,currency text,partner_id uuid,
        partner_commission_bps_override integer)
      language sql stable security definer set search_path=pg_catalog
      as $fixture$
        select p_coupon_code='UTC_BOUNDARY'
            and (p_service_at at time zone 'UTC')::date=
              (transaction_timestamp() at time zone 'UTC')::date+45,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then 'Coupon applied' else 'Coupon not found' end,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then '42000000-0000-4000-8000-000000000001'::uuid else null::uuid end,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then p_coupon_code else null::text end,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then 'fixed' else null::text end,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then 5::numeric else null::numeric end,
          round(greatest(coalesce(p_base_total,0),0),2),
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then 5::numeric else 0::numeric end,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then round(greatest(coalesce(p_base_total,0)-5,0),2)
            else round(greatest(coalesce(p_base_total,0),0),2) end,
          'EUR',null::uuid,null::integer
      $fixture$
    $ddl$;
    alter function public.service_coupon_quote(
      text,text,numeric,timestamptz,uuid,text[],uuid,text) owner to postgres;
  end if;
end
$application_bridge_coupon_fixture$;

create function public.application_bridge_coupon_fixture_mutator()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $fixture$
declare v_quote record;
begin
  if current_setting('test.hotels_114420_coupon_rewrite',true)='on' then
    new.total_price:=coalesce(new.total_price,0)+1;
    new.final_price:=coalesce(new.final_price,new.total_price,0)+1;
    return new;
  end if;
  if nullif(new.coupon_code,'') is null then return new; end if;
  select * into v_quote from public.service_coupon_quote(
    'hotels',new.coupon_code,new.base_price,new.arrival_date::timestamptz,
    new.hotel_id,array['seven-arches-hotel'],new.user_id,new.customer_email);
  if coalesce(v_quote.is_valid,false) is not true then
    raise exception using errcode='22023',message='Coupon not found';
  end if;
  new.coupon_id:=v_quote.coupon_id;
  new.coupon_code:=v_quote.coupon_code;
  new.coupon_discount_amount:=v_quote.discount_amount;
  new.base_price:=v_quote.base_total;
  new.final_price:=v_quote.final_total;
  new.total_price:=v_quote.final_total;
  return new;
end
$fixture$;
alter function public.application_bridge_coupon_fixture_mutator() owner to postgres;
create trigger trg_apply_service_coupon_hotel_booking_biu
before insert or update on public.hotel_bookings
for each row execute function public.application_bridge_coupon_fixture_mutator();

\ir ../../supabase/migrations/20260811442000_hotels_v2_seven_arches_application_pricing_bridge.sql

-- Focused PostgreSQL gate for the public Room-aware quote and immutable booking
-- snapshot bridge. The accepted pricing fixture is installed above; all booking
-- mutations below are contained by the final rollback.

do $application_bridge_install_contract$
declare v_function record;
begin
  if to_regclass('public.hotel_seven_arches_public_quote_issuances') is null
     or to_regclass('public.hotel_seven_arches_public_booking_transaction_context') is null
     or to_regclass('public.hotel_seven_arches_public_booking_receipts') is null
     or to_regprocedure('public.hotel_v2_public_quote_seven_arches(jsonb)') is null
     or to_regprocedure('public.hotel_v2_public_create_seven_arches_booking(jsonb)') is null
     or to_regprocedure('public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)') is null
     or to_regprocedure('public.hotel_v2_seven_arches_public_quote_issuance_immutable()') is null
     or to_regprocedure('public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)') is null
     or public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() is not true
     or public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() is not true
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
     or not exists(select 1
       from pg_trigger coupon_trigger cross join pg_trigger snapshot_trigger
       where coupon_trigger.tgrelid='public.hotel_bookings'::regclass
         and coupon_trigger.tgname='trg_apply_service_coupon_hotel_booking_biu'
         and coupon_trigger.tgfoid=
           'public.application_bridge_coupon_fixture_mutator()'::regprocedure
         and coupon_trigger.tgtype=23 and coupon_trigger.tgenabled='O'
         and not coupon_trigger.tgisinternal
         and snapshot_trigger.tgrelid='public.hotel_bookings'::regclass
         and snapshot_trigger.tgname='zz_hotel_7a_public_booking_snapshot_guard'
         and coupon_trigger.tgname<snapshot_trigger.tgname)
     or exists(select 1 from (values
       ('public.hotel_seven_arches_public_quote_issuances'::regclass),
       ('public.hotel_seven_arches_public_booking_transaction_context'::regclass),
       ('public.hotel_seven_arches_public_booking_receipts'::regclass)
     ) relation(oid) cross join unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name)
       where has_table_privilege(0::oid,relation.oid,privilege.name)
          or has_table_privilege('anon',relation.oid,privilege.name)
          or has_table_privilege('authenticated',relation.oid,privilege.name)
          or has_table_privilege('service_role',relation.oid,privilege.name)) then
    raise exception using errcode='55000',
      message='application_bridge_gate_install_contract_invalid';
  end if;
  if not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_public_quote_issuances'::regclass
         and trigger_row.tgname='hotel_7a_public_quote_issuance_immutable'
         and trigger_row.tgfoid=
           'public.hotel_v2_seven_arches_public_quote_issuance_immutable()'::regprocedure
         and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
         and not trigger_row.tgisinternal)
     or exists(select 1 from pg_policy policy
       where policy.polrelid in(
         'public.hotel_seven_arches_public_quote_issuances'::regclass,
         'public.hotel_seven_arches_public_booking_transaction_context'::regclass,
         'public.hotel_seven_arches_public_booking_receipts'::regclass))
     or exists(select 1 from pg_class relation where relation.oid in(
         'public.hotel_seven_arches_public_quote_issuances'::regclass,
         'public.hotel_seven_arches_public_booking_transaction_context'::regclass,
         'public.hotel_seven_arches_public_booking_receipts'::regclass)
       and (relation.relowner<>'postgres'::regrole or relation.relkind<>'r'
         or relation.relrowsecurity is not true or relation.relforcerowsecurity is true))
     or exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=
           'public.hotel_v2_seven_arches_public_quote_issuance_immutable()'::regprocedure
         and (procedure_row.proowner<>'postgres'::regrole
           or procedure_row.prosecdef is true or procedure_row.provolatile<>'v'
           or procedure_row.proconfig is distinct from
             array['search_path=pg_catalog']::text[]))
     or has_function_privilege(0::oid,
       'public.hotel_v2_seven_arches_public_quote_issuance_immutable()','EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_seven_arches_public_quote_issuance_immutable()','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_seven_arches_public_quote_issuance_immutable()','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_seven_arches_public_quote_issuance_immutable()','EXECUTE') then
    raise exception using errcode='55000',
      message='application_bridge_gate_issuance_security_invalid';
  end if;
  for v_function in select procedure_row.oid,procedure_row.proname,
      procedure_row.proowner,procedure_row.prosecdef,procedure_row.provolatile,
      procedure_row.proconfig
    from pg_proc procedure_row where procedure_row.oid in(
      'public.hotel_v2_public_quote_seven_arches_core(jsonb)'::regprocedure,
      'public.hotel_v2_public_quote_seven_arches(jsonb)'::regprocedure,
      'public.hotel_v2_public_create_seven_arches_booking(jsonb)'::regprocedure,
      'public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()'::regprocedure,
      'public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)'::regprocedure,
      'public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)'::regprocedure)
  loop
    if v_function.proowner<>'postgres'::regrole
       or v_function.prosecdef is not true
       or v_function.provolatile<>'v'
          and v_function.proname not in(
            'hotel_v2_partner_get_seven_arches_reviewed_pricing',
            'hotel_v2_seven_arches_public_quote_fingerprint',
            'hotel_v2_seven_arches_public_booking_receipt_chain_is_exact')
       or v_function.proname in(
            'hotel_v2_partner_get_seven_arches_reviewed_pricing',
            'hotel_v2_seven_arches_public_quote_fingerprint',
            'hotel_v2_seven_arches_public_booking_receipt_chain_is_exact')
          and v_function.provolatile<>'s'
       or v_function.proconfig is distinct from array[
         'search_path=pg_catalog, public, auth']::text[]
          and v_function.proname in(
            'hotel_v2_public_create_seven_arches_booking',
            'hotel_v2_partner_get_seven_arches_reviewed_pricing')
       or v_function.proconfig is distinct from array[
         'search_path=pg_catalog, public']::text[]
          and v_function.proname in(
            'hotel_v2_public_quote_seven_arches_core',
            'hotel_v2_public_quote_seven_arches',
            'hotel_v2_seven_arches_public_quote_fingerprint',
            'hotel_v2_seven_arches_public_booking_receipt_chain_is_exact') then
      raise exception using errcode='55000',
        message='application_bridge_gate_function_metadata_invalid',
        detail=v_function.proname;
    end if;
  end loop;
  if not has_function_privilege('anon',
       'public.hotel_v2_public_quote_seven_arches(jsonb)','EXECUTE')
     or not has_function_privilege('anon',
       'public.hotel_v2_public_create_seven_arches_booking(jsonb)','EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_public_quote_seven_arches_core(jsonb)','EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)',
       'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()',
       'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)',
       'EXECUTE')
     or not has_function_privilege('authenticated',
       'public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)',
       'EXECUTE') then
    raise exception using errcode='55000',
      message='application_bridge_gate_function_acl_invalid';
  end if;
end
$application_bridge_install_contract$;

create temporary table application_bridge_gate_before on commit preserve rows as
select
  (select count(*)::integer from public.hotel_bookings) booking_count,
  (select count(*)::integer
     from public.hotel_seven_arches_public_booking_receipts) receipt_count,
  (select count(*)::integer
     from public.hotel_seven_arches_public_quote_issuances) issuance_count,
  public.hotel_v2_seven_arches_reviewed_pricing_current_state() pricing_state;

begin;
do $application_bridge_clean_and_negatives$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_upper_room constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_upper_rate constant uuid:='7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_genesis constant text:='5ebf8c71610303ff763cca40cc4fd23238350211c6157a82033bfc8713484dcc';
  v_request jsonb; v_quote jsonb; v_second_quote jsonb; v_bundle jsonb;
  v_booking_request jsonb; v_result jsonb; v_replay jsonb;
  v_coupon_quote jsonb; v_coupon_result_nicosia jsonb; v_coupon_result_utc jsonb;
  v_control jsonb; v_booking public.hotel_bookings%rowtype;
  v_receipt public.hotel_seven_arches_public_booking_receipts%rowtype;
  v_issuance public.hotel_seven_arches_public_quote_issuances%rowtype;
  v_receipt_snapshot jsonb; v_tampered jsonb; v_protected_before jsonb;
  v_incoming_timezone text:=current_setting('TimeZone');
  v_negative_count integer:=0;
begin
  v_request:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_public_quote_request_v1',
    'hotel_id',c_hotel,'room_type_id',c_upper_room,'room_rate_id',c_upper_rate,
    'arrival_date',(transaction_timestamp() at time zone 'UTC')::date+45,
    'departure_date',(transaction_timestamp() at time zone 'UTC')::date+47,
    'guest_count',2,'selected_extra_ids','[]'::jsonb);
  set local role anon;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  v_quote:=public.hotel_v2_public_quote_seven_arches(v_request);
  v_second_quote:=public.hotel_v2_public_quote_seven_arches(v_request);
  v_bundle:=public.hotel_v2_public_quote_seven_arches(v_request||jsonb_build_object(
    'room_type_id',null,'room_rate_id',null,'guest_count',5));
  reset role;

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
     or jsonb_typeof(v_quote->'room_required')<>'boolean'
     or (v_quote->>'room_required')::boolean is not true
     or v_quote->>'room_type_id'<>c_upper_room::text
     or v_quote->>'room_rate_id'<>c_upper_rate::text
     or (v_quote->>'nights')::integer<>2
     or (v_quote->>'guest_count')::integer<>2
     or jsonb_array_length(v_quote->'allocation')<>1
     or v_quote#>>'{allocation,0,room_key}'<>'upper'
     or v_quote#>>'{allocation,0,room_type_id}'<>c_upper_room::text
     or v_quote#>>'{allocation,0,room_rate_id}'<>c_upper_rate::text
     or (v_quote#>>'{allocation,0,pricing_guest_count}')::integer<>2
     or (v_quote#>>'{allocation,0,minimum_nights}')::integer<>2
     or (v_quote->>'room_total')::numeric+
          (v_quote->>'extras_total')::numeric<>(v_quote->>'customer_total')::numeric
     or v_quote?'commission_total' or v_quote?'partner_net'
     or (v_quote->>'expires_at')::timestamptz<>
          (v_quote->>'quoted_at')::timestamptz+interval '15 minutes'
     or v_second_quote->>'quote_fingerprint'=v_quote->>'quote_fingerprint' then
    raise exception using errcode='55000',
      message='application_bridge_gate_single_quote_invalid',
      detail=v_quote::text;
  end if;
  select * into strict v_issuance
  from public.hotel_seven_arches_public_quote_issuances issuance
  where issuance.quote_fingerprint=v_quote->>'quote_fingerprint';
  if v_issuance.quote_payload is distinct from v_quote
     or v_issuance.request_fingerprint<>
       public.hotel_v2_h3_2b_hash(v_request)
     or v_issuance.issued_at<>(v_quote->>'quoted_at')::timestamptz
     or v_issuance.expires_at<>(v_quote->>'expires_at')::timestamptz
     or v_issuance.issuance_hash<>public.hotel_v2_h3_2b_hash(jsonb_build_object(
       'quote_fingerprint',v_issuance.quote_fingerprint,
       'hotel_id',v_issuance.hotel_id,'authority_token',v_issuance.authority_token,
       'request_fingerprint',v_issuance.request_fingerprint,
       'quote_payload',v_issuance.quote_payload,
       'issued_at',(extract(epoch from v_issuance.issued_at)*1000000)::bigint,
       'expires_at',(extract(epoch from v_issuance.expires_at)*1000000)::bigint)) then
    raise exception using errcode='55000',
      message='application_bridge_gate_quote_issuance_invalid';
  end if;
  if jsonb_typeof(v_bundle->'room_required')<>'boolean'
     or (v_bundle->>'room_required')::boolean is not false
     or v_bundle->'room_type_id'<>'null'::jsonb
     or v_bundle->'room_rate_id'<>'null'::jsonb
     or jsonb_array_length(v_bundle->'allocation')<>2
     or v_bundle?'commission_total' or v_bundle?'partner_net'
     or (select count(distinct allocation.value->>'room_key')
       from jsonb_array_elements(v_bundle->'allocation') allocation(value))<>2 then
    raise exception using errcode='55000',
      message='application_bridge_gate_bundle_quote_invalid',detail=v_bundle::text;
  end if;

  v_booking_request:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_public_booking_request_v1',
    'quote',v_quote,'customer',jsonb_build_object(
      'name','Focused public booking','email','public-gate@example.invalid',
      'phone',null,'notes','Rollback-contained booking snapshot','language','en'),
    'coupon_code',null,'referral',null);
  set local role anon;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  v_result:=public.hotel_v2_public_create_seven_arches_booking(v_booking_request);
  v_replay:=public.hotel_v2_public_create_seven_arches_booking(v_booking_request);
  reset role;
  if (v_result-'replayed') is distinct from (v_replay-'replayed')
     or v_result->'replayed'<>'false'::jsonb
     or v_replay->'replayed'<>'true'::jsonb
     or not public.hotel_v2_h2a_keys_allowed(v_result,array[
       'contract_version','booking_id','status','currency','room_total','extras_total',
       'coupon_discount','customer_total','quote_fingerprint','created_at','replayed'])
     or not (v_result?&array[
       'contract_version','booking_id','status','currency','room_total','extras_total',
       'coupon_discount','customer_total','quote_fingerprint','created_at','replayed'])
     or v_result->>'contract_version'<>
       'hotels_v2_seven_arches_public_booking_result_v1'
     or v_result->>'status'<>'pending' or v_result->>'currency'<>'EUR'
     or v_result->>'quote_fingerprint'<>v_quote->>'quote_fingerprint'
     or (v_result->>'customer_total')::numeric<>
          (v_quote->>'customer_total')::numeric then
    raise exception using errcode='55000',
      message='application_bridge_gate_booking_result_invalid',detail=v_result::text;
  end if;
  select * into strict v_booking from public.hotel_bookings booking
    where booking.id=(v_result->>'booking_id')::uuid;
  select * into strict v_receipt
    from public.hotel_seven_arches_public_booking_receipts receipt
    where receipt.booking_id=v_booking.id;
  v_receipt_snapshot:=jsonb_build_object(
    'sequence_no',v_receipt.sequence_no,'id',v_receipt.id,
    'contract_version',v_receipt.contract_version,
    'previous_receipt_hash',v_receipt.previous_receipt_hash,
    'booking_id',v_receipt.booking_id,'hotel_id',v_receipt.hotel_id,
    'quote_fingerprint',v_receipt.quote_fingerprint,
    'authority_token',v_receipt.authority_token,
    'request_fingerprint',v_receipt.request_fingerprint,
    'allocation_fingerprint',v_receipt.allocation_fingerprint,
    'snapshot_fingerprint',v_receipt.snapshot_fingerprint,
    'result',v_receipt.result,'created_at',
      (extract(epoch from v_receipt.created_at)*1000000)::bigint);
  if v_receipt.sequence_no<>1 or v_receipt.previous_receipt_hash<>c_genesis
     or v_receipt.receipt_hash<>public.hotel_v2_h3_2b_hash(v_receipt_snapshot)
     or v_receipt.result is distinct from v_result
     or v_receipt.request_fingerprint<>
          public.hotel_v2_h3_2b_hash(v_booking_request)
     or v_receipt.allocation_fingerprint<>
          public.hotel_v2_h3_2b_hash(v_quote->'allocation')
     or v_receipt.snapshot_fingerprint<>public.hotel_v2_h3_2b_hash(
       jsonb_build_object('pricing_breakdown',v_booking.pricing_breakdown,
         'booking_details',v_booking.booking_details,
         'pricing_allocation',v_booking.pricing_allocation,
         'pricing_quote_fingerprint',v_booking.pricing_quote_fingerprint,
         'pricing_authority_token',v_booking.pricing_authority_token))
     or v_booking.pricing_quote_fingerprint<>v_quote->>'quote_fingerprint'
     or v_booking.pricing_authority_token<>v_quote->>'authority_token'
     or v_booking.pricing_allocation is distinct from v_quote->'allocation'
     or v_booking.pricing_breakdown->>'contract_version'<>
          'hotels_v2_seven_arches_public_pricing_snapshot_v1'
     or v_booking.booking_details->>'contract_version'<>
          'hotels_v2_seven_arches_public_booking_snapshot_v1'
     or (v_booking.pricing_breakdown->>'commission_total')::numeric<>20
     or (v_booking.pricing_breakdown->>'partner_net')::numeric<>
          (v_booking.pricing_breakdown->>'customer_total')::numeric-20
     or public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()
          is not true
     or exists(select 1
       from public.hotel_seven_arches_public_booking_transaction_context) then
    raise exception using errcode='55000',
      message='application_bridge_gate_booking_snapshot_invalid';
  end if;

  -- The all-UPDATE guard allows lifecycle-only changes only when every pricing
  -- snapshot field remains byte-exact after earlier BEFORE triggers.
  v_protected_before:=to_jsonb(v_booking)-array['status','updated_at'];
  update public.hotel_bookings set status=status where id=v_booking.id;
  select * into strict v_booking from public.hotel_bookings where id=v_booking.id;
  if to_jsonb(v_booking)-array['status','updated_at'] is distinct from
       v_protected_before
     or public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()
          is not true then
    raise exception using errcode='55000',
      message='application_bridge_gate_lifecycle_update_invalid';
  end if;
  perform set_config('test.hotels_114420_coupon_rewrite','on',true);
  begin
    update public.hotel_bookings set status='completed' where id=v_booking.id;
    raise exception 'coupon_rewrite_not_rejected';
  exception when sqlstate '55000' then
    if sqlerrm<>'hotels_v2_seven_arches_public_booking_snapshot_immutable'
      then raise; end if;
    v_negative_count:=v_negative_count+1;
  end;
  perform set_config('test.hotels_114420_coupon_rewrite','off',true);

  -- The RPC isolates the legacy coupon trigger at UTC but must preserve the
  -- accepted chain's incoming timezone.  Two independently issued boundary
  -- quotes must therefore produce the same discount without perturbing that
  -- inherited upstream-validation context.
  set local role anon;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  v_coupon_quote:=public.hotel_v2_public_quote_seven_arches(v_request);
  v_coupon_result_nicosia:=public.hotel_v2_public_create_seven_arches_booking(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_public_booking_request_v1',
      'quote',v_coupon_quote,'customer',jsonb_build_object(
        'name','Nicosia coupon booking','email','nicosia-coupon@example.invalid',
        'phone',null,'notes',null,'language','en'),
      'coupon_code','UTC_BOUNDARY','referral',null));
  reset role;
  if current_setting('TimeZone')<>v_incoming_timezone
     or (v_coupon_result_nicosia->>'coupon_discount')::numeric<>5 then
    raise exception using errcode='55000',
      message='application_bridge_gate_nicosia_coupon_boundary_invalid';
  end if;
  set local role anon;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  v_coupon_quote:=public.hotel_v2_public_quote_seven_arches(v_request);
  v_coupon_result_utc:=public.hotel_v2_public_create_seven_arches_booking(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_public_booking_request_v1',
      'quote',v_coupon_quote,'customer',jsonb_build_object(
        'name','UTC coupon booking','email','utc-coupon@example.invalid',
        'phone',null,'notes',null,'language','en'),
      'coupon_code','UTC_BOUNDARY','referral',null));
  reset role;
  if current_setting('TimeZone')<>v_incoming_timezone
     or (v_coupon_result_utc->>'coupon_discount')::numeric<>5
     or (v_coupon_result_utc->>'customer_total')::numeric<>
          (v_coupon_result_nicosia->>'customer_total')::numeric then
    raise exception using errcode='55000',
      message='application_bridge_gate_utc_coupon_boundary_invalid';
  end if;
  if public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()
       is not true then
    raise exception using errcode='55000',
      message='application_bridge_gate_coupon_receipt_chain_invalid';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
    true);
  v_control:=public.hotel_v2_partner_get_seven_arches_reviewed_pricing(
    c_partner,c_hotel);
  reset role;
  if v_control->>'contract_version'<>
       'hotels_v2_seven_arches_reviewed_pricing_partner_control_v1'
     or v_control->>'partner_id'<>c_partner::text
     or jsonb_array_length(v_control->'current_items')<>54
     or (v_control#>>'{commission_policy,amount}')::numeric<>10
     or v_control#>>'{commission_policy,currency}'<>'EUR'
     or v_control->>'evolution_snapshot_token'!~'^[0-9a-f]{64}$'
     or exists(select 1 from jsonb_array_elements(v_control->'current_items') item(value)
       where item.value->>'room_key' not in('upper','ground')
          or item.value->>'currency'<>'EUR'
          or (item.value->>'tier_version')::bigint<=0) then
    raise exception using errcode='55000',
      message='application_bridge_gate_partner_control_invalid',detail=v_control::text;
  end if;

  -- Exact negative probes, each rolled back by its PL/pgSQL subtransaction.
  begin
    set local role anon;
    perform set_config('request.jwt.claims','{"role":"anon"}',true);
    perform public.hotel_v2_public_quote_seven_arches(
      v_request||jsonb_build_object('room_type_id',upper(c_upper_room::text)));
    raise exception 'uppercase_room_not_rejected';
  exception when sqlstate '22023' then
    reset role; v_negative_count:=v_negative_count+1;
  end;
  begin
    set local role anon;
    perform public.hotel_v2_public_quote_seven_arches(
      v_request||jsonb_build_object('guest_count','2'));
    raise exception 'string_guest_count_not_rejected';
  exception when sqlstate '22023' then
    reset role; v_negative_count:=v_negative_count+1;
  end;
  begin
    set local role anon;
    perform public.hotel_v2_public_quote_seven_arches(
      v_request||jsonb_build_object('guest_count',5));
    raise exception 'bundle_room_not_rejected';
  exception when sqlstate '22023' then
    reset role; v_negative_count:=v_negative_count+1;
  end;
  begin
    set local role anon;
    perform public.hotel_v2_public_quote_seven_arches(
      v_request||jsonb_build_object('selected_extra_ids',jsonb_build_array('x','x')));
    raise exception 'duplicate_extra_not_rejected';
  exception when sqlstate '22023' then
    reset role; v_negative_count:=v_negative_count+1;
  end;
  begin
    v_tampered:=jsonb_set(v_bundle,'{customer_total}',
      to_jsonb((v_bundle->>'customer_total')::numeric+1),false);
    set local role anon;
    perform public.hotel_v2_public_create_seven_arches_booking(
      v_booking_request||jsonb_build_object('quote',v_tampered));
    raise exception 'tampered_quote_not_rejected';
  exception when sqlstate 'PT409' then
    reset role; v_negative_count:=v_negative_count+1;
  end;
  begin
    v_tampered:=jsonb_set(v_second_quote,'{expires_at}',to_jsonb(to_char(
      ((v_second_quote->>'quoted_at')::timestamptz+interval '30 minutes')
      at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),false);
    v_tampered:=jsonb_set(v_tampered,'{quote_fingerprint}',to_jsonb(
      v_second_quote->>'quote_fingerprint'),false);
    set local role anon;
    perform public.hotel_v2_public_create_seven_arches_booking(
      v_booking_request||jsonb_build_object('quote',v_tampered));
    raise exception 'extended_expiry_not_rejected';
  exception when sqlstate 'PT409' then
    reset role; v_negative_count:=v_negative_count+1;
  end;
  begin
    set local role anon;
    insert into public.hotel_bookings(hotel_id,hotel_slug,customer_name,
      customer_email,arrival_date,departure_date,num_adults,num_children,nights,
      total_price,status) values(c_hotel,'seven-arches-hotel','Direct bypass',
      'direct-bypass@example.invalid',current_date+60,current_date+62,2,0,2,1,'pending');
    raise exception 'direct_booking_bypass_not_rejected';
  exception when sqlstate '42501' then
    reset role; v_negative_count:=v_negative_count+1;
  end;
  begin
    update public.hotel_bookings set pricing_authority_token=repeat('0',64)
      where id=v_booking.id;
    raise exception 'booking_snapshot_mutation_not_rejected';
  exception when sqlstate '55000' then
    if sqlerrm<>'hotels_v2_seven_arches_public_booking_snapshot_immutable'
      then raise; end if;
    v_negative_count:=v_negative_count+1;
  end;
  begin
    update public.hotel_seven_arches_public_booking_receipts
      set receipt_hash=repeat('0',64) where booking_id=v_booking.id;
    raise exception 'receipt_mutation_not_rejected';
  exception when sqlstate '55000' then
    if sqlerrm<>'hotels_v2_seven_arches_public_booking_receipt_immutable'
      then raise; end if;
    v_negative_count:=v_negative_count+1;
  end;
  begin
    set local role anon;
    perform 1 from public.hotel_seven_arches_public_booking_receipts limit 1;
    raise exception 'raw_receipt_read_not_rejected';
  exception when sqlstate '42501' then
    reset role; v_negative_count:=v_negative_count+1;
  end;
  begin
    set local role anon;
    perform public.hotel_v2_partner_get_seven_arches_reviewed_pricing(
      c_partner,c_hotel);
    raise exception 'anon_partner_control_not_rejected';
  exception when sqlstate '42501' then
    reset role; v_negative_count:=v_negative_count+1;
  end;
  if v_negative_count<>12 then
    raise exception using errcode='55000',
      message='application_bridge_gate_negative_count_invalid',
      detail=v_negative_count::text;
  end if;
end
$application_bridge_clean_and_negatives$;
rollback;

do $application_bridge_rollback_proof$
declare v_before application_bridge_gate_before%rowtype;
begin
  select * into strict v_before from application_bridge_gate_before;
  if (select count(*) from public.hotel_bookings)<>v_before.booking_count
     or (select count(*) from public.hotel_seven_arches_public_booking_receipts)<>
          v_before.receipt_count
     or (select count(*) from public.hotel_seven_arches_public_quote_issuances)<>
          v_before.issuance_count
     or exists(select 1
       from public.hotel_seven_arches_public_booking_transaction_context)
     or public.hotel_v2_seven_arches_reviewed_pricing_current_state()
          is distinct from v_before.pricing_state then
    raise exception using errcode='55000',
      message='application_bridge_gate_rollback_containment_failed';
  end if;
end
$application_bridge_rollback_proof$;

select 'HOTELS_V2_7A_APPLICATION_PRICING_BRIDGE_POSTGRES_GATE_OK' sentinel,
  2 single_room_quotes,
  1 bundle_quote,
  3 booking_snapshots,
  1 exact_replay,
  2 coupon_timezone_restoration_checks,
  54 partner_control_rows,
  12 negative_probes;
