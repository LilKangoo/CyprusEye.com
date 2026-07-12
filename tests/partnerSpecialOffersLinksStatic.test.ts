import fs from 'node:fs';
import path from 'node:path';

describe('Partner Portal Special Offers links integration static guards', () => {
  const root = process.cwd();
  const source = fs.readFileSync(path.join(root, 'js/partners.js'), 'utf8');

  test('uses one partner listing RPC and no raw Special Offers table reads', () => {
    expect(source).toContain("state.sb.rpc('get_partner_active_special_offers'");
    expect(source).not.toMatch(/\.from\(['"]special_offers['"]\)/);
    expect(source).not.toMatch(/\.from\(['"]special_offer_translations['"]\)/);
    expect(source).not.toContain('get_public_special_offer_landing');
  });

  test('does not write Special Offers or expose private campaign data in Partner Portal', () => {
    expect(source).not.toMatch(/\.from\(['"]special_offer_(entries|entry_answers|entry_activities|audit_log|winner_)[^'"]*['"]\)/);
    expect(source).not.toMatch(/\.from\(['"]special_offer[^'"]*['"]\)[\s\S]{0,240}\.(insert|update|delete|upsert)\(/);
    expect(source).not.toMatch(/service_role|SUPABASE_SERVICE|serviceRole/i);
  });

  test('builds clean Special Offer routes through existing referral link helper', () => {
    expect(source).toContain("if (type === 'special_offers')");
    expect(source).toContain("url.pathname = slug ? `/special-offers/${encodeURIComponent(slug)}` : '/special-offers'");
    expect(source).toContain("url.searchParams.set('lang', language)");
    expect(source).toContain('return buildReferralLink(code, baseUrl) || baseUrl');
    expect(source).not.toMatch(/special-offer\.html\?slug=/);
  });

  test('uses safe Special Offer image fallbacks and graphical placeholder', () => {
    expect(source).toContain('PARTNER_LINKS_SPECIAL_OFFER_PLACEHOLDER_IMAGE');
    expect(source).toContain('function getSpecialOfferPartnerLinksImageUrl(row)');
    expect(source).toContain('getSafePartnerLinksImageUrl(row?.cover_image_url)');
    expect(source).toContain('getSafePartnerLinksImageUrl(row?.hero_image_url)');
    expect(source).toContain('getSafePartnerLinksImageUrl(row?.meta_image_url)');
    expect(source).toContain('PARTNER_LINKS_SPECIAL_OFFER_PLACEHOLDER_IMAGE');
  });
});
