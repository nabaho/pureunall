'use strict';
/* 컨설팅보고서 앱 — 「오늘 할 일」 첫 화면 순수 모듈 PuGovReportToday (2026-10-12, UI 재정리 3단계 Task 1)
 * ★ 지키는 것: 문구 표(6종 title·meta·tags·days) · 묶음 hot/mid/low · 같은 업체·사업은 가장 급한 종류 한 줄 ·
 *   soon 은 0~7일 포함·8일·지남(−1)·끝난 업체 제외 · 기록을 못 읽으면(known:false) blocked·waitSign·overdue·soon 0줄 ·
 *   정렬(급한 순 → 가나다 → 입력 순서)·days:null 은 맨 뒤 · 빈 typeName·같은 이름 두 업체에도 던지지 않는다 ·
 *   입력 불변·결과가 입력과 객체를 나눠 쓰지 않는다 · stripOf(막대 비율 합 100·known:false → bar:null) · more(경계)
 * 공개 저장소다 — 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/pu-gov-report-today.js');

const TODAY = '2026-10-12';
const clone = (v) => JSON.parse(JSON.stringify(v));

/* 현황판 줄(List 의 행) — 필요한 칸만 */
function row(coId, coName, typeId, typeName, days) {
  return { coId, coName, typeId, typeName, st: { days } };
}
/* 대시보드 업체 줄 — Dash.summarize().lines 에 typeName·bizName 을 붙인 꼴 */
function line(coId, coName, typeId, typeName, dueDays, o) {
  o = o || {};
  const due = o.due || '2026-10-20';
  return { coId, coName, typeId, typeName, bizName: o.bizName === undefined ? typeName + '사업' : o.bizName,
    dueDays, finished: !!o.finished, due };
}
function input(o) {
  return Object.assign({ alerts: { unwritten: [], staleDraft: [] }, extra: { waitSign: [], overdue: [] }, blocked: [], lines: [],
    known: true, today: TODAY, soonDays: 7 }, o || {});
}
const ids = (list) => list.map((t) => t.coId + '|' + t.typeId);

/* ---------- 상수 ---------- */
test('LEVELS·KINDS — 묶음 순서와 종류 우선순위', () => {
  assert.deepEqual(P.LEVELS, ['hot', 'mid', 'low']);
  assert.deepEqual(P.KINDS, ['overdue', 'blocked', 'unwritten', 'waitSign', 'soon', 'staleDraft']);
});

