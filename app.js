// === App.js ===

// 狀態
let notes = [];
let lastQuery = "";
let fontSize = "medium";
let isDark = true;
let bookmarkId = null;

// DOM 元素
const listView = document.getElementById("listView");
const detailView = document.getElementById("detailView");
const searchInput = document.getElementById("searchInput");
const themeToggle = document.getElementById("themeToggle");
const fontToggle = document.getElementById("fontToggle");
const refreshBtn = document.getElementById("refreshBtn");
const bookmarkBtn = document.getElementById("bookmarkBtn");
const tagBar = document.getElementById("tagBar");

// 初始化
async function init() {
  await fetchNotes();
  renderList();
  renderTags();
}

// 取得資料
async function fetchNotes() {
  try {
    const res = await fetch(`${BASE_URL}?type=listNotebook&nocache=${Date.now()}`);
    const data = await res.json();
    notes = data;
  } catch (e) {
    listView.innerHTML = `<p>載入失敗 <a href="#" onclick="init()">重試</a></p>`;
  }
}

// 渲染清單
function renderList() {
  let filtered = notes;
  if (lastQuery) {
    filtered = notes.filter(n =>
      n.title.includes(lastQuery) ||
      n.body.includes(lastQuery) ||
      (n.tags && n.tags.includes(lastQuery))
    );
  }

  listView.innerHTML = filtered.map(note => `
    <div class="card">
      <h2><a href="#${note.id}">${note.title}</a></h2>
      <time>${note.date}</time>
      <p>${note.body.substring(0, 80)}...</p>
      <div class="tags">${(note.tags || "").split(" ").map(t=>`<span>#${t}</span>`).join("")}</div>
    </div>
  `).join("");
}

// 渲染單篇
function renderDetail(note) {
  detailView.innerHTML = `
    <article>
      <h2>${note.title}</h2>
      <time>${note.date}</time>
      <div>${note.body}</div>
      <div class="tags">${(note.tags || "").split(" ").map(t=>`<span>#${t}</span>`).join("")}</div>
    </article>
  `;
}

// Router
function route() {
  const id = location.hash.slice(1);
  if (!id) {
    listView.classList.remove("hidden");
    detailView.classList.add("hidden");
    renderList();
    return;
  }
  const note = notes.find(n => n.id === id);
  if (note) {
    listView.classList.add("hidden");
    detailView.classList.remove("hidden");
    renderDetail(note);
  }
}

// 書籤功能
bookmarkBtn.addEventListener("click", () => {
  if (location.hash) {
    bookmarkId = location.hash;
    alert("已加書籤");
  } else if (bookmarkId) {
    location.hash = bookmarkId;
  } else {
    alert("沒有書籤");
  }
});

// 快取更新按鈕
refreshBtn.addEventListener("click", async () => {
  await fetchNotes();
  route();
});

// 搜尋
searchInput.addEventListener("input", e => {
  lastQuery = e.target.value.trim();
  renderList();
});

// 佈景切換
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  isDark = !isDark;
});

// 字體切換
fontToggle.addEventListener("click", () => {
  if (fontSize === "small") {
    fontSize = "medium";
    fontToggle.textContent = "中";
  } else if (fontSize === "medium") {
    fontSize = "large";
    fontToggle.textContent = "大";
  } else {
    fontSize = "small";
    fontToggle.textContent = "小";
  }
  document.body.setAttribute("data-font", fontSize);
});

// 標籤區
function renderTags() {
  const allTags = new Set();
  notes.forEach(n => (n.tags || "").split(" ").forEach(t => allTags.add(t)));
  const tags = Array.from(allTags).slice(0, 10);
  tagBar.innerHTML = tags.map(t => `<button class="tagBtn">#${t}</button>`).join("");
  tagBar.querySelectorAll(".tagBtn").forEach(btn =>
    btn.addEventListener("click", () => {
      lastQuery = btn.textContent.replace("#", "");
      renderList();
    })
  );
}

// 監聽
window.addEventListener("hashchange", route);

// 啟動
init();
