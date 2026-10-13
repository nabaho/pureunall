// 취업규칙(새) 「🏢 사업장」 표 — 거르기·순서·쪽 셈 (설계 §12). 이름은 가짜만.
// ★ 못 박는 규칙: 칸 안은 «또는», 칸끼리는 «그리고» · 한 곳이 확정·후보 둘 다면 두 값에 모두 속함 · 빈 값은 순서에서 맨 끝 · 쪽은 50곳
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/rules-v2/lib-sitecols.js');

const D = (n) => Date.UTC(2026, 0, 1) + n * 864e5;
function row(id, o) {
  return Object.assign({ id, name: id, size: 0, band: '', bizType: '', linked: 0, cand: 0, last: 0,
    fin: { state: '', at: 0, docId: '' }, mgr: '', subs: [] }, o || {});
}
const R = [
  row('가나상사', { size: 23, band: '10~29인', bizType: '제조업', linked: 2, last: D(300), fin: { state: 'set', at: 1 }, mgr: 'P-001' }),
  row('나다물산', { size: 8, band: '5~9인', bizType: '도소매', cand: 1, last: D(100), mgr: 'P-002' }),
  row('다라산업', { size: 0, band: '', bizType: '', linked: 1, cand: 2, last: D(-200), fin: { state: 'none', at: 0 }, mgr: '' }),
  row('라마전자', { size: 40, band: '30인 이상', bizType: '제조업' }),
];
const ids = (l) => l.map((r) => r.id);

test('한 곳이 확정·후보를 둘 다 가지면 두 값에 모두 속한다, 둘 다 없으면 「자료 없음」', () => {
  assert.deepEqual(S.tagsOf(R[2], 'docs').sort(), ['cand', 'linked']);
  assert.deepEqual(S.tagsOf(R[3], 'docs'), ['none']);
  assert.deepEqual(S.tagsOf(R[0], 'band'), ['10~29인']);
  assert.deepEqual(S.tagsOf(R[2], 'band'), ['']);
  assert.deepEqual(S.tagsOf(R[0], 'fin'), ['set']);
  assert.deepEqual(S.tagsOf(R[3], 'fin'), ['']);
  assert.equal(S.tagsOf(R[0], 'last')[0], '2026');     // 한국 시간 연도
  assert.deepEqual(S.tagsOf(R[3], 'last'), ['']);
  assert.deepEqual(S.tagsOf({ last: 'abc' }, 'last'), ['']);   // 숫자가 아닌 값은 NaN 이 아니라 빈 값
});

test('apply — 칸 안은 «또는», 칸끼리는 «그리고», 비면 안 건다', () => {
  assert.deepEqual(ids(S.apply(R, {})), ids(R));
  assert.deepEqual(ids(S.apply(R, { biz: [] })), ids(R));
  assert.deepEqual(ids(S.apply(R, { biz: ['제조업', '도소매'] })), ['가나상사', '나다물산', '라마전자']);
  assert.deepEqual(ids(S.apply(R, { biz: ['제조업'], band: ['10~29인'] })), ['가나상사']);
  assert.deepEqual(ids(S.apply(R, { docs: ['cand'] })), ['나다물산', '다라산업']);
  assert.deepEqual(ids(S.apply(R, { band: [''] })), ['다라산업']);
  assert.deepEqual(ids(S.apply(R, { biz: ['제조업'], band: ['10~29인'] }, 'band')), ['가나상사', '라마전자']);
});

test('options — 다른 칸 조건을 건 뒤 남은 곳에서 센다(그 칸 자신은 뺀다), 고른 값은 건수 0 이어도 남는다', () => {
  const o = S.options(R, 'biz', { band: ['10~29인'], biz: ['도소매'] });
  const m = Object.fromEntries(o.map((x) => [x.v, x.n]));
  assert.equal(m['제조업'], 1);
  assert.equal(m['도소매'], 0);                    // 고른 값 — 남는다
  const all = S.options(R, 'biz', {});
  assert.equal(all.find((x) => x.v === '').label, '(비어 있음)');
  const band = S.options(R, 'band', {});
  assert.deepEqual(band.map((x) => x.v), ['5인 미만', '5~9인', '10~29인', '30인 이상', ''].filter((v) => band.some((x) => x.v === v)));
  assert.ok(band.find((x) => x.v === '').label.length > 0);
  const fin = S.options(R, 'fin', {});
  assert.deepEqual(fin.map((x) => x.v).sort(), ['', 'none', 'set']);
  const last = S.options(R, 'last', {});
  assert.deepEqual(last.map((x) => x.v), ['2026', '2025', '']);     // 연도 내림차순, 비어 있음은 끝
});

