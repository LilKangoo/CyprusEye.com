export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;

    // Mapowanie prefiksów na konkretne pliki HTML
    const routes = [
      ['/auth/',   '/auth/index.html'],
      ['/reset/',  '/reset/index.html'],
      ['/account/','/account/index.html'],
    ];

    for (const [prefix, target] of routes) {
      if (p.startsWith(prefix)) {
        const newUrl = new URL(target, url.origin);
        return env.ASSETS.fetch(new Request(newUrl, request));
      }
    }

    // Domyślnie zwróć statyczny plik (w tym /index.html)
    return env.ASSETS.fetch(request);
  }
};
