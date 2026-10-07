'use strict';
/* 기업정보함 점검 ② — 큰 부담 없는 자동화 넷 (2026-10-07)
   ① 사업자등록증을 저장하면 그 한 장을 «저절로» 기업상세로(검산한 번호만 · 빈 칸만)
   ② 휴지통 30일 정리는 «서버 시각을 차지한 PC 하나»만 하루 한 번
   ③ 검색목록에 담는 칸이 바뀌면 «저절로» 한 번 다시 만든다(모양은 idxRecord 를 돌려 짓는다)
   ④ 「지난 메일 이어서 채우기」를 앞으로 나가는 동안 저절로 — 멈출 때를 지킨다
   ⚠ 예시는 가짜다(가나상사 · 123-). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const tick = () => new Promise((r) => setTimeout(r, 0));

/* ══════ ① 등록증 저장 → 기업상세 ══════ */
function bizBox(ok) {
  const sent = [];
  const ctx = { console, String, Promise,
    Store: { mode: 'firebase', db: {} }, BIZFILL_FIELDS: ['company', 'ceo', 'address'],
    bizNoOk: () => ok, toast: (m) => { ctx._toast = m; }, myName: () => '홍길동',
    window: {}, PuDocFile: { init() {}, sendToCoInfo: (o) => { sent.push(o); return Promise.resolve({ ok: true, filled: ['ceo'] }); } } };
  ctx.window.PuDocFile = ctx.PuDocFile;
  vm.createContext(ctx);
  ['async function bizFillOne(', 'function bizFillAfterSave('].forEach((h) => vm.runInContext(sliceFn(SRC, h), ctx));
  return { ctx, sent };
}
test('★★ 등록증을 저장하면 그 한 장을 기업상세로 — 검산한 번호만, 명함은 안 보낸다', async () => {
  let b = bizBox(true);
  b.ctx.bizFillAfterSave({ id: 'b1', kind: 'biz', bizno: '123-45-67890', company: '가나상사', ceo: '홍길동' });
  await tick();
  assert.equal(b.sent.length, 1, '★★ 저장한 등록증을 기업상세로 안 보냅니다 — 「부어 넣기」가 다시 밀립니다');
  assert.equal(b.sent[0].fields.bizno, '123-45-67890');
  assert.match(b.ctx._toast || '', /기업 상세에도 채웠습니다/, '채운 것은 알린다');
  b = bizBox(false);
  b.ctx.bizFillAfterSave({ id: 'b1', kind: 'biz', bizno: '123-45-6789', company: '가나상사' });
  assert.equal(b.sent.length, 0, '★★ 검산 안 맞는 번호로 보내면 남의 회사 칸에 들어갑니다');
  b = bizBox(true);
  b.ctx.bizFillAfterSave({ id: 'c1', kind: 'card', bizno: '123-45-67890' });
  assert.equal(b.sent.length, 0, '명함은 보내지 않는다');
  const save = strip(sliceFn(SRC, 'async function saveEditor('));
  assert.match(save, /Store\.put\(it\);[\s\S]{0,80}coNtsAutoAfterSave\(it\);[\s\S]{0,120}bizFillAfterSave\(it\);/,
    '★ 저장 직후에 부르지 않으면 소용없다');
});

/* ══════ ② 휴지통 정리 — 한 PC 만 ══════ */
function claimBox(server, cold) {
  const ctx = { console, Number, Date, DB_ROOT: 'pucards' };
  vm.createContext(ctx);
  vm.runInContext(SRC.match(/const TRASH_PURGE_EVERY = [^;]+;/)[0].replace('const ', 'var ') + '\n' + sliceFn(SRC, 'function trashPurgeClaim('), ctx);
  const db = { ref: () => ({ transaction: async (fn) => {
    if (cold) fn(null);                                   /* 찬 자리 첫 부름 */
    const next = fn(server);
    return next === undefined ? { committed: false } : { committed: true, snapshot: { val: () => next } };
  } }) };
  return ctx.trashPurgeClaim(db);
}
test('★★★ 휴지통 정리는 «오늘 아직 아무도 안 했을 때» 한 PC 만', async () => {
  assert.equal(await claimBox(Date.now() - 2 * 3600 * 1000, true), false, '★★★ 오늘 이미 했는데 또 합니다 — 직원 PC 마다 돕니다');
  assert.equal(await claimBox(Date.now() - 25 * 3600 * 1000, true), true, '하루가 지났으면 맡아야 합니다');
  assert.equal(await claimBox(null, true), true, '처음이면 맡아야 합니다');
});

