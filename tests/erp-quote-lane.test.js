'use strict';
/* 견적 길 요청(kind:'quote'·'advance') — 이알피 쪽 (견적·계약 자동화 계획 3 · 작업 2, 검토 2026-11-09 반영)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 회사·사람은 전부 지어낸 것이다.
 *
 * ■ 못 박는 것 (Review Focus)
 *   ① 같은 메일을 두 번 반영하지 않는다(카드의 srcMails → noop).
 *   ② ★ 사업장은 요청이 «가리키는» companyId 로만 잇는다 — 카드도 «카드의 companyId 가 같은 것»만 후보다.
 *      이름·주소가 같거나 비슷한 다른 업체의 카드에 덧붙이거나 옮기지 않는다(온톨로지). 요청에 미리 적힌 이름은 카드를 고르는 데 안 쓴다.
 *      사람이 «연결 보류»를 켠 요청만 이름 그대로 연결 보류 카드로 만들고, 이름이 같은 진행 중 카드가 있으면 자동으로 붙이지 않는다.
 *   ③ 같은 사업장(같은 companyId)에 진행 중(상담접수·계약협의) 카드가 있으면 새로 안 만들고 덧붙인다 · 둘 이상이면 사람이 고른다 ·
 *      이미 계약확정된 사업장은 «재계약일 수 있음»을 적은 새 카드.
 *   ④ 금액은 요청에도 카드에도 없다 — 요청에 amount 가 섞여 와도, 제목·첨부 이름에 「400만원」이 있어도 카드·메모로 새지 않는다.
 *   ⑤ 주담당은 «새 카드를 만들 때만» 필요하다(덧붙이기·이동에는 안 쓴다) — 직원 명부의 사번일 때만, 이름으로 사번을 채우지 않는다.
 *   ⑥ 저장은 «기존 문»(persistOne·patchOne·월 잠금)이 한다 — 막히면 요청을 지우지 않고 blocked + 까닭을 남긴다.
 *   ⑦ 계약 진행 신호(advance)는 «상담접수 카드가 하나일 때만» 계약협의로 — 비교견적 표시가 달린 카드는 자동으로 안 옮긴다(사람이 «선정»).
 *   ⑧ 두 화면이 동시에 처리해도 한 화면만 한다 — «맡았다» 표시(트랜잭션) · 멈춘 흔적(5분)은 다시 맡는다.
 * 소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const DETECT = require('../js/pu-quote-detect.js');

const PURE = ['function erpQuoteLaneReq(', 'function erpQuoteDay(', 'function erpQuoteScrub(', 'function erpQuoteNote(', 'function erpCardCoId(',
  'function erpQuoteLanePlan(', 'function erpBlankContractForm(', 'function erpSameCompany(', 'function erpCoAddrKey('].map((d) => cutFn(SRC, d)).join('\n');

function pure(withDetect) {
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, todayYMD: () => '2026-11-08', window: withDetect === false ? {} : { PuQuoteDetect: DETECT } };
  vm.createContext(ctx);
  vm.runInContext(PURE + '\nthis.api={erpQuoteLaneReq,erpQuoteDay,erpQuoteNote,erpQuoteScrub,erpQuoteLanePlan};', ctx);
  return ctx.api;
}
const P = pure();
const out = (v) => JSON.parse(JSON.stringify(v));

const USERS = [{ sid: 'P-005', name: '담당가' }, { sid: 'A-001', name: '담당나' }];
const CO = { id: 'co1', name: '가나기관', bizNo: '1234567890', ceo: '홍길동', address: '충남 가나시 다라로 1', phone: '041-000-0000' };
const AT = Date.parse('2026-10-26T18:23:00+09:00');
const req = (o) => Object.assign({ kind: 'quote', state: 'pending', srcKey: 'Sent|1001', subject: '[푸른노무법인] 가나기관 컨설팅 견적서 송부의 건',
  docKind: 'quote', atts: ['견적서_가나기관.pdf'], to: ['kim@gana.example'], at: AT, companyId: 'co1', managerMain: 'P-005', by: 'server' }, o || {});
/* 카드 — 업체를 «이은» 카드가 기본(companyId co1). 이름만 같은 다른 업체 카드는 companyId 를 바꿔 만든다 */
const card = (o) => Object.assign({ id: 'ct-1', contractNo: '계약-2026-001', companyName: '가나기관', status: 'consult', kinds: ['consult'],
  companyId: 'co1', company: { name: '가나기관', bizNo: '1234567890', companyId: 'co1' }, note: '' }, o || {});

test('① 요청 종류·메일 날짜(한국 날짜)', () => {
  assert.equal(P.erpQuoteLaneReq({ kind: 'quote' }), true);
  assert.equal(P.erpQuoteLaneReq({ kind: 'advance' }), true);
  assert.equal(P.erpQuoteLaneReq({}), false, '사진첩·중진공 요청(kind 없음)은 이 길이 아니다');
  assert.equal(P.erpQuoteLaneReq(null), false);
  assert.equal(P.erpQuoteDay(AT), '2026-10-26');
  assert.equal(P.erpQuoteDay(Date.parse('2026-10-26T23:30:00+09:00')), '2026-10-26', '밤 11시 30분(한국)도 같은 날');
  assert.equal(P.erpQuoteDay(0), '');
});

