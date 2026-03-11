import fs from 'node:fs';
import path from 'node:path';

describe('transport notification reliability', () => {
  const repoRoot = process.cwd();
  const endpointSource = fs.readFileSync(path.join(repoRoot, 'functions/transport/booking/index.js'), 'utf8');
  const dashboardSource = fs.readFileSync(path.join(repoRoot, 'js/dashboard.js'), 'utf8');
  const migrationSource = fs.readFileSync(
    path.join(repoRoot, 'supabase/migrations/128_transport_customer_notifications_reliability.sql'),
    'utf8',
  );

  it('requires customer email before transport booking insert reaches the database', () => {
    expect(endpointSource).toContain('Missing field: customer_email');
    expect(endpointSource).toContain('Invalid field: customer_email');
    expect(migrationSource).toContain('trg_transport_booking_require_customer_email');
  });

  it('adds authenticated customer read access for their own transport bookings', () => {
    expect(migrationSource).toContain('CREATE POLICY transport_bookings_user_select');
    expect(migrationSource).toContain('lower(trim(coalesce(customer_email,');
    expect(migrationSource).toContain("auth.jwt() ->> ''email''");
  });

  it('loads transport bookings into the customer dashboard', () => {
    expect(dashboardSource).toContain(".from('transport_bookings')");
    expect(dashboardSource).toContain("type: 'transport'");
    expect(dashboardSource).toContain('payment_status');
    expect(dashboardSource).toContain('buildTransportRouteLabel');
  });
});
