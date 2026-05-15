import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import { fileURLToPath } from 'url';
import { getStaticSitemapEntries, SITEMAP_ORIGIN } from '../functions/_utils/sitemap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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

function stripHtmlComments(html) {
  return String(html || '').replace(/<!--[\s\S]*?-->/g, '');
}

function firstMatch(html, pattern) {
  const match = pattern.exec(stripHtmlComments(html));
  return match ? String(match[1] || '').trim() : '';
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

async function readPageMeta(relativePath) {
  const html = await readFile(join(ROOT, relativePath), 'utf8');
  return {
    relativePath,
    urlPath: pathToUrlPath(relativePath),
    robots: firstMatch(html, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["'][^>]*>/i),
    canonical: normalizePathFromUrl(firstMatch(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i)),
    seoPage: firstMatch(html, /<body\b[^>]*\bdata-seo-page=["']([^"']+)["']/i),
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
  const pageMeta = await Promise.all(htmlFiles.map(readPageMeta));
  const pageByPath = new Map(pageMeta.map((page) => [page.urlPath, page]));
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
    .filter((page) => page.canonical !== page.urlPath)
    .map((page) => `${page.urlPath} canonical -> ${page.canonical}`);

  const homePage = pageByPath.get('/');
  const homeCanonicalWarning = homePage?.canonical && homePage.canonical !== '/'
    ? [`/ canonical -> ${homePage.canonical}`]
    : [];

  const carFlowRows = [
    `${MAIN_CAR_FLOW_URL}: ${sitemapPathSet.has(MAIN_CAR_FLOW_URL) ? 'in sitemap' : 'not in sitemap'}, canonical ${pageByPath.get(MAIN_CAR_FLOW_URL)?.canonical || 'missing'}`,
    ...LEGACY_CAR_FLOW_URLS.map((urlPath) => {
      const page = pageByPath.get(urlPath);
      return `${urlPath}: ${sitemapPathSet.has(urlPath) ? 'in sitemap' : 'not in sitemap'}, canonical ${page?.canonical || 'missing'}`;
    }),
  ];

  console.log('SEO audit report');
  console.log(`Origin: ${SITEMAP_ORIGIN}`);
  console.log(`HTML files scanned: ${pageMeta.length}`);
  console.log(`Static sitemap URLs: ${sitemapPaths.length}`);

  printSection('Sitemap URLs that point to noindex pages', sitemapNoindexConflicts);
  printSection('Static sitemap URLs without matching local HTML', sitemapMissingLocalPages);
  printSection('Private/account pages without explicit noindex', indexablePrivatePages);
  printSection('Home canonical warnings', homeCanonicalWarning);
  printSection('Canonical mismatches in static HTML', canonicalWarnings);
  printSection('Car flow SEO status', carFlowRows);

  const issueCount = sitemapNoindexConflicts.length
    + sitemapMissingLocalPages.length
    + indexablePrivatePages.length
    + homeCanonicalWarning.length
    + canonicalWarnings.length;

  console.log(`\nSummary: ${issueCount} item(s) need review. This audit is read-only and made no changes.`);
}

main().catch((error) => {
  console.error('SEO audit failed:', error);
  process.exit(1);
});
