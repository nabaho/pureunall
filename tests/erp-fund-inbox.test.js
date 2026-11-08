'use strict';
/* 기금 설립 «대기함» → 푸른이알피 계약관리 «가져오기 띠» — 이알피 쪽 (대표 승인 2026-11-07, 목업 B안)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금·회사·사람은 전부 지어낸 것이다.
 * 실행: node --test tests/erp-fund-inbox.test.js
 *
 * ■ 못 박는 것 — 깨지면 «잘못된 계약»이나 «유령 표시»가 조용히 생긴다
 *   ① 같은 후보로 계약이 둘 생기지 않는다(동시에 눌러도·표시를 못 적은 채 멈춰도).
 *   ② 주담당은 사람이 고른다 — 후보의 «이름»으로 사번을 채우지 않는다(온톨로지: 자동 ID 대입 금지).
 *   ③ 계약은 persistOne(월 잠금·업체 연결·주담당 검증)을 지난다. 막히면 «자리»를 돌려놓고 아무것도 안 남긴다.
 *   ④ 기금관리가 후보를 거둔(지운) 뒤에는 어떤 쓰기도 «유령»을 남기지 않는다.
 *   ⑤ 금액·수수료는 만들지 않는다. 계약협의 단계는 건드리지 않는다.
 *   ⑥ 🔔 반영은 사람이 눌렀을 때만 — 위로 올라간 것만 알린다.
 * 소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const CSS = fs.readFileSync(path.join(R, 'css/pu-erp.css'), 'utf8').replace(/\r\n/g, '\n');

function cutVar(src, name) {
  const i = src.indexOf('\nvar ' + name + ' =');
  assert.ok(i >= 0, 'var 을 못 찾음: ' + name);
  let j = i + 1, depth = 0;
  for (; j < src.length; j++) {
    const ch = src[j];
    if ('[{('.includes(ch)) depth++;
    else if (']})'.includes(ch)) depth--;
    else if (ch === ';' && depth === 0) break;
  }
  return src.slice(i + 1, j + 1);
}

/* ── ① 순수 함수·띠 그림: 진짜 소스를 떠서 돌린다 ── */
const PURE = [
  cutVar(SRC, 'ERP_FIB_PATH'), cutVar(SRC, 'ERP_FIB_CLAIM_TTL'), cutVar(SRC, 'ERP_FIB_STAGE'), cutVar(SRC, 'ERP_FIB_TYPE_BY_FUND'),
  ...['function erpFibTaken(', 'function erpFibEntries(', 'function erpFibByNewest(', 'function erpFibPending(',
    'function erpFibIgnored(', 'function erpFibNotices(', 'function erpFibForm(', 'function erpFibMatches(',
    'function ErpFundInboxStrip(',
    // 진짜 의존 함수 — 대역으로 갈아 끼우면 검사가 공허해진다
    'function erpBlankContractForm(', 'function erpContractDupBlock(', 'function erpSameCompany(', 'function erpCoAddrKey(',
    'function briefTrim(', 'function contractStatusInfo(', 'function erpNoteWorth(',
  ].map((d) => cutFn(SRC, d)),
  cutVar(SRC, 'BRIEF_MAX'), cutVar(SRC, 'CONTRACT_STATUS'), cutVar(SRC, 'ERP_EMPTY_NOTE'),
].join('\n');

/* 아주 작은 그림 대역 — 나무(tree)로 받아 글자·단추를 센다 */
function h(tag, props, ...kids) { return { tag, props: props || {}, kids: kids.flat(Infinity).filter((k) => k !== false && k != null) }; }
function text(n) { return typeof n === 'object' ? n.kids.map(text).join('') : String(n); }
function find(n, pred, out = []) { if (n && typeof n === 'object') { if (pred(n)) out.push(n); n.kids.forEach((k) => find(k, pred, out)); } return out; }

function pure(extra) {
  const ctx = Object.assign({
    window: {}, console, Date, Object, Array, String, Number, JSON, Math, h,
    todayYMD: () => '2026-11-08',
    contractFormSubtypeFill: (f) => f, contractPerfSplit: () => false,   // 컨설팅 «성과추적» 갈래에서만 불린다 — 기금은 안 지난다
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    usePersistedState: (k, d) => [d, () => {}],
  }, extra || {});
  vm.createContext(ctx);
  vm.runInContext(PURE + '\nthis.api={erpFibTaken,erpFibPending,erpFibIgnored,erpFibNotices,erpFibForm,erpFibMatches,ErpFundInboxStrip,ERP_FIB_CLAIM_TTL};', ctx);
  return ctx.api;
}
const P = pure();
const NOW = 1_800_000_000_000;
const rec = (o) => Object.assign({ fundName: '예시사내근로복지기금', shortName: '예시1호', fundType: '사내', company: '예시전자',
  manager: '담당A', brief: '예시1호 설립 인가 신청', stage: 'consult', by: '담당A', createdAt: '2026-11-07', updatedAt: '2026-11-07' }, o || {});

