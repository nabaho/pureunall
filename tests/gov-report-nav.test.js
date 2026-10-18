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

/* ── 사업 순서(2026-10-12, UI 4단계 — 계획 docs/superpowers/plans/2026-10-12-gov-report-order.md) ──
   이알피 순서(sortOrder → 이름)가 기본, 끌어서 바꾼 순서(scal_bizOrder/main {list:'A,B'})가 있으면 그것이 먼저 ── */
const orderBiz = () => [
  { code: 'O-A', name: '가사업', agency: '가기관', sortOrder: 1 },
  { code: 'O-B', name: '나사업', agency: '가기관', sortOrder: 2 },
  { code: 'O-C', name: '다사업', agency: '나기관', sortOrder: 3 },
  { code: 'O-D', name: '라사업', agency: '나기관', sortOrder: 4 },
];
const ranked = (o) => { const r = N.rankMap(o); return Object.keys(r).sort((a, b) => r[a] - r[b]); };

test('순서 상수 — ORDER_MAX 200 · ORDER_LEN_MAX 4000 · ORDER_NODE_KEY main', () => {
  assert.equal(N.ORDER_MAX, 200);
  assert.equal(N.ORDER_LEN_MAX, 4000);
  assert.equal(N.ORDER_NODE_KEY, 'main');
});

test('parseOrder — 정상 · 중복은 처음 것만 · 잘못된 코드 · __proto__·constructor·prototype · 200 초과 · 이상한 값은 []', () => {
  assert.deepEqual(N.parseOrder({ list: 'A,B,C' }), ['A', 'B', 'C']);
  assert.deepEqual(N.parseOrder({ list: 'A-1,b_2,C3', by: '홍길동', at: 1 }), ['A-1', 'b_2', 'C3']);
  assert.deepEqual(N.parseOrder({ list: 'A,B,A,C,B' }), ['A', 'B', 'C'], '중복은 처음 것만');
  assert.deepEqual(N.parseOrder({ list: 'A,,B, ,가나,C d,E' }), ['A', 'B', 'E'], '빈 칸·공백·한글·공백 낀 코드는 버린다');
  assert.deepEqual(N.parseOrder({ list: 'a'.repeat(41) + ',B' }), ['B'], '41자 코드는 버린다');
  assert.deepEqual(N.parseOrder({ list: 'a'.repeat(40) + ',B' }), ['a'.repeat(40), 'B'], '40자는 된다');
  assert.deepEqual(N.parseOrder({ list: '__proto__,constructor,prototype,A,toString' }), ['A', 'toString'], '세 이름만 뺀다');
  const many = Array.from({ length: 250 }, (_, i) => 'C' + i);
  assert.equal(N.parseOrder({ list: many.join(',') }).length, 200, '200 개까지');
  assert.deepEqual(N.parseOrder({ list: many.join(',') }), many.slice(0, 200));
  [undefined, null, '', 'A,B', 5, true, [], ['A,B'], {}, { list: null }, { list: 5 }, { list: ['A'] }, { list: '' }, { by: 'x' }].forEach((bad) =>
    assert.deepEqual(N.parseOrder(bad), [], JSON.stringify(bad)));
  assert.deepEqual(N.parseOrder(Object.create({ list: 'A,B' })), [], '프로토타입 쪽 값은 읽지 않는다');
  assert.deepEqual(N.parseOrder(JSON.parse('{"list":"__proto__,A"}')), ['A']);
  const e = { list: 'A,B' }, snap = JSON.stringify(e);
  N.parseOrder(e);
  assert.equal(JSON.stringify(e), snap, '입력 불변');
});

