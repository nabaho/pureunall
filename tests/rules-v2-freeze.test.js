/* 틀 고정 (대표 지시 2026-10-04 「틀고정」·「대시보드 고정」) — rules-v2.html
   넓은 화면에서 위쪽(모으기 요약·거르개·표 머리)과 📚 의 조 주제 목록은 서 있고, 목록·본문만 제 상자 안에서 스크롤한다.
   🏢 사업장(#sites, 2026-10-04)도 같은 틀 — 거르개·표 머리는 서 있고, 거래처 표·오른쪽 이력이 제 상자에서 스크롤한다.
   «값»(높이 몇 px)이 아니라 «규칙»을 본다:
   ① 바깥 상자에 overflow:hidden 이 없다 — 있으면 안쪽 sticky 가 통째로 죽는다(이번 고장의 뿌리)
   ② 표 머리가 sticky ③ 표·📚 본문·주제 목록이 제 상자에서 스크롤 ④ 머리줄 높이를 재서 쓴다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'rules-v2.html'), 'utf8');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1].replace(/\/\*[\s\S]*?\*\//g, ' ');
function rulesFor(sel) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (m[1].split(',').map((s) => s.trim()).some((s) => s === sel)) out.push(m[2]);
  }
  return out.join(';');
}
const desk = (() => {
  const i = css.search(/@media\s*\(min-width:\s*\d+px\)\s*\{/);
  assert.ok(i >= 0, '넓은 화면용 틀 고정 묶음(@media min-width)이 없다');
  let d = 0, j = css.indexOf('{', i);
  for (; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}' && --d === 0) break; }
  return css.slice(css.indexOf('{', i) + 1, j);
})();
/* 넓은 화면 묶음 안에서 그 선택자가 든 규칙들 — 몇 개를 묶어 적었든(#lib,#topics,#sites{…}) 상관없이 */
function deskFor(sel) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(desk))) {
    if (m[1].split(',').map((s) => s.trim()).some((s) => s === sel)) out.push(m[2]);
  }
  return out.join(';');
}
const BOXES = ['#lib', '#topics', '#sites'];

test('① 바깥 상자(#lib·#topics·#sites)가 스크롤 상자를 만들지 않는다 — overflow:hidden 이면 안쪽 고정이 죽는다', () => {
  BOXES.forEach((s) => {
    assert.doesNotMatch(rulesFor(s), /overflow\s*:\s*hidden/, '★ ' + s + ' 에 overflow:hidden — 틀 고정이 안 먹는다');
    assert.match(rulesFor(s), /overflow\s*:\s*clip/, s + ' — 둥근 모서리는 clip 으로 지킨다');
  });
});

test('② 표 머리가 붙어 서고 ③ 목록·본문이 제 상자에서 스크롤한다(넓은 화면)', () => {
  assert.match(desk, /#lib \.lib th\{[^}]*position:sticky/, '★ 표 머리 고정이 없다');
  assert.match(desk, /#lib \.tbl\{[^}]*overflow:auto/, '★ 표가 제 상자에서 스크롤하지 않는다');
  assert.match(desk, /#topics \.main\{[^}]*overflow-y:auto/, '★ 📚 본문이 제 상자에서 스크롤하지 않는다');
  BOXES.forEach((s) => assert.match(deskFor(s), /height:calc\(100vh - var\(--toph/, s + ' — 상자 높이는 «머리줄 아래 남은 화면»'));
});

test('② 🏢 사업장도 — 표 머리가 서고, 거래처 표·오른쪽 이력이 제 상자에서 스크롤한다(넓은 화면)', () => {
  assert.match(deskFor('#sites .sites th'), /position:sticky/, '★ 사업장 표 머리 고정이 없다');
  assert.match(deskFor('#sites .stbl'), /overflow:auto/, '★ 사업장 표가 제 상자에서 스크롤하지 않는다');
  assert.match(deskFor('#sites .sside'), /overflow:auto/, '★ 오른쪽 이력이 제 상자에서 스크롤하지 않는다');
});

test('④ 머리줄 높이를 재서 --toph 에 넣는다(머리줄이 두 줄이 되는 폭에서도 맞게)', () => {
  const bare = html.replace(/<!--[\s\S]*?-->/g, ' ');
  assert.match(bare, /setProperty\(["']--toph["']/);
  assert.match(bare, /addEventListener\(["']resize["']/);
});
