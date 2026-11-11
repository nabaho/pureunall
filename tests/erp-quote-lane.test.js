'use strict';
/* 견적 길 요청(kind:'quote'·'advance') — 이알피 쪽 (견적·계약 자동화 계획 3 · 작업 2, 2026-11-08)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 회사·사람은 전부 지어낸 것이다.
 *
 * ■ 못 박는 것 (Review Focus)
 *   ① 같은 메일을 두 번 반영하지 않는다(카드의 srcMails → noop).
 *   ② 사업장은 요청이 «가리키는» companyId 로만 잇는다 — 이름이 같아도 이름으로 업체 ID 를 채우지 않는다(blocked).
 *      사람이 «연결 보류»를 켠 요청만 이름 그대로 연결 보류 카드로 만든다.
 *   ③ 같은 사업장에 진행 중(상담접수·계약협의) 카드가 있으면 새로 안 만들고 덧붙인다 · 둘 이상이면 사람이 고른다 ·
 *      이미 계약확정된 사업장은 «재계약일 수 있음»을 적은 새 카드.
 *   ④ 금액은 요청에도 카드에도 없다(요청에 amount 가 섞여 와도 카드·메모로 새지 않는다).
 *   ⑤ 주담당은 직원 명부의 사번일 때만 — 모르면 blocked.
 *   ⑥ 저장은 «기존 문»(persistOne·patchOne·월 잠금)이 한다 — 막히면 요청을 지우지 않고 blocked + 까닭을 남긴다.
 *   ⑦ 계약 진행 신호(advance)는 «상담접수 카드가 하나일 때만» 계약협의로 옮긴다.
 * 소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

const PURE = ['function erpQuoteLaneReq(', 'function erpQuoteDay(', 'function erpQuoteNote(', 'function erpQuoteLanePlan(',
  'function erpBlankContractForm(', 'function erpSameCompany(', 'function erpCoAddrKey('].map((d) => cutFn(SRC, d)).join('\n');

function pure() {
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, todayYMD: () => '2026-11-08' };
  vm.createContext(ctx);
  vm.runInContext(PURE + '\nthis.api={erpQuoteLaneReq,erpQuoteDay,erpQuoteNote,erpQuoteLanePlan};', ctx);
  return ctx.api;
}
const P = pure();
const out = (v) => JSON.parse(JSON.stringify(v));

const USERS = [{ sid: 'P-005', name: '담당가' }, { sid: 'A-001', name: '담당나' }];
const CO = { id: 'co1', name: '가나기관', bizNo: '1234567890', ceo: '홍길동', address: '충남 가나시 다라로 1', phone: '041-000-0000' };
const AT = Date.parse('2026-10-26T18:23:00+09:00');
const req = (o) => Object.assign({ kind: 'quote', state: 'pending', srcKey: 'Sent|1001', subject: '[푸른노무법인] 가나기관 컨설팅 견적서 송부의 건',
  docKind: 'quote', atts: ['견적서_가나기관.pdf'], to: ['kim@gana.example'], at: AT, companyId: 'co1', managerMain: 'P-005', by: 'server' }, o || {});
const card = (o) => Object.assign({ id: 'ct-1', contractNo: '계약-2026-001', companyName: '가나기관', status: 'consult', kinds: ['consult'],
  company: { name: '가나기관', bizNo: '1234567890' }, note: '' }, o || {});

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
  assert.equal(p.action, 'blocked');
  assert.match(p.why, /사업장을 못 찾았습니다/);
  const none = P.erpQuoteLanePlan(req({ companyId: '', companyName: '' }), [CO], [], USERS);
  assert.equal(none.action, 'blocked');
  assert.match(none.why, /사업장을 정해 주세요/);
  const gone = P.erpQuoteLanePlan(req({ companyId: 'zzz' }), [CO], [], USERS);
  assert.equal(gone.action, 'blocked');
  assert.match(gone.why, /가리키는 업체가 업체관리에 없습니다/);
  const dead = P.erpQuoteLanePlan(req(), [Object.assign({}, CO, { _deleted: true })], [], USERS);
  assert.equal(dead.action, 'blocked', '지운 업체로는 잇지 않는다');
});

test('③ 사람이 «연결 보류»를 켠 요청만 이름 그대로 연결 보류 카드로 만든다', () => {
  const p = P.erpQuoteLanePlan(req({ companyId: '', companyName: '다라상사', deferLink: true }), [CO], [], USERS);
  assert.equal(p.action, 'create');
  assert.equal(p.form.company.name, '다라상사');
  assert.ok(!p.form.companyId, '업체 ID 를 채우지 않는다');
  assert.equal(p.form.status, 'consult');
});

test('④ 업체를 이은 요청 → 상담접수 카드(kinds consult) — 업체 정보는 업체관리에서, 금액은 0', () => {
  const p = P.erpQuoteLanePlan(req(), [CO], [], USERS);
  assert.equal(p.action, 'create');
  const f = out(p.form);
  assert.deepEqual(f.kinds, ['consult']);
  assert.equal(f.status, 'consult');
  assert.equal(f.companyId, 'co1');
  assert.equal(f.company.companyId, 'co1');
  assert.equal(f.company.name, '가나기관');
  assert.equal(f.company.bizNo, '1234567890');
  assert.equal(f.managerMain, 'P-005');
  assert.deepEqual(f.srcMails, ['Sent|1001']);
  assert.ok(Object.keys(f.amounts).every((k) => f.amounts[k] === 0), '금액 칸은 모두 0');
  assert.equal(f.successFee, 0);
  assert.match(f.note, /견적서 송부 2026-10-26/);
  assert.match(f.note, /첨부: 견적서_가나기관\.pdf/);
});

test('⑤ ★ 금액은 요청에 섞여 와도 카드·메모로 새지 않는다', () => {
  const p = P.erpQuoteLanePlan(Object.assign(req(), { amount: 5000000, 금액: '4,000,000원', amounts: { consulting: 5000000 }, successFee: 777 }), [CO], [], USERS);
  const j = JSON.stringify(out(p.form));
  assert.ok(!/5000000|4,000,000|777/.test(j), '금액이 카드에 들어갔다: ' + j.slice(0, 200));
  assert.ok(!/5000000|4,000,000/.test(P.erpQuoteNote(Object.assign(req(), { amount: 5000000, subject: '견적서 송부' }))));
});

test('⑥ 주담당은 직원 명부의 사번일 때만 — 모르면 blocked', () => {
  const a = P.erpQuoteLanePlan(req({ managerMain: '' }), [CO], [], USERS);
  assert.equal(a.action, 'blocked'); assert.match(a.why, /담당자를 정해 주세요/);
  const b = P.erpQuoteLanePlan(req({ managerMain: '홍길동' }), [CO], [], USERS);
  assert.equal(b.action, 'blocked', '이름으로 사번을 채우지 않는다'); assert.match(b.why, /직원 명부에 없습니다/);
});

test('⑦ 같은 메일은 두 번 반영하지 않는다 — 카드의 srcMails 에 있으면 noop', () => {
  const p = P.erpQuoteLanePlan(req(), [CO], [card({ srcMails: ['Sent|1001'] })], USERS);
  assert.equal(p.action, 'noop');
  const del = P.erpQuoteLanePlan(req(), [CO], [card({ srcMails: ['Sent|1001'], _deleted: true })], USERS);
  assert.equal(del.action, 'create', '지운 카드의 기록은 세지 않는다');
});

test('⑧ 같은 사업장에 진행 중 카드가 하나면 덧붙이고, 둘 이상이면 사람이 고르고, 확정만 있으면 재계약 카드', () => {
  const one = P.erpQuoteLanePlan(req(), [CO], [card()], USERS);
  assert.equal(one.action, 'attach'); assert.equal(one.target.id, 'ct-1'); assert.match(one.note, /견적서 송부/);
  const review = P.erpQuoteLanePlan(req(), [CO], [card({ status: 'review' })], USERS);
  assert.equal(review.action, 'attach', '계약협의 카드에도 덧붙인다');
  const two = P.erpQuoteLanePlan(req(), [CO], [card(), card({ id: 'ct-2', contractNo: '계약-2026-002' })], USERS);
  assert.equal(two.action, 'blocked'); assert.match(two.why, /2건/);
  const signed = P.erpQuoteLanePlan(req(), [CO], [card({ status: 'signed' })], USERS);
  assert.equal(signed.action, 'create'); assert.match(signed.form.note, /재계약일 수 있음/);
  const other = P.erpQuoteLanePlan(req(), [CO], [card({ companyName: '마바상사', company: { name: '마바상사', bizNo: '9999999999' } })], USERS);
  assert.equal(other.action, 'create', '다른 사업장 카드는 건드리지 않는다');
});

test('⑨ 계약 진행 신호(advance) — 상담접수 카드가 «하나일 때만» 계약협의로', () => {
  const adv = (o) => req(Object.assign({ kind: 'advance', docKind: 'contract', subject: '[푸른노무법인] 자문계약서 송부의 건' }, o || {}));
  assert.equal(P.erpQuoteLanePlan(adv(), [CO], [card()], USERS).action, 'advance');
  const two = P.erpQuoteLanePlan(adv(), [CO], [card(), card({ id: 'ct-2' })], USERS);
  assert.equal(two.action, 'blocked'); assert.match(two.why, /2건/);
  assert.equal(P.erpQuoteLanePlan(adv(), [CO], [card({ status: 'review' })], USERS).action, 'noop', '이미 계약협의면 아무것도 안 한다');
  assert.equal(P.erpQuoteLanePlan(adv(), [CO], [card({ status: 'signed' })], USERS).action, 'noop');
  const none = P.erpQuoteLanePlan(adv(), [CO], [], USERS);
  assert.equal(none.action, 'blocked'); assert.match(none.why, /상담접수 카드가 없습니다/);
  /* 계약 id 를 가리키면 그 카드만 본다 */
  assert.equal(P.erpQuoteLanePlan(adv({ contractId: 'ct-9' }), [CO], [card({ id: 'ct-9' }), card({ id: 'ct-8' })], USERS).target.id, 'ct-9');
  assert.equal(P.erpQuoteLanePlan(adv({ contractId: 'ct-9' }), [CO], [card({ id: 'ct-9', status: 'review' })], USERS).action, 'noop');
  assert.equal(P.erpQuoteLanePlan(adv({ contractId: 'nope' }), [CO], [card()], USERS).action, 'blocked');
  /* 업체가 안 이어진 신호는 업체를 지어내지 않는다 */
  assert.equal(P.erpQuoteLanePlan(adv({ companyId: '', companyName: '' }), [CO], [card()], USERS).action, 'blocked');
});

