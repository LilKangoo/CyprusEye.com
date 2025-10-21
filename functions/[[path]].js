export async function onRequest(context) {
  // najpierw spróbuj wydać statyczny asset (jeśli istnieje)
  const res = await context.env.ASSETS.fetch(context.request);
  if (res.status === 200) return res;
  // fallback do /index.html dla dowolnych innych „deep-linków”
  const url = new URL('/index.html', context.request.url);
  return context.env.ASSETS.fetch(new Request(url, context.request));
}
