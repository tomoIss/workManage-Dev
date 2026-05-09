const CACHE_PREFIX = 'kadai-kanri-dev-'; // 開発版専用のプレフィックス
const CACHE_NAME = CACHE_PREFIX + 'v1.1';

// キャッシュするファイルリスト
const urlsToCache = [
  './',
  './index.html',         // メインのファイル
  './manifest.json',      // マニフェストファイルを追加
  './css/style.css',      // CSSを追加
  './js/api.js',          // JSを追加
  './js/ui.js',           // JSを追加
  './icon/icon-192.jpg',  // アイコン1
  './icon/icon-512.jpg'   // アイコン2
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
        // GETメゾットだけをキャッシュ
        if(event.request.method === 'GET') {
          // レスポンスをキャッシュに保存（ネットワーク優先）
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));          
        }
        return response;
      }).catch(() => {
        // オフライン時はキャッシュから取得
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 「開発版の名前」で始まり、かつ「今の名前」じゃない時だけ消す
          if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
