import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import { fileURLToPath } from 'url';
import {
  getStaticSitemapEntries,
  renderSitemapXml,
  SITEMAP_DYNAMIC_SOURCES,
  SITEMAP_ORIGIN,
} from '../functions/_utils/sitemap.js';
import {
  applySeoToHtml,
  buildSeoPayload,
  extractSeoFallbacksFromHtml,
  resolveSeoRoute,
} from '../functions/_utils/pageSeo.js';
import {
  LEGACY_CAR_REDIRECT_PATHS,
  LEGACY_CAR_REDIRECT_TARGET,
} from '../functions/_utils/legacyRedirects.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SEO_AUDIT_LANGUAGES = ['en', 'pl'];
const TITLE_MAX_LENGTH = 70;
const DESCRIPTION_MAX_LENGTH = 170;

const EXCLUDED_DIRS = new Set([
  '.git',
  '.jest-dist',
  'DELETED_BACKUPS',
  'backup',
  'dist',
  'node_modules',
  'test-results',
]);

const EXPECTED_PRIVATE_PREFIXES = [
  '/account/',
  '/auth/',
  '/reset/',
  '/admin/',
  '/partners/',
  '/public/admin/',
];

const MAIN_CAR_FLOW_URL = LEGACY_CAR_REDIRECT_TARGET;
const LEGACY_CAR_FLOW_URLS = LEGACY_CAR_REDIRECT_PATHS.filter((urlPath) => urlPath.endsWith('.html'));
const LEGACY_CAR_REDIRECTS = LEGACY_CAR_REDIRECT_PATHS.map((urlPath) => [urlPath, MAIN_CAR_FLOW_URL]);

const LOCAL_ROUTE_ALIASES = new Map([
  ['/blog', '/blog.html'],
]);

const REQUIRED_HOME_LINKS = [
  { path: '/car.html', label: 'cars' },
  { path: '/trips.html', label: 'trips' },
  { path: '/hotels.html', label: 'hotels' },
  { path: '/transport.html', label: 'transport' },
  { path: '/recommendations.html', label: 'recommendations' },
  { path: '/shop.html', label: 'shop' },
  { path: '/community.html', label: 'community' },
  { path: '/blog', label: 'blog' },
];

const REQUIRED_DYNAMIC_SITEMAP_SOURCES = ['blogPosts', 'hotels', 'trips'];

const INTENTIONAL_CANONICALS = new Map([
  ['/autopfo.html', '/car.html'],
  ['/blog-post.html', '/blog'],
  ['/blog.html', '/blog'],
  ['/car-rental-landing.html', '/car.html'],
  ['/car-rental.html', '/car.html'],
]);

function stripHtmlComments(html) {
  return String(html || '').replace(/<!--[\s\S]*?-->/g, '');
}

function stripNonRenderedBlocks(html) {
  return stripHtmlComments(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<template\b[\s\S]*?<\/template>/gi, '');
}

