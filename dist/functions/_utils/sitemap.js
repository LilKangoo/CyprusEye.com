import { createSupabaseClients } from './supabaseAdmin.js';
import {
  DEFAULT_PUBLIC_LANGUAGE,
  getLanguageQueryParam,
  getPublicLanguageCodes,
} from './languageRollout.js';
import { canGenerateHeSeo } from './heSeoReadiness.js';

export const SITEMAP_ORIGIN = 'https://www.cypruseye.com';

const STATIC_PUBLIC_URLS = [
  '/',
  '/advertise.html',
  '/attractions.html',
  '/blog',
  '/blog?lang=pl',
  '/car.html',
  '/community.html',
  '/cruise.html',
  '/hotels.html',
  '/kupon.html',
  '/packing.html',
  '/plan.html',
  '/recommendations.html',
  '/shop.html',
  '/tasks.html',
  '/transport.html',
  '/trips.html',
  '/vip.html',
];

const STATIC_HE_SITEMAP_URLS = [
  { path: '/', pageKey: 'home' },
  { path: '/transport.html', pageKey: 'transport' },
  { path: '/hotels.html', pageKey: 'hotels' },
  { path: '/recommendations.html', pageKey: 'recommendations' },
  { path: '/car.html', pageKey: 'car' },
  { path: '/trips.html', pageKey: 'trips' },
];

const SERVICE_SITEMAP_CONFIG = {
  hotels: '/hotel.html',
  trips: '/trip.html',
};

const SITEMAP_LANGUAGES = Object.freeze(getPublicLanguageCodes('sitemap'));
const SPECIAL_OFFER_SITEMAP_CANDIDATE_SLUGS = Object.freeze([
  'lefkara-giveaway-2026',
]);

export const SITEMAP_DYNAMIC_SOURCES = Object.freeze({
  blogPosts: Object.freeze({
    table: 'blog_posts',
    route: '/blog/{slug}',
    languages: SITEMAP_LANGUAGES,
  }),
  hotels: Object.freeze({
    table: 'hotels',
    route: '/hotel.html?slug={slug}',
    languages: SITEMAP_LANGUAGES,
  }),
  trips: Object.freeze({
    table: 'trips',
    route: '/trip.html?slug={slug}',
    languages: SITEMAP_LANGUAGES,
  }),
  specialOffers: Object.freeze({
    table: 'special_offers',
    route: '/special-offers/{slug}',
    languages: SITEMAP_LANGUAGES,
  }),
});

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeIsoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString();
}

function buildAbsoluteUrl(rawPath) {
  return new URL(String(rawPath || '/').trim() || '/', SITEMAP_ORIGIN).toString();
}

function buildHebrewStaticUrl(pathname) {
  const url = new URL(String(pathname || '/').trim() || '/', SITEMAP_ORIGIN);
  url.searchParams.set('lang', 'he');
  return url.toString();
}

function buildBlogPostUrl(slug, language) {
  const normalizedSlug = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
  if (!normalizedSlug) {
    return '';
  }
  const url = new URL(`/blog/${encodeURIComponent(normalizedSlug)}`, SITEMAP_ORIGIN);
  const languageParam = getLanguageQueryParam(language);
  if (language === 'he') {
    url.searchParams.set('lang', 'he');
  } else if (languageParam) {
    url.searchParams.set('lang', languageParam);
  }
  return url.toString();
}

function buildBlogListUrl(language) {
  const url = new URL('/blog', SITEMAP_ORIGIN);
  const languageParam = getLanguageQueryParam(language);
  if (language === 'he') {
    url.searchParams.set('lang', 'he');
  } else if (languageParam) {
    url.searchParams.set('lang', languageParam);
  }
  return url.toString();
}

function buildServiceOfferUrl(kind, slug, language) {
  const templatePath = SERVICE_SITEMAP_CONFIG[kind];
  const normalizedSlug = String(slug || '').trim();
  if (!templatePath || !normalizedSlug) {
    return '';
  }
  const url = new URL(templatePath, SITEMAP_ORIGIN);
  url.searchParams.set('slug', normalizedSlug);
  const languageParam = getLanguageQueryParam(language);
  if (language === 'he') {
    url.searchParams.set('lang', 'he');
  } else if (languageParam) {
    url.searchParams.set('lang', languageParam);
  }
  return url.toString();
}

function buildSpecialOfferUrl(slug, language) {
  const normalizedSlug = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
  if (!normalizedSlug) {
    return '';
  }
  const url = new URL(`/special-offers/${encodeURIComponent(normalizedSlug)}`, SITEMAP_ORIGIN);
  const languageParam = getLanguageQueryParam(language);
  if (languageParam) {
    url.searchParams.set('lang', languageParam);
  }
  return url.toString();
}