test('알 수 없는 종류는 blocked — 던지지 않는다', () => {
  assert.equal(P.erpQuoteLanePlan({ kind: 'confirm' }, [CO], [], USERS).action, 'blocked');
  assert.equal(P.erpQuoteLanePlan(null, null, null, null).action, 'blocked');
});

/* ── 저장하는 쪽(processQuoteLaneRequest) — 기존 문(persistOne·patchOne)을 지난다 ── */
const WRAP = cutFn(SRC, 'async function processQuoteLaneRequest(');
function wrap(env) {
  const calls = { update: [], remove: 0, persist: [], patch: [] };
  const ctx = Object.assign({
    console, Date, Object, Array, String, Number, JSON, Math, Promise,
    fbDb: { ref: () => ({ update: (v) => { calls.update.push(v); return Promise.resolve(); }, remove: () => { calls.remove++; return Promise.resolve(); } }) },
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
  return { run: ctx.run, calls };
}

test('⑩ 만든다 — persistOne 을 지나고, 요청은 지운다 · 계약번호는 기존 번호 길(genContractNo)', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [] } });
  const r = await w.run('k1', req());
  assert.ok(r.made); assert.equal(r.lane, 'quote');
  assert.equal(w.calls.persist.length, 1);
  assert.equal(w.calls.persist[0].contractNo, '계약-2026-196');
  assert.equal(w.calls.persist[0].status, 'consult');
  assert.ok(w.calls.persist[0].id.startsWith('ct-'));
  assert.equal(w.calls.remove, 1, '반영한 요청은 지운다');
});

