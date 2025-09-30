// v1.3.2: image fixes + instant cache refresh
const BASE = window.__CONFIG__.BASE_URL;
function $(id){return document.getElementById(id)}
function on(el,ev,fn){ if(el) el.addEventListener(ev,fn) }

const els={
  listView:$('listView'), detailView:$('detailView'),
  noteList:$('noteList'), listEmpty:$('listEmpty'), listError:$('listError'),
  retryList:$('retryList'), search:$('searchInput'), catSel:$('categoryFilter'),
  tagChips:$('tagChips'), moreTags:$('moreTagsBtn'),
  noteTitle:$('noteTitle'), noteDate:$('noteDate'), noteCat:$('noteCat'),
  noteTags:$('noteTags'), noteBody:$('noteBody'),
  prev:$('prevLink'), next:$('nextLink'), detailError:$('detailError'),
  detailRetry:$('detailRetry'), themeToggle:$('themeToggle'),
  bookmarkBtn:$('bookmarkBtn'), lightbox:$('lightbox'), lightboxImg:$('lightboxImg'),
  fontToggle:$('fontToggle'), refreshBtn:$('refreshBtn')
};

// --- theme
(function(){const s=localStorage.getItem('theme')||'dark'; if(s==='light') document.documentElement.classList.add('light');
on(els.themeToggle,'click',()=>{const isLight=document.documentElement.classList.toggle('light'); localStorage.setItem('theme',isLight?'light':'dark');});})();

// --- font toggle small->medium->large
(function(){const order=['small','medium','large']; const label={small:'小',medium:'中',large:'大'}; const size={small:'14px',medium:'16px',large:'19px'};
 let cur=localStorage.getItem('fs')||'medium'; apply(); on(els.fontToggle,'click',()=>{cur=order[(order.indexOf(cur)+1)%order.length]; apply(); localStorage.setItem('fs',cur);});
 function apply(){document.documentElement.style.setProperty('--fs',size[cur]); if(els.fontToggle) els.fontToggle.textContent=label[cur];}})();

// --- instant cache refresh (clear caches + update SW)
on(els.refreshBtn,'click',async()=>{
  try{
    // 清除 caches 中與本站有關的快取
    const keys = await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    // 更新 SW
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'});
    }
    // 重新載入
    location.reload(true);
  }catch(e){console.error(e);}
});

// --- data helpers
let cacheList=[], lastQuery={q:"",tag:"",cat:""}, tagCollapsed=true; const TAG_LIMIT=10;
async function fetchJSON(u){const r=await fetch(u,{cache:'no-store'}); if(!r.ok) throw new Error(r.status+' '+r.statusText); return await r.json();}
function parseTags(s){return s?String(s).trim().split(/\s+/).filter(Boolean):[]}
function uniq(a){return Array.from(new Set(a))}
function applyFilters(items){const q=(lastQuery.q||'').toLowerCase(),tag=lastQuery.tag,cat=lastQuery.cat;
  return items.filter(it=>{if(cat&&String(it.category||'')!==cat)return false; if(tag&&!parseTags(it.tags).includes(tag))return false;
  if(q){const hay=[it.title,it.body,it.tags].join(' ').toLowerCase(); if(!hay.includes(q))return false;} return true;});}

function renderListUI(items){
  const cats=uniq(items.map(x=>String(x.category||'')).filter(Boolean)).sort();
  els.catSel.innerHTML='<option value=\"\">全部分類</option>'+cats.map(c=>`<option value=\"${c}\">${c}</option>`).join('');
  els.catSel.value=lastQuery.cat||'';
  const freq=new Map(); items.forEach(it=>parseTags(it.tags).forEach(t=>freq.set(t,(freq.get(t)||0)+1)));
  const top=Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
  const show=tagCollapsed?top.slice(0,TAG_LIMIT):top;
  els.tagChips.innerHTML=show.map(t=>{const active=t===lastQuery.tag?' chip--active':'';return `<button class="chip${active}" data-tag="${t}">#${t}</button>`}).join('');
  els.moreTags.hidden=top.length<=TAG_LIMIT; els.moreTags.textContent=tagCollapsed?'更多…':'收合';
  els.moreTags.onclick=()=>{tagCollapsed=!tagCollapsed; renderListUI(items); renderList(items);};
  els.tagChips.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.tag; lastQuery.tag=(lastQuery.tag===t)?'':t; renderListUI(items); updateList();}));
}

// --- list
async function loadList(){els.listError.hidden=true; const j=await fetchJSON(`${BASE}?type=listNotebook`);
  if(!j.ok) throw new Error(JSON.stringify(j.error||{})); let items=j.data||[]; items.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  cacheList=items; renderListUI(items); return items;}
function escapeHTML(s){const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML;}
function renderList(items){const f=applyFilters(items);
  els.noteList.innerHTML=f.map(it=>{const tags=parseTags(it.tags).slice(0,4).map(t=>'#'+t).join(' ');
    const preview=String(it.body||'').replace(/\\n+/g,' ').slice(0,100);
    return `<li class="card"><a href="#/note/${it.id}"><h3>${escapeHTML(it.title||'(未命名)')}</h3></a>
      <div class="meta"><span>${escapeHTML(it.date||'')}</span><span>${escapeHTML(it.category||'')}</span><span>${escapeHTML(tags)}</span></div>
      <div class="preview">${escapeHTML(preview)}</div></li>`}).join('');
  els.listEmpty.hidden=f.length!==0;}