/* ---------- 문구 표 ---------- */
test('문구 표 — overdue: 제목·근거·딱지·days(양수, today−due)·hot', () => {
  const r = P.build(input({ extra: { waitSign: [], overdue: [{ row: row('c1', '가나상사', 't1', '수행형', null), due: '2026-10-09' }] },
    lines: [line('c1', '가나상사', 't1', '수행형', -3, { bizName: '혁신 성장 컨설팅' })] }));
  assert.equal(r.hot.length, 1);
  const t = r.hot[0];
  assert.equal(t.kind, 'overdue'); assert.equal(t.level, 'hot');
  assert.equal(t.title, '가나상사 · 제출 기한이 지났습니다');
  assert.equal(t.meta, '수행형 · 기한 2026-10-09 (3일 지남)');
  assert.deepEqual(t.tags, ['혁신 성장 컨설팅', '제출']);
  assert.equal(t.days, 3);
  assert.equal(t.id, 'overdue|c1|t1');
  assert.deepEqual([t.coId, t.typeId, t.coName, t.typeName], ['c1', 't1', '가나상사', '수행형']);
});
test('문구 표 — blocked: 단계 하나·메모 있음/없음', () => {
  const b = (items) => P.build(input({ blocked: [{ coId: 'c2', typeId: 't2', coName: '다라정밀', typeName: '대형', items }] })).hot[0];
  const a = b([{ name: '수행계획서', note: '서명 대기' }]);
  assert.equal(a.kind, 'blocked'); assert.equal(a.level, 'hot');
  assert.equal(a.title, '다라정밀 · 수행계획서이(가) 막혀 있습니다');
  assert.equal(a.meta, '대형 · «서명 대기»');
  assert.deepEqual(a.tags, ['대형', '막힘']);
  assert.equal(a.days, null);
  assert.equal(b([{ name: '수행계획서', note: '' }]).meta, '대형');
});
test('문구 표 — blocked: 단계가 여럿이면 첫 단계 + « 외 n»', () => {
  const t = P.build(input({ blocked: [{ coId: 'c2', typeId: 't2', coName: '다라정밀', typeName: '대형',
    items: [{ name: '수행계획서', note: '첫 메모' }, { name: '중간보고', note: '둘째' }, { name: '결과보고', note: '' }] }] })).hot[0];
  assert.equal(t.title, '다라정밀 · 수행계획서 외 2이(가) 막혀 있습니다');
  assert.equal(t.meta, '대형 · «첫 메모»');
});
test('문구 표 — unwritten: 종료 후 n일 · hot', () => {
  const t = P.build(input({ alerts: { unwritten: [row('c3', '마바전자', 't3', '간단형', 21)], staleDraft: [] } })).hot[0];
  assert.equal(t.kind, 'unwritten'); assert.equal(t.level, 'hot');
  assert.equal(t.title, '마바전자 · 보고서를 아직 안 썼습니다');
  assert.equal(t.meta, '간단형 · 종료 후 21일');
  assert.deepEqual(t.tags, ['간단형', '미작성']);
  assert.equal(t.days, 21);
});
test('문구 표 — waitSign: 회신 n일째 · mid', () => {
  const t = P.build(input({ extra: { waitSign: [{ row: row('c4', '사아물산', 't4', '간단형', null), days: 9 }], overdue: [] } })).mid[0];
  assert.equal(t.kind, 'waitSign'); assert.equal(t.level, 'mid');
  assert.equal(t.title, '사아물산 · 서명 회신을 기다리는 중입니다');
  assert.equal(t.meta, '간단형 · 회신 9일째');
  assert.deepEqual(t.tags, ['간단형', '서명 대기']);
  assert.equal(t.days, 9);
});
test('문구 표 — soon: 계약 종료 {due} (D-n) · 0일이면 「오늘 종료」 · mid', () => {
  const r = P.build(input({ lines: [line('c5', '자차건설', 't5', '간단형', 3, { due: '2026-10-15', bizName: '현장 클리닉' }),
    line('c6', '카타설비', 't5', '간단형', 0, { due: TODAY, bizName: '현장 클리닉' })] }));
  assert.equal(r.mid.length, 2);
  const t3 = r.mid.find((t) => t.coId === 'c5'), t0 = r.mid.find((t) => t.coId === 'c6');
  assert.equal(t3.kind, 'soon'); assert.equal(t3.level, 'mid');
  assert.equal(t3.title, '자차건설 · 기한이 가깝습니다');
  assert.equal(t3.meta, '간단형 · 계약 종료 2026-10-15 (D-3)');
  assert.deepEqual(t3.tags, ['현장 클리닉', '기한 임박']);
  assert.equal(t3.days, 3);
  assert.equal(t0.meta, '간단형 · 오늘 종료');
  assert.equal(t0.days, 0);
});
test('문구 표 — staleDraft: n일 전 고침 · low', () => {
  const r = P.build(input({ alerts: { unwritten: [], staleDraft: [row('c7', '파하식품', 't7', '간단형', 12)] } }));
  assert.equal(r.low.length, 1);
  const t = r.low[0];
  assert.equal(t.kind, 'staleDraft'); assert.equal(t.level, 'low');
  assert.equal(t.title, '파하식품 · 초안이 오래 묵었습니다');
  assert.equal(t.meta, '간단형 · 12일 전 고침');
  assert.deepEqual(t.tags, ['간단형', '초안']);
  assert.equal(t.days, 12);
});
test('tags — bizName 이 있으면 그것, 없으면 typeName (알림 행은 줄의 사업 이름을 typeId 로 찾는다)', () => {
  const r = P.build(input({ alerts: { unwritten: [row('c1', '가나상사', 't1', '간단형', 20)], staleDraft: [] },
    lines: [line('c9', '하타기계', 't1', '간단형', 30, { bizName: '큰 사업 이름' })] }));
  assert.deepEqual(r.hot[0].tags, ['큰 사업 이름', '미작성']);
  const r2 = P.build(input({ alerts: { unwritten: [row('c1', '가나상사', 't1', '간단형', 20)], staleDraft: [] },
    lines: [line('c9', '하타기계', 't1', '간단형', 30, { bizName: '' })] }));
  assert.deepEqual(r2.hot[0].tags, ['간단형', '미작성']);
});

