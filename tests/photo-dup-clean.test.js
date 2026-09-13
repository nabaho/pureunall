'use strict';
/* 🧹 똑같은 사진 정리 (대표 지시 2026-09-12 「중복사진정리」)

   ■ 무엇이 있었나 — 운영 자료 937장을 세어 본 결과
     같은 파일을 두 번 올린 것이 **7쌍** 있었다. 대부분 2026-08-11 09:03 과 09:04 —
     사업자등록증을 올리다 한 번 더 누른 것이다. 쌍마다 한쪽은 판독이 bizreg 이고
     다른 쪽은 other 이거나 아예 없다.

   ■ 규칙
     ⓐ 1차는 «같은 주인 · 같은 화소 · 같은 크기 · 같은 찍은 때» — 목록에 있는 값뿐이라 공짜다.
     ⓑ 그다음 후보만 «미리보기를 실제로 받아» 견준다. 대표 지시는 「완전 동일」이다.
     ⓒ 남기는 차례: 증빙으로 쓴 것 > 어디론가 보낸 것 > 판독이 쓸모 있는 것 > 먼저 올린 것.
   ⚠⚠ 스스로 지우지 않는다 — 찾아 보여 주고 사람이 눌러야 치운다.
   ⚠⚠ 치우는 곳은 «휴지통»(30일)이다. 되살릴 수 없으면 이 일을 할 수 없다.
   ⚠ 증빙으로 쓴 것이 둘 이상인 묶음은 통째로 건너뛴다.
   ⚠ 값이 하나라도 비면 후보로 안 낸다 — 빈 값끼리 같아 보이면 그것이 사고다. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const PHOTOS = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8').replace(/\r\n/g, '\n');

const 상자 = (function () {
  const box = { Number, String, Object, Array,
    /* 증빙으로 쓴 표 — 화면의 것과 같은 판정을 쓴다 */
    isUsed: function (m) { return !!(m && m.used && m.used.at); } };
  box.globalThis = box;
  vm.createContext(box);
  ['function dupKeyOf(', 'function dupKeepRank(', 'function dupRankCmp(', 'function dupPhotoGroups(']
    .forEach(function (d) { vm.runInContext(cutFn(PHOTOS, d), box); });
  return box;
})();
const 묶기 = 상자.dupPhotoGroups;

/* 운영 자료 그대로의 한 쌍 (소나기 컴퍼니, 2026-08-11) — 이름은 회사라 그대로 둔다 */
const 장 = function (id, extra) {
  return { id: id, meta: Object.assign({
    __ownerUid: 'u1', w: 1536, h: 2048, size: 412345, takenAt: 1786000000000,
    upAt: 1786000000000, read: { kind: 'bizreg' }
  }, extra || {}) };
};

test('① ★★ 같은 파일 두 장이 «한 묶음»이 된다 — 여벌은 하나다', function () {
  const g = 묶기([장('a'), 장('b', { upAt: 1786000060000 })]);
  assert.equal(g.length, 1, '★★ 똑같은 두 장을 못 묶었습니다');
  assert.equal(g[0].drop.length, 1, '★★ 한 장은 반드시 남아야 합니다');
  assert.equal(g[0].keep.id, 'a', '★ 먼저 올린 것을 남겨야 합니다');
});

test('② ★★ 값이 «하나라도 비면» 후보로 안 낸다', function () {
  ['w', 'h', 'size', 'takenAt'].forEach(function (k) {
    const 빔 = {}; 빔[k] = 0;
    assert.equal(묶기([장('a', 빔), 장('b', 빔)]).length, 0,
      '★★ ' + k + ' 가 비었는데 「같은 사진」으로 묶었습니다 — 서로 다른 사진이 사라집니다');
  });
});

test('③ ★★ 주인이 다르면 «절대» 안 묶는다 — 남의 사진이 사라진다', function () {
  assert.equal(묶기([장('a'), 장('b', { __ownerUid: 'u2' })]).length, 0,
    '★★ 다른 사람의 사진과 묶었습니다');
});

test('④ ★★ 크기·화소·찍은 때가 하나라도 다르면 안 묶는다', function () {
  [{ size: 999 }, { w: 800 }, { h: 900 }, { takenAt: 1 }].forEach(function (d) {
    assert.equal(묶기([장('a'), 장('b', d)]).length, 0,
      '★★ ' + JSON.stringify(d) + ' 가 다른데 같은 사진으로 봤습니다');
  });
});

test('⑤ ★★ «증빙으로 쓴 것»을 남긴다 — 계약의 근거가 사라지면 안 된다', function () {
  /* 나중에 올렸어도 증빙으로 쓴 쪽이 남는다 */
  const g = 묶기([장('a'), 장('b', { upAt: 1786000060000, used: { at: 1, where: '계약' } })]);
  assert.equal(g[0].keep.id, 'b', '★★ 증빙으로 쓴 사진을 치우려 합니다');
  assert.deepEqual(g[0].drop.map(function (x) { return x.id; }), ['a']);
});

