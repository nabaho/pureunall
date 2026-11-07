// 업체입금 탭의 «확인 필요»·«엑셀» 연결 (2026-11-07) — 판단은 모듈, 셈은 ERP 한 벌, 저장은 안 한다
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const code = html.replace(/\/\*[\s\S]*?\*\//g, '');
const i0 = code.indexOf('function IncomeCompanyTab(');
const tab = code.slice(i0, i0 + 90000);

test('스크립트가 실려 있다', () => {
  assert.match(html, /js\/pu-adv-check\.js\?v=\d+/);
});

test('★ 셈은 이 표의 함수를 넘긴다 — 약정액·중단·입금 찾기를 다시 만들지 않는다', () => {
  const f = tab.slice(tab.indexOf('function _advOpts()'), tab.indexOf('function _advOpts()') + 900);
  assert.match(f, /erpFeeForMonth\(c, ym\)/);
  assert.match(f, /erpFeeStopped\(c, ym\)/);
  assert.match(f, /erpAdvisoryPaidFor\(c, ym, _advIdx\(\)\)/);
});

test('단추 둘과 창이 있다 · 지금 보이는 업체(필터)를 쓴다', () => {
  assert.match(tab, /'🔎 확인 필요 ' \+ \(advChk\.length \+ advUnlinked\.length\)/);
  assert.match(tab, /'📥 엑셀'/);
  assert.match(tab, /chkOpen && \(function\(\)\{/);
  assert.match(tab, /list:SOURCE_LIST/);
});

test('★ 읽기만 한다 — 확인 창·엑셀 내려받기 안에서 입금을 저장하지 않는다', () => {
  const a = tab.indexOf('function _advOpts()');
  const b = tab.indexOf('// ── Phase 2: 건별 저장');
  const block = tab.slice(a, b);
  assert.doesNotMatch(block, /dbUpsert|dbSet|dbPatch|dbRemove|persistOneIncome|persistManyIncome/);
  const m = tab.indexOf('chkOpen && (function(){');
  const modal = tab.slice(m, tab.indexOf('autoMarkModal && h(', m));
  assert.doesNotMatch(modal, /dbUpsert|dbSet|dbPatch|dbRemove|persistOneIncome|persistManyIncome/);
});

test('업체 번호 없는 자문료 입금도 따로 알린다', () => {
  assert.match(tab, /var advUnlinked = \(incomes \|\| \[\]\)\.filter/);
  assert.match(tab, /!i\.companyId/);
});

test('엑셀 파일 이름은 연도와 날짜를 담는다', () => {
  assert.match(tab, /'자문료입금현황_' \+ selYear \+ '_' \+ todayYMD\(\) \+ '\.xlsx'/);
});
