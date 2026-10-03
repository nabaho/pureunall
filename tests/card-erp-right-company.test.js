'use strict';
/* 🔗 명함에 회사 이름이 틀렸을 때 — 「이 회사가 맞나요?」 (대표 지시 2026-10-03 · 목업 「추천대로」)
   「자문 또는 기타 급여등의 업체인데 명함 저장이 잘못되거나 다른회사이름으로 되어 있어
    이런회사를 관리회사로 등록 하려고 하는데」

   ■ 무엇이 문제였나
     「🏢 업체관리에 올리기」가 «명함에 적힌 이름 그대로» 찾아서, 이름이 틀리면 이미 있는
     거래처를 못 찾고 «틀린 이름으로 업체가 하나 더» 생겼다(같은 회사 두 줄).
   ■ 대표 결정: ㉮ 명함 이름은 «그대로» 두고 잇기만 ㉯ 같은 이름 명함도 «함께» 잇기

   ■ 여기서 못 박는 것 — 전부 «실제로 돌린다» (진짜 공용 저장 관문 + 가짜 파이어베이스)
     ① 후보는 이름보다 번호·메일·전화를 믿는다 · 무료 메일·세무사무실 메일은 안 쓴다
     ② 고르면 «그 업체»에 붙는다 — 새 업체가 안 생긴다 · 업체 이름도 명함 이름도 안 바뀐다
     ③ 명함(과 같은 이름 명함)에 업체 열쇠를 적는다 — 이미 «다른» 업체로 정한 명함은 안 건드린다
     ④ 틀린 이름으로 찾은 사업자등록증은 «안 쓴다» (남의 대표자·주소가 들어간다)
     ⑤ 헷갈리면 멈추거나 묻는다 (고른 업체가 사라짐 · 번호가 다름 · 고르지 않았는데 강한 후보)
     ⑥ ✏ 바로잡은 번호가 이미 있으면 새로 안 만든다
     ⑦ ✏ 수정 저장이 확정한 열쇠를 지우지 않는다
   ⚠ 예시는 가짜다 — 사업자번호는 «123-» 으로 시작한다(no-real-client-data 문지기). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const PuCompanyWrite = require('../js/pu-company-write.js');

const R = path.join(__dirname, '..');
const CARDS = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const clone = (x) => JSON.parse(JSON.stringify(x));
const NOW = 1790000000000;

function fakeDb(tree) {
  const root = { data: { companies: { v: tree === undefined ? {} : tree } } };
  const calls = { sets: [], tx: [] };
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), root);
  const put = (p, v) => {
    const ks = p.split('/'); let o = root;
    ks.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v;
  };
  return { root, calls, get,
    ref(p) { return {
      once: async () => { const v = clone(get(p)); return { val: () => (v === undefined ? null : clone(v)) }; },
      set: async (v) => { calls.sets.push([p, v]); put(p, v); },
      transaction: async (fn) => { const cur = get(p); const next = fn(cur === undefined ? null : clone(cur));
        if (next === undefined) return { committed: false, snapshot: { val: () => cur } };
        calls.tx.push([p, clone(next)]); put(p, clone(next)); return { committed: true, snapshot: { val: () => next } }; }
    }; } };
}

const grab = (re) => (CARDS.match(re) || [''])[0];
const PARTS = [
  grab(/const esc = s => [^\n]+/).replace('const esc', 'var esc'),
  grab(/const _norm = s => [^\n]+/).replace('const _norm', 'var _norm'),
  grab(/const CARD_ERP_TYPES = [^;]+;\nconst CARD_ERP_SEED_KEY = [^;]+;/).replace(/const /g, 'var '),
  grab(/const CARD_ERP_ENDED = [^;]+;\nconst CARD_ERP_AUTO = [^;]+;/).replace(/const /g, 'var '),
  grab(/const MB_PUB_DOM = \[[^\]]+\];/).replace('const MB_PUB_DOM', 'var MB_PUB_DOM'),
  ...['function mbDomOf(', 'function erpNormName(', 'function erpNormBiz(', 'function cardErpBizOf(',
    'function cardErpPerson(', 'function cardErpFind(', 'function cardErpNewRec(', 'function cardErpNoteLine(',
    'function cardErpMerge(', 'function cardErpStaffOpts(', 'async function cardErpSync(', 'function cardErpDone(',
    'function cardErpSeed(', 'function cardErpHtml(', 'function sendToErp(', 'function closeCardErp(',
    'function cardErpGo(', 'function cardErpCandidates(', 'function cardErpSiblings(', 'function cardErpTarget(',
    'function cardErpPinCards(', 'function cardErpWhoHtml(', 'function cardErpWhoPaint(', 'function cardErpChoose(',
    'function cardErpRepick(', 'function cardErpFixStart(', 'function cardErpWho(', 'function cardErpBizFor(',
    'function cardPinMark('].map((d) => cutFn(CARDS, d)),
  'var _cardErpId = ""; var _cardErpPicked = []; var _cardErpPin = ""; var _cardErpFix = null; var _cardErpCands = [];',
  'var DB_ROOT = "pucards";'
].join('\n');

/* 업체관리의 진짜 거래처 — 명함과 «이름이 다르다» */
const REAL = { id: 'co-9', name: '㈜가나정보통신', bizNo: '123-45-67891', typeCode: '급여', status: 'active',
  phone: '02-100-0000', email: 'office@gana.example', contacts: [] };
