// === 基本 ===
const TABS = document.querySelectorAll('.tab');
const VIEWS = {
  notebook: document.getElementById('view-notebook'),
  recycle: document.getElementById('view-recycle'),
  new: document.getElementById('view-new')
};
const q = document.getElementById('q');
const btnSync = document.getElementById('btnSync');
const btnSyncR = document.getElementById('btnSyncR');

// Modal
const modal = document.getElementById('readerModal');
const mTitle = document.getElementById('mTitle');
const mMeta  = document.getElementById('mMeta');
const mContent = document.getElementById('mContent');
const mImages = document.getElementById('mImages');
const mActions = document.getElementById('mActions');
modal.addEventListener('click', e => { if (e.target.dataset.close !== undefined) hideModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideModal(); });

let NB_CACHE = [], RC_CACHE = [];

TABS.forEach(btn => {
  btn.addEventListener('click', () => {
    TABS.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(VIEWS).forEach(v=>v.classList.remove('active'));
    const tab = btn.dataset.tab;
    VIEWS[tab].classList.add('active');
    if (tab === 'notebook') loadNotebook(true);
    if (tab === 'recycle') loadRecycle(true);
  });
});

// 搜尋
q?.addEventListener('input', () => {
  const kw = (q.value||'').trim();
  renderList(document.getElementById('notebookList'), NB_CACHE, { mode:'notebook', filter:kw });
});

btnSync?.addEventListener('click', () => loadNotebook(true));
btnSyncR?.addEventListener('click', () => loadRecycle(true));

// === 讀取 ===
async function loadNotebook(force=false){
  const hold = document.getElementById('notebookList');
  if (!force && NB_CACHE.length) { renderList(hold, NB_CACHE, {mode:'notebook'}); return; }
  hold.innerHTML = '載入中…';
  try{
    const res = await fetch(window.API_URL + '?type=listNotebook', {mode:'cors', cache:'no-store'});
    const json = await res.json();
    if(!json.ok) throw new Error(json.msg||'Server error');
    NB_CACHE = json.articles||[];
    renderList(hold, NB_CACHE, { mode:'notebook' });
  }catch(err){ hold.innerHTML = `<div class="empty">載入失敗：${err}</div>`; }
}
async function loadRecycle(force=false){
  const hold = document.getElementById('recycleList');
  hold.innerHTML = '載入中…';
  try{
    const res = await fetch(window.API_URL + '?type=listRecycle', {mode:'cors', cache:'no-store'});
    const json = await res.json();
    if(!json.ok) throw new Error(json.msg||'Server error');
    RC_CACHE = json.articles||[];
    renderList(hold, RC_CACHE, { mode:'recycle' });
  }catch(err){ hold.innerHTML = `<div class="empty">載入失敗：${err}</div>`; }
}

function renderList(hold, items, {mode, filter=''}={}){
  let data = items.slice().reverse();
  if (filter && filter.length>=2){
    const kw = filter.toLowerCase();
    data = data.filter(a => (a.title||'').toLowerCase().includes(kw) || (a.content||'').toLowerCase().includes(kw));
  }
  if(!data.length){ hold.innerHTML = `<div class="empty">${mode==='notebook'?'尚無文章':'回收桶是空的'}</div>`; return; }
  hold.innerHTML = '';
  data.forEach(a => {
    const card = document.createElement('div');
    card.className = 'card';
    const metaRight = (mode==='recycle' && a.expireAt) ? `｜到期：${a.expireAt}` : '';
    card.innerHTML = `
      <h3 class="title">${escapeHTML(a.title||'（無標題）')}</h3>
      <div class="meta">${escapeHTML(a.date||'')} ｜ ${escapeHTML(a.category||'未分類')} ${metaRight}</div>
      <div class="content">${nl2br(escapeHTML(a.content||''))}</div>
      <div class="actions"></div>
    `;
    // 點標題即可閱讀
    card.querySelector('.title').addEventListener('click', ()=>openReader(a, mode));
    const actions = card.querySelector('.actions');
    const openBtn = makeButton('閱讀', 'btn', () => openReader(a, mode));
    actions.appendChild(openBtn);

    if(mode==='notebook'){
      actions.appendChild(makeButton('🗑 回收', 'btn btn-danger', ()=>opRecycle(a.id)));
      actions.appendChild(makeButton('✏️ 編輯', 'btn', ()=>openEditor(a)));
    }else{
      actions.appendChild(makeButton('🔄 還原', 'btn', ()=>opRestore(a.id)));
      actions.appendChild(makeButton('❌ 永久刪除', 'btn btn-danger', ()=>opPurge(a.id)));
    }
    hold.appendChild(card);
  });
}

