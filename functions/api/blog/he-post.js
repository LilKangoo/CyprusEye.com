import { getPublishedBlogPostBySlug } from '../../_utils/blogData.js';

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

function methodNotAllowed() {
  return jsonResponse(
    { ok: false, error: 'Method not allowed' },
    {
      status: 405,
      headers: { allow: 'GET, HEAD' },
    }
  );
}

export async function onRequest(context) {
  if (!['GET', 'HEAD'].includes(context.request.method)) {
    return methodNotAllowed();
  }

  const url = new URL(context.request.url);
  const slug = String(url.searchParams.get('slug') || '').trim();
  if (!slug) {
    return jsonResponse({ ok: false, error: 'Missing slug', post: null }, { status: 400 });
  }

  try {
    const post = await getPublishedBlogPostBySlug(context.env, {
      language: 'he',
      slug,
    });
    return context.request.method === 'HEAD'
      ? jsonResponse(null, { status: post ? 200 : 404 })
      : jsonResponse({ ok: true, language: 'he', post: post || null }, { status: post ? 200 : 404 });
  } catch (error) {
    console.error(`Failed to load public-ready Hebrew blog post "${slug}":`, error);
    return jsonResponse(
      { ok: false, error: 'Failed to load Hebrew blog post', post: null },
      { status: 500 }
    );
  }
}
