'use strict';
/* 한글 편집기 — 큰 문서에서 글자를 칠 때마다 «쪽 나눔 전체»를 돌리지 않는다 (2026-11-08)
   ■ 왜
     큰 .hwp 가 이제 «끝까지» 읽힌다(옛 판은 압축 해제가 128KB 에서 잘려 편람 450쪽 중 10% 만 보였다).
     그러자 편람 한 번의 쪽 나눔이 약 5초 걸린다(표 964개·문단 2만 개). 글자를 칠 때마다 돌리면 화면이 멈춘 것처럼 된다.
   ■ 지금
     쪽 나눔이 마지막에 0.25초 넘게 걸렸으면, 입력이 잠깐 멈춘 뒤 «한 번만» 돌린다(걸린 시간의 절반, 최대 1.2초).
     작은 문서는 전처럼 다음 화면 그리기 때 바로 돈다.
   ⚠ 값(0.25초·1.2초)이 아니라 «큰 문서는 미루고 작은 문서는 안 미룬다 · 연타해도 한 번만 돈다» 를 본다.
   node --test tests/hangul-big-doc-typing.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'hangul/js/editor.js'), 'utf8').replace(/\r\n/g, '\n');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\n\s*\/\/[^\n]*/g, '\n');
const CODE = strip(SRC);

/* queueLayout 을 가짜 시간·가짜 «다음 화면» 위에서 돌린다 */
function rig(lastMs) {
  const log = { frames: [], timers: [], cleared: [], paginated: 0, caret: 0 };
  let id = 0;
  const setTimeoutF = (fn, ms) => { const t = { id: ++id, fn, ms }; log.timers.push(t); return t.id; };
  const clearTimeoutF = i => { log.cleared.push(i); const t = log.timers.find(x => x.id === i); if (t) t.dead = true; };
  const code = cutFn(CODE, 'function queueLayout(');
  const make = new Function('nextFrame', 'setTimeout', 'clearTimeout', 'paginate', 'keepCaretVisible', 'initMs',
    'let layoutQueued = false, lastPaginateMs = initMs, layoutTimer = 0;\n' + code + '\nreturn { queueLayout, queued: () => layoutQueued };');
  const api = make(fn => log.frames.push(fn), setTimeoutF, clearTimeoutF, () => { log.paginated++; }, () => { log.caret++; }, lastMs);
  return { api, log, fireFrames: () => { const f = log.frames.splice(0); f.forEach(fn => fn()); }, fireTimers: () => log.timers.filter(t => !t.dead).forEach(t => { t.dead = true; t.fn(); }) };
}

test('★★★ 작은 문서(쪽 나눔이 빠름): 연타해도 «다음 화면 그리기» 한 번에 한 번만 돌고, 타이머로 미루지 않는다', () => {
  const { api, log, fireFrames } = rig(40);
  for (let i = 0; i < 8; i++) api.queueLayout();
  assert.strictEqual(log.frames.length, 1, '프레임 예약이 한 번이어야 합니다: ' + log.frames.length);
  assert.strictEqual(log.timers.length, 0, '작은 문서를 타이머로 미뤘습니다');
  assert.strictEqual(log.paginated, 0);
  fireFrames();
  assert.strictEqual(log.paginated, 1);
  assert.strictEqual(log.caret, 1, '쪽 나눔 뒤 커서가 보이게 하는 것도 해야 합니다');
  assert.strictEqual(api.queued(), false);
});

test('★★★ 큰 문서(쪽 나눔이 오래 걸림): 연타하면 마지막 한 번만 — 이전 예약을 지우고, 프레임으로는 돌지 않는다', () => {
  const { api, log, fireFrames, fireTimers } = rig(5000);
  for (let i = 0; i < 10; i++) api.queueLayout();
  assert.strictEqual(log.frames.length, 0, '큰 문서를 다음 화면 그리기마다 돌립니다');
  assert.strictEqual(log.timers.filter(t => !t.dead).length, 1, '살아 있는 예약은 마지막 하나여야 합니다');
  assert.ok(log.cleared.length >= 9, '이전 예약 9개를 지워야 합니다(첫 호출의 빈 번호 지우기는 상관없음): ' + log.cleared.length);
  assert.strictEqual(log.timers.filter(t => t.dead).length, 9, '앞선 예약 9개는 죽어 있어야 합니다');
  assert.ok(log.timers[log.timers.length - 1].ms >= 300 && log.timers[log.timers.length - 1].ms <= 2000, '미루는 시간이 말이 안 됩니다: ' + log.timers[log.timers.length - 1].ms);
  fireFrames();
  assert.strictEqual(log.paginated, 0, '입력이 멈추기 전에 돌았습니다');
  fireTimers();
  assert.strictEqual(log.paginated, 1);
  assert.strictEqual(log.caret, 1);
  assert.strictEqual(api.queued(), false);
});

