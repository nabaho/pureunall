'use strict';
/* 🎯 지원할 만한 것 추리기 (js/gov-pick.js) — 대표 지시 2026-10-24 「푸른노무법인이나 권형하 노무사가 지원할 만한 컨설턴트 또는 사업을 팝업으로」 */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/gov-pick.js');
const R = require('../js/gov-recruit.js');

const TODAY = '2026-10-24';
const deps = (over) => Object.assign({
  kindOf: R.kindOf, kindInfo: R.kindInfo,
  dueOf: (h) => R.dueState(h.per || null, TODAY),
  matchHit: () => null, matchFeed: () => null,
  orgName: (id) => ({ nosa: '노사발전재단', erc: '지방공기업평가원' }[id] || id),
  monthsAhead: R.monthsAhead, appliedThisYear: R.appliedThisYear
}, over || {});
const hit = (key, title, extra) => Object.assign({ key, title, org: 'erc', boardName: '지방공기업평가원 공지', date: '2026-10-20', href: 'https://erc.example/' + key, per: { to: '2026-11-20' } }, extra || {});
const row = (no, nm, extra) => Object.assign({ id: 'G' + no, no, nm, org: '어느 기관', src: '나라장터', type: '새 공고', closeDt: '2026-11-20 10:00:00', dday: 27, url: 'https://g2b.example/' + no }, extra || {});
const rank = (o) => P.rank(Object.assign({ today: TODAY, hits: [], feed: [], orgs: [], deps: deps() }, o));

test('★ 지역 제한 판정 — 우리 지역 포함(in) / 없음(out) / 정보 없음(none, «없다»고 하지 않는다)', () => {
  assert.equal(P.regionFit('충청남도 · 세종특별자치시 · 서울특별시').k, 'in');
  assert.deepEqual(P.regionFit('충청남도 · 서울특별시').hit, ['충남']);
  assert.equal(P.regionFit('서울특별시 · 경기도').k, 'out');
  assert.equal(P.regionFit('대전').k, 'in', '기업마당은 짧은 이름');
  assert.equal(P.regionFit('').k, 'none'); assert.equal(P.regionFit(null).k, 'none');
  assert.equal(P.regionFit('충남대학교').k, 'none', '다른 말 속의 글자는 지역이 아니다');
});

test('★★ 모집 글 — 접수 중·곧 마감만, 행사·후보 추천·지난 글은 뺀다 · 곧 마감이 맨 위', () => {
  const r = rank({ hits: [
    hit('a', '2026년 일터혁신 컨설턴트 모집', { per: { to: '2026-12-31' } }),
    hit('b', '2026년 노동 박람회 참여 노무사 모집'),                    // 행사
    hit('c', '위원 후보자 추천 안내'),                                    // 추천
    hit('d', '컨설턴트 모집', { per: { to: '2026-10-01' } }),            // 지남
    hit('e', '전문위원 위촉 공고', { per: { to: '2026-10-27' } })        // 곧 마감 D-3
  ] });
  assert.deepEqual(r.items.map((x) => x.key), ['e', 'a']);
  assert.match(r.items[0].why[0], /마감 3일 전/); assert.equal(r.items[0].due.k, 'soon');
  assert.equal(r.counts.hit, 2);
});

test('★ 기간을 모르는 모집 글은 «최근 글(45일 안)»만 — 옛 글이 영영 떠 있으면 안 된다', () => {
  const none = (extra) => hit('x', '컨설턴트 모집', Object.assign({ per: null }, extra));
  assert.equal(rank({ hits: [none({ date: '2026-10-10' })] }).items.length, 1);
  assert.equal(rank({ hits: [none({ date: '2026-08-01' })] }).items.length, 0);
  assert.equal(rank({ hits: [none({ date: '' })] }).items.length, 0, '날짜도 모르면 안 올린다');
});

