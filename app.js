/* ---------- HOTFIX: 書籤 + ↻ 快取更新 保證可用 ---------- */
(function () {
  // 小工具
  const waitFor = (fn, interval = 80, times = 50) =>
    new Promise((res, rej) => {
      const t = setInterval(() => {
        let v;
        try { v = fn(); } catch {}
        if (v) { clearInterval(t); res(v); }
        if (--times <= 0) { clearInterval(t); rej(); }
      }, interval);
    });

  // 1) ↻ 立即更新（等 DOM 準備好才插入；多重備援位置）
  async function ensureRefreshBtn() {
    try { await waitFor(() => document.body); } catch {}
    let btn = document.getElementById('refreshBtn');
    if (btn) return btn;

    const mk = () => {
      const b = document.createElement('button');
      b.id = 'refreshBtn';
      b.textContent = '↻';
      b.title = '立即更新快取';
      Object.assign(b.style, {
        padding: '6px 10px',
        background: 'var(--chip)',
        color: 'var(--fg)',
        border: 0,
        borderRadius: '8px',
        flex: '0 0 auto'
      });
      b.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
          }
          location.reload(true);
        } catch (err) { console.error(err); }
      }, { passive: false });
      return b;
    };

    const bar = document.querySelector('.top-actions');
    if (bar) { btn = mk(); bar.appendChild(btn); return btn; }

    const topbar = document.querySelector('.topbar');
    if (topbar) { btn = mk(); topbar.appendChild(btn); return btn; }

    // 最後備援：右下角迷你浮動，不擋住書籤 FAB
    btn = mk();
    Object.assign(btn.style, { position: 'fixed', right: '14px', bottom: '86px', zIndex: 31 });
    document.body.appendChild(btn);
    return btn;
  }
  ensureRefreshBtn().catch(() => { /* 忽略 */ });

  // 若 DOM 之後被重建（有些框架），再試一次
  new MutationObserver(() => {
    if (!document.getElementById('refreshBtn')) ensureRefreshBtn();
  }).observe(document.documentElement, { childList: true, subtree: true });

  // 2) 書籤 FAB：支援 #bookmarkBtn、[data-bookmark]、.fab 三種選法
  let bookmarkY = null;
  function bindBookmark() {
    const cand = document.querySelector('#bookmarkBtn, [data-bookmark], .fab');
    if (!cand) return;
    cand.addEventListener('click', (e) => {
      // 很多時候 FAB 用 <a>，會觸發預設導航；這裡攔截
      e.preventDefault && e.preventDefault();
      if (bookmarkY == null) {
        bookmarkY = window.scrollY;
        showToast('已設書籤；再點一次回到書籤');
      } else {
        window.scrollTo({ top: bookmarkY, behavior: 'smooth' });
        bookmarkY = null;
      }
    }, { passive: false });
  }
  function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', left: '50%', bottom: '20px', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,.7)', color: '#fff', padding: '8px 12px',
      borderRadius: '8px', zIndex: 9999
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1500);
  }

  // 等 DOM 準備好再綁一次；之後若 DOM 重建也會再綁
  waitFor(() => document.body).then(bindBookmark).catch(() => {});
  new MutationObserver(bindBookmark).observe(document.documentElement, { childList: true, subtree: true });
})();
