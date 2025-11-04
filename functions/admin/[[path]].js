/**
 * Cloudflare Pages Function
 * Serves static files from /admin directory
 */

export async function onRequest(context) {
  // Get the requested path from URL
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  
  // Serve the file directly using Cloudflare's asset fetching
  const method = context.request.method === 'HEAD' ? 'HEAD' : 'GET';
  const request = new Request(url.toString(), {
    method,
    headers: context.request.headers,
  });

  const assetResponse = await context.env.ASSETS.fetch(request);

  // Force no-cache for admin assets to ensure latest JS/CSS/HTML is served
  const resp = new Response(assetResponse.body, assetResponse);
  resp.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  resp.headers.set('Pragma', 'no-cache');
  resp.headers.set('Expires', '0');
  return resp;
}
