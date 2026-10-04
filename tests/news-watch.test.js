'use strict';
/* 뉴스레터 «감시꾼» (대표 지시 2026-10-04)
   「자동화에 에러가 나면 검증도 자동화 … 문제가 되면 자동으로 고치는기능」 → 「추천대로」

   ■ 이 검사가 지키는 «규칙»
     ① 다시 하기는 «창 안»에서만 — 금 16시 ~ 일 15시 (금 13시 본 준비와 일 18시 점검 사이)
     ② 사람 것은 덮지 않는다 — 사람이 준비한 확정본 · 사람이 고친 회차 · 이미 보낸 회차
     ③ 다시 하기에는 한도가 있다 — 넘으면 «포기»하고 알린다(한 번만)
     ④ 링크는 404·410·주소 없음만 «깨짐» — 403·시간 초과는 «모름»(정부 사이트가 기계를 막는다)
     ⑤ 점검표는 «늘» 간다 — 이상 없어도. 조용함이 괜찮음으로 읽히면 감시꾼이 죽어도 모른다
     ⑥⚠ 발송은 «절대» 스스로 다시 하지 않는다 — 감시꾼은 대기열에 쓰지 않는다
     ⑦ 꺼 둔 자동발송은 월요일에 «또» 알리지 않는다(일부러 끈 것)
     ⑧ 기록에 주소·글을 남기지 않는다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../functions/news-watch.js');
const { stripJs, stripComments } = require('./strip-comments.js');

const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8'));
const 화면 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8'));
function 내보낸몸(이름) {
  const i = 서버.indexOf('exports.' + 이름 + ' ');
  assert.ok(i >= 0, 이름 + ' 이 없다');
  const j = 서버.indexOf('\nexports.', i + 10);
  return 서버.slice(i, j < 0 ? undefined : j);
}

/* 서울 시각 → 밀리초 */
const 서울 = (s) => Date.parse(s + '+09:00');
const 금16 = 서울('2026-10-02T16:00:00');
const 열쇠 = W.이번열쇠(금16);
const 회차기본 = () => ({ 상태: '초안', 고친이: W.금요일준비이름, 우리글: '이번 주 한마디',
  안: { news: [{ 제목: '가나상사 기사', 우리말: '' }, { 제목: '다라상사 기사', 우리말: '썼다' }] } });
const AI탈기록 = { 알림: ['주간노동뉴스 AI 정리를 못 했습니다(한도) — 우리 말이 없는 기사는 원문 그대로'] };

test('① 창 — 금 16시부터 일 15시까지만 다시 한다', () => {
  const 판 = (t) => W.다시할까({ now: t, 열쇠: W.이번열쇠(t), 설정: {}, 회차: 회차기본(), 금요일기록: AI탈기록 });
  assert.strictEqual(판(서울('2026-10-02T15:00:00')).할까, false, '금 15시는 본 준비 직후 — 아직 아님');
  assert.strictEqual(판(금16).할까, true);
  assert.strictEqual(판(서울('2026-10-03T09:00:00')).할까, true, '토요일');
  assert.strictEqual(판(서울('2026-10-04T15:00:00')).할까, true, '일 15시');
  assert.strictEqual(판(서울('2026-10-04T16:00:00')).할까, false, '일 16시 뒤는 점검이 말한다');
  assert.strictEqual(판(서울('2026-10-05T09:00:00')).할까, false, '월요일');
  /* 토·일에 셈한 열쇠가 금요일이 만든 회차와 같아야 한다 */
  assert.strictEqual(W.이번열쇠(서울('2026-10-04T15:00:00')), 열쇠);
});

test('② 사람 것은 덮지 않는다', () => {
  const 판 = (더) => W.다시할까(Object.assign({ now: 금16, 열쇠, 설정: {}, 회차: 회차기본(), 금요일기록: AI탈기록 }, 더));
  assert.strictEqual(판({ 확정본: { 회차열쇠: 열쇠, 상태: '준비', 자동: false } }).할까, false, '사람이 준비한 확정본');
  assert.strictEqual(판({ 확정본: { 회차열쇠: 열쇠, 상태: '준비', 자동: true } }).할까, true, '자동 확정본은 다시 해도 된다');
  assert.strictEqual(판({ 회차: Object.assign(회차기본(), { 고친이: 'boss@example.test' }) }).할까, false, '사람이 고친 회차');
  assert.strictEqual(판({ 회차: Object.assign(회차기본(), { 상태: '발송' }) }).할까, false, '이미 보낸 회차');
  assert.strictEqual(판({ 확정본: { 회차열쇠: 열쇠, 상태: '거는중', 자동: true } }).할까, false, '발송 거는 중');
  assert.strictEqual(판({ 설정: { 금요일준비: false } }).할까, false, '금요일 준비를 끔');
});

