import fs from 'node:fs';
import path from 'node:path';

describe('deposit request reliability', () => {
  const repoRoot = process.cwd();
  const fulfillmentActionSource = fs.readFileSync(
    path.join(repoRoot, 'supabase/functions/partner-fulfillment-action/index.ts'),
    'utf8',
  );
  const notificationSource = fs.readFileSync(
    path.join(repoRoot, 'supabase/functions/send-admin-notification/index.ts'),
    'utf8',
  );
  const adminSource = fs.readFileSync(path.join(repoRoot, 'admin/admin.js'), 'utf8');
  const partnerSource = fs.readFileSync(path.join(repoRoot, 'js/partners.js'), 'utf8');
  const stripeWebhookSource = fs.readFileSync(
    path.join(repoRoot, 'supabase/functions/stripe-webhook/index.ts'),
    'utf8',
  );

  it('derives transport deposit requirement from server-side booking and route pricing state', () => {
    expect(fulfillmentActionSource).toContain('resolveServiceAcceptanceDepositState');
    expect(fulfillmentActionSource).toContain('.from("transport_bookings")');
    expect(fulfillmentActionSource).toContain('resolveTransportDepositQuote');
    expect(fulfillmentActionSource).toContain('.from("transport_pricing_rules")');
    expect(fulfillmentActionSource).toContain('estimateTransportServiceRuleDeposit');
    expect(fulfillmentActionSource).toContain('service_deposit_rule');
    expect(fulfillmentActionSource).toContain('deposit_base_floor');
    expect(fulfillmentActionSource).toContain('paymentStatus !== "paid"');
  });

  it('can recover transport deposit links from the quoted booking deposit even without mirrored generic rules', () => {
    expect(fulfillmentActionSource).toContain('quotedTransportDeposit');
    expect(fulfillmentActionSource).toContain('Deposit rule not configured');
    expect(fulfillmentActionSource).toContain('!(category === "transport" && quotedTransportDeposit > 0)');
    expect(fulfillmentActionSource).toContain('Math.max(depositAmount, quotedTransportDeposit)');
  });

  it('rolls back service acceptance when deposit checkout creation fails', () => {
    expect(fulfillmentActionSource).toContain('Failed to create deposit after service acceptance:');
    expect(fulfillmentActionSource).toContain('status: "pending_acceptance"');
    expect(fulfillmentActionSource).toContain('Failed to create deposit payment link:');
  });

  it('keeps manual customer deposit email resend available for admin', () => {
    expect(fulfillmentActionSource).toContain('"send_deposit_email"');
    expect(notificationSource).toContain('force_send');
    expect(notificationSource).toContain('alreadySent && !forceSend');
    expect(adminSource).toContain('Send deposit email');
    expect(adminSource).toContain("'send_deposit_email'");
    expect(adminSource).toContain('normalizeFunctionsInvokeError');
  });

  it('keeps transport contacts locked until the deposit is paid', () => {
    expect(fulfillmentActionSource).toContain('contact_revealed_at: serviceNextStatus === "accepted" ? nowIso : null');
    expect(fulfillmentActionSource).toContain('syncTransportBookingAwaitingDepositPayment');
    expect(partnerSource).not.toContain('total_price, deposit_amount, currency, customer_name, customer_email, customer_phone');
    expect(partnerSource).toContain('Customer name, surname, email and phone are hidden until payment confirmation.');
  });

  it('syncs transport payment status when a deposit is confirmed', () => {
    expect(fulfillmentActionSource).toContain('syncTransportBookingDepositPaid');
    expect(stripeWebhookSource).toContain('syncTransportBookingDepositPaid');
    expect(stripeWebhookSource).toContain('payment_status: "paid"');
    expect(stripeWebhookSource).toContain('status: "confirmed"');
  });
});
