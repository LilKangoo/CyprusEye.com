const CACHE_VERSION = '20260212_2';
const CACHE_PREFIX = 'ce-partners-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/partners/',
  '/partners/index.html',
  '/partners/pwa-icon-192.png',
  '/partners/pwa-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(PRECACHE_URLS);
      } catch (e) {
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME && key.startsWith(CACHE_PREFIX)) {
          return caches.delete(key);
        }
        return Promise.resolve(false);
      }));

      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isHtmlNavigationRequest(request) {
  return request.mode === 'navigate' || (request.destination === 'document' && request.method === 'GET');
}

function shouldHandleRequest(requestUrl) {
  try {
    const url = new URL(requestUrl);
    if (url.origin !== self.location.origin) return false;
    return url.pathname.startsWith('/partners/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/js/') ||
      url.pathname.startsWith('/css/') || url.pathname.startsWith('/admin/');
  } catch (_e) {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;
  if (!shouldHandleRequest(req.url)) return;

  if (isHtmlNavigationRequest(req)) {
    event.respondWith(
      (async () => {
        try {
          const resp = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, resp.clone());
          return resp;
        } catch (_e) {
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })(),
    );
    return;
  }

  const dest = req.destination;
  const cacheFirst = dest === 'script' || dest === 'style' || dest === 'image' || dest === 'font';

  if (cacheFirst) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;

        const resp = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, resp.clone());
        return resp;
      })(),
    );
    return;
  }

  event.respondWith(fetch(req));
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      try {
        payload = event.data ? (event.data.json ? await event.data.json() : {}) : {};
      } catch (_e) {
        try {
          const text = event.data ? await event.data.text() : '';
          payload = text ? JSON.parse(text) : {};
        } catch (_e2) {
          payload = {};
        }
      }

      const title = String(payload.title || payload.notification?.title || 'CyprusEye Partners').trim() || 'CyprusEye Partners';
      const body = String(payload.body || payload.notification?.body || '').trim();
      const url = String(payload.url || payload.notification?.url || '/partners/').trim() || '/partners/';
      const icon = String(payload.icon || payload.notification?.icon || '/partners/pwa-icon-192.png').trim() || '/partners/pwa-icon-192.png';

      const options = {
        body,
        icon,
        badge: '/partners/pwa-icon-192.png',
        data: { url },
      };

      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = String(event.notification?.data?.url || '/partners/').trim() || '/partners/';

  event.waitUntil(
    (async () => {
      const origin = self.location.origin;
      const targetUrl = new URL(url, origin).toString();

      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windowClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === origin && clientUrl.pathname.startsWith('/partners/')) {
            await client.focus();
            if ('navigate' in client) {
              await client.navigate(targetUrl);
            }
            return;
          }
        } catch (_e) {
        }
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});
