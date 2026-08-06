const CACHE='wrs-force-new-20260807-v3';
const HOME='./FINAL_APP.html?v=20260807-v3';
const CORE=[
  HOME,
  './app-final-20260807-v3.css?v=20260807-v3',
  './app-final-20260807-v3.js?v=20260807-v3',
  './branding-final-20260807-v3.js?v=20260807-v3',
  './install-final-20260807-v3.js?v=20260807-v3',
  './manifest-final-20260807-v3.webmanifest?v=20260807-v3',
  './icon-final-20260807-v3.svg?v=20260807-v3'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match(HOME)))
  );
});
