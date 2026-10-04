'use strict';
/* 꼭지 «모두» 새것으로 · 공인노무사회 연결 (대표 지시 2026-10-04
   「이것은 지난번하고 똑같은것 같은데 전체적으로 판례 인사노무 관리 모두 새로운 내용으로 바뀔수 있게하고
    공인노무사회 도 연결해서 자료가지고 온거 맞나?」)

   ■ 실측
     · 「보낸 편지와 겹치면 뺀다」만으로는 모자랐다 — 지난 회차가 모두 «시험»이라 하나도 안 빠졌다.
     · 값어치 순 위 8개만 자르니 중소벤처기업부 공고(값어치 2)가 정책 여덟 칸을 다 먹었고,
       인사·노무관리(한국노동연구원)는 차례가 안 왔다.
     · 공인노무사회는 손 단추만 있었다(마지막 9/5). 금요일 자동 준비도 그 자료를 안 썼다.

   ■ 이 검사가 지키는 «규칙»
     ① 지난 회차(시험·초안 포함)에 담겼던 것은 «뒤로» — 새것이 먼저, 모자라면 옛것이 채운다
     ② 정책 꼭지는 노동 자료와 기업지원 공고를 «번갈아» · 값어치 -1 보도자료는 안 담는다
     ③ 인사·노무관리 같은 다른 꼭지는 «제 몫»을 따로 받는다
     ④ 공인노무사회 받아 둔 것(첨부 있는 자료)이 거리에 든다 · 같은 제목은 하나만
     ⑤ 공인노무사회는 매일 아침 «자동»으로 — 손 단추와 «같은 몸통»을 부른다
     ⑥ 감시꾼이 공인노무사회 자동 가져오기 막힘·사흘 넘김을 알린다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/pu-news-core.js');
const W = require('../functions/news-watch.js');
const { stripJs, stripComments } = require('./strip-comments.js');
const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8'));
const 금요일 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'news-friday.js'), 'utf8'));
const 화면 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8'));

const 자 = (번, 더) => Object.assign({ 제목: '자료 ' + 번, 링크: 'https://x.test/' + 번, 꼭지: 'policy',
  발행처: '고용노동부', 값어치: 1, 모은날: '2026-10-01' }, 더);
const 거리 = (더) => C.거리고르기(Object.assign({ 지금열쇠: '2026-10-w2' }, 더));

test('① 지난 회차(시험 포함)에 담겼던 것은 뒤로 — 새것 먼저, 모자라면 옛것이 채운다', () => {
  const 모음 = { a: 자('a', { 값어치: 4 }), b: 자('b', { 값어치: 1 }) };
  const 회차들 = { '2026-10-w1': { 상태: '시험', 안: { policy: [C.자료다듬기(자('a', { 값어치: 4 }))] } } };
  const r = 거리({ 자료모음: 모음, 회차들 });
  assert.deepStrictEqual(r.자료.map((x) => x.제목), ['자료 b', '자료 a'], '값어치가 높아도 지난 회차에 담겼던 것은 뒤');
  /* 지금 회차·뒤 회차는 «지난 것»이 아니다 */
  const r2 = 거리({ 자료모음: 모음, 회차들: { '2026-10-w2': 회차들['2026-10-w1'] } });
  assert.strictEqual(r2.자료[0].제목, '자료 a');
  /* 판례·인사노무관리도 같다 — 더 최근에 모은 것이라도 지난 회차에 담겼으면 뒤로 */
  const 판 = { p1: { 제목: '옛 판례', 링크: 'u1', 모은날: '2026-10-03' }, p2: { 제목: '새 판례', 링크: 'u2', 모은날: '2026-09-07' } };
  const 지난 = { '2026-10-w1': { 상태: '시험', 안: { case: [{ 제목: '옛 판례', 링크: 'u1' }],
    hr: [{ 제목: '노동동향(7월)', 링크: 'h7' }] } } };
  const r3 = 거리({ 판례모음: 판, 회차들: 지난,
    자료모음: { h7: 자('h7', { 제목: '노동동향(7월)', 링크: 'h7', 꼭지: 'hr', 모은날: '2026-10-03' }),
               h8: 자('h8', { 제목: '노동동향(8월)', 꼭지: 'hr', 모은날: '2026-09-07' }) } });
  assert.deepStrictEqual(r3.판례.map((x) => x.제목), ['새 판례', '옛 판례']);
  assert.strictEqual(r3.자료.filter((x) => x.꼭지 === 'hr')[0].제목, '노동동향(8월)');
});

test('② 정책 꼭지 — 노동 자료와 기업지원 공고를 번갈아 · 값어치 -1 보도자료는 안 담는다', () => {
  const 모음 = {};
  for (let i = 0; i < 6; i++) 모음['b' + i] = 자('b' + i, { 발행처: '중소벤처기업부', 값어치: 2 });
  모음.l1 = 자('l1', { 값어치: 4 });
  모음.l2 = 자('l2', { 값어치: 0 });
  모음.p1 = 자('p1', { 값어치: -1, 제목: '추석 맞이 이웃사랑 실천' });
  const r = 거리({ 자료모음: 모음 });
  const 정책 = r.자료.filter((x) => x.꼭지 === 'policy');
  assert.strictEqual(정책.length, 6);
  assert.strictEqual(정책.filter((x) => x.발행처 === '중소벤처기업부').length, 4, '노동 2 + 기업지원 4 (노동이 모자라서)');
  assert.ok(정책[0].발행처 !== '중소벤처기업부' && 정책[1].발행처 === '중소벤처기업부', '번갈아 — 노동이 먼저');
  assert.ok(!r.자료.some((x) => /이웃사랑/.test(x.제목)), '값어치 -1 이 담겼다');
});