/* ---------- 묶음·합계 ---------- */
test('묶음 — hot(overdue·blocked·unwritten) / mid(waitSign·soon) / low(staleDraft), total = 세 묶음 합', () => {
  const r = P.build(input({
    alerts: { unwritten: [row('a1', '가', 'T', '사업', 30)], staleDraft: [row('a2', '나', 'T', '사업', 10)] },
    extra: { waitSign: [{ row: row('a3', '다', 'T', '사업', null), days: 8 }], overdue: [{ row: row('a4', '라', 'T', '사업', null), due: '2026-10-01' }] },
    blocked: [{ coId: 'a5', typeId: 'T', coName: '마', typeName: '사업', items: [{ name: 'x', note: '' }] }],
    lines: [line('a6', '바', 'T', '사업', 5)] }));
  assert.deepEqual(r.hot.map((t) => t.kind).sort(), ['blocked', 'overdue', 'unwritten']);
  assert.deepEqual(r.mid.map((t) => t.kind).sort(), ['soon', 'waitSign']);
  assert.deepEqual(r.low.map((t) => t.kind), ['staleDraft']);
  assert.equal(r.total, 6);
  assert.deepEqual(Object.keys(r).sort(), ['hot', 'low', 'mid', 'total']);
});
test('빈 입력 — 던지지 않고 빈 묶음 · total 0 (undefined·null·이상한 모양 포함)', () => {
  const empty = { hot: [], mid: [], low: [], total: 0 };
  assert.deepEqual(P.build(input()), empty);
  assert.deepEqual(P.build(undefined), empty);
  assert.deepEqual(P.build(null), empty);
  assert.deepEqual(P.build({}), empty);
  assert.deepEqual(P.build({ alerts: 3, extra: 'x', blocked: {}, lines: null, known: true, today: TODAY }), empty);
  assert.deepEqual(P.build(input({ blocked: [null, 5, 'a'], lines: [null, 7], alerts: { unwritten: [null], staleDraft: [undefined] },
    extra: { waitSign: [null, {}], overdue: [null, {}] } })).total, 0);
});

/* ---------- 중복 제거 ---------- */
test('중복 — 막힘 + 서명 대기 + 기한 임박 + 초안 이 한 업체·사업이면 막힘 한 줄만', () => {
  const co = ['c1', '가나상사', 't1', '대형'];
  const r = P.build(input({
    blocked: [{ coId: 'c1', typeId: 't1', coName: '가나상사', typeName: '대형', items: [{ name: '수행계획서', note: '' }] }],
    extra: { waitSign: [{ row: row(...co, null), days: 9 }], overdue: [] },
    alerts: { unwritten: [], staleDraft: [row(...co, 10)] },
    lines: [line('c1', '가나상사', 't1', '대형', 2)] }));
  assert.equal(r.total, 1);
  assert.equal(r.hot.length, 1);
  assert.equal(r.hot[0].kind, 'blocked');
  assert.equal(r.mid.length, 0); assert.equal(r.low.length, 0);
});
test('중복 — 우선순위: overdue > blocked > unwritten > waitSign > soon > staleDraft', () => {
  const co = ['c1', '가나상사', 't1', '대형'];
  const all = {
    overdue: { extra: { waitSign: [], overdue: [{ row: row(...co, null), due: '2026-10-01' }] } },
    blocked: { blocked: [{ coId: 'c1', typeId: 't1', coName: '가나상사', typeName: '대형', items: [{ name: 'x', note: '' }] }] },
    unwritten: { alerts: { unwritten: [row(...co, 20)], staleDraft: [] } },
    waitSign: { extra: { waitSign: [{ row: row(...co, null), days: 9 }], overdue: [] } },
    soon: { lines: [line('c1', '가나상사', 't1', '대형', 4)] },
    staleDraft: { alerts: { unwritten: [], staleDraft: [row(...co, 10)] } } };
  P.KINDS.forEach((k, i) => {
    // k 와 그 뒤 종류들을 전부 넣으면 k 만 남는다
    const merged = Object.assign({}, ...P.KINDS.slice(i).map((x) => all[x]));
    // 같은 키(alerts·extra)는 뒤 것이 덮으므로 따로 합친다
    merged.alerts = { unwritten: i <= 2 ? all.unwritten.alerts.unwritten : [], staleDraft: all.staleDraft.alerts.staleDraft };
    merged.extra = { waitSign: i <= 3 ? all.waitSign.extra.waitSign : [], overdue: i <= 0 ? all.overdue.extra.overdue : [] };
    const r = P.build(input(merged));
    const flat = [].concat(r.hot, r.mid, r.low);
    assert.equal(flat.length, 1, k);
    assert.equal(flat[0].kind, k);
  });
});
test('중복 — 같은 업체라도 사업(typeId)이 다르면 각각 한 줄, 같은 사업이라도 업체가 다르면 각각 한 줄', () => {
  const r = P.build(input({ alerts: { unwritten: [row('c1', '가나상사', 't1', 'A', 20), row('c1', '가나상사', 't2', 'B', 20), row('c2', '다라정밀', 't1', 'A', 20)],
    staleDraft: [] } }));
  assert.equal(r.hot.length, 3);
});
test('중복 — 같은 알림 안의 같은 쌍이 두 번 와도 한 줄', () => {
  const r = P.build(input({ alerts: { unwritten: [row('c1', '가나상사', 't1', 'A', 20), row('c1', '가나상사', 't1', 'A', 20)], staleDraft: [] } }));
  assert.equal(r.hot.length, 1);
});

