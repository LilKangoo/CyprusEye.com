import assert from 'node:assert/strict';

import {
  assertHebrewPubliclyHidden,
  getPublicLanguageCodes,
} from '../functions/_utils/languageRollout.js';
import {
  getStaticSitemapEntries,
  renderSitemapXml,
  SITEMAP_DYNAMIC_SOURCES,
} from '../functions/_utils/sitemap.js';
import {
  applySeoToHtml,
  buildSeoPayload,
  resolveSeoRoute,
} from '../functions/_utils/pageSeo.js';
import { buildBlogPostSeoPayload } from '../functions/_utils/blogSeo.js';
import {
  canGenerateHeSeo,
  getHeSeoReadiness,
  HE_SEO_STATUS,
} from '../functions/_utils/heSeoReadiness.js';

function assertNoHebrewPublicSeoSurface(surface) {
  assert.equal(
    getPublicLanguageCodes(surface).includes('he'),
    false,
    `Hebrew must not be publicly enabled for ${surface} while HE SEO flags are off.`
  );
}

function assertNoHebrewSeoMarkup(value, label) {
  const text = String(value || '');
  assert.equal(text.includes('/he/'), false, `${label} must not contain /he/ routes.`);
}

const hiddenState = assertHebrewPubliclyHidden();
assert.equal(hiddenState.ok, true, `HE public surfaces: ${hiddenState.publicSurfaces.join(', ')}`);
assert.deepEqual(hiddenState.publicSurfaces, []);

for (const surface of ['seo', 'sitemap', 'hreflang', 'canonical', 'indexing']) {
  assertNoHebrewPublicSeoSurface(surface);
}

for (const [sourceName, source] of Object.entries(SITEMAP_DYNAMIC_SOURCES)) {
  assert.equal(
    source.languages.includes('he'),
    false,
    `Sitemap source ${sourceName} must not include HE while sitemap HE is off.`
  );
}

const sitemapXml = renderSitemapXml(getStaticSitemapEntries());
assertNoHebrewSeoMarkup(sitemapXml, 'static sitemap XML');
for (const allowedUrl of [
  'https://www.cypruseye.com/?lang=he',
  'https://www.cypruseye.com/transport.html?lang=he',
  'https://www.cypruseye.com/hotels.html?lang=he',
  'https://www.cypruseye.com/recommendations.html?lang=he',
  'https://www.cypruseye.com/car.html?lang=he',
  'https://www.cypruseye.com/trips.html?lang=he',
]) {
  assert.equal(sitemapXml.includes(allowedUrl), true, `Sitemap must include allowed HE URL: ${allowedUrl}`);
}
assert.equal(sitemapXml.includes('/blog?lang=he'), false, 'Sitemap must not include Blog HE.');
assert.equal(sitemapXml.includes('/shop.html?lang=he'), false, 'Sitemap must not include Shop HE.');

const homeRoute = resolveSeoRoute('/');
const homeSeoPayload = buildSeoPayload({
  route: homeRoute,
  language: 'he',
  requestPathname: '/',
  requestSearch: '?lang=he',
  translations: {
    'seo.home.title': 'בית',
    'seo.home.description': 'תיאור הבית',
    'seo.home.ogTitle': 'בית',
    'seo.home.ogDescription': 'תיאור הבית',
  },
  fallbackSeo: {
    title: 'Fallback title',
    description: 'Fallback description',
  },
});

assert.equal(homeSeoPayload.language, 'he', 'HE SEO request must stay HE on candidate-ready pages.');
assert.equal(Boolean(homeSeoPayload.languageUrls.he), true, 'HE alternate URL must be generated for ready pages.');
assert.equal(homeSeoPayload.canonicalUrl, 'https://www.cypruseye.com/?lang=he');

const html = '<!doctype html><html lang="en"><head><title>Old</title></head><body></body></html>';
const appliedHtml = applySeoToHtml(html, homeSeoPayload);
assertNoHebrewSeoMarkup(appliedHtml, 'SEO HTML');
assert.equal(appliedHtml.includes('lang="he"'), true, 'SEO HTML must set html lang HE on allowed pages.');
assert.equal(appliedHtml.includes('dir="rtl"'), true, 'SEO HTML must set server-rendered RTL direction on allowed HE pages.');
assert.equal(appliedHtml.includes('hreflang="he"'), true, 'SEO HTML must include HE hreflang on allowed pages.');

const blogSeoPayload = buildSeoPayload({
  route: resolveSeoRoute('/blog'),
  language: 'he',
  requestPathname: '/blog',
  requestSearch: '?lang=he',
  translations: {},
  fallbackSeo: {
    title: 'Blog',
    description: 'Blog description',
  },
  heSeo: { pageKey: 'blog', pathname: '/blog' },
});
assert.equal(blogSeoPayload.language, 'en', 'Blog HE SEO must normalize to EN while Blog is blocked.');
assert.equal(Boolean(blogSeoPayload.languageUrls.he), false, 'Blog HE hreflang must not be generated.');

const shopSeoPayload = buildSeoPayload({
  route: resolveSeoRoute('/shop.html'),
  language: 'he',
  requestPathname: '/shop.html',
  requestSearch: '?lang=he',
  translations: {},
  fallbackSeo: {
    title: 'Shop',
    description: 'Shop description',
  },
  heSeo: { pageKey: 'shop', pathname: '/shop.html' },
});
assert.equal(shopSeoPayload.language, 'en', 'Shop HE SEO must normalize to EN while Shop is excluded.');
assert.equal(Boolean(shopSeoPayload.languageUrls.he), false, 'Shop HE hreflang must not be generated.');

