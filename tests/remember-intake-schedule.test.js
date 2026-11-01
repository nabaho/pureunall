/* 받는 화면의 «확인이 늦습니다» 띠 (대표 「네」 2026-11-01)
   ① 화면이 아는 일정이 확장(bg.js)의 일정과 «같은가»  ② 멈춘 것은 드러나고, 제때 돈 것은 초록으로 두는가 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'remember-intake.html'), 'utf8');
const bg = fs.readFileSync(path.join(__dirname, '..', 'tools', 'remember-ext', 'bg.js'), 'utf8');

function pageFns() {
  const a = html.indexOf('var DAY_FROM');
  const b = html.indexOf('function draw()');
  assert.ok(a > -1 && b > a, '화면의 일정 코드를 찾지 못했습니다');
  const ctx = { Date, Math, Number };
  vm.createContext(ctx);
  vm.runInContext(html.slice(a, b) + '\nthis.nextSlot = nextSlot; this.prevSlot = prevSlot; this.lateBy = lateBy;', ctx);
  return ctx;
}
function bgNext() {
  const a = bg.indexOf('var DAY_FROM');
  const b = bg.indexOf('function arm()');
  const ctx = { Date, Math };
  vm.createContext(ctx);
  vm.runInContext('var EVERY_MIN = 30;\n' + bg.slice(a, b) + '\nthis.nextSlot = nextSlot;', ctx);
  return ctx.nextSlot;
}
const at = (h, m, d) => new Date(2026, 10, d || 1, h, m, 0, 0).getTime();

test('화면이 아는 «다음 때»는 확장과 하루 종일 같다(어긋나면 거짓말을 한다)', () => {
  const page = pageFns().nextSlot, ext = bgNext();
  for (let t = at(0, 0, 1); t < at(0, 0, 3); t += 7 * 60000) assert.strictEqual(page(t), ext(t), new Date(t).toString());
});

test('제때 돌았으면 초록(늦지 않음)', () => {
  const { lateBy } = pageFns();
  assert.strictEqual(lateBy({ at: at(9, 31) }, at(9, 40)), false);       // 09:30 회차를 하고 쉬는 중
  assert.strictEqual(lateBy({ at: at(9, 0) }, at(9, 10)), false);        // 09:00 회차가 막 시작한 여유
  assert.strictEqual(lateBy({ at: at(6, 1) }, at(8, 50)), false);        // 밤 06:00 회차 뒤 아침 전
  assert.strictEqual(lateBy({ at: at(18, 1) }, at(23, 50)), false);      // 18:00 회차 뒤 밤 사이
});

test('예정된 때를 지났는데 확인이 없으면 늦음', () => {
  const { lateBy } = pageFns();
  assert.strictEqual(lateBy({ at: at(9, 0) }, at(9, 50)), true);         // 09:30 회차가 없다
  assert.strictEqual(lateBy({ at: at(18, 1, 1) }, at(6, 30, 2)), true);  // 00:00·06:00 회차가 없다
  assert.strictEqual(lateBy({ at: at(12, 0, 1) }, at(12, 20, 2)), true); // 하루가 지났다
});

test('기록이 아직 없으면 늦음이라 하지 않는다(첫 회차 기다리는 띠가 따로 있다)', () => {
  assert.strictEqual(pageFns().lateBy({}, at(12, 0)), false);
});

test('늦음 띠는 있고, 안내문은 옛 «1시간마다»를 말하지 않는다', () => {
  assert.match(html, /band warn/);
  assert.ok(!/<p class="muted"[\s\S]{0,400}1시간마다/.test(html), '안내문에 옛 주기가 남았습니다');
  assert.match(html, /<th>결과<\/th>/);
});

test('리멤버 줄에도 출처 표시(📇)가 붙는다', () => {
  assert.match(html, /'📇 새로 넣음'/);
  assert.match(html, /'📇 빈 칸 채움'/);
  assert.match(html, /'📇 이미 있음'/);
});
