# -*- coding: utf-8 -*-
"""근로소득 간이세액표(소득세법 시행령 별표2) PDF → js/pu-simpletax.js
─────────────────────────────────────────────────────────────────────
왜: 국세청은 간이세액표를 **API 로 주지 않는다**(공공데이터포털은 한글 파일 1개,
    국세청 오픈API 에는 없음 — 2026-10-03 확인). 법제처 법령 API 는 별표2 를
    찾아 **PDF 링크와 공포일자**만 준다. 그래서 표가 바뀔 때 한 번 이 스크립트로
    PDF 를 숫자표로 바꿔 앱에 내장한다. 표는 1~2년에 한 번 바뀐다.

어디서 받나(법제처 법령 API — 뉴스 브리핑이 쓰는 그 창구):
  https://www.law.go.kr/DRF/lawSearch.do?OC=test&target=licbyl&type=XML&search=1&query=근로소득간이세액표
  → <별표서식PDF파일링크> 를 https://www.law.go.kr 뒤에 붙여 내려받는다.

쓰는 법:
  python engine/build_simpletax_pdf.py <별표2.pdf> --시행 2026-03-01
  · 시행일은 PDF 에 적혀 있지 않다(개정일만 있다) → 부칙을 보고 **사람이 넣는다**.
    추정하지 않는다: 시행일이 틀리면 엉뚱한 달에 엉뚱한 표가 쓰인다.
  · 같은 시행일 표가 있으면 바꿔 끼우고, 다른 시행일 표는 그대로 둔다
    (지난 달 급여는 그때 표로 계산해야 하므로 옛 표를 지우지 않는다).

PDF 에서 그대로 읽는 것(손으로 옮겨 적지 않는다):
  개정일 · 월급여 구간별 가족 1~11명 세액 · 1,000만원 줄 · 1,000만원 초과 산식 ·
  8세 이상 20세 이하 자녀 공제액
읽은 뒤 검사: 구간이 끊김 없이 이어지는가 · 가족이 늘면 세액이 줄거나 같은가 ·
  급여가 늘면 세액이 늘거나 같은가. 하나라도 어긋나면 파일을 쓰지 않는다.
"""
import json
import os
import re
import sys

NL = chr(10)
HERE = os.path.dirname(os.path.abspath(__file__))
JS = os.path.join(HERE, '..', 'js', 'pu-simpletax.js')
OPEN, CLOSE = '/*TABLES>*/', '/*<TABLES*/'


def n(x):
    return 0 if x == '-' else int(x.replace(',', ''))


