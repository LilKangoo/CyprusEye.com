-- 114484: immutable Guest Policy foundation successor; no business writes.
-- Only Property children_policy/minimum_child_age are normalized. All other
-- fields and all historical evidence retain the complete predecessor checks.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';
LOCK TABLE public.hotels,public.hotel_activity_log,public.hotel_room_types,
 public.hotel_seven_arches_reviewed_pricing_foundation_receipts IN SHARE MODE;
DO $pre$ BEGIN
 IF to_regnamespace('hotels_guest_policy_private') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448300')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448300')
 OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 OR NOT EXISTS(SELECT 1 FROM public.hotels WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND minimum_child_age=15 AND children_policy='minimum_age' AND architecture_version='legacy')
 OR hotels_lifecycle_private.public_booking_enabled() IS NOT FALSE
 THEN RAISE EXCEPTION 'hotels_114484_boundary_or_foundation_mismatch'; END IF;
 PERFORM hotels_read_once_private.assert_exact();
END $pre$;
CREATE SCHEMA hotels_guest_policy_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA hotels_guest_policy_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE hotels_guest_policy_private.bindings(signature text PRIMARY KEY,before_source text NOT NULL,before_definition text NOT NULL,before_metadata jsonb NOT NULL,after_source text NOT NULL,after_hash text NOT NULL);
CREATE TABLE hotels_guest_policy_private.receipt(id integer PRIMARY KEY CHECK(id=1),mutable_columns text[] NOT NULL CHECK(mutable_columns=ARRAY['children_policy','minimum_child_age']::text[]),historical_foundation jsonb NOT NULL,historical_foundation_hash text NOT NULL,hotel_anchor jsonb NOT NULL,normalized_hotel_hash text NOT NULL,activity_ids uuid[] NOT NULL,business_before text NOT NULL,bindings_hash text NOT NULL,helpers jsonb NOT NULL,relations jsonb NOT NULL);
CREATE FUNCTION hotels_guest_policy_private.raw_metadata(p_oid oid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS 'SELECT jsonb_build_array(encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex''),
 encode(sha256(convert_to(pg_get_functiondef(p.oid),''UTF8'')),''hex''),
 pg_get_userbyid(p.proowner),(CASE WHEN p.proacl IS NULL THEN NULL ELSE ARRAY(SELECT entry::text FROM unnest(p.proacl) AS acl(entry) ORDER BY entry::text COLLATE "C") END)::text,p.proconfig,p.provolatile,p.prosecdef,
 p.proleakproof,p.proisstrict,p.proretset,l.lanname)
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=p_oid';
CREATE FUNCTION hotels_guest_policy_private.relation_catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
SELECT jsonb_build_object('schema',(SELECT jsonb_build_array(nspowner,nspacl) FROM pg_namespace WHERE nspname='hotels_guest_policy_private'),
'relations',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'kind',r.relkind,'owner',r.relowner,'rls',r.relrowsecurity,'force',r.relforcerowsecurity,'acl',r.relacl,
'columns',(SELECT jsonb_agg(jsonb_build_array(attname,atttypid,atttypmod,attnotnull) ORDER BY attnum) FROM pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped),
'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid=r.oid),
'policies',(SELECT jsonb_agg(to_jsonb(p)-'oid'-'polrelid' ORDER BY polname) FROM pg_policy p WHERE polrelid=r.oid),
'triggers',(SELECT jsonb_agg(jsonb_build_array(tgname,tgenabled,pg_get_triggerdef(oid)) ORDER BY tgname) FROM pg_trigger WHERE tgrelid=r.oid AND NOT tgisinternal)) ORDER BY r.relname)
FROM pg_class r WHERE r.relnamespace='hotels_guest_policy_private'::regnamespace AND r.relkind IN('r','p','v','m','f')))
$f$;
CREATE FUNCTION hotels_guest_policy_private.immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
BEGIN RAISE EXCEPTION 'hotels_114484_evidence_immutable'; END $f$;
CREATE FUNCTION hotels_guest_policy_private.assert_exact() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE c hotels_guest_policy_private.receipt%rowtype; b record;
BEGIN
 SELECT * INTO STRICT c FROM hotels_guest_policy_private.receipt WHERE id=1;
 IF (SELECT count(*) FROM hotels_guest_policy_private.receipt)<>1
 OR c.mutable_columns IS DISTINCT FROM ARRAY['children_policy','minimum_child_age']::text[]
 OR c.bindings_hash IS DISTINCT FROM (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(x) ORDER BY signature)::text,'UTF8')),'hex') FROM hotels_guest_policy_private.bindings x)
 OR c.historical_foundation IS DISTINCT FROM (SELECT to_jsonb(x) FROM public.hotel_seven_arches_reviewed_pricing_foundation_receipts x WHERE id=1)
 OR c.historical_foundation_hash IS DISTINCT FROM encode(sha256(convert_to(c.historical_foundation::text,'UTF8')),'hex')
 THEN RAISE EXCEPTION 'hotels_114484_evidence_drift'; END IF;
 FOR b IN SELECT * FROM hotels_guest_policy_private.bindings LOOP
  IF hotels_guest_policy_private.raw_metadata(to_regprocedure(b.signature))-0-0 IS DISTINCT FROM b.before_metadata-0-0
   OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure(b.signature)) IS DISTINCT FROM b.after_hash
   OR pg_get_functiondef(to_regprocedure(b.signature)) IS DISTINCT FROM replace(b.before_definition,b.before_source,b.after_source)
  THEN RAISE EXCEPTION 'hotels_114484_bound_source_security_drift:%',b.signature; END IF;
 END LOOP;
 IF c.helpers IS DISTINCT FROM (SELECT jsonb_object_agg(p.oid::regprocedure::text,hotels_guest_policy_private.raw_metadata(p.oid)) FROM pg_proc p WHERE p.pronamespace='hotels_guest_policy_private'::regnamespace)
 OR c.relations IS DISTINCT FROM hotels_guest_policy_private.relation_catalog()
 OR EXISTS(SELECT 1 FROM pg_class r WHERE r.relnamespace='hotels_guest_policy_private'::regnamespace AND r.relkind='r' AND (r.relowner<>'postgres'::regrole OR NOT r.relrowsecurity OR NOT r.relforcerowsecurity
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=r.oid)
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a WHERE a.grantee<>r.relowner)
 OR (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid=r.oid AND NOT t.tgisinternal AND t.tgname='immutable' AND t.tgenabled='O' AND t.tgtype=58 AND t.tgfoid='hotels_guest_policy_private.immutable()'::regprocedure)<>1))
 THEN RAISE EXCEPTION 'hotels_114484_helper_security_drift'; END IF;
END $f$;
CREATE FUNCTION hotels_guest_policy_private.original_source(p_oid oid) RETURNS text LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE b hotels_guest_policy_private.bindings%rowtype; s text;
BEGIN
 SELECT * INTO b FROM hotels_guest_policy_private.bindings WHERE to_regprocedure(signature)=p_oid;
 SELECT prosrc INTO s FROM pg_proc WHERE oid=p_oid;
 IF b.signature IS NOT NULL THEN
  -- Validate this exact binding, not the whole dependency graph per catalog row.
  -- historical_hotel/assert_exact additionally validates the complete successor.
  IF encode(sha256(convert_to(s,'UTF8')),'hex') IS DISTINCT FROM b.after_hash
   OR hotels_guest_policy_private.raw_metadata(p_oid)-0-0 IS DISTINCT FROM b.before_metadata-0-0
   OR encode(sha256(convert_to(b.before_source,'UTF8')),'hex') IS DISTINCT FROM b.before_metadata->>0
   OR pg_get_functiondef(p_oid) IS DISTINCT FROM replace(b.before_definition,b.before_source,b.after_source)
  THEN RAISE EXCEPTION 'hotels_114484_bound_source_security_drift'; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END $f$;
CREATE FUNCTION hotels_guest_policy_private.original_definition(p_oid oid) RETURNS text LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE d text; BEGIN
 PERFORM hotels_guest_policy_private.original_source(p_oid);
 SELECT before_definition INTO d FROM hotels_guest_policy_private.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,pg_get_functiondef(p_oid));
