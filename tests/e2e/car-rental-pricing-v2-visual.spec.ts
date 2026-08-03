import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';
import { enableSupabaseStub, waitForSupabaseStub } from './utils/supabase';

const LARNACA_OFFER = 'ca300001-0000-4000-8000-000000000001';
const PAPHOS_OFFER = 'ca300001-0000-4000-8000-000000000002';
const CITY_PAPHOS = 'ca200001-0000-4000-8000-000000000006';
const ARTIFACT_DIR = path.resolve('playwright-report/car-rental-pricing-v2-visual');

function visualSeedScript() {
  return () => {
    (window as any).__supabaseStub = {
      ...(window as any).__supabaseStub,
      onReady: (stub: any) => {
        stub.clearPersistence?.();
        stub.reset?.();
        const admin = stub.seedUser({
          email: 'visual.cars.admin@example.test',
          password: 'visual-only',
          profile: { id: 'visual-admin', email: 'visual.cars.admin@example.test', username: 'visualadmin', name: 'Visual Cars Admin', is_admin: true },
        });
        stub.seedTable('profiles', [{ id: admin.id, email: admin.email, username: 'visualadmin', name: 'Visual Cars Admin', is_admin: true }]);
        stub.seedTable('admin_users_overview', [{ id: admin.id, email: admin.email, username: 'visualadmin', name: 'Visual Cars Admin', is_admin: true, created_at: '2026-08-03T08:00:00.000Z' }]);
        stub.seedTable('admin_system_diagnostics', [{ metric: 'total_users', value: 1 }]);
        stub.seedTable('site_settings', [{ id: 1, force_refresh_version: 0, car_multi_city_mapped_enabled: false, updated_at: '2026-08-03T08:00:00.000Z' }]);

        const cities = [
          ['ca200001-0000-4000-8000-000000000001', 'larnaca', 'Larnaka', 'Larnaca', 'לרנקה', true, 10],
          ['ca200001-0000-4000-8000-000000000002', 'nicosia', 'Nikozja', 'Nicosia', 'ניקוסיה', true, 20],
          ['ca200001-0000-4000-8000-000000000003', 'ayia-napa', 'Ajia Napa', 'Ayia Napa', 'איה נאפה', true, 30],
          ['ca200001-0000-4000-8000-000000000004', 'protaras', 'Protaras', 'Protaras', 'פרוטארס', true, 40],
          ['ca200001-0000-4000-8000-000000000005', 'limassol', 'Limassol', 'Limassol', 'לימסול', true, 50],
          ['ca200001-0000-4000-8000-000000000006', 'paphos', 'Pafos', 'Paphos', 'פאפוס', true, 60],
          ['ca200001-0000-4000-8000-000000000007', 'polis', 'Polis', 'Polis', 'פוליס', false, 70],
        ].map(([id, code, pl, en, he, is_active, sort_order], index) => ({
          id, code, name_i18n: { pl, en, he }, place_types: ['city', 'hotel', 'address'], is_active, sort_order,
          updated_at: `2026-08-03T08:${String(index + 1).padStart(2, '0')}:00.000Z`,
        }));
        stub.seedTable('car_rental_cities', cities);

        const larnacaProfile = 'ca210001-0000-4000-8000-000000000001';
        const paphosProfile = 'ca210001-0000-4000-8000-000000000002';
        stub.seedTable('car_pricing_profiles', [
          { id: larnacaProfile, code: 'larnaca', name: 'Larnaca pricing profile', calculator_key: 'larnaca', legacy_booking_location: 'larnaca', is_active: true, updated_at: '2026-08-03T08:10:00.000Z' },
          { id: paphosProfile, code: 'paphos', name: 'Paphos pricing profile', calculator_key: 'paphos', legacy_booking_location: 'paphos', is_active: true, updated_at: '2026-08-03T08:11:00.000Z' },
        ]);
        const standardCodes = ['larnaca', 'nicosia', 'ayia-napa', 'protaras', 'limassol', 'paphos'];
        stub.seedTable('car_pricing_profile_cities', [
          ...cities.slice(0, 6).map((city: any, index: number) => ({
            id: `visual-larnaca-mapping-${index + 1}`,
            pricing_profile_id: larnacaProfile,
            city_id: city.id,
            pickup_supported: true,
            return_supported: true,
            legacy_pricing_city_key: standardCodes[index],
            is_active: true,
            updated_at: `2026-08-03T08:${20 + index}:00.000Z`,
          })),
          { id: 'visual-paphos-mapping', pricing_profile_id: paphosProfile, city_id: cities[5].id, pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'paphos', is_active: true, updated_at: '2026-08-03T08:26:00.000Z' },
          { id: 'visual-polis-draft-mapping', pricing_profile_id: larnacaProfile, city_id: cities[6].id, pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'polis', is_active: false, updated_at: '2026-08-03T08:27:00.000Z' },
        ]);
        stub.seedTable('car_vehicle_kinds', [
          { id: 'ca220001-0000-4000-8000-000000000001', code: 'car', name_i18n: { pl: 'Samochód', en: 'Car', he: 'רכב' }, is_active: true, sort_order: 10 },
          { id: 'ca220001-0000-4000-8000-000000000002', code: 'quad', name_i18n: { pl: 'Quad', en: 'Quad', he: 'טרקטורון' }, is_active: true, sort_order: 20 },
          { id: 'ca220001-0000-4000-8000-000000000003', code: 'buggy', name_i18n: { pl: 'Buggy', en: 'Buggy', he: 'באגי' }, is_active: true, sort_order: 30 },
        ]);
        stub.seedTable('partners', [
          { id: 'visual-partner-larnaca', name: 'Island Mobility Partner', status: 'active', can_manage_cars: true, cars_locations: ['larnaca'], updated_at: '2026-08-03T08:30:00.000Z' },
          { id: 'visual-partner-paphos', name: 'PKA Car Rental', status: 'active', can_manage_cars: true, cars_locations: ['paphos'], updated_at: '2026-08-03T08:31:00.000Z' },
        ]);
        stub.seedTable('partner_resources', [
          { id: 'visual-resource-larnaca', partner_id: 'visual-partner-larnaca', resource_type: 'cars', resource_id: 'ca300001-0000-4000-8000-000000000001', created_at: '2026-08-03T08:32:00.000Z' },
          { id: 'visual-resource-paphos', partner_id: 'visual-partner-paphos', resource_type: 'cars', resource_id: 'ca300001-0000-4000-8000-000000000002', created_at: '2026-08-03T08:33:00.000Z' },
        ]);
        const common = {
          availability_mode: 'legacy', vehicle_kind_id: 'ca220001-0000-4000-8000-000000000001',
          transmission: 'automatic', fuel_type: 'petrol', currency: 'EUR', max_passengers: 5, max_luggage: 2,
          stock_count: 2, deposit_amount: 200, insurance_per_day: 17, north_allowed: true,
          is_available: true, is_published: true, submission_status: 'approved', image_url: '/fixture-car-photo.svg',
        };
        stub.seedTable('car_offers', [
          {
            ...common, id: 'ca300001-0000-4000-8000-000000000001', updated_at: '2026-08-03T09:00:00.000Z',
            location: 'larnaca', pricing_profile_id: larnacaProfile, owner_partner_id: 'visual-partner-larnaca', sort_order: 10,
            car_model: { pl: 'Toyota Yaris', en: 'Toyota Yaris', he: 'טויוטה יאריס' },
            car_type: { pl: 'Ekonomiczne', en: 'Economy', he: 'חסכוני' },
            description: { pl: 'Ekonomiczny samochód miejski.', en: 'Efficient city car.', he: 'רכב עירוני חסכוני.' },
            features: { pl: ['Klimatyzacja'], en: ['Air conditioning'], he: ['מיזוג'] },
            price_per_day: 35, price_3days: 105, price_4_6days: 34, price_7_10days: 31, price_10plus_days: 29,
            young_driver_fee: true, young_driver_cost: 10,
          },
          {
            ...common, id: 'ca300001-0000-4000-8000-000000000002', updated_at: '2026-08-03T09:01:00.000Z',
            location: 'paphos', pricing_profile_id: paphosProfile, owner_partner_id: 'visual-partner-paphos', sort_order: 20,
            car_model: { pl: 'Kia Stonic', en: 'Kia Stonic', he: 'קיה סטוניק' },
            car_type: { pl: 'SUV', en: 'SUV', he: 'רכב שטח' },
            description: { pl: 'Kompaktowy SUV z Pafos.', en: 'Compact Paphos SUV.', he: 'רכב שטח קומפקטי מפאפוס.' },
            features: { pl: ['Klimatyzacja'], en: ['Air conditioning'], he: ['מיזוג'] },
            price_per_day: 65, price_3days: 210, price_4_6days: 65, price_7_10days: 60, price_10plus_days: 55,
            young_driver_fee: false, young_driver_cost: 0, north_allowed: false,
          },
        ]);
        stub.seedTable('car_offer_city_availability', [
          { id: 'visual-availability-larnaca', offer_id: 'ca300001-0000-4000-8000-000000000001', city_id: cities[0].id, pickup_enabled: true, return_enabled: true, is_active: true, fee_mode: 'inherit', fee_per_direction: null, fee_note: null, updated_at: '2026-08-03T09:10:00.000Z' },
          { id: 'visual-availability-paphos', offer_id: 'ca300001-0000-4000-8000-000000000002', city_id: cities[5].id, pickup_enabled: true, return_enabled: true, is_active: true, fee_mode: 'inherit', fee_per_direction: null, fee_note: null, updated_at: '2026-08-03T09:11:00.000Z' },
        ]);
        stub.seedTable('service_deposit_rules', [{ id: 'visual-cars-deposit', resource_type: 'cars', mode: 'per_day', amount: 5, currency: 'EUR', include_children: true, enabled: true, updated_at: '2026-08-03T09:20:00.000Z' }]);
        stub.seedTable('service_deposit_overrides', [{ id: 'visual-offer-deposit', resource_type: 'cars', resource_id: 'ca300001-0000-4000-8000-000000000001', mode: 'flat', amount: 50, currency: 'EUR', include_children: true, enabled: true, updated_at: '2026-08-03T09:21:00.000Z' }]);
        stub.seedTable('car_bookings', []);
        stub.seedTable('service_deposit_requests', []);
        stub.seedTable('partner_service_fulfillments', []);
        stub.setSession({ id: admin.id, email: admin.email, user_metadata: { name: 'Visual Cars Admin' } });
      },
    };
  };
}

