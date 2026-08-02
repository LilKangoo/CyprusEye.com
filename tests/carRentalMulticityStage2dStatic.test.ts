import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const sha256 = (relative: string) => crypto.createHash('sha256').update(read(relative)).digest('hex');

const adapterPath = 'js/car-rental-availability-adapter.js';
const adapter = read(adapterPath);
const repository = read('js/car-rental-availability-repository.js');
const publicSeams = [read('js/car-rental-paphos.js'), read('js/home-cars.js')].join('\n');
const stage2dSources = `${adapter}\n${repository}\n${publicSeams}`;

describe('Car Rental Multi-City Stage 2D static safety guards', () => {
  test('pricing, reservation, public flow, fulfillment, and booking triggers remain byte-identical', () => {
    const expected: Record<string, string> = {
      'js/car-pricing.js': '3e8f1fcb790743314a29588e8e8abdc45a90d4c991ceefd4814daa234e091030',
      'js/car-reservation.js': 'cc5ea32f934482e7daefdf68801a1af20a18acc3f6148afde143e72546ce3784',
      'js/car-rental-flow.js': '77c1764bcce742d7b70323b8a115bd1a73f331449a74445409dd3492b2068de6',
      'supabase/functions/partner-fulfillment-action/index.ts': '802aa0b8d3a1204f93adefcf598a77c764fde4a6e15dfe2624366c0a99c1297b',
      'supabase/migrations/103_car_coupon_quote_rpc_and_partner_snapshot.sql': 'a45d46f3b16ca42d3c750e320300a18530c25e8f7be8640ea2bf91faaac5627b',
      'supabase/migrations/104_partner_car_duration_days_consistency.sql': 'f1d33de2f078b99b42d5d5a78dd0806277f548107374338fa01828ff4f80c7db',
      'supabase/migrations/107_car_booking_status_paid_sync_from_deposit.sql': '397226a4c5066303b353adf7c5f14ec4d830f61d424121f17f40c1e224d2fcc9',
      'supabase/migrations/124_service_coupon_quote_and_booking_enforcement.sql': '5297e4e469206d36087eede769b2aa77a1bee24696269c608cdb74ac699d663f',
    };
    for (const [relative, hash] of Object.entries(expected)) expect(sha256(relative)).toBe(hash);
  });

  test('the Stage 2D repository is strictly read-only and excludes booking/customer data', () => {
    for (const table of [
      'site_settings', 'car_rental_cities', 'car_pricing_profiles',
      'car_pricing_profile_cities', 'car_offer_city_availability', 'car_offers',
    ]) expect(repository).toContain(`.from('${table}')`);
    expect(repository).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/i);
    expect(repository).not.toMatch(/\b(?:car_bookings|customer_name|customer_email|customer_phone|payment|stripe)\b/i);
  });

  test('legacy is the only rendered result and the shadow seam is explicitly gated', () => {
    expect(adapter).toContain('renderedOffers: legacyOffers');
    expect(adapter).not.toMatch(/renderedOffers\s*:\s*mappedOffers/);
    expect(adapter).not.toMatch(/renderedOffers\s*=\s*mappedOffers/);
    expect(publicSeams.match(/CE_CAR_MULTICITY_SHADOW_CONFIG/g)).toHaveLength(2);
    expect(publicSeams).toContain('config.enabled === true');
    expect(`${adapter}\n${repository}`).not.toContain('console.');
    const addedSeamLines = childProcess.execFileSync(
      'git', ['diff', '--unified=0', '--', 'js/car-rental-paphos.js', 'js/home-cars.js'], { encoding: 'utf8' },
    ).split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).join('\n');
    expect(addedSeamLines).not.toContain('console.');
  });

  test('there is one shared adapter and no copied price calculator or city fee table', () => {
    const adapterFiles = childProcess.execFileSync('rg', ['--files', 'js'], { encoding: 'utf8' })
      .trim().split('\n').filter((file) => /car-rental-availability-adapter\.js$/.test(file));
    expect(adapterFiles).toEqual([adapterPath]);
    expect(read('js/car-rental-paphos.js')).toContain("from './car-rental-availability-adapter.js'");
    expect(read('js/home-cars.js')).toContain("from '/js/car-rental-availability-adapter.js'");
    expect(adapter).toContain('calculateCarRentalQuote');
    expect(adapter).toContain('buildPricingMatrixForOfferRow');
    expect(adapter).not.toMatch(/(?:larnaca|nicosia|ayia-napa|protaras|limassol|paphos)\s*:\s*(?:0|15|20|40)\b/);
  });

  test('no public writes, RPC, booking fields, or mapped production activation were added', () => {
    expect(stage2dSources).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/i);
    expect(stage2dSources).not.toMatch(/\b(?:sendEmail|sendNotification|notification_queue|transport_bookings|car_bookings)\b/i);
    const foundation = read('supabase/migrations/20260802120000_car_rental_multicity_foundation.sql');
    expect(foundation).toMatch(/car_multi_city_mapped_enabled\s+boolean\s+not null\s+default\s+false/i);
    expect(foundation).not.toMatch(/car_multi_city_mapped_enabled[^;]*(?:default|values?|set)\s+true/i);
    expect(foundation).not.toMatch(/profile-paphos[^;]*(?:larnaca|nicosia|ayia-napa|protaras|limassol)/i);
  });

  test('Stage 2D did not alter the protected files in the working tree', () => {
    const protectedPaths = [
      'js/car-pricing.js',
      'js/car-reservation.js',
      'js/car-rental-flow.js',
      'supabase/functions/partner-fulfillment-action/index.ts',
      'supabase/migrations/103_car_coupon_quote_rpc_and_partner_snapshot.sql',
      'supabase/migrations/104_partner_car_duration_days_consistency.sql',
      'supabase/migrations/107_car_booking_status_paid_sync_from_deposit.sql',
      'supabase/migrations/124_service_coupon_quote_and_booking_enforcement.sql',
    ];
    const changed = childProcess.execFileSync('git', ['diff', '--name-only', '--', ...protectedPaths], {
      encoding: 'utf8',
    }).trim();
    expect(changed).toBe('');
  });

  test('generated dist contains the same shadow safety contract', () => {
    const distAdapter = read('dist/js/car-rental-availability-adapter.js');
    const distRepository = read('dist/js/car-rental-availability-repository.js');
    const distCarPage = read('dist/js/car-rental-paphos.js');
    const distHomepage = read('dist/js/home-cars.js');
    expect(distAdapter).toContain('renderedOffers');
    expect(distAdapter).toContain('legacyOffers');
    expect(distAdapter).toContain('Stage 2D safety assertion failed');
    expect(distAdapter).not.toMatch(/renderedOffers\s*:\s*mappedOffers/);
    expect(distRepository).not.toMatch(/\.(?:insert|update|upsert|delete|rpc)\s*\(/i);
    expect(distCarPage).toContain("from './car-rental-availability-adapter.js'");
    expect(distHomepage).toContain("from '/js/car-rental-availability-adapter.js'");
  });

  test('real PostgREST gate is loopback-only and contains no production project reference', () => {
    const gate = read('tests/integration/car-rental-multicity-stage2d-postgrest-gate.mjs');
    expect(gate).toContain("['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname)");
    expect(gate).toContain("assert.equal(parsedUrl.protocol, 'http:'");
    expect(gate).not.toMatch(/supabase\.co|uhnewnycowtrswxrcsez|customer_(?:name|email|phone)/i);
    expect(gate).toContain("requestLog.every((entry) => entry.method === 'GET')");
  });
});