END $f$;
CREATE FUNCTION hotels_guest_policy_private.original_metadata(p_oid oid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE m jsonb; BEGIN
 PERFORM hotels_guest_policy_private.original_source(p_oid);
 SELECT before_metadata INTO m FROM hotels_guest_policy_private.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(m,hotels_guest_policy_private.raw_metadata(p_oid));
END $f$;
CREATE FUNCTION hotels_guest_policy_private.historical_hotel(p_hotel jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE c hotels_guest_policy_private.receipt%rowtype; a record; expected jsonb;
BEGIN
 PERFORM hotels_guest_policy_private.assert_exact();
 SELECT * INTO STRICT c FROM hotels_guest_policy_private.receipt WHERE id=1;
 IF p_hotel->>'id' IS DISTINCT FROM '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
 OR encode(sha256(convert_to((p_hotel-ARRAY['pricing_tiers','updated_at','children_policy','minimum_child_age'])::text,'UTF8')),'hex') IS DISTINCT FROM c.normalized_hotel_hash
 THEN RAISE EXCEPTION 'hotels_114484_non_guest_property_drift'; END IF;
 expected:=c.hotel_anchor;
 FOR a IN SELECT * FROM public.hotel_activity_log WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND source='hotels_v2_admin_b_guest_policy' AND entity_type='property' AND NOT(id=ANY(c.activity_ids)) ORDER BY created_at,id LOOP
  IF a.actor_type IS DISTINCT FROM 'admin' OR a.actor_id IS NULL OR a.correlation_id IS NULL
  OR (a.before_state-ARRAY['updated_at','pricing_tiers']) IS DISTINCT FROM (expected-ARRAY['updated_at','pricing_tiers'])
  OR (a.before_state-ARRAY['updated_at','children_policy','minimum_child_age']) IS DISTINCT FROM (a.after_state-ARRAY['updated_at','children_policy','minimum_child_age'])
  OR public.hotel_v2_h2b1_children_policy_valid(a.after_state->>'children_policy',(a.after_state->>'minimum_child_age')::integer,false) IS NOT TRUE
  THEN RAISE EXCEPTION 'hotels_114484_guest_policy_audit_drift'; END IF;
  expected:=a.after_state;
 END LOOP;
 IF (p_hotel-ARRAY['updated_at','pricing_tiers']) IS DISTINCT FROM (expected-ARRAY['updated_at','pricing_tiers'])
 THEN RAISE EXCEPTION 'hotels_114484_guest_policy_unreviewed'; END IF;
 RETURN p_hotel||jsonb_build_object('children_policy',c.hotel_anchor->'children_policy','minimum_child_age',c.hotel_anchor->'minimum_child_age');
END $f$;
INSERT INTO hotels_guest_policy_private.bindings VALUES
('public.hotel_v2_seven_arches_reviewed_pricing_current_state()','
with normalized as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''id'',tier.id,''schedule_id'',tier.schedule_id,
    ''guest_count'',tier.guest_count,''minimum_nights'',tier.threshold_nights,
    ''nightly_price'',tier.nightly_rate,''active'',tier.is_active,
    ''version'',tier.version)
    order by tier.schedule_id,tier.guest_count,tier.threshold_nights),''[]''::jsonb) value
  from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id in(
    ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
    ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)
), authority_state as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''target_tier_id'',authority.target_tier_id,
    ''room_key'',authority.room_key,''hotel_id'',authority.hotel_id,
    ''room_type_id'',authority.room_type_id,''room_rate_id'',authority.room_rate_id,
    ''pricing_schedule_id'',authority.independent_schedule_id,
    ''guest_count'',authority.guest_count,
    ''minimum_nights'',authority.threshold_nights,''currency'',authority.currency,
    ''initial_nightly_price'',authority.initial_nightly_rate,
    ''current_nightly_price'',authority.current_nightly_rate,
    ''current_target_version'',authority.current_target_version,
    ''current_receipt_sequence'',authority.current_receipt_sequence)
    order by authority.target_tier_id),''[]''::jsonb) value
  from public.hotel_seven_arches_independent_pricing_authority authority
), legacy as (
  select hotel.pricing_tiers value from public.hotels hotel
  where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), commission as (
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id),
    ''[]''::jsonb)) value
  from public.hotel_commission_policies policy
  where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), payment as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''policies'',coalesce((select jsonb_agg(
      to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id)
      from public.hotel_payment_policies policy
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''terms'',coalesce((select jsonb_agg(
      to_jsonb(term)-array[''created_at'',''updated_at''] order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy
        on policy.id=term.payment_policy_id
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb))) value
), unrelated as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''hotel'',(select to_jsonb(hotel)-array[''pricing_tiers'',''updated_at'']
      from public.hotels hotel
      where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),
    ''rate_plans'',coalesce((select jsonb_agg(
      to_jsonb(plan)-array[''created_at'',''updated_at''] order by plan.id)
      from public.hotel_rate_plans plan where plan.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''room_rates'',coalesce((select jsonb_agg(
      to_jsonb(rate)-array[''created_at'',''updated_at''] order by rate.id)
      from public.hotel_room_rates rate where rate.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''schedules'',coalesce((select jsonb_agg(
      to_jsonb(schedule)-array[''created_at'',''updated_at''] order by schedule.id)
      from public.hotel_pricing_schedules schedule where schedule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''other_schedule_tiers'',coalesce((select jsonb_agg(
      to_jsonb(tier)-array[''created_at'',''updated_at''] order by tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
      where schedule.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and tier.schedule_id not in(
          ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
          ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)),''[]''::jsonb),
    ''rate_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate
        on rate.id=rule.room_rate_id where rate.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_room_allocation_rules rule where rule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_items'',coalesce((select jsonb_agg(
      to_jsonb(item)-array[''created_at'',''updated_at''] order by item.id)
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_allocation_rules rule
        on rule.id=item.allocation_rule_id where rule.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''topology_receipts'',coalesce((select jsonb_agg(
      jsonb_set(to_jsonb(receipt),''{created_at}'',
        to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      order by receipt.room_key)
      from public.hotel_seven_arches_independent_pricing_topology_receipts receipt),
      ''[]''::jsonb),
    ''phase1_receipt'',(select jsonb_set(to_jsonb(receipt),''{created_at}'',
      to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
      where receipt.id=1))) value
), room_fingerprints as (
  select jsonb_object_agg(room_key,fingerprint) value from (
    select authority.room_key,public.hotel_v2_h3_2b_hash(jsonb_agg(
      jsonb_build_object(''id'',tier.id,''guest_count'',tier.guest_count,
        ''minimum_nights'',tier.threshold_nights,''nightly_price'',tier.nightly_rate,
        ''active'',tier.is_active,''version'',tier.version)
      order by tier.guest_count,tier.threshold_nights)) fingerprint
    from public.hotel_seven_arches_independent_pricing_authority authority
    join public.hotel_pricing_schedule_occupancy_tiers tier
      on tier.id=authority.target_tier_id
    group by authority.room_key
  ) room
), evidence as (
  select jsonb_build_object(
    ''contract_version'',''hotels_v2_seven_arches_reviewed_pricing_state_v1'',
    ''normalized_fingerprint'',public.hotel_v2_h3_2b_hash(normalized.value),
    ''authority_fingerprint'',public.hotel_v2_h3_2b_hash(authority_state.value),
    ''legacy_fingerprint'',public.hotel_v2_h3_2b_hash(legacy.value),
    ''oracle'',public.hotel_v2_seven_arches_reviewed_pricing_oracle(),
    ''commission_fingerprint'',commission.value,
    ''payment_fingerprint'',payment.value,
    ''unrelated_fingerprint'',unrelated.value,
    ''room_fingerprints'',room_fingerprints.value,
    ''last_receipt_hash'',coalesce((select receipt.receipt_hash
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
      order by receipt.sequence_no desc limit 1),(select foundation.genesis_hash
      from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
      where foundation.id=1)),
    ''receipt_count'',(select count(*)::integer
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts)) value
  from normalized,authority_state,legacy,commission,payment,unrelated,room_fingerprints
)
select evidence.value||jsonb_build_object(
  ''snapshot_token'',public.hotel_v2_h3_2b_hash(evidence.value))
from evidence;
','CREATE OR REPLACE FUNCTION public.hotel_v2_seven_arches_reviewed_pricing_current_state()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
with normalized as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''id'',tier.id,''schedule_id'',tier.schedule_id,
    ''guest_count'',tier.guest_count,''minimum_nights'',tier.threshold_nights,
    ''nightly_price'',tier.nightly_rate,''active'',tier.is_active,
    ''version'',tier.version)
    order by tier.schedule_id,tier.guest_count,tier.threshold_nights),''[]''::jsonb) value
  from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id in(
    ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
    ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)
), authority_state as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''target_tier_id'',authority.target_tier_id,
    ''room_key'',authority.room_key,''hotel_id'',authority.hotel_id,
    ''room_type_id'',authority.room_type_id,''room_rate_id'',authority.room_rate_id,
    ''pricing_schedule_id'',authority.independent_schedule_id,
    ''guest_count'',authority.guest_count,
    ''minimum_nights'',authority.threshold_nights,''currency'',authority.currency,
    ''initial_nightly_price'',authority.initial_nightly_rate,
    ''current_nightly_price'',authority.current_nightly_rate,
    ''current_target_version'',authority.current_target_version,
    ''current_receipt_sequence'',authority.current_receipt_sequence)
    order by authority.target_tier_id),''[]''::jsonb) value
  from public.hotel_seven_arches_independent_pricing_authority authority
), legacy as (
  select hotel.pricing_tiers value from public.hotels hotel
  where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), commission as (
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id),
    ''[]''::jsonb)) value
  from public.hotel_commission_policies policy
  where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), payment as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''policies'',coalesce((select jsonb_agg(
      to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id)
      from public.hotel_payment_policies policy
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''terms'',coalesce((select jsonb_agg(
      to_jsonb(term)-array[''created_at'',''updated_at''] order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy
        on policy.id=term.payment_policy_id
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb))) value
), unrelated as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''hotel'',(select to_jsonb(hotel)-array[''pricing_tiers'',''updated_at'']
      from public.hotels hotel
      where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),
    ''rate_plans'',coalesce((select jsonb_agg(
      to_jsonb(plan)-array[''created_at'',''updated_at''] order by plan.id)
      from public.hotel_rate_plans plan where plan.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''room_rates'',coalesce((select jsonb_agg(
      to_jsonb(rate)-array[''created_at'',''updated_at''] order by rate.id)
      from public.hotel_room_rates rate where rate.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''schedules'',coalesce((select jsonb_agg(
      to_jsonb(schedule)-array[''created_at'',''updated_at''] order by schedule.id)
      from public.hotel_pricing_schedules schedule where schedule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''other_schedule_tiers'',coalesce((select jsonb_agg(
      to_jsonb(tier)-array[''created_at'',''updated_at''] order by tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
      where schedule.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and tier.schedule_id not in(
          ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
          ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)),''[]''::jsonb),
    ''rate_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate
        on rate.id=rule.room_rate_id where rate.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_room_allocation_rules rule where rule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_items'',coalesce((select jsonb_agg(
      to_jsonb(item)-array[''created_at'',''updated_at''] order by item.id)
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_allocation_rules rule
        on rule.id=item.allocation_rule_id where rule.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''topology_receipts'',coalesce((select jsonb_agg(
      jsonb_set(to_jsonb(receipt),''{created_at}'',
        to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      order by receipt.room_key)
      from public.hotel_seven_arches_independent_pricing_topology_receipts receipt),
      ''[]''::jsonb),
    ''phase1_receipt'',(select jsonb_set(to_jsonb(receipt),''{created_at}'',
      to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
      where receipt.id=1))) value
), room_fingerprints as (
  select jsonb_object_agg(room_key,fingerprint) value from (
    select authority.room_key,public.hotel_v2_h3_2b_hash(jsonb_agg(
      jsonb_build_object(''id'',tier.id,''guest_count'',tier.guest_count,
        ''minimum_nights'',tier.threshold_nights,''nightly_price'',tier.nightly_rate,
        ''active'',tier.is_active,''version'',tier.version)
      order by tier.guest_count,tier.threshold_nights)) fingerprint
    from public.hotel_seven_arches_independent_pricing_authority authority
    join public.hotel_pricing_schedule_occupancy_tiers tier
      on tier.id=authority.target_tier_id
    group by authority.room_key
  ) room
), evidence as (
  select jsonb_build_object(
    ''contract_version'',''hotels_v2_seven_arches_reviewed_pricing_state_v1'',
    ''normalized_fingerprint'',public.hotel_v2_h3_2b_hash(normalized.value),
    ''authority_fingerprint'',public.hotel_v2_h3_2b_hash(authority_state.value),
    ''legacy_fingerprint'',public.hotel_v2_h3_2b_hash(legacy.value),
    ''oracle'',public.hotel_v2_seven_arches_reviewed_pricing_oracle(),
    ''commission_fingerprint'',commission.value,
    ''payment_fingerprint'',payment.value,
    ''unrelated_fingerprint'',unrelated.value,
    ''room_fingerprints'',room_fingerprints.value,
    ''last_receipt_hash'',coalesce((select receipt.receipt_hash
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
      order by receipt.sequence_no desc limit 1),(select foundation.genesis_hash
      from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
      where foundation.id=1)),
    ''receipt_count'',(select count(*)::integer
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts)) value
  from normalized,authority_state,legacy,commission,payment,unrelated,room_fingerprints
)
select evidence.value||jsonb_build_object(
  ''snapshot_token'',public.hotel_v2_h3_2b_hash(evidence.value))
from evidence;
$function$
','["1374c443a68b4eefbfb361021c0a8d24b51a3200a5995d87a8d7aa114f0835d1","bfbd4ecb86ff4de7a8c2300f1a9e5f57cffa73a33bcb575c85f1b2843d7a71c9","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql"]'::jsonb,'
with normalized as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''id'',tier.id,''schedule_id'',tier.schedule_id,
    ''guest_count'',tier.guest_count,''minimum_nights'',tier.threshold_nights,
    ''nightly_price'',tier.nightly_rate,''active'',tier.is_active,
    ''version'',tier.version)
    order by tier.schedule_id,tier.guest_count,tier.threshold_nights),''[]''::jsonb) value
  from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id in(
    ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
    ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)
), authority_state as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''target_tier_id'',authority.target_tier_id,
    ''room_key'',authority.room_key,''hotel_id'',authority.hotel_id,
    ''room_type_id'',authority.room_type_id,''room_rate_id'',authority.room_rate_id,
    ''pricing_schedule_id'',authority.independent_schedule_id,
    ''guest_count'',authority.guest_count,
    ''minimum_nights'',authority.threshold_nights,''currency'',authority.currency,
    ''initial_nightly_price'',authority.initial_nightly_rate,
    ''current_nightly_price'',authority.current_nightly_rate,
    ''current_target_version'',authority.current_target_version,
    ''current_receipt_sequence'',authority.current_receipt_sequence)
    order by authority.target_tier_id),''[]''::jsonb) value
  from public.hotel_seven_arches_independent_pricing_authority authority
), legacy as (
  select hotel.pricing_tiers value from public.hotels hotel
  where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), commission as (
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id),
    ''[]''::jsonb)) value
  from public.hotel_commission_policies policy
  where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), payment as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''policies'',coalesce((select jsonb_agg(
      to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id)
      from public.hotel_payment_policies policy
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''terms'',coalesce((select jsonb_agg(
      to_jsonb(term)-array[''created_at'',''updated_at''] order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy
        on policy.id=term.payment_policy_id
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb))) value
), unrelated as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''hotel'',(select hotels_guest_policy_private.historical_hotel(to_jsonb(hotel))-array[''pricing_tiers'',''updated_at'']
      from public.hotels hotel
      where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),
    ''rate_plans'',coalesce((select jsonb_agg(
      to_jsonb(plan)-array[''created_at'',''updated_at''] order by plan.id)
      from public.hotel_rate_plans plan where plan.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''room_rates'',coalesce((select jsonb_agg(
      to_jsonb(rate)-array[''created_at'',''updated_at''] order by rate.id)
      from public.hotel_room_rates rate where rate.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''schedules'',coalesce((select jsonb_agg(
      to_jsonb(schedule)-array[''created_at'',''updated_at''] order by schedule.id)
      from public.hotel_pricing_schedules schedule where schedule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''other_schedule_tiers'',coalesce((select jsonb_agg(
      to_jsonb(tier)-array[''created_at'',''updated_at''] order by tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
      where schedule.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and tier.schedule_id not in(
          ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
          ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)),''[]''::jsonb),
    ''rate_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate
        on rate.id=rule.room_rate_id where rate.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_room_allocation_rules rule where rule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_items'',coalesce((select jsonb_agg(
      to_jsonb(item)-array[''created_at'',''updated_at''] order by item.id)
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_allocation_rules rule
        on rule.id=item.allocation_rule_id where rule.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''topology_receipts'',coalesce((select jsonb_agg(
      jsonb_set(to_jsonb(receipt),''{created_at}'',
        to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      order by receipt.room_key)
      from public.hotel_seven_arches_independent_pricing_topology_receipts receipt),
      ''[]''::jsonb),
    ''phase1_receipt'',(select jsonb_set(to_jsonb(receipt),''{created_at}'',
      to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
      where receipt.id=1))) value
), room_fingerprints as (
  select jsonb_object_agg(room_key,fingerprint) value from (
    select authority.room_key,public.hotel_v2_h3_2b_hash(jsonb_agg(
      jsonb_build_object(''id'',tier.id,''guest_count'',tier.guest_count,
        ''minimum_nights'',tier.threshold_nights,''nightly_price'',tier.nightly_rate,
        ''active'',tier.is_active,''version'',tier.version)
      order by tier.guest_count,tier.threshold_nights)) fingerprint
    from public.hotel_seven_arches_independent_pricing_authority authority
    join public.hotel_pricing_schedule_occupancy_tiers tier
      on tier.id=authority.target_tier_id
    group by authority.room_key
  ) room
), evidence as (
  select jsonb_build_object(
    ''contract_version'',''hotels_v2_seven_arches_reviewed_pricing_state_v1'',
    ''normalized_fingerprint'',public.hotel_v2_h3_2b_hash(normalized.value),
    ''authority_fingerprint'',public.hotel_v2_h3_2b_hash(authority_state.value),
    ''legacy_fingerprint'',public.hotel_v2_h3_2b_hash(legacy.value),
    ''oracle'',public.hotel_v2_seven_arches_reviewed_pricing_oracle(),
    ''commission_fingerprint'',commission.value,
    ''payment_fingerprint'',payment.value,
    ''unrelated_fingerprint'',unrelated.value,
    ''room_fingerprints'',room_fingerprints.value,
    ''last_receipt_hash'',coalesce((select receipt.receipt_hash
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
      order by receipt.sequence_no desc limit 1),(select foundation.genesis_hash
      from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
      where foundation.id=1)),
    ''receipt_count'',(select count(*)::integer
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts)) value
  from normalized,authority_state,legacy,commission,payment,unrelated,room_fingerprints
)
select evidence.value||jsonb_build_object(
  ''snapshot_token'',public.hotel_v2_h3_2b_hash(evidence.value))
from evidence;
','daa90ae3ec5515f22f8be8034276738d135bf3839bdd539dde99fe16636889c8'),
('hotels_read_once_private.read_06b6ba66f8598192(jsonb)','
with normalized as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''id'',tier.id,''schedule_id'',tier.schedule_id,
    ''guest_count'',tier.guest_count,''minimum_nights'',tier.threshold_nights,
    ''nightly_price'',tier.nightly_rate,''active'',tier.is_active,
    ''version'',tier.version)
    order by tier.schedule_id,tier.guest_count,tier.threshold_nights),''[]''::jsonb) value
  from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id in(
    ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
    ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)
), authority_state as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''target_tier_id'',authority.target_tier_id,
    ''room_key'',authority.room_key,''hotel_id'',authority.hotel_id,
    ''room_type_id'',authority.room_type_id,''room_rate_id'',authority.room_rate_id,
    ''pricing_schedule_id'',authority.independent_schedule_id,
    ''guest_count'',authority.guest_count,
    ''minimum_nights'',authority.threshold_nights,''currency'',authority.currency,
    ''initial_nightly_price'',authority.initial_nightly_rate,
    ''current_nightly_price'',authority.current_nightly_rate,
    ''current_target_version'',authority.current_target_version,
    ''current_receipt_sequence'',authority.current_receipt_sequence)
    order by authority.target_tier_id),''[]''::jsonb) value
  from public.hotel_seven_arches_independent_pricing_authority authority
), legacy as (
  select hotel.pricing_tiers value from public.hotels hotel
  where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), commission as (
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id),
    ''[]''::jsonb)) value
  from public.hotel_commission_policies policy
  where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), payment as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''policies'',coalesce((select jsonb_agg(
      to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id)
      from public.hotel_payment_policies policy
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''terms'',coalesce((select jsonb_agg(
      to_jsonb(term)-array[''created_at'',''updated_at''] order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy
        on policy.id=term.payment_policy_id
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb))) value
), unrelated as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''hotel'',(select to_jsonb(hotel)-array[''pricing_tiers'',''updated_at'']
      from public.hotels hotel
      where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),
    ''rate_plans'',coalesce((select jsonb_agg(
      to_jsonb(plan)-array[''created_at'',''updated_at''] order by plan.id)
      from public.hotel_rate_plans plan where plan.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''room_rates'',coalesce((select jsonb_agg(
      to_jsonb(rate)-array[''created_at'',''updated_at''] order by rate.id)
      from public.hotel_room_rates rate where rate.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''schedules'',coalesce((select jsonb_agg(
      to_jsonb(schedule)-array[''created_at'',''updated_at''] order by schedule.id)
      from public.hotel_pricing_schedules schedule where schedule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''other_schedule_tiers'',coalesce((select jsonb_agg(
      to_jsonb(tier)-array[''created_at'',''updated_at''] order by tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
      where schedule.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and tier.schedule_id not in(
          ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
          ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)),''[]''::jsonb),
    ''rate_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate
        on rate.id=rule.room_rate_id where rate.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_room_allocation_rules rule where rule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_items'',coalesce((select jsonb_agg(
      to_jsonb(item)-array[''created_at'',''updated_at''] order by item.id)
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_allocation_rules rule
        on rule.id=item.allocation_rule_id where rule.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''topology_receipts'',coalesce((select jsonb_agg(
      jsonb_set(to_jsonb(receipt),''{created_at}'',
        to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      order by receipt.room_key)
      from public.hotel_seven_arches_independent_pricing_topology_receipts receipt),
      ''[]''::jsonb),
    ''phase1_receipt'',(select jsonb_set(to_jsonb(receipt),''{created_at}'',
      to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
      where receipt.id=1))) value
), room_fingerprints as (
  select jsonb_object_agg(room_key,fingerprint) value from (
    select authority.room_key,public.hotel_v2_h3_2b_hash(jsonb_agg(
      jsonb_build_object(''id'',tier.id,''guest_count'',tier.guest_count,
        ''minimum_nights'',tier.threshold_nights,''nightly_price'',tier.nightly_rate,
        ''active'',tier.is_active,''version'',tier.version)
      order by tier.guest_count,tier.threshold_nights)) fingerprint
    from public.hotel_seven_arches_independent_pricing_authority authority
    join public.hotel_pricing_schedule_occupancy_tiers tier
      on tier.id=authority.target_tier_id
    group by authority.room_key
  ) room
), evidence as (
  select jsonb_build_object(
    ''contract_version'',''hotels_v2_seven_arches_reviewed_pricing_state_v1'',
    ''normalized_fingerprint'',public.hotel_v2_h3_2b_hash(normalized.value),
    ''authority_fingerprint'',public.hotel_v2_h3_2b_hash(authority_state.value),
    ''legacy_fingerprint'',public.hotel_v2_h3_2b_hash(legacy.value),
    ''oracle'',(CASE WHEN (p_read_context#>>ARRAY[''public.hotel_v2_seven_arches_reviewed_pricing_oracle'',''is_null''])::boolean THEN NULL::jsonb ELSE p_read_context#>ARRAY[''public.hotel_v2_seven_arches_reviewed_pricing_oracle'',''value''] END),
    ''commission_fingerprint'',commission.value,
    ''payment_fingerprint'',payment.value,
    ''unrelated_fingerprint'',unrelated.value,
    ''room_fingerprints'',room_fingerprints.value,
    ''last_receipt_hash'',coalesce((select receipt.receipt_hash
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
      order by receipt.sequence_no desc limit 1),(select foundation.genesis_hash
      from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
      where foundation.id=1)),
    ''receipt_count'',(select count(*)::integer
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts)) value
  from normalized,authority_state,legacy,commission,payment,unrelated,room_fingerprints
)
select evidence.value||jsonb_build_object(
  ''snapshot_token'',public.hotel_v2_h3_2b_hash(evidence.value))
from evidence;
','CREATE OR REPLACE FUNCTION hotels_read_once_private.read_06b6ba66f8598192(p_read_context jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
with normalized as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''id'',tier.id,''schedule_id'',tier.schedule_id,
    ''guest_count'',tier.guest_count,''minimum_nights'',tier.threshold_nights,
    ''nightly_price'',tier.nightly_rate,''active'',tier.is_active,
    ''version'',tier.version)
    order by tier.schedule_id,tier.guest_count,tier.threshold_nights),''[]''::jsonb) value
  from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id in(
    ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
    ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)
), authority_state as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''target_tier_id'',authority.target_tier_id,
    ''room_key'',authority.room_key,''hotel_id'',authority.hotel_id,
    ''room_type_id'',authority.room_type_id,''room_rate_id'',authority.room_rate_id,
    ''pricing_schedule_id'',authority.independent_schedule_id,
    ''guest_count'',authority.guest_count,
    ''minimum_nights'',authority.threshold_nights,''currency'',authority.currency,
    ''initial_nightly_price'',authority.initial_nightly_rate,
    ''current_nightly_price'',authority.current_nightly_rate,
    ''current_target_version'',authority.current_target_version,
    ''current_receipt_sequence'',authority.current_receipt_sequence)
    order by authority.target_tier_id),''[]''::jsonb) value
  from public.hotel_seven_arches_independent_pricing_authority authority
), legacy as (
  select hotel.pricing_tiers value from public.hotels hotel
  where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), commission as (
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id),
    ''[]''::jsonb)) value
  from public.hotel_commission_policies policy
  where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), payment as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''policies'',coalesce((select jsonb_agg(
      to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id)
      from public.hotel_payment_policies policy
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''terms'',coalesce((select jsonb_agg(
      to_jsonb(term)-array[''created_at'',''updated_at''] order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy
        on policy.id=term.payment_policy_id
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb))) value
), unrelated as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''hotel'',(select to_jsonb(hotel)-array[''pricing_tiers'',''updated_at'']
      from public.hotels hotel
      where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),
    ''rate_plans'',coalesce((select jsonb_agg(
      to_jsonb(plan)-array[''created_at'',''updated_at''] order by plan.id)
      from public.hotel_rate_plans plan where plan.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''room_rates'',coalesce((select jsonb_agg(
      to_jsonb(rate)-array[''created_at'',''updated_at''] order by rate.id)
      from public.hotel_room_rates rate where rate.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''schedules'',coalesce((select jsonb_agg(
      to_jsonb(schedule)-array[''created_at'',''updated_at''] order by schedule.id)
      from public.hotel_pricing_schedules schedule where schedule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''other_schedule_tiers'',coalesce((select jsonb_agg(
      to_jsonb(tier)-array[''created_at'',''updated_at''] order by tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
      where schedule.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and tier.schedule_id not in(
          ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
          ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)),''[]''::jsonb),
    ''rate_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate
        on rate.id=rule.room_rate_id where rate.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_room_allocation_rules rule where rule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_items'',coalesce((select jsonb_agg(
      to_jsonb(item)-array[''created_at'',''updated_at''] order by item.id)
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_allocation_rules rule
        on rule.id=item.allocation_rule_id where rule.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''topology_receipts'',coalesce((select jsonb_agg(
      jsonb_set(to_jsonb(receipt),''{created_at}'',
        to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      order by receipt.room_key)
      from public.hotel_seven_arches_independent_pricing_topology_receipts receipt),
      ''[]''::jsonb),
    ''phase1_receipt'',(select jsonb_set(to_jsonb(receipt),''{created_at}'',
      to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
      where receipt.id=1))) value
), room_fingerprints as (
  select jsonb_object_agg(room_key,fingerprint) value from (
    select authority.room_key,public.hotel_v2_h3_2b_hash(jsonb_agg(
      jsonb_build_object(''id'',tier.id,''guest_count'',tier.guest_count,
        ''minimum_nights'',tier.threshold_nights,''nightly_price'',tier.nightly_rate,
        ''active'',tier.is_active,''version'',tier.version)
      order by tier.guest_count,tier.threshold_nights)) fingerprint
    from public.hotel_seven_arches_independent_pricing_authority authority
    join public.hotel_pricing_schedule_occupancy_tiers tier
      on tier.id=authority.target_tier_id
    group by authority.room_key
  ) room
), evidence as (
  select jsonb_build_object(
    ''contract_version'',''hotels_v2_seven_arches_reviewed_pricing_state_v1'',
    ''normalized_fingerprint'',public.hotel_v2_h3_2b_hash(normalized.value),
    ''authority_fingerprint'',public.hotel_v2_h3_2b_hash(authority_state.value),
    ''legacy_fingerprint'',public.hotel_v2_h3_2b_hash(legacy.value),
    ''oracle'',(CASE WHEN (p_read_context#>>ARRAY[''public.hotel_v2_seven_arches_reviewed_pricing_oracle'',''is_null''])::boolean THEN NULL::jsonb ELSE p_read_context#>ARRAY[''public.hotel_v2_seven_arches_reviewed_pricing_oracle'',''value''] END),
    ''commission_fingerprint'',commission.value,
    ''payment_fingerprint'',payment.value,
    ''unrelated_fingerprint'',unrelated.value,
    ''room_fingerprints'',room_fingerprints.value,
    ''last_receipt_hash'',coalesce((select receipt.receipt_hash
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
      order by receipt.sequence_no desc limit 1),(select foundation.genesis_hash
      from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
      where foundation.id=1)),
    ''receipt_count'',(select count(*)::integer
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts)) value
  from normalized,authority_state,legacy,commission,payment,unrelated,room_fingerprints
)
select evidence.value||jsonb_build_object(
  ''snapshot_token'',public.hotel_v2_h3_2b_hash(evidence.value))
from evidence;
$function$
','["d61f6b9d1229ac658320792aac6689a3eb5910262fd84e50da8e279a6d912567","5eb599422a4ec5b7606ac8b4c92552fcc1499d350eba2803c474eaa7315f2c74","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql"]'::jsonb,'
with normalized as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''id'',tier.id,''schedule_id'',tier.schedule_id,
    ''guest_count'',tier.guest_count,''minimum_nights'',tier.threshold_nights,
    ''nightly_price'',tier.nightly_rate,''active'',tier.is_active,
    ''version'',tier.version)
    order by tier.schedule_id,tier.guest_count,tier.threshold_nights),''[]''::jsonb) value
  from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id in(
    ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
    ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)
), authority_state as (
  select coalesce(jsonb_agg(jsonb_build_object(
    ''target_tier_id'',authority.target_tier_id,
    ''room_key'',authority.room_key,''hotel_id'',authority.hotel_id,
    ''room_type_id'',authority.room_type_id,''room_rate_id'',authority.room_rate_id,
    ''pricing_schedule_id'',authority.independent_schedule_id,
    ''guest_count'',authority.guest_count,
    ''minimum_nights'',authority.threshold_nights,''currency'',authority.currency,
    ''initial_nightly_price'',authority.initial_nightly_rate,
    ''current_nightly_price'',authority.current_nightly_rate,
    ''current_target_version'',authority.current_target_version,
    ''current_receipt_sequence'',authority.current_receipt_sequence)
    order by authority.target_tier_id),''[]''::jsonb) value
  from public.hotel_seven_arches_independent_pricing_authority authority
), legacy as (
  select hotel.pricing_tiers value from public.hotels hotel
  where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), commission as (
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(
    to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id),
    ''[]''::jsonb)) value
  from public.hotel_commission_policies policy
  where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
), payment as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''policies'',coalesce((select jsonb_agg(
      to_jsonb(policy)-array[''created_at'',''updated_at''] order by policy.id)
      from public.hotel_payment_policies policy
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''terms'',coalesce((select jsonb_agg(
      to_jsonb(term)-array[''created_at'',''updated_at''] order by term.id)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy
        on policy.id=term.payment_policy_id
      where policy.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb))) value
), unrelated as (
  select public.hotel_v2_h3_2b_hash(jsonb_build_object(
    ''hotel'',(select hotels_guest_policy_private.historical_hotel(to_jsonb(hotel))-array[''pricing_tiers'',''updated_at'']
      from public.hotels hotel
      where hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),
    ''rate_plans'',coalesce((select jsonb_agg(
      to_jsonb(plan)-array[''created_at'',''updated_at''] order by plan.id)
      from public.hotel_rate_plans plan where plan.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''room_rates'',coalesce((select jsonb_agg(
      to_jsonb(rate)-array[''created_at'',''updated_at''] order by rate.id)
      from public.hotel_room_rates rate where rate.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''schedules'',coalesce((select jsonb_agg(
      to_jsonb(schedule)-array[''created_at'',''updated_at''] order by schedule.id)
      from public.hotel_pricing_schedules schedule where schedule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''other_schedule_tiers'',coalesce((select jsonb_agg(
      to_jsonb(tier)-array[''created_at'',''updated_at''] order by tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
      where schedule.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and tier.schedule_id not in(
          ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
          ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)),''[]''::jsonb),
    ''rate_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate
        on rate.id=rule.room_rate_id where rate.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_rules'',coalesce((select jsonb_agg(
      to_jsonb(rule)-array[''created_at'',''updated_at''] order by rule.id)
      from public.hotel_room_allocation_rules rule where rule.hotel_id=
        ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''allocation_items'',coalesce((select jsonb_agg(
      to_jsonb(item)-array[''created_at'',''updated_at''] order by item.id)
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_allocation_rules rule
        on rule.id=item.allocation_rule_id where rule.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid),''[]''::jsonb),
    ''topology_receipts'',coalesce((select jsonb_agg(
      jsonb_set(to_jsonb(receipt),''{created_at}'',
        to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      order by receipt.room_key)
      from public.hotel_seven_arches_independent_pricing_topology_receipts receipt),
      ''[]''::jsonb),
    ''phase1_receipt'',(select jsonb_set(to_jsonb(receipt),''{created_at}'',
      to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
      from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
      where receipt.id=1))) value
), room_fingerprints as (
  select jsonb_object_agg(room_key,fingerprint) value from (
    select authority.room_key,public.hotel_v2_h3_2b_hash(jsonb_agg(
      jsonb_build_object(''id'',tier.id,''guest_count'',tier.guest_count,
        ''minimum_nights'',tier.threshold_nights,''nightly_price'',tier.nightly_rate,
        ''active'',tier.is_active,''version'',tier.version)
      order by tier.guest_count,tier.threshold_nights)) fingerprint
    from public.hotel_seven_arches_independent_pricing_authority authority
    join public.hotel_pricing_schedule_occupancy_tiers tier
      on tier.id=authority.target_tier_id
    group by authority.room_key
  ) room
), evidence as (
  select jsonb_build_object(
    ''contract_version'',''hotels_v2_seven_arches_reviewed_pricing_state_v1'',
    ''normalized_fingerprint'',public.hotel_v2_h3_2b_hash(normalized.value),
    ''authority_fingerprint'',public.hotel_v2_h3_2b_hash(authority_state.value),
    ''legacy_fingerprint'',public.hotel_v2_h3_2b_hash(legacy.value),
    ''oracle'',(CASE WHEN (p_read_context#>>ARRAY[''public.hotel_v2_seven_arches_reviewed_pricing_oracle'',''is_null''])::boolean THEN NULL::jsonb ELSE p_read_context#>ARRAY[''public.hotel_v2_seven_arches_reviewed_pricing_oracle'',''value''] END),
    ''commission_fingerprint'',commission.value,
    ''payment_fingerprint'',payment.value,
    ''unrelated_fingerprint'',unrelated.value,
    ''room_fingerprints'',room_fingerprints.value,
    ''last_receipt_hash'',coalesce((select receipt.receipt_hash
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
      order by receipt.sequence_no desc limit 1),(select foundation.genesis_hash
      from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
      where foundation.id=1)),
    ''receipt_count'',(select count(*)::integer
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts)) value
  from normalized,authority_state,legacy,commission,payment,unrelated,room_fingerprints
)
select evidence.value||jsonb_build_object(
  ''snapshot_token'',public.hotel_v2_h3_2b_hash(evidence.value))
from evidence;
','42c373f1330c2decb57da106554642626222c51a83fc49ad3665991add6353dc'),
('hotels_stripe_dto_private.predecessor_source(oid)','
DECLARE s text; b hotels_stripe_dto_private.bindings%rowtype;
BEGIN
 IF (SELECT encode(sha256(convert_to(prosrc,''UTF8'')),''hex'') FROM pg_proc
  WHERE oid=''hotels_stripe_dto_private.assert_exact()''::regprocedure) IS DISTINCT FROM
  (SELECT helper_catalog->''hotels_stripe_dto_private.assert_exact()''->>0 FROM hotels_stripe_dto_private.certificate WHERE id=1)
 THEN RAISE EXCEPTION ''hotels_114481_assertion_source_drift''; END IF;
 SELECT * INTO b FROM hotels_stripe_dto_private.bindings WHERE to_regprocedure(signature)=p_oid;
 SELECT prosrc INTO s FROM pg_proc WHERE oid=p_oid;
 IF b.signature IS NOT NULL THEN
  IF encode(sha256(convert_to(s,''UTF8'')),''hex'') IS DISTINCT FROM b.after_hash
   OR hotels_lifecycle_private.metadata(p_oid) IS DISTINCT FROM b.metadata
  THEN RAISE EXCEPTION ''hotels_114481_bound_source_drift''; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END ','CREATE OR REPLACE FUNCTION hotels_stripe_dto_private.predecessor_source(p_oid oid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE STRICT SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
DECLARE s text; b hotels_stripe_dto_private.bindings%rowtype;
BEGIN
 IF (SELECT encode(sha256(convert_to(prosrc,''UTF8'')),''hex'') FROM pg_proc
  WHERE oid=''hotels_stripe_dto_private.assert_exact()''::regprocedure) IS DISTINCT FROM
  (SELECT helper_catalog->''hotels_stripe_dto_private.assert_exact()''->>0 FROM hotels_stripe_dto_private.certificate WHERE id=1)
 THEN RAISE EXCEPTION ''hotels_114481_assertion_source_drift''; END IF;
 SELECT * INTO b FROM hotels_stripe_dto_private.bindings WHERE to_regprocedure(signature)=p_oid;
 SELECT prosrc INTO s FROM pg_proc WHERE oid=p_oid;
 IF b.signature IS NOT NULL THEN
  IF encode(sha256(convert_to(s,''UTF8'')),''hex'') IS DISTINCT FROM b.after_hash
   OR hotels_lifecycle_private.metadata(p_oid) IS DISTINCT FROM b.metadata
  THEN RAISE EXCEPTION ''hotels_114481_bound_source_drift''; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END $function$
','["00f2c5353e95fb8f6f2ea54bff7233223524f3deb8b01e34a022f6cdd174e3aa","a1e71cdbbf86156cc9ff66782bc018435483496ad5572fdb33025bb1e5879fc7","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql"]'::jsonb,'
DECLARE s text; b hotels_stripe_dto_private.bindings%rowtype;
BEGIN
 IF (SELECT encode(sha256(convert_to(hotels_guest_policy_private.original_source(oid),''UTF8'')),''hex'') FROM pg_proc
  WHERE oid=''hotels_stripe_dto_private.assert_exact()''::regprocedure) IS DISTINCT FROM
  (SELECT helper_catalog->''hotels_stripe_dto_private.assert_exact()''->>0 FROM hotels_stripe_dto_private.certificate WHERE id=1)
 THEN RAISE EXCEPTION ''hotels_114481_assertion_source_drift''; END IF;
 SELECT * INTO b FROM hotels_stripe_dto_private.bindings WHERE to_regprocedure(signature)=p_oid;
 SELECT hotels_guest_policy_private.original_source(p_oid) INTO s;
 IF b.signature IS NOT NULL THEN
  IF encode(sha256(convert_to(s,''UTF8'')),''hex'') IS DISTINCT FROM b.after_hash
   OR hotels_lifecycle_private.metadata(p_oid) IS DISTINCT FROM b.metadata
  THEN RAISE EXCEPTION ''hotels_114481_bound_source_drift''; END IF;
  RETURN b.before_source;
 END IF;
 RETURN s;
END ','199d181264570cba6dd5eb0c370bd19c6da613dfd5d76717f3a1ac71d20ba78a'),
('hotels_stripe_dto_private.predecessor_definition(oid)','
DECLARE d text;
BEGIN
 PERFORM hotels_stripe_dto_private.predecessor_source(p_oid);
 SELECT before_definition INTO d FROM hotels_stripe_dto_private.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,pg_get_functiondef(p_oid));
END ','CREATE OR REPLACE FUNCTION hotels_stripe_dto_private.predecessor_definition(p_oid oid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE STRICT SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
DECLARE d text;
BEGIN
 PERFORM hotels_stripe_dto_private.predecessor_source(p_oid);
 SELECT before_definition INTO d FROM hotels_stripe_dto_private.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,pg_get_functiondef(p_oid));
END $function$
','["b984e232655a089475b6c223f729d21561a78e1cdf1b3ec5783aacfdddf23d71","c1b26388f4b7691959b6930249e39f366222eb8c43a6b123bf461e879c5dcb93","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql"]'::jsonb,'
DECLARE d text;
BEGIN
 PERFORM hotels_stripe_dto_private.predecessor_source(p_oid);
 SELECT before_definition INTO d FROM hotels_stripe_dto_private.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,hotels_guest_policy_private.original_definition(p_oid));
END ','73decaf4897d6f04354399f8cfe1d8a8c5c7e8236e07c900b2d419c0f2277a4a'),
('hotels_lifecycle_private.predecessor_definition(oid)','
DECLARE d text;
BEGIN
 PERFORM hotels_lifecycle_private.predecessor_source(p_oid);
 SELECT before_definition INTO d FROM hotels_lifecycle_private.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,pg_get_functiondef(p_oid));
END ','CREATE OR REPLACE FUNCTION hotels_lifecycle_private.predecessor_definition(p_oid oid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE STRICT SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
DECLARE d text;
BEGIN
 PERFORM hotels_lifecycle_private.predecessor_source(p_oid);
 SELECT before_definition INTO d FROM hotels_lifecycle_private.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,pg_get_functiondef(p_oid));
END $function$
','["b4180a0b352d6618e10ddd29a76c6da041a0db218c81b1913addc680d2cc53bd","a29f7bcbd606073c09aa034f12f0e9e4480667ba9298d1ecf7e4105078ba711c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql"]'::jsonb,'
DECLARE d text;
BEGIN
 PERFORM hotels_lifecycle_private.predecessor_source(p_oid);
 SELECT before_definition INTO d FROM hotels_lifecycle_private.bindings WHERE to_regprocedure(signature)=p_oid;
 RETURN coalesce(d,hotels_guest_policy_private.original_definition(p_oid));
END ','f9ce2c676af6004f902b82e4ee7e8d7e3e7436f12a558bea694263adfe3a3b8d'),
('hotels_stripe_dto_private.helper_catalog()','
 SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_array(
 encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex''),hotels_lifecycle_private.metadata(p.oid)) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''hotels_stripe_dto_private''
','CREATE OR REPLACE FUNCTION hotels_stripe_dto_private.helper_catalog()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
 SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_array(
 encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex''),hotels_lifecycle_private.metadata(p.oid)) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''hotels_stripe_dto_private''
$function$
','["1762100fee5e72a4a349d8789adac731880eec19c0592316bd597f56e7256e20","ac7db2b39a788fc3b8ebc7fc15bdb5fffaf82915f100e4fe8b5c54f5ff0a5c09","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql"]'::jsonb,'
 SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_array(
 encode(sha256(convert_to(hotels_guest_policy_private.original_source(p.oid),''UTF8'')),''hex''),hotels_lifecycle_private.metadata(p.oid)) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''hotels_stripe_dto_private''
','95c4c33e0d17c6c9e175aa3b621dca32da8830691ab761eff6a4e9552cf0c21f'),
('hotels_stripe_dto_private.assert_exact()','
DECLARE c hotels_stripe_dto_private.certificate%rowtype;
BEGIN
 SELECT * INTO STRICT c FROM hotels_stripe_dto_private.certificate WHERE id=1;
 IF EXISTS(SELECT 1 FROM (VALUES (''hotels_stripe_dto_private.helper_catalog()'',''1762100fee5e72a4a349d8789adac731880eec19c0592316bd597f56e7256e20''),(''hotels_stripe_dto_private.relation_catalog()'',''d7955b8131b837f37fece6afa3dc8e9e8b2a91aed90f787b1e4e10db2fed1b44'')) e(signature,expected_hash)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 WHERE p.oid IS NULL OR encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex'') IS DISTINCT FROM e.expected_hash)
 OR c.helper_catalog IS DISTINCT FROM hotels_stripe_dto_private.helper_catalog()
 OR c.relation_catalog IS DISTINCT FROM hotels_stripe_dto_private.relation_catalog()
 OR c.binding_hash IS DISTINCT FROM (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,''UTF8'')),''hex'') FROM hotels_stripe_dto_private.bindings b)
 OR (SELECT count(*) FROM hotels_stripe_dto_private.bindings)<>6
 OR EXISTS(SELECT 1 FROM hotels_stripe_dto_private.bindings b LEFT JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE p.oid IS NULL OR encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex'') IS DISTINCT FROM b.after_hash
 OR encode(sha256(convert_to(b.before_source,''UTF8'')),''hex'') IS DISTINCT FROM b.before_hash
 OR encode(sha256(convert_to(b.after_source,''UTF8'')),''hex'') IS DISTINCT FROM b.after_hash
 OR hotels_lifecycle_private.metadata(p.oid) IS DISTINCT FROM b.metadata)
 THEN RAISE EXCEPTION ''hotels_114481_source_security_drift''; END IF;
END ','CREATE OR REPLACE FUNCTION hotels_stripe_dto_private.assert_exact()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
DECLARE c hotels_stripe_dto_private.certificate%rowtype;
BEGIN
 SELECT * INTO STRICT c FROM hotels_stripe_dto_private.certificate WHERE id=1;
 IF EXISTS(SELECT 1 FROM (VALUES (''hotels_stripe_dto_private.helper_catalog()'',''1762100fee5e72a4a349d8789adac731880eec19c0592316bd597f56e7256e20''),(''hotels_stripe_dto_private.relation_catalog()'',''d7955b8131b837f37fece6afa3dc8e9e8b2a91aed90f787b1e4e10db2fed1b44'')) e(signature,expected_hash)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 WHERE p.oid IS NULL OR encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex'') IS DISTINCT FROM e.expected_hash)
 OR c.helper_catalog IS DISTINCT FROM hotels_stripe_dto_private.helper_catalog()
 OR c.relation_catalog IS DISTINCT FROM hotels_stripe_dto_private.relation_catalog()
 OR c.binding_hash IS DISTINCT FROM (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,''UTF8'')),''hex'') FROM hotels_stripe_dto_private.bindings b)
 OR (SELECT count(*) FROM hotels_stripe_dto_private.bindings)<>6
 OR EXISTS(SELECT 1 FROM hotels_stripe_dto_private.bindings b LEFT JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE p.oid IS NULL OR encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex'') IS DISTINCT FROM b.after_hash
 OR encode(sha256(convert_to(b.before_source,''UTF8'')),''hex'') IS DISTINCT FROM b.before_hash
 OR encode(sha256(convert_to(b.after_source,''UTF8'')),''hex'') IS DISTINCT FROM b.after_hash
 OR hotels_lifecycle_private.metadata(p.oid) IS DISTINCT FROM b.metadata)
 THEN RAISE EXCEPTION ''hotels_114481_source_security_drift''; END IF;
END $function$
','["cca811474be9abaaeb966273073c81df4377f245b9a8702c3342f638bef9bccf","6295320ea13752be2df469ca9e8c0bc6012f1c1a1ff3e729769550fbb226267a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql"]'::jsonb,'
DECLARE c hotels_stripe_dto_private.certificate%rowtype;
BEGIN
 SELECT * INTO STRICT c FROM hotels_stripe_dto_private.certificate WHERE id=1;
 IF EXISTS(SELECT 1 FROM (VALUES (''hotels_stripe_dto_private.helper_catalog()'',''1762100fee5e72a4a349d8789adac731880eec19c0592316bd597f56e7256e20''),(''hotels_stripe_dto_private.relation_catalog()'',''d7955b8131b837f37fece6afa3dc8e9e8b2a91aed90f787b1e4e10db2fed1b44'')) e(signature,expected_hash)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 WHERE p.oid IS NULL OR encode(sha256(convert_to(hotels_guest_policy_private.original_source(p.oid),''UTF8'')),''hex'') IS DISTINCT FROM e.expected_hash)
 OR c.helper_catalog IS DISTINCT FROM hotels_stripe_dto_private.helper_catalog()
 OR c.relation_catalog IS DISTINCT FROM hotels_stripe_dto_private.relation_catalog()
 OR c.binding_hash IS DISTINCT FROM (SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,''UTF8'')),''hex'') FROM hotels_stripe_dto_private.bindings b)
 OR (SELECT count(*) FROM hotels_stripe_dto_private.bindings)<>6
 OR EXISTS(SELECT 1 FROM hotels_stripe_dto_private.bindings b LEFT JOIN pg_proc p ON p.oid=to_regprocedure(b.signature)
 WHERE p.oid IS NULL OR encode(sha256(convert_to(hotels_guest_policy_private.original_source(p.oid),''UTF8'')),''hex'') IS DISTINCT FROM b.after_hash
 OR encode(sha256(convert_to(b.before_source,''UTF8'')),''hex'') IS DISTINCT FROM b.before_hash
 OR encode(sha256(convert_to(b.after_source,''UTF8'')),''hex'') IS DISTINCT FROM b.after_hash
 OR hotels_lifecycle_private.metadata(p.oid) IS DISTINCT FROM b.metadata)
 THEN RAISE EXCEPTION ''hotels_114481_source_security_drift''; END IF;
END ','27a6557461c65b339d4bc4aee6c9faf8f83748fe134d4b852c9e5f4dfb99287c'),
('hotels_read_once_private.metadata(oid)','SELECT jsonb_build_array(encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex''),
 encode(sha256(convert_to(pg_get_functiondef(p.oid),''UTF8'')),''hex''),
 pg_get_userbyid(p.proowner),(CASE WHEN p.proacl IS NULL THEN NULL ELSE ARRAY(SELECT entry::text FROM unnest(p.proacl) AS acl(entry) ORDER BY entry::text COLLATE "C") END)::text,p.proconfig,p.provolatile,p.prosecdef,
 p.proleakproof,p.proisstrict,p.proretset,l.lanname)
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=p_oid','CREATE OR REPLACE FUNCTION hotels_read_once_private.metadata(p_oid oid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$SELECT jsonb_build_array(encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex''),
 encode(sha256(convert_to(pg_get_functiondef(p.oid),''UTF8'')),''hex''),
 pg_get_userbyid(p.proowner),(CASE WHEN p.proacl IS NULL THEN NULL ELSE ARRAY(SELECT entry::text FROM unnest(p.proacl) AS acl(entry) ORDER BY entry::text COLLATE "C") END)::text,p.proconfig,p.provolatile,p.prosecdef,
 p.proleakproof,p.proisstrict,p.proretset,l.lanname)
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=p_oid$function$
','["65e9d9a19c19f1e8281861752f6f7be2dcba7720fda4810a435a750ad14531b0","372e0a884a1a20b95545c9926a015eac0a2ea3fd18831546950c1b5cdb2f5da0","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql"]'::jsonb,'SELECT hotels_guest_policy_private.original_metadata(p_oid)','e8e3fdd2c8fddcfc5f68a048ec08db82ee507c40e446f222866b658a5d790f88'),
('hotels_read_once_private.assert_exact()','
DECLARE c hotels_read_once_private.certificate%rowtype; b jsonb; actual jsonb;
BEGIN
 SELECT * INTO STRICT c FROM hotels_read_once_private.certificate WHERE id=1;
 IF (SELECT count(*) FROM hotels_read_once_private.certificate)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=''hotels_read_once_private.certificate''::regclass AND relowner=''postgres''::regrole AND relrowsecurity AND relforcerowsecurity)
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=''hotels_read_once_private.certificate''::regclass)
 OR EXISTS(SELECT 1 FROM pg_class r,LATERAL aclexplode(coalesce(r.relacl,acldefault(''r'',r.relowner))) a WHERE r.oid=''hotels_read_once_private.certificate''::regclass AND a.grantee<>r.relowner)
 OR EXISTS(SELECT 1 FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault(''n'',n.nspowner))) a WHERE n.nspname=''hotels_read_once_private'' AND (n.nspowner<>''postgres''::regrole OR a.grantee<>n.nspowner))
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid=''hotels_read_once_private.certificate''::regclass AND NOT tgisinternal)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=''hotels_read_once_private.certificate''::regclass AND tgname=''immutable'' AND tgenabled=''O'' AND tgtype=58 AND tgfoid=''hotels_read_once_private.immutable()''::regprocedure)
 THEN RAISE EXCEPTION ''hotels_114483_certificate_security_drift''; END IF;
 -- Verify metadata evaluator source before trusting it.
 IF (SELECT encode(sha256(convert_to(prosrc,''UTF8'')),''hex'') FROM pg_proc WHERE oid=''hotels_read_once_private.metadata(oid)''::regprocedure)
 IS DISTINCT FROM ''65e9d9a19c19f1e8281861752f6f7be2dcba7720fda4810a435a750ad14531b0'' THEN RAISE EXCEPTION ''hotels_114483_metadata_drift''; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(c.predecessors) LOOP
  IF hotels_read_once_private.metadata(to_regprocedure(b->>''signature'')) IS DISTINCT FROM b->''meta''
  THEN RAISE EXCEPTION ''hotels_114483_predecessor_drift:%'',b->>''signature''; END IF;
 END LOOP;
 SELECT jsonb_object_agg(p.oid::regprocedure::text,hotels_read_once_private.metadata(p.oid) ORDER BY p.oid::regprocedure::text) INTO actual
 FROM pg_proc p WHERE p.pronamespace=''hotels_read_once_private''::regnamespace OR p.oid IN(''public.hotel_v2_admin_get_shadow_preparation_state_114483(uuid)''::regprocedure,''public.hotel_v2_admin_get_seven_arches_pricing_activation_114483()''::regprocedure,''public.hotel_v2_admin_get_legacy_pricing_promotion_preview_114483(uuid)''::regprocedure);
 IF actual IS DISTINCT FROM c.functions THEN RAISE EXCEPTION ''hotels_114483_source_security_drift''; END IF;
END ','CREATE OR REPLACE FUNCTION hotels_read_once_private.assert_exact()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''pg_catalog'', ''public''
AS $function$
DECLARE c hotels_read_once_private.certificate%rowtype; b jsonb; actual jsonb;
BEGIN
 SELECT * INTO STRICT c FROM hotels_read_once_private.certificate WHERE id=1;
 IF (SELECT count(*) FROM hotels_read_once_private.certificate)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=''hotels_read_once_private.certificate''::regclass AND relowner=''postgres''::regrole AND relrowsecurity AND relforcerowsecurity)
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=''hotels_read_once_private.certificate''::regclass)
 OR EXISTS(SELECT 1 FROM pg_class r,LATERAL aclexplode(coalesce(r.relacl,acldefault(''r'',r.relowner))) a WHERE r.oid=''hotels_read_once_private.certificate''::regclass AND a.grantee<>r.relowner)
 OR EXISTS(SELECT 1 FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault(''n'',n.nspowner))) a WHERE n.nspname=''hotels_read_once_private'' AND (n.nspowner<>''postgres''::regrole OR a.grantee<>n.nspowner))
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid=''hotels_read_once_private.certificate''::regclass AND NOT tgisinternal)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=''hotels_read_once_private.certificate''::regclass AND tgname=''immutable'' AND tgenabled=''O'' AND tgtype=58 AND tgfoid=''hotels_read_once_private.immutable()''::regprocedure)
 THEN RAISE EXCEPTION ''hotels_114483_certificate_security_drift''; END IF;
 -- Verify metadata evaluator source before trusting it.
 IF (SELECT encode(sha256(convert_to(prosrc,''UTF8'')),''hex'') FROM pg_proc WHERE oid=''hotels_read_once_private.metadata(oid)''::regprocedure)
 IS DISTINCT FROM ''65e9d9a19c19f1e8281861752f6f7be2dcba7720fda4810a435a750ad14531b0'' THEN RAISE EXCEPTION ''hotels_114483_metadata_drift''; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(c.predecessors) LOOP
  IF hotels_read_once_private.metadata(to_regprocedure(b->>''signature'')) IS DISTINCT FROM b->''meta''
  THEN RAISE EXCEPTION ''hotels_114483_predecessor_drift:%'',b->>''signature''; END IF;
 END LOOP;
 SELECT jsonb_object_agg(p.oid::regprocedure::text,hotels_read_once_private.metadata(p.oid) ORDER BY p.oid::regprocedure::text) INTO actual
 FROM pg_proc p WHERE p.pronamespace=''hotels_read_once_private''::regnamespace OR p.oid IN(''public.hotel_v2_admin_get_shadow_preparation_state_114483(uuid)''::regprocedure,''public.hotel_v2_admin_get_seven_arches_pricing_activation_114483()''::regprocedure,''public.hotel_v2_admin_get_legacy_pricing_promotion_preview_114483(uuid)''::regprocedure);
 IF actual IS DISTINCT FROM c.functions THEN RAISE EXCEPTION ''hotels_114483_source_security_drift''; END IF;
