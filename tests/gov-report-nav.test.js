'use strict';
/* 컨설팅보고서 앱 — 왼쪽 사업 목록 모델·종결 판정 순수 모듈 PuGovReportNav (2026-10-12, UI 재정리 1단계)
 * ★ 지키는 것: 사업 이름 (수행기관) 라벨 · 종결 = 자기 소유 속성 closedFrom(4자리) <= 연도 · 종결 사업은 total 에서만 빠지고 count 는 보존 ·
 *   읽기만 한다(받은 값을 바꾸지 않는다) · 기존 PuGovReportDocs 출력은 그대로
 * 공개 저장소다 — 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/pu-gov-report-nav.js');
const D = require('../js/pu-gov-report-docs.js');

/* 합성 자료 — 사업 이름이 서류 틀(planFor)에 실제로 걸리고, 업체·회차가 pairs 에 실제로 잡힌다.
   A 산업일자리(대형, 2026 업체 2) · B 충남북부(간단, 업체 1) · C 현장클리닉(업체 없음) · D 틀 없는 이름(업체 없음) ·
   E 연결 없음 · F 기술보호(2026 업체 1 · 2025 업체 1 — 종결 실험용) · G·H 이름 같고 기관만 다른 쌍(각 업체 1) */
function mk() {
  const biz = [
    { code: 'N-A', name: '산업일자리전환컨설팅충남', agency: '충남경제진흥원', sortOrder: 1 },
    { code: 'N-B', name: '인사노무컨설팅충남북부상의', agency: '충남북부상공회의소', sortOrder: 2 },
    { code: 'N-C', name: '현장클리닉', agency: '비즈니스지원단', sortOrder: 3 },
    { code: 'N-D', name: '가나기획자문', agency: '', sortOrder: 4 },
    { code: 'N-E', name: '서산컨설팅', agency: '서산상공회의소', sortOrder: 5 },
    { code: 'N-F', name: '기술보호컨설팅', agency: '노사발전재단', sortOrder: 6 },
    { code: 'N-G', name: '일터혁신컨설팅', agency: '가기관', sortOrder: 7 },
    { code: 'N-H', name: '일터혁신컨설팅', agency: '나기관', sortOrder: 8 },
  ];
  const sd = (id, coId, typeId, date) => ({ id, coId, typeId, date, round: 1, isField: true });
  const input = {
    types: ['ta', 'tb', 'tc', 'td', 'tf', 'tg', 'th'].map((id) => ({ id, name: '합성 ' + id, rounds: 1 })),
    cos: [
      { id: 'c1', name: '가나상사', types: ['ta', 'tb', 'tg'] },
      { id: 'c2', name: '다라정밀', types: ['ta', 'tf', 'th'] },
      { id: 'c3', name: '마바공업', types: ['tf'] },
    ],
    scheds: [
      sd('s1', 'c1', 'ta', '2026-03-05'), sd('s2', 'c2', 'ta', '2026-04-09'),
      sd('s3', 'c1', 'tb', '2026-05-05'),
      sd('s4', 'c2', 'tf', '2026-06-09'), sd('s5', 'c3', 'tf', '2025-05-05'),
      sd('s6', 'c1', 'tg', '2026-07-01'), sd('s7', 'c2', 'th', '2026-07-02'),
    ],
    staff: [],
  };
  /* N-D(td)는 업체 없음, N-E 는 tmap 에 없음(연결 없음) */
  const tmap = { 'N-A': 'ta', 'N-B': 'tb', 'N-C': 'tc', 'N-D': 'td', 'N-F': 'tf', 'N-G': 'tg', 'N-H': 'th' };
  return { biz, input, tmap };
}
const codes = (arr) => arr.map((x) => x.code);
const bld = (o) => { const m = mk(); return N.build(Object.assign({ biz: m.biz, tmap: m.tmap, input: m.input, year: '2026', state: {} }, o)); };

test('상수 — REASONS·REASON_MAX·ALL_FROM·NO_AGENCY', () => {
  assert.deepEqual(N.REASONS, ['사업 기간 끝남', '이번 연도 수행 안 함', '계약 종료', '기타']);
  assert.equal(N.REASON_MAX, 40);
  assert.equal(N.ALL_FROM, '2000');
  assert.equal(N.NO_AGENCY, '기관 미지정');
  assert.equal(N.NO_AGENCY, D.NO_AGENCY, '옆 모듈과 같은 말');
});

