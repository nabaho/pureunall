'use strict';
/* 계약의 «심급·단계»(노동위원회·산재) — 이알피 쪽 연결 (대표 승인 2026-11-15 «권고대로», 계획 5 단계 B·C)
 * 계획: docs/superpowers/plans/2026-11-15-quote-auto-plan5-case-stage-marks.md · 읽기 함수는 tests/case-stage-detect.test.js
 * ⚠ 이 저장소는 공개다 — 업체·사람·문구는 전부 지어낸 것이다.
 * 실행: node --test tests/erp-stage-marks.test.js
 *
 * ■ 못 박는 것 — 깨지면 «잘못 달린 단계»나 «바뀌면 안 되는 값의 변경»이 조용히 생긴다
 *   ① 자동 길(견적·계약서)은 단계를 «달기만» 한다 — 계약 상태·금액·번호·stageCode 는 그대로.
 *   ② 사건 계약일 때만 달고, 새로 더할 것이 없으면 계약을 건드리지 않는다(같은 메일이 두 번 와도 겹치지 않음).
 *   ③ 사람이 정한 상태(☑·✕)는 자동 길이 다시 돌아도 안 바뀐다.
 *   ④ 계약 창은 읽은 것이 있을 때만 줄이 생기고, ☑ 만으로는 stageCode 가 안 바뀐다(「현재 단계로」를 눌러야).
 * 소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const PuCaseStage = require('../js/pu-case-stage.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'pu-erp.css'), 'utf8').replace(/\r\n/g, '\n');

/* 아주 작은 그림 대역 — 나무로 받아 글자·단추를 센다 */
function h(tag, props, ...kids) { return { tag, props: props || {}, kids: kids.flat(Infinity).filter((k) => k !== false && k != null) }; }
function text(n) { return typeof n === 'object' ? n.kids.map(text).join('') : String(n); }
function find(n, pred, out = []) { if (n && typeof n === 'object') { if (pred(n)) out.push(n); n.kids.forEach((k) => find(k, pred, out)); } return out; }
const codes = (marks) => Array.from(marks.map((m) => m.code));

const HELPERS = ['function erpStageMarksMerge(', 'function erpStagePartsFromContract(', 'function erpStagePartsFromQuote(',
  'function erpStageChipInfo(', 'function erpStageChip(', 'function erpStageBox('].map((d) => cutFn(SRC, d)).join('\n');

function helpers(opt) {
  const o = opt || {};
  const ctx = { window: o.noModule ? {} : { PuCaseStage }, h, Date, Object, Array, String, JSON, CURRENT_USER: { sid: 'S9' } };
  vm.createContext(ctx);
  vm.runInContext(HELPERS + '\nthis.api={erpStageMarksMerge,erpStagePartsFromContract,erpStagePartsFromQuote,erpStageChipInfo,erpStageChip,erpStageBox};', ctx);
  return ctx.api;
}
const H = helpers();
const CASE = { kinds: ['case'] };

test('② 달기 — 사건 계약이고 새로 읽은 단계가 있을 때만 값이 나오고, 아니면 null(계약을 안 건드림)', () => {
  const parts = [{ where: 'scope', text: '부당해고 구제신청 지방노동위원회 및 중앙노동위원회 대리' }];
  const r = H.erpStageMarksMerge([], parts, CASE, '수임계약서');
  assert.deepEqual(codes(r), ['lrc-local', 'lrc-central']);
  assert.ok(r.every((m) => m.state === 'auto' && m.srcDoc === '수임계약서' && m.at > 0));
  assert.equal(H.erpStageMarksMerge([], parts, { kinds: ['consulting'] }, ''), null, '컨설팅 계약에는 안 단다');
  assert.equal(H.erpStageMarksMerge([], [{ where: 'scope', text: '임금체불 진정 대리' }], CASE, ''), null, '단계 낱말이 없으면 null');
  assert.equal(H.erpStageMarksMerge(r, parts, CASE, '수임계약서'), null, '이미 달린 것뿐이면 null — 두 번 돌려도 겹치지 않는다');
  assert.equal(helpers({ noModule: true }).erpStageMarksMerge([], parts, CASE, ''), null, '모듈을 못 불러오면 아무것도 안 한다(계약 만들기를 막지 않는다)');
});

