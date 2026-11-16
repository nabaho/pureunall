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

/* 📌 심급·단계 도우미(계획 5)는 견적 길 계획·처리 함수가 «부른다» — 함수를 떠 올 때 같이 실어야 한다
   (읽는 일은 js/pu-case-stage.js · 이 검사는 «달기 전·후 값이 그대로인지»만 본다, 단계 쪽은 tests/erp-stage-marks.test.js) */
const STAGE_FNS = ['function erpStageMarksMerge(', 'function erpStagePartsFromContract(', 'function erpStagePartsFromQuote('];
const STAGE_SRC = STAGE_FNS.map((d) => cutFn(SRC, d)).join('\n');
const PuCaseStage = require('../js/pu-case-stage.js');

const PURE = ['function erpQuoteLaneReq(', 'function erpQuoteDay(', 'function erpQuoteScrub(', 'function erpQuoteNote(', 'function erpCardCoId(',
  'function erpQuoteLanePlan(', 'function erpBlankContractForm(', 'function erpSameCompany(', 'function erpCoAddrKey('].map((d) => cutFn(SRC, d)).join('\n') + '\n' + STAGE_SRC;

function pure(withDetect) {
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, todayYMD: () => '2026-11-08', window: withDetect === false ? { PuCaseStage } : { PuQuoteDetect: DETECT, PuCaseStage } };
  vm.createContext(ctx);
  vm.runInContext(PURE + '\nthis.api={erpQuoteLaneReq,erpQuoteDay,erpQuoteNote,erpQuoteScrub,erpQuoteLanePlan,erpStageMarksMerge,erpStagePartsFromQuote,erpStagePartsFromContract};', ctx);
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

