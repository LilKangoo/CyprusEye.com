/**
 * Cloudflare Pages Function
 * Serves /admin/index.html
 */

export async function onRequest(context) {
  // Serve /admin/index.html
  const url = new URL(context.request.url);
  url.pathname = '/admin/index.html';
  
  const method = context.request.method === 'HEAD' ? 'HEAD' : 'GET';
  const request = new Request(url.toString(), {
    method,
    headers: context.request.headers,
  });

  const assetResponse = await context.env.ASSETS.fetch(request);
  const resp = new Response(assetResponse.body, assetResponse);
  resp.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  resp.headers.set('Pragma', 'no-cache');
  resp.headers.set('Expires', '0');
  return resp;
}
