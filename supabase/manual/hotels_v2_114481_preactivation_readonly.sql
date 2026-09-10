BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,public;
-- 114481 preactivation: 12 rows, one result set. No timeout override or write lock.
-- Source/security pins prove the same DTO and scoping bodies exercised by local
-- role/foreign-Partner tests; this gate does NOT impersonate any production user.
-- Lifecycle, pricing and permission reads are suppressed if source pins differ.
WITH expected(signature,source_hash,metadata) AS (VALUES
 ('hotels_lineage_private.predecessor(oid)','36e662d92c41f3b3474f41fc0094c33ba049006769c6403254d0f185a2f1d087','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_lifecycle_private.catalog_snapshot()','ef46235b2ad39502b4d4787b34b817e7dee986a5ea0bd526c76690cb2f6b2a71','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_lifecycle_private.predecessor_source(oid)','e18f68f4948e3030079ae9c765fd27515a234b8d1d18079588a6c2dd32f9a1b5','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":true,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_lineage_private.successors_are_exact(text)','c9b0de4a528547f1555d29e96530c552f8a827c83b50c65985d4dd75e415ce07','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_lifecycle_private.partner_connection(uuid,uuid)','e47e5f9c1101cc829a7b263080b7b2b3d046be4103016d1da3298f0714145793','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)','45dc3a00c73a0f031298523cf41e9ffeac90e1e46c50c532b796a231276de473','{"acl":[["authenticated","EXECUTE",false],["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb)
), function_checks AS MATERIALIZED (
 SELECT signature,coalesce(p.oid IS NOT NULL AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.source_hash
 AND hotels_lifecycle_private.metadata(p.oid)=e.metadata,false) pass
 FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
), leaves AS MATERIALIZED (
 SELECT row_number() OVER(ORDER BY signature)::integer ordinal,signature check_name,pass FROM function_checks
 UNION ALL
 SELECT * FROM (VALUES
 (7,'read_only',(current_setting('transaction_read_only')='on') IS TRUE),
 (8,'114480_recorded',(EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448000')) IS TRUE),
 (9,'114481_and_later_unrecorded',(NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448000')) IS TRUE),
 (10,'successor_schema',(to_regnamespace('hotels_stripe_dto_private') IS NULL) IS TRUE),
 (11,'scoped_pre_activation_state',(CASE WHEN (SELECT bool_and(pass) FROM function_checks) THEN (hotels_lineage_private.current_anchor_is_exact() IS TRUE
 AND hotels_lifecycle_private.safe_state() @> '{"public_booking_enabled":false,"architecture":"legacy","feature_flags":{"hotel_rooms_v2_enabled":false,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false}}'::jsonb
 AND EXISTS(SELECT 1 FROM public.hotel_partner_hotel_permissions p WHERE p.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
 AND p.partner_id=(hotels_lineage_private.permission_evidence()->>'partner_id')::uuid
 AND p.assignment_id=(hotels_lineage_private.permission_evidence()->>'assignment_id')::uuid AND p.version=2)
 AND NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.onboarding_authorizations)
 AND NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.accounts)
 AND NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.oauth_states)
 AND NOT EXISTS(SELECT 1 FROM hotels_lifecycle_private.stripe_readiness)
 AND NOT EXISTS(SELECT 1 FROM hotels_lifecycle_private.context)
 AND NOT EXISTS(SELECT 1 FROM hotels_lifecycle_private.decisions)
 AND public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE) ELSE false END) IS TRUE)
 ) c(ordinal,check_name,pass)
)
SELECT ordinal,check_name,pass FROM leaves
UNION ALL SELECT 12,'HOTELS_114481_PREACTION_READY',bool_and(pass) FROM leaves ORDER BY ordinal;
ROLLBACK;