/* ErpMatch.byId 에 실리는 꼴(pu-cards ErpMatch.load 가 만드는 rec) */
const recOf = (co, extra) => Object.assign({ id: co.id, company: co.name, bizNo: co.bizNo || '', type: co.typeCode || '',
  main: '', left: false, phone: co.phone || '', email: co.email || '', taxInvoiceEmail: co.taxInvoiceEmail || '',
  taxEmail: co.taxEmail || '', people: (co.contacts || []).map((c) => ({ email: c.email || '', bizPhone: c.bizPhone || '' })) }, extra || {});
/* 명함 — 회사 이름이 틀렸다(약칭·손글씨 줄임). 사업자번호 없음 */
const CARD = { id: 'c1', kind: 'card', name: '홍길동', company: '가나시스템즈 (손', title: '대표이사',
  mobile: '010-1111-2222', tel: '02-111-2222', email: 'hong@gana.example', companyTel: '02-100-0000' };

function world(o) {
  o = o || {};
  const db = fakeDb(o.tree === undefined ? { 'co-9': clone(REAL) } : o.tree);
  const pin = [];
  const calls = { toasts: [], confirms: [], goApp: [], seed: null };
  const answers = (o.answers || []).slice();
  const els = { cardErpM: { innerHTML: '' }, cardErpWho: { innerHTML: '' },
    cardErpBg: { classList: { on: false, add() { this.on = true; }, remove() { this.on = false; } } },
    cardErpSid: { value: '' }, cardErpSib: { checked: o.sib !== false },
    cardErpFixName: { value: o.fixName || '' }, cardErpFixBiz: { value: o.fixBiz || '' } };
  const items = Object.assign({ c1: Object.assign({}, CARD, o.card || {}) }, o.items || {});
  const byId = {}; (o.recs || [recOf(REAL)]).forEach((r) => { byId[r.id] = r; });
  const ctx = {
    console, Date: class extends Date { static now() { return NOW; } },
    toast: (m) => calls.toasts.push(m),
    confirm: (m) => { calls.confirms.push(m); return answers.length ? answers.shift() : false; },
    $: (id) => els[id],
    document: { getElementById: (id) => els[id] || null,
      querySelectorAll: () => (o.picked || ['급여']).map((v) => ({ value: v })) },
    localStorage: { setItem: (k, v) => { calls.seed = JSON.parse(v); } },
    PuAppBar: { goApp: (u, p) => calls.goApp.push([u, p]) },
    PuCompanyWrite,
    Store: { mode: 'firebase', _rootOf: () => 'pucards',
      db: { ref: () => ({ update: async (u) => { pin.push(clone(u)); } }) } },
    firebase: { auth: () => ({ currentUser: { email: 'p001@pureun.kr' } }), database: () => db },
    ErpMatch: { ready: true, match: (it) => (it && it.erpCoId && byId[it.erpCoId]) || null,
      byId, companies: Object.values(o.tree || { 'co-9': REAL }), staff: {}, load: () => {} },
    state: { items }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(PARTS, ctx);
  ctx.sendToErp('c1');
  return { ctx, db, pin, calls, els, items };
}
const coList = (db) => Object.values(db.get('data/companies/v') || {});
const pinned = (w) => { const out = {}; w.pin.forEach((u) => Object.keys(u).forEach((k) => {
  const m = k.match(/^pucards\/items\/([^/]+)\/erpCoId$/); if (m) out[m[1]] = u[k]; })); return out; };

/* ══════════ ① 후보 ══════════ */

test('★★★ 이름이 틀려도 «같은 메일 주소»로 진짜 거래처를 맨 위에 올린다', () => {
  const w = world();
  const c = w.ctx._cardErpCands;
  assert.ok(c.length >= 1, '★★★ 후보가 없습니다 — 이름이 틀리면 진짜 거래처를 영영 못 찾습니다');
  assert.equal(c[0].rec.id, 'co-9');
  assert.ok(c[0].why.some((x) => /같은 메일 주소 @gana\.example/.test(x)), '까닭에 메일 주소가 없습니다: ' + c[0].why);
  assert.ok(c[0].why.some((x) => /같은 회사 전화/.test(x)), '까닭에 회사 전화가 없습니다');
  assert.match(w.els.cardErpM.innerHTML, /이 명함의 회사가 맞나요\?/, '창 맨 위에 묻는 자리가 없습니다');
  assert.match(w.els.cardErpM.innerHTML, /cardErpChoose\('c1','co-9'\)">이 회사예요/, '「이 회사예요」 단추가 없습니다');
});

test('★★ 무료 메일(네이버 등)·세무사무실 메일은 «회사를 가리키는 까닭»으로 안 쓴다', () => {
  const w = world();
  const tax = recOf({ id: 'co-t', name: '다라세무회계' }, { taxEmail: 'hong@gana.example' });
  const nav = recOf({ id: 'co-n', name: '마바상사', email: 'boss@naver.com' });
  const c = w.ctx.cardErpCandidates(Object.assign({}, CARD, { email: 'hong@naver.com', companyTel: '', tel: '' }), [tax, nav]);
  assert.equal(c.length, 0, '★★ 무료 메일·세무사무실 메일로 엉뚱한 업체를 후보로 냈습니다: ' + c.map((x) => x.rec.company));
  const c2 = w.ctx.cardErpCandidates(Object.assign({}, CARD, { companyTel: '', tel: '' }), [tax]);
  assert.equal(c2.length, 0, '★★ 세무사무실 메일은 여러 업체를 맡습니다 — 그것으로 잇면 남의 회사가 됩니다');
});

test('★★ 믿는 차례 — 사업자번호 > 메일 > 전화 > 이름 · 이름만 비슷한 것은 «약한 까닭»', () => {
  const w = world();
  const byNo = recOf({ id: 'a', name: '전혀다른이름', bizNo: '123-45-67890' });
  const byName = recOf({ id: 'b', name: '가나시스템즈' });
  const byMail = recOf({ id: 'c', name: '라마물산', email: 'x@gana.example' });
  const it = Object.assign({}, CARD, { bizno: '123-45-67890', companyTel: '', tel: '' });
  const c = w.ctx.cardErpCandidates(it, [byName, byMail, byNo]);
  /* ⚠ 상자(vm) 안 배열은 다른 세계의 Array 다 — Array.from 으로 옮겨 견준다 */
  assert.deepEqual(Array.from(c, (x) => x.rec.id), ['a', 'c', 'b'], '★★ 이름이 번호·메일보다 앞에 섰습니다 — 이름은 틀릴 수 있어 이 창이 생겼습니다');
  assert.ok(c[2].why.indexOf('이름이 비슷함') >= 0);
  /* 이름이 «똑같아도» 번호가 이긴다 — 이름은 사람이 적는 글자다 */
  const twin = recOf({ id: 'd', name: '가나시스템즈 (손' });
  const c3 = w.ctx.cardErpCandidates(it, [twin, byNo]);
  assert.deepEqual(Array.from(c3, (x) => x.rec.id), ['a', 'd'], '★★ 이름이 똑같은 업체가 번호가 같은 업체보다 앞섰습니다');
  assert.ok(c3[1].why.indexOf('같은 이름') >= 0);
  /* 창은 «열 때 센» 후보를 그린다 — 그 자리에 이 후보를 넣고 그린다 */
  w.ctx._cardErpCands = c;
  assert.match(w.ctx.cardErpWhoHtml(it, null, null).replace(/\s+/g, ' '), /cerp-why weak">이름이 비슷함/,
    '이름만 비슷한 것은 약한 까닭으로 보여야 합니다');
  assert.equal(w.ctx.cardErpCandidates(CARD, []).length, 0, '업체관리를 못 읽었으면 후보가 없다(멈추지 않는다)');
});

/* ══════════ ② 고르면 그 업체에 ══════════ */

test('★★★ 고르면 «그 업체»에 붙는다 — 새 업체가 안 생기고, 업체 이름·명함 이름은 그대로', async () => {
  const w = world();
  w.ctx.cardErpChoose('c1', 'co-9');
  assert.match(w.els.cardErpWho.innerHTML, /가나정보통신[\s\S]*로 잇습니다/, '고른 뒤 무엇으로 잇는지 말해야 합니다');
  await w.ctx.cardErpSync('c1');
  const list = coList(w.db);
  assert.equal(list.length, 1, '★★★ 고른 업체가 있는데 새 업체가 생겼습니다 — 같은 회사가 두 줄이 됩니다');
  assert.equal(list[0].name, '㈜가나정보통신', '★★ 업체관리의 이름을 명함의 틀린 이름으로 바꿨습니다');
  assert.equal(list[0].contacts.length, 1, '담당자가 안 붙었습니다');
  assert.equal(list[0].contacts[0].name, '홍길동');
  assert.equal(w.items.c1.company, '가나시스템즈 (손', '★★ ㉮ 명함에 적힌 이름은 «그대로» 둡니다');
  assert.equal(w.calls.confirms.length, 0, '고른 업체로 갈 때는 이름으로 찾았다고 다시 묻지 않는다');
});

test('★★★ 명함과 «같은 이름» 명함에 업체 열쇠를 적는다 — ㉯ 함께 잇기', async () => {
  const w = world({ items: {
    c2: { id: 'c2', kind: 'card', name: '임꺽정', company: '가나시스템즈(손' },          /* 같은 이름(띄어쓰기만 다름) */
    c3: { id: 'c3', kind: 'card', name: '김철수', company: '가나시스템즈 (손', erpCoId: 'co-x' }, /* 이미 다른 업체로 정함 */
    c4: { id: 'c4', kind: 'card', name: '박영희', company: '다른회사' },
    b1: { id: 'b1', kind: 'biz', company: '가나시스템즈 (손' } } });
  w.ctx.cardErpChoose('c1', 'co-9');
  await w.ctx.cardErpSync('c1');
  const p = pinned(w);
  assert.deepEqual(Object.keys(p).sort(), ['c1', 'c2'], '★★★ 함께 잇는 명함이 틀렸습니다: ' + JSON.stringify(p));
  assert.equal(p.c1, 'co-9');
  assert.equal(w.items.c3.erpCoId, 'co-x', '★★ 이미 «다른» 업체로 정한 명함을 덮었습니다 — 사람이 정한 것입니다');
  assert.equal(w.items.c1.erpCoId, 'co-9', '화면 쪽 명함에도 바로 적혀야 배지가 따라갑니다');
  assert.ok(w.pin.every((u) => Object.keys(u).every((k) => /\/(erpCoId|updatedAt)$/.test(k))),
    '★★ 명함의 «두 칸»만 고쳐야 합니다 — 통째로 쓰면 남이 고친 칸을 덮습니다');
  assert.match(w.els.cardErpM.innerHTML, /명함 <b>2장<\/b>을 이 업체로 확정했습니다/);
});

test('★ 「함께 잇기」를 끄면 그 명함만', async () => {
  const w = world({ sib: false, items: { c2: { id: 'c2', kind: 'card', company: '가나시스템즈 (손' } } });
  w.ctx.cardErpChoose('c1', 'co-9');
  await w.ctx.cardErpSync('c1');
  assert.deepEqual(Object.keys(pinned(w)), ['c1']);
});

test('★★★ 틀린 이름으로 찾은 사업자등록증은 «안 쓴다» — 남의 대표자·주소가 들어간다', async () => {
  /* 명함의 틀린 이름과 «같은 이름»의 등록증 — 번호가 고른 업체와 다르다(남의 회사) */
  const wrongBiz = { id: 'b9', kind: 'biz', company: '가나시스템즈 (손', bizno: '123-45-67892',
    ceo: '남의대표', address: '남의 주소', bizType: '남의업태' };
  const tree = { 'co-9': Object.assign(clone(REAL), { ceo: '', address: '', bizType: '' }) };
  const w = world({ tree, items: { b9: wrongBiz } });
  w.ctx.cardErpChoose('c1', 'co-9');
  await w.ctx.cardErpSync('c1');
  const co = coList(w.db)[0];
  assert.notEqual(co.ceo, '남의대표', '★★★ 다른 회사 등록증의 대표자가 들어갔습니다');
  assert.notEqual(co.bizType, '남의업태', '★★★ 다른 회사 등록증의 업태가 들어갔습니다');
});

/* ══════════ ⑤ 헷갈리면 멈추거나 묻는다 ══════════ */

test('★★★ 고르지 않았는데 «번호·메일·전화가 맞는» 업체가 있으면 묻는다 — 아니오면 아무것도 안 쓴다', async () => {
  const w = world({ answers: [false] });
  await w.ctx.cardErpSync('c1');
  assert.equal(w.calls.confirms.length, 1, '★★★ 묻지 않고 틀린 이름으로 새 업체를 만들려 했습니다');
  assert.match(w.calls.confirms[0], /가나정보통신/);
  assert.equal(coList(w.db).length, 1, '아니오면 새 업체가 안 생겨야 합니다');
  assert.equal(w.db.calls.tx.length, 0);
  assert.equal(w.pin.length, 0, '고르지 않았으면 명함에 아무것도 안 적는다');
});

test('★★ 고른 업체가 그사이 사라졌으면 멈춘다 · 번호가 서로 다르면 묻는다', async () => {
  const w = world({ tree: {} });
  w.ctx.cardErpChoose('c1', 'co-9');
  await w.ctx.cardErpSync('c1');
  assert.ok(w.calls.toasts.some((t) => /고른 업체가 업체관리에 없습니다/.test(t)), '★★ 없는 업체에 쓰려 했습니다');
  assert.equal(w.db.calls.tx.length, 0);
  assert.equal(w.pin.length, 0, '★★ 없는 업체를 명함에 적었습니다');

  const w2 = world({ card: { bizno: '123-45-67899' }, answers: [false] });
  w2.ctx.cardErpChoose('c1', 'co-9');
  await w2.ctx.cardErpSync('c1');
  assert.ok(w2.calls.confirms.some((m) => /번호.*다릅니다/.test(m)), '★★ 번호가 다른데 묻지 않았습니다 — 잘못 골랐을 수 있습니다');
  assert.equal(w2.db.calls.tx.length, 0, '아니오면 안 쓴다');
});

/* ══════════ ⑥ ✏ 업체관리에 없는 회사 ══════════ */

test('★★★ ✏ 바로잡은 번호가 «이미 있으면» 새로 안 만들고 거기에 잇는다', async () => {
  const w = world({ fixName: '가나정보통신', fixBiz: '123-45-67891' });
  w.ctx.cardErpFixStart('c1');
  await w.ctx.cardErpSync('c1');
  assert.equal(coList(w.db).length, 1, '★★★ 같은 번호의 업체가 있는데 새로 만들었습니다');
  assert.equal(pinned(w).c1, 'co-9', '바로잡아 찾은 그 업체로 명함을 확정해야 합니다');
});

test('★★ ✏ 정말 없는 회사면 «바로잡은» 상호·번호로 새로 만들고, 명함 이름은 그대로', async () => {
  const w = world({ tree: {}, recs: [], fixName: '㈜다라정보', fixBiz: '123-45-67893' });
  w.ctx.cardErpFixStart('c1');
  await w.ctx.cardErpSync('c1');
  const list = coList(w.db);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, '㈜다라정보', '★★ 명함의 틀린 이름으로 업체를 만들었습니다');
  assert.equal(list[0].bizNo, '123-45-67893');
  assert.equal(w.items.c1.company, '가나시스템즈 (손', '★ 명함 이름은 그대로');
  assert.equal(pinned(w).c1, list[0].id, '새로 만든 업체로 명함을 확정해야 다음에 이름이 달라도 이어집니다');
  /* 올린 뒤 「📋 계약 창 열기」 — 바로잡은 칸은 창에서 «사라졌어도» 그 업체로.
     ⚠ 진짜 화면처럼 칸을 걷는다 — 안 걷으면 사라진 칸을 읽어 통과해 버린다 */
  delete w.els.cardErpFixName; delete w.els.cardErpFixBiz;
  w.ctx.document.querySelectorAll = () => [];
  w.ctx.cardErpGo('c1');
  assert.ok(w.calls.seed, '★ 올린 뒤 계약 창이 안 열립니다');
  assert.equal(w.calls.seed.company.name, '㈜다라정보', '★★ 올린 뒤 계약 창에 명함의 틀린 이름이 갔습니다');
});

test('★★ ✏ 상호를 명함의 틀린 이름으로 «미리 안 채운다» — 비우고 누르면 안 올린다', async () => {
  const w = world({ tree: {}, recs: [] });
  w.ctx.cardErpFixStart('c1');
  assert.match(w.els.cardErpWho.innerHTML, /id="cardErpFixName" value=""/,
    '★★ 상호 칸이 명함의 틀린 이름으로 채워져 있습니다 — 그대로 누르면 틀린 이름으로 업체가 생깁니다');
  assert.match(w.els.cardErpWho.innerHTML, /placeholder="진짜 상호 \(명함에는 「가나시스템즈 \(손」\)"/,
    '명함 이름은 안내 글자로 보여야 합니다');
  await w.ctx.cardErpSync('c1');
  assert.ok(w.calls.toasts.some((t) => /상호를 적어 주세요/.test(t)), '★ 상호 없이 올리려 했습니다');
  assert.equal(coList(w.db).length, 0);
});

test('★ 계약 창만 — 고른 업체의 상호·번호로 쪽지를 놓는다', () => {
  const w = world();
  w.ctx.cardErpChoose('c1', 'co-9');
  w.ctx.cardErpGo('c1');
  assert.equal(w.calls.seed.company.name, '㈜가나정보통신', '★★ 계약 창에 명함의 틀린 이름이 갔습니다');
  assert.equal(w.calls.seed.company.bizNo, '123-45-67891');
  assert.ok(w.pin.length >= 1, '골랐으면 계약 창으로 가도 명함을 확정한다');
});

test('★ 이미 확정해 둔 명함은 그 업체를 «고른 채로» 연다', () => {
  const w = world({ card: { erpCoId: 'co-9' } });
  assert.equal(w.ctx._cardErpPin, 'co-9');
  assert.match(w.els.cardErpM.innerHTML, /로 잇습니다/);
});

test('★ 「이 회사예요」 단추는 «제 크기만» — 창 안의 단추는 칸을 채우게 되어 있다', () => {
  /* 2026-10-03 실제로 그려 보니 단추가 줄의 절반을 먹어 회사 정보·까닭이 잘려 나갔다 */
  const rule = (CARDS.match(/\.cerp-mini\{([^}]*)\}/) || [])[1] || '';
  assert.match(rule, /flex:\s*none/, '★ 단추가 칸을 채워 후보의 회사 정보·까닭을 짓누릅니다');
});

