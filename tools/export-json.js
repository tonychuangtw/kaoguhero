#!/usr/bin/env node
// 把指定的卷匯出成 JSON，給 build-anki.py / build-pdf.py 使用
// 用法：node tools/export-json.js <輸出檔> <卷號前綴或卷號…>
//   node tools/export-json.js /tmp/out.json doc-115 doc-114
const fs = require('fs');
const path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'js', 'data', 'exams.js'));
const EXAMS = window.APP_EXAMS;

const out = process.argv[2];
const pats = process.argv.slice(3);
if (!out || !pats.length) {
  console.error('用法：node tools/export-json.js <輸出檔> <卷號前綴…>');
  process.exit(1);
}
const picked = EXAMS.filter(e => pats.some(p => e.id === p || e.id.startsWith(p)));
if (!picked.length) { console.error('沒有符合的卷'); process.exit(1); }

window.APP_EXAM_PAPERS = {};
const papers = [];
for (const e of picked) {
  const f = path.join(__dirname, '..', 'js', 'data', 'exam', e.id + '.js');
  if (!fs.existsSync(f)) continue;
  delete require.cache[require.resolve(f)];
  require(f);
  const p = window.APP_EXAM_PAPERS[e.id];
  if (!p) continue;
  papers.push({ meta: e, qs: p.qs });
}
fs.writeFileSync(out, JSON.stringify({ papers }, null, 0), 'utf8');
const n = papers.reduce((s, p) => s + p.qs.length, 0);
const withExp = papers.reduce((s, p) => s + p.qs.filter(q => q.exp).length, 0);
console.log(`匯出 ${papers.length} 卷、${n} 題（其中 ${withExp} 題有詳解）→ ${out}`);
