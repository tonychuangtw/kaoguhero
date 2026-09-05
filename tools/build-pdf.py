#!/usr/bin/env python3
"""把考古英雄的題目＋自撰詳解排版成可列印的 PDF 講義（先產 HTML，再用 headless Chrome 印）。

用法：
    python3 tools/build-pdf.py <papers.json> <輸出.html> [--title 標題] [--limit N] [--owner 授權對象]
產出 HTML 後，用：
    <chrome-headless-shell> --headless --disable-gpu --no-sandbox \
        --print-to-pdf=<輸出.pdf> --no-pdf-header-footer file://<輸出.html>
"""
import sys, json, html, argparse

LAB = ['A', 'B', 'C', 'D']

HEAD = """<!doctype html><html lang="zh-Hant"><meta charset="utf-8">
<title>{title}</title>
<style>
@page{{ size:A4; margin:16mm 14mm 18mm; }}
*{{ box-sizing:border-box; }}
body{{
  font-family:"Noto Sans TC","Noto Sans CJK TC",sans-serif;
  font-size:10.5pt; line-height:1.75; color:#16202B; margin:0;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}}
h1{{ font-family:"Noto Serif TC","Noto Serif CJK TC",serif; font-size:26pt; margin:0 0 6pt; }}
.cover{{ page-break-after:always; padding-top:52mm; }}
.cover .kick{{ font-size:9pt; letter-spacing:.22em; color:#A8332B; margin-bottom:10pt; }}
.cover .dek{{ font-size:12pt; color:#3A4553; margin:10pt 0 26pt; max-width:120mm; }}
.cover dl{{ display:grid; grid-template-columns:26mm 1fr; gap:5pt 0; font-size:10pt; margin:0 0 26pt; }}
.cover dt{{ color:#6A7079; }} .cover dd{{ margin:0; }}
.cover .note{{ border-top:1pt solid #DCD9D1; padding-top:10pt; font-size:8.5pt; color:#6A7079; line-height:1.7; }}
h2{{
  font-family:"Noto Serif TC","Noto Serif CJK TC",serif; font-size:14pt;
  border-bottom:1.6pt solid #16202B; padding-bottom:4pt; margin:0 0 12pt;
  page-break-before:always; page-break-after:avoid;
}}
h2:first-of-type{{ page-break-before:avoid; }}
.item{{ page-break-inside:avoid; margin-bottom:13pt; padding-bottom:11pt; border-bottom:.6pt solid #E9E7E1; }}
.no{{ font-family:monospace; font-size:9pt; color:#A8332B; letter-spacing:.06em; }}
.q{{ font-weight:500; margin:2pt 0 6pt; }}
.opts{{ margin:0 0 8pt; padding:0; list-style:none; }}
.opts li{{ margin:2pt 0; padding-left:7mm; text-indent:-7mm; }}
.k{{ font-family:monospace; color:#6A7079; }}
.exp{{ background:#F6F5F1; border-left:2.4pt solid #A8332B; padding:7pt 9pt; font-size:9.8pt; line-height:1.8; }}
.exp div{{ margin:1.5pt 0; }}
.ok{{ color:#2C6E52; font-weight:600; }}
.no2{{ color:#8A2B24; }}
.src{{ color:#6A7079; }}
.wm{{ position:fixed; bottom:6mm; left:0; right:0; text-align:center;
     font-family:monospace; font-size:7.5pt; color:#B9B5AC; }}
</style>
<div class="wm">{owner}</div>
"""


def esc(s):
    return html.escape(s or '', quote=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--title', default='考古英雄 歷屆詳解')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--owner', default='考古英雄 kaoguhero')
    a = ap.parse_args()

    data = json.load(open(a.src, encoding='utf-8'))
    papers = data['papers']
    total = sum(len([q for q in p['qs'] if q.get('exp')][:a.limit or None]) for p in papers)
    owner = f'本檔案授權給 {a.owner} 使用 · 詳解為本站自撰，禁止轉載散布'

    out = [HEAD.format(title=esc(a.title), owner=esc(owner))]
    out.append(f'''<div class="cover">
<div class="kick">KAOGUHERO · 歷屆試題完整詳解</div>
<h1>{esc(a.title)}</h1>
<div class="dek">每一題都寫清楚「正解為什麼對」與「另外三個選項各自錯在哪」，並附條號、釋字或判決字號，方便回溯查證。</div>
<dl>
<dt>收錄卷數</dt><dd>{len(papers)} 卷</dd>
<dt>收錄題數</dt><dd>{total} 題</dd>
<dt>授權對象</dt><dd>{esc(a.owner)}</dd>
</dl>
<div class="note">
題目與標準答案取自考選部「考畢試題查詢平臺」公開之考畢試題與測驗式試題標準答案，屬政府資訊公開資料；
標準答案如有更正，本檔以更正後的答案為準。<br>
本檔案所有<strong>解析文字均為本站自行撰寫之原創著作</strong>，未取用任何第三方網站的詳解內容，
並受著作權法保護。未經授權不得重製、轉載、散布或作為商業利用。<br>
本檔僅供備考研究參考，不構成醫療診斷建議或個案法律意見；法規與實務見解可能變動，應以最新公告為準。
</div>
</div>''')

    for p in papers:
        m = p['meta']
        qs = [q for q in p['qs'] if q.get('exp')]
        if a.limit:
            qs = qs[:a.limit]
        if not qs:
            continue
        out.append(f'<h2>{esc(m["label"])}</h2>')
        for q in qs:
            ans = LAB[q['a']] if isinstance(q.get('a'), int) and 0 <= q['a'] < 4 else '送分'
            opts = ''.join(f'<li><span class="k">({LAB[i]})</span> {esc(o)}</li>'
                           for i, o in enumerate(q.get('o') or []))
            lines = []
            for line in (q['exp'] or '').split('\n'):
                cls = 'ok' if line.startswith('✅') else 'no2' if line.startswith('❌') else 'src' if line.startswith('📚') else ''
                lines.append(f'<div class="{cls}">{esc(line)}</div>')
            out.append(f'''<div class="item">
<div class="no">第 {q["n"]} 題　正解 ({ans})</div>
<div class="q">{esc(q["q"])}</div>
<ul class="opts">{opts}</ul>
<div class="exp">{''.join(lines)}</div>
</div>''')

    open(a.dst, 'w', encoding='utf-8').write('\n'.join(out))
    print(f'✅ {total} 題 → {a.dst}（再用 headless Chrome --print-to-pdf 轉成 PDF）')


if __name__ == '__main__':
    main()