test('① 가져올 후보 — 무시한 것·가져간 것·방금 잡은 것은 빼고, 멈춘 흔적(5분 넘음)은 다시 올린다', () => {
  const all = {
    a: rec({ createdAt: '2026-11-05' }),
    b: rec({ createdAt: '2026-11-07' }),
    ign: rec({ ignored: { at: 'x', bySid: 's1' } }),
    got: rec({ erp: { contractId: 'ct-1', contractNo: '계약-2026-001' } }),
    fresh: rec({ erp: { claimedAt: NOW - 60 * 1000, bySid: 's1' } }),
    stale: rec({ erp: { claimedAt: NOW - 6 * 60 * 1000, bySid: 's1' }, createdAt: '2026-11-06' }),
    junk: { nothing: 1 },
  };
  const ids = Array.from(P.erpFibPending(all, NOW).map((r) => r.fid));
  assert.deepEqual(ids, ['b', 'stale', 'a'], '최신순 · 무시·가져옴·방금 잡음·쓰레기 제외 · 멈춘 흔적 포함');
  assert.deepEqual(Array.from(P.erpFibIgnored(all, NOW).map((r) => r.fid)), ['ign']);
  assert.equal(P.erpFibIgnored({ x: rec({ ignored: { at: 'x' }, erp: { contractId: 'c' } }) }, NOW).length, 0, '가져간 것은 무시 목록에도 없다');
  assert.equal(P.erpFibPending(null, NOW).length, 0);
});

test('② 새 계약 서식 — 주담당은 «넘겨 준 사번»뿐, 후보의 이름으로 안 채운다 · 금액은 비어 있다', () => {
  const f = P.erpFibForm(rec({ manager: '담당A' }), 'fund-1', '', []);
  assert.equal(f.managerMain, '', '★ 이름(담당A)으로 사번을 채우면 «자동 ID 대입 금지» 위반 — 사람이 고른다');
  const g = P.erpFibForm(rec(), 'fund-1', 'S100', []);
  assert.equal(g.managerMain, 'S100');
  assert.deepEqual([...g.kinds], ['fund']);
  assert.equal(g.status, 'consult');
  assert.equal(P.erpFibForm(rec({ stage: 'signed' }), 'f', 'S1', []).status, 'signed');
  assert.equal(P.erpFibForm(rec({ stage: '엉뚱' }), 'f', 'S1', []).status, 'consult', '모르는 상태는 상담접수 — 계약협의는 이알피에서만 쓴다');
  assert.equal(g.fundInboxId, 'fund-1');
  assert.equal(g.company.name, '예시전자');
  assert.equal(g.companyName, '예시전자');
  assert.ok(!g.companyId && !g.companyLinkStatus, '업체 ID 를 이름으로 채우지 않는다(연결 보류는 저장 직전 규칙이 정한다)');
  assert.ok(g.briefs.fund && g.briefs.fund.length <= 40);
  assert.equal(P.erpFibForm(rec({ brief: '가'.repeat(80) }), 'f', 'S1', []).briefs.fund.length, 40, '업무 요약 40자');
  Object.values(g.amounts).forEach((v) => assert.equal(v, 0, '금액은 후보에 없다'));
  assert.equal(g.successFee, 0);
  assert.ok(g.note.includes('예시사내근로복지기금') && g.note.includes('담당A'), '출처(기금 이름·기금관리 담당)는 메모에 남긴다');
});

test('②-2 기금 유형은 «지금 유형표에 있는 것»만 — 숨기거나 지운 유형을 찍지 않는다', () => {
  const types = [{ code: 'fund-single', name: '사내근로복지기금' }, { code: 'fund-joint', name: '공동형기금', hidden: true }];
  assert.equal(P.erpFibForm(rec({ fundType: '사내' }), 'f', 'S1', types).typeCodes.fund, 'fund-single');
  assert.equal(P.erpFibForm(rec({ fundType: '공동' }), 'f', 'S1', types).typeCodes.fund, '', '숨긴 유형');
  assert.equal(P.erpFibForm(rec({ fundType: '연합' }), 'f', 'S1', types).typeCodes.fund, '', '모르는 유형은 사람이 고른다');
  assert.equal(P.erpFibForm(rec({ fundType: '사내' }), 'f', 'S1', []).typeCodes.fund, '', '유형표에 없음');
});

