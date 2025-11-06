import { serveStatic } from './_utils/serveStatic.js';

export async function onRequest(context) {
  // najpierw spróbuj wydać statyczny asset (jeśli istnieje)
  const res = await context.env.ASSETS.fetch(context.request);
  if (res.status !== 404) return res;
  // fallback do /index.html dla dowolnych innych „deep-linków”
  return serveStatic(context, '/index.html');
}
