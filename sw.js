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
// isUpdate フラグ：古いSWが存在していた場合のみ true
self.addEventListener('install', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      // traq-push-nav以外の既存キャッシュがあれば「更新」
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
// 実際に更新があった場合のみクライアントに通知
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== 'traq-push-nav').map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
     .then(() => {
       // 古いSWからの更新時のみバナーを表示
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

  // Supabase API はキャッシュしない
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Google Fonts はキャッシュ優先
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

  // HTMLファイルはネットワーク優先（オフライン時はキャッシュ）
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

  // その他（JS・CSS・画像等）はキャッシュ優先
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
  var data = { title: 'Traq', body: '新しい通知があります', url: '/home_sl.html' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  var options = {
    body: data.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'traq-trouble-' + Date.now(),
    renotify: true,
    data: { url: data.url || '/home_sl.html' },
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

  var targetUrl = (event.notification.data && event.notification.data.url) || '/home_sl.html';
  var fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    // 1) Cache APIにナビ先URLを保存（ページ側 update_banner.js で読み取る）
    caches.open('traq-push-nav').then(function(cache) {
      return cache.put('/__push_nav__', new Response(fullUrl));
    }).then(function() {
      return clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function(windowClients) {
      // 2) 既存タブがあれば postMessage + focus
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.includes('ryotaimage-oss.github.io/traq')) {
          client.postMessage({ type: 'PUSH_NAV', url: fullUrl });
          return client.focus();
        }
      }
      // 3) なければ新規タブ（iOS PWAでは効かない場合があるがフォールバック）
      return clients.openWindow(fullUrl);
    })
  );
});
