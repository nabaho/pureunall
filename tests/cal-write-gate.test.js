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

/* 가짜 서버 — 무엇을 보냈는지 그대로 받아 둔다.
   ★ 실시간DB 처럼 군다: 거래(transaction)는 «찬 자리»라 먼저 null 로 부르고,
     서버에 값이 있으면 그 값으로 한 번 더 부른다(rtdb-transaction-cold-abort).
   2026-09-27 — 저장이 칸별 update 에서 «레코드 한 건 거래»로 바뀌었다
   (칸별 update 는 온톨로지 관문이 통째로 거절해 한 번도 서버에 안 닿았다). */
function 가짜서버(처음) {
  const 보낸것 = [];
  const 서버 = Object.assign({}, 처음 || {});
  function ref(p) {
    return {
      update(u) { 보낸것.push(Object.assign({ __kind: 'update', __path: p }, u)); return Promise.resolve(); },
      set(v) { 보낸것.push({ __kind: 'set', __path: p, v: v }); 서버[p] = v; return Promise.resolve(); },
      transaction(fn) {
        let v = fn(null);
        if (서버[p] !== undefined) v = fn(JSON.parse(JSON.stringify(서버[p])));
        if (v === undefined) return Promise.resolve({ committed: false });
        서버[p] = v;
        보낸것.push({ __kind: 'transaction', __path: p, v: v });
        return Promise.resolve({ committed: true, snapshot: { val: () => v } });
      }
    };
  }
  return { 보낸것, 서버, ref };
}
const 자리 = (id) => 'data/attendance_records/v/' + id;
/* 지도형 표 하나(이미 번호가 열쇠) */
const 지도형 = { 'att-1': { id: 'att-1', date: '2026-09-15', type: 'leave' } };
/* 아직 배열인 표 */
const 배열형 = { 0: { id: 'att-1' }, 1: { id: 'att-2' } };

