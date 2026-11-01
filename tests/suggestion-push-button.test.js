'use strict';
/* 건의함 머리의 [🔔 테스트] (대표 지시 2026-11-01 「둘다」) — enter.html pushSelfTest
   누르면 pucards/config/pushTest/{내 uid} 에 요청(req)을 쓰고, 서버(pushSelfTest 함수)가 같은 자리 done 에 적는 결과를 «기다려» 보여 준다.

   ■ 지키는 것
     ① 내 자리(uid)에 새 요청 번호(req)를 쓴다 — 남의 자리가 아니다
     ② 결과마다 «다른 말»을 한다: 보냄 · 기기 없음 · 보내기 실패 · 연타 · 관리자 아님
     ③ 15초 안에 답이 없으면 «말한다» — 조용히 멈추면 「안 된다」로 보인다
     ④ 끝나면 단추가 도로 눌린다 · 듣던 것을 놓는다(눌러 볼 때마다 듣는 것이 쌓이지 않게)
     ⑤ 단추는 관리자에게만 보인다
   실행: node --test tests/suggestion-push-button.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').split('\r\n').join('\n');
const fnSrc = sliceFn(html, 'function pushSelfTest(');

function run(opt) {
  const o = opt || {};
  const alerts = [], updates = [], timers = [];
  const btn = { disabled: false, textContent: '🔔 테스트' };
  const listeners = [];
  const ref = (p) => ({
    _p: p,
    on: (ev, cb) => { listeners.push(cb); },
    off: (ev, cb) => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); },
    update: (v) => { updates.push([p, v]); return o.rejectWith ? Promise.reject(new Error(o.rejectWith)) : Promise.resolve(); },
  });
  const ctx = {
    SG: { uid: o.uid === undefined ? 'U-CEO' : o.uid },
    db: { ref },
    $: (id) => (id === 'sgPushTestBtn' ? btn : null),
    alert: (m) => alerts.push(String(m)),
    Date, Number, Promise,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
  };
  vm.createContext(ctx);
  vm.runInContext(fnSrc, ctx);
  ctx.pushSelfTest();
  /* 서버가 done 을 적었다고 흉내 — 쓴 req 를 그대로 되돌려 준다 */
  ctx.__answer = (done) => {
    const req = updates[0][1].req;
    listeners.slice().forEach((cb) => cb({ val: () => ({ req, done: Object.assign({ req }, done) }) }));
  };
  ctx.__alerts = alerts; ctx.__updates = updates; ctx.__btn = btn; ctx.__timers = timers; ctx.__listeners = listeners;
  return ctx;
}

test('★ ① 내 자리에 새 요청 번호를 쓴다', () => {
  const c = run();
  assert.equal(c.__updates.length, 1);
  assert.equal(c.__updates[0][0], 'pucards/config/pushTest/U-CEO', '내 uid 자리가 아닙니다');
  assert.ok(Number(c.__updates[0][1].req) > 1e12, '요청 번호(시각)가 아닙니다');
  assert.equal(c.__btn.disabled, true, '누른 동안 단추를 막아야 연타하지 않습니다');
});

test('★★ ② 결과마다 «다른 말»을 한다', () => {
  const say = (done) => { const c = run(); c.__answer(done); return c.__alerts.join('|'); };
  const ok = say({ targets: 2, sent: 2, failed: 0 });
  assert.match(ok, /2대로 보냈습니다/);
  assert.match(ok, /폰 크롬/, '폰에 안 뜰 때 어디를 볼지 알려 주지 않습니다');
  assert.match(say({ targets: 0, sent: 0, failed: 0 }), /등록된 기기가 없습니다/);
  assert.match(say({ targets: 2, sent: 0, failed: 2 }), /보내지 못했습니다/);
  assert.match(say({ targets: 2, sent: 1, failed: 1 }), /1대는 실패/);
  assert.match(say({ limited: true, targets: 0, sent: 0, failed: 0 }), /15초/);
  assert.match(say({ error: '관리자만 알림을 시험할 수 있습니다' }), /관리자만/);
  const all = [say({ targets: 2, sent: 2, failed: 0 }), say({ targets: 0 }), say({ limited: true }), say({ error: 'x' })];
  assert.equal(new Set(all).size, all.length, '서로 다른 결과에 같은 말을 합니다');
});

