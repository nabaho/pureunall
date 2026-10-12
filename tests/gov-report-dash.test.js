'use strict';
/* 컨설팅보고서 앱 — 사업별 대시보드 순수 모듈 PuGovReportDash (2026-10-12, UI 재정리 2단계)
 * ★ 지키는 것: 칸 상태 6가지(done·doing·blocked·none·na·unknown) · na·unknown 은 분모에 안 넣는다 ·
 *   간단형 ①② 의 todo(미작성)는 «미착수»이지 막힘이 아니다 · 기록을 못 읽었으면(trackKnown:false) 가짜 0%/100% 없이 전부 unknown ·
 *   열 전체가 na 면 total 0(나눗셈 없음) · 기한 = 지난 것 포함 14일 안(끝난 업체 제외) · 보드는 대형만, 다음 단계 열에 한 장씩 ·
 *   읽기만 한다(받은 값을 바꾸지 않는다)
 * 공개 저장소다 — 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/pu-gov-report-dash.js');

const TODAY = '2026-10-12';
const O = { trackKnown: true, today: TODAY, soonDays: 14 };

/* 대형 칸 하나 — chip 이 있으면 st 를 같이 준다(Track.bigCells 의 모양) */
function bc(id, st, step) {
  const key = { done: 'done', doing: 'draft', blocked: 'todo', none: 'wait', na: '' }[st];
  return { id, name: '단계' + id, step: step || 'report', chip: st === 'na' ? null : { txt: st, key }, st: st === 'na' ? 'none' : st };
}
/* 대형 업체 줄 — states 는 단계(a,b,c) 순서 */
function bigLine(coId, coName, states, next, due) {
  return { coId, coName, typeId: 'ta', year: 2026, rid: 'r-' + coId, rounds: 2, planned: 3,
    cells: states.map((s, i) => bc('abc'[i], s)), due: due === undefined ? '' : due, next };
}
function bigTable(lines) {
  return { plan: { key: 'big', kind: '대형', items: [{ id: 'a', name: '단계a' }, { id: 'b', name: '단계b' }, { id: 'c', name: '단계c' }] },
    auto: false, big: true, cols: ['단계a', '단계b', '단계c'], lines };
}
/* 간단형 업체 줄 — ①②(chips) ③④⑤(기록 칸 또는 「—」) */
const DASH = { txt: '—', key: '' };
function autoLine(coId, coName, cells, due) {
  return { coId, coName, typeId: 'tb', year: 2026, rid: 'r-' + coId, rounds: 1, planned: 1, cells, due: due || '' };
}
function autoTable(lines) {
  return { plan: { key: 'simple', kind: '간단' }, auto: true, cols: ['①', '②', '③', '④', '⑤'], lines };
}
const rec = (st) => ({ step: 'sign', st, txt: st, key: '' });
const clone = (v) => JSON.parse(JSON.stringify(v));

