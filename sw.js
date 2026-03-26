// ============================================
// Traq Service Worker — Web Push 通知受信
// ファイル配置: リポジトリのルート（index.html と同じ階層）
// ============================================

// Push 通知を受信した時
self.addEventListener('push', (event) => {
  let data = { title: 'Traq', body: 'トラブルが送信されました', url: './home_sl.html' };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    // JSON パース失敗時はデフォルト値を使用
  }

  const options = {
    body: data.body || 'トラブルが送信されました',
    icon: data.icon || './icon-192.png',
    badge: data.badge || './badge-72.png',
    tag: data.tag || 'traq-trouble-' + Date.now(),
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './home_sl.html'
    },
    actions: [
      { action: 'open', title: '確認する' },
      { action: 'close', title: '閉じる' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Traq', options)
  );
});

// 通知をタップした時
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || './home_sl.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 既にTraqが開いていればそのタブにフォーカス
      for (const client of windowClients) {
        if (client.url.includes('home_sl.html') && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // 開いていなければ新しいタブで開く
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Service Worker インストール時
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Service Worker アクティベート時
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