test('③ 같은 업체의 기금 계약 — 다른 기금 후보로 만든 계약·다른 종류·종료된 계약은 «같은 건»이 아니다', () => {
  const form = P.erpFibForm(rec(), 'fund-1', '', []);
  const ct = (o) => Object.assign({ id: 'c', contractNo: '계약-2026-001', companyName: '예시전자', company: { name: '예시전자' }, kinds: ['fund'], status: 'consult' }, o || {});
  const m = P.erpFibMatches(form, 'fund-1', [
    ct({ id: 'same' }),
    ct({ id: 'other-fund', fundInboxId: 'fund-2' }),
    ct({ id: 'mine', fundInboxId: 'fund-1' }),
    ct({ id: 'case', kinds: ['case'] }),
    ct({ id: 'closed', status: 'closed' }),
    ct({ id: 'del', _deleted: true }),
    ct({ id: 'elsewhere', companyName: '다른회사', company: { name: '다른회사' } }),
  ]).map((c) => c.id);
  assert.deepEqual(Array.from(m).sort(), ['mine', 'same']);
});

test('⑥ 🔔 알림 — 기금관리가 «계약확정»으로 올린 것만, 계약이 아직 상담접수·계약협의일 때만', () => {
  const e = (o) => Object.assign({ contractId: 'ct-1', contractNo: '계약-2026-001' }, o || {});
  const cts = [{ id: 'ct-1', status: 'consult' }, { id: 'ct-2', status: 'review' }, { id: 'ct-3', status: 'signed' }, { id: 'ct-4', status: 'consult', _deleted: true }, { id: 'ct-5', status: 'closed' }];
  const all = {
    up: rec({ stage: 'signed', erp: e() }),
    review: rec({ stage: 'signed', erp: e({ contractId: 'ct-2' }) }),
    already: rec({ stage: 'signed', erp: e({ contractId: 'ct-3' }) }),
    acked: rec({ stage: 'signed', erp: e({ ackStage: 'signed' }) }),
    still: rec({ stage: 'consult', erp: e() }),
    del: rec({ stage: 'signed', erp: e({ contractId: 'ct-4' }) }),
    closed: rec({ stage: 'signed', erp: e({ contractId: 'ct-5' }) }),
    noid: rec({ stage: 'signed', erp: { claimedAt: 1 } }),
  };
  assert.deepEqual(Array.from(P.erpFibNotices(all, cts).map((n) => n.fid)).sort(), ['review', 'up']);
});

test('띠 그림 — 후보가 없으면 아무것도 안 그린다 · ☐ + 번호 · 주담당 고르기 전엔 가져오기 못 누른다', () => {
  const users = [{ sid: 'S1', name: '담당B' }, { sid: 'S2', name: '담당A' }];
  const base = { all: {}, contracts: [], users, onImport() {}, onImportMany() {}, onLink() {}, onIgnore() {}, onRestore() {}, onApply() {}, onKeep() {} };
  assert.equal(P.ErpFundInboxStrip(base), null, '후보도 알림도 없으면 띠가 없다 — 평소 화면은 그대로');
  const tree = P.ErpFundInboxStrip(Object.assign({}, base, { all: { f1: rec(), f2: rec({ shortName: '예시2호', stage: 'signed' }) } }));
  assert.match(text(tree), /계약 후보 2건/);
  const rows = find(tree, (n) => /(^| )fib-row( |$)/.test(n.props.className || '') && n.kids.length);
  assert.equal(rows.length, 3, '머리줄 1 + 후보 2');
  const nos = find(tree, (n) => n.props.className === 'fib-no').map(text);
  assert.deepEqual(nos, ['№', '1', '2'], '번호는 «지금 보이는 순서»');
  assert.equal(find(tree, (n) => n.tag === 'input' && n.props.type === 'checkbox').length, 3, '머리 ☐ 1 + 줄마다 ☐');
  const imp = find(tree, (n) => n.tag === 'button' && /가져오기/.test(text(n)) && !/선택/.test(text(n)));
  assert.equal(imp.length, 2);
  imp.forEach((b) => assert.equal(b.props.disabled, true, '★ 주담당을 안 골랐는데 눌리면 이름으로 대신 채우는 길이 생긴다'));
  const sels = find(tree, (n) => n.tag === 'select');
  assert.equal(sels.length, 2);
  const opts = find(sels[0], (n) => n.tag === 'option');
  assert.equal(opts[0].props.value, '', '처음은 «고르기» — 미리 골라 두지 않는다');
  assert.equal(opts[1].props.value, 'S2', '이름이 같은 직원(담당A)을 앞에 올려 «고르기 쉽게»만 한다');
  assert.match(text(opts[1]), /^★/);
});

test('띠 그림 — 같은 업체 기금 계약이 있으면 «이어 붙이기»를 주고, 가져오기는 «새 계약으로»가 된다', () => {
  const users = [{ sid: 'S1', name: '담당B' }];
  const exist = { id: 'ct-9', contractNo: '계약-2026-009', companyName: '예시전자', company: { name: '예시전자' }, kinds: ['fund'], status: 'consult' };
  const linked = [];
  const tree = P.ErpFundInboxStrip({ all: { f1: rec() }, contracts: [exist], users, onImport() {}, onImportMany() {}, onLink: (f, c) => linked.push([f, c]),
    onIgnore() {}, onRestore() {}, onApply() {}, onKeep() {} });
  const link = find(tree, (n) => n.tag === 'button' && /계약-2026-009/.test(text(n)));
  assert.equal(link.length, 1);
  link[0].props.onClick();
  assert.deepEqual(linked, [['f1', 'ct-9']]);
  assert.equal(find(tree, (n) => n.tag === 'button' && text(n) === '새 계약으로').length, 1);
  assert.equal(find(tree, (n) => n.tag === 'button' && text(n) === '가져오기').length, 0);
});

