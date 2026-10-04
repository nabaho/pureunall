'use strict';
/* 일요일 17시 보충 (대표 물음 2026-10-04 「자료가지고오기는 일요일 18 시에 가지고 오면 안되나?」 → 「3」
   = 가져오기 한 번 더 + 겹치거나 빈 칸만 새것으로 + 점검표에 적음)

   ■ 이 검사가 지키는 «규칙»
     ① 바꾸는 것은 둘뿐 — 지난 회차에 담겼던 줄 · 빈 칸. 새것이 없으면 그대로 둔다
     ② 손대는 꼭지는 셋뿐 — 정책 · 판례 · 인사노무관리. 주간노동뉴스(AI 우리 말)는 안 건드린다
     ③ 끈 줄(안실음)은 그대로 · 이미 든 것·지난 것을 또 넣지 않는다
     ④ 사람이 «준비한» 확정본이면 통째로 건너뛴다(바꾸면 월요일이 어긋남으로 막힌다)
        — 직접 고치신 편지라도 보충은 한다(한 번만 만져도 영영 안 도는 일을 막으려고)
     ⑤ 바꾼 것은 점검표에 한 줄씩 «뺀 것 → 넣은 것»으로
     ⑥ 17시에 돌고(18시 점검보다 먼저), 매일 가져오기는 그대로다 · 발송·대기열은 안 건드린다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/pu-news-core.js');
const W = require('../functions/news-watch.js');
const { stripJs } = require('./strip-comments.js');
const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');
const 몸 = (이름) => { const i = 서버.indexOf('exports.' + 이름 + ' '); return 서버.slice(i, 서버.indexOf('\nexports.', i + 10)); };

const 줄 = (t, 더) => Object.assign({ 제목: t, 링크: 'https://x.test/' + encodeURIComponent(t) }, 더);

test('① ② ③ 겹친 줄·빈 칸만 바꾸고, 기사·끈 줄·이미 든 것은 그대로', () => {
  const 안 = {
    news: [줄('옛 기사')],                                   /* 지난 회차와 겹쳐도 기사는 안 건드린다 */
    policy: [줄('옛 가이드'), 줄('새 공고'), 줄('옛 끈 것', { 안실음: true })],
    case: [줄('옛 판례')],
    hr: []
  };
  const 지난표 = C.지난것들({ '2026-09-w4': { 상태: '시험', 안: {
    news: [줄('옛 기사')], policy: [줄('옛 가이드'), 줄('옛 끈 것')], case: [줄('옛 판례'), 줄('지난주에만 실린 판례')] } } }, '2026-10-w1');
  const 후보안 = { policy: [줄('새 공고'), 줄('옛 가이드'), 줄('더 새 공고'), 줄('또 새 공고')],
    case: [줄('지난주에만 실린 판례'), 줄('새 판례 가'), 줄('새 판례 나')], hr: [줄('노동동향 8월')], news: [줄('후보 기사')] };
  const r = W.보충하기({ 안, 후보안, 지난표 });
  assert.deepStrictEqual(r.안.news.map((x) => x.제목), ['옛 기사'], '기사를 건드렸다');
  assert.deepStrictEqual(r.안.policy.slice(0, 3).map((x) => x.제목), ['더 새 공고', '새 공고', '옛 끈 것'],
    '겹친 줄만 제자리에서 바뀌어야 한다 — 이미 든 «새 공고»·지난 «옛 가이드»는 후보에서 빠진다');
  assert.strictEqual(r.안.policy[2].안실음, true, '끈 줄을 바꿨다');
  assert.ok(r.안.policy.length > 3 && r.안.policy[3].제목 === '또 새 공고', '빈 칸을 안 채웠다');
  assert.deepStrictEqual(r.안.case.map((x) => x.제목).slice(0, 2), ['새 판례 가', '새 판례 나']);
  assert.deepStrictEqual(r.안.hr.map((x) => x.제목), ['노동동향 8월']);
  assert.ok(r.바꾼.some((b) => b.뺀 === '옛 가이드' && b.넣은 === '더 새 공고'));
  assert.ok(r.채운.some((b) => b.넣은 === '노동동향 8월'));
  /* 원본은 그대로 — 고친 사본을 돌려준다 */
  assert.strictEqual(안.policy[0].제목, '옛 가이드');
});

test('① 새것이 없으면 그대로 둔다', () => {
  const 안 = { case: [줄('옛 판례')] };
  const 지난표 = C.지난것들({ '2026-09-w4': { 안: { case: [줄('옛 판례')] } } }, '2026-10-w1');
  const r = W.보충하기({ 안, 후보안: { case: [줄('옛 판례')] }, 지난표 });
  assert.deepStrictEqual(r.안.case.map((x) => x.제목), ['옛 판례']);
  assert.strictEqual(r.바꾼.length + r.채운.length, 0);
});

