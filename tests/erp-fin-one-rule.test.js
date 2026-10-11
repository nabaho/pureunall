/* 재무 판정 하나로 (2026-10-11 검토 fin.md 1~7)
   같은 «받았나» 를 화면마다 다른 잣대로 세어, 한 화면은 «받음» 다른 화면은 «안 받음» 이라 했다.
   ★ 값이 아니라 규칙을 본다 — 진짜 함수를 원본에서 떼어 vm 에서 돌린다.
   ① 되돌린 입금(undoneDate)·지운 입금(_deleted)은 «없는 돈» — 받았나·매출·자동 처리 어디서도
   ② 자문료 입금은 업체 번호(companyId)를 갖는다
   ③ 몇 월분 = advisoryYm || 입금일의 달 — 이알피와 pu-cms-auto 가 같은 답
   ④ 자동 처리: 번호 없는 옛 줄도 «다음 받을 달» 에 센다 · 받을 달만 맞은 것은 사람에게
   ⑤ CMS 몇 월분 = 업체 설정(cmsYmBase) · 줄 지문(cmsKey)으로 두 번 만들지 않는다
   ⑥ 입금 마감된 달은 넣지도 무르지도 않는다
   ⑦ 성과급 조정 줄(perf-adjust)은 매출이 아니다 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { cutFn } = require('./cut-fn');
const { finRuleSrc } = require('./fin-one-rule-src');
const A = require('../js/pu-cms-auto.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
const fn = (decl) => noComments(cutFn(SRC, decl));

/* 판정 묶음 + 고른 함수를 한 상자에 싣는다 */
function box(over, decls) {
  const ctx = Object.assign({ String, Array, Object, Math, Date, JSON, parseInt, isNaN, console,
    showToast: (m) => { ctx._toasts.push(String(m)); }, _toasts: [], window: {} }, over || {});
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(finRuleSrc(SRC) + '\n' + (decls || []).map((d) => cutFn(SRC, d)).join('\n'), ctx);
  return ctx;
}
const CO = { id: 'co-1', name: '가나상사' };
const ADV = (o) => Object.assign({ id: 'x', companyId: 'co-1', companyName: '가나상사', sourceKind: 'company', kind: '자문료', amount: 220000 }, o);

/* ══ ① 되돌린 입금은 없는 돈 ══ */
test('① 살아 있는 입금 — 되돌린 것·지운 것은 받았나에서 빠진다', () => {
  const c = box();
  const inc = [ADV({ id: 'u', date: '2026-09-10', undoneDate: '2026-09-11T00:00:00Z' }), ADV({ id: 'd', date: '2026-09-12', _deleted: true })];
  assert.equal(c.erpAdvisoryPaidFor(CO, '2026-09', inc).length, 0, '되돌린 9월 자문료를 «받음» 으로 칩니다 — 9월 후보가 다시 안 뜹니다');
  assert.equal(c.erpAdvisoryPaidFor(CO, '2026-09', c.erpAdvisoryIndex(inc)).length, 0, '색인도 같은 거르개');
  inc.push(ADV({ id: 'ok', date: '2026-09-15' }));
  assert.equal(c.erpAdvisoryPaidFor(CO, '2026-09', inc).length, 1);
});

