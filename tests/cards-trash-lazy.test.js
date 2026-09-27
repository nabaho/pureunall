'use strict';
/* 휴지통 0.71MB 를 «열 때» 읽는다 — 부팅 때가 아니다 (대표 지시 2026-09-18 「휴지통도 줄여라」)
   ─────────────────────────────────────────────────────────────────────────
   2026-08-18 에 휴지통 «구독»은 끊었다. 그런데 «한 번 읽기»가 남아 있었고 그 한 번이 0.71MB 다.
   평소에 들여다보는 자리가 아닌데 기업정보함을 켤 때마다 받고 있었다.

   못 박는 것
     ① 부팅 자리에서 휴지통을 읽지 않는다
     ② 휴지통 화면을 열면 그때 읽는다
     ③ 30일 자동 정리는 «하루 한 번»만 — 그때만 읽는다
     ④ 아직 모를 때 「0건」이라 하지 않는다 (거짓말이다)
     ⑤ 지우거나 되살리면 다시 읽을 것으로 표시한다 — 방금 지운 것이 안 보이면 안 된다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const SRC = stripJs(fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8'));

/* 가짜 서버에 물려 loadTrash / trashCount 를 실제로 돌린다 */
function load(val) {
  const reads = [];
  const ctx = {
    console, Object, JSON, Promise, Date, Number, String,
    DB_ROOT: 'pucards',
    Store: { mode: 'firebase', db: { ref: p => ({
      once: () => { reads.push(p); return Promise.resolve({ val: () => val }); }
    }) } },
    state: { trash: {} },
    renderSoon: () => {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(SRC.indexOf('let _trashLoaded = false'), SRC.indexOf('function openTrash()')), ctx);
  return { ctx, reads };
}
const tick = () => new Promise(r => setImmediate(() => setImmediate(r)));

test('①★★ 부팅 자리에서 휴지통을 «읽지 않는다» — 0.71MB 를 켤 때마다 받던 자리', () => {
  const boot = SRC.slice(SRC.indexOf('const subscribe = (seed, ckpt) =>'),
                         SRC.indexOf("watchCardMap(this.db.ref(DB_ROOT+'/classifyRules')"));
  assert.ok(boot.indexOf("ref(DB_ROOT+'/trash').once('value')") < 0,
    '★★ 부팅 자리에서 휴지통을 통째로 읽습니다 — 켤 때마다 0.71MB 입니다');
});

test('②★ 휴지통 화면을 열면 그때 읽는다 — 서류 기록과 같은 방식', () => {
  const fn = SRC.slice(SRC.indexOf('function openTrash()'), SRC.indexOf('function openTrash()') + 400);
  assert.match(fn, /if\(!_trashLoaded\)\{ loadTrash\(\(\)=>openTrash\(\)\); return; \}/,
    '★ 안 읽고 열면 「휴지통이 비어 있습니다」라고 거짓말을 합니다');
});

test('②★ 읽기는 «한 번»만 — 여러 곳이 불러도 서버는 한 번만 다녀온다', async () => {
  const { ctx, reads } = load({ a: { id: 'a' }, b: { id: 'b' } });
  ctx.loadTrash(); ctx.loadTrash(); ctx.trashCount();
  await tick();
  assert.deepStrictEqual(reads, ['pucards/trash'], '★ 0.71MB 를 여러 번 받습니다');
  assert.equal(ctx.trashCount(), 2, '읽은 뒤에는 실제 건수를 말해야 합니다');
  ctx.trashCount(); ctx.trashCount();
  await tick();
  assert.equal(reads.length, 1, '★ 읽은 뒤에도 또 받습니다');
});

test('④★ 아직 모를 때 「0건」이라 하지 않는다 — 0 은 「비었다」로 읽힌다', async () => {
  const { ctx } = load({ a: { id: 'a' } });
  assert.equal(ctx.trashCount(), null, '★★ 안 읽었는데 0 이라 하면 「휴지통이 비었다」는 거짓말입니다');
  await tick();
  assert.equal(ctx.trashCount(), 1);
});

test('④ 화면은 모를 때 «…» 로 적는다', () => {
  assert.match(SRC, /const trashN = \(_tn === null\) \? '…' : _tn;/,
    '★ 모르는 것을 숫자로 적으면 사람이 그 숫자를 믿습니다');
});

test('③★ 30일 정리는 «하루 한 번»만 — 그때만 휴지통을 읽는다', () => {
  const boot = SRC.slice(SRC.indexOf('if(!Store._trashPurgeDone){'),
                         SRC.indexOf('if(!Store._trashPurgeDone){') + 700);
  assert.match(boot, /pucards_trash_purge_at/, '★ 언제 정리했는지 안 적으면 켤 때마다 읽습니다');
  assert.match(boot, /Date\.now\(\) - _plast > 20\*3600\*1000/, '★ 하루 한 번이 아닙니다');
  assert.match(boot, /loadTrash\(function\(\)\{/, '★ 정리하려면 휴지통을 읽어야 합니다');
  assert.match(boot, /purgeTrash\(\);/, '★ 30일 지난 것이 영영 안 지워집니다');
});

test('⑤★ 지우거나 되살리면 다시 읽을 것으로 표시한다', () => {
  /* ⚠ 글자 수로 자르지 않는다 — 1600자를 자르면 바로 뒤 hardDel 까지 들어와,
     del 에서 표시를 빼도 검사가 통과했다(2026-09-18 이빨 확인에서 실제로 그랬다). */
  const del = SRC.slice(SRC.indexOf('async del(id){'), SRC.indexOf('hardDel(id){'));
  assert.ok(del.length > 200 && del.length < 3000, '자른 구간이 이상합니다: ' + del.length);
  assert.match(del, /_trashLoaded = false;/, '★ 방금 지운 것이 휴지통에 안 보입니다');
  const hard = SRC.slice(SRC.indexOf('hardDel(id){'), SRC.indexOf('hardDel(id){') + 500);
  assert.match(hard, /_trashLoaded = false;/, '★ 영구삭제한 것이 목록에 남습니다');
  const res = SRC.slice(SRC.indexOf('async restore(id){'), SRC.indexOf('async restore(id){') + 1200);
  assert.match(res, /_trashLoaded = false;/, '★ 되살린 것이 휴지통에 그대로 남아 보입니다');
});

test('★ 못 읽어도 화면이 멎지 않는다 — 기다리던 쪽을 놓아 준다', async () => {
  const reads = [];
  const ctx = {
    console, Object, JSON, Promise, Date, Number, String,
    DB_ROOT: 'pucards',
    Store: { mode: 'firebase', db: { ref: p => ({
      once: () => { reads.push(p); return Promise.reject(new Error('권한 없음')); }
    }) } },
    state: { trash: {} }, renderSoon: () => {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(SRC.indexOf('let _trashLoaded = false'), SRC.indexOf('function openTrash()')), ctx);
  let came = false;
  ctx.loadTrash(() => { came = true; });
  await tick();
  assert.equal(came, true, '★★ 못 읽었다고 기다리던 쪽을 안 놓으면 휴지통 화면이 영영 안 열립니다');
});