test('② ★ 사업장은 요청이 가리키는 companyId 로만 잇는다 — 이름이 같아도 이름으로 잇지 않는다', () => {
  const p = P.erpQuoteLanePlan(req({ companyId: '', companyName: '가나기관' }), [CO], [], USERS);
  assert.equal(p.action, 'blocked'); assert.match(p.why, /사업장을 못 찾았습니다/);
  const none = P.erpQuoteLanePlan(req({ companyId: '', companyName: '' }), [CO], [], USERS);
  assert.equal(none.action, 'blocked'); assert.match(none.why, /사업장을 정해 주세요/);
  const gone = P.erpQuoteLanePlan(req({ companyId: 'zzz' }), [CO], [], USERS);
  assert.equal(gone.action, 'blocked'); assert.match(gone.why, /가리키는 업체가 업체관리에 없습니다/);
  assert.equal(P.erpQuoteLanePlan(req(), [Object.assign({}, CO, { _deleted: true })], [], USERS).action, 'blocked', '지운 업체로는 잇지 않는다');
});

test('② ★★ 이름·주소·대표자가 같은 «다른 업체»의 카드에는 덧붙이지도 옮기지도 않는다(A 사 메일이 B 사 카드로 가지 않는다)', () => {
  /* B 사 — 같은 이름·같은 사업자번호 모양·같은 주소와 대표자인 다른 업체(companyId 가 다르다) */
  const bCard = card({ id: 'ct-B', companyId: 'co2', company: { name: '가나기관', bizNo: '1234567890', address: CO.address, ceo: CO.ceo, companyId: 'co2' } });
  const q = P.erpQuoteLanePlan(req(), [CO], [bCard], USERS);
  assert.equal(q.action, 'create', '남의 카드에 덧붙었다');
  const adv = P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract' }), [CO], [bCard], USERS);
  assert.equal(adv.action, 'blocked', '남의 카드를 계약협의로 옮겼다');
  assert.match(adv.why, /옮길 상담접수 카드가 없습니다/);
  /* 업체를 못 이은(companyId 없는) 카드는 «이름이 같아도» 후보가 아니다 — 자동으로 붙이지도 옮기지도 않는다.
     (같은 사업장일 수 있으니 «만들지도 않고» 사람이 정하게 막는 것은 아래 «업체 미연결 카드» 시험) */
  const noId = card({ id: 'ct-N', companyId: '', company: { name: '가나기관', bizNo: '1234567890' } });
  assert.notEqual(P.erpQuoteLanePlan(req(), [CO], [noId], USERS).action, 'attach', '업체 미연결 카드에 이름으로 덧붙였다');
  assert.notEqual(P.erpQuoteLanePlan(req({ kind: 'advance' }), [CO], [noId], USERS).action, 'advance', '업체 미연결 카드를 이름으로 옮겼다');
});

test('③ 사람이 «연결 보류»를 켠 요청만 이름 그대로 연결 보류 카드로 만든다 — 이름이 같은 진행 중 카드가 있으면 붙이지 않고 사람이 정한다', () => {
  const p = P.erpQuoteLanePlan(req({ companyId: '', companyName: '다라상사', deferLink: true }), [CO], [], USERS);
  assert.equal(p.action, 'create'); assert.equal(p.form.company.name, '다라상사'); assert.ok(!p.form.companyId, '업체 ID 를 채우지 않는다');
  assert.equal(p.form.status, 'consult');
  const dup = P.erpQuoteLanePlan(req({ companyId: '', companyName: '다라상사', deferLink: true }), [CO],
    [card({ companyId: '', companyName: '다라상사', company: { name: '다라상사' } })], USERS);
  assert.equal(dup.action, 'blocked', '이름만 같은 카드에 자동으로 붙였다'); assert.match(dup.why, /이름이 같은 진행 중 카드/);
});

test('④ 업체를 이은 요청 → 상담접수 카드(kinds consult) — 업체 정보는 업체관리에서, 금액은 0', () => {
  const p = P.erpQuoteLanePlan(req(), [CO], [], USERS);
  assert.equal(p.action, 'create');
  const f = out(p.form);
  assert.deepEqual(f.kinds, ['consult']); assert.equal(f.status, 'consult');
  assert.equal(f.companyId, 'co1'); assert.equal(f.company.companyId, 'co1'); assert.equal(f.company.name, '가나기관'); assert.equal(f.company.bizNo, '1234567890');
  assert.equal(f.managerMain, 'P-005'); assert.deepEqual(f.srcMails, ['Sent|1001']);
  assert.ok(Object.keys(f.amounts).every((k) => f.amounts[k] === 0), '금액 칸은 모두 0'); assert.equal(f.successFee, 0);
  assert.match(f.note, /견적서 송부 2026-10-26/); assert.match(f.note, /첨부: 견적서_가나기관\.pdf/);
  assert.ok(!('compare' in f), '비교견적 표시는 없다');
});

test('⑤ ★ 금액은 요청에 섞여 와도·제목과 첨부 이름에 있어도 카드·메모로 새지 않는다', () => {
  const p = P.erpQuoteLanePlan(Object.assign(req({ subject: '[푸른노무법인] 컨설팅 견적서 400만원 송부', atts: ['견적서_400만원.pdf', '견적서 4,000,000원.hwp'] }),
    { amount: 5000000, 금액: '4,000,000원', amounts: { consulting: 5000000 }, successFee: 777 }), [CO], [], USERS);
  const j = JSON.stringify(out(p.form));
  assert.ok(!/5000000|4,000,000|400만|777/.test(j), '금액이 카드에 들어갔다: ' + j.slice(0, 260));
  assert.match(p.form.note, /○○/, '가린 자리가 보인다');
  /* 덧붙이는 메모도 같다 */
  const a = P.erpQuoteLanePlan(req({ subject: '견적서 월 50만원', atts: ['견적서_3,500,000원.pdf'] }), [CO], [card()], USERS);
  assert.equal(a.action, 'attach'); assert.ok(!/50만|3,500,000/.test(a.note));
});

