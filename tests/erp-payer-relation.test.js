/* 재무관리 — 입금자 명의가 사업장과 다를 때 (대표 2026-11-16 「다른 사람·다른 사업장 이름으로 들어오면 어떻게 처리」)
   처리 기준 한 장: docs/규칙/입금-명의-처리.md · 설계 docs/superpowers/specs/2026-11-16-입금-일괄-명의-카드상담-design.md §4

   ■ 지키는 것
   ① 입금자를 여섯 종류로 가른다 — 본인·관계 입금자·다른 사업장 이름·모르는 이름·통로(CMS·합계 후보 적요)·적요 없음
   ② 이름이 다른 돈(다른 사업장·모르는 이름)은 «사유를 고른 뒤에만» 확정된다 — 취소하면 확정하지 않는다
   ③ 이름이 다른 돈은 입금자 별칭으로 «배우지 않는다». 등록은 사람이 «관계 입금자»를 켰을 때만
   ④ 관계 입금자는 사업장 기록에 두고, CMS 통로·합계 후보 적요·사업장 이름 자신·사유 없는 «기타»는 등록 못 한다
   ⑤ 등록한 이름은 이름 근거(100점)가 된다 — 등록 안 한 이름·지운 이름·다른 사업장 등록은 안 된다
   ⑥ 입금 줄에 입금자(payerName)·종류·사유가 적힌다. 창을 못 거친 자동 확정은 «확인 필요» 표시를 단다
   ⑦ 관계 입금자는 지울 수 있다(잘못 등록하면 계속 같은 곳으로 끌려간다)

   ★ 함수를 떠서 «돌려» 본다(글자 찾기만 하면 기능을 꺼도 초록이다 — STATUS 되풀이된 실수 ②).
   ★ 자료는 모두 지어낸 것이다(공개 저장소). */
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

const COMBO = ['비즈사업', '생산성본부'];
function makeCtx(extra) {
  const ctx = Object.assign({ console, Math, Object, JSON, parseInt, parseFloat, String, Array, Date, Promise, RegExp }, extra || {});
  ctx.window = ctx;
  vm.createContext(ctx);
  ctx.todayYM = () => '2026-11';
  ctx.dbGet = (k, d) => (k === 'companies' ? ctx._companies || [] : d);
  vm.runInContext(cut('function erpNormName(', '// ── 입금자 별칭 학습'), ctx);
  const cms = SRC.indexOf('var CMS_MEMO_MARKERS');
  const cmsEnd = SRC.indexOf('\n}\n', SRC.indexOf('function erpIsCmsMemo(')) + 3;
  vm.runInContext(SRC.slice(cms, cmsEnd), ctx);
  vm.runInContext(cut('function erpMemoNames(', "\nif(typeof window !== 'undefined'){"), ctx);
  vm.runInContext(cut('function erpMemoPayerName(', '/* ── 이름 근거 게이트 ──'), ctx);
  vm.runInContext(cut('function erpMatchScore(', '/* 적요에서 «보낸 사람» 이름만'), ctx);
  ctx.erpComboAllowed = (m) => COMBO.some((w) => String(m).indexOf(w) >= 0);
  ctx.erpAliasEvidence = () => null;
  ctx.erpAliasTrusted = () => false;
  ctx.erpAmountFingerprint = () => null;
  ctx.erpInvoiceMatch = () => null;
  return ctx;
}
const CO = (over) => Object.assign({ id: 'co-1', name: '가상산업', status: 'active', ceo: '김대표' }, over || {});
const R = (name, relation, over) => Object.assign({ key: name, keys: [name], name, relation: relation || 'ceo', reason: '', at: '2026-11-16T00:00:00Z' }, over || {});