test('label — 이름 (기관), 기관이 비거나 공백이면 「기관 미지정」, 이름 같고 기관 다르면 text 가 다르다', () => {
  assert.deepEqual(N.label({ name: '가나사업', agency: '노사발전재단' }), { name: '가나사업', agency: '노사발전재단', text: '가나사업 (노사발전재단)' });
  assert.equal(N.label({ name: '가나사업', agency: '' }).text, '가나사업 (기관 미지정)');
  assert.equal(N.label({ name: '가나사업', agency: '   ' }).agency, '기관 미지정');
  assert.equal(N.label({ name: '가나사업' }).text, '가나사업 (기관 미지정)');
  assert.equal(N.label({ name: ' 가나사업 ', agency: ' 노사발전재단 ' }).text, '가나사업 (노사발전재단)', '앞뒤 공백은 뗀다');
  assert.notEqual(N.label({ name: '같은이름', agency: '가기관' }).text, N.label({ name: '같은이름', agency: '나기관' }).text);
  assert.equal(N.label(null).text, ' (기관 미지정)', '아무것도 없어도 던지지 않는다');
});

test('closedFor — closedFrom <= 연도 (4자리 문자열 비교) · 경계 2025/2026/2027', () => {
  const st = { x1: { closedFrom: '2026', at: 1 } };
  assert.equal(N.closedFor(st, 'x1', '2025'), false);
  assert.equal(N.closedFor(st, 'x1', '2026'), true);
  assert.equal(N.closedFor(st, 'x1', '2027'), true);
  assert.equal(N.closedFor(st, 'x1', 2026), true, '숫자 연도 인자도 받는다');
  assert.equal(N.closedFor(st, 'x1', 2025), false);
  assert.equal(N.closedFor({ all: { closedFrom: N.ALL_FROM } }, 'all', '2019'), true, '「전체」 = 2000');
});

test('closedFor — 상태 없음·이상한 값·프로토타입 이름은 모두 false(자기 소유 속성만)', () => {
  const st = { x1: { closedFrom: '2026' } };
  [undefined, null, '2026', 5, [], ['x1']].forEach((bad) => assert.equal(N.closedFor(bad, 'x1', '2027'), false, String(bad)));
  assert.equal(N.closedFor(st, 'nope', '2027'), false, '키가 없다');
  assert.equal(N.closedFor(st, '__proto__', '2027'), false);
  assert.equal(N.closedFor(st, 'constructor', '2027'), false);
  assert.equal(N.closedFor(st, 'toString', '2027'), false);
  assert.equal(N.closedFor(st, 'hasOwnProperty', '2027'), false);
  /* JSON.parse 는 __proto__ 를 «자기 소유 속성»으로 만든다 — 그래도 모양이 맞아야만 true. 아래는 프로토타입 오염과 다르다 */
  const polluted = Object.create({ x1: { closedFrom: '2000' } });
  assert.equal(N.closedFor(polluted, 'x1', '2027'), false, '프로토타입 쪽에 있는 기록은 읽지 않는다');
  assert.equal(N.closedFor({ x1: null }, 'x1', '2027'), false);
  assert.equal(N.closedFor({ x1: '2026' }, 'x1', '2027'), false, '기록이 객체가 아니다');
  assert.equal(N.closedFor({ x1: {} }, 'x1', '2027'), false);
  assert.equal(N.closedFor({ x1: [] }, 'x1', '2027'), false);
  assert.equal(N.closedFor({ x1: { closedFrom: '26' } }, 'x1', '2027'), false, '이상한 꼴(2자리)');
  ['202', '20260', '2026-', ' 2026', '２０２６', 2026, null, ''].forEach((cf) =>
    assert.equal(N.closedFor({ x1: { closedFrom: cf } }, 'x1', '2030'), false, 'closedFrom=' + JSON.stringify(cf)));
  assert.equal(N.closedFor(st, 'x1', ''), false, '연도가 비면 종결로 보지 않는다');
  assert.equal(N.closedFor(st, 'x1', undefined), false);
});