test('⑤ 금액을 가리는 한 벌(PuQuoteDetect)이 안 실려 있으면 제목·첨부 이름을 아예 안 옮긴다(안전한 쪽)', () => {
  const N = pure(false).erpQuoteNote(req({ subject: '견적서 400만원', atts: ['견적서_400만원.pdf'] }));
  assert.ok(!/400|견적서_|제목:|첨부:/.test(N.replace('📧 푸른메일 보낸메일함에서 올림 — 견적서 송부 2026-10-26', '')), '글자가 옮겨졌다: ' + N);
  assert.match(N, /금액은 이 칸에 적지 않았음/);
});

test('⑥ ★ 주담당은 «새 카드를 만들 때만» 필요하다 — 덧붙이기는 담당자 없이도 통과한다', () => {
  const noMgr = req({ managerMain: '' });
  assert.equal(P.erpQuoteLanePlan(noMgr, [CO], [card()], USERS).action, 'attach', '담당자를 안 쓰는 덧붙이기가 담당자 때문에 걸렸다');
  assert.equal(P.erpQuoteLanePlan(noMgr, [CO], [card({ status: 'review' })], USERS).action, 'attach');
  const a = P.erpQuoteLanePlan(noMgr, [CO], [], USERS);
  assert.equal(a.action, 'blocked'); assert.match(a.why, /담당자를 정해 주세요/);
  const b = P.erpQuoteLanePlan(req({ managerMain: '홍길동' }), [CO], [], USERS);
  assert.equal(b.action, 'blocked', '이름으로 사번을 채우지 않는다'); assert.match(b.why, /직원 명부에 없습니다/);
});

test('⑦ 같은 메일은 두 번 반영하지 않는다 — 카드의 srcMails 에 있으면 noop', () => {
  assert.equal(P.erpQuoteLanePlan(req(), [CO], [card({ srcMails: ['Sent|1001'] })], USERS).action, 'noop');
  assert.equal(P.erpQuoteLanePlan(req(), [CO], [card({ srcMails: ['Sent|1001'], _deleted: true })], USERS).action, 'create', '지운 카드의 기록은 세지 않는다');
});

test('⑧ 같은 사업장에 진행 중 카드가 하나면 덧붙이고, 둘 이상이면 사람이 고르고, 확정만 있으면 재계약 카드', () => {
  const one = P.erpQuoteLanePlan(req(), [CO], [card()], USERS);
  assert.equal(one.action, 'attach'); assert.equal(one.target.id, 'ct-1'); assert.match(one.note, /견적서 송부/);
  assert.equal(P.erpQuoteLanePlan(req(), [CO], [card({ status: 'review' })], USERS).action, 'attach', '계약협의 카드에도 덧붙인다');
  const two = P.erpQuoteLanePlan(req(), [CO], [card(), card({ id: 'ct-2', contractNo: '계약-2026-002' })], USERS);
  assert.equal(two.action, 'blocked'); assert.match(two.why, /2건/);
  const signed = P.erpQuoteLanePlan(req(), [CO], [card({ status: 'signed' })], USERS);
  assert.equal(signed.action, 'create'); assert.match(signed.form.note, /재계약일 수 있음/);
  const other = P.erpQuoteLanePlan(req(), [CO], [card({ companyId: 'co9', companyName: '마바상사', company: { name: '마바상사', companyId: 'co9' } })], USERS);
  assert.equal(other.action, 'create', '다른 사업장 카드는 건드리지 않는다');
});

test('⑨ 계약 진행 신호(advance) — 상담접수 카드가 «하나일 때만» 계약협의로 · 업체나 계약을 가리켜야 한다', () => {
  const adv = (o) => req(Object.assign({ kind: 'advance', docKind: 'contract', subject: '[푸른노무법인] 자문계약서 송부의 건', managerMain: '' }, o || {}));
  assert.equal(P.erpQuoteLanePlan(adv(), [CO], [card()], USERS).action, 'advance');
  const two = P.erpQuoteLanePlan(adv(), [CO], [card(), card({ id: 'ct-2' })], USERS);
  assert.equal(two.action, 'blocked'); assert.match(two.why, /2건/);
  assert.equal(P.erpQuoteLanePlan(adv(), [CO], [card({ status: 'review' })], USERS).action, 'noop', '이미 계약협의면 아무것도 안 한다');
  const onlySigned = P.erpQuoteLanePlan(adv(), [CO], [card({ status: 'signed' })], USERS);
  assert.equal(onlySigned.action, 'blocked', '계약확정 카드만 있는 사업장의 신호를 조용히 지우면 재계약을 놓친다(검토 2026-11-09)');
  assert.match(onlySigned.why, /계약확정 카드만 있습니다/);
  const none = P.erpQuoteLanePlan(adv(), [CO], [], USERS);
  assert.equal(none.action, 'blocked'); assert.match(none.why, /상담접수 카드가 없습니다/);
  assert.equal(P.erpQuoteLanePlan(adv({ contractId: 'ct-9' }), [CO], [card({ id: 'ct-9' }), card({ id: 'ct-8' })], USERS).target.id, 'ct-9');
  assert.equal(P.erpQuoteLanePlan(adv({ contractId: 'ct-9' }), [CO], [card({ id: 'ct-9', status: 'review' })], USERS).action, 'noop');
  assert.equal(P.erpQuoteLanePlan(adv({ contractId: 'nope' }), [CO], [card()], USERS).action, 'blocked');
});

