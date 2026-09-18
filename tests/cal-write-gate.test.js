/* 푸른 캘린더의 «저장 관문» — 여섯 가지를 하나씩 되돌려 본다
   ═══════════════════════════════════════════════════════════════════════════
   ★ 왜 이 검사가 있는가
     일정·근태의 주인은 이알피다. 푸른 캘린더가 그 칸에 «다른 규칙»으로 쓰면
     두 앱이 서로를 덮는다. 그리고 그 손해는 화면이 아니라 **급여에서** 드러난다.

     막아야 할 여섯 가지는 전부 이 저장소가 «실제로 겪은» 자리다:
       ① 번호 없는 항목 → 표가 통째 저장으로 떨어지고 두 기기가 서로를 덮었다
       ② 금지문자 → 엉뚱한 경로에 쓴다
       ③ 마감된 달 → 마감 뒤 근태가 바뀌면 급여가 틀어진다(옮기는 것도 막아야 한다)
       ④ 아직 배열인 표 → v/{번호} 를 쓰면 배열에 글자 열쇠가 섞여 표가 깨진다
       ⑤ 통째 덮어쓰기 → 두 사람이 다른 칸을 고쳐도 나중 사람이 앞사람을 되돌렸다
       ⑥ 번호를 안 보냄 → 서버에 «본문에 번호 없는 껍데기»가 생긴다 (①로 이어진다)

   ★ 무엇을 지키나 — «관문이 있는가»이지 «지금 글자가 무엇인가»가 아니다.
     알림 문구는 못 박지 않는다(다듬어도 안 깨지게). 막느냐 마느냐만 본다.

   ⚠ 걸리면 지울 것이 아니라 고칠 것이다 — 관문을 도로 세우면 된다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
global.PuWork = require(path.join(ROOT, 'js', 'pu-work-core.js'));

/* 가짜 서버 — 무엇을 보냈는지 그대로 받아 둔다 */
function 가짜서버() {
  const 보낸것 = [];
  return {
    보낸것,
    ref() { return { update(u) { 보낸것.push(u); return Promise.resolve(); } }; }
  };
}
/* 지도형 표 하나(이미 번호가 열쇠) */
const 지도형 = { 'att-1': { id: 'att-1', date: '2026-09-15', type: 'leave' } };
/* 아직 배열인 표 */
const 배열형 = { 0: { id: 'att-1' }, 1: { id: 'att-2' } };

function 붙이기(opts) {
  const s = 가짜서버();
  W.attach(s, Object.assign({
    lockedMonths: [],
    formOf: () => 지도형,
    who: () => '홍길동'
  }, opts || {}));
  return s;
}

// ── ① 번호 ────────────────────────────────────────────────────────────
test('① 번호 없는 항목은 저장하지 않는다', async () => {
  const s = 붙이기();
  const r = await W.save('attendance_records', { date: '2026-09-15', type: 'leave' });
  assert.equal(r.ok, false, '번호 없이 저장됐습니다');
  assert.equal(s.보낸것.length, 0, '거절했는데 서버로 보냈습니다');
});

// ── ② 금지문자 ────────────────────────────────────────────────────────
test('② 번호에 경로 글자가 있으면 저장하지 않는다', async () => {
  const s = 붙이기();
  for (const 나쁜번호 of ['a/b', 'a.b', 'a#b', 'a$b', 'a[b', 'a]b']) {
    const r = await W.save('attendance_records', { id: 나쁜번호, date: '2026-09-15' });
    assert.equal(r.ok, false, 나쁜번호 + ' 가 지나갔습니다');
  }
  assert.equal(s.보낸것.length, 0);
});

test('② 칸 이름에 경로 글자가 있어도 저장하지 않는다', async () => {
  const s = 붙이기();
  const r = await W.save('attendance_records', { id: 'att-9', 'a.b': 1, date: '2026-09-15' });
  assert.equal(r.ok, false);
  assert.equal(s.보낸것.length, 0);
});

