import { serveStatic } from '../_utils/serveStatic.js';
import { applySeoToHtml, getSeoLanguage } from '../_utils/pageSeo.js';
import { getPublishedBlogListPage } from '../_utils/blogData.js';
import {
  buildBlogListSeoPayload,
  createBlogPlaceholderHtml,
  injectWindowPayload,
} from '../_utils/blogSeo.js';

async function loadTemplate(context, pathname, fallbackHtml) {
  const response = await serveStatic(context, pathname, { method: 'GET' });
  if (!response.ok) {
    return {
      status: response.status === 404 ? 200 : response.status,
      statusText: response.status === 404 ? 'OK' : response.statusText,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      html: fallbackHtml,
    };
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
    html: await response.text(),
  };
}

function htmlResponse(template, html, method) {
  const headers = new Headers(template.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-cache');
  headers.delete('content-length');

  if (method === 'HEAD') {
    return new Response(null, {
      status: template.status,
      statusText: template.statusText,
      headers,
    });
  }

  return new Response(html, {
    status: template.status,
    statusText: template.statusText,
    headers,
  });
}

function methodNotAllowed() {
  return new Response('Method not allowed', {
    status: 405,
    headers: {
      allow: 'GET, HEAD',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

export async function onRequest(context) {
  if (!['GET', 'HEAD'].includes(context.request.method)) {
    return methodNotAllowed();
  }

  const url = new URL(context.request.url);
  const language = getSeoLanguage(url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const category = String(url.searchParams.get('category') || '').trim();
  const tag = String(url.searchParams.get('tag') || '').trim();
  const featured = String(url.searchParams.get('featured') || '').trim() === '1';
  const template = await loadTemplate(
    context,
    '/blog.html',
    createBlogPlaceholderHtml({ language, kind: 'list' })
  );

  let preload = {
    language,
    items: [],
    page,
    pageSize: 12,
    totalCount: 0,
    filter: {
      featured,
      category,
      tag,
    },
  };
  try {
    preload = {
      language,
      ...(await getPublishedBlogListPage(context.env, {
        language,
        page,
        category,
        tag,
        featured,
      })),
    };
  } catch (error) {
    console.error('Failed to preload blog list:', error);
  }

  let html = injectWindowPayload(template.html, '__BLOG_LIST__', preload);

  html = applySeoToHtml(
    html,
    buildBlogListSeoPayload({
      language,
      requestPathname: url.pathname,
      requestSearch: url.search,
    })
  );

  return htmlResponse(template, html, context.request.method);
}
