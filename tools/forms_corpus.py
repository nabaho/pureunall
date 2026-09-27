# -*- coding: utf-8 -*-
"""전 디스크 서식 후보 수집 → _forms_out/corpus.jsonl

실행: python tools/forms_corpus.py ["스캔루트"]
  · HWP 5.0을 hwp2html.py로 변환(표 격자·열 너비 보존)해 한 줄당 1파일로 쌓는다.
  · hwp2html이 못 읽는 옛 형식(HWP 3.0 등)은 kordoc으로 한 번 더 읽는다(rec['via']='kordoc').
  · 이어하기 지원 — 이미 corpus.jsonl에 있는 경로는 건너뛴다.
※ 원본 .hwp도 corpus.jsonl도 저장소에 커밋하지 않는다(_forms_out/은 gitignore).
"""
import io, os, re, sys, json, time, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'fund-erp', 'tools'))
from hwp2html import convert, to_html, esc    # stdout을 utf-8로 이미 감싼다

# 옛 한글(HWP 3.0) 대체 경로 — Phase 0에서 90건이 NotOleFileError로 빠졌고 kordoc이 84건을 읽었다.
# 판을 못 박는다(새 판이 나와도 동작이 조용히 바뀌지 않게). OCR은 켜지 않는다 — 켜면 모델을 내려받는다.
KORDOC_PKG = 'kordoc@4.12.0'

DEFAULT_ROOT = r"C:\Users\fair0\OneDrive\바탕 화면"
OUT_DIR = os.path.abspath(os.path.join(HERE, '..', '_forms_out'))
OUT = os.path.join(OUT_DIR, 'corpus.jsonl')

TX = json.load(io.open(os.path.join(HERE, 'forms_taxonomy.json'), encoding='utf-8'))
# 프리필터 = 전 트랙 정규식의 합집합. 세부 분류는 Node(forms_lib.js)가 한다.
RELEVANT = re.compile('|'.join('(?:%s)' % t['re'] for t in TX['tracks']))


def kordoc_to_html(blocks):
    """kordoc 블록 → hwp2html과 같은 모양 HTML(<p> · <table><tr><td colspan rowspan>).
    kordoc의 표 cells는 rows×cols 전체 격자이고 병합에 가려진 자리에도 칸이 있으므로,
    kordoc 자신의 tableToHtml처럼 병합 범위를 세어 건너뛴다."""
    out = []
    for b in blocks or []:
        t = b.get('type')
        if t == 'table':
            tb = b.get('table') or {}
            cells = tb.get('cells') or []
            rows = tb.get('rows') or len(cells)
            cols = tb.get('cols') or max([len(r) for r in cells] or [0])
            skip, trs = set(), []
            for r in range(rows):
                tds = []
                for c in range(cols):
                    if (r, c) in skip: continue
                    row = cells[r] if r < len(cells) else []
                    cell = row[c] if c < len(row) else None
                    if not cell: continue
                    rs, cs = int(cell.get('rowSpan') or 1), int(cell.get('colSpan') or 1)
                    for dr in range(rs):
                        for dc in range(cs):
                            if dr or dc: skip.add((r + dr, c + dc))
                    attr = (' colspan="%d"' % cs if cs > 1 else '') + (' rowspan="%d"' % rs if rs > 1 else '')
                    tds.append('<td%s>%s</td>' % (attr, esc(cell.get('text') or '')))
                if tds: trs.append('<tr>' + ''.join(tds) + '</tr>')
            if trs: out.append('<table>' + ''.join(trs) + '</table>')
        elif isinstance(b.get('text'), str) and b['text'].strip():
            out.append('<p>' + esc(b['text'].strip()) + '</p>')
    return '\n'.join(out)


def kordoc_convert(path):
    """kordoc CLI로 읽어 HTML로. 실패하면 kordoc의 오류 코드를 담아 던진다."""
    env = dict(os.environ, KORDOC_OFFLINE='1')
    npx = 'npx.cmd' if os.name == 'nt' else 'npx'
    r = subprocess.run([npx, '-y', KORDOC_PKG, path, '--format', 'json', '--silent'],
                       capture_output=True, env=env, timeout=180)
    raw = r.stdout.decode('utf-8', 'replace')
    at = raw.find('{')
    if at < 0: raise RuntimeError('kordoc: 출력 없음 (exit %s)' % r.returncode)
    doc = json.loads(raw[at:])
    if not doc.get('success'): raise RuntimeError('kordoc: %s' % (doc.get('code') or 'FAIL'))
    html = kordoc_to_html(doc.get('blocks'))
    if not html: raise RuntimeError('kordoc: 빈 본문')
    return html


def walk(root):
    """OneDrive 폴더는 재분석 지점(reparse point)이 섞여 있어 os.scandir로 직접 훑으면
    디렉터리 판별이 어긋날 수 있다. os.walk는 내부적으로 이를 감내하므로 직접 스캔
    대신 os.walk로 순회한다."""
    for dirpath, dirnames, filenames in os.walk(root):
        for n in filenames:
            if os.path.splitext(n)[1].lower() == '.hwp':
                yield os.path.join(dirpath, n)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ROOT
    if not os.path.isdir(root):
        print('스캔 루트가 없습니다: %s' % root); return 1
    os.makedirs(OUT_DIR, exist_ok=True)

    # err가 없는(성공한) 레코드만 건너뛴다. err가 있는 레코드는 다음 실행에서 다시
    # 시도한다 — 진짜 HWP가 아닌 파일은 매번 다시 실패할 뿐이지만, 파일이 잠겨
    # 있어서 등 일시적으로 실패한 건은 재시도할 기회를 줘야 한다.
    done = set()
    if os.path.exists(OUT):
        with io.open(OUT, encoding='utf-8') as f:
            for line in f:
                try:
                    rec = json.loads(line)
                    if rec.get('err') is None:
                        done.add(rec['rel'])
                except Exception: pass
        print('이어하기: 기존 %d건 건너뜀' % len(done))

    targets = []
    for p in walk(root):
        rel = os.path.relpath(p, root).replace('\\', '/')
        if RELEVANT.search(rel) and rel not in done:
            targets.append((p, rel))
    print('변환 대상 %d건' % len(targets))

    ok = err = 0
    t0 = time.time()
    with io.open(OUT, 'a', encoding='utf-8') as out:
        for i, (p, rel) in enumerate(targets, 1):
            rec = {'rel': rel, 'abs': p, 'mtime': 0, 'size': 0, 'html': '', 'err': None}
            try:
                st = os.stat(p)
                rec['mtime'] = int(st.st_mtime * 1000)
                rec['size'] = st.st_size
                try:
                    rec['html'] = to_html(convert(p))
                except Exception as first:
                    try:
                        rec['html'] = kordoc_convert(p)
                        rec['via'] = 'kordoc'
                    except Exception as second:
                        raise RuntimeError('%s: %s / %s' % (type(first).__name__, first, second))
                ok += 1
            except Exception as e:
                rec['err'] = '%s: %s' % (type(e).__name__, e)
                err += 1
            out.write(json.dumps(rec, ensure_ascii=False) + '\n')
            if i % 100 == 0:
                out.flush()
                print('  %d/%d  성공 %d  실패 %d  (%.0fs)' % (i, len(targets), ok, err, time.time() - t0))
    print('완료 — 성공 %d / 실패 %d → %s' % (ok, err, OUT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
