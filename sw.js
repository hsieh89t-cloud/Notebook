// sw.js (v5)
const CACHE = "notebook-cache-v5";
const ASSETS = ["./index.html","./style.css?v=5","./app.js?v=5","./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});
// 只快取本站 GET，其它(含跨網域/POST)直通
self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) {
    e.respondWith(fetch(req));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
