'use strict';
/* 👤 명함 담당자 채우기 (대표 지시 2026-10-05 「명함담당자 채우는것도 해라」)

   지키는 것
   ① 차례가 곧 규칙 — 업체 번호 > 메일 담당 > 올린 사람 > 회사 이름
      (계약에 적힌 담당이 「누가 받아 왔나」보다 세다)
   ② 이미 적힌 담당자는 «덮지 않는다»
   ③ 끝난 업체·퇴사자는 안 넣는다(퇴사자는 이어받은 사람, 없으면 안 채운다)
   ④ 이름이 «겹치는» 업체는 아예 안 짚는다 — 남의 회사 담당이 붙는다
   ⑤ 얇은 근거(회사 이름)는 «미리 꺼 둔다» — 기계가 혼자 적지 않는다
   ⑥ 채울 것이 없으면 들어가는 문도 안 그린다
   ⑦ 저장은 이미 있는 길(bulkPatchFlush) 하나로 — 새 저장 길을 만들지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

const norm = (s) => String(s || '').toLowerCase()
  .replace(/㈜|\(주\)|주식회사/g, '').replace(/[\s\-_.,·()[\]{}'"]/g, '');

function box(o) {
  o = o || {};
  const flushed = [];
  const ctx = {
    Object, String, Number, Array, JSON, Math, RegExp, document: null,
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    state: { items: o.items || {}, coFillPick: null, coFillOpen: false },
    ErpMatch: {
      byId: o.byId || {}, byBiz: o.byBiz || {}, byName: o.byName || {}, nameN: o.nameN || {},
      _digits: (s) => String(s || '').replace(/[^0-9]/g, ''), _norm: norm,
    },
    mbWhoOfRow: (v) => String((o.mailWho || {})[String(v && v.e)] || ''),
    mbStaffOf: (n) => ((o.staff || ['권형하', '박한별']).indexOf(n) >= 0 ? { sid: 'P' } : null),
    mbRetired: (w) => !!(o.retired || {})[w],
    mbSuccOf: (w) => (o.succ || {})[w] || '',
    toast: (s) => { ctx._toasts = (ctx._toasts || []).concat(String(s)); },
    confirm: () => (o.deny ? false : true),
    render() { ctx._drew = (ctx._drew || 0) + 1; },
    bulkPatchFlush: (hit, fields) => { flushed.push({ hit: hit.slice(), fields: fields.slice() });
      return o.failWrite ? Promise.reject(new Error('막힘')) : Promise.resolve(); },
  };
  ctx.cardOwnMount = () => { ctx._mounted = (ctx._mounted || 0) + 1; };
  vm.createContext(ctx);
  ['cardOwnLive', 'cardOwnGuess', 'cardOwnBust', 'cardOwnPlan', 'cardOwnPicked',
    'cardOwnOpen', 'cardOwnClose', 'cardOwnToggle', 'cardOwnHtml', 'cardOwnApply']
    .forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  vm.runInContext('var _cardOwnPlan = null;', ctx);
  const m = app.match(/const CARDOWN_WHY = \[[\s\S]*?\n\];/);
  assert.ok(m, 'CARDOWN_WHY 를 앱에서 찾지 못했습니다');
  vm.runInContext('var ' + m[0].slice('const '.length), ctx);
  return { ctx, flushed };
}

const CO = (main, left) => ({ main: main, left: !!left, company: '가나상사' });
const CARD = (o) => Object.assign({ id: 'c1', kind: 'card' }, o);

/* ══ ① 차례 ══ */
test('★★★ 업체 번호가 가장 세다 — 메일·올린 사람·이름보다 앞', () => {
  const b = box({
    byBiz: { '1234567890': CO('권형하') },
    mailWho: { 'a@x.kr': '박한별' },
    staff: ['권형하', '박한별'],
    byName: { [norm('다른회사')]: CO('박한별') },
  });
  const g = b.ctx.cardOwnGuess(CARD({ bizno: '123-45-67890', email: 'a@x.kr',
    capturedBy: '박한별', company: '다른회사' }));
  assert.equal(g.who, '권형하');
  assert.equal(g.why, 'biz');
});

test('★★★ 업체 열쇠(erpCoId)도 번호와 같다', () => {
  const b = box({ byId: { 'co-9': CO('권형하') } });
  const g = b.ctx.cardOwnGuess(CARD({ erpCoId: 'co-9' }));
  assert.equal(g.who + '/' + g.why, '권형하/biz');
});

test('★★★ 번호가 없으면 메일 담당 — 올린 사람보다 앞', () => {
  const b = box({ mailWho: { 'a@x.kr': '권형하' } });
  const g = b.ctx.cardOwnGuess(CARD({ email: 'a@x.kr', capturedBy: '박한별' }));
  assert.equal(g.who + '/' + g.why, '권형하/mail');
});

test('★★★ 둘 다 없으면 올린 사람 — 회사 이름보다 앞', () => {
  const b = box({ byName: { [norm('가나상사')]: CO('권형하') }, nameN: { [norm('가나상사')]: 1 } });
  const g = b.ctx.cardOwnGuess(CARD({ capturedBy: '박한별', company: '가나상사' }));
  assert.equal(g.who + '/' + g.why, '박한별/cap');
});