async function updateList(){try{const items=cacheList.length?cacheList:await loadList(); renderList(items);}catch(e){console.error(e); els.listError.hidden=false;}}

// --- bookmark
let bookmarkY=null; on(els.bookmarkBtn,'click',()=>{ if(bookmarkY==null){bookmarkY=window.scrollY; toast('已設書籤；再點一次回到書籤');}
  else{window.scrollTo({top:bookmarkY,behavior:'smooth'}); bookmarkY=null;}});
function toast(m){const t=document.createElement('div'); t.textContent=m; Object.assign(t.style,{position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',background:'rgba(0,0,0,.7)',color:'#fff',padding:'8px 12px',borderRadius:'8px',zIndex:9999});
  document.body.appendChild(t); setTimeout(()=>t.remove(),1500);}

// --- markdown & image helpers
function normalizeImageURL(url){
  try{
    const u=new URL(url);
    // Google Drive -> uc?export=view&id=
    if(u.hostname.includes('drive.google.com')){
      const m = url.match(/(?:open\\?id=|file\\/d\\/)([A-Za-z0-9\\-_]+)/);
      if(m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    }
    // Imgur: 若無副檔名，補 .jpg
    if(u.hostname==='i.imgur.com'){
      const hasExt = /\\.(png|jpg|jpeg|gif|webp)$/i.test(u.pathname);
      if(!hasExt) return `https://i.imgur.com${u.pathname}.jpg`;
    }
    return url;
  }catch(_){ return url; }
}

async function showNote(id){els.detailError.hidden=true; bookmarkY=null;
  try{
    const j=await fetchJSON(`${BASE}?type=getById&id=${encodeURIComponent(id)}`); if(!j.ok||!j.data) throw new Error('not found'); const it=j.data;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('view--active')); els.detailView.classList.add('view--active');
    els.noteTitle.textContent=it.title||'(未命名)'; els.noteDate.textContent=it.date||''; els.noteCat.textContent=it.category||'';
    els.noteTags.textContent=parseTags(it.tags).map(t=>'#'+t).join(' ');

    const rawMD=String(it.body||"").replace(/\((https:\\/\\/drive\\.google\\.com\\/(?:open\\?id=|file\\/d\\/)[^)]+)\\)/g,(m)=>{
      const url=m.slice(1,-1); // already includes parentheses
      return `(${normalizeImageURL(url)})`;
    });
    const rawHTML=marked.parse(rawMD,{mangle:false,headerIds:false});
    const clean=DOMPurify.sanitize(rawHTML,{ADD_ATTR:['target','referrerpolicy','loading','decoding'], ALLOWED_URI_REGEXP:/^(https?:|data:image\\/)/i});
    els.noteBody.innerHTML=clean;
    els.noteBody.querySelectorAll('a[href]').forEach(a=>a.setAttribute('target','_blank'));
    els.noteBody.querySelectorAll('img').forEach(img=>{
      img.src = normalizeImageURL(img.src);
      img.setAttribute('loading','lazy'); img.setAttribute('decoding','async'); img.setAttribute('referrerpolicy','no-referrer');
      img.addEventListener('dblclick',()=>openLightbox(img.src));
      img.addEventListener('error',()=>{
        // 若還是失敗，顯示連結替代
        const link=document.createElement('a'); link.href=img.src; link.textContent='[圖片開啟]'; link.target='_blank';
        img.replaceWith(link);
      });
    });

    if(!cacheList.length) await loadList();
    const idx=cacheList.findIndex(x=>x.id===it.id); const p=idx>0?cacheList[idx-1]:null; const n=idx>=0&&idx<cacheList.length-1?cacheList[idx+1]:null;
    if(p){els.prev.hidden=false; els.prev.href=`#/note/${p.id}`;} else els.prev.hidden=true;
    if(n){els.next.hidden=false; els.next.href=`#/note/${n.id}`;} else els.next.hidden=true;
  }catch(e){console.error(e); els.detailError.hidden=false;}
}

function openLightbox(src){els.lightboxImg.src=src; els.lightbox.classList.add('open'); document.body.classList.add('modal-open');}
on(els.lightbox,'click',()=>{els.lightbox.classList.remove('open'); document.body.classList.remove('modal-open');});

function route(){const h=location.hash||'#/'; const m=h.match(/^#\\/note\\/(.+)$/); document.querySelectorAll('.view').forEach(v=>v.classList.remove('view--active'));
  if(m){els.detailView.classList.add('view--active'); showNote(decodeURIComponent(m[1]));}
  else{els.listView.classList.add('view--active'); updateList();}}
window.addEventListener('hashchange',route);
on(els.retryList,'click',e=>{e.preventDefault(); updateList();});
on(els.detailRetry,'click',e=>{e.preventDefault(); route();});
on(els.search,'input',()=>{lastQuery.q=els.search.value.trim(); updateList();});
on(els.catSel,'change',()=>{lastQuery.cat=els.catSel.value; updateList();});
route();
