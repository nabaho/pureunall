'use strict';
// 📱 푸른 캘린더 — 폰 머리가 «한 줄로 읽히고», 탭·내 계정 창이 «보인다» (2026-10-18 폰화면관리)
// node --test tests/cal-phone-head-fit.test.js
//
// 대표 지시 「폰화면관리」 — 360·411px 폰으로 «로그인한 채» 그려 재 보고(tools/phone-audit) 고친 것.
//
// ■ 무엇이 나빴나 (360px 실측)
//   ① 머리 동그라미를 누르면 «내 계정» 창(로그아웃·구글 연결·사람 색)이 열리기는 하는데
//      머리줄이 overflow-x:auto 라 그 밑이 잘려 «하나도 안 보였다»
//   ② ☰ ▸ 「더 보기 (탭·사람·거르개)」·인원 현황 화면에서 탭 그릇(#tabs)이 폭 0 으로 눌려
//      탭이 안 보였다 — 인원 현황으로 간 사람이 캘린더로 돌아올 길이 없었다
//   ③ 부제 「병오년8월 – 9월」이 두 줄로 떨어지고, 거르개 칩이 켜지면 제목이
//      「10/월」·「병/오/년/…」 한 글자씩 세로로 쌓였다(머리 190px)
//
// ■ 이 검사가 지키는 것 — «규칙»이지 지금 px 값이 아니다
//   · 머리줄(#topbar) 자체는 어디서도 «잘라 내는 상자»가 아니다(내 계정 창이 그 안에 산다)
//   · 폰에서만 탭 그릇이 «제 줄»을 갖는다 — 폰 판정은 폰() 과 «같은 조건»이어야 한다
//   · 넓은 화면 머리줄은 한 줄 그대로다(그쪽은 cal-head-one-line ⑧ 이 지킨다)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const 캘 = fs.readFileSync(path.join(__dirname, '..', 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');

