/* 把手寫的詳解寫進題本。
   用法：node tools/set-exp.js <patch.json> [--write]
   patch.json 格式：[{ "pid":"115-090-med1", "n":1, "exp":"✅ …\n❌ …\n📚 …" }, ...]

   會擋下來的事（寫壞資料比沒寫更糟）：
     ・pid／題號找不到
     ・沒有 ✅ 開頭那一行
     ・❌ 段不是剛好三段（四個選項扣掉正解）
     ・沒有 📚 出處那一段
     ・✅ 標的字母與該題的正解不符
*/
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const file = args[0], WRITE = args.includes('--write');
if (!file) { console.error('用法：node tools/set-exp.js <patch.json> [--write]'); process.exit(1); }
const patch = JSON.parse(fs.readFileSync(file, 'utf8'));
const LAB = ['A', 'B', 'C', 'D'];
global.window = {};
require(path.join(ROOT, 'js/data/exams.js'));

const byPid = {};
patch.forEach(p => (byPid[p.pid] = byPid[p.pid] || []).push(p));
let errs = [], done = 0;

Object.keys(byPid).forEach(pid => {
  const f = path.join(ROOT, 'js/data/exam', pid + '.js');
  if (!fs.existsSync(f)) { errs.push(pid + '：找不到題本檔'); return; }
  delete require.cache[require.resolve(f)];
  require(f);
  const paper = window.APP_EXAM_PAPERS[pid];
  byPid[pid].forEach(p => {
    const q = paper.qs.find(z => z.n === p.n);
    if (!q) { errs.push(`${pid} #${p.n}：題號不存在`); return; }
    const e = String(p.exp || '');
    const first = e.split('\n')[0];
    const m = first.match(/^✅\s*\(([A-D])\)/);
    if (!m) { errs.push(`${pid} #${p.n}：第一行要是「✅ (X) …」`); return; }
    if (m[1] !== LAB[q.a]) {
      errs.push(`${pid} #${p.n}：✅ 標的是 (${m[1]})，但正解是 (${LAB[q.a]})`); return;
    }
    const xs = (e.match(/^❌\s*\([A-D]\)/gm) || []);
    if (xs.length !== 3) { errs.push(`${pid} #${p.n}：❌ 要剛好三段（現在 ${xs.length} 段）`); return; }
    const xl = xs.map(s => s.match(/\(([A-D])\)/)[1]).sort().join('');
    const want = LAB.filter((_, i) => i !== q.a).join('');
    if (xl !== want) { errs.push(`${pid} #${p.n}：❌ 應涵蓋 ${want}，實際 ${xl}`); return; }
    if (!/^📚/m.test(e)) { errs.push(`${pid} #${p.n}：缺 📚 出處那一段`); return; }
    if (!/《|：|,\s*\d|第\s*\d+\s*版|指引|Guideline|ed\./.test(e.split('📚')[1] || '')) {
      errs.push(`${pid} #${p.n}：📚 那段看不出具體出處（要寫得出書名／版次／指引名稱）`); return;
    }
    q.exp = e; done++;
  });
  if (WRITE && !errs.length) {
    const head = fs.readFileSync(f, 'utf8').split('window.APP_EXAM_PAPERS =')[0];
    fs.writeFileSync(f,
      head + 'window.APP_EXAM_PAPERS = window.APP_EXAM_PAPERS || {};\n' +
      `window.APP_EXAM_PAPERS['${pid}'] = ` + JSON.stringify(paper, null, 1) + ';\n', 'utf8');
  }
});
if (errs.length) { errs.slice(0, 20).forEach(e => console.log('  ✗ ' + e));
  console.log(`\n✗ ${errs.length} 筆有問題，${WRITE ? '沒有寫入任何檔案' : '（未加 --write，本來就不會寫）'}`);
  process.exit(1); }
console.log(`✓ ${done} 題通過檢查` + (WRITE ? '，已寫入' : '（未加 --write，尚未寫入）'));
