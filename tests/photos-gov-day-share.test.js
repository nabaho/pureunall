/* 정부사업일정 — 「그 날 그 일정의 담당끼리」 저절로 열기 (대표 결정 2026-09-28)

   ── 무슨 일이 있었나 ──
   「사진첩에 올라온 사진은 왜 정부사업에 실시간으로 공유가 안되나?」
   고장이 아니라 **열어 주는 길이 없었다.** 정부사업일정은 읽기만 하고
   (addShare 를 한 번도 안 부른다), 사진첩의 자동 공유는 «업체를 달 때»만 돈다.
   그런데 회의·현장 사진에는 판독이 읽을 상호가 없어 그 방아쇠가 영영 안 당겨졌다 —
   실측 2026년 회의·현장 373장 가운데 열린 것이 31장(8.3%)뿐이었다.

   ── 이 검사가 지키는 것 ──
   ① 잇기   — 사번이 먼저, 없으면 이름, **동명이인이면 아예 안 고른다**
   ② 고르기 — 그 날 그 일정의 주담당·부담당만. 그 날 일정이 없으면 아무도 아니다
   ③ 울타리 — **판독이 「회의·현장」이라고 확정한 것만.** 안 읽은 사진은 안 연다
              (급여서류·신분증이 기본값으로 새어 나가는 자리다)
   ④ 길목   — 판독이 끝나는 saveRead 한 곳에서 걸린다(부르는 쪽마다 걸면 꼭 빠진다)
   ⑤ 화면   — 사진첩을 열 때도 한 번 훑는다(이 기능 «전에» 판독된 사진 때문)
   ⚠ 값이 아니라 규칙을 본다 — 사람 수·사진 장수를 못 박지 않는다. */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const STORE = fs.readFileSync(path.join(ROOT, 'js', 'pu-photo-store.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8');

function loadStore() {
  const ctx = {
    console: { warn() {}, log() {} },
    Promise, Object, Array, JSON, String, Number, Math, Date, Set, Map,
    RegExp, Error, isFinite, parseInt, parseFloat, setTimeout, clearTimeout
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(STORE, ctx);
  return ctx;
}

/* ── 검사용 정부사업일정 자료 (가짜 이름만 쓴다) ────────────────────────────
   a1 권형하 자리 = 사번 없음(실제로도 셋이 그렇다) · a7 = 사번으로 이어진다 */
const STAFF = [
  { id: 'a1', name: '홍길동' },                    // 사번이 안 이어져 있다
  { id: 'a7', name: '임꺽정', erpSid: 'P-007' },
  { id: 'a4', name: '성춘향', erpSid: 'P-004' }
];
const SCHEDS = [
  { id: 's1', date: '2026-09-09', coId: 'c1', attId: 'a1', coAttIds: ['a7'] },
  { id: 's2', date: '2026-09-18', coId: 'c2', attId: 'a4', coAttIds: [] },
  { id: 's3', date: '2026-09-09', coId: 'c2', attId: 'a7', coAttIds: ['a4'] }
];
const COS = [{ id: 'c1', name: '가나상사' }, { id: 'c2', name: '다라산업' }];
const ROSTER = {
  U1: { sid: 'P-001', name: '홍길동' },            // 이름으로 이어진다
  U7: { sid: 'P-007', name: '임꺽정(개명)' },      // 사번으로 이어진다 — 이름이 달라도
  U4: { sid: 'P-004', name: '성춘향' }
};
/* 9월 9일 낮 — 시각대에 휘둘리지 않게 한낮으로 잡는다 */
const D0909 = new Date(2026, 8, 9, 12, 0, 0).getTime();
const D0918 = new Date(2026, 8, 18, 12, 0, 0).getTime();

function gov(over) {
  const ctx = loadStore();
  const o = over || {};
  return ctx.PuPhotoStore.govBuild(o.staff || STAFF, o.scheds || SCHEDS,
    o.cos || COS, o.roster || ROSTER);
}
function plan(meta, owner, over) {
  const ctx = loadStore();
  const o = over || {};
  const g = ctx.PuPhotoStore.govBuild(o.staff || STAFF, o.scheds || SCHEDS,
    o.cos || COS, o.roster || ROSTER);
  return ctx.PuPhotoStore.govPlan(meta, owner, g);
}
const meeting = (ts, extra) => Object.assign({ takenAt: ts, read: { kind: 'meeting' } }, extra || {});

/* ══ ① 잇기 ══════════════════════════════════════════════════════════════ */

test('★ 사번이 먼저다 — 이름이 달라져도 사번으로 잇는다', () => {
  const g = gov();
  assert.equal(g.staffOf.U7, 'a7',
    '사번(P-007)으로 이어야 합니다 — 개명하면 이름으로는 못 찾습니다');
  assert.equal(g.uidOf.a7, 'U7');
});

test('사번이 안 이어져 있으면 이름으로 잇는다', () => {
  const g = gov();
  assert.equal(g.staffOf.U1, 'a1',
    '정부사업일정 직원 셋은 아직 사번이 없습니다 — 이름 길이 막히면 그 셋이 통째로 빠집니다');
});

test('★ 동명이인이면 아예 안 고른다 — 남의 컨설팅 사진이 열린다', () => {
  const g = gov({ staff: STAFF.concat([{ id: 'a9', name: '홍길동' }]) });
  assert.equal(g.staffOf.U1, undefined,
    '같은 이름이 둘인데 한쪽을 골랐습니다 — 엉뚱한 사람에게 열립니다');
});

test('★★ 사번과 이름이 «다른 사람»을 가리키면 사번이 이긴다', () => {
  /* 개명한 뒤 남이 그 이름을 쓰는 경우다. 이름을 먼저 보면 엉뚱한 사람이 된다 —
     이름 하나로는 이것을 가를 수가 없어서 사번을 먼저 본다. */
  const g = gov({
    staff: [{ id: 'a7', name: '임꺽정', erpSid: 'P-007' }, { id: 'a9', name: '장길산' }],
    roster: { U7: { sid: 'P-007', name: '장길산' } }
  });
  assert.equal(g.staffOf.U7, 'a7',
    '이름을 먼저 봤습니다 — 사번이 가리키는 사람과 다른 사람에게 사진이 열립니다');
});

/* ══ ② 고르기 ════════════════════════════════════════════════════════════ */

test('★ 그 날 그 일정의 주담당·부담당에게 연다', () => {
  const r = plan(meeting(D0909), 'U7');
  assert.equal(r.uids.join('·'), 'U1·U4',
    '9/9 에 임꺽정은 일정 둘(s1 부담당 · s3 주담당)에 걸려 있습니다');
});

test('올린 사람 자신은 넣지 않는다', () => {
  const r = plan(meeting(D0909), 'U7');
  assert.ok(r.uids.indexOf('U7') < 0, '자기 사진은 원래 보입니다');
});

test('★★ 한 사람이 계정을 둘 만들었어도 자기 자신에게 안 연다', () => {
  /* 저장 층은 「계정이 여럿이면 가장 최근 것」을 쓴다 — 그러면 직원 한 칸이
     올린 사람과 «다른» 계정을 가리킬 수 있다. 계정으로만 견주면 그때 자기 사진을
     자기 옛 계정에 여는 헛일이 남는다. 직원 칸으로 견뎌야 막힌다. */
  const r = plan(meeting(D0909), 'U7', {
    roster: Object.assign({ U7old: { sid: 'P-007', name: '임꺽정' } }, ROSTER)
  });
  assert.ok(r.uids.indexOf('U7old') < 0 && r.uids.indexOf('U7') < 0,
    '올린 사람 자신(다른 계정 포함)에게 열었습니다');
});

test('★ 그 날 내 일정이 없으면 아무에게도 안 연다', () => {
  const r = plan(meeting(D0918), 'U7');
  assert.equal(r.uids.length, 0,
    '9/18 일정(s2)에는 임꺽정이 없습니다 — 날짜만 같다고 열면 안 됩니다');
});

test('★ 이미 열려 있는 사람은 다시 안 넣는다', () => {
  const r = plan(meeting(D0909, { shareWith: { U1: true } }), 'U7');
  assert.equal(r.uids.join('·'), 'U4', '이미 열린 사람까지 다시 쓰면 헛일만 늡니다');
});

test('열 사람이 하나도 안 남으면 까닭도 비운다', () => {
  const r = plan(meeting(D0909, { shareWith: { U1: true, U4: true } }), 'U7');
  assert.equal(r.uids.length, 0);
  assert.equal(r.why, '', '열지도 않으면서 까닭만 남기면 기록이 거짓이 됩니다');
});

test('까닭에 «어느 사업장 · 며칠»이 남는다 — ✕ 로 뺄 때 망설이지 않게', () => {
  const r = plan(meeting(D0909), 'U7');
  assert.match(r.why, /가나상사|다라산업/, '사업장 이름이 없습니다');
  assert.match(r.why, /9\/9/, '날짜가 없습니다');
  assert.ok(r.why.length <= 60, '까닭은 60자를 넘으면 잘립니다');
});

/* ══ ③ 울타리 — 무엇을 열지 ═══════════════════════════════════════════════ */

test('★★ 판독이 「회의·현장」이라 한 것만 연다 — 급여서류는 안 연다', () => {
  const r = plan({ takenAt: D0909, read: { kind: 'payslip' } }, 'U7');
  assert.equal(r.uids.length, 0, '급여서류가 열렸습니다');
});

test('★★ 아직 판독 안 된 사진은 안 연다 — «모른다»와 «회의·현장»은 다른 말이다', () => {
  const r = plan({ takenAt: D0909 }, 'U7');
  assert.equal(r.uids.length, 0,
    '판독 전 사진을 기본값으로 열면 신분증·계약서가 그대로 새어 나갑니다');
});

test('촬영 시각이 없는 사진은 안 연다 — 어느 날 일정인지 모른다', () => {
  const r = plan({ read: { kind: 'meeting' } }, 'U7');
  assert.equal(r.uids.length, 0);
});

test('정부사업일정 직원이 아닌 사람이 올린 사진은 안 연다', () => {
  const r = plan(meeting(D0909), 'U-모르는사람');
  assert.equal(r.uids.length, 0);
});

/* ══ ④ 길목 ══════════════════════════════════════════════════════════════ */

/* ⚠ 여기서부터는 «진짜 서버 모양»이 있어야 한다. 정부사업 자료를 안 주면 고를 사람이
   아무도 없어, 울타리를 빼도 조용해진다 — 검사가 헛돈다(이빨 확인 2026-09-28 ⑨). */
const TREE = {
  scal_staff: STAFF, scal_scheds: SCHEDS, scal_cos: COS,
  uid_roles: {
    U1: { sid: 'P-001', status: 'active', updatedAt: 1 },
    U7: { sid: 'P-007', status: 'active', updatedAt: 1 },
    U4: { sid: 'P-004', status: 'active', updatedAt: 1 }
  },
  data: { user_dir: { v: [
    { sid: 'P-001', name: '홍길동' },
    { sid: 'P-007', name: '임꺽정(개명)' },
    { sid: 'P-004', name: '성춘향' }
  ] } }
};
function serverDb(wrote) {
  return { ref(p) { return {
    once() {
      const v = String(p).split('/').reduce(function (a, k) {
        return (a == null ? null : a[k]);
      }, TREE);
      return Promise.resolve({ val: function () { return v === undefined ? null : v; } });
    },
    update(u) { if (u) wrote.push(u); return Promise.resolve(); },
    set() { return Promise.resolve(); }
  }; } };
}

test('★★ 남의 사진은 총괄관리자가 아니면 손대지 않는다', async () => {
  const wrote = [];
  const ctx = loadStore();
  ctx.PuPhotoStore.init({ uid: 'U1', isAdmin: false, db: serverDb(wrote) });
  const r = await ctx.PuPhotoStore.govShare(
    [{ id: 'p1', year: '2026', owner: 'U7', meta: meeting(D0909) }]);
  assert.equal(r.photos, 0, '남의 사진을 열었습니다');
  assert.equal(wrote.length, 0, '규칙이 거절할 쓰기를 보냈습니다 — 주인과 총괄관리자만 됩니다');
});

test('총괄관리자는 남의 사진도 연다 — 울타리가 헛돌지 않는다는 확인', async () => {
  const wrote = [];
  const ctx = loadStore();
  ctx.PuPhotoStore.init({ uid: 'U1', isAdmin: true, db: serverDb(wrote) });
  const r = await ctx.PuPhotoStore.govShare(
    [{ id: 'p1', year: '2026', owner: 'U7', meta: meeting(D0909) }]);
  assert.ok(r.photos > 0, '관리자인데도 아무 일이 안 일어났습니다 — 위 검사가 헛돕니다');
  assert.ok(wrote.length > 0);
  const keys = Object.keys(wrote[0]).join(' ');
  assert.match(keys, /shareWith/, '「같이 볼 사람」에 안 적었습니다');
  assert.match(keys, /sharedTo/, '받는 사람 쪽 표가 없으면 목록에 안 뜹니다');
});

test('내 사진은 관리자가 아니어도 내가 연다', async () => {
  const wrote = [];
  const ctx = loadStore();
  ctx.PuPhotoStore.init({ uid: 'U7', isAdmin: false, db: serverDb(wrote) });
  const r = await ctx.PuPhotoStore.govShare(
    [{ id: 'p1', year: '2026', owner: 'U7', meta: meeting(D0909) }]);
  assert.ok(r.photos > 0, '제 사진을 제가 못 열면 이 기능이 아무 일도 안 합니다');
});

test('★★ 판독이 끝나는 길목(saveRead) 한 곳에서 걸린다', () => {
  /* ⚠ 고정 폭(700자)으로 자르지 않는다 — saveRead 가 길어지자 끝 11자를 못 봤다
       (tests/test-cut-truncation.test.js 가 잡았다). 함수 «전체»를 본다. */
  const body = stripJs(cutFn(STORE, 'function saveRead(') || '');
  assert.ok(body, 'saveRead 를 못 찾았습니다');
  assert.match(body, /govQueue\(/,
    '판독 결과를 저장하는 자리에서 안 걸립니다 — 부르는 쪽마다 걸면 꼭 한 곳이 빠집니다');
});

test('「회의·현장」이 아닌 판독은 길목에서 그대로 흘려보낸다', () => {
  const src = STORE.replace(/\/\*[\s\S]*?\*\//g, '');
  const from = src.indexOf('function govQueue(');
  assert.ok(from > 0, 'govQueue 를 못 찾았습니다');
  const body = src.slice(from, src.indexOf('\n  }', from));
  assert.match(body, /kind\s*!==\s*'meeting'/,
    'govQueue 가 갈래를 안 가립니다 — 서류까지 열립니다');
});

/* ══ ⑤ 화면 ══════════════════════════════════════════════════════════════ */

test('★ 사진첩을 열 때도 한 번 훑는다 — 이 기능 전에 판독된 사진 때문', () => {
  const app = HTML.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(app, /govShareSweep\(\)/, '훑는 길이 없습니다');
  const from = app.indexOf('function loadGrid(');
  const to = app.indexOf('function showGridError(');
  assert.ok(from > 0 && to > from, 'loadGrid 를 못 찾았습니다');
  assert.match(app.slice(from, to), /govShareSweep\(\)/,
    '목록을 불러온 뒤에 안 훑습니다 — 한 번도 안 불리는 함수가 됩니다');
});

test('열어 준 것을 사람에게 말해 준다 — 조용히 넘기면 안 한 것보다 나쁘다', () => {
  const app = HTML.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const from = app.indexOf('function govSharedToast(');
  assert.ok(from > 0, '알림 함수가 없습니다');
  assert.match(app.slice(from, from + 500), /toast\(/, '알림을 안 띄웁니다');
  assert.match(app, /onGovShare\(govSharedToast\)/,
    '판독 길로 열린 것은 알림이 안 붙습니다');
});

test('★ 화면은 다른 앱의 실시간DB 자리를 모른다 — 맞추는 일은 저장 층이 한다', () => {
  const app = HTML.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  ['scal_scheds', 'scal_staff', 'scal_cos'].forEach(function (k) {
    assert.ok(!new RegExp('\\b' + k + '\\b').test(app),
      '화면이 ' + k + ' 를 직접 만집니다');
  });
  assert.match(STORE, /'scal_scheds'/, '저장 층이 일정을 안 읽으면 맞출 수가 없습니다');
});
