import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Car Rental Multi-City Admin UX and media hotfix guards', () => {
  const core = read('admin/car-rental-multicity-core.js');
  const repository = read('admin/car-rental-multicity-repository.js');
  const ui = read('admin/car-rental-multicity-ui.js');
  const css = read('admin/admin.css');

  test('new vehicle media reuses the legacy storage contract', () => {
    expect(core).toContain("const VEHICLE_IMAGE_BUCKET = 'car-images'");
    expect(core).toContain('5 * 1024 * 1024');
    for (const mime of ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']) {
      expect(core).toContain(`'${mime}'`);
    }
    expect(repository).toContain("cacheControl: '31536000'");
    expect(repository).toContain('upsert: false');
    expect(ui).toContain('New image before Save');
    expect(ui).toContain('Image action');
    expect(`${core}\n${repository}\n${ui}`).not.toMatch(/data:image\/[^;]+;base64/i);
  });

  test('availability and profile support use one paired Admin control', () => {
    expect(ui.match(/data-availability-field="paired"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(ui).not.toMatch(/data-availability-field="(?:pickup_enabled|return_enabled)"/);
    expect(ui).toContain('Pickup and return settings differ. Review required.');
    expect(ui).toContain('data-mapping-field="paired_supported"');
    expect(core).toContain('row.pickup_enabled = enabled');
    expect(core).toContain('row.return_enabled = enabled');
  });

  test('deposit data is read only and never enters a Cars save payload', () => {
    expect(repository).toContain("depositRules: 'service_deposit_rules'");
    expect(repository).toContain("depositOverrides: 'service_deposit_overrides'");
    expect(repository).not.toMatch(/from\(TABLES\.deposit(?:Rules|Overrides)\)\.(?:insert|update|upsert|delete)/);
    expect(ui).toContain('Payment due at booking');
    expect(ui).toContain('Deposit rule changes: 0');
    const pricingPayload = core.slice(core.indexOf('function pricingPayload'), core.indexOf('function validateAvailability'));
    expect(pricingPayload).not.toContain('deposit_amount');
  });

  test('new Cars repository never emits the legacy jsonb car_type filter that causes HTTP 400', () => {
    expect(`${repository}\n${ui}`).not.toMatch(/\.eq\(['"]car_type['"]/);
    expect(ui).not.toContain('String(vehicle.carType)');
    expect(core).toContain('resolveI18nText');
  });

  test('modal UX keeps a large responsive shell with sticky actions and loading state', () => {
    expect(css).toContain('max-width: min(1180px, calc(100vw - 32px))');
    expect(css).toMatch(/\.car-multicity-modal__footer\s*\{[\s\S]*?position:\s*sticky/);
    expect(css).toMatch(/\.car-multicity-wizard-steps\s*\{[\s\S]*?position:\s*sticky/);
    expect(ui).toContain('car-multicity-skeleton');
    expect(ui).toContain('aria-invalid');
  });

  test('protected public runtime and database migrations have no hotfix diff', () => {
    const protectedPaths = [
      'js/car-rental-availability-adapter.js',
      'js/car-rental-availability-repository.js',
      'js/car-rental-paphos.js',
      'js/home-cars.js',
      'js/car-pricing.js',
      'js/car-reservation.js',
      'supabase/migrations',
      'supabase/functions/partner-fulfillment-action/index.ts',
    ];
    const diff = childProcess.execFileSync('git', ['diff', '--name-only', '--', ...protectedPaths], { encoding: 'utf8' }).trim();
    expect(diff).toBe('');
  });
});
