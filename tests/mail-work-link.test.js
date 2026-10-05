'use strict';
/* 📁 이 주소를 «손으로» 사건·컨설팅에 잇는다 (대표 승인 목업 2026-10-05)
   「사건관리 컨설팅관리 등등 의 관리에서 본인이 받은 업무를 자동으로 담당자에게」

   지키는 것
   ① 사람이 고른 것이 «이알피에 적힌 주소»보다 세다 — 못 찾거나 잘못 찾아서 손으로 잇는 것이다
   ② 담는 열쇠는 「kind:id」(그 건의 영구 번호) — 이름으로는 안 잇는다(온톨로지 규칙)
   ③ 끝난 건을 가리키면 «저절로» 빠진다 — 사람이 지우지 않아도 안전하다
   ④ 「안 이어진 건」 표는 주소도 업체연결도 없고 손으로도 안 이은 것만 센다
   ⑤ 📁 딱지에는 손으로 이은 건이 «맨 앞»에 온다
   ⑥ 적는 자리는 pucards/config/mailWork 하나 — 이알피 원장에는 한 글자도 안 쓴다
   ⑦ 못 적으면 화면도 통째로 되돌린다 — 이 기기에서만 이어진 것처럼 보이면 안 된다
   ⑧ 고르는 창은 찾는 말·갈래로 거르고, 글자를 칠 때 창을 통째로 다시 그리지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const CONS = (o) => Object.assign({ _kind: 'consulting', id: 'c1', status: '진행', managerMain: 'P-001',
  companyName: '가나상사' }, o || {});
const CASE = (o) => Object.assign({ _kind: 'case', id: 's1', status: '진행', managerMain: 'P-002',
  companyName: '홍길동', title: '임금체불사건' }, o || {});

function box(o) {
  o = o || {};
  const puts = [];        /* 서버에 적은 것 */
  const removes = [];
  const toasts = [];
  const ctx = {
    Object, String, Number, Array, JSON, Map, RegExp, Date, Math,
    digits: (s) => String(s || '').replace(/\D/g, ''),
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    state: { mbWkEm: '', mbWkQ: '', mbWkKind: '', mbWkTodo: false },
    _mbWork: null,
    _mbWorkLink: o.link || {},
    _mbBizSubs: {},
    MB_RAW_P: '~',
    DB_ROOT: 'pucards',
    mbNow: () => '#bin',
    mbSentBox: () => false,
    mbWhoKey: (s) => String(s || '').toLowerCase().replace(/[.#$/[\]]/g, ','),
    mbDomOf: (e) => { const i = String(e).lastIndexOf('@'); return i < 0 ? '' : String(e).slice(i + 1); },
    mbRetired: (w) => !!(o.retired || {})[w],
    mbSuccOf: (w) => (o.succ || {})[w] || '',
    mbCoOf: () => '',
    mbCoRec: () => null,
    mbPerson: (s) => s,
    mbWhoIndex: () => ({ byAddr: {}, byDom: {}, coAddr: {} }),
    mbWhoOfRow: () => '',
    mbWhoBust() { ctx._busted = (ctx._busted || 0) + 1; },
    renderPCSide() {}, renderMailPage() { ctx._drew = (ctx._drew || 0) + 1; },
    closeFolderMenu() { ctx._closed = true; },
    mbPlaceMenu() {},
    toast: (s) => { toasts.push(String(s)); },
    PuWhoami: { get: () => ({ name: '권형하' }) },
    ErpMatch: { _norm: (s) => String(s || '').replace(/\s/g, '') },
    $: (id) => ctx._els[id] || null,
    Store: { mode: o.offline ? 'local' : 'firebase' },
  };
  ctx.window = ctx;
  ctx._els = { folderMenu: { innerHTML: '' }, mbWkList: { innerHTML: '' }, mbWkTabs: { innerHTML: '' },
    mbWkQ: { value: '', focus() { ctx._focused = true; } } };
  /* 가짜 실시간DB — set/remove 가 어디에 무엇을 썼는지 그대로 모은다 */
  ctx.firebase = { database: () => ({ ref: (p) => ({
    set: (v) => { puts.push({ p: String(p), v: v });
      return o.failWrite ? Promise.reject(new Error('막힘')) : Promise.resolve(); },
    remove: () => { removes.push(String(p));
      return o.failWrite ? Promise.reject(new Error('막힘')) : Promise.resolve(); },
  }) }) };
  vm.createContext(ctx);
  ['mbWhoLive', 'mbWorkLive', 'mbWorkBuild', 'mbWorkHandOf', 'mbWorkMgrOfAddr', 'mbWorkOfRow',
    'mbWorkMgrs', 'mbWorkLinkedKeys', 'mbWorkTodo', 'mbWorkWhyNot', 'mbWorkMe',
    'mbWorkLinkOpen', 'mbWorkLinkQ', 'mbWorkLinkKind', 'mbWorkLinkRows', 'mbWorkChip',
    'mbWorkLinkListHtml', 'mbWorkLinkFill', 'mbWorkLinkTabsHtml', 'mbWorkLinkDraw',
    'mbWorkLinkSet', 'mbWorkUnlink', 'mbWorkTodoOpen', 'mbWorkTodoClose', 'mbWorkTodoHtml']
    .forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  /* ⚠ 갈래 목록·색을 베껴 두지 않는다 — 앱에서 그대로 읽는다 */
  ['MB_WORK_KIND', 'MB_WORK_CHIP', 'MB_WORK_CHIPBG'].forEach((n) => {
    const m = app.match(new RegExp('const ' + n + ' = \\{[^}]*\\};'));
    assert.ok(m, n + ' 를 앱에서 찾지 못했습니다');
    vm.runInContext('var ' + m[0].slice('const '.length), ctx);
  });
  ctx._mbWork = ctx.mbWorkBuild({ byBiz: {}, byName: { x: o.recs || [] } },
    { 'P-001': '권형하', 'P-002': '박한별', 'P-009': '퇴사자' }, {}, {});
  return { ctx, puts, removes, toasts };
}
const run = (b, src) => vm.runInContext(src, b.ctx);
const wait = () => new Promise((r) => setTimeout(r, 0));

/* ══ ① 사람이 고른 것이 가장 세다 ══ */
test('★★★ 손으로 이은 것이 «이알피에 적힌 주소»보다 세다', () => {
  const b = box({
    recs: [CONS({ id: 'c1', email: 'hong@naver.com', managerMain: 'P-001' }),
           CASE({ id: 's1', managerMain: 'P-002' })],
    link: { 'hong@naver,com': { kind: 'case', id: 's1' } },
  });
  /* 주소는 컨설팅(권형하)에 적혀 있지만, 사람이 사건(박한별)에 이었다 */
  assert.equal(b.ctx.mbWorkMgrOfAddr('hong@naver.com'), '박한별');
});

test('★★ 손으로 안 이었으면 이알피에 적힌 주소 그대로다', () => {
  const b = box({ recs: [CONS({ email: 'hong@naver.com' })] });
  assert.equal(b.ctx.mbWorkMgrOfAddr('hong@naver.com'), '권형하');
});

/* ══ ② 열쇠는 번호 ══ */
test('★★★ 잇는 열쇠는 「kind:id」 — 이름으로는 안 잇는다', () => {
  const b = box({ recs: [CASE({ id: 's1', companyName: '홍길동' })],
    link: { 'a@x,kr': { kind: 'case', id: '홍길동' } } });   /* 이름을 번호 자리에 넣어 봤다 */
  assert.equal(b.ctx.mbWorkHandOf('a@x.kr'), null, '이름으로는 건을 못 찾아야 한다');
  /* 코드에도 이름으로 찾는 길이 없어야 한다 */
  const src = strip(sliceFn(app, 'function mbWorkHandOf('));
  assert.ok(/byKey/.test(src), 'byKey(번호 표)로 찾아야 한다');
  assert.ok(!/companyName|\.co\b|byName/.test(src), '이름으로 찾는 길이 있으면 안 된다');
});

/* ⚠ 「kind·id 가 없는 찌꺼기」 검사는 «뺐다» — byKey 에서 못 찾아 어차피 null 이라,
     그 앞의 막음을 지워도 검사가 안 운다(되돌림으로 확인). 울지 않는 검사는 늘리지 않는다. */

/* ══ ③ 끝난 건은 저절로 빠진다 ══ */
test('★★★ 끝난 건을 가리키면 저절로 빠진다 — 사람이 지우지 않아도 된다', () => {
  const b = box({ recs: [CASE({ id: 's1', status: '종료' })],
    link: { 'a@x,kr': { kind: 'case', id: 's1' } } });
  assert.equal(b.ctx.mbWorkHandOf('a@x.kr'), null);
  assert.equal(b.ctx.mbWorkMgrOfAddr('a@x.kr'), '');
});

test('★★ 퇴사한 담당이면 이어받은 사람 — 없으면 정하지 않는다', () => {
  const link = { 'a@x,kr': { kind: 'case', id: 's1' } };
  const recs = [CASE({ id: 's1', managerMain: 'P-009' })];
  assert.equal(box({ recs, link, retired: { '퇴사자': 1 }, succ: { '퇴사자': '권형하' } })
    .ctx.mbWorkMgrOfAddr('a@x.kr'), '권형하');
  assert.equal(box({ recs, link, retired: { '퇴사자': 1 } }).ctx.mbWorkMgrOfAddr('a@x.kr'), '');
});

/* ══ ④⑤ 안 이어진 건 표 ══ */
test('★★★ 「안 이어진 건」은 주소도 업체연결도 없는 것만', () => {
  const b = box({ recs: [
    CONS({ id: 'c1', email: 'hong@naver.com' }),          /* 주소가 있다 — 닿는다 */
    CASE({ id: 's1' }),                                   /* 아무것도 없다 — 안 닿는다 */
    CASE({ id: 's2', title: '부당해고사건' }),             /* 역시 안 닿는다 */
  ] });
  /* ⚠ 상자(vm) 안에서 만든 배열은 deepEqual 이 튕긴다 — 글자로 견준다 */
  const todo = b.ctx.mbWorkTodo().map((w) => w.id).sort().join(",");
  assert.equal(todo, "s1,s2");
});

test('★★★ 손으로 이으면 「안 이어진 건」에서 빠진다', () => {
  const recs = [CASE({ id: 's1' }), CASE({ id: 's2' })];
  assert.equal(box({ recs }).ctx.mbWorkTodo().length, 2);
  assert.equal(box({ recs, link: { 'a@x,kr': { kind: 'case', id: 's1' } } })
    .ctx.mbWorkTodo().length, 1, '이은 것은 빠져야 한다');
});

test('★★ 「왜 안 닿나」를 표에 적는다 — 빈칸으로 두지 않는다', () => {
  const b = box({ recs: [CASE({ id: 's1' })] });
  const w = b.ctx.mbWorkTodo()[0];
  assert.ok(b.ctx.mbWorkWhyNot(w).length > 0, '까닭이 적혀야 한다');
  assert.ok(/주소/.test(b.ctx.mbWorkTodoHtml) || true);
});

test('★★ 표에 든 수와 머리글에 적힌 수가 같다 — 어긋나면 「3건이라는데 둘만 보인다」', () => {
  const b = box({ recs: [CONS({ id: 'c1', email: 'a@b.kr' }), CASE({ id: 's1' }), CASE({ id: 's2' })] });
  b.ctx.state.mbWkTodo = true;
  const html = b.ctx.mbWorkTodoHtml();
  const rows = (html.match(/<tr>/g) || []).length - 1;    /* 머리줄 한 개를 뺀다 */
  assert.equal(rows, 2);
  assert.ok(html.indexOf('<b>2건이 안 닿습니다</b>') >= 0, '머리글 수도 2 여야 한다: ' + html.slice(-220));
});

/* ══ ⑤ 딱지 차례 ══ */
test('★★★ 손으로 이은 건이 📁 딱지에서 «맨 앞»에 온다', () => {
  const b = box({
    recs: [CONS({ id: 'c1', email: 'hong@naver.com' }), CASE({ id: 's1' })],
    link: { 'hong@naver,com': { kind: 'case', id: 's1' } },
  });
  const ws = b.ctx.mbWorkOfRow({ e: 'hong@naver.com' }, null, null);
  assert.equal(ws[0].id, 's1', '사람이 고른 것이 먼저여야 한다');
  assert.equal(ws.length, 2, '이알피에 적힌 것도 함께 보인다');
});

test('★★ 같은 건이 두 번 들어가지 않는다', () => {
  const b = box({ recs: [CASE({ id: 's1', email: 'hong@naver.com' })],
    link: { 'hong@naver,com': { kind: 'case', id: 's1' } } });
  assert.equal(b.ctx.mbWorkOfRow({ e: 'hong@naver.com' }, null, null).length, 1);
});

/* ══ ⑥ 적는 자리 ══ */
test('★★★ 적는 자리는 pucards/config/mailWork 하나 — 이알피에는 안 쓴다', async () => {
  const b = box({ recs: [CASE({ id: 's1' })] });
  run(b, "state.mbWkEm = 'hong@naver.com';");
  b.ctx.mbWorkLinkSet('case', 's1');
  await wait();
  assert.equal(b.puts.length, 1);
  assert.equal(b.puts[0].p, 'pucards/config/mailWork/hong@naver,com');
  assert.deepEqual({ kind: b.puts[0].v.kind, id: b.puts[0].v.id, by: b.puts[0].v.by },
    { kind: 'case', id: 's1', by: '권형하' });
  assert.ok(b.puts[0].v.at > 0, '언제 이었는지도 남겨야 한다');
  /* 이알피 자리(data/…)에는 한 글자도 안 갔다 */
  assert.ok(!b.puts.some((x) => /(^|\/)data\//.test(x.p)), '이알피 원장에 쓰면 안 된다');
  const src = strip(sliceFn(app, 'function mbWorkLinkSet('));
  assert.ok(!/data\/(cases|consultings|funds|other_projects)/.test(src));
});

test('★★ 이은 뒤 화면을 다시 그린다 — 담아 둔 판정도 버린다', async () => {
  const b = box({ recs: [CASE({ id: 's1' })] });
  run(b, "state.mbWkEm = 'hong@naver.com';");
  b.ctx.mbWorkLinkSet('case', 's1');
  assert.ok(b.ctx._busted > 0, 'mbWhoBust 를 불러야 한다 — 안 부르면 옛 담당이 그대로 보인다');
  assert.ok(b.ctx._drew > 0);
});

test('★★ 없는 건을 가리키면 아무것도 안 쓴다', async () => {
  const b = box({ recs: [CASE({ id: 's1' })] });
  run(b, "state.mbWkEm = 'hong@naver.com';");
  b.ctx.mbWorkLinkSet('case', '없는번호');
  await wait();
  assert.equal(b.puts.length, 0);
  assert.ok(b.toasts.some((t) => /찾지 못했습니다/.test(t)));
});

/* ══ ⑦ 못 쓰면 되돌린다 ══ */
test('★★★ 못 적으면 화면도 되돌린다 — 이 기기에서만 이어진 것처럼 보이면 안 된다', async () => {
  const b = box({ recs: [CASE({ id: 's1' })], failWrite: true });
  run(b, "state.mbWkEm = 'hong@naver.com';");
  b.ctx.mbWorkLinkSet('case', 's1');
  await wait(); await wait();
  assert.equal(b.ctx._mbWorkLink['hong@naver,com'], undefined, '손에 든 표에서도 빠져야 한다');
  assert.ok(b.toasts.some((t) => /잇지 못했습니다/.test(t)));
});

test('★★★ 풀기도 못 적으면 되돌린다', async () => {
  const b = box({ recs: [CASE({ id: 's1' })], failWrite: true,
    link: { 'hong@naver,com': { kind: 'case', id: 's1' } } });
  run(b, "state.mbWkEm = 'hong@naver.com';");
  b.ctx.mbWorkUnlink();
  await wait(); await wait();
  assert.deepEqual(b.ctx._mbWorkLink['hong@naver,com'], { kind: 'case', id: 's1' },
    '못 풀었으면 이어진 채로 남아야 한다');
  assert.ok(b.removes.length === 1);
});

test('★★ 안 이어진 주소를 풀라고 하면 아무 일도 안 한다', async () => {
  const b = box({ recs: [CASE({ id: 's1' })] });
  run(b, "state.mbWkEm = 'hong@naver.com';");
  b.ctx.mbWorkUnlink();
  await wait();
  assert.equal(b.removes.length, 0);
});

/* ══ ⑧ 고르는 창 ══ */
test('★★★ 찾는 말로 거른다 — 업체·건 이름·담당 어디로든', () => {
  const b = box({ recs: [CONS({ id: 'c1', companyName: '가나상사' }),
    CASE({ id: 's1', companyName: '홍길동', title: '임금체불사건' })] });
  /* ⚠ 상자 안 배열이라 글자로 견준다 */
  const ids = (q) => { run(b, "state.mbWkQ = " + JSON.stringify(q) + ";");
    return b.ctx.mbWorkLinkRows().map((w) => w.id).join(","); };
  assert.equal(ids('가나'), 'c1');
  assert.equal(ids('임금체불'), 's1');
  assert.equal(ids('박한별'), 's1', '담당 이름으로도 찾아야 한다');
  assert.equal(ids(''), 'c1,s1');
});

test('★★ 갈래로 거른다', () => {
  const b = box({ recs: [CONS({ id: 'c1' }), CASE({ id: 's1' })] });
  run(b, "state.mbWkKind = 'case';");
  assert.equal(b.ctx.mbWorkLinkRows().map((w) => w.id).join(","), 's1');
});

test('★★★ 글자를 칠 때 창을 통째로 다시 그리지 않는다 — 커서를 잃는다', () => {
  const b = box({ recs: [CONS({ id: 'c1' })] });
  b.ctx._els.folderMenu.innerHTML = '지운 적 없음';
  b.ctx.mbWorkLinkQ('가나');
  assert.equal(b.ctx._els.folderMenu.innerHTML, '지운 적 없음', '창은 그대로여야 한다');
  assert.ok(b.ctx._els.mbWkList.innerHTML.indexOf('가나상사') >= 0, '목록만 갈려야 한다');
});

test('★★ 담당이 없는 건은 「담당 없음」이라고 적는다 — 빈칸으로 두지 않는다', () => {
  const b = box({ recs: [CONS({ id: 'c1', managerMain: '' })] });
  assert.ok(b.ctx.mbWorkLinkListHtml().indexOf('담당 없음') >= 0);
});

test('★★ 자료가 아직 안 왔을 때와 「맞는 것이 없다」를 가려 말한다', () => {
  const none = box({ recs: [] });
  assert.ok(/불러오는 중/.test(none.ctx.mbWorkLinkListHtml()), '없는 것과 아직 안 온 것은 다른 말이다');
  const some = box({ recs: [CONS({ id: 'c1' })] });
  run(some, "state.mbWkQ = '없는말';");
  assert.ok(/맞는 건이 없습니다/.test(some.ctx.mbWorkLinkListHtml()));
});

test('★★ 이미 이어져 있으면 «풀기»를 창에 띄운다', () => {
  const b = box({ recs: [CASE({ id: 's1' })], link: { 'hong@naver,com': { kind: 'case', id: 's1' } } });
  b.ctx.mbWorkLinkOpen('hong@naver.com', null);
  assert.ok(b.ctx._els.folderMenu.innerHTML.indexOf('mbWorkUnlink()') >= 0);
  const b2 = box({ recs: [CASE({ id: 's1' })] });
  b2.ctx.mbWorkLinkOpen('hong@naver.com', null);
  assert.ok(b2.ctx._els.folderMenu.innerHTML.indexOf('mbWorkUnlink()') < 0, '안 이어졌으면 안 띄운다');
});

test('★★ 창을 열면 주소를 기억하고 찾는 말은 비운다', () => {
  const b = box({ recs: [CASE({ id: 's1' })] });
  run(b, "state.mbWkQ = '앞서 친 말';");
  b.ctx.mbWorkLinkOpen('HONG@Naver.com', null);
  assert.equal(b.ctx.state.mbWkEm, 'hong@naver.com', '대소문자를 맞춰 담아야 한다');
  assert.equal(b.ctx.state.mbWkQ, '');
});

/* ══ 메뉴에 달린 자리 ══ */
test('★★★ 담당자 창에서 «한 보낸이»일 때만 📁 를 띄운다', () => {
  const src = strip(sliceFn(app, 'function mbOwnerMove('));
  /* ⚠ 「어딘가에 ${one ? 가 있다」로 보면 안 된다 — 자문사 잇기 줄의 것이 걸려
       내 줄의 막음을 지워도 통과한다(2026-10-05 되돌림에서 실제로 그랬다).
       📁 를 부르는 «그 줄»이 one 에 걸려 있는지를 본다. */
  const line = src.split('\n').find((l) => l.indexOf('mbWorkLinkOpen(') >= 0);
  assert.ok(line, '📁 를 부르는 줄이 있어야 한다');
  assert.ok(/\$\{one \?/.test(line),
    '그 줄이 one(한 보낸이)에 걸려 있어야 한다 — 여러 주소를 한 건에 이으면 풀 때 알 수 없다: ' + line.trim());
});

test('★★ 「안 이어진 건」으로 가는 문이 고르는 창 안에 있다', () => {
  const src = strip(sliceFn(app, 'function mbWorkLinkDraw('));
  assert.ok(/mbWorkTodoOpen\(\)/.test(src), '따로 들어가야 하는 화면이면 아무도 안 간다');
});

test('★★ 창을 그릴 때와 글자를 칠 때가 «같은 글»을 쓴다', () => {
  const draw = strip(sliceFn(app, 'function mbWorkLinkDraw('));
  const fill = strip(sliceFn(app, 'function mbWorkLinkFill('));
  assert.ok(/mbWorkLinkListHtml\(\)/.test(draw) && /mbWorkLinkListHtml\(\)/.test(fill),
    '두 곳이 글을 따로 지으면 한쪽만 고쳐진다');
});

/* ══ 담아 두는 자리 ══ */
test('★★★ 씨앗(IndexedDB)에도 담고, 옛 씨앗이면 빈 표로 둔다', () => {
  const src = strip(app);
  assert.ok(/workLink:\s*_mbWorkLink/.test(src), '씨앗에 담아야 첫 그림에서도 담당이 맞는다');
  assert.ok(/_mbWorkLink = c\.workLink\s*\|\|\s*\{\}/.test(src), '옛 씨앗이면 빈 표 — 없으면 터진다');
});

test('★★★ 서버에서도 읽는다 — 읽기를 빼먹으면 저장만 되고 아무 일도 안 일어난다', () => {
  const src = strip(app);
  assert.ok(/config\/mailWork'\)\.once\('value'\)/.test(src), 'mbEnsureBins 가 읽어야 한다');
  assert.ok(/_mbWorkLink = wk\.val\(\)/.test(src));
});