test('띠 그림 — 🔔 알림 줄에 [반영]·[그대로 두기] · 무시한 후보는 되돌릴 길이 있다', () => {
  const calls = [];
  const all = { f1: rec({ stage: 'signed', erp: { contractId: 'ct-1', contractNo: '계약-2026-001' } }), f2: rec({ ignored: { at: 'x' } }) };
  const tree = P.ErpFundInboxStrip({ all, contracts: [{ id: 'ct-1', contractNo: '계약-2026-001', status: 'consult' }], users: [],
    onImport() {}, onImportMany() {}, onLink() {}, onIgnore() {}, onRestore: (f) => calls.push(['restore', f]),
    onApply: (f) => calls.push(['apply', f]), onKeep: (f) => calls.push(['keep', f]) });
  const t = text(tree);
  assert.match(t, /수임 계약 체결/);
  assert.match(t, /상담접수 → 계약확정/);
  find(tree, (n) => n.tag === 'button' && text(n) === '반영')[0].props.onClick();
  find(tree, (n) => n.tag === 'button' && text(n) === '그대로 두기')[0].props.onClick();
  assert.deepEqual(calls, [['apply', 'f1'], ['keep', 'f1']]);
  assert.match(t, /무시한 후보 1건/);
});

/* ── ② 가져오기 길(ContractManagement 안의 fib*)을 진짜 소스째 떠서, 메모리 DB 에 돌려 본다 ── */
const FIB_START = SRC.indexOf('  var fibS = useState(null);');
const FIB_END = SRC.indexOf('  function openPrintModal(c)', FIB_START);
assert.ok(FIB_START > 0 && FIB_END > FIB_START, 'fib 묶음을 못 찾음');
const FIB_SRC = SRC.slice(FIB_START, FIB_END);

/* 파이어베이스 대역 — transaction 의 규칙(undefined 면 그만둠 · null 이면 지움 · 값이 다르면 다시 부름)을 그대로 흉내 낸다.
   cold:true 면 «처음엔 값을 못 받은 것»처럼 null 로 먼저 부른다(실제 SDK 가 그러는 때가 있다). */
function makeDb(initial, opts) {
  const o = Object.assign({ cold: false }, opts || {});
  const store = JSON.parse(JSON.stringify(initial || {}));
  const writes = [];
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const get = (p) => p.split('/').filter(Boolean).reduce((a, k) => (a == null ? a : a[k]), store);
  const put = (p, v) => {
    const ks = p.split('/').filter(Boolean); let a = store;
    for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}; a = a[ks[i]]; }
    if (v == null) delete a[ks[ks.length - 1]]; else a[ks[ks.length - 1]] = clone(v);
  };
  const snap = (v) => ({ val: () => (v === undefined ? null : clone(v)) });
  const fb = {
    ref: (p) => ({
      once: async () => snap(get(p)),
      set: async (v) => { writes.push(['set', p]); put(p, v); },
      remove: async () => { writes.push(['remove', p]); put(p, null); },
      on: (ev, cb) => { cb(snap(get(p))); return cb; },
      off: () => {},
      transaction: async (fn) => {
        const real = get(p) === undefined ? null : clone(get(p));
        if (o.cold && real !== null) fn(null);
        const next = fn(real);
        if (next === undefined) return { committed: false, snapshot: snap(real) };
        writes.push(['tx', p]);
        put(p, next);
        return { committed: true, snapshot: snap(next) };
      },
    }),
  };
  return { fb, store, writes, get };
}

