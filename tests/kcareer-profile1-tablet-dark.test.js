'use strict';
/* 프로필 1장 — 고르기 창 밖의 «원래 있던 문제» 셋 (2026-11-15, 대표 «네, 고쳐 주세요»)
   ① 어두운 테마: 기본 단추는 흰 바탕에 밝은 글자(1.23:1), 노란 안내 상자·⚙ 칸은 밝은 바탕에 밝은 글자(1.19:1)였다.
   ② 그림(A4) 칸이 밖으로 나가 #main 이 가로로 밀렸다 — _p1Scale 이 «칸 폭»이 아니라 «전체 폭»으로 그림 크기를 쟀다
      (설정 칸 500px 가 옆에 있으면 그림 칸은 전체보다 훨씬 좁다. 실측 1024px 창: 칸 193px 에 그림 433px).
   ③ ⚙·☑ 단추 높이가 20px — 누르는 칸 최소 24×24.
   규칙만 못 박는다: 값(24·1200·색)이 아니라 «칸 폭으로 잰다»·«쌓는 구간이 있다»·«어두운 판에 바탕·글자가 한 벌»·«최소 높이가 있다».
   실행: node --test tests/kcareer-profile1-tablet-dark.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const CSS = SRC.slice(0, SRC.indexOf('</style>'));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
/* 줄 하나짜리 규칙의 선언부 — 선택자가 «정확히» 같은 것만(주석 뗀 뒤) */
function 규칙(선택자, 바탕 = strip(CSS)) {
  const re = new RegExp('(?:^|\\})[ \\t]*' + 선택자.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const m = 바탕.match(re);
  return m ? m[1] : null;
}

test('① 어두운 테마 — 프로필 1장 화면의 기본 단추는 «바탕·글자·테두리» 한 벌이다', () => {
  const r = 규칙('html.dark #page-profile1 .btn:not(.primary)');
  assert.ok(r, '어두운 판 단추 규칙이 없습니다 — 기본 단추가 흰 바탕에 밝은 글자가 됩니다');
  assert.match(r, /background:/); assert.match(r, /color:var\(--text\)/); assert.match(r, /border-color:/);
  /* 켜진 단추(인라인 배경+흰 글자)를 덮어쓰면 안 된다 — !important 가 없어야 인라인이 이긴다 */
  assert.doesNotMatch(r, /!important/, '켜진 단추의 인라인 배경을 덮어씁니다');
});
test('① 어두운 테마 — 인라인 밝은 바탕을 가진 노란 안내 상자·⚙ 칸은 class 로 잡고 !important 로 이긴다', () => {
  const note = 규칙('html.dark #page-profile1 .p1-note'), card = 규칙('html.dark #page-profile1 .p1-card');
  assert.ok(note && card, '어두운 판 규칙이 없습니다');
  assert.match(note, /background:[^;]*!important/, '인라인 밝은 바탕을 못 이깁니다'); assert.match(note, /color:/);
  assert.match(card, /background:[^;]*!important/);
  assert.match(SRC, /class="p1-note" style="[^"]*background:#fffbeb/, '노란 안내 상자에 class 가 없습니다');
  assert.match(SRC, /class="p1-card" style="[^"]*background:#f8fafc/, '⚙ 칸에 class 가 없습니다');
});
test('① 어두운 테마 — 이 규칙들은 어두운 판 안에만 있다(밝은 판 그대로)', () => {
  assert.equal(규칙('#page-profile1 .p1-note'), null); assert.equal(규칙('#page-profile1 .p1-card'), null);
  assert.equal(규칙('#page-profile1 .btn:not(.primary)'), null);
});

test('③ ⚙·☑ 단추에는 최소 높이가 있다(인라인 padding:1px 로는 20px 밖에 안 된다)', () => {
  const r = 규칙('#p1Side .btn.sm');
  assert.ok(r, '설정 칸 작은 단추 규칙이 없습니다');
  const h = Number((r.match(/min-height:\s*(\d+)px/) || [])[1]), w = Number((r.match(/min-width:\s*(\d+)px/) || [])[1]);
  assert.ok(h >= 24, '누르는 칸 최소 높이(24px, WCAG 2.5.8)보다 낮습니다'); assert.ok(w >= 24, '최소 폭');
  assert.match(SRC, /class="btn sm" data-k="'\+S\.key\+'" style="padding:1px 7px/, '⚙ 단추가 바뀌었습니다 — 이 검사를 다시 보십시오');
});

test('② 좁은 폭(폰보다 넓은 구간)에서도 설정·그림을 위아래로 쌓는다 — 폰 규칙은 그대로', () => {
  /* @media(max-width:N) 덩이 모으기 — 폰(≤520)보다 넓은 것 중에 쌓기 규칙이 있어야 한다 */
  const 덩이 = [];
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g; let m;
  while ((m = re.exec(CSS))) { let d = 0, i = CSS.indexOf('{', m.index); const s = i; for (; i < CSS.length; i++) { if (CSS[i] === '{') d++; else if (CSS[i] === '}' && --d === 0) break; } 덩이.push({ w: Number(m[1]), body: CSS.slice(s + 1, i) }); }
  const 넓은 = 덩이.filter(b => b.w > 520 && /\.p1-wrap\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)!important/.test(b.body));
  assert.ok(넓은.length >= 1, '★ 폰보다 넓은 구간에서 프로필 1장을 쌓는 규칙이 없습니다 — 사이드바가 보이는 좁은 창에서 그림 칸이 눌려 가로로 밀립니다');
  assert.match(넓은[0].body, /#p1Side\{[^}]*position:\s*static!important[^}]*max-height:\s*none!important/, '쌓인 설정 칸은 붙지도 제 안에서 구르지도 않는다');
  /* PC 두 칸(인라인)은 그대로 — 쌓기는 어떤 @media 에도 안 든 바탕에는 없다 */
  const 바탕 = 덩이.reduce((acc, b) => acc.replace(b.body, ''), CSS);
  assert.ok(!/\.p1-wrap\{[^}]*!important/.test(바탕), '쌓기가 PC 구간으로 샜습니다');
});

/* ── _p1Scale: 칸 폭으로 잰다 — 가짜 DOM 으로 돌린다 ── */
function 돌리기({ 칸폭, 전체폭, 창폭, 창높이, 그림위, 열, 모드, 퍼센트 }) {
  const a4 = { style: {} };
  const paper = { style: { width: '', margin: '', height: '', overflow: '', background: '' }, parentNode: null,
    offsetWidth: 칸폭,   /* 폭을 100% 로 놓으면 칸 폭이 된다 */
    querySelector: () => a4, getBoundingClientRect: () => ({ top: 그림위 }) };
  paper.parentNode = { clientWidth: 전체폭 };
  const ctx = { document: { getElementById: () => paper, fullscreenElement: null },
    window: { innerWidth: 창폭, innerHeight: 창높이 }, getComputedStyle: () => ({ gridTemplateColumns: 열 }),
    _p1View: 'a4', _p1ZoomMode: 모드, _p1Pct: 퍼센트 || 100, _p1Side: true, _p1Cur: 1, _p1PctLabel: () => {}, Math, String };
  vm.runInNewContext(떼기('function _p1Scale(') + ';_p1Scale();', ctx);
  return { paper, a4, cur: ctx._p1Cur };
}
const 칸안 = (r, 칸폭) => { const w = r.paper.style.width; return w === '100%' || parseFloat(w) <= 칸폭; };

test('② 설정 칸이 옆에 있으면 그림은 «그림 칸» 폭 안에 들어간다 — 한 화면·폭 맞춤·직접 크기 모두', () => {
  const 기본 = { 칸폭: 193, 전체폭: 707, 창폭: 1024, 창높이: 800, 그림위: 123, 열: '500px 193px' };
  for (const 모드 of ['fit', 'width', 'custom']) {
    const r = 돌리기({ ...기본, 모드, 퍼센트: 100 });
    assert.ok(칸안(r, 기본.칸폭), `${모드}: 그림(${r.paper.style.width})이 칸(${기본.칸폭}px) 밖으로 나갑니다 — #main 이 가로로 밀립니다`);
  }
});
test('② 한 화면 맞춤이 칸에 «딱» 들어간다 — 테두리(2px)까지 쳐서 칸을 넘지 않는다', () => {
  const r = 돌리기({ 칸폭: 370, 전체폭: 870, 창폭: 1201, 창높이: 1400, 그림위: 123, 열: '500px 370px', 모드: 'fit' });
  assert.ok(parseFloat(r.paper.style.width) <= 370, `칸 370px 에 그림 ${r.paper.style.width}`);
});
test('② 위아래로 쌓인 태블릿 폭에서는 그림 자리가 «화면 맨 위»인 것으로 높이를 잰다 — 설정 칸 아래라고 300px 한도로 쪼그라들지 않는다', () => {
  const 쌓임 = 돌리기({ 칸폭: 883, 전체폭: 883, 창폭: 1024, 창높이: 800, 그림위: 1302, 열: '883px', 모드: 'fit' });
  const 한도 = 300 / 1123;
  assert.ok(쌓임.cur > 한도 + 0.05, `쪼그라든 배율 ${쌓임.cur.toFixed(2)}`);
  assert.ok(칸안(쌓임, 883));
});
test('② 폰(≤520px)은 예전 그대로 — 쌓임 판정은 폰 폭을 뺀다(폰 규칙은 따로 대표가 정한다)', () => {
  assert.match(strip(떼기('function _p1Scale(')), /window\.innerWidth>520/, '폰 폭 제외 조건이 없습니다 — 폰의 그림 크기까지 바뀝니다');
  const 폰 = 돌리기({ 칸폭: 343, 전체폭: 343, 창폭: 375, 창높이: 812, 그림위: 1700, 열: '343px', 모드: 'fit' });
  const 태블릿 = 돌리기({ 칸폭: 343, 전체폭: 343, 창폭: 800, 창높이: 812, 그림위: 1700, 열: '343px', 모드: 'fit' });
  assert.ok(폰.cur < 태블릿.cur, '폰에서도 그림 자리를 맨 위로 쳐서 크기가 달라졌습니다');
});
test('② 그림 칸 폭은 «폭을 칸에 맞춘 뒤» 잰다 — 전체 폭(box.clientWidth)을 먼저 쓰지 않는다', () => {
  const f = strip(떼기('function _p1Scale('));
  const 맞춤 = f.indexOf("paper.style.width='100%'"), 잼 = f.indexOf('paper.offsetWidth');
  assert.ok(맞춤 > 0 && 잼 > 맞춤, '폭을 100% 로 맞추기 전에 재면 직전 폭이 나옵니다');
  assert.doesNotMatch(f, /availW=\(box&&box\.clientWidth\)/, '전체 폭으로 재면 설정 칸 옆에서 그림이 칸 밖으로 나갑니다');
  /* 한 화면·폭 맞춤은 테두리를 뺀 폭(fitW)으로 — 직접 크기는 fitsW 가 그대로 */
  assert.match(f, /Math\.min\(1\.4,\s*fitW\/794\)/); assert.match(f, /Math\.min\(1,\s*fitW\/794,\s*availH\/1123\)/);
});
