\set ON_ERROR_STOP on
-- Disposable database ONLY. Run after synthetic 114494 bootstrap and exact 114497 migration.
-- Supporting schema, quote availability and constraints are SIMULATED.
-- The separately included confirm_core and lock_inventory are authentic, SHA-pinned.
BEGIN;
SET LOCAL statement_timeout='30s';

ALTER TABLE public.hotel_bookings ADD COLUMN confirmed_at timestamptz;
ALTER TABLE public.hotel_bookings ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp();

ALTER TABLE hotels_public_booking_114494_private.orders ADD COLUMN hold_id uuid;
ALTER TABLE hotels_public_booking_114494_private.orders ADD COLUMN paid_at timestamptz;
ALTER TABLE hotels_public_booking_114494_private.orders ADD COLUMN actor_id uuid
  DEFAULT '30000000-0000-4000-8000-000000000001'::uuid;
ALTER TABLE hotels_public_booking_114494_private.orders ADD COLUMN account_id text;
ALTER TABLE hotels_public_booking_114494_private.orders ADD COLUMN confirmed_at timestamptz;
ALTER TABLE hotels_public_booking_114494_private.orders ADD COLUMN checkout_url text;

CREATE TABLE public.hotel_inventory_holds(
 id uuid PRIMARY KEY,hotel_id uuid,status text DEFAULT 'active',expires_at timestamptz
);
ALTER TABLE public.hotel_inventory_holds ADD CONSTRAINT hotel_inventory_holds_admin_d_topology
 UNIQUE(id,hotel_id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.hotel_booking_room_allocations(
 id uuid PRIMARY KEY,booking_id uuid NOT NULL,hotel_id uuid NOT NULL,
 room_type_id uuid NOT NULL,rate_plan_id uuid NOT NULL,room_rate_id uuid NOT NULL,
 units_required integer NOT NULL,allocated_guest_counts smallint[] NOT NULL,
 pricing_guest_counts smallint[] NOT NULL,booking_updated_at timestamptz NOT NULL,
 actor_id uuid NOT NULL,correlation_id uuid NOT NULL
);
ALTER TABLE public.hotel_booking_room_allocations ADD CONSTRAINT hotel_booking_room_allocations_admin_d_topology
 UNIQUE(booking_id,room_type_id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.hotel_inventory_commitments(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 hotel_id uuid NOT NULL,room_type_id uuid NOT NULL,
 stay_date date NOT NULL,booking_allocation_id uuid NOT NULL,units integer NOT NULL
);
ALTER TABLE public.hotel_inventory_commitments ADD CONSTRAINT hotel_inventory_commitments_admin_d_allocation_topology
 UNIQUE(hotel_id,room_type_id,stay_date) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.hotel_inventory_commitments ADD CONSTRAINT hotel_inventory_commitments_admin_d_hold_topology
 UNIQUE(hotel_id,room_type_id,stay_date,units) DEFERRABLE INITIALLY DEFERRED;

CREATE SCHEMA hotels_v2_private;
CREATE SCHEMA hotel_stripe_connect_private;

-- Empty structures only, required for authentic lock_inventory's table lock list.
CREATE TABLE public.hotel_calendar_source_configs(id uuid);
CREATE TABLE hotels_v2_private.hotel_external_calendar_source_secrets(id uuid);
CREATE TABLE hotels_v2_private.hotel_external_calendar_source_state(id uuid);
CREATE TABLE hotels_v2_private.hotel_external_calendar_sync_runs(id uuid);
CREATE TABLE hotels_v2_private.hotel_external_calendar_day_blocks(id uuid);
CREATE TABLE public.hotel_rate_plans(id uuid);
CREATE TABLE public.hotel_room_rates(id uuid);
CREATE TABLE public.hotel_room_allocation_rule_items(id uuid);
CREATE TABLE public.hotel_pricing_schedules(id uuid);
CREATE TABLE public.hotel_pricing_schedule_occupancy_tiers(id uuid);
CREATE TABLE public.hotel_room_rate_occupancy_tiers(id uuid);
CREATE TABLE public.hotel_commission_policies(id uuid);
CREATE TABLE public.hotel_daily_inventory(id uuid);
CREATE TABLE public.hotel_calendar_overrides(id uuid);
CREATE TABLE public.hotel_rate_rules(id uuid);
CREATE TABLE public.hotel_daily_rates(id uuid);
CREATE TABLE public.hotel_property_operational_profiles(id uuid);
CREATE TABLE public.hotel_property_pricing_defaults(id uuid);
CREATE TABLE hotel_stripe_connect_private.accounts(id uuid);
CREATE TABLE hotels_public_booking_114494_private.coverage(id uuid);
CREATE TABLE hotels_public_booking_114494_private.account_readiness(id uuid);

-- Synthetic pricing shape updated to include all values used by REAL confirm_core.
CREATE OR REPLACE FUNCTION hotels_public_booking_114494_private.quote_core(p jsonb)
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
    'rate_plan_id','55555555-5555-4555-8555-555555555555',
    'room_rate_id','66666666-6666-4666-8666-666666666666',
    'allocated_guests',2,'pricing_guests',2,'units',1)),
 'base_total',200,'extras_total',0);
