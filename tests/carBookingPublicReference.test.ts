import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Cars public booking reference and pending success contract', () => {
  const reservation = read('js/car-reservation.js');
  const migration = read('supabase/migrations/20260810170000_car_booking_public_reference.sql');
  const verify = read('supabase/manual/car_booking_public_reference_verify.sql');
  const admin = read('admin/admin.js');
  const notifications = read('supabase/functions/send-admin-notification/index.ts');

  test('uses a narrow idempotent RPC instead of an anonymous insert returning no row', () => {
    expect(reservation).toContain("const BOOKING_SUBMIT_RPC_NAME = 'submit_car_booking_request'");
    expect(reservation).toContain('getOrCreateBookingSubmissionKey(form, data)');
    expect(reservation).toContain('bookingSubmissionAttempts.delete(form)');
    expect(reservation).toContain('bookingFormsInFlight.has(form)');
    expect(reservation).not.toMatch(/\.from\(['"]car_bookings['"]\)\s*\n?\s*\.insert/);
    expect(migration).toContain('on conflict (public_submission_key)');
    expect(migration).toContain('idempotent := true');
    expect(migration.indexOf('where booking.public_submission_key = p_submission_key')).toBeLessThan(
      migration.indexOf("message = 'car_booking_exact_public_offer_required'"),
    );
  });

  test('server generates an immutable unique PII-free reference and forces pending/unpaid', () => {
    expect(migration).toContain("v_expected := 'CAR-' || substr(replace(new.id::text, '-', ''), 1, 8)");
    expect(migration).toContain('car_bookings_booking_reference_key');
    expect(migration).toContain('car_booking_public_reference_is_immutable');
    expect(migration).toContain("'pending',");
    expect(migration).toContain("'unpaid',");
    expect(migration).toContain('car_booking_payload_contains_unsupported_fields');
    expect(migration).toContain('car_booking_exact_public_offer_required');
    expect(migration).toContain('car_booking_contact_invalid');
    expect(migration).not.toMatch(/grant\s+select[^;]*car_bookings[^;]*anon/is);
    expect(migration).toContain('returns table(\n  booking_id uuid,\n  booking_reference text,\n  booking_status text,\n  idempotent boolean');
    expect(migration).toContain("check (booking_reference ~ '^CAR-[0-9a-f]{8}$')");
    expect(migration).toContain('car_booking_public_reference_backfill_invalid');
    expect(migration.indexOf('lock table public.car_bookings')).toBeLessThan(
      migration.indexOf('create temporary table _car_booking_public_reference_before'),
    );
  });

  test('the isolated database gate proves duplicate submission and short-reference collisions fail safely', () => {
    const postgresGate = read('tests/integration/car-booking-public-reference-postgres-gate.sql');
    expect(postgresGate).toContain('idempotent_retry_created_duplicate');
    expect(postgresGate).toContain('set is_published = false');
    expect(postgresGate).toContain('fulfillment_not_exactly_once');
    expect(postgresGate).toContain('reference_collision_unexpectedly_accepted');
    expect(postgresGate).toContain('exception when unique_violation then null');
  });

  test('one escaped success panel requires a real reference and preserves partner confirmation copy', () => {
    expect(reservation).toContain("const bookingReference = String(bookingRow?.booking_reference || '').trim()");
    expect(reservation).not.toContain("String(bookingRow?.booking_status || '').trim() !== 'pending'");
    expect(reservation).toContain("confirmDiv.hidden = true");
    expect(reservation).toContain('car_booking_public_reference_missing');
    expect(reservation).toContain('escapeHtml(bookingReference)');
    expect(reservation).toContain('escapeHtml(bookingEmail)');
    expect(reservation).toContain('successBox.partnerConfirmation');
    expect(reservation).toContain('successBox.contactAfterConfirmation');
    expect(reservation).not.toContain("tr('carRental.page.reservation.toast.submitSuccess'");
  });

  test('Admin and Cars customer notification prefer the persisted public reference', () => {
    expect(admin).toContain('function getCarBookingPublicReference(booking)');
    expect(admin).toContain('#${escapeHtml(bookingReference)}');
    expect(notifications).toContain('getField(record, ["booking_reference", "reference", "order_number", "orderNumber"])');
    expect(notifications).toContain('firstNonEmpty(getField(params.record, ["booking_reference", "reference"]), params.recordId)');
    expect(notifications).toContain('{ label: "Reference", value: bookingReference }');
    expect(notifications).toContain('{ label: "Vehicle", value: getField(record, ["car_model", "vehicle", "car"]) }');
  });

  test.each(['pl', 'en', 'he'])('%s has complete success/error translations', (language) => {
    const dictionary = JSON.parse(read(`translations/${language}.json`));
    [
      'carRental.page.reservation.error.secureSubmissionUnavailable',
      'carRental.page.reservation.error.bookingReferenceMissing',
      'carRental.page.reservation.successBox.partnerConfirmation',
      'carRental.page.reservation.successBox.contactAfterConfirmation',
    ].forEach((key) => expect(String(dictionary[key] || '').trim()).not.toBe(''));
  });

  test('read-only verifier covers schema, grants, data uniqueness and fulfillment parity', () => {
    expect(verify).toContain('invalid_reference_count');
    expect(verify).toContain('duplicate_reference_count');
    expect(verify).toContain('fulfillment_reference_mismatch_count');
    expect(verify).toContain('narrow_return_contract_ok');
    expect(verify).toContain('car_booking_public_reference_safe');
    expect(verify).not.toMatch(/\b(?:insert|update|delete|alter|create|drop|grant|revoke)\b\s+(?:into\s+|from\s+|table\s+|function\s+)?public\./i);
  });
});