test('⑨ ★ 업체를 못 이은 계약 진행 신호는 «이름»으로 카드를 찾지 않는다 — 미리 적힌 표시 이름이 있어도 blocked', () => {
  const p = P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract', companyId: '', companyName: '가나기관' }), [CO],
    [card({ companyId: '', company: { name: '가나기관', bizNo: '1234567890' } })], USERS);
  assert.equal(p.action, 'blocked'); assert.match(p.why, /업체를 골라야/);
});

test('⑦ ★ 비교견적 건은 «사람이 선정» — 표시(compare)가 달린 카드는 계약 진행 신호가 와도 자동으로 안 옮긴다', () => {
  const marked = card({ compare: { state: 'wait' } });
  const adv = P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract', managerMain: '' }), [CO], [marked], USERS);
  assert.equal(adv.action, 'blocked'); assert.match(adv.why, /비교견적 건입니다/); assert.match(adv.why, /선정/);
  const byId = P.erpQuoteLanePlan(req({ kind: 'advance', contractId: 'ct-1', companyId: '', managerMain: '' }), [CO], [marked], USERS);
  assert.equal(byId.action, 'blocked');
  /* 표시가 없으면 그대로 옮긴다 */
  assert.equal(P.erpQuoteLanePlan(req({ kind: 'advance', managerMain: '' }), [CO], [card()], USERS).action, 'advance');
  /* 비교견적서가 붙어 나간 견적 메일은 새 카드에도 덧붙이는 카드에도 표시를 단다 */
  const created = P.erpQuoteLanePlan(req({ compare: 'bundle' }), [CO], [], USERS);
  assert.deepEqual(out(created.form.compare), { state: 'wait' }); assert.match(created.form.note, /사람이 «선정»할 건/);
  const attached = P.erpQuoteLanePlan(req({ compare: 'bundle' }), [CO], [card()], USERS);
  assert.equal(attached.action, 'attach'); assert.equal(attached.mark, true);
});

test('알 수 없는 종류는 blocked — 던지지 않는다', () => {
  assert.equal(P.erpQuoteLanePlan({ kind: 'confirm' }, [CO], [], USERS).action, 'blocked');
  assert.equal(P.erpQuoteLanePlan(null, null, null, null).action, 'blocked');
});

/* ── 저장하는 쪽(processQuoteLaneRequest) — 기존 문(persistOne·patchOne)을 지난다 ── */
const WRAP = cutFn(SRC, 'async function processQuoteLaneRequest(');
function wrap(env) {
  const calls = { update: [], remove: 0, persist: [], patch: [] };
  const store = { cur: env.reqNode === undefined ? req() : env.reqNode };
  /* 실제 SDK 처럼 — 처음에는 null 로 부르고, undefined 로 답하면 «그만둔다», null 로 답했는데 서버에 값이 있으면 서버 값으로 다시 부른다 */
  const transaction = async (fn) => {
    if (env.txFail) throw new Error('거래 실패(가짜)');
    let r = fn(null);
    if (r === undefined) return { committed: false, snapshot: { val: () => store.cur } };
    if (store.cur != null) { r = fn(JSON.parse(JSON.stringify(store.cur))); if (r === undefined) return { committed: false, snapshot: { val: () => store.cur } }; }
    store.cur = r;
    return { committed: true, snapshot: { val: () => (store.cur == null ? null : JSON.parse(JSON.stringify(store.cur))) } };
  };
  const ctx = Object.assign({
    console, Date, Object, Array, String, Number, JSON, Math, Promise,
    CURRENT_USER: { sid: 'P001' },
    fbDb: { ref: () => ({
      update: (v) => { calls.update.push(v); Object.keys(v).forEach((k) => { if (v[k] === null) delete store.cur[k]; else store.cur[k] = v[k]; }); return Promise.resolve(); },
      remove: () => { calls.remove++; store.cur = null; return Promise.resolve(); },
      transaction,
    }) },
    dbGet: (k, d) => (env.data && env.data[k]) || d,
    getActiveUsers: () => USERS,
    erpQuoteLanePlan: (r, c, t, u) => P.erpQuoteLanePlan(r, c, t, u),
    erpDeferCoLinkIfNew: (f) => Object.assign({}, f, { companyLinkStatus: 'pending', companyId: '' }),
    isContractLocked: (ym) => ym === (env.lockedYm || ''),
    genContractNo: () => '계약-2026-196',
    persistOne: (o) => { calls.persist.push(o); return env.persistOk !== false; },
    patchOne: (id, f) => { calls.patch.push({ id, f }); return env.patchOk !== false; },
  }, env.extra || {});
  vm.createContext(ctx);
  vm.runInContext(WRAP + '\nthis.run=processQuoteLaneRequest;', ctx);
  return { run: ctx.run, calls, store };
}

