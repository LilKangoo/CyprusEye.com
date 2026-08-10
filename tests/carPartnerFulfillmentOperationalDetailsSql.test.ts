import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const compact = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

describe('Cars partner fulfillment operational details SQL', () => {
  const migration = read(
    'supabase/migrations/20260810150000_car_partner_fulfillment_operational_details.sql',
  );
  const verify = read('supabase/manual/car_partner_fulfillment_operational_details_verify.sql');
  const integrationBase = read(
    'tests/integration/car-partner-fulfillment-operational-details-base.sql',
  );
  const integrationGate = read(
    'tests/integration/car-partner-fulfillment-operational-details-postgres-gate.sql',
  );
  const sql = compact(migration);

  test('is transactional, fail-closed and preserves the existing exact-partner trigger path', () => {
    expect(sql).toContain('-- car-partner-fulfillment-operational-details-v1');
    expect(sql).toContain('begin;');
    expect(sql).toMatch(/commit;$/);
    expect(sql).toContain('car_partner_fulfillment_operational_details_required_table_missing');
    expect(sql).toContain('car_partner_fulfillment_operational_details_required_function_missing');
    expect(sql).toContain('car_partner_fulfillment_operational_details_unexpected_trigger_contract');
    expect(sql).toContain('partner_service_fulfillment_partner_id_for_car_booking(offer_uuid, loc)');
    expect(sql).toContain('upsert_partner_service_fulfillment_from_booking_with_partner');
    expect(sql).not.toContain('insert into public.car_bookings');
    expect(sql).not.toContain('update public.car_bookings');
  });

  test('stores only non-PII operational timing in fulfillment details', () => {
    const detailsStart = sql.indexOf('details_json := jsonb_strip_nulls(jsonb_build_object(');
    const formStart = sql.indexOf('form_json := jsonb_strip_nulls(jsonb_build_object(', detailsStart);
    const details = sql.slice(detailsStart, formStart);

    expect(detailsStart).toBeGreaterThan(0);
    expect(formStart).toBeGreaterThan(detailsStart);
    expect(details).toContain("'pickup_date', new.pickup_date");
    expect(details).toContain("'pickup_time', new.pickup_time");
    expect(details).toContain("'return_date', new.return_date");
    expect(details).toContain("'return_time', new.return_time");
    expect(details).toContain("'pickup_location'");
    expect(details).toContain("'return_location'");
    expect(details).not.toContain("'full_name'");
    expect(details).not.toContain("'email'");
    expect(details).not.toContain("'phone'");
    expect(details).not.toContain("'pickup_address'");
    expect(details).not.toContain("'return_address'");
    expect(details).not.toContain("'special_requests'");
  });

  test('backfills only frozen pending Cars pairs and protects lifecycle, routing and gated rows', () => {
    const backfillStart = sql.indexOf('-- existing operationally pending requests');
    const postconditionsStart = sql.indexOf('do $postconditions$', backfillStart);
    const backfill = sql.slice(backfillStart, postconditionsStart);

    expect(sql).toContain("fulfillment.resource_type = 'cars'");
    expect(sql).toContain("fulfillment.status = 'pending_acceptance'");
    expect(sql).toContain("booking.status in ('pending', 'message_sent')");
    expect(backfill).toContain('from _car_pending_fulfillment_operational_targets target');
    expect(backfill).toContain('where fulfillment.id = target.fulfillment_id');
    expect(backfill).not.toContain('set status');
    expect(backfill).not.toContain('set partner_id');
    expect(backfill).not.toContain('contact_revealed_at');
    expect(sql).toContain("to_jsonb(fulfillment) - 'details' - 'updated_at'");
    expect(sql).toContain('changed_protected_fulfillment_fields');
    expect(sql).toContain('changed_gated_rows');
    expect(sql).toContain('already-correct rows');
    expect(sql).toContain('are untouched on rerun');
  });

  test('keeps the contact snapshot gated and internal trigger execution locked down', () => {
    expect(sql).toContain('partner_service_fulfillment_form_snapshots');
    expect(sql).toContain('revoke all on function public.trg_partner_service_fulfillment_from_car_booking() from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.trg_partner_service_fulfillment_from_car_booking() to service_role');
    expect(sql).toContain('partner acceptance remains manual; contact snapshots remain gated');
  });

  test('read-only verify covers timing, exact owner, uniqueness, RLS gates and PII absence', () => {
    const normalized = compact(verify);
    expect(normalized).toContain('car_partner_fulfillment_operational_details_safe');
    expect(normalized).toContain('pending_operational_detail_mismatch_count');
    expect(normalized).toContain('pending_details_pii_key_count');
    expect(normalized).toContain('threshold_exact_owner_mismatch_count');
    expect(normalized).toContain('duplicate_cars_fulfillment_count');
    expect(normalized).toContain('partner_service_fulfillments_partner_read');
    expect(normalized).toContain('contact_revealed_at is not null');
    expect(verify).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|call)\s+(?:into\s+|from\s+|table\s+)?public\./im,
    );
  });

  test('isolated PostgreSQL gate covers backfill, RLS, fresh insert, payment and rollback', () => {
    expect(integrationBase).toContain('Synthetic data only; no production credentials or PII.');
    expect(integrationBase).toContain('partner_service_fulfillments_partner_read');
    expect(integrationBase).toContain('partner_service_fulfillment_contacts_partner_read');
    expect(integrationBase).toContain('partner_service_fulfillment_form_snapshots_partner_read');
    expect(integrationGate).toContain('existing pending fulfillment backfill or protected contract mismatch');
    expect(integrationGate).toContain('fresh booking did not create exactly one Cars fulfillment');
    expect(integrationGate).toContain('payment update duplicated or auto-accepted the booking request');
    expect(integrationGate).toContain("payment_status = 'partial'");
    expect(integrationGate).toContain("status = 'pending_acceptance'");
    expect(integrationGate).toContain("details->>'pickup_time' = '10:00:00'");
    expect(integrationGate).toContain('rollback;');
  });
});
