'use strict';
/* 기업정보함 점검 ①-2 — 자료를 잃거나 새는 작은 구멍들 (2026-10-07)
   「기업정보함 지금까지 만든것 자동화 하거나 수정 검토할 부분 있는지 확인해라」 → 「① 자료 지키기」

   ① 폴더를 잠그면 다른 PC 에 «지운 자국»이 남는다 — 안 남기면 잠근 명함이 남의 화면에 사흘 보였다
     · 풀 때는 고친 시각을 새로 찍는다 — 안 찍으면 걷어 낸 PC 에 다시 안 온다
   ② 자동 폴더 정리는 명함이 «다 들어온 뒤»에만 — 반쯤 들어온 때 돌면 든 폴더를 비었다고 지운다
   ③ 빈 명함·깨진 글자·중복 정리가 «남의 잠긴 폴더» 명함을 건드리지 않는다
   ④ 여러 장 지우기는 «된 것·안 된 것»을 센다 — 실패해도 「N건 지웠습니다」가 뜨던 것
   ⑤ 공용 탭·폴더 «한 번만 심기» 표시를 서버에 둔다 — 새 PC 가 지운 탭을 다시 만들던 것
   ⚠ 예시는 가짜다(홍길동). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* ══════ ① 잠금·풀기 ══════ */
test('★★ 폴더를 풀면 명함의 고친 시각을 새로 찍는다 — 잠글 때 걷어 낸 PC 에 다시 실려 가게', () => {
  const un = strip(sliceFn(SRC, 'async function unsetFolderLock('));
  assert.match(un, /const body = \{\.\.\.it\};[^\n]*\n\s*body\.updatedAt = Date\.now\(\);/,
    '★★ 풀 때 시각을 안 찍으면, 잠글 때 «지운 자국»을 본 PC 에는 사흘 동안 다시 안 나타납니다');
});

/* ══════ ② 자동 폴더 정리 ══════ */
test('★★ 자동 폴더 정리는 명함이 다 들어오기 전에는 안 돈다 — 그리고 다 들어오면 한 번 돈다', () => {
  const at = SRC.indexOf('  autoFolder(){');
  const body = strip(SRC.slice(at, SRC.indexOf('Store.delGroup', at)));
  assert.match(body, /if\(Store\.mode === 'firebase' && !Store\._itemsReady\) return;/,
    '★★ 명함이 반쯤 들어온 때 돌면 든 폴더를 «비었다»고 지울 수 있습니다');
  const ready = SRC.slice(SRC.indexOf('Store._itemsReady=true;'), SRC.indexOf('Store._itemsReady=true;') + 600);
  assert.match(ready, /ErpMatch\.autoFolder\(\)/, '★ 다 들어온 뒤에 한 번 부르지 않으면 이 세션에는 영영 안 돕니다');
});

/* ══════ ③ 남의 잠긴 폴더 ══════ */
test('★★★ 빈 명함·깨진 글자·중복 정리가 «남의 잠긴 폴더» 명함을 건드리지 않는다', () => {
  const ctx = { console, Object, String,
    state: { tab: 'card', items: {
      a: { id: 'a', kind: 'card', group: 'g1' },                 /* 남의 잠긴 폴더 · 빈 명함 */
      b: { id: 'b', kind: 'card' },                              /* 빈 명함 */
      c: { id: 'c', kind: 'card', group: 'g1', name: 'Ã¬â€' } },
      groups: { g1: { locked: true, lockOwner: 'other@pureun.kr' } } },
    canSeeGroup: (g) => !g.locked, itemMojibake: (it) => /Ã/.test(it.name || '') };
  vm.createContext(ctx);
  ['function inHiddenLocked(', 'function emptyTargets(', 'function mojibakeTargets(', 'function dupPool(']
    .forEach((h) => vm.runInContext(sliceFn(SRC, h), ctx));
  assert.deepEqual(Array.from(ctx.emptyTargets(), (x) => x.id), ['b'], '★★★ 빈 명함 정리가 남의 잠긴 폴더 명함을 지웁니다');
  assert.equal(ctx.mojibakeTargets().length, 0, '★★★ 깨진 글자 정리가 남의 잠긴 폴더 명함을 지웁니다');
  assert.ok(!ctx.dupPool().some((x) => x.group === 'g1'), '★★★ 중복 합치기가 남의 잠긴 폴더 명함을 합칩니다');
  const clean = strip(sliceFn(SRC, 'async function cleanEmpty('));
  assert.match(clean, /emptyTargets\(\)/, '★ 빈 명함 정리가 따로 센다 — 한쪽만 잠긴 폴더를 뺀다');
});

