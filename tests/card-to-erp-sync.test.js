'use strict';
/* 🏢 명함 「업체관리에 올리기」 — 고르면 곧바로 모든 앱에 (대표 지시 2026-09-28 둘째)
   「기업정보함에서도 자문 급여 노조 기금 선택하면 자동으로 모두 동기화 되어서 … 모든 푸른통합시스템에
    기업과 담당자 동기화가 가능하게 해달라. 자동으로」

   ■ 뿌리는 업체관리(data/companies) 한 곳 — 푸른이알피·업무관리·뉴스레터·메일함·급여관리 등이
     모두 거기서 읽는다(실측 2026-09-28). 그러니 «거기에 제대로» 쓰는지를 본다.
   ■ 전부 «실제로 돌린다» — 진짜 공용 저장 관문(pu-company-write.js)과 가짜 파이어베이스로.
     ① 새 회사는 유형·상태·담당자를 갖춰 한 건으로 생긴다 (반쪽 업체가 아니다)
     ② 이미 있으면 새로 안 만든다 — 빈 칸·담당자만, 유형은 비었거나 「컨설팅」일 때만
     ③ 헷갈리면 멈춘다 (번호 둘 · 이름만 같음 · 옛 배열 꼴 · 자리 어긋남)
     ④ 끝난 업체는 묻고 되살린다
     ⑤ 그사이 누가 고쳤으면 덮지 않는다 (판 번호)
     ⑥ 다른 앱이 알도록 data/companies/u 를 올린다 · 업무관리는 그것을 보고 사본을 버린다 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const PuCompanyWrite = require('../js/pu-company-write.js');

const R = path.join(__dirname, '..');
const CARDS = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const WORK = fs.readFileSync(path.join(R, 'work.html'), 'utf8').replace(/\r\n/g, '\n');
const clone = (x) => JSON.parse(JSON.stringify(x));
const NOW = 1790000000000;

/* 가짜 파이어베이스 — 경로 하나짜리 나무. transaction 은 진짜처럼 «서버의 지금 값»을 준다 */
function fakeDb(tree) {
  const root = { data: { companies: { v: tree === undefined ? {} : tree } } };
  const calls = { sets: [], tx: [], reads: 0 };
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), root);
  const put = (p, v) => {
    const ks = p.split('/'); let o = root;
    ks.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v;
  };
  return {
    root, calls, get,
    /* 누가 그사이 고쳤다 — 서버 값만 바꾼다 */
    meddle(p, fn) { put(p, fn(clone(get(p)))); },
    ref(p) {
      return {
        once: async () => { calls.reads++; const v = clone(get(p));    // ⚠ 읽은 «그때» 값을 떠 둔다
          return { val: () => (v === undefined ? null : clone(v)) }; },
        set: async (v) => { calls.sets.push([p, v]); put(p, v); },
        transaction: async (fn) => {
          const cur = get(p);
          const next = fn(cur === undefined ? null : clone(cur));
          if (next === undefined) return { committed: false, snapshot: { val: () => cur } };
          calls.tx.push([p, clone(next)]); put(p, clone(next));
          return { committed: true, snapshot: { val: () => next } };
        }
      };
    }
  };
}

const grab = (re) => (CARDS.match(re) || [''])[0];
const PARTS = [
  grab(/const esc = s => [^\n]+/).replace('const esc', 'var esc'),
  grab(/const _norm = s => [^\n]+/).replace('const _norm', 'var _norm'),
  grab(/const CARD_ERP_TYPES = [^;]+;\nconst CARD_ERP_SEED_KEY = [^;]+;/).replace(/const /g, 'var '),
  grab(/const CARD_ERP_ENDED = [^;]+;\nconst CARD_ERP_AUTO = [^;]+;/).replace(/const /g, 'var '),
  ...['function erpNormName(', 'function erpNormBiz(', 'function cardErpBizOf(', 'function cardErpPerson(',
    'function cardErpFind(', 'function cardErpNewRec(', 'function cardErpNoteLine(', 'function cardErpMerge(',
    'function cardErpStaffOpts(', 'async function cardErpSync(', 'function cardErpDone(',
    'function cardErpSeed(', 'function cardErpHtml(', 'function sendToErp(', 'function closeCardErp(',
    'function cardErpGo(',
    /* 2026-10-03 「이 회사가 맞나요?」 — 창·올리기가 이 도우미들을 부른다 */
    'function cardErpCandidates(', 'function cardErpSiblings(', 'function cardErpTarget(',
    'function cardErpPinCards(', 'function cardErpWhoHtml(', 'function cardErpWho(', 'function cardErpBizFor('].map((d) => cutFn(CARDS, d)),
  'var _cardErpId = ""; var _cardErpPicked = []; var _cardErpPin = ""; var _cardErpFix = null; var _cardErpCands = [];'
].join('\n');

