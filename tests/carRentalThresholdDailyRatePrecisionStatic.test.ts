import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('threshold daily-rate six-decimal precision correction', () => {
  const migration = read('supabase/migrations/20260810120000_car_rental_threshold_daily_rate_precision.sql');
  const verify = read('supabase/manual/car_rental_threshold_daily_rate_precision_verify.sql');
  const finalVerify = read('supabase/manual/car_rental_flexible_pricing_final_verify.sql');
  const core = read('admin/car-rental-multicity-core.js');
  const ui = read('admin/car-rental-multicity-ui.js');
  const runtime = read('js/car-rental-threshold-pricing.js');

  test('migration is independently applicable, transactional and fails closed with both activation flags off', () => {
    expect(migration).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(migration.trim()).toMatch(/commit;$/i);
    expect(migration).toContain('alter column daily_rate type numeric(12,6)');
    expect(migration).toContain("v_daily_rate_type not in ('numeric(12,2)', 'numeric(12,6)')");
    expect(migration).toContain('car_threshold_daily_rates_enabled is true');
    expect(migration).toContain('car_multi_city_mapped_enabled is true');
    expect(migration).not.toMatch(/update\s+public\.car_offers/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.car_offer_daily_rate_tiers/i);
    expect(migration).not.toMatch(/update\s+public\.site_settings/i);
  });

  test('database quote contracts retain the six-decimal tier and round only the multiplied amount', () => {
    expect(migration).toContain('round(v_tier.daily_rate * v_days, 2)');
    expect(migration).toContain('v_rental_base := round(v_tier.daily_rate * v_rental_days, 2)');
    expect(migration).toContain("'''daily_rate'', v_tier.daily_rate'");
    expect(verify).toContain('93.333333::numeric(12,6) * 3');
    expect(verify).toContain('5.285714::numeric(12,6) * 7');
    expect(verify).toContain('threshold_daily_rate_precision_safe');
    expect(finalVerify).toContain("format_type(attribute.atttypid, attribute.atttypmod) = 'numeric(12,6)'");
  });

  test('Admin accepts, preserves and presents up to six decimals without changing cent precision elsewhere', () => {
    expect(core).toContain('function normalizeDailyRate(value, fallback = null)');
    expect(core).toContain('Math.round(parsed * 1000000) / 1000000');
    expect(core).toContain('at most six decimals');
    expect(ui).toContain('step="0.000001"');
    expect(ui).toContain('Number(value).toFixed(6)');
    expect(ui).toContain('base rental price');
    expect(core).toContain('baseRentalPrice: normalizeMoney(tier.daily_rate * days)');
  });

  test('public runtime keeps daily-rate precision until final customer-money rounding', () => {
    expect(runtime).toContain('const DAILY_RATE_PRECISION = 1000000');
    expect(runtime).toContain('dailyRate: dailyRate(tier?.daily_rate)');
    expect(runtime).toContain('const basePrice = money(tier.dailyRate * rentalDays)');
    expect(runtime).not.toContain('dailyRate: money(tier?.daily_rate)');
  });
});
