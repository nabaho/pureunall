/* ══════ 🔗 이름으로만 맞은 명함 — 한 장씩 확인 (대표 결정 2026-10-07 점검 4절, 목업 승인 2026-10-09) ══════
   ★ 못 박는 것
     ㉠ 목록은 담당자 채우기의 「회사 이름」 묶음과 «같은 잣대»(cardOwnGuess 의 'name') — 남의 잠긴 폴더는 뺀다
     ㉡ 저절로 잇지 않는다 — 누른 명함만 열쇠(erpCoId)를 적고, 담당은 «비어 있을 때만» 채운다
     ㉢ 「아님」은 다시 짚지 않는다(cardOwnGuess 가 본다)
     ㉣ 되돌리기는 «우리가 넣은 값 그대로»일 때만 비운다
     ㉤ 기록을 못 읽었으면 아무것도 안 쓴다
   ⚠ 예시는 가짜다(홍길동·가나상사). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const fn = (h) => sliceFn(SRC, h);

function box(o) {
  o = o || {};
  const writes = [];
  const recs = {
    'co-1': { id: 'co-1', coName: '(주)가나상사', main: '이수민', left: false },
    'co-2': { id: 'co-2', coName: '다라물류', main: '정하늘', left: false },
  };
  const ctx = {
    console: { log() {}, warn() {} }, writes, Date, JSON, Object, String, Number,
    DB_ROOT: 'pucards', myEmail: 'staff@purun.example', NAMECHK_PAGE: 50,
    state: { items: o.items || {}, nameSel: {} },
    ErpMatch: { byName: { '가나상사': recs['co-1'] }, byId: recs, nameN: { '가나상사': 1 }, companies: [],
      _norm: (s) => String(s || '').replace(/\(주\)|\s/g, ''), _digits: (s) => String(s || '').replace(/\D/g, '') },
    inHiddenLocked: (it) => !!it.hidden,
    cardOwnLive: (w) => w || '', mbWhoOfRow: () => '', mbStaffOf: () => false,
    confirm: () => o.confirm !== false, toast() {}, render() {}, cardOwnBust() {}, cardOwnMount() {},
    cardErpPinCards: async (ids, coId) => { writes.push({ pin: ids.slice(), coId }); ids.forEach((id) => { if (coId) ctx.state.items[id].erpCoId = coId; else delete ctx.state.items[id].erpCoId; }); return ids.length; },
    bulkPatchFlush: async (list, keys) => { writes.push({ owner: list.map((x) => x.id), keys }); },
    Store: { mode: 'firebase', db: { ref: (p) => ({
      once: async () => ({ val: () => o.server || null }),
      update: async (u) => { writes.push({ p, u }); }, remove: async () => { writes.push({ p, removed: true }); },
    }) } },
  };
  vm.createContext(ctx);
  vm.runInContext(['let _nameChk = ' + (o.loaded === false ? 'null' : JSON.stringify(o.chk || {})) + ', _nameChkAsk = false;',
    fn('function cardOwnGuess('), fn('function nameChkRows('), fn('function nameChkDone('), fn('async function nameChkPin('),
    fn('async function nameChkOk('), fn('async function nameChkNo('), fn('async function nameChkUndo(')].join('\n'), ctx);
  return ctx;
}
const 명함 = (id, o) => Object.assign({ id, kind: 'card', name: '홍길동', company: '가나상사', owner: '' }, o || {});

test('★★★ 목록은 「회사 이름」 묶음과 같은 잣대 — 담당이 적힌 것·잠긴 폴더·다른 이름은 빠진다', () => {
  const c = box({ items: { a: 명함('a'), b: 명함('b', { owner: '김철수' }), h: 명함('h', { hidden: true }), x: 명함('x', { company: '마바상회' }) } });
  const ids = JSON.parse(JSON.stringify(vm.runInContext('nameChkRows().map(r=>r.id)', c)));
  assert.deepEqual(ids, ['a']);
});

test('★★★ 「맞음」은 누른 명함만 열쇠를 적고, 담당은 «비어 있을 때만» 채운다 — 업체관리는 안 고친다', async () => {
  const c = box({ items: { a: 명함('a'), b: 명함('b') } });
  await vm.runInContext("nameChkOk(['a'])", c);
  assert.equal(c.state.items.a.erpCoId, 'co-1');
  assert.equal(c.state.items.a.owner, '이수민');
  assert.equal(c.state.items.b.erpCoId, undefined, '★★★ 누르지 않은 명함까지 이었다');
  const log = c.writes.find((w) => w.p === 'pucards/config/nameCheck');
  assert.ok(log && log.u.a.v === 'ok' && log.u.a.owner === '이수민', '★★ 되돌리려면 넣은 담당을 남겨야 한다');
  assert.ok(!c.writes.some((w) => String(w.p || '').indexOf('data/companies') === 0), '★★★ 업체관리 기록을 고쳤다');
});

test('★★★ 「아님」은 다시 짚지 않는다 · 기록을 못 읽었으면 아무것도 안 쓴다', async () => {
  let c = box({ items: { a: 명함('a') } });
  await vm.runInContext("nameChkNo(['a'])", c);
  assert.equal(vm.runInContext('nameChkRows().length', c), 0, '★★★ 「아님」 명함이 다시 올라온다');
  assert.equal(vm.runInContext('cardOwnGuess(state.items.a)', c), null, '★★ 담당자 채우기도 이름으로 짚으면 안 된다');
  c = box({ items: { a: 명함('a') }, loaded: false });
  await vm.runInContext("nameChkOk(['a'])", c);
  assert.equal(c.writes.length, 0, '★★★ 기록을 모르는데 썼다');
});

test('★★ 되돌리기 — 우리가 넣은 값 그대로일 때만 비운다', async () => {
  const chk = { a: { v: 'ok', co: 'co-1', owner: '이수민', at: 1 }, b: { v: 'ok', co: 'co-1', owner: '이수민', at: 1 } };
  const c = box({ chk, items: { a: 명함('a', { erpCoId: 'co-1', owner: '이수민' }), b: 명함('b', { erpCoId: 'co-2', owner: '김철수' }) } });
  await vm.runInContext("nameChkUndo('a')", c);
  assert.equal(c.state.items.a.erpCoId, undefined);
  assert.equal(c.state.items.a.owner, '');
  await vm.runInContext("nameChkUndo('b')", c);
  assert.equal(c.state.items.b.erpCoId, 'co-2', '★★ 그 뒤 사람이 바꾼 업체를 지웠다');
  assert.equal(c.state.items.b.owner, '김철수', '★★ 그 뒤 사람이 바꾼 담당을 지웠다');
  assert.ok(c.writes.some((w) => w.p === 'pucards/config/nameCheck/b' && w.removed));
});

test('★ 담당자 채우기 창의 「회사 이름」 줄에서 들어간다 · 칸은 한 줄', () => {
  assert.match(fn('function cardOwnHtml('), /k === 'name'[\s\S]{0,80}nameChkOpen\(\)/);
  assert.match(fn('function cardOwnHtml('), /state\.coFillView === 'name'\) return nameChkHtml\(\)/);
  assert.match(SRC, /\.mck table\.nck td\{white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
  assert.match(fn('function nameChkHtml('), /type="checkbox"[\s\S]{0,200}\(i \+ 1\)/, '목록 맨 왼쪽은 ☐ + 번호');
});
