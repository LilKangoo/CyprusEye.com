-- AUTHENTIC FUNCTION SOURCE TEST / NOT CERTIFIED DATABASE INTEGRATION.
-- Function bodies are EXACT current production pg_proc.prosrc as verified by SHA256.
-- Only these two functions are authentic; all schema/catalog/data/quote_core are synthetic.
-- Never execute this file against a real project or production database.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- confirm_core SHA256(pg_proc.prosrc)=0821a063e122cf068546e6e0b092531d94721897cf3e9abbb30602b82bb1ecba
CREATE OR REPLACE FUNCTION hotels_public_booking_114494_private.confirm_core(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog' AS $authentic_hotels_114494_confirm_core$
DECLARE o hotels_public_booking_114494_private.orders%rowtype; q hotels_public_booking_114494_private.quotes%rowtype;
 fresh jsonb; a jsonb; item jsonb; d date; allocation_id uuid; updated timestamptz;
BEGIN
 SELECT * INTO STRICT o FROM hotels_public_booking_114494_private.orders WHERE id=p_id FOR UPDATE;
 SELECT * INTO STRICT q FROM hotels_public_booking_114494_private.quotes WHERE id=p_id;
 IF o.status='confirmed' THEN RETURN; END IF;
 IF o.status NOT IN('payment_pending','request_pending') THEN RAISE EXCEPTION 'hotels_114494_terminal_order'; END IF;
 a:=q.authority;
 PERFORM hotels_public_booking_114494_private.lock_inventory(a->'allocation',(a->>'arrival_date')::date,(a->>'departure_date')::date);
 fresh:=hotels_public_booking_114494_private.quote_core(q.request,p_id);
 IF (fresh-ARRAY['available','mode','calendar_ready','due_now','due_to_partner','account_id']) IS DISTINCT FROM
    (a-ARRAY['available','mode','calendar_ready','due_now','due_to_partner','account_id'])
 OR fresh->'available' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'hotels_114494_final_revalidation'; END IF;
 IF o.mode<>'A' AND (o.paid_at IS NULL OR NOT EXISTS(SELECT 1 FROM public.hotel_inventory_holds WHERE id=o.hold_id
    AND status='active' AND expires_at>o.paid_at) OR fresh->>'mode' IS DISTINCT FROM o.mode
    OR fresh->>'account_id' IS DISTINCT FROM o.account_id) THEN RAISE EXCEPTION 'hotels_114494_hold_or_mode_changed'; END IF;
 -- Paid inventory is promoted atomically into nonexpiring real allocations.
 IF o.hold_id IS NOT NULL THEN PERFORM hotels_public_booking_114494_private.release_hold(o.hold_id,'consumed'); END IF;
 UPDATE public.hotel_bookings SET status='confirmed',confirmed_at=clock_timestamp() WHERE id=o.booking_id RETURNING updated_at INTO STRICT updated;
 FOR item IN SELECT value FROM jsonb_array_elements(a->'allocation') LOOP
  allocation_id:=gen_random_uuid();
  INSERT INTO public.hotel_booking_room_allocations(id,booking_id,hotel_id,room_type_id,rate_plan_id,room_rate_id,
   units_required,allocated_guest_counts,pricing_guest_counts,booking_updated_at,actor_id,correlation_id)
  VALUES(allocation_id,o.booking_id,(a->>'hotel_id')::uuid,(item->>'room_type_id')::uuid,(item->>'rate_plan_id')::uuid,
   (item->>'room_rate_id')::uuid,(item->>'units')::integer,ARRAY[(item->>'allocated_guests')::smallint],
   ARRAY[(item->>'pricing_guests')::smallint],updated,o.actor_id,p_id);
  FOR d IN SELECT day::date FROM generate_series((a->>'arrival_date')::date,(a->>'departure_date')::date-1,interval '1 day') day LOOP
   INSERT INTO public.hotel_inventory_commitments(hotel_id,room_type_id,stay_date,booking_allocation_id,units)
   VALUES((a->>'hotel_id')::uuid,(item->>'room_type_id')::uuid,d,allocation_id,(item->>'units')::integer);
  END LOOP;
 END LOOP;
 UPDATE hotels_public_booking_114494_private.orders SET status='confirmed',confirmed_at=clock_timestamp() WHERE id=p_id;
 -- Flush real deferred topology checks while payment_core can still catch
 -- promotion failure and persist compensation. Do not defer them to COMMIT.
 SET CONSTRAINTS public.hotel_booking_room_allocations_admin_d_topology,
  public.hotel_inventory_holds_admin_d_topology,
  public.hotel_inventory_commitments_admin_d_allocation_topology,
  public.hotel_inventory_commitments_admin_d_hold_topology IMMEDIATE;
END $authentic_hotels_114494_confirm_core$;

-- lock_inventory SHA256(pg_proc.prosrc)=d790b081c5b0d2bafe2d2b99c8362ab6cea63329cfd1cc4a52739e3fe9127379
CREATE OR REPLACE FUNCTION hotels_public_booking_114494_private.lock_inventory(p_allocation jsonb, p_from date, p_until date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog' AS $authentic_hotels_114494_lock_inventory$
DECLARE r record;
BEGIN
 -- Stable calendar/config universe; no network operation under these locks.
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'hotels_114494_inventory_requires_read_committed'; END IF;
 LOCK TABLE public.hotel_calendar_source_configs,
  hotels_v2_private.hotel_external_calendar_source_secrets,
  hotels_v2_private.hotel_external_calendar_source_state,
  hotels_v2_private.hotel_external_calendar_sync_runs,
  hotels_v2_private.hotel_external_calendar_day_blocks,
  public.hotels,public.hotel_room_types,public.hotel_rate_plans,public.hotel_room_rates,
  public.hotel_room_allocation_rules,public.hotel_room_allocation_rule_items,
  public.hotel_pricing_schedules,public.hotel_pricing_schedule_occupancy_tiers,
  public.hotel_room_rate_occupancy_tiers,public.hotel_commission_policies,
  public.hotel_daily_inventory,public.hotel_calendar_overrides,public.hotel_rate_rules,public.hotel_daily_rates,
  public.hotel_property_operational_profiles,public.hotel_property_pricing_defaults,
  hotel_stripe_connect_private.accounts,
  hotels_public_booking_114494_private.coverage,
  hotels_public_booking_114494_private.account_readiness IN SHARE MODE;
 FOR r IN SELECT DISTINCT x.value->>'room_type_id' AS room,day::date AS stay_day
  FROM jsonb_array_elements(p_allocation) x(value)
  CROSS JOIN generate_series(p_from,p_until-1,interval '1 day') day ORDER BY 1,2 LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(r.room||':'||r.stay_day::text,0));
 END LOOP;
END $authentic_hotels_114494_lock_inventory$;

DO $source_pins$
BEGIN
  IF encode(digest(convert_to((SELECT prosrc FROM pg_proc WHERE oid=to_regprocedure('hotels_public_booking_114494_private.confirm_core(uuid)')),'UTF8'),'sha256'),'hex')<>'0821a063e122cf068546e6e0b092531d94721897cf3e9abbb30602b82bb1ecba' THEN
    RAISE EXCEPTION 'AUTHENTIC_114494_SOURCE_MISMATCH_confirm_core';
  END IF;
  IF encode(digest(convert_to((SELECT prosrc FROM pg_proc WHERE oid=to_regprocedure('hotels_public_booking_114494_private.lock_inventory(jsonb,date,date)')),'UTF8'),'sha256'),'hex')<>'d790b081c5b0d2bafe2d2b99c8362ab6cea63329cfd1cc4a52739e3fe9127379' THEN
    RAISE EXCEPTION 'AUTHENTIC_114494_SOURCE_MISMATCH_lock_inventory';
  END IF;
END $source_pins$;
