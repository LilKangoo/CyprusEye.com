import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const normalized = (relative: string) => read(relative).toLowerCase();

describe('Car Rental Multi-City Stage 2C static guards', () => {
  const core = normalized('admin/car-rental-multicity-core.js');
  const repository = normalized('admin/car-rental-multicity-repository.js');
  const ui = normalized('admin/car-rental-multicity-ui.js');
  const admin = normalized('admin/admin.js');
  const dashboard = read('admin/dashboard.html');
  const migration = normalized('supabase/migrations/20260802130000_car_rental_multicity_admin_city_place_types.sql');

  test('new modules load before admin.js in dependency order', () => {
    const order = [
      '/admin/car-rental-multicity-core.js',
      '/admin/car-rental-multicity-repository.js',
      '/admin/car-rental-multicity-ui.js',
      '/admin/admin.js',
    ].map((asset) => dashboard.indexOf(asset));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual(order.slice().sort((a, b) => a - b));
  });

  test('global modals are outside the hidden Fleet tab and all IDs are unique', () => {
    const fleetStart = dashboard.indexOf('id="carsTabFleet"');
    const fleetEnd = dashboard.indexOf('</section>', fleetStart);
    const modalIndex = dashboard.indexOf('id="carMulticityModal"');
    expect(modalIndex).toBeGreaterThan(fleetEnd);
    expect(dashboard.indexOf('</main>')).toBeLessThan(modalIndex);
    const ids = Array.from(dashboard.matchAll(/\sid="([^"]+)"/g)).map((match) => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicates).toEqual([]);
  });

  test('repository can mutate only approved Stage 2C tables', () => {
    for (const forbidden of [
      'car_bookings',
      'partner_service_fulfillments',
      'service_coupons',
      'coupons',
      'payments',
    ]) {
      expect(repository).not.toContain(forbidden);
      expect(ui).not.toContain(forbidden);
    }
    expect(repository).toContain("rpc('admin_save_car_offer_city_availability_batch'");
    expect(`${repository}\n${ui}`).not.toMatch(/send(?:email|notification)|enqueue(?:email|notification)|fetch\s*\(/);
    for (const table of ['car_offers', 'car_rental_cities', 'car_pricing_profiles', 'car_pricing_profile_cities', 'car_offer_city_availability', 'car_vehicle_kinds']) {
      expect(repository).toContain(table);
    }
    expect(repository).toContain('service_deposit_rules');
    expect(repository).toContain('service_deposit_overrides');
    expect(repository).not.toMatch(/from\(tables\.deposit(?:rules|overrides)\)\.(?:insert|update|upsert|delete)/);
    expect(ui).not.toMatch(/service_deposit_(?:rules|overrides)[\s\S]{0,120}\.(?:insert|update|upsert|delete)/);
  });

  test('media uses the existing car-images bucket and never stores base64', () => {
    expect(core).toContain("const vehicle_image_bucket = 'car-images'");
    expect(repository).toContain('uploadvehicleimage');
    expect(repository).toContain("cachecontrol: '31536000'");
    expect(`${core}\n${repository}\n${ui}`).not.toMatch(/data:image\/(?:jpeg|png|webp);base64/);
    expect(ui).toContain('removevehicleimage');
  });

  test('offer availability is directional while profile support remains paired', () => {
    expect(ui).not.toContain('data-availability-field="paired"');
    expect(ui).toContain('data-availability-field="pickup_enabled"');
    expect(ui).toContain('data-availability-field="return_enabled"');
    expect(ui).toContain('data-mapping-field="paired_supported"');
    expect(core).toContain('pickup and return support must be saved together');
  });

  test('payment-due preview stays read-only while exact-offer security deposit is separate', () => {
    expect(ui).toContain('payment due at booking');
    expect(ui).toContain('deposit rule changes: 0');
    expect(core).toContain("'deposit_amount'");
    expect(ui).toContain('security deposit');
    expect(ui).toContain('separate from the refundable security deposit');
    expect(repository).toContain('getcarsdepositdefault');
    expect(repository).toContain('getcarsdepositoverride');
  });

  test('availability and partner plans have non-overlapping hard whitelists', () => {
    expect(core).toContain("const partner_columns = object.freeze(['owner_partner_id'])");
    expect(core).toContain("const availability_columns = object.freeze([");
    expect(core).toContain("existingpricecolumnchanges: 0");
    expect(repository).toContain("assertallowedpayload(request.payload, core.availability_columns");
    expect(repository).toContain("assertallowedpayload(request.payload, core.partner_columns");
  });

  test('exact activation can select mapped mode but never changes a site flag', () => {
    expect(core).toContain("availability_mode: 'mapped'");
    expect(core).toContain("const activation_columns = object.freeze([");
    expect(repository).toContain('updateactivationstate');
    expect(repository).toContain("rpc('admin_set_car_threshold_offer_activation_state'");
    expect(`${core}\n${repository}\n${ui}`).not.toMatch(/car_multi_city_mapped_enabled\s*:\s*true/);
    expect(repository).not.toMatch(/from\(tables\.sitesettings\)\.update/);
    expect(core).toContain("availability_mode: 'legacy'");
  });

  test('Fleet uses the shared lifecycle evaluator and exact configured cities without breaking email templates', () => {
    const emailDraftLoader = admin.slice(
      admin.indexOf('async function loademailtemplatedraftstate'),
      admin.indexOf('function cloneemailtemplatecontent'),
    );
    const fleetLoader = admin.slice(
      admin.indexOf('async function loadfleetdata'),
      admin.indexOf('async function togglecaravailability'),
    );
    expect(admin).toContain("import { derivecarofferadminpublicstate } from '../js/car-rental-public-eligibility.js'");
    expect(emailDraftLoader).not.toContain('fleetpresentation');
    expect(fleetLoader).toContain('getfleetpresentationcontext');
    expect(fleetLoader).toContain('derivecarofferadminpublicstate');
    expect(fleetLoader).toContain('legacy compatibility region:');
    expect(fleetLoader).toContain(".sort((left, right) => number(left.threshold_days) - number(right.threshold_days))[0]");
    expect(fleetLoader).not.toContain('math.min(...activerates)');
    expect(fleetLoader).toContain("string(car.pricing_strategy) === 'threshold_daily_rate'");
  });

  test('there is no public import or public adapter in Stage 2C', () => {
    const publicSources = [
      'js/car-pricing.js',
      'js/car-reservation.js',
      'js/car-rental-flow.js',
      'js/home-cars.js',
    ].map(read).join('\n');
    expect(publicSources).not.toContain('car-rental-multicity');
    expect(`${core}\n${repository}\n${ui}`).not.toContain('calculatecarrentalquote');
    expect(`${core}\n${repository}\n${ui}`).not.toContain('resolvecarfleet');
  });

  test('Legacy editor locks existing location and performs an exact fresh-read guard', () => {
    expect(admin).toContain("$('#fleetcarlocation').disabled = true");
    expect(admin).toContain(".select('id,location,pricing_profile_id,updated_at')");
    expect(admin).toContain(".eq('id', carid)");
    expect(admin).toContain('location changes are blocked in the legacy editor');
  });

  test('new city metadata migration is additive and has no public runtime activation', () => {
    expect(migration).toContain('alter table public.car_rental_cities');
    expect(migration).toContain("default array['city']::text[]");
    expect(migration).not.toContain('alter table public.car_offers');
    expect(migration).not.toContain('update public.');
    expect(migration).not.toContain('insert into');
    expect(migration).not.toContain('car_multi_city_mapped_enabled');
  });

  test('Stage 2C protected flow and downstream modules outside the Stage 3 reservation seam have no working-tree changes', () => {
    const protectedPaths = [
      'supabase/functions/partner-fulfillment-action/index.ts',
    ];
    const diff = childProcess.execFileSync('git', ['diff', '--name-only', '--', ...protectedPaths], { encoding: 'utf8' }).trim();
    expect(diff).toBe('');
  });

  test('protected source hashes remain at the accepted baseline', () => {
    const expected: Record<string, string> = {
      'js/car-pricing.js': '6305c5cc9636c690c220d2f9f9f7a1e66b30de5a2ce239eefd32d2fdfd76c6c9',
      'js/car-reservation.js': 'af029ab2a1777ae9a67e66a8691ab44ed006a555b4f8f64b3855d7d716985100',
      'js/car-rental-flow.js': '64a461171c4496ce53ced64146623ec15025e8784645e4e1f572e817db546f16',
      'supabase/functions/partner-fulfillment-action/index.ts': '802aa0b8d3a1204f93adefcf598a77c764fde4a6e15dfe2624366c0a99c1297b',
    };
    for (const [relative, hash] of Object.entries(expected)) {
      expect(crypto.createHash('sha256').update(read(relative)).digest('hex')).toBe(hash);
    }
  });
});
