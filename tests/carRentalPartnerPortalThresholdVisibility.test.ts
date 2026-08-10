import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'js/partners.js'), 'utf8');

describe('threshold Cars fulfillment visibility in Partner Portal', () => {
  test('loads exact-partner service fulfillments without a payment or status gate', () => {
    const loadStart = source.indexOf('async function loadFulfillments()');
    const loadEnd = source.indexOf('function updateKpis', loadStart);
    const load = source.slice(loadStart, loadEnd);

    expect(load).toContain(".from('partner_service_fulfillments')");
    expect(load).toContain(".eq('partner_id', state.selectedPartnerId)");
    expect(load).not.toMatch(/\.eq\(['"]payment_status['"]/);
    expect(load).not.toMatch(/\.in\(['"]status['"],\s*\[[^\]]*accepted/);
  });

  test('uses exact ownership for threshold offers and retains legacy location filtering', () => {
    expect(source).toContain(".select('id, location, pricing_strategy, owner_partner_id')");
    expect(source).toContain("offerAccess?.pricingStrategy === 'threshold_daily_rate'");
    expect(source).toContain("offerAccess.ownerPartnerId === String(state.selectedPartnerId || '')");
    expect(source).toContain('if (hasCarsLocations && !allowedCarLocs.length) return false;');
    expect(source).toContain('return allowedCarLocs.includes(offerLoc);');
  });

  test('keeps partner acceptance and rejection explicit', () => {
    expect(source).toContain('data-action="accept"');
    expect(source).toContain('data-action="reject"');
    expect(source).toContain("callServiceFulfillmentAction(fulfillmentId, 'accept'");
    expect(source).toContain("callServiceFulfillmentAction(fulfillmentId, 'reject'");
  });
});