/* ---------- soon 경계 ---------- */
test('soon — 0·7일은 포함, 8일·지남(−1)·모름(null) 제외', () => {
  const lines = [0, 1, 7, 8, -1, 30, null].map((d, i) => line('c' + i, '업체' + i, 't1', 'A', d));
  const r = P.build(input({ lines }));
  assert.deepEqual(r.mid.map((t) => t.coId).sort(), ['c0', 'c1', 'c2']);
  assert.deepEqual(r.mid.map((t) => t.days).sort((a, b) => a - b), [0, 1, 7]);
});
test('soon — 끝난 업체(finished)는 제외', () => {
  const r = P.build(input({ lines: [line('c1', '가나상사', 't1', 'A', 3, { finished: true }), line('c2', '다라정밀', 't1', 'A', 3)] }));
  assert.deepEqual(ids(r.mid), ['c2|t1']);
});
test('soon — soonDays 를 바꿀 수 있고, 없거나 이상하면 7', () => {
  const lines = [line('c1', '가나상사', 't1', 'A', 8), line('c2', '다라정밀', 't1', 'A', 14), line('c3', '마바전자', 't1', 'A', 15)];
  assert.equal(P.build(input({ lines, soonDays: 14 })).mid.length, 2);
  assert.equal(P.build(input({ lines, soonDays: undefined })).mid.length, 0);
  assert.equal(P.build(input({ lines, soonDays: 'x' })).mid.length, 0);
  assert.equal(P.build(input({ lines, soonDays: NaN })).mid.length, 0);
});
test('soon — 기한이 지난 것은 soon 이 아니다(overdue 쪽 몫): dueDays 음수는 soon 줄이 안 생긴다', () => {
  const r = P.build(input({ lines: [line('c1', '가나상사', 't1', 'A', -1), line('c2', '다라정밀', 't1', 'A', -30)] }));
  assert.equal(r.mid.length, 0);
  assert.deepEqual([].concat(r.hot, r.mid, r.low).map((t) => t.kind), ['overdue', 'overdue'], '지난 기한은 overdue 가 맡는다');
});

/* ---------- overdue — 대형 사업: 현황판 줄이 없어 extra.overdue 가 못 만든 지난 기한을 lines 로 ---------- */
test('overdue(lines) — 기한이 지났고 안 끝난 업체는 overdue 줄(hot): 제목·근거·days(지난 일수) · 끝난 업체·기한 안 지난 것·모름은 아니다', () => {
  const r = P.build(input({ lines: [
    line('c1', '가나상사', 't2', '대형', -3, { due: '2026-10-09', bizName: '일터혁신' }),
    line('c2', '다라정밀', 't2', '대형', -3, { finished: true }),
    line('c3', '마바전자', 't2', '대형', 0), line('c4', '사아테크', 't2', '대형', 5), line('c5', '자차산업', 't2', '대형', null)] }));
  assert.deepEqual(ids(r.hot), ['c1|t2']);
  const t = r.hot[0];
  assert.equal(t.kind, 'overdue'); assert.equal(t.level, 'hot');
  assert.equal(t.title, '가나상사 · 제출 기한이 지났습니다');
  assert.equal(t.meta, '대형 · 기한 2026-10-09 (3일 지남)');
  assert.deepEqual(t.tags, ['일터혁신', '제출']);
  assert.equal(t.days, 3);
  assert.equal(t.id, 'overdue|c1|t2');
  assert.deepEqual(ids(r.mid).sort(), ['c3|t2', 'c4|t2'], '오늘·앞으로는 soon');
});
test('overdue(lines) — 같은 업체·사업이 extra.overdue 에 이미 있으면 그쪽 줄 한 줄(중복 없음) · 더 급한 blocked 가 이긴다 · known:false 면 만들지 않는다', () => {
  const co = ['c1', '가나상사', 't1', '대형'];
  const both = P.build(input({ extra: { waitSign: [], overdue: [{ row: row(...co, null), due: '2026-10-01' }] }, lines: [line(...co, -5, { due: '2026-10-07' })] }));
  assert.equal(both.hot.length, 1);
  assert.equal(both.hot[0].days, 11, 'extra 쪽 문구(today − due)');
  assert.ok(both.hot[0].meta.includes('2026-10-01'));
  const blk = P.build(input({ blocked: [{ coId: 'c1', typeId: 't1', coName: '가나상사', typeName: '대형', items: [{ name: 'x', note: '' }] }], lines: [line(...co, -5)] }));
  assert.deepEqual(blk.hot.map((t) => t.kind), ['overdue'], '우선순위 그대로 — overdue 가 blocked 보다 앞선 종류라 한 줄만 남는다');
  const off = P.build(input({ known: false, lines: [line(...co, -5)] }));
  assert.equal(off.total, 0);
});

