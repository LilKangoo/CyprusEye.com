import { getSitemapEntries, getStaticSitemapEntries, renderSitemapXml } from './_utils/sitemap.js';

function methodNotAllowed() {
  return new Response('Method not allowed', {
    status: 405,
    headers: {
      allow: 'GET, HEAD',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

function buildHeaders() {
  return new Headers({
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=900, s-maxage=900, stale-while-revalidate=86400',
  });
}

export async function onRequest(context) {
  if (!['GET', 'HEAD'].includes(context.request.method)) {
    return methodNotAllowed();
  }

  let xml = '';
  try {
    xml = renderSitemapXml(await getSitemapEntries(context.env));
  } catch (error) {
    console.error('[sitemap] Failed to generate dynamic sitemap:', error);
    xml = renderSitemapXml(getStaticSitemapEntries());
  }

  const headers = buildHeaders();
  if (context.request.method === 'HEAD') {
    return new Response(null, { status: 200, headers });
  }

  return new Response(xml, { status: 200, headers });
}
