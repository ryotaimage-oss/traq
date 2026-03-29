/**
 * update_banner.js
 * 全ページ共通：
 *   1) SW更新検知 → ボトムバナー表示
 *   2) Push通知タップ → ナビゲーション（Cache API / postMessage）
 * 使い方: <script src="./update_banner.js"></script> を各ページに追加
 */
(function() {
  // ============================================================
  //  ① SW更新バナー（既存機能）
  // ============================================================
  var BANNER_ID   = 'traq-update-banner';
  var STYLE_ID    = 'traq-update-style';
  var SNOOZED_KEY = 'traq_update_snoozed';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + BANNER_ID + '{',
        'position:fixed;bottom:0;left:0;right:0;z-index:9999;',
        'background:#EF9F27;color:#080d18;',
        'display:flex;align-items:center;justify-content:space-between;',
        'padding:12px 16px;gap:10px;',
        'font-family:"Noto Sans JP",sans-serif;font-size:13px;font-weight:600;',
        'transform:translateY(100%);transition:transform .35s cubic-bezier(.22,1,.36,1);',
        'box-shadow:0 -2px 12px rgba(0,0,0,.25);',
      '}',
      '#' + BANNER_ID + '.visible{transform:translateY(0)}',
      '#' + BANNER_ID + ' .ub-msg{display:flex;align-items:center;gap:8px;flex:1;min-width:0}',
      '#' + BANNER_ID + ' .ub-badge{background:rgba(8,13,24,.2);border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700;white-space:nowrap}',
      '#' + BANNER_ID + ' .ub-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#' + BANNER_ID + ' .ub-actions{display:flex;gap:8px;flex-shrink:0}',
      '#' + BANNER_ID + ' .ub-btn-now{',
        'background:#080d18;color:#EF9F27;border:none;border-radius:6px;',
        'padding:7px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;',
      '}',
      '#' + BANNER_ID + ' .ub-btn-later{',
        'background:rgba(8,13,24,.15);color:#080d18;border:none;border-radius:6px;',
        'padding:7px 12px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;',
      '}',
    ].join('');
    document.head.appendChild(s);
  }

  function createBanner() {
    if (document.getElementById(BANNER_ID)) return;
    var el = document.createElement('div');
    el.id = BANNER_ID;
    el.innerHTML =
      '<div class="ub-msg">' +
        '<span class="ub-badge">NEW</span>' +
        '<span class="ub-text">アップデートがあります</span>' +
      '</div>' +
      '<div class="ub-actions">' +
        '<button class="ub-btn-now" onclick="window._traqUpdateNow()">今すぐ更新</button>' +
        '<button class="ub-btn-later" onclick="window._traqUpdateLater()">後で</button>' +
      '</div>';
    document.body.appendChild(el);
  }

  function showBanner() {
    var snoozed = parseInt(localStorage.getItem(SNOOZED_KEY) || '0');
    if (snoozed && Date.now() - snoozed < 30 * 60 * 1000) return;

    injectStyle();
    createBanner();
    var bnav = document.querySelector('.bottom-nav');
    var offset = bnav ? bnav.offsetHeight : 0;
    var banner = document.getElementById(BANNER_ID);
    if (banner && offset > 0) {
      banner.style.bottom = offset + 'px';
    }
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        var b = document.getElementById(BANNER_ID);
        if (b) b.classList.add('visible');
      });
    });
  }

  window._traqUpdateNow = function() {
    localStorage.removeItem(SNOOZED_KEY);
    if ('caches' in window) {
      caches.keys().then(function(keys) {
        return Promise.all(keys.map(function(k) { return caches.delete(k); }));
      }).then(function() {
        location.reload(true);
      });
    } else {
      location.reload(true);
    }
  };

  window._traqUpdateLater = function() {
    localStorage.setItem(SNOOZED_KEY, Date.now().toString());
    var b = document.getElementById(BANNER_ID);
    if (b) {
      b.classList.remove('visible');
      setTimeout(function() { if (b.parentNode) b.parentNode.removeChild(b); }, 400);
    }
  };

  // ============================================================
  //  ② Push通知タップ → ナビゲーション
  //     sw.js の notificationclick が Cache API (traq-push-nav)
  //     にナビ先URLを保存済み。ここで読み取ってナビゲーションする。
  // ============================================================

  var PUSH_NAV_CACHE = 'traq-push-nav';
  var PUSH_NAV_KEY   = '/__push_nav__';
  var _pushNavProcessing = false; // 二重実行防止

  /**
   * Cache API からナビ先URLを読み取り → 削除 → ナビゲーション
   * sw.js がどのページで通知タップされても、このスクリプトが
   * 全ページで読み込まれているため確実にキャッチできる。
   */
  function checkPushNav() {
    if (_pushNavProcessing) return;
    if (!('caches' in window)) return;

    _pushNavProcessing = true;

    caches.open(PUSH_NAV_CACHE).then(function(cache) {
      return cache.match(PUSH_NAV_KEY);
    }).then(function(response) {
      if (!response) {
        _pushNavProcessing = false;
        return;
      }
      return response.text().then(function(targetUrl) {
        // キャッシュを即削除（次回の重複ナビゲーション防止）
        return caches.open(PUSH_NAV_CACHE).then(function(cache) {
          return cache.delete(PUSH_NAV_KEY);
        }).then(function() {
          return targetUrl;
        });
      });
    }).then(function(targetUrl) {
      if (!targetUrl) {
        _pushNavProcessing = false;
        return;
      }
      navigateTo(targetUrl);
    }).catch(function(err) {
      console.warn('Push nav check error:', err);
      _pushNavProcessing = false;
    });
  }

  /**
   * ナビゲーション実行
   * 現在のページと同一URLならリロード、違えば遷移
   */
  function navigateTo(targetUrl) {
    try {
      var target = new URL(targetUrl, location.origin);
      var current = new URL(location.href);

      // パス + クエリが同一なら何もしない（既に該当ページにいる）
      // ただし ?detail= 付きの場合はリロードして詳細を開く
      if (target.pathname === current.pathname && target.search === current.search) {
        _pushNavProcessing = false;
        return;
      }

      // 同一パスだがクエリ異なる（?detail=xxx 追加など）→ 遷移
      // 異なるパス → 遷移
      location.href = target.pathname + target.search;
    } catch (e) {
      console.warn('Push nav error:', e);
      _pushNavProcessing = false;
    }
  }

  // ============================================================
  //  ③ SW登録 & イベントリスナー
  // ============================================================

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function(e) {
      console.warn('SW登録失敗:', e);
    });

    // SW → ページへのメッセージ受信
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (!event.data) return;

      // SW更新バナー
      if (event.data.type === 'UPDATE_AVAILABLE') {
        showBanner();
      }

      // Push通知タップからの直接ナビゲーション（postMessage経由）
      // iOS PWAではアプリがフォアグラウンドの時のみ有効
      if (event.data.type === 'PUSH_NAV' && event.data.url) {
        // Cache APIにも書き込まれているが、postMessageが先に届いた場合は
        // こちらで処理してキャッシュも削除
        if (!_pushNavProcessing) {
          _pushNavProcessing = true;
          // キャッシュ削除（checkPushNavとの競合防止）
          if ('caches' in window) {
            caches.open(PUSH_NAV_CACHE).then(function(cache) {
              return cache.delete(PUSH_NAV_KEY);
            }).catch(function() {});
          }
          navigateTo(event.data.url);
        }
      }
    });

    // すでに待機中のSWがいる場合も検知
    navigator.serviceWorker.ready.then(function(reg) {
      if (reg.waiting) {
        showBanner();
      }
      reg.addEventListener('updatefound', function() {
        var newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', function() {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showBanner();
          }
        });
      });
    });
  }

  // ============================================================
  //  ④ visibilitychange でPushナビゲーションチェック
  //     iOS PWA: 通知タップ → アプリがフォアグラウンドに戻る
  //     → visibilitychange fired → Cache APIを読む → ナビゲーション
  // ============================================================

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      checkPushNav();
    }
  });

  // ページ初回ロード時もチェック（通知タップで新規タブが開いた場合）
  // DOMContentLoaded後に少し遅延して実行（SW登録完了を待つ）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(checkPushNav, 300);
    });
  } else {
    setTimeout(checkPushNav, 300);
  }

})();