test('⑥ ★★ 증빙으로 쓴 것이 «둘 이상»이면 통째로 건너뛴다', function () {
  const g = 묶기([장('a', { used: { at: 1 } }), 장('b', { used: { at: 2 } })]);
  assert.equal(g[0].drop.length, 0, '★★ 어느 계약의 근거인지 모르는 채로 치웠습니다');
  assert.match(g[0].skip, /증빙/, '★ 왜 건너뛰는지 안 말합니다');
});

test('⑦ ★ 어디론가 보낸 것을 남긴다 — 그 기록이 이 사진을 가리킨다', function () {
  const g = 묶기([장('a'), 장('b', { read: { kind: 'bizreg', filed: { id: 'co-1' } } })]);
  assert.equal(g[0].keep.id, 'b', '★ 기업정보함에 보낸 사진을 치우려 합니다');
});

test('⑧ ★★ 판독이 «쓸모 있는» 쪽을 남긴다 — 실제로 그런 쌍이 있었다', function () {
  /* 운영 자료: (주) 나진 — 한쪽은 bizreg, 다른 쪽은 other 로 읽혔다 */
  const g = 묶기([장('나중', { upAt: 1786000060000, read: { kind: 'bizreg' } }),
                  장('먼저', { upAt: 1786000000000, read: { kind: 'other' } })]);
  assert.equal(g[0].keep.id, '나중',
    '★★ 판독이 제대로 된 쪽을 치웠습니다 — 먼저 올린 것보다 쓸모가 앞섭니다');
});

test('⑨ ★ 세 장이면 둘이 여벌이다', function () {
  const g = 묶기([장('a'), 장('b'), 장('c')]);
  assert.equal(g[0].drop.length, 2);
  assert.equal(g.length, 1);
});

test('⑩ ★ 겹치지 않는 사진만 있으면 아무것도 안 내놓는다', function () {
  assert.deepEqual(묶기([장('a'), 장('b', { size: 1 }), 장('c', { size: 2 })]), []);
  assert.deepEqual(묶기([]), []);
  assert.deepEqual(묶기(null), []);
});

/* ── 화면 쪽 ── */

/* 견주는 길을 «돌려 본다» — 글자로만 보면 코드를 두고 안 부르는 것을 못 잡는다
   (2026-09-12 이빨 확인에서 실제로 그 구멍이 났다). */
function 견주기판(thumbs) {
  const 부른것 = [];
  const box = {
    Promise, Object, String, Number, Array,
    photoYearOf: function () { return '2026'; },
    PuPhotoStore: { loadThumb: function (y, id) {
      부른것.push(id);
      return Object.prototype.hasOwnProperty.call(thumbs, id)
        ? Promise.resolve(thumbs[id]) : Promise.reject(new Error('없음'));
    } }
  };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(cutFn(PHOTOS, 'function dupVerify('), box);
  return { verify: box.dupVerify, 부른것: 부른것 };
}
const 묶음 = function (keepId, dropIds) {
  return { key: 'k', keep: { id: keepId, meta: {} },
    drop: dropIds.map(function (i) { return { id: i, meta: {} }; }), skip: '' };
};

test('⑪-0 ★★ 견주는 길을 «돌려 본다» — 미리보기를 진짜로 받아 오는가', async function () {
  const p = 견주기판({ a: 'THUMB-X', b: 'THUMB-X' });
  const out = await p.verify([묶음('a', ['b'])]);
  assert.deepEqual(p.부른것.sort(), ['a', 'b'],
    '★★ 미리보기를 안 받고 「완전 동일」이라 합니다 — 받는 코드를 두고 안 부르면 같은 일입니다');
  assert.deepEqual(out[0].drop.map(function (x) { return x.id; }), ['b']);
});

test('⑪-1 ★★ 미리보기가 «다르면» 지울 목록에서 뺀다', async function () {
  const p = 견주기판({ a: 'THUMB-X', b: 'THUMB-다름' });
  const out = await p.verify([묶음('a', ['b'])]);
  assert.equal(out[0].drop.length, 0,
    '★★ 크기만 같고 그림이 다른 사진을 지웠습니다 — 「완전 동일」이 아닙니다');
  assert.match(out[0].skip, /서로 다른/, '★ 왜 안 지우는지 안 말합니다');
});

test('⑪-2 ★★ 미리보기를 «못 받으면» 아무것도 안 지운다 — 모르는 것은 안 지운다', async function () {
  const 기준없음 = await 견주기판({ b: 'THUMB-X' }).verify([묶음('a', ['b'])]);
  assert.equal(기준없음[0].drop.length, 0, '★★ 남길 것을 못 받았는데 여벌을 지웠습니다');
  const 여벌없음 = await 견주기판({ a: 'THUMB-X' }).verify([묶음('a', ['b'])]);
  assert.equal(여벌없음[0].drop.length, 0, '★★ 견주지도 못한 사진을 지웠습니다');
});

