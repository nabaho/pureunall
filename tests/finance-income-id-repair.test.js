const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

test('자문수입 id 누락 경고에 실제 복구 단추를 연결한다', () => {
  assert.match(src, /k==='finance_income'[\s\S]{0,900}erpRepairFinanceIncomeIds/);
  assert.match(src, /ID '\+_noId\+'건 안전 복구/);
});

test('ID 복구는 서버 최신값 transaction 안에서만 수행한다', () => {
  const at = src.indexOf('window.erpRepairFinanceIncomeIds = function(opts)');
  assert.ok(at > 0, '복구 함수가 없다');
  const fn = src.slice(at, src.indexOf('\n};', at) + 3);
  assert.match(fn, /ref\.transaction\(/, '통째 set이면 동시 저장 자료를 덮을 수 있다');
  assert.match(fn, /if\(x && x\.id\) return x/, '기존 ID까지 바꾸면 참조가 끊긴다');
  assert.match(fn, /Object\.assign\(\{\},x\)/, '기존 기록 내용을 그대로 복사하지 않는다');
  assert.match(fn, /arrayToIdMap\(fixed\)/, '복구 뒤에도 건별 저장 형식으로 바꾸지 않는다');
});

test('ID 복구는 동기화 완료 전 실행되지 않는다', () => {
  const at = src.indexOf('window.erpRepairFinanceIncomeIds = function(opts)');
  const fn = src.slice(at, src.indexOf('\n};', at) + 3);
  assert.match(fn, /if\(!_fbSynced\)/);
});