/* ---------- cellState ---------- */
test('cellState — 대형 칸: chip null = na · 칩 있으면 st 를 따른다', () => {
  const ctx = { auto: false, idx: 0, trackKnown: true };
  assert.equal(P.cellState({ id: 'a', chip: null, st: 'none' }, ctx), 'na');
  assert.equal(P.cellState({ id: 'a', chip: { txt: '●', key: 'done' }, st: 'done' }, ctx), 'done');
  assert.equal(P.cellState({ id: 'a', chip: { txt: '◐', key: 'draft' }, st: 'doing' }, ctx), 'doing');
  assert.equal(P.cellState({ id: 'a', chip: { txt: '✕', key: 'todo' }, st: 'blocked' }, ctx), 'blocked');
  assert.equal(P.cellState({ id: 'a', chip: { txt: '○', key: 'wait' }, st: 'none' }, ctx), 'none');
});
test('cellState — 기록을 못 읽었으면(trackKnown:false) 어떤 칸이든 unknown', () => {
  assert.equal(P.cellState({ id: 'a', chip: { key: 'done' }, st: 'done' }, { auto: false, idx: 0, trackKnown: false }), 'unknown');
  assert.equal(P.cellState({ id: 'a', chip: null, st: 'none' }, { auto: false, idx: 0, trackKnown: false }), 'unknown');
  assert.equal(P.cellState({ txt: '미작성', key: 'todo' }, { auto: true, idx: 0, trackKnown: false }), 'unknown');
  assert.equal(P.cellState(DASH, { auto: true, idx: 3, trackKnown: false }), 'unknown');
});
test('cellState — 간단형 ①②: todo(미작성)는 none(막힘 아님) · draft = doing · done = done · 「—」 = none', () => {
  const c = (idx) => ({ auto: true, idx, trackKnown: true });
  assert.equal(P.cellState({ key: 'todo', txt: '미작성' }, c(0)), 'none');
  assert.equal(P.cellState({ key: 'draft', txt: '작성 중' }, c(0)), 'doing');
  assert.equal(P.cellState({ key: 'done', txt: '✓' }, c(0)), 'done');
  assert.equal(P.cellState({ key: 'done', txt: '제출' }, c(1)), 'done');
  assert.equal(P.cellState(DASH, c(1)), 'none');
  assert.equal(P.cellState({ key: 'todo', txt: '미작성' }, c(1)), 'none');
});
test('cellState — 간단형 ③④⑤: st 가 있으면 그것 · 「—」 는 기록을 읽었으면 na', () => {
  const c = (idx, known) => ({ auto: true, idx, trackKnown: known === undefined ? true : known });
  assert.equal(P.cellState({ st: 'blocked' }, c(2)), 'blocked');
  assert.equal(P.cellState(rec('doing'), c(2)), 'doing');
  assert.equal(P.cellState(rec('done'), c(3)), 'done');
  assert.equal(P.cellState(rec('none'), c(4)), 'none');
  assert.equal(P.cellState(rec('na'), c(3)), 'na');
  assert.equal(P.cellState(DASH, c(3, true)), 'na');
  assert.equal(P.cellState(DASH, c(3, false)), 'unknown');
});
test('cellState — 이상한 칸·ctx 는 던지지 않고 unknown', () => {
  assert.equal(P.cellState(null, { auto: true, idx: 0, trackKnown: true }), 'unknown');
  assert.equal(P.cellState(undefined, { auto: true, idx: 2, trackKnown: true }), 'unknown');
  assert.doesNotThrow(() => P.cellState({}, undefined));
  assert.ok(P.STATE.indexOf(P.cellState({ st: 'zzz' }, { auto: true, idx: 2, trackKnown: true })) >= 0);
});
test('STATE — 여섯 가지', () => {
  assert.deepEqual(P.STATE, ['done', 'doing', 'blocked', 'none', 'na', 'unknown']);
});

/* ---------- dueDays ---------- */
test('dueDays — due − today 일 수(지남 = 음수) · 잘못된 날짜·빈 값은 null', () => {
  assert.equal(P.dueDays('2026-10-20', TODAY), 8);
  assert.equal(P.dueDays('2026-10-12', TODAY), 0);
  assert.equal(P.dueDays('2026-10-01', TODAY), -11);
  assert.equal(P.dueDays('2027-01-01', '2026-12-31'), 1);   // 해 넘김
  assert.equal(P.dueDays('', TODAY), null);
  assert.equal(P.dueDays(null, TODAY), null);
  assert.equal(P.dueDays(undefined, TODAY), null);
  assert.equal(P.dueDays('2026-13-40', TODAY), null);
  assert.equal(P.dueDays('2026-02-30', TODAY), null);
  assert.equal(P.dueDays('내일', TODAY), null);
  assert.equal(P.dueDays('2026-10-20', ''), null);
  assert.equal(P.dueDays('2026-10-20', 'x'), null);
});

