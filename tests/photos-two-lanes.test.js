'use strict';
/* 사진첩 «사진 | 서류» 두 갈래 — 규칙을 못 박는다 (대표 결정 2026-09-09)
   실행: node --test tests/photos-two-lanes.test.js
   목업: docs/mockups/photos-two-lanes.html
   대표 결정: ①㉮ 둘을 합친 「전체」 칸 없앰 · ②㉯ 폰은 그대로 · ③㉮ 기본은 서류

   ★ 이 검사가 지키는 것 가운데 가장 무거운 둘:
     ① **사라지는 사진이 없다** — 갈래로 걸러도 어느 사진이든 그 갈래의 「전체」에서 보인다.
     ② **서류가 사진 칸에 숨지 않는다** — 숨으면 아무도 다시 읽히지 않고, 기업정보함으로
        갈 값이 영영 안 간다. 그래서 「모르겠다」는 것은 모두 서류 쪽으로 둔다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripComments } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
const BARE = stripComments(APP);

/* ── 갈래 층을 «진짜 코드»로 세운다 ────────────────────────────────────────────
   ⚠ 본문을 베어 옮기지 «않는다». 옮겨 적으면 화면이 바뀌어도 검사는 옛 규칙을
     지키고 있어 초록으로 남는다(이 저장소가 여러 번 밟은 자리다). */
function 상자(o) {
  const opt = o || {};
  const ctx = { console, Object, String, Number, Array, Boolean };
  ctx.globalThis = ctx;
  ctx.$ = function () { return {}; };
  /* 갈래 스위치가 보이나 — CSS 에게 묻는 자리를 여기서 흉내 낸다.
     opt.보임 === false 면 폰처럼(탭 줄이 감춰진 상태) 굴러간다. */
  ctx.getComputedStyle = function () { return { display: opt.보임 === false ? 'none' : 'flex' }; };
  if (opt.getComputedStyle === null) delete ctx.getComputedStyle;
  vm.createContext(ctx);
  vm.runInContext([
    APP.match(/^const LANE_PIC_KINDS = \{[^}]*\};/m)[0].replace('const ', 'var '),
    APP.match(/^const LANE_PIC_TABS = \{[^}]*\};/m)[0].replace('const ', 'var '),
    'var lane = ' + JSON.stringify(opt.lane || 'doc') + ';',
    'var CUSTOM_KINDS = ' + JSON.stringify(opt.customs || {}) + ';',
    'var KIND_HIDDEN = {};',
    APP.match(/^const KIND_TABS = \[[\s\S]*?^\];/m)[0].replace('const ', 'var '),
    'var CLAIMED_KINDS = KIND_TABS.reduce(function(a,t){ (t.kinds||[]).forEach(function(k){a[k]=1;}); return a; }, {});',
    'function allTabKeys(){ return KIND_TABS.map(function(t){return t.key;})' +
      '.concat(Object.keys(CUSTOM_KINDS).map(customTabKey)); }',
    'var gridItems = ' + JSON.stringify(opt.items || []) + ';',
    cutFn(APP, 'function customTabKey('),
    cutFn(APP, 'function isCustomTab('),
    cutFn(APP, 'function kindTabKeyOf('),
    cutFn(APP, 'function tabsOf('),
    cutFn(APP, 'function laneOf('),
    cutFn(APP, 'function lanesOn('),
    cutFn(APP, 'function laneHasTab('),
    cutFn(APP, 'function tabCounts(')
  ].join('\n'), ctx);
  return ctx;
}
function 갈래(meta, opt) {
  const ctx = 상자(opt);
  ctx.__it = { id: 'p1', meta: meta };
  return vm.runInContext('laneOf(__it)', ctx);
}

/* ══════ ① 무엇이 사진 갈래인가 ═══════════════════════════════════════════════ */

test('사람이 「사진」이라 한 것은 사진 갈래다 (카메라 📷 일반사진)', () => {
  assert.equal(갈래({ kind: 'photo' }), 'pic');
});

test('판독이 회의·현장 사진이라 한 것은 사진 갈래다', () => {
  assert.equal(갈래({ kind: 'doc', read: { kind: 'meeting' } }), 'pic');
});