test('closedFor — JSON.parse 로 만든 __proto__ 자기 소유 키가 있어도 안전', () => {
  const st = JSON.parse('{"__proto__":{"closedFrom":"2000"},"constructor":{"closedFrom":"2000"}}');
  /* 코드 규칙이 [A-Za-z0-9_-] 라 실제로는 못 들어오지만, 와도 «기록 모양이 맞으면» 일반 키처럼 읽을 뿐 던지지 않는다 */
  assert.doesNotThrow(() => N.closedFor(st, '__proto__', '2027'));
  assert.equal(N.closedFor({}, '__proto__', '2027'), false);
  assert.equal(N.closedFor({}, 'constructor', '2027'), false);
});

test('closeEntry — 정상 · from 이상하면 null · reason 40자 · 이상한 날짜는 closedAt 없음 · now 없으면 null', () => {
  assert.deepEqual(N.closeEntry({ from: '2026', at: '2026-10-12', reason: '계약 종료', by: '홍길동', now: 1760000000000 }),
    { closedFrom: '2026', closedAt: '2026-10-12', reason: '계약 종료', by: '홍길동', at: 1760000000000 });
  assert.deepEqual(N.closeEntry({ from: '2000', now: 5 }), { closedFrom: '2000', at: 5 }, '선택 칸은 없으면 아예 안 둔다');
  ['26', '20260', '', null, undefined, 'abcd', '２０２６'].forEach((f) =>
    assert.equal(N.closeEntry({ from: f, now: 5 }), null, 'from=' + JSON.stringify(f)));
  assert.equal(N.closeEntry({ from: 2026, now: 5 }).closedFrom, '2026', '숫자 연도도 4자리면 문자열로');
  assert.equal(N.closeEntry({ from: '2026', reason: 'ㄱ'.repeat(41), now: 5 }).reason.length, 40, '41자 → 40자');
  assert.equal(N.closeEntry({ from: '2026', reason: 'ㄱ'.repeat(40), now: 5 }).reason.length, 40);
  assert.equal(N.closeEntry({ from: '2026', by: 'ㄴ'.repeat(50), now: 5 }).by.length, 40, 'by 도 40자');
  ['2026/10/12', '10월 12일', '2026-1-2', '', '2026-10-12x'].forEach((d) =>
    assert.equal('closedAt' in N.closeEntry({ from: '2026', at: d, now: 5 }), false, 'at=' + d));
  assert.equal(N.closeEntry({ from: '2026' }), null, 'now 없음');
  [NaN, Infinity, '5', null].forEach((n) => assert.equal(N.closeEntry({ from: '2026', now: n }), null, 'now=' + String(n)));
  assert.equal('reason' in N.closeEntry({ from: '2026', reason: '   ', now: 5 }), false, '공백 사유는 안 둔다');
  assert.equal(N.closeEntry(null), null);
  assert.equal(N.closeEntry(), null);
});

test('build — 묶음 배정(진행·업체 없음·서류 틀 없음·연결 없음·종결)·정렬·total', () => {
  const r = bld({ state: { 'N-F': { closedFrom: '2026', at: 1 } } });
  assert.deepEqual(codes(r.open), ['N-A', 'N-B', 'N-G', 'N-H'], 'count 내림차순(A=2) → sortOrder 오름차순');
  assert.deepEqual(codes(r.quiet), ['N-C'], '업체 없음 + 서류 틀 있음');
  assert.deepEqual(codes(r.noPlan), ['N-D'], '업체 없음 + 서류 틀 없음');
  assert.deepEqual(codes(r.unlinked), ['N-E']);
  assert.deepEqual(codes(r.closed), ['N-F']);
  assert.equal(r.total, 2 + 1 + 1 + 1, 'total = open 의 count 합');
  assert.deepEqual(r.open.map((x) => x.count), [2, 1, 1, 1]);
});