/* ---------- summarize — 대형 ---------- */
function big3() {
  return bigTable([
    bigLine('c1', '가나상사', ['done', 'blocked', 'none'], { id: 'b', name: '단계b' }, '2026-12-31'),
    bigLine('c2', '다라정밀', ['done', 'done', 'done'], null, '2026-10-13'),
    bigLine('c3', '마바공업', ['done', 'doing', 'none'], { id: 'b', name: '단계b' }, '2026-10-20'),
  ]);
}
test('summarize 대형 — 열 집계 합 = 업체 수 · kpi · 막힌 업체 blockedN ≥ 1', () => {
  const s = P.summarize(big3(), O);
  assert.equal(s.known, true);
  assert.equal(s.kind, 'big');
  assert.deepEqual(s.cols.map((c) => c.name), ['단계a', '단계b', '단계c']);
  s.cols.forEach((c) => { assert.equal(c.done + c.doing + c.blocked + c.none, c.total); assert.equal(c.total, 3); });
  assert.deepEqual(s.cols[0], { name: '단계a', done: 3, doing: 0, blocked: 0, none: 0, total: 3 });
  assert.deepEqual(s.cols[1], { name: '단계b', done: 1, doing: 1, blocked: 1, none: 0, total: 3 });
  assert.deepEqual(s.cols[2], { name: '단계c', done: 1, doing: 0, blocked: 0, none: 2, total: 3 });
  assert.deepEqual(s.kpi, { n: 3, blocked: 1, soon: 1, finished: 1 });   // 가나 막힘 · 마바 기한 8일 안 · 다라 끝남(기한 임박해도 제외)
  const by = {}; s.lines.forEach((l) => { by[l.coId] = l; });
  assert.deepEqual(by.c1.states, ['done', 'blocked', 'none']);
  assert.equal(by.c1.blockedN, 1);
  assert.equal(by.c1.finished, false);
  assert.equal(by.c2.finished, true);
  assert.equal(by.c2.blockedN, 0);
  assert.equal(by.c3.blockedN, 0);
  assert.equal(by.c1.coName, '가나상사');
  assert.equal(by.c1.typeId, 'ta');
  assert.equal(by.c1.rounds, 2);
  assert.equal(by.c1.planned, 3);
  assert.deepEqual(by.c1.next, { id: 'b', name: '단계b' });
  assert.equal(by.c2.next, null);
});
test('summarize — 막힌 칸이 둘이어도 막힌 업체는 한 곳으로 센다(blockedN = 칸 수)', () => {
  const t = bigTable([bigLine('c1', '가나상사', ['blocked', 'blocked', 'none'], { id: 'a', name: '단계a' })]);
  const s = P.summarize(t, O);
  assert.equal(s.lines[0].blockedN, 2);
  assert.equal(s.kpi.blocked, 1);
});

/* ---------- summarize — 기한 ---------- */
test('summarize 기한 — 14일 안(지남 포함) soon · 먼 기한·끝난 업체·빈 기한은 아님', () => {
  const t = bigTable([
    bigLine('c1', '가나상사', ['doing', 'none', 'none'], null, '2026-10-20'),
    bigLine('c2', '다라정밀', ['doing', 'none', 'none'], null, '2026-10-01'),
    bigLine('c3', '마바공업', ['doing', 'none', 'none'], null, '2026-12-31'),
    bigLine('c4', '바사기업', ['done', 'done', 'done'], null, '2026-10-13'),
    bigLine('c5', '아자제조', ['doing', 'none', 'none'], null, ''),
    bigLine('c6', '차카산업', ['doing', 'none', 'none'], null, '2026-10-26'),   // 정확히 14일
    bigLine('c7', '타파전자', ['doing', 'none', 'none'], null, '2026-10-27'),   // 15일
  ]);
  const by = {}; P.summarize(t, O).lines.forEach((l) => { by[l.coId] = l; });
  assert.equal(by.c1.dueDays, 8);   assert.equal(by.c1.soon, true);
  assert.equal(by.c2.dueDays, -11); assert.equal(by.c2.soon, true);
  assert.equal(by.c3.soon, false);
  assert.equal(by.c4.finished, true); assert.equal(by.c4.dueDays, 1); assert.equal(by.c4.soon, false);
  assert.equal(by.c5.dueDays, null); assert.equal(by.c5.soon, false);
  assert.equal(by.c6.dueDays, 14); assert.equal(by.c6.soon, true);
  assert.equal(by.c7.dueDays, 15); assert.equal(by.c7.soon, false);
  assert.equal(P.summarize(t, O).kpi.soon, 3);
});
test('summarize — soonDays 를 안 주면 14', () => {
  const t = bigTable([bigLine('c1', '가나상사', ['doing', 'none', 'none'], null, '2026-10-26')]);
  assert.equal(P.summarize(t, { trackKnown: true, today: TODAY }).lines[0].soon, true);
  assert.equal(P.summarize(t, { trackKnown: true, today: TODAY, soonDays: 3 }).lines[0].soon, false);
});

