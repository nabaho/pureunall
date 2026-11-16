/* 재무관리 — 밀린 자문료 «일괄 입금»(오래된 달부터 채움) + 분할·일괄 입금 «기록» (대표 2026-11-16)
   설계 docs/superpowers/specs/2026-11-16-입금-일괄-명의-카드상담-design.md §3·§5

   ■ 왜
   몇 달 밀렸다가 한 번에 낸 돈은 «합계가 맞는 조합 찾기»(최대 3건·후보 달 3달 한도)로는 못 맞췄다.
   그리고 합쳐서 확정해도 «한 통장 줄에서 나온 돈이다» 라는 연결이, 나눠 받은 자문료의 «약정·남은 돈»이 기록에 안 남았다.

   ■ 지키는 것
   ① 밀린 달은 «오래된 달부터», 그 달의 요율(feeHistory)로, 24개월 한도 안에서 센다
   ② 들어온 돈은 «오래된 달부터» 채운다 — 합계(부분 합)를 어느 한 쪽도 버리지 않는다(채운 돈 + 남은 돈 = 입금액)
   ③ 남는 돈은 «사람이 어디에 둘지 고를 때까지» 확정하지 않는다
   ④ 업체가 «이름 근거로 하나»로 정해질 때만 제안한다(약한 별칭·업체 둘 이상·CMS·한 달짜리는 제안하지 않는다)
   ⑤ 제안은 노랑(check)일 뿐 — 모두확정(ready)에 못 들어간다
   ⑥ 일괄 줄은 같은 lumpId — 한 줄을 무르면 «같이» 물러진다(문 하나: erpUndoIncome). 마감된 달이 하나라도 있으면 «아무것도» 안 무른다
   ⑦ 저장 길(saveIncome)이 분할 칸(약정·받은·남은·순번)과 일괄 칸(lumpId…)을 실제로 적는다

   ★ 함수를 떠서 «돌려» 본다(글자 찾기만 하면 기능을 꺼도 초록이다 — STATUS 되풀이된 실수 ②).
   ★ 자료는 모두 지어낸 것이다(공개 저장소). 값(24·1100)을 못 박지 않고 «규칙»을 본다. */
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

function makeCtx(extra) {
  const ctx = Object.assign({ console, Math, Object, JSON, parseInt, parseFloat, String, Array, Date, Promise, RegExp }, extra || {});
  ctx.window = ctx;
  vm.createContext(ctx);
  ctx.todayYM = () => '2026-11';
  vm.runInContext(cut('function incomeIsCo(', 'function erpIncomeIsRevenue('), ctx);
  vm.runInContext(cut('function erpAdvisoryYmOf(', '/* 입금 마감된 달이면 그 달'), ctx);
  vm.runInContext(cut('function erpFeeForMonth(', '/* 이력을 «보기 좋게» 정렬'), ctx);
  return ctx;
}
const CO = (over) => Object.assign({ id: 'co-1', name: '가상산업', status: 'active', monthlyAdvisoryFee: 220000 }, over || {});
const INC = (ym, amount, over) => Object.assign({ id: 'fi-' + ym + '-' + amount, companyId: 'co-1', companyName: '가상산업',
  kind: '자문료', advisoryYm: ym, amount, date: ym + '-10' }, over || {});
const YMS = (list) => list.map((d) => d.ym).join(',');

/* ───────── ① 밀린 달 목록 ───────── */
test('① 밀린 달은 «오래된 달부터», 받은 달은 뺀다', () => {
  const c = makeCtx();
  const dues = c.erpAdvisoryDues(CO(), [INC('2026-08', 220000)], { upToYm: '2026-11' }).filter((d) => d.ym >= '2026-07');
  assert.equal(YMS(dues), '2026-07,2026-09,2026-10,2026-11', '8월은 받았으니 빠지고 오름차순');
  const all = c.erpAdvisoryDues(CO(), [], { upToYm: '2026-11' });
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].ym < all[i].ym, '오래된 달부터 차례로');
});

test('① 일부만 받은 달은 «남은 몫»만 밀린 것으로 센다', () => {
  const c = makeCtx();
  const dues = c.erpAdvisoryDues(CO(), [INC('2026-10', 150000)], { upToYm: '2026-10', maxMonths: 1 });
  assert.equal(dues.length, 1);
  assert.equal(dues[0].got, 150000);
  assert.equal(dues[0].remain, dues[0].fee - 150000);
});

