'use strict';
/* 「지난 견적·계약」 화면 (견적·계약 자동화 계획 1 · 작업 6)
   ★ 권한 없는 직원 화면에 숫자 금액이 한 글자도 없어야 한다 — 가장 먼저 지킬 것(Review Focus 1).
   document 는 아주 작은 대역을 쓴다(tests/worklog-view.test.js 와 같은 방식, 단추·체크·선택 상자만 더했다). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');

function node(tag) {
  const n = { tag, children: [], attrs: {}, listeners: {}, _text: '', className: '', value: '', checked: false, htmlWrites: [] };
  n.appendChild = (c) => { n.children.push(c); return c; };
  n.setAttribute = (k, v) => { n.attrs[k] = v; };
  n.removeAttribute = (k) => { delete n.attrs[k]; };
  n.addEventListener = (ev, fn) => { (n.listeners[ev] = n.listeners[ev] || []).push(fn); };
  Object.defineProperty(n, 'textContent', { get() { return n._text; }, set(v) { n._text = String(v); n.children = []; } });
  Object.defineProperty(n, 'innerHTML', { get() { return ''; }, set(v) { n.children = []; n._text = ''; if (v) n.htmlWrites.push(v); } });
  return n;
}
function all(n, out) { out = out || []; out.push(n); n.children.forEach((c) => all(c, out)); return out; }
function textOf(n) { return n._text + ' ' + n.children.map(textOf).join(' '); }
const byClass = (root, cls) => all(root).filter((x) => (' ' + x.className + ' ').indexOf(' ' + cls + ' ') >= 0);
const byTag = (root, tag) => all(root).filter((x) => x.tag === tag);
const btnByText = (root, t) => byTag(root, 'button').filter((b) => b._text === t || b._text.indexOf(t) === 0)[0];
const fire = (n, ev) => (n.listeners[ev] || []).forEach((f) => f.call(n));
const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 10; i++) await tick(); }

function load() {
  const head = node('head'), document = { createElement: node, head, getElementById: () => null };
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, document, setTimeout };
  box.window = box;
  vm.createContext(box);
  ['js/pu-quotes.js', 'js/pu-quotes-view.js'].forEach((f) => vm.runInContext(read(f), box));
  return box;
}
const out = (v) => JSON.parse(JSON.stringify(v));

/* 지어낸 자료 — 회사·금액·이름 모두 가짜 */
const ROWS = [
  { id: 'q1', doc: 'quote', type: 'hr_consult', co: '(주)가나상사', date: '2026-11-03', scope: '직무분석 컨설팅', period: '3개월', staff: 30, fileId: 'f1', ownerGuess: '박한별', review: 'ok' },
  { id: 'q2', doc: 'contract', type: 'advice', co: '나다물산', date: '2026-10-20', scope: '월 자문', review: 'ok' },
  { id: 'q3', doc: 'quote', type: 'hr_consult', co: '다라전자', date: '2026-10-01', review: 'check', fileId: 'f3' },
  { id: 'q4', doc: 'quote', type: 'education', co: '마바테크', date: '2026-09-15', scope: '성희롱예방교육', review: 'ok' }
];
const AMTS = { q1: { amount: 4000000, vat: 'excl', owner: 'u7' }, q2: { amount: 1200000, vat: 'incl', owner: '' } };
const STAFF = [{ uid: 'u7', name: '김노무' }, { uid: 'u8', name: '이영희' }];

function host(over) {
  const calls = { open: [], confirm: [], toast: [], amountsFor: [] };
  const h = Object.assign({
    list: () => Promise.resolve(ROWS.map((r) => Object.assign({}, r))),
    amounts: (ids) => { calls.amountsFor.push(ids); return Promise.resolve(h.__amts || {}); },
    confirmOwners: (ids, uid, name) => { calls.confirm.push({ ids, uid, name }); return Promise.resolve(); },
    openFile: (rec) => { calls.open.push(rec.id); return Promise.resolve(); },
    staff: () => Promise.resolve(STAFF),
    toast: (m) => calls.toast.push(m),
    ask: () => true,
    role: {}, uid: 'u1'
  }, over || {});
  h.calls = calls;
  return h;
}
async function mountWith(over, amts) {
  const b = load(), root = node('div'), h = host(over);
  h.__amts = amts || {};
  const ui = b.PuQuotesView.mount(root, h);
  await settle();
  return { b, root, h, ui };
}
const MONEY = /\d{1,3}(,\d{3})+원/;

