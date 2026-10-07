/* ══════ 🧹 똑같은 명함 저절로 합치기 (대표 결정 2026-10-07 기업정보함 점검 4절) ══════
   ★ 못 박는 것
     ㉠ 「중복 아님」은 «서버»에 있다 — 다른 PC 에서 돈 저절로 합치기가 사람이 가른 짝을 합치면 안 된다.
        옛 PC 표시는 지우지 않고, 처음 읽을 때 서버로 올린다.
     ㉡ 서버 목록을 못 읽었으면·명함이 다 안 들어왔으면 «안 돈다» — 모르면 안 합친다.
     ㉢ 잣대가 단추(⚡ 똑같은 N묶음)보다 «좁다» — 폴더·둘째 연락처·이알피 연결이 달라도 안 합친다.
     ㉣ 하루 한 번 «한 PC» 만 — 차지 못 하면 안 돈다. 한 일은 남기고 알린다.
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
const line = (re) => { const m = SRC.match(re); assert.ok(m, '못 찾음: ' + re); return m[0]; };

function box(o) {
  o = o || {};
  const ls = { pucards_dup_ignore: JSON.stringify(o.local || []) };
  const writes = [];
  const ctx = {
    console: { log() {}, warn() {} }, writes, Date,
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = v; } },
    DB_ROOT: 'pucards', myEmail: 'staff@purun.example',
    state: { items: o.items || {} },
    CARD_FIELDS: [['name'], ['company'], ['mobile'], ['email'], ['memo'], ['owner']], BIZ_FIELDS: [['company'], ['bizno']],
    inHiddenLocked: (it) => !!it.hidden,
    render() { ctx.rendered = (ctx.rendered || 0) + 1; }, toast(t) { ctx.toasted = t; },
    merged: [],
    Store: { mode: 'firebase', _itemsReady: o.ready !== false, db: { ref: (p) => ({
      once: async () => ({ val: () => (o.server === undefined ? null : o.server) }),
      update: async (u) => { writes.push({ p, u }); }, set: async (v) => { writes.push({ p, v }); },
      remove: async () => { writes.push({ p, removed: true }); },
      transaction: async (f) => { const v = f(o.claimed ? Date.now() : 0); return { committed: v !== undefined }; },
    }) } },
  };
  vm.createContext(ctx);
  vm.runInContext([
    "const DUP_IGNORE_LS = 'pucards_dup_ignore';",
    line(/const DUP_NORM = [^\n]*/), line(/const DUP_AUTO_EVERY = [^\n]*/), line(/const DUP_AUTO_MAX = [^\n]*/),
    line(/const DUP_AUTO_SAME = [^\n]*/), 'let _dupIgnSrv = null, _dupIgnAsk = false; let _dupAutoBusy = false;',
    fn('function dupIgnoreKey('), fn('function dupIgnoreLocal('), fn('function dupIgnoreLoad('), fn('function dupIgnoreSet('),
    fn('function dupIgnoreSave('), fn('function dupIgnoreAdd('), fn('function dupUnignore('), fn('function dupAllSame('),
    fn('function dupAutoSafe('), fn('function dupAutoClaim('), fn('async function dupAutoRun('),
    'function openDupIgnored(){}',
    /* 묶기는 다른 검사(cards-dup-fix 등)가 지킨다 — 여기서는 «넘겨받은 묶음» 뒤의 일만 본다 */
    'function dupAutoGroups(){ return (globalThis.groups || []).filter(dupAutoSafe); }',
    'async function mergeGroup(ids){ merged.push(ids); }',
  ].join('\n'), ctx);
  return ctx;
}
const 명함 = (id, o) => Object.assign({ id, kind: 'card', name: '홍길동', company: '가나상사', mobile: '010-1234-5678', email: 'hong@ganasangsa.example', memo: '', owner: '' }, o || {});

test('★★★ 「중복 아님」은 서버에 적는다 — 이 PC 에만 두면 다른 PC 의 저절로 합치기가 모른다', async () => {
  const c = box({ server: {} });
  vm.runInContext('dupIgnoreLoad()', c); await new Promise((r) => setTimeout(r, 0));
  vm.runInContext("dupIgnoreAdd(['i3','i1','i2'])", c);
  const up = c.writes.filter((w) => w.p === 'pucards/config/dupIgnore' && w.u).pop();
  assert.ok(up, '★★★ 서버에 안 적는다');
  assert.deepEqual(Object.keys(up.u).sort(), ['i1~i2', 'i1~i3', 'i2~i3'], '묶음 안의 «모든 짝»을 적어야 셋 이상이 풀린다');
  vm.runInContext("dupUnignore('i1~i2')", c);
  assert.ok(c.writes.some((w) => w.p === 'pucards/config/dupIgnore/i1~i2' && w.removed), '★ 되돌리기도 서버에서 지워야 한다');
});

