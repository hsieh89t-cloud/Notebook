const CACHE="nb-demo-v1-3-1";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);ASSETS.includes(u.pathname.replace(/^\//,''))&&e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
