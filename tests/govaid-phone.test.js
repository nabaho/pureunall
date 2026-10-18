'use strict';
/* 정부지원금(pu-govaid.html) — 폰화면관리 (대표 지시 2026-10-18 「폰화면관리」)

   폰 폭(360px)에서 가짜 자료로 그려 보고 찾은 것을 «규칙»으로 지킨다(px 값은 박지 않는다):
   ① 늘 붙어 다니는 머리가 여섯 줄(이름·부제·나/단추·탭 세 줄)이었다 → 머리 한 줄(부제 숨김) + 탭은 옆으로 미는 한 줄
   ② ☐ 고르기 칸이 손가락보다 작았다 → 폰에서 키운다(☐ 칸은 빼지 않는다)
   ③ 찾기 칸이 고르기 칸에 눌려 한 글자 폭이었다 → 찾기는 한 줄을 다 쓴다
   ④ 한눈 표 — 붙박이 사업장 칸이 폭을 다 먹었다 → 폰에서 줄인다
   ⑤ 목록·상세가 위아래로 쌓이는 폭에서는 고른 회사·사업의 상세로 내려 준다(넓은 화면은 그대로)
   ★ 폰 규칙은 760px 이하 덩이 안 — PC 는 그대로. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-govaid.html'), 'utf8');
/* <style> 안만 — 머리 HTML 주석의 글자가 CSS 주석 걷기를 엉뚱하게 시작시키지 않게 */
const CSS = SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');

function mediaBlocks(css) {
  const out = [];
  let at = 0;
  for (;;) {
    const m = css.indexOf('@media', at);
    if (m < 0) break;
    const open = css.indexOf('{', m);
    let d = 0, i = open;
    for (; i < css.length; i++) { if (css[i] === '{') d++; else if (css[i] === '}') { d--; if (!d) break; } }
    out.push({ q: css.slice(m + 6, open).trim(), body: css.slice(open + 1, i) });
    at = i + 1;
  }
  return out;
}
const BLOCKS = mediaBlocks(CSS);
const maxW = (q) => { const m = q.match(/max-width:\s*(\d+)px/); return m && !/min-width/.test(q) ? +m[1] : null; };
const rules = (body) => body.split('}').map((r) => r.split('{')).filter((x) => x.length === 2).map(([sel, decl]) => ({ sel: sel.trim(), decl }));
function phoneHas(selRe, declRe, why) {
  const hit = BLOCKS.filter((b) => maxW(b.q) !== null && maxW(b.q) <= 768).some((b) => rules(b.body).some((r) => selRe.test(r.sel) && declRe.test(r.decl)));
  assert.ok(hit, why);
}
const TOP = (() => { let s = CSS; BLOCKS.forEach((b) => { s = s.replace(b.body, ''); }); return s; })();
function topLacks(selRe, declRe, why) {
  assert.ok(!rules(TOP).some((r) => selRe.test(r.sel) && declRe.test(r.decl)), why);
}