function firstMatch(html, pattern) {
  const match = pattern.exec(stripHtmlComments(html));
  return match ? String(match[1] || '').trim() : '';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTitle(html) {
  return firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
}

function extractMetaContent(html, name) {
  const safeName = escapeRegExp(name);
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\bname=["']${safeName}["'])(?=[^>]*\\bcontent=["']([^"']*)["'])[^>]*>`, 'i');
  return firstMatch(html, pattern);
}

function extractLinkHref(html, rel) {
  const safeRel = escapeRegExp(rel);
  const pattern = new RegExp(`<link\\b(?=[^>]*\\brel=["']${safeRel}["'])(?=[^>]*\\bhref=["']([^"']*)["'])[^>]*>`, 'i');
  return firstMatch(html, pattern);
}

function extractAlternateLinks(html) {
  const alternates = {};
  const source = stripHtmlComments(html);
  const pattern = /<link\b[^>]*>/gi;
  let match = pattern.exec(source);
  while (match) {
    const tag = match[0];
    const relTokens = extractHtmlAttribute(tag, 'rel').toLowerCase().split(/\s+/).filter(Boolean);
    if (relTokens.includes('alternate')) {
      const hreflang = extractHtmlAttribute(tag, 'hreflang').toLowerCase();
      const href = extractHtmlAttribute(tag, 'href');
      if (hreflang && href) {
        alternates[hreflang] = href;
      }
    }
    match = pattern.exec(source);
  }
  return alternates;
}

function hasHtmlAttribute(tag, name) {
  const safeName = escapeRegExp(name);
  return new RegExp(`\\b${safeName}(?:\\s*=|\\s|>|$)`, 'i').test(String(tag || ''));
}

function extractHtmlAttribute(tag, name) {
  const safeName = escapeRegExp(name);
  const pattern = new RegExp(`\\b${safeName}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const match = pattern.exec(String(tag || ''));
  return match ? String(match[2] || '').trim() : '';
}

function normalizePathFromUrl(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value, SITEMAP_ORIGIN);
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith('/') ? value : `/${value}`;
  }
}

function normalizeInternalHref(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value || value.startsWith('#') || /^(?:mailto|tel|javascript):/i.test(value)) {
    return '';
  }
  try {
    const url = new URL(value, SITEMAP_ORIGIN);
    if (url.origin !== SITEMAP_ORIGIN) {
      return '';
    }
    return url.pathname;
  } catch {
    return value.startsWith('/') ? value.split(/[?#]/)[0] : `/${value.split(/[?#]/)[0]}`;
  }
}

function isAbsoluteSitemapOriginUrl(rawValue) {
  try {
    const url = new URL(String(rawValue || ''));
    return url.origin === SITEMAP_ORIGIN;
  } catch {
    return false;
  }
}

function parseRedirects(source) {
  const redirects = new Map();
  String(source || '').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [from, to, status] = trimmed.split(/\s+/);
    if (from && to && status) {
      redirects.set(from, { to, status });
    }
  });
  return redirects;
}

function pathToUrlPath(relativePath) {
  const normalized = `/${relativePath.split(sep).join('/')}`;
  if (normalized.endsWith('/index.html')) {
    return normalized.replace(/\/index\.html$/, '/');
  }
  return normalized;
}

function extractRenderedImageIssues(relativePath, html) {
  const source = stripNonRenderedBlocks(html);
  const issues = [];
  const pattern = /<img\b[^>]*>/gi;
  let match = pattern.exec(source);
  while (match) {
    const tag = match[0];
    if (!hasHtmlAttribute(tag, 'alt')) {
      const src = extractHtmlAttribute(tag, 'src') || extractHtmlAttribute(tag, 'data-src') || 'inline image';
      issues.push(`${relativePath} image is missing alt text (${src})`);
    }
    match = pattern.exec(source);
  }
  return issues;
}

function extractRenderedInternalLinks(html) {
  const source = stripNonRenderedBlocks(html);
  const links = new Set();
  const pattern = /<a\b[^>]*>/gi;
  let match = pattern.exec(source);
  while (match) {
    const href = normalizeInternalHref(extractHtmlAttribute(match[0], 'href'));
    if (href) {
      links.add(href);
    }
    match = pattern.exec(source);
  }
  return links;
}

function extractJsonLdScripts(html) {
  const scripts = [];
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const source = stripHtmlComments(html);
  let match = pattern.exec(source);
  while (match) {
    scripts.push(String(match[1] || '').trim());
    match = pattern.exec(source);
  }
  return scripts;
}

function parseJsonLdScripts(relativePath, scripts) {
  const issues = [];
  const types = new Set();

  scripts.forEach((script, index) => {
    try {
      const payload = JSON.parse(script);
      const items = Array.isArray(payload) ? payload : [payload];
      items.forEach((item) => {
        const type = item?.['@type'];
        if (typeof type === 'string' && type) {
          types.add(type);
        }
      });
    } catch (error) {
      issues.push(`${relativePath} JSON-LD script #${index + 1} is not valid JSON: ${error.message}`);
    }
  });

  return {
    issues,
    types: Array.from(types).sort(),
  };
}

async function collectHtmlFiles() {
  const results = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(ROOT, fullPath);
      const topLevel = relPath.split(sep)[0];
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name) || EXCLUDED_DIRS.has(topLevel)) continue;
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.html')) {
        results.push(relPath);
      }
    }
  }

  await walk(ROOT);
  return results.sort();
}