/* ───────── ① 입금자 열쇠 ───────── */
test('① 입금자 열쇠 — 하나은행 문자 꼴·「이름(상호)」 꼴을 모두 본다, 두 글자 미만은 뺀다', () => {
  const c = makeCtx();
  assert.equal(JSON.stringify(c.erpPayerKeys('입금 660,000원 계좌번호 680******45904 홍길동')), JSON.stringify(['홍길동']));
  const both = JSON.parse(JSON.stringify(c.erpPayerKeys('최지영(나비리아)')));
  assert.ok(both.indexOf('최지영') >= 0 && both.length === 2, '이름과 상호를 둘 다');
  assert.equal(c.erpPayerKeys('김').length, 0, '성 하나로는 아무와 맞는다');
  assert.equal(c.erpPayerKeys('').length, 0);
});

/* ───────── ② 관계 입금자 찾기 ───────── */
test('② 등록된 이름과 «꼭 같을 때만» 맞는다(닮음으로 보지 않는다)', () => {
  const c = makeCtx();
  const co = CO({ payerRelations: [R('김대표개인', 'ceo')] });
  assert.ok(c.erpPayerRelationHit(co, '김대표개인'));
  assert.equal(c.erpPayerRelationHit(co, '김대표'), null, '부분 일치는 안 된다');
  assert.equal(c.erpPayerRelationHit(co, '김대표개인2'), null);
  assert.equal(c.erpPayerRelationHit(CO(), '김대표개인'), null, '등록이 없으면 없다');
  assert.equal(c.erpPayerRelationHit(null, '김대표개인'), null);
});

test('② 지운(_deleted) 등록은 맞지 않고, keys 가 없는 옛 줄(key 만)도 읽는다', () => {
  const c = makeCtx();
  assert.equal(c.erpPayerRelationHit(CO({ payerRelations: [R('김대표개인', 'ceo', { _deleted: true })] }), '김대표개인'), null);
  assert.ok(c.erpPayerRelationHit(CO({ payerRelations: [{ key: '박직원', name: '박직원', relation: 'staff' }] }), '박직원'));
});

/* ───────── ③ 등록 — 순수 함수, 거절 규칙 ───────── */
test('③ 등록하면 «새 목록»을 돌려주고 원래 사업장 기록은 건드리지 않는다', () => {
  const c = makeCtx();
  const co = CO({ payerRelations: [R('박직원', 'staff')] });
  const r = c.erpPayerRelationAdd(co, { name: '김대표개인', relation: 'ceo', reason: '', by: 'P-1', byName: '검사' });
  assert.equal(r.ok, true);
  assert.equal(r.list.length, 2);
  assert.equal(co.payerRelations.length, 1, '원본은 그대로');
  assert.ok(r.list.some((x) => x.name === '김대표개인' && x.relation === 'ceo' && x.by === 'P-1'));
});

test('③ 같은 이름을 다시 등록하면 하나로 갈아 끼운다(중복이 쌓이지 않는다)', () => {
  const c = makeCtx();
  const co = CO({ payerRelations: [R('김대표개인', 'staff')] });
  const r = c.erpPayerRelationAdd(co, { name: '김대표개인', relation: 'ceo' });
  assert.equal(r.list.length, 1);
  assert.equal(r.list[0].relation, 'ceo');
});

test('④ CMS 통로·합계 후보 적요·사업장 이름 자신·두 글자 미만·관계 안 고름·사유 없는 «기타»는 등록 못 한다', () => {
  const c = makeCtx();
  const co = CO();
  const no = (e) => { const r = c.erpPayerRelationAdd(co, e); assert.equal(r.ok, false, JSON.stringify(e)); assert.ok(r.why); };
  no({ name: '더빌이체3572', relation: 'agent' });                 // CMS 통로 — 달마다 주인이 바뀐다
  no({ name: '비즈사업비', relation: 'agent' });                    // 합계 후보 적요
  no({ name: '가상산업', relation: 'affiliate' });                  // 사업장 이름 자신
  no({ name: '김', relation: 'staff' });                            // 두 글자 미만
  no({ name: '김대표개인', relation: '' });                         // 관계 안 고름
  no({ name: '김대표개인', relation: 'nonsense' });                 // 없는 관계
  no({ name: '김대표개인', relation: 'other', reason: '   ' });     // 사유 없는 기타
  assert.equal(c.erpPayerRelationAdd(co, { name: '김대표개인', relation: 'other', reason: '대표 지인이 대신 보냄' }).ok, true);
});

