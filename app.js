
(()=>{
const $=sel=>document.querySelector(sel);
const $$=sel=>Array.from(document.querySelectorAll(sel));
const CFG=window.NB_CFG;

$('#appTitle').textContent = CFG.TITLE;
$('#ver').textContent = CFG.VERSION;

const store={
  get(k,v){ try{ return JSON.parse(localStorage.getItem(k)) ?? v }catch(e){ return v } },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
};

// theme & font
function applyTheme(){
  const m=store.get('theme','dark'); document.documentElement.classList.toggle('light', m==='light');
}
function toggleTheme(){ const m=store.get('theme','dark'); store.set('theme', m==='dark'?'light':'dark'); applyTheme(); }
function applyFont(){ const s=store.get('font','中'); const map={小:'15px',中:'17px',大:'19px'}; document.documentElement.style.setProperty('--fs', map[s]||'17px'); $('#fontBtn').textContent=s; }
function cycleFont(){ const order=['小','中','大']; let cur=store.get('font','中'); let idx=(order.indexOf(cur)+1)%order.length; store.set('font',order[idx]); applyFont(); }

$('#themeBtn').addEventListener('click', toggleTheme);
$('#fontBtn').addEventListener('click', cycleFont);
applyTheme(); applyFont();

// --- A2HS-safe fetch (handles CORS/redirect/debug) ---
async function safeFetchJSON(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}\n` + text.slice(0, 500));
    try { return JSON.parse(text); } catch (e) {
      // 某些情況後端字串化物件
      if (text.startsWith('{') && text.includes('"data"')) {
        return (new Function('return ' + text))();
      }
      throw new Error('JSON parse fail: ' + text.slice(0, 500));
    }
  } catch (err) {
    if (typeof window.openModal === 'function') {
      openModal('[A2HS] ' + String(err));
    } else {
      alert('[A2HS] ' + String(err));
    }
    throw err;
  }
}

// fetch helpers
async function apiList(){
  const url = `${CFG.API_BASE}?type=listNotebook&sheetId=${encodeURIComponent(CFG.SHEET_ID)}`;
  const json = await safeFetchJSON(url);
  if(!json || json.ok!==true || !Array.isArray(json.data)) throw new Error('API 回傳非陣列');
  return json.data;
}

let raw=[], tags=[];
function norm(rec){
  const id = rec.id || rec.ID || rec.Id || '';
  const title = (rec.title||rec.標題||'').trim();
  const body = (rec.body||rec.內容||'').toString();
  const category = (rec.category||rec.分類||'').trim();
  const t = (rec.tags||rec.標籤||'').toString().trim();
  const tagArr = t? t.split(/\s+|,|#|；|、/).map(s=>s.trim()).filter(Boolean):[];
  const date = rec.date || rec.日期 || rec.Date || '';
  return {id,title,body,category,tags:tagArr,date};
}

function renderTags(){
  const row = $('#tagRow'); row.innerHTML='';
  const limit = CFG.TAG_LIMIT || 10;
  const popular = tags.slice(0,limit);
  popular.forEach(tag=>{
    const b=document.createElement('button'); b.className='tag'; b.textContent='#'+tag;
    b.addEventListener('click',()=>{ 
      if(b.classList.contains('active')){ b.classList.remove('active'); filter(); }
      else{ $$('.tag.active').forEach(x=>x.classList.remove('active')); b.classList.add('active'); filter(); }
    });
    row.appendChild(b);
  });
}

function mdToHtml(md){
  // 圖片
  md = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_,alt,src)=>`<img alt="${alt||''}" src="${src}">`);
  // 連結
  md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`);
  // 換行
  md = md.replace(/\n/g,'<br>');
  return md;
}

// list
function cardHtml(r){
  const tagStr = r.tags.length? r.tags.map(t=>`#${t}`).join(' ') : '';
  return `<li class="card" data-id="${r.id}">
    <h3>${r.title||'(無標題)'}</h3>
    <div class="meta">${r.date||''}　${tagStr}</div>
    <div class="preview">${(r.body||'').slice(0,120)}</div>
  </li>`;
}
function renderList(arr){
  const ul=$('#cards'); ul.innerHTML=arr.map(cardHtml).join('');
  $('#empty').classList.toggle('hidden', arr.length>0);
  $$('#cards .card').forEach(li=> li.addEventListener('click',()=> openDetail(li.dataset.id)));
}

