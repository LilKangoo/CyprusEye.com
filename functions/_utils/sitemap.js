import { createSupabaseClients } from './supabaseAdmin.js';

export const SITEMAP_ORIGIN = 'https://www.cypruseye.com';

const STATIC_PUBLIC_URLS = [
  '/index.html',
  '/achievements.html',
  '/advertise.html',
  '/attractions.html',
  '/autopfo.html',
  '/blog?lang=en',
  '/blog?lang=pl',
  '/car-rental.html',
  '/car.html',
  '/community.html',
  '/cruise.html',
  '/deposit.html',
  '/hotels.html',
  '/kupon.html',
  '/packing.html',
  '/plan.html',
  '/recommendations.html',
  '/shop.html',
  '/tasks.html',
  '/terms.html',
  '/transport.html',
  '/trips.html',
  '/vip.html',
];

const SERVICE_SITEMAP_CONFIG = {
  hotels: '/hotel.html',
  trips: '/trip.html',
};

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

function buildBlogPostUrl(slug, language) {
  const normalizedSlug = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
  if (!normalizedSlug) {
    return '';
  }
  const url = new URL(`/blog/${encodeURIComponent(normalizedSlug)}`, SITEMAP_ORIGIN);
  url.searchParams.set('lang', language === 'pl' ? 'pl' : 'en');
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
  if (language === 'pl') {
    url.searchParams.set('lang', 'pl');
  }
  return url.toString();
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
        slug
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

  return safeArray(data).flatMap((row) => safeArray(row?.translations)
    .filter((translation) => ['pl', 'en'].includes(String(translation?.lang || '').trim().toLowerCase()))
    .map((translation) => ({
      loc: buildBlogPostUrl(translation?.slug, translation?.lang),
      lastmod: row?.published_at || '',
    }))
  );
}

async function fetchPublishedServiceEntries(client, kind) {
  const table = kind === 'hotels' ? 'hotels' : kind === 'trips' ? 'trips' : '';
  if (!client || !table) {
    return [];
  }

  const { data, error } = await client
    .from(table)
    .select('slug')
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
    return [
      { loc: buildServiceOfferUrl(kind, slug, 'en') },
      { loc: buildServiceOfferUrl(kind, slug, 'pl') },
    ];
  });
}

export function getStaticSitemapEntries() {
  return dedupeEntries(STATIC_PUBLIC_URLS.map((loc) => ({ loc: buildAbsoluteUrl(loc) })));
}

export async function getDynamicSitemapEntries(env) {
  const client = getReadClient(env);
  if (!client) {
    return [];
  }

  const [blogResult, hotelResult, tripResult] = await Promise.allSettled([
    fetchPublishedBlogEntries(client),
    fetchPublishedServiceEntries(client, 'hotels'),
    fetchPublishedServiceEntries(client, 'trips'),
  ]);

  const resolved = [];
  for (const result of [blogResult, hotelResult, tripResult]) {
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
