# Notebook PWA v5（含閱讀視窗＋永久刪除按鈕）
- GAS URL：https://script.google.com/macros/s/AKfycbzwmFbpNkGpQkzBKEcQ8tc0_rG7dyMJofrm8Gcm8JEJKaCTWeaoLuXS1WppCXoi9I0BhA/exec
- 列表為摘要（3行），點「閱讀」彈窗看全文；回收桶含「還原／永久刪除」。
- sw.js 只快取本站 GET，跨網域與 POST 直通，避免送出失敗。

⚠️ 伺服端（GAS）請加入 `purge` 支援：

在 doPost(e) 裡加：
  if (action === "purge") return _purgeById(data);

並新增：
function _purgeById(data) {
  const id = String(data.id||"").trim();
  if (!id) return ContentService.createTextOutput(JSON.stringify({ok:false,msg:"No id"})).setMimeType(ContentService.MimeType.JSON);
  const rc = SpreadsheetApp.getActive().getSheetByName("文件回收");
  const vs = rc.getDataRange().getValues();
  for (let i=1;i<vs.length;i++) {
    if (String(vs[i][4]) === id) { rc.deleteRow(i+1); return ContentService.createTextOutput(JSON.stringify({ok:true,mode:"purge",id})).setMimeType(ContentService.MimeType.JSON); }
  }
  return ContentService.createTextOutput(JSON.stringify({ok:false,msg:"ID not found",id})).setMimeType(ContentService.MimeType.JSON);
}
