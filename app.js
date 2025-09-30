// v1.3: sticky tags+search, font sizes, robust images, floating bookmark, lightbox
const BASE = window.__CONFIG__.BASE_URL;

let cacheList = [];
let lastQuery = { q: "", tag: "", cat: "" };
let tagCollapsed = true;
const TAG_LIMIT = 10;

// Elements
const els = {
  listView: document.getElementById('listView'),
  detailView: document.getElementById('detailView'),
  noteList: document.getElementById('noteList'),
  listEmpty: document.getElementById('listEmpty'),
  listError: document.getElementById('listError'),
  retryList: document.getElementById('retryList'),
  search: document.getElementById('searchInput'),
  catSel: document.getElementById('categoryFilter'),
  tagChips: document.getElementById('tagChips'),
  moreTags: document.getElementById('moreTagsBtn'),
  noteTitle: document.getElementById('noteTitle'),
  noteDate: document.getElementById('noteDate'),
  noteCat: document.getElementById('noteCat'),
  noteTags: document.getElementById('noteTags'),
  noteBody: document.getElementById('noteBody'),
  prev: document.getElementById('prevLink'),
  next: document.getElementById('nextLink'),
  detailError: document.getElementById('detailError'),
  detailRetry: document.getElementById('detailRetry'),
  themeToggle: document.getElementById('themeToggle'),
  bookmarkBtn: document.getElementById('bookmarkBtn'),
  lightbox: document.getElementById('lightbox'),
  lightboxImg: document.getElementById('lightboxImg'),
};

// Theme
(function initTheme(){
  const saved = localStorage.getItem('theme') || 'dark';
  if (saved === 'light') document.documentElement.classList.add('light');
  els.themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });
})();

// Font size
(function initFontSize(){
  const buttons = document.querySelectorAll('.font-size button');
  const saved = localStorage.getItem('fs') || 'medium';
  applyFs(saved);
  buttons.forEach(b => {
    if (b.dataset.fs === saved) b.classList.add('active');
    b.addEventListener('click', () => {
      buttons.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      applyFs(b.dataset.fs);
      localStorage.setItem('fs', b.dataset.fs);
    });
  });
  function applyFs(key){
    const map = { small: '14px', medium: '16px', large: '19px' };
    document.documentElement.style.setProperty('--fs', map[key] || '16px');
  }
})();

// Helpers
async function fetchJSON(url){
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
  return await res.json();
}

function parseTags(str){
  if(!str) return [];
  return String(str).trim().split(/\s+/).filter(Boolean);
}

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

function uniq(arr){ return Array.from(new Set(arr)); }

function renderListUI(items){
  // categories
  const cats = uniq(items.map(x => String(x.category||'')).filter(Boolean)).sort();
  els.catSel.innerHTML = '<option value=\"\">全部分類</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  els.catSel.value = lastQuery.cat || '';

  // tags with collapse & toggle
  const freq = new Map();
  items.forEach(it => parseTags(it.tags).forEach(t => freq.set(t, (freq.get(t)||0)+1)));
  const topAll = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
  const show = tagCollapsed ? topAll.slice(0, TAG_LIMIT) : topAll;
  els.tagChips.innerHTML = show.map(t => {
    const active = (t === lastQuery.tag) ? ' chip--active' : '';
    return `<button class="chip${active}" data-tag="${t}">#${t}</button>`;
  }).join('');
  els.moreTags.hidden = topAll.length <= TAG_LIMIT;
  els.moreTags.textContent = tagCollapsed ? '更多…' : '收合';
  els.moreTags.onclick = () => { tagCollapsed = !tagCollapsed; renderListUI(items); renderList(items); };

  els.tagChips.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
    const t = btn.dataset.tag;
    lastQuery.tag = (lastQuery.tag === t) ? "" : t; // toggle to clear
    renderListUI(items);
    updateList();
  }));
}

async function loadList(){
  els.listError.hidden = true;
  const j = await fetchJSON(`${BASE}?type=listNotebook`);
  if(!j.ok) throw new Error(JSON.stringify(j.error||{}));
  let items = j.data || [];
  items.sort((a,b)=> String(b.date).localeCompare(String(a.date)));
  cacheList = items;
  renderListUI(items);
  return items;
}