function harness(o) {
  const db = o.sharedDb || makeDb(o.db, { cold: o.cold });   // sharedDb: 서로 다른 두 사람의 화면이 «같은 서버»를 쓰는 경우
  const toasts = []; const confirms = [];
  const state = { contracts: (o.contracts || []).map((c) => Object.assign({}, c)), saveOk: o.saveOk !== false, seq: 0 };
  const ctx = {
    fbDb: db.fb, CURRENT_USER: { sid: 'S9' },
    ERP_FIB_PATH: 'fund_erp/contract_inbox', _erpFibBusy: false,
    users: o.users || [{ sid: 'S1', name: '담당A' }, { sid: 'S2', name: '담당B' }],
    userName: (sid) => (((o.users || [{ sid: 'S1', name: '담당A' }, { sid: 'S2', name: '담당B' }]).find((u) => u.sid === sid)) || {}).name || sid,
    useState: (v) => [v, () => {}], useEffect: () => {},
    showToast: (m) => toasts.push(String(m)),
    popConfirm: async (m) => { confirms.push(String(m)); return o.confirm !== false; },
    dbGet: (k, d) => (k === 'contracts' ? state.contracts : k === 'companies' ? (o.companies || []) : d),
    getKindTypes: () => [{ code: 'fund-single', name: '사내근로복지기금' }],
    isContractLocked: () => !!o.locked,
    genContractNo: () => '계약-2026-' + String(100 + (++state.seq)),
    erpDeferCoLinkIfNew: (f) => (o.companyKnown ? null : Object.assign({}, f, { companyId: '', companyLinkStatus: 'pending' })),
    persistOne: (c) => { if (!state.saveOk) return false; state.contracts.unshift(c); return true; },
    moveStatus: (id, st) => { if (o.moveBlocked) return; const c = state.contracts.find((x) => x.id === id); if (c) c.status = st; },
    contracts: state.contracts, window: {}, JSON, Date, Math, Object, Array, String,
  };
  // 진짜 소스 조각 — 순수 함수와 같은 것을 같이 실어 준다
  const fn = new Function(...Object.keys(ctx), [
    cutVar(SRC, 'ERP_FIB_CLAIM_TTL'), cutVar(SRC, 'ERP_FIB_STAGE'), cutVar(SRC, 'ERP_FIB_TYPE_BY_FUND'),
    ...['function erpFibTaken(', 'function erpFibEntries(', 'function erpFibForm(', 'function erpFibMatches(',
      'function erpBlankContractForm(', 'function erpContractDupBlock(', 'function erpSameCompany(', 'function erpCoAddrKey(', 'function briefTrim('].map((d) => cutFn(SRC, d)),
    cutVar(SRC, 'BRIEF_MAX'),
    'var todayYMD=function(){return "2026-11-08"}, contractFormSubtypeFill=function(f){return f}, contractPerfSplit=function(){return false};',
    FIB_SRC,
    'return {fibImport,fibImportMany,fibLink,fibIgnore,fibRestore,fibApply,fibAck,setBusy:function(v){_erpFibBusy=v}, setAll:function(v){fibAll=v}};',
  ].join('\n'));
  const api = fn(...Object.values(ctx));
  return { api, db, state, toasts, confirms };
}
const inbox = (extra) => ({ fund_erp: { contract_inbox: Object.assign({ f1: rec() }, extra || {}) } });
const node = (h, fid) => h.db.get('fund_erp/contract_inbox/' + fid);

test('⑦ 가져오기 — 계약 한 건 + 후보에 «가져옴(계약번호)» · 주담당은 고른 사번 · 금액 없음', async () => {
  const h = harness({ db: inbox() });
  await h.api.fibImport('f1', 'S2');
  assert.equal(h.state.contracts.length, 1);
  const c = h.state.contracts[0];
  assert.equal(c.managerMain, 'S2');
  assert.equal(c.fundInboxId, 'f1');
  assert.deepEqual([...c.kinds], ['fund']);
  assert.equal(c.companyLinkStatus, 'pending', '업체관리에 없으면 연결 보류 — 이름으로 ID 를 안 채운다');
  assert.equal(c.successFee, 0);
  const e = node(h, 'f1').erp;
  assert.equal(e.contractId, c.id);
  assert.equal(e.contractNo, c.contractNo);
  assert.equal(e.bySid, 'S9');
  assert.ok(e.at && !e.claimedAt, '잡아 둔 흔적(claimedAt)은 지운다');
  assert.ok(h.confirms.length === 1 && /연결 보류/.test(h.confirms[0]) && /주담당: 담당B/.test(h.confirms[0]), '만들기 전에 무엇이 만들어지는지 보여 준다');
  // 기금관리가 읽는 칸(`erp.contractNo`·`ignored`)과 «올린 칸»은 그대로
  assert.equal(node(h, 'f1').fundName, '예시사내근로복지기금');
  assert.ok(h.db.writes.every(([, p]) => p.startsWith('fund_erp/contract_inbox/')), '쓰기는 대기함 한 곳뿐 — 이알피 장부는 persistOne 만');
});

test('① 같은 후보를 «연달아·동시에» 눌러도 계약은 한 건', async () => {
  for (const cold of [false, true]) {
    const h = harness({ db: inbox(), cold });
    await Promise.all([h.api.fibImport('f1', 'S1'), h.api.fibImport('f1', 'S1')]);
    assert.equal(h.state.contracts.length, 1, '동시 두 번(cold=' + cold + ')');
    await h.api.fibImport('f1', 'S1');
    assert.equal(h.state.contracts.length, 1, '또 눌러도(cold=' + cold + ')');
  }
});