test('① 거슬러 보는 한도가 있다 — 계약 시작 전·중단 뒤 달은 뺀다', () => {
  const c = makeCtx();
  const cap = c.ERP_ARREARS_MAX_MONTHS;
  assert.ok(cap >= 12, '한 해보다 길게 거슬러 본다');
  const many = c.erpAdvisoryDues(CO(), [], { upToYm: '2026-11' });
  assert.ok(many.length <= cap, '한도를 넘지 않는다');
  const started = c.erpAdvisoryDues(CO({ contractStartDate: '2026-09-15' }), [], { upToYm: '2026-11' });
  assert.equal(YMS(started), '2026-09,2026-10,2026-11', '계약 시작 달부터');
  const stopped = c.erpAdvisoryDues(CO({ contractStartDate: '2026-06-01', suspended: true, suspendedAt: '2026-08-20' }), [], { upToYm: '2026-11' });
  assert.equal(stopped[stopped.length - 1].ym, '2026-08', '중단일이 든 달까지만 받을 몫이다');
});

test('① 그 달의 요율(feeHistory)로 센다 — 지금 요율로 옛 달을 셈하지 않는다', () => {
  const c = makeCtx();
  const co = CO({ monthlyAdvisoryFee: 440000, contractStartDate: '2026-01-01', feeHistory: [{ from: '2026-01', fee: 275000 }, { from: '2026-10', fee: 440000 }] });
  const dues = c.erpAdvisoryDues(co, [], { upToYm: '2026-11' });
  const by = {}; dues.forEach((d) => { by[d.ym] = d.fee; });
  assert.equal(by['2026-03'], 275000);
  assert.equal(by['2026-11'], 440000);
});

test('① 매달 걷는 업체만 — 선납·건별·분기별·비활성·삭제는 밀린 달이 없다', () => {
  const c = makeCtx();
  ['선납', '건별', '분기별'].forEach((pd) => assert.equal(c.erpAdvisoryDues(CO({ taxInvoicePaymentDay: pd }), [], { upToYm: '2026-11' }).length, 0, pd));
  assert.equal(c.erpAdvisoryDues(CO({ status: 'closed' }), [], { upToYm: '2026-11' }).length, 0);
  assert.equal(c.erpAdvisoryDues(CO({ _deleted: true }), [], { upToYm: '2026-11' }).length, 0);
  assert.equal(c.erpAdvisoryDues(CO({ monthlyAdvisoryFee: 0 }), [], { upToYm: '2026-11' }).length, 0, '월 자문료가 없으면 받을 것이 없다');
  assert.equal(c.erpAdvisoryDues(null, [], {}).length, 0);
});

test('① 다른 업체·되돌린 입금은 받은 돈으로 세지 않는다', () => {
  const c = makeCtx();
  const other = INC('2026-10', 220000, { companyId: 'co-2', companyName: '다른산업' });
  const undone = INC('2026-09', 220000, { undoneDate: '2026-10-01' });
  const dues = c.erpAdvisoryDues(CO(), [other, undone], { upToYm: '2026-10', maxMonths: 3 });
  assert.equal(YMS(dues), '2026-08,2026-09,2026-10', '남의 입금·되돌린 입금은 이 업체의 받은 돈이 아니다');
});

/* ───────── ② 오래된 달부터 채우기 ───────── */
const DUES = (n, remain) => Array.from({ length: n }, (_, i) => ({ ym: '2026-0' + (5 + i), fee: remain, got: 0, remain }));

test('② 세 달 치를 꼭 맞게 내면 «다 채움» 세 건, 남는 돈 없음', () => {
  const c = makeCtx();
  const p = c.erpArrearsAllocate(660000, DUES(5, 220000));
  assert.equal(p.parts.length, 3);
  assert.ok(p.exact && p.rest === 0);
  assert.equal(p.parts.map((x) => x.ym).join(','), '2026-05,2026-06,2026-07', '오래된 달부터');
  assert.ok(p.parts.every((x) => x.full));
});

test('② 거의 맞으면(허용치 안) 마지막 달은 들어온 그대로 적고 다 채운 것으로 본다', () => {
  const c = makeCtx();
  const tol = c.ERP_ARREARS_TOL;
  const p = c.erpArrearsAllocate(660000 - tol, DUES(5, 220000));
  assert.equal(p.parts.length, 3);
  assert.ok(p.exact);
  assert.equal(p.parts[2].amount, 220000 - tol, '들어온 그대로');
  const q = c.erpArrearsAllocate(660000 + tol, DUES(5, 220000));
  assert.ok(q.exact && q.rest === 0);
  assert.equal(q.parts[2].amount, 220000 + tol);
});