/* ───────── ⑦ 지우기 ───────── */
test('⑦ 관계 입금자는 지울 수 있다 — 지우면 더 이상 맞지 않는다', () => {
  const c = makeCtx();
  const co = CO({ payerRelations: [R('김대표개인', 'ceo'), R('박직원', 'staff')] });
  const left = c.erpPayerRelationDel(co, '김대표개인');
  assert.equal(left.length, 1);
  assert.equal(c.erpPayerRelationHit(Object.assign({}, co, { payerRelations: left }), '김대표개인'), null);
  assert.equal(co.payerRelations.length, 2, '원본은 그대로');
});

/* ───────── ① 입금자 종류 판정 ───────── */
const PIT = (name, item) => ({ companyName: name, item: item || {}, kind: 'advisory' });
test('① 종류 — 통로(CMS·합계 후보 적요)는 입금자로 묻지 않는다', () => {
  const c = makeCtx();
  const co = CO();
  assert.equal(c.erpPayerAssess('더빌이체3572', PIT('가상산업', co), { co }).kind, 'channel');
  assert.equal(c.erpPayerAssess('비즈사업비', PIT('가상산업', co), { co }).kind, 'channel');
  assert.equal(c.erpPayerNeedsReason(c.erpPayerAssess('비즈사업비', PIT('가상산업', co), { co })), false);
});

test('① 종류 — 적요가 비면 알 수 없음(묻지 않는다)', () => {
  const c = makeCtx();
  const a = c.erpPayerAssess('', PIT('가상산업'), {});
  assert.equal(a.kind, 'unknown');
  assert.equal(c.erpPayerNeedsReason(a), false);
});

test('① 종류 — 관계 입금자가 본인보다 먼저(딱지를 남기려고), 이름 근거가 있으면 본인', () => {
  const c = makeCtx();
  const co = CO({ payerRelations: [R('김대표개인', 'ceo')] });
  const rel = c.erpPayerAssess('김대표개인', PIT('가상산업', co), { co, nameOk: true });
  assert.equal(rel.kind, 'related');
  assert.equal(rel.relation, 'ceo');
  assert.equal(c.erpPayerAssess('가상산업', PIT('가상산업', co), { co: CO(), nameOk: true }).kind, 'self');
});

test('① 종류 — 다른 사업장 이름이면 other_company, 아무 근거 없으면 third. 둘 다 사유를 묻는다', () => {
  const c = makeCtx();
  const mine = CO();
  const other = CO({ id: 'co-2', name: '다른산업' });
  const coIdx = c.erpCoIndexByName([mine, other]);
  const oc = c.erpPayerAssess('다른산업', PIT('가상산업', mine), { co: mine, coIdx, nameOk: false });
  assert.equal(oc.kind, 'other_company');
  assert.equal(oc.owner, '다른산업');
  assert.equal(c.erpPayerNeedsReason(oc), true);
  const th = c.erpPayerAssess('아무개', PIT('가상산업', mine), { co: mine, coIdx, nameOk: false });
  assert.equal(th.kind, 'third');
  assert.equal(c.erpPayerNeedsReason(th), true);
  // 이름이 «이 사업장 자신»인데 이름 근거 표시가 없으면(드문 어긋남) 다른 사업장이 아니다
  assert.equal(c.erpPayerAssess('가상산업', PIT('가상산업', mine), { co: mine, coIdx, nameOk: false }).kind, 'third');
});