test('⑪ ★ 저장이 막히면 요청을 «지우지 않고» blocked + 까닭을 남긴다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [] }, persistOk: false });
  const r = await w.run('k1', req());
  assert.ok(!r.made); assert.match(r.why, /저장을 막았습니다/);
  assert.equal(w.calls.remove, 0);
  assert.equal(w.calls.update[0].state, 'blocked');
  assert.match(w.calls.update[0].why, /저장을 막았습니다/);
});

test('⑫ 계획이 blocked 면 저장하지 않고 요청에 까닭을 적는다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [] } });
  const r = await w.run('k1', req({ managerMain: '' }));
  assert.match(r.why, /담당자를 정해 주세요/);
  assert.equal(w.calls.persist.length, 0); assert.equal(w.calls.remove, 0);
  assert.equal(w.calls.update[0].state, 'blocked');
});

test('⑬ 월 잠금이 걸린 달에는 만들지 않는다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [] }, lockedYm: '2026-11' });
  const r = await w.run('k1', req());
  assert.match(r.why, /잠겨 있어/);
  assert.equal(w.calls.persist.length, 0);
});

test('⑭ 덧붙인다 — 기존 카드에 메모와 srcMails 를 더해 persistOne 으로 저장한다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [card({ note: '먼저 적은 메모' })] } });
  const r = await w.run('k1', req());
  assert.ok(r.attached);
  const saved = w.calls.persist[0];
  assert.equal(saved.id, 'ct-1');
  assert.match(saved.note, /^먼저 적은 메모\n\n📧/);
  assert.deepEqual(out(saved.srcMails), ['Sent|1001']);
  assert.equal(w.calls.remove, 1);
});

