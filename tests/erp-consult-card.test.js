/* 재무관리 — 카드로 낸 상담료의 «업무 기록» (대표 2026-11-16 「신용카드로 상담료 계산한 부분은 정확하게 업무 기록이 남지 않는다」)
   처리 기준 docs/규칙/카드-상담료-기록.md · 설계 docs/superpowers/specs/2026-11-16-입금-일괄-명의-카드상담-design.md §6

   ■ 왜
   직접 등록 창은 상담접수 번호(consultId)를 «넘기기만» 하고 저장하지 않았다. 그래서 상담접수 카드에는 «얼마를 어떻게 받았나»가 안 남고,
   입금에는 «어느 상담인가»가 안 남았다. 카드는 승인과 정산 입금이 다른 날이라, 승인 때 적어 둔 것과 나중에 들어온 돈이 이어지지도 않았다.

   ■ 지키는 것
   ① 결제 한 줄은 «같은 번호»로 두 곳에 남는다 — 입금 줄(consultId·consultPayId …)과 상담접수 카드(consultPayments[])
   ② 카드는 카드사·승인번호(6~12자리 숫자)가 있어야 적힌다. 승인번호가 없으면 «없음»을 사람이 골라야 하고, 그 줄은 증빙 점검에 걸린다
   ③ 카드번호 전체·유효기간·CVC 는 저장하지 않는다 — 끝 네 자리만
   ④ 입금 전 카드 승인(approved)은 «받은 돈»이 아니다. 정산 입금이 들어오면 «같은 줄»을 입금 확인(received)으로 잇는다(두 번 적지 않는다)
   ⑤ 정산 입금 후보는 수수료율 한도 안·승인일이 입금일 앞 N일 안만, 고르는 것은 사람이다
   ⑥ 증빙이 빈 상담료는 지우지 않고 무엇이 비었는지 말한다(증빙 없음·승인번호 없음·상담접수 안 이어짐)
   ★ 함수를 떠서 «돌려» 본다. 자료는 모두 지어낸 것이다. 값(14일·3.5%)을 못 박지 않고 «규칙»을 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => {
  const i = SRC.indexOf(a), j = SRC.indexOf(b, i + 1);
  assert.ok(i >= 0 && j > i, '잘라내지 못함: ' + a);
  return SRC.slice(i, j);
};
function makeCtx() {
  const ctx = { console, Math, Object, JSON, parseInt, parseFloat, String, Array, Date, Promise, RegExp };
  ctx.window = ctx;
  vm.createContext(ctx);
  ctx.ERP_FEE_MAX_RATE = 0.035;
  vm.runInContext(cut('var ERP_CARD_COMPANIES', '/* ── 상담료 후보 (상담접수와 이름 대조) ──'), ctx);
  return ctx;
}
const CARD = (over) => Object.assign({ amount: 220000, method: 'card', date: '2026-11-14', cardCompany: '신한', approvalNo: '12345678', cardNo: '1234-5678-9012-3456' }, over || {});

/* ───────── ② ③ 한 줄 만들기 ───────── */
test('② 카드는 카드사·승인번호가 있어야 적히고, 카드번호는 «끝 네 자리»만 남는다', () => {
  const c = makeCtx();
  const r = c.erpConsultPayBuild(CARD());
  assert.equal(r.ok, true);
  assert.equal(r.pay.cardLast4, '3456');
  assert.equal(r.pay.approvalNo, '12345678');
  const dump = JSON.stringify(r.pay);
  assert.ok(dump.indexOf('1234-5678-9012') < 0 && dump.indexOf('123456789012') < 0, '카드번호 앞자리는 어디에도 남지 않는다');
  assert.ok(!('cardNo' in r.pay), 'cardNo 칸 자체가 저장되지 않는다');
});

test('③ 카드번호 칸에 긴 번호·공백·하이픈을 붙여 넣어도 끝 네 자리만', () => {
  const c = makeCtx();
  assert.equal(c.erpCardLast4('4111 1111 1111 9876'), '9876');
  assert.equal(c.erpCardLast4('9876'), '9876');
  assert.equal(c.erpCardLast4('12'), '', '네 자리가 안 되면 비운다');
  assert.equal(c.erpCardLast4(''), '');
});

test('② 승인번호 — 6~12자리 숫자만, 공백·하이픈은 걷는다', () => {
  const c = makeCtx();
  assert.equal(c.erpApprovalNoOk('123456'), true);
  assert.equal(c.erpApprovalNoOk('1234 5678'), true);
  assert.equal(c.erpApprovalNoOk('12-34-56-78'), true);
  assert.equal(c.erpApprovalNoOk('12345'), false, '너무 짧다');
  assert.equal(c.erpApprovalNoOk('1234567890123'), false, '너무 길다');
  assert.equal(c.erpApprovalNoOk('abc12345'), false);
  assert.equal(c.erpApprovalNoOk(''), false);
});

test('② 거절 규칙 — 금액 없음·결제수단 없음·모르는 카드사·승인번호 없음(«없음» 안 고름)', () => {
  const c = makeCtx();
  const no = (o) => { const r = c.erpConsultPayBuild(o); assert.equal(r.ok, false, JSON.stringify(o)); assert.ok(r.why); };
  no(CARD({ amount: 0 }));
  no(CARD({ amount: -5 }));
  no(CARD({ method: '' }));
  no(CARD({ method: 'bitcoin' }));
  no(CARD({ cardCompany: '' }));
  no(CARD({ cardCompany: '없는카드사' }));
  no(CARD({ approvalNo: '' }));
  no(CARD({ approvalNo: '12ab' }));
});