function getHeStaticSitemapEntries() {
  return STATIC_HE_SITEMAP_URLS
    .filter((entry) => canGenerateHeSeo({
      pageKey: entry.pageKey,
      language: 'he',
      surface: 'sitemap',
    }))
    .map((entry) => ({ loc: buildHebrewStaticUrl(entry.path) }));
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftLoc = String(left?.loc || '');
    const rightLoc = String(right?.loc || '');
    return leftLoc.localeCompare(rightLoc);
  });
}

function dedupeEntries(entries) {
  const byLoc = new Map();
  for (const entry of safeArray(entries)) {
    const loc = String(entry?.loc || '').trim();
    if (!loc) {
      continue;
    }
    const normalized = {
      loc,
      lastmod: normalizeIsoDate(entry?.lastmod),
    };
    const existing = byLoc.get(loc);
    if (!existing) {
      byLoc.set(loc, normalized);
      continue;
    }
    if (!existing.lastmod && normalized.lastmod) {
      byLoc.set(loc, normalized);
    }
  }
  return sortEntries(Array.from(byLoc.values()));
}

function escapeXml(value) {
  return String(value || '').replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return character;
    }
  });
}

function getReadClient(env) {
  const supabaseUrl = String(env?.SUPABASE_URL || '').trim();
  const anonKey = String(env?.SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = String(env?.SUPABASE_SERVICE_ROLE_KEY || anonKey).trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  try {
    const { publicClient, adminClient } = createSupabaseClients({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    });
    return publicClient || adminClient;
  } catch (error) {
    console.warn('[sitemap] Failed to create Supabase client:', error);
    return null;
  }
}

async function fetchPublishedBlogEntries(client) {
  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from('blog_posts')
    .select(`
      published_at,
      translations:blog_post_translations (
        lang,
        slug,
        review_status
      )
    `)
    .eq('status', 'published')
    .eq('submission_status', 'approved')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false });

  if (error) {
    console.warn('[sitemap] Failed to load blog sitemap entries:', error);
    return [];
  }

  const sitemapLanguages = new Set(SITEMAP_LANGUAGES);
  const entries = [];
  const heEntries = [];
  for (const row of safeArray(data)) {
    for (const translation of safeArray(row?.translations)) {
      const language = String(translation?.lang || '').trim().toLowerCase();
      const slug = String(translation?.slug || '').trim();
      if (!slug) {
        continue;
      }
      if (sitemapLanguages.has(language)) {
        entries.push({
          loc: buildBlogPostUrl(slug, language),
          lastmod: row?.published_at || '',
        });
        continue;
      }
      if (language === 'he'
        && String(translation?.review_status || '').trim() === 'public_ready'
        && canGenerateHeSeo({
          pageKey: 'blogPost',
          language: 'he',
          surface: 'sitemap',
          recordReady: true,
        })) {
        heEntries.push({
          loc: buildBlogPostUrl(slug, 'he'),
          lastmod: row?.published_at || '',
        });
      }
    }
  }
  if (heEntries.length && canGenerateHeSeo({
    pageKey: 'blog',
    language: 'he',
    surface: 'sitemap',
    recordReady: true,
  })) {
    const heLastmods = heEntries
      .map((entry) => entry.lastmod)
      .filter(Boolean)
      .sort();
    const lastmod = heLastmods[heLastmods.length - 1] || '';
    entries.push({
      loc: buildBlogListUrl('he'),
      lastmod,
    });
  }
  entries.push(...heEntries);
  return entries;
}

async function fetchPublishedServiceEntries(client, kind) {
  const table = kind === 'hotels' ? 'hotels' : kind === 'trips' ? 'trips' : '';
  if (!client || !table) {
    return [];
  }

  const { data, error } = await client
    .from(table)
    .select('slug, title, description')
    .eq('is_published', true)
    .not('slug', 'is', null);

  if (error) {
    console.warn(`[sitemap] Failed to load ${table} sitemap entries:`, error);
    return [];
  }

  return safeArray(data).flatMap((row) => {
    const slug = String(row?.slug || '').trim();
    if (!slug) {
      return [];
    }
    const entries = SITEMAP_LANGUAGES.map((language) => ({
      loc: buildServiceOfferUrl(kind, slug, language || DEFAULT_PUBLIC_LANGUAGE),
    }));
    const pageKey = kind === 'hotels' ? 'hotel' : 'trip';
    const heReady = Boolean(row?.title?.he && row?.description?.he);
    if (canGenerateHeSeo({
      pageKey,
      language: 'he',
      surface: 'sitemap',
      recordReady: heReady,
    })) {
      entries.push({
        loc: buildServiceOfferUrl(kind, slug, 'he'),
      });
    }
    return entries;
  });
}