test('③ 인사·노무관리는 제 몫을 따로 받는다 — 정책이 많아도 밀리지 않는다', () => {
  const 모음 = {};
  for (let i = 0; i < 12; i++) 모음['b' + i] = 자('b' + i, { 발행처: '중소벤처기업부', 값어치: 2 });
  모음.h1 = 자('h1', { 꼭지: 'hr', 발행처: '한국노동연구원', 값어치: 0, 제목: '노동동향(2026년 8월)' });
  const r = 거리({ 자료모음: 모음 });
  assert.ok(r.자료.some((x) => x.꼭지 === 'hr' && /노동동향/.test(x.제목)), '인사·노무관리 자료가 차례를 못 얻었다');
});

test('④ 공인노무사회 받아 둔 것이 거리에 든다 · 같은 제목은 하나만', () => {
  const 노무사회 = {
    s1: { sid: 's1', 제목: '국가 고용서비스 혁신방안', 기관: '고용노동부', 날짜: '2026-08-20',
      주소: 'https://ilabor.example.test/1', 첨부: [{ 이름: 'a.pdf', 주소: 'https://store.example.test/a.pdf', 크기: 10 }] },
    s2: { sid: 's2', 제목: '자료 l1', 기관: '고용노동부', 날짜: '2026-08-26',
      주소: 'https://ilabor.example.test/2', 첨부: [{ 이름: 'b.pdf', 주소: 'https://store.example.test/b.pdf', 크기: 10 }] } };
  const r = 거리({ 자료모음: { l1: 자('l1', { 값어치: 4 }) }, 노무사회 });
  const 제목들 = r.자료.map((x) => x.제목);
  assert.ok(제목들.includes('국가 고용서비스 혁신방안'), '공인노무사회 자료가 안 들었다');
  assert.strictEqual(제목들.filter((t) => t === '자료 l1').length, 1, '같은 자료가 두 출처에서 두 번 들었다');
  /* 판례도 같은 제목은 하나만 */
  const 판 = 거리({ 판례모음: { a: { 제목: '같은 물음', 링크: 'u1', 모은날: '2026-09-07' }, b: { 제목: '같은 물음', 링크: 'u2', 모은날: '2026-09-07' } } });
  assert.strictEqual(판.판례.length, 1);
});

test('④ 금요일 자동 준비와 화면 «채우기»가 같은 고르개를 쓴다 — 공인노무사회까지', () => {
  assert.match(금요일, /Core\.거리고르기\(\{[^}]*노무사회: 자료\.노무사회/);
  assert.match(금요일, /읽\('ilabor\/items'/);
  assert.match(화면, /Core\.거리고르기\(\{[^}]*노무사회: v\[3\]\.val\(\)/);
  assert.match(화면, /db\.ref\('ilabor\/items'\)/);
});

test('⑤ 공인노무사회는 매일 아침 자동 — 손 단추와 같은 몸통', () => {
  const i = 서버.indexOf('exports.dailyIlaborCollect ');
  assert.ok(i >= 0, '매일 가져오기가 없다');
  const 몸 = 서버.slice(i, 서버.indexOf('\nexports.', i + 10));
  assert.match(몸, /\.pubsub\.schedule\("every day/);
  assert.match(몸, /노무사회모으기\("full"/);
  assert.match(몸, /자동탈/, '실패를 남기지 않는다 — 감시꾼이 못 본다');
  const j = 서버.indexOf('exports.ilaborPull ');
  const 손 = 서버.slice(j, 서버.indexOf('\nexports.', j + 10));
  assert.match(손, /노무사회모으기\(방식, 상한/);
  assert.ok(손.indexOf('노무사회로그인(') < 0, '손 단추가 제 몸통을 따로 가졌다 — 두 벌이면 한쪽만 낡는다');
});

test('⑥ 감시꾼 — 공인노무사회 자동 가져오기 막힘 · 사흘 넘김', () => {
  const now = Date.parse('2026-10-11T18:00:00+09:00');
  const 기본 = { now, 열쇠: '2026-10-w2', 설정: { 자동발송: true }, 확정본: null, 회차: null, 브리핑: { 모은날: '2026-10-11' } };
  const 막 = W.점검하기(Object.assign({}, 기본, { 노무사회메타: { 마지막: now - 3600e3, 자동탈: '로그인 실패' } }));
  assert.ok(막.항목들.some((x) => x.수준 === 'you' && /공인노무사회 자동 가져오기가 막혔/.test(x.제목)));
  const 묵 = W.점검하기(Object.assign({}, 기본, { 노무사회메타: { 마지막: now - 5 * 86400e3 } }));
  assert.ok(묵.항목들.some((x) => /사흘 넘게/.test(x.제목)));
  const 좋 = W.점검하기(Object.assign({}, 기본, { 노무사회메타: { 마지막: now - 3600e3 } }));
  assert.ok(!좋.항목들.some((x) => /공인노무사회/.test(x.제목)));
});
