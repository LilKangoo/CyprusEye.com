import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Cars exact-offer selection safety', () => {
  const paphos = read('js/car-rental-paphos.js');
  const landing = read('js/car-rental-landing.js');
  const modal = read('js/car-offer-modal.js');
  const reservation = read('js/car-reservation.js');

  test('an explicit offer ID never falls back to a same-model fleet row', () => {
    const quoteFinder = paphos.slice(
      paphos.indexOf('function findFleetCarForQuote'),
      paphos.indexOf('function getSelectedOfferIdFromSelect'),
    );
    expect(quoteFinder).toContain('return findCurrentFleetCarByOfferId(normalizedOfferId)');
    expect(quoteFinder).not.toMatch(/findCurrentFleetCarByOfferId[\s\S]*if\s*\(byId\)[\s\S]*findCurrentFleetCarByModel/);

    const modalFinder = modal.slice(
      modal.indexOf('function installCarOfferLookup'),
      modal.indexOf('function buildPricingMapForLocation'),
    );
    expect(modalFinder).toContain("return cars.find((item) => String(item?.id || '') === normalizedOfferId) || null");
    expect(modalFinder).toContain('matches.some((item) => requiresExactOfferContext(item))');
  });

  test('model fallback remains legacy-only and ambiguous configured models fail closed', () => {
    const modelFinder = paphos.slice(
      paphos.indexOf('export function findCurrentFleetCarByModel'),
      paphos.indexOf('function getCurrentYoungDriverSelected'),
    );
    expect(modelFinder).toContain('matches.some((car) => requiresExactFleetOffer(car))');
    expect(modelFinder).toContain("pricing_strategy || 'legacy_compat'");
    expect(modelFinder).toContain("=== 'legacy_compat'");
    expect(paphos).toContain("String(context?.availabilityMode || '').trim() === 'mapped'");
  });

  test('landing deep links and cards use exact ID whenever one is present', () => {
    expect(landing).toContain('const matched = targetOfferId');
    expect(landing).toContain('? (selectByOfferId(calculatorSelect) || selectByOfferId(reservationSelect))');
    expect(landing).toContain('function resolveSelectedLandingCar(offerId, carModel)');
    expect(landing).toContain('if (normalizedOfferId) return findCurrentFleetCarByOfferId(normalizedOfferId)');
    expect(landing).not.toMatch(/findCurrentFleetCarByOfferId\([^)]*\)\s*\|\|\s*findCurrentFleetCarByModel/);
  });

  test('modal and reservation require a matching exact context for configured offers', () => {
    expect(modal).toContain('if (!car || !hasValidExactOfferContext(car)) return');
    expect(modal).toContain("String(context?.offerId || '').trim() === offerId");
    expect(modal).toContain('requiresExactOfferContext(car)');
    expect(modal).toContain("String(car?.availability_mode || '').trim() === 'mapped' && !!context");

    expect(reservation).toContain("String(offerRow?.id || '').trim() !== normalizedOfferId");
    expect(reservation).toContain('if (!normalizedOfferId && requiresExactOfferSelection(offerRow)) return null');
    expect(reservation).toContain('if (!selectedOfferRow)');
    expect(reservation).toContain('could not be verified by its exact ID');
  });
});
