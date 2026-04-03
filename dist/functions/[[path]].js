import { serveStatic } from './_utils/serveStatic.js';
import {
  applyRecommendationsSeoToHtml,
  buildRecommendationsSeoPayload,
  getRecommendationsSeoLanguage,
  isRecommendationsSeoRequest,
} from './_utils/recommendationsSeo.js';

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

async function serveRecommendationsPage(context, url) {
  const language = getRecommendationsSeoLanguage(url);
  const htmlResponse = await serveStatic(context, '/recommendations.html', { method: 'GET' });
  if (!htmlResponse.ok) {
    return htmlResponse;
  }

  const translations = await loadTranslations(context, language);
  const html = await htmlResponse.text();
  const seoPayload = buildRecommendationsSeoPayload({
    language,
    requestPathname: url.pathname,
    requestSearch: url.search,
    translations,
  });
  const localizedHtml = applyRecommendationsSeoToHtml(html, seoPayload);
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

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (isRecommendationsSeoRequest(url.pathname)) {
    return serveRecommendationsPage(context, url);
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
