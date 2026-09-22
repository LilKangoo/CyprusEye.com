import fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
const dto = JSON.parse(fs.readFileSync('tests/integration/fixtures/hotels-v2-114492-synthetic-workspace.json', 'utf8'));

async function setup(page: Page, absent = false) {
  await page.clock.setFixedTime(new Date('2026-09-22T12:00:00Z'));
  await page.route('**/*', route => new URL(route.request().url()).pathname === '/114492-local'
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><body><div id="partnerPortalView"></div><section id="partnerHotelWorkspaceView" hidden></section><dialog id="partnerHotelWorkspaceReview"></dialog></body></html>' })
    : route.abort());
  await page.goto('/114492-local');
  for (const file of ['admin/admin.css', 'partners/hotels-v2-workspace.css']) await page.addStyleTag({ content: fs.readFileSync(file, 'utf8') });
  await page.evaluate(({ dto, absent }) => {
    const w = window as any; w.__calls492 = []; w.__dto492 = dto;
    w.getSupabase = () => ({ rpc: async (name: string, args: any) => {
      w.__calls492.push(name);
      if (name === 'hotel_v2_partner_get_workspace_114492' && !absent) {
        if (args.p_from !== dto.availability.from || args.p_to !== dto.availability.to) throw new Error('Synthetic fixture range mismatch');
        return { data: structuredClone(dto), error: null };
      }
      // Separate optional reads are intentionally unavailable; they must not
      // prevent the complete workspace/Payments/Availability DTO rendering.
      return { data: null, status: 404, error: { code: 'PGRST202', message: `Could not find the function public.${name} in the schema cache` } };
    } });
  }, { dto, absent });
  for (const file of ['admin/hotels-v2-workspace-core.js', 'js/hotels-v2-partner-workspace-core.js', 'js/hotels-v2-partner-workspace-repository.js', 'js/hotels-v2-workspace-help.js', 'js/hotels-v2-partner-workspace.js']) {
    await page.addScriptTag({ content: fs.readFileSync(file, 'utf8') });
  }
  await page.evaluate(async () => {
    const w = window as any, d = w.__dto492;
    await w.HotelsV2PartnerWorkspace.open({ partnerId: d.partner.id, assignment: { assignment_id: d.assignment.id, hotel_id: d.hotel_id } });
  });
}

for (const width of [1440, 390]) test(`114492 published workspace reads on ${width}px without mutation or legacy fallback`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 }); await setup(page);
  await expect(page.locator('[data-phw-panel="overview"]')).toBeVisible();
  await expect(page.locator('#partnerHotelWorkspaceView')).not.toContainText('hotels_lifecycle_catalog_drift');
  for (const section of ['rooms', 'rates_pricing', 'calendar_availability', 'payments']) {
    const direct = page.locator(`.phw-sidebar [data-phw-section="${section}"]:visible, .phw-mobile-nav [data-phw-section="${section}"]:visible`).first();
    if (await direct.count()) await direct.click();
    else { await page.locator('[data-phw-more]').click(); await page.locator(`[data-phw-drawer] [data-phw-section="${section}"]`).click(); }
    await expect(page.locator(`[data-phw-panel="${section}"]`)).toBeVisible();
    if (section === 'calendar_availability') await expect(page.locator('[data-phw-calendar-room]')).toBeVisible();
    if (section === 'payments') {
      await expect(page.locator('[data-phw-stripe-lifecycle]')).toContainText('NOT_CONNECTED');
      await expect(page.locator('[data-phw-stripe-lifecycle]')).toContainText('STALE');
      await expect(page.locator('[data-phw-stripe-connection]')).toHaveCount(0);
    }
  }
  const state = await page.evaluate(() => {
    const w = window as any;
    return { calls: w.__calls492, pricing: !!w.__dto492.pricing, availability: !!w.__dto492.availability,
      stripe: w.__dto492.stripe_connection.account_status, architecture: w.__dto492.property.architecture_version };
  });
  expect(state).toMatchObject({ pricing: true, availability: true, stripe: 'NOT_CONNECTED', architecture: 'rooms_v2' });
  expect(state.calls.filter((n: string) => n.includes('get_workspace'))).toEqual(['hotel_v2_partner_get_workspace_114492']);
  expect(state.calls.some((n: string) => /preview|apply|submit|oauth/.test(n))).toBe(false);
  expect(errors).toEqual([]);
});

test('missing successor shows actionable unavailable state without historical or raw fallback', async ({ page }) => {
  await setup(page, true);
  await expect(page.getByRole('alert')).toContainText('audited post-conversion Partner workspace is not installed yet');
  expect(await page.evaluate(() => (window as any).__calls492)).toEqual(['hotel_v2_partner_get_workspace_114492']);
});
