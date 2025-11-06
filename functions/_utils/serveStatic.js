export function serveStatic(context, pathname) {
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = pathname;

  const method = context.request.method === 'HEAD' ? 'HEAD' : 'GET';
  const request = new Request(assetUrl.toString(), {
    method,
    headers: context.request.headers,
  });

  return context.env.ASSETS.fetch(request);
}