async function openFleet(page: any) {
  await page.addInitScript(visualSeedScript());
  await page.route('**/fixture-car-photo.svg', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f172a"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><circle cx="350" cy="520" r="92" fill="#0b1220" stroke="#dbeafe" stroke-width="24"/><circle cx="875" cy="520" r="92" fill="#0b1220" stroke="#dbeafe" stroke-width="24"/><path d="M145 485l85-175c24-48 72-78 126-78h347c60 0 115 29 148 79l73 111 112 43v86H124z" fill="#f8fafc"/><path d="M391 268h301c39 0 76 18 99 50l52 72H326z" fill="#38bdf8" opacity=".8"/><path d="M600 268v122" stroke="#0f172a" stroke-width="15"/><text x="600" y="120" fill="#fff" font-family="Arial" font-size="58" text-anchor="middle">CYPRUSEYE TEST VEHICLE</text></svg>',
    });
  });
  await enableSupabaseStub(page);
  await page.goto('/admin/dashboard.html', { waitUntil: 'domcontentloaded' });
  await waitForSupabaseStub(page);
  await page.locator('button.admin-nav-item[data-view="cars"]').click();
  await page.locator('.cars-tab-button[data-tab="fleet"]').click();
  await expect(page.locator('#fleetTableBody')).toContainText('Toyota Yaris');
  await expect(page.locator('#fleetTableBody')).toContainText('Kia Stonic');
}