test('rankMap — order 가 앞 · 나머지는 이알피 순서 · order 에만 있는 코드는 무시', () => {
  const biz = orderBiz();
  assert.deepEqual(N.rankMap({ biz, order: [] }), { 'O-A': 0, 'O-B': 1, 'O-C': 2, 'O-D': 3 }, 'order 없으면 이알피 순서');
  assert.deepEqual(N.rankMap({ biz }), { 'O-A': 0, 'O-B': 1, 'O-C': 2, 'O-D': 3 }, 'order 자체가 없어도');
  assert.deepEqual(ranked({ biz, order: ['O-C', 'O-A'] }), ['O-C', 'O-A', 'O-B', 'O-D'], 'order 먼저, 나머지는 이알피 순');
  assert.deepEqual(ranked({ biz, order: ['O-D', 'O-C', 'O-B', 'O-A'] }), ['O-D', 'O-C', 'O-B', 'O-A']);
  assert.deepEqual(ranked({ biz, order: ['GONE', 'O-B', 'ALSO-GONE'] }), ['O-B', 'O-A', 'O-C', 'O-D'], 'order 에만 있는 코드는 무시');
  assert.equal('GONE' in N.rankMap({ biz, order: ['GONE'] }), false, '순위 칸도 안 만든다');
  assert.deepEqual(ranked({ biz, order: ['O-B', 'O-B', 'O-A', 'O-B'] }), ['O-B', 'O-A', 'O-C', 'O-D'], 'order 의 중복은 처음 것만');
  assert.deepEqual(Object.values(N.rankMap({ biz, order: ['O-C'] })).sort(), [0, 1, 2, 3], '순위는 0..n-1');
});

test('rankMap — 숨김·합친 사업은 순위가 없다 · sortOrder 없는 사업은 뒤 · 이름 같은 두 사업은 안정 · 잘못된 입력은 빈 순위', () => {
  const biz = orderBiz().concat([
    { code: 'O-H', name: '숨김', hidden: true, sortOrder: 0 },
    { code: 'O-M', name: '합침', mergedInto: 'O-A', sortOrder: 0 },
    { code: 'O-N', name: '순서없는 사업' },
    { code: 'O-S1', name: '같은이름', agency: '가기관', sortOrder: 9 },
    { code: 'O-S2', name: '같은이름', agency: '나기관', sortOrder: 9 },
  ]);
  const r = N.rankMap({ biz, order: ['O-H', 'O-M'] });
  assert.equal('O-H' in r, false);
  assert.equal('O-M' in r, false);
  assert.deepEqual(ranked({ biz, order: [] }), ['O-A', 'O-B', 'O-C', 'O-D', 'O-S1', 'O-S2', 'O-N'], 'sortOrder 없는 사업은 맨 뒤, 이름·순서 같으면 들어온 차례');
  assert.deepEqual(ranked({ biz: biz.filter((x) => /^O-S/.test(x.code)).reverse(), order: [] }), ['O-S2', 'O-S1'], '같은 이름·순서는 들어온 차례 그대로(안정)');
  assert.deepEqual(ranked({ biz, order: ['O-S2'] }).slice(0, 2), ['O-S2', 'O-A'], '같은 이름이라도 코드로 구분된다');
  assert.deepEqual(N.rankMap(), {});
  assert.deepEqual(N.rankMap({}), {});
  assert.deepEqual(N.rankMap({ biz: null, order: null }), {});
  assert.deepEqual(N.rankMap({ biz: orderBiz(), order: 'O-C' }), { 'O-A': 0, 'O-B': 1, 'O-C': 2, 'O-D': 3 }, 'order 가 배열이 아니면 없는 것으로');
});

