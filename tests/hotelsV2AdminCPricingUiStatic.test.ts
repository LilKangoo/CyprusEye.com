import fs from 'node:fs';

const dashboard = fs.readFileSync('admin/dashboard.html', 'utf8');
const core = fs.readFileSync('admin/hotels-v2-workspace-core.js', 'utf8');
const repository = fs.readFileSync('admin/hotels-v2-workspace-repository.js', 'utf8');
const ui = fs.readFileSync('admin/hotels-v2-workspace.js', 'utf8');
const css = fs.readFileSync('admin/admin.css', 'utf8');

function functionBody(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Hotels V2 ADMIN-C pricing UI/static gate', () => {
  test('wires the dedicated pricing control after Rooms and before Calendar', () => {
    const rooms = ui.indexOf("['rooms', 'Rooms & Rates']");
    const pricing = ui.indexOf("['pricing', 'Rates & Pricing']");
    const calendar = ui.indexOf("['calendar', 'Calendar']");
    expect(rooms).toBeGreaterThan(0);
    expect(pricing).toBeGreaterThan(rooms);
    expect(calendar).toBeGreaterThan(pricing);
    expect(repository).toContain("pricingControl: 'hotel_v2_admin_get_pricing_control'");
    expect(repository).toContain("applyPricingControl: 'hotel_v2_admin_apply_pricing_control_plan'");
    expect(repository).toContain("previewPricingQuote: 'hotel_v2_admin_preview_pricing_quote'");
    expect(dashboard).toContain('/admin/admin.css?v=20260821_1');
    expect(dashboard).toContain('/admin/hotels-v2-workspace-core.js?v=20260826_1');
    expect(dashboard).toContain('/admin/hotels-v2-workspace-repository.js?v=20260826_1');
    expect(dashboard).toContain('/admin/hotels-v2-workspace.js?v=20260826_1');
    expect(repository).toContain('data.replayed !== true && data.activity.some');
    expect(repository).toContain('receiptActivityProbe.recent_activity = Core.clone(data.activity)');
    expect(repository).toContain('Core.validatePricingControl(receiptActivityProbe');
    expect(repository).toContain('hotels_v2_admin_c_(?:idempotency_conflict|correlation_conflict)');
    expect(repository).toContain('original_mismatch');
  });

  test('has no referenced-but-undefined pricing editor or preview handler', () => {
    const referenced = new Set([...ui.matchAll(/\b(openPricing[A-Z][A-Za-z0-9_]*)\s*\(/g)].map((match) => match[1]));
    const declared = new Set([...ui.matchAll(/\bfunction\s+(openPricing[A-Z][A-Za-z0-9_]*)\s*\(/g)].map((match) => match[1]));
    expect([...referenced].filter((name) => !declared.has(name))).toEqual([]);
    expect(referenced).toContain('openPricingPreview');
    expect(ui).toContain('function openPropertyPricingDefaultEditor(');
    expect(referenced).toContain('openPricingScheduleCloneForProduct');
  });

  test('keeps the accepted 7 Kamares graph read-only and future properties fully reviewed', () => {
    expect(ui).toContain('7 Kamares ADMIN-C pricing is read-only');
    expect(ui).toContain('Its exact H3.1P parity graph must remain unchanged');
    expect(ui).toContain('pricingHotelMutationLocked');
    expect(core).toContain('The accepted 7 Kamares H3.1P pricing graph is read-only in ADMIN-C.');
    expect(ui).toContain('Clone schedule for this product');
    expect(ui).toContain('No intermediate detach or second network mutation occurs.');
    expect(ui).toContain('Use the separate Disable action');
    expect(ui).toContain('Save content, relationship or tier edits first, then disable this pricing object in a separate explicit Review.');
  });

  test('uses structured Rate Plan inclusions and tri-language content controls', () => {
    expect(ui).toContain('data-pricing-inclusion-list');
    expect(ui).toContain('name="custom_inclusion"');
    expect(ui).toContain('data-add-pricing-inclusion');
    expect(ui).toContain('data-remove-pricing-inclusion');
    expect(ui).not.toContain('name="custom_inclusions"');
    expect(ui).toContain("i18nFields('name', 'Rate Plan name'");
    expect(ui).toContain("i18nFields('description', 'Rate Plan description', plan.description_i18n, 'textarea', 5000)");
    expect(ui).toContain('dir="${language === \'he\' ? \'rtl\' : \'ltr\'}"');
    expect(ui).toContain("cancellation_policy: { type: 'requires_review', reason: '' }");
  });

  test('localizes primary ADMIN-C chrome in Polish and Hebrew without localizing diagnostics', () => {
    expect(ui).toContain("'Rates & Pricing': 'Ceny i plany taryfowe'");
    expect(ui).toContain("'Rates & Pricing': 'תמחור ותוכניות מחיר'");
    expect(ui).toContain("'Create Rate Plan draft': 'Utwórz wersję roboczą planu taryfowego'");
    expect(ui).toContain("'Create Rate Plan draft': 'צור טיוטת תוכנית מחיר'");
    expect(ui).toContain("'Save reviewed changes': 'Zapisz sprawdzone zmiany'");
    expect(ui).toContain("'Save reviewed changes': 'שמור שינויים שנבדקו'");
    expect(ui).toContain("'Price not requestable': 'Cena niedostępna do zamówienia'");
    expect(ui).toContain("'Price not requestable': 'לא ניתן לבקש מחיר'");
    expect(ui).toContain('function localizePricingUi(');
    expect(ui).toContain('localizePricingUi(panel);');
    expect(ui).not.toContain('document.createTreeWalker(rootNode');
    expect(ui).toContain("'.hotel-workspace-form label > span'");
    expect(ui).toContain("rootNode.querySelectorAll?.(chromeSelector)");
    expect(ui).toContain('function openPricingModal(');
    expect(ui).toContain('overlay.dataset.pricingUi = \'true\'');
    expect(ui).toContain('pricingUi: true');
    expect(ui).toContain("<details class=\"hotel-review-diagnostics\"><summary>Technical diagnostics</summary>");
  });

  test('localizes pricing card, editor option, weekday and Review chrome at render sites', () => {
    expect(ui).toContain("<dt>${pricingUiHtml('Customer selling price')}</dt>");
    expect(ui).toContain("<dt>${pricingUiHtml('Currency')}</dt>");
    expect(ui).toContain("<dt>${pricingUiHtml('Review')}</dt>");
    expect(ui).toContain("${pricingUiHtml(linked ? 'Retained but dormant' : 'Independent tiers authoritative when enabled')}");
    expect(ui).toContain("${pricingUiHtml('Flexible')}</option>");
    expect(ui).toContain("${pricingUiHtml('Customer chooses one Room Type')}</option>");
    expect(ui).toContain("${pricingUiHtml('Required multi-room bundle')}</option>");
    expect(ui).toContain("${pricingUiHtml(label)}</label>");
    expect(ui).toContain("${reviewChromeHtml('Field')}</th>");
    expect(ui).toContain("${reviewChromeHtml('Before')}</th>");
    expect(ui).toContain("${reviewChromeHtml('After')}</th>");
    expect(ui).toContain("${pricingUiHtml('Auto only when exactly one active reviewed Plan exists')}</option>");
    expect(ui).toContain("${pricingUiHtml('Last normalized selling-price fallback')}</h4>");
    expect(ui).toContain("${pricingUiHtml('Choose exact Room Type')}</option>");
    expect(ui).toContain("${pricingUiHtml('No linked schedule')}</option>${scheduleOptions}");
    expect(ui).toContain("${pricingUiHtml('Only the stored base price and currency are copied.");
    expect(ui).toContain("${pricingUiHtml('Choose exact unused pair')}</option>");
    expect(ui).toContain("${pricingUiHtml('Independent · one Room product maximum')}</option>");
    expect(ui).toContain("${pricingUiHtml('The selected price applies to the complete stay.");
    expect(ui).toContain("${pricingUiHtml('Choose exact Room Rate product')}</option>");
  });

  test('does not retain Calendar or Booking Setup as a second pricing writer', () => {
    expect(ui).not.toContain('function openCalendarRuleEditor(');
    expect(ui).not.toContain('function openOccupancyTierEditor(');
    const calendarRange = functionBody(ui, 'openCalendarRangeEditor', 'h3ExactId');
    expect(calendarRange).not.toContain('nightly_rate');
    expect(calendarRange).not.toContain('minimum_stay');
    expect(calendarRange).not.toContain('maximum_stay');
    expect(ui).toContain('Prices remain read-only here');
    expect(ui).toContain('Open Rates & Pricing');
    expect(ui).toContain('Guest → Room Type · read only here');
  });

  test('surfaces the exact fallback and highest-to-lowest server precedence', () => {
    expect(core).toContain("'room_rate_base_nightly_rate', 'property_default'");
    expect(core).toContain("'exact_date_price', 'seasonal_range_rule', 'weekday_rule'");
    expect(ui).toContain('Precedence layer 5 · property fallback');
    expect(ui).toContain('Legacy party pricing is never guessed as this fallback.');
    expect(ui).toContain('Pricing order · highest precedence → fallback');
    expect(ui).toContain('No nightly rows were calculated. Resolve the blockers above; no fallback price was invented.');
    expect(ui).toContain('Property fallback selling price authoritative');
    expect(ui).toContain('Independent occupancy / LOS tiers authoritative');
    expect(ui).toContain('Pricing source missing · configure Rates & Pricing');
    expect(ui).toContain("const authoritativeSource = String(rate.pricing_source || 'missing')");
    expect(ui).toContain('control.property_pricing_default.currency === rate.currency');
    expect(ui).toContain('Property booking mode:');
    expect(ui).toContain('state.pricingControl.property.booking_mode');
  });

  test('has responsive dark, RTL, overflow and keyboard-focus pricing styles', () => {
    for (const selector of [
      '.hotel-pricing-safety-banner',
      '.hotel-pricing-jump-nav',
      '.hotel-pricing-product-grid',
      '.hotel-pricing-schedule-grid',
      '.hotel-pricing-tier-table-wrap',
      '.hotel-pricing-rule-row',
      '.hotel-pricing-allocation-item-editor',
      '.hotel-pricing-property-default',
      '.hotel-pricing-preview-result',
      '.hotel-pricing-activity-row',
    ]) expect(css).toContain(selector);
    expect(css).toContain('html[dir="rtl"] .hotel-pricing-tier-table th');
    expect(css).toMatch(/@media \(max-width:760px\)[\s\S]*\.hotel-pricing-product-grid/);
    expect(css).toContain('.hotel-pricing-preview-result h4:focus-visible');
    expect(ui).toContain('<h4 tabindex="-1">');
    expect(ui).toContain("resultHost.querySelector('h4')?.focus?.()");
  });

  test('keeps strict no-retry, stale and sanitized activity boundaries visible', () => {
    expect(repository).toContain('nothing was retried');
    expect(repository).toContain("activity.source !== 'hotels_v2_admin_c_pricing_control'");
    expect(core).toContain("activity.source === 'historical_pricing_activity'");
    expect(core).toContain("activity.source === 'hotels_v2_admin_c_pricing_control'");
    expect(ui).toContain('Fresh non-overlapping values were preserved. Review this rebuilt plan and explicitly Save once.');
    expect(ui).toContain('matched: true');
    expect(ui).toContain('nothing was retried.');
  });
});
