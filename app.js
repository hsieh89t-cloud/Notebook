// ===== v1.5 App =====
(() => {
  const $ = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));

  // 狀態
  let notes = [];
  let lastQuery = "";
  let bookmark = JSON.parse(localStorage.getItem('NB_BOOKMARK')||'null'); // {id, scroll}
  let fontSize = localStorage.getItem('NB_FONT') || 'medium';
  let theme = localStorage.getItem('NB_THEME') || 'dark';

  // DOM
  const listView = $('#listView');
  const detailView = $('#detailView');
  const tagBar = $('#tagBar');
  const searchInput = $('#searchInput');
  const themeToggle = $('#themeToggle');
  const fontToggle = $('#fontToggle');
  const refreshBtn = $('#refreshBtn');
  const bookmarkBtn = $('#bookmarkBtn');

  // 初始化外觀
  document.body.classList.toggle('light', theme==='light');
  document.body.classList.toggle('dark', theme!=='light');
  document.body.setAttribute('data-font', fontSize);
  fontToggle.textContent = fontSize==='small'?'小':(fontSize==='large'?'大':'中');

  // ---- utils ----
  function mdToHtml(md){
    if(!md) return '';
    // 1) 轉換圖片 ![alt](url)
    md = md.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (m, alt, url) => {
      return `<img class="post-img" alt="${alt||''}" src="${url}">`;
    });
    // 2) 轉換連結 [text](url)
    md = md.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, text, url) => {
      return `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
    });
    // 3) 換行
    return md.replace(/\n/g, '<br>');
  }

  async function fetchNotes(){
    const base = typeof BASE_URL==='string' ? BASE_URL.replace(/\/exec$/, '/exec') : '';
    if(!base || base.includes('YOUR_GAS_EXEC_URL')){
      listView.innerHTML = `<div class="center">⚠️ 尚未設定 GAS URL。請開啟 <code>config.js</code> 將 <b>BASE_URL</b> 換成你的 /exec 網址。</div>`;
      return;
    }
    const url = base + `?type=listNotebook&nocache=${Date.now()}`;
    try{
      const res = await fetch(url, {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if(!Array.isArray(data)) throw new Error('API 回傳非陣列：' + JSON.stringify(data).slice(0,200));
      notes = data;
    }catch(err){
      console.error(err);
      listView.innerHTML = `<div class="center">載入失敗。<a id="retry" href="#">重試</a><div style="margin-top:8px;opacity:.7">${err}</div></div>`;
      $('#retry')?.addEventListener('click', e => { e.preventDefault(); init(); });
    }
  }

  function renderTags(){
    const all = new Map();
    notes.forEach(n => (n.tags||'').split(/\s+/).filter(Boolean).forEach(t => all.set(t, (all.get(t)||0)+1)));
    const top10 = Array.from(all.keys()).slice(0,10);
    tagBar.innerHTML = top10.map(t=>`<button class="tag">#${t}</button>`).join('') + (all.size>10?`<button class="tag more">更多…</button>`:'');
    $$('.tag', tagBar).forEach(btn => btn.addEventListener('click', () => {
      const t = btn.textContent.replace('#','').replace('更多…','').trim();
      if(!t) return;
      lastQuery = t;
      searchInput.value = `#${t}`;
      renderList();
      window.scrollTo({top: document.body.clientTop + 0, behavior:'smooth'});
    }));
  }

  function filterNotes(){
    if(!lastQuery) return notes;
    const q = lastQuery.replace(/^#/,'').toLowerCase();
    return notes.filter(n => 
      (n.title||'').toLowerCase().includes(q) ||
      (n.body||'').toLowerCase().includes(q) ||
      (n.tags||'').toLowerCase().includes(q)
    );
  }

  function renderList(){
    const arr = filterNotes();
    if(!arr.length){ listView.innerHTML = `<div class="center">沒有符合條件的筆記</div>`; return; }
    listView.innerHTML = arr.map(n => `
      <div class="card">
        <h2><a href="#${n.id}">${escapeHtml(n.title||'(無標題)')}</a></h2>
        <time>${escapeHtml(n.date||'')}</time>
        <p>${escapeHtml((n.body||'').replace(/[\n\r]+/g,' ').slice(0,120))}...</p>
        <div class="tags">${(n.tags||'').split(/\s+/).filter(Boolean).map(t=>`<span>#${escapeHtml(t)}</span>`).join('')}</div>
      </div>
    `).join('');
  }

  function renderDetail(note){
    detailView.innerHTML = `
      <article>
        <h2>${escapeHtml(note.title||'(無標題)')}</h2>
        <time>${escapeHtml(note.date||'')}</time>
        <div class="post">${mdToHtml(note.body||'')}</div>
        <div class="tags">${(note.tags||'').split(/\\s+/).filter(Boolean).map(t=>`<span>#${escapeHtml(t)}</span>`).join('')}</div>
      </article>
    `;
  }

  function route(){
    const id = location.hash.slice(1);
    const inDetail = Boolean(id);
    document.body.classList.toggle('in-detail', inDetail);
    if(!inDetail){
      detailView.classList.add('hidden');
      listView.classList.remove('hidden');
      renderList();
      return;
    }
    const note = notes.find(n=>String(n.id)===id);
    if(!note){
      detailView.classList.add('hidden');
      listView.classList.remove('hidden');
      return;
    }
    listView.classList.add('hidden');
    detailView.classList.remove('hidden');
    renderDetail(note);
    // 回到書籤紀錄的捲動位置
    if(bookmark && bookmark.id===id && typeof bookmark.scroll==='number'){
      setTimeout(()=> window.scrollTo({top: bookmark.scroll, behavior:'instant'}), 0);
    }else{
      window.scrollTo({top:0,behavior:'instant'});
    }
  }

  // 書籤：在內文頁按下會「記錄」位置；在列表頁按下會「前往書籤」
  bookmarkBtn.addEventListener('click', () => {
    const id = location.hash.slice(1);
    if(id){ // 在內文：存
      bookmark = { id, scroll: window.scrollY|0, ts: Date.now() };
      localStorage.setItem('NB_BOOKMARK', JSON.stringify(bookmark));
      toast('已存為書籤');
    }else{ // 在列表：跳
      if(bookmark && bookmark.id){
        location.hash = '#' + bookmark.id;
        setTimeout(()=> window.scrollTo({top: bookmark.scroll||0, behavior:'instant'}), 50);
      }else{
        toast('尚未設定書籤');
      }
    }
  });

  // 搜尋
  searchInput.addEventListener('input', e => { lastQuery = e.target.value.trim(); renderList(); });

  // 快取更新
  refreshBtn.addEventListener('click', async () => { await init(true); toast('已更新'); });

  // 深淺色切換
  themeToggle.addEventListener('click', () => {
    theme = (theme==='light') ? 'dark' : 'light';
    document.body.classList.toggle('light', theme==='light');
    document.body.classList.toggle('dark', theme!=='light');
    localStorage.setItem('NB_THEME', theme);
  });

  // 字體切換（單鍵循環）
  fontToggle.addEventListener('click', () => {
    fontSize = (fontSize==='small') ? 'medium' : (fontSize==='medium' ? 'large' : 'small');
    document.body.setAttribute('data-font', fontSize);
    fontToggle.textContent = fontSize==='small'?'小':(fontSize==='large'?'大':'中');
    localStorage.setItem('NB_FONT', fontSize);
  });

  // 小提示
  function toast(msg){
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {position:'fixed',left:'50%',bottom:'84px',transform:'translateX(-50%)',background:'rgba(0,0,0,.7)',color:'#fff',padding:'8px 12px',borderRadius:'10px',zIndex:99});
    document.body.appendChild(el);
    setTimeout(()=> el.remove(), 1200);
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  window.addEventListener('hashchange', route);

  async function init(force=false){
    if(force || !notes.length){ await fetchNotes(); }
    renderTags();
    route();
  }

  // 啟動
  init();
})();