test('③ 사람이 정한 상태는 자동 길이 다시 돌아도 그대로이고, 새 단계만 auto 로 더해진다', () => {
  const human = PuCaseStage.setState(PuCaseStage.setState([], 'lrc-local', 'checked', 'S1', 5), 'wc-review', 'dismissed', 'S1', 6);
  const parts = [{ where: 'scope', text: '지방노동위원회 구제신청 대리, 중앙노동위원회 재심 대리, 산재 심사청구 대리' }];
  const r = H.erpStageMarksMerge(human, parts, CASE, '계약서');
  assert.deepEqual(codes(r), ['lrc-local', 'lrc-central', 'wc-review']);
  assert.deepEqual(Array.from(r.map((m) => m.state)), ['checked', 'auto', 'dismissed'], '☑·✕ 는 그대로, 새 중노위만 auto');
  assert.equal(r[0].bySid, 'S1');
  assert.equal(r[2].bySid, 'S1', '아님(✕)으로 정한 단계를 되살리지 않는다');
});

test('① 읽는 칸 — 계약서는 docName·scope·memo·메일 제목만, 견적은 제목·첨부 이름만(금액 칸은 안 본다)', () => {
  const cp = H.erpStagePartsFromContract({ docName: '수임계약서', scope: '지노위 대리', memo: '메모', fee: '5,500,000원', retainer: '3,000,000', success: '10%', deposit: '1', term: '1년' },
    { mailMeta: { subject: '계약서 송부', body: '본문은 안 본다' } });
  assert.deepEqual(Array.from(cp.map((p) => p.where)), ['docName', 'scope', 'memo', 'subject']);
  const joined = cp.map((p) => p.text).join('|');
  assert.ok(!/5,500,000|3,000,000|10%|본문/.test(joined), '금액·본문은 읽는 칸이 아니다: ' + joined);
  const qp = H.erpStagePartsFromQuote({ subject: '견적서 송부', atts: ['견적서_노동위.pdf', '약도.pdf'], body: '안 본다', amount: '9,900,000' });
  assert.deepEqual(Array.from(qp.map((p) => p.where)), ['subject', 'atts']);
  assert.equal(qp[1].text, '견적서_노동위.pdf 약도.pdf');
  assert.deepEqual(Array.from(H.erpStagePartsFromContract(null, null).map((p) => p.where)), ['docName', 'scope', 'memo', 'subject'], '비어 있어도 터지지 않는다');
});

test('칩 — 없으면 null · 다시 안 띄우기(✕)는 뺀다 · 읽기만 한 것은 «?» 와 점선, 확인하면 실선', () => {
  assert.equal(H.erpStageChipInfo(null), null);
  assert.equal(H.erpStageChipInfo({}), null);
  assert.equal(H.erpStageChip({ stageMarks: [] }), null);
  const auto = PuCaseStage.merge([], PuCaseStage.detect([{ where: 'scope', text: '지방노동위원회 및 중앙노동위원회 대리' }], CASE), { now: 1 }).marks;
  const i1 = H.erpStageChipInfo({ stageMarks: auto });
  assert.equal(i1.text, '⚖ 지노위 · 중노위');
  assert.equal(i1.anyAuto, true);
  assert.match(i1.title, /확인\(☑\)/);
  const chip = H.erpStageChip({ stageMarks: auto });
  assert.match(chip.props.className, /stg-auto/);
  assert.match(text(chip), /\?$/);
  const part = PuCaseStage.setState(PuCaseStage.setState(auto, 'lrc-local', 'checked', 'S1', 2), 'lrc-central', 'dismissed', 'S1', 3);
  const i2 = H.erpStageChipInfo({ stageMarks: part });
  assert.equal(i2.text, '⚖ 지노위', '✕ 한 단계는 칩에서 빠진다');
  assert.equal(i2.anyAuto, false);
  assert.doesNotMatch(H.erpStageChip({ stageMarks: part }).props.className, /stg-auto/);
  assert.equal(H.erpStageChipInfo({ stageMarks: PuCaseStage.setState(part, 'lrc-local', 'dismissed', 'S1', 4) }), null, '모두 ✕ 면 칩 자체가 없다');
});