def read_pdf(path):
    import fitz  # PyMuPDF
    d = fitz.open(path)
    first = d[0].get_text().replace(NL, '')
    m = re.search(r'<\s*개정\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*>', first)
    if not m:
        raise SystemExit('개정일을 못 읽었습니다 — 별표2 PDF 가 맞는지 확인하세요')
    개정 = '%s-%02d-%02d' % (m.group(1), int(m.group(2)), int(m.group(3)))

    one = re.search(r'자녀가1명인경우:\s*([\d,]+)원', first)
    two = re.search(r'자녀가2명인경우:\s*([\d,]+)원', first)
    ext = re.search(r'초과자녀1명당\s*([\d,]+)원', first)
    if not (one and two and ext):
        raise SystemExit('자녀 공제액을 못 읽었습니다 — 별표 3호 문구가 바뀌었는지 확인하세요')
    자녀공제 = {'one': n(one.group(1)), 'two': n(two.group(1)), 'extra': n(ext.group(1))}

    toks, tail = [], ''
    for p in range(len(d)):
        t = d[p].get_text()
        i = t.find('공제대상가족의수' + NL + '1' + NL)
        if i < 0:
            continue
        lines = [x.strip() for x in t[i:].split(NL)][1:]
        if lines[:11] != [str(k) for k in range(1, 12)]:
            raise SystemExit('%d쪽 머리글 모양이 다릅니다: %r' % (p + 1, lines[:12]))
        lines = lines[11:]
        if lines[:2] == ['이상', '미만']:
            lines = lines[2:]
        body = NL.join(lines)
        j = body.find('10,000천원')
        if j >= 0:
            tail, body = body[j:], body[:j]
        toks += [x for x in body.split(NL) if x.strip()]

    bad = [x for x in toks if not re.fullmatch(r'[\d,]+|-', x)]
    if bad:
        raise SystemExit('표 안에 숫자가 아닌 글자가 있습니다: %r' % bad[:5])
    if len(toks) % 13:
        raise SystemExit('한 줄 13칸(이상·미만·가족 11명)으로 나눠지지 않습니다: %d칸' % len(toks))
    vals = [n(x) for x in toks]
    rows = []
    for k in range(0, len(vals), 13):
        c = vals[k:k + 13]
        rows.append({'min': c[0] * 1000, 'max': c[1] * 1000, 'tax': c[2:]})

    if '10,000천원초과' not in tail:
        raise SystemExit('1,000만원 초과 산식을 못 찾았습니다')
    head, rest = tail.split('10,000천원초과', 1)
    기준세액 = [n(x) for x in re.findall(r'[\d,]+', head.replace('10,000천원', ''))][:11]
    if len(기준세액) != 11:
        raise SystemExit('1,000만원 줄 세액이 11칸이 아닙니다: %r' % 기준세액)

    flat = ('10,000천원초과' + rest).replace(NL, '')
    segs = re.split(r'(?<![\d,])(?=[\d,]+천원초과)', flat)
    구간 = []
    for s in segs:
        hm = re.match(r'([\d,]+)천원초과(?:([\d,]+)천원이하)?', s)
        if not hm:
            continue
        rate = re.search(r'의(\d+)%\s*상당액', s)
        if not rate:
            raise SystemExit('세율을 못 읽었습니다: %s' % s[:80])
        mul = re.search(r'에(\d+)%를곱한', s)
        adds = [n(x) for x in re.findall(r'\(([\d,]+)원\)', s)]
        구간.append({
            '초과': n(hm.group(1)) * 1000,
            '이하': (n(hm.group(2)) * 1000) if hm.group(2) else None,
            '가산': sum(adds),
            '율': int(rate.group(1)) / 100,
            '곱': (int(mul.group(1)) / 100) if mul else 1,
        })
    if not 구간 or 구간[-1]['이하'] is not None:
        raise SystemExit('초과 산식 마지막 구간에 상한이 있으면 안 됩니다')
    # 구간이 1,000만원에서 시작해 끊김 없이 이어지는가 — 숫자 쪼개기를 잘못하면
    # 「0원 초과」 같은 구간이 생겨 고액 급여 세금이 엉뚱해진다(실제로 한 번 겪음).
    if 구간[0]['초과'] != 10000000 or any(a['이하'] != b['초과'] for a, b in zip(구간, 구간[1:])):
        raise SystemExit('초과 산식 구간이 1,000만원부터 이어지지 않습니다: %r' % 구간)
    return 개정, 자녀공제, rows, 기준세액, 구간


def check(rows, 기준세액):
    errs = []
    for a, b in zip(rows, rows[1:]):
        if a['max'] != b['min']:
            errs.append('구간 끊김 %s→%s' % (a['max'], b['min']))
        if any(b['tax'][i] < a['tax'][i] for i in range(11)):
            errs.append('급여가 늘었는데 세액이 줄어듦 %s' % b['min'])
    for r in rows:
        if any(r['tax'][i] < r['tax'][i + 1] for i in range(10)):
            errs.append('가족이 늘었는데 세액이 늘어남 %s' % r['min'])
    if rows[-1]['max'] != 10000000:
        errs.append('표 끝이 1,000만원이 아닙니다: %s' % rows[-1]['max'])
    if any(기준세액[i] < rows[-1]['tax'][i] for i in range(11)):
        errs.append('1,000만원 줄이 바로 앞 구간보다 작습니다')
    return errs