const blockedBlogPostSeoPayload = buildBlogPostSeoPayload({
  language: 'en',
  requestPathname: '/blog/etias-cyprus-2026',
  requestSearch: '?lang=he',
  post: {
    translation: {
      lang: 'he',
      slug: 'etias-cyprus-2026-he',
      title: 'ETIAS בקפריסין 2026',
      metaTitle: 'ETIAS בקפריסין 2026',
      metaDescription: 'מדריך למטיילים',
      summary: 'מדריך למטיילים',
      lead: 'מדריך למטיילים',
      ogImageUrl: '',
    },
    translationsByLang: {
      he: {
        lang: 'he',
        slug: 'etias-cyprus-2026-he',
        title: 'ETIAS בקפריסין 2026',
        metaTitle: 'ETIAS בקפריסין 2026',
        metaDescription: 'מדריך למטיילים',
        summary: 'מדריך למטיילים',
        lead: 'מדריך למטיילים',
      },
    },
  },
});
assert.equal(
  blockedBlogPostSeoPayload.canonicalUrl,
  'https://www.cypruseye.com/blog/etias-cyprus-2026',
  'Blocked Blog HE detail must not canonicalize to a Hebrew slug.'
);
assert.equal(
  /[\u0590-\u05ff]/.test(`${blockedBlogPostSeoPayload.title} ${blockedBlogPostSeoPayload.ogTitle}`),
  false,
  'Blocked Blog HE detail must not expose Hebrew title/OG metadata.'
);
assert.equal(
  Boolean(blockedBlogPostSeoPayload.languageUrls.he),
  false,
  'Blocked Blog HE detail must not generate HE hreflang.'
);

assert.equal(
  getHeSeoReadiness({ pageKey: 'home' }).status,
  HE_SEO_STATUS.CANDIDATE_READY,
  'Home should be SEO candidate-ready, not active.'
);
assert.equal(
  getHeSeoReadiness({ pageKey: 'blog' }).status,
  HE_SEO_STATUS.BLOCKED,
  'Blog must remain SEO-blocked.'
);
assert.equal(
  getHeSeoReadiness({ pageKey: 'shop' }).status,
  HE_SEO_STATUS.EXCLUDED,
  'Shop must remain SEO-excluded.'
);

const seoEnabledRollout = Object.freeze({ mode: 'partial_public', seoEnabled: true });
const seoDisabledRollout = Object.freeze({ mode: 'partial_public', seoEnabled: false });
const sitemapEnabledRollout = Object.freeze({ mode: 'partial_public', sitemapEnabled: true });
const hreflangEnabledRollout = Object.freeze({ mode: 'partial_public', hreflangEnabled: true });
const canonicalEnabledRollout = Object.freeze({ mode: 'partial_public', canonicalEnabled: true });
const indexingEnabledRollout = Object.freeze({ mode: 'partial_public', indexingEnabled: true });

assert.equal(
  canGenerateHeSeo({ pageKey: 'home', surface: 'seo' }),
  true,
  'Home HE SEO must be enabled by the controlled Stage48 guard.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'home', surface: 'seo', rollout: seoDisabledRollout }),
  false,
  'Home HE SEO must support explicit rollback via disabled rollout.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'home', surface: 'seo', rollout: seoEnabledRollout }),
  true,
  'Home HE SEO may be generated only after explicit SEO activation.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'blog', surface: 'seo', rollout: seoEnabledRollout }),
  false,
  'Blog HE SEO must stay blocked even when the SEO flag is enabled.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'shop', surface: 'seo', rollout: seoEnabledRollout }),
  false,
  'Shop HE SEO must stay excluded even when the SEO flag is enabled.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'trip', surface: 'seo', recordReady: false, rollout: seoEnabledRollout }),
  false,
  'Trip HE SEO requires a HE-ready record.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'trip', surface: 'seo', recordReady: true, rollout: seoEnabledRollout }),
  true,
  'Trip HE SEO may be generated only for HE-ready records after explicit SEO activation.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'poiMap', surface: 'seo', recordReady: true, rollout: seoEnabledRollout }),
  false,
  'POI/map HE should remain non-indexable until a standalone SEO route is approved.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'home', surface: 'sitemap', rollout: sitemapEnabledRollout }),
  true,
  'Home HE sitemap may be generated only after explicit sitemap activation.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'home', surface: 'hreflang', rollout: hreflangEnabledRollout }),
  true,
  'Home HE hreflang may be generated only after explicit hreflang activation.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'home', surface: 'canonical', rollout: canonicalEnabledRollout }),
  true,
  'Home HE canonical may be generated only after explicit canonical activation.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'home', surface: 'indexing', rollout: indexingEnabledRollout }),
  true,
  'Home HE indexing may be allowed only after explicit indexing activation.'
);
assert.equal(
  canGenerateHeSeo({ pageKey: 'home', surface: 'canonical', rollout: seoEnabledRollout }),
  false,
  'SEO activation alone must not activate HE canonical generation.'
);

console.log('HE SEO guard tests passed.');
