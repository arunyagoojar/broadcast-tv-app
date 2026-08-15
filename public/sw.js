const CACHE_NAME = 'broadcast-tv-shell-v7';
const RUNTIME_CACHE = 'broadcast-tv-runtime-v1';
const IMAGE_CACHE = 'broadcast-tv-images-v3';
const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/app-icon-192.png',
  '/app-icon-512.png',
  '/app-maskable-192.png',
  '/app-maskable-512.png',
];
const MAX_RUNTIME_ENTRIES = 40;
const MAX_IMAGE_ENTRIES = 80;

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}

async function cacheResponse(cacheName, request, response, maxEntries) {
  if (!response || (!response.ok && response.type !== 'opaque')) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  await trimCache(cacheName, maxEntries);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // 1. Aggressive Image Caching for External CDNs (TMDB, TVMaze, Wikimedia)
  const isExternalImage = event.request.destination === 'image' && (
                          url.origin.includes('tmdb.org') || 
                          url.origin.includes('tvmaze.com') || 
                          url.origin.includes('wikimedia.org')
                        );

  if (isExternalImage) {
    const networkFetch = fetch(event.request).then(async (response) => {
      await cacheResponse(IMAGE_CACHE, event.request, response, MAX_IMAGE_ENTRIES);
      return response;
    });
    event.waitUntil(networkFetch.then(() => undefined).catch(() => undefined));
    event.respondWith(
      caches.match(event.request).then((cached) => {
        // Return cached immediately if available, otherwise wait for network
        return cached || networkFetch.catch(() => Response.error());
      })
    );
    return;
  }

  // 2. Local Assets Shell Caching
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          await cacheResponse(RUNTIME_CACHE, event.request, response, MAX_RUNTIME_ENTRIES);
          return response;
        })
        .catch(async () => (
          await caches.match(event.request) || await caches.match('/') || Response.error()
        ))
    );
    return;
  }

  if (['script', 'style', 'worker'].includes(event.request.destination)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          await cacheResponse(RUNTIME_CACHE, event.request, response, MAX_RUNTIME_ENTRIES);
          return response;
        })
        .catch(async () => await caches.match(event.request) || Response.error())
    );
    return;
  }

  const networkFetch = fetch(event.request).then(async (response) => {
    await cacheResponse(RUNTIME_CACHE, event.request, response, MAX_RUNTIME_ENTRIES);
    return response;
  });
  event.waitUntil(networkFetch.then(() => undefined).catch(() => undefined));
  event.respondWith(
    caches.match(event.request).then((cached) => cached || networkFetch.catch(() => Response.error()))
  );
});
