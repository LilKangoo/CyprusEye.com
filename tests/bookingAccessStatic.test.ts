import fs from 'node:fs';
import path from 'node:path';

describe('booking access token preview', () => {
  const repoRoot = process.cwd();
  const functionSource = fs.readFileSync(
    path.join(repoRoot, 'supabase/functions/booking-access/index.ts'),
    'utf8',
  );
  const notificationSource = fs.readFileSync(
    path.join(repoRoot, 'supabase/functions/send-admin-notification/index.ts'),
    'utf8',
  );
  const migrationSource = fs.readFileSync(
    path.join(repoRoot, 'supabase/manual/booking_access_tokens_stage1.sql'),
    'utf8',
  );
  const verifySource = fs.readFileSync(
    path.join(repoRoot, 'supabase/manual/booking_access_tokens_stage1_verify.sql'),
    'utf8',
  );
  const templateUpdateSource = fs.readFileSync(
    path.join(repoRoot, 'supabase/manual/customer_deposit_paid_he_yourbooking_template_update.sql'),
    'utf8',
  );
  const pageSource = fs.readFileSync(path.join(repoRoot, 'yourbooking.html'), 'utf8');
  const clientSource = fs.readFileSync(path.join(repoRoot, 'js/yourbooking.js'), 'utf8');

  it('stores only hashed tokens behind service-role access', () => {
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS public.booking_access_tokens');
    expect(migrationSource).toContain('token_hash text NOT NULL');
    expect(migrationSource).not.toContain('raw_token');
    expect(migrationSource).toContain('ALTER TABLE public.booking_access_tokens ENABLE ROW LEVEL SECURITY');
    expect(migrationSource).toContain('REVOKE ALL ON TABLE public.booking_access_tokens FROM anon, authenticated');
    expect(migrationSource).toContain('booking_access_tokens_token_hash_uq');
    expect(migrationSource).toContain("booking_type IN ('transport','cars','trips','hotels')");
  });

  it('has a verify script for table safety and no anon select policy', () => {
    expect(verifySource).toContain('table_exists');
    expect(verifySource).toContain('rls_enabled');
    expect(verifySource).toContain('anon_select_policy_count');
    expect(verifySource).toContain('token_hash_unique_exists');
  });

  it('resolves one booking from a SHA-256 token and never exposes other bookings', () => {
    expect(functionSource).toContain('async function sha256Hex');
    expect(functionSource).toContain('function maskEmail');
    expect(functionSource).toContain('async function accountExistsForEmail');
    expect(functionSource).toContain('.from("booking_access_tokens")');
    expect(functionSource).toContain('.eq("token_hash", tokenHash)');
    expect(functionSource).toContain('access_level: isOwner ? "owner" : "public_preview"');
    expect(functionSource).toContain('is_owner: isOwner');
    expect(functionSource).toContain('payload.auth_mode = authMode');
    expect(functionSource).toContain('payload.masked_customer_email = maskEmail(customerEmail)');
    expect(functionSource).not.toContain('shop_orders');
  });

  it('keeps booking auth tied to the token customer email instead of client input', () => {
    expect(functionSource).toContain('action === "auth"');
    expect(functionSource).toContain('handleAuth(supabase, body)');
    expect(functionSource).toContain('email: customerEmail');
    expect(functionSource).toContain('supabase.auth.signInWithPassword');
    expect(functionSource).toContain('supabase.auth.signUp');
    expect(clientSource).toContain("action: 'auth'");
    expect(clientSource).toContain('auth_mode: authMode');
    expect(clientSource).not.toContain('email: email');
  });

  it('keeps create_token internal-only and returns the raw token only at creation time', () => {
    expect(functionSource).toContain('action === "create_token"');
    expect(functionSource).toContain('x-booking-access-secret');
    expect(functionSource).toContain('crypto.getRandomValues');
    expect(functionSource).toContain('token: rawToken');
  });

  it('makes paid confirmation emails prefer yourbooking_url while deposit requests keep payment_url', () => {
    expect(notificationSource).toContain('createBookingAccessTokenForDeposit');
    expect(notificationSource).toContain('yourbooking_url: yourBookingUrl');
    expect(notificationSource).toContain('booking_url: yourBookingUrl');
    expect(notificationSource).toContain('const actionUrl = params.variables.yourbooking_url');
    expect(notificationSource).toContain('|| params.variables.payment_url');
    expect(notificationSource).toContain('function buildCustomerDepositTemplateVariables');
    expect(notificationSource).toContain('payment_url: checkoutUrl');
  });

  it('keeps the manual customer_deposit_paid template update scoped to HE CTA and yourbooking_url', () => {
    expect(templateUpdateSource).toContain("c.key = 'customer_deposit_paid'");
    expect(templateUpdateSource).toContain('yourbooking_url');
    expect(templateUpdateSource).toContain('צפייה בהזמנה');
    expect(templateUpdateSource).not.toContain("c.key = 'customer_deposit_requested'");
  });

  it('ships the public preview page and client-side safe states', () => {
    expect(pageSource).toContain('Your booking | CyprusEye.com');
    expect(pageSource).toContain('/js/yourbooking.js');
    expect(pageSource).toContain('id="authModal"');
    expect(pageSource).not.toContain('id="loginLink" href="/auth/');
    expect(clientSource).toContain('/functions/v1/booking-access');
    expect(clientSource).toContain("action: 'resolve'");
    expect(clientSource).toContain('const authorizationToken = authToken || SUPABASE_CONFIG.anonKey');
    expect(clientSource).toContain('Authorization: `Bearer ${authorizationToken}`');
    expect(clientSource).toContain('requestBookingAuth');
    expect(clientSource).toContain('refreshBookingAccess');
    expect(clientSource).toContain("const CONTACT_URL = 'mailto:kontakt@wakacjecypr.com'");
    expect(clientSource).not.toContain('hello@cypruseye.com');
    expect(clientSource).toContain('showError');
    expect(clientSource).toContain('achievements.html?lang=');
  });
});