test('② 승인번호를 «없음»으로 골라야만 번호 없이 적히고, 표시가 남는다', () => {
  const c = makeCtx();
  const r = c.erpConsultPayBuild(CARD({ approvalNo: '', approvalMissing: true }));
  assert.equal(r.ok, true);
  assert.equal(r.pay.approvalNo, '');
  assert.equal(r.pay.approvalMissing, true);
});

test('① 현금·계좌는 카드 칸(카드사·승인번호)을 요구하지 않고, 카드 칸을 싣지도 않는다', () => {
  const c = makeCtx();
  const r = c.erpConsultPayBuild({ amount: 110000, method: 'cash', date: '2026-11-14' });
  assert.equal(r.ok, true);
  assert.ok(!('cardCompany' in r.pay) && !('approvalNo' in r.pay));
  assert.equal(r.pay.status, 'received');
});

test('④ 카드 승인만 먼저 적으면 입금 전(approved) — 그 밖에는 입금 확인(received)', () => {
  const c = makeCtx();
  assert.equal(c.erpConsultPayBuild(CARD({ status: 'approved' })).pay.status, 'approved');
  assert.equal(c.erpConsultPayBuild(CARD({})).pay.status, 'received');
  assert.equal(c.erpConsultPayBuild(CARD({ status: 'whatever' })).pay.status, 'received');
});

/* ───────── ④ 받은 돈 · 목록에 반영 ───────── */
test('④ 상담접수가 «받은 돈»에는 입금 확인된 것만 센다(입금 전 승인·취소는 뺀다)', () => {
  const c = makeCtx();
  const ct = { consultPayments: [
    { id: 'a', amount: 220000, status: 'received' }, { id: 'b', amount: 110000, status: 'approved' },
    { id: 'c', amount: 55000, status: 'received', _deleted: true }, { id: 'd', amount: 33000, status: 'cancelled' }] };
  assert.equal(c.erpConsultPaidSum(ct), 220000);
  assert.equal(c.erpConsultPaymentsOf(ct).length, 2, '지운·취소한 줄은 목록에서 빠진다');
  assert.equal(c.erpConsultPaidSum(null), 0);
});

test('④ 정산 입금이 들어오면 «입금 전 승인» 그 줄을 입금 확인으로 바꾼다 — 새 줄을 더하지 않는다', () => {
  const c = makeCtx();
  const list = [{ id: 'cp-1', method: 'card', status: 'approved', amount: 220000, approvalNo: '12345678', cardCompany: '신한' }];
  const out = c.erpConsultPaymentsAfter(list, { incomeId: 'fi-9', date: '2026-11-17', amount: 220000, netAmount: 213000, fee: 7000 }, 'cp-1');
  assert.equal(out.length, 1, '두 번 적지 않는다');
  assert.equal(out[0].status, 'received');
  assert.equal(out[0].incomeId, 'fi-9');
  assert.equal(out[0].approvalNo, '12345678', '승인 정보는 그대로');
  assert.equal(out[0].amount, 220000, '승인 금액(매출) 그대로');
  assert.equal(out[0].fee, 7000);
  assert.equal(list[0].status, 'approved', '원본은 건드리지 않는다');
});

test('④ 이을 줄이 없거나 이미 입금 확인된 줄이면 null — 말없이 새 줄을 더하지 않는다', () => {
  const c = makeCtx();
  assert.equal(c.erpConsultPaymentsAfter([], { incomeId: 'x' }, 'nope'), null);
  assert.equal(c.erpConsultPaymentsAfter([{ id: 'cp-1', status: 'received' }], { incomeId: 'x' }, 'cp-1'), null, '이미 입금 확인된 줄을 또 바꾸지 않는다');
});

test('① 잇는 줄이 없으면 끝에 더한다(직접 등록이 상담접수에 처음 적는 경우)', () => {
  const c = makeCtx();
  const out = c.erpConsultPaymentsAfter([{ id: 'cp-0', status: 'received' }], { id: 'cp-2', status: 'received', incomeId: 'fi-1' }, '');
  assert.equal(out.length, 2);
  assert.equal(out[1].incomeId, 'fi-1');
});

/* ───────── ⑤ 정산 입금 후보 ───────── */
const CT = (id, pays) => ({ id, clientName: '가상의뢰인' + id, consultPayments: pays });
const AP = (id, amount, date, over) => Object.assign({ id, method: 'card', status: 'approved', amount, approvalDate: date, date, cardCompany: '신한', approvalNo: '1234567' + id.slice(-1) }, over || {});
test('⑤ 정산 입금 후보 — 수수료를 뺀 금액이면서 승인일이 입금일보다 «앞서되 가까운» 입금 전 승인만', () => {
  const c = makeCtx();
  const intakes = [CT('c1', [AP('cp-1', 220000, '2026-11-14'), AP('cp-2', 110000, '2026-11-14')])];
  const row = { amount: 213000, date: '2026-11-17' };
  const cands = c.erpConsultSettleCands(row, intakes);
  assert.equal(cands.length, 1);
  assert.equal(cands[0].pay.id, 'cp-1');
  assert.equal(cands[0].fee, 7000);
  assert.equal(cands[0].gross, 220000);
});

