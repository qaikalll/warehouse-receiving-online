const CACHE='wrs-20260807-smart-booking-lang-v6-1';
const CORE=[
  './',
  './app.css?v=20260807-smart-booking-lang-v6-1',
  './app.js?v=20260807-smart-booking-lang-v6-1',
  './branding.js?v=20260807-smart-booking-lang-v6-1',
  './install.js?v=20260807-smart-booking-lang-v6-1',
  './manifest.webmanifest?v=20260807-smart-booking-lang-v6-1',
  './icon.svg'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./',copy));return response;
    }).catch(()=>caches.match('./')));
    return;
  }
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response=>{
    const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
  }).catch(()=>caches.match(event.request)));
});
