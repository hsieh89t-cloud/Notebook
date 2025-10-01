/* =========================
 * Notebook PWA - app.js (fullfix5)
 * - 列表 / 內文 / 搜尋 / 分類 / 標籤
 * - 文字大小切換、主題切換（若 HTML 已提供）
 * - 書籤超穩定版（跨頁/重整可回）
 * - 快取更新 FAB（可選）
 * ========================= */

(function(){
  'use strict';

  // ---- Config ----
  const BASE_URL = (window.CONFIG && window.CONFIG.BASE_URL) || '';
  const API = {
    listNotebook: BASE_URL + '?type=listNotebook',
    // 若之後要回收桶： listRecycle: BASE_URL + '?type=listRecycle'
  };

  // ---- State ----
  const state = {
    list: [],           // 全部資料
    filtered: [],       // 篩選結果
    byId: new Map(),    // id -> item
    query: '',
    category: '全部分類',
    tag: '',            // 由 #tag 點選帶入
    font: localStorage.getItem('nb_font') || '中', // 小/中/大
    theme: localStorage.getItem('nb_theme') || 'dark'
  };

  // ---- 快捷選擇器 ----
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // ---- 工具 ----
  const fmtDate = s=>{
    try{
      const d = new Date(s);
      if(!isFinite(+d)) return s || '';
      return d.toISOString();
    }catch(_){return s||'';}
  };
  function parseTags(s){
    return s ? String(s).trim().split(/\s+/).map(t=>t.replace(/^#/, '')).filter(Boolean) : [];
  }
  const esc = s => String(s||'').replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  // 將 Markdown 裡的圖片轉 <img>（含 Drive / Imgur）
  function renderBody(md){
    let html = esc(md).replace(/\n/g,'<br>');
    // ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (m,alt,url)=>{
      // Google Drive 共享連結兼容：若是 drive.google.com/open?id=，換成 uc?export=view&id=
      const driveId = (url.match(/[?&]id=([^&]+)/) || [])[1];
      if(/drive\.google\.com/.test(url)){
        if(driveId) url = 'https://drive.google.com/uc?export=view&id=' + driveId;
      }
      return `<img class="post-img" src="${url}" alt="${esc(alt)}" loading="lazy">`;
    });
    // 純連結行（含 drive 直接顯示圖）
    html = html.replace(/(https?:\/\/[^\s<]+)/g,(m)=>{
      if(/(\.png|\.jpg|\.jpeg|\.gif|\.webp)(\?|$)/i.test(m) || /drive\.google\.com/.test(m)){
        const driveId = (m.match(/[?&]id=([^&]+)/) || [])[1];
        let u = m;
        if(/drive\.google\.com/.test(m) && driveId) u = 'https://drive.google.com/uc?export=view&id='+driveId;
        return `<img class="post-img" src="${u}" alt="" loading="lazy">`;
      }
      return `<a href="${m}" target="_blank" rel="noopener">${m}</a>`;
    });
    return html;
  }

  // ---- 資料存取 ----
  async function fetchList(){
    const res = await fetch(API.listNotebook, { cache:'no-store' });
    if(!res.ok) throw new Error('API fail');
    const json = await res.json();
    const list = Array.isArray(json.data) ? json.data : json; // 兼容
    state.list = list.map(n=>{
      // 預期欄位：id / date / category / title / body / tags
      n.id = n.id || n.ID || n.Id || n[1] || '';
      n.date = n.date || n.Date || n[0] || '';
      n.category = n.category ?? n.Category ?? '';
      n.title = n.title ?? n.Title ?? '(未命名)';
      n.body = n.body ?? n.Body ?? '';
      n.tags = (n.tags ?? n.Tags ?? '').trim(); // 空白分隔
      n._tagsArr = parseTags(n.tags);
      state.byId.set(String(n.id), n);
      return n;
    });
    indexCategories();
    applyFilter();
  }

  // ---- 索引分類 ----
  function indexCategories(){
    const all = new Set(['全部分類']);
    state.list.forEach(it=>{ if(it.category) all.add(it.category); });
    const sel = $('#categoryFilter');
    if(sel){
      sel.innerHTML = '';
      Array.from(all).forEach(c=>{
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        sel.appendChild(opt);
      });
      sel.value = state.category;
    }
  }

  // ---- 篩選 ----
  function applyFilter(){
    const q = state.query.trim();
    const cat = state.category;
    const tag = state.tag;
    let arr = state.list.slice();
    if(cat && cat !== '全部分類'){
      arr = arr.filter(it => it.category === cat);
    }
    if(tag){
      arr = arr.filter(it => it._tagsArr.includes(tag));
    }
    if(q){
      const s = q.toLowerCase();
      arr = arr.filter(it =>
        (it.title||'').toLowerCase().includes(s) ||
        (it.body||'').toLowerCase().includes(s) ||
        (it.tags||'').toLowerCase().includes(s)
      );
    }
    state.filtered = arr;
    renderList();
  }

  // ---- Render：列表 ----
  function renderList(){
    const box = $('#listView');
    if(!box) return;
    if(!state.filtered.length){
      box.innerHTML = `<div class="empty">沒有資料</div>`;
      return;
    }
    box.innerHTML = state.filtered.map(it=>{
      const tags = it._tagsArr.map(t=>`<button class="chip chip--tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join(' ');
      return `
      <article class="card">
        <a class="card__title" href="#/${esc(it.id)}">${esc(it.title)}</a>
        <div class="meta">
          <time>${esc(fmtDate(it.date))}</time>
          ${it.category ? `<span class="meta__cat">${esc(it.category)}</span>`:''}
        </div>
        ${tags?`<div class="tags">${tags}</div>`:''}
        <p class="excerpt">${esc((it.body||'').replace(/\s+/g,' ').slice(0,120))}</p>
        <a class="btn btn--ghost" href="#/${esc(it.id)}">查看</a>
      </article>`;
    }).join('');
  }

  // ---- Render：內文 ----
  function renderDetail(id){
    const box = $('#detailView');
    if(!box) return;
    const it = state.byId.get(String(id));
    if(!it){
      box.innerHTML = `<div class="empty">找不到這篇（id: ${esc(id)}）</div>`;
      return;
    }
    const tags = it._tagsArr.map(t=>`<button class="chip chip--tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join(' ');
    box.innerHTML = `
      <article class="post">
        <h1 class="post__title">${esc(it.title)}</h1>
        <div class="meta"><time>${esc(fmtDate(it.date))}</time>${it.category?` · <span>${esc(it.category)}</span>`:''}</div>
        ${tags?`<div class="tags">${tags}</div>`:''}
        <div class="post__body">${renderBody(it.body||'')}</div>
        <div class="post__nav">
          <a class="btn" id="prevBtn">上一篇</a>
          <a class="btn" id="nextBtn">下一篇</a>
          <a class="btn btn--ghost" href="#/">返回列表</a>
        </div>
      </article>
    `;

    // 上下篇
    const idx = state.filtered.findIndex(x=> String(x.id)===String(id));
    const prev = state.filtered[idx-1], next = state.filtered[idx+1];
    $('#prevBtn')?.addEventListener('click', (e)=>{
      e.preventDefault(); if(prev) location.hash = '#/'+prev.id;
    });
    $('#nextBtn')?.addEventListener('click', (e)=>{
      e.preventDefault(); if(next) location.hash = '#/'+next.id;
    });
  }

  // ---- 路由 ----
  function route(){
    const h = location.hash || '#/';
    const m = h.match(/^#\/(.+)/);
    // 切換視圖類名
    $$('.view').forEach(v=>v.classList.remove('view--active'));
    if(m){
      $('#detailView')?.classList.add('view--active');
      renderDetail(m[1]);
    }else{
      $('#listView')?.classList.add('view--active');
      renderList();
    }
  }

  // ---- 綁定 ----
  function bindEvents(){
    // 搜尋
    $('#searchInput')?.addEventListener('input', e=>{
      state.query = e.target.value || '';
      applyFilter();
    });
    // 分類
    $('#categoryFilter')?.addEventListener('change', e=>{
      state.category = e.target.value || '全部分類';
      applyFilter();
    });
    // 標籤代理（列表 / 內文）
    document.addEventListener('click', e=>{
      const btn = e.target.closest('.chip--tag');
      if(btn){
        e.preventDefault();
        const tag = btn.getAttribute('data-tag') || '';
        state.tag = tag;
        location.hash = '#/'; // 回列表
        // 等 hash 切完後再套篩選
        setTimeout(()=>{ applyFilter(); }, 60);
      }
    });
    // 重試（可選）
    $('#retryList')?.addEventListener('click', e=>{
      e.preventDefault(); load();
    });
    $('#detailRetry')?.addEventListener('click', e=>{
      e.preventDefault(); route();
    });
    // hash 路由
    window.addEventListener('hashchange', route);
  }

  // ---- 字級 / 主題（若 HTML 已有按鈕就生效）----
  function applyFont(){
    document.documentElement.setAttribute('data-font', state.font);
    localStorage.setItem('nb_font', state.font);
  }
  function cycleFont(){ state.font = state.font==='小' ? '中' : (state.font==='中'?'大':'小'); applyFont(); }
  $('#fontToggle')?.addEventListener('click', e=>{ e.preventDefault(); cycleFont(); });
  applyFont();

  function applyTheme(){
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('nb_theme', state.theme);
  }
  function toggleTheme(){ state.theme = state.theme==='dark'?'light':'dark'; applyTheme(); }
  $('#themeToggle')?.addEventListener('click', e=>{ e.preventDefault(); toggleTheme(); });
  applyTheme();

  // ---- 載入 ----
  async function load(){
    try{
      $('#listView') && ($('#listView').innerHTML = '<div class="loading">載入中…</div>');
      await fetchList();
      route();
    }catch(e){
      console.error(e);
      $('#listView') && ($('#listView').innerHTML = '<div class="empty">載入失敗 <a id="retryList" href="#">重試</a></div>');
      $('#retryList')?.addEventListener('click', ev=>{ ev.preventDefault(); load(); });
    }
  }

  // 初始化
  bindEvents();
  load();

  /* ===== FULLFIX5_BOOKMARK_FORCE（跨頁/重整可回） ===== */
  (function(){
    const KEY = 'nb_bookmark_snap';    // 存 {hash, y, t}
    const BTN_ID = 'bookmarkBtn';      // 建議你的 FAB 加上這個 id
    const SELS = ['#'+BTN_ID, '[data-bookmark]', '.fab']; // 後備：舊 class 也吃

    const nowHash = () => location.hash || '#/';
    const getY = () => window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    function scrollToY(y){
      try{ window.scrollTo({top:y,behavior:'smooth'}); setTimeout(()=>window.scrollTo(0,y),350); }
      catch(_){ window.scrollTo(0,y); }
    }
    function toast(msg){
      try{
        const t=document.createElement('div'); t.textContent=msg;
        Object.assign(t.style,{position:'fixed',left:'50%',bottom:'18px',transform:'translateX(-50%)',
          background:'rgba(0,0,0,.8)',color:'#fff',padding:'8px 12px',borderRadius:'8px',zIndex:9999,fontSize:'14px'});
        document.body.appendChild(t); setTimeout(()=>t.remove(),1500);
      }catch(_){}
    }
    function saveSnap(){ localStorage.setItem(KEY, JSON.stringify({hash:nowHash(), y:getY(), t:Date.now()})); toast('已設書籤；再點一次回去'); }
    function getSnap(){ try{ return JSON.parse(localStorage.getItem(KEY)||'null'); }catch(_){ return null; } }
    function clearSnap(){ localStorage.removeItem(KEY); }
    function goSnap(){
      const s=getSnap(); if(!s){ toast('沒有書籤'); return; }
      const doScroll=()=>{ scrollToY(Math.max(0, s.y|0)); clearSnap(); };
      if(s.hash===nowHash()) doScroll();
      else{ const once=()=>{ setTimeout(doScroll,180); window.removeEventListener('hashchange',once); };
            window.addEventListener('hashchange',once); location.hash=s.hash; }
    }
    function bindById(){
      const el=document.getElementById(BTN_ID); if(!el) return false;
      if(el.__nb_bookmark_bound) return true; el.__nb_bookmark_bound=true;
      el.addEventListener('click',(e)=>{ e.preventDefault?.(); e.stopPropagation?.(); const s=getSnap(); s?goSnap():saveSnap(); },{passive:false});
      return true;
    }
    function delegateOnDocument(){
      if(document.__nb_bookmark_delegated) return;
      document.__nb_bookmark_delegated = true;
      document.addEventListener('click', function(e){
        const path = e.composedPath ? e.composedPath() : (function(n,a){ while(n){ a.push(n); n=n.parentNode; } return a; })(e.target,[]);
        const hit = path && path.find && path.find(node=>{
          if(!node || !node.matches) return false;
          return SELS.some(sel=> node.matches(sel));
        });
        if(hit){ e.preventDefault?.(); e.stopPropagation?.(); const s=getSnap(); s?goSnap():saveSnap(); }
      }, {capture:true, passive:false});
    }
    new MutationObserver(()=>{ bindById(); }).observe(document.documentElement,{subtree:true,childList:true});
    delegateOnDocument(); bindById();
    setTimeout(()=>{ const s=getSnap(); if(s && s.hash===nowHash()) toast('已有書籤；再點一次📌回去'); }, 400);
    window.nbBookmark = {save:saveSnap, go:goSnap, clear:clearSnap, get:getSnap};
  })();

  /* ===== Refresh FAB（可選）— 右下 ↻ 清快取＋重載 ===== */
  (function(){
    const btn = document.getElementById('refreshFab');
    if(!btn) return;
    btn.addEventListener('click', async (e)=>{
      e.preventDefault?.(); e.stopPropagation?.();
      try{
        // 讓開發中最穩：跳過 SW 快取
        if('serviceWorker' in navigator && navigator.serviceWorker.controller){
          const reg = await navigator.serviceWorker.getRegistration();
          await reg?.unregister();
          // 也清除 caches（若 sw 有建立）
          if(window.caches){ const keys = await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); }
        }
      }catch(_){}
      location.reload(true);
    }, {passive:false});
  })();

})();