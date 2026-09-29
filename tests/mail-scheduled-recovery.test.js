'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const B = require('../functions/mail-bulk.js');

const ROOT = path.join(__dirname, '..');
const 서버 = fs.readFileSync(path.join(ROOT, 'functions/index.js'), 'utf8');
const 화면 = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');

test('★ 일시적인 발송 실패는 간격을 두고 제한 횟수만 다시 시도한다', () => {
  const now = 1_700_000_000_000;
  const 처음 = B.deliveryFailure({ state: 'sending', at: now - 1000 }, now, 'timeout');
  assert.equal(처음.state, 'waiting');
  assert.equal(처음.at, now + B.RETRY_DELAY_MS);
  assert.equal(처음.attemptCount, 1);

  const 둘째 = B.deliveryFailure(Object.assign({}, 처음, { state: 'sending' }), now + 1, 'timeout');
  assert.equal(둘째.state, 'waiting');
  assert.equal(둘째.attemptCount, 2);

  const 마지막 = B.deliveryFailure(Object.assign({}, 둘째, { state: 'sending' }), now + 2, 'timeout');
  assert.equal(마지막.state, 'failed');
  assert.equal(마지막.at, B.PARKED_AT,
    '실패 줄이 지난 시각에 남으면 앞 20칸을 차지해 뒤의 정상 메일을 영원히 막는다');
  assert.equal(마지막.attemptCount, B.MAX_DELIVERY_ATTEMPTS);
});

test('★★ 발송 중 서버가 멈춘 줄은 자동 재발송하지 않고 확인 필요로 치운다', () => {
  const now = 1_700_000_000_000;
  assert.equal(B.staleSending({ state: 'sending', sendingAt: now - B.SENDING_LEASE_MS - 1 }, now), true);
  assert.equal(B.staleSending({ state: 'sending', sendingAt: now - 1000 }, now), false);
  const 보류 = B.uncertainDelivery({ state: 'sending', at: now - 5000 }, now);
  assert.equal(보류.state, 'uncertain');
  assert.equal(보류.at, B.PARKED_AT);
  assert.match(보류.error, /확인/);
});

test('★★ 예약 발송기가 실패 복구와 굳은 발송 격리를 실제로 사용한다', () => {
  const start = 서버.indexOf('exports.sendScheduledMail');
  const end = 서버.indexOf('\nexports.', start + 10);
  const body = 서버.slice(start, end > start ? end : 서버.length);
  assert.match(body, /MB\.staleSending\(/);
  assert.match(body, /MB\.uncertainDelivery\(/);
  assert.match(body, /MB\.deliveryFailure\(/);
});

test('예약 화면은 실제 15분 주기와 확인 필요 상태를 정확히 말한다', () => {
  assert.match(화면, /서버가 15분마다 살펴 보냅니다/);
  assert.match(화면, /발송 여부 확인 필요/);
  assert.doesNotMatch(화면, /서버가 5분마다 살펴 보냅니다/);
});