END $function$
','["86397981198c9014961b7a8c9b021afaf1bb5be3a51ed628343a9d9ac23c42c2","6014c057cf397e9c1434bf35defa06f3a56ae908f34667f5b70b66447667c64f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql"]'::jsonb,'
DECLARE c hotels_read_once_private.certificate%rowtype; b jsonb; actual jsonb;
BEGIN
 SELECT * INTO STRICT c FROM hotels_read_once_private.certificate WHERE id=1;
 IF (SELECT count(*) FROM hotels_read_once_private.certificate)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=''hotels_read_once_private.certificate''::regclass AND relowner=''postgres''::regrole AND relrowsecurity AND relforcerowsecurity)
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=''hotels_read_once_private.certificate''::regclass)
 OR EXISTS(SELECT 1 FROM pg_class r,LATERAL aclexplode(coalesce(r.relacl,acldefault(''r'',r.relowner))) a WHERE r.oid=''hotels_read_once_private.certificate''::regclass AND a.grantee<>r.relowner)
 OR EXISTS(SELECT 1 FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault(''n'',n.nspowner))) a WHERE n.nspname=''hotels_read_once_private'' AND (n.nspowner<>''postgres''::regrole OR a.grantee<>n.nspowner))
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid=''hotels_read_once_private.certificate''::regclass AND NOT tgisinternal)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=''hotels_read_once_private.certificate''::regclass AND tgname=''immutable'' AND tgenabled=''O'' AND tgtype=58 AND tgfoid=''hotels_read_once_private.immutable()''::regprocedure)
 THEN RAISE EXCEPTION ''hotels_114483_certificate_security_drift''; END IF;
 -- Verify metadata evaluator source before trusting it.
 IF (SELECT encode(sha256(convert_to(hotels_guest_policy_private.original_source(oid),''UTF8'')),''hex'') FROM pg_proc WHERE oid=''hotels_read_once_private.metadata(oid)''::regprocedure)
 IS DISTINCT FROM ''65e9d9a19c19f1e8281861752f6f7be2dcba7720fda4810a435a750ad14531b0'' THEN RAISE EXCEPTION ''hotels_114483_metadata_drift''; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(c.predecessors) LOOP
  IF hotels_read_once_private.metadata(to_regprocedure(b->>''signature'')) IS DISTINCT FROM b->''meta''
  THEN RAISE EXCEPTION ''hotels_114483_predecessor_drift:%'',b->>''signature''; END IF;
 END LOOP;
 SELECT jsonb_object_agg(p.oid::regprocedure::text,hotels_read_once_private.metadata(p.oid) ORDER BY p.oid::regprocedure::text) INTO actual
 FROM pg_proc p WHERE p.pronamespace=''hotels_read_once_private''::regnamespace OR p.oid IN(''public.hotel_v2_admin_get_shadow_preparation_state_114483(uuid)''::regprocedure,''public.hotel_v2_admin_get_seven_arches_pricing_activation_114483()''::regprocedure,''public.hotel_v2_admin_get_legacy_pricing_promotion_preview_114483(uuid)''::regprocedure);
 IF actual IS DISTINCT FROM c.functions THEN RAISE EXCEPTION ''hotels_114483_source_security_drift''; END IF;
