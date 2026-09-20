-- HOTELS 114489: published exact-target rooms_v2 successor. LOCAL SOURCE WIP.
-- POSTGRES_RUNTIME_TESTS=PENDING_ENVIRONMENT. NOT APPROVED FOR INSTALLATION.
-- Unresolved compiler evidence: none.
-- Generated offline by tests/integration/hotels-v2-114489-build.mjs.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
DO $boundary$ BEGIN
 
 IF to_regnamespace('hotels_published_architecture_private') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448800')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448800')
 THEN RAISE EXCEPTION 'hotels_114489_boundary_mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.hotels'::regclass
 AND conname='hotels_h2a_rooms_v2_unpublished_check' AND contype='c' AND convalidated
 AND lower(regexp_replace(pg_get_expr(conbin,conrelid),'[[:space:]()]|::text','','g'))=
 'architecture_version=''legacy''orcoalesceis_published,false=false') THEN RAISE EXCEPTION 'hotels_114489_constraint_predecessor_missing'; END IF;
 IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)')) IS DISTINCT FROM 'e7b3f50952b25e596c662519fca4e02f9dff128ffd707533faf1664e3867752c'
 OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)')) IS DISTINCT FROM 'd1d166b0662601f466c517014f641c4555c563f9fb71e0c0dd2b2de43fbb869b'
 THEN RAISE EXCEPTION 'hotels_114489_historical_writer_drift'; END IF;
END $boundary$;
-- Local compiler input, NOT an executable deployment artifact.
-- Latest authorization: b5656f66 attachment phases B/D/F, LOCAL ONLY.
CREATE SCHEMA hotels_published_architecture_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA hotels_published_architecture_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE hotels_published_architecture_private.conversion_receipt (
 id uuid PRIMARY KEY, hotel_id uuid NOT NULL UNIQUE CHECK(hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),
 partner_id uuid NOT NULL CHECK(partner_id='0a321bfe-da6b-43f6-8e0b-7c68546a8b18'),
 assignment_id uuid NOT NULL CHECK(assignment_id='a082c085-a6ea-46fd-8548-c8d9c6ee2c34'),
 actor_id uuid NOT NULL, converted_at timestamptz NOT NULL,
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000 AND reason=btrim(reason)),
 expected_state_hash text NOT NULL CHECK(expected_state_hash ~ '^[0-9a-f]{64}$'),
 reviewed_plan_signature text NOT NULL CHECK(reviewed_plan_signature ~ '^[0-9a-f]{64}$'),
 before_hotel jsonb NOT NULL, after_hotel jsonb NOT NULL,
 unchanged_business_hash text NOT NULL CHECK(unchanged_business_hash ~ '^[0-9a-f]{64}$'),
 receipt_hash text NOT NULL CHECK(receipt_hash ~ '^[0-9a-f]{64}$'),
 CHECK(before_hotel->>'architecture_version'='legacy' AND after_hotel->>'architecture_version'='rooms_v2'),
 CHECK(before_hotel->'is_published'='true'::jsonb AND after_hotel->'is_published'='true'::jsonb),
 CHECK(before_hotel-ARRAY['architecture_version','updated_at']=after_hotel-ARRAY['architecture_version','updated_at'])
);
CREATE TABLE hotels_published_architecture_private.context (
 transaction_id bigint NOT NULL, backend_pid integer NOT NULL,
 request_id uuid NOT NULL UNIQUE, actor_id uuid NOT NULL, before_hotel jsonb NOT NULL,
 PRIMARY KEY(transaction_id,backend_pid)
);
ALTER TABLE hotels_published_architecture_private.conversion_receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels_published_architecture_private.conversion_receipt FORCE ROW LEVEL SECURITY;
ALTER TABLE hotels_published_architecture_private.context ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels_published_architecture_private.context FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA hotels_published_architecture_private FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.digest(p_value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER SET search_path=pg_catalog AS $f$
 SELECT encode(sha256(convert_to(p_value::text,'UTF8')),'hex')
$f$;
CREATE FUNCTION hotels_published_architecture_private.immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
BEGIN RAISE EXCEPTION USING errcode='55000',message='hotels_114489_receipt_immutable'; END
$f$;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE
ON hotels_published_architecture_private.conversion_receipt FOR EACH STATEMENT
EXECUTE FUNCTION hotels_published_architecture_private.immutable();
CREATE FUNCTION hotels_published_architecture_private.assert_receipt_exact() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE r hotels_published_architecture_private.conversion_receipt%rowtype; h jsonb;
BEGIN
 PERFORM hotels_published_architecture_private.assert_exact();
 SELECT to_jsonb(x) INTO STRICT h FROM public.hotels x WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
 SELECT * INTO r FROM hotels_published_architecture_private.conversion_receipt;
 IF NOT FOUND THEN
  IF h->>'architecture_version' IS DISTINCT FROM 'legacy' OR h->'is_published' IS DISTINCT FROM 'true'::jsonb
  THEN RAISE EXCEPTION 'hotels_114489_conversion_evidence_missing'; END IF;
  RETURN;
 END IF;
 IF (SELECT count(*) FROM hotels_published_architecture_private.conversion_receipt)<>1
 OR r.receipt_hash IS DISTINCT FROM hotels_published_architecture_private.digest(to_jsonb(r)-'receipt_hash')
 OR h->>'id' IS DISTINCT FROM r.hotel_id::text
 OR h->>'architecture_version' IS DISTINCT FROM 'rooms_v2' OR h->'is_published' IS DISTINCT FROM 'true'::jsonb
 OR r.before_hotel->>'architecture_version' IS DISTINCT FROM 'legacy'
 OR r.after_hotel->>'architecture_version' IS DISTINCT FROM 'rooms_v2'
 OR r.before_hotel->'is_published' IS DISTINCT FROM 'true'::jsonb
 OR r.after_hotel->'is_published' IS DISTINCT FROM 'true'::jsonb
 OR r.before_hotel-ARRAY['architecture_version','updated_at'] IS DISTINCT FROM r.after_hotel-ARRAY['architecture_version','updated_at']
 -- Content evolution is independently checked by the immutable Property
 -- history projector; never hide arbitrary current-row drift here.
 THEN RAISE EXCEPTION 'hotels_114489_conversion_receipt_drift'; END IF;
END $f$;
CREATE FUNCTION hotels_published_architecture_private.architecture_evidence() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE h public.hotels%rowtype;
BEGIN
 PERFORM hotels_published_architecture_private.assert_receipt_exact();
 SELECT * INTO STRICT h FROM public.hotels WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
 RETURN jsonb_build_object('contract_version','hotels_v2_published_architecture_v1','hotel_id',h.id,
 'architecture_version',h.architecture_version,'is_published',h.is_published,
 'public_booking_enabled',hotels_lifecycle_private.public_booking_enabled(),
 'conversion_receipt_present',EXISTS(SELECT 1 FROM hotels_published_architecture_private.conversion_receipt));
END $f$;
CREATE FUNCTION public.hotel_v2_public_get_seven_arches_display_114489() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE h public.hotels%rowtype; rooms jsonb; nightly numeric;
BEGIN
 PERFORM hotels_published_architecture_private.assert_receipt_exact();
 SELECT * INTO STRICT h FROM public.hotels WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
 IF h.is_published IS NOT TRUE OR hotels_lifecycle_private.public_booking_enabled() IS NOT FALSE
 OR (hotels_lifecycle_private.safe_state()->'feature_flags'->>'hotel_instant_booking_enabled')::boolean IS NOT FALSE
 OR hotels_published_architecture_private.foundation_b30af1618dfd07d0() IS NOT TRUE
 THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114489_public_display_unavailable'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',r.id,'name_i18n',r.name_i18n,
  'description_i18n',r.description_i18n,'max_occupancy',r.max_occupancy,
  'inventory_count',r.base_inventory_count,
  'beds',coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'type',b.v->>'type',
        'count',b.v->'quantity'
      )
      ORDER BY b.n
    )
    FROM jsonb_array_elements(
      coalesce(r.bed_configuration,'[]'::jsonb)
    ) WITH ORDINALITY b(v,n)
  ),'[]'::jsonb),
  'bathrooms',r.bathrooms,'photos',coalesce((SELECT jsonb_agg(v ORDER BY n)
    FROM jsonb_array_elements(r.gallery) WITH ORDINALITY g(v,n)
    WHERE jsonb_typeof(v)='string' AND (v#>>'{}') ~ '^(https://|/[^/])'
      AND (v#>>'{}') !~ '[[:cntrl:]]'),'[]'::jsonb)) ORDER BY r.sort_order,r.id)
 INTO rooms FROM public.hotel_room_types r WHERE r.hotel_id=h.id AND r.status='active';
 SELECT min(t.nightly_rate) INTO nightly
 FROM public.hotel_room_rates r JOIN public.hotel_pricing_schedules s ON s.id=r.pricing_schedule_id
 JOIN public.hotel_pricing_schedule_occupancy_tiers t ON t.schedule_id=s.id
 WHERE r.hotel_id=h.id AND r.is_active AND s.is_active AND t.is_active AND s.currency='EUR';
 IF jsonb_array_length(rooms) IS DISTINCT FROM 2 OR nightly IS NULL OR nightly<=0 THEN
  RAISE EXCEPTION USING errcode='55000',message='hotels_114489_public_room_display_invalid'; END IF;
 -- Explicit allowlist: no Partner identity, permissions, source secrets, Stripe
 -- account identifiers, tokens, quotes or booking actions enter the public DTO.
 RETURN jsonb_build_object('contract_version','hotels_v2_seven_arches_public_display_v1',
 'hotel_id',h.id,'architecture_version',h.architecture_version,'is_published',true,
 'public_booking_enabled',false,'instant_booking_enabled',false,'room_types',rooms,
 'currency','EUR','min_nightly_rate',nightly,'display_only',true);
END $f$;
REVOKE ALL ON FUNCTION public.hotel_v2_public_get_seven_arches_display_114489() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_public_get_seven_arches_display_114489() TO anon,authenticated;

-- Writer and entrypoints are appended by the offline builder. Missing
-- certified foundation input aborts the generated installation before DDL.

create function hotels_published_architecture_private.access_snapshot(
  p_partner_id uuid,p_hotel_id uuid,p_capability text
) returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,auth
AS '
declare v_assignment uuid; v_membership jsonb; v_permission jsonb;
begin
 IF p_partner_id IS DISTINCT FROM ''0a321bfe-da6b-43f6-8e0b-7c68546a8b18''::uuid OR p_hotel_id IS DISTINCT FROM ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid THEN RAISE EXCEPTION USING errcode=''42501'',message=''hotels_114489_target_required''; END IF;
 PERFORM hotels_published_architecture_private.assert_receipt_exact();
 PERFORM hotels_published_architecture_private.require_lifecycle();
  if not public.hotel_v2_h3_2b_flags_off() then
    raise exception using errcode=''55000'',message=''hotels_v2_h3_2b_public_activation_guard'';
  end if;
  if not exists(select 1 from public.hotels hotel
      where hotel.id=p_hotel_id and hotel.architecture_version IN(''legacy'',''rooms_v2'')) then
    raise exception using errcode=''55000'',message=''hotels_v2_h3_2b_legacy_architecture_guard'';
  end if;
  v_assignment:=public.hotel_v2_h3_2a_require_partner_hotel_access(
    p_partner_id,p_hotel_id,p_capability,false);
  v_membership:=public.hotel_v2_h3_2a_require_partner_membership(p_partner_id);
  v_permission:=public.hotel_v2_h3_2a_permissions_snapshot(v_assignment);
  return jsonb_build_object(''assignment_id'',v_assignment,''role'',v_membership->>''role'',
    ''permission_version'',(v_permission->>''version'')::bigint,
    ''has_mutation_capability'',(v_permission->>''has_mutation_capability'')::boolean,
    ''capabilities'',v_permission->''capabilities'');
end
';
-- Source input for 114489. NOT a deployment command.
-- The migration builder supplies hash-bound predecessor compilation and seal.
CREATE TABLE hotels_published_architecture_private.plan_key (
 id integer PRIMARY KEY CHECK(id=1), secret bytea NOT NULL CHECK(octet_length(secret)=32)
);
INSERT INTO hotels_published_architecture_private.plan_key VALUES(1,
 sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')));
CREATE TABLE hotels_published_architecture_private.property_history (
 id uuid PRIMARY KEY, hotel_id uuid NOT NULL CHECK(hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),
 actor_id uuid NOT NULL, created_at timestamptz NOT NULL,
 before_hotel jsonb NOT NULL, after_hotel jsonb NOT NULL,
 CHECK(before_hotel->>'id'=hotel_id::text AND after_hotel->>'id'=hotel_id::text)
);
ALTER TABLE hotels_published_architecture_private.context ADD COLUMN operation text NOT NULL DEFAULT 'conversion'
 CHECK(operation IN('conversion','property'));
ALTER TABLE hotels_published_architecture_private.context ADD COLUMN payload jsonb;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON hotels_published_architecture_private.plan_key
 FOR EACH STATEMENT EXECUTE FUNCTION hotels_published_architecture_private.immutable();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON hotels_published_architecture_private.property_history
 FOR EACH STATEMENT EXECUTE FUNCTION hotels_published_architecture_private.immutable();

-- RFC 2104 HMAC-SHA256. The private random key never leaves this schema.
-- JSON numbers use the already accepted semantic canonicalization contract.
CREATE FUNCTION hotels_published_architecture_private.sign_plan(p_plan jsonb) RETURNS text
LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE k bytea; inner_pad bytea:=decode(repeat('36',64),'hex'); outer_pad bytea:=decode(repeat('5c',64),'hex'); i integer;
BEGIN
 SELECT secret INTO STRICT k FROM hotels_published_architecture_private.plan_key WHERE id=1;
 FOR i IN 0..31 LOOP
  inner_pad:=set_byte(inner_pad,i,get_byte(inner_pad,i)#get_byte(k,i));
  outer_pad:=set_byte(outer_pad,i,get_byte(outer_pad,i)#get_byte(k,i));
 END LOOP;
 RETURN encode(sha256(outer_pad||sha256(inner_pad||convert_to(
  hotels_published_architecture_private.digest(public.hotel_v2_seven_arches_pricing_activation_canonical_json(p_plan-'signature')),'UTF8'))),'hex');
END $f$;

CREATE FUNCTION hotels_published_architecture_private.require_lifecycle() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE s jsonb; account_status text;
BEGIN
 s:=hotels_lifecycle_private.safe_state();
 IF s->'feature_flags' IS DISTINCT FROM '{"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":true}'::jsonb
 OR s->'public_booking_enabled' IS DISTINCT FROM 'false'::jsonb
 OR s->>'architecture' IS DISTINCT FROM 'legacy' OR s->'audit_chain_exact' IS DISTINCT FROM 'true'::jsonb
 OR hotels_lifecycle_private.public_booking_enabled() IS NOT FALSE
 THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114489_lifecycle_drift'; END IF;
 -- Do not invoke the Partner-membership RPC from an Admin readiness read.
 -- This private projection checks account state, never initiates OAuth.
 SELECT status INTO account_status FROM hotel_stripe_connect_private.accounts WHERE partner_id='0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
 IF coalesce(account_status,'NOT_CONNECTED') IS DISTINCT FROM 'NOT_CONNECTED' THEN
  RAISE EXCEPTION USING errcode='55000',message='hotels_114489_account_drift'; END IF;
 RETURN s;
END $f$;

CREATE FUNCTION hotels_published_architecture_private.receipt_insert_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
DECLARE c hotels_published_architecture_private.context%rowtype; h jsonb;
BEGIN
 SELECT * INTO STRICT c FROM hotels_published_architecture_private.context WHERE transaction_id=txid_current() AND backend_pid=pg_backend_pid();
 SELECT to_jsonb(t) INTO STRICT h FROM public.hotels t WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
 IF c.actor_id IS DISTINCT FROM auth.uid() OR NEW.actor_id IS DISTINCT FROM c.actor_id
 OR NEW.id IS DISTINCT FROM c.request_id OR NEW.before_hotel IS DISTINCT FROM c.before_hotel
 OR NEW.after_hotel IS DISTINCT FROM h
 OR (tg_table_name='conversion_receipt' AND c.operation<>'conversion')
 OR (tg_table_name='property_history' AND c.operation<>'property') THEN
  RAISE EXCEPTION USING errcode='42501',message='hotels_114489_receipt_insert_outside_writer'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER writer_insert BEFORE INSERT ON hotels_published_architecture_private.conversion_receipt
 FOR EACH ROW EXECUTE FUNCTION hotels_published_architecture_private.receipt_insert_guard();
CREATE TRIGGER writer_insert BEFORE INSERT ON hotels_published_architecture_private.property_history
 FOR EACH ROW EXECUTE FUNCTION hotels_published_architecture_private.receipt_insert_guard();

-- Installation/Apply protection: scan the SAME business relation universe as
-- the predecessor. Only the target architecture and updated_at are normalized.
-- No relation or pricing, payment, assignment, content or flag field is omitted.
CREATE FUNCTION hotels_published_architecture_private.business_snapshot() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE r record; rows_hash text; result jsonb:='{}'; expression text;
BEGIN
 FOR r IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN('r','p') AND n.nspname IN('public','hotels_lineage_private','hotels_lifecycle_private','hotel_stripe_connect_private','hotels_v2_private')
 ORDER BY n.nspname,c.relname LOOP
  expression:='to_jsonb(t)';
  IF r.nspname='public' AND r.relname='hotels' THEN
   expression:='CASE WHEN t.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid THEN (to_jsonb(t)-''updated_at'')||''{"architecture_version":"legacy"}''::jsonb ELSE to_jsonb(t) END';
  END IF;
  EXECUTE format('SELECT encode(sha256(convert_to(coalesce(jsonb_agg(v ORDER BY v::text),''[]''::jsonb)::text,''UTF8'')),''hex'') FROM (SELECT %s v FROM %I.%I t) q',expression,r.nspname,r.relname) INTO rows_hash;
  result:=result||jsonb_build_object(r.nspname||'.'||r.relname,rows_hash);
 END LOOP;
 RETURN result;
END $f$;

CREATE FUNCTION hotels_published_architecture_private.state_snapshot() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE h jsonb; lifecycle jsonb; pricing jsonb;
BEGIN
 PERFORM hotels_published_architecture_private.assert_exact();
 PERFORM hotels_published_architecture_private.assert_receipt_exact();
 lifecycle:=hotels_published_architecture_private.require_lifecycle();
 SELECT to_jsonb(t) INTO STRICT h FROM public.hotels t WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
 IF h->>'owner_partner_id' IS DISTINCT FROM '0a321bfe-da6b-43f6-8e0b-7c68546a8b18'
 OR h->'is_published' IS DISTINCT FROM 'true'::jsonb
 OR h->>'booking_mode' IS DISTINCT FROM 'request_confirmation'
 OR NOT EXISTS(SELECT 1 FROM public.partner_resources WHERE id='a082c085-a6ea-46fd-8548-c8d9c6ee2c34'
  AND partner_id='0a321bfe-da6b-43f6-8e0b-7c68546a8b18' AND resource_type='hotels' AND resource_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 OR hotels_published_architecture_private.foundation_b30af1618dfd07d0() IS NOT TRUE
 OR hotels_published_architecture_private.foundation_f46b02a57427361e() IS NOT TRUE
 OR hotels_published_architecture_private.foundation_7546feecb3da2c1b() IS NOT TRUE
 THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114489_current_state_unsafe'; END IF;
 pricing:=hotels_published_architecture_private.foundation_06b6ba66f8598192();
 RETURN jsonb_build_object('hotel',h,'lifecycle',lifecycle,'pricing',pricing,
  'business',hotels_published_architecture_private.business_snapshot());
END $f$;

CREATE FUNCTION public.hotel_v2_admin_get_published_architecture_conversion_114489(p_hotel_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
DECLARE snapshot jsonb; plan jsonb; architecture text; status text; actor uuid:=auth.uid();
BEGIN
 PERFORM public.hotel_v2_h2a_require_admin();
 IF actor IS NULL OR p_hotel_id IS DISTINCT FROM '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid THEN
  RAISE EXCEPTION USING errcode='42501',message='hotels_114489_target_required'; END IF;
 BEGIN
  snapshot:=hotels_published_architecture_private.state_snapshot();
 EXCEPTION WHEN SQLSTATE '55000' THEN
  RETURN jsonb_build_object('contract_version','hotels_v2_published_conversion_readiness_v1','hotel_id',p_hotel_id,
   'status','BLOCKED','conversion_allowed',false,'blocking_reasons',jsonb_build_array('protected_state_not_exact'),'plan',NULL);
 END;
 architecture:=snapshot#>>'{hotel,architecture_version}';
 IF architecture='rooms_v2' THEN status:='ALREADY_CONVERTED';
 ELSIF architecture='legacy' THEN status:='READY';
 ELSE RAISE EXCEPTION 'hotels_114489_architecture_invalid'; END IF;
 IF status='READY' THEN
  plan:=jsonb_build_object('contract_version','hotels_v2_published_conversion_plan_v1','hotel_id',p_hotel_id,
   'actor_id',actor,'issued_at',statement_timestamp(),'expires_at',statement_timestamp()+interval '15 minutes',
   'snapshot_hash',hotels_published_architecture_private.digest(snapshot),'from','legacy','to','rooms_v2',
   'is_published',true,'public_booking_enabled',false);
  plan:=plan||jsonb_build_object('signature',hotels_published_architecture_private.sign_plan(plan));
 END IF;
 RETURN jsonb_build_object('contract_version','hotels_v2_published_conversion_readiness_v1','hotel_id',p_hotel_id,
 'status',status,'conversion_allowed',status='READY','blocking_reasons','[]'::jsonb,'plan',plan);
END $f$;

CREATE FUNCTION public.hotel_v2_admin_convert_legacy_hotel_to_v2_114489(p_plan jsonb,p_request_id uuid,p_confirmation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
DECLARE actor uuid:=auth.uid(); snapshot jsonb; before_hotel jsonb; after_hotel jsonb; business jsonb;
 r hotels_published_architecture_private.conversion_receipt%rowtype; result jsonb; relation record;
BEGIN
 PERFORM public.hotel_v2_h2a_require_admin();
 PERFORM hotels_published_architecture_private.assert_exact();
 IF actor IS NULL OR p_request_id IS NULL OR p_confirmation IS DISTINCT FROM 'CONVERT 7 KAMARES TO ROOMS_V2'
 OR jsonb_typeof(p_plan) IS DISTINCT FROM 'object'
 OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_plan) k) IS DISTINCT FROM
 ARRAY['actor_id','contract_version','expires_at','from','hotel_id','is_published','issued_at','public_booking_enabled','signature','snapshot_hash','to']::text[]
 OR p_plan->>'contract_version' IS DISTINCT FROM 'hotels_v2_published_conversion_plan_v1'
 OR p_plan->>'hotel_id' IS DISTINCT FROM '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
 OR p_plan->>'actor_id' IS DISTINCT FROM actor::text
 OR p_plan->>'from' IS DISTINCT FROM 'legacy' OR p_plan->>'to' IS DISTINCT FROM 'rooms_v2'
 OR p_plan->'is_published' IS DISTINCT FROM 'true'::jsonb OR p_plan->'public_booking_enabled' IS DISTINCT FROM 'false'::jsonb
 OR p_plan->>'signature' IS NULL
 OR p_plan->>'signature' !~ '^[0-9a-f]{64}$'
 OR hotels_published_architecture_private.sign_plan(p_plan) IS NULL
 OR p_plan->>'signature' IS DISTINCT FROM hotels_published_architecture_private.sign_plan(p_plan)
 THEN RAISE EXCEPTION USING errcode='22023',message='hotels_114489_invalid_plan'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('hotels-114489:9b6d99a0-923a-4fbc-be54-c066e856e6ca',0));
 -- Prevent protected-state writers throughout the before/after comparison.
 FOR relation IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN('r','p') AND n.nspname IN('public','hotels_lineage_private','hotels_lifecycle_private','hotel_stripe_connect_private','hotels_v2_private')
 ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',relation.nspname,relation.relname);
 END LOOP;
 SELECT * INTO r FROM hotels_published_architecture_private.conversion_receipt;
 IF FOUND THEN
  PERFORM hotels_published_architecture_private.assert_receipt_exact();
  IF r.id=p_request_id AND r.actor_id=actor AND r.expected_state_hash=p_plan->>'snapshot_hash'
   AND r.reviewed_plan_signature=p_plan->>'signature' THEN
   RETURN jsonb_build_object('contract_version','hotels_v2_published_conversion_result_v1','hotel_id',r.hotel_id,
    'request_id',r.id,'architecture_version','rooms_v2','is_published',true,'public_booking_enabled',false,'replayed',true);
  END IF;
  RAISE EXCEPTION USING errcode='PT409',message='hotels_114489_already_converted';
 END IF;
 IF (p_plan->>'expires_at')::timestamptz<=clock_timestamp()
 OR (p_plan->>'issued_at')::timestamptz>clock_timestamp()+interval '5 seconds' THEN
  RAISE EXCEPTION USING errcode='PT409',message='hotels_114489_plan_expired'; END IF;
 snapshot:=hotels_published_architecture_private.state_snapshot();
 IF hotels_published_architecture_private.digest(snapshot) IS DISTINCT FROM p_plan->>'snapshot_hash' THEN
  RAISE EXCEPTION USING errcode='PT409',message='hotels_114489_stale_snapshot'; END IF;
 before_hotel:=snapshot->'hotel'; business:=snapshot->'business';
 INSERT INTO hotels_published_architecture_private.context(transaction_id,backend_pid,request_id,actor_id,before_hotel)
 VALUES(txid_current(),pg_backend_pid(),p_request_id,actor,before_hotel);
 UPDATE public.hotels SET architecture_version='rooms_v2',updated_at=clock_timestamp()
 WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND architecture_version='legacy' AND is_published=true
 RETURNING to_jsonb(hotels.*) INTO STRICT after_hotel;
 IF before_hotel-ARRAY['architecture_version','updated_at'] IS DISTINCT FROM after_hotel-ARRAY['architecture_version','updated_at']
 OR business IS DISTINCT FROM hotels_published_architecture_private.business_snapshot() THEN
  RAISE EXCEPTION USING errcode='55000',message='hotels_114489_protected_business_changed'; END IF;
 r.id:=p_request_id;r.hotel_id:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';r.partner_id:='0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
 r.assignment_id:='a082c085-a6ea-46fd-8548-c8d9c6ee2c34';r.actor_id:=actor;r.converted_at:=clock_timestamp();
 r.reason:=p_confirmation;r.expected_state_hash:=p_plan->>'snapshot_hash';r.before_hotel:=before_hotel;r.after_hotel:=after_hotel;
 r.reviewed_plan_signature:=p_plan->>'signature';
 r.unchanged_business_hash:=hotels_published_architecture_private.digest(business);
 r.receipt_hash:=hotels_published_architecture_private.digest(to_jsonb(r)-'receipt_hash');
 INSERT INTO hotels_published_architecture_private.conversion_receipt SELECT r.*;
 DELETE FROM hotels_published_architecture_private.context WHERE transaction_id=txid_current() AND backend_pid=pg_backend_pid() AND request_id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'hotels_114489_context_missing'; END IF;
 PERFORM hotels_published_architecture_private.state_snapshot();
 result:=jsonb_build_object('contract_version','hotels_v2_published_conversion_result_v1','hotel_id',r.hotel_id,
 'request_id',r.id,'architecture_version','rooms_v2','is_published',true,'public_booking_enabled',false,'replayed',false);
 RETURN result;
END $f$;

CREATE FUNCTION hotels_published_architecture_private.transition_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
DECLARE c hotels_published_architecture_private.context%rowtype;
BEGIN
 IF OLD.id<>'9b6d99a0-923a-4fbc-be54-c066e856e6ca' OR
 (OLD.architecture_version IS NOT DISTINCT FROM NEW.architecture_version AND OLD.is_published IS NOT DISTINCT FROM NEW.is_published) THEN RETURN NEW; END IF;
 SELECT * INTO STRICT c FROM hotels_published_architecture_private.context WHERE transaction_id=txid_current() AND backend_pid=pg_backend_pid();
 IF c.operation<>'conversion' OR c.actor_id IS DISTINCT FROM auth.uid() OR c.before_hotel IS DISTINCT FROM to_jsonb(OLD)
 OR OLD.architecture_version<>'legacy' OR NEW.architecture_version<>'rooms_v2'
 OR OLD.is_published IS NOT TRUE OR NEW.is_published IS NOT TRUE
 OR to_jsonb(OLD)-ARRAY['architecture_version','updated_at'] IS DISTINCT FROM to_jsonb(NEW)-ARRAY['architecture_version','updated_at']
 THEN RAISE EXCEPTION USING errcode='42501',message='hotels_114489_unauthorized_transition'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER hotels_114489_transition BEFORE UPDATE ON public.hotels FOR EACH ROW
 EXECUTE FUNCTION hotels_published_architecture_private.transition_guard();

CREATE FUNCTION hotels_published_architecture_private.historical_hotel(p_hotel jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS 'DECLARE
 r hotels_published_architecture_private.conversion_receipt%rowtype;
 g hotels_guest_policy_private.receipt%rowtype;
 c hotels_published_architecture_private.context%rowtype;
 e record; expected jsonb; actual jsonb:=p_hotel; anchor jsonb;
 content_keys text[]:=ARRAY[''title'',''title_i18n'',''description'',''description_i18n'',''city'',''address_line'',''district'',
 ''postal_code'',''country'',''latitude'',''longitude'',''google_maps_url'',''amenities'',''check_in_from'',''check_out_until'',
 ''timezone'',''cover_image_url'',''photos'',''updated_at''];
BEGIN
 IF p_hotel->>''id'' IS DISTINCT FROM ''9b6d99a0-923a-4fbc-be54-c066e856e6ca'' THEN RAISE EXCEPTION ''hotels_114489_projection_foreign_hotel''; END IF;
 PERFORM hotels_published_architecture_private.assert_exact();
 SELECT * INTO c FROM hotels_published_architecture_private.context WHERE transaction_id=txid_current() AND backend_pid=pg_backend_pid();
 IF FOUND THEN
  IF c.actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION ''hotels_114489_context_actor_drift''; END IF;
  IF c.operation=''conversion'' THEN
   IF p_hotel-ARRAY[''architecture_version'',''updated_at''] IS DISTINCT FROM c.before_hotel-ARRAY[''architecture_version'',''updated_at'']
   OR p_hotel->''is_published'' IS DISTINCT FROM ''true''::jsonb
   OR p_hotel->>''architecture_version'' NOT IN(''legacy'',''rooms_v2'') THEN RAISE EXCEPTION ''hotels_114489_context_drift''; END IF;
  ELSIF c.operation=''property'' THEN
   IF p_hotel-content_keys IS DISTINCT FROM c.before_hotel-content_keys THEN RAISE EXCEPTION ''hotels_114489_property_protected_drift''; END IF;
  ELSE RAISE EXCEPTION ''hotels_114489_context_operation_invalid''; END IF;
  actual:=c.before_hotel;
 END IF;
 SELECT * INTO r FROM hotels_published_architecture_private.conversion_receipt;
 IF FOUND THEN PERFORM hotels_published_architecture_private.assert_receipt_exact(); END IF;
 PERFORM hotels_guest_policy_private.assert_exact();
 SELECT * INTO STRICT g FROM hotels_guest_policy_private.receipt WHERE id=1;
 anchor:=g.hotel_anchor; expected:=anchor;
 FOR e IN
  SELECT p.created_at,p.id,p.actor_id,p.before_hotel before_state,p.after_hotel after_state,''property'' kind
   FROM hotels_published_architecture_private.property_history p
  UNION ALL
  SELECT a.created_at,a.id,a.actor_id,a.before_state,a.after_state,''guest''
   FROM public.hotel_activity_log a WHERE a.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''
    AND a.source=''hotels_v2_admin_b_guest_policy'' AND NOT(a.id=ANY(g.activity_ids))
  UNION ALL
  SELECT r.converted_at,r.id,r.actor_id,r.before_hotel,r.after_hotel,''conversion'' WHERE r.id IS NOT NULL
  ORDER BY created_at,id
 LOOP
  IF e.actor_id IS NULL OR e.before_state-ARRAY[''updated_at'',''pricing_tiers''] IS DISTINCT FROM expected-ARRAY[''updated_at'',''pricing_tiers''] THEN
   RAISE EXCEPTION ''hotels_114489_property_history_chain_invalid''; END IF;
  IF e.kind=''property'' THEN
   IF e.before_state-content_keys IS DISTINCT FROM e.after_state-content_keys
   OR (SELECT count(*) FROM public.hotel_activity_log a WHERE a.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca'' AND a.correlation_id=e.id
    AND a.actor_id=e.actor_id AND a.actor_type=''admin'' AND a.source=''hotels_v2_admin_b_property_control''
    AND a.before_state->''property''=e.before_state AND a.after_state->''property''=e.after_state)<>1 THEN
    RAISE EXCEPTION ''hotels_114489_property_audit_invalid''; END IF;
  ELSIF e.kind=''conversion'' THEN
   IF e.before_state-ARRAY[''architecture_version'',''updated_at''] IS DISTINCT FROM e.after_state-ARRAY[''architecture_version'',''updated_at'']
    OR e.before_state->>''architecture_version'' IS DISTINCT FROM ''legacy'' OR e.after_state->>''architecture_version'' IS DISTINCT FROM ''rooms_v2''
    OR e.after_state->''is_published'' IS DISTINCT FROM ''true''::jsonb THEN RAISE EXCEPTION ''hotels_114489_projection_receipt_drift''; END IF;
  ELSE
   IF e.before_state-ARRAY[''updated_at'',''children_policy'',''minimum_child_age''] IS DISTINCT FROM e.after_state-ARRAY[''updated_at'',''children_policy'',''minimum_child_age'']
   OR public.hotel_v2_h2b1_children_policy_valid(e.after_state->>''children_policy'',(e.after_state->>''minimum_child_age'')::integer,false) IS NOT TRUE THEN
    RAISE EXCEPTION ''hotels_114489_guest_policy_audit_invalid''; END IF;
  END IF;
  expected:=e.after_state;
 END LOOP;
 IF actual-ARRAY[''updated_at'',''pricing_tiers''] IS DISTINCT FROM expected-ARRAY[''updated_at'',''pricing_tiers''] THEN
  RAISE EXCEPTION ''hotels_114489_unreviewed_property_change''; END IF;
 -- Only historical hash consumers receive the certified historical content.
 -- Current pricing_tiers remain current; public DTOs read physical rows.
 RETURN anchor||jsonb_build_object(''pricing_tiers'',p_hotel->''pricing_tiers'');
END;';
DO $foundation_before$ DECLARE b jsonb; BEGIN
 FOR b IN SELECT value FROM jsonb_array_elements('[{"signature":"hotels_guest_policy_private.assert_exact()","meta":["3c9c0adfe16be6f81ef9a6a350df812d6d076d99667a36520197818ab52e477a","64ca60810999cc4110da7b2e78c07b6eb8831820a4ad8376b9b0eeddc9275d6f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"hotels_guest_policy_private.historical_hotel(jsonb)","meta":["d781586ad40137fe5f90354fc468d221fbd0288ce571fb99af4d410a21c6241b","776c93d4614c71ccebcce2754ceade6f817dd39491401319af8068dd2fe04615","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_hotel jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_guest_policy_private.original_definition(oid)","meta":["99b16ba76d2cfa3c86370e0fd4c9dc0575cb447c68d108e5bd332dac395f84f6","d371c72e9a45b096fc11d288a810cf92d6270f25eca9be2f3b84b779690d8abf","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_guest_policy_private.original_source(oid)","meta":["e9989350cadedab22bb961f825314885210bee91f55a0178762c656761a09545","a055ccb717628c7cf5b925ad8043f773f55d3ba106b5f78e516970074613edda","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_guest_policy_private.raw_metadata(oid)","meta":["65e9d9a19c19f1e8281861752f6f7be2dcba7720fda4810a435a750ad14531b0","16ff13fdd37b8f77bb273cca6ed8989e64dbe1d13eb7054ae4770b4ad8a7ef1b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_guest_policy_private.relation_catalog()","meta":["b1c6e84dfe0ccfd4fea4ab41537060c155e303dcce77aa967bfa09469cc3413c","e6cbab5a7c12d50b269d6e5a74711b43f95f17f82ee7c9ed7900f04f059cffa6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.actual_flags()","meta":["ecd751821530611bfe8b925fa5bb73c408def4823acc1d794b70d6e5bb89fb59","962a73c55a3c98bfd3a9f3d482b65d58e99d994402e402974d374d8d1c3b76fa","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.catalog_snapshot()","meta":["a9daaad29c3561c8191707fcef258d3fb734705058c4b15ec857ef2e554f5aa7","c19d455d09b6f70cd4f3a5a8fcb53e0d023b15f1909e622b1ba505e5955e1c9a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.chain_state()","meta":["a9bafdb21a9cce7007e14a25686a1c17606eaf2586b9778368aa9be25eba4c24","ebf51ccb03f5cc99557c75c652c4ac5df3615a7172dd547cc3fdcf8cb0cb0cd1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.hash(jsonb)","meta":["0efcedbc625bdd5c0e6dc3f27a59e846460fe328880fd562d3f0de352c913b5a","20cfb347b6a0a3a2e5f336c49502db4b971a09ac8d42b9d2761bbcd9f689419b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",false,false,true,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"hotels_lifecycle_private.metadata(oid)","meta":["2b49509d355fc1078aafed91f4f9307c3d55413169d7e514cab68f9e1faf760d","a142b14c75138d354bcebefc01ef04cbf5f7567fd1278c8017e08a813cdaf285","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.partner_connection(uuid, uuid)","meta":["f46e6a3fb6e534739c91a61abeec102c32b67500b7d597d954ea01e57a3dedbc","69d6f8ce807885f9ae0017bebddc9781f218c5f2df29d37181c5f5b8c5d50ce2","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid","uuid, uuid","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.predecessor_definition(oid)","meta":["f9ce2c676af6004f902b82e4ee7e8d7e3e7436f12a558bea694263adfe3a3b8d","e0e8e3c59a2129cdcc7e5abdc143a1712c744682df69b6465c31c08cea42dcac","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lifecycle_private.predecessor_flag_exact(text, boolean)","meta":["9b1a2be02f556e7797922aceeb61211355dd576501598206b93bf0796612f11e","3f04b84001f1726d6f522ef71ac8ebbf358a6ace0e659ff93d4927bd57c7775b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_flag text, p_actual boolean","text, boolean","boolean","u","f"]},{"signature":"hotels_lifecycle_private.predecessor_source(oid)","meta":["983d1c22792ce60fcd73e71d1e5f3bfe6869f3b2ba734e92a4364f924741819f","187726e4823dd2e6c1d648767dd2a0e1b6c87125045593823668cd81e0f211f2","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lifecycle_private.safe_state()","meta":["780d8fd7853a49d3cab639d8590a786fe88302b6f254c44b9d68b85932a0da7e","acfaa64ff3f8d11115c011b19e7742f53bc2b72d866a46c63011f2d7137ec507","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"hotels_lineage_private.catalog_fingerprint()","meta":["9798b885198ee02fc8b7154ce67d2caba98b885268ae29a8f486894032657084","a3206a944748159fc64b179eedd39b24db441a515dda4e7e6af1025f21ab8812","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","text","u","f"]},{"signature":"hotels_lineage_private.catalog_is_exact(jsonb, jsonb)","meta":["4767d2844cfd78f1ca6661c8bc2d756e3a1158985445b00c6b17524aa350419f","3394ba926e32ba5b2758c0639fd4860bebe039ef22fe4f208357f5f10068a078","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","current_jsonb jsonb, historical_jsonb jsonb","jsonb, jsonb","boolean","u","f"]},{"signature":"hotels_lineage_private.current_anchor_is_exact()","meta":["9640721b8192e8e60d983dd2115ee31a856d3afda150e7a68361d1a37e10a031","09b53f2cef94a22de26e236cac7c9a5b57de063e5d9a4f2b953421da77d43405","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"hotels_lineage_private.function_map()","meta":["fb0fac6e627924bbefe4d302ab885499cc1897bac1548012b4bbb1dcafed5a54","704a264f24fcd7a74f6f97b33976a1672f57ad8b158ae2750b1ac69d68c2629e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lineage_private.lineage_matches_historical(jsonb)","meta":["71a29e0880a00f5697a45b787009d8f8673f59a1267d40021bb4b8c38fbcc8dc","f99035c6fb8e06b70f88d323dba27263f86d813d6b4580bf164b339aa33b40dd","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","live jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_lineage_private.owner_constraint_tokens(text)","meta":["71b5fc65cefe575c1069bdd8e1a7d7c1a953c3e7614db0f38f0dc4270d315f66","fc8785e641b50ad5061070300cff8bc28ae87d826b25723dfe22a222f8e84a9f","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,true,false,"plpgsql","input text","text","text","u","f"]},{"signature":"hotels_lineage_private.permission_evidence()","meta":["6b59caafd6caa96a5df5c107910e3ce3dd5eb8776201e4e8e72aa3cb9bf365bc","6d3750550dec8402290508d3ab7554422e5f0050ded7935e248528bcc3301974","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"hotels_lineage_private.predecessor_definition_hash(oid)","meta":["17cf79369b87f8d42d603176badec258f56feeac7fc833cd479b413c732dd0da","ea7d2955263e19ca888bfb60f50b1a3a0204ecfb9c98ca90e02d8a0dcf23a96e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lineage_private.predecessor_source_hash(oid)","meta":["5af87a938445ef7db28016ad5de01e397dd93c4dc32f548940fd0866e595eb96","d633a11df77465cef30bec84ef5d3c596e07483ea9107d07460f18259b7660ef","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lineage_private.predecessor(oid)","meta":["f7371ac466fa1b3b95480d13e2447cd1817ae8a7bd76c439dd8673795d1f764c","3824d228b8e778e18490d3948ccaf5f9fc98d0eef50804e9d96fde8fe2dc4043","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_lineage_private.successor_binding_pin(jsonb)","meta":["d9fff1cd2a8eebb20670daa5a4ae33472f8a76a2f0b8be2dcb8b80f3018e038c","59f3faeabc8252eb6d9738eac99963c2c1bac4831d927542348f2eef61051c7c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",true,false,false,false,"sql","b jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_lineage_private.successor_manifest(integer)","meta":["cece5beeeec9d0bb1e72a9851f095792834010246f791445a5185c06e1298500","d46d52cf3836c52e178115c02146fa0dacd965c9d87d71231913188c8342bdcd","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",true,false,false,false,"sql","p_stage integer","integer","jsonb","u","f"]},{"signature":"hotels_lineage_private.successor_metadata(oid)","meta":["b332ed3e26a761f855d8ef6a005667f57938738633f4c0c22b5ee0718d026ebb","92e46301d758a60c140c2a93f068ec1f5ccf700c2cd04f1582b59db4114e751d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_lineage_private.successors_are_exact(text)","meta":["fcf5478ea42f47e6aa45ef2d7aa1a94828a92b3ba763e784b95efbba34fe4139","863038839343d9a2f107fe1770f3c2e1e80a4f29f1761b7219d016368be26a45","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_root_hash text","text","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.assert_exact()","meta":["e209551631678bf5c1e97036d1f0b30a50b12b9513f94b987056c5d5dc1a68d3","5703b0931913f4e71523c42d488925b1628550ff12cca8d40b011a4969f85755","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"hotels_partner_read_once_private.metadata(oid)","meta":["372e9d2743beb23df24eff2d23f7748f97fc8e7e42348a3ea9a97d8c6eaf08c3","88378c155ecac7441f30b91580cc91b7d145cf489e835bc40745f0ba4ba3a31e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_06b6ba66f8598192(jsonb)","meta":["e73900b38e7364eba18088e3d4b6fcc5c38fa75fea748ee311e4c758700fa999","0b3fbd40322e99c103bfd3743b2373868e80a09f8eae7649ba5a29082979eddf","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_326760525d39fd81(jsonb, text, boolean)","meta":["5143548687336ab2ad3bf7ad74cff70a066722ee7681e27b134fcbe9a957f2dd","15afd652ea5b575267362249b35d783705319d14a8863c2f2eaa0a4a1293ef75","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, p_flag text, p_actual boolean","jsonb, text, boolean","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_3590b4e257042f09(jsonb)","meta":["d7a7f86120015784fa45e13cc75997cc544e580e2009f0c16c197fb90244055a","dc9ee8e67e06eff56414973ff386441f714f7f4e4f5dcfba8ed4138132d178dd","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","void","u","f"]},{"signature":"hotels_partner_read_once_private.read_3a98b157088d7466(jsonb, jsonb)","meta":["845ee26c11ee172fb8831f1b32fc0e7539b303ad9bdfc8e37275c272a471c54e","b1e701657cd1cb8674b8eb19db05f0c98ff28fd39d36359daaabe1f64d7f7094","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, p_hotel jsonb","jsonb, jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_63e67309c0eb62b8(jsonb)","meta":["255dbd4658b4aad4aa8612f350527a618f5743f5c1428b49f2162ee9e9c4e50c","8f57ca9ebf95360e73b98e2c1048721852ef1963fdcd7f36e85eb039c930ae4e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_7546feecb3da2c1b(jsonb)","meta":["379a8f5c51a45f0b59df10190f53b64ea85bc086df4905c6c490f9c5b2c16652","8cc39a2fa365d3b85a34918b8d658de392c7aa8a3dcf6ddb1f72556763e6a646","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_7c61c7b83a83f59b(jsonb)","meta":["781773927e7babad9d1f713c643779d46071e5aa7f73ee12a6c151ef81163706","03fc082c3aef3380d62f0d3d0e2efb556e1e14d87480b7c28e9dcd9eded0a6b1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","void","u","f"]},{"signature":"hotels_partner_read_once_private.read_806282cb24f87125(jsonb)","meta":["a679f3667a2a3f4ae7727ddb7548c508ddd2036653745f1bb9a26ae76c3f233a","3858379df1c4ea0f5f4dc2ea1ec03a3e1c1ed80b600d878cae5572c42677ce9b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_9e863cbe183fb1f3(jsonb)","meta":["f0e16b8ab734ed6991f8651ac0def8eec90a8f0b51b50748cf54b9c10721bc4a","48f88a1744e4fb0bac413f1d90f37c43db54129792c93ab46d8308de95b1a55f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_a3533e7d7979ea15(jsonb)","meta":["7c62dfd4d6651b0b8fcb81dce1bf034dbbe579422cf4185f6abde85967f0b320","14a24ecbee9a05864e8099dd3af7982f9b6b2e9d149f3ff42ba91399858ad510","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","text","u","f"]},{"signature":"hotels_partner_read_once_private.read_a41f675cf9007752(jsonb)","meta":["48800766671c3a760983dfc8b1c76f95613b6fdac82525cd2342fd6015f06900","fb64c6786d15ada3aafd925b9a5051ea0e7a6c9b69eb55502ea490ee18c8700a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_bf842dd83e381815(jsonb, text)","meta":["ca346e8a921be1f95774d04ff6c8af47cd5459870cfd42a8737a97679b221525","7eae5e487950740110a1415102ffcbbcdfd5cb7d49a1ace7246cf1f4206b33ec","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, p_root_hash text","jsonb, text","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_c8415e562fc992ed(jsonb)","meta":["7846358e0cf067290fba1ed63f23a87821af1141f70c4eee66aab2d32119a033","b50b725833b881d16b6ed16435703246e5ef058646007cbdce2864e37fbb1c22","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_d31405a1a55a0f2b(jsonb, jsonb)","meta":["a4bca843b1765323e98b13610bf8073a5bd447a79c0af0c5a5a19a5c76728a12","81b6b01f62c22430297950522d56186d86a1f351fb327179c076bf6e78d004c9","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, live jsonb","jsonb, jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_d848c718a811c87c(jsonb)","meta":["8ff5f6fb3f6a251ac6081c25f409bfb1176b169fbc57c9ccc1676e6c486d1046","68c1bd1e992515ce6fb1fa38b1e25bd17cacbc10972711f3b0f4eb9fcfed55ef","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_dfbc6217b32ff0fc(jsonb)","meta":["67a390fbb9084ddbc453dbaabe999fdd38745c4e5743fb65c59ce3ceec2e7cf3","d1ac898b56884011f9505a1893ea9c77ccd70be936b812c40a28b0366ce3456d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_e9411f087eaf40a5(jsonb)","meta":["82afe9077f43205d20b86cb545d389a62079e6f4ae948e23cce814d0f68fab1b","8f1cfd81b8e134e395a753a388ae54b09b685ac1d47c948e341a3471012b2e3b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_f46b02a57427361e(jsonb)","meta":["4da7250d92c2adb866fd6043ec34264f7ed45bf31dcbf96b9b45f0885a7c179e","0c6e1520c1a34629dfbc10b05fb9b204fd63ae96b5f783ffce73d4b45e3619b3","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_stripe_dto_private.assert_exact()","meta":["27a6557461c65b339d4bc4aee6c9faf8f83748fe134d4b852c9e5f4dfb99287c","d7938495d53ff4072b314db3045f80ffc796d3ef886d65699e24c1ac6f066c95","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"hotels_stripe_dto_private.helper_catalog()","meta":["95c4c33e0d17c6c9e175aa3b621dca32da8830691ab761eff6a4e9552cf0c21f","000be517942288f4f8c289ea4560e2e2a9e1c21bb42a48044a7747118b7f770d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_stripe_dto_private.predecessor_definition(oid)","meta":["73decaf4897d6f04354399f8cfe1d8a8c5c7e8236e07c900b2d419c0f2277a4a","6c28a747c3654fa8427d15b64e275d4a751674cdf8b5c17cae6044e54a00d862","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_stripe_dto_private.predecessor_source(oid)","meta":["199d181264570cba6dd5eb0c370bd19c6da613dfd5d76717f3a1ac71d20ba78a","1c367cfe650319b703b1e2ee3b9c9f7276b519f945a7cccc7df18f9df6ed2226","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_stripe_dto_private.relation_catalog()","meta":["d7955b8131b837f37fece6afa3dc8e9e8b2a91aed90f787b1e4e10db2fed1b44","518b6f29d7aaec14b0ec1130780febf11b4b49f9804b6833d22c34ef542d26d7","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()","meta":["0469f5be71cfaeaa3656bb31cdbf9c89e4284817229ac98971d833216122bbf5","e7e719a1ea773c437a67dc60fe00958ad686cf28499ac58c6428868e40cd3566","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_v2_private.hotel_external_calendar_provider_function_source_hashes()","meta":["c6bd94ce0c4d1d01709acd21c64b2270a16d23c7bf9402ecdba0d669d8fc88dd","fa4ca6bc17982e43b47d9b83d288805aaa1f1cd8c574e2a94352d8be085849a5","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()","meta":["2d4c38d1c9214f0890ace1be2d481300577edadca66a64741bcd7ca2fce52c25","e000fbc317082ce691f89c131eb3ecf9f3fc0f93e7011a35811182676bbcbc07","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_7a_pricing_activation_transaction_is_preserved()","meta":["1e74c1b709abb1fb29de0283d37d03325fd0ed7d5f6a01567a73174f8c6e983e","3c4fda73f8834d38f1c5f21fb8d00e5cd78923109705ac2addcbe2c63b06549f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(uuid)","meta":["26f5b9eacf9f77e7530607b7bab3f1fff1cc8a3e8c184ef1604e8a7d3a3364ad","49d37798ff060978dabcac1fcc1d492d1ddfdde55d14e4b5e1e9f6cd85a75567","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_proposal_id uuid","uuid","boolean","u","f"]},{"signature":"public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()","meta":["448e4e89c367efe15c33c3c6fa0a92f4d9972957da130b365536c15bd25fc69a","dcd0e3362d7268c1b4ae58aab7727ec40a4c7694db99ab8e76f26b52ac65eed2","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_allocation_items_fingerprint(uuid)","meta":["ccbe8150dae1b9aa1d973f7cb6c1065933e9f6acb344bc96d2b6f7a9b3b6b9d7","a839aef0f576e0790ec78a2c8600132e2907278bfc569e74cf0ff96c807791c4","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_rule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_cancellation_policy_is_valid(jsonb)","meta":["986704ae01fc5c2e22ac88213d1258a59c209dde8e887260e1c5283e9050f7db","074da5dfeeceda1122738c37d50ec16f2db5b2e311bb0f02feb70c588e38d0ac","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_policy jsonb","jsonb","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_enforce_graph_limits(uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer)","meta":["44570d9e23af259bc8cc4b4f68dfbbdbd45cf222f295818b6cf6a68d67130e90","dd643f1a30608e69b5de850d6699b7137733da5709fc34864b14e2aaf3560211","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"v",true,false,false,false,"plpgsql","p_hotel_id uuid, p_plan_delta integer DEFAULT 0, p_rate_delta integer DEFAULT 0, p_schedule_delta integer DEFAULT 0, p_rule_delta integer DEFAULT 0, p_exact_delta integer DEFAULT 0, p_allocation_delta integer DEFAULT 0, p_schedule_tier_delta integer DEFAULT 0, p_direct_tier_delta integer DEFAULT 0, p_allocation_item_delta integer DEFAULT 0","uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer","void","u","f"]},{"signature":"public.hotel_v2_admin_c_https_url_is_valid(text)","meta":["c4a3bbe6837f5c9827f992ecb1c23f70f9eae3420ea91ab8cc065ac3679918c9","424431fd5fd7a4f5354b3c0eb3eb9efbca7676e86818984bbbb72878ed2aa63a","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"plpgsql","p_value text","text","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_i18n_is_valid(jsonb, boolean, integer, boolean)","meta":["3d0eb69f24c1ea01f5801620ca2b329d60b6daf71a7fad481410cfcb817eeccd","591a016311c237636bd8ba8453b74b0e4b4eb4118556ab2b32de481abd1d79e4","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_value jsonb, p_require_all boolean, p_max_length integer, p_allow_lf boolean DEFAULT false","jsonb, boolean, integer, boolean","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_immutable_contract(uuid, text, uuid)","meta":["db46ee490fa9fb8cd82d5433d9207cde3a3a96693ab05859b500e308f38251f1","2e5defe980cfbff6baa15c77cb28437cc8c1283a38723dea21b8f9e6131aafeb","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid, p_entity text, p_entity_id uuid","uuid, text, uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_c_is_promotion_entity(uuid, text, uuid)","meta":["a9fd1c33c724e2f59e7a33b0c5cb8852669a077dce3354dc0e8c0f5e8fdd5f59","3a0f7b76d241f0bd3d62272032d75dab6dab4e537692af1994fc516d5d48840c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid, p_entity text, p_entity_id uuid","uuid, text, uuid","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_lifecycle(boolean, text)","meta":["55b9a9d32714a22e1d58581c2b99e91a8f7bd6561c5d192c08eff43bb8a07278","20bd207f2185b5f9894278af85ca1a36050cc58abd48c14cda6cddf4854b10fd","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_is_active boolean, p_review_status text","boolean, text","text","u","f"]},{"signature":"public.hotel_v2_admin_c_pricing_control_snapshot(uuid)","meta":["5d40f4475e8bbda75d3f44820ba90cca32fbb57cc405191e2c1369d1fc5a01c3","093de65e46b1372af1c5a594b6659679df1ee1b48a66364d4fcb4c5055f7cb33","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_c_room_tiers_fingerprint(uuid)","meta":["ee26c41eec7084e69e087e872e9647da40cfe7677b4fc05de481c3a6a733aa3b","a9b23c3666526993093daf7fa224334a0239bed3567d4572d1f75c332c95e1fe","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_room_rate_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_schedule_link_fingerprint(uuid)","meta":["96c6f32ffa32ae360019d1cd742fd3c6e93a74f64fbde3b78c3c099810784572","c912d6b4d40edc1c287916cb09a9d43ad7ad2b4be834b10692647354a28dce30","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_schedule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_schedule_source_summary(text, jsonb)","meta":["67a0f1e32364a83db130aafefcd9381ce825ca76884c510368f9551b407b72c0","37cc8779efa9cbd6ed99933cf6c8ffae83948becd62fefef68d657985d3f586e","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"plpgsql","p_source text, p_reference jsonb","text, jsonb","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_c_schedule_tiers_fingerprint(uuid)","meta":["914eaad5d7ab853758e1027480a1a113b5b64ffcbb9532b5a0125bbef1585891","f21629eec968c6ea467fb564acabb14885bf61ef7938ac8eac91a082d7d3dc28","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_schedule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()","meta":["3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35","0c5e70d6a35386dfbbaaeb15b54de5d9de215d7f6e1195c6a4e881960b98ce4a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_admin_d_current_foundation_snapshot()","meta":["677c8fba8970df369b356bf76fb42e07f3884fdcc058407151ea9d67f847bd62","9cbfd3fd7b3cd37045f867f278080cb7d010b8662480362bf65759ac1557eef6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_d_hash(jsonb)","meta":["d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828","1061e7c1549ef04fe3d3c657cd503d7f01be56f263e57024a6e811acd61e90ab","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",false,false,true,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"public.hotel_v2_admin_d_protected_fingerprints()","meta":["a6706c4bdad2180e8cb733949a0084f4355068555ad1014cea340f760e19f5f4","06ba8695d5431e2f5eb29082d4b667a94d3462e32946197032cbfe75ec49c92a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_d_snapshot_external_base(uuid, date, date, boolean)","meta":["0d8e57d5bb06811f3ad39f6d4a638783d4517bf6c0b660a64a551790059e625c","c01e624bdc9ce151093bd36ad6f468d46dc386ada46a6e105027d016213b6d97","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"v",true,false,false,false,"plpgsql","p_hotel_id uuid, p_from date, p_to date, p_require_admin boolean DEFAULT true","uuid, date, date, boolean","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_d_snapshot(uuid, date, date, boolean)","meta":["7f665d523ae4cd0ecd9183645e50b2898426e1e62fd1bd74b652b87a227c1e7b","826e8bf6ede1d20c84a24b1a61fd002d9ac1226e612ed7ccba2dd3dbc8fdaefe","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"v",true,false,false,false,"plpgsql","p_hotel_id uuid, p_from date, p_to date, p_require_admin boolean DEFAULT true","uuid, date, date, boolean","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_get_seven_arches_reviewed_pricing()","meta":["662c0e442aec46ee07f56ec5bac7a945af4613c15f76130809db4f9f8efa33be","39388f9ae2efeef1695d6e4e5369a6891ea64c26ad420bde71ea36e815de0aaa","postgres","{authenticated=X/postgres,postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_external_calendar_activation_function_fingerprints()","meta":["4050571cca29b2e8210f01806e8af643e484af6039985a0d2517b89ada5c2693","fd9c72053dfeee7ebef53c1a32dc706ff2fe3c777af23bb84863eb76d154c4b4","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_external_calendar_ics_source_type_is_supported(text)","meta":["36b05e8b654ae203ddd889c817464322e134cec638e1802acf8ae2092105c5d8","d88d33143e83da36247ad40d7ae8e0a7fd73e61c4f8ce7807bca5cc17c4c5378","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_source_type text","text","boolean","u","f"]},{"signature":"public.hotel_v2_external_calendar_protected_fingerprints()","meta":["f432744ec7753928726b3a4d4c999183d6f1f394217aa35182f594cd05b39d49","3adbe49659edfb0e9bad33876403f9c6459d1070baf38017dcc1fb06f85234db","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()","meta":["93cfd999504d4cd55e22252dec42a0ad96e0d35d5ed336333cfb2c7da35d2ff9","3f10cace4ac17410173c5f675a8e4b0cbd9146c112bb618cd7ba2affdb3bbcb1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_external_calendar_provider_sources_are_attributable()","meta":["78cef0753a71a5bf7304f0a627fdf687b12998b80e84626d59d41884dc522d68","d334acaea0ce017580be057634c4b956ec4041072faed4a11488b5e6f4a73333","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_external_calendar_site_settings_fingerprint()","meta":["8e88d7f4778e65afda80b98a9ba4b32a7ed7c56ae4022312bedcfd6f2b8e45f9","69370fd80f93f9f6df4f4f46613f625ff03e3f7d6c321952b3c15b51c893d382","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","text","u","f"]},{"signature":"public.hotel_v2_external_calendar_worker_hash(jsonb)","meta":["d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828","dedbffac95633e08fb511d9ff87b8213b0ceda62f580348ff860a64520cd49a2","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",true,false,false,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"public.hotel_v2_h2a_keys_allowed(jsonb, text[])","meta":["ad7d11bdbc9f1351e300ceaf9dc0e69b95464b0f8a4b6cd4fbdb179f77ae65e3","9c72b1257ffce0a67738723374b558eff16bf40cfbde2c2bb7553c5599c0e169","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_value jsonb, p_allowed text[]","jsonb, text[]","boolean","u","f"]},{"signature":"public.hotel_v2_h2a_require_admin()","meta":["2f1cc975916dbc86a63d348135a2ff83de50d9f31c20e70219257d476296fa3d","a44747b393c91606662d5cf110aca0ff31ea10501e7ae6e3eb0d838d7dccd3aa","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"public.hotel_v2_h2b1_children_policy_valid(text, integer, boolean)","meta":["fd4230ea0afb7b93ec7579714206a7f536f12db942b38fc0d125e4e19ff7030e","c75b718df46145d70ba4f26b84b451c25dfa7cceb4608819b4e01dca054bf6c5","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_policy text, p_minimum_age integer, p_allow_inherit boolean DEFAULT false","text, integer, boolean","boolean","u","f"]},{"signature":"public.hotel_v2_h3_1_codes_valid(text[])","meta":["b42b2345900af0c711871b1baff071931edd28e7135baa3f4511e789b049d3af","46275945b98f3310b6598dc1dfc48a0861c44b0284e20efabee23440be200ff5","postgres","{authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_codes text[]","text[]","boolean","u","f"]},{"signature":"public.hotel_v2_h3_1p_allocation_preview(uuid)","meta":["4964aa46351c50156f544dcaba03afae344cf5ef74164164eee5e930b2534e3f","5b6cf01e7ed53f46cc7a9786c05cbb7048292b5409f5f658f229ff99c0c64143","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_1p_expected_pricing_guest_count(text, uuid)","meta":["2ef5ca19ba7ea719ed67c190e0daef8b2452aea2aa320c121c3be041ab1da3a1","7ba888ed55f5d337a13ccb59771c3e01c42d2d9bec210e862be211d56b4ea344","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_rule_code text, p_room_type_id uuid","text, uuid","smallint","u","f"]},{"signature":"public.hotel_v2_h3_1p_parity_snapshot(uuid)","meta":["f4811812d61e75a7ba5634cdd555b0c608f6a12bf65b4aae745bd1dd007d0b9e","0a009fb68ac2ce44fcb4706e3a7064be40887061f58a540d9bc1ffad83f29040","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)","meta":["190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5","39b2e872c8c970b973e53b7139e6fe99fa93cc7f0a43769a4ebd4aca185aa151","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"plpgsql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_1p_schedule_tier_fingerprint(uuid)","meta":["3dc069f917328f11c67f9ebb78c3ad13951fdcea0af9372ee6eeec10a46a55fe","c3997cd2af659d9324b21dfa777ed414dcbe26fe3f928d0b06300b3e387de9b4","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_schedule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_h3_1p_source_tier_fingerprint(uuid)","meta":["d3fb212c1f0350fa572e583e13dd2979e5d3336f962690ce9126273c0082d926","fd06dd52185d0a01559405b4c2dbf0f13f2856a85d2d51fd828b31c15a385d9f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_h3_2a_capability_catalog()","meta":["a01f1e7484b1c8253fef8d8baf6d4f705497cacd3473c45de4bdf015821f68fe","4db7eb03ea3cf595523568970898b768c4eb6ac2597b5dabf3e181814d358332","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","","","text[]","u","f"]},{"signature":"public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)","meta":["be3510f53b2c8034ce74433bbec8718f52301c1ee998179c5f1e55aab49d0cfe","03f7ade0d62881ec6e4714798e93affa725311a30d7ae4e3c3489c5041c5bc84","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",true,false,false,false,"plpgsql","p_value jsonb","jsonb","boolean","u","f"]},{"signature":"public.hotel_v2_h3_2a_permissions_snapshot(uuid)","meta":["2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3","ee616f51785c5a667077690537fe46252fb40d7d4af1fb13cc7e34c710180a35","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_assignment_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2a_require_partner_hotel_access(uuid, uuid, text, boolean)","meta":["2b5702a60866205e56c6ecb7492581cf1b262098f5142b39559de5c6feb012cf","b3eb3fdf0b50ecf0b72556db4308b665b5efb703abb5a251a7002d4ea03dfae6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid, p_capability text DEFAULT NULL::text, p_owner_only boolean DEFAULT false","uuid, uuid, text, boolean","uuid","u","f"]},{"signature":"public.hotel_v2_h3_2a_require_partner_membership(uuid)","meta":["90ad483c8ae6c061d69f9b05e2a7b205219a7dbf37047e750a0a507835814b50","5b7150da151427a43e1af1daec64fa0a95406f4467958e2c6278db55be8b3fa6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_access_snapshot(uuid, uuid, text)","meta":["7f8cb70e2c7034d17f03377cf7ffe3d5648e47dc27800e9ac3542bc95e2bb5b4","d4075c2ba3967d51f01473b9cbcc83b14740ee15130b709e1d33a78efa29704c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid, p_capability text","uuid, uuid, text","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_commission_policy(uuid)","meta":["533a819b7903a4247196955a555a32c4a26b4bea4450814017334c83903ace77","fd370f0873dc983fffb056dd2125d3d6a396787cb244badb3d1900e1fb884e40","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_exact_price_projection(uuid)","meta":["41f8609b712906301ef93e0eb438188ce1989e1114ccea1dcf3f55e1775f438b","aae829f7fd4ea4581b629c73f36fe281e31e9d0e98cc040a61a56ccbf2836a29","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_flags_off()","meta":["c4866c37cc2a4c5569e9efee957db4f13cc641290e2b2ea4b96f6265e9a2691f","65688b0eead33ba1011655ddf3f86969b0ae0659cdbd8e951e6d7c52e89907f6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_h3_2b_hash(jsonb)","meta":["d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828","2f5016299bbcace7c05c7cf20d111ca3cc9bbbd7a3b525007b66b7ee5921722e","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"public.hotel_v2_h3_2b_protected_fingerprints()","meta":["7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2","479b55caffc7051e454b417f89f71939359b6965c896a53236a6685c0ea05c2d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_partner_get_seven_arches_reviewed_pricing_114488(uuid, uuid)","meta":["a3741a5c83780baed0b821834b4e0c72ba614d74aa9c349bc3d13c4641665b42","5f6679aa86ff7a894892f1969e825e2222fa9b70d138b91f17181985cc8e226c","postgres","{authenticated=X/postgres,postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid","uuid, uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_partner_get_workspace(uuid, uuid, date, date)","meta":["ae51c6ed5516fe7c37b684ac843572af0d2b23b08ca28759b58c926c97df9798","7e9fb042f44426615b299b482739a8b2f0e4b7b696ef5d5a6e96317dbe2fd85e","postgres","{authenticated=X/postgres,postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid, p_from date, p_to date","uuid, uuid, date, date","jsonb","u","f"]},{"signature":"public.hotel_v2_partner_workspace_function_lineage_is_exact()","meta":["e1bbb882e4ed18b28ff638262aedd9f29692a520d62aa016b6ef2b82f79a7757","456c382b52be5ebdefa219870d66fa4b9bbf73d88b0c9f33e754ecd61d9c42f7","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_independent_pricing_activation_lineage()","meta":["2c40bc68f2d7dd54bb50654d0ca3e5a528509964377fc57e460718e7baa82fd9","c377770fd48822ba40ab1385fe367bd4f307000e9b0cfc2ed1ce91f1d9f2553e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_independent_pricing_legacy_projection()","meta":["b596013a158f7358a1ca7514bff6228d0dc88c2e4e1c7b2e4f6ee7437ecbac75","90ce815dee027915030ea24793e4c2aaf7d54b72de50a386169561ed159be73f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()","meta":["9c891fee2fa897b4bb10940269d73d107b2e0d718247db0e61d9dc99a4b2b6bd","81df6679ef248287bad82861cd0a5f1e6efb7a0d436ddc7a5e04b50895b9f0c0","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_owner_capabilities()","meta":["cd66ff70012c3c3e155eb62ae8f398278ad162878f976cc620caa86a2dab3fd6","763120a749bf186709ffbcc3de59240a5a3bdb52f776f1db1ace3bd51d7c8f4a","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()","meta":["03dbfb03f1219361abe2173ee8e2b079b4191f6ab83d664fece9833926aeba94","bafa94cf095ad4b43b8fbdc7f52e0ca83ac2e7c25af7bb21721384dc26f2c8dc","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_pricing_activation_current_is_safe()","meta":["57cabf1992e9f03f5411715b59c29aea51501aa3a91b403d36e61264c394e420","c45a5617b905f6d0daaa9bbcb05cece78846043935ca6471317bb0284f349d4b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()","meta":["04462d1fc2ade7d2c4574e7caef96f323cbb98a31d869c6f02e8f09dffe1dda4","e92044e10d61c2bb96ec0de0ca376167627856747bb8c58c24ba32315104b215","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_pricing_scoped_lineage()","meta":["11f6a865ddea542368bf76e707b0ec660a7245742a3db3441e99b9de22f7224d","7e6b0b496ec1a358bf7e6065df4dc936a5fe0351facad8b605a2240bb95f7287","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()","meta":["46cc1c679ce139cc79c808ecd264264393c27c99a7f67f192c2ea0c56b08456d","8c7e337ce3afddefb4f3dd3399064b269e035cca3b57845933ccb97dd8da2c5e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()","meta":["6c6f107b2d90abd7d9216cbd10c5d3817661250cdc35d52858c9ba923cfda258","e2dde9cf51680e038246104e512b0715c0662683d5bcfe684f0c6c4833ccaf72","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()","meta":["3ff36a3245901ea37f53e6dfbf9213e1bc72f127b7531041904833d5993eef17","8ffd62d7ee5c5ebff9d63aea826c4c7fb2086adc2c20378508b049ef73bd9dd9","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","text","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_current_state()","meta":["daa90ae3ec5515f22f8be8034276738d135bf3839bdd539dde99fe16636889c8","6658273707d91f56172b4946c3b1560da7b44c80dd40afe4df87f3e8ff655ab3","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_oracle()","meta":["50fee36eb4e4c7a11ad0baf0188a9f2042bde3678c5d835b3e8b7ece992ebfef","1b4b1497db1b0e4f07a550c4a5475c044f517041cc75b878331d3039104046a1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()","meta":["ca914b81c1b0d22ad186669010b27b13c946949e73bfc84ce8065bea037e5424","cea8de2e25ff83aa1834cbb6c1ca4b78e73de145fc07f32234136da9d9a95649","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()","meta":["6e53ef01e748a54cb1dbbae5d35010a343aa4331a0c5450a4d2fc967a1e253fd","65a7931d8ac0d3c8926d9543ad4aed3a349f967a9a8b71d56c0cfd14ffc5858c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()","meta":["17b801fefd47c93859f1e7868b606d3d56288dd590f931aa4c385148a72d85cc","b4d25cd69edb4c849abfad7e6d6da7e12a0ef4fc480201428ef1d251a941862e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.is_current_user_admin()","meta":["581f1801056e5aee65c0144151b41dea41910d2c8e22639873ff659487e8a255","b22b4cf0fc9af5cdf67e880eb404de038dcea9cfa9220e11541da17e45720899","postgres","{anon=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres}",["search_path=public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]}]'::jsonb) LOOP
  IF (SELECT (SELECT jsonb_build_array(encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
 encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
 pg_get_userbyid(p.proowner),(CASE WHEN p.proacl IS NULL THEN NULL ELSE ARRAY(SELECT entry::text FROM unnest(p.proacl) AS acl(entry) ORDER BY entry::text COLLATE "C") END)::text,p.proconfig,p.provolatile,p.prosecdef,
 p.proleakproof,p.proisstrict,p.proretset,l.lanname)
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=q.oid)||jsonb_build_array(
 pg_get_function_arguments(q.oid),oidvectortypes(q.proargtypes),q.prorettype::regtype::text,q.proparallel,q.prokind)
 FROM pg_proc q WHERE q.oid=to_regprocedure(b->>'signature')) IS DISTINCT FROM b->'meta'
  THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114489_foundation_predecessor_drift:'||(b->>'signature'); END IF;
 END LOOP;
END $foundation_before$;

CREATE FUNCTION hotels_published_architecture_private.foundation_3a98b157088d7466(p_hotel jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS 'BEGIN RETURN hotels_published_architecture_private.historical_hotel(p_hotel); END;';
ALTER FUNCTION hotels_published_architecture_private.foundation_3a98b157088d7466(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_3a98b157088d7466(jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_7ef67dad5e1284e9(p_read_context jsonb, p_hotel jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS 'BEGIN RETURN hotels_published_architecture_private.historical_hotel(p_hotel); END;';
ALTER FUNCTION hotels_published_architecture_private.foundation_7ef67dad5e1284e9(jsonb, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_7ef67dad5e1284e9(jsonb, jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_5defd8514b7a18fd(p_read_context jsonb) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS '
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
    ''hotel'',(select hotels_published_architecture_private.foundation_7ef67dad5e1284e9(p_read_context,to_jsonb(hotel))-array[''pricing_tiers'',''updated_at'']
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
';
ALTER FUNCTION hotels_published_architecture_private.foundation_5defd8514b7a18fd(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_5defd8514b7a18fd(jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_06b6ba66f8598192() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS '
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
    ''hotel'',(select hotels_published_architecture_private.foundation_3a98b157088d7466(to_jsonb(hotel))-array[''pricing_tiers'',''updated_at'']
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
';
ALTER FUNCTION hotels_published_architecture_private.foundation_06b6ba66f8598192() OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_06b6ba66f8598192() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_7546feecb3da2c1b() RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS '
declare
  -- Read-only STABLE inputs: one evaluation per invocation/snapshot; never cached across calls.
  v_lifecycle_once_0 constant boolean:=public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();
  v_lifecycle_once_1 constant text:=public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint(); c_hotel constant uuid:=''9b6d99a0-923a-4fbc-be54-c066e856e6ca'';
  c_source constant uuid:=''b0a3104f-7b31-5265-a59f-c2d166f11a23'';
  v_foundation public.hotel_seven_arches_reviewed_pricing_foundation_receipts%rowtype;
  v_receipt public.hotel_seven_arches_reviewed_pricing_evolution_receipts%rowtype;
  v_state jsonb; v_previous text; v_expected_sequence bigint:=1;
  v_receipt_count integer; v_phase1 record; v_scoped_lineage jsonb;
begin
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  if (select count(*) from public.hotel_seven_arches_reviewed_pricing_foundation_receipts)<>1
     or exists(select 1
       from public.hotel_seven_arches_reviewed_pricing_transaction_context)
     or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true
     or jsonb_typeof(v_scoped_lineage) is distinct from ''object''
     or v_scoped_lineage->>''contract_version'' is distinct from
       ''hotels_v2_seven_arches_pricing_scoped_lineage_v1''
     or (select count(*) from jsonb_object_keys(v_scoped_lineage))<>21
     or (v_scoped_lineage ?& array[
       ''contract_version'',''hotel_id'',''partner_id'',''assignment_id'',''owner_user_ids'',
       ''owner_membership_fingerprint'',''permission_preset_fingerprint'',
       ''property_business_fingerprint'',''room_identity_fingerprint'',
       ''pricing_identity_fingerprint'',''allocation_contract_exact'',''parity_case_count'',
       ''parity_mismatch_count'',''parity_fingerprint'',''commission_policy_fingerprint'',
       ''payment_policy_fingerprint'',''site_settings_lifecycle'',
       ''site_settings_lifecycle_fingerprint'',''owner_capability_receipt_fingerprint'',
       ''property_foundation_receipt_fingerprint'',''lower_function_security_fingerprint''
     ]::text[]) is not true
     or v_scoped_lineage->>''hotel_id'' is distinct from c_hotel::text
     or v_scoped_lineage->>''allocation_contract_exact'' is distinct from ''true''
     or (v_scoped_lineage->>''parity_case_count'')::integer<>100
     or (v_scoped_lineage->>''parity_mismatch_count'')::integer<>0
     or exists(select 1 from jsonb_each_text(v_scoped_lineage) entry
       where entry.key in(''owner_membership_fingerprint'',
         ''permission_preset_fingerprint'',''property_business_fingerprint'',
         ''room_identity_fingerprint'',''pricing_identity_fingerprint'',
         ''commission_policy_fingerprint'',
         ''payment_policy_fingerprint'',''site_settings_lifecycle_fingerprint'',
         ''owner_capability_receipt_fingerprint'',
         ''property_foundation_receipt_fingerprint'',
         ''lower_function_security_fingerprint'')
       and entry.value!~''^[0-9a-f]{64}$'')
     or (v_scoped_lineage->>''parity_fingerprint''~''^[0-9a-f]{32}$'')
       is distinct from true
     or public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
       ''public.hotel_v2_seven_arches_pricing_scoped_lineage()''::regprocedure)))
       is distinct from (select evidence#>>''{functions_after,hotel_v2_seven_arches_pricing_scoped_lineage(),definition}''
         from hotels_lineage_private.reconciliation_receipts where id=1)
     or public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
       ''public.hotel_v2_7a_pricing_activation_transaction_is_preserved()''::regprocedure)))
       is distinct from (select receipt.transaction_preservation_source_hash
         from public.hotel_seven_arches_pricing_activation_evolution_receipts receipt
         where receipt.id=1)
     or (select count(*) from public.hotel_seven_arches_independent_pricing_authority)<>54
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id=''aec20731-7a56-35f0-334e-92b363351f02''::uuid)<>27
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id=''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)<>27
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id=c_source)<>27
     or (select count(*) from public.hotel_pricing_schedules schedule
       where schedule.id in(
         ''aec20731-7a56-35f0-334e-92b363351f02''::uuid,
         ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid)
       and schedule.hotel_id=c_hotel and schedule.sharing_mode=''independent''
       and schedule.is_active and schedule.review_status=''reviewed'')<>2
     or not exists(select 1 from public.hotel_room_rates rate
       where rate.id=''7e420964-9cbf-4f1b-abd3-09840af5240f''::uuid
         and rate.room_type_id=''b4ef504f-cdeb-4e3c-a54d-932146ef4e94''::uuid
         and rate.pricing_schedule_id=
           ''aec20731-7a56-35f0-334e-92b363351f02''::uuid)
     or not exists(select 1 from public.hotel_room_rates rate
       where rate.id=''3320590d-632d-423f-80d0-fd021cba7293''::uuid
         and rate.room_type_id=''825c01b7-9f82-492a-9c81-9b1d5cd7acd3''::uuid
         and rate.pricing_schedule_id=
           ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid) then
    raise notice ''REVIEWED_PRICING_CHAIN_FAIL:BASE_TOPOLOGY'';
    return false;
  end if;
  select * into strict v_foundation
  from public.hotel_seven_arches_reviewed_pricing_foundation_receipts where id=1;
  if v_foundation.created_at is null or not isfinite(v_foundation.created_at)
     or v_foundation.phase1_receipt_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash((select jsonb_set(to_jsonb(receipt),''{created_at}'',
         to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
         from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
         where receipt.id=1))
     or v_foundation.phase1_property_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_foundation.phase1_property_fingerprints)
     or v_foundation.external_helper_source_hash is distinct from
       ''e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5''
     or (v_foundation.external_helper_source_hash is distinct from
       encode(extensions.digest(convert_to((select hotels_lifecycle_private.predecessor_source(procedure_row.oid)
         from pg_proc procedure_row where procedure_row.oid=
           ''public.hotel_v2_external_calendar_protected_fingerprints()''::regprocedure),
         ''UTF8''),''sha256''),''hex'')
       and not v_lifecycle_once_0)
     or v_foundation.phase1_oracle_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
         ''public.hotel_v2_seven_arches_independent_pricing_oracle()''::regprocedure)))
     or v_foundation.reviewed_oracle_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
         ''public.hotel_v2_seven_arches_reviewed_pricing_oracle()''::regprocedure)))
     or v_foundation.partner_preview_source_after_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
         ''public.hotel_v2_partner_preview_pricing_plan(jsonb)''::regprocedure)))
     or v_foundation.partner_apply_source_after_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
         ''public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)''::regprocedure)))
     or v_foundation.freeze_source_after_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
         ''public.hotel_v2_admin_c_h3_1p_freeze_trigger()''::regprocedure)))
     or (select evidence#>>''{functions_after,hotel_v2_seven_arches_independent_pricing_topology_is_exact(),definition}''
         from hotels_lineage_private.reconciliation_receipts where id=1) is distinct from
       hotels_lineage_private.predecessor_definition_hash(
         ''public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()''::regprocedure)
     or v_foundation.property_source_after_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
         ''public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()''::regprocedure)))
     or hotels_lineage_private.current_anchor_is_exact() is not true
     or v_foundation.foundation_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(jsonb_set(
         to_jsonb(v_foundation)-''foundation_fingerprint'',''{created_at}'',
         to_jsonb((extract(epoch from v_foundation.created_at)*1000000)::bigint),false)) then
    raise notice ''REVIEWED_PRICING_CHAIN_FAIL:FOUNDATION:%'',jsonb_build_object(
      ''created'',v_foundation.created_at is not null and isfinite(v_foundation.created_at),
      ''phase1_receipt'',v_foundation.phase1_receipt_fingerprint is not distinct from
        public.hotel_v2_h3_2b_hash((select jsonb_set(to_jsonb(receipt),''{created_at}'',
          to_jsonb((extract(epoch from receipt.created_at)*1000000)::bigint),false)
          from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
          where receipt.id=1)),
      ''property_hash'',v_foundation.phase1_property_fingerprint is not distinct from
        public.hotel_v2_h3_2b_hash(v_foundation.phase1_property_fingerprints),
      ''external_live'',v_foundation.external_helper_source_hash is not distinct from
        encode(extensions.digest(convert_to((select hotels_lifecycle_private.predecessor_source(procedure_row.oid)
          from pg_proc procedure_row where procedure_row.oid=
            ''public.hotel_v2_external_calendar_protected_fingerprints()''::regprocedure),
          ''UTF8''),''sha256''),''hex''),
      ''phase1_oracle'',v_foundation.phase1_oracle_source_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
          ''public.hotel_v2_seven_arches_independent_pricing_oracle()''::regprocedure))),
      ''reviewed_oracle'',v_foundation.reviewed_oracle_source_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
          ''public.hotel_v2_seven_arches_reviewed_pricing_oracle()''::regprocedure))),
      ''partner_preview'',v_foundation.partner_preview_source_after_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
          ''public.hotel_v2_partner_preview_pricing_plan(jsonb)''::regprocedure))),
      ''partner_apply'',v_foundation.partner_apply_source_after_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
          ''public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)''::regprocedure))),
      ''freeze'',v_foundation.freeze_source_after_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
          ''public.hotel_v2_admin_c_h3_1p_freeze_trigger()''::regprocedure))),
      ''topology'',v_foundation.topology_source_after_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
          ''public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()''::regprocedure))),
      ''property'',v_foundation.property_source_after_hash is not distinct from
        public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
          ''public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()''::regprocedure))),
      ''catalog'',v_foundation.catalog_fingerprint is not distinct from
        v_lifecycle_once_1,
      ''self'',v_foundation.foundation_fingerprint is not distinct from
        public.hotel_v2_h3_2b_hash(jsonb_set(
          to_jsonb(v_foundation)-''foundation_fingerprint'',''{created_at}'',
          to_jsonb((extract(epoch from v_foundation.created_at)*1000000)::bigint),false)));
    return false;
  end if;
  if exists(select 1
      from public.hotel_seven_arches_independent_pricing_authority authority
      left join public.hotel_pricing_schedule_occupancy_tiers tier
        on tier.id=authority.target_tier_id
      left join public.hotel_pricing_schedule_occupancy_tiers source
        on source.id=authority.source_tier_id
      where tier.id is null or source.id is null
        or authority.hotel_id<>c_hotel
        or authority.guest_count not between 2 and 4
        or authority.threshold_nights not between 2 and 10
        or authority.currency<>''EUR''
        or source.schedule_id<>c_source
        or source.guest_count<>authority.guest_count
        or source.threshold_nights<>authority.threshold_nights
        or source.nightly_rate<>authority.initial_nightly_rate
        or source.version<>authority.source_tier_version
        or source.is_active<>authority.source_is_active
        or tier.schedule_id<>authority.independent_schedule_id
        or tier.guest_count<>authority.guest_count
        or tier.threshold_nights<>authority.threshold_nights
        or tier.nightly_rate<>authority.current_nightly_rate
        or tier.version<>authority.current_target_version
        or not tier.is_active
        or authority.initial_nightly_rate<10
        or authority.current_nightly_rate<10) then
    raise notice ''REVIEWED_PRICING_CHAIN_FAIL:AUTHORITY'';
    return false;
  end if;
  select receipt.legacy_schedule_fingerprint_before,
    receipt.legacy_tier_fingerprint_before into strict v_phase1
  from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
  where receipt.id=1;
  if v_phase1.legacy_schedule_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
         to_jsonb(schedule)-array[''created_at'',''updated_at''] order by schedule.id)
         from public.hotel_pricing_schedules schedule where schedule.id in(c_source,
           ''443065c0-984a-5de3-a22a-d03042c41107''::uuid)),''[]''::jsonb))
     or v_phase1.legacy_tier_fingerprint_before is distinct from
       public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
         to_jsonb(tier)-array[''created_at'',''updated_at''] order by tier.id)
         from public.hotel_pricing_schedule_occupancy_tiers tier
         where tier.schedule_id in(c_source,
           ''443065c0-984a-5de3-a22a-d03042c41107''::uuid)),''[]''::jsonb)) then
    raise notice ''REVIEWED_PRICING_CHAIN_FAIL:PHASE1_SHARED'';
    return false;
  end if;
  v_state:=hotels_published_architecture_private.foundation_06b6ba66f8598192();
  if (v_state#>>''{oracle,core_case_count}'')::integer<>100
     or (v_state#>>''{oracle,core_mismatch_count}'')::integer<>0
     or (v_state#>>''{oracle,guest_one_case_count}'')::integer<>20
     or (v_state#>>''{oracle,guest_one_mismatch_count}'')::integer<>0
     or v_state->>''commission_fingerprint''<>v_foundation.commission_fingerprint
     or public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
       is not true
     or v_state->>''unrelated_fingerprint''<>
       v_foundation.initial_unrelated_fingerprint then
    raise notice ''REVIEWED_PRICING_CHAIN_FAIL:ORACLE_COMMERCIAL'';
    return false;
  end if;
  select count(*)::integer into v_receipt_count
  from public.hotel_seven_arches_reviewed_pricing_evolution_receipts;
  if v_receipt_count=0 then
    if v_state->>''normalized_fingerprint''<>v_foundation.initial_normalized_fingerprint
       or v_state->>''authority_fingerprint''<>
         v_foundation.initial_reviewed_authority_fingerprint
       or v_state->>''legacy_fingerprint''<>v_foundation.initial_legacy_fingerprint
       or v_state#>>''{oracle,fingerprint}''<>
         v_foundation.initial_reviewed_oracle_fingerprint
       or exists(select 1
         from public.hotel_seven_arches_independent_pricing_authority authority
         where authority.current_nightly_rate<>authority.initial_nightly_rate
           or authority.current_target_version<>authority.target_initial_version
           or authority.current_receipt_sequence<>0) then
      raise notice ''REVIEWED_PRICING_CHAIN_FAIL:GENESIS_STATE'';
      return false;
    end if;
  else
    v_previous:=v_foundation.genesis_hash;
    for v_receipt in select *
      from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
      order by receipt.sequence_no loop
      if v_receipt.sequence_no<>v_expected_sequence
         or v_receipt.previous_receipt_hash<>v_previous
         or v_receipt.created_at is null or not isfinite(v_receipt.created_at)
         or v_receipt.receipt_hash<>public.hotel_v2_h3_2b_hash(jsonb_set(
           to_jsonb(v_receipt)-''receipt_hash'',''{created_at}'',
           to_jsonb((extract(epoch from v_receipt.created_at)*1000000)::bigint),false))
         or v_receipt.commission_fingerprint<>v_foundation.commission_fingerprint
         or v_receipt.unrelated_before_fingerprint<>
           v_receipt.unrelated_after_fingerprint
         or v_receipt.unrelated_before_fingerprint<>
           v_foundation.initial_unrelated_fingerprint
         or v_receipt.allowed_changed_keys<>array[
           ''hotel_pricing_schedule_occupancy_tiers'',
           ''hotel_seven_arches_independent_pricing_authority'',
           ''hotels.pricing_tiers'',''hotel_activity_log'',
           ''hotel_seven_arches_reviewed_pricing_workflow'']::text[]
         or cardinality(v_receipt.activity_ids)<>1
         or not public.hotel_v2_h3_2a_jsonb_is_pii_free(v_receipt.changed_items)
         or not exists(select 1
           from public.hotel_seven_arches_reviewed_pricing_proposals proposal
           join public.hotel_seven_arches_reviewed_pricing_admin_reviews review
             on review.id=v_receipt.review_id and review.proposal_id=proposal.id
           where proposal.id=v_receipt.proposal_id and proposal.status=''accepted''
             and proposal.consumed_review_id=review.id
             and proposal.consumed_correlation_id=v_receipt.correlation_id
             and review.consumed_correlation_id=v_receipt.correlation_id
             and review.consumed_idempotency_key=v_receipt.idempotency_key
             and review.action=''accept''
             and v_receipt.initiator_type=proposal.initiator_type
             and v_receipt.partner_id is not distinct from proposal.partner_id
             and v_receipt.assignment_id is not distinct from proposal.assignment_id
             and v_receipt.actor_id=review.actor_id
             and v_receipt.reason_fingerprint=public.hotel_v2_h3_2b_hash(
               jsonb_build_object(''proposal_reason'',proposal.reason,
                 ''admin_reason'',review.reason))
             and v_receipt.changed_tier_ids=(select array_agg(
               item.schedule_tier_id order by item.schedule_tier_id)
               from public.hotel_seven_arches_reviewed_pricing_proposal_items item
               where item.proposal_id=proposal.id)
             and v_receipt.changed_room_keys=(select array_agg(
               distinct item.room_key order by item.room_key)
               from public.hotel_seven_arches_reviewed_pricing_proposal_items item
               where item.proposal_id=proposal.id)
             and v_receipt.changed_items is not distinct from (select jsonb_agg(
               jsonb_build_object(''room_key'',item.room_key,
                 ''room_type_id'',item.room_type_id,''room_rate_id'',item.room_rate_id,
                 ''pricing_schedule_id'',item.pricing_schedule_id,
                 ''schedule_tier_id'',item.schedule_tier_id,
                 ''pricing_occupancy'',item.guest_count,
                 ''minimum_nights'',item.minimum_nights,''currency'',item.currency,
                 ''before_price'',item.before_price,
                 ''after_price'',item.requested_price,
                 ''before_version'',item.before_tier_version,
                 ''after_version'',item.before_tier_version+1)
               order by item.schedule_tier_id)
               from public.hotel_seven_arches_reviewed_pricing_proposal_items item
               where item.proposal_id=proposal.id))
         or exists(select 1 from unnest(v_receipt.activity_ids) activity_id
           where not exists(select 1 from public.hotel_activity_log activity
             where activity.id=activity_id and activity.hotel_id=c_hotel
               and activity.correlation_id=v_receipt.correlation_id
               and activity.source=
                 ''hotels_v2_seven_arches_reviewed_pricing_admin'')) then
        raise notice ''REVIEWED_PRICING_CHAIN_FAIL:RECEIPT_ROW'';
        return false;
      end if;
      if v_expected_sequence=1 and (
           v_receipt.normalized_before_fingerprint<>
             v_foundation.initial_normalized_fingerprint
           or v_receipt.authority_before_fingerprint<>
             v_foundation.initial_reviewed_authority_fingerprint
           or v_receipt.legacy_before_fingerprint<>
             v_foundation.initial_legacy_fingerprint
           or v_receipt.parity_before_fingerprint<>
             v_foundation.initial_reviewed_oracle_fingerprint) then
        raise notice ''REVIEWED_PRICING_CHAIN_FAIL:FIRST_RECEIPT'';
        return false;
      end if;
      if v_expected_sequence>1 and exists(select 1
        from public.hotel_seven_arches_reviewed_pricing_evolution_receipts previous
        where previous.sequence_no=v_receipt.sequence_no-1 and (
          previous.normalized_after_fingerprint<>
            v_receipt.normalized_before_fingerprint
          or previous.authority_after_fingerprint<>
            v_receipt.authority_before_fingerprint
          or previous.legacy_after_fingerprint<>
            v_receipt.legacy_before_fingerprint
          or previous.parity_after_fingerprint<>
            v_receipt.parity_before_fingerprint)) then
        raise notice ''REVIEWED_PRICING_CHAIN_FAIL:RECEIPT_CONTINUITY'';
        return false;
      end if;
      v_previous:=v_receipt.receipt_hash;
      v_expected_sequence:=v_expected_sequence+1;
    end loop;
    select * into strict v_receipt
    from public.hotel_seven_arches_reviewed_pricing_evolution_receipts receipt
    order by receipt.sequence_no desc limit 1;
    if v_receipt.normalized_after_fingerprint<>v_state->>''normalized_fingerprint''
       or v_receipt.authority_after_fingerprint<>v_state->>''authority_fingerprint''
       or v_receipt.legacy_after_fingerprint<>v_state->>''legacy_fingerprint''
       or v_receipt.parity_after_fingerprint<>v_state#>>''{oracle,fingerprint}''
       or v_receipt.receipt_hash<>v_state->>''last_receipt_hash''
       or v_receipt_count<>v_receipt.sequence_no then
      raise notice ''REVIEWED_PRICING_CHAIN_FAIL:LIVE_TAIL'';
      return false;
    end if;
  end if;
  if exists(select 1 from (values
      (''public.hotel_seven_arches_reviewed_pricing_proposals''::regclass),
      (''public.hotel_seven_arches_reviewed_pricing_proposal_items''::regclass),
      (''public.hotel_seven_arches_reviewed_pricing_admin_reviews''::regclass),
      (''public.hotel_seven_arches_reviewed_pricing_transaction_context''::regclass),
      (''public.hotel_seven_arches_reviewed_pricing_foundation_receipts''::regclass),
      (''public.hotel_seven_arches_reviewed_pricing_evolution_receipts''::regclass),
      (''public.hotel_seven_arches_independent_pricing_authority''::regclass),
      (''public.hotel_seven_arches_independent_pricing_topology_receipts''::regclass),
      (''public.hotel_seven_arches_independent_pricing_evolution_receipts''::regclass)
    ) expected(relation_id) left join pg_class relation on relation.oid=expected.relation_id
    where relation.oid is null or relation.relowner<>''postgres''::regrole
      or not relation.relrowsecurity
      or relation.relforcerowsecurity or relation.relkind<>''r''
      or exists(select 1 from pg_policy policy where policy.polrelid=relation.oid)
      or exists(select 1 from unnest(array[
        ''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER'']) privilege(name)
        where has_table_privilege(0::oid,relation.oid,privilege.name)
          or has_table_privilege(''anon'',relation.oid,privilege.name)
          or has_table_privilege(''authenticated'',relation.oid,privilege.name)
          or has_table_privilege(''service_role'',relation.oid,privilege.name))) then
    raise notice ''REVIEWED_PRICING_CHAIN_FAIL:RAW_ACL'';
    return false;
  end if;
  return true;
exception when no_data_found or too_many_rows or undefined_table or undefined_function then
  raise notice ''REVIEWED_PRICING_CHAIN_FAIL:EXCEPTION:%'',sqlerrm;
  return false;
end;
';
ALTER FUNCTION hotels_published_architecture_private.foundation_7546feecb3da2c1b() OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_7546feecb3da2c1b() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_f46b02a57427361e() RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS '
declare c_source constant uuid:=''b0a3104f-7b31-5265-a59f-c2d166f11a23'';
  v_phase1 public.hotel_seven_arches_independent_pricing_evolution_receipts%rowtype;
  v_lineage jsonb;
  v_lineage_normalized jsonb;
  v_provider_receipt_count integer:=0;
begin
  if to_regclass(''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'')
       is not null then
    execute ''select count(*) from hotels_v2_private.''||
      ''hotel_external_calendar_provider_evolution_receipts''
      into v_provider_receipt_count;
    if v_provider_receipt_count not in(0,1)
       or (v_provider_receipt_count=1 and not
         public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()) then
      return false;
    end if;
  end if;
  if hotels_published_architecture_private.foundation_7546feecb3da2c1b()
       is not true then
    return false;
  end if;
  select * into strict v_phase1
  from public.hotel_seven_arches_independent_pricing_evolution_receipts
  where id=1;
  v_lineage:=public.hotel_v2_seven_arches_independent_pricing_activation_lineage();
  if v_lineage is null then
    return false;
  end if;
  v_lineage_normalized:=v_lineage;
  if v_lineage->>''property_attribution_exact'' is distinct from ''true'' then
    if public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()
         is not true then
      return false;
    end if;
    v_lineage_normalized:=jsonb_set(v_lineage,
      ''{property_attribution_exact}'',''true''::jsonb,false);
  end if;
  if v_provider_receipt_count=1 then
    if v_lineage_normalized#>>''{lower_function_sources,provider_attribution}''
         is distinct from
         ''78cef0753a71a5bf7304f0a627fdf687b12998b80e84626d59d41884dc522d68'' then
      return false;
    end if;
    v_lineage_normalized:=jsonb_set(v_lineage_normalized,
      ''{lower_function_sources,provider_attribution}'',
      to_jsonb(''6aee1bb6d02b999877d6384633dd9eab1e8d533917b24ab25e20c83973a0025f''::text),false);
    v_lineage_normalized:=jsonb_set(v_lineage_normalized,
      ''{lower_function_security}'',coalesce((select jsonb_agg(
        case when entry.value->>''signature''=
          ''public.hotel_v2_external_calendar_provider_sources_are_attributable()''
        then jsonb_set(entry.value,''{source_hash}'',
          to_jsonb(''6aee1bb6d02b999877d6384633dd9eab1e8d533917b24ab25e20c83973a0025f''::text),false)
        else entry.value end order by entry.ordinality)
        from jsonb_array_elements(v_lineage_normalized->''lower_function_security'')
          with ordinality entry(value,ordinality)),''[]''::jsonb),false);
  end if;
  if hotels_lineage_private.lineage_matches_historical(v_lineage_normalized) is not true
     or (select count(*)
       from public.hotel_seven_arches_independent_pricing_topology_receipts)<>2
     or exists(select 1
       from public.hotel_seven_arches_independent_pricing_topology_receipts topology
       where topology.contract_version<>
           ''hotels_v2_seven_arches_independent_pricing_topology_v1''
         or topology.created_at is null or not isfinite(topology.created_at)
         or topology.room_key not in(''upper'',''ground'')
         or topology.source_schedule_id<>c_source
         or topology.source_tier_count<>27 or topology.target_tier_count<>27
         or topology.room_type_id<>case topology.room_key
           when ''upper'' then ''b4ef504f-cdeb-4e3c-a54d-932146ef4e94''::uuid
           else ''825c01b7-9f82-492a-9c81-9b1d5cd7acd3''::uuid end
         or topology.room_rate_id<>case topology.room_key
           when ''upper'' then ''7e420964-9cbf-4f1b-abd3-09840af5240f''::uuid
           else ''3320590d-632d-423f-80d0-fd021cba7293''::uuid end
         or topology.independent_schedule_id<>case topology.room_key
           when ''upper'' then ''aec20731-7a56-35f0-334e-92b363351f02''::uuid
           else ''9d109336-64f3-3c57-4684-968b59c94c3b''::uuid end
         or topology.independent_schedule_code<>case topology.room_key
           when ''upper'' then ''upper-apartment-independent''
           else ''ground-apartment-independent'' end
         or topology.source_tier_fingerprint<>
           topology.target_initial_tier_fingerprint
         or topology.source_tier_fingerprint<>public.hotel_v2_h3_2b_hash(
           coalesce((select jsonb_agg(jsonb_build_object(
             ''guest_count'',tier.guest_count,
             ''threshold_nights'',tier.threshold_nights,
             ''nightly_rate'',tier.nightly_rate,
             ''currency'',btrim(schedule.currency::text),
             ''is_active'',tier.is_active,''version'',tier.version)
             order by tier.guest_count,tier.threshold_nights)
           from public.hotel_pricing_schedule_occupancy_tiers tier
           join public.hotel_pricing_schedules schedule
             on schedule.id=tier.schedule_id
           where tier.schedule_id=c_source),''[]''::jsonb))
         or topology.target_initial_tier_fingerprint<>
           public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
             jsonb_build_object(''guest_count'',authority.guest_count,
               ''threshold_nights'',authority.threshold_nights,
               ''nightly_rate'',authority.initial_nightly_rate,
               ''currency'',authority.currency,
               ''is_active'',authority.target_initial_is_active,
               ''version'',authority.target_initial_version)
             order by authority.guest_count,authority.threshold_nights)
           from public.hotel_seven_arches_independent_pricing_authority authority
           where authority.room_key=topology.room_key),''[]''::jsonb))
         or topology.source_schedule_fingerprint<>
           public.hotel_v2_h3_2b_hash((select jsonb_build_object(
             ''name_i18n'',schedule.name_i18n,
             ''application_scope'',schedule.application_scope,
             ''currency'',btrim(schedule.currency::text),
             ''minimum_billable_occupancy'',schedule.minimum_billable_occupancy,
             ''maximum_party_size'',schedule.maximum_party_size,
             ''is_active'',schedule.is_active,''review_status'',schedule.review_status,
             ''source'',schedule.source,''sharing_mode'',schedule.sharing_mode,
             ''version'',schedule.version)
           from public.hotel_pricing_schedules schedule where schedule.id=c_source))
         or topology.target_schedule_fingerprint<>
           public.hotel_v2_h3_2b_hash((select jsonb_build_object(
             ''name_i18n'',schedule.name_i18n,
             ''application_scope'',schedule.application_scope,
             ''currency'',btrim(schedule.currency::text),
             ''minimum_billable_occupancy'',schedule.minimum_billable_occupancy,
             ''maximum_party_size'',schedule.maximum_party_size,
             ''is_active'',schedule.is_active,''review_status'',schedule.review_status,
             ''source'',schedule.source,''sharing_mode'',schedule.sharing_mode,
             ''version'',schedule.version)
           from public.hotel_pricing_schedules schedule
           where schedule.id=topology.independent_schedule_id))
         or topology.authority_fingerprint<>
           public.hotel_v2_h3_2b_hash(coalesce((select jsonb_agg(
             to_jsonb(authority)-array[''created_at'',''current_nightly_rate'',
               ''current_target_version'',''current_receipt_sequence'',''updated_at'']
             order by authority.target_tier_id)
           from public.hotel_seven_arches_independent_pricing_authority authority
           where authority.room_key=topology.room_key),''[]''::jsonb))) then
    return false;
  end if;
  return true;
exception when no_data_found or too_many_rows or undefined_table
    or undefined_function then
  return false;
end;
';
ALTER FUNCTION hotels_published_architecture_private.foundation_f46b02a57427361e() OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_f46b02a57427361e() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_4c5280b68669b020() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS '
declare
  -- Read-only STABLE inputs: one evaluation per invocation/snapshot; never cached across calls.
  v_lifecycle_once_0 constant jsonb:=public.hotel_v2_external_calendar_activation_function_fingerprints();
  v_lifecycle_once_1 constant boolean:=public.hotel_v2_partner_workspace_function_lineage_is_exact();
  v_lifecycle_once_2 constant boolean:=public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();
  v_lifecycle_once_3 constant jsonb:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  v_lifecycle_once_4 constant boolean:=public.hotel_v2_7a_pricing_activation_transaction_is_preserved();
  v_lifecycle_once_5 constant boolean:=public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact();
  v_lifecycle_once_6 constant boolean:=hotels_published_architecture_private.foundation_f46b02a57427361e();
  v_lifecycle_once_7 constant boolean:=hotels_published_architecture_private.foundation_7546feecb3da2c1b();
  v_lifecycle_once_8 constant boolean:=public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact();
  v_lifecycle_once_9 constant boolean:=public.hotel_v2_external_calendar_provider_sources_are_attributable();
  v_lifecycle_once_10 constant boolean:=hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact();
  v_lifecycle_once_11 constant jsonb:=public.hotel_v2_seven_arches_owner_capabilities();
  c_hotel constant uuid:=''9b6d99a0-923a-4fbc-be54-c066e856e6ca'';
  c_receipt constant uuid:=''37500000-0000-4000-8000-000000000001'';
  c_correlation constant uuid:=''37500000-0000-4000-8000-000000000002'';
  c_idempotency constant uuid:=''37500000-0000-4000-8000-000000000003'';
  c_activity constant uuid:=''37500000-0000-4000-8000-000000000004'';
  c_outbox constant uuid:=''37500000-0000-4000-8000-000000000005'';
  -- Must match the audit-only system attribution emitted by the bootstrap.
  c_system_actor constant uuid:=''00000000-0000-0000-0000-000000000000'';
  v_original public.hotel_admin_availability_foundation_receipts%rowtype;
  v_evolution public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_current jsonb;
  v_stage2_current jsonb;
  v_h3 jsonb;
  v_current_owner_user_ids uuid[];
  v_current_foreign_permissions_fingerprint text;
  v_original_safe boolean:=false;
  v_historical_receipts_safe boolean:=false;
  v_frozen_contracts_safe boolean:=false;
  v_supported_flags_safe boolean:=false;
  v_stage2f_safe boolean:=false;
  v_deployed_foundations_safe boolean:=false;
  v_current_evolution_safe boolean:=false;
  v_stage2_evolution_safe boolean:=false;
  v_evolution_safe boolean:=false;
  v_target_foundation_safe boolean:=false;
  v_assignment_safe boolean:=false;
  v_owner_membership_safe boolean:=false;
  v_permission_safe boolean:=false;
  v_foreign_permissions_safe boolean:=false;
  v_audit_safe boolean:=false;
begin
  select * into v_original from public.hotel_admin_availability_foundation_receipts where id=1;
  select * into v_evolution from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  v_current:=public.hotel_v2_admin_d_protected_fingerprints();
  v_stage2_current:=public.hotel_v2_external_calendar_protected_fingerprints();
  v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);
  select array_agg(member.user_id order by member.user_id)
    into v_current_owner_user_ids
  from public.partner_users member
  where member.partner_id=v_evolution.partner_id and member.role=''owner'';
  select md5(coalesce(string_agg(to_jsonb(permission)::text,''|''
      order by permission.assignment_id),''''))
    into v_current_foreign_permissions_fingerprint
  from public.hotel_partner_hotel_permissions permission
  where permission.hotel_id<>c_hotel;
  v_original_safe:=(select count(*)=1 from public.hotel_admin_availability_foundation_receipts)
    and v_original.id=1
    and v_original.protected_fingerprint=encode(extensions.digest(
      convert_to(v_original.protected_fingerprints::text,''UTF8''),''sha256''),''hex'');
  v_historical_receipts_safe:=v_original_safe
    and (select count(*)=1 from public.hotel_partner_workspace_foundation_receipts)
    and exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
        convert_to(receipt.protected_fingerprints::text,''UTF8''),''sha256''),''hex''))
    and (select count(*)=1 from hotels_v2_private.hotel_external_calendar_foundation_receipts)
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
        convert_to(receipt.protected_fingerprints::text,''UTF8''),''sha256''),''hex''))
    and (select count(*)=1 from hotels_v2_private.hotel_external_calendar_activation_receipts)
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1
        and receipt.site_settings_without_external_fingerprint~''^[0-9a-f]{64}$''
        and jsonb_typeof(receipt.compatibility_function_fingerprints)=''object''
        and (select count(*)
          from jsonb_object_keys(receipt.compatibility_function_fingerprints))=20
        and receipt.compatibility_function_fingerprints ?& array[
          ''public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)'',
          ''public.hotel_v2_partner_list_assigned_properties(uuid)'',
          ''public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)'',
          ''public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)'',
          ''public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)'',
          ''public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)'',
          ''public.hotel_v2_admin_get_content_control(uuid)'',
          ''public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)'',
          ''public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)'',
          ''public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)'',
          ''public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)'',
          ''public.hotel_v2_h3_2b_flags_off()'',
          ''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'',
          ''public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)'',
          ''public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)'',
          ''public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)'',
          ''public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)'',
          ''public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)'',
          ''public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)'',
          ''public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)''
        ]::text[]
        and not exists(select 1
          from jsonb_each_text(receipt.compatibility_function_fingerprints) entry
          where entry.value!~''^[0-9a-f]{64}$''));
  v_supported_flags_safe:=(select count(*)=1 and bool_and(id=1
      and hotels_lifecycle_private.predecessor_flag_exact(''hotel_rooms_v2_enabled'',hotel_rooms_v2_enabled) and hotel_external_sync_enabled is not null
      and not hotel_instant_booking_enabled and hotels_lifecycle_private.predecessor_flag_exact(''hotel_stripe_connect_enabled'',hotel_stripe_connect_enabled))
      from public.site_settings);
  v_stage2f_safe:=not exists(select 1 from public.site_settings setting
      where setting.id=1 and setting.hotel_external_sync_enabled)
    or exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.compatibility_function_fingerprints=
        jsonb_set(v_lifecycle_once_0,
          array[''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'']::text[],
          receipt.compatibility_function_fingerprints->
            ''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'',false)
        and v_lifecycle_once_1);
  v_frozen_contracts_safe:=not exists(select 1 from (values
      (''public.hotel_v2_admin_d_protected_fingerprints()'',true,
        array[''search_path=pg_catalog, public'']::text[],
        ''a6706c4bdad2180e8cb733949a0084f4355068555ad1014cea340f760e19f5f4''),
      (''public.hotel_v2_admin_d_immutable_row()'',false,
        array[''search_path=pg_catalog'']::text[],
        ''bf10c8d2393ef28580dc1079c3b07f0985c6676cce1e5792460aedc6c1453bfa''),
      (''public.hotel_v2_h3_2a_permissions_snapshot(uuid)'',true,
        array[''search_path=pg_catalog, public'']::text[],
        ''2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3''),
      (''public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)'',true,
        array[''search_path=pg_catalog, public'']::text[],
        ''be3510f53b2c8034ce74433bbec8718f52301c1ee998179c5f1e55aab49d0cfe''),
      (''public.hotel_v2_h3_2a_reject_immutable_change()'',false,
        array[''search_path=pg_catalog, public'']::text[],
        ''5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c''),
      (''public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)'',false,
        array[''search_path=pg_catalog, public'']::text[],
        ''2fcbd3faf9deab53d06332141cb76ab383bf5e0d87fb4309478a8fbc431ae339''),
      (''public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()'',false,
        array[''search_path=pg_catalog, public'']::text[],
        ''3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35''),
      (''public.hotel_v2_h3_2b_hash(jsonb)'',false,
        array[''search_path=pg_catalog'']::text[],
        ''d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828''),
      (''public.hotel_v2_h3_2b_protected_fingerprints()'',true,
        array[''search_path=pg_catalog, public'']::text[],
        ''7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2''),
      (''public.hotel_v2_h3_2b_immutable_row()'',false,
        array[''search_path=pg_catalog'']::text[],
        ''b461f8218dc31b9d5cce8ea6893593c9ce058a04dd38e5a2271c7aec2654cc3e''),
      (''public.hotel_v2_external_calendar_worker_hash(jsonb)'',true,
        array[''search_path=pg_catalog'']::text[],
        ''d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828''),
      (''public.hotel_v2_external_calendar_protected_fingerprints()'',true,
        array[''search_path=pg_catalog, public'']::text[],
        ''f432744ec7753928726b3a4d4c999183d6f1f394217aa35182f594cd05b39d49''),
      (''public.hotel_v2_external_calendar_activation_function_fingerprints()'',true,
        array[''search_path=pg_catalog, public'']::text[],
        ''fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'')
    ) expected(signature,security_definer,configuration,source_hash)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>''postgres''::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.proconfig is distinct from expected.configuration
      or encode(extensions.digest(convert_to(hotels_lifecycle_private.predecessor_source(procedure_row.oid),''UTF8''),''sha256''),''hex'')
        <>expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
      or has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
      or has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
      or has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))
    and exists(select 1 from pg_class relation where relation.oid=
      ''public.hotel_admin_availability_foundation_receipts''::regclass
      and relation.relowner=''postgres''::regrole and relation.relrowsecurity)
    and exists(select 1 from pg_class relation where relation.oid=
      ''public.hotel_partner_workspace_foundation_receipts''::regclass
      and relation.relowner=''postgres''::regrole and relation.relrowsecurity)
    and exists(select 1 from pg_class relation where relation.oid=
      ''hotels_v2_private.hotel_external_calendar_foundation_receipts''::regclass
      and relation.relowner=''postgres''::regrole)
    and exists(select 1 from pg_class relation where relation.oid=
      ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
      and relation.relowner=''postgres''::regrole)
    and not exists(select 1 from (values
      (''hotel_admin_availability_foundation_immutable'',
        ''public.hotel_admin_availability_foundation_receipts''::regclass,
        ''public.hotel_v2_admin_d_immutable_row()''::regprocedure),
      (''hotel_partner_workspace_foundation_receipts_immutable'',
        ''public.hotel_partner_workspace_foundation_receipts''::regclass,
        ''public.hotel_v2_h3_2b_immutable_row()''::regprocedure),
      (''hotel_external_calendar_foundation_receipt_immutable'',
        ''hotels_v2_private.hotel_external_calendar_foundation_receipts''::regclass,
        ''public.hotel_v2_h3_2a_reject_immutable_change()''::regprocedure),
      (''hotel_external_calendar_activation_receipt_immutable'',
        ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass,
        ''public.hotel_v2_h3_2a_reject_immutable_change()''::regprocedure)
     ) expected(trigger_name,relation_oid,function_oid)
     where not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgname=expected.trigger_name
         and trigger_row.tgrelid=expected.relation_oid
         and trigger_row.tgfoid=expected.function_oid
         and not trigger_row.tgisinternal and trigger_row.tgenabled=''O''
         and trigger_row.tgtype=27))
    and not exists(select 1 from pg_policy policy where policy.polrelid in(
      ''public.hotel_admin_availability_foundation_receipts''::regclass,
      ''public.hotel_partner_workspace_foundation_receipts''::regclass))
    and not exists(select 1 from (values
      (''public.hotel_admin_availability_foundation_receipts''::regclass),
      (''public.hotel_partner_workspace_foundation_receipts''::regclass),
      (''hotels_v2_private.hotel_external_calendar_foundation_receipts''::regclass),
      (''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass),
      (''public.hotel_partner_hotel_permissions''::regclass)
     ) protected(relation_oid)
     cross join unnest(array[''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER'']) privilege(name)
     where has_table_privilege(0::oid,protected.relation_oid,privilege.name)
        or has_table_privilege(''anon'',protected.relation_oid,privilege.name)
        or has_table_privilege(''authenticated'',protected.relation_oid,privilege.name)
        or has_table_privilege(''service_role'',protected.relation_oid,privilege.name))
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.compatibility_function_fingerprints=
        jsonb_set(v_lifecycle_once_0,
          array[''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'']::text[],
          receipt.compatibility_function_fingerprints->
            ''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'',false)
        and v_lifecycle_once_1)
    and v_lifecycle_once_2;
  v_deployed_foundations_safe:=v_historical_receipts_safe and v_frozen_contracts_safe
    and v_supported_flags_safe and v_stage2f_safe;
  v_current_evolution_safe:=(select count(*)=1
      from public.hotel_admin_availability_foundation_evolution_receipts)
    and v_evolution.contract_version=''hotels_v2_admin_d_foundation_evolution_v2''
    and v_evolution.original_foundation_receipt_id=1
    and v_evolution.original_protected_fingerprint=v_original.protected_fingerprint
    and v_evolution.before_current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_evolution.before_current_protected_fingerprints::text,''UTF8''),''sha256''),''hex'')
    and v_evolution.current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_evolution.current_protected_fingerprints::text,''UTF8''),''sha256''),''hex'')
    and v_lifecycle_once_3 is not null
    and v_lifecycle_once_4
    and v_lifecycle_once_2
    and v_lifecycle_once_5
    and v_lifecycle_once_6
    and v_lifecycle_once_7
    and v_lifecycle_once_8
    and v_lifecycle_once_9
    and v_lifecycle_once_10
    and v_evolution.allowed_fingerprint_keys=array[''hotel_partner_hotel_permissions'',
      ''hotel_partner_action_receipts'',''hotel_partner_event_outbox'',''non_admin_d_activity'']::text[]
    and (v_evolution.current_protected_fingerprints-v_evolution.allowed_fingerprint_keys)
      is not distinct from
        (v_evolution.before_current_protected_fingerprints-v_evolution.allowed_fingerprint_keys)
    and not exists(select 1 from unnest(v_evolution.allowed_fingerprint_keys) changed(key)
      where v_evolution.current_protected_fingerprints->changed.key is not distinct from
        v_evolution.before_current_protected_fingerprints->changed.key)
    and v_evolution.before_foreign_permissions_fingerprint=
      v_evolution.current_foreign_permissions_fingerprint
    and v_evolution.current_foreign_permissions_fingerprint=
      v_current_foreign_permissions_fingerprint
    and v_evolution.before_permission is not distinct from jsonb_build_object(
      ''exists'',false,''version'',0,''updated_at'',null,
      ''has_mutation_capability'',false,''capabilities'',jsonb_build_object(
        ''edit_property_content'',false,''edit_property_photos'',false,
        ''edit_room_content'',false,''edit_room_photos'',false,''create_rooms'',false,
        ''edit_room_structure'',false,''manage_prices'',false,''manage_availability'',false,
        ''process_bookings'',false,''request_booking_changes'',false,
        ''view_payment_status'',false,''initiate_stripe_onboarding'',false))
    and v_evolution.capabilities is not distinct from
      v_lifecycle_once_11
    and v_evolution.hotel_id=c_hotel and v_evolution.permission_version=1
    and v_evolution.action_receipt_id=c_receipt
    and v_evolution.correlation_id=c_correlation
    and v_evolution.idempotency_key=c_idempotency
    and v_evolution.activity_id=c_activity and v_evolution.outbox_id=c_outbox;
  v_stage2_evolution_safe:=(select count(*)=1
      from public.hotel_admin_availability_foundation_evolution_receipts)
    and v_evolution.contract_version=''hotels_v2_admin_d_foundation_evolution_v2''
    and v_evolution.stage2_before_current_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_evolution.stage2_before_current_protected_fingerprints)
    and v_evolution.stage2_current_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_evolution.stage2_current_protected_fingerprints)
    and v_lifecycle_once_3 is not null
    and v_lifecycle_once_4
    and v_lifecycle_once_2
    and v_lifecycle_once_5
    and v_lifecycle_once_6
    and v_lifecycle_once_7
    and v_lifecycle_once_8
    and v_lifecycle_once_9
    and v_lifecycle_once_10
    and v_evolution.stage2_allowed_fingerprint_keys=array[
      ''hotel_partner_hotel_permissions'',''non_external_calendar_activity'',
      ''non_external_calendar_partner_receipts'']::text[]
    and (v_evolution.stage2_current_protected_fingerprints-
        v_evolution.stage2_allowed_fingerprint_keys) is not distinct from
      (v_evolution.stage2_before_current_protected_fingerprints-
        v_evolution.stage2_allowed_fingerprint_keys)
    and not exists(select 1 from unnest(v_evolution.stage2_allowed_fingerprint_keys) changed(key)
      where v_evolution.stage2_current_protected_fingerprints->changed.key is not distinct from
        v_evolution.stage2_before_current_protected_fingerprints->changed.key);
  v_evolution_safe:=v_current_evolution_safe and v_stage2_evolution_safe;
  v_target_foundation_safe:=exists(select 1 from public.hotels hotel where hotel.id=c_hotel
      and hotel.architecture_version=''legacy''
      and md5(hotel.pricing_tiers::text)=''7208ab4ecc0e47abd64d87ca1ac53a03''
      and jsonb_array_length(hotel.pricing_tiers->''rules'')=63)
    and not exists(select 1 from public.hotel_rate_plans
      where hotel_id=c_hotel and is_active)
    and not exists(select 1 from public.hotel_room_rates
      where hotel_id=c_hotel and is_active)
    and not exists(select 1 from public.hotel_pricing_schedules
      where hotel_id=c_hotel and is_active)
    and public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
    and v_h3#>>''{promotion,status}''=''reviewed''
    and v_h3#>>''{source,pricing_fingerprint}''=''7208ab4ecc0e47abd64d87ca1ac53a03''
    and (v_h3#>>''{source,rule_count}'')::integer=63
    and v_h3->>''pricing_occupancy_mapping_fingerprint''=''6f6e6c64f0b0d0aa60e3575d4fd4ac1c''
    and v_h3#>>''{parity,fingerprint}''=''b3c915266ab060efaba522cf5587fb75''
    and (v_h3#>>''{parity,total_case_count}'')::integer=70
    and (v_h3#>>''{parity,total_mismatch_count}'')::integer=0
    and (v_h3#>>''{target,room_schedule,tier_count}'')::integer=27
    and (v_h3#>>''{source,property_party_preview,tier_count}'')::integer=63
    and exists(select 1 from public.hotel_pricing_promotion_reviews review
      where review.hotel_id=c_hotel
        and review.contract_version=''seven_kamares_legacy_to_h3_pricing_v1''
        and review.review_status=''reviewed''
        and review.acknowledged_pricing_occupancy_mapping
        and review.source_fingerprint=v_h3#>>''{source,pricing_fingerprint}''
        and review.target_fingerprint=v_h3#>>''{target,target_fingerprint}''
        and review.pricing_occupancy_mapping_fingerprint=
          v_h3->>''pricing_occupancy_mapping_fingerprint''
        and review.parity_fingerprint=v_h3#>>''{parity,fingerprint}''
        and review.parity_case_count=(v_h3#>>''{parity,total_case_count}'')::integer
        and review.parity_mismatch_count=(v_h3#>>''{parity,total_mismatch_count}'')::integer
        and review.result->>''target_fingerprint''=review.target_fingerprint);
  v_owner_membership_safe:=coalesce(cardinality(v_current_owner_user_ids),0)>=1
    and v_evolution.owner_user_ids is not distinct from v_current_owner_user_ids
    and array_position(v_evolution.owner_user_ids,null) is null
    and cardinality(v_evolution.owner_user_ids)=(select count(distinct owner_id)
      from unnest(v_evolution.owner_user_ids) owner_id)
    and v_evolution.owner_membership_fingerprint=encode(extensions.digest(convert_to(
      jsonb_build_object(
        ''contract_version'',''hotels_v2_seven_arches_owner_membership_v1'',
        ''hotel_id'',v_evolution.hotel_id,''partner_id'',v_evolution.partner_id,
        ''assignment_id'',v_evolution.assignment_id,''role'',''owner'',
        ''owner_user_ids'',to_jsonb(v_evolution.owner_user_ids)
      )::text,''UTF8''),''sha256''),''hex'');
  v_assignment_safe:=(select count(*)=1 from public.partner_resources assignment
      where assignment.resource_type=''hotels'' and assignment.resource_id=c_hotel)
    and exists(select 1 from public.hotels hotel
      join public.partners partner on partner.id=hotel.owner_partner_id
      join public.partner_resources assignment on assignment.partner_id=partner.id
        and assignment.resource_type=''hotels'' and assignment.resource_id=hotel.id
      where hotel.id=c_hotel and partner.id=v_evolution.partner_id
        and assignment.id=v_evolution.assignment_id
        and partner.status=''active'' and partner.can_manage_hotels)
    and v_owner_membership_safe;
  v_permission_safe:=(select count(*)=1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel and permission.assignment_id=v_evolution.assignment_id
        and permission.partner_id=v_evolution.partner_id and permission.version=1
        and permission.created_by is null and permission.updated_by is null
        and permission.has_mutation_capability
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)
          is not distinct from v_evolution.after_permission
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)->''capabilities''
          is not distinct from v_lifecycle_once_11)
    and (select count(*)=1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel)
    and not exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel and permission.assignment_id<>v_evolution.assignment_id
        and permission.has_mutation_capability);
  v_foreign_permissions_safe:=v_evolution.before_foreign_permissions_fingerprint=
      v_evolution.current_foreign_permissions_fingerprint
    and v_evolution.current_foreign_permissions_fingerprint=
      v_current_foreign_permissions_fingerprint;
  v_audit_safe:=exists(select 1 from public.hotel_activity_log activity
      where activity.id=v_evolution.activity_id and activity.hotel_id=c_hotel
        and activity.entity_type=''property'' and activity.entity_id=c_hotel
        and activity.action=''update'' and activity.actor_type=''system'' and activity.actor_id is null
        and activity.source=''hotels_v2_seven_arches_owner_capability_bootstrap''
        and activity.correlation_id=v_evolution.correlation_id
        and activity.before_state=jsonb_build_object(
          ''partner_permissions'',v_evolution.before_permission,
          ''assignment_id'',v_evolution.assignment_id,''partner_id'',v_evolution.partner_id)
        and activity.after_state=jsonb_build_object(
          ''partner_permissions'',v_evolution.after_permission,
          ''assignment_id'',v_evolution.assignment_id,''partner_id'',v_evolution.partner_id))
    and exists(select 1 from public.hotel_partner_action_receipts receipt
      where receipt.id=v_evolution.action_receipt_id and receipt.partner_id=v_evolution.partner_id
        and receipt.hotel_id=c_hotel and receipt.actor_user_id=c_system_actor
        and receipt.action=''bootstrap_7_arches_owner_capabilities''
        and receipt.idempotency_key=v_evolution.idempotency_key
        and receipt.request_hash=v_evolution.request_hash
        and receipt.correlation_id=v_evolution.correlation_id
        and receipt.result is not distinct from jsonb_build_object(
          ''ok'',true,
          ''contract_version'',''hotels_v2_seven_arches_owner_capability_bootstrap_v1'',
          ''source'',''hotels_v2_seven_arches_owner_capability_bootstrap'',
          ''hotel_id'',c_hotel,''partner_id'',v_evolution.partner_id,
          ''assignment_id'',v_evolution.assignment_id,''changed'',true,
          ''permission'',v_evolution.after_permission,
          ''correlation_id'',v_evolution.correlation_id,
          ''idempotency_key'',v_evolution.idempotency_key)
        and receipt.request_hash=encode(extensions.digest(convert_to(jsonb_build_object(
          ''contract_version'',''hotels_v2_seven_arches_owner_capability_bootstrap_v1'',
          ''actor_type'',''system'',
          ''hotel_id'',c_hotel,''partner_id'',v_evolution.partner_id,
          ''assignment_id'',v_evolution.assignment_id,
          ''owner_user_ids'',to_jsonb(v_evolution.owner_user_ids),
          ''owner_membership_fingerprint'',v_evolution.owner_membership_fingerprint,
          ''capabilities'',v_evolution.capabilities)::text,''UTF8''),''sha256''),''hex''))
    and exists(select 1 from public.hotel_partner_event_outbox event
      where event.id=v_evolution.outbox_id and event.partner_id=v_evolution.partner_id
        and event.hotel_id=c_hotel and event.aggregate_type=''hotel_partner_permissions''
        and event.aggregate_id=v_evolution.assignment_id
        and event.event_type=''hotel.partner_permissions.updated''
        and event.dedupe_key=''h3_2a:permission:''||v_evolution.action_receipt_id::text
        and event.payload is not distinct from jsonb_build_object(
          ''hotel_id'',c_hotel,''assignment_id'',v_evolution.assignment_id,
          ''partner_id'',v_evolution.partner_id,''permission_version'',1,
          ''has_mutation_capability'',true,''correlation_id'',v_evolution.correlation_id));
  v_target_foundation_safe:=v_target_foundation_safe or (
    v_lifecycle_once_2
    and v_lifecycle_once_5
    and v_lifecycle_once_6
    and v_lifecycle_once_7
    and v_lifecycle_once_8
    and v_lifecycle_once_9
    and v_lifecycle_once_10);
  -- Successor of the sealed v1 preset: exact audited 114416 permission lineage.
  v_permission_safe:=hotels_lineage_private.current_anchor_is_exact();
  return jsonb_build_object(
    ''contract_version'',''hotels_v2_admin_d_current_foundation_v1'',
    ''original_receipt_intact'',v_original_safe,
    ''historical_receipts_intact'',v_historical_receipts_safe,
    ''frozen_contracts_exact'',v_frozen_contracts_safe,
    ''supported_hotel_flags'',v_supported_flags_safe,
    ''stage2f_function_compatibility_exact'',v_stage2f_safe,
    ''deployed_foundations_exact'',v_deployed_foundations_safe,
    ''stage2_current_protected_fingerprints'',v_stage2_current,
    ''stage2_current_protected_fingerprint'',
      public.hotel_v2_external_calendar_worker_hash(v_stage2_current),
    ''evolution_receipt_count'',(select count(*) from public.hotel_admin_availability_foundation_evolution_receipts),
    ''current_matches_latest'',v_current_evolution_safe,
    ''stage2_current_matches_latest'',v_stage2_evolution_safe,
    ''seven_arches_target_foundation_exact'',v_target_foundation_safe,
    ''seven_arches_owner_count'',coalesce(cardinality(v_current_owner_user_ids),0),
    ''seven_arches_owner_membership_exact'',v_owner_membership_safe,
    ''seven_arches_assignment_exact'',v_assignment_safe,
    ''seven_arches_owner_preset_exact'',v_permission_safe,
    ''foreign_hotel_permissions_unchanged'',v_foreign_permissions_safe,
    ''audit_chain_exact'',v_audit_safe,
    ''safe'',v_deployed_foundations_safe and v_evolution_safe and v_target_foundation_safe
      and v_assignment_safe and v_permission_safe and v_foreign_permissions_safe and v_audit_safe
  );
end
';
ALTER FUNCTION hotels_published_architecture_private.foundation_4c5280b68669b020() OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_4c5280b68669b020() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_4a1c0d32663f10d2() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public', 'auth' AS '
declare c_hotel constant uuid:=''9b6d99a0-923a-4fbc-be54-c066e856e6ca'';
begin
  perform public.hotel_v2_h2a_require_admin();
  return jsonb_build_object(
    ''contract_version'',''hotels_v2_seven_arches_reviewed_pricing_admin_control_v1'',
    ''hotel_id'',c_hotel,
    ''proposals'',coalesce((select jsonb_agg(jsonb_build_object(
        ''id'',proposal.id,''initiator_type'',proposal.initiator_type,
      ''partner_id'',proposal.partner_id,''assignment_id'',proposal.assignment_id,
      ''status'',proposal.status,''version'',proposal.version,''reason'',proposal.reason,
      ''item_count'',proposal.item_count,''created_at'',proposal.created_at,
      ''expires_at'',proposal.expires_at,''fresh'',proposal.expires_at>statement_timestamp()
        and proposal.status=''pending_admin_review''
        and public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(
          proposal.id)
        and (proposal.initiator_type=''admin'' or exists(select 1
          from public.hotel_partner_hotel_permissions permission
          where permission.assignment_id=proposal.assignment_id
            and permission.partner_id=proposal.partner_id
            and permission.hotel_id=proposal.hotel_id and permission.manage_prices
            and permission.version=proposal.assignment_version))
        and not exists(select 1
          from public.hotel_seven_arches_reviewed_pricing_proposal_items item
          left join public.hotel_seven_arches_independent_pricing_authority authority
            on authority.target_tier_id=item.schedule_tier_id
          left join public.hotel_pricing_schedule_occupancy_tiers tier
            on tier.id=item.schedule_tier_id
          where item.proposal_id=proposal.id and (
            authority.target_tier_id is null or tier.id is null
            or authority.current_nightly_rate<>item.before_price
            or authority.current_target_version<>item.before_tier_version
            or tier.nightly_rate<>item.before_price
            or tier.version<>item.before_tier_version)),
      ''items'',(select jsonb_agg(jsonb_build_object(
        ''item_index'',item.item_index,''room_key'',item.room_key,
        ''room_type_id'',item.room_type_id,''room_rate_id'',item.room_rate_id,
        ''pricing_schedule_id'',item.pricing_schedule_id,
        ''schedule_tier_id'',item.schedule_tier_id,''guest_count'',item.guest_count,
        ''minimum_nights'',item.minimum_nights,''currency'',item.currency,
        ''before_price'',item.before_price,''requested_price'',item.requested_price)
        order by item.item_index)
        from public.hotel_seven_arches_reviewed_pricing_proposal_items item
        where item.proposal_id=proposal.id)) order by proposal.created_at,proposal.id)
      from public.hotel_seven_arches_reviewed_pricing_proposals proposal
      where proposal.status=''pending_admin_review''),''[]''::jsonb),
    ''commission_policy'',jsonb_build_object(
      ''commission_mode'',''per_allocated_room_per_night'',''amount'',10,''currency'',''EUR''),
    ''current_state'',hotels_published_architecture_private.foundation_06b6ba66f8598192());
end;
';
ALTER FUNCTION hotels_published_architecture_private.foundation_4a1c0d32663f10d2() OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_4a1c0d32663f10d2() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_9caf92b3a8833eba(p_partner_id uuid, p_hotel_id uuid, p_from date, p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public', 'auth' AS '
declare v_access jsonb; v_pricing jsonb; v_availability jsonb; v_commission jsonb;
  v_hotel public.hotels%rowtype; v_content jsonb; v_content_token text; v_pricing_token text;
  v_property_draft jsonb; v_exact_prices jsonb;
begin
  v_access:=hotels_published_architecture_private.access_snapshot(p_partner_id,p_hotel_id,null);
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>61 then
    raise exception using errcode=''22023'',message=''hotels_v2_h3_2b_invalid_workspace_range'';
  end if;
  select * into strict v_hotel from public.hotels where id=p_hotel_id;
  if coalesce((v_access#>>''{capabilities,manage_prices}'')::boolean,false) then
    v_commission:=public.hotel_v2_h3_2b_commission_policy(p_hotel_id);
    v_pricing:=public.hotel_v2_admin_c_pricing_control_snapshot(p_hotel_id);
  end if;
  select jsonb_build_object(''exists'',true,''id'',draft.id,''status'',draft.status,''version'',draft.version,
      ''source_property_updated_at'',draft.source_property_updated_at,''content'',draft.content,
      ''photos'',draft.photos,''updated_at'',draft.updated_at)
    into v_property_draft from public.hotel_partner_property_drafts draft
    where draft.assignment_id=(v_access->>''assignment_id'')::uuid
    and draft.status=''pending_admin_review'';
  v_property_draft:=coalesce(v_property_draft,jsonb_build_object(''exists'',false,''id'',null,
    ''status'',null,''version'',0,''source_property_updated_at'',null,''content'',''{}''::jsonb,
    ''photos'',''{}''::jsonb,''updated_at'',null));
  v_content:=jsonb_build_object(
    ''property'',jsonb_build_object(''id'',v_hotel.id,''slug'',v_hotel.slug,
      ''architecture_version'',v_hotel.architecture_version,''status'',v_hotel.status,
      ''is_published'',v_hotel.is_published,''title_i18n'',v_hotel.title_i18n,
      ''description_i18n'',v_hotel.description_i18n,''city'',v_hotel.city,''address_line'',v_hotel.address_line,
      ''district'',v_hotel.district,''postal_code'',v_hotel.postal_code,''country'',v_hotel.country,
      ''latitude'',v_hotel.latitude,''longitude'',v_hotel.longitude,''google_maps_url'',v_hotel.google_maps_url,
      ''amenities'',v_hotel.amenities,''check_in_from'',v_hotel.check_in_from,
      ''check_out_until'',v_hotel.check_out_until,''cover_image_url'',v_hotel.cover_image_url,
      ''photos'',coalesce(v_hotel.photos,''[]''::jsonb),''updated_at'',v_hotel.updated_at),
    ''rooms'',coalesce((select jsonb_agg(jsonb_build_object(''id'',room.id,''hotel_id'',room.hotel_id,''code'',room.code,
      ''name_i18n'',room.name_i18n,''description_i18n'',room.description_i18n,''amenities'',room.amenities,
      ''bed_configuration'',room.bed_configuration,''floor_label_i18n'',room.floor_label_i18n,
      ''gallery'',room.gallery,''capacity_adults'',room.capacity_adults,''capacity_children'',room.capacity_children,
      ''max_occupancy'',room.max_occupancy,''bathrooms'',room.bathrooms,''size_sqm'',room.size_sqm,
      ''inventory_mode'',room.inventory_mode,''base_inventory_count'',room.base_inventory_count,
      ''status'',room.status,''sort_order'',room.sort_order,''version'',room.version,''updated_at'',room.updated_at)
      order by room.sort_order,room.id) from public.hotel_room_types room where room.hotel_id=p_hotel_id),''[]''),
    ''property_draft'',v_property_draft,
    ''units'',coalesce((select jsonb_agg(jsonb_build_object(''id'',unit_row.id,''room_type_id'',unit_row.room_type_id,
      ''code'',unit_row.code,''name_i18n'',unit_row.name_i18n,''status'',unit_row.status,
      ''version'',unit_row.version,''updated_at'',unit_row.updated_at) order by unit_row.room_type_id,unit_row.id)
      from public.hotel_units unit_row join public.hotel_room_types room on room.id=unit_row.room_type_id
      where room.hotel_id=p_hotel_id),''[]''));
  v_content_token:=public.hotel_v2_h3_2b_hash(v_content);
  if v_pricing is not null then
    select coalesce(jsonb_agg(public.hotel_v2_h3_2b_exact_price_projection(override_row.id)
      order by override_row.stay_date,override_row.id),''[]''::jsonb)
      into v_exact_prices from public.hotel_calendar_overrides override_row
      where override_row.hotel_id=p_hotel_id;
    v_pricing_token:=public.hotel_v2_h3_2b_hash(jsonb_build_object(
      ''admin_c_snapshot_token'',v_pricing->>''snapshot_token'',''commission_policy'',v_commission,
      ''exact_date_prices'',v_exact_prices));
  end if;
  if coalesce((v_access#>>''{capabilities,manage_availability}'')::boolean,false) then
    v_availability:=hotels_published_architecture_private.workspace_snapshot_114489(p_hotel_id,p_from,p_to,false);
  end if;
  return jsonb_build_object(''contract_version'',''hotels_v2_h3_2b_partner_workspace_v1'',
    ''partner'',jsonb_build_object(''id'',p_partner_id,''role'',v_access->>''role''),
    ''hotel_id'',v_hotel.id,
    ''assignment'',jsonb_build_object(''id'',v_access->''assignment_id'',
      ''permission_version'',v_access->''permission_version'',''capabilities'',v_access->''capabilities'',
      ''access_snapshot_token'',public.hotel_v2_h3_2b_hash(v_access)),
    ''content_snapshot_token'',v_content_token,
    ''property'',v_content->''property'',''property_draft'',v_content->''property_draft'',
    ''rooms'',v_content->''rooms'',''units'',v_content->''units'',
    ''pricing'',case when v_pricing is null then null else jsonb_build_object(
      ''snapshot_token'',v_pricing_token,''currency'',v_pricing#>>''{property,currency}'',
      ''rate_plans'',coalesce((select jsonb_agg(jsonb_build_object(''id'',plan.id,''hotel_id'',plan.hotel_id,
        ''code'',plan.code,''name_i18n'',plan.name_i18n,''is_active'',plan.is_active,
        ''review_status'',plan.review_status,''sort_order'',plan.sort_order,''version'',plan.version,
        ''updated_at'',plan.updated_at) order by plan.sort_order,plan.id)
        from public.hotel_rate_plans plan where plan.hotel_id=p_hotel_id),''[]''::jsonb),
      ''room_rates'',coalesce((select jsonb_agg(jsonb_build_object(''id'',rate.id,''hotel_id'',rate.hotel_id,
        ''room_type_id'',rate.room_type_id,''rate_plan_id'',rate.rate_plan_id,
        ''pricing_schedule_id'',rate.pricing_schedule_id,''base_nightly_rate'',rate.base_nightly_rate,
        ''currency'',rate.currency,''is_active'',rate.is_active,''review_status'',rate.review_status,
        ''pricing_source'',case when rate.pricing_schedule_id is not null then ''pricing_schedule''
          when exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
            where tier.room_rate_id=rate.id and tier.is_active) then ''independent_tiers''
          else ''base_nightly_rate'' end,
        ''base_nightly_rate_authoritative'',rate.pricing_schedule_id is null and not exists(
          select 1 from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active),
        ''sort_order'',rate.sort_order,''version'',rate.version,''updated_at'',rate.updated_at)
        order by rate.sort_order,rate.id) from public.hotel_room_rates rate where rate.hotel_id=p_hotel_id),''[]''::jsonb),
      ''schedules'',coalesce((select jsonb_agg(jsonb_build_object(''id'',schedule.id,''hotel_id'',schedule.hotel_id,
        ''code'',schedule.code,''name_i18n'',schedule.name_i18n,''application_scope'',schedule.application_scope,
        ''currency'',schedule.currency,''maximum_party_size'',schedule.maximum_party_size,
        ''minimum_billable_occupancy'',schedule.minimum_billable_occupancy,''is_active'',schedule.is_active,
        ''review_status'',schedule.review_status,''sharing_mode'',schedule.sharing_mode,
        ''version'',schedule.version,''updated_at'',schedule.updated_at) order by schedule.code,schedule.id)
        from public.hotel_pricing_schedules schedule where schedule.hotel_id=p_hotel_id),''[]''::jsonb),
      ''schedule_tiers'',coalesce((select jsonb_agg(jsonb_build_object(''id'',tier.id,
        ''schedule_id'',tier.schedule_id,''guest_count'',tier.guest_count,''threshold_nights'',tier.threshold_nights,
        ''nightly_rate'',tier.nightly_rate,''is_active'',tier.is_active,''version'',tier.version,
        ''updated_at'',tier.updated_at) order by tier.schedule_id,tier.guest_count,tier.threshold_nights,tier.id)
        from public.hotel_pricing_schedule_occupancy_tiers tier join public.hotel_pricing_schedules schedule
          on schedule.id=tier.schedule_id where schedule.hotel_id=p_hotel_id),''[]''::jsonb),
      ''room_rate_tiers'',coalesce((select jsonb_agg(jsonb_build_object(''id'',tier.id,
        ''hotel_id'',tier.hotel_id,''room_rate_id'',tier.room_rate_id,''guest_count'',tier.guest_count,
        ''threshold_nights'',tier.threshold_nights,''nightly_rate'',tier.nightly_rate,
        ''is_active'',tier.is_active,''version'',tier.version,''updated_at'',tier.updated_at)
        order by tier.room_rate_id,tier.guest_count,tier.threshold_nights,tier.id)
        from public.hotel_room_rate_occupancy_tiers tier where tier.hotel_id=p_hotel_id),''[]''::jsonb),
      ''exact_date_prices'',v_exact_prices,
      ''allocation_rules'',coalesce((select jsonb_agg(jsonb_build_object(''id'',allocation.id,
        ''hotel_id'',allocation.hotel_id,''code'',allocation.code,''allocation_mode'',allocation.allocation_mode,
        ''min_guest_count'',allocation.min_guest_count,''max_guest_count'',allocation.max_guest_count,
        ''is_active'',allocation.is_active,''review_status'',allocation.review_status,''sort_order'',allocation.sort_order,
        ''version'',allocation.version,''items'',coalesce((select jsonb_agg(
          jsonb_build_object(''id'',item.id,''allocation_rule_id'',item.allocation_rule_id,
            ''room_type_id'',item.room_type_id,''units_required'',item.units_required,
            ''allocated_guest_count'',item.allocated_guest_count,''pricing_guest_count'',item.pricing_guest_count,
            ''allocated_guest_counts'',to_jsonb(item.allocated_guest_counts),
            ''pricing_guest_counts'',to_jsonb(item.pricing_guest_counts),''sort_order'',item.sort_order) order by item.sort_order,item.id)
          from public.hotel_room_allocation_rule_items item where item.allocation_rule_id=allocation.id),''[]''::jsonb))
        order by allocation.sort_order,allocation.id) from public.hotel_room_allocation_rules allocation
        where allocation.hotel_id=p_hotel_id),''[]''::jsonb),
      ''commission_policy'',v_commission,
      ''mutation_blocked_reasons'',''[]''::jsonb) end,
    ''availability'',v_availability,
    ''sections'',jsonb_build_object(
      ''overview'',jsonb_build_object(''visible'',true,''available'',true,''status'',''available''),
      ''property_content'',jsonb_build_object(''visible'',coalesce((v_access#>>''{capabilities,edit_property_content}'')::boolean,false),''available'',coalesce((v_access#>>''{capabilities,edit_property_content}'')::boolean,false),''status'',case when coalesce((v_access#>>''{capabilities,edit_property_content}'')::boolean,false) then ''available'' else ''unavailable'' end),
      ''property_photos'',jsonb_build_object(''visible'',coalesce((v_access#>>''{capabilities,edit_property_photos}'')::boolean,false),''available'',coalesce((v_access#>>''{capabilities,edit_property_photos}'')::boolean,false),''status'',case when coalesce((v_access#>>''{capabilities,edit_property_photos}'')::boolean,false) then ''available'' else ''unavailable'' end),
      ''rooms'',jsonb_build_object(''visible'',coalesce((v_access#>>''{capabilities,edit_room_content}'')::boolean,false) or coalesce((v_access#>>''{capabilities,edit_room_photos}'')::boolean,false) or coalesce((v_access#>>''{capabilities,create_rooms}'')::boolean,false) or coalesce((v_access#>>''{capabilities,edit_room_structure}'')::boolean,false),''available'',coalesce((v_access#>>''{capabilities,edit_room_content}'')::boolean,false) or coalesce((v_access#>>''{capabilities,edit_room_photos}'')::boolean,false) or coalesce((v_access#>>''{capabilities,create_rooms}'')::boolean,false) or coalesce((v_access#>>''{capabilities,edit_room_structure}'')::boolean,false),''status'',case when coalesce((v_access#>>''{capabilities,edit_room_content}'')::boolean,false) or coalesce((v_access#>>''{capabilities,edit_room_photos}'')::boolean,false) or coalesce((v_access#>>''{capabilities,create_rooms}'')::boolean,false) or coalesce((v_access#>>''{capabilities,edit_room_structure}'')::boolean,false) then ''available'' else ''unavailable'' end),
      ''rates_pricing'',jsonb_build_object(''visible'',coalesce((v_access#>>''{capabilities,manage_prices}'')::boolean,false),''available'',coalesce((v_access#>>''{capabilities,manage_prices}'')::boolean,false),''status'',case when coalesce((v_access#>>''{capabilities,manage_prices}'')::boolean,false) then ''available'' else ''unavailable'' end),
      ''calendar_availability'',jsonb_build_object(''visible'',v_availability is not null,''available'',v_availability is not null,''status'',case when v_availability is null then ''unavailable'' else ''available'' end),
      ''bookings'',jsonb_build_object(''visible'',coalesce((v_access#>>''{capabilities,process_bookings}'')::boolean,false),
        ''available'',coalesce((v_access#>>''{capabilities,process_bookings}'')::boolean,false),''status'',''existing_flow''),
      ''payments'',jsonb_build_object(''visible'',coalesce((v_access#>>''{capabilities,view_payment_status}'')::boolean,false),
        ''available'',coalesce((v_access#>>''{capabilities,view_payment_status}'')::boolean,false),''status'',''existing_flow''),
      ''booking_changes'',jsonb_build_object(''visible'',coalesce((v_access#>>''{capabilities,request_booking_changes}'')::boolean,false),
        ''available'',false,''status'',''future_stage''),
      ''stripe_onboarding'',jsonb_build_object(''visible'',coalesce((v_access#>>''{capabilities,initiate_stripe_onboarding}'')::boolean,false),
        ''available'',false,''status'',''future_stage'')),
    ''capability_lifecycle'',hotels_lifecycle_private.safe_state(),
    ''stripe_connection'',hotels_lifecycle_private.partner_connection(p_partner_id,p_hotel_id),
    ''feature_flags'',hotels_lifecycle_private.actual_flags(),
    ''recent_activity'',coalesce((select jsonb_agg(jsonb_build_object(''id'',activity.id,''hotel_id'',activity.hotel_id,
      ''entity_type'',activity.entity_type,''entity_id'',activity.entity_id,''action'',activity.action,
      ''actor_type'',activity.actor_type,''source'',activity.source,''correlation_id'',activity.correlation_id,
      ''created_at'',activity.created_at) order by activity.created_at desc,activity.id desc)
      from(select * from public.hotel_activity_log where hotel_id=p_hotel_id
        and source=''hotels_v2_h3_2b_partner_workspace'' order by created_at desc,id desc limit 100) activity),''[]''),
    ''legacy_authoritative'',v_hotel.architecture_version=''legacy'',''public_change'',false);
end
';
ALTER FUNCTION hotels_published_architecture_private.foundation_9caf92b3a8833eba(uuid, uuid, date, date) OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_9caf92b3a8833eba(uuid, uuid, date, date) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_386f62cfcab6d04b(p_partner_id uuid, p_hotel_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public', 'auth' AS '
declare p_read_context jsonb:=''{}''::jsonb; v_access jsonb; v_workspace jsonb; v_state jsonb; v_policy jsonb;
begin
  IF p_hotel_id IS DISTINCT FROM ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid THEN
    RAISE EXCEPTION USING errcode=''55000'',message=''hotels_v2_seven_arches_reviewed_pricing_control_unavailable''; END IF;
  IF (SELECT jsonb_build_array(encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex''),pg_get_userbyid(p.proowner),p.proconfig,p.provolatile,p.prosecdef,p.proleakproof,p.proisstrict,p.proretset,l.lanname,
 (SELECT jsonb_agg(jsonb_build_array(a.grantee::regrole::text,a.grantor::regrole::text,a.privilege_type,a.is_grantable) ORDER BY a.grantee::regrole::text COLLATE "C") FROM aclexplode(coalesce(p.proacl,acldefault(''f'',p.proowner))) a))
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=''hotels_partner_read_once_private.assert_exact()''::regprocedure)
 IS DISTINCT FROM ''["e209551631678bf5c1e97036d1f0b30a50b12b9513f94b987056c5d5dc1a68d3","postgres",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql",[["postgres","postgres","EXECUTE",false]]]''::jsonb
 THEN RAISE EXCEPTION USING errcode=''55000'',message=''hotels_114488_guard_drift''; END IF;
  PERFORM hotels_partner_read_once_private.assert_exact();
  -- Invocation-local only. MATERIALIZED forces one evaluation, including SQL NULL.
  -- No context crosses into the opaque access/workspace/VOLATILE boundaries.
  BEGIN
    WITH evaluated AS MATERIALIZED (SELECT public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_seven_arches_payment_policy_lineage_is_exact'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_lineage_private.catalog_fingerprint() AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_lineage_private.catalog_fingerprint'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_lineage_private.permission_evidence() AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_lineage_private.permission_evidence'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_lineage_private.function_map() AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_lineage_private.function_map'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_stripe_dto_private.relation_catalog() AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_stripe_dto_private.relation_catalog'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_stripe_dto_private.helper_catalog() AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_stripe_dto_private.helper_catalog'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_806282cb24f87125(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_lineage_private.current_anchor_is_exact'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_lifecycle_private.actual_flags() AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_lifecycle_private.actual_flags'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_dfbc6217b32ff0fc(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_lifecycle_private.catalog_snapshot'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_63e67309c0eb62b8(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_lifecycle_private.chain_state'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_9e863cbe183fb1f3(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_lifecycle_private.safe_state'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_a41f675cf9007752(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_seven_arches_pricing_scoped_lineage'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT public.hotel_v2_7a_pricing_activation_transaction_is_preserved() AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_7a_pricing_activation_transaction_is_preserved'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT public.hotel_v2_seven_arches_reviewed_pricing_oracle() AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_seven_arches_reviewed_pricing_oracle'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_guest_policy_private.relation_catalog() AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_guest_policy_private.relation_catalog'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_published_architecture_private.foundation_5defd8514b7a18fd(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_seven_arches_reviewed_pricing_current_state'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT public.hotel_v2_external_calendar_activation_function_fingerprints() AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_external_calendar_activation_function_fingerprints'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_e9411f087eaf40a5(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_partner_workspace_function_lineage_is_exact'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_a3533e7d7979ea15(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_external_calendar_site_settings_fingerprint'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint() AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_v2_private.hotel_external_calendar_provider_function_fingerprints() AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_v2_private.hotel_external_calendar_provider_function_fingerprints'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_v2_private.hotel_external_calendar_provider_function_source_hashes() AS value)
    SELECT p_read_context||jsonb_build_object(''hotels_v2_private.hotel_external_calendar_provider_function_source_hashes'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_d848c718a811c87c(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_7546feecb3da2c1b(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT public.hotel_v2_external_calendar_provider_sources_are_attributable() AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_external_calendar_provider_sources_are_attributable'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_c8415e562fc992ed(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_seven_arches_independent_pricing_activation_lineage'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
    WITH evaluated AS MATERIALIZED (SELECT hotels_partner_read_once_private.read_f46b02a57427361e(p_read_context) AS value)
    SELECT p_read_context||jsonb_build_object(''public.hotel_v2_seven_arches_independent_pricing_topology_is_exact'',jsonb_build_object(''is_null'',value IS NULL,''value'',value)) INTO p_read_context FROM evaluated;
  EXCEPTION WHEN OTHERS THEN
    -- Original outer topology guard fails closed; never return partial evidence.
    -- PostgreSQL OTHERS deliberately excludes query_canceled/assert_failure.
    RAISE EXCEPTION USING errcode=''55000'',message=''hotels_v2_seven_arches_reviewed_pricing_control_unavailable'';
  END;
  if p_hotel_id is distinct from
       ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
     or (CASE WHEN (p_read_context#>>ARRAY[''public.hotel_v2_seven_arches_independent_pricing_topology_is_exact'',''is_null''])::boolean THEN NULL::boolean ELSE (p_read_context#>>ARRAY[''public.hotel_v2_seven_arches_independent_pricing_topology_is_exact'',''value''])::boolean END) is not true
     or (CASE WHEN (p_read_context#>>ARRAY[''public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact'',''is_null''])::boolean THEN NULL::boolean ELSE (p_read_context#>>ARRAY[''public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact'',''value''])::boolean END) is not true then
    raise exception using errcode=''55000'',
      message=''hotels_v2_seven_arches_reviewed_pricing_control_unavailable'';
  end if;
  v_access:=hotels_published_architecture_private.access_snapshot(
    p_partner_id,p_hotel_id,''manage_prices'');
  -- Match the exact workspace used by the existing 114415 Partner Preview.
  -- Do not reconstruct or substitute the raw Admin-C snapshot token here.
  v_workspace:=hotels_published_architecture_private.foundation_9caf92b3a8833eba(
    p_partner_id,p_hotel_id,current_date,current_date+30);
  v_state:=(CASE WHEN (p_read_context#>>ARRAY[''public.hotel_v2_seven_arches_reviewed_pricing_current_state'',''is_null''])::boolean THEN NULL::jsonb ELSE p_read_context#>ARRAY[''public.hotel_v2_seven_arches_reviewed_pricing_current_state'',''value''] END);
  v_policy:=public.hotel_v2_h3_2b_commission_policy(p_hotel_id);
  return jsonb_build_object(
    ''contract_version'',''hotels_v2_seven_arches_reviewed_pricing_partner_control_v1'',
    ''partner_id'',p_partner_id,''hotel_id'',p_hotel_id,
    ''assignment_id'',(v_access->>''assignment_id'')::uuid,
    ''assignment_version'',(v_access->>''permission_version'')::bigint,
    ''access_snapshot_token'',public.hotel_v2_h3_2b_hash(v_access),
    ''pricing_snapshot_token'',v_workspace#>>''{pricing,snapshot_token}'',
    ''evolution_snapshot_token'',v_state->>''snapshot_token'',
    ''commission_policy'',jsonb_build_object(
      ''commission_mode'',v_policy->>''commission_mode'',
      ''amount'',(v_policy->>''amount'')::numeric,''currency'',v_policy->>''currency''),
    ''current_items'',coalesce((select jsonb_agg(jsonb_build_object(
      ''room_key'',authority.room_key,''hotel_id'',authority.hotel_id,
      ''room_type_id'',authority.room_type_id,''room_rate_id'',authority.room_rate_id,
      ''pricing_schedule_id'',authority.independent_schedule_id,
      ''schedule_tier_id'',authority.target_tier_id,
      ''guest_count'',authority.guest_count,''minimum_nights'',authority.threshold_nights,
      ''currency'',authority.currency,''current_price'',authority.current_nightly_rate,
      ''tier_version'',authority.current_target_version)
      order by authority.room_key desc,authority.guest_count,authority.threshold_nights)
      from public.hotel_seven_arches_independent_pricing_authority authority),''[]''::jsonb),
    ''proposals'',coalesce((select jsonb_agg(jsonb_build_object(
      ''proposal_id'',proposal.id,''status'',proposal.status,''reason'',proposal.reason,
      ''item_count'',proposal.item_count,
      ''created_at'',to_char(proposal.created_at at time zone ''UTC'',
        ''YYYY-MM-DD"T"HH24:MI:SS.US"Z"''),
      ''expires_at'',to_char(proposal.expires_at at time zone ''UTC'',
        ''YYYY-MM-DD"T"HH24:MI:SS.US"Z"''),
      ''consumed_at'',case when proposal.consumed_at is null then ''null''::jsonb
        else to_jsonb(to_char(proposal.consumed_at at time zone ''UTC'',
          ''YYYY-MM-DD"T"HH24:MI:SS.US"Z"'')) end)
      order by proposal.created_at desc,proposal.id)
      from public.hotel_seven_arches_reviewed_pricing_proposals proposal
      where proposal.partner_id=p_partner_id
        and proposal.assignment_id=(v_access->>''assignment_id'')::uuid),''[]''::jsonb));
end
';
ALTER FUNCTION hotels_published_architecture_private.foundation_386f62cfcab6d04b(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_386f62cfcab6d04b(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_fcff56fd50f3800b() RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS '
begin
  if (select count(*)
      from public.hotel_seven_arches_independent_pricing_evolution_receipts)<>1 then
    return false;
  end if;
  return coalesce(
    hotels_published_architecture_private.foundation_f46b02a57427361e(),false);
end
';
ALTER FUNCTION hotels_published_architecture_private.foundation_fcff56fd50f3800b() OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_fcff56fd50f3800b() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_f71a2082db64feeb() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS '
declare v_result jsonb:=public.hotel_v2_h3_2b_protected_fingerprints();
  v_legacy jsonb; v_phase1 jsonb; v_key text;
begin
  v_result:=v_result||jsonb_build_object(
    ''hotels'',md5(pg_catalog.query_to_xml($query$
      select case when hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid then
        (to_jsonb(hotel)-array[''title'',''title_i18n'',''description'',''description_i18n'',''city'',
          ''address_line'',''district'',''postal_code'',''country'',''latitude'',''longitude'',
          ''google_maps_url'',''amenities'',''check_in_from'',''check_out_until'',
          ''cover_image_url'',''photos'',''updated_at''])::text
        else to_jsonb(hotel)::text end
      from public.hotels hotel order by hotel.id$query$,true,true,'''')::text),
    ''non_h3_2b_activity'',md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text from public.hotel_activity_log activity
      where activity.source is distinct from ''hotels_v2_h3_2b_partner_workspace''
        and activity.source is distinct from ''hotels_v2_h3_2b_property_proposal_admin_review''
        and activity.source is distinct from
          ''hotels_v2_seven_arches_reviewed_pricing_admin''
        and not (activity.source=''hotels_v2_admin_b_property_control'' and exists(
          select 1 from public.hotel_partner_property_proposal_admin_reviews review
          where review.action=''accept''
            and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'''')::text));
  v_legacy:=public.hotel_v2_seven_arches_independent_pricing_legacy_projection();
  if v_legacy is not null then
    foreach v_key in array array[''hotel_room_rates_protected'',
      ''hotel_pricing_schedules'',''hotel_schedule_tiers_protected''] loop
      v_result:=jsonb_set(v_result,array[v_key],
        v_legacy#>array[''property'',v_key],false);
    end loop;
  end if;
  if hotels_published_architecture_private.foundation_7546feecb3da2c1b() then
    select foundation.phase1_property_fingerprints into strict v_phase1
    from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
    where foundation.id=1;
    foreach v_key in array array[''hotels'',''hotel_room_rates_protected'',
      ''hotel_pricing_schedules'',''hotel_schedule_tiers_protected''] loop
      if v_result->v_key is null or v_phase1->v_key is null then
        return null;
      end if;
      v_result:=jsonb_set(v_result,array[v_key],v_phase1->v_key,false);
    end loop;
  end if;
  return v_result;
exception when no_data_found or too_many_rows then
  return null;
end;
';
ALTER FUNCTION hotels_published_architecture_private.foundation_f71a2082db64feeb() OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_f71a2082db64feeb() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_18dc3c81f0b8a4c4() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS '
declare
  -- Read-only STABLE inputs: one evaluation per invocation/snapshot; never cached across calls.
  v_lifecycle_once_0 constant boolean:=public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();
  v_raw_task2 jsonb;
  v_raw_stage2 jsonb;
  v_task2 jsonb;
  v_stage2 jsonb;
  v_locked_task2 jsonb;
  v_locked_stage2 jsonb;
  v_locked_stage2_compatible jsonb;
  v_locked_lifecycle_fingerprint text;
  v_transaction_task2 jsonb;
  v_scoped_lineage jsonb;
  v_lifecycle jsonb;
  v_lifecycle_fingerprint text;
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_original public.hotel_admin_availability_foundation_receipts%rowtype;
  v_task2_foundation public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_task2_receipt record;
  v_foundation hotels_v2_private.hotel_external_calendar_foundation_receipts%rowtype;
  v_activation hotels_v2_private.hotel_external_calendar_activation_receipts%rowtype;
  v_context public.hotel_seven_arches_pricing_activation_transaction_context%rowtype;
  v_inflight_review public.hotel_seven_arches_pricing_activation_reviews%rowtype;
  v_inflight_admin_receipt public.hotel_admin_pricing_action_receipts%rowtype;
  v_inflight_activity_ids uuid[];
  v_rate_plan_before jsonb;
  v_schedule_before jsonb;
  v_upper_rate_before jsonb;
  v_ground_rate_before jsonb;
  v_expected_original jsonb;
  v_provider record;
  v_provider_prior jsonb;
  v_provider_receipt_count integer:=0;
  v_task2_receipt_count integer:=0;
  v_pricing_activation_count integer:=0;
  v_visible_context_count integer:=0;
  v_current_context_count integer:=0;
  v_inflight_exact boolean:=false;
  v_provider_oid oid:=to_regprocedure(
    ''public.hotel_v2_external_calendar_provider_sources_are_attributable()'');
  v_context_guard_oid oid:=to_regprocedure(
    ''public.hotel_v2_seven_arches_pricing_activation_context_guard()'');
  v_review_guard_oid oid:=to_regprocedure(
    ''public.hotel_v2_seven_arches_pricing_activation_review_guard()'');
  v_freeze_guard_oid oid:=to_regprocedure(
    ''public.hotel_v2_admin_c_h3_1p_freeze_trigger()'');
  v_admin_receipt_guard_oid oid:=to_regprocedure(
    ''public.hotel_v2_admin_c_pricing_receipt_immutable_trigger()'');
  v_apply_oid oid:=to_regprocedure(
    ''public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)'');
begin
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings setting where setting.id=1
       and hotels_lifecycle_private.predecessor_flag_exact(''hotel_rooms_v2_enabled'',setting.hotel_rooms_v2_enabled)
       and setting.hotel_external_sync_enabled is not null
       and setting.hotel_instant_booking_enabled is not distinct from false
       and hotels_lifecycle_private.predecessor_flag_exact(''hotel_stripe_connect_enabled'',setting.hotel_stripe_connect_enabled))
     or (select count(*)
       from public.hotel_admin_availability_foundation_evolution_receipts)<>1
     or (select count(*)
       from public.hotel_admin_availability_foundation_receipts)<>1
     or (select count(*)
       from public.hotel_partner_workspace_foundation_receipts)<>1
     or (select count(*)
       from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or (select count(*)
       from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or (select count(*)
       from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or v_scoped_lineage is null
     or public.hotel_v2_partner_workspace_function_lineage_is_exact() is not true then
    return null;
  end if;
  select * into strict v_owner
  from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  select * into strict v_original
  from public.hotel_admin_availability_foundation_receipts where id=1;
  select * into strict v_task2_foundation
  from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  select * into strict v_foundation
  from hotels_v2_private.hotel_external_calendar_foundation_receipts where id=1;
  select * into strict v_activation
  from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1;
  if v_original.id is distinct from 1
     or v_original.protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_original.protected_fingerprints)
     or v_owner.id is distinct from 1
     or v_owner.contract_version is distinct from
       ''hotels_v2_admin_d_foundation_evolution_v2''
     or v_owner.original_foundation_receipt_id is distinct from v_original.id
     or v_owner.original_protected_fingerprint is distinct from
       v_original.protected_fingerprint
     or v_owner.before_current_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_owner.before_current_protected_fingerprints)
     or v_owner.current_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_owner.current_protected_fingerprints)
     or v_owner.stage2_before_current_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_owner.stage2_before_current_protected_fingerprints)
     or v_owner.stage2_current_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_owner.stage2_current_protected_fingerprints)
     or v_owner.allowed_fingerprint_keys is distinct from array[
       ''hotel_partner_hotel_permissions'',''hotel_partner_action_receipts'',
       ''hotel_partner_event_outbox'',''non_admin_d_activity'']::text[]
     or v_owner.stage2_allowed_fingerprint_keys is distinct from array[
       ''hotel_partner_hotel_permissions'',''non_external_calendar_activity'',
       ''non_external_calendar_partner_receipts'']::text[]
     or (v_owner.current_protected_fingerprints-v_owner.allowed_fingerprint_keys)
       is distinct from
       (v_owner.before_current_protected_fingerprints-v_owner.allowed_fingerprint_keys)
     or (v_owner.stage2_current_protected_fingerprints-
       v_owner.stage2_allowed_fingerprint_keys) is distinct from
       (v_owner.stage2_before_current_protected_fingerprints-
       v_owner.stage2_allowed_fingerprint_keys)
     or exists(select 1 from unnest(v_owner.allowed_fingerprint_keys) changed(key)
       where v_owner.current_protected_fingerprints->changed.key is not distinct from
         v_owner.before_current_protected_fingerprints->changed.key)
     or exists(select 1 from unnest(v_owner.stage2_allowed_fingerprint_keys) changed(key)
       where v_owner.stage2_current_protected_fingerprints->changed.key is not distinct from
         v_owner.stage2_before_current_protected_fingerprints->changed.key)
     or v_task2_foundation.id is distinct from 1
     or not exists(select 1
       from public.hotel_partner_workspace_foundation_receipts partner_foundation
       where partner_foundation.id=1
         and partner_foundation.protected_fingerprint=
           public.hotel_v2_h3_2b_hash(partner_foundation.protected_fingerprints)
         and v_task2_foundation.original_h3_2b_foundation_fingerprint
           is not distinct from partner_foundation.protected_fingerprint)
     or v_task2_foundation.owner_evolution_receipt_id is distinct from v_owner.id
     or v_task2_foundation.owner_evolution_receipt_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(v_owner),''{created_at}'',
         to_jsonb(extract(epoch from v_owner.created_at)),false))
     or v_task2_foundation.protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_task2_foundation.protected_fingerprints)
     or v_task2_foundation.stage2_compatibility_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
         ''public.hotel_v2_external_calendar_stage2_compatible_fingerprints()''::regprocedure)))
     or v_provider_oid is null
     or (v_task2_foundation.provider_source_attribution_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(v_provider_oid)))
       and not v_lifecycle_once_0)
     or v_foundation.id is distinct from 1
     or v_foundation.protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(v_foundation.protected_fingerprints)
     or v_activation.id is distinct from 1
     or v_activation.created_at is null or not isfinite(v_activation.created_at)
     or (v_activation.site_settings_without_external_fingerprint
       ~''^[0-9a-f]{64}$'') is distinct from true
     or jsonb_typeof(v_activation.compatibility_function_fingerprints)
       is distinct from ''object'' then
    return null;
  end if;
  if (select count(*) from jsonb_object_keys(
       v_activation.compatibility_function_fingerprints))<>20
     or (v_activation.compatibility_function_fingerprints ?& array[
       ''public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)'',
       ''public.hotel_v2_partner_list_assigned_properties(uuid)'',
       ''public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)'',
       ''public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)'',
       ''public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)'',
       ''public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)'',
       ''public.hotel_v2_admin_get_content_control(uuid)'',
       ''public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)'',
       ''public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)'',
       ''public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)'',
       ''public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)'',
       ''public.hotel_v2_h3_2b_flags_off()'',
       ''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'',
       ''public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)'',
       ''public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)'',
       ''public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)'',
       ''public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)'',
       ''public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)'',
       ''public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)'',
       ''public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)''
     ]::text[]) is distinct from true
     or exists(select 1 from jsonb_each_text(
       v_activation.compatibility_function_fingerprints) fingerprint(signature,value)
       where (fingerprint.value~''^[0-9a-f]{64}$'') is distinct from true) then
    return null;
  end if;

  -- Stage2F is historical compatibility evidence, not authority over the
  -- mutable site_settings row.  Pin its exact immutable catalog and function
  -- security without comparing the historical row-wide settings fingerprint
  -- to current metadata.
  if not exists(select 1 from pg_class relation where relation.oid=
       ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
       and relation.relowner=''postgres''::regrole and not relation.relrowsecurity)
     or (select count(*) from pg_attribute attribute
       where attribute.attrelid=
         ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
         and attribute.attnum>0 and not attribute.attisdropped)<>4
     or exists(select 1 from (values
       (1::smallint,''id'',''smallint'',true,null::text),
       (2::smallint,''site_settings_without_external_fingerprint'',''text'',true,null::text),
       (3::smallint,''compatibility_function_fingerprints'',''jsonb'',true,null::text),
       (4::smallint,''created_at'',''timestamp with time zone'',true,''clock_timestamp()'')
     ) expected(attnum,attname,type_name,not_null,default_expression)
     left join pg_attribute attribute on attribute.attrelid=
       ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
       and attribute.attnum=expected.attnum and not attribute.attisdropped
     left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
       and default_row.adnum=attribute.attnum
     where attribute.attrelid is null
       or attribute.attname is distinct from expected.attname
       or format_type(attribute.atttypid,attribute.atttypmod)
         is distinct from expected.type_name
       or attribute.attnotnull is distinct from expected.not_null
       or attribute.attidentity is distinct from ''''
       or attribute.attgenerated is distinct from ''''
       or pg_get_expr(default_row.adbin,default_row.adrelid)
         is distinct from expected.default_expression)
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
         ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass)<>4
     or (select count(*) from pg_constraint constraint_row
       join pg_index index_row on index_row.indexrelid=constraint_row.conindid
       where constraint_row.conrelid=
           ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
         and constraint_row.contype=''p'' and constraint_row.convalidated
         and constraint_row.conkey=array[1]::smallint[]
         and pg_get_constraintdef(constraint_row.oid)=''PRIMARY KEY (id)''
         and index_row.indisprimary and index_row.indisunique
         and index_row.indisvalid and index_row.indisready)<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
         and constraint_row.contype=''c'' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[1]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           ''[[:space:]]+'','''',''g'')=''(id=1)'')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
         and constraint_row.contype=''c'' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[2]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           ''[[:space:]]+'','''',''g'')=
           ''(site_settings_without_external_fingerprint~''''^[0-9a-f]{64}$''''::text)'')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
         and constraint_row.contype=''c'' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[3]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           ''[[:space:]]+'','''',''g'')=
           ''(jsonb_typeof(compatibility_function_fingerprints)=''''object''''::text)'')<>1
     or exists(select 1 from pg_policy policy where policy.polrelid=
       ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass)
     or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
       ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
       and not trigger_row.tgisinternal)<>1
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
       and trigger_row.tgname=''hotel_external_calendar_activation_receipt_immutable''
       and trigger_row.tgfoid=
         to_regprocedure(''public.hotel_v2_h3_2a_reject_immutable_change()'')
       and trigger_row.tgtype=27 and trigger_row.tgenabled=''O''
       and not trigger_row.tgisinternal)
     or exists(select 1 from unnest(array[
       ''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER''
     ]) privilege(name) where has_table_privilege(0::oid,
         ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass,
         privilege.name)
       or has_table_privilege(''anon'',
         ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass,
         privilege.name)
       or has_table_privilege(''authenticated'',
         ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass,
         privilege.name)
       or has_table_privilege(''service_role'',
         ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass,
         privilege.name))
     or not exists(select 1 from pg_namespace namespace_row where namespace_row.oid=
       ''hotels_v2_private''::regnamespace
       and namespace_row.nspowner=''postgres''::regrole)
     or has_schema_privilege(0::oid,''hotels_v2_private'',''USAGE'')
     or has_schema_privilege(''anon'',''hotels_v2_private'',''USAGE'')
     or has_schema_privilege(''service_role'',''hotels_v2_private'',''USAGE'')
     or has_schema_privilege(0::oid,''hotels_v2_private'',''CREATE'')
     or has_schema_privilege(''anon'',''hotels_v2_private'',''CREATE'')
     or has_schema_privilege(''authenticated'',''hotels_v2_private'',''CREATE'')
     or has_schema_privilege(''service_role'',''hotels_v2_private'',''CREATE'')
     or exists(select 1 from (values
       (''public.hotel_v2_external_calendar_worker_hash(jsonb)'',true,''i''::"char",
         array[''search_path=pg_catalog'']::text[],
         ''d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828''),
       (''public.hotel_v2_external_calendar_activation_function_fingerprints()'',true,
         ''s''::"char",array[''search_path=pg_catalog, public'']::text[],
         ''fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914''),
       (''public.hotel_v2_partner_workspace_function_lineage_is_exact()'',true,
         ''s''::"char",array[''search_path=pg_catalog, public'']::text[],
         ''dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85''),
       (''public.hotel_v2_h3_2a_reject_immutable_change()'',false,''v''::"char",
         array[''search_path=pg_catalog, public'']::text[],
         ''5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c'')
     ) expected(signature,security_definer,volatility,path,source_hash)
     left join pg_proc procedure_row
       on procedure_row.oid=to_regprocedure(expected.signature)
     where procedure_row.oid is null
       or procedure_row.proowner<>''postgres''::regrole
       or procedure_row.prosecdef is distinct from expected.security_definer
       or procedure_row.provolatile is distinct from expected.volatility
       or procedure_row.proconfig is distinct from expected.path
       or encode(extensions.digest(convert_to(hotels_lifecycle_private.predecessor_source(procedure_row.oid),''UTF8''),''sha256''),''hex'')
         is distinct from expected.source_hash
       or has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
       or has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
       or has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
       or has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE'')) then
    return null;
  end if;

  if to_regclass(
       ''public.hotel_seven_arches_task2_stage2_compatibility_receipts'') is null then
    return null;
  end if;
  select count(*) into v_task2_receipt_count
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts;
  if v_task2_receipt_count>1
     or not exists(select 1 from pg_class relation where relation.oid=
       ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
       and relation.relowner=''postgres''::regrole and relation.relrowsecurity)
     or (select count(*) from pg_attribute attribute where attribute.attrelid=
       ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
       and attribute.attnum>0 and not attribute.attisdropped)<>10
     or exists(select 1 from (values
       (1::smallint,''id'',''smallint'',true,null::text),
       (2::smallint,''contract_version'',''text'',true,null::text),
       (3::smallint,''canonical_task2_protected_fingerprints'',''jsonb'',true,null::text),
       (4::smallint,''canonical_task2_protected_fingerprint'',''text'',true,null::text),
       (5::smallint,''canonical_stage2_protected_fingerprints'',''jsonb'',true,null::text),
       (6::smallint,''canonical_stage2_protected_fingerprint'',''text'',true,null::text),
       (7::smallint,''scoped_lineage_source_hash'',''text'',true,null::text),
       (8::smallint,''canonical_snapshot_source_hash'',''text'',true,null::text),
       (9::smallint,''validator_source_hash'',''text'',true,null::text),
       (10::smallint,''created_at'',''timestamp with time zone'',true,''clock_timestamp()'')
     ) expected(attnum,attname,type_name,not_null,default_expression)
     left join pg_attribute attribute on attribute.attrelid=
       ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
       and attribute.attnum=expected.attnum and not attribute.attisdropped
     left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
       and default_row.adnum=attribute.attnum
     where attribute.attrelid is null
       or attribute.attname is distinct from expected.attname
       or format_type(attribute.atttypid,attribute.atttypmod)
         is distinct from expected.type_name
       or attribute.attnotnull is distinct from expected.not_null
       or attribute.attidentity is distinct from ''''
       or attribute.attgenerated is distinct from ''''
       or pg_get_expr(default_row.adbin,default_row.adrelid)
         is distinct from expected.default_expression)
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
         ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass)<>10
     or (select count(*) from pg_constraint constraint_row
       join pg_index index_row on index_row.indexrelid=constraint_row.conindid
       where constraint_row.conrelid=
           ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
         and constraint_row.contype=''p'' and constraint_row.convalidated
         and constraint_row.conkey=array[1]::smallint[]
         and pg_get_constraintdef(constraint_row.oid)=''PRIMARY KEY (id)''
         and index_row.indisprimary and index_row.indisunique
         and index_row.indisvalid and index_row.indisready)<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
         and constraint_row.contype=''c'' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[1]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           ''[[:space:]]+'','''',''g'')=''(id=1)'')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
         and constraint_row.contype=''c'' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[2]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           ''[[:space:]]+'','''',''g'')=
           ''(contract_version=''''hotels_v2_seven_arches_task2_stage2_compatibility_v1''''::text)'')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
         and constraint_row.contype=''c'' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[3]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           ''[[:space:]]+'','''',''g'')=
           ''(jsonb_typeof(canonical_task2_protected_fingerprints)=''''object''''::text)'')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
         and constraint_row.contype=''c'' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[5]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           ''[[:space:]]+'','''',''g'')=
           ''(jsonb_typeof(canonical_stage2_protected_fingerprints)=''''object''''::text)'')<>1
     or exists(select 1 from (values
       (4::smallint,''canonical_task2_protected_fingerprint''),
       (6::smallint,''canonical_stage2_protected_fingerprint''),
       (7::smallint,''scoped_lineage_source_hash''),
       (8::smallint,''canonical_snapshot_source_hash''),
       (9::smallint,''validator_source_hash'')
     ) expected(attnum,column_name) where (select count(*)
       from pg_constraint constraint_row where constraint_row.conrelid=
         ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
         and constraint_row.contype=''c'' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[expected.attnum]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           ''[[:space:]]+'','''',''g'')=''(''||expected.column_name||
             ''~''''^[0-9a-f]{64}$''''::text)'')<>1)
     or exists(select 1 from pg_policy policy where policy.polrelid=
       ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass)
     or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
       ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
       and not trigger_row.tgisinternal)<>1
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
       and trigger_row.tgname=
         ''hotel_seven_arches_task2_stage2_compatibility_receipt_immutable''
       and trigger_row.tgfoid=
         to_regprocedure(''public.hotel_v2_seven_arches_pricing_activation_immutable()'')
       and trigger_row.tgtype=27 and trigger_row.tgenabled=''O''
       and not trigger_row.tgisinternal)
     or exists(select 1 from unnest(array[
       ''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER''
     ]) privilege(name) where has_table_privilege(0::oid,
         ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass,
         privilege.name)
       or has_table_privilege(''anon'',
         ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass,
         privilege.name)
       or has_table_privilege(''authenticated'',
         ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass,
         privilege.name)
       or has_table_privilege(''service_role'',
         ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass,
         privilege.name)) then
    return null;
  end if;
  if v_task2_receipt_count=1 and (not exists(select 1
    from public.hotel_seven_arches_task2_stage2_compatibility_receipts receipt
    where receipt.id=1
      and receipt.contract_version=
        ''hotels_v2_seven_arches_task2_stage2_compatibility_v1''
      and receipt.created_at is not null and isfinite(receipt.created_at)
      and receipt.canonical_task2_protected_fingerprint=
        public.hotel_v2_h3_2b_hash(receipt.canonical_task2_protected_fingerprints)
      and receipt.canonical_stage2_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          receipt.canonical_stage2_protected_fingerprints)
      and receipt.scoped_lineage_source_hash=public.hotel_v2_h3_2b_hash(
        to_jsonb(hotels_lifecycle_private.predecessor_definition(
          ''public.hotel_v2_seven_arches_pricing_scoped_lineage()''::regprocedure)))
      and (receipt.canonical_snapshot_source_hash=public.hotel_v2_h3_2b_hash(
        to_jsonb(hotels_lifecycle_private.predecessor_definition(
          ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure)))
        or v_lifecycle_once_0)
      and (receipt.validator_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(
        hotels_lifecycle_private.predecessor_definition(
          to_regprocedure(
            ''public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()''))))
        or v_lifecycle_once_0))
      or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
          ''public.hotel_v2_seven_arches_pricing_scoped_lineage()''::regprocedure
        and procedure_row.proowner=''postgres''::regrole
        and procedure_row.prosecdef and procedure_row.provolatile=''s''
        and procedure_row.proconfig=
          array[''search_path=pg_catalog, public'']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
        and not has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
        and not has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
        and not has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))
      or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
          ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure
        and procedure_row.proowner=''postgres''::regrole
        and procedure_row.prosecdef and procedure_row.provolatile=''s''
        and procedure_row.proconfig=
          array[''search_path=pg_catalog, public'']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
        and not has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
        and not has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
        and not has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))
      or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
          to_regprocedure(
            ''public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'')
        and procedure_row.proowner=''postgres''::regrole
        and procedure_row.prosecdef and procedure_row.provolatile=''s''
        and procedure_row.proconfig=
          array[''search_path=pg_catalog, public'']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
        and not has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
        and not has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
        and not has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))) then
    return null;
  end if;

  -- This object is intentionally byte-equivalent to the 114425 lifecycle v2
  -- contract.  OFF and ON are both supported only after the live non-NULL flag
  -- and the immutable Stage2F evidence above have been proved.
  v_lifecycle:=jsonb_build_object(
    ''contract_version'',''hotels_v2_external_calendar_site_settings_lifecycle_v2'',
    ''id'',1,
    ''hotel_rooms_v2_enabled'',false,
    ''hotel_external_sync_enabled_supported_values'',jsonb_build_array(false,true),
    ''hotel_instant_booking_enabled'',false,
    ''hotel_stripe_connect_enabled'',false);
  v_lifecycle_fingerprint:=
    public.hotel_v2_external_calendar_worker_hash(v_lifecycle);
  if v_lifecycle_fingerprint is null then return null; end if;

  v_raw_task2:=public.hotel_v2_h3_2b_protected_fingerprints();
  v_raw_stage2:=public.hotel_v2_external_calendar_protected_fingerprints();
  if v_raw_task2 is null or v_raw_stage2 is null
     or v_raw_task2->''site_settings'' is null
     or v_raw_stage2->''site_settings'' is null then
    return null;
  end if;

  -- Exact Task2 success projection from 114370, without its broad
  -- site_settings member.
  v_task2:=v_raw_task2||jsonb_build_object(
    ''hotels'',md5(pg_catalog.query_to_xml($query$
      select case when hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid then
        (to_jsonb(hotel)-array[''title'',''title_i18n'',''description'',''description_i18n'',''city'',
          ''address_line'',''district'',''postal_code'',''country'',''latitude'',''longitude'',
          ''google_maps_url'',''amenities'',''check_in_from'',''check_out_until'',
          ''cover_image_url'',''photos'',''updated_at''])::text
        else to_jsonb(hotel)::text end
      from public.hotels hotel order by hotel.id$query$,true,true,'''')::text),
    ''non_h3_2b_activity'',md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text from public.hotel_activity_log activity
      where activity.source is distinct from ''hotels_v2_h3_2b_partner_workspace''
        and activity.source is distinct from ''hotels_v2_h3_2b_property_proposal_admin_review''
        and not (activity.source=''hotels_v2_admin_b_property_control'' and exists(
          select 1 from public.hotel_partner_property_proposal_admin_reviews review
          where review.action=''accept''
            and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'''')::text));
  v_task2:=jsonb_set(v_task2,''{site_settings}'',
    to_jsonb(v_lifecycle_fingerprint),false);

  -- Exact Stage2 success projection from 114370.  Its prerequisite validation
  -- remains in the callers; this lower-layer function performs no upward call.
  v_stage2:=jsonb_set(jsonb_set(jsonb_set(v_raw_stage2,''{hotels}'',
      v_owner.stage2_current_protected_fingerprints->''hotels'',false),
    ''{site_settings}'',to_jsonb(v_lifecycle_fingerprint),false),
    ''{non_external_calendar_activity}'',to_jsonb(md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text from public.hotel_activity_log activity
      where activity.source is distinct from ''hotels_v2_external_calendar_control''
        and activity.source is distinct from ''hotels_v2_h3_2b_partner_workspace''
        and activity.source is distinct from ''hotels_v2_h3_2b_property_proposal_admin_review''
        and not (activity.source=''hotels_v2_admin_b_property_control'' and exists(
          select 1 from public.hotel_partner_property_proposal_admin_reviews review
          where review.action=''accept''
            and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'''')::text)),false)
    ||jsonb_build_object(''non_external_calendar_partner_receipts'',md5(
      pg_catalog.query_to_xml($query$
        select to_jsonb(receipt)::text from public.hotel_partner_action_receipts receipt
        where receipt.action not in(''h3_2b_content'',''h3_2b_pricing'',''h3_2b_availability'',
          ''h3_2d_external_calendar'') order by receipt.id$query$,true,true,'''')::text));

  if to_regclass(
      ''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'') is not null then
    execute ''select count(*) from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts''
      into v_provider_receipt_count;
    if v_provider_receipt_count>1 then return null; end if;
    if v_provider_receipt_count=1 then
      execute ''select * from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts where id=1''
        into strict v_provider;
      v_provider_prior:=v_provider.prior_compatible_fingerprints;
      if v_provider.id is distinct from 1
         or v_provider.original_foundation_fingerprint is distinct from
           v_foundation.protected_fingerprint
         or v_provider.original_protected_fingerprints is distinct from
           v_foundation.protected_fingerprints
         or v_provider.prior_compatible_fingerprint is distinct from
           public.hotel_v2_external_calendar_worker_hash(v_provider_prior)
         or v_provider_prior->''non_ical_calendar_sources'' is null
         or v_task2_foundation.protected_fingerprints->
           ''hotel_calendar_source_configs'' is null
         or (v_task2_foundation.provider_source_attribution_source_hash is distinct from
           public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(v_provider_oid)))
           and not v_lifecycle_once_0)
         or v_provider.evolution_helper_fingerprints->>
           ''public.hotel_v2_external_calendar_provider_sources_are_attributable()''
           is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
             hotels_lifecycle_private.predecessor_definition(v_provider_oid)))
         or not exists(select 1 from pg_proc procedure_row
           where procedure_row.oid=v_provider_oid
             and procedure_row.proowner=''postgres''::regrole
             and procedure_row.prosecdef and procedure_row.provolatile=''s''
             and procedure_row.proconfig=
               array[''search_path=pg_catalog, public'']::text[]
             and not has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
             and not has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
             and not has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
             and not has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))
         or not exists(select 1 from pg_class relation where relation.oid=
           ''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts''::regclass
           and relation.relowner=''postgres''::regrole and not relation.relrowsecurity)
         or exists(select 1 from pg_policy policy where policy.polrelid=
           ''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts''::regclass)
         or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
           ''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts''::regclass
           and not trigger_row.tgisinternal)<>1
         or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
           ''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts''::regclass
           and trigger_row.tgname=
             ''hotel_external_calendar_provider_evolution_receipt_immutable''
           and trigger_row.tgfoid=
             to_regprocedure(''public.hotel_v2_h3_2a_reject_immutable_change()'')
           and trigger_row.tgtype=27 and trigger_row.tgenabled=''O''
           and not trigger_row.tgisinternal)
         or exists(select 1 from unnest(array[
           ''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER''
         ]) privilege(name) where has_table_privilege(0::oid,
             ''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts''::regclass,
             privilege.name)
           or has_table_privilege(''anon'',
             ''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts''::regclass,
             privilege.name)
           or has_table_privilege(''authenticated'',
             ''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts''::regclass,
             privilege.name)
           or has_table_privilege(''service_role'',
             ''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts''::regclass,
             privilege.name))
         or public.hotel_v2_external_calendar_provider_sources_are_attributable()
           is not true then
        return null;
      end if;
      v_task2:=jsonb_set(v_task2,''{hotel_calendar_source_configs}'',
        v_task2_foundation.protected_fingerprints->
          ''hotel_calendar_source_configs'',false);
      v_stage2:=jsonb_set(v_stage2,''{non_ical_calendar_sources}'',
        v_provider_prior->''non_ical_calendar_sources'',false);
    end if;
  end if;

  select count(*) into v_pricing_activation_count
  from public.hotel_seven_arches_pricing_activation_evolution_receipts;
  if v_pricing_activation_count>1 then return null; end if;
  if v_pricing_activation_count=0 then
    select count(*),count(*) filter(where transaction_id=txid_current())
      into v_visible_context_count,v_current_context_count
    from public.hotel_seven_arches_pricing_activation_transaction_context;
    if v_visible_context_count=0 and v_current_context_count=0 then
      if v_task2_receipt_count=0 then
        -- Installation bootstrap: the current baseline was captured only
        -- after the complete protected relation universe was locked.  The
        -- temporary relation is deliberately unreachable after COMMIT.
        if to_regclass(
             ''pg_temp.seven_arches_pricing_activation_locked_baseline'') is null then
          return null;
        end if;
        execute $sql$
          select property_fingerprints,stage2_fingerprints,
            stage2_compatible_fingerprints,
            site_settings_lifecycle_fingerprint
          from pg_temp.seven_arches_pricing_activation_locked_baseline
        $sql$
        into strict v_locked_task2,v_locked_stage2,v_locked_stage2_compatible,
          v_locked_lifecycle_fingerprint;
        if v_locked_lifecycle_fingerprint is distinct from v_lifecycle_fingerprint
           or v_task2 is distinct from jsonb_set(
             v_locked_task2,''{site_settings}'',to_jsonb(v_lifecycle_fingerprint),false)
           or v_stage2 is distinct from jsonb_set(
             v_locked_stage2_compatible,''{site_settings}'',
             to_jsonb(v_lifecycle_fingerprint),false) then
          return null;
        end if;
      else
        -- After installation the immutable compatibility receipt, rather
        -- than the superseded historical maps, is the canonical pre-activation
        -- baseline.  Every member remains bound; only site_settings has the
        -- independently proved lifecycle representation.
        select * into strict v_task2_receipt
        from public.hotel_seven_arches_task2_stage2_compatibility_receipts
        where id=1;
        if v_task2_receipt.canonical_task2_protected_fingerprint is distinct from
             public.hotel_v2_h3_2b_hash(
               v_task2_receipt.canonical_task2_protected_fingerprints)
           or v_task2_receipt.canonical_stage2_protected_fingerprint is distinct from
             public.hotel_v2_external_calendar_worker_hash(
               v_task2_receipt.canonical_stage2_protected_fingerprints)
           or v_task2_receipt.scoped_lineage_source_hash is distinct from
             public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
               ''public.hotel_v2_seven_arches_pricing_scoped_lineage()''::regprocedure)))
           or (v_task2_receipt.canonical_snapshot_source_hash is distinct from
             public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
               ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure)))
             and not v_lifecycle_once_0) then
          return null;
        end if;
      end if;
    elsif v_visible_context_count=1 and v_current_context_count=1
          and v_task2_receipt_count=1 then
      -- The only count-zero exception is the persisted, typed Apply context,
      -- recognized solely by the current transaction id and linked evidence.
      select * into v_context
      from public.hotel_seven_arches_pricing_activation_transaction_context
      where transaction_id=txid_current();
      if (select count(*) from public.hotel_seven_arches_pricing_activation_reviews
            where id=v_context.review_id)<>1
         or (select count(*) from public.hotel_admin_pricing_action_receipts
            where correlation_id=v_context.correlation_id)<>1
         or (select count(*)
            from public.hotel_seven_arches_task2_stage2_compatibility_receipts
            where id=1)<>1
         or exists(select 1 from (values
              (''rate_plan''::text,
                ''22e47a63-a630-4fb6-8f43-816f2d3fdc17''::uuid),
              (''pricing_schedule'',
                ''b0a3104f-7b31-5265-a59f-c2d166f11a23''::uuid),
              (''room_rate'',''7e420964-9cbf-4f1b-abd3-09840af5240f''::uuid),
              (''room_rate'',''3320590d-632d-423f-80d0-fd021cba7293''::uuid)
            ) expected(entity_type,entity_id)
            where (select count(*) from public.hotel_activity_log activity
              where activity.correlation_id=v_context.correlation_id
                and activity.entity_type=expected.entity_type
                and activity.entity_id=expected.entity_id)<>1) then
        return null;
      end if;
      select * into v_inflight_review
      from public.hotel_seven_arches_pricing_activation_reviews
      where id=v_context.review_id;
      select * into v_inflight_admin_receipt
      from public.hotel_admin_pricing_action_receipts
      where correlation_id=v_context.correlation_id;
      select * into v_task2_receipt
      from public.hotel_seven_arches_task2_stage2_compatibility_receipts
      where id=1;
      select array_agg(activity.id order by activity.entity_type,activity.entity_id)
        into v_inflight_activity_ids
      from public.hotel_activity_log activity
      where activity.correlation_id=v_context.correlation_id
        and activity.hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and activity.actor_type=''admin'' and activity.actor_id=v_context.actor_id
        and activity.action=''update''
        and activity.source=''hotels_v2_seven_arches_pricing_activation'';
      select activity.before_state into v_rate_plan_before
      from public.hotel_activity_log activity
      where activity.correlation_id=v_context.correlation_id
        and activity.entity_type=''rate_plan''
        and activity.entity_id=''22e47a63-a630-4fb6-8f43-816f2d3fdc17''::uuid;
      select activity.before_state into v_schedule_before
      from public.hotel_activity_log activity
      where activity.correlation_id=v_context.correlation_id
        and activity.entity_type=''pricing_schedule''
        and activity.entity_id=''b0a3104f-7b31-5265-a59f-c2d166f11a23''::uuid;
      select activity.before_state into v_upper_rate_before
      from public.hotel_activity_log activity
      where activity.correlation_id=v_context.correlation_id
        and activity.entity_type=''room_rate''
        and activity.entity_id=''7e420964-9cbf-4f1b-abd3-09840af5240f''::uuid;
      select activity.before_state into v_ground_rate_before
      from public.hotel_activity_log activity
      where activity.correlation_id=v_context.correlation_id
        and activity.entity_type=''room_rate''
        and activity.entity_id=''3320590d-632d-423f-80d0-fd021cba7293''::uuid;
      v_expected_original:=jsonb_build_object(
        ''rate_plan'',jsonb_build_object(
          ''id'',v_rate_plan_before->''id'',''version'',v_rate_plan_before->''version'',
          ''name_i18n'',v_rate_plan_before->''name_i18n'',
          ''description_i18n'',v_rate_plan_before->''description_i18n'',
          ''cancellation_policy'',v_rate_plan_before->''cancellation_policy'',
          ''is_active'',v_rate_plan_before->''is_active'',
          ''review_status'',v_rate_plan_before->''review_status''),
        ''room_rates'',jsonb_build_array(
          jsonb_build_object(
            ''id'',v_upper_rate_before->''id'',
            ''room_type_id'',v_upper_rate_before->''room_type_id'',
            ''base_nightly_rate'',v_upper_rate_before->''base_nightly_rate'',
            ''currency'',v_upper_rate_before->''currency'',
            ''is_active'',v_upper_rate_before->''is_active'',
            ''review_status'',v_upper_rate_before->''review_status'',
            ''version'',v_upper_rate_before->''version''),
          jsonb_build_object(
            ''id'',v_ground_rate_before->''id'',
            ''room_type_id'',v_ground_rate_before->''room_type_id'',
            ''base_nightly_rate'',v_ground_rate_before->''base_nightly_rate'',
            ''currency'',v_ground_rate_before->''currency'',
            ''is_active'',v_ground_rate_before->''is_active'',
            ''review_status'',v_ground_rate_before->''review_status'',
            ''version'',v_ground_rate_before->''version'')),
        ''shared_schedule'',jsonb_build_object(
          ''id'',v_schedule_before->''id'',''version'',v_schedule_before->''version'',
          ''name_i18n'',v_schedule_before->''name_i18n'',
          ''is_active'',v_schedule_before->''is_active'',
          ''review_status'',v_schedule_before->''review_status'',''active_tier_count'',27),
        ''preview_schedule'',(select jsonb_build_object(
          ''id'',schedule.id,''version'',schedule.version,''is_active'',schedule.is_active,
          ''review_status'',schedule.review_status)
          from public.hotel_pricing_schedules schedule
          where schedule.id=''443065c0-984a-5de3-a22a-d03042c41107''::uuid
            and schedule.hotel_id=
              ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid));

      v_transaction_task2:=
        hotels_published_architecture_private.foundation_f71a2082db64feeb();
      v_inflight_exact:=coalesce((
        v_context_guard_oid is not null and v_review_guard_oid is not null
        and exists(select 1 from pg_class relation where relation.oid=
          ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass
          and relation.relowner=''postgres''::regrole and relation.relrowsecurity)
        and exists(select 1 from pg_class relation where relation.oid=
          ''public.hotel_seven_arches_pricing_activation_reviews''::regclass
          and relation.relowner=''postgres''::regrole and relation.relrowsecurity)
        and (select count(*) from pg_attribute attribute where attribute.attrelid=
          ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass
          and attribute.attnum>0 and not attribute.attisdropped)=9
        and not exists(select 1 from (values
          (1::smallint,''backend_pid'',''integer'',true,null::text),
          (2::smallint,''transaction_id'',''bigint'',true,null::text),
          (3::smallint,''review_id'',''uuid'',true,null::text),
          (4::smallint,''actor_id'',''uuid'',true,null::text),
          (5::smallint,''correlation_id'',''uuid'',true,null::text),
          (6::smallint,''before_protected_fingerprints'',''jsonb'',true,null::text),
          (7::smallint,''before_stage2_protected_fingerprints'',''jsonb'',true,null::text),
          (8::smallint,''applied_entity_ids'',''uuid[]'',true,''''''{}''''::uuid[]''),
          (9::smallint,''created_at'',''timestamp with time zone'',true,''clock_timestamp()'')
        ) expected(attnum,attname,type_name,not_null,default_expression)
        left join pg_attribute attribute on attribute.attrelid=
          ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass
          and attribute.attnum=expected.attnum and not attribute.attisdropped
        left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
          and default_row.adnum=attribute.attnum
        where attribute.attrelid is null
          or attribute.attname is distinct from expected.attname
          or format_type(attribute.atttypid,attribute.atttypmod)
            is distinct from expected.type_name
          or attribute.attnotnull is distinct from expected.not_null
          or attribute.attidentity is distinct from ''''
          or attribute.attgenerated is distinct from ''''
          or pg_get_expr(default_row.adbin,default_row.adrelid)
            is distinct from expected.default_expression)
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
            ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass)=5
        and (select count(*) from pg_constraint constraint_row
          join pg_index index_row on index_row.indexrelid=constraint_row.conindid
          where constraint_row.conrelid=
              ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass
            and constraint_row.contype=''p'' and constraint_row.convalidated
            and constraint_row.conkey=array[1]::smallint[]
            and pg_get_constraintdef(constraint_row.oid)=''PRIMARY KEY (backend_pid)''
            and index_row.indisprimary and index_row.indisunique
            and index_row.indisvalid and index_row.indisready)=1
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
            ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass
          and constraint_row.contype=''f'' and constraint_row.convalidated
          and not constraint_row.condeferrable and constraint_row.conkey=array[3]::smallint[]
          and constraint_row.confrelid=
            ''public.hotel_seven_arches_pricing_activation_reviews''::regclass
          and constraint_row.confkey=array[1]::smallint[]
          and constraint_row.confupdtype=''a'' and constraint_row.confdeltype=''r'')=1
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
            ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass
          and constraint_row.contype=''c'' and constraint_row.convalidated
          and not constraint_row.connoinherit
          and constraint_row.conkey=array[8]::smallint[]
          and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
            ''[[:space:]]+'','''',''g'')=
            ''((cardinality(applied_entity_ids)<=4)AND(applied_entity_ids<@ARRAY[''||
            ''''''22e47a63-a630-4fb6-8f43-816f2d3fdc17''''::uuid,''||
            ''''''b0a3104f-7b31-5265-a59f-c2d166f11a23''''::uuid,''||
            ''''''7e420964-9cbf-4f1b-abd3-09840af5240f''''::uuid,''||
            ''''''3320590d-632d-423f-80d0-fd021cba7293''''::uuid]))'')=1
        and not exists(select 1 from (values
          (6::smallint,''before_protected_fingerprints''),
          (7::smallint,''before_stage2_protected_fingerprints'')
        ) expected(attnum,column_name) where (select count(*)
          from pg_constraint constraint_row where constraint_row.conrelid=
            ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass
            and constraint_row.contype=''c'' and constraint_row.convalidated
            and not constraint_row.connoinherit
            and constraint_row.conkey=array[expected.attnum]::smallint[]
            and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
              ''[[:space:]]+'','''',''g'')=''(jsonb_typeof(''||expected.column_name||
                '')=''''object''''::text)'')<>1)
        and (select count(*) from pg_attribute attribute where attribute.attrelid=
          ''public.hotel_seven_arches_pricing_activation_reviews''::regclass
          and attribute.attnum>0 and not attribute.attisdropped)=14
        and not exists(select 1 from (values
          (1::smallint,''id'',''uuid'',true,null::text),
          (2::smallint,''contract_version'',''text'',true,null::text),
          (3::smallint,''hotel_id'',''uuid'',true,null::text),
          (4::smallint,''actor_id'',''uuid'',true,null::text),
          (5::smallint,''snapshot_token'',''text'',true,null::text),
          (6::smallint,''plan_fingerprint'',''text'',true,null::text),
          (7::smallint,''reviewed_plan'',''jsonb'',true,null::text),
          (8::smallint,''reviewed_at'',''timestamp with time zone'',true,null::text),
          (9::smallint,''expires_at'',''timestamp with time zone'',true,null::text),
          (10::smallint,''consumed_at'',''timestamp with time zone'',false,null::text),
          (11::smallint,''consumed_correlation_id'',''uuid'',false,null::text),
          (12::smallint,''consumed_idempotency_key'',''text'',false,null::text),
          (13::smallint,''result'',''jsonb'',false,null::text),
          (14::smallint,''created_at'',''timestamp with time zone'',true,''clock_timestamp()'')
        ) expected(attnum,attname,type_name,not_null,default_expression)
        left join pg_attribute attribute on attribute.attrelid=
          ''public.hotel_seven_arches_pricing_activation_reviews''::regclass
          and attribute.attnum=expected.attnum and not attribute.attisdropped
        left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
          and default_row.adnum=attribute.attnum
        where attribute.attrelid is null
          or attribute.attname is distinct from expected.attname
          or format_type(attribute.atttypid,attribute.atttypmod)
            is distinct from expected.type_name
          or attribute.attnotnull is distinct from expected.not_null
          or attribute.attidentity is distinct from ''''
          or attribute.attgenerated is distinct from ''''
          or pg_get_expr(default_row.adbin,default_row.adrelid)
            is distinct from expected.default_expression)
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
            ''public.hotel_seven_arches_pricing_activation_reviews''::regclass)=10
        and (select count(*) from pg_constraint constraint_row
          join pg_index index_row on index_row.indexrelid=constraint_row.conindid
          where constraint_row.conrelid=
              ''public.hotel_seven_arches_pricing_activation_reviews''::regclass
            and constraint_row.contype=''p'' and constraint_row.convalidated
            and constraint_row.conkey=array[1]::smallint[]
            and pg_get_constraintdef(constraint_row.oid)=''PRIMARY KEY (id)''
            and index_row.indisprimary and index_row.indisunique
            and index_row.indisvalid and index_row.indisready)=1
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
            ''public.hotel_seven_arches_pricing_activation_reviews''::regclass
          and constraint_row.contype=''f'' and constraint_row.convalidated
          and not constraint_row.condeferrable and constraint_row.conkey=array[3]::smallint[]
          and constraint_row.confrelid=''public.hotels''::regclass
          and constraint_row.confkey=array[1]::smallint[]
          and constraint_row.confupdtype=''a'' and constraint_row.confdeltype=''r'')=1
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
            ''public.hotel_seven_arches_pricing_activation_reviews''::regclass
          and constraint_row.contype=''u'' and constraint_row.convalidated
          and constraint_row.conkey=array[11]::smallint[])=1
        and not exists(select 1 from (values
          (array[2]::smallint[]),(array[3]::smallint[]),(array[5]::smallint[]),
          (array[6]::smallint[]),(array[7]::smallint[]),(array[9,8]::smallint[]),
          (array[10,11,12,13]::smallint[])
        ) expected(conkey) where (select count(*) from pg_constraint constraint_row
          where constraint_row.conrelid=
            ''public.hotel_seven_arches_pricing_activation_reviews''::regclass
            and constraint_row.contype=''c'' and constraint_row.convalidated
            and not constraint_row.connoinherit
            and constraint_row.conkey=expected.conkey)<>1)
        and not exists(select 1 from pg_policy policy where policy.polrelid in(
          ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass,
          ''public.hotel_seven_arches_pricing_activation_reviews''::regclass))
        and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
          ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass
          and not trigger_row.tgisinternal)=1
        and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
          ''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass
          and trigger_row.tgname=''hotel_seven_arches_pricing_activation_context_guard''
          and trigger_row.tgfoid=v_context_guard_oid and trigger_row.tgtype=23
          and trigger_row.tgenabled=''O'' and not trigger_row.tgisinternal)
        and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
          ''public.hotel_seven_arches_pricing_activation_reviews''::regclass
          and not trigger_row.tgisinternal)=1
        and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
          ''public.hotel_seven_arches_pricing_activation_reviews''::regclass
          and trigger_row.tgname=''hotel_seven_arches_pricing_activation_review_guard''
          and trigger_row.tgfoid=v_review_guard_oid and trigger_row.tgtype=31
          and trigger_row.tgenabled=''O'' and not trigger_row.tgisinternal)
        and exists(select 1 from pg_class relation where relation.oid=
          ''public.hotel_admin_pricing_action_receipts''::regclass
          and relation.relowner=''postgres''::regrole and relation.relrowsecurity)
        and exists(select 1 from pg_class relation where relation.oid=
          ''public.hotel_activity_log''::regclass
          and relation.relowner=''postgres''::regrole and relation.relrowsecurity)
        and not exists(select 1 from pg_policy policy where policy.polrelid=
          ''public.hotel_admin_pricing_action_receipts''::regclass)
        and (select count(*) from pg_policy policy where policy.polrelid=
          ''public.hotel_activity_log''::regclass)=1
        and exists(select 1 from pg_policy policy where policy.polrelid=
          ''public.hotel_activity_log''::regclass
          and policy.polname=''hotel_activity_log_admin_select''
          and policy.polcmd=''r'' and policy.polpermissive
          and policy.polroles=array[(''authenticated''::regrole)::oid]
          and policy.polwithcheck is null
          and pg_get_expr(policy.polqual,policy.polrelid) in(
            ''is_current_user_admin()'',''public.is_current_user_admin()''))
        and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
          ''public.hotel_admin_pricing_action_receipts''::regclass
          and not trigger_row.tgisinternal)=1
        and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
          ''public.hotel_admin_pricing_action_receipts''::regclass
          and trigger_row.tgname=''hotel_admin_pricing_action_receipts_immutable''
          and trigger_row.tgfoid=v_admin_receipt_guard_oid and trigger_row.tgtype=27
          and trigger_row.tgenabled=''O'' and not trigger_row.tgisinternal)
        and not exists(select 1 from (values
          (v_context_guard_oid,
            ''6e9893cd347504be63ab5699e02a592f6e81355c5b31da31ccaca2dd6ee9c5f0'',
            array[''search_path=pg_catalog, public, auth'']::text[]),
          (v_review_guard_oid,
            ''23ff92a30533948004130655e1e81b79386f1416afdd413c38816b0573220758'',
            array[''search_path=pg_catalog, public, auth'']::text[]),
          (v_freeze_guard_oid,
            ''d864f254c257be00491d0c2e508c4b6585e16bf3e35992fa174050d2205a6bf6'',
            array[''search_path=pg_catalog, public'']::text[]),
          (v_admin_receipt_guard_oid,
            ''352e7e040c99044f0fb01b03656a9f3193694039afd0079567c25fb3967bbbd0'',
            array[''search_path=pg_catalog, public'']::text[])
        ) expected(function_oid,source_hash,path)
        left join pg_proc procedure_row on procedure_row.oid=expected.function_oid
        where procedure_row.oid is null
          or procedure_row.proowner<>''postgres''::regrole
          or not procedure_row.prosecdef or procedure_row.provolatile<>''v''
          or procedure_row.proconfig is distinct from expected.path
          or encode(extensions.digest(convert_to(hotels_lifecycle_private.predecessor_source(procedure_row.oid),''UTF8''),''sha256''),
            ''hex'') is distinct from expected.source_hash
          or has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
          or has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
          or has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
          or has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))
        and exists(select 1 from pg_proc procedure_row where procedure_row.oid=v_apply_oid
          and procedure_row.proowner=''postgres''::regrole and procedure_row.prosecdef
          and procedure_row.provolatile=''v''
          and procedure_row.proconfig=
            array[''search_path=pg_catalog, public, auth'']::text[]
          and encode(extensions.digest(convert_to(hotels_lifecycle_private.predecessor_source(procedure_row.oid),''UTF8''),''sha256''),
            ''hex'')=''c8a5b56ea5097524f0843c699dd83a484a166379324b891162b39e9ef6c51f6e''
          and not has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
          and not has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
          and has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
          and not has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))
        and not exists(select 1 from (values
          (''public.hotel_seven_arches_pricing_activation_transaction_context''::regclass),
          (''public.hotel_seven_arches_pricing_activation_reviews''::regclass),
          (''public.hotel_admin_pricing_action_receipts''::regclass)
        ) relation(relation_oid)
        cross join unnest(array[
          ''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER''
        ]) privilege(name)
        where has_table_privilege(0::oid,relation.relation_oid,privilege.name)
          or has_table_privilege(''anon'',relation.relation_oid,privilege.name)
          or has_table_privilege(''authenticated'',relation.relation_oid,privilege.name)
          or has_table_privilege(''service_role'',relation.relation_oid,privilege.name))
        and not has_table_privilege(0::oid,
          ''public.hotel_activity_log''::regclass,''SELECT'')
        and not has_table_privilege(''anon'',
          ''public.hotel_activity_log''::regclass,''SELECT'')
        and not has_table_privilege(''authenticated'',
          ''public.hotel_activity_log''::regclass,''SELECT'')
        and has_table_privilege(''service_role'',
          ''public.hotel_activity_log''::regclass,''SELECT'')
        and has_table_privilege(''service_role'',
          ''public.hotel_activity_log''::regclass,''INSERT'')
        and not exists(select 1 from (values
          (0::oid),((''anon''::regrole)::oid),((''authenticated''::regrole)::oid)
        ) role(role_oid) cross join unnest(array[
          ''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER''
        ]) privilege(name) where has_table_privilege(
          role.role_oid,''public.hotel_activity_log''::regclass,privilege.name))
        and not exists(select 1 from unnest(array[
          ''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER''
        ]) privilege(name) where has_table_privilege(
          ''service_role'',''public.hotel_activity_log''::regclass,privilege.name))
        and auth.uid() is not null and auth.uid()=v_context.actor_id
        and public.is_current_user_admin() is true
        and v_context.transaction_id=txid_current()
        and v_context.created_at is not null and isfinite(v_context.created_at)
        and v_context.applied_entity_ids=array[
          ''22e47a63-a630-4fb6-8f43-816f2d3fdc17''::uuid,
          ''b0a3104f-7b31-5265-a59f-c2d166f11a23''::uuid,
          ''7e420964-9cbf-4f1b-abd3-09840af5240f''::uuid,
          ''3320590d-632d-423f-80d0-fd021cba7293''::uuid]
        and v_task2_receipt.id=1
        and v_task2_receipt.contract_version=
          ''hotels_v2_seven_arches_task2_stage2_compatibility_v1''
        and v_task2_receipt.canonical_task2_protected_fingerprint=
          public.hotel_v2_h3_2b_hash(
            v_task2_receipt.canonical_task2_protected_fingerprints)
        and v_task2_receipt.canonical_stage2_protected_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(
            v_task2_receipt.canonical_stage2_protected_fingerprints)
        and v_scoped_lineage is not null
        and v_inflight_review.id=v_context.review_id
        and v_inflight_review.contract_version=
          ''hotels_v2_seven_arches_pricing_activation_plan_v1''
        and v_inflight_review.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and v_inflight_review.actor_id=v_context.actor_id
        and v_inflight_review.reviewed_at is not null
        and isfinite(v_inflight_review.reviewed_at)
        and v_inflight_review.expires_at is not null
        and isfinite(v_inflight_review.expires_at)
        and v_inflight_review.expires_at=
          v_inflight_review.reviewed_at+interval ''30 minutes''
        and v_inflight_review.created_at is not null
        and isfinite(v_inflight_review.created_at)
        and v_inflight_review.consumed_at is not null
        and isfinite(v_inflight_review.consumed_at)
        and statement_timestamp()<v_inflight_review.expires_at
        and v_context.created_at>=v_inflight_review.reviewed_at
        and v_context.created_at<v_inflight_review.expires_at
        and v_inflight_review.consumed_at>=v_inflight_review.reviewed_at
        and v_inflight_review.consumed_at<v_inflight_review.expires_at
        and v_inflight_review.consumed_correlation_id=v_context.correlation_id
        and v_inflight_review.consumed_idempotency_key is not null
        and public.hotel_v2_h2a_keys_allowed(v_inflight_review.reviewed_plan,array[
          ''contract_version'',''review_id'',''hotel_id'',''snapshot_token'',''reviewed_at'',
          ''expires_at'',''operation'',''plan_fingerprint'']) is true
        and v_inflight_review.reviewed_plan?&array[
          ''contract_version'',''review_id'',''hotel_id'',''snapshot_token'',''reviewed_at'',
          ''expires_at'',''operation'',''plan_fingerprint'']
        and v_inflight_review.reviewed_plan->>''contract_version''=
          ''hotels_v2_seven_arches_pricing_activation_plan_v1''
        and v_inflight_review.reviewed_plan->>''review_id''=
          v_inflight_review.id::text
        and v_inflight_review.reviewed_plan->>''hotel_id''=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''
        and v_inflight_review.reviewed_plan->>''snapshot_token''=
          v_inflight_review.snapshot_token
        and v_inflight_review.reviewed_plan->>''reviewed_at''=to_char(
          v_inflight_review.reviewed_at at time zone ''UTC'',
          ''YYYY-MM-DD"T"HH24:MI:SS.US"Z"'')
        and v_inflight_review.reviewed_plan->>''expires_at''=to_char(
          v_inflight_review.expires_at at time zone ''UTC'',
          ''YYYY-MM-DD"T"HH24:MI:SS.US"Z"'')
        and v_inflight_review.reviewed_plan->>''plan_fingerprint''=
          v_inflight_review.plan_fingerprint
        and v_inflight_review.plan_fingerprint=encode(extensions.digest(convert_to(
          (v_inflight_review.reviewed_plan-''plan_fingerprint'')::text,''UTF8''),
          ''sha256''),''hex'')
        and public.hotel_v2_h2a_keys_allowed(
          v_inflight_review.reviewed_plan->''operation'',array[
            ''entity'',''action'',''id'',''expected_original'',''payload'']) is true
        and (v_inflight_review.reviewed_plan->''operation'')?&array[
          ''entity'',''action'',''id'',''expected_original'',''payload'']
        and v_inflight_review.reviewed_plan#>>''{operation,entity}''=''pricing_activation''
        and v_inflight_review.reviewed_plan#>>''{operation,action}''=''activate''
        and v_inflight_review.reviewed_plan#>>''{operation,id}''=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''
        and public.hotel_v2_h2a_keys_allowed(
          v_inflight_review.reviewed_plan#>''{operation,payload}'',array[
            ''upper_base_nightly_rate'',''ground_base_nightly_rate'',
            ''rate_plan_name_i18n'',''rate_plan_description_i18n'',
            ''schedule_name_i18n'',''reason'']) is true
        and (v_inflight_review.reviewed_plan#>''{operation,payload}'')?&array[
          ''upper_base_nightly_rate'',''ground_base_nightly_rate'',
          ''rate_plan_name_i18n'',''rate_plan_description_i18n'',
          ''schedule_name_i18n'',''reason'']
        and jsonb_typeof(v_inflight_review.reviewed_plan#>
          ''{operation,payload,upper_base_nightly_rate}'')=''number''
        and jsonb_typeof(v_inflight_review.reviewed_plan#>
          ''{operation,payload,ground_base_nightly_rate}'')=''number''
        and jsonb_typeof(v_inflight_review.reviewed_plan#>
          ''{operation,expected_original}'')=''object''
        and v_inflight_review.reviewed_plan#>''{operation,expected_original}''
          is not distinct from v_expected_original
        and jsonb_typeof(v_inflight_review.result)=''object''
        and v_inflight_review.result is not distinct from jsonb_build_object(
          ''contract_version'',''hotels_v2_seven_arches_pricing_activation_apply_result_v1'',
          ''hotel_id'',''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid,
          ''changed'',true,''replayed'',false,''review_id'',v_inflight_review.id,
          ''correlation_id'',v_context.correlation_id,
          ''idempotency_key'',v_inflight_review.consumed_idempotency_key,
          ''activity_ids'',to_jsonb(v_inflight_activity_ids),
          ''public_change'',false,''legacy_authoritative'',true)
        and v_inflight_admin_receipt.hotel_id=
          ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and v_inflight_admin_receipt.actor_id=v_context.actor_id
        and v_inflight_admin_receipt.correlation_id=v_context.correlation_id
        and v_inflight_admin_receipt.idempotency_key=
          v_inflight_review.consumed_idempotency_key
        and v_inflight_admin_receipt.created_at is not null
        and isfinite(v_inflight_admin_receipt.created_at)
        and v_inflight_admin_receipt.created_at>=v_context.created_at
        and v_inflight_admin_receipt.created_at<v_inflight_review.expires_at
        and v_inflight_admin_receipt.result is not distinct from
          v_inflight_review.result
        and v_inflight_admin_receipt.request_hash=encode(extensions.digest(convert_to(
          jsonb_build_object(''reviewed_plan'',v_inflight_review.reviewed_plan,
            ''correlation_id'',v_context.correlation_id)::text,''UTF8''),
          ''sha256''),''hex'')
        and cardinality(v_inflight_activity_ids)=4
        and (select count(*) from public.hotel_activity_log activity
          where activity.correlation_id=v_context.correlation_id)=4
        and (select count(*) from public.hotel_activity_log activity
          where activity.correlation_id=v_context.correlation_id
            and activity.hotel_id=
              ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
            and activity.actor_type=''admin''
            and activity.actor_id=v_context.actor_id and activity.action=''update''
            and activity.source=''hotels_v2_seven_arches_pricing_activation''
            and activity.created_at is not null and isfinite(activity.created_at)
            and activity.created_at>=v_context.created_at
            and activity.created_at<v_inflight_review.expires_at)=4
        and exists(select 1 from public.hotel_activity_log activity
          where activity.id=any(v_inflight_activity_ids)
            and activity.entity_type=''rate_plan''
            and activity.entity_id=''22e47a63-a630-4fb6-8f43-816f2d3fdc17''::uuid
            and jsonb_typeof(activity.before_state)=''object''
            and jsonb_typeof(activity.after_state)=''object''
            and activity.before_state->>''is_active''=''false''
            and activity.after_state->>''is_active''=''true''
            and activity.after_state->''name_i18n'' is not distinct from
              v_inflight_review.reviewed_plan#>''{operation,payload,rate_plan_name_i18n}''
            and activity.after_state->''description_i18n'' is not distinct from
              v_inflight_review.reviewed_plan#>''{operation,payload,rate_plan_description_i18n}''
            and (activity.after_state-array[
              ''name_i18n'',''description_i18n'',''is_active'',''version'',''updated_at''])
              is not distinct from (activity.before_state-array[
              ''name_i18n'',''description_i18n'',''is_active'',''version'',''updated_at''])
            and pg_input_is_valid(activity.before_state->>''version'',''integer'')
            and pg_input_is_valid(activity.after_state->>''version'',''integer'')
            and case when
              pg_input_is_valid(activity.before_state->>''version'',''integer'')
              and pg_input_is_valid(activity.after_state->>''version'',''integer'')
              then (activity.after_state->>''version'')::integer=
                (activity.before_state->>''version'')::integer+1 else false end
            and pg_input_is_valid(
              activity.before_state->>''updated_at'',''timestamp with time zone'')
            and pg_input_is_valid(
              activity.after_state->>''updated_at'',''timestamp with time zone'')
            and case when pg_input_is_valid(
                activity.before_state->>''updated_at'',''timestamp with time zone'')
              and pg_input_is_valid(
                activity.after_state->>''updated_at'',''timestamp with time zone'')
              then (activity.after_state->>''updated_at'')::timestamptz>
                (activity.before_state->>''updated_at'')::timestamptz else false end
            and activity.after_state is not distinct from (select to_jsonb(plan)
              from public.hotel_rate_plans plan where plan.id=activity.entity_id))
        and exists(select 1 from public.hotel_activity_log activity
          where activity.id=any(v_inflight_activity_ids)
            and activity.entity_type=''pricing_schedule''
            and activity.entity_id=''b0a3104f-7b31-5265-a59f-c2d166f11a23''::uuid
            and jsonb_typeof(activity.before_state)=''object''
            and jsonb_typeof(activity.after_state)=''object''
            and activity.before_state->>''is_active''=''false''
            and activity.after_state->>''is_active''=''true''
            and activity.after_state->''name_i18n'' is not distinct from
              v_inflight_review.reviewed_plan#>''{operation,payload,schedule_name_i18n}''
            and (activity.after_state-array[
              ''name_i18n'',''is_active'',''version'',''updated_at'']) is not distinct from
              (activity.before_state-array[
              ''name_i18n'',''is_active'',''version'',''updated_at''])
            and pg_input_is_valid(activity.before_state->>''version'',''integer'')
            and pg_input_is_valid(activity.after_state->>''version'',''integer'')
            and case when
              pg_input_is_valid(activity.before_state->>''version'',''integer'')
              and pg_input_is_valid(activity.after_state->>''version'',''integer'')
              then (activity.after_state->>''version'')::integer=
                (activity.before_state->>''version'')::integer+1 else false end
            and pg_input_is_valid(
              activity.before_state->>''updated_at'',''timestamp with time zone'')
            and pg_input_is_valid(
              activity.after_state->>''updated_at'',''timestamp with time zone'')
            and case when pg_input_is_valid(
                activity.before_state->>''updated_at'',''timestamp with time zone'')
              and pg_input_is_valid(
                activity.after_state->>''updated_at'',''timestamp with time zone'')
              then (activity.after_state->>''updated_at'')::timestamptz>
                (activity.before_state->>''updated_at'')::timestamptz else false end
            and activity.after_state is not distinct from (select to_jsonb(schedule)
              from public.hotel_pricing_schedules schedule
              where schedule.id=activity.entity_id))
        and exists(select 1 from public.hotel_activity_log activity
          where activity.id=any(v_inflight_activity_ids)
            and activity.entity_type=''room_rate''
            and activity.entity_id=''7e420964-9cbf-4f1b-abd3-09840af5240f''::uuid
            and jsonb_typeof(activity.before_state)=''object''
            and jsonb_typeof(activity.after_state)=''object''
            and activity.before_state->>''is_active''=''false''
            and activity.before_state->''base_nightly_rate''=''0''::jsonb
            and activity.after_state->>''is_active''=''true''
            and activity.after_state->''base_nightly_rate'' is not distinct from
              v_inflight_review.reviewed_plan#>
                ''{operation,payload,upper_base_nightly_rate}''
            and (activity.after_state-array[
              ''base_nightly_rate'',''is_active'',''version'',''updated_at''])
              is not distinct from (activity.before_state-array[
              ''base_nightly_rate'',''is_active'',''version'',''updated_at''])
            and pg_input_is_valid(activity.before_state->>''version'',''integer'')
            and pg_input_is_valid(activity.after_state->>''version'',''integer'')
            and case when
              pg_input_is_valid(activity.before_state->>''version'',''integer'')
              and pg_input_is_valid(activity.after_state->>''version'',''integer'')
              then (activity.after_state->>''version'')::integer=
                (activity.before_state->>''version'')::integer+1 else false end
            and pg_input_is_valid(
              activity.before_state->>''updated_at'',''timestamp with time zone'')
            and pg_input_is_valid(
              activity.after_state->>''updated_at'',''timestamp with time zone'')
            and case when pg_input_is_valid(
                activity.before_state->>''updated_at'',''timestamp with time zone'')
              and pg_input_is_valid(
                activity.after_state->>''updated_at'',''timestamp with time zone'')
              then (activity.after_state->>''updated_at'')::timestamptz>
                (activity.before_state->>''updated_at'')::timestamptz else false end
            and activity.after_state is not distinct from (select to_jsonb(rate)
              from public.hotel_room_rates rate where rate.id=activity.entity_id))
        and exists(select 1 from public.hotel_activity_log activity
          where activity.id=any(v_inflight_activity_ids)
            and activity.entity_type=''room_rate''
            and activity.entity_id=''3320590d-632d-423f-80d0-fd021cba7293''::uuid
            and jsonb_typeof(activity.before_state)=''object''
            and jsonb_typeof(activity.after_state)=''object''
            and activity.before_state->>''is_active''=''false''
            and activity.before_state->''base_nightly_rate''=''0''::jsonb
            and activity.after_state->>''is_active''=''true''
            and activity.after_state->''base_nightly_rate'' is not distinct from
              v_inflight_review.reviewed_plan#>
                ''{operation,payload,ground_base_nightly_rate}''
            and (activity.after_state-array[
              ''base_nightly_rate'',''is_active'',''version'',''updated_at''])
              is not distinct from (activity.before_state-array[
              ''base_nightly_rate'',''is_active'',''version'',''updated_at''])
            and pg_input_is_valid(activity.before_state->>''version'',''integer'')
            and pg_input_is_valid(activity.after_state->>''version'',''integer'')
            and case when
              pg_input_is_valid(activity.before_state->>''version'',''integer'')
              and pg_input_is_valid(activity.after_state->>''version'',''integer'')
              then (activity.after_state->>''version'')::integer=
                (activity.before_state->>''version'')::integer+1 else false end
            and pg_input_is_valid(
              activity.before_state->>''updated_at'',''timestamp with time zone'')
            and pg_input_is_valid(
              activity.after_state->>''updated_at'',''timestamp with time zone'')
            and case when pg_input_is_valid(
                activity.before_state->>''updated_at'',''timestamp with time zone'')
              and pg_input_is_valid(
                activity.after_state->>''updated_at'',''timestamp with time zone'')
              then (activity.after_state->>''updated_at'')::timestamptz>
                (activity.before_state->>''updated_at'')::timestamptz else false end
            and activity.after_state is not distinct from (select to_jsonb(rate)
              from public.hotel_room_rates rate where rate.id=activity.entity_id))
        and (v_transaction_task2-array[
          ''hotel_rate_plans'',''hotel_room_rates_protected'',''hotel_pricing_schedules'',
          ''hotel_admin_pricing_action_receipts'',''non_h3_2b_activity'']::text[])
          is not distinct from
          (v_context.before_protected_fingerprints-array[
          ''hotel_rate_plans'',''hotel_room_rates_protected'',''hotel_pricing_schedules'',
          ''hotel_admin_pricing_action_receipts'',''non_h3_2b_activity'']::text[])
        and not exists(select 1 from unnest(array[
          ''hotel_rate_plans'',''hotel_room_rates_protected'',''hotel_pricing_schedules'',
          ''hotel_admin_pricing_action_receipts'',''non_h3_2b_activity'']::text[]) changed(key)
          where v_transaction_task2->changed.key is null
            or v_context.before_protected_fingerprints->changed.key is null
            or v_transaction_task2->changed.key is not distinct from
              v_context.before_protected_fingerprints->changed.key)
        and (v_raw_stage2-array[
          ''hotel_rate_plans'',''hotel_room_rates_protected'',''hotel_pricing_schedules'',
          ''hotel_admin_pricing_action_receipts'',
          ''non_external_calendar_activity'']::text[]) is not distinct from
          (v_context.before_stage2_protected_fingerprints-array[
          ''hotel_rate_plans'',''hotel_room_rates_protected'',''hotel_pricing_schedules'',
          ''hotel_admin_pricing_action_receipts'',
          ''non_external_calendar_activity'']::text[])
        and not exists(select 1 from unnest(array[
          ''hotel_rate_plans'',''hotel_room_rates_protected'',''hotel_pricing_schedules'',
          ''hotel_admin_pricing_action_receipts'',
          ''non_external_calendar_activity'']::text[]) changed(key)
          where v_raw_stage2->changed.key is null
            or v_context.before_stage2_protected_fingerprints->changed.key is null
            or v_raw_stage2->changed.key is not distinct from
              v_context.before_stage2_protected_fingerprints->changed.key)),false);
      if v_inflight_exact is not true then return null; end if;
    else
      -- A malformed, stale, duplicate, or foreign transaction context never
      -- falls back to the ordinary count-zero baseline.
      return null;
    end if;
  end if;

  return jsonb_build_object(
    ''contract_version'',''hotels_v2_seven_arches_task2_stage2_canonical_snapshot_v1'',
    ''site_settings_lifecycle'',v_lifecycle,
    ''site_settings_lifecycle_fingerprint'',v_lifecycle_fingerprint,
    ''task2_protected_fingerprints'',v_task2,
    ''task2_protected_fingerprint'',public.hotel_v2_h3_2b_hash(v_task2),
    ''stage2_protected_fingerprints'',v_stage2,
    ''stage2_protected_fingerprint'',
      public.hotel_v2_external_calendar_worker_hash(v_stage2));
exception when no_data_found or too_many_rows or undefined_function
  or undefined_table or invalid_schema_name then
  return null;
end
';
ALTER FUNCTION hotels_published_architecture_private.foundation_18dc3c81f0b8a4c4() OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_18dc3c81f0b8a4c4() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_7cc73b415b95b3cb() RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS '
declare
  -- Read-only STABLE inputs: one evaluation per invocation/snapshot; never cached across calls.
  v_lifecycle_once_0 constant boolean:=public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_owner_state jsonb;
  v_task2 public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_task2_stage2
    public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
  v_canonical jsonb;
  v_task2_current jsonb;
  v_activation public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_activation_count integer;
  v_compatible jsonb;
  v_current_scoped_lineage jsonb;
  v_task2_receipt_topology_exact boolean:=false;
begin
  if (select count(*) from public.hotel_admin_availability_foundation_evolution_receipts)<>1
     or (select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or (select count(*) from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or (select count(*) from public.hotel_seven_arches_task2_stage2_compatibility_receipts)<>1 then
    return false;
  end if;
  select * into strict v_owner
    from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  select * into strict v_task2
    from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  select * into strict v_task2_stage2
    from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  v_current_scoped_lineage:=
    public.hotel_v2_seven_arches_pricing_scoped_lineage();
  v_task2_receipt_topology_exact:=coalesce(
    v_task2_stage2.contract_version=
      ''hotels_v2_seven_arches_task2_stage2_compatibility_v1''
    and v_task2_stage2.created_at is not null
    and isfinite(v_task2_stage2.created_at)
    and exists(select 1 from pg_class relation where relation.oid=
      ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
      and relation.relowner=''postgres''::regrole and relation.relrowsecurity)
    and (select count(*) from pg_attribute attribute where attribute.attrelid=
      ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
      and attribute.attnum>0 and not attribute.attisdropped)=10
    and not exists(select 1 from (values
      (1::smallint,''id'',''smallint'',true,null::text),
      (2::smallint,''contract_version'',''text'',true,null::text),
      (3::smallint,''canonical_task2_protected_fingerprints'',''jsonb'',true,null::text),
      (4::smallint,''canonical_task2_protected_fingerprint'',''text'',true,null::text),
      (5::smallint,''canonical_stage2_protected_fingerprints'',''jsonb'',true,null::text),
      (6::smallint,''canonical_stage2_protected_fingerprint'',''text'',true,null::text),
      (7::smallint,''scoped_lineage_source_hash'',''text'',true,null::text),
      (8::smallint,''canonical_snapshot_source_hash'',''text'',true,null::text),
      (9::smallint,''validator_source_hash'',''text'',true,null::text),
      (10::smallint,''created_at'',''timestamp with time zone'',true,''clock_timestamp()'')
    ) expected(attnum,attname,type_name,not_null,default_expression)
    left join pg_attribute attribute on attribute.attrelid=
      ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
      and attribute.attnum=expected.attnum and not attribute.attisdropped
    left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
      and default_row.adnum=attribute.attnum
    where attribute.attrelid is null
      or attribute.attname is distinct from expected.attname
      or format_type(attribute.atttypid,attribute.atttypmod)
        is distinct from expected.type_name
      or attribute.attnotnull is distinct from expected.not_null
      or attribute.attidentity is distinct from ''''
      or attribute.attgenerated is distinct from ''''
      or pg_get_expr(default_row.adbin,default_row.adrelid)
        is distinct from expected.default_expression)
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
        ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass)=10
    and (select count(*) from pg_constraint constraint_row
      join pg_index index_row on index_row.indexrelid=constraint_row.conindid
      where constraint_row.conrelid=
          ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
        and constraint_row.contype=''p'' and constraint_row.convalidated
        and constraint_row.conkey=array[1]::smallint[]
        and pg_get_constraintdef(constraint_row.oid)=''PRIMARY KEY (id)''
        and index_row.indisprimary and index_row.indisunique
        and index_row.indisvalid and index_row.indisready)=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
        and constraint_row.contype=''c'' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[1]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          ''[[:space:]]+'','''',''g'')=''(id=1)'')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
        and constraint_row.contype=''c'' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[2]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          ''[[:space:]]+'','''',''g'')=
          ''(contract_version=''''hotels_v2_seven_arches_task2_stage2_compatibility_v1''''::text)'')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
        and constraint_row.contype=''c'' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[3]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          ''[[:space:]]+'','''',''g'')=
          ''(jsonb_typeof(canonical_task2_protected_fingerprints)=''''object''''::text)'')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
        and constraint_row.contype=''c'' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[5]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          ''[[:space:]]+'','''',''g'')=
          ''(jsonb_typeof(canonical_stage2_protected_fingerprints)=''''object''''::text)'')=1
    and not exists(select 1 from (values
      (4::smallint,''canonical_task2_protected_fingerprint''),
      (6::smallint,''canonical_stage2_protected_fingerprint''),
      (7::smallint,''scoped_lineage_source_hash''),
      (8::smallint,''canonical_snapshot_source_hash''),
      (9::smallint,''validator_source_hash'')
    ) expected(attnum,column_name) where (select count(*)
      from pg_constraint constraint_row where constraint_row.conrelid=
        ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
        and constraint_row.contype=''c'' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[expected.attnum]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          ''[[:space:]]+'','''',''g'')=''(''||expected.column_name||
            ''~''''^[0-9a-f]{64}$''''::text)'')<>1)
    and not exists(select 1 from pg_policy policy where policy.polrelid=
      ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass)
    and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
      ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
      and not trigger_row.tgisinternal)=1
    and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
      ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass
      and trigger_row.tgname=
        ''hotel_seven_arches_task2_stage2_compatibility_receipt_immutable''
      and trigger_row.tgfoid=
        to_regprocedure(''public.hotel_v2_seven_arches_pricing_activation_immutable()'')
      and trigger_row.tgtype=27 and trigger_row.tgenabled=''O''
      and not trigger_row.tgisinternal)
    and not exists(select 1 from unnest(array[
      ''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER''
    ]) privilege(name) where has_table_privilege(0::oid,
        ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass,
        privilege.name)
      or has_table_privilege(''anon'',
        ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass,
        privilege.name)
      or has_table_privilege(''authenticated'',
        ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass,
        privilege.name)
      or has_table_privilege(''service_role'',
        ''public.hotel_seven_arches_task2_stage2_compatibility_receipts''::regclass,
        privilege.name)),false);
  v_owner_state:=hotels_published_architecture_private.foundation_4c5280b68669b020();
  v_canonical:=hotels_published_architecture_private.foundation_18dc3c81f0b8a4c4();
  v_task2_current:=v_canonical->''task2_protected_fingerprints'';
  v_compatible:=v_canonical->''stage2_protected_fingerprints'';
  select count(*) into v_activation_count
  from public.hotel_seven_arches_pricing_activation_evolution_receipts;
  if v_activation_count>1 or (
    v_owner.contract_version=''hotels_v2_admin_d_foundation_evolution_v2''
    and v_owner.before_current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_owner.before_current_protected_fingerprints::text,''UTF8''),''sha256''),''hex'')
    and v_owner.current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_owner.current_protected_fingerprints::text,''UTF8''),''sha256''),''hex'')
    and v_owner.stage2_current_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(v_owner.stage2_current_protected_fingerprints)
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts foundation
      where foundation.id=1 and foundation.protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(foundation.protected_fingerprints))
    and v_task2.protected_fingerprint=public.hotel_v2_h3_2b_hash(v_task2.protected_fingerprints)
    and v_task2.owner_evolution_receipt_id=v_owner.id
    and v_task2.owner_evolution_receipt_fingerprint=
      public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(v_owner),''{created_at}'',
        to_jsonb(extract(epoch from v_owner.created_at)),false))
    and v_current_scoped_lineage is not null
    and v_current_scoped_lineage->>''contract_version''=
      ''hotels_v2_seven_arches_pricing_scoped_lineage_v1''
    and exists(select 1 from public.hotel_admin_availability_foundation_receipts original
      where original.id=1
        and original.protected_fingerprint=
          public.hotel_v2_h3_2b_hash(original.protected_fingerprints)
        and v_owner.original_foundation_receipt_id=original.id
        and v_owner.original_protected_fingerprint=original.protected_fingerprint)
    and exists(select 1 from public.partner_resources assignment
      where assignment.id=v_owner.assignment_id
        and assignment.partner_id=v_owner.partner_id
        and assignment.resource_type=''hotels''
        and assignment.resource_id=v_owner.hotel_id)
    and exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.assignment_id=v_owner.assignment_id
        and permission.partner_id=v_owner.partner_id
        and permission.hotel_id=v_owner.hotel_id
        and permission.version=1 and permission.has_mutation_capability
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)
          is not distinct from v_owner.after_permission)
    and coalesce((v_owner_state->>''original_receipt_intact'')::boolean,false)
    and coalesce((v_owner_state->>''seven_arches_assignment_exact'')::boolean,false)
    and coalesce((v_owner_state->>''seven_arches_owner_preset_exact'')::boolean,false)
    and coalesce((v_owner_state->>''audit_chain_exact'')::boolean,false)
    and (select count(*)=1 and bool_and(setting.id=1
      and hotels_lifecycle_private.predecessor_flag_exact(''hotel_rooms_v2_enabled'',setting.hotel_rooms_v2_enabled)
      and setting.hotel_external_sync_enabled is not null
      and setting.hotel_instant_booking_enabled is not distinct from false
      and hotels_lifecycle_private.predecessor_flag_exact(''hotel_stripe_connect_enabled'',setting.hotel_stripe_connect_enabled))
      from public.site_settings setting)
    and (select count(*)
      from hotels_v2_private.hotel_external_calendar_activation_receipts)=1
    and exists(select 1
      from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.created_at is not null
        and isfinite(receipt.created_at)
        and receipt.site_settings_without_external_fingerprint~''^[0-9a-f]{64}$''
        and case
          when jsonb_typeof(receipt.compatibility_function_fingerprints)=''object''
          then (select count(*) from jsonb_object_keys(
                 receipt.compatibility_function_fingerprints))=20
            and receipt.compatibility_function_fingerprints ?& array[
              ''public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)'',
              ''public.hotel_v2_partner_list_assigned_properties(uuid)'',
              ''public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)'',
              ''public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)'',
              ''public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)'',
              ''public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)'',
              ''public.hotel_v2_admin_get_content_control(uuid)'',
              ''public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)'',
              ''public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)'',
              ''public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)'',
              ''public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)'',
              ''public.hotel_v2_h3_2b_flags_off()'',
              ''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'',
              ''public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)'',
              ''public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)'',
              ''public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)'',
              ''public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)'',
              ''public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)'',
              ''public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)'',
              ''public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)''
            ]::text[]
            and not exists(select 1 from jsonb_each_text(
              receipt.compatibility_function_fingerprints) fingerprint(signature,value)
              where (fingerprint.value~''^[0-9a-f]{64}$'') is distinct from true)
          else false
        end)
    and exists(select 1 from pg_class relation where relation.oid=
      ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
      and relation.relowner=''postgres''::regrole and not relation.relrowsecurity)
    and (select count(*) from pg_attribute attribute
      where attribute.attrelid=
        ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
        and attribute.attnum>0 and not attribute.attisdropped)=4
    and not exists(select 1 from (values
      (1::smallint,''id'',''smallint'',true,null::text),
      (2::smallint,''site_settings_without_external_fingerprint'',''text'',true,null::text),
      (3::smallint,''compatibility_function_fingerprints'',''jsonb'',true,null::text),
      (4::smallint,''created_at'',''timestamp with time zone'',true,''clock_timestamp()'')
    ) expected(attnum,attname,type_name,not_null,default_expression)
    left join pg_attribute attribute on attribute.attrelid=
      ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
      and attribute.attnum=expected.attnum and not attribute.attisdropped
    left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
      and default_row.adnum=attribute.attnum
    where attribute.attrelid is null
      or attribute.attname is distinct from expected.attname
      or format_type(attribute.atttypid,attribute.atttypmod)
        is distinct from expected.type_name
      or attribute.attnotnull is distinct from expected.not_null
      or attribute.attidentity is distinct from ''''
      or attribute.attgenerated is distinct from ''''
      or pg_get_expr(default_row.adbin,default_row.adrelid)
        is distinct from expected.default_expression)
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
        ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass)=4
    and (select count(*) from pg_constraint constraint_row
      join pg_index index_row on index_row.indexrelid=constraint_row.conindid
      where constraint_row.conrelid=
          ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
        and constraint_row.contype=''p'' and constraint_row.convalidated
        and constraint_row.conkey=array[1]::smallint[]
        and pg_get_constraintdef(constraint_row.oid)=''PRIMARY KEY (id)''
        and index_row.indisprimary and index_row.indisunique
        and index_row.indisvalid and index_row.indisready)=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
        and constraint_row.contype=''c'' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[1]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          ''[[:space:]]+'','''',''g'')=''(id=1)'')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
        and constraint_row.contype=''c'' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[2]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          ''[[:space:]]+'','''',''g'')=
          ''(site_settings_without_external_fingerprint~''''^[0-9a-f]{64}$''''::text)'')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
        and constraint_row.contype=''c'' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[3]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          ''[[:space:]]+'','''',''g'')=
          ''(jsonb_typeof(compatibility_function_fingerprints)=''''object''''::text)'')=1
    and not exists(select 1 from pg_policy policy where policy.polrelid=
      ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass)
    and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
      ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
      and not trigger_row.tgisinternal)=1
    and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
      ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass
      and trigger_row.tgname=''hotel_external_calendar_activation_receipt_immutable''
      and trigger_row.tgfoid=
        to_regprocedure(''public.hotel_v2_h3_2a_reject_immutable_change()'')
      and trigger_row.tgtype=27 and trigger_row.tgenabled=''O''
      and not trigger_row.tgisinternal)
    and not exists(select 1 from unnest(array[
      ''SELECT'',''INSERT'',''UPDATE'',''DELETE'',''TRUNCATE'',''REFERENCES'',''TRIGGER''
    ]) privilege(name) where has_table_privilege(0::oid,
        ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass,
        privilege.name)
      or has_table_privilege(''anon'',
        ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass,
        privilege.name)
      or has_table_privilege(''authenticated'',
        ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass,
        privilege.name)
      or has_table_privilege(''service_role'',
        ''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass,
        privilege.name))
    and exists(select 1 from pg_namespace namespace_row where namespace_row.oid=
      ''hotels_v2_private''::regnamespace
      and namespace_row.nspowner=''postgres''::regrole)
    and not has_schema_privilege(0::oid,''hotels_v2_private'',''USAGE'')
    and not has_schema_privilege(''anon'',''hotels_v2_private'',''USAGE'')
    and not has_schema_privilege(''service_role'',''hotels_v2_private'',''USAGE'')
    and not has_schema_privilege(0::oid,''hotels_v2_private'',''CREATE'')
    and not has_schema_privilege(''anon'',''hotels_v2_private'',''CREATE'')
    and not has_schema_privilege(''authenticated'',''hotels_v2_private'',''CREATE'')
    and not has_schema_privilege(''service_role'',''hotels_v2_private'',''CREATE'')
    and not exists(select 1 from (values
      (''public.hotel_v2_external_calendar_worker_hash(jsonb)'',true,''i''::"char",
        array[''search_path=pg_catalog'']::text[],
        ''d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828''),
      (''public.hotel_v2_external_calendar_activation_function_fingerprints()'',true,
        ''s''::"char",array[''search_path=pg_catalog, public'']::text[],
        ''fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914''),
      (''public.hotel_v2_partner_workspace_function_lineage_is_exact()'',true,
        ''s''::"char",array[''search_path=pg_catalog, public'']::text[],
        ''dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85''),
      (''public.hotel_v2_h3_2a_reject_immutable_change()'',false,''v''::"char",
        array[''search_path=pg_catalog, public'']::text[],
        ''5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c'')
    ) expected(signature,security_definer,volatility,path,source_hash)
    left join pg_proc procedure_row
      on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null
      or procedure_row.proowner<>''postgres''::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.provolatile is distinct from expected.volatility
      or procedure_row.proconfig is distinct from expected.path
      or encode(extensions.digest(convert_to(hotels_lifecycle_private.predecessor_source(procedure_row.oid),''UTF8''),''sha256''),''hex'')
        is distinct from expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
      or has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
      or has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
      or has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))
    and public.hotel_v2_partner_workspace_function_lineage_is_exact() is true
    and v_task2.stage2_compatibility_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(
      hotels_lifecycle_private.predecessor_definition(''public.hotel_v2_external_calendar_stage2_compatible_fingerprints()''::regprocedure)))
    and v_canonical is not null
    and public.hotel_v2_h2a_keys_allowed(v_canonical,array[
      ''contract_version'',''site_settings_lifecycle'',
      ''site_settings_lifecycle_fingerprint'',''task2_protected_fingerprints'',
      ''task2_protected_fingerprint'',''stage2_protected_fingerprints'',
      ''stage2_protected_fingerprint''])
    and v_canonical?&array[''contract_version'',''site_settings_lifecycle'',
      ''site_settings_lifecycle_fingerprint'',''task2_protected_fingerprints'',
      ''task2_protected_fingerprint'',''stage2_protected_fingerprints'',
      ''stage2_protected_fingerprint'']
    and v_canonical->>''contract_version''=
      ''hotels_v2_seven_arches_task2_stage2_canonical_snapshot_v1''
    and v_canonical->''site_settings_lifecycle''=jsonb_build_object(
      ''contract_version'',''hotels_v2_external_calendar_site_settings_lifecycle_v2'',
      ''id'',1,''hotel_rooms_v2_enabled'',false,
      ''hotel_external_sync_enabled_supported_values'',jsonb_build_array(false,true),
      ''hotel_instant_booking_enabled'',false,''hotel_stripe_connect_enabled'',false)
    and v_canonical->>''site_settings_lifecycle_fingerprint''=
      public.hotel_v2_external_calendar_worker_hash(
        v_canonical->''site_settings_lifecycle'')
    and v_canonical->>''task2_protected_fingerprint''=
      public.hotel_v2_h3_2b_hash(v_task2_current)
    and v_canonical->>''stage2_protected_fingerprint''=
      public.hotel_v2_external_calendar_worker_hash(v_compatible)
    and v_task2_stage2.canonical_task2_protected_fingerprint=
      public.hotel_v2_h3_2b_hash(
        v_task2_stage2.canonical_task2_protected_fingerprints)
    and v_task2_stage2.canonical_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_task2_stage2.canonical_stage2_protected_fingerprints)
    and v_task2_stage2.scoped_lineage_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
        ''public.hotel_v2_seven_arches_pricing_scoped_lineage()''::regprocedure)))
    and exists(select 1 from pg_proc procedure_row where procedure_row.oid=
        ''public.hotel_v2_seven_arches_pricing_scoped_lineage()''::regprocedure
      and procedure_row.proowner=''postgres''::regrole and procedure_row.prosecdef
      and procedure_row.provolatile=''s''
      and procedure_row.proconfig=array[''search_path=pg_catalog, public'']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
      and not has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
      and not has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
      and not has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))
    and v_task2_stage2.scoped_lineage_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
        ''public.hotel_v2_seven_arches_pricing_scoped_lineage()''::regprocedure)))
    and exists(select 1 from pg_proc procedure_row where procedure_row.oid=
        ''public.hotel_v2_seven_arches_pricing_scoped_lineage()''::regprocedure
      and procedure_row.proowner=''postgres''::regrole and procedure_row.prosecdef
      and procedure_row.provolatile=''s''
      and procedure_row.proconfig=array[''search_path=pg_catalog, public'']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
      and not has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
      and not has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
      and not has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))
    and (v_task2_stage2.canonical_snapshot_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
        ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure)))
      or v_lifecycle_once_0)
    and exists(select 1 from pg_proc procedure_row where procedure_row.oid=
        ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure
      and procedure_row.proowner=''postgres''::regrole and procedure_row.prosecdef
      and procedure_row.provolatile=''s''
      and procedure_row.proconfig=array[''search_path=pg_catalog, public'']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,''EXECUTE'')
      and not has_function_privilege(''anon'',procedure_row.oid,''EXECUTE'')
      and not has_function_privilege(''authenticated'',procedure_row.oid,''EXECUTE'')
      and not has_function_privilege(''service_role'',procedure_row.oid,''EXECUTE''))
    and (v_task2_stage2.validator_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(hotels_lifecycle_private.predecessor_definition(
        ''public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()''::regprocedure)))
      or v_lifecycle_once_0)
    and v_task2_receipt_topology_exact) is not true then
    return false;
  end if;
  if v_activation_count=0 then
    return coalesce((
      (select count(*) from public.hotel_rate_plans
        where hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid)=1
      and exists(select 1 from public.hotel_rate_plans where
        id=''22e47a63-a630-4fb6-8f43-816f2d3fdc17''::uuid
        and hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and code=''standard'' and review_status=''reviewed'' and not is_active)
      and (select count(*) from public.hotel_room_rates
        where hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid)=2
      and (select count(*) from public.hotel_room_rates where
        hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and id in(''7e420964-9cbf-4f1b-abd3-09840af5240f''::uuid,
          ''3320590d-632d-423f-80d0-fd021cba7293''::uuid)
        and pricing_schedule_id=''b0a3104f-7b31-5265-a59f-c2d166f11a23''::uuid
        and review_status=''reviewed'' and not is_active
        and base_nightly_rate=0 and btrim(currency::text)=''EUR'')=2
      and (select count(*) from public.hotel_pricing_schedules
        where hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid)=2
      and exists(select 1 from public.hotel_pricing_schedules where
        id=''b0a3104f-7b31-5265-a59f-c2d166f11a23''::uuid
        and hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and review_status=''reviewed'' and not is_active
        and application_scope=''room_occupancy''
        and minimum_billable_occupancy=2 and maximum_party_size=4)
      and exists(select 1 from public.hotel_pricing_schedules where
        id=''443065c0-984a-5de3-a22a-d03042c41107''::uuid
        and hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid
        and review_status=''requires_review'' and not is_active
        and application_scope=''property_booking_party'')
      and (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
        where schedule_id=''b0a3104f-7b31-5265-a59f-c2d166f11a23''::uuid
          and is_active)=27
      and v_current_scoped_lineage is not null),false);
  end if;
  select * into strict v_activation
  from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
  return coalesce((v_activation.contract_version=
      ''hotels_v2_seven_arches_pricing_activation_evolution_v1''
    and v_activation.before_protected_fingerprint=public.hotel_v2_h3_2b_hash(
      v_activation.before_protected_fingerprints)
    and v_activation.after_protected_fingerprint=public.hotel_v2_h3_2b_hash(
      v_activation.after_protected_fingerprints)
    and v_activation.allowed_fingerprint_keys=array[
      ''hotel_rate_plans'',''hotel_room_rates_protected'',''hotel_pricing_schedules'',
      ''hotel_admin_pricing_action_receipts'',''non_h3_2b_activity'']::text[]
    and (v_activation.after_protected_fingerprints-v_activation.allowed_fingerprint_keys)
      is not distinct from
      (v_activation.before_protected_fingerprints-v_activation.allowed_fingerprint_keys)
    and v_activation.after_protected_fingerprints->>''hotel_rate_plans''
      is distinct from v_activation.before_protected_fingerprints->>''hotel_rate_plans''
    and v_activation.after_protected_fingerprints->>''hotel_room_rates_protected''
      is distinct from v_activation.before_protected_fingerprints->>''hotel_room_rates_protected''
    and v_activation.after_protected_fingerprints->>''hotel_pricing_schedules''
      is distinct from v_activation.before_protected_fingerprints->>''hotel_pricing_schedules''
    and v_activation.after_protected_fingerprints->>''hotel_admin_pricing_action_receipts''
      is distinct from v_activation.before_protected_fingerprints->>''hotel_admin_pricing_action_receipts''
    and v_activation.after_protected_fingerprints->>''non_h3_2b_activity''
      is distinct from v_activation.before_protected_fingerprints->>''non_h3_2b_activity''
    and v_activation.before_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_activation.before_stage2_protected_fingerprints)
    and v_activation.after_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_activation.after_stage2_protected_fingerprints)
    and v_activation.stage2_allowed_fingerprint_keys=array[
      ''hotel_rate_plans'',''hotel_room_rates_protected'',''hotel_pricing_schedules'',
      ''hotel_admin_pricing_action_receipts'',''non_external_calendar_activity'']::text[]
    and (v_activation.after_stage2_protected_fingerprints-
      v_activation.stage2_allowed_fingerprint_keys) is not distinct from
      (v_activation.before_stage2_protected_fingerprints-
      v_activation.stage2_allowed_fingerprint_keys)
    and v_activation.after_stage2_protected_fingerprints->>''hotel_rate_plans''
      is distinct from v_activation.before_stage2_protected_fingerprints->>''hotel_rate_plans''
    and v_activation.after_stage2_protected_fingerprints->>''hotel_room_rates_protected''
      is distinct from v_activation.before_stage2_protected_fingerprints->>''hotel_room_rates_protected''
    and v_activation.after_stage2_protected_fingerprints->>''hotel_pricing_schedules''
      is distinct from v_activation.before_stage2_protected_fingerprints->>''hotel_pricing_schedules''
    and v_activation.after_stage2_protected_fingerprints->>''hotel_admin_pricing_action_receipts''
      is distinct from v_activation.before_stage2_protected_fingerprints->>''hotel_admin_pricing_action_receipts''
    and v_activation.after_stage2_protected_fingerprints->>''non_external_calendar_activity''
      is distinct from v_activation.before_stage2_protected_fingerprints->>''non_external_calendar_activity''
    and public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
      is true),false);
end
';
ALTER FUNCTION hotels_published_architecture_private.foundation_7cc73b415b95b3cb() OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_7cc73b415b95b3cb() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.foundation_b30af1618dfd07d0() RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER   SET search_path TO 'pg_catalog', 'public' AS '
begin
  if (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)=0 then
    return coalesce(
      hotels_published_architecture_private.foundation_7cc73b415b95b3cb(),false);
  end if;
  return coalesce(
    hotels_published_architecture_private.foundation_fcff56fd50f3800b(),false);
end
';
ALTER FUNCTION hotels_published_architecture_private.foundation_b30af1618dfd07d0() OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.foundation_b30af1618dfd07d0() FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE hotels_published_architecture_private.foundation_certificate (
 id integer PRIMARY KEY CHECK(id=1), predecessors jsonb NOT NULL,
 helpers jsonb NOT NULL, relation_catalog jsonb NOT NULL, entrypoints jsonb
);
ALTER TABLE hotels_published_architecture_private.foundation_certificate ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels_published_architecture_private.foundation_certificate FORCE ROW LEVEL SECURITY;
REVOKE ALL ON hotels_published_architecture_private.foundation_certificate FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON hotels_published_architecture_private.foundation_certificate
 FOR EACH STATEMENT EXECUTE FUNCTION hotels_published_architecture_private.immutable();
CREATE FUNCTION hotels_published_architecture_private.metadata(p_oid oid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,public AS 'SELECT (SELECT jsonb_build_array(encode(sha256(convert_to(p.prosrc,''UTF8'')),''hex''),
 encode(sha256(convert_to(pg_get_functiondef(p.oid),''UTF8'')),''hex''),
 pg_get_userbyid(p.proowner),(CASE WHEN p.proacl IS NULL THEN NULL ELSE ARRAY(SELECT entry::text FROM unnest(p.proacl) AS acl(entry) ORDER BY entry::text COLLATE "C") END)::text,p.proconfig,p.provolatile,p.prosecdef,
 p.proleakproof,p.proisstrict,p.proretset,l.lanname)
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=q.oid)||jsonb_build_array(
 pg_get_function_arguments(q.oid),oidvectortypes(q.proargtypes),q.prorettype::regtype::text,q.proparallel,q.prokind)
 FROM pg_proc q WHERE q.oid=p_oid';
CREATE FUNCTION hotels_published_architecture_private.relation_catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,public AS 'SELECT jsonb_build_object(
 ''schema'',(SELECT jsonb_build_array(nspowner,nspacl) FROM pg_namespace WHERE nspname=''hotels_published_architecture_private''),
 ''relations'',(SELECT jsonb_agg(jsonb_build_object(''name'',r.relname,''kind'',r.relkind,''owner'',r.relowner,
 ''rls'',r.relrowsecurity,''force'',r.relforcerowsecurity,''acl'',r.relacl,
 ''columns'',(SELECT jsonb_agg(jsonb_build_array(attname,atttypid,atttypmod,attnotnull) ORDER BY attnum)
   FROM pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped),
 ''constraints'',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid=r.oid),
 ''policies'',(SELECT jsonb_agg(to_jsonb(p)-''oid''-''polrelid'' ORDER BY polname) FROM pg_policy p WHERE polrelid=r.oid),
 ''triggers'',(SELECT jsonb_agg(jsonb_build_array(tgname,tgenabled,pg_get_triggerdef(oid)) ORDER BY tgname)
   FROM pg_trigger WHERE tgrelid=r.oid AND NOT tgisinternal)) ORDER BY r.relname)
 FROM pg_class r WHERE r.relnamespace=''hotels_published_architecture_private''::regnamespace AND r.relkind IN(''r'',''p'',''v'',''m'',''f''))) ';
CREATE FUNCTION hotels_published_architecture_private.assert_exact() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,public AS 'DECLARE c hotels_published_architecture_private.foundation_certificate%rowtype; b jsonb;
BEGIN
 SELECT * INTO STRICT c FROM hotels_published_architecture_private.foundation_certificate WHERE id=1;
 IF (SELECT count(*) FROM hotels_published_architecture_private.foundation_certificate)<>1
 OR c.predecessors IS DISTINCT FROM ''[{"signature":"hotels_guest_policy_private.assert_exact()","meta":["3c9c0adfe16be6f81ef9a6a350df812d6d076d99667a36520197818ab52e477a","64ca60810999cc4110da7b2e78c07b6eb8831820a4ad8376b9b0eeddc9275d6f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"hotels_guest_policy_private.historical_hotel(jsonb)","meta":["d781586ad40137fe5f90354fc468d221fbd0288ce571fb99af4d410a21c6241b","776c93d4614c71ccebcce2754ceade6f817dd39491401319af8068dd2fe04615","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_hotel jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_guest_policy_private.original_definition(oid)","meta":["99b16ba76d2cfa3c86370e0fd4c9dc0575cb447c68d108e5bd332dac395f84f6","d371c72e9a45b096fc11d288a810cf92d6270f25eca9be2f3b84b779690d8abf","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_guest_policy_private.original_source(oid)","meta":["e9989350cadedab22bb961f825314885210bee91f55a0178762c656761a09545","a055ccb717628c7cf5b925ad8043f773f55d3ba106b5f78e516970074613edda","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_guest_policy_private.raw_metadata(oid)","meta":["65e9d9a19c19f1e8281861752f6f7be2dcba7720fda4810a435a750ad14531b0","16ff13fdd37b8f77bb273cca6ed8989e64dbe1d13eb7054ae4770b4ad8a7ef1b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_guest_policy_private.relation_catalog()","meta":["b1c6e84dfe0ccfd4fea4ab41537060c155e303dcce77aa967bfa09469cc3413c","e6cbab5a7c12d50b269d6e5a74711b43f95f17f82ee7c9ed7900f04f059cffa6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.actual_flags()","meta":["ecd751821530611bfe8b925fa5bb73c408def4823acc1d794b70d6e5bb89fb59","962a73c55a3c98bfd3a9f3d482b65d58e99d994402e402974d374d8d1c3b76fa","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.catalog_snapshot()","meta":["a9daaad29c3561c8191707fcef258d3fb734705058c4b15ec857ef2e554f5aa7","c19d455d09b6f70cd4f3a5a8fcb53e0d023b15f1909e622b1ba505e5955e1c9a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.chain_state()","meta":["a9bafdb21a9cce7007e14a25686a1c17606eaf2586b9778368aa9be25eba4c24","ebf51ccb03f5cc99557c75c652c4ac5df3615a7172dd547cc3fdcf8cb0cb0cd1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.hash(jsonb)","meta":["0efcedbc625bdd5c0e6dc3f27a59e846460fe328880fd562d3f0de352c913b5a","20cfb347b6a0a3a2e5f336c49502db4b971a09ac8d42b9d2761bbcd9f689419b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",false,false,true,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"hotels_lifecycle_private.metadata(oid)","meta":["2b49509d355fc1078aafed91f4f9307c3d55413169d7e514cab68f9e1faf760d","a142b14c75138d354bcebefc01ef04cbf5f7567fd1278c8017e08a813cdaf285","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.partner_connection(uuid, uuid)","meta":["f46e6a3fb6e534739c91a61abeec102c32b67500b7d597d954ea01e57a3dedbc","69d6f8ce807885f9ae0017bebddc9781f218c5f2df29d37181c5f5b8c5d50ce2","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid","uuid, uuid","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.predecessor_definition(oid)","meta":["f9ce2c676af6004f902b82e4ee7e8d7e3e7436f12a558bea694263adfe3a3b8d","e0e8e3c59a2129cdcc7e5abdc143a1712c744682df69b6465c31c08cea42dcac","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lifecycle_private.predecessor_flag_exact(text, boolean)","meta":["9b1a2be02f556e7797922aceeb61211355dd576501598206b93bf0796612f11e","3f04b84001f1726d6f522ef71ac8ebbf358a6ace0e659ff93d4927bd57c7775b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_flag text, p_actual boolean","text, boolean","boolean","u","f"]},{"signature":"hotels_lifecycle_private.predecessor_source(oid)","meta":["983d1c22792ce60fcd73e71d1e5f3bfe6869f3b2ba734e92a4364f924741819f","187726e4823dd2e6c1d648767dd2a0e1b6c87125045593823668cd81e0f211f2","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lifecycle_private.safe_state()","meta":["780d8fd7853a49d3cab639d8590a786fe88302b6f254c44b9d68b85932a0da7e","acfaa64ff3f8d11115c011b19e7742f53bc2b72d866a46c63011f2d7137ec507","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"hotels_lineage_private.catalog_fingerprint()","meta":["9798b885198ee02fc8b7154ce67d2caba98b885268ae29a8f486894032657084","a3206a944748159fc64b179eedd39b24db441a515dda4e7e6af1025f21ab8812","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","text","u","f"]},{"signature":"hotels_lineage_private.catalog_is_exact(jsonb, jsonb)","meta":["4767d2844cfd78f1ca6661c8bc2d756e3a1158985445b00c6b17524aa350419f","3394ba926e32ba5b2758c0639fd4860bebe039ef22fe4f208357f5f10068a078","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","current_jsonb jsonb, historical_jsonb jsonb","jsonb, jsonb","boolean","u","f"]},{"signature":"hotels_lineage_private.current_anchor_is_exact()","meta":["9640721b8192e8e60d983dd2115ee31a856d3afda150e7a68361d1a37e10a031","09b53f2cef94a22de26e236cac7c9a5b57de063e5d9a4f2b953421da77d43405","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"hotels_lineage_private.function_map()","meta":["fb0fac6e627924bbefe4d302ab885499cc1897bac1548012b4bbb1dcafed5a54","704a264f24fcd7a74f6f97b33976a1672f57ad8b158ae2750b1ac69d68c2629e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lineage_private.lineage_matches_historical(jsonb)","meta":["71a29e0880a00f5697a45b787009d8f8673f59a1267d40021bb4b8c38fbcc8dc","f99035c6fb8e06b70f88d323dba27263f86d813d6b4580bf164b339aa33b40dd","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","live jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_lineage_private.owner_constraint_tokens(text)","meta":["71b5fc65cefe575c1069bdd8e1a7d7c1a953c3e7614db0f38f0dc4270d315f66","fc8785e641b50ad5061070300cff8bc28ae87d826b25723dfe22a222f8e84a9f","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,true,false,"plpgsql","input text","text","text","u","f"]},{"signature":"hotels_lineage_private.permission_evidence()","meta":["6b59caafd6caa96a5df5c107910e3ce3dd5eb8776201e4e8e72aa3cb9bf365bc","6d3750550dec8402290508d3ab7554422e5f0050ded7935e248528bcc3301974","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"hotels_lineage_private.predecessor_definition_hash(oid)","meta":["17cf79369b87f8d42d603176badec258f56feeac7fc833cd479b413c732dd0da","ea7d2955263e19ca888bfb60f50b1a3a0204ecfb9c98ca90e02d8a0dcf23a96e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lineage_private.predecessor_source_hash(oid)","meta":["5af87a938445ef7db28016ad5de01e397dd93c4dc32f548940fd0866e595eb96","d633a11df77465cef30bec84ef5d3c596e07483ea9107d07460f18259b7660ef","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lineage_private.predecessor(oid)","meta":["f7371ac466fa1b3b95480d13e2447cd1817ae8a7bd76c439dd8673795d1f764c","3824d228b8e778e18490d3948ccaf5f9fc98d0eef50804e9d96fde8fe2dc4043","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_lineage_private.successor_binding_pin(jsonb)","meta":["d9fff1cd2a8eebb20670daa5a4ae33472f8a76a2f0b8be2dcb8b80f3018e038c","59f3faeabc8252eb6d9738eac99963c2c1bac4831d927542348f2eef61051c7c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",true,false,false,false,"sql","b jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_lineage_private.successor_manifest(integer)","meta":["cece5beeeec9d0bb1e72a9851f095792834010246f791445a5185c06e1298500","d46d52cf3836c52e178115c02146fa0dacd965c9d87d71231913188c8342bdcd","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",true,false,false,false,"sql","p_stage integer","integer","jsonb","u","f"]},{"signature":"hotels_lineage_private.successor_metadata(oid)","meta":["b332ed3e26a761f855d8ef6a005667f57938738633f4c0c22b5ee0718d026ebb","92e46301d758a60c140c2a93f068ec1f5ccf700c2cd04f1582b59db4114e751d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_lineage_private.successors_are_exact(text)","meta":["fcf5478ea42f47e6aa45ef2d7aa1a94828a92b3ba763e784b95efbba34fe4139","863038839343d9a2f107fe1770f3c2e1e80a4f29f1761b7219d016368be26a45","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_root_hash text","text","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.assert_exact()","meta":["e209551631678bf5c1e97036d1f0b30a50b12b9513f94b987056c5d5dc1a68d3","5703b0931913f4e71523c42d488925b1628550ff12cca8d40b011a4969f85755","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"hotels_partner_read_once_private.metadata(oid)","meta":["372e9d2743beb23df24eff2d23f7748f97fc8e7e42348a3ea9a97d8c6eaf08c3","88378c155ecac7441f30b91580cc91b7d145cf489e835bc40745f0ba4ba3a31e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_06b6ba66f8598192(jsonb)","meta":["e73900b38e7364eba18088e3d4b6fcc5c38fa75fea748ee311e4c758700fa999","0b3fbd40322e99c103bfd3743b2373868e80a09f8eae7649ba5a29082979eddf","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_326760525d39fd81(jsonb, text, boolean)","meta":["5143548687336ab2ad3bf7ad74cff70a066722ee7681e27b134fcbe9a957f2dd","15afd652ea5b575267362249b35d783705319d14a8863c2f2eaa0a4a1293ef75","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, p_flag text, p_actual boolean","jsonb, text, boolean","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_3590b4e257042f09(jsonb)","meta":["d7a7f86120015784fa45e13cc75997cc544e580e2009f0c16c197fb90244055a","dc9ee8e67e06eff56414973ff386441f714f7f4e4f5dcfba8ed4138132d178dd","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","void","u","f"]},{"signature":"hotels_partner_read_once_private.read_3a98b157088d7466(jsonb, jsonb)","meta":["845ee26c11ee172fb8831f1b32fc0e7539b303ad9bdfc8e37275c272a471c54e","b1e701657cd1cb8674b8eb19db05f0c98ff28fd39d36359daaabe1f64d7f7094","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, p_hotel jsonb","jsonb, jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_63e67309c0eb62b8(jsonb)","meta":["255dbd4658b4aad4aa8612f350527a618f5743f5c1428b49f2162ee9e9c4e50c","8f57ca9ebf95360e73b98e2c1048721852ef1963fdcd7f36e85eb039c930ae4e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_7546feecb3da2c1b(jsonb)","meta":["379a8f5c51a45f0b59df10190f53b64ea85bc086df4905c6c490f9c5b2c16652","8cc39a2fa365d3b85a34918b8d658de392c7aa8a3dcf6ddb1f72556763e6a646","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_7c61c7b83a83f59b(jsonb)","meta":["781773927e7babad9d1f713c643779d46071e5aa7f73ee12a6c151ef81163706","03fc082c3aef3380d62f0d3d0e2efb556e1e14d87480b7c28e9dcd9eded0a6b1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","void","u","f"]},{"signature":"hotels_partner_read_once_private.read_806282cb24f87125(jsonb)","meta":["a679f3667a2a3f4ae7727ddb7548c508ddd2036653745f1bb9a26ae76c3f233a","3858379df1c4ea0f5f4dc2ea1ec03a3e1c1ed80b600d878cae5572c42677ce9b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_9e863cbe183fb1f3(jsonb)","meta":["f0e16b8ab734ed6991f8651ac0def8eec90a8f0b51b50748cf54b9c10721bc4a","48f88a1744e4fb0bac413f1d90f37c43db54129792c93ab46d8308de95b1a55f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_a3533e7d7979ea15(jsonb)","meta":["7c62dfd4d6651b0b8fcb81dce1bf034dbbe579422cf4185f6abde85967f0b320","14a24ecbee9a05864e8099dd3af7982f9b6b2e9d149f3ff42ba91399858ad510","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","text","u","f"]},{"signature":"hotels_partner_read_once_private.read_a41f675cf9007752(jsonb)","meta":["48800766671c3a760983dfc8b1c76f95613b6fdac82525cd2342fd6015f06900","fb64c6786d15ada3aafd925b9a5051ea0e7a6c9b69eb55502ea490ee18c8700a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_bf842dd83e381815(jsonb, text)","meta":["ca346e8a921be1f95774d04ff6c8af47cd5459870cfd42a8737a97679b221525","7eae5e487950740110a1415102ffcbbcdfd5cb7d49a1ace7246cf1f4206b33ec","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, p_root_hash text","jsonb, text","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_c8415e562fc992ed(jsonb)","meta":["7846358e0cf067290fba1ed63f23a87821af1141f70c4eee66aab2d32119a033","b50b725833b881d16b6ed16435703246e5ef058646007cbdce2864e37fbb1c22","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_d31405a1a55a0f2b(jsonb, jsonb)","meta":["a4bca843b1765323e98b13610bf8073a5bd447a79c0af0c5a5a19a5c76728a12","81b6b01f62c22430297950522d56186d86a1f351fb327179c076bf6e78d004c9","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, live jsonb","jsonb, jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_d848c718a811c87c(jsonb)","meta":["8ff5f6fb3f6a251ac6081c25f409bfb1176b169fbc57c9ccc1676e6c486d1046","68c1bd1e992515ce6fb1fa38b1e25bd17cacbc10972711f3b0f4eb9fcfed55ef","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_dfbc6217b32ff0fc(jsonb)","meta":["67a390fbb9084ddbc453dbaabe999fdd38745c4e5743fb65c59ce3ceec2e7cf3","d1ac898b56884011f9505a1893ea9c77ccd70be936b812c40a28b0366ce3456d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_e9411f087eaf40a5(jsonb)","meta":["82afe9077f43205d20b86cb545d389a62079e6f4ae948e23cce814d0f68fab1b","8f1cfd81b8e134e395a753a388ae54b09b685ac1d47c948e341a3471012b2e3b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_f46b02a57427361e(jsonb)","meta":["4da7250d92c2adb866fd6043ec34264f7ed45bf31dcbf96b9b45f0885a7c179e","0c6e1520c1a34629dfbc10b05fb9b204fd63ae96b5f783ffce73d4b45e3619b3","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_stripe_dto_private.assert_exact()","meta":["27a6557461c65b339d4bc4aee6c9faf8f83748fe134d4b852c9e5f4dfb99287c","d7938495d53ff4072b314db3045f80ffc796d3ef886d65699e24c1ac6f066c95","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"hotels_stripe_dto_private.helper_catalog()","meta":["95c4c33e0d17c6c9e175aa3b621dca32da8830691ab761eff6a4e9552cf0c21f","000be517942288f4f8c289ea4560e2e2a9e1c21bb42a48044a7747118b7f770d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_stripe_dto_private.predecessor_definition(oid)","meta":["73decaf4897d6f04354399f8cfe1d8a8c5c7e8236e07c900b2d419c0f2277a4a","6c28a747c3654fa8427d15b64e275d4a751674cdf8b5c17cae6044e54a00d862","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_stripe_dto_private.predecessor_source(oid)","meta":["199d181264570cba6dd5eb0c370bd19c6da613dfd5d76717f3a1ac71d20ba78a","1c367cfe650319b703b1e2ee3b9c9f7276b519f945a7cccc7df18f9df6ed2226","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_stripe_dto_private.relation_catalog()","meta":["d7955b8131b837f37fece6afa3dc8e9e8b2a91aed90f787b1e4e10db2fed1b44","518b6f29d7aaec14b0ec1130780febf11b4b49f9804b6833d22c34ef542d26d7","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()","meta":["0469f5be71cfaeaa3656bb31cdbf9c89e4284817229ac98971d833216122bbf5","e7e719a1ea773c437a67dc60fe00958ad686cf28499ac58c6428868e40cd3566","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_v2_private.hotel_external_calendar_provider_function_source_hashes()","meta":["c6bd94ce0c4d1d01709acd21c64b2270a16d23c7bf9402ecdba0d669d8fc88dd","fa4ca6bc17982e43b47d9b83d288805aaa1f1cd8c574e2a94352d8be085849a5","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()","meta":["2d4c38d1c9214f0890ace1be2d481300577edadca66a64741bcd7ca2fce52c25","e000fbc317082ce691f89c131eb3ecf9f3fc0f93e7011a35811182676bbcbc07","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_7a_pricing_activation_transaction_is_preserved()","meta":["1e74c1b709abb1fb29de0283d37d03325fd0ed7d5f6a01567a73174f8c6e983e","3c4fda73f8834d38f1c5f21fb8d00e5cd78923109705ac2addcbe2c63b06549f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(uuid)","meta":["26f5b9eacf9f77e7530607b7bab3f1fff1cc8a3e8c184ef1604e8a7d3a3364ad","49d37798ff060978dabcac1fcc1d492d1ddfdde55d14e4b5e1e9f6cd85a75567","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_proposal_id uuid","uuid","boolean","u","f"]},{"signature":"public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()","meta":["448e4e89c367efe15c33c3c6fa0a92f4d9972957da130b365536c15bd25fc69a","dcd0e3362d7268c1b4ae58aab7727ec40a4c7694db99ab8e76f26b52ac65eed2","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_allocation_items_fingerprint(uuid)","meta":["ccbe8150dae1b9aa1d973f7cb6c1065933e9f6acb344bc96d2b6f7a9b3b6b9d7","a839aef0f576e0790ec78a2c8600132e2907278bfc569e74cf0ff96c807791c4","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_rule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_cancellation_policy_is_valid(jsonb)","meta":["986704ae01fc5c2e22ac88213d1258a59c209dde8e887260e1c5283e9050f7db","074da5dfeeceda1122738c37d50ec16f2db5b2e311bb0f02feb70c588e38d0ac","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_policy jsonb","jsonb","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_enforce_graph_limits(uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer)","meta":["44570d9e23af259bc8cc4b4f68dfbbdbd45cf222f295818b6cf6a68d67130e90","dd643f1a30608e69b5de850d6699b7137733da5709fc34864b14e2aaf3560211","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"v",true,false,false,false,"plpgsql","p_hotel_id uuid, p_plan_delta integer DEFAULT 0, p_rate_delta integer DEFAULT 0, p_schedule_delta integer DEFAULT 0, p_rule_delta integer DEFAULT 0, p_exact_delta integer DEFAULT 0, p_allocation_delta integer DEFAULT 0, p_schedule_tier_delta integer DEFAULT 0, p_direct_tier_delta integer DEFAULT 0, p_allocation_item_delta integer DEFAULT 0","uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer","void","u","f"]},{"signature":"public.hotel_v2_admin_c_https_url_is_valid(text)","meta":["c4a3bbe6837f5c9827f992ecb1c23f70f9eae3420ea91ab8cc065ac3679918c9","424431fd5fd7a4f5354b3c0eb3eb9efbca7676e86818984bbbb72878ed2aa63a","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"plpgsql","p_value text","text","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_i18n_is_valid(jsonb, boolean, integer, boolean)","meta":["3d0eb69f24c1ea01f5801620ca2b329d60b6daf71a7fad481410cfcb817eeccd","591a016311c237636bd8ba8453b74b0e4b4eb4118556ab2b32de481abd1d79e4","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_value jsonb, p_require_all boolean, p_max_length integer, p_allow_lf boolean DEFAULT false","jsonb, boolean, integer, boolean","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_immutable_contract(uuid, text, uuid)","meta":["db46ee490fa9fb8cd82d5433d9207cde3a3a96693ab05859b500e308f38251f1","2e5defe980cfbff6baa15c77cb28437cc8c1283a38723dea21b8f9e6131aafeb","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid, p_entity text, p_entity_id uuid","uuid, text, uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_c_is_promotion_entity(uuid, text, uuid)","meta":["a9fd1c33c724e2f59e7a33b0c5cb8852669a077dce3354dc0e8c0f5e8fdd5f59","3a0f7b76d241f0bd3d62272032d75dab6dab4e537692af1994fc516d5d48840c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid, p_entity text, p_entity_id uuid","uuid, text, uuid","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_lifecycle(boolean, text)","meta":["55b9a9d32714a22e1d58581c2b99e91a8f7bd6561c5d192c08eff43bb8a07278","20bd207f2185b5f9894278af85ca1a36050cc58abd48c14cda6cddf4854b10fd","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_is_active boolean, p_review_status text","boolean, text","text","u","f"]},{"signature":"public.hotel_v2_admin_c_pricing_control_snapshot(uuid)","meta":["5d40f4475e8bbda75d3f44820ba90cca32fbb57cc405191e2c1369d1fc5a01c3","093de65e46b1372af1c5a594b6659679df1ee1b48a66364d4fcb4c5055f7cb33","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_c_room_tiers_fingerprint(uuid)","meta":["ee26c41eec7084e69e087e872e9647da40cfe7677b4fc05de481c3a6a733aa3b","a9b23c3666526993093daf7fa224334a0239bed3567d4572d1f75c332c95e1fe","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_room_rate_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_schedule_link_fingerprint(uuid)","meta":["96c6f32ffa32ae360019d1cd742fd3c6e93a74f64fbde3b78c3c099810784572","c912d6b4d40edc1c287916cb09a9d43ad7ad2b4be834b10692647354a28dce30","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_schedule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_schedule_source_summary(text, jsonb)","meta":["67a0f1e32364a83db130aafefcd9381ce825ca76884c510368f9551b407b72c0","37cc8779efa9cbd6ed99933cf6c8ffae83948becd62fefef68d657985d3f586e","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"plpgsql","p_source text, p_reference jsonb","text, jsonb","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_c_schedule_tiers_fingerprint(uuid)","meta":["914eaad5d7ab853758e1027480a1a113b5b64ffcbb9532b5a0125bbef1585891","f21629eec968c6ea467fb564acabb14885bf61ef7938ac8eac91a082d7d3dc28","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_schedule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()","meta":["3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35","0c5e70d6a35386dfbbaaeb15b54de5d9de215d7f6e1195c6a4e881960b98ce4a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_admin_d_current_foundation_snapshot()","meta":["677c8fba8970df369b356bf76fb42e07f3884fdcc058407151ea9d67f847bd62","9cbfd3fd7b3cd37045f867f278080cb7d010b8662480362bf65759ac1557eef6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_d_hash(jsonb)","meta":["d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828","1061e7c1549ef04fe3d3c657cd503d7f01be56f263e57024a6e811acd61e90ab","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",false,false,true,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"public.hotel_v2_admin_d_protected_fingerprints()","meta":["a6706c4bdad2180e8cb733949a0084f4355068555ad1014cea340f760e19f5f4","06ba8695d5431e2f5eb29082d4b667a94d3462e32946197032cbfe75ec49c92a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_d_snapshot_external_base(uuid, date, date, boolean)","meta":["0d8e57d5bb06811f3ad39f6d4a638783d4517bf6c0b660a64a551790059e625c","c01e624bdc9ce151093bd36ad6f468d46dc386ada46a6e105027d016213b6d97","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"v",true,false,false,false,"plpgsql","p_hotel_id uuid, p_from date, p_to date, p_require_admin boolean DEFAULT true","uuid, date, date, boolean","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_d_snapshot(uuid, date, date, boolean)","meta":["7f665d523ae4cd0ecd9183645e50b2898426e1e62fd1bd74b652b87a227c1e7b","826e8bf6ede1d20c84a24b1a61fd002d9ac1226e612ed7ccba2dd3dbc8fdaefe","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"v",true,false,false,false,"plpgsql","p_hotel_id uuid, p_from date, p_to date, p_require_admin boolean DEFAULT true","uuid, date, date, boolean","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_get_seven_arches_reviewed_pricing()","meta":["662c0e442aec46ee07f56ec5bac7a945af4613c15f76130809db4f9f8efa33be","39388f9ae2efeef1695d6e4e5369a6891ea64c26ad420bde71ea36e815de0aaa","postgres","{authenticated=X/postgres,postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_external_calendar_activation_function_fingerprints()","meta":["4050571cca29b2e8210f01806e8af643e484af6039985a0d2517b89ada5c2693","fd9c72053dfeee7ebef53c1a32dc706ff2fe3c777af23bb84863eb76d154c4b4","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_external_calendar_ics_source_type_is_supported(text)","meta":["36b05e8b654ae203ddd889c817464322e134cec638e1802acf8ae2092105c5d8","d88d33143e83da36247ad40d7ae8e0a7fd73e61c4f8ce7807bca5cc17c4c5378","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_source_type text","text","boolean","u","f"]},{"signature":"public.hotel_v2_external_calendar_protected_fingerprints()","meta":["f432744ec7753928726b3a4d4c999183d6f1f394217aa35182f594cd05b39d49","3adbe49659edfb0e9bad33876403f9c6459d1070baf38017dcc1fb06f85234db","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()","meta":["93cfd999504d4cd55e22252dec42a0ad96e0d35d5ed336333cfb2c7da35d2ff9","3f10cace4ac17410173c5f675a8e4b0cbd9146c112bb618cd7ba2affdb3bbcb1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_external_calendar_provider_sources_are_attributable()","meta":["78cef0753a71a5bf7304f0a627fdf687b12998b80e84626d59d41884dc522d68","d334acaea0ce017580be057634c4b956ec4041072faed4a11488b5e6f4a73333","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_external_calendar_site_settings_fingerprint()","meta":["8e88d7f4778e65afda80b98a9ba4b32a7ed7c56ae4022312bedcfd6f2b8e45f9","69370fd80f93f9f6df4f4f46613f625ff03e3f7d6c321952b3c15b51c893d382","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","text","u","f"]},{"signature":"public.hotel_v2_external_calendar_worker_hash(jsonb)","meta":["d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828","dedbffac95633e08fb511d9ff87b8213b0ceda62f580348ff860a64520cd49a2","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",true,false,false,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"public.hotel_v2_h2a_keys_allowed(jsonb, text[])","meta":["ad7d11bdbc9f1351e300ceaf9dc0e69b95464b0f8a4b6cd4fbdb179f77ae65e3","9c72b1257ffce0a67738723374b558eff16bf40cfbde2c2bb7553c5599c0e169","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_value jsonb, p_allowed text[]","jsonb, text[]","boolean","u","f"]},{"signature":"public.hotel_v2_h2a_require_admin()","meta":["2f1cc975916dbc86a63d348135a2ff83de50d9f31c20e70219257d476296fa3d","a44747b393c91606662d5cf110aca0ff31ea10501e7ae6e3eb0d838d7dccd3aa","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"public.hotel_v2_h2b1_children_policy_valid(text, integer, boolean)","meta":["fd4230ea0afb7b93ec7579714206a7f536f12db942b38fc0d125e4e19ff7030e","c75b718df46145d70ba4f26b84b451c25dfa7cceb4608819b4e01dca054bf6c5","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_policy text, p_minimum_age integer, p_allow_inherit boolean DEFAULT false","text, integer, boolean","boolean","u","f"]},{"signature":"public.hotel_v2_h3_1_codes_valid(text[])","meta":["b42b2345900af0c711871b1baff071931edd28e7135baa3f4511e789b049d3af","46275945b98f3310b6598dc1dfc48a0861c44b0284e20efabee23440be200ff5","postgres","{authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_codes text[]","text[]","boolean","u","f"]},{"signature":"public.hotel_v2_h3_1p_allocation_preview(uuid)","meta":["4964aa46351c50156f544dcaba03afae344cf5ef74164164eee5e930b2534e3f","5b6cf01e7ed53f46cc7a9786c05cbb7048292b5409f5f658f229ff99c0c64143","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_1p_expected_pricing_guest_count(text, uuid)","meta":["2ef5ca19ba7ea719ed67c190e0daef8b2452aea2aa320c121c3be041ab1da3a1","7ba888ed55f5d337a13ccb59771c3e01c42d2d9bec210e862be211d56b4ea344","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_rule_code text, p_room_type_id uuid","text, uuid","smallint","u","f"]},{"signature":"public.hotel_v2_h3_1p_parity_snapshot(uuid)","meta":["f4811812d61e75a7ba5634cdd555b0c608f6a12bf65b4aae745bd1dd007d0b9e","0a009fb68ac2ce44fcb4706e3a7064be40887061f58a540d9bc1ffad83f29040","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)","meta":["190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5","39b2e872c8c970b973e53b7139e6fe99fa93cc7f0a43769a4ebd4aca185aa151","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"plpgsql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_1p_schedule_tier_fingerprint(uuid)","meta":["3dc069f917328f11c67f9ebb78c3ad13951fdcea0af9372ee6eeec10a46a55fe","c3997cd2af659d9324b21dfa777ed414dcbe26fe3f928d0b06300b3e387de9b4","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_schedule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_h3_1p_source_tier_fingerprint(uuid)","meta":["d3fb212c1f0350fa572e583e13dd2979e5d3336f962690ce9126273c0082d926","fd06dd52185d0a01559405b4c2dbf0f13f2856a85d2d51fd828b31c15a385d9f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_h3_2a_capability_catalog()","meta":["a01f1e7484b1c8253fef8d8baf6d4f705497cacd3473c45de4bdf015821f68fe","4db7eb03ea3cf595523568970898b768c4eb6ac2597b5dabf3e181814d358332","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","","","text[]","u","f"]},{"signature":"public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)","meta":["be3510f53b2c8034ce74433bbec8718f52301c1ee998179c5f1e55aab49d0cfe","03f7ade0d62881ec6e4714798e93affa725311a30d7ae4e3c3489c5041c5bc84","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",true,false,false,false,"plpgsql","p_value jsonb","jsonb","boolean","u","f"]},{"signature":"public.hotel_v2_h3_2a_permissions_snapshot(uuid)","meta":["2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3","ee616f51785c5a667077690537fe46252fb40d7d4af1fb13cc7e34c710180a35","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_assignment_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2a_require_partner_hotel_access(uuid, uuid, text, boolean)","meta":["2b5702a60866205e56c6ecb7492581cf1b262098f5142b39559de5c6feb012cf","b3eb3fdf0b50ecf0b72556db4308b665b5efb703abb5a251a7002d4ea03dfae6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid, p_capability text DEFAULT NULL::text, p_owner_only boolean DEFAULT false","uuid, uuid, text, boolean","uuid","u","f"]},{"signature":"public.hotel_v2_h3_2a_require_partner_membership(uuid)","meta":["90ad483c8ae6c061d69f9b05e2a7b205219a7dbf37047e750a0a507835814b50","5b7150da151427a43e1af1daec64fa0a95406f4467958e2c6278db55be8b3fa6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_access_snapshot(uuid, uuid, text)","meta":["7f8cb70e2c7034d17f03377cf7ffe3d5648e47dc27800e9ac3542bc95e2bb5b4","d4075c2ba3967d51f01473b9cbcc83b14740ee15130b709e1d33a78efa29704c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid, p_capability text","uuid, uuid, text","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_commission_policy(uuid)","meta":["533a819b7903a4247196955a555a32c4a26b4bea4450814017334c83903ace77","fd370f0873dc983fffb056dd2125d3d6a396787cb244badb3d1900e1fb884e40","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_exact_price_projection(uuid)","meta":["41f8609b712906301ef93e0eb438188ce1989e1114ccea1dcf3f55e1775f438b","aae829f7fd4ea4581b629c73f36fe281e31e9d0e98cc040a61a56ccbf2836a29","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_flags_off()","meta":["c4866c37cc2a4c5569e9efee957db4f13cc641290e2b2ea4b96f6265e9a2691f","65688b0eead33ba1011655ddf3f86969b0ae0659cdbd8e951e6d7c52e89907f6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_h3_2b_hash(jsonb)","meta":["d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828","2f5016299bbcace7c05c7cf20d111ca3cc9bbbd7a3b525007b66b7ee5921722e","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"public.hotel_v2_h3_2b_protected_fingerprints()","meta":["7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2","479b55caffc7051e454b417f89f71939359b6965c896a53236a6685c0ea05c2d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_partner_get_seven_arches_reviewed_pricing_114488(uuid, uuid)","meta":["a3741a5c83780baed0b821834b4e0c72ba614d74aa9c349bc3d13c4641665b42","5f6679aa86ff7a894892f1969e825e2222fa9b70d138b91f17181985cc8e226c","postgres","{authenticated=X/postgres,postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid","uuid, uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_partner_get_workspace(uuid, uuid, date, date)","meta":["ae51c6ed5516fe7c37b684ac843572af0d2b23b08ca28759b58c926c97df9798","7e9fb042f44426615b299b482739a8b2f0e4b7b696ef5d5a6e96317dbe2fd85e","postgres","{authenticated=X/postgres,postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid, p_from date, p_to date","uuid, uuid, date, date","jsonb","u","f"]},{"signature":"public.hotel_v2_partner_workspace_function_lineage_is_exact()","meta":["e1bbb882e4ed18b28ff638262aedd9f29692a520d62aa016b6ef2b82f79a7757","456c382b52be5ebdefa219870d66fa4b9bbf73d88b0c9f33e754ecd61d9c42f7","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_independent_pricing_activation_lineage()","meta":["2c40bc68f2d7dd54bb50654d0ca3e5a528509964377fc57e460718e7baa82fd9","c377770fd48822ba40ab1385fe367bd4f307000e9b0cfc2ed1ce91f1d9f2553e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_independent_pricing_legacy_projection()","meta":["b596013a158f7358a1ca7514bff6228d0dc88c2e4e1c7b2e4f6ee7437ecbac75","90ce815dee027915030ea24793e4c2aaf7d54b72de50a386169561ed159be73f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()","meta":["9c891fee2fa897b4bb10940269d73d107b2e0d718247db0e61d9dc99a4b2b6bd","81df6679ef248287bad82861cd0a5f1e6efb7a0d436ddc7a5e04b50895b9f0c0","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_owner_capabilities()","meta":["cd66ff70012c3c3e155eb62ae8f398278ad162878f976cc620caa86a2dab3fd6","763120a749bf186709ffbcc3de59240a5a3bdb52f776f1db1ace3bd51d7c8f4a","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()","meta":["03dbfb03f1219361abe2173ee8e2b079b4191f6ab83d664fece9833926aeba94","bafa94cf095ad4b43b8fbdc7f52e0ca83ac2e7c25af7bb21721384dc26f2c8dc","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_pricing_activation_current_is_safe()","meta":["57cabf1992e9f03f5411715b59c29aea51501aa3a91b403d36e61264c394e420","c45a5617b905f6d0daaa9bbcb05cece78846043935ca6471317bb0284f349d4b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()","meta":["04462d1fc2ade7d2c4574e7caef96f323cbb98a31d869c6f02e8f09dffe1dda4","e92044e10d61c2bb96ec0de0ca376167627856747bb8c58c24ba32315104b215","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_pricing_scoped_lineage()","meta":["11f6a865ddea542368bf76e707b0ec660a7245742a3db3441e99b9de22f7224d","7e6b0b496ec1a358bf7e6065df4dc936a5fe0351facad8b605a2240bb95f7287","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()","meta":["46cc1c679ce139cc79c808ecd264264393c27c99a7f67f192c2ea0c56b08456d","8c7e337ce3afddefb4f3dd3399064b269e035cca3b57845933ccb97dd8da2c5e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()","meta":["6c6f107b2d90abd7d9216cbd10c5d3817661250cdc35d52858c9ba923cfda258","e2dde9cf51680e038246104e512b0715c0662683d5bcfe684f0c6c4833ccaf72","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()","meta":["3ff36a3245901ea37f53e6dfbf9213e1bc72f127b7531041904833d5993eef17","8ffd62d7ee5c5ebff9d63aea826c4c7fb2086adc2c20378508b049ef73bd9dd9","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","text","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_current_state()","meta":["daa90ae3ec5515f22f8be8034276738d135bf3839bdd539dde99fe16636889c8","6658273707d91f56172b4946c3b1560da7b44c80dd40afe4df87f3e8ff655ab3","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_oracle()","meta":["50fee36eb4e4c7a11ad0baf0188a9f2042bde3678c5d835b3e8b7ece992ebfef","1b4b1497db1b0e4f07a550c4a5475c044f517041cc75b878331d3039104046a1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()","meta":["ca914b81c1b0d22ad186669010b27b13c946949e73bfc84ce8065bea037e5424","cea8de2e25ff83aa1834cbb6c1ca4b78e73de145fc07f32234136da9d9a95649","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()","meta":["6e53ef01e748a54cb1dbbae5d35010a343aa4331a0c5450a4d2fc967a1e253fd","65a7931d8ac0d3c8926d9543ad4aed3a349f967a9a8b71d56c0cfd14ffc5858c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()","meta":["17b801fefd47c93859f1e7868b606d3d56288dd590f931aa4c385148a72d85cc","b4d25cd69edb4c849abfad7e6d6da7e12a0ef4fc480201428ef1d251a941862e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.is_current_user_admin()","meta":["581f1801056e5aee65c0144151b41dea41910d2c8e22639873ff659487e8a255","b22b4cf0fc9af5cdf67e880eb404de038dcea9cfa9220e11541da17e45720899","postgres","{anon=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres}",["search_path=public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]}]''::jsonb
 OR c.helpers IS DISTINCT FROM (SELECT jsonb_object_agg(p.oid::regprocedure::text,hotels_published_architecture_private.metadata(p.oid))
   FROM pg_proc p WHERE p.pronamespace=''hotels_published_architecture_private''::regnamespace)
 OR c.relation_catalog IS DISTINCT FROM hotels_published_architecture_private.relation_catalog()
 OR c.entrypoints IS DISTINCT FROM (SELECT jsonb_object_agg(value,hotels_published_architecture_private.metadata(to_regprocedure(value))) FROM jsonb_array_elements_text(''["public.hotel_v2_admin_get_published_architecture_conversion_114489(uuid)","public.hotel_v2_admin_convert_legacy_hotel_to_v2_114489(jsonb,uuid,text)","public.hotel_v2_admin_apply_property_control_plan_114489(jsonb,uuid)","public.hotel_v2_admin_apply_partner_property_proposal_plan_114489(jsonb,uuid)","public.hotel_v2_partner_get_workspace_114489(uuid,uuid,date,date)","public.hotel_v2_public_get_seven_arches_display_114489()"]''::jsonb))
 OR NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname=''hotels_published_architecture_private'' AND n.nspowner=''postgres''::regrole
   AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault(''n'',n.nspowner))) a WHERE a.grantee<>n.nspowner))
 OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace=''hotels_published_architecture_private''::regnamespace AND
   (p.proowner<>''postgres''::regrole OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault(''f'',p.proowner))) a
    WHERE a.grantee<>p.proowner)))
 OR EXISTS(SELECT 1 FROM pg_class r WHERE r.relnamespace=''hotels_published_architecture_private''::regnamespace AND r.relkind=''r'' AND
   (r.relowner<>''postgres''::regrole OR NOT r.relrowsecurity OR NOT r.relforcerowsecurity
    OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=r.oid)
    OR EXISTS(SELECT 1 FROM aclexplode(coalesce(r.relacl,acldefault(''r'',r.relowner))) a WHERE a.grantee<>r.relowner)))
 THEN RAISE EXCEPTION USING errcode=''55000'',message=''hotels_114489_foundation_certificate_drift''; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(c.predecessors) LOOP
  IF hotels_published_architecture_private.metadata(to_regprocedure(b->>''signature'')) IS DISTINCT FROM b->''meta''
  THEN RAISE EXCEPTION USING errcode=''55000'',message=''hotels_114489_foundation_predecessor_drift:''||(b->>''signature''); END IF;
 END LOOP;
END;';
ALTER FUNCTION hotels_published_architecture_private.metadata(oid) OWNER TO postgres;
ALTER FUNCTION hotels_published_architecture_private.relation_catalog() OWNER TO postgres;
ALTER FUNCTION hotels_published_architecture_private.assert_exact() OWNER TO postgres;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hotels_published_architecture_private FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.workspace_snapshot_external_base_114489(p_hotel_id uuid, p_from date, p_to date, p_require_admin boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS '
declare
  v_as_of timestamptz:=statement_timestamp();
  v_token text; v_result jsonb; v_valid_until timestamptz;
begin
 IF p_hotel_id IS DISTINCT FROM ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid THEN
  RAISE EXCEPTION USING errcode=''42501'',message=''hotels_114489_target_required'';
 END IF;
 PERFORM hotels_published_architecture_private.assert_exact();
 PERFORM hotels_published_architecture_private.require_lifecycle();
  if p_require_admin then perform public.hotel_v2_h2a_require_admin(); end if;
  if p_hotel_id is null or p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_d_invalid_availability_query'';
  end if;
  if not exists(select 1 from public.hotels where id=p_hotel_id) then
    raise exception using errcode=''PT404'',message=''hotels_v2_admin_d_property_not_found'';
  end if;
  if (select count(*) from public.site_settings)<>1 or not exists(select 1 from public.site_settings
      where id=1 and hotels_lifecycle_private.predecessor_flag_exact(''hotel_rooms_v2_enabled'',hotel_rooms_v2_enabled) and hotel_external_sync_enabled in(false,true)
        and not hotel_instant_booking_enabled and hotels_lifecycle_private.predecessor_flag_exact(''hotel_stripe_connect_enabled'',hotel_stripe_connect_enabled))
     or (p_hotel_id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca'' and not exists(
       select 1 from public.hotels where id=p_hotel_id and architecture_version IN(''legacy'',''rooms_v2''))) then
    raise exception using errcode=''55000'',message=''hotels_v2_admin_d_public_activation_guard'';
  end if;
  if (select count(*) from public.hotel_room_types where hotel_id=p_hotel_id)>1000
     or (select count(*) from public.hotel_room_rates where hotel_id=p_hotel_id)>5000
     or (select count(*) from public.hotel_units unit join public.hotel_room_types room
       on room.id=unit.room_type_id where room.hotel_id=p_hotel_id)>100000
     or (select count(*)*(p_to-p_from+1) from public.hotel_room_types where hotel_id=p_hotel_id)>62000
     or (select count(*)*(p_to-p_from+1) from public.hotel_room_rates where hotel_id=p_hotel_id)>310000
     or (select count(*) from public.hotel_daily_inventory inventory join public.hotel_room_types room
       on room.id=inventory.room_type_id where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to)>62000
     or (select count(*) from public.hotel_unit_calendar_blocks block where block.hotel_id=p_hotel_id
       and block.from_date<=p_to and block.to_date>=p_from)>62000
     or (select count(*) from public.hotel_calendar_overrides exact where exact.hotel_id=p_hotel_id
       and exact.stay_date between p_from and p_to)>310000
     or (select count(*) from public.hotel_rate_rules rule join public.hotel_room_rates rate
       on rate.id=rule.room_rate_id where rate.hotel_id=p_hotel_id
         and rule.valid_from<=p_to and rule.valid_to>=p_from)>310000
     or (select count(*) from public.hotel_booking_room_allocations allocation
       join public.hotel_bookings booking on booking.id=allocation.booking_id where allocation.hotel_id=p_hotel_id
         and (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
           select 1 from public.hotel_inventory_commitments commitment
           where commitment.booking_allocation_id=allocation.id and commitment.status=''active''
             and commitment.stay_date between p_from and p_to)))>10000
     or (select count(*) from public.hotel_bookings booking where booking.hotel_id=p_hotel_id
       and booking.status in(''pending'',''confirmed'') and booking.arrival_date<=p_to and booking.departure_date>p_from
       and not exists(select 1 from public.hotel_booking_room_allocations allocation
         where allocation.booking_id=booking.id and allocation.status=''active''
           and allocation.booking_updated_at=booking.updated_at))>10000
     or (select count(*) from public.hotel_inventory_holds hold_row where hold_row.hotel_id=p_hotel_id
       and exists(select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
         and commitment.stay_date between p_from and p_to))>10000 then
    raise exception using errcode=''54000'',message=''hotels_v2_admin_d_snapshot_technical_limit_exceeded'';
  end if;

  select min(expiry) into v_valid_until from(
    select expires_at expiry from public.hotel_daily_inventory inventory
      join public.hotel_room_types room on room.id=inventory.room_type_id
      where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to and expires_at>v_as_of
    union all select expires_at from public.hotel_unit_calendar_blocks
      where hotel_id=p_hotel_id and is_active and expires_at>v_as_of and from_date<=p_to and to_date>=p_from
    union all select expires_at from public.hotel_inventory_holds
      where hotel_id=p_hotel_id and status=''active'' and expires_at>v_as_of
        and exists(select 1 from public.hotel_inventory_commitments commitment
          where commitment.hold_id=hotel_inventory_holds.id and commitment.stay_date between p_from and p_to)
    union all select case when availability_updated_at is null then
        case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
      else availability_expires_at end
      from public.hotel_calendar_overrides where hotel_id=p_hotel_id and stay_date between p_from and p_to
      and case when availability_updated_at is null then
        (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null)
          and is_active and expires_at>v_as_of
        else availability_active and availability_expires_at>v_as_of end
  ) expiry_rows;

  select public.hotel_v2_admin_d_hash(jsonb_build_object(
    ''hotel'',p_hotel_id,''from'',p_from,''to'',p_to,
    ''property'',(select jsonb_build_object(''architecture_version'',architecture_version,''booking_mode'',booking_mode,
      ''minimum_stay_nights'',minimum_stay_nights,''currency'',currency,''timezone'',timezone) from public.hotels where id=p_hotel_id),
    ''operational_profile'',(select jsonb_build_object(''maximum_stay_nights'',maximum_stay_nights) from public.hotel_property_operational_profiles where hotel_id=p_hotel_id),
    ''rooms'',coalesce((select jsonb_agg(jsonb_build_array(id,status,inventory_mode,base_inventory_count,
      max_occupancy,capacity_adults,capacity_children) order by id) from public.hotel_room_types where hotel_id=p_hotel_id),''[]''),
    ''units'',coalesce((select jsonb_agg(jsonb_build_array(unit.id,unit.room_type_id,unit.status) order by unit.id) from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id where room.hotel_id=p_hotel_id),''[]''),
    ''inventory'',coalesce((select jsonb_agg(jsonb_build_array(inventory.room_type_id,inventory.stay_date,
      inventory.sellable_units,inventory.sellable_units_mode,inventory.closed,inventory.closed_mode,
      inventory.reason,inventory.expires_at,inventory.version) order by inventory.room_type_id,inventory.stay_date)
      from public.hotel_daily_inventory inventory join public.hotel_room_types room on room.id=inventory.room_type_id
      where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to),''[]''),
    ''unit_blocks'',coalesce((select jsonb_agg(jsonb_build_array(id,version,is_active,expires_at is null or expires_at>v_as_of) order by id) from public.hotel_unit_calendar_blocks where hotel_id=p_hotel_id and from_date<=p_to and to_date>=p_from),''[]''),
    ''overrides'',coalesce((select jsonb_agg(jsonb_build_array(id,room_rate_id,stay_date,availability_version,
      case when availability_updated_at is null then
        (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null) and is_active
        else availability_active end,
      case when availability_updated_at is null then
        case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
        else availability_expires_at end,
      closed,closed_mode,closed_to_arrival,closed_to_arrival_mode,closed_to_departure,closed_to_departure_mode)
      order by id) from public.hotel_calendar_overrides where hotel_id=p_hotel_id and stay_date between p_from and p_to),''[]''),
    ''room_rates'',coalesce((select jsonb_agg(jsonb_build_array(id,room_type_id,rate_plan_id,is_active,review_status) order by id) from public.hotel_room_rates where hotel_id=p_hotel_id),''[]''),
    ''daily_rates'',coalesce((select jsonb_agg(jsonb_build_array(dr.room_rate_id,dr.stay_date,dr.closed) order by dr.room_rate_id,dr.stay_date) from public.hotel_daily_rates dr join public.hotel_room_rates rate on rate.id=dr.room_rate_id where rate.hotel_id=p_hotel_id and dr.stay_date between p_from and p_to),''[]''),
    ''rules'',coalesce((select jsonb_agg(jsonb_build_array(rule.id,rule.availability_version,
      rule.valid_from,rule.valid_to,rule.weekdays,rule.priority,rule.is_active,
      rule.closed_to_arrival,rule.closed_to_departure) order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate on rate.id=rule.room_rate_id
      where rate.hotel_id=p_hotel_id and rule.valid_from<=p_to and rule.valid_to>=p_from),''[]''),
    ''bookings'',coalesce((select jsonb_agg(jsonb_build_array(booking.id,booking.status,booking.updated_at,
      booking.arrival_date,booking.departure_date,booking.num_adults,booking.num_children) order by booking.id)
      from public.hotel_bookings booking where booking.hotel_id=p_hotel_id and
        (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
          select 1 from public.hotel_booking_room_allocations allocation
          join public.hotel_inventory_commitments commitment on commitment.booking_allocation_id=allocation.id
          where allocation.booking_id=booking.id and allocation.status=''active'' and commitment.status=''active''
            and commitment.stay_date between p_from and p_to))),''[]''),
    ''allocations'',coalesce((select jsonb_agg(jsonb_build_object(''id'',allocation.id,''booking_id'',allocation.booking_id,
      ''version'',allocation.version,''status'',allocation.status,''booking_status'',booking.status,
      ''booking_updated_at'',allocation.booking_updated_at,''current_booking_updated_at'',booking.updated_at,
      ''arrival_date'',booking.arrival_date,''departure_date'',booking.departure_date,
      ''room_type_id'',allocation.room_type_id,''rate_plan_id'',allocation.rate_plan_id,''room_rate_id'',allocation.room_rate_id,
      ''unit_ids'',allocation.unit_ids,''units_required'',allocation.units_required,
      ''allocated_guest_counts'',allocation.allocated_guest_counts,''pricing_guest_counts'',allocation.pricing_guest_counts,
      ''commitments'',coalesce((select jsonb_agg(jsonb_build_array(commitment.room_type_id,commitment.stay_date,
        commitment.unit_id,commitment.units,commitment.status) order by commitment.room_type_id,commitment.stay_date,
        commitment.unit_id nulls first,commitment.units) from public.hotel_inventory_commitments commitment
        where commitment.booking_allocation_id=allocation.id and commitment.status=''active''),''[]''::jsonb)) order by allocation.id)
      from public.hotel_booking_room_allocations allocation join public.hotel_bookings booking on booking.id=allocation.booking_id
      where allocation.hotel_id=p_hotel_id and (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
        select 1 from public.hotel_inventory_commitments commitment where commitment.booking_allocation_id=allocation.id
          and commitment.status=''active'' and commitment.stay_date between p_from and p_to))),''[]''),
    ''holds'',coalesce((select jsonb_agg(jsonb_build_array(hold_row.id,hold_row.version,hold_row.status,hold_row.expires_at,
      (select min(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status=''active''),
      (select max(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status=''active'')) order by hold_row.id)
      from public.hotel_inventory_holds hold_row where hold_row.hotel_id=p_hotel_id and exists(
        select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
          and commitment.stay_date between p_from and p_to)),''[]''),
    ''commitments'',coalesce((select jsonb_agg(jsonb_build_array(id,version,status) order by id) from public.hotel_inventory_commitments where hotel_id=p_hotel_id and stay_date between p_from and p_to),''[]''),
    ''expiry_boundary'',v_valid_until
  )) into v_token;

  with room_days as(
    select room.*,day_value::date stay_date
    from public.hotel_room_types room
    cross join generate_series(p_from::timestamp,p_to::timestamp,interval ''1 day'') day_value
    where room.hotel_id=p_hotel_id
  ), cell_values as(
    select rd.id room_type_id,rd.stay_date,rd.inventory_mode,
      case when rd.inventory_mode=''unitized'' then
        (select count(*)::integer from public.hotel_units unit where unit.room_type_id=rd.id and unit.status=''active'')
        else rd.base_inventory_count end physical_capacity,
      inventory.version inventory_version,
      case when inventory.room_type_id is not null and (inventory.expires_at is null or inventory.expires_at>v_as_of)
             and inventory.sellable_units_mode=''set'' then inventory.sellable_units
        else case when rd.inventory_mode=''unitized'' then
          (select count(*)::integer from public.hotel_units unit where unit.room_type_id=rd.id and unit.status=''active'')
          else rd.base_inventory_count end end configured_sellable_units,
      coalesce((select count(distinct block.unit_id)::integer from public.hotel_unit_calendar_blocks block
        join public.hotel_units unit on unit.id=block.unit_id and unit.room_type_id=rd.id and unit.status=''active''
        where block.hotel_id=p_hotel_id and block.room_type_id=rd.id and block.is_active and block.blocked
          and (block.expires_at is null or block.expires_at>v_as_of) and rd.stay_date between block.from_date and block.to_date),0) blocked_unit_count,
      coalesce((select jsonb_agg(distinct block.unit_id order by block.unit_id) from public.hotel_unit_calendar_blocks block
        join public.hotel_units unit on unit.id=block.unit_id and unit.room_type_id=rd.id and unit.status=''active''
        where block.hotel_id=p_hotel_id and block.room_type_id=rd.id and block.is_active and block.blocked
          and (block.expires_at is null or block.expires_at>v_as_of) and rd.stay_date between block.from_date and block.to_date),''[]'') blocked_unit_ids,
      coalesce(inventory.closed_mode=''set'' and inventory.closed and (inventory.expires_at is null or inventory.expires_at>v_as_of),false) operational_closed,
      false safety_closed,
      coalesce((select sum(commitment.units)::integer from public.hotel_inventory_commitments commitment
        join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
          and hold_row.status=''active'' and hold_row.expires_at>v_as_of
        where commitment.hotel_id=p_hotel_id and commitment.room_type_id=rd.id and commitment.stay_date=rd.stay_date
          and commitment.status=''active''),0) held_units,
      coalesce((select sum(commitment.units)::integer from public.hotel_inventory_commitments commitment
        join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id and allocation.status=''active''
        join public.hotel_bookings booking on booking.id=allocation.booking_id and booking.status in(''pending'',''confirmed'')
        where commitment.hotel_id=p_hotel_id and commitment.room_type_id=rd.id and commitment.stay_date=rd.stay_date
          and commitment.status=''active''),0) booked_units,
      (select min(hold_row.expires_at) from public.hotel_inventory_commitments commitment
        join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
          and hold_row.status=''active'' and hold_row.expires_at>v_as_of
        where commitment.hotel_id=p_hotel_id and commitment.room_type_id=rd.id and commitment.stay_date=rd.stay_date
          and commitment.status=''active'') earliest_hold_expiry
    from room_days rd left join public.hotel_daily_inventory inventory
      on inventory.room_type_id=rd.id and inventory.stay_date=rd.stay_date
  ), cells as(
    select *,held_units+booked_units committed_units,
      greatest(0,least(physical_capacity-case when inventory_mode=''unitized'' then blocked_unit_count else 0 end,
        configured_sellable_units)-held_units-booked_units) available_units
    from cell_values
  )
  select jsonb_build_object(
    ''contract_version'',''hotels_v2_admin_d_availability_control_v1'',''hotel_id'',p_hotel_id,
    ''from'',p_from,''to'',p_to,''snapshot_token'',v_token,''snapshot_as_of'',v_as_of,
    ''snapshot_valid_until'',v_valid_until,
    ''property'',(select jsonb_build_object(''id'',property.id,''name_i18n'',jsonb_build_object(
      ''pl'',coalesce(property.title_i18n->>''pl'',property.title->>''pl'',property.title_i18n->>''en'',property.title->>''en'',property.slug),
      ''en'',coalesce(property.title_i18n->>''en'',property.title->>''en'',property.title_i18n->>''pl'',property.title->>''pl'',property.slug),
      ''he'',coalesce(property.title_i18n->>''he'',property.title->>''he'',property.title_i18n->>''en'',property.title->>''en'',property.slug)),
      ''architecture_version'',property.architecture_version,''timezone'',property.timezone,
      ''currency'',property.currency,''booking_mode'',property.booking_mode,
      ''minimum_stay_nights'',property.minimum_stay_nights,
      ''maximum_stay_nights'',profile.maximum_stay_nights,
      ''updated_at'',greatest(property.updated_at,coalesce(profile.updated_at,property.updated_at)))
      from public.hotels property left join public.hotel_property_operational_profiles profile on profile.hotel_id=property.id
      where property.id=p_hotel_id),
    ''room_types'',coalesce((select jsonb_agg(jsonb_build_object(''id'',room.id,''hotel_id'',room.hotel_id,
      ''code'',room.code,''name_i18n'',room.name_i18n,''inventory_mode'',room.inventory_mode,
      ''base_inventory_count'',room.base_inventory_count,''status'',room.status,''sort_order'',room.sort_order,
      ''max_occupancy'',room.max_occupancy,''capacity_adults'',room.capacity_adults,
      ''capacity_children'',room.capacity_children,''version'',room.version,''updated_at'',room.updated_at)
      order by room.sort_order,room.id) from public.hotel_room_types room where room.hotel_id=p_hotel_id),''[]''),
    ''room_rates'',coalesce((select jsonb_agg(jsonb_build_object(''id'',rate.id,''hotel_id'',rate.hotel_id,
      ''room_type_id'',rate.room_type_id,''rate_plan_id'',rate.rate_plan_id,''is_active'',rate.is_active,
      ''review_status'',rate.review_status,''sort_order'',rate.sort_order,''version'',rate.version,''updated_at'',rate.updated_at)
      order by rate.sort_order,rate.id) from public.hotel_room_rates rate where rate.hotel_id=p_hotel_id),''[]''),
    ''units'',coalesce((select jsonb_agg(jsonb_build_object(''id'',unit.id,''room_type_id'',unit.room_type_id,
      ''code'',unit.code,''name_i18n'',unit.name_i18n,''status'',unit.status,''version'',unit.version,
      ''updated_at'',unit.updated_at) order by unit.room_type_id,unit.id)
      from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id where room.hotel_id=p_hotel_id),''[]''),
    ''cells'',coalesce((select jsonb_agg(jsonb_build_object(
      ''room_type_id'',room_type_id,''stay_date'',stay_date,''inventory_mode'',inventory_mode,
      ''physical_capacity'',physical_capacity,''configured_sellable_units'',configured_sellable_units,
      ''blocked_unit_count'',blocked_unit_count,''blocked_unit_ids'',blocked_unit_ids,
      ''operational_closed'',operational_closed,''safety_closed'',safety_closed,''held_units'',held_units,''booked_units'',booked_units,
      ''committed_units'',committed_units,''available_units'',case when operational_closed or safety_closed then 0 else available_units end,
      ''requestable'',false,
      ''blocking_reasons'',case when operational_closed then ''["operational_closed"]''::jsonb else ''[]''::jsonb end ||
        case when safety_closed then ''["safety_closed"]''::jsonb else ''[]''::jsonb end ||
        case when available_units<=0 then ''["inventory_exhausted"]''::jsonb else ''[]''::jsonb end || ''["public_activation_off"]''::jsonb,
      ''earliest_hold_expiry'',earliest_hold_expiry,
      ''provenance'',jsonb_build_object(''capacity'',''room_type_or_active_units'',''inventory'',''hotel_daily_inventory'',''commitments'',''server_authoritative''),
      ''inventory_version'',coalesce(inventory_version,0)) order by room_type_id,stay_date) from cells),''[]''),
    ''product_cells'',coalesce((select jsonb_agg(jsonb_build_object(
      ''room_type_id'',rate.room_type_id,''room_rate_id'',rate.id,''rate_plan_id'',rate.rate_plan_id,
      ''stay_date'',day_value::date,
      ''operational_closed'',coalesce(exact.closed_mode=''set'' and exact.closed and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end,false),
      ''closed_to_arrival'',coalesce(case when exact.closed_to_arrival_mode=''set'' and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end then exact.closed_to_arrival end,
        (select rule.closed_to_arrival from public.hotel_rate_rules rule where rule.room_rate_id=rate.id and rule.is_active and day_value::date between rule.valid_from and rule.valid_to and extract(isodow from day_value)::smallint=any(rule.weekdays) order by (cardinality(rule.weekdays)=7) desc,rule.priority desc,rule.id limit 1),false),
      ''closed_to_departure'',coalesce(case when exact.closed_to_departure_mode=''set'' and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end then exact.closed_to_departure end,
        (select rule.closed_to_departure from public.hotel_rate_rules rule where rule.room_rate_id=rate.id and rule.is_active and day_value::date between rule.valid_from and rule.valid_to and extract(isodow from day_value)::smallint=any(rule.weekdays) order by (cardinality(rule.weekdays)=7) desc,rule.priority desc,rule.id limit 1),false),
      ''safety_closed'',coalesce(dr.closed,false),''requestable'',false,
      ''blocking_reasons'',case when coalesce(exact.closed_mode=''set'' and exact.closed and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end,false)
        then ''["operational_closed"]''::jsonb else ''[]''::jsonb end ||
        case when coalesce(dr.closed,false) then ''["safety_closed"]''::jsonb else ''[]''::jsonb end ||
        case when not rate.is_active then ''["room_rate_inactive"]''::jsonb else ''[]''::jsonb end || ''["public_activation_off"]''::jsonb,
      ''provenance'',jsonb_build_object(''exact_override_id'',exact.id,''daily_rate'',dr.room_rate_id is not null,
        ''availability_version'',exact.availability_version))
      order by rate.id,day_value) from public.hotel_room_rates rate
      cross join generate_series(p_from::timestamp,p_to::timestamp,interval ''1 day'') day_value
      left join public.hotel_calendar_overrides exact on exact.room_rate_id=rate.id and exact.stay_date=day_value::date
      left join public.hotel_daily_rates dr on dr.room_rate_id=rate.id and dr.stay_date=day_value::date
      where rate.hotel_id=p_hotel_id),''[]''),
    ''daily_inventory'',coalesce((select jsonb_agg(jsonb_build_object(''room_type_id'',inventory.room_type_id,
      ''stay_date'',inventory.stay_date,''sellable_units'',inventory.sellable_units,''sellable_units_mode'',inventory.sellable_units_mode,
      ''closed'',inventory.closed,''closed_mode'',inventory.closed_mode,''reason'',inventory.reason,''expires_at'',inventory.expires_at,
      ''version'',inventory.version,''updated_at'',inventory.updated_at) order by inventory.room_type_id,inventory.stay_date)
      from public.hotel_daily_inventory inventory join public.hotel_room_types room on room.id=inventory.room_type_id
      where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to),''[]''),
    ''unit_calendar_blocks'',coalesce((select jsonb_agg(jsonb_build_object(''id'',block.id,''hotel_id'',block.hotel_id,
      ''room_type_id'',block.room_type_id,''unit_id'',block.unit_id,''from_date'',block.from_date,''to_date'',block.to_date,
      ''blocked'',block.blocked,''reason'',block.reason,''expires_at'',block.expires_at,''is_active'',block.is_active,
      ''version'',block.version,''updated_at'',block.updated_at) order by block.from_date,block.id)
      from public.hotel_unit_calendar_blocks block where block.hotel_id=p_hotel_id and block.from_date<=p_to and block.to_date>=p_from),''[]''),
    ''operational_overrides'',coalesce((select jsonb_agg(jsonb_build_object(''id'',exact.id,''hotel_id'',exact.hotel_id,
      ''room_rate_id'',exact.room_rate_id,''stay_date'',exact.stay_date,''closed'',exact.closed,''closed_mode'',exact.closed_mode,
      ''closed_to_arrival'',exact.closed_to_arrival,''closed_to_arrival_mode'',exact.closed_to_arrival_mode,
      ''closed_to_departure'',exact.closed_to_departure,''closed_to_departure_mode'',exact.closed_to_departure_mode,
      ''availability_reason'',case when exact.availability_updated_at is null then
        case when exact.closed_mode is not null or exact.closed_to_arrival_mode is not null or exact.closed_to_departure_mode is not null then exact.reason end
        else exact.availability_reason end,
      ''availability_expires_at'',case when exact.availability_updated_at is null then
        case when exact.closed_mode is not null or exact.closed_to_arrival_mode is not null or exact.closed_to_departure_mode is not null then exact.expires_at end
        else exact.availability_expires_at end,
      ''availability_active'',case when exact.availability_updated_at is null then
        (exact.closed_mode is not null or exact.closed_to_arrival_mode is not null or exact.closed_to_departure_mode is not null) and exact.is_active
        else exact.availability_active end,
      ''availability_version'',exact.availability_version,
      ''availability_updated_at'',exact.availability_updated_at) order by exact.stay_date,exact.id)
      from public.hotel_calendar_overrides exact where exact.hotel_id=p_hotel_id and exact.stay_date between p_from and p_to
      ),''[]''),
    ''rate_rule_operational_restrictions'',coalesce((select jsonb_agg(jsonb_build_object(''id'',rule.id,''room_rate_id'',rule.room_rate_id,''valid_from'',rule.valid_from,''valid_to'',rule.valid_to,''weekdays'',rule.weekdays,''closed_to_arrival'',rule.closed_to_arrival,''closed_to_departure'',rule.closed_to_departure,''availability_version'',rule.availability_version,''availability_reason'',rule.availability_reason,''availability_actor_id'',rule.availability_actor_id,''availability_correlation_id'',rule.availability_correlation_id,''availability_updated_at'',rule.availability_updated_at) order by rule.id) from public.hotel_rate_rules rule join public.hotel_room_rates rate on rate.id=rule.room_rate_id where rate.hotel_id=p_hotel_id and rule.valid_from<=p_to and rule.valid_to>=p_from),''[]''),
    ''booking_allocations'',coalesce((select jsonb_agg(jsonb_build_object(''id'',allocation.id,''booking_id'',allocation.booking_id,
      ''arrival_date'',booking.arrival_date,''departure_date'',booking.departure_date,
      ''current_booking_updated_at'',booking.updated_at,''current_booking_status'',booking.status,
      ''room_type_id'',allocation.room_type_id,''rate_plan_id'',allocation.rate_plan_id,''room_rate_id'',allocation.room_rate_id,
      ''unit_ids'',allocation.unit_ids,''units_required'',allocation.units_required,''allocated_guest_counts'',allocation.allocated_guest_counts,
      ''pricing_guest_counts'',allocation.pricing_guest_counts,''booking_updated_at'',allocation.booking_updated_at,
      ''status'',allocation.status,''version'',allocation.version,''updated_at'',allocation.updated_at,
      ''active_commitment_from'',(select min(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.booking_allocation_id=allocation.id and commitment.status=''active''),
      ''active_commitment_to'',(select max(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.booking_allocation_id=allocation.id and commitment.status=''active''),
      ''active_commitments'',coalesce((select jsonb_agg(jsonb_build_object(''room_type_id'',commitment.room_type_id,
        ''stay_date'',commitment.stay_date,''unit_id'',commitment.unit_id,''units'',commitment.units,''status'',commitment.status)
        order by commitment.room_type_id,commitment.stay_date,commitment.unit_id nulls first,commitment.units)
        from public.hotel_inventory_commitments commitment where commitment.booking_allocation_id=allocation.id
          and commitment.status=''active''),''[]''::jsonb)) order by allocation.booking_id,allocation.id)
      from public.hotel_booking_room_allocations allocation join public.hotel_bookings booking on booking.id=allocation.booking_id
      where allocation.hotel_id=p_hotel_id and (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
        select 1 from public.hotel_inventory_commitments commitment where commitment.booking_allocation_id=allocation.id
          and commitment.status=''active'' and commitment.stay_date between p_from and p_to))),''[]''),
    ''holds'',coalesce((select jsonb_agg(jsonb_build_object(''id'',hold_row.id,''status'',hold_row.status,
      ''expires_at'',hold_row.expires_at,''version'',hold_row.version,''created_at'',hold_row.created_at,''updated_at'',hold_row.updated_at,
      ''active_commitment_from'',(select min(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status=''active''),
      ''active_commitment_to'',(select max(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status=''active''),
      ''commitments'',coalesce((select jsonb_agg(jsonb_build_object(''room_type_id'',commitment.room_type_id,
        ''stay_date'',commitment.stay_date,''unit_id'',commitment.unit_id,''units'',commitment.units,''status'',commitment.status)
        order by commitment.stay_date,commitment.id) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.stay_date between p_from and p_to),''[]''::jsonb))
      order by hold_row.created_at,hold_row.id) from public.hotel_inventory_holds hold_row where hold_row.hotel_id=p_hotel_id
      and exists(select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
        and commitment.stay_date between p_from and p_to)),''[]''),
    ''unmapped_booking_blockers'',coalesce((select jsonb_agg(jsonb_build_object(''booking_id'',booking.id,''booking_updated_at'',booking.updated_at,''arrival_date'',booking.arrival_date,''departure_date'',booking.departure_date,''num_adults'',coalesce(booking.num_adults,1),''num_children'',coalesce(booking.num_children,0),''status'',booking.status,
      ''reason'',case when exists(select 1 from public.hotel_booking_room_allocations stale where stale.booking_id=booking.id and stale.status=''active'') then ''stale_booking_allocation'' else ''exact_booking_allocation_required'' end) order by booking.arrival_date,booking.id)
      from public.hotel_bookings booking where booking.hotel_id=p_hotel_id and booking.status in(''pending'',''confirmed'')
        and booking.arrival_date<=p_to and booking.departure_date>p_from
        and not exists(select 1 from public.hotel_booking_room_allocations allocation
          where allocation.booking_id=booking.id and allocation.status=''active''
            and allocation.booking_updated_at=booking.updated_at)),''[]''),
    ''recent_activity'',coalesce((select jsonb_agg(jsonb_build_object(''id'',activity.id,''entity_type'',activity.entity_type,
      ''entity_id'',activity.entity_id,''action'',activity.action,
      ''before_state'',case when activity.before_state is null then null else jsonb_build_object(''fingerprint'',public.hotel_v2_admin_d_hash(activity.before_state),''redacted'',true) end,
      ''after_state'',case when activity.after_state is null then null else jsonb_build_object(''fingerprint'',public.hotel_v2_admin_d_hash(activity.after_state),''redacted'',true) end,
      ''actor_type'',activity.actor_type,''source'',activity.source,
      ''correlation_id'',activity.correlation_id,''created_at'',activity.created_at)
      order by activity.created_at desc,activity.id desc) from(select * from public.hotel_activity_log
      where hotel_id=p_hotel_id and entity_type in(''daily_inventory'',''calendar_override'',''unit_calendar_block'',
        ''rate_rule_operational_restriction'',''booking_allocation'',''inventory_hold'') order by created_at desc,id desc limit 100) activity),''[]''),
    ''public_change'',false) into v_result;
  if octet_length(convert_to(v_result::text,''UTF8''))>20971520 then
    raise exception using errcode=''54000'',message=''hotels_v2_admin_d_snapshot_technical_limit_exceeded''; end if;
  return v_result;
end
';
ALTER FUNCTION hotels_published_architecture_private.workspace_snapshot_external_base_114489(uuid, date, date, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.workspace_snapshot_external_base_114489(uuid, date, date, boolean)
 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_published_architecture_private.workspace_snapshot_114489(p_hotel_id uuid, p_from date, p_to date, p_require_admin boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS '
declare
  v_control jsonb;
  v_cells jsonb;
  v_blocks jsonb;
  v_global_enabled boolean;
begin
 IF p_hotel_id IS DISTINCT FROM ''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid THEN
  RAISE EXCEPTION USING errcode=''42501'',message=''hotels_114489_target_required'';
 END IF;
 PERFORM hotels_published_architecture_private.assert_exact();
 PERFORM hotels_published_architecture_private.require_lifecycle();
  if (select count(*) from public.site_settings)<>1 then
    raise exception using errcode=''55000'',message=''hotels_v2_external_calendar_settings_cardinality'';
  end if;
  select setting.hotel_external_sync_enabled into v_global_enabled
    from public.site_settings setting where setting.id=1;

  v_control:=hotels_published_architecture_private.workspace_snapshot_external_base_114489(
    p_hotel_id,p_from,p_to,p_require_admin);

  -- While Stage 2F has not been explicitly activated the accepted ADMIN-D
  -- snapshot remains byte-for-byte unchanged.
  if not v_global_enabled then return v_control; end if;

  if (select count(*) from hotels_v2_private.hotel_external_calendar_day_blocks block
      join public.hotel_calendar_source_configs source on source.id=block.source_id
      where block.hotel_id=p_hotel_id and block.stay_date between p_from and p_to
        and block.is_active and source.hotel_id=block.hotel_id
        and source.room_type_id=block.room_type_id and public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
        and source.is_enabled and source.review_status=''reviewed'')>62000 then
    raise exception using errcode=''54000'',message=''hotels_v2_external_calendar_availability_limit_exceeded'';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(room_type_id,stay_date,units_blocked)
      order by room_type_id,stay_date),''[]''::jsonb)
  into v_blocks
  from (
    select block.room_type_id,block.stay_date,
      least(sum(block.units_blocked)::integer,greatest(0,
        (cell.value->>''physical_capacity'')::integer-case
          when cell.value->>''inventory_mode''=''unitized''
          then (cell.value->>''blocked_unit_count'')::integer else 0 end)) units_blocked
    from hotels_v2_private.hotel_external_calendar_day_blocks block
    join public.hotel_calendar_source_configs source on source.id=block.source_id
    join lateral jsonb_array_elements(v_control->''cells'') cell(value)
      on cell.value->>''room_type_id''=block.room_type_id::text
        and cell.value->>''stay_date''=block.stay_date::text
    where block.hotel_id=p_hotel_id and block.stay_date between p_from and p_to
      and block.is_active and source.hotel_id=block.hotel_id
      and source.room_type_id=block.room_type_id and public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
      and source.is_enabled and source.review_status=''reviewed''
    group by block.room_type_id,block.stay_date,cell.value
  ) effective;

  select coalesce(jsonb_agg(
    case when coalesce(blocked.units_blocked,0)=0 then cell.value else
      jsonb_set(jsonb_set(cell.value,''{available_units}'',to_jsonb(greatest(0,
        (cell.value->>''available_units'')::integer-blocked.units_blocked)),false),
        ''{blocking_reasons}'',case when (cell.value->>''available_units'')::integer-blocked.units_blocked<=0
          and not (cell.value->''blocking_reasons'' ? ''inventory_exhausted'')
          then (cell.value->''blocking_reasons'')||''["inventory_exhausted"]''::jsonb
          else cell.value->''blocking_reasons'' end,false)
    end order by cell.value->>''room_type_id'',cell.value->>''stay_date''),''[]''::jsonb)
  into v_cells
  from jsonb_array_elements(v_control->''cells'') cell(value)
  left join lateral (
    select (item->>2)::integer units_blocked
    from jsonb_array_elements(v_blocks) item
    where item->>0=cell.value->>''room_type_id''
      and item->>1=cell.value->>''stay_date''
  ) blocked on true;

  v_control:=jsonb_set(v_control,''{cells}'',v_cells,false);
  v_control:=jsonb_set(v_control,''{snapshot_token}'',to_jsonb(public.hotel_v2_admin_d_hash(
    jsonb_build_object(''admin_d_snapshot_token'',v_control->>''snapshot_token'',
      ''external_calendar_effective_blocks'',v_blocks))),false);
  return v_control;
end
';
ALTER FUNCTION hotels_published_architecture_private.workspace_snapshot_114489(uuid, date, date, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION hotels_published_architecture_private.workspace_snapshot_114489(uuid, date, date, boolean)
 FROM PUBLIC,anon,authenticated,service_role;
create function hotels_published_architecture_private.property_writer(
  p_plan jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
AS '
declare
  c_contract constant text:=''hotels_v2_admin_b_property_control_v1'';
  c_private_keys constant text[]:=array[
    ''maximum_stay_nights'',''guest_instructions_i18n'',
    ''check_in_instructions_i18n'',''check_out_instructions_i18n'',
    ''internal_operational_notes''
  ];
  v_hotel_id uuid;
  v_reviewed_at timestamptz;
  v_expected_property_updated_at timestamptz;
  v_expected_profile_version bigint;
  v_payload jsonb;
  v_original jsonb;
  v_hotel public.hotels%rowtype;
  v_target public.hotels%rowtype;
  v_profile public.hotel_property_operational_profiles%rowtype;
  v_profile_exists boolean;
  v_profile_before jsonb;
  v_profile_target jsonb;
  v_before jsonb;
  v_after jsonb;
  v_key text;
  v_current_value jsonb;
  v_target_value jsonb;
  v_conflicts text[]:=''{}''::text[];
  v_has_public boolean:=false;
  v_has_private boolean:=false;
  v_property_changed boolean:=false;
  v_profile_changed boolean:=false;
  v_minimum integer;
  v_maximum integer;
  v_cover text;
  v_activity jsonb;
begin
 IF p_plan->>''hotel_id'' IS DISTINCT FROM ''9b6d99a0-923a-4fbc-be54-c066e856e6ca'' THEN RAISE EXCEPTION USING errcode=''42501'',message=''hotels_114489_target_required''; END IF;
 PERFORM hotels_published_architecture_private.assert_exact();
 IF (p_plan->''payload'') ?| ARRAY[''owner_partner_id'',''architecture_version'',''is_published'',''currency'',''booking_mode'',''minimum_stay_nights'',''maximum_stay_nights''] THEN
  RAISE EXCEPTION USING errcode=''22023'',message=''hotels_114489_non_content_change''; END IF;
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>''object'' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       ''contract_version'',''hotel_id'',''expected_property_updated_at'',
       ''expected_operational_profile_version'',''reviewed_at'',''expected_original'',''payload''
     ])
     or not (p_plan ?& array[
       ''contract_version'',''hotel_id'',''expected_property_updated_at'',
       ''expected_operational_profile_version'',''reviewed_at'',''expected_original'',''payload''
     ])
     or jsonb_typeof(p_plan->''contract_version'')<>''string''
     or jsonb_typeof(p_plan->''hotel_id'')<>''string''
     or jsonb_typeof(p_plan->''expected_property_updated_at'')<>''string''
     or jsonb_typeof(p_plan->''expected_operational_profile_version'')<>''number''
     or jsonb_typeof(p_plan->''reviewed_at'')<>''string''
     or p_plan->>''contract_version''<>c_contract
     or jsonb_typeof(p_plan->''expected_original'')<>''object''
     or jsonb_typeof(p_plan->''payload'')<>''object''
     or not exists(select 1 from jsonb_object_keys(p_plan->''payload''))
     or not public.hotel_v2_h2a_keys_allowed(p_plan->''payload'',array[
       ''title_i18n'',''description_i18n'',''city'',''address_line'',''district'',''postal_code'',
       ''country'',''latitude'',''longitude'',''google_maps_url'',''amenities'',
       ''check_in_from'',''check_out_until'',''timezone'',''currency'',''booking_mode'',
       ''owner_partner_id'',''cover_image_url'',''photos'',''minimum_stay_nights'',
       ''maximum_stay_nights'',''guest_instructions_i18n'',''check_in_instructions_i18n'',
       ''check_out_instructions_i18n'',''internal_operational_notes''
     ])
     or exists(
       (select key from jsonb_object_keys(p_plan->''payload'') key)
       except
       (select key from jsonb_object_keys(p_plan->''expected_original'') key)
     )
     or exists(
       (select key from jsonb_object_keys(p_plan->''expected_original'') key)
       except
       (select key from jsonb_object_keys(p_plan->''payload'') key)
     ) then
    raise exception using errcode=''22023'',
      message=''hotels_v2_admin_b_invalid_property_plan'';
  end if;
  if p_plan->>''expected_operational_profile_version''!~''^[0-9]+$'' then
    raise exception using errcode=''22023'',
      message=''hotels_v2_admin_b_invalid_operational_profile_version'';
  end if;

  begin
    v_hotel_id:=(p_plan->>''hotel_id'')::uuid;
    v_expected_property_updated_at:=(p_plan->>''expected_property_updated_at'')::timestamptz;
    v_expected_profile_version:=(p_plan->>''expected_operational_profile_version'')::bigint;
    v_reviewed_at:=(p_plan->>''reviewed_at'')::timestamptz;
  exception when others then
    raise exception using errcode=''22023'',
      message=''hotels_v2_admin_b_invalid_property_plan_identifiers'';
  end;
  if v_expected_profile_version<0
     or v_reviewed_at<clock_timestamp()-interval ''30 minutes''
     or v_reviewed_at>clock_timestamp()+interval ''5 minutes'' then
    raise exception using errcode=''22023'',
      message=''hotels_v2_admin_b_property_review_expired'';
  end if;
  v_payload:=p_plan->''payload'';
  v_original:=p_plan->''expected_original'';

  if exists(
    select 1 from jsonb_each(v_payload) entry
    where (entry.key in(''city'',''address_line'',''district'',''postal_code'',''country'',
             ''google_maps_url'',''check_in_from'',''check_out_until'',''timezone'',''currency'',
             ''booking_mode'',''owner_partner_id'',''cover_image_url'',''internal_operational_notes'')
           and jsonb_typeof(entry.value) not in(''string'',''null''))
       or (entry.key in(''latitude'',''longitude'',''minimum_stay_nights'',''maximum_stay_nights'')
           and jsonb_typeof(entry.value) not in(''number'',''string'',''null''))
  ) then
    raise exception using errcode=''22023'',
      message=''hotels_v2_admin_b_invalid_property_scalar_type'';
  end if;
  if (v_payload?''city'' and length(coalesce(v_payload->>''city'',''''))>200)
     or (v_payload?''address_line'' and length(coalesce(v_payload->>''address_line'',''''))>500)
     or (v_payload?''district'' and length(coalesce(v_payload->>''district'',''''))>200)
     or (v_payload?''postal_code'' and length(coalesce(v_payload->>''postal_code'',''''))>40)
     or (v_payload?''country'' and length(coalesce(v_payload->>''country'',''''))>100)
     or (v_payload?''google_maps_url'' and length(coalesce(v_payload->>''google_maps_url'',''''))>2048)
     or (v_payload?''cover_image_url'' and length(coalesce(v_payload->>''cover_image_url'',''''))>2048)
     or (v_payload?''timezone'' and length(coalesce(v_payload->>''timezone'',''''))>100) then
    raise exception using errcode=''22023'',
      message=''hotels_v2_admin_b_property_scalar_too_long'';
  end if;
  if (v_payload?''city'' and nullif(btrim(v_payload->>''city''),'''') is null)
     or (v_payload?''country'' and nullif(btrim(v_payload->>''country''),'''') is null)
     or (v_payload?''timezone'' and nullif(btrim(v_payload->>''timezone''),'''') is null)
     or (v_payload?''currency'' and nullif(btrim(v_payload->>''currency''),'''') is null)
     or (v_payload?''booking_mode'' and nullif(btrim(v_payload->>''booking_mode''),'''') is null) then
    raise exception using errcode=''22023'',
      message=''hotels_v2_admin_b_required_property_field_empty'';
  end if;

  perform 1 from public.site_settings where id=1 for share;
  if hotels_published_architecture_private.require_lifecycle() IS NULL then
    raise exception using errcode=''55000'',
      message=''hotels_v2_admin_b_public_activation_guard'';
  end if;
  select * into v_hotel from public.hotels where id=v_hotel_id for update;
  if not found then
    raise exception using errcode=''PT404'',
      message=''hotels_v2_admin_b_property_not_found'';
  end if;
  select * into v_profile from public.hotel_property_operational_profiles
    where hotel_id=v_hotel_id for update;
  v_profile_exists:=found;

  for v_key in select key from jsonb_object_keys(v_payload) key loop
    if v_key=any(c_private_keys) then v_has_private:=true;
    else v_has_public:=true;
    end if;
  end loop;
  if v_has_private and (
    (v_profile_exists and v_profile.version<>v_expected_profile_version)
    or (not v_profile_exists and v_expected_profile_version<>0)
  ) then
    -- Field-level comparison below may still prove a stale version harmless.
    null;
  end if;

  -- Validate exact proposed field shapes before building a target record.
  if v_payload?''title_i18n''
     and not public.hotel_v2_admin_b_i18n_is_valid(v_payload->''title_i18n'',true,240) then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_property_name'';
  end if;
  if v_payload?''description_i18n''
     and not public.hotel_v2_admin_b_i18n_is_valid(v_payload->''description_i18n'',false,12000) then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_property_description'';
  end if;
  if v_payload?''guest_instructions_i18n''
     and not public.hotel_v2_admin_b_i18n_is_valid(v_payload->''guest_instructions_i18n'',false,8000) then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_guest_instructions'';
  end if;
  if v_payload?''check_in_instructions_i18n''
     and not public.hotel_v2_admin_b_i18n_is_valid(v_payload->''check_in_instructions_i18n'',false,8000) then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_check_in_instructions'';
  end if;
  if v_payload?''check_out_instructions_i18n''
     and not public.hotel_v2_admin_b_i18n_is_valid(v_payload->''check_out_instructions_i18n'',false,8000) then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_check_out_instructions'';
  end if;
  if v_payload?''internal_operational_notes'' and v_payload->>''internal_operational_notes'' is not null
     and length(v_payload->>''internal_operational_notes'')>5000 then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_operational_notes'';
  end if;
  if v_payload?''amenities'' and (
       not public.hotel_v2_admin_b_string_array_is_valid(v_payload->''amenities'',200)
       or exists(select 1 from jsonb_array_elements_text(v_payload->''amenities'') requested(code)
          where not exists(select 1 from jsonb_array_elements_text(coalesce(v_hotel.amenities,''[]''::jsonb)) current_amenity(code)
                  where current_amenity.code=requested.code)
            and not exists(select 1 from public.hotel_amenities amenity
              where amenity.code=requested.code and amenity.is_active))
     ) then
    raise exception using errcode=''23503'',message=''hotels_v2_admin_b_unknown_property_amenity'';
  end if;
  if v_payload?''photos'' and not public.hotel_v2_admin_b_property_gallery_is_valid(
       v_hotel_id,v_payload->''photos'',coalesce(v_hotel.photos,''[]''::jsonb)) then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_property_gallery'';
  end if;
  if v_payload?''latitude'' and v_payload->>''latitude'' is not null and (
       v_payload->>''latitude'' !~ ''^-?[0-9]+(?:\.[0-9]+)?$''
       or (v_payload->>''latitude'')::numeric not between -90 and 90) then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_latitude'';
  end if;
  if v_payload?''longitude'' and v_payload->>''longitude'' is not null and (
       v_payload->>''longitude'' !~ ''^-?[0-9]+(?:\.[0-9]+)?$''
       or (v_payload->>''longitude'')::numeric not between -180 and 180) then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_longitude'';
  end if;
  if v_payload?''google_maps_url'' and v_payload->>''google_maps_url'' is not null
     and v_payload->>''google_maps_url'' is distinct from v_hotel.google_maps_url
     and not public.hotel_v2_admin_b_google_maps_url_is_valid(
       v_payload->>''google_maps_url'') then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_google_maps_url'';
  end if;
  if v_payload?''check_in_from'' and v_payload->>''check_in_from'' is not null
     and v_payload->>''check_in_from'' !~ ''^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$'' then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_check_in'';
  end if;
  if v_payload?''check_out_until'' and v_payload->>''check_out_until'' is not null
     and v_payload->>''check_out_until'' !~ ''^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$'' then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_check_out'';
  end if;
  if v_payload?''timezone'' and not exists(select 1 from pg_catalog.pg_timezone_names zone
       where zone.name=v_payload->>''timezone'') then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_timezone'';
  end if;
  if v_payload?''currency'' and upper(btrim(v_payload->>''currency'')) !~ ''^[A-Z]{3}$'' then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_currency'';
  end if;
  if v_payload?''booking_mode'' and v_payload->>''booking_mode''
       not in(''request_confirmation'',''instant_booking'',''external_redirect'') then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_booking_mode'';
  end if;
  if v_payload?''owner_partner_id'' and v_payload->>''owner_partner_id'' is not null
     then
    begin
      perform 1 from public.partners partner
      where partner.id=(v_payload->>''owner_partner_id'')::uuid
        and partner.status=''active'' and partner.can_manage_hotels;
      if not found then
        raise exception using errcode=''23514'',message=''hotels_v2_admin_b_owner_not_eligible'';
      end if;
    exception when invalid_text_representation then
      raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_owner_partner_id'';
    end;
  end if;
  if (v_payload?''minimum_stay_nights'' and v_payload->>''minimum_stay_nights'' is not null
      and (v_payload->>''minimum_stay_nights'' !~ ''^[0-9]+$''
        or (v_payload->>''minimum_stay_nights'')::integer not between 1 and 365))
     or (v_payload?''maximum_stay_nights'' and v_payload->>''maximum_stay_nights'' is not null
      and (v_payload->>''maximum_stay_nights'' !~ ''^[0-9]+$''
        or (v_payload->>''maximum_stay_nights'')::integer not between 1 and 365)) then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_invalid_stay_bounds'';
  end if;
  v_target:=v_hotel;
  if v_payload?''title_i18n'' then v_target.title_i18n:=v_payload->''title_i18n''; v_target.title:=v_payload->''title_i18n''; end if;
  if v_payload?''description_i18n'' then v_target.description_i18n:=v_payload->''description_i18n''; v_target.description:=v_payload->''description_i18n''; end if;
  if v_payload?''city'' then v_target.city:=nullif(btrim(v_payload->>''city''),''''); end if;
  if v_payload?''address_line'' then v_target.address_line:=nullif(btrim(v_payload->>''address_line''),''''); end if;
  if v_payload?''district'' then v_target.district:=nullif(btrim(v_payload->>''district''),''''); end if;
  if v_payload?''postal_code'' then v_target.postal_code:=nullif(btrim(v_payload->>''postal_code''),''''); end if;
  if v_payload?''country'' then v_target.country:=nullif(btrim(v_payload->>''country''),''''); end if;
  if v_payload?''latitude'' then v_target.latitude:=(v_payload->>''latitude'')::double precision; end if;
  if v_payload?''longitude'' then v_target.longitude:=(v_payload->>''longitude'')::double precision; end if;
  if v_payload?''google_maps_url'' then v_target.google_maps_url:=nullif(btrim(v_payload->>''google_maps_url''),''''); end if;
  if v_payload?''amenities'' then v_target.amenities:=v_payload->''amenities''; end if;
  if v_payload?''check_in_from'' then v_target.check_in_from:=(v_payload->>''check_in_from'')::time; end if;
  if v_payload?''check_out_until'' then v_target.check_out_until:=(v_payload->>''check_out_until'')::time; end if;
  if v_payload?''timezone'' then v_target.timezone:=btrim(v_payload->>''timezone''); end if;
  if v_payload?''currency'' then v_target.currency:=upper(btrim(v_payload->>''currency''))::character(3); end if;
  if v_payload?''booking_mode'' then v_target.booking_mode:=v_payload->>''booking_mode''; end if;
  if v_payload?''owner_partner_id'' then v_target.owner_partner_id:=(v_payload->>''owner_partner_id'')::uuid; end if;
  if v_payload?''cover_image_url'' then v_target.cover_image_url:=nullif(btrim(v_payload->>''cover_image_url''),''''); end if;
  if v_payload?''photos'' then v_target.photos:=v_payload->''photos''; end if;
  if v_payload?''minimum_stay_nights'' then v_target.minimum_stay_nights:=(v_payload->>''minimum_stay_nights'')::integer; end if;

  v_profile_before:=case when v_profile_exists then jsonb_build_object(
    ''maximum_stay_nights'',v_profile.maximum_stay_nights,
    ''guest_instructions_i18n'',v_profile.guest_instructions_i18n,
    ''check_in_instructions_i18n'',v_profile.check_in_instructions_i18n,
    ''check_out_instructions_i18n'',v_profile.check_out_instructions_i18n,
    ''internal_operational_notes'',v_profile.internal_operational_notes
  ) else jsonb_build_object(
    ''maximum_stay_nights'',null,''guest_instructions_i18n'',''{}''::jsonb,
    ''check_in_instructions_i18n'',''{}''::jsonb,''check_out_instructions_i18n'',''{}''::jsonb,
    ''internal_operational_notes'',null
  ) end;
  v_profile_target:=v_profile_before;
  foreach v_key in array c_private_keys loop
    if v_payload?v_key then
      v_profile_target:=jsonb_set(v_profile_target,array[v_key],coalesce(v_payload->v_key,''null''::jsonb),true);
    end if;
  end loop;

  v_minimum:=v_target.minimum_stay_nights;
  v_maximum:=case when v_profile_target->>''maximum_stay_nights'' is null then null
    else (v_profile_target->>''maximum_stay_nights'')::integer end;
  if v_minimum is not null and v_maximum is not null and v_maximum<v_minimum then
    raise exception using errcode=''23514'',message=''hotels_v2_admin_b_maximum_stay_below_minimum'';
  end if;

  v_cover:=v_target.cover_image_url;
  if (v_payload?''cover_image_url'' or v_payload?''photos'')
     and v_cover is not null
     and not exists(select 1 from jsonb_array_elements_text(coalesce(v_target.photos,''[]''::jsonb)) photo(url)
       where photo.url=v_cover)
     and not (
       v_cover is not distinct from v_hotel.cover_image_url
       and not exists(
         select 1
         from jsonb_array_elements_text(coalesce(v_hotel.photos,''[]''::jsonb)) current_photo(url)
         where current_photo.url=v_hotel.cover_image_url
       )
     ) then
    raise exception using errcode=''22023'',message=''hotels_v2_admin_b_cover_not_in_property_gallery'';
  end if;

  -- A stale plan is never silently rebased. Field comparisons are diagnostic
  -- only: the Admin must build one fresh explicit Review and Save. Time values
  -- are canonicalized to HH:MM, matching the reviewed UI contract.
  if (v_has_public and v_hotel.updated_at is distinct from v_expected_property_updated_at)
     or (v_has_private and (
       (v_profile_exists and v_profile.version<>v_expected_profile_version)
       or (not v_profile_exists and v_expected_profile_version<>0))) then
    for v_key in select key from jsonb_object_keys(v_payload) key loop
      if v_key=any(c_private_keys) then
        v_current_value:=v_profile_before->v_key;
        v_target_value:=v_profile_target->v_key;
      else
        v_current_value:=to_jsonb(v_hotel)->v_key;
        v_target_value:=to_jsonb(v_target)->v_key;
        if v_key=''title_i18n'' and v_hotel.architecture_version=''legacy'' then
          v_current_value:=v_hotel.title;
        elsif v_key=''description_i18n'' and v_hotel.architecture_version=''legacy'' then
          v_current_value:=v_hotel.description;
        end if;
        if v_key in(''check_in_from'',''check_out_until'') then
          v_current_value:=coalesce(to_jsonb(to_char(
            case when v_key=''check_in_from'' then v_hotel.check_in_from else v_hotel.check_out_until end,
            ''HH24:MI'')),''null''::jsonb);
          v_target_value:=coalesce(to_jsonb(to_char(
            case when v_key=''check_in_from'' then v_target.check_in_from else v_target.check_out_until end,
            ''HH24:MI'')),''null''::jsonb);
        elsif v_key=''amenities'' then
          v_current_value:=coalesce((select jsonb_agg(code order by code)
            from jsonb_array_elements_text(coalesce(v_hotel.amenities,''[]''::jsonb)) code),''[]''::jsonb);
          v_target_value:=coalesce((select jsonb_agg(code order by code)
            from jsonb_array_elements_text(coalesce(v_target.amenities,''[]''::jsonb)) code),''[]''::jsonb);
        end if;
      end if;
      if v_current_value is distinct from v_original->v_key
         and v_current_value is distinct from v_target_value then
        v_conflicts:=array_append(v_conflicts,v_key);
      end if;
    end loop;
    raise exception using errcode=''PT409'',
      message=case when cardinality(v_conflicts)>0
        then ''hotels_v2_admin_b_property_field_conflict''
        else ''hotels_v2_admin_b_stale_property_review'' end,
      detail=jsonb_build_object(
        ''reason'',case when cardinality(v_conflicts)>0
          then ''reviewed_field_changed'' else ''stale_version_non_overlapping'' end,
        ''changed_fields'',to_jsonb(v_conflicts),
        ''expected_property_updated_at'',v_expected_property_updated_at,
        ''current_property_updated_at'',v_hotel.updated_at,
        ''expected_operational_profile_version'',v_expected_profile_version,
        ''current_operational_profile_version'',case when v_profile_exists then v_profile.version else 0 end
      )::text,
      hint=''Refresh, rebuild Review, then save explicitly. Nothing was retried.'';
  end if;

  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode=''23505'',message=''hotels_v2_admin_b_correlation_id_already_used'';
  end if;
  v_before:=jsonb_build_object(''property'',to_jsonb(v_hotel),''operational_profile'',v_profile_before);

  if to_jsonb(v_target) is distinct from to_jsonb(v_hotel) then
    update public.hotels hotel set
      title=v_target.title,title_i18n=v_target.title_i18n,
      description=v_target.description,description_i18n=v_target.description_i18n,
      city=v_target.city,address_line=v_target.address_line,district=v_target.district,
      postal_code=v_target.postal_code,country=v_target.country,
      latitude=v_target.latitude,longitude=v_target.longitude,
      google_maps_url=v_target.google_maps_url,
      amenities=v_target.amenities,check_in_from=v_target.check_in_from,
      check_out_until=v_target.check_out_until,timezone=v_target.timezone,
      currency=v_target.currency,booking_mode=v_target.booking_mode,
      owner_partner_id=v_target.owner_partner_id,cover_image_url=v_target.cover_image_url,
      photos=v_target.photos,
      minimum_stay_nights=v_target.minimum_stay_nights
    where hotel.id=v_hotel_id and hotel.updated_at=v_hotel.updated_at
    returning to_jsonb(hotel.*) into v_after;
    if v_after is null then
      raise exception using errcode=''PT409'',message=''hotels_v2_admin_b_stale_property_during_apply'';
    end if;
    v_property_changed:=true;
  end if;

  if v_profile_target is distinct from v_profile_before then
    if v_profile_exists then
      update public.hotel_property_operational_profiles profile set
        maximum_stay_nights=case when v_profile_target->>''maximum_stay_nights'' is null then null else (v_profile_target->>''maximum_stay_nights'')::integer end,
        guest_instructions_i18n=v_profile_target->''guest_instructions_i18n'',
        check_in_instructions_i18n=v_profile_target->''check_in_instructions_i18n'',
        check_out_instructions_i18n=v_profile_target->''check_out_instructions_i18n'',
        internal_operational_notes=v_profile_target->>''internal_operational_notes'',
        updated_by=auth.uid()
      where profile.hotel_id=v_hotel_id and profile.version=v_profile.version;
      if not found then raise exception using errcode=''PT409'',message=''hotels_v2_admin_b_stale_operational_profile''; end if;
    else
      insert into public.hotel_property_operational_profiles(
        hotel_id,maximum_stay_nights,guest_instructions_i18n,
        check_in_instructions_i18n,check_out_instructions_i18n,
        internal_operational_notes,created_by,updated_by
      ) values(
        v_hotel_id,
        case when v_profile_target->>''maximum_stay_nights'' is null then null else (v_profile_target->>''maximum_stay_nights'')::integer end,
        v_profile_target->''guest_instructions_i18n'',
        v_profile_target->''check_in_instructions_i18n'',
        v_profile_target->''check_out_instructions_i18n'',
        v_profile_target->>''internal_operational_notes'',auth.uid(),auth.uid()
      );
    end if;
    v_profile_changed:=true;
  end if;

  if v_property_changed or v_profile_changed then
    select jsonb_build_object(
      ''property'',to_jsonb(hotel),
      ''operational_profile'',(public.hotel_v2_admin_get_content_control_114487(v_hotel_id)->''operational_profile'')
    ) into v_after from public.hotels hotel where hotel.id=v_hotel_id;
    insert into public.hotel_activity_log(
      hotel_id,entity_type,entity_id,action,before_state,after_state,
      actor_type,actor_id,source,correlation_id
    ) values(
      v_hotel_id,''property'',v_hotel_id,''update'',v_before,v_after,
      ''admin'',auth.uid(),''hotels_v2_admin_b_property_control'',p_correlation_id
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at,activity.id),''[]''::jsonb)
  into v_activity from public.hotel_activity_log activity
  where activity.correlation_id=p_correlation_id;
  return jsonb_build_object(
    ''ok'',true,''contract_version'',c_contract,''hotel_id'',v_hotel_id,
    ''changed'',v_property_changed or v_profile_changed,
    ''property_changed'',v_property_changed,
    ''operational_profile_changed'',v_profile_changed,
    ''correlation_id'',p_correlation_id,
    ''workspace'',public.hotel_v2_admin_get_property_workspace(v_hotel_id),
    ''content_control'',public.hotel_v2_admin_get_content_control_114487(v_hotel_id),
    ''activity'',v_activity
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode=''22023'',
      message=''hotels_v2_admin_b_invalid_property_numeric_value'';
end
';
create function public.hotel_v2_admin_apply_partner_property_proposal_plan_114489(
  p_reviewed_plan jsonb,p_correlation_id uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
AS '
declare v_actor uuid:=auth.uid(); v_review_id uuid; v_review public.hotel_partner_property_proposal_admin_reviews%rowtype;
  v_draft public.hotel_partner_property_drafts%rowtype; v_hotel public.hotels%rowtype;
  v_action text; v_result jsonb; v_terminal_activity jsonb;
begin
 IF p_reviewed_plan->>''hotel_id'' IS DISTINCT FROM ''9b6d99a0-923a-4fbc-be54-c066e856e6ca'' THEN RAISE EXCEPTION USING errcode=''42501'',message=''hotels_114489_target_required''; END IF;
 PERFORM hotels_published_architecture_private.assert_exact();
  perform public.hotel_v2_h2a_require_admin();
  if p_reviewed_plan is null or jsonb_typeof(p_reviewed_plan)<>''object''
     or v_actor is null or p_correlation_id is null
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_reviewed_plan) then
    raise exception using errcode=''22023'',message=''hotels_v2_seven_arches_property_proposal_plan_invalid'';
  end if;
  begin v_review_id:=(p_reviewed_plan->>''review_id'')::uuid;
  exception when others then raise exception using errcode=''22023'',message=''hotels_v2_seven_arches_property_proposal_plan_invalid''; end;
  perform pg_advisory_xact_lock(hashtextextended(''hotels-v2-7a-property-proposal:''||v_review_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended(
    ''hotels-v2-7a-property-proposal-correlation:''||p_correlation_id::text,0));
  select * into v_review from public.hotel_partner_property_proposal_admin_reviews
    where id=v_review_id for update;
  if not found or v_review.actor_id<>v_actor
     or v_review.reviewed_plan is distinct from p_reviewed_plan
     or v_review.plan_fingerprint is distinct from public.hotel_v2_h3_2b_hash(p_reviewed_plan-''plan_fingerprint'') then
    raise exception using errcode=''22023'',message=''hotels_v2_seven_arches_property_proposal_plan_invalid'';
  end if;
  if v_review.consumed_at is not null then
    if v_review.consumed_correlation_id=p_correlation_id then
      return v_review.result||jsonb_build_object(''replayed'',true);
    end if;
    raise exception using errcode=''PT409'',message=''hotels_v2_seven_arches_property_proposal_review_consumed'';
  end if;
  if v_review.expires_at<=clock_timestamp() then
    raise exception using errcode=''PT409'',message=''hotels_v2_seven_arches_property_proposal_review_expired'';
  end if;
  select * into v_draft from public.hotel_partner_property_drafts
    where id=v_review.proposal_id for update;
  select * into strict v_hotel from public.hotels where id=v_review.hotel_id for update;
  v_action:=v_review.action;
  if v_draft.id is null or v_draft.status<>''pending_admin_review''
     or v_draft.version<>v_review.proposal_version
     or p_reviewed_plan->''expected_original'' is distinct from jsonb_build_object(
       ''status'',v_draft.status,''version'',v_draft.version,
       ''source_property_updated_at'',v_draft.source_property_updated_at,
       ''content'',v_draft.content,''photos'',v_draft.photos,''updated_at'',v_draft.updated_at) then
    raise exception using errcode=''PT409'',message=''hotels_v2_seven_arches_property_proposal_stale'';
  end if;
  if v_action=''accept'' and (
       v_draft.source_property_updated_at is distinct from v_hotel.updated_at
       or (p_reviewed_plan->>''expected_property_updated_at'')::timestamptz
         is distinct from v_hotel.updated_at) then
    raise exception using errcode=''PT409'',message=''hotels_v2_seven_arches_property_proposal_stale'';
  end if;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode=''23505'',message=''hotels_v2_seven_arches_property_proposal_correlation_conflict'';
  end if;
  if v_action=''accept'' then
    v_result:=public.hotel_v2_admin_apply_property_control_plan_114489(
      p_reviewed_plan->''property_plan'',p_correlation_id);
    select * into strict v_hotel from public.hotels where id=v_review.hotel_id;
  end if;
  insert into public.hotel_partner_property_proposal_admin_transaction_context(
    backend_pid,transaction_id,review_id,proposal_id,actor_id,action,admin_b_changed,correlation_id)
  values(pg_backend_pid(),txid_current(),v_review.id,v_draft.id,v_actor,v_action,
    case when v_action=''accept'' then (v_result->>''changed'')::boolean else null end,p_correlation_id);
  update public.hotel_partner_property_drafts set
    status=case when v_action=''accept'' then ''accepted'' else ''rejected'' end,
    source_property_updated_at=case when v_action=''accept'' then v_hotel.updated_at
      else source_property_updated_at end,
    version=version+1,updated_at=clock_timestamp()
  where id=v_draft.id;
  insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,
    before_state,after_state,actor_type,actor_id,source,correlation_id)
  select v_review.hotel_id,''property'',v_review.hotel_id,''update'',
    jsonb_build_object(''proposal_id'',v_draft.id,''status'',v_draft.status,''version'',v_draft.version),
    jsonb_build_object(''proposal_id'',draft.id,''status'',draft.status,''version'',draft.version,
      ''review_id'',v_review.id,''reason'',v_review.reason),
    ''admin'',v_actor,''hotels_v2_h3_2b_property_proposal_admin_review'',p_correlation_id
  from public.hotel_partner_property_drafts draft where draft.id=v_draft.id
  returning to_jsonb(hotel_activity_log.*) into v_terminal_activity;
  v_result:=jsonb_build_object(
    ''contract_version'',''hotels_v2_seven_arches_property_proposal_admin_apply_v1'',
    ''hotel_id'',v_review.hotel_id,''proposal_id'',v_review.proposal_id,
    ''action'',v_action,''status'',case when v_action=''accept'' then ''accepted'' else ''rejected'' end,
    ''correlation_id'',p_correlation_id,''replayed'',false,
    ''admin_b_result'',v_result,''terminal_activity'',v_terminal_activity,
    ''control'',public.hotel_v2_admin_get_partner_property_proposals(v_review.hotel_id));
  update public.hotel_partner_property_proposal_admin_reviews set
    consumed_at=clock_timestamp(),consumed_correlation_id=p_correlation_id,
    result=v_result where id=v_review.id;
  delete from public.hotel_partner_property_proposal_admin_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current() and context_row.review_id=v_review.id;
  if not found then
    raise exception using errcode=''55000'',
      message=''hotels_v2_seven_arches_property_proposal_context_cleanup_failed'';
  end if;
  return v_result;
end
';
CREATE FUNCTION hotels_published_architecture_private.workspace_read(p_partner_id uuid,p_hotel_id uuid,p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $workspace$
 BEGIN RETURN hotels_published_architecture_private.foundation_9caf92b3a8833eba(p_partner_id,p_hotel_id,p_from,p_to); END $workspace$;
CREATE FUNCTION public.hotel_v2_admin_apply_property_control_plan_114489(p_plan jsonb,p_correlation_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
DECLARE before_hotel jsonb; after_hotel jsonb; result jsonb; actor uuid:=auth.uid();
BEGIN
 PERFORM public.hotel_v2_h2a_require_admin();
 PERFORM hotels_published_architecture_private.assert_exact();
 IF actor IS NULL OR p_correlation_id IS NULL OR p_plan->>'hotel_id' IS DISTINCT FROM '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
 THEN RAISE EXCEPTION USING errcode='42501',message='hotels_114489_target_required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('hotels-114489:9b6d99a0-923a-4fbc-be54-c066e856e6ca',0));
 SELECT to_jsonb(h) INTO STRICT before_hotel FROM public.hotels h WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' FOR UPDATE;
 PERFORM hotels_published_architecture_private.state_snapshot();
 INSERT INTO hotels_published_architecture_private.context(transaction_id,backend_pid,request_id,actor_id,before_hotel,operation,payload)
 VALUES(txid_current(),pg_backend_pid(),p_correlation_id,actor,before_hotel,'property',p_plan->'payload');
 -- Historical writer remains untouched. Its exact source, field validation,
 -- timestamps, stale checks, media provenance and audit behavior are retained
 -- in the separately pinned private implementation.
 result:=hotels_published_architecture_private.property_writer(p_plan,p_correlation_id);
 SELECT to_jsonb(h) INTO STRICT after_hotel FROM public.hotels h WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
 IF before_hotel IS DISTINCT FROM after_hotel THEN
  INSERT INTO hotels_published_architecture_private.property_history(id,hotel_id,actor_id,created_at,before_hotel,after_hotel)
  VALUES(p_correlation_id,'9b6d99a0-923a-4fbc-be54-c066e856e6ca',actor,clock_timestamp(),before_hotel,after_hotel);
 END IF;
 DELETE FROM hotels_published_architecture_private.context WHERE transaction_id=txid_current() AND backend_pid=pg_backend_pid() AND request_id=p_correlation_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'hotels_114489_context_missing'; END IF;
 PERFORM hotels_published_architecture_private.state_snapshot();
 RETURN result;
END $f$;

CREATE FUNCTION public.hotel_v2_partner_get_workspace_114489(p_partner_id uuid,p_hotel_id uuid,p_from date,p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
DECLARE result jsonb; evidence jsonb;
BEGIN
 IF p_partner_id IS DISTINCT FROM '0a321bfe-da6b-43f6-8e0b-7c68546a8b18'::uuid
 OR p_hotel_id IS DISTINCT FROM '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid THEN
  RAISE EXCEPTION USING errcode='42501',message='hotels_114489_target_required'; END IF;
 PERFORM hotels_published_architecture_private.assert_exact();
 PERFORM hotels_published_architecture_private.require_lifecycle();
 evidence:=hotels_published_architecture_private.architecture_evidence();
 -- This is a source-pinned clone, NOT an old DTO followed by fabricated
 -- architecture flags. All property data is read from the physical Hotel.
 result:=hotels_published_architecture_private.workspace_read(p_partner_id,p_hotel_id,p_from,p_to);
 IF result#>>'{property,architecture_version}' IS DISTINCT FROM evidence->>'architecture_version'
 OR result#>'{property,is_published}' IS DISTINCT FROM 'true'::jsonb
 OR result->'public_change' IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'hotels_114489_workspace_drift'; END IF;
 RETURN result||jsonb_build_object('contract_version','hotels_v2_h3_2b_partner_workspace_114489_v1','architecture_successor',evidence);
END $f$;

-- Preserve unrelated Hotels' unpublished-only rooms_v2 rule.
ALTER TABLE public.hotels DROP CONSTRAINT hotels_h2a_rooms_v2_unpublished_check;
ALTER TABLE public.hotels ADD CONSTRAINT hotels_h2a_rooms_v2_unpublished_check CHECK(
 architecture_version='legacy' OR coalesce(is_published,false)=false OR
 (id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND architecture_version='rooms_v2' AND is_published=true));
DO $security$ DECLARE r record; BEGIN
 FOR r IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='hotels_published_architecture_private'::regnamespace LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',r.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.sig);
 END LOOP;
 FOR r IN SELECT oid::regclass rel FROM pg_class WHERE relnamespace='hotels_published_architecture_private'::regnamespace AND relkind='r' LOOP
  EXECUTE format('ALTER TABLE %s OWNER TO postgres',r.rel);
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',r.rel);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',r.rel);
  EXECUTE format('REVOKE ALL ON %s FROM PUBLIC,anon,authenticated,service_role',r.rel);
 END LOOP;
 FOR r IN SELECT oid::regprocedure sig,proname FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND proname IN('hotel_v2_admin_get_published_architecture_conversion_114489','hotel_v2_admin_convert_legacy_hotel_to_v2_114489',
 'hotel_v2_admin_apply_property_control_plan_114489','hotel_v2_admin_apply_partner_property_proposal_plan_114489',
 'hotel_v2_partner_get_workspace_114489','hotel_v2_public_get_seven_arches_display_114489') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',r.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.sig);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',r.sig);
  IF r.proname='hotel_v2_public_get_seven_arches_display_114489' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',r.sig); END IF;
 END LOOP;
END $security$;
INSERT INTO hotels_published_architecture_private.foundation_certificate(id,predecessors,helpers,relation_catalog,entrypoints)
 SELECT 1,'[{"signature":"hotels_guest_policy_private.assert_exact()","meta":["3c9c0adfe16be6f81ef9a6a350df812d6d076d99667a36520197818ab52e477a","64ca60810999cc4110da7b2e78c07b6eb8831820a4ad8376b9b0eeddc9275d6f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"hotels_guest_policy_private.historical_hotel(jsonb)","meta":["d781586ad40137fe5f90354fc468d221fbd0288ce571fb99af4d410a21c6241b","776c93d4614c71ccebcce2754ceade6f817dd39491401319af8068dd2fe04615","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_hotel jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_guest_policy_private.original_definition(oid)","meta":["99b16ba76d2cfa3c86370e0fd4c9dc0575cb447c68d108e5bd332dac395f84f6","d371c72e9a45b096fc11d288a810cf92d6270f25eca9be2f3b84b779690d8abf","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_guest_policy_private.original_source(oid)","meta":["e9989350cadedab22bb961f825314885210bee91f55a0178762c656761a09545","a055ccb717628c7cf5b925ad8043f773f55d3ba106b5f78e516970074613edda","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_guest_policy_private.raw_metadata(oid)","meta":["65e9d9a19c19f1e8281861752f6f7be2dcba7720fda4810a435a750ad14531b0","16ff13fdd37b8f77bb273cca6ed8989e64dbe1d13eb7054ae4770b4ad8a7ef1b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_guest_policy_private.relation_catalog()","meta":["b1c6e84dfe0ccfd4fea4ab41537060c155e303dcce77aa967bfa09469cc3413c","e6cbab5a7c12d50b269d6e5a74711b43f95f17f82ee7c9ed7900f04f059cffa6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.actual_flags()","meta":["ecd751821530611bfe8b925fa5bb73c408def4823acc1d794b70d6e5bb89fb59","962a73c55a3c98bfd3a9f3d482b65d58e99d994402e402974d374d8d1c3b76fa","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.catalog_snapshot()","meta":["a9daaad29c3561c8191707fcef258d3fb734705058c4b15ec857ef2e554f5aa7","c19d455d09b6f70cd4f3a5a8fcb53e0d023b15f1909e622b1ba505e5955e1c9a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.chain_state()","meta":["a9bafdb21a9cce7007e14a25686a1c17606eaf2586b9778368aa9be25eba4c24","ebf51ccb03f5cc99557c75c652c4ac5df3615a7172dd547cc3fdcf8cb0cb0cd1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.hash(jsonb)","meta":["0efcedbc625bdd5c0e6dc3f27a59e846460fe328880fd562d3f0de352c913b5a","20cfb347b6a0a3a2e5f336c49502db4b971a09ac8d42b9d2761bbcd9f689419b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",false,false,true,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"hotels_lifecycle_private.metadata(oid)","meta":["2b49509d355fc1078aafed91f4f9307c3d55413169d7e514cab68f9e1faf760d","a142b14c75138d354bcebefc01ef04cbf5f7567fd1278c8017e08a813cdaf285","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.partner_connection(uuid, uuid)","meta":["f46e6a3fb6e534739c91a61abeec102c32b67500b7d597d954ea01e57a3dedbc","69d6f8ce807885f9ae0017bebddc9781f218c5f2df29d37181c5f5b8c5d50ce2","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid","uuid, uuid","jsonb","u","f"]},{"signature":"hotels_lifecycle_private.predecessor_definition(oid)","meta":["f9ce2c676af6004f902b82e4ee7e8d7e3e7436f12a558bea694263adfe3a3b8d","e0e8e3c59a2129cdcc7e5abdc143a1712c744682df69b6465c31c08cea42dcac","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lifecycle_private.predecessor_flag_exact(text, boolean)","meta":["9b1a2be02f556e7797922aceeb61211355dd576501598206b93bf0796612f11e","3f04b84001f1726d6f522ef71ac8ebbf358a6ace0e659ff93d4927bd57c7775b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_flag text, p_actual boolean","text, boolean","boolean","u","f"]},{"signature":"hotels_lifecycle_private.predecessor_source(oid)","meta":["983d1c22792ce60fcd73e71d1e5f3bfe6869f3b2ba734e92a4364f924741819f","187726e4823dd2e6c1d648767dd2a0e1b6c87125045593823668cd81e0f211f2","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lifecycle_private.safe_state()","meta":["780d8fd7853a49d3cab639d8590a786fe88302b6f254c44b9d68b85932a0da7e","acfaa64ff3f8d11115c011b19e7742f53bc2b72d866a46c63011f2d7137ec507","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"hotels_lineage_private.catalog_fingerprint()","meta":["9798b885198ee02fc8b7154ce67d2caba98b885268ae29a8f486894032657084","a3206a944748159fc64b179eedd39b24db441a515dda4e7e6af1025f21ab8812","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","text","u","f"]},{"signature":"hotels_lineage_private.catalog_is_exact(jsonb, jsonb)","meta":["4767d2844cfd78f1ca6661c8bc2d756e3a1158985445b00c6b17524aa350419f","3394ba926e32ba5b2758c0639fd4860bebe039ef22fe4f208357f5f10068a078","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","current_jsonb jsonb, historical_jsonb jsonb","jsonb, jsonb","boolean","u","f"]},{"signature":"hotels_lineage_private.current_anchor_is_exact()","meta":["9640721b8192e8e60d983dd2115ee31a856d3afda150e7a68361d1a37e10a031","09b53f2cef94a22de26e236cac7c9a5b57de063e5d9a4f2b953421da77d43405","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"hotels_lineage_private.function_map()","meta":["fb0fac6e627924bbefe4d302ab885499cc1897bac1548012b4bbb1dcafed5a54","704a264f24fcd7a74f6f97b33976a1672f57ad8b158ae2750b1ac69d68c2629e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_lineage_private.lineage_matches_historical(jsonb)","meta":["71a29e0880a00f5697a45b787009d8f8673f59a1267d40021bb4b8c38fbcc8dc","f99035c6fb8e06b70f88d323dba27263f86d813d6b4580bf164b339aa33b40dd","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","live jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_lineage_private.owner_constraint_tokens(text)","meta":["71b5fc65cefe575c1069bdd8e1a7d7c1a953c3e7614db0f38f0dc4270d315f66","fc8785e641b50ad5061070300cff8bc28ae87d826b25723dfe22a222f8e84a9f","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,true,false,"plpgsql","input text","text","text","u","f"]},{"signature":"hotels_lineage_private.permission_evidence()","meta":["6b59caafd6caa96a5df5c107910e3ce3dd5eb8776201e4e8e72aa3cb9bf365bc","6d3750550dec8402290508d3ab7554422e5f0050ded7935e248528bcc3301974","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"hotels_lineage_private.predecessor_definition_hash(oid)","meta":["17cf79369b87f8d42d603176badec258f56feeac7fc833cd479b413c732dd0da","ea7d2955263e19ca888bfb60f50b1a3a0204ecfb9c98ca90e02d8a0dcf23a96e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lineage_private.predecessor_source_hash(oid)","meta":["5af87a938445ef7db28016ad5de01e397dd93c4dc32f548940fd0866e595eb96","d633a11df77465cef30bec84ef5d3c596e07483ea9107d07460f18259b7660ef","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_lineage_private.predecessor(oid)","meta":["f7371ac466fa1b3b95480d13e2447cd1817ae8a7bd76c439dd8673795d1f764c","3824d228b8e778e18490d3948ccaf5f9fc98d0eef50804e9d96fde8fe2dc4043","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_lineage_private.successor_binding_pin(jsonb)","meta":["d9fff1cd2a8eebb20670daa5a4ae33472f8a76a2f0b8be2dcb8b80f3018e038c","59f3faeabc8252eb6d9738eac99963c2c1bac4831d927542348f2eef61051c7c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",true,false,false,false,"sql","b jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_lineage_private.successor_manifest(integer)","meta":["cece5beeeec9d0bb1e72a9851f095792834010246f791445a5185c06e1298500","d46d52cf3836c52e178115c02146fa0dacd965c9d87d71231913188c8342bdcd","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",true,false,false,false,"sql","p_stage integer","integer","jsonb","u","f"]},{"signature":"hotels_lineage_private.successor_metadata(oid)","meta":["b332ed3e26a761f855d8ef6a005667f57938738633f4c0c22b5ee0718d026ebb","92e46301d758a60c140c2a93f068ec1f5ccf700c2cd04f1582b59db4114e751d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_lineage_private.successors_are_exact(text)","meta":["fcf5478ea42f47e6aa45ef2d7aa1a94828a92b3ba763e784b95efbba34fe4139","863038839343d9a2f107fe1770f3c2e1e80a4f29f1761b7219d016368be26a45","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_root_hash text","text","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.assert_exact()","meta":["e209551631678bf5c1e97036d1f0b30a50b12b9513f94b987056c5d5dc1a68d3","5703b0931913f4e71523c42d488925b1628550ff12cca8d40b011a4969f85755","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"hotels_partner_read_once_private.metadata(oid)","meta":["372e9d2743beb23df24eff2d23f7748f97fc8e7e42348a3ea9a97d8c6eaf08c3","88378c155ecac7441f30b91580cc91b7d145cf489e835bc40745f0ba4ba3a31e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_oid oid","oid","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_06b6ba66f8598192(jsonb)","meta":["e73900b38e7364eba18088e3d4b6fcc5c38fa75fea748ee311e4c758700fa999","0b3fbd40322e99c103bfd3743b2373868e80a09f8eae7649ba5a29082979eddf","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_326760525d39fd81(jsonb, text, boolean)","meta":["5143548687336ab2ad3bf7ad74cff70a066722ee7681e27b134fcbe9a957f2dd","15afd652ea5b575267362249b35d783705319d14a8863c2f2eaa0a4a1293ef75","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, p_flag text, p_actual boolean","jsonb, text, boolean","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_3590b4e257042f09(jsonb)","meta":["d7a7f86120015784fa45e13cc75997cc544e580e2009f0c16c197fb90244055a","dc9ee8e67e06eff56414973ff386441f714f7f4e4f5dcfba8ed4138132d178dd","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","void","u","f"]},{"signature":"hotels_partner_read_once_private.read_3a98b157088d7466(jsonb, jsonb)","meta":["845ee26c11ee172fb8831f1b32fc0e7539b303ad9bdfc8e37275c272a471c54e","b1e701657cd1cb8674b8eb19db05f0c98ff28fd39d36359daaabe1f64d7f7094","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, p_hotel jsonb","jsonb, jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_63e67309c0eb62b8(jsonb)","meta":["255dbd4658b4aad4aa8612f350527a618f5743f5c1428b49f2162ee9e9c4e50c","8f57ca9ebf95360e73b98e2c1048721852ef1963fdcd7f36e85eb039c930ae4e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_7546feecb3da2c1b(jsonb)","meta":["379a8f5c51a45f0b59df10190f53b64ea85bc086df4905c6c490f9c5b2c16652","8cc39a2fa365d3b85a34918b8d658de392c7aa8a3dcf6ddb1f72556763e6a646","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_7c61c7b83a83f59b(jsonb)","meta":["781773927e7babad9d1f713c643779d46071e5aa7f73ee12a6c151ef81163706","03fc082c3aef3380d62f0d3d0e2efb556e1e14d87480b7c28e9dcd9eded0a6b1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","void","u","f"]},{"signature":"hotels_partner_read_once_private.read_806282cb24f87125(jsonb)","meta":["a679f3667a2a3f4ae7727ddb7548c508ddd2036653745f1bb9a26ae76c3f233a","3858379df1c4ea0f5f4dc2ea1ec03a3e1c1ed80b600d878cae5572c42677ce9b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_9e863cbe183fb1f3(jsonb)","meta":["f0e16b8ab734ed6991f8651ac0def8eec90a8f0b51b50748cf54b9c10721bc4a","48f88a1744e4fb0bac413f1d90f37c43db54129792c93ab46d8308de95b1a55f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_a3533e7d7979ea15(jsonb)","meta":["7c62dfd4d6651b0b8fcb81dce1bf034dbbe579422cf4185f6abde85967f0b320","14a24ecbee9a05864e8099dd3af7982f9b6b2e9d149f3ff42ba91399858ad510","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","text","u","f"]},{"signature":"hotels_partner_read_once_private.read_a41f675cf9007752(jsonb)","meta":["48800766671c3a760983dfc8b1c76f95613b6fdac82525cd2342fd6015f06900","fb64c6786d15ada3aafd925b9a5051ea0e7a6c9b69eb55502ea490ee18c8700a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_bf842dd83e381815(jsonb, text)","meta":["ca346e8a921be1f95774d04ff6c8af47cd5459870cfd42a8737a97679b221525","7eae5e487950740110a1415102ffcbbcdfd5cb7d49a1ace7246cf1f4206b33ec","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, p_root_hash text","jsonb, text","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_c8415e562fc992ed(jsonb)","meta":["7846358e0cf067290fba1ed63f23a87821af1141f70c4eee66aab2d32119a033","b50b725833b881d16b6ed16435703246e5ef058646007cbdce2864e37fbb1c22","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_d31405a1a55a0f2b(jsonb, jsonb)","meta":["a4bca843b1765323e98b13610bf8073a5bd447a79c0af0c5a5a19a5c76728a12","81b6b01f62c22430297950522d56186d86a1f351fb327179c076bf6e78d004c9","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb, live jsonb","jsonb, jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_d848c718a811c87c(jsonb)","meta":["8ff5f6fb3f6a251ac6081c25f409bfb1176b169fbc57c9ccc1676e6c486d1046","68c1bd1e992515ce6fb1fa38b1e25bd17cacbc10972711f3b0f4eb9fcfed55ef","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_dfbc6217b32ff0fc(jsonb)","meta":["67a390fbb9084ddbc453dbaabe999fdd38745c4e5743fb65c59ce3ceec2e7cf3","d1ac898b56884011f9505a1893ea9c77ccd70be936b812c40a28b0366ce3456d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_read_context jsonb","jsonb","jsonb","u","f"]},{"signature":"hotels_partner_read_once_private.read_e9411f087eaf40a5(jsonb)","meta":["82afe9077f43205d20b86cb545d389a62079e6f4ae948e23cce814d0f68fab1b","8f1cfd81b8e134e395a753a388ae54b09b685ac1d47c948e341a3471012b2e3b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_partner_read_once_private.read_f46b02a57427361e(jsonb)","meta":["4da7250d92c2adb866fd6043ec34264f7ed45bf31dcbf96b9b45f0885a7c179e","0c6e1520c1a34629dfbc10b05fb9b204fd63ae96b5f783ffce73d4b45e3619b3","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_read_context jsonb","jsonb","boolean","u","f"]},{"signature":"hotels_stripe_dto_private.assert_exact()","meta":["27a6557461c65b339d4bc4aee6c9faf8f83748fe134d4b852c9e5f4dfb99287c","d7938495d53ff4072b314db3045f80ffc796d3ef886d65699e24c1ac6f066c95","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"hotels_stripe_dto_private.helper_catalog()","meta":["95c4c33e0d17c6c9e175aa3b621dca32da8830691ab761eff6a4e9552cf0c21f","000be517942288f4f8c289ea4560e2e2a9e1c21bb42a48044a7747118b7f770d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_stripe_dto_private.predecessor_definition(oid)","meta":["73decaf4897d6f04354399f8cfe1d8a8c5c7e8236e07c900b2d419c0f2277a4a","6c28a747c3654fa8427d15b64e275d4a751674cdf8b5c17cae6044e54a00d862","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_stripe_dto_private.predecessor_source(oid)","meta":["199d181264570cba6dd5eb0c370bd19c6da613dfd5d76717f3a1ac71d20ba78a","1c367cfe650319b703b1e2ee3b9c9f7276b519f945a7cccc7df18f9df6ed2226","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,true,false,"plpgsql","p_oid oid","oid","text","u","f"]},{"signature":"hotels_stripe_dto_private.relation_catalog()","meta":["d7955b8131b837f37fece6afa3dc8e9e8b2a91aed90f787b1e4e10db2fed1b44","518b6f29d7aaec14b0ec1130780febf11b4b49f9804b6833d22c34ef542d26d7","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()","meta":["0469f5be71cfaeaa3656bb31cdbf9c89e4284817229ac98971d833216122bbf5","e7e719a1ea773c437a67dc60fe00958ad686cf28499ac58c6428868e40cd3566","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_v2_private.hotel_external_calendar_provider_function_source_hashes()","meta":["c6bd94ce0c4d1d01709acd21c64b2270a16d23c7bf9402ecdba0d669d8fc88dd","fa4ca6bc17982e43b47d9b83d288805aaa1f1cd8c574e2a94352d8be085849a5","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()","meta":["2d4c38d1c9214f0890ace1be2d481300577edadca66a64741bcd7ca2fce52c25","e000fbc317082ce691f89c131eb3ecf9f3fc0f93e7011a35811182676bbcbc07","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_7a_pricing_activation_transaction_is_preserved()","meta":["1e74c1b709abb1fb29de0283d37d03325fd0ed7d5f6a01567a73174f8c6e983e","3c4fda73f8834d38f1c5f21fb8d00e5cd78923109705ac2addcbe2c63b06549f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_7a_reviewed_pricing_partner_access_is_current(uuid)","meta":["26f5b9eacf9f77e7530607b7bab3f1fff1cc8a3e8c184ef1604e8a7d3a3364ad","49d37798ff060978dabcac1fcc1d492d1ddfdde55d14e4b5e1e9f6cd85a75567","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_proposal_id uuid","uuid","boolean","u","f"]},{"signature":"public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()","meta":["448e4e89c367efe15c33c3c6fa0a92f4d9972957da130b365536c15bd25fc69a","dcd0e3362d7268c1b4ae58aab7727ec40a4c7694db99ab8e76f26b52ac65eed2","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_allocation_items_fingerprint(uuid)","meta":["ccbe8150dae1b9aa1d973f7cb6c1065933e9f6acb344bc96d2b6f7a9b3b6b9d7","a839aef0f576e0790ec78a2c8600132e2907278bfc569e74cf0ff96c807791c4","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_rule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_cancellation_policy_is_valid(jsonb)","meta":["986704ae01fc5c2e22ac88213d1258a59c209dde8e887260e1c5283e9050f7db","074da5dfeeceda1122738c37d50ec16f2db5b2e311bb0f02feb70c588e38d0ac","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_policy jsonb","jsonb","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_enforce_graph_limits(uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer)","meta":["44570d9e23af259bc8cc4b4f68dfbbdbd45cf222f295818b6cf6a68d67130e90","dd643f1a30608e69b5de850d6699b7137733da5709fc34864b14e2aaf3560211","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"v",true,false,false,false,"plpgsql","p_hotel_id uuid, p_plan_delta integer DEFAULT 0, p_rate_delta integer DEFAULT 0, p_schedule_delta integer DEFAULT 0, p_rule_delta integer DEFAULT 0, p_exact_delta integer DEFAULT 0, p_allocation_delta integer DEFAULT 0, p_schedule_tier_delta integer DEFAULT 0, p_direct_tier_delta integer DEFAULT 0, p_allocation_item_delta integer DEFAULT 0","uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer","void","u","f"]},{"signature":"public.hotel_v2_admin_c_https_url_is_valid(text)","meta":["c4a3bbe6837f5c9827f992ecb1c23f70f9eae3420ea91ab8cc065ac3679918c9","424431fd5fd7a4f5354b3c0eb3eb9efbca7676e86818984bbbb72878ed2aa63a","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"plpgsql","p_value text","text","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_i18n_is_valid(jsonb, boolean, integer, boolean)","meta":["3d0eb69f24c1ea01f5801620ca2b329d60b6daf71a7fad481410cfcb817eeccd","591a016311c237636bd8ba8453b74b0e4b4eb4118556ab2b32de481abd1d79e4","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_value jsonb, p_require_all boolean, p_max_length integer, p_allow_lf boolean DEFAULT false","jsonb, boolean, integer, boolean","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_immutable_contract(uuid, text, uuid)","meta":["db46ee490fa9fb8cd82d5433d9207cde3a3a96693ab05859b500e308f38251f1","2e5defe980cfbff6baa15c77cb28437cc8c1283a38723dea21b8f9e6131aafeb","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid, p_entity text, p_entity_id uuid","uuid, text, uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_c_is_promotion_entity(uuid, text, uuid)","meta":["a9fd1c33c724e2f59e7a33b0c5cb8852669a077dce3354dc0e8c0f5e8fdd5f59","3a0f7b76d241f0bd3d62272032d75dab6dab4e537692af1994fc516d5d48840c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid, p_entity text, p_entity_id uuid","uuid, text, uuid","boolean","u","f"]},{"signature":"public.hotel_v2_admin_c_lifecycle(boolean, text)","meta":["55b9a9d32714a22e1d58581c2b99e91a8f7bd6561c5d192c08eff43bb8a07278","20bd207f2185b5f9894278af85ca1a36050cc58abd48c14cda6cddf4854b10fd","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_is_active boolean, p_review_status text","boolean, text","text","u","f"]},{"signature":"public.hotel_v2_admin_c_pricing_control_snapshot(uuid)","meta":["5d40f4475e8bbda75d3f44820ba90cca32fbb57cc405191e2c1369d1fc5a01c3","093de65e46b1372af1c5a594b6659679df1ee1b48a66364d4fcb4c5055f7cb33","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_c_room_tiers_fingerprint(uuid)","meta":["ee26c41eec7084e69e087e872e9647da40cfe7677b4fc05de481c3a6a733aa3b","a9b23c3666526993093daf7fa224334a0239bed3567d4572d1f75c332c95e1fe","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_room_rate_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_schedule_link_fingerprint(uuid)","meta":["96c6f32ffa32ae360019d1cd742fd3c6e93a74f64fbde3b78c3c099810784572","c912d6b4d40edc1c287916cb09a9d43ad7ad2b4be834b10692647354a28dce30","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_schedule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_schedule_source_summary(text, jsonb)","meta":["67a0f1e32364a83db130aafefcd9381ce825ca76884c510368f9551b407b72c0","37cc8779efa9cbd6ed99933cf6c8ffae83948becd62fefef68d657985d3f586e","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"plpgsql","p_source text, p_reference jsonb","text, jsonb","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_c_schedule_tiers_fingerprint(uuid)","meta":["914eaad5d7ab853758e1027480a1a113b5b64ffcbb9532b5a0125bbef1585891","f21629eec968c6ea467fb564acabb14885bf61ef7938ac8eac91a082d7d3dc28","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_schedule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()","meta":["3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35","0c5e70d6a35386dfbbaaeb15b54de5d9de215d7f6e1195c6a4e881960b98ce4a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_admin_d_current_foundation_snapshot()","meta":["677c8fba8970df369b356bf76fb42e07f3884fdcc058407151ea9d67f847bd62","9cbfd3fd7b3cd37045f867f278080cb7d010b8662480362bf65759ac1557eef6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_d_hash(jsonb)","meta":["d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828","1061e7c1549ef04fe3d3c657cd503d7f01be56f263e57024a6e811acd61e90ab","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",false,false,true,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"public.hotel_v2_admin_d_protected_fingerprints()","meta":["a6706c4bdad2180e8cb733949a0084f4355068555ad1014cea340f760e19f5f4","06ba8695d5431e2f5eb29082d4b667a94d3462e32946197032cbfe75ec49c92a","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_d_snapshot_external_base(uuid, date, date, boolean)","meta":["0d8e57d5bb06811f3ad39f6d4a638783d4517bf6c0b660a64a551790059e625c","c01e624bdc9ce151093bd36ad6f468d46dc386ada46a6e105027d016213b6d97","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"v",true,false,false,false,"plpgsql","p_hotel_id uuid, p_from date, p_to date, p_require_admin boolean DEFAULT true","uuid, date, date, boolean","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_d_snapshot(uuid, date, date, boolean)","meta":["7f665d523ae4cd0ecd9183645e50b2898426e1e62fd1bd74b652b87a227c1e7b","826e8bf6ede1d20c84a24b1a61fd002d9ac1226e612ed7ccba2dd3dbc8fdaefe","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"v",true,false,false,false,"plpgsql","p_hotel_id uuid, p_from date, p_to date, p_require_admin boolean DEFAULT true","uuid, date, date, boolean","jsonb","u","f"]},{"signature":"public.hotel_v2_admin_get_seven_arches_reviewed_pricing()","meta":["662c0e442aec46ee07f56ec5bac7a945af4613c15f76130809db4f9f8efa33be","39388f9ae2efeef1695d6e4e5369a6891ea64c26ad420bde71ea36e815de0aaa","postgres","{authenticated=X/postgres,postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_external_calendar_activation_function_fingerprints()","meta":["4050571cca29b2e8210f01806e8af643e484af6039985a0d2517b89ada5c2693","fd9c72053dfeee7ebef53c1a32dc706ff2fe3c777af23bb84863eb76d154c4b4","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_external_calendar_ics_source_type_is_supported(text)","meta":["36b05e8b654ae203ddd889c817464322e134cec638e1802acf8ae2092105c5d8","d88d33143e83da36247ad40d7ae8e0a7fd73e61c4f8ce7807bca5cc17c4c5378","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_source_type text","text","boolean","u","f"]},{"signature":"public.hotel_v2_external_calendar_protected_fingerprints()","meta":["f432744ec7753928726b3a4d4c999183d6f1f394217aa35182f594cd05b39d49","3adbe49659edfb0e9bad33876403f9c6459d1070baf38017dcc1fb06f85234db","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()","meta":["93cfd999504d4cd55e22252dec42a0ad96e0d35d5ed336333cfb2c7da35d2ff9","3f10cace4ac17410173c5f675a8e4b0cbd9146c112bb618cd7ba2affdb3bbcb1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_external_calendar_provider_sources_are_attributable()","meta":["78cef0753a71a5bf7304f0a627fdf687b12998b80e84626d59d41884dc522d68","d334acaea0ce017580be057634c4b956ec4041072faed4a11488b5e6f4a73333","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_external_calendar_site_settings_fingerprint()","meta":["8e88d7f4778e65afda80b98a9ba4b32a7ed7c56ae4022312bedcfd6f2b8e45f9","69370fd80f93f9f6df4f4f46613f625ff03e3f7d6c321952b3c15b51c893d382","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","text","u","f"]},{"signature":"public.hotel_v2_external_calendar_worker_hash(jsonb)","meta":["d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828","dedbffac95633e08fb511d9ff87b8213b0ceda62f580348ff860a64520cd49a2","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",true,false,false,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"public.hotel_v2_h2a_keys_allowed(jsonb, text[])","meta":["ad7d11bdbc9f1351e300ceaf9dc0e69b95464b0f8a4b6cd4fbdb179f77ae65e3","9c72b1257ffce0a67738723374b558eff16bf40cfbde2c2bb7553c5599c0e169","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_value jsonb, p_allowed text[]","jsonb, text[]","boolean","u","f"]},{"signature":"public.hotel_v2_h2a_require_admin()","meta":["2f1cc975916dbc86a63d348135a2ff83de50d9f31c20e70219257d476296fa3d","a44747b393c91606662d5cf110aca0ff31ea10501e7ae6e3eb0d838d7dccd3aa","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","","","void","u","f"]},{"signature":"public.hotel_v2_h2b1_children_policy_valid(text, integer, boolean)","meta":["fd4230ea0afb7b93ec7579714206a7f536f12db942b38fc0d125e4e19ff7030e","c75b718df46145d70ba4f26b84b451c25dfa7cceb4608819b4e01dca054bf6c5","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_policy text, p_minimum_age integer, p_allow_inherit boolean DEFAULT false","text, integer, boolean","boolean","u","f"]},{"signature":"public.hotel_v2_h3_1_codes_valid(text[])","meta":["b42b2345900af0c711871b1baff071931edd28e7135baa3f4511e789b049d3af","46275945b98f3310b6598dc1dfc48a0861c44b0284e20efabee23440be200ff5","postgres","{authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_codes text[]","text[]","boolean","u","f"]},{"signature":"public.hotel_v2_h3_1p_allocation_preview(uuid)","meta":["4964aa46351c50156f544dcaba03afae344cf5ef74164164eee5e930b2534e3f","5b6cf01e7ed53f46cc7a9786c05cbb7048292b5409f5f658f229ff99c0c64143","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_1p_expected_pricing_guest_count(text, uuid)","meta":["2ef5ca19ba7ea719ed67c190e0daef8b2452aea2aa320c121c3be041ab1da3a1","7ba888ed55f5d337a13ccb59771c3e01c42d2d9bec210e862be211d56b4ea344","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_rule_code text, p_room_type_id uuid","text, uuid","smallint","u","f"]},{"signature":"public.hotel_v2_h3_1p_parity_snapshot(uuid)","meta":["f4811812d61e75a7ba5634cdd555b0c608f6a12bf65b4aae745bd1dd007d0b9e","0a009fb68ac2ce44fcb4706e3a7064be40887061f58a540d9bc1ffad83f29040","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)","meta":["190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5","39b2e872c8c970b973e53b7139e6fe99fa93cc7f0a43769a4ebd4aca185aa151","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"plpgsql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_1p_schedule_tier_fingerprint(uuid)","meta":["3dc069f917328f11c67f9ebb78c3ad13951fdcea0af9372ee6eeec10a46a55fe","c3997cd2af659d9324b21dfa777ed414dcbe26fe3f928d0b06300b3e387de9b4","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_schedule_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_h3_1p_source_tier_fingerprint(uuid)","meta":["d3fb212c1f0350fa572e583e13dd2979e5d3336f962690ce9126273c0082d926","fd06dd52185d0a01559405b4c2dbf0f13f2856a85d2d51fd828b31c15a385d9f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",false,false,false,false,"sql","p_hotel_id uuid","uuid","text","u","f"]},{"signature":"public.hotel_v2_h3_2a_capability_catalog()","meta":["a01f1e7484b1c8253fef8d8baf6d4f705497cacd3473c45de4bdf015821f68fe","4db7eb03ea3cf595523568970898b768c4eb6ac2597b5dabf3e181814d358332","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","","","text[]","u","f"]},{"signature":"public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)","meta":["be3510f53b2c8034ce74433bbec8718f52301c1ee998179c5f1e55aab49d0cfe","03f7ade0d62881ec6e4714798e93affa725311a30d7ae4e3c3489c5041c5bc84","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"i",true,false,false,false,"plpgsql","p_value jsonb","jsonb","boolean","u","f"]},{"signature":"public.hotel_v2_h3_2a_permissions_snapshot(uuid)","meta":["2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3","ee616f51785c5a667077690537fe46252fb40d7d4af1fb13cc7e34c710180a35","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_assignment_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2a_require_partner_hotel_access(uuid, uuid, text, boolean)","meta":["2b5702a60866205e56c6ecb7492581cf1b262098f5142b39559de5c6feb012cf","b3eb3fdf0b50ecf0b72556db4308b665b5efb703abb5a251a7002d4ea03dfae6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid, p_capability text DEFAULT NULL::text, p_owner_only boolean DEFAULT false","uuid, uuid, text, boolean","uuid","u","f"]},{"signature":"public.hotel_v2_h3_2a_require_partner_membership(uuid)","meta":["90ad483c8ae6c061d69f9b05e2a7b205219a7dbf37047e750a0a507835814b50","5b7150da151427a43e1af1daec64fa0a95406f4467958e2c6278db55be8b3fa6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_access_snapshot(uuid, uuid, text)","meta":["7f8cb70e2c7034d17f03377cf7ffe3d5648e47dc27800e9ac3542bc95e2bb5b4","d4075c2ba3967d51f01473b9cbcc83b14740ee15130b709e1d33a78efa29704c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid, p_capability text","uuid, uuid, text","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_commission_policy(uuid)","meta":["533a819b7903a4247196955a555a32c4a26b4bea4450814017334c83903ace77","fd370f0873dc983fffb056dd2125d3d6a396787cb244badb3d1900e1fb884e40","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","p_hotel_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_exact_price_projection(uuid)","meta":["41f8609b712906301ef93e0eb438188ce1989e1114ccea1dcf3f55e1775f438b","aae829f7fd4ea4581b629c73f36fe281e31e9d0e98cc040a61a56ccbf2836a29","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","p_id uuid","uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_h3_2b_flags_off()","meta":["c4866c37cc2a4c5569e9efee957db4f13cc641290e2b2ea4b96f6265e9a2691f","65688b0eead33ba1011655ddf3f86969b0ae0659cdbd8e951e6d7c52e89907f6","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_h3_2b_hash(jsonb)","meta":["d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828","2f5016299bbcace7c05c7cf20d111ca3cc9bbbd7a3b525007b66b7ee5921722e","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","p_value jsonb","jsonb","text","u","f"]},{"signature":"public.hotel_v2_h3_2b_protected_fingerprints()","meta":["7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2","479b55caffc7051e454b417f89f71939359b6965c896a53236a6685c0ea05c2d","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_partner_get_seven_arches_reviewed_pricing_114488(uuid, uuid)","meta":["a3741a5c83780baed0b821834b4e0c72ba614d74aa9c349bc3d13c4641665b42","5f6679aa86ff7a894892f1969e825e2222fa9b70d138b91f17181985cc8e226c","postgres","{authenticated=X/postgres,postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid","uuid, uuid","jsonb","u","f"]},{"signature":"public.hotel_v2_partner_get_workspace(uuid, uuid, date, date)","meta":["ae51c6ed5516fe7c37b684ac843572af0d2b23b08ca28759b58c926c97df9798","7e9fb042f44426615b299b482739a8b2f0e4b7b696ef5d5a6e96317dbe2fd85e","postgres","{authenticated=X/postgres,postgres=X/postgres}",["search_path=pg_catalog, public, auth"],"s",true,false,false,false,"plpgsql","p_partner_id uuid, p_hotel_id uuid, p_from date, p_to date","uuid, uuid, date, date","jsonb","u","f"]},{"signature":"public.hotel_v2_partner_workspace_function_lineage_is_exact()","meta":["e1bbb882e4ed18b28ff638262aedd9f29692a520d62aa016b6ef2b82f79a7757","456c382b52be5ebdefa219870d66fa4b9bbf73d88b0c9f33e754ecd61d9c42f7","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_independent_pricing_activation_lineage()","meta":["2c40bc68f2d7dd54bb50654d0ca3e5a528509964377fc57e460718e7baa82fd9","c377770fd48822ba40ab1385fe367bd4f307000e9b0cfc2ed1ce91f1d9f2553e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_independent_pricing_legacy_projection()","meta":["b596013a158f7358a1ca7514bff6228d0dc88c2e4e1c7b2e4f6ee7437ecbac75","90ce815dee027915030ea24793e4c2aaf7d54b72de50a386169561ed159be73f","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()","meta":["9c891fee2fa897b4bb10940269d73d107b2e0d718247db0e61d9dc99a4b2b6bd","81df6679ef248287bad82861cd0a5f1e6efb7a0d436ddc7a5e04b50895b9f0c0","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_owner_capabilities()","meta":["cd66ff70012c3c3e155eb62ae8f398278ad162878f976cc620caa86a2dab3fd6","763120a749bf186709ffbcc3de59240a5a3bdb52f776f1db1ace3bd51d7c8f4a","postgres","{postgres=X/postgres}",["search_path=pg_catalog"],"i",false,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()","meta":["03dbfb03f1219361abe2173ee8e2b079b4191f6ab83d664fece9833926aeba94","bafa94cf095ad4b43b8fbdc7f52e0ca83ac2e7c25af7bb21721384dc26f2c8dc","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_pricing_activation_current_is_safe()","meta":["57cabf1992e9f03f5411715b59c29aea51501aa3a91b403d36e61264c394e420","c45a5617b905f6d0daaa9bbcb05cece78846043935ca6471317bb0284f349d4b","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()","meta":["04462d1fc2ade7d2c4574e7caef96f323cbb98a31d869c6f02e8f09dffe1dda4","e92044e10d61c2bb96ec0de0ca376167627856747bb8c58c24ba32315104b215","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_pricing_scoped_lineage()","meta":["11f6a865ddea542368bf76e707b0ec660a7245742a3db3441e99b9de22f7224d","7e6b0b496ec1a358bf7e6065df4dc936a5fe0351facad8b605a2240bb95f7287","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()","meta":["46cc1c679ce139cc79c808ecd264264393c27c99a7f67f192c2ea0c56b08456d","8c7e337ce3afddefb4f3dd3399064b269e035cca3b57845933ccb97dd8da2c5e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()","meta":["6c6f107b2d90abd7d9216cbd10c5d3817661250cdc35d52858c9ba923cfda258","e2dde9cf51680e038246104e512b0715c0662683d5bcfe684f0c6c4833ccaf72","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()","meta":["3ff36a3245901ea37f53e6dfbf9213e1bc72f127b7531041904833d5993eef17","8ffd62d7ee5c5ebff9d63aea826c4c7fb2086adc2c20378508b049ef73bd9dd9","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","text","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_current_state()","meta":["daa90ae3ec5515f22f8be8034276738d135bf3839bdd539dde99fe16636889c8","6658273707d91f56172b4946c3b1560da7b44c80dd40afe4df87f3e8ff655ab3","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_oracle()","meta":["50fee36eb4e4c7a11ad0baf0188a9f2042bde3678c5d835b3e8b7ece992ebfef","1b4b1497db1b0e4f07a550c4a5475c044f517041cc75b878331d3039104046a1","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"sql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()","meta":["ca914b81c1b0d22ad186669010b27b13c946949e73bfc84ce8065bea037e5424","cea8de2e25ff83aa1834cbb6c1ca4b78e73de145fc07f32234136da9d9a95649","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()","meta":["6e53ef01e748a54cb1dbbae5d35010a343aa4331a0c5450a4d2fc967a1e253fd","65a7931d8ac0d3c8926d9543ad4aed3a349f967a9a8b71d56c0cfd14ffc5858c","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","jsonb","u","f"]},{"signature":"public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()","meta":["17b801fefd47c93859f1e7868b606d3d56288dd590f931aa4c385148a72d85cc","b4d25cd69edb4c849abfad7e6d6da7e12a0ef4fc480201428ef1d251a941862e","postgres","{postgres=X/postgres}",["search_path=pg_catalog, public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]},{"signature":"public.is_current_user_admin()","meta":["581f1801056e5aee65c0144151b41dea41910d2c8e22639873ff659487e8a255","b22b4cf0fc9af5cdf67e880eb404de038dcea9cfa9220e11541da17e45720899","postgres","{anon=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres}",["search_path=public"],"s",true,false,false,false,"plpgsql","","","boolean","u","f"]}]'::jsonb,
 (SELECT jsonb_object_agg(p.oid::regprocedure::text,hotels_published_architecture_private.metadata(p.oid))
  FROM pg_proc p WHERE p.pronamespace='hotels_published_architecture_private'::regnamespace),hotels_published_architecture_private.relation_catalog(),(SELECT jsonb_object_agg(value,hotels_published_architecture_private.metadata(to_regprocedure(value))) FROM jsonb_array_elements_text('["public.hotel_v2_admin_get_published_architecture_conversion_114489(uuid)","public.hotel_v2_admin_convert_legacy_hotel_to_v2_114489(jsonb,uuid,text)","public.hotel_v2_admin_apply_property_control_plan_114489(jsonb,uuid)","public.hotel_v2_admin_apply_partner_property_proposal_plan_114489(jsonb,uuid)","public.hotel_v2_partner_get_workspace_114489(uuid,uuid,date,date)","public.hotel_v2_public_get_seven_arches_display_114489()"]'::jsonb));
SELECT hotels_published_architecture_private.assert_exact();
COMMIT;