// ── ③ 마감 자물쇠 ─────────────────────────────────────────────────────
test('③ 마감된 달에는 못 쓴다', async () => {
  const s = 붙이기({ lockedMonths: ['2026-08'] });
  const r = await W.save('attendance_records', { id: 'att-9', date: '2026-08-15', type: 'leave' });
  assert.equal(r.ok, false, '마감된 달에 저장됐습니다');
  assert.equal(s.보낸것.length, 0);
});

test('③ 마감된 달에서 «빼내는 것»도 막는다 — 옮기기도 그 달을 고치는 일이다', async () => {
  const s = 붙이기({ lockedMonths: ['2026-08'] });
  const r = await W.save('attendance_records',
    { id: 'att-9', date: '2026-09-02', type: 'leave' },      // 안 잠긴 달로 옮기려 한다
    { id: 'att-9', date: '2026-08-31', type: 'leave' });     // 원래는 잠긴 달에 있었다
  assert.equal(r.ok, false, '잠긴 달에서 빼냈습니다');
  assert.equal(s.보낸것.length, 0);
});

test('③ 마감 안 된 달은 지나간다', async () => {
  const s = 붙이기({ lockedMonths: ['2026-08'] });
  const r = await W.save('attendance_records', { id: 'att-9', date: '2026-09-15', type: 'leave' });
  assert.equal(r.ok, true, r.message);
  assert.equal(s.보낸것.length, 1);
});

test('③ 날짜 없는 기록은 막지 않는다 — 막으면 영영 못 고친다', async () => {
  const s = 붙이기({ lockedMonths: ['2026-08', '2026-09'] });
  const r = await W.save('my_schedules', { id: 'sch-9', title: '가나상사 상담' });
  assert.equal(r.ok, true, r.message);
});

test('③ 근태표가 아닌 표는 마감 자물쇠 대상이 아니다', async () => {
  const s = 붙이기({ lockedMonths: ['2026-09'] });
  const r = await W.save('my_schedules', { id: 'sch-9', date: '2026-09-15', title: '가나상사' });
  assert.equal(r.ok, true, r.message);
});

// ── ④ 표의 생김새 ─────────────────────────────────────────────────────
test('④ 아직 배열인 표에는 쓰지 않는다 — 쓰면 표가 깨진다', async () => {
  const s = 붙이기({ formOf: () => 배열형 });
  const r = await W.save('attendance_records', { id: 'att-9', date: '2026-09-15', type: 'leave' });
  assert.equal(r.ok, false, '배열인 표에 글자 열쇠를 썼습니다');
  assert.equal(s.보낸것.length, 0);
});

test('④ 아직 아무것도 없는 표에도 쓰지 않는다 — 생김새를 모른다', async () => {
  const s = 붙이기({ formOf: () => null });
  const r = await W.save('attendance_records', { id: 'att-9', date: '2026-09-15' });
  assert.equal(r.ok, false);
  assert.equal(s.보낸것.length, 0);
});

test('④ 생김새 보는 눈 자체가 맞는가', () => {
  assert.equal(W.isMapForm({ 'att-1': {} }), true);
  assert.equal(W.isMapForm({ 0: {}, 1: {} }), false);
  assert.equal(W.isMapForm([]), false);
  assert.equal(W.isMapForm({}), false);
  assert.equal(W.isMapForm(null), false);
});

// ── ⑤ 바뀐 칸만 ───────────────────────────────────────────────────────
test('⑤ 안 바뀐 칸은 안 보낸다 — 남이 그 칸을 고쳤으면 되돌아간다', async () => {
  const s = 붙이기();
  await W.save('attendance_records',
    { id: 'att-1', date: '2026-09-15', type: 'leave', note: '새 메모' },
    { id: 'att-1', date: '2026-09-15', type: 'leave', note: '옛 메모' });
  const u = s.보낸것[0];
  const 보낸칸 = Object.keys(u).filter(k => k.indexOf('/v/') >= 0).map(k => k.split('/v/')[1]);
  assert.ok(보낸칸.indexOf('att-1/note') >= 0, '바뀐 칸을 안 보냈습니다');
  assert.ok(보낸칸.indexOf('att-1/type') < 0, '안 바뀐 칸을 보냈습니다 — 남의 손질을 되돌립니다');
  assert.ok(보낸칸.indexOf('att-1/date') < 0, '안 바뀐 칸을 보냈습니다');
});

