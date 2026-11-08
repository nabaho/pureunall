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
