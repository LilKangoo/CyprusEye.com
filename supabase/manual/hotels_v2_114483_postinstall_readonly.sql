BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL search_path=pg_catalog,public;
WITH verified AS MATERIALIZED (SELECT hotels_read_once_private.assert_exact()),
shadow AS MATERIALIZED (SELECT hotels_read_once_private.projection_0('9b6d99a0-923a-4fbc-be54-c066e856e6ca') AS dto FROM verified),
activation AS MATERIALIZED (SELECT hotels_read_once_private.projection_1() AS dto FROM verified),
promotion AS MATERIALIZED (SELECT hotels_read_once_private.projection_2('9b6d99a0-923a-4fbc-be54-c066e856e6ca') AS dto FROM verified)
SELECT ordinal,check_name,passed FROM (VALUES
(1,'read_only',(current_setting('transaction_read_only')='on')),
(2,'sources_security_exact',((SELECT count(*)=1 FROM verified))),
(3,'shadow_complete_read_only',((SELECT dto->>'status'='SUCCESSOR_ALREADY_COMPLETE' AND dto->'mutation_allowed'='false'::jsonb FROM shadow))),
(4,'activation_independent',((SELECT dto->>'status'='active' AND dto->>'pricing_authority'='independent_room_schedules' AND dto#>>'{independent_topology,authority_row_count}'='54' FROM activation))),
(5,'promotion_supported',((SELECT dto->'supported'='true'::jsonb AND dto->'public_change'='false'::jsonb FROM promotion))),
(6,'business_install_unchanged',(hotels_stripe_dto_private.business_hash()=(SELECT business_before FROM hotels_read_once_private.certificate WHERE id=1))),
(7,'flags_exact',(hotels_lifecycle_private.safe_state()->'feature_flags' = '{"hotel_rooms_v2_enabled":false,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false}'::jsonb)),
(8,'public_booking_off',(hotels_lifecycle_private.public_booking_enabled() IS FALSE)),
(9,'payment_lineage',(public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE)),
(10,'commission_eur10',((SELECT count(*)=1 FROM public.hotel_commission_policies WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND commission_mode='per_allocated_room_per_night' AND amount=10 AND currency='EUR' AND is_active AND review_status='reviewed')))) gates(ordinal,check_name,passed) ORDER BY ordinal;
ROLLBACK;
