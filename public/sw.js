const CACHE_NAME = 'broadcast-tv-shell-v4';
const IMAGE_CACHE = 'broadcast-tv-images-v2';
const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/app.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== IMAGE_CACHE).map((key) => caches.delete(key)))
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
    event.respondWith(
      caches.match(event.request).then((cached) => {
        // Stale-While-Revalidate strategy for images
        const networkFetch = fetch(event.request, { mode: 'no-cors' }).then((response) => {
          if (response) {
            const resClone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => cache.put(event.request, resClone));
          }
          return response;
        }).catch(() => {});

        // Return cached immediately if available, otherwise wait for network
        return cached || networkFetch;
      })
    );
    return;
  }

  // 2. Local Assets Shell Caching
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request);
    })
  );
});
