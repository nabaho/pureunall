// HWP 5.0 (바이너리) 문서 읽기 — 한컴 공개 문서 'HWP 5.0 파일 형식'을 바탕으로 작성
// 결과는 hwpx.js 와 같은 문서 모델 { page, header, footer, pageNum, blocks, skipped }
(function (g) {
  const H = g.PureunHwpx;
  const MM = H.MM;
  const ENDOFCHAIN = 0xfffffffa; // 이 값 이상은 사슬 끝/빈 섹터

  // ---------------- 복합 파일(CFB) ----------------
  function readCfb(buffer) {
    const b = new Uint8Array(buffer), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (!SIG.every((x, i) => b[i] === x)) throw new Error('HWP 문서 형식이 아닙니다.');
    const secSize = 1 << v.getUint16(30, true), miniSize = 1 << v.getUint16(32, true);
    const numFat = v.getUint32(44, true), dirStart = v.getUint32(48, true), miniCutoff = v.getUint32(56, true);
    const miniFatStart = v.getUint32(60, true), difatStart = v.getUint32(68, true);
    const off = s => (s + 1) * secSize;
    const fatSecs = [];
    for (let i = 0; i < 109 && fatSecs.length < numFat; i++) { const s = v.getUint32(76 + i * 4, true); if (s < ENDOFCHAIN) fatSecs.push(s); }
    for (let d = difatStart, guard = 0; fatSecs.length < numFat && d < ENDOFCHAIN && guard < 100000; guard++) {
      const n = secSize / 4 - 1;
      for (let i = 0; i < n && fatSecs.length < numFat; i++) { const s = v.getUint32(off(d) + i * 4, true); if (s < ENDOFCHAIN) fatSecs.push(s); }
      d = v.getUint32(off(d) + n * 4, true);
    }
    const per = secSize / 4, fat = new Uint32Array(fatSecs.length * per);
    fatSecs.forEach((s, i) => { for (let j = 0; j < per; j++) fat[i * per + j] = v.getUint32(off(s) + j * 4, true); });
    const chain = (start, table) => { const out = []; for (let s = start, guard = 0; s < ENDOFCHAIN && s < table.length && guard < 10000000; guard++) { out.push(s); s = table[s]; } return out; };
    const readBig = start => {
      const secs = chain(start, fat), out = new Uint8Array(secs.length * secSize);
      secs.forEach((s, i) => out.set(b.subarray(off(s), off(s) + secSize), i * secSize));
      return out;
    };
    const dir = readBig(dirStart), dv = new DataView(dir.buffer);
    const entries = [];
    for (let p = 0; p + 128 <= dir.length; p += 128) {
      const nameLen = dv.getUint16(p + 64, true);
      let name = '';
      for (let i = 0; i < Math.max(0, nameLen / 2 - 1); i++) name += String.fromCharCode(dv.getUint16(p + i * 2, true));
      entries.push({ name, type: dir[p + 66], left: dv.getUint32(p + 68, true), right: dv.getUint32(p + 72, true), child: dv.getUint32(p + 76, true), start: dv.getUint32(p + 116, true), size: dv.getUint32(p + 120, true) });
    }
    const root = entries[0];
    const miniStream = root && root.start < ENDOFCHAIN ? readBig(root.start) : new Uint8Array(0);
    const miniFatBytes = miniFatStart < ENDOFCHAIN ? readBig(miniFatStart) : new Uint8Array(0);
    const mfv = new DataView(miniFatBytes.buffer), miniFat = new Uint32Array(miniFatBytes.length / 4);
    for (let i = 0; i < miniFat.length; i++) miniFat[i] = mfv.getUint32(i * 4, true);
    const readStream = e => {
      if (e.size < miniCutoff) {
        const secs = chain(e.start, miniFat), out = new Uint8Array(secs.length * miniSize);
        secs.forEach((s, i) => out.set(miniStream.subarray(s * miniSize, (s + 1) * miniSize), i * miniSize));
        return out.subarray(0, e.size);
      }
      return readBig(e.start).subarray(0, e.size);
    };
    const files = {};
    const walk = (idx, prefix, seen) => {
      if (idx >= entries.length || seen.has(idx)) return;
      seen.add(idx);
      const e = entries[idx];
      walk(e.left, prefix, seen);
      walk(e.right, prefix, seen);
      if (e.type === 2) files[prefix + e.name] = readStream(e);
      else if (e.type === 1) walk(e.child, prefix + e.name + '/', seen);
    };
    if (root) walk(root.child, '', new Set());
    return files;
  }

  // 압축 해제 — HWP 스트림은 압축 끝 뒤에 채움 바이트가 붙는 경우가 있어, 그때까지 풀린 내용을 사용
  async function inflate(data) {
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter();
    w.write(data).catch(() => {});
    w.close().catch(() => {});
    const reader = ds.readable.getReader(), chunks = [];
    let total = 0;
    try {
      for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); total += value.length; }
    } catch (e) { if (!total) throw e; }
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  // ---------------- 레코드 ----------------
  function records(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = [];
    let p = 0;
    while (p + 4 <= bytes.length) {
      const h = v.getUint32(p, true);
      p += 4;
      let size = (h >>> 20) & 0xfff;
      if (size === 0xfff) { size = v.getUint32(p, true); p += 4; }
      out.push({ tag: h & 0x3ff, level: (h >>> 10) & 0x3ff, data: bytes.subarray(p, p + size), children: [] });
      p += size;
    }
    return out;
  }
  function tree(list) {
    const root = { level: -1, children: [] }, stack = [root];
    for (const r of list) {
      while (stack.length > 1 && stack[stack.length - 1].level >= r.level) stack.pop();
      stack[stack.length - 1].children.push(r);
      stack.push(r);
    }
    return root.children;
  }
  const dvOf = d => new DataView(d.buffer, d.byteOffset, d.byteLength);
  const u16 = (d, o) => (o + 2 <= d.length ? dvOf(d).getUint16(o, true) : 0);
  const i16 = (d, o) => (o + 2 <= d.length ? dvOf(d).getInt16(o, true) : 0);
  const u32 = (d, o) => (o + 4 <= d.length ? dvOf(d).getUint32(o, true) : 0);
  const i32 = (d, o) => (o + 4 <= d.length ? dvOf(d).getInt32(o, true) : 0);

  // 개체 공통 속성(표·그리기 개체의 컨트롤 머리 자료): 글자처럼 취급·기준·정렬·거리·배치 방식
  const VREL = ['PAPER', 'PAGE', 'PARA'], HREL = ['PAPER', 'PAGE', 'COLUMN', 'PARA'];
  const VALIGN = ['TOP', 'CENTER', 'BOTTOM', 'INSIDE', 'OUTSIDE'], HALIGN = ['LEFT', 'CENTER', 'RIGHT', 'INSIDE', 'OUTSIDE'];
  const WRAP = ['SQUARE', 'TOP_AND_BOTTOM', 'BEHIND_TEXT', 'IN_FRONT_OF_TEXT'];
  function objPlace(d) {
    const at = u32(d, 4);
    return {
      inline: !!(at & 1), affect: !!(at & 4), vertRelTo: VREL[(at >> 3) & 3] || 'PARA', vertAlign: VALIGN[(at >> 5) & 7] || 'TOP',
      horzRelTo: HREL[(at >> 8) & 3] || 'COLUMN', horzAlign: HALIGN[(at >> 10) & 7] || 'LEFT', flow: !!(at & 0x2000), overlap: !!(at & 0x4000),
      wrap: WRAP[(at >> 21) & 7] || 'TOP_AND_BOTTOM', vertOffset: i32(d, 8), horzOffset: i32(d, 12), zOrder: i32(d, 24),
      out: { l: u16(d, 28), r: u16(d, 30), t: u16(d, 32), b: u16(d, 34) },
    };
  }
  const i8 = (d, o) => (o < d.length ? (d[o] << 24) >> 24 : 0);
  function wstr(d, o) { const n = u16(d, o); let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(u16(d, o + 2 + i * 2)); return { s, end: o + 2 + n * 2 }; }
  const ctrlName = id => String.fromCharCode((id >>> 24) & 255, (id >>> 16) & 255, (id >>> 8) & 255, id & 255);
  const colorHex = c => '#' + [c & 255, (c >>> 8) & 255, (c >>> 16) & 255].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();

  const T = { DOC_PROPS: 16, ID_MAPPINGS: 17, BIN_DATA: 18, FACE_NAME: 19, BORDER_FILL: 20, CHAR_SHAPE: 21, NUMBERING: 23, BULLET: 24, PARA_SHAPE: 25, STYLE: 26,
    PARA_HEADER: 66, PARA_TEXT: 67, PARA_CHAR_SHAPE: 68, CTRL_HEADER: 71, LIST_HEADER: 72, PAGE_DEF: 73, SHAPE_COMPONENT: 76, TABLE: 77, SHAPE_PICTURE: 85 };
  const EXTENDED = new Set([1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23]);
  const INLINE = new Set([4, 5, 6, 7, 8, 9, 19, 20]);

  // 필드 컨트롤 → 한글 HWPX 의 fieldBegin (서식 392개를 한글이 HWPX 로 저장한 결과와 대조해 맞춘 값)
  //  자료: 속성 u32 @4 · 추가 속성(Prop) u8 @8 · 명령 문자열 @9 · 필드 번호 u32. fieldid = 컨트롤 ID 값
  const FIELD_TYPES = { '%dte': 'DATE', '%ddt': 'DOC_DATE', '%usr': 'USER_INFO', '%fmu': 'FORMULA', '%bmk': 'BOOKMARK' };
  // 날짜 명령의 형식 기호 → DateFormat. 확인한 기호만 (모르는 기호가 있으면 필드로 만들지 않고 글자만 둠)
  function dateFormat(cmd) {
    const s = cmd.replace(/^\\?:/, '').split(';')[0];
    const MAP = { '~6': 'G', 1: 'YYYY', '!': 'YY', 2: 'M', 3: 'D', '*': 'MMMMMMMMM', 6: 'E' };
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const two = s.slice(i, i + 2);
      if (MAP[two]) { out += MAP[two]; i++; continue; }
      if (MAP[s[i]]) { out += MAP[s[i]]; continue; }
      if (/[0-9!@#$%^&*~]/.test(s[i])) return null;
      out += s[i];
    }
    return out;
  }
  function fieldNode(name, ctrl) {
    const d = ctrl.data, attr = u32(d, 4), cmd = wstr(d, 9), type = FIELD_TYPES[name];
    const P = (k, n, v) => Object.assign({ tag: 'hp:' + k + 'Param', attrs: { name: n }, kids: [] }, v === '' ? null : { txt: String(v) });
    const params = [P('integer', 'Prop', d[8]), P('string', 'Command', cmd.s)];
    let fname = '';
    if (type === 'DATE' || type === 'DOC_DATE') {
      const f = dateFormat(cmd.s);
      if (f === null) return null;
      params.push(P('string', 'DateNation', 'KOR'), P('string', 'DateFormat', f));
    } else if (type === 'USER_INFO') params.push(P('string', 'Category', cmd.s));
    else if (type === 'FORMULA') {
      const [f, rest = ''] = cmd.s.split('??'), parts = rest.split(';');
      if (parts.length !== 3 || parts[1] !== '') return null;
      params.push(P('string', 'Formula', f), P('string', 'ResultFormat', parts[0]), P('string', 'LastResult', parts[2]));
    } else if (type === 'BOOKMARK') {
      params.pop(); // 책갈피는 Prop 만
      // 이름: 컨트롤 자료(CTRL_DATA) 매개변수 묶음의 첫 문자열
      const cd = (ctrl.children || []).find(k => k.tag === 87);
      if (cd && cd.data.length >= 12 && u16(cd.data, 8) === 1) fname = wstr(cd.data, 10).s;
    }
    return { tag: 'hp:fieldBegin', attrs: { id: String(u32(d, cmd.end)), type, name: fname, editable: String(attr & 1), dirty: String((attr >> 15) & 1), zorder: '-1', fieldid: String(u32(d, 0)), metaTag: '' },
      kids: [{ tag: 'hp:parameters', attrs: { cnt: String(params.length), name: '' }, kids: params }] };
  }
  const ALIGN = ['justify', 'left', 'right', 'center', 'distribute', 'distribute'];
  const HANCOM_FONTS = { 'HCR Batang': '함초롬바탕', 'HCR Dotum': '함초롬돋움', 'Haansoft Batang': '한컴바탕', 'Haansoft Dotum': '한컴돋움' };
  // 선 종류 (테두리·도형 선): 3 = 파선(DASH) — 서식 268개 변을 한글 HWPX 와 대조. 2 = 점선(DOT)은 각주 구분선 차례와 같게
  const LINE_TYPES = ['NONE', 'SOLID', 'DOT', 'DASH', 'DASH_DOT', 'DASH_DOT_DOT', 'LONG_DASH', 'CIRCLE', 'DOUBLE_SLIM', 'SLIM_THICK', 'THICK_SLIM', 'SLIM_THICK_SLIM', 'WAVE', 'DOUBLEWAVE', 'THICK_3D', 'THICK_3D_REVERS', '3D', '3D_REVERS'];
  const LINE_WIDTHS = [0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0];
  // 탭 채울 모양·각주 구분선 종류 (12가지 모두 한글 시험 문서로 확인)
  const TAB_LEADERS = ['NONE', 'SOLID', 'DOT', 'DASH', 'DASH_DOT', 'DASH_DOT_DOT', 'LONG_DASH', 'CIRCLE', 'DOUBLE_SLIM', 'SLIM_THICK', 'THICK_SLIM', 'SLIM_THICK_SLIM'];
  // 글자 밑줄·취소선 모양 (선 종류에서 '없음' 뺀 차례, 11 물결 · 15 이중 물결), 외곽선 종류, 강조점 —
  //  한글이 HWPX 의 각 값을 HWP 로 저장한 비트로 모두 확인 (밑줄 위치 1 아래·2 가운데·3 위, 외곽선 1~6, 그림자 1 DROP·2 CONTINUOUS, 강조점 1~12)
  const LINE_SHAPES = TAB_LEADERS.slice(1).concat(['WAVE', undefined, undefined, undefined, 'DOUBLE_WAVE']);
  const OUTLINES = ['NONE', 'SOLID', 'DOT', 'THICK', 'DASH', 'DASH_DOT', 'DASH_DOT_DOT'];
  const SYM_MARKS = ['NONE', 'DOT_ABOVE', 'RING_ABOVE', 'TILDE', 'CARON', 'SIDE', 'COLON', 'GRAVE_ACCENT', 'ACUTE_ACCENT', 'CIRCUMFLEX', 'MACRON', 'HOOK_ABOVE', 'DOT_BELOW'];
  const PN_POS = [null, 'TOP_LEFT', 'TOP_CENTER', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_CENTER', 'BOTTOM_RIGHT', 'TOP_RIGHT', 'BOTTOM_RIGHT', 'TOP_LEFT', 'BOTTOM_LEFT'];
  // 화면에 못 그리는 형식(WMF·EMF·TIFF 등)도 자료는 그대로 보존 (저장할 때 잃지 않도록)
  const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', wmf: 'image/wmf', emf: 'image/emf', tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml', ole: 'application/ole' };
  const mm = v => Math.round((v / MM) * 10) / 10;

  // 원래 문자 코드를 그대로 보존 (한글도 저장할 때 바꾸지 않음). 화면 표시는 dom.js 가 맡음
  // 글자 U+00A0 은 한글의 '묶음 빈칸'(U+00A0 으로 다룸)과 구별하려고 뒤에 U+FEFF 를 붙임 (hwpx.js NBSP_LIT)
  const mapChar = c => (c === 0xa0 ? H.NBSP_LIT : String.fromCharCode(c));

  // ---------------- 문서 정보(DocInfo) ----------------
  function parseDocInfo(recs) {
    const info = { counts: [], fonts: [], fontMeta: [], chars: [], paras: [], fills: [], bins: [], styles: [], numberings: [], bullets: [], tabs: [] };
    for (const r of recs) {
      const d = r.data;
      if (r.tag === T.ID_MAPPINGS) for (let o = 0; o + 4 <= d.length; o += 4) info.counts.push(i32(d, o));
      else if (r.tag === 30) info.compatTarget = u32(d, 0); // 호환 문서: 0 한글 2010 이후 · 1 한글 2007 · 2 MS 워드
      else if (r.tag === T.FACE_NAME) {
        // 한컴 글꼴의 영문 이름(HCR Dotum 등)은 한글처럼 한글 이름으로. 표에 없으면 대체 글꼴로 적힌 한글 이름
        const nm = wstr(d, 1);
        info.fonts.push(HANCOM_FONTS[nm.s] || (d[0] & 0x80 && /^(Haansoft|HCR|Hancom)\b/i.test(nm.s) ? wstr(d, nm.end + 1).s || nm.s : nm.s));
        // 글꼴 정보: 속성 아래 2비트 = 종류(1 TTF · 2 HFT), 0x80 대체 글꼴(종류 1바이트 + 이름), 0x40 분류 10바이트 (한글의 HWPX 변환과 대조)
        const a0 = d[0], meta = { type: (a0 & 3) === 2 ? 'HFT' : 'TTF', subst: null, ti: null };
        let p = nm.end;
        if (a0 & 0x80) { const at = d[p], an = wstr(d, p + 1); meta.subst = { face: an.s, type: at === 2 ? 'HFT' : 'TTF' }; p = an.end; }
        if (a0 & 0x40 && p + 10 <= d.length) meta.ti = H.typeInfoOf(Array.from(d.subarray(p, p + 10)));
        info.fontMeta.push(meta);
      }
      else if (r.tag === T.BIN_DATA) {
        const attr = u16(d, 0), type = attr & 15;
        if (type === 0) info.bins.push({ type });
        else {
          const id = u16(d, 2);
          // 1: 파일 포함(확장자 있음), 2: OLE 저장소(BINxxxx.OLE)
          info.bins.push({ type, id, ext: type === 1 ? wstr(d, 4).s.toLowerCase() : type === 2 ? 'ole' : '', comp: (attr >> 4) & 3 });
        }
      } else if (r.tag === T.BORDER_FILL) {
        // 속성(2) + 테두리 4개 [종류(1) 굵기(1) 색(4)] + 대각선(6) + 채우기
        const side = o => ({ type: LINE_TYPES[d[o]] || 'SOLID', width: LINE_WIDTHS[d[o + 1]] || 0.12, color: colorHex(u32(d, o + 2)) });
        const ft = u32(d, 32), bg = u32(d, 36);
        // 채우기: 단색(12) · 그러데이션(유형1 + 4×5 + [위치] + 색) · 그림(채우는 방식 1 · 밝기·명암·효과 3 · 자료 번호 2)
        let fo = 36, img = null;
        if (ft & 1) fo += 12;
        if (ft & 4) { const n = i32(d, fo + 17); fo += 21 + (n > 2 ? 4 * n : 0) + 4 * Math.max(0, n); }
        if (ft & 2) img = { mode: d[fo], binId: u16(d, fo + 4) };
        info.fills.push({
          bg: ft & 1 && (bg >>> 24) !== 0xff ? colorHex(bg) : null, // 흰색 채우기도 그대로 (한글 HWPX 와 대조: 흰 칸 7개)
          rawBg: ft & 1 && (bg >>> 24) !== 0xff ? colorHex(bg) : null, // 흰색도 그대로 (문단 배경용). 맨 위 바이트 FF = 투명
          borders: { l: side(2), r: side(8), t: side(14), b: side(20) },
          img,
        });
      } else if (r.tag === T.CHAR_SHAPE) {
        const attr = u32(d, 46), shade = u32(d, 60);
        const ul = (attr >> 2) & 3;
        // 글자 효과 (서식 341개의 글자 모양 3,998개를 한글 HWPX 와 대조: 밑줄 종류 0·1, 밑줄 모양 0·7, 외곽선 0·1·6, 그림자 0·1·위치·색,
        //  양각, 커닝, 글꼴에 어울리는 빈칸, 밑줄·취소선 색 확인. 나머지 값(밑줄 위치·모양, 외곽선, 그림자 종류, 강조점, 음각)은
        //  HWPX → 한글 HWP 저장 시험으로 확인 — 아래 LINE_SHAPES·OUTLINES·SYM_MARKS 설명 참고)
        const tc = colorHex(u32(d, 52)), ulCol = colorHex(u32(d, 56)), ulShape = LINE_SHAPES[(attr >> 4) & 15] || 'SOLID';
        const ulType = ['NONE', 'BOTTOM', 'CENTER', 'TOP'][ul];
        const stShape = LINE_SHAPES[(attr >> 26) & 15] || 'SOLID', stCol = d.length >= 74 ? colorHex(u32(d, 70)) : tc;
        const fx = H.makeFx({
          u: ul && (ulType !== 'BOTTOM' || ulShape !== 'SOLID' || ulCol !== tc) ? [ulType, ulShape, ulCol].join('/') : null,
          s: ((attr >> 18) & 7) && (stShape !== 'SOLID' || stCol !== tc) ? [stShape, stCol].join('/') : null,
          o: ((attr >> 8) & 7) ? OUTLINES[(attr >> 8) & 7] : null,
          sh: ((attr >> 11) & 3) ? [['NONE', 'DROP', 'CONTINUOUS'][(attr >> 11) & 3], colorHex(u32(d, 64)), i8(d, 50), i8(d, 51)].join('/') : null,
          em: (attr >> 13) & 1, en: (attr >> 14) & 1, k: (attr >> 30) & 1, fs: (attr >> 25) & 1, sym: ((attr >> 21) & 15) ? SYM_MARKS[(attr >> 21) & 15] : null,
        });
        // 언어 7개마다: 글꼴 번호(2) · 장평(1) · 자간(1) · 상대 크기(1) · 글자 위치(1), 그 뒤 기준 크기(4) · 속성(4)
        const L7 = (o, f) => [0, 1, 2, 3, 4, 5, 6].map(k => f(o + k));
        info.chars.push({
          face: u16(d, 0), faceIds: [0, 2, 4, 6, 8, 10, 12].map(o => u16(d, o)), size: i32(d, 42) / 100,
          ratios: L7(14, o => d[o] || 100), spacings: L7(21, o => i8(d, o)), relSz: L7(28, o => d[o] || 100), offsets: L7(35, o => i8(d, o)),
          spacing: i8(d, 21), ratio: d[14] || 100, italic: !!(attr & 1), bold: !!(attr & 2), underline: ul === 1 || ul === 3,
          strike: ((attr >> 18) & 7) !== 0, sup: !!(attr & (1 << 15)), sub: !!(attr & (1 << 16)),
          color: colorHex(u32(d, 52)), shade: shade !== 0xffffffff && (shade & 0xffffff) !== 0xffffff ? colorHex(shade) : null, fx,
        });
      } else if (r.tag === T.PARA_SHAPE) {
        const a1 = u32(d, 0), a3 = d.length >= 50 ? u32(d, 46) : 0;
        const lsType = d.length >= 54 ? a3 & 31 : a1 & 3;
        const ls = d.length >= 54 ? u32(d, 50) : i32(d, 24);
        const headType = [null, 'OUTLINE', 'NUMBER', 'BULLET'][(a1 >> 23) & 3];
        // 문단 여백·간격은 HWPUNIT 의 2배로 저장됨
        info.paras.push(Object.assign({
          align: ALIGN[(a1 >> 2) & 7] || 'justify',
          left: i32(d, 4) / 200, right: i32(d, 8) / 200, indent: i32(d, 12) / 200, before: i32(d, 16) / 200, after: i32(d, 20) / 200,
          lineSpacing: lsType === 0 && ls > 0 ? ls : 160,
        }, lsType >= 1 && lsType <= 3 ? { lineType: ['PERCENT', 'FIXED', 'BETWEEN_LINES', 'AT_LEAST'][lsType], lineValue: ls / 200 } : null,
        headType ? { head: { type: headType, id: u16(d, 30), level: (a1 >> 25) & 7 } } : null, {
          // 나머지 항목(pp)은 탭·테두리 정의를 다 읽은 뒤 정함: 속성1 · 탭 정의 번호 · 테두리/배경 번호 · 테두리 간격 4 · 속성2
          raw: { a1, tab: u16(d, 28), bf: u16(d, 32), off: [34, 36, 38, 40].map(o => i16(d, o)), a2: d.length >= 46 ? u32(d, 42) : 0 } }));
      } else if (r.tag === 22) {
        // 탭 정의: 속성(자동 탭 왼쪽·오른쪽) · 개수 · [위치(2배) · 종류 · 채울 모양 · 예약] 8바이트씩
        const at = u32(d, 0), n = i32(d, 4), items = [];
        for (let k = 0; k < n && 16 + k * 8 <= d.length; k++) {
          const o = 8 + k * 8;
          items.push([Math.round(u32(d, o) / 2), ['LEFT', 'RIGHT', 'CENTER', 'DECIMAL'][d[o + 4]] || 'LEFT', TAB_LEADERS[d[o + 5]] || 'NONE']);
        }
        info.tabs.push({ l: at & 1, r: (at >> 1) & 1, items });
      } else if (r.tag === T.NUMBERING) {
        // 수준 1~7: [속성(4) 너비 보정(2) 본문 간격(2) 글자 모양(4)] + 형식 문자열, 뒤에 시작 번호들
        //  속성: 0~1 정렬 · 2 실제 너비 · 3 자동 내어쓰기 · 4 간격 단위 · 5~8 번호 모양 (서식 1,393 수준을 한글 HWPX 와 대조.
        //  한글은 checkable 을 번호 모양 값의 맨 아래 비트(5)로 씀 — 93/93 확인)
        const levels = [];
        let o = 0;
        for (let l = 0; l < 7 && o + 14 <= d.length; l++) {
          const attr = u32(d, o), s = wstr(d, o + 12);
          levels.push({ level: l + 1, format: s.s, type: H.NUM_TYPES[(attr >> 5) & 15] || 'DIGIT', start: 1,
            align: ['LEFT', 'CENTER', 'RIGHT'][attr & 3] || 'LEFT', inst: (attr >> 2) & 1, auto: (attr >> 3) & 1, offType: (attr >> 4) & 1 ? 'HWPUNIT' : 'PERCENT',
            wa: i16(d, o + 4), off: i16(d, o + 6), chk: (attr >> 5) & 1, cp: u32(d, o + 8) });
          o = s.end;
        }
        const start = u16(d, o) || 1;
        if (o + 2 + 28 <= d.length) levels.forEach((lv, l) => { lv.start = u32(d, o + 2 + l * 4) || 1; });
        info.numberings.push({ id: info.numberings.length + 1, start, levels });
      } else if (r.tag === T.BULLET) {
        // 글머리표: [속성(4) 너비 보정(2) 본문 간격(2) 글자 모양(4)] (문단 번호 수준과 같은 짜임) · 문자(2) · 그림 번호(4) · 그림 정보(4) · ? (1) · 체크 문자(2)
        //  (서식의 25바이트 자료와 한글 HWPX 대조: 체크 문자는 23번째 바이트부터)
        const attr = u32(d, 0), ck = d.length >= 25 ? u16(d, 23) : d.length >= 24 ? u16(d, 22) : 0;
        info.bullets.push({ id: info.bullets.length + 1, char: String.fromCharCode(u16(d, 12) || 0x2022), checked: ck ? String.fromCharCode(ck) : null,
          align: ['LEFT', 'CENTER', 'RIGHT'][attr & 3] || 'LEFT', inst: (attr >> 2) & 1, auto: (attr >> 3) & 1, offType: (attr >> 4) & 1 ? 'HWPUNIT' : 'PERCENT',
          wa: i16(d, 4), off: i16(d, 6), chk: (attr >> 5) & 1, cp: u32(d, 8) });
      } else if (r.tag === T.STYLE) {
        const n1 = wstr(d, 0), n2 = wstr(d, n1.end);
        // 속성(1: 0비트 종류 0 문단·1 글자, 그 밖 비트가 있으면 양식 잠금) · 다음 스타일(1) · 언어(2) · 문단 모양(2) · 글자 모양(2) (한글 HWPX 와 대조)
        const a = d[n2.end] || 0;
        info.styles.push({ name: n1.s, engName: n2.s, type: a & 1 ? 'CHAR' : 'PARA', lockForm: a & 0x40 ? 1 : 0, next: d[n2.end + 1] || 0, langId: u16(d, n2.end + 2) || 1042, para: u16(d, n2.end + 4), char: u16(d, n2.end + 6) });
      }
    }
    // 글꼴 목록은 언어별(한글·영문·한자·일어·기타·기호·사용자) 개수만큼 이어져 있음
    let off = 0;
    info.faces = [1, 2, 3, 4, 5, 6, 7].map(k => { const n = info.counts[k] || 0; const list = info.fonts.slice(off, off + n); off += n; return list; });
    info.hangulFonts = info.faces[0].length ? info.faces[0] : info.fonts;
    off = 0;
    info.faceMeta = [1, 2, 3, 4, 5, 6, 7].map(k => { const n = info.counts[k] || 0; const list = info.fontMeta.slice(off, off + n); off += n; return list; });
    // 문단 모양의 나머지 항목 → pp (HWPX 읽기와 같은 모양)
    for (const p of info.paras) {
      const { a1, tab, bf, off, a2 } = p.raw;
      delete p.raw;
      const fill = bf ? info.fills[bf - 1] : null;
      const visible = fill && (fill.rawBg || ['l', 'r', 't', 'b'].some(k => fill.borders[k].type !== 'NONE'));
      const pp = H.makePP({
        condense: (a1 >> 9) & 127, fontLineHeight: (a1 >> 22) & 1, snapToGrid: (a1 >> 8) & 1,
        breakLatinWord: ['KEEP_WORD', 'HYPHENATION', 'BREAK_WORD'][(a1 >> 5) & 3] || 'KEEP_WORD', breakNonLatinWord: (a1 >> 7) & 1 ? 'KEEP_WORD' : 'BREAK_WORD', // 1 = 어절, 0 = 글자 (서식 예제로 확인)
        widowOrphan: (a1 >> 16) & 1, keepWithNext: (a1 >> 17) & 1, keepLines: (a1 >> 18) & 1, pageBreakBefore: (a1 >> 19) & 1,
        vertical: ['BASELINE', 'TOP', 'CENTER', 'BOTTOM'][(a1 >> 20) & 3], lineWrap: ['BREAK', 'SQUEEZE', 'KEEP'][a2 & 3] || 'BREAK', eAsianEng: (a2 >> 4) & 1, eAsianNum: (a2 >> 5) & 1,
        tabs: info.tabs[tab] || null,
        border: visible ? { sides: fill.borders, bg: fill.rawBg, off, connect: (a1 >> 28) & 1, ignoreMargin: (a1 >> 29) & 1 } : null,
      });
      if (pp) p.pp = pp;
    }
    return info;
  }

  // ---------------- 본문 ----------------
  // ---------- AES-128 복호화 (ECB, 블록 단위). 브라우저 WebCrypto 에는 ECB 가 없어 직접 구현 ----------
  const AES = (() => {
    const S = new Uint8Array(256), IS = new Uint8Array(256);
    // S-box 만들기 (GF(2^8) 역원 + 아핀 변환)
    let p = 1, q = 1;
    do {
      p = p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0);
      q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 0xff; if (q & 0x80) q ^= 0x09;
      const x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
      S[p] = (x ^ 0x63) & 0xff;
    } while (p !== 1);
    S[0] = 0x63;
    for (let i = 0; i < 256; i++) IS[S[i]] = i;
    const xt = b => ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;
    const mul = (a, b) => { let r = 0; while (b) { if (b & 1) r ^= a; a = xt(a); b >>= 1; } return r; };
    function expand(key) {
      const w = new Uint8Array(176);
      w.set(key);
      let rc = 1;
      for (let i = 16; i < 176; i += 4) {
        let t = w.slice(i - 4, i);
        if (i % 16 === 0) { t = new Uint8Array([S[t[1]] ^ rc, S[t[2]], S[t[3]], S[t[0]]]); rc = xt(rc); }
        for (let j = 0; j < 4; j++) w[i + j] = w[i - 16 + j] ^ t[j];
      }
      return w;
    }
    function decryptBlock(w, b) {
      const st = b.slice();
      const addKey = r => { for (let i = 0; i < 16; i++) st[i] ^= w[r * 16 + i]; };
      addKey(10);
      for (let r = 9; r >= 0; r--) {
        // 역 행 이동 · 역 S-box
        const t = st.slice();
        for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) st[c * 4 + row] = IS[t[((c - row + 4) % 4) * 4 + row]];
        addKey(r);
        if (r) for (let c = 0; c < 4; c++) {
          const a0 = st[c * 4], a1 = st[c * 4 + 1], a2 = st[c * 4 + 2], a3 = st[c * 4 + 3];
          st[c * 4] = mul(a0, 14) ^ mul(a1, 11) ^ mul(a2, 13) ^ mul(a3, 9);
          st[c * 4 + 1] = mul(a0, 9) ^ mul(a1, 14) ^ mul(a2, 11) ^ mul(a3, 13);
          st[c * 4 + 2] = mul(a0, 13) ^ mul(a1, 9) ^ mul(a2, 14) ^ mul(a3, 11);
          st[c * 4 + 3] = mul(a0, 11) ^ mul(a1, 13) ^ mul(a2, 9) ^ mul(a3, 14);
        }
      }
      return st;
    }
    function decryptECB(key, data) {
      const w = expand(key), out = new Uint8Array(data.length - (data.length % 16));
      for (let o = 0; o + 16 <= data.length; o += 16) out.set(decryptBlock(w, data.subarray(o, o + 16)), o);
      return out;
    }
    return { decryptECB, decryptBlock, expand };
  })();
  // 배포용 문서 자료(256바이트)에서 AES 키: 앞 4바이트를 씨앗으로 MSVC rand() 수열을 만들어 XOR, 4 + (씨앗 & 15) 위치의 16바이트
  function distributeKey(data) {
    const seed = u32(data, 0);
    let st = seed >>> 0;
    const rand = () => { st = (Math.imul(st, 214013) + 2531011) >>> 0; return (st >>> 16) & 0x7fff; };
    const d = Uint8Array.from(data.subarray(0, 256));
    let n = 0, key = 0;
    for (let i = 0; i < 256; i++) {
      if (n === 0) { key = rand() & 0xff; n = (rand() & 0x0f) + 1; }
      if (i >= 4) d[i] ^= key;
      n--;
    }
    const off = 4 + (seed & 0x0f);
    return d.subarray(off, off + 16);
  }
  // ViewText 구역 → 평문 레코드 자료
  async function viewTextSection(raw, compressed) {
    const h = u32(raw, 0), tag = h & 0x3ff;
    let size = h >>> 20, o = 4;
    if (size === 0xfff) { size = u32(raw, 4); o = 8; }
    if (tag !== 28 || size < 256) throw new Error('배포용 문서 자료를 찾지 못했습니다.');
    const key = distributeKey(raw.subarray(o, o + 256));
    const plain = AES.decryptECB(key, raw.subarray(o + size));
    return compressed ? inflate(plain) : plain;
  }

  // opts.docDate: 서식 파일(HWT)로 새로 만든 문서의 만든 날짜 (ISO 문자열) — '만든 날짜' 필드를 저장할 때 이 날짜로 채움
  async function readHwp(buffer, opts = {}) {
    const files = readCfb(buffer);
    const fh = files.FileHeader;
    if (!fh) throw new Error('HWP 문서 형식이 아닙니다.');
    const sig = new TextDecoder('ascii').decode(fh.subarray(0, 17));
    if (sig !== 'HWP Document File') throw new Error('HWP 5.0 문서가 아닙니다. (한글 97 등 옛 형식은 한글 2022에서 HWPX로 저장한 뒤 여세요)');
    const props = u32(fh, 36);
    if (props & 2) throw new Error('암호가 걸린 문서입니다. 한글 2022에서 암호를 해제한 뒤 여세요.');
    const distributed = !!(props & 4); // 배포용 문서: 본문이 ViewText 에 암호화돼 있음
    const compressed = !!(props & 1);
    const load = async name => { const raw = files[name]; if (!raw) return null; return compressed ? inflate(raw) : raw; };

    const info = parseDocInfo(records(await load('DocInfo')));
    const binFiles = {};
    for (const k of Object.keys(files)) if (k.startsWith('BinData/')) binFiles[k.slice(8).toUpperCase()] = files[k];
    const doc = { page: H.defaultPage(), header: null, footer: null, pageNum: null, blocks: [], numberings: info.numberings, bullets: info.bullets, outlineId: 1, columns: null };
    // MS 워드 호환 문서 (한글 2007 호환은 한글도 HWPX 로 옮길 때 2010 이후로 바꿈)
    if (info.compatTarget === 2) doc.compat = { target: 'MS_WORD', flags: H.WORD_COMPAT_FLAGS.slice() };
    let skipped = 0, chSeq = 0;

    const charStyle = id => {
      const c = info.chars[id];
      if (!c) return {};
      const font = info.hangulFonts[c.face] || H.DEFAULT_FONT;
      const langs = H.makeLangs(c.faceIds.map((id, k) => (info.faces[k] && info.faces[k][id]) || font), c.ratios, c.spacings, c.relSz, c.offsets);
      return { font, size: Math.round(c.size * 100) / 100 || 10, /* 글자 크기는 원래 값 그대로 (0.01pt 단위) */ bold: c.bold, italic: c.italic, underline: c.underline,
        strike: c.strike, sup: c.sup, sub: c.sub && !c.sup, color: c.color, shade: c.shade, spacing: c.spacing, ratio: c.ratio, langs, fx: c.fx };
    };
    // 문단 번호 수준의 글자 모양 (없음 = 4294967295 → 문단 글자 모양을 따름)
    for (const nb of info.numberings) {
      for (const lv of nb.levels) { if (lv.cp !== 0xffffffff && info.chars[lv.cp]) lv.style = charStyle(lv.cp); delete lv.cp; }
      // 수준 8~10: 한글은 기본값(간격 0)과 문서의 0번 글자 모양으로 씀
      for (let l = nb.levels.length + 1; l <= 10; l++) nb.levels.push({ level: l, format: '', type: 'DIGIT', start: 1, align: 'LEFT', inst: 0, auto: 0, offType: 'PERCENT', wa: 0, off: 0, chk: 0, style: charStyle(0) });
    }
    for (const b of info.bullets) { if (b.cp !== 0xffffffff && info.chars[b.cp]) b.style = charStyle(b.cp); delete b.cp; }
    const paraStyle = id => Object.assign({ align: 'justify' }, info.paras[id] || {});
    // 기호·사용자·기타 언어 글꼴 중 Wingdings 같은 기호 글꼴 (U+E000~F8FF 문자에 사용)
    const symFontOf = id => {
      const c = info.chars[id];
      if (!c || !c.faceIds) return null;
      const cand = [info.faces[5][c.faceIds[5]], info.faces[6][c.faceIds[6]], info.faces[4][c.faceIds[4]], info.faces[0][c.faceIds[0]]];
      return cand.find(f => f && /wingdings|webdings|symbol|marlett|dingbat/i.test(f)) || null;
    };

    async function image(binId, w, h) {
      const bin = info.bins[binId - 1];
      if (!bin || bin.type === 0) return null;
      const ext = bin.ext || 'png';
      const mime = MIME[ext] || 'image/' + ext;
      const name = ('BIN' + binId.toString(16).toUpperCase().padStart(4, '0') + '.' + ext).toUpperCase();
      let data = binFiles[name];
      if (!data) return null;
      if (bin.comp === 1 || (bin.comp === 0 && compressed)) { try { data = await inflate(data); } catch (e) { /* 압축 안 된 그림 */ } }
      return { mime, data: new Uint8Array(data), w: mm(w), h: mm(h) };
    }

    // 문단 묶음(리스트) 해석
    async function parseParas(nodes) {
      const out = [];
      for (const n of nodes) if (n.tag === T.PARA_HEADER) out.push(...await parsePara(n));
      return out;
    }
    // 셀·머리말 등: LIST_HEADER 뒤(또는 아래)에 이어지는 문단들
    function listParas(nodes, startIdx) {
      const paras = [];
      for (let k = startIdx + 1; k < nodes.length && nodes[k].tag === T.PARA_HEADER; k++) paras.push(nodes[k]);
      for (const c of nodes[startIdx].children) if (c.tag === T.PARA_HEADER) paras.push(c);
      return paras;
    }

    async function parseTable(ctrl) {
      const tbl = ctrl.children.find(c => c.tag === T.TABLE);
      const rowCnt = tbl ? u16(tbl.data, 4) : 0, colCnt = tbl ? u16(tbl.data, 6) : 0;
      // 여백 (mm) + 원래 HWPUNIT 값 hu [왼·오·위·아래]
      const marginAt = (d, o) => ({ l: mm(u16(d, o)), r: mm(u16(d, o + 2)), t: mm(u16(d, o + 4)), b: mm(u16(d, o + 6)), hu: [u16(d, o), u16(d, o + 2), u16(d, o + 4), u16(d, o + 6)] });
      const tblMargin = tbl ? marginAt(tbl.data, 10) : null;
      const cells = [];
      for (let k = 0; k < ctrl.children.length; k++) {
        const n = ctrl.children[k];
        if (n.tag !== T.LIST_HEADER) continue;
        const d = n.data;
        // 셀 속성 시작 위치: 대부분 8, 일부 6 — 값이 말이 되는 쪽을 고름
        let base = 8;
        const ok = o => u16(d, o + 4) >= 1 && u16(d, o + 6) >= 1 && u16(d, o) < Math.max(colCnt, 1) + 1 && u16(d, o + 2) < Math.max(rowCnt, 1) + 1;
        if (!ok(8) && ok(6)) base = 6;
        const flags = u32(d, base - 4);
        const va = (flags >> 5) & 3;
        cells.push({
          col: u16(d, base), row: u16(d, base + 2), colSpan: u16(d, base + 4) || 1, rowSpan: u16(d, base + 6) || 1,
          width: u32(d, base + 8), height: mm(u32(d, base + 12)), hh: u32(d, base + 12),
          // 셀 여백: 속성 16비트(셀 여백 지정)가 켜졌을 때만 셀 자체 값, 아니면 표의 안쪽 여백 (서식 예제 33568칸으로 확인)
          margin: (flags >> 16) & 1 ? marginAt(d, base + 16) : tblMargin,
          ...(fill => ({ bg: fill ? fill.bg : null, borders: fill ? H.compactBorders(fill.borders) : null }))(info.fills[u16(d, base + 24) - 1]),
          valign: va === 0 ? 'top' : va === 2 ? 'bottom' : 'middle',
          // 글 방향(0~2비트): 0 가로 · 1 세로쓰기
          ...((flags & 7) ? { dir: ['HORIZONTAL', 'VERTICAL', 'VERTICALALL'][flags & 7] || 'VERTICAL' } : null),
          // 줄 바꿈(3~4비트): 1 한 줄로 입력(SQUEEZE) · 2 KEEP
          ...((flags >> 3) & 3 ? { wrap: ['BREAK', 'SQUEEZE', 'KEEP'][(flags >> 3) & 3] || 'SQUEEZE' } : null),
          blocks: await parseParas(listParas(ctrl.children, k)),
        });
      }
      const nRows = Math.max(rowCnt, ...cells.map(c => c.row + 1), 1);
      const rows = Array.from({ length: nRows }, () => []);
      for (const c of cells) rows[c.row].push(c);
      rows.forEach(r => r.sort((a, b) => a.col - b.col));
      const nCols = Math.max(colCnt, ...cells.map(c => c.col + c.colSpan), 1);
      const total = u32(ctrl.data, 16);
      const ws = H.solveWidths(nCols, cells.map(c => ({ col: c.col, span: c.colSpan, w: c.width })), total);
      const sum = ws.reduce((a, b) => a + b, 0) || 1;
      const place = objPlace(ctrl.data);
      if (place.inline && place.wrap === 'SQUARE') place.wrap = 'TOP_AND_BOTTOM'; // 글자처럼 취급한 표는 한글도 자리 차지로 저장
      if (tbl) { const ta = u32(tbl.data, 0); place.pageBreak = ['NONE', 'TABLE', 'CELL'][ta & 3] || 'CELL'; place.repeatHeader = !!(ta & 4); place.noAdjust = !!(ta & 8); place.inMargin = { l: u16(tbl.data, 10), r: u16(tbl.data, 12), t: u16(tbl.data, 14), b: u16(tbl.data, 16) }; } // 셀 크기 고정 · 표 기본 안 여백
      return {
        type: 'table', colWidths: ws.map(w => w / sum), totalWidth: total, place,
        rows: rows.map(r => r.map(c => ({ colSpan: c.colSpan, rowSpan: c.rowSpan, height: c.height, hh: c.hh, margin: H.compactMargin(c.margin), bg: c.bg, borders: c.borders, valign: c.valign, dir: c.dir, wrap: c.wrap, blocks: c.blocks }))),
      };
    }

    // ---------- 그리기 개체(gso): HWP 레코드 → 한글이 HWPX 로 저장하는 것과 같은 요소 나무 (shape.js 가 그림) ----------
    const SHP_TAG = { '$rec': 'rect', '$ell': 'ellipse', '$lin': 'line', '$arc': 'arc', '$pol': 'polygon', '$cur': 'curve', '$con': 'container', '$pic': 'pic', '$ole': 'ole' };
    const ARROWS = ['NORMAL', 'ARROW', 'SPEAR', 'CONCAVE_ARROW', 'EMPTY_DIAMOND', 'EMPTY_CIRCLE', 'EMPTY_BOX', 'FILLED_DIAMOND', 'FILLED_CIRCLE', 'FILLED_BOX'];
    const ARROW_SZ = ['SMALL_SMALL', 'SMALL_MEDIUM', 'SMALL_LARGE', 'MEDIUM_SMALL', 'MEDIUM_MEDIUM', 'MEDIUM_LARGE', 'LARGE_SMALL', 'LARGE_MEDIUM', 'LARGE_LARGE'];
    const SHADOWS = ['NONE', 'PARALLEL_LEFTTOP', 'PARALLEL_RIGHTTOP', 'PARALLEL_LEFTBOTTOM', 'PARALLEL_RIGHTBOTTOM', 'SHEAR_LEFTTOP', 'SHEAR_RIGHTTOP', 'SHEAR_LEFTBOTTOM', 'SHEAR_RIGHTBOTTOM'];
    const WREL = ['PAPER', 'PAGE', 'COLUMN', 'PARA', 'ABSOLUTE'], HRELS = ['PAPER', 'PAGE', 'ABSOLUTE'];
    const NUMTYPE = ['NONE', 'PICTURE', 'TABLE', 'EQUATION'], FLOWS = ['BOTH_SIDES', 'LEFT_ONLY', 'RIGHT_ONLY', 'LARGEST_ONLY'];
    const IMG_MODES = ['TILE', 'TILE_HORZ_TOP', 'TILE_HORZ_BOTTOM', 'TILE_VERT_LEFT', 'TILE_VERT_RIGHT', 'TOTAL', 'CENTER', 'CENTER_TOP', 'CENTER_BOTTOM', 'LEFT_CENTER', 'LEFT_TOP', 'LEFT_BOTTOM', 'RIGHT_CENTER', 'RIGHT_TOP', 'RIGHT_BOTTOM', 'ZOOM'];
    const EFFECTS = ['REAL_PIC', 'GRAY_SCALE', 'BLACK_WHITE', 'PATTERN8x8'];
    const N = (tag, attrs, kids) => ({ tag, attrs: attrs || {}, kids: kids || [] });
    const f64 = (d, o) => (o + 8 <= d.length ? dvOf(d).getFloat64(o, true) : 0);
    // 한글은 행렬 값을 float 정밀도로 소수 여섯째 자리까지 씀
    const fnum = v => Math.fround(v).toFixed(6).replace(/\.?0+$/, ''); // 아주 작은 음수는 한글처럼 -0
    const cstr = c => (c === 0xffffffff ? 'none' : '#' + ((c >>> 24) ? ((c >>> 24) & 255).toString(16).padStart(2, '0').toUpperCase() : '') + colorHex(c).slice(1));
    const S = v => String(v);
    // 채우기 정보 (단색·그러데이션·그림) → hc:fillBrush
    async function readFill(d, o) {
      const type = u32(d, o); o += 4;
      const kids = [];
      if (type & 1) {
        const face = u32(d, o), hatch = u32(d, o + 4), hs = i32(d, o + 8); o += 12;
        kids.push(N('hc:winBrush', Object.assign({ faceColor: cstr(face), hatchColor: cstr(hatch) }, hs >= 0 && hs < 6 ? { hatchStyle: ['HORIZONTAL', 'VERTICAL', 'BACK_SLASH', 'SLASH', 'CROSS', 'CROSS_DIAGONAL'][hs] } : null, { alpha: '0' })));
      }
      let grad = null;
      if (type & 4) {
        // 그러데이션: 유형(1) 기울기·가로 중심·세로 중심·번짐 정도·색 개수(각 4) [색 위치] 색
        const gt = d[o], ang = i32(d, o + 1), gx = i32(d, o + 5), gy = i32(d, o + 9), step = i32(d, o + 13), n = i32(d, o + 17); o += 21;
        if (n > 2) o += 4 * n;
        const cols = [];
        for (let k = 0; k < n; k++) cols.push(u32(d, o + k * 4));
        o += 4 * Math.max(0, n);
        grad = N('hc:gradation', { type: ['LINEAR', 'LINEAR', 'RADIAL', 'CONICAL', 'SQUARE'][gt] || 'LINEAR', angle: S(ang), centerX: S(gx), centerY: S(gy), step: S(step), colorNum: S(n), stepCenter: '50', alpha: '0' }, cols.map(c => N('hc:color', { value: cstr(c) })));
        kids.push(grad);
      }
      if (type & 2) {
        const mode = d[o], bright = i8(d, o + 1), contrast = i8(d, o + 2), effect = d[o + 3], binId = u16(d, o + 4); o += 6;
        const img = await image(binId, 0, 0);
        const im = N('hc:img', { binaryItemIDRef: '', bright: S(bright), contrast: S(contrast), effect: EFFECTS[effect] || 'REAL_PIC', alpha: '0' });
        if (img) im.image = { mime: img.mime, data: img.data };
        kids.push(N('hc:imgBrush', { mode: IMG_MODES[mode] || 'TILE' }, [im]));
      }
      // 추가 속성(길이 + 자료): 그러데이션의 번짐 중심이 여기 들어 있음. 그 뒤 채우기 종류마다 투명도 한 바이트 (HOME10: 단색+그러데이션 → 2바이트)
      const extra = u32(d, o);
      if (grad && extra >= 1) grad.attrs.stepCenter = S(d[o + 4]);
      o += 4 + extra;
      o += (type & 1) + ((type >> 1) & 1) + ((type >> 2) & 1);
      return { node: kids.length ? N('hc:fillBrush', {}, kids) : null, o };
    }
    // SHAPE_COMPONENT 한 개 → 요소 나무. head: 개체 맨 위면 컨트롤 머리 자료 (배치·크기·설명)
    async function readShapeComp(rec, head, headKids) {
      const d = rec.data, top = !!head;
      const type = SHP_TAG[ctrlName(u32(d, 0))];
      if (!type) return null;
      let o = top ? 8 : 4;
      const offX = u32(d, o), offY = u32(d, o + 4); o += 8; // 한글은 음수도 부호 없는 수로 씀
      const glevel = u16(d, o); o += 4;
      const orgW = u32(d, o), orgH = u32(d, o + 4), curW = u32(d, o + 8), curH = u32(d, o + 12); o += 16;
      const flip = u32(d, o); o += 4;
      const angle = i16(d, o), cx = u32(d, o + 2), cy = u32(d, o + 6); o += 10; // 회전 중심도 한글은 부호 없는 수로 씀
      const cnt = u16(d, o); o += 2;
      const mat = tag => { const m = []; for (let k = 0; k < 6; k++) m.push(f64(d, o + k * 8)); o += 48; return N(tag, { e1: fnum(m[0]), e2: fnum(m[1]), e3: fnum(m[2]), e4: fnum(m[3]), e5: fnum(m[4]), e6: fnum(m[5]) }); };
      const ri = N('hp:renderingInfo', {}, [mat('hc:transMatrix')]);
      for (let k = 0; k < cnt; k++) ri.kids.push(mat('hc:scaMatrix'), mat('hc:rotMatrix'));
      const kids = [N('hp:offset', { x: S(offX), y: S(offY) }), N('hp:orgSz', { width: S(orgW), height: S(orgH) }), N('hp:curSz', { width: S(curW === orgW ? 0 : curW), height: S(curH === orgH ? 0 : curH) }), // 한글은 원래 크기와 같은 쪽을 0 으로 씀
        N('hp:flip', { horizontal: S(flip & 1), vertical: S((flip >> 1) & 1) }), N('hp:rotationInfo', { angle: S(angle), centerX: S(cx), centerY: S(cy), rotateimage: S((flip >> 19) & 1) }), ri];
      let instid = 0;
      const geo = rec.children.find(c => c.tag >= 78 && c.tag <= 86 && c.tag !== 84 && c.tag !== T.SHAPE_COMPONENT);
      const attrs = {};
      if (type === 'container') {
        const n = u16(d, o); o += 2 + 4 * n;
        instid = u32(d, o);
        for (const c of rec.children) if (c.tag === T.SHAPE_COMPONENT) { const k = await readShapeComp(c, null); if (k) kids.push(k); }
      } else if (type === 'pic') {
        instid = geo ? u32(geo.data, 74) : 0; // 그림은 선·채우기·그림자 정보가 그림 레코드에 있음
      } else if (type === 'ole') {
        // OLE: 속성(그리는 방식·종류) · 크기 · 자료 번호 · 테두리 · instid
        const og = (rec.children.find(c => c.tag === 84) || { data: new Uint8Array(0) }).data;
        const oa = u32(og, 0);
        Object.assign(attrs, { objectType: ['UNKNOWN', 'EMBEDDED', 'LINK', 'STATIC', 'EQUATION'][(oa >> 16) & 63] || 'EMBEDDED', binaryItemIDRef: '', hasMoniker: S((oa >> 8) & 1),
          drawAspect: { 1: 'CONTENT', 2: 'THUMBNAIL', 4: 'ICON', 8: 'DOCPRINT' }[oa & 255] || 'CONTENT', eqBaseLine: S((oa >> 9) & 127) });
        instid = u32(og, 26);
        const la = u32(og, 22);
        kids.push(N('hc:extent', { x: S(i32(og, 4)), y: S(i32(og, 8)) }),
          N('hp:lineShape', { color: cstr(u32(og, 14)), width: S(i32(og, 18)), style: LINE_TYPES[la & 63] || 'NONE', endCap: ['ROUND', 'FLAT'][(la >> 6) & 15] || 'ROUND', headStyle: ARROWS[(la >> 10) & 63] || 'NORMAL', tailStyle: ARROWS[(la >> 16) & 63] || 'NORMAL',
            headfill: S((la >>> 30) & 1), tailfill: S((la >>> 31) & 1), headSz: ARROW_SZ[(la >> 22) & 15] || 'SMALL_SMALL', tailSz: ARROW_SZ[(la >> 26) & 15] || 'SMALL_SMALL', outlineStyle: 'NORMAL', alpha: '0' }));
        const bin = await image(u16(og, 12), 0, 0);
        if (bin) var oleData = { mime: 'application/ole', data: bin.data };
      }
      if (type !== 'container' && type !== 'pic' && type !== 'ole') {
        const lc = u32(d, o), lw = i32(d, o + 4), la = u32(d, o + 8), lo = d[o + 12]; o += 13;
        // 끝 모양 값이 0·1 이 아니면 한글은 endCap 을 쓰지 않음 (Common3: 15)
        kids.push(N('hp:lineShape', Object.assign({ color: cstr(lc), width: S(lw), style: LINE_TYPES[la & 63] || 'SOLID' }, ((la >> 6) & 15) < 2 ? { endCap: ['ROUND', 'FLAT'][(la >> 6) & 15] } : null, {
          headStyle: ARROWS[(la >> 10) & 63] || 'NORMAL', tailStyle: ARROWS[(la >> 16) & 63] || 'NORMAL', headfill: S((la >>> 30) & 1), tailfill: S((la >>> 31) & 1),
          headSz: ARROW_SZ[(la >> 22) & 15] || 'MEDIUM_MEDIUM', tailSz: ARROW_SZ[(la >> 26) & 15] || 'MEDIUM_MEDIUM', outlineStyle: ['NORMAL', 'OUTER', 'INNER'][lo] || 'NORMAL', alpha: '0' })));
        const fill = await readFill(d, o); o = fill.o;
        if (fill.node) kids.push(fill.node);
        kids.push(N('hp:shadow', { type: SHADOWS[u32(d, o)] || 'NONE', color: cstr(u32(d, o + 4)), offsetX: S(i32(d, o + 8)), offsetY: S(i32(d, o + 12)), alpha: '0' }));
        o += 16;
        instid = u32(d, o);
      }
      if (type !== 'container' && type !== 'ole') {
        // 글상자
        const lh = rec.children.findIndex(c => c.tag === T.LIST_HEADER);
        if (lh >= 0) {
          // 글상자 목록 머리: 문단 수(4) · 속성(4: 0~2 글 방향, 3~4 줄 바꿈, 5~6 세로 정렬) · 여백 4 · 최대 폭 (셀 목록 머리와 같은 짜임)
          const L = rec.children[lh].data, la = u32(L, 4);
          const dt = N('hp:drawText', { lastWidth: S(u32(L, 16)), name: '', editable: '0' }, [N('hp:textMargin', { left: S(u16(L, 8)), right: S(u16(L, 10)), top: S(u16(L, 12)), bottom: S(u16(L, 14)) })]);
          dt.text = { sub: { id: '', textDirection: ['HORIZONTAL', 'VERTICAL', 'VERTICALALL'][la & 7] || 'HORIZONTAL', lineWrap: ['BREAK', 'SQUEEZE', 'KEEP'][(la >> 3) & 3] || 'BREAK', vertAlign: ['TOP', 'CENTER', 'BOTTOM'][(la >> 5) & 3] || 'TOP', linkListIDRef: '0', linkListNextIDRef: '0', textWidth: '0', textHeight: '0', hasTextRef: '0', hasNumRef: '0' },
            blocks: await parseParas(listParas(rec.children, lh)) };
          kids.push(dt);
        }
        const g = geo ? geo.data : new Uint8Array(0);
        const P = (tag, k) => N(tag, { x: S(i32(g, k)), y: S(i32(g, k + 4)) });
        if (type === 'rect') { attrs.ratio = S(g[0] || 0); kids.push(P('hc:pt0', 1), P('hc:pt1', 9), P('hc:pt2', 17), P('hc:pt3', 25)); }
        else if (type === 'line') { attrs.isReverseHV = S(u16(g, 16) & 1); kids.push(P('hc:startPt', 0), P('hc:endPt', 8)); }
        else if (type === 'ellipse') {
          const ea = u32(g, 0);
          Object.assign(attrs, { intervalDirty: S(ea & 1), hasArcPr: S((ea >> 1) & 1), arcType: ['NORMAL', 'PIE', 'CHORD'][(ea >> 2) & 3] || 'NORMAL' });
          kids.push(P('hc:center', 4), P('hc:ax1', 12), P('hc:ax2', 20), P('hc:start1', 28), P('hc:end1', 36), P('hc:start2', 44), P('hc:end2', 52));
        } else if (type === 'arc') { attrs.type = ['NORMAL', 'PIE', 'CHORD'][g[0]] || 'NORMAL'; kids.push(P('hc:center', 1), P('hc:ax1', 9), P('hc:ax2', 17)); }
        else if (type === 'polygon') { const n = i32(g, 0); for (let k = 0; k < n; k++) kids.push(P('hc:pt', 4 + k * 8)); }
        else if (type === 'curve') {
          // 점 개수(4) 다음 (x, y) 쌍, 그 뒤 구간마다 종류(곡선 1 / 직선 0)
          const n = i32(g, 0), xs = [], ys = [];
          for (let k = 0; k < n; k++) { xs.push(i32(g, 4 + k * 8)); ys.push(i32(g, 8 + k * 8)); }
          for (let k = 0; k + 1 < n; k++) kids.push(N('hp:seg', { type: g[4 + n * 8 + k] ? 'CURVE' : 'LINE', x1: S(xs[k]), y1: S(ys[k]), x2: S(xs[k + 1]), y2: S(ys[k + 1]) }));
        } else if (type === 'pic') {
          // 그림: 테두리(12) · 그림 영역 네 점(32) · 자르기(16) · 안 여백(8) · 그림 정보(밝기·명암·효과·자료 번호)
          const img = await image(u16(g, 71), orgW, orgH);
          const im = N('hc:img', { binaryItemIDRef: '', bright: S(i8(g, 68)), contrast: S(i8(g, 69)), effect: EFFECTS[g[70]] || 'REAL_PIC', alpha: '0' });
          if (img) im.image = { mime: img.mime, data: img.data };
          const bw = i32(g, 4);
          // 그림 테두리 선 속성도 도형 선과 같은 비트 짜임 (끝 모양·화살표·채움·크기)
          const pa = u32(g, 8);
          if (bw > 0) kids.push(N('hp:lineShape', { color: cstr(u32(g, 0)), width: S(bw), style: LINE_TYPES[pa & 63] || 'SOLID', endCap: ['ROUND', 'FLAT'][(pa >> 6) & 15] || 'FLAT',
            headStyle: ARROWS[(pa >> 10) & 63] || 'NORMAL', tailStyle: ARROWS[(pa >> 16) & 63] || 'NORMAL', headfill: S((pa >>> 30) & 1), tailfill: S((pa >>> 31) & 1),
            headSz: ARROW_SZ[(pa >> 22) & 15] || 'MEDIUM_MEDIUM', tailSz: ARROW_SZ[(pa >> 26) & 15] || 'MEDIUM_MEDIUM', outlineStyle: 'NORMAL', alpha: '0' }));
          kids.push(im, N('hp:imgRect', {}, [P('hc:pt0', 12), P('hc:pt1', 20), P('hc:pt2', 28), P('hc:pt3', 36)]),
            N('hp:imgClip', { left: S(i32(g, 44)), right: S(i32(g, 52)), top: S(i32(g, 48)), bottom: S(i32(g, 56)) }),
            N('hp:inMargin', { left: S(u16(g, 60)), right: S(u16(g, 62)), top: S(u16(g, 64)), bottom: S(u16(g, 66)) }));
          if (g.length >= 90) kids.push(N('hp:imgDim', { dimwidth: S(u32(g, 82)), dimheight: S(u32(g, 86)) }));
          kids.push(N('hp:effects'));
          attrs.reverse = '0';
        }
      }
      // 개체 연결 자료(CTRL_DATA 매개변수 묶음 539 → 목록 623 → 문자열 613 = 하이퍼링크): 최상위 개체는 href, 묶음 안 개체는 parameterset 요소 (한글 HWPX 와 같게)
      //  개체 컨트롤 머리 아래에도 있으면 그것은 맨 끝 parameterset 요소 (HOME10)
      const linkOf = list => { const c = (list || []).find(q => q.tag === 87); return c && u16(c.data, 0) === 539 && u16(c.data, 6) === 623 && (u16(c.data, 8) & 0x8000) && u16(c.data, 16) === 613 && u16(c.data, 18) === 1 ? wstr(c.data, 20).s : null; };
      const pset = link => N('hp:parameterset', { cnt: '1', name: '539' }, [N('hp:listParam', { cnt: '1', name: '623' }, [Object.assign(N('hp:stringParam', { name: '613' }), { txt: link })])]);
      const link = linkOf(rec.children);
      if (link !== null) { if (top) attrs.href = link; else kids.push(pset(link)); }
      // 글자처럼 취급한 개체는 한글도 자리 차지로 씀
      const el = N('hp:' + type, Object.assign(top ? {
        id: S(u32(head, 36)), zOrder: S(i32(head, 24)), numberingType: NUMTYPE[(u32(head, 4) >> 26) & 7] || 'NONE', textWrap: objPlace(head).inline ? 'TOP_AND_BOTTOM' : objPlace(head).wrap, textFlow: FLOWS[(u32(head, 4) >> 24) & 3],
      } : { id: '0', zOrder: '0', numberingType: 'NONE', textWrap: 'TOP_AND_BOTTOM', textFlow: 'BOTH_SIDES' }, { lock: '0', dropcapstyle: 'None', href: '', groupLevel: S(glevel), instid: S(instid) }, attrs), kids);
      if (type === 'ole' && typeof oleData !== 'undefined') el.image = oleData; // OLE 자료 (저장할 때 BinData 로)
      if (top) {
        const at = u32(head, 4), pl = objPlace(head);
        kids.push(N('hp:sz', { width: S(u32(head, 16)), widthRelTo: WREL[(at >> 15) & 7] || 'ABSOLUTE', height: S(u32(head, 20)), heightRelTo: HRELS[(at >> 18) & 3] || 'ABSOLUTE', protect: S((at >> 20) & 1) }),
          N('hp:pos', { treatAsChar: S(+pl.inline), affectLSpacing: S(+pl.affect), flowWithText: S(+pl.flow), allowOverlap: S(+pl.overlap), holdAnchorAndSO: '0', vertRelTo: pl.vertRelTo, horzRelTo: pl.horzRelTo, vertAlign: pl.vertAlign, horzAlign: pl.horzAlign, vertOffset: S(pl.vertOffset >>> 0), horzOffset: S(pl.horzOffset >>> 0) }),
          N('hp:outMargin', { left: S(pl.out.l), right: S(pl.out.r), top: S(pl.out.t), bottom: S(pl.out.b) }));
        const desc = head.length > 46 ? wstr(head, 44).s : '';
        if (desc) kids.push(Object.assign(N('hp:shapeComment'), { txt: desc }));
        const hlink = linkOf(headKids);
        if (hlink !== null) kids.push(pset(hlink));
      }
      return el;
    }

    // 수식: 컨트롤 머리(배치·크기·설명) + 수식 레코드(속성·스크립트·글자 크기·색·기준선·판·글꼴)
    function readEquation(ctrl) {
      const head = ctrl.data, rec = ctrl.children.find(c => c.tag === 88);
      if (!rec) return null;
      const d = rec.data, at = u32(d, 0);
      const sc = wstr(d, 4);
      let o = sc.end;
      const baseUnit = u32(d, o), color = u32(d, o + 4), baseLine = i16(d, o + 8); o += 12;
      const ver = wstr(d, o), font = wstr(d, ver.end);
      const hat = u32(head, 4), pl = objPlace(head);
      const kids = [N('hp:sz', { width: S(u32(head, 16)), widthRelTo: WREL[(hat >> 15) & 7] || 'ABSOLUTE', height: S(u32(head, 20)), heightRelTo: HRELS[(hat >> 18) & 3] || 'ABSOLUTE', protect: S((hat >> 20) & 1) }),
        N('hp:pos', { treatAsChar: S(+pl.inline), affectLSpacing: S(+pl.affect), flowWithText: S(+pl.flow), allowOverlap: S(+pl.overlap), holdAnchorAndSO: '0', vertRelTo: pl.vertRelTo, horzRelTo: pl.horzRelTo, vertAlign: pl.vertAlign, horzAlign: pl.horzAlign, vertOffset: S(pl.vertOffset >>> 0), horzOffset: S(pl.horzOffset >>> 0) }),
        N('hp:outMargin', { left: S(pl.out.l), right: S(pl.out.r), top: S(pl.out.t), bottom: S(pl.out.b) })];
      const desc = head.length > 46 ? wstr(head, 44).s : '';
      if (desc) kids.push(Object.assign(N('hp:shapeComment'), { txt: desc }));
      kids.push(Object.assign(N('hp:script'), { txt: sc.s }));
      return N('hp:equation', { id: S(u32(head, 36)), zOrder: S(i32(head, 24)), numberingType: NUMTYPE[(hat >> 26) & 7] || 'EQUATION', textWrap: pl.inline ? 'TOP_AND_BOTTOM' : pl.wrap, textFlow: FLOWS[(hat >> 24) & 3],
        lock: '0', dropcapstyle: 'None', version: ver.s || 'Equation Version 60', baseLine: S(baseLine), textColor: cstr(color), baseUnit: S(baseUnit), lineMode: at & 1 ? 'LINE' : 'CHAR', font: font.s || 'HancomEQN' }, kids);
    }
    // 양식 개체 속성 문자열: "이름:형식:값" 을 빈칸으로 이어 씀. set·wstring 은 값 앞에 글자 수가 붙고, set 은 그 안에 다시 속성들
    function formProps(s) {
      let i = 0;
      const read = end => {
        const obj = {};
        while (i < end) {
          if (s[i] === ' ') { i++; continue; }
          const c1 = s.indexOf(':', i), c2 = s.indexOf(':', c1 + 1);
          if (c1 < 0 || c2 < 0) break;
          const name = s.slice(i, c1), type = s.slice(c1 + 1, c2);
          i = c2 + 1;
          if (type === 'set' || type === 'wstring') {
            const c3 = s.indexOf(':', i), n = +s.slice(i, c3);
            i = c3 + 1;
            if (type === 'set') { const e = i + n; obj[name] = read(e); i = e; } else { obj[name] = s.substr(i, n); i += n; }
          } else {
            let e = s.indexOf(' ', i);
            if (e < 0 || e > end) e = end;
            obj[name] = s.slice(i, e); i = e;
          }
        }
        return obj;
      };
      return read(s.length);
    }
    // 양식 개체: 컨트롤 머리(배치·크기) + 양식 레코드(종류 두 번 · 속성 문자열). 한글이 HWPX 로 쓰는 차례대로 속성을 놓음
    const FORM_KIND = { '+edt': 'edit', '+pbt': 'btn', '+rbt': 'radioBtn', '+cbt': 'checkBtn', '+cob': 'comboBox', '+lsb': 'listBox', '+scr': 'scrollBar' };
    function readForm(ctrl) {
      const head = ctrl.data, rec = ctrl.children.find(c => c.tag === 91);
      if (!rec) return null;
      const kind = FORM_KIND[String.fromCharCode(rec.data[3], rec.data[2], rec.data[1], rec.data[0])];
      if (!kind) return null;
      const P = formProps(wstr(rec.data, 12).s);
      const C = P.CommonSet || {}, CS = P.CharShapeSet, B = P.ButtonSet || {}, E = P.EditSet || {}, CB = P.ComboBoxSet || P.ListBoxSet || {}, SB = P.ScrollBarSet || {};
      const color = v => cstr((+v || 0) >>> 0);
      const attrs = {};
      if (kind === 'edit') Object.assign(attrs, { multiLine: E.MultiLine || '0', passwordChar: E.PasswordChar || '', maxLength: E.MaxLength || '2147483647',
        scrollBars: ['NONE', 'VERTICAL', 'HORIZONTAL', 'BOTH'][+E.ScrollBars || 0], tabKeyBehavior: ['NEXT_OBJECT', 'INSERT_TAB'][+E.TabKeyBehavior || 0],
        numOnly: E.Number || '0', readOnly: E.ReadOnly || '0', alignText: ['LEFT', 'CENTER', 'RIGHT'][+E.AlignText || 0] });
      else if (kind === 'btn') Object.assign(attrs, { caption: B.Caption || '', radioGroupName: B.RadioGroupName || '', triState: B.TriState || '0' });
      else if (kind === 'radioBtn' || kind === 'checkBtn') Object.assign(attrs, { caption: B.Caption || '', value: ['UNCHECKED', 'CHECKED', 'INDETERMINATE'][+B.Value || 0],
        radioGroupName: B.RadioGroupName || '', triState: B.TriState || '0', backStyle: ['TRANSPARENT', 'OPAQUE'][+B.BackStyle || 0] });
      else if (kind === 'comboBox') Object.assign(attrs, { listBoxRows: CB.ListBoxRows || '10', listBoxWidth: CB.ListBoxWidth || '0', editEnable: CB.EditEnable || '0', selectedValue: '' });
      else if (kind === 'listBox') Object.assign(attrs, { itemHeight: CB.ItemHeight || '0', topIdx: S((+CB.TopIndex || 0) >>> 0), selectedValue: '' });
      else if (kind === 'scrollBar') Object.assign(attrs, { delay: SB.Delay || '0', largeChange: SB.LargeChange || '1', smallChange: SB.SmallChange || '1', min: SB.Min || '0', max: SB.Max || '0',
        page: SB.Page || '0', value: SB.Value || '0', type: ['HORIZONTAL', 'VERTICAL'][+SB.Type || 0] });
      Object.assign(attrs, { name: C.Name || '', foreColor: color(C.ForeColor), backColor: color(C.BackColor), groupName: C.GroupName || '', tabStop: C.TabStop || '1', editable: C.Editable || '1',
        tabOrder: C.TabOrder || '0', enabled: C.Enabled || '1', borderTypeIDRef: C.BorderType || '0', drawFrame: C.DrawFrame || '1', printable: C.Printable || '1', command: C.Command || '' });
      const hat = u32(head, 4), pl = objPlace(head);
      // 스크롤 막대는 글자 모양 묶음이 없음
      const kids = CS ? [N('hp:formCharPr', { charPrIDRef: CS.CharShapeID || '0', followContext: CS.FollowContext || '0', autoSz: CS.AutoSize || '0', wordWrap: CS.WordWrap || '0' })] : [];
      if (kind === 'edit') kids.push(E.Text ? Object.assign(N('hp:text'), { txt: E.Text }) : N('hp:text'));
      // HWP 에는 목록 항목이 없고 고른 값만 있음 → 한글도 HWPX 로 옮길 때 그 값을 가진 항목 하나만 씀
      if (kind === 'comboBox' || kind === 'listBox') kids.push(N('hp:listItem', { displayText: '', value: CB.Text || '' }));
      kids.push(N('hp:sz', { width: S(u32(head, 16)), widthRelTo: WREL[(hat >> 15) & 7] || 'ABSOLUTE', height: S(u32(head, 20)), heightRelTo: HRELS[(hat >> 18) & 3] || 'ABSOLUTE', protect: S((hat >> 20) & 1) }),
        N('hp:pos', { treatAsChar: S(+pl.inline), affectLSpacing: S(+pl.affect), flowWithText: S(+pl.flow), allowOverlap: S(+pl.overlap), holdAnchorAndSO: '0', vertRelTo: pl.vertRelTo, horzRelTo: pl.horzRelTo, vertAlign: pl.vertAlign, horzAlign: pl.horzAlign, vertOffset: S(pl.vertOffset >>> 0), horzOffset: S(pl.horzOffset >>> 0) }),
        N('hp:outMargin', { left: S(pl.out.l), right: S(pl.out.r), top: S(pl.out.t), bottom: S(pl.out.b) }));
      return N('hp:' + kind, attrs, kids);
    }
    function findDesc(node, tag) {
      for (const c of node.children) { if (c.tag === tag) return c; const f = findDesc(c, tag); if (f) return f; }
      return null;
    }
    function descParas(node, out) { for (const c of node.children) { if (c.tag === T.PARA_HEADER) out.push(c); else descParas(c, out); } return out; }

    async function parsePara(ph) {
      const style = paraStyle(u16(ph.data, 8));
      if (ph.data[10]) style.styleId = ph.data[10]; // 문단 스타일 번호
      const breakType = ph.data[11] || 0;
      const kids = ph.children;
      const textRec = kids.find(k => k.tag === T.PARA_TEXT);
      const csRec = kids.find(k => k.tag === T.PARA_CHAR_SHAPE);
      const ctrls = kids.filter(k => k.tag === T.CTRL_HEADER);
      const shapes = [];
      if (csRec) for (let o = 0; o + 8 <= csRec.data.length; o += 8) shapes.push({ pos: u32(csRec.data, o), id: u32(csRec.data, o + 4) });
      if (!shapes.length) shapes.push({ pos: 0, id: 0 });
      const out = [];
      const fresh = () => Object.assign({ type: 'p', runs: [] }, style);
      let cur = fresh();
      if (breakType & 0x04) cur.pageBreak = true;
      // fields: 열린 필드(누름틀·하이퍼링크) 쌓기 — 끝 표시(문자 4)는 안쪽부터 닫힘
      let lastShapeId = -1, lastLink = null;
      const fields = [];
      const curLink = () => { for (let k = fields.length - 1; k >= 0; k--) if (fields[k].url) return fields[k].url; return null; };
      const curCh = () => { for (let k = fields.length - 1; k >= 0; k--) if (fields[k].ch) return fields[k].runs === cur.runs ? fields[k].ch : null; return null; };
      const curFd = () => { for (let k = fields.length - 1; k >= 0; k--) if (fields[k].fd) return fields[k].runs === cur.runs ? fields[k].fd : null; return null; };
      let lastTextSid = -1, endSid = -1; // 마지막 글자의 글자 모양 · 문단 끝(13) 자리의 글자 모양
      const pushText = (t, id, font, extra) => {
        lastTextSid = id;
        const last = cur.runs[cur.runs.length - 1], link = curLink(), ch = curCh(), fd = curFd();
        const key = (font ? id + ':' + font : id) + (ch ? '|' + ch.id : '') + (fd ? '|' + fd.id : '');
        if (!extra && last && typeof last.text === 'string' && !last.placeholder && lastShapeId === key && lastLink === link) last.text += t;
        else { cur.runs.push(Object.assign(charStyle(id), font ? { font } : null, { text: t }, link ? { link } : null, ch ? { ch } : null, fd ? { fd } : null, extra)); lastShapeId = key; lastLink = link; }
      };
      const text = textRec ? textRec.data : new Uint8Array(0);
      const len = text.length >> 1;
      let sp = 0, ci = 0;
      for (let i = 0; i < len;) {
        while (sp + 1 < shapes.length && shapes[sp + 1].pos <= i) sp++;
        const sid = shapes[sp].id;
        const c = u16(text, i * 2);
        if (c >= 32) {
          let s = '';
          let j = i;
          while (j < len) { const cc = u16(text, j * 2); if (cc < 32 || (sp + 1 < shapes.length && shapes[sp + 1].pos <= j)) break; s += mapChar(cc); j++; }
          const sym = /[-]/.test(s) && symFontOf(sid);
          if (sym) { for (const part of s.split(/([-]+)/)) if (part) pushText(part, sid, /^[-]/.test(part) ? sym : null); }
          else pushText(s, sid);
          i = j;
          continue;
        }
        if (c === 13) { endSid = sid; break; }
        if (c === 10) { pushText('\n', sid); i++; continue; }
        if (c === 24) { pushText('-', sid); i++; continue; }
        if (c === 30 || c === 31) { pushText(c === 30 ? '\u00a0' : '\u2007', sid); i++; continue; }
        if (c === 4 && fields.length) {
          const field = fields[fields.length - 1];
          // 누름틀 끝: 내용이 비어 있으면 자동 채우기 칸 {{이름}} 으로 표시 (저장할 때는 다시 빈 누름틀로)
          const len = cur.runs.reduce((n, r) => n + (r.text ? r.text.length : 1), 0);
          if (field.name && field.runs === cur.runs && len === field.at) pushText(`{{${field.name}}}`, sid, null, { placeholder: true });
          // 내용 없는 필드(책갈피 등)는 자리 표시 조각으로
          if (field.fd && field.runs === cur.runs && len === field.at) cur.runs.push({ field: field.fd, style: charStyle(sid) });
          fields.pop();
          lastShapeId = -1;
        }
        if (INLINE.has(c)) { if (c === 9) pushText('\t', sid); i += 8; continue; }
        if (!EXTENDED.has(c)) { i++; continue; }
        const ctrl = ctrls[ci++];
        i += 8;
        if (!ctrl) continue;
        const name = ctrlName(u32(ctrl.data, 0));
        if (name === '%clk') {
          // 누름틀 시작: 명령 문자열의 안내문(Direction)을 이름으로 사용
          const cmd = wstr(ctrl.data, 9).s;
          const fname = H.clickDirection(cmd).replace(/[{}\n\r]/g, '').trim().slice(0, 40) || '입력';
          fields.push({ name: fname, at: cur.runs.reduce((n, r) => n + (r.text ? r.text.length : 1), 0), runs: cur.runs, ch: { id: 'h' + (++chSeq), name: fname, fname: '', cmd } });
          lastShapeId = -1;
        } else if (name === '%hlk') {
          fields.push({ url: H.unescapeCmd(wstr(ctrl.data, 9).s) });
        } else if (FIELD_TYPES[name]) {
          // 날짜·문서 날짜·사용자 정보·계산식·책갈피: 한글 HWPX 와 같은 fieldBegin 요소로 (한글이 열 때 내용을 새로 고침)
          const node = fieldNode(name, ctrl);
          fields.push(node ? { fd: Object.assign({ id: 'h' + (++chSeq), node }, name === '%ddt' && opts.docDate ? { docDate: opts.docDate } : null), at:cur.runs.reduce((n, r) => n + (r.text ? r.text.length : 1), 0), runs: cur.runs } : {});
          lastShapeId = -1;
        } else if (name[0] === '%') {
          fields.push({});
        } else if (name === 'fn  ' || name === 'en  ') {
          // 각주·미주: 앞의 번호(자동 번호)는 빼고 내용만
          const lh = ctrl.children.findIndex(k => k.tag === T.LIST_HEADER);
          const blocks = await parseParas(lh >= 0 ? listParas(ctrl.children, lh) : descParas(ctrl, []));
          const f = blocks[0] && blocks[0].runs && blocks[0].runs[0];
          if (f && f.text) f.text = f.text.replace(/^\s+/, '');
          cur.runs.push({ note: { kind: name === 'en  ' ? 'end' : 'foot', blocks, style: charStyle(sid) } });
          lastShapeId = -1;
        } else if (name === 'cold') {
          // 다단: 속성의 2~9 비트가 단 수, 그 뒤가 단 사이 간격
          const n = (u16(ctrl.data, 4) >> 2) & 0xff;
          if (n > 1 && !doc.columns) doc.columns = { count: n, gap: mm(u16(ctrl.data, 6)) };
        } else if (name === 'secd') {
          doc.outlineId = u16(ctrl.data, 18) || 1;
          // 구역 정의의 나머지 항목 (첫 구역 것, HWPX 읽기와 같은 모양). 속성 비트(서식 예제와 한글 시험 문서로 확인):
          // 0~2 머리말·꼬리말·바탕쪽 감추기 · 3/8 테두리 첫 쪽 감춤/만 · 4/9 배경 첫 쪽 감춤/만 · 5 쪽 번호 감추기 · 19 빈 줄 감추기 · 20~21 쪽 시작 · 22 원고지 · 24 줄 번호
          if (!doc.sec) {
            const cd = ctrl.data, sa = u32(cd, 4), S = v => String(v), b = k => S((sa >> k) & 1);
            const show = (first, hide) => ((sa >> first) & 1 ? 'SHOW_FIRST' : (sa >> hide) & 1 ? 'HIDE_FIRST' : 'SHOW_ALL');
            const ts = u32(cd, 14);
            // 각주·미주 모양 레코드(74): 속성 · 사용자 기호·앞·뒤 장식 · 시작 번호 · 구분선 길이 · 위·아래·주석 사이 간격 · 선 종류·굵기·색
            const notes = ctrl.children.filter(r => r.tag === 74).map((r, k) => {
              const d = r.data, a = u32(d, 0), ch = o => (u16(d, o) ? String.fromCharCode(u16(d, o)) : '');
              return {
                autoNumFormat: { type: H.numTypeOf(a & 255), userChar: ch(4), prefixChar: ch(6), suffixChar: ch(8), supscript: S((a >> 12) & 1) },
                // 구분선 종류는 탭 채울 모양과 같은 번호 (2 = 점선, 3 = 파선 — 한글로 확인)
                noteLine: { length: S(i32(d, 12)), type: TAB_LEADERS[d[22]] || 'SOLID', width: (w => (w >= 1 ? w.toFixed(1) : S(w)) + ' mm')(LINE_WIDTHS[d[23]] || 0.12), color: colorHex(u32(d, 24)) },
                noteSpacing: { betweenNotes: S(u16(d, 20)), belowLine: S(u16(d, 18)), aboveLine: S(u16(d, 16)) },
                numbering: { type: ['CONTINUOUS', 'ON_SECTION', 'ON_PAGE'][(a >> 10) & 3] || 'CONTINUOUS', newNum: S(u16(d, 10) || 1) },
                placement: { place: k ? ['END_OF_DOCUMENT', 'END_OF_SECTION'][(a >> 8) & 3] || 'END_OF_DOCUMENT' : ['EACH_COLUMN', 'MERGED_COLUMN', 'RIGHT_MOST_COLUMN'][(a >> 8) & 3] || 'EACH_COLUMN', beneathText: S((a >> 13) & 1) },
              };
            });
            // 글 방향은 36번째 값(2 = 세로, 4 = 영문도 세로), 줄 번호 모양은 38번째부터: 다시 매기기(1) · 간격 단위(2) · 본문과 거리(2) · 예약(2) · 시작 번호(2) — 한글로 확인
            doc.sec = {
              attrs: { textDirection: { 2: 'VERTICAL', 4: 'VERTICALALL' }[cd[36]] || 'HORIZONTAL', spaceColumns: S(u16(cd, 8)), tabStop: S(ts), tabStopVal: S(Math.round(ts / 2)), tabStopUnit: 'HWPUNIT' },
              grid: { lineGrid: S(u16(cd, 10)), charGrid: S(u16(cd, 12)), wonggojiFormat: b(22) },
              startNum: { pageStartsOn: ['BOTH', 'EVEN', 'ODD'][(sa >> 20) & 3] || 'BOTH', page: S(u16(cd, 20)), pic: S(u16(cd, 22)), tbl: S(u16(cd, 24)), equation: S(u16(cd, 26)) },
              visibility: { hideFirstHeader: b(0), hideFirstFooter: b(1), hideFirstMasterPage: b(2), border: show(8, 3), fill: show(9, 4), hideFirstPageNum: b(5), hideFirstEmptyLine: b(19), showLineNumber: b(24) },
              lineNumberShape: cd.length >= 47 ? { restartType: S(cd[38]), countBy: S(u16(cd, 39)), distance: S(u16(cd, 41)), startNumber: S(u16(cd, 45)) } : null,
              foot: notes[0] || null, end: notes[1] || null,
            };
          }
          // 쪽 테두리/배경 (양쪽·짝수·홀수 순서) — 테두리도 배경도 없는 것은 빼고
          const pbs = [];
          let pk = 0;
          for (const r of ctrl.children) {
            if (r.tag !== 75) continue;
            const type = ['BOTH', 'EVEN', 'ODD'][pk++] || 'BOTH';
            const a = u32(r.data, 0), f = info.fills[u16(r.data, 12) - 1];
            if (!f) continue;
            const im = f.img ? await image(f.img.binId, 0, 0) : null;
            if (!im && !f.bg && ['l', 'r', 't', 'b'].every(k => f.borders[k].type === 'NONE')) continue;
            pbs.push({ type, textBorder: a & 1 ? 'PAPER' : 'CONTENT', headerInside: !!(a & 2), footerInside: !!(a & 4), fillArea: ['PAPER', 'PAGE', 'BORDER'][(a >> 3) & 3] || 'PAPER',
              offset: { l: u16(r.data, 4), r: u16(r.data, 6), t: u16(r.data, 8), b: u16(r.data, 10) }, sides: f.borders, bg: f.bg,
              img: im ? { mime: im.mime, data: im.data, mode: IMG_MODES[f.img.mode] || 'TILE' } : null });
          }
          if (pbs.length && !doc.pageBorders) doc.pageBorders = pbs;
          // 바탕쪽: 구역 정의 바로 아래 목록 머리(글 폭·높이) + 문단들
          if (!doc.masterPages) {
            const mps = [];
            ctrl.children.forEach((r, idx) => {
              if (r.tag !== T.LIST_HEADER) return;
              mps.push({ idx, textWidth: u32(r.data, 8), textHeight: u32(r.data, 12) });
            });
            for (const mp of mps) {
              const blocks = await parseParas(listParas(ctrl.children, mp.idx));
              if (!blocks.length) continue;
              (doc.masterPages = doc.masterPages || []).push({ type: ['BOTH', 'EVEN', 'ODD'][doc.masterPages ? doc.masterPages.length : 0] || 'BOTH', attrs: { pageNumber: '0', pageDuplicate: '0', pageFront: '0' },
                sub: { id: '', textDirection: 'HORIZONTAL', lineWrap: 'BREAK', vertAlign: 'TOP', linkListIDRef: '0', linkListNextIDRef: '0', textWidth: String(mp.textWidth), textHeight: String(mp.textHeight), hasTextRef: '0', hasNumRef: '0' }, blocks });
            }
          }
          const pd = ctrl.children.find(k => k.tag === T.PAGE_DEF);
          if (pd && !doc.pageSet) { // 용지 설정은 첫 구역 것을 씀
            doc.pageSet = true;
            const d = pd.data, w = mm(u32(d, 0)), hh = mm(u32(d, 4));
            const paper = Object.keys(H.PAPERS).find(k => Math.abs(H.PAPERS[k][0] - w) < 1 && Math.abs(H.PAPERS[k][1] - hh) < 1) || '사용자 정의';
            doc.page = { paper, width: w, height: hh, landscape: !!(u32(d, 36) & 1),
              margin: { left: mm(u32(d, 8)), right: mm(u32(d, 12)), top: mm(u32(d, 16)), bottom: mm(u32(d, 20)), header: mm(u32(d, 24)), footer: mm(u32(d, 28)) },
              // 원래 HWPUNIT 값 (mm 는 0.1 단위로 줄인 값)
              hu: { width: u32(d, 0), height: u32(d, 4), left: u32(d, 8), right: u32(d, 12), top: u32(d, 16), bottom: u32(d, 20), header: u32(d, 24), footer: u32(d, 28) } };
          }
        } else if (name === 'tbl ') {
          // 표는 문단 안 자리 그대로 두었다가 문단 끝에서 정리 (H.settleTables)
          cur.runs.push({ table: await parseTable(ctrl), style: charStyle(sid) });
          lastShapeId = -1;
        } else if (name === 'gso ') {
          const comp = ctrl.children.find(k => k.tag === T.SHAPE_COMPONENT);
          const pic = comp && ctrlName(u32(comp.data, 0)) === '$pic' && objPlace(ctrl.data).inline && findDesc(ctrl, T.SHAPE_PICTURE);
          if (pic) {
            // 글자처럼 취급한 그림은 그림 글자로 (편집기에서 크기 조절 가능)
            const img = await image(u16(pic.data, 71), u32(ctrl.data, 16), u32(ctrl.data, 20));
            if (img) cur.runs.push({ image: img, style: charStyle(sid) }); else skipped++;
          } else {
            const node = comp && await readShapeComp(comp, ctrl.data, ctrl.children);
            if (node) cur.runs.push({ shape: node, style: charStyle(sid) }); else skipped++;
          }
          lastShapeId = -1;
        } else if (name === 'head' || name === 'foot') {
          const key = name === 'head' ? 'header' : 'footer';
          if (key === 'footer' && !doc.header && !doc.footer && doc.sec) doc.sec.footerFirst = true; // 꼬리말이 먼저
          const lh = ctrl.children.findIndex(k => k.tag === T.LIST_HEADER);
          const blocks = await parseParas(lh >= 0 ? listParas(ctrl.children, lh) : descParas(ctrl, []));
          // 빈 머리말·꼬리말도 한글처럼 둠 (빈 문단 하나 — 워드 호환 문서는 그 높이가 본문 시작에 들어감)
          if (!doc[key]) { if (blocks.length) doc[key] = blocks; }
          // 둘째부터는 그 자리에 (그 쪽부터 바뀜)
          else cur.runs.push({ hf: { kind: key, apply: ['BOTH', 'EVEN', 'ODD'][u32(ctrl.data, 4) & 3] || 'BOTH', blocks }, style: charStyle(sid) });
        } else if (name === 'pgnp') {
          const pos = PN_POS[(u32(ctrl.data, 4) >> 8) & 15];
          if (pos) doc.pageNum = { pos, dash: u16(ctrl.data, 10) === 0x2d || u16(ctrl.data, 12) === 0x2d };
        } else if (name === 'atno') {
          // 자동 번호(쪽 번호 넣기 등): 종류(0~3비트) · 모양(4~11비트) · 위 첨자(12비트) · 번호 · 사용자 기호 · 앞뒤 장식
          const ad = ctrl.data, at = u32(ad, 4);
          const ch = k => (u16(ad, k) ? String.fromCharCode(u16(ad, k)) : '');
          cur.runs.push({ autoNum: { numType: ['PAGE', 'FOOTNOTE', 'ENDNOTE', 'PICTURE', 'TABLE', 'EQUATION'][at & 15] || 'PAGE', num: u16(ad, 8) || 1,
            format: { type: H.numTypeOf((at >> 4) & 255), userChar: ch(10), prefixChar: ch(12), suffixChar: ch(14), supscript: (at >> 12) & 1 } }, style: charStyle(sid) });
          lastShapeId = -1;
        } else if (name === 'tcps') {
          // 글자 겹침: 글자 수·글자 · 테두리 종류 · 크기 · 겹침 방식 · 글자 모양 수·번호들
          const cd = ctrl.data, n = u16(cd, 4);
          let text = '';
          for (let k = 0; k < n; k++) text += String.fromCharCode(u16(cd, 6 + k * 2));
          const o = 6 + n * 2, cnt = cd[o + 3];
          const refs = [];
          for (let k = 0; k < cnt; k++) refs.push(u32(cd, o + 4 + k * 4));
          cur.runs.push({ compose: { text, circleType: ['CHAR', 'SHAPE_CIRCLE', 'SHAPE_REVERSAL_CIRCLE', 'SHAPE_RECTANGLE', 'SHAPE_REVERSAL_RECTANGLE', 'SHAPE_TRIANGLE', 'SHAPE_REVERSAL_TRIANGLE', 'SHAPE_LIGHT', 'SHAPE_RHOMBUS', 'SHAPE_REVERSAL_RHOMBUS', 'SHAPE_ROUNDED_RECTANGLE', 'SHAPE_EMPTY_CIRCULATE_TRIANGLE', 'SHAPE_THIN_CIRCULATE_TRIANGLE', 'SHAPE_THICK_CIRCULATE_TRIANGLE'][cd[o]] || 'CHAR', charSz: i8(cd, o + 1), composeType: cd[o + 2] ? 'OVERLAP' : 'SPREAD', refs }, style: charStyle(sid) });
          lastShapeId = -1;
        } else if (name === 'eqed' || name === 'form') {
          const node = name === 'eqed' ? readEquation(ctrl) : readForm(ctrl);
          if (node) cur.runs.push({ shape: node, style: charStyle(sid) }); else skipped++;
          lastShapeId = -1;
        }
      }
      if (cur.runs.length || !out.length) {
        // 빈 문단도 글자 크기를 지녀야 줄 높이가 원본과 같음 (양식의 1pt 빈 줄 등)
        if (!cur.runs.some(r => !r.field)) cur.mark = charStyle(shapes[0].id);
        // 문단 끝 글자 모양이 마지막 글자와 다르면 보관 (한글은 이것도 줄 높이에 넣음)
        // 마지막 조각이 개체(그림·도형·표 등)이고 같은 모양이면 한글은 끝 표시를 그 개체 run 에 합침 (HOME25 로 확인)
        else if (endSid >= 0 && lastTextSid >= 0 && cur.runs.some(r => r.text)) {
          const last = cur.runs.filter(r => r.text || r.image || r.shape || r.table || r.autoNum || r.compose || r.note).pop();
          const lastStyle = last.text ? null : last.style || (last.note && last.note.style);
          if (last.text ? endSid !== lastTextSid : JSON.stringify(lastStyle) !== JSON.stringify(charStyle(endSid))) cur.endMark = charStyle(endSid);
        }
        out.push(...H.settleTables(cur));
      }
      return out;
    }

    for (let s = 0; files[(distributed ? 'ViewText/Section' : 'BodyText/Section') + s]; s++) {
      const data = distributed ? await viewTextSection(files['ViewText/Section' + s], compressed) : await load('BodyText/Section' + s);
      const recs = tree(records(data));
      const blocks = await parseParas(recs);
      if (s > 0 && blocks[0]) blocks[0].pageBreak = true; // 구역이 바뀌면 새 쪽에서 시작 (한글과 같음)
      doc.blocks.push(...blocks);
    }
    if (distributed) doc.distributed = true;
    H.fixTableWidths(doc);
    doc.skipped = skipped;
    // 글꼴 정보(종류·대체 글꼴·분류): 언어별 이름마다 — HWPX 로 저장할 때 그대로
    const LANGS = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'], fontInfo = {};
    info.faces.forEach((list, k) => { const m = fontInfo[LANGS[k]] = {}; list.forEach((nm, i) => { if (!m[nm] && info.faceMeta[k][i]) m[nm] = info.faceMeta[k][i]; }); });
    if (info.fontMeta.length) doc.fontInfo = fontInfo;
    doc.styles = info.styles.length ? info.styles.map((st, i) => ({ name: i ? st.name : '바탕글', engName: st.engName, type: st.type, next: st.next, langId: st.langId, lockForm: st.lockForm, para: paraStyle(st.para), char: charStyle(st.char) })) : null;
    return doc;
  }

  g.PureunHwp = { readHwp, readCfb, AES, distributeKey };
})(typeof window !== 'undefined' ? window : globalThis);