test('⑤ 레코드를 통째로 덮지 않는다', async () => {
  const s = 붙이기();
  await W.save('attendance_records', { id: 'att-1', date: '2026-09-15', type: 'leave' });
  const u = s.보낸것[0];
  assert.ok(!('data/attendance_records/v/att-1' in u),
    '레코드를 통째로 덮었습니다 — 칸별로 보내야 합니다');
});

// ── ⑥ 번호 그물 ───────────────────────────────────────────────────────
test('⑥ 번호를 «늘» 함께 보낸다 — 이 한 줄이 껍데기를 막는다', async () => {
  const s = 붙이기();
  await W.save('attendance_records',
    { id: 'att-1', note: '메모만 고침' },
    { id: 'att-1', note: '옛것' });
  const u = s.보낸것[0];
  assert.equal(u['data/attendance_records/v/att-1/id'], 'att-1',
    '번호를 안 보냈습니다 — 서버에 본문 없는 껍데기가 생깁니다');
});

test('⑥ 칸을 하나도 안 고쳤어도 번호는 간다', () => {
  const p = W.fieldPaths('att-1', { note: '같음' }, { note: '같음' });
  assert.deepStrictEqual(Object.keys(p), ['att-1/id']);
});

// ── 곁들여 지켜야 할 것 ───────────────────────────────────────────────
test('표의 «시각»(u)을 함께 올린다 — 다른 화면이 바뀐 줄 알아야 한다', async () => {
  const s = 붙이기();
  await W.save('attendance_records', { id: 'att-1', date: '2026-09-15' });
  assert.ok('data/attendance_records/u' in s.보낸것[0], '표 시각을 안 올렸습니다');
});

test('누가 고쳤는지 남긴다', async () => {
  const s = 붙이기();
  await W.save('attendance_records', { id: 'att-1', date: '2026-09-15' });
  const u = s.보낸것[0];
  assert.equal(u['data/attendance_records/v/att-1/updatedBy'], '홍길동');
  assert.ok(u['data/attendance_records/v/att-1/updatedAt'] > 0);
});

test('지우기는 그 자리만 비운다 — 표를 통째로 다시 쓰지 않는다', async () => {
  const s = 붙이기();
  const r = await W.remove('attendance_records', 'att-1', { id: 'att-1', date: '2026-09-15' });
  assert.equal(r.ok, true, r.message);
  assert.strictEqual(s.보낸것[0]['data/attendance_records/v/att-1'], null);
});

test('지우기도 마감 자물쇠를 지난다', async () => {
  const s = 붙이기({ lockedMonths: ['2026-09'] });
  const r = await W.remove('attendance_records', 'att-1', { id: 'att-1', date: '2026-09-15' });
  assert.equal(r.ok, false, '마감된 달의 기록이 지워졌습니다');
  assert.equal(s.보낸것.length, 0);
});

test('새 번호는 겹치지 않는다', () => {
  const 본것 = new Set();
  for (let i = 0; i < 500; i++) 본것.add(W.newId('att'));
  assert.equal(본것.size, 500);
  assert.ok(!W.BADKEY.test(W.newId('att')), '지어 준 번호에 금지문자가 들어 있습니다');
});

// ── 이알피와 같은 금지문자인가 ────────────────────────────────────────
test('금지문자 규칙이 이알피와 같다 — 다르면 한쪽만 통과하는 번호가 생긴다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const m = src.match(/_REC_BADKEY\s*=\s*(\/[^\n]+?\/)\s*;/);
  assert.ok(m, '이알피에서 _REC_BADKEY 를 못 찾았습니다');
  const 이알피 = new RegExp(m[1].slice(1, -1));
  '.#$[]/ '.split('').concat(['a', '1', '-', '_']).forEach((c) => {
    assert.equal(W.BADKEY.test(c), 이알피.test(c), '「' + c + '」 에서 갈립니다');
  });
});