test('★ 옛 사진을 «옮기지 않아도» 사진 갈래로 읽힌다 — 대량 쓰기를 만들지 않았다', () => {
  /* 지금 사진첩의 회의사진 339장이 이 꼴이다. 새 칸을 만들었다면 339장에 값을
     채워 넣는 대량 쓰기가 필요했고, 2026-08-16 에 그것으로 사고가 났다. */
  assert.equal(갈래({ kind: 'doc', read: { kind: 'meeting', ack: true } }), 'pic');
  assert.equal(갈래({ read: { kind: 'meeting' } }), 'pic', 'meta.kind 가 아예 없는 옛 사진');
});

/* ══════ ② 무엇이 서류 갈래인가 — «모르겠으면 서류»(③㉮) ══════════════════════ */

test('서류 종류로 읽힌 것은 서류 갈래다', () => {
  ['card', 'bizreg', 'payslip', 'contract', 'chat', 'timesheet', 'form'].forEach(k => {
    assert.equal(갈래({ kind: 'doc', read: { kind: k } }), 'doc', k + ' 가 서류가 아닙니다');
  });
});

test('★ 아직 안 읽은 것(답 안 한 것)은 «서류»다 — 대표 결정 ③㉮', () => {
  assert.equal(갈래({ kind: 'doc' }), 'doc');
  assert.equal(갈래({}), 'doc', '표시가 아예 없는 것도 서류로 둡니다');
});

test('★★ 「기타서류」(other)는 사진 갈래로 «안» 간다 — PIC_KINDS 를 쓰지 않았다', () => {
  /* PIC_KINDS 에는 other 가 들어 있다(noTextKind 용). 그것을 갈래에 쓰면
     상호·대표자를 다 읽고도 other 로 온 서류가 사진 칸에 숨는다. */
  assert.equal(갈래({ kind: 'doc', read: { kind: 'other' } }), 'doc',
    '★★ 기타서류가 사진 칸에 숨었습니다 — 기업정보함으로 갈 서류가 영영 안 갑니다');
  const src = BARE.slice(BARE.indexOf('function laneOf('), BARE.indexOf('function laneOf(') + 700);
  assert.equal(/PIC_KINDS\b(?!_)/.test(src.replace(/LANE_PIC_KINDS/g, '')), false,
    '★★ laneOf 가 PIC_KINDS 를 봅니다 — 그 표에는 other 가 들어 있습니다');
});

test('★★ 판독이 «실패»한 것은 서류 갈래다 — 사진 칸에 숨으면 다시 안 읽힌다', () => {
  assert.equal(갈래({ kind: 'doc', read: { kind: 'meeting', error: '판독 실패' } }), 'doc',
    '★★ 못 읽은 것이 사진 칸으로 갔습니다 — 아무도 다시 읽히지 않습니다');
});

test('★★ 「사진」이라 했다가 «서류로 읽힌» 것은 서류 갈래다 — 차례가 뜻이다', () => {
  /* 사람이 「그냥 사진」이라 했다가 「서류였다면 다시 읽기」를 눌러 사업자등록증으로
     읽힌 경우다. meta.kind 를 먼저 보면 그 서류가 사진 칸에 갇혀,
     사업자등록증 탭에 있으면서 사진 칸에서만 보이는 사진이 된다. */
  assert.equal(갈래({ kind: 'photo', read: { kind: 'bizreg' } }), 'doc',
    '★★ 서류로 읽힌 것이 사진 칸에 갇혔습니다 — 서류를 찾는 사람이 못 찾습니다');
});

/* ══════ ③ 사라지는 사진이 없다 ═══════════════════════════════════════════════ */

const 모둠 = [
  { id: 'a', meta: { kind: 'photo' } },                                   /* 사진 · 탭은 other */
  { id: 'b', meta: { kind: 'doc', read: { kind: 'meeting' } } },          /* 사진 · 탭은 meeting */
  { id: 'c', meta: { kind: 'doc', read: { kind: 'bizreg' } } },           /* 서류 */
  { id: 'd', meta: { kind: 'doc', read: { kind: 'other' } } },            /* 서류 · 기타서류 */
  { id: 'e', meta: { kind: 'doc' } },                                     /* 서류 · 아직 안 읽음 */
  { id: 'f', meta: { kind: 'doc', customKind: 'c1', read: { kind: 'form' } } }  /* 서류 · 직접분류 */
];
const 직접분류 = { c1: { name: '실태조사' } };

