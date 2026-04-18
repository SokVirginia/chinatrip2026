/* Service worker for offline support and fast updates */
const VERSION = 'v7';
const STATIC_CACHE = `chinatrip-static-${VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './sw.js',
  './src/styles.css',
  './src/ui.js',
  './src/statusbar.js',
  './src/pwa.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for navigation/HTML so updates arrive when online.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          const cache = await caches.open(STATIC_CACHE);
          await cache.put('./index.html', fresh.clone());
          return fresh;
        } catch {
          return (await caches.match('./index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  // Runtime cache: serve cache if present, refresh in background.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) {
        event.waitUntil(
          (async () => {
            try {
              const fresh = await fetch(req);
              if (fresh && fresh.status === 200) {
                const cache = await caches.open(STATIC_CACHE);
                await cache.put(req, fresh.clone());
              }
            } catch {}
          })()
        );
        return cached;
      }

      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        return Response.error();
      }
    })()
  );
});