const CARD = { id: 'c1', kind: 'card', name: '김철수', company: '(주)가온', title: '과장', dept: '인사팀',
  mobile: '010-1111-2222', tel: '02-111-2222', email: 'kim@gaon.kr',
  companyTel: '02-100-0000', companyAddr: '서울 중구 1', bizno: '123-45-67891' };

function world(opts) {
  const o = opts || {};
  const db = fakeDb(o.tree);
  const calls = { toasts: [], confirms: [], goApp: [], erpLoad: 0 };
  const answers = (o.answers || []).slice();
  const els = { cardErpM: { innerHTML: '' }, cardErpBg: { classList: { on: false,
    add() { this.on = true; }, remove() { this.on = false; } } }, cardErpSid: { value: o.sid || '' } };
  const ctx = {
    console, Date: class extends Date { static now() { return NOW; } },   // ⚠ vm 안의 Date 는 따로다
    toast: (m) => calls.toasts.push(m),
    confirm: (m) => { calls.confirms.push(m); return answers.length ? answers.shift() : false; },
    $: (id) => els[id],
    document: { getElementById: (id) => els[id] || null,
      querySelectorAll: () => (o.picked || ['자문']).map((v) => ({ value: v })) },
    localStorage: { setItem() {} },
    PuAppBar: { goApp: (u, p) => calls.goApp.push([u, p]) },
    PuCompanyWrite,
    Store: { mode: o.mode || 'firebase' },
    firebase: { auth: () => ({ currentUser: { email: 'p001@pureun.kr' } }), database: () => db },
    ErpMatch: { ready: true, match: () => null, staff: {}, load: () => { calls.erpLoad++; } },
    state: { items: Object.assign({ c1: Object.assign({}, CARD, o.card || {}) }, o.items || {}) }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(PARTS, ctx);
  ctx.sendToErp('c1');
  return { ctx, db, calls, els };
}
const coList = (db) => Object.values(db.get('data/companies/v') || {});

// ══════ ① 새 회사 ═════════════════════════════════════════════════════
test('① 없는 회사 — 유형·상태·담당자를 갖춘 «한 건»이 생기고, 다른 앱이 알게 u 를 올린다', async () => {
  const w = world({ picked: ['자문', '급여'], sid: 'P-003' });
  await w.ctx.cardErpSync('c1');
  const list = coList(w.db);
  assert.equal(list.length, 1, '★★ 업체관리에 안 생겼습니다');
  const co = list[0];
  assert.equal(co.typeCode, '자문', '★★ 유형이 없으면 업체관리 어느 탭에도 안 나옵니다');
  assert.equal(co.status, 'active', '★★ 상태가 없으면 「일하는 곳」에 안 나옵니다');
  assert.equal(co.name, '(주)가온');
  assert.equal(co.bizNo, '123-45-67891');
  assert.equal(co.phone, '02-100-0000', '회사 칸에는 회사 대표번호');
  assert.equal(co.managerMain, 'P-003', '고른 주담당');
  assert.equal(co.contacts.length, 1);
  assert.equal(co.contacts[0].name, '김철수', '★★ 담당자가 안 따라갑니다');
  assert.equal(co.contacts[0].phone, '010-1111-2222');
  assert.equal(co.contacts[0].isPrimary, true);
  assert.equal(co.primaryContactEmail, 'kim@gaon.kr');
  assert.match(co.note, /함께 맡기로 한 일: 급여/, '★ 나머지 유형을 안 적으면 조용히 사라집니다');
  assert.equal(co.revision, 1, '★ 공용 관문을 지나야 판 번호가 붙습니다');
  assert.equal(co.contractVersion, 1);
  assert.equal(co.entityType, 'Organization');
  assert.equal(co.sourceKind, 'card');
  assert.equal(co.arrivedFrom, '기업정보함', '업체관리의 「방금 들어옴」 표시');
  assert.equal(w.db.calls.tx.length, 1, '★ 한 건만 써야 합니다');
  assert.equal(w.db.calls.tx[0][0], 'data/companies/v/' + co.id, '★★ 목록 통째가 아니라 업체 한 자리에');
  assert.deepEqual(w.db.calls.sets, [['data/companies/u', NOW]], '★★ u 를 안 올리면 푸른이알피·업무관리가 새로고침 전까지 모릅니다');
  assert.equal(w.calls.erpLoad, 1, '★ 다시 안 읽으면 명함이 「업체관리」 폴더로 안 갑니다');
  assert.match(w.els.cardErpM.innerHTML, /새로 올렸습니다/);
  assert.match(w.els.cardErpM.innerHTML, /cardErpGo\('c1'\)">📋 계약 창 열기/, '올린 뒤 계약 창으로 이어진다');
});

test('① 올린 뒤 「계약 창 열기」는 올릴 때 고른 유형을 그대로 쓴다', async () => {
  const w = world({ picked: ['노조'] });
  await w.ctx.cardErpSync('c1');
  let seed = null;
  w.ctx.localStorage.setItem = (k, v) => { seed = JSON.parse(v); };
  w.ctx.document.querySelectorAll = () => [];        // 올린 뒤 창에는 고르개가 없다
  w.ctx.cardErpGo('c1');
  assert.ok(seed, '★ 고르개가 없는 창에서 계약 창이 안 열립니다');
  assert.equal(seed.typeCodes.company, '노조');
});

// ══════ ② 이미 있는 회사 ═════════════════════════════════════════════
const OLD = { id: 'co-a', entityType: 'Organization', name: '주식회사 가온', bizNo: '1234567891',
  typeCode: '컨설팅', status: 'active', phone: '031-999-9999', address: '', note: '자동 등록 (컨설팅)',
  contacts: [{ id: 'm1', name: '박영희', email: 'park@gaon.kr', isPrimary: true }], revision: 3, contractVersion: 1,
  schemaVersion: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: 1 };

test('② 사업자번호로 찾으면 새로 안 만든다 — 「컨설팅」은 자문으로, 빈 칸만 채우고 담당자를 더한다', async () => {
  const w = world({ tree: { 'co-a': clone(OLD) } });
  await w.ctx.cardErpSync('c1');
  const list = coList(w.db);
  assert.equal(list.length, 1, '★★ 같은 회사가 두 줄이 되었습니다');
  const co = list[0];
  assert.equal(co.typeCode, '자문', '★★ 컨설팅만 하던 곳이 자문사가 안 됩니다');
  assert.equal(co.phone, '031-999-9999', '★★ 이미 적힌 번호를 덮었습니다');
  assert.equal(co.address, '서울 중구 1', '빈 주소는 채운다');
  assert.equal(co.contacts.length, 2);
  assert.equal(co.contacts[0].name, '박영희', '★ 있던 담당자를 지웠습니다');
  assert.equal(co.contacts[1].isPrimary, false, '대표 담당자가 이미 있으면 새 사람은 대표가 아니다');
  assert.equal(co.revision, 4, '★ 판 번호가 하나 올라가야 푸른이알피가 낡은 화면을 막습니다');
  assert.deepEqual(clone(co.cardSync.before), { typeCode: '컨설팅', status: 'active' }, '★ 되돌릴 근거가 없습니다');
  assert.match(co.note, /^자동 등록 \(컨설팅\)\n🏢 기업정보함 명함에서 올림/, '원래 메모 뒤에 한 줄 더한다');
  assert.match(w.els.cardErpM.innerHTML, /이어 붙였습니다/);
});

test('② 일하는 중인 진짜 유형(급여)은 안 바꾸고 «말한다»', async () => {
  const w = world({ tree: { 'co-a': Object.assign(clone(OLD), { typeCode: '급여' }) } });
  await w.ctx.cardErpSync('c1');
  assert.equal(coList(w.db)[0].typeCode, '급여', '★★ 하던 일을 지웠습니다');
  assert.match(w.els.cardErpM.innerHTML, /이미 「급여」 업체라 유형은 그대로/, '★ 안 바꿨으면 왜인지 말해야 합니다');
});

test('② 이미 다 들어 있으면 아무것도 안 쓴다 · 같은 사람은 두 번 안 넣는다', async () => {
  const full = Object.assign(clone(OLD), { typeCode: '자문', address: '서울 중구 1',
    ceo: 'x', fax: 'x', bizType: 'x', bizCategory: 'x',
    contacts: [{ id: 'm1', name: '김철수', email: 'KIM@gaon.kr', isPrimary: true }] });
  const w = world({ tree: { 'co-a': full } });
  await w.ctx.cardErpSync('c1');
  assert.equal(w.db.calls.tx.length, 0, '★ 바꿀 것이 없는데 썼습니다');
  assert.equal(w.db.calls.sets.length, 0);
  assert.match(w.els.cardErpM.innerHTML, /이미 다 들어 있습니다/);
});

// ══════ ③ 헷갈리면 멈춘다 ═══════════════════════════════════════════
test('③ 같은 사업자번호가 둘이면 멈춘다', async () => {
  const w = world({ tree: { 'co-a': clone(OLD), 'co-b': Object.assign(clone(OLD), { id: 'co-b' }) } });
  await w.ctx.cardErpSync('c1');
  assert.equal(w.db.calls.tx.length, 0, '★★ 아무거나 골라 썼습니다');
  assert.ok(w.calls.toasts.some((t) => /2곳 있습니다/.test(t)));
});

test('③ 번호는 없고 이름만 같은 업체가 있으면 멈추고 계약 창(사람이 고른다)을 권한다', async () => {
  const other = Object.assign(clone(OLD), { bizNo: '999-99-99999' });
  const w = world({ tree: { 'co-a': other }, answers: [true] });
  await w.ctx.cardErpSync('c1');
  assert.equal(w.db.calls.tx.length, 0, '★★ 이름만 같은 다른 회사에 썼습니다');
  assert.match(w.calls.confirms[0], /다른 사업자번호로/);
  assert.equal(w.calls.goApp.length, 1, '「예」면 계약 창으로 간다');
});

test('③ 명함에 번호가 없으면 이름으로 찾되 «묻는다» — 아니오면 안 쓴다', async () => {
  const w = world({ card: { bizno: '' }, tree: { 'co-a': clone(OLD) }, answers: [false] });
  await w.ctx.cardErpSync('c1');
  assert.match(w.calls.confirms[0], /같은 회사로 보고 이어 붙일까요/, '★★ 이름만으로 묻지도 않고 이어 붙입니다');
  assert.equal(w.db.calls.tx.length, 0);
  const yes = world({ card: { bizno: '' }, tree: { 'co-a': clone(OLD) }, answers: [true] });
  await yes.ctx.cardErpSync('c1');
  assert.equal(coList(yes.db)[0].typeCode, '자문');
});

test('③ 번호도 없고 찾지도 못하면 «묻고» 새로 만든다', async () => {
  const no = world({ card: { bizno: '' }, answers: [false] });
  await no.ctx.cardErpSync('c1');
  assert.match(no.calls.confirms[0], /사업자번호 없이/, '★ 번호 없이 만들면 두 줄이 될 수 있다고 알려야 합니다');
  assert.equal(coList(no.db).length, 0);
  const yes = world({ card: { bizno: '' }, answers: [true] });
  await yes.ctx.cardErpSync('c1');
  assert.equal(coList(yes.db).length, 1);
});

test('③ 옛 배열 꼴·자리 어긋남이면 안 쓴다', async () => {
  const arr = world({ tree: [clone(OLD)] });
  await arr.ctx.cardErpSync('c1');
  assert.equal(arr.db.calls.tx.length, 0, '★★ 배열에 v/{id} 자리를 만들면 목록이 반쯤 객체가 됩니다');
  assert.ok(arr.calls.toasts.some((t) => /옛 꼴/.test(t)));
  const off = world({ tree: { 'k-9': clone(OLD) } });            // 자리 이름 ≠ id
  await off.ctx.cardErpSync('c1');
  assert.equal(off.db.calls.tx.length, 0, '★★ 관문이 v/{id} 에 써서 같은 업체가 두 줄이 됩니다');
  assert.ok(off.calls.toasts.some((t) => /자리가 어긋나/.test(t)));
});

test('③ 안 골랐거나 로그인·관문이 없으면 읽지도 쓰지도 않는다', async () => {
  const none = world({ picked: [] });
  await none.ctx.cardErpSync('c1');
  assert.equal(none.db.calls.reads, 0);
  assert.ok(none.calls.toasts.some((t) => /하나를 골라/.test(t)));
  const demo = world({ mode: 'local' });
  await demo.ctx.cardErpSync('c1');
  assert.equal(demo.db.calls.reads, 0);
  const other = world({ items: { c9: Object.assign({}, CARD, { id: 'c9' }) } });
  await other.ctx.cardErpSync('c9');                            // 열어 둔 명함과 다르다
  assert.equal(other.db.calls.reads, 0);
});

// ══════ ④ 끝난 업체 ═════════════════════════════════════════════════
test('④ 끝난 업체는 «묻고» 되살린다 — 아니오면 그대로', async () => {
  const ended = Object.assign(clone(OLD), { typeCode: '자문', status: 'closed' });
  const no = world({ tree: { 'co-a': clone(ended) }, answers: [false] });
  await no.ctx.cardErpSync('c1');
  assert.match(no.calls.confirms[0], /끝난 업체/);
  assert.equal(no.db.calls.tx.length, 0, '★★ 묻지 않고 되살렸습니다');
  const yes = world({ tree: { 'co-a': clone(ended) }, answers: [true] });
  await yes.ctx.cardErpSync('c1');
  const co = coList(yes.db)[0];
  assert.equal(co.status, 'active', '★★ 끝난 채면 업체관리에 안 나옵니다');
  assert.equal(co.cardSync.before.status, 'closed', '되돌릴 근거');
});

// ══════ ⑤ 그사이 누가 고쳤으면 ═══════════════════════════════════════
test('⑤ 읽은 뒤 누가 먼저 고쳤으면 덮지 않고 실패를 말한다 · u 도 안 올린다', async () => {
  const w = world({ tree: { 'co-a': clone(OLD) } });
  const realRef = w.db.ref.bind(w.db);
  w.db.ref = (p) => {
    const r = realRef(p);
    if (p === 'data/companies/v') {
      const once = r.once;
      r.once = async () => { const s = await once(); w.db.meddle('data/companies/v/co-a', (c) => Object.assign(c, { revision: 4, phone: '누가 고침' })); return s; };
    }
    return r;
  };
  await w.ctx.cardErpSync('c1');
  assert.equal(w.db.get('data/companies/v/co-a').phone, '누가 고침', '★★ 남이 고친 것을 덮었습니다');
  assert.equal(w.db.calls.sets.length, 0, '★ 못 썼는데 다른 앱에 바뀌었다고 알렸습니다');
  assert.ok(w.calls.toasts.some((t) => /올리지 못했습니다/.test(t)), '★ 실패를 말하지 않습니다');
  assert.ok(!/이어 붙였습니다/.test(w.els.cardErpM.innerHTML), '★★ 못 썼는데 「올렸습니다」 창이 뜹니다');
});

// ══════ 주담당 고르개 ════════════════════════════════════════════════
test('주담당 고르개는 재직자만, 사번 차례', () => {
  const w = world({});
  const rows = clone(w.ctx.cardErpStaffOpts({
    a: { sid: 'P-009', name: '나중', ord: 9, status: 'active' },
    b: { sid: 'P-002', name: '먼저', ord: 2, status: 'active' },
    c: { sid: 'P-005', name: '퇴사', ord: 5, status: 'retired' },
    d: { sid: '', name: '사번없음', ord: 1 } }));
  assert.deepEqual(rows.map((r) => r.name), ['먼저', '나중']);
});

// ══════ ⑥ 업무관리가 새 업체를 «새로고침 없이» 본다 ═══════════════════
test('⑥ 업무관리 — 업체관리 u 가 울리면 들고 있던 업체 사본을 버린다 (다른 갈래는 안 버린다)', () => {
  const handlers = {};
  const ctx = { PE_DEF: [['contract'], ['companies']], PE_KEYS: { contract: 'contracts', companies: 'companies' },
    _peWatching: false, coSrc: [{ id: 'old' }], bumps: 0,
    fbDb: { ref: (p) => ({ on: (ev, fn) => { handlers[p] = fn; } }) } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(WORK, 'function peWatch(') + '\nfunction peBump(){ bumps++; }', ctx);
  ctx.peWatch();
  handlers['data/contracts/u']();
  assert.ok(ctx.coSrc, '계약이 바뀌었다고 업체 사본까지 버릴 까닭은 없다');
  handlers['data/companies/u']();
  assert.equal(ctx.coSrc, null, '★★ 사본을 안 버리면 기업정보함에서 올린 자문사가 새로고침 전까지 안 뜹니다');
  assert.ok(ctx.bumps >= 2, '다시 읽기(peBump)는 그대로 부른다');
});

test('공용 저장 관문이 기업정보함에 실려 있다 — 없으면 「올리기」가 안 된다', () => {
  assert.match(CARDS, /<script src="js\/pu-ontology-write\.js\?v=\d+"[^>]*><\/script>\n(?:<!--[^\n]*-->\n)?<script src="js\/pu-company-write\.js\?v=\d+"><\/script>/,
    '★★ 관문(pu-company-write)이 온톨로지 관문 «뒤»에 실려야 합니다');
});
