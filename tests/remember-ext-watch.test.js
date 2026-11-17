/* 리멤버 연결 — 멈추지 않게 «세 겹» (대표 지시 2026-11-07 「앞으로 중단 안되게 … 중단된 경우 어떻게 해야할지도」)
   ① 확장 스스로: 지킴이 알람(tests/remember-ext-guard.test.js)
   ② PC 가 깨움: 예약 작업(sync-ext.js)이 서버의 마지막 확인을 보고 늦으면 kick.html 을 연다
   ③ 사람에게: 한 시간 넘게 그대로면 「⚠ 장애 알림」에 «무엇을 하면 되는지»를 올리고, 다시 돌면 닫는다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..', 'tools', 'remember-ext');
const sync = require(path.join(DIR, 'sync-ext.js'));
const BG = fs.readFileSync(path.join(DIR, 'bg.js'), 'utf8');
const SYNC = fs.readFileSync(path.join(DIR, 'sync-ext.js'), 'utf8');
const KICK = fs.readFileSync(path.join(DIR, 'kick.js'), 'utf8');
const T = (h, m, d) => new Date(2026, 10, d || 7, h, m, 0, 0).getTime();
const MIN = 60000;

function bgSlots() {
  const a = BG.indexOf('var DAY_FROM'), b = BG.indexOf('function arm()');
  const ctx = { Date, Math };
  vm.createContext(ctx);
  vm.runInContext('var EVERY_MIN = 30;\n' + BG.slice(a, b) + '\nthis.nextSlot = nextSlot;', ctx);
  return ctx;
}

/* ══ 도는 때 — 확장과 지켜보기가 «같은 시계»를 본다 ══ */

test('★★★ 지켜보기의 «지난 예정»은 확장이 실제로 도는 때와 같다 — 다르면 멀쩡한데 깨우거나, 멈췄는데 모른다', () => {
  const { nextSlot } = bgSlots();
  for (let t = T(0, 0, 6); t < T(0, 0, 8); t += 7 * MIN) {
    const p = sync.prevSlot(t);
    assert.ok(p && p <= t, '지난 예정이 앞날입니다: ' + new Date(t));
    assert.strictEqual(nextSlot(p - 1), p, '★★★ 확장은 ' + new Date(p) + ' 에 돌지 않습니다');
    assert.ok(nextSlot(p) > t || nextSlot(p) === nextSlot(t), '★★ 사이에 확장이 도는 때가 하나 더 있습니다: ' + new Date(t));
  }
});

/* ══ ② 깨우기 · ③ 알리기 — 할 일을 정하는 셈 ══ */

test('★★ 제때 돌고 있으면 아무것도 안 한다', () => {
  const d = sync.decide({ at: T(14, 31) }, T(14, 50), {});
  assert.deepStrictEqual(d.act, []);
  assert.deepStrictEqual(sync.decide({ at: T(13, 59) }, T(14, 10), {}).act, [], '★ 예정 뒤 15분 여유 안에서는 기다린다');
});

test('★★★ 예정이 15분 넘게 늦으면 깨운다 — 25분 안에 또 깨우지는 않는다', () => {
  const a = sync.decide({ at: T(13, 0) }, T(14, 20), {});
  assert.deepStrictEqual(a.act, ['kick'], '★★★ 늦었는데 안 깨웁니다');
  /* 14:32(새 슬롯 2분 뒤, 예약 작업이 도는 시각)에도 14:00 미실행 늦음이 유지되고 25분 안에는 또 깨우지 않는다 */
  const b = sync.decide({ at: T(13, 0) }, T(14, 32), a.state); assert.ok(b.state.lateSince > 0, '★★★ 14:32(새 슬롯 2분 뒤)에 늦음이 풀려 버립니다');
  assert.deepStrictEqual(b.act, [], '★ 12분 만에 또 깨웁니다 — 탭이 자꾸 열립니다');
  const c = sync.decide({ at: T(13, 0) }, T(14, 50), b.state);
  assert.deepStrictEqual(c.act, ['kick']);
});