test('① 종류 — 사업장 기록은 후보가 사업장 자신이면 그것, 아니면 번호·이름으로 찾는다', () => {
  const c = makeCtx();
  const co = CO(), c2 = CO({ id: 'co-2', name: '둘째산업' });
  c._companies = [co, c2];
  const idx = c.erpCoIndexByName(c._companies);
  assert.equal(c.erpPayerCoOf({ kind: 'advisory', companyName: '가상산업', item: co }, idx), co);
  assert.equal(c.erpPayerCoOf({ kind: 'retainer', companyName: '이름만', item: { companyId: 'co-2' } }, idx), c2, '번호로');
  assert.equal(c.erpPayerCoOf({ kind: 'retainer', companyName: '둘째산업', item: {} }, idx), c2, '이름으로');
  assert.equal(c.erpPayerCoOf({ kind: 'retainer', companyName: '없는곳', item: {} }, idx), null);
});

/* ───────── ⑤ 이름 근거 — 실제 점수 함수 ───────── */
const CAND = (co) => ({ companyName: co.name, amount: 220000, expect: 220000, kind: 'advisory', item: co });
const TXN = (memo) => ({ date: '2026-11-16', amount: 220000, memo });
test('⑤ 등록한 관계 입금자는 이름 근거(100)가 되고, 이유가 보인다', () => {
  const c = makeCtx();
  const co = CO({ payerRelations: [R('아무개', 'agent')] });
  const s = c.erpMatchScore(TXN('아무개'), CAND(co));
  assert.equal(s.nameScore, 100);
  assert.ok(s.reasons.some((r) => /관계 입금자/.test(r) && /대행/.test(r)));
});

test('⑤ 등록 안 한 이름·지운 이름·다른 사업장에 등록한 이름은 이름 근거가 아니다', () => {
  const c = makeCtx();
  assert.ok(c.erpMatchScore(TXN('아무개'), CAND(CO())).nameScore < 60, '등록이 없다');
  const del = CO({ payerRelations: [R('아무개', 'agent', { _deleted: true })] });
  assert.ok(c.erpMatchScore(TXN('아무개'), CAND(del)).nameScore < 60, '지운 등록');
  const other = CO({ id: 'co-2', name: '다른산업', payerRelations: [R('아무개', 'agent')] });
  assert.ok(c.erpMatchScore(TXN('아무개'), CAND(CO())).nameScore < 60, '다른 사업장에 등록한 이름은 이 사업장 근거가 아니다');
  assert.equal(c.erpMatchScore(TXN('아무개'), CAND(other)).nameScore, 100, '그 사업장에는 근거다');
});

/* ───────── ②③ 확정 길 — 사유를 묻고, 배우지 않고, 등록은 사람이 켰을 때만 ───────── */
function flowCtx(opts) {
  opts = opts || {};
  const c = makeCtx();
  const co = CO();
  const other = CO({ id: 'co-2', name: '다른산업' });
  c._companies = [co, other];
  const asked = [], learned = [], patched = [], confirmed = [], toasts = [];
  c.setPayerAsk = (s) => { asked.push(s); };
  c.showToast = (m) => toasts.push(m);
  c.dbPatch = (store, id, p) => { patched.push({ store, id, p }); return true; };
  c.erpLearnPayerAlias = (m, p) => { learned.push(m); return true; };
  c.CURRENT_USER = { sid: 'P-9', name: '검사' };
  c.confirmRow = (row, pItem, o) => { confirmed.push({ row, pItem, o }); return true; };
  c.erpMatchScore = () => ({ nameScore: opts.nameScore === undefined ? 0 : opts.nameScore, aliasWeak: !!opts.aliasWeak });
  const src = cut('  function _payerAssess(row, pItem){', '  /* ── 확정 한 번 = 연쇄 처리 ──');
  vm.runInContext(src, c);
  return { c, co, other, asked, learned, patched, confirmed, toasts };
}
const ROW = (memo) => ({ _k: 'r1', date: '2026-11-16', amount: 220000, memo });
const answer = (f, v) => { const st = f.asked[f.asked.length - 1]; st.res(v); };

