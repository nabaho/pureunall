# -*- coding: utf-8 -*-
"""원본 .hwp 의 «모양»(가운데 맞춤·줄간격·칸 높이)만 fund_forms.js 에 얹는다.

   실행: python fund-erp/tools/restyle_forms.py          (미리보기만)
         python fund-erp/tools/restyle_forms.py --write  (실제로 쓴다)

   ⚠⚠ 왜 build_forms.py 를 그냥 다시 돌리지 않는가 (2026-09-12 에 실제로 겪은 일)
   지금 저장소에 있는 fund_forms.js 는 «남의 자료를 걷어낸» 판본이다. 생성기를 다시
   돌리면 걷어내기 규칙(SCRUB)이 못 잡는 것들이 통째로 되살아난다 — 실제로 돌려 보니
   남의 회사 상호·사업장 주소·기금 이름·담당자 실명·팩스번호·실제 금액과 날짜가
   24개 서식에서 되돌아왔다. 이 저장소는 통째로 github.io 로 공개된다. 그래서
   **글자는 한 자도 건드리지 않고 style 만** 옮긴다.

   어떻게 맞추는가: 두 글의 «태그 차례»를 difflib 로 맞춰 본 뒤, 서로 짝이 맞은
   자리의 <p>·<td> 에만 style 을 옮긴다. n번째끼리 그냥 세어 붙이면 안 된다 —
   지금 판본에는 <tbody> 와 빈 <p></p> 가 있고 새 변환본에는 없어서(판본이 만들어진
   때가 다르다) 한 칸씩 밀리고, 엉뚱한 칸이 가운데 정렬된다. 짝을 못 찾은 자리는
   그냥 둔다. 너무 많이 어긋나면 그 서식은 통째로 손대지 않는다.
"""
import io, sys, os, re, json, difflib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hwp2html import convert, to_html
from build_forms import FORMS
# ⚠ stdout 은 hwp2html 이 들어올 때 이미 utf-8 로 감쌌다. 여기서 또 감싸면
#   먼저 것이 치워지며 밑바탕이 닫혀 「I/O operation on closed file」로 죽는다.

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEST = os.path.join(REPO, 'fund_forms.js')
TAG = re.compile(r'<(/?)([A-Za-z][A-Za-z0-9]*)([^>]*)>')
STYLED = ('p', 'td')                      # 모양을 옮길 태그


def tags(h):
    """(닫힘?, 이름, 속성) 차례"""
    return [(m.group(1), m.group(2).lower(), m.group(3)) for m in TAG.finditer(h)]


def text_of(h):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h)).strip()


def shape_seq(h):
    """태그 차례 — 두 글을 맞춰 보는 잣대"""
    return [(c, n) for c, n, _ in tags(h)]


def pair_up(cur, fresh):
    """지금 판본의 태그 자리 → 새 변환본의 태그 자리. 짝이 맞은 것만 담는다."""
    a, b = shape_seq(cur), shape_seq(fresh)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    m = {}
    same = 0
    for i, j, n in sm.get_matching_blocks():
        for k in range(n):
            m[i + k] = j + k
        same += n
    ratio = same / max(1, len(a))
    return m, ratio, len(a), len(b)


def apply_styles(cur, fresh, pairs):
    """짝이 맞은 <p>·<td> 에만 style 을 얹는다. 글자는 한 자도 손대지 않는다."""
    ftags = tags(fresh)
    i = [0]
    n = [0]

    def repl(mo):
        k = i[0]; i[0] += 1
        close, name, attr = mo.group(1), mo.group(2).lower(), mo.group(3)
        if close or name not in STYLED:
            return mo.group(0)
        if re.search(r'\sstyle="', attr):                 # 이미 있으면 두 번 붙이지 않는다
            return mo.group(0)
        j = pairs.get(k)
        if j is None or j >= len(ftags):
            return mo.group(0)
        fc, fn, fa = ftags[j]
        if fc or fn != name:                              # 짝이 같은 종류가 아니면 건너뛴다
            return mo.group(0)
        st = re.search(r'\sstyle="([^"]*)"', fa)
        if not st:
            return mo.group(0)
        n[0] += 1
        return '<%s%s style="%s">' % (name, attr, st.group(1))

    return TAG.sub(repl, cur), n[0]


def load_forms(path):
    """지금 판본을 읽는다.
       ⚠ 끝에 쉼표가 하나 남아 있다(손으로 한 항목을 지운 자국). JS 는 봐주지만
         JSON 은 아니라 그대로 읽으면 깨진다. 읽을 때만 걷어낸다."""
    t = open(path, encoding='utf-8').read()
    t = t[t.index('{'):]
    t = re.sub(r',(\s*})', r'\1', t)
    return json.JSONDecoder().raw_decode(t)[0]


def main():
    write = '--write' in sys.argv
    forms = load_forms(DEST)
    print('=' * 78)
    done = skip = 0
    for key, label, path in FORMS:
        if key not in forms:
            continue                                      # 지금 판본에 없는 서식은 «더하지 않는다»
        if not os.path.exists(path):
            print('  %-20s %-24s · 원본 없음 — 그대로 둠' % (key, label)); skip += 1; continue
        try:
            fresh = to_html(convert(path))
        except Exception as e:
            print('  %-20s %-24s ✗ 변환실패 %s — 그대로 둠' % (key, label, e)); skip += 1; continue
        cur = forms[key]
        pairs, ratio, na, nb = pair_up(cur, fresh)
        # 너무 많이 어긋나면 딴 원본을 보고 있는 것이다 — 그럴 땐 손대지 않는다
        if ratio < 0.80:
            print('  %-20s %-24s ✗ 짜임이 너무 다름(맞은 자리 %.0f%%, 태그 %d vs %d) — 그대로 둠'
                  % (key, label, ratio * 100, na, nb)); skip += 1; continue
        new, cnt = apply_styles(cur, fresh, pairs)
        if text_of(new) != text_of(cur):                  # 있을 수 없는 일이지만 반드시 본다
            print('  %-20s %-24s ✗ 글자가 달라졌다 — 그대로 둠' % (key, label)); skip += 1; continue
        if not cnt:
            print('  %-20s %-24s · 옮길 모양이 없음 — 그대로 둠' % (key, label)); skip += 1; continue
        forms[key] = new
        print('  %-20s %-24s ✓ 모양 %4d자리 (정렬%-4d 줄간격%-4d 높이%-4d) 맞은 자리 %.0f%%'
              % (key, label, cnt, new.count('text-align:'), new.count('line-height:'),
                 len(re.findall(r'height:[\d.]+pt', new)), ratio * 100))
        done += 1
    print('=' * 78)
    print('모양을 얹은 서식 %d종 · 그대로 둔 서식 %d종' % (done, skip))
    if not write:
        print('\n※ 미리보기입니다. 실제로 쓰려면 --write 를 붙이세요.')
        return
    js = ('// 자동생성 — 원본 .hwp 변환 법정서식(빈 양식). 재생성: python fund-erp/tools/build_forms.py\n'
          '// 모양(정렬·줄간격·칸높이)만 다시 얹기: python fund-erp/tools/restyle_forms.py --write\n')
    js += 'window.HWP_FORMS = ' + json.dumps(forms, ensure_ascii=False, indent=0) + ';\n'
    open(DEST, 'w', encoding='utf-8').write(js)
    print('→ %s (%d bytes)' % (DEST, os.path.getsize(DEST)))


if __name__ == '__main__':
    main()
