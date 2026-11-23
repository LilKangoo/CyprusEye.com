import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('js/hotels-v2-partner-workspace.js', 'utf8');
const css = readFileSync('partners/hotels-v2-workspace.css', 'utf8');
const htmlPages = [
  readFileSync('partners.html', 'utf8'),
  readFileSync('partners/index.html', 'utf8'),
];
const begin = source.indexOf('  function generatedCalendarCode(');
const end = source.indexOf('  function renderExternalCalendars()', begin);
assert.ok(begin >= 0 && end > begin, 'pure wizard functions exist');
const api = vm.runInNewContext(
  '(function() {' + source.slice(begin, end) +
  '; return { generatedCalendarCode, renderCalendarWizard }; })()',
  { text: (k) => k, html: (s) => String(s) },
);
const pilotRoom = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';

test('three provider choices and one explicit, required room selection', () => {
  const page = api.renderCalendarWizard('<option value="' + pilotRoom + '">Apartment</option>');
  assert.equal((page.match(/type="radio" name="source_type"/g) || []).length, 3);
  for (const provider of ['booking_com', 'airbnb', 'ical']) {
    assert.ok(page.includes('value="' + provider + '"'), provider);
    assert.ok(page.includes('data-phw-wizard-guide="' + provider + '"'), provider);
  }
  assert.match(page, /select name="room_type_id" required/);
  assert.match(page, /option value="" disabled selected/);
  assert.match(page, /data-phw-external-create/);
});

test('private URL is never requested during source creation', () => {
  const page = api.renderCalendarWizard('');
  assert.doesNotMatch(page, /name="ical_url"|type="url"|localStorage|sessionStorage/);
  assert.match(page, /wizardIntro/);
  assert.match(page, /wizardNext/);
  assert.ok(page.includes('disabled'), 'empty room list must disable Review');
});

test('provider help links use safe URLs and no OAuth/API claims', () => {
  const page = api.renderCalendarWizard('');
  assert.match(page, /https:\/\/www\.airbnb\.com\/help\/article\/99/);
  assert.match(page, /https:\/\/www\.youtube\.com\/watch\?v=Smj-WfWpi4o/);
  assert.match(page, /rel="noopener noreferrer"/);
  assert.match(page, /wizardWarning/);
});

test('code auto-generation obeys server code shape, room, provider, uniqueness', () => {
  const code = api.generatedCalendarCode('airbnb', pilotRoom, []);
  assert.match(code, /^[a-z0-9][a-z0-9_-]{0,79}$/);
  assert.match(code, /^airbnb-/);
  const second = api.generatedCalendarCode('airbnb', pilotRoom, [{ code }]);
  assert.equal(second, code + '-2');
  assert.notEqual(api.generatedCalendarCode('booking_com', pilotRoom, []), code);
  assert.equal(api.generatedCalendarCode('invalid', pilotRoom, []), '');
  assert.equal(api.generatedCalendarCode('airbnb', 'invalid', []), '');
});

test('advanced technical defaults preserve existing reviewed payload keys', () => {
  const page = api.renderCalendarWizard('');
  for (const key of ['code','sync_interval_minutes','units_per_event','priority','reason']) {
    assert.ok(page.includes('name="' + key + '"'), key);
  }
  assert.match(page, /name="sync_interval_minutes"[^>]*value="60"/);
  assert.match(page, /name="units_per_event"[^>]*value="1"/);
  assert.match(page, /name="priority"[^>]*value="100"/);
  assert.match(page, /class="phw-calendar-wizard__advanced"/);
  assert.match(page, /wizardUnitsNote/);
  assert.ok(source.includes("await review('external_calendar', draft, opener)"));
});

test('provider switching updates help and generated code without a network call', () => {
  assert.ok(source.includes("event.target.closest('[data-phw-calendar-wizard]')"));
  assert.ok(source.includes("wizard.elements.room_type_id?.value"));
  assert.ok(source.includes("generatedCalendarCode(provider, room, state.externalCalendar?.sources || [])"));
  assert.ok(source.includes("item.hidden = item.dataset.phwWizardGuide !== provider"));
  assert.ok(source.includes("event.target.dataset.manual = 'true'"));
});

test('PL EN HE copy and safe scoped responsive/RTL styling', () => {
  for (const key of ['wizardTitle','wizardIntro','wizardProvider','wizardRoom','wizardBooking','wizardAirbnb','wizardIcal','wizardNext','wizardWarning']) {
    const found = source.match(new RegExp('^\\s+' + key + ':', 'gm')) || [];
    assert.equal(found.length, 3, key + ' must have PL EN HE translations');
  }
  assert.match(css, /phw-calendar-wizard__options/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /padding-inline-start/);
});

test('both Partner entrypoints load the same cache-busted wizard JS and CSS', () => {
  for (const page of htmlPages) {
    assert.match(page, /hotels-v2-partner-workspace\.js\?v=20261123_calendar_wizard/);
    assert.match(page, /hotels-v2-workspace\.css\?v=20261123_calendar_wizard/);
    assert.match(page, /hotels-v2-partner-workspace-repository\.js\?v=20261123_a3_114493/);
  }
});