test('★★★ 깨워도 한 시간 넘게 그대로면 대표에게 «한 번» 알린다', () => {
  let s = {};
  const acts = [];
  for (const t of [T(14, 20), T(14, 50), T(15, 20), T(15, 50)]) { const d = sync.decide({ at: T(13, 0) }, t, s); s = d.state; acts.push(d.act.join(',')); }
  assert.strictEqual(acts.filter((a) => a.indexOf('alert:stuck') >= 0).length, 1, '★★★ 알림이 안 가거나 되풀이됩니다: ' + acts.join(' / '));
  assert.ok(acts.slice(0, 2).every((a) => a.indexOf('alert') < 0), '★★ 한 시간도 안 됐는데 대표에게 알립니다: ' + acts.join(' / '));
});

/* 2026-11-17 대표 「계속 이거 팝업나온다 … 근본적으로 해결」 — 멈춰 있는 내내 30분마다 브라우저를 앞으로 띄웠다(하루 7~39번) */
test('★★★ 깨우기는 한 번 멈춤에 몇 번까지만 — 그 뒤로는 드물게 한 번씩(브라우저가 꺼졌으면 켜 주게)', () => {
  let s = {};
  const kicks = [];
  for (let t = T(14, 20); t <= T(23, 50); t += 30 * MIN) { const d = sync.decide({ at: T(13, 0) }, t, s); s = d.state; if (d.act.includes('kick')) kicks.push(t); }
  assert.ok(kicks.length >= 2, '★★ 늦었는데 처음 몇 번도 안 깨웁니다 — 자동으로 되살아나는 길이 없어집니다');
  const fast = kicks.slice(0, sync.MAX_KICKS);
  assert.ok(fast[fast.length - 1] - fast[0] < 60 * MIN, '★★ 처음 깨우기들이 너무 띄엄띄엄입니다');
  for (let i = sync.MAX_KICKS; i < kicks.length; i++) {
    assert.ok(kicks[i] - kicks[i - 1] >= sync.KICK_RETRY_MS, '★★★ 몇 번 깨운 뒤에도 자주 깨웁니다 — 팝업이 계속 뜹니다: ' + new Date(kicks[i]));
  }
  assert.ok(kicks.length <= sync.MAX_KICKS + Math.ceil((T(23, 50) - T(14, 20)) / sync.KICK_RETRY_MS), '★★★ 반나절 멈춤에 깨우기가 너무 많습니다: ' + kicks.length + '번');
  assert.ok(sync.KICK_RETRY_MS >= 2 * 60 * MIN, '★★ 다시 깨우는 간격이 짧습니다');
  const back = sync.decide({ at: T(23, 55) }, T(23, 58), s);
  assert.strictEqual(back.state.kicks, 0, '★★ 다시 돌아도 깨운 횟수가 안 풀립니다 — 다음 멈춤에 한 번도 안 깨웁니다');
});

test('★★★ 확장이 꺼져 있으면 깨우지 않고 곧바로 «켜 주세요»를 알린다 — 깨워도 «차단됨» 화면만 뜬다', () => {
  const ext = { browser: '에고라이트', profile: 'P', profileName: '이름', id: 'x', off: true };
  const d = sync.decide({ at: T(13, 0) }, T(14, 20), {}, ext);
  assert.ok(!d.act.includes('kick'), '★★★ 꺼진 확장을 깨웁니다 — 30분마다 «…이(가) 차단됨» 창이 뜹니다');
  assert.ok(d.act.includes('alert:off'), '★★★ 꺼졌다는 것을 대표에게 곧바로 알리지 않습니다: ' + d.act.join(','));
  assert.deepStrictEqual(sync.decide({ at: T(13, 0) }, T(14, 50), d.state, ext).act, [], '★★ 같은 알림을 되풀이합니다');
  const m = sync.alertText('off', { at: T(13, 0) }, ext);
  ['에고라이트', '이름', 'extensions', '개발자 모드', '켜'].forEach((k) => assert.ok(m.indexOf(k) >= 0, '★★ 알림에 «' + k + '» 가 없습니다 — 무엇을 하면 되는지 모릅니다: ' + m));
  assert.deepStrictEqual(sync.decide({ at: T(14, 31) }, T(14, 50), d.state, ext).act, ['resolve'], '★★ 다시 돌아도 «켜 주세요» 알림이 안 닫힙니다');
});