test('② 모자라면 마지막 달은 «일부입금» — 남은 몫은 계속 미수', () => {
  const c = makeCtx();
  const p = c.erpArrearsAllocate(500000, DUES(4, 220000));
  assert.equal(p.parts.length, 3);
  assert.equal(p.parts[2].full, false);
  assert.equal(p.parts[2].amount, 60000);
  assert.equal(p.exact, false);
  assert.equal(p.rest, 0);
});

test('② 밀린 달을 다 채우고도 남으면 rest — 말없이 버리지 않는다', () => {
  const c = makeCtx();
  const p = c.erpArrearsAllocate(1000000, DUES(3, 220000));
  assert.equal(p.parts.length, 3);
  assert.equal(p.rest, 1000000 - 660000);
  assert.equal(p.exact, false, '남는 돈이 있으면 «딱 맞음»이 아니다');
});

test('② 채운 돈 + 남은 돈 = 입금액 — 어떤 입금액에서도 돈이 새거나 늘지 않는다', () => {
  const c = makeCtx();
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 400; i++) {
    const dues = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, k) => {
      const remain = 10000 + Math.floor(rnd() * 90) * 5000;
      return { ym: '2026-' + String(k + 1).padStart(2, '0'), fee: remain, got: 0, remain };
    });
    const amount = Math.floor(rnd() * 2000000);
    const p = c.erpArrearsAllocate(amount, dues);
    const sum = p.parts.reduce((s, x) => s + x.amount, 0);
    assert.equal(sum + p.rest, amount, '입금 ' + amount);
    for (let k = 1; k < p.parts.length; k++) assert.ok(p.parts[k - 1].ym < p.parts[k].ym, '오래된 달부터');
    for (let k = 0; k < p.parts.length - 1; k++) assert.ok(p.parts[k].full, '마지막 말고는 다 채운 달이다');
  }
});

test('② 밀린 달이 없거나 입금이 0이면 아무것도 만들지 않는다', () => {
  const c = makeCtx();
  assert.equal(c.erpArrearsAllocate(500000, []).parts.length, 0);
  assert.equal(c.erpArrearsAllocate(0, DUES(3, 220000)).parts.length, 0);
  assert.equal(c.erpArrearsAllocate(-5, DUES(3, 220000)).parts.length, 0);
});

/* ───────── ③ 남는 돈은 사람이 고른다 ───────── */
test('③ 남는 돈은 고르기 전에는 확정할 조각을 내지 않는다', () => {
  const c = makeCtx();
  const plan = c.erpArrearsAllocate(1000000, DUES(3, 220000));
  assert.equal(c.erpLumpParts(plan, ''), null, '안 골랐으면 null — 말없이 버리지 않는다');
  assert.equal(c.erpLumpParts(plan, 'whatever'), null);
});

test('③ 미리 받음은 다음 달분 조각을 더하고, 그대로는 마지막 달에 합친다', () => {
  const c = makeCtx();
  const plan = c.erpArrearsAllocate(1000000, DUES(3, 220000));
  const pre = c.erpLumpParts(plan, 'prepay');
  assert.equal(pre.length, 4);
  assert.equal(pre[3].prepay, true);
  assert.equal(pre[3].ym, '2026-08', '마지막 밀린 달(7월)의 다음 달');
  assert.equal(pre.reduce((s, x) => s + x.amount, 0), 1000000);
  const asis = c.erpLumpParts(plan, 'asis');
  assert.equal(asis.length, 3);
  assert.equal(asis.reduce((s, x) => s + x.amount, 0), 1000000);
});

test('③ 남는 돈이 없으면 고를 것이 없다', () => {
  const c = makeCtx();
  const plan = c.erpArrearsAllocate(660000, DUES(3, 220000));
  assert.equal(c.erpLumpParts(plan, '').length, 3);
  assert.equal(c.erpLumpParts(null, '').length, 0);
});

/* ───────── ④ 누구 업체인가 · 제안 조건 ───────── */
function lumpCtx(sugs, over) {
  const c = makeCtx();
  const src = cut('  var lumpMemo = {};', '  /* 줄 상태 — 기존 판정(erpRowState)에');
  c.incSug = sugs; c.isCmsMemo = (over && over.cms) || {};
  c.erpNormName = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
  c.dbGet = (k, d) => (k === 'finance_income' ? ((over && over.incomes) || []) : d);
  vm.runInContext(src, c);
  return c;
}
const ROW = { _k: 'r1', amount: 660000, date: '2026-11-16', memo: '가상산업' };
const SUG = (co, over) => Object.assign({ cand: { kind: 'advisory', companyName: co.name, item: co }, nameScore: 100, aliasWeak: false }, over || {});

