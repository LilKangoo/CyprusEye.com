import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const migration = read('supabase/migrations/20260811449100_hotels_v2_post_conversion_partner_read_successor.sql');
const body = migration.split('AS $function$')[1].split('$function$;')[0];
const predecessor = read('supabase/migrations/20260811320000_hotels_v2_h3_2a_partner_access_foundation.sql')
  .split('create function public.hotel_v2_partner_list_assigned_properties')[1]
  .split('as $function$')[1].split('$function$;')[0];
const normalized = (s: string) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();

describe('114491 immutable Partner discovery successor', () => {
  test('only one new function; no historical redefinition or business write', () => {
    expect(migration.match(/^CREATE FUNCTION /gm)).toHaveLength(1);
    expect(migration).not.toMatch(/CREATE OR REPLACE|\b(?:INSERT|UPDATE|DELETE|TRUNCATE|NOTIFY)\b|CREATE (?:TABLE|SCHEMA)/i);
    expect(migration).toMatch(/BEGIN;/);
    expect(migration.trim()).toMatch(/COMMIT;$/);
    expect(migration).not.toContain('ROLLBACK;');
    expect(migration.match(/^ALTER FUNCTION .* OWNER TO postgres;/gm)).toEqual([
      'ALTER FUNCTION public.hotel_v2_partner_list_assigned_properties_114491(uuid) OWNER TO postgres;',
    ]);
  });
  test('projection, scope, zero-property rejection and DTO are unchanged', () => {
    const start = 'select coalesce(jsonb_agg(jsonb_build_object(';
    expect(normalized(body.slice(body.indexOf(start)))).toBe(normalized(predecessor.slice(predecessor.indexOf(start))));
    expect(body).toContain('v_membership := public.hotel_v2_h3_2a_require_partner_membership(p_partner_id);');
    expect(body.indexOf('require_partner_membership')).toBeLessThan(body.indexOf('safe_state_114490'));
  });
  test('one certified safe-state read and no stale lifecycle invocation', () => {
    expect(body.match(/hotels_post_114489_private\.safe_state_114490\(\)/g)).toHaveLength(1);
    expect(body).not.toMatch(/hotels_lifecycle_private\.(?:predecessor_flag_exact|safe_state|chain_state|catalog_snapshot)\s*\(/);
    expect(body).toContain("v_lifecycle->'feature_flags' is distinct from");
    expect(body).toContain('"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":true');
    expect(body).toContain("v_lifecycle->'public_booking_enabled' is distinct from 'false'::jsonb");
    expect(body).toContain("v_lifecycle->'audit_chain_exact' is distinct from 'true'::jsonb");
  });
  test('public function is restricted to postgres/authenticated, no table/schema grants', () => {
    expect(migration).toContain('LANGUAGE plpgsql STABLE SECURITY DEFINER');
    expect(migration).toContain('SET search_path TO pg_catalog, public, auth, pg_temp');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated, service_role;');
    expect(migration.match(/^GRANT .*$/gm)).toEqual([
      'GRANT EXECUTE ON FUNCTION public.hotel_v2_partner_list_assigned_properties_114491(uuid) TO authenticated;',
    ]);
    expect(migration).toContain('a.is_grantable');
  });
  test.each([
    ['20260811448900_hotels_v2_published_rooms_v2_conversion.sql', '60e735d7d3d53a32f0391ca0aa8ca0f464dc9edaabde568a0fc8070833c59832'],
    ['20260811449000_hotels_v2_post_conversion_admin_successors.sql', '738c88d341e49826c1451413c2db768840230d4d394acd2b94b8f4f00debf81a'],
  ])('installed migration frozen: %s', (file, sha) => {
    expect(crypto.createHash('sha256').update(read('supabase/migrations/' + file)).digest('hex')).toBe(sha);
  });
});
