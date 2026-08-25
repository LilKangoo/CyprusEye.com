import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string): string => fs.readFileSync(path.join(root, relative), 'utf8');
const sha256 = (relative: string): string => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');

describe('Hotels V2 H3.2B independent Partner workspace static security', () => {
  const core = read('js/hotels-v2-partner-workspace-core.js');
  const repository = read('js/hotels-v2-partner-workspace-repository.js');
  const workspace = read('js/hotels-v2-partner-workspace.js');
  const media = read('js/hotels-v2-partner-media.js');

  test('has no browser raw normalized-table fallback or Admin mutation RPC', () => {
    const browserSource = [core, repository, workspace, media].join('\n');
    expect(repository).not.toMatch(/\.from\s*\(/);
    expect(browserSource).not.toMatch(/hotel_v2_admin_(?:get|preview|apply|create|update|delete)/);
    expect(browserSource).not.toMatch(/(?:hotel_rate_plans|hotel_room_rates|hotel_pricing_schedules|hotel_daily_inventory)["'`]\s*\)/);
    expect(repository).not.toMatch(/commission_policy/i);
    expect(core).toContain("'commission_policy', 'commission_mode', 'commission_amount', 'commission_rate'");
    expect(core).toContain("'architecture_version', 'is_published', 'feature_flags', 'public_change', 'legacy_authoritative'");
  });

  test('keeps capability, legacy and all-flags-OFF guards in the strict workspace contract', () => {
    expect(core).toContain('const CAPABILITIES = Object.freeze([');
    expect(core).toContain('const FEATURE_FLAGS = Object.freeze([');
    expect(core).toContain("if (value.legacy_authoritative !== true || value.public_change !== false || value.property.architecture_version !== 'legacy')");
    expect(core).toContain("FEATURE_FLAGS.forEach((key) => { if (value.feature_flags[key] !== false)");
    expect(core).toContain('Loaded assignment does not permit this exact reviewed entity.');
    expect(workspace).toContain("state.root.dir = state.language === 'he' ? 'rtl' : 'ltr'");
    expect(workspace).toContain("pl: {");
    expect(workspace).toContain("he: {");
  });

  test('leaves the accepted fulfillment mutation source byte-exact and uses bookings/payments as existing-flow visibility only', () => {
    expect(sha256('supabase/functions/partner-fulfillment-action/index.ts'))
      .toBe('802aa0b8d3a1204f93adefcf598a77c764fde4a6e15dfe2624366c0a99c1297b');
    expect(workspace).not.toContain('partner-fulfillment-action');
    expect(core).toContain("'process_bookings'");
    expect(core).toContain("'view_payment_status'");
    expect(core).toContain("'existing_flow'");
  });

  test.each(['partners.html', 'partners/index.html'])('%s loads the same reviewed workspace modules and accessible entrypoint', (entry) => {
    const html = read(entry);
    const partnerDiscovery = read('js/partners.js');
    expect(html).toContain('id="partnerAssignedHotelsCard"');
    expect(partnerDiscovery).toContain('data-assigned-hotel-workspace');
    expect(html).toContain('/js/hotels-v2-partner-workspace-core.js?v=20260825_1');
    expect(html).toContain('/js/hotels-v2-partner-workspace-repository.js?v=20260825_1');
    expect(html).toContain('/js/hotels-v2-partner-media.js?v=20260825_1');
    expect(html).toContain('/js/hotels-v2-partner-workspace.js?v=20260825_1');
  });
});
