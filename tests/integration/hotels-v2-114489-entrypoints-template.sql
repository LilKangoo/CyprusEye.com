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