/* ══════ ③ 검색목록 모양 ══════ */
function idxBox(src) {
  const ctx = { console, Object, String, Proxy, window: {} };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(src, 'function idxRecord(') + '\n' + sliceFn(src, 'function idxShapeSig('), ctx);
  return ctx;
}
test('★★ 담는 칸을 늘리면 «모양»이 저절로 바뀐다 — 판 번호를 손으로 올릴 일이 없다', () => {
  const a = idxBox(SRC).idxShapeSig();
  assert.match(a, /^card:.*\|biz:.*bz/, '명함·등록증 두 갈래의 열쇠가 다 들어 있어야 합니다');
  const more = SRC.replace("put('fx', it.fax);", "put('fx', it.fax); put('zz', it.newField);");
  assert.notEqual(idxBox(more).idxShapeSig(), a, '★★ 칸을 늘려도 모양이 그대로면 옛 명함이 새 칸 없이 남습니다');
});
test('★★ 모양이 같으면 다시 안 만들고, 다르면 «차지한» PC 하나만 만든다', async () => {
  for (const [stored, want] of [['same', 0], ['old', 1]]) {
    let built = 0;
    const ctx = { console: { log() {}, warn() {} }, Object, String, Proxy, window: {},
      Store: { mode: 'firebase', db: { ref: () => ({ transaction: async (fn) => {
        fn(null); const sig = ctx.idxShapeSig(); const next = fn(stored === 'same' ? sig : 'card:n|biz:n');
        return next === undefined ? { committed: false } : { committed: true };
      }, set: async () => {} }) } },
      DB_ROOT: 'pucards', state: { items: { a: { id: 'a', name: '홍길동' } } },
      rebuildIdxCore: async () => { built++; return { put: 1 }; } };
    vm.createContext(ctx);
    vm.runInContext(['function idxRecord(', 'function idxShapeSig(', 'async function idxShapeCheck(']
      .map((h) => sliceFn(SRC, h)).join('\n'), ctx);
    await ctx.idxShapeCheck();
    assert.equal(built, want, stored === 'same' ? '★★ 모양이 같은데 6천 장을 다시 씁니다' : '★★ 칸이 바뀌었는데 다시 안 만듭니다');
  }
  assert.match(SRC, /setTimeout\(idxShapeCheck, \d+\)/, '★ 아무도 안 부르면 저절로가 아닙니다');
});

/* ══════ ④ 지난 메일 이어서 ══════ */
function fillBox(view) {
  const timers = [];
  const ctx = { console, Number, state: { view }, _mbFillBusy: false,
    setTimeout: (f) => { timers.push(f); return 0; }, mbBackfillRun() { ctx.calls = (ctx.calls || 0) + 1; } };
  vm.createContext(ctx);
  vm.runInContext('var MB_FILL_AUTO_MAX = 3, _mbFillAutoN = 0, _mbFillLastGot = -1;\n' + sliceFn(SRC, 'function mbFillAutoNext('), ctx);
  return { ctx, timers };
}
test('★★ 지난 메일은 «앞으로 나가는 동안»만 저절로 이어 간다 — 멈출 때를 지킨다', () => {
  let b = fillBox('mail');
  assert.equal(b.ctx.mbFillAutoNext({ ok: true, got: 100, done: false }, 3650), true, '앞으로 나갔으면 다음 회차를 부른다');
  assert.equal(b.ctx.mbFillAutoNext({ ok: true, got: 100, done: false }, 3650), false, '★★ 새로 담은 것이 없는데 또 돕니다(헛돎)');
  assert.equal(b.ctx.mbFillAutoNext({ ok: true, got: 300, done: true }, 3650), false, '다 찼으면 멈춘다');
  b = fillBox('mail');
  assert.equal(b.ctx.mbFillAutoNext({ ok: false, error: 'x', got: 5 }, 3650), false, '오류면 멈춘다');
  b = fillBox('list');
  assert.equal(b.ctx.mbFillAutoNext({ ok: true, got: 5 }, 3650), false, '★ 메일 화면을 떠났으면 멈춘다');
  b = fillBox('mail');
  let n = 0;
  for (let g = 1; g < 10; g++) if (b.ctx.mbFillAutoNext({ ok: true, got: g * 10 }, 3650)) n++;
  assert.equal(n, 3, '★ 정한 회차를 넘겨 끝없이 돌면 안 된다');
  const run = strip(sliceFn(SRC, 'function mbBackfillRun('));
  assert.match(run, /if\(!auto\)\{ _mbFillAutoN = 0; _mbFillLastGot = -1; \}/, '사람이 누르면 처음부터 센다');
  assert.match(run, /mbFillAutoNext\(state\.mbFill, goal\)/, '★ 회차가 끝나도 다음을 안 부릅니다');
});
