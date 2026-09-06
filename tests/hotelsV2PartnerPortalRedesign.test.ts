import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const ui = read('js/hotels-v2-partner-workspace.js');
const css = read('partners/hotels-v2-workspace.css');

describe('Partner hotel redesign presentation boundaries', () => {
  test('V2 composes Overview status, permissions and navigation without changing business authority', () => {
    const overview = ui.slice(ui.indexOf('  function renderOverview()'), ui.indexOf('  function i18nFields('));
    expect(overview).toContain('Core.CAPABILITIES.filter((key) => capability(key))');
    expect(overview).toContain('phw-permission-list');
    expect(overview).toContain('phw-status-summary');
    expect(overview).not.toContain('<form');
    expect(ui).toContain('phw-mobile-header');
    expect(ui).toContain('phw-status-cell');
    expect(ui).toContain("state.lastRefresh ? `<div class=\"phw-refresh-banner\"");
    expect(css).toContain('.phw-status-summary, .phw-overview-quick { display: none; }');
    expect(css).toContain('grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr)');
  });
  test('new presentation copy covers the same keys in EN, PL and HE', () => {
    const literal = ui.match(/const PORTAL_COPY = (\{[\s\S]*?\n  \});/)?.[1];
    expect(literal).toBeTruthy();
    const copy = Function(`return (${literal})`)();
    expect(Object.keys(copy.pl).sort()).toEqual(Object.keys(copy.en).sort());
    expect(Object.keys(copy.he).sort()).toEqual(Object.keys(copy.en).sort());
    for (const language of ['en', 'pl', 'he']) {
      expect(Object.values(copy[language]).every((value) => typeof value === 'string' && value.length > 0)).toBe(true);
    }
  });

  test('public enablement is separate from assignment-backed workspace status', () => {
    expect(ui).toContain('state.workspace.feature_flags.hotel_rooms_v2_enabled');
    expect(ui).toContain('state.workspace.sections.overview.available');
    expect(ui).toContain("capability('manage_prices') && state.pricingControl && !hasPending");
    expect(ui).toContain('state.workspace.feature_flags.hotel_stripe_connect_enabled === false');
    expect(ui).toContain("text('notConfigured'), 'muted'");
  });

  test('all independent tier identities survive presentation-only grouping', () => {
    expect(ui).toContain('target.tiers.map((tier) => tier.guest_count)');
    expect(ui).toContain('target.tiers.map((tier) => tier.threshold_nights)');
    expect(ui).toContain('data-tier-id="${html(tier.id)}"');
    expect(ui).toContain('data-before-price="${html(tier.nightly_rate)}"');
    expect(ui).toContain('data-phw-guest-filter');
    expect(ui).not.toMatch(/Array\(27\)|Array\.from\(\{\s*length:\s*27/);
    expect(css).toContain('[data-guest-hidden="true"]');
  });

  test('facts and commercial amounts remain server-owned, missing size is explicit', () => {
    expect(ui).toContain("room.size_sqm == null ? text('notProvided')");
    expect(ui).toContain('formatMoney(policy.amount, policy.currency)');
    expect(ui).toContain("`${amount} ${text('perRoomNight')}`");
    expect(ui).not.toMatch(/name=["'](?:commission|commission_amount|partner_net|payout_bank_account)["']/);
    expect(ui).not.toMatch(/\.from\(['"]hotel_|\.rpc\(/);
  });

  test('responsive navigation, diagnostics and help are scoped with explicit focus', () => {
    expect(css).toContain('.partners-page.phw-open #adminSidebar');
    expect(css).toContain('.phw-mobile-nav');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('inset-inline: 0');
    expect(ui).toContain('drawer.onclose');
    expect(ui).toContain("document.body.classList.remove('phw-open')");
    expect(ui).not.toMatch(/setInterval\(/);
  });

  test('both real entrypoints reference the same redesigned assets', () => {
    for (const file of ['partners.html', 'partners/index.html']) {
      const html = read(file);
      expect(html).toContain('hotels-v2-workspace.css?v=20260906_1');
      expect(html).toContain('hotels-v2-partner-workspace.js?v=20260906_1');
      expect(html).toContain('hotels-v2-partner-workspace-repository.js?v=20260831_2');
    }
  });
});
