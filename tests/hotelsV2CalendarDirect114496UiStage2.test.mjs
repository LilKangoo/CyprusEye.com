import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const file = 'js/hotels-v2-partner-workspace.js';
const source = readFileSync(file, 'utf8');
const get = (start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'Expected exact UI segment: ' + start);
  return source.slice(a, b);
};

test('workspace UI has valid JavaScript syntax', () => {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('direct route is disabled by default and limited to published pilot hotel', () => {
  const gate = get('function directExternalCalendarEnabled()', 'function externalCalendarProviderLabel');
  assert.match(gate, /CYPRUSEYE_HOTELS_ICAL_DIRECT_114496_ENABLED === true/);
  assert.match(gate, /state\.workspace\?\.hotel_id === Core\.PUBLISHED_ARCHITECTURE_TARGET/);
  assert.doesNotMatch(source, /CYPRUSEYE_HOTELS_ICAL_DIRECT_114496_ENABLED\s*=\s*true/);
});

test('only explicit release gate routes calendar writes to versioned direct RPC', () => {
  const save = get('async function saveReview(button)', 'function openExternalCalendarAction');
  assert.match(save, /directExternalCalendarEnabled\(\)/);
  assert.match(save, /Repository\.applyExternalCalendarDirect114496\(/);
  assert.match(save, /Repository\.submitExternalCalendarProposal\(/);
  assert.match(save, /domain === 'external_calendar'/);
  assert.match(save, /directSaved/);
  assert.match(save, /providerProposalSubmitted/);
});

test('calendar review remains explicit and does not retry a rejected mutation', () => {
  const review = get('function openReview()', 'function closeReview()');
  const save = get('async function saveReview(button)', 'function openExternalCalendarAction');
  assert.match(review, /data-phw-review-save/);
  assert.match(review, /blocking_reasons\.length/);
  assert.match(save, /Core\.newUuid\(\)/);
  assert.doesNotMatch(save, /setTimeout|while\s*\(|for\s*\(/);
});

test('new partner-facing text exists in Polish English and Hebrew', () => {
  for (const key of ['wizardIntroDirect','wizardAirbnbDirect','wizardNextDirect','wizardSubmitDirect','directSaved']) {
    const occurrences = source.split(new RegExp('\\b' + key + ':', 'g')).length - 1;
    assert.equal(occurrences, 3, key + ' must be translated to all three locales');
  }
  assert.match(source, /state\.language === 'he' \? 'rtl' : 'ltr'/);
});

test('direct client API is pinned and never auto-falls back to proposal', () => {
  const repo = readFileSync('js/hotels-v2-partner-workspace-repository.js', 'utf8');
  const direct = getFrom(repo, 'async function applyExternalCalendarDirect114496(', 'function clearReviewedPlans');
  assert.match(direct, /RPC\.applyExternalCalendarDirect114496/);
  assert.doesNotMatch(direct, /submitExternalCalendarProposal|RPC\.submitExternalCalendarProposal/);
  assert.match(direct, /Core\.validateExternalCalendarApplyResult/);
});
function getFrom(s, start, end) {
  const a=s.indexOf(start);const b=s.indexOf(end,a+start.length);
  assert.ok(a>=0 && b>a, 'Expected direct repository method');
  return s.slice(a,b);
}
