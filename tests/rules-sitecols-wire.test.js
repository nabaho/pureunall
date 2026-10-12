/* rules-v2.html 꽂기 (설계 §12-4) — 손잡이 이름들 · 거르개·담당·검색어를 바꾸면 1쪽 · 쪽 누르면 표 맨 위 · 캐시 번호 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');
const HTML = stripComments(fs.readFileSync(path.join(__dirname, '../rules-v2.html'), 'utf8'));
const HSTART = HTML.indexOf('var H = {');
const H = HTML.slice(HSTART, HTML.indexOf('\n};', HSTART));
/* 손잡이 한 개의 몸통 — «이름: function» 에서 다음 손잡이(두 칸 들여쓴 «이름: function») 앞까지 */
const fn = (k) => {
  const i = H.indexOf('\n  ' + k + ': function');
  assert.ok(i >= 0, k + ' 손잡이');
  const rest = H.slice(i + 1);
  const m = /\n {2}[A-Za-z_$][\w$]*: function/.exec(rest.slice(1));
  return m ? rest.slice(0, m.index + 1) : rest;
};

test('새 스크립트는 캐시 번호를 달고 lib-sites 뒤·view-sites 앞에', () => {
  const re = /<script src="js\/rules-v2\/lib-sitecols\.js\?v=\d+"><\/script>/;
  assert.match(HTML, re);
  assert.ok(HTML.search(re) > HTML.indexOf('js/rules-v2/lib-sites.js'));
  assert.ok(HTML.search(re) < HTML.indexOf('js/rules-v2/view-sites.js'));
});

test('상태 — cols·sort·page·pop 이 ST.sites 에 있다', () => {
  const t0 = HTML.indexOf('var ST = {');
  assert.ok(t0 >= 0, 'ST 첫 값');
  const i = HTML.indexOf('sites: {', t0);
  assert.ok(i >= 0, 'ST.sites');
  const st = HTML.slice(i, HTML.indexOf('staff:', i));
  assert.ok(st.length > 10);
  ['cols', 'sort', 'page', 'pop'].forEach((k) => assert.match(st, new RegExp('\\b' + k + '\\b'), k));
});

test('손잡이 — 열기·순서·체크·풀기·쪽', () => {
  ['colOpen', 'colSort', 'colToggle', 'colClear', 'colsClear', 'colClose', 'colWho', 'colq', 'pageGo'].forEach(fn);
  assert.match(fn('colOpen'), /getBoundingClientRect\(/);
  assert.match(fn('pageGo'), /scrollTop\s*=\s*0/);
});

test('창 닫기는 늘 비우고 다시 그린다 — 그림이 «열려 있을 때만» 부른다', () => {
  const b = fn('colClose');
  assert.match(b, /\.pop\s*=\s*["']{2}/);
  assert.match(b, /\.popq\s*=\s*["']{2}/);
  assert.match(b, /draw\(\)/);
  assert.doesNotMatch(b, /\bif\b/, 'colClose 는 조건 없이 다시 그린다');
});

test('조건을 바꾸면 1쪽으로 — 칩·담당·검색·거르기·순서', () => {
  ['siteF', 'sq', 'sm', 'colToggle', 'colSort', 'colClear', 'colsClear', 'colWho'].forEach((k) => {
    assert.match(fn(k), /\.page\s*=\s*1/, k + ' 가 쪽을 1로 돌린다');
  });
});

test('고르기·새로고침은 쪽을 건드리지 않는다 (없는 쪽은 그리는 쪽이 당긴다)', () => {
  assert.doesNotMatch(fn('siteSel'), /\.page\s*=/);
  const m = HTML.match(/function reload\(\)[\s\S]*?\r?\n\}/);
  assert.ok(m, 'reload()');
  assert.doesNotMatch(m[0], /\.page\s*=/);
});

test('순서 단추를 같은 방향으로 다시 누르면 순서가 풀린다', () => {
  assert.match(fn('colSort'), /\.sort\s*=[^;]*\?\s*null\s*:/);
});

/* CSS 한 규칙의 몸통 — 선택자로 찾는다 */
const rule = (sel) => {
  const i = HTML.indexOf(sel + '{');
  assert.ok(i >= 0, sel + ' 규칙');
  return HTML.slice(i, HTML.indexOf('}', i));
};

test('쪽 막대는 좁은 폭에서 줄을 바꿔 흰 상자 안에 남는다', () => {
  assert.match(rule('#sites .pager'), /flex-wrap:\s*wrap/);
  const info = rule('#sites .pager .info');
  assert.match(info, /flex:\s*1 1 auto/);
  assert.doesNotMatch(info, /white-space:\s*nowrap/, '안내 글이 한 줄을 강요하지 않는다');
  assert.match(HTML, /@media \(max-width:\s*900px\)\{#sites \.pager \.info\{flex-basis:\s*100%/);
});

test('머리줄 창은 위쪽 띠·머리보다 위, 모달 베일보다 아래', () => {
  const z = (r) => Number(/z-index:\s*(\d+)/.exec(r)[1]);
  const pop = z(rule('.cpop'));
  assert.ok(pop > z(rule('.top')), '위쪽 띠보다 위');
  assert.ok(pop < z(rule('.veil')), '모달 베일보다 아래');
});

test('한 칸은 한 줄 — 머리 단추·창 목록 글은 넘치면 … 로 줄인다', () => {
  assert.match(rule('#sites th.ch .h'), /overflow:\s*hidden/);
  ['#sites th.ch .h .lb', '.cpop label .t,.cpop .wo .t'].forEach((sel) => {
    const r = rule(sel);
    assert.match(r, /white-space:\s*nowrap/, sel);
    assert.match(r, /text-overflow:\s*ellipsis/, sel);
    assert.match(r, /overflow:\s*hidden/, sel);
    assert.match(r, /min-width:\s*0/, sel);
  });
});

test('순서 열쇠가 없는 칸을 누르면 아무 일도 안 한다', () => {
  assert.match(fn('colSort'), /if\s*\(\s*!sk\s*\)\s*return/);
});

test('창 목록은 체크·찾기로 다시 그려도 읽던 자리를 지킨다', () => {
  const d = HTML.match(/function drawKeepList\(\)[\s\S]*?\r?\n\}/);
  assert.ok(d, 'drawKeepList');
  assert.match(d[0], /scrollTop/);
  assert.match(fn('colToggle'), /drawKeepList\(\)/);
  assert.match(fn('colq'), /drawKeepList\(\)/);
});

test('창은 아래 화면 밖으로 밀려 나가지 않게 세로도 눌러 둔다', () => {
  assert.match(fn('colOpen'), /innerHeight/);
});