function box(f, opts) {
  const sets = [];
  const setF = (fn) => { f = fn(f); sets.push(f); };
  return { tree: () => H.erpStageBox(f, setF, opts), get: () => f, sets };
}
const STAGE_OPTS = [{ code: 'lrc-local', name: '지방노동위원회' }, { code: 'lrc-central', name: '중앙노동위원회' }, { code: 'court-admin', name: '행정소송' }];

test('④ 계약 창 줄 — 읽은 것이 없으면 줄이 없다(평소 계약 창은 그대로)', () => {
  assert.equal(H.erpStageBox({}, () => {}, STAGE_OPTS), null);
  assert.equal(H.erpStageBox({ stageMarks: [] }, () => {}, STAGE_OPTS), null);
  assert.equal(H.erpStageBox(null, () => {}, STAGE_OPTS), null);
  assert.equal(H.erpStageBox({ stageMarks: [{ code: 'x-없는-코드' }] }, () => {}, STAGE_OPTS), null, '모르는 코드뿐이면 줄이 없다');
});

test('④ ☑ 하면 checked(누가·언제) — 그래도 stageCode(현재 단계)는 안 바뀐다 · «현재 단계로» 를 눌러야 바뀐다', () => {
  const marks = PuCaseStage.merge([], PuCaseStage.detect([{ where: 'scope', text: '지방노동위원회 및 중앙노동위원회 대리' }], CASE), { now: 1, srcDoc: '계약서' }).marks;
  const b = box({ stageMarks: marks, stageCode: '' }, STAGE_OPTS);
  let t = b.tree();
  const okBtns = find(t, (n) => n.tag === 'button' && n.props.className.includes('ok'));
  assert.equal(okBtns.length, 2, '읽은 단계마다 ☑');
  assert.equal(find(t, (n) => n.tag === 'button' && text(n) === '✕').length, 2);
  assert.match(text(t), /확인 필요/);
  assert.match(text(t), /「.*지방노동위원회.*」/, '근거 글이 보인다');
  okBtns[0].props.onClick();
  assert.equal(b.get().stageMarks[0].state, 'checked');
  assert.equal(b.get().stageMarks[0].bySid, 'S9');
  assert.equal(b.get().stageCode, '', '★ ☑ 만으로 현재 단계(→ 이관 때 사건 단계)가 바뀌면 안 된다');
  t = b.tree();
  const cur = find(t, (n) => n.tag === 'button' && text(n) === '현재 단계로');
  assert.equal(cur.length, 1, '확인한 단계에만 «현재 단계로»');
  cur[0].props.onClick();
  assert.equal(b.get().stageCode, 'lrc-local');
  t = b.tree();
  assert.equal(find(t, (n) => n.tag === 'button' && text(n) === '현재 단계로').length, 0, '이미 현재 단계면 단추가 없다');
  assert.match(text(t), /현재/);
});