/* ---------- summarize — 간단형 ---------- */
function simpleSet() {
  return autoTable([
    autoLine('c1', '가나상사', [{ key: 'todo', txt: '미작성' }, DASH, DASH, DASH, DASH]),
    autoLine('c2', '다라정밀', [{ txt: '✓', key: 'done' }, { txt: '제출', key: 'done' }, rec('done'), DASH, rec('blocked')]),
  ]);
}
test('summarize 간단형 — kind auto · ①② todo 는 막힘 아님 · ④ 「—」 는 na', () => {
  const s = P.summarize(simpleSet(), O);
  assert.equal(s.kind, 'auto');
  assert.equal(s.known, true);
  assert.deepEqual(s.lines[0].states, ['none', 'none', 'na', 'na', 'na']);
  assert.equal(s.lines[0].blockedN, 0);
  assert.deepEqual(s.lines[1].states, ['done', 'done', 'done', 'na', 'blocked']);
  assert.equal(s.lines[1].blockedN, 1);
  assert.deepEqual(s.kpi, { n: 2, blocked: 1, soon: 0, finished: 0 });
  assert.deepEqual(s.cols[0], { name: '①', done: 1, doing: 0, blocked: 0, none: 1, total: 2 });
  assert.equal(s.lines[0].next, undefined);   // 간단형 줄에는 next 가 없다
});
test('summarize — 열 전체가 na(기술보호 ③)면 total 0 · 던지지 않는다', () => {
  const t = autoTable([
    autoLine('c1', '가나상사', [{ txt: '✓', key: 'done' }, { txt: '제출', key: 'done' }, DASH, rec('doing'), rec('none')]),
    autoLine('c2', '다라정밀', [{ key: 'draft', txt: '작성 중' }, DASH, DASH, rec('done'), rec('none')]),
  ]);
  let s;
  assert.doesNotThrow(() => { s = P.summarize(t, O); });
  assert.deepEqual(s.cols[2], { name: '③', done: 0, doing: 0, blocked: 0, none: 0, total: 0 });
  assert.equal(s.cols[3].total, 2);
});
test('summarize — 판정 가능한 칸이 없으면(전부 na) 끝난 업체가 아니다', () => {
  const t = bigTable([bigLine('c1', '가나상사', ['na', 'na', 'na'], null)]);
  const s = P.summarize(t, O);
  assert.equal(s.lines[0].finished, false);
  assert.equal(s.kpi.finished, 0);
});
test('summarize — na 는 건너뛰고 나머지가 전부 done 이면 끝난 업체', () => {
  const t = bigTable([bigLine('c1', '가나상사', ['done', 'na', 'done'], null)]);
  assert.equal(P.summarize(t, O).lines[0].finished, true);
});

/* ---------- summarize — 기록 못 읽음 · 빈 입력 ---------- */
test('summarize — trackKnown:false: known false · 전부 unknown · total 0 · 막힘 0 · n 은 업체 수', () => {
  const s = P.summarize(big3(), { trackKnown: false, today: TODAY });
  assert.equal(s.known, false);
  s.lines.forEach((l) => { assert.deepEqual(l.states, ['unknown', 'unknown', 'unknown']); assert.equal(l.blockedN, 0); assert.equal(l.finished, false); });
  s.cols.forEach((c) => assert.deepEqual([c.done, c.doing, c.blocked, c.none, c.total], [0, 0, 0, 0, 0]));
  assert.equal(s.kpi.n, 3);
  assert.equal(s.kpi.blocked, 0);
  assert.equal(s.kpi.finished, 0);
  const a = P.summarize(simpleSet(), { trackKnown: false, today: TODAY });
  assert.equal(a.known, false);
  assert.equal(a.kpi.n, 2);
  assert.ok(a.lines.every((l) => l.states.every((x) => x === 'unknown')));
});
test('summarize — trackKnown 를 안 주면 못 읽은 것으로 본다(가짜 현황을 그리지 않는다)', () => {
  const s = P.summarize(big3(), { today: TODAY });
  assert.equal(s.known, false);
  assert.equal(s.kpi.blocked, 0);
});
test('summarize — lines [] 는 kpi.n 0 · table null/undefined 는 빈 요약(던지지 않는다)', () => {
  let s = P.summarize(bigTable([]), O);
  assert.equal(s.kpi.n, 0);
  assert.deepEqual(s.lines, []);
  assert.deepEqual(s.cols.map((c) => c.total), [0, 0, 0]);
  [null, undefined, {}, 'x', 7].forEach((bad) => {
    assert.doesNotThrow(() => { s = P.summarize(bad, O); });
    assert.equal(s.kpi.n, 0);
    assert.deepEqual(s.lines, []);
    assert.deepEqual(s.cols, []);
  });
  assert.doesNotThrow(() => P.summarize(big3()));   // o 없음
});
test('summarize — 칸이 모자란 줄·cells 가 없는 줄도 던지지 않는다', () => {
  const t = bigTable([{ coId: 'c1', coName: '가나상사', typeId: 'ta', cells: null }, { coId: 'c2', coName: '다라정밀', typeId: 'ta', cells: [bc('a', 'done')] }]);
  let s;
  assert.doesNotThrow(() => { s = P.summarize(t, O); });
  assert.equal(s.lines[0].states.length, 3);
  assert.equal(s.lines[1].states.length, 3);
  assert.equal(s.lines[1].states[0], 'done');
  assert.equal(s.lines[1].states[2], 'unknown');
});

