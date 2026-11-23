import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { chromium } from '@playwright/test';

const source = readFileSync('js/hotels-v2-partner-workspace.js', 'utf8');
const css = readFileSync('partners/hotels-v2-workspace.css', 'utf8');
const roomId = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const begin = source.indexOf('  function generatedCalendarCode(');
const render = source.indexOf('  function renderCalendarWizard(', begin);
const end = source.indexOf('  function renderExternalCalendars()', render);
assert.ok(begin !== -1 && render > begin && end > render);
const builder = vm.runInNewContext(
  '(function(){ ' + source.slice(begin,end) + '; return renderCalendarWizard; })()',
  { text: (key) => key, html: (value) => String(value) },
);
const content = builder('<option value="' + roomId + '">Upper Floor Apartment</option>');
const listenerStart = source.indexOf("    state.root.addEventListener('input', (event) => {");
const listenerEnd = source.indexOf("      if (event.target.matches('[data-phw-guest-filter]')) {", listenerStart);
assert.ok(listenerStart !== -1 && listenerEnd > listenerStart);
const listeners = source.slice(listenerStart, listenerEnd);
const autoCode = source.slice(begin, render);
const install = [
  'const state = { root: document.querySelector(".partner-hotel-workspace"), externalCalendar: { sources: [] } };',
  autoCode,
  listeners,
  '});',
].join('\n');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  await page.setContent('<!doctype html><html><body style="background:#090d18;"><main class="partner-hotel-workspace">' + content + '</main></body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: install });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.locator('.phw-calendar-wizard > summary').click();
  assert.equal(await page.locator('input[name="source_type"]').count(), 3);
  assert.equal(await page.locator('form[data-phw-calendar-wizard]').evaluate((form) => form.checkValidity()), false);

  await page.locator('input[value="booking_com"]').check();
  await page.locator('select[name="room_type_id"]').selectOption(roomId);
  const code = page.locator('input[name="code"]');
  assert.equal(await code.inputValue(), 'booking-' + roomId.replaceAll('-','').slice(0,12));
  assert.equal(await page.locator('[data-phw-wizard-guide="booking_com"]').isVisible(), true);
  assert.equal(await page.locator('[data-phw-wizard-guide="airbnb"]').isVisible(), false);
  assert.equal(await page.locator('form[data-phw-calendar-wizard]').evaluate((form) => form.checkValidity()), true);

  await page.locator('input[value="airbnb"]').check();
  assert.equal(await code.inputValue(), 'airbnb-' + roomId.replaceAll('-','').slice(0,12));
  assert.equal(await page.locator('[data-phw-wizard-guide="airbnb"]').isVisible(), true);
  await page.locator('.phw-calendar-wizard__advanced > summary').click();
  await code.fill('my-calendar');
  await page.locator('input[value="ical"]').check();
  assert.equal(await code.inputValue(), 'my-calendar', 'manual advanced code must be preserved');
  assert.equal(await page.locator('[data-phw-wizard-guide="ical"]').isVisible(), true);

  await page.evaluate(() => {
    window.__submits = 0;
    document.querySelector('form[data-phw-calendar-wizard]').addEventListener('submit', (e) => {
      e.preventDefault();
      window.__submits += 1;
    });
  });
  await page.locator('.phw-calendar-wizard__form button[type="submit"]').click();
  assert.equal(await page.evaluate(() => window.__submits), 1);
  assert.equal(await page.locator('input[name="ical_url"]').count(), 0);

  await page.setViewportSize({ width: 375, height: 812 });
  const columns = await page.locator('.phw-calendar-wizard__options').evaluate((node) =>
    getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length);
  assert.equal(columns, 1, 'mobile provider cards must stack in one column');
  assert.equal(await page.locator('form[data-phw-calendar-wizard]').isVisible(), true);
  await page.locator('.partner-hotel-workspace').evaluate((el) => el.setAttribute('dir','rtl'));
  assert.equal(await page.locator('.phw-calendar-wizard__next').evaluate((el) => getComputedStyle(el).paddingInlineStart !== '0px'), true);
  assert.deepEqual(errors, []);

  console.log('PASS calendar wizard real Chromium interactions (provider/room, advanced code, submit, mobile, RTL, no secret URL)');
} finally {
  await browser.close();
}