test('⑩ 만든다 — persistOne 을 지나고, 요청은 지운다 · 계약번호는 기존 번호 길(genContractNo)', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [] } });
  const r = await w.run('k1', req());
  assert.ok(r.made); assert.equal(r.lane, 'quote');
  assert.equal(w.calls.persist.length, 1);
  assert.equal(w.calls.persist[0].contractNo, '계약-2026-196'); assert.equal(w.calls.persist[0].status, 'consult');
  assert.ok(w.calls.persist[0].id.startsWith('ct-'));
  assert.equal(w.calls.remove, 1, '반영한 요청은 지운다');
});

test('⑪ ★ 저장이 막히면 요청을 «지우지 않고» blocked + 까닭을 남기고, 맡았다 표시를 푼다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [] }, persistOk: false });
  const r = await w.run('k1', req());
  assert.ok(!r.made); assert.match(r.why, /저장을 막았습니다/);
  assert.equal(w.calls.remove, 0);
  const u = w.calls.update[w.calls.update.length - 1];
  assert.equal(u.state, 'blocked'); assert.match(u.why, /저장을 막았습니다/);
  assert.equal(u.claimedAt, null, '맡았다 표시를 푼다'); assert.equal(w.store.cur.state, 'blocked');
  assert.ok(!('claimedAt' in w.store.cur));
});

test('⑫ 계획이 blocked 면 저장하지 않고 요청에 까닭을 적는다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [] }, reqNode: req({ managerMain: '' }) });
  const r = await w.run('k1', req({ managerMain: '' }));
  assert.match(r.why, /담당자를 정해 주세요/);
  assert.equal(w.calls.persist.length, 0); assert.equal(w.calls.remove, 0);
  assert.equal(w.calls.update[w.calls.update.length - 1].state, 'blocked');
});

test('⑬ 월 잠금이 걸린 달에는 만들지 않는다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [] }, lockedYm: '2026-11' });
  const r = await w.run('k1', req());
  assert.match(r.why, /잠겨 있어/); assert.equal(w.calls.persist.length, 0);
});

test('⑭ 덧붙인다 — 담당자 없이도, 기존 카드에 메모와 srcMails 를 더해 persistOne 으로 저장한다(비교견적 표시도 단다)', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [card({ note: '먼저 적은 메모' })] }, reqNode: req({ managerMain: '', compare: 'bundle' }) });
  const r = await w.run('k1', req({ managerMain: '', compare: 'bundle' }));
  assert.ok(r.attached);
  const saved = w.calls.persist[0];
  assert.equal(saved.id, 'ct-1'); assert.match(saved.note, /^먼저 적은 메모\n\n📧/);
  assert.deepEqual(out(saved.srcMails), ['Sent|1001']); assert.deepEqual(out(saved.compare), { state: 'wait' });
  assert.equal(w.calls.remove, 1);
});

test('⑮ 계약협의로 옮긴다 — patchOne(status review) 한 번, 새 카드는 안 만든다 · 저장이 막히면 요청을 남긴다', async () => {
  const a = req({ kind: 'advance', docKind: 'contract', managerMain: '' });
  const w = wrap({ data: { companies: [CO], contracts: [card()] }, reqNode: a });
  const r = await w.run('k1', a);
  assert.ok(r.advanced);
  assert.equal(w.calls.patch.length, 1); assert.equal(w.calls.patch[0].f.status, 'review'); assert.equal(w.calls.persist.length, 0); assert.equal(w.calls.remove, 1);
  const w2 = wrap({ data: { companies: [CO], contracts: [card()] }, reqNode: a, patchOk: false });
  const r2 = await w2.run('k1', a);
  assert.match(r2.why, /저장을 막았습니다/); assert.equal(w2.calls.remove, 0);
});

test('⑯ 연결 보류 요청은 «같은 문»(erpDeferCoLinkIfNew)으로 연결 보류 카드를 만든다', async () => {
  const q = req({ companyId: '', companyName: '다라상사', deferLink: true });
  const w = wrap({ data: { companies: [CO], contracts: [] }, reqNode: q });
  const r = await w.run('k1', q);
  assert.ok(r.made);
  assert.equal(w.calls.persist[0].companyLinkStatus, 'pending'); assert.equal(w.calls.persist[0].company.name, '다라상사');
});

test('⑰ 이미 반영한 메일은 요청만 지우고 아무것도 저장하지 않는다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [card({ srcMails: ['Sent|1001'] })] } });
  const r = await w.run('k1', req());
  assert.ok(r.noop);
  assert.equal(w.calls.persist.length, 0); assert.equal(w.calls.patch.length, 0); assert.equal(w.calls.remove, 1);
});

test('⑧ ★ «맡았다» 표시 — 맡은 화면만 처리한다(pending → processing, 맡은 사번·시각을 적는다)', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [] } });
  let seen = null;
  const origPersist = w.calls.persist.push.bind(w.calls.persist);
  w.calls.persist.push = (o) => { seen = JSON.parse(JSON.stringify(w.store.cur)); return origPersist(o); };   /* 저장하는 순간의 요청 상태 */
  await w.run('k1', req());
  assert.equal(seen.state, 'processing'); assert.equal(seen.claimedBy, 'P001'); assert.ok(seen.claimedAt > 0);
});