test('★★ 옛 PC 표시는 지우지 않고 «서버로 올린다» — 지우면 사람이 가른 짝이 사라진다', async () => {
  const c = box({ local: ['a~b'], server: { 'c~d': 1 } });
  vm.runInContext('dupIgnoreLoad()', c); await new Promise((r) => setTimeout(r, 0));
  const up = c.writes.find((w) => w.p === 'pucards/config/dupIgnore' && w.u);
  assert.ok(up && up.u['a~b'] === 1 && !('c~d' in up.u), '서버에 없는 옛 표시만 올린다');
  const s = vm.runInContext('[...dupIgnoreSet()].sort().join(",")', c);
  assert.equal(s, 'a~b,c~d', '★★ 둘을 합쳐서 본다');
});

test('★★★ 서버 목록을 못 읽었으면·명함이 다 안 들어왔으면 «안 돈다» — 모르면 안 합친다', async () => {
  const g = [명함('i1'), 명함('i2')];
  let c = box({ ready: false, server: {} }); c.groups = [g];
  vm.runInContext('_dupIgnSrv = {}', c);
  await vm.runInContext('dupAutoRun()', c);
  assert.equal(c.merged.length, 0, '★★★ 씨앗만 있는데 합쳤다');
  c = box({ server: {} }); c.groups = [g];
  await vm.runInContext('dupAutoRun()', c);
  assert.equal(c.merged.length, 0, '★★★ 「중복 아님」을 모르는데 합쳤다');
});

test('★★ 잣대가 단추보다 «좁다» — 폴더·둘째 연락처·이알피 연결이 다르면 안 합친다', async () => {
  const 경우 = [['폴더', { group: 'g2' }], ['둘째 연락처', { mobileMore: '010-9999-0000' }], ['이알피 연결', { erpCoId: 'co-9' }], ['메모', { memo: '다른 메모' }]];
  for (const [이름, 다름] of 경우) {
    const c = box({ server: {} }); c.groups = [[명함('i1'), 명함('i2', 다름)]];
    vm.runInContext('_dupIgnSrv = {}', c);
    await vm.runInContext('dupAutoRun()', c);
    assert.equal(c.merged.length, 0, '★★ ' + 이름 + ' 이 다른데 합쳤다 — 합치면 한쪽 것이 사라진다');
  }
});

test('★★ 칸이 하나도 안 다르면 합치고, 한 일을 «남기고 알린다»', async () => {
  const c = box({ server: {}, items: { i1: 1, i2: 1 } }); c.groups = [[명함('i1'), 명함('i2', { mobile: '01012345678' })]];
  vm.runInContext('_dupIgnSrv = {}', c);
  await vm.runInContext('dupAutoRun()', c);
  assert.equal(c.merged.length, 1, '붙임표만 다른 것은 같은 값이다(DUP_NORM)');
  const log = c.writes.find((w) => w.p === 'pucards/config/dupAutoLast');
  assert.ok(log && log.v.groups === 1 && log.v.cards === 1, '★★ 한 일을 남겨야 「명함이 사라졌다」를 풀 수 있다');
  assert.match(String(c.toasted), /휴지통/, '★ 되살릴 길을 말해 준다');
});

test('★★ 하루 한 번 «한 PC» 만 — 오늘 이미 누가 했으면 안 돈다', async () => {
  const c = box({ server: {}, claimed: true, items: { i1: 1, i2: 1 } }); c.groups = [[명함('i1'), 명함('i2')]];
  vm.runInContext('_dupIgnSrv = {}', c);
  await vm.runInContext('dupAutoRun()', c);
  assert.equal(c.merged.length, 0);
});

test('★ 남의 잠긴 폴더 명함은 안 본다 · 명함이 다 들어온 «뒤»에 부른다', () => {
  const g = fn('function dupAutoGroups(');
  assert.match(g, /!inHiddenLocked\(it\)/);
  assert.match(g, /dupIgnoreSet\(\)/, '「중복 아님」을 봐야 한다');
  assert.match(g, /\.filter\(dupSameName\)\.filter\(dupAutoSafe\)/);
  const ready = SRC.slice(SRC.indexOf('Store._itemsReady=true;'), SRC.indexOf('Store._itemsReady=true;') + 2500);
  assert.match(ready, /setTimeout\(dupAutoRun, \d+\)/, '★ 명함이 다 들어온 뒤에 부르지 않으면 반쪽 목록으로 센다');
});