test('build — 항목 필드(code·name·agency·label·kind·plan·typeId·count·closedFrom)', () => {
  const r = bld({ state: { 'N-F': { closedFrom: '2026', at: 1 } } });
  const a = r.open[0];
  assert.equal(a.code, 'N-A');
  assert.equal(a.name, '산업일자리전환컨설팅충남');
  assert.equal(a.agency, '충남경제진흥원');
  assert.deepEqual(a.label, { name: '산업일자리전환컨설팅충남', agency: '충남경제진흥원', text: '산업일자리전환컨설팅충남 (충남경제진흥원)' });
  assert.equal(a.plan, D.planFor(a.name).key, 'plan 은 planFor(name).key');
  assert.equal(a.plan, 'industry-cn');
  assert.equal(a.kind, D.planFor(a.name).kind);
  assert.equal(a.typeId, 'ta');
  assert.equal(a.closedFrom, '', '종결 아니면 빈 값');
  const d = r.noPlan[0];
  assert.equal(d.plan, 'none');
  assert.equal(d.agency, '', '항목 agency 는 원래 값(빈 칸) — 「기관 미지정」 은 label 이 맡는다');
  assert.equal(d.label.agency, '기관 미지정');
  assert.equal(d.label.text, '가나기획자문 (기관 미지정)');
  assert.equal(r.unlinked[0].typeId, '');
  assert.equal(r.unlinked[0].count, 0);
  assert.equal(r.closed[0].closedFrom, '2026');
});

test('build — 종결 항목은 실제 count 를 담되 total 에는 안 들어간다', () => {
  const r = bld({ state: { 'N-F': { closedFrom: '2026', at: 1 } } });
  assert.equal(r.closed[0].count, 1, '2026 에 업체 1곳 — 보존');
  assert.equal(r.total, 5, '종결 1곳은 total 에서 빠진다');
  const all = bld({ state: { 'N-A': { closedFrom: '2000' }, 'N-F': { closedFrom: '2026' } } });
  assert.equal(all.closed.find((x) => x.code === 'N-A').count, 2);
  assert.equal(all.total, 3);
});

test('build — 같은 사업이라도 연도를 2025 로 바꾸면 종결 전 해라 진행(open)으로 돌아온다', () => {
  const st = { 'N-F': { closedFrom: '2026', at: 1 } };
  const y25 = bld({ year: '2025', state: st });
  assert.deepEqual(codes(y25.closed), []);
  assert.deepEqual(codes(y25.open), ['N-F'], '2025 업체 1곳(마바공업)');
  assert.equal(y25.open[0].count, 1);
  assert.equal(y25.open[0].closedFrom, '', '진행으로 돌아오면 closedFrom 칸도 비운다');
  assert.equal(y25.total, 1);
  const y27 = bld({ year: '2027', state: st });
  assert.deepEqual(codes(y27.closed), ['N-F'], '2027 도 종결(≥ closedFrom)');
  assert.equal(y27.closed[0].count, 0, '업체가 없어도 종결이면 종결 묶음');
  assert.equal(bld({ year: 2026, state: st }).closed.length, 1, '숫자 연도');
});

test('build — 상태 없음/null/되돌림(기록 삭제)은 모두 종결 없음', () => {
  const base = codes(bld({ state: {} }).open);
  assert.equal(bld({ state: {} }).closed.length, 0);
  assert.equal(bld({ state: undefined }).closed.length, 0);
  assert.equal(bld({ state: null }).closed.length, 0);
  assert.deepEqual(codes(bld({ state: undefined }).open), base);
  assert.deepEqual(codes(bld({ state: { 'N-F': { closedFrom: '2026' } } }).closed), ['N-F']);
  assert.equal(bld({ state: {} }).closed.length, 0, '노드를 지우면(되돌리기) 모든 연도가 진행으로');
  assert.deepEqual(codes(bld({ year: '2027', state: {} }).open).includes('N-F'), false, '2027 은 업체가 없어 업체 없음 쪽 — 종결 아님');
  assert.deepEqual(codes(bld({ year: '2027', state: {} }).quiet).includes('N-F'), true);
});

test('build — 이름 같고 기관만 다른 두 사업은 label.text 로 구분된다', () => {
  const r = bld();
  const g = r.open.find((x) => x.code === 'N-G'), h = r.open.find((x) => x.code === 'N-H');
  assert.equal(g.name, h.name);
  assert.notEqual(g.label.text, h.label.text);
  assert.equal(g.label.text, '일터혁신컨설팅 (가기관)');
  assert.equal(h.label.text, '일터혁신컨설팅 (나기관)');
});

