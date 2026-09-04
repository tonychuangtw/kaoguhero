/* 瀏覽器 smoke test：用 CDP 驅動 chrome-headless-shell 把站點實際走一遍。
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
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '-b', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const chrome = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=0', '--remote-allow-origins=*', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let wsUrl = '';
chrome.stderr.on('data', d => { const m = String(d).match(/ws:\/\/[^\s]+/); if (m && !wsUrl) wsUrl = m[0]; });
for (let i = 0; i < 100 && !wsUrl; i++) await sleep(100);
if (!wsUrl) { console.log('無法啟動 chrome-headless-shell'); srv.kill(); chrome.kill(); process.exit(1); }
const ws = new WebSocket(wsUrl); await new Promise(r => ws.onopen = r);
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
  const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 900, deviceScaleFactor: 2, mobile: true }, sessionId);
const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
const go = async (hash) => {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html${hash || ''}` }, sessionId);
  for (let i = 0; i < 120; i++) { await sleep(100); if (await ev('document.readyState === "complete"')) break; }
  await sleep(350);
};
const hash = async (h) => { await ev(`location.hash='${h}'`); await sleep(320); };

console.log('\n考古英雄 smoke test');
await go('');

// --- 資料 ---
ok(await ev('window.APP_EXAMS.length === 150'), '索引載入 150 卷');
ok(await ev('window.APP_EXAMS.reduce((a,b)=>a+b.n,0) === 12760'), '索引合計 12,760 題');
ok(await ev('window.APP_CATS.length >= 4'), '至少四個考試分類');

// --- 首頁 ---
ok(await ev('document.querySelectorAll("#main .hero").length === 1'), '首頁有 hero 區塊');
ok(await ev('document.querySelectorAll("#main .card").length >= 6'), '首頁列出考試類別卡片');
ok((await ev('document.querySelector("#main .hero").textContent')).includes('12,760'), 'hero 顯示總題數');
ok(await ev('document.querySelectorAll("#nav a").length === 6'), '導覽列六個項目');
ok(await ev('document.querySelectorAll(".ft a").length >= 6'), '頁尾有連結');

// --- 導覽到考試 → 科目 → 卷 ---
await hash('#/exams');
ok(await ev('document.querySelectorAll("#main .cards").length >= 4'), '題庫總覽列出各分類');
await hash('#/exam/doctor');
ok(await ev('document.querySelectorAll("#main .panel .it").length >= 6'), '醫師頁列出六個科目');
ok((await ev('document.getElementById("main").textContent')).includes('第二階段'), '醫師頁含第二階段');
await hash('#/subject/doctor/med3');
ok((await ev('document.querySelector(".pg-h").textContent')).includes('醫學（三）'), '進入醫學（三）科目頁');
ok(await ev('document.querySelectorAll("#main .panel .it").length >= 20'), '科目頁列出各年份卷別');

// --- 整卷測驗 ---
const pid = await ev(`window.APP_EXAMS.filter(e=>e.subj==='med3')[0].id`);
await hash('#/paper/' + pid);
for (let i = 0; i < 60 && !(await ev('!!document.querySelector("#main .opt")')); i++) await sleep(100);
ok(await ev('document.querySelectorAll("#main .opt").length === 4'), '整卷測驗載入並顯示四個選項');
ok((await ev('document.querySelector("#main .stem").textContent.trim().length')) > 5, '題幹有內容');
await ev(`document.querySelectorAll('#main .opt')[0].click()`); await sleep(250);
ok(await ev('document.querySelectorAll("#main .opt.correct").length === 1'), '作答後標出正解');
ok(await ev('!!localStorage.getItem("kaoguhero.v1")'), '作答紀錄寫入 localStorage');
await ev(`[...document.querySelectorAll('#main .btn')].find(b=>/下一題|看結果/.test(b.textContent)).click()`);
await sleep(250);
ok((await ev(`document.querySelector('#main .qmeta span').textContent`)).includes('第 2 /'), '可以進到第 2 題');
await ev(`[...document.querySelectorAll('#main .btn')].find(b=>b.textContent.includes('結束')).click()`);
await sleep(300);
ok(await ev('!!document.querySelector("#main .big")'), '結束後顯示成績');

// --- 送分題 ---
const vp = await ev(`(async()=>{ for (const e of window.APP_EXAMS) {
   const t = await fetch('js/data/exam/'+e.id+'.js').then(r=>r.text()).catch(()=>'');
   if (t.indexOf('"void"') >= 0) {
     await new Promise(r=>{const s=document.createElement('script');s.src='js/data/exam/'+e.id+'.js';s.onload=r;s.onerror=r;document.head.appendChild(s);});
     return e.id; } } return '';})()`);
ok(!!vp, '找得到含送分題的卷別：' + vp);
ok(await ev(`window.APP_EXAM_PAPERS['${vp}'].qs.filter(q=>q.void).every(q=>typeof q.a==='number')`),
   '送分題仍保有可作答的結構');

// --- 圖片題 ---
ok(await ev(`window.APP_EXAMS.length>0`), '索引可用');
const figPaper = await ev(`(async()=>{ for (const e of window.APP_EXAMS) {
   if(!window.APP_EXAM_PAPERS[e.id]) continue;
   const p=window.APP_EXAM_PAPERS[e.id]; if(p.qs.some(q=>q.fig)) return e.id; } return '';})()`);
if (figPaper) {
  const src = await ev(`window.APP_EXAM_PAPERS['${figPaper}'].qs.find(q=>q.fig).fig`);
  ok(await ev(`fetch('${src}').then(r=>r.ok).catch(()=>false)`), '圖片題的圖檔存在：' + src);
}

// --- 詳解 ---
await ev(`new Promise(r=>{const s=document.createElement('script');s.src='js/data/exam/115-2-med1.js';s.onload=r;s.onerror=r;document.head.appendChild(s);})`);
const expN = await ev(`window.APP_EXAM_PAPERS['115-2-med1'].qs.filter(q=>q.exp).length`);
ok(expN > 0, `已寫詳解 ${expN} 題`);
ok(await ev(`window.APP_EXAM_PAPERS['115-2-med1'].qs.filter(q=>q.exp).every(q=>q.exp.indexOf('📚')>=0)`),
   '每則詳解都附出處');
await hash('#/paper/115-2-med1');
for (let i = 0; i < 60 && !(await ev('!!document.querySelector("#main .opt")')); i++) await sleep(100);
await ev(`document.querySelectorAll('#main .opt')[0].click()`); await sleep(250);
ok((await ev(`document.querySelector('#main .fb')?.textContent || ''`)).includes('📚'), '作答後看得到詳解與出處');

// --- 錯題本／統計 ---
await hash('#/wrong');
ok(!!(await ev('document.querySelector(".pg-h")')), '錯題本頁可開啟');
await hash('#/stats');
ok((await ev('document.getElementById("main").textContent')).includes('正確率'), '弱點統計頁可開啟');

// --- 內容頁 ---
for (const [h, kw] of [['#/guide', '準備方式'], ['#/stories', '考取心得'],
                       ['#/sponsor', '贊助'], ['#/support', '客服'], ['#/about', '版本紀錄']]) {
  await hash(h);
  ok((await ev('document.getElementById("main").textContent')).includes(kw), h + ' 內容頁可開啟');
}
await hash('#/no-such-page');
ok((await ev('document.getElementById("main").textContent')).includes('找不到'), '未知網址顯示找不到頁面');

ok(logs.length === 0, 'console 沒有錯誤' + (logs.length ? '：' + logs.slice(0, 2).join(' | ') : ''));
ws.close(); chrome.kill(); srv.kill();
console.log(fails.length ? `\n✗ ${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
