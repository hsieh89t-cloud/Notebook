
// sw.js v6.2：只快取本站 GET；跨網域/POST 直通
const CACHE = 'notebook-cache-v6-2';
const ASSETS = ['./index.html','./style.css?v=6.2','./app.js?v=6.2','./manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) { e.respondWith(fetch(req)); return; }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
