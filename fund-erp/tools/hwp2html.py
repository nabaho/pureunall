# -*- coding: utf-8 -*-
"""HWP 5.0 → HTML 변환 (문단 + 표 격자 + 문단모양 복원)
   레코드 트리: TABLE(77) 아래 LIST_HEADER(72)마다 셀 좌표(col,row,colspan,rowspan),
   그 안의 PARA_TEXT(67)가 셀 내용. 레벨(level)로 표 안/밖을 구분한다.

   ── 문단모양(2026-09-12) ──
   원본에는 «가운데 맞춤·줄간격·칸 높이»가 다 들어 있는데 예전에는 하나도 안 읽었다.
   그래서 화면에 나온 서식이 원본과 딴판이었다(대표 지적). 이제 읽는다:
     · DocInfo 의 PARA_SHAPE(25) → 정렬(양쪽·왼쪽·오른쪽·가운데)·줄간격(%)
     · BodyText 의 PARA_HEADER(66) 8번째 바이트 → 그 문단이 쓰는 모양 번호
     · LIST_HEADER(72) 16~23 → 칸 너비·높이(HWPUNIT = 1/7200 인치, pt = 값/100)

   ⚠ 정렬은 «칸(td)·문단(p)» 에만 건다. 칸 안을 <div> 로 또 감싸면 서식을 채우는
     코드가 보는 「덩이」가 달라져 조용히 깨진다(2026-09-11 에 실제로 그랬다).
     한 칸에 정렬이 섞여 있으면 «맨 처음 글» 의 정렬을 칸 전체에 쓴다."""
import io, sys, os, zlib, struct, json, html
import olefile
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

T_PARA_HEADER = 66
T_PARA_TEXT   = 67
T_CTRL_HEADER = 71
T_LIST_HEADER = 72
T_TABLE       = 77
T_PARA_SHAPE  = 25          # DocInfo

# 정렬: PARA_SHAPE attribute1 의 2~4비트
ALIGN_CSS = {0: '', 1: 'left', 2: 'right', 3: 'center', 4: 'justify', 5: 'justify'}
HWPUNIT_PT = 100.0          # 1pt = 100 HWPUNIT (1/7200 인치)


def para_shapes(f, comp):
    """DocInfo → 문단모양 목록 [{align, ls}] (ls = 줄간격 %, 없으면 None)"""
    try:
        di = f.openstream('DocInfo').read()
    except Exception:
        return []
    if comp:
        try: di = zlib.decompress(di, -15)
        except Exception: return []
    out = []
    for tag, lvl, pay in records(di):
        if tag != T_PARA_SHAPE or len(pay) < 28:
            continue
        a1 = struct.unpack_from('<I', pay, 0)[0]
        align = ALIGN_CSS.get((a1 >> 2) & 0b111, '')
        lstype = a1 & 0b11
        ls = struct.unpack_from('<i', pay, 24)[0]          # 5.0.2.5 미만 자리
        if len(pay) >= 54:                                  # 5.0.2.5 이상은 끝에 다시 적힌다
            ls = struct.unpack_from('<I', pay, 50)[0]
        # 「글자에 따라(%)」일 때만 쓴다 — 고정값·여백만은 글꼴에 매여 옮길 수 없다
        out.append({'align': align, 'ls': ls if (lstype == 0 and 50 <= ls <= 400) else None})
    return out


def _style(align, ls, height=None):
    b = []
    if align: b.append('text-align:' + align)
    if ls:    b.append('line-height:%d%%' % ls)
    if height: b.append('height:%.1fpt' % height)
    return (' style="' + ';'.join(b) + '"') if b else ''

def records(data):
    i = 0
    while i < len(data) - 3:
        rec = struct.unpack_from('<I', data, i)[0]
        tag = rec & 0x3FF
        level = (rec >> 10) & 0x3FF
        size = (rec >> 20) & 0xFFF
        i += 4
        if size == 0xFFF:
            size = struct.unpack_from('<I', data, i)[0]; i += 4
        yield tag, level, data[i:i+size]
        i += size

def clean_text(payload):
    """PARA_TEXT 디코드 + 인라인 컨트롤 문자 제거"""
    s = payload.decode('utf-16-le', errors='ignore')
    out = []
    skip = 0
    for ch in s:
        if skip: skip -= 1; continue
        c = ord(ch)
        if c in (13, 10): out.append('\n')
        elif c == 9: out.append('\t')
        elif c < 32:
            # 확장 컨트롤(표/그림 등)은 8바이트=4문자 추가 점유
            if c in (1,2,3,11,12,14,15,16,17,18,21,22,23): skip = 7
            continue
        else: out.append(ch)
    return ''.join(out).strip()

