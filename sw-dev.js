const CACHE_PREFIX = 'kadai-kanri-dev-'; 
const CACHE_NAME = CACHE_PREFIX + 'v1.2';

const urlsToCache = [
  //'./',
  './dev.html',
  './manifest.json',
  './css/style.css',
  './js/api.js',
  './js/ui.js',
  './icon/icon-192.jpg',
  './icon/icon-512.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if(event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));          
        }
        return response;
      }).catch(() => {
        // 自分の箱（CACHE_NAME）を明示的に指定して、他アプリとの混同を防ぐ
        return caches.open(CACHE_NAME).then(cache => {
          return cache.match(event.request);
        }); 
      }) // ← ここに閉じカッコが必要でした
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 開発版のプレフィックスで始まる古いキャッシュだけを削除
          if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