test('★★ 미루는 시간은 걸린 시간에 비례하되 위로 막혀 있다 — 20초 걸려도 입력을 1~2초 넘게 기다리지 않는다', () => {
  const a = rig(600); a.api.queueLayout();
  const b = rig(5000); b.api.queueLayout();
  const c = rig(60000); c.api.queueLayout();
  const ms = r => r.log.timers[0].ms;
  assert.ok(ms(a) < ms(b), '더 오래 걸리는 문서가 더 오래 미뤄져야 합니다');
  assert.ok(ms(c) <= 2000, '미루는 시간에 상한이 없습니다: ' + ms(c));
  assert.ok(ms(b) <= 2000);
});

test('★★ 한 번 미룬 뒤 쪽 나눔이 빨라지면(문단을 많이 지워 작아짐) 다시 «다음 화면» 방식으로 돌아온다', () => {
  const code = cutFn(CODE, 'function queueLayout(');
  const log = { frames: 0, timers: 0 };
  const state = { ms: 5000 };
  const make = new Function('nextFrame', 'setTimeout', 'clearTimeout', 'paginate', 'keepCaretVisible', 'state',
    'let layoutQueued = false, lastPaginateMs = 0, layoutTimer = 0;\n' + code + '\nreturn { queueLayout, set: v => { lastPaginateMs = v; }, reset: () => { layoutQueued = false; } };');
  const api = make(() => { log.frames++; }, () => { log.timers++; return log.timers; }, () => {}, () => {}, () => {}, state);
  api.set(5000); api.queueLayout(); assert.strictEqual(log.timers, 1);
  api.set(30); api.reset(); api.queueLayout();
  assert.strictEqual(log.frames, 1, '빨라졌는데도 계속 타이머로 미룹니다');
});

test('★★ paginate 는 걸린 시간을 기억한다 — 오류가 나도 기억하고 오류는 그대로 던진다', () => {
  const code = cutFn(CODE, 'function paginate(');
  let t = 1000;
  const perf = { now: () => (t += 700) };
  let boom = false;
  const make = new Function('performance', 'paginateNow', 'clearTimeout', 'let lastPaginateMs = 0, layoutQueued = false, layoutTimer = 0;\n' + code + '\nreturn { paginate, ms: () => lastPaginateMs };');
  const api = make(perf, () => { if (boom) throw new Error('쪽 나눔 실패'); }, () => {});
  api.paginate();
  assert.strictEqual(api.ms(), 700, '걸린 시간을 기억하지 않습니다');
  boom = true;
  assert.throws(() => api.paginate(), /쪽 나눔 실패/);
  assert.strictEqual(api.ms(), 700);
});

test('★★ 지금 바로 나누면(탭 바꾸기·되돌리기) 미뤄 둔 예약을 지운다 — 뒤늦게 한 번 더 돌거나 다음 예약을 막지 않는다 (자동 검토 «낮음»)', () => {
  const code = cutFn(CODE, 'function paginate(');
  const cleared = [];
  const make = new Function('performance', 'paginateNow', 'clearTimeout',
    'let lastPaginateMs = 9999, layoutQueued = true, layoutTimer = 77;\n' + code + '\nreturn { paginate, queued: () => layoutQueued, timer: () => layoutTimer };');
  const api = make({ now: () => 0 }, () => {}, id => cleared.push(id));
  api.paginate();
  assert.deepStrictEqual(cleared, [77], '대기 중이던 타이머(77)를 지우지 않았습니다');
  assert.strictEqual(api.queued(), false, '«예약됨» 표시가 남아 다음 queueLayout 을 막습니다');
  assert.strictEqual(api.timer(), 0);
});

test('★ 소스: paginate 는 paginateNow 를 감싸고, 변수는 파일 위쪽에서 한꺼번에 선언한다(선언 전에 쓰지 않는다)', () => {
  assert.match(CODE, /function paginateNow\(\) \{/);
  assert.match(CODE, /let [^;\n]*layoutQueued[^;\n]*lastPaginateMs = 0[^;\n]*layoutTimer = 0/);
});