test('⑤ 승인 금액보다 «더» 들어온 돈·수수료율 한도를 넘게 모자란 돈·승인일이 입금보다 뒤인 승인·너무 오래된 승인은 후보가 아니다', () => {
  const c = makeCtx();
  const it = (pays) => [CT('c1', pays)];
  assert.equal(c.erpConsultSettleCands({ amount: 230000, date: '2026-11-17' }, it([AP('cp-1', 220000, '2026-11-14')])).length, 0, '더 들어옴');
  assert.equal(c.erpConsultSettleCands({ amount: 150000, date: '2026-11-17' }, it([AP('cp-1', 220000, '2026-11-14')])).length, 0, '수수료로 볼 수 없는 모자람');
  assert.equal(c.erpConsultSettleCands({ amount: 213000, date: '2026-11-10' }, it([AP('cp-1', 220000, '2026-11-14')])).length, 0, '승인이 입금보다 뒤');
  assert.equal(c.erpConsultSettleCands({ amount: 213000, date: '2026-12-30' }, it([AP('cp-1', 220000, '2026-11-14')])).length, 0, '너무 오래전 승인');
});

test('⑤ 이미 입금 확인된 승인·카드가 아닌 결제·취소한 줄은 후보가 아니다', () => {
  const c = makeCtx();
  const row = { amount: 213000, date: '2026-11-17' };
  const pays = [AP('cp-1', 220000, '2026-11-14', { status: 'received' }), AP('cp-2', 220000, '2026-11-14', { method: 'cash' }),
    AP('cp-3', 220000, '2026-11-14', { status: 'cancelled' }), AP('cp-4', 220000, '2026-11-14', { _deleted: true })];
  assert.equal(c.erpConsultSettleCands(row, [CT('c1', pays)]).length, 0);
});

test('⑤ 후보는 수수료가 «적은 순»으로 — 여럿이어도 고르는 것은 사람이다(여기는 후보만 낸다)', () => {
  const c = makeCtx();
  const row = { amount: 213000, date: '2026-11-17' };
  const out = c.erpConsultSettleCands(row, [CT('c1', [AP('cp-1', 220000, '2026-11-14')]), CT('c2', [AP('cp-2', 214000, '2026-11-15')])]);
  assert.equal(out.length, 2);
  assert.equal(out[0].pay.id, 'cp-2');
  assert.ok(out[0].fee < out[1].fee);
  assert.equal(c.erpConsultSettleCands({ amount: 0, date: '2026-11-17' }, [CT('c1', [AP('cp-1', 220000, '2026-11-14')])]).length, 0);
});

/* ───────── ⑥ 증빙 점검 ───────── */
test('⑥ 증빙 점검 — 무엇이 비었는지를 말한다(없는 것은 빈 문자열)', () => {
  const c = makeCtx();
  const ok = { kind: '상담료', docType: 'cash', payMethod: 'card', approvalNo: '12345678', consultId: 'ct-1' };
  assert.equal(c.erpConsultEvidenceGap(ok), '');
  assert.match(c.erpConsultEvidenceGap(Object.assign({}, ok, { docType: 'none' })), /증빙 없음/);
  assert.match(c.erpConsultEvidenceGap(Object.assign({}, ok, { approvalNo: '' })), /승인번호/);
  assert.match(c.erpConsultEvidenceGap(Object.assign({}, ok, { consultId: '' })), /상담접수/);
});

test('⑥ 상담료가 아닌 입금·지운 입금·되돌린 입금은 점검하지 않는다', () => {
  const c = makeCtx();
  const bad = { kind: '자문료', docType: 'none' };
  assert.equal(c.erpConsultEvidenceGap(bad), '');
  assert.equal(c.erpConsultEvidenceGap({ kind: '상담료', docType: 'none', _deleted: true }), '');
  assert.equal(c.erpConsultEvidenceGap({ kind: '상담료', docType: 'none', undoneDate: '2026-11-17' }), '');
  assert.equal(c.erpConsultEvidenceGap(null), '');
});

test('⑥ 카드 상담료 한 줄 설명 — 결제수단·금액·카드사·승인번호(입금 전이면 표시)', () => {
  const c = makeCtx();
  const s = c.erpConsultPayLabel({ method: 'card', amount: 220000, cardCompany: '신한', approvalNo: '12345678', status: 'approved' });
  assert.match(s, /카드/); assert.match(s, /220,000/); assert.match(s, /신한/); assert.match(s, /12345678/); assert.match(s, /입금 전/);
  assert.match(c.erpConsultPayLabel({ method: 'card', amount: 1000, cardCompany: '삼성', approvalNo: '', status: 'received' }), /승인번호 없음/);
});

/* ───────── ① ⑥ 저장 길 · 화면 연결 (짝 확인) ───────── */
const FL = cut('function FinanceLedger(', 'function FinanceIncome');
const DIRECT = cut('  function saveDirectIncome(d){', '  // ── 출금 등록 ──');
test('① 직접 등록이 상담접수 번호·결제 한 줄을 입금 줄에 «저장»한다(예전에는 넘기기만 했다)', () => {
  ['consultId', 'consultPayId', 'payMethod', 'cardCompany', 'approvalNo', 'cardLast4', 'approvalDate'].forEach((k) =>
    assert.ok(DIRECT.indexOf(k + ':') >= 0, k + ' 를 입금 줄에 적지 않는다'));
  assert.ok(DIRECT.indexOf('erpConsultPayBuild(') >= 0, '결제 한 줄은 한 함수에서 만든다(검증 포함)');
});

