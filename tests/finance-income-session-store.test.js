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
  assert.match(src, /function dbSet[\s\S]{0,5200}_erpStoreSet\(k, newJson\)/);
  assert.match(src, /function _fbApplyRecord[\s\S]{0,1400}_erpStoreSet\(k, JSON\.stringify\(arrValue\)\)/);
});

test('ID 없는 자문수입은 로그인 점검에서 서버 transaction 복구를 자동 시작한다', () => {
  assert.match(src, /k==='finance_income'[\s\S]{0,220}erpRepairFinanceIncomeIds\(\{auto:true\}\)/);
  assert.match(src, /window\.erpRepairFinanceIncomeIds = function\(opts\)/);
});
