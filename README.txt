Notebook PWA v6.2（護眼＋所有操作啟用）
- 已注入 API_URL：https://script.google.com/macros/s/AKfycbzwmFbpNkGpQkzBKEcQ8tc0_rG7dyMJofrm8Gcm8JEJKaCTWeaoLuXS1WppCXoi9I0BhA/exec
- 啟用：送出、移至回收、還原、永久刪除、編輯文章（update）。
- 送出/操作採用 x-www-form-urlencoded，避開 CORS 預檢；SW 只快取 GET。
- 點標題即可閱讀（Modal），右滑返回；閱讀視窗自動載入試算表「上方圖片」。
- 若操作仍失敗，請確認你的 GAS 已部署含 doPost: append/recycle/restore/purge/update 且「任何人（含匿名）」。