test('★ ② 다른 요청(req)의 옛 결과에는 반응하지 않는다 — 지난번 done 이 이번 결과로 보이면 안 된다', () => {
  const c = run();
  c.__listeners.slice().forEach((cb) => cb({ val: () => ({ req: 1, done: { req: 1, targets: 2, sent: 2, failed: 0 } }) }));
  assert.equal(c.__alerts.length, 0, '옛 결과를 이번 결과로 보여 줬습니다');
  assert.equal(c.__btn.disabled, true, '아직 기다리는 중이어야 합니다');
});

test('★★ ③ 15초 안에 답이 없으면 «말한다»', () => {
  const c = run();
  const t = c.__timers.find((x) => x.ms === 15000);
  assert.ok(t, '15초 시한이 없습니다 — 함수가 안 올라가 있으면 영영 「보내는 중…」으로 멈춥니다');
  t.fn();
  assert.match(c.__alerts.join('|'), /15초 안에 답하지 않았습니다/);
  assert.match(c.__alerts.join('|'), /pushSelfTest/, '무엇이 안 올라갔는지 알려 줍니다');
});

test('④ 끝나면 단추가 도로 눌리고 듣던 것을 놓는다', () => {
  const c = run();
  c.__answer({ targets: 2, sent: 2, failed: 0 });
  assert.equal(c.__btn.disabled, false);
  assert.equal(c.__btn.textContent, '🔔 테스트');
  assert.equal(c.__listeners.length, 0, '듣던 것을 안 놓았습니다 — 누를 때마다 쌓입니다');
  assert.ok(c.__timers.every((t) => t.cleared || t.ms !== 15000), '15초 시한을 안 걷었습니다 — 성공한 뒤에 오류가 또 뜹니다');
});

test('④ 요청을 못 쓰면(규칙·그물) 그 까닭을 말한다', async () => {
  const c = run({ rejectWith: 'PERMISSION_DENIED' });
  await new Promise((r) => setImmediate(r));
  assert.match(c.__alerts.join('|'), /PERMISSION_DENIED/);
  assert.equal(c.__btn.disabled, false);
});

test('로그인 전(uid 없음)에는 아무것도 쓰지 않는다', () => {
  const c = run({ uid: '' });
  assert.equal(c.__updates.length, 0);
});

test('★ ⑤ 단추는 관리자에게만 보인다 · 눌렀을 때 연결돼 있다', () => {
  const tr = sliceFn(html, 'function pushTestRefresh(');
  assert.match(tr, /sgPushTestBtn[\s\S]{0,160}sgIsAdmin\(\)/, '관리자 아닌 사람에게도 시험 단추가 보입니다');
  /* 등록 단추(pushRefresh)는 직원에게도 보여야 한다 — 관리자 가림은 시험 단추 줄(pushTestRefresh)에만 둔다 */
  const rf = sliceFn(html, 'function pushRefresh(');
  assert.match(rf, /pushTestRefresh\(\)/, '등록 단추를 다시 그릴 때 시험 단추도 다시 그려야 합니다');
  assert.ok(!/sgIsAdmin\(\)/.test(rf), '등록 단추(pushRefresh)에 관리자 가림막이 들어갔습니다 — 직원 알림 등록 길이 막힙니다');
  assert.match(html, /\$\('sgPushTestBtn'\)\.addEventListener\('click', pushSelfTest\)/, '단추를 눌러도 아무 일이 없습니다');
  assert.match(html, /<button id="sgPushTestBtn"/, '단추가 없습니다');
});
