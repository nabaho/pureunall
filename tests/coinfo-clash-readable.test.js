/* ══════ 「값이 어떻게 다른지 모르겠다」 (대표 보고 2026-09-15) ═══════════════════
   대표가 「값이 다른 칸 — 24개 · 7곳」 창을 열고 하신 말씀이다.

   ■ 무엇이 문제였나 — 실측(창 560px)
     회사 180 + 칸 74 + 단추 159 + 사이 27 = **440px 이 고정**이라,
     정작 이 창의 «전부»인 값에 **70px** 밖에 안 갔다 — 두 값이 각각 23px·22px.
     화면에는 「변. → 안.」 「삼. → 삼」 처럼 **두 글자**만 보였다.

   ★ 셋을 함께 못 박는다 — 하나만으로는 모자란다
     ① 창을 넓힌다(이 창만). 다른 창까지 넓히면 눈이 좌우로 흔들린다.
     ② 회사·칸이 «줄어들 수 있어야» 한다. 고정 폭이 값을 굶긴 원인이다.
     ③⚠ **다른 자리를 짚어 준다.** 자리가 넓어져도 「충청남도 천안시…」와
        「충남 천안시…」를 눈으로 견주는 것은 여전히 일이다.
        ⚠⚠ 앞뒤만 깎으면 모자란다 — 그 주소 쌍은 앞이 「충」 한 글자, 뒤가 0 글자라
          **거의 전부가 굵어진다.** 굵은 것이 전부면 아무것도 안 짚은 것과 같다.
          그래서 «낱말»로 먼저 맞추고, 한 낱말 대 한 낱말인 자리는 그 안에서 또 깎는다.

   node --test tests/coinfo-clash-readable.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

function load() {
  const ctx = { console, Object, Array, String, Number, Math, RegExp,
    esc: s => String(s == null ? '' : s)
      .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])) };
  vm.createContext(ctx);
  vm.runInContext([
    cutFn(SRC, 'function coDiffParts('), cutFn(SRC, 'function coDiffTokens('),
    cutFn(SRC, 'function coDiffAlign('), cutFn(SRC, 'function coDiffMark(')
  ].join('\n'), ctx);
  return ctx;
}
/* 굵은 자리를 눈에 보이게 바꿔 견준다 */
const 표 = h => String(h).split('<b>').join('【').split('</b>').join('】');

/* ── ③ 다른 자리를 짚는다 ────────────────────────────────────────────── */

test('★★★ 낱말이 같은 곳은 «안» 굵다 — 주소에서 바뀐 낱말만 짚는다', () => {
  const c = load();
  const d = c.coDiffMark('충청남도 천안시 동남구 병천면 야운대로 123',
                         '충남 천안시 동남구 병천면 야운대로 123-4');
  assert.equal(표(d.a), '충【청남도】 천안시 동남구 병천면 야운대로 123');
  assert.equal(표(d.b), '충【남】 천안시 동남구 병천면 야운대로 123【-4】');
  /* ⚠ 이것이 앞뒤만 깎던 옛 방식과 갈리는 자리다 — 그때는 「청남도 천안시 … 123」이
     통째로 굵었다(굵은 것이 전부면 아무것도 안 짚은 것과 같다). */
  assert.ok(표(d.a).indexOf('【청남도 천안시') < 0,
    '★★★ 같은 낱말까지 굵으면 어디가 다른지 여전히 모른다');
});

test('★★★ 한 낱말 대 한 낱말이면 그 «안»에서 또 깎는다 — 숫자가 이것이다', () => {
  const c = load();
  const d = c.coDiffMark('9,876,543,210', '9,876,540,000');
  assert.equal(표(d.a), '9,876,54【3,21】0');
  assert.equal(표(d.b), '9,876,54【0,00】0',
    '★★★ 통째로 굵으면 열 자리 숫자에서 어느 자리가 바뀌었는지 못 찾는다');
});

test('★★ 아예 다른 값이면 통째로 굵다 — 짚을 «같은 곳»이 없다', () => {
  const c = load();
  const d = c.coDiffMark('변영준', '안정희');
  assert.equal(표(d.a), '【변영준】');
  assert.equal(표(d.b), '【안정희】');
});

test('★★ 한쪽에만 있는 낱말도 짚는다 — 「주식회사」가 붙고 떨어지는 일이 흔하다', () => {
  const c = load();
  const d = c.coDiffMark('삼성검수 주식회사', '삼성검수');
  assert.equal(표(d.a), '삼성검수【 주식회사】');
  assert.equal(표(d.b), '삼성검수', '★★ 없는 쪽에는 굵을 것이 없다');
});

test('★ 빈 값도 말이 된다 — 「(비어 있음)」이라고 적는다', () => {
  const c = load();
  assert.equal(표(c.coDiffMark('', '새 값').a), '(비어 있음)');
  assert.equal(표(c.coDiffMark('', '새 값').b), '【새 값】');
});