test('⑮ 계약협의로 옮긴다 — patchOne(status review) 한 번, 새 카드는 안 만든다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [card()] } });
  const r = await w.run('k1', req({ kind: 'advance', docKind: 'contract' }));
  assert.ok(r.advanced);
  assert.equal(w.calls.patch.length, 1);
  assert.equal(w.calls.patch[0].f.status, 'review');
  assert.equal(w.calls.persist.length, 0);
  assert.equal(w.calls.remove, 1);
  const w2 = wrap({ data: { companies: [CO], contracts: [card()] }, patchOk: false });
  const r2 = await w2.run('k1', req({ kind: 'advance', docKind: 'contract' }));
  assert.match(r2.why, /저장을 막았습니다/); assert.equal(w2.calls.remove, 0);
});

test('⑯ 연결 보류 요청은 «같은 문»(erpDeferCoLinkIfNew)으로 연결 보류 카드를 만든다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [] } });
  const r = await w.run('k1', req({ companyId: '', companyName: '다라상사', deferLink: true }));
  assert.ok(r.made);
  assert.equal(w.calls.persist[0].companyLinkStatus, 'pending');
  assert.equal(w.calls.persist[0].company.name, '다라상사');
});

test('⑰ 이미 반영한 메일은 요청만 지우고 아무것도 저장하지 않는다', async () => {
  const w = wrap({ data: { companies: [CO], contracts: [card({ srcMails: ['Sent|1001'] })] } });
  const r = await w.run('k1', req());
  assert.ok(r.noop);
  assert.equal(w.calls.persist.length, 0); assert.equal(w.calls.patch.length, 0); assert.equal(w.calls.remove, 1);
});

