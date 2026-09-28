'use strict';
/* 🏢 명함 → 푸른이알피 계약 창 (대표 지시 2026-09-28)
   「명함에 기존에는 자문사가 아니었다가 자문사로 바뀌는 경우가 있다. 이럴 경우 어떻게
    선택해서 자문, 급여, 기금, 노조 관리 등으로 푸른이알피와 연결시킬 수 있게」

   ■ 무엇이 있었나
     명함의 「🏢 ERP 거래처로 등록」이 업체관리(data/companies)에 «직접» 한 줄을 썼다 —
     유형·상태가 비어 업체관리 어느 탭에도 안 나오는 «반쪽 업체»가 생겼다.
   ■ 이 검사가 지키는 것 (전부 «실제로 돌려» 본다 — 글자만 보면 기능을 꺼도 통과한다)
     ① 명함 쪽은 아무것도 쓰지 않는다. 쪽지(localStorage)만 놓고 계약 창을 연다
     ② 쪽지에는 값이 있는 칸만 — 회사 칸에는 회사 번호, 사람 번호는 담당자 줄로
     ③ 여럿 고르면 첫째가 유형, 나머지는 메모
     ④ 푸른이알피는 두 자리(이 탭·다른 탭) 모두에서 쪽지를 꺼내고, 한 번 쓰고 지운다
     ⑤ 유형표에 없는 유형은 안 찍는다
     ⑥ 쓰다 만 계약이 있으면 묻는다 — 조용히 덮거나 조용히 버리지 않는다
     ⑦ 이미 열려 있는 푸른이알피도 듣는다. 창이 열려 있으면 안 바꾼다 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const CARDS = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const clone = (x) => JSON.parse(JSON.stringify(x));

function between(src, from, to) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, '못 찾았다: ' + from.slice(0, 40));
  const b = src.indexOf(to, a);
  assert.ok(b > a, '끝을 못 찾았다: ' + to.slice(0, 40));
  return src.slice(a, b + to.length);
}
function store(init) {
  const d = Object.assign({}, init || {});
  return { d, getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); },
           removeItem: (k) => { delete d[k]; } };
}
const SEED_VARS = (ERP.match(/var ERP_CT_SEED_KEY = [^;]+;\s*var ERP_CT_SEED_TTL = [^;]+;/) || [''])[0];
function erpHelpers(extra) {
  const ctx = Object.assign({ CURRENT_USER: { sid: 'P-001' } }, extra || {});
  vm.createContext(ctx);
  vm.runInContext([SEED_VARS,
    cutFn(ERP, 'function erpTakeContractSeed('),
    cutFn(ERP, 'function erpSeedCompanyType('),
    cutFn(ERP, 'function erpSeedContacts('),
    cutFn(ERP, 'function erpContactsBlank('),
    cutFn(ERP, 'function erpContractDraftKey(')].join('\n'), ctx);
  return ctx;
}
const NOW = 1790000000000;

// ══════ 푸른이알피 — 쪽지 꺼내기 ══════════════════════════════════════
test('④ 다른 탭(기업정보함)이 localStorage 에 놓은 쪽지를 꺼낸다 — sessionStorage 만 보면 안 닿는다', () => {
  const c = erpHelpers();
  const ss = store(), ls = store({ pu_new_contract: JSON.stringify({ company: { name: '가온' }, at: NOW - 5000 }) });
  const seed = c.erpTakeContractSeed([ss, ls], NOW);
  assert.ok(seed && seed.company.name === '가온', '★★ 이미 열려 있는 푸른이알피에 쪽지가 안 닿습니다');
  assert.ok(!('pu_new_contract' in ls.d), '★ 안 지우면 계약관리를 열 때마다 또 뜹니다');
});

test('④-1 이 탭의 쪽지(회사 한 장)도 그대로 꺼낸다 — 먼저 본다', () => {
  const c = erpHelpers();
  const ss = store({ pu_new_contract: JSON.stringify({ company: { name: '이탭' }, at: NOW }) });
  const ls = store({ pu_new_contract: JSON.stringify({ company: { name: '다른탭' }, at: NOW }) });
  assert.equal(c.erpTakeContractSeed([ss, ls], NOW).company.name, '이탭');
  assert.equal(c.erpTakeContractSeed([ss, ls], NOW).company.name, '다른탭', '남은 쪽지는 다음 차례에 꺼낸다');
});

test('④-2 오래된·깨진·회사 없는 쪽지는 버리고(지우고) 다음 자리를 본다', () => {
  const c = erpHelpers();
  const stale = store({ pu_new_contract: JSON.stringify({ company: { name: '어제' }, at: NOW - 11 * 60 * 1000 }) });
  const broken = store({ pu_new_contract: '{깨짐' });
  const empty = store({ pu_new_contract: JSON.stringify({ at: NOW }) });
  const good = store({ pu_new_contract: JSON.stringify({ company: { name: '오늘' }, at: NOW }) });
  assert.equal(c.erpTakeContractSeed([stale, broken, empty, good], NOW).company.name, '오늘');
  [stale, broken, empty].forEach((s) => assert.ok(!('pu_new_contract' in s.d), '★ 버린 쪽지를 안 지웠습니다'));
  assert.equal(c.erpTakeContractSeed([store({ pu_new_contract: JSON.stringify({ company: {} }) })], NOW), null,
    '★ 시각이 없는 쪽지는 언제 것인지 모릅니다');
  const throws = { getItem() { throw new Error('막힘'); }, removeItem() {} };
  assert.equal(c.erpTakeContractSeed([throws, null], NOW), null, '저장소가 막혀도 안 터진다');
});

test('⑤ 유형표에 «있는» 유형만 받는다 — 숨긴·없는 유형은 사람이 고른다', () => {
  const c = erpHelpers();
  const types = [{ code: '자문', name: '자문' }, { code: 'pay', name: '급여' }, { code: '노조', name: '노조', hidden: true }];
  assert.equal(c.erpSeedCompanyType({ typeCodes: { company: '자문' } }, types).code, '자문');
  assert.equal(c.erpSeedCompanyType({ typeCodes: { company: '급여' } }, types).code, 'pay', '이름으로 와도 코드로 바꾼다');
  assert.equal(c.erpSeedCompanyType({ typeCodes: { company: '노조' } }, types), null, '★ 숨긴 유형을 찍고 있습니다');
  assert.equal(c.erpSeedCompanyType({ typeCodes: { company: '사무대행' } }, types), null);
  assert.equal(c.erpSeedCompanyType({}, types), null);
});

test('담당자 줄 — 사람이 있는 줄만, 첫 줄이 대표 담당자', () => {
  const c = erpHelpers();
  const rows = clone(c.erpSeedContacts([{ name: '', phone: '' }, { name: '김철수', phone: '010-1' }, { email: 'a@b' }]));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, '김철수');
  assert.equal(rows[0].isPrimary, true);
  assert.equal(rows[1].isPrimary, false);
  assert.ok(rows.every((r) => r.id), '줄마다 열쇠가 있어야 계약 창이 줄을 가른다');
  assert.equal(c.erpContactsBlank([{ id: 'x', name: '', phone: '', email: '' }]), true);
  assert.equal(c.erpContactsBlank([{ name: '누구' }]), false);
  assert.equal(c.erpContactsBlank(null), true);
});

// ══════ 푸른이알피 — 계약 창이 쪽지를 얹는 자리 ══════════════════════
const MERGE = between(ERP, '  if(!props.cur && props.seed && props.seed.company){', '\n  // 옛 데이터 호환');
function merge(seed, cur) {
  const c = erpHelpers({ todayYMD: () => '2026-09-28', props: { seed, cur: cur || null } });
  vm.runInContext(cutFn(ERP, 'function erpBlankContractForm('), c);
  vm.runInContext('var init = erpBlankContractForm();\n' + MERGE, c);
  return clone(c.init);
}

test('⑤-1 업체계약 유형이 오면 갈래·유형이 골라진 채로 열린다', () => {
  const f = merge({ company: { name: '가온' }, typeCodes: { company: '자문' } });
  assert.deepEqual(f.kinds, ['company'], '★ 업체계약 갈래가 안 골라졌습니다');
  assert.equal(f.typeCodes.company, '자문');
  assert.equal(f.companyName, '가온');
});

test('⑤-2 유형이 없으면 갈래를 찍지 않는다 — 근거 없이 찍으면 엉뚱한 사업으로 굳는다', () => {
  const f = merge({ company: { name: '가온' }, typeCodes: {} });
  assert.deepEqual(f.kinds, []);
});

test('② 담당자·메모가 새 계약 창에 들어간다', () => {
  const f = merge({ company: { name: '가온', contacts: [{ name: '김철수', phone: '010-1', role: '과장' }] },
    typeCodes: { company: '자문' }, note: '명함에서 가져옴' });
  assert.equal(f.company.contacts.length, 1);
  assert.equal(f.company.contacts[0].name, '김철수', '★ 빈 서식의 «빈 줄 하나» 때문에 담당자가 안 들어갑니다');
  assert.equal(f.company.contacts[0].isPrimary, true);
  assert.equal(f.note, '명함에서 가져옴');
});

test('고치는 계약(cur)에는 씨앗을 안 얹는다', () => {
  const f = merge({ company: { name: '가온' }, typeCodes: { company: '자문' } }, { id: 'ct-1' });
  assert.deepEqual(f.kinds, [], '★ 고치는 중인 계약의 갈래가 바뀝니다');
});

// ══════ 푸른이알피 — 계약관리 화면이 쪽지를 받는다 ═══════════════════
const TAKE = between(ERP, '  var modalOpenRef = useRef(false);',
  "    return function(){ window.removeEventListener('storage', onSeed); };\n  }, []);");
function screen(opts) {
  const o = opts || {};
  const ss = store(o.ss), ls = store(o.ls);
  const calls = { opened: [], toasts: [], asked: [], effects: [], listeners: {} };
  const c = erpHelpers({
    modal: o.modal || null,
    Date: { now: () => NOW },                               // ⚠ vm 안의 Date 는 바깥 것과 따로다
    useRef: (v) => ({ current: v }),
    useEffect: (fn) => { calls.effects.push(fn); },
    window: { sessionStorage: ss, localStorage: ls,
      addEventListener: (k, fn) => { calls.listeners[k] = fn; }, removeEventListener() {} },
    localStorage: ls,
    dbGet: (k, s) => (o.db && o.db[k]) || s,
    COMPANY_TYPE_SEED: [{ code: '자문', name: '자문' }, { code: '급여', name: '급여' }],
    BIZ_CONS_SEED: [],
    erpConsTypeByDocName: () => o.consType || null,
    popConfirm: async (m, op) => { calls.asked.push({ m, op }); return o.answer; },
    openAdd: (s) => { calls.opened.push(s === null ? null : clone(s)); },
    showToast: (m) => { calls.toasts.push(m); }
  });
  vm.runInContext(TAKE, c);
  return { c, calls, ss, ls };
}
const CARD_SEED = (extra) => JSON.stringify(Object.assign({ company: { name: '가온' },
  typeCodes: { company: '자문' }, note: 'n', at: NOW }, extra || {}));

test('④-3 화면을 열면 쪽지를 꺼내 «채운 창»을 연다 (명함 → 자문)', async () => {
  const realNow = Date.now; Date.now = () => NOW;
  try {
    const { calls, ls } = screen({ ls: { pu_new_contract: CARD_SEED() } });
    calls.effects[0]();                                    // 처음 열 때 (modal 없음)
    assert.equal(calls.opened.length, 1, '★ 창이 안 열립니다');
    assert.equal(calls.opened[0].typeCodes.company, '자문');
    assert.ok(!('pu_new_contract' in ls.d));
    assert.ok(calls.toasts.some((t) => /자문」 업체계약으로 채웠습니다/.test(t)), '★ 무엇으로 골랐는지 말하지 않습니다');
  } finally { Date.now = realNow; }
});

test('⑤-3 유형표에 없는 유형이면 유형을 비워 연다 — 사람이 고른다', async () => {
  const realNow = Date.now; Date.now = () => NOW;
  try {
    const { calls } = screen({ ls: { pu_new_contract: CARD_SEED({ typeCodes: { company: '사무대행' } }) } });
    await calls.effects[0]();
    assert.deepEqual(clone(calls.opened[0].typeCodes), {}, '★ 없는 유형이 그대로 들어갑니다');
    assert.ok(calls.toasts.some((t) => /유형·기간·금액을 골라 주세요/.test(t)));
  } finally { Date.now = realNow; }
});

test('사진첩·회사 한 장의 컨설팅 쪽지는 예전 그대로 — 서류 이름으로 고른 유형이 «창에 넘어간다»', () => {
  const s = screen({ ss: { pu_new_contract: JSON.stringify({ company: { name: '가온' },
    srcPhoto: { name: '현장클리닉 신청서' }, at: NOW }) }, consType: { code: 'C1', name: '현장클리닉' } });
  s.calls.effects[0]();
  assert.equal(s.calls.opened.length, 1);
  assert.equal(s.calls.opened[0].typeCodes.consulting, 'C1', '★★★ 골라 놓고 안 넘기면 창은 옛날 그대로 뜹니다');
  assert.ok(s.calls.toasts.some((t) => /「현장클리닉」 으로 골라 뒀습니다/.test(t)), '★★ 무엇으로 골랐는지 말해야 합니다');
  const none = screen({ ss: { pu_new_contract: JSON.stringify({ company: { name: '가온' },
    srcPhoto: { name: '모르는 서류' }, at: NOW }) } });
  none.calls.effects[0]();
  assert.ok(!none.calls.opened[0].typeCodes, '못 고르면 아무것도 안 얹는다');
});

test('⑥ 쓰다 만 새 계약이 있으면 «묻는다» — 이어 쓰기를 고르면 명함 정보는 안 쓴다', async () => {
  const realNow = Date.now; Date.now = () => NOW;
  try {
    const draft = JSON.stringify({ companyName: '쓰던곳', __savedAt: '2026-09-28T00:00:00Z' });
    const keep = screen({ ls: { pu_new_contract: CARD_SEED(),
      'pureun_v6_contract_draft_P-001_new': draft }, answer: false });
    await keep.c.takeNewContractSeed();
    assert.equal(keep.calls.asked.length, 1, '★★ 묻지 않으면 다른 회사가 든 창이 뜨고 가져온 것은 사라집니다');
    assert.match(keep.calls.asked[0].m, /쓰던곳/);
    assert.deepEqual(keep.calls.opened, [null], '★ 이어 쓰기인데 명함 정보를 얹었습니다');
    assert.ok('pureun_v6_contract_draft_P-001_new' in keep.ls.d, '★★ 이어 쓰기인데 쓰다 만 것을 지웠습니다');

    const fresh = screen({ ls: { pu_new_contract: CARD_SEED(), 'pureun_v6_contract_draft_P-001_new': draft }, answer: true });
    await fresh.c.takeNewContractSeed();
    assert.ok(!('pureun_v6_contract_draft_P-001_new' in fresh.ls.d), '★ 새로 시작인데 쓰다 만 것이 남아 창이 그것을 되살립니다');
    assert.equal(fresh.calls.opened[0].company.name, '가온');

    const none = screen({ ls: { pu_new_contract: CARD_SEED() } });
    await none.c.takeNewContractSeed();
    assert.equal(none.calls.asked.length, 0, '쓰다 만 것이 없으면 묻지 않는다');
  } finally { Date.now = realNow; }
});

test('⑦ 이미 열려 있는 계약관리도 듣는다 — 쓰던 창이 열려 있으면 안 바꾼다', async () => {
  const realNow = Date.now; Date.now = () => NOW;
  try {
    const s = screen({});
    s.calls.effects[1]();                                   // 듣기 시작
    const on = s.calls.listeners.storage;
    assert.ok(typeof on === 'function', '★★ 다른 탭의 쪽지를 안 듣습니다 — 새로고침해야 뜹니다');
    s.ls.setItem('pu_new_contract', CARD_SEED());
    await on({ key: 'pu_new_contract', newValue: 'x' });
    assert.equal(s.calls.opened.length, 1, '★★ 쪽지가 왔는데 창이 안 열립니다');
    on({ key: '다른열쇠', newValue: 'x' });
    on({ key: 'pu_new_contract', newValue: null });         // 지울 때도 이벤트가 온다
    assert.equal(s.calls.opened.length, 1, '엉뚱한 이벤트에 창을 열면 안 된다');

    const busy = screen({ modal: { mode: 'edit' } });
    busy.calls.effects[1]();
    busy.ls.setItem('pu_new_contract', CARD_SEED());
    await busy.calls.listeners.storage({ key: 'pu_new_contract', newValue: 'x' });
    assert.equal(busy.calls.opened.length, 0, '★★ 쓰던 계약 창이 명함 쪽 창으로 바뀌었습니다');
    assert.ok('pu_new_contract' in busy.ls.d, '★ 쪽지를 버리면 창을 닫은 뒤에 못 엽니다');
  } finally { Date.now = realNow; }
});

test('⑦-1 계약 창을 «닫으면» 기다리던 쪽지를 연다 — 효과가 modal 을 보고 돈다', () => {
  assert.match(TAKE, /useEffect\(function\(\)\{ if\(!modal\) takeNewContractSeed\(\); \}, \[modal\]\);/,
    '★ 창을 닫아도 기다리던 쪽지가 안 열립니다');
});

// ══════ 푸른이알피 — 다른 메뉴에 있을 때 계약관리로 옮긴다 ════════════
const NAV = between(ERP, '  /* ★ 다른 탭(기업정보함 명함)이 「새 계약」 쪽지를 놓았을 때', '  }, [current]);');
function app(current, hasModal) {
  const calls = { went: [], toasts: [], on: null };
  const c = { ERP_CT_SEED_KEY: 'pu_new_contract', current,
    useEffect: (fn) => fn(),
    window: { addEventListener: (k, fn) => { calls.on = fn; }, removeEventListener() {} },
    document: { querySelector: (q) => (hasModal && q === '.modal-bg' ? {} : null) },
    selectMenu: (id) => calls.went.push(id), showToast: (m) => calls.toasts.push(m) };
  vm.createContext(c);
  vm.runInContext(NAV, c);
  return calls;
}
test('⑦-2 다른 메뉴에 있으면 계약관리로 옮긴다 · 창이 열려 있으면 안 옮기고 알린다', () => {
  const a = app('biz/company', false);
  a.on({ key: 'pu_new_contract', newValue: 'x' });
  assert.deepEqual(a.went, ['biz/contract'], '★★ 푸른이알피가 다른 화면에 있으면 아무 일도 안 일어납니다');
  const b = app('biz/company', true);
  b.on({ key: 'pu_new_contract', newValue: 'x' });
  assert.deepEqual(b.went, [], '★★ 열린 창을 내리며 쓰던 것을 날립니다');
  assert.ok(b.toasts.length, '★ 안 옮겼으면 왜인지 말해야 합니다');
  const c2 = app('biz/contract', false);
  c2.on({ key: 'pu_new_contract', newValue: 'x' });
  assert.deepEqual(c2.went, [], '계약관리에 있으면 그 화면이 제 귀로 듣는다');
  const d = app('biz/company', false);
  d.on({ key: 'pu_new_contract', newValue: null });
  assert.deepEqual(d.went, []);
});

// ══════ 기업정보함 — 명함에서 고르는 창 ═════════════════════════════
const ESC = (CARDS.match(/const esc = s => [^\n]+/) || [''])[0];
const NORM = (CARDS.match(/const _norm = s => [^\n]+/) || [''])[0];
const TYPES = (CARDS.match(/const CARD_ERP_TYPES = [^;]+;\nconst CARD_ERP_SEED_KEY = [^;]+;/) || [''])[0];
function cards(extra) {
  const calls = { toasts: [], goApp: [], html: {}, bgOpen: false, fb: 0 };
  const ctx = Object.assign({
    toast: (m) => { calls.toasts.push(m); },
    firebase: { database() { calls.fb++; throw new Error('★★ 명함 쪽에서 데이터베이스에 쓰고 있습니다'); } },
    localStorage: store(),
    PuAppBar: { goApp: (u, p) => { calls.goApp.push([u, p]); } },
    ErpMatch: { ready: true, match: () => null }
  }, extra || {});
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext([ESC.replace('const esc', 'var esc'), NORM.replace('const _norm', 'var _norm'),
    TYPES.replace(/const /g, 'var '),
    cutFn(CARDS, 'function erpNormBiz('), cutFn(CARDS, 'function cardErpBizOf('),
    cutFn(CARDS, 'function cardErpSeed('), cutFn(CARDS, 'function cardErpHtml('),
    'var _cardErpId = "";',
    cutFn(CARDS, 'function sendToErp('), cutFn(CARDS, 'function closeCardErp('),
    cutFn(CARDS, 'function cardErpGo(')].join('\n'), ctx);
  return { ctx, calls };
}
const CARD = { id: 'c1', kind: 'card', name: '김철수', company: '(주)가온', title: '과장', dept: '인사팀',
  mobile: '010-1111-2222', tel: '02-111-2222', fax: '02-111-3333', email: 'kim@gaon.kr',
  companyTel: '02-100-0000', companyFax: '', companyAddr: '서울 중구 1', address: '개인 집 주소' };

test('② 쪽지 — 회사 칸에는 회사 번호만, 사람 번호·메일은 담당자 줄로', () => {
  const { ctx } = cards();
  const s = clone(ctx.cardErpSeed(CARD, ['자문'], null, NOW));
  assert.equal(s.company.name, '(주)가온');
  assert.equal(s.company.phone, '02-100-0000', '★ 회사 대표번호가 회사 칸에 가야 합니다');
  assert.equal(s.company.address, '서울 중구 1', '★ 회사 주소가 가야 합니다 — 개인 주소가 아니라');
  assert.ok(!('fax' in s.company), '★★ 빈 칸을 실으면 받는 쪽이 채워진 칸으로 읽습니다');
  assert.ok(!('email' in s.company), '★ 사람 메일을 회사 메일로 보내고 있습니다');
  assert.deepEqual(s.company.contacts, [{ name: '김철수', role: '과장 · 인사팀', phone: '010-1111-2222',
    bizPhone: '02-111-2222', fax: '02-111-3333', email: 'kim@gaon.kr' }]);
  assert.equal(s.at, NOW);
  assert.equal(s.cardId, 'c1');
});

test('③ 여럿 고르면 첫째(자문→급여→노조→기금)가 유형, 나머지는 메모', () => {
  const { ctx } = cards();
  const s = clone(ctx.cardErpSeed(CARD, ['기금', '노조', '자문'], null, NOW));
  assert.equal(s.typeCodes.company, '자문', '★ 고른 차례가 아니라 정해 둔 차례로 첫째를 정한다');
  assert.deepEqual(s.also, ['노조', '기금']);
  assert.match(s.note, /함께 맡기로 한 일: 노조·기금/, '★ 나머지를 안 적으면 조용히 사라집니다');
  const one = clone(ctx.cardErpSeed(CARD, ['급여'], null, NOW));
  assert.equal(one.typeCodes.company, '급여');
  assert.ok(!/함께 맡기로/.test(one.note), '하나만 골랐으면 «함께» 줄이 없다');
  assert.equal(ctx.cardErpSeed(CARD, [], null, NOW), null, '안 골랐으면 쪽지를 안 만든다');
  assert.equal(ctx.cardErpSeed(CARD, ['사무대행'], null, NOW), null, '고를 수 없는 유형은 안 받는다');
});

test('명함에 없는 사업자번호·대표자는 «하나로 딱 떨어지는» 사업자등록증에서만 가져온다', () => {
  const { ctx } = cards();
  const biz = { kind: 'biz', company: '주식회사 가온', bizno: '123-45-67891', ceo: '박대표',
    bizType: '제조', bizItem: '부품', address: '서울 사업장' };
  const items = { b1: biz, c1: CARD };
  assert.equal(ctx.cardErpBizOf(CARD, items), biz, '★ (주)가온과 주식회사 가온은 같은 회사다 — 회사 열쇠(_norm)로 맞춘다');
  const card2 = Object.assign({}, CARD, { company: '가온' });
  const items2 = { b1: Object.assign({}, biz, { company: '가온' }) };
  const got = ctx.cardErpBizOf(card2, items2);
  assert.ok(got, '★ 같은 회사 등록증을 못 찾습니다');
  const s = clone(ctx.cardErpSeed(card2, ['자문'], got, NOW));
  assert.equal(s.company.bizNo, '123-45-67891');
  assert.equal(s.company.ceo, '박대표');
  assert.equal(s.company.bizCategory, '부품', '★ 기업정보함의 종목(bizItem)은 이알피에서 bizCategory 다');
  const twin = { b1: items2.b1, b2: Object.assign({}, items2.b1, { bizno: '999-99-99999' }) };
  assert.equal(ctx.cardErpBizOf(card2, twin), null, '★★ 번호가 둘인데 아무거나 집으면 남의 번호가 계약에 들어갑니다');
  const byNo = Object.assign({}, card2, { bizno: '999-99-99999' });
  assert.equal(ctx.cardErpBizOf(byNo, twin).bizno, '999-99-99999', '명함에 번호가 있으면 번호로 찾는다');
});

test('고르는 창 — 업체관리에 있는지·끝났는지·못 읽었는지를 말한다', () => {
  const { ctx } = cards();
  const html = (m) => ctx.cardErpHtml(CARD, m, null);
  assert.match(html(null), /업체관리에 <b>없는<\/b> 회사/);
  assert.match(html({ company: '가온', type: '컨설팅', left: false }), /이미 있습니다[\s\S]*이어 붙입니다/);
  assert.match(html({ company: '가온', type: '자문', left: true }), /끝난 업체[\s\S]*유형으로 바꿔 넣기/);
  assert.match(html(undefined), /아직 못 읽었습니다/);
  const h = html(null);
  assert.equal((h.match(/name="cardErpT"/g) || []).length, 4, '자문·급여·노조·기금 네 칸');
  assert.match(h, /사업자번호가 없습니다/, '★ 번호 없이 보내면 같은 회사가 두 번 생길 수 있다고 알려야 합니다');
  assert.ok(!/사업자번호가 없습니다/.test(ctx.cardErpHtml(Object.assign({}, CARD, { bizno: '1234567891' }), null, null)));
  assert.match(h, /아무것도 저장하지 않습니다/);
  const bad = ctx.cardErpHtml(Object.assign({}, CARD, { company: '<img src=x onerror=alert(1)>' }), null, null);
  assert.ok(!/<img src=x/.test(bad), '★ 회사명을 그대로 넣으면 그 안의 태그가 실행됩니다');
});

function dom(checked) {
  const els = { cardErpM: { innerHTML: '' }, cardErpBg: { classList: { on: false,
    add() { this.on = true; }, remove() { this.on = false; } } } };
  return { els, $: (id) => els[id],
    document: { querySelectorAll: () => (checked || []).map((v) => ({ value: v })) } };
}
test('① 「계약 창 열기」 — 쪽지만 놓고 계약 창을 연다. 데이터베이스에는 아무것도 안 쓴다', () => {
  const d = dom(['자문', '급여']);
  const { ctx, calls } = cards({ state: { items: { c1: CARD } }, $: d.$, document: d.document });
  ctx.sendToErp('c1');
  assert.ok(d.els.cardErpBg.classList.on, '★ 창이 안 뜹니다');
  assert.match(d.els.cardErpM.innerHTML, /무엇으로 맡기로 했나요/);
  ctx.cardErpGo('c1');
  const seed = JSON.parse(ctx.localStorage.d.pu_new_contract || 'null');
  assert.ok(seed, '★★ 쪽지를 안 놓았습니다 — 계약 창이 빈 채로 뜹니다');
  assert.equal(seed.typeCodes.company, '자문');
  assert.deepEqual(calls.goApp, [['pu-erp.html#menu=biz/contract', '계약 등록']],
    '★ 사진첩과 같은 「계약 등록」 창으로 가야 보던 푸른이알피 화면을 안 덮습니다');
  assert.equal(calls.fb, 0, '★★ 명함 쪽에서 업체관리에 직접 씁니다 — 반쪽 업체가 생깁니다');
  assert.equal(d.els.cardErpBg.classList.on, false, '보낸 뒤에는 창을 닫는다');
});

test('① 안 골랐으면 아무것도 안 놓는다 · 다른 명함의 단추로는 안 보낸다', () => {
  const d = dom([]);
  const { ctx, calls } = cards({ state: { items: { c1: CARD, c2: Object.assign({}, CARD, { id: 'c2' }) } }, $: d.$, document: d.document });
  ctx.sendToErp('c1');
  ctx.cardErpGo('c1');
  assert.ok(!('pu_new_contract' in ctx.localStorage.d), '★ 고르지 않았는데 보냈습니다');
  assert.ok(calls.toasts.some((t) => /하나를 골라 주세요/.test(t)));
  assert.equal(calls.goApp.length, 0);
  const d2 = dom(['자문']);
  const x = cards({ state: { items: { c1: CARD, c2: Object.assign({}, CARD, { id: 'c2' }) } }, $: d2.$, document: d2.document });
  x.ctx.sendToErp('c1');
  x.ctx.cardErpGo('c2');
  assert.ok(!('pu_new_contract' in x.ctx.localStorage.d), '★ 열어 둔 명함과 다른 명함으로 보냈습니다');
});

test('회사명이 없는 명함은 창을 안 연다 · 사업자등록증(명함 아님)은 안 받는다', () => {
  const d = dom(['자문']);
  const { ctx, calls } = cards({ state: { items: { c1: Object.assign({}, CARD, { company: '' }),
    b1: { id: 'b1', kind: 'biz', company: '가온' } } }, $: d.$, document: d.document });
  ctx.sendToErp('c1');
  assert.equal(d.els.cardErpBg.classList.on, false);
  assert.ok(calls.toasts.some((t) => /회사명이 없어/.test(t)));
  ctx.sendToErp('b1');
  assert.equal(d.els.cardErpBg.classList.on, false);
});

test('쪽지를 못 놓으면(저장소 막힘) 「연다」고 하지 않는다', () => {
  const d = dom(['자문']);
  const { ctx, calls } = cards({ state: { items: { c1: CARD } }, $: d.$, document: d.document,
    localStorage: { setItem() { throw new Error('가득 참'); } } });
  ctx.sendToErp('c1');
  ctx.cardErpGo('c1');
  assert.equal(calls.goApp.length, 0, '★ 쪽지 없이 계약 창을 열면 빈 창이 뜹니다');
  assert.ok(calls.toasts.some((t) => /넘기지 못했습니다/.test(t)));
});

test('명함 화면의 두 단추 «모두» 새 창을 부른다 · 옛 직접 쓰기는 남아 있지 않다', () => {
  const calls = (CARDS.match(/onclick="sendToErp\('\$\{id\}'\)"/g) || []).length;
  assert.equal(calls, 2, '★ 명함 상세(휴대폰·PC) 두 자리에 단추가 있어야 합니다');
  assert.ok(!/>🏢 ERP 거래처(로 등록)?<\/button>/.test(CARDS), '★ 옛 이름이 남아 있으면 무엇을 누르는지 헷갈립니다');
  assert.match(CARDS, /<div class="modalbg" id="cardErpBg"[^>]*><div class="modal" id="cardErpM"/,
    '★ 창 자리가 없으면 눌러도 아무 일이 없습니다');
  const fn = cutFn(CARDS, 'function sendToErp(') + cutFn(CARDS, 'function cardErpGo(');
  assert.ok(!/data\/companies/.test(fn), '★★ 업체관리에 직접 쓰는 길이 남아 있습니다');
});

test('받는 쪽과 보내는 쪽이 «같은 쪽지 이름»을 쓴다', () => {
  assert.match(TYPES, /CARD_ERP_SEED_KEY = 'pu_new_contract'/);
  assert.match(SEED_VARS, /ERP_CT_SEED_KEY = 'pu_new_contract'/);
  /* 명함의 유형 이름이 푸른이알피 유형표 씨앗에 «그대로» 있어야 유형이 찍힌다 */
  const seedTypes = (ERP.match(/var COMPANY_TYPE_SEED = \[([\s\S]*?)\];/) || ['', ''])[1];
  ['자문', '급여', '노조', '기금'].forEach((t) =>
    assert.ok(seedTypes.indexOf("code:'" + t + "'") >= 0, t + ' 가 푸른이알피 유형표에 없습니다'));
});