test('④ 이름 근거로 한 업체가 정해지면 오래된 달부터 채운 제안을 낸다', () => {
  const co = CO({ contractStartDate: '2026-06-01' });
  const c = lumpCtx({ r1: [SUG(co)] }, { incomes: [INC('2026-06', 220000), INC('2026-07', 220000)] });
  const lz = c.lumpOf(ROW);
  assert.ok(lz, '제안이 있다');
  assert.equal(lz.plan.parts.length, 3);
  assert.equal(lz.plan.parts.map((x) => x.ym).join(','), '2026-08,2026-09,2026-10', '받은 6·7월은 빼고 오래된 달부터');
  assert.equal(lz.plan.rest, 0);
});

test('④ 약한 별칭(이름이 닮지 않은 한 번짜리)은 근거가 못 된다', () => {
  const co = CO({ contractStartDate: '2026-06-01' });
  const c = lumpCtx({ r1: [SUG(co, { aliasWeak: true })] });
  assert.equal(c.lumpOf(ROW), null);
});

test('④ 이름 점수가 모자라면(금액만 비슷하면) 시작하지 않는다', () => {
  const co = CO({ contractStartDate: '2026-06-01' });
  const c = lumpCtx({ r1: [SUG(co, { nameScore: 0 })] });
  assert.equal(c.lumpOf(ROW), null, '금액만으로는 시작하지 않는다');
});

test('④ 이름이 맞는 업체가 둘 이상이면 하나로 정해진 것이 아니다', () => {
  const a = CO({ contractStartDate: '2026-06-01' });
  const b = CO({ id: 'co-2', name: '가상산업2', contractStartDate: '2026-06-01' });
  const c = lumpCtx({ r1: [SUG(a), SUG(b)] });
  assert.equal(c.lumpOf(ROW), null);
});

test('④ 한 달짜리·CMS·이미 처리된 줄·입금 취소 줄은 일괄이 아니다', () => {
  const co = CO({ contractStartDate: '2026-10-01' });
  assert.equal(lumpCtx({ r1: [SUG(co)] }).lumpOf(Object.assign({}, ROW, { amount: 220000 })), null, '한 달짜리');
  const co2 = CO({ contractStartDate: '2026-06-01' });
  assert.equal(lumpCtx({ r1: [SUG(co2)] }, { cms: { r1: true } }).lumpOf(ROW), null, 'CMS 통로');
  assert.equal(lumpCtx({ r1: [SUG(co2)] }).lumpOf(Object.assign({}, ROW, { _dup: true })), null);
  assert.equal(lumpCtx({ r1: [SUG(co2)] }).lumpOf(Object.assign({}, ROW, { cancel: true })), null);
});

test('④ 자문료가 아닌 후보(사건 착수금 등)만 있으면 시작하지 않는다', () => {
  const co = CO();
  const c = lumpCtx({ r1: [{ cand: { kind: 'retainer', companyName: co.name, item: co }, nameScore: 100 }] });
  assert.equal(c.lumpOf(ROW), null);
});

/* ───────── ⑤ 제안은 노랑일 뿐 — 모두확정에 못 들어간다 ───────── */
function stateCtx(baseState, lz) {
  const c = makeCtx();
  const src = cut('  function stateOf(row, grp){', '  /* ── 줄 상태를 한 번만 재서');
  c.held = {};
  c.erpRowState = () => Object.assign({}, baseState);
  c.lumpOf = () => lz;
  vm.runInContext(src, c);
  return c;
}
const LZ = { co: CO(), plan: { parts: [{}, {}, {}], rest: 0 } };

test('⑤ «더 들어옴»(노랑)인 줄에만 일괄 표시를 얹고, 상태는 노랑 그대로다', () => {
  const st = stateCtx({ state: 'check', label: '더 들어옴', diff: 440000, fee: 0 }, LZ).stateOf({}, [{}]);
  assert.equal(st.state, 'check');
  assert.equal(st.lump, true);
  assert.match(st.label, /3개월분/);
});

test('⑤ 초록(ready)·빨강(none)·업체 여럿은 바꾸지 않는다 — 일괄은 모두확정에 못 들어간다', () => {
  const ready = stateCtx({ state: 'ready', label: '확정 가능', diff: 0, fee: 0 }, LZ).stateOf({}, [{}]);
  assert.equal(ready.state, 'ready');
  assert.ok(!ready.lump);
  const many = stateCtx({ state: 'check', label: '업체가 여럿', diff: 0, fee: 0 }, LZ).stateOf({}, [{}, {}]);
  assert.ok(!many.lump);
  const less = stateCtx({ state: 'check', label: '덜 들어옴', diff: -100000, fee: 0 }, LZ).stateOf({}, [{}]);
  assert.ok(!less.lump, '덜 들어온 줄은 일괄이 아니다');
  const none = stateCtx({ state: 'none', label: '후보 없음', diff: 0, fee: 0 }, LZ).stateOf({}, []);
  assert.equal(none.state, 'none');
});

