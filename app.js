// fullfix4: 完整清單/內文 + 浮動 ↻ + 穩定書籤 + 圖片修正
const BASE = (window.__CONFIG__ && window.__CONFIG__.BASE_URL) || '';
const $=(id)=>document.getElementById(id);
const on=(el,ev,fn)=>{ if(el) el.addEventListener(ev,fn); };

// ---- 顶部功能：主題 / 字級 ----
(function(){
  const themeBtn=$('themeToggle'); const fsBtn=$('fontToggle');
  const saved=localStorage.getItem('theme')||'dark'; if(saved==='light') document.documentElement.classList.add('light');
  on(themeBtn,'click',()=>{ const light=document.documentElement.classList.toggle('light'); localStorage.setItem('theme',light?'light':'dark'); });
  const order=['small','medium','large'], label={small:'小',medium:'中',large:'大'}, size={small:'14px',medium:'16px',large:'19px'};
  let cur=localStorage.getItem('fs')||'medium'; apply();
  on(fsBtn,'click',()=>{cur=order[(order.indexOf(cur)+1)%order.length]; apply(); localStorage.setItem('fs',cur);});
  function apply(){ document.documentElement.style.setProperty('--fs',size[cur]); if(fsBtn) fsBtn.textContent=label[cur]; }
})();

// ---- 浮動 ↻（永遠存在） ----
(function(){
  const b=document.createElement('button'); b.id='refreshBtnFloat'; b.textContent='↻'; b.title='立即更新快取';
  b.onclick=async()=>{ try{ const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k)));
    if(navigator.serviceWorker?.controller) navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'});
    location.reload(true); }catch(e){ console.error(e); } };
  document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(b));
})();

