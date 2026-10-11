'use strict';
/* 프로필 1장 — 한 화면에 한 장이 다 보이고, 크게도 볼 수 있다 (대표 지적 2026-10-11 「글자가 안 보인다 · 위아래 이동」)
   규칙만 못 박는다: 높이에 맞추는 갈래가 있고 · 폭 맞춤 · 전체 화면 길이 있고 · 서류 크기(A4)는 그대로. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
test('한 화면 맞춤은 «높이»를 본다 — 가로만 보면 위아래로 움직여야 한다', () => {
  const f = strip(떼기('function _p1Scale('));
  assert.ok(/innerHeight/.test(f) && /1123/.test(f), '창 높이로 줄임비를 잰다');
  assert.ok(/Math\.min\([^)]*availH\/1123/.test(f), '한 화면 갈래는 높이 한도를 min 에 넣는다');
});
test('폭 맞춤 · 전체 화면 길이 있고, 서류 크기는 그대로(A4 794×1123)', () => {
  assert.ok(/function p1Zoom\(/.test(SRC) && /function p1Full\(/.test(SRC), '보는 크기 바꾸기');
  assert.ok(/requestFullscreen/.test(strip(떼기('function p1Full('))), '전체 화면');
  assert.ok(/fullscreenchange/.test(SRC), '전체 화면에서 나오면 다시 맞춤');
  assert.ok(/width:794px;height:1123px/.test(SRC), '서류(인쇄·저장) 크기는 그대로');
  assert.ok(/id="p1Zoom"/.test(SRC), '단추 자리');
});

/* ═══ 크기를 «직접» 조절 — ➖/➕ 10%씩, 설정 칸 접기 (대표 지시 2026-10-11 「화면 더 커지게 조절가능하게해서 글자 볼수 있게」) ═══
   실측(1600×900): 한 화면 63% → ➕ 로 70·…·100% → 설정 접으면 그림 칸 1,283px → 130%(1,034px) · 190%부터는 옆으로 밀어 본다(scrollW 1,509) · 상한 250%. */
