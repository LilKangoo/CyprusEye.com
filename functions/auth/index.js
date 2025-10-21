export async function onRequest(context) {
  const url = new URL('/auth/index.html', context.request.url);
  return context.env.ASSETS.fetch(new Request(url, context.request));
}
