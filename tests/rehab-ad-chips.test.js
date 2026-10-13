/* 회생광고 — 지역·공고일 칩이 «눌리는가».
   2026-10-12 대표 「지역 날짜등을 클릭하는데 전혀 클릭이 안먹는다」:
   칩(.fchip)은 #funnelMore 에 그려지는데 클릭 듣개는 #funnel 에만 걸려 있었다 — 눌러도 아무 일이 없었다.
   규칙: 칩이 그려지는 칸마다 클릭 듣개가 있고, 그 듣개가 칩의 data-sido·data-date 를 읽는다.
   실행: node --test tests/rehab-ad-chips.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'rehab-ad.html'), 'utf8');
/* 주석 속 글자에 속지 않는다 */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* 칩을 그려 넣는 칸 — drawFunnel 이 innerHTML 로 채우는 #funnel* 칸들 */
const drawn = [...new Set([...code.matchAll(/\$\('(funnel\w*)'\)\.innerHTML\s*=/g)].map((m) => m[1]))];

test('① 칩을 그리는 칸이 하나 이상 있다', () => {
  assert.ok(drawn.length >= 1, '칩 그리는 칸을 못 찾음 — 이 검사의 찾는 법을 고쳐야 한다');
});

test('② 칩을 그리는 칸마다 클릭 듣개가 걸려 있다', () => {
  for (const id of drawn) {
    const hasListener = code.includes("$('" + id + "').addEventListener('click'");
    assert.ok(hasListener, '#' + id + ' 에 칩을 그리는데 클릭 듣개가 없다 — 칩이 눌려도 반응하지 않는다');
  }
});

test('③ 듣개가 칩의 지역·공고일 값을 읽어 거르개에 넣는다', () => {
  assert.ok(code.includes("hasAttribute('data-sido')"));
  assert.ok(code.includes("hasAttribute('data-date')"));
});

test('④ 칩 단추에 붙인 data- 이름을 듣개가 모두 읽는다', () => {
  const chipAttrs = [...code.matchAll(/class="fchip[^>]*?\sdata-(\w+)=/g)].map((m) => m[1]);
  assert.ok(chipAttrs.length >= 1, '칩의 data- 이름을 못 찾음');
  for (const a of new Set(chipAttrs)) assert.ok(code.includes("hasAttribute('data-" + a + "')"), 'data-' + a + ' 를 읽는 곳이 없다');
});