test('② 이름이 다른 돈은 사유를 묻고, 취소하면 확정하지 않는다', { timeout: 5000 }, async () => {
  const f = flowCtx();
  const p = f.c.confirmRowAsk(ROW('아무개'), PIT('가상산업', f.co), { feeAmount: 0 });
  await new Promise((r) => setImmediate(r));
  assert.equal(f.asked.length, 1, '사유를 묻는 창이 떴다');
  assert.equal(f.confirmed.length, 0, '답하기 전에는 확정하지 않는다');
  answer(f, null);
  assert.equal(await p, false);
  assert.equal(f.confirmed.length, 0, '취소하면 확정하지 않는다');
});

test('② 사유를 고르면 그 사유를 들고 확정 길로 간다(입금 줄에 적힌다)', { timeout: 5000 }, async () => {
  const f = flowCtx();
  const p = f.c.confirmRowAsk(ROW('아무개'), PIT('가상산업', f.co), {});
  await new Promise((r) => setImmediate(r));
  answer(f, { relation: 'ceo', reason: '대표님 개인 이체', register: false });
  await p;
  assert.equal(f.confirmed.length, 1);
  const pay = f.confirmed[0].o.payer;
  assert.equal(pay.kind, 'third');
  assert.equal(pay.name, '아무개');
  assert.equal(pay.relation, 'ceo');
  assert.equal(pay.reason, '대표님 개인 이체');
});

test('② 다른 사업장 이름이면 그 사업장이 누구인지까지 창에 실어 보낸다', { timeout: 5000 }, async () => {
  const f = flowCtx();
  f.c.confirmRowAsk(ROW('다른산업'), PIT('가상산업', f.co), {});
  await new Promise((r) => setImmediate(r));
  const st = f.asked[0];
  assert.equal(st.a.kind, 'other_company');
  assert.equal(st.a.owner, '다른산업');
});

test('② 본인·관계 입금자·통로는 묻지 않고 바로 확정한다(종류만 적는다)', { timeout: 5000 }, async () => {
  const self = flowCtx({ nameScore: 100 });
  await self.c.confirmRowAsk(ROW('가상산업'), PIT('가상산업', self.co), {});
  assert.equal(self.asked.length, 0);
  assert.equal(self.confirmed[0].o.payer.kind, 'self');
  const rel = flowCtx();
  rel.co.payerRelations = [R('아무개', 'ceo')];
  await rel.c.confirmRowAsk(ROW('아무개'), PIT('가상산업', rel.co), {});
  assert.equal(rel.asked.length, 0);
  assert.equal(rel.confirmed[0].o.payer.kind, 'related');
  const ch = flowCtx();
  await ch.c.confirmRowAsk(ROW('더빌이체3572'), PIT('가상산업', ch.co), {});
  assert.equal(ch.asked.length, 0);
  assert.equal(ch.confirmed[0].o.payer.kind, 'channel');
});

test('② 이미 사유를 들고 오면 다시 묻지 않는다', { timeout: 5000 }, async () => {
  const f = flowCtx();
  await f.c.confirmRowAsk(ROW('아무개'), PIT('가상산업', f.co), { payer: { kind: 'third', name: '아무개', relation: 'staff', reason: 'x' } });
  assert.equal(f.asked.length, 0);
  assert.equal(f.confirmed.length, 1);
});

test('③ 이름이 다른 돈은 별칭으로 «배우지 않고», 등록을 안 켰으면 등록하지도 않는다', () => {
  const f = flowCtx();
  const pay = { kind: 'third', name: '아무개', relation: 'ceo', reason: 'x', register: false };
  assert.equal(f.c.payerLearns(pay), false, '이름이 다른 돈은 학습 대상이 아니다');
  assert.equal(f.c.payerLearns({ kind: 'other_company', name: '다른산업' }), false);
  const r = f.c._payerAfter(ROW('아무개'), PIT('가상산업', f.co), pay);
  assert.equal(r.registered, false);
  assert.equal(f.patched.length, 0, '등록하지 않았다');
});

