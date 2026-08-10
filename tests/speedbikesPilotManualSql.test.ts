import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const compact = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

describe('SpeedBikes production cleanup and one-offer pilot SQL', () => {
  const cleanup = read('supabase/manual/speedbikes_unexpected_protaras_cleanup.sql');
  const activate = read('supabase/manual/speedbikes_snipper_fx_pilot_activate.sql');
  const rollback = read('supabase/manual/speedbikes_snipper_fx_pilot_rollback.sql');
  const verify = read('supabase/manual/speedbikes_catalogue_verify.sql');
  const draftVerify = read('supabase/manual/speedbikes_catalogue_draft_state_verify.sql');
  const pilotVerify = read('supabase/manual/speedbikes_snipper_fx_pilot_verify.sql');
  const capabilityEnable = read('supabase/manual/speedbikes_capabilities_enable.sql');

  test('cleanup targets only the five audited Protaras composite keys', () => {
    const sql = compact(cleanup);
    const exactIds = [
      'afd191d3-bbbf-5c7a-a8a1-12bde793ace1',
      '2817e6de-25ba-5237-b721-dbc0460a7de4',
      'ef800460-cfef-57c1-b3cd-7269f366b00c',
      'd78cee10-c980-5445-b59b-a7006f2f8718',
      '670f9df5-f9ac-5e38-821a-ac21847ff16d',
    ];

    exactIds.forEach((id) => expect(cleanup).toContain(id));
    expect(sql).toContain("protaras_id constant uuid := 'ca200001-0000-4000-8000-000000000004'");
    expect(sql.match(/delete from public\.car_offer_city_availability/g)).toHaveLength(1);
    expect(sql).not.toContain('delete from public.car_offers');
    expect(sql).not.toContain('delete from public.car_offer_daily_rate_tiers');
    expect(sql).not.toContain('delete from public.service_deposit_overrides');
    expect(sql).toContain('unexpected-city count is no longer exactly five');
    expect(sql).toContain('the 22 ayia napa rows are not intact');
    expect(sql).toContain('existing 12 legacy availability rows changed');
    expect(sql).toContain('both global flags must be false');
    expect(sql).toContain('historical exact-five cleanup');
    expect(sql).toContain('not reusable for a different row set');
  });

  test('activation is exact-Snipper, stock-gated and checks every required contract', () => {
    const sql = compact(activate);

    expect(sql).toContain('fallback only');
    expect(sql).toContain('primary path: first run the separately approved flags-only');
    expect(sql).toContain('changes only the exact snipper offer; it never changes global flags');
    expect(sql).toContain("snipper_id constant uuid := 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'");
    expect(sql).toContain('offer.stock_count > 0');
    expect(sql).toContain("offer.availability_mode = 'legacy'");
    expect(sql).toContain("set availability_mode = 'mapped'");
    expect(sql).toContain("submission_status = 'approved'");
    expect(sql).toContain('car_multi_city_mapped_enabled is not true');
    expect(sql).toContain('car_threshold_daily_rates_enabled is not true');
    expect(sql).toContain("tier.threshold_days <= expected.rental_days");
    expect(sql).toContain('(14, 980.00::numeric)');
    expect(sql).toContain("override_row.mode = 'percent_total'");
    expect(sql).toContain('override_row.amount = 15');
    expect(sql).toContain('partner_service_fulfillment_partner_id_for_car_booking');
    expect(sql).toContain("partner_service_fulfillment_partner_id_for_car_booking(snipper_id, 'ayia-napa')");
    expect(sql).toContain('all 22 exact ayia napa request routes are required');
    expect(sql).toContain("car_threshold_offer_route_is_public_eligible( snipper_id, 'ayia-napa', 'ayia-napa' )");
    expect(sql).toContain('additional admin-reviewed directional rows are legitimate');
    expect(sql).not.toContain('ayia napa-only availability');
    expect(sql).not.toContain('where availability.offer_id = any(speedbikes_ids) ) <> 22');
    expect(sql).toContain('where id = snipper_id');
    expect(sql).not.toContain('update public.site_settings');
    expect(sql).not.toMatch(/insert\s+into\s+public\.car_bookings/);
    expect(sql).not.toMatch(/insert\s+into\s+public\.partner_service_fulfillments/);
    expect(sql).not.toContain('update public.service_deposit_overrides');
    expect(sql).not.toContain('update public.car_offer_daily_rate_tiers');
  });

  test('rollback unpublishes only Snipper and preserves operational state and flags', () => {
    const sql = compact(rollback);

    expect(sql).toContain("snipper_id constant uuid := 'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'");
    expect(sql).toContain('exact snipper public unpublish only');
    expect(sql).toContain('every operational offer field except is_published');
    expect(sql).toContain('set is_published = false');
    expect(sql).not.toContain("set availability_mode = 'legacy'");
    expect(sql).not.toContain("submission_status = 'draft'");
    expect(sql).not.toContain('is_available = false');
    expect(sql).toContain('non-publication offer field changed');
    expect(sql).toContain('where id = snipper_id');
    expect(sql).not.toContain('stock_count =');
    expect(sql).not.toContain('delete from');
    expect(sql).not.toContain('update public.service_deposit_overrides');
    expect(sql).not.toContain('update public.site_settings');
    expect(sql).not.toContain('update public.car_offer_city_availability');
    expect(sql).not.toContain('update public.car_offer_daily_rate_tiers');
    expect(sql).not.toContain('another active mapped threshold offer exists');
    expect(sql).toContain('other_mapped_threshold_offers_preserved');
    expect(sql).toContain('manual_offer_review_required');
  });

  test('catalogue integrity verify tolerates deliberate activation state changes', () => {
    const sql = compact(verify);
    const safeAlias = verify.indexOf('as speedbikes_catalogue_safe');
    const predicateStart = verify.lastIndexOf('\n    (', safeAlias);
    const safePredicate = compact(verify.slice(predicateStart, safeAlias));
    const unexplainedAlias = verify.indexOf('as unexplained_difference');
    const unexplainedStart = verify.lastIndexOf('\n    (', unexplainedAlias);
    const unexplainedPredicate = compact(verify.slice(unexplainedStart, unexplainedAlias));

    expect(sql).toContain('additional_configured_city_count');
    expect(sql).toContain('unexplained_difference');
    expect(sql).toContain('speedbikes_catalogue_safe');
    expect(sql).toContain('availability.exact_ayia_napa_count = 22');
    expect(sql).toContain('additional cities -- configured deliberately in admin are reported for review');
    expect(sql).toContain('continuation.mismatch_count');
    expect(sql).toContain('deliberate operational changes');
    expect(unexplainedPredicate).not.toContain('availability.additional_configured_city_count');
    expect(safePredicate).not.toContain('availability.additional_configured_city_count');
    expect(safePredicate).not.toContain('offers.legacy_mode_count');
    expect(safePredicate).not.toContain('offers.unpublished_count');
    expect(safePredicate).not.toContain('offers.unavailable_count');
    expect(safePredicate).not.toContain('offers.draft_count');
    expect(safePredicate).not.toContain('flags.mapped_enabled');
    expect(safePredicate).not.toContain('flags.threshold_enabled');
    expect(safePredicate).not.toContain('bookings.speedbikes_booking_count');
    expect(safePredicate).not.toContain('fulfillments.speedbikes_fulfillment_count');
  });

  test('strict draft verify preserves the optional untouched-import gate', () => {
    const sql = compact(draftVerify);

    expect(sql).toContain('speedbikes-catalogue-draft-state-verify-v1');
    expect(sql).toContain('speedbikes_draft_state_safe');
    expect(sql).toContain('offers.legacy_mode_count = 22');
    expect(sql).toContain('offers.unpublished_count = 22');
    expect(sql).toContain('offers.unavailable_count = 22');
    expect(sql).toContain('offers.draft_count = 22');
    expect(sql).toContain('offers.zero_stock_count = 22');
    expect(sql).toContain('flags.both_flags_off_count = 1');
    expect(sql).toContain('availability.total_row_count = 22');
    expect(sql).toContain('availability.exact_ayia_napa_count = 22');
    expect(sql).toContain('availability.additional_configured_city_count = 0');
    expect(sql).toContain("legacy.protected_fingerprint = 'ec3e29a35f249c92279d7b15f400ef0f'");
    expect(sql).not.toMatch(/\b(insert|update|delete|alter|drop|create|call)\s+(?:into\s+|from\s+|table\s+)?public\./i);
  });

  test('exact Snipper pilot verify covers live state, prices and manual partner lifecycle', () => {
    const sql = compact(pilotVerify);

    expect(sql).toContain("'afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid as snipper_id");
    expect(sql).toContain('snipper_fx_pilot_live_safe');
    expect(sql).toContain('active_threshold.active_mapped_public_count = 1');
    expect(sql).toContain('other_offers.inert_draft_count = 21');
    expect(sql).toContain('prices.case_count = 14');
    expect(sql).toContain('prices.mismatch_count = 0');
    expect(sql).toContain('route.exact_ayia_napa_route_eligible');
    expect(sql).not.toContain('availability.total_row_count = 1');
    expect(sql).toContain('booking_advanced_without_partner_acceptance = 0');
    expect(sql).toContain('paid_booking_not_pending_partner_acceptance = 0');
    expect(sql).toContain("pending_fulfillment.status = 'pending_acceptance'");
    expect(sql).toContain('fulfillment_routing_mismatch = 0');
    expect(sql).toContain('false as availability_automatically_accepts_booking');
    expect(sql).not.toMatch(/\b(insert|update|delete|alter|drop|create|call)\s+(?:into\s+|from\s+|table\s+)?public\./i);
  });

  test('capability enable changes only flags before exact Admin activation', () => {
    const sql = compact(capabilityEnable);
    const updates = [...sql.matchAll(/update\s+public\.([a-z0-9_]+)/g)].map((match) => match[1]);

    expect(updates).toEqual(['site_settings']);
    expect(sql).toContain('deliberately catalogue-agnostic');
    expect(sql).toContain("offer.availability_mode = 'mapped' and offer.is_published");
    expect(sql).toContain('a published mapped offer could become public when flags change');
    expect(sql).toContain('set car_multi_city_mapped_enabled = true, car_threshold_daily_rates_enabled = true');
    expect(sql).toContain('offer_activation_performed');
    expect(sql).toContain('exact_admin_activation_may_now_be_reviewed');
    expect(sql).toContain('false as booking_automatically_accepted');
    expect(sql).toContain('a car offer changed');
    expect(sql).not.toContain('afd191d3-bbbf-5c7a-a8a1-12bde793ace1');
    expect(sql).not.toContain('ayia-napa');
    expect(sql).not.toContain('stock_count > 0');
    expect(sql).not.toContain('or offer.is_available');
    expect(sql).not.toMatch(/\b(insert|delete|merge|truncate|alter|drop|create|call)\s+(?:into\s+|from\s+|table\s+)?public\./i);
    expect(sql).not.toContain('update public.car_offers');
  });
});
