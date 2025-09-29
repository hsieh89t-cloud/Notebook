const VERSION='v7-prefill-2';
const CORE=['./','./index.html','./manifest.json','./appicon.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE))); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==VERSION && caches.delete(k))))); });
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin===location.origin && e.request.method==='GET'){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
  }
});
