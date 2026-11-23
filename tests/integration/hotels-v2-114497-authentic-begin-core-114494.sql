-- SYNTHETIC DATABASE ONLY. Exact source of production 114494 begin_core, SHA pinned.
-- Does not prove real production triggers or quote_core; those are simulated.
CREATE OR REPLACE FUNCTION hotels_public_booking_114494_private.begin_core(p_id uuid, p_token text, p_customer jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $authentic_hotels_114494_begin_core$
DECLARE q hotels_public_booking_114494_private.quotes%rowtype; a jsonb; fresh jsonb;
 bid uuid:=gen_random_uuid(); hid uuid; created timestamptz; expires timestamptz; item jsonb; d date;
 existing hotels_public_booking_114494_private.orders%rowtype; customer_hash text;
BEGIN
 q:=hotels_public_booking_114494_private.require_quote(p_id,p_token);
 IF p_customer IS NULL OR jsonb_typeof(p_customer)<>'object'
 OR NOT(p_customer?&ARRAY['name','email','lang'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_customer) k WHERE k NOT IN('name','email','lang'))
 OR jsonb_typeof(p_customer->'name')<>'string' OR length(btrim(p_customer->>'name')) NOT BETWEEN 1 AND 160
 OR jsonb_typeof(p_customer->'email')<>'string' OR length(p_customer->>'email')>254
 OR p_customer->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 OR p_customer->>'lang' NOT IN('pl','en','he') THEN RAISE EXCEPTION 'hotels_114494_invalid_customer'; END IF;
 customer_hash:=hotels_public_booking_114494_private.digest(p_customer);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,114494));
 SELECT * INTO existing FROM hotels_public_booking_114494_private.orders WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF existing.customer_hash<>customer_hash THEN RAISE EXCEPTION 'hotels_114494_idempotency_conflict'; END IF;
  RETURN hotels_public_booking_114494_private.status_core(p_id);
 END IF;
 IF q.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'hotels_114494_stale_quote'; END IF;
 a:=q.authority;
 PERFORM hotels_public_booking_114494_private.lock_inventory(a->'allocation',(a->>'arrival_date')::date,(a->>'departure_date')::date);
 fresh:=hotels_public_booking_114494_private.quote_core(q.request);
 IF fresh IS DISTINCT FROM a THEN RAISE EXCEPTION 'hotels_114494_stale_quote'; END IF;
 IF a->>'mode'<>'A' AND a->'available' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'hotels_114494_unavailable'; END IF;
 created:=clock_timestamp();expires:=created+interval '15 minutes';
 IF a->>'mode'<>'A' THEN
  hid:=gen_random_uuid();
  INSERT INTO public.hotel_inventory_holds(id,hotel_id,expires_at,configuration_fingerprint,created_at,updated_at)
  VALUES(hid,(a->>'hotel_id')::uuid,expires,hotels_public_booking_114494_private.digest(a),created,created);
  FOR item IN SELECT value FROM jsonb_array_elements(a->'allocation') LOOP
   FOR d IN SELECT day::date FROM generate_series((a->>'arrival_date')::date,(a->>'departure_date')::date-1,interval '1 day') day LOOP
    INSERT INTO public.hotel_inventory_commitments(hotel_id,room_type_id,stay_date,hold_id,units,expires_at)
    VALUES((a->>'hotel_id')::uuid,(item->>'room_type_id')::uuid,d,hid,(item->>'units')::integer,expires);
   END LOOP;
  END LOOP;
 END IF;
 INSERT INTO hotels_public_booking_114494_private.orders(id,booking_id,mode,hold_id,status,actor_id,customer_hash,account_id)
 VALUES(p_id,bid,a->>'mode',hid,CASE WHEN a->>'mode'='A' THEN 'request_pending' ELSE 'payment_pending' END,
  coalesce(auth.uid(),p_id),customer_hash,a->>'account_id');
 INSERT INTO public.hotel_seven_arches_public_booking_transaction_context
  (backend_pid,transaction_id,booking_id,hotel_id,quote_fingerprint,authority_token,actor_id)
 VALUES(pg_backend_pid(),txid_current(),bid,(a->>'hotel_id')::uuid,hotels_public_booking_114494_private.digest(a),
  hotels_public_booking_114494_private.digest(a),auth.uid());
 INSERT INTO public.hotel_bookings(id,hotel_id,customer_name,customer_email,arrival_date,departure_date,num_adults,num_children,
  nights,base_price,extras_price,final_price,total_price,status,lang,selected_extras,pricing_breakdown,booking_details,
  pricing_quote_fingerprint,pricing_authority_token,pricing_quote_expires_at,pricing_allocation)
 VALUES(bid,(a->>'hotel_id')::uuid,p_customer->>'name',p_customer->>'email',(a->>'arrival_date')::date,(a->>'departure_date')::date,
  (a->>'adults')::integer,jsonb_array_length(a->'child_ages'),(a->>'departure_date')::date-(a->>'arrival_date')::date,
  (a->>'base_total')::numeric,(a->>'extras_total')::numeric,(a->>'gross')::numeric,(a->>'gross')::numeric,'pending',p_customer->>'lang',
  a->'extras',jsonb_build_object('contract','114494','allocation',a->'allocation'),jsonb_build_object('contract','114494','mode',a->>'mode'),
  hotels_public_booking_114494_private.digest(a),hotels_public_booking_114494_private.digest(a),q.expires_at,a->'allocation');
 IF a->>'mode'<>'A' THEN PERFORM hotels_public_booking_114494_private.enqueue(p_id,'checkout'); END IF;
 RETURN hotels_public_booking_114494_private.status_core(p_id);
END $authentic_hotels_114494_begin_core$;

DO $verify_begin$
BEGIN
  IF encode(digest(convert_to((SELECT prosrc FROM pg_proc WHERE oid=to_regprocedure('hotels_public_booking_114494_private.begin_core(uuid,text,jsonb)')),'UTF8'),'sha256'),'hex')
    <> 'e1d3f65d15188cc2c2cfa70285413263ca9d20ee05cf189cd21650d8d235925b' THEN RAISE EXCEPTION 'AUTHENTIC_114494_BEGIN_SHA_MISMATCH'; END IF;
END $verify_begin$;
