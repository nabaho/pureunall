'use strict';
/* 「사진첩 계속해서 제대로 저장 안되고」 (대표 지시 2026-09-14)

   ■ 무엇이 「저장이 안 된 것」처럼 보이나 — «유령 사진»
   실시간DB 는 **없는 자리에 써도 그 자리를 만든다.** 그래서 사진을 지운 뒤에 늦게
   끝난 일(판독 결과·증빙 표시·공유 표시·미리보기 주소)이 도착하면, 그 한 칸만 든
   사진이 **되살아난다.** 격자에는 그림도 날짜도 올린이도 없는 빈 칸으로 뜬다 —
   사람 눈에는 그것이 곧 「저장이 제대로 안 됐다」이다.

   ■ 실측 (2026-09-14 · 운영 사진 806장)
   그런 유령이 **14장** 있었다. 든 칸이 `read` 하나, `read·used`,
   `shareBy·shareWith·used` — 전부 「사진은 없는데 표시만 남은」 모양이다.

   ■ 왜 — **한 곳만 고쳐 두었다**
   saveRead 에는 「살아 있으면 쓴다」가 이미 있었는데, 같은 자리에 쓰는 **형제들**
   (markUsed·setFolder·setCustomKind·setTakenAt·markEdited·rememberThumbUrl)에는 없었다.
   이 저장소가 되풀이해 밟은 「막는 쪽과 쓰는 쪽의 기준이 다르다」와 같은 모양이다.

   ⚠ 이미 있는 유령 14장은 **그대로 둔다**(2026-08-15 결정). 여기서 막는 것은
     «새로 생기는 것»이다.

   실행: node --test tests/photo-store-no-ghost.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'js', 'pu-photo-store.js'), 'utf8');
const vm = require('node:vm');

/* 저장 층은 window 에 붙는 IIFE 다 — 다른 검사들과 «같은 방식»으로 상자에 싣는다. */
function load() {
  const ctx = {
    console, Promise, Object, Array, JSON, String, Number, Math, Date, Set, Map,
    RegExp, Error, isFinite, parseInt, parseFloat, setTimeout, clearTimeout
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.PuPhotoStore;
}

/* 가짜 실시간DB — 「그 자리에 무엇이 있나」를 우리가 정하고, 무엇이 써졌는지 본다. */
function fakeDb(있는가) {
  const wrote = [];
  return {
    wrote: wrote,
    ref: function (p) {
      return {
        update: function (u) { wrote.push(u); return Promise.resolve(); },
        once: function () {
          /* 사진 정보 읽기 — 지워졌으면 null */
          return Promise.resolve({ val: function () { return 있는가 ? { by: 'u1', upAt: 1 } : null; } });
        }
      };
    }
  };
}
function store(있는가) {
  const db = fakeDb(있는가);
  const S = load();
  S.init({ db: db, uid: 'u1', name: '홍길동' });
  return { db: db, S: S };
}

/* 사진 한 칸에 쓰는 길 — 늦게 끝나 «지워진 뒤»에 도착할 수 있는 것들 */
const 길 = [
  ['판독 결과', function (S) { return S.saveRead('2026', 'p1', { kind: 'card' }); }],
  ['증빙으로 썼다', function (S) { return S.markUsed('2026', 'p1', '푸른이알피 계약'); }],
  ['폴더 옮기기', function (S) { return S.setFolder('2026', 'p1', 'f1'); }],
  ['직접분류', function (S) { return S.setCustomKind('2026', 'p1', 'k1'); }],
  ['찍은 날 고치기', function (S) { return S.setTakenAt('2026', 'p1', 1700000000000); }],
  ['사진 편집 표시', function (S) { return S.markEdited('2026', 'p1', 'ai'); }],
  ['미리보기 주소', function (S) { return S.rememberThumbUrl('2026', 'p1', 'https://x/y'); }]
];

test('★★ 지워진 사진에는 «한 글자도» 안 쓴다 — 그 한 칸이 유령이 된다', async () => {
  const 샌곳 = [];
  for (const [이름, 하기] of 길) {
    const { db, S } = store(false);     // 사진이 이미 지워졌다
    await 하기(S).catch(function () { });
    if (db.wrote.length) 샌곳.push(이름);
  }
  assert.deepEqual(샌곳, [],
    '★★ 지워진 사진에 쓰는 길이 남아 있습니다: ' + 샌곳.join(', ') + '\n' +
    '  실시간DB 는 없는 자리에 써도 그 자리를 만듭니다 — 그림도 날짜도 없는\n' +
    '  «유령 사진»이 격자에 뜨고, 사람 눈에는 그것이 「저장이 안 됐다」입니다.\n' +
    '  (운영에서 실제로 14장 있었습니다)');
});

test('★★ 살아 있는 사진에는 «그대로» 쓴다 — 막느라 못 쓰면 안 된다', async () => {
  const 못쓴곳 = [];
  for (const [이름, 하기] of 길) {
    const { db, S } = store(true);      // 사진이 살아 있다
    await 하기(S).catch(function () { });
    if (!db.wrote.length) 못쓴곳.push(이름);
  }
  assert.deepEqual(못쓴곳, [],
    '★★ 유령을 막다가 멀쩡한 저장까지 막았습니다: ' + 못쓴곳.join(', '));
});

test('★★ 판정은 «한 곳»이다 — 형제마다 따로 적으면 한 곳이 꼭 빠진다', () => {
  assert.match(src, /function updateAlive\(/, '★ 모아 둔 함수가 없습니다');
  const n = (src.match(/updateAlive\(/g) || []).length;
  assert.ok(n >= 7,
    '★★ updateAlive 를 쓰는 곳이 ' + n + '곳뿐입니다 — 선언 하나와 쓰는 곳 여섯은\n' +
    '  나와야 합니다. 형제마다 따로 적으면 다음에 한 곳이 또 빠집니다.\n' +
    '  (saveRead 한 곳에만 있었던 것이 이번 일의 까닭입니다)');
  /* 「없으면 안 쓴다」가 실제로 그 함수 안에 있는가 */
  const i = src.indexOf('function updateAlive(');
  assert.match(src.slice(i, i + 400), /if \(!meta\) return null;/,
    '★★ 살아 있는지 보고도 그냥 씁니다 — 보는 시늉만 하는 것입니다.');
});

test('★ 여럿에 한꺼번에 쓰는 길은 «따로 둔다» — 장마다 읽으면 그것이 요금이다', () => {
  /* setDocs·moveFolderPhotos 는 한 번에 여러 장을 쓴다. 장마다 한 번씩 읽으면
     수십 번의 읽기가 되고, 그 둘은 사람이 방금 화면에서 고른 사진들이라
     「지워진 뒤 늦게 도착」이 사실상 없다. 일부러 뺀 것임을 못 박아 둔다. */
  assert.match(src, /function setDocs\(/);
  assert.match(src, /function moveFolderPhotos\(/);
});