test('① 서로 다른 두 사람이 «같은 순간에» 같은 후보를 눌러도 계약은 한 건 — 자리 잡기(트랜잭션)가 막는다', async () => {
  for (const cold of [false, true]) {
    const shared = makeDb(inbox(), { cold });
    const a = harness({ sharedDb: shared }), b = harness({ sharedDb: shared });     // 화면마다 «처리 중» 표시와 계약 목록은 따로다
    await Promise.all([a.api.fibImport('f1', 'S1'), b.api.fibImport('f1', 'S2')]);
    assert.equal(a.state.contracts.length + b.state.contracts.length, 1, '두 화면 합쳐 한 건(cold=' + cold + ')');
    const got = shared.get('fund_erp/contract_inbox/f1').erp;
    const winner = a.state.contracts.length ? a : b;
    assert.equal(got.contractId, winner.state.contracts[0].id, '표시는 «진짜 만든 쪽»을 가리킨다');
    const loser = winner === a ? b : a;
    assert.ok(loser.toasts.some((t) => /다른 분이 방금 가져갔/.test(t)), '진 쪽에는 까닭을 알려 준다');
  }
});

test('① 다른 사람이 «막 잡은» 후보는 못 가져간다 · 5분 넘게 멈춘 흔적은 다시 가져갈 수 있다', async () => {
  const h = harness({ db: inbox({ f1: rec({ erp: { claimedAt: Date.now() - 30 * 1000, bySid: 'S3' } }) }) });
  await h.api.fibImport('f1', 'S1');
  assert.equal(h.state.contracts.length, 0);
  assert.equal(node(h, 'f1').erp.bySid, 'S3', '남의 자리를 건드리지 않는다');
  const h2 = harness({ db: inbox({ f1: rec({ erp: { claimedAt: Date.now() - 6 * 60 * 1000, bySid: 'S3' } }) }) });
  await h2.api.fibImport('f1', 'S1');
  assert.equal(h2.state.contracts.length, 1, '멈춘 흔적은 이어 간다');
  assert.equal(node(h2, 'f1').erp.contractId, h2.state.contracts[0].id);
});

test('① 계약은 만들어졌는데 «가져옴» 표시를 못 적고 멈췄으면 — 새로 안 만들고 이어 붙인다', async () => {
  const h = harness({ db: inbox({ f1: rec({ erp: { claimedAt: Date.now() - 10 * 60 * 1000, bySid: 'S3' } }) }),
    contracts: [{ id: 'ct-old', contractNo: '계약-2026-050', fundInboxId: 'f1', kinds: ['fund'], status: 'consult', companyName: '예시전자' }] });
  await h.api.fibImport('f1', 'S1');
  assert.equal(h.state.contracts.length, 1, '두 번째 계약을 만들지 않는다');
  assert.equal(node(h, 'f1').erp.contractId, 'ct-old');
  assert.equal(node(h, 'f1').erp.contractNo, '계약-2026-050');
});

test('② 주담당을 안 골랐거나 명부에 없는 사번이면 아무것도 안 만든다', async () => {
  for (const mgr of ['', 'S-없음']) {
    const h = harness({ db: inbox() });
    await h.api.fibImport('f1', mgr);
    assert.equal(h.state.contracts.length, 0);
    assert.equal(node(h, 'f1').erp, undefined, '자리도 안 잡는다');
    assert.ok(h.toasts.some((t) => /주담당/.test(t)));
  }
});

test('③ persistOne 이 막으면 — 잡아 둔 자리를 돌려놓고 계약도 표시도 남기지 않는다', async () => {
  const h = harness({ db: inbox(), saveOk: false });
  await h.api.fibImport('f1', 'S1');
  assert.equal(h.state.contracts.length, 0);
  assert.equal(node(h, 'f1').erp, undefined, '★ 자리를 안 돌려놓으면 그 후보는 5분간 아무도 못 가져온다');
  assert.ok(h.toasts.some((t) => /저장을 막았습니다/.test(t)));
  h.state.saveOk = true;
  const h2 = harness({ db: inbox() });
  await h2.api.fibImport('f1', 'S1');
  assert.equal(h2.state.contracts.length, 1, '막힌 까닭이 풀리면 다시 가져올 수 있다');
});

test('③ 월이 잠겼으면 자리도 안 잡고 멈춘다', async () => {
  const h = harness({ db: inbox(), locked: true });
  await h.api.fibImport('f1', 'S1');
  assert.equal(h.state.contracts.length, 0);
  assert.equal(node(h, 'f1').erp, undefined);
  assert.ok(h.toasts.some((t) => /잠겨/.test(t)));
});

test('④ 기금관리가 후보를 거둔(지운) 뒤에는 유령을 남기지 않는다 — 가져오기·무시·되돌리기·알림 닫기 모두', async () => {
  for (const cold of [false, true]) {
    const h = harness({ db: { fund_erp: { contract_inbox: {} } }, cold });
    await h.api.fibImport('gone', 'S1');
    await h.api.fibIgnore(['gone']);
    await h.api.fibRestore('gone');
    h.api.setAll({ gone: rec({ stage: 'signed', erp: { contractId: 'ct-1' } }) });
    await h.api.fibAck('gone');
    assert.equal(h.state.contracts.length, 0);
    assert.deepEqual(h.db.store.fund_erp.contract_inbox, {}, '대기함에 아무 것도 새로 생기면 안 된다(cold=' + cold + ')');
  }
});