test('★★★ 갈래별 「전체」가 그 갈래를 «다» 덮는다 — 어느 사진도 사라지지 않는다', () => {
  ['doc', 'pic'].forEach(L => {
    const ctx = 상자({ items: 모둠, customs: 직접분류, lane: L });
    const c = vm.runInContext('tabCounts()', ctx);
    const 그갈래 = 모둠.filter(it => 갈래(it.meta) === L).length;
    assert.equal(c.all, 그갈래,
      '★★★ ' + L + ' 갈래의 「전체」가 ' + c.all + '장인데 실제로는 ' + 그갈래 + '장입니다 — 차이만큼 사라집니다');
  });
});

test('★★★ 두 갈래를 합치면 «한 장도 빠짐없이» 전부다', () => {
  const ctx = 상자({ items: 모둠, customs: 직접분류 });
  const c = vm.runInContext('tabCounts()', ctx);
  assert.equal(c._pic + c._doc, 모둠.length,
    '★★★ 갈래 둘을 합쳤는데 전부가 아닙니다 — 어느 갈래에도 없는 사진이 있습니다');
});

test('★ 탭에 안 걸리는 사진도 「전체」에서는 보인다', () => {
  /* a 는 사진 갈래인데 탭은 other(서류 갈래 탭)다 — 사진 갈래에 그 탭이 없다.
     그래도 사진 갈래 「전체」에는 있어야 한다. 이것이 「전체」를 남긴 까닭이다. */
  const ctx = 상자({ items: 모둠, customs: 직접분류, lane: 'pic' });
  const c = vm.runInContext('tabCounts()', ctx);
  const 탭에걸린수 = Array.from(vm.runInContext(
    'allTabKeys().filter(function(k){ return k !== "all" && laneHasTab(k, tabCounts()); })', ctx))
    .reduce((s, k) => s + (c[k] || 0), 0);
  assert.ok(c.all > 탭에걸린수,
    '★ 「전체」(' + c.all + ')가 탭 합계(' + 탭에걸린수 + ')보다 크지 않습니다 — '
    + '그러면 이 검사가 아무것도 안 지킵니다(탭에 안 걸리는 사진이 있는 모둠으로 재야 합니다)');
  /* 그 «안 걸리는» 사진이 정말 이 갈래에 있는지 — 전체가 크다는 것만으로는
     「전체가 딴 갈래까지 셌다」와 구별되지 않는다. */
  const 안걸린수 = c.all - 탭에걸린수;
  assert.equal(안걸린수, 모둠.filter(it => 갈래(it.meta) === 'pic'
    && vm.runInContext('laneHasTab(' + JSON.stringify(
      Array.from(vm.runInContext('tabsOf(' + JSON.stringify(it) + ')', ctx))[0]) + ', tabCounts())', ctx) === false).length,
    '★ 「전체」와 탭 합계의 차이가 «탭 없는 사진 수»와 다릅니다 — 전체가 딴 것을 셉니다');
});

/* ══════ ④ 탭이 갈래를 따른다 ═════════════════════════════════════════════════ */

test('★ 탭 셈은 «지금 갈래 안에서만» 센다 — 적힌 수와 눌러서 나오는 수가 같아야 한다', () => {
  const 서류 = vm.runInContext('tabCounts()', 상자({ items: 모둠, customs: 직접분류, lane: 'doc' }));
  const 사진 = vm.runInContext('tabCounts()', 상자({ items: 모둠, customs: 직접분류, lane: 'pic' }));
  assert.equal(사진.meeting, 1, '사진 갈래의 회의사진 수');
  assert.equal(서류.meeting, 0,
    '★ 서류 갈래에서도 회의사진이 세어졌습니다 — 탭 수가 갈래를 안 따릅니다');
  assert.equal(서류.bizreg, 1);
});

test('고정 탭은 «제 갈래»에서만 보인다', () => {
  const 사진 = 상자({ items: 모둠, customs: 직접분류, lane: 'pic' });
  const 서류 = 상자({ items: 모둠, customs: 직접분류, lane: 'doc' });
  const 보임 = (ctx, k) => vm.runInContext('laneHasTab(' + JSON.stringify(k) + ', tabCounts())', ctx);
  assert.equal(보임(사진, 'meeting'), true, '사진 갈래에 회의사진 탭이 없습니다');
  assert.equal(보임(사진, 'bizreg'), false, '사진 갈래에 사업자등록증 탭이 보입니다');
  assert.equal(보임(서류, 'bizreg'), true, '서류 갈래에 사업자등록증 탭이 없습니다');
  assert.equal(보임(서류, 'meeting'), false, '서류 갈래에 회의사진 탭이 보입니다');
  assert.equal(보임(서류, 'all'), true, '「전체」는 늘 보여야 합니다');
  assert.equal(보임(사진, 'all'), true, '「전체」는 늘 보여야 합니다');
});

