# 考古英雄

醫師國考（專技高考醫師分階段考試 **第一階段**）歷屆考古題線上練習站。

- 網址：https://tonychuangtw.github.io/kaoguhero/
- 收錄：民國 106～115 年　醫學（一）、醫學（二）　共 38 卷、3,800 題
- 功能：整卷測驗、無限刷題、錯題本、弱點統計（進度存在瀏覽器本機）

## 資料來源

試題與標準答案取自考選部「考畢試題查詢平臺」公開之考畢試題與測驗式試題標準答案
（<https://wwwq.moex.gov.tw/>），屬政府資訊公開資料。標準答案如有更正，本站以更正後的答案為準。

**站上的解析與頁面文案皆為本站自撰**，未取用任何第三方網站的詳解或內容。

## 開發

純靜態 vanilla JS，無 build 步驟，GitHub Pages 由 main 分支根目錄部署。

```
node test/test.js     # 資料完整性（索引 vs 實檔、每題結構、答案範圍）
node test/smoke.mjs   # 瀏覽器 smoke test（用 chrome-headless-shell 真的點過一遍）
```

改到 `js/` 或 `css/` 後，記得把 `index.html` 裡的 `?v=` 換成當天日期，
避免使用者拿到 GitHub Pages 快取的舊檔。

## 目錄

```
js/data/exams.js        卷別索引（自動產生）
js/data/exam/<id>.js    各卷題目（自動產生）
img/q/                  選項是圖片的題目，從官方 PDF 裁下來的原圖
js/app.js               前端全部邏輯
```
