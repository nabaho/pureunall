/* 리멤버 확장이 도는 때 (대표 지시 2026-10-31):
   낮 09:00~18:00 은 30분마다, 그 밖에는 00:00 · 06:00 에 한 번씩. nextSlot 을 실제로 꺼내 돌린다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const bg = fs.readFileSync(path.join(__dirname, '..', 'tools', 'remember-ext', 'bg.js'), 'utf8');

function load() {
  const a = bg.indexOf('var DAY_FROM');
  const b = bg.indexOf('function arm()');
  assert.ok(a > -1 && b > a, '일정 코드를 찾지 못했습니다');
  const ctx = { Date, Math, EVERY_MIN: 30 };
  vm.createContext(ctx);
  vm.runInContext('var EVERY_MIN = 30;\n' + bg.slice(a, b) + '\nthis.nextSlot = nextSlot; this.slotsOfDay = slotsOfDay;', ctx);
  return ctx;
}
const at = (h, m, d) => new Date(2026, 9, d || 31, h, m, 0, 0).getTime();
const hm = (ms) => { const t = new Date(ms); return t.getDate() + '일 ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); };

test('낮 09:00~18:00 은 30분마다(양끝 포함)', () => {
  const { nextSlot } = load();
  assert.strictEqual(hm(nextSlot(at(9, 0))), '31일 09:30');
  assert.strictEqual(hm(nextSlot(at(12, 10))), '31일 12:30');
  assert.strictEqual(hm(nextSlot(at(17, 31))), '31일 18:00');
  assert.strictEqual(hm(nextSlot(at(8, 59))), '31일 09:00');
});

test('18:00 이후에는 낮에 안 돌고 다음 00:00 에 한 번', () => {
  const { nextSlot } = load();
  assert.strictEqual(hm(nextSlot(at(18, 0))), '1일 00:00');
  assert.strictEqual(hm(nextSlot(at(23, 45))), '1일 00:00');
});

test('00:00 뒤에는 06:00, 06:00 뒤에는 09:00 (밤에 30분마다 돌지 않는다)', () => {
  const { nextSlot } = load();
  assert.strictEqual(hm(nextSlot(at(0, 0))), '31일 06:00');
  assert.strictEqual(hm(nextSlot(at(3, 20))), '31일 06:00');
  assert.strictEqual(hm(nextSlot(at(6, 0))), '31일 09:00');
});

test('하루에 도는 횟수 = 낮 19번 + 밤 2번', () => {
  const { slotsOfDay } = load();
  const s = Array.from(slotsOfDay());
  assert.strictEqual(s.length, 21);
  assert.strictEqual(s.filter((m) => m >= 9 * 60 && m <= 18 * 60).length, 19);
  assert.deepStrictEqual(s.filter((m) => m < 9 * 60 || m > 18 * 60), [0, 360]);
});

test('알람은 «다음 때» 하나(when)로 맞추고 울릴 때마다 다시 맞춘다 — 30분 반복 알람은 쓰지 않는다', () => {
  assert.ok(!/periodInMinutes\s*:\s*EVERY_MIN/.test(bg), '옛 30분 반복 알람이 남아 있습니다');
  assert.match(bg, /onAlarm\.addListener\(function \(a\) \{ if \(a\.name === 'pull'\) \{ arm\(\); run\(\); \} \}\)/);
});
