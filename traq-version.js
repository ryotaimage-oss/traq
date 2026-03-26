/**
 * Traq バージョン管理・アップデート通知
 * 
 * ★ アップデート時はここのバージョン番号だけ変更してください ★
 */
const TRAQ_VERSION = '1.0.0';

(function initVersionCheck() {
  // DOM構築後に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  function run() {
    const lastVersion = localStorage.getItem('traq_last_version');

    if (!lastVersion) {
      // 初回アクセス：バージョンを保存してスキップ
      localStorage.setItem('traq_last_version', TRAQ_VERSION);
      return;
    }

    if (lastVersion !== TRAQ_VERSION) {
      // 新バージョン検知：バナーを表示
      showBanner(lastVersion, TRAQ_VERSION);
    }
  }

  function showBanner(oldVer, newVer) {
    // バナーHTML生成
    const banner = document.createElement('div');
    banner.id = 'traq-update-banner';
    banner.innerHTML = `
      <div style="
        position:fixed;bottom:0;left:0;right:0;z-index:9999;
        background:linear-gradient(135deg,#EF9F27,#c97d10);
        padding:10px 16px;
        box-shadow:0 -4px 20px rgba(0,0,0,0.3);
        animation:traqBannerSlide .35s cubic-bezier(.22,.68,0,1.2) both;
      ">
        <style>
          @keyframes traqBannerSlide {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        </style>
        <div style="max-width:560px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
            <span style="font-size:22px;flex-shrink:0">🆕</span>
            <div style="min-width:0">
              <div style="font-size:13px;font-weight:700;color:#080d18;white-space:nowrap">
                Traq が v${newVer} にアップデートされました
              </div>
              <div style="font-size:11px;color:rgba(8,13,24,.65)">
                v${oldVer} → v${newVer}　キャッシュをクリアして最新版を読み込みます
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <button onclick="traqForceReload()" style="
              height:36px;background:#080d18;border:none;border-radius:8px;
              color:#EF9F27;font-family:inherit;font-size:12px;font-weight:700;
              padding:0 14px;cursor:pointer;white-space:nowrap;
            ">今すぐ更新</button>
            <button onclick="traqDismissBanner()" style="
              height:36px;background:rgba(8,13,24,.15);border:none;border-radius:8px;
              color:#080d18;font-family:inherit;font-size:12px;font-weight:500;
              padding:0 12px;cursor:pointer;white-space:nowrap;
            ">後で</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    // ボトムナビがある場合は少し上にずらす
    const nav = document.querySelector('.bottom-nav');
    if (nav) {
      banner.firstElementChild.style.bottom = '64px';
    }
  }
})();

// グローバル関数（バナーから呼び出し）
function traqForceReload() {
  localStorage.setItem('traq_last_version', TRAQ_VERSION);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
  }
  if ('caches' in window) {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    });
  }
  setTimeout(() => location.reload(true), 400);
}

function traqDismissBanner() {
  const banner = document.getElementById('traq-update-banner');
  if (banner) {
    banner.style.animation = 'none';
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(100%)';
    banner.style.transition = 'all .25s ease';
    setTimeout(() => banner.remove(), 250);
  }
}
