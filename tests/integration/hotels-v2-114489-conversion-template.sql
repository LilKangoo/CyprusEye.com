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
