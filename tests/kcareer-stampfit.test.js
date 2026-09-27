'use strict';
/* 🖋 도장 «크기·자리»를 기억한다 (대표 제보 2026-09-27 「도장과 위치등이 제대로 저장이 안된다」)
   ─────────────────────────────────────────────────────────────
   여태 크기(3400 HWPUNIT)와 위아래(-700)가 «코드에 박혀» 있었다. 그래서 한글에서
   도장을 옮겨 놓아도 다음에 찍으면 또 같은 자리였다 — 서식마다 (인) 칸 크기가 달라
   늘 어긋난다. 이제 도장마다 따로 적어 두고 다음부터 그 값으로 찍는다.

   못 박는 것:
     ① 한 번도 안 고쳤으면 «여태 쓰던 값» 그대로 (오늘 되던 것이 뒷걸음질하면 안 된다)
     ② 고친 값이 기록에 «남는다» (클라우드로 함께 오간다)
     ③ 종이를 벗어나지 않게 테두리를 둔다
     ④ 찍는 쪽이 그 값을 «쓴다» — 숫자를 다시 박아 두면 안 된다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const CODE = stripComments(fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8'));

function cutFn(src, decl) {
  const head = src.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = src.indexOf('{', head + decl.length), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) break; }
  }
  return src.slice(head, i + 1);
}

function 세상(stamps) {
  const store = { stamps: (stamps || []).slice() };
  const 알림 = [];
  const ctx = {
    console, Number, String, Object, Math, isFinite, Boolean,
    get: (k) => (store[k] || []).slice(),
    set: (k, a) => { store[k] = a.slice(); },
    toast: (m) => { 알림.push(String(m)); },
    renderStamps: () => {},
    _store: store, _알림: 알림
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const 기본줄 = CODE.match(/var STAMP_FIT_DEF = \{[^}]*\};/);
  assert.ok(기본줄, 'STAMP_FIT_DEF 를 찾지 못했습니다');
  vm.runInContext(기본줄[0], ctx);
  ['function stampFit(', 'function stampFitNudge(', 'function stampFitReset(',
   'function _stampMm(']
    .forEach((d) => vm.runInContext(cutFn(CODE, d), ctx));
  return ctx;
}

test('★★ 한 번도 안 고쳤으면 «여태 쓰던 값» 그대로 — 뒷걸음질하면 안 된다', () => {
  const ctx = 세상([{ id: 'A', def: true }]);
  const f = vm.runInContext('stampFit({id:"A"})', ctx);
  assert.equal(f.size, 3400, '★ 크기 기본값이 달라졌습니다');
  assert.equal(f.dy, -700, '★ 위아래 기본값이 달라졌습니다');
  assert.equal(f.dx, 0);
});

test('★★★ 고친 값이 «기록에 남는다» — 이것이 「저장이 안 된다」의 고침이다', () => {
  const ctx = 세상([{ id: 'A', def: true }]);
  vm.runInContext('stampFitNudge("A","size",2)', ctx);
  vm.runInContext('stampFitNudge("A","dy",-1)', ctx);
  const s = ctx._store.stamps[0];
  assert.ok(s.fit, '★ 고친 값이 안 남았습니다 — 다음에 또 같은 자리에 찍힙니다');
  assert.equal(s.fit.size, 3400 + 720, '★ 크기가 안 바뀌었습니다');
  assert.equal(s.fit.dy, -700 - 360, '★ 자리가 안 바뀌었습니다');
  /* 다시 읽어도 그 값이어야 한다 */
  const f = vm.runInContext('stampFit(get("stamps")[0])', ctx);
  assert.equal(f.size, 4120);
  assert.equal(f.dy, -1060);
});

test('★ 한 칸은 1mm — 사람이 아는 단위로 보여 준다', () => {
  const ctx = 세상([{ id: 'A' }]);
  assert.equal(vm.runInContext('_stampMm(3600)', ctx), 10);
  assert.equal(vm.runInContext('_stampMm(3400)', ctx), 9.4);
});

test('★★ 종이를 벗어나지 않게 테두리를 둔다 — 밖으로 나가면 안 보인다', () => {
  const ctx = 세상([{ id: 'A' }]);
  for (let i = 0; i < 80; i++) vm.runInContext('stampFitNudge("A","size",-1)', ctx);
  assert.equal(ctx._store.stamps[0].fit.size, 1800, '★ 크기가 5mm 아래로 내려갔습니다');
  for (let i = 0; i < 200; i++) vm.runInContext('stampFitNudge("A","size",1)', ctx);
  assert.equal(ctx._store.stamps[0].fit.size, 14400, '★ 크기가 40mm 위로 올라갔습니다');
  for (let i = 0; i < 100; i++) vm.runInContext('stampFitNudge("A","dx",1)', ctx);
  assert.equal(ctx._store.stamps[0].fit.dx, 7200, '★ 좌우가 종이를 벗어납니다');
});

test('★ ↩ 처음대로 — 고친 값을 지운다', () => {
  const ctx = 세상([{ id: 'A' }]);
  vm.runInContext('stampFitNudge("A","size",3); stampFitReset("A")', ctx);
  const f = vm.runInContext('stampFit(get("stamps")[0])', ctx);
  assert.equal(f.size, 3400, '★ 처음대로 안 돌아갑니다');
  assert.match(ctx._알림.join(' '), /처음대로/, '무엇을 했는지 안 말합니다');
});

test('★ 없는 도장을 고치라고 하면 «말하고» 아무것도 안 바꾼다', () => {
  const ctx = 세상([{ id: 'A' }]);
  vm.runInContext('stampFitNudge("없는것","size",1)', ctx);
  assert.ok(!ctx._store.stamps[0].fit, '★ 엉뚱한 도장을 고쳤습니다');
  assert.match(ctx._알림.join(' '), /찾을 수 없습니다/);
});

test('★ 망가진 값이 들어 있어도 기본값으로 버틴다', () => {
  const ctx = 세상([{ id: 'A', fit: { size: 'abc', dx: null, dy: undefined } }]);
  const f = vm.runInContext('stampFit(get("stamps")[0])', ctx);
  assert.deepEqual([f.size, f.dx, f.dy], [3400, 0, -700], '★ 망가진 값에 끌려갑니다');
});

/* ══════ 찍는 쪽이 그 값을 쓰는가 ══════ */
test('★★★ 찍는 쪽이 «적어 둔 값»을 쓴다 — 숫자를 다시 박아 두면 안 된다', () => {
  /* ⚠ 2026-09-27 실제로 찍는 일은 rhStampZip 이 한다(짓는 길이 매번 찍는다 — 굽지 않는다).
     규칙은 그대로, 겨누는 자리만 옮겼다. */
  const st = cutFn(CODE, 'async function rhStampZip(');
  assert.match(st, /stampFit\(st\)/, '★ 적어 둔 크기·자리를 안 읽습니다');
  assert.match(st, /showHU:맞춤\.size/, '★ 크기를 안 씁니다');
  assert.match(st, /offX:맞춤\.dx/, '★ 좌우를 안 씁니다');
  assert.match(st, /offY:맞춤\.dy/, '★ 위아래를 안 씁니다');
  assert.ok(!/showHU:3400/.test(st), '★ 크기가 아직 코드에 박혀 있습니다');
  assert.ok(!/offY:-700/.test(st), '★ 자리가 아직 코드에 박혀 있습니다');
});
