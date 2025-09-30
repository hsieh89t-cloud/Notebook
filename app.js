// Basic PWA Notebook demo
const BASE = window.__CONFIG__.BASE_URL;

let cacheList = []; // for prev/next
let lastQuery = { q: "", tag: "", cat: "" };

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

async function fetchJSON(url){
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
  return await res.json();
}

function formatDate(s){
  return s || "";
}

function parseTags(str){
  if(!str) return [];
  return String(str).trim().split(/\s+/).filter(Boolean);
}

function applyFilters(items){
  const q = lastQuery.q.toLowerCase();
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

  // tags chips (top 20 by freq)
  const freq = new Map();
  items.forEach(it => parseTags(it.tags).forEach(t => freq.set(t, (freq.get(t)||0)+1)));
  const top = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([t])=>t);
  els.tagChips.innerHTML = top.map(t => `<button class="chip" data-tag="${t}">#${t}</button>`).join('');
  els.tagChips.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
    lastQuery.tag = btn.dataset.tag;
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

function renderList(items){
  const filtered = applyFilters(items);
  els.noteList.innerHTML = filtered.map(it => {
    const tags = parseTags(it.tags).slice(0,4).map(t => `#${t}`).join(' ');
    const preview = String(it.body||'').replace(/\n+/g,' ').slice(0,100);
    return `<li class="card">
      <a href="#/note/${it.id}"><h3>${escapeHTML(it.title||'(未命名)')}</h3></a>
      <div class="meta"><span>${escapeHTML(formatDate(it.date||''))}</span><span>${escapeHTML(it.category||'')}</span><span>${escapeHTML(tags)}</span></div>
      <div class="preview">${escapeHTML(preview)}</div>
    </li>`;
  }).join('');
  els.listEmpty.hidden = filtered.length !== 0;
}

function escapeHTML(s){
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
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

async function showNote(id){
  els.detailError.hidden = true;
  try{
    const j = await fetchJSON(`${BASE}?type=getById&id=${encodeURIComponent(id)}`);
    if(!j.ok || !j.data) throw new Error('not found');
    const it = j.data;
    els.noteTitle.textContent = it.title || '(未命名)';
    els.noteDate.textContent = it.date || '';
    els.noteCat.textContent = it.category || '';
    els.noteTags.textContent = parseTags(it.tags).map(t=>'#'+t).join(' ');

    const rawHTML = marked.parse(String(it.body||''), { mangle:false, headerIds:false });
    const clean = DOMPurify.sanitize(rawHTML, { ADD_ATTR: ['target'] });
    els.noteBody.innerHTML = clean;
    els.noteBody.querySelectorAll('a[href]').forEach(a => a.setAttribute('target','_blank'));

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
els.retryList.addEventListener('click', e => { e.preventDefault(); updateList(); });
els.detailRetry.addEventListener('click', e => { e.preventDefault(); route(); });
els.search.addEventListener('input', () => { lastQuery.q = els.search.value.trim(); updateList(); });
els.catSel.addEventListener('change', () => { lastQuery.cat = els.catSel.value; updateList(); });

route();