test('★★★ 적힌 글의 꺾쇠가 «태그로» 새지 않는다 — 조각마다 esc 한다', () => {
  const c = load();
  const d = c.coDiffMark('<b>가</b>', '<i>나</i>');
  assert.ok(d.a.indexOf('<b>가</b>') < 0 || /&lt;b&gt;/.test(d.a),
    '★★★ 적은 글이 태그로 새면 화면이 깨진다');
  assert.match(d.a, /&lt;/);
});

/* ── 낱말 맞추기 자체 ─────────────────────────────────────────────────── */

test('★★ 빈칸도 낱말로 센다 — 안 세면 붙여 쓴 글이 한 덩이가 된다', () => {
  const c = load();
  assert.deepEqual(Array.from(c.coDiffTokens('가 나  다')), ['가',' ','나','  ','다']);
  assert.deepEqual(Array.from(c.coDiffTokens('')), []);
});

test('★★ 같은 낱말은 «차례가 밀려도» 찾아낸다', () => {
  const c = load();
  const seg = Array.from(c.coDiffAlign(['가',' ','나'], ['다',' ','나']));
  const 같은것 = seg.filter(s => s.same).map(s => s.a).join('|');
  assert.ok(같은것.indexOf('나') >= 0, '★★ 뒤에 있는 같은 낱말을 못 찾으면 통째로 굵어진다');
});

test('★ 앞뒤 깎기는 겹쳐 세지 않는다 — 「가」와 「가가」에서 가운데가 사라지면 안 된다', () => {
  const c = load();
  const d = c.coDiffParts('가', '가가');
  assert.equal(d.pre + d.aMid + d.post, '가');
  assert.equal(d.pre + d.bMid + d.post, '가가');
});

/* ── ①② 자리 ────────────────────────────────────────────────────────── */

test('★★★ ① 이 창은 «넓게» 연다 — 보통 폭에서는 값에 70px 밖에 안 간다', () => {
  assert.match(cutFn(SRC, 'function openCoClash('), /showWidePanel\(/,
    '★★★ 좁은 창에서는 두 글자만 보인다 — 대표가 보신 그 화면이다');
  assert.match(SRC, /\.modal\.wide\{max-width:min\(/,
    '★★ 넓은 창 규칙이 없다');
});

test('★★ 넓은 창은 «부른 쪽»이 정한다 — 글귀를 보고 짐작하지 않는다', () => {
  const fn = cutFn(SRC, 'function showPanel(');
  assert.match(fn, /classList\.toggle\('wide', _panelWide\)/);
  assert.match(fn, /_panelWide = false;/,
    '★★★ 한 번 쓰고 안 되돌리면 그 뒤로 여는 «모든» 창이 넓어진다');
  /* ⚠ 「어떤 글귀가 없다」로 보지 «않는다» — 「이렇게 하지 말 것」이라고 적어 둔
     주석의 글귀에 제 검사가 걸린다(2026-09-15에 실제로 걸렸다).
     뜻하는 바를 그대로 적는다: 창의 «글»을 들여다보지 않는다. */
  assert.ok(!/html\.(indexOf|includes|match|test)/.test(fn),
    '★★ 글귀로 짐작하면 다음에 글귀를 다듬는 순간 조용히 좁아진다');
});

test('★★★ ② 회사·칸이 «줄어들 수 있다» — 고정 폭이 값을 굶긴 원인이다', () => {
  const css = SRC.slice(SRC.indexOf('.coclashrow .cc{'), SRC.indexOf('.coclashrow .cb{'));
  assert.ok(!/width:180px;flex:none/.test(css), '★★★ 회사가 180px 로 다시 굳었다');
  assert.match(css, /\.coclashrow \.cc\{flex:0 1 /, '★★ 회사가 줄어들 수 없다');
  assert.match(css, /\.coclashrow \.cf\{flex:0 1 /, '★★ 칸이 줄어들 수 없다');
});

test('★★★ 값에 «max-width 를 다시 걸지» 않았다 — 그것이 값을 굶긴 줄이다', () => {
  const css = SRC.slice(SRC.indexOf('.coclashrow .cv{'), SRC.indexOf('.coclashrow .cb{'));
  assert.ok(!/max-width:\s*\d+%/.test(css),
    '★★★ 46% 를 도로 걸면 두 값이 다시 23px 로 쪼그라든다');
  assert.match(css, /-webkit-line-clamp:2/,
    '★★ 한 줄로 자르면 정작 다른 자리가 … 뒤로 숨는다');
});

test('★★ 줄이 «다른 자리 짚기»를 실제로 쓴다 — 만들어 놓고 안 쓰면 소용없다', () => {
  assert.match(cutFn(SRC, 'function coClashRowHtml('), /coDiffMark\(/,
    '★★★ 줄이 그냥 esc 로만 그리면 굵은 자리가 하나도 안 생긴다');
});
