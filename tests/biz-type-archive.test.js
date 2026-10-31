'use strict';
/* 📦 업무유형 카드의 «보관 칸» · 0건 × · 합쳐진 유형 보호 (대표 2026-10-31 「삭제 대신 숨기기·보관으로」)

   ■ 왜
   컨설팅·기타사업 유형은 나중에 없어지거나 바뀔 수 있다. 쓰는 기록이 0건이면 × 가 «바로 삭제» 였다.
   숨기기(hidden)는 이미 있었지만 숨긴 유형이 목록 곳곳에 흐리게 섞여 있었다 → 맨 아래 접힌 「📦 보관」 칸으로 모은다.

   ★ 규칙 (값이 아니라 규칙) — BizTypeCard 를 가짜 환경에서 «실제로 그려 누르며» 본다(소스 글자만 찾는 검사는 단추가 무엇을 하는지 모른다)
     ① 숨긴 것·합쳐진 것은 «줄 목록»에서 빠지고 보관 칸에만 있다 · 제목 숫자는 쓰는 유형만 센다 · 숨긴 것이 없으면 칸이 아예 없다 · 기본은 접힘
     ② 합쳐진 유형은 지우지도 다시 띄우지도 않는다(🗑 없음, 👁 은 안내만) — 옛 번호가 메모·휴지통·나간 문서에 남아 있을 수 있다
     ③ 쓰는 기록 0건의 ×: 컨설팅·기타사업은 «보관이 기본»(완전 삭제는 따로) · 업체·사건·기금은 예전 그대로 곧바로 삭제를 묻는다
     ④ 쓰는 기록이 있으면 어느 카드든 숨김만 권한다 · 보관 칸의 🗑 은 0건일 때만 지운다
     ⑤ 서버 사전을 못 받았으면(bizTypeWritable 거짓) 아무것도 쓰지 않는다
     ⑥ 컨설팅은 개인입금 값에서 «자동으로» 개인입금|법인 두 묶음에 갈리고, ⇄ 로 옮기면 저절로 반대 묶음으로 간다(묶음 사이는 끌어서 안 옮김)
     ⑦ 「+ 새 유형」 입력줄은 평소 접혀 있다(한 화면에 최대한) */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const ERP = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8'));

const CAT = {
  consulting: { key: 'consulting', title: '컨설팅 유형', storageKey: 'biz_cons_types', seed: [], headBg: '#eff6ff', headFg: '#2563eb', icon: '📊', addBtnBg: '#2563eb', shortBg: '#bfdbfe', shortFg: '#2563eb' },
  other: { key: 'other', title: '기타사업 유형', storageKey: 'biz_other_types', seed: [], headBg: '#f0fdf4', headFg: '#166534', icon: '📋', addBtnBg: '#16a34a', shortBg: '#bbf7d0', shortFg: '#166534' },
  company: { key: 'company', title: '업체유형', storageKey: 'biz_company_types', seed: [], headBg: '#fffbeb', headFg: '#854d0e', icon: '🏢', addBtnBg: '#d97706', shortBg: '#fde68a', shortFg: '#854d0e' },
};
const LIST = () => [
  { code: 'k1', short: '일터상생', name: '일터혁신상생컨설팅', sortOrder: 20, agency: '샘플수행기관', personalDeposit: true },
  { code: 'k2', short: '위험평가', name: '위험성평가', sortOrder: 30 },
  { code: 'k3', short: '옛유형', name: '샘플 옛 유형', sortOrder: 40, hidden: true },
  { code: 'k4', short: '일터혁신', name: '일터혁신상생컨설팅 (옛)', sortOrder: 50, hidden: true, mergedInto: 'k1' },
];