/* ---------- known:false ---------- */
test('known:false — blocked·waitSign·overdue·soon 은 0줄, unwritten·staleDraft 는 그대로', () => {
  const o = input({
    known: false,
    alerts: { unwritten: [row('a1', '가', 'T', '사업', 30)], staleDraft: [row('a2', '나', 'T', '사업', 10)] },
    extra: { waitSign: [{ row: row('a3', '다', 'T', '사업', null), days: 8 }], overdue: [{ row: row('a4', '라', 'T', '사업', null), due: '2026-10-01' }] },
    blocked: [{ coId: 'a5', typeId: 'T', coName: '마', typeName: '사업', items: [{ name: 'x', note: '' }] }],
    lines: [line('a6', '바', 'T', '사업', 2)] });
  const r = P.build(o);
  const kinds = [].concat(r.hot, r.mid, r.low).map((t) => t.kind).sort();
  assert.deepEqual(kinds, ['staleDraft', 'unwritten']);
  assert.equal(r.total, 2);
});
test('known 이 참(true)이 아니면(없음·"yes"·1) 모르는 것으로 본다 — 가짜 «정상» 방지', () => {
  const base = input({ lines: [line('a6', '바', 'T', '사업', 2)], blocked: [{ coId: 'a5', typeId: 'T', coName: '마', typeName: '사업', items: [{ name: 'x' }] }] });
  [undefined, 'yes', 1, null].forEach((k) => {
    const o = Object.assign({}, base, { known: k });
    assert.equal(P.build(o).total, 0, String(k));
  });
  assert.equal(P.build(base).total, 2);
});
test('known:false 일 때 막힘에 가려졌을 미작성도 살아난다(막힘이 안 만들어졌으니 중복 규칙이 안 걸린다)', () => {
  const r = P.build(input({ known: false,
    blocked: [{ coId: 'c1', typeId: 't1', coName: '가나상사', typeName: 'A', items: [{ name: 'x', note: '' }] }],
    alerts: { unwritten: [row('c1', '가나상사', 't1', 'A', 20)], staleDraft: [] } }));
  assert.deepEqual(r.hot.map((t) => t.kind), ['unwritten']);
});

/* ---------- 정렬 ---------- */
test('정렬 — 묶음 안에서 days 큰 순, blocked(days null)는 맨 뒤', () => {
  const r = P.build(input({
    alerts: { unwritten: [row('c1', '가', 'T', 'A', 15), row('c2', '나', 'T', 'A', 40)], staleDraft: [] },
    extra: { waitSign: [], overdue: [{ row: row('c3', '다', 'T', 'A', null), due: '2026-10-02' }] },    // 10일 지남
    blocked: [{ coId: 'c4', typeId: 'T', coName: '라', typeName: 'A', items: [{ name: 'x', note: '' }] }] }));
  assert.deepEqual(r.hot.map((t) => t.coId), ['c2', 'c1', 'c3', 'c4']);   // 40 · 15 · 10 · null
});
test('정렬 — soon 은 남은 일수가 작을수록 급하다(정렬 키 100−days), waitSign 과 한 묶음에서 섞인다', () => {
  const r = P.build(input({
    extra: { waitSign: [{ row: row('w1', '가', 'T', 'A', null), days: 30 }], overdue: [] },
    lines: [line('s5', '나', 'T', 'A', 5), line('s1', '다', 'T', 'A', 1), line('s7', '라', 'T', 'A', 7)] }));
  // 키: s1=99, s5=95, s7=93, w1=30
  assert.deepEqual(r.mid.map((t) => t.coId), ['s1', 's5', 's7', 'w1']);
});
test('정렬 — days 가 같으면 업체 이름 가나다, 이름도 같으면 입력 순서(안정)', () => {
  const r = P.build(input({ alerts: { unwritten: [
    row('c1', '하타기계', 'T', 'A', 20), row('c2', '가나상사', 'T', 'A', 20), row('c3', '가나상사', 'T', 'B', 20), row('c4', '다라정밀', 'T', 'A', 20)], staleDraft: [] } }));
  assert.deepEqual(r.hot.map((t) => t.coId), ['c2', 'c3', 'c4', 'c1']);
});
test('정렬 — blocked 끼리(둘 다 days null)는 업체 이름 가나다 → 입력 순서', () => {
  const mk = (coId, coName) => ({ coId, typeId: 'T', coName, typeName: 'A', items: [{ name: 'x', note: '' }] });
  const r = P.build(input({ blocked: [mk('c1', '하타기계'), mk('c2', '가나상사'), mk('c3', '가나상사')] }));
  assert.deepEqual(r.hot.map((t) => t.coId), ['c2', 'c3', 'c1']);
});