def load_tables():
    if not os.path.exists(JS):
        return []
    s = open(JS, encoding='utf-8').read()
    a, b = s.find(OPEN), s.find(CLOSE)
    return json.loads(s[a + len(OPEN):b]) if a >= 0 and b > a else []


def write_js(tables):
    tables = sorted(tables, key=lambda t: t['시행'])
    body = '[' + NL + (',' + NL).join(
        '{' + ','.join('"%s":%s' % (k, json.dumps(t[k], ensure_ascii=False))
                       for k in t if k != 'rows') +
        ',"rows":[' + NL + (',' + NL).join(json.dumps(r, separators=(',', ':')) for r in t['rows']) + NL + ']}'
        for t in tables) + NL + ']'
    out = (
        '/* 근로소득 간이세액표 — 소득세법 시행령 [별표2] 를 그대로 숫자로 옮긴 것.' + NL +
        '   ⚠ 손으로 고치지 마세요. 자동 생성: python engine/build_simpletax_pdf.py <별표2.pdf> --시행 YYYY-MM-DD' + NL +
        '   원본: 법제처 법령 API(licbyl) 의 별표2 PDF. 세액 산식은 비공개라 **표 자체가 법적 기준**이다.' + NL +
        '   표마다 「시행」일이 있고, 급여 달에 맞는 표를 PuLaborCore.pickSimpleTaxTable 이 고른다.' + NL +
        '   개인정보 없음(공개 법령 표). */' + NL +
        '(function (root) {' + NL +
        '  var TABLES = ' + OPEN + body + CLOSE + ';' + NL +
        '  var api = { tables: TABLES };' + NL +
        "  if (typeof module !== 'undefined' && module.exports) module.exports = api;" + NL +
        '  else root.PuSimpleTax = api;' + NL +
        "})(typeof window !== 'undefined' ? window : this);" + NL)
    open(JS, 'w', encoding='utf-8', newline=NL).write(out)


def main():
    args = sys.argv[1:]
    if not args or '--시행' not in args:
        raise SystemExit('사용법: python engine/build_simpletax_pdf.py <별표2.pdf> --시행 YYYY-MM-DD')
    pdf = args[0]
    시행 = args[args.index('--시행') + 1]
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', 시행):
        raise SystemExit('시행일은 YYYY-MM-DD 로 넣으세요')
    개정, 자녀공제, rows, 기준세액, 구간 = read_pdf(pdf)
    errs = check(rows, 기준세액)
    if errs:
        raise SystemExit('표 검사 실패 — 파일을 쓰지 않습니다:' + NL + NL.join(errs[:10]))
    t = {
        '연도': 시행[:4], '시행': 시행, '개정': 개정,
        '근거': '소득세법 시행령 [별표2] 근로소득 간이세액표 <개정 %s>' % 개정,
        '자녀공제': 자녀공제,
        '초과': {'기준': 10000000, '기준세액': 기준세액, '구간': 구간},
        '구간수': len(rows), '가족칸': 11,
        'rows': rows,
    }
    tables = [x for x in load_tables() if x['시행'] != 시행] + [t]
    write_js(tables)
    print('만들었습니다: js/pu-simpletax.js')
    print('  개정 %s · 시행 %s · 구간 %d개 · %s~%s원 · 자녀공제 %r' % (
        개정, 시행, len(rows), format(rows[0]['min'], ','), format(rows[-1]['max'], ','), 자녀공제))
    print('  1,000만원 초과 산식 %d구간' % len(구간))
    print('  담긴 표: ' + ', '.join(x['시행'] for x in sorted(tables, key=lambda x: x['시행'])))
    print('다음: payroll-os.html 의 pu-simpletax.js ?v= 를 올리고 tests/labor-core.test.js 를 돌리세요.')


if __name__ == '__main__':
    main()
