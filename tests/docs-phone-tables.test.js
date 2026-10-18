/* 계약서등관리 — 폰에서 «옆으로 밀지 않고» 보이는 두 표 (대표 지시 2026-10-18 「좌우 옆공간 모두 채워서」)
 *
 * ★ 둘째 판 뒤에도 «옆으로 밀어야 보이던» 표 둘 (docs/폰화면-현황.md ㉢)
 *   ① 원본 보관함 — 여덟 칸 표가 640px 최소폭에 걸려 「올린 날·📥」 가 화면 밖이었다. ☐ 도 13px 였다
 *   ② 집단체불 사건 목록 — 640px 표라 제출·상태·생성일이 화면 밖이었고, 사건명이 세 줄로 접혔다
 *
 * ★ 무엇을 못 박나 — 지금 px 이 아니라 규칙
 *   · 원본 보관함: 폰이면 «미리보기를 열었을 때»와 같은 좁은 꼴(.cp)로 그린다 · 그 꼴에서 5번째 칸(📥)은 폰에서도 보인다
 *     · 표 최소폭을 푼다 · ☐ 는 손가락으로 누를 최소 크기(24px — WCAG 2.5.8, 그 수 자체가 규칙) 이상
 *   · 사건 목록: 폰 구간에서만 «줄마다 두 줄 카드»(grid) · 표 머리는 숨김 · 최소폭 해제 · 사건명은 …로 줄이고 title 에 전문
 *   ⚠ 넓은 화면은 그대로 표다 — 전부 폰 구간(700px 이하)에서만 바꾼다
 *
 * 실행: node --test tests/docs-phone-tables.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const OFFICE = read('js/pu-office-docs.js');
const HTML = read('docs-esign.html');
const MIN_TAP = 24;   // WCAG 2.5.8 «누를 것의 최소 크기» — 이 수 자체가 규칙이다(지금 값이 아니다)

function cssBare(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ' '); }
/* 폭 700px 이하 @media 덩어리만 모은다(괄호 짝을 세어 자른다) */
function phoneOf(css) {
  let phone = '';
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let d = 1, j = re.lastIndex;
    for (; j < css.length && d; j++) { if (css[j] === '{') d++; else if (css[j] === '}') d--; }
    if (+m[1] <= 760) phone += css.slice(re.lastIndex, j - 1) + '\n';
    re.lastIndex = j;
  }
  return phone;
}
/* 선택자(쉼표로 가른 것 가운데 하나)가 test 에 맞는 규칙 몸통들을 이어 붙인다 */
function bodyOf(css, test_) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((r) => r[1].split(',').some((s) => test_(s.trim()))).map((r) => r[2]).join(';');
}
const px = (body, prop) => { const m = body.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*(\\d+(?:\\.\\d+)?)px')); return m ? +m[1] : 0; };

/* 모듈 CSS — 이어 붙인 글자 식을 그대로 계산한다 */
function officeCss() {
  const m = OFFICE.match(/var CSS = ('' *\n[\s\S]*?);\n {2}function css\(\)/);
  assert.ok(m, 'js/pu-office-docs.js 에서 CSS 묶음(var CSS = …;)을 못 찾았습니다 — 이 검사의 찾는 법을 고쳐 주세요');
  return new Function('return ' + m[1])();
}
const OP = phoneOf(officeCss());
const HP = phoneOf(cssBare(((HTML.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '')));

test('① 원본 보관함 — 폰이면 좁은 꼴(.cp)로 그리고, 그 꼴에서 📥 칸이 폰에서도 보인다', () => {
  assert.match(OFFICE, /var compact = [^;]*matchMedia\(\s*'\(max-width:\d+px\)'\s*\)\.matches/, '원본 보관함이 폰 폭을 보고 좁은 꼴(compact)을 고르지 않습니다 — 여덟 칸 표가 다시 옆으로 밀립니다');
  assert.match(OFFICE, /'class': compact \? 'pod-arc-scroll cp'/, '좁은 꼴일 때 표 상자에 .cp 이름이 안 붙습니다 — 폰 CSS 가 먹지 않습니다');
  const show = bodyOf(OP, (s) => /^\.pod-arc-scroll\.cp td:nth-child\(5\)$/.test(s));
  assert.match(show, /display\s*:\s*table-cell/, '좁은 꼴의 5번째 칸(📥)이 폰에서 숨은 채입니다 — 넓은 표용 「5번째 칸 숨김」 규칙이 먼저 걸립니다');
});

test('② 원본 보관함 — 폰에서 표 최소폭을 풀고, ☐ 는 손가락으로 누를 크기 이상', () => {
  const rel = bodyOf(HP, (s) => /^#paneArc\s+\.pod-arc-scroll\s+table$/.test(s));
  assert.match(rel, /min-width\s*:\s*0\b/, '폰 구간에서 원본 보관함 표의 최소폭을 풀지 않습니다 — 공통 「table{min-width:…}」 에 걸려 옆으로 밀립니다');
  const cb = bodyOf(OP, (s) => /^\.pod-arc-scroll\.cp input\[type=checkbox\]$/.test(s));
  assert.ok(px(cb, 'width') >= MIN_TAP && px(cb, 'height') >= MIN_TAP, '원본 보관함 ☐ 가 ' + MIN_TAP + 'px 보다 작습니다');
});

test('③ 사건 목록 — 폰 구간에서만 «줄마다 두 줄 카드»(grid) · 표 머리 숨김 · 최소폭 해제', () => {
  const tr = bodyOf(HP, (s) => s === '#viewList tbody tr');
  assert.match(tr, /display\s*:\s*grid/, '폰 구간에 사건 목록 줄(tr)을 카드(grid)로 바꾸는 규칙이 없습니다 — 640px 표가 옆으로 밀립니다');
  assert.match(bodyOf(HP, (s) => s === '#viewList thead'), /display\s*:\s*none/, '카드로 바꿨는데 표 머리가 남아 있습니다');
  assert.match(bodyOf(HP, (s) => s === '#viewList table'), /min-width\s*:\s*0\b/, '사건 목록 표 최소폭을 풀지 않았습니다');
  /* 넓은 화면은 그대로 — 카드 규칙이 폰 구간 밖에 새면 안 된다 */
  const wide = cssBare(((HTML.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '')).replace(/@media\s*\([^)]*\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
  assert.ok(!/#viewList\s+tbody\s+tr\s*\{[^}]*display\s*:\s*grid/.test(wide), '사건 목록 카드(grid) 규칙이 폰 구간 «밖»에 있습니다 — PC 표가 깨집니다');
});

test('④ 사건 목록 — 줄여 보이는 사건명에는 전문이 title 로 따라간다', () => {
  const m = HTML.match(/function renderCaseList\(\)[\s\S]*?\n\}/);
  assert.ok(m, 'renderCaseList 를 못 찾았습니다 — 이 검사의 찾는 법을 고쳐 주세요');
  assert.match(m[0], /openCase\([^)]*\)"? title="/, '사건명 링크에 title(전문)이 없습니다 — 폰에서 …로 줄어든 이름을 끝까지 볼 길이 없습니다');
  /* 사건명 칸(1번째)은 …로 줄이고, 사건 목록의 곁들이 값은 한 줄 */
  const td = bodyOf(HP, (s) => s === '#viewList tbody td');
  assert.match(td, /white-space\s*:\s*nowrap/, '사건 목록 칸이 한 줄이 아닙니다(「한 칸은 한 줄」 규칙)');
  assert.match(td, /text-overflow\s*:\s*ellipsis/, '넘치는 칸을 …로 줄이지 않습니다');
});