function escapeHTML(s){
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function renderList(items){
  const filtered = applyFilters(items);
  els.noteList.innerHTML = filtered.map(it => {
    const tags = parseTags(it.tags).slice(0,4).map(t => `#${t}`).join(' ');
    const preview = String(it.body||'').replace(/\n+/g,' ').slice(0,100);
    return `<li class="card">
      <a href="#/note/${it.id}"><h3>${escapeHTML(it.title||'(未命名)')}</h3></a>
      <div class="meta"><span>${escapeHTML(it.date||'')}</span><span>${escapeHTML(it.category||'')}</span><span>${escapeHTML(tags)}</span></div>
      <div class="preview">${escapeHTML(preview)}</div>
    </li>`;
  }).join('');
  els.listEmpty.hidden = filtered.length !== 0;
}

async function updateList(){
  try{
    const items = cacheList.length ? cacheList : await loadList();
    renderList(items);
  }catch(e){
    console.error(e);
    els.listError.hidden = false;
  }
}

// Bookmark (floating)
let bookmarkY = null;
els.bookmarkBtn.addEventListener('click', () => {
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

// Detail
async function showNote(id){
  els.detailError.hidden = true;
  bookmarkY = null;
  try{
    const j = await fetchJSON(`${BASE}?type=getById&id=${encodeURIComponent(id)}`);
    if(!j.ok || !j.data) throw new Error('not found');
    const it = j.data;

    document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
    els.detailView.classList.add('view--active');

    els.noteTitle.textContent = it.title || '(未命名)';
    els.noteDate.textContent = it.date || '';
    els.noteCat.textContent = it.category || '';
    els.noteTags.textContent = parseTags(it.tags).map(t=>'#'+t).join(' ');

    // ---- Robust Markdown -> HTML with Drive image fix ----
    const rawMD = String(it.body || "");

    const mdFixed = rawMD
      // open?id= or file/d/ → uc?export=view&id=
      .replace(/\((https:\/\/drive\.google\.com\/(?:open\?id=|file\/d\/)([A-Za-z0-9\-_]+)[^)]*)\)/g,
        (_m, _url, id) => `(https://drive.google.com/uc?export=view&id=${id})`);

    const rawHTML = marked.parse(mdFixed, { mangle:false, headerIds:false });
    const clean = DOMPurify.sanitize(rawHTML, {
      ADD_ATTR: ['target','referrerpolicy','loading','decoding'],
      ALLOWED_URI_REGEXP: /^(https?:|data:image\/)/i
    });
    els.noteBody.innerHTML = clean;
    // link target
    els.noteBody.querySelectorAll('a[href]').forEach(a => a.setAttribute('target','_blank'));
    // tune images
    els.noteBody.querySelectorAll('img').forEach(img => {
      const m = String(img.src).match(/https:\/\/drive\.google\.com\/(?:open\?id=|file\/d\/)([A-Za-z0-9\-_]+)/);
      if (m) img.src = `https://drive.google.com/uc?export=view&id=${m[1]}`;
      img.setAttribute('loading','lazy');
      img.setAttribute('decoding','async');
      img.setAttribute('referrerpolicy','no-referrer');
      // double click to open lightbox
      img.addEventListener('dblclick', () => openLightbox(img.src));
    });

    // prev/next
    if (!cacheList.length) await loadList();
    const idx = cacheList.findIndex(x => x.id === it.id);
    const prev = idx > 0 ? cacheList[idx-1] : null;
    const next = idx >= 0 && idx < cacheList.length-1 ? cacheList[idx+1] : null;
    if (prev){ els.prev.hidden=false; els.prev.href = `#/note/${prev.id}`; } else { els.prev.hidden=true; }
    if (next){ els.next.hidden=false; els.next.href = `#/note/${next.id}`; } else { els.next.hidden=true; }

  }catch(e){
    console.error(e);
    els.detailError.hidden = false;
  }
}

// Lightbox
function openLightbox(src){
  els.lightboxImg.src = src;
  els.lightbox.classList.add('open');
  document.body.classList.add('modal-open');
}
els.lightbox.addEventListener('click', () => {
  els.lightbox.classList.remove('open');
  document.body.classList.remove('modal-open');
});

// Router & events
function route(){
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/note\/(.+)$/);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
  if (m){
    els.detailView.classList.add('view--active');
    showNote(decodeURIComponent(m[1]));
  }else{
    els.listView.classList.add('view--active');
    updateList();
  }
}
window.addEventListener('hashchange', route);
els.retryList && els.retryList.addEventListener('click', e => { e.preventDefault(); updateList(); });
els.detailRetry && els.detailRetry.addEventListener('click', e => { e.preventDefault(); route(); });
els.search.addEventListener('input', () => { lastQuery.q = els.search.value.trim(); updateList(); });
els.catSel.addEventListener('change', () => { lastQuery.cat = els.catSel.value; updateList(); });

route();
