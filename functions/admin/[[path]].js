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

  return context.env.ASSETS.fetch(request);
}