/* ── 순수 함수 ── */
test('groupByType — 종류 순서대로, 빈 묶음은 뺀다', () => {
  const g = out(load().PuQuotesView.groupByType(ROWS));
  assert.deepStrictEqual(g.map((x) => x.code), ['education', 'hr_consult', 'advice']);
  assert.deepStrictEqual(g.find((x) => x.code === 'hr_consult').rows.map((r) => r.id), ['q1', 'q3']);
  assert.strictEqual(g[0].label, '교육·강의');
});
test('groupByType — 모르는 종류 값은 «기타» 로 모은다(사라지지 않는다)', () => {
  const g = out(load().PuQuotesView.groupByType([{ id: 'x', type: '새종류' }, { id: 'y', type: 'other' }]));
  assert.deepStrictEqual(g.map((x) => x.code), ['other']);
  assert.strictEqual(g[0].rows.length, 2);
});
test('amountText — 금액·부가세', () => {
  const t = load().PuQuotesView.amountText;
  assert.strictEqual(t({}, { amount: 4000000, vat: 'excl' }, true), '4,000,000원 (부가세 별도)');
  assert.strictEqual(t({}, { amount: 4000000, vat: 'incl' }, true), '4,000,000원 (부가세 포함)');
  assert.strictEqual(t({}, { amount: 4000000, vat: '' }, true), '4,000,000원');
});
test('amountText — 못 읽었으면 «확인 필요», 값이 없으면 «—», 권한이 없으면 «금액 비공개» (0원으로 그리지 않는다)', () => {
  const t = load().PuQuotesView.amountText;
  assert.strictEqual(t({ review: 'check' }, null, true), '확인 필요');
  assert.strictEqual(t({ review: 'ok' }, null, true), '—');
  assert.strictEqual(t({ review: 'check' }, { owner: 'u1', vat: '' }, false), '확인 필요', '담당만 있는 칸 — 금액을 못 읽은 건');
  assert.strictEqual(t({ review: 'check' }, null, false), '금액 비공개');
  assert.strictEqual(t({ review: 'ok' }, null, false), '금액 비공개');
  ['확인 필요', '—', '금액 비공개'].forEach((s) => assert.ok(!/0원/.test(s)));
});
test('amountText — 권한 없는 사람에게는 «확인 필요» 도 안 말한다(금액이 비었는지조차 새지 않게)', () => {
  assert.strictEqual(load().PuQuotesView.amountText({ review: 'check' }, null, false), '금액 비공개');
});
test('ownerInfo — 확정이면 이름(아이디 아님), 아니면 추정', () => {
  const o = load().PuQuotesView.ownerInfo;
  assert.deepStrictEqual(out(o({ ownerGuess: '박한별' }, { owner: 'u7' }, { u7: '김노무' })), { text: '김노무', confirmed: true });
  assert.strictEqual(o({}, { owner: 'u7' }, {}).text, '담당 확정됨', '이름을 못 찾았을 때 아이디(u7)를 적지 않는다');
  assert.deepStrictEqual(out(o({ ownerGuess: '박한별' }, { owner: '' }, {})), { text: '담당(추정) 박한별', confirmed: false });
  assert.deepStrictEqual(out(o({}, null, {})), { text: '—', confirmed: false });
});
test('canOpen — 서버(puDocSecret)와 같은 기준: 총괄·재무·확정 담당자', () => {
  const c = load().PuQuotesView.canOpen;
  const rec = { fileId: 'f1' };
  assert.strictEqual(c(rec, null, { isAdmin: true }, 'a'), true);
  assert.strictEqual(c(rec, null, { fin: true }, 'f'), true);
  assert.strictEqual(c(rec, { owner: 'u7' }, {}, 'u7'), true);
  assert.strictEqual(c(rec, { owner: 'u8' }, {}, 'u7'), false);
  assert.strictEqual(c(rec, { owner: '' }, {}, ''), false, '빈 uid 와 빈 owner 가 «같다»고 열리면 안 된다');
  assert.strictEqual(c(rec, null, { isSubAdmin: true }, 's'), false, '부관리자는 뺀다');
  assert.strictEqual(c({}, null, { isAdmin: true }, 'a'), false, '파일이 없으면 열 것이 없다');
});
test('filterRows — 글자(의뢰처·과업)와 견적/계약', () => {
  const f = load().PuQuotesView.filterRows;
  assert.deepStrictEqual(out(f(ROWS, { text: '가나' }).map((r) => r.id)), ['q1']);
  assert.deepStrictEqual(out(f(ROWS, { text: '자문' }).map((r) => r.id)), ['q2']);
  assert.deepStrictEqual(out(f(ROWS, { doc: 'contract' }).map((r) => r.id)), ['q2']);
  assert.deepStrictEqual(out(f(ROWS, {}).map((r) => r.id)), ['q1', 'q2', 'q3', 'q4']);
});
test('importResultText — 한 문장', () => {
  const t = load().PuQuotesView.importResultText;
  assert.strictEqual(t({ done: 12, check: 4, skipped: 3, failed: 1, left: 0 }), '12건을 가져왔습니다 · 확인 필요 4건 · 이미 있어 건너뜀 3건 · 가져오지 못함 1건');
  assert.strictEqual(t({ done: 5, left: 20, stopped: 'AI 하루 한도' }), '5건을 가져왔습니다 · 남은 20건 — 멈춤: AI 하루 한도');
});

