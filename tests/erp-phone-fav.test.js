'use strict';
/* 이알피·인사관리·재무관리 폰 — 머리줄 ⭐ 즐겨찾기 (2026-10-18, 대표 「추천대로」)
   양옆 여백을 걷어 목록이 화면 끝까지 오자, 오른쪽 가운데 떠 있는 「즐겨찾기」 손잡이(폰 약 13px)가
   줄 끝 금액·입사일을 덮었다. 폰에서는 손잡이를 숨기고 머리줄 ⭐ 가 같은 목록(PuAppBar.open)을 연다.
   정부지원금(gov.html #mFavBtn)과 같은 길이다.
   (갈무리로 확인: node tools/phone-audit/run.mjs erp hr fin)

   ⚠ «지금 값»(px)이 아니라 «규칙»을 본다. 실행: node --test tests/erp-phone-fav.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const SRC = stripJs(fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'pu-erp.css'), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');

/* 미디어 구간을 걷어 낸 글(= 모든 폭에 걸리는 규칙)과 구간들 */
function split() {
  const blocks = [];
  let out = '', last = 0, m;
  const re = /@media([^{]*)\{/g;
  while ((m = re.exec(CSS))) {
    out += CSS.slice(last, m.index);
    let i = m.index + m[0].length, d = 1;
    for (; i < CSS.length && d > 0; i++) { if (CSS[i] === '{') d++; else if (CSS[i] === '}') d--; }
    blocks.push({ q: m[1], body: CSS.slice(m.index, i) });
    last = i; re.lastIndex = i;
  }
  return { top: out + CSS.slice(last), blocks };
}
const { top: TOP, blocks: BLOCKS } = split();

function favButton() {
  const i = SRC.indexOf("className:'hd-fav'");
  assert.ok(i > 0, '★ 머리줄 ⭐(hd-fav)가 없습니다 — 폰에서 다른 앱으로 건너갈 길이 손잡이뿐입니다');
  const s = SRC.lastIndexOf("h('button'", i);
  return SRC.slice(SRC.lastIndexOf('\n', s), SRC.indexOf("'⭐')", i) + 5);
}

test('★ 머리줄 ⭐ — 폰에서만 그리고, 같은 목록(PuAppBar.open)을 연다 · 열린 채 다시 누르면 닫힌다', () => {
  const b = favButton();
  assert.match(b, /window\.IS_MOBILE\s*&&\s*h\('button'/, '★ ⭐ 는 폰에서만 — PC 는 손잡이가 그대로 있다');
  assert.match(b, /PuAppBar\.open\(/, '★ ⭐ 가 공용 목록을 안 엽니다 — 목록을 두 벌 만들면 한쪽만 고쳐집니다');
  /* 목록은 바깥을 누르는 순간(mousedown) 먼저 닫힌다 — «누르기 시작할 때» 열려 있었는지를 봐야 다시 열지 않는다 */
  assert.match(b, /onPointerDown:[^]*?data-pu-appbar-pop/, '★ 열린 채 ⭐ 를 누르면 닫혔다가 바로 다시 열립니다');
  assert.match(b, /_wasOpen/, '열려 있던 것을 기억하는 표시가 없습니다');
});

test('★ 손잡이는 «⭐ 가 있을 때만» 숨는다 — ⭐ 없이 숨기면 다른 앱으로 갈 길이 없다', () => {
  const all = TOP + BLOCKS.map(b => b.body).join('\n');
  const hides = [...all.matchAll(/([^{}]*\[data-pu-appbar-tab\][^{]*)\{([^}]*)\}/g)].filter(m => /display:\s*none/.test(m[2]));
  assert.ok(hides.length >= 1, '★ 폰에서 손잡이를 숨기는 규칙이 없습니다 — 줄 끝 금액을 덮습니다');
  hides.forEach(function (m) {
    assert.match(m[1], /:has\(\s*\.hd-fav\s*\)/, '★ 손잡이를 «⭐ 와 상관없이» 숨깁니다: ' + m[1].trim());
  });
});

test('좁은 폰 — ⭐ 가 먹은 자리를 왼쪽 단추 여백에서 돌려준다 · 🔄(시계가 앉는 자리)는 그대로 · PC 는 그대로', () => {
  const narrow = BLOCKS.filter(b => { const w = b.q.match(/max-width:\s*(\d+)px/); return w && +w[1] <= 480 && !/min-width/.test(b.q); })
    .map(b => b.body).join('\n');
  const m = narrow.match(/\.hd\s*>\s*button([^{]*)\{([^}]*)\}/);
  assert.ok(m, '★ 좁은 폰에서 머리줄 단추 여백을 줄이는 규칙이 없습니다 — 360px 에서 제목이 「급여…」로 잘립니다');
  assert.match(m[1], /:not\(\.hd-reload\)/, '★ 🔄 까지 좁히면 자동 로그아웃 시계(🚪 왼쪽에 뜬다)가 ⭐ 를 덮습니다');
  assert.match(m[1], /:not\(\.hd-burger\)/, '☰ 는 여백이 0 이다 — 넓히면 안 된다');
  assert.match(SRC, /className:'hd-reload'/, '🔄 단추 이름표(hd-reload)가 없습니다');
  assert.doesNotMatch(TOP, /\.hd\s*>\s*button/, '★ 머리줄 단추 여백 규칙이 폰 구간 밖에 있습니다 — PC 머리줄이 바뀝니다');
});
