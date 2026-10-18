const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

test('큰 자문수입 표는 localStorage 5MB 밖의 세션 저장소로 옮긴다', () => {
  const at = src.indexOf('function _erpStoreGet(k)');
  const end = src.indexOf('// ── 탭', at);
  const block = src.slice(at, end > at ? end : at + 2500);
  assert.match(block, /k==='finance_income'/);
  assert.match(block, /sessionStorage\.setItem\(KEY\+k/);
  assert.match(block, /localStorage\.removeItem\(KEY\+k/);
});

test('dbGet·dbSet·원격수신 모두 같은 저장소 관문을 쓴다', () => {
  assert.match(src, /function dbGet[\s\S]{0,900}_erpStoreGet\(k\)/);
  /* dbSet 은 길다(2만 9천 자) — 고정 폭으로 자르지 않는다. 2026-10-15 근로자 주민번호 떼기가 들어가 5,200자 창을 넘었다.
     ⚠ cutFn 도 못 쓴다 — dbSet 머리 주석에 짝 없는 중괄호가 있어 1,345자에서 끊긴다(주석 속 괄호도 센다).
     그래서 «다음 최상위 함수 앞까지»로 자른다(함수 경계 — 길이와 무관). */
  const _ds = src.indexOf('function dbSet(k, v){');
  assert.match(src.slice(_ds, src.indexOf('\nfunction ', _ds + 10)), /_erpStoreSet\(k, newJson\)/);
  assert.match(src, /function _fbApplyRecord[\s\S]{0,1400}_erpStoreSet\(k, JSON\.stringify\(arrValue\)\)/);
});

test('ID 없는 자문수입은 로그인 점검에서 서버 transaction 복구를 자동 시작한다', () => {
  assert.match(src, /k==='finance_income'[\s\S]{0,220}erpRepairFinanceIncomeIds\(\{auto:true\}\)/);
  assert.match(src, /window\.erpRepairFinanceIncomeIds = function\(opts\)/);
});