test('rankMap — 받은 값을 바꾸지 않는다 · __proto__ 코드가 있어도 던지지 않고 순위 객체를 오염시키지 않는다', () => {
  const biz = orderBiz(), order = ['O-C', 'O-A'];
  const snap = JSON.stringify([biz, order]);
  N.rankMap({ biz, order });
  assert.equal(JSON.stringify([biz, order]), snap);
  const r = N.rankMap({ biz: [{ code: '__proto__', name: '이상한', sortOrder: 1 }, { code: 'O-A', name: '가', sortOrder: 2 }], order: ['__proto__'] });
  assert.equal(Object.getPrototypeOf(r), Object.prototype, '프로토타입이 그대로');
  assert.equal(Object.prototype.hasOwnProperty.call(r, 'O-A'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(r, '__proto__'), true, '자기 소유 칸으로 담긴다');
});

test('reorder — 앞·뒤·맨 앞·맨 끝으로 옮긴 새 전체 순서 · rankMap 순이 기준', () => {
  const biz = orderBiz();
  assert.deepEqual(N.reorder({ biz, order: [] }, 'O-C', 'O-A', false), ['O-C', 'O-A', 'O-B', 'O-D'], '맨 앞(첫 사업 앞)');
  assert.deepEqual(N.reorder({ biz, order: [] }, 'O-D', 'O-B', false), ['O-A', 'O-D', 'O-B', 'O-C'], '앞');
  assert.deepEqual(N.reorder({ biz, order: [] }, 'O-A', 'O-C', true), ['O-B', 'O-C', 'O-A', 'O-D'], '뒤');
  assert.deepEqual(N.reorder({ biz, order: [] }, 'O-A', 'O-D', true), ['O-B', 'O-C', 'O-D', 'O-A'], '마지막 뒤(맨 끝)');
  assert.deepEqual(N.reorder({ biz, order: ['O-D', 'O-C'] }, 'O-A', 'O-D', false), ['O-A', 'O-D', 'O-C', 'O-B'], '현재 전체 순서(D,C,A,B)가 기준');
  assert.deepEqual(N.reorder({ biz, order: ['O-D', 'GONE', 'O-C'] }, 'O-B', 'O-C', true), ['O-D', 'O-C', 'O-B', 'O-A'], 'order 에만 있는 사라진 코드는 결과에 없다');
  assert.deepEqual(N.reorder({ biz, order: [] }, 'O-B', 'O-A', false), ['O-B', 'O-A', 'O-C', 'O-D'], 'B 를 A 앞으로 — 바뀐 것이 있다');
  assert.deepEqual(N.reorder({ biz, order: [] }, 'O-A', 'O-B', true), ['O-B', 'O-A', 'O-C', 'O-D'], 'A 를 B 뒤로');
});

test('reorder — 같은 코드·모르는 코드·숨긴 사업·변화 없음은 null', () => {
  const biz = orderBiz();
  assert.equal(N.reorder({ biz, order: [] }, 'O-B', 'O-B', false), null, '자기 자신 앞');
  assert.equal(N.reorder({ biz, order: [] }, 'O-B', 'O-B', true), null, '자기 자신 뒤');
  assert.equal(N.reorder({ biz, order: [] }, 'NOPE', 'O-B', false), null, '모르는 코드');
  assert.equal(N.reorder({ biz, order: [] }, 'O-B', 'NOPE', true), null, '모르는 목표');
  assert.equal(N.reorder({ biz, order: ['GONE'] }, 'GONE', 'O-B', false), null, 'order 에만 있는 코드는 보이는 사업이 아니다');
  assert.equal(N.reorder({ biz: [{ code: 'O-H', name: '숨김', hidden: true }].concat(biz), order: [] }, 'O-H', 'O-B', false), null, '숨긴 사업');
  assert.equal(N.reorder({ biz, order: [] }, 'O-B', 'O-C', false), null, '이미 그 자리(B 는 C 바로 앞)');
  assert.equal(N.reorder({ biz, order: [] }, 'O-B', 'O-A', true), null, '이미 그 자리(B 는 A 바로 뒤)');
  assert.equal(N.reorder({ biz, order: [] }, 'O-D', 'O-C', true), null, '마지막 사업을 끝 바로 앞 사업 뒤로 = 그대로');
  assert.equal(N.reorder({ biz, order: [] }, 'O-A', 'O-B', false), null, '첫 사업을 둘째 앞으로 = 그대로');
  assert.equal(N.reorder({ biz, order: [] }, undefined, 'O-B', false), null);
  assert.equal(N.reorder({ biz, order: [] }, 'O-A', null, false), null);
  assert.equal(N.reorder(), null);
  assert.equal(N.reorder({}, 'O-A', 'O-B', false), null);
});

test('reorder — 입력 불변 · after 는 참/거짓으로만 · 결과가 rankMap 의 order 로 쓰이면 같은 순서를 만든다', () => {
  const biz = orderBiz(), order = ['O-D', 'O-C'];
  const snap = JSON.stringify([biz, order]);
  const out = N.reorder({ biz, order }, 'O-A', 'O-D', false);
  assert.equal(JSON.stringify([biz, order]), snap, '입력 불변');
  assert.notEqual(out, order, '새 배열');
  assert.deepEqual(ranked({ biz, order: out }), out, '결과를 order 로 쓰면 그 순서가 그대로 선다');
  assert.deepEqual(N.reorder({ biz, order: [] }, 'O-A', 'O-C', 1), ['O-B', 'O-C', 'O-A', 'O-D'], '참으로 보이는 값은 뒤');
  assert.deepEqual(N.reorder({ biz, order: [] }, 'O-A', 'O-C'), ['O-B', 'O-A', 'O-C', 'O-D'], 'after 를 안 주면 앞');
});

test('orderEntry — 정상 · 중복·꼴·개수·길이 위반은 null · by 40자 · now 가 숫자여야', () => {
  assert.deepEqual(N.orderEntry(['A', 'B'], '홍길동', 1760000000000), { list: 'A,B', by: '홍길동', at: 1760000000000 });
  assert.equal(N.orderEntry(['A'], 'ㄱ'.repeat(50), 5).by.length, 40, 'by 는 40자');
  assert.equal(N.orderEntry(['A'], ' 홍길동 ', 5).by, '홍길동', '앞뒤 공백은 뗀다');
  assert.equal('by' in N.orderEntry(['A'], '', 5), false, '이름이 비면 칸을 두지 않는다');
  assert.equal('by' in N.orderEntry(['A'], undefined, 5), false);
  assert.equal(N.orderEntry(['A', 'B', 'A'], 'x', 5), null, '중복');
  ['A b', '가나', 'a/b', 'a,b', '', 'a'.repeat(41), '__proto__', 'constructor', 'prototype'].forEach((c) =>
    assert.equal(N.orderEntry(['OK', c], 'x', 5), null, '코드 ' + JSON.stringify(c)));
  [5, null, {}, undefined].forEach((c) => assert.equal(N.orderEntry(['OK', c], 'x', 5), null, '코드가 문자열이 아님 ' + String(c)));
  ['A,B', null, undefined, 5, {}, { 0: 'A', length: 1 }].forEach((l) => assert.equal(N.orderEntry(l, 'x', 5), null, '목록이 배열이 아님 ' + JSON.stringify(l)));
  assert.equal(N.orderEntry([], 'x', 5), null, '빈 목록은 만들지 않는다');
  const n = (k) => Array.from({ length: k }, (_, i) => 'C' + i);
  assert.equal(N.orderEntry(n(200), 'x', 5).list.split(',').length, 200, '200 개는 된다');
  assert.equal(N.orderEntry(n(201), 'x', 5), null, '201 개');
  const long = (last) => Array.from({ length: 97 }, (_, i) => String(i).padStart(2, '0') + 'a'.repeat(38)).concat(['b'.repeat(last)]);
  assert.equal(N.orderEntry(long(23), 'x', 5).list.length, 4000, '전체 길이 4000 은 된다');
  assert.equal(N.orderEntry(long(24), 'x', 5), null, '4001 자');
  [undefined, null, NaN, Infinity, '5'].forEach((now) => assert.equal(N.orderEntry(['A'], 'x', now), null, 'now=' + String(now)));
  const a = ['A', 'B'], snap = JSON.stringify(a);
  N.orderEntry(a, 'x', 5);
  assert.equal(JSON.stringify(a), snap, '입력 불변');
});

test('orderEntry ↔ parseOrder — 만든 기록을 다시 읽으면 같은 목록 · 만든 칸은 규칙이 아는 칸(list·by·at)뿐', () => {
  const list = ['N-B', 'N-A', 'x_1'];
  const e = N.orderEntry(list, '홍길동', 5);
  assert.deepEqual(N.parseOrder(e), list);
  assert.deepEqual(Object.keys(e).sort(), ['at', 'by', 'list']);
  assert.deepEqual(Object.keys(N.orderEntry(list, '', 5)).sort(), ['at', 'list']);
});

test('build — 진행 사업은 업체 수 내림차순이 아니다 · 이알피 순서(sortOrder → 이름)', () => {
  const m = mk();
  m.biz.find((b) => b.code === 'N-B').sortOrder = 0;   /* 업체 1 인 N-B 가 업체 2 인 N-A 보다 이알피 순서가 앞 */
  const r = N.build({ biz: m.biz, tmap: m.tmap, input: m.input, year: '2026', state: {} });
  assert.deepEqual(codes(r.open), ['N-B', 'N-A', 'N-F', 'N-G', 'N-H'], 'N-B(업체 1)가 N-A(업체 2) 앞 — 업체 수로 정렬하지 않는다');
  assert.deepEqual(r.open.map((x) => x.count), [1, 2, 1, 1, 1]);
  assert.equal(r.total, 6, 'total 은 그대로 open 의 count 합');
});

test('build — order 가 있으면 각 묶음이 그 순서로 · 진행 사업도 · 목록에 없는 사업은 뒤에 이알피 순서', () => {
  const st = { 'N-F': { closedFrom: '2026', at: 1 } };
  const r = bld({ state: st, order: ['N-H', 'N-G', 'N-B'] });
  assert.deepEqual(codes(r.open), ['N-H', 'N-G', 'N-B', 'N-A'], '진행: order 의 N-H·N-G·N-B → 그 뒤 목록에 없는 N-A');
  assert.deepEqual(r.open.map((x) => x.count), [1, 1, 1, 2], '업체 수 2 인 N-A 가 맨 뒤여도 그대로');
  assert.equal(r.total, 5);
  const r2 = bld({ state: st, order: ['N-D', 'N-C', 'N-E', 'N-F'] });
  assert.deepEqual(codes(r2.quiet), ['N-C']);
  assert.deepEqual(codes(r2.noPlan), ['N-D']);
  assert.deepEqual(codes(r2.unlinked), ['N-E']);
  assert.deepEqual(codes(r2.closed), ['N-F']);
  assert.deepEqual(codes(r2.open), ['N-A', 'N-B', 'N-G', 'N-H'], 'order 에 없는 진행 사업은 이알피 순서');
  /* 묶음을 건너 섞인 order — 한 묶음 안에서는 order 의 상대 순서만 쓴다 */
  const m = mk();
  const r3 =N.build({ biz: m.biz, tmap: m.tmap, input: m.input, year: '2026', state: {}, order: ['N-H', 'N-C', 'N-A', 'N-E', 'N-B'] });
  assert.deepEqual(codes(r3.open), ['N-H', 'N-A', 'N-B', 'N-F', 'N-G']);
  assert.deepEqual(codes(r3.quiet), ['N-C']);
});

test('build — order 에만 있는 코드·이상한 order 는 던지지 않는다 · order 없으면 이알피 순서와 같다 · 입력 불변', () => {
  const base = bld();
  assert.deepEqual(base, bld({ order: [] }), 'order 가 비면 order 없는 것과 같다');
  assert.deepEqual(base, bld({ order: ['GONE', 'N-ZZ'] }), 'order 에만 있는 코드는 무시');
  [null, 'N-A,N-B', 5, {}].forEach((bad) => assert.deepEqual(base, bld({ order: bad }), 'order=' + JSON.stringify(bad)));
  assert.deepEqual(codes(bld({ order: ['GONE', 'N-H'] }).open), ['N-H', 'N-A', 'N-B', 'N-F', 'N-G']);
  const order = ['N-H', 'N-A'], snap = JSON.stringify(order);
  bld({ order });
  assert.equal(JSON.stringify(order), snap, 'order 불변');
  /* 출력 모양은 그대로 */
  const r = bld({ order });
  assert.deepEqual(Object.keys(r).sort(), ['closed', 'noPlan', 'open', 'quiet', 'total', 'unlinked']);
  assert.deepEqual(Object.keys(r.open[0]).sort(), ['agency', 'closedFrom', 'code', 'count', 'kind', 'label', 'name', 'plan', 'typeId']);
});

test('build — 이름 같고 기관만 다른 두 사업도 order 의 코드로 구분된다', () => {
  assert.deepEqual(codes(bld({ order: ['N-H', 'N-G'] }).open).filter((c) => c === 'N-G' || c === 'N-H'), ['N-H', 'N-G']);
  assert.deepEqual(codes(bld({ order: ['N-G', 'N-H'] }).open).filter((c) => c === 'N-G' || c === 'N-H'), ['N-G', 'N-H']);
});
