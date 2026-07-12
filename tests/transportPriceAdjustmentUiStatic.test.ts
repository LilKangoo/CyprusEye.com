import fs from 'node:fs';
import path from 'node:path';

describe('Transport Price 4.0C-E UI and email integration', () => {
  const root = process.cwd();
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const normalize = (value: string) => value.replace(/\s+/g, ' ').toLowerCase();

  const admin = read('admin/admin.js');
  const dashboard = read('js/dashboard.js');
  const deposit = read('js/deposit.js');
  const partners = read('js/partners.js');
  const bookingAccess = read('supabase/functions/booking-access/index.ts');
  const sendAdminNotification = read('supabase/functions/send-admin-notification/index.ts');

  const functionSlice = (source: string, name: string) => {
    const marker = `function ${name}`;
    const start = source.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = source.slice(start + marker.length);
    const next = rest.search(/\n(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/);
    return source.slice(start, next === -1 ? source.length : start + marker.length + next);
  };

  test('admin adjustment writes only through the guarded RPC', () => {
    expect(admin).toContain("db.rpc('admin_adjust_transport_booking_price'");
    expect(admin).toContain('p_expected_revision');
    expect(admin).toContain('p_idempotency_key');
    expect(admin).toContain('get_transport_booking_financial_summary');
    expect(admin).not.toContain('admin_get_transport_booking_price_adjustments');
    expect(admin).not.toMatch(/\.from\(['"]transport_bookings['"]\)\s*[\s\S]{0,220}\.update\(\s*\{[\s\S]{0,220}adjusted_total_price/i);
    expect(admin).not.toMatch(/\.from\(['"]transport_bookings['"]\)\s*[\s\S]{0,220}\.update\(\s*\{[\s\S]{0,220}price_revision/i);
    expect(admin).not.toMatch(/\.from\(['"]transport_bookings['"]\)\s*[\s\S]{0,220}\.update\(\s*\{[\s\S]{0,220}price_adjusted_at/i);
    const submit = functionSlice(admin, 'submitTransportPriceAdjustment');
    expect(submit).toContain('p_customer_note: null');
  });

  test('transport totals never add return_total_price on the frontend', () => {
    [admin, dashboard, deposit, partners].forEach((source) => {
      const compact = normalize(source);
      expect(compact).not.toMatch(/total_price.{0,120}\+.{0,120}return_total_price/);
      expect(compact).not.toMatch(/return_total_price.{0,120}\+.{0,120}total_price/);
    });
  });

  test('admin list uses row-level effective total and avoids summary N+1', () => {
    expect(admin).toContain('function transportBookingEffectiveTotal');
    expect(admin).toContain('transportBookingEffectiveTotal(row)');
    expect(admin).toContain('fetchTransportBookingFinancialSummary(client, id, booking)');
    expect(admin).not.toMatch(/rows\.map\([\s\S]{0,260}get_transport_booking_financial_summary/i);
  });

  test('customer and partner surfaces consume role-safe financial summary without admin-only fields', () => {
    expect(dashboard).toContain("supabase.rpc('get_transport_booking_financial_summary'");
    expect(partners).toContain("state.sb.rpc('get_transport_booking_financial_summary'");
    expect(dashboard).not.toContain('internal_reason');
    expect(partners).not.toContain('internal_reason');
    expect(dashboard).not.toContain('admin_get_transport_booking_price_adjustments');
    expect(partners).not.toContain('admin_get_transport_booking_price_adjustments');
  });

  test('standard admin, customer and partner UI do not disclose price adjustment state', () => {
    const adminDetails = functionSlice(admin, 'viewTransportBookingDetails');
    const forbiddenCustomerPartnerText = [
      'Original price',
      'Current final price',
      'Overpayment / refund review',
      'price changed',
      'previous price',
      'old price',
      'new price',
      'refund review required',
      'customer adjustment note',
    ];
    const forbiddenAdminDetailsText = [
      'Original total',
      'Adjusted total',
      'Current final total',
      'Original quote',
      'Adjustment history',
      'Customer note',
      'Revision<br>',
      'price adjustment',
    ];

    forbiddenCustomerPartnerText.forEach((text) => {
      expect(dashboard).not.toContain(text);
      expect(partners).not.toContain(text);
    });
    forbiddenAdminDetailsText.forEach((text) => {
      expect(adminDetails).not.toContain(text);
    });
    expect(adminDetails).toContain('Change price');
    expect(adminDetails).toContain('Total price');
    expect(adminDetails).not.toContain('<span>Base:</span>');
    expect(adminDetails).not.toContain('Coupon ${transportCouponCode');
    expect(dashboard).toContain('Paid in full');
    expect(partners).toContain('Paid in full');
  });

  test('deposit email link page fetches current backend totals instead of query prices', () => {
    expect(deposit).toContain("supabase.rpc('get_service_deposit_status'");
    expect(deposit).not.toContain("params.get('total')");
    expect(deposit).not.toContain("params.get('amount')");
    expect(deposit).toContain('const totalPrice = totalFromRow');
  });

  test('yourbooking email preview uses current transport deposit status for effective totals', () => {
    expect(bookingAccess).toContain('async function buildTransportMoneyObject');
    expect(bookingAccess).toContain('.rpc("get_service_deposit_status"');
    expect(bookingAccess).toContain('(data as any).booking_total_price');
    expect(bookingAccess).toContain('paidStatus ? (data as any).amount : 0');
    expect(bookingAccess).toContain('base.money = await buildTransportMoneyObject(supabase, booking, deposit)');
    const transportBranch = bookingAccess.slice(
      bookingAccess.indexOf('if (bookingType === "transport")'),
      bookingAccess.indexOf('} else if (bookingType === "cars")')
    );
    expect(transportBranch).not.toMatch(/moneyObject\(\s*\{[\s\S]{0,240}total:\s*\(booking as any\)\.total_price/i);
  });

  test('price save does not invoke email or payment side effects', () => {
    const submit = functionSlice(admin, 'submitTransportPriceAdjustment');
    expect(submit).not.toMatch(/send_deposit_email|send.*email|functions\.invoke|stripe\.|checkout\.sessions|paymentintents|refunds\./i);
    expect(submit).not.toMatch(/service_deposit_requests|affiliate_commission_events|affiliate_payouts|partner_service_fulfillments/i);
    expect(submit).toContain("console.error('Failed to adjust transport booking price:', error)");
    expect(submit).toContain("const message = 'Could not save price. Please try again.'");
    expect(submit).not.toContain("const message = String(error?.message || 'Failed to save price')");
  });

  test('existing transport emails use effective totals from backend financial summary only', () => {
    const emailHydrator = functionSlice(sendAdminNotification, 'hydrateTransportFinancialSummaryForEmail');
    expect(emailHydrator).toContain('.rpc("service_get_transport_booking_financial_summary"');
    expect(emailHydrator).not.toContain('.rpc("get_transport_booking_financial_summary"');
    expect(emailHydrator).toContain('p_booking_id: bookingId');
    expect(emailHydrator).toContain('(record as any).total_price = effectiveTotal');
    expect(emailHydrator).toContain('(record as any).confirmed_paid_gross = confirmedPaidGross');
    expect(emailHydrator).toContain('(record as any).balance_due = balanceDue');
    expect(emailHydrator).toContain('clearTransportEmailFinancialFields(record)');

    const partnerPendingStart = sendAdminNotification.indexOf('if (event === "partner_pending_acceptance") {\n    if (!record)');
    expect(partnerPendingStart).toBeGreaterThanOrEqual(0);
    const partnerPendingEnd = sendAdminNotification.indexOf('if (event === "customer_deposit_requested")', partnerPendingStart);
    expect(partnerPendingEnd).toBeGreaterThan(partnerPendingStart);
    const partnerPendingBranch = sendAdminNotification.slice(partnerPendingStart, partnerPendingEnd);
    expect(partnerPendingBranch).toContain('await hydrateTransportFinancialSummaryForEmail(supabase, record)');

    const customerReceivedBranch = sendAdminNotification.slice(
      sendAdminNotification.indexOf('if (event === "customer_received")'),
      sendAdminNotification.indexOf('const adminNotificationEmailRaw')
    );
    expect(customerReceivedBranch).toContain('await hydrateTransportFinancialSummaryForEmail(supabase, record)');

    const templateVariables = functionSlice(sendAdminNotification, 'buildAdminNotificationTemplateVariables');
    expect(templateVariables).toContain('"total_price"');
    expect(sendAdminNotification).not.toMatch(/total_price.{0,120}\+.{0,120}return_total_price/i);
    expect(sendAdminNotification).not.toMatch(/return_total_price.{0,120}\+.{0,120}total_price/i);
  });

  test('price adjustment does not introduce any transport price-change email notification', () => {
    const submit = functionSlice(admin, 'submitTransportPriceAdjustment');
    expect(sendAdminNotification).not.toContain('admin_adjust_transport_booking_price');
    expect(sendAdminNotification).not.toMatch(/price updated|price-updated|top-up email|balance adjustment|price change notification/i);
    expect(submit).not.toMatch(/price updated|price-updated|top-up email|balance adjustment|price change notification/i);
  });

  test('payment, Stripe, commission and payout tables are not modified by 4.0C-D frontend changes', () => {
    const adjustmentSubmit = functionSlice(admin, 'submitTransportPriceAdjustment');
    const adminSummary = functionSlice(admin, 'fetchTransportBookingFinancialSummary');
    const customerSummary = functionSlice(dashboard, 'fetchTransportFinancialSummaries');
    const partnerSummary = functionSlice(partners, 'loadTransportFinancialSummariesByBookingId');
    const scopedSources = [adjustmentSubmit, adminSummary, customerSummary, partnerSummary, deposit].join('\n');
    expect(scopedSources).not.toMatch(/\.from\(['"]service_deposit_requests['"]\)\s*[\s\S]{0,180}\.(update|insert|upsert|delete)\(/i);
    expect(scopedSources).not.toMatch(/\.from\(['"]affiliate_commission_events['"]\)\s*[\s\S]{0,180}\.(update|insert|upsert|delete)\(/i);
    expect(scopedSources).not.toMatch(/\.from\(['"]affiliate_payouts['"]\)\s*[\s\S]{0,180}\.(update|insert|upsert|delete)\(/i);
    expect(scopedSources).not.toMatch(/stripe\.(paymentintents|checkout|refunds)/i);
  });
});