test('⑧ ★ 다른 화면이 이미 맡았다면(최근 processing) 아무것도 하지 않는다 — 두 카드가 생기지 않는다', async () => {
  const busy = req({ state: 'processing', claimedAt: Date.now() - 60000, claimedBy: 'P002' });
  const w = wrap({ data: { companies: [CO], contracts: [] }, reqNode: busy });
  const r = await w.run('k1', busy);
  assert.ok(r.noop); assert.match(r.noop, /다른 화면이 처리 중/);
  assert.equal(w.calls.persist.length, 0); assert.equal(w.calls.patch.length, 0); assert.equal(w.calls.remove, 0);
  assert.equal(w.store.cur.claimedBy, 'P002', '남의 «맡았다» 표시를 건드리지 않는다');
});

test('⑧ 멈춘 흔적(processing 5분 넘음)은 다시 맡아 처리한다', async () => {
  const stuck = req({ state: 'processing', claimedAt: Date.now() - 6 * 60000, claimedBy: 'P002' });
  const w = wrap({ data: { companies: [CO], contracts: [] }, reqNode: stuck });
  const r = await w.run('k1', stuck);
  assert.ok(r.made); assert.equal(w.calls.persist.length, 1);
});

test('⑧ 요청이 이미 사라졌거나 거래가 실패하면 아무것도 저장하지 않는다', async () => {
  const gone = wrap({ data: { companies: [CO], contracts: [] }, reqNode: null });
  assert.ok((await gone.run('k1', req())).noop); assert.equal(gone.calls.persist.length, 0);
  const bad = wrap({ data: { companies: [CO], contracts: [] }, txFail: true });
  assert.ok((await bad.run('k1', req())).noop); assert.equal(bad.calls.persist.length, 0);
});

/* ── 길 연결: 사진첩 길은 그대로, 견적 길만 갈라 보낸다 ── */
test('⑱ processOneContractRequest 가 견적 길을 먼저 가르고, 사진첩·중진공 요청의 문턱(ctReqWhy)은 그대로다', () => {
  const body = cutFn(SRC, 'async function processOneContractRequest(');
  assert.match(body, /if\(erpQuoteLaneReq\(req\)\) return await processQuoteLaneRequest\(key, req\)/);
  assert.match(body, /ctReqWhy\(form\)/, '사진첩 길의 문턱 검사가 그대로 있다');
  assert.match(cutFn(SRC, 'function ctReqWhy('), /사업자번호가 없습니다/, '사진첩 길은 사업자번호가 없으면 여전히 막는다');
});

test('⑲ runContractRequests — 견적 길 요청은 «업체·계약을 가리킬 때만» 돌리고(멈춘 processing 도 다시 맡는다), 결과를 사진첩 길과 따로 센다', () => {
  const body = cutFn(SRC, 'async function runContractRequests(');
  assert.ok(body.includes('if(erpQuoteLaneReq(r)) return stuck || !!(r.companyId || r.contractId || r.companyName)'));
  assert.match(body, /r\.state === 'processing'/); assert.match(body, /300000/);
  assert.match(body, /madeQ|doneQ|blockedQ/); assert.match(body, /견적·계약 메일에서 온 요청/);
});

/* ── 걸린 요청 창: 견적 길 요청에서 «사람이 풀 수 있는» 칸이 뜬다 ── */
function h(tag, props, ...kids) { return { tag, props: props || {}, kids: kids.flat(Infinity).filter((k) => k !== false && k != null) }; }
function text(n) { return typeof n === 'object' ? n.kids.map(text).join('') : String(n); }
function find(n, pred, o = []) { if (n && typeof n === 'object') { if (pred(n)) o.push(n); n.kids.forEach((k) => find(k, pred, o)); } return o; }

