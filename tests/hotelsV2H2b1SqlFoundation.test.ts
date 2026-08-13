import fs from 'node:fs';

const migration = fs.readFileSync(
  'supabase/migrations/20260811240000_hotels_v2_h2b1_children_shadow_rooms.sql',
  'utf8',
);
const preflight = fs.readFileSync('supabase/manual/hotels_v2_h2b1_preflight.sql', 'utf8');
const verify = fs.readFileSync('supabase/manual/hotels_v2_h2b1_verify.sql', 'utf8');
const shadowVerify = fs.readFileSync(
  'supabase/manual/hotels_v2_h2b1_seven_arches_shadow_verify.sql',
  'utf8',
);
const policyRepairMigration = fs.readFileSync(
  'supabase/migrations/20260811250000_hotels_v2_h2b1_shadow_policy_review_fix.sql',
  'utf8',
);
const policyRepairPreflight = fs.readFileSync(
  'supabase/manual/hotels_v2_h2b1_shadow_policy_review_fix_preflight.sql',
  'utf8',
);
const policyRepairVerify = fs.readFileSync(
  'supabase/manual/hotels_v2_h2b1_shadow_policy_review_fix_verify.sql',
  'utf8',
);
const threeWayMigration = fs.readFileSync(
  'supabase/migrations/20260811260000_hotels_v2_h2b1_shadow_three_way_merge.sql',
  'utf8',
);
const threeWayPreflight = fs.readFileSync(
  'supabase/manual/hotels_v2_h2b1_shadow_three_way_merge_preflight.sql',
  'utf8',
);
const threeWayVerify = fs.readFileSync(
  'supabase/manual/hotels_v2_h2b1_shadow_three_way_merge_verify.sql',
  'utf8',
);
const pgGate = fs.readFileSync('tests/integration/hotels-v2-h2b1-postgres-gate.sql', 'utf8');
const reviewedSavePostgrestGate = fs.readFileSync(
  'tests/integration/hotels-v2-h2b1-reviewed-save-postgrest-gate.mjs',
  'utf8',
);

