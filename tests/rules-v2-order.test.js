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
  d: D('d', { kind: '동의서', dir: '보냄', mail: { src: 'imap', box: 'Sent', key: 'm3', date: day(60) }, createdAt: 6 }),  // c 와 같은 메일
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

const link = (dd) => { const hh = {}; Object.keys(dd).forEach((k) => { hh[k] = { companyId: 'co_gana', companyLinkStatus: 'linked' }; }); return hh; };

test('같은 달에 신고서 뒤 새 회차가 열려도 회차 이름이 겹치지 않는다', () => {
  const t = (n) => Date.UTC(2026, 0, n, 3);
  const dd = {
    p1: D('p1', { mail: { src: 'imap', box: 'INBOX', key: 'p1', date: t(2) } }),
    p2: D('p2', { dir: '보냄', mail: { src: 'imap', box: 'Sent', key: 'p2', date: t(5) } }),
    rp: D('rp', { kind: '신고서', mail: { src: 'imap', box: 'INBOX', key: 'rp', date: t(10) } }),
    p3: D('p3', { dir: '보냄', mail: { src: 'imap', box: 'Sent', key: 'p3', date: t(20) } }),
  };
  const hh = link(dd);
  const r = O.roundsOf(O.merge(dd, hh));
  assert.deepEqual(r.map((x) => x.roundKey), ['r202601', 'r202601b']);
  assert.deepEqual(r[1].items.map((i) => i.id), ['p3']);
  assert.ok(O.finalCandOf(r[0]).p2.includes(O.R_REPORT), '신고서 앞 판은 첫 회차의 p2');
  // 사람이 고른 회차는 접미 이름에도 합쳐진다
  const h2 = JSON.parse(JSON.stringify(hh)); h2.p1.round = 'r202601b';
  const r2 = O.roundsOf(O.merge(dd, h2));
  assert.deepEqual(r2.find((x) => x.roundKey === 'r202601b').items.map((i) => i.id).sort(), ['p1', 'p3']);
});

test('회차 이름의 연월은 한국 시간 — UTC 12월 31일 23시는 한국 1월', () => {
  const dd = { k: D('k', { mail: { src: 'imap', box: 'INBOX', key: 'k', date: Date.UTC(2025, 11, 31, 23) } }) };
  const r = O.roundsOf(O.merge(dd, link(dd)));
  assert.equal(r[0].roundKey, 'r202601');
});

test('동의서와 같은 메일일 때만 근거가 붙는다 — 날짜만 가까운 판은 아니다', () => {
  const r = O.roundsOf(O.merge(docs, human))[0];
  assert.ok(O.finalCandOf(r).c.includes('동의서와 같은 메일'));
  const dd = {
    v: D('v', { dir: '보냄', mail: { src: 'imap', box: 'Sent', key: 'v', date: day(10) } }),
    ag: D('ag', { kind: '동의서', mail: { src: 'imap', box: 'INBOX', key: 'ag', date: day(10) } }),
  };
  const r2 = O.roundsOf(O.merge(dd, link(dd)))[0];
  assert.equal(O.finalCandOf(r2).v, undefined);
});

test('신고서와 같은 메일의 다른 첨부는 그 회차에 남는다', () => {
  const t = (n) => Date.UTC(2026, 2, n, 3);
  const dd = {
    a1: D('a1', { mail: { src: 'imap', box: 'INBOX', key: 'x1', date: t(1) } }),
    b1: D('b1', { kind: '신고서', mail: { src: 'imap', box: 'INBOX', key: 'x2', date: t(5) } }),
    b2: D('b2', { kind: '기타', mail: { src: 'imap', box: 'INBOX', key: 'x2', date: t(5) } }),
    c1: D('c1', { mail: { src: 'imap', box: 'INBOX', key: 'x3', date: t(6) } }),
  };
  const r = O.roundsOf(O.merge(dd, link(dd)));
  assert.deepEqual(r[0].items.map((i) => i.id), ['a1', 'b1', 'b2']);
  assert.deepEqual(r[1].items.map((i) => i.id), ['c1']);
});

test('날짜를 모르는 것은 자기 회차 — 1970년 회차도, 다음 회차 삼키기도 없다', () => {
  const dd = {
    u: D('u', { mail: { src: 'imap', box: 'INBOX', key: 'u', date: 0 } }),
    w: D('w', { mail: { src: 'imap', box: 'INBOX', key: 'w', date: day(5) } }),
  };
  const r = O.roundsOf(O.merge(dd, link(dd)));
  assert.equal(r.length, 2);
  assert.ok(!r.some((x) => x.roundKey === 'r197001'));
  assert.deepEqual(r.find((x) => x.roundKey === 'r202601').items.map((i) => i.id), ['w']);
  assert.deepEqual(r.find((x) => x.roundKey === 'r000000').items.map((i) => i.id), ['u']);
});

test('파일 이름 근거는 최종·신고용만 — 「확정」 단어는 근거 아님', () => {
  const dd = { z: D('z', { name: '가나상사_확정본.hwp', mail: { src: 'imap', box: 'INBOX', key: 'z', date: day(1) } }) };
  const r = O.roundsOf(O.merge(dd, link(dd)))[0];
  assert.equal(O.finalCandOf(r).z, undefined);
});