/* ───────── ⑥ 분할 기록 ───────── */
test('⑥ 분할 입금 기록 — 약정·그 전까지·남은 돈·몇 번째', () => {
  const c = makeCtx();
  const first = c.erpAdvisorySplitInfo(220000, 0, 120000, 0);
  assert.equal(first.advisoryRemainAfter, 100000);
  assert.equal(first.splitSeq, 1);
  assert.equal(first.isSplit, true, '다 못 받았으니 나눠 받는 중');
  const second = c.erpAdvisorySplitInfo(220000, 120000, 100000, 1);
  assert.equal(second.advisoryRemainAfter, 0);
  assert.equal(second.splitSeq, 2);
  assert.equal(second.isSplit, true, '앞서 받은 것이 있으니 나눠 받은 것');
});

test('⑥ 한 번에 다 낸 입금에는 «나눔» 표시를 달지 않는다', () => {
  const c = makeCtx();
  const one = c.erpAdvisorySplitInfo(220000, 0, 220000, 0);
  assert.equal(one.isSplit, false);
  assert.equal(one.advisoryRemainAfter, 0);
  assert.equal(c.erpAdvisorySplitInfo(220000, 0, 999999, 0).advisoryRemainAfter, 0, '남은 돈은 음수가 되지 않는다');
});

/* ───────── ⑦ 같은 통장 줄에서 나온 줄 ───────── */
test('⑦ lumpId 가 같은 줄만 묶고, 순번대로 낸다', () => {
  const c = makeCtx();
  const list = [{ id: 'a', lumpId: 'lp-1', lumpSeq: 2 }, { id: 'b', lumpId: 'lp-1', lumpSeq: 1 }, { id: 'c', lumpId: 'lp-2', lumpSeq: 1 }, { id: 'd' }];
  assert.equal(c.erpLumpSiblings(list[0], list).map((x) => x.id).join(','), 'b,a');
  assert.equal(c.erpLumpSiblings({ id: 'd' }, list).length, 0, 'lumpId 가 없으면 형제가 없다');
});

/* ───────── ⑧ 되돌리기는 «문 하나» — 형제를 함께 무른다 ───────── */
function undoCtx(incomes, lockedYm) {
  const c = makeCtx();
  const patched = [];
  c.dbGet = (k, d) => (k === 'finance_income' ? incomes : d);
  c.dbPatch = (store, id, p) => { patched.push({ store, id, p }); return true; };
  c.showToast = () => {};
  c.isIncomeLocked = (ym) => ym === lockedYm;
  c.erpPerfLockInfo = () => ({ locked: false });
  c.erpIncomeSourceStore = () => 'companies';
  c.erpIncomeLockYm = (fi) => { const ym = String((fi && fi.date) || '').slice(0, 7); return ym && c.isIncomeLocked(ym) ? ym : ''; };
  c.CURRENT_USER = { sid: 'P-001' };
  vm.runInContext(cut('function erpUndoIncome(', '/* ══════════ 「지난번처럼 나눠담기」'), c);
  return { c, patched };
}
const LUMP = (id, seq, over) => Object.assign({ id, companyName: '가상산업', kind: '자문료', amount: 220000, date: '2026-11-16', lumpId: 'lp-9', lumpSeq: seq, lumpN: 3, sourceId: 'co-1', sourceKind: 'company' }, over || {});

test('⑧ 일괄 줄 하나를 무르면 같은 통장 줄의 나머지도 함께 무른다', () => {
  const list = [LUMP('f1', 1), LUMP('f2', 2), LUMP('f3', 3), { id: 'x9', kind: '자문료', date: '2026-11-16', companyName: '다른산업' }];
  const { c, patched } = undoCtx(list, '');
  assert.equal(c.erpUndoIncome(list[1]), true);
  assert.equal(patched.filter((p) => p.store === 'finance_income').map((p) => p.id).sort().join(','), 'f1,f2,f3', '남의 줄은 건드리지 않는다');
});