def convert(path):
    f = olefile.OleFileIO(path)
    hdr = f.openstream('FileHeader').read()
    comp = bool(hdr[36] & 1)
    SHAPES = para_shapes(f, comp)
    secs = sorted([d for d in f.listdir() if d[0] == 'BodyText'], key=lambda x: x[1])
    blocks = []          # 최종 블록 목록: ('p', text, shape) | ('table', grid)
    pend = None          # 바로 다음 PARA_TEXT 가 쓸 문단모양
    for s in secs:
        data = f.openstream(s).read()
        if comp:
            try: data = zlib.decompress(data, -15)
            except Exception: continue
        tstack = []      # 열려있는 표 [{'rows','cols','cells':[..],'level':n}]
        cur_cell = None
        for tag, level, pay in records(data):
            # 표 종료: 표보다 얕은 레벨의 레코드가 나오면 닫는다
            # (LIST_HEADER·PARA_HEADER는 표와 같은 레벨이라 '<=' 쓰면 즉시 닫혀버림)
            # 단, 새 TABLE이 같은 레벨로 오면 앞 표를 먼저 닫아야 순서가 뒤집히지 않음
            while tstack:
                top = tstack[-1]['level']
                shut = (level <= top) if tag == T_TABLE else (level < top)
                if not shut: break
                fr = tstack.pop()
                # 중첩 표는 부모 셀 안으로 되돌려 넣는다(형제로 빼면 순서가 뒤집힘)
                if fr.get('pcell') is not None: fr['pcell']['text'].append(('table', fr))
                else: blocks.append(('table', fr))
                cur_cell = fr.get('pcell')
            if tag == T_TABLE and len(pay) >= 8:
                nR, nC = struct.unpack_from('<HH', pay, 4)
                tstack.append({'rows': nR, 'cols': nC, 'cells': [], 'level': level,
                               'pcell': cur_cell})   # 자신을 품은 부모 셀
                cur_cell = None
            elif tag == T_LIST_HEADER and tstack and len(pay) >= 24:
                # nParas(4) property(4) col(2) row(2) colspan(2) rowspan(2) width(4) height(4)
                col, row, cs, rs = struct.unpack_from('<HHHH', pay, 8)
                w, h = struct.unpack_from('<II', pay, 16)
                cur_cell = {'col': col, 'row': row, 'cs': max(1, cs), 'rs': max(1, rs),
                            'w': w, 'h': h, 'text': []}
                tstack[-1]['cells'].append(cur_cell)
            elif tag == T_PARA_HEADER and len(pay) >= 10:
                i = struct.unpack_from('<H', pay, 8)[0]
                pend = SHAPES[i] if i < len(SHAPES) else None
            elif tag == T_PARA_TEXT:
                t = clean_text(pay)
                sh, pend = pend, None            # 한 문단에 한 번만 쓴다
                if not t: continue
                if tstack and cur_cell is not None: cur_cell['text'].append((t, sh))
                elif not tstack: blocks.append(('p', t, sh))
        while tstack:
            fr = tstack.pop()
            if fr.get('pcell') is not None: fr['pcell']['text'].append(('table', fr))
            else: blocks.append(('table', fr))
    f.close()
    return blocks

def esc(t): return html.escape(t).replace('\n', '<br>')

def cell_html(cell):
    """셀 내용 = 문자열 + 중첩 표가 섞인 목록

    문단끼리는 항상 <br>로 나눈다. 중첩 표가 있으면 예전에는 전부 ''로 이어붙여
    '보 증 서 면위 신고하는 인감은…'처럼 제목과 본문이 한 덩어리가 됐다(인감신고서).
    표는 블록이라 구분자가 필요 없으므로, 글은 <br>로 잇고 표는 따로 붙인다.

    ⚠ 여기서 <div>·<span> 으로 감싸지 않는다 — 서식을 채우는 코드가 「한 덩이」를
      td 로 보는데, 한 겹을 더 끼우면 그 판단이 조용히 달라진다. 정렬은 td 에 건다."""
    out, buf = [], []

    def flush():
        if buf:
            out.append('<br>'.join(buf))
            del buf[:]

    for item in cell['text']:
        if isinstance(item, tuple) and item[0] == 'table':
            flush()
            out.append(render_table(item[1]))
        else:
            s, _sh = item if isinstance(item, tuple) else (item, None)
            s = str(s).strip()
            if s: buf.append(esc(s))
    flush()
    return ''.join(out)