/* ---------- board ---------- */
test('board — 열 순서 = table.cols + 모두 끝 · next 따라 한 장씩 · next null = 모두 끝', () => {
  const t = big3();
  const b = P.board(t, P.summarize(t, O));
  assert.deepEqual(b.cols.map((c) => c.name), ['단계a', '단계b', '단계c', '모두 끝']);
  assert.deepEqual(b.cols.map((c) => c.id), ['a', 'b', 'c', '__done']);
  const ids = (id) => b.cols.find((c) => c.id === id).cards.map((x) => x.coId);
  assert.deepEqual(ids('a'), []);
  assert.deepEqual(ids('b'), ['c1', 'c3']);   // 가나상사 < 마바공업
  assert.deepEqual(ids('c'), []);
  assert.deepEqual(ids('__done'), ['c2']);
  assert.equal(b.cols.reduce((n, c) => n + c.cards.length, 0), 3);
});
test('board — 카드 모양: blockedN·rounds·planned·due·dueDays · cell = 그 열 칸이 칩을 가졌으면 {step,id}', () => {
  const t = big3();
  const b = P.board(t, P.summarize(t, O));
  const card = b.cols[1].cards[0];
  assert.deepEqual(Object.keys(card).sort(), ['blockedN', 'cell', 'coId', 'coName', 'dueDays', 'due', 'planned', 'rounds', 'typeId'].sort());
  assert.equal(card.coId, 'c1');
  assert.equal(card.typeId, 'ta');
  assert.equal(card.coName, '가나상사');
  assert.equal(card.blockedN, 1);
  assert.equal(card.rounds, 2);
  assert.equal(card.planned, 3);
  assert.equal(card.due, '2026-12-31');
  assert.equal(card.dueDays, 80);
  assert.deepEqual(card.cell, { step: 'report', id: 'b' });
  assert.equal(b.cols[3].cards[0].cell, null);   // 모두 끝 열
});
test('board — 다음 단계 칸에 칩이 없으면(회차·달 0) cell null', () => {
  const t = bigTable([bigLine('c1', '가나상사', ['done', 'na', 'none'], { id: 'b', name: '단계b' })]);
  const b = P.board(t, P.summarize(t, O));
  assert.equal(b.cols[1].cards[0].cell, null);
});
test('board — next undefined(속성은 있으나 값 없음)면 기록 미확인 열이 생긴다 · 그 업체가 없으면 열이 없다', () => {
  const t = bigTable([
    bigLine('c1', '가나상사', ['none', 'none', 'none'], undefined),
    bigLine('c2', '다라정밀', ['done', 'done', 'done'], null),
  ]);
  const b = P.board(t, P.summarize(t, { trackKnown: false, today: TODAY }));
  assert.deepEqual(b.cols.map((c) => c.id), ['a', 'b', 'c', '__done', '__unknown']);
  assert.equal(b.cols[4].name, '기록 미확인');
  assert.deepEqual(b.cols[4].cards.map((x) => x.coId), ['c1', 'c2'].slice(0, 1));
  assert.equal(b.cols[4].cards[0].cell, null);
  const b2 = P.board(big3(), P.summarize(big3(), O));
  assert.ok(!b2.cols.some((c) => c.id === '__unknown'));
});
test('board — 모르는 단계 id 를 가리키는 next 는 기록 미확인으로 모은다', () => {
  const t = bigTable([bigLine('c1', '가나상사', ['none', 'none', 'none'], { id: 'zz', name: '엉뚱' })]);
  const b = P.board(t, P.summarize(t, O));
  assert.deepEqual(b.cols.map((c) => c.id), ['a', 'b', 'c', '__done', '__unknown']);
  assert.equal(b.cols[4].cards.length, 1);
});
test('board — 열 안 순서 = 이름 가나다(ko) · 이름이 같으면 입력 순서(안정)', () => {
  const nx = { id: 'a', name: '단계a' };
  const t = bigTable([
    bigLine('c4', '마바공업', ['none', 'none', 'none'], nx),
    bigLine('c2', '가나상사', ['none', 'none', 'none'], nx),
    bigLine('c3', '가나상사', ['none', 'none', 'none'], nx),
    bigLine('c1', '다라정밀', ['none', 'none', 'none'], nx),
    bigLine('c5', '가나상사', ['none', 'none', 'none'], nx),
  ]);
  const b = P.board(t, P.summarize(t, O));
  assert.deepEqual(b.cols[0].cards.map((x) => x.coId), ['c2', 'c3', 'c5', 'c1', 'c4']);
  const again = P.board(t, P.summarize(t, O));
  assert.deepEqual(again, b);
});
test('board — 간단형·틀 없음·빈 입력은 {cols:[]}', () => {
  assert.deepEqual(P.board(simpleSet(), P.summarize(simpleSet(), O)), { cols: [] });
  assert.deepEqual(P.board(null, null), { cols: [] });
  assert.deepEqual(P.board(undefined, undefined), { cols: [] });
  assert.deepEqual(P.board({}, {}), { cols: [] });
});
test('board — 업체가 0 인 대형 table 은 단계 열 + 모두 끝(기록 미확인 없음)', () => {
  const t = bigTable([]);
  const b = P.board(t, P.summarize(t, O));
  assert.deepEqual(b.cols.map((c) => c.id), ['a', 'b', 'c', '__done']);
});
test('board — summary 를 안 줘도 던지지 않는다', () => {
  assert.doesNotThrow(() => P.board(big3()));
  assert.equal(P.board(big3()).cols.length, 4);
});

