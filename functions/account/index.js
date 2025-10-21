export async function onRequest(context) {
  const url = new URL('/account/index.html', context.request.url);
  return context.env.ASSETS.fetch(new Request(url, context.request));
}
