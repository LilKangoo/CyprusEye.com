import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

describe('HE final cleanup static guards', () => {
  test('first-visit language selector exposes Hebrew', () => {
    const source = readRepoFile('js/languageSelector.js');

    expect(source).toContain("he: { label: 'בחר', flag: '🇮🇱', fullName: 'עברית' }");
    expect(source).toContain("['pl', 'en', 'he'].includes(code)");
  });

  test('partner Links / Discounts has gated HE copy controls', () => {
    const html = readRepoFile('partners/index.html');
    const source = readRepoFile('js/partners.js');

    expect(html).toContain('partnerLinksPreviewLandingLinkHe');
    expect(html).toContain('btnPartnerLinksCopyLandingHe');
    expect(html).toContain('partnerLinksPreviewOfferLinkHe');
    expect(html).toContain('btnPartnerLinksCopyOfferHe');

    expect(source).toContain('getPartnerLinksHeReadiness');
    expect(source).toContain('Shop HE is excluded until checkout/payment QA is complete.');
    expect(source).toContain('Blog HE requires manual public_ready review before public links.');
    expect(source).toContain('Copy HE 🇮🇱');
  });

  test('known HE fallback risks no longer route UI text directly to PL', () => {
    const savedCatalog = readRepoFile('js/saved-catalog.js');
    const hotelPage = readRepoFile('hotel.html');
    const carReservation = readRepoFile('js/car-reservation.js');

    expect(savedCatalog).toContain("if (normalized.startsWith('he')) return 'he';");
    expect(savedCatalog).toContain("he: 'לא הצלחנו לסנכרן את הפריטים השמורים. נסו שוב.'");
    expect(hotelPage).toContain("text = language.startsWith('pl') ? plFallback : enFallback;");
    expect(hotelPage).toContain("const activeUrl = language.startsWith('he') ? urls.he");
    expect(carReservation).toContain('function currentUiLang()');
    expect(carReservation).toContain("const chain = lang === 'he' ? ['he', 'en', 'pl']");
  });
});
