\set ON_ERROR_STOP on
-- This disposable fixture is SYNTHETIC. Older 114493/114494 business logic
-- is only represented by minimal signatures and deliberately simplified data.
-- It verifies migration DDL, wrapper routing and SQL ACLs, NOT real inventory.
BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $f$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$f$;
GRANT USAGE ON SCHEMA auth TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;

CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY);
INSERT INTO supabase_migrations.schema_migrations VALUES('20260811449400');

CREATE SCHEMA hotels_post_114493_private;
CREATE FUNCTION hotels_post_114493_private.catalog_epoch_is_exact_114493() RETURNS boolean
LANGUAGE sql AS $$ SELECT true; $$;
CREATE FUNCTION hotels_post_114493_private.pricing_activation_current_is_safe_114493() RETURNS boolean
LANGUAGE sql AS $$ SELECT true; $$;
CREATE FUNCTION hotels_post_114493_private.reviewed_pricing_receipt_chain_is_exact_114493() RETURNS boolean
LANGUAGE sql AS $$ SELECT true; $$;
CREATE FUNCTION public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() RETURNS boolean
LANGUAGE sql AS $$ SELECT true; $$;
CREATE FUNCTION public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() RETURNS boolean
LANGUAGE sql AS $$ SELECT true; $$;

CREATE TABLE public.hotels(
 id uuid PRIMARY KEY, architecture_version text,is_published boolean,
 minimum_stay_nights integer,currency text,children_policy text,
 minimum_child_age integer,pricing_extras jsonb
);
INSERT INTO public.hotels VALUES
('9b6d99a0-923a-4fbc-be54-c066e856e6ca','rooms_v2',true,2,'EUR',
'minimum_age',15,'{"items":[]}');

CREATE TABLE public.hotel_room_types(
 id uuid PRIMARY KEY,hotel_id uuid,code text,name_i18n jsonb,
 max_occupancy integer,children_policy_override text,
 minimum_child_age_override integer,status text
);
INSERT INTO public.hotel_room_types VALUES
('11111111-1111-4111-8111-111111111111',
 '9b6d99a0-923a-4fbc-be54-c066e856e6ca','ground-floor-apartment',
 '{"en":"Ground Floor","pl":"Parter","he":"קומת קרקע"}',4,null,null,'active'),
('22222222-2222-4222-8222-222222222222',
 '9b6d99a0-923a-4fbc-be54-c066e856e6ca','upper-floor-apartment',
 '{"en":"Upper Floor","pl":"Piętro","he":"קומה עליונה"}',4,null,null,'active');
CREATE TABLE public.hotel_room_allocation_rules(
 hotel_id uuid,is_active boolean,review_status text,
 min_guest_count integer,max_guest_count integer,allocation_mode text
);
INSERT INTO public.hotel_room_allocation_rules VALUES
('9b6d99a0-923a-4fbc-be54-c066e856e6ca',true,'reviewed',1,4,'customer_choice'),
('9b6d99a0-923a-4fbc-be54-c066e856e6ca',true,'reviewed',5,8,'required_bundle');

