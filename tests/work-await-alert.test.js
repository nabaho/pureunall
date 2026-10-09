'use strict';
/* 업무관리 「📬 서명본 대기」 알림 (대표 「추천대로」 2026-10-08) — 가짜 자료만
   ⓐ 14일 넘게 기다린 곳만, 회수한 곳은 빼고, 오래된 것 위
   ⓑ 기준 14일이 문서관리(AWAIT_LATE)와 같다
   ⓒ 팀 화면에 한 줄 · 작은 목록 하나만 «읽기만» · 문서관리 #co:await 로 간다
   ⓓ 문서관리는 #co:await 로 열면 서명본 대기 탭부터 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const W = read('work.html');
const cutFn = (s, start) => { const a = s.indexOf(start); assert.ok(a >= 0, start); return s.slice(a, s.indexOf('\n}\n', a) + 2); };

test('ⓐ 14일 넘은 대기만', () => {
  const box = { Date, Math, Object, String };
  vm.createContext(box);
  vm.runInContext('var AWAIT_LATE_DAYS=14;' + cutFn(W, 'function awaitLateOf('), box);
  const now = new Date(2026, 9, 8, 9).getTime(), D = 864e5;
  const out = JSON.parse(JSON.stringify(box.awaitLateOf({
    a: { name: '가나상사', at: now - 3 * D },
    b: { name: '다라테크', at: now - 20 * D },
    c: { name: '마바물산', at: now - 40 * D, got: now - D },
    d: { name: '사아', at: now - 15 * D },
    e: { name: '딱14일', at: now - 14 * D },
    f: null
  }, now)));
  assert.deepStrictEqual(out, [{ name: '다라테크', days: 20 }, { name: '사아', days: 15 }]);
});

test('ⓑ 기준 14일 — 문서관리와 같다', () => {
  assert.match(W, /var AWAIT_LATE_DAYS=14,/);
  assert.match(read('js/pu-office-docs.js'), /var AWAIT_LATE = 14,/);
});

test('ⓒ 팀 화면 한 줄 · 읽기만 · 문서관리로', () => {
  const ld = cutFn(W, 'function awaitLoad(');
  assert.match(ld, /fbDb\.ref\('pu_docs\/await'\)\.once\('value'\)/);
  assert.doesNotMatch(ld, /\.(set|push|update|remove)\(/);
  assert.match(cutFn(W, 'function awaitBanner('), /href="docs-esign\.html#co:await"/);
  assert.match(cutFn(W, 'function awaitBanner('), /esc\(a\.name\)/, '회사 이름은 esc 로');
  assert.match(cutFn(W, 'function renderTeam('), /h\+=awaitBanner\(\);/);
});

test('ⓓ 문서관리 #co:await → 서명본 대기 탭', () => {
  const h = read('docs-esign.html');
  assert.match(h, /h === '#co' \|\| h === '#co:await'\) return 'co'/);
  assert.match(h, /mountCompanies\(\$\('coRoot'\), officeHost\(\), \{ tab: location\.hash === '#co:await' \? 'await' : '' \}\)/);
  assert.match(read('js/pu-office-docs.js'), /tab: opts && \(opts\.tab === 'await' \|\| opts\.tab === 'sign'\) \? opts\.tab : 'co'/);
});
