#!/usr/bin/env python3
"""把考古英雄的題目＋自撰詳解打包成 Anki 牌組（.apkg）。

用法：
    python3 tools/build-anki.py <papers.json> <輸出.apkg> [--deck 牌組名稱] [--limit N] [--owner 授權對象]

papers.json 由 tools/export-json.js 產生。
需要 genanki（本機裝在 /tmp/ankienv，見 docs）。
"""
import sys, json, html, hashlib, argparse, random

try:
    import genanki
except ImportError:
    sys.exit("需要 genanki：python3 -m venv /tmp/ankienv && /tmp/ankienv/bin/pip install genanki\n"
             "然後用 /tmp/ankienv/bin/python 執行本腳本。")

LAB = ['A', 'B', 'C', 'D']

CSS = """
.card{
  font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;
  font-size:19px; line-height:1.85; text-align:left;
  color:#16202B; background:#F6F5F1; padding:4px 2px;
}
.nightMode .card, .card.nightMode{ color:#E7E8E4; background:#12181F; }
.tagline{
  font-family:ui-monospace,monospace; font-size:12px; letter-spacing:.08em;
  color:#A8332B; margin-bottom:10px;
}
.nightMode .tagline{ color:#E4796D; }
.q{ font-weight:500; margin-bottom:14px; }
.opts{ list-style:none; margin:0; padding:0; }
.opts li{ margin:6px 0 6px 0; padding-left:26px; text-indent:-26px; }
.k{ font-family:ui-monospace,monospace; font-weight:600; color:#6A7079; }
.nightMode .k{ color:#8E969F; }
hr#answer{ border:none; border-top:2px solid #16202B; margin:18px 0 14px; }
.nightMode hr#answer{ border-top-color:#E7E8E4; }
.ans{ font-family:"Noto Serif TC",serif; font-size:21px; font-weight:700; margin-bottom:12px; }
.exp{ font-size:17px; line-height:1.9; white-space:pre-wrap; }
.exp .ok{ color:#2C6E52; font-weight:600; }
.nightMode .exp .ok{ color:#6FB392; }
.exp .no{ color:#A8332B; }
.nightMode .exp .no{ color:#E4796D; }
.exp .src{ color:#6A7079; }
.nightMode .exp .src{ color:#8E969F; }
.foot{
  margin-top:18px; padding-top:10px; border-top:1px solid #DCD9D1;
  font-family:ui-monospace,monospace; font-size:11px; color:#6A7079;
}
.nightMode .foot{ border-top-color:#2C353F; color:#8E969F; }
"""

FRONT = """<div class="tagline">{{來源}}</div>
<div class="q">{{題目}}</div>
<ul class="opts">{{選項}}</ul>"""

BACK = """{{FrontSide}}
<hr id="answer">
<div class="ans">正解：{{正解}}</div>
<div class="exp">{{詳解}}</div>
<div class="foot">{{授權}}</div>"""


def esc(s):
    return html.escape(s or '', quote=False)


def paint_exp(exp):
    """把 ✅ / ❌ / 📚 開頭的行上色。"""
    out = []
    for line in (exp or '').split('\n'):
        cls = 'ok' if line.startswith('✅') else 'no' if line.startswith('❌') else 'src' if line.startswith('📚') else ''
        line = esc(line)
        out.append(f'<span class="{cls}">{line}</span>' if cls else line)
    return '<br>'.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--deck', default='考古英雄')
    ap.add_argument('--limit', type=int, default=0, help='每卷最多取幾題（0=全部）')
    ap.add_argument('--owner', default='', help='浮水印上的授權對象')
    a = ap.parse_args()

    data = json.load(open(a.src, encoding='utf-8'))
    seed = int(hashlib.md5(a.deck.encode()).hexdigest()[:8], 16)
    model = genanki.Model(
        seed | 1, '考古英雄 選擇題',
        fields=[{'name': n} for n in ('題目', '選項', '正解', '詳解', '來源', '授權')],
        templates=[{'name': '作答', 'qfmt': FRONT, 'afmt': BACK}],
        css=CSS)

    owner = f'本檔案授權給 {a.owner} 使用' if a.owner else '考古英雄 kaoguhero'
    footer = f'{owner} · 詳解為本站自撰，禁止轉載散布'

    decks, total = {}, 0
    for p in data['papers']:
        m = p['meta']
        sub = m.get('subjName') or m.get('subj') or ''
        name = f"{a.deck}::{m['roc']} 年::{sub}"
        if name not in decks:
            decks[name] = genanki.Deck(abs(hash(name)) % (10 ** 10), name)
        deck = decks[name]
        qs = [q for q in p['qs'] if q.get('exp')]
        if a.limit:
            qs = qs[:a.limit]
        for q in qs:
            opts = ''.join(
                f'<li><span class="k">({LAB[i]})</span> {esc(o)}</li>'
                for i, o in enumerate(q.get('o') or []))
            ans = LAB[q['a']] if isinstance(q.get('a'), int) and 0 <= q['a'] < 4 else '送分'
            src = f"{m['label']}　第 {q['n']} 題"
            deck.add_note(genanki.Note(
                model=model,
                fields=[esc(q['q']), opts, ans, paint_exp(q['exp']), esc(src), esc(footer)],
                tags=[f"民國{m['roc']}年", sub.replace(' ', ''), m['id']],
                guid=genanki.guid_for(m['id'], q['n'])))
            total += 1

    genanki.Package(list(decks.values())).write_to_file(a.dst)
    print(f'✅ {total} 張卡、{len(decks)} 個子牌組 → {a.dst}')


if __name__ == '__main__':
    main()