/* ══════════ 목록 · ✏ 수정 저장 ══════════ */

test('★ 목록 회사 칸 🔗 — 확정 업체 이름이 «다를 때만», 무엇인지는 말풍선에', () => {
  const w = world();
  assert.equal(w.ctx.cardPinMark(CARD), '', '확정이 없으면 아무것도 안 그린다');
  const m = w.ctx.cardPinMark(Object.assign({}, CARD, { erpCoId: 'co-9' }));
  assert.match(m, /🔗/);
  assert.match(m, /가나정보통신.*123-45-67891.*확정됨/);
  const same = Object.assign({}, CARD, { company: '가나정보통신', erpCoId: 'co-9' });
  assert.equal(w.ctx.cardPinMark(same), '', '이름이 같으면 굳이 안 그린다(칸이 좁다)');
  assert.match(CARDS, /col-company" ondblclick="startCellEdit\(event,'\$\{it\.id\}','company'\)">\$\{cardPinMark\(it\)\}/,
    '★ 목록 회사 칸이 🔗 를 안 그립니다');
});

test('★★★ ✏ 수정 저장이 확정한 업체 열쇠를 «지우지 않는다» — 저장이 명함을 통째로 덮는다', () => {
  const fn = cutFn(CARDS, 'async function saveEditor(');
  const carry = fn.indexOf('it.erpCoId = state.items[editing.id].erpCoId');
  const put = fn.indexOf('Store.put(it)');
  assert.ok(carry > 0, '★★★ 수정 저장이 erpCoId 를 안 넘겨받습니다 — 한 번 고치면 정한 업체가 사라집니다');
  assert.ok(carry < put, '★★ 넘겨받기가 저장 «뒤»에 있습니다');
});