test('직접분류는 «그 갈래에 있을 때만» 보인다 — 반대쪽에 0장 탭을 남기지 않는다', () => {
  const 보임 = (L) => vm.runInContext('laneHasTab("custom:c1", tabCounts())',
    상자({ items: 모둠, customs: 직접분류, lane: L }));
  assert.equal(보임('doc'), true, '서류가 든 직접분류가 서류 갈래에서 안 보입니다');
  assert.equal(보임('pic'), false, '★ 사진 갈래에 「0장」 직접분류 탭이 남습니다');
});

/* ══════ ⑤ 폰은 지금 그대로 (대표 결정 ②㉯) ═══════════════════════════════════ */

test('★★★ 갈래 스위치가 화면에 없으면 갈래로 «안» 거른다 — 폰에서 절반이 사라지면 안 된다', () => {
  const ctx = 상자({ items: 모둠, customs: 직접분류, lane: 'doc', 보임: false });
  assert.equal(vm.runInContext('lanesOn()', ctx), false, '탭 줄이 감춰졌는데 갈래가 켜져 있습니다');
  const c = vm.runInContext('tabCounts()', ctx);
  assert.equal(c.all, 모둠.length,
    '★★★ 고를 수 없는 갈래로 걸렀습니다 — 폰에서 사진 ' + (모둠.length - c.all) + '장이 까닭 없이 사라집니다');
  assert.equal(vm.runInContext('laneHasTab("meeting", tabCounts())', ctx), true,
    '폰에서는 탭을 갈래로 가리지 않습니다(어차피 탭 줄이 안 보입니다)');
});

test('★★★ «격자»도 스위치가 있을 때만 갈래로 거른다 — 셈만 막아서는 소용없다', () => {
  /* ⚠ 이 검사가 없어서 되돌림에 구멍이 났다(2026-09-09): tabCounts 에는 막이가
       있는데 shownItemsFresh 에서 막이를 빼도 검사가 통과했다. 그러면 폰에서
       **탭 수는 맞는데 격자에서 사진 절반이 사라진다** — 가장 못 믿게 만드는 꼴이다.
     ⚠ 글자 그대로 박지 «않는다». 재는 것은 «차례»다 — 막이가 갈래 거르기보다 앞에 있나. */
  const fn = stripComments(cutFn(APP, 'function shownItemsFresh('));
  const 거르기 = fn.indexOf('laneOf(');
  const 막이 = fn.indexOf('lanesOn()');
  assert.ok(거르기 > 0, '★ 격자가 갈래로 아예 안 걸러집니다 — 갈래를 나눈 뜻이 없습니다');
  assert.ok(막이 > 0 && 막이 < 거르기,
    '★★★ 격자의 갈래 거르기에 막이(lanesOn)가 없습니다 — 폰에서 사진 절반이 사라집니다');
});

test('★★ 화면 폭을 «숫자로» 재지 않는다 — CSS 에게 묻는다', () => {
  const fn = stripComments(cutFn(APP, 'function lanesOn('));
  assert.match(fn, /getComputedStyle/,
    '★★ CSS 에 묻지 않습니다 — 탭을 감추는 규칙(899px)과 isPhone(820px)이 달라 '
    + '821~899px 에서 「스위치는 없는데 걸러지는」 구간이 생깁니다');
  assert.equal(/\b(820|899|PHONE_MAX|innerWidth)\b/.test(fn), false,
    '★★ 폭을 숫자로 박았습니다 — CSS 가 바뀌면 조용히 어긋납니다');
});

test('★ 갈래 스위치는 #kinds «안»에 있다 — 폰에서 저절로 감춰진다', () => {
  assert.match(stripComments(cutFn(APP, 'function renderKindTabs(')),
    /\$\('kinds'\)\.innerHTML = laneSwitch\(c\)/,
    '★ 스위치가 탭 줄 밖에 있습니다 — 폰에서 감추는 규칙을 따로 만들어야 하고, 그것이 어긋날 자리입니다');
  /* 그 감추는 규칙이 실제로 #kinds 를 끄고 있는지 — 규칙이 사라지면 폰에 스위치가 뜬다 */
  assert.match(APP, /#kinds[^{]*\{display:none!important\}|#kinds,[^{]*\{display:none!important\}/,
    '★ 폰에서 #kinds 를 감추는 규칙이 없습니다 — 스위치가 폰에 나타납니다(②㉯ 위반)');
});

