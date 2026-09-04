/* 考古英雄 — 醫師國考考古題練習站
   純 vanilla JS、無 build、資料在 js/data/、進度存 localStorage。 */
(function () {
  'use strict';

  var EXAMS = window.APP_EXAMS || [];
  var PAPERS = window.APP_EXAM_PAPERS = window.APP_EXAM_PAPERS || {};
  var SUBJ = { med1: '醫學（一）', med2: '醫學（二）' };
  var SUBJ_NOTE = {
    med1: '生物化學、解剖學、胚胎及發育生物學、組織學、生理學',
    med2: '微生物免疫學、寄生蟲學、藥理學、病理學、公共衛生學'
  };
  var KEY = 'kaoguhero.v1';

  /* ---------- 進度 ---------- */
  var state = { stats: {}, wrong: [], seen: {} };
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          state.stats = o.stats || {};
          state.wrong = Array.isArray(o.wrong) ? o.wrong : [];
          state.seen = o.seen || {};
        }
      }
    } catch (e) { /* 隱私模式或容量滿，就當作沒有存過 */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- 小工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function pct(a, b) { return b ? Math.round(a * 1000 / b) / 10 : 0; }
  var LAB = ['A', 'B', 'C', 'D'];

  /* ---------- 導覽 ---------- */
  var VIEWS = ['home', 'list', 'quiz', 'result', 'wrong', 'stats', 'info'];
  var navStack = [];
  function show(name, title, push) {
    VIEWS.forEach(function (v) { $('view-' + v).hidden = (v !== name); });
    $('topTitle').textContent = title || '考古英雄';
    $('btnBack').hidden = (name === 'home');
    if (push !== false) {
      navStack.push({ name: name, title: title });
      history.pushState({ i: navStack.length }, '', '');
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', function () {
    navStack.pop();
    var prev = navStack[navStack.length - 1];
    if (prev) show(prev.name, prev.title, false);
    else { navStack = []; renderHome(); show('home', '考古英雄', false); }
  });
  $('btnBack').onclick = function () { history.back(); };
  $('btnInfo').onclick = function () { renderInfo(); show('info', '使用說明'); };

  /* ---------- 載入題本 ---------- */
  var loading = {};
  function loadPaper(id, cb) {
    if (PAPERS[id]) return cb(PAPERS[id]);
    if (loading[id]) return loading[id].push(cb);
    loading[id] = [cb];
    var s = document.createElement('script');
    s.src = 'js/data/exam/' + id + '.js?v=20260904b';
    s.onload = function () {
      var fns = loading[id]; loading[id] = null;
      fns.forEach(function (f) { f(PAPERS[id]); });
    };
    s.onerror = function () {
      var fns = loading[id]; loading[id] = null;
      fns.forEach(function (f) { f(null); });
    };
    document.head.appendChild(s);
  }
  function loadMany(ids, cb) {
    var left = ids.length, out = [];
    if (!left) return cb(out);
    ids.forEach(function (id) {
      loadPaper(id, function (p) {
        if (p) out.push(p);
        if (--left === 0) cb(out);
      });
    });
  }

  /* ---------- 首頁 ---------- */
  function renderHome() {
    var v = $('view-home'); v.innerHTML = '';
    var years = [];
    EXAMS.forEach(function (e) { if (years.indexOf(e.roc) < 0) years.push(e.roc); });

    var intro = el('div', 'card');
    intro.appendChild(el('h2', null, '醫師國考 第一階段 考古題'));
    intro.appendChild(el('p', 'muted',
      '收錄民國 ' + Math.min.apply(null, years) + '～' + Math.max.apply(null, years) +
      ' 年共 ' + EXAMS.length + ' 卷、' +
      EXAMS.reduce(function (a, b) { return a + b.n; }, 0) + ' 題。' +
      '試題與標準答案為考選部「考畢試題查詢平臺」公開資料。'));
    v.appendChild(intro);

    var c1 = el('div', 'card');
    c1.appendChild(el('h2', null, '開始練習'));
    var g = el('div', 'grid');
    [['med1', '無限刷題 · 醫學（一）'], ['med2', '無限刷題 · 醫學（二）'], ['all', '無限刷題 · 全部混合']]
      .forEach(function (p) {
        var b = el('button', 'btn');
        b.appendChild(el('b', null, p[1]));
        b.appendChild(el('span', 'sub', p[0] === 'all' ? '兩科混合隨機出題，答完立刻對答案'
          : SUBJ_NOTE[p[0]]));
        b.onclick = function () { startDrill(p[0]); };
        g.appendChild(b);
      });
    c1.appendChild(g);
    v.appendChild(c1);

    var c2 = el('div', 'card');
    c2.appendChild(el('h2', null, '整卷測驗'));
    c2.appendChild(el('p', 'muted', '一次做完一整卷 100 題，作答完成後計分並列出對錯。'));
    var g2 = el('div', 'grid two');
    ['med1', 'med2'].forEach(function (s) {
      var b = el('button', 'btn');
      b.appendChild(el('b', null, SUBJ[s]));
      b.appendChild(el('span', 'sub', EXAMS.filter(function (e) { return e.subj === s; }).length + ' 卷'));
      b.onclick = function () { renderList(s); };
      g2.appendChild(b);
    });
    c2.appendChild(g2);
    v.appendChild(c2);

    var c3 = el('div', 'card');
    c3.appendChild(el('h2', null, '複習與統計'));
    var g3 = el('div', 'grid two');
    var bw = el('button', 'btn');
    bw.appendChild(el('b', null, '錯題本'));
    bw.appendChild(el('span', 'sub', state.wrong.length + ' 題待複習'));
    bw.onclick = function () { renderWrong(); show('wrong', '錯題本'); };
    g3.appendChild(bw);
    var bs = el('button', 'btn');
    bs.appendChild(el('b', null, '弱點統計'));
    var done = 0, ok = 0;
    Object.keys(state.stats).forEach(function (k) { done += state.stats[k].n; ok += state.stats[k].ok; });
    bs.appendChild(el('span', 'sub', done ? ('已作答 ' + done + ' 題．正確率 ' + pct(ok, done) + '%') : '還沒有作答紀錄'));
    bs.onclick = function () { renderStats(); show('stats', '弱點統計'); };
    g3.appendChild(bs);
    c3.appendChild(g3);
    v.appendChild(c3);
  }

  /* ---------- 卷別清單 ---------- */
  function renderList(subj) {
    var v = $('view-list'); v.innerHTML = '';
    var c = el('div', 'card');
    c.appendChild(el('h2', null, SUBJ[subj]));
    c.appendChild(el('p', 'muted', SUBJ_NOTE[subj]));
    v.appendChild(c);
    var list = EXAMS.filter(function (e) { return e.subj === subj; });
    var box = el('div', 'card');
    list.forEach(function (e) {
      var st = state.stats[e.id];
      var b = el('button', 'btn');
      b.appendChild(el('b', null, e.label));
      b.appendChild(el('span', 'sub', e.n + ' 題' +
        (st ? '．已作答 ' + st.n + ' 題．正確率 ' + pct(st.ok, st.n) + '%' : '')));
      b.onclick = function () { startPaper(e.id); };
      box.appendChild(b);
    });
    v.appendChild(box);
    show('list', SUBJ[subj]);
  }

  /* ---------- 作答 ---------- */
  var quiz = null;

  function startPaper(id) {
    loadPaper(id, function (p) {
      if (!p) return alert('題本載入失敗，請重新整理再試一次。');
      quiz = { mode: 'paper', pid: id, title: p.title, qs: p.qs.slice(), i: 0, ans: [], ok: 0 };
      renderQuiz();
      show('quiz', p.roc + ' 年' + (p.nth === 2 ? '二' : '一') + ' ' + (p.subj === 'med1' ? '醫學（一）' : '醫學（二）'));
    });
  }

  function startDrill(scope) {
    var ids = EXAMS.filter(function (e) { return scope === 'all' || e.subj === scope; })
      .map(function (e) { return e.id; });
    // 隨機挑 4 卷載入，湊出一批題目就開始，不用等全部 38 卷
    var pick = ids.slice();
    for (var i = pick.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = pick[i]; pick[i] = pick[j]; pick[j] = t;
    }
    loadMany(pick.slice(0, 4), function (ps) {
      if (!ps.length) return alert('題本載入失敗，請重新整理再試一次。');
      var pool = [];
      ps.forEach(function (p) {
        p.qs.forEach(function (q) { pool.push({ q: q, pid: p.id, title: p.title }); });
      });
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      quiz = {
        mode: 'drill', scope: scope, pool: pool.slice(0, 40),
        title: '無限刷題 · ' + (scope === 'all' ? '全部混合' : SUBJ[scope]),
        qs: pool.slice(0, 40).map(function (x) { return x.q; }),
        meta: pool.slice(0, 40), i: 0, ans: [], ok: 0
      };
      renderQuiz();
      show('quiz', quiz.title);
    });
  }

  function startWrong() {
    var ids = [];
    state.wrong.forEach(function (w) { if (ids.indexOf(w.pid) < 0) ids.push(w.pid); });
    loadMany(ids, function () {
      var items = [];
      state.wrong.forEach(function (w) {
        var p = PAPERS[w.pid]; if (!p) return;
        var q = p.qs.filter(function (z) { return z.n === w.n; })[0];
        if (q) items.push({ q: q, pid: w.pid, title: p.title });
      });
      if (!items.length) return alert('錯題本是空的。');
      quiz = {
        mode: 'wrong', title: '錯題本複習', meta: items,
        qs: items.map(function (x) { return x.q; }), i: 0, ans: [], ok: 0
      };
      renderQuiz();
      show('quiz', quiz.title);
    });
  }

  function curMeta() {
    if (quiz.mode === 'paper') return { pid: quiz.pid, title: quiz.title };
    return quiz.meta[quiz.i];
  }

  function renderQuiz() {
    var v = $('view-quiz'); v.innerHTML = '';
    var q = quiz.qs[quiz.i];
    if (!q) return finish();
    var m = curMeta();

    var pr = el('div', 'prog');
    var bar = el('i'); bar.style.width = (quiz.i / quiz.qs.length * 100) + '%';
    pr.appendChild(bar); v.appendChild(pr);

    var card = el('div', 'card');
    var meta = el('div', 'qmeta');
    meta.appendChild(el('span', null, '第 ' + (quiz.i + 1) + ' / ' + quiz.qs.length + ' 題'));
    meta.appendChild(el('span', null, (quiz.mode === 'paper' ? ('原卷第 ' + q.n + ' 題') : m.title)));
    card.appendChild(meta);
    card.appendChild(el('div', 'stem', q.q));

    // 選項是圖片（化學結構式、①②③④組合題）的題目：直接放官方試卷的裁圖，仍可作答
    if (q.fig) {
      var im = el('img', 'qfig');
      im.src = q.fig;
      im.alt = '第 ' + q.n + ' 題的原始題目圖（含選項）';
      im.loading = 'lazy';
      card.appendChild(im);
      card.appendChild(el('p', 'muted', '這一題的題目與選項含有圖形，上方為原始試卷的圖。請依圖選擇答案。'));
    } else if (q.needfig) {
      card.appendChild(el('div', 'warnbox',
        '⚠ 這一題的選項在原始試卷上是圖片，本站尚未補上圖檔，暫時無法作答。'));
      var skip = el('button', 'btn primary', '跳過這一題');
      skip.onclick = function () { quiz.i++; renderQuiz(); };
      card.appendChild(skip);
      v.appendChild(card);
      return;
    }

    var picked = quiz.ans[quiz.i];
    q.o.forEach(function (txt, k) {
      var b = el('button', 'opt');
      var lab = el('span', 'lab', LAB[k] + '.');
      b.appendChild(lab);
      b.appendChild(document.createTextNode(txt && txt.trim() ? txt : '（見上圖）'));
      if (picked != null) {
        b.disabled = true;
        if (k === q.a) b.className = 'opt correct';
        else if (k === picked) b.className = 'opt wrong';
      } else {
        b.onclick = function () { answer(k); };
      }
      card.appendChild(b);
    });

    if (picked != null) {
      var good = picked === q.a;
      var fb = el('div', 'fb ' + (good ? 'ok' : 'no'));
      fb.appendChild(el('b', null, good ? '✅ 答對了' : '❌ 答錯了'));
      fb.appendChild(document.createTextNode(
        '　標準答案：' + LAB[q.a] + '. ' + q.o[q.a]));
      if (q.exp) {
        fb.appendChild(document.createElement('br'));
        fb.appendChild(document.createTextNode(q.exp));
      } else {
        var note = el('div', 'muted', '（本題詳解尚未撰寫，會分批補上。）');
        note.style.marginTop = '6px';
        fb.appendChild(note);
      }
      card.appendChild(fb);

      var bar2 = el('div', 'bar');
      var nx = el('button', 'btn primary',
        quiz.i + 1 < quiz.qs.length ? '下一題 →' : '看結果');
      nx.onclick = function () { quiz.i++; renderQuiz(); };
      bar2.appendChild(nx);
      card.appendChild(bar2);
    }
    v.appendChild(card);

    var bar3 = el('div', 'bar');
    var quit = el('button', 'btn ghost', '結束並看成績');
    quit.onclick = function () { finish(); };
    bar3.appendChild(quit);
    v.appendChild(bar3);
  }

  function answer(k) {
    var q = quiz.qs[quiz.i], m = curMeta();
    quiz.ans[quiz.i] = k;
    var good = k === q.a;
    if (good) quiz.ok++;
    var key = m.pid;
    var st = state.stats[key] || (state.stats[key] = { n: 0, ok: 0 });
    st.n++; if (good) st.ok++;
    var wi = -1;
    state.wrong.forEach(function (w, idx) { if (w.pid === m.pid && w.n === q.n) wi = idx; });
    if (good) { if (wi >= 0) state.wrong.splice(wi, 1); }
    else if (wi < 0) state.wrong.push({ pid: m.pid, n: q.n });
    save();
    renderQuiz();
  }

  function finish() {
    var done = quiz.ans.filter(function (x) { return x != null; }).length;
    var v = $('view-result'); v.innerHTML = '';
    var c = el('div', 'card');
    c.appendChild(el('h2', null, quiz.title));
    c.appendChild(el('div', 'big', done ? (pct(quiz.ok, done) + '%') : '—'));
    c.appendChild(el('p', 'muted',
      '作答 ' + done + ' 題，答對 ' + quiz.ok + ' 題，答錯 ' + (done - quiz.ok) + ' 題。' +
      (quiz.mode === 'paper' ? '（本卷共 ' + quiz.qs.length + ' 題）' : '')));
    v.appendChild(c);

    if (done) {
      var wrongList = [];
      quiz.ans.forEach(function (a, i) {
        if (a != null && a !== quiz.qs[i].a) wrongList.push({ i: i, q: quiz.qs[i], a: a });
      });
      if (wrongList.length) {
        var wc = el('div', 'card');
        wc.appendChild(el('h2', null, '答錯的題目（' + wrongList.length + '）'));
        var tb = el('table');
        var tr = el('tr');
        ['題', '你選', '正解'].forEach(function (h) { tr.appendChild(el('th', null, h)); });
        tb.appendChild(tr);
        wrongList.forEach(function (w) {
          var r = el('tr');
          r.appendChild(el('td', null, (quiz.mode === 'paper' ? '第 ' + w.q.n : '#' + (w.i + 1)) + ' 題'));
          r.appendChild(el('td', null, LAB[w.a]));
          r.appendChild(el('td', null, LAB[w.q.a]));
          tb.appendChild(r);
        });
        wc.appendChild(tb);
        wc.appendChild(el('p', 'muted', '答錯的題目已自動加入錯題本。'));
        v.appendChild(wc);
      }
    }
    var bar = el('div', 'bar');
    var again = el('button', 'btn primary', '再來一輪');
    again.onclick = function () {
      if (quiz.mode === 'paper') startPaper(quiz.pid);
      else if (quiz.mode === 'drill') startDrill(quiz.scope);
      else startWrong();
    };
    bar.appendChild(again);
    var home = el('button', 'btn ghost', '回首頁');
    home.onclick = function () { renderHome(); navStack = []; show('home', '考古英雄', false); };
    bar.appendChild(home);
    v.appendChild(bar);
    show('result', '成績');
  }

  /* ---------- 錯題本 ---------- */
  function renderWrong() {
    var v = $('view-wrong'); v.innerHTML = '';
    var c = el('div', 'card');
    c.appendChild(el('h2', null, '錯題本'));
    if (!state.wrong.length) {
      c.appendChild(el('p', 'muted', '目前沒有錯題。答錯的題目會自動收進這裡，答對之後就會移除。'));
      v.appendChild(c);
      return;
    }
    c.appendChild(el('p', 'muted', '共 ' + state.wrong.length + ' 題。答對一次就會自動移除。'));
    var b = el('button', 'btn primary', '開始複習錯題');
    b.onclick = startWrong;
    c.appendChild(b);
    var clr = el('button', 'btn ghost', '清空錯題本');
    clr.style.marginTop = '8px';
    clr.onclick = function () {
      if (confirm('確定要清空錯題本嗎？此動作無法復原。')) {
        state.wrong = []; save(); renderWrong(); renderHome();
      }
    };
    c.appendChild(clr);
    v.appendChild(c);

    var byPaper = {};
    state.wrong.forEach(function (w) { byPaper[w.pid] = (byPaper[w.pid] || 0) + 1; });
    var t = el('div', 'card');
    t.appendChild(el('h2', null, '錯題分布'));
    var tb = el('table');
    var tr = el('tr');
    ['卷別', '錯題數'].forEach(function (h) { tr.appendChild(el('th', null, h)); });
    tb.appendChild(tr);
    Object.keys(byPaper).sort().forEach(function (pid) {
      var e = EXAMS.filter(function (x) { return x.id === pid; })[0];
      var r = el('tr');
      r.appendChild(el('td', null, e ? e.label : pid));
      r.appendChild(el('td', 'num', String(byPaper[pid])));
      tb.appendChild(r);
    });
    t.appendChild(tb);
    v.appendChild(t);
  }

  /* ---------- 弱點統計 ---------- */
  function renderStats() {
    var v = $('view-stats'); v.innerHTML = '';
    var keys = Object.keys(state.stats);
    var c = el('div', 'card');
    c.appendChild(el('h2', null, '弱點統計'));
    if (!keys.length) {
      c.appendChild(el('p', 'muted', '還沒有作答紀錄，先去刷幾題吧。'));
      v.appendChild(c); return;
    }
    var tn = 0, tok = 0;
    keys.forEach(function (k) { tn += state.stats[k].n; tok += state.stats[k].ok; });
    c.appendChild(el('div', 'big', pct(tok, tn) + '%'));
    c.appendChild(el('p', 'muted', '累計作答 ' + tn + ' 題，答對 ' + tok + ' 題。'));
    v.appendChild(c);

    // 依科目
    var bySubj = { med1: { n: 0, ok: 0 }, med2: { n: 0, ok: 0 } };
    keys.forEach(function (k) {
      var e = EXAMS.filter(function (x) { return x.id === k; })[0];
      if (!e) return;
      bySubj[e.subj].n += state.stats[k].n;
      bySubj[e.subj].ok += state.stats[k].ok;
    });
    var cs = el('div', 'card');
    cs.appendChild(el('h2', null, '依科目'));
    var t1 = el('table');
    var h1 = el('tr');
    ['科目', '作答', '正確率'].forEach(function (h) { h1.appendChild(el('th', null, h)); });
    t1.appendChild(h1);
    ['med1', 'med2'].forEach(function (s) {
      var r = el('tr');
      r.appendChild(el('td', null, SUBJ[s]));
      r.appendChild(el('td', 'num', String(bySubj[s].n)));
      r.appendChild(el('td', 'num', bySubj[s].n ? pct(bySubj[s].ok, bySubj[s].n) + '%' : '—'));
      t1.appendChild(r);
    });
    cs.appendChild(t1);
    v.appendChild(cs);

    // 依卷別，正確率低的排前面
    var rows = keys.map(function (k) {
      var e = EXAMS.filter(function (x) { return x.id === k; })[0];
      return { label: e ? e.label : k, n: state.stats[k].n, ok: state.stats[k].ok };
    }).filter(function (r) { return r.n >= 1; })
      .sort(function (a, b) { return pct(a.ok, a.n) - pct(b.ok, b.n); });
    var cp = el('div', 'card');
    cp.appendChild(el('h2', null, '依卷別（正確率低的排前面）'));
    var t2 = el('table');
    var h2 = el('tr');
    ['卷別', '作答', '正確率'].forEach(function (h) { h2.appendChild(el('th', null, h)); });
    t2.appendChild(h2);
    rows.forEach(function (r) {
      var tr2 = el('tr');
      tr2.appendChild(el('td', null, r.label));
      tr2.appendChild(el('td', 'num', String(r.n)));
      tr2.appendChild(el('td', 'num', pct(r.ok, r.n) + '%'));
      t2.appendChild(tr2);
    });
    cp.appendChild(t2);
    v.appendChild(cp);

    var bar = el('div', 'bar');
    var clr = el('button', 'btn ghost', '清除所有作答紀錄');
    clr.onclick = function () {
      if (confirm('確定要清除所有作答紀錄與統計嗎？此動作無法復原。')) {
        state.stats = {}; state.seen = {}; save(); renderStats(); renderHome();
      }
    };
    bar.appendChild(clr);
    v.appendChild(bar);
  }

  /* ---------- 使用說明 ---------- */
  function renderInfo() {
    var v = $('view-info'); v.innerHTML = '';
    var c = el('div', 'card');
    c.appendChild(el('h2', null, '這個站是什麼'));
    c.appendChild(el('p', null,
      '考古英雄收錄醫師國考「分階段考試第一階段」的歷屆考古題，包含醫學（一）與醫學（二）兩科，' +
      '提供整卷測驗、無限刷題、錯題本與弱點統計。'));
    c.appendChild(el('p', 'muted',
      '試題與標準答案來自考選部「考畢試題查詢平臺」公開之考畢試題與測驗式試題標準答案（政府資訊公開資料）。' +
      '若標準答案有更正，本站以更正後的答案為準。'));
    v.appendChild(c);

    var c2 = el('div', 'card');
    c2.appendChild(el('h2', null, '資料存在哪裡'));
    c2.appendChild(el('p', null,
      '作答紀錄、錯題本與統計都存在你這台裝置的瀏覽器裡（localStorage），不會上傳。' +
      '換一台裝置或清除瀏覽器資料，紀錄就會不見。'));
    v.appendChild(c2);

    var c3 = el('div', 'card');
    c3.appendChild(el('h2', null, '版本紀錄'));
    (window.APP_VERSIONS || []).forEach(function (ver) {
      var h = el('p');
      h.appendChild(el('b', null, ver.v + '　' + ver.date));
      c3.appendChild(h);
      var ul = document.createElement('ul');
      ul.style.margin = '0 0 12px'; ul.style.paddingLeft = '20px';
      ver.items.forEach(function (it) {
        var li = document.createElement('li');
        li.className = 'muted'; li.textContent = it;
        ul.appendChild(li);
      });
      c3.appendChild(ul);
    });
    v.appendChild(c3);
  }

  /* ---------- 起動 ---------- */
  load();
  renderHome();
  show('home', '考古英雄', false);
  navStack = [{ name: 'home', title: '考古英雄' }];
})();