test('⑳ 걸린 요청 창 — 견적 길 요청은 업체·담당자 고르기와 연결 보류 칸을 보이고, 사진첩 요청은 컨설팅 유형 줄을 그대로 보인다', () => {
  const MODAL = [cutFn(SRC, 'function BlockedRequestsModal('), cutFn(SRC, 'function erpQuoteLaneReq(')].join('\n');
  const patches = [];
  const ctx = { console, Date, Object, Array, String, Number, JSON, h, useEscClose: () => {} };
  vm.createContext(ctx);
  vm.runInContext(MODAL + '\nthis.M=BlockedRequestsModal;', ctx);
  const COS = [{ id: 'co1', name: '가나기관', biz: '7890' }, { id: 'co2', name: '다라상사', biz: '' }];
  const render = (requests) => ctx.M({ requests, users: USERS, companies: COS, coName: (id) => (COS.find((c) => c.id === id) || {}).name || '',
    onPatchReq: (k, p) => patches.push([k, p]), consTypeName: () => '유형이름', onRetry() {}, onRemove() {}, onClose() {} });
  const tree = render([
    { _key: 'q1', kind: 'quote', state: 'blocked', why: '사업장을 못 찾았습니다', subject: '[푸른노무법인] 컨설팅 견적서 송부의 건', companyName: '다라상사', handledAt: 1 },
    { _key: 'a1', kind: 'advance', state: 'blocked', why: '사업장을 정해 주세요', subject: '[푸른노무법인] 자문계약서 송부의 건', handledAt: 2 },
    { _key: 'l1', kind: 'quote', state: 'blocked', why: '담당자를 정해 주세요', companyId: 'co1', subject: '견적서 송부', handledAt: 3 },
    { _key: 'p1', state: 'blocked', why: '사업자번호가 없습니다', company: { name: '가나상사' }, consultingType: 'x', handledAt: 4 },
  ]);
  const t = text(tree);
  assert.match(t, /견적서 송부 · 메일 제목: 「\[푸른노무법인\] 컨설팅 견적서 송부의 건」/);
  assert.match(t, /계약 진행 신호 · 메일 제목: 「\[푸른노무법인\] 자문계약서 송부의 건」/);
  assert.match(t, /컨설팅 유형: 유형이름/, '사진첩 요청은 그대로');
  assert.match(t, /가나기관/, '업체를 이은 요청은 업체 이름을 업체관리에서 읽어 보여 준다');
  const selects = find(tree, (n) => n.tag === 'select');
  /* 견적 길 요청 셋(quote·advance·업체를 이은 quote) 모두에 담당자 select + 업체 select = 6.
     업체 고르개는 «이은 뒤에도 계속 보인다» — 잘못 고르면 바꿀 수 있어야 한다(검토 2026-11-09 Antigravity ①) */
  assert.equal(selects.length, 6);
  const isCo = (s) => find(s, (n) => n.tag === 'option' && /업체관리에서 고르기|이은 업체 풀기/.test(text(n))).length > 0;
  const coSel = selects.filter(isCo);
  assert.equal(coSel.length, 3, '견적·계약 신호 셋 모두에 업체 고르개가 뜬다(이은 요청도 바꿀 수 있어야 한다)');
  assert.equal(find(coSel[0], (n) => n.tag === 'option').length, 1 + COS.length);
  assert.match(text(coSel[0]), /가나기관 · 사업자번호 끝 7890/);
  assert.equal(coSel[2].props.defaultValue, 'co1', '이은 요청은 지금 업체가 선택돼 있다');
  assert.match(text(coSel[2]), /이은 업체 풀기/);
  assert.ok(String(coSel[2].props.key).includes('co1'), '요청이 고쳐져 다시 그려질 때 «지금 값»으로 다시 만들어지게 key 에 값을 넣는다');
  coSel[0].props.onChange({ target: { value: 'co1' } });
  assert.deepEqual(out(patches[0]), ['q1', { companyId: 'co1', companyName: '', deferLink: false }], '고르면 요청이 그 업체의 id 를 가리킨다');
  coSel[2].props.onChange({ target: { value: 'co2' } });
  assert.deepEqual(out(patches[1]), ['l1', { companyId: 'co2', companyName: '', deferLink: false }], '이은 업체를 다른 업체로 바꿀 수 있다');
  coSel[2].props.onChange({ target: { value: '' } });
  assert.deepEqual(out(patches[2]), ['l1', { companyId: null }], '비우면 이은 업체를 푼다');
  const mgr = selects.filter((s) => !coSel.includes(s))[0];
  mgr.props.onChange({ target: { value: 'A-001' } });
  assert.deepEqual(out(patches[3]), ['q1', { managerMain: 'A-001' }]);
  const defer = find(tree, (n) => n.tag === 'input' && n.props.type === 'checkbox');
  assert.equal(defer.length, 1, '연결 보류는 «업체를 못 이은 견적 요청»에만(이은 요청·계약 신호에는 없다)');
  defer[0].props.onChange({ target: { checked: true } });
  assert.deepEqual(out(patches[4]), ['q1', { deferLink: true }]);
  assert.match(t, /업체관리에 없으면 연결 보류로 등록/);
  /* 담당자 칸의 선택지에 사번이 새지 않는다(이름이 없으면 «이름 미확인») */
  assert.ok(!/P-005|A-001/.test(text(mgr)), '사번이 화면에 보인다');
});

test('⑳ 업체 고르개는 사번·전체 사업자번호를 보이지 않는다 — 끝 4자리만(같은 이름 업체를 가리는 데만)', () => {
  const src = cutFn(SRC, 'function BlockedRequestsModal(');
  assert.match(src, /사업자번호 끝 /);
  const parent = SRC.slice(SRC.indexOf('showBlockedReqs && h(BlockedRequestsModal'), SRC.indexOf('showBlockedReqs && h(BlockedRequestsModal') + 2200);
  assert.match(parent, /slice\(-4\)/, '사업자번호를 끝 4자리로 줄여 넘긴다');
  assert.match(parent, /closed\|terminated\|inactive/, '끝난 업체는 고르개에 안 올린다');
});

/* ── 검토 2026-11-09 (사진첩 방 2건 + Antigravity) ── */
test('② ★ 업체 «미연결» 진행 카드(연결 보류·예전 카드)가 같은 사업장이면 — 자동으로 만들지도 붙이지도 옮기지도 않고 사람이 정하게 막는다(카드가 둘 생기지 않는다)', () => {
  /* 이름·주소가 같고 companyId 가 없는 상담접수 카드 */
  const loose = card({ id: 'ct-L', companyId: '', company: { name: '가나기관', bizNo: '1234567890', address: CO.address, ceo: CO.ceo } });
  const q = P.erpQuoteLanePlan(req(), [CO], [loose], USERS);
  assert.equal(q.action, 'blocked'); assert.match(q.why, /업체가 이어져 있지 않습니다/); assert.match(q.why, /이름 모양으로 자동으로 붙이지 않습니다/);
  const a = P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract', managerMain: '' }), [CO], [loose], USERS);
  assert.equal(a.action, 'blocked'); assert.match(a.why, /업체가 이어져 있지 않습니다/); assert.match(a.why, /자동으로 옮기지 않습니다/);
  /* 계약협의 단계의 미연결 카드도 같다 */
  assert.equal(P.erpQuoteLanePlan(req(), [CO], [Object.assign({}, loose, { status: 'review' })], USERS).action, 'blocked');
  /* 업체가 «다른» 업체(companyId 가 다름)인 카드는 여기 안 든다 — 다른 업체다 */
  const other = card({ id: 'ct-O', companyId: 'co9', company: { name: '가나기관', bizNo: '1234567890', address: CO.address, ceo: CO.ceo, companyId: 'co9' } });
  assert.equal(P.erpQuoteLanePlan(req(), [CO], [other], USERS).action, 'create');
  /* 이름이 아주 다른 미연결 카드는 상관없다 */
  const far = card({ id: 'ct-F', companyId: '', company: { name: '마바상사', bizNo: '9999999999' }, companyName: '마바상사' });
  assert.equal(P.erpQuoteLanePlan(req(), [CO], [far], USERS).action, 'create');
  /* 끝난 카드(계약확정·종료)는 «진행 중»이 아니라 막지 않는다 — 다만 새 카드 메모에 재계약 확인을 적는다 */
  const looseSigned = P.erpQuoteLanePlan(req(), [CO], [Object.assign({}, loose, { status: 'signed' })], USERS);
  assert.equal(looseSigned.action, 'create');
  assert.match(looseSigned.form.note, /이름·주소가 같은 계약확정 카드가 있음\(업체 미연결\) — 재계약인지 확인/);
});

