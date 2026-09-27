/* ===========================================================================
   Traq — 旧アドレス（https://ryotaimage-oss.github.io/traq/）用の後片付けSW
   ---------------------------------------------------------------------------
   役割はひとつだけ。「端末に残った古い Traq を自分で消す」こと。

   なぜ必要か：
     旧アプリの Service Worker は画面(HTML)をキャッシュ優先で返す。
     そのため新アドレスへ移した後も、端末に残ったキャッシュのせいで
     いつまでも古い画面が表示され続けてしまう。
     ブラウザは起動時に sw.js の更新を自動で確認するので、
     旧アドレスにこのファイルを置いておけば、そこで古いSWが
     この「後片付けSW」に置き換わり、キャッシュごと消えて引っ越しページに進む。

   やること：
     1. 即座に有効化（待機しない）
     2. キャッシュを全部削除
     3. 開いている画面を ./index.html（引っ越しページ）へ移す
     4. 最後に自分自身の登録を解除する

   fetch ハンドラは意図的に置かない。
   置かない＝すべての通信がそのままネットワークへ抜けるので、
   キャッシュを消した直後から常に最新のファイルが読まれる。
   =========================================================================== */

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    // 開いている画面の制御を引き取る（古いSWを追い出す）
    try { await self.clients.claim(); } catch (e) {}

    // 古いキャッシュを全部消す
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) {}

    // 開いている画面を引っ越しページへ送る
    // （navigate は同一オリジンのみ許可されるため、まず旧アドレスの index.html に送り、
    //   そこから新アドレスへ転送させる）
    try {
      var list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (var i = 0; i < list.length; i++) {
        try { await list[i].navigate('./index.html?moved=1'); } catch (e) {}
      }
    } catch (e) {}

    // 役目を終えたので自分を消す
    try { await self.registration.unregister(); } catch (e) {}
  })());
});
