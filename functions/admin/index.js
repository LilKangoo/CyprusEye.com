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

  return context.env.ASSETS.fetch(request);
}