test('④ ✕ 하면 dismissed 로 줄이 흐려지고 되돌릴 수 있다 · 사건 유형에서 못 고르는 단계는 «현재 단계로» 가 없다', () => {
  const marks = PuCaseStage.merge([], PuCaseStage.detect([{ where: 'scope', text: '산재 심사청구 대리' }], CASE), { now: 1 }).marks;   // wc-review
  const b = box({ stageMarks: marks }, STAGE_OPTS);
  find(b.tree(), (n) => n.tag === 'button' && text(n) === '✕')[0].props.onClick();
  assert.equal(b.get().stageMarks[0].state, 'dismissed');
  assert.match(b.tree().kids[1].props.className, /stg-no/);
  find(b.tree(), (n) => n.tag === 'button' && text(n) === '되돌리기')[0].props.onClick();
  assert.equal(b.get().stageMarks[0].state, 'auto');
  find(b.tree(), (n) => n.tag === 'button' && n.props.className.includes('ok'))[0].props.onClick();
  assert.equal(find(b.tree(), (n) => n.tag === 'button' && text(n) === '현재 단계로').length, 0,
    '심사청구는 이 유형(STAGE_OPTS)에서 못 고른다 — 저장 때 조용히 지워지는 값을 권하지 않는다');
});

test('④ «＋ 단계 추가» — 이 유형에서 고를 수 있고 아직 없는 단계만, 고르면 확인함(checked)으로 들어간다', () => {
  const marks = PuCaseStage.merge([], PuCaseStage.detect([{ where: 'scope', text: '지방노동위원회 대리' }], CASE), { now: 1 }).marks;
  const b = box({ stageMarks: marks }, STAGE_OPTS);
  const sel = find(b.tree(), (n) => n.tag === 'select')[0];
  const opts = find(sel, (n) => n.tag === 'option').map((o) => o.props.value);
  assert.deepEqual(opts, ['', 'lrc-central', 'court-admin'], '이미 있는 지노위는 빠진다');
  sel.props.onChange({ target: { value: 'court-admin' } });
  const added = b.get().stageMarks.find((m) => m.code === 'court-admin');
  assert.equal(added.state, 'checked');
  assert.equal(added.bySid, 'S9');
  sel.props.onChange({ target: { value: '' } });
  assert.equal(b.sets.length, 1, '빈 값을 골라도 아무 일도 안 한다');
});

/* ── 자동 길 두 곳을 진짜 소스째 돌려 본다 ── */
const PLAN = ['function erpQuoteDay(', 'function erpQuoteNote(', 'function erpCoAddrKey(', 'function erpSameCompany(', 'function erpBlankContractForm(', 'function erpQuoteLanePlan('].map((d) => cutFn(SRC, d)).join('\n');
function quotePlan(req, cts) {
  const ctx = { window: { PuCaseStage }, h, Date, Object, Array, String, JSON, Number, todayYMD: () => '2026-11-15' };
  vm.createContext(ctx);
  vm.runInContext(HELPERS + '\n' + PLAN + '\nthis.fn=erpQuoteLanePlan;', ctx);
  return ctx.fn(req, [], cts || [], [{ sid: 'S1', name: '담당A' }]);
}
const Q = (o) => Object.assign({ kind: 'quote', companyName: '가나다기업', deferLink: true, managerMain: 'S1', srcKey: 'k1', srcMails: ['k1'],
  subject: '견적서 송부', atts: ['견적서.pdf'], at: Date.UTC(2026, 10, 15) }, o || {});

test('① 견적 길 — 사건으로 읽힌 메일 제목·첨부에서 단계를 «확인 필요»로 달고, 상태·금액·번호는 그대로(상담접수)', () => {
  const plan = quotePlan(Q({ inferredKind: 'case', useInferredKind: true, subject: '지방노동위원회 구제신청 대리 견적서', atts: ['중앙노동위원회_재심_견적.pdf'] }));
  assert.equal(plan.action, 'create');
  assert.deepEqual(codes(plan.form.stageMarks), ['lrc-local', 'lrc-central']);
  assert.ok(plan.form.stageMarks.every((m) => m.state === 'auto'));
  assert.equal(plan.form.status, 'consult', '단계를 읽어도 상태는 그대로');
  assert.deepEqual(Array.from(plan.form.kinds), ['case']);
  assert.ok(!plan.form.stageCode, 'stageCode(현재 단계)는 안 채운다');
  Object.values(plan.form.amounts).forEach((v) => assert.equal(v, 0));
  assert.ok(!/\d{4,}/.test(plan.form.stageMarks.map((m) => m.evidence).join(' ')));
});

