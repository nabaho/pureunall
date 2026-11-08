'use strict';
/* 급여아웃소싱 — 지어낸 근로자를 급여 칸에 써 넣지 않는다 (2026-11-08 발견)
   실행: node --test tests/payroll-no-fake-autofill.test.js

   ■ 무엇이 깨졌었나
   「2026 메일 자동수집」(#2911, autoSync2026FromMail)은 메일을 급여로 읽지 않았다.
   2026년에 빈 달마다 **코드에 박힌 지어낸 근로자 3명**을 초록(이상없음)으로
   payroll/emp·payroll/index 에 쓰고, 업체 이름으로 사업장·설정카드·짝(site_co_link)도 만들었다.
   그리고 권한 있는 사람이 로그인할 때마다 저절로 돌았다.

   ■ 이 검사가 지키는 규칙
   ① 메일 요약을 다시 모아도 급여 칸(payroll·site_cards·site_co_link)에는 아무것도 쓰지 않는다 — vm 에서 실제로 돌려 본다.
   ② 로그인 뒤 저절로 부르지 않는다 — 부르는 자리는 사람이 누르는 단추(onclick)뿐이다.
   ③ 이미 서버에 들어간 가짜 줄은 «막힘»으로 보이고 확정되지 않는다. 진짜 줄은 그대로다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const html = fs.readFileSync(path.join(__dirname, '..', 'payroll-os.html'), 'utf8');

function tick() { return new Promise(r => setImmediate(r)); }

test('① 메일 요약을 모아도 급여 칸에는 쓰지 않는다 (빈 달이 있는 업체가 있어도)', async () => {
  const src = cutFn(html, 'function autoSync2026FromMail(');
  const writes = [];
  const said = [];
  const refOf = p => ({
    limitToLast: () => ({ once: () => Promise.resolve({ val: () => ({}) }) }),
    once: () => Promise.resolve({ val: () => ({}) }),
    set: v => { writes.push(['set', p]); return Promise.resolve(); },
    update: v => { writes.push(['update', p]); return Promise.resolve(); },
    push: v => { writes.push(['push', p]); return Promise.resolve(); },
  });
  const ctx = {
    console, Object, Array, Promise, Date, String, Math, Number,
    ROOT: 'payroll_os',
    autoSyncBusy: false,
    fbDb: { ref: refOf },
    coData: { companies: [{ id: 'c1', name: '시험상사' }, { id: 'c2', name: '연습식당' }], dir: {} },
    cache: {},
    payIdx: { '시험상사': [] },   // 2026년 자료가 한 달도 없다 — 예전 코드는 여기를 가짜로 채웠다
    ensureCo: () => {},
    paySites: () => ['시험상사'],
    payRecs: () => [],
    lmap: () => ({}),
    inboxLog: () => ({}),          // 예전 코드가 읽던 것 — 옛 코드로 돌려도 «급여 칸에 썼다»로 걸리게 둔다
    empBox: {},
    ymOf: () => null,
    horizonMemo: {},
    dbGet: (k, d) => d,
    setSaveState: () => {},
    render: () => {},
    alert: m => { said.push(String(m)); },
    setTimeout: () => {},
  };
  ctx.window = { PuSiteStaff: {
    payrollCos: cos => cos,
    staffFor: site => (site === '시험상사' ? { coId: 'c1' } : null),
    coreName: s => String(s || ''),
    nameBySid: () => ({}),
  } };
  vm.createContext(ctx);
  vm.runInContext(src + '\nautoSync2026FromMail();', ctx);
  for (let i = 0; i < 10; i++) await tick();

  const bad = writes.filter(([, p]) => /payroll\/(emp|index)|\/payroll$|site_cards|site_co_link|payroll_locked/.test(p));
  assert.deepEqual(bad, [], '급여 칸에 쓰면 안 된다: ' + JSON.stringify(bad));
  assert.ok(writes.length >= 1 && writes.every(([, p]) => /mail_digest_2026$/.test(p)),
    '쓰는 곳은 메일 요약 칸뿐이어야 한다: ' + JSON.stringify(writes));
});

test('① 함수 본문에 지어낸 근로자 줄(r_auto_ 새 id)을 만드는 자리가 없다', () => {
  const src = cutFn(html, 'function autoSync2026FromMail(');
  assert.equal(src.indexOf("'r_auto_'"), -1, '자동 급여 줄 id 를 만드는 코드가 되살아났다');
  assert.equal(/성명\s*:\s*'[^']+'/.test(src), false, '함수 안에 근로자 이름이 박혀 있다');
});

test('② 로그인 뒤 저절로 부르지 않는다 — 부르는 자리는 단추뿐', () => {
  const def = cutFn(html, 'function autoSync2026FromMail(');
  const at = html.indexOf(def);
  const outside = html.slice(0, at) + html.slice(at + def.length);
  const calls = [];
  const re = /autoSync2026FromMail\s*\(/g;
  let m;
  while ((m = re.exec(outside))) {
    const lineStart = outside.lastIndexOf('\n', m.index) + 1;
    const before = outside.slice(lineStart, m.index);
    calls.push({ ok: /onclick="[^"]*$/.test(before), line: before.trim().slice(-80) });
  }
  assert.ok(calls.length >= 1, '단추가 하나도 없다 — 메일 요약을 모을 길이 사라졌다');
  const auto = calls.filter(c => !c.ok);
  assert.deepEqual(auto, [], '단추가 아닌 곳에서 부른다(저절로 도는 길): ' + JSON.stringify(auto));
});

function sigWorld() {
  const src = ['function isFakeAutoRec(', 'function recIssue(', 'function effSig('].map(h => cutFn(html, h)).join('\n');
  const ctx = { String, empsOf: () => null, recComplete: () => true };
  vm.createContext(ctx);
  vm.runInContext(src + '\nvar FAKE_AUTO_NOTE = "가짜";', ctx);
  return ctx;
}

test('③ 이미 들어간 가짜 줄은 막힘(red)이고, 진짜 줄은 그대로다', () => {
  const w = sigWorld();
  const fakeById = { id: 'r_auto_c1_2026_3', 월: '2026년 3월', 신호: 'green', 표시신호: 'green' };
  const fakeBySrc = { id: 'x1', 월: '2026년 4월', 신호: 'green', 출처: '푸른메일자동수집' };
  const real = { id: 'r_123', 월: '2026-03', 신호: 'green', 표시신호: 'green' };
  assert.equal(w.effSig(fakeById), 'red');
  assert.equal(w.effSig(fakeBySrc), 'red');
  assert.equal(w.effSig(real), 'green');
  assert.ok(w.recIssue(fakeById).length > 0, '가짜 줄에는 까닭이 보여야 한다');
  assert.equal(w.recIssue(real), '');
});

test('③ 목록 읽기(payRecs)가 가짜 줄을 걸러 — 급여·명세서·신고 추정 어디에도 섞이지 않는다', () => {
  const src = ['function isFakeAutoRec(', 'function payRecs('].map(h => cutFn(html, h)).join('\n');
  const ctx = { String };
  vm.createContext(ctx);
  vm.runInContext('var payIdx = null, payOld = null;\n' + src, ctx);
  ctx.payIdx = { '시험상사': [
    { id: 'r_auto_c1_2026_3', 월: '2026년 3월', 신호: 'green' },
    { id: 'x7', 월: '2026년 4월', 신호: 'green', 출처: '푸른메일자동수집' },
    { id: 'r_9', 월: '2026-02', 신호: 'green' },
  ] };
  assert.deepEqual(Array.from(ctx.payRecs('시험상사'), r => r.id), ['r_9'], '가짜 줄이 목록에 남았다');
  ctx.payIdx = null;
  ctx.payOld = { '옛상사': [{ id: 'r_auto_c2_2026_1', 월: '1월' }, { id: 'o1', 월: '2월' }] };
  assert.deepEqual(Array.from(ctx.payRecs('옛상사'), r => r.id), ['o1'], '옛 모양 목록에서도 걸러야 한다');
  assert.equal(ctx.payRecs('없는곳').length, 0);
});