test('① 직접 등록은 «입금을 저장한 뒤에» 상담접수 카드에 같은 줄을 적고, 카드 검증이 막히면 입금도 안 만든다', () => {
  assert.ok(DIRECT.indexOf('erpConsultPayBuild(') < DIRECT.indexOf('erpUpsertIncome('), '검증이 먼저(막히면 저장 안 함)');
  assert.ok(DIRECT.indexOf('erpConsultPaymentsAfter(') > DIRECT.indexOf('erpUpsertIncome('), '상담접수 기록은 입금 저장 뒤');
  assert.match(DIRECT, /dbPatch\('contracts', d\.consultId, \{ consultPayments:/, '상담접수 카드에 적는다');
});

test('① 카드번호 전체·유효기간·CVC 를 저장하는 칸은 없다', () => {
  assert.ok(!/cvc|cvv|expir|유효기간/i.test(DIRECT), '직접 등록 저장 길에 카드 민감정보 칸이 없다');
  assert.ok(DIRECT.indexOf('cardNo:') < 0, 'cardNo(전체 번호) 를 입금 줄에 적지 않는다 — 끝 네 자리(cardLast4)만');
});

test('⑥ 확정 이력에 증빙 점검 딱지와 모아 보기가 있다', () => {
  assert.ok(FL.indexOf('erpConsultEvidenceGap(fi)') >= 0);
  assert.ok(FL.indexOf('setGapOnly(!gapOnly)') >= 0);
});

test('⑤ 직접 등록 창이 정산 입금 후보를 보여 주고 «이 승인과 잇기»는 사람이 누른다', () => {
  assert.ok(FL.indexOf('erpConsultSettleCands(') >= 0);
  assert.ok(FL.indexOf('이 승인과 잇기') >= 0);
  assert.ok(FL.indexOf('payLinkId') >= 0);
});

test('④ 상담접수 카드에 카드 승인을 먼저 적는 길이 있다(입금 전 승인)', () => {
  assert.ok(SRC.indexOf("status:'approved'") >= 0 || SRC.indexOf("status: 'approved'") >= 0);
  assert.ok(SRC.indexOf('💳 카드 승인 기록') >= 0);
});

/* ───────── ① 저장 길을 «진짜로» 돌린다 (글자 순서만 보면 기능을 꺼도 초록이다) ───────── */
function saveCtx(contracts) {
  const c = makeCtx();
  const incomes = [], expenses = [], patches = [], toasts = [], marked = [];
  c.todayYMD = () => '2026-11-17';
  c.calcDeductions = (a) => ({ perfBaseAmount: a });
  c.calcPerfShares = () => [];
  c._sidName = (s) => s;
  c.erpUpsertIncome = (r) => { incomes.push(r); return true; };
  c.dbUpsert = (k, r) => { expenses.push({ k, r }); return true; };
  c.dbGet = (k, d) => (k === 'contracts' ? contracts : d);
  c.dbPatch = (store, id, p) => { patches.push({ store, id, p }); return true; };
  c.showToast = (m) => toasts.push(m);
  c.erpMarkBankRowProcessed = (row, kind, label) => marked.push(label);
  c.removeRow = () => {};
  c.CURRENT_USER = { sid: 'P-9', name: '검사' };
  vm.runInContext(DIRECT, c);
  return { c, incomes, expenses, patches, toasts, marked };
}
const DROW = { _k: 'r1', date: '2026-11-17', amount: 213000, memo: '신한카드', src: 'bank' };
const DBASE = (over) => Object.assign({ row: DROW, name: '가상의뢰인', kind: '상담료', doc: 'cash', cardMode: true, grossAmt: '220000',
  consultId: 'ct-1', cardCompany: '신한', approvalNo: '12345678', cardTail: '3456', approvalDate: '2026-11-14', mainSid: 'P-9', perfOn: false, vatIncluded: true }, over || {});
const CTS = (pays) => [{ id: 'ct-1', clientName: '가상의뢰인', status: 'consult', consultPayments: pays || [] }];

test('① 카드 상담료 — 입금 줄과 상담접수 카드에 «같은 번호»로 적히고, 수수료는 지출로 남는다', () => {
  const s = saveCtx(CTS());
  assert.equal(s.c.saveDirectIncome(DBASE()), true);
  assert.equal(s.incomes.length, 1);
  const fi = s.incomes[0];
  assert.equal(fi.consultId, 'ct-1');
  assert.equal(fi.cardCompany, '신한');
  assert.equal(fi.approvalNo, '12345678');
  assert.equal(fi.cardLast4, '3456');
  assert.equal(fi.approvalDate, '2026-11-14');
  assert.equal(fi.amount, 220000, '매출은 수수료 전 금액');
  assert.equal(s.expenses.length, 1, '카드 수수료가 지출로');
  assert.equal(s.expenses[0].r.amount, 7000);
  const p = s.patches.find((x) => x.store === 'contracts');
  assert.ok(p, '상담접수 카드에 적었다');
  assert.equal(p.id, 'ct-1');
  assert.equal(p.p.consultPayments.length, 1);
  const e = p.p.consultPayments[0];
  assert.equal(e.id, fi.consultPayId, '입금 줄과 상담접수 줄이 같은 번호');
  assert.equal(e.incomeId, fi.id);
  assert.equal(e.status, 'received');
  assert.equal(e.netAmount, 213000);
});

test('② 카드 승인 정보가 모자라면 입금도 만들지 않고 상담접수에도 안 적는다(반만 남지 않는다)', () => {
  const s = saveCtx(CTS());
  assert.equal(s.c.saveDirectIncome(DBASE({ approvalNo: '12' })), false);
  assert.equal(s.c.saveDirectIncome(DBASE({ cardCompany: '' })), false);
  assert.equal(s.incomes.length, 0);
  assert.equal(s.patches.length, 0);
  assert.equal(s.expenses.length, 0);
  assert.equal(s.marked.length, 0, '통장 줄을 «처리됨»으로 찍지도 않는다');
  assert.ok(s.toasts.some((t) => /승인번호|카드사/.test(t)));
});

test('② 승인번호를 «없음»으로 고르면 적히고, 증빙 점검에 걸린다', () => {
  const s = saveCtx(CTS());
  assert.equal(s.c.saveDirectIncome(DBASE({ approvalNo: '', approvalMissing: true })), true);
  const fi = s.incomes[0];
  assert.equal(fi.approvalNo, undefined);
  assert.equal(fi.approvalMissing, true);
  assert.match(s.c.erpConsultEvidenceGap(fi), /승인번호/);
});

test('③ 카드번호 전체를 붙여 넣어도 끝 네 자리만 저장된다', () => {
  const s = saveCtx(CTS());
  s.c.saveDirectIncome(DBASE({ cardTail: '4111-1111-1111-9876' }));
  const dump = JSON.stringify([s.incomes, s.patches, s.expenses]);
  assert.ok(dump.indexOf('4111') < 0 && dump.indexOf('1111') < 0, '앞 번호는 어디에도 남지 않는다');
  assert.equal(s.incomes[0].cardLast4, '9876');
});

test('④ 입금 전 승인 줄을 잇으면 새 줄을 더하지 않고 그 줄이 입금 확인으로 바뀐다', () => {
  const approved = { id: 'cp-77', method: 'card', status: 'approved', amount: 220000, cardCompany: '신한', approvalNo: '12345678', approvalDate: '2026-11-14', date: '2026-11-14' };
  const s = saveCtx(CTS([approved]));
  assert.equal(s.c.saveDirectIncome(DBASE({ payLinkId: 'cp-77' })), true);
  const p = s.patches.find((x) => x.store === 'contracts');
  assert.equal(p.p.consultPayments.length, 1, '두 번 적지 않는다');
  assert.equal(p.p.consultPayments[0].id, 'cp-77');
  assert.equal(p.p.consultPayments[0].status, 'received');
  assert.equal(p.p.consultPayments[0].incomeId, s.incomes[0].id);
  assert.equal(p.p.consultPayments[0].fee, 7000);
  assert.equal(s.incomes[0].consultPayId, 'cp-77');
});

test('④ 잇기로 한 승인 줄이 없으면 «저장 전에» 막는다 — 입금 줄에 번호만 남고 상담접수와 어긋나지 않게', () => {
  const s = saveCtx(CTS([]));
  assert.equal(s.c.saveDirectIncome(DBASE({ payLinkId: 'cp-없음' })), false);
  assert.equal(s.incomes.length, 0, '입금을 만들지 않았다');
  assert.equal(s.patches.length, 0);
  assert.equal(s.expenses.length, 0);
  assert.equal(s.marked.length, 0, '통장 줄을 처리됨으로 찍지도 않는다');
  assert.ok(s.toasts.some((t) => /잇기/.test(t)));
});

test('④ 이미 입금 확인된 승인 줄을 또 잇지 못한다', () => {
  const done = { id: 'cp-5', method: 'card', status: 'received', amount: 220000, incomeId: 'fi-전', cardCompany: '신한', approvalNo: '12345678' };
  const s = saveCtx(CTS([done]));
  assert.equal(s.c.saveDirectIncome(DBASE({ payLinkId: 'cp-5' })), false);
  assert.equal(s.incomes.length, 0);
});

test('① 고른 상담접수가 없으면(지워졌거나 못 찾으면) 입금도 만들지 않는다 — 번호만 남은 입금 줄을 만들지 않는다', () => {
  const s = saveCtx([]);
  assert.equal(s.c.saveDirectIncome(DBASE({ consultId: 'ct-없음' })), false);
  assert.equal(s.incomes.length, 0);
  assert.ok(s.toasts.some((t) => /상담접수를 찾지 못/.test(t)));
  const gone = saveCtx([{ id: 'ct-1', clientName: '지워짐', status: 'consult', _deleted: true, consultPayments: [] }]);
  assert.equal(gone.c.saveDirectIncome(DBASE()), false, '지운 상담접수에도 적지 않는다');
});

test('① 상담접수에 적지 못하면(저장 실패) 방금 만든 입금도 무르고 멈춘다 — 수수료 지출·처리됨 표시도 남기지 않는다', () => {
  const s = saveCtx(CTS());
  const undone = [];
  s.c.erpUndoIncome = (fi) => { undone.push(fi.id); return true; };
  s.c.dbPatch = (store) => (store === 'contracts' ? false : true);
  assert.equal(s.c.saveDirectIncome(DBASE()), false);
  assert.equal(undone.length, 1, '입금을 물렀다');
  assert.equal(undone[0], s.incomes[0].id);
  assert.equal(s.expenses.length, 0, '수수료 지출을 안 만들었다');
  assert.equal(s.marked.length, 0, '통장 줄을 처리됨으로 안 찍었다');
  assert.ok(s.toasts.some((t) => /입금도 취소/.test(t)));
});

test('① 상담접수 저장이 예외를 던져도 같다', () => {
  const s = saveCtx(CTS());
  const undone = [];
  s.c.erpUndoIncome = (fi) => { undone.push(fi.id); return true; };
  s.c.dbPatch = (store) => { if (store === 'contracts') throw new Error('끊김'); return true; };
  assert.equal(s.c.saveDirectIncome(DBASE()), false);
  assert.equal(undone.length, 1);
  assert.equal(s.expenses.length, 0);
});

test('① 상담접수를 안 골랐으면 계좌 입금은 상담접수에 손대지 않고, 증빙 점검에 걸린다', () => {
  const s = saveCtx(CTS());
  assert.equal(s.c.saveDirectIncome(DBASE({ cardMode: false, consultId: '' })), true);
  assert.equal(s.patches.filter((x) => x.store === 'contracts').length, 0);
  assert.equal(s.incomes[0].consultId, undefined);
  assert.match(s.c.erpConsultEvidenceGap(s.incomes[0]), /상담접수/);
});

test('① 상담료가 아닌 직접 등록(기타수입)은 상담 칸을 건드리지 않는다', () => {
  const s = saveCtx(CTS());
  assert.equal(s.c.saveDirectIncome(DBASE({ kind: '기타수입', cardCompany: '', approvalNo: '' })), true);
  const fi = s.incomes[0];
  assert.equal(fi.consultId, undefined);
  assert.equal(fi.approvalNo, undefined);
  assert.equal(s.patches.length, 0);
});

test('① 계좌로 낸 상담료도 상담접수를 고르면 결제 한 줄이 양쪽에 남는다', () => {
  const s = saveCtx(CTS());
  assert.equal(s.c.saveDirectIncome(DBASE({ cardMode: false, grossAmt: '', cardCompany: '', approvalNo: '' })), true);
  const e = s.patches.find((x) => x.store === 'contracts').p.consultPayments[0];
  assert.equal(e.method, 'account');
  assert.equal(e.incomeId, s.incomes[0].id);
  assert.equal(e.cardCompany, undefined);
});

/* ───────── ⑧ 입금을 무르면 상담접수 결제 한 줄도 «돌려놓는다» (2026-11-16 자동 검토) ───────── */
test('⑧ 입금 전 승인을 잇었던 줄은 입금을 무르면 «입금 전»으로 돌아간다(승인 정보는 그대로, 입금 칸은 지운다)', () => {
  const c = makeCtx();
  const list = [{ id: 'cp-1', method: 'card', status: 'received', amount: 220000, approvalNo: '12345678', cardCompany: '신한',
    incomeId: 'fi-9', settleDate: '2026-11-17', netAmount: 213000, fee: 7000, fromApproved: true }];
  const out = c.erpConsultPaymentsOnUndo(list, 'cp-1', 'fi-9');
  assert.equal(out[0].status, 'approved');
  assert.equal(out[0].approvalNo, '12345678');
  ['incomeId', 'settleDate', 'netAmount', 'fee', 'fromApproved'].forEach((k) => assert.ok(!(k in out[0]), k + ' 를 지운다'));
  assert.equal(list[0].status, 'received', '원본은 건드리지 않는다');
  assert.equal(c.erpConsultPaidSum({ consultPayments: out }), 0, '무른 입금은 «받은 돈»에 안 센다');
});

test('⑧ 직접 적었던 줄은 입금을 무르면 취소로 표시된다(기록은 지우지 않는다)', () => {
  const c = makeCtx();
  const out = c.erpConsultPaymentsOnUndo([{ id: 'cp-2', status: 'received', incomeId: 'fi-1', amount: 110000 }], 'cp-2', 'fi-1');
  assert.equal(out.length, 1);
  assert.equal(out[0].status, 'cancelled');
  assert.ok(out[0].cancelledAt);
});

test('⑧ 그 입금이 만든 줄이 아니면 건드리지 않는다 — 다른 입금·못 찾음은 null', () => {
  const c = makeCtx();
  const list = [{ id: 'cp-1', status: 'received', incomeId: 'fi-9', fromApproved: true }, { id: 'cp-0', status: 'approved' }];
  assert.equal(c.erpConsultPaymentsOnUndo(list, 'cp-1', 'fi-다른'), null, '다른 입금이 무르는 것은 이 줄과 무관');
  assert.equal(c.erpConsultPaymentsOnUndo(list, 'cp-없음', 'fi-9'), null);
  assert.equal(c.erpConsultPaymentsOnUndo(list, 'cp-0', undefined), null, '입금이 잇지 않은 입금 전 승인 줄을 «취소»로 바꾸지 않는다');
});

function undoCtx(contracts, incomes) {
  const c = makeCtx();
  const patches = [], toasts = [];
  c.dbGet = (k, d) => (k === 'contracts' ? contracts : k === 'finance_income' ? incomes : d);
  c.dbPatch = (store, id, p) => { patches.push({ store, id, p }); return c._patchResult === undefined ? true : c._patchResult; };
  c.showToast = (m) => toasts.push(m);
  c.erpPerfLockInfo = () => ({ locked: false });
  c.erpIncomeLockYm = () => '';
  c.erpIncomeLive = (fi) => !!fi && !fi._deleted && !fi.undoneDate;
  c.erpLumpSiblings = () => [];
  c.erpIncomeSourceStore = () => 'companies';
  c.CURRENT_USER = { sid: 'P-9' };
  vm.runInContext(cut('function erpUndoIncome(', '/* 안내 글 — 되돌리기 확인창에'), c);
  return { c, patches, toasts };
}
test('⑧ 상담료 입금을 무르는 «문 하나»(erpUndoIncome)가 상담접수 결제 한 줄도 함께 돌려놓는다', () => {
  const fi = { id: 'fi-9', kind: '상담료', date: '2026-11-17', consultId: 'ct-1', consultPayId: 'cp-1' };
  const ct = [{ id: 'ct-1', consultPayments: [{ id: 'cp-1', status: 'received', incomeId: 'fi-9', fromApproved: true, amount: 220000 }] }];
  const u = undoCtx(ct, [fi]);
  assert.equal(u.c.erpUndoIncome(fi), true);
  const cp = u.patches.find((p) => p.store === 'contracts');
  assert.ok(cp, '상담접수 카드도 고친다');
  assert.equal(cp.p.consultPayments[0].status, 'approved');
  assert.ok(u.patches.some((p) => p.store === 'finance_income' && p.p.undoneDate));
});

test('⑧ 입금 저장이 안 되면(dbPatch false) «되돌렸다»고 하지 않고, 먼저 고친 상담접수를 원래대로 돌려놓는다', () => {
  const orig = [{ id: 'cp-1', status: 'received', incomeId: 'fi-9', amount: 1, fromApproved: true }];
  const fi = { id: 'fi-9', kind: '상담료', date: '2026-11-17', consultId: 'ct-1', consultPayId: 'cp-1' };
  const ct = [{ id: 'ct-1', consultPayments: orig }];
  const u = undoCtx(ct, [fi]);
  u.c.dbPatch = (store, id, p) => { u.patches.push({ store, id, p }); return store === 'finance_income' ? false : true; };
  assert.equal(u.c.erpUndoIncome(fi), false);
  const cps = u.patches.filter((p) => p.store === 'contracts');
  assert.equal(cps.length, 2, '상담접수를 고쳤다가(입금 전) 원래대로 되돌렸다');
  assert.equal(cps[0].p.consultPayments[0].status, 'approved');
  assert.equal(cps[1].p.consultPayments, orig, '마지막 상태는 원래 목록');
});

test('⑧ 상담접수 저장이 실패하면(false·예외) 입금은 아직 건드리지 않고 멈춘다 — 입금만 물러지고 결제는 received 로 남는 어긋남이 없다', () => {
  const mk = () => ({ fi: { id: 'fi-9', kind: '상담료', date: '2026-11-17', consultId: 'ct-1', consultPayId: 'cp-1' },
    ct: [{ id: 'ct-1', consultPayments: [{ id: 'cp-1', status: 'received', incomeId: 'fi-9', amount: 1 }] }] });
  const a = mk(); const ua = undoCtx(a.ct, [a.fi]);
  ua.c.dbPatch = (store, id, p) => { ua.patches.push({ store, id, p }); return store === 'contracts' ? false : true; };
  assert.equal(ua.c.erpUndoIncome(a.fi), false);
  assert.equal(ua.patches.filter((p) => p.store === 'finance_income').length, 0, '입금은 그대로');
  assert.ok(ua.toasts.some((t) => /상담접수/.test(t)));
  const b = mk(); const ub = undoCtx(b.ct, [b.fi]);
  ub.c.dbPatch = (store, id, p) => { ub.patches.push({ store, id, p }); if (store === 'contracts') throw new Error('끊김'); return true; };
  assert.equal(ub.c.erpUndoIncome(b.fi), false);
  assert.equal(ub.patches.filter((p) => p.store === 'finance_income').length, 0);
});

test('⑧ 일반 입금(일괄이 아닌 줄)도 이미 물러졌으면 두 번 무르지 않는다 — 마감월 성과 조정이 겹치지 않게', () => {
  const stale = { id: 'fi-1', kind: '자문료', date: '2026-11-17' };
  const stored = { id: 'fi-1', kind: '자문료', date: '2026-11-17', undoneDate: '2026-11-18' };
  const u = undoCtx([], [stored]);
  assert.equal(u.c.erpUndoIncome(stale), true);
  assert.equal(u.patches.length, 0, '아무것도 저장하지 않았다');
});

test('⑨ 상담접수 저장 실패 복구가 입금 취소까지 실패하면 «취소했다»고 하지 않고 직접 되돌리라고 알린다', () => {
  const s = saveCtx(CTS());
  s.c.erpUndoIncome = () => false;
  s.c.dbPatch = (store) => (store === 'contracts' ? false : true);
  assert.equal(s.c.saveDirectIncome(DBASE()), false);
  assert.ok(s.toasts.some((t) => /입금 취소도 실패/.test(t) && /직접 되돌린 뒤/.test(t)), '실패를 분명히 알린다');
  assert.ok(!s.toasts.some((t) => /입금도 취소했습니다/.test(t)), '취소했다고 거짓말하지 않는다');
});

test('⑧ 상담 칸이 없는 옛 입금은 상담접수를 찾지도 않는다(기존 되돌리기 그대로)', () => {
  const fi = { id: 'fi-1', kind: '자문료', date: '2026-11-17' };
  const u = undoCtx([], [fi]);
  assert.equal(u.c.erpUndoIncome(fi), true);
  assert.equal(u.patches.filter((p) => p.store === 'contracts').length, 0);
});

/* ───────── ⑩ 화면 연결 (자동 검토 반영) ───────── */
test('⑩ 직접 등록 창 — 상담접수·결제수단을 바꾸면 «잇기»를 풀고, 카드전표 증빙이 있고, 카드 정보가 모자라면 등록이 안 눌린다', () => {
  assert.match(FL, /onChange:function\(e\)\{ upd\(\{consultId:e\.target\.value, payLinkId:''\}\); \}/, '상담접수를 바꾸면 잇기 풀림');
  assert.match(FL, /upd\(\{cardMode:false, payLinkId:'', doc:\(dirPop\.doc==='card'\?'cash':dirPop\.doc\)\}\)/, '계좌로 바꾸면 잇기와 카드전표 선택이 풀린다');
  assert.ok(FL.indexOf("card:'카드전표',none:'증빙없음'}[dirPop.doc]") >= 0, '등록 확인창도 카드전표를 그대로 보여 준다');
  assert.ok(FL.indexOf("seg(dirPop.doc,'card','💳 카드전표'") >= 0, '카드로 받았으면 카드전표를 증빙으로 고를 수 있다');
  assert.match(FL, /\|\| \(_isConsultK && dirPop\.cardMode && !_cardBuild\.ok\),/, '카드 정보가 모자라면 등록 단추가 안 눌린다');
});

test('⑩ 승인 후 계약협의로 넘어간 상담접수도 정산 입금 후보·선택지에 남고, 지운 것은 뺀다', () => {
  const at = FL.indexOf('var _consultPool = ');
  const pool = FL.slice(at, at + 400);
  assert.ok(/!c\._deleted/.test(pool), '지운 상담접수를 뺀다');
  assert.ok(/status === 'approved'/.test(pool), '입금 전 카드 승인이 남은 건은 상태가 바뀌어도 포함한다');
  assert.ok(FL.indexOf('erpConsultSettleCands(_r, _consultPool)') >= 0);
});

test('⑩ 카드 끝 4자리 칸은 전체 번호를 붙여 넣어도 «입력창 상태에도» 끝 네 자리만 둔다(두 입력창 모두)', () => {
  const needle = 'String(e.target.value).replace(/' + String.fromCharCode(92) + "D/g";
  const hits = SRC.split(needle).length - 1;
  assert.ok(hits >= 2, '직접 등록 창과 카드 승인 기록 창 둘 다 (' + hits + ')');
  assert.ok(SRC.indexOf("'aria-label':'카드 끝 4자리'") >= 0);
});

test('⑩ 확정 이력 — 두 모아 보기는 걸러 내기 전 목록으로 세고, 켜 둔 단추는 0건이어도 남는다', () => {
  assert.match(FL, /var _payerDiffN = allInc\.filter\(_isPayerDiff\)\.length;\s*\n\s*var _gapN = allInc\.filter\(/, '둘 다 걸러 내기 전에 센다');
  assert.ok(FL.indexOf('(_payerDiffN>0 || payerOnly) && h(') >= 0 && FL.indexOf('(_gapN>0 || gapOnly) && h(') >= 0, '켜 둔 단추는 사라지지 않는다');
  assert.ok(FL.indexOf("flexWrap:'wrap'}},\n            h('input',{type:'search'") >= 0, '검색 줄이 좁은 화면에서 접힌다');
});

/* ───────── ⑪ 3차 검토 반영 — 입금이 물러지기 «전에» 어디서 실패해도 상담접수를 원래대로 ───────── */
function undoFailCtx(over) {
  const orig = [{ id: 'cp-1', status: 'received', incomeId: 'fi-9', amount: 1, fromApproved: true }];
  const fi = { id: 'fi-9', kind: '상담료', date: '2026-11-17', consultId: 'ct-1', consultPayId: 'cp-1', perfShares: [{ sid: 'P-1', amount: 100 }] };
  const u = undoCtx([{ id: 'ct-1', consultPayments: orig }], [fi]);
  Object.assign(u.c, over || {});
  return { u, fi, orig };
}
test('⑪ 입금 저장이 «예외»를 던져도 상담접수를 원래대로 돌려놓는다 — 입금은 살아 있는데 결제만 입금 전으로 남지 않게', () => {
  const { u, fi, orig } = undoFailCtx();
  u.c.dbPatch = (store, id, p) => { u.patches.push({ store, id, p }); if (store === 'finance_income') throw new Error('끊김'); return true; };
  assert.equal(u.c.erpUndoIncome(fi), false);
  const cps = u.patches.filter((p) => p.store === 'contracts');
  assert.equal(cps.length, 2, '고쳤다가 되돌려 놓았다');
  assert.equal(cps[1].p.consultPayments, orig);
});

test('⑪ 마감월 성과 조정(erpRoutePerfDelta)이 예외를 던지거나 실패해도 같다', () => {
  for (const kind of ['throw', 'failed']) {
    const { u, fi, orig } = undoFailCtx();
    u.c.erpPerfLockInfo = () => ({ locked: true, ym: '2026-10' });
    u.c.erpRoutePerfDelta = () => { if (kind === 'throw') throw new Error('끊김'); return { failed: true }; };
    assert.equal(u.c.erpUndoIncome(fi), false, kind);
    assert.equal(u.patches.filter((p) => p.store === 'finance_income').length, 0, '입금은 안 건드렸다 ' + kind);
    const cps = u.patches.filter((p) => p.store === 'contracts');
    assert.equal(cps.length, 2, kind);
    assert.equal(cps[1].p.consultPayments, orig, kind);
  }
});

test('⑪ 상담접수를 «원래대로 돌려놓기»도 실패하면 조용히 두지 않고 알린다', () => {
  const { u, fi } = undoFailCtx();
  let n = 0;
  u.c.dbPatch = (store, id, p) => { u.patches.push({ store, id, p }); if (store === 'contracts') { n++; return n === 1; } return false; };   // 상담접수 1번째 성공 → 입금 실패 → 돌려놓기 실패
  assert.equal(u.c.erpUndoIncome(fi), false);
  assert.ok(u.toasts.some((t) => /돌려놓지 못했습니다/.test(t) && /직접 확인/.test(t)), '실패를 사용자에게 드러낸다');
});

test('⑪ 입금이 이미 물러진 «뒤»의 예외로는 상담접수를 되돌려 놓지 않는다(되돌린 입금과 결제가 어긋나면 안 된다)', () => {
  const { u, fi } = undoFailCtx();
  u.c.erpIncomeSourceStore = () => { throw new Error('원본 저장소 이름을 못 구함'); };
  const fi2 = Object.assign({}, fi, { sourceId: 'co-1', sourceKind: 'company', perfShares: [] });
  u.c.erpUndoIncome(fi2);
  const cps = u.patches.filter((p) => p.store === 'contracts');
  assert.equal(cps.length, 1, '입금이 물러진 뒤에는 상담접수를 그대로 둔다(고친 채로)');
  assert.equal(cps[0].p.consultPayments[0].status, 'approved');
});