test('② 견적 길 — 사건이 아니면(컨설팅·미분류) 단을 안 달고, 단계 낱말이 없어도 stageMarks 가 생기지 않는다', () => {
  const consulting = quotePlan(Q({ inferredKind: 'consulting', useInferredKind: true, subject: '지방노동위원회 사례 컨설팅 견적서' }));
  assert.equal(consulting.action, 'create');
  assert.equal(consulting.form.stageMarks, undefined);
  const none = quotePlan(Q({ inferredKind: 'case', useInferredKind: true, subject: '임금체불 진정 대리 견적서' }));
  assert.equal(none.form.stageMarks, undefined, '빈 배열도 만들지 않는다');
});

/* 계약서 길(ContractManagement 안) — 함수 전체를 떠서, 모르는 이름을 부르면 «소리 나게» 터지는 범위 안에서 돌린다 */
const LANE_START = SRC.indexOf('  async function processPhotoContractRequest(key, req){');
const LANE_END = SRC.indexOf('  async function processOneContractRequest(key, req){', LANE_START);
assert.ok(LANE_START > 0 && LANE_END > LANE_START, '계약서 길 함수를 못 찾음');
const LANE_SRC = SRC.slice(LANE_START, LANE_END);
function laneRun(req, opt) {
  const o = opt || {};
  const saved = [];
  const stubs = {
    fbDb: { ref: () => ({ remove: async () => {}, update: async () => {} }) },
    dbGet: (k) => (k === 'contracts' ? (o.contracts || []) : k === 'companies' ? (o.companies || []) : []),
    getActiveUsers: () => [{ sid: 'S1', name: '담당A' }],
    erpGuessContractFromFields: () => ({ kind: o.kind || 'case', typeCode: o.typeCode || '' }),
    getKindTypes: () => [],
    erpParseContractMoney: () => 0, erpParseSuccessFee: () => ({ fee: 0, type: 'amount' }), erpVatTextToFlag: () => null,
    erpCmsFromDoc: () => ({ isCMS: false, payDay: '' }),
    erpCoNameKey: (s) => String(s || '').replace(/\s/g, ''),
    erpSameCompany: (a, c) => String(a.company.name) === String(c.companyName),
    erpDeferCoLinkIfNew: () => null,
    erpBiznoClash: () => null,
    isContractLocked: () => false,
    genContractNo: () => '계약-2026-900',
    persistOne: (c) => { saved.push(c); return true; },
    erpBlankContractForm: vm.runInContext('(' + cutFn(SRC, 'function erpBlankContractForm(') + ')', vm.createContext({ todayYMD: () => '2026-11-15', Date })),
    window: { PuCaseStage },
    /* 사업자번호 검산은 이 검사의 대상이 아니다 — 길이 «번호가 맞는 사업장»으로 보고 기존 카드에 잇는 경로를 타게 한다 */
    PuDocRead: { bizNoValid: () => true }, CURRENT_USER: { sid: 'S1' },
  };
  const g = Object.assign({}, stubs, { erpStageMarksMerge: H.erpStageMarksMerge, erpStagePartsFromContract: H.erpStagePartsFromContract,
    Date, Object, Array, String, JSON, Number, Promise, Math, parseInt, console });
  const names = Object.keys(g);
  const fn = new Function(...names, 'return (' + LANE_SRC.trim().replace(/^async function processPhotoContractRequest/, 'async function') + ')');
  return fn(...names.map((k) => g[k]))('ctphoto-1', req).then((r) => ({ r, saved }));
}
const REQ = (o) => Object.assign({
  source: 'photo_contract', state: 'pending', targetStatus: 'signed', senderVerified: true, managerMain: 'S1', companyId: '', srcMails: [],
  company: { name: '가나다기업', bizNo: '' },
  contractFields: { docName: '수임계약서', scope: '부당해고 구제신청 지방노동위원회 및 중앙노동위원회 재심 대리', memo: '', signDate: '2026-11-14', fee: '5,500,000원' },
  srcPhoto: { id: 'p1', year: 2026, owner: 'u1', kind: 'contract', name: '수임계약서' },
}, o || {});