test('④ 사람이 «준비한» 확정본이면 건너뛰고, 직접 고친 편지라도 보충은 한다', () => {
  const 회차 = { 상태: '초안', 고친이: 'boss@example.test', 안: {} };
  const 할까 = (확, 더) => W.보충할까(Object.assign({ 설정: {}, 확정본: 확, 회차, 열쇠: '2026-10-w1' }, 더)).할까;
  assert.strictEqual(할까({ 회차열쇠: '2026-10-w1', 상태: '준비', 자동: true }), true, '직접 고친 편지도 보충한다');
  assert.strictEqual(할까({ 회차열쇠: '2026-10-w1', 상태: '준비', 자동: false }), false, '사람이 준비한 확정본');
  assert.strictEqual(할까({ 회차열쇠: '2026-10-w1', 상태: '거는중', 자동: true }), false);
  assert.strictEqual(할까(null, { 회차: Object.assign({}, 회차, { 상태: '발송' }) }), false);
  assert.strictEqual(할까(null, { 설정: { 금요일준비: false } }), false);
});

test('⑤ 점검표에 «뺀 것 → 넣은 것»이 한 줄씩', () => {
  const 점 = W.점검하기({ now: Date.parse('2026-10-04T18:00:00+09:00'), 열쇠: '2026-10-w1', 설정: { 자동발송: true },
    확정본: { 회차열쇠: '2026-10-w1', 상태: '준비', to: [{}] }, 회차: null, 브리핑: { 모은날: '2026-10-04' },
    보충: { 바꾼: [{ 꼭지: '판례·재결례·행정해석', 뺀: '옛 판례', 넣은: '새 판례' }], 채운: [{ 꼭지: '인사·노무관리', 넣은: '노동동향' }] } });
  assert.ok(점.항목들.some((x) => x.수준 === 'fix' && /새것으로 바꿈/.test(x.제목) && /「옛 판례」 → 「새 판례」/.test(x.설명)));
  assert.ok(점.항목들.some((x) => x.수준 === 'fix' && /빈 칸 채움/.test(x.제목)));
  const m = W.점검표메일짓기(점, '10월 1주차', 'https://x.test', '오전 6시');
  assert.match(m.html, /옛 판례/);
});

test('⑤ 거리고르기 — 지금 회차에 이미 든 것(뺄안)은 후보에서 뺀다', () => {
  const r = C.거리고르기({ 판례모음: { a: 줄('든 판례', { 모은날: '2026-10-04' }), b: 줄('새 판례', { 모은날: '2026-10-03' }) },
    자료모음: { c: 줄('든 자료', { 꼭지: 'policy', 값어치: 4 }), d: 줄('새 자료', { 꼭지: 'policy', 값어치: 1 }) },
    지금열쇠: '2026-10-w1', 뺄안: { case: [줄('든 판례')], policy: [줄('든 자료')] } });
  assert.deepStrictEqual(r.판례.map((x) => x.제목), ['새 판례']);
  assert.deepStrictEqual(r.자료.map((x) => x.제목), ['새 자료']);
});

test('⑥ 서버 — 일요일 17시, 가져오기 셋 → 보충 → 자동 확정본만 다시 봉인 · 대기열은 안 건드린다', () => {
  const b = 몸('newsletterSundayRefill');
  assert.match(b, /\.pubsub\.schedule\("every sunday 17:00"\)/, '18시 점검보다 먼저여야 한다');
  ['뉴스모으기한번()', '자료판례모아담기(', '노무사회모으기('].forEach((x) => assert.ok(b.indexOf(x) >= 0, x + ' 를 안 부른다'));
  assert.ok(b.indexOf('NWatch.보충할까(') < b.indexOf('NWatch.보충하기('), '할까를 먼저 본다');
  assert.match(b, /뺄안: 회차\.안/);
  assert.match(b, /확정본\.자동 === true[^)]*\)[\s\S]*?NF\.확정본다시짓기/, '자동 확정본일 때만 다시 봉인');
  assert.ok(!/scheduled|buildQueue|validateBulk/.test(b), '보충이 발송 대기열을 건드린다');
  assert.match(b, /\/보충"\)/, '무엇을 바꿨는지 남기지 않는다 — 점검표가 못 적는다');
  /* 18시 점검이 그 기록을 읽는다 */
  assert.match(몸('newsletterWatchSunday'), /\/보충"\)\.once\("value"\)[\s\S]*보충 \}\)/);
  /* 매일 가져오기는 그대로 */
  assert.match(몸('dailyNewsCollect'), /every day 07:00/);
});
