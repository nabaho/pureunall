'use strict';
/* 포털(푸른 통합로그인) 뉴스레터 칸 경고 (대표 지시 2026-10-04
   「항상 자동으로 검증하고 메일이 안나가거나 문제가 발생하는부분도 자동으로 검토해라 반드시 검토해라
    그리고 문제가 발생하면 푸른 통합로그인에 들어갔을떄 뉴스레터 앱에 문제 발생등에 대한 경고 표시를 해서
    검토 할 수 있게 해라」)

   ■ 이 검사가 지키는 «규칙»
     ① 경고 수 = «지금 사람이 볼 것» — 보내기 전엔 막힘+점검(안 나감·확인), 보낸 뒤엔 전달 실패만
     ② 서버가 경고판(newsletter/watch/현재)을 «늘» 새로 쓴다 — 경보·점검·발송·전달·3시간마다
     ③ 06시 발송이 «아예 안 돈» 것도 낮 12시에 잡는다(함수가 죽으면 기록이 없다)
     ④ 포털은 문제가 있을 때만 «⚠ n» 을 단다 · 누르면 자동화 점검(?tab=watch)으로 간다
     ⑤ 뉴스레터 화면은 ?tab=watch 로 오면 자동화 점검부터 연다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const W = require('../functions/news-watch.js');
const { stripJs, stripComments } = require('./strip-comments.js');
const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');
const 포털 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8')).replace(/\r\n/g, '\n');
const 뉴스 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8')).replace(/\r\n/g, '\n');
const 몸 = (이름) => { const i = 서버.indexOf('exports.' + 이름 + ' '); return 서버.slice(i, 서버.indexOf('\nexports.', i + 10)); };
const 함수 = (src, 머리) => { const i = src.indexOf(머리); return src.slice(i, src.indexOf('\n}\n', i) + 2); };

test('① 경고 수 — 보내기 전엔 막힘·점검, 보낸 뒤엔 전달 실패만, 같은 말은 한 번', () => {
  assert.strictEqual(W.경고판짓기(null).경고수, 0);
  const 전 = W.경고판짓기({ 열쇠: '2026-10-w2',
    발송: { 상태: 'block', 말: '오늘 뉴스레터가 안 나갔습니다' },
    점검: { 항목들: [{ 수준: 'you', 제목: '링크가 열리지 않습니다' }, { 수준: 'you', 제목: '링크가 열리지 않습니다' },
      { 수준: 'ok', 제목: '받는 곳 164곳' }, { 수준: 'fix', 제목: '다시 함' }] },
    점검경보: { 상태: 'block', 말: '내일 뉴스레터가 안 나갑니다 — …' } });
  assert.strictEqual(전.경고수, 2, '막힘 1 + 확인 1 (같은 말 두 번·정상·고친 것·점검경보는 안 센다)');
  const 후 = W.경고판짓기({ 열쇠: '2026-10-w2', 발송: { 상태: 'ok' },
    점검: { 항목들: [{ 수준: 'you', 제목: '지난주 일' }] }, 전달경보: { 상태: 'block', 말: '3통이 못 나갔습니다' } });
  assert.deepStrictEqual(후.말들, ['3통이 못 나갔습니다'], '보낸 뒤엔 그 주 점검 항목을 안 센다');
  assert.strictEqual(W.경고판짓기({ 열쇠: '2026-10-w2', 발송: { 상태: 'ok' } }).경고수, 0);
});

test('② 서버가 경고판을 늘 새로 쓴다', () => {
  const 경보 = 함수(서버, 'async function 뉴스레터경보');
  assert.match(경보, /뉴스레터경고판갱신\(db\)/, '경보 뒤에 경고판을 안 고친다');
  ['newsletterWatchRetry', 'newsletterWatchSunday', 'newsletterWatchDelivery', 'weeklyNewsletterSend'].forEach((n) => {
    assert.match(몸(n), /뉴스레터경고판갱신\(db\)/, n + ' 이 경고판을 안 고친다');
  });
  const 갱신 = 함수(서버, 'async function 뉴스레터경고판갱신');
  assert.match(갱신, /newsletter\/watch\/현재"\)\.set/);
  assert.match(갱신, /NWatch\.경고판짓기\(/);
});

test('③ 06시 발송이 아예 안 돌았으면 낮 12시에 알린다', () => {
  const b = 몸('newsletterWatchDelivery');
  assert.match(b, /ready\.상태 === "준비" \|\| ready\.상태 === "거는중"/);
  assert.match(b, /뉴스레터경보\(ready\.회차열쇠, "발송", "오늘 오전 6시 발송이 돌지 않았습니다/);
  assert.match(b, /config\/자동발송/, '자동발송을 끈 주에도 알린다 — 일부러 끈 것이다');
});

test('④ 포털 — 문제가 있을 때만 «⚠ n», 누르면 자동화 점검으로', async () => {
  /* 포털 쪽은 즉시 실행 함수 «안»에 두 칸 들여 있다 — 끝도 두 칸 들인 } 로 찾는다 */
  const 정의 = (() => { const i = 포털.indexOf('function 뉴스레터경고달기'); return 포털.slice(i, 포털.indexOf('\n  }\n', i) + 4); })();
  assert.match(정의, /newsletter\/watch\/현재/);
  assert.match(포털, /hideEmptyRows\(\);\s*뉴스레터경고달기\(\);/, '칸을 다 그린 뒤에 부르지 않는다');
  assert.match(포털, /a\.dataset\.warnTab \? '&tab=' \+ a\.dataset\.warnTab/, '경고가 있어도 그냥 첫 화면으로 간다');
  /* 실제로 돌려 본다 */
  const 돌려 = async (값) => {
    const 붙은것 = [];
    const 칸 = { dataset: {}, title: '', href: 'pu-news.html?sso=1',
      querySelector: () => null, appendChild: (x) => 붙은것.push(x) };
    const 짐 = { document: { querySelector: () => 칸, createElement: () => ({}) },
      db: { ref: () => ({ once: () => Promise.resolve({ val: () => 값 }) }) }, Number };
    vm.createContext(짐);
    vm.runInContext(정의 + '\n뉴스레터경고달기();', 짐);
    await new Promise((r) => setImmediate(r));
    return { 칸, 붙은것 };
  };
  const 없음 = await 돌려({ 경고수: 0 });
  assert.strictEqual(없음.붙은것.length, 0, '문제가 없는데 표시를 단다');
  assert.ok(!없음.칸.dataset.warnTab);
  const 있음 = await 돌려({ 경고수: 2, 말들: ['오늘 뉴스레터가 안 나갔습니다', '링크가 열리지 않습니다'] });
  assert.strictEqual(있음.붙은것.length, 1);
  assert.strictEqual(있음.붙은것[0].textContent, '⚠ 2');
  assert.strictEqual(있음.칸.dataset.warnTab, 'watch');
  assert.match(있음.칸.title, /오늘 뉴스레터가 안 나갔습니다/);
  assert.match(있음.칸.href, /tab=watch/);
});

test('⑤ 뉴스레터 화면 — ?tab=watch 로 오면 자동화 점검부터', () => {
  assert.match(뉴스, /new URLSearchParams\(location\.search\)\.get\('tab'\)/);
  /* 2026-10-05 — 받는 곳 › 반송·거부(bounce)도 바로 열린다 */
  assert.match(뉴스, /\['now','past','note','who','noaddr','bounce','res','watch','cfg'\]\.indexOf\(t\) >= 0 \? t : 'now'/,
    '아무 값이나 탭으로 받는다 — 모르는 값은 이번 회차로');
});