test('⑧ 일괄이 아닌 줄은 그 한 줄만 무른다', () => {
  const list = [{ id: 'y1', kind: '자문료', date: '2026-11-16', companyName: '가상산업' }, LUMP('f2', 2)];
  const { c, patched } = undoCtx(list, '');
  assert.equal(c.erpUndoIncome(list[0]), true);
  assert.equal(patched.filter((p) => p.store === 'finance_income').length, 1);
});

test('⑧ 마감된 달이면 «아무것도» 안 무른다(반만 무르지 않는다)', () => {
  const list = [LUMP('f1', 1), LUMP('f2', 2), LUMP('f3', 3, { date: '2026-10-30' })];
  const { c, patched } = undoCtx(list, '2026-10');
  assert.equal(c.erpUndoIncome(list[0]), false);
  assert.equal(patched.length, 0, '하나도 바뀌지 않았다');
});

test('⑧ 이미 되돌린 형제는 다시 무르지 않고, 되돌리기 안내가 건수를 알려 준다', () => {
  const list = [LUMP('f1', 1), LUMP('f2', 2, { undoneDate: '2026-11-17' }), LUMP('f3', 3)];
  const { c, patched } = undoCtx(list, '');
  assert.match(c.erpLumpNoticeFor(list[0]), /2건/);
  assert.equal(c.erpUndoIncome(list[0]), true);
  assert.equal(patched.filter((p) => p.store === 'finance_income').map((p) => p.id).sort().join(','), 'f1,f3');
  assert.equal(c.erpLumpNoticeFor({ id: 'z' }), '');
});

