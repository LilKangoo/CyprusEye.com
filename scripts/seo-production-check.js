import { getStaticSitemapEntries, SITEMAP_DYNAMIC_SOURCES, SITEMAP_ORIGIN } from '../functions/_utils/sitemap.js';
import {
  LEGACY_CAR_REDIRECT_PATHS,
  LEGACY_CAR_REDIRECT_TARGET,
} from '../functions/_utils/legacyRedirects.js';

const DEFAULT_ORIGIN = SITEMAP_ORIGIN;
const LEGACY_CAR_REDIRECTS = LEGACY_CAR_REDIRECT_PATHS.map((path) => [path, LEGACY_CAR_REDIRECT_TARGET]);
const STALE_SITEMAP_PATHS = Array.from(new Set([
  '/achievements.html',
  ...LEGACY_CAR_REDIRECT_PATHS.filter((path) => path.endsWith('.html')),
  '/deposit.html',
  '/index.html',
  '/terms.html',
]));

function showHelp() {
  console.log(`Usage: npm run seo:production -- [--origin=https://www.cypruseye.com] [--require-dynamic]

Checks live SEO-critical production behavior:
- robots.txt points to the active sitemap
- sitemap.xml contains all static public URLs
- sitemap.xml does not contain stale legacy URLs
- sitemap.xml contains dynamic blog/hotel/trip entries when available
- legacy car URLs redirect to /car.html with 301/302

By default, missing dynamic entries are reported as warnings because empty production tables are valid.
Use --require-dynamic to fail if blog/hotel/trip dynamic URLs are missing.`);
}

function parseArgs(argv) {
  const options = {
    origin: String(process.env.SEO_AUDIT_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, ''),
    requireDynamic: false,
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--require-dynamic') {
      options.requireDynamic = true;
    } else if (arg.startsWith('--origin=')) {
      options.origin = arg.slice('--origin='.length).replace(/\/+$/, '');
    }
  }
  return options;
}

function toAbsoluteUrl(origin, rawPath) {
  return new URL(rawPath, origin).toString();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'CyprusEye SEO production check' },
    ...options,
  });
  const text = await response.text().catch(() => '');
  return { response, text };
}

function extractSitemapLocs(xml) {
  const locs = [];
  const pattern = /<loc>([\s\S]*?)<\/loc>/gi;
  let match = pattern.exec(String(xml || ''));
  while (match) {
    locs.push(String(match[1] || '').trim());
    match = pattern.exec(String(xml || ''));
  }
  return locs.filter(Boolean);
}

function normalizeLocPath(loc) {
  try {
    const url = new URL(loc);
    return `${url.pathname}${url.search}`;
  } catch {
    return '';
  }
}

function getDynamicCounts(locs) {
  const urls = locs.flatMap((loc) => {
    try {
      return [new URL(loc)];
    } catch {
      return [];
    }
  });

  return {
    blogPosts: urls.filter((url) => url.pathname.startsWith('/blog/')).length,
    hotels: urls.filter((url) => (
      (url.pathname === '/hotel.html' && url.searchParams.has('slug'))
      || /^\/hotel\/[^/]+$/.test(url.pathname)
    )).length,
    trips: urls.filter((url) => (
      (url.pathname === '/trip.html' && url.searchParams.has('slug'))
      || /^\/trip\/[^/]+$/.test(url.pathname)
    )).length,
  };
}

function printRows(title, rows) {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log('  OK');
    return;
  }
  rows.forEach((row) => console.log(`  - ${row}`));
}

async function checkRobots(origin) {
  const errors = [];
  const warnings = [];
  const { response, text } = await fetchText(toAbsoluteUrl(origin, '/robots.txt'));

  if (!response.ok) {
    errors.push(`/robots.txt returned ${response.status}`);
    return { errors, warnings };
  }

  const expectedSitemap = `Sitemap: ${toAbsoluteUrl(origin, '/sitemap.xml')}`;
  if (!text.includes(expectedSitemap)) {
    errors.push(`/robots.txt is missing "${expectedSitemap}"`);
  }
  if (/Disallow:\s*\//i.test(text) && !/Allow:\s*\//i.test(text)) {
    warnings.push('/robots.txt contains a broad Disallow rule; review before deploy');
  }
  return { errors, warnings };
}

