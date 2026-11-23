import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20260811449600_hotels_v2_partner_ical_direct_self_service.sql',
  'utf8'
);

test('versioned direct calendar migration is transactional and fail closed', () => {
  assert.match(migration, /\bBEGIN;/);
  assert.match(migration, /\bCOMMIT;\s*$/);
  assert.match(migration, /hotels_114496_predecessors_missing/);
  assert.match(migration, /hotels_114496_catalog_epoch_mismatch/);
  assert.match(migration, /hotels_114496_post_catalog_epoch_mismatch/);
  assert.match(migration, /hotels_114496_dependency_source_mismatch/);
});

test('original 114493 catalog and helper sources are guarded', () => {
  for (const sha of [
    '062355e3b34d98b3eeacff83cfc2f472b24eafe33dffe1a78bb5196a5dfc7a52',
    'f500acc85f39bbe0ccb8b62aa6c210f753cd0aadc7ce48f1a5fbfb00f4f2ce5d',
    'c0c62169383c97ead607f532a95096da55c03b5f5d1fe8d9736bbb2449398891'
  ]) assert.ok(migration.includes(sha));
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE)\s+(?:TABLE|FUNCTION|SCHEMA)\b/i);
  assert.doesNotMatch(migration, /\bUPDATE\s+(?:public\.)?site_settings\b/i);
});

test('new authenticated endpoint delegates the exact reviewed partner operation', () => {
  assert.match(migration, /CREATE FUNCTION public\.hotel_v2_partner_apply_external_calendar_direct_114496/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /v_actor uuid := auth\.uid\(\)/);
  assert.match(migration, /public\.hotel_v2_external_calendar_apply_common_114493\(\s*'partner'/);
  assert.match(migration, /v_entity='calendar_source' AND v_action IN\('create','update','enable','disable'\)/);
  assert.match(migration, /v_entity='ical_secret' AND v_action IN\('set','rotate','clear'\)/);
  assert.match(migration, /v_entity='calendar_sync' AND v_action='trigger'/);
});

test('private iCal URL is scoped to only set/rotate', () => {
  assert.match(migration, /v_entity='ical_secret' AND v_action IN\('set','rotate'\)/);
  assert.match(migration, /p_ical_url IS NOT NULL/);
  assert.doesNotMatch(migration, /(?:RAISE NOTICE|RAISE LOG).*p_ical_url/is);
});

test('RPC grant is authenticated only; anon and service role denied', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.hotel_v2_partner_apply_external_calendar_direct_114496/);
  assert.match(migration, /FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.hotel_v2_partner_apply_external_calendar_direct_114496/);
  assert.match(migration, /TO authenticated;/);
  assert.match(migration, /has_function_privilege\('anon',v_oid,'EXECUTE'\)/);
  assert.match(migration, /has_function_privilege\('service_role',v_oid,'EXECUTE'\)/);
});
