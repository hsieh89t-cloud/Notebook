// window.API_URL 已注入於 index.html
const TABS = document.querySelectorAll('.tab');
const VIEWS = {
  notebook: document.getElementById('view-notebook'),
  recycle: document.getElementById('view-recycle'),
  new: document.getElementById('view-new')
};

// Modal elements
const modal = document.getElementById('readerModal');
const mTitle = document.getElementById('mTitle');
const mMeta  = document.getElementById('mMeta');
const mContent = document.getElementById('mContent');
const mActions = document.getElementById('mActions');
modal.addEventListener('click', e => { if (e.target.dataset.close !== undefined) hideModal(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') hideModal(); });

TABS.forEach(btn => {
  btn.addEventListener('click', () => {
    TABS.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(VIEWS).forEach(v=>v.classList.remove('active'));
    const tab = btn.dataset.tab;
    VIEWS[tab].classList.add('active');
    if (tab === 'notebook') loadNotebook();
    if (tab === 'recycle') loadRecycle();
  });
});

async function loadNotebook(){
  const hold = document.getElementById('notebookList');
  hold.innerHTML = '載入中…';
  try{
    const res = await fetch(window.API_URL + '?type=listNotebook', {mode:'cors', cache:'no-store'});
    const json = await res.json();
    if(!json.ok) throw new Error(json.msg||'Server error');
    renderList(hold, json.articles, { mode:'notebook' });
  }catch(err){
    hold.innerHTML = `<div class="empty">載入失敗：${err}</div>`;
  }
}

async function loadRecycle(){
  const hold = document.getElementById('recycleList');
  hold.innerHTML = '載入中…';
  try{
    const res = await fetch(window.API_URL + '?type=listRecycle', {mode:'cors', cache:'no-store'});
    const json = await res.json();
    if(!json.ok) throw new Error(json.msg||'Server error');
    renderList(hold, json.articles, { mode:'recycle' });
  }catch(err){
    hold.innerHTML = `<div class="empty">載入失敗：${err}</div>`;
  }
}

function renderList(hold, items, {mode}){
  if(!items.length){
    hold.innerHTML = `<div class="empty">${mode==='notebook'?'尚無文章':'回收桶是空的'}</div>`;
    return;
  }
  hold.innerHTML = '';
  items.slice().reverse().forEach(a => {
    const card = document.createElement('div');
    card.className = 'card';
    const metaRight = (mode==='recycle' && a.expireAt) ? `｜到期：${a.expireAt}` : '';
    card.innerHTML = `
      <h3>${escapeHTML(a.title || '（無標題）')}</h3>
      <div class="meta">${escapeHTML(a.date||'')} ｜ ${escapeHTML(a.category||'未分類')} ${metaRight}</div>
      <div class="content">${nl2br(escapeHTML(a.content||''))}</div>
      <div class="actions"></div>
    `;
    const actions = card.querySelector('.actions');
    const openBtn = makeButton('閱讀', 'btn', () => openReader(a, mode));
    actions.appendChild(openBtn);

    if(mode==='notebook'){
      const trash = makeButton('🗑 回收', 'btn btn-danger', async ()=>{
        await callAPI({ action:'recycle', id:a.id });
        await loadNotebook();
      });
      actions.appendChild(trash);
    }else{
      const restore = makeButton('🔄 還原', 'btn', async ()=>{
        await callAPI({ action:'restore', id:a.id });
        await loadRecycle();
      });
      const purge = makeButton('❌ 永久刪除', 'btn btn-ghost', async ()=>{
        if(!confirm('永久刪除後不可復原，確定嗎？')) return;
        await callAPI({ action:'purge', id:a.id });
        await loadRecycle();
      });
      actions.appendChild(restore);
      actions.appendChild(purge);
    }
    hold.appendChild(card);
  });
}

function openReader(a, mode){
  mTitle.textContent = a.title || '（無標題）';
  const extra = (mode==='recycle' && a.expireAt) ? `｜到期：${a.expireAt}` : '';
  mMeta.textContent = `${a.date||''} ｜ ${a.category||'未分類'} ${extra}`;
  mContent.innerHTML = nl2br(escapeHTML(a.content||''));
  // actions
  mActions.innerHTML = '';
  if(mode==='notebook'){
    mActions.appendChild(makeButton('🗑 移至回收', 'btn btn-danger', async ()=>{
      await callAPI({ action:'recycle', id:a.id });
      hideModal();
      await loadNotebook();
    }));
  }else{
    mActions.appendChild(makeButton('🔄 還原', 'btn', async ()=>{
      await callAPI({ action:'restore', id:a.id });
      hideModal();
      await loadRecycle();
    }));
    mActions.appendChild(makeButton('❌ 永久刪除', 'btn btn-ghost', async ()=>{
      if(!confirm('永久刪除後不可復原，確定嗎？')) return;
      await callAPI({ action:'purge', id:a.id });
      hideModal();
      await loadRecycle();
    }));
  }
  showModal();
}

function showModal(){ modal.hidden = false; }
function hideModal(){ modal.hidden = true; }

function makeButton(text, cls, handler){
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = text;
  b.addEventListener('click', async () => {
    if (b.disabled) return;
    const prev = b.textContent;
    b.disabled = true; b.textContent = '處理中…';
    try{ await handler(); }
    catch(err){ alert('失敗：' + err); }
    finally{ b.disabled = false; b.textContent = prev; }
  });
  return b;
}

function nl2br(s){ return s.replace(/\n/g,'<br>'); }
function escapeHTML(s){
  return s.replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[m]);
}

async function callAPI(body){
  const res = await fetch(window.API_URL, {
    method:'POST',
    mode:'cors',
    cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if(!json.ok) throw new Error(json.msg||'Server error');
  return json;
}

// 送文章（防重複送出）
const submitBtn = document.getElementById('submitBtn');
if(submitBtn){
  submitBtn.addEventListener('click', async ()=>{
    const ta = document.getElementById('inputContent');
    const content = (ta.value||'').trim();
    if(!content) return alert('請輸入文章');
    submitBtn.disabled = true;
    submitBtn.textContent = '送出中…';
    try{
      await callAPI({ action:'append', content });
      ta.value='';
      alert('送出成功');
      document.querySelector('.tab[data-tab="notebook"]').click();
    }catch(err){
      alert('送出失敗：' + err);
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = '送出';
    }
  });
}

// 預設載入 Notebook
loadNotebook();
