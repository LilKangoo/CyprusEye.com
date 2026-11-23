import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = 'docs/hotels-v2-self-service-ical/114496_DIRECT_APPLY_REVIEW_DRAFT.sql';
const sql = readFileSync(path, 'utf8');
const gate = readFileSync('docs/hotels-v2-self-service-ical/114496_READ_ONLY_SOURCE_GATE.sql','utf8');

test('114496 remains an uninstalled, separately named entrypoint', () => {
  assert.ok(path.startsWith('docs/'));
  assert.match(sql, /CREATE FUNCTION public\.hotel_v2_partner_apply_external_calendar_direct_114496\s*\(/i);
  assert.doesNotMatch(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION|DROP\s+(?:FUNCTION|TRIGGER|TABLE)/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE|UPDATE\s+public\.site_settings|INSERT\s+INTO\s+public\.site_settings/i);
});

test('fixed privileges, no PUBLIC/anonymous/service_role grants', () => {
  assert.match(sql, /SECURITY DEFINER/i);
  assert.match(sql, /SET search_path TO 'pg_catalog', 'public', 'auth'/i);
  assert.match(sql, /v_actor uuid := auth\.uid\(\)/i);
  assert.match(sql, /IF v_actor IS NULL THEN/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated, service_role;/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated;/i);
  assert.doesNotMatch(sql, /GRANT\s+EXECUTE[\s\S]*\sTO\s+(?:anon|PUBLIC|service_role)\s*;/i);
});

test('only calendar operations are scoped and source is wrapped by existing reviewed partner apply', () => {
  assert.match(sql, /v_entity='calendar_source' AND v_action IN\('create','update','enable','disable'\)/);
  assert.match(sql, /v_entity='ical_secret' AND v_action IN\('set','rotate','clear'\)/);
  assert.match(sql, /v_entity='calendar_sync' AND v_action='trigger'/);
  assert.match(sql, /public\.hotel_v2_external_calendar_apply_common_114493\(\s*'partner'/);
  assert.doesNotMatch(sql, /pending_admin_review|provider_proposal_submit|hotel_v2_external_calendar_apply_common_114493\(\s*p_actor_type/i);
});

test('transient URL can only be passed on secret set/rotate', () => {
  assert.match(sql, /v_entity='ical_secret' AND v_action IN\('set','rotate'\)/);
  assert.match(sql, /p_ical_url IS NOT NULL/);
  assert.match(sql, /MESSAGE='hotels_v2_calendar_direct_url_scope_invalid_114496'/);
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+.*(?:secret|vault|proposal)|UPDATE\s+.*(?:vault|secret)/i);
});

test('source gate checks expected hash and ACL without invoking helper functions', () => {
  assert.match(gate, /READ ONLY/);
  assert.match(gate, /pg_proc/);
  assert.match(gate, /prosrc/);
  assert.match(gate, /has_function_privilege/);
  for (const h of [
    'c0c62169383c97ead607f532a95096da55c03b5f5d1fe8d9736bbb2449398891',
    'f500acc85f39bbe0ccb8b62aa6c210f753cd0aadc7ce48f1a5fbfb00f4f2ce5d',
    '062355e3b34d98b3eeacff83cfc2f472b24eafe33dffe1a78bb5196a5dfc7a52',
  ]) assert.ok(gate.includes(h), h);
  assert.doesNotMatch(gate, /\bSELECT\s+public\.hotel_v2_external_calendar_(?:apply|preview|control)_common/i);
});