test('무시 — 후보에 ignored 만 적고(기금관리가 읽는 칸), 되돌리면 지운다 · 이미 가져간 후보는 못 무시한다', async () => {
  const h = harness({ db: inbox({ f2: rec({ erp: { contractId: 'ct-1', contractNo: 'n' } }) }) });
  h.api.setAll({ f1: rec(), f2: rec() });
  await h.api.fibIgnore(['f1', 'f2']);
  assert.ok(node(h, 'f1').ignored && node(h, 'f1').ignored.bySid === 'S9');
  assert.equal(node(h, 'f2').ignored, undefined, '가져간 후보는 무시 표시가 안 붙는다');
  assert.equal(node(h, 'f1').fundName, '예시사내근로복지기금', '올린 내용은 그대로');
  await h.api.fibRestore('f1');
  assert.equal(node(h, 'f1').ignored, undefined);
  const h2 = harness({ db: inbox(), confirm: false });
  h2.api.setAll({ f1: rec() });
  await h2.api.fibIgnore(['f1']);
  assert.equal(node(h2, 'f1').ignored, undefined, '묻는 창에서 «닫기»면 아무것도 안 바뀐다');
});

test('무시한 후보는 가져오지 못한다', async () => {
  const h = harness({ db: inbox({ f1: rec({ ignored: { at: 'x', bySid: 'S1' } }) }) });
  await h.api.fibImport('f1', 'S1');
  assert.equal(h.state.contracts.length, 0);
});

test('이어 붙이기 — 기존 계약은 «안 건드리고» 후보에만 가져옴 표시', async () => {
  const exist = { id: 'ct-9', contractNo: '계약-2026-009', companyName: '예시전자', kinds: ['fund'], status: 'consult' };
  const h = harness({ db: inbox(), contracts: [exist] });
  const before = JSON.stringify(h.state.contracts);
  await h.api.fibLink('f1', 'ct-9');
  assert.equal(JSON.stringify(h.state.contracts), before, '★ 이미 있는 계약을 고치지 않는다');
  const e = node(h, 'f1').erp;
  assert.equal(e.contractId, 'ct-9');
  assert.equal(e.contractNo, '계약-2026-009');
  assert.equal(e.linked, true);
});

test('여럿 고르기 — 주담당 고른 것만 만들고, 같은 업체 기금 계약이 있거나 주담당이 빈 것은 건너뛴다', async () => {
  const exist = { id: 'ct-9', contractNo: '계약-2026-009', companyName: '겹침회사', company: { name: '겹침회사' }, kinds: ['fund'], status: 'consult' };
  const h = harness({ db: inbox({ f2: rec({ company: '겹침회사' }), f3: rec({ company: '무주담당' }), f4: rec({ company: '둘째회사' }) }), contracts: [exist] });
  await h.api.fibImportMany([{ fid: 'f1', mgr: 'S1' }, { fid: 'f2', mgr: 'S1' }, { fid: 'f3', mgr: '' }, { fid: 'f4', mgr: 'S2' }]);
  const made = h.state.contracts.filter((c) => c.fundInboxId).map((c) => c.fundInboxId).sort();
  assert.deepEqual(made, ['f1', 'f4']);
  assert.equal(node(h, 'f2').erp, undefined);
  assert.equal(node(h, 'f3').erp, undefined);
  assert.equal(h.confirms.length, 1, '건수를 묻는 창은 한 번(줄마다 안 묻는다)');
  assert.ok(h.toasts.some((t) => /2건 가져왔습니다/.test(t) && /건너뜀 2건/.test(t)));
});

test('⑥ [반영] — 사람이 눌러야 계약확정으로 옮기고, 못 옮기면 알림을 닫지 않는다 · [그대로 두기]는 상태를 안 바꾼다', async () => {
  const mk = () => ({ f1: rec({ stage: 'signed', erp: { contractId: 'ct-1', contractNo: '계약-2026-001' } }) });
  const h = harness({ db: { fund_erp: { contract_inbox: mk() } }, contracts: [{ id: 'ct-1', contractNo: '계약-2026-001', status: 'consult' }] });
  h.api.setAll(mk());
  await h.api.fibApply('f1');
  assert.equal(h.state.contracts[0].status, 'signed');
  assert.equal(node(h, 'f1').erp.ackStage, 'signed');
  assert.equal(node(h, 'f1').erp.contractId, 'ct-1', '가져옴 표시는 그대로');

  const blocked = harness({ db: { fund_erp: { contract_inbox: mk() } }, contracts: [{ id: 'ct-1', status: 'consult' }], moveBlocked: true });
  blocked.api.setAll(mk());
  await blocked.api.fibApply('f1');
  assert.equal(blocked.state.contracts[0].status, 'consult');
  assert.equal(node(blocked, 'f1').erp.ackStage, undefined, '못 옮겼는데 알림을 닫으면 아무도 모른다');

  const keep = harness({ db: { fund_erp: { contract_inbox: mk() } }, contracts: [{ id: 'ct-1', status: 'consult' }] });
  await keep.api.fibAck('f1');
  assert.equal(keep.state.contracts[0].status, 'consult', '그대로 두기 — 계약 상태는 안 바뀐다');
  assert.equal(node(keep, 'f1').erp.ackStage, 'signed');
});