END ','87b1422a163ad13bfa8008d4bb33992cb7150a9c5c4934126f08713cdacf73c8');
DO $install$ DECLARE b record; stmt text; BEGIN
 FOR b IN SELECT * FROM hotels_guest_policy_private.bindings LOOP
  IF hotels_guest_policy_private.raw_metadata(to_regprocedure(b.signature)) IS DISTINCT FROM b.before_metadata
  THEN RAISE EXCEPTION 'hotels_114484_predecessor_drift:%',b.signature; END IF;
 END LOOP;
 FOR b IN SELECT * FROM hotels_guest_policy_private.bindings LOOP
  stmt:=replace(b.before_definition,b.before_source,b.after_source);
  IF stmt=b.before_definition THEN RAISE EXCEPTION 'hotels_114484_patch_missing'; END IF;
  EXECUTE stmt;
 END LOOP;
END $install$;
DO $secure$ DECLARE p record; r text; BEGIN
 FOR p IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE pronamespace='hotels_guest_policy_private'::regnamespace LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p.sig);
 END LOOP;
 FOREACH r IN ARRAY ARRAY['bindings','receipt'] LOOP
  EXECUTE format('ALTER TABLE hotels_guest_policy_private.%I ENABLE ROW LEVEL SECURITY',r);
  EXECUTE format('ALTER TABLE hotels_guest_policy_private.%I FORCE ROW LEVEL SECURITY',r);
  EXECUTE format('REVOKE ALL ON hotels_guest_policy_private.%I FROM PUBLIC,anon,authenticated,service_role',r);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON hotels_guest_policy_private.%I FOR EACH STATEMENT EXECUTE FUNCTION hotels_guest_policy_private.immutable()',r);
 END LOOP;
