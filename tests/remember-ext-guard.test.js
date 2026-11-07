/* 리멤버 확장 — 지킴이 (대표 지시 2026-11-07 「스스로 되살아나게」)
   11/5 18:00 회차 뒤로 «다음 때» 알람이 한 번도 안 울려 이틀 가까이 멈췄다(크롬·받는 화면은 살아 있었다).
   bg.js 를 가짜 크롬 위에서 «그대로» 돌려, 알람이 사라지거나 밀렸을 때 스스로 다시 맞추고 도는지 본다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BG = fs.readFileSync(path.join(__dirname, '..', 'tools', 'remember-ext', 'bg.js'), 'utf8');

/* 가짜 크롬 — 알람 창고와 «돌기 시작했나»(뱃지 '..')만 본다 */
function boot(alarms, now) {
  const listeners = { alarm: [], click: [], installed: [], startup: [] };
  const box = Object.assign({}, alarms || {});
  const runs = [];
  const T = now || Date.UTC(2026, 10, 7, 4, 0);
  const chrome = {
    alarms: {
      get: (n, cb) => cb(box[n] ? Object.assign({ name: n }, box[n]) : undefined),
      create: (n, o) => { box[n] = o.when ? { scheduledTime: o.when } : o.delayInMinutes ? { scheduledTime: T + o.delayInMinutes * 60000 } : { scheduledTime: T + o.periodInMinutes * 60000, periodInMinutes: o.periodInMinutes }; },
      onAlarm: { addListener: (f) => listeners.alarm.push(f) }
    },
    runtime: {
      onInstalled: { addListener: (f) => listeners.installed.push(f) },
      onStartup: { addListener: (f) => listeners.startup.push(f) },
      getURL: (p) => 'chrome-extension://x/' + p, reload: () => {}
    },
    action: {
      onClicked: { addListener: (f) => listeners.click.push(f) },
      setBadgeText: (o) => { if (o.text === '..') runs.push('run'); },
      setBadgeBackgroundColor: () => {}, setTitle: () => {}
    },
    tabs: { query: () => new Promise(() => {}), create: () => new Promise(() => {}) }   /* 회차는 시작만 보고 멈춰 둔다 */
  };
  const D = function (...a) { return a.length ? new Date(...a) : new Date(T); };
  D.now = () => T; D.parse = Date.parse; D.UTC = Date.UTC;
  const ctx = { chrome, importScripts: () => {}, DISK_VER: 'v1', Date: D, setTimeout, Promise, Math, Number, String, Uint8Array, btoa: (s) => s,
    fetch: () => Promise.reject(new Error('no')), console: { log() {}, warn() {} } };
  vm.createContext(ctx);
  vm.runInContext(BG, ctx);
  return { box, runs, listeners, T };
}
const tick = () => new Promise((r) => setImmediate(r));

test('★★★ 깨어났는데 «다음 때» 알람이 없으면 다시 맞추고 지금 한 번 돈다 — 11/5 뒤로 멈췄던 그 일', async () => {
  const w = boot({});
  await tick();
  assert.ok(w.box.pull && w.box.pull.scheduledTime > w.T, '★★★ 사라진 알람을 다시 안 맞춥니다 — 영영 안 돕니다');
  assert.strictEqual(w.runs.length, 1, '★★ 놓친 회차를 지금 안 돕니다(또는 두 번 돕니다)');
});

test('★★★ 30분마다 도는 지킴이 알람을 스스로 깐다 — 지킴이가 없으면 다음에 깨어날 길이 없다', async () => {
  const w = boot({});
  await tick();
  assert.ok(w.box.guard, '★★★ 지킴이 알람이 없습니다');
  assert.ok(w.box.guard.periodInMinutes > 0 && w.box.guard.periodInMinutes <= 30, '★ 지킴이는 30분 안쪽으로 «반복»해야 합니다');
});

test('★★ 알람이 제때 있으면 손대지 않는다 — 안 그러면 깰 때마다 회차가 돈다', async () => {
  const T = Date.UTC(2026, 10, 7, 4, 0);
  const w = boot({ pull: { scheduledTime: T + 20 * 60000 }, guard: { periodInMinutes: 30, scheduledTime: T + 60000 } }, T);
  await tick();
  assert.strictEqual(w.runs.length, 0, '★★ 멀쩡한데 돕니다');
  assert.strictEqual(w.box.pull.scheduledTime, T + 20 * 60000, '★ 멀쩡한 알람을 바꿉니다');
});

test('★★ 울렸어야 할 때를 넘겼는데 그대로면(10분 넘게) 지금 돌고 다시 맞춘다', async () => {
  const T = Date.UTC(2026, 10, 7, 4, 0);
  const w = boot({ pull: { scheduledTime: T - 30 * 60000 }, guard: { periodInMinutes: 30, scheduledTime: T + 60000 } }, T);
  await tick();
  assert.strictEqual(w.runs.length, 1, '★★ 밀린 알람을 그냥 둡니다');
  assert.ok(w.box.pull.scheduledTime > T, '★ 다음 때를 다시 안 맞춥니다');
});

test('★★ 지킴이 알람이 울리면 같은 점검을 한다', async () => {
  const T = Date.UTC(2026, 10, 7, 4, 0);
  const w = boot({ pull: { scheduledTime: T + 20 * 60000 }, guard: { periodInMinutes: 30, scheduledTime: T } }, T);
  await tick();
  delete w.box.pull;                                   /* 깨어 있는 동안 알람이 사라졌다 */
  w.listeners.alarm.forEach((f) => f({ name: 'guard' }));
  await tick();
  assert.ok(w.box.pull, '★★ 지킴이가 울려도 사라진 알람을 안 살립니다');
  assert.strictEqual(w.runs.length, 1);
});

test('★★ 아이콘을 누르면 돌고, 사라진 일정도 함께 살린다', async () => {
  const T = Date.UTC(2026, 10, 7, 4, 0);
  const w = boot({ pull: { scheduledTime: T + 20 * 60000 }, guard: { periodInMinutes: 30, scheduledTime: T } }, T);
  await tick();
  delete w.box.pull;
  w.listeners.click.forEach((f) => f());
  await tick();
  assert.ok(w.box.pull, '★★ 아이콘을 눌러도 일정이 안 살아납니다 — 한 번 돌고 다시 멈춥니다');
  assert.strictEqual(w.runs.length, 1, '★ 아이콘을 눌렀는데 안 돕니다');
});

test('★ 겹쳐 불러도 한 번만 돈다 — 알람·지킴이가 같은 순간에 깨워도', async () => {
  const w = boot({});
  w.listeners.alarm.forEach((f) => f({ name: 'pull' }));
  await tick();
  assert.strictEqual(w.runs.length, 1, '★ 같은 회차를 두 번 돕니다');
});