/* ───────── ⑨ 저장·확정 길이 실제로 적는다 (짝 확인) ───────── */
const SAVE = cut('  function saveIncome(row, pItem, opts){', '  /* ── 확정 한 번 = 연쇄 처리 ──');
const UPSERT = SAVE.slice(SAVE.indexOf('erpUpsertIncome({id:_fiId,'), SAVE.indexOf("if(_saved === false)"));
test('⑨ saveIncome 이 분할 칸을 입금 줄에 적는다(자문료)', () => {
  ['advisoryDue', 'advisoryPaidBefore', 'advisoryRemainAfter', 'splitSeq', 'isSplit'].forEach((k) =>
    assert.ok(UPSERT.indexOf(k + ':') >= 0, k + ' 를 줄에 적지 않는다'));
  assert.ok(SAVE.indexOf('erpAdvisorySplitInfo(') >= 0, '분할 값은 한 함수(erpAdvisorySplitInfo)에서 낸다');
  assert.ok(/if\(isAdv\)\{\s*try\{[\s\S]*erpAdvisorySplitInfo\(/.test(SAVE), '자문료일 때만 센다');
});
test('⑨ saveIncome 이 일괄 칸(lumpId·순번·건수·합계·통장 줄)을 적고, 사건·계약 분할기록에도 lumpId 를 잇는다', () => {
  ['lumpId', 'lumpSeq', 'lumpN', 'lumpTotal', 'bankRowKey', 'prepaid'].forEach((k) =>
    assert.ok(UPSERT.indexOf(k + ':') >= 0, k + ' 를 줄에 적지 않는다'));
  assert.match(SAVE, /splitPayments = \(_it\.splitPayments\|\|\[\]\)\.concat\(\[\{[\s\S]*?lumpId:_lump \? _lump\.id : undefined/, 'splitPayments 에도 같은 번호');
});

const CONFIRM = cut('  async function confirmLump(row, lz, choice){', '  /* 보류함 — 누가 왜 보낸 돈인지 모를 때.');
test('⑨ 일괄 확정은 «전부 되거나 하나도 안 된다» — 중간에 막히면 만든 것을 무른다', () => {
  assert.match(CONFIRM, /var lumpId = 'lp-'/);
  assert.match(CONFIRM, /saveIncome\(Object\.assign\(\{\}, row, \{ amount:p\.amount \}\), pit,\s*\{ withPerf:true, prepay:!!p\.prepay, lump:\{ id:lumpId/);
  assert.match(CONFIRM, /catch\(e\)\{[\s\S]*var undone = !firstFi \|\| erpUndoIncome\(firstFi\);/, '실패하면 «한 번만» 불러 만든 줄을 모두 무르고 결과를 확인한다');
  assert.ok(CONFIRM.indexOf('made.forEach') < 0, '줄마다 부르지 않는다 — 이미 물러진 줄을 또 무르게 된다');
  assert.match(CONFIRM, /되돌리지도 못했습니다/, '못 물렀으면 «되돌렸다»고 하지 않는다');
  assert.ok(CONFIRM.indexOf('return;', CONFIRM.indexOf('catch(e)')) > 0, '실패하면 통장 줄을 «처리됨»으로 찍지 않고 멈춘다');
  assert.ok(CONFIRM.indexOf('erpMarkBankRowProcessed') > CONFIRM.indexOf('catch(e)'), '처리됨 표시는 «다 만든 뒤»에만');
  assert.match(CONFIRM, /if\(!parts\)\{ showToast/, '남는 돈을 안 골랐으면 확정하지 않는다');
});
test('⑨ 확정 전에 사람에게 무엇이 어떻게 나뉘는지 보여 주고 묻는다', () => {
  assert.match(CONFIRM, /await popConfirm\(/);
  assert.ok(CONFIRM.indexOf('await popConfirm(') < CONFIRM.indexOf('saveIncome('), '묻고 나서 저장한다');
});

/* ───────── ⑩ 화면 연결 ───────── */
const FL = cut('function FinanceLedger(', 'function FinanceIncome');
test('⑩ 줄 상태가 stateOf 를 거치고, 모두확정(readyRows)은 일괄을 모른다', () => {
  assert.ok(FL.indexOf('var st = stateOf(row, grp);') >= 0, '줄 상태 계산이 일괄 표시를 거친다');
  assert.ok(FL.indexOf('var _st  = (rowInfo[row._k] && rowInfo[row._k].st) || stateOf(row, _grp);') >= 0, '펼침 창도 «줄과 같은 판정»(이름 다른 줄은 노랑으로 강등된 것)을 쓴다');
  const ready = FL.slice(FL.indexOf('var readyRows = []'), FL.indexOf('var autoRows = [];'));
  assert.ok(ready.indexOf('lumpOf') < 0 && ready.indexOf('confirmLump') < 0, '모두확정 길에 일괄이 끼어들지 않는다');
});
test('⑩ 펼침 창에 일괄 제안이 있고, 일괄일 때는 과입금 질문을 띄우지 않는다', () => {
  assert.ok(FL.indexOf('📚 밀린 자문료 일괄 입금') >= 0);
  assert.ok(FL.indexOf('!_mCms && _st.diff>0 && pItem && !lz && h(') >= 0, '일괄이면 「넘친 돈을 어떻게」 를 따로 묻지 않는다');
  assert.ok(FL.indexOf("confirmLump(row,lz,'prepay')") >= 0 && FL.indexOf("confirmLump(row,lz,'asis')") >= 0, '남는 돈은 사람이 고른다');
});
test('⑩ 확정 이력에 일괄·분할 딱지가 있다', () => {
  assert.ok(FL.indexOf('fi.lumpId && h(') >= 0);
  assert.ok(FL.indexOf('fi.isSplit && h(') >= 0);
});

/* ───────── ⑪ 자동 검토(2026-11-16) 반영 ───────── */
test('⑪ 채운 돈 + 남은 돈 = 입금액은 «밀린 달이 하나도 없을 때»도 지킨다(허용치 이하의 작은 돈도 버리지 않는다)', () => {
  const c = makeCtx();
  const p = c.erpArrearsAllocate(500, []);
  assert.equal(p.parts.length, 0);
  assert.equal(p.rest, 500, '밀린 달이 없으면 입금액 전부가 남은 돈이다');
  assert.equal(c.erpArrearsAllocate(0, DUES(2, 220000)).rest, 0);
  assert.equal(c.erpArrearsAllocate(-100, DUES(2, 220000)).parts.length, 0);
  assert.equal(c.erpArrearsAllocate(-100, DUES(2, 220000)).rest, 0, '음수는 나눌 것이 없다');
});

test('⑪ 허용치 안으로 모자란 달은 «완납»으로 본다 — 다음 일괄 입금이 그 1,000원 남짓을 가장 오래된 달로 먼저 채우지 않는다', () => {
  const c = makeCtx();
  const tol = c.ERP_ARREARS_TOL;
  const near = [INC('2026-09', 220000 - tol, { id: 'near' })];                  // 9월은 허용치만큼 모자라게 받았다
  const dues = c.erpAdvisoryDues(CO(), near, { upToYm: '2026-11', maxMonths: 3 });
  assert.equal(YMS(dues), '2026-10,2026-11', '9월은 완납으로 보고 빼고 10·11월만 밀린 달');
  const over = [INC('2026-09', 220000 - tol - 1, { id: 'over' })];             // 허용치를 넘게 모자라면 밀린 달
  assert.equal(YMS(c.erpAdvisoryDues(CO(), over, { upToYm: '2026-11', maxMonths: 3 })), '2026-09,2026-10,2026-11');
  const none = c.erpAdvisoryDues(CO(), [], { upToYm: '2026-11', maxMonths: 3 });
  assert.equal(none.length, 3, '아무것도 안 받은 달은 허용치와 상관없이 밀린 달');
});

/* 되돌리기 «문 하나» — 이미 물러진 줄을 또 무르지 않는다 / 일부 실패를 뭉개지 않는다 */
function undo2Ctx(incomes, opts) {
  opts = opts || {};
  const c = makeCtx();
  const patched = [], toasts = [];
  c.dbGet = (k, d) => (k === 'finance_income' ? incomes : d);
  c.dbPatch = (store, id, p) => { patched.push({ store, id, p }); return opts.failId && id === opts.failId ? false : true; };
  c.showToast = (m) => toasts.push(m);
  c.isIncomeLocked = () => false;
  c.erpPerfLockInfo = () => ({ locked: false });
  c.erpIncomeSourceStore = () => 'companies';
  c.erpIncomeLockYm = () => '';
  c.CURRENT_USER = { sid: 'P-1' };
  vm.runInContext(cut('function erpLumpSiblings(', '/* 입금 마감된 달이면 그 달'), c);
  vm.runInContext(cut('function erpUndoIncome(', '/* 안내 글 — 되돌리기 확인창에'), c);
  return { c, patched, toasts };
}
const LP = (id, seq, over) => Object.assign({ id, kind: '자문료', date: '2026-11-16', lumpId: 'lp-1', lumpSeq: seq, lumpN: 3, companyName: '가상산업' }, over || {});

test('⑪ 이미 물러진 줄을 또 무르면 아무것도 하지 않는다 — 일괄 확정 실패 복구가 줄마다 불러도 단일 무르기가 되풀이되지 않는다', () => {
  const list = [LP('f1', 1), LP('f2', 2), LP('f3', 3)];
  const u = undo2Ctx(list);
  const stale = list.map((x) => Object.assign({}, x));            // 화면이 쥔 «옛 사본» — 아직 undoneDate 가 없다
  assert.equal(u.c.erpUndoIncome(stale[0]), true);                // 형제까지 함께 물러진다
  const first = u.patched.filter((p) => p.store === 'finance_income').length;
  assert.equal(first, 3);
  list.forEach((x, i) => { x.undoneDate = '2026-11-17'; });        // 저장소에는 이제 모두 물러져 있다
  assert.equal(u.c.erpUndoIncome(stale[1]), true, '두 번째 호출은 «이미 됨»');
  assert.equal(u.c.erpUndoIncome(stale[2]), true);
  assert.equal(u.patched.filter((p) => p.store === 'finance_income').length, first, '다시 저장하지 않았다');
});

test('⑪ 일부만 되돌려지면 말없이 true/false 로 뭉개지 않고 알린다', () => {
  const list = [LP('f1', 1), LP('f2', 2), LP('f3', 3)];
  const u = undo2Ctx(list, { failId: 'f2' });
  assert.equal(u.c.erpUndoIncome(list[0]), false, '하나라도 못 물렀으면 성공이 아니다');
  assert.ok(u.toasts.some((t) => /3건 중 1건/.test(t)), '몇 건 중 몇 건인지 알린다');
});

test('⑪ 저장이 안 되면(dbPatch false) 되돌렸다고 하지 않는다(일괄이 아닌 줄도)', () => {
  const list = [{ id: 'x1', kind: '자문료', date: '2026-11-16' }];
  const u = undo2Ctx(list, { failId: 'x1' });
  assert.equal(u.c.erpUndoIncome(list[0]), false);
});

test('⑪ 한 줄만 무르는 길(_noCascade)이 있고, 업체 바꾸기(doMove)는 그 길을 쓴다 — 일괄 줄 하나를 옮길 때 형제 금액이 사라지지 않는다', () => {
  const list = [LP('f1', 1), LP('f2', 2), LP('f3', 3)];
  const u = undo2Ctx(list);
  assert.equal(u.c.erpUndoIncome(list[1], true), true);
  assert.equal(u.patched.filter((p) => p.store === 'finance_income').map((p) => p.id).join(','), 'f2', '그 한 줄만');
  const MOVE = FL.slice(FL.indexOf('async function doMove(p){'), FL.indexOf('async function doMove(p){') + 2600);
  assert.ok(MOVE.indexOf('erpUndoIncome(fi, true)') >= 0, '업체 바꾸기는 한 줄만 무른다');
  assert.ok(MOVE.indexOf('erpUndoIncome(fi)') < 0, '형제까지 무르는 호출이 남아 있지 않다');
});
