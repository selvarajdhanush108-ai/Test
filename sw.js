// Basic service worker: caches app shell and runtime-caches tile images.
// Note: Tile caching may be subject to provider TOS. Use responsibly.

const CACHE_NAME = 'bus-tracker-v1';
const OFFLINE_PAGE = '/';
const APP_SHELL = [
  '/',
  'index.html',
  'manifest.json',
  'icon.png',
  // CDN resources (best-effort)
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.socket.io/4.5.4/socket.io.min.js'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// runtime caching with network-first for most requests, but fallback to cache
self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  const url = new URL(req.url);

  // 1) If tile server (leaflet tiles), use cache-first (to reduce tile requests)
  if (url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('server.arcgisonline.com')) {
    evt.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          // don't cache opaque oversized responses
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return res;
        }).catch(()=> caches.match('/'));
      })
    );
    return;
  }

  // 2) For other requests, try network, fallback to cache
  evt.respondWith(
    fetch(req).then(res => {
      // optionally update cache for app shell files
      if (req.method === 'GET') {
        const toCache = req.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, toCache).catch(()=>{}));
      }
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match(OFFLINE_PAGE)))
  );
});

self.addEventListener('message', (evt) => {
  // placeholder for future push/notification integration
  console.log('SW message', evt.data);
});
