BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL search_path=pg_catalog,public;
-- Before history repair. One result set: 9 rows; no mutation or impersonation.
WITH state AS MATERIALIZED (
 SELECT hotels_shadow_successor_private.state('9b6d99a0-923a-4fbc-be54-c066e856e6ca') value
), checks(ordinal,check_name,pass) AS MATERIALIZED (VALUES
 (1,'transaction_read_only',current_setting('transaction_read_only')='on'),
 (2,'114481_recorded',EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448100')),
 (3,'114482_unrecorded',NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448200')),
 (4,'completed_no_mutation',(SELECT value->>'status'='SUCCESSOR_ALREADY_COMPLETE' AND value->'mutation_allowed'='false'::jsonb FROM state)),
 (5,'flags_unchanged',(SELECT value->'feature_flags'='{"hotel_rooms_v2_enabled":false,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false}'::jsonb AND value->'public_booking_enabled'='false'::jsonb FROM state)),
 (6,'all_preexisting_business_rows_unchanged',hotels_stripe_dto_private.business_hash()=(SELECT business_hash FROM hotels_shadow_successor_private.certificate WHERE id=1)),
 (7,'receipt_chain_payment_safe',public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() IS TRUE AND public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE),
 (8,'old_preparer_untouched',(SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex')='31383ecd2bd2525f5725b0c629e187f8db54515cc007649173cdbf1d24b9b74a' FROM pg_proc WHERE oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure))
)
SELECT ordinal,check_name,pass IS TRUE pass FROM checks
UNION ALL SELECT 9,'HOTELS_114482_POSTINSTALL_OK',bool_and(pass IS TRUE) FROM checks ORDER BY ordinal;
ROLLBACK;
