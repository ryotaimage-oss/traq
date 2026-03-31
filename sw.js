const CACHE_NAME = 'traq-v8';

const STATIC_ASSETS = [
  './index.html',
  './home.html',
  './home_sl.html',
  './input_equipment.html',
  './input_mold.html',
  './dashboard.html',
  './settings.html',
  './admin.html',
  './excel_download.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// インストール：静的リソースをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      self._isUpdate = keys.some(k => k !== 'traq-push-nav' && k !== CACHE_NAME);
    }).then(() =>
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.warn('SW: 一部ファイルのキャッシュに失敗:', err);
        });
      })
    )
  );
  self.skipWaiting();
});

// アクティベート：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== 'traq-push-nav').map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
     .then(() => {
       if (self._isUpdate) {
         return self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
           clients.forEach(client => {
             client.postMessage({ type: 'UPDATE_AVAILABLE', version: CACHE_NAME });
           });
         });
       }
     })
  );
});

// フェッチ戦略
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.hostname.includes('supabase.co')) {
    return;
  }

  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  if (event.request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});

// ===== Push通知 =====

// Push通知を受信
self.addEventListener('push', event => {
  // フォールバックURLを ./home_sl.html（相対パス）に変更
  var data = { title: 'Traq', body: '新しい通知があります', url: './home_sl.html' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  var options = {
    body: data.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'traq-trouble-' + Date.now(),
    renotify: true,
    data: { url: data.url || './home_sl.html' },
    vibrate: [200, 100, 200],
    actions: [{ action: 'open', title: '確認する' }]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Traq', options)
  );
});

// 通知タップ時 — Cache APIにナビ先URLを保存してからアプリを開く
self.addEventListener('notificationclick', event => {
  event.notification.close();

  var targetUrl = (event.notification.data && event.notification.data.url) || './home_sl.html';

  // ★修正: self.location.href（= .../traq/sw.js）を基準にすることで /traq/ が正しく付く
  var fullUrl = new URL(targetUrl, self.location.href).href;

  event.waitUntil(
    caches.open('traq-push-nav').then(function(cache) {
      return cache.put('/__push_nav__', new Response(fullUrl));
    }).then(function() {
      return clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function(windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.includes('ryotaimage-oss.github.io/traq')) {
          client.postMessage({ type: 'PUSH_NAV', url: fullUrl });
          return client.focus();
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});
