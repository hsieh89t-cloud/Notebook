// v0.1 基本快取（避免白屏）
const CACHE_NAME = 'nb-v0.1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './app.js',
  './manifest.json',
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  if (ASSETS.includes(url.pathname.replace(/.*\//,''))) {
    e.respondWith(caches.match(e.request).then(res=>res || fetch(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));
});