async function loadAuditTranslations() {
  const entries = await Promise.all(SEO_AUDIT_LANGUAGES.map(async (language) => {
    try {
      const source = await readFile(join(ROOT, 'translations', `${language}.json`), 'utf8');
      return [language, JSON.parse(source)];
    } catch {
      return [language, {}];
    }
  }));
  return Object.fromEntries(entries);
}

async function readPageMeta(relativePath, translationsByLanguage) {
  const html = await readFile(join(ROOT, relativePath), 'utf8');
  const urlPath = pathToUrlPath(relativePath);
  const route = resolveSeoRoute(urlPath);
  const fallbackSeo = extractSeoFallbacksFromHtml(html);
  const renderedByLanguage = Object.fromEntries(SEO_AUDIT_LANGUAGES.map((language) => [
    language,
    route
      ? applySeoToHtml(
        html,
        buildSeoPayload({
          route,
          language,
          requestPathname: urlPath,
          translations: translationsByLanguage[language] || {},
          fallbackSeo,
        })
      )
      : html,
  ]));
  const renderedHtml = renderedByLanguage.en || html;
  const localized = Object.fromEntries(SEO_AUDIT_LANGUAGES.map((language) => {
    const rendered = renderedByLanguage[language] || html;
    return [language, {
      title: extractTitle(rendered),
      description: extractMetaContent(rendered, 'description'),
      robots: extractMetaContent(rendered, 'robots'),
      canonical: normalizePathFromUrl(extractLinkHref(rendered, 'canonical')),
      alternates: extractAlternateLinks(rendered),
    }];
  }));
  const jsonLd = parseJsonLdScripts(relativePath, extractJsonLdScripts(renderedHtml));
  return {
    relativePath,
    urlPath,
    robots: localized.en?.robots || '',
    canonical: localized.en?.canonical || '',
    seoPage: firstMatch(html, /<body\b[^>]*\bdata-seo-page=["']([^"']+)["']/i),
    imageIssues: extractRenderedImageIssues(relativePath, html),
    internalLinks: Array.from(extractRenderedInternalLinks(html)).sort(),
    localized,
    jsonLdTypes: jsonLd.types,
    jsonLdIssues: jsonLd.issues,
  };
}

function isNoindex(robots) {
  return String(robots || '').toLowerCase().split(',').map((part) => part.trim()).includes('noindex');
}

function isPrivatePath(urlPath) {
  return EXPECTED_PRIVATE_PREFIXES.some((prefix) => urlPath === prefix || urlPath.startsWith(prefix));
}

function printSection(title, rows) {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log('  OK');
    return;
  }
  for (const row of rows) {
    console.log(`  - ${row}`);
  }
}

