'use strict';
/* 경력관리 어두운 테마 — «공용 표면» 규칙 (대표 지시 2026-11-15 「경력관리 다른 화면의 어두운 테마도 고쳐 주세요」)

   ■ 무엇이 문제였나
   어두운 판(html.dark)은 변수(--text 등)만 밝게 바꿨다. 그런데 밝은 바탕(#fff·#f8fafc …)을 «글자색 없이» 또는 «var(--text)»로 하드코딩한
   규칙·인라인은 바탕은 그대로 밝고 글자만 밝아져 1.2:1 이 됐다. 실측(지어낸 자료, 1280px): 화면 28개·머리줄·창 39개에서 948건 —
   표 칸 글자색 #1e293b 가 바탕(#1e293b)과 같고(1.00:1), 기본 단추 흰 바탕+밝은 글자(1.23:1), 칩·툴바·빈 칸 …
   ■ 무엇을 못 박나 (값이 아니라 규칙)
   ① 이 묶음은 전부 html.dark 안에만 있다(밝은 판은 그대로).
   ② «밝은 바탕을 하드코딩한 CSS 규칙»은 새로 생길 때마다 (a) 글자색을 같이 박았거나 (b) 어두운 판 짝이 있거나 (c) 종이로 문서화돼 있어야 한다.
   ③ 공용 뼈대가 있다 — 단추·툴바·표 칸·표 머리·칩 / 브랜드 글자색 변수와 그것을 «바탕»으로 쓰는 곳 / 종이 구역(변수 되돌림) / 인라인 글자·바탕.
   ④ 이 묶음 안에서 바탕과 글자를 «함께» 정한 규칙은 명암비 4.5:1 이상이다.
   ⑤ --navy 는 건드리지 않는다(흰 글자 단추의 바탕이 같은 값).
   (실제 화면 명암비 실측·변이 확인은 status/2026-11-15-kcareer-dark-surfaces.md)
   실행: node --test tests/kcareer-dark-surfaces.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('./lib-palette.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const CSS = SRC.slice(0, SRC.indexOf('</style>'));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const 머리 = '어두운 테마 — 공용 표면';
const 시작 = CSS.indexOf(머리);
assert.ok(시작 > 0, '«어두운 테마 — 공용 표면» 묶음이 없습니다');
const 묶음 = strip(CSS.slice(CSS.lastIndexOf('/*', 시작)));   /* 머리 주석부터 끝까지 */