const vm = require('node:vm');
test('★ 크기 단추 줄은 «설정 칸 밖»(#p1Row)에 있다 — 설정을 접어도 ➖/➕ 가 남아야 한다 · #p1Zoom 은 그대로 왼쪽 칸 안', () => {
  const page = SRC.slice(SRC.indexOf('id="page-profile1"'), SRC.indexOf('id="page-bizdash"'));
  const row = page.slice(page.indexOf('id="p1Row"'), page.indexOf('class="p1-wrap"'));
  assert.match(row, /p1Step\(-1\)/); assert.match(row, /p1Step\(1\)/); assert.match(row, /id="p1Pct"/); assert.match(row, /p1SideToggle\(\)/);
  assert.ok(page.indexOf('id="p1Row"') < page.indexOf('id="p1Side"'), '크기 줄이 설정 칸 위(밖)에 있어야 한다');
  assert.ok(!/id="p1Zoom"/.test(page), '옛 규칙: 오른쪽 위 단추 줄(p1Zoom)은 없다');
});
function stepRun(cur, d, mode) {
  const store = {}, calls = [];
  const ctx = { _p1Cur: cur, _p1Pct: 100, _p1ZoomMode: mode || 'fit', Math,
    localStorage: { setItem: (k, v) => { store[k] = v; } }, _p1ZoomBar: () => calls.push('bar'), _p1Scale: () => calls.push('scale') };
  vm.runInNewContext(떼기('function p1Step(') + ';p1Step(' + d + ');', ctx);
  return { pct: ctx._p1Pct, mode: ctx._p1ZoomMode, store, calls };
}
test('★★ ➕ 는 지금 «보이는» 배율에서 10% 올린다(한 화면 63% → 70%) · ➖ 는 내린다', () => {
  assert.equal(stepRun(0.6322, 1).pct, 70);
  assert.equal(stepRun(1.0, 1).pct, 110);
  assert.equal(stepRun(1.0, -1).pct, 90);
});
test('★ 상한 250% · 하한 40% — 그 밖으로 안 나간다 · 누르면 100% 로', () => {
  assert.equal(stepRun(2.5, 1).pct, 250); assert.equal(stepRun(0.4, -1).pct, 40);
  assert.equal(stepRun(1.7, 0).pct, 100);
});
test('★ 직접 정하면 「한 화면·폭 맞춤」은 꺼지고(custom), 크기는 기억하고, 그림을 다시 맞춘다', () => {
  const r = stepRun(0.63, 1, 'fit');
  assert.equal(r.mode, 'custom');
  assert.equal(r.store.kc_p1_zoom2, 'custom'); assert.equal(r.store.kc_p1_pct, '70');
  assert.deepEqual(r.calls, ['bar', 'scale']);
});
test('★★ _p1Scale — 직접 정한 크기는 250·40 으로 막고, 칸보다 크면 옆으로 밀어 보고(overflowX auto), 칸에 들어가면 가운데에 둔다', () => {
  const f = strip(떼기('function _p1Scale('));
  assert.match(f, /_p1ZoomMode==='custom'/);
  assert.match(f, /Math\.max\(\.4,\s*Math\.min\(2\.5,\s*_p1Pct\/100\)\)/);
  assert.match(f, /fitsW\?\(Math\.round\(794\*s\)\+2\+'px'\):'100%'/);
  assert.match(f, /if\(!fitsW\)\{[^}]*overflowX='auto'/);
  assert.match(f, /_p1Cur=s;/, '지금 배율을 기억해야 ➕/➖ 가 «보이는 크기»에서 올린다');
  assert.match(f, /1123\*s\)\+extra/, '옆 스크롤 막대 높이를 더해야 아래가 안 잘린다');
});
test('★ 설정 칸 접기 — 접으면 그림 칸이 전체 폭, 펴면 500px 로 · 기억한다 · 그림을 다시 맞춘다', () => {
  const store = {}, el = { p1Side: { style: {} }, p1SideBtn: { textContent: '' } }, wrap = { style: {} }, calls = [];
  const ctx = { _p1Side: true, localStorage: { setItem: (k, v) => { store[k] = v; } },
    document: { querySelector: () => wrap, getElementById: (id) => el[id] }, _p1Scale: () => calls.push('scale') };
  vm.runInNewContext(떼기('function p1SideApply(') + 떼기('function p1SideToggle(') + ';p1SideToggle();', ctx);
  assert.equal(wrap.style.gridTemplateColumns, 'minmax(0,1fr)'); assert.equal(el.p1Side.style.display, 'none');
  assert.equal(el.p1SideBtn.textContent, '▶ 설정 펴기'); assert.equal(store.kc_p1_side, '0'); assert.deepEqual(calls, ['scale']);
  vm.runInNewContext('p1SideToggle();', ctx);
  assert.equal(wrap.style.gridTemplateColumns, '500px minmax(0,1fr)'); assert.equal(el.p1Side.style.display, ''); assert.equal(store.kc_p1_side, '1');
});
test('★ 부팅 때 기억한 크기·설정 칸 상태를 되살린다 — 이상한 값은 한 화면(fit)·100% 로', () => {
  const m = SRC.match(/var _p1Pct=100, _p1Cur=1, _p1Side=true;[\s\S]*?catch\(e\)\{\}/);
  assert.ok(m, '되살리는 코드가 없다');
  const run = (zoom, pct, side) => {
    const ctx = { _p1ZoomMode: 'fit', localStorage: { getItem: (k) => ({ kc_p1_zoom2: zoom, kc_p1_pct: pct, kc_p1_side: side })[k] }, parseInt };
    vm.runInNewContext(m[0] + ';globalThis.o=JSON.stringify({m:_p1ZoomMode,p:_p1Pct,s:_p1Side});', ctx); return JSON.parse(ctx.o);
  };
  assert.deepEqual(run('custom', '130', '0'), { m: 'custom', p: 130, s: false });
  assert.deepEqual(run('이상', '9999', null), { m: 'fit', p: 100, s: true });
  assert.deepEqual(run('width', 'abc', '1'), { m: 'width', p: 100, s: true });
});
test('★ 그림을 다시 그릴 때(renderProfile1)마다 설정 칸 접힘 상태를 먼저 적용하고 맞춘다 — 안 하면 접어 둔 칸이 다시 펴진다', () => {
  const f = strip(떼기('function renderProfile1('));
  assert.match(f, /p1SideApply\(\);\s*_p1ZoomBar\(\);\s*_p1Scale\(\);/);
});
test('★ 크기 줄(#p1Row)은 눈에 보인다 — 숨기면 ➖/➕ 를 못 찾는다 · A4 보기가 아닐 때만 크기 단추를 감춘다', () => {
  const page = SRC.slice(SRC.indexOf('id="p1Row"'), SRC.indexOf('class="p1-wrap"'));
  assert.doesNotMatch(page.slice(0, page.indexOf('>')), /display:none/);
  assert.match(strip(떼기('function _p1ZoomBar(')), /getElementById\('p1StepBox'\)[\s\S]*?_p1View==='a4'\)\?'inline-flex':'none'/);
});