test('① 계약서 길(새 카드) — 사건 계약에 단계를 «확인 필요»로 달고, 상태(계약협의/확정)는 길이 정하던 그대로', async () => {
  const { r, saved } = await laneRun(REQ(), { kind: 'case' });
  assert.ok(r.made, JSON.stringify(r));
  assert.equal(saved.length, 1);
  assert.deepEqual(codes(saved[0].stageMarks), ['lrc-local', 'lrc-central']);
  assert.ok(saved[0].stageMarks.every((m) => m.state === 'auto' && m.srcDoc === '수임계약서'));
  /* 대조군 — 단계 낱말만 뺀 «같은» 계약서. 단계를 읽었다고 상태·금액·담당·종류가 달라지면 안 된다 */
  const ctrl = (await laneRun(REQ({ contractFields: Object.assign({}, REQ().contractFields, { scope: '부당해고 구제신청 대리' }) }), { kind: 'case' })).saved[0];
  assert.equal(ctrl.stageMarks, undefined);
  ['status', 'successFee', 'managerMain', 'signDate'].forEach((k) => assert.deepEqual(saved[0][k], ctrl[k], k + ' 은 단계를 읽어도 그대로'));
  assert.equal(JSON.stringify(saved[0].amounts), JSON.stringify(ctrl.amounts), '금액 칸은 단계를 읽어도 그대로');
  assert.equal(JSON.stringify(saved[0].kinds), JSON.stringify(ctrl.kinds));
  assert.ok(!saved[0].stageCode, 'stageCode 는 안 채운다');
  assert.ok(!/\d{4,}/.test(saved[0].stageMarks.map((m) => m.evidence).join(' ')), '근거에 금액이 안 남는다');
});

test('② 계약서 길 — 컨설팅으로 읽힌 계약서에는 단계를 안 단다', async () => {
  const { r, saved } = await laneRun(REQ(), { kind: 'consulting' });
  assert.ok(r.made);
  assert.equal(saved[0].stageMarks, undefined);
});

test('③ 계약서 길(기존 카드) — 사람이 ☑·✕ 한 단계는 그대로, 새로 읽은 단계만 auto 로 더한다', async () => {
  const marks = PuCaseStage.setState(PuCaseStage.setState([], 'lrc-local', 'checked', 'S1', 5), 'lrc-central', 'dismissed', 'S1', 6);
  /* 기존 카드에 «이어 붙이려면» 사업자번호가 확인돼야 한다(길의 규칙) — 그래서 둘 다 같은 번호를 준다 */
  const cur = { id: 'ct-1', contractNo: '계약-2026-100', status: 'review', kinds: ['case'], companyName: '가나다기업', bizNo: '1234567890',
    company: { name: '가나다기업', bizNo: '1234567890' }, stageMarks: marks, stageCode: 'lrc-local' };
  const withBiz = (cf) => REQ({ company: { name: '가나다기업', bizNo: '1234567890' }, contractFields: cf });
  const { r, saved } = await laneRun(withBiz({ docName: '수임계약서', scope: '지방노동위원회·중앙노동위원회 대리 및 행정소송 대리', signDate: '2026-11-14' }),
    { kind: 'case', contracts: [cur] });
  assert.ok(r.made, JSON.stringify(r));
  const u = saved[0];
  assert.equal(u.id, 'ct-1', '새 카드를 만들지 않고 기존 카드를 고친다');
  assert.deepEqual(codes(u.stageMarks), ['lrc-local', 'lrc-central', 'court-admin']);
  assert.deepEqual(Array.from(u.stageMarks.map((m) => m.state)), ['checked', 'dismissed', 'auto']);
  assert.equal(u.stageCode, 'lrc-local', '사람이 정한 현재 단계는 그대로');
  const noNew = await laneRun(withBiz({ docName: '수임계약서', scope: '지방노동위원회 대리', signDate: '2026-11-14' }), { kind: 'case', contracts: [cur] });
  assert.equal(noNew.saved[0].id, 'ct-1');
  assert.deepEqual(noNew.saved[0].stageMarks, marks, '새로 더할 것이 없으면 stageMarks 를 안 건드린다');
});

