// v1.3.2 SW: cache static, network-first for API, instant claim
const VERSION = '1.3.2';
const CACHE_STATIC = `nb-static-${VERSION}`;
const STATIC_ASSETS = [
  './',
  './index.html?v=1.3.2',
  './styles.css?v=1.3.2',
  './app.js?v=1.3.2',
  './manifest.json?v=1.3.2'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_STATIC).then(c => c.addAll(STATIC_ASSETS)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('nb-static-') && k !== CACHE_STATIC).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// 即時跳版（來自頁面訊息）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 只快取本地靜態檔；API 一律網路優先
  const isStatic = STATIC_ASSETS.some(a => url.href.endsWith(a.replace('./','')));
  if (isStatic) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }
  if (url.searchParams.get('type')) { // our GAS API
    e.respondWith(fetch(e.request)); // network-first / no cache
    return;
  }
  // otherwise, default
});
