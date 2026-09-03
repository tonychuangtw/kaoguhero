/* 資料完整性測試：node test/test.js
   守門的重點是「索引與實檔對得上、每題結構完整、答案在範圍內」。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
global.window = {};
require(path.join(ROOT, 'js/data/exams.js'));
const EXAMS = window.APP_EXAMS;
let fail = 0, checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) { fail++; console.log('  ✗ ' + msg); }
}
console.log('考古英雄 資料測試');
ok(Array.isArray(EXAMS) && EXAMS.length > 0, '索引存在且非空');

const ids = new Set();
EXAMS.forEach(e => {
  ok(!ids.has(e.id), e.id + ' 沒有重複'); ids.add(e.id);
  ok(/^\d{3}-\d{3}-med[12]$/.test(e.id), e.id + ' id 格式正確');
  ok(e.subj === 'med1' || e.subj === 'med2', e.id + ' subj 合法');
  ok(Number.isInteger(e.roc) && e.roc >= 90 && e.roc <= 130, e.id + ' roc 合理');
  ok(typeof e.label === 'string' && e.label.length > 4, e.id + ' 有 label');

  const f = path.join(ROOT, 'js/data/exam', e.id + '.js');
  ok(fs.existsSync(f), e.id + ' 實檔存在');
  if (!fs.existsSync(f)) return;
  require(f);
  const p = (window.APP_EXAM_PAPERS || {})[e.id];
  ok(!!p, e.id + ' 實檔有註冊題本');
  if (!p) return;
  ok(p.qs.length === e.n, `${e.id} 索引題數與實檔一致（索引 ${e.n}、實檔 ${p.qs.length}）`);
  ok(typeof p.src === 'string' && p.src.includes('考選部'), e.id + ' 有註明資料來源');

  const nums = new Set();
  let bad = [];
  p.qs.forEach(q => {
    if (!Number.isInteger(q.n) || q.n < 1) bad.push('題號 ' + q.n);
    if (nums.has(q.n)) bad.push('重複題號 ' + q.n);
    nums.add(q.n);
    if (typeof q.q !== 'string' || q.q.length < 4) bad.push('#' + q.n + ' 題幹過短');
    if (!Array.isArray(q.o) || q.o.length !== 4) bad.push('#' + q.n + ' 選項不是四個');
    if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) bad.push('#' + q.n + ' 答案超出範圍');
    if (q.pt !== 1) bad.push('#' + q.n + ' 配分不是 1');
    if (q.type !== 'single') bad.push('#' + q.n + ' 題型不是 single');
    // 沒有 needfig 的題目，四個選項都不可以是空的
    if (!q.needfig && q.o.some(o => !o || !o.trim())) bad.push('#' + q.n + ' 有空選項卻沒標 needfig');
    if (q.exp != null && typeof q.exp !== 'string') bad.push('#' + q.n + ' exp 型別錯誤');
  });
  ok(bad.length === 0, `${e.id} 每一題都完整（問題：${bad.length ? bad.slice(0, 3).join('、') : '無'}）`);
});

// 全站統計
let total = EXAMS.reduce((a, b) => a + b.n, 0);
let needfig = 0, withExp = 0;
EXAMS.forEach(e => {
  const p = window.APP_EXAM_PAPERS[e.id];
  if (!p) return;
  p.qs.forEach(q => { if (q.needfig) needfig++; if (q.exp) withExp++; });
});
console.log(`  卷數 ${EXAMS.length}、題數 ${total}、待補圖 ${needfig} 題、已有詳解 ${withExp} 題`);
console.log(fail ? `\n✗ ${fail} / ${checks} 項失敗` : `\n全部通過（${checks} 項檢查）`);
process.exit(fail ? 1 : 0);