describe('Hotels H2B.1 SQL foundation', () => {
  test('adds structural property defaults and optional exact-room overrides without applying them publicly', () => {
    expect(migration).toContain('add column children_policy text');
    expect(migration).toContain('add column minimum_child_age smallint');
    expect(migration).toContain('add column children_policy_override text');
    expect(migration).toContain('add column minimum_child_age_override smallint');
    expect(migration).toContain("children_policy in ('allowed','not_allowed','minimum_age')");
    expect(migration).toContain("minimum_child_age between 0 and 17");
    expect(migration).toContain('minimum_child_age is not null');
    expect(migration).toContain(') is true');
    expect(migration).toContain('Legacy public booking ignores it until an explicit H3 property activation.');
    expect(migration).not.toContain('hotel_rooms_v2_enabled=true');
    expect(migration).not.toContain("architecture_version='rooms_v2'");
  });

  test('supports confirmed total occupancy without inventing an adult/child split', () => {
    expect(migration).toContain('add column max_occupancy smallint');
    expect(migration).toContain('max_occupancy is not null and max_occupancy between 1 and 50');
    expect(migration).toContain('capacity_adults is null and capacity_children is null');
    expect(migration).toContain('max_occupancy is null and capacity_adults is not null and capacity_adults>0');
    expect(migration).toContain('capacity_children is not null and capacity_children>=0');
    expect(migration).toContain('hotel_v2_h2b1_room_capacity');
    expect(migration).toContain('before update of capacity_adults,capacity_children,max_occupancy');
  });

  test('uses exact reviewed, atomic and idempotent 7 Arches identities', () => {
    for (const value of [
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
      '22e47a63-a630-4fb6-8f43-816f2d3fdc17',
      'b0a3104f-7b31-5265-a59f-c2d166f11a23',
      '443065c0-984a-5de3-a22a-d03042c41107',
    ]) expect(migration).toContain(value);
    expect(migration).toContain("source_contract'<>'seven_arches_two_apartments_v1'");
    expect(migration).toContain('All apartments are air-conditioned');
    expect(migration).toContain("'[\"air_conditioning\",\"terrace\",\"balcony\"]'::jsonb");
    expect(preflight).toContain('All apartments are air-conditioned');
    expect(preflight).toContain('seven_arches_source_contract_count');
    expect(verify).toContain('All apartments are air-conditioned');
    expect(verify).toContain('seven_arches_source_contract_count');
    expect(migration).toContain('room_photo_not_in_property_gallery');
    expect(migration).toContain('shadow_room_identity_conflict');
    expect(migration).toContain('hotels_v2_h2b1_unexpected_existing_room_type');
    expect(migration).toContain('hotels_v2_h2b1_room_expected_version_mismatch');
    expect(pgGate).toContain('hotels_v2_h2b1_room_review_version_abort_failed');
    expect(migration).toContain("legacy_source_key=v_room_json->>'source_key'");
    expect(migration).toContain("children_policy='minimum_age',minimum_child_age=10");
    expect(migration).toContain("architecture_version<>'legacy'");
  });

  test('keeps the 63-rule property-party preview separate from the reusable 27-tier room schedule', () => {
    expect(migration).toContain("application_scope in ('room_occupancy','property_booking_party')");
    expect(migration).toContain("'room_occupancy','EUR',4,false,'requires_review','legacy_preview'");
    expect(migration).toContain("'property_booking_party','EUR',8,false,'requires_review','legacy_preview'");
    expect(migration).toContain("continue when (v_rule->>'persons')::integer>4");
    expect(migration).toContain("'pricing_schedule_tier_count',27");
    expect(migration).toContain("'property_party_preview_tier_count',63");
    expect(migration).toContain('shared_room_pricing_schedule_requires_h3_resolution');
    expect(migration).toContain('hotels_v2_h2b1_shadow_tier_value_mismatch');
    expect(migration).not.toContain('delete from public.hotel_pricing_schedule_occupancy_tiers');
  });

  test('keeps placeholder pricing inert and makes readiness explain every H3 blocker', () => {
    expect(migration).toContain('hotel_rate_plans_h2b1_review_activation_check');
    expect(migration).toContain('hotel_room_rates_h2b1_schedule_inert_check');
    expect(migration).toContain('hotel_pricing_schedules_activation_review_check');
    expect(migration).toContain('unreviewed_children_policy');
    expect(migration).toContain('unreviewed_cancellation_policy');
    expect(migration).toContain('h2b1_schedule_product_not_executable');
    expect(migration).toContain('hotel_v2_h2a_readiness_h2b_core');
    expect(pgGate).toContain('hotels_v2_h2b1_generic_rpc_activation_guard_failed');
    expect(pgGate).toContain('hotels_v2_h2b1_financial_readiness_failed');
  });

  test('reopening room/photo preparation cannot overwrite reviewed pricing', () => {
    expect(migration).not.toContain("errcode='40001'");
    expect(migration).toContain("errcode='PT409'");
    expect(migration).toContain('hotels_v2_h2b1_guest_policy_already_reviewed');
    expect(migration).toContain('hotels_v2_h2b1_stale_pricing_schedule');
    expect(migration).toContain('hotels_v2_h2b1_stale_rate_plan');
    expect(migration).toContain('hotels_v2_h2b1_stale_upper_room_rate');
    expect(migration).toContain('hotels_v2_h2b1_stale_ground_room_rate');
    expect(pgGate).toContain('hotels_v2_h2b1_repeat_save_overwrote_reviewed_pricing');
  });

  test('repairs the reviewed property-policy transition with an exact atomic snapshot', () => {
    expect(policyRepairMigration).toContain("'expected_property_policy'");
    expect(policyRepairMigration).toContain('hotels_v2_h2b1_stale_property_policy');
    expect(policyRepairMigration).toContain('children_policy is not distinct from v_expected_policy_value');
    expect(policyRepairMigration).toContain('minimum_child_age is not distinct from v_expected_minimum_age');
    expect(policyRepairMigration).toContain('perform public.hotel_v2_h2a_require_admin()');
    expect(policyRepairMigration).toContain("array['search_path=pg_catalog, public, auth']");
    expect(policyRepairMigration).not.toContain("message='hotels_v2_h2b1_guest_policy_already_reviewed'");
    expect(policyRepairMigration).toContain('hotels_v2_h2b1_reviewed_policy_fix_data_changed');
    expect(policyRepairMigration).not.toContain('update public.hotel_room_types set status');
    expect(pgGate).toContain('hotels_v2_h2b1_stale_property_policy_atomic_abort_failed');
  });

  test('requires a fresh read and explicit second Save after a stale Room Type review', () => {
    expect(reviewedSavePostgrestGate).toContain('The stale Save was retried automatically.');
    expect(reviewedSavePostgrestGate).toContain('hotels_v2_h2b1_stale_shadow_room');
    expect(reviewedSavePostgrestGate).toContain('CONCURRENT_ROOM_CORRELATION');
    expect(reviewedSavePostgrestGate).toContain(
      'Fresh read/re-review issued a mutation before the second explicit Save.',
    );
    expect(reviewedSavePostgrestGate).toContain('before.property.photos.slice(0, 5)');
    expect(reviewedSavePostgrestGate).toContain('before.property.photos.slice(4, 9)');
    expect(reviewedSavePostgrestGate).toContain('freshReadPreservedGalleryCounts');
    expect(reviewedSavePostgrestGate).toContain('secondExplicitStatus');
  });

  test('repairs shadow-room reconciliation with an exact field-level three-way contract', () => {
    expect(threeWayMigration).toContain("'expected_original'");
    expect(threeWayMigration).toContain('hotels_v2_h2b1_shadow_room_three_way_conflict');
    expect(threeWayMigration).toContain('v_current_state->v_state_key is distinct from v_expected_original->v_state_key');
    expect(threeWayMigration).toContain('v_current_state->v_state_key is distinct from v_target_state->v_state_key');
    expect(threeWayMigration).toContain("errcode='PT409'");
    expect(threeWayMigration).toContain('perform public.hotel_v2_h2a_require_admin()');
    expect(threeWayMigration).toContain("array['search_path=pg_catalog, public, auth']");
    expect(threeWayMigration).toContain('hotels_v2_h2b1_three_way_migration_changed_data');
    expect(threeWayMigration).not.toContain("architecture_version='rooms_v2'");
    expect(threeWayMigration).not.toContain('hotel_rooms_v2_enabled=true');
    expect(threeWayPreflight).toContain('upper_current_amenities');
    expect(threeWayPreflight).toContain('ground_current_amenities');
    expect(threeWayPreflight).toContain('hotels_v2_h2b1_shadow_three_way_merge_preflight_safe');
    expect(threeWayVerify).toContain('hotels_v2_h2b1_shadow_three_way_merge_safe');
    expect(pgGate).toContain('hotels_v2_h2b1_three_way_current_original_failed');
    expect(pgGate).toContain('hotels_v2_h2b1_three_way_real_conflict_atomic_abort_failed');
  });

  test('translates inherited H2A/H2B serialization conflicts at the PostgREST boundary', () => {
    expect(migration).toContain('hotel_v2_admin_apply_calendar_plan_h2b1_core');
    expect(migration).toContain('hotel_v2_admin_apply_workspace_plan_h2b1_core');
    expect(migration).toContain('when serialization_failure then');
    expect(migration).toContain('hotels_v2_h2b1_transport_wrapper_security_mismatch');
    expect(pgGate).toContain('hotels_v2_h2b1_transport_conflict_translation_failed');
    expect(verify).toContain('transport_contract');
    expect(verify).toContain('wrappers_hardened');
  });

  test('routes all room mutations, including duplicate, through a stale-safe exact-ID RPC', () => {
    expect(migration).toContain('hotel_v2_admin_apply_room_type_plan');
    expect(migration).toContain("v_action not in ('create','update','disable','duplicate')");
    expect(migration).toContain("where id=(v_payload->>'source_id')::uuid and hotel_id=v_hotel_id for update");
    expect(migration).toContain('hotels_v2_h2b1_stale_room_type_source');
    expect(migration).toContain("case when v_action='duplicate' then 'draft'");
    expect(pgGate).toContain('hotels_v2_h2b1_room_type_rpc_create_update_duplicate_disable_failed');
    expect(pgGate).toContain('hotels_v2_h2b1_room_type_rpc_stale_abort_failed');
    expect(pgGate).toContain('hotels_v2_h2b1_all_null_capacity_guard_failed');
    expect(pgGate).toContain('hotels_v2_h2b1_room_minimum_age_null_guard_failed');
    expect(pgGate).toContain('hotels_v2_h2b1_amenity_source_provenance_failed');
    expect(pgGate).toContain('hotels_v2_h2b1_description_source_provenance_failed');
    expect(pgGate).toContain('hotels_v2_h2b1_exact_existing_room_set_failed');
  });

  test('ships one-row fail-closed preflight and inert-foundation verify', () => {
    expect(preflight).toContain('hotels_v2_h2b1_preflight_safe');
    expect(preflight).toContain("normalized.reserved_room_id_count=0");
    expect(preflight).toContain("seven_arches_grid.rule_count=63");
    expect(preflight).toContain("amenities.confirmed_amenity_count=3");
    expect(verify).toContain('hotels_v2_h2b1_foundation_safe');
    expect(verify).toContain('business_conflicts_nonretrying');
    expect(verify).toContain('HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH');
    expect(verify).toContain('HOTEL_LEGACY_PRICE_MISMATCH');
    expect(verify).toContain('HOTEL_LEGACY_PUBLIC_MISMATCH');
    expect(verify).toContain('HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE');
    expect(verify).toContain('rows.pricing_schedule_count=0');
    expect(verify).toContain('properties.policy_unreviewed_count=2');
    expect(shadowVerify).toContain('hotels_v2_h2b1_seven_arches_shadow_safe');
    expect(shadowVerify).toContain('room_schedule_value_mismatch');
    expect(shadowVerify).toContain('property_party_value_mismatch');
    expect(shadowVerify).toContain('tiers.room_tier_count=27');
    expect(shadowVerify).toContain('tiers.party_tier_count=63');
    expect(shadowVerify).toContain("status in ('draft','active')");
    expect(policyRepairPreflight).toContain('hotels_v2_h2b1_shadow_policy_review_fix_preflight_safe');
    expect(policyRepairPreflight).toContain('protected_fingerprints');
    expect(policyRepairPreflight).toContain('fb5a4c508b0df32afbffe5b1594c7a50');
    expect(policyRepairPreflight).toContain('1e01541853d87d26adccb8172074934b');
    expect(policyRepairVerify).toContain('hotels_v2_h2b1_shadow_policy_review_fix_safe');
    expect(policyRepairVerify).toContain('fb5a4c508b0df32afbffe5b1594c7a50');
    expect(policyRepairVerify).toContain('1e01541853d87d26adccb8172074934b');
  });
});