def cell_shape(cell):
    """칸의 정렬·줄간격 — 맨 처음 «글이 든» 문단의 모양을 칸 전체에 쓴다"""
    for item in cell['text']:
        if isinstance(item, tuple) and item[0] == 'table':
            continue
        s, sh = item if isinstance(item, tuple) else (item, None)
        if str(s).strip() and sh:
            return sh
    return None

def render_table(v):
    # 1x1 표(제목 감싼 글상자/레이아웃용)는 내용만 펼침
    if v['rows'] == 1 and v['cols'] == 1:
        ps = []
        for c in v['cells']:
            h = cell_html(c)
            if h:
                sh = cell_shape(c) or {}
                ps.append('<p%s>%s</p>' % (_style(sh.get('align'), sh.get('ls')), h))
        return ''.join(ps)
    rows, cols = v['rows'], v['cols']
    return _grid_html(v, rows, cols)

def to_html(blocks):
    out = []
    for b in blocks:
        kind, v = b[0], b[1]
        if kind == 'p':
            t = v.strip()
            if not t: continue
            sh = (b[2] if len(b) > 2 else None) or {}
            out.append('<p%s>%s</p>' % (_style(sh.get('align'), sh.get('ls')), esc(t)))
        else:
            out.append(render_table(v))
    return '\n'.join(out)

def _grid_html(v, rows, cols):
    out = []
    if True:
        if True:
            grid = {}
            for c in v['cells']:
                grid[(c['row'], c['col'])] = c
            # ── 실제 칸 너비 복원: span=1 셀의 width(HWPUNIT)로 열 폭 산출 ──
            colw = [0] * cols
            for c in v['cells']:
                if c['cs'] == 1 and c['col'] < cols and c.get('w'):
                    colw[c['col']] = max(colw[c['col']], c['w'])
            # span 셀만 있는 열은 병합폭을 남은 열에 균등 배분
            for c in v['cells']:
                if c['cs'] > 1 and c.get('w'):
                    idx = [c['col'] + k for k in range(c['cs']) if c['col'] + k < cols]
                    known = sum(colw[k] for k in idx if colw[k])
                    blanks = [k for k in idx if not colw[k]]
                    if blanks and c['w'] > known:
                        share = (c['w'] - known) / len(blanks)
                        for k in blanks: colw[k] = share
            total = sum(colw)
            cg = ''
            if total > 0:
                cg = '<colgroup>' + ''.join(
                    '<col style="width:%.3f%%">' % (w / total * 100 if w else 100.0 / cols)
                    for w in colw) + '</colgroup>'
            covered = set()
            trs = []
            for r in range(rows):
                tds = []
                for c in range(cols):
                    if (r, c) in covered: continue
                    cell = grid.get((r, c))
                    if cell is None:
                        tds.append('<td></td>'); continue
                    for rr in range(cell['rs']):
                        for cc in range(cell['cs']):
                            if rr or cc: covered.add((r+rr, c+cc))
                    attr = ''
                    if cell['cs'] > 1: attr += ' colspan="%d"' % cell['cs']
                    if cell['rs'] > 1: attr += ' rowspan="%d"' % cell['rs']
                    # 칸 높이는 원본이 정한 «최소» 높이다 — 글이 길면 브라우저가 알아서 늘린다.
                    # 세로 병합 칸은 건너뛴다(합친 높이를 한 줄에 걸면 표가 밀린다).
                    sh = cell_shape(cell) or {}
                    ht = None
                    if cell.get('h') and cell['rs'] == 1:
                        pt = cell['h'] / HWPUNIT_PT
                        if 6 <= pt <= 400: ht = pt
                    attr += _style(sh.get('align'), sh.get('ls'), ht)
                    tds.append('<td%s>%s</td>' % (attr, cell_html(cell)))
                if tds: trs.append('<tr>' + ''.join(tds) + '</tr>')
            out.append('<table>' + cg + ''.join(trs) + '</table>')
    return '\n'.join(out)

if __name__ == '__main__':
    for p in sys.argv[1:]:
        blocks = convert(p)
        nt = sum(1 for b in blocks if b[0] == 'table')
        np_ = sum(1 for b in blocks if b[0] == 'p')
        print('=' * 70)
        print(os.path.basename(p), '→ 문단 %d, 표 %d' % (np_, nt))
        print('=' * 70)
        print(to_html(blocks)[:3000])