test('겹침 방지 — 처리 중이면 두 번째 누름은 아무것도 안 하고 알려 준다', async () => {
  const h = harness({ db: inbox() });
  h.api.setBusy(true);
  await h.api.fibImport('f1', 'S1');
  assert.equal(h.state.contracts.length, 0);
  assert.ok(h.toasts.some((t) => /처리 중/.test(t)));
});

/* ── ③ 짜임새: 우회하는 길이 없고, 폰·고르기 칸 규칙을 지킨다 ── */
function bare(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 '); }

test('이알피는 계약 장부(contracts)에 «persistOne» 말고는 쓰지 않고, 대기함 쓰기는 fibTx 한 길뿐', () => {
  const code = bare(FIB_SRC);
  assert.ok(!/dbSet\(\s*['"]contracts['"]/.test(code) && !/dbUpsert\(\s*['"]contracts['"]/.test(code) && !/dbPatch\(\s*['"]contracts['"]/.test(code),
    '계약 저장은 persistOne(월 잠금·업체 연결·주담당 검증)을 지나야 한다');
  const writes = [...code.matchAll(/\.(set|update|remove)\(/g)].length;
  assert.equal(writes, 0, '대기함은 fibTx(트랜잭션) 한 길로만 쓴다 — .set/.update/.remove 를 따로 쓰면 지워진 후보 자리에 유령이 생긴다');
  assert.ok(/\.transaction\(/.test(code));
});

test('주담당 칸은 후보의 «이름»에서 오지 않는다 — 서식 함수 소스에 rec.manager 가 managerMain 으로 새지 않는다', () => {
  const code = bare(cutFn(SRC, 'function erpFibForm('));
  assert.ok(!/managerMain\s*=\s*[^;]*rec\.manager/.test(code));
  assert.ok(!/managerSubs/.test(code));
});

test('CSS — ☐ 28px + 번호 36px 이 맨 왼쪽 · 번호 tabular-nums · 폰은 줄마다 카드(☐·№ 왼쪽 끝) · 폰 입력칸 16px · 단추는 누를 만큼', () => {
  assert.match(CSS, /\.fib-row\{[^}]*grid-template-columns:28px 36px/);
  assert.match(CSS, /\.fib-no\{[^}]*tabular-nums/);
  const m = CSS.slice(CSS.indexOf('.fib-row{display:grid')).match(/@media \(max-width: 768px\) \{([\s\S]*?)\n\}/);
  assert.ok(m, '폰 구간이 있다');
  /* 값이 아니라 규칙 — 폰에서 줄이 몇 줄이든 «모든 줄» 맨 왼쪽 두 칸은 ☐(ck)·번호(no) 이다 */
  const areas = (m[1].match(/\.fib-row\{[^}]*grid-template-areas:([^;}]*)/) || [])[1];
  assert.ok(areas, '폰에서 칸 배치(grid-template-areas)가 있다');
  const lines = [...areas.matchAll(/"([^"]*)"/g)].map((x) => x[1].trim());
  assert.ok(lines.length >= 2, '줄마다 카드 — 두 줄 이상');
  lines.forEach((l) => assert.ok(/^ck no /.test(l), '모든 줄이 ☐·№ 로 시작한다: ' + l));
  assert.match(m[1], /\.fib-act select\{[^}]*font-size:16px/, '폰 입력칸은 16px 이상');
  assert.match(m[1], /\.fib-act button[^{]*\{[^}]*min-height:3\d+px/, '폰 단추는 누를 만큼 크다(24px 미만 금지)');
  assert.ok(!/position:\s*fixed/.test(CSS.slice(CSS.indexOf('.fib{'))), '떠 있는 단추를 만들지 않는다(공용 앱바 몫)');
});

test('띠는 계약관리 화면에 «한 번만» 걸려 있고, 후보가 없으면 그리지 않는다', () => {
  const hits = SRC.match(/h\(ErpFundInboxStrip,/g) || [];
  assert.equal(hits.length, 1);
  assert.ok(/pu-erp\.css\?v=\d+/.test(SRC), 'CSS 캐시 번호가 있다');
});
