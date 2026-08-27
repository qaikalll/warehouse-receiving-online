/*
  Warehouse Receiving — Push Service Worker
  2026-08-27
  Remote push path intentionally uses the browser's native Push API.
  Return Management V1 is injected into the existing app so installed users
  keep the same PWA, URL and login.
*/

self.addEventListener('push', event => {
  let payload = {};
  let fallbackText = '';

  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    try {
      fallbackText = event.data ? event.data.text() : '';
    } catch (_) {}
  }

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title =
    notification.title ||
    data.title ||
    payload.title ||
    'Warehouse Receiving';

  const body =
    notification.body ||
    data.body ||
    payload.body ||
    fallbackText ||
    'You have a new warehouse update.';

  const url =
    (payload.fcmOptions && payload.fcmOptions.link) ||
    notification.click_action ||
    data.url ||
    data.link ||
    './';

  const options = {
    body,
    icon: notification.icon || data.icon || './apple-touch-icon.png',
    badge: data.badge || './apple-touch-icon.png',
    tag: data.tag || payload.collapse_key || 'wrs-push',
    renotify: false,
    data: { url }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && target && target !== './') {
            try { client.navigate(target); } catch (_) {}
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

const CACHE='wrs-20260827-return-v1';
const RETURN_SCRIPT='<script src="./return-module.js?v=20260827-return-v1"></script>';
const CORE=[
  './',
  './app.css?v=20260807-full-app-i18n-v6-4',
  './app.js?v=20260807-full-app-i18n-v6-4',
  './branding.js?v=20260807-full-app-i18n-v6-4',
  './install.js?v=20260807-full-app-i18n-v6-4',
  './app-i18n.js?v=20260807-full-app-i18n-v6-4',
  './manifest.webmanifest?v=20260807-full-app-i18n-v6-4',
  './return-module.js?v=20260827-return-v1',
  './return-module.css?v=20260827-return-v1',
  './icon.svg',
  './apple-touch-icon.png'
];

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

async function injectReturnModule(response) {
  if (!response || !response.ok) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  if (html.includes('return-module.js')) {
    return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
  }

  const injected = html.includes('</body>')
    ? html.replace('</body>', `${RETURN_SCRIPT}</body>`)
    : `${html}${RETURN_SCRIPT}`;

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(CORE.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          return injectReturnModule(response);
        })
        .catch(async () => {
          const cached = await caches.match(event.request) || await caches.match('./');
          return cached ? injectReturnModule(cached.clone()) : cached;
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./')))
  );
});