test('build — 같은 count 는 sortOrder → 이름 순, 나머지 묶음도 sortOrder·이름 순', () => {
  const m = mk();
  m.biz.push({ code: 'N-I', name: '가가컨설팅', agency: '', sortOrder: 7 });   // G(7) 와 같은 sortOrder → 이름순으로 가가 < 일터
  m.biz.push({ code: 'N-J', name: '나나자문', agency: '' });                      // sortOrder 없음 → 맨 뒤(Infinity)
  m.input.types.push({ id: 'ti', name: '합성 ti', rounds: 1 }, { id: 'tj', name: '합성 tj', rounds: 1 });
  m.tmap['N-I'] = 'ti'; m.tmap['N-J'] = 'tj';
  m.input.cos[0].types.push('ti', 'tj');
  m.input.scheds.push({ id: 's8', coId: 'c1', typeId: 'ti', date: '2026-08-01', round: 1 }, { id: 's9', coId: 'c1', typeId: 'tj', date: '2026-08-02', round: 1 });
  const r = N.build({ biz: m.biz, tmap: m.tmap, input: m.input, year: '2026', state: {} });
  assert.deepEqual(codes(r.open), ['N-A', 'N-B', 'N-F', 'N-I', 'N-G', 'N-H', 'N-J']);
  assert.equal(r.total, 2 + 1 + 1 + 1 + 1 + 1 + 1);
});

test('build — 숨김·합친 사업은 어느 묶음에도 없다 · 빈 입력은 빈 묶음', () => {
  const m = mk();
  m.biz.push({ code: 'N-X', name: '숨김사업', hidden: true }, { code: 'N-Y', name: '합친사업', mergedInto: 'N-A' });
  const r = N.build({ biz: m.biz, tmap: m.tmap, input: m.input, year: '2026', state: {} });
  const all = [].concat(r.open, r.quiet, r.noPlan, r.unlinked, r.closed);
  assert.equal(all.some((x) => x.code === 'N-X' || x.code === 'N-Y'), false);
  const e = N.build({ biz: null, tmap: null, input: null, year: '2026', state: null });
  assert.deepEqual(e, { open: [], quiet: [], noPlan: [], unlinked: [], closed: [], total: 0 });
  assert.deepEqual(N.build(), { open: [], quiet: [], noPlan: [], unlinked: [], closed: [], total: 0 });
});

test('build — 받은 값을 바꾸지 않는다 · 여러 번 불러도 같다', () => {
  const m = mk(), state = { 'N-F': { closedFrom: '2026', at: 1 } };
  const snap = JSON.stringify([m, state]);
  const a = N.build({ biz: m.biz, tmap: m.tmap, input: m.input, year: '2026', state });
  const b = N.build({ biz: m.biz, tmap: m.tmap, input: m.input, year: '2026', state });
  assert.equal(JSON.stringify([m, state]), snap);
  assert.deepEqual(a, b);
});

test('build — 기존 PuGovReportDocs.sidebarGroups 출력과 같은 사업·업체 수(복제 규칙 어긋남 방지)', () => {
  const m = mk();
  const r = N.build({ biz: m.biz, tmap: m.tmap, input: m.input, year: '2026', state: {} });
  const flat = {};
  D.sidebarGroups(m.biz, m.tmap, m.input, '2026').forEach((g) => g.types.forEach((t) => { flat[t.code] = t; }));
  const mine = [].concat(r.open, r.quiet, r.noPlan, r.unlinked, r.closed);
  assert.equal(mine.length, Object.keys(flat).length);
  mine.forEach((x) => {
    assert.equal(x.count, flat[x.code].count, x.code + ' count');
    assert.equal(x.typeId, flat[x.code].typeId, x.code + ' typeId');
    assert.equal(x.plan, flat[x.code].plan, x.code + ' plan');
    assert.equal(x.kind, flat[x.code].kind, x.code + ' kind');
  });
});

test('closedTypeIds — 종결 사업의 typeId 만, 연도에 따라 달라진다', () => {
  const m = mk(), st = { 'N-F': { closedFrom: '2026', at: 1 }, 'N-E': { closedFrom: '2026', at: 1 }, 'N-A': { closedFrom: '2027', at: 1 } };
  const f = (year, state) => N.closedTypeIds({ biz: m.biz, tmap: m.tmap, input: m.input, year, state });
  assert.deepEqual(f('2026', st), { tf: 1 }, 'N-E 는 연결 없음 — typeId 가 없으니 빠진다 · N-A 는 2027 부터');
  assert.deepEqual(f('2027', st), { tf: 1, ta: 1 });
  assert.deepEqual(f('2025', st), {}, '종결 전 해');
  assert.deepEqual(f('2026', {}), {});
  assert.deepEqual(f('2026', undefined), {});
  assert.deepEqual(N.closedTypeIds(), {});
});