/* 쪽지 가짜 환경 — 화면(BizTypeCard)을 다시 그릴 수 있는 얇은 실행기 */
function mount(catKey, list, over) {
  over = over || {};
  const store = { [CAT[catKey].storageKey]: JSON.parse(JSON.stringify(list)) };
  const log = { toast: [], pop: [], confirm: [] };
  const answers = { pop: over.pop || [], confirm: over.confirm || [] };
  const usage = over.usage || {};
  const states = []; let idx = 0, tree = null;
  const useState = (init) => {
    const i = idx++;
    if (!(i in states)) states[i] = typeof init === 'function' ? init() : init;
    return [states[i], (v) => { states[i] = typeof v === 'function' ? v(states[i]) : v; render(); }];
  };
  const flat = (a) => a.reduce((o, x) => o.concat(Array.isArray(x) ? flat(x) : [x]), []);
  const ctx = {
    useState, useEffect: () => {}, h: (t, p, ...c) => ({ t, p: p || {}, c: flat(c).filter((x) => x !== false && x != null) }),
    dbGet: (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    CURRENT_USER: { name: '시험' }, showToast: (m) => { log.toast.push(m); },
    popConfirm: (msg, opts) => { log.pop.push({ msg, opts }); return Promise.resolve(answers.pop.length ? answers.pop.shift() : false); },
    showConfirm: (msg, opts) => { log.confirm.push({ msg, opts }); return Promise.resolve(answers.confirm.length ? answers.confirm.shift() : true); },
    bizTypeWritable: () => over.writable !== false,
    bizTypeApply: (k, seed, fn) => { const next = fn(JSON.parse(JSON.stringify(store[k]))); if (!next) return null; store[k] = next; return next; },
    bizTypeRead: (k) => JSON.parse(JSON.stringify(store[k])),
    bizTypeUsage: (kind, code) => ({ n: usage[code] || 0, by: {} }),
    consTypeRole: (x) => (x && (x.role === 'clinic' || x.role === 'tech') ? x.role : ''),
    CONS_ROLE_LABEL: { clinic: '현장클리닉', tech: '기술보호' },
    erpPlantSeed: () => {}, PersonalDepositBulkModal: () => null,
    BIZ_TYPE_HIST_MAX: 20,
    Object, Array, String, Number, Date, Math, JSON, Promise,
  };
  vm.createContext(ctx);
  vm.runInContext([
    cutFn(ERP, 'function bizTypeNorm(s)'),
    cutFn(ERP, 'function bizTypeDupOf(list, short, name, exceptCode)'),
    cutFn(ERP, 'function bizTypeHist(item, act, before, who, at)'),
    cutFn(ERP, 'function bizTypeLastHist(x)'),
    cutFn(ERP, 'function bizTypeNextOrder(cur)'),
    cutFn(ERP, 'function BizTypeCard(props)'),
  ].join('\n') + '\nthis.__Card = BizTypeCard;', ctx);
  function render() { idx = 0; tree = ctx.__Card({ cat: CAT[catKey] }); }
  render();
  const walk = (n, f) => { if (!n || typeof n !== 'object') return; f(n); (n.c || []).forEach((x) => walk(x, f)); };
  const text = (n) => (n && typeof n === 'object' ? (n.c || []).map(text).join('') : (n == null ? '' : String(n)));
  const api = {
    store: () => store[CAT[catKey].storageKey], log,
    tree: () => tree,
    find: (pred) => { const o = []; walk(tree, (n) => { if (pred(n)) o.push(n); }); return o; },
    text,
    rows: () => api.find((n) => n.t === 'div' && n.p.key && !String(n.p.key).startsWith('arc-') && (n.p.draggable === true)),
    arcRows: () => api.find((n) => n.p && n.p.className === 'biz-type-arc-row'),
    arcBar: () => api.find((n) => n.p && n.p.className === 'biz-type-arc-bar')[0] || null,
    headerCount: () => { const sp = api.find((n) => n.t === 'span' && /^\(\d+\)$/.test(text(n))); return sp.length ? text(sp[0]) : ''; },
    btn: (row, label) => api.find2(row, (n) => n.t === 'button' && text(n) === label)[0] || null,
    find2: (root, pred) => { const o = []; walk(root, (n) => { if (pred(n)) o.push(n); }); return o; },
    tick: () => new Promise((r) => setTimeout(r, 0)),
  };
  return api;
}

test('①★ 숨긴 것·합쳐진 것은 줄 목록에서 빠지고 보관 칸에만 있다 — 제목 숫자는 쓰는 유형만, 기본은 접힘', () => {
  const w = mount('consulting', LIST());
  assert.equal(w.rows().length, 2, '★ 줄 목록에 숨긴 유형이 섞여 있습니다');
  assert.equal(w.headerCount(), '(2)', '제목 숫자가 숨긴 것까지 셉니다');
  const bar = w.arcBar();
  assert.ok(bar && /보관 2/.test(w.text(bar)), '보관 칸 제목(보관 2)이 없습니다');
  assert.equal(w.arcRows().length, 0, '★ 보관 칸이 처음부터 펼쳐져 있습니다');
  bar.p.onClick();
  assert.equal(w.arcRows().length, 2, '펼치면 두 줄(숨김 1 · 합쳐짐 1)');
  const merged = w.arcRows().map((r) => w.text(r)).filter((t) => /합쳐짐 → 일터상생/.test(t));
  assert.equal(merged.length, 1, '합쳐진 줄에 「합쳐짐 → 일터상생」 이 없습니다');
});

test('①★ 숨긴 것이 없으면 보관 칸이 «아예» 안 보인다 (업체·사건처럼 숨긴 것 없는 카드)', () => {
  const w = mount('company', LIST().filter((x) => !x.hidden));
  assert.equal(w.arcBar(), null, '★ 비어 있는 보관 칸이 보입니다');
  assert.equal(w.rows().length, 2);
});

test('②★ 합쳐진 유형은 🗑 이 없고 👁 은 안내만 한다 — 다시 띄우지 않는다', () => {
  const w = mount('consulting', LIST());
  w.arcBar().p.onClick();
  const mergedRow = w.arcRows().find((r) => /합쳐짐/.test(w.text(r)));
  assert.equal(w.btn(mergedRow, '🗑'), null, '★ 합쳐진 유형에 완전 삭제 단추가 있습니다');
  const eye = w.btn(mergedRow, '👁');
  assert.ok(eye, '👁 단추가 없습니다');
  eye.p.onClick();
  assert.ok(w.log.toast.some((m) => /합쳐졌습니다/.test(m)), '이유를 알려야 합니다: ' + w.log.toast.join('|'));
  assert.equal(w.store().find((x) => x.code === 'k4').hidden, true, '★ 합쳐진 유형이 다시 떴습니다');
});

test('①★ 숨긴(합쳐지지 않은) 유형은 👁 로 다시 표시된다 — 줄 목록으로 돌아온다', () => {
  const w = mount('consulting', LIST());
  w.arcBar().p.onClick();
  const row = w.arcRows().find((r) => /샘플 옛 유형/.test(w.text(r)));
  w.btn(row, '👁').p.onClick();
  assert.ok(!w.store().find((x) => x.code === 'k3').hidden, '다시 표시가 안 됩니다');
  assert.equal(w.rows().length, 3, '줄 목록으로 돌아와야 합니다');
  assert.equal(w.headerCount(), '(3)');
});

test('③★ 쓰는 기록 0건 ×: 컨설팅은 «보관이 기본» — 지우지 않고 보관 칸으로 옮긴다', async () => {
  const w = mount('consulting', LIST(), { pop: ['archive'] });
  const row = w.rows().find((r) => /위험성평가/.test(w.text(r)));
  w.btn(row, '×').p.onClick();
  await w.tick();
  assert.equal(w.log.pop.length, 1, '★ 보관·삭제를 묻지 않습니다');
  assert.deepEqual([...w.log.pop[0].opts.choices.map((c) => c.key)], ['archive'], '「📦 보관」 선택지가 없습니다');   // vm 안에서 만든 배열 — 펼쳐서 견준다(realm 이 다르면 deepEqual 이 어긋난다)
  assert.equal(w.log.pop[0].opts.thirdText, '완전 삭제', '완전 삭제는 따로(옆 단추)여야 합니다');
  assert.equal(w.log.confirm.length, 0, '곧바로 삭제를 묻는 옛 길로 갔습니다');
  const it = w.store().find((x) => x.code === 'k2');
  assert.ok(it, '★ 보관인데 유형이 지워졌습니다');
  assert.equal(it.hidden, true, '보관(hidden)이 안 됩니다');
  assert.equal(it.hist[it.hist.length - 1].act, '보관', '고친 기록에 「보관」 이 남아야 합니다');
  assert.equal(w.rows().length, 1); assert.match(w.text(w.arcBar()), /보관 3/);
});

test('③★ 쓰는 기록 0건 ×: 기타사업도 같다 · 「완전 삭제」를 고르면 한 번 더 묻고 지운다 · 취소는 아무 일도 없다', async () => {
  const w = mount('other', LIST(), { pop: ['third', false], confirm: [true] });
  const row = w.rows().find((r) => /위험성평가/.test(w.text(r)));
  w.btn(row, '×').p.onClick(); await w.tick(); await w.tick();
  assert.equal(w.log.confirm.length, 1, '★ 완전 삭제 전에 한 번 더 묻지 않습니다');
  assert.equal(w.store().find((x) => x.code === 'k2'), undefined, '완전 삭제가 안 됩니다');
  const w2 = mount('other', LIST(), { pop: [false] });
  w2.btn(w2.rows().find((r) => /위험성평가/.test(w2.text(r))), '×').p.onClick(); await w2.tick();
  assert.deepEqual(w2.store(), LIST(), '★ 취소했는데 바뀌었습니다');
});

test('③★ 업체 카드 ×(0건)는 예전 그대로 — 보관을 묻지 않고 곧바로 삭제를 묻는다', async () => {
  const w = mount('company', LIST().filter((x) => !x.hidden), { confirm: [true] });
  w.btn(w.rows().find((r) => /위험성평가/.test(w.text(r))), '×').p.onClick(); await w.tick(); await w.tick();
  assert.equal(w.log.pop.length, 0, '★ 업체 카드가 보관 물음을 띄웁니다 — 이번 지시는 컨설팅·기타사업만입니다');
  assert.equal(w.log.confirm.length, 1);
  assert.equal(w.log.confirm[0].opts.danger, true);
  assert.equal(w.store().find((x) => x.code === 'k2'), undefined, '삭제가 안 됩니다');
});

test('④★ 쓰는 기록이 있으면 어느 카드든 숨김만 권한다 — 지워지지 않는다', async () => {
  const w = mount('consulting', LIST(), { usage: { k2: 3 }, confirm: [true] });
  w.btn(w.rows().find((r) => /위험성평가/.test(w.text(r))), '×').p.onClick(); await w.tick();
  assert.equal(w.log.pop.length, 0);
  assert.match(w.log.confirm[0].opts.confirmText, /숨김/, '숨김 처리를 권해야 합니다');
  const it = w.store().find((x) => x.code === 'k2');
  assert.ok(it && it.hidden === true, '★ 쓰는 기록이 있는 유형이 숨김 아닌 다른 상태가 됐습니다');
});

test('④★ 보관 칸의 🗑 은 0건일 때만 지운다 · 쓰는 기록이 있으면 안 지우고 이유를 알린다', async () => {
  const w = mount('consulting', LIST(), { usage: { k3: 2 } });
  w.arcBar().p.onClick();
  const row = w.arcRows().find((r) => /샘플 옛 유형/.test(w.text(r)));
  w.btn(row, '🗑').p.onClick(); await w.tick();
  assert.ok(w.store().find((x) => x.code === 'k3'), '★ 쓰는 기록이 있는 유형이 지워졌습니다');
  assert.ok(w.log.toast.some((m) => /2건 있어 지울 수 없습니다/.test(m)), '이유를 알려야 합니다: ' + w.log.toast.join('|'));
  assert.equal(w.log.confirm.length, 0, '못 지우는데 삭제를 묻습니다');
  const w2 = mount('consulting', LIST(), { confirm: [true] });
  w2.arcBar().p.onClick();
  w2.btn(w2.arcRows().find((r) => /샘플 옛 유형/.test(w2.text(r))), '🗑').p.onClick(); await w2.tick(); await w2.tick();
  assert.equal(w2.store().find((x) => x.code === 'k3'), undefined, '0건인데 안 지워집니다');
  assert.ok(w2.store().find((x) => x.code === 'k4'), '다른 유형(합쳐진 것)까지 지웠습니다');
});

test('⑤★ 서버 사전을 못 받았으면 × · 🗑 이 아무것도 쓰지 않는다', async () => {
  const w = mount('consulting', LIST(), { writable: false });
  w.btn(w.rows().find((r) => /위험성평가/.test(w.text(r))), '×').p.onClick(); await w.tick();
  w.arcBar().p.onClick();
  w.btn(w.arcRows().find((r) => /샘플 옛 유형/.test(w.text(r))), '🗑').p.onClick(); await w.tick();
  assert.deepEqual(w.store(), LIST(), '★ 사본이 없는데 썼습니다 — 씨앗 위에 얹어 서버를 덮을 수 있습니다');
  assert.equal(w.log.pop.length + w.log.confirm.length, 0, '묻지도 않아야 합니다');
});

test('①★ 컨설팅 줄은 칸이 같다 — 수행기관·단가·셈이 «비어도» 같은 칸 구성, 다른 카드엔 새 줄이 없다', () => {
  const list = [
    { code: 'a', short: '현장클리', name: '현장클리닉', sortOrder: 10, agency: '샘플기관', dayFee: 350000, dayUnit: '일', role: 'clinic', personalDeposit: false },
    { code: 'b', short: '위험평가', name: '위험성평가', sortOrder: 20 },
  ];
  const w = mount('consulting', list);
  const rows = w.find((n) => n.p && n.p.className === 'bt-row');
  assert.equal(rows.length, 2);
  rows.forEach((r) => {
    const l2 = w.find2(r, (n) => n.p && n.p.className === 'bt-l2')[0];
    assert.ok(l2, '.bt-l2 가 없습니다');
    assert.deepEqual(l2.c.map((n) => n.p.className), ['bt-ag'], '★ 줄마다 칸 구성이 다릅니다 — 비면 뒤 칸이 앞으로 밀립니다');
    /* ⇄ 는 .bt-l2 «밖»(바깥 줄의 직접 칸)이다 — 접힌 모양에서 첫 줄에 오고, 수행기관·단가·셈이 없는 줄은 둘째 줄이 안 생긴다 */
    assert.deepEqual(r.c.map((n) => (n.p && n.p.className) || '').filter((c) => /^bt-l2$/.test(c) || /\bbt-(swap|edit|del)\b/.test(c)).map((c) => c.replace(/^erp-tip /, '')),
      ['bt-l2', 'bt-swap', 'bt-edit', 'bt-del'], '★ 줄 안 칸의 차례가 다릅니다 — 넓은 모양에서 칸이 어긋납니다');
  });
  const t0 = w.text(rows[0]), t1 = w.text(rows[1]);
  assert.match(t0, /샘플기관/); assert.match(t0, /1일 350,000원/); assert.match(t0, /셈: 현장클리닉/);
  assert.doesNotMatch(t1, /원|셈:/, '값이 없는 줄에 칩이 생겼습니다');
  assert.equal(w.find((n) => n.p && /\bbt-head\b/.test(String(n.p.className))).length, 2, '묶음마다 머리글이 하나씩(둘) 있어야 합니다');
  const o = mount('other', list);
  assert.equal(o.find((n) => n.p && /bt-row|bt-head|bt-group/.test(String(n.p.className))).length, 0, '★ 다른 카드에 새 줄·묶음(bt-row·bt-group)이 쓰였습니다');
});

/* ── 묶음: 개인입금 값에서 «자동으로» ── */
const GL = () => [
  { code: 'A', short: '가나', name: '가 사업', sortOrder: 10, personalDeposit: true },
  { code: 'B', short: '다라', name: '나 사업', sortOrder: 20 },
  { code: 'C', short: '마바', name: '다 사업', sortOrder: 30, personalDeposit: true },
  { code: 'D', short: '사아', name: '라 사업', sortOrder: 40 },
];
const inGroup = (w, cls) => {
  const g = w.find((n) => n.p && new RegExp('\\b' + cls + '\\b').test(String(n.p.className || '')) && /bt-group/.test(String(n.p.className)))[0];
  return g ? w.find2(g, (n) => n.p && n.p.className === 'bt-row').map((r) => r.p.key) : null;
};
const rowOf = (w, code) => w.find((n) => n.p && n.p.className === 'bt-row' && n.p.key === code)[0];
const swapOf = (w, code) => w.find2(rowOf(w, code), (n) => n.t === 'button' && /\bbt-swap\b/.test(String(n.p.className)))[0];
const evt = () => ({ preventDefault() {}, dataTransfer: { setData() {}, effectAllowed: '' } });
const order = (w) => w.store().slice().sort((a, b) => a.sortOrder - b.sortOrder).map((x) => x.code).join('');

test('②★ 컨설팅은 개인입금 값으로 «자동으로» 두 묶음에 갈린다 — 제목에 개수, 값은 그대로', () => {
  const w = mount('consulting', GL());
  assert.deepEqual([...inGroup(w, 'bt-priv')], ['A', 'C'], '★ 개인입금 묶음이 개인입금 켠 유형이 아닙니다');
  assert.deepEqual([...inGroup(w, 'bt-corp')], ['B', 'D'], '★ 법인 입금 묶음이 나머지가 아닙니다');
  const titles = w.find((n) => n.p && n.p.className === 'bt-gtitle').map((n) => w.text(n));
  assert.ok(/개인입금 사업\(2\)/.test(titles[0]) && /법인 입금 사업\(2\)/.test(titles[1]), '묶음 제목에 개수가 없습니다: ' + titles.join(' | '));
  assert.deepEqual(w.store().map((x) => !!x.personalDeposit), [true, false, true, false], '그리기만 했는데 값이 바뀌었습니다');
});

test('②★ ⇄ 를 누르면 유형이 «저절로» 반대 묶음으로 옮겨진다 (켜면 개인입금 · 끄면 법인)', () => {
  const w = mount('consulting', GL());
  swapOf(w, 'B').p.onClick({ stopPropagation() {} });
  assert.equal(w.store().find((x) => x.code === 'B').personalDeposit, true, '개인입금이 안 켜졌습니다');
  assert.deepEqual([...inGroup(w, 'bt-priv')], ['A', 'B', 'C'], '★ 켠 유형이 개인입금 묶음으로 자동으로 안 옮겨졌습니다(번호 순서 안)');
  assert.deepEqual([...inGroup(w, 'bt-corp')], ['D']);
  swapOf(w, 'A').p.onClick({ stopPropagation() {} });
  assert.equal(w.store().find((x) => x.code === 'A').personalDeposit, false);
  assert.deepEqual([...inGroup(w, 'bt-priv')], ['B', 'C'], '★ 끈 유형이 개인입금 묶음에 남았습니다');
  assert.deepEqual([...inGroup(w, 'bt-corp')], ['A', 'D'], '끈 유형이 법인 입금 묶음으로 안 옮겨졌습니다');
  assert.equal(w.store().find((x) => x.code === 'A').hist.slice(-1)[0].act, '개인입금 끔', '고친 기록이 남아야 합니다');
});

test('②★ 서버 사전을 못 받았으면 ⇄ 가 아무것도 안 바꾼다 (사본 없음)', () => {
  const w = mount('consulting', GL(), { writable: false });
  swapOf(w, 'B').p.onClick({ stopPropagation() {} });
  assert.deepEqual(w.store(), GL(), '★ 사본이 없는데 썼습니다 — 씨앗 위에 얹어 서버를 덮을 수 있습니다');
});

test('②★ 묶음 «사이»로는 끌어서 안 옮긴다(⇄ 로) · 같은 묶음 안에서는 끌어서 순서를 바꾼다', () => {
  const w = mount('consulting', GL());
  /* 개인입금 A 를 법인 B 위로 — 막고 안내 */
  rowOf(w, 'A').p.onDragStart(evt());
  rowOf(w, 'B').p.onDrop(evt());
  assert.ok(w.log.toast.some((m) => /⇄/.test(m)), '★ 막으면서 ⇄ 로 옮기라고 알리지 않습니다: ' + w.log.toast.join('|'));
  assert.equal(order(w), 'ABCD', '★ 묶음 사이 끌기로 순서가 바뀌었습니다');
  assert.deepEqual([...inGroup(w, 'bt-priv')], ['A', 'C']);
  /* 같은 묶음: A 를 C 위로 */
  rowOf(w, 'A').p.onDragStart(evt());
  rowOf(w, 'C').p.onDrop(evt());
  assert.equal(order(w), 'BCAD', '같은 묶음 안에서는 끌어서 순서가 바뀌어야 합니다');
  assert.deepEqual([...inGroup(w, 'bt-priv')], ['C', 'A'], '묶음 안 순서가 그리기에 반영돼야 합니다');
});

test('④★ 「+ 새 유형」 입력줄은 평소 접혀 있고 단추로 펼치고 닫는다 (다섯 카드 공통)', () => {
  ['consulting', 'other', 'company'].forEach((k) => {
    const w = mount(k, GL().map((x) => Object.assign({}, x, { personalDeposit: false })));
    const inputs = () => w.find((n) => n.t === 'input').length;
    assert.equal(inputs(), 0, '★ ' + k + ' 카드의 추가 입력줄이 처음부터 펼쳐져 있습니다 — 한 화면에 안 들어옵니다');
    const tg = () => w.find((n) => n.t === 'button' && n.p.className === 'biz-type-add-toggle')[0];
    assert.ok(tg() && /새 유형/.test(w.text(tg())), k + ' 머리줄에 「+ 새 유형」 단추가 없습니다');
    tg().p.onClick({ stopPropagation() {} });
    assert.ok(inputs() >= 2, '단추를 눌러도 입력줄이 안 펼쳐집니다');
    assert.ok(/닫기/.test(w.text(tg())), '펼친 뒤 단추가 「닫기」로 안 바뀝니다');
    tg().p.onClick({ stopPropagation() {} });
    assert.equal(inputs(), 0, '다시 누르면 접혀야 합니다');
  });
});
