self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { clients.claim(); });
self.addEventListener('fetch', e => { /* 直連網路，保證資料最新 */ });