/* ---------- blockedCounts ---------- */
test('blockedCounts — typeId 별 업체 수 · 같은 업체·사업 중복은 한 번', () => {
  const al = [
    { coId: 'c1', typeId: 'ta', coName: '가나상사', typeName: 'A', items: [{ name: 'x', note: '' }] },
    { coId: 'c2', typeId: 'ta', coName: '다라정밀', typeName: 'A', items: [{ name: 'y', note: '' }] },
    { coId: 'c2', typeId: 'ta', coName: '다라정밀', typeName: 'A', items: [{ name: 'z', note: '' }] },
    { coId: 'c1', typeId: 'tb', coName: '가나상사', typeName: 'B', items: [{ name: 'x', note: '' }] },
  ];
  assert.deepEqual(P.blockedCounts(al), { ta: 2, tb: 1 });
});
test('blockedCounts — 빈/잘못된 입력은 {} · 이상한 항목은 건너뛴다', () => {
  assert.deepEqual(P.blockedCounts([]), {});
  assert.deepEqual(P.blockedCounts(null), {});
  assert.deepEqual(P.blockedCounts(undefined), {});
  assert.deepEqual(P.blockedCounts('x'), {});
  assert.deepEqual(P.blockedCounts({}), {});
  assert.deepEqual(P.blockedCounts([null, 3, {}, { coId: 'c1' }, { typeId: 'ta' }]), {});
  assert.deepEqual(P.blockedCounts([null, { coId: 'c1', typeId: 'ta' }]), { ta: 1 });
});
test('blockedCounts — 프로토타입을 건드리는 typeId 에도 오염 없음', () => {
  const r = P.blockedCounts([{ coId: 'c1', typeId: '__proto__' }, { coId: 'c1', typeId: 'constructor' }]);
  assert.equal(Object.getPrototypeOf({}).c1, undefined);
  assert.equal(({}).polluted, undefined);
  assert.ok(typeof r === 'object');
});