test('★★ 다른 곳에서 켜져 있으면 그쪽을 깨우고, 꺼진 곳은 멈춤 알림에 덧붙인다', () => {
  const off = { browser: '에고라이트', profile: 'P', profileName: '이름', id: 'x' };
  const ext = { browser: '크롬', profile: 'D', id: 'x', offIn: [off] };
  assert.ok(sync.decide({ at: T(13, 0) }, T(14, 20), {}, ext).act.includes('kick'), '★★ 켜진 곳이 있는데 안 깨웁니다');
  const m = sync.alertText('stuck', { at: T(13, 0) }, ext);
  assert.ok(m.indexOf('에고라이트') >= 0 && m.indexOf('꺼져') >= 0, '★ 멈춤 알림에 «에고라이트에서는 꺼져 있다»가 없습니다: ' + m);
});

test('★★★ 리멤버 로그인이 풀렸으면 깨우지 말고 곧바로 «다시 로그인» 을 알린다 — 깨워도 소용없다', () => {
  const d = sync.decide({ at: T(13, 0), err: 'login', errAt: T(13, 30) }, T(14, 20), {});
  assert.deepStrictEqual(d.act, ['alert:login']);
  assert.match(sync.alertText('login', {}), /다시 로그인/);
});

test('★★ 다시 돌기 시작하면 알림을 «해결»로 닫는다 — 알린 적이 없으면 손대지 않는다', () => {
  assert.deepStrictEqual(sync.decide({ at: T(15, 31) }, T(15, 50), { alerted: 'stuck', lateSince: T(14, 0), lastKick: T(15, 20) }).act, ['resolve']);
  assert.deepStrictEqual(sync.decide({ at: T(15, 31) }, T(15, 50), { lateSince: T(14, 0), lastKick: T(15, 20) }).act, [],
    '★ 알리지도 않은 것을 닫으러 서버에 씁니다');
});

test('★★ 알림 말은 «무엇을 하면 되는지»를 차례로 적는다 — 마지막은 클로드에게', () => {
  const m = sync.alertText('stuck', { at: T(13, 0) });
  ['①', '②', '③', '④', '리멤버 점검'].forEach((k) => assert.ok(m.indexOf(k) >= 0, '★★ 할 일 「' + k + '」이 없습니다: ' + m));
});

test('★★ 알림은 장애 알림판이 세는 모양으로, «한 자리»에 덮어쓴다 — 멈출 때마다 줄이 쌓이지 않게', () => {
  assert.match(SYNC, /'\/systemAlerts\/' \+ uid \+ '\/remember-stall'/, '★★ 알림 자리가 고정이 아닙니다');
  assert.match(SYNC, /status: 'new'/, '★★ 판(pu-health)은 status new 만 셉니다 — 다른 값이면 배지가 안 켜집니다');
  assert.match(SYNC, /status: 'resolved'/, '★ 다시 돌아도 알림이 안 닫힙니다');
});

test('★★ 갱신(받기)이 막혀도 지켜보기는 한다 — 둘은 다른 일이다', () => {
  const main = SYNC.slice(SYNC.indexOf('function main()'));
  assert.ok(!/process\.exit/.test(main), '★★ 갱신이 막히면 그 자리에서 끝나 지켜보기를 못 합니다');
  assert.match(main, /watch\(dry\);\s*\r?\n\}/, '★ main 끝에서 지켜보기를 안 부릅니다');
  assert.match(main, /kick\('새 판'\)/, '★★ 새 판을 깔고 깨우지 않으면 확장이 옛 코드로 남습니다(11/7 실제로 그랬다)');
});

test('★ 새 판에 깨우기 화면이 함께 실린다', () => {
  ['kick.html', 'kick.js'].forEach((f) => {
    assert.ok(sync.FILES.includes(f), '★ 갱신 목록에 ' + f + ' 이 없습니다 — 설치 폴더에 안 들어갑니다');
    assert.ok(fs.existsSync(path.join(DIR, f)), f + ' 이 없습니다');
  });
});

/* ══ 깨우기 화면(kick.js) — 일꾼이 답을 못 하면 다시 시작한다 ══ */

