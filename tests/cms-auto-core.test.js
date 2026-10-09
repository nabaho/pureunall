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

const CO = [
  { id: 'co-1', name: '가나상사', status: 'active', monthlyAdvisoryFee: 220000, vatType: 'inclusive', cmsMemberCodes: ['1001'], managerMain: 'A-001' },
  { id: 'co-2', name: '다라식품', status: 'active', monthlyAdvisoryFee: 100000, vatType: 'separate', cmsMemberCodes: ['1002'], managerMain: 'A-002' },
];
const R = (k, code, amt, st, wd) => ({ _k: k, code, name: 'x', amount: amt, status: st || 'ok', wdate: wd || '2026-10-10' });
const ctx = (over) => Object.assign({ companies: CO, incomes: [], isLocked: () => false, skip: {} }, over);
const V = (rows, c) => A.judgeRows(rows, c).map(x => x.verdict);

test('일곱 갈래 — 하나라도 어긋나면 확인 상자', () => {
  assert.deepEqual(V([R('a', '1001', 220000)], ctx()), ['auto']);
  assert.deepEqual(V([R('b', '1001', 220000, 'fail')], ctx()), ['fail']);
  assert.deepEqual(V([R('c', '9999', 220000)], ctx()), ['new_member'], '회원코드로 못 이으면 이름이 같아도 자동 금지');
  assert.deepEqual(V([R('d', '1001', 330000)], ctx()), ['amount']);
  assert.deepEqual(V([R('e', '1002', 110000)], ctx()), ['auto'], '부가세 별도면 ×1.1 인정');
  assert.deepEqual(V([R('f', '1001', 220000)], ctx({ isLocked: ym => ym === '2026-10' })), ['locked']);
  assert.deepEqual(V([R('g', '1001', 220000)], ctx({ skip: { g: true } })), ['skip'], '되돌린 줄은 다시 안 넣는다');
});

test('이미 넣은 줄(cmsKey)은 done, 받을 달에 입금이 있으면 dup_month', () => {
  const inc = [{ id: 'i1', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-09-10', advisoryYm: '2026-09' }];
  assert.deepEqual(V([R('h', '1001', 220000)], ctx({ incomes: inc.concat([{ id: 'i2', cmsKey: 'h', companyId: 'co-1', amount: 220000 }]) })), ['done']);
  const inc2 = inc.concat([{ id: 'i3', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-10-02', advisoryYm: '2026-10' }]);
  assert.deepEqual(V([R('j', '1001', 220000, 'ok', '2026-10-31')], ctx({ incomes: inc2 })).slice(0, 1), ['auto'],
    '직전이 10월분이면 받을 달은 11월 — 겹치지 않는다');
  const inc3 = [{ id: 'i4', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-10-02', advisoryYm: '2026-10' },
                { id: 'i5', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-11-01', advisoryYm: '2026-11' }];
  assert.equal(A.nextAdvisoryYm('co-1', inc3, '2026-10-31'), '2026-12');
});

test('같은 실행 안에서 한 업체 두 줄이면 받을 달이 겹치지 않는다', () => {
  const out = A.judgeRows([R('k1', '1001', 220000, 'ok', '2026-10-10'), R('k2', '1001', 220000, 'ok', '2026-10-11')], ctx());
  assert.equal(out[0].ym === out[1].ym && out[1].verdict === 'auto', false);
});

test('받을 달 — 직전 자문료의 다음 달, 없으면 출금일의 달', () => {
  assert.equal(A.nextAdvisoryYm('co-1', [], '2026-10-10'), '2026-10');
  assert.equal(A.nextAdvisoryYm('co-1', [{ companyId: 'co-1', kind: '자문료', date: '2026-08-30', advisoryYm: '2026-08' }], '2026-10-01'), '2026-09');
  assert.equal(A.nextAdvisoryYm('co-1', [{ companyId: 'co-1', kind: '자문료', date: '2026-12-05' }], '2027-01-05'), '2027-01');
});

test('입금 기록 — 자동 표시·지문·출처를 단다, 연락처는 없다', () => {
  const it = A.judgeRows([R('a', '1001', 220000)], ctx())[0];
  const rec = A.buildIncome(it, Date.parse('2026-10-11T00:00:00Z'), 'P-001');
  assert.equal(rec.companyId, 'co-1'); assert.equal(rec.kind, '자문료'); assert.equal(rec.amount, 220000);
  assert.equal(rec.date, '2026-10-10'); assert.equal(rec.advisoryYm, '2026-10'); assert.equal(rec.cmsKey, 'a');
  assert.equal(rec.autoConfirmed, true); assert.equal(rec.autoBy, 'cms-auto'); assert.equal(rec.sourceKind, 'company');
  assert.equal(rec.managerSid, 'A-001'); assert.match(rec.id, /^fi-/); assert.equal(rec.entityType, 'FinancialTransaction');
});
