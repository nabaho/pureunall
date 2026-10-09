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
const ctx = (over) => Object.assign({ companies: CO, incomes: [], isLocked: () => false, skip: {}, since: '2026-01-01' }, over);
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

test('이미 넣은 줄(cmsKey)은 done, 출금월에 받은 자문료가 있으면 dup_month', () => {
  const inc = [{ id: 'i1', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-09-10', advisoryYm: '2026-09' }];
  // (a) 이미 넣은 줄
  assert.deepEqual(V([R('h', '1001', 220000)], ctx({ incomes: inc.concat([{ id: 'i2', cmsKey: 'h', companyId: 'co-1', amount: 220000 }]) })), ['done']);
  // (b) 은행으로 10월분을 이미 받았다 — 10/10 출금은 중복
  const bank10 = [{ id: 'i6', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-10-02', advisoryYm: '2026-10' }];
  assert.deepEqual(V([R('b2', '1001', 220000, 'ok', '2026-10-10')], ctx({ incomes: bank10 })), ['dup_month']);
  // (c) 직전이 10/2 입금(10월)이고 10/31 출금 — 같은 달이라 중복
  const inc2 = inc.concat([{ id: 'i3', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-10-02', advisoryYm: '2026-10' }]);
  assert.deepEqual(V([R('j', '1001', 220000, 'ok', '2026-10-31')], ctx({ incomes: inc2 })), ['dup_month']);
  // (d) 말일 선납: 9/30 입금(받을 달 10월)을 10/31 출금 — 출금월이 달라 중복 아님, 받을 달은 11월
  const early = [{ id: 'i7', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-09-30', advisoryYm: '2026-10' }];
  const d = A.judgeRows([R('d2', '1001', 220000, 'ok', '2026-10-31')], ctx({ incomes: early }))[0];
  assert.equal(d.verdict, 'auto'); assert.equal(d.ym, '2026-11');
  // 받을 달 계산 자체 (inc3)
  const inc3 = [{ id: 'i4', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-10-02', advisoryYm: '2026-10' },
                { id: 'i5', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-11-01', advisoryYm: '2026-11' }];
  assert.equal(A.nextAdvisoryYm('co-1', inc3, '2026-10-31'), '2026-12');
});

test('같은 실행 안에서 한 업체 두 줄이면 두 번째는 같은 달이라 dup_month', () => {
  const out = A.judgeRows([R('k1', '1001', 220000, 'ok', '2026-10-10'), R('k2', '1001', 220000, 'ok', '2026-10-11')], ctx());
  assert.equal(out[0].verdict, 'auto'); assert.equal(out[0].ym, '2026-10');
  assert.equal(out[1].verdict, 'dup_month');
});

test('회원코드가 두 업체에 이어지면 자동 금지 — 이름이 같아도 고르지 않는다', () => {
  const dupCo = CO.concat([{ id: 'co-3', name: '가나상사2', status: 'active', monthlyAdvisoryFee: 220000, vatType: 'inclusive', cmsMemberCodes: ['1001'], managerMain: 'A-003' }]);
  const out = A.judgeRows([R('amb', '1001', 220000)], ctx({ companies: dupCo }));
  assert.equal(out[0].verdict, 'new_member'); assert.equal(out[0].why, '회원코드가 두 업체에 이어져 있음');
});

test('삭제된 업체(_deleted)의 회원코드는 잇지 않는다 — new_member', () => {
  const delCo = CO.map(c => c.id === 'co-1' ? Object.assign({}, c, { _deleted: true }) : c);
  assert.deepEqual(V([R('del', '1001', 220000)], ctx({ companies: delCo })), ['new_member']);
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
  assert.equal(rec.sourceId, 'co-1', 'sourceKind 와 짝');
  assert.equal(rec.managerSid, 'A-001'); assert.match(rec.id, /^fi-/); assert.equal(rec.entityType, 'FinancialTransaction');
});

test('더빌 합계 줄은 그날 명세 합계와 맞을 때만, 이름·금액·날짜가 맞는 입금은 딱 하나일 때만', () => {
  const norm = s => String(s || '').replace(/\(주\)|㈜|주식회사|\s/g, '').toLowerCase();
  const cms = [{ _k: 'c1', status: 'ok', setdate: '2026-10-12', amount: 220000, fee: 0 }, { _k: 'c2', status: 'ok', setdate: '2026-10-12', amount: 110000, fee: 0 },
               { status: 'fail', setdate: '2026-10-12', amount: 999000, fee: 0 }];
  const inc = [{ id: 'i1', companyName: '(주)가나상사', amount: 330000, date: '2026-10-04' }];
  const bank = [{ date: '2026-10-12 10:00', amount: 330000, memo: '더빌이체3572' },
                { date: '2026-10-13 10:00', amount: 500000, memo: '더빌이체3572' },
                { date: '2026-10-05 09:00', amount: 330000, memo: '가나상사' },
                { date: '2026-10-05 09:00', amount: 330000, memo: '라마상회' }];
  const out = A.bankLinesToMark(bank, { cmsRows: cms, incomes: inc, normName: norm, recordedKeys: { c1: true, c2: true } });
  assert.deepEqual(out.map(x => x.why + ':' + x.row.memo), ['cms_sum:더빌이체3572', 'recorded:가나상사']);
  assert.equal(out[1].incomeId, 'i1');
});

test('딱 하나 규칙 — 이름이 맞는 입금이 둘이면 아무것도 고르지 않는다', () => {
  const norm = s => String(s || '').replace(/\(주\)|㈜|주식회사|\s/g, '').toLowerCase();
  const inc = [{ id: 'i1', companyName: '(주)가나상사', amount: 330000, date: '2026-10-04' },
               { id: 'i2', companyName: '가나상사 본점', amount: 330000, date: '2026-10-05' }];
  const bank = [{ date: '2026-10-05 09:00', amount: 330000, memo: '가나상사' }];
  assert.deepEqual(A.bankLinesToMark(bank, { cmsRows: [], incomes: inc, normName: norm }), []);
});

test('한 입금은 한 줄에만 — 같은 입금에 같은 줄이 둘이면 한 번만 고른다', () => {
  const norm = s => String(s || '').replace(/\(주\)|㈜|주식회사|\s/g, '').toLowerCase();
  const inc = [{ id: 'i1', companyName: '(주)가나상사', amount: 330000, date: '2026-10-05' }];
  const bank = [{ date: '2026-10-05 09:00', amount: 330000, memo: '가나상사' },
                { date: '2026-10-05 09:00', amount: 330000, memo: '가나상사' }];
  const out = A.bankLinesToMark(bank, { cmsRows: [], incomes: inc, normName: norm });
  assert.equal(out.length, 1); assert.equal(out[0].why, 'recorded'); assert.equal(out[0].incomeId, 'i1');
});

test('R9 — 정산일 하루는 더빌 줄 하나만 먹는다', () => {
  const cms = [{ _k: 'c1', status: 'ok', setdate: '2026-10-12', amount: 220000, fee: 0 }, { _k: 'c2', status: 'ok', setdate: '2026-10-12', amount: 110000, fee: 0 }];
  const bank = [{ date: '2026-10-12 10:00', amount: 330000, memo: '더빌이체3572' },
                { date: '2026-10-13 10:00', amount: 330000, memo: '더빌이체3572' }];
  const out = A.bankLinesToMark(bank, { cmsRows: cms, incomes: [], recordedKeys: { c1: true, c2: true } });
  assert.equal(out.length, 1); assert.equal(out[0].why, 'cms_sum'); assert.equal(out[0].row.date, '2026-10-12 10:00');
  assert.equal(out[0].day, '2026-10-12');
});

/* ── 최종 검토 고침 (2026-10-09) — 옛 줄·옛 입금 모양에서 자동 확정이 겹치지 않게 ── */
const normCo = s => String(s || '').replace(/\(주\)|㈜|주식회사|\s/g, '').toLowerCase();
const RW = (k, wd, sd) => ({ _k: k, code: '1001', name: '가나상사', amount: 220000, status: 'ok', wdate: wd, setdate: sd || '' });

test('C1 — 업체 번호 없이 이름만 있는 옛 입금도 «이미 입금관리에 있음» 으로 막는다', () => {
  const inc = [{ id: 'o1', companyId: '', companyName: '(주)가나상사', kind: '자문료', amount: 220000, date: '2026-08-12' },
               { id: 'o2', companyId: '', companyName: '(주)가나상사', kind: '자문료', amount: 220000, date: '2026-09-12' }];
  const out = A.judgeRows([RW('a8', '2026-08-10'), RW('a9', '2026-09-10')], ctx({ incomes: inc, since: '2026-08-01', normName: normCo }));
  assert.deepEqual(out.map(x => x.verdict), ['recorded', 'recorded']);
  assert.match(out[0].why, /이미 입금관리에 있음/);
  assert.equal(out[0].company.id, 'co-1', '업체는 회원코드로 정해진다 — 이름으로 잇지 않는다');
});

test('C1 — 받을 달이 앞서 적힌 입금(9/2 · 8월분)이 있으면 8/31 출금은 recorded', () => {
  const inc = [{ id: 'o3', companyId: 'co-1', companyName: '가나상사', kind: '자문료', amount: 220000, date: '2026-09-02', advisoryYm: '2026-08' }];
  assert.deepEqual(V([RW('a31', '2026-08-31')], ctx({ incomes: inc, since: '2026-08-01' })), ['recorded']);
});

test('C1 — 자동 시작일 이전 줄은 old, 이후 줄은 auto', () => {
  assert.deepEqual(V([RW('b1', '2026-09-28')], ctx({ since: '2026-10-01' })), ['old']);
  assert.deepEqual(V([RW('b2', '2026-10-10')], ctx({ since: '2026-10-01' })), ['auto']);
});

test('C1 — 시작일이 비면 쓰는 실행에선 전부 old, 미리보기에선 auto 로 보인다', () => {
  assert.deepEqual(V([RW('c1', '2026-10-10')], ctx({ since: '', preview: false })), ['old']);
  assert.deepEqual(V([RW('c2', '2026-10-10')], ctx({ since: '', preview: true })), ['auto']);
  assert.deepEqual(V([RW('c3', '2026-09-28')], ctx({ since: '2026-10-01', preview: true })), ['old'], '미리보기도 시작일이 있으면 자른다');
});

test('C1 — 이름만 같은 다른 업체 번호의 입금은 막지 않는다(번호가 있으면 번호로만 본다)', () => {
  const inc = [{ id: 'o4', companyId: 'co-9', companyName: '가나상사', kind: '자문료', amount: 220000, date: '2026-10-11' }];
  assert.deepEqual(V([RW('d1', '2026-10-10')], ctx({ incomes: inc, normName: normCo })), ['auto']);
});

test('C2 — 받을 달이 열려 있어도 입금일의 달이 마감이면 locked', () => {
  const inc = [{ id: 'o5', companyId: 'co-1', kind: '자문료', amount: 220000, date: '2026-08-20', advisoryYm: '2026-09' }];
  const it = A.judgeRows([RW('e1', '2026-09-30')], ctx({ incomes: inc, isLocked: ym => ym === '2026-09' }))[0];
  assert.equal(it.ym, '2026-10');
  assert.equal(it.verdict, 'locked');
  assert.match(it.why, /2026-09/);
});

test('I1 — 그날 줄이 하나라도 입금관리에 없으면 더빌 합계 줄을 표시하지 않는다', () => {
  const cms = [{ _k: 'p1', status: 'ok', setdate: '2026-10-12', amount: 220000, fee: 0 }, { _k: 'p2', status: 'ok', setdate: '2026-10-12', amount: 110000, fee: 0 }];
  const bank = [{ date: '2026-10-12 10:00', amount: 330000, memo: '더빌이체3572' }];
  assert.deepEqual(A.bankLinesToMark(bank, { cmsRows: cms, incomes: [], recordedKeys: { p1: true } }), []);
  assert.deepEqual(A.bankLinesToMark(bank, { cmsRows: cms, incomes: [] }), [], '목록을 안 주면 아무것도 표시하지 않는다');
  const out = A.bankLinesToMark(bank, { cmsRows: cms, incomes: [], recordedKeys: new Set(['p1', 'p2']) });
  assert.equal(out.length, 1); assert.equal(out[0].why, 'cms_sum');
});

test('I2 — 이미 다른 통장 줄이 가져간 입금·하루 넘게 떨어진 줄·CMS 입금은 짝짓지 않는다', () => {
  const inc = [{ id: 'i1', companyName: '(주)가나상사', amount: 330000, date: '2026-10-05' }];
  const line = { date: '2026-10-05 09:00', amount: 330000, memo: '가나상사' };
  assert.equal(A.bankLinesToMark([line], { incomes: inc, normName: normCo }).length, 1);
  assert.deepEqual(A.bankLinesToMark([line], { incomes: inc, normName: normCo, processedIncomeIds: { i1: true } }), []);
  assert.deepEqual(A.bankLinesToMark([{ date: '2026-10-08 09:00', amount: 330000, memo: '가나상사' }], { incomes: inc, normName: normCo }), [], '3일 떨어짐');
  const cmsInc = [Object.assign({ cmsKey: 'k' }, inc[0])];
  assert.deepEqual(A.bankLinesToMark([line], { incomes: cmsInc, normName: normCo }), [], 'CMS 입금은 더빌 합계 줄로만');
});

test('I5 — 입금 id 는 줄 지문에서 정해진다(두 번 만들어도 같은 id)', () => {
  const it = A.judgeRows([RW('2026-10-10|가나상사|220000|1001#1', '2026-10-10')], ctx())[0];
  const a = A.buildIncome(it, 1, 'P-001'), b = A.buildIncome(it, 999999, 'P-002');
  assert.equal(a.id, b.id);
  assert.match(a.id, /^fi-cms-/);
  assert.doesNotMatch(a.id, /[.#$\[\]\/]/, '파이어베이스 열쇠에 못 쓰는 글자가 없다');
  assert.equal(A.safeKey('a.b#c$d[e]f/g|가'), 'a_b_c_d_e_f_g|가');
});

test('I5 — 받기 스크립트·이알피 자동 처리·되돌리기가 같은 safeKey 를 쓴다', () => {
  const pull = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'thebill-pull.js'), 'utf8');
  assert.match(pull, /\{[^}]*\bsafeKey\b[^}]*\}\s*=\s*require\(['"]\.\.\/js\/pu-cms-auto\.js['"]\)/, '스크립트는 공용 safeKey 를 받아 쓴다');
  assert.doesNotMatch(pull, /(const|let|var|function)\s+safeKey\b/, '스크립트에 따로 만든 safeKey 가 없다');
  ['function erpCmsAutoRun(', 'function erpCmsUndo('].forEach(hd => {
    const b = cutFn(hd);
    assert.match(b, /PuCmsAuto\.safeKey\(/, hd + ' 는 PuCmsAuto.safeKey 를 쓴다');
    assert.doesNotMatch(b, /replace\(\/\[\.#\$/, hd + ' 에 따로 쓴 열쇠 다듬기가 없다');
  });
});
