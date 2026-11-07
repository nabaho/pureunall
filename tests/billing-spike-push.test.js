/* 요금 폭주를 대표 폰으로 — 대표 지시 2026-11-05 「유료 API 통제 3단계」
   여태 폭주 판정은 billing/spike 에 적기만 해 포털을 열어야 보였다(2026-08-16 하루 ₩86,042 사고). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { stripJs } = require('./strip-comments');

const R = path.join(__dirname, '..');
const BA = require(path.join(R, 'functions', 'billing-alert.js'));
const IDX = stripJs(fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8'));

const hit = { day: '2026-11-05', inc: 30000, avg: 1000, ratio: 30, baseDays: 7, at: 1 };

test('폭주면 알림 한 통을 만든다 — 금액·배수·어느 칸', () => {
  const p = BA.spikePushPayload(null, hit, { key: 'database', label: '실시간DB' });
  assert.ok(p && p.title && p.body);
  assert.match(p.body, /30,000/);
  assert.match(p.body, /실시간DB/);
});

test('★ 같은 날 이미 보냈으면 다시 안 보낸다 — 예산 쪽지는 하루에도 여러 번 온다', () => {
  assert.strictEqual(BA.spikePushPayload(Object.assign({}, hit, { pushedAt: 5 }), hit, null), null);
  /* 어제 보낸 것은 오늘을 막지 않는다 */
  assert.ok(BA.spikePushPayload({ day: '2026-11-04', pushedAt: 5 }, hit, null));
  /* 기록은 있는데 못 보냈으면(pushedAt 없음) 다시 시도한다 */
  assert.ok(BA.spikePushPayload(Object.assign({}, hit), hit, null));
  assert.strictEqual(BA.spikePushPayload(null, null, null), null);
});

test('★ recordBillingAlert 가 폭주일 때 관리자 폰으로 보낸다', () => {
  const at = IDX.indexOf('exports.recordBillingAlert');
  assert.ok(at > 0);
  const fn = IDX.slice(at, IDX.indexOf('exports.', at + 20));
  assert.match(fn, /spikePushPayload\(/, '★ 폭주를 적기만 하고 알리지 않습니다');
  assert.match(fn, /PUSH\.pushAdmins\(/, '★ 알림을 관리자 기기로 보내는 줄이 없습니다');
  assert.match(fn, /pushedAt/, '★ 보낸 표시가 없으면 쪽지마다 폰이 울립니다');
});