function filter(){
  const q = $('#searchInput').value.trim().toLowerCase();
  const tagActive = ($('.tag.active')?.textContent||'').replace(/^#/,'').trim();
  let arr = raw;
  if(tagActive) arr = arr.filter(r=> r.tags.includes(tagActive));
  if(q){
    arr = arr.filter(r=> (r.title+r.body+r.tags.join(' ')).toLowerCase().includes(q));
  }
  renderList(arr);
}
$('#searchInput').addEventListener('input', filter);

// detail & bookmark
function openDetail(id){
  const r = raw.find(x=>x.id===id) || raw[0];
  if(!r) return;
  const html = `<h2>${r.title||'(無標題)'}</h2>
  <div class="meta">${r.date||''}　${r.tags.map(t=>'#'+t).join(' ')}</div>
  <div class="body">${mdToHtml(r.body||'')}</div>`;
  $('#detail').innerHTML = html;
  location.hash = '#/detail/'+encodeURIComponent(r.id);
  // 書籤按
  $('#pinBtn').onclick = ()=>{
    store.set('bookmark',{id:r.id, offset: window.scrollY });
    toast('書籤已記住');
  };
}
$('#backBtn').addEventListener('click', ()=>{ location.hash='#/list'; });

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),1200); }

// modal (debug)
function openModal(msg){ $('#modalText').textContent=msg; $('#modal').classList.remove('hidden'); }
$('#modalClose').addEventListener('click', ()=> $('#modal').classList.add('hidden'));

// refresh
$('#refreshBtn').addEventListener('click', async ()=>{ await init(true); toast('已更新'); });

// debug
$('#debugBtn').addEventListener('click', async ()=>{
  try{
    const data = await apiList();
    openModal('API OK，數量：'+data.length);
  }catch(e){
    openModal('API Error：'+e.message);
  }
});

// router
function route(){
  const h=location.hash||'#/list';
  if(h.startsWith('#/detail/')){
    $('.view').classList.add('hidden'); $('#detailView').classList.remove('hidden');
  }else{
    $('.view').classList.add('hidden'); $('#listView').classList.remove('hidden');
  }
}
window.addEventListener('hashchange', route);

// init
async function init(force=false){
  $('#appTitle').textContent = CFG.TITLE; $('#ver').textContent = CFG.VERSION;
  try{
    const data = await apiList(); // always fresh
    raw = data.map(norm);
    // collect tags
    const map={}; raw.forEach(r=> r.tags.forEach(t=> map[t]=(map[t]||0)+1 ));
    tags = Object.keys(map).sort((a,b)=> map[b]-map[a]);
    renderTags();
    filter();
    // 如果有書籤，且是列表頁，顯示回到書籤
    const bm = store.get('bookmark',null);
    if(bm && location.hash==='#/list'){
      const btn = document.createElement('button');
      btn.textContent='回到書籤';
      btn.className='tag';
      btn.style.marginLeft='8px';
      btn.onclick=()=>{ openDetail(bm.id); setTimeout(()=>{ window.scrollTo({top:bm.offset, behavior:'instant'}); }, 50); };
      $('#tagRow').appendChild(btn);
    }
  }catch(e){
    $('#cards').innerHTML='';
    $('#empty').classList.remove('hidden');
    openModal('載入失敗：'+e.message);
  }
  route();
}

init();
})();


