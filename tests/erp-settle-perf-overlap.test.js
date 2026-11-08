/* 재무관리 — 컨설팅정산이 맡은 사업은 «개인수익»으로 확정해도 성과급을 만들지 않는다 (대표 선택 2026-10-31)
   설계 docs/superpowers/specs/2026-10-31-consult-settle-design.md §8 · PR ③

   ■ 왜
   개인 통장으로 들어오는 정부사업(일터혁신 등)은 컨설팅정산 앱(pu-settle.html)이 주관·담당 몫을 따로 정산한다.
   재무관리에서도 성과급을 만들면 담당에게 «두 번» 나간다.

   ■ 지키는 것
   ① 맡은 사업 = settle/rules 의 열쇠(_deleted 아닌 것) — 규칙을 만들고 지우면 저절로 따라간다(푸는 길도 거기다)
   ② «개인수익»일 때만 막는다 — «법인 매출»로 확정하는 길은 그대로(돈이 법인에 들어왔으면 보통 성과급이 맞다)
   ③ 성과급이 생기는 «세 길» 모두 같은 함수(erpSettlePerfType)로 막는다 — 입금확정 창 · 개인↔법인 다시 열기 · 거래내역 통장 줄 확정
   ④ 이미 만들어진 성과급은 건드리지 않는다(돈 기록 자동 변경 금지) — «겹칠 수 있음»만 알린다
   ⑤ 규칙을 «읽기만» 한다 — settle 에 쓰지 않는다

   ★ 함수를 떠서 «돌려» 본다(글자 찾기만 하면 기능을 꺼도 초록이다 — STATUS 되풀이된 실수 ②).
   ★ 자료는 모두 지어낸 것이다(공개 저장소). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs, 함수몸 } = require('./strip-comments.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => {
  const i = SRC.indexOf(a), j = SRC.indexOf(b, i + 1);
  assert.ok(i >= 0 && j > i, '잘라내지 못함: ' + a);
  return SRC.slice(i, j);
};

/* ── 진짜 함수를 꺼내 돌린다 ── */
const CONS_TYPES = [{ code: 'c-ilteo', name: '일터혁신' }, { code: 'c-tech', name: '기술지원', personalDeposit: true }, { code: 'c-clinic', name: '현장클리닉' }];
const USERS = [{ sid: 'P-001', name: '홍길동' }, { sid: 'P-002', name: '김가나' }];
function makeCtx(extra) {
  const ctx = Object.assign({ console, Math, Object, JSON, parseInt, parseFloat, String, Array, Date, Promise }, extra || {});
  ctx.window = ctx;
  vm.createContext(ctx);
  ctx.BIZ_CONS_SEED = [];
  ctx.dbGet = (k, d) => (k === 'biz_cons_types' ? CONS_TYPES : k === 'user_accounts' ? USERS : d);
  vm.runInContext('function erpWithholdTax(a,k,r){return {total:Math.round(a*(k==="biz"?0.033:(r||8.8)/100))};}', ctx);
  vm.runInContext('function getMgrRates(){return {};} function getRateAt(sid,d){return sid==="P-001"?15:10;} function resolveBaseRate(sid){return getRateAt(sid);} function erpNoName(s){return s;}', ctx);
  vm.runInContext(cut('function consTypeIsPersonal(', '\nfunction CaseEditModal'), ctx);
  vm.runInContext(cut('function personalReclassPatch(', '\nfunction PersonalDepositBulkModal('), ctx);
  return ctx;
}
const RULED = { 'c-ilteo': '일터혁신' };            // 컨설팅정산이 맡은 사업 종류(settle/rules 열쇠)
const PERSONAL = { personalRevenue: true };