/* ── 길 연결: 사진첩 길은 그대로, 견적 길만 갈라 보낸다 ── */
test('⑱ processOneContractRequest 가 견적 길을 먼저 가르고, 사진첩·중진공 요청의 문턱(ctReqWhy)은 그대로다', () => {
  const body = cutFn(SRC, 'async function processOneContractRequest(');
  assert.match(body, /if\(erpQuoteLaneReq\(req\)\) return await processQuoteLaneRequest\(key, req\)/);
  assert.match(body, /ctReqWhy\(form\)/, '사진첩 길의 문턱 검사가 그대로 있다');
  const why = cutFn(SRC, 'function ctReqWhy(');
  assert.match(why, /사업자번호가 없습니다/, '사진첩 길은 사업자번호가 없으면 여전히 막는다');
});

test('⑲ runContractRequests — 견적 길 요청은 «업체·계약을 가리킬 때만» 돌리고, 결과를 사진첩 길과 따로 센다', () => {
  const body = cutFn(SRC, 'async function runContractRequests(');
  assert.match(body, /erpQuoteLaneReq\(r\)\) return !!\(r\.companyId \|\| r\.contractId \|\| r\.companyName\)/);
  assert.match(body, /madeQ|doneQ|blockedQ/);
  assert.match(body, /견적·계약 메일에서 온 요청/);
});

/* ── 걸린 요청 창: 견적 길 요청에서 «사람이 풀 수 있는» 칸이 뜬다 ── */
function h(tag, props, ...kids) { return { tag, props: props || {}, kids: kids.flat(Infinity).filter((k) => k !== false && k != null) }; }
function text(n) { return typeof n === 'object' ? n.kids.map(text).join('') : String(n); }
function find(n, pred, o = []) { if (n && typeof n === 'object') { if (pred(n)) o.push(n); n.kids.forEach((k) => find(k, pred, o)); } return o; }