test('① 읽는 자리마다 공용 판정을 거친다 — 따로 세는 자리가 남지 않는다', () => {
  assert.match(fn('function erpAddCompanyIncome('), /erpAdvisoryPaidFor\(co, ym,/);
  assert.match(fn('function erpAutoMarkCompanyIncome('), /erpAdvisoryPaidFor\(co, ym,/);
  const at = SRC.indexOf('(function addAdvisoryPending(){');
  assert.match(noComments(cutFn(SRC, '(function addAdvisoryPending()')), /erpAdvisoryPaidFor\(/, '미입금 후보');
  assert.ok(at > 0);
  const tab = cutFn(SRC, 'function IncomeCompanyTab(');
  ['function isPaid(', 'function paidInfo(', 'function getItem('].forEach((d) =>
    assert.match(noComments(cutFn(tab, d)), /erpAdvisoryPaidFor\(/, '입금관리 ' + d));
  const cms = fn('function CmsMatchModal(');
  assert.match(cms, /erpAdvisoryPaidFor\(c, ym,/, 'CMS 나누기의 «이미 입금»');
  assert.doesNotMatch(cms, /pd\[i\.companyName\]/, 'CMS 나누기가 아직 이름 + 입금일의 달로 셉니다');
  ['function confirmCMSImport(', 'function confirmAdvisoryImport('].forEach((d) =>
    assert.match(noComments(cutFn(tab, d)), /erpAdvisoryPaidFor\(/, '가져오기 ' + d));
});

test('① 「이미 확정됨」 색인은 되돌린 입금을 안 싣는다', () => {
  const recs = [{ id: 'u', amount: 330000, date: '2026-09-10', companyName: '가나', undoneDate: 'x' },
                { id: 'k', amount: 440000, date: '2026-09-10', companyName: '다라' }];
  const c = box({ dbGet: () => recs, erpNormName: (s) => String(s || ''), _erpFpByName: null, _erpFpById: null, _erpFpByAmt: null, _erpFpAt: 0 },
    ['function _erpFpBuild(', 'function erpAlreadyConfirmed(']);
  assert.equal(c.erpAlreadyConfirmed({ date: '2026-09-10', amount: 330000 }).length, 0, '되돌린 돈을 «이미 확정» 으로 알려 줍니다');
  assert.equal(c.erpAlreadyConfirmed({ date: '2026-09-10', amount: 440000 }).length, 1);
});

test('① pu-cms-auto 도 되돌린 입금을 안 센다 — 다음 받을 달·이미 있음·그 달 받음·통장 짝', () => {
  const und = ADV({ id: 'u1', date: '2026-10-02', advisoryYm: '2026-10', undoneDate: 'x' });
  assert.equal(A.nextAdvisoryYm(CO, [und], '2026-10-10'), '2026-10', '되돌린 10월분 때문에 받을 달이 11월로 밀립니다');
  const co = { id: 'co-1', name: '가나상사', status: 'active', monthlyAdvisoryFee: 220000, cmsMemberCodes: ['1001'] };
  const row = { _k: 'r1', code: '1001', name: '가나상사', amount: 220000, status: 'ok', wdate: '2026-10-05' };
  const v = A.judgeRows([row], { companies: [co], incomes: [und], since: '2026-01-01' })[0];
  assert.equal(v.verdict, 'auto', '되돌린 입금을 «이미 있음/그 달 받음» 으로 봅니다 — ' + v.verdict);
  const bank = [{ date: '2026-10-02 09:00', amount: 220000, memo: '가나상사' }];
  assert.deepEqual(A.bankLinesToMark(bank, { incomes: [und] }), [], '되돌린 입금과 통장 줄을 짝짓습니다');
});

test('① 사람이 되돌린 자동 입금의 줄은 저절로 되살리지 않는다(cmsKey 가 되돌린 입금에 있으면 skip)', () => {
  const co = { id: 'co-1', name: '가나상사', status: 'active', monthlyAdvisoryFee: 220000, cmsMemberCodes: ['1001'] };
  const row = { _k: 'r1', code: '1001', name: '가나상사', amount: 220000, status: 'ok', wdate: '2026-10-05' };
  const und = ADV({ id: 'fi-cms-r1', cmsKey: 'r1', date: '2026-10-05', undoneDate: 'x' });
  const v = A.judgeRows([row], { companies: [co], incomes: [und], since: '2026-01-01' })[0];
  assert.notEqual(v.verdict, 'auto', '되돌린 돈을 같은 id 로 다시 만들어 되살립니다');
});

test('① isLive 는 이알피 erpIncomeLive 와 같은 답', () => {
  const c = box();
  [null, {}, { _deleted: true }, { undoneDate: '2026-10-01' }, { undoneDate: '' }, { _deleted: false, undoneDate: null }]
    .forEach((x) => assert.equal(A.isLive(x), c.erpIncomeLive(x), JSON.stringify(x)));
});

/* ══ ② 업체 번호 ══ */
test('② 자문료를 만드는 업체 객체는 번호(id)를 싣는다 — 입금관리 표·CMS 나누기·나이스빌 입금표시·자동 대조', () => {
  const tab = noComments(cutFn(SRC, 'function IncomeCompanyTab('));
  const sl = tab.slice(tab.indexOf('var SOURCE_LIST'), tab.indexOf('function isBeforeContract('));
  assert.match(sl, /return \{\s*id:c\.id,/, '입금관리 SOURCE_LIST 에 id 가 없습니다 — 새 입금이 모두 companyId:\'\' 로 쌓입니다');
  const cms = fn('function CmsMatchModal(');
  assert.ok((cms.match(/return \{ id:c\.id, name:c\.name/g) || []).length >= 2, 'CMS 나누기의 두 풀 모두 id');
  const led = fn('function FinanceLedger(');
  const nb = led.slice(led.indexOf('async function nbMarkIncome('));
  assert.match(nb.slice(0, 4000), /var co = \{ id:r\.co\.id/, '나이스빌 입금표시가 id 를 버립니다');
  assert.match(tab, /var pool = allCompanies[\s\S]{0,400}return \{ id:c\.id,/, '자동 대조 풀');
});

test('② 받은 업체 번호를 새 입금의 companyId 로 적는다 — erpAddCompanyIncome·거래내역 확정', () => {
  const saved = [];
  const c = box({ dbGet: () => [], dbUpsert: (k, r) => { saved.push(r); return true; }, isIncomeLocked: () => false },
    ['function erpAddCompanyIncome(']);
  assert.equal(c.erpAddCompanyIncome({ id: 'co-7', name: '라마', fee: 110000 }, 9, 2026, '2026-09-30', '', '자문료'), true);
  assert.equal(saved[0].companyId, 'co-7');
  /* 거래내역 확정(saveIncome) — 자문료면 업체 번호를 companyId 에도 */
  const up = [];
  const c2 = box({ todayYMD: () => '2026-10-11', CURRENT_USER: { sid: 'P-1' }, erpUpsertIncome: (r) => { up.push(r); return true; } });
  vm.runInContext(cutFn(SRC, 'function saveIncome(row, pItem, opts)'), c2);
  c2.saveIncome({ date: '2026-10-01', amount: 220000, memo: 'x' }, { kind: 'advisory', ym: '2026-09', companyName: '가나상사', store: 'companies', item: { id: 'co-1' } });
  assert.equal(up[0].companyId, 'co-1', '거래내역 자문료 확정이 companyId 를 안 씁니다');
  assert.equal(up[0].advisoryYm, '2026-09');
  assert.match(fn('function FinanceLedger('), /companyId:\(_isAdv && d\.advCoId\) \? d\.advCoId/, '직접 등록 자문료');
});

/* ══ ③ 몇 월분 ══ */
test('③ 몇 월분 — 이알피 erpAdvisoryYmOf 와 pu-cms-auto ymOf 가 같은 답', () => {
  const c = box();
  const samples = [
    { date: '2026-10-01', advisoryYm: '2026-09' }, { date: '2026-10-01' }, { date: '2026-10-01 14:11:11' },
    { advisoryYm: ' 2026-08 ', date: '2026-09-02' }, { advisoryYm: '', date: '2026-07-31' }, {}, { date: null, advisoryYm: null },
  ];
  samples.forEach((s) => assert.equal(A.ymOf(s), c.erpAdvisoryYmOf(s), JSON.stringify(s)));
});

test('③ 10/1 에 들어온 9월분은 10월 «받음» 이 아니다 — CMS 나누기·업체 등록이 10월분을 건너뛰지 않는다', () => {
  const inc = [ADV({ id: 's', date: '2026-10-01', advisoryYm: '2026-09' })];
  const saved = [];
  const c = box({ dbGet: () => inc, dbUpsert: (k, r) => { saved.push(r); return true; }, isIncomeLocked: () => false },
    ['function erpAddCompanyIncome(']);
  assert.equal(c.erpAdvisoryPaidFor(CO, '2026-10', inc).length, 0);
  assert.equal(c.erpAdvisoryPaidFor(CO, '2026-09', inc).length, 1);
  assert.equal(c.erpAddCompanyIncome({ id: 'co-1', name: '가나상사', fee: 220000 }, 10, 2026, '2026-10-25', '', '자문료'), true, '10월분을 «이미 있음» 으로 막습니다');
  assert.equal(c.erpAddCompanyIncome({ id: 'co-1', name: '가나상사', fee: 220000 }, 9, 2026, '2026-10-25', '', '자문료'), false, '9월분을 또 만듭니다');
  assert.equal(saved[0].advisoryYm, '2026-10', '받을 달을 적어 둔다');
});

test('③ 이름이 같아도 번호가 다르면 남의 입금, 번호 없는 옛 줄은 이름으로', () => {
  const c = box();
  assert.equal(c.erpAdvisoryPaidFor(CO, '2026-09', [ADV({ companyId: 'co-9', date: '2026-09-01' })]).length, 0);
  assert.equal(c.erpAdvisoryPaidFor(CO, '2026-09', [ADV({ companyId: '', date: '2026-09-01' })]).length, 1);
  assert.equal(c.erpAdvisoryPaidFor(CO, '2026-09', [ADV({ kind: '컨설팅', date: '2026-09-01' })]).length, 0, '컨설팅 돈을 자문료로 칩니다');
});

/* ══ ④ 자동 처리 — 업체 맞추기 하나 · 받을 달만 맞음은 사람에게 ══ */
const COB = { id: 'co-b', name: '비상사', status: 'active', monthlyAdvisoryFee: 220000, cmsMemberCodes: ['2001'] };
test('④ 번호 없는 옛 9월 줄도 «다음 받을 달» 에 센다 — 10월 자문료가 «이미 있음» 으로 조용히 빠지지 않는다', () => {
  const inc = [{ id: 'a8', companyId: 'co-b', companyName: '비상사', kind: '자문료', amount: 220000, date: '2026-08-25' },
               { id: 'a9', companyId: '', companyName: '비상사', kind: '자문료', amount: 220000, date: '2026-09-25' }];
  const row = { _k: 'b10', code: '2001', name: '비상사', amount: 220000, status: 'ok', wdate: '2026-10-27' };
  const it = A.judgeRows([row], { companies: [COB], incomes: inc, since: '2026-01-01' })[0];
  assert.equal(it.ym, '2026-10', '받을 달이 9월로 잡힙니다 — 번호 없는 9월 줄을 안 셌습니다');
  assert.equal(it.verdict, 'auto', it.verdict + ' — ' + it.why);
});

test('④ 받을 달만 맞은 입금(금액·날짜 다름)은 «이미 있음» 이 아니라 사람 확인 — 더빌 합계 줄도 처리됨으로 안 찍는다', async () => {
  const chk = fn('function FinanceAuto(').match(/var CHECK = \{([^}]*)\}/)[1];
  /* (가) fin.md 4 의 그 장면 — 8월(번호)·9월(번호 있음) 다음, 10월 일부입금(번호 없음)이 있을 때 10/20 출금 */
  const inc = [{ id: 'a9', companyId: 'co-b', companyName: '비상사', kind: '자문료', amount: 220000, date: '2026-09-01', advisoryYm: '2026-09' },
               { id: 'p10', companyId: '', companyName: '비상사', kind: '자문료', amount: 100000, date: '2026-10-02', advisoryYm: '2026-10' }];
  const row = { _k: 'b10', code: '2001', name: '비상사', amount: 220000, status: 'ok', wdate: '2026-10-20', setdate: '2026-10-21' };
  const it = A.judgeRows([row], { companies: [COB], incomes: inc, since: '2026-01-01' })[0];
  assert.notEqual(it.verdict, 'recorded', '받을 달만 같다고 «이미 입금관리에 있음» 으로 칩니다 — ' + it.why);
  assert.notEqual(it.verdict, 'auto', '이미 그 달 입금이 있는데 또 만듭니다');
  assert.ok(chk.indexOf(it.verdict + ':') >= 0, '그 판정(' + it.verdict + ')이 «확인할 것» 목록에 안 뜹니다');
  /* 이알피 자동 처리에서 실제로 돌려 본다 — 이 줄은 recordedKeys 에 안 들어가 더빌 합계 줄이 «처리됨» 이 되지 않는다 */
  const run = await runErp({ incomes: inc, row: row, co: COB });
  assert.equal(run.calls.upsert.length, 0, '자동으로 입금을 만듭니다');
  assert.equal(run.calls.mark.length, 0, '받을 달만 맞은 줄로 더빌 합계 줄을 «처리됨» 으로 찍습니다 — 아무도 다시 안 봅니다');
  /* (나) 업체가 «걷은 달» 기준이라 받을 달이 이미 든 달로 정해질 때 */
  const inc2 = [{ id: 'm', companyId: 'co-b', companyName: '비상사', kind: '자문료', amount: 100000, date: '2026-10-01', advisoryYm: '2026-10' }];
  const co2 = Object.assign({}, COB, { cmsYmBase: 'wdate' });
  const it2 = A.judgeRows([row], { companies: [co2], incomes: inc2, since: '2026-01-01' })[0];
  assert.notEqual(it2.verdict, 'recorded'); assert.notEqual(it2.verdict, 'auto');
  assert.ok(chk.indexOf(it2.verdict + ':') >= 0, '그 판정(' + it2.verdict + ')이 «확인할 것» 목록에 안 뜹니다');
  const run2 = await runErp({ incomes: inc2, row: row, co: co2 });
  assert.equal(run2.calls.mark.length, 0);
});

test('④ 금액·날짜까지 맞으면 여전히 «이미 있음» 이고 더빌 합계 줄도 처리됨', async () => {
  const inc = [{ id: 'm', companyId: 'co-b', companyName: '비상사', kind: '자문료', amount: 220000, date: '2026-10-21', advisoryYm: '2026-10' }];
  const row = { _k: 'b10', code: '2001', name: '비상사', amount: 220000, status: 'ok', wdate: '2026-10-20', setdate: '2026-10-21' };
  const run = await runErp({ incomes: inc, row: row, co: COB });
  assert.equal(run.res.items[0].verdict, 'recorded');
  assert.equal(run.calls.mark.length, 1);
});

/* ══ ⑤ CMS 몇 월분 = 업체 설정 · 줄 지문 ══ */
test('⑤ 자동 처리도 업체의 「몇 월분」 설정을 따른다 — 이알피 erpCmsYmOf 와 같은 답, 설정이 없을 때만 «직전 + 1»', () => {
  const c = box({}, ['function erpCmsYmBase(', 'function erpCmsYmOf(']);
  const rows = [{ wdate: '2026-06-30', setdate: '2026-07-01' }, { wdate: '2026-06-30', setdate: '' }, { wdate: '', setdate: '2026-07-01' }];
  ['wdate', 'setdate'].forEach((b) => rows.forEach((r) =>
    assert.equal(A.cmsYmOf({ cmsYmBase: b }, r), c.erpCmsYmOf(r, c.erpCmsYmBase({ cmsYmBase: b })), b + ' ' + JSON.stringify(r))));
  assert.equal(A.cmsYmOf({}, rows[0]), '', '설정이 없으면 비운다(직전 + 1 로 물러난다)');
  const inc = [{ id: 'p', companyId: 'co-b', kind: '자문료', amount: 220000, date: '2026-05-30', advisoryYm: '2026-05' }];
  const row = { _k: 'k6', code: '2001', name: '비상사', amount: 220000, status: 'ok', wdate: '2026-06-30', setdate: '2026-07-01' };
  const ctx = { incomes: inc, since: '2026-01-01' };
  assert.equal(A.judgeRows([row], Object.assign({ companies: [Object.assign({}, COB, { cmsYmBase: 'setdate' })] }, ctx))[0].ym, '2026-07');
  assert.equal(A.judgeRows([row], Object.assign({ companies: [Object.assign({}, COB, { cmsYmBase: 'wdate' })] }, ctx))[0].ym, '2026-06');
  assert.equal(A.judgeRows([row], Object.assign({ companies: [COB] }, ctx))[0].ym, '2026-06', '설정 없음 → 직전(5월) + 1');
});

test('⑤ 업체 색인이 「몇 월분」 설정을 싣는다 — 안 실으면 다시 열 때 늘 «들어온 달» 로 돌아간다', () => {
  const c = box({ dbGet: () => [{ id: 'co-1', name: '가나', status: 'active', cmsYmBase: 'wdate' }], erpNormName: (s) => s },
    ['function _nbDigits(', 'function erpNicebillCoIndex(', 'function erpCmsYmBase(']);
  const ix = c.erpNicebillCoIndex();
  assert.equal(c.erpCmsYmBase(ix.list[0]), 'wdate');
});

test('⑤ 줄 지문 — 자동 처리의 rowKey 와 같고, 보관분의 #1 은 그대로', () => {
  const c = box({ PuCmsAuto: A }, ['function _nbNorm(', 'function _nbRowSig(']);
  const r = { wdate: '2026-10-06', name: '가 나 상사', amount: 110000, code: '77' };
  assert.equal(c.erpCmsRowKey(Object.assign({ _k: 'nb3' }, r)), A.rowKey(r), '갓 읽은 파일 줄(nb3)은 지문을 새로 낸다');
  assert.equal(c.erpCmsRowKey(Object.assign({ _k: A.rowKey(r) + '#1' }, r)), A.rowKey(r) + '#1');
});

test('⑤ 같은 지문의 입금이 있으면 만들지 않고, 만들면 지문을 남긴다 — ②③④ 세 길', () => {
  const inc = [ADV({ id: 'a', cmsKey: 'K1', date: '2026-06-30', advisoryYm: '2026-06' })];
  const saved = [];
  const c = box({ dbGet: () => inc, dbUpsert: (k, r) => { saved.push(r); return true; }, isIncomeLocked: () => false },
    ['function erpAddCompanyIncome(']);
  // 자동 처리가 6월분으로 넣은 줄을, 정산일 기준(7월)으로 또 누르면 — 지문이 같아 만들지 않는다
  assert.equal(c.erpAddCompanyIncome({ id: 'co-1', name: '가나상사', fee: 220000 }, 7, 2026, '2026-07-01', '', undefined, undefined, { cmsKey: 'K1' }), false,
    '한 번 걷은 돈이 6·7월 두 달 치가 됩니다');
  assert.equal(c.erpAddCompanyIncome({ id: 'co-1', name: '가나상사', fee: 220000 }, 8, 2026, '2026-08-01', '', undefined, undefined, { cmsKey: 'K2' }), true);
  assert.equal(saved[0].cmsKey, 'K2');
  const led = fn('function FinanceLedger(');
  assert.match(led, /cmsKey: erpCmsRowKey\(r\)/, '② 나이스빌 입금표시가 지문을 안 넘깁니다');
  const cms = fn('function CmsMatchModal(');
  assert.match(cms, /erpCmsKeyTaken\(_ck,/, '③ CMS 나누기가 지문을 안 봅니다');
  assert.match(cms, /\{ cmsKey:_ck \}/);
  const imp = noComments(cutFn(cutFn(SRC, 'function IncomeCompanyTab('), 'function confirmCMSImport('));
  assert.match(imp, /erpCmsKeyTaken\(cmsKey,/, '④ 입금관리 나이스빌 파일이 지문을 안 봅니다');
  assert.match(imp, /cmsKey:cmsKey/);
  assert.match(imp, /erpCmsYmBase\(co\)/, '④ 몇 월분을 업체 설정으로');
});

/* ══ ⑥ 입금 마감 ══ */
test('⑥ 입금 마감된 달 — 문(erpUpsertIncome)은 넣지 않고, 되돌리기(erpUndoIncome)도 무르지 않는다', () => {
  const ups = [], pat = [];
  const c = box({ isIncomeLocked: (ym) => ym === '2026-09', dbUpsert: (k, r) => { ups.push(r); return true; },
    dbPatch: (k, id, p) => { pat.push(p); return true; }, erpPerfYMFor: () => '', erpPerfLockInfo: () => ({ locked: false }), CURRENT_USER: { sid: 'P-1' } },
    ['function erpUpsertIncome(', 'function erpUndoIncome(']);
  assert.equal(c.erpUpsertIncome({ id: 'n', date: '2026-09-30', amount: 1 }), false, '마감된 9월에 입금을 넣습니다');
  assert.equal(ups.length, 0);
  assert.notEqual(c.erpUpsertIncome({ id: 'n2', date: '2026-10-01', amount: 1 }), false);
  assert.equal(c.erpUndoIncome({ id: 'o', date: '2026-09-10', kind: '자문료' }), false, '마감된 9월 입금을 무릅니다');
  assert.equal(pat.length, 0);
  assert.equal(c.erpUndoIncome({ id: 'o2', date: '2026-10-10', kind: '자문료' }), true);
  assert.ok(c._toasts.some((t) => /마감/.test(t)), '왜 안 되는지 알려 준다');
});

test('⑥ 거래내역 확정은 문이 막으면 멈춘다 — 원본에 «받음» 만 찍히고 입금은 없는 일이 없게', () => {
  const pat = [];
  const c2 = box({ todayYMD: () => '2026-10-11', CURRENT_USER: { sid: 'P-1' }, erpUpsertIncome: () => false,
    dbPatch: (k, id, p) => { pat.push(p); }, ERP_SPLIT_KIND: {} });
  vm.runInContext(cutFn(SRC, 'function saveIncome(row, pItem, opts)'), c2);
  assert.throws(() => c2.saveIncome({ date: '2026-09-01', amount: 1 }, { kind: 'consult', companyName: 'x', store: 'consultings', item: { id: 'c1' } }));
  assert.equal(pat.length, 0, '입금이 막혔는데 원본에 입금표시를 했습니다');
  assert.throws(() => c2.saveIncome({ date: '2026-09-01', amount: 1 }, { kind: 'advisory', companyName: 'x', store: 'companies', item: { id: 'co' } }));
});

/* ══ ⑦ 매출 ══ */
test('⑦ 매출로 세는 입금 — 성과급 조정 줄·되돌린 입금은 빠진다, 손익·부가세가 이 판정을 쓴다', () => {
  const c = box();
  assert.equal(c.erpIncomeIsRevenue({ sourceKind: 'perf-adjust', amount: -300000, date: '2026-10-01' }), false);
  assert.equal(c.erpIncomeIsRevenue({ sourceKind: 'case', amount: 1, undoneDate: 'x' }), false);
  assert.equal(c.erpIncomeIsRevenue({ sourceKind: 'case', amount: 1 }), true);
  const pnl = fn('function FinancePnL(');
  assert.match(pnl.slice(pnl.indexOf('var monthIncomes'), pnl.indexOf('var monthExpenses')), /erpIncomeIsRevenue\(i\)/, '손익계산서 매출');
  const vat = fn('function FinanceVAT(');
  assert.match(cutFn(vat, 'function quarterIncomes('), /erpIncomeIsRevenue\(i\)/, '예상부가세 매출');
});

/* ── 이알피 자동 처리를 스텁 상자에서 돌린다 (cms-auto-erp 검사와 같은 꼴) ── */
function runErp(o) {
  const calls = { upsert: [], mark: [] };
  const bankRow = { date: String(o.row.setdate || o.row.wdate) + ' 10:00', amount: o.row.amount, memo: '더빌이체3572', type: 'income' };
  const data = {
    app_settings: { cmsAutoConfirm: true, cmsAutoSince: '2026-01-01' },
    companies: [o.co], finance_income: o.incomes,
    ledger_batches: [{ src: 'bank', rows: [bankRow] }],
  };
  const ctx = {
    console, Date, Math, Object, JSON, String, parseInt, Promise, Event: function () {},
    CURRENT_USER: { sid: 'P-001' }, isAdminByUser: () => true,
    fbDb: { ref: () => ({ once: () => Promise.resolve({ val: () => ({ rows: { k: o.row }, status: {} }) }) }) },
    dbGet: (k, d) => (k in data ? data[k] : d),
    erpCmsLedgerGet: () => null, erpCmsLedgerSave: () => {},
    erpBankProcessedStore: () => ({}), erpBankRowKey: (r) => String(r.date) + '|' + r.amount,
    erpNormName: (s) => String(s || '').toLowerCase().replace(/\s+/g, ''), erpCleanMemo: (s) => String(s || ''),
    isIncomeLocked: () => false, getActiveUsers: () => [],
    erpUpsertIncome: (rec) => { calls.upsert.push(rec); },
    erpMarkBankRowsProcessed: (list) => { list.forEach((m) => calls.mark.push(m)); return list.length; },
  };
  ctx.window = ctx; ctx.dispatchEvent = () => true;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-cms-auto.js'), 'utf8'), ctx);
  vm.runInContext(cutFn(SRC, 'function erpCmsAutoRun('), ctx);
  return ctx.erpCmsAutoRun({ write: true }).then((res) => ({ res, calls }));
}