/* 견적 길 «한 건» 처리(ContractManagement 안) — 기존 카드에 붙이기·계약협의로 옮기기 경로 */
const QL_START = SRC.indexOf('  async function processQuoteLaneRequest(key, req){');
const QL_END = SRC.indexOf('\n  }\n', QL_START) + 4;
assert.ok(QL_START > 0 && QL_END > QL_START, '견적 길 처리 함수를 못 찾음');
const QL_SRC = SRC.slice(QL_START, QL_END);
function quoteLaneRun(req, cts) {
  const saved = [], patched = [];
  const g = {
    fbDb: { ref: () => ({ remove: async () => {}, update: async () => {} }) },
    dbGet: (k) => (k === 'contracts' ? (cts || []) : []),
    getActiveUsers: () => [{ sid: 'S1', name: '담당A' }],
    erpQuoteLanePlan: vm.runInContext('(function(){' + HELPERS + '\n' + PLAN + '\nreturn erpQuoteLanePlan;})()',
      vm.createContext({ window: { PuCaseStage }, h, Date, Object, Array, String, JSON, Number, todayYMD: () => '2026-11-15' })),
    erpStageMarksMerge: H.erpStageMarksMerge, erpStagePartsFromQuote: H.erpStagePartsFromQuote,
    persistOne: (c) => { saved.push(c); return true; },
    patchOne: (id, patch) => { patched.push({ id, patch }); return true; },
    erpDeferCoLinkIfNew: () => null, isContractLocked: () => false, genContractNo: () => '계약-2026-901',
    Date, Object, Array, String, JSON, Number, Promise, Math,
  };
  const names = Object.keys(g);
  const fn = new Function(...names, 'return (' + QL_SRC.trim().replace(/^async function processQuoteLaneRequest/, 'async function') + ')');
  return fn(...names.map((k) => g[k]))('ctq-1', req).then((r) => ({ r, saved, patched }));
}
const OPEN = (o) => Object.assign({ id: 'ct-q', contractNo: '계약-2026-050', status: 'consult', kinds: ['case'], companyName: '가나다기업', company: { name: '가나다기업' } }, o || {});

test('① 견적 길(기존 카드에 붙이기) — 새 단계만 auto 로 더하고 사람이 정한 상태·상태·금액은 그대로', async () => {
  const marks = PuCaseStage.setState([], 'lrc-local', 'checked', 'S1', 5);
  const cur = OPEN({ stageMarks: marks, stageCode: 'lrc-local' });
  const { r, saved } = await quoteLaneRun(Q({ inferredKind: 'case', useInferredKind: true, subject: '지방노동위원회·중앙노동위원회 대리 견적서' }), [cur]);
  assert.ok(r.attached, JSON.stringify(r));
  assert.equal(saved[0].id, 'ct-q');
  assert.deepEqual(codes(saved[0].stageMarks), ['lrc-local', 'lrc-central']);
  assert.deepEqual(Array.from(saved[0].stageMarks.map((m) => m.state)), ['checked', 'auto']);
  assert.equal(saved[0].status, 'consult');
  assert.equal(saved[0].stageCode, 'lrc-local');
  const none = await quoteLaneRun(Q({ inferredKind: 'case', useInferredKind: true, subject: '지방노동위원회 대리 견적서' }), [cur]);
  assert.deepEqual(none.saved[0].stageMarks, marks, '새로 더할 것이 없으면 건드리지 않는다');
});

