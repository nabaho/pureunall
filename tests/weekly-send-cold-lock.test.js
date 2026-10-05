'use strict';
/* 월요일 06시 자동발송 «찜»이 찬 자리에서 헛돌지 않는다 (2026-10-05 실제 사고)
   06:00 에 weeklyNewsletterSend 가 돌았는데 「이미 처리 중이거나 완료됨」으로 끝났다 — 확정본은 «준비» 그대로였다.
   거래(transaction)는 손안의 값(null)으로 먼저 부르는데, 거기서 접어 서버에 묻지도 않았다.
   ⚠ 흉내는 진짜와 같은 차례여야 한다: ① null 로 먼저 ② 접으면 끝 ③ 값을 주면 진짜 값으로 다시
     (첫 부름부터 진짜 값을 주는 흉내로는 이 고장을 하나도 못 잡는다 — memory rtdb-transaction-cold-abort) */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const NW = require('../functions/newsletter-weekly.js');
const { stripJs } = require('./strip-comments.js');
const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');

/* 진짜 파이어베이스 거래의 차례 */
function 찬거래(서버값, fn) {
  const 첫 = fn(null);
  if (첫 === undefined) return { committed: false, 값: 서버값 };          /* ② 접으면 서버에 안 묻는다 */
  if (서버값 === null) return { committed: true, 값: 첫 };
  const 다시 = fn(서버값);                                                 /* ③ 진짜 값으로 다시 */
  return 다시 === undefined ? { committed: false, 값: 서버값 } : { committed: true, 값: 다시 };
}

test('★★ 확정본이 «준비»면 찬 자리에서도 찜한다', () => {
  const r = 찬거래('준비', NW.자동발송찜);
  assert.strictEqual(r.committed, true, '06:00 에 «이미 처리 중»으로 헛돈다 — 2026-10-05 사고 그대로');
  assert.strictEqual(r.값, '거는중');
});

test('★ 이미 거는 중·완료·오류면 찜하지 않는다(두 번 안 나간다)', () => {
  ['거는중', '완료', '오류', '어긋남'].forEach((s) => {
    assert.strictEqual(찬거래(s, NW.자동발송찜).committed, false, s + ' 인데 또 찜했다');
  });
});

test('★ 서버가 그 거래를 쓴다 · 오류 되돌림도 찬 자리에서 접지 않는다', () => {
  assert.match(서버, /weeklyReady\/상태"\)\.transaction\(NewsletterWeekly\.자동발송찜\)/);
  const i = 서버.indexOf('/발송잠금").transaction((v) => {', 서버.indexOf('exports.weeklyNewsletterSend '));
  const 되돌림 = 서버.slice(i, i + 500);
  assert.match(되돌림, /if \(v == null\) return NL\.틀어졌다\(/, '오류 때 잠금을 못 풀어 손으로도 못 보낸다');
});
