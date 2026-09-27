'use strict';
/* 「모든 해에서 찾기」 — 해를 가로질러 서류를 찾는다 (대표 결정 2026-09-12)
   실행: node --test tests/photos-all-years-find.test.js

   ■ 왜 만들었나
   대표 지시 「이런 정보로 푸른이알피에서 내용 찾을 수 있게 해달라」 → 뒤이어
   「서류찾기 별도로 둘 필요 없다」 → 고르신 답: **「사진첩에서만 — 대신 모든 해를 한번에」**

   사진첩 찾기는 본문(판독한 칸·표의 칸이름·값)까지 이미 훑는다. 막혀 있던 것은
   **늘 «고른 해» 안에서만 돌았다**는 것이다 — 2025년 서류를 2026년 화면에서 치면
   한 장도 안 나오고, 사람은 «없는 줄» 안다.

   ■ ★ 이 검사가 지키는 급소 — «해»는 화면의 것이 아니라 «사진의 것»이다
   해가 섞인 목록에서 화면의 해(gridYear)로 저장하면 `items/__all__` 이라는
   없는 자리에 적는다 — **사진이 조용히 사라진다.**
   2026-08-13 에 «받은 사진»에서 똑같은 뿌리로 「검은 화면만 뜬다」를 겪었다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripComments, stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');

/* ══════ ① 모든 해를 실제로 모아 오나 ══════════════════════════════════════ */

function 상자(o) {
  o = o || {};
  const 부른해 = [];
  const ctx = {
    console: { warn: function () { } },
    Object, Array, String, Number, Promise, Date, JSON,
    gridYears: o.years || ['2026', '2025'],
    gridOwner: o.owner || null,
    ALL_OWNERS: '__all_owners__',
    SHARED_OWNER: '__shared__',
    PuPhotoStore: {
      listYear: function (y) {
        부른해.push(y);
        if (o.막힌해 && o.막힌해 === y) return Promise.reject(new Error('권한 없음'));
        return Promise.resolve((o.자료 && o.자료[y]) || {});
      },
      listYearAll: function (y) { 부른해.push(y); return Promise.resolve((o.자료 && o.자료[y]) || {}); }
    },
    listMineAndShared: function (y) {
      부른해.push(y);
      if (o.막힌해 && o.막힌해 === y) return Promise.reject(new Error('권한 없음'));
      return Promise.resolve((o.자료 && o.자료[y]) || {});
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    APP.match(/^const ALL_YEARS = '[^']*';/m)[0].replace('const ', 'var '),
    cutFn(APP, 'function listAllYears(')
  ].join('\n'), ctx);
  return { ctx: ctx, 부른해: 부른해 };
}

test('★★★ 모든 해를 다 훑는다 — 한 해만 보면 옛 서류를 영영 못 찾는다', async () => {
  const s = 상자({ years: ['2026', '2025', '2019'],
    자료: { 2026: { a: { company: '가' } }, 2025: { b: { company: '나' } }, 2019: { c: {} } } });
  const out = await vm.runInContext('listAllYears()', s.ctx);
  assert.deepEqual(Array.from(s.부른해).sort(), ['2019', '2025', '2026']);
  assert.deepEqual(Object.keys(out).sort(), ['a', 'b', 'c'],
    '★★★ 해를 다 합치지 않으면 「모든 해」라는 이름이 거짓이 됩니다');
});

test('★★★ 사진마다 «제 해»를 새겨 준다 — 이것이 없으면 엉뚱한 해에 저장한다', async () => {
  const s = 상자({ years: ['2026', '2025'],
    자료: { 2026: { a: { company: '가' } }, 2025: { b: { company: '나' } } } });
  const out = await vm.runInContext('listAllYears()', s.ctx);
  assert.equal(out.a.__year, '2026');
  assert.equal(out.b.__year, '2025',
    '★★★ 해를 안 새기면 2025년 사진의 판독 결과가 2026년 자리에 적혀 사라집니다');
});

test('이미 해가 새겨져 있으면 «그대로 둔다» — 공유받은 사진은 주인의 해가 맞다', async () => {
  const s = 상자({ years: ['2026'], 자료: { 2026: { a: { __year: '2023' } } } });
  const out = await vm.runInContext('listAllYears()', s.ctx);
  assert.equal(out.a.__year, '2023', '★ 덮어쓰면 받은 사진이 다시 까맣게 나옵니다(2026-08-13 그 사고)');
});

test('★★ 한 해가 막혀도 나머지는 보여 준다 — 통째로 빈 화면이면 「사진이 없어졌다」가 된다', async () => {
  const s = 상자({ years: ['2026', '2025'], 막힌해: '2025',
    자료: { 2026: { a: {} } } });
  const out = await vm.runInContext('listAllYears()', s.ctx);
  assert.deepEqual(Object.keys(out), ['a'],
    '★★ 한 해가 막혔다고 통째로 던지면 사진첩이 빈 화면이 됩니다');
});