async function openAction(page: any, action: string, offerId = LARNACA_OFFER) {
  await page.locator(`#fleetTableBody [data-car-multicity-action="${action}"][data-offer-id="${offerId}"]`).evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.locator('#carMulticityModal')).toBeVisible();
  await expect(page.locator('#carMulticityExactOfferId')).toHaveText(offerId);
}

async function closeModal(page: any) {
  if (await page.locator('#carMulticityModal').isVisible()) {
    await page.locator('#carMulticityModalClose').click();
    await expect(page.locator('#carMulticityModal')).toBeHidden();
  }
}

async function capture(page: any, number: number, name: string) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const file = path.join(ARTIFACT_DIR, `${String(number).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, animations: 'disabled', fullPage: false });
  expect(fs.readFileSync(file).subarray(1, 4).toString('ascii')).toBe('PNG');
}

async function assertModalGeometry(page: any) {
  const metrics = await page.locator('#carMulticityModal .car-multicity-modal__content').evaluate((element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    const body = element.querySelector<HTMLElement>('.car-multicity-modal__body');
    const header = element.querySelector<HTMLElement>('.admin-modal-header');
    const footer = element.querySelector<HTMLElement>('.car-multicity-modal__footer');
    return {
      top: box.top, bottom: box.bottom, height: box.height, viewportHeight: window.innerHeight,
      bodyOverflowY: body ? getComputedStyle(body).overflowY : '',
      headerVisible: Boolean(header && header.getBoundingClientRect().top >= box.top - 1),
      footerVisible: Boolean(footer && footer.getBoundingClientRect().bottom <= box.bottom + 1),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || Boolean(body && body.scrollWidth > body.clientWidth + 1),
    };
  });
  expect(metrics.height).toBeLessThanOrEqual(metrics.viewportHeight * 0.94 + 2);
  expect(metrics.top).toBeGreaterThanOrEqual(0);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  expect(metrics.bodyOverflowY).toMatch(/auto|scroll/);
  expect(metrics.headerVisible).toBe(true);
  expect(metrics.footerVisible).toBe(true);
  expect(metrics.horizontalOverflow).toBe(false);
}

async function assertVisualControls(page: any) {
  const visual = await page.locator('#carMulticityModalContent').evaluate((root: HTMLElement) => {
    const controls = Array.from(root.querySelectorAll<HTMLElement>('input:not([type="checkbox"]):not([type="file"]),select,textarea')).filter((node) => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    const backgrounds = controls.map((node) => getComputedStyle(node).backgroundColor);
    const heights = controls.map((node) => Math.round(node.getBoundingClientRect().height));
    return {
      whiteInputs: backgrounds.filter((value) => value === 'rgb(255, 255, 255)' || value === 'rgba(255, 255, 255, 1)').length,
      minHeight: heights.length ? Math.min(...heights) : 0,
      maxHeight: heights.length ? Math.max(...heights) : 0,
      clippedText: Array.from(root.querySelectorAll<HTMLElement>('label span,h4,h5,dt,dd')).filter((node) => node.scrollWidth > node.clientWidth + 1).length,
    };
  });
  expect(visual.whiteInputs).toBe(0);
  expect(visual.minHeight).toBeGreaterThanOrEqual(40);
  expect(visual.maxHeight - visual.minHeight).toBeLessThanOrEqual(50);
  expect(visual.clippedText).toBe(0);
}

async function assertCityEditorGeometry(page: any) {
  const metrics = await page.locator('.car-multicity-city-editor').evaluate((editor: HTMLElement) => {
    const box = editor.getBoundingClientRect();
    const footer = editor.querySelector<HTMLElement>(':scope > footer')?.getBoundingClientRect();
    const body = editor.querySelector<HTMLElement>('.car-multicity-city-editor__body');
    return {
      top: box.top,
      bottom: box.bottom,
      height: box.height,
      viewportHeight: window.innerHeight,
      footerTop: footer?.top ?? -1,
      footerBottom: footer?.bottom ?? Number.POSITIVE_INFINITY,
      bodyOverflowY: body ? getComputedStyle(body).overflowY : '',
    };
  });
  expect(metrics.top).toBeGreaterThanOrEqual(0);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  expect(metrics.height).toBeLessThanOrEqual(metrics.viewportHeight * 0.9 + 2);
  expect(metrics.footerTop).toBeGreaterThanOrEqual(metrics.top);
  expect(metrics.footerBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  expect(metrics.bodyOverflowY).toMatch(/auto|scroll/);
}

test('Pricing V2 visual regression sign-off artifacts', async ({ page }) => {
  test.setTimeout(180_000);
  fs.rmSync(ARTIFACT_DIR, { recursive: true, force: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFleet(page);
  await capture(page, 1, 'desktop-1440x1000-fleet-management');

  await page.locator('#btnAddFleetCar').click();
  await expect(page.locator('#carMulticityModal')).toBeVisible();
  await assertModalGeometry(page);
  await assertVisualControls(page);
  await capture(page, 2, 'desktop-1440x1000-add-new-car-vehicle');

  for (let index = 0; index < 4; index += 1) await page.locator('#carMulticityNext').click();
  const previewBytes = await page.evaluate(async () => {
    const source = new Image();
    source.src = '/fixture-car-photo.svg';
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 525;
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG conversion failed')), 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const previewPng = Buffer.from(previewBytes);
  await page.locator('#carMulticityImageFile').setInputFiles({ name: 'new-vehicle-preview.png', mimeType: 'image/png', buffer: previewPng });
  await expect(page.locator('.car-multicity-image-preview img[alt="New vehicle preview"]')).toBeVisible();
  await page.locator('#carMulticityMediaHeading').scrollIntoViewIfNeeded();
  await capture(page, 3, 'desktop-1440x1000-add-new-car-image-preview');
  await closeModal(page);

  await openAction(page, 'pricing');
  await page.locator('[data-draft-field="pricing.pricePerDay"]').fill('42');
  await expect(page.locator('#carMulticityModalContent')).toContainText('Daily price');
  await assertModalGeometry(page);
  await capture(page, 4, 'desktop-1440x1000-larnaca-pricing-profile');
  await closeModal(page);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await openAction(page, 'pricing', PAPHOS_OFFER);
  await page.locator('[data-draft-field="pricing.price3Days"]').fill('225');
  await page.locator('[data-draft-field="pricing.price4To6Days"]').fill('70');
  await page.locator('[data-draft-field="pricing.price7To10Days"]').fill('62');
  await page.locator('[data-draft-field="pricing.price10PlusDays"]').fill('57');
  await expect(page.locator('#carMulticityModalContent')).toContainText('3-day package price');
  await expect(page.locator('#carMulticityModalContent')).toContainText('Preserved, not edited');
  await assertModalGeometry(page);
  await capture(page, 5, 'desktop-1920x1080-paphos-pricing-profile');
  await closeModal(page);

  await openAction(page, 'availability');
  await expect(page.locator('.car-multicity-availability-card')).toHaveCount(7);
  await expect(page.locator('[data-availability-field="pickup_enabled"]')).toHaveCount(0);
  await expect(page.locator('[data-availability-field="return_enabled"]')).toHaveCount(0);
  await assertModalGeometry(page);
  await capture(page, 6, 'desktop-1920x1080-six-standard-cities-and-inactive-custom-city');

  const paphosCard = page.locator(`[data-city-id="${CITY_PAPHOS}"]`);
  await paphosCard.locator('[data-availability-field="paired"]').check();
  await paphosCard.locator('[data-availability-field="fee_mode"]').selectOption('override');
  await paphosCard.locator('[data-availability-field="fee_per_direction"]').fill('0');
  await paphosCard.locator('[data-availability-field="fee_per_direction"]').press('Tab');
  await paphosCard.scrollIntoViewIfNeeded();
  await expect(paphosCard).toContainText('€0.00 pickup · €0.00 return · €0.00 route total');
  await capture(page, 7, 'desktop-1920x1080-custom-fee-zero');

  await paphosCard.locator('[data-availability-field="fee_per_direction"]').fill('25');
  await paphosCard.locator('[data-availability-field="fee_per_direction"]').press('Tab');
  await paphosCard.scrollIntoViewIfNeeded();
  await expect(paphosCard).toContainText('€25.00 pickup · €25.00 return · €50.00 route total');
  await capture(page, 8, 'desktop-1920x1080-custom-fee-positive');

  await page.locator('#carMulticityReview').click();
  await expect(page.locator('#carMulticityReviewHeading')).toBeFocused();
  await expect(page.locator('#carMulticityModalContent')).toContainText('This exact vehicle only');
  await expect(page.locator('#carMulticityModalContent')).toContainText('Route total €50.00');
  await capture(page, 9, 'desktop-1920x1080-availability-review');
  await closeModal(page);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAction(page, 'vehicle');
  await page.locator('#carMulticityDepositHeading').scrollIntoViewIfNeeded();
  await expect(page.locator('#carMulticityModalContent')).toContainText('Exact offer override');
  await capture(page, 10, 'desktop-1440x1000-payment-due-at-booking');
  await closeModal(page);

  await page.locator('#btnManageCarMulticity').click();
  await expect(page.locator('#carMulticityCatalogModal')).toBeVisible();
  await expect(page.locator('.car-multicity-city-card')).toHaveCount(7);
  await capture(page, 11, 'desktop-1440x1000-car-rental-cities-list');

  await page.locator('[data-catalog-action="add-city"]').click();
  await expect(page.locator('#carMulticityCityEditorTitle')).toHaveText('Add city');
  await expect(page.locator('.car-multicity-city-editor > footer')).toBeVisible();
  await assertCityEditorGeometry(page);
  await capture(page, 12, 'desktop-1440x1000-add-city');
  await page.getByRole('button', { name: 'Close city editor' }).click();

  await page.locator('[data-catalog-action="edit-city"][data-city-id="ca200001-0000-4000-8000-000000000007"]').click();
  await expect(page.locator('#carMulticityCityEditorTitle')).toContainText('Polis');
  await expect(page.locator('.car-multicity-city-editor > footer')).toBeVisible();
  await assertCityEditorGeometry(page);
  await capture(page, 13, 'desktop-1440x1000-edit-city');
  await page.getByRole('button', { name: 'Close city editor' }).click();

  await page.locator('#carMulticityCatalogMappingsTab').click();
  await expect(page.locator('#carMulticityCatalogContent')).toContainText('Pricing profile city support');
  const mappingInputColors = await page.locator('.car-multicity-mapping-table input:not([type="checkbox"])').evaluateAll((inputs: HTMLElement[]) => inputs.map((input) => getComputedStyle(input).backgroundColor));
  expect(mappingInputColors).not.toContain('rgb(255, 255, 255)');
  await capture(page, 14, 'desktop-1440x1000-pricing-profile-city-support');
  await page.locator('#carMulticityCatalogClose').click();

  await openAction(page, 'vehicle');
  await page.locator('#carMulticityMaxPassengers').fill('0');
  await page.locator('#carMulticityReview').click();
  await expect(page.locator('#carMulticityModalError')).toBeVisible();
  await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
  await capture(page, 15, 'desktop-1440x1000-inline-validation-errors');

  await page.locator('#carMulticityModalContent').evaluate((root: HTMLElement) => {
    root.innerHTML = '<div class="car-multicity-skeleton" aria-label="Loading vehicle configuration"><span></span><span></span><span></span><span></span><span></span></div>';
  });
  await page.locator('#carMulticityModalError').evaluate((element: HTMLElement) => {
    element.hidden = true;
    element.textContent = '';
  });
  await page.locator('#carMulticityModalStatus').evaluate((element: HTMLElement) => {
    element.textContent = 'Loading vehicle configuration…';
    element.dataset.kind = 'status';
  });
  await expect(page.locator('.car-multicity-skeleton')).toBeVisible();
  await capture(page, 16, 'desktop-1440x1000-loading-state');
  await closeModal(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await openAction(page, 'vehicle');
  await assertModalGeometry(page);
  await assertVisualControls(page);
  await page.locator('[data-i18n-field="vehicle.carModel"][data-language="he"]').focus();
  const focusRing = await page.locator('[data-i18n-field="vehicle.carModel"][data-language="he"]').evaluate((element: HTMLElement) => ({ outline: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth }));
  expect(focusRing.outline).not.toBe('none');
  expect(focusRing.width).not.toBe('0px');
  await capture(page, 17, 'mobile-390x844-vehicle-wizard');
  await closeModal(page);

  await openAction(page, 'availability');
  await paphosCard.scrollIntoViewIfNeeded();
  await assertModalGeometry(page);
  const mobileStatus = await page.locator('#carMulticityModalStatus').evaluate((element: HTMLElement) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(mobileStatus.scrollWidth).toBeLessThanOrEqual(mobileStatus.clientWidth + 1);
  expect(mobileStatus.scrollHeight).toBeLessThanOrEqual(mobileStatus.clientHeight + 1);
  await capture(page, 18, 'mobile-390x844-availability');
  await closeModal(page);

  await page.setViewportSize({ width: 430, height: 932 });
  await openAction(page, 'pricing', PAPHOS_OFFER);
  await page.locator('[data-draft-field="pricing.price3Days"]').scrollIntoViewIfNeeded();
  await assertModalGeometry(page);
  await capture(page, 19, 'mobile-430x932-pricing');
  await closeModal(page);

  await openAction(page, 'pricing');
  await page.locator('[data-draft-field="pricing.pricePerDay"]').fill('42');
  await page.locator('#carMulticityReview').click();
  await expect(page.locator('#carMulticityModalContent')).toContainText('35');
  await expect(page.locator('#carMulticityModalContent')).toContainText('42');
  await expect(page.locator('#carMulticityModalContent')).toContainText('Existing inactive pricing columns changed');
  await page.getByRole('heading', { name: 'Pricing values changes', exact: true }).scrollIntoViewIfNeeded();
  await assertModalGeometry(page);
  await capture(page, 20, 'mobile-430x932-pricing-review');

  const screenshots = fs.readdirSync(ARTIFACT_DIR).filter((file) => file.endsWith('.png')).sort();
  expect(screenshots).toHaveLength(20);
});