function runKick(answer, disk) {
  const calls = [];
  const chrome = {
    runtime: { sendMessage: (m, cb) => setTimeout(() => cb(answer), 5), reload: () => calls.push('reload'), lastError: null },
    alarms: { create: (n, o) => calls.push('alarm:' + n + ':' + o.delayInMinutes) },
    tabs: { getCurrent: (cb) => cb({ id: 7 }), remove: (id) => calls.push('close:' + id) }
  };
  const ctx = { chrome, Promise, setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 20)),
    fetch: () => Promise.resolve({ text: () => Promise.resolve("var DISK_VER = '" + disk + "';") }) };
  vm.createContext(ctx);
  vm.runInContext(KICK, ctx);
  return new Promise((r) => setTimeout(() => r(calls), 120));
}

test('★★★ 일꾼이 답이 없으면(옛 판·멈춘 일꾼) 확장을 다시 시작하고 1분 뒤 회차를 맞춘다', async () => {
  const c = await runKick(undefined, 'v2');
  assert.deepStrictEqual(c, ['alarm:pull:1', 'reload'], '★★★ 멈춘 일꾼을 그대로 둡니다: ' + c.join(','));
});

test('★★ 일꾼이 같은 판으로 답하면 다시 시작하지 않고 탭만 닫는다', async () => {
  const c = await runKick({ ver: 'v2' }, 'v2');
  assert.deepStrictEqual(c, ['close:7'], '★★ 멀쩡한 확장을 다시 시작합니다(도는 회차가 끊깁니다): ' + c.join(','));
});

test('★★ 일꾼이 옛 판이면 다시 시작한다 — 새 코드를 읽게', async () => {
  const c = await runKick({ ver: 'v1' }, 'v2');
  assert.ok(c.includes('reload'), '★★ 옛 판 일꾼을 그대로 둡니다');
});

/* ══ 일꾼(bg.js) 쪽 ══ */

test('★★ 일꾼은 «확장 자기 화면»이 보낸 kick 에만 답하고 돈다 — 리멤버·푸른 탭의 말로는 안 돈다', () => {
  const box = { listeners: [] };
  const runs = [];
  const chrome = {
    alarms: { get: (n, cb) => cb({ scheduledTime: Date.now() + 9e5, periodInMinutes: n === 'guard' ? 30 : undefined }), create() {}, onAlarm: { addListener() {} } },
    runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener: (f) => box.listeners.push(f) },
      getURL: (p) => 'chrome-extension://abc/' + p, reload() {} },
    action: { onClicked: { addListener() {} }, setBadgeText: (o) => { if (o.text === '..') runs.push(1); }, setBadgeBackgroundColor() {}, setTitle() {} },
    tabs: { query: () => new Promise(() => {}) }
  };
  const ctx = { chrome, importScripts() {}, DISK_VER: 'v9', Date, setTimeout, Promise, Math, fetch: () => Promise.reject(new Error('x')) };
  vm.createContext(ctx);
  vm.runInContext(BG, ctx);
  assert.strictEqual(box.listeners.length, 1, '★★ 깨우기를 받는 귀가 없습니다');
  let got = null;
  box.listeners[0]({ cmd: 'kick' }, { url: 'https://card.rememberapp.co.kr/x' }, (r) => { got = r; });
  assert.strictEqual(got, null, '★★ 리멤버 탭이 보낸 말에 답합니다');
  box.listeners[0]({ cmd: 'kick' }, { url: 'chrome-extension://abc/kick.html' }, (r) => { got = r; });
  assert.deepStrictEqual(Object.assign({}, got), { ver: 'v9' }, '★★★ 판 번호로 답하지 않으면 깨우기 화면이 매번 다시 시작합니다');
});

test('★★ 지킴이 알람이 울릴 때 새 판도 본다 — 회차가 안 돌아도 새 코드가 들어온다', () => {
  assert.match(BG, /a\.name === 'guard'\) \{ guard\(\); if \(!running\) selfUpdate\(\); \}/,
    '★★ 새 판은 회차 안에서만 봅니다 — 11/7 처럼 회차가 멈추면 고친 코드도 못 들어옵니다');
});