test('★★ 지난 이력과 같은/비슷한 것은 점수·까닭이 붙고, 해마다 지원한 기관이면 더 앞선다', () => {
  const same = { same: [{}, {}], similar: [] }, sim = { same: [], similar: [{}] };
  const r = rank({
    hits: [hit('a', '컨설턴트 모집', { per: { to: '2026-12-31' }, org: 'nosa' }), hit('b', '컨설턴트 모집 2', { per: { to: '2026-12-31' } }), hit('c', '컨설턴트 모집 3', { per: { to: '2026-12-31' } })],
    orgs: [{ id: 'nosa', name: '노사발전재단', years: ['2023', '2024', '2025'], month: 2 }],
    deps: deps({ matchHit: (h) => (h.key === 'a' ? same : h.key === 'b' ? sim : null) })
  });
  assert.deepEqual(r.items.map((x) => x.key), ['a', 'b', 'c']);
  assert.ok(r.items[0].why.some((w) => /같은 기관·사업 2건/.test(w)) && r.items[0].why.some((w) => /2023·2024·2025 지원한 기관/.test(w)));
  assert.ok(r.items[1].why.some((w) => /비슷한 이력 1건/.test(w)));
  assert.deepEqual(r.items[2].why, [], '근거 없는 줄은 까닭도 없다(지어내지 않는다)');
});

test('★★ 공고 — 별표·숨김·지나감·지원함은 빼고 별표는 따로 센다 · 마감 지난 것 뺌', () => {
  const r = rank({ feed: [
    row('1', '새 용역'), row('2', '별표', { type: '관심' }), row('3', '숨김', { hidden: true }),
    row('4', '지나감', { type: '지나감' }), row('5', '지원함', { type: '지원함' }), row('6', '마감 지남', { dday: -1, closeDt: '2026-10-20 10:00:00' })
  ] });
  assert.deepEqual(r.items.map((x) => x.key), ['f|1']);
  assert.equal(r.counts.starred, 1);
});

test('★★★ 지역 제한이 우리 지역이 아니면 «뒤로» + 까닭 · 포함이면 앞 + 까닭 · 정보 없으면 그냥 · 업종 제한·수의계약은 감점', () => {
  const r = rank({ feed: [
    row('1', '서울만 용역', { rgn: '서울특별시 · 경기도' }),
    row('2', '충남 포함 용역', { rgn: '충청남도 · 세종특별자치시' }),
    row('3', '제한 정보 없는 용역'),
    row('4', '업종제한 용역', { indY: 'Y' }),
    row('5', '수의 용역', { mthd: '수의계약' })
  ] });
  const by = (k) => r.items.find((x) => x.key === k);
  assert.equal(r.items[r.items.length - 1].key, 'f|1'); assert.equal(by('f|1').out, true);
  assert.match(by('f|1').why.join(' '), /지역 제한 — 우리 지역 아님\(서울·경기\)/);
  assert.equal(r.items[0].key, 'f|2'); assert.match(by('f|2').why.join(' '), /우리 지역 포함\(충남·세종\)/);
  assert.ok(by('f|3').score > by('f|4').score && by('f|3').score > by('f|5').score);
  assert.match(by('f|4').why.join(' '), /업종·면허 제한 있음/); assert.match(by('f|5').why.join(' '), /수의계약/);
  assert.equal(r.counts.out, 1);
  assert.ok(!by('f|3').why.some((w) => /지역/.test(w)), '모르는 지역을 «없다»로 적지 않는다');
});

test('★ 마감 7일 안 공고는 맨 위 · 마감 모르면 점수 보탬 없음', () => {
  const r = rank({ feed: [row('1', '먼 마감', { dday: 30, closeDt: '2026-11-23 10:00:00' }), row('2', '곧 마감', { dday: 3, closeDt: '2026-10-27 10:00:00' }), row('3', '마감 모름', { dday: undefined, closeDt: '' })] });
  assert.deepEqual(r.items.map((x) => x.key), ['f|2', 'f|1', 'f|3']);
  assert.equal(r.items[0].due.k, 'soon'); assert.equal(r.items[2].due.k, 'unknown');
});

