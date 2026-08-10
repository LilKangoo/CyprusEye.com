import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = (relative: string) => crypto.createHash('sha256').update(read(relative)).digest('hex');
const adapter = read('js/car-rental-availability-adapter.js');
const repository = read('js/car-rental-availability-repository.js');
const carPage = read('js/car-rental-paphos.js');
const homepage = read('js/home-cars.js');
const publicScope = `${adapter}\n${repository}\n${carPage}\n${homepage}`;

function expectReadOnlyEligibilityRpc(source: string) {
  const rpcNames = Array.from(
    source.matchAll(/\.rpc\s*\(\s*(['"])([^'"]+)\1/g),
    (match) => match[2],
  );
  expect(rpcNames).toEqual(['resolve_public_threshold_offer_ids']);
  const withoutApprovedRpc = source.replace(
    /\.rpc\s*\(\s*(['"])resolve_public_threshold_offer_ids\1/g,
    '.approvedReadRpc(',
  );
  expect(withoutApprovedRpc).not.toMatch(/\.rpc\s*\(/i);
  expect(source).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/i);
}

describe('Car Rental Multi-City Stage 2E static safety guards', () => {
  test('the authorized pricing seams and all downstream contracts match accepted hashes', () => {
    const expected: Record<string, string> = {
      'js/car-pricing.js': '6305c5cc9636c690c220d2f9f9f7a1e66b30de5a2ce239eefd32d2fdfd76c6c9',
      'js/car-reservation.js': 'dffd657581b415084b72c2984bda6a0be4db645813f876ac6185ef9ed7ae0d97',
      'js/car-rental-flow.js': '64a461171c4496ce53ced64146623ec15025e8784645e4e1f572e817db546f16',
      'supabase/functions/partner-fulfillment-action/index.ts': '802aa0b8d3a1204f93adefcf598a77c764fde4a6e15dfe2624366c0a99c1297b',
      'supabase/migrations/103_car_coupon_quote_rpc_and_partner_snapshot.sql': 'a45d46f3b16ca42d3c750e320300a18530c25e8f7be8640ea2bf91faaac5627b',
      'supabase/migrations/104_partner_car_duration_days_consistency.sql': 'f1d33de2f078b99b42d5d5a78dd0806277f548107374338fa01828ff4f80c7db',
      'supabase/migrations/107_car_booking_status_paid_sync_from_deposit.sql': '397226a4c5066303b353adf7c5f14ec4d830f61d424121f17f40c1e224d2fcc9',
      'supabase/migrations/124_service_coupon_quote_and_booking_enforcement.sql': '5297e4e469206d36087eede769b2aa77a1bee24696269c608cdb74ac699d663f',
    };
    for (const [relative, expectedHash] of Object.entries(expected)) expect(hash(relative)).toBe(expectedHash);
  });

  test('hybrid mode is database-flagged and never aliases renderedOffers to mappedOffers', () => {
    expect(adapter).toContain("['legacy', 'shadow', 'mapped-test', 'hybrid']");
    expect(adapter).toContain("mode === 'shadow' || mode === 'hybrid'");
    expect(adapter).toContain('repository.getFeatureFlag()');
    expect(adapter).toContain("normalized(legacyOffer?.availability_mode) !== 'legacy'");
    expect(adapter).toContain('buildHybridCarRentalResult');
    expect(adapter).not.toMatch(/renderedOffers\s*(?::|=)\s*mappedOffers/);
    expect(adapter).toContain('MAPPED_READER_UNAVAILABLE');
    expect(adapter).toContain('MAPPED_OFFER_OMITTED');
    expect(adapter).toContain('LEGACY_MAPPED_DUPLICATE_REMOVED');
  });

  test('both public surfaces use the same adapter and preserve exact per-offer context', () => {
    expect(carPage).toContain("mode: config.renderMapped === true ? 'hybrid' : 'shadow'");
    expect(homepage).toContain("mode: config.renderMapped === true ? 'hybrid' : 'shadow'");
    expect(carPage).toContain('pricingContext?.legacyBookingLocation');
    expect(homepage).toContain('context?.legacyBookingLocation');
    expect(carPage).toContain('pricingContext?.quote');
    expect(homepage).toContain('context?.quote');
    expect(publicScope).not.toMatch(/find\([^\n]*(?:car_model|location)[^\n]*\)/i);
  });

  test('production entry points always consult the database flag without requiring the optional JS config', () => {
    for (const entryPoint of [carPage, homepage]) {
      expect(entryPoint).toContain('const config = window.CE_CAR_MULTICITY_SHADOW_CONFIG;');
      expect(entryPoint).toContain('return { enabled: true, renderMapped: true, debounceMs: 30 };');
      expect(entryPoint).not.toMatch(/if\s*\(\s*!window\.CE_CAR_MULTICITY_SHADOW_CONFIG\s*\)\s*return/);
      expect(entryPoint).not.toMatch(/window\.CE_CAR_MULTICITY_SHADOW_CONFIG\s*=/);
    }
    expect(repository).toContain(".select('car_multi_city_mapped_enabled,car_threshold_daily_rates_enabled')");
    expect(adapter).toContain('repository.getFeatureFlags()');
    expect(adapter).toContain("if (!flags.mappedEnabled) {");
    expect(adapter).toContain('const result = baseResult(legacyOffers, diagnostics, repository.getMetrics());');
    expect(adapter).toContain("normalized(legacyOffer?.availability_mode) !== 'legacy'");
    expect(adapter).not.toMatch(/renderedOffers\s*(?::|=)\s*mappedOffers/);
  });

  test('the public reader remains read-only, PII-free and has no booking/RPC/downstream writes', () => {
    expect(`${adapter}\n${repository}`).not.toContain('console.');
    expectReadOnlyEligibilityRpc(publicScope);
    expect(repository).not.toMatch(/\b(?:car_bookings|customer_name|customer_email|customer_phone|stripe|payment)\b/i);
    expect(publicScope).not.toMatch(/\b(?:sendEmail|sendNotification|notification_queue)\b/i);
    expect(repository).toContain(".from('site_settings')");
    expect(repository).toContain(".from('car_offer_city_availability')");
  });

  test('foundation remains inert by default with no mapped production seed or Paphos cross-city mapping', () => {
    const foundation = read('supabase/migrations/20260802120000_car_rental_multicity_foundation.sql');
    expect(foundation).toMatch(/car_multi_city_mapped_enabled\s+boolean\s+not null\s+default\s+false/i);
    expect(foundation).not.toMatch(/set\s+car_multi_city_mapped_enabled\s*=\s*true/i);
    expect(foundation).not.toMatch(/set\s+availability_mode\s*=\s*'mapped'/i);
    expect(foundation).not.toMatch(/profile-paphos[^;]*(?:larnaca|nicosia|ayia-napa|protaras|limassol)/i);
  });

  test('only one shared availability adapter and one existing calculator implementation exist', () => {
    const adapters = childProcess.execFileSync('rg', ['--files', 'js'], { encoding: 'utf8' })
      .trim().split('\n').filter((file) => /car-rental-availability-adapter\.js$/.test(file));
    expect(adapters).toEqual(['js/car-rental-availability-adapter.js']);
    expect(adapter).toContain('calculateCarRentalQuote');
    expect(adapter).toContain('buildPricingMatrixForOfferRow');
    expect(adapter).not.toMatch(/(?:larnaca|nicosia|ayia-napa|protaras|limassol|paphos)\s*:\s*(?:0|15|20|40)\b/);
  });

  test('no protected path outside the authorized Stage 3 reservation seam was changed', () => {
    const protectedPaths = [
      'supabase/functions/partner-fulfillment-action/index.ts',
      'supabase/migrations/103_car_coupon_quote_rpc_and_partner_snapshot.sql',
      'supabase/migrations/104_partner_car_duration_days_consistency.sql',
      'supabase/migrations/107_car_booking_status_paid_sync_from_deposit.sql',
      'supabase/migrations/124_service_coupon_quote_and_booking_enforcement.sql',
    ];
    const changed = childProcess.execFileSync('git', ['diff', '--name-only', '--', ...protectedPaths], { encoding: 'utf8' }).trim();
    expect(changed).toBe('');
  });
});
