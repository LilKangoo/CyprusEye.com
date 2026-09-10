BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
WITH flags AS MATERIALIZED (SELECT hotels_lifecycle_private.safe_state() AS s),
checks AS (
SELECT * FROM (VALUES
(1,'transaction_read_only',current_setting('transaction_read_only')='on'),
(2,'recorded_114484',EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448400')),
(3,'no_later_history',NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448400')),
(4,'frozen_content_source_security',hotels_guest_policy_private.raw_metadata(to_regprocedure('public.hotel_v2_admin_get_content_control(uuid)'))='["e776cb4be19d7cb70ecb8db287c21709d3a87fbc1d9b044fdb62be57d154a83c", "769f5fd9ca10c25769a8af5ccbd7d11f44b76dc38bad0156dbfa9f7e39926784", "postgres", "{authenticated=X/postgres,postgres=X/postgres}", ["search_path=pg_catalog, public, auth"], "s", true, false, false, false, "plpgsql"]'::jsonb),
(5,'current_pricing_safe',public.hotel_v2_seven_arches_pricing_activation_current_is_safe()),
(6,'payment_lineage',public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()),
(7,'audited_flags_public_off',(SELECT s->'feature_flags'='{"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false}'::jsonb AND (s->>'public_booking_enabled')::boolean=false FROM flags)),
(8,'successor_source',(SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex')='352382d0eafe572cb6caac97251c2cb39f076c9b96b96aa2bbc7e0e7496afd15' FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_admin_get_content_control_114485(uuid)'))),
(9,'successor_security',hotels_guest_policy_private.raw_metadata(to_regprocedure('public.hotel_v2_admin_get_content_control_114485(uuid)'))-0-0='["e776cb4be19d7cb70ecb8db287c21709d3a87fbc1d9b044fdb62be57d154a83c", "769f5fd9ca10c25769a8af5ccbd7d11f44b76dc38bad0156dbfa9f7e39926784", "postgres", "{authenticated=X/postgres,postgres=X/postgres}", ["search_path=pg_catalog, public, auth"], "s", true, false, false, false, "plpgsql"]'::jsonb-0-0)
) v(ordinal,predicate,passed))
SELECT ordinal,predicate,coalesce(passed,false) AS passed FROM checks ORDER BY ordinal;
ROLLBACK;
