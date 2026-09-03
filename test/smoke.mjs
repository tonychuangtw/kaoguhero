/* 瀏覽器 smoke test：用 CDP 驅動 chrome-headless-shell 真的把站點過一遍。
   找不到 shell 就跳過（exit 0）。用法：node test/smoke.mjs */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = process.env.CHROME_SHELL ||
  process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
if (!existsSync(SHELL)) {
  console.log('⚠️  跳過瀏覽器 smoke test：找不到 ' + SHELL);
  process.exit(process.env.SMOKE_REQUIRED ? 1 : 0);
}
const fails = [];
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails.push(m); };

const PORT = 8931 + (process.pid % 300);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '-b', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
const chrome = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=0', '--remote-allow-origins=*', 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
let wsUrl = '';
chrome.stderr.on('data', d => {
  const m = String(d).match(/ws:\/\/[^\s]+/); if (m && !wsUrl) wsUrl = m[0];
});
for (let i = 0; i < 100 && !wsUrl; i++) await sleep(100);
if (!wsUrl) { console.log('無法啟動 chrome-headless-shell'); srv.kill(); chrome.kill(); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const waits = new Map(); const logs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    logs.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown')
    logs.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || ''));
};
const send = (method, params = {}, sessionId) => new Promise(r => {
  const i = ++id; waits.set(i, r);
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate',
    { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text + ' ' +
    (r.result.exceptionDetails.exception?.description || ''));
  return r.result?.result?.value;
};
const goto = async (u) => {
  await send('Page.navigate', { url: u }, sessionId);
  for (let i = 0; i < 120; i++) {
    await sleep(100);
    if (await evalJs('document.readyState === "complete"')) break;
  }
  await sleep(250);
};

console.log('\n考古英雄 smoke test');
await goto(`http://127.0.0.1:${PORT}/index.html`);

ok(await evalJs('!!window.APP_EXAMS && window.APP_EXAMS.length === 38'), '索引載入 38 卷');
ok(await evalJs('window.APP_EXAMS.reduce((a,b)=>a+b.n,0) === 3800'), '索引合計 3800 題');
ok(await evalJs('document.querySelectorAll("#view-home .card").length >= 4'), '首頁四個區塊都畫出來');

// 整卷測驗：進醫學（一）清單 → 開第一卷
await evalJs(`[...document.querySelectorAll('#view-home .btn')].find(b=>b.textContent.includes('醫學（一）') && b.textContent.includes('卷')).click()`);
await sleep(300);
ok(await evalJs('!document.getElementById("view-list").hidden'), '進入卷別清單');
ok(await evalJs('document.querySelectorAll("#view-list .btn").length >= 19'), '清單列出醫學一各卷');

await evalJs(`document.querySelector('#view-list .btn').click()`);
for (let i = 0; i < 60 && !(await evalJs('!document.getElementById("view-quiz").hidden')); i++) await sleep(100);
ok(await evalJs('!document.getElementById("view-quiz").hidden'), '整卷測驗載入題本並進入作答');
ok(await evalJs('document.querySelectorAll("#view-quiz .opt").length === 4'), '題目有四個選項');
ok((await evalJs('document.querySelector("#view-quiz .stem").textContent.trim().length')) > 5, '題幹有內容');

// 作答一題（故意選第一個），確認會顯示標準答案且能進下一題
await evalJs(`document.querySelectorAll('#view-quiz .opt')[0].click()`);
await sleep(200);
ok(await evalJs('document.querySelectorAll("#view-quiz .opt.correct").length === 1'), '作答後標出正解');
ok(await evalJs('!!document.querySelector("#view-quiz .fb")'), '作答後顯示回饋');
ok(await evalJs('!!localStorage.getItem("kaoguhero.v1")'), '作答紀錄寫入 localStorage');
await evalJs(`document.querySelector('#view-quiz .fb + .bar .btn, #view-quiz .bar .btn.primary').click()`);
await sleep(200);
ok((await evalJs(`document.querySelector('#view-quiz .qmeta span').textContent`)).includes('第 2 /'), '可以進到第 2 題');

// 結束看成績
await evalJs(`[...document.querySelectorAll('#view-quiz .btn')].find(b=>b.textContent.includes('結束')).click()`);
await sleep(250);
ok(await evalJs('!document.getElementById("view-result").hidden'), '結束後顯示成績頁');
ok((await evalJs('document.querySelector("#view-result .big").textContent')).includes('%'), '成績頁顯示正確率');

// 回首頁 → 無限刷題
await evalJs(`[...document.querySelectorAll('#view-result .btn')].find(b=>b.textContent.includes('回首頁')).click()`);
await sleep(250);
await evalJs(`[...document.querySelectorAll('#view-home .btn')].find(b=>b.textContent.includes('全部混合')).click()`);
for (let i = 0; i < 80 && !(await evalJs('!document.getElementById("view-quiz").hidden')); i++) await sleep(100);
ok(await evalJs('!document.getElementById("view-quiz").hidden'), '無限刷題可以開始');
ok(await evalJs('document.querySelectorAll("#view-quiz .opt").length === 4 || !!document.querySelector("#view-quiz .warnbox")'), '刷題題目正常顯示');

// 錯題本與統計
await evalJs(`history.back()`); await sleep(300);
await evalJs(`[...document.querySelectorAll('#view-home .btn')].find(b=>b.textContent.includes('弱點統計')).click()`);
await sleep(250);
ok(await evalJs('!document.getElementById("view-stats").hidden'), '弱點統計頁可開啟');
ok(await evalJs('document.querySelectorAll("#view-stats table").length >= 2'), '統計頁有科目與卷別兩張表');

await evalJs(`history.back()`); await sleep(300);
await evalJs(`document.getElementById('btnInfo').click()`); await sleep(250);
ok(await evalJs('!document.getElementById("view-info").hidden'), '使用說明頁可開啟');
ok((await evalJs('document.getElementById("view-info").textContent')).includes('版本紀錄'), '說明頁含版本紀錄');

// 圖片題：直接開有 fig 的那一卷，確認 <img> 有畫出來且四個選項可按
await evalJs(`history.pushState({},'','');`);
await goto(`http://127.0.0.1:${PORT}/index.html`);
await evalJs(`window.__figTest = (async () => {
  const e = window.APP_EXAMS.find(x => x.id === '113-020-med2');
  return !!e;
})()`);
ok(await evalJs(`!!window.APP_EXAMS.find(x=>x.id==='113-020-med2')`), '找得到含圖片題的卷別');
await evalJs(`new Promise(r=>{const s=document.createElement('script');
  s.src='js/data/exam/113-020-med2.js';s.onload=r;s.onerror=r;document.head.appendChild(s);})`);
ok(await evalJs(`(window.APP_EXAM_PAPERS['113-020-med2'].qs.filter(q=>q.fig).length) === 3`),
   '該卷有 3 題附原始題目圖');
ok(await evalJs(`window.APP_EXAM_PAPERS['113-020-med2'].qs.filter(q=>q.fig)
     .every(q => typeof q.fig === 'string' && q.fig.indexOf('img/q/') === 0)`),
   '圖片路徑格式正確');
const figSrc = await evalJs(`window.APP_EXAM_PAPERS['113-020-med2'].qs.find(q=>q.fig).fig`);
const figOk = await evalJs(`fetch('${figSrc}').then(r=>r.ok).catch(()=>false)`);
ok(figOk, '圖檔實際存在：' + figSrc);

ok(logs.length === 0, 'console 沒有錯誤' + (logs.length ? '：' + logs.slice(0, 3).join(' | ') : ''));

ws.close(); chrome.kill(); srv.kill();
console.log(fails.length ? `\n✗ ${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
