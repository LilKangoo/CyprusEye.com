import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const reconciliation = read(
  'supabase/migrations/20260811140000_hotels_live_schema_reconciliation.sql',
);
const core = read('supabase/migrations/20260811170000_hotels_v2_h1a_core.sql');
const preflight = read('supabase/manual/hotels_v2_h1a_preflight.sql');
const verify = read('supabase/manual/hotels_v2_h1a_verify.sql');

const normalizedTables = [
  'hotel_room_types',
  'hotel_units',
  'hotel_rate_plans',
  'hotel_room_rates',
  'hotel_rate_rules',
  'hotel_daily_inventory',
  'hotel_daily_rates',
] as const;

describe('Hotels V2 H1A reconciled and inert schema foundation', () => {
  test('reconciliation captures the accepted live-only Hotel contract fail closed', () => {
    expect(reconciliation.trimStart().toLowerCase()).toMatch(/^begin;/);
    expect(reconciliation).toContain('set transaction isolation level repeatable read;');
    expect(reconciliation.trimEnd().toLowerCase()).toMatch(/commit;$/);

    expect(reconciliation).toContain('add column sort_order integer not null default 1000');
    expect(reconciliation).toContain("add column amenities jsonb default '[]'::jsonb");
    expect(reconciliation).toContain('add column title_i18n jsonb');
    expect(reconciliation).toContain('add column description_i18n jsonb');
    expect(reconciliation).toContain('hotels_h1a_reconciliation_hotel_cities_column_count_mismatch');
    expect(reconciliation).toContain('hotels_h1a_reconciliation_hotel_amenities_column_count_mismatch');
    expect(reconciliation).toContain('hotels_h1a_reconciliation_hotel_cities_index_contract_mismatch');
    expect(reconciliation).toContain('hotels_h1a_reconciliation_hotel_amenities_index_contract_mismatch');
    expect(reconciliation).toContain('hotels_h1a_reconciliation_live_comment_contract_mismatch');
    expect(reconciliation).toContain('hotels_h1a_reconciliation_live_table_grant_mismatch');
    expect(reconciliation).toContain('hotels_h1a_reconciliation_live_table_rls_mismatch');
    expect(reconciliation).toContain('hotel_cities_select_public');
    expect(reconciliation).toContain('hotel_amenities_select_public');
    expect(reconciliation).toContain('hotel_cities_all_admin');
    expect(reconciliation).toContain('hotel_amenities_all_admin');
  });

  test('live-only ACL is least privilege despite the historical production grants', () => {
    expect(reconciliation).toContain('grant select on table public.hotel_cities to anon');
    expect(reconciliation).toContain('grant select, insert, update, delete on table public.hotel_cities to authenticated');
    expect(reconciliation).toContain('grant select on table public.hotel_amenities to anon');
    expect(reconciliation).toContain('grant select, insert, update, delete on table public.hotel_amenities to authenticated');
    expect(reconciliation).toContain("has_table_privilege('anon', format('public.%I', v_table_name), 'TRUNCATE')");
    expect(reconciliation).toContain("has_table_privilege('authenticated', format('public.%I', v_table_name), 'REFERENCES')");
    expect(reconciliation).not.toContain('grant all on table public.hotel_cities to anon');
    expect(reconciliation).not.toContain('grant all on table public.hotel_amenities to authenticated');
  });

  test('property fields and four capability flags are additive and inert', () => {
    expect(core).toContain("add column architecture_version text not null default 'legacy'");
    expect(core).toContain("add column timezone text not null default 'Europe/Nicosia'");
    expect(core).toContain("add column currency character(3) not null default 'EUR'");
    expect(core).toContain("add column booking_mode text not null default 'request_confirmation'");
    expect(core).toContain("architecture_version in ('legacy', 'rooms_v2')");
    expect(core).toContain(
      "booking_mode in ('request_confirmation', 'instant_booking', 'external_redirect')",
    );

    for (const flag of [
      'hotel_rooms_v2_enabled',
      'hotel_external_sync_enabled',
      'hotel_instant_booking_enabled',
      'hotel_stripe_connect_enabled',
    ]) {
      expect(core).toContain(`add column ${flag} boolean not null default false`);
    }

    expect(core).toContain("where architecture_version <> 'legacy'");
    expect(core).toContain("where booking_mode <> 'request_confirmation'");
    expect(core).not.toMatch(/update\s+public\.hotels\b/i);
    expect(core).not.toMatch(/insert\s+into\s+public\.hotels\b/i);
  });

  test('normalized schema is one-time, empty, and exact-property safe', () => {
    expect(core).toContain('hotels_v2_h1a_core_normalized_object_already_exists');
    for (const table of normalizedTables) {
      expect(core).toContain(`create table public.${table}`);
      expect(core).not.toContain(`create table if not exists public.${table}`);
      expect(core).toContain(`'${table}'`);
    }
    expect(core).toContain("v_policy_name := v_table_name || '_admin_all'");

    expect(core).toContain('foreign key (room_type_id, hotel_id)');
    expect(core).toContain('references public.hotel_room_types(id, hotel_id)');
    expect(core).toContain('foreign key (rate_plan_id, hotel_id)');
    expect(core).toContain('references public.hotel_rate_plans(id, hotel_id)');
    expect(core).toContain('hotel_room_types_hotel_code_lower_uidx');
    expect(core).toContain('hotel_rate_plans_hotel_code_lower_uidx');
    expect(core).toContain('hotel_units_room_type_code_lower_uidx');
    expect(core).toContain('hotels_v2_h1a_core_normalized_tables_not_empty');
    expect(core).not.toMatch(/insert\s+into\s+public\.hotel_(?:room_types|units|rate_plans|room_rates|rate_rules|daily_inventory|daily_rates)\b/i);
  });

  test('H1 intentionally defers unresolved H2/H4 tables and documents legacy categories', () => {
    expect(core).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.hotel_calendar_overrides/i);
    expect(core).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.hotel_activity_log/i);
    expect(core).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.hotel_sync_sources/i);
    expect(core).toContain('sync_source_id and sync_run_id FKs are intentionally deferred');
    expect(core).toContain('Legacy/deprecated Hotel categorization retained for compatibility');
    expect(core).toContain('hotel_categories_fingerprint');
  });

  test('new tables are Admin-only under RLS while public V2 remains disabled', () => {
    expect(core).toContain("execute format('alter table public.%I enable row level security'");
    expect(core).toContain('for all to authenticated using (public.is_current_user_admin())');
    expect(core).toContain("revoke all on table public.%I from public, anon, authenticated");
    expect(core).toContain("grant select, insert, update, delete on table public.%I to authenticated");
    expect(core).toContain("grant all on table public.%I to service_role");
    expect(core).not.toMatch(/create\s+policy[\s\S]{0,160}\bto\s+anon\b/i);
  });

  test('preflight is pinned to exact protected production IDs and fingerprints', () => {
    for (const id of [
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
      'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1',
      '1f1bef2f-ba2b-4d6c-9c43-8714e0224bd1',
      'a2377882-4959-45ac-b311-3eb16afaa01d',
      'a509b9da-9fd6-4836-8525-1068e23303ca',
      '21114c8e-7d5c-4136-af18-a93ebd315618',
      '87dbd568-bd83-4bb1-9493-0c4942b7fb18',
      'aff7d13a-960f-48e3-8d93-72205ee18e76',
      'b981fda1-4879-49ec-b499-16161bafe1c1',
      'c857644b-2094-41eb-96d9-f735cdb681a4',
    ]) {
      expect(preflight).toContain(id);
      expect(verify).toContain(id);
    }
    for (const fingerprint of [
      'b3e3a9c5bda72a83e49d3095d175ab9c',
      'fb5a4c508b0df32afbffe5b1594c7a50',
      '1e01541853d87d26adccb8172074934b',
      '42b5e1dc9726890e90014c3e89c2329d',
      'd41d8cd98f00b204e9800998ecf8427e',
      'b7ae5a40bbafee23e7f05173f8bdaa33',
      '2286f8bd978e9b321f8191a6a3dbf8eb',
    ]) {
      expect(preflight).toContain(fingerprint);
      expect(verify).toContain(fingerprint);
    }
    expect(preflight).toContain('hotels_v2_h1a_preflight_safe');
  });

  test('verify separates exact legacy oracle counters and one final safety boolean', () => {
    expect(verify).toContain('"HOTEL_LEGACY_PRICE_MISMATCH"');
    expect(verify).toContain('"HOTEL_LEGACY_PUBLIC_MISMATCH"');
    expect(verify).toContain('"HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE"');
    expect(verify).toContain("to_jsonb(hotel)->>'slug' = '7-ukow'");
    expect(verify).toContain("to_jsonb(hotel)->>'slug' = 'rgb-cabins-larnaka-centrum'");
    expect(verify).toContain('7208ab4ecc0e47abd64d87ca1ac53a03');
    expect(verify).toContain('e272ec40b78069a1e2e49ac6b0956f11');
    expect(verify).toContain('photos');
    expect(verify).toContain('hotels_v2_h1a_foundation_safe');
    expect(verify).toContain('rooms_v2_property_count');
    expect(verify).toContain('room_type_count = 0');
    expect(verify).toContain('all_flags_off_count = 1');
    expect(verify).toContain('broad_authenticated_select_removed');
    expect(verify).toContain('partner_rpc_not_anon');
    expect(verify).toContain('partner_rpc_not_service_role');
    expect(verify).toContain('customer_rpc_auth_only');
    expect(verify).toContain('referral_rpc_redacted_auth_only');
    expect(verify).toContain('fulfillment_relationship_mismatch_count = 0');
    expect(verify).toContain('live_grant_contract_match');
    expect(verify).toContain('live_index_contract_match');
  });

  test('manual guards are read-only SQL', () => {
    for (const sql of [preflight, verify]) {
      expect(sql).not.toMatch(/^\s*(?:insert|update|delete|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/im);
    }
  });
});