function 붙이기(opts, 처음) {
  const s = 가짜서버(처음);
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
  assert.ok(s.보낸것.some((x) => x.__kind === 'transaction'), '마감 안 된 달인데 안 썼습니다');
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
test('⑤ 안 바뀐 칸은 안 건드린다 — 남이 그 칸을 고쳤으면 그대로 남는다', async () => {
  /* 화면은 type:leave 를 들고 있는데, 그사이 이알피에서 누가 반차로 고쳤다 */
  const s = 붙이기({}, { [자리('att-1')]: { id: 'att-1', date: '2026-09-15', type: 'halfday-am', note: '옛 메모' } });
  const r = await W.save('attendance_records',
    { id: 'att-1', date: '2026-09-15', type: 'leave', note: '새 메모' },
    { id: 'att-1', date: '2026-09-15', type: 'leave', note: '옛 메모' });
  assert.equal(r.ok, true, r.message);
  const 결과 = s.서버[자리('att-1')];
  assert.equal(결과.note, '새 메모', '바뀐 칸을 안 썼습니다');
  assert.equal(결과.type, 'halfday-am', '안 바뀐 칸을 덮었습니다 — 남의 손질을 되돌립니다');
});

test('⑤ 서버에만 있는 칸을 지우지 않는다 — 통째로 덮지 않는다', async () => {
  const s = 붙이기({}, { [자리('att-1')]: { id: 'att-1', date: '2026-09-15', type: 'leave', gcalEventId: 'g1' } });
  await W.save('attendance_records', { id: 'att-1', date: '2026-09-16' }, { id: 'att-1', date: '2026-09-15' });
  const 결과 = s.서버[자리('att-1')];
  assert.equal(결과.date, '2026-09-16');
  assert.equal(결과.gcalEventId, 'g1', '화면이 모르는 칸(구글 번호)이 지워졌습니다');
});

// ── ⑥ 번호 그물 ───────────────────────────────────────────────────────
test('⑥ 번호를 «늘» 함께 쓴다 — 이 한 줄이 껍데기를 막는다', async () => {
  const s = 붙이기();
  await W.save('attendance_records', { id: 'att-1', note: '메모만 고침' }, { id: 'att-1', note: '옛것' });
  assert.equal(s.서버[자리('att-1')].id, 'att-1', '번호를 안 썼습니다 — 서버에 본문 없는 껍데기가 생깁니다');
});

test('⑥ 칸을 하나도 안 고쳤어도 번호는 붙고, 서버 값은 그대로다', () => {
  const r = W.overlay('att-1', { note: '같음' }, { note: '같음' }, { note: '서버에서 고침' });
  assert.deepStrictEqual(r, { note: '서버에서 고침', id: 'att-1' });
});

test('★ 새것은 «서버에 없어야» 쓴다 — 같은 번호가 이미 있으면 덮지 않고 멈춘다', async () => {
  const s = 붙이기({}, { [자리('att-1')]: { id: 'att-1', date: '2026-09-15', type: 'leave', sid: 'P-001' } });
  const r = await W.save('attendance_records', { id: 'att-1', date: '2026-09-20', type: 'eum-work', sid: 'P-002' }, null);
  assert.equal(r.ok, false, '이미 있는 번호를 새것으로 덮었습니다');
  assert.equal(s.서버[자리('att-1')].sid, 'P-001', '남의 기록이 바뀌었습니다');
});

test('★★ 온톨로지 관문(강제 모드)을 «실제로» 지난다 — 2026-09-27 까지 달력 저장이 전부 여기서 막혔다', async () => {
  /* 푸른 캘린더는 새 프로그램이라 관문이 강제(enforce)다. 칸별 update 는
     「수정차수를 검증할 수 없다」며 거절됐다 — 가짜 서버를 진짜 관문으로 감싸 본다. */
  const OW = require(path.join(ROOT, 'js', 'pu-ontology-write.js'));
  const 속 = 가짜서버({ [자리('att-1')]: { id: 'att-1', date: '2026-09-15', type: 'leave', sid: 'P-001' } });
  const fb = { database() { return { ref: (p) => 속.ref(p) }; } };
  assert.equal(OW.installFirebaseCompat(fb, { mode: 'enforce', program: 'cal' }), true);
  W.attach(fb.database(), { lockedMonths: [], formOf: () => 지도형, who: () => '홍길동' });
  const 고침 = await W.save('attendance_records', { id: 'att-1', date: '2026-09-16' }, { id: 'att-1', date: '2026-09-15' });
  assert.equal(고침.ok, true, '관문이 고치기를 거절합니다: ' + 고침.message);
  const 새것 = await W.save('attendance_records',
    { id: 'att-2', date: '2026-09-17', type: 'eum-work', sid: 'P-001', hours: 8, note: '' }, null);
  assert.equal(새것.ok, true, '관문이 넣기를 거절합니다: ' + 새것.message);
  const r2 = 속.서버[자리('att-2')];
  assert.equal(r2.entityType, 'ScheduleEvent', '개체 종류를 안 붙였습니다');
  assert.ok(r2.revision >= 1 && r2.createdAt > 0, '수정차수·생성 시각이 없습니다');
});

// ── 곁들여 지켜야 할 것 ───────────────────────────────────────────────
test('표의 «시각»(u)을 함께 올린다 — 다른 화면이 바뀐 줄 알아야 한다', async () => {
  const s = 붙이기();
  await W.save('attendance_records', { id: 'att-1', date: '2026-09-15' });
  assert.ok(s.보낸것.some((x) => x.__kind === 'set' && x.__path === 'data/attendance_records/u' && x.v > 0),
    '표 시각을 안 올렸습니다');
});

test('누가 고쳤는지 남긴다', async () => {
  const s = 붙이기();
  await W.save('attendance_records', { id: 'att-1', date: '2026-09-15' });
  const 결과 = s.서버[자리('att-1')];
  assert.equal(결과.updatedBy, '홍길동');
  assert.ok(결과.updatedAt > 0);
});

/* 2026-09-27 — 지우기는 칸을 비우지 않고 «삭제표시»를 남긴다(온톨로지 규칙: 물리 삭제 금지).
   표시 붙은 줄은 읽는 쪽이 모두 뺀다 — tests/deleted-mark-hidden.test.js 가 그쪽을 지킨다. */
test('지우기는 «삭제표시»를 남긴다 — 칸을 비우지 않고, 그 한 건만 건드린다', async () => {
  const s = 붙이기({}, { [자리('att-1')]: { id: 'att-1', date: '2026-09-15', type: 'leave', sid: 'P-001', gcalEventId: 'g1' } });
  const r = await W.remove('attendance_records', 'att-1', { id: 'att-1', date: '2026-09-15' });
  assert.equal(r.ok, true, r.message);
  const 결과 = s.서버[자리('att-1')];
  assert.ok(결과, '서버에서 통째로 지웠습니다 — 표시만 남겨야 합니다');
  assert.equal(결과._deleted, true, '삭제표시가 없습니다');
  assert.ok(결과.deletedAt > 0 && 결과.deletedBy === '홍길동', '언제·누가 지웠는지가 없습니다');
  assert.equal(결과.gcalEventId, 'g1', '다른 칸이 사라졌습니다');
  assert.ok(!s.보낸것.some((x) => x.__kind === 'update'), '칸 비우기(update)를 보냈습니다 — 관문이 거절합니다');
});

test('★★ 지우기도 온톨로지 관문(강제)을 «실제로» 지난다', async () => {
  const OW = require(path.join(ROOT, 'js', 'pu-ontology-write.js'));
  const 속 = 가짜서버({ [자리('att-1')]: { id: 'att-1', date: '2026-09-15', type: 'leave', sid: 'P-001' } });
  const fb = { database() { return { ref: (p) => 속.ref(p) }; } };
  OW.installFirebaseCompat(fb, { mode: 'enforce', program: 'cal' });
  W.attach(fb.database(), { lockedMonths: [], formOf: () => 지도형, who: () => '홍길동' });
  const r = await W.remove('attendance_records', 'att-1', { id: 'att-1', date: '2026-09-15' });
  assert.equal(r.ok, true, '관문이 지우기를 거절합니다: ' + r.message);
  assert.equal(속.서버[자리('att-1')]._deleted, true);
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