/* ---------- 모서리 ---------- */
test('모서리 — 같은 이름의 업체 둘(coId 다름)은 각각 한 줄, 던지지 않고 입력 순서 유지', () => {
  const r = P.build(input({ alerts: { unwritten: [row('c1', '가나상사', 'T', 'A', 20), row('c2', '가나상사', 'T', 'A', 20)], staleDraft: [] } }));
  assert.deepEqual(r.hot.map((t) => t.coId), ['c1', 'c2']);
  assert.notEqual(r.hot[0].id, r.hot[1].id);
});
test('모서리 — typeName 이 비어 있으면 근거에서 그 부분만 빠지고 딱지도 종류만 남는다', () => {
  const r = P.build(input({ alerts: { unwritten: [row('c1', '가나상사', 'T', '', 20)], staleDraft: [row('c2', '다라정밀', 'T', undefined, 9)] },
    extra: { waitSign: [{ row: row('c3', '마바전자', 'T', null, null), days: 8 }], overdue: [] } }));
  assert.equal(r.hot[0].meta, '종료 후 20일');
  assert.deepEqual(r.hot[0].tags, ['미작성']);
  assert.equal(r.mid[0].meta, '회신 8일째');
  assert.equal(r.low[0].meta, '9일 전 고침');
  assert.equal(r.low[0].typeName, '');
});
test('모서리 — blocked 에 typeName 도 메모도 없으면 meta 는 빈 문자열', () => {
  const t = P.build(input({ blocked: [{ coId: 'c1', typeId: 'T', coName: '가나상사', typeName: '', items: [{ name: '수행계획서', note: '' }] }] })).hot[0];
  assert.equal(t.meta, '');
});
test('모서리 — days 가 없는(null·undefined·NaN·문자열) 알림도 줄은 만들고 days 는 null, 맨 뒤로 간다', () => {
  const r = P.build(input({ alerts: { unwritten: [row('c1', '가', 'T', 'A', undefined), row('c2', '나', 'T', 'A', 5), row('c3', '다', 'T', 'A', NaN), row('c4', '라', 'T', 'A', '7')],
    staleDraft: [] } }));
  const byId = Object.fromEntries(r.hot.map((t) => [t.coId, t]));
  assert.equal(byId.c1.days, null); assert.equal(byId.c3.days, null); assert.equal(byId.c4.days, null);
  assert.equal(byId.c2.days, 5);
  assert.equal(r.hot[0].coId, 'c2');
  assert.equal(byId.c1.meta, 'A');   // days 모르면 «종료 후 n일» 도 못 쓴다
});
test('모서리 — overdue 의 due·today 꼴이 틀리면 days null(지난 일수 모름), 줄은 있다', () => {
  const r = P.build(input({ today: 'bad', extra: { waitSign: [], overdue: [{ row: row('c1', '가나상사', 'T', 'A', null), due: '2026-10-09' }] } }));
  assert.equal(r.hot[0].days, null);
  assert.equal(r.hot[0].meta, 'A · 기한 2026-10-09');
  const r2 = P.build(input({ extra: { waitSign: [], overdue: [{ row: row('c1', '가나상사', 'T', 'A', null), due: '2026-02-30' }] } }));
  assert.equal(r2.hot[0].days, null);
});
test('모서리 — overdue 는 today 당일(0일)·미래 due 면 «지남»이 아니므로 줄을 만들지 않는다', () => {
  const mk = (due) => ({ waitSign: [], overdue: [{ row: row('c1', '가나상사', 'T', 'A', null), due }] });
  assert.equal(P.build(input({ extra: mk(TODAY) })).total, 0);
  assert.equal(P.build(input({ extra: mk('2026-10-13') })).total, 0);
  assert.equal(P.build(input({ extra: mk('2026-10-11') })).hot[0].days, 1);
});
test('모서리 — coId·typeId 가 숫자·공백이어도 문자열로 다룬다', () => {
  const r = P.build(input({ alerts: { unwritten: [row(7, '가나상사', ' T ', 'A', 20)], staleDraft: [] } }));
  assert.equal(r.hot[0].coId, '7'); assert.equal(r.hot[0].typeId, 'T');
});
test('모서리 — 프로토타입을 건드리는 id(__proto__·constructor)도 던지지 않는다', () => {
  const r = P.build(input({ alerts: { unwritten: [row('__proto__', '가', 'constructor', 'A', 20), row('constructor', '나', '__proto__', 'A', 20)], staleDraft: [] } }));
  assert.equal(r.hot.length, 2);
});

