// Private historical fingerprint projection, never a public/Partner DTO.
export const propertyAwareHistoricalHotelBody=`DECLARE
 r hotels_published_architecture_private.conversion_receipt%rowtype;
 g hotels_guest_policy_private.receipt%rowtype;
 c hotels_published_architecture_private.context%rowtype;
 e record; expected jsonb; actual jsonb:=p_hotel; anchor jsonb;
 content_keys text[]:=ARRAY['title','title_i18n','description','description_i18n','city','address_line','district',
 'postal_code','country','latitude','longitude','google_maps_url','amenities','check_in_from','check_out_until',
 'timezone','cover_image_url','photos','updated_at'];
BEGIN
 IF p_hotel->>'id' IS DISTINCT FROM '9b6d99a0-923a-4fbc-be54-c066e856e6ca' THEN RAISE EXCEPTION 'hotels_114489_projection_foreign_hotel'; END IF;
 PERFORM hotels_published_architecture_private.assert_exact();
 SELECT * INTO c FROM hotels_published_architecture_private.context WHERE transaction_id=txid_current() AND backend_pid=pg_backend_pid();
 IF FOUND THEN
  IF c.actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'hotels_114489_context_actor_drift'; END IF;
  IF c.operation='conversion' THEN
   IF p_hotel-ARRAY['architecture_version','updated_at'] IS DISTINCT FROM c.before_hotel-ARRAY['architecture_version','updated_at']
   OR p_hotel->'is_published' IS DISTINCT FROM 'true'::jsonb
   OR p_hotel->>'architecture_version' NOT IN('legacy','rooms_v2') THEN RAISE EXCEPTION 'hotels_114489_context_drift'; END IF;
  ELSIF c.operation='property' THEN
   IF p_hotel-content_keys IS DISTINCT FROM c.before_hotel-content_keys THEN RAISE EXCEPTION 'hotels_114489_property_protected_drift'; END IF;
  ELSE RAISE EXCEPTION 'hotels_114489_context_operation_invalid'; END IF;
  actual:=c.before_hotel;
 END IF;
 SELECT * INTO r FROM hotels_published_architecture_private.conversion_receipt;
 IF FOUND THEN PERFORM hotels_published_architecture_private.assert_receipt_exact(); END IF;
 PERFORM hotels_guest_policy_private.assert_exact();
 SELECT * INTO STRICT g FROM hotels_guest_policy_private.receipt WHERE id=1;
 anchor:=g.hotel_anchor; expected:=anchor;
 FOR e IN
  SELECT p.created_at,p.id,p.actor_id,p.before_hotel before_state,p.after_hotel after_state,'property' kind
   FROM hotels_published_architecture_private.property_history p
  UNION ALL
  SELECT a.created_at,a.id,a.actor_id,a.before_state,a.after_state,'guest'
   FROM public.hotel_activity_log a WHERE a.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
    AND a.source='hotels_v2_admin_b_guest_policy' AND NOT(a.id=ANY(g.activity_ids))
  UNION ALL
  SELECT r.converted_at,r.id,r.actor_id,r.before_hotel,r.after_hotel,'conversion' WHERE r.id IS NOT NULL
  ORDER BY created_at,id
 LOOP
  IF e.actor_id IS NULL OR e.before_state-ARRAY['updated_at','pricing_tiers'] IS DISTINCT FROM expected-ARRAY['updated_at','pricing_tiers'] THEN
   RAISE EXCEPTION 'hotels_114489_property_history_chain_invalid'; END IF;
  IF e.kind='property' THEN
   IF e.before_state-content_keys IS DISTINCT FROM e.after_state-content_keys
   OR (SELECT count(*) FROM public.hotel_activity_log a WHERE a.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND a.correlation_id=e.id
    AND a.actor_id=e.actor_id AND a.actor_type='admin' AND a.source='hotels_v2_admin_b_property_control'
    AND a.before_state->'property'=e.before_state AND a.after_state->'property'=e.after_state)<>1 THEN
    RAISE EXCEPTION 'hotels_114489_property_audit_invalid'; END IF;
  ELSIF e.kind='conversion' THEN
   IF e.before_state-ARRAY['architecture_version','updated_at'] IS DISTINCT FROM e.after_state-ARRAY['architecture_version','updated_at']
    OR e.before_state->>'architecture_version' IS DISTINCT FROM 'legacy' OR e.after_state->>'architecture_version' IS DISTINCT FROM 'rooms_v2'
    OR e.after_state->'is_published' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'hotels_114489_projection_receipt_drift'; END IF;
  ELSE
   IF e.before_state-ARRAY['updated_at','children_policy','minimum_child_age'] IS DISTINCT FROM e.after_state-ARRAY['updated_at','children_policy','minimum_child_age']
   OR public.hotel_v2_h2b1_children_policy_valid(e.after_state->>'children_policy',(e.after_state->>'minimum_child_age')::integer,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'hotels_114489_guest_policy_audit_invalid'; END IF;
  END IF;
  expected:=e.after_state;
 END LOOP;
 IF actual-ARRAY['updated_at','pricing_tiers'] IS DISTINCT FROM expected-ARRAY['updated_at','pricing_tiers'] THEN
  RAISE EXCEPTION 'hotels_114489_unreviewed_property_change'; END IF;
 -- Only historical hash consumers receive the certified historical content.
 -- Current pricing_tiers remain current; public DTOs read physical rows.
 RETURN anchor||jsonb_build_object('pricing_tiers',p_hotel->'pricing_tiers');
END;`;
