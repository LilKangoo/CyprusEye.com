import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadPresentation(): any {
  const filename = path.join(process.cwd(), 'js/car-rental-public-presentation.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/export\s+function\s+/g, 'function ')
    .concat(`\n;globalThis.CarRentalPublicPresentation = {
      normalizeCarPublicLanguage,
      carPublicText,
      resolveCarSecurityDepositPresentation,
      resolveThresholdInsurancePresentation,
      resolveGenericVehicleCopy,
    };`);
  const context: Record<string, unknown> = { Intl };
  vm.runInNewContext(source, context, { filename });
  return context.CarRentalPublicPresentation;
}

const presentation = loadPresentation();

describe('public vehicle presentation contract', () => {
  test('renders only explicit security-deposit claims and ignores booking-payment state', () => {
    expect(presentation.resolveCarSecurityDepositPresentation({
      deposit_amount: null,
      depositOverride: { mode: 'percent_total', amount: 15 },
    }, 'en')).toEqual({ state: 'unspecified', visible: false, amount: null, label: '' });

    expect(presentation.resolveCarSecurityDepositPresentation({ deposit_amount: 0 }, 'en')).toEqual({
      state: 'none', visible: true, amount: 0, label: '✓ No Deposit',
    });
    expect(presentation.resolveCarSecurityDepositPresentation({ deposit_amount: 300 }, 'en')).toEqual({
      state: 'amount', visible: true, amount: 300, label: 'Deposit €300',
    });
    expect(presentation.resolveCarSecurityDepositPresentation({ deposit_amount: 300 }, 'pl').label).toBe('Kaucja 300€');
    expect(presentation.resolveCarSecurityDepositPresentation({ deposit_amount: 300 }, 'he').label).toBe('פיקדון €300');
  });

  test('uses safe exact-offer insurance copy without claiming full insurance', () => {
    expect(presentation.resolveThresholdInsurancePresentation({ insurance_mode: 'included' }, 'en')).toEqual(expect.objectContaining({
      mode: 'included', selectable: false, included: true, label: 'Insurance included',
    }));
    expect(presentation.resolveThresholdInsurancePresentation({ insurance_mode: 'not_offered' }, 'en')).toEqual(expect.objectContaining({
      mode: 'not_offered', selectable: false, included: false,
    }));
    expect(presentation.resolveThresholdInsurancePresentation({ insurance_mode: 'optional_daily', insurance_per_day: 12.5 }, 'en')).toEqual(expect.objectContaining({
      mode: 'optional_daily', selectable: true, dailyRate: 12.5, label: 'Optional insurance (+€12.50/day)',
    }));
  });

  test('provides PL/EN/HE generic vehicle terminology', () => {
    expect(presentation.resolveGenericVehicleCopy('pl').selected).toBe('Wybrany pojazd');
    expect(presentation.resolveGenericVehicleCopy('en').reserve).toBe('Reserve this vehicle');
    expect(presentation.resolveGenericVehicleCopy('he').select).toBe('בחרו כלי רכב');
  });
});
