import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('public Cars and flexible-vehicle UI integration', () => {
  test('all public offer surfaces share the explicit security-deposit renderer', () => {
    const landing = read('js/car-rental-paphos.js');
    const home = read('js/home-cars.js');
    const modal = read('js/car-offer-modal.js');
    for (const source of [landing, home, modal]) {
      expect(source).toContain('resolveCarSecurityDepositPresentation');
      expect(source).toContain('securityDeposit.visible ?');
      expect(source).toContain('data-security-deposit-state');
    }
    expect(`${landing}\n${home}\n${modal}`).not.toMatch(/service_deposit_(?:rules|overrides)/);
  });

  test('disabled young-driver UI is omitted and insurance copy follows exact offer mode', () => {
    const modal = read('js/car-offer-modal.js');
    const pricing = read('js/car-pricing.js');
    const adapter = read('js/car-rental-availability-adapter.js');
    const landingController = read('js/car-rental-landing.js');
    expect(modal).toContain('const youngDriverBlock = youngDriverConfig.allowed');
    expect(modal).not.toMatch(/youngDriverConfig\.allowed\s*&&\s*\([^\n]*loc\s*===\s*['"]larnaca/);
    expect(pricing).toContain('const youngDriverApplied = !!youngDriver && youngDriverConfig.allowed;');
    expect(pricing).not.toContain("if (normalizedOffer !== 'larnaca')");
    expect(adapter).toContain("if (offer?.young_driver_fee !== true) return false;");
    expect(adapter).not.toMatch(/calculator_key\s*!==\s*['"]larnaca['"]/);
    expect(landingController).toContain('const canUseYoungDriver = selectedCar?.young_driver_fee === true;');
    expect(landingController).not.toContain("state.effectiveOffer === 'larnaca';");
    expect(modal).not.toContain("youngDriver is not available for this car");
    expect(modal).toContain('resolveThresholdInsurancePresentation(selectedCar, getLang())');
  });

  test('coupon and referral retain their IDs inside one responsive collapsed tools grid', () => {
    const modal = read('js/car-offer-modal.js');
    const home = read('js/home-cars.js');
    const reservation = read('js/car-reservation.js');
    const css = read('assets/css/components.css');
    for (const source of [modal, home]) {
      expect(source).toContain('auto-optional-tools-grid');
      expect(source).toContain('data-car-optional-panel="coupon"');
      expect(source).toContain('id="res_coupon_code"');
    }
    expect(reservation).toContain("document.createElement('details')");
    expect(reservation).toContain('data-car-optional-panel');
    expect(reservation).toContain("summary.dataset.state = couponState.appliedCode ? 'applied' : 'empty'");
    expect(reservation).toContain("summary.dataset.state = approved ? 'applied' : code ? 'entered' : 'empty'");
    expect(reservation).toContain("window.addEventListener('ce:car-modal-closed'");
    expect(reservation).toContain('resetReservationReferralState({ clearField: true });');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain(".auto-optional-panel__summary[data-state='applied']");
  });

  test('live catalogue metadata and high-visibility labels make no blanket deposit claim and use vehicle terminology', () => {
    const dictionaries = ['pl', 'en', 'he'].map((language) => JSON.parse(read(`translations/${language}.json`)));
    for (const dictionary of dictionaries) {
      const description = String(dictionary['seo.carRentalLanding.description'] || '');
      expect(description).toBeTruthy();
      expect(description.toLowerCase()).not.toMatch(/bez kaucji|no deposit|ללא פיקדון/);
    }
    expect(dictionaries[0]['home.cars.cta']).toContain('pojazdy');
    expect(dictionaries[1].home.cars.cta).toContain('vehicles');
    expect(dictionaries[2]['home.cars.cta']).toContain('כלי הרכב');
    for (const dictionary of dictionaries) {
      expect(String(dictionary['carRentalLanding.offer.info.youngDriverOnlyLarnaca'] || '')).not.toMatch(/Larnaka|Larnaca|לרנקה/);
    }
  });
});
