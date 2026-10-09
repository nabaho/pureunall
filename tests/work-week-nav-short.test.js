'use strict';
// 주 이동 한 덩어리 · 업무 칸 약칭 — node --test tests/work-week-nav-short.test.js
//
// 대표 지시 2026-10-04 「지난주와 다음주 등을 계속 확인할 수 있게 — 지금 화면에서는 과거 확인이
// 어렵다」 · 「업무 부분에 모든 단어를 넣는 것보다 푸른이알피의 간략한 이름은 어떤가」 → 추천대로.
//
// 이 검사가 지키는 것
//   ①★ ‹ 지난주 · 이 주 · 다음 주 › 가 «한 덩어리» — 도구줄이 접혀도 ‹ 만 화면 밖으로 떨어지지 않는다
//   ②  다른 주를 보면 「이번 주로」 · 두 화면(내 업무·팀 전체)이 같은 덩어리를 쓴다
//   ③★ 업무 칸은 푸른이알피 약칭, 마우스를 올리면 원래 이름 · 유형표에 없는 이름은 그대로
//   ④  거르기·검색 기준(ptOf)은 원래 이름 그대로

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}
const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function navBox(cur) {
  const b = { String, esc, S: { week: new Date(2026, 9, 5) } };
  vm.createContext(b);
  vm.runInContext('function weekLabel(){ return "10월 1주"; }\nfunction isCurWeek(){ return ' + (cur ? 'true' : 'false') + '; }\n' + grab('wkNavHTML'), b);
  return b;
}

test('★ ‹ 지난주 · 이 주 · 다음 주 › 가 한 덩어리 — 줄바꿈 없는 묶음 안에 셋이 다 있다', () => {
  const h = navBox(true).wkNavHTML();
  assert.match(h, /^<span class="wkgrp">/);
  const inner = h.slice(0, h.lastIndexOf('</span>'));
  assert.ok(inner.indexOf('shiftWeek(-1)') > 0 && inner.indexOf('openCal()') > inner.indexOf('shiftWeek(-1)')
    && inner.indexOf('shiftWeek(1)') > inner.indexOf('openCal()'), '차례가 ‹ · 이 주 · › 가 아닙니다');
  assert.match(h, /‹ 지난주/); assert.match(h, /다음 주 ›/);
  assert.match(W, /\.wkgrp\{[^}]*white-space:nowrap/, '덩어리가 줄바꿈을 막지 않습니다');
});

test('다른 주를 보면 「이번 주로」 — 이번 주면 없다', () => {
  assert.doesNotMatch(navBox(true).wkNavHTML(), /이번 주로/);
  assert.match(navBox(false).wkNavHTML(), /onclick="setWeek\(null\)">이번 주로/);
});

test('두 화면(내 업무·팀 전체)이 같은 덩어리를 쓴다 — 따로 놓인 ‹ 가 남아 있지 않다', () => {
  const calls = (W.match(/\+wkNavHTML\(\)/g) || []).length;
  assert.ok(calls >= 2, '덩어리를 쓰는 화면이 ' + calls + '곳입니다');
  const outside = W.replace(grab('wkNavHTML'), '');
  assert.doesNotMatch(outside, /class="wknav" onclick="shiftWeek\(-1\)"/, '따로 놓인 ‹ 가 남아 있습니다');
});

/* ── 약칭 ── */

function shortBox() {
  const b = { String, Object, esc, escJ: (x) => String(x), peTypes: {
    consulting: [{ code: 'c1', name: '일터상생혁신컨설팅', short: '일터' }, { code: 'c2', name: '통합기술보호지원단', short: '기술보호' },
                 { code: 'c3', name: '약칭없는유형', short: '' }],
    fund: [{ code: 'f1', name: '공동근로복지기금', short: '공동기금' }] } };
  vm.createContext(b);
  vm.runInContext(['peShort', 'briefTrim', 'nameCell', 'ptOf'].map(grab).join('\n') + '\nvar BRIEF_MAX=40;', b);
  return b;
}

test('★ 약칭 — 유형표의 short · 없는 이름·빈 약칭은 그대로(지어내지 않는다)', () => {
  const b = shortBox();
  assert.equal(b.peShort('일터상생혁신컨설팅'), '일터');
  assert.equal(b.peShort('공동근로복지기금'), '공동기금');
  assert.equal(b.peShort('컨설팅계약'), '컨설팅계약');
  assert.equal(b.peShort('약칭없는유형'), '약칭없는유형');
  assert.equal(b.peShort(''), '');
});

test('★ 업무 칸 — 약칭으로 보이고, 마우스를 올리면 원래 이름', () => {
  const b = shortBox();
  const h = b.nameCell({ _id: 'I1', ptype: '컨설팅계약', title: '일터상생혁신컨설팅', brief: '' });
  assert.match(h, />컨설팅계약 · 일터<\/span>/, h);
  assert.match(h, /title="[^"]*컨설팅계약 · 일터상생혁신컨설팅"/, '원래 이름이 말풍선에 없습니다');
  const one = b.nameCell({ _id: 'I2', ptype: '통합기술보호지원단', brief: '요약' });
  assert.match(one, />기술보호<\/span>/);
  const same = b.nameCell({ _id: 'I3', ptype: '자문', brief: '' });
  assert.doesNotMatch(same, /&#10;/, '줄일 것이 없는데 말풍선에 같은 말을 또 적었습니다');
});

test('거르기·검색 기준(ptOf)은 원래 이름 그대로', () => {
  const b = shortBox();
  assert.equal(b.ptOf({ ptype: '통합기술보호지원단' }), '통합기술보호지원단');
  assert.doesNotMatch(grab('ptOf'), /peShort/);
});