// ---- 書籤 FAB（穩定） ----
let bookmarkY=null;
on($('bookmarkBtn'),'click',(e)=>{ e.preventDefault();
  if(bookmarkY==null){ bookmarkY=window.scrollY; toast('已設書籤；再點一次回到書籤'); }
  else{ window.scrollTo({top:bookmarkY,behavior:'smooth'}); bookmarkY=null; }
});
function toast(m){ const t=document.createElement('div'); t.textContent=m; Object.assign(t.style,{position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',background:'rgba(0,0,0,.7)',color:'#fff',padding:'6px 12px',borderRadius:'8px',zIndex:9999});
  document.body.appendChild(t); setTimeout(()=>t.remove(),1500); }

// ---- 資料層 ----
async function fetchJSON(u){ const r=await fetch(u,{cache:'no-store'}); if(!r.ok) throw new Error(r.status+' '+r.statusText); return await r.json(); }
function parseTags(s){ return s?String(s).trim().split(/\s+/).filter(Boolean):[] }
function uniq(a){ return [...new Set(a)] }
let cacheList=[], lastQuery={q:'', tag:'', cat:''}, tagCollapsed=true; const TAG_LIMIT=10;

// ---- UI 補助 ----
function escapeHTML(s){ const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; }
function renderListUI(items){
  // 分類
  const cats=uniq(items.map(x=>String(x.category||'')).filter(Boolean)).sort();
  const catSel=$('categoryFilter'); if(catSel){ catSel.innerHTML='<option value=\"\">全部分類</option>'+cats.map(c=>`<option value="${c}">${c}</option>`).join(''); catSel.value=lastQuery.cat||''; }
  // 標籤
  const freq=new Map(); items.forEach(it=>parseTags(it.tags).forEach(t=>freq.set(t,(freq.get(t)||0)+1)));
  const top=Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
  const show=tagCollapsed?top.slice(0,TAG_LIMIT):top;
  const chips=$('tagChips'); if(chips){
    chips.innerHTML=show.map(t=>`<button class="chip${t===lastQuery.tag?' chip--active':''}" data-tag="${t}">#${t}</button>`).join('');
    chips.querySelectorAll('.chip').forEach(btn=>btn.addEventListener('click',()=>{ const t=btn.dataset.tag; lastQuery.tag=(lastQuery.tag===t)?'':t; renderListUI(items); updateList(); }));
  }
  const more=$('moreTagsBtn'); if(more){ more.hidden=top.length<=TAG_LIMIT; more.textContent=tagCollapsed?'更多…':'收合'; more.onclick=()=>{ tagCollapsed=!tagCollapsed; renderListUI(items); renderList(items); }; }
}
function applyFilters(items){
  const q=(lastQuery.q||'').toLowerCase(), tag=lastQuery.tag, cat=lastQuery.cat;
  return items.filter(it=>{
    if(cat && String(it.category||'')!==cat) return false;
    if(tag && !parseTags(it.tags).includes(tag)) return false;
    if(q){ const hay=[it.title,it.body,it.tags].join(' ').toLowerCase(); if(!hay.includes(q)) return false; }
    return true;
  });
}

// ---- 列表 ----
async function loadList(){
  $('listError').hidden=true;
  const j=await fetchJSON(`${BASE}?type=listNotebook`);
  if(!j.ok) throw new Error(JSON.stringify(j.error||{}));
  let items=j.data||[]; items.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  cacheList=items; renderListUI(items); return items;
}
function renderList(items){
  const f=applyFilters(items);
  $('noteList').innerHTML=f.map(it=>{
    const tags=parseTags(it.tags).slice(0,4).map(t=>'#'+t).join(' ');
    const preview=String(it.body||'').replace(/\n+/g,' ').slice(0,140);
    return `<li class="card">
      <a href="#/note/${it.id}"><h3>${escapeHTML(it.title||'(未命名)')}</h3></a>
      <div class="meta"><span>${escapeHTML(it.date||'')}</span><span>${escapeHTML(it.category||'')}</span><span>${escapeHTML(tags)}</span></div>
      <div class="preview">${escapeHTML(preview)}</div>
    </li>`;
  }).join('');
  $('listEmpty').hidden=f.length!==0;
}
async function updateList(){
  try{ const items=cacheList.length?cacheList:await loadList(); renderList(items); }
  catch(e){ console.error(e); $('listError').hidden=false; }
}

// ---- 內文 ----
function normalizeImageURL(url){
  try{
    const u=new URL(url);
    if(u.hostname.includes('drive.google.com')){
      const m=url.match(/(?:open\?id=|file\/d\/)([A-Za-z0-9\-_]+)/);
      if(m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    }
    if(u.hostname==='i.imgur.com'){
      const hasExt=/\.(png|jpg|jpeg|gif|webp)$/i.test(u.pathname);
      if(!hasExt) return `https://i.imgur.com${u.pathname}.jpg`;
    }
    return url;
  }catch(_){ return url; }
}
async function showNote(id){
  $('detailError').hidden=true; bookmarkY=null;
  try{
    const j=await fetchJSON(`${BASE}?type=getById&id=${encodeURIComponent(id)}`);
    if(!j.ok||!j.data) throw new Error('not found');
    const it=j.data;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('view--active'));
    $('detailView').classList.add('view--active');
    $('noteTitle').textContent=it.title||'(未命名)';
    $('noteDate').textContent=it.date||''; $('noteCat').textContent=it.category||'';
    $('noteTags').textContent=parseTags(it.tags).map(t=>'#'+t).join(' ');

    const raw=String(it.body||"");
    const html=marked.parse(raw,{mangle:false,headerIds:false});
    const clean=DOMPurify.sanitize(html,{ADD_ATTR:['target','referrerpolicy','loading','decoding'], ALLOWED_URI_REGEXP:/^(https?:|data:image\/)/i});
    $('noteBody').innerHTML=clean;
    $('noteBody').querySelectorAll('a[href]').forEach(a=>a.setAttribute('target','_blank'));
    $('noteBody').querySelectorAll('img').forEach(img=>{
      img.src=normalizeImageURL(img.src);
      img.setAttribute('loading','lazy'); img.setAttribute('decoding','async'); img.setAttribute('referrerpolicy','no-referrer');
      img.addEventListener('dblclick',()=>openLightbox(img.src));
      img.addEventListener('error',()=>{ const a=document.createElement('a'); a.href=img.src; a.textContent='[圖片開啟]'; a.target='_blank'; img.replaceWith(a); });
    });

    if(!cacheList.length) await loadList();
    const idx=cacheList.findIndex(x=>x.id===it.id); const p=idx>0?cacheList[idx-1]:null; const n=(idx>=0&&idx<cacheList.length-1)?cacheList[idx+1]:null;
    if(p){ $('prevLink').hidden=false; $('prevLink').href=`#/note/${p.id}`; } else $('prevLink').hidden=true;
    if(n){ $('nextLink').hidden=false; $('nextLink').href=`#/note/${n.id}`; } else $('nextLink').hidden=true;
  }catch(e){ console.error(e); $('detailError').hidden=false; }
}
function openLightbox(src){ const box=$('lightbox'), img=$('lightboxImg'); img.src=src; box.classList.add('open'); document.body.classList.add('modal-open'); }
on($('lightbox'),'click',()=>{ $('lightbox').classList.remove('open'); document.body.classList.remove('modal-open'); });

// ---- Router & 綁定 ----
function route(){ const h=location.hash||'#/'; const m=h.match(/^#\/note\/(.+)$/);
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('view--active'));
  if(m){ $('detailView').classList.add('view--active'); showNote(decodeURIComponent(m[1])); }
  else{ $('listView').classList.add('view--active'); updateList(); }
}
window.addEventListener('hashchange',route);
on($('retryList'),'click',e=>{ e.preventDefault(); updateList(); });
on($('detailRetry'),'click',e=>{ e.preventDefault(); route(); });
on($('searchInput'),'input',()=>{ lastQuery.q=$('searchInput').value.trim(); updateList(); });
on($('categoryFilter'),'change',()=>{ lastQuery.cat=$('categoryFilter').value; updateList(); });

// 初始
route();

/* ===== FULLFIX5_BOOKMARK: 書籤超穩定版（跨頁/重整可回復） ===== */
(function(){
  const KEY = 'nb_bookmark_snap'; // {hash, y, t}
  const SEL = '#bookmarkBtn, [data-bookmark], .fab';

  // 工具：現在位置（hash）& 取得/設定捲動量
  const nowHash = () => location.hash || '#/';
  const getY = () => (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);
  function scrollToY(y){
    try {
      window.scrollTo({ top: y, behavior: 'smooth' });
      // 某些 iOS/Safari 會忽略 smooth；保險補一次
      setTimeout(()=>window.scrollTo(0, y), 350);
    } catch(_){
      window.scrollTo(0, y);
    }
  }

  // 存/取/清 書籤
  function saveSnap(){
    const snap = { hash: nowHash(), y: getY(), t: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(snap));
    toast('已設書籤；再點一次回去');
  }
  function getSnap(){
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(_){ return null; }
  }
  function clearSnap(){ localStorage.removeItem(KEY); }

  // 回到書籤（同頁 or 跨頁）
  function goToSnap(){
    const snap = getSnap();
    if(!snap){ toast('沒有書籤'); return; }
    const doScroll = () => { scrollToY(Math.max(0, snap.y|0)); clearSnap(); };
    if (snap.hash === nowHash()) {
      // 同頁直接捲
      doScroll();
    } else {
      // 跨頁：先導到當時 hash，再等內容載入完成後捲
      const once = () => { setTimeout(doScroll, 180); window.removeEventListener('hashchange', once); };
      window.addEventListener('hashchange', once);
      location.hash = snap.hash;
    }
  }

  // 綁定 FAB（防 <a> 預設行為＆DOM 重建）
  function bindBtn(){
    const btn = document.querySelector(SEL);
    if(!btn) return;
    if (btn.__nb_bookmark_bound) return; // 防重綁
    btn.__nb_bookmark_bound = true;
    btn.addEventListener('click', (e)=>{
      e.preventDefault && e.preventDefault();
      e.stopPropagation && e.stopPropagation();
      const snap = getSnap();
      if (snap) goToSnap(); else saveSnap();
    }, { passive:false });
  }
  // 初次綁定
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindBtn);
  } else { bindBtn(); }
  // DOM 改動時自動重綁（例如切換列表/內文）
  new MutationObserver(()=>bindBtn()).observe(document.documentElement, { childList:true, subtree:true });

  // 載入後若上一場留下書籤，而且 hash 相同，自動顯示提示（避免忘記）
  setTimeout(()=>{
    const snap = getSnap();
    if (snap && snap.hash === nowHash()) {
      toast('已有書籤；再點一次📌回去');
    }
  }, 400);

  // 小吐司
  function toast(msg){
    const t=document.createElement('div');
    t.textContent=msg;
    Object.assign(t.style,{
      position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',
      background:'rgba(0,0,0,.75)',color:'#fff',padding:'8px 12px',
      borderRadius:'8px',zIndex:9999,fontSize:'14px'
    });
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),1500);
  }
})();