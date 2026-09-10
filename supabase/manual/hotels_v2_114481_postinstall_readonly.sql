BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,public;
-- 114481 postinstall: 23 rows, one result set. No timeout override or write lock.
-- Source/security pins prove the same DTO and scoping bodies exercised by local
-- role/foreign-Partner tests; this gate does NOT impersonate any production user.
-- Lifecycle, pricing and permission reads are suppressed if source pins differ.
WITH expected(signature,source_hash,metadata) AS (VALUES
 ('hotels_lineage_private.predecessor(oid)','f7371ac466fa1b3b95480d13e2447cd1817ae8a7bd76c439dd8673795d1f764c','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_stripe_dto_private.assert_exact()','cca811474be9abaaeb966273073c81df4377f245b9a8702c3342f638bef9bccf','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_stripe_dto_private.business_hash()','3a236f4c31c6ecdce9b172330f86d2681f2eb0eaa2f63b2bab09203d39206ef8','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_stripe_dto_private.helper_catalog()','1762100fee5e72a4a349d8789adac731880eec19c0592316bd597f56e7256e20','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_lifecycle_private.catalog_snapshot()','a9daaad29c3561c8191707fcef258d3fb734705058c4b15ec857ef2e554f5aa7','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_stripe_dto_private.relation_catalog()','d7955b8131b837f37fece6afa3dc8e9e8b2a91aed90f787b1e4e10db2fed1b44','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"sql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_lifecycle_private.predecessor_source(oid)','983d1c22792ce60fcd73e71d1e5f3bfe6869f3b2ba734e92a4364f924741819f','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":true,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_lineage_private.successors_are_exact(text)','fcf5478ea42f47e6aa45ef2d7aa1a94828a92b3ba763e784b95efbba34fe4139','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_stripe_dto_private.predecessor_source(oid)','00f2c5353e95fb8f6f2ea54bff7233223524f3deb8b01e34a022f6cdd174e3aa','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":true,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_stripe_dto_private.predecessor_definition(oid)','b984e232655a089475b6c223f729d21561a78e1cdf1b3ec5783aacfdddf23d71','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public"],"strict":true,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('hotels_lifecycle_private.partner_connection(uuid,uuid)','f46e6a3fb6e534739c91a61abeec102c32b67500b7d597d954ea01e57a3dedbc','{"acl":[["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb),
 ('public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)','0515e9b4ce45815ab3d55585d47c1027f914e4b8b48dcda760386147f53e6fdd','{"acl":[["authenticated","EXECUTE",false],["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"s","returns_set":false,"security_definer":true}'::jsonb)
), function_checks AS MATERIALIZED (
 SELECT signature,coalesce(p.oid IS NOT NULL AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.source_hash
 AND hotels_lifecycle_private.metadata(p.oid)=e.metadata,false) pass
 FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
), leaves AS MATERIALIZED (
 SELECT row_number() OVER(ORDER BY signature)::integer ordinal,signature check_name,pass FROM function_checks
 UNION ALL
 SELECT * FROM (VALUES
 (13,'read_only',(current_setting('transaction_read_only')='on') IS TRUE),
 (14,'114480_recorded',(EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448000')) IS TRUE),
 (15,'114481_and_later_unrecorded',(NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448000')) IS TRUE),
 (16,'successor_schema',(to_regnamespace('hotels_stripe_dto_private') IS NOT NULL) IS TRUE),
 (17,'scoped_pre_activation_state',(CASE WHEN (SELECT bool_and(pass) FROM function_checks) THEN (hotels_lineage_private.current_anchor_is_exact() IS TRUE
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
 AND public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE) ELSE false END) IS TRUE),
 (18,'commission_EUR10_exact',((SELECT count(*)=1 AND bool_and(commission_mode='per_allocated_room_per_night' AND amount=10 AND btrim(currency::text)='EUR') FROM public.hotel_commission_policies WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND is_active AND review_status='reviewed')) IS TRUE),
 (19,'adapter_certificate_exact',(CASE WHEN (SELECT bool_and(pass) FROM function_checks) THEN (SELECT count(*)=1 AND bool_and(helper_catalog=hotels_stripe_dto_private.helper_catalog() AND relation_catalog=hotels_stripe_dto_private.relation_catalog() AND binding_hash=(SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,'UTF8')),'hex') FROM hotels_stripe_dto_private.bindings b)) FROM hotels_stripe_dto_private.certificate) ELSE false END) IS TRUE),
 (20,'pricing_payment_commission_and_receipts_unchanged',(CASE WHEN (SELECT bool_and(pass) FROM function_checks) THEN hotels_stripe_dto_private.business_hash()=(SELECT business_hash FROM hotels_stripe_dto_private.certificate WHERE id=1) ELSE false END) IS TRUE),
 (21,'admin_safe_account_fields',(EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)') AND prosrc LIKE '%''account_exists''%' AND prosrc LIKE '%''account_status''%' AND prosrc NOT LIKE '%account_id%' AND prosrc NOT LIKE '%oauth_states%')) IS TRUE),
 (22,'partner_safe_readiness_fields',(EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('hotels_lifecycle_private.partner_connection(uuid,uuid)') AND prosrc LIKE '%''platform_ready''%' AND prosrc LIKE '%''attestation_status''%' AND prosrc LIKE '%hotel_v2_h3_2a_require_partner_hotel_access%' AND prosrc NOT LIKE '%account_id%')) IS TRUE)
 ) c(ordinal,check_name,pass)
)
SELECT ordinal,check_name,pass FROM leaves
UNION ALL SELECT 23,'HOTELS_114481_POSTINSTALL_READY',bool_and(pass) FROM leaves ORDER BY ordinal;
ROLLBACK;