CREATE TABLE public.partner_resources(
 id uuid PRIMARY KEY,partner_id uuid,resource_type text,resource_id uuid
);
CREATE TABLE public.hotel_partner_hotel_permissions(
 assignment_id uuid,partner_id uuid,hotel_id uuid,
 has_mutation_capability boolean,process_bookings boolean
);
INSERT INTO public.partner_resources VALUES
('a082c085-a6ea-46fd-8548-c8d9c6ee2c34',
 '40000000-0000-4000-8000-000000000001','hotels',
 '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
INSERT INTO public.hotel_partner_hotel_permissions VALUES
('a082c085-a6ea-46fd-8548-c8d9c6ee2c34',
 '40000000-0000-4000-8000-000000000001',
 '9b6d99a0-923a-4fbc-be54-c066e856e6ca',true,true);
CREATE FUNCTION public.hotel_v2_h3_2a_require_partner_membership(p_partner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $f$
BEGIN
 IF auth.uid() IS DISTINCT FROM '30000000-0000-4000-8000-000000000001'::uuid
    OR p_partner_id IS DISTINCT FROM '40000000-0000-4000-8000-000000000001'::uuid THEN
   RAISE EXCEPTION USING errcode='42501',message='synthetic_membership_denied';
 END IF;
END $f$;
REVOKE ALL ON FUNCTION public.hotel_v2_h3_2a_require_partner_membership(uuid)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.hotel_bookings(
 id uuid PRIMARY KEY,hotel_id uuid,arrival_date date,departure_date date,
 customer_name text,customer_email text,total_price numeric,status text
);

CREATE SCHEMA hotels_public_booking_114494_private;
CREATE TABLE hotels_public_booking_114494_private.global_flag(enabled boolean);
INSERT INTO hotels_public_booking_114494_private.global_flag VALUES(false);
CREATE FUNCTION hotels_public_booking_114494_private.public_booking_state()
RETURNS boolean LANGUAGE sql STABLE AS $f$
 SELECT enabled FROM hotels_public_booking_114494_private.global_flag LIMIT 1;
$f$;
CREATE FUNCTION hotels_public_booking_114494_private.require_safety()
RETURNS void LANGUAGE plpgsql AS $f$ BEGIN NULL; END $f$;
CREATE TABLE hotels_public_booking_114494_private.quotes(
 id uuid PRIMARY KEY,request jsonb,authority jsonb,token text
);
CREATE TABLE hotels_public_booking_114494_private.orders(
 id uuid PRIMARY KEY,booking_id uuid,mode text,status text
);

-- Minimal, deliberately fake 114494 pricing logic for this DDL contract test.
CREATE FUNCTION hotels_public_booking_114494_private.quote_core(p jsonb)
RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object(
 'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
 'partner_id','40000000-0000-4000-8000-000000000001',
 'mode',coalesce(p->>'force_mode','A'),
 'available',coalesce((p->>'available')::boolean,true),
 'currency','EUR','gross',200,'due_now',0,
 'arrival_date',coalesce(p->>'arrival_date','2027-04-10'),
 'departure_date',coalesce(p->>'departure_date','2027-04-12'),
 'allocation',jsonb_build_array(jsonb_build_object(
    'room_type_id','11111111-1111-4111-8111-111111111111',
    'allocated_guests',2)),
 'base_total',200,'extras_total',0);
$f$;

CREATE FUNCTION hotels_public_booking_114494_private.public_quote(p jsonb)
RETURNS jsonb LANGUAGE sql AS $f$ SELECT p; $f$;

CREATE FUNCTION hotels_public_booking_114494_private.issue_quote(p jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE v_id uuid:=gen_random_uuid();v_authority jsonb;
BEGIN
 v_authority:=hotels_public_booking_114494_private.quote_core(p);
 INSERT INTO hotels_public_booking_114494_private.quotes(id,request,authority,token)
 VALUES(v_id,p,v_authority,repeat('a',64));
 RETURN jsonb_build_object('quote_id',v_id,'lookup_token',repeat('a',64),
  'quote',v_authority);
END $f$;

CREATE FUNCTION hotels_public_booking_114494_private.require_quote(p_id uuid,p_token text)
RETURNS hotels_public_booking_114494_private.quotes
LANGUAGE plpgsql AS $f$
DECLARE q hotels_public_booking_114494_private.quotes%rowtype;
BEGIN
 SELECT * INTO STRICT q FROM hotels_public_booking_114494_private.quotes
 WHERE id=p_id AND token=p_token;
 RETURN q;
END $f$;

CREATE FUNCTION hotels_public_booking_114494_private.status_core(p_id uuid)
RETURNS jsonb LANGUAGE sql AS $f$
 SELECT jsonb_build_object('order_id',o.id,'mode',o.mode,
 'status',o.status,'payment_required',o.mode<>'A')
 FROM hotels_public_booking_114494_private.orders o WHERE o.id=p_id;
$f$;

CREATE FUNCTION hotels_public_booking_114494_private.begin_core(
 p_id uuid,p_token text,p_customer jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE q hotels_public_booking_114494_private.quotes%rowtype;
v_bid uuid:=gen_random_uuid();
BEGIN
 q:=hotels_public_booking_114494_private.require_quote(p_id,p_token);
 IF NOT EXISTS(SELECT 1 FROM hotels_public_booking_114494_private.orders WHERE id=p_id) THEN
  INSERT INTO hotels_public_booking_114494_private.orders
  VALUES(p_id,v_bid,q.authority->>'mode',
    CASE WHEN q.authority->>'mode'='A' THEN 'request_pending' ELSE 'payment_pending' END);
  INSERT INTO public.hotel_bookings VALUES
  (v_bid,'9b6d99a0-923a-4fbc-be54-c066e856e6ca','Synthetic Guest',
  'synthetic@example.invalid','2027-04-10','2027-04-12',200,'pending');
 END IF;
 RETURN hotels_public_booking_114494_private.status_core(p_id);
END $f$;

CREATE FUNCTION hotels_public_booking_114494_private.confirm_core(p_order_id uuid)
RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
 UPDATE hotels_public_booking_114494_private.orders
 SET status='confirmed' WHERE id=p_order_id AND mode='A';
 UPDATE public.hotel_bookings b SET status='confirmed'
 FROM hotels_public_booking_114494_private.orders o
 WHERE o.id=p_order_id AND o.booking_id=b.id AND o.mode='A';
END $f$;

COMMIT;
\echo SYNTHETIC_BOOTSTRAP=PASS
