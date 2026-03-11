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

  it('derives transport deposit requirement from the booking payment state', () => {
    expect(fulfillmentActionSource).toContain('resolveServiceAcceptanceDepositState');
    expect(fulfillmentActionSource).toContain('.from("transport_bookings")');
    expect(fulfillmentActionSource).toContain('.select("payment_status, deposit_amount")');
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
  });
});