/* ══════ ④ 여러 장 지우기 ══════ */
test('★★ 여러 장 지우기는 «된 것·안 된 것»을 센다', async () => {
  const ctx = { console, Promise, String,
    Store: { del: (id) => (id === 'x2' ? Promise.reject(new Error('권한 없음')) : Promise.resolve()) } };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(SRC, 'async function delMany('), ctx);
  const r = await ctx.delMany(['x1', 'x2', 'x3']);
  assert.equal(r.ok, 2); assert.equal(r.fail, 1); assert.match(r.why, /권한 없음/);
  for (const h of ['async function delSel(', 'async function cleanEmpty(']) {
    const b = strip(sliceFn(SRC, h));
    assert.match(b, /await delMany\(/, '★★ ' + h + ' 가 결과를 안 보고 「지웠습니다」라고 합니다');
    assert.match(b, /r\.fail/, '★ ' + h + ' 가 실패를 안 알립니다');
  }
  const one = strip(sliceFn(SRC, 'function delItem('));
  assert.match(one, /Store\.del\(id\)\.then\(/, '★ 한 장 지우기가 실패해도 「삭제되었습니다」라고 합니다');
});

test('★★ 한 장 지우기는 목록 지우기와 «지운 자국»을 한 통으로 보내고 기다린다', () => {
  const at = SRC.indexOf('async del(id){');
  const b = strip(SRC.slice(at, SRC.indexOf('/* 영구 삭제', at)));
  assert.match(b, /up\[`\$\{R\}\/items\/\$\{id\}`\] = null;[\s\S]*up\[`\$\{DB_ROOT\}\$\{TOMB\}\/\$\{id\}`\][\s\S]*await this\.db\.ref\(\)\.update\(up\)/,
    '★★ 따로 보내면 지우기만 되고 자국이 빠져 다른 PC 에 «유령»이 남습니다');
  assert.ok(!/items\/\$\{id\}`\)\.remove\(\)/.test(b), '목록 지우기를 따로(기다리지 않고) 보냅니다');
});

/* ══════ ⑤ «한 번만 심기» 표시 ══════ */
function seedBox(local, server) {
  const writes = [];
  let reads = 0;
  const ls = Object.assign({}, local);
  const ctx = { console,
    localStorage: { getItem: (k) => ls[k] || null, setItem: (k, v) => { ls[k] = v; } },
    DB_ROOT: 'pucards',
    Store: { mode: 'firebase', db: { ref: (p) => ({
      once: () => { reads++; return Promise.resolve({ val: () => server }); },
      set: (v) => { writes.push(p); return Promise.resolve(); } }) } } };
  vm.createContext(ctx);
  vm.runInContext('var _seeded = null, _seededAsk = false;\n'
    + ['function seedFlagsLoad(', 'function seedDone(', 'function seedMark('].map((h) => sliceFn(SRC, h)).join('\n'), ctx);
  return { ctx, writes, ls, reads: () => reads };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('★★★ 서버 표시를 아직 모르면 «심지 않는다» — 모르면 안 만든다', async () => {
  const b = seedBox({}, null);
  assert.equal(b.ctx.seedDone('pucards_erptabs_v1'), true, '★★★ 모르는데 심으면 지운 탭이 새 PC 에서 되살아납니다');
  assert.equal(b.reads(), 1, '서버 표시를 읽으러 가야 합니다');
  await tick();
  assert.equal(b.ctx.seedDone('pucards_erptabs_v1'), false, '서버에도 표시가 없으면 그때 심습니다');
});

test('★★★ 서버에 «심었음»이 있으면 새 PC 도 안 심는다', async () => {
  const b = seedBox({}, { pucards_erptabs_v1: 1 });
  b.ctx.seedFlagsLoad(); await tick();
  assert.equal(b.ctx.seedDone('pucards_erptabs_v1'), true, '★★★ 새 PC 가 대표님이 지운 공용 탭을 다시 만듭니다');
});

test('★★ 옛 브라우저 표시는 서버로 옮겨 적고, 심으면 서버에 적는다', async () => {
  const b = seedBox({ pucards_rules_v1: '1' }, {});
  b.ctx.seedFlagsLoad(); await tick();
  assert.equal(b.ctx.seedDone('pucards_rules_v1'), true);
  assert.ok(b.writes.includes('pucards/config/seeded/pucards_rules_v1'), '★★ 옛 표시를 서버에 안 옮기면 다른 PC 가 다시 심습니다');
  b.ctx.seedMark('pucards_proftabs_v1');
  assert.ok(b.writes.includes('pucards/config/seeded/pucards_proftabs_v1'), '★★ 심은 뒤 서버에 안 적습니다');
});

test('★ 다섯 씨앗 모두 서버 표시를 본다 — 브라우저에만 적는 씨앗이 없다', () => {
  ['pucards_erptabs_v1', 'pucards_closedtab_v1', 'pucards_bizfolders_v1', 'pucards_rules_v1', 'pucards_proftabs_v1']
    .forEach((k) => {
      assert.match(SRC, new RegExp("seedDone\\('" + k + "'\\)"), k + ' 가 서버 표시를 안 봅니다');
      assert.match(SRC, new RegExp("seedMark\\('" + k + "'\\)"), k + ' 가 서버에 안 적습니다');
      assert.doesNotMatch(strip(SRC), new RegExp("localStorage\\.(get|set)Item\\('" + k + "'"), k + ' 를 아직 브라우저에서 직접 봅니다');
    });
});
