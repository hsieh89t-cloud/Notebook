// v1.3.1-hotfix4 (drop-in): ↻ 保證出現 + 書籤恢復 + 圖片穩定 + 不動你 HTML
// 只要把這支 app.js 覆蓋即可。其餘檔案不用改。

let BASE = (window.__CONFIG__ && window.__CONFIG__.BASE_URL) || 'https://script.google.com/macros/s/AKfycbx3oTDF49EmwGp5ZgGs9WIO64m7UzVzj5IDcBmm222aR7eTQTG8DXUsYVGVnzH2ga4abQ/exec';

// ---- 小工具 ----
const $=(id)=>document.getElementById(id);
const on=(el,ev,fn)=>{ if(el) el.addEventListener(ev,fn,{passive:true}); };
const els = {
  listView:$('listView'), detailView:$('detailView'), noteList:$('noteList'),
  listEmpty:$('listEmpty'), listError:$('listError'), retryList:$('retryList'),
  search:$('searchInput'), catSel:$('categoryFilter'), tagChips:$('tagChips'), moreTags:$('moreTagsBtn'),
  noteTitle:$('noteTitle'), noteDate:$('noteDate'), noteCat:$('noteCat'), noteTags:$('noteTags'), noteBody:$('noteBody'),
  prev:$('prevLink'), next:$('nextLink'), detailError:$('detailError'), detailRetry:$('detailRetry'),
  themeToggle:$('themeToggle'), fontToggle:$('fontToggle'), bookmarkBtn:$('bookmarkBtn')
};

// ---- 1) 確保「↻ 立即更新」存在（3 層保護） ----
function ensureRefreshBtn(){
  let btn = document.getElementById('refreshBtn');
  if (btn) return btn;
  const mk = () => {
    const b=document.createElement('button');
    b.id='refreshBtn'; b.textContent='↻'; b.title='立即更新快取';
    b.style.padding='6px 10px'; b.style.background='var(--chip)'; b.style.color='var(--fg)';
    b.style.border='0'; b.style.borderRadius='8px'; b.style.flex='0 0 auto';
    return b;
  };
  const bar=document.querySelector('.top-actions');
  if(bar){ btn=mk(); bar.appendChild(btn); return btn; }
  const topbar=document.querySelector('.topbar');
  if(topbar){ btn=mk(); topbar.appendChild(btn); return btn; }
  btn=mk();
  btn.style.position='fixed'; btn.style.right='14px'; btn.style.bottom='86px'; btn.style.zIndex='31';
  document.body.appendChild(btn);
  return btn;
}
const refreshBtn = ensureRefreshBtn();
on(refreshBtn,'click', async ()=>{
  try{
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    if(navigator.serviceWorker?.controller){
      navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'});
    }
    location.reload(true);
  }catch(e){ console.error(e); }
});

// ---- 2) 主題切換 / 字體大小（小→中→大） ----
(function initTheme(){
  const saved=localStorage.getItem('theme')||'dark';
  if(saved==='light') document.documentElement.classList.add('light');
  on(els.themeToggle,'click',()=>{
    const isLight=document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', isLight?'light':'dark');
  });
})();
(function initFont(){
  const order=['small','medium','large'];
  const size ={small:'14px',medium:'16px',large:'19px'};
  const label={small:'小',  medium:'中',   large:'大'};
  let cur=localStorage.getItem('fs')||'medium';
  apply();
  on(els.fontToggle,'click',()=>{ cur=order[(order.indexOf(cur)+1)%order.length]; apply(); localStorage.setItem('fs',cur); });
  function apply(){
    document.documentElement.style.setProperty('--fs', size[cur]||'16px');
    if(els.fontToggle) els.fontToggle.textContent = label[cur]||'中';
  }
})();