// === 閱讀 ===
function openReader(a, mode){
  mTitle.textContent = a.title || '（無標題）';
  const extra = (mode==='recycle' && a.expireAt) ? `｜到期：${a.expireAt}` : '';
  mMeta.textContent = `${a.date||''} ｜ ${a.category||'未分類'} ${extra}`;
  mContent.innerHTML = nl2br(escapeHTML(a.content||''));
  mActions.innerHTML = '';
  mImages.innerHTML = '';
  // 操作按鈕（閱讀視窗內）
  if(mode==='notebook'){
    mActions.appendChild(makeButton('🗑 移至回收', 'btn btn-danger', ()=>opRecycle(a.id,true)));
    mActions.appendChild(makeButton('✏️ 編輯', 'btn', ()=>openEditor(a,true)));
  }else{
    mActions.appendChild(makeButton('🔄 還原', 'btn', ()=>opRestore(a.id,true)));
    mActions.appendChild(makeButton('❌ 永久刪除', 'btn btn-danger', ()=>opPurge(a.id,true)));
  }
  // 圖片
  loadImagesFor(a.id);
  showModal();
}

// 編輯（Modal 內）
function openEditor(a, inModal=false){
  // 建立編輯UI
  mActions.innerHTML = '';
  mContent.innerHTML = `
    <div class="edit-field"><label>分類</label><input id="eCategory" value="${escapeAttr(a.category||'')}" /></div>
    <div class="edit-field"><label>標題</label><input id="eTitle" value="${escapeAttr(a.title||'')}" /></div>
    <div class="edit-field"><label>內容</label><textarea id="eContent" rows="8">${escapeAttr(a.content||'')}</textarea></div>
    <div class="edit-actions">
      <button id="btnSave" class="btn">保存</button>
      <button id="btnCancel" class="btn">取消</button>
    </div>
  `;
  document.getElementById('btnSave').onclick = async ()=>{
    const category = document.getElementById('eCategory').value;
    const title = document.getElementById('eTitle').value;
    const content = document.getElementById('eContent').value;
    await busy(async()=>{
      await callAPI({ action:'update', id:a.id, category, title, content });
      await loadNotebook(true);
    });
    if(!inModal) showToast('已保存');
    else openReader({ ...a, category, title, content }, 'notebook');
  };
  document.getElementById('btnCancel').onclick = ()=>{
    if(inModal) openReader(a,'notebook'); else hideModal();
  };
  if(!inModal) showModal();
}

async function loadImagesFor(id){
  try{
    const res = await fetch(`${window.API_URL}?type=imageList&id=${encodeURIComponent(id)}`, {mode:'cors', cache:'no-store'});
    const json = await res.json();
    if(!json.ok) return;
    const n = json.count||0;
    for(let i=1;i<=n;i++){
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = `${window.API_URL}?type=image&id=${encodeURIComponent(id)}&n=${i}`;
      img.alt = `image ${i}`;
      img.addEventListener('click', ()=>showImageFull(img.src));
      mImages.appendChild(img);
    }
  }catch(_){ /* ignore */ }
}