test('③ ★ 연결 보류 카드의 사업장 이름에 금액 글자가 오면 가려서 만든다(요청이 직접 쓴 이름도 한 번 더 지난다)', () => {
  const p = P.erpQuoteLanePlan(req({ companyId: '', companyName: '다라상사(400만원)', deferLink: true }), [CO], [], USERS);
  assert.equal(p.action, 'create');
  assert.ok(!JSON.stringify(p.form).includes('400만'), '금액 글자가 카드에 들어갔다'); assert.match(p.form.company.name, /^다라상사\(○○\)$/);
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
    erpStageMarksMerge: P.erpStageMarksMerge, erpStagePartsFromQuote: P.erpStagePartsFromQuote,
    erpDeferCoLinkIfNew: (f) => Object.assign({}, f, { companyLinkStatus: 'pending', companyId: '' }),
    isContractLocked: (ym) => ym === (env.lockedYm || ''),
    genContractNo: () => '계약-2026-196',
    setTimeout, clearTimeout, _recLastWrite: null, _erpQuoteUnlanded: {},
    /* env.write — 저장 층이 «서버 쓰기 약속»을 남기는 것을 흉내 낸다(실제 _recServerWrite 처럼 저장 직후 같은 틱에 남긴다) */
    /* env.localCache — 저장 층이 «이 기기 캐시에 먼저 적는» 것을 흉내 낸다(서버가 거절해도 캐시에는 남는다) */
    persistOne: (o) => { calls.persist.push(o); if (env.localCache) env.localCache(o); if (env.write) ctx._recLastWrite = env.write(calls); return env.persistOk !== false; },
    patchOne: (id, f) => { calls.patch.push({ id, f }); if (env.write) ctx._recLastWrite = env.write(calls); return env.patchOk !== false; },
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

/* ── ★ 서버에 닿은 뒤에만 요청을 지운다 (2차 검토 2026-11-09) ── */
test('⑲ ★ 저장이 서버에 «닿은 뒤에» 요청을 지운다 — 약속이 끝나기 전에는 지우지 않는다(만들기·덧붙이기·계약협의 이동 모두)', async () => {
  const cases = [
    ['만들기', { data: { companies: [CO], contracts: [] } }, req()],
    ['덧붙이기', { data: { companies: [CO], contracts: [card()] } }, req({ managerMain: '' })],
    ['이동', { data: { companies: [CO], contracts: [card()] } }, req({ kind: 'advance', docKind: 'contract', managerMain: '' })],
  ];
  for (const [name, env, rq] of cases) {
    const order = [];
    let open;
    const w = wrap(Object.assign({}, env, { reqNode: rq, write: () => new Promise((r) => { open = () => { order.push('닿음'); r(true); }; }) }));
    const origRemove = w.calls.remove;
    const done = w.run('k1', rq).then((x) => { order.push('끝:' + (x.made ? '만듦' : x.attached ? '덧붙임' : x.advanced ? '이동' : '?')); return x; });
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(w.calls.remove, 0, name + ' — 서버에 닿기 전에는 요청을 지우지 않는다');
    assert.deepEqual(out(order), [], name + ' — 아직 기다리는 중');
    open();
    const r = await done;
    assert.ok(r.made || r.attached || r.advanced, name);
    assert.equal(w.calls.remove, 1, name + ' — 닿은 뒤에 지운다');
    assert.equal(order[0], '닿음');
  }
});

test('⑲ ★ 서버가 거절(약속이 실패로 끝남)하면 요청을 지우지 않고 «걸림»으로 남긴다 — 카드도 요청도 없는 메일이 생기지 않는다', async () => {
  const cases = [
    ['만들기', { data: { companies: [CO], contracts: [] } }, req()],
    ['덧붙이기', { data: { companies: [CO], contracts: [card()] } }, req({ managerMain: '' })],
    ['이동', { data: { companies: [CO], contracts: [card()] } }, req({ kind: 'advance', docKind: 'contract', managerMain: '' })],
  ];
  for (const [name, env, rq] of cases) {
    const w = wrap(Object.assign({}, env, { reqNode: rq, write: () => Promise.reject(new Error('거절(가짜)')) }));
    const r = await w.run('k1', rq);
    assert.ok(!r.made && !r.attached && !r.advanced, name);
    assert.match(r.why, /서버에 저장되었는지 확인하지 못했습니다/);
    assert.equal(w.calls.remove, 0, name + ' — 지우지 않는다');
    assert.equal(w.store.cur.state, 'blocked'); assert.ok(!('claimedAt' in w.store.cur), '맡았다 표시는 푼다');
  }
});

test('⑲ ★ 8초 안에 끝나지 않으면(연결 끊김) 닿았다고 보지 않는다 — 요청을 남긴다 · 약속이 던져도 같다', async () => {
  const hang = wrap({ data: { companies: [CO], contracts: [] }, write: () => new Promise(() => {}), extra: { setTimeout: (fn) => { fn(); return 1; }, clearTimeout() {} } });
  const r = await hang.run('k1', req());
  assert.match(r.why, /서버에 저장되었는지 확인하지 못했습니다/); assert.equal(hang.calls.remove, 0);
  const boom = wrap({ data: { companies: [CO], contracts: [] }, write: () => Promise.reject(new Error('rules')) });
  const r2 = await boom.run('k1', req());
  assert.match(r2.why, /서버에 저장되었는지 확인하지 못했습니다/); assert.equal(boom.calls.remove, 0);
});

test('⑲ 직접 쓰기 길이 아니면(약속 없음 — 통째 저장 폴백) 그대로 지난다 · 저장 직전에 «지난 약속»을 비운다', async () => {
  const old = Promise.reject(new Error('옛 거절')); old.catch(() => {});   // 실제 저장 층도 거절에 처리기를 달아 둔다
  const stale = wrap({ data: { companies: [CO], contracts: [] }, extra: { _recLastWrite: old } });
  const r = await stale.run('k1', req());
  assert.ok(r.made, '남의 지난 약속(실패)에 끌려가지 않는다'); assert.equal(stale.calls.remove, 1);
  const body = cutFn(SRC, 'async function processQuoteLaneRequest(');
  /* 세 저장 자리가 모두 «비우기 → 저장 → 닿음 확인 → 지우기» 순서다 */
  assert.equal((body.match(/clearWrite\(\);/g) || []).length, 3);
  assert.equal((body.match(/if\(!\(await settle\(\)\)\) return await stop\(NOT_LANDED\);/g) || []).length, 3);
});

test('⑲ 저장 층 — _recServerWrite 가 서버 쓰기 약속을 남기고(받으면 끝남 · 거절이면 실패로 끝남) 실패 때의 되돌림·알림은 그대로다', async () => {
  const body = cutFn(SRC, 'function _recServerWrite(');
  assert.ok(SRC.includes('var _recLastWrite = null;'));
  const toasts = []; const store = {};
  const mk = (fail) => {
    const ctx = { console, Date, Object, Promise, parseInt, String, KEY: 'K', _recLastWrite: null,
      localStorage: { getItem: () => '5', setItem: (k, v) => { store[k] = v; } },
      fbDb: { ref: () => ({ update: () => (fail ? Promise.reject(new Error('거절')) : Promise.resolve()) }) },
      fbSyncFail: (e) => toasts.push(e.message) };
    vm.createContext(ctx); vm.runInContext(body + '\nthis.run=_recServerWrite;', ctx); return ctx;
  };
  const ok = mk(false); ok.run('contracts', { a: { id: 'a' } });
  await ok._recLastWrite;   // 받으면 그냥 끝난다
  const bad = mk(true); bad.run('contracts', { a: { id: 'a' } });
  await assert.rejects(() => bad._recLastWrite, /거절/);   // 거절이면 실패로 끝난다
  assert.deepEqual(out(toasts), ['거절'], '실패 알림은 그대로');
  assert.equal(store['K_meta_contracts'], '5', '실패하면 시각을 되돌린다(그대로)');
});

/* ── 2차 검토 2026-11-09 — 화면·계약 id 일치·열려 있는 동안 처리 ── */
test('㉑ ★ 계약 id 를 가리키는 계약 진행 신호 — 요청의 업체와 그 계약의 업체가 같을 때만 옮긴다(다르거나 업체가 안 이어져 있으면 사람이 정한다)', () => {
  const t = card({ id: 'ct-9', companyId: 'co1' });
  const ok = P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract', contractId: 'ct-9', managerMain: '' }), [CO], [t], USERS);
  assert.equal(ok.action, 'advance'); assert.equal(ok.target.id, 'ct-9');
  const other = card({ id: 'ct-9', companyId: 'co9', company: { name: '마바상사', companyId: 'co9' } });
  const diff = P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract', contractId: 'ct-9', managerMain: '' }), [CO], [other], USERS);
  assert.equal(diff.action, 'blocked'); assert.match(diff.why, /업체와 요청의 업체가 다릅니다/);
  const loose = card({ id: 'ct-9', companyId: '', company: { name: '가나기관', bizNo: '1234567890' } });
  const lo = P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract', contractId: 'ct-9', managerMain: '' }), [CO], [loose], USERS);
  assert.equal(lo.action, 'blocked'); assert.match(lo.why, /업체가 이어져 있지 않습니다/);
  /* 이미 계약협의인 다른 업체 카드도 «조용한 noop» 이 아니라 막는다(다른 업체를 지우듯 끝내지 않는다) */
  assert.equal(P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract', contractId: 'ct-9', managerMain: '' }), [CO], [Object.assign({}, other, { status: 'review' })], USERS).action, 'blocked');
  /* 요청에 업체가 없으면(계약 id 만) 그 계약을 그대로 옮긴다 — 앱에서 보낸 신호의 길 */
  assert.equal(P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract', contractId: 'ct-9', companyId: '', managerMain: '' }), [CO], [t], USERS).action, 'advance');
});

test('㉒ 걸린 요청 창 — 닫기에 이름표(aria-label)·입력칸에 key(요청이 고쳐지면 지금 값으로 다시 그림)·업체를 골라도 후보 이름을 지우지 않는다·멈춘 요청은 말로 알려 준다', () => {
  const at = SRC.indexOf('function BlockedRequestsModal(props){');
  const body = SRC.slice(at, at + 9000);
  assert.ok(body.includes("'aria-label':'닫기'"), '닫기 단추에 이름표');
  assert.ok(body.includes("key:'mgr-' + (r.managerMain || '')") && body.includes("key:'nm-' + (r.companyName || '')") && body.includes("key:'df-' + (r.deferLink ? '1' : '0')"), '입력칸 key');
  assert.ok(body.includes('props.onPatchReq(r._key, { companyId:e.target.value, deferLink:false })'), '업체를 골라도 companyName 을 지우지 않는다');
  assert.ok(!body.includes("companyName:'', deferLink:false"));
  assert.ok(body.includes('처리하다 멈춘 요청입니다') && body.includes("r.state === 'processing' ? '시작 '"), '멈춘 요청은 까닭·시각을 보인다');
});

test('㉓ 「다시 시도」 — 입력칸을 쓰는 중이어도 «칸을 벗어나게» 한 뒤 저장을 기다린다(blur → 기다림 순서)', async () => {
  const body = cutFn(SRC, 'async function retryBlockedRequest(');
  assert.ok(body.indexOf('_fe.blur()') >= 0 && body.indexOf('_fe.blur()') < body.indexOf('Promise.all(_erpCtReqPatches.splice(0))'));
  const order = [];
  const fe = { tagName: 'INPUT', blur() { order.push('blur'); ctx._erpCtReqPatches.push(new Promise((r) => setTimeout(() => { order.push('고침 닿음'); r(); }, 10))); } };
  const ctx = { console, Promise, Array, _erpCtReqBusy: false, document: { activeElement: fe }, _erpCtReqPatches: [],
    showToast() {}, dbGet: () => [], processOneContractRequest: async () => { order.push('처리'); return { made: { companyName: 'x' } }; } };
  vm.createContext(ctx); vm.runInContext(body + '\nthis.run=retryBlockedRequest;', ctx);
  await ctx.run('k', {});
  assert.deepEqual(out(order), ['blur', '고침 닿음', '처리']);
});

test('㉔ 이 화면이 열려 있는 동안 — 1분마다 멈춘 요청을 다시 계산하고, 견적 길의 기다리는·멈춘 요청이 있으면 이어서 처리한다(사진첩 요청은 건드리지 않는다)', () => {
  const at = SRC.indexOf('var lastAll = {};');
  const hook = SRC.slice(at, at + 3600);
  assert.ok(hook.includes('var timer = setInterval(function(){') && hook.includes('}, 60000);'));
  assert.ok(hook.includes('clearInterval(timer)'), '화면을 닫으면 시계를 멈춘다');
  assert.ok(hook.includes('runContractRequests(true)'));
  const run = cutFn(SRC, 'async function runContractRequests(');
  assert.ok(run.includes('quoteOnly === true && !erpQuoteLaneReq(r)'), '열려 있는 동안 도는 길은 견적 길만');
  assert.ok(SRC.includes('useEffect(function(){ runContractRequests(false); }, []);'), '열 때는 사진첩·중진공도 한 번 처리한다(그대로)');
});

/* ── 최종 재검증 2026-11-09 — 서버 거절 뒤 «같은 화면» 다시 시도가 요청을 지우지 않는다 ── */
test('㉕ ★ 서버가 거절한 뒤 같은 화면에서 «다시 시도» — 로컬 캐시의 srcMails 를 «이미 반영»으로 믿어 요청을 지우지 않는다(새로고침하면 서버 값으로 판단)', async () => {
  const data = { companies: [CO], contracts: [] };
  const w = wrap({ data, write: () => Promise.reject(new Error('거절(가짜)')), localCache: (o) => data.contracts.push(o) });
  const r1 = await w.run('k1', req());
  assert.match(r1.why, /서버에 저장되었는지 확인하지 못했습니다/); assert.equal(w.calls.remove, 0);
  assert.equal(data.contracts.length, 1, '이 화면의 캐시에는 카드가 남아 있다(서버는 거절했다)');
  /* 같은 화면에서 다시 시도 — plan 은 로컬 srcMails 를 보고 noop 이지만 요청은 지우지 않고 새로고침을 안내한다 */
  const r2 = await w.run('k1', req());
  assert.ok(!r2.noop, 'noop 으로 끝내면 서버에 없는 요청이 지워진다'); assert.match(r2.why, /새로고침/);
  assert.equal(w.calls.remove, 0, '요청을 지우지 않는다'); assert.equal(w.store.cur.state, 'blocked');
  assert.equal(w.calls.persist.length, 1, '같은 카드를 또 만들지도 않는다');
  /* 새로고침한 화면(서버 값에 카드가 있다)은 «이미 반영»으로 정리한다 */
  const fresh = wrap({ data: { companies: [CO], contracts: [card({ srcMails: ['Sent|1001'] })] }, reqNode: req({ state: 'blocked' }) });
  const r3 = await fresh.run('k1', req({ state: 'blocked' }));
  assert.ok(r3.noop); assert.equal(fresh.calls.remove, 1);
});

test('㉕ 나중에 서버가 받았다고 알려 오면(늦게 닿음) 표시를 풀어 «이미 반영»으로 정리한다 · 닿은 저장은 표시를 남기지 않는다', async () => {
  const data = { companies: [CO], contracts: [] };
  let late; const slow = new Promise((r) => { late = r; });
  const w = wrap({ data, write: () => slow, localCache: (o) => data.contracts.push(o), extra: { setTimeout: (fn) => { fn(); return 1; }, clearTimeout() {} } });
  const r1 = await w.run('k1', req());
  assert.match(r1.why, /서버에 저장되었는지 확인하지 못했습니다/);
  late(); await new Promise((r) => setTimeout(r, 10));
  const r2 = await w.run('k1', req());
  assert.ok(r2.noop, '서버가 받은 뒤에는 이미 반영으로 정리한다'); assert.equal(w.calls.remove, 1);
  const ok = wrap({ data: { companies: [CO], contracts: [] }, write: () => Promise.resolve() });
  assert.ok((await ok.run('k1', req())).made);
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
  assert.deepEqual(out(patches[0]), ['q1', { companyId: 'co1', deferLink: false }], '고르면 요청이 그 업체의 id 를 가리킨다');
  coSel[2].props.onChange({ target: { value: 'co2' } });
  assert.deepEqual(out(patches[1]), ['l1', { companyId: 'co2', deferLink: false }], '이은 업체를 다른 업체로 바꿀 수 있다');
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
  const at = SRC.indexOf('var lastAll = {};');
  const hook = SRC.slice(at, at + 1800);
  assert.ok(hook.includes("function isStuck(q){ return erpQuoteLaneReq(q) && q.state === 'processing' && (Date.now() - (Number(q.claimedAt) || 0)) > 300000; }"));
  assert.ok(hook.includes("q.state === 'blocked' || isStuck(q)"), '걸린 것 + 멈춘 흔적을 같은 창에 보인다');
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

test('㉑ 사진첩·메일함 계약서(photo_contract) — 금액·성공보수·사건/자문 종류 판별', () => {
  const FN = ['function erpParseContractMoney(', 'function erpParseSuccessFee(', 'function erpGuessContractFromFields(',
    'function erpTypeNameTidy(', 'function erpNameRun(', 'function erpConsTypeByDocName('].map((d) => cutFn(SRC, d)).join('\n');
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, parseInt, parseFloat };
  vm.createContext(ctx);
  vm.runInContext(FN + '\nthis.api={erpParseContractMoney,erpParseSuccessFee,erpGuessContractFromFields};', ctx);
  const A = ctx.api;
  assert.equal(A.erpParseContractMoney('금 2,200,000 원(부가세 포함)'), 2200000);
  assert.equal(A.erpParseContractMoney('220만원'), 2200000);
  assert.deepEqual(out(A.erpParseSuccessFee('금 3,300,000 원 (부가세 포함)')), { type: 'amount', fee: 3300000 });
  assert.deepEqual(out(A.erpParseSuccessFee('경제적 이익의 15%')), { type: 'percent', fee: 15 });
  const g1 = A.erpGuessContractFromFields(
    { docName: '위임약정서', scope: '충남2026부해1332 부당해고 등 구제신청 사건 처리에 관한 일체의 사항' },
    [], [{ code: 'case-dismiss', name: '부당해고등노동위원회대리(노사)', short: '부해' }], [], []
  );
  assert.deepEqual(out(g1), { kind: 'case', typeCode: 'case-dismiss' });
  const g2 = A.erpGuessContractFromFields(
    { docName: '자문계약서', scope: '인사노무 상시자문' },
    [], [], [{ code: '자문', name: '자문' }], []
  );
  assert.deepEqual(out(g2), { kind: 'company', typeCode: '자문' });
});

test('㉒ processPhotoContractRequest — 계약서 판독 값으로 계약 내용을 채우고 계약확정(signed)으로 배치·이동한다', async () => {
  const FN = [
    'function erpParseContractMoney(', 'function erpParseSuccessFee(', 'function erpGuessContractFromFields(',
    'function erpTypeNameTidy(', 'function erpNameRun(', 'function erpConsTypeByDocName(',
    'function erpVatTextToFlag(', 'function erpDocText(', 'function erpCmsFromDoc(',
    'function erpBlankContractForm(', 'function erpSameCompany(', 'function erpCoAddrKey(',
    'function erpCoNameKey(', 'function erpBiznoClash(', 'async function processPhotoContractRequest('
  ].map((d) => cutFn(SRC, d)).join('\n') + '\n' + STAGE_SRC;
  const CO_V = Object.assign({}, CO, { bizNo: '1234567891' });
  const cardV = (o) => card(Object.assign({ company: { name: '가나기관', bizNo: '1234567891' } }, o || {}));
  const calls = { persist: [], remove: 0, update: [] };
  const ctx = {
    console, Date, Object, Array, String, Number, JSON, Math, Promise, parseInt, parseFloat,
    ERP_CMS_WORDS: ['CMS', '자동이체'],
    todayYMD: () => '2026-11-10',
    fbDb: { ref: () => ({ remove: () => { calls.remove++; return Promise.resolve(); }, update: (v) => { calls.update.push(v); return Promise.resolve(); } }) },
    dbGet: (k, d) => (k === 'companies' ? [CO_V] : k === 'contracts' ? [] : d),
    getActiveUsers: () => USERS,
    getKindTypes: (kv) => (kv === 'case' ? [{ code: 'case-dismiss', name: '부당해고등노동위원회대리(노사)', short: '부해' }] : []),
    erpDeferCoLinkIfNew: (f) => (f.companyId ? f : Object.assign({}, f, { companyLinkStatus: 'pending', companyId: '' })),
    isContractLocked: () => false,
    genContractNo: () => '계약-2026-197',
    persistOne: (o) => { calls.persist.push(o); return true; }
  };
  const DOCREAD_BOOT = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-doc-read.js'), 'utf8');
  ctx.window = ctx; ctx.global = ctx; ctx.setTimeout = setTimeout; ctx.PuCaseStage = PuCaseStage;
  vm.createContext(ctx);
  vm.runInContext(DOCREAD_BOOT, ctx);
  vm.runInContext(FN + '\nthis.run=processPhotoContractRequest;', ctx);
  const r = await ctx.run('k-ct1', {
    source: 'photo_contract',
    state: 'pending',
    targetStatus: 'signed',
    managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '123-45-67891', corpRegNo: '161471-0001381', address: '충남 가나시 다라로 1', phone: '041-000-0000' },
    contractFields: {
      docName: '위임약정서',
      scope: '충남2026부해1332 부당해고 등 구제신청 사건 처리에 관한 일체의 사항',
      retainer: '금 2,200,000 원(부가세 포함)',
      success: '금 3,300,000 원 (부가세 포함)'
    },
    srcPhoto: { id: 'p-1', year: 2026, owner: 'u1', kind: 'contract', name: '위임약정서' }
  });
  assert.ok(r.made);
  assert.equal(calls.persist.length, 1);
  const saved = calls.persist[0];
  assert.equal(saved.status, 'signed', '계약확정 상태로 등록');
  assert.deepEqual(out(saved.kinds), ['case']);
  assert.equal(saved.typeCodes.case, 'case-dismiss');
  assert.equal(saved.amounts.case, 2200000);
  assert.equal(saved.successFee, 3300000);
  assert.equal(saved.successFeeType, 'amount');
  assert.equal(saved.contractFeeVatIncluded, true);
  assert.match(saved.briefs.case, /충남2026부해1332/);
  assert.equal(calls.remove, 1);

  /* ㉓ allowCreateReview 가 켜진 advance 요청은 상담접수 카드가 없어도 계약협의(review) 카드를 새로 만든다 */
  const planRev = P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract', allowCreateReview: true }), [CO], [], USERS);
  assert.equal(planRev.action, 'create');
  assert.equal(planRev.form.status, 'review');
  const planConsAndRev = P.erpQuoteLanePlan(req({ kind: 'advance', docKind: 'contract' }), [CO], [card({ id: 'ct-c', status: 'consult' }), card({ id: 'ct-r', status: 'review' })], USERS);
  assert.equal(planConsAndRev.action, 'blocked', '상담접수 1건 + 계약협의 1건이면 복수 진행 중으로 막는다');

  /* ㉔ 같은 사업장에 진행 중 카드가 2건 이상이면 종류가 달라도 blocked 로 막는다 */
  let mockCts = [
    cardV({ id: 'ct-a', status: 'review', kinds: ['consulting'] }),
    cardV({ id: 'ct-b', status: 'consult', kinds: ['consult'] })
  ];
  ctx.dbGet = (k, d) => (k === 'companies' ? [CO_V] : k === 'contracts' ? mockCts : d);
  calls.persist.length = 0; calls.update.length = 0;
  const rDup = await ctx.run('k-ct2', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '123-45-67891' },
    contractFields: { docName: '위임약정서', scope: '부당해고 구제신청' }
  });
  assert.match(rDup.why, /진행 중 카드가 2건/);
  assert.equal(calls.persist.length, 0);

  /* 다른 종류(consulting) 진행 중 카드 1건만 있으면 덮어쓰지 않고 별도 case 카드로 만들고,
     같은 종류(case) 진행 중 카드 1건에 이미 적힌 금액·성공보수는 덮어쓰지 않고 보존한다 */
  mockCts = [cardV({ id: 'ct-cons', status: 'review', kinds: ['consulting'], amounts: { consulting: 5000000 } })];
  calls.persist.length = 0;
  const rDiffKind = await ctx.run('k-ct3', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '123-45-67891' },
    contractFields: { docName: '위임약정서', scope: '부당해고 구제신청', retainer: '220만원' }
  });
  assert.ok(rDiffKind.made);
  assert.notEqual(rDiffKind.made.id, 'ct-cons', '기존 컨설팅 카드를 덮어쓰지 않고 새 카드로 생성');
  assert.deepEqual(out(rDiffKind.made.kinds), ['case']);

  mockCts = [cardV({ id: 'ct-case1', status: 'review', kinds: ['case'], amounts: { case: 1500000 }, successFee: 2000000, successFeeType: 'amount', contractFeeVatIncluded: false, vatType: 'separate' })];
  calls.persist.length = 0;
  const rKeepAmt = await ctx.run('k-ct4', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '123-45-67891' },
    contractFields: { docName: '위임약정서', scope: '부당해고 구제신청', retainer: '990만원(부가세 포함)', success: '880만원(부가세 포함)' }
  });
  assert.equal(rKeepAmt.made.id, 'ct-case1');
  assert.equal(rKeepAmt.made.amounts.case, 1500000, '기존에 적힌 착수금 보존');
  assert.equal(rKeepAmt.made.successFee, 2000000, '기존에 적힌 성공보수 보존');
  assert.equal(rKeepAmt.made.contractFeeVatIncluded, false, '기존 금액이 있으면 부가세 구분도 덮어쓰지 않고 보존');
  assert.equal(rKeepAmt.made.vatType, 'separate');

  /* ㉕ 사업자번호도 companyId 도 없이 상호만 같은 미확인 요청은 companyId 를 잇지 않고 계약협의(review)로 둔다 */
  mockCts = [];
  calls.persist.length = 0;
  const rUnverified = await ctx.run('k-ct5', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '' },
    contractFields: { docName: '위임약정서', scope: '부당해고 구제신청', retainer: '220만원' }
  });
  assert.ok(rUnverified.made);
  assert.equal(rUnverified.made.companyId, '', '이름만으로 업체 ID 를 잇지 않는다');
  assert.equal(rUnverified.made.companyLinkStatus, 'pending');
  assert.equal(rUnverified.made.status, 'review', '거래처 미확인 신규 요청은 계약협의(review)에 둔다');

  /* 기존 카드(연결된 카드 또는 미확인 review 카드)가 있어도 이름만 같은 미확인 요청으로 기존 카드를 signed 로 바꾸지 않는다 */
  mockCts = [card({ id: 'ct-existing', companyId: 'co1', status: 'review', kinds: ['case'] })];
  calls.persist.length = 0;
  const rUnvOver = await ctx.run('k-ct6', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '' },
    contractFields: { docName: '위임약정서', scope: '부당해고 구제신청', retainer: '220만원' }
  });
  assert.ok(rUnvOver.made);
  assert.notEqual(rUnvOver.made.id, 'ct-existing', '이름만 같은 미확인 요청으로 기존 연결 카드를 덮어쓰지 않는다');
  assert.equal(rUnvOver.made.companyId, '');
  assert.equal(rUnvOver.made.status, 'review');

  mockCts = [card({ id: 'unverified-existing', companyId: '', companyLinkStatus: 'pending', company: { name: '가나기관', bizNo: '' }, status: 'review', kinds: ['case'] })];
  calls.persist.length = 0;
  const rUnvPend = await ctx.run('k-ct7', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '' },
    contractFields: { docName: '위임약정서', scope: '부당해고 구제신청', retainer: '220만원' }
  });
  assert.ok(rUnvPend.made);
  assert.notEqual(rUnvPend.made.id, 'unverified-existing', '미확인 기존 카드도 이름만으로 signed 확정하지 않는다');
  assert.equal(rUnvPend.made.status, 'review');

  /* ㉖ 생산자(PuDocFile.autoRequestContractFromPhoto) → 소비자(processPhotoContractRequest):
     잘못된 사업자번호(123 또는 bizNoOk:false) + 같은 상호가 있을 때 이름 검색 결과로 companyId·사업자번호를 치환해 signed 확정하는 우회를 차단한다 */
  const DOCREAD_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-doc-read.js'), 'utf8');
  const DOCFILE_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-doc-file.js'), 'utf8');
  const prodWrites = {};
  const prodCtx = {
    console, Date, Object, Array, String, Number, JSON, Math, Promise, RegExp, Error, parseInt, parseFloat, setTimeout
  };
  prodCtx.window = prodCtx; prodCtx.global = prodCtx;
  vm.createContext(prodCtx);
  vm.runInContext(DOCREAD_SRC, prodCtx);
  vm.runInContext(DOCFILE_SRC, prodCtx);
  prodCtx.PuDocFile.init({
    db: {
      ref: (p) => ({
        once: () => Promise.resolve({
          val: () => {
            if (p.indexOf('companies') >= 0) return { v: { co1: { id: 'co1', name: '가나기관', bizNo: '1234567890', managerMain: 'P-005' } } };
            if (p.indexOf('user_dir') >= 0) return { v: USERS };
            return null;
          }
        }),
        set: (v) => { prodWrites[p] = v; return Promise.resolve(); },
        update: () => Promise.resolve()
      })
    }
  });
  await prodCtx.PuDocFile.autoRequestContractFromPhoto({
    id: 'p-badbiz', year: 2026, owner: 'u1', by: '담당가',
    fields: { company: '가나기관', bizno: '1234567890', docName: '위임약정서', scope: '부당해고 구제신청', retainer: '220만원' }
  });
  const builtReq = prodWrites['data/contract_requests/ctphoto-2026_p-badbiz'];
  assert.ok(builtReq, '생산자가 요청을 만들었다');
  assert.equal(builtReq.companyId, '', 'PuDocRead.bizNoOk 가 false 인 10자리 번호는 이름/번호 검색 업체 ID 로 연결하지 않는다');
  assert.equal(builtReq.company.bizNo, '', '검산 실패한 10자리 사업자번호는 요청에 남기지 않는다');
  assert.equal(builtReq.targetStatus, 'review', '사업자번호 검산 실패 요청은 review 로 격리한다');

  await prodCtx.PuDocFile.autoRequestContractFromPhoto({
    id: 'p-mailid', year: 2026, owner: 'u1', by: '담당가', bizNoOk: false,
    mailMeta: { companyId: 'co1', dir: 'in', srcKey: 'INBOX|77' },
    fields: { company: '가나기관', bizno: '', docName: '위임약정서', scope: '부당해고 구제신청', retainer: '220만원' }
  });
  const builtMailReq = prodWrites['data/contract_requests/ctphoto-2026_p-mailid'];
  assert.ok(builtMailReq);
  assert.equal(builtMailReq.companyId, '', '빈 사업자번호 + mailMeta.companyId 로 이름 추정 업체 ID 를 연결하지 않는다');
  assert.equal(builtMailReq.company.bizNo, '', '빈 사업자번호 + mailMeta.companyId 로 업체 사업자번호를 치환하지 않는다');
  assert.equal(builtMailReq.targetStatus, 'review', '빈 사업자번호 + mailMeta.companyId 요청도 review 로 격리한다');

  mockCts = [card({ id: 'ct-existing-prod', companyId: 'co1', status: 'review', kinds: ['case'] })];
  calls.persist.length = 0;
  const rFromProd = await ctx.run(builtReq.id, builtReq);
  assert.ok(rFromProd.made);
  assert.notEqual(rFromProd.made.id, 'ct-existing-prod', '생산자 요청을 소비자에 넣어도 기존 카드를 덮어쓰지 않는다');
  assert.equal(rFromProd.made.status, 'review', '기존 카드나 새 카드가 signed 로 확정되지 않는다');
  calls.persist.length = 0;
  const rFromMailProd = await ctx.run(builtMailReq.id, builtMailReq);
  assert.ok(rFromMailProd.made);
  assert.notEqual(rFromMailProd.made.id, 'ct-existing-prod', 'mailMeta.companyId 경로도 기존 카드를 덮어쓰지 않는다');
  assert.equal(rFromMailProd.made.status, 'review');

  /* 판독 라이브러리(PuDocRead) 미로딩 상태에서도 생산자·소비자 모두 검산 실패 10자리 번호(1234567890)를 fail-closed 로 차단한다 */
  delete prodCtx.PuDocRead;
  await prodCtx.PuDocFile.autoRequestContractFromPhoto({
    id: 'p-nolib', year: 2026, owner: 'u1', by: '담당가',
    fields: { company: '가나기관', bizno: '1234567890', docName: '위임약정서', scope: '부당해고 구제신청', retainer: '220만원' }
  });
  const builtNoLib = prodWrites['data/contract_requests/ctphoto-2026_p-nolib'];
  assert.ok(builtNoLib);
  assert.equal(builtNoLib.companyId, '', 'PuDocRead 미로딩 시에도 검산 실패 번호로 업체를 잇지 않는다');
  assert.equal(builtNoLib.company.bizNo, '', 'PuDocRead 미로딩 시에도 검산 실패 번호를 남기지 않는다');
  assert.equal(builtNoLib.targetStatus, 'review', 'PuDocRead 미로딩 시에도 검산 실패 번호는 review 로 격리한다');

  calls.persist.length = 0;
  const rSynthWithLib = await ctx.run('k-synth-withlib', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', confirmed: true, managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '1234567890' },
    contractFields: { docName: '위임약정서', scope: '부당해고 구제신청', retainer: '220만원' }
  });
  assert.equal(rSynthWithLib.made.status, 'review', 'confirmed:true 가 있어도 검산 실패 번호는 review 로 격리한다');
  const rZeroWithLib = await ctx.run('k-synth-zero', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', confirmed: true, managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '000-00-00000' },
    contractFields: { docName: '위임약정서', scope: '부당해고 구제신청', retainer: '220만원' }
  });
  assert.equal(rZeroWithLib.made.bizNo, '', '0000000000 은 유효 사업자번호로 인정하지 않는다');
  assert.equal(rZeroWithLib.made.status, 'review');

  delete ctx.PuDocRead;
  calls.persist.length = 0;
  const rSynthInvalid = await ctx.run('k-synth-badbiz', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', confirmed: true, managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '1234567890' },
    contractFields: { docName: '위임약정서', scope: '부당해고 구제신청', retainer: '220만원' }
  });
  assert.ok(rSynthInvalid.made);
  assert.notEqual(rSynthInvalid.made.id, 'ct-existing-prod', '소비자에 직접 검산 실패 10자리 번호를 넣어도 기존 카드를 덮어쓰지 않는다');
  assert.equal(rSynthInvalid.made.companyId, '');
  assert.equal(rSynthInvalid.made.bizNo, '');
  assert.equal(rSynthInvalid.made.status, 'review', '소비자도 독립 검산으로 검산 실패 번호를 review 로 격리한다');

  /* ㉗ 메일 생애주기(①보낸 견적서 → ②보낸 계약서 양식 → ③새롭게 계약한 체결 계약서) 종합 자동 분석 및 중복·종료 사업장 자동 제외 */
  vm.runInContext(DOCREAD_BOOT, ctx);
  vm.runInContext(DOCREAD_SRC, prodCtx);
  assert.deepEqual(out(prodCtx.PuDocFile.synthesizeMailLifecycle(null, {}).groups), {}, '비배열 folderData 입력 시 예외 없이 빈 결과 반환');
  const synthRes = prodCtx.PuDocFile.synthesizeMailLifecycle([
    {
      slug: 'Sent', kind: 'sent',
      msgs: {
        '99': { u: '99', d: Date.parse('2026-09-01T10:00:00+09:00'), s: '[푸른노무법인] 복귀기업 자문 견적서 송부', an: ['견적서_복귀기업.pdf'] },
        '100': { u: '100', d: Date.parse('2026-01-10T10:00:00+09:00'), s: '[푸른노무법인] 재계약기업 1차 컨설팅 견적서 송부', an: ['견적서_재계약기업_1차.pdf'] },
        '110': { u: '110', d: Date.parse('2026-05-10T10:00:00+09:00'), s: '[푸른노무법인] 수기확정기업 컨설팅 견적서 송부', an: ['견적서_수기확정기업.pdf'] },
        '111': { u: '111', d: Date.parse('2026-05-11T10:00:00+09:00'), s: '[푸른노무법인] 수기확정기업 컨설팅 위임계약서 송부', an: ['위임계약서_수기확정기업.pdf'] },
        '101': { u: '101', d: Date.parse('2026-10-20T10:00:00+09:00'), t: 'hr@basa.example', s: '[푸른노무법인] 바사테크 취업규칙 변경 컨설팅 견적서 송부', an: ['견적서_바사테크.pdf'] },
        '102': { u: '102', d: Date.parse('2026-10-22T10:00:00+09:00'), t: 'hr@basa.example', s: '[푸른노무법인] 바사테크 취업규칙 컨설팅 위임계약서 송부', an: ['위임계약서_바사테크.pdf'] },
        '103': { u: '103', d: Date.parse('2026-10-21T10:00:00+09:00'), s: '[푸른노무법인] 종료상사 자문 견적서 송부', an: ['견적서_종료상사.pdf'] },
        '104': { u: '104', d: Date.parse('2026-10-21T11:00:00+09:00'), s: '[푸른노무법인] 중복기업 컨설팅 견적서 송부', an: ['견적서_중복기업.pdf'] },
        '105': { u: '105', d: Date.parse('2026-11-05T10:00:00+09:00'), s: '[푸른노무법인] 재계약기업 신규 컨설팅 견적서 송부', an: ['견적서_재계약기업.pdf'] },
        '106': { u: '106', d: Date.parse('2026-11-06T10:00:00+09:00'), s: '[푸른노무법인] 복귀기업 자문 견적서 송부', an: ['견적서_복귀기업.pdf'] },
        '107': { u: '107', d: Date.parse('2026-11-08T10:00:00+09:00'), t: 'kim@gana.example', s: '[푸른노무법인] 가나기관 컨설팅 견적서 송부', an: ['견적서_가나기관.pdf'] },
        '108': { u: '108', d: Date.parse('2026-11-08T11:00:00+09:00'), t: 'unregistered@outside.example', s: '[무이메일기업] 자문계약서 송부', an: ['자문계약서.pdf'] },
        '109': { u: '109', d: Date.parse('2026-11-08T12:00:00+09:00'), t: 'new@unreg.example', s: '[신규미등록] 자문계약서 송부', an: ['자문계약서.pdf'] }
      }
    },
    {
      slug: 'INBOX', kind: 'inbox',
      msgs: {
        '201': { u: '201', d: Date.parse('2026-10-25T15:00:00+09:00'), e: 'hr@basa.example', s: '[바사테크] 위임계약서 날인본 회신', a: 1, an: ['위임계약서_바사테크_날인.pdf'] },
        '202': { u: '202', d: Date.parse('2026-10-26T09:00:00+09:00'), s: '[해지테크] 자문계약 해지 통보의 건', b: '자문계약 해지 통보드립니다.' },
        '203': { u: '203', d: Date.parse('2026-10-01T09:00:00+09:00'), s: '[복귀기업] 자문계약 해지 통보의 건', b: '자문계약 해지 요청드립니다.' },
        '204': { u: '204', d: Date.parse('2026-11-07T09:00:00+09:00'), s: '[초안기업] 자문계약서 검토 요청', a: 1, an: ['자문계약서_초안.pdf'] },
        '205': { u: '205', d: Date.parse('2026-11-07T10:00:00+09:00'), s: '[안괄호기업] 자문계약서 (안) 송부', a: 1, an: ['자문계약서.pdf'] },
        '206': { u: '206', d: Date.parse('2026-11-07T11:00:00+09:00'), s: '[본문초안기업] 자문계약서 송부', b: '초안이니 검토 부탁드립니다.', a: 1, an: ['자문계약서.pdf'] },
        '207': { u: '207', d: Date.parse('2026-11-09T11:00:00+09:00'), e: 'evil@other.example', s: '[가나기관] 컨설팅 계약서 회신', a: 1, an: ['컨설팅계약서_가나기관.pdf'] },
        '208': { u: '208', d: Date.parse('2026-11-09T12:00:00+09:00'), s: '[미등록기업] 자문계약서 회신', a: 1, an: ['자문계약서.pdf'] },
        '209': { u: '209', d: Date.parse('2026-11-09T13:00:00+09:00'), e: 'stranger@gana.example', s: '[가나기관] 자문계약서 회신', a: 1, an: ['자문계약서_가나기관.pdf'] },
        '210': { u: '210', d: Date.parse('2026-11-09T14:00:00+09:00'), e: 'unregistered@outside.example', s: '[무이메일기업] 자문계약서 날인본 회신', a: 1, an: ['자문계약서.pdf'] },
        '211': { u: '211', d: Date.parse('2026-11-09T15:00:00+09:00'), e: 'hr@basa.example..', s: '[바사테크] 자문계약서 회신', a: 1, an: ['자문계약서.pdf'] },
        '212': { u: '212', d: Date.parse('2026-11-09T16:00:00+09:00'), e: 'new@unreg.example', s: '[신규미등록] 자문계약서 날인본 회신', a: 1, an: ['자문계약서.pdf'] },
        '213': { u: '213', d: Date.parse('2026-11-09T17:00:00+09:00'), e: 'other@gana.example', s: '[바사테크] 위임계약서 회신', a: 1, an: ['위임계약서_바사테크.pdf'] }
      }
    }
  ], {
    companies: {
      coBasa: { id: 'coBasa', name: '바사테크', status: 'active', email: 'hr@basa.example' },
      coClosed: { id: 'coClosed', name: '종료상사', status: 'closed' },
      coDup: { id: 'coDup', name: '중복기업', status: 'active', contacts: { c1: { email: 'extra@partner.example' } } },
      coRenew: { id: 'coRenew', name: '재계약기업', status: 'active' },
      coGana: { id: 'coGana', name: '가나기관', status: 'active', email: 'kim@gana.example' },
      coNoEmail: { id: 'coNoEmail', name: '무이메일기업', status: 'active', email: '' },
      coManual: { id: 'coManual', name: '수기확정기업', status: 'active' }
    },
    contracts: [
      { id: 'ct-dup', companyId: 'coDup', companyName: '중복기업', status: 'transferred', kinds: ['consulting'], srcMails: ['Sent|104'] },
      { id: 'ct-old', companyId: 'coRenew', companyName: '재계약기업', status: 'signed', kinds: ['consulting'], srcMails: ['Sent|100'], signDate: '2026-01-10' },
      { id: 'ct-manual', companyId: 'coManual', companyName: '수기확정기업', status: 'signed', kinds: ['consult'], signDate: '2026-06-25' }
    ]
  });
  assert.equal(synthRes.groups['종료상사'].excluded, 'closed_company', '종료된 사업장은 자동 제외');
  assert.equal(synthRes.groups['해지테크'].excluded, 'closed_company', '계약 해지 통보 사업장은 자동 제외');
  assert.equal(synthRes.groups['중복기업'].excluded, 'duplicate', '이미 이관·반영된 중복 사업장은 자동 제외');
  assert.equal(synthRes.groups['수기확정기업'].excluded, 'duplicate', 'srcMails 없는 수기 확정 계약(signDate 2026-06-25, kinds consult) 이전인 2026-05-10·11 견적·계약서 메일도 중복으로 자동 제외');
  assert.equal(synthRes.groups['재계약기업'].excluded, '', '과거 계약에 반영된 Sent|100 과 신규 Sent|105 가 함께 있어도 미반영 신규 메일(Sent|105)만 분리해 중복 제외하지 않는다');
  assert.deepEqual(out(synthRes.groups['재계약기업'].srcMails), ['Sent|105'], '이미 확정 계약에 들어간 과거 srcKey(Sent|100)는 제외하고 신규 srcKey 만 남긴다');
  assert.equal(synthRes.bySrcKey['Sent|100'].isDuplicateInErp, true, '이미 확정 계약에 반영된 개별 과거 메일(Sent|100)은 bySrcKey 에서도 중복 제외');
  assert.equal(synthRes.groups['복귀기업'].excluded, '', '과거 해지 이후 새로 발송된 견적서는 제외하지 않는다');
  assert.deepEqual(out(synthRes.groups['복귀기업'].srcMails), ['Sent|106'], '해지 이전 메일(Sent|99)은 제외하고 해지 이후 신규 메일(Sent|106)만 포함');
  assert.equal(synthRes.bySrcKey['Sent|99'].companyClosed, true, '해지 통보(2026-10-01) 이전의 구 견적 메일(Sent|99, 2026-09-01)은 bySrcKey 에서 종료 건으로 격리되어 재수집되지 않는다');
  assert.equal(prodCtx.PuDocFile.isTerminatedMailText('[바사테크] 자문계약서 송부', '제10조 해지 통보는 30일 전에 서면으로 한다.'), false, '계약서 본문의 일반 해지 조항 문구는 해지 통보 메일로 오인하지 않는다');
  const planWithKind = P.erpQuoteLanePlan(req({ inferredKind: 'consulting' }), [CO], [], USERS);
  assert.deepEqual(out(planWithKind.form.kinds), ['consulting'], 'inferredKind 가 전달되면 카드의 kinds 에 반영');
  assert.equal(synthRes.groups['초안기업'].hasSigned, false, '계약서 초안·검토요청 메일은 체결(contract_signed)로 판정하지 않는다');
  assert.equal(synthRes.groups['초안기업'].targetStage, 'review');
  assert.equal(synthRes.groups['안괄호기업'].hasSigned, false, '제목에 (안)이 포함된 메일은 review 로 분류');
  assert.equal(synthRes.groups['안괄호기업'].targetStage, 'review');
  assert.equal(synthRes.groups['본문초안기업'].hasSigned, false, '본문에 초안·검토 부탁이 포함된 메일은 review 로 분류');
  assert.equal(synthRes.groups['본문초안기업'].targetStage, 'review');
  const gana = synthRes.groups['가나기관'];
  assert.equal(gana.companyId, 'coGana', '검증된 보낸메일 버킷이 대표 그룹을 유지');
  assert.equal(gana.targetStage, 'consult', '외부 미검증 발신자의 계약서 메일로 기존 업체 그룹이 signed 로 승격되지 않는다');
  assert.deepEqual(out(gana.srcMails), ['Sent|107'], '외부 미검증 수신 메일(INBOX|207)이 정상 보낸메일 그룹의 srcMails 에 섞이지 않는다');
  const ganaUnv = synthRes.streams['unverified:가나기관|INBOX|207'];
  assert.ok(ganaUnv, '외부 미검증 발신자의 수신 메일은 별도 격리 스트림으로 분리');
  assert.equal(ganaUnv.companyId, '', '외부 미검증 발신자의 수신 메일은 기존 companyId 에 연결하지 않는다');
  assert.equal(ganaUnv.hasSigned, false);
  assert.equal(ganaUnv.targetStage, 'review');
  const noEmailUnv = synthRes.streams['unverified:미등록기업|INBOX|208'];
  assert.ok(noEmailUnv, '발신 이메일과 보낸 메일이 모두 없는 수신 계약서 메일도 미검증 스트림으로 격리');
  assert.equal(noEmailUnv.senderVerified, false);
  assert.equal(noEmailUnv.hasSigned, false);
  assert.equal(noEmailUnv.targetStage, 'review');

  /* 생산자(autoRequestContractFromPhoto) → 소비자(processPhotoContractRequest) 전 구간에서 발신 미검증 / lifecycle.targetStage=review 수신 메일이 알려진 유효 사업자번호(123-82-15423)를 담고 있어도 업체 연결·계약확정·기존 카드 병합이 모두 차단되는지 검증 */
  prodCtx.PuDocFile.init({
    db: {
      ref: (p) => ({
        once: () => Promise.resolve({
          val: () => {
            if (p.indexOf('companies') >= 0) return { v: { co1: { id: 'co1', name: '가나기관', bizNo: '123-82-15423', managerMain: 'P-005' } } };
            if (p.indexOf('user_dir') >= 0) return { v: USERS };
            return null;
          }
        }),
        set: (v) => { prodWrites[p] = v; return Promise.resolve(); },
        update: () => Promise.resolve()
      })
    }
  });
  const prodResUnv = await prodCtx.PuDocFile.autoRequestContractFromPhoto({
    id: 'ph-unv-207', year: '2026', owner: 'u1', by: '박재원',
    fields: { company: '가나기관', bizno: '123-82-15423', docName: '위임계약서', fee: '330만원' },
    mailMeta: {
      dir: 'recv', srcKey: 'INBOX|207',
      lifecycle: { targetStage: ganaUnv.targetStage, srcMails: ganaUnv.srcMails }
    }
  });
  assert.equal(prodResUnv.ok, true);
  assert.equal(prodResUnv.targetStatus, 'review', '생산자도 lifecycle.targetStage=review / senderVerified=false 이면 review 로 강등');
  const savedUnvReq = out(prodWrites['data/contract_requests/ctphoto-2026_ph-unv-207']);
  assert.equal(savedUnvReq.companyId, '', '미검증 수신 메일은 알려진 사업자번호가 적혀 있어도 companyId 를 잇지 않는다');
  assert.equal(savedUnvReq.company.bizNo, '', '미검증 수신 메일의 사업자번호는 요청에서 비워 소비자 재연결을 차단');
  assert.equal(savedUnvReq.senderVerified, false);
  mockCts = [card({ id: 'ct-gana-existing', companyId: 'co1', companyName: '가나기관', company: { name: '가나기관', bizNo: '123-45-67891' }, status: 'consult', kinds: ['consult'] })];
  const consResUnv = await ctx.run('k-unv-207', Object.assign({}, savedUnvReq, {
    company: { name: '가나기관', bizNo: '123-45-67891' }
  }));
  assert.ok(consResUnv.made);
  assert.notEqual(consResUnv.made.id, 'ct-gana-existing', '소비자에 직접 사업자번호가 전달되어도 기존 카드를 덮어쓰거나 승격하지 않는다');
  assert.equal(consResUnv.made.status, 'review', '소비자도 review 로 격리');
  assert.equal(consResUnv.made.companyId, '');
  assert.equal(consResUnv.made.bizNo, '');
  const sameDomUnv = synthRes.streams['unverified:가나기관|INBOX|209'];
  assert.ok(sameDomUnv && sameDomUnv.senderVerified === false && sameDomUnv.targetStage === 'review', '등록된 정확한 이메일 주소와 다른 동일 도메인 발신자도 자동 검증하지 않고 review 로 격리');
  const noRegEmailUnv = synthRes.streams['unverified:무이메일기업|INBOX|210'];
  assert.ok(noRegEmailUnv, '업체 등록 이메일이 비어 있으면 보낸메일 수신자와 같아도 수신 계약서는 미검증 격리');
  assert.equal(noRegEmailUnv.companyId, '');
  assert.equal(noRegEmailUnv.senderVerified, false);
  assert.equal(noRegEmailUnv.hasSigned, false);
  assert.equal(noRegEmailUnv.targetStage, 'review');
  assert.deepEqual(out(synthRes.groups['무이메일기업'].srcMails), ['Sent|108'], '미검증 수신 계약서가 보낸메일 그룹과 합쳐지지 않는다');
  assert.equal(prodCtx.PuDocFile.parseOneEmailAddr('hr@basa.example..'), null, '끝에 점(..)이 붙은 잘못된 이메일 주소는 정상 등록 주소로 보정하지 않고 거부');
  assert.equal(prodCtx.PuDocFile.parseOneEmailAddr('<hr@basa.example>..'), null, '닫는 꺾쇠(>) 뒤에 문자가 붙은 잘못된 이메일 주소도 거부');
  assert.equal(synthRes.verifiedBySrcKey['INBOX|211'], false, '잘못된 형식의 이메일(hr@basa.example..)은 senderVerified=false');
  assert.equal(synthRes.bySrcKey['INBOX|211'].targetStage, 'review');
  assert.equal(synthRes.verifiedBySrcKey['INBOX|212'], false, '미등록 업체에 보낸메일 이력이 있어도 수신 계약서는 미검증(review)으로 격리');
  assert.equal(synthRes.bySrcKey['INBOX|212'].targetStage, 'review');
  assert.equal(synthRes.verifiedBySrcKey['INBOX|213'], false, 'A업체 도메인의 미등록 발신자가 제목에 [B업체(바사테크)]를 넣어도 B업체의 signed 그룹을 승계하지 않는다');
  assert.equal(synthRes.bySrcKey['INBOX|213'].senderVerified, false);
  assert.equal(synthRes.bySrcKey['INBOX|213'].targetStage, 'review');
  assert.equal(synthRes.bySrcKey['INBOX|213'].companyId, '');

  /* pullMailContracts 스캐너 회귀검사: A업체 도메인(gana.example) 미등록 발신자가 제목에 [바사테크(B업체)]를 넣은 메일(INBOX|213)은 B업체에 기존 signed 그룹(INBOX|201)이 있어도 신뢰를 승계하지 않고 수집 대상에서 제외된다 */
  prodCtx.firebase = { auth: () => ({ currentUser: { uid: 'u1', getIdToken: () => Promise.resolve('tok-1') } }) };
  prodCtx.PuDocPick = { 계약서인가: () => true, 이름갈래: () => '계약서' };
  prodCtx.atob = (s) => Buffer.from(s, 'base64').toString('binary');
  prodCtx.Uint8Array = Uint8Array;
  prodCtx.Blob = Blob;
  prodCtx.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: true, atts: [{ name: '위임계약서.pdf', part: '2' }], b64: 'dGVzdA==', name: '위임계약서.pdf' })
  });
  prodCtx.PuDocFile.init({
    db: {
      ref: (p) => ({
        limitToLast: () => ({
          once: () => Promise.resolve({
            val: () => {
              if (p === 'mailbox/msgs/Sent') {
                return { '101': { u: '101', d: Date.now(), t: 'hr@basa.example', s: '[푸른노무법인] 바사테크 컨설팅 견적서 송부', an: ['견적서_바사테크.pdf'] } };
              }
              if (p === 'mailbox/msgs/INBOX') {
                return {
                  '201': { u: '201', d: Date.now(), e: 'hr@basa.example', s: '[바사테크] 위임계약서 날인본 회신', a: 1, an: ['위임계약서_바사테크_날인.pdf'] },
                  '213': { u: '213', d: Date.now(), e: 'other@gana.example', s: '[바사테크] 위임계약서 회신', a: 1, an: ['위임계약서_바사테크.pdf'] }
                };
              }
              return {};
            }
          })
        }),
        once: () => Promise.resolve({
          val: () => {
            if (p === 'mailbox/folders') return { Sent: { kind: 'sent' }, INBOX: { kind: 'inbox' } };
            if (p.indexOf('companies') >= 0) {
              return {
                v: {
                  coGana: { id: 'coGana', name: '가나기관', status: 'active', email: 'kim@gana.example', managerMain: 'P-005' },
                  coBasa: { id: 'coBasa', name: '바사테크', status: 'active', email: 'hr@basa.example', bizNo: '123-82-15423', managerMain: 'P-005' }
                }
              };
            }
            if (p.indexOf('user_dir') >= 0) return { v: USERS };
            return {};
          }
        }),
        set: (v) => { prodWrites[p] = v; return Promise.resolve(); },
        update: (v) => { Object.assign(prodWrites, v); return Promise.resolve(); }
      })
    }
  });
  const pullRes = await prodCtx.PuDocFile.pullMailContracts({ maxPull: 10 });
  const pulledSrcKeys = pullRes.pulled.map(x => x.srcKey);
  assert.deepEqual(out(pulledSrcKeys), ['INBOX|201'], '검증된 등록 이메일(hr@basa.example)의 INBOX|201 만 당겨오고, 타 도메인 미등록 발신자의 [바사테크] 사칭 메일(INBOX|213)은 수집하지 않는다');

  /* 업체 간 신뢰 전이(Cross-Company Trust Confusion) 차단: 발신 검증된 A업체(coGana) 메일 첨부 계약서에 B업체(coBasa) 상호·유효 사업자번호가 적혀 있어도 B업체 계약을 signed 로 확정·연결하지 않는다 */
  await prodCtx.PuDocFile.autoRequestContractFromPhoto({
    id: 'ph-cross-co', year: '2026', owner: 'u1', by: '박재원',
    fields: { company: '바사테크', bizno: '123-82-15423', docName: '위임계약서', fee: '330만원' },
    mailMeta: {
      dir: 'recv', senderVerified: true, srcKey: 'INBOX|555',
      companyId: 'coGana', companyName: '가나기관',
      lifecycle: { targetStage: 'signed', senderVerified: true, srcMails: ['INBOX|555'] }
    }
  });
  const savedCrossCo = out(prodWrites['data/contract_requests/ctphoto-2026_ph-cross-co']);
  assert.equal(savedCrossCo.targetStatus, 'review', '발신 검증된 업체(coGana)와 계약서 대상 업체(바사테크/coBasa)가 다르면 review 로 격리');
  assert.equal(savedCrossCo.companyId, '');
  assert.equal(savedCrossCo.company.bizNo, '');
  mockCts = [card({ id: 'existing-probe', companyId: 'co1', companyName: '가나기관', company: { name: '가나기관', bizNo: '123-45-67891' }, status: 'consult', kinds: ['consult'] })];
  const consCrossCo = await ctx.run('k-cross-co', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', senderVerified: true, managerMain: 'P-005',
    mailMeta: {
      dir: 'recv', senderVerified: true, srcKey: 'INBOX|555',
      companyId: 'coBasa', companyName: '바사테크',
      lifecycle: { targetStage: 'signed', senderVerified: true, srcMails: ['INBOX|555'] }
    },
    company: { name: '가나기관', bizNo: '123-45-67891' },
    contractFields: { docName: '위임계약서', fee: '330만원' }
  });
  assert.notEqual(consCrossCo.made.id, 'existing-probe', '소비자도 mailMeta 업체와 계약서 대상 업체가 다르면 기존 카드를 병합하지 않는다');
  assert.equal(consCrossCo.made.status, 'review');
  assert.equal(consCrossCo.made.companyId, '');
  assert.equal(consCrossCo.made.bizNo, '');

  /* senderVerified/lifecycle 누락된 수신메일(mailMeta={dir:recv,srcKey:INBOX|999}) 및 targetStatus=review 단독 요청도 유효 사업자번호로 업체 연결·기존 카드 병합·signed 승격되지 않는다 */
  await prodCtx.PuDocFile.autoRequestContractFromPhoto({
    id: 'ph-bare-recv', year: '2026', owner: 'u1', by: '박재원',
    fields: { company: '가나기관', bizno: '123-82-15423', docName: '위임계약서', fee: '330만원' },
    mailMeta: { dir: 'recv', srcKey: 'INBOX|999' }
  });
  const savedBareRecv = out(prodWrites['data/contract_requests/ctphoto-2026_ph-bare-recv']);
  assert.equal(savedBareRecv.targetStatus, 'review');
  assert.equal(savedBareRecv.companyId, '');
  assert.equal(savedBareRecv.company.bizNo, '');
  mockCts = [card({ id: 'existing-probe', companyId: 'co1', companyName: '가나기관', company: { name: '가나기관', bizNo: '123-45-67891' }, status: 'consult', kinds: ['consult'] })];
  const consBareRecv = await ctx.run('k-bare-recv', {
    source: 'photo_contract', state: 'pending', managerMain: 'P-005',
    mailMeta: { dir: 'recv', srcKey: 'INBOX|999' },
    company: { name: '가나기관', bizNo: '123-45-67891' },
    contractFields: { docName: '위임계약서', fee: '330만원' }
  });
  assert.notEqual(consBareRecv.made.id, 'existing-probe', '검증 메타데이터가 누락된 수신 메일은 기존 카드를 병합하지 않는다');
  assert.equal(consBareRecv.made.status, 'review');
  assert.equal(consBareRecv.made.companyId, '');
  assert.equal(consBareRecv.made.bizNo, '');
  mockCts = [card({ id: 'existing-probe', companyId: 'co1', companyName: '가나기관', company: { name: '가나기관', bizNo: '123-45-67891' }, status: 'consult', kinds: ['consult'] })];
  const consReviewOnly = await ctx.run('k-review-only', {
    source: 'photo_contract', state: 'pending', targetStatus: 'review', managerMain: 'P-005',
    company: { name: '가나기관', bizNo: '123-45-67891' },
    contractFields: { docName: '위임계약서', fee: '330만원' }
  });
  assert.notEqual(consReviewOnly.made.id, 'existing-probe', 'targetStatus=review 단독 요청도 기존 consult 카드를 병합하거나 companyId 를 잇지 않는다');
  assert.equal(consReviewOnly.made.status, 'review');
  assert.equal(consReviewOnly.made.companyId, '');
  assert.equal(consReviewOnly.made.bizNo, '');
  const basa = synthRes.groups['바사테크'];
  assert.ok(basa && !basa.excluded, '미중복 진행 사업장은 제외되지 않는다');
  assert.equal(basa.targetStage, 'signed');
  assert.equal(basa.inferredKind, 'consulting');
  assert.deepEqual(out(basa.srcMails), ['Sent|101', 'Sent|102', 'INBOX|201']);
  assert.match(basa.synthesizedNote, /①보낸견적서 → ②보낸계약서양식 → ③체결계약서회신/);

  /* 종료 사업장·중복 건은 erpQuoteLanePlan 과 processPhotoContractRequest 에서도 noop 처리 */
  assert.equal(P.erpQuoteLanePlan(req({ companyId: 'co1' }), [Object.assign({}, CO, { status: 'closed' })], [], USERS).action, 'noop');
  assert.equal(P.erpQuoteLanePlan(req({ isDuplicateInErp: true }), [CO], [], USERS).action, 'noop');
  const rClosedPhoto = await ctx.run('k-closed-photo', {
    source: 'photo_contract', state: 'pending', companyClosed: true, managerMain: 'P-005',
    company: { name: '종료상사', bizNo: '123-45-67891' }, contractFields: { docName: '자문계약서' }
  });
  assert.match(rClosedPhoto.noop, /종료된 사업장/);

  /* 연결 보류 상담접수/계약협의 카드(사업자번호 미기재)가 있을 때 같은 메일 생애주기(srcMails 공유) + 유효 10자리 사업자번호가 확인된 신규 체결 계약서가 들어오면 같은 카드를 계약확정(signed)으로 승격하고 생애주기 이력을 합친다 */
  mockCts = [card({
    id: 'ct-basa-open', companyId: '', companyLinkStatus: 'pending',
    companyName: '바사테크', company: { name: '바사테크', bizNo: '' },
    status: 'review', kinds: ['consult'], srcMails: ['Sent|101', 'Sent|102'],
    note: '📧 견적서·계약서 양식 발송'
  })];
  calls.persist.length = 0;
  const rPromote = await ctx.run('k-basa-signed', {
    source: 'photo_contract', state: 'pending', targetStatus: 'signed', managerMain: 'P-005',
    srcKey: 'INBOX|201', srcMails: basa.srcMails, synthesizedNote: basa.synthesizedNote,
    company: { name: '바사테크', bizNo: '123-82-15423' },
    contractFields: { docName: '위임계약서', scope: '취업규칙 변경 및 노무컨설팅', fee: '330만원(부가세 포함)', signDate: '2026-10-25' }
  });
  assert.ok(rPromote.made);
  assert.equal(rPromote.made.id, 'ct-basa-open', '새 카드를 중복 생성하지 않고 기존 카드를 승격');
  assert.equal(rPromote.made.status, 'signed', '계약확정(signed)으로 자동 승격');
  assert.equal(rPromote.made.bizNo, '123-82-15423', '체결 계약서의 검증된 사업자번호 반영');
  assert.deepEqual(out(rPromote.made.srcMails), ['Sent|101', 'Sent|102', 'INBOX|201']);
  assert.match(rPromote.made.note, /①보낸견적서 → ②보낸계약서양식 → ③체결계약서회신/);
});