// ---- 3) 書籤 FAB（恢復原本邏輯） ----
let bookmarkY = null;
on(els.bookmarkBtn,'click',()=>{
  if(bookmarkY==null){
    bookmarkY = window.scrollY;
    toast('已設書籤；再點一次回到書籤');
  }else{
    window.scrollTo({top:bookmarkY, behavior:'smooth'});
    bookmarkY = null;
  }
});
function toast(msg){
  const t=document.createElement('div');
  t.textContent=msg;
  Object.assign(t.style,{position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',background:'rgba(0,0,0,.7)',color:'#fff',padding:'8px 12px',borderRadius:'8px',zIndex:9999});
  document.body.appendChild(t); setTimeout(()=>t.remove(),1500);
}

// ---- 4) 資料工具 / 篩選 ----
async function fetchJSON(url){ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(r.status+' '+r.statusText); return await r.json(); }
function parseTags(s){ return s?String(s).trim().split(/\s+/).filter(Boolean):[]; }
function uniq(a){ return [...new Set(a)]; }
let cacheList=[], lastQuery={q:'',tag:'',cat:''}, tagCollapsed=true; const TAG_LIMIT=10;

// ---- 5) 清單 UI（分類 + 標籤 Top10） ----
function renderListUI(items){
  const cats=uniq(items.map(x=>String(x.category||'')).filter(Boolean)).sort();
  if(els.catSel){
    els.catSel.innerHTML='<option value=\"\">全部分類</option>'+cats.map(c=>`<option value="${c}">${c}</option>`).join('');
    els.catSel.value=lastQuery.cat||'';
  }
  const freq=new Map();
  items.forEach(it=>parseTags(it.tags).forEach(t=>freq.set(t,(freq.get(t)||0)+1)));
  const top=Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
  const show=tagCollapsed?top.slice(0,TAG_LIMIT):top;
  if(els.tagChips){
    els.tagChips.innerHTML=show.map(t=>{
      const active=t===lastQuery.tag?' chip--active':'';
      return `<button class="chip${active}" data-tag="${t}">#${t}</button>`;
    }).join('');
    els.tagChips.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{
      const t=b.dataset.tag; lastQuery.tag=(lastQuery.tag===t)?'':t; renderListUI(items); updateList();
    }));
  }
  if(els.moreTags){
    els.moreTags.hidden=top.length<=TAG_LIMIT;
    els.moreTags.textContent=tagCollapsed?'更多…':'收合';
    els.moreTags.onclick=()=>{ tagCollapsed=!tagCollapsed; renderListUI(items); renderList(items); };
  }
}
function applyFilters(items){
  const q=(lastQuery.q||'').toLowerCase(), tag=lastQuery.tag, cat=lastQuery.cat;
  return items.filter(it=>{
    if(cat && String(it.category||'')!==cat) return false;
    if(tag && !parseTags(it.tags).includes(tag)) return false;
    if(q){
      const hay=[it.title,it.body,it.tags].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}
function escapeHTML(s){ const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; }

// ---- 6) 讀清單 / 畫清單 ----
async function loadList(){
  if(els.listError) els.listError.hidden=true;
  const j=await fetchJSON(`${BASE}?type=listNotebook`);
  if(!j.ok) throw new Error(JSON.stringify(j.error||{}));
  let items=j.data||[]; items.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  cacheList=items; renderListUI(items); return items;
}
function renderList(items){
  const f=applyFilters(items);
  if(els.noteList){
    els.noteList.innerHTML=f.map(it=>{
      const tags=parseTags(it.tags).slice(0,4).map(t=>'#'+t).join(' ');
      const prev=String(it.body||'').replace(/\n+/g,' ').slice(0,100);
      return `<li class="card">
        <a href="#/note/${it.id}"><h3>${escapeHTML(it.title||'(未命名)')}</h3></a>
        <div class="meta"><span>${escapeHTML(it.date||'')}</span><span>${escapeHTML(it.category||'')}</span><span>${escapeHTML(tags)}</span></div>
        <div class="preview">${escapeHTML(prev)}</div>
      </li>`;
    }).join('');
  }
  if(els.listEmpty) els.listEmpty.hidden=f.length!==0;
}
async function updateList(){
  try{ const items=cacheList.length?cacheList:await loadList(); renderList(items); }
  catch(e){ console.error(e); if(els.listError) els.listError.hidden=false; }
}

// ---- 7) 文章頁（圖片穩定處理 + 內建 lightbox） ----
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
function openLightbox(src){
  const box=$('lightbox'), img=$('lightboxImg');
  if(!box||!img) return;
  img.src=src; box.classList.add('open'); document.body.classList.add('modal-open');
}
on($('lightbox'),'click',()=>{ const box=$('lightbox'); if(box) box.classList.remove('open'); document.body.classList.remove('modal-open'); });

async function showNote(id){
  if(els.detailError) els.detailError.hidden=true;
  bookmarkY=null;
  try{
    const j=await fetchJSON(`${BASE}?type=getById&id=${encodeURIComponent(id)}`);
    if(!j.ok||!j.data) throw new Error('not found');
    const it=j.data;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('view--active'));
    if(els.detailView) els.detailView.classList.add('view--active');
    if(els.noteTitle) els.noteTitle.textContent=it.title||'(未命名)';
    if(els.noteDate) els.noteDate.textContent=it.date||'';
    if(els.noteCat) els.noteCat.textContent=it.category||'';
    if(els.noteTags) els.noteTags.textContent=parseTags(it.tags).map(t=>'#'+t).join(' ');

    const raw=String(it.body||"");
    const html=marked.parse(raw,{mangle:false,headerIds:false});
    const clean=DOMPurify.sanitize(html,{ADD_ATTR:['target','referrerpolicy','loading','decoding'],ALLOWED_URI_REGEXP:/^(https?:|data:image\/)/i});
    if(els.noteBody) els.noteBody.innerHTML=clean;

    if(els.noteBody){
      els.noteBody.querySelectorAll('a[href]').forEach(a=>a.setAttribute('target','_blank'));
      els.noteBody.querySelectorAll('img').forEach(img=>{
        img.src=normalizeImageURL(img.src);
        img.setAttribute('loading','lazy'); img.setAttribute('decoding','async'); img.setAttribute('referrerpolicy','no-referrer');
        img.addEventListener('dblclick',()=>openLightbox(img.src));
        img.addEventListener('error',()=>{ const a=document.createElement('a'); a.href=img.src; a.target='_blank'; a.textContent='[圖片開啟]'; img.replaceWith(a); });
      });
    }

    if(!cacheList.length) await loadList();
    const idx=cacheList.findIndex(x=>x.id===it.id);
    const p=idx>0?cacheList[idx-1]:null; const n=(idx>=0 && idx<cacheList.length-1)?cacheList[idx+1]:null;
    if(els.prev){ if(p){ els.prev.hidden=false; els.prev.href=`#/note/${p.id}`; } else els.prev.hidden=true; }
    if(els.next){ if(n){ els.next.hidden=false; els.next.href=`#/note/${n.id}`; } else els.next.hidden=true; }

  }catch(e){ console.error(e); if(els.detailError) els.detailError.hidden=false; }
}

// ---- 8) Router + 事件 ----
function route(){
  const h=location.hash||'#/'; const m=h.match(/^#\/note\/(.+)$/);
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('view--active'));
  if(m){ if(els.detailView) els.detailView.classList.add('view--active'); showNote(decodeURIComponent(m[1])); }
  else { if(els.listView) els.listView.classList.add('view--active'); updateList(); }
}
window.addEventListener('hashchange',route);
on(els.retryList,'click',e=>{e.preventDefault(); updateList();});
on(els.detailRetry,'click',e=>{e.preventDefault(); route();
// 顯示目前 API 位址（3 秒消失，方便檢查）
(function(){
  const t=document.createElement('div');
  t.textContent='API連線：' + BASE.replace(/^https?:\/\//,'').slice(0,38) + '…';
  Object.assign(t.style,{position:'fixed',left:'50%',top:'10px',transform:'translateX(-50%)',background:'rgba(0,0,0,.6)',color:'#fff',padding:'6px 10px',borderRadius:'8px',zIndex:9999,fontSize:'12px'});
  document.body.appendChild(t); setTimeout(()=>t.remove(),3000);
})();
});
on(els.search,'input',()=>{ lastQuery.q=els.search.value.trim(); updateList(); });
on(els.catSel,'change',()=>{ lastQuery.cat=els.catSel.value; updateList(); });

route();
// 顯示目前 API 位址（3 秒消失，方便檢查）
(function(){
  const t=document.createElement('div');
  t.textContent='API連線：' + BASE.replace(/^https?:\/\//,'').slice(0,38) + '…';
  Object.assign(t.style,{position:'fixed',left:'50%',top:'10px',transform:'translateX(-50%)',background:'rgba(0,0,0,.6)',color:'#fff',padding:'6px 10px',borderRadius:'8px',zIndex:9999,fontSize:'12px'});
  document.body.appendChild(t); setTimeout(()=>t.remove(),3000);
})();

