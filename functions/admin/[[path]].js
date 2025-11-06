/**
 * Cloudflare Pages Function
 * Serves static files from /admin directory
 */

export async function onRequest(context) {
  try {
    // Get the requested path from URL (WITHOUT query params)
    const url = new URL(context.request.url);
    let pathname = url.pathname;
    
    console.log('[Admin [[path]]] Original request:', url.toString());
    console.log('[Admin [[path]]] Pathname:', pathname);
    
    // Remove query params for asset fetching
    const cleanUrl = new URL(url.origin + pathname);
    
    console.log('[Admin [[path]]] Clean URL:', cleanUrl.toString());
    
    // Serve the file directly using Cloudflare's asset fetching
    const method = context.request.method === 'HEAD' ? 'HEAD' : 'GET';
    const request = new Request(cleanUrl.toString(), {
      method,
      headers: {
        ...context.request.headers,
      },
    });

    const assetResponse = await context.env.ASSETS.fetch(request);
    
    console.log('[Admin [[path]]] Asset response status:', assetResponse.status);
    console.log('[Admin [[path]]] Asset response headers:', Object.fromEntries(assetResponse.headers));

    // Return response with no-cache headers
    const resp = new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers: assetResponse.headers,
    });
    
    // Force no-cache for admin assets
    resp.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    resp.headers.set('Pragma', 'no-cache');
    resp.headers.set('Expires', '0');
    
    // Set correct content type
    if (pathname.endsWith('.js')) {
      resp.headers.set('Content-Type', 'application/javascript; charset=utf-8');
    } else if (pathname.endsWith('.css')) {
      resp.headers.set('Content-Type', 'text/css; charset=utf-8');
    } else if (pathname.endsWith('.html')) {
      resp.headers.set('Content-Type', 'text/html; charset=utf-8');
    }
    
    console.log('[Admin [[path]]] Returning response with status:', resp.status);
    
    return resp;
    
  } catch (error) {
    console.error('[Admin [[path]]] Error:', error);
    console.error('[Admin [[path]]] Error stack:', error.stack);
    return new Response('Asset fetch error: ' + error.message + '\nStack: ' + error.stack, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
