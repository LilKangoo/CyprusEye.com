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