/* ── 되돌림 표시(2026-10-12 조정관 판정: 지우지 않고 closedFrom '9999' 로 표시 — 저장 관문이 물리적 삭제를 막는다) ── */
test('NEVER_FROM — 「9999」 · 규칙 정규식 꼴(4자리)을 통과하고 closeEntry 가 만들 수 있다', () => {
  assert.equal(N.NEVER_FROM, '9999');
  assert.ok(/^[0-9]{4}$/.test(N.NEVER_FROM));
  assert.deepEqual(N.closeEntry({ from: N.NEVER_FROM, at: '2026-10-12', reason: '되돌림', by: '홍길동', now: 5 }),
    { closedFrom: '9999', closedAt: '2026-10-12', reason: '되돌림', by: '홍길동', at: 5 });
  assert.equal(N.closeEntry({ from: '9999', now: 5 }).closedFrom, '9999');
  assert.equal(N.closeEntry({ from: '99999', now: 5 }), null, '다른 검사(4자리)는 그대로');
  assert.equal(N.closeEntry({ from: '9999' }), null, 'now 없음은 그대로 null');
});

test('closedFor — closedFrom 「9999」 는 어느 정상 연도에서도 종결이 아니다(2000·2026·2099 까지)', () => {
  const st = { x1: { closedFrom: '9999', at: 1 } };
  ['2000', '2019', '2025', '2026', '2027', '2099', 2026].forEach((y) => assert.equal(N.closedFor(st, 'x1', y), false, String(y)));
  assert.equal(N.closedFor(st, 'x1', ''), false);
});

test('isReopened — 자기 소유 속성의 closedFrom 이 9999 일 때만 · 이상한 값·프로토타입 이름은 false', () => {
  assert.equal(N.isReopened({ x1: { closedFrom: '9999', at: 1 } }, 'x1'), true);
  assert.equal(N.isReopened({ x1: { closedFrom: '2026' } }, 'x1'), false);
  assert.equal(N.isReopened({ x1: { closedFrom: '2000' } }, 'x1'), false);
  [undefined, null, '9999', 5, [], ['x1']].forEach((bad) => assert.equal(N.isReopened(bad, 'x1'), false, String(bad)));
  [null, '9999', [], {}, { closedFrom: 9999 }].forEach((e) => assert.equal(N.isReopened({ x1: e }, 'x1'), false, JSON.stringify(e)));
  assert.equal(N.isReopened({ x1: { closedFrom: '9999' } }, 'nope'), false);
  ['__proto__', 'constructor', 'toString'].forEach((k) => assert.equal(N.isReopened({ x1: { closedFrom: '9999' } }, k), false, k));
  assert.equal(N.isReopened(Object.create({ x1: { closedFrom: '9999' } }), 'x1'), false, '프로토타입 쪽 값은 읽지 않는다');
});

test('build·closedTypeIds — 되돌림 표시(9999)된 사업은 종결 묶음이 아니라 진행/업체 없음/…으로 간다', () => {
  const st = { 'N-F': { closedFrom: '9999', at: 1 }, 'N-C': { closedFrom: '9999', at: 1 }, 'N-D': { closedFrom: '9999', at: 1 }, 'N-E': { closedFrom: '9999', at: 1 } };
  const r = bld({ state: st });
  assert.deepEqual(codes(r.closed), []);
  assert.deepEqual(codes(r.open), ['N-A', 'N-B', 'N-F', 'N-G', 'N-H'], '업체가 있는 되돌림 사업은 진행');
  assert.deepEqual(codes(r.quiet), ['N-C']);
  assert.deepEqual(codes(r.noPlan), ['N-D']);
  assert.deepEqual(codes(r.unlinked), ['N-E']);
  assert.equal(r.total, 6, '되돌린 사업의 업체도 total 에 든다');
  const m = mk();
  assert.deepEqual(N.closedTypeIds({ biz: m.biz, tmap: m.tmap, input: m.input, year: '2026', state: st }), {});
  /* 대조 — 같은 사업이 다시 종결로 덮이면(덮어쓰기) 종결 */
  assert.deepEqual(codes(bld({ state: { 'N-F': { closedFrom: '2026', at: 2 } } }).closed), ['N-F']);
});
