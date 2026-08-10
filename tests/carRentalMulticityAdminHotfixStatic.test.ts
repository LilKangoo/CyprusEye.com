import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Car Rental Multi-City Admin UX and media hotfix guards', () => {
  const core = read('admin/car-rental-multicity-core.js');
  const repository = read('admin/car-rental-multicity-repository.js');
  const ui = read('admin/car-rental-multicity-ui.js');
  const css = read('admin/admin.css');
  const admin = read('admin/admin.js');

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

  test('offer availability uses independent direction controls while profile support stays paired', () => {
    const offerAvailabilityUi = ui.slice(
      ui.indexOf('function renderAvailabilityFields'),
      ui.indexOf('function renderPartnerFields'),
    );
    expect(ui).not.toContain('data-availability-field="paired"');
    expect(ui).toMatch(/data-availability-field="pickup_enabled"/);
    expect(ui).toMatch(/data-availability-field="return_enabled"/);
    expect(offerAvailabilityUi).not.toContain('Pickup and return settings differ. Review required.');
    expect(ui).toContain('data-mapping-field="paired_supported"');
    expect(core).toContain("direction === 'pickup' ? 'pickup_enabled' : 'return_enabled'");
    expect(core).toContain("row.is_active = row.pickup_enabled === true || row.return_enabled === true");
  });

  test('payment-due rules stay read only while security deposit uses the exact offer field', () => {
    expect(repository).toContain("depositRules: 'service_deposit_rules'");
    expect(repository).toContain("depositOverrides: 'service_deposit_overrides'");
    expect(repository).not.toMatch(/from\(TABLES\.deposit(?:Rules|Overrides)\)\.(?:insert|update|upsert|delete)/);
    expect(ui).toContain('Payment due at booking');
    expect(ui).toContain('Deposit rule changes: 0');
    const pricingPayload = core.slice(core.indexOf('function pricingPayload'), core.indexOf('function validateAvailability'));
    expect(pricingPayload).toContain('deposit_amount');
    expect(pricingPayload).toContain("securityDepositMode === 'unspecified'");
    expect(ui).toContain('Refundable vehicle damage/security deposit for this exact offer');
    expect(ui).toContain('This never changes Stripe or <code>service_deposit_*</code> rules.');
  });

  test('new Cars repository never emits the legacy jsonb car_type filter that causes HTTP 400', () => {
    expect(`${repository}\n${ui}\n${admin}`).not.toMatch(/\.eq\(['"]car_type['"]/);
    expect(ui).not.toContain('String(vehicle.carType)');
    expect(core).toContain('resolveI18nText');
    expect(admin).toContain("Object.values(car.car_type)");
    expect(admin).toContain("core.resolveI18nText(car?.car_type");
  });

  test('modal UX keeps a large responsive shell with sticky actions and loading state', () => {
    expect(css).toContain('max-width: min(1280px, 96vw)');
    expect(css).toMatch(/\.car-multicity-modal__footer\s*\{[\s\S]*?position:\s*sticky/);
    expect(css).toMatch(/\.car-multicity-wizard-steps\s*\{[\s\S]*?position:\s*sticky/);
    expect(ui).toContain('car-multicity-skeleton');
    expect(ui).toContain('aria-invalid');
  });

  test('protected fulfillment runtime still has no Admin Pricing V2 diff', () => {
    const protectedPaths = [
      'supabase/functions/partner-fulfillment-action/index.ts',
    ];
    const diff = childProcess.execFileSync('git', ['diff', '--name-only', '--', ...protectedPaths], { encoding: 'utf8' }).trim();
    expect(diff).toBe('');
  });
});
