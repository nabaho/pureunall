/* 기업규정집 — 규정 분류(취업규칙·노사협의회·단체협약) 셈 (2026-11-01 대표 「분류해서 정리」 · 「노사협의회와 단체협약은 분리」)
   js/rules-v2/lib-set.js
   ★ 못 박는 것
     ① 분류가 없으면 «취업규칙» — 지금까지 모은 서류가 그대로 취업규칙에 남는다(취업규칙은 기존대로)
     ② 파일 이름 > 글 머리 > 메일 제목 > 취업규칙 — 취업규칙 «본문 안»의 상호참조 낱말이 분류를 뒤집지 못한다
     ③ 한 글자에 여러 낱말이면 «가장 앞»이 이긴다
     ④ 사람이 고친 값 > 서버가 찍은 값 > 이름 짐작
     ⑤ scope — 한 분류로 좁히고, 다른 칸은 그대로 건네고, 회차 id 이름공간(ns)을 단다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/rules-v2/lib-set.js');

test('① 이름도 글도 제목도 말이 없으면 취업규칙 · 서류에 분류 칸이 없어도 취업규칙', () => {
  assert.equal(S.setOfName('1.hwp', '', ''), '취업규칙');
  assert.equal(S.setOfName('', '', ''), '취업규칙');
  assert.equal(S.setOfName(null, undefined, null), '취업규칙');
  assert.equal(S.docSet({ name: '규정(최종).hwp' }, {}), '취업규칙');
  assert.equal(S.docSet(null, null), '취업규칙');
  assert.equal(S.DEFAULT, '취업규칙');
});

test('② 파일 이름이 먼저 — 이름에 말이 없으면 글 머리, 그래도 없으면 메일 제목', () => {
  assert.equal(S.setOfName('노사협의회규정.hwp', '취업규칙 개정 건', ''), '노사협의회', '이름이 제목을 이긴다');
  assert.equal(S.setOfName('단체협약서_2025.pdf', '', ''), '단체협약');
  assert.equal(S.setOfName('단체 협약(안).hwp', '', ''), '단체협약', '띄어 써도');
  assert.equal(S.setOfName('최종.hwp', '', '노사협의회 규정\n제1조(목적) …'), '노사협의회', '이름에 말이 없으면 글 머리');
  assert.equal(S.setOfName('최종.hwp', '[단체협약] 갱신 건', '제1조(목적) 이 협약은'), '단체협약', '글 머리에도 없으면 메일 제목');
  assert.equal(S.setOfName('최종.hwp', '안녕하세요', ''), '취업규칙');
  // 글 «전체»는 보지 않는다 — 머리(HEAD) 밖의 낱말은 무시
  const body = '취업규칙\n' + '가'.repeat(S.HEAD) + '\n노사협의회 단체협약';
  assert.equal(S.setOfName('최종.hwp', '', body), '취업규칙', '취업규칙 본문 뒤쪽의 상호참조 낱말에 끌려가면 안 된다');
  assert.equal(S.setOfName('최종.hwp', '', '제1조(목적) …' + '가'.repeat(S.HEAD) + '단체협약'), '취업규칙');
});

test('③ 한 글자에 여러 낱말이면 가장 앞에 나온 것', () => {
  assert.equal(S.firstIn('단체협약서(취업규칙 반영).hwp'), '단체협약');
  assert.equal(S.firstIn('취업규칙 및 노사협의회규정.hwp'), '취업규칙');
  assert.equal(S.firstIn('노사협의회규정과 단체협약'), '노사협의회');
  assert.equal(S.firstIn('아무 말 없음'), '');
});

test('④ 사람이 고친 값 > 서버가 찍은 값 > 이름 짐작 · 알 수 없는 값은 무시', () => {
  const doc = { name: '노사협의회규정.hwp', set: '단체협약' };
  assert.equal(S.docSet(doc, { setFix: '취업규칙' }), '취업규칙');
  assert.equal(S.docSet(doc, {}), '단체협약');
  assert.equal(S.docSet({ name: '노사협의회규정.hwp' }, {}), '노사협의회', '옛 서류는 이름으로 짐작');
  assert.equal(S.docSet(doc, { setFix: '엉뚱한값' }), '단체협약', '모르는 setFix 는 무시');
  assert.equal(S.docSet({ name: '단체협약.hwp', set: '엉뚱한값' }, {}), '단체협약', '모르는 찍힌 값도 무시');
});

const DATA = () => ({
  docs: {
    a: { name: '취업규칙.hwp', kind: '규칙본문', status: '담김' },
    b: { name: '노사협의회규정.hwp', kind: '규칙본문', status: '담김', set: '노사협의회' },
    c: { name: '단체협약서.hwp', kind: '규칙본문', status: '보류', set: '단체협약' },
    d: { name: '규정.hwp', kind: '규칙본문', status: '담김' },
    e: { name: '고친.hwp', kind: '규칙본문', status: '담김', set: '취업규칙' }
  },
  human: { a: { companyId: 'c1' }, b: { companyId: 'c2' }, d: { setFix: '단체협약' }, zz: { companyId: 'gone' } },
  rounds: { c1_r202601: { finalDocId: 'a' } }, run: { at: 1 }, auto: { mode: 'live' }, index: { x: 1 }
});

test('⑤ scope — 한 분류로 좁히고 다른 칸은 그대로, ns 를 단다', () => {
  const d = DATA();
  const p = S.scope(d, '취업규칙');
  assert.deepEqual(Object.keys(p.docs).sort(), ['a', 'e']);
  assert.deepEqual(Object.keys(p.human), ['a'], '넘긴 서류의 사람 칸만 — 서류 없는 사람 칸(zz)·다른 분류의 칸은 안 넘긴다');
  assert.equal(p.set, '취업규칙'); assert.equal(p.ns, '');
  const w = S.scope(d, '노사협의회');
  assert.deepEqual(Object.keys(w.docs), ['b']); assert.equal(w.ns, 'wc');
  const c = S.scope(d, '단체협약');
  assert.deepEqual(Object.keys(c.docs).sort(), ['c', 'd'], '사람이 단체협약으로 옮긴 d 가 따라온다');
  assert.equal(c.ns, 'cba');
  [p, w, c].forEach((x) => { assert.deepEqual(x.rounds, d.rounds); assert.deepEqual(x.run, d.run); assert.deepEqual(x.auto, d.auto); assert.deepEqual(x.index, d.index); });
  // 원본은 건드리지 않는다
  assert.equal(Object.keys(d.docs).length, 5);
  assert.equal(S.scope(d, '모르는분류').set, '취업규칙', '모르는 분류는 취업규칙');
  assert.deepEqual(S.scope(null, '단체협약').docs, {});
});

test('⑤ 분류별 서류 수 — 담김·보류 모두, 합이 전체', () => {
  const c = S.counts(DATA());
  assert.deepEqual(c, { 취업규칙: 2, 노사협의회: 1, 단체협약: 2 });
  assert.equal(c.취업규칙 + c.노사협의회 + c.단체협약, 5);
  assert.deepEqual(S.counts({}), { 취업규칙: 0, 노사협의회: 0, 단체협약: 0 });
});

test('분류 표 — 취업규칙의 ns 는 빈 글자(옛 회차 id 그대로) · 나머지는 ASCII 이름공간', () => {
  assert.equal(S.nsOf('취업규칙'), '');
  S.SETS.forEach((s) => { assert.ok(/^[a-z]*$/.test(s.ns), s.key + ' 의 ns 에 파이어베이스 열쇠로 못 쓸 글자가 있다'); assert.ok(s.icon && s.title); });
  assert.equal(new Set(S.SETS.map((s) => s.ns)).size, S.SETS.length, 'ns 가 겹치면 회차 레코드가 서로 덮는다');
  assert.deepEqual(S.SETS.map((s) => s.key), ['취업규칙', '노사협의회', '단체협약'], '취업규칙이 맨 앞(기본)');
});

/* ⑥ 회차 id 이름공간 — 같은 사업장·같은 달의 취업규칙 회차와 노사협의회 회차가 서로 덮지 않는다 */
const O = require('../js/rules-v2/lib-order.js');
test('⑥ companyGroups 의 ns — 취업규칙은 옛 id 그대로, 다른 분류는 이름공간이 붙어 최종본 표시가 안 섞인다', () => {
  const day = Date.UTC(2026, 5, 10);
  const docs = {
    t1: { name: '취업규칙.hwp', kind: '규칙본문', status: '담김', dir: '받음', createdAt: 1, mail: { src: 'imap', box: 'in', key: '1', date: day } },
    w1: { name: '노사협의회규정.hwp', kind: '규칙본문', status: '담김', dir: '받음', createdAt: 2, mail: { src: 'imap', box: 'in', key: '2', date: day }, set: '노사협의회' }
  };
  const human = { t1: { companyId: 'c1', companyLinkStatus: 'linked' }, w1: { companyId: 'c1', companyLinkStatus: 'linked' } };
  const rounds = { c1_r202606: { finalDocId: 't1' }, c1_wc_r202606: { finalDocId: 'w1' } };
  const run = (set) => { const d = S.scope({ docs, human, rounds }, set); return O.companyGroups(O.merge(d.docs, d.human), d.rounds, d.ns); };
  const t = run('취업규칙'), w = run('노사협의회');
  assert.equal(t.length, 1); assert.equal(w.length, 1);
  assert.equal(t[0].roundId, 'c1_r202606', '취업규칙의 회차 id 가 바뀌면 이미 적어 둔 ★최종본이 사라진다');
  assert.equal(w[0].roundId, 'c1_wc_r202606');
  assert.equal(t[0].finalDocId, 't1'); assert.equal(w[0].finalDocId, 'w1');
  // ns 를 안 넘기면(옛 호출) 취업규칙과 같은 id
  assert.equal(O.companyGroups(O.merge(S.scope({ docs, human, rounds }, '취업규칙').docs, human), rounds)[0].roundId, 'c1_r202606');
});
