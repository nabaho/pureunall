'use strict';
/* 前 줄을 아래로 모으기 — node --test tests/home-career-era-sort.test.js
 *
 * 대표 지시 2026-09-13 「전으로 바뀌면 자동으로 아래로 전만 자동으로 분류되어
 *   정리될 수 있게 해달라」.
 *   (실제로 8·9번 줄만 前 인 채 열여덟 줄 «가운데»에 박혀 있었다.)
 *
 * ★ 이 검사가 지키는 것
 *   ① 前 은 아래로 모인다
 *   ② «차례를 새로 매기지 않는다» — 안정 정렬이다. 前 끼리도, 現 끼리도 있던 차례 그대로다
 *   ③ «없음»은 前 이 아니다 — 학력·자격증처럼 한자 없는 줄이 아래로 밀리면 안 된다
 *   ④ 바뀐 것이 없으면 화면을 헛되게 다시 그리지 않는다
 *   ⑤ 자리가 바뀌었으면 «통째로» 다시 그린다 — 그 줄만 고쳐서는 옮겨 가지 않는다
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(R, 'pu-home.html'), 'utf8');
/* 주석을 먼저 걷는다 — 잘 쓴 주석이 검사를 통과시키면 아무것도 안 지킨다 */
const H = RAW.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

function 함수(이름) {
  const i = H.search(new RegExp('(?:async )?function ' + 이름 + '\\('));
  assert.ok(i >= 0, '★ ' + 이름 + ' 을 못 찾았다');
  const j = H.indexOf('\nfunction ', i + 5), k = H.indexOf('\nasync function ', i + 5);
  return H.slice(i, Math.min(j < 0 ? H.length : j, k < 0 ? H.length : k));
}

/* 앞한자를 읽고 붙이는 일은 «진짜 모듈»을 쓴다 — 흉내를 내면 이 검사가 실제를 안 지킨다 */
const g = {};
vm.runInNewContext(fs.readFileSync(path.join(R, 'js', 'pu-home-career.js'), 'utf8'),
  Object.assign(g, { window: g }));
const PuHomeCareer = g.PuHomeCareer;

function 상자(줄들) {
  const ctx = { App: { draft: { careers: 줄들.slice() } }, PuHomeCareer,
                Array, window: {} };
  vm.createContext(ctx);
  vm.runInContext(함수('careerSortEra'), ctx);
  return ctx;
}

test('★★ 前 은 아래로 모인다 — 가운데 박혀 있지 않는다', () => {
  const ctx = 상자(['現 가', '現 나', '前 다', '現 라', '前 마']);
  assert.equal(ctx.careerSortEra(), true, '★ 옮길 것이 있는데 안 옮겼다');
  assert.deepEqual(ctx.App.draft.careers,
    ['現 가', '現 나', '現 라', '前 다', '前 마'],
    '★★ 前 이 아래로 안 모인다');
});

test('★★ 차례를 «새로 매기지 않는다» — 안정 정렬이다', () => {
  /* 前 끼리도 있던 차례 그대로여야 한다. 뒤집히면 사람이 손으로 맞춰 둔 순서가 망가진다. */
  const ctx = 상자(['前 하나', '現 둘', '前 셋', '現 넷', '前 다섯']);
  ctx.careerSortEra();
  assert.deepEqual(ctx.App.draft.careers,
    ['現 둘', '現 넷', '前 하나', '前 셋', '前 다섯'],
    '★★ 前 끼리(또는 現 끼리)의 차례가 뒤바뀌었다');
});

test('★★ «없음»은 前 이 아니다 — 학력·자격증이 아래로 밀리면 안 된다', () => {
  /* 실제 홈페이지의 학력·자격증 줄에는 한자가 하나도 안 붙어 있다.
     그 줄이 前 과 함께 아래로 밀리면, 안 붙인 것이 «끝난 것»으로 보인다. */
  const ctx = 상자(['現 가', '고려대학교 노동대학원 졸업', '前 나', '공인노무사']);
  ctx.careerSortEra();
  assert.deepEqual(ctx.App.draft.careers,
    ['現 가', '고려대학교 노동대학원 졸업', '공인노무사', '前 나'],
    '★★ 한자 없는 줄이 前 과 함께 아래로 밀렸다');
});

test('★ 이미 정리돼 있으면 «안 건드린다» — 화면을 헛되게 다시 안 그린다', () => {
  const ctx = 상자(['現 가', '現 나', '前 다']);
  assert.equal(ctx.careerSortEra(), false, '★ 바뀐 것이 없는데 바뀌었다고 한다');
  const 빈것 = 상자([]);
  assert.equal(빈것.careerSortEra(), false, '★ 빈 목록에서 바뀌었다고 한다');
  const 前만 = 상자(['前 가', '前 나']);
  assert.equal(前만.careerSortEra(), false, '★ 全部 前 인데 바뀌었다고 한다');
});

test('★★ 자리가 바뀌면 «통째로» 다시 그린다 — 그 줄만 고쳐서는 안 옮겨 간다', () => {
  /* careerEra 는 원래 그 줄만 고쳐 그려 깜빡임이 없다. 옮길 때는 그 길로는 안 된다. */
  const s = 함수('careerEra');
  assert.match(s, /careerSortEra\(\)/, '★★ 前 으로 바꿔도 아래로 안 모읍니다');
  const at = s.indexOf('careerSortEra()');
  assert.match(s.slice(at, at + 120), /App\.render\(\)/,
    '★★ 자리를 옮겨 놓고 그 줄만 고쳐 그립니다 — 화면에서는 안 움직입니다');
  assert.match(s.slice(at, at + 120), /return/,
    '★ 다시 그린 뒤에도 그 줄만 고치는 길로 계속 갑니다');
  /* ⚠ 안 옮겨도 될 때(現 ↔ 없음)의 «빠른 길»을 지우지 말 것 */
  assert.match(s, /getElementById\('careerBox'\)/,
    '★ 그 줄만 고쳐 그리는 빠른 길이 사라졌습니다 — 누를 때마다 화면이 깜빡입니다');
});
