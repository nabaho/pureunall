const test = require('node:test');
const assert = require('node:assert');
const W = require('../functions/newsletter-weekly.js');
const fs = require('node:fs');
const path = require('node:path');
const 화면 = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');

const ready = {
  상태: '준비', 보낼날: '2026-09-14', 회차열쇠: '2026-09-w2',
  to: [{ email: 'a@example.com' }], subject: '제목', body: '본문', html: '<b>본문</b>'
};

test('자동발송은 설정을 명시적으로 켜야만 열린다', () => {
  assert.equal(W.check({}, ready, '2026-09-14').reason, 'off');
  assert.equal(W.check({ 자동발송: false }, ready, '2026-09-14').reason, 'off');
});

test('준비한 날짜와 월요일 실행 날짜가 정확히 같아야 한다', () => {
  assert.equal(W.check({ 자동발송: true }, ready, '2026-09-14').ok, true);
  assert.equal(W.check({ 자동발송: true }, ready, '2026-09-21').reason, 'wrong-day');
});

test('이미 걸었거나 빈 편지는 다시 보내지 않는다', () => {
  assert.equal(W.check({ 자동발송: true }, Object.assign({}, ready, { 상태: '완료' }),
    '2026-09-14').reason, 'not-ready');
  assert.equal(W.check({ 자동발송: true }, Object.assign({}, ready, { html: '' }),
    '2026-09-14').reason, 'empty-letter');
});

test('화면에서 확정본을 준비하고 자동발송을 명시적으로 켤 수 있다', () => {
  assert.match(화면, /function 자동발송준비\(/);
  assert.match(화면, /newsletter\/weeklyReady/);
  assert.match(화면, /id="cfgAuto"/);
  assert.match(화면, /자동발송: g\('cfgAuto'\) === 'y'/);
});