test('sortRows — 안정, 빈 값·모름은 오름·내림 모두 맨 끝', () => {
  const nameOf = (s) => ({ 'P-001': '홍길동', 'P-002': '김보람' }[s] || s);
  assert.deepEqual(ids(S.sortRows(R, { key: 'size', dir: 'asc' }, nameOf)), ['나다물산', '가나상사', '라마전자', '다라산업']);
  assert.deepEqual(ids(S.sortRows(R, { key: 'size', dir: 'desc' }, nameOf)), ['라마전자', '가나상사', '나다물산', '다라산업']);
  assert.equal(ids(S.sortRows(R, { key: 'biz', dir: 'asc' }, nameOf)).pop(), '다라산업', '업태가 빈 곳은 끝');
  const who = ids(S.sortRows(R, { key: 'who', dir: 'asc' }, nameOf));
  assert.deepEqual(who.slice(0, 2), ['나다물산', '가나상사']);          // 김보람 < 홍길동, 담당 없음은 끝
  assert.deepEqual(ids(S.sortRows(R, { key: 'last', dir: 'desc' }, nameOf))[0], '가나상사');
  assert.deepEqual(ids(S.sortRows(R, { key: 'fin', dir: 'asc' }, nameOf)), ['가나상사', '다라산업', '나다물산', '라마전자']);   // 오름: 정함 → 미정 → 없음 (없음은 내림에서도 끝)
  assert.deepEqual(ids(S.sortRows(R, { key: 'fin', dir: 'desc' }, nameOf)), ['다라산업', '가나상사', '나다물산', '라마전자']);   // 내림: 미정 → 정함 → 없음(맨 끝)
  assert.deepEqual(ids(S.sortRows(R, null, nameOf)), ids(R), '순서를 안 정하면 그대로');
  assert.deepEqual(ids(S.sortRows(R, { key: 'name', dir: 'desc' }, nameOf))[0], '라마전자');
  const before = ids(R); S.sortRows(R, { key: 'name', dir: 'asc' }, nameOf); assert.deepEqual(ids(R), before, '원본을 안 바꾼다');
});

test('sortRows — 담당 이름을 못 찾으면(퇴사·모름 사번) 빈 값: 오름·내림 모두 맨 끝', () => {
  // P-999 는 목록에 없어 undefined, P-003 은 '' 를 돌려준다 — 둘 다 빈 값
  const nameOf = (s) => ({ 'P-001': '홍길동', 'P-002': '김보람', 'P-003': '' }[s]);
  const W = [
    row('x1', { mgr: 'P-999' }),
    row('x2', { mgr: 'P-003' }),
    row('x3', { mgr: 'P-002' }),
    row('x4', { mgr: 'P-001' }),
  ];
  assert.deepEqual(ids(S.sortRows(W, { key: 'who', dir: 'asc' }, nameOf)), ['x3', 'x4', 'x1', 'x2']);   // 김보람 < 홍길동, 빈 값 둘은 원래 차례로 끝
  assert.deepEqual(ids(S.sortRows(W, { key: 'who', dir: 'desc' }, nameOf)), ['x4', 'x3', 'x1', 'x2']);  // 내림에서도 빈 값은 끝
});

test('sortRows — 자료 0건(확정·후보 모두 없음)은 오름·내림 모두 맨 끝', () => {
  const D0 = [row('가', { linked: 0, cand: 0 }), row('나', { linked: 1 }), row('다', { cand: 2 })];
  assert.deepEqual(ids(S.sortRows(D0, { key: 'docs', dir: 'asc' })), ['나', '다', '가']);    // 1건 < 2건, 0건은 끝
  assert.deepEqual(ids(S.sortRows(D0, { key: 'docs', dir: 'desc' })), ['다', '나', '가']);   // 내림에서도 0건은 끝
});

test('page — 50곳, 경계, 없는 쪽은 당긴다, 비면 0', () => {
  const big = Array.from({ length: 289 }, (_, i) => ({ id: 'c' + i }));
  const p1 = S.page(big, 1), p6 = S.page(big, 6), p9 = S.page(big, 9);
  assert.equal(S.SIZE, 50);
  assert.deepEqual([p1.items.length, p1.pages, p1.from, p1.to, p1.total], [50, 6, 1, 50, 289]);
  assert.deepEqual([p6.items.length, p6.from, p6.to], [39, 251, 289]);
  assert.equal(p9.page, 6, '없는 쪽은 마지막 쪽');
  assert.equal(S.page(big, 0).page, 1);
  const e = S.page([], 3);
  assert.deepEqual([e.items.length, e.pages, e.from, e.to, e.page], [0, 1, 0, 0, 1]);
  assert.equal(S.page(big.slice(0, 50), 1).pages, 1);
  assert.equal(S.page(big.slice(0, 51), 1).pages, 2);
});

test('pageWindow — 7쪽까지 전부, 넘으면 처음·끝·둘레와 …', () => {
  assert.deepEqual(S.pageWindow(1, 6), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(S.pageWindow(1, 20), [1, 2, 3, 4, '…', 20]);
  assert.deepEqual(S.pageWindow(10, 20), [1, '…', 9, 10, 11, '…', 20]);
  assert.deepEqual(S.pageWindow(20, 20), [1, '…', 17, 18, 19, 20]);
  S.pageWindow(5, 20).forEach((x) => assert.ok(x === '…' || (x >= 1 && x <= 20)));
});

test('conditions — 걸린 칸마다 띠 글, 비면 없다', () => {
  assert.deepEqual(S.conditions({}), []);
  assert.deepEqual(S.conditions({ biz: [] }), []);
  const c = S.conditions({ biz: ['제조업', ''], band: ['10~29인'], docs: ['cand'], last: ['2026'], fin: ['set', ''] });
  const by = Object.fromEntries(c.map((x) => [x.key, x.text]));
  assert.equal(by.band, '규모: 10~29인');
  assert.match(by.biz, /^업태: 제조업, /);
  assert.match(by.biz, /비어 있음/);
  assert.equal(by.docs, '취업규칙 자료: 후보 있음');
  assert.equal(by.last, '최근: 2026');
  assert.match(by.fin, /^★최종본: 정함, /);
});
