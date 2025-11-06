import { serveStatic } from './_utils/serveStatic.js';

export async function onRequest(context) {
  // najpierw spróbuj wydać statyczny asset (jeśli istnieje)
  const res = await context.env.ASSETS.fetch(context.request);
  if (res.status !== 404) return res;
  
  // Nie zwracaj index.html dla plików z rozszerzeniem - to prawdziwy 404
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  
  // Jeśli ścieżka ma rozszerzenie pliku (.js, .css, .png, etc.) zwróć 404
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return res; // Zwróć 404
  }
  
  // fallback do /index.html dla dowolnych innych „deep-linków" (SPA routing)
  return serveStatic(context, '/index.html');
}
