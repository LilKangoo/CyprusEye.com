/**
 * Service Worker for CyprusEye PWA
 * Provides offline support and caching
 */

const CACHE_VERSION = 'cypruseye-v1.0.0';
const CACHE_NAME = `${CACHE_VERSION}`;

// Core files to cache immediately
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/assets/css/tokens.css',
  '/assets/css/base.css',
  '/assets/css/components.css',
  '/assets/css/layout.css',
  '/assets/cyprus_logo-1000x1054.png',
];

// Files to cache on first request
const RUNTIME_CACHE = [
  '/js/i18n.js',
  '/js/tutorial.js',
  '/js/seo.js',
  '/translations/pl.json',
  '/translations/en.json',
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Core assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache core assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests (except CDN resources)
  if (url.origin !== location.origin && !isAllowedExternal(url)) {
    return;
  }

  // Skip Supabase API calls (always fetch fresh)
  if (url.hostname.includes('supabase')) {
    return;
  }

  event.respondWith(
    cacheFirst(request)
      .catch(() => networkFirst(request))
      .catch(() => offlineFallback(request))
  );
});

/**
 * Cache-first strategy
 * Try cache first, then network
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    console.log('[SW] Serving from cache:', request.url);
    return cached;
  }
  
  throw new Error('Not in cache');
}

/**
 * Network-first strategy
 * Try network first, cache on success
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      console.log('[SW] Cached from network:', request.url);
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed:', request.url);
    throw error;
  }
}

/**
 * Offline fallback
 * Return offline page or error
 */
async function offlineFallback(request) {
  const url = new URL(request.url);
  
  // For HTML pages, try to return cached index
  if (request.destination === 'document') {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match('/index.html');
    if (cached) {
      return cached;
    }
  }
  
  // Return network error response
  return new Response('Offline - content not available', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: new Headers({
      'Content-Type': 'text/plain',
    }),
  });
}

/**
 * Check if external URL is allowed
 */
function isAllowedExternal(url) {
  const allowedDomains = [
    'cdn.jsdelivr.net',
    'esm.sh',
    'unpkg.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ];
  
  return allowedDomains.some(domain => url.hostname.includes(domain));
}

// Message handling
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service worker loaded');
