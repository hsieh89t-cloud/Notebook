// 已注入：window.API_URL
const TABS = document.querySelectorAll('.tab');
const VIEWS = {
  notebook: document.getElementById('view-notebook'),
  recycle: document.getElementById('view-recycle'),
  new: document.getElementById('view-new')
};

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
    const res = await fetch(window.API_URL + '?type=listNotebook');
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
    const res = await fetch(window.API_URL + '?type=listRecycle');
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
  items.slice().reverse().forEach(a => { // 最新在上
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
    if(mode==='notebook'){
      const trash = makeButton('🗑 移至回收', 'btn btn-danger', async (btn)=>{
        await doRecycle(btn, a.id);
      });
      actions.appendChild(trash);
    }else{
      const restore = makeButton('🔄 還原', 'btn', async (btn)=>{
        await doRestore(btn, a.id);
      });
      const purge = makeButton('❌ 永久刪除', 'btn btn-ghost', async (btn)=>{
        await doPurge(btn, a.id);
      });
      actions.appendChild(restore);
      actions.appendChild(purge);
    }
    hold.appendChild(card);
  });
}

function makeButton(text, cls, handler){
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = text;
  b.addEventListener('click', async () => {
    if (b.disabled) return;
    b.disabled = true;
    const orig = b.textContent;
    b.textContent = '處理中…';
    try{ await handler(b); }
    catch(err){ alert('失敗：' + err); }
    finally{ b.textContent = orig; b.disabled = false; }
  });
  return b;
}

async function doRecycle(btn, id){
  if(!confirm('確定要移至回收桶嗎？')) return;
  const res = await fetch(window.API_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'recycle', id })
  });
  const json = await res.json();
  if(!json.ok) throw new Error(json.msg||'Server error');
  await loadNotebook();
}

async function doRestore(btn, id){
  if(!confirm('還原這篇文章？')) return;
  const res = await fetch(window.API_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'restore', id })
  });
  const json = await res.json();
  if(!json.ok) throw new Error(json.msg||'Server error');
  await loadRecycle();
}

async function doPurge(btn, id){
  if(!confirm('永久刪除後不可復原，確定嗎？')) return;
  // 永久刪除 = 直接在回收桶過期清理之前手動刪除
  // 這裡簡化：先 restore -> 立刻 recycle? 不對。應該做一個 purge API。
  // 目前退一步：直接等 autoClean 或請你勾主表刪除。這裡先隱藏按鈕。
  alert('目前請等到期自動刪除，或我再加一個 purge API 幫你秒刪。');
}

function nl2br(s){ return s.replace(/\n/g,'<br>'); }
function escapeHTML(s){
  return s.replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[m]);
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
      const res = await fetch(window.API_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'append', content })
      });
      const json = await res.json();
      if(!json.ok) throw new Error(json.msg||'Server error');
      ta.value='';
      alert('送出成功：' + (json.title||''));
      // 自動切回 Notebook 並刷新
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