test('「모든 해」 자체를 해로 착각해 두드리지 않는다', async () => {
  const s = 상자({ years: ['__all__', '2026'], 자료: { 2026: { a: {} } } });
  await vm.runInContext('listAllYears()', s.ctx);
  assert.ok(Array.from(s.부른해).indexOf('__all__') < 0,
    '★ 「모든 해」를 해로 알고 `items/__all__` 을 두드립니다 — 없는 자리입니다');
});

/* ══════ ② 쓰기는 «사진의 해»로 ═══════════════════════════════════════════ */

function 해상자(y) {
  const ctx = { console, Object, Array, String, Number, Date,
    gridYear: y, gridItems: [{ id: 'p1', meta: { __year: '2023' } }, { id: 'p2', meta: {} }] };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    APP.match(/^const ALL_YEARS = '[^']*';/m)[0].replace('const ', 'var '),
    cutFn(APP, 'function photoYearOf('),
    cutFn(APP, 'function nowYear(')
  ].join('\n'), ctx);
  return ctx;
}

test('★★★ 「모든 해」를 저장 자리로 넘기지 않는다 — `items/__all__` 은 없는 자리다', () => {
  const c = 해상자('__all__');
  const 올해 = String(new Date().getFullYear());
  assert.equal(vm.runInContext('nowYear()', c), 올해,
    '★★★ 「모든 해」가 그대로 저장 층으로 가면 사진이 조용히 사라집니다');
  assert.equal(vm.runInContext('photoYearOf("p2")', c), 올해,
    '★★★ 해를 모르는 사진까지 __all__ 자리에 적힙니다');
});

test('★★ 사진에 새겨진 해가 «이긴다» — 화면이 무엇을 보든', () => {
  ['__all__', '2026', '2019'].forEach(function (y) {
    const c = 해상자(y);
    assert.equal(vm.runInContext('photoYearOf("p1")', c), '2023',
      '★★ 화면의 해(' + y + ')로 짐작하면 2023년 사진을 딴 해에 적습니다');
  });
});

test('예사 때(한 해를 고른 때)는 예전 그대로 화면의 해다', () => {
  const c = 해상자('2024');
  assert.equal(vm.runInContext('nowYear()', c), '2024');
  assert.equal(vm.runInContext('photoYearOf("p2")', c), '2024');
});

/* ══════ ③ 배선 — 「모든 해」가 실제로 걸려 있나 ═══════════════════════════ */

const 앱 = stripComments(APP);

test('★★ 해 고르개에 「모든 해」가 «맨 위»에 있다 — 해를 하나씩 바꿔 뒤지지 않게', () => {
  const fn = stripJs(cutFn(APP, 'function renderYearSel('));
  assert.match(fn, /unshift\(ALL_YEARS\)/, '★★ 고르개에 「모든 해」가 없으면 길이 아예 없습니다');
  assert.match(fn, /모든 해에서 찾기/, '★ 이름이 없으면 무엇인지 모릅니다');
  assert.match(fn, /해들\.length > 1/,
    '★ 해가 하나뿐일 때도 넣으면 가를 것이 없는데 고르라고 합니다');
});

test('★★★ 목록을 받을 때 「모든 해」가 «맨 먼저» 갈린다', () => {
  const fn = stripJs(cutFn(APP, 'function loadGrid('));
  const at = fn.indexOf('ALL_YEARS');
  const own = fn.indexOf('SHARED_OWNER');
  assert.ok(at > 0, '★★★ loadGrid 가 「모든 해」를 모릅니다 — 골라도 한 해만 옵니다');
  assert.ok(at < own,
    '★★★ 주인 갈래가 먼저 잡아채면 「모든 해」를 골라도 한 해만 받습니다');
});

test('★★ 방금 올린 사진이 「모든 해」 화면에도 뜬다 — 안 뜨면 「안 올라갔나」가 된다', () => {
  const fn = stripJs(cutFn(APP, 'function addToGrid('));
  assert.match(fn, /gridYear !== ALL_YEARS &&/,
    '★★ 「모든 해」로 보는 중에 올리면 화면에 안 나타납니다(해가 안 맞다고 거릅니다)');
});

test('★★ 미리보기를 «사진의 해»로 받는다 — 딴 해 사진이 까맣게 남지 않게', () => {
  const fn = stripJs(cutFn(APP, 'function fillThumbUrls('));
  assert.match(fn, /photoYearOf\(it\.id\)/,
    '★★ 화면의 해로 두드리면 다른 해 사진의 미리보기가 통째로 빕니다');
  const bulk = stripJs(cutFn(APP, 'function fillThumbs('));
  assert.match(bulk, /photoYearOf\(it\.id\)/,
    '★★ 묶음으로 받을 때도 해를 섞어 묶으면 딴 해 것이 안 옵니다');
});

test('★ 폴더 옮기기는 «해별로» 나눠 부른다 — 한 해로 뭉치면 딴 해 사진이 사라진다', () => {
  const fn = stripJs(cutFn(APP, 'function removeFolderAsk('));
  assert.match(fn, /photoYearOf\(it\.id\)/,
    '★ 「모든 해」로 보면 한 폴더에 여러 해가 섞입니다 — 한 해로 뭉뚱그리면\n' +
    '  다른 해 사진이 없는 자리에 적히고 폴더에서 조용히 사라집니다');
});
