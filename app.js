// v1.3.1-fix: robust init for font/theme toggles + logs
const BASE = window.__CONFIG__ && window.__CONFIG__.BASE_URL;

// ---- util ----
function $(id){ return document.getElementById(id); }
function on(el, ev, fn){ if(el) el.addEventListener(ev, fn); }

const els = {
  listView: $('listView'),
  detailView: $('detailView'),
  noteList: $('noteList'),
  listEmpty: $('listEmpty'),
  listError: $('listError'),
  retryList: $('retryList'),
  search: $('searchInput'),
  catSel: $('categoryFilter'),
  tagChips: $('tagChips'),
  moreTags: $('moreTagsBtn'),
  noteTitle: $('noteTitle'),
  noteDate: $('noteDate'),
  noteCat: $('noteCat'),
  noteTags: $('noteTags'),
  noteBody: $('noteBody'),
  prev: $('prevLink'),
  next: $('nextLink'),
  detailError: $('detailError'),
  detailRetry: $('detailRetry'),
  themeToggle: $('themeToggle'),
  bookmarkBtn: $('bookmarkBtn'),
  lightbox: $('lightbox'),
  lightboxImg: $('lightboxImg'),
  fontToggle: $('fontToggle')
};

console.log('[init] elements', els);

// ---- theme toggle ----
(function initTheme(){
  const saved = (localStorage.getItem('theme') || 'dark');
  if (saved === 'light') document.documentElement.classList.add('light');
  on(els.themeToggle, 'click', () => {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    console.log('[theme] toggled ->', isLight ? 'light' : 'dark');
  });
})();

// ---- font toggle (small -> medium -> large) ----
(function initFontToggle(){
  const order = ['small','medium','large'];
  const size = { small:'14px', medium:'16px', large:'19px' };
  const label = { small:'小', medium:'中', large:'大' };
  let cur = localStorage.getItem('fs') || 'medium';
  apply();
  on(els.fontToggle, 'click', () => {
    const idx = (order.indexOf(cur) + 1) % order.length;
    cur = order[idx];
    apply();
    localStorage.setItem('fs', cur);
    console.log('[font] switched ->', cur);
  });
  function apply(){
    document.documentElement.style.setProperty('--fs', size[cur] || '16px');
    if (els.fontToggle) els.fontToggle.textContent = label[cur] || '中';
  }
})();

// ---- networking helpers ----
async function fetchJSON(url){
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
  return await res.json();
}
function parseTags(str){ return str ? String(str).trim().split(/\s+/).filter(Boolean) : []; }
function uniq(arr){ return Array.from(new Set(arr)); }

// ---- list rendering ----
let cacheList = [];
let lastQuery = { q:"", tag:"", cat:"" };
let tagCollapsed = true;
const TAG_LIMIT = 10;

function applyFilters(items){
  const q = (lastQuery.q||"").toLowerCase();
  const tag = lastQuery.tag;
  const cat = lastQuery.cat;
  return items.filter(it => {
    if (cat && String(it.category||'') !== cat) return false;
    if (tag && !parseTags(it.tags).includes(tag)) return false;
    if (q){
      const hay = [it.title, it.body, it.tags].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function escapeHTML(s){ const d=document.createElement('div'); d.textContent = s==null?'':String(s); return d.innerHTML; }

function renderListUI(items){
  const cats = uniq(items.map(x => String(x.category||'')).filter(Boolean)).sort();
  if (els.catSel) {
    els.catSel.innerHTML = '<option value=\"\">全部分類</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    els.catSel.value = lastQuery.cat || '';
  }
  const freq = new Map();
  items.forEach(it => parseTags(it.tags).forEach(t => freq.set(t, (freq.get(t)||0)+1)));
  const topAll = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
  const show = tagCollapsed ? topAll.slice(0, TAG_LIMIT) : topAll;
  if (els.tagChips) {
    els.tagChips.innerHTML = show.map(t => {
      const active = (t === lastQuery.tag) ? ' chip--active' : '';
      return `<button class="chip${active}" data-tag="${t}">#${t}</button>`;
    }).join('');
    els.tagChips.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
      const t = btn.dataset.tag;
      lastQuery.tag = (lastQuery.tag === t) ? "" : t;
      renderListUI(items);
      updateList();
    }));
  }
  if (els.moreTags) {
    els.moreTags.hidden = topAll.length <= TAG_LIMIT;
    els.moreTags.textContent = tagCollapsed ? '更多…' : '收合';
    els.moreTags.onclick = () => { tagCollapsed = !tagCollapsed; renderListUI(items); renderList(items); };
  }
}

async function loadList(){
  if (els.listError) els.listError.hidden = true;
  const j = await fetchJSON(`${BASE}?type=listNotebook`);
  if (!j.ok) throw new Error(JSON.stringify(j.error||{}));
  let items = j.data || [];
  items.sort((a,b)=> String(b.date).localeCompare(String(a.date)));
  cacheList = items;
  renderListUI(items);
  return items;
}

function renderList(items){
  const filtered = applyFilters(items);
  if (els.noteList) {
    els.noteList.innerHTML = filtered.map(it => {
      const tags = parseTags(it.tags).slice(0,4).map(t => `#${t}`).join(' ');
      const preview = String(it.body||'').replace(/\n+/g,' ').slice(0,100);
      return `<li class="card">
        <a href="#/note/${it.id}"><h3>${escapeHTML(it.title||'(未命名)')}</h3></a>
        <div class="meta"><span>${escapeHTML(it.date||'')}</span><span>${escapeHTML(it.category||'')}</span><span>${escapeHTML(tags)}</span></div>
        <div class="preview">${escapeHTML(preview)}</div>
      </li>`;
    }).join('');
  }
  if (els.listEmpty) els.listEmpty.hidden = filtered.length !== 0;
}

async function updateList(){
  try{
    const items = cacheList.length ? cacheList : await loadList();
    renderList(items);
  }catch(e){
    console.error(e);
    if (els.listError) els.listError.hidden = false;
  }
}

// ---- bookmark ----
let bookmarkY = null;
on(els.bookmarkBtn, 'click', () => {
  if (bookmarkY == null) {
    bookmarkY = window.scrollY;
    toast('已設書籤；再點一次回到書籤');
  } else {
    window.scrollTo({ top: bookmarkY, behavior: 'smooth' });
    bookmarkY = null;
  }
});
function toast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',background:'rgba(0,0,0,.7)',color:'#fff',padding:'8px 12px',borderRadius:'8px',zIndex:9999});
  document.body.appendChild(t);
  setTimeout(()=>{ t.remove(); }, 1500);
}

