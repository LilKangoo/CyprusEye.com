import fs from 'node:fs';

const admin = fs.readFileSync('admin/admin.js', 'utf8');
const dashboard = fs.readFileSync('admin/dashboard.html', 'utf8');
const repository = fs.readFileSync('admin/car-rental-multicity-repository.js', 'utf8');
const core = fs.readFileSync('admin/car-rental-multicity-core.js', 'utf8');
const ui = fs.readFileSync('admin/car-rental-multicity-ui.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260811120000_car_fleet_operations.sql', 'utf8');
const verify = fs.readFileSync('supabase/manual/car_fleet_operations_verify.sql', 'utf8');
const postgresGate = fs.readFileSync('tests/integration/car-fleet-operations-postgres-gate.sql', 'utf8');

describe('Cars Fleet Operations static contract', () => {
  test('separates pricing and availability presentation', () => {
    expect(dashboard).toContain('id="carMulticityPricingModeBadge"');
    expect(dashboard).toContain('id="carMulticityAvailabilityModeBadge"');
    expect(admin).toContain('Pricing: <b>');
    expect(admin).toContain('Availability: <b>');
    expect(admin).toContain('Use configured availability');
    expect(admin).toContain('Use legacy coverage');
  });

  test('Fleet exposes partner/group/filter and explicit selection scopes', () => {
    for (const id of [
      'fleetPartnerFilter',
      'fleetVehicleKindFilter',
      'fleetPricingStrategyFilter',
      'fleetAvailabilityModeFilter',
      'fleetPublicStatusFilter',
      'fleetCityFilter',
      'fleetGroupingFilter',
      'fleetSelectVisibleCheckbox',
      'btnSelectFilteredFleet',
      'btnOpenFleetBulk',
    ]) expect(dashboard).toContain(`id="${id}"`);
    expect(admin).toContain('groupFleetItemsByPartner');
    expect(admin).toContain('setFleetSelectionScope');
  });

  test('bulk editor is allowlisted and does not expose bulk pricing', () => {
    expect(dashboard).toContain('id="carFleetBulkModal"');
    expect(admin).toContain('Pickup, return and city fees');
    expect(admin).toContain('Security / damage deposit');
    expect(admin).toContain('Payment due at booking');
    expect(admin).toContain('Assign exact owner partner');
    expect(admin).toContain('Base prices / daily-rate tiers: unchanged');
    expect(admin).not.toContain('Bulk base pricing');
  });

  test('one repository RPC is the only Fleet bulk mutation path', () => {
    expect(repository).toContain("rpc('admin_apply_car_fleet_bulk_operation'");
    expect(repository).toContain('p_targets: targets');
    expect(repository).toContain('p_operations: core.clone(plan.operations)');
    expect(repository).toContain('One or more selected vehicles changed since Review. No changes were applied.');
  });

  test('legacy mapped availability no longer uses profile direction support as authority', () => {
    expect(core).toContain('if (row.pickup_enabled) pickups += 1;');
    expect(core).toContain('if (row.return_enabled) returns += 1;');
    expect(ui).toContain('<dt>Exact offer-city support</dt>');
    expect(ui).toContain('Pickup: ${pickupSupported ? \'configurable\'');
    expect(ui).toContain('exact offer-city rows own mapped pickup and return directions');
    expect(ui).not.toContain('Paphos remains hard-limited to Paphos');
    expect(ui).not.toContain('Legacy offers still require an explicit profile-city mapping');
  });

  test('Fleet mapped readiness includes threshold financial structure and exact owner', () => {
    const fleetCore = fs.readFileSync('admin/car-fleet-operations-core.js', 'utf8');
    expect(fleetCore).toContain('At least one active daily-rate tier is required.');
    expect(fleetCore).toContain('Minimum rental days must match the lowest active daily-rate tier.');
    expect(fleetCore).toContain('An active exact Cars owner partner is required.');
  });

  test('SQL adapter matches the reviewed repository RPC contract and hides its internal mutator', () => {
    expect(migration).toContain('public.admin_apply_car_fleet_bulk_operation(\n  p_targets jsonb,\n  p_operations jsonb');
    expect(migration).toContain("'operation', 'fleet_bulk'");
    expect(migration).toContain("'target_count', (v_internal_receipt ->> 'offer_count')::integer");
    expect(migration).toContain('car_fleet_bulk_reviewed_availability_mismatch');
    expect(migration).toMatch(/revoke all on function public\.car_fleet_apply_reviewed_operations_internal\(jsonb\)\s+from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function public\.car_fleet_apply_reviewed_operations_internal\(jsonb\)\s+to service_role;/);
    expect(verify).toContain('internal_helper_not_exposed');
    expect(verify).toContain('car_fleet_operations_safe');
  });

  test('directional SQL is exact-row authoritative and Fleet bulk does not create a template lock', () => {
    const directionalStart = migration.indexOf('create or replace function public.car_multicity_directional_availability_is_valid(');
    const directionalEnd = migration.indexOf('comment on function public.car_multicity_directional_availability_is_valid(', directionalStart);
    const directionalFunction = migration.slice(directionalStart, directionalEnd);
    expect(directionalStart).toBeGreaterThanOrEqual(0);
    expect(directionalEnd).toBeGreaterThan(directionalStart);
    expect(directionalFunction).toContain('p_row_active is true');
    expect(directionalFunction).not.toContain('mapping.pickup_supported');
    expect(directionalFunction).not.toContain('mapping.return_supported');
    expect(postgresGate).toContain('$individual_override_after_bulk$');
    expect(postgresGate).toContain('public.admin_save_car_offer_city_availability_batch(');
    expect(postgresGate).toContain('individual exact-offer override after Fleet bulk failed');
  });
});