/* ---------- 입력 불변·공유 없음 ---------- */
test('불변 — build 가 입력을 바꾸지 않는다(JSON 비교)', () => {
  const o = input({
    alerts: { unwritten: [row('a1', '가', 'T', '사업', 30)], staleDraft: [row('a2', '나', 'T', '사업', 10)] },
    extra: { waitSign: [{ row: row('a3', '다', 'T', '사업', null), days: 8 }], overdue: [{ row: row('a4', '라', 'T', '사업', null), due: '2026-10-01' }] },
    blocked: [{ coId: 'a5', typeId: 'T', coName: '마', typeName: '사업', items: [{ name: 'x', note: 'm' }, { name: 'y', note: '' }] }],
    lines: [line('a6', '바', 'T', '사업', 5), line('a1', '가', 'T', '사업', 2)] });
  const before = clone(o);
  P.build(o);
  assert.deepEqual(clone(o), before);
});
test('공유 없음 — 결과의 줄·tags 를 바꿔도 입력·다음 결과에 번지지 않는다', () => {
  const o = input({ alerts: { unwritten: [row('a1', '가', 'T', '사업', 30)], staleDraft: [] },
    blocked: [{ coId: 'a5', typeId: 'T', coName: '마', typeName: '사업', items: [{ name: 'x', note: 'm' }] }] });
  const before = clone(o);
  const r = P.build(o);
  r.hot.forEach((t) => { t.tags.push('X'); t.title = 'Z'; t.coName = 'Z'; });
  r.hot.length = 0;
  assert.deepEqual(clone(o), before);
  assert.equal(P.build(o).hot[0].tags.length, 2);
  assert.notEqual(P.build(o).hot[0], P.build(o).hot[0]);
});

/* ---------- stripOf ---------- */
function stripItem(o) {
  return Object.assign({ code: 'K1', name: '혁신 컨설팅', agency: '가나기관', kind: '대형', n: 3,
    cols: [{ done: 2, doing: 1, blocked: 0, none: 0, total: 3 }, { done: 0, doing: 1, blocked: 1, none: 1, total: 3 }],
    blockedN: 0, soonN: 0, known: true, hasPlan: true }, o || {});
}
test('stripOf — 막대 비율은 0~100 정수·합 100, 열 합계로 나눈다', () => {
  const [s] = P.stripOf([stripItem()]);
  // 합: done 2, doing 2, blocked 1, none 1 = 6 → 33.3·33.3·16.7·16.7
  assert.deepEqual(Object.keys(s.bar), ['done', 'doing', 'blocked', 'none']);
  const sum = s.bar.done + s.bar.doing + s.bar.blocked + s.bar.none;
  assert.equal(sum, 100);
  Object.values(s.bar).forEach((v) => { assert.ok(Number.isInteger(v) && v >= 0 && v <= 100); });
  assert.deepEqual(s.label, { name: '혁신 컨설팅', agency: '가나기관' });
  assert.equal(s.code, 'K1'); assert.equal(s.n, 3);
});
test('stripOf — 비율 합이 항상 100(여러 모양), 칸이 하나도 없으면 모두 0', () => {
  const cases = [[1, 1, 1, 0], [1, 1, 1, 1], [1, 0, 0, 0], [7, 3, 2, 1], [1, 2, 4, 8], [13, 0, 0, 29], [99, 1, 0, 0]];
  cases.forEach((c) => {
    const [s] = P.stripOf([stripItem({ cols: [{ done: c[0], doing: c[1], blocked: c[2], none: c[3], total: 0 }] })]);
    assert.equal(s.bar.done + s.bar.doing + s.bar.blocked + s.bar.none, 100, c.join(','));
  });
  const [e] = P.stripOf([stripItem({ cols: [{ done: 0, doing: 0, blocked: 0, none: 0, total: 0 }] })]);
  assert.deepEqual(e.bar, { done: 0, doing: 0, blocked: 0, none: 0 });
  const [e2] = P.stripOf([stripItem({ cols: [] })]);
  assert.deepEqual(e2.bar, { done: 0, doing: 0, blocked: 0, none: 0 });
});
test('stripOf — 한 종류만 있으면 그 칸이 100', () => {
  const [s] = P.stripOf([stripItem({ cols: [{ done: 4, doing: 0, blocked: 0, none: 0, total: 4 }] })]);
  assert.deepEqual(s.bar, { done: 100, doing: 0, blocked: 0, none: 0 });
});
test('stripOf — known:false 또는 hasPlan:false 면 bar:null · 「업체 n곳」 · idle (blockedN·soonN 이 있어도 믿지 않는다)', () => {
  const r = P.stripOf([stripItem({ known: false, n: 4, blockedN: 2, soonN: 1 }), stripItem({ hasPlan: false, n: 2, blockedN: 1 })]);
  assert.equal(r[0].bar, null); assert.equal(r[0].note, '업체 4곳'); assert.equal(r[0].tone, 'idle');
  assert.equal(r[1].bar, null); assert.equal(r[1].note, '업체 2곳'); assert.equal(r[1].tone, 'idle');
});
test('stripOf — note·tone: 막힘 > 기한 > 정상', () => {
  const r = P.stripOf([stripItem({ blockedN: 2 }), stripItem({ soonN: 3 }), stripItem({ blockedN: 1, soonN: 2 }), stripItem()]);
  assert.equal(r[0].note, '막힘 2'); assert.equal(r[0].tone, 'bad');
  assert.equal(r[1].note, '기한 14일 안 3'); assert.equal(r[1].tone, 'warn');
  assert.equal(r[2].note, '막힘 1 · 기한 14일 안 2'); assert.equal(r[2].tone, 'bad');
  assert.equal(r[3].note, '정상'); assert.equal(r[3].tone, 'ok');
});
test('stripOf — 이상한 입력·빈 입력은 던지지 않는다, 입력 불변·공유 없음', () => {
  assert.deepEqual(P.stripOf(undefined), []);
  assert.deepEqual(P.stripOf(null), []);
  assert.deepEqual(P.stripOf([null, 3, 'a']), []);
  const [s] = P.stripOf([{ code: 'K', name: 'N' }]);   // known·hasPlan 없음 → 모르는 것
  assert.equal(s.bar, null); assert.equal(s.note, '업체 0곳'); assert.equal(s.tone, 'idle'); assert.deepEqual(s.label, { name: 'N', agency: '' });
  const inp = [stripItem({ blockedN: 1 })];
  const before = clone(inp);
  const out = P.stripOf(inp);
  out[0].label.name = 'Z'; out[0].bar.done = 99;
  assert.deepEqual(clone(inp), before);
});
test('stripOf — 입력 순서를 그대로 지킨다', () => {
  const r = P.stripOf([stripItem({ code: 'B' }), stripItem({ code: 'A' }), stripItem({ code: 'C' })]);
  assert.deepEqual(r.map((x) => x.code), ['B', 'A', 'C']);
});

