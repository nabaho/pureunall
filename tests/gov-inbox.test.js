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
  const m = I.merge([], { a: row('A', '제한 있는 용역', { rgn: '충청남도', ind: '정보통신공사업', indY: 'Y', jnt: '대전', lk: '2' }), b: row('B', '제한 모르는 용역') }, O);
  const a = m.adds.find((x) => x.no === 'A'), b = m.adds.find((x) => x.no === 'B');
  assert.equal(a.rgn, '충청남도'); assert.equal(a.ind, '정보통신공사업'); assert.equal(a.indY, 'Y'); assert.equal(a.jnt, '대전'); assert.equal(a.lk, '2');
  ['rgn', 'ind', 'indY', 'jnt', 'lk'].forEach((k) => assert.equal(k in b, false, k));
});

/* ── 출처별 «받은 기록» — 나라장터·알리오·기업마당이 계속 들어오는지 (대표 지시 2026-10-19) ── */
const T1 = '2026-10-19T01:59:00.000Z';   // 서울 10.19 10:59
test('★ newestOf — 받은 «전체» 중 가장 최근 게시일(걸러진 것이 아니라) · 모르는 꼴은 건너뛴다', () => {
  assert.equal(I.newestOf([{ openDt: '2026-10-17 09:00:00' }, { openDt: '2026-10-19 08:30:00' }, { openDt: '2026-10-01' }, { openDt: '' }, null, {}]), '2026-10-19');
  assert.equal(I.newestOf([]), ''); assert.equal(I.newestOf(null), '');
});
test('★★ noteFetch — 출처마다 한 줄 + 하루 한 줄 기록 · 옛 기록은 안 고친다 · 못 받은 날은 «받았다»로 덮지 않는다', () => {
  const s0 = {}; const s1 = I.noteFetch(s0, 'g2b', { n: 3077, newest: '2026-10-19', err: '' }, T1);
  assert.deepEqual(s0, {}, '옛 기록을 고쳤다');
  assert.equal(s1.cur.g2b.n, 3077); assert.equal(s1.cur.g2b.okAt, T1); assert.equal(s1.hist[0].d, '2026-10-19'); assert.equal(s1.hist[0].g2b.n, 3077);
  const s2 = I.noteFetch(s1, 'g2b', { n: 0, newest: '', err: '인증키 오류' }, '2026-10-19T05:00:00.000Z');
  assert.equal(s2.cur.g2b.err, '인증키 오류'); assert.equal(s2.cur.g2b.okAt, T1, '마지막 성공 시각을 지웠다');
  assert.equal(s2.hist[0].g2b.e, 0, '같은 날 잘 받은 뒤 한 번 못 받았다고 그날을 실패로 바꾸면 안 된다');
  const s3 = I.noteFetch({}, 'alio', { n: 0, newest: '', err: '쪽 오류' }, T1);
  assert.equal(s3.hist[0].alio.e, 1, '그날 한 번도 못 받았으면 실패로 남긴다');
  const s4 = I.noteFetch(s1, 'alio', { n: 525, newest: '2026-10-12', err: '' }, T1);
  assert.equal(s4.hist.length, 1, '같은 날 두 출처는 한 줄'); assert.ok(s4.hist[0].g2b && s4.hist[0].alio);
});
test('★ 기록은 21일치만 — 오래된 날부터 덜어낸다 · 날짜 차례로', () => {
  let st = {};
  for (let d = 1; d <= 25; d++) st = I.noteFetch(st, 'g2b', { n: d, newest: '', err: '' }, '2026-09-' + String(d).padStart(2, '0') + 'T03:00:00.000Z');
  assert.equal(st.hist.length, 21); assert.equal(st.hist[0].d, '2026-09-05'); assert.equal(st.hist[20].d, '2026-09-25');
});
test('★★★ summarize — 정상 / 이틀 넘게 안 받음 / 못 받음(마지막 성공 같이) / 나라장터 최근 게시가 옛것 / 기록 없음', () => {
  const today = '2026-10-19';
  let st = I.noteFetch({}, 'g2b', { n: 3077, newest: '2026-10-17', err: '' }, T1);
  st = I.noteFetch(st, 'alio', { n: 525, newest: '2026-10-12', err: '' }, T1);
  let sm = I.summarize(st, today);
  assert.deepEqual(sm.map((x) => x.k), ['ok', 'ok', 'none']);
  assert.match(sm[0].text, /10\.19 10:59 받음 · 3,077건 · 최근 게시 10\.17/); assert.match(sm[2].text, /아직 받은 기록이 없습니다/);
  assert.equal(I.summarize(st, '2026-10-21')[0].k, 'late', '이틀 넘게 안 받으면 노랑');
  assert.match(I.summarize(st, '2026-10-21')[0].text, /2일째 새로 안 받았습니다/);
  assert.equal(I.summarize(st, '2026-10-20')[0].k, 'ok', '하루는 정상(주말·아침 전)');
  const stale = I.noteFetch({}, 'g2b', { n: 3000, newest: '2026-10-10', err: '' }, T1);
  assert.equal(I.summarize(stale, today)[0].k, 'late'); assert.match(I.summarize(stale, today)[0].text, /최근 게시가 9일 전/);
  assert.equal(I.summarize(I.noteFetch({}, 'alio', { n: 525, newest: '2026-09-01', err: '' }, T1), today)[0].k, 'none');
  assert.equal(I.summarize(I.noteFetch({}, 'alio', { n: 525, newest: '2026-09-01', err: '' }, T1), today)[1].k, 'ok', '알리오는 «진행 중» 공고라 옛 게시일이어도 정상');
  const bad = I.noteFetch(st, 'g2b', { n: 0, newest: '', err: 'SERVICE_ACCESS_DENIED' }, '2026-10-19T05:00:00.000Z');
  sm = I.summarize(bad, today); assert.equal(sm[0].k, 'bad'); assert.match(sm[0].text, /못 받음 — SERVICE_ACCESS_DENIED · 마지막 성공 10\.19 10:59/);
  assert.match(I.summarize(I.noteFetch({}, 'g2b', { n: 0, err: 'x' }, T1), today)[0].text, /아직 성공한 적 없음/);
  assert.equal(I.summarize(null, today).length, 3); assert.ok(I.summarize(undefined, today).every((x) => x.k === 'none'));
});
test('★ history — 최근 날부터 · 칸 글(건수·최근 게시 / ⚠ 못 받음 / —)', () => {
  let st = I.noteFetch({}, 'g2b', { n: 3077, newest: '2026-10-18', err: '' }, '2026-10-18T03:00:00.000Z');
  st = I.noteFetch(st, 'alio', { n: 0, err: 'e' }, '2026-10-19T03:00:00.000Z');
  const h = I.history(st);
  assert.deepEqual(h.map((x) => x.day), ['10.19', '10.18']);
  assert.equal(h[0].cells.alio, '⚠ 못 받음'); assert.equal(h[0].cells.g2b, '—'); assert.equal(h[1].cells.g2b, '3,077건 · 최근 게시 10.18');
  assert.deepEqual(I.history(null), []);
});
test('★ 옛 «헛 조회» 표시(lk 1)는 받은 함에서 데려오지 않는다 — 제대로 본 것(2)만', () => {
  const m = I.merge([], { a: row('A', '옛 헛 조회', { lk: '1' }), b: row('B', '제대로 본', { lk: '2', rgn: '충청남도' }) }, O);
  assert.equal('lk' in m.adds.find((x) => x.no === 'A'), false); assert.equal(m.adds.find((x) => x.no === 'B').lk, '2');
});