test('① 견적 길(계약협의로 옮기기) — 단계를 patch 에 담되 상태는 계약협의 하나뿐이고 stageCode 는 patch 에 없다', async () => {
  const cur = OPEN({ status: 'consult' });
  const { r, patched } = await quoteLaneRun(Q({ kind: 'advance', inferredKind: 'case', useInferredKind: true, subject: '산재 심사청구 대리 계약서 송부' }), [cur]);
  assert.ok(r.advanced, JSON.stringify(r));
  assert.equal(patched[0].id, 'ct-q');
  assert.equal(patched[0].patch.status, 'review');
  assert.deepEqual(codes(patched[0].patch.stageMarks), ['wc-review']);
  assert.equal(patched[0].patch.stageCode, undefined);
  const consulting = await quoteLaneRun(Q({ kind: 'advance', inferredKind: 'consulting', useInferredKind: true, subject: '산재 심사청구 사례 컨설팅' }), [OPEN({ kinds: ['consulting'] })]);
  assert.equal(consulting.patched[0].patch.stageMarks, undefined, '컨설팅 카드에는 안 단다');
});

/* ── 그림·글자 짜임새 ── */
test('칩·상자는 세 카드 모양과 계약 창에 한 번씩 걸려 있고, 계약 창은 사건 계약에서만 그린다', () => {
  assert.equal((SRC.match(/\n\s+erpStageChip\(c\),/g) || []).length, 1, '3칸 카드(호출) — 담당·번호가 있는 둘째 줄');
  const card3 = SRC.slice(SRC.indexOf('// ===== 기본 (3컬럼) 카드 ====='));
  const l1 = card3.slice(0, card3.indexOf('둘째 줄: 담당자'));
  assert.ok(!/erpStageChip\(c\)/.test(l1), '첫 줄(회사명 줄)에는 안 둔다 — 회사명이 줄을 차지하면 칩이 찌그러진다');
  assert.equal((SRC.match(/var stgL = erpStageChipInfo\(c\)/g) || []).length, 1, '목록 카드');
  assert.equal((SRC.match(/var stgP = erpStageChipInfo\(c\)/g) || []).length, 1, '폰 카드');
  assert.equal((SRC.match(/isCase && erpStageBox\(f, setF, caseStageOpts\)/g) || []).length, 1, '계약 창 — 사건 종류 상자 안에서만');
  assert.match(SRC, /<script src="js\/pu-case-stage\.js\?v=\d+"><\/script>/, '모듈 적재');
});

test('CSS — 읽기만 한 칩은 점선 · 한 줄(넘치면 …) · 폰 단추는 누를 만큼 · 폰 입력칸 16px', () => {
  assert.match(CSS, /\.stg-chip\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis|\.stg-chip\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/);
  assert.match(CSS, /\.stg-chip\.stg-auto\{[^}]*dashed/);
  const m = CSS.slice(CSS.indexOf('.stg-chip{')).match(/@media \(max-width: 768px\) \{([\s\S]*?)\n\}/);
  assert.ok(m, '폰 구간이 있다');
  assert.match(m[1], /\.stg-b[^{]*\{[^}]*min-height:3\d+px/);
  assert.match(m[1], /\.stg-add\{[^}]*font-size:16px/);
  assert.ok(!/position:\s*fixed/.test(CSS.slice(CSS.indexOf('.stg-chip{'))), '떠 있는 단추를 만들지 않는다');
});
