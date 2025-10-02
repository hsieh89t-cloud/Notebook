/* v0.1 最小可用：清單 + 詳情 + 黑白切換 */
const $ = sel => document.querySelector(sel);
const listEl = $('#noteList');
const emptyHint = $('#emptyHint');
const viewList = $('#view-list');
const viewDetail = $('#view-detail');
const backBtn = $('#backBtn');
const themeBtn = $('#themeBtn');

const dTitle = $('#dTitle');
const dDate = $('#dDate');
const dCategory = $('#dCategory');
const dLabels = $('#dLabels');
const dContent = $('#dContent');

let state = {
  notes: [],
  theme: localStorage.getItem('nb_theme') || 'light'
};

function setTheme(mode){
  document.body.classList.toggle('dark', mode==='dark');
  document.body.classList.toggle('light', mode!=='dark');
  themeBtn.textContent = mode==='dark' ? '🌞' : '🌙';
  localStorage.setItem('nb_theme', mode);
  state.theme = mode;
}
setTheme(state.theme);

themeBtn.addEventListener('click', ()=>{
  setTheme(state.theme==='dark' ? 'light' : 'dark');
});

backBtn.addEventListener('click', ()=>{
  showList();
});

async function apiList(){
  const url = `${window.NB_CONFIG.API}?action=列出筆記&limit=${window.NB_CONFIG.LIMIT}`;
  const r = await fetch(url, { cache:'no-store' });
  const j = await r.json();
  return (j && j.data) || [];
}
async function apiGet(id){
  const url = `${window.NB_CONFIG.API}?action=取得筆記&id=${encodeURIComponent(id)}`;
  const r = await fetch(url, { cache:'no-store' });
  const j = await r.json();
  return j && j.data;
}

function renderList(notes){
  listEl.innerHTML = '';
  if(!notes.length){ emptyHint.hidden = false; return; }
  emptyHint.hidden = true;
  notes.forEach(n=>{
    const li = document.createElement('li');
    li.className = 'note-item';
    const left = document.createElement('div');
    const right = document.createElement('div');
    left.innerHTML = `<div class="note-snippet">${escapeHTML(n.標題||'(無標題)')}</div>`;
    right.innerHTML = `<div class="note-date">${escapeHTML(n.日期||'')}</div>`;
    li.appendChild(left); li.appendChild(right);
    li.addEventListener('click', ()=> openDetail(n.ID));
    listEl.appendChild(li);
  });
}

function showList(){
  viewDetail.classList.remove('active');
  viewList.classList.add('active');
  backBtn.hidden = true;
}

function showDetail(){
  viewList.classList.remove('active');
  viewDetail.classList.add('active');
  backBtn.hidden = false;
  window.scrollTo({top:0,behavior:'instant'});
}

async function openDetail(id){
  const n = await apiGet(id);
  if(!n){ alert('讀取失敗'); return; }
  dTitle.textContent = n.標題 || '(無標題)';
  dDate.textContent = n.日期 || '';
  dCategory.textContent = n.分類 ? `分類：${n.分類}` : '';
  dLabels.textContent = n.標籤 ? `#${String(n.標籤).replace(/[,，]/g,' #')}` : '';
  dContent.textContent = n.內容 || '';
  showDetail();
}

function escapeHTML(s){
  return String(s||'').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

(async function init(){
  try{
    const notes = await apiList();
    state.notes = notes;
    renderList(notes);
  }catch(e){
    console.error(e);
    emptyHint.hidden = false;
    emptyHint.textContent = '載入失敗（請檢查網路或 API）';
  }
})();
