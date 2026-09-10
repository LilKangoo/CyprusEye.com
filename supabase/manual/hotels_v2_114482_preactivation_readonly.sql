BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL search_path=pg_catalog,public;
-- One result set: 10 rows. No actor impersonation, mutation or write locks.
WITH checks(ordinal,check_name,pass) AS MATERIALIZED (VALUES
 (1,'transaction_read_only',current_setting('transaction_read_only')='on'),
 (2,'114481_recorded',EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448100')),
 (3,'114482_and_later_unrecorded',NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448100')),
 (4,'successor_not_installed',to_regnamespace('hotels_shadow_successor_private') IS NULL),
 (5,'old_preparer_exact',(SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex')='31383ecd2bd2525f5725b0c629e187f8db54515cc007649173cdbf1d24b9b74a'
  AND hotels_lifecycle_private.metadata(oid)='{"acl":[["authenticated","EXECUTE",false],["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"v","returns_set":false,"security_definer":true}'::jsonb
  FROM pg_proc WHERE oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)),
 (6,'successor_anchor_topology',hotels_lineage_private.current_anchor_is_exact() IS TRUE AND public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() IS TRUE),
 (7,'pricing_receipts_current_safe',public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() IS TRUE AND public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS TRUE),
 (8,'payment_lineage',public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE),
 (9,'current_flags_public_off',hotels_lifecycle_private.safe_state() @> '{"feature_flags":{"hotel_rooms_v2_enabled":false,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false},"public_booking_enabled":false,"architecture":"legacy"}'::jsonb)
)
SELECT ordinal,check_name,pass IS TRUE pass FROM checks
UNION ALL SELECT 10,'HOTELS_114482_PREACTION_READY',bool_and(pass IS TRUE) FROM checks ORDER BY ordinal;
ROLLBACK;