// ---- detail ----
async function showNote(id){
  if (els.detailError) els.detailError.hidden = true;
  bookmarkY = null;
  try{
    const j = await fetchJSON(`${BASE}?type=getById&id=${encodeURIComponent(id)}`);
    if (!j.ok || !j.data) throw new Error('not found');
    const it = j.data;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
    if (els.detailView) els.detailView.classList.add('view--active');

    if (els.noteTitle) els.noteTitle.textContent = it.title || '(未命名)';
    if (els.noteDate) els.noteDate.textContent = it.date || '';
    if (els.noteCat) els.noteCat.textContent = it.category || '';
    if (els.noteTags) els.noteTags.textContent = parseTags(it.tags).map(t=>'#'+t).join(' ');

    // markdown & images
    const rawMD = String(it.body || "").replace(/\((https:\/\/drive\.google\.com\/(?:open\?id=|file\/d\/)([A-Za-z0-9\-_]+)[^)]*)\)/g,
      (_m, _url, id) => `(https://drive.google.com/uc?export=view&id=${id})`);
    const rawHTML = marked.parse(rawMD, { mangle:false, headerIds:false });
    const clean = DOMPurify.sanitize(rawHTML, {
      ADD_ATTR: ['target','referrerpolicy','loading','decoding'],
      ALLOWED_URI_REGEXP: /^(https?:|data:image\/)/i
    });
    if (els.noteBody) els.noteBody.innerHTML = clean;

    if (els.noteBody){
      els.noteBody.querySelectorAll('a[href]').forEach(a => a.setAttribute('target','_blank'));
      els.noteBody.querySelectorAll('img').forEach(img => {
        const m = String(img.src).match(/https:\/\/drive\.google\.com\/(?:open\?id=|file\/d\/)([A-Za-z0-9\-_]+)/);
        if (m) img.src = `https://drive.google.com/uc?export=view&id=${m[1]}`;
        img.setAttribute('loading','lazy'); img.setAttribute('decoding','async'); img.setAttribute('referrerpolicy','no-referrer');
        img.addEventListener('dblclick', () => openLightbox(img.src));
      });
    }

    if (!cacheList.length) await loadList();
    const idx = cacheList.findIndex(x => x.id === it.id);
    const prev = idx > 0 ? cacheList[idx-1] : null;
    const next = idx >= 0 && idx < cacheList.length-1 ? cacheList[idx+1] : null;
    if (els.prev){ if (prev){ els.prev.hidden=false; els.prev.href=`#/note/${prev.id}`; } else els.prev.hidden=true; }
    if (els.next){ if (next){ els.next.hidden=false; els.next.href=`#/note/${next.id}`; } else els.next.hidden=true; }

  }catch(e){
    console.error(e);
    if (els.detailError) els.detailError.hidden = false;
  }
}

// ---- lightbox ----
function openLightbox(src){
  if (!els.lightbox || !els.lightboxImg) return;
  els.lightboxImg.src = src;
  els.lightbox.classList.add('open');
  document.body.classList.add('modal-open');
}
on(els.lightbox, 'click', () => {
  els.lightbox.classList.remove('open');
  document.body.classList.remove('modal-open');
});

// ---- router ----
function route(){
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/note\/(.+)$/);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
  if (m){
    if (els.detailView) els.detailView.classList.add('view--active');
    showNote(decodeURIComponent(m[1]));
  }else{
    if (els.listView) els.listView.classList.add('view--active');
    updateList();
  }
}
window.addEventListener('hashchange', route);
on(els.retryList, 'click', e => { e.preventDefault(); updateList(); });
on(els.detailRetry, 'click', e => { e.preventDefault(); route(); });
on(els.search, 'input', () => { lastQuery.q = els.search.value.trim(); updateList(); });
on(els.catSel, 'change', () => { lastQuery.cat = els.catSel.value; updateList(); });

route();
console.log('[init] app ready');
