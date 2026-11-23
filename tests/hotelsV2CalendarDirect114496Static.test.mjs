import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('docs/hotels-v2-self-service-ical/114496_DIRECT_APPLY_REVIEW_DRAFT.sql','utf8');
const review = readFileSync('docs/hotels-v2-self-service-ical/REVIEW.md','utf8');
const preflight = readFileSync('docs/hotels-v2-self-service-ical/114496_READ_ONLY_PRECHECK.sql','utf8');

test('review-only SQL is not a database migration and has one versioned RPC',()=>{
  assert.match(sql,/DO NOT APPLY TO PRODUCTION/);
  assert.equal((sql.match(/\bCREATE FUNCTION /g)||[]).length,1);
  assert.match(sql,/CREATE FUNCTION public\.hotel_v2_partner_apply_external_calendar_direct_114496\s*\(/);
  assert.match(sql,/RETURNS jsonb/);
});
test('never accepts browser-provided actor type and uses the reviewed partner-only path',()=>{
  assert.match(sql,/v_actor uuid := auth\.uid\(\)/);
  assert.match(sql,/public\.hotel_v2_external_calendar_apply_common_114493\(\s*'partner'/);
  assert.doesNotMatch(sql,/p_actor_type/);
  assert.doesNotMatch(sql,/\bINSERT INTO\b|\bUPDATE\s+public\.|\bDELETE FROM\b/i);
});
test('single reviewed operation with an allowlist, not arbitrary SQL or admin review bypass',()=>{
  assert.match(sql,/jsonb_array_length\(p_reviewed_plan->'operations'\) <> 1/);
  assert.match(sql,/v_entity='calendar_source'/);
  assert.match(sql,/v_entity='ical_secret'/);
  assert.match(sql,/v_entity='calendar_sync'/);
  assert.match(sql,/hotels_v2_calendar_direct_action_denied_114496/);
  assert.doesNotMatch(sql,/pending_admin_review|hotel_external_calendar_partner_proposals/);
});
test('URL is accepted only on secret set/rotate, and no secret is ever returned directly',()=>{
  assert.match(sql,/v_entity='ical_secret' AND v_action IN\('set','rotate'\)/);
  assert.match(sql,/hotels_v2_calendar_direct_url_scope_invalid_114496/);
  assert.doesNotMatch(sql,/\bRAISE NOTICE\b|RAISE EXCEPTION\s+.*p_ical_url/);
  assert.doesNotMatch(sql,/vault\.secrets/);
});
test('SECURITY DEFINER and least-privilege EXECUTE, no service-role or anon GRANT',()=>{
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/SET search_path TO 'pg_catalog', 'public', 'auth'/);
  assert.match(sql,/OWNER TO postgres/);
  assert.match(sql,/FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql,/TO authenticated;/);
  assert.doesNotMatch(sql,/GRANT EXECUTE[^;]+TO (?:anon|service_role)/s);
});
test('hard production gates and pinned verified 114493 helper hashes are explicit',()=>{
  assert.match(preflight,/ISOLATION LEVEL REPEATABLE READ, READ ONLY/);
  assert.match(preflight,/062355e3b34d98b3eeacff83cfc2f472b24eafe33dffe1a78bb5196a5dfc7a52/);
  assert.match(preflight,/f500acc85f39bbe0ccb8b62aa6c210f753cd0aadc7ce48f1a5fbfb00f4f2ce5d/);
  assert.match(review,/DO NOT APPLY/);
  assert.match(review,/wrong room|wrong Hotel/i);
});
