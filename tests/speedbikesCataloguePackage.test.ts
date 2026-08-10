import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const manifestPath = path.join(root, 'supabase/manual/speedbikes_catalogue_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function moduleToScript(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '')
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|class)/g, '');
}

function loadThresholdPricingRuntime(): any {
  const context: Record<string, unknown> = {};
  vm.createContext(context);
  vm.runInContext(moduleToScript('js/car-pricing.js'), context, { filename: 'js/car-pricing.js' });
  vm.runInContext(moduleToScript('js/car-rental-duration-contract.js'), context, {
    filename: 'js/car-rental-duration-contract.js',
  });
  vm.runInContext(`${moduleToScript('js/car-rental-threshold-pricing.js')}
    globalThis.SpeedBikesPricing = { calculateThresholdCarRentalQuote };`, context, {
    filename: 'js/car-rental-threshold-pricing.js',
  });
  return context.SpeedBikesPricing;
}

const thresholdPricing = loadThresholdPricingRuntime();

function quoteForDays(offer: any, rentalDays: number) {
  const pickup = new Date(Date.UTC(2026, 0, 10, 8, 0, 0));
  const returned = new Date(pickup.getTime() + (rentalDays * 24 * 60 * 60 * 1000));
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const tiers = Object.entries(offer.dailyRates).map(([days, dailyRate]) => ({
    id: offer.tierIds[days],
    offer_id: offer.offerId,
    threshold_days: Number(days),
    daily_rate: dailyRate,
    is_active: true,
  }));
  return thresholdPricing.calculateThresholdCarRentalQuote({
    offer: {
      id: offer.offerId,
      location: 'larnaca',
      pricing_strategy: 'threshold_daily_rate',
      min_rental_days: 1,
      max_rental_days: null,
      currency: 'EUR',
      insurance_mode: offer.insuranceMode,
      insurance_per_day: 0,
      young_driver_fee: false,
      young_driver_cost: 0,
    },
    tiers,
    pickupDateStr: date(pickup),
    pickupTimeStr: '10:00',
    returnDateStr: date(returned),
    returnTimeStr: '10:00',
    pickupCityCode: 'ayia-napa',
    returnCityCode: 'ayia-napa',
    pickupAvailability: { fee_mode: 'override', fee_per_direction: 0 },
    returnAvailability: { fee_mode: 'override', fee_per_direction: 0 },
    fullInsurance: false,
    youngDriver: false,
    carModel: offer.model,
  });
}

