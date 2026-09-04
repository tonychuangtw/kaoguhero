/* 資料完整性測試：node test/test.js */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
global.window = {};
require(path.join(ROOT, 'js/data/exams.js'));
const { APP_CATS: CATS, APP_SUBJECTS: SUBJ, APP_EXAMS: EXAMS } = window;
let fail = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fail++; console.log('  ✗ ' + m); } };
console.log('考古英雄 資料測試');

ok(Array.isArray(CATS) && CATS.length > 0, '考試分類存在');
ok(SUBJ && Object.keys(SUBJ).length > 0, '科目表存在');
ok(Array.isArray(EXAMS) && EXAMS.length > 0, '卷別索引存在且非空');

// 分類 → 考試 → 科目 的參照要接得上
const examIds = new Set();
CATS.forEach(c => {
  ok(c.id && c.name && Array.isArray(c.exams), c.id + ' 分類欄位完整');
  c.exams.forEach(x => {
    ok(!examIds.has(x.id), x.id + ' 考試 id 不重複'); examIds.add(x.id);
    if (x.live) {
      ok(Array.isArray(x.stages) && x.stages.length > 0, x.id + ' 已上線就要有 stages');
      (x.stages || []).forEach(st => st.subjects.forEach(sid =>
        ok(!!SUBJ[sid], `${x.id} 的科目 ${sid} 在科目表中有定義`)));
      ok(EXAMS.some(e => e.exam === x.id), x.id + ' 標為已上線就要有卷子');
    } else {
      ok(!EXAMS.some(e => e.exam === x.id), x.id + ' 標為建置中就不該有卷子');
    }
  });
});

const ids = new Set();
EXAMS.forEach(e => {
  ok(!ids.has(e.id), e.id + ' 沒有重複'); ids.add(e.id);
  ok(/^\d{3}-[12]-\w+$/.test(e.id), e.id + ' id 格式正確');
  ok(examIds.has(e.exam), e.id + ' 的 exam 對得到考試');
  ok(!!SUBJ[e.subj], e.id + ' 的 subj 對得到科目');
  ok(Number.isInteger(e.roc) && e.roc >= 90 && e.roc <= 130, e.id + ' roc 合理');
  ok(e.nth === 1 || e.nth === 2, e.id + ' 次別是 1 或 2');
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

  const nums = new Set(); const bad = [];
  p.qs.forEach(q => {
    if (!Number.isInteger(q.n) || q.n < 1) bad.push('題號 ' + q.n);
    if (nums.has(q.n)) bad.push('重複題號 ' + q.n);
    nums.add(q.n);
    if (typeof q.q !== 'string' || q.q.length < 4) bad.push('#' + q.n + ' 題幹過短');
    if (!Array.isArray(q.o) || q.o.length !== 4) bad.push('#' + q.n + ' 選項不是四個');
    if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) bad.push('#' + q.n + ' 答案超出範圍');
    if (q.void != null && q.void !== true) bad.push('#' + q.n + ' void 欄位型別錯誤');
    if (q.pt !== 1 || q.type !== 'single') bad.push('#' + q.n + ' 配分或題型不對');
    if (!q.needfig && q.o.some(o => !o || !o.trim())) bad.push('#' + q.n + ' 有空選項卻沒標 needfig');
    if (q.exp != null && typeof q.exp !== 'string') bad.push('#' + q.n + ' exp 型別錯誤');
  });
  // 題號必須連號 1..n（斷號代表解析漏題）
  const mx = Math.max(...nums);
  for (let i = 1; i <= mx; i++) if (!nums.has(i)) bad.push('缺第 ' + i + ' 題');
  ok(bad.length === 0, `${e.id} 每一題都完整（問題：${bad.length ? bad.slice(0, 3).join('、') : '無'}）`);
});

// 詳解格式：有寫的就要合規
let expN = 0, expBad = [];
EXAMS.forEach(e => {
  const p = window.APP_EXAM_PAPERS[e.id]; if (!p) return;
  p.qs.forEach(q => {
    if (!q.exp) return;
    expN++;
    const LAB = ['A', 'B', 'C', 'D'];
    if (!q.void && !q.exp.startsWith('✅ (' + LAB[q.a] + ')')) expBad.push(e.id + '#' + q.n + ' ✅ 字母不符');
    if ((q.exp.match(/^❌ \([A-D]\)/gm) || []).length !== 3) expBad.push(e.id + '#' + q.n + ' ❌ 不是三段');
    if (q.exp.indexOf('📚') < 0) expBad.push(e.id + '#' + q.n + ' 缺出處');
  });
});
ok(expBad.length === 0, `詳解格式都合規（問題 ${expBad.length} 筆${expBad.length ? '：' + expBad.slice(0, 3).join('、') : ''}）`);

let needfig = 0, withFig = 0;
EXAMS.forEach(e => {
  const p = window.APP_EXAM_PAPERS[e.id]; if (!p) return;
  p.qs.forEach(q => { if (q.needfig) needfig++; if (q.fig) withFig++; });
});
ok(needfig === withFig, `需要圖的題目都有圖（needfig ${needfig}、有圖 ${withFig}）`);
EXAMS.forEach(e => {
  const p = window.APP_EXAM_PAPERS[e.id]; if (!p) return;
  p.qs.forEach(q => { if (q.fig) ok(fs.existsSync(path.join(ROOT, q.fig)), q.fig + ' 圖檔存在'); });
});

let voidN = 0;
EXAMS.forEach(e => { const p = window.APP_EXAM_PAPERS[e.id]; if (p) p.qs.forEach(q => { if (q.void) voidN++; }); });
console.log(`  分類 ${CATS.length}、卷數 ${EXAMS.length}、題數 ${EXAMS.reduce((a, b) => a + b.n, 0)}、` +
  `圖片題 ${needfig}、送分題 ${voidN}、已有詳解 ${expN}`);
console.log(fail ? `\n✗ ${fail} / ${checks} 項失敗` : `\n全部通過（${checks} 項檢查）`);
process.exit(fail ? 1 : 0);
