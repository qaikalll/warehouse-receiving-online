importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAGDRTLXWaCWZpNdqA8KIBoUYJWBEq8qFM',
  authDomain: 'warehouse-receiving-online.firebaseapp.com',
  projectId: 'warehouse-receiving-online',
  storageBucket: 'warehouse-receiving-online.firebasestorage.app',
  messagingSenderId: '655223366420',
  appId: '1:655223366420:web:7437455a7908e31e521801',
  measurementId: 'G-FV5D6TBVR1'
});

const messaging = firebase.messaging();

/*
  Notification messages sent by Firebase Console are displayed automatically
  by Firebase Messaging while the app is in the background.
  This handler is for future data-only booking pushes.
*/
messaging.onBackgroundMessage(payload => {
  if (payload?.notification?.title || payload?.notification?.body) return;

  const data = payload?.data || {};
  const title = data.title || 'Warehouse Receiving';
  const body = data.body || 'You have a new warehouse update.';

  return self.registration.showNotification(title, {
    body,
    icon: './icon.svg',
    badge: './icon.svg',
    tag: data.tag || 'wrs-push',
    data: {
      url: data.url || './'
    }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

const CACHE='wrs-20260818-fcm-v1';
const CORE=[
  './',
  './app.css?v=20260807-full-app-i18n-v6-4',
  './app.js?v=20260807-full-app-i18n-v6-4',
  './branding.js?v=20260807-full-app-i18n-v6-4',
  './install.js?v=20260807-full-app-i18n-v6-4',
  './app-i18n.js?v=20260807-full-app-i18n-v6-4',
  './manifest.webmanifest?v=20260807-full-app-i18n-v6-4',
  './icon.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request,{cache:'no-store'}).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put('./',copy));
        return response;
      }).catch(()=>caches.match('./'))
    );
    return;
  }

  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  event.respondWith(
    fetch(event.request,{cache:'no-cache'}).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }).catch(()=>caches.match(event.request))
  );
});