// ===== Editable Module v1.6.0 =====
(function(){
  const CFG = window.NB_CFG || {};
  const API = CFG.API_BASE;
  const ACT = (CFG.ACTIONS||{});
  const OUTBOX_KEY = 'nb_outbox_v1';

  function showSaving(msg){
    let el = document.querySelector('.saving');
    if(!el){
      el = document.createElement('div');
      el.className = 'saving';
      el.id = 'savingInfo';
      const nav = document.querySelector('.detail-nav');
      nav && nav.after(el);
    }
    el.textContent = msg || '正在儲存…';
    clearTimeout(el._t);
    el._t = setTimeout(()=>{ el.textContent=''; }, 1500);
  }

  // --- Outbox for offline edits ---
  function readOutbox(){
    try{ return JSON.parse(localStorage.getItem(OUTBOX_KEY))||[]; }catch(e){ return []; }
  }
  function writeOutbox(list){
    try{ localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)); }catch(e){}
  }
  async function flushOutbox(){
    const list = readOutbox();
    if(!list.length) return;
    for(const job of list.slice()){
      try{
        if(job.type==='create') await apiCreate(job.data);
        if(job.type==='update') await apiUpdate(job.id, job.data);
        const cur = readOutbox().filter(x=>x.ts!==job.ts);
        writeOutbox(cur);
      }catch(e){ /* keep it for next time */ }
    }
  }
  window.addEventListener('online', flushOutbox);
  setTimeout(flushOutbox, 800);

  // --- API helpers ---
  async function apiCreate(payload){
    const url = API + '?action=' + encodeURIComponent(ACT.create||'createNote');
    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if(!res.ok) throw new Error('Create fail: ' + text);
    try{ return JSON.parse(text); }catch{ return { ok:true }; }
  }

  async function apiUpdate(id, payload){
    const url = API + '?action=' + encodeURIComponent(ACT.update||'updateNote') + '&id=' + encodeURIComponent(id);
    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if(!res.ok) throw new Error('Update fail: ' + text);
    try{ return JSON.parse(text); }catch{ return { ok:true }; }
  }

  // --- UI behaviors ---
  const fab = document.getElementById('fabNew');
  if(fab){
    fab.addEventListener('click', async ()=>{
      const now = new Date();
      const note = { title: now.toLocaleString(), content: '', tags: [] };
      try{
        showSaving('正在新增…');
        await apiCreate(note);
        showSaving('已新增');
        if(typeof window.reloadList==='function') reloadList();
      }catch(e){
        const jobs = readOutbox();
        jobs.push({ type:'create', data:note, ts: Date.now() });
        writeOutbox(jobs);
        showSaving('離線已暫存，恢復網路會自動送出');
      }
    });
  }

  const detail = document.getElementById('detail');
  if(detail){
    function enableEditable(){
      if(detail._editableInit) return;
      detail._editableInit = true;
      detail.addEventListener('click', (e)=>{
        if(detail.getAttribute('data-mode')==='read'){
          detail.setAttribute('data-mode','edit');
          let wrapper = detail.querySelector('.editable');
          if(!wrapper){
            wrapper = document.createElement('div');
            wrapper.className = 'editable';
            wrapper.innerHTML = detail.innerHTML;
            detail.innerHTML = '';
            detail.appendChild(wrapper);
          }
          wrapper.setAttribute('contenteditable','true');
          wrapper.focus();
        }
      });

      let timer=null;
      detail.addEventListener('input', ()=>{
        if(detail.getAttribute('data-mode')!=='edit') return;
        clearTimeout(timer);
        timer = setTimeout(async ()=>{
          const contentEl = detail.querySelector('.editable') || detail;
          const content = contentEl.innerHTML;
          const id = window.currentArticleId;
          const titleEl = document.querySelector('#detail h1, #detail .title, #detail [data-title]');
          const title = titleEl ? (titleEl.textContent || titleEl.innerText || '') : '';
          const payload = { title, content };
          try{
            showSaving('正在儲存…');
            await apiUpdate(id, payload);
            showSaving('已儲存');
          }catch(e){
            const jobs = readOutbox();
            jobs.push({ type:'update', id, data: payload, ts: Date.now() });
            writeOutbox(jobs);
            showSaving('離線暫存，恢復網路自動同步');
          }
        }, 1200);
      });

      detail.addEventListener('blur', (e)=>{
        if(e.target.matches('.editable')){
          setTimeout(()=> detail.setAttribute('data-mode','read'), 150);
        }
      }, true);
    }

    const origOnRender = window.onArticleRendered;
    window.onArticleRendered = function(article){
      if(origOnRender) try{ origOnRender(article); }catch(e){}
      enableEditable();
    };
  }

})(); 

