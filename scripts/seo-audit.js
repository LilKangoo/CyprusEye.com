import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import { fileURLToPath } from 'url';
import { getStaticSitemapEntries, SITEMAP_ORIGIN } from '../functions/_utils/sitemap.js';
import {
  applySeoToHtml,
  buildSeoPayload,
  extractSeoFallbacksFromHtml,
  resolveSeoRoute,
} from '../functions/_utils/pageSeo.js';

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

const MAIN_CAR_FLOW_URL = '/car.html';
const LEGACY_CAR_FLOW_URLS = ['/car-rental.html', '/autopfo.html'];

const LOCAL_ROUTE_ALIASES = new Map([
  ['/blog', '/blog.html'],
]);

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

function pathToUrlPath(relativePath) {
  const normalized = `/${relativePath.split(sep).join('/')}`;
  if (normalized.endsWith('/index.html')) {
    return normalized.replace(/\/index\.html$/, '/');
  }
  return normalized;
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
    }];
  }));
  const jsonLd = parseJsonLdScripts(relativePath, extractJsonLdScripts(renderedHtml));
  return {
    relativePath,
    urlPath,
    robots: localized.en?.robots || '',
    canonical: localized.en?.canonical || '',
    seoPage: firstMatch(html, /<body\b[^>]*\bdata-seo-page=["']([^"']+)["']/i),
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
  printSection('Private/account pages without explicit noindex', indexablePrivatePages);
  printSection('Public sitemap meta quality', publicMetaWarnings);
  printSection('Home canonical warnings', homeCanonicalWarning);
  printSection('Canonical mismatches in static HTML', canonicalWarnings);
  printSection('JSON-LD syntax issues', invalidJsonLd);
  printSection('Home structured data coverage', homeStructuredDataWarnings);
  printSection('Car flow SEO status', carFlowRows);

  const issueCount = sitemapNoindexConflicts.length
    + sitemapMissingLocalPages.length
    + indexablePrivatePages.length
    + publicMetaWarnings.length
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