/* 규칙 목록 — {sel, body} (@media 안은 펼친다) */
function 규칙들(css) {
  const out = []; const re = /([^{}@][^{}]*)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) out.push({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] });
  return out;
}
const 어두운규칙 = 규칙들(묶음);
/* 선택자 목록을 «최상위» 쉼표로만 나눈다 — :is(…)·[속성="…,…"] 안의 쉼표는 그대로 */
function 분리(sel) {
  const out = []; let d = 0, b = 0, q = '', cur = '';
  for (const ch of sel) {
    if (q) { if (ch === q) q = ''; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '(') d++; else if (ch === ')') d--; else if (ch === '[') b++; else if (ch === ']') b--;
    if (ch === ',' && !d && !b && !q) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* 어두운 판 변수 — 묶음 안의 html.dark{…} 와 기존 html.dark{…} */
const 변수 = {};
for (const m of strip(CSS).matchAll(/html\.dark\s*\{([^}]*)\}/g)) for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g)) 변수[d[1]] = P.norm(d[2]);
const 값 = (v) => { v = String(v || '').trim().replace(/!important/, '').trim(); const k = v.match(/^var\((--[\w-]+)\)/); if (k) return 변수[k[1]] || null; return /^#[0-9a-fA-F]{3,6}$/.test(v) ? P.norm(v) : null; };
const 명암 = (a, b) => { const x = P.lum(a), y = P.lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const 선언 = (body, 속성) => { const m = body.match(new RegExp('(?:^|;)\\s*' + 속성 + '\\s*:\\s*([^;]+)')); return m ? m[1].trim() : null; };

test('① 이 묶음은 전부 html.dark 안에만 있다 — 밝은 판은 그대로', () => {
  assert.ok(어두운규칙.length >= 20, '묶음이 비었습니다');
  const 샌 = [];
  for (const r of 어두운규칙) for (const s of 분리(r.sel)) if (!/^html\.dark\b/.test(s)) 샌.push(s.slice(0, 60));
  assert.deepEqual(샌, [], '밝은 판에도 걸리는 선택자가 있습니다: ' + 샌.join(' | '));
});

test('⑤ --navy 는 안 바꾼다 — 흰 글자 단추의 «바탕»이 같은 값이라 바꾸면 단추가 밝아진다', () => {
  const 변수줄 = 어두운규칙.find((r) => /^html\.dark$/.test(r.sel));
  assert.ok(변수줄, 'html.dark 변수 줄이 없습니다');
  assert.doesNotMatch(변수줄.body, /--navy\s*:/);
});

test('③ 브랜드 글자색 변수를 밝은 값으로 되박고, 그것을 «바탕»으로 쓰는 곳은 원래 값으로 되박는다', () => {
  const 줄 = 어두운규칙.find((r) => /^html\.dark$/.test(r.sel)).body;
  for (const v of ['--teal', '--red', '--amber', '--blue']) {
    const c = 값(선언(줄, v));
    assert.ok(c, v + ' 가 어두운 판에서 안 바뀝니다');
    assert.ok(명암(c, '#1e293b') >= 4.5, v + ' 가 어두운 카드(#1e293b) 위에서 4.5:1 이 안 됩니다');
  }
  /* 바탕으로 쓰인 teal/red(흰 글자 단추)는 변수가 밝아져도 흰 글자가 읽히게 짙은 값으로 */
  for (const [키, 이름] of [['teal', 'teal'], ['red', 'red']]) {
    const r = 어두운규칙.find((x) => x.sel.includes('background:var(--' + 키 + ')'));
    assert.ok(r, '«바탕으로 쓰인 ' + 이름 + '» 되박기가 없습니다 — 변수가 밝아지면 흰 글자 단추가 안 읽힙니다');
    const bg = 값(선언(r.body, 'background'));
    assert.ok(bg && 명암(bg, '#ffffff') >= 4.5, 이름 + ' 바탕에 흰 글자가 4.5:1 이 안 됩니다');
    assert.match(r.body, /!important/, '인라인 바탕을 이기려면 !important');
  }
});

test('③ 종이 구역 — 흰 바탕을 남기고 안쪽 변수를 밝은 판 값으로 되돌린다(글자가 어두운 변수를 따라 밝아지지 않게)', () => {
  const r = 어두운규칙.find((x) => /#p1Paper/.test(x.sel) && /\.cv-sheet/.test(x.sel) && /--text\s*:/.test(x.body));
  assert.ok(r, '종이 구역 변수 되돌림이 없습니다');
  for (const v of ['--text', '--ink', '--text-mute', '--card']) assert.ok(r.body.includes(v + ':'), v + ' 를 되돌리지 않았습니다');
  assert.ok(명암(값(선언(r.body, '--text')), '#ffffff') >= 4.5, '종이 글자(--text)가 흰 종이 위에서 4.5:1 이 안 됩니다');
  assert.ok(명암(값(선언(r.body, '--text-mute')), '#e2e8f0') >= 4.5, '종이 보조 글자가 회색 판(#e2e8f0) 위에서 4.5:1 이 안 됩니다');
  for (const k of ['.kf-paper', '.kf-sheet', '#kfSheetWrap', '.cv-sheet', '#rhwpEditor']) assert.ok(r.sel.includes(k), k + ' 가 종이 구역에 없습니다');
});

test('③ 공용 뼈대 — 단추·툴바·표 칸·표 머리·칩이 어두운 판에서 «바탕·글자»가 한 벌이다', () => {
  const 찾기 = (s) => 어두운규칙.find((r) => 분리(r.sel).some((x) => x === s));
  const 단추 = 찾기('html.dark .btn:not(.primary)');
  assert.ok(단추, '기본 단추 어두운 규칙이 없습니다'); assert.match(단추.body, /background:/); assert.match(단추.body, /color:var\(--text\)/); assert.match(단추.body, /border-color:/);
  assert.doesNotMatch(단추.body, /!important/, '켜진 단추(인라인 배경)를 덮어씁니다');
  assert.ok(명암(값(선언(단추.body, 'color')), 값(선언(단추.body, 'background'))) >= 4.5);
  for (const s of ['html.dark .toolbar', 'html.dark .dt .empty', 'html.dark .more-menu', 'html.dark .cp-chip', 'html.dark .fee-chip', 'html.dark .puag-kind'])
    assert.ok(찾기(s) && /background:var\(--(card|soft)\)/.test(찾기(s).body), s + ' 의 어두운 바탕이 없습니다');
  const 칸 = 찾기('html.dark .dt tbody td'); assert.ok(칸 && /color:var\(--text\)/.test(칸.body), '표 칸 글자색(#1e293b 하드코딩)을 못 이깁니다');
  const 머리줄 = 찾기('html.dark .dt thead th'); assert.ok(머리줄 && /background:#1e293b!important/.test(머리줄.body) && /color:var\(--text\)!important/.test(머리줄.body), '표 머리줄은 바탕 규칙이 !important 라 !important 로 이겨야 합니다');
  const 호버 = 찾기('html.dark .dt tbody tr:hover'); assert.ok(호버 && /background:[^;]*!important/.test(호버.body), '호버 줄이 어두운 판에서 흰색이 됩니다');
  const 칩 = 찾기('html.dark .id-chip'); assert.ok(칩 && 명암(값(선언(칩.body, 'color')), 값(선언(칩.body, 'background'))) >= 4.5, '번호 칩 대비');
  const 머리 = 찾기('html.dark .topbar'); assert.ok(머리 && /!important/.test(머리.body), '머리줄 바탕 규칙이 !important 라 같은 !important 로 이겨야 합니다');
});

test('③ 표 바깥 상자는 폰(≤520px)에서 건드리지 않는다 — 폰은 줄마다 카드라 표 바탕이 투명이다(폰 블록)', () => {
  const m = 묶음.match(/@media\s*\(\s*min-width\s*:\s*(\d+)px\s*\)\s*\{\s*html\.dark \.dt table\s*\{[^}]*background:var\(--card\)/);
  assert.ok(m && Number(m[1]) > 520, '표 바탕 규칙이 폰 폭까지 퍼집니다');
  /* 같은 선택자가 미디어 밖(폰까지 퍼지는 곳)에 또 있으면 안 된다 */
  const 미디어밖 = 묶음.replace(/@media[^{]*\{[^{}]*\{[^{}]*\}\s*\}/g, '');
  assert.ok(!/html\.dark \.dt table\s*\{/.test(미디어밖), '표 바탕 규칙이 미디어 밖에도 있어 폰까지 퍼집니다');
});

test('③ 인라인 — 화면에 직접 박힌 짙은 글자색·밝은 바탕을 어두운 판에서 뒤집는다(종이·자기 바탕을 가진 것·밝은 안내줄 안은 뺀다)', () => {
  const 글자 = 어두운규칙.filter((r) => /\[style\*="color:#/.test(r.sel) && /\{?color:#[0-9a-f]{6}!important/.test('{' + r.body));
  assert.ok(글자.length >= 6, '인라인 짙은 글자색 뒤집기(호박·초록·빨강·파랑·남색·회색)가 모자랍니다');
  for (const r of 글자) {
    assert.match(r.sel, /:not\(\[style\*="background:#"\]\)/, '자기 바탕을 따로 박은 것은 뺍니다(밝은 칩)');
    assert.match(r.sel, /:not\(:is\(\.cv-sheet,\.kf-paper/, '종이 안은 뺍니다');
    assert.match(r.sel, /\[style\^="color:"\]/, '밝은 바탕+글자색을 함께 박은 «밝은 안내줄» 안의 링크도 뺍니다');
    const c = 값(선언(r.body, 'color')); assert.ok(c && 명암(c, '#1e293b') >= 4.5, '뒤집은 글자색이 어두운 카드 위에서 4.5:1 이 안 됩니다');
  }
  const 바탕 = 어두운규칙.find((r) => /\[style\*="background:#f8fafc" i\]/.test(r.sel));
  assert.ok(바탕, '인라인 밝은 바탕 뒤집기가 없습니다');
  assert.match(바탕.body, /background:var\(--soft\)!important/);
  for (const 뺄것 of ['#p1Paper', '.cv-sheet', '.kf-paper']) assert.ok(바탕.sel.includes(':not(' + 뺄것 + ')'), 뺄것 + ' 는 종이라 뒤집으면 안 됩니다');
  assert.match(바탕.sel, /:not\(\[style\^="color:"\]\)/, '글자색을 함께 박은 것(밝은 칩)은 뺍니다');
  /* style 속성이 JS(style.cssText)로 다시 쓰이면 공백·rgb() 꼴이 된다 */
  assert.match(바탕.sel, /background: #f8fafc/); assert.match(바탕.sel, /background: rgb\(248, 250, 252\)/);
});

test('④ 이 묶음에서 바탕과 글자를 «함께» 정한 규칙은 명암비 4.5:1 이상이다', () => {
  const 못 = [];
  for (const r of 어두운규칙) {
    const bg = 값(선언(r.body, 'background') || 선언(r.body, 'background-color')), fg = 값(선언(r.body, 'color'));
    if (!bg || !fg) continue;
    const c = 명암(bg, fg);
    if (c < 4.5) 못.push(r.sel.slice(0, 50) + ' ' + c.toFixed(2));
  }
  assert.deepEqual(못, []);
});

/* ② 새로 생기는 «밝은 바탕 + 글자색 없음/변수 글자» 규칙은 어두운 판 짝이 있어야 한다 */
const 밝은 = (h) => P.lum(h) >= 0.55;
const 테마변수글자 = /^var\(--(text|ink|text-sub|text-mute)\b/;
test('② 밝은 바탕을 하드코딩한 CSS 규칙은 «글자색을 박았거나 · 어두운 판 짝이 있거나 · 종이로 문서화돼 있다»', () => {
  /* 종이·그림 뒤판·인쇄·애니메이션 — 어두운 판에서도 일부러 밝다. 새로 더하려면 까닭을 적는다 */
  const 종이 = [
    ['.cv-sheet', '이력서 용지(흰 종이·글자 #000)'], ['.kf-paper', '서식 채우기 종이'], ['.kf-sheet', '서식 채우기 시트(종이 구역)'], ['#rhwpEditor', '한글 편집기(흰 종이)'],
    ['.cv-pp-inner', '이력서 팝업 안(어두운 카드로 뒤집음)'], ['.ds-pv-img', '미리보기 그림 뒤판(어두운 회색으로 뒤집음)'], ['.cv-hwp-body', '한글 미리보기 뒤판'],
    ['@keyframes', '애니메이션 단계(0%·40%)'], ['.fd-months i', '막대 그래프(글자 없음)'], ['.hover-img', '그림'],
    ['.kf-in', '서식 칸(종이 구역 안 — 흰 종이 위 입력)'], ['.cv-rowdel:hover', '이력서 용지 안 «삭제» 호버(밝은 판과 같은 값)'],
    ['.rh-slot select', '선택 상자 — html.dark select 규칙(특이도가 더 높음)이 어두운 바탕·밝은 글자로 이긴다'],
    ['.tb-input', '입력 상자 — html.dark input 규칙(특이도가 더 높음)이 이긴다'], ['.tb-select', '선택 상자 — html.dark select 규칙이 이긴다'],
    ['.kf-lock', '서식 채우기 잠금 칸(종이 구역 안)'], ['.cv-pgcnt', '이력서 쪽수 칩 — 기본 규칙이 글자(navy)와 밝은 바탕을 함께 박았고 호버는 테두리만 바꾼다'],
  ];
  const 어두운선택자 = 규칙들(strip(CSS)).filter((r) => /^html\.dark/.test(r.sel)).flatMap((r) => 분리(r.sel));
  /* 꼬리 토큰 — 선택자 끝의 클래스·아이디·태그 둘(상태 :hover·:focus 는 뗀다) */
  const 꼬리토큰 = (sel) => { const t = (sel.replace(/:[\w-]+(\([^)]*\))?/g, '').match(/[.#]?[\w-]+/g) || []).filter((x) => !/^(html|body)$/.test(x)); return t.slice(-2); };
  const 규칙표 = 규칙들(strip(CSS)).filter((r) => !/^html\.dark/.test(r.sel) && !/^\d+%$|^from$|^to$/.test(r.sel));
  /* 같은 선택자를 «나중에» 다시 정한 규칙이 있으면 그쪽이 이긴다(캐스케이드) — 글자를 리터럴로 박거나(.tag.teal) 바탕을 변수로 바꾼(.card) 경우 */
  const 나중글자 = new Set(), 나중바탕 = new Set();
  for (const r of 규칙표) for (const s of 분리(r.sel)) {
    const fg = 선언(r.body, 'color'), bg = 선언(r.body, 'background') || 선언(r.body, 'background-color');
    if (fg && /^#[0-9a-fA-F]{3,6}\b/.test(fg)) 나중글자.add(s);
    if (bg && /^var\(/.test(bg)) 나중바탕.add(s);
  }
  const 빠진 = [];
  for (const r of 규칙표) {
    const bg = (r.body.match(/(?:^|;)\s*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})\b/) || [])[1];
    if (!bg || !밝은(bg)) continue;
    const fg = 선언(r.body, 'color');
    if (fg && !테마변수글자.test(fg) && !/var\(--(teal|red|amber|blue|gold)\)/.test(fg)) continue;        /* (a) 글자색을 리터럴로 박았다 */
    if (/@media\s*print|\.sidebar,\.topbar/.test(r.sel)) continue;
    for (const s of 분리(r.sel)) {
      const t = 꼬리토큰(s); if (!t.length) continue;
      if (종이.some(([k]) => s.includes(k))) continue;                                                       /* (c) 종이 */
      if (fg ? 나중글자.has(s) : 나중바탕.has(s)) continue;                                                  /* 같은 선택자를 나중에 리터럴 글자/변수 바탕으로 다시 정했다 */
      if (어두운선택자.some((d) => t.every((x) => d.includes(x)))) continue;                                 /* (b) 어두운 판 짝(꼬리 토큰을 다 담은 html.dark 선택자가 있다) */
      빠진.push(s.slice(0, 70) + '  bg=' + bg + (fg ? ' fg=' + fg : ' 글자색 없음'));
    }
  }
  assert.deepEqual(빠진, [], '밝은 바탕을 하드코딩했는데 어두운 판 짝이 없는 규칙이 있습니다 — html.dark 짝을 더하거나 «종이»라면 위 목록에 까닭과 함께 적으세요:\n' + 빠진.join('\n'));
});
