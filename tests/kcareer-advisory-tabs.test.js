'use strict';
/* 🏢 자문·고문 — 진행 · 종료 탭 (대표 지시 2026-09-29 「자문고문은 진행과 종료를 분리해서 탭으로 만들어 달라」)
   못 박는 것:
     ① 진행·종료·전체 세 탭 — 처음은 «진행», 고른 탭은 이 기기에 기억한다
     ② 탭은 «목록»만 가린다 — 지원서 문장·내보내기 가리기는 전부를 본다(종료한 곳도 실적이다)
     ③ 탭마다 수를 보여 준다 · 배제(excluded)는 세지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
function 세상(저장, 자료) {
  const 칸 = { innerHTML: '' }, 그림 = [];
  const ctx = { NS: 'x_', LS: { get: (k) => 저장[k], set: (k, v) => { 저장[k] = v; } }, String,
    get: () => 자료, document: { getElementById: (id) => (id === 'advTabs' ? 칸 : null) },
    renderCareer: (n) => 그림.push(n) };
  vm.createContext(ctx);
  vm.runInContext(SRC.match(/var ADV_TABS=[^\n]*\n/)[0] + ['function advTab(', 'function advTabHas(', 'function setAdvTab(', 'function advTabsDraw('].map(떼기).join('\n'), ctx);
  return { ctx, 칸, 그림, 돌려: (s) => vm.runInContext(s, ctx) };
}
const 자료 = [{ status: '진행' }, { status: '진행' }, { status: '종료' }, { status: '진행', excluded: true }];

test('① 처음은 «진행» · 고른 탭을 기억한다 · 모르는 값은 진행으로', () => {
  const 저장 = {};
  const w = 세상(저장, 자료);
  assert.equal(w.돌려('advTab()'), '진행');
  w.돌려("setAdvTab('종료')");
  assert.equal(저장.x_adv_tab, '종료');
  assert.deepEqual(w.그림, ['advisory'], '고르면 목록을 다시 그려야 한다');
  assert.equal(w.돌려('advTab()'), '종료');
  저장.x_adv_tab = '엉뚱'; assert.equal(w.돌려('advTab()'), '진행');
});

test('① 탭이 목록을 가른다 — 진행·종료·전체', () => {
  const 저장 = { x_adv_tab: '진행' };
  const w = 세상(저장, 자료);
  w.ctx.__r = { status: '종료' };
  assert.equal(w.돌려('advTabHas(__r)'), false);
  저장.x_adv_tab = '종료'; assert.equal(w.돌려('advTabHas(__r)'), true);
  저장.x_adv_tab = '전체'; assert.equal(w.돌려('advTabHas(__r)'), true);
});

test('③ 탭마다 수 — 배제한 것은 세지 않는다', () => {
  const w = 세상({}, 자료);
  w.돌려('advTabsDraw()');
  assert.match(w.칸.innerHTML, /진행 <b>2<\/b>/);
  assert.match(w.칸.innerHTML, /종료 <b>1<\/b>/);
  assert.match(w.칸.innerHTML, /전체 <b>3<\/b>/);
  assert.match(w.칸.innerHTML, /class="rh-dtab on"[^>]*>진행/);
});

test('② 탭은 목록만 가린다 — 지원서 문장은 전부를 본다', () => {
  assert.match(SRC, /advisory:\{store:'advisory',filter:r=>!r\.excluded&&advTabHas\(r\)/);
  assert.match(떼기('function renderAdvSummary('), /get\('advisory'\)\.filter\(function\(r\)\{ return r && !r\.excluded; \}\)/,
    '★★ 지원서 문장이 탭을 따라가면 종료한 곳이 실적에서 빠진다');
  assert.match(SRC, /<div class="rh-dtabs" id="advTabs"/);
});
