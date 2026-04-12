import { serveStatic } from './_utils/serveStatic.js';
import {
  applySeoToHtml,
  buildSeoPayload,
  extractSeoFallbacksFromHtml,
  getSeoLanguage,
  resolveSeoRoute,
} from './_utils/pageSeo.js';
import {
  getPublishedServiceOfferBySlug,
  resolveServiceOfferRequest,
} from './_utils/serviceOfferData.js';
import { buildServiceOfferSeoPayload } from './_utils/serviceOfferSeo.js';
import { getSitemapEntries, getStaticSitemapEntries, renderSitemapXml } from './_utils/sitemap.js';

const translationCache = new Map();

async function loadTranslations(context, language) {
  const cacheKey = language === 'en' ? 'en' : 'pl';
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const response = await serveStatic(context, `/translations/${cacheKey}.json`, { method: 'GET' });
    if (!response.ok) {
      translationCache.set(cacheKey, {});
      return {};
    }

    const translations = await response.json();
    translationCache.set(cacheKey, translations);
    return translations;
  } catch (_) {
    translationCache.set(cacheKey, {});
    return {};
  }
}

async function serveSeoPage(context, url, route) {
  const language = getSeoLanguage(url);
  const htmlResponse = await serveStatic(context, route.htmlPath, { method: 'GET' });
  if (!htmlResponse.ok) {
    return htmlResponse;
  }

  const translations = await loadTranslations(context, language);
  const html = await htmlResponse.text();
  const seoPayload = buildSeoPayload({
    route,
    language,
    requestPathname: url.pathname,
    requestSearch: url.search,
    translations,
    fallbackSeo: extractSeoFallbacksFromHtml(html),
  });
  const localizedHtml = applySeoToHtml(html, seoPayload);
  const headers = new Headers(htmlResponse.headers);

  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-cache');

  if (context.request.method === 'HEAD') {
    headers.delete('content-length');
    return new Response(null, {
      status: htmlResponse.status,
      statusText: htmlResponse.statusText,
      headers,
    });
  }

  return new Response(localizedHtml, {
    status: htmlResponse.status,
    statusText: htmlResponse.statusText,
    headers,
  });
}

async function serveServiceOfferPage(context, url, serviceRequest) {
  const language = getSeoLanguage(url);
  const htmlResponse = await serveStatic(context, serviceRequest.templatePath, { method: 'GET' });
  if (!htmlResponse.ok) {
    return htmlResponse;
  }

  let offer = null;
  let status = null;
  try {
    offer = await getPublishedServiceOfferBySlug(context.env, {
      kind: serviceRequest.kind,
      slug: serviceRequest.slug,
    });
    if (!offer) {
      status = 404;
    }
  } catch (error) {
    console.error(`Failed to preload ${serviceRequest.kind} offer "${serviceRequest.slug}":`, error);
    status = 500;
  }

  const html = await htmlResponse.text();
  const localizedHtml = applySeoToHtml(
    html,
    buildServiceOfferSeoPayload({
      kind: serviceRequest.kind,
      language,
      requestPathname: serviceRequest.requestPathname,
      pathStyle: serviceRequest.pathStyle,
      offer,
    })
  );
  const headers = new Headers(htmlResponse.headers);

  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-cache');

  if (context.request.method === 'HEAD') {
    headers.delete('content-length');
    return new Response(null, {
      status: status || htmlResponse.status,
      statusText: htmlResponse.statusText,
      headers,
    });
  }

  return new Response(localizedHtml, {
    status: status || htmlResponse.status,
    statusText: htmlResponse.statusText,
    headers,
  });
}

async function serveDynamicSitemap(context) {
  let xml = '';
  try {
    xml = renderSitemapXml(await getSitemapEntries(context.env));
  } catch (error) {
    console.error('[sitemap] Failed to generate sitemap from catch-all route:', error);
    xml = renderSitemapXml(getStaticSitemapEntries());
  }

  const headers = new Headers({
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=900, s-maxage=900, stale-while-revalidate=86400',
  });

  if (context.request.method === 'HEAD') {
    return new Response(null, { status: 200, headers });
  }

  return new Response(xml, { status: 200, headers });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname === '/sitemap.xml') {
    if (!['GET', 'HEAD'].includes(context.request.method)) {
      return new Response('Method not allowed', {
        status: 405,
        headers: {
          allow: 'GET, HEAD',
          'content-type': 'text/plain; charset=utf-8',
        },
      });
    }
    return serveDynamicSitemap(context);
  }
  const serviceRequest = resolveServiceOfferRequest(url.pathname, url.search);
  if (serviceRequest) {
    return serveServiceOfferPage(context, url, serviceRequest);
  }
  const route = resolveSeoRoute(url.pathname);

  if (route) {
    return serveSeoPage(context, url, route);
  }

  // najpierw spróbuj wydać statyczny asset (jeśli istnieje)
  const res = await context.env.ASSETS.fetch(context.request);
  if (res.status !== 404) return res;
  
  // Nie zwracaj index.html dla plików z rozszerzeniem - to prawdziwy 404
  const pathname = url.pathname;
  
  // Jeśli ścieżka ma rozszerzenie pliku (.js, .css, .png, etc.) zwróć 404
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return res; // Zwróć 404
  }
  
  // fallback do /index.html dla dowolnych innych „deep-linków" (SPA routing)
  return serveStatic(context, '/index.html');
}