/* ── 화면 ── */
test('★ 권한 없는 직원 — 숫자 금액이 화면에 없다 · 「금액 비공개」 · 열기 단추 없음', async () => {
  const { root, h } = await mountWith({ role: {} }, {});
  const txt = textOf(root);
  assert.ok(!MONEY.test(txt), '숫자 금액이 보인다: ' + (txt.match(MONEY) || [])[0]);
  assert.ok(!/\d{4,}/.test(txt.replace(/\d{4}-\d{2}-\d{2}/g, '')), '긴 숫자가 보인다');
  assert.strictEqual(byClass(root, 'c-amt').filter((c) => c._text === '금액 비공개').length, 4);
  assert.strictEqual(byClass(root, 'c-open').reduce((n, c) => n + c.children.length, 0), 0, '열기 단추가 있으면 안 된다');
  assert.strictEqual(h.calls.confirm.length, 0);
});
test('★ 권한 없는 직원 — 금액이 있어도(서버가 안 내줘서 amounts 가 빈 값) 같은 화면', async () => {
  const { root } = await mountWith({ role: {}, amounts: () => Promise.resolve({}) }, {});
  assert.ok(!MONEY.test(textOf(root)));
});
test('확정 담당자 — 자기 건 금액만 보이고 나머지는 비공개, 열기는 자기 건만', async () => {
  const mine = { q1: { amount: 4000000, vat: 'excl', owner: 'u7' } };
  const { root } = await mountWith({ role: {}, uid: 'u7' }, mine);
  const amts = byClass(root, 'c-amt').map((c) => c._text);
  assert.ok(amts.includes('4,000,000원 (부가세 별도)'));
  assert.strictEqual(amts.filter((x) => x === '금액 비공개').length, 3);
  assert.strictEqual(byClass(root, 'c-open').reduce((n, c) => n + c.children.length, 0), 1);
});
test('재무 — 전부 보인다', async () => {
  const { root } = await mountWith({ role: { fin: true }, uid: 'f1' }, AMTS);
  const amts = byClass(root, 'c-amt').map((c) => c._text);
  assert.ok(amts.includes('4,000,000원 (부가세 별도)') && amts.includes('1,200,000원 (부가세 포함)'));
  assert.ok(amts.includes('확인 필요'), '금액을 못 읽은 q3');
  assert.ok(amts.includes('—'), '값이 없는 q4');
  assert.ok(!amts.includes('금액 비공개'));
});
test('총괄관리자 — 열기를 누르면 그 건으로 openFile', async () => {
  const { root, h } = await mountWith({ role: { isAdmin: true }, uid: 'a1' }, AMTS);
  const open = byClass(root, 'c-open').map((c) => c.children[0]).filter(Boolean);
  assert.strictEqual(open.length, 2, '파일이 있는 건(q1·q3)만');
  fire(open[0], 'click'); await settle();
  assert.deepStrictEqual(h.calls.open, ['q1']);
});
test('열기 실패 — 죽지 않고 안내(toast)', async () => {
  const { root, h } = await mountWith({ role: { isAdmin: true }, uid: 'a1', openFile: () => Promise.reject(new Error('🔒 이 파일은 대표·관리자·재무·담당자만 열 수 있습니다.')) }, AMTS);
  fire(byClass(root, 'c-open').map((c) => c.children[0]).filter(Boolean)[0], 'click'); await settle();
  assert.ok(h.calls.toast.some((m) => /열지 못했습니다/.test(m)));
});
test('번호 — 보이는 순서로 1부터 이어서, 거르면 다시 매긴다', async () => {
  const { root } = await mountWith({ role: { fin: true } }, AMTS);
  assert.deepStrictEqual(byClass(root, 'c-no').map((c) => c._text), ['1', '2', '3', '4']);
  const search = byTag(root, 'input').filter((i) => i.attrs.type === 'search')[0];
  search.value = '나다'; fire(search, 'input');
  assert.deepStrictEqual(byClass(root, 'c-no').map((c) => c._text), ['1']);
});
test('모든 줄 맨 왼쪽은 ☐ 다음은 번호', async () => {
  const { root } = await mountWith({ role: {} }, {});
  byClass(root, 'pqv-row').filter((r) => r.className.indexOf('pqv-head') < 0).forEach((row) => {
    assert.ok(row.children[0].className.indexOf('c-chk') >= 0 && row.children[0].children[0].attrs.type === 'checkbox');
    assert.ok(row.children[1].className.indexOf('c-no') >= 0);
  });
});
test('고르기만으로는 아무것도 안 바뀐다 — «N건 선택» 이 뜨고, 권한 없는 사람에게는 담당 확정이 없다', async () => {
  const { root, h } = await mountWith({ role: {} }, {});
  const row = byClass(root, 'pqv-row').filter((r) => r.className.indexOf('pqv-head') < 0)[0];
  const cb = row.children[0].children[0]; cb.checked = true; fire(cb, 'change');
  assert.ok(/1건 선택/.test(textOf(root)));
  assert.ok(!btnByText(root, '담당 확정'));
  assert.strictEqual(h.calls.confirm.length, 0);
});
test('머리줄 ☐ — 지금 보이는 줄만 모두 고른다(거른 뒤에는 그 줄만)', async () => {
  const { root, ui } = await mountWith({ role: {} }, {});
  const search = byTag(root, 'input').filter((i) => i.attrs.type === 'search')[0];
  search.value = '자문'; fire(search, 'input');
  const head = byClass(root, 'pqv-head')[0];
  const hc = head.children[0].children[0]; hc.checked = true; fire(hc, 'change');
  assert.deepStrictEqual(ui.selected(), ['q2']);
});
test('총괄관리자 담당 확정 — 건수를 묻고 한 번에 저장, 끝나면 고른 것을 비운다', async () => {
  const { root, h, ui } = await mountWith({ role: { isAdmin: true }, uid: 'a1' }, AMTS);
  byClass(root, 'pqv-row').filter((r) => r.className.indexOf('pqv-head') < 0).slice(0, 2).forEach((r) => { const c = r.children[0].children[0]; c.checked = true; fire(c, 'change'); });
  assert.ok(/2건 선택/.test(textOf(root)));
  assert.ok(btnByText(root, '담당 확정').attrs.disabled !== undefined, '직원을 고르기 전에는 누를 수 없다');
  const sel = byTag(root, 'select')[0]; sel.value = 'u8'; fire(sel, 'change');
  fire(btnByText(root, '담당 확정'), 'click'); await settle();
  assert.strictEqual(h.calls.confirm.length, 1);
  /* 보이는 순서는 업무 종류 묶음 순(교육·강의 → 인사노무 컨설팅 …)이라 첫 두 줄은 q4·q1 이다 */
  assert.deepStrictEqual(out(h.calls.confirm[0]), { ids: ['q4', 'q1'], uid: 'u8', name: '이영희' });
  assert.deepStrictEqual(ui.selected(), []);
  assert.ok(h.calls.toast.some((m) => /2건/.test(m) && /이영희/.test(m)));
  assert.ok(!/u8/.test(h.calls.toast.join(' ')), '알림에 아이디를 적지 않는다');
});
test('담당 확정 — 묻는 창에서 아니라고 하면 아무것도 안 쓴다', async () => {
  const { root, h } = await mountWith({ role: { isAdmin: true }, uid: 'a1', ask: () => false }, AMTS);
  const c = byClass(root, 'pqv-row').filter((r) => r.className.indexOf('pqv-head') < 0)[0].children[0].children[0]; c.checked = true; fire(c, 'change');
  const sel = byTag(root, 'select')[0]; sel.value = 'u8'; fire(sel, 'change');
  fire(btnByText(root, '담당 확정'), 'click'); await settle();
  assert.strictEqual(h.calls.confirm.length, 0);
});
test('담당 확정 실패 — 고른 것을 그대로 두고 안내', async () => {
  const { root, h, ui } = await mountWith({ role: { isAdmin: true }, uid: 'a1', confirmOwners: () => Promise.reject(new Error('permission_denied')) }, AMTS);
  const c = byClass(root, 'pqv-row').filter((r) => r.className.indexOf('pqv-head') < 0)[0].children[0].children[0]; c.checked = true; fire(c, 'change');
  const sel = byTag(root, 'select')[0]; sel.value = 'u8'; fire(sel, 'change');
  fire(btnByText(root, '담당 확정'), 'click'); await settle();
  assert.ok(h.calls.toast.some((m) => /확정하지 못했습니다/.test(m)));
  assert.strictEqual(ui.selected().length, 1);
});
test('화면을 떠나면(clearSelection) 고른 것을 비운다', async () => {
  const { root, ui } = await mountWith({ role: {} }, {});
  const c = byClass(root, 'pqv-row').filter((r) => r.className.indexOf('pqv-head') < 0)[0].children[0].children[0]; c.checked = true; fire(c, 'change');
  assert.strictEqual(ui.selected().length, 1);
  ui.clearSelection();
  assert.strictEqual(ui.selected().length, 0);
  assert.ok(!/건 선택/.test(textOf(root)));
});
test('목록을 못 불러오면 죽지 않고 «다시 불러오기»', async () => {
  const { root } = await mountWith({ list: () => Promise.reject(new Error('network')) }, {});
  assert.ok(/불러오지 못했습니다/.test(textOf(root)));
  assert.ok(btnByText(root, '다시 불러오기'));
});
test('빈 목록 — 안내 문구', async () => {
  const { root } = await mountWith({ list: () => Promise.resolve([]) }, {});
  assert.ok(/아직 모아 둔 견적·계약이 없습니다/.test(textOf(root)));
});
test('금액 읽기가 실패하면(권한 거절이 아닌 오류) 재무·관리자에게는 «읽지 못했습니다» — 비공개로 거짓말하지 않는다', async () => {
  const { root } = await mountWith({ role: { isAdmin: true }, amounts: () => Promise.reject(new Error('network down')) }, {});
  assert.ok(byClass(root, 'c-amt').every((c) => c._text === '금액을 읽지 못했습니다'));
});
test('★ 사용자 값은 글자로만 — innerHTML 에 회사 이름을 넣지 않는다', async () => {
  const evil = '<img src=x onerror=alert(1)>';
  const { root } = await mountWith({ role: {}, list: () => Promise.resolve([{ id: 'x1', doc: 'quote', type: 'other', co: evil, scope: evil, date: '2026-11-01', review: 'ok' }]) }, {});
  assert.ok(byClass(root, 'c-co').some((c) => c._text === evil));
  all(root).forEach((n) => n.htmlWrites.forEach((v) => assert.strictEqual(v, '')));
  assert.strictEqual(root.htmlWrites.filter(Boolean).length, 0);
});
test('업무 종류 묶음 머리줄에 건수', async () => {
  const { root } = await mountWith({ role: {} }, {});
  const g = byClass(root, 'pqv-g').map(textOf).join('|');
  assert.ok(/인사노무 컨설팅/.test(g) && /2건/.test(g));
});