test('③ 이름이 같은 돈(본인·관계·통로·적요 없음)과 사유 없는 옛 길은 지금처럼 별칭을 배운다(회귀 방지)', () => {
  const f = flowCtx();
  ['self', 'related', 'channel', 'unknown'].forEach((k) => assert.equal(f.c.payerLearns({ kind: k, name: 'x' }), true, k));
  assert.equal(f.c.payerLearns(undefined), true, '판정을 못 한 길은 예전 그대로');
  assert.equal(f.c.payerLearns(null), true);
});

test('③ 사람이 등록을 켜면 사업장 기록에 관계 입금자가 적힌다(누가·언제·사유)', () => {
  const f = flowCtx();
  const r = f.c._payerAfter(ROW('아무개'), PIT('가상산업', f.co), { kind: 'third', name: '아무개', relation: 'agent', reason: '세무사무소', register: true });
  assert.equal(r.registered, true);
  assert.equal(f.patched.length, 1);
  assert.equal(f.patched[0].store, 'companies');
  assert.equal(f.patched[0].id, 'co-1');
  const saved = f.patched[0].p.payerRelations;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, '아무개');
  assert.equal(saved[0].relation, 'agent');
  assert.equal(saved[0].reason, '세무사무소');
  assert.equal(saved[0].by, 'P-9');
  assert.equal(f.c.payerLearns({ kind: 'third', register: true }), false, '등록해도 별칭으로는 배우지 않는다');
});

test('④ 등록이 거절되는 이름이면 사업장 기록을 바꾸지 않고 이유를 알린다', () => {
  const f = flowCtx();
  const r = f.c._payerAfter(ROW('김'), PIT('가상산업', f.co), { kind: 'third', name: '김', relation: 'ceo', reason: '', register: true });
  assert.equal(r.registered, false);
  assert.equal(f.patched.length, 0);
  assert.ok(f.toasts.some((t) => /등록 안 됨/.test(t)));
});

test('③ 사업장을 못 찾으면 등록하지 않고 알린다', () => {
  const f = flowCtx();
  const r = f.c._payerAfter(ROW('아무개'), { companyName: '없는곳', item: {}, kind: 'retainer' }, { kind: 'third', name: '아무개', relation: 'ceo', register: true });
  assert.equal(r.registered, false);
  assert.equal(f.patched.length, 0);
  assert.ok(f.toasts.some((t) => /찾지 못/.test(t)));
});

/* ───────── ⑥ 저장 길 · 화면 연결 (짝 확인) ───────── */
const SAVE = cut('  function saveIncome(row, pItem, opts){', '  /* ── 👤 입금자 명의 — 판정');
const UPSERT = SAVE.slice(SAVE.indexOf('erpUpsertIncome({id:_fiId,'), SAVE.indexOf('if(_saved === false)'));
test('⑥ saveIncome 이 입금자·종류·관계·사유를 줄에 적고, 창을 못 거친 길은 «확인 필요»를 단다', () => {
  ['payerName', 'payerKind', 'payerRelation', 'payerReason', 'payerReview'].forEach((k) => assert.ok(UPSERT.indexOf(k + ':') >= 0, k + ' 를 적지 않는다'));
  assert.match(SAVE, /if\(!_pay\) _pay = _payerAssessSafe\(row, pItem\);/, '사유를 들고 오지 않은 길도 판정은 한다');
  assert.match(SAVE, /_payReview = \(!opts\.payer && erpPayerNeedsReason\(_pay\)\) \? true : undefined;/, '사유를 물은 길에는 «확인 필요»가 없다');
  assert.match(UPSERT, /payerReview:_payReview/);
  assert.match(SAVE, /catch\(_pe\)\{ _pay = opts\.payer \|\| null; _payReview = undefined; \}/, '판정이 안 돼도 확정은 막지 않는다');
});