async function checkSitemap(origin, requireDynamic) {
  const errors = [];
  const warnings = [];
  const { response, text } = await fetchText(toAbsoluteUrl(origin, '/sitemap.xml'));

  if (!response.ok) {
    errors.push(`/sitemap.xml returned ${response.status}`);
    return { errors, warnings, locs: [] };
  }

  const locs = extractSitemapLocs(text);
  if (!locs.length) {
    errors.push('/sitemap.xml contains no <loc> entries');
    return { errors, warnings, locs };
  }

  const locSet = new Set(locs);
  const pathSet = new Set(locs.map(normalizeLocPath).filter(Boolean));
  const expectedStaticLocs = getStaticSitemapEntries().map((entry) => {
    const path = normalizeLocPath(entry.loc);
    return toAbsoluteUrl(origin, path || '/');
  });

  expectedStaticLocs.forEach((loc) => {
    if (!locSet.has(loc)) {
      errors.push(`/sitemap.xml is missing static URL: ${loc}`);
    }
  });

  STALE_SITEMAP_PATHS.forEach((path) => {
    if (pathSet.has(path)) {
      errors.push(`/sitemap.xml still includes stale URL: ${path}`);
    }
  });

  const dynamicCounts = getDynamicCounts(locs);
  Object.keys(SITEMAP_DYNAMIC_SOURCES || {}).forEach((key) => {
    const count = Number(dynamicCounts[key] || 0);
    if (count <= 0) {
      const message = `/sitemap.xml has no dynamic ${key} URLs`;
      if (requireDynamic) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  });

  return { errors, warnings, locs, dynamicCounts };
}

async function checkLegacyRedirects(origin) {
  const errors = [];
  const warnings = [];

  for (const [from, expectedTo] of LEGACY_CAR_REDIRECTS) {
    const { response } = await fetchText(toAbsoluteUrl(origin, from), { redirect: 'manual' });
    const status = response.status;
    const location = response.headers.get('location') || '';
    const targetPath = normalizeLocPath(new URL(location || expectedTo, origin).toString());
    if (![301, 302, 308].includes(status)) {
      errors.push(`${from} returned ${status}, expected redirect to ${expectedTo}`);
    } else if (targetPath !== expectedTo) {
      errors.push(`${from} redirects to ${targetPath || location}, expected ${expectedTo}`);
    } else if (status !== 301) {
      warnings.push(`${from} redirects with ${status}; 301 is preferred for SEO`);
    }
  }

  return { errors, warnings };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    showHelp();
    return;
  }

  const allErrors = [];
  const allWarnings = [];
  console.log('Production SEO check');
  console.log(`Origin: ${options.origin}`);

  const robots = await checkRobots(options.origin);
  const sitemap = await checkSitemap(options.origin, options.requireDynamic);
  const redirects = await checkLegacyRedirects(options.origin);

  allErrors.push(...robots.errors, ...sitemap.errors, ...redirects.errors);
  allWarnings.push(...robots.warnings, ...sitemap.warnings, ...redirects.warnings);

  printRows('Robots.txt', [...robots.errors, ...robots.warnings]);
  printRows('Sitemap.xml', [...sitemap.errors, ...sitemap.warnings]);
  if (sitemap.dynamicCounts) {
    printRows('Dynamic sitemap counts', Object.entries(sitemap.dynamicCounts)
      .map(([key, count]) => `${key}: ${count}`));
  }
  printRows('Legacy car redirects', [...redirects.errors, ...redirects.warnings]);

  console.log(`\nSummary: ${allErrors.length} error(s), ${allWarnings.length} warning(s).`);
  if (allErrors.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Production SEO check failed:', error);
  process.exit(1);
});