async function fetchPublishedSpecialOfferEntries(client) {
  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from('special_offers')
    .select('slug, status, visibility, start_at, end_at, updated_at, archived_at')
    .in('status', ['active', 'ended', 'locked'])
    .eq('visibility', 'public')
    .is('archived_at', null)
    .not('slug', 'is', null)
    .order('updated_at', { ascending: false });

  const specialOfferRows = safeArray(data);
  if (error) {
    console.warn('[sitemap] Failed to load Special Offers sitemap entries:', error);
  }

  const now = Date.now();
  const entries = [];
  const seenSlugs = new Set();
  for (const row of specialOfferRows) {
    const slug = String(row?.slug || '').trim();
    if (!slug) {
      continue;
    }
    seenSlugs.add(slug);
    if (!(await shouldIncludeSpecialOfferInSitemap(client, row, slug, now))) {
      continue;
    }
    entries.push(...SITEMAP_LANGUAGES.map((language) => ({
      loc: buildSpecialOfferUrl(slug, language || DEFAULT_PUBLIC_LANGUAGE),
      lastmod: row?.updated_at || '',
    })).filter((entry) => entry.loc));
  }

  for (const slug of SPECIAL_OFFER_SITEMAP_CANDIDATE_SLUGS) {
    if (seenSlugs.has(slug)) {
      continue;
    }
    const { data: landingResult, error: landingError } = await client.rpc('get_public_special_offer_landing', {
      p_slug: slug,
    });
    if (landingError) {
      console.warn('[sitemap] Failed to check Special Offer landing state:', landingError);
      continue;
    }
    const campaign = landingResult?.campaign || null;
    if (!campaign || !(await shouldIncludeSpecialOfferInSitemap(client, campaign, slug, now))) {
      continue;
    }
    entries.push(...SITEMAP_LANGUAGES.map((language) => ({
      loc: buildSpecialOfferUrl(slug, language || DEFAULT_PUBLIC_LANGUAGE),
      lastmod: campaign?.updated_at || '',
    })).filter((entry) => entry.loc));
  }
  return entries;
}

async function shouldIncludeSpecialOfferInSitemap(client, campaign, slug, now) {
  const startAt = campaign?.start_at ? new Date(campaign.start_at).getTime() : null;
  const endAt = campaign?.end_at ? new Date(campaign.end_at).getTime() : null;
  const status = String(campaign?.status || '').trim();
  const activeInWindow = status === 'active'
    && (!startAt || now >= startAt)
    && (!endAt || now <= endAt);

  if (activeInWindow) {
    return true;
  }

  if ((status === 'ended' || status === 'locked') && (!startAt || now >= startAt)) {
    const { data: winnerResult, error: winnerError } = await client.rpc('get_public_special_offer_winner', {
      p_slug: slug,
    });
    if (winnerError) {
      console.warn('[sitemap] Failed to check Special Offer winner publication state:', winnerError);
    }
    return winnerResult?.winner_published === true;
  }

  return false;
}

export function getStaticSitemapEntries() {
  return dedupeEntries([
    ...STATIC_PUBLIC_URLS.map((loc) => ({ loc: buildAbsoluteUrl(loc) })),
    ...getHeStaticSitemapEntries(),
  ]);
}

export async function getDynamicSitemapEntries(env) {
  const client = getReadClient(env);
  if (!client) {
    return [];
  }

  const [blogResult, hotelResult, tripResult, specialOfferResult] = await Promise.allSettled([
    fetchPublishedBlogEntries(client),
    fetchPublishedServiceEntries(client, 'hotels'),
    fetchPublishedServiceEntries(client, 'trips'),
    fetchPublishedSpecialOfferEntries(client),
  ]);

  const resolved = [];
  for (const result of [blogResult, hotelResult, tripResult, specialOfferResult]) {
    if (result.status === 'fulfilled') {
      resolved.push(...safeArray(result.value));
    } else {
      console.warn('[sitemap] Failed to resolve one sitemap source:', result.reason);
    }
  }

  return dedupeEntries(resolved);
}

export async function getSitemapEntries(env) {
  const entries = [
    ...getStaticSitemapEntries(),
    ...(await getDynamicSitemapEntries(env)),
  ];
  return dedupeEntries(entries);
}

export function renderSitemapXml(entries) {
  const normalized = dedupeEntries(entries);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const entry of normalized) {
    if (entry.lastmod) {
      lines.push(`  <url><loc>${escapeXml(entry.loc)}</loc><lastmod>${escapeXml(entry.lastmod)}</lastmod></url>`);
    } else {
      lines.push(`  <url><loc>${escapeXml(entry.loc)}</loc></url>`);
    }
  }

  lines.push('</urlset>');
  return lines.join('\n');
}