const FL = cut('function FinanceLedger(', 'function FinanceIncome');
test('⑥ 확정 단추들이 모두 사유 묻기를 거친다 — confirmRow 를 곧장 부르는 화면 길이 없다', () => {
  /* 정의(function confirmRow()와 confirmRowAsk 가 «사유를 거친 뒤» 넘기는 한 곳(return confirmRow()만 허락한다 */
  const direct = (FL.match(/[^a-zA-Z_]confirmRow\(/g) || []).length;
  const allowed = (FL.match(/function confirmRow\(/g) || []).length + (FL.match(/return confirmRow\(row, pItem, opts\);/g) || []).length;
  assert.equal(allowed, 2, '정의 하나 + confirmRowAsk 안의 한 곳');
  assert.equal(direct - allowed, 0, 'confirmRow 를 곧장 부르는 화면 길이 있다(' + (direct - allowed) + '곳)');
  assert.ok((FL.match(/confirmRowAsk\(/g) || []).length >= 6, '여섯 길(Enter·확정 단추·펼침 창 넷)이 confirmRowAsk 를 부른다');
  assert.ok(FL.indexOf('payerOptsFor(_row,_pi)') >= 0, '상세 창의 확정도 사유를 묻는다');
  assert.ok(FL.indexOf('payerOptsFor(row, pItem);        // 입금자 이름이 다르면 사유부터') >= 0 || FL.indexOf('var _po = await payerOptsFor(row, pItem);') >= 0, '과입금 확정도');
});

test('⑥ confirmRow 는 사유를 saveIncome 에 넘기고, 학습·등록은 «저장 뒤» _payerAfter 가 한다', () => {
  const CR = cut('  function confirmRow(row, pItem, opts){', '  /* 과입금 — 넘친 돈을');
  assert.match(CR, /vatIncluded:opts\.vatIncluded, payer:opts\.payer \}\);/);
  assert.match(CR, /var _after = _payerAfter\(row, pItem, opts\.payer\);/);
  assert.ok(CR.indexOf('_payerAfter(') > CR.indexOf('saveIncome('), '저장이 막히면 등록도 남지 않는다');
  assert.match(CR, /payerLearns\(opts\.payer\) \? erpLearnPayerAlias\(/, '별칭 학습은 «이름이 같은 돈»일 때만(payerLearns)');
});

test('⑥ 사유 창 — 취소·바깥 누르기는 확정하지 않고, 관계를 안 고르면(기타는 사유까지) 확정 단추가 막힌다', () => {
  const M = cut('    payerAsk && (function(){', '    /* ── 후보 크게 보기 팝업 ──');
  assert.match(M, /if\(e\.target===e\.currentTarget\) done\(null\);/, '바깥을 누르면 취소');
  assert.match(M, /var ok = !!pa\.relation && \(!needReason \|\| !!String\(pa\.reason \|\| ''\)\.trim\(\)\);/);
  assert.match(M, /disabled:!ok/);
  assert.match(M, /register:!!pa\.register/, '등록은 사람이 켠 것만');
  assert.ok(M.indexOf('checked:!!pa.register') >= 0 && M.indexOf('register:false') < 0, '창은 기본이 «등록 안 함» (기본값은 askPayer 에서)');
  assert.ok(FL.indexOf('relation:\'\', reason:\'\', register:false') >= 0, '기본 — 관계 안 고름·등록 안 함');
  assert.ok(FL.indexOf('|| chkAnchor || payerAsk);') >= 0, '창이 떠 있는 동안 표의 자판(Enter 확정)이 새어 들어가지 않는다');
});

test('⑦ 환경설정에서 관계 입금자를 보고 지울 수 있다 · 확정 이력에서 입금자 다른 건을 모아 본다', () => {
  const PA = cut('function PayerAliasModal(props){', 'function ', 1) ;
  assert.ok(SRC.indexOf('erpPayerRelationDel(x.co, x.r.key)') >= 0, '지우는 길이 있다');
  assert.ok(SRC.indexOf("'👤 관계 입금자 · 대납 ('") >= 0);
  assert.ok(FL.indexOf('setPayerOnly(!payerOnly)') >= 0, '입금자 다른 건만 보기');
  assert.ok(FL.indexOf("fi.payerKind === 'other_company'") >= 0 && FL.indexOf('fi.payerReview') >= 0, '딱지·확인 필요 표시');
  assert.ok(PA.length > 0);
});