END $secure$;
INSERT INTO hotels_guest_policy_private.receipt SELECT 1,ARRAY['children_policy','minimum_child_age']::text[],to_jsonb(f),encode(sha256(convert_to(to_jsonb(f)::text,'UTF8')),'hex'),to_jsonb(h),
 encode(sha256(convert_to((to_jsonb(h)-ARRAY['pricing_tiers','updated_at','children_policy','minimum_child_age'])::text,'UTF8')),'hex'),
 coalesce((SELECT array_agg(id) FROM public.hotel_activity_log WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND source='hotels_v2_admin_b_guest_policy' AND entity_type='property'),'{}'::uuid[]),
 hotels_stripe_dto_private.business_hash(),(SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,'UTF8')),'hex') FROM hotels_guest_policy_private.bindings b),
 (SELECT jsonb_object_agg(p.oid::regprocedure::text,hotels_guest_policy_private.raw_metadata(p.oid)) FROM pg_proc p WHERE p.pronamespace='hotels_guest_policy_private'::regnamespace),hotels_guest_policy_private.relation_catalog()
 FROM public.hotels h CROSS JOIN public.hotel_seven_arches_reviewed_pricing_foundation_receipts f WHERE h.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND f.id=1;
DO $post$ BEGIN
 PERFORM hotels_guest_policy_private.assert_exact();
 IF public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 OR hotels_stripe_dto_private.business_hash() IS DISTINCT FROM (SELECT business_before FROM hotels_guest_policy_private.receipt WHERE id=1)
 THEN RAISE EXCEPTION 'hotels_114484_install_postcondition'; END IF;
 PERFORM hotels_read_once_private.assert_exact();
END $post$;
COMMIT;