const CSS = (() => {
  const head = 캘.slice(0, 캘.indexOf('</head>'));
  return [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
})();
function mediaBlocks(css) {
  const out = []; const re = /@media([^{]*)\{/g; let m;
  while ((m = re.exec(css))) {
    let d = 1, i = re.lastIndex;
    for (; i < css.length && d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out.push({ cond: m[1].trim(), body: css.slice(re.lastIndex, i - 1), start: m.index, end: i });
    re.lastIndex = i;
  }
  return out;
}
const BLOCKS = mediaBlocks(CSS);
const WIDE = (() => { let s = '', p = 0; BLOCKS.forEach((b) => { s += CSS.slice(p, b.start); p = b.end; }); return s + CSS.slice(p); })();
/* 모든 규칙 [{sel, body}] — @media 안팎 모두 */
function rules(css) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) m[1].split(',').forEach((s) => out.push({ sel: s.trim().replace(/\s+/g, ' '), body: m[2] }));
  return out;
}
const decls = (css, selRe) => rules(css).filter((r) => selRe.test(r.sel)).map((r) => r.body).join(';');
const norm = (s) => String(s).replace(/\s+/g, '').toLowerCase();

/* 폰() 이 쓰는 조건 그대로 — CSS 쪽 폰 판정이 이것과 갈라지면 가로로 눕힌 폰에서 한쪽만 바뀐다 */
const 폰조건 = (() => {
  const i = 캘.indexOf('function 폰(){');
  assert.ok(i >= 0, '폰() 을 못 찾았습니다');
  const m = 캘.slice(i, i + 600).match(/matchMedia\("([^"]+)"\)/);
  assert.ok(m, '폰() 의 matchMedia 조건을 못 찾았습니다');
  return m[1];
})();
const 폰머리줄 = BLOCKS.filter((b) => norm(b.cond) === norm(폰조건)).map((b) => b.body).join('\n');

// ══════════════════════════════════════════════════════════════════
test('① ★ 머리줄(#topbar) 자체는 «잘라 내는 상자»가 아니다 — 내 계정 창이 그 안에 산다', () => {
  /* 내 계정 창이 정말 머리줄 «안»에 있는가 — 밖으로 옮겼다면 이 규칙은 필요 없다(그때 이 검사를 고친다) */
  const s = 캘.indexOf('<div id="topbar">'), e = 캘.indexOf('<div id="app">');
  assert.ok(s >= 0 && e > s, '머리줄 마크업을 못 찾았습니다');
  assert.match(캘.slice(s, e), /id="avamenu"/, '내 계정 창이 머리줄 밖에 있습니다 — 이 검사 전제가 바뀌었습니다');
  /* 선택자가 «#topbar 그 자체»로 끝나는 규칙(폰·PC 모두)에서 overflow 를 잘라 내는 값으로 두지 않는다 */
  const 잘림 = rules(CSS).filter((r) => /#topbar$/.test(r.sel) && /overflow(-x|-y)?\s*:\s*(auto|hidden|scroll|clip)/.test(r.body));
  assert.deepEqual(잘림.map((r) => r.sel + '{' + r.body.trim() + '}'), [],
    '★ 머리줄이 넘침을 잘라 냅니다 — 동그라미를 눌러도 «내 계정» 창(로그아웃·구글 연결)이 머리줄 밑으로 잘려 안 보입니다.\n'
    + '  넘치는 것은 탭 그릇(#tabs)이 제 안에서 밀게 하세요');
});

test('② ★ 폰에서는 탭 그릇이 «제 줄»을 갖는다 — 폭 0 으로 눌려 탭이 사라지지 않게', () => {
  assert.ok(폰머리줄, '★ 폰() 과 같은 조건(' + 폰조건 + ')의 @media 가 없습니다 — 폰 머리줄 규칙이 없습니다');
  assert.match(decls(폰머리줄, /^#topbar$/), /flex-wrap:\s*wrap/, '★ 폰 머리줄이 접히지 않아 탭 그릇이 폭 0 으로 눌립니다');
  const tabs = decls(폰머리줄, /^#tabs$/);
  assert.match(tabs, /flex:\s*\d+\s+\d+\s+100%|flex-basis:\s*100%/, '★ 탭 그릇이 한 줄을 다 차지하지 않습니다');
  assert.match(tabs, /order:\s*\d+/, '탭 그릇이 첫 줄(이름·동그라미) 뒤로 가지 않습니다');
  /* 탭 그릇은 제 안에서 옆으로 민다(넘치면 미는 것은 여기) */
  assert.match(decls(WIDE, /^#tabs$/), /overflow-x:\s*auto/, '탭 그릇이 제 안에서 밀지 않습니다');
  /* 첫 줄은 밝기·회전 단추가 «자리만큼 줄어» 동그라미가 늘 화면 안에 있다 —
     flex-basis 가 0 이 아니면 줄을 나눌 때 제 폭을 주장해 동그라미가 셋째 줄로 떨어진다 */
  const th = decls(폰머리줄, /^#topbar \.themebtn$/);
  assert.match(th, /flex:\s*\d+\s+\d+\s+0(px)?\b|flex-basis:\s*0/, '★ 밝기·회전 단추가 제 폭을 주장합니다 — 동그라미가 밀려납니다');
  assert.match(th, /min-width:\s*0/);
  assert.match(th, /text-overflow:\s*ellipsis/, '줄어든 단추 글이 … 로 줄지 않습니다');
});

test('③ ★ 폰 머리 제목·부제는 한 줄 — 세로로 깨지지 않는다(거르개 칩이 켜져도)', () => {
  assert.match(decls(CSS, /^body\.mob \.mtt$/), /min-width:\s*min-content/,
    '★ 제목 칸이 제목(10월 ▾)보다 좁아질 수 있습니다 — 거르개 칩이 켜지면 「10/월」로 세로로 깨집니다');
  assert.match(decls(CSS, /^body\.mob \.mtt b$/), /white-space:\s*nowrap/, '★ 「10월」이 접힐 수 있습니다');
  const sub = decls(CSS, /^body\.mob \.mtt span$/);
  assert.match(sub, /white-space:\s*nowrap/, '★ 부제(음력 범위)가 두 줄로 떨어집니다');
  assert.match(sub, /text-overflow:\s*ellipsis/, '부제가 넘치면 … 로 줄여야 합니다');
  assert.match(sub, /overflow:\s*hidden/);
  /* 부제가 제 폭을 주장하면 제목 칸의 min-content 가 부제 폭이 되어 단추들이 화면 밖으로 밀린다 */
  assert.match(sub, /(^|;)\s*width:\s*0/, '★ 부제가 제 폭을 주장합니다 — 단추가 화면 밖으로 밀립니다');
});

test('④ 넓은 화면 머리줄은 그대로 «한 줄» — 폰 규칙이 PC 로 새지 않는다', () => {
  assert.doesNotMatch(decls(WIDE, /^#topbar$/), /flex-wrap:\s*wrap/, '넓은 화면 머리줄이 접힙니다');
  assert.doesNotMatch(decls(WIDE, /^#tabs$/), /100%/, '넓은 화면에서 탭 그릇이 제 줄로 내려갑니다');
  /* 폰 머리줄 규칙은 «폰 조건» 안에만 — max-width 조건이 PC 폭(701px 이상)을 덮지 않는다 */
  const w = (폰조건.match(/max-width\s*:\s*(\d+)px/) || [])[1];
  assert.ok(w && +w < 1024, '폰 조건의 폭이 PC 를 덮습니다: ' + 폰조건);
});