test('① 사업 종류 코드를 원본(컨설팅·계약)에서 같은 잣대로 읽는다', () => {
  const c = makeCtx();
  assert.equal(c.erpConsTypeCodeOf({ typeCode: 'c-ilteo' }), 'c-ilteo');
  assert.equal(c.erpConsTypeCodeOf({ kinds: ['consulting'], typeCodes: { consulting: 'c-ilteo' } }), 'c-ilteo', '계약은 typeCodes.consulting');
  assert.equal(c.erpConsTypeCodeOf({ kinds: ['company'], typeCodes: { consulting: 'c-ilteo' } }), '', '컨설팅이 아닌 계약은 이 칸을 안 본다');
  assert.equal(c.erpConsTypeCodeOf(null), '');
  /* 개인입금 판정도 같은 함수로 코드를 읽는다 — 두 판정이 어긋나면 «개인수익인데 정산 몫이 아님»이 생긴다 */
  assert.equal(c.erpIsPersonalDeposit({ kinds: ['consulting'], typeCodes: { consulting: 'c-tech' } }), true);
});

test('② 맡은 사업 목록 — 지워진 규칙·껍데기는 뺀다', () => {
  const c = makeCtx();
  const m = c.erpSettleTypesFrom({ 'c-ilteo': { id: 'c-ilteo', title: '일터혁신' }, 'c-old': { id: 'c-old', _deleted: true }, 'c-bad': 'x', 'c-nul': null });
  /* vm 안에서 만든 객체·배열은 prototype 이 달라 deepEqual 이 «다르다»고 한다 — 열쇠만 뽑아 견준다 */
  assert.equal(JSON.stringify(Object.keys(m)), JSON.stringify(['c-ilteo']));
  assert.equal(m['c-ilteo'], '일터혁신');
  assert.equal(Object.keys(c.erpSettleTypesFrom(null)).length, 0, '규칙이 아예 없어도 오류 없이 빈 목록');
});

test('③ 개인수익 + 맡은 사업일 때만 막는다 (법인 매출 길은 그대로)', () => {
  const c = makeCtx();
  const src = { typeCode: 'c-ilteo' };
  assert.equal(c.erpSettlePerfType(src, PERSONAL, RULED), 'c-ilteo');
  assert.equal(c.erpSettlePerfType(src, {}, RULED), '', '개인수익이 아니면(법인 매출) 성과급은 그대로');
  assert.equal(c.erpSettlePerfType(src, { vatIncluded: true }, RULED), '', '부가세 포함 법인 매출도 그대로');
  assert.equal(c.erpSettlePerfType(src, { bizIncomeTax: true }, RULED), '', '원천징수 건은 이 막음의 대상이 아니다');
  assert.equal(c.erpSettlePerfType({ typeCode: 'c-clinic' }, PERSONAL, RULED), '', '정산이 안 맡은 사업은 예전 그대로');
  assert.equal(c.erpSettlePerfType({ kinds: ['consulting'], typeCodes: { consulting: 'c-ilteo' } }, PERSONAL, RULED), 'c-ilteo', '계약 쪽 원본도 막는다');
  assert.equal(c.erpSettlePerfType(null, PERSONAL, RULED), '');
  assert.equal(c.erpSettlePerfType(src, null, RULED), '');
  assert.equal(c.erpSettlePerfType({}, PERSONAL, RULED), '', '사업 종류를 모르는 원본은 막지 않는다');
});

test('④ 규칙을 못 읽었으면(null) 막지 못한다 — 짐작으로 막지 않는다', () => {
  const c = makeCtx();           // fbDb 없음 → 읽기 시도도 못 한다
  assert.equal(c.ERP_SETTLE_TYPES, null);
  assert.equal(c.erpSettlePerfType({ typeCode: 'c-ilteo' }, PERSONAL), '');
  assert.equal(c.ERP_SETTLE_TYPES, null, '못 읽은 것을 «빈 목록»으로 바꾸지 않는다');
  assert.equal(c.erpSettlePerfType({ typeCode: 'c-ilteo' }, PERSONAL, {}), '', '규칙이 하나도 없으면 막을 것도 없다');
});

