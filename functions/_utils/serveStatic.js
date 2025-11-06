export function serveStatic(context, pathname) {
  const assetUrl = new URL(context.request.url);
  
  // Handle directory paths - ensure trailing slash and add index.html
  if (!pathname.includes('.')) {
    // If pathname doesn't have an extension, it's likely a directory
    if (!pathname.endsWith('/')) {
      pathname = pathname + '/';
    }
    pathname = pathname + 'index.html';
  }
  
  // Ensure pathname starts with /
  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }
  
  assetUrl.pathname = pathname;

  const method = context.request.method === 'HEAD' ? 'HEAD' : 'GET';
  const request = new Request(assetUrl.toString(), {
    method,
    headers: context.request.headers,
  });

  return context.env.ASSETS.fetch(request);
}
