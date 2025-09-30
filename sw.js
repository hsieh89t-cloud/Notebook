const CACHE_NAME = 'nb-pwa-v131-fullfix-v1';
self.addEventListener('install', (e)=>{ self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e)=>{
  // network first for API, cache-first for static
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('/exec')) return; // let network handle
  e.respondWith(
    caches.match(e.request).then((res)=>{
      return res || fetch(e.request).then((resp)=>{
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c=> c.put(e.request, copy));
        return resp;
      });
    })
  );
});
self.addEventListener('message',(e)=>{
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