/* ══════ ⑥ 갈래를 바꿀 때 ═════════════════════════════════════════════════════ */

test('★ 갈래를 바꾸면 «그 갈래의 전체»로 돌아간다 — 빈 화면을 보여 주지 않는다', () => {
  const fn = stripComments(cutFn(APP, 'function pickLane('));
  assert.match(fn, /kindTab = 'all'/,
    '★ 탭을 그대로 두고 갈래를 바꿉니다 — 다른 갈래에 없는 탭이면 빈 화면이 뜹니다');
  assert.match(fn, /selected\.clear\(\)/,
    '★ 골라 둔 것을 안 풉니다 — 안 보이는 사진이 골라진 채로 남아 다음 손질에 함께 갑니다');
});

test('★ 갈래를 «기억하지 않는다» — 늘 서류에서 시작한다 (③㉮)', () => {
  assert.match(BARE, /let lane = 'doc';/,
    '★ 기본 갈래가 서류가 아닙니다');
  const 갈래줄 = BARE.slice(BARE.indexOf("let lane = 'doc'"), BARE.indexOf("let lane = 'doc'") + 400);
  assert.equal(/localStorage/.test(갈래줄), false,
    '★ 갈래를 기기에 기억합니다 — 어제 사진 칸에 두고 나가면 오늘 서류가 통째로 안 보입니다');
});

/* ══════ ⑦ 사진 칸으로 옮기기 ═════════════════════════════════════════════════ */

test('★★ 「사진 칸으로 옮기기」가 새 저장 길을 만들지 않는다', () => {
  const fn = stripComments(cutFn(APP, 'function moveToPicLane('));
  assert.match(fn, /retagPhotos\(\[id\], 'meeting'\)/,
    '★★ 분류 옮기기와 «다른 길»로 저장합니다 — 한쪽만 고쳐지면 갈래와 탭이 어긋납니다');
  assert.equal(/PuPhotoStore\./.test(fn), false,
    '★★ 저장 층을 직접 부릅니다 — 옮기는 길은 retagPhotos 하나여야 합니다');
});

test('★★ 남의 사진에는 그 단추가 «안 보인다»', () => {
  /* 이 집 규칙: 눌러도 서버가 막는 단추는 보이지 않는다.
     ⚠ retagPhotos 자체에는 막이가 없다 — 그래서 «보이게 하는 자리»가 유일한 막이다. */
  /* ⚠ 「moveToPicLane()」로 찾으면 «함수 선언»이 먼저 잡힌다(파일 앞쪽에 있다) —
       그 앞에는 당연히 막이가 없어 검사가 헛깨진다. 단추를 겨눈다. */
  const i = BARE.indexOf('onclick="moveToPicLane()"');
  assert.ok(i > 0, '단추를 그리는 자리를 못 찾았습니다');
  const 앞 = BARE.slice(Math.max(0, i - 320), i);
  assert.match(앞, /mayTouch\(it\.id\)/,
    '★★ 남의 사진에도 「사진 칸으로 옮기기」가 보입니다 — 눌러도 서버가 막습니다');
  assert.match(앞, /laneOf\(it\) === 'doc'/,
    '★ 이미 사진 갈래인 것에도 보입니다 — 눌러도 아무 일이 없는 단추가 가장 나쁩니다');
});

/* ══════ ⑧ 합친 「전체사진」은 없앴다 (①㉮) ═══════════════════════════════════ */

test('★ 둘을 합친 「전체사진」 칸이 없다 — 셋이 되면 다시 헷갈린다', () => {
  const 표 = APP.match(/^const KIND_TABS = \[[\s\S]*?^\];/m)[0];
  assert.match(표, /key: 'all',\s*label: '전체'/,
    '★ 「전체」 칸 이름이 아직 「전체사진」입니다 — 서류 갈래에서 그 말은 거짓입니다');
  /* 갈래를 세는 자리는 스위치뿐이다 — 탭에 「전체 692」 같은 «두 갈래 합계»가 없어야 한다 */
  const c = vm.runInContext('tabCounts()', 상자({ items: 모둠, customs: 직접분류, lane: 'doc' }));
  assert.notEqual(c.all, 모둠.length,
    '★ 「전체」가 두 갈래를 합쳐 셉니다 — 갈래를 나눈 뜻이 없어집니다');
});
