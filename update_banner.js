/**
 * update_banner.js
 * 全ページ共通：SW更新検知 → ボトムバナー表示
 * 使い方: <script src="./update_banner.js"></script> を各ページに追加
 */
(function() {
  var BANNER_ID   = 'traq-update-banner';
  var STYLE_ID    = 'traq-update-style';
  var SNOOZED_KEY = 'traq_update_snoozed'; // 「後で」を押した時刻

  // スタイル注入
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

  // バナー生成
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

  // バナー表示
  function showBanner() {
    // 「後で」を押してから30分以内は表示しない
    var snoozed = parseInt(localStorage.getItem(SNOOZED_KEY) || '0');
    if (snoozed && Date.now() - snoozed < 30 * 60 * 1000) return;

    injectStyle();
    createBanner();
    // ボトムナビの高さ分だけずらす（ボトムナビがある場合）
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

  // 今すぐ更新
  window._traqUpdateNow = function() {
    localStorage.removeItem(SNOOZED_KEY);
    // SW全キャッシュ削除 → リロード
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

  // 後で（30分スヌーズ）
  window._traqUpdateLater = function() {
    localStorage.setItem(SNOOZED_KEY, Date.now().toString());
    var b = document.getElementById(BANNER_ID);
    if (b) {
      b.classList.remove('visible');
      setTimeout(function() { if (b.parentNode) b.parentNode.removeChild(b); }, 400);
    }
  };

  // SW登録 & メッセージ受信
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function(e) {
      console.warn('SW登録失敗:', e);
    });

    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
        showBanner();
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
})();