test('★★ 아무것도 없으면 회사 이름', () => {
  const b = box({ byName: { [norm('가나상사')]: CO('권형하') }, nameN: { [norm('가나상사')]: 1 } });
  const g = b.ctx.cardOwnGuess(CARD({ company: '가나상사' }));
  assert.equal(g.who + '/' + g.why, '권형하/name');
});

test('★★ 아무 근거도 없으면 안 짚는다', () => {
  assert.equal(box({}).ctx.cardOwnGuess(CARD({ company: '모르는회사' })), null);
});

/* ══ ② 이미 적힌 것 ══ */
test('★★★ 이미 적힌 담당자는 덮지 않는다', () => {
  const b = box({ byBiz: { '1234567890': CO('권형하') } });
  assert.equal(b.ctx.cardOwnGuess(CARD({ bizno: '1234567890', owner: '박한별' })), null);
});

/* ══ ③ 끝난 업체·퇴사자 ══ */
test('★★★ 끝난 업체의 담당은 안 넣는다 — 세 길 모두', () => {
  const b = box({ byBiz: { '1234567890': CO('권형하', true) }, byId: { 'co-9': CO('권형하', true) },
    byName: { [norm('가나상사')]: CO('권형하', true) }, nameN: { [norm('가나상사')]: 1 } });
  assert.equal(b.ctx.cardOwnGuess(CARD({ bizno: '1234567890' })), null);
  assert.equal(b.ctx.cardOwnGuess(CARD({ erpCoId: 'co-9' })), null);
  assert.equal(b.ctx.cardOwnGuess(CARD({ company: '가나상사' })), null);
});

test('★★★ 퇴사자로 짚이면 이어받은 사람 — 없으면 안 채운다', () => {
  const on = box({ byBiz: { '1234567890': CO('라마바') }, retired: { '라마바': 1 },
    succ: { '라마바': '권형하' } });
  assert.equal(on.ctx.cardOwnGuess(CARD({ bizno: '1234567890' })).who, '권형하');
  const off = box({ byBiz: { '1234567890': CO('라마바') }, retired: { '라마바': 1 } });
  assert.equal(off.ctx.cardOwnGuess(CARD({ bizno: '1234567890' })), null);
});

/* ══ ④ 겹치는 이름 ══ */
test('★★★ 이름이 겹치는 업체는 «아예» 안 짚는다 — 남의 회사 담당이 붙는다', () => {
  const b = box({ byName: { [norm('가나상사')]: CO('권형하') }, nameN: { [norm('가나상사')]: 2 } });
  assert.equal(b.ctx.cardOwnGuess(CARD({ company: '가나상사' })), null);
});

test('★★ 올린 사람이 명부에 없으면 안 쓴다 — 바깥 사람 이름이 담당자가 되면 안 된다', () => {
  const b = box({ staff: ['권형하'] });
  assert.equal(b.ctx.cardOwnGuess(CARD({ capturedBy: '모르는이' })), null);
  assert.equal(b.ctx.cardOwnGuess(CARD({ capturedBy: '권형하' })).why, 'cap');
});

/* ══ 묶음 ══ */
function plan3(deny) {
  return box({
    deny: deny,
    byBiz: { '1234567890': CO('권형하') },
    mailWho: { 'm@x.kr': '박한별' },
    byName: { [norm('가나상사')]: CO('권형하') }, nameN: { [norm('가나상사')]: 1 },
    items: {
      a: CARD({ id: 'a', bizno: '1234567890' }),
      b: CARD({ id: 'b', email: 'm@x.kr' }),
      c: CARD({ id: 'c', capturedBy: '박한별' }),
      d: CARD({ id: 'd', company: '가나상사' }),
      e: CARD({ id: 'e', company: '모르는회사' }),
      f: CARD({ id: 'f', bizno: '1234567890', owner: '김혜민' }),
    },
  });
}

test('★★★ 묶음마다 제대로 센다 · 이미 적힌 것과 근거 없는 것은 따로', () => {
  const b = plan3();
  const p = b.ctx.cardOwnPlan();
  assert.equal(p.all, 6);
  assert.equal(p.already, 1);
  assert.equal(p.none, 1);
  assert.equal(p.by.biz.n + '/' + p.by.mail.n + '/' + p.by.cap.n + '/' + p.by.name.n, '1/1/1/1');
});

test('★★★ 얇은 근거(회사 이름)는 «미리 꺼 둔다»', () => {
  const b = plan3();
  b.ctx.cardOwnOpen();
  assert.equal(b.ctx.state.coFillPick.name, false, '회사 이름은 꺼져 있어야 한다');
  ['biz', 'mail', 'cap'].forEach((k) => assert.equal(b.ctx.state.coFillPick[k], true, k));
  assert.equal(b.ctx.cardOwnPicked().ids.length, 3, '켜진 묶음만 셈한다');
});

