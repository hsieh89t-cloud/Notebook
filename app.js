const API_URL = "https://script.google.com/macros/s/AKfycbzwmFbpNkGpQkzBKEcQ8tc0_rG7dyMJofrm8Gcm8JEJKaCTWeaoLuXS1WppCXoi9I0BhA/exec";

// TODO: 之後可改為呼叫 listNotebook API。現在先顯示兩筆假資料供測試 UI。
async function loadArticles() {
  const main = document.getElementById("articles");
  main.innerHTML = "<p>載入中…</p>";
  try {
    const data = [
      { title: "自動化真香", category: "學習記事", date: "2025-09-28", content: "今天學到 Apps Script 可以自動幫我整理文章！" },
      { title: "測試看看", category: "普通記事", date: "2025-09-28", content: "這是一篇測試文章" }
    ];
    main.innerHTML = "";
    data.forEach(a => {
      const card = document.createElement("div");
      card.className = "article-card";
      card.innerHTML = `
        <h3>${a.title}</h3>
        <small>${a.date} ｜ ${a.category || "未分類"}</small>
        <p>${a.content}</p>
      `;
      main.appendChild(card);
    });
  } catch (err) {
    main.innerHTML = `<p style="color:red;">載入失敗：${err}</p>`;
  }
}

const btn = document.getElementById("submitBtn");
btn.addEventListener("click", async () => {
  const content = document.getElementById("inputContent").value.trim();
  if (!content) return alert("請輸入文章");

  btn.disabled = true;
  btn.innerText = "送出中…";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "append", content })
    });
    const json = await res.json();
    if (json.ok) {
      alert("送出成功：" + (json.title || ""));
      document.getElementById("inputContent").value = "";
      loadArticles();
    } else {
      alert("送出失敗：" + (json.msg || JSON.stringify(json)));
    }
  } catch (err) {
    alert("送出失敗：" + err);
  } finally {
    btn.disabled = false;
    btn.innerText = "送出";
  }
});

loadArticles();
