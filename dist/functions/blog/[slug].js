import { serveStatic } from '../_utils/serveStatic.js';
import { applySeoToHtml, getSeoLanguage } from '../_utils/pageSeo.js';
import { getPublishedBlogPostBySlug } from '../_utils/blogData.js';
import {
  buildBlogPostSeoPayload,
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

function htmlResponse(template, html, method, statusOverride = null) {
  const headers = new Headers(template.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-cache');
  headers.delete('content-length');

  const status = statusOverride || template.status;

  if (method === 'HEAD') {
    return new Response(null, {
      status,
      statusText: template.statusText,
      headers,
    });
  }

  return new Response(html, {
    status,
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
  const slug = String(context.params?.slug || '').trim();
  const template = await loadTemplate(
    context,
    '/blog-post.html',
    createBlogPlaceholderHtml({ language, kind: 'post' })
  );

  let post = null;
  let status = null;

  try {
    post = await getPublishedBlogPostBySlug(context.env, { language, slug });
    if (!post) {
      status = 404;
    }
  } catch (error) {
    console.error(`Failed to preload blog post "${slug}":`, error);
    status = 500;
  }

  let html = injectWindowPayload(template.html, '__BLOG_POST__', {
    language,
    slug,
    post,
  });

  html = applySeoToHtml(
    html,
    buildBlogPostSeoPayload({
      language,
      requestPathname: url.pathname,
      requestSearch: url.search,
      post,
    })
  );

  return htmlResponse(template, html, context.request.method, status);
}