describe('SpeedBikes catalogue package', () => {
  test('contains the exact deterministic 22-offer catalogue split', () => {
    expect(manifest.requiredMigrations).toEqual([
      '20260810120000_car_rental_threshold_daily_rate_precision.sql',
      '20260810130000_car_rental_threshold_exact_owner_routing.sql',
    ]);
    expect(manifest.counts).toEqual(expect.objectContaining({
      offers: 22,
      buggy: 10,
      quad: 6,
      scooter: 3,
      bicycle: 3,
      sourcePricedDurations: 145,
      images: 21,
    }));
    expect(manifest.offers).toHaveLength(22);

    const kindCounts = manifest.offers.reduce((counts: Record<string, number>, offer: any) => {
      counts[offer.vehicleKind] = (counts[offer.vehicleKind] || 0) + 1;
      return counts;
    }, {});
    expect(kindCounts).toEqual({ buggy: 10, quad: 6, scooter: 3, bicycle: 3 });
    expect(new Set(manifest.offers.map((offer: any) => offer.offerId)).size).toBe(22);
    expect(new Set(manifest.offers.map((offer: any) => offer.depositOverrideId)).size).toBe(22);
    expect(new Set(manifest.offers.map((offer: any) => offer.slug)).size).toBe(22);

    const tierIds = manifest.offers.flatMap((offer: any) => {
      expect(Object.keys(offer.tierIds)).toEqual(Object.keys(offer.sourceTotals));
      return Object.values(offer.tierIds);
    });
    expect(tierIds).toHaveLength(145);
    expect(new Set(tierIds).size).toBe(145);
    for (const tierId of tierIds) {
      expect(tierId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  test('reproduces every PDF source total after multiplying the selected six-decimal daily rate', () => {
    const mismatches: Array<Record<string, unknown>> = [];
    let checked = 0;

    for (const offer of manifest.offers) {
      expect(Object.keys(offer.dailyRates)).toEqual(Object.keys(offer.sourceTotals));
      for (const [daysText, sourceTotal] of Object.entries(offer.sourceTotals)) {
        const days = Number(daysText);
        const rateText = offer.dailyRates[daysText];
        expect(rateText).toMatch(/^\d+\.\d{6}$/);
        const calculated = roundMoney(Number(rateText) * days);
        checked += 1;
        if (calculated !== Number(sourceTotal)) {
          mismatches.push({ offerId: offer.offerId, days, sourceTotal, rateText, calculated });
        }
      }
    }

    expect(checked).toBe(145);
    expect(mismatches).toEqual([]);
  });

  test('the shared public threshold calculator reproduces all 145 source-priced durations', () => {
    let checked = 0;
    const mismatches: Array<Record<string, unknown>> = [];
    for (const offer of manifest.offers) {
      for (const [daysText, sourceTotal] of Object.entries(offer.sourceTotals)) {
        const rentalDays = Number(daysText);
        const quote = quoteForDays(offer, rentalDays);
        checked += 1;
        if (!quote || quote.basePrice !== Number(sourceTotal) || quote.total !== Number(sourceTotal)) {
          mismatches.push({
            offerId: offer.offerId,
            rentalDays,
            sourceTotal,
            basePrice: quote?.basePrice,
            total: quote?.total,
          });
        }
      }
    }
    expect(checked).toBe(145);
    expect(mismatches).toEqual([]);
  });

  test('uses the approved Polaris continuation rule without a manual-confirmation state', () => {
    const polarises = manifest.offers.filter((offer: any) => offer.polarisContinuationRule);
    expect(polarises).toHaveLength(3);

    for (const offer of polarises) {
      expect(Object.keys(offer.dailyRates).map(Number)).toEqual([1, 2, 3, 4]);
      const lastRate = Number(offer.dailyRates['4']);
      for (const rentalDays of [5, 7, 14]) {
        expect(roundMoney(lastRate * rentalDays)).toBe(
          roundMoney(Number(offer.dailyRates['4']) * rentalDays),
        );
      }
      expect(offer.polarisContinuationRule).toContain('continue the 4-day daily rate');
      expect(JSON.stringify(offer).toLowerCase()).not.toContain('manual quote');
    }
  });

  test('every offer continues its highest active threshold at 8, 10 and 14 days', () => {
    for (const offer of manifest.offers) {
      const thresholds = Object.keys(offer.dailyRates).map(Number).sort((a, b) => a - b);
      const highest = thresholds[thresholds.length - 1];
      const highestRate = Number(offer.dailyRates[String(highest)]);
      for (const rentalDays of [8, 10, 14]) {
        const eligible = thresholds.filter((threshold) => threshold <= rentalDays);
        const selected = eligible[eligible.length - 1];
        expect(selected).toBe(highest);
        const quote = quoteForDays(offer, rentalDays);
        expect(quote).toEqual(expect.objectContaining({
          days: rentalDays,
          thresholdDays: highest,
          dailyRate: highestRate,
          basePrice: roundMoney(highestRate * rentalDays),
          total: roundMoney(highestRate * rentalDays),
        }));
      }
    }
  });

  test('catalogue quotes retain final-total ascending ordering', () => {
    for (const rentalDays of [1, 2, 3, 4, 5, 6, 7, 8, 10, 14]) {
      const quotes = manifest.offers.map((offer: any) => {
        const thresholds = Object.keys(offer.dailyRates).map(Number).sort((a, b) => a - b);
        const eligible = thresholds.filter((threshold) => threshold <= rentalDays);
        const selected = eligible[eligible.length - 1];
        return {
          offerId: offer.offerId,
          total: roundMoney(Number(offer.dailyRates[String(selected)]) * rentalDays),
        };
      }).sort((left: any, right: any) => left.total - right.total || left.offerId.localeCompare(right.offerId));

      for (let index = 1; index < quotes.length; index += 1) {
        expect(quotes[index].total).toBeGreaterThanOrEqual(quotes[index - 1].total);
      }
      expect(new Set(quotes.map((quote: any) => quote.offerId)).size).toBe(22);
    }
  });

  test('keeps the safe draft, payment, availability and partner defaults explicit', () => {
    expect(manifest.partner).toEqual(expect.objectContaining({
      id: '583ee90b-d77c-47ff-97a4-76657a87809f',
      name: 'Speed Bikes',
      sourceEmail: 'speedbikes17@gmail.com',
      verifiedProductionOwnerUserEmail: 'speedbikes17@gmail.com',
      status: 'active',
      canManageCars: true,
    }));
    expect(manifest.importDefaults).toEqual(expect.objectContaining({
      pricingStrategy: 'threshold_daily_rate',
      availabilityMode: 'legacy',
      isAvailable: false,
      isPublished: false,
      submissionStatus: 'draft',
      minimumRentalDays: 1,
      maximumRentalDays: null,
      initialCityCode: 'ayia-napa',
      cityFeeMode: 'override',
      cityFeePerDirection: 0,
      depositMode: 'percent_total',
      depositAmount: 15,
      youngDriverEnabled: false,
      youngDriverCost: 0,
    }));
    expect(roundMoney(490 * 0.15)).toBe(73.5);
    expect(roundMoney(490 - 73.5)).toBe(416.5);
  });

  test('ships a deterministic fail-closed manual SQL package and a read-only activation checklist', () => {
    const seed = fs.readFileSync(path.join(root, 'supabase/manual/speedbikes_catalogue_seed.sql'), 'utf8');
    const verify = fs.readFileSync(path.join(root, 'supabase/manual/speedbikes_catalogue_verify.sql'), 'utf8');
    const activation = fs.readFileSync(
      path.join(root, 'supabase/manual/speedbikes_catalogue_activation_checklist.sql'),
      'utf8',
    );

    expect(seed.trimStart()).toMatch(/^-- speedbikes-catalogue-seed-v1/);
    expect(seed).toContain('begin;');
    expect(seed.trimEnd()).toMatch(/commit;$/);
    expect(seed).toContain("v_legacy_fingerprint <> 'ec3e29a35f249c92279d7b15f400ef0f'");
    expect(seed).toContain("'583ee90b-d77c-47ff-97a4-76657a87809f'::uuid");
    expect(seed).toContain("'percent_total'");
    expect(seed).toContain("'override'");
    expect(seed).toContain("'legacy'");
    expect(seed).not.toMatch(/update\s+public\.site_settings/i);
    expect(seed).toContain('lock table public.car_offers in share row exclusive mode');
    expect(seed).toContain('speedbikes_exact_owner_routing_migration_required');
    expect(seed).toContain('speedbikes_exact_owner_routing_mismatch');
    expect(seed).not.toMatch(/"en":\s*"[^"\n]*PARTNER CONFIRMED/i);

    for (const offer of manifest.offers) {
      expect(seed).toContain(offer.offerId);
      expect(seed).toContain(offer.depositOverrideId);
      expect(verify).toContain(offer.offerId);
      for (const tierId of Object.values(offer.tierIds) as string[]) {
        expect(seed).toContain(tierId);
        expect(verify).toContain(tierId);
      }
    }

    expect(verify).toContain('speedbikes_source_price_mismatch');
    expect(verify).toContain('legacy_price_mismatch');
    expect(verify).toContain('duplicate_offer_threshold_groups');
    expect(verify).toContain('unexplained_difference');
    expect(verify).toContain('exact_owner_routing_count');
    expect(verify).toContain('speedbikes_catalogue_safe');

    const executableActivation = activation
      .replace(/^\s*--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(executableActivation).not.toMatch(/\b(insert|update|delete|merge|truncate|alter|drop|create|call)\b/i);
    expect(executableActivation).toMatch(/^\s*with\b/i);
    expect(executableActivation.trimEnd()).toMatch(/;$/);
  });

  test('maps exactly 21 embedded vehicle photos and preserves the missing Group B image', () => {
    const withImages = manifest.offers.filter((offer: any) => offer.imageUrl);
    const withoutImages = manifest.offers.filter((offer: any) => !offer.imageUrl);
    expect(withImages).toHaveLength(21);
    expect(withoutImages.map((offer: any) => offer.slug)).toEqual(['bicycle-group-b']);
    expect(withoutImages[0]).toEqual(expect.objectContaining({
      pdfPage: 24,
      imageSource: 'NO SOURCE PHOTO',
      imageFilename: null,
      imageUrl: null,
    }));

    for (const offer of withImages) {
      expect(offer.imageSource).toBe(`PDF page ${offer.pdfPage} embedded 1000x1000 vehicle photograph`);
      expect(offer.imageUrl).toBe(`/assets/images/cars/speedbikes/${offer.imageFilename}`);
      const assetPath = path.join(root, offer.imageUrl.replace(/^\//, ''));
      const file = fs.readFileSync(assetPath);
      expect(file.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(file.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(file.byteLength).toBeGreaterThan(20_000);
    }
  });

  test('does not fabricate unknown bicycle or catalogue terms', () => {
    const bicycles = manifest.offers.filter((offer: any) => offer.vehicleKind === 'bicycle');
    for (const offer of bicycles) {
      expect(offer.engineCapacityCc).toBeNull();
      expect(offer.maxPassengers).toBeNull();
      expect(offer.drive).toBeNull();
      expect(offer.transmission).toBeNull();
      expect(offer.fuelType).toBeNull();
      expect(offer.requiredLicenceCategory).toBeNull();
      expect(offer.insuranceMode).toBe('not_offered');
    }
    expect(bicycles.find((offer: any) => offer.slug === 'bicycle-group-c')?.bicycleGears).toBeNull();

    const unknown = manifest.explicitlyUnknown.join('|').toLowerCase();
    expect(unknown).toContain('late-return hourly amount');
    expect(unknown).toContain('maximum rental duration');
    expect(unknown).toContain('bicycle passenger capacity');
  });
});