test('② 업체를 이은 카드가 하나 있으면 «미연결 카드 확인»보다 그 카드가 먼저다 — 덧붙인다(기존 동작 유지)', () => {
  const linked = card(); const loose = card({ id: 'ct-L', companyId: '', company: { name: '가나기관', bizNo: '1234567890' } });
  assert.equal(P.erpQuoteLanePlan(req(), [CO], [linked, loose], USERS).action, 'attach');
});

test('⑳ 멈춘 요청(processing 5분 넘음)도 걸린 요청 창에 보이고, 가리키는 것이 없어도 다시 맡는다 — 어디에도 안 보이는 고아가 없다', () => {
  const run = cutFn(SRC, 'async function runContractRequests(');
  assert.ok(run.includes('return stuck || !!(r.companyId || r.contractId || r.companyName)'));
  const at = SRC.indexOf("var ref = fbDb.ref('data/contract_requests');");
  const hook = SRC.slice(at, at + 900);
  assert.ok(hook.includes("q.state === 'blocked' || (erpQuoteLaneReq(q) && q.state === 'processing' && (Date.now() - (Number(q.claimedAt) || 0)) > 300000)"));
});

test('⑤ 「다시 시도」는 요청에 적는 고침(사업장 이름 등)이 서버에 닿은 뒤에 돈다 — 쓰다가 바로 눌러도 빈 이름으로 다시 막히지 않는다', async () => {
  const body = cutFn(SRC, 'async function retryBlockedRequest(');
  assert.ok(body.includes('await Promise.all(_erpCtReqPatches.splice(0))'));
  const at = SRC.indexOf('showBlockedReqs && h(BlockedRequestsModal');
  const parent = SRC.slice(at, at + 2800);
  assert.ok(parent.includes('_erpCtReqPatches.push(p)')); assert.ok(parent.includes('return p;'));
  /* 실제로 돌려 본다 — 저장이 늦게 닿는 가짜 약속이 끝난 «뒤에» 처리 함수가 불린다 */
  const order = [];
  const ctx = { console, Promise, Array, _erpCtReqBusy: false,
    _erpCtReqPatches: [new Promise((r) => setTimeout(() => { order.push('고침 닿음'); r(); }, 20))],
    showToast() {}, dbGet: () => [], processOneContractRequest: async () => { order.push('처리'); return { made: { companyName: 'x' } }; } };
  vm.createContext(ctx); vm.runInContext(body + '\nthis.run=retryBlockedRequest;', ctx);
  await ctx.run('k', {});
  assert.deepEqual(out(order), ['고침 닿음', '처리']);
});

test('⑥ 삭제 확인창 — 견적·계약 메일 요청은 «다시 생기지 않는다», 사진첩 요청은 «다시 누르면 생긴다»', async () => {
  const body = cutFn(SRC, 'async function removeBlockedRequest(');
  const asked = [];
  const ctx = { console, Promise, fbDb: { ref: () => ({ remove: () => Promise.resolve() }) }, showToast() {}, popConfirm: async (m) => { asked.push(m); return false; } };
  vm.createContext(ctx); vm.runInContext(body + '\nthis.run=removeBlockedRequest;', ctx);
  await ctx.run('k1', '다라상사', true); await ctx.run('k2', '가나상사', false);
  assert.ok(asked[0].includes('«본 메일»로 적혀 있어 지워도 다시 생기지 않습니다')); assert.ok(!asked[0].includes('사진첩에서 다시 누르면'));
  assert.ok(asked[1].includes('사진첩에서 다시 누르면 요청이 새로 생깁니다'));
  assert.ok(SRC.includes('props.onRemove(r._key, co, quoteLane)'));
});

test('⑧ 토스트 — «이미 반영한 메일·다른 화면이 처리 중»(noop)은 한 일로 세지 않는다', () => {
  assert.ok(cutFn(SRC, 'async function runContractRequests(').includes('else if(r.attached || r.advanced) doneQ++; else if(!r.noop) blockedQ++'));
  assert.ok(cutFn(SRC, 'async function retryBlockedRequest(').includes("else if(r.noop) showToast('ℹ ' + r.noop"));
});