test('② 무엇을 다시 하나 — 안 돈 금요일 · 빠진 AI 초안만', () => {
  const 판 = (더) => W.다시할까(Object.assign({ now: 금16, 열쇠, 설정: {}, 회차: 회차기본() }, 더));
  assert.strictEqual(판({ 금요일기록: null }).할까, true, '금요일 준비가 안 돌았다');
  assert.strictEqual(판({ 금요일기록: AI탈기록 }).할까, true, 'AI 가 실패했고 빈 우리 말이 있다');
  const 다채움 = 회차기본(); 다채움.안.news[0].우리말 = '다시 해서 채움';
  assert.strictEqual(판({ 금요일기록: AI탈기록, 회차: 다채움 }).할까, false, '이미 채워졌으면 그만');
  assert.strictEqual(판({ 금요일기록: { 알림: [] } }).할까, false, 'AI 가 성공한 주 — 빈 우리 말이 있어도 일부러 비운 것일 수 있다');
});

test('③ 다시 하기 한도 — 넘으면 포기하고 알린다', () => {
  const 판 = W.다시할까({ now: 금16, 열쇠, 설정: {}, 회차: 회차기본(), 금요일기록: AI탈기록, 고친수: W.다시하기한도 });
  assert.strictEqual(판.할까, false);
  assert.strictEqual(판.포기, true);
  /* 포기 알림은 한 번만 — 거래로 찜한다 */
  assert.match(내보낸몸('newsletterWatchRetry'), /포기알림"\)\.transaction/);
});

test('④ 링크 — 404·410·주소 없음만 깨짐', async () => {
  const 답 = { 'https://a.test/ok': 200, 'https://a.test/gone': 404, 'https://a.test/del': 410,
    'https://a.test/block': 403, 'https://a.test/err': 500 };
  const fetchFn = async (u) => {
    if (u === 'https://nohost.test/x') { const e = new Error('fetch failed'); e.cause = { code: 'ENOTFOUND' }; throw e; }
    if (u === 'https://slow.test/x') { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
    return { status: 답[u] };
  };
  const 줄 = Object.keys(답).concat(['https://nohost.test/x', 'https://slow.test/x']).map((주소) => ({ 주소, 제목: 't', 꼭지: 'k' }));
  const r = await W.링크재기(줄, fetchFn);
  const 상태 = Object.fromEntries(r.map((x) => [x.주소, x.상태]));
  assert.strictEqual(상태['https://a.test/ok'], '됨');
  assert.strictEqual(상태['https://a.test/gone'], '깨짐');
  assert.strictEqual(상태['https://a.test/del'], '깨짐');
  assert.strictEqual(상태['https://a.test/block'], '모름', '403 은 기계를 막은 것 — 깨짐이 아니다');
  assert.strictEqual(상태['https://a.test/err'], '모름');
  assert.strictEqual(상태['https://nohost.test/x'], '깨짐');
  assert.strictEqual(상태['https://slow.test/x'], '모름');
});

test('④ 편지 링크 — 실리는 것만, 같은 주소는 한 번', () => {
  const l = W.편지링크들({ 안: { news: [
    { 제목: 'a', 링크: 'https://x.test/1' }, { 제목: 'b', 링크: 'https://x.test/1' },
    { 제목: 'c', 링크: 'https://x.test/2', 안실음: true }, { 제목: 'd', 주소: 'https://x.test/3' }] } });
  assert.deepStrictEqual(l.map((x) => x.주소), ['https://x.test/1', 'https://x.test/3']);
});

const 좋은회차 = () => ({ 상태: '초안', 우리글: '한마디', 회차: { 이름: '2026년 10월 2주차' }, 안: {
  news: [{ 제목: 'n', 우리말: '썼다', 링크: 'https://x.test/n' }],
  policy: [{ 제목: 'p', 링크: 'https://x.test/p' }], case: [{ 제목: 'c', 링크: 'https://x.test/c' }] } });
const 일18 = 서울('2026-10-04T18:00:00');
const 점검 = (더) => W.점검하기(Object.assign({ now: 일18, 열쇠, 설정: { 자동발송: true },
  확정본: { 회차열쇠: 열쇠, 상태: '준비', to: [{}, {}] }, 회차: 좋은회차(), 링크결과: [],
  금요일기록: { 알림: [] }, 브리핑: { 모은날: '2026-10-04' } }, 더));

test('⑤ 점검 판정 — 이상 없음 · 확인 · 안 나감', () => {
  assert.strictEqual(점검().판정, 'ok');
  assert.strictEqual(점검({ 확정본: null }).판정, 'block', '확정본이 없으면 안 나간다');
  assert.strictEqual(점검({ 설정: { 자동발송: false } }).판정, 'block', '자동발송 꺼짐');
  assert.strictEqual(점검({ 확정본: { 회차열쇠: '2026-09-w4', 상태: '준비', to: [] } }).판정, 'block', '지난주 확정본은 이번 것이 아니다');
  assert.strictEqual(점검({ 확정본: { 회차열쇠: 열쇠, 상태: '어긋남', to: [] } }).판정, 'block');
  const 빈글 = 좋은회차(); 빈글.우리글 = '';
  assert.strictEqual(점검({ 회차: 빈글 }).판정, 'warn', '우리 글이 비었다');
  const 깨진 = 점검({ 링크결과: [{ 주소: 'https://x.test/n', 상태: '깨짐', 코드: 404, 제목: 'n', 꼭지: '주간노동뉴스' }] });
  assert.strictEqual(깨진.판정, 'warn');
  assert.ok(깨진.항목들.some((x) => x.수준 === 'you' && /링크/.test(x.제목)));
  assert.strictEqual(점검({ 브리핑: { 모은날: '2026-09-30' } }).판정, 'warn', '모으기가 멈췄다');
  assert.strictEqual(점검({ 브리핑: { 모은날: '2026-09-30', off: true } }).판정, 'ok', '일부러 끈 모으기');
});

test('⑤ 다시 한 것은 «마지막 한 줄 + 몇 번»', () => {
  const r = 점검({ 고침: { a: { 무엇: '첫째', 됨: false, 결과: '아직' }, b: { 무엇: '둘째', 됨: true, 결과: '됨' } } });
  const 고침줄 = r.항목들.filter((x) => /째/.test(x.제목));
  assert.strictEqual(고침줄.length, 1);
  assert.strictEqual(고침줄[0].수준, 'fix');
  assert.match(고침줄[0].설명, /2번/);
});

test('⑤ 점검표는 «늘» 간다 — 이상 없어도', () => {
  const ok = W.점검표메일짓기(점검(), '2026년 10월 2주차', 'https://x.test/news', '오전 6시');
  assert.match(ok.subject, /이상 없음/);
  assert.match(ok.html, /살아 있다/);
  const 막 = W.점검표메일짓기(점검({ 확정본: null }), '2026년 10월 2주차', 'https://x.test/news', '오전 6시');
  assert.match(막.subject, /안 나갑니다/);
  /* 발송기는 {무엇} 을 자리로 읽는다 — 글 속 중괄호가 살아 있으면 안 된다 */
  const 괄 = W.점검표메일짓기({ 판정: 'warn', 받는수: 1, 항목들: [{ 수준: 'you', 제목: '{이름} 깨짐', 설명: '' }] }, 'x', 'u', '오전 6시');
  assert.ok(!/\{이름\}/.test(괄.html));
  /* 서버도 판정과 상관없이 보낸다 — 메일 부르기가 «if (점검.판정» 안에 있지 않다 */
  const 몸 = 내보낸몸('newsletterWatchSunday');
  const 메일자리 = 몸.indexOf('뉴스레터메일(');
  assert.ok(메일자리 > 0);
  assert.ok(!/if \(점검\.판정[^{]*\{[^}]*$/.test(몸.slice(0, 메일자리)), '점검표 메일이 조건 안에 들어갔다');
});

test('⑥ 발송은 스스로 다시 하지 않는다 — 감시꾼은 대기열에 쓰지 않는다', () => {
  ['newsletterWatchRetry', 'newsletterWatchSunday', 'newsletterWatchDelivery'].forEach((이름) => {
    const 몸 = 내보낸몸(이름);
    assert.ok(!/scheduled"\)\.(push|set|update)|\/scheduled\/" *\+/.test(몸), 이름 + ' 이 대기열에 쓴다');
    assert.ok(!/buildQueue|validateBulk|weeklyReady"\)\.(set|update)|weeklyReady\/상태"\)\.transaction/.test(몸), 이름 + ' 이 발송을 건드린다');
  });
  /* 금요일 준비를 다시 할 때 검토 메일은 안 보낸다 — 일요일 점검표가 한 장으로 말한다 */
  assert.match(내보낸몸('newsletterWatchRetry'), /금요일준비\(\{[^}]*메일: null/);
});

test('⑦ 월요일 발송 막힘 — 꺼짐은 안 알리고, 나머지는 알린다', () => {
  assert.strictEqual(W.발송막힘말({ reason: 'off' }, {}, '2026-10-05'), '');
  assert.match(W.발송막힘말({ reason: 'wrong-day' }, { 보낼날: '2026-09-28' }, '2026-10-05'), /확정본이 없어/);
  assert.strictEqual(W.발송막힘말({ reason: 'not-ready' }, { 보낼날: '2026-10-05', 상태: '완료' }, '2026-10-05'), '', '이미 보냈다');
  assert.match(W.발송막힘말({ reason: 'not-ready' }, { 보낼날: '2026-10-05', 상태: '어긋남', 오류: '도장' }, '2026-10-05'), /어긋남/);
  assert.ok(W.발송막힘말({ reason: 'empty' }, { 보낼날: '2026-10-05' }, '2026-10-05'));
  /* 월요일 발송이 막힌 자리마다 알림판에 쓴다 */
  const 몸 = 내보낸몸('weeklyNewsletterSend');
  assert.match(몸, /NWatch\.발송막힘말\(gate, ready, today\)/);
  assert.ok((몸.match(/뉴스레터경보\(/g) || []).length >= 4, '막힘·어긋남·잠금 실패·오류 네 자리');
});

test('⑧ 전달 셈 — 이 회차 통만, 주소 없이 수만', () => {
  const 셈 = W.전달셈({ a: { bulk: 'b1', state: 'failed', to: 'hong@x.test' }, b: { bulk: 'b1', state: 'uncertain' },
    c: { bulk: 'b1', state: 'waiting' }, d: { bulk: 'other', state: 'failed' } }, 'b1');
  assert.deepStrictEqual(셈, { 남음: 1, 실패: 1, 확인필요: 1 });
  /* 기록에 주소를 안 남긴다 */
  assert.ok(!/to:|email|주소들/.test(내보낸몸('newsletterWatchDelivery').split('.set(')[1].split(';')[0]));
});

test('화면 — 「자동화 점검」 탭이 있고, 고치는 단추 없이 «이번 회차»로 데려간다', () => {
  /* ★ 2026-10-04 부터 «설정» 안의 작은 탭이다(대표 지시 「자동화 점검을 설정 안에 넣어라 탭으로」) */
  assert.match(화면, /\{ t:'watch', 이름:'자동화 점검'/);
  assert.match(화면, /watch:'cfg'/);
  assert.match(화면, /App\.tab==='watch'\) m\.innerHTML = 작은탭\(\) \+ 감시화면\(\)/);
  /* 볼 것이 있다는 빨간 숫자는 «설정» 큰 탭에 붙는다 */
  assert.match(화면, /<button data-t="cfg">설정 <span id="cWatch"/);
  const i = 화면.indexOf('function 감시화면');
  const 몸 = 화면.slice(i, 화면.indexOf('\nfunction ', i + 10));
  assert.ok(!/db\.ref\([^)]*\)\.(set|update|push|remove|transaction)/.test(몸), '점검 탭이 DB 에 쓴다');
  assert.match(몸, /App\.tab='now'/);
});
