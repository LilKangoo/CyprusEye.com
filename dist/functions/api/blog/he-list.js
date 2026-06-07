import { getPublishedBlogListPage } from '../../_utils/blogData.js';

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

function normalizeFacetRows(items = []) {
  const categories = new Set();
  const tags = new Set();
  let featuredCount = 0;
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.featured) featuredCount += 1;
    for (const category of Array.isArray(item?.categories) ? item.categories : []) {
      const value = String(category || '').trim();
      if (value) categories.add(value);
    }
    for (const tag of Array.isArray(item?.tags) ? item.tags : []) {
      const value = String(tag || '').trim();
      if (value) tags.add(value);
    }
  }
  const categoryRows = Array.from(categories).sort((a, b) => a.localeCompare(b, 'he', { sensitivity: 'base' }));
  const tagRows = Array.from(tags).sort((a, b) => a.localeCompare(b, 'he', { sensitivity: 'base' }));
  const seen = new Set();
  const topics = [];
  for (const [kind, rows] of [['category', categoryRows], ['tag', tagRows]]) {
    for (const value of rows) {
      const key = `${kind}:${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      topics.push({ kind, value });
    }
  }
  return {
    categories: categoryRows,
    tags: tagRows,
    topics,
    featuredCount,
  };
}

async function loadFacets(env) {
  const result = await getPublishedBlogListPage(env, {
    language: 'he',
    page: 1,
    limit: 50,
  });
  return normalizeFacetRows(result.items);
}

export async function onRequest(context) {
  if (!['GET', 'HEAD'].includes(context.request.method)) {
    return methodNotAllowed();
  }

  const url = new URL(context.request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '12', 10) || 12));
  const category = String(url.searchParams.get('category') || '').trim();
  const tag = String(url.searchParams.get('tag') || '').trim();
  const featured = String(url.searchParams.get('featured') || '').trim() === '1';
  const includeFacets = String(url.searchParams.get('facets') || '').trim() === '1';

  try {
    const result = await getPublishedBlogListPage(context.env, {
      language: 'he',
      page,
      limit,
      category,
      tag,
      featured,
    });
    const payload = {
      ok: true,
      language: 'he',
      ...result,
      ...(includeFacets ? { facets: await loadFacets(context.env) } : {}),
    };
    return context.request.method === 'HEAD' ? jsonResponse(null) : jsonResponse(payload);
  } catch (error) {
    console.error('Failed to load public-ready Hebrew blog list:', error);
    return jsonResponse(
      { ok: false, error: 'Failed to load Hebrew blog list' },
      { status: 500 }
    );
  }
}