$f$;

-- This overload is SYNTHETIC: it models availability from committed nights.
-- It is NOT the real 114494 quote_core and is explicitly outside real-certification.
CREATE FUNCTION hotels_public_booking_114494_private.quote_core(p jsonb,p_own_order uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' AS $f$
 WITH authority AS (
  SELECT hotels_public_booking_114494_private.quote_core(p) AS value
 )
 SELECT value || jsonb_build_object('available',
   value->'available'='true'::jsonb
   AND NOT EXISTS (
     SELECT 1 FROM public.hotel_inventory_commitments c
     CROSS JOIN jsonb_array_elements(value->'allocation') a
     WHERE c.room_type_id=(a->>'room_type_id')::uuid
       AND c.hotel_id=(value->>'hotel_id')::uuid
       AND c.stay_date>= (value->>'arrival_date')::date
       AND c.stay_date< (value->>'departure_date')::date
   ))
 FROM authority;
$f$;

-- Synthetic requests quote the SAME room and nights and are both initially pending.
-- All customer identities are invented; no production data is present.
UPDATE hotels_public_booking_114497_private.request_mode_gate
 SET request_mode_enabled=true;

DO $seed$
DECLARE i integer; oid uuid; bid uuid; req jsonb;
BEGIN
 req:=jsonb_build_object(
  'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'arrival_date','2027-04-10','departure_date','2027-04-12',
  'adults',2,'child_ages','[]'::jsonb,
  'room_type_id','11111111-1111-4111-8111-111111111111',
  'selected_extra_ids','[]'::jsonb
 );
 FOR i IN 1..2 LOOP
   oid:=CASE WHEN i=1 THEN '91111111-1111-4111-8111-111111111111'::uuid
     ELSE '92222222-2222-4222-8222-222222222222'::uuid END;
   bid:=CASE WHEN i=1 THEN '93333333-3333-4333-8333-333333333333'::uuid
     ELSE '94444444-4444-4444-8444-444444444444'::uuid END;
   INSERT INTO hotels_public_booking_114494_private.quotes(id,request,authority,token)
   VALUES(oid,req,hotels_public_booking_114494_private.quote_core(req),repeat('a',64));
   INSERT INTO hotels_public_booking_114494_private.orders(id,booking_id,mode,status,actor_id)
   VALUES(oid,bid,'A','request_pending','30000000-0000-4000-8000-000000000001');
   INSERT INTO public.hotel_bookings
    (id,hotel_id,arrival_date,departure_date,customer_name,customer_email,total_price,status)
   VALUES(bid,'9b6d99a0-923a-4fbc-be54-c066e856e6ca',
       '2027-04-10','2027-04-12','Synthetic Guest',
       'fixture@example.invalid',200,'pending');
 END LOOP;
END $seed$;

COMMIT;
\echo AUTHENTIC_CONFIRM_SCHEMA_SIMULATED=PASS
\echo TWO_PENDING_SAME_ROOM=PASS
