import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Car Rental Multi-City Admin Pricing V2 static guards', () => {
  const migration = read('supabase/migrations/20260803120000_car_rental_multicity_offer_city_fees.sql');
  const verify = read('supabase/manual/car_rental_multicity_admin_pricing_v2_verify.sql');
  const core = read('admin/car-rental-multicity-core.js');
  const repository = read('admin/car-rental-multicity-repository.js');
  const ui = read('admin/car-rental-multicity-ui.js');
  const admin = read('admin/admin.js');
  const pricing = read('js/car-pricing.js');
  const adapter = read('js/car-rental-availability-adapter.js');

  test('migration is additive, inert and preserves the accepted production baseline', () => {
    expect(migration).toMatch(/^begin;/i);
    expect(migration.trim()).toMatch(/commit;$/i);
    expect(migration).toContain("add column if not exists fee_mode text not null default 'inherit'");
    expect(migration).toContain('add column if not exists fee_per_direction numeric(10,2)');
    expect(migration).toContain('alter column is_active set default false');
    expect(migration).toContain("fee_mode in ('inherit', 'override')");
    expect(migration).toContain('fee_per_direction >= 0');
    expect(migration).toContain("availability_mode <> 'legacy'");
    expect(migration).toContain('car_multi_city_mapped_enabled is true');
    expect(migration).not.toMatch(/\bupdate\s+public\.car_offers\b/i);
    expect(migration).not.toMatch(/\bupdate\s+public\.car_offer_city_availability\b/i);
    expect(migration).not.toMatch(/\binsert\s+into\s+public\.(?:car_offers|car_offer_city_availability)\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.(?:car_offers|car_offer_city_availability)\b/i);
  });

  test('custom city key stays exact while Paphos remains local-only', () => {
    expect(migration).toContain("legacy_pricing_city_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'");
    expect(migration).toContain('new.legacy_pricing_city_key <> v_city.code');
    expect(migration).toContain('paphos_profile_cross_city_mapping_forbidden');
    expect(migration).toContain('mapped_car_offer_city_fee_override_required');
    expect(core).toContain('Pricing key must be a normalized city slug.');
    expect(core).toContain('Legacy pricing key must match the city code.');
  });

  test('availability write path is exact, directional and cannot touch finance or partner tables', () => {
    expect(core).toContain("direction === 'pickup' ? 'pickup_enabled' : 'return_enabled'");
    expect(core).toContain('row.is_active = row.pickup_enabled === true || row.return_enabled === true');
    expect(core).toContain("fee_mode: after.fee_mode");
    expect(repository).toContain(".eq('offer_id', offerId)");
    expect(repository).toContain(".eq('city_id', cityId)");
    expect(repository).toContain(".eq('updated_at', request.expectedUpdatedAt)");
    expect(repository).toContain("rpc('admin_save_car_offer_city_availability_batch'");
    expect(core).toContain('expectedAvailabilityRows');
    expect(core).toContain('desiredAvailabilityRows');
    expect(`${core}\n${repository}`).not.toMatch(/from\(TABLES\.(?:depositRules|depositOverrides)\)\.(?:insert|update|upsert|delete)/);
    const availabilityPlan = core.slice(core.indexOf('function buildAvailabilityPlan'), core.indexOf('function buildPartnerAssignmentPlan'));
    expect(availabilityPlan).not.toContain('is_active: normalized.pickup_enabled');
    expect(availabilityPlan).toContain('existingPriceColumnChanges: 0');
    expect(availabilityPlan).toContain("change.field === 'owner_partner_id'");
    expect(availabilityPlan).toContain("throw new Error('Availability plan contains forbidden fields')");
  });

  test('pricing save updates only exact active-profile values and preserves hidden tiers', () => {
    expect(core).toContain('function pricingEditPayload');
    expect(core).toContain('(PROFILE_PRICE_COLUMNS[code] || []).forEach');
    expect(repository).toContain('core.PRICING_EDIT_COLUMNS');
    expect(repository).toContain(".eq('id', id).eq('updated_at', expectedUpdatedAt)");
    expect(ui).toContain('Review price changes');
    expect(ui).toContain('Save pricing values');
    expect(ui).toContain('No inactive pricing column is copied, reset, or defaulted.');
  });

  test('visual copy uses administrator labels, a route fee total and a strict mobile viewport cap', () => {
    const css = read('admin/admin.css');
    expect(ui).toContain('Vehicle type');
    expect(ui).toContain('Commercial class');
    expect(ui).toContain("price_per_day: 'Daily price'");
    expect(admin).toContain('Pricing and profile');
    expect(ui).toContain('Fee per direction');
    expect(ui).toContain('route total');
    expect(ui).toContain('This fee applies only to this exact vehicle in this city.');
    expect(ui).toContain('Existing inactive pricing columns changed');
    expect(css).toContain('max-height: 94dvh !important;');
    expect(css).toContain('overflow: hidden !important;');
    expect(css).toContain('grid-template-rows: auto auto minmax(0, 1fr) auto;');
    expect(css).toContain('height: 90dvh;');
    expect(css).toContain('.car-multicity-mapping-table input:not([type=\'checkbox\'])');
  });

  test('public seam changes only directional fees and has no second calculator', () => {
    expect(pricing).toContain('pickupFeeOverride = null');
    expect(pricing).toContain('returnFeeOverride = null');
    expect(adapter).toContain('pickupFeeOverride: pickupFee.override');
    expect(adapter).toContain('returnFeeOverride: returnFee.override');
    expect(adapter).toContain("addDiagnostic(diagnostics, 'FEE_REQUIRED_FOR_CITY'");
    expect(adapter.match(/calculateCarRentalQuote\(/g)).toHaveLength(1);
    expect(adapter).not.toMatch(/function\s+(?:calculate|compute).*total/i);
  });

  test('verify SQL is read-only and checks the accepted baseline and inert state', () => {
    expect(verify).toContain('car-rental-multicity-admin-pricing-v2-verify-v1');
    expect(verify).toContain('admin_pricing_v2_safe');
    expect(verify).toContain('aa1abc7ce187779927838bafb706cf3b');
    expect(verify).toContain('availability_rows = 12');
    expect(verify).toContain('mapped_offers = 0');
    expect(verify).toContain('mapped_flag is false');
    expect(verify).toContain('new_city_defaults_inactive');
    expect(verify).not.toMatch(/\b(insert|update|delete|upsert|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/i);
  });

  test('protected downstream files outside the authorized Stage 3 reservation seam remain byte-untouched', () => {
    const protectedPaths = [
      'supabase/functions/partner-fulfillment-action/index.ts',
      'supabase/functions/car-booking/index.ts',
      'supabase/functions/coupon-booking-enforcement/index.ts',
    ];
    const diff = childProcess.execFileSync('git', ['diff', '--name-only', '--', ...protectedPaths], { encoding: 'utf8' }).trim();
    expect(diff).toBe('');
  });
});