/* ---------- 불변 ---------- */
test('입력 불변 — 같은 table 을 두 번 넣어도 같은 결과 · 원본 안 바뀜', () => {
  [big3(), simpleSet()].forEach((t) => {
    const before = JSON.stringify(t);
    const s1 = P.summarize(t, O), s2 = P.summarize(t, O);
    assert.equal(JSON.stringify(s1), JSON.stringify(s2));
    assert.equal(JSON.stringify(t), before);
    const b1 = P.board(t, s1), b2 = P.board(t, s1);
    assert.equal(JSON.stringify(b1), JSON.stringify(b2));
    assert.equal(JSON.stringify(t), before);
    const sBefore = JSON.stringify(s1);
    P.board(t, s1);
    assert.equal(JSON.stringify(s1), sBefore);
  });
  const al = [{ coId: 'c1', typeId: 'ta' }, { coId: 'c1', typeId: 'ta' }];
  const alBefore = JSON.stringify(al);
  P.blockedCounts(al);
  assert.equal(JSON.stringify(al), alBefore);
  const o = clone(O);
  P.summarize(big3(), o);
  assert.deepEqual(o, O);
});
test('결과가 입력과 객체를 공유하지 않는다 — 결과를 고쳐도 table 이 안 바뀐다', () => {
  const t = big3();
  const before = JSON.stringify(t);
  const s = P.summarize(t, O);
  s.lines[0].next.name = '바뀜';
  s.lines[0].states.push('x');
  const b = P.board(t, P.summarize(t, O));
  b.cols[1].cards[0].cell.id = '바뀜';
  assert.equal(JSON.stringify(t), before);
});

/* ---------- 진짜 docsTable 출력과 맞물린다(입력 모양의 근거) ---------- */
test('PuGovReportDocs.docsTable 출력 — 대형·간단형·기술보호(③ 없음)·기록 못 읽음', () => {
  const D = require('../js/pu-gov-report-docs.js');
  const sd = (id, coId, typeId, date) => ({ id, coId, typeId, date, round: 1, isField: true });
  const input = {
    types: [{ id: 'ta', name: '합성 ta', rounds: 2 }, { id: 'tb', name: '합성 tb', rounds: 1 }, { id: 'tf', name: '합성 tf', rounds: 1 }],
    cos: [{ id: 'c1', name: '가나상사', types: ['ta', 'tb', 'tf'] }, { id: 'c2', name: '다라정밀', types: ['ta'] }],
    scheds: [sd('s1', 'c1', 'ta', '2026-03-05'), sd('s2', 'c2', 'ta', '2026-04-09'), sd('s3', 'c1', 'tb', '2026-05-05'), sd('s4', 'c1', 'tf', '2026-06-05')],
    staff: [],
  };
  const tbl = (name, typeId, track) => D.docsTable({ erp: { name, code: 'X' }, typeId, input, year: 2026, rows: [], track, consultings: [], tmap: {}, biz: [], today: TODAY });
  const bigT = tbl('산업일자리전환컨설팅충남', 'ta', {});
  const bigBefore = JSON.stringify(bigT);
  const bs = P.summarize(bigT, O);
  assert.equal(bs.kind, 'big');
  assert.equal(bs.kpi.n, 2);
  bs.cols.forEach((c) => assert.equal(c.total, 2));
  const bb = P.board(bigT, bs);
  assert.deepEqual(bb.cols.map((c) => c.id), ['log', 'monthly', 'result', 'after', '__done']);
  assert.equal(bb.cols[0].cards.length, 2);
  assert.deepEqual(bb.cols[0].cards[0].cell, { step: 'plat', id: 'log' });
  assert.equal(JSON.stringify(bigT), bigBefore);
  /* 기록을 못 받음(track 없음) — next 가 undefined 라 전부 기록 미확인 */
  const noTrack = tbl('산업일자리전환컨설팅충남', 'ta', null);
  const ns = P.summarize(noTrack, { trackKnown: false, today: TODAY });
  assert.equal(ns.known, false);
  assert.equal(ns.kpi.n, 2);
  assert.ok(ns.cols.every((c) => c.total === 0));
  assert.deepEqual(P.board(noTrack, ns).cols.map((c) => c.id).slice(-2), ['__done', '__unknown']);
  /* 간단형 — ①② 는 「—」 → none, ③ 기록 칸은 st 를 따른다 */
  const simple = P.summarize(tbl('인사노무컨설팅충남북부상의', 'tb', {}), O);
  assert.equal(simple.kind, 'auto');
  assert.deepEqual(simple.lines[0].states, ['none', 'none', 'none', 'none', 'none']);
  /* 기술보호 — ③ 은 틀에 없어 열 전체가 na → total 0 */
  const tg = P.summarize(tbl('기술보호컨설팅', 'tf', {}), O);
  assert.equal(tg.cols[2].total, 0);
  assert.equal(tg.cols[3].total, 1);
});