async function main() {
  const htmlFiles = await collectHtmlFiles();
  const translationsByLanguage = await loadAuditTranslations();
  const pageMeta = await Promise.all(htmlFiles.map((relativePath) => readPageMeta(relativePath, translationsByLanguage)));
  const pageByPath = new Map(pageMeta.map((page) => [page.urlPath, page]));
  for (const [routePath, filePath] of LOCAL_ROUTE_ALIASES.entries()) {
    const page = pageByPath.get(filePath);
    if (page) {
      pageByPath.set(routePath, page);
    }
  }
  const sitemapPaths = getStaticSitemapEntries().map((entry) => normalizePathFromUrl(entry.loc));
  const sitemapPathSet = new Set(sitemapPaths);
  const expectedStaticSitemapXml = `${renderSitemapXml(getStaticSitemapEntries())}\n`;
  const trackedSitemapPath = join(ROOT, 'sitemap.xml');
  const trackedSitemapWarnings = [];
  if (!existsSync(trackedSitemapPath)) {
    trackedSitemapWarnings.push('sitemap.xml is missing from the repository root');
  } else {
    const trackedSitemapXml = await readFile(trackedSitemapPath, 'utf-8');
    if (trackedSitemapXml.trim() !== expectedStaticSitemapXml.trim()) {
      trackedSitemapWarnings.push('sitemap.xml is not synchronized with functions/_utils/sitemap.js static entries');
    }
  }
  const redirectsPath = join(ROOT, '_redirects');
  const legacyCarRedirectWarnings = [];
  if (!existsSync(redirectsPath)) {
    legacyCarRedirectWarnings.push('_redirects file is missing, so legacy car routes cannot be protected by 301 redirects');
  } else {
    const redirectMap = parseRedirects(await readFile(redirectsPath, 'utf-8'));
    LEGACY_CAR_REDIRECTS.forEach(([from, expectedTo]) => {
      const rule = redirectMap.get(from);
      if (!rule) {
        legacyCarRedirectWarnings.push(`${from} is missing a 301 redirect to ${expectedTo}`);
      } else if (rule.to !== expectedTo || rule.status !== '301') {
        legacyCarRedirectWarnings.push(`${from} redirects to ${rule.to} ${rule.status}, expected ${expectedTo} 301`);
      }
    });
  }

  const sitemapNoindexConflicts = sitemapPaths
    .map((urlPath) => {
      const page = pageByPath.get(urlPath);
      return page && isNoindex(page.robots) ? `${urlPath} (${page.relativePath}: robots=${page.robots})` : '';
    })
    .filter(Boolean);

  const sitemapMissingLocalPages = sitemapPaths
    .filter((urlPath) => !urlPath.startsWith('/blog?'))
    .filter((urlPath) => !pageByPath.has(urlPath))
    .map((urlPath) => `${urlPath} is listed in static sitemap but no matching local HTML file was found`);

  const indexablePrivatePages = pageMeta
    .filter((page) => isPrivatePath(page.urlPath))
    .filter((page) => !isNoindex(page.robots))
    .map((page) => `${page.urlPath} (${page.relativePath}) has no explicit noindex`);

  const canonicalWarnings = pageMeta
    .filter((page) => page.canonical)
    .filter((page) => page.urlPath !== '/' && !isPrivatePath(page.urlPath))
    .filter((page) => INTENTIONAL_CANONICALS.get(page.urlPath) !== page.canonical)
    .filter((page) => page.canonical !== page.urlPath)
    .map((page) => `${page.urlPath} canonical -> ${page.canonical}`);

  const homePage = pageByPath.get('/');
  const homeCanonicalWarning = homePage?.canonical && homePage.canonical !== '/'
    ? [`/ canonical -> ${homePage.canonical}`]
    : [];

  const publicMetaWarnings = sitemapPaths
    .filter((urlPath) => !urlPath.startsWith('/blog?'))
    .filter((urlPath) => !isPrivatePath(urlPath))
    .flatMap((urlPath) => {
      const page = pageByPath.get(urlPath);
      if (!page) return [];
      return SEO_AUDIT_LANGUAGES.flatMap((language) => {
        const meta = page.localized?.[language] || {};
        const rows = [];
        if (!meta.title) {
          rows.push(`${urlPath} [${language}] is missing a rendered title`);
        } else if (meta.title.length > TITLE_MAX_LENGTH) {
          rows.push(`${urlPath} [${language}] title is ${meta.title.length} chars (max ${TITLE_MAX_LENGTH}): ${meta.title}`);
        }
        if (!meta.description) {
          rows.push(`${urlPath} [${language}] is missing a rendered meta description`);
        } else if (meta.description.length > DESCRIPTION_MAX_LENGTH) {
          rows.push(`${urlPath} [${language}] description is ${meta.description.length} chars (max ${DESCRIPTION_MAX_LENGTH}): ${meta.description}`);
        }
        return rows;
      });
    });

  const publicHreflangWarnings = sitemapPaths
    .filter((urlPath) => !urlPath.startsWith('/blog?'))
    .filter((urlPath) => !isPrivatePath(urlPath))
    .flatMap((urlPath) => {
      const page = pageByPath.get(urlPath);
      if (!page) return [];
      return SEO_AUDIT_LANGUAGES.flatMap((language) => {
        const alternates = page.localized?.[language]?.alternates || {};
        return ['pl', 'en', 'x-default'].flatMap((hreflang) => {
          const href = alternates[hreflang];
          if (!href) {
            return [`${urlPath} [${language}] is missing hreflang ${hreflang}`];
          }
          if (!isAbsoluteSitemapOriginUrl(href)) {
            return [`${urlPath} [${language}] hreflang ${hreflang} is not an absolute ${SITEMAP_ORIGIN} URL: ${href}`];
          }
          return [];
        });
      });
    });

  const publicImageWarnings = sitemapPaths
    .filter((urlPath) => !urlPath.startsWith('/blog?'))
    .filter((urlPath) => !isPrivatePath(urlPath))
    .flatMap((urlPath) => pageByPath.get(urlPath)?.imageIssues || []);

  const homeInternalLinks = new Set(homePage?.internalLinks || []);
  const homeInternalLinkWarnings = REQUIRED_HOME_LINKS
    .filter((link) => !homeInternalLinks.has(link.path))
    .map((link) => `/ is missing internal link to ${link.label} (${link.path})`);

  const dynamicSitemapCoverageWarnings = REQUIRED_DYNAMIC_SITEMAP_SOURCES
    .filter((key) => !SITEMAP_DYNAMIC_SOURCES?.[key])
    .map((key) => `dynamic sitemap source is missing: ${key}`);

  const dynamicSitemapRows = Object.entries(SITEMAP_DYNAMIC_SOURCES || {}).map(([key, config]) => {
    const languages = Array.isArray(config?.languages) ? config.languages.join('/') : 'unknown languages';
    return `${key}: ${config?.table || 'unknown table'} -> ${config?.route || 'unknown route'} (${languages})`;
  });

  const carFlowRows = [
    `${MAIN_CAR_FLOW_URL}: ${sitemapPathSet.has(MAIN_CAR_FLOW_URL) ? 'in sitemap' : 'not in sitemap'}, canonical ${pageByPath.get(MAIN_CAR_FLOW_URL)?.canonical || 'missing'}`,
    ...LEGACY_CAR_FLOW_URLS.map((urlPath) => {
      const page = pageByPath.get(urlPath);
      return `${urlPath}: ${sitemapPathSet.has(urlPath) ? 'in sitemap' : 'not in sitemap'}, canonical ${page?.canonical || 'missing'}`;
    }),
  ];
  const invalidJsonLd = pageMeta.flatMap((page) => page.jsonLdIssues);
  const homeJsonLdTypes = homePage?.jsonLdTypes || [];
  const homeStructuredDataWarnings = ['Organization', 'WebSite']
    .filter((type) => !homeJsonLdTypes.includes(type))
    .map((type) => `/ runtime SEO is missing ${type} JSON-LD`);

  console.log('SEO audit report');
  console.log(`Origin: ${SITEMAP_ORIGIN}`);
  console.log(`HTML files scanned: ${pageMeta.length}`);
  console.log(`Static sitemap URLs: ${sitemapPaths.length}`);

  printSection('Sitemap URLs that point to noindex pages', sitemapNoindexConflicts);
  printSection('Static sitemap URLs without matching local HTML', sitemapMissingLocalPages);
  printSection('Tracked sitemap.xml sync', trackedSitemapWarnings);
  printSection('Legacy car redirect coverage', legacyCarRedirectWarnings);
  printSection('Private/account pages without explicit noindex', indexablePrivatePages);
  printSection('Public sitemap meta quality', publicMetaWarnings);
  printSection('Public sitemap hreflang coverage', publicHreflangWarnings);
  printSection('Public sitemap image alt coverage', publicImageWarnings);
  printSection('Home priority internal links', homeInternalLinkWarnings);
  printSection('Dynamic sitemap source coverage', dynamicSitemapCoverageWarnings);
  printSection('Dynamic sitemap source status', dynamicSitemapRows);
  printSection('Home canonical warnings', homeCanonicalWarning);
  printSection('Canonical mismatches in static HTML', canonicalWarnings);
  printSection('JSON-LD syntax issues', invalidJsonLd);
  printSection('Home structured data coverage', homeStructuredDataWarnings);
  printSection('Car flow SEO status', carFlowRows);

  const issueCount = sitemapNoindexConflicts.length
    + sitemapMissingLocalPages.length
    + trackedSitemapWarnings.length
    + legacyCarRedirectWarnings.length
    + indexablePrivatePages.length
    + publicMetaWarnings.length
    + publicHreflangWarnings.length
    + publicImageWarnings.length
    + homeInternalLinkWarnings.length
    + dynamicSitemapCoverageWarnings.length
    + homeCanonicalWarning.length
    + canonicalWarnings.length
    + invalidJsonLd.length
    + homeStructuredDataWarnings.length;

  console.log(`\nSummary: ${issueCount} item(s) need review. This audit is read-only and made no changes.`);
}

main().catch((error) => {
  console.error('SEO audit failed:', error);
  process.exit(1);
});
