// 취업규칙(새) 「모은 자료」 화면 셈 — 순수 모듈 검사. 이름은 가짜(가나상사)만.
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../js/rules-v2/lib-order.js');
const D = (id, o) => Object.assign({ id, kind: '규칙본문', dir: '받음', status: '담김', name: id + '.hwp', createdAt: 1,
  mail: { src: 'imap', box: 'INBOX', key: id, date: 0 } }, o);
const day = (n) => Date.UTC(2026, 0, 1) + n * 864e5;
const docs = {
  a: D('a', { mail: { src: 'imap', box: 'INBOX', key: 'm1', date: day(0) }, createdAt: 5 }),                 // 현행(회사가 보냄)
  b: D('b', { dir: '보냄', mail: { src: 'imap', box: 'Sent', key: 'm2', date: day(30) }, createdAt: 3 }),    // 1판
  c: D('c', { dir: '보냄', name: '가나상사_취업규칙_최종.hwp', mail: { src: 'imap', box: 'Sent', key: 'm3', date: day(60) }, createdAt: 4 }),
  d: D('d', { kind: '동의서', mail: { src: 'imap', box: 'INBOX', key: 'm3x', date: day(61) }, createdAt: 6 }),
  e: D('e', { kind: '신고서', mail: { src: 'imap', box: 'INBOX', key: 'm4', date: day(70) }, createdAt: 2 }),
  f: D('f', { dir: '보냄', mail: { src: 'imap', box: 'Sent', key: 'm5', date: day(400) }, createdAt: 7 }),   // 다음 회차(공백)
  g: D('g', { mail: { src: 'imap', box: 'INBOX', key: 'm1', date: day(0) }, createdAt: 8, kind: '기타' }),   // a 와 같은 메일
};
const human = {};
'abcdefg'.split('').forEach((k) => { human[k] = { companyId: 'co_gana', companyLinkStatus: 'linked' }; });

test('번호는 모은 차례', () => {
  const n = O.numberOf(O.merge(docs, human));
  assert.equal(n.e, 1); assert.equal(n.b, 2); assert.equal(n.g, 7);
});

test('메일 한 통 아래에 그 첨부들 — 메일 최근 것 먼저', () => {
  const g = O.byMail(O.merge(docs, human));
  assert.equal(g[0].items[0].id, 'f');
  const m1 = g.find((x) => x.items.some((i) => i.id === 'a'));
  assert.deepEqual(m1.items.map((i) => i.id).sort(), ['a', 'g']);
});

test('회차는 신고서 뒤·반년 공백에서 끊는다', () => {
  const r = O.roundsOf(O.merge(docs, human));
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].items.map((i) => i.id), ['a', 'g', 'b', 'c', 'd', 'e']);
  assert.deepEqual(r[1].items.map((i) => i.id), ['f']);
  assert.equal(r[0].roundKey, 'r202601');
});

test('사람이 고친 회차가 이긴다', () => {
  const h2 = JSON.parse(JSON.stringify(human)); h2.f.round = 'r202601';
  const r = O.roundsOf(O.merge(docs, h2));
  assert.equal(r.length, 1);
});

test('판 순서 — 회사가 먼저 보낸 것은 현행 0, 그 뒤 1·2', () => {
  const r = O.roundsOf(O.merge(docs, human))[0];
  assert.deepEqual(O.versionsOf(r).map((v) => v.item.id + ':' + v.no), ['a:0', 'b:1', 'c:2']);
});

test('최종본 후보와 근거', () => {
  const r = O.roundsOf(O.merge(docs, human))[0];
  const c = O.finalCandOf(r);
  assert.ok(c.c.includes('신고서 메일 바로 앞 판'));
  assert.ok(c.c.includes('파일 이름에 「최종·신고용」'));
  assert.equal(c.a, undefined);
});

test('사업장별 묶음 — 최종본 미정인 회차 먼저', () => {
  const items = O.merge(docs, human);
  const groups = O.companyGroups(items, { 'co_gana_r202601': { finalDocId: 'c' } });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].finalDocId, null, '미정 회차가 앞');
  assert.equal(groups[1].finalDocId, 'c');
});

test('사업장 미확정은 사업장별 보기에 안 들어간다', () => {
  const items = O.merge(docs, {});
  assert.equal(O.companyGroups(items, {}).length, 0);
});

test('최종본으로 적힌 문서가 그 회차에 없으면 최종본 없음으로 본다', () => {
  const items = O.merge(docs, human);
  const groups = O.companyGroups(items, { 'co_gana_r202601': { finalDocId: 'f' } });
  groups.forEach((g) => assert.equal(g.finalDocId, null));
});