test('★★ 해마다 지원하던 기관 — 이번·다음 달에 열리던 곳만 · 올해 이미 냈거나 접수 중 글이 있으면 뺀다', () => {
  const orgs = [
    { id: 'a', name: '이번달 기관', years: ['2024', '2025'], month: 10 },
    { id: 'b', name: '다음달 기관', years: ['2025'], month: 11 },
    { id: 'c', name: '석 달 뒤 기관', years: ['2025'], month: 1 },
    { id: 'd', name: '올해 이미 냄', years: ['2026'], month: 10 },
    { id: 'e', name: '접수 중 글 있음', years: ['2025'], month: 10 },
    { id: 'f', name: '이력 없음', years: [], month: 10 }
  ];
  const r = rank({ orgs, hits: [hit('x', '컨설턴트 모집', { org: 'e', per: { to: '2026-12-31' } })] });
  const orgItems = r.items.filter((x) => x.kind === 'org');
  assert.deepEqual(orgItems.map((x) => x.org), ['이번달 기관', '다음달 기관']);
  assert.match(orgItems[0].why.join(' '), /2024·2025 지원한 기관/); assert.match(orgItems[0].why.join(' '), /이번 달\(10월\)/);
  assert.equal(orgItems[0].key, 'o|a|2026'); assert.equal(r.counts.org, 2);
});

test('★★ 이 팝업에서 숨긴 것(off)은 세 갈래 모두 빠진다 · 지우지 않는다(입력을 안 바꾼다)', () => {
  const hits = [hit('a', '컨설턴트 모집', { per: { to: '2026-12-31' } })], feed = [row('1', '새 용역')];
  const orgs = [{ id: 'a', name: '이번달 기관', years: ['2025'], month: 10 }];
  const before = JSON.stringify({ hits, feed, orgs });
  const r = rank({ hits, feed, orgs, off: { a: '2026-10-24', 'f|1': '2026-10-24', 'o|a|2026': '2026-10-24' } });
  assert.equal(r.items.length, 0);
  assert.equal(JSON.stringify({ hits, feed, orgs }), before, '입력을 고쳤다');
});

test('★ 봤음(seen)은 새 글 표시를 끄고 조금 뒤로 · 갈래도 모르고 이력도 없는 기타 글은 잡음이라 뺀다', () => {
  const r = rank({ hits: [hit('a', '컨설턴트 모집', { per: { to: '2026-12-31' } }), hit('b', '컨설턴트 모집 2', { per: { to: '2026-12-31' } }), hit('z', '사무실 이전 안내', { per: { to: '2026-12-31' } })], seen: { a: 1 } });
  assert.deepEqual(r.items.map((x) => x.key), ['b', 'a']);
  assert.equal(r.items[0].isNew, true); assert.equal(r.items[1].isNew, false);
});

test('★ worthy — 자동으로 띄울 만한가: 곧 마감이거나 이력 맞는 «쓸 만한 줄»이 있을 때만 · 지역 밖뿐이면 안 뜬다', () => {
  assert.equal(P.worthy(rank({})), 0);
  assert.equal(P.worthy(rank({ feed: [row('1', '먼 마감 용역', { dday: 40, closeDt: '2026-12-03 10:00:00' })] })), 0, '평범한 줄만으로는 자동으로 안 띄운다');
  assert.equal(P.worthy(rank({ feed: [row('1', '곧 마감', { dday: 2, closeDt: '2026-10-26 10:00:00' })] })), 1);
  assert.equal(P.worthy(rank({ feed: [row('1', '서울만 곧 마감', { dday: 2, closeDt: '2026-10-26 10:00:00', rgn: '서울특별시' })] })), 0, '지역 밖은 세지 않는다');
});

test('★ 빈 입력·모르는 꼴에도 던지지 않는다', () => {
  assert.deepEqual(P.rank().items, []);
  assert.deepEqual(P.rank({ hits: [null, {}, { key: 'k' }], feed: [null, {}], orgs: [null, {}], deps: {} }).items, []);
});
