/* 重算 js/data/exams.js 索引裡每一卷的 exp（已寫好詳解的題數）。
   gen3.py 產題本時本來就會算，但那支腳本在 scratchpad、重啟就沒了；
   只補詳解、沒重跑轉檔時，用這支把索引數字補正即可。
   用法：node tools/sync-exp-count.js [--write] */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const IDX = path.join(ROOT, 'js/data/exams.js');
global.window = {};
require(IDX);
let src = fs.readFileSync(IDX, 'utf8'), changed = [];
window.APP_EXAMS.forEach(e => {
  const f = path.join(ROOT, 'js/data/exam', e.id + '.js');
  if (!fs.existsSync(f)) return;
  delete require.cache[require.resolve(f)];
  require(f);
  const n = window.APP_EXAM_PAPERS[e.id].qs.filter(q => q.exp).length;
  if (n === e.exp) return;
  const re = new RegExp(`("id":\\s*"${e.id}",[\\s\\S]{0,600}?"exp":\\s*)\\d+`);
  if (!re.test(src)) { console.log('✗ 找不到索引欄位：' + e.id); process.exit(1); }
  src = src.replace(re, `$1${n}`);
  changed.push(`${e.id}：${e.exp} → ${n}`);
});
changed.forEach(s => console.log('  ' + s));
if (WRITE && changed.length) fs.writeFileSync(IDX, src, 'utf8');
console.log(`${changed.length} 卷需要更新` + (WRITE ? '，已寫入' : '（未加 --write）'));