test('① 머리 한 줄 + 탭은 옆으로 미는 한 줄 — 부제는 폰에서만 숨긴다', () => {
  phoneHas(/^\.top$/, /flex-wrap:\s*nowrap/, '폰 머리가 여러 줄로 접힙니다');
  phoneHas(/^\.top \.sub$/, /display:\s*none/, '폰에서 부제가 한 줄을 먹습니다');
  phoneHas(/^#who$/, /text-overflow:\s*ellipsis/, '«나» 글이 줄어들지 않아 단추를 밀어냅니다');
  phoneHas(/^\.tabs$/, /flex-wrap:\s*nowrap/, '탭이 세 줄로 접힙니다');
  phoneHas(/^\.tabs$/, /overflow-x:\s*auto/, '한 줄 탭을 옆으로 밀 수 없습니다 — 끝의 탭·★ 스위치에 못 갑니다');
  phoneHas(/^\.tabs button$/, /flex-shrink:\s*0/, '탭 글자가 눌려 잘립니다');
  topLacks(/^\.top \.sub$/, /display:\s*none/, 'PC 에서도 부제가 숨었습니다');
  topLacks(/^\.tabs$/, /flex-wrap:\s*nowrap/, 'PC 탭까지 한 줄로 바뀌었습니다');
});

test('② ☐ 고르기 칸은 폰에서 손가락 크기 — 목록 칸도 그만큼 넓다', () => {
  const r = BLOCKS.filter((b) => maxW(b.q) !== null && maxW(b.q) <= 768).flatMap((b) => rules(b.body))
    .find((x) => /#coList input\[type=checkbox\]/.test(x.sel) && /td\.c input\[type=checkbox\]/.test(x.sel));
  assert.ok(r, '폰에서 ☐(회사 목록·표) 크기 규칙이 없습니다');
  const w = +(r.decl.match(/width:\s*(\d+)px/) || [])[1];
  assert.ok(w >= 18, '폰 ☐ 가 손가락보다 작습니다(18px 미만)');
  /* 회사 목록 줄의 ☐ 칸 폭이 ☐ 보다 좁으면 겹친다 */
  const g = BLOCKS.filter((b) => maxW(b.q) !== null && maxW(b.q) <= 768).flatMap((b) => rules(b.body))
    .find((x) => /\.li\.co-row/.test(x.sel) && /grid-template-columns/.test(x.decl));
  assert.ok(g, '폰 회사 목록 칸 나눔이 없습니다');
  assert.ok(+(g.decl.match(/grid-template-columns:\s*(\d+)px/) || [])[1] >= w, '회사 목록 ☐ 칸이 ☐ 보다 좁습니다');
  /* ☐ 를 폰에서 숨기면 안 된다(자료 목록의 맨 왼쪽은 ☐ + 번호) */
  assert.ok(!BLOCKS.flatMap((b) => rules(b.body)).some((x) => /(td|th)\.c\b|input\[data-ck\]|#coList input/.test(x.sel) && /display:\s*none/.test(x.decl)), '폰에서 ☐ 를 숨겼습니다');
});

test('③ 찾기 칸은 폰에서 한 줄을 다 쓴다(고르기 칸에 눌려 한 글자 폭이 되지 않게)', () => {
  phoneHas(/^\.bar input\[type=search\]$/, /flex:\s*1 1 100%/, '찾기 칸이 고르기 칸 옆에 눌립니다');
  /* 인라인 max-width(280px 등)를 이겨야 한다 */
  phoneHas(/^\.bar input\[type=search\]$/, /max-width:\s*none\s*!important/, '찾기 칸의 인라인 최대 폭을 못 이깁니다');
});

test('④ 한눈 표 — 폰에서 붙박이 사업장 칸에 최대 폭', () => {
  phoneHas(/^table\.mx \.stk$/, /max-width:/, '폰에서 사업장 칸이 폭을 다 먹어 사업 칸(●)이 화면 밖입니다');
  /* 줄어든 이름은 … + 말풍선 — td 공통 규칙이 … 를 준다 */
  assert.ok(rules(TOP).some((r) => /table\.t td$/.test(r.sel) && /text-overflow:\s*ellipsis/.test(r.decl)), '표 칸에 … 가 없습니다');
});

test('⑤ 쌓이는 폭에서만 고른 상세로 내려 준다 — 넓은 화면·입력칸 누르기는 그대로', () => {
  const at = SRC.indexOf('function pickedShow(');
  assert.ok(at >= 0, 'pickedShow 가 없습니다');
  let d = 0, i = SRC.indexOf('{', at);
  for (; i < SRC.length; i++) { if (SRC[i] === '{') d++; else if (SRC[i] === '}') { d--; if (!d) break; } }
  const fn = SRC.slice(at, i + 1);
  /* 그 폭이 정말 «쌓이는» 폭인가 — .split 한 칸 규칙의 최대 폭과 같아야 한다 */
  const q = (fn.match(/matchMedia\('\(max-width:(\d+)px\)'\)/) || [])[1];
  const split = BLOCKS.find((b) => rules(b.body).some((r) => /\.split/.test(r.sel) && /grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(r.decl)));
  assert.ok(q && split && +q === maxW(split.q), '내려 주는 폭이 목록·상세가 쌓이는 폭과 다릅니다');
  function run(narrow) {
    const log = [];
    const ctx = { window: { matchMedia: () => ({ matches: narrow }) }, $: (id) => ({ scrollIntoView: () => log.push(id) }) };
    vm.createContext(ctx);
    vm.runInContext(fn + '; pickedShow("coDetail");', ctx);
    return log;
  }
  assert.deepStrictEqual(run(true), ['coDetail'], '폰에서 고른 회사의 상세로 내려 주지 않습니다');
  assert.deepStrictEqual(run(false), [], '넓은 화면에서도 화면을 움직입니다');
  /* 회사·사업을 «고를 때만» 부른다 — ☐ 누르기(input)는 클릭 처리 맨 앞에서 돌아간다 */
  assert.match(SRC, /CUR_CO=b\.getAttribute\('data-co'\);[^\n]*draw\(\);\s*pickedShow\('coDetail'\)/, '회사를 고를 때 상세로 내려 주지 않습니다');
  assert.match(SRC, /CUR_PROG=b\.getAttribute\('data-pg'\);[^\n]*draw\(\);\s*pickedShow\('pDetail'\)/, '사업을 고를 때 상세로 내려 주지 않습니다');
  assert.match(SRC, /addEventListener\('click', function\(e\)\{\s*var t=e\.target, b;\s*if\(t\.closest\('input'\)\) return;/, '☐ 를 눌러도 상세로 내려가게 됐습니다(클릭 처리 맨 앞의 input 거르기)');
  /* 붙박이 머리에 가리지 않게 상세 위에 여백 */
  phoneHas(/#coDetail,#pDetail/, /scroll-margin-top/, '내려 준 상세의 머리가 붙박이 머리에 가립니다');
});
