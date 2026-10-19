'use strict';
/* 서버가 매일 모은 공고(gov_feed/rows) → 내 목록에 합치기 (js/gov-inbox.js)
   대표 지시 2026-10-12 「매일매일 공고를 크롤링 하고 모을 수 있나? 그게 가능하게 만들어 달라」 */
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/gov-inbox.js');
const G = require('../js/gov-g2b.js');

const row = (no, nm, extra) => Object.assign({ no, nm, src: '나라장터', org: '기관', ntce: '공고기관', openDt: '2026-10-10 09:00:00', closeDt: '2026-10-30 10:00:00', prc: 5000000, mthd: '제한경쟁', url: 'https://g2b.go.kr/x', kw: '노무', at: '2026-10-12T22:40:00.000Z' }, extra || {});
const O = { today: '2026-10-12', dday: G.dday };

test('★ 내 목록에 없는 번호만 새 줄로 만든다 — 이미 있는 번호는(숨긴 것·지나간 것·별표 포함) 건드리지 않는다', () => {
  const feed = [{ id: 'G1', no: 'A', nm: '있는 줄' }, { id: 'G2', no: 'B', nm: '숨긴 줄', hidden: true }, { id: 'G3', no: 'C', nm: '별표', type: '관심' }];
  const m = I.merge(feed, { a: row('A', '있는 줄'), b: row('B', '숨긴 줄'), c: row('C', '별표'), d: row('D', '새 공고 노무') }, O);
  assert.deepEqual(m.adds.map((x) => x.no), ['D']);
  assert.equal(m.skipped, 3);
});
test('★★ 대표가 숨긴 공고는 서버가 또 보내도 되살아나지 않는다', () => {
  const feed = [{ id: 'G2', no: 'B', nm: '숨긴 줄', hidden: true }];
  const m = I.merge(feed, { b: row('B', '숨긴 줄') }, O);
  assert.equal(m.adds.length, 0);
});
test('★ 새 줄은 목록 줄과 같은 모양 — 상태 「새 공고」 · 받은 날 = 서버가 받은 때 · 남은 날 계산 · 연도', () => {
  const m = I.merge([], { d: row('D', '노무 용역') }, O);
  const x = m.adds[0];
  assert.equal(x.type, '새 공고'); assert.equal(x.savedAt, '2026-10-12T22:40:00.000Z'); assert.equal(x.year, '2026');
  assert.equal(x.dday, 19); assert.equal(x.src, '나라장터'); assert.equal(x.prc, 5000000); assert.equal(x.kw, '노무');
});
test('★ 지금 낱말(keep)에 안 맞는 것은 합치지 않는다 · 센다(dropped)', () => {
  const m = I.merge([], { a: row('A', '노무 용역'), b: row('B', '수출 마케팅') }, Object.assign({ keep: (r) => /노무/.test(r.nm) }, O));
  assert.deepEqual(m.adds.map((x) => x.no), ['A']); assert.equal(m.dropped, 1);
});
test('★ 오래된 줄부터 — 새 줄을 위에 쌓으면(unshift) 가장 새 공고가 맨 위에 온다', () => {
  const m = I.merge([], { x: row('X', '둘째', { at: '2026-10-12T22:40:00.000Z' }), y: row('Y', '첫째', { at: '2026-10-11T22:40:00.000Z' }) }, O);
  assert.deepEqual(m.adds.map((x) => x.no), ['Y', 'X']);
});
test('★ 번호·이름이 없는 줄·모르는 모양은 버린다 · https 가 아닌 주소는 지운다 · 같은 번호가 둘이면 한 번만', () => {
  const m = I.merge([], { a: { nm: '번호 없음' }, b: { no: 'B' }, n: null, c: row('C', '주소', { url: 'javascript:alert(1)' }), d1: row('D', '같은 번호'), d2: row('D', '같은 번호 또') }, O);
  assert.deepEqual(m.adds.map((x) => x.no).sort(), ['C', 'D']);
  assert.equal(m.adds.find((x) => x.no === 'C').url, '');
  assert.deepEqual(I.merge(null, null, O).adds, []);
});
test('★ 받은 함 자체는 고치지 않는다(읽기만)', () => {
  const rows = { a: row('A', '노무 용역') }, before = JSON.stringify(rows);
  I.merge([], rows, O); assert.equal(JSON.stringify(rows), before);
});

/* ── 서버 상태 한 줄 ── */
test('★ 상태 — 안 돌았음 / 오류 / 정상(서울 시각·출처별 건수·새로 걸린 건수) / 이틀 넘게 멈춤', () => {
  assert.equal(I.status(null, '2026-10-12').k, 'none');
  assert.match(I.status(null, '2026-10-12').text, /07:40/);
  const bad = I.status({ error: '인증키를 찾지 못했습니다' }, '2026-10-12'); assert.equal(bad.k, 'bad'); assert.match(bad.text, /인증키를 찾지 못했습니다/);
  const ok = I.status({ at: '2026-10-11T22:40:00.000Z', today: '2026-10-12', counts: { g2b: 40, alio: 6, biz: 9 }, added: 3 }, '2026-10-12');
  assert.equal(ok.k, 'ok'); assert.match(ok.text, /마지막 10\.12 07:40/); assert.match(ok.text, /나라장터 40 · 알리오 6 · 기업마당 9 · 새로 걸린 3건/);
  const late = I.status({ at: '2026-10-09T22:40:00.000Z', today: '2026-10-10', counts: {}, added: 0 }, '2026-10-12');
  assert.equal(late.k, 'late'); assert.match(late.text, /2일째 새로 안 돌았습니다/);
  assert.equal(I.status({ at: '2026-10-10T22:40:00.000Z', today: '2026-10-11', counts: {}, added: 0 }, '2026-10-12').k, 'ok', '하루 늦은 것은 정상(아침 7시 40분 전에 열면 어제 것)');
});
test('★★ 서버가 알아낸 지역·업종 제한(rgn·ind·indY·jnt·lk)을 새 줄에 «있을 때만» 데려간다', () => {
  const m = I.merge([], { a: row('A', '제한 있는 용역', { rgn: '충청남도', ind: '정보통신공사업', indY: 'Y', jnt: '대전', lk: '1' }), b: row('B', '제한 모르는 용역') }, O);
  const a = m.adds.find((x) => x.no === 'A'), b = m.adds.find((x) => x.no === 'B');
  assert.equal(a.rgn, '충청남도'); assert.equal(a.ind, '정보통신공사업'); assert.equal(a.indY, 'Y'); assert.equal(a.jnt, '대전'); assert.equal(a.lk, '1');
  ['rgn', 'ind', 'indY', 'jnt', 'lk'].forEach((k) => assert.equal(k in b, false, k));
});