test('⑪ ★★ 후보를 «실제로 견준다» — 어림으로 지우지 않는다', function () {
  const fn = cutFn(PHOTOS, 'function dupVerify(');
  assert.ok(fn, '견주는 자리를 못 찾았습니다');
  assert.match(fn, /loadThumb/, '★★ 미리보기를 안 받고 「완전 동일」이라 합니다');
  /* ⚠ 「함수 안에 loadThumb 가 있다」로는 모자란다 — 받는 코드를 두고도 «안 부르면»
     그대로 통과한다. 묶음마다 실제로 받아 오는 줄을 못박는다. */
  assert.match(fn, /Promise\.all\(\[받기\(g\.keep\)\]\.concat\(g\.drop\.map\(받기\)\)\)/,
    '★★ 받는 코드는 있는데 묶음마다 부르지 않습니다 — 견주지도 않고 지웁니다');
  assert.match(fn, /srcs\[i \+ 1\] === 기준/, '★★ 받아 놓고 안 견줍니다');
  /* 못 받았으면 같다고 치지 않는다 */
  assert.match(fn, /if \(!기준\) return[\s\S]{0,120}drop: \[\]/,
    '★★ 미리보기를 못 받았는데 지울 목록에 그대로 둡니다 — 모르는 것은 안 지웁니다');
});

test('⑫ ★★ 스스로 지우지 않는다 — 찾는 길과 치우는 길이 갈려 있다', function () {
  const find = cutFn(PHOTOS, 'function dupCleanFind(');
  assert.ok(!/deletePhoto/.test(find),
    '★★ 찾기만 눌렀는데 사진이 지워집니다');
  const run = cutFn(PHOTOS, 'function dupCleanRun(');
  /* ⚠ 「confirm 이 있다」로는 모자라다 — `if (false && confirm(…))` 도 통과한다.
     «아니라고 하면 돌아간다»는 그 줄 자체를 못박는다. 검사고정-허용: 이 모양이 곧 규칙이다. */
  assert.match(run, /if \(!confirm\([\s\S]{0,400}?\) return;/,
    '★★ 묻지 않고 치웁니다 (또는 「아니오」를 눌러도 그냥 치웁니다)');
  assert.match(run, /deletePhoto/, '★ 치우는 길이 없습니다');
});

test('⑬ ★★ 휴지통으로 보낸다 — «즉시 삭제»가 아니다', function () {
  const run = cutFn(PHOTOS, 'function dupCleanRun(');
  assert.match(run, /deletePhoto\(photoYearOf\(id\), id, '중복 — 똑같은 사진', photoOwner\(id\)\)/,
    '★★ 왜 지웠는지·누구 자리인지를 안 넘깁니다');
  assert.match(run, /TRASH_DAYS/, '★ 되살릴 수 있다는 말을 안 합니다');
  assert.ok(!/purge|remove\(\)/.test(run), '★★ 즉시 삭제로 되돌아갔습니다');
});

test('⑭ ★★ 남의 사진은 «쓰던 판정»으로 막는다 — 새 규칙을 만들지 않는다', function () {
  const run = cutFn(PHOTOS, 'function dupCleanRun(');
  assert.match(run, /blockedIfOther\(ids\)/,
    '★★ 남의 사진을 말없이 치웁니다 — 그 사람은 왜 없어졌는지 알 길이 없습니다');
});

test('⑮ ★ 무엇이 남는지 «치우기 전에» 보인다', function () {
  const fn = cutFn(PHOTOS, 'function renderDupClean(');
  assert.match(fn, /것을 남깁니다/, '★ 어느 것이 남는지 안 알려 줍니다');
  assert.match(fn, /여벌 ' \+ n \+ '장을 휴지통으로/, '★ 몇 장이 없어지는지 안 적습니다');
  /* 건너뛴 묶음도 왜 건너뛰는지 말한다 */
  assert.match(fn, /건너뜁니다/, '★ 건너뛴 묶음을 조용히 감춥니다');
});

test('⑯ ★ 설정 화면에 자리가 있고, 「자동으로 안 지운다」를 적어 둔다', function () {
  const src = stripComments(PHOTOS);
  assert.match(src, /id="setDup"/, '★ 설정에 자리가 없습니다 — 만들어 놓고 못 씁니다');
  assert.match(src, /onclick="dupCleanFind\(\)"/, '★ 찾기 단추가 안 걸려 있습니다');
  const at = src.indexOf('id="setDup"');
  const 구역 = src.slice(at, at + 700);
  assert.match(구역, /한 장은 그대로 남고/, '★ 한 장은 남는다는 것을 안 알려 줍니다');
  assert.match(구역, /30일/, '★ 되살릴 수 있다는 것을 안 알려 줍니다');
  assert.match(구역, /증빙으로 쓴 사진은 남깁니다/, '★ 증빙은 남긴다는 것을 안 알려 줍니다');
});
