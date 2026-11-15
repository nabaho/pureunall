/* 업체관리 폰 — 담당자로 바로 찾기 · 윗부분 줄이기 (대표 지시 2026-11-15
   「업체관리에서 자문 급여 등을 보거나 담당자별로 찾아야 하는데 한번에 못찾겠다 … 상단 ui 간략하게」) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const APP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

test('폰 업체관리에 «담당자» 고르기가 있고, 표 머리 깔때기와 같은 거르개(mgr)를 쓴다', () => {
  const fn = cutFn(APP, 'function mgrSelect(');
  assert.match(fn, /cItems\('mgr'\)/);
  assert.match(fn, /cSet\('mgr'/, '새 거르기 규칙을 만들지 말고 깔때기와 같은 상태를 써야 합니다');
  assert.match(fn, /setMineFirst\(/, '「내 담당 먼저」가 이 상자로 합쳐졌습니다 — 끌 길이 있어야 합니다');
  const at = APP.indexOf('typeSelect(),');
  assert.ok(at > 0 && /^\s*mgrSelect\(\),/.test(APP.slice(at + 'typeSelect(),'.length, at + 'typeSelect(),'.length + 40)),
    '유형 고르기 옆에 담당자 고르기가 있어야 한 줄에서 찾습니다');
});

test('폰 거르개 셋(상태·유형·담당)은 같은 몫으로 나눠 한 줄에 든다', () => {
  const fn = cutFn(APP, 'function mgrSelect(') + cutFn(APP, 'function typeSelect(');
  assert.ok((fn.match(/flex:'1 1 0'/g) || []).length >= 2, '칸 너비가 달라 줄이 꺾입니다');
});

test('월 줄 안에 요약을 넣는 것은 «부탁한 화면만»(업체관리) — 다른 화면은 그대로', () => {
  const fn = cutFn(APP, 'function MonthKpiHeader(');
  assert.match(fn, /props\.phoneKpiInline/);
  assert.equal((APP.match(/phoneKpiInline:\s*true/g) || []).length >= 1, true);
});
