import fs from 'node:fs';

const preflight = fs.readFileSync(
  'supabase/manual/hotels_v2_h3_1_seven_kamares_configuration_preflight.sql',
  'utf8',
);
const verify = fs.readFileSync(
  'supabase/manual/hotels_v2_h3_1_seven_kamares_configuration_verify.sql',
  'utf8',
);

function executableSql(sql: string) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\s+/g, ' ')
    .trim();
}

describe('Hotels V2 H3.1 7 Kamares configuration gates', () => {
  test.each([
    ['preflight', preflight],
    ['verify', verify],
  ])('%s is a single read-only statement', (_name, sql) => {
    const executable = executableSql(sql);
    expect(executable.toLowerCase().startsWith('with ')).toBe(true);
    expect(executable.endsWith(';')).toBe(true);
    expect(executable).not.toMatch(
      /\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate\s+|alter\s+table|create\s+(?:or\s+replace\s+)?(?:table|function|index)|drop\s+|grant\s+|revoke\s+)\b/i,
    );
    expect((executable.match(/;/g) || [])).toHaveLength(1);
  });

  test('post-foundation preflight accepts only empty or exact idempotent configuration', () => {
    expect(preflight).toContain('hotels_v2_h3_1_seven_kamares_configuration_preflight_safe');
    expect(preflight).toContain("then 'empty'");
    expect(preflight).toContain("then 'idempotently_configured'");
    expect(preflight).toContain("else 'drift'");
    expect(preflight).toContain('(mode.empty_configuration or mode.idempotently_configured)');
    expect(preflight).toContain('global_h3_rows as');
    expect(preflight).toContain('global_rows.rule_count=0');
    expect(preflight).toContain('global_rows.rule_count=5');
    expect(preflight).toContain('global_rows.item_count=10');
    expect(preflight).toContain('global_rows.policy_count=1');
    expect(preflight).toContain('global_rows.term_count=2');
  });

  test('preflight reports every stale-sensitive exact ID and version', () => {
    for (const id of [
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
      '22e47a63-a630-4fb6-8f43-816f2d3fdc17',
      '7e420964-9cbf-4f1b-abd3-09840af5240f',
      '3320590d-632d-423f-80d0-fd021cba7293',
      'b0a3104f-7b31-5265-a59f-c2d166f11a23',
      '443065c0-984a-5de3-a22a-d03042c41107',
    ]) expect(preflight).toContain(id);
    for (const field of [
      'property_updated_at', 'upper_version', 'upper_updated_at',
      'ground_version', 'ground_updated_at', 'rate_plan_version',
      'upper_rate_version', 'ground_rate_version', 'room_schedule_version',
      'party_schedule_version', 'allocation_rule_versions',
      'allocation_item_versions', 'payment_policy_versions',
      'payment_term_versions', 'commission_versions', 'calendar_source_versions',
    ]) expect(preflight).toContain(field);
  });

  test('requires operational prerequisites and the deferred-trigger authorization repair', () => {
    expect(preflight).toContain("hotel.check_in_from='14:00'::time");
    expect(preflight).toContain("hotel.check_out_until='11:00'::time");
    expect(preflight).toContain('partner.eligible_owner_count=1');
    expect(preflight).toContain('partner.owner_is_operational_count=1');
    expect(preflight).toContain('deferred_trigger_repair_present');
    expect(preflight).toContain('trigger_entrypoint_private');
    expect(preflight).toContain('nested_validator_invoker');
  });

  test.each([
    ['preflight', preflight],
    ['verify', verify],
  ])('%s proves exact inert shadow graph cardinality and price parity', (_name, sql) => {
    expect(sql).toContain("room.inventory_mode='pooled'");
    expect(sql).toContain('room.capacity_adults is null and room.capacity_children is null');
    expect(sql).toContain('unit_count=0');
    expect(sql).toContain('total_rate_plan_count=1');
    expect(sql).toContain('total_room_rate_count=2');
    expect(sql).toContain('total_schedule_count=2');
    expect(sql).toContain('total_tier_count=90');
    expect(sql).toContain('room_parity.mismatch_count=0');
    expect(sql).toContain('party_parity.mismatch_count=0');
    expect(sql).toContain('legacy.case_count=70');
    expect(sql).toContain('legacy.mismatch_count=0');
    expect(sql).toContain("rate.base_nightly_rate=0");
    expect(sql).toContain('rate.external_redirect_url is null');
  });

  test.each([
    ['preflight', preflight],
    ['verify', verify],
  ])('%s keeps protected legacy oracles independent of H3 readiness', (_name, sql) => {
    expect(sql).toContain('property_state.legacy_price_contract_count=1');
    expect(sql).toContain('property_state.legacy_public_contract_count=1');
    expect(sql).toContain('HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH');
    expect(sql).toContain('HOTEL_LEGACY_PRICE_MISMATCH');
    expect(sql).toContain('HOTEL_LEGACY_PUBLIC_MISMATCH');
    expect(sql).toContain('HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE');
    expect(sql).toContain("deposit_fingerprint='42b5e1dc9726890e90014c3e89c2329d'");
    expect(sql).toContain("coupon_fingerprint='d41d8cd98f00b204e9800998ecf8427e'");
  });

  test('bank-transfer instructions remain a separate operational blocker', () => {
    expect(preflight).toContain('partner_bank_payment_instructions_present');
    expect(preflight).toContain('operational_readiness_blockers');
    expect(verify).toContain('partner_bank_instructions_ready');
    expect(verify).toContain('operational_readiness_blockers');
    expect(verify).not.toContain('and payments.acceptance_instruction_count=1');
    expect(verify).toContain('and payments.acceptance_term_count=1 and payments.arrival_term_count=1');
  });
});