test('⑳ 걸린 요청 창 — 견적 길 요청은 담당자 고르기·연결 보류 칸을 보이고, 사진첩 요청은 컨설팅 유형 줄을 그대로 보인다', () => {
  const MODAL = [cutFn(SRC, 'function BlockedRequestsModal('), cutFn(SRC, 'function erpQuoteLaneReq(')].join('\n');
  const patches = [];
  const ctx = { console, Date, Object, Array, String, Number, JSON, h, useEscClose: () => {} };
  vm.createContext(ctx);
  vm.runInContext(MODAL + '\nthis.M=BlockedRequestsModal;', ctx);
  const tree = ctx.M({ requests: [
    { _key: 'q1', kind: 'quote', state: 'blocked', why: '담당자를 정해 주세요', subject: '[푸른노무법인] 컨설팅 견적서 송부의 건', companyName: '다라상사', handledAt: 1 },
    { _key: 'p1', state: 'blocked', why: '사업자번호가 없습니다', company: { name: '가나상사' }, consultingType: 'x', handledAt: 2 },
  ], users: USERS, onPatchReq: (k, p) => patches.push([k, p]), consTypeName: () => '유형이름', onRetry() {}, onRemove() {}, onClose() {} });
  const t = text(tree);
  assert.match(t, /견적서 송부 · 메일 제목: 「\[푸른노무법인\] 컨설팅 견적서 송부의 건」/);
  assert.match(t, /컨설팅 유형: 유형이름/, '사진첩 요청은 그대로');
  const selects = find(tree, (n) => n.tag === 'select');
  assert.equal(selects.length, 1, '견적 길 요청 한 건에만 담당자 고르기');
  assert.equal(find(selects[0], (n) => n.tag === 'option').length, 1 + USERS.length);
  selects[0].props.onChange({ target: { value: 'A-001' } });
  assert.deepEqual(out(patches[0]), ['q1', { managerMain: 'A-001' }]);
  const defer = find(tree, (n) => n.tag === 'input' && n.props.type === 'checkbox');
  assert.equal(defer.length, 1);
  defer[0].props.onChange({ target: { checked: true } });
  assert.deepEqual(out(patches[1]), ['q1', { deferLink: true }]);
  assert.match(t, /업체관리에 없으면 연결 보류로 등록/);
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
  ].map((d) => cutFn(SRC, d)).join('\n');
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
  ctx.window = ctx; ctx.global = ctx; ctx.setTimeout = setTimeout;
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
        '100': { u: '100', d: Date.parse('2026-01-10T10:00:00+09:00'), s: '[푸른노무법인] 재계약기업 1차 컨설팅 견적서 송부', an: ['견적서_재계약기업_1차.pdf'] },
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
      coNoEmail: { id: 'coNoEmail', name: '무이메일기업', status: 'active', email: '' }
    },
    contracts: [
      { id: 'ct-dup', companyId: 'coDup', companyName: '중복기업', status: 'transferred', kinds: ['consulting'], srcMails: ['Sent|104'] },
      { id: 'ct-old', companyId: 'coRenew', companyName: '재계약기업', status: 'signed', kinds: ['consulting'], srcMails: ['Sent|100'], signDate: '2026-01-10' }
    ]
  });
  assert.equal(synthRes.groups['종료상사'].excluded, 'closed_company', '종료된 사업장은 자동 제외');
  assert.equal(synthRes.groups['해지테크'].excluded, 'closed_company', '계약 해지 통보 사업장은 자동 제외');
  assert.equal(synthRes.groups['중복기업'].excluded, 'duplicate', '이미 이관·반영된 중복 사업장은 자동 제외');
  assert.equal(synthRes.groups['재계약기업'].excluded, '', '과거 계약에 반영된 Sent|100 과 신규 Sent|105 가 함께 있어도 미반영 신규 메일(Sent|105)만 분리해 중복 제외하지 않는다');
  assert.deepEqual(out(synthRes.groups['재계약기업'].srcMails), ['Sent|105'], '이미 확정 계약에 들어간 과거 srcKey(Sent|100)는 제외하고 신규 srcKey 만 남긴다');
  assert.equal(synthRes.groups['복귀기업'].excluded, '', '과거 해지 이후 새로 발송된 견적서는 제외하지 않는다');
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

  /* 생산자(autoRequestContractFromPhoto) → 소비자(processPhotoContractRequest) 전 구간에서 발신 미검증 / lifecycle.targetStage=review 수신 메일이 알려진 유효 사업자번호(312-82-15421)를 담고 있어도 업체 연결·계약확정·기존 카드 병합이 모두 차단되는지 검증 */
  prodCtx.PuDocFile.init({
    db: {
      ref: (p) => ({
        once: () => Promise.resolve({
          val: () => {
            if (p.indexOf('companies') >= 0) return { v: { co1: { id: 'co1', name: '가나기관', bizNo: '312-82-15421', managerMain: 'P-005' } } };
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
    fields: { company: '가나기관', bizno: '312-82-15421', docName: '위임계약서', fee: '330만원' },
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
                  coBasa: { id: 'coBasa', name: '바사테크', status: 'active', email: 'hr@basa.example', bizNo: '312-82-15421', managerMain: 'P-005' }
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
    fields: { company: '바사테크', bizno: '312-82-15421', docName: '위임계약서', fee: '330만원' },
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
    fields: { company: '가나기관', bizno: '312-82-15421', docName: '위임계약서', fee: '330만원' },
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
    company: { name: '바사테크', bizNo: '312-82-15421' },
    contractFields: { docName: '위임계약서', scope: '취업규칙 변경 및 노무컨설팅', fee: '330만원(부가세 포함)', signDate: '2026-10-25' }
  });
  assert.ok(rPromote.made);
  assert.equal(rPromote.made.id, 'ct-basa-open', '새 카드를 중복 생성하지 않고 기존 카드를 승격');
  assert.equal(rPromote.made.status, 'signed', '계약확정(signed)으로 자동 승격');
  assert.equal(rPromote.made.bizNo, '312-82-15421', '체결 계약서의 검증된 사업자번호 반영');
  assert.deepEqual(out(rPromote.made.srcMails), ['Sent|101', 'Sent|102', 'INBOX|201']);
  assert.match(rPromote.made.note, /①보낸견적서 → ②보낸계약서양식 → ③체결계약서회신/);
});
