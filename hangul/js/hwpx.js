// 문서 모델 ↔ HWPX 변환
// 모델(doc):
//   page     { paper, width, height (mm, 세로 기준), landscape, margin { top, bottom, left, right, header, footer } (mm) }
//   header / footer : 블록 배열 또는 null      pageNum { pos: 'BOTTOM_CENTER' 등, dash: true } 또는 null
//   blocks   [ 문단 | 표 ]
//   문단 { type:'p', align, lineSpacing(%), indent(pt, 음수=내어쓰기), left, right, before, after (pt), pageBreak, runs }
//   글자 { text, font, size(pt), bold, italic, underline, strike, sup, sub, color, shade, spacing(%) }
//        또는 그림 { image: { mime, data(Uint8Array), w, h (mm) } }
//   표   { type:'table', colWidths:[비율], widthRatio, rows:[[{ colSpan, rowSpan, bg, valign, blocks }]] }
(function (g) {
  const MM = 7200 / 25.4; // 1mm 당 HWPUNIT
  const PAPERS = { A4: [210, 297], A3: [297, 420], A5: [148, 210], B4: [257, 364], B5: [182, 257], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
  const defaultPage = () => ({ paper: 'A4', width: 210, height: 297, landscape: false, margin: { top: 20, bottom: 15, left: 30, right: 30, header: 15, footer: 15 } });
  const DEFAULT_FONT = '함초롬바탕';
  const LANGS = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'];
  const LANG_ATTRS = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'];
  // 글꼴 정보(종류 TTF·HFT, 대체 글꼴, 글꼴 분류): 한글은 HFT(한글 전용) 글꼴을 자기 글꼴로 그리므로 종류를 잃으면 줄 배치가 달라짐 (sample19 한양견명조)
  //  HWP 글꼴 레코드의 분류 10바이트 = 계열·(세리프)·굵기·비례·대비·획 변화·팔 모양·글자 모양·중간선·x높이 (HWPX typeInfo 는 세리프 없음 — 한글 변환과 대조)
  //  계열 번호: 1 명조 · 2 고딕 은 한글 변환으로 확인, 나머지는 OWPML 순서 [확인 필요]
  const FCAT = ['FCAT_UNKNOWN', 'FCAT_MYUNGJO', 'FCAT_GOTHIC', 'FCAT_SSERIF', 'FCAT_BRUSHSCRIPT', 'FCAT_DECORATIVE', 'FCAT_NONRECTMJ', 'FCAT_NONRECTGT'];
  const TYPE_INFO_KEYS = ['weight', 'proportion', 'contrast', 'strokeVariation', 'armStyle', 'letterform', 'midline', 'xHeight'];
  const typeInfoOf = b => Object.assign({ familyType: FCAT[b[0]] || 'FCAT_GOTHIC' }, ...TYPE_INFO_KEYS.map((k, i) => ({ [k]: String(b[i + 2] || 0) })));
  const DEFAULT_TYPE_INFO = { familyType: 'FCAT_GOTHIC', weight: '6', proportion: '4', contrast: '0', strokeVariation: '1', armStyle: '1', letterform: '1', midline: '1', xHeight: '1' };
  const ALIGN_OUT = { left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFY', distribute: 'DISTRIBUTE' };
  const ALIGN_IN = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFY: 'justify', DISTRIBUTE: 'distribute', DISTRIBUTE_SPACE: 'distribute' };
  const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
  const NS = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"';
  const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/wmf': 'wmf', 'image/emf': 'emf', 'image/tiff': 'tif', 'image/svg+xml': 'svg', 'application/ole': 'ole' };

  const hu = mm => Math.round(mm * MM);
  // 테두리: 변 하나 = { type: 'SOLID' 등 HWPX 선 종류, width(mm), color }
  const LINE_WIDTHS = [0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0];
  const DEFAULT_SIDE = { type: 'SOLID', width: 0.12, color: '#000000' };
  const sideKey = s => `${(s && s.type) || 'SOLID'},${s ? s.width : 0.12},${((s && s.color) || '#000000').toUpperCase()}`;
  const isDefaultSide = s => !s || sideKey(s) === sideKey(DEFAULT_SIDE);
  // 네 변 모두 기본(0.12mm 검정 실선)이면 null 로 단순화
  const compactBorders = b => (!b || ['l', 'r', 't', 'b'].every(k => isDefaultSide(b[k])) ? null : b);
  // 셀 안쪽 여백 (mm). 한글 기본 = 좌우 1.8, 위아래 0.5
  const DEFAULT_MARGIN = { l: 1.8, r: 1.8, t: 0.5, b: 0.5 };
  const compactMargin = m => (!m || ['l', 'r', 't', 'b'].every(k => Math.abs((m[k] || 0) - DEFAULT_MARGIN[k]) < 0.05) ? null : m);
  const widthStr = w => { const n = LINE_WIDTHS.reduce((a, c) => (Math.abs(c - w) < Math.abs(a - w) ? c : a), 0.12); return (n >= 1 ? n.toFixed(1) : String(n)) + ' mm'; };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const langAttrs = v => LANG_ATTRS.map((l, i) => `${l}="${Array.isArray(v) ? v[i] : v}"`).join(' ');
  // 언어별(한글·영문·한자·일어·외국어·기호·사용자) 글꼴 f · 장평 r · 자간 s · 상대 크기 z · 글자 위치 o
  // 언어마다 같고 상대 크기 100·위치 0 이면 없음(undefined), 아니면 다른 항목만 담은 JSON 문자열 → 글자의 langs (화면에서는 data-lang)
  function makeLangs(f, r, s, z, o) {
    const out = {};
    const diff = a => a && a.some(v => v !== a[0]);
    if (diff(f)) out.f = f;
    if (diff(r)) out.r = r;
    if (diff(s)) out.s = s;
    if (z && z.some(v => v !== 100)) out.z = z;
    if (o && o.some(v => v !== 0)) out.o = o;
    return Object.keys(out).length ? JSON.stringify(out) : undefined;
  }
  const parseLangs = s => { try { return s ? JSON.parse(s) : {}; } catch (e) { return {}; } };
  // 글자 효과 중 굵게·기울임·밑줄 여부 밖의 것: 밑줄 u(종류/모양/색) · 취소선 s(모양/색) · 외곽선 o · 그림자 sh(종류/색/x/y)
  //  · 양각 em · 음각 en · 커닝 k · 글꼴에 어울리는 빈칸 fs · 강조점 sym. 기본값과 다른 것만 담은 JSON 문자열 → 글자의 fx (화면에서는 data-fx)
  const makeFx = o => { const out = {}; for (const [k, v] of Object.entries(o)) if (v) out[k] = v; return Object.keys(out).length ? JSON.stringify(out) : undefined; };
  const parseFx = s => { try { return s ? JSON.parse(s) : {}; } catch (e) { return {}; } };
  // 한글 HWPX charPr 의 효과 요소 → fx (textColor 와 같은 색·실선 아래 밑줄은 기본이라 빼고)
  function fxOfCharPr(c, kid) {
    const tc = (c.getAttribute('textColor') || '#000000').toUpperCase();
    const ul = kid(c, 'underline'), so = kid(c, 'strikeout'), ol = kid(c, 'outline'), sh = kid(c, 'shadow');
    const o = {};
    if (ul && ul.getAttribute('type') && ul.getAttribute('type') !== 'NONE') {
      const t = ul.getAttribute('type'), shp = ul.getAttribute('shape') || 'SOLID', col = (ul.getAttribute('color') || tc).toUpperCase();
      if (t !== 'BOTTOM' || shp !== 'SOLID' || col !== tc) o.u = [t, shp, col].join('/');
    }
    if (so && so.getAttribute('shape') && !/^(NONE|3D)$/.test(so.getAttribute('shape'))) {
      const shp = so.getAttribute('shape'), col = (so.getAttribute('color') || tc).toUpperCase();
      if (shp !== 'SOLID' || col !== tc) o.s = [shp, col].join('/');
    }
    if (ol && ol.getAttribute('type') && ol.getAttribute('type') !== 'NONE') o.o = ol.getAttribute('type');
    if (sh && sh.getAttribute('type') && sh.getAttribute('type') !== 'NONE') o.sh = [sh.getAttribute('type'), (sh.getAttribute('color') || '#C0C0C0').toUpperCase(), sh.getAttribute('offsetX') || '10', sh.getAttribute('offsetY') || '10'].join('/');
    if (kid(c, 'emboss')) o.em = 1;
    if (kid(c, 'engrave')) o.en = 1;
    if (c.getAttribute('useKerning') === '1') o.k = 1;
    if (c.getAttribute('useFontSpace') === '1') o.fs = 1;
    if (c.getAttribute('symMark') && c.getAttribute('symMark') !== 'NONE') o.sym = c.getAttribute('symMark');
    return makeFx(o);
  }
  // 문단 모양 중 정렬·여백·줄 간격·문단 머리 밖의 것 (공백 최소값·줄 나눔 기준·쪽 나눔 설정·세로 정렬·탭·문단 테두리 등)
  // 기본값과 다른 것만 담은 JSON 문자열 → 문단의 pp (화면에서는 data-pp). 기본값은 한글 새 문서의 바탕글과 같음
  const PP_DEFAULTS = { condense: 0, fontLineHeight: 0, snapToGrid: 1, breakLatinWord: 'KEEP_WORD', breakNonLatinWord: 'KEEP_WORD', widowOrphan: 0, keepWithNext: 0, keepLines: 0,
    pageBreakBefore: 0, lineWrap: 'BREAK', vertical: 'BASELINE', eAsianEng: 0, eAsianNum: 0 };
  function makePP(o) {
    const out = {};
    for (const k of Object.keys(PP_DEFAULTS)) if (o[k] !== undefined && o[k] !== PP_DEFAULTS[k]) out[k] = o[k];
    // 탭: l·r = 내어쓰기용·문단 오른쪽 끝 자동 탭, items = [위치(HWPUNIT), 종류, 채울 모양]
    if (o.tabs && (o.tabs.l || o.tabs.r || o.tabs.items.length)) out.tabs = o.tabs;
    // 문단 테두리·배경: sides(네 변) · bg · off(간격 왼·오·위·아래 HWPUNIT) · connect(테두리 연결) · ignoreMargin(문단 여백 무시)
    if (o.border) out.border = o.border;
    return Object.keys(out).length ? JSON.stringify(out) : undefined;
  }
  const parsePP = s => Object.assign({}, PP_DEFAULTS, parseLangs(s));
  const TAB_XML = '<hp:tab width="4000" leader="0" type="1"/>';
  // 묶음 빈칸(U+00A0)·고정폭 빈칸(U+2007)은 한글의 nbSpace·fwSpace 로.
  // 글자로서의 U+00A0(웹에서 가져온 문서 등)은 모델에서 U+00A0 + U+FEFF(보이지 않음)로 구별해 두고 글자 그대로 씀
  const NBSP_LIT = '\u00a0\ufeff';
  const textXml = t => t.split('\n').map(line => line.split('\t').map(x => esc(x).replace(/\u00a0(?!\ufeff)/g, '<hp:nbSpace/>').replace(/\ufeff/g, '').replace(/\u2007/g, '<hp:fwSpace/>')).join(TAB_XML)).join('<hp:lineBreak/>');

  // 한컴 전용 기호(사용자 영역 U+F0000~) → 일반 유니코드. 확인된 것만 (kordoc·rhwp 대조표 참고, MIT)
  const PUA_MAP = { 0xF012B: '(인)', 0xF00E1: '(인)', 0xF003B: '↓', 0xF02EF: '·', 0xF00DA: '▸', 0xF02FC: '►', 0xF031C: '■', 0xF03C5: '□', 0xF02EC: '◇', 0xF02FB: '▸', 0xF0090: '✺', 0xF0288: '⓪', 0xF028B: '③' };
  function puaChar(cp) {
    if (cp >= 0xf02b1 && cp <= 0xf02c4) return String.fromCharCode(0x2460 + cp - 0xf02b1); // ①~⑳
    if (cp >= 0xf0289 && cp <= 0xf0291) return String.fromCharCode(0x2460 + cp - 0xf0289); // ①~⑨
    return PUA_MAP[cp];
  }
  // 기호 글꼴(Wingdings 등) 문자는 U+E000~F8FF 에 있고 글꼴이 따로 지정됨 → 그 부분만 기호 글꼴 글자로 나눔
  const SYMBOL_FONT = /wingdings|webdings|symbol|marlett|dingbat/i;
  function splitSymbols(text, style, symFonts) {
    const sym = (symFonts || []).find(f => f && SYMBOL_FONT.test(f));
    if (!sym || !/[-]/.test(text)) return [Object.assign({}, style, { text })];
    const out = [];
    for (const part of text.split(/([-]+)/)) if (part) out.push(Object.assign({}, style, { text: part }, /^[-]/.test(part) ? { font: sym } : null));
    return out;
  }
  // 필드 명령 문자열: '\:' 등은 escape, ';' 앞까지가 주소
  // 날짜 필드 형식(DateFormat) → 글자. 한글이 저장한 서식 392개의 형식·결과로 확인한 기호만
  //  YYYY 연도 · YY 연도 두 자리 · M 월 · D 일 · MMMMMMMMM 영어 달 이름 · E 요일(일~토) · G 요일 한자(日~土)
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function formatDate(fmt, d) {
    const T = [['MMMMMMMMM', () => MONTHS[d.getMonth()]], ['YYYY', () => String(d.getFullYear())], ['YY', () => String(d.getFullYear() % 100).padStart(2, '0')],
      ['M', () => String(d.getMonth() + 1)], ['D', () => String(d.getDate())], ['E', () => '일월화수목금토'[d.getDay()]], ['G', () => '日月火水木金土'[d.getDay()]]];
    let out = '';
    for (let i = 0; i < fmt.length;) {
      const t = T.find(([k]) => fmt.startsWith(k, i));
      if (t) { out += t[1](); i += t[0].length; } else out += fmt[i++];
    }
    return out;
  }
  // 날짜 필드의 값: 현재 날짜(DATE)는 오늘, 만든 날짜(DOC_DATE)는 서식에서 새로 만든 문서일 때(docDate)만. 그 밖은 null (저장된 글자 그대로)
  function fieldDate(fd) {
    const n = fd && fd.node, type = n && n.attrs && n.attrs.type;
    if (type !== 'DATE' && !(type === 'DOC_DATE' && fd.docDate)) return null;
    const ps = (n.kids || []).find(k => /parameters$/.test(k.tag));
    const f = ps && (ps.kids || []).find(k => k.attrs && k.attrs.name === 'DateFormat');
    if (!f || !f.txt) return null;
    return formatDate(f.txt, type === 'DATE' ? new Date() : new Date(fd.docDate));
  }
  const unescapeCmd = c => { let out = ''; for (let i = 0; i < c.length; i++) { if (c[i] === '\\' && i + 1 < c.length) { out += c[++i]; continue; } if (c[i] === ';') break; out += c[i]; } return out; };
  // 누름틀 명령의 안내문: "Clickhere:set:N:Direction:wstring:길이:안내문 …" 또는 간단형 "안내문;"
  const clickDirection = c => { const m = /Direction:wstring:(\d+):/.exec(c); return m ? c.substr(m.index + m[0].length, +m[1]) : unescapeCmd(c); };
  const mapPuaText = s => (/[\u{F0000}-\u{FFFFD}]/u.test(s) ? Array.from(s, ch => puaChar(ch.codePointAt(0)) || ch).join('') : s);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  // ================= 문단 번호·글머리표 =================
  // 번호 모양 (HWP 번호 모양 값 0~16 의 순서와 같음). 0x80 = 기호 4가지 반복, 0x81 = 사용자 기호
  const NUM_TYPES = ['DIGIT', 'CIRCLED_DIGIT', 'ROMAN_CAPITAL', 'ROMAN_SMALL', 'LATIN_CAPITAL', 'LATIN_SMALL', 'CIRCLED_LATIN_CAPITAL', 'CIRCLED_LATIN_SMALL',
    'HANGUL_SYLLABLE', 'CIRCLED_HANGUL_SYLLABLE', 'HANGUL_JAMO', 'CIRCLED_HANGUL_JAMO', 'HANGUL_PHONETIC', 'IDEOGRAPH', 'CIRCLED_IDEOGRAPH', 'DECAGON_CIRCLE', 'DECAGON_CIRCLE_HANJA'];
  const numTypeOf = v => (v === 0x80 ? 'SYMBOL' : v === 0x81 ? 'USER_CHAR' : NUM_TYPES[v] || 'DIGIT');
  const HEAD_TYPES = ['OUTLINE', 'NUMBER', 'BULLET'];
  const LINE_TYPES_OUT = ['PERCENT', 'FIXED', 'BETWEEN_LINES', 'AT_LEAST'];
  // 한글 기본 개요 번호: 1. 가. 1) 가) (1) (가) ①
  const DEFAULT_OUTLINE = [['^1.', 'DIGIT'], ['^2.', 'HANGUL_SYLLABLE'], ['^3)', 'DIGIT'], ['^4)', 'HANGUL_SYLLABLE'], ['(^5)', 'DIGIT'], ['(^6)', 'HANGUL_SYLLABLE'], ['^7', 'CIRCLED_DIGIT']]
    .map(([format, type], i) => ({ level: i + 1, format, type, start: 1 }));
  const roman = n => { const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s; };
  const seq = (list, n) => (n >= 1 && n <= list.length ? list[n - 1] : String(n));
  function numText(type, n) {
    switch (type) {
      case 'CIRCLED_DIGIT': return n >= 1 && n <= 20 ? String.fromCharCode(0x2460 + n - 1) : String(n);
      case 'ROMAN_CAPITAL': return roman(n);
      case 'ROMAN_SMALL': return roman(n).toLowerCase();
      case 'LATIN_CAPITAL': return n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : String(n);
      case 'LATIN_SMALL': return n >= 1 && n <= 26 ? String.fromCharCode(96 + n) : String(n);
      case 'CIRCLED_LATIN_CAPITAL': return n >= 1 && n <= 26 ? String.fromCharCode(0x24b6 + n - 1) : String(n);
      case 'CIRCLED_LATIN_SMALL': return n >= 1 && n <= 26 ? String.fromCharCode(0x24d0 + n - 1) : String(n);
      case 'HANGUL_SYLLABLE': return seq([...'가나다라마바사아자차카타파하'], n);
      case 'CIRCLED_HANGUL_SYLLABLE': return n >= 1 && n <= 14 ? String.fromCharCode(0x326e + n - 1) : String(n);
      case 'HANGUL_JAMO': return seq([...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'], n);
      case 'CIRCLED_HANGUL_JAMO': return n >= 1 && n <= 14 ? String.fromCharCode(0x3260 + n - 1) : String(n);
      case 'HANGUL_PHONETIC': return seq(['일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십'], n);
      case 'IDEOGRAPH': return seq([...'一二三四五六七八九十'], n);
      case 'CIRCLED_IDEOGRAPH': return n >= 1 && n <= 10 ? String.fromCharCode(0x3280 + n - 1) : String(n);
      default: return String(n);
    }
  }
  // 문단 머리 글자 계산기: 문서 순서대로 heads(문단의 head)를 넣으면 표시할 글자를 돌려줌
  function headCounter(doc) {
    const defs = {}, bullets = {}, counters = {};
    for (const nb of doc.numberings || []) defs[nb.id] = nb;
    for (const b of doc.bullets || []) bullets[b.id] = b;
    return head => {
      if (!head) return '';
      if (head.type === 'BULLET') return (bullets[head.id] && bullets[head.id].char) || '•';
      const id = head.type === 'OUTLINE' ? (doc.outlineId || 1) : head.id;
      const def = defs[id] || (head.type === 'OUTLINE' || !defs[id] ? { levels: DEFAULT_OUTLINE } : null);
      const lv = Math.max(0, Math.min(9, head.level || 0));
      const c = counters[id] = counters[id] || [];
      const lvDef = l => (def.levels || []).find(x => x.level === l + 1) || DEFAULT_OUTLINE[Math.min(l, 6)];
      c[lv] = c[lv] ? c[lv] + 1 : (lvDef(lv).start || 1);
      for (let k = lv + 1; k < 10; k++) c[k] = 0;
      const fmt = lvDef(lv).format;
      return fmt.replace(/\^(\d+)/g, (m, d) => { const l = +d - 1; return numText(lvDef(l).type, c[l] || lvDef(l).start || 1); }).replace(/\^N/g, '');
    };
  }

  // 문단 머리 정의 찾기 (글머리표 또는 번호 수준): 글자 모양(style)·본문과의 간격(off, offType) 등 — 화면에 머리 글자를 그릴 때 씀
  function headDef(doc) {
    return head => {
      if (!head) return null;
      if (head.type === 'BULLET') return (doc.bullets || []).find(b => b.id === head.id) || null;
      const id = head.type === 'OUTLINE' ? (doc.outlineId || 1) : head.id;
      const nb = (doc.numberings || []).find(n => n.id === id);
      return nb ? (nb.levels || []).find(x => x.level === Math.max(0, Math.min(9, head.level || 0)) + 1) || null : null;
    };
  }

  // ================= 쓰기 =================

  function makeRegistry() {
    const fonts = [DEFAULT_FONT], chars = [], charKeys = [], paras = [], paraKeys = [], fills = [];
    const images = [];
    const fontId = f => { let i = fonts.indexOf(f); if (i < 0) i = fonts.push(f) - 1; return i; };
    function charId(r) {
      r = r || {};
      const font = r.font || DEFAULT_FONT;
      const spacing = Math.max(-50, Math.min(50, Math.round(num(r.spacing, 0)))), ratio = Math.max(50, Math.min(200, Math.round(num(r.ratio, 100))));
      // 언어별 값은 한글 값이 지금 글자와 같을 때만 씀 (편집기에서 글꼴·장평·자간을 바꾸면 모든 언어에 같은 값 — 한글의 '대표' 바꾸기와 같음)
      const L = parseLangs(r.langs);
      const per = (a, cur, lo, hi) => (a && a.length === 7 && a[0] === cur ? a.map(v => Math.max(lo, Math.min(hi, Math.round(v)))) : cur);
      const c = {
        font: L.f && L.f.length === 7 && L.f[0] === font ? L.f.map(fontId) : fontId(font), height: Math.round(num(r.size, 10) * 100),
        bold: !!r.bold, italic: !!r.italic, underline: !!r.underline, strike: !!r.strike,
        sup: !!r.sup, sub: !!r.sub && !r.sup,
        color: (r.color || '#000000').toUpperCase(), shade: r.shade ? r.shade.toUpperCase() : 'none',
        spacing: per(L.s, spacing, -50, 50), ratio: per(L.r, ratio, 50, 200),
        relSz: L.z && L.z.length === 7 ? L.z.map(v => Math.max(10, Math.min(250, Math.round(v)))) : 100,
        offset: L.o && L.o.length === 7 ? L.o.map(v => Math.max(-100, Math.min(100, Math.round(v)))) : 0,
        fx: r.fx || '',
      };
      const k = JSON.stringify(c);
      let i = charKeys.indexOf(k);
      if (i < 0) { i = charKeys.push(k) - 1; chars.push(c); }
      return i;
    }
    function paraId(p) {
      p = p || {};
      // 줄 간격: PERCENT 는 %, 그 밖(고정 값·최소·여백만)은 pt 값을 HWPUNIT 으로
      const lineType = LINE_TYPES_OUT.includes(p.lineType) ? p.lineType : 'PERCENT';
      const c = {
        align: ALIGN_OUT[p.align] || 'JUSTIFY', lineType,
        line: lineType === 'PERCENT' ? Math.round(num(p.lineSpacing, 160)) : Math.round(num(p.lineValue, 12) * 100),
        indent: Math.round(num(p.indent, 0) * 100), left: Math.round(num(p.left, 0) * 100), right: Math.round(num(p.right, 0) * 100),
        before: Math.round(num(p.before, 0) * 100), after: Math.round(num(p.after, 0) * 100),
        head: p.head && HEAD_TYPES.includes(p.head.type) ? `${p.head.type}:${p.head.id || 0}:${p.head.level || 0}` : '',
        pp: p.pp || '',
      };
      // 탭 정의·문단 테두리 번호는 머리말 XML 을 만들기 전에 등록해 둠
      const x = parsePP(c.pp);
      c.tab = tabId(x.tabs);
      c.bf = x.border ? fillId({ bg: x.border.bg, borders: x.border.sides }) : 1;
      const k = JSON.stringify(c);
      let i = paraKeys.indexOf(k);
      if (i < 0) { i = paraKeys.push(k) - 1; paras.push(c); }
      return i;
    }
    // 테두리/배경: 1 = 없음, 2 = 표 기본 실선, 3~ = 셀마다 다른 테두리·배경색
    const fillKeys = [];
    function fillId(cell) {
      const bg = cell && cell.bg ? cell.bg.toUpperCase() : null, bs = cell && compactBorders(cell.borders);
      if (!bg && !bs) return 2;
      const sides = ['l', 'r', 't', 'b'].map(k => (bs && bs[k]) || DEFAULT_SIDE);
      const k = bg + '|' + sides.map(sideKey).join('|');
      let i = fillKeys.indexOf(k);
      if (i < 0) { i = fillKeys.push(k) - 1; fills.push({ bg, sides }); }
      return i + 3;
    }
    // 쪽 테두리/배경: 테두리 4면 + 배경색 또는 그림
    function pageFillId(pb) {
      const sides = ['l', 'r', 't', 'b'].map(k => (pb.sides && pb.sides[k]) || { type: 'NONE', width: 0.1, color: '#000000' });
      fills.push({ bg: pb.bg || null, sides, img: pb.img ? { ref: imageId(pb.img), mode: pb.img.mode || 'TOTAL' } : null });
      fillKeys.push('page' + fills.length);
      return fills.length + 2;
    }
    function imageId(img) {
      const ext = MIME_EXT[img.mime] || (img.mime || 'image/png').split('/').pop().replace(/[^a-z0-9]/gi, '') || 'png';
      const id = 'image' + (images.length + 1);
      images.push({ id, ext, mime: img.mime || 'image/png', data: img.data });
      return id;
    }
    // 탭 정의: 0 = 기본(40pt 마다), 1~ = 문서에서 온 정의
    const tabs = [], tabKeys = [];
    function tabId(t) {
      if (!t) return 0;
      const k = JSON.stringify(t);
      let i = tabKeys.indexOf(k);
      if (i < 0) { i = tabKeys.push(k) - 1; tabs.push(t); }
      return i + 1;
    }
    charId();
    paraId();
    let objId = 1000;
    return { fonts, chars, paras, fills, images, tabs, charId, paraId, fillId, pageFillId, imageId, tabId, nextId: () => ++objId, notes: { foot: 0, end: 0 } };
  }

  // MS 워드 호환 문서의 레이아웃 호환 항목: 한글은 대상 프로그램만 보고 이 묶음을 정함 (한글 2022 에서 확인 — 항목을 따로 줘도 무시)
  const WORD_COMPAT_FLAGS = ['applyFontWeightToBold', 'useInnerUnderline', 'useLowercaseStrikeout', 'extendLineheightToOffset', 'treatQuotationAsLatin', 'doNotAlignWhitespaceOnRight',
    'doNotAdjustWordInJustify', 'baseCharUnitOnEAsian', 'baseCharUnitOfIndentOnFirstChar', 'adjustLineheightToFont', 'adjustBaselineInFixedLinespacing', 'applyPrevspacingBeneathObject',
    'applyNextspacingOfLastPara', 'adjustParaBorderfillToSpacing', 'connectParaBorderfillOfEqualBorder', 'adjustParaBorderOffsetWithBorder', 'extendLineheightToParaBorderOffset',
    'applyParaBorderToOutside', 'applyMinColumnWidthTo1mm', 'applyTabPosBasedOnSegment', 'breakTabOverLine', 'adjustVertPosOfLine', 'doNotAlignLastForbidden', 'adjustMarginFromAdjustLineheight',
    'baseLineSpacingOnLineGrid', 'applyCharSpacingToCharGrid', 'doNotApplyGridInHeaderFooter', 'applyExtendHeaderFooterEachSection', 'doNotApplyLinegridAtNoLinespacing',
    'doNotAdjustEmptyAnchorLine', 'overlapBothAllowOverlap', 'extendVertLimitToPageMargins', 'doNotHoldAnchorOfTable', 'doNotFormattingAtBeneathAnchor', 'adjustBaselineOfObjectToBottom'];
  // 호환 문서(대상 프로그램 · 레이아웃 호환 항목). MS 워드 호환 등은 줄 높이·개체 둘레 간격 계산이 달라짐
  const compatXml = c => `<hh:compatibleDocument targetProgram="${(c && c.target) || 'HWP201X'}">`
    + (c && c.flags && c.flags.length ? `<hh:layoutCompatibility>${c.flags.map(f => `<hh:${f}/>`).join('')}</hh:layoutCompatibility>` : '<hh:layoutCompatibility/>') + '</hh:compatibleDocument>';

  function headerXml(st) {
    // 글꼴 정보는 그 언어 것, 없으면 다른 언어에 적힌 같은 이름 것 (문서에서 읽은 fontInfo)
    const fi = st.fontInfo || {};
    const infoOf = (l, f) => (fi[l] && fi[l][f]) || LANGS.map(x => fi[x] && fi[x][f]).find(Boolean) || null;
    const fontXml = (l, f, i) => {
      const inf = infoOf(l, f), ti = Object.assign({}, DEFAULT_TYPE_INFO, inf && inf.ti);
      return `<hh:font id="${i}" face="${esc(f)}" type="${inf && inf.type === 'HFT' ? 'HFT' : 'TTF'}" isEmbedded="0">`
        + (inf && inf.subst && inf.subst.face ? `<hh:substFont face="${esc(inf.subst.face)}" type="${inf.subst.type === 'HFT' ? 'HFT' : 'TTF'}" isEmbedded="0" binaryItemIDRef=""/>` : '')
        + `<hh:typeInfo familyType="${esc(ti.familyType)}"${TYPE_INFO_KEYS.map(k => ` ${k}="${esc(ti[k])}"`).join('')}/></hh:font>`;
    };
    const fontfaces = LANGS.map(l => `<hh:fontface lang="${l}" fontCnt="${st.fonts.length}">${st.fonts.map((f, i) => fontXml(l, f, i)).join('')}</hh:fontface>`).join('');
    const borderFill = (id, sides, bg, img) =>
      `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>`
      + ['left', 'right', 'top', 'bottom'].map((s, i) => `<hh:${s}Border type="${sides[i].type}" width="${widthStr(sides[i].width)}" color="${sides[i].color.toUpperCase()}"/>`).join('')
      + (img ? `<hc:fillBrush><hc:imgBrush mode="${img.mode}"><hc:img binaryItemIDRef="${img.ref}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/></hc:imgBrush></hc:fillBrush>`
        : bg ? `<hc:fillBrush><hc:winBrush faceColor="${bg}" hatchColor="#000000" alpha="0"/></hc:fillBrush>` : '')
      + '</hh:borderFill>';
    const none = { type: 'NONE', width: 0.1, color: '#000000' };
    const fills = [borderFill(1, [none, none, none, none]), borderFill(2, [DEFAULT_SIDE, DEFAULT_SIDE, DEFAULT_SIDE, DEFAULT_SIDE])]
      .concat(st.fills.map((f, i) => borderFill(i + 3, f.sides, f.bg, f.img)));
    const chars = st.chars.map((c, i) => {
      const fx = parseFx(c.fx), u = fx.u ? fx.u.split('/') : null, s = fx.s ? fx.s.split('/') : null, sh = fx.sh ? fx.sh.split('/') : null;
      return `<hh:charPr id="${i}" height="${c.height}" textColor="${c.color}" shadeColor="${c.shade}" useFontSpace="${fx.fs ? 1 : 0}" useKerning="${fx.k ? 1 : 0}" symMark="${esc(fx.sym || 'NONE')}" borderFillIDRef="1">`
        + `<hh:fontRef ${langAttrs(c.font)}/><hh:ratio ${langAttrs(c.ratio)}/><hh:spacing ${langAttrs(c.spacing)}/><hh:relSz ${langAttrs(c.relSz)}/><hh:offset ${langAttrs(c.offset)}/>`
        + (c.italic ? '<hh:italic/>' : '') + (c.bold ? '<hh:bold/>' : '')
        + (c.underline ? `<hh:underline type="${esc(u ? u[0] : 'BOTTOM')}" shape="${esc(u ? u[1] : 'SOLID')}" color="${esc(u ? u[2] : c.color)}"/>` : '')
        + (c.strike ? `<hh:strikeout shape="${esc(s ? s[0] : 'SOLID')}" color="${esc(s ? s[1] : c.color)}"/>` : '')
        + (fx.o ? `<hh:outline type="${esc(fx.o)}"/>` : '')
        + (sh ? `<hh:shadow type="${esc(sh[0])}" color="${esc(sh[1])}" offsetX="${esc(sh[2])}" offsetY="${esc(sh[3])}"/>` : '')
        + (fx.em ? '<hh:emboss/>' : '') + (fx.en ? '<hh:engrave/>' : '')
        + (c.sup ? '<hh:supscript/>' : '') + (c.sub ? '<hh:subscript/>' : '')
        + '</hh:charPr>';
    }).join('');
    // 문단 번호 정의: 문서에 있던 것 + 개요용(1번)이 없으면 한글 기본 개요 번호
    const numberings = (st.numberings || []).slice();
    if (!numberings.some(n => n.id === 1)) numberings.unshift({ id: 1, start: 1, levels: DEFAULT_OUTLINE });
    // 수준 속성은 문서에서 온 값 그대로. 문서 번호에 없는 수준(HWP 의 8~10)은 한글이 쓰는 기본값(간격 0·글자 모양 0)
    const def = (v, d) => (v !== undefined && v !== null ? v : d);
    const numberingXml = numberings.map(nb => `<hh:numbering id="${nb.id}" start="${nb.start || 1}">` + Array.from({ length: 10 }, (_, k) => {
      const fromDoc = (nb.levels || []).some(x => x.align !== undefined);
      const l = (nb.levels || []).find(x => x.level === k + 1) || (fromDoc ? { level: k + 1, format: '', type: 'DIGIT', start: 1, align: 'LEFT', inst: 0, auto: 0, wa: 0, off: 0, chk: 0, cp0: true } : { level: k + 1, format: '', type: 'DIGIT', start: 1 });
      const cp = l.style ? st.charId(l.style) : l.cp0 ? 0 : 4294967295;
      return `<hh:paraHead start="${l.start || 1}" level="${k + 1}" align="${esc(l.align || 'LEFT')}" useInstWidth="${def(l.inst, 1)}" autoIndent="${def(l.auto, 1)}" widthAdjust="${l.wa || 0}" textOffsetType="${esc(l.offType || 'PERCENT')}" textOffset="${def(l.off, 50)}" numFormat="${l.type || 'DIGIT'}" charPrIDRef="${cp}" checkable="${l.chk ? 1 : 0}">${esc(l.format || '')}</hh:paraHead>`;
    }).join('') + '</hh:numbering>').join('');
    const bullets = st.bullets || [];
    const bulletXml = bullets.map(b => `<hh:bullet id="${b.id}" char="${esc(b.char || '•')}" useImage="0"${b.checked ? ` checkedChar="${esc(b.checked)}"` : ''}>`
      + `<hh:paraHead level="0" align="${esc(b.align || 'LEFT')}" useInstWidth="${def(b.inst, 0)}" autoIndent="${def(b.auto, 1)}" widthAdjust="${b.wa || 0}" textOffsetType="${esc(b.offType || 'PERCENT')}" textOffset="${def(b.off, 50)}" numFormat="DIGIT" charPrIDRef="${b.style ? st.charId(b.style) : 4294967295}" checkable="${def(b.chk, b.checked ? 1 : 0) ? 1 : 0}"/></hh:bullet>`).join('');
    // 문단 모양: 나머지 항목(pp)은 문서에서 온 값, 없으면 한글 바탕글 기본값. 문단 테두리는 테두리/배경 목록에 등록
    const paras = st.paras.map((p, i) => {
      const [ht, hid, hlv] = p.head ? p.head.split(':') : ['NONE', 0, 0];
      const x = parsePP(p.pp), bd = x.border, bfId = p.bf;
      return `<hh:paraPr id="${i}" tabPrIDRef="${p.tab}" condense="${x.condense}" fontLineHeight="${x.fontLineHeight}" snapToGrid="${x.snapToGrid}" suppressLineNumbers="0" checked="0" textDir="AUTO">`
      + `<hh:align horizontal="${p.align}" vertical="${x.vertical}"/><hh:heading type="${ht}" idRef="${ht === 'OUTLINE' ? 0 : hid}" level="${hlv}"/>`
      + `<hh:breakSetting breakLatinWord="${x.breakLatinWord}" breakNonLatinWord="${x.breakNonLatinWord}" widowOrphan="${x.widowOrphan}" keepWithNext="${x.keepWithNext}" keepLines="${x.keepLines}" pageBreakBefore="${x.pageBreakBefore}" lineWrap="${x.lineWrap}"/>`
      + `<hh:autoSpacing eAsianEng="${x.eAsianEng}" eAsianNum="${x.eAsianNum}"/>`
      + `<hh:margin><hc:intent value="${p.indent}" unit="HWPUNIT"/><hc:left value="${p.left}" unit="HWPUNIT"/><hc:right value="${p.right}" unit="HWPUNIT"/><hc:prev value="${p.before}" unit="HWPUNIT"/><hc:next value="${p.after}" unit="HWPUNIT"/></hh:margin>`
      + `<hh:lineSpacing type="${p.lineType}" value="${p.line}"${p.lineType === 'PERCENT' ? '' : ' unit="HWPUNIT"'}/>`
      + `<hh:border borderFillIDRef="${bfId}" offsetLeft="${bd ? bd.off[0] : 0}" offsetRight="${bd ? bd.off[1] : 0}" offsetTop="${bd ? bd.off[2] : 0}" offsetBottom="${bd ? bd.off[3] : 0}" connect="${bd ? bd.connect : 0}" ignoreMargin="${bd ? bd.ignoreMargin : 0}"/>`
      + '</hh:paraPr>';
    }).join('');
    return XML_HEAD
      + '<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" version="1.4" secCnt="1">'
      + '<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList>'
      + `<hh:fontfaces itemCnt="${LANGS.length}">${fontfaces}</hh:fontfaces>`
      + `<hh:borderFills itemCnt="${fills.length}">${fills.join('')}</hh:borderFills>`
      + `<hh:charProperties itemCnt="${st.chars.length}">${chars}</hh:charProperties>`
      // 한글은 탭 위치(tabItem)가 정의돼 있어야 탭 너비를 그림 → 기본 탭 간격 40pt 마다 위치를 둠
      + `<hh:tabProperties itemCnt="${1 + st.tabs.length}"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0">`
      + Array.from({ length: 16 }, (_, i) => `<hh:tabItem pos="${(i + 1) * 4000}" type="LEFT" leader="NONE"/>`).join('')
      + '</hh:tabPr>'
      // 문서에서 온 탭 정의 (위치는 HWPUNIT)
      + st.tabs.map((t, i) => `<hh:tabPr id="${i + 1}" autoTabLeft="${t.l ? 1 : 0}" autoTabRight="${t.r ? 1 : 0}">`
        + t.items.map(([pos, type, leader]) => `<hh:tabItem pos="${pos}" type="${type}" leader="${leader}" unit="HWPUNIT"/>`).join('') + '</hh:tabPr>').join('')
      + '</hh:tabProperties>'
      + `<hh:numberings itemCnt="${numberings.length}">${numberingXml}</hh:numberings><hh:bullets itemCnt="${bullets.length}">${bulletXml}</hh:bullets>`
      + `<hh:paraProperties itemCnt="${st.paras.length}">${paras}</hh:paraProperties>`
      // 스타일 표: 문서에서 온 것이 있으면 그대로(이름·종류·다음 스타일·언어·잠금, 문단·글자 모양은 다시 등록한 번호), 없으면 바탕글 하나
      + (st.styleRefs && st.styleRefs.length
        ? `<hh:styles itemCnt="${st.styleRefs.length}">${st.styleRefs.map((r, i) => `<hh:style id="${i}" type="${r.s.type === 'CHAR' ? 'CHAR' : 'PARA'}" name="${esc(r.s.name || '')}" engName="${esc(r.s.engName || '')}" paraPrIDRef="${r.p}" charPrIDRef="${r.c}" nextStyleIDRef="${r.s.next >= 0 && r.s.next < st.styleRefs.length ? r.s.next : i}" langID="${r.s.langId || 1042}" lockForm="${r.s.lockForm ? 1 : 0}"/>`).join('')}</hh:styles>`
        : '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>')
      + '</hh:refList>' + compatXml(st.compat) + '</hh:head>';
  }

  const subList = (inner, valign, dir, wrap) =>
    `<hp:subList id="" textDirection="${dir || 'HORIZONTAL'}" lineWrap="${wrap || 'BREAK'}" vertAlign="${valign || 'TOP'}" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${inner}</hp:subList>`;

  // 쪽 크기·여백(mm) → HWPUNIT: 읽을 때 둔 원래 값(page.hu)이 있고 mm 값을 바꾸지 않았으면(0.1mm 반올림 안) 그 값 그대로
  const pageHu = (pg, k) => {
    const v = k === 'width' || k === 'height' ? pg[k] : pg.margin[k], raw = pg.hu && pg.hu[k];
    return raw !== undefined && Math.abs(raw / MM - v) < 0.051 ? raw : hu(v);
  };
  const bodyHu = pg => pageHu(pg, pg.landscape ? 'height' : 'width') - pageHu(pg, 'left') - pageHu(pg, 'right');

  function secPrXml(doc, st, bodyWidth) {
    const pg = doc.page, m = pg.margin;
    const pu = (v, k) => pageHu(pg, k);
    const note = (len, place) =>
      `<hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="${len}" type="SOLID" width="0.12 mm" color="#000000"/>`
      + `<hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="${place}" beneathText="0"/>`;
    // 구역 정의의 나머지 항목은 문서에서 온 값(doc.sec)을 쓰고, 없으면 한글 기본값
    const sec = doc.sec || {};
    const at = o => Object.entries(o).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
    const el = (tag, o, def) => `<hp:${tag}${at(Object.assign({}, def, o || {}))}/>`;
    let xml = `<hp:secPr${at(Object.assign({ textDirection: 'HORIZONTAL', spaceColumns: '1134', tabStop: '8000', tabStopVal: '4000', tabStopUnit: 'HWPUNIT' }, sec.attrs || {}))} outlineShapeIDRef="${doc.outlineId || 1}" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="${(doc.masterPages || []).length}">`
      + el('grid', sec.grid, { lineGrid: '0', charGrid: '0', wonggojiFormat: '0' }) + el('startNum', sec.startNum, { pageStartsOn: 'BOTH', page: '0', pic: '0', tbl: '0', equation: '0' })
      + el('visibility', sec.visibility, { hideFirstHeader: '0', hideFirstFooter: '0', hideFirstMasterPage: '0', border: 'SHOW_ALL', fill: 'SHOW_ALL', hideFirstPageNum: '0', hideFirstEmptyLine: '0', showLineNumber: '0' })
      + el('lineNumberShape', sec.lineNumberShape, { restartType: '0', countBy: '0', distance: '0', startNumber: '0' })
      + `<hp:pagePr landscape="${pg.landscape ? 'NARROWLY' : 'WIDELY'}" width="${pu(pg.width, 'width')}" height="${pu(pg.height, 'height')}" gutterType="LEFT_ONLY">`
      + `<hp:margin header="${pu(m.header, 'header')}" footer="${pu(m.footer, 'footer')}" gutter="0" left="${pu(m.left, 'left')}" right="${pu(m.right, 'right')}" top="${pu(m.top, 'top')}" bottom="${pu(m.bottom, 'bottom')}"/></hp:pagePr>`
      // 각주·미주 모양: 문서에서 온 것(번호 모양·구분선·간격·번호 매기기·위치)은 그 차례대로
      + `<hp:footNotePr>${sec.foot ? Object.entries(sec.foot).map(([t, o]) => el(t, o, {})).join('') : note(-1, 'EACH_COLUMN')}</hp:footNotePr>`
      + `<hp:endNotePr>${sec.end ? Object.entries(sec.end).map(([t, o]) => el(t, o, {})).join('') : note(14692344, 'END_OF_DOCUMENT')}</hp:endNotePr>`
      + (doc.pageBorders || []).map(pb => `<hp:pageBorderFill type="${pb.type || 'BOTH'}" borderFillIDRef="${st.pageFillId(pb)}" textBorder="${pb.textBorder || 'PAPER'}" headerInside="${pb.headerInside ? 1 : 0}" footerInside="${pb.footerInside ? 1 : 0}" fillArea="${pb.fillArea || 'PAPER'}">`
        + `<hp:offset left="${pb.offset ? pb.offset.l : 1417}" right="${pb.offset ? pb.offset.r : 1417}" top="${pb.offset ? pb.offset.t : 1417}" bottom="${pb.offset ? pb.offset.b : 1417}"/></hp:pageBorderFill>`).join('')
      + (doc.masterPages || []).map((m, i) => `<hp:masterPage idRef="masterpage${i}"/>`).join('')
      + `</hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="${(doc.columns && doc.columns.count) || 1}" sameSz="1" sameGap="${doc.columns && doc.columns.count > 1 ? hu(doc.columns.gap || 8) : 0}"/></hp:ctrl>`;
    const hf = (tag, id, blocks) => `<hp:ctrl><hp:${tag} id="${id}" applyPageType="BOTH">`
      + subList(parasXml(blocks, st, bodyWidth, null)) + `</hp:${tag}></hp:ctrl>`;
    // 한글은 원래 컨트롤 차례대로 씀 (꼬리말이 먼저인 문서: sec.footerFirst)
    const hfx = [doc.header && doc.header.length ? hf('header', 1, doc.header) : '', doc.footer && doc.footer.length ? hf('footer', 2, doc.footer) : ''];
    xml += (sec.footerFirst ? hfx.reverse() : hfx).join('');
    if (doc.pageNum && doc.pageNum.pos) xml += `<hp:ctrl><hp:pageNum pos="${doc.pageNum.pos}" formatType="DIGIT" sideChar="${doc.pageNum.dash ? '-' : ''}"/></hp:ctrl>`;
    return xml;
  }

  function distribute(ratios, total) {
    const sum = ratios.reduce((a, b) => a + b, 0) || 1;
    // 원래 정수 너비에서 온 비율은 곱하면 정수에 아주 가깝게 나옴 → 소수 오차로 1 작아지지 않게 여유를 둠
    const out = ratios.map(r => Math.floor((r / sum) * total + 1e-6));
    out[out.length - 1] += total - out.reduce((a, b) => a + b, 0);
    return out;
  }


  // 셀이 하나도 시작하지 않는 줄(전부 위 셀에 합쳐진 줄)은 없애고 덮고 있던 셀의 줄 병합 수를 줄임
  function compactRows(t) {
    const rows = t.rows.map(r => r.slice());
    for (let r = rows.length - 1; r >= 0; r--) {
      if (rows[r].length) continue;
      for (let k = 0; k < r; k++) for (const c of rows[k]) if (k + (c.rowSpan || 1) - 1 >= r) c.rowSpan = (c.rowSpan || 1) - 1;
      rows.splice(r, 1);
    }
    return Object.assign({}, t, { rows });
  }

  function tableXml(t, st, width) {
    t = compactRows(t);
    const total = Math.round(width * Math.min(3, t.widthRatio || 1));
    const colW = distribute(t.colWidths, total);
    const nCols = colW.length;
    const occ = [], placed = [];
    t.rows.forEach((row, r) => {
      occ[r] = occ[r] || [];
      let c = 0;
      for (const cell of row) {
        while (occ[r][c]) c++;
        if (c >= nCols) break;
        const cs = Math.max(1, Math.min(cell.colSpan || 1, nCols - c));
        const rs = Math.max(1, Math.min(cell.rowSpan || 1, t.rows.length - r));
        for (let i = 0; i < rs; i++) {
          occ[r + i] = occ[r + i] || [];
          for (let j = 0; j < cs; j++) occ[r + i][c + j] = true;
        }
        const blocks = cell.blocks && cell.blocks.length ? cell.blocks : [{ type: 'p', runs: [] }];
        // 원본 셀 높이가 있으면 그대로(한글이 내용에 맞게 늘림), 없으면 내용으로 추정
        // 높이 0 = 내용에 맞춤 (한글과 같이, 열 때 한글이 계산). 읽을 때 둔 원래 값(hh)은 높이를 바꾸지 않았으면 그대로
        const h = !cell.height ? 0 : cell.hh && Math.abs(cell.hh / MM - cell.height) < 0.051 ? cell.hh : hu(cell.height);
        placed.push({ r, c, cs, rs, cell, blocks, h });
        c += cs;
      }
    });
    const rowH = t.rows.map((_, r) => Math.max(0, ...placed.filter(p => p.r === r && p.rs === 1).map(p => p.h)));
    const rowsXml = t.rows.map((_, r) => '<hp:tr>' + placed.filter(p => p.r === r).map(p => {
      const w = colW.slice(p.c, p.c + p.cs).reduce((a, b) => a + b, 0);
      const h = rowH.slice(p.r, p.r + p.rs).reduce((a, b) => a + b, 0);
      const valign = { top: 'TOP', middle: 'CENTER', bottom: 'BOTTOM' }[p.cell.valign] || 'CENTER';
      const m = compactMargin(p.cell.margin);
      const mh = (k, i) => (m.hu && Math.abs(m.hu[i] / MM - m[k]) < 0.051 ? m.hu[i] : hu(m[k])); // 원래 값이 있고 바꾸지 않았으면 그대로
      const cm = m ? { l: mh('l', 0), r: mh('r', 1), t: mh('t', 2), b: mh('b', 3) } : { l: 510, r: 510, t: 141, b: 141 };
      return `<hp:tc name="" header="0" hasMargin="${m ? 1 : 0}" protect="0" editable="0" dirty="0" borderFillIDRef="${st.fillId(p.cell)}">`
        + subList(parasXml(p.blocks, st, Math.max(500, w - cm.l - cm.r), null), valign, p.cell.dir, p.cell.wrap)
        + `<hp:cellAddr colAddr="${p.c}" rowAddr="${p.r}"/><hp:cellSpan colSpan="${p.cs}" rowSpan="${p.rs}"/>`
        + `<hp:cellSz width="${w}" height="${h}"/><hp:cellMargin left="${cm.l}" right="${cm.r}" top="${cm.t}" bottom="${cm.b}"/></hp:tc>`;
    }).join('') + '</hp:tr>').join('');
    const height = rowH.reduce((a, b) => a + b, 0);
    // 배치: 읽어 둔 값이 있으면 그대로 (없으면 본문에 자리 차지하는 표)
    const P = t.place || {}, O = P.out || { l: 0, r: 0, t: 0, b: 0 };
    return `<hp:tbl id="${st.nextId()}" zOrder="${P.zOrder || 0}" numberingType="TABLE" textWrap="${P.wrap || 'TOP_AND_BOTTOM'}" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="${P.pageBreak || 'CELL'}" repeatHeader="${P.repeatHeader ? 1 : 0}" rowCnt="${t.rows.length}" colCnt="${nCols}" cellSpacing="0" borderFillIDRef="2" noAdjust="${P.noAdjust ? 1 : 0}">`
      + `<hp:sz width="${total}" widthRelTo="ABSOLUTE" height="${height}" heightRelTo="ABSOLUTE" protect="0"/>`
      + `<hp:pos treatAsChar="${P.inline ? 1 : 0}" affectLSpacing="${P.affect ? 1 : 0}" flowWithText="${P.flow === false ? 0 : 1}" allowOverlap="${P.overlap ? 1 : 0}" holdAnchorAndSO="0" vertRelTo="${P.vertRelTo || 'PARA'}" horzRelTo="${P.horzRelTo || 'COLUMN'}" vertAlign="${P.vertAlign || 'TOP'}" horzAlign="${P.horzAlign || 'LEFT'}" vertOffset="${P.vertOffset || 0}" horzOffset="${P.horzOffset || 0}"/>`
      + `<hp:outMargin left="${O.l}" right="${O.r}" top="${O.t}" bottom="${O.b}"/><hp:inMargin left="${P.inMargin ? P.inMargin.l : 510}" right="${P.inMargin ? P.inMargin.r : 510}" top="${P.inMargin ? P.inMargin.t : 141}" bottom="${P.inMargin ? P.inMargin.b : 141}"/>`
      + rowsXml + '</hp:tbl>';
  }

  function picXml(img, st) {
    const id = st.nextId(), ref = st.imageId(img);
    const w = hu(img.w), h = hu(img.h);
    return `<hp:pic id="${id}" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${id}" reverse="0">`
      + `<hp:offset x="0" y="0"/><hp:orgSz width="${w}" height="${h}"/><hp:curSz width="${w}" height="${h}"/><hp:flip horizontal="0" vertical="0"/>`
      + `<hp:rotationInfo angle="0" centerX="${w >> 1}" centerY="${h >> 1}" rotateimage="1"/>`
      + '<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>'
      + `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${w}" y="0"/><hc:pt2 x="${w}" y="${h}"/><hc:pt3 x="0" y="${h}"/></hp:imgRect>`
      + `<hp:imgClip left="0" right="${w}" top="0" bottom="${h}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${w}" dimheight="${h}"/>`
      + `<hc:img binaryItemIDRef="${ref}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:effects/>`
      + `<hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${h}" heightRelTo="ABSOLUTE" protect="0"/>`
      + '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
      + '<hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:pic>';
  }

  // 그리기 개체: 읽어 둔 요소 나무를 그대로 XML 로 (글상자 문단은 이 편집기의 문단으로, 그림 자료는 새 번호로)
  function shapeXml(n, st, style) {
    const attrs = Object.assign({}, n.attrs);
    // 양식 개체: 테두리 번호는 이 문서의 기본(없음 1·실선 2)으로, 글자 모양은 개체가 든 자리의 것으로
    if (attrs.borderTypeIDRef !== undefined) attrs.borderTypeIDRef = attrs.borderTypeIDRef === '0' ? '0' : '2';
    if (n.tag === 'hp:formCharPr') attrs.charPrIDRef = String(st.charId(style));
    if (n.image) attrs.binaryItemIDRef = st.imageId(n.image);
    const at = Object.entries(attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
    let inner = '';
    if (n.text) {
      const sub = Object.entries(n.text.sub || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
      const blocks = n.text.blocks && n.text.blocks.length ? n.text.blocks : [{ type: 'p', runs: [] }];
      const width = Math.max(1000, +(n.attrs.lastWidth || 0) || 20000);
      inner += `<hp:subList${sub}>${parasXml(blocks, st, width, null)}</hp:subList>`;
    }
    for (const k of n.kids || []) inner += shapeXml(k, st, style);
    if (n.txt) inner += esc(n.txt);
    return inner ? `<${n.tag}${at}>${inner}</${n.tag}>` : `<${n.tag}${at}/>`;
  }

  // 각주·미주: 번호(autoNum)를 첫 문단 앞에 두고 내용 문단을 subList 로
  function noteXml(note, st, width) {
    const end = note.kind === 'end';
    const no = end ? ++st.notes.end : ++st.notes.foot;
    const type = end ? 'ENDNOTE' : 'FOOTNOTE';
    const blocks = note.blocks && note.blocks.length ? note.blocks : [{ type: 'p', runs: [] }];
    const paras = blocks.map((b, i) => {
      let x = paraXml(b, st, width, null);
      if (i === 0) {
        const num = `<hp:run charPrIDRef="${st.charId((b.runs || [])[0])}"><hp:ctrl><hp:autoNum num="${no}" numType="${type}"><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/></hp:autoNum></hp:ctrl><hp:t> </hp:t></hp:run>`;
        x = x.replace(/^(<hp:p [^>]*>)/, `$1${num}`);
      }
      return x;
    }).join('');
    return `<hp:ctrl><hp:${end ? 'endNote' : 'footNote'} number="${no}" suffixChar="41" instId="${st.nextId()}">${subList(paras)}</hp:${end ? 'endNote' : 'footNote'}></hp:ctrl>`;
  }

  function mergeGroups(blocks) {
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b || !b.grp) { out.push(b); continue; }
      const pieces = [b];
      let j = i + 1;
      // 같은 묶음 조각: 표·글 번갈아, 또는 표가 잇달아(글 없이 표만 여럿 든 문단 — HOME12 의 글 뒤로 표 8개). 글 조각이 잇달아 오면 다른 문단
      while (j < blocks.length && blocks[j] && blocks[j].grp === b.grp && !(blocks[j].type !== 'table' && pieces[pieces.length - 1].type !== 'table')) pieces.push(blocks[j++]);
      const tables = pieces.filter(x => x.type === 'table');
      if (!tables.length || pieces.length < 2) { out.push(b); continue; }
      const props = Object.assign({}, tables[0].para || {});
      const size = props.charSize;
      delete props.charSize; delete props.mark;
      const runs = [];
      for (const x of pieces) {
        if (x.type === 'table') runs.push({ table: x, style: x.para && x.para.charSize ? { size: x.para.charSize } : size ? { size } : undefined });
        else runs.push(...x.runs);
      }
      const lastP = pieces[pieces.length - 1];
      out.push(Object.assign({ type: 'p' }, props, { runs }, pieces[0].pageBreak ? { pageBreak: true } : null, lastP.type === 'p' && lastP.endMark ? { endMark: lastP.endMark } : null));
      i = j - 1;
    }
    return out;
  }
  const parasXml = (blocks, st, width, first) => mergeGroups(blocks).map((b, i) => paraXml(b, st, width, i === 0 ? first : null)).join('');

  // first: 첫 문단이면 구역 정의(secPr) 문자열
  function paraXml(b, st, width, first) {
    let runs = first ? `<hp:run charPrIDRef="0">${first}</hp:run>` : '';
    const pb = b.pageBreak ? ' pageBreak="1"' : '';
    if (b.type === 'table') {
      // 표와 같은 문단에 있던 떠 있는 개체(선·도형)는 원래 자리대로 표 앞·뒤에 함께 둠
      const anch = after => (b.anchors || []).filter(r => r.shape && !!r.shape.afterTable === after).map(r => shapeXml(r.shape, st)).join('');
      runs += `<hp:run charPrIDRef="0">${anch(false)}${tableXml(b, st, width)}${anch(true)}</hp:run>`;
      return `<hp:p paraPrIDRef="${b.para ? st.paraId(b.para) : 0}" styleIDRef="${st.styleOf(b.para)}"${pb}>${runs}</hp:p>`;
    }
    let hasContent = false, link = null, linkIds = null, prev = null, chId = null, chIds = null;
    const closeLink = () => { if (link) runs += `<hp:run charPrIDRef="${st.charId(prev)}"><hp:ctrl><hp:fieldEnd beginIDRef="${linkIds.id}" fieldid="${linkIds.fid}"/></hp:ctrl></hp:run>`; link = null; };
    const closeCh = () => { if (chId) runs += `<hp:run charPrIDRef="${st.charId(prev)}"><hp:ctrl><hp:fieldEnd beginIDRef="${chIds.id}" fieldid="${chIds.fid}"/></hp:ctrl></hp:run>`; chId = null; };
    // 그 밖의 필드(날짜·사용자 정보·계산식·책갈피 등): 읽어 둔 fieldBegin 요소를 새 번호로
    // 날짜 필드는 한글처럼 저장할 때 값을 채움 (fdSkip: 원래 글자 조각은 건너뜀)
    let fdId = null, fdIds = null, fdSkip = false;
    const fdBegin = (fd, id) => shapeXml(Object.assign({}, fd.node, { attrs: Object.assign({}, fd.node.attrs, { id: String(id) }) }), st);
    const fdEnd = ids => `<hp:ctrl><hp:fieldEnd beginIDRef="${ids.id}" fieldid="${esc(ids.fid)}"/></hp:ctrl>`;
    const closeFd = () => { if (fdId) runs += `<hp:run charPrIDRef="${st.charId(prev)}">${fdEnd(fdIds)}</hp:run>`; fdId = null; fdSkip = false; };
    for (const r of b.runs || []) {
      if (r.field) {
        closeLink(); closeCh(); closeFd();
        const ids = { id: st.nextId(), fid: r.field.node.attrs.fieldid || '' }, date = fieldDate(r.field);
        runs += `<hp:run charPrIDRef="${st.charId(r.style || prev)}"><hp:ctrl>${fdBegin(r.field, ids.id)}</hp:ctrl>${date ? `<hp:t>${esc(date)}</hp:t>` : ''}${fdEnd(ids)}</hp:run>`;
        continue;
      }
      const wantFd = r.fd ? r.fd.id : null;
      if (wantFd !== fdId && typeof r.text === 'string' && r.text) {
        closeLink(); closeCh(); closeFd();
        if (wantFd) {
          fdId = wantFd;
          fdIds = { id: st.nextId(), fid: r.fd.node.attrs.fieldid || '' };
          const date = fieldDate(r.fd);
          runs += `<hp:run charPrIDRef="${st.charId(r)}"><hp:ctrl>${fdBegin(r.fd, fdIds.id)}</hp:ctrl>${date ? `<hp:t>${esc(date)}</hp:t>` : ''}</hp:run>`;
          if (date) { fdSkip = true; prev = r; hasContent = true; }
        }
      }
      if (fdSkip && wantFd === fdId && typeof r.text === 'string') continue;
      // 누름틀: 같은 누름틀에 속한 글자들을 CLICK_HERE 필드로 감쌈 (빈 칸 표시 {{이름}} 은 저장하지 않음)
      const wantCh = r.ch ? r.ch.id : null;
      if (wantCh !== chId) {
        closeLink();
        closeCh();
        if (wantCh) {
          chId = wantCh;
          chIds = { id: st.nextId(), fid: 627272811 };
          runs += `<hp:run charPrIDRef="${st.charId(r)}"><hp:ctrl><hp:fieldBegin id="${chIds.id}" type="CLICK_HERE" name="${esc(r.ch.fname || '')}" editable="1" dirty="0" zorder="-1" fieldid="${chIds.fid}">`
            + `<hp:parameters cnt="2" name=""><hp:integerParam name="Prop">9</hp:integerParam><hp:stringParam name="Command" xml:space="preserve">${esc(r.ch.cmd || String(r.ch.name || '').replace(/\\/g, '\\\\').replace(/[:;]/g, m => '\\' + m) + ';')}</hp:stringParam></hp:parameters></hp:fieldBegin></hp:ctrl></hp:run>`;
          hasContent = true;
        }
      }
      if (r.placeholder) { prev = r; continue; }
      // 하이퍼링크: 같은 주소가 이어지는 글자들을 필드(HYPERLINK)로 감쌈
      const want = r.text && r.link ? r.link : null;
      if (want !== link && (r.text || r.image || r.note || r.shape || r.table || r.compose || r.autoNum)) {
        closeLink();
        if (want) {
          link = want;
          linkIds = { id: st.nextId(), fid: st.nextId() };
          runs += `<hp:run charPrIDRef="${st.charId(r)}"><hp:ctrl><hp:fieldBegin id="${linkIds.id}" type="HYPERLINK" name="" editable="0" dirty="0" zorder="-1" fieldid="${linkIds.fid}">`
            + '<hp:parameters cnt="6" name=""><hp:integerParam name="Prop">0</hp:integerParam>'
            + `<hp:stringParam name="Command">${esc(want.replace(/\\/g, '\\\\').replace(/:/g, '\\:'))};1;0;0</hp:stringParam><hp:stringParam name="Path">${esc(want)}</hp:stringParam>`
            + '<hp:stringParam name="Category">HWPHYPERLINK_TYPE_URL</hp:stringParam><hp:stringParam name="TargetType">HWPHYPERLINK_TARGET_BOOKMARK</hp:stringParam>'
            + '<hp:stringParam name="DocOpenType">HWPHYPERLINK_JUMP_CURRENTTAB</hp:stringParam></hp:parameters></hp:fieldBegin></hp:ctrl></hp:run>';
        }
      }
      if (r.image) { runs += `<hp:run charPrIDRef="${st.charId(r.style || prev)}">${picXml(r.image, st)}</hp:run>`; hasContent = true; continue; }
      if (r.shape) { runs += `<hp:run charPrIDRef="${st.charId(r.style || prev)}">${shapeXml(r.shape, st, r.style || prev)}</hp:run>`; hasContent = true; continue; }
      if (r.table) { runs += `<hp:run charPrIDRef="${st.charId(r.style || prev)}">${tableXml(r.table, st, width)}</hp:run>`; hasContent = true; continue; }
      if (r.autoNum) {
        const a = r.autoNum, f = a.format || {};
        runs += `<hp:run charPrIDRef="${st.charId(r.style || prev)}"><hp:ctrl><hp:autoNum num="${a.num || 1}" numType="${a.numType || 'PAGE'}"><hp:autoNumFormat type="${f.type || 'DIGIT'}" userChar="${esc(f.userChar || '')}" prefixChar="${esc(f.prefixChar || '')}" suffixChar="${esc(f.suffixChar || '')}" supscript="${f.supscript ? 1 : 0}"/></hp:autoNum></hp:ctrl><hp:t/></hp:run>`;
        hasContent = true;
        continue;
      }
      if (r.compose) {
        // 글자 겹침: 원래 글자 모양 번호는 이 문서의 번호로 (없음 = 4294967295 은 그대로)
        const c = r.compose, id = st.charId(r.style || prev);
        const refs = (c.refs && c.refs.length ? c.refs : [0]).map(x => (x === 4294967295 ? x : id));
        runs += `<hp:run charPrIDRef="${id}"><hp:compose circleType="${c.circleType || 'CHAR'}" charSz="${c.charSz || 0}" composeType="${c.composeType || 'SPREAD'}" charPrCnt="${refs.length}" composeText="${esc(c.text || '')}">${refs.map(x => `<hp:charPr prIDRef="${x}"/>`).join('')}</hp:compose></hp:run>`;
        hasContent = true;
        continue;
      }
      if (r.note) { runs += `<hp:run charPrIDRef="${st.charId(r.note.style || prev)}">${noteXml(r.note, st, width)}</hp:run>`; hasContent = true; continue; }
      // 구역 중간의 머리말·꼬리말 컨트롤 (그 자리 그대로)
      if (r.hf) {
        const tag = r.hf.kind === 'header' ? 'header' : 'footer', hb = r.hf.blocks && r.hf.blocks.length ? r.hf.blocks : [{ type: 'p', runs: [] }];
        runs += `<hp:run charPrIDRef="${st.charId(r.style || prev)}"><hp:ctrl><hp:${tag} id="0" applyPageType="${r.hf.apply || 'BOTH'}">${subList(parasXml(hb, st, width, null))}</hp:${tag}></hp:ctrl></hp:run>`;
        continue;
      }
      if (!r.text) continue;
      runs += `<hp:run charPrIDRef="${st.charId(r)}"><hp:t>${textXml(r.text)}</hp:t></hp:run>`;
      prev = r;
      hasContent = true;
    }
    closeLink();
    closeCh();
    closeFd();
    if (!hasContent) runs += `<hp:run charPrIDRef="${st.charId(b.mark || (b.runs || [])[0])}"/>`;
    else if (b.endMark) runs += `<hp:run charPrIDRef="${st.charId(b.endMark)}"/>`; // 문단 끝 글자 모양
    return `<hp:p paraPrIDRef="${st.paraId(b)}" styleIDRef="${st.styleOf(b)}"${pb}>${runs}</hp:p>`;
  }

  function plainText(blocks) {
    return (blocks || []).map(b => b.type === 'table'
      ? b.rows.map(row => row.map(c => plainText(c.blocks)).join('\t')).join('\n')
      : b.runs.map(r => r.text || '').join('')).join('\n');
  }

  function normalizeDoc(doc) {
    const page = Object.assign(defaultPage(), doc.page || {});
    page.margin = Object.assign(defaultPage().margin, (doc.page && doc.page.margin) || {});
    // 문서에서 온 HWPUNIT 값이 있고 mm 값을 바꾸지 않았으면 mm 도 그 정확한 값으로 (0.1mm 반올림으로 본문 폭이 0.1mm 달라져 줄바꿈이 어긋나는 것을 막음)
    if (page.hu) {
      const exact = (v, raw) => (raw !== undefined && Math.abs(raw / MM - v) < 0.051 ? Math.round(raw / MM * 1000) / 1000 : v);
      page.width = exact(page.width, page.hu.width); page.height = exact(page.height, page.hu.height);
      for (const k of ['top', 'bottom', 'left', 'right', 'header', 'footer']) page.margin[k] = exact(page.margin[k], page.hu[k]);
    }
    return {
      page, header: doc.header || null, footer: doc.footer || null, pageNum: doc.pageNum || null, blocks: doc.blocks || [],
      numberings: doc.numberings || [], bullets: doc.bullets || [], outlineId: doc.outlineId || 1, columns: doc.columns || null, pageBorders: doc.pageBorders || null, masterPages: doc.masterPages || null, compat: doc.compat || null, sec: doc.sec || null, styles: doc.styles || null, fontInfo: doc.fontInfo || null,
    };
  }

  function buildHwpx(input) {
    const doc = normalizeDoc(input);
    const st = makeRegistry();
    st.numberings = doc.numberings;
    st.bullets = doc.bullets;
    st.compat = doc.compat;
    st.fontInfo = doc.fontInfo;
    // 문단의 스타일 번호 (문서 스타일 표 안의 번호만, 아니면 바탕글 0)
    st.styleOf = b => (b && doc.styles && b.styleId > 0 && b.styleId < doc.styles.length ? b.styleId : 0);
    const bodyWidth = bodyHu(doc.page);
    const blocks = doc.blocks.length ? doc.blocks : [{ type: 'p', runs: [] }];
    const sec = secPrXml(doc, st, bodyWidth);
    const section = XML_HEAD + `<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" ${NS}>`
      + parasXml(blocks, st, bodyWidth, sec) + '</hs:sec>';
    // 바탕쪽 파일 (본문 다음, 머리 정보 앞에 만들어 글자·문단 모양이 등록되게)
    const masters = (doc.masterPages || []).map((m, i) => XML_HEAD + `<masterPage xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" ${NS} id="masterpage${i}" type="${m.type || 'BOTH'}"`
      + Object.entries(m.attrs || { pageNumber: '0', pageDuplicate: '0', pageFront: '0' }).map(([k, v]) => ` ${k}="${esc(v)}"`).join('') + '>'
      + `<hp:subList${Object.entries(m.sub || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}>${parasXml(m.blocks && m.blocks.length ? m.blocks : [{ type: 'p', runs: [] }], st, bodyWidth, null)}</hp:subList></masterPage>`);
    // 문단 번호 글자 모양도 머리 정보의 글자 모양 목록을 만들기 전에 등록
    for (const nb of st.numberings || []) for (const l of nb.levels || []) if (l.style) st.charId(l.style);
    for (const b of st.bullets || []) if (b.style) st.charId(b.style);
    // 스타일의 문단·글자 모양도 머리 정보를 만들기 전에 등록
    st.styleRefs = (doc.styles || []).map(x => ({ s: x, p: x.type === 'CHAR' ? 0 : st.paraId(x.para || {}), c: st.charId(x.char || {}) }));
    const header = headerXml(st); // 글자·문단 모양은 본문을 만들며 등록되므로 본문 다음에 생성
    const container = XML_HEAD
      + '<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf">'
      + '<ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>';
    const hpf = XML_HEAD
      + '<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head">'
      + '<opf:metadata><opf:meta name="generator" content="pureun-hangul"/></opf:metadata><opf:manifest>'
      + '<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>' + masters.map((m, i) => `<opf:item id="masterpage${i}" href="Contents/masterpage${i}.xml" media-type="application/xml"/>`).join('') + '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>'
      + st.images.map(im => `<opf:item id="${im.id}" href="BinData/${im.id}.${im.ext}" media-type="${im.mime}" isEmbeded="${im.mime === 'application/ole' ? 0 : 1}"/>`).join('')
      + '</opf:manifest><opf:spine><opf:itemref idref="header" linear="no"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>';
    const enc = new TextEncoder();
    return g.PureunZip.writeZip([
      { name: 'mimetype', data: enc.encode('application/hwp+zip') },
      { name: 'META-INF/container.xml', data: enc.encode(container) },
      { name: 'Contents/content.hpf', data: enc.encode(hpf) },
      { name: 'Contents/header.xml', data: enc.encode(header) },
      { name: 'Contents/section0.xml', data: enc.encode(section) },
      ...masters.map((m, i) => ({ name: `Contents/masterpage${i}.xml`, data: enc.encode(m) })),
      ...st.images.map(im => ({ name: `BinData/${im.id}.${im.ext}`, data: im.data })),
      { name: 'Preview/PrvText.txt', data: enc.encode(plainText(blocks).slice(0, 1000)) },
    ]);
  }

  // ================= 읽기 (브라우저 DOMParser) =================

  const kids = (node, tag) => Array.from(node.children).filter(c => c.localName === tag);
  const kid = (node, tag) => kids(node, tag)[0];
  const all = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag));
  const attrNum = (el, name, d) => { const v = el && el.getAttribute(name); return v === null || v === undefined || v === '' ? d : +v; };
  const SILENT = new Set(['secPr', 'ctrl', 'linesegarray', 'markpenBegin', 'markpenEnd', 'fieldBegin', 'fieldEnd']);

  // 한글 2022 저장본은 여백·줄간격을 hp:switch 로 감싸므로 HWPUNIT 분기(case)를 우선 사용
  function pickBranch(paraPr, tag) {
    const sw = kid(paraPr, 'switch');
    if (sw) {
      const c = kid(sw, 'case'), d = kid(sw, 'default');
      return (c && kid(c, tag)) || (d && kid(d, tag)) || null;
    }
    return kid(paraPr, tag);
  }

  async function readHwpx(buffer) {
    const files = await g.PureunZip.readZip(buffer);
    // 암호 문서: 묶음 안 내용이 암호화돼 있음 (manifest 의 encryption-data)
    const mf = files['META-INF/manifest.xml'];
    if (mf && /encryption-data/.test(new TextDecoder().decode(mf))) throw new Error('암호가 걸린 HWPX 문서입니다. 한글 2022에서 암호를 해제하고 저장한 뒤 여세요.');
    if (!files['Contents/header.xml']) throw new Error('HWPX 문서가 아닙니다.');
    const dec = new TextDecoder();
    const parse = name => {
      const d = new DOMParser().parseFromString(dec.decode(files[name]), 'application/xml');
      if (d.getElementsByTagName('parsererror').length) throw new Error(name + ' 을(를) 읽을 수 없습니다.');
      return d;
    };
    const head = parse('Contents/header.xml');

    // 그림 목록 (content.hpf 의 manifest)
    const binItems = {};
    if (files['Contents/content.hpf']) {
      for (const it of all(parse('Contents/content.hpf'), 'item')) binItems[it.getAttribute('id')] = { href: it.getAttribute('href'), mime: it.getAttribute('media-type') };
    }
    const fontsOf = lang => { const out = {}; const fc = all(head, 'fontface').find(f => f.getAttribute('lang') === lang); if (fc) for (const f of kids(fc, 'font')) out[f.getAttribute('id')] = f.getAttribute('face'); return out; };
    const fonts = fontsOf('HANGUL'), symFonts = fontsOf('SYMBOL'), userFonts = fontsOf('USER'), otherFonts = fontsOf('OTHER');
    const langFonts = LANGS.map(fontsOf);
    // 글꼴 정보(종류·대체 글꼴·분류) — 언어별 이름마다 (그대로 저장)
    const fontInfo = {};
    let fontInfoAny = false;
    for (const fc of all(head, 'fontface')) {
      const l = fc.getAttribute('lang'), m = fontInfo[l] = fontInfo[l] || {};
      for (const f of kids(fc, 'font')) {
        const face = f.getAttribute('face');
        if (!face || m[face]) continue;
        const sub = kid(f, 'substFont'), ti = kid(f, 'typeInfo');
        m[face] = { type: f.getAttribute('type') || 'TTF', subst: sub ? { face: sub.getAttribute('face') || '', type: sub.getAttribute('type') || 'TTF' } : null,
          ti: ti ? Object.assign({ familyType: ti.getAttribute('familyType') || 'FCAT_GOTHIC' }, ...TYPE_INFO_KEYS.map(k => ({ [k]: ti.getAttribute(k) || '0' }))) : null };
        fontInfoAny = true;
      }
    }
    const chars = {}, charSym = {};
    for (const c of all(head, 'charPr')) {
      const ref = kid(c, 'fontRef'), ul = kid(c, 'underline'), so = kid(c, 'strikeout'), sp = kid(c, 'spacing'), ra = kid(c, 'ratio');
      const shade = c.getAttribute('shadeColor');
      if (ref) charSym[c.getAttribute('id')] = [symFonts[ref.getAttribute('symbol')], userFonts[ref.getAttribute('user')], otherFonts[ref.getAttribute('other')], fonts[ref.getAttribute('hangul')]];
      const per = (el, def) => (el ? LANG_ATTRS.map(l => attrNum(el, l, def)) : null);
      const langs = makeLangs(ref ? LANG_ATTRS.map((l, i) => langFonts[i][ref.getAttribute(l)] || fonts[ref.getAttribute('hangul')] || DEFAULT_FONT) : null,
        per(ra, 100), per(sp, 0), per(kid(c, 'relSz'), 100), per(kid(c, 'offset'), 0));
      chars[c.getAttribute('id')] = {
        langs,
        font: fonts[ref ? ref.getAttribute('hangul') : '0'] || DEFAULT_FONT,
        size: attrNum(c, 'height', 1000) / 100,
        bold: !!kid(c, 'bold') || c.getAttribute('bold') === '1',
        italic: !!kid(c, 'italic') || c.getAttribute('italic') === '1',
        underline: !!ul && ul.getAttribute('type') !== 'NONE',
        strike: !!so && so.getAttribute('shape') !== 'NONE' && so.getAttribute('shape') !== '3D',
        sup: !!kid(c, 'supscript'), sub: !!kid(c, 'subscript'),
        color: c.getAttribute('textColor') || '#000000',
        shade: shade && shade !== 'none' && shade.toUpperCase() !== '#FFFFFF' ? shade : null,
        spacing: sp ? attrNum(sp, 'hangul', 0) : 0,
        ratio: ra ? attrNum(ra, 'hangul', 100) : 100,
        fx: fxOfCharPr(c, kid),
      };
    }
    const paras = {};
    for (const p of all(head, 'paraPr')) {
      const a = all(p, 'align')[0], m = pickBranch(p, 'margin'), ls = pickBranch(p, 'lineSpacing'), hd = all(p, 'heading')[0];
      const mv = tag => { const e = m && kid(m, tag); return e ? attrNum(e, 'value', 0) / 100 : 0; };
      const lt = ls ? ls.getAttribute('type') || 'PERCENT' : 'PERCENT';
      const ht = hd ? hd.getAttribute('type') : 'NONE';
      paras[p.getAttribute('id')] = Object.assign({
        align: ALIGN_IN[a && a.getAttribute('horizontal')] || 'justify',
        lineSpacing: lt === 'PERCENT' ? attrNum(ls, 'value', 160) : 160,
        indent: mv('intent'), left: mv('left'), right: mv('right'), before: mv('prev'), after: mv('next'),
      }, lt !== 'PERCENT' && LINE_TYPES_OUT.includes(lt) ? { lineType: lt, lineValue: attrNum(ls, 'value', 1200) / 100 } : null,
      HEAD_TYPES.includes(ht) ? { head: { type: ht, id: attrNum(hd, 'idRef', 0), level: attrNum(hd, 'level', 0) } } : null);
    }
    // 문단 번호 정의·글머리표
    const numberings = all(head, 'numbering').map(nb => ({
      id: attrNum(nb, 'id', 1), start: attrNum(nb, 'start', 1),
      // 수준별 정렬·실제 너비·자동 내어쓰기·너비 보정·본문과의 간격·체크 여부와 번호 글자 모양(없음 = 4294967295)
      levels: kids(nb, 'paraHead').map(ph => Object.assign({ level: attrNum(ph, 'level', 1), format: ph.textContent || '', type: ph.getAttribute('numFormat') || 'DIGIT', start: attrNum(ph, 'start', 1),
        align: ph.getAttribute('align') || 'LEFT', inst: attrNum(ph, 'useInstWidth', 0), auto: attrNum(ph, 'autoIndent', 0), wa: attrNum(ph, 'widthAdjust', 0),
        offType: ph.getAttribute('textOffsetType') || 'PERCENT', off: attrNum(ph, 'textOffset', 0), chk: attrNum(ph, 'checkable', 0) },
        chars[ph.getAttribute('charPrIDRef')] ? { style: Object.assign({}, chars[ph.getAttribute('charPrIDRef')]) } : null)),
    }));
    const bullets = all(head, 'bullet').map(b => {
      const ph = kid(b, 'paraHead');
      return Object.assign({ id: attrNum(b, 'id', 1), char: b.getAttribute('char') || '•', checked: b.getAttribute('checkedChar') || null },
        ph ? { align: ph.getAttribute('align') || 'LEFT', inst: attrNum(ph, 'useInstWidth', 0), auto: attrNum(ph, 'autoIndent', 0), wa: attrNum(ph, 'widthAdjust', 0),
          offType: ph.getAttribute('textOffsetType') || 'PERCENT', off: attrNum(ph, 'textOffset', 0), chk: attrNum(ph, 'checkable', 0) } : null,
        ph && chars[ph.getAttribute('charPrIDRef')] ? { style: Object.assign({}, chars[ph.getAttribute('charPrIDRef')]) } : null);
    });
    const fillColor = {}, fillBorders = {}, fillDefs = {};
    for (const bf of all(head, 'borderFill')) {
      const wb = all(bf, 'winBrush')[0];
      const c = wb && wb.getAttribute('faceColor');
      const id = bf.getAttribute('id');
      if (c && c !== 'none' && !/^#FF[0-9A-F]{6}$/i.test(c)) fillColor[id] = c; // 흰색 채우기도 그대로 (#FFrrggbb = 투명)
      const side = tag => { const e = kid(bf, tag); return e ? { type: e.getAttribute('type') || 'SOLID', width: parseFloat(e.getAttribute('width')) || 0.12, color: e.getAttribute('color') || '#000000' } : DEFAULT_SIDE; };
      fillBorders[id] = compactBorders({ l: side('leftBorder'), r: side('rightBorder'), t: side('topBorder'), b: side('bottomBorder') });
      const ib = all(bf, 'imgBrush')[0], im = ib && all(ib, 'img')[0];
      fillDefs[id] = { sides: { l: side('leftBorder'), r: side('rightBorder'), t: side('topBorder'), b: side('bottomBorder') }, bg: fillColor[id] || null,
        // rawBg: 흰색도 그대로 (문단 배경용). #FFrrggbb = 투명
        rawBg: c && c !== 'none' && !/^#FF[0-9A-F]{6}$/i.test(c) ? c.toUpperCase() : null, imgRef: im ? im.getAttribute('binaryItemIDRef') : null, imgMode: ib ? ib.getAttribute('mode') || 'TOTAL' : null };
    }
    // 탭 정의: 한글은 항목마다 switch 로 감쌈 — case 쪽(HWPUNIT)을 쓰고, default 쪽만 있으면 2배로 적힌 값. switch 밖 항목은 HWPUNIT
    const tabDefs = {};
    const tabItem = (t, half) => [half ? Math.round(attrNum(t, 'pos', 0) / 2) : attrNum(t, 'pos', 0), t.getAttribute('type') || 'LEFT', t.getAttribute('leader') || 'NONE'];
    for (const tp of all(head, 'tabPr')) {
      const items = [];
      for (const c of Array.from(tp.children)) {
        if (c.localName === 'tabItem') items.push(tabItem(c, false));
        else if (c.localName === 'switch') {
          const cs = kid(c, 'case'), df = kid(c, 'default');
          if (cs && kids(cs, 'tabItem').length) for (const t of kids(cs, 'tabItem')) items.push(tabItem(t, false));
          else if (df) for (const t of kids(df, 'tabItem')) items.push(tabItem(t, true));
        }
      }
      tabDefs[tp.getAttribute('id')] = { l: attrNum(tp, 'autoTabLeft', 0), r: attrNum(tp, 'autoTabRight', 0), items };
    }
    // 이 편집기가 쓰는 기본 탭 정의(40pt 마다 16개)는 '탭 정의 없음'과 같게 봄
    const ourDefaultTabs = t => !t.l && !t.r && t.items.length === 16 && t.items.every(([p, ty, ld], i) => p === (i + 1) * 4000 && ty === 'LEFT' && ld === 'NONE');
    // 문단 모양의 나머지 항목 → pp
    for (const p of all(head, 'paraPr')) {
      const a = all(p, 'align')[0], bs = all(p, 'breakSetting')[0], as = all(p, 'autoSpacing')[0], bd = all(p, 'border')[0];
      const at = (e, k, d) => (e && e.getAttribute(k) !== null ? e.getAttribute(k) : d);
      const fd = bd && fillDefs[bd.getAttribute('borderFillIDRef')];
      const visible = fd && (fd.rawBg || ['l', 'r', 't', 'b'].some(k => fd.sides[k].type !== 'NONE'));
      const pp = makePP({
        condense: +at(p, 'condense', 0), fontLineHeight: +at(p, 'fontLineHeight', 0), snapToGrid: +at(p, 'snapToGrid', 1),
        breakLatinWord: at(bs, 'breakLatinWord', 'KEEP_WORD'), breakNonLatinWord: at(bs, 'breakNonLatinWord', 'KEEP_WORD'),
        widowOrphan: +at(bs, 'widowOrphan', 0), keepWithNext: +at(bs, 'keepWithNext', 0), keepLines: +at(bs, 'keepLines', 0), pageBreakBefore: +at(bs, 'pageBreakBefore', 0),
        lineWrap: at(bs, 'lineWrap', 'BREAK'), vertical: at(a, 'vertical', 'BASELINE'), eAsianEng: +at(as, 'eAsianEng', 0), eAsianNum: +at(as, 'eAsianNum', 0),
        tabs: (t => (t && !ourDefaultTabs(t) ? t : null))(tabDefs[p.getAttribute('tabPrIDRef')]),
        border: visible ? { sides: fd.sides, bg: fd.rawBg, off: ['offsetLeft', 'offsetRight', 'offsetTop', 'offsetBottom'].map(k => +at(bd, k, 0)), connect: +at(bd, 'connect', 0), ignoreMargin: +at(bd, 'ignoreMargin', 0) } : null,
      });
      if (pp && paras[p.getAttribute('id')]) paras[p.getAttribute('id')].pp = pp;
    }

    let skipped = 0;
    const doc = { page: defaultPage(), header: null, footer: null, pageNum: null, blocks: [], numberings, bullets, outlineId: 1, columns: null };
    // 스타일 표 (이름·종류·다음 스타일·언어·잠금과 스타일의 문단·글자 모양) — 그대로 저장
    const styleEls = all(head, 'style');
    if (fontInfoAny) doc.fontInfo = fontInfo;
    if (styleEls.length) doc.styles = styleEls.map(e => ({
      name: e.getAttribute('name') || '', engName: e.getAttribute('engName') || '', type: e.getAttribute('type') === 'CHAR' ? 'CHAR' : 'PARA',
      next: attrNum(e, 'nextStyleIDRef', 0), langId: attrNum(e, 'langID', 1042), lockForm: attrNum(e, 'lockForm', 0),
      para: Object.assign({}, paras[e.getAttribute('paraPrIDRef')] || {}), char: Object.assign({}, chars[e.getAttribute('charPrIDRef')] || {}),
    }));
    const cd = all(head, 'compatibleDocument')[0];
    if (cd) {
      const lc = kid(cd, 'layoutCompatibility');
      const target = cd.getAttribute('targetProgram') || 'HWP201X', flags = lc ? Array.from(lc.children).map(e => e.localName) : [];
      if (target !== 'HWP201X' && target !== 'HWP2018' || flags.length) doc.compat = { target, flags };
    }
    const textOf = t => {
      let s = '';
      for (const n of t.childNodes) {
        if (n.nodeType === 3) s += n.nodeValue.replace(/ /g, NBSP_LIT); // 글자로서의 U+00A0 (묶음 빈칸 nbSpace 와 구별)
        else if (n.localName === 'lineBreak') s += '\n';
        else if (n.localName === 'tab') s += '\t';
        else if (n.localName === 'nbSpace') s += '\u00a0';
        else if (n.localName === 'fwSpace') s += '\u2007';
        else if (n.localName === 'hyphen') s += '-';
      }
      return s; // 한컴 전용 기호도 원래 코드 그대로 (한컴 글꼴이 그려 줌)
    };
    const hwpToMm = v => Math.round((v / MM) * 10) / 10;
    // 그림 자료 (BinData) → { mime, data }
    function binImage(ref) {
      const item = ref && binItems[ref];
      const data = item && files[item.href];
      if (!data) return null;
      const ext = item.href.split('.').pop().toLowerCase();
      return { mime: item.mime || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp' }[ext] || 'image/png'), data };
    }
    function readPic(pic) {
      const img = all(pic, 'img')[0];
      const bin = binImage(img && img.getAttribute('binaryItemIDRef'));
      if (!bin) return null;
      const sz = kid(pic, 'curSz') || kid(pic, 'sz');
      return Object.assign(bin, { w: hwpToMm(attrNum(sz, 'width', 5000)), h: hwpToMm(attrNum(sz, 'height', 5000)) });
    }
    // 그리기 개체: 요소 나무를 그대로 (글상자 문단은 문단 모델로, 그림은 자료로)
    function readNode(el) {
      const n = { tag: el.tagName, attrs: {} };
      for (const at of Array.from(el.attributes)) if (!/^xmlns(:|$)/.test(at.name)) n.attrs[at.name] = at.value;
      const ch = Array.from(el.children);
      if (el.localName === 'drawText') {
        const sl = kid(el, 'subList'), sub = {};
        if (sl) for (const at of Array.from(sl.attributes)) sub[at.name] = at.value;
        n.text = { sub, blocks: sl ? parseParas(sl) : [] };
        n.kids = ch.filter(c => c !== sl).map(readNode);
        return n;
      }
      if (el.localName === 'img') { const bin = binImage(el.getAttribute('binaryItemIDRef')); if (bin) n.image = bin; }
      if (ch.length) n.kids = ch.map(readNode);
      else if (el.textContent) n.txt = el.textContent;
      return n;
    }
    const inlinePic = el => { const p = kid(el, 'pos'); return !p || p.getAttribute('treatAsChar') === '1'; };
    function readSecPr(sp) {
      doc.outlineId = attrNum(sp, 'outlineShapeIDRef', 1) || 1;
      // 구역 정의의 나머지 항목 (첫 구역 것): 글 방향·단 사이·기본 탭 간격 · 격자(원고지) · 시작 번호 · 감추기 · 줄 번호 · 각주/미주 모양
      if (!doc.sec) {
        const A = e => { if (!e) return null; const o = {}; for (const a of Array.from(e.attributes)) o[a.name] = a.value; return o; };
        const note = tag => { const n = kid(sp, tag); if (!n) return null; const o = {}; for (const c of Array.from(n.children)) o[c.localName] = A(c); return o; };
        const at = A(sp), attrs = {};
        for (const k of ['textDirection', 'spaceColumns', 'tabStop', 'tabStopVal', 'tabStopUnit']) if (at[k] !== undefined) attrs[k] = at[k];
        doc.sec = { attrs, grid: A(kid(sp, 'grid')), startNum: A(kid(sp, 'startNum')), visibility: A(kid(sp, 'visibility')), lineNumberShape: A(kid(sp, 'lineNumberShape')),
          foot: note('footNotePr'), end: note('endNotePr') };
      }
      // 쪽 테두리/배경 (양쪽·짝수·홀수 쪽) — 테두리도 배경도 없는 것은 빼고 보관
      const pbs = kids(sp, 'pageBorderFill').map(pb => {
        const def = fillDefs[pb.getAttribute('borderFillIDRef')];
        if (!def) return null;
        const img = def.imgRef ? binImage(def.imgRef) : null;
        if (!img && !def.bg && ['l', 'r', 't', 'b'].every(k => def.sides[k].type === 'NONE')) return null;
        const off = kid(pb, 'offset');
        return { type: pb.getAttribute('type') || 'BOTH', textBorder: pb.getAttribute('textBorder') || 'PAPER', headerInside: pb.getAttribute('headerInside') === '1', footerInside: pb.getAttribute('footerInside') === '1',
          fillArea: pb.getAttribute('fillArea') || 'PAPER', offset: { l: attrNum(off, 'left', 1417), r: attrNum(off, 'right', 1417), t: attrNum(off, 'top', 1417), b: attrNum(off, 'bottom', 1417) },
          sides: def.sides, bg: def.bg, img: img ? Object.assign(img, { mode: def.imgMode }) : null };
      }).filter(Boolean);
      if (pbs.length && !doc.pageBorders) doc.pageBorders = pbs;
      // 바탕쪽: Contents/masterpageN.xml (쪽마다 본문 뒤에 그려지는 내용)
      for (const mp of kids(sp, 'masterPage')) {
        const f = 'Contents/' + mp.getAttribute('idRef') + '.xml';
        if (!files[f] || doc.masterPages && doc.masterPages.some(m => m.file === f)) continue;
        const root = parse(f).documentElement, sl = kid(root, 'subList');
        const attrs = {}, sub = {};
        for (const a of Array.from(root.attributes)) if (!/^xmlns|^id$/.test(a.name)) attrs[a.name] = a.value;
        if (sl) for (const a of Array.from(sl.attributes)) sub[a.name] = a.value;
        const type = attrs.type || 'BOTH';
        delete attrs.type;
        (doc.masterPages = doc.masterPages || []).push({ file: f, type, attrs, sub, blocks: sl ? parseParas(sl) : [] });
      }
      const pp = kid(sp, 'pagePr');
      if (!pp || doc.pageSet) return; // 용지 설정은 첫 구역 것을 씀
      doc.pageSet = true;
      const mg = kid(pp, 'margin');
      const w = hwpToMm(attrNum(pp, 'width', 59528)), h = hwpToMm(attrNum(pp, 'height', 84188));
      // mm 는 0.1 단위로 줄여 보관하므로 원래 HWPUNIT 값도 둠 (바꾸지 않았으면 저장 때 그대로)
      const huv = { width: attrNum(pp, 'width', 59528), height: attrNum(pp, 'height', 84188) };
      for (const k of ['top', 'bottom', 'left', 'right', 'header', 'footer']) huv[k] = attrNum(mg, k, 0);
      const paper = Object.keys(PAPERS).find(k => Math.abs(PAPERS[k][0] - w) < 1 && Math.abs(PAPERS[k][1] - h) < 1) || '사용자 정의';
      doc.page = {
        paper, width: w, height: h, landscape: pp.getAttribute('landscape') === 'NARROWLY', hu: huv,
        margin: {
          top: hwpToMm(attrNum(mg, 'top', 5669)), bottom: hwpToMm(attrNum(mg, 'bottom', 4252)),
          left: hwpToMm(attrNum(mg, 'left', 8504)), right: hwpToMm(attrNum(mg, 'right', 8504)),
          header: hwpToMm(attrNum(mg, 'header', 4252)), footer: hwpToMm(attrNum(mg, 'footer', 4252)),
        },
      };
    }
    function readCtrl(ctrl, cur, cs) {
      for (const el of Array.from(ctrl.children)) {
        if (el.localName === 'header' || el.localName === 'footer') {
          const sl = kid(el, 'subList');
          if (el.localName === 'footer' && !doc.header && doc.sec && !doc.footer) doc.sec.footerFirst = true;
          // 둘째부터는 문단 안 자리에 (그 쪽부터 바뀜)
          if (doc[el.localName] && cur) { cur.runs.push({ hf: { kind: el.localName, apply: el.getAttribute('applyPageType') || 'BOTH', blocks: sl ? parseParas(sl) : [] }, style: Object.assign({}, cs) }); continue; }
          if (sl) doc[el.localName] = parseParas(sl);
        } else if (el.localName === 'pageNum') {
          const pos = el.getAttribute('pos');
          if (pos && pos !== 'NONE') doc.pageNum = { pos, dash: el.getAttribute('sideChar') === '-' };
        } else if (el.localName === 'colPr' && !doc.columns) {
          const n = attrNum(el, 'colCount', 1);
          if (n > 1) doc.columns = { count: n, gap: hwpToMm(attrNum(el, 'sameGap', 2268)) };
        }
      }
    }
    const parseParas = container => kids(container, 'p').flatMap(parsePara);
    // 누름틀(CLICK_HERE) 이름: name 속성 → 안내문(Direction) 순
    function fieldName(fb) {
      let name = fb.getAttribute('name') || '';
      const ps = all(fb, 'stringParam');
      if (!name) { const d = ps.find(s => s.getAttribute('name') === 'Direction'); name = d ? d.textContent : ''; }
      if (!name) { const c = ps.find(s => s.getAttribute('name') === 'Command'); name = c ? clickDirection(c.textContent) : ''; }
      return name.replace(/[{}\n\r]/g, '').trim().slice(0, 40) || '입력';
    }
    const fieldCmd = fb => { const c = all(fb, 'stringParam').find(s => s.getAttribute('name') === 'Command'); return c ? c.textContent : ''; };
    // 하이퍼링크 주소: Path 값, 없으면 Command("주소;1;0;0", ':' 는 '\:' 로 저장됨)
    function linkUrl(fb) {
      const ps = all(fb, 'stringParam');
      const path = ps.find(s => s.getAttribute('name') === 'Path');
      if (path && path.textContent) return path.textContent;
      const cmd = ps.find(s => s.getAttribute('name') === 'Command');
      return cmd ? unescapeCmd(cmd.textContent) : '';
    }
    function parsePara(p) {
      const pp = Object.assign({}, paras[p.getAttribute('paraPrIDRef')] || { align: 'justify' });
      const sid = attrNum(p, 'styleIDRef', 0);
      if (sid > 0) pp.styleId = sid; // 문단 스타일 번호
      const out = [];
      const fresh = () => Object.assign({ type: 'p', runs: [] }, pp);
      let cur = fresh(), field = null, link = null, gfd = null;
      const textLen = () => cur.runs.reduce((n, r) => n + (r.text ? r.text.length : 1), 0);
      if (p.getAttribute('pageBreak') === '1') cur.pageBreak = true;
      for (const run of kids(p, 'run')) {
        const cs = chars[run.getAttribute('charPrIDRef')] || {};
        for (const el of Array.from(run.children)) {
          const n = el.localName;
          if (n === 'ctrl') {
            const fb = kid(el, 'fieldBegin'), fe = kid(el, 'fieldEnd');
            if (fb && fb.getAttribute('type') === 'CLICK_HERE') field = { id: fb.getAttribute('id'), name: fieldName(fb), at: textLen(), runs: cur.runs, ch: { id: 'f' + fb.getAttribute('id'), name: fieldName(fb), fname: fb.getAttribute('name') || '', cmd: fieldCmd(fb) } };
            if (fb && fb.getAttribute('type') === 'HYPERLINK') link = { id: fb.getAttribute('id'), url: linkUrl(fb) };
            // 그 밖의 필드(날짜·문서 날짜·사용자 정보·계산식·책갈피 등): 요소 그대로 보관해 다시 저장 (한글이 열 때 내용을 새로 고침)
            if (fb && !/^(CLICK_HERE|HYPERLINK)$/.test(fb.getAttribute('type'))) gfd = { raw: fb.getAttribute('id'), at: textLen(), runs: cur.runs, fd: { id: 'g' + fb.getAttribute('id'), node: readNode(fb) } };
            if (fe) {
              const ref = fe.getAttribute('beginIDRef');
              if (gfd && ref === gfd.raw) {
                // 현재 날짜 필드는 한글처럼 열 때 오늘 날짜로 (한글 시험: 하루 지난 뒤 연 HWPX 에서 날짜가 바뀜)
                const date = gfd.runs === cur.runs ? fieldDate(gfd.fd) : null;
                if (date) {
                  const first = cur.runs.findIndex(r => r.fd === gfd.fd);
                  if (first < 0) cur.runs.push(Object.assign({}, cs, { text: date, fd: gfd.fd }));
                  else { cur.runs[first].text = date; for (let k = cur.runs.length - 1; k > first; k--) if (cur.runs[k].fd === gfd.fd) cur.runs.splice(k, 1); }
                }
                // 내용 없는 필드(책갈피 등)는 자리 표시 조각으로
                else if (gfd.runs === cur.runs && textLen() === gfd.at) cur.runs.push({ field: gfd.fd, style: Object.assign({}, cs) });
                gfd = null;
              } else if (link && (!ref || ref === link.id)) link = null;
              else if (field) {
                // 내용이 빈 누름틀은 자동 채우기 칸 {{이름}} 으로 표시 (저장할 때는 다시 빈 누름틀로)
                if (field.runs === cur.runs && textLen() === field.at) cur.runs.push(Object.assign({}, cs, { text: `{{${field.name}}}`, ch: field.ch, placeholder: true }));
                field = null;
              }
            }
            // 쪽 번호 넣기 등 자동 번호 (각주·미주 번호는 주석 쪽에서 다룸)
            const an = kid(el, 'autoNum');
            if (an && !/NOTE/.test(an.getAttribute('numType') || '')) {
              const fm = kid(an, 'autoNumFormat');
              cur.runs.push({ autoNum: { numType: an.getAttribute('numType') || 'PAGE', num: attrNum(an, 'num', 1),
                format: { type: (fm && fm.getAttribute('type')) || 'DIGIT', userChar: (fm && fm.getAttribute('userChar')) || '', prefixChar: (fm && fm.getAttribute('prefixChar')) || '', suffixChar: (fm && fm.getAttribute('suffixChar')) || '', supscript: fm && fm.getAttribute('supscript') === '1' ? 1 : 0 } }, style: Object.assign({}, cs) });
            }
            // 각주·미주
            for (const nt of Array.from(el.children)) {
              if (nt.localName !== 'footNote' && nt.localName !== 'endNote') continue;
              const sl = kid(nt, 'subList');
              const blocks = sl ? parseParas(sl) : [];
              const f = blocks[0] && blocks[0].runs && blocks[0].runs[0];
              if (f && f.text && f.text.startsWith(' ')) f.text = f.text.slice(1);
              cur.runs.push({ note: { kind: nt.localName === 'endNote' ? 'end' : 'foot', blocks, style: Object.assign({}, cs) } });
            }
          }
          if (n === 't') {
            const text = textOf(el);
            if (text) cur.runs.push(...splitSymbols(text, Object.assign({}, cs, link ? { link: link.url } : null, field && field.runs === cur.runs ? { ch: field.ch } : null, gfd && gfd.runs === cur.runs ? { fd: gfd.fd } : null), charSym[run.getAttribute('charPrIDRef')]));
          } else if (n === 'tbl') {
            // 표는 문단 안 자리 그대로 두었다가 문단 끝에서 정리 (settleTables)
            cur.runs.push({ table: parseTable(el), style: Object.assign({}, cs) });
          } else if (n === 'compose') {
            // 글자 겹침
            cur.runs.push({ compose: { text: el.getAttribute('composeText') || '', circleType: el.getAttribute('circleType') || 'CHAR', charSz: attrNum(el, 'charSz', 0),
              composeType: el.getAttribute('composeType') || 'SPREAD', refs: kids(el, 'charPr').map(c => attrNum(c, 'prIDRef', 4294967295)) }, style: Object.assign({}, cs) });
          } else if (n === 'pic' && inlinePic(el)) {
            const image = readPic(el);
            if (image) cur.runs.push({ image, style: Object.assign({}, cs) }); else skipped++;
          } else if (g.PureunShape && g.PureunShape.isShapeTag(n)) {
            // 그리기 개체 (도형·글상자·묶음·떠 있는 그림·수식 등)
            cur.runs.push({ shape: readNode(el), style: Object.assign({}, cs) });
          } else if (n === 'secPr') {
            readSecPr(el);
          } else if (n === 'ctrl') {
            readCtrl(el, cur, cs);
          } else if (!SILENT.has(n)) {
            skipped++;
          }
        }
      }
      // 빈 문단도 글자 크기를 지녀야 줄 높이가 원본과 같음
      const allRuns = kids(p, 'run'), firstRun = allRuns[0];
      if (!cur.runs.some(r => !r.field) && firstRun) cur.mark =Object.assign({}, chars[firstRun.getAttribute('charPrIDRef')] || {});
      // 문단 끝 글자 모양: 마지막 빈 run 이 글자와 다른 모양이면 보관 (한글은 이것도 줄 높이에 넣음 — 한글 시험 문서로 확인)
      // 글자 없는 run: 자식이 없거나, 글자 없는 <hp:t/>·컨트롤(필드 끝 등)만 있는 것 — 그 모양이 문단 끝 모양
      const emptyRun = r => Array.from(r.children).every(c => (c.localName === 't' && !c.textContent && !c.children.length) || (c.localName === 'ctrl' && !all(c, 'autoNum').length && !all(c, 'footNote').length && !all(c, 'endNote').length));
      const lastRun = allRuns[allRuns.length - 1], lastText = allRuns.filter(r => !emptyRun(r) && kids(r, 't').some(t => t.textContent || t.children.length)).pop();
      if (cur.runs.some(r => r.text) && lastRun && emptyRun(lastRun) && lastText && lastRun.getAttribute('charPrIDRef') !== lastText.getAttribute('charPrIDRef'))
        cur.endMark = Object.assign({}, chars[lastRun.getAttribute('charPrIDRef')] || {});
      out.push(...settleTables(cur));
      return out;
    }
    function parseTable(tbl) {
      const spans = [];
      // 셀 여백 (mm, 0.1 단위) + 원래 HWPUNIT 값 hu [왼·오·위·아래] — 바꾸지 않았으면 저장 때 그대로
      const mOf = e => (e ? { l: hwpToMm(attrNum(e, 'left', 510)), r: hwpToMm(attrNum(e, 'right', 510)), t: hwpToMm(attrNum(e, 'top', 141)), b: hwpToMm(attrNum(e, 'bottom', 141)),
        hu: [attrNum(e, 'left', 510), attrNum(e, 'right', 510), attrNum(e, 'top', 141), attrNum(e, 'bottom', 141)] } : null);
      const tblMargin = mOf(kid(tbl, 'inMargin'));
      const rows = kids(tbl, 'tr').map(tr => kids(tr, 'tc').map(tc => {
        const span = kid(tc, 'cellSpan'), addr = kid(tc, 'cellAddr'), sz = kid(tc, 'cellSz'), sl = kid(tc, 'subList');
        const margin = compactMargin(tc.getAttribute('hasMargin') === '1' ? mOf(kid(tc, 'cellMargin')) : tblMargin);
        const colSpan = attrNum(span, 'colSpan', 1) || 1, rowSpan = attrNum(span, 'rowSpan', 1) || 1;
        if (addr && sz) spans.push({ col: attrNum(addr, 'colAddr', 0), span: colSpan, w: attrNum(sz, 'width', 0) });
        const va = sl && sl.getAttribute('vertAlign');
        return {
          colSpan, rowSpan, height: sz ? hwpToMm(attrNum(sz, 'height', 0)) : 0, hh: sz ? attrNum(sz, 'height', 0) : 0, bg: fillColor[tc.getAttribute('borderFillIDRef')] || null,
          borders: fillBorders[tc.getAttribute('borderFillIDRef')] || null, margin,
          valign: va === 'TOP' ? 'top' : va === 'BOTTOM' ? 'bottom' : 'middle',
          blocks: sl ? parseParas(sl) : [],
          // 세로쓰기 칸
          ...(sl && /^VERTICAL/.test(sl.getAttribute('textDirection') || '') ? { dir: sl.getAttribute('textDirection') } : null),
          // 한 줄로 입력(SQUEEZE)·KEEP: 칸 글을 줄 바꿈 없이
          ...(sl && /^(SQUEEZE|KEEP)$/.test(sl.getAttribute('lineWrap') || '') ? { wrap: sl.getAttribute('lineWrap') } : null),
        };
      }));
      const nCols = attrNum(tbl, 'colCnt', 0) || Math.max(1, ...rows.map(r => r.reduce((s, c) => s + c.colSpan, 0)));
      const totalW = attrNum(kid(tbl, 'sz'), 'width', 0);
      // 배치: 글자처럼 취급·기준·정렬·거리 (원본 그대로 다시 저장)
      const pos = kid(tbl, 'pos'), om = kid(tbl, 'outMargin');
      const place = pos ? {
        inline: pos.getAttribute('treatAsChar') === '1', affect: pos.getAttribute('affectLSpacing') === '1',
        vertRelTo: pos.getAttribute('vertRelTo') || 'PARA', vertAlign: pos.getAttribute('vertAlign') || 'TOP',
        horzRelTo: pos.getAttribute('horzRelTo') || 'COLUMN', horzAlign: pos.getAttribute('horzAlign') || 'LEFT',
        flow: pos.getAttribute('flowWithText') === '1', overlap: pos.getAttribute('allowOverlap') === '1',
        wrap: tbl.getAttribute('textWrap') || 'TOP_AND_BOTTOM', vertOffset: attrNum(pos, 'vertOffset', 0), horzOffset: attrNum(pos, 'horzOffset', 0), zOrder: attrNum(tbl, 'zOrder', 0),
        out: { l: attrNum(om, 'left', 0), r: attrNum(om, 'right', 0), t: attrNum(om, 'top', 0), b: attrNum(om, 'bottom', 0) },
        pageBreak: tbl.getAttribute('pageBreak') || 'CELL', repeatHeader: tbl.getAttribute('repeatHeader') === '1', noAdjust: tbl.getAttribute('noAdjust') === '1',
        inMargin: (im => (im ? { l: attrNum(im, 'left', 510), r: attrNum(im, 'right', 510), t: attrNum(im, 'top', 141), b: attrNum(im, 'bottom', 141) } : null))(kid(tbl, 'inMargin')),
      } : null;
      const ws = solveWidths(nCols, spans, totalW);
      const sum = ws.reduce((a, b) => a + b, 0) || 1;
      return Object.assign({ type: 'table', colWidths: ws.map(w => w / sum), totalWidth: totalW, rows }, place ? { place } : null);
    }

    const sections = Object.keys(files)
      .filter(n => /^Contents\/section\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    sections.forEach((name, i) => {
      const blocks = parseParas(parse(name).documentElement);
      if (i > 0 && blocks[0]) blocks[0].pageBreak = true; // 구역이 바뀌면 새 쪽에서 시작
      doc.blocks.push(...blocks);
    });
    fixTableWidths(doc);
    doc.skipped = skipped;
    return doc;
  }

  // 문단 안의 표 정리 (두 읽기 공통)
  //  · 표 하나뿐이고 글자가 없으면 → 표 블록 (같은 문단의 떠 있는 개체는 표에 딸리고, 문단 모양은 표에 보관)
  //  · 글자처럼 취급한 표가 글자·다른 표와 한 문단에 있으면 → 문단 안에 그대로 (한글처럼 한 줄에 나란히)
  //  · 그 밖(떠 있는 표와 글자가 섞임) → 표 앞뒤로 문단을 나눔
  let grpSeq = 0;
  function settleTables(p) {
    const tabs = p.runs.filter(r => r.table);
    if (!tabs.length) return [p];
    const S = g.PureunShape;
    const floating = r => r.shape && S && !S.posOf(r.shape).inline;
    const props = Object.assign({}, p);
    delete props.runs; delete props.mark; delete props.pageBreak; delete props.type; delete props.endMark;
    // 표가 든 문단의 문단 모양과 그 자리 글자 크기(줄 간격 여분 계산용)를 표에 보관
    //  mark: 표가 놓인 자리의 글자 모양 — 떠 있는 표 다음에 오는 그 문단의 빈 줄 높이를 정함 (편집기 floatTableSpacing)
    const asBlock = (t, r) => Object.assign(t, { para: Object.assign({}, props, r && r.style && r.style.size ? { charSize: r.style.size } : null,
      r && r.style && r.style.font ? { mark: { font: r.style.font, size: r.style.size, langs: r.style.langs } } : null) });
    if (tabs.length === 1 && p.runs.every(r => r.table || floating(r) || r.field)) {
      const t = asBlock(tabs[0].table, tabs[0]), anchors = p.runs.filter(floating);
      // 표 뒤에 있던 개체는 저장할 때도 표 뒤에 (한글의 글자 순서·개체 순서 그대로). 개체 요소에 표시해 두면 편집 중에도 따라감
      const ti = p.runs.indexOf(tabs[0]);
      p.runs.forEach((r, i) => { if (i > ti && floating(r)) r.shape.afterTable = true; });
      if (anchors.length) t.anchors = anchors;
      if (p.pageBreak) t.pageBreak = true;
      return [t];
    }
    if (tabs.every(r => r.table.place && r.table.place.inline)) { tabs.forEach(r => asBlock(r.table, r)); return [p]; }
    // 표와 글이 한 문단에 있으면 편집 화면에서는 나누고, 조각마다 같은 grp 를 붙여 저장할 때 다시 한 문단으로 (mergeGroups)
    const out = [], grp = String(++grpSeq);
    let cur = Object.assign({ type: 'p' }, props, { runs: [], grp });
    // 내용 없는 필드 조각(책갈피 등)만 있는 조각은 문단으로 만들지 않고 다음(없으면 앞) 글 조각에 붙임
    const hasBody = q => q.runs.some(x => !x.field);
    for (const r of p.runs) {
      if (!r.table) { cur.runs.push(r); continue; }
      if (hasBody(cur)) { out.push(cur); cur = Object.assign({ type: 'p' }, props, { runs: [], grp }); }
      out.push(Object.assign(asBlock(r.table, r), { grp }));
    }
    if (hasBody(cur)) out.push(cur);
    else if (cur.runs.length) { const lp = out.filter(q => q.type === 'p').pop(); if (lp) lp.runs.push(...cur.runs); }
    // 한 문단의 위 간격은 첫 조각에만, 아래 간격은 끝 조각에만 (표 조각은 편집기가 표 문단 모양에서 같은 규칙으로 정함)
    out.forEach((q, k) => { if (q.type !== 'p') return; if (k > 0) q.before = 0; if (k < out.length - 1) q.after = 0; });
    if (p.pageBreak && out[0]) out[0].pageBreak = true;
    // 문단 끝 글자 모양은 마지막 글 조각에
    if (p.endMark && out.length && out[out.length - 1].type === 'p') out[out.length - 1].endMark = p.endMark;
    return out;
  }

  // 칸 너비 풀기: 셀마다 '걸친 칸 너비의 합 = 셀 너비' 이므로 병합 셀까지 써서 칸 너비를 정확히 구함
  // cells: [{ col, span, w }]
  function solveWidths(nCols, cells, total) {
    const ws = Array(nCols).fill(null);
    for (const c of cells) if (c.span === 1 && c.col < nCols && ws[c.col] === null && c.w > 0) ws[c.col] = c.w;
    const unknownIn = c => { const idx = []; let known = 0; for (let k = c.col; k < Math.min(nCols, c.col + c.span); k++) { if (ws[k] === null) idx.push(k); else known += ws[k]; } return { idx, known }; };
    for (let changed = true, guard = 0; changed && guard < 100; guard++) {
      changed = false;
      for (const c of cells) {
        if (c.span < 2 || !(c.w > 0)) continue;
        const { idx, known } = unknownIn(c);
        if (idx.length === 1) { ws[idx[0]] = Math.max(1, c.w - known); changed = true; }
      }
    }
    for (const c of cells) {
      if (!(c.w > 0)) continue;
      const { idx, known } = unknownIn(c);
      if (idx.length) { const each = Math.max(1, (c.w - known) / idx.length); idx.forEach(k => { ws[k] = each; }); }
    }
    const known = ws.reduce((a, b) => a + (b || 0), 0), unknown = ws.filter(w => w === null).length;
    const fill = unknown ? Math.max(1, ((total || known) - known) / unknown || known / Math.max(1, nCols - unknown) || 1) : 0;
    return ws.map(w => (w === null ? fill : w));
  }

  // 표 폭(HWPUNIT)을 본문 폭 대비 비율로 변환
  function fixTableWidths(doc) {
    const pg = doc.page;
    const body = bodyHu(pg);
    // 표 폭은 담긴 곳(본문·글상자·칸) 폭에 대한 비율로
    //  칸 안의 표는 그 칸의 글 영역 폭(칸 너비 − 칸 왼·오른쪽 여백) 기준 ((DB)sample02: 바깥 칸 47024 안의 46216 표를 본문 48190 기준으로 잡아 2.6% 좁던 것)
    const fix = (t, base) => {
      // 본문보다 넓은 표도 한글처럼 그 폭 그대로 (여백 쪽으로 나감). 터무니없는 값만 막음
      const total = t.totalWidth;
      t.widthRatio = total ? Math.min(3, total / base) : 1;
      delete t.totalWidth;
      const grid = [];
      // 칸 왼·오른쪽 여백 (HWPUNIT) — 저장(tableXml)과 같게: 칸 여백이 없으면 한글 기본 510
      const lr = m => (!m ? 1020 : m.hu ? m.hu[0] + m.hu[1] : Math.round(((+m.l || 0) + (+m.r || 0)) * MM));
      t.rows.forEach((row, ri) => {
        let ci = 0;
        for (const c of row) {
          if (!c) continue;
          while (grid[ri] && grid[ri][ci]) ci++;
          for (let a = 0; a < (c.rowSpan || 1); a++) for (let d = 0; d < (c.colSpan || 1); d++) (grid[ri + a] = grid[ri + a] || [])[ci + d] = true;
          const frac = (t.colWidths || []).slice(ci, ci + (c.colSpan || 1)).reduce((s, w) => s + w, 0);
          const inner = total && frac > 0 ? total * frac - lr(c.margin) : 0;
          walk(c.blocks, inner > 100 ? inner : base);
          ci += c.colSpan || 1;
        }
      });
      for (const r of t.anchors || []) if (r.shape) walkShape(r.shape);
    };
    const walkShape = n => {
      if (n.text) walk(n.text.blocks, Math.max(1000, +(n.attrs && n.attrs.lastWidth) || base0));
      for (const k of n.kids || []) walkShape(k);
    };
    const base0 = body;
    function walk(blocks, base) {
      for (const b of blocks || []) {
        if (b.type === 'table') { fix(b, base); continue; }
        for (const r of b.runs || []) {
          if (r.table) fix(r.table, base);
          if (r.note) walk(r.note.blocks, base);
          if (r.hf) walk(r.hf.blocks, body);
          if (r.shape) walkShape(r.shape);
        }
      }
    }
    walk(doc.blocks, body);
    walk(doc.header, body);
    walk(doc.footer, body);
  }

  g.PureunHwpx = { buildHwpx, readHwpx, plainText, normalizeDoc, defaultPage, fixTableWidths, settleTables, compactBorders, compactMargin, solveWidths, puaChar, mapPuaText, unescapeCmd, clickDirection, splitSymbols, numText, headCounter, headDef, numTypeOf, makeLangs, parseLangs, makeFx, parseFx, typeInfoOf, NBSP_LIT, makePP, parsePP, WORD_COMPAT_FLAGS, NUM_TYPES, DEFAULT_OUTLINE, PAPERS, DEFAULT_FONT, MM, DEFAULT_SIDE };
})(typeof window !== 'undefined' ? window : globalThis);
