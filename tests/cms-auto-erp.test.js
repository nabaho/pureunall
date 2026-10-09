/* 이알피 CMS 자동 처리 접착부 — 스위치·쓰는 문·통장 줄은 표시만 (2026-10-09) */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function noComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function cutFn(h) { const i = src.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return noComments(src.slice(i, j + 1)); }

test('모듈을 캐시 번호와 함께 싣는다', () => {
  assert.match(src, /<script src="js\/pu-cms-auto\.js\?v=\d+"><\/script>/);
});
test('스위치가 꺼져 있으면 쓰지 않는다 — 쓰기 앞에 cmsAutoConfirm 확인', () => {
  const b = cutFn('function erpCmsAutoRun(');
  assert.match(b, /cmsAutoConfirm\s*===\s*true/);
  const iSw = b.search(/cmsAutoConfirm\s*===\s*true/), iW = b.search(/erpUpsertIncome\(/);
  assert.ok(iSw >= 0 && iW > iSw, '스위치 확인이 쓰기보다 앞에 있어야 한다');
  const iL = b.search(/erpCmsLedgerSave\(/);
  assert.ok(iL > iSw, 'cms_ledger 저장도 스위치 확인 뒤');
  assert.match(b.slice(Math.max(0, iL - 80), iL), /canWrite/, 'cms_ledger 저장은 canWrite 일 때만');
});
test('입금은 erpUpsertIncome 문으로만, 통장 줄은 처리됨 표시만', () => {
  const b = cutFn('function erpCmsAutoRun(');
  assert.doesNotMatch(b, /dbUpsert\(\s*['"]finance_income/, 'finance_income 을 직접 쓰지 않는다');
  assert.match(b, /erpMarkBankRowProcessed\(/);
  assert.doesNotMatch(b, /dbSet\(\s*['"]finance_income/);
});
test('관리자만 돈다', () => {
  assert.match(cutFn('function erpCmsAutoRun('), /isAdminByUser\(\s*CURRENT_USER\s*\)/);
});