test('⑤ 규칙 읽기 — 읽기만 하고, 한 번만 붙고, 권한이 없으면 조용히 넘어간다', () => {
  const calls = [];
  let onValue = null, onError = null;
  const fbDb = { ref(p) { calls.push(['ref', p]); return { on(ev, ok, err) { calls.push(['on', ev]); onValue = ok; onError = err; }, off() {} }; } };
  const c = makeCtx({ fbDb, firebase: { auth: () => ({ currentUser: { uid: 'u1' } }) } });
  vm.runInContext('erpSettleTypesLoad(); erpSettleTypesLoad(); erpSettleTypesLoad();', c);
  assert.deepEqual(calls.filter((x) => x[0] === 'ref'), [['ref', 'settle/rules']], '읽는 자리는 settle/rules 하나, 여러 번 불러도 한 번만 붙는다');
  assert.equal(calls.filter((x) => x[0] === 'on').length, 1);
  onValue({ val: () => ({ 'c-ilteo': { id: 'c-ilteo', title: '일터혁신' }, 'c-old': { id: 'c-old', _deleted: true } }) });
  assert.equal(JSON.stringify(Object.keys(c.ERP_SETTLE_TYPES)), JSON.stringify(['c-ilteo']), '규칙이 바뀌면 저절로 따라간다');
  onValue({ val: () => null });
  assert.equal(Object.keys(c.ERP_SETTLE_TYPES).length, 0, '규칙을 다 지우면 «빈 목록» — 푸는 길');
  assert.notEqual(c.ERP_SETTLE_TYPES, null, '«못 읽음(null)»과 «규칙 없음»은 다르다');

  /* 권한 없음 — 오류 없이 넘어가고 «못 읽음(null)»으로 남는다. 바로 다시 두드리지 않는다 */
  const calls2 = [];
  let err2 = null;
  const fbDb2 = { ref(p) { calls2.push(p); return { on(ev, ok, err) { err2 = err; } }; } };
  const c2 = makeCtx({ fbDb: fbDb2, firebase: { auth: () => ({ currentUser: { uid: 'u2' } }) } });
  vm.runInContext('erpSettleTypesLoad();', c2);
  err2(new Error('PERMISSION_DENIED'));
  vm.runInContext('erpSettleTypesLoad(); erpSettleTypesLoad();', c2);
  assert.equal(calls2.length, 1, '권한이 막힌 직후에는 다시 묻지 않는다');
  assert.equal(c2.ERP_SETTLE_TYPES, null);

  /* 로그인 확인 전 — 읽지 않는다(나중에 다시) */
  const calls3 = [];
  const c3 = makeCtx({ fbDb: { ref(p) { calls3.push(p); return { on() {} }; } }, firebase: { auth: () => ({ currentUser: null }) } });
  vm.runInContext('erpSettleTypesLoad();', c3);
  assert.equal(calls3.length, 0);

  const body = stripJs(함수몸(SRC, 'erpSettleTypesLoad'));
  assert.ok(!/\.(set|update|remove|push|transaction)\(/.test(body), '규칙 읽기는 settle 에 쓰지 않는다');
});

test('⑥ 개인↔법인 다시 열기 — 맡은 사업의 개인수익은 성과급 없이, 법인 매출로 되돌리면 예전처럼', () => {
  const c = makeCtx();
  c.ERP_SETTLE_TYPES = RULED;
  const fi = { id: 'fi-1', amount: 1000000, date: '2026-10-05', sourceKind: 'consulting', sourceId: 's1', splitMainPct: 100, managerSid: 'P-001', deductions: {} };
  const ruled = { id: 's1', typeCode: 'c-ilteo', managerMain: 'P-001', managerSubs: [] };
  const plain = { id: 's2', typeCode: 'c-clinic', managerMain: 'P-001', managerSubs: [] };

  const toP = c.personalReclassPatch(fi, ruled, true);
  assert.equal(toP.perfShares.length, 0, '맡은 사업의 개인수익 → 성과급을 만들지 않는다');
  assert.equal(toP.perfSettleType, 'c-ilteo');
  assert.equal(toP.perfExclude, true);
  assert.equal(toP.isPersonalIncome, true);
  assert.equal(toP.deductions.personalRevenue, true);

  const toPplain = c.personalReclassPatch(fi, plain, true);
  assert.ok(toPplain.perfShares.length >= 1, '정산이 안 맡은 사업의 개인수익은 예전처럼 성과급 반영');
  assert.equal(toPplain.perfSettleType, undefined);

  const back = c.personalReclassPatch(fi, ruled, false);
  assert.ok(back.perfShares.length >= 1, '법인 매출로 되돌리면 예전처럼 성과급을 나눈다');
  assert.equal(back.perfSettleType, undefined, '되돌리면 «정산 몫» 표시를 지운다');
  assert.equal(back.isPersonalIncome, false);
});

test('⑦ 확정된 입금이 «지금» 정산 몫인가 — 표시·규칙·푸는 길', () => {
  const c = makeCtx();
  const ruled = { typeCode: 'c-ilteo' };
  const marked = { perfSettleType: 'c-ilteo', deductions: PERSONAL };
  assert.equal(c.erpSettleOfIncome(marked, null, RULED), 'c-ilteo', '표시가 있고 규칙이 있으면 정산 몫');
  assert.equal(c.erpSettleOfIncome(marked, null, {}), '', '★ 푸는 길 — 컨설팅정산에서 규칙을 지우면 표시가 남아 있어도 풀린다');
  assert.equal(c.erpSettleOfIncome(marked, null, null), 'c-ilteo', '못 읽었으면 표시를 믿는다(막은 채로 둔다)');
  const unmarked = { deductions: PERSONAL, perfShares: [] };
  assert.equal(c.erpSettleOfIncome(unmarked, ruled, RULED), 'c-ilteo', '표시가 없어도 원본 사업 종류로 다시 본다');
  assert.equal(c.erpSettleOfIncome({ deductions: {} }, ruled, RULED), '', '개인수익이 아니면 아니다');
  assert.equal(c.erpSettleOfIncome(null, ruled, RULED), '');
  /* 원본 찾기 — 컨설팅·계약만 본다(사건·기금에는 컨설팅 사업 종류가 없다) */
  c.dbGet = (k, d) => (k === 'consultings' ? [{ id: 's1', typeCode: 'c-ilteo' }] : k === 'contracts' ? [{ id: 'k1', kinds: ['consulting'], typeCodes: { consulting: 'c-ilteo' } }] : d);
  assert.equal(c.erpSettleOfIncome({ deductions: PERSONAL, sourceKind: 'consulting', sourceId: 's1' }, undefined, RULED), 'c-ilteo');
  assert.equal(c.erpSettleOfIncome({ deductions: PERSONAL, sourceKind: 'contract', sourceId: 'k1' }, undefined, RULED), 'c-ilteo');
  assert.equal(c.erpSettleOfIncome({ deductions: PERSONAL, sourceKind: 'case', sourceId: 's1' }, undefined, RULED), '');
});

test('⑧ 이미 만든 성과급은 건드리지 않고 «겹칠 수 있음»만 알린다', () => {
  const c = makeCtx();
  const src = { typeCode: 'c-ilteo' };
  const old = { deductions: PERSONAL, perfShares: [{ sid: 'P-001', amount: 100 }] };
  assert.equal(c.erpSettleOverlapType(old, src, RULED), 'c-ilteo');
  assert.equal(c.erpSettleOverlapType(Object.assign({}, old, { perfSettleType: 'c-ilteo' }), src, RULED), '', '막음으로 만든 건(표시 있음)은 겹침이 아니다');
  assert.equal(c.erpSettleOverlapType({ deductions: PERSONAL, perfShares: [] }, src, RULED), '', '성과급이 없으면 겹칠 것이 없다');
  assert.equal(c.erpSettleOverlapType({ deductions: {}, perfShares: old.perfShares }, src, RULED), '', '법인 매출의 성과급은 정상이다');
  assert.equal(c.erpSettleOverlapType(old, { typeCode: 'c-clinic' }, RULED), '');
  /* 알리기만 한다 — 이 함수들은 입금 기록에 쓰지 않는다 */
  ['erpSettleOverlapType', 'erpSettleOfIncome', 'erpSettlePerfType'].forEach((n) => {
    assert.ok(!/\b(dbPatch|dbUpsert|erpUpsertIncome|dbSet)\(/.test(stripJs(함수몸(SRC, n))), n + ' 은 돈 기록을 쓰지 않는다');
  });
});

test('⑨ 안내 글 — 맡은 사업 이름이 보인다', () => {
  const c = makeCtx();
  c.ERP_SETTLE_TYPES = { 'c-ilteo': '일터혁신' };
  assert.ok(c.erpSettleLabel('c-ilteo').includes('일터혁신'));
  c.ERP_SETTLE_TYPES = { 'c-clinic': '' };                 // 규칙에 이름이 없으면 컨설팅 유형 사전의 이름
  assert.ok(c.erpSettleLabel('c-clinic').includes('현장클리닉'));
  c.ERP_SETTLE_TYPES = null;
  assert.ok(c.erpSettleLabel('c-ilteo').length > 0, '못 읽었어도 글은 나온다');
});

/* ── 세 길에 실제로 붙어 있는가 — 낱말이 아니라 «순서와 짝»을 본다 ── */
const PEND = stripJs(함수몸(SRC, 'IncomePendingTab'));

test('⑩ 길 ① 입금확정 창 저장 — 개인수익이면 «만들기 전에» 막는다', () => {
  const a = PEND.indexOf('var settleType = isPersonalRev ? erpSettlePerfType(it, deductions)');
  assert.ok(a > 0, '저장 길이 같은 함수로 판단한다');
  const body = PEND.slice(a, PEND.indexOf('erpUpsertIncome(newFi)', a));
  assert.ok(/if\(settleType\)\{\s*perfShares = \[\];\s*\} else if\(isPersonalRev\)\{/.test(body), '정산 몫이면 개인수익 조정 분배보다 «먼저» 빈 성과급');
  assert.ok(body.indexOf('if(settleType)') < body.indexOf('adjPctMap'), '조정 분배 계산에 들어가지 않는다');
  assert.ok(/perfSettleType: settleType \|\| undefined/.test(body), '저장 기록에 «정산 몫» 표시를 남긴다');
  assert.ok(/perfExclude: !perfEnabled \|\| \(isPersonalRev && perfShares\.length === 0\)/.test(body), '명시적 제외로 남아 «분배 누락» 경고가 안 뜬다');
});

test('⑪ 길 ① 확정 창 화면 — 미리보기도 같은 함수, 정산 몫이면 성과급 조정 칸을 안 연다', () => {
  assert.ok(/var _cmSettle = erpSettlePerfType\(it, _cmDed\);/.test(PEND), '미리보기가 저장과 같은 함수를 쓴다');
  assert.ok(/if\(_cmSettle\) return h\(/.test(PEND), '성과 미리보기 한 줄이 «만들지 않습니다»로 바뀐다');
  assert.ok(/ded\.personalRevenue && !erpSettlePerfType\(it, ded\) && \(function\(\)\{/.test(PEND), '정산 몫이면 개인 직책요율 조정 칸을 열지 않는다');
  assert.ok(/ded\.personalRevenue && erpSettlePerfType\(it, ded\) && h\(/.test(PEND), '대신 까닭을 알려 주는 상자');
  /* 두 칸의 짝 — 한쪽만 고치면 «조정 칸도 있고 안내도 있는» 화면이 된다 */
  assert.equal((PEND.match(/erpSettlePerfType\(it, ded\)/g) || []).length >= 3, true);
});

test('⑫ 길 ② 개인↔법인 다시 열기', () => {
  const body = stripJs(함수몸(SRC, 'personalReclassPatch'));
  assert.ok(/var settleType = toPersonal \? erpSettlePerfType\(src, ded\) : '';/.test(body));
  assert.ok(/if\(main && !settleType\)\{/.test(body), '정산 몫이면 성과급 계산에 들어가지 않는다');
  assert.ok(/perfSettleType: settleType \|\| undefined/.test(body));
});

test('⑬ 길 ③ 거래내역 통장 줄 확정 — 창을 안 거치는 길도 같은 함수', () => {
  const a = SRC.indexOf('if(opts.withPerf && !isAdv){');
  assert.ok(a > 0);
  const blk = stripJs(SRC.slice(a, SRC.indexOf('var _fiId =', a)));
  assert.ok(/_settle = erpSettlePerfType\(_it, _ded\);/.test(blk), '공제 첫 설정(_ded) 바로 뒤에 같은 함수로 판단');
  assert.ok(blk.indexOf('_settle = erpSettlePerfType') < blk.indexOf('calcPerfShares('), '성과급을 나누기 «전에» 판단');
  assert.ok(/if\(_main && !_settle\)\{/.test(blk), '정산 몫이면 성과급을 나누지 않는다');
  const saved = stripJs(SRC.slice(SRC.indexOf('var _saved = erpUpsertIncome({id:_fiId,'), SRC.indexOf('if(_saved === false)')));
  assert.ok(/perfExclude: _settle \? true : undefined, perfSettleType: _settle \|\| undefined/.test(saved), '저장 기록에 표시를 남긴다');
});

test('⑭ 뒤늦게 «⭐ 반영»으로 성과급을 얹는 길도 막는다', () => {
  const body = stripJs(함수몸(SRC, 'reEnablePerf') || SRC.slice(SRC.indexOf('async function reEnablePerf('), SRC.indexOf('async function reEnablePerf(') + 3000));
  const i = body.indexOf('erpSettleOfIncome(fi)');
  assert.ok(i >= 0, '정산 몫인지 먼저 본다');
  assert.ok(i < body.indexOf('popConfirm('), '묻기 «전에» 멈춘다');
  assert.ok(/if\(_st\)\{[\s\S]{0,300}?return;/.test(body), '막으면 아무것도 쓰지 않고 돌아간다');
  /* 두 목록(미반영 점검·직원 성과 상세)의 단추도 정산 몫이면 단추 대신 «🧾 정산» */
  assert.ok(/it\.settle \? h\('span'/.test(stripJs(함수몸(SRC, 'PerfManagement'))), '직원 성과 상세의 «⭐ 반영» 단추');
  const UNM = stripJs(함수몸(SRC, 'IncomeUnmatchedTab'));          // «성과 미반영» 점검 화면 — reEnablePerf 가 있는 곳
  assert.ok(/fi\.perfExclude && erpSettleOfIncome\(fi\)/.test(UNM), '미반영 점검 목록 단추');
  assert.ok(/if\(noShare && erpSettleOfIncome\(fi\)\) return \{/.test(UNM), '정산 몫은 «점검 필요»에 쌓이지 않는다');
});

test('⑮ 규칙을 «미리» 읽는 자리 — 통장 줄 확정 화면과 입금관리 화면을 열 때', () => {
  ['FinanceLedger', 'IncomePendingTab'].forEach((n) => {
    const body = 함수몸(SRC, n);
    assert.ok(body && /try\{ erpSettleTypesLoad\(\); \}catch\(/.test(body.slice(0, 900)), n + ' 시작 부분에서 읽어 둔다');
  });
});

test('⑯ «개인수익» 탭 — 이미 붙은 성과급이 겹칠 수 있음을 알린다(고치지는 않는다)', () => {
  const body = stripJs(함수몸(SRC, 'PerfManagement'));
  assert.ok(/erpSettleOverlapType\(fi\)/.test(body));
  assert.ok(/overlapN > 0 && h\(/.test(body), '위쪽 안내 상자');
  assert.ok(/overlapOf\[fi\.id\] && h\(/.test(body), '줄마다 딱지');
  const seg = body.slice(body.indexOf('var overlapOf = {}'), body.indexOf('function dedAmount('));
  assert.ok(!/\b(dbPatch|dbUpsert|erpUpsertIncome)\(/.test(seg), '알리기만 하고 돈 기록을 쓰지 않는다');
});

test('⑰ 성과 수정 창 — 정산 몫이면 경고만 띄운다(손으로 고치는 창이라 막지는 않는다)', () => {
  const a = SRC.indexOf('erpSettleOfIncome(fi, srcItem) && h(');
  assert.ok(a > 0);
  assert.ok(/두 번 나갈 수 있습니다/.test(SRC.slice(a, a + 400)));
});
