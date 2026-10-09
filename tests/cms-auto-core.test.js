/* 더빌 출금결과 표 → 줄 (2026-10-09) — 연락처·이메일은 담지 않는다, 상태·지문은 이알피와 같은 잣대 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = require('../js/pu-cms-auto.js');
const erp = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function cutFn(h) { const i = erp.indexOf(h); assert.ok(i >= 0, h); let j = erp.indexOf('{', i), d = 0;
  for (; j < erp.length; j++) { if (erp[j] === '{') d++; else if (erp[j] === '}' && --d === 0) break; } return erp.slice(i, j + 1); }

const HEAD = ['', '구분', '출금일\n최초출금일', '회원코드', '회원명', '회원연락처\n회원이메일', '출금정보', '납부금액\n정산(예정)일', '수수료', '상태'];
const ROW = (d, code, name, amt, st) => ['', '은행', d + '\n2025-01-05', code, name, '010-0000-0000\nhong@example.com', '신한 ***', amt + '원\n' + d, '0', st];

test('표를 줄로 — 연락처·이메일·출금정보는 버린다', () => {
  const rows = A.parsePayTable(HEAD, [ROW('2026-10-07', '1001', '가나상사', '88,000', '출금성공 [자동출금]')]);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.wdate, '2026-10-07'); assert.equal(r.code, '1001'); assert.equal(r.name, '가나상사');
  assert.equal(r.amount, 88000); assert.equal(r.status, 'ok'); assert.equal(r.src, 'nicebill');
  assert.doesNotMatch(JSON.stringify(r), /010-|@|신한/, '연락처·이메일·계좌 칸이 담겼다');
});

test('빈 줄·합계 줄은 건너뛴다', () => {
  const rows = A.parsePayTable(HEAD, [['', '', '', '', '', '', '', '', '', ''], ROW('2026-10-06', '1002', '다라식품', '110,000', '출금실패 잔액부족 [자동재출금]')]);
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'fail');
});

test('같은 지문이 두 번이면 #1 을 붙인다 — 같은 날 두 번 출금', () => {
  const r = ROW('2026-03-31', '1003', '마바건설', '467,500', '출금성공');
  const rows = A.parsePayTable(HEAD, [r, r]);
  assert.equal(rows.length, 2); assert.notEqual(rows[0]._k, rows[1]._k); assert.match(rows[1]._k, /#1$/);
});

test('상태·지문은 이알피와 같은 잣대 — 다르면 같은 줄이 두 번 쌓인다', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(cutFn('function _nbNorm(') + cutFn('function _nbStatusOf(') + cutFn('function _nbRowSig('), ctx);
  ['출금성공 [자동출금]', '출금실패 잔액부족 [자동재출금]', '출금중 [자동출금]', '정상', '미납', ''].forEach(s =>
    assert.equal(A.statusOf(s), ctx._nbStatusOf(s), s));
  const r = { wdate: '2026-10-06', name: '가 나 상사', amount: 110000, code: '77' };
  assert.equal(A.rowKey(r), ctx._nbRowSig(r));
});