// 全螢幕看圖
let imgFull = document.createElement('div');
imgFull.id = 'imgFull'; imgFull.hidden = true;
imgFull.innerHTML = '<div data-close style="position:fixed;inset:0;"></div><img src="" alt="">';
document.body.appendChild(imgFull);
imgFull.addEventListener('click', e=>{ if(e.target.dataset.close!==undefined) hideImageFull(); });
function showImageFull(src){ imgFull.querySelector('img').src = src; imgFull.hidden = false; }
function hideImageFull(){ imgFull.hidden = true; }

function showModal(){ modal.hidden = false; startSwipeClose(); }
function hideModal(){ modal.hidden = true; }

// 右滑關閉（簡易）
function startSwipeClose(){
  let sx = 0, sy=0, dx=0;
  const panel = document.querySelector('.modal-panel');
  function ts(e){ sx=e.touches[0].clientX; sy=e.touches[0].clientY; dx=0; }
  function tm(e){ dx = e.touches[0].clientX - sx; if(Math.abs(e.touches[0].clientY - sy)>30)return; if(dx>0) panel.style.transform = `translate(calc(-50% + ${dx/6}px), -50%)`; }
  function te(){ if(dx>80){ hideModal(); } panel.style.transform='translate(-50%,-50%)'; }
  panel.addEventListener('touchstart', ts, {once:true});
  panel.addEventListener('touchmove', tm, {passive:true});
  panel.addEventListener('touchend', te, {once:true});
}

// === 操作 API ===
async function callAPI(body){
  const headers = {'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'};
  const res = await fetch(window.API_URL, { method:'POST', mode:'cors', cache:'no-store', headers, body: new URLSearchParams(body).toString() });
  const json = await res.json();
  if(!json.ok) throw new Error(json.msg||'Server error'); return json;
}
async function opRecycle(id,close){ await busy(async()=>{ await callAPI({action:'recycle', id}); if(close) hideModal(); await loadNotebook(true); }); }
async function opRestore(id,close){ await busy(async()=>{ await callAPI({action:'restore', id}); if(close) hideModal(); await loadRecycle(true); }); }
async function opPurge(id,close){
  if(!confirm('永久刪除後不可復原，確定嗎？')) return;
  await busy(async()=>{ await callAPI({action:'purge', id}); if(close) hideModal(); await loadRecycle(true); });
}

// 送文章（啟用）
const submitBtn = document.getElementById('submitBtn');
if(submitBtn){
  submitBtn.addEventListener('click', async ()=>{
    const ta = document.getElementById('inputContent');
    const content = (ta.value||'').trim();
    if(!content) return alert('請輸入文章');
    submitBtn.disabled = true; submitBtn.textContent = '送出中…';
    try{ await callAPI({ action:'append', content }); ta.value=''; alert('送出成功'); document.querySelector('.tab[data-tab="notebook"]').click(); await loadNotebook(true); }
    catch(err){ alert('送出失敗：' + err); }
    finally{ submitBtn.disabled=false; submitBtn.textContent='送出'; }
  });
}

// Busy 遮罩（避免重覆點擊）
let BUSY = 0;
async function busy(fn){
  try{ BUSY++; document.body.style.pointerEvents='none'; await fn(); }
  finally{ BUSY=Math.max(0,BUSY-1); if(BUSY===0) document.body.style.pointerEvents='auto'; }
}

// 工具
function nl2br(s){ return s.replace(/\n/g,'<br>'); }
function escapeHTML(s){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(s){ return (s||'').replace(/["&<>]/g, c=>({'"':'&quot;','&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function makeButton(text, cls, handler){
  const b = document.createElement('button'); b.className = cls; b.textContent = text;
  b.addEventListener('click', async ()=>{
    if (b.disabled) return; const prev = b.textContent; b.disabled = true; b.textContent = '處理中…';
    try{ await handler(); } catch(err){ alert('失敗：'+err); } finally{ b.disabled=false; b.textContent = prev; }
  }); 
  return b;
}

// 預設載入
loadNotebook(true);