/* ---------- more ---------- */
test('more — 기본 8줄, 남은 개수', () => {
  const list = Array.from({ length: 11 }, (_, i) => ({ id: 'i' + i, tags: ['t'] }));
  const r = P.more(list);
  assert.equal(r.rows.length, 8); assert.equal(r.rest, 3);
  assert.deepEqual(r.rows.map((t) => t.id), list.slice(0, 8).map((t) => t.id));
});
test('more — 경계: shown 이상이면 rest 0, 미만이면 있는 만큼', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 'i' + i, tags: [] }));
  assert.deepEqual([P.more(mk(8)).rows.length, P.more(mk(8)).rest], [8, 0]);
  assert.deepEqual([P.more(mk(9)).rows.length, P.more(mk(9)).rest], [8, 1]);
  assert.deepEqual([P.more(mk(7)).rows.length, P.more(mk(7)).rest], [7, 0]);
  assert.deepEqual([P.more(mk(0)).rows.length, P.more(mk(0)).rest], [0, 0]);
  const r = P.more(mk(20), 8, 16);
  assert.deepEqual([r.rows.length, r.rest], [16, 4]);
  const r2 = P.more(mk(20), undefined, 20);
  assert.deepEqual([r2.rows.length, r2.rest], [20, 0]);
  const r3 = P.more(mk(20), undefined, 30);
  assert.deepEqual([r3.rows.length, r3.rest], [20, 0]);
  const r4 = P.more(mk(5), undefined, 3);
  assert.deepEqual([r4.rows.length, r4.rest], [3, 2]);
});
test('more — n 은 기본 줄 수, shown 이 있으면 shown 이 이긴다 · 이상한 값은 8', () => {
  const list = Array.from({ length: 20 }, (_, i) => ({ id: 'i' + i, tags: [] }));
  assert.equal(P.more(list, 5).rows.length, 5);
  assert.equal(P.more(list, 5, 12).rows.length, 12);
  assert.equal(P.more(list, 'x', 'y').rows.length, 8);
  assert.equal(P.more(list, -1, -1).rows.length, 8);
  assert.equal(P.more(list, 0).rows.length, 8);
  assert.deepEqual(P.more(undefined), { rows: [], rest: 0 });
  assert.deepEqual(P.more(null, 8, 8), { rows: [], rest: 0 });
});
test('more — 입력 불변·결과 줄이 입력과 객체를 나눠 쓰지 않는다', () => {
  const list = [{ id: 'a', tags: ['x'] }, { id: 'b', tags: ['y'] }];
  const before = clone(list);
  const r = P.more(list, 8, 1);
  r.rows[0].tags.push('Z'); r.rows[0].id = 'Q'; r.rows.length = 0;
  assert.deepEqual(clone(list), before);
});