test('★★ 켜면 늘고 끄면 준다', () => {
  const b = plan3();
  b.ctx.cardOwnOpen();
  b.ctx.cardOwnToggle('name');
  assert.equal(b.ctx.cardOwnPicked().ids.length, 4);
  b.ctx.cardOwnToggle('biz');
  assert.equal(b.ctx.cardOwnPicked().ids.length, 3);
});

/* ══ ⑦ 채우기 ══ */
test('★★★ 저장은 이미 있는 길 하나로, owner 칸만 — 다른 칸을 안 건드린다', async () => {
  const b = plan3();
  b.ctx.cardOwnOpen();
  b.ctx.cardOwnApply();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.flushed.length, 1, 'bulkPatchFlush 한 번');
  assert.equal(b.flushed[0].fields.join(','), 'owner');
  assert.equal(b.flushed[0].hit.length, 3);
  const got = b.flushed[0].hit.map((x) => x.id + ':' + x.owner).sort().join(' ');
  assert.equal(got, 'a:권형하 b:박한별 c:박한별');
});

test('★★★ 이미 적힌 명함은 채우기에도 안 든다', async () => {
  const b = plan3();
  b.ctx.cardOwnOpen();
  b.ctx.cardOwnApply();
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(!b.flushed[0].hit.some((x) => x.id === 'f'), '이미 김혜민이 적힌 f 는 빠져야 한다');
  assert.equal(b.ctx.state.items.f.owner, '김혜민', '그대로여야 한다');
});

test('★★★ 「아니오」 하면 한 장도 안 바꾼다', async () => {
  const b = plan3(true);   /* 「아니오」 */
  b.ctx.cardOwnOpen();
  b.ctx.cardOwnApply();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.flushed.length, 0);
  assert.equal(b.ctx.state.items.a.owner, undefined);
});

test('★★ 고른 묶음이 없으면 아무 일도 안 한다', async () => {
  const b = plan3();
  b.ctx.cardOwnOpen();
  ['biz', 'mail', 'cap'].forEach((k) => b.ctx.cardOwnToggle(k));
  b.ctx.cardOwnApply();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.flushed.length, 0);
  assert.ok((b.ctx._toasts || []).some((t) => /고른 묶음이 없습니다/.test(t)));
});

/* ══ 창 글 ══ */
test('★★ 창에 묶음 수·사람·고른 수가 적힌다', () => {
  const b = plan3();
  b.ctx.cardOwnOpen();
  const h = b.ctx.cardOwnHtml();
  assert.ok(/고른 3장 채우기/.test(h), h.slice(-300));
  assert.ok(/덮지 않습니다/.test(h), '덮지 않는다는 말이 보여야 한다');
  assert.ok(/미리 꺼 두었습니다/.test(h), '왜 꺼져 있는지 적어야 한다');
});

test('★★ 닫혀 있으면 아무것도 안 그린다', () => {
  const b = plan3();
  assert.equal(b.ctx.cardOwnHtml(), '');
});

/* ══ ⑥ 들어가는 문 ══ */
test('★★★ 채울 것이 없으면 문을 안 그린다 — 눌러도 아무 일 없는 단추는 두지 않는다', () => {
  /* ⚠ cardOwnOpen 은 함수 «선언»에도 나온다 — 옆줄에 그리는 자리(pchintside)만 본다. */
  const src = strip(app);
  /* 2026-10-05 「담당자별」 목록을 걷은 뒤로는 문을 그리는 자리(const ownPlan)부터 찾는다 */
  const door = src.indexOf('cardOwnOpen()', src.indexOf('const ownPlan'));
  assert.ok(door > 0, '옆줄에 문이 있어야 한다');
  const near = src.slice(Math.max(0, door - 400), door);
  assert.ok(/ownFill > 0\)/.test(near),
    '문이 「채울 것이 있나」에 걸려 있어야 한다: ' + near.slice(-160));
  assert.ok(/pchintside/.test(near), '옆줄 안내와 같은 모양이어야 한다');
});

test('★★★ 문이 옆줄 폴더 목록 «바로 아래»에 있다 — 따로 들어가는 화면이 아니다', () => {
  /* 2026-10-05 「담당자별 (직원)」 목록과 그 안내를 걷었다(대표 지시). 문은 폴더 목록 끝 바로 뒤에 남는다. */
  const src = strip(app);
  const list = src.indexOf('groups.forEach(g=> h += folderRow(g));');
  const door = src.indexOf('cardOwnOpen()', list);
  assert.ok(list > 0 && door > list, '폴더 목록 뒤에 문이 와야 한다');
  assert.ok(door - list < 1200, '따로 들어가야 하는 화면이면 아무도 안 간다');
});

test('★★★ 새 저장 길을 만들지 않는다 — 이알피에도 안 쓴다', () => {
  const src = strip(sliceFn(app, 'function cardOwnApply('));
  assert.ok(/bulkPatchFlush\(/.test(src));
  assert.ok(!/firebase\.database\(\)/.test(src), '저장은 이미 있는 길 하나로');
  assert.ok(!/data\//.test(src), '푸른이알피에는 한 글자도 안 쓴다');
});