/* ── 가져오기(작업 7이 채운다) ── */
test('가져오기 줄 — 총괄관리자에게만, 연결돼 있을 때만 · 화면을 열 때는 세지 않는다(메일 천 통을 읽어야 해서)', async () => {
  let counted = 0;
  const importer = { count: () => { counted++; return Promise.resolve(63); }, run: () => Promise.resolve({ done: 0 }) };
  const a = await mountWith({ role: { isAdmin: true }, importer }, {});
  assert.ok(btnByText(a.root, '📥 보낸메일에서 가져오기'));
  assert.strictEqual(counted, 0, '열 때 건수를 세면 매번 메일 줄을 다 읽는다');
  const f = await mountWith({ role: { fin: true }, importer }, {});
  assert.ok(!btnByText(f.root, '📥 보낸메일에서 가져오기'));
  const n = await mountWith({ role: { isAdmin: true } }, {});
  assert.ok(!btnByText(n.root, '📥'));
});
test('가져오기 — 눌러서 묻고, 돌리고, 결과 문장을 보이고, 목록을 다시 읽는다', async () => {
  let listed = 0, ran = 0;
  const importer = { count: () => Promise.resolve(2), run: (step) => { ran++; step('1/2 · 직무분석 컨설팅 견적서'); return Promise.resolve({ done: 2, skipped: 0, failed: 0, left: 0 }); } };
  const { root } = await mountWith({ role: { isAdmin: true }, importer, list: () => { listed++; return Promise.resolve(ROWS.map((r) => Object.assign({}, r))); } }, {});
  fire(btnByText(root, '📥 보낸메일에서 가져오기'), 'click'); await settle();
  assert.strictEqual(ran, 1);
  assert.ok(listed >= 2, '끝난 뒤 목록을 다시 읽어야 한다');
  assert.ok(/2건을 가져왔습니다/.test(textOf(root)));
});
test('가져오기 — 묻는 창에서 아니라고 하면 시작하지 않는다', async () => {
  let ran = 0;
  const { root } = await mountWith({ role: { isAdmin: true }, ask: () => false, importer: { run: () => { ran++; return Promise.resolve({}); } } }, {});
  fire(btnByText(root, '📥 보낸메일에서 가져오기'), 'click'); await settle();
  assert.strictEqual(ran, 0);
  assert.ok(btnByText(root, '📥 보낸메일에서 가져오기').attrs.disabled === undefined, '아니라고 했으면 다시 누를 수 있다');
});
test('가져오기 — 누를 때 건수를 세어 묻는 말에 넣는다 · 새로 가져올 것이 0 이면 묻지도 않는다', async () => {
  const asked = []; let ran = 0;
  const importer = { count: () => Promise.resolve(63), run: () => { ran++; return Promise.resolve({ done: 63 }); } };
  const a = await mountWith({ role: { isAdmin: true }, importer, ask: (m) => { asked.push(m); return true; } }, {});
  fire(btnByText(a.root, '📥 보낸메일에서 가져오기'), 'click'); await settle();
  assert.ok(/63건/.test(asked[0]), '묻는 말에 건수가 있어야 한다');
  assert.strictEqual(ran, 1);
  const none = [];
  const z = await mountWith({ role: { isAdmin: true }, ask: (m) => { none.push(m); return true; },
    importer: { count: () => Promise.resolve(0), run: () => { ran++; return Promise.resolve({}); } } }, {});
  fire(btnByText(z.root, '📥 보낸메일에서 가져오기'), 'click'); await settle();
  assert.strictEqual(none.length, 0); assert.strictEqual(ran, 1);
  assert.ok(/새로 가져올 견적·계약이 없습니다/.test(textOf(z.root)));
});
test('가져오기 — 건수를 못 세거나 가져오다 실패해도 죽지 않고 알린다(다시 누를 수 있다)', async () => {
  const { root } = await mountWith({ role: { isAdmin: true }, importer: { count: () => Promise.reject(new Error('메일을 읽지 못했습니다')), run: () => Promise.resolve({}) } }, {});
  fire(btnByText(root, '📥 보낸메일에서 가져오기'), 'click'); await settle();
  assert.ok(/가져오지 못했습니다 — 메일을 읽지 못했습니다/.test(textOf(root)));
  assert.ok(btnByText(root, '📥 보낸메일에서 가져오기').attrs.disabled === undefined);
});

/* ── 소스 글자 지킴 ── */
test('소스 — innerHTML 은 비울 때만, 폰 구간·한 줄 칸·입력칸 16px', () => {
  const S = read('js/pu-quotes-view.js');
  const writes = S.match(/innerHTML\s*=\s*[^;]+;/g) || [];
  writes.forEach((x) => assert.match(x, /=\s*''\s*;/, 'innerHTML 에 비어 있지 않은 값을 넣는다: ' + x));
  assert.match(S, /@media\(max-width:700px\)/);
  assert.match(S, /white-space:nowrap/);
  assert.match(S, /text-overflow:ellipsis/);
  assert.match(S, /input\[type=search\],\.pqv select\{font-size:16px\}/);
  assert.match(S, /font-variant-numeric:tabular-nums/);
  /* 폰 카드 — 둘째 줄(meta)이 카드 전체 폭, 열기는 그림 단추 + title(저장소 폰 규칙) */
  assert.match(S, /"chk no meta meta meta"/);
  assert.match(S, /\.c-open \.btn:before\{content:"📂"/);
  assert.match(S, /setAttribute\('title', '원본 열기'\)/);
});
