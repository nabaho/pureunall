// 편집 화면(HTML) ↔ 문서 모델 변환
(function (g) {
  const DEFAULT_FONT = g.PureunHwpx.DEFAULT_FONT;
  const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'PRE', 'TBODY', 'THEAD', 'TFOOT', 'HR']);
  const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
  const PX_PER_MM = 96 / 25.4;

  const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const r1 = v => Math.round(v * 10) / 10;
  const ratioAdj = ratio => (ratio && ratio !== 100 ? ((ratio - 100) / 100) * 0.9 : 0); // em

  // 글꼴에 한글 글자가 없는지 (영문 전용 글꼴): '한' 을 그 글꼴로 그린 것과 대체 글꼴로만 그린 것이 같으면 없음. 없는 글꼴도 '없음'
  // 빈칸 폭: 한글은 '글꼴에 어울리는 빈칸'을 쓰지 않으면 글꼴과 상관없이 글자 크기의 절반(0.5em)으로 잼
  //  (한컴바탕·Times New Roman·Verdana·Arial·함초롬바탕 10pt 빈칸 10개 = 5000 HWPUNIT, 탭 너비로 잰 한글 값. 이렇게 맞추면 글 폭이 0.3% 안으로 같음)
  //  → 브라우저 글꼴의 빈칸 폭과의 차이를 word-spacing 으로 채움
  const spaceCache = new Map();
  function spaceEm(font, bold) {
    bold = false; // 굵게여도 보통 굵기 폭 (charEm 과 같음 — 화면 차이는 advFix 가 채움)
    const key = fontList(font) + (bold ? '|b' : ''); // 글꼴 목록(문서의 대체 글꼴 포함)마다
    if (spaceCache.has(key)) return spaceCache.get(key);
    let v = 0.3;
    try { const cx = document.createElement('canvas').getContext('2d'); cx.font = `${bold ? 'bold ' : ''}100px ${fontList(font)}, '${DEFAULT_FONT}'`; v = cx.measureText(' ').width / 100 || 0.3; } catch (e) {}
    spaceCache.set(key, v);
    return v;
  }
  // 브라우저가 찾지 못하는 글꼴: 설치된 HY 글꼴 일부는 굵기를 뺀 영문 이름으로만 찾음 (Windows 글꼴 묶음 이름 — 이 PC의 Chrome·Edge 에서 확인, 글자 폭은 한글과 같음)
  //  'HY그래픽' 은 없는 이름이지만 한글이 HY그래픽M 으로 바꿔 씀 (한글 시험: 가·i·M·a·1·( 폭이 HY그래픽M 과 같음)
  const FONT_ALT = { 'HY그래픽M': 'HYGraphic', 'HY그래픽': 'HYGraphic', 'HY신명조': 'HYSinMyeongJo', 'HY중고딕': 'HYGothic', 'HY헤드라인M': 'HYHeadLine', 'HY궁서B': 'HYGungSo', 'HY목각파임B': 'HYPMokGak', 'HY얕은샘물M': 'HYShortSamul', 'HY엽서L': 'HYPost', 'HY엽서M': 'HYPost' };
  // 한글은 없는 글꼴을 한컴바탕으로 바꿔 계산 (한글 시험: 없는 이름·한양신명조·신명 신명조의 가·i·M·a·1·( 폭이 한컴바탕과 같음)
  const MISSING_FONT = '한컴바탕';
  const availCache = new Map();
  function fontAvail(font) {
    if (typeof document === 'undefined') return true;
    if (availCache.has(font)) return availCache.get(font);
    let v = true;
    try {
      const cx = document.createElement('canvas').getContext('2d');
      const sig = fb => { cx.font = `100px '${font}', '${fb}'`; return ['M', 'i', 'W', '1', '가'].map(ch => cx.measureText(ch).width).join(','); };
      v = sig('Courier New') === sig('Times New Roman');
    } catch (e) {}
    availCache.set(font, v);
    return v;
  }
  // 한글 전용(HFT) 글꼴: 한글은 한글 글자를 1em, 영문·기호는 대체 TTF 글꼴 폭으로 그림 (한글 시험: 한양신명조·한양견명조·명조·신명 신명조 = 바탕,
  //  한양중고딕·한양견고딕·고딕·신명 중고딕 = 돋움, 한양그래픽 = 굴림, 한양궁서 = 궁서 — 한글이 HWPX 에 적는 대체 글꼴 substFont 와 같음)
  //  → 문서 글꼴 정보(종류 HFT)에서 대체 글꼴을 정해 글꼴 목록 둘째에 둠 (그 밖의 HFT 는 분류가 명조면 바탕, 아니면 돋움 [확인 필요])
  let hftSubst = new Map();
  const hftSubstOf = (face, inf) => (/궁서/.test(face) ? '궁서' : /그래픽/.test(face) ? '굴림' : /명조/.test(face) ? '바탕' : /고딕/.test(face) ? '돋움'
    : (inf.subst && inf.subst.type !== 'HFT' && inf.subst.face) || (inf.ti && inf.ti.familyType === 'FCAT_MYUNGJO' ? '바탕' : '돋움'));
  //  HFT 글꼴의 기호 폭(em, 10pt 한 줄 문턱으로 잰 값): 한양신명조·한양중고딕·명조는 자기 기호 글자(※ 1·□■ 0.888·▲ 0.916), 그 밖은 ※ 0.76·… 0.845
  const HFT_SYM_A = new Set(['한양신명조', '한양중고딕', '명조']);
  const HFT_SYM = {
    A: { '※': 1, '□': 0.888, '■': 0.888, '▲': 0.916, '「': 1.025, '」': 1.025, '『': 1.025, '』': 1.025, '…': 1.025, '○': 1, '●': 1, '△': 1, '◇': 1, '◆': 1, '①': 1, '㉠': 1, '㈜': 1, '→': 1, '☞': 1 },
    B: { '※': 0.76, '□': 1, '■': 1, '▲': 1, '「': 1.025, '」': 1.025, '『': 1.025, '』': 1.025, '…': 0.845, '○': 1, '●': 1, '△': 1, '◇': 1, '◆': 1, '①': 1, '㉠': 1, '㈜': 1, '→': 1, '☞': 1 },
  };
  const hftSymEm = (ch, font) => (hftSubst.has(font) && HFT_SYM[HFT_SYM_A.has(font) ? 'A' : 'B'][ch]) || 0;
  function setFontInfo(fi) {
    hftSubst = new Map();
    for (const l of Object.keys(fi || {})) for (const [face, inf] of Object.entries(fi[l] || {})) if (inf && inf.type === 'HFT' && !hftSubst.has(face)) hftSubst.set(face, hftSubstOf(face, inf));
  }
  // 글꼴 하나의 CSS 이름 목록: 한글 전용 글꼴이면 대체 TTF, 브라우저에 없으면 대체 이름, 그다음 한컴바탕
  //  글꼴에 없는 글자도 한글은 한컴바탕 폭으로 계산 (한글 시험: HyhwpEQ·Times New Roman·Arial·Verdana·HancomEQN 의 '가'·'한'·'①' 이 1em — 함초롬바탕은 0.97em)
  function fontList(font) {
    const fs = [font];
    if (hftSubst.has(font)) fs.push(hftSubst.get(font));
    if (!fontAvail(font) && FONT_ALT[font]) fs.push(FONT_ALT[font]);
    if (font !== MISSING_FONT && font !== DEFAULT_FONT) fs.push(MISSING_FONT);
    return fs.map(f => `'${f}'`).join(',');
  }
  const latinOnlyCache = new Map();
  function latinOnly(font) {
    if (latinOnlyCache.has(font)) return latinOnlyCache.get(font);
    let v = false;
    if (!fontAvail(font)) { latinOnlyCache.set(font, v); return v; } // 없는 글꼴은 영문 글꼴로 따로 두지 않음 (한글 글자가 대체 글꼴로 그려지지 않게)
    try {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 40;
      const cx = cv.getContext('2d');
      const draw = f => { cx.clearRect(0, 0, 64, 40); cx.font = f; cx.fillText('한글', 0, 32); return cx.getImageData(0, 0, 64, 40).data.join(','); };
      v = draw(`32px '${font}', monospace`) === draw('32px monospace');
    } catch (e) {}
    latinOnlyCache.set(font, v);
    return v;
  }
  // 글자의 CSS 글꼴 목록: 영문 글꼴이 따로 있고 한글 글자가 없는 글꼴이면 앞에 두어 영문은 그 글꼴, 한글은 다음 글꼴로 그려지게 함
  // 한컴 전용 기호는 함초롬 글꼴에 들어 있으므로 다른 글꼴이어도 대체 글꼴로 함초롬을 둠
  const latinFont = r => { const font = r.font || DEFAULT_FONT, f = r.langs && g.PureunHwpx.parseLangs(r.langs).f; return f && f[0] === font && f[1] !== font && latinOnly(f[1]) ? f[1] : null; };
  function familyCss(r) {
    const font = r.font || DEFAULT_FONT;
    const latin = latinFont(r);
    if (!latin && font === DEFAULT_FONT) return '';
    return `font-family:${latin ? `'${latin}',` : ''}${fontList(font)}${font !== DEFAULT_FONT ? `,'${DEFAULT_FONT}'` : ''}`; // 영문 글꼴 뒤에는 대체 글꼴을 두지 않음(한글 글자는 한글 글꼴로)
  }
  // 글자 조각의 빈칸 보정 (em): 한글 빈칸 = 0.5em × 장평 — 화면 글꼴 빈칸 − 장평 흉내 자간. 문단 공백 최소값(condense)도 함께
  let curCondense = 0, lastTextRun = null;
  // 한글 줄 나눔 자리: '어절 단위'(breakNonLatinWord BREAK_WORD) 문단은 빈칸에서만 나눔 — 문장부호·기호 둘레에서도 안 나눔 (한글 시험: 57가지 문자 모두),
  //  영문 낱말(단어 단위)은 '-' '?' 뒤에서도 안 나눔 (한글 시험 31가지). 크롬은 keep-all 이어도 문장부호 둘레에서, 영문은 '-' '?' 뒤에서 나눔
  //  → 그 사이에 줄 나눔 금지 문자(U+2060, 폭 없음·자간 안 붙음)를 넣음 (읽을 때 지움)
  let curKeepAll = false;
  // 세로쓰기 글상자 안: 세로로 세운 글자(한글·한자, 영문 세움이면 영문·빈칸도)는 화면 세로 폭이 1em — 가로로 잰 글자 폭·화소 보정 대신 1em 기준 (HOME36 축하 글상자: 빈칸이 1em 넘게 잡혀 한 단이 둘로)
  let curVert = null;
  const upright = ch => curVert && (curVert === 'upright' || !/[\x00-\u024f]/.test(ch));
  const WJ = '\u2060', PUNCT = /[^\p{L}\p{N}\s\u200b\u2060]/u, LATIN_WORD = /[A-Za-z0-9\u00c0-\u024f]/;
  const needWJ = (a, b) => !!a && !!b && !/\s/.test(a) && !/\s/.test(b) && ((curKeepAll && (PUNCT.test(a) || PUNCT.test(b))) || ((a === '-' || a === '?') && LATIN_WORD.test(b)));
  const noBreak = t => { const cs = Array.from(t); let out = ''; cs.forEach((ch, i) => { out += ch; if (needWJ(ch, cs[i + 1])) out += WJ; }); return out; };
  // 워드 호환 문서에서 문단 끝에 오면 여백에 걸치는 글자 (한글 시험으로 확인한 것만)
  const HANG_END = new Set([':', ']', '.', ',', ')', ';', '!', '?', '\u201d', '\u2019', '}', '>', '%', '\u00b7', '\u3002', '\u300d']);
  const charCache = new Map();
  // 한글이 쓰는 글자 폭 (em) — 굵게여도 보통 굵기 폭 (한글 시험: 한컴돋움·한컴바탕·함초롬·맑은 고딕·굴림·바탕·HY견고딕 10·13pt 굵게/보통 줄 글자 수 같음)
  //  화면의 굵은 글자 폭과의 차이는 advFix 가 자간으로 채움
  function charEm(ch, font, bold) {
    bold = false;
    const hs = hftSymEm(ch, font);
    if (hs) return hs;
    const key = ch + '|' + fontList(font) + (bold ? '|b' : '');
    if (charCache.has(key)) return charCache.get(key);
    let v = 0.3;
    try { const cx = document.createElement('canvas').getContext('2d'); cx.font = `${bold ? 'bold ' : ''}100px ${fontList(font)}, '${DEFAULT_FONT}'`; v = cx.measureText(ch).width / 100; } catch (e) {}
    charCache.set(key, v);
    return v;
  }
  // 글자를 그 크기로 그렸을 때 본래 폭(charEm)보다 넓거나 좁은 만큼 (em, 자간으로 더하면 본래 폭이 됨)
  //  작은 크기 비트맵이 든 글꼴(바탕·굴림·돋움·한컴바탕 11pt 등)은 브라우저가 폭을 화소로 반올림해 그림 — 한글은 본래 폭으로 줄을 나눔
  const advCache = new Map();
  function advFix(font, pt, bold, ch) {
    if (typeof document === 'undefined' || !document.body) return 0;
    const key = fontList(font) + '|' + pt + '|' + (bold ? 1 : 0) + '|' + ch;
    if (advCache.has(key)) return advCache.get(key);
    let v = 0;
    try {
      const s = document.createElement('span');
      s.style.cssText = `position:absolute;left:-9999px;top:0;white-space:pre;letter-spacing:0;word-spacing:0;font-family:${fontList(font)},'${DEFAULT_FONT}';font-size:${pt}pt;font-weight:${bold ? 'bold' : 'normal'}`;
      s.textContent = ch.repeat(20);
      document.body.append(s);
      const got = s.getBoundingClientRect().width / 20 / (pt * 96 / 72);
      s.remove();
      if (got > 0) v = Math.round((charEm(ch, font, bold) - got) * 100000) / 100000;
      if (Math.abs(v) < 0.00005) v = 0;
    } catch (e) { v = 0; }
    advCache.set(key, v);
    return v;
  }
  //  MS 워드 호환 문서는 줄 나눔에 글꼴 본래 빈칸 폭을 씀 ('a a a…' 문단: 워드 호환 61낱말 = 0.25em, 한글 문서 45낱말 = 0.5em — 한글 시험)
  //  공백 최소값 c%: 넘치는 낱말을 넣으려고 빈칸을 (100−c)% 까지 줄일 수 있음 → 빈칸을 미리 c% 줄여 둠 (한글 문서 빈칸 0.5em, 워드 호환은 글꼴 빈칸 기준)
  //  자간·장평도 빈칸 폭에 비례 (빈칸 = 기준 폭 × 장평 × (1 + 자간)) — run 에 준 자간(ls, em)은 빈칸에도 붙으므로 그만큼 뺌
  function spaceFix(r, fx, ls = 0) {
    const sp = upright(' ') ? 1 : spaceEm(latinFont(r) || r.font || DEFAULT_FONT, r.bold); // 영문 세움 세로쓰기는 빈칸도 세로 1em
    const rr = (r.ratio || 100) / 100;
    // 빈칸도 1800dpi 정수 폭 (4 HWPUNIT, .5 내림): 한글 문서는 글자 크기 절반 (탭 너비로 잰 한글 값: 9pt 448, 10pt 500, 11pt 548, 8.5pt 424 — PUBL156 '(단위:원)' 칸이 한 줄)
    //  자간도 그 단위로 반올림 (글자와 같은 규칙)
    const hu = (r.size || 10) * 100, qd = em => Math.ceil(em * hu / 4 - 0.5) * 4 / hu;
    const base = (fx && fx.fs) || wordMode ? sp : 0.5; // 글꼴에 어울리는 빈칸·워드 호환: 글꼴 빈칸
    //  장평은 크기 기준으로 맞춘 폭에 곱해 다시 맞춤 (한글 시험: 11pt 장평 98% 자간 −5% 빈칸 = 137단위 × 0.98 → 134, 자간 −7 → 127단위 = 508)
    const w = qd(qd(base) * rr), adv = w + Math.round(w * hu / 4 * (r.spacing || 0) / 100) * 4 / hu;
    return Math.round((adv * (1 - curCondense / 100) - sp - ls) * 100000) / 100000;
  }

  // 문단 머리(번호·글머리표) 글자: 정의에 글자 모양이 있으면 그 모양으로(없으면 문단 글자를 따름), 본문과의 간격은 정의 값
  //  (간격 단위 PERCENT = 글자 크기의 %, HWPUNIT = 1/7200 인치). 정의가 없으면 빈 문자열 (CSS 기본 간격)
  function headCss(def) {
    if (!def) return '';
    const r = def.style, css = [];
    if (r) {
      css.push(familyCss(r) || `font-family:'${DEFAULT_FONT}'`, `font-size:${r.size || 10}pt`, `font-weight:${r.bold ? 'bold' : 'normal'}`, `font-style:${r.italic ? 'italic' : 'normal'}`);
      if (r.color && r.color.toUpperCase() !== '#000000') css.push(`color:${r.color}`);
    }
    if (def.off !== undefined) css.push(`margin-right:${def.offType === 'HWPUNIT' ? (def.off / 7200 * 25.4).toFixed(2) + 'mm' : def.off / 100 + 'em'}`);
    return css.join(';');
  }

  // 셀 테두리: 한글 선 종류는 data-border 에 그대로 보관하고, 화면에는 비슷한 CSS 로 표시
  const LINE_CSS = { NONE: 'none', SOLID: 'solid', DASH: 'dashed', LONG_DASH: 'dashed', DASH_DOT: 'dashed', DASH_DOT_DOT: 'dashed', DOT: 'dotted', CIRCLE: 'dotted',
    DOUBLE_SLIM: 'double', SLIM_THICK: 'double', THICK_SLIM: 'double', SLIM_THICK_SLIM: 'double', WAVE: 'solid', DOUBLEWAVE: 'double', THICK_3D: 'ridge', THICK_3D_REVERS: 'groove', '3D': 'ridge', '3D_REVERS': 'groove' };
  const SIDES = [['l', 'Left'], ['r', 'Right'], ['t', 'Top'], ['b', 'Bottom']];
  const encodeBorders = b => SIDES.map(([k]) => { const s = b[k] || g.PureunHwpx.DEFAULT_SIDE; return `${s.type},${s.width},${s.color}`; }).join(';');
  function decodeBorders(str) {
    const parts = (str || '').split(';');
    if (parts.length !== 4) return null;
    const out = {};
    SIDES.forEach(([k], i) => { const [type, w, color] = parts[i].split(','); out[k] = { type, width: parseFloat(w) || 0.12, color: color || '#000000' }; });
    return out;
  }
  function borderCss(b) {
    return SIDES.map(([k, side]) => {
      const s = b[k] || g.PureunHwpx.DEFAULT_SIDE, css = LINE_CSS[s.type] || 'solid';
      if (css === 'none') return `border-${side.toLowerCase()}:none`;
      const w = css === 'double' ? Math.max(s.width, 0.8) : s.width;
      return `border-${side.toLowerCase()}:${w}mm ${css} ${s.color}`;
    }).join(';');
  }
  // 겹친 테두리에서 칸 하나가 차지하는 테두리 반쪽 (mm): 브라우저는 1 장치 픽셀보다 가는 선을 1 장치 픽셀로, 그보다 굵으면 내려서 그림
  function halfBorderMm(s) {
    s = s || g.PureunHwpx.DEFAULT_SIDE;
    const css = LINE_CSS[s.type] || 'solid';
    if (css === 'none') return 0;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const w = (css === 'double' ? Math.max(s.width, 0.8) : s.width) * 96 / 25.4 * dpr;
    return Math.max(1, Math.floor(w)) / dpr / 2 * 25.4 / 96;
  }
  // 한글 기본 셀 안 여백 (왼·오른쪽 510, 위·아래 141 HWPUNIT → mm)
  const DEFAULT_CELL_MARGIN = { l: 510 / (7200 / 25.4), r: 510 / (7200 / 25.4), t: 141 / (7200 / 25.4), b: 141 / (7200 / 25.4) };
  // 셀 안 여백 읽기·쓰기 (표/셀 속성 대화상자): 화면 안 여백은 테두리 반쪽만큼 줄여 두므로 그만큼 더하고 빼서 한글 값으로
  function cellMargin(td) {
    const b = td.dataset.border ? decodeBorders(td.dataset.border) : {}, c = getComputedStyle(td), mm = v => (parseFloat(v) || 0) * 25.4 / 96;
    const hb = td.dataset.hb ? td.dataset.hb.split(',').map(Number) : null, hi = { l: 0, r: 1, t: 2, b: 3 }; // 그릴 때 뺀 테두리 반쪽 (이웃의 굵은 테두리)
    const one = (side, k) => Math.round((mm(c['padding' + side]) + (/mm$/.test(td.style.paddingTop) ? (hb ? hb[hi[k]] : halfBorderMm(b[k])) : 0)) * 100) / 100;
    return { l: one('Left', 'l'), r: one('Right', 'r'), t: one('Top', 't'), b: one('Bottom', 'b') };
  }
  function setCellMargin(td, m) {
    const b = td.dataset.border ? decodeBorders(td.dataset.border) : {};
    const hb = td.dataset.hb ? td.dataset.hb.split(',').map(Number) : null, hi = { l: 0, r: 1, t: 2, b: 3 };
    const pad = (v, k) => Math.max(0, Math.round((v - (hb ? hb[hi[k]] : halfBorderMm(b[k]))) * 1000) / 1000);
    td.style.padding = m ? `${pad(m.t, 't')}mm ${pad(m.r, 'r')}mm ${pad(m.b, 'b')}mm ${pad(m.l, 'l')}mm` : '';
    delete td.dataset.cm; // 사용자가 바꾼 값 (원래 HWPUNIT 값은 더 쓰지 않음)
    delete td.dataset.dm; // 기본 여백 표시도 없앰 (이제 칸 여백이 있음)
  }
  // 셀 요소에 테두리 적용 (편집 기능에서 사용)
  function setCellBorders(td, b) {
    for (const [, side] of SIDES) td.style['border' + side] = '';
    if (!b) { delete td.dataset.border; return; }
    td.dataset.border = encodeBorders(b);
    td.style.cssText += ';' + borderCss(b);
  }

  function bytesToDataUrl(mime, data) {
    let s = '';
    for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
    return `data:${mime};base64,${btoa(s)}`;
  }
  function dataUrlToBytes(url) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(url || '');
    if (!m) return null;
    const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { mime: m[1] || 'image/png', data: out };
  }

  // ---------- 모델 → HTML ----------

  // 한글 옛 기호 영역(U+A000~A48C): 문서에는 원래 코드를 그대로 두고, 화면에는 한컴 글꼴의 기호(U+F0000~)로 보여 줌
  const hcharHtml = s => s.replace(/[ꀀ-ꒌ]/g, ch => {
    const c = ch.charCodeAt(0);
    return `<span class="hchar" contenteditable="false" data-c="${c.toString(16)}">${String.fromCodePoint(0xf0000 + c - 0xa000)}</span>`;
  });
  const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ---------- 그리기 개체: 화면에는 번호(data-sid)만 두고 개체 자료는 따로 보관 (바꿀 때는 새 번호로 → 되돌리기 안전) ----------
  const shapeStore = new Map(), svgCache = new Map(), imgUrls = new WeakMap();
  let sidSeq = 0;
  const putShape = node => { const sid = 's' + (++sidSeq); shapeStore.set(sid, node); return sid; };
  const shapeOf = sid => shapeStore.get(sid);
  const imgUrl0 = img => {
    if (!img || !img.data) return null;
    let u = imgUrls.get(img);
    if (!u) { u = typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(new Blob([img.data], { type: img.mime || 'image/png' })) : bytesToDataUrl(img.mime, img.data); imgUrls.set(img, u); }
    return u;
  };
  // 화면 표시용 그림 주소 (WMF 는 SVG 로 바꿔 보여 줌, 자료는 원본 그대로)
  const imgUrl = img => (g.PureunWmf ? g.PureunWmf.displayUrl(img) : imgUrl0(img));
  // 브라우저가 못 그리는 형식의 글자처럼 취급 그림: 원본 자료를 따로 보관하고 화면에는 바꾼 그림을
  const imgStore = new Map();
  let imgSeq = 0;
  const nativeImg = m => ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml'].includes(m || 'image/png');
  // 그라데이션 등 SVG 안 id 는 문서 전체에서 겹치면 다른 개체의 것을 쓰게 되므로 그릴 때마다 새 번호대
  let svgSeq = 0;
  function shapeSvg(sid) {
    if (!svgCache.has(sid)) {
      const n = shapeOf(sid), S = g.PureunShape;
      svgCache.set(sid, n && S ? S.toSvg(n, { imgUrl, blocksHtml: blocksToHtml, uidBase: ++svgSeq * 10000 }).svg : '');
    }
    return svgCache.get(sid);
  }
  // 글자처럼 취급(treatAsChar)은 글줄 안에, 그 밖은 쪽 배치 때 제자리에 그림 (자리 차지는 그만큼 빈 자리를 둠)
  function shapeHtml(node) {
    const S = g.PureunShape, sid = putShape(node);
    const pos = S.posOf(node), sz = S.sizeOf(node), mm = v => r1(v / S.HU_PER_MM);
    if (pos.inline) return `<span class="gso inl" contenteditable="false" data-sid="${sid}" style="margin:${mm(pos.margin.t)}mm ${mm(pos.margin.r)}mm ${mm(pos.margin.b)}mm ${mm(pos.margin.l)}mm">${shapeSvg(sid)}</span>`;
    const off = v => (v > 0x7fffffff ? v - 0x100000000 : v);
    if (pos.vertRelTo === 'PARA' && (pos.wrap === 'TOP_AND_BOTTOM' || pos.wrap === 'SQUARE')) {
      const hh = mm(Math.max(0, off(pos.vertOffset)) + sz.h + pos.margin.t + pos.margin.b);
      if (pos.wrap === 'SQUARE') {
        const right = pos.horzAlign === 'RIGHT', vo = Math.max(0, off(pos.vertOffset));
        // 개체가 문단 아래쪽에 놓이면(세로 위치 > 0) 그 위의 줄은 개체를 비켜 가지 않음 → 비켜 갈 자리는 개체 높이 띠만 (HOME25: 개체 위 한 줄이 한글처럼 한 줄)
        const shape = vo > 0 ? `;shape-outside:inset(${mm(vo)}mm 0 0 0)` : '';
        const fw = mm(Math.max(0, off(pos.horzOffset)) + sz.w + pos.margin.l + pos.margin.r);
        // data-fw·fh·fv(mm): 차지 영역 (한 문단에 여럿이면 편집기가 합쳐 계단 모양 하나로 — squareFloats)
        return `<span class="gso flt" contenteditable="false" data-sid="${sid}" data-fw="${fw}" data-fh="${hh}" data-fv="${mm(vo)}"${right ? ' data-fr=""' : ''} style="float:${right ? 'right' : 'left'};width:${fw}mm;height:${hh}mm${shape}"></span>`;
      }
      return `<span class="gso blk" contenteditable="false" data-sid="${sid}" data-h="${hh}" style="height:${hh}mm"></span>`;
    }
    return `<span class="gso" contenteditable="false" data-sid="${sid}"></span>`;
  }

  // 글자 겹침: 글자들을 한자리에 겹쳐 보임 (펼침은 나란히). 자료는 data-cmp 에 보관
  function composeHtml(r) {
    const c = r.compose, chars = Array.from(c.text || '');
    const size = r.style && r.style.size ? `font-size:${r.style.size}pt;` : '';
    const font = r.style && r.style.font && r.style.font !== DEFAULT_FONT ? `font-family:${fontList(r.style.font)},'${DEFAULT_FONT}';` : '';
    const inner = c.composeType === 'OVERLAP'
      ? chars.map((ch, i) => `<i class="${i ? 'over' : ''}">${hcharHtml(escHtml(ch))}</i>`).join('')
      : chars.map(ch => `<i>${hcharHtml(escHtml(ch))}</i>`).join('');
    return `<span class="cmp${c.composeType === 'OVERLAP' ? ' ovl' : ''}" contenteditable="false" data-cmp="${escAttr(JSON.stringify(c))}" style="${size}${font}">${inner}</span>`;
  }

  // 자동 번호(쪽 번호 넣기): 화면 번호는 쪽 배치 때 채움
  function autoNumHtml(r) {
    const css = [];
    if (r.style && (r.style.size || 10) !== baseSize) css.push(`font-size:${r.style.size || 10}pt`);
    if (r.style && r.style.font && r.style.font !== DEFAULT_FONT) css.push(`font-family:${fontList(r.style.font)},'${DEFAULT_FONT}'`);
    if (r.style && r.style.color && r.style.color.toUpperCase() !== '#000000') css.push(`color:${r.style.color}`);
    if (r.style && r.style.bold) css.push('font-weight:bold');
    return `<span class="autonum" contenteditable="false" data-an="${escAttr(JSON.stringify(r.autoNum))}"${css.length ? ` style="${css.join(';')}"` : ''}>1</span>`;
  }

  // 지금 그리는 문단의 기준 글자 크기 (이 크기와 다른 글자만 크기를 적음)
  let baseSize = 10;

  // 개체 조각(그림·도형·각주·필드 표시)의 글자 모양은 data-cs 에 그대로 보관 (둘레 글자에서 다시 읽으면 원래 모양과 달라짐)
  const csAttr = st => (st ? ` data-cs="${escAttr(JSON.stringify(st))}"` : '');
  function runHtml(r) {
    if (r.shape) return shapeHtml(r.shape).replace(/^<(\w+)/, `<$1${csAttr(r.style)}`);
    // 구역 중간의 머리말·꼬리말 컨트롤: 보이지 않는 표시 (편집기가 그 쪽부터 바꿔 그림)
    if (r.hf) return `<span class="hctl" contenteditable="false"${csAttr(r.style)} data-hf="${escAttr(JSON.stringify(r.hf))}"></span>`;
    if (r.autoNum) return autoNumHtml(r).replace(/^<span/, `<span${csAttr(r.style)}`);
    if (r.compose) return composeHtml(r).replace(/^<span/, `<span${csAttr(r.style)}`);
    if (r.table) return blockHtml(r.table).replace(/<table/, `<table${csAttr(r.style)}`);
    if (r.image) {
      if (!r.image.src && !nativeImg(r.image.mime)) {
        const id = 'i' + (++imgSeq);
        imgStore.set(id, r.image);
        return `<img src="${imgUrl(r.image) || ''}" data-img="${id}"${csAttr(r.style)} style="width:${r.image.w}mm;height:${r.image.h}mm" alt="">`;
      }
      const src = r.image.src || bytesToDataUrl(r.image.mime, r.image.data);
      return `<img src="${src}"${csAttr(r.style)} style="width:${r.image.w}mm;height:${r.image.h}mm" alt="">`;
    }
    // 각주·미주: 본문에는 번호만, 내용은 data-note 에 HTML 로 보관 (번호는 쪽 배치 때 매김)
    if (r.note) return `<sup class="note" contenteditable="false" data-kind="${r.note.kind}"${csAttr(r.note.style)} data-note="${escAttr(blocksToHtml(r.note.blocks))}">※</sup>`;
    if (r.link) return `<a href="${escAttr(r.link)}">${runHtml(Object.assign({}, r, { link: null }))}</a>`;
    // 내용 없는 필드(책갈피 등): 보이지 않는 표시
    if (r.field) return `<span class="hfd-e" contenteditable="false" data-fd="${escAttr(JSON.stringify(r.field))}"${csAttr(r.style)}></span>`;
    const css = [], deco = [];
    const fam = familyCss(r);
    if (fam) css.push(fam);
    if ((r.size || 10) !== baseSize) css.push(`font-size:${r.size || 10}pt`);
    if (r.bold) css.push('font-weight:bold');
    if (r.italic) css.push('font-style:italic');
    // 글자 효과(fx): 밑줄 위치·모양·색, 취소선 모양·색, 외곽선, 그림자, 양각·음각, 강조점
    const fx = r.fx ? g.PureunHwpx.parseFx(r.fx) : {};
    const u = fx.u && fx.u.split('/'), s = fx.s && fx.s.split('/');
    if (r.underline) deco.push(u && u[0] === 'TOP' ? 'overline' : 'underline');
    if (r.strike) deco.push('line-through');
    if (deco.length) {
      const look = (r.underline && u) || (r.strike && s && [null].concat(s)) || null; // [위치, 모양, 색]
      css.push(`text-decoration:${deco.join(' ')}${look ? ' ' + decoStyle(look[1]) + ' ' + look[2] : ''}`);
    }
    if (r.color && r.color.toUpperCase() !== '#000000') css.push(`color:${r.color}`);
    if (r.shade) css.push(`background-color:${r.shade}`);
    if (fx.o) css.push(`-webkit-text-stroke:max(0.5px,0.035em) ${r.color || '#000000'};-webkit-text-fill-color:#fff;paint-order:stroke fill`);
    const shadows = [];
    if (fx.sh) {
      const [type, col, x, y] = fx.sh.split('/');
      const steps = type === 'CONTINUOUS' ? 4 : 1;
      for (let k = steps; k >= 1; k--) shadows.push(`${(+x * k) / steps / 100}em ${(+y * k) / steps / 100}em 0 ${col}`);
    }
    if (fx.em) shadows.push('-0.04em -0.04em 0 #fff', '0.04em 0.04em 0 #808080');
    if (fx.en) shadows.push('0.04em 0.04em 0 #fff', '-0.04em -0.04em 0 #808080');
    if (shadows.length) css.push(`text-shadow:${shadows.join(',')}`);
    if (fx.sym && EMPHASIS[fx.sym]) css.push(`text-emphasis:${EMPHASIS[fx.sym]};text-emphasis-position:${fx.sym === 'DOT_BELOW' ? 'under' : 'over'} right`);
    // 장평(글자 폭 비율)은 브라우저가 표현하지 못해 자간을 그만큼 좁혀 줄바꿈 위치를 비슷하게 맞춤
    // 자간·장평은 한글에서 글자마다 그 글자 폭에 비례 (한글 시험: 함초롬바탕 'iiii' 자간 50% 한 줄 17낱말, 빈칸의 자간은 빈칸 폭 0.5em 의 %)
    //  → run 에는 한글 글자 폭 기준 자간을 주고, 영문 낱말은 그 글자들 평균 폭 기준 자간의 보기용 span(data-ls0)으로, 빈칸은 word-spacing 으로 맞춤
    //  원래 자간 값은 data-sp 에 (화면 자간 data-spl 과 같으면 읽을 때 그대로 씀)
    const ratioEm = ratioAdj(r.ratio), rr = (r.ratio || 100) / 100, sp1 = 1 + (r.spacing || 0) / 100;
    const scaled = !!(r.spacing || ratioEm);
    const latF = latinFont(r) || r.font || DEFAULT_FONT, cjkF = r.font || DEFAULT_FONT, size = r.size || 10;
    // 영문 글자는 글자 모양의 영문 글꼴로: 한글 글자도 든 글꼴이라 글꼴 목록 앞에 둘 수 없으면 영문 낱말 조각 span 에 따로 줌 (PUBL195 한글 HyhwpEQ · 영문 바탕)
    const lf = r.langs && g.PureunHwpx.parseLangs(r.langs).f;
    const segF = lf && lf[0] === cjkF && lf[1] && lf[1] !== cjkF ? lf[1] : latF, segFam = segF !== latF ? `font-family:${fontList(segF)},'${DEFAULT_FONT}';` : '';
    // 한글은 글자 폭을 1800dpi 정수(4 HWPUNIT)로 반올림해 줄을 나눔(.5 는 내림 — 한글 시험: 한컴바탕 '.' 292·':' 332·'1' 584, 함초롬바탕 '가' 968, 9pt 빈칸 448)
    //  + 바탕·굴림·돋움처럼 작은 크기 비트맵이 든 글꼴은 브라우저가 글자 폭을 화소 단위로 반올림해 그림(바탕 11pt 가 = 1.023em)
    //  → 글자마다 '한글이 쓰는 폭 − 화면 폭' 을 자간으로 줌 (장평·자간 포함)
    const sizeHu = size * 100, qd = em => Math.ceil(em * sizeHu / 4 - 0.5) * 4 / sizeHu;
    //  자간은 장평 뒤 글자 폭(1800dpi 단위)의 % 를 반올림 (한글 시험: 한컴바탕 장평 80% 자간 +20% 는 한 줄 44자, 장평 120% 자간 −10% 는 39자,
    //  13pt 자간 +3·+7·−1·−3·−7% 와 14pt 장평 95% 자간 −5%(PUBL135 제목) 의 한 줄 문턱이 모두 반올림 값)
    //  장평은 크기 기준으로 맞춘 폭에 곱해 다시 맞춤 (빈칸과 같은 규칙 — 11pt 장평 98% '가' 275단위 → 269)
    const lsFor = (ch, font, sp = sp1) => { const em = charEm(ch, font, r.bold), w = qd(qd(em) * rr); return w + Math.round(w * sizeHu / 4 * (sp - 1)) * 4 / sizeHu - (upright(ch) ? 1 : em - advFix(font, size, r.bold, ch)); };
    const fixC = /[^\x00-ɏ\s]/.test(r.text) ? lsFor('가', cjkF) : 0;
    let ls = 0;
    if (scaled || Math.abs(fixC) > 0.00005) {
      ls = Math.round(lsFor('가', cjkF) * 100000) / 100000;
      if (ls) css.push(`letter-spacing:${ls}em`);
    }
    // 한글은 줄 끝 글자 뒤에는 자간을 두지 않음 (늘린·줄인 자간 모두, 문단 끝·줄 끝 모두 — 한글 시험: 한컴바탕 자간 +20% 35자, −10% 40자 문턱)
    //  → 이 run 의 자간 몫(em)을 data-lse 에 두어 편집기가 문단 오른쪽 끝을 그만큼 넓히거나 좁힘 (lineEndSpacing)
    const LAT = /[\x21-\x7e¡-ɏ]/;
    const lseOf = (ch, font) => lsFor(ch, font) - lsFor(ch, font, 1);
    const latCs = Array.from(r.text).filter(ch => LAT.test(ch));
    const lse = !r.spacing ? 0 : Math.round((/[^\x00-ɏ\s]/.test(r.text) ? lseOf('가', cjkF) : latCs.length ? latCs.reduce((a, ch) => a + lseOf(ch, segF), 0) / latCs.length : 0) * 100000) / 100000;
    const ws = /[  ]/.test(r.text) ? spaceFix(r, fx, ls) + (upright(' ') ? 0 : advFix(latF, size, r.bold, " ")) : 0;
    if (Math.abs(ws) > 0.00005 || (curCondense && ws)) css.push(`word-spacing:${ws}em`);
    else if (curCondense && /[  ]/.test(r.text)) css.push('word-spacing:0'); // 문단의 공백 최소값 word-spacing 을 물려받지 않게
    // 탭은 span.htab 으로 감싸 편집기가 한글 규칙(본문 왼쪽 끝 기준 탭 위치)대로 너비를 정함
    //  한글의 고정폭 빈칸(U+2007)은 줄을 나눌 수 있는 자리 — 유니코드로는 붙임 빈칸이라 뒤에 폭 없는 빈칸(읽을 때 지움)을 둠 (PUBL225 '자원 활동')
    //  고정폭 빈칸(U+2007)은 한글에서 글자 크기의 1/4 (장평·자간 적용 — 한글 시험: 10pt 248·13pt 325, 장평 95% 자간 −7% 10pt 220) → 보기용 span 의 자간으로 그 폭에 맞춤 ((DB)sample01 칸 글이 두 줄 되던 것)
    const fwsLs = !/\u2007/.test(r.text) ? 0 : (() => { const em = charEm('\u2007', latF), w = qd(qd(0.25) * rr); return Math.round((w + Math.round(w * sizeHu / 4 * (sp1 - 1)) * 4 / sizeHu - em + advFix(latF, size, r.bold, '\u2007')) * 100000) / 100000; })();
    const conv = x => hcharHtml(escHtml(x)).replace(/\n/g, '<br>').replace(/\t/g, '<span class="htab">\t</span>').replace(/ /g, `<span data-ls0="" style="letter-spacing:${fwsLs}em"> </span>​`);
    // 워드 호환 문서: 문단 끝의 닫는 문장 부호는 오른쪽 여백에 걸침 — 그 글자의 폭(과 자간)을 빼 줄 폭에 들지 않게 (한글 시험: : ] . , ) ; ! ? ” ’ } > % · 。 」 는 걸침, " - / 글자는 안 걸침)
    const hang = wordMode && r === lastTextRun && HANG_END.has(Array.from(r.text).pop());
    // 따로 그릴 마지막 글자: 걸친 글자, 또는 자간 있는 문단 마지막 run 의 마지막 글자(뒤 빈칸 빼고)
    const cs = Array.from(r.text);
    let k = -1;
    if (hang) k = cs.length - 1;
    else if (r.spacing && r === lastTextRun) { k = cs.length - 1; while (k >= 0 && /[\s\u00a0\ufeff]/.test(cs[k])) k--; }
    const lastCh = k >= 0 ? cs[k] : null;
    const fontOf = ch => (LAT.test(ch) ? segF : cjkF);
    //  걸친 글자는 그린 폭만큼 빼서 폭 0 (화소 반올림 보정 포함)
    //  문단 마지막 글자는 자간 없이 + 이 run 의 자간 몫(lse): 편집기가 문단 오른쪽 끝을 lse 만큼 옮기므로 마지막 줄은 한글처럼 마지막 글자 자간 없이 셈 (PUBL171 '좌 :' 칸)
    const endLs = !lastCh ? 0 : hang ? -(charEm(lastCh, fontOf(lastCh), r.bold) - advFix(fontOf(lastCh), size, r.bold, lastCh)) : lsFor(lastCh, fontOf(lastCh), 1) + lse;
    // 영문 낱말 조각: 그 글자들의 (한글 폭(장평·자간 포함) − 화면 폭) 평균
    //  한글 사이 기호·문장부호(※ 「 ○ 등)는 그 글자의 (한글 폭 − 화면 폭)으로 따로 자간 — run 자간은 '가' 기준이라 폭이 다른 기호는 틀림 (HFT 글꼴 기호 폭 등)
    const SYM = /[^\s\u200b\u2060\u2007\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f\u4e00-\u9fff\uf900-\ufaff]/;
    const symSeg = x => { let out = '', buf = ''; for (const ch of x) { if (SYM.test(ch)) { const l = Math.round(lsFor(ch, cjkF) * 100000) / 100000; if (Math.abs(l - ls) >= 0.00005) { out += conv(buf) + `<span data-ls0="" style="letter-spacing:${l}em">${conv(ch)}</span>`; buf = ''; continue; } } buf += ch; } return out + conv(buf); };
    const body = x => x.split(/([\x21-\x7e\u00a1-\u024f]+)/).map((seg, i) => {
      if (!seg) return '';
      if (i % 2 === 0) return symSeg(seg);
      const cs2 = Array.from(seg), l2 = Math.round(cs2.reduce((a, ch) => a + lsFor(ch, segF), 0) / cs2.length * 100000) / 100000;
      return !segFam && Math.abs(l2 - ls) < 0.00005 ? conv(seg) : `<span data-ls0="" style="${segFam}letter-spacing:${l2}em">${conv(seg)}</span>`;
    }).join('');
    let t = lastCh ? body(noBreak(cs.slice(0, k).join('')) + (needWJ(cs[k - 1], lastCh) ? WJ : '')) + `<span data-ls0="" style="${LAT.test(lastCh) ? segFam : ''}letter-spacing:${Math.round(endLs * 100000) / 100000}em">${conv(lastCh)}</span>` + body(cs.slice(k + 1).join('')) : body(noBreak(r.text));
    if (r.sup) t = `<sup>${t}</sup>`; else if (r.sub) t = `<sub>${t}</sub>`;
    // 장평은 화면에 그대로 표현하기 어려워 값만 보존(data-ratio)해서 저장할 때 되살림. 언어별 글꼴·값은 data-lang 에
    const ratio = (r.ratio && r.ratio !== 100 ? ` data-ratio="${r.ratio}"` : '') + (r.langs ? ` data-lang="${escAttr(r.langs)}"` : '') + (r.fx ? ` data-fx="${escAttr(r.fx)}"` : '')
      + (scaled || ls ? ` data-sp="${r.spacing || 0}" data-spl="${ls}em"` : "") + (lse ? ` data-lse="${lse}"` : '');
    return css.length || ratio ? `<span${ratio}${css.length ? ` style="${css.join(';')}"` : ''}>${t}</span>` : t;
  }

  // 한글 선 모양 → CSS 글자 장식 모양 (가장 가까운 것)
  const decoStyle = shape => (/DOUBLE|SLIM_THICK|THICK_SLIM/.test(shape) && !/WAVE/.test(shape) ? 'double' : /WAVE/.test(shape) ? 'wavy' : /^(DOT|CIRCLE)$/.test(shape) ? 'dotted' : /DASH/.test(shape) ? 'dashed' : 'solid');
  const EMPHASIS = { DOT_ABOVE: 'filled dot', RING_ABOVE: 'open circle', DOT_BELOW: 'filled dot', SIDE: 'filled sesame' };

  // 같은 누름틀에 속한 글자들은 자동 채우기 칸(span.fld) 하나로 묶음 — data-ch 에 누름틀 정보를 보관해 저장 때 되살림
  function runsHtml(runs) {
    let out = '';
    for (let i = 0; i < runs.length;) {
      const r = runs[i];
      // 그 밖의 필드(날짜·사용자 정보 등)에 든 글자: span.hfd 로 묶고 data-fd 에 필드 요소를 보관
      if (r.fd && !r.ch) {
        let j = i, html = '';
        while (j < runs.length && runs[j].fd && runs[j].fd.id === r.fd.id && !runs[j].ch) html += runHtml(runs[j++]);
        out += `<span class="hfd" data-fd="${escAttr(JSON.stringify(r.fd))}">${html}</span>`;
        i = j;
        continue;
      }
      if (!r.ch) { out += runHtml(r); i++; continue; }
      let j = i, html = '';
      while (j < runs.length && runs[j].ch && runs[j].ch.id === r.ch.id) html += runHtml(runs[j++]);
      const empty = runs.slice(i, j).every(x => x.placeholder);
      out += `<span class="fld${empty ? '' : ' filled'}" data-field="${escAttr(r.ch.name)}" data-ch="${escAttr(JSON.stringify(r.ch))}">${html}</span>`;
      i = j;
    }
    return out;
  }

  // MS 워드 호환 문서인지 (줄 높이 계산이 다름). 문서를 열 때·고를 때 setCompat 으로 정함
  let wordMode = false;
  const setCompat = c => { wordMode = !!(c && c.target === 'MS_WORD'); setLatinQuotes(wordMode && !!(c.flags || []).includes('treatQuotationAsLatin')); };
  // 글꼴 고유 줄 높이 배율 (글자 크기 대비): 한글 워드 호환 문서에서 잰 값, 그 밖은 브라우저의 기본 줄 높이
  const FONT_FACTOR = { Arial: 1.150, 'Times New Roman': 1.152, Verdana: 1.216, '한컴바탕': 1.301, 'Haansoft Batang': 1.301 };
  const factorCache = new Map();
  function fontFactor(font) {
    if (FONT_FACTOR[font]) return FONT_FACTOR[font];
    const fk = fontList(font);
    if (factorCache.has(fk)) return factorCache.get(fk);
    let v = 1.15;
    try {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;visibility:hidden;font-family:${fontList(font)};font-size:100px;line-height:normal;white-space:nowrap`;
      d.textContent = 'Hg';
      document.body.append(d); v = d.offsetHeight / 100 || v; d.remove();
    } catch (e) {}
    factorCache.set(fk, v);
    return v;
  }
  // 글꼴의 기준선 아래 길이 배율: 한글 워드 호환 문서에서 잰 값, 그 밖은 브라우저 글꼴 정보
  const DESC_FACTOR = { Arial: 0.212, 'Times New Roman': 0.217, Verdana: 0.210, '한컴바탕': 0.292, 'Haansoft Batang': 0.292 };
  function descFactor(font) {
    if (DESC_FACTOR[font] !== undefined) return DESC_FACTOR[font];
    try { const c = document.createElement('canvas').getContext('2d'); c.font = `100px ${fontList(font)}`; return c.measureText('Hg').fontBoundingBoxDescent / 100 || 0.2; } catch (e) { return 0.2; }
  }
  function runDesc(r) {
    const size = r.size || 10, font = r.font || DEFAULT_FONT, t = r.text || '';
    const f = r.langs && g.PureunHwpx.parseLangs(r.langs).f;
    const latin = f && f[0] === font ? f[1] : font;
    return size * (LATIN_CH.test(t) && !NON_LATIN_CH.test(t) ? descFactor(latin) : Math.max(descFactor(latin), descFactor(font)));
  }
  // 한글의 '영문' 언어 글자: 기본 라틴 + 라틴-1 보충 + 라틴 확장 (« » é 등도 영문 글꼴 — Sample Rejection Letter 글상자 '«_City»' 줄 높이로 확인)
  //  워드 호환 설정 '따옴표를 영문으로'(treatQuotationAsLatin)이면 ‘ ’ “ ” 등도 영문 (Employee Accident Report: 'Employee’s Signature' 칸 줄 = 1518)
  let LATIN_CH = /[\x21-\x7e¡-ɏ]/, NON_LATIN_CH = /[^\x00-ɏ]/;
  function setLatinQuotes(on) {
    LATIN_CH = on ? /[\x21-\x7e¡-ɏ‘-‟]/ : /[\x21-\x7e¡-ɏ]/;
    NON_LATIN_CH = on ? /[^\x00-ɏ‘-‟]/ : /[^\x00-ɏ]/;
  }
  // 글자 조각의 높이(pt): 영문 글자는 영문 글꼴, 한글 글자는 한글 글꼴의 배율
  function runHeight(r) {
    const size = r.size || 10, font = r.font || DEFAULT_FONT, t = r.text || '';
    const f = r.langs && g.PureunHwpx.parseLangs(r.langs).f;
    const latin = f && f[0] === font ? f[1] : font;
    const hs = [];
    if (!t || LATIN_CH.test(t)) hs.push(fontFactor(latin));
    if (NON_LATIN_CH.test(t)) hs.push(fontFactor(font));
    return size * Math.max(...hs, 1);
  }

  // 한글의 '내어쓰기'는 첫 줄이 왼쪽 여백에 있고 둘째 줄부터 들어감 → CSS 는 margin 을 더 주고 text-indent 를 음수로
  // 줄 간격 종류: 고정 값 / 최소 / 여백만 은 pt 로 (정확한 값은 data-lt·data-lv 에 보관)
  function lineCss(b) {
    // 한글에서 잰 규칙: 최소 = max(값, 글자 크기), 여백만 = 글자 크기 + 값 (글자 크기는 문단에서 가장 큰 글자)
    // 문단 끝 글자 모양(endMark)의 크기도 줄 높이에 들어감 (한글 시험 문서로 확인)
    const sizes = (b.runs || []).filter(r => r.text).map(r => r.size || 10).concat(b.endMark ? [b.endMark.size || 10] : []);
    const maxSize = sizes.length ? Math.max(...sizes) : (b.mark && b.mark.size) || 10;
    if (wordMode) {
      // MS 워드 호환 문서: 글자 높이 = 크기 × 글꼴 고유 줄 높이 배율 (문단에서 가장 큰 것). 비율 줄 간격도 그 높이에 곱함 (한글로 확인)
      // 문단 끝 글자 모양이 글자보다 높으면: 그 높이 + 글자의 기준선 아래 길이 (16가지 글꼴 조합으로 확인)
      const texts = (b.runs || []).filter(r => r.text);
      let hMax = runHeight(b.mark || {});
      if (texts.length) {
        const top = texts.reduce((a, r) => (runHeight(r) > runHeight(a) ? r : a));
        hMax = runHeight(top);
        if (b.endMark && runHeight(b.endMark) > hMax) hMax = runHeight(b.endMark) + runDesc(top);
      }
      const v = b.lineType === 'FIXED' ? b.lineValue : b.lineType === 'AT_LEAST' ? Math.max(b.lineValue, hMax) : b.lineType === 'BETWEEN_LINES' ? hMax + b.lineValue : hMax * (b.lineSpacing || 160) / 100;
      return `line-height:${Math.round(v * 100) / 100}pt`;
    }
    if (b.lineType === 'FIXED') return `line-height:${b.lineValue}pt`;
    if (b.lineType === 'AT_LEAST') return `line-height:${Math.max(b.lineValue, maxSize)}pt`;
    if (b.lineType === 'BETWEEN_LINES') return `line-height:${maxSize + b.lineValue}pt`;
    return b.lineSpacing && b.lineSpacing !== 160 ? `line-height:${b.lineSpacing / 100}` : '';
  }
  // 문단 모양의 나머지 항목(pp) 중 화면에 보이는 것: 줄 나눔 기준 · 공백 최소값
  function ppCss(pp) {
    if (!pp) return '';
    const x = g.PureunHwpx.parsePP(pp), css = [];
    // 줄 나눔 기준 (한글 시험으로 확인): 한글 단위 KEEP_WORD = 글자(아무 글자 사이), BREAK_WORD = 어절 / 영어 단위 KEEP_WORD = 단어, BREAK_WORD = 글자
    //  편집 화면 기본(word-break:normal)은 한글 글자·영어 단어 → 한글 어절이면 keep-all, 영어 글자면 break-all
    if (x.breakNonLatinWord === 'BREAK_WORD') css.push('word-break:keep-all');
    else if (x.breakLatinWord === 'BREAK_WORD') css.push('word-break:break-all');
    // 공백 최소값(%): 줄에 더 넣으려고 빈칸을 그만큼 줄일 수 있음 → 빈칸(약 0.3em)을 미리 줄여 둠. 양쪽 정렬이면 남는 폭은 다시 벌어짐
    if (x.condense) css.push(`word-spacing:${-Math.round(x.condense * 3) / 1000}em`);
    return css.join(';');
  }
  function paraCss(b) {
    const css = [];
    const pc = ppCss(b.pp);
    if (pc) css.push(pc);
    if (b.align === 'distribute') css.push('text-align:justify;text-align-last:justify');
    else if (b.align && b.align !== 'justify') css.push(`text-align:${b.align}`);
    const lc = lineCss(b);
    if (lc) css.push(lc);
    const indent = b.indent || 0, left = b.left || 0;
    if (indent) css.push(`text-indent:${indent}pt`);
    const ml = indent < 0 ? left - indent : left;
    if (ml) css.push(`margin-left:${Math.round(ml * 100) / 100}pt`);
    if (b.right) css.push(`margin-right:${b.right}pt`);
    if (b.before) css.push(`margin-top:${b.before}pt`);
    if (b.after) css.push(`margin-bottom:${b.after}pt`);
    return css.join(';');
  }

  function blockHtml(b) {
    const pb = b.pageBreak ? ' data-pb="1"' : '';
    if (b.type === 'table') {
      // 칸 너비·표 너비는 % 소수 넷째 자리까지 (0.1% 로 반올림하면 좁은 칸에서 0.5px 남짓 모자라 한글보다 일찍 줄이 바뀜)
      //  원래 비율은 data-w 에 그대로 두어, 칸 너비를 바꾸지 않았으면 저장할 때 원래 HWPUNIT 너비가 그대로 나오게 함
      const cols = b.colWidths.map(w => `<col data-w="${w}" style="width:${(w * 100).toFixed(4)}%">`).join('');
      // 겹친 테두리: 이웃 칸과 맞닿은 변은 두 테두리 중 굵은 쪽이 쓰이고 그 반쪽이 칸 안에 듦 → 안 여백에서 뺄 반쪽도 굵은 쪽
      //  (PUBL138 '  원    ' 칸: 오른쪽 이웃의 0.4mm 테두리로 글 폭이 한글보다 36 HWPUNIT 좁아 끝 빈칸이 다음 줄로) — 뺀 값은 data-hb(왼·오·위·아래 mm)
      const pos = new Map(), grid = [];
      b.rows.forEach((row, ri) => {
        let ci = 0;
        for (const c of row) {
          while (grid[ri] && grid[ri][ci]) ci++;
          pos.set(c, [ri, ci]);
          for (let a = 0; a < (c.rowSpan || 1); a++) for (let d = 0; d < (c.colSpan || 1); d++) (grid[ri + a] = grid[ri + a] || [])[ci + d] = c;
          ci += c.colSpan || 1;
        }
      });
      const OPP = { l: 'r', r: 'l', t: 'b', b: 't' };
      const sideHalf = (c, k) => {
        let h = halfBorderMm((c.borders || {})[k]);
        const p = pos.get(c);
        if (!p) return h;
        const [r0, c0] = p, rs = c.rowSpan || 1, cs = c.colSpan || 1, nb = new Set();
        if (k === 'l' || k === 'r') for (let r = r0; r < r0 + rs; r++) nb.add(grid[r] && grid[r][k === 'l' ? c0 - 1 : c0 + cs]);
        else for (let x = c0; x < c0 + cs; x++) nb.add(grid[k === 't' ? r0 - 1 : r0 + rs] && grid[k === 't' ? r0 - 1 : r0 + rs][x]);
        for (const n of nb) if (n && n !== c) h = Math.max(h, halfBorderMm((n.borders || {})[OPP[k]]));
        return h;
      };
      const rows = b.rows.map(row => '<tr>' + row.map(c => {
        const css = [];
        // 칸 높이: 원래 HWPUNIT 값이 있으면 그 정밀도로 (0.1mm 로 줄이면 Business12 칸이 한글보다 0.04mm 높음)
        if (c.height) css.push(`height:${c.hh && Math.abs(c.hh / (7200 / 25.4) - c.height) < 0.051 ? Math.round(c.hh / (7200 / 25.4) * 1000) / 1000 : c.height}mm`);
        // 한글의 셀 테두리는 칸 안쪽 자리를 차지하지 않음 → 브라우저(겹친 테두리)가 칸 안에 넣는 테두리 반쪽만큼 안 여백을 줄여
        // 글 너비·칸 높이를 한글과 같게 (좁은 칸에서 한글은 한 줄인데 줄이 바뀌던 것)
        //  기본 여백(표 안 여백이 기본값이라 칸 여백이 없는) 칸도 테두리가 있으면 같이 줄임 (Business12: 1mm 윗테두리 칸 줄이 한글보다 1.5px 높던 것) — data-dm 표시, 읽을 때는 여백 없음
        const half = k => sideHalf(c, k);
        const hbDiff = ['l', 'r', 't', 'b'].some(k => Math.abs(half(k) - halfBorderMm((c.borders || {})[k])) > 1e-6);
        const dm = !c.margin && c.borders && SIDES.some(([k]) => half(k) > 0);
        // 칸 여백: 원래 HWPUNIT 값(hu: 왼·오·위·아래)이 있으면 그 정밀도로 (0.1mm 로 줄이면 141 → 0.5mm 가 되어 칸 글 폭이 한글보다 좁음 — PUBL142)
        const exact = m => (m && m.hu ? Object.assign({}, m, ...['l', 'r', 't', 'b'].map((k, i) => (Math.abs(m.hu[i] / (7200 / 25.4) - m[k]) < 0.051 ? { [k]: m.hu[i] / (7200 / 25.4) } : null))) : m);
        const cm = exact(c.margin) || (dm ? DEFAULT_CELL_MARGIN : null);
        if (cm) {
          const pad = (v, k) => Math.max(0, Math.round((v - half(k)) * 1000) / 1000);
          css.push(`padding:${pad(cm.t, 't')}mm ${pad(cm.r, 'r')}mm ${pad(cm.b, 'b')}mm ${pad(cm.l, 'l')}mm`);
          // 위·아래 여백이 테두리 반쪽보다 작으면 남은 만큼은 칸 첫·끝 문단 간격에서 뺌 (td::before/::after 의 음수 여백이 문단 간격과 겹침)
          const rest = k => Math.round(Math.max(0, half(k) - cm[k]) * 1000) / 1000;
          if (rest('t')) css.push(`--bt:${rest('t')}mm`);
          if (rest('b')) css.push(`--bb:${rest('b')}mm`);
        }
        if (c.bg) css.push(`background-color:${c.bg}`);
        if (c.valign && c.valign !== 'middle') css.push(`vertical-align:${c.valign}`);
        if (c.dir) css.push('writing-mode:vertical-rl'); // 세로쓰기 칸 (값은 data-dir 에 보관)
        if (c.borders) css.push(borderCss(c.borders));
        const db = (c.borders ? ` data-border="${encodeBorders(c.borders)}"` : '') + (c.dir ? ` data-dir="${c.dir}"` : '') + (c.height && c.hh ? ` data-hh="${c.hh}"` : '') + (dm ? ' data-dm=""' : '') + (c.wrap ? ` data-wrap="${c.wrap}"` : '')
          + (c.margin && c.margin.hu ? ` data-cm="${c.margin.hu.join(',')}"` : '') // 셀 여백의 원래 HWPUNIT 값
          + (cm && hbDiff ? ` data-hb="${['l', 'r', 't', 'b'].map(k => Math.round(half(k) * 1e5) / 1e5).join(',')}"` : '');
        return `<td${c.colSpan > 1 ? ` colspan="${c.colSpan}"` : ''}${c.rowSpan > 1 ? ` rowspan="${c.rowSpan}"` : ''}${db}${css.length ? ` style="${css.join(';')}"` : ''}>`
          + (c.blocks.length ? c.blocks : [{ type: 'p', runs: [] }]).map(blockHtml).join('') + '</td>';
      }).join('') + '</tr>').join('');
      // 표와 같은 문단에 딸린 떠 있는 개체는 높이 없는 caption 에 기준점으로 둠
      const anch = b.anchors && b.anchors.length ? `<caption class="anch" contenteditable="false">${b.anchors.map(runHtml).join('')}</caption>` : '';
      // 배치(글자처럼 취급 등)와 표가 든 문단 모양은 data-place 에 보관. 글자처럼 취급한 표는 문단 정렬을, 그 밖은 가로 정렬을 따름
      const place = b.place || b.para ? ` data-place="${escAttr(JSON.stringify({ place: b.place || null, para: b.para || null }))}"` : '';
      const al = b.place && b.place.inline ? b.para && b.para.align : b.place && !b.place.inline && b.place.horzAlign === 'CENTER' ? 'center' : b.place && b.place.horzAlign === 'RIGHT' ? 'right' : null;
      const mg = al === 'center' ? ';margin-left:auto;margin-right:auto' : al === 'right' ? ';margin-left:auto' : '';
      // 표와 글이 한 문단이던 조각 묶음 (저장할 때 다시 한 문단으로)
      const grp = b.grp ? ` data-grp="${escAttr(b.grp)}"` : '';
      const html = `<table class="hwp-tbl"${pb}${place}${grp} data-wr="${b.widthRatio || 1}" style="--w:${Math.round((b.widthRatio || 1) * 1e6) / 1e4}%;width:calc(var(--w) + var(--tbl, 0px) + var(--tbr, 0px))${mg}">${anch}<colgroup>${cols}</colgroup><tbody>${rows}</tbody></table>`;
      // 글 앞으로·뒤로 놓인 표: 글을 밀어내지 않음 → 표가 든 문단의 한 줄 자리만 div.tfl 로 지키고, 표는 쪽 위 자리로 옮김 (편집기 placeShapes)
      if (b.place && !b.place.inline && /^(BEHIND_TEXT|IN_FRONT_OF_TEXT)$/.test(b.place.wrap || '')) {
        const p = b.para || {}, size = p.charSize || 10;
        const lineH = p.lineType === 'FIXED' ? p.lineValue : p.lineType === 'AT_LEAST' ? Math.max(p.lineValue, size) : p.lineType === 'BETWEEN_LINES' ? size + p.lineValue : size * (p.lineSpacing || 160) / 100;
        return `<div class="tfl" style="height:${r1(lineH)}pt">${html}</div>`;
      }
      return html;
    }
    // 문단 번호·글머리표: 번호 글자는 쪽 배치 때 계산해 넣음
    const head = b.head ? '<span class="phead" contenteditable="false"></span>' : '';
    // 떠 있는 개체만 든 문단도 한글처럼 한 줄 높이를 가짐 (줄바꿈 기호로 줄을 만듦 — 읽을 때 끝 줄바꿈은 지움)
    const S = g.PureunShape;
    const onlyFloating = S && b.runs.some(r => r.shape) && b.runs.every(r => r.field || (r.shape && !S.posOf(r.shape).inline));
    const fs0 = onlyFloating && (b.runs.find(r => r.shape).style || {}).size;
    const empty = !b.runs.some(r => !r.field); // 내용 없는 필드 표시만 있으면 빈 문단
    const texts = b.runs.filter(r => typeof r.text === 'string' && r.text);
    // 문단 기준 글자 크기 = 가장 큰 글자 (떠 있는 개체만 든 문단은 개체 자리의 글자 크기). 줄 높이는 이 크기로만 정함 (글자 span 은 line-height:0)
    //  글 없이 글자처럼 취급한 그림·개체만 든 문단은 그 개체 자리의 글자 크기 (Business12: 11pt 자리 그림 줄의 줄 간격 2.3mm)
    //  구역 중간 머리말·꼬리말 컨트롤만 든 문단도 그 컨트롤 자리의 글자 크기 (sample09: 13pt 꼬리말 컨트롤 문단 줄 = 7.3mm)
    const objSize = !texts.length && !onlyFloating && ((b.runs.find(r => (r.image || r.shape || r.hf) && r.style && r.style.size) || {}).style || {}).size;
    const paraSize = texts.length ? Math.max(...texts.map(r => r.size || 10), b.endMark ? b.endMark.size || 10 : 0) : (onlyFloating && fs0) || objSize || 10;
    const prevBase = baseSize, prevCond = curCondense;
    baseSize = paraSize;
    curCondense = (b.pp && g.PureunHwpx.parsePP(b.pp).condense) || 0; // 글자 조각의 빈칸 보정에 함께 넣음
    const prevKeep = curKeepAll;
    curKeepAll = !!(b.pp && g.PureunHwpx.parsePP(b.pp).breakNonLatinWord === 'BREAK_WORD');
    const prevLast = lastTextRun;
    lastTextRun = texts[texts.length - 1] || null;
    const inner = head + runsHtml(b.runs) + (onlyFloating ? '<br>' : '');
    baseSize = prevBase; curCondense = prevCond; lastTextRun = prevLast; curKeepAll = prevKeep;
    let css = paraCss(b);
    if (paraSize !== 10) {
      // 문단 기준 글꼴도 가장 큰 글자의 것으로 (기준 글꼴이 다르면 기준선이 어긋나 줄이 높아짐)
      const big = texts.find(r => (r.size || 10) === paraSize);
      const pf = big ? familyCss(big) : '';
      css = (css ? css + ';' : '') + `font-size:${paraSize}pt` + (pf ? ';' + pf : '');
    }
    // 빈 문단은 글자 크기·글꼴을 문단에 지정해 줄 높이를 원본과 맞춤
    if (empty && b.mark) {
      const mk = [];
      if (b.mark.size && b.mark.size !== 10) mk.push(`font-size:${b.mark.size}pt`);
      if (b.mark.font && b.mark.font !== DEFAULT_FONT) mk.push(`font-family:${fontList(b.mark.font)}`);
      if (mk.length) css = (css ? css + ';' : '') + mk.join(';');
    }
    const attrs = (b.head ? ` data-head="${b.head.type}:${b.head.id || 0}:${b.head.level || 0}"` : '')
      + (b.lineType && b.lineType !== 'PERCENT' ? ` data-lt="${b.lineType}" data-lv="${b.lineValue}"` : '')
      + (b.pp ? ` data-pp="${escAttr(b.pp)}"` : '') + (b.grp ? ` data-grp="${escAttr(b.grp)}"` : '') + (b.styleId ? ` data-st="${b.styleId}"` : '')
      + (b.endMark ? ` data-em="${escAttr(JSON.stringify(b.endMark))}"` : '') // 문단 끝 글자 모양
      + (empty && b.mark ? ` data-mk="${escAttr(JSON.stringify(b.mark))}"` : '') // 빈 문단의 글자 모양 (언어별 글꼴·효과까지 그대로)
      + (!b.lineType || b.lineType === 'PERCENT' ? ` data-ls="${b.lineSpacing || 160}"` : ''); // 줄 간격 비율은 따로 보관 (워드 호환은 pt 로 그리고, 화면 값에서 다시 셈하면 1% 같은 값이 5% 단위로 뭉개짐)
    // 글자처럼 취급한 표가 든 문단: <p> 안에는 표를 둘 수 없어 div.tline 으로 (표는 inline-table)
    const tag = b.runs.some(r => r.table) ? 'div' : 'p';
    return `<${tag}${tag === 'div' ? ' class="tline"' : ''}${pb}${attrs}${css ? ` style="${css}"` : ''}>${inner || '<br>'}${inner && empty ? '<br>' : ''}</${tag}>`;
  }

  // vert: 세로쓰기 글상자 ('upright' 영문 세움 · 'mixed' 영문 눕힘) — 그 안 글자의 화면 폭 기준이 달라짐
  const blocksToHtml = (blocks, vert) => { const prev = curVert; curVert = vert || null; try { return (blocks || []).map(blockHtml).join('') || '<p><br></p>'; } finally { curVert = prev; } };

  // 각주 내용(HTML) → 블록: 계산된 스타일이 필요하므로 화면 밖 임시 상자에 넣어 변환
  function noteBlocks(html) {
    const box = document.createElement('div');
    box.className = 'doc';
    box.style.cssText = 'position:absolute;left:-10000px;top:0;width:150mm;visibility:hidden';
    box.innerHTML = html || '<p><br></p>';
    document.body.append(box);
    try { return htmlToBlocks(box); } finally { box.remove(); }
  }

  // 문단 요소의 실제(계산된) 문단 모양 → 모델 값 (pt, %)
  function readParaProps(el) {
    const c = getComputedStyle(el);
    // 문단 여백은 0.01pt 까지 (한글 값 1 HWPUNIT = 0.01pt 를 그대로 되살림)
    const px2pt = v => Math.round((parseFloat(v) || 0) * 0.75 * 100) / 100;
    const a = c.textAlign, last = c.textAlignLast;
    const align = a === 'center' ? 'center' : a === 'right' || a === 'end' ? 'right'
      : a === 'justify' ? (last === 'justify' ? 'distribute' : 'justify') : 'left';
    const fs = parseFloat(c.fontSize), lh = parseFloat(c.lineHeight);
    const indent = px2pt(c.textIndent), ml = px2pt(c.marginLeft);
    const hd = (el.dataset.head || '').split(':');
    const extra = Object.assign({},
      HEAD_SET.has(hd[0]) ? { head: { type: hd[0], id: +hd[1] || 0, level: +hd[2] || 0 } } : null,
      el.dataset.lt ? { lineType: el.dataset.lt, lineValue: parseFloat(el.dataset.lv) || 12 } : null,
      el.dataset.pp ? { pp: el.dataset.pp } : null,
      el.dataset.grp ? { grp: el.dataset.grp } : null,
      el.dataset.st ? { styleId: +el.dataset.st } : null, // 문단 스타일 번호 (문서 스타일 표)
      el.dataset.em ? (() => { try { return { endMark: JSON.parse(el.dataset.em) }; } catch (e) { return null; } })() : null);
    return Object.assign(extra, {
      align,
      lineSpacing: el.dataset.lt ? 160 : el.dataset.ls ? +el.dataset.ls : lh && fs ? Math.round((lh / fs) * 100 / 5) * 5 : 160,
      indent, left: Math.round((indent < 0 ? ml + indent : ml) * 100) / 100,
      // 문단 간격은 문단에 직접 준 값만 (셀 안 첫·끝 문단의 줄 간격 보정 같은 CSS 여백은 문단 간격이 아님 — 줄 간격 90% 면 양수가 되어 섞여 들던 것)
      //  오른쪽 여백: 편집기가 줄 끝 자간만큼 넓히거나 좁힌 몫(data-lsd, pt)은 빼고 문단 값으로
      right: Math.round((px2pt(c.marginRight) + (+el.dataset.lsd || 0)) * 100) / 100, before: el.style.marginTop ? Math.max(0, px2pt(c.marginTop)) : 0, after: el.style.marginBottom ? Math.max(0, px2pt(c.marginBottom)) : 0,
    });
  }
  const HEAD_SET = new Set(['OUTLINE', 'NUMBER', 'BULLET']);

  // 모델 문단 값 → 요소 스타일 (기본값은 지워서 문서 기본 스타일을 따르게 함)
  function writeParaProps(el, v) {
    const s = el.style;
    s.textAlign = v.align === 'distribute' ? 'justify' : v.align === 'justify' ? '' : v.align;
    s.textAlignLast = v.align === 'distribute' ? 'justify' : '';
    if (v.lineType && v.lineType !== 'PERCENT') { el.dataset.lt = v.lineType; el.dataset.lv = v.lineValue; }
    else { delete el.dataset.lt; delete el.dataset.lv; }
    // 워드 호환 문서: 문단의 실제 글자(크기·글꼴)로 줄 높이를 셈
    let lv = v;
    if (wordMode) {
      const c = getComputedStyle(el);
      lv = Object.assign({}, v, { runs: [{ text: el.textContent || ' ', size: parseFloat(c.fontSize) * 0.75, font: c.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '') }] });
    }
    if (!v.lineType || v.lineType === 'PERCENT') el.dataset.ls = v.lineSpacing || 160; else delete el.dataset.ls;
    const lc = lineCss(lv);
    s.lineHeight = lc ? lc.slice('line-height:'.length) : '';
    // 문단 머리(번호·글머리표)
    if (v.head && HEAD_SET.has(v.head.type)) {
      el.dataset.head = `${v.head.type}:${v.head.id || 0}:${v.head.level || 0}`;
      if (!el.querySelector(':scope > .phead')) el.prepend(Object.assign(document.createElement('span'), { className: 'phead', contentEditable: 'false' }));
    } else {
      delete el.dataset.head;
      el.querySelectorAll(':scope > .phead').forEach(x => x.remove());
    }
    s.textIndent = v.indent ? v.indent + 'pt' : '';
    const ml = v.indent < 0 ? v.left - v.indent : v.left;
    s.marginLeft = ml ? r1(ml) + 'pt' : '';
    s.marginRight = v.right ? v.right + 'pt' : '';
    delete el.dataset.lsd; // 줄 끝 자간 몫은 편집기가 다시 셈
    s.marginTop = v.before ? v.before + 'pt' : '';
    s.marginBottom = v.after ? v.after + 'pt' : '';
    if (!el.getAttribute('style')) el.removeAttribute('style');
  }

  // ---------- HTML → 모델 (화면에 보이는 그대로의 계산된 스타일 사용) ----------

  function htmlToBlocks(root) {
    const styleCache = new WeakMap();
    const cs = el => getComputedStyle(el);

    function firstFamily(list) {
      const f = list.split(',')[0].trim().replace(/^["']|["']$/g, '');
      return !f || GENERIC.has(f) ? DEFAULT_FONT : f;
    }
    function hex(rgb) {
      const m = rgb.match(/[\d.]+/g);
      if (!m) return null;
      if (m.length === 4 && +m[3] === 0) return null;
      return '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    const isBlockEl = el => BLOCK.has(el.tagName) || el.tagName === 'TD' || el.tagName === 'TH' || el === root;
    function styleOf(el) {
      if (el && el.dataset && el.dataset.ls0 !== undefined && el.parentElement) return styleOf(el.parentElement); // 마지막 글자 자간 보기용 span
      if (styleCache.has(el)) return styleCache.get(el);
      let underline = false, strike = false, sup = false, sub = false, shade = null, sizeEl = el;
      for (let e = el; e && !isBlockEl(e); e = e.parentElement) {
        const c = cs(e);
        if (c.textDecorationLine.includes('underline') || c.textDecorationLine.includes('overline')) underline = true; // 윗줄 = 글자 위 밑줄
        if (c.textDecorationLine.includes('line-through')) strike = true;
        if (e.tagName === 'SUP' || c.verticalAlign === 'super') { sup = true; sizeEl = e.parentElement; }
        if (e.tagName === 'SUB' || c.verticalAlign === 'sub') { sub = true; sizeEl = e.parentElement; }
        if (!shade && !e.classList.contains('fld')) shade = hex(c.backgroundColor);
      }
      const c = cs(el);
      const sizePx = parseFloat(cs(sizeEl).fontSize);
      let ls = parseFloat(c.letterSpacing) || 0;
      // 장평 표시용으로 좁힌 자간은 빼고 원래 자간만 저장 (사이에 자간을 따로 준 요소가 없을 때)
      const ratioEl = el.closest('[data-ratio]');
      if (ratioEl) {
        let own = false;
        for (let e = el; e && e !== ratioEl; e = e.parentElement) if (e.style && e.style.letterSpacing) { own = true; break; }
        if (!own) ls -= ratioAdj(+ratioEl.dataset.ratio) * parseFloat(c.fontSize);
      }
      // 언어별 값(data-lang): 화면 글꼴 목록 맨 앞이 영문 글꼴이면 글자의 글꼴은 한글 글꼴. 사용자가 글꼴을 바꿨으면 저장 때 모든 언어에 그 글꼴
      const langEl = el.closest('[data-lang]');
      const langs = langEl && root.contains(langEl) ? langEl.dataset.lang : undefined;
      let font = firstFamily(c.fontFamily);
      const lf = langs && g.PureunHwpx.parseLangs(langs).f;
      if (lf && font === lf[1] && lf[0] !== lf[1]) font = lf[0];
      const fxEl = el.closest('[data-fx]');
      // 자간: 그릴 때 글자 폭에 맞춰 바꾼 값이면(data-spl 그대로, 사이에 자간을 따로 준 요소 없음) 원래 값(data-sp)
      const spEl = el.closest('[data-sp]');
      let spOrig = null;
      if (spEl && root.contains(spEl) && (spEl.style.letterSpacing || '0em') === spEl.dataset.spl) {
        let own = false;
        for (let e = el; e && e !== spEl; e = e.parentElement) if (e.style && e.style.letterSpacing && !(e.dataset && e.dataset.ls0 !== undefined)) { own = true; break; }
        if (!own) spOrig = +spEl.dataset.sp || 0;
      }
      const s = {
        font, langs, fx: fxEl && root.contains(fxEl) ? fxEl.dataset.fx : undefined,
        size: Math.round(sizePx * 0.75 * 100) / 100, // 글자 크기는 0.01pt 단위로 (한글 값 그대로)
        bold: (parseInt(c.fontWeight, 10) || 400) >= 600,
        italic: c.fontStyle === 'italic',
        underline, strike, sup, sub: sub && !sup,
        color: hex(c.color) || '#000000',
        shade,
        spacing: spOrig !== null ? spOrig : Math.abs(ls) > 0.01 ? Math.round((ls / parseFloat(c.fontSize)) * 100) : 0,
        ratio: (ratioEl && +ratioEl.dataset.ratio) || 100,
        link: (el.closest('a[href]') && root.contains(el.closest('a[href]')) && el.closest('a[href]').getAttribute('href')) || null,
        ch: (fe => { try { return fe && root.contains(fe) ? JSON.parse(fe.dataset.ch) : null; } catch (e) { return null; } })(el.closest('.fld[data-ch]')),
        fd: (fe => { try { return fe && root.contains(fe) ? JSON.parse(fe.dataset.fd) : null; } catch (e) { return null; } })(el.closest('.hfd[data-fd]')),
      };
      styleCache.set(el, s);
      return s;
    }
    const paraProps = readParaProps;
    const same = (a, b) => ['font', 'langs', 'fx', 'size', 'bold', 'italic', 'underline', 'strike', 'sup', 'sub', 'color', 'shade', 'spacing', 'ratio', 'link'].every(k => a[k] === b[k])
      && ((a.ch && a.ch.id) || null) === ((b.ch && b.ch.id) || null) && ((a.fd && a.fd.id) || null) === ((b.fd && b.fd.id) || null);
    function pushRun(runs, r) {
      const last = runs[runs.length - 1];
      if (last && typeof last.text === 'string' && same(last, r)) last.text += r.text; else runs.push(r);
    }
    function imageRun(img) {
      const kept = img.dataset.img && imgStore.get(img.dataset.img);
      if (kept) { const mmv = v => (/mm$/.test(v) ? parseFloat(v) : parseFloat(v) / PX_PER_MM); return { image: Object.assign({}, kept, { w: r1(mmv(img.style.width) || kept.w), h: r1(mmv(img.style.height) || kept.h) }) }; }
      const bytes = dataUrlToBytes(img.getAttribute('src'));
      if (!bytes) return null;
      const mm = v => (/mm$/.test(v) ? parseFloat(v) : parseFloat(v) / PX_PER_MM);
      const w = img.style.width ? mm(img.style.width) : (img.naturalWidth || 100) / PX_PER_MM;
      const h = img.style.height ? mm(img.style.height) : (img.naturalHeight || 100) / PX_PER_MM;
      return { image: { mime: bytes.mime, data: bytes.data, w: r1(w), h: r1(h) } };
    }
    // 개체 조각의 글자 모양: 보관해 둔 data-cs, 없으면 둘레 요소에서 읽음 (둘레 요소도 없으면 null)
    const csOf = (node, around) => { try { if (node.dataset.cs) return JSON.parse(node.dataset.cs); } catch (e) { /* 깨진 자료 */ } return around ? styleOf(around) : null; };
    function inlineRuns(node, runs) {
      if (node.nodeType === 3) {
        // 묶음 빈칸(U+00A0)은 그대로 둠 — 크롬은 입력한 빈칸을 일반 빈칸으로 넣음
        const text = node.nodeValue.replace(/[\u200b\u2060]/g, ''); // 폭 없는 빈칸·줄 나눔 금지 문자(그릴 때 넣은 것)는 지움
        if (text) pushRun(runs, Object.assign({}, styleOf(node.parentElement), { text }));
      } else if (node.nodeType === 1) {
        if (node.classList.contains('pg-gap') || node.classList.contains('phead')) return;
        if (node.classList.contains('hchar') && node.dataset.c) { pushRun(runs, Object.assign({}, styleOf(node.parentElement), { text: String.fromCharCode(parseInt(node.dataset.c, 16)) })); return; }
        if (node.tagName === 'BR') pushRun(runs, Object.assign({}, styleOf(node.parentElement), { text: '\n' }));
        else if (node.tagName === 'IMG') { const r = imageRun(node); if (r) { const st = csOf(node, null); if (st) r.style = st; runs.push(r); } }
        else if (node.classList.contains('autonum')) { try { runs.push({ autoNum: JSON.parse(node.dataset.an), style: csOf(node, node) }); } catch (e) { /* 깨진 자료는 건너뜀 */ } }
        else if (node.classList.contains('hctl')) { try { runs.push({ hf: JSON.parse(node.dataset.hf), style: csOf(node, node.parentElement) }); } catch (e) { /* 깨진 자료는 건너뜀 */ } }
        else if (node.classList.contains('hfd-e')) { try { runs.push({ field: JSON.parse(node.dataset.fd), style: csOf(node, node.parentElement) }); } catch (e) { /* 깨진 자료는 건너뜀 */ } }
        else if (node.classList.contains('cmp')) { try { runs.push({ compose: JSON.parse(node.dataset.cmp), style: csOf(node, node) }); } catch (e) { /* 깨진 자료는 건너뜀 */ } }
        else if (node.classList.contains('gso')) { const sh = shapeOf(node.dataset.sid); if (sh) runs.push({ shape: sh, style: csOf(node, node.parentElement) }); }
        else if (node.classList.contains('note')) runs.push({ note: { kind: node.dataset.kind === 'end' ? 'end' : 'foot', blocks: noteBlocks(node.dataset.note || ''), style: csOf(node, node.parentElement) } });
        else if (node.tagName === 'TABLE') { if (node.parentElement && node.parentElement.classList.contains('tline')) runs.push({ table: tableModel(node), style: csOf(node, node.parentElement) }); }
        else for (const c of node.childNodes) inlineRuns(c, runs);
      }
    }
    const markOf = s => ({ font: s.font, size: s.size, bold: s.bold, italic: s.italic, color: s.color });
    function finish(p, container) {
      const last = p.runs[p.runs.length - 1];
      if (last && typeof last.text === 'string' && last.text.endsWith('\n')) last.text = last.text.slice(0, -1);
      const lastStyle = last && typeof last.text === 'string' ? last : null;
      p.runs = p.runs.filter(r => r.image || r.note || r.shape || r.table || r.compose || r.autoNum || r.field || r.hf || r.text);
      // 아직 채우지 않은 누름틀({{이름}} 그대로)은 저장할 때 빈 누름틀로
      for (const r of p.runs) if (r.ch && r.text === `{{${r.ch.name}}}`) r.placeholder = true;
      // 빈 문단: 줄 높이를 정하는 글자 모양을 함께 저장
      //  (보관한 모양 data-mk 가 있고 그 뒤 크기·글꼴을 바꾸지 않았으면 그것 — 빈 문단은 화면에 크기·글꼴만 나타냄)
      if (!p.runs.some(r => !r.field)) {
        const now = markOf(lastStyle || styleOf(container));
        let kept = null;
        try { kept = container && container.dataset && container.dataset.mk ? JSON.parse(container.dataset.mk) : null; } catch (e) { kept = null; }
        const sameLook = kept && (kept.size || 10) === now.size && (kept.font || DEFAULT_FONT) === now.font;
        p.mark = sameLook ? kept : now;
      }
      return p;
    }
    function collectBlocks(container) {
      const out = [];
      let cur = null, pendingBreak = false;
      const flush = () => { if (cur) { out.push(finish(cur, container)); cur = null; } };
      const mark = b => { if (pendingBreak) { b.pageBreak = true; pendingBreak = false; } return b; };
      for (const node of container.childNodes) {
        if (node.nodeType === 1 && node.classList.contains('pg-gap')) continue;
        if (node.nodeType === 1 && node.tagName === 'TABLE') {
          flush();
          const t = tableModel(node);
          if (node.dataset.pb) t.pageBreak = true;
          out.push(mark(t));
          continue;
        }
        if (node.nodeType === 1 && node.classList.contains('tline')) {
          // 글자처럼 취급한 표가 든 문단 → 표를 글자처럼 품은 문단 하나
          flush();
          const p = mark(Object.assign({ type: 'p', runs: [] }, paraProps(node)));
          for (const c of node.childNodes) inlineRuns(c, p.runs);
          out.push(finish(p, node));
          continue;
        }
        if (node.nodeType === 1 && BLOCK.has(node.tagName)) {
          flush();
          if (node.tagName === 'HR') { pendingBreak = true; continue; }
          const inner = collectBlocks(node);
          const blocks = inner.length ? inner : [Object.assign({ type: 'p', runs: [], mark: markOf(styleOf(node)) }, paraProps(node))];
          if (node.dataset.pb && blocks[0]) blocks[0].pageBreak = true;
          if (blocks[0]) mark(blocks[0]);
          out.push(...blocks);
          continue;
        }
        if (node.nodeType === 3 && !node.nodeValue.length) continue;
        if (!cur) cur = mark(Object.assign({ type: 'p', runs: [] }, paraProps(container)));
        inlineRuns(node, cur.runs);
      }
      flush();
      return out;
    }
    function tableModel(tbl) {
      const trs = Array.from(tbl.rows);
      const rows = trs.map(tr => Array.from(tr.cells).map(td => {
        const c = cs(td);
        const va = c.verticalAlign;
        const borders = td.dataset.border ? decodeBorders(td.dataset.border) : null;
        // 안 여백 = 화면 안 여백 + 테두리 반쪽 (그릴 때 뺀 만큼 되돌림)
        //  (0 이면 원래 여백이 테두리 반쪽보다 작아 잘린 것일 수 있으므로 원래 HWPUNIT 값)
        const cmHu = td.dataset.cm ? td.dataset.cm.split(',').map(Number) : null;
        const hb = td.dataset.hb ? td.dataset.hb.split(',').map(Number) : null; // 이웃 칸의 굵은 테두리로 뺀 반쪽
        const padMm = (side, k, i) => {
          const p = parseFloat(td.style['padding' + side]) || 0;
          if (!p && cmHu) return Math.round(cmHu[i] / (7200 / 25.4) * 1000) / 1000;
          return Math.round((p + (hb ? hb[i] : halfBorderMm((borders || {})[k]))) * 1000) / 1000;
        };
        return {
          colSpan: td.colSpan || 1, rowSpan: td.rowSpan || 1,
          height: /mm$/.test(td.style.height) ? parseFloat(td.style.height) : 0,
          borders,
          margin: /mm$/.test(td.style.paddingTop) && td.dataset.dm === undefined ? Object.assign({ t: padMm('Top', 't', 2), r: padMm('Right', 'r', 1), b: padMm('Bottom', 'b', 3), l: padMm('Left', 'l', 0) },
            cmHu ? { hu: cmHu } : null) : null,
          bg: hex(c.backgroundColor),
          valign: va === 'top' ? 'top' : va === 'bottom' ? 'bottom' : 'middle',
          blocks: collectBlocks(td),
          ...(td.dataset.dir ? { dir: td.dataset.dir } : null),
          ...(td.dataset.wrap ? { wrap: td.dataset.wrap } : null), // 한 줄로 입력
          ...(td.dataset.hh ? { hh: +td.dataset.hh } : null), // 원래 HWPUNIT 높이 (높이를 바꾸면 저장 때 무시됨)
        };
      }));
      const nCols = Math.max(1, ...rows.map(r => r.reduce((s, c) => s + c.colSpan, 0)));
      // 칸 너비: 칸 정의(col 의 %, 칸 너비 바꾸기도 여기를 고침)가 온전하면 그 값 — 화면 px(정수)로 재면 저장할 때마다 조금씩 달라짐
      //  (칸 너비를 바꾸지 않았으면 원래 비율 data-w)
      const cols = Array.from(tbl.querySelectorAll(':scope > colgroup > col')).map(c => {
        const pct = /%$/.test(c.style.width) ? parseFloat(c.style.width) - (+c.dataset.e || 0) : 0, w0 = +c.dataset.w; // data-e: 편집기가 칸 경계를 화면 격자에 맞추느라 더한 몫
        return w0 && Math.abs(pct - w0 * 100) < 0.0006 ? w0 * 100 : pct;
      });
      let widths = cols.length === nCols && cols.every(Boolean) ? cols : [];
      if (!widths.length) {
        const full = trs.find(tr => tr.cells.length === nCols);
        widths = full ? Array.from(full.cells).map(td => td.offsetWidth) : [];
        if (widths.length !== nCols || widths.some(w => !w)) widths = Array(nCols).fill(1);
      }
      const sum = widths.reduce((a, b) => a + b, 0);
      const pc = cs(tbl.parentElement);
      const avail = tbl.parentElement.clientWidth - parseFloat(pc.paddingLeft) - parseFloat(pc.paddingRight);
      // 표 너비: --w(%) — 그릴 때는 바깥 테두리 반쪽을 더한 calc 너비 (편집기 tableBorderWidths)
      const wv = (tbl.style.getPropertyValue('--w') || tbl.style.width || '').trim();
      const wr0 = +tbl.dataset.wr, pct0 = /%$/.test(wv) ? parseFloat(wv) / 100 : 0;
      const pct = wr0 && Math.abs(pct0 - wr0) < 0.000006 ? wr0 : pct0; // 표 너비를 바꾸지 않았으면 원래 비율
      let saved = null;
      try { saved = tbl.dataset.place ? JSON.parse(tbl.dataset.place) : null; } catch (e) { saved = null; }
      const anchors = Array.from(tbl.querySelectorAll(':scope > caption.anch > .gso')).map(sp => shapeOf(sp.dataset.sid)).filter(Boolean).map(shape => ({ shape }));
      return Object.assign({
        type: 'table', colWidths: widths.map(w => w / sum),
        widthRatio: pct ? Math.min(3, pct) : avail > 0 ? Math.min(3, tbl.offsetWidth / avail) : 1, // 표 너비 %(없으면 화면 너비) — 본문보다 넓은 표도 그대로
        rows,
      }, anchors.length ? { anchors } : null, saved && saved.place ? { place: saved.place } : null, saved && saved.para ? { para: saved.para } : null,
      tbl.dataset.grp ? { grp: tbl.dataset.grp } : null);
    }
    return collectBlocks(root);
  }

  g.PureunDom = { setCompat, setFontInfo, headCss, cellMargin, setCellMargin, borderCss, blocksToHtml, htmlToBlocks, noteBlocks, shapeOf, shapeSvg, shapeHtml, putShape, readParaProps, writeParaProps, bytesToDataUrl, dataUrlToBytes, paraCss, setCellBorders, decodeBorders };
})(window);
