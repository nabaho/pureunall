'use strict';
/* 급여관리 — 옛 모양 파일이 새 모양 목록을 지우지 못하게 (2026-10-05 발견)
   실행: node --test tests/*.test.js

   ■ 무엇이 깨졌었나
   importPayroll() 은 `sites` 만 있고 `index` 가 없는 파일을 「옛 모양」으로 보고
   dbSet('payroll', raw) 로 payroll 칸을 **통째로** 갈아 끼웠다. 그래서 앱이
   payroll_all.json(새 모양, 54곳)으로 돌고 있을 때 누가 pilot_payroll.json(옛 모양,
   파일럿 10곳)을 올리면 payroll/index·payroll/emp 가 지워지고 10곳만 남았다.
   확정 표시를 옮기는 relockFor() 도 건너뛰었다.

   ■ 이 검사는 글자를 찾지 않는다 — importPayroll 을 vm 에서 **실제로 돌린다**.
   파일 고르기(document.createElement)·FileReader·Firebase 를 가짜로 세우고,
   서버에 무엇이 써졌는지를 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const html = fs.readFileSync(path.join(__dirname, '..', 'payroll-os.html'), 'utf8');
/* 2026-10-07: 올리기가 주민번호 섞임을 먼저 검사한다(rrnLeakCount) — 그 검사도 함께 잘라 온다 */
const FNS = ['function rrnValid(', 'function rrnLeakCount(', 'function relockFor(', 'function dbGet(', 'function dbSet(',
  'function payHas(', 'function importPayroll(', 'function screenPayroll('];
const SRC = FNS.map(h => cutFn(html, h)).join('\n');

/* 가짜 세상 하나 — 서버에 써진 것은 writes 에 쌓인다. */
function world(opts) {
  const writes = [];
  const said = { alerts: [], prompts: [], confirms: [] };
  const ctx = {
    console, JSON, Object, Array, Promise, Date, String,
    writes, said,
    fileText: JSON.stringify(opts.file),
    promptAnswer: opts.promptAnswer,
    alert: m => { said.alerts.push(String(m)); },
    confirm: m => { said.confirms.push(String(m)); return true; },
    prompt: m => { said.prompts.push(String(m)); return ctx.promptAnswer; },
    render: () => {},
    setSaveState: () => {},
    fbDb: { ref: p => ({
      set: v => { writes.push(['set', p, v]); return Promise.resolve(); },
      update: v => { writes.push(['update', p, v]); return Promise.resolve(); },
    }) },
    document: { createElement: () => ({
      click() { this.onchange({ target: { files: [{ name: 'x.json' }] } }); },
    }) },
    FileReader: function () {
      this.readAsText = () => { this.result = ctx.fileText; this.onload(); };
    },
  };
  vm.createContext(ctx);
  /* ⚠ vm 최상위 const/let 은 ctx 에 안 붙는다 — 밖에서 읽을 것은 var 로. */
  vm.runInContext(
    "var ROOT='payroll_os'; var App={};" +
    'var payIdx=' + JSON.stringify(opts.payIdx || null) + ';' +
    'var payOld=null, empBox={}, allEmpsState="", savePending=0, saveFailed=false;' +
    'var cache={payroll_locked:' + JSON.stringify(opts.locked || {}) + '};\n' + SRC, ctx);
  return ctx;
}
/* vm 안에서 만든 물건은 원형(prototype)이 달라 deepEqual 이 어긋난다 — 평범한 값으로 바꿔 비교한다. */
const plain = x => JSON.parse(JSON.stringify(x));
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };

/* 서버의 새 모양 목록(54곳 중 일부만 흉내) — 이름은 가짜다. */
const LIVE_INDEX = {
  '가나상회 본점': [{ 월: '3월', id: 'r1' }],
  '가나상회 2호점': [{ 월: '3월', id: 'r2' }],
  '다라식품': [{ 월: '3월', id: 'r3' }],
};
const OLD_FILE = { sites: { '가나상회': [{ 월: '3월', 직원: [] }] } };
const NEW_FILE = { index: LIVE_INDEX, emp: { r1: [], r2: [], r3: [] } };

const touchedPayroll = w => w.writes.filter(([, p]) => /^payroll_os\/payroll(\/|$)/.test(p));

test('★ 새 모양 목록이 있을 때 옛 모양 파일을 올리면 서버에 아무것도 안 쓴다', async () => {
  const w = world({ payIdx: LIVE_INDEX, file: OLD_FILE, promptAnswer: null });
  vm.runInContext('importPayroll()', w);
  await settle();
  assert.deepEqual(w.writes, [], '★ 옛 모양이 payroll 칸을 갈아 끼우면 목록·직원 표가 지워집니다');
  assert.deepEqual(Object.keys(vm.runInContext('payIdx', w)), Object.keys(LIVE_INDEX),
    '화면의 목록도 그대로여야 합니다');
  assert.equal(w.said.prompts.length, 1, '막기 전에 왜 막는지 물어야 합니다');
  assert.match(w.said.prompts[0], /payroll_all\.json/, '무엇을 올려야 하는지 알려 줘야 합니다');
  assert.match(w.said.prompts[0], /3곳/, '지금 서버에 몇 곳이 있는지 보여 줘야 합니다');
  assert.ok(w.said.alerts.some(a => /payroll_all\.json/.test(a)), '막은 뒤에도 올릴 파일을 알려 줘야 합니다');
});

test('★ 「되돌리기」가 아닌 대답(확인·예·빈칸)으로는 지나가지 못한다', async () => {
  for (const ans of ['', '확인', '예', 'yes', '되돌리기 아님']) {
    const w = world({ payIdx: LIVE_INDEX, file: OLD_FILE, promptAnswer: ans });
    vm.runInContext('importPayroll()', w);
    await settle();
    assert.deepEqual(touchedPayroll(w), [], '「' + ans + '」 로 옛 모양이 들어갔습니다');
  }
});

test('되돌리기를 직접 치면 옛 모양을 받고, 확정 표시는 relockFor 로 옮긴다', async () => {
  const w = world({ payIdx: LIVE_INDEX, file: OLD_FILE, promptAnswer: ' 되돌리기 ',
    locked: { '가나상회 본점|3월': 111 } });
  vm.runInContext('importPayroll()', w);
  await settle();
  const pay = w.writes.find(([, p]) => p === 'payroll_os/payroll');
  assert.ok(pay, '되돌릴 길까지 막으면 안 됩니다');
  assert.deepEqual(plain(pay[2]), OLD_FILE);
  const lk = w.writes.find(([, p]) => p === 'payroll_os/payroll_locked');
  assert.ok(lk, '★ 되돌릴 때도 확정 표시를 옮겨야 합니다 — 안 그러면 확정이 조용히 풀립니다');
  assert.deepEqual(plain(lk[2]), { '가나상회|3월': 111 });
  /* 화면도 옛 모양을 보게 바뀌어야 한다 — 안 그러면 지워진 목록을 계속 보여 준다. */
  assert.equal(vm.runInContext('payIdx', w), null);
  assert.deepEqual(plain(vm.runInContext('payOld', w)), OLD_FILE.sites);
});

test('서버에 새 모양 목록이 없으면 옛 모양은 묻지 않고 받는다', async () => {
  const w = world({ payIdx: null, file: OLD_FILE });
  vm.runInContext('importPayroll()', w);
  await settle();
  assert.equal(w.said.prompts.length, 0);
  assert.ok(w.writes.some(([, p]) => p === 'payroll_os/payroll'), '처음 올릴 때는 막을 까닭이 없습니다');
});

test('★ payroll_all.json(새 모양)은 막지 않는다 — 목록을 맨 마지막에 쓴다', async () => {
  const w = world({ payIdx: LIVE_INDEX, file: NEW_FILE });
  vm.runInContext('importPayroll()', w);
  await settle();
  assert.equal(w.said.prompts.length, 0, '맞는 파일까지 막으면 안 됩니다');
  assert.equal(touchedPayroll(w).some(([, p]) => p === 'payroll_os/payroll'), false,
    '★ 새 모양은 payroll 칸을 통째로 쓰면 안 됩니다');
  const idx = w.writes.findIndex(([, p]) => p === 'payroll_os/payroll/index');
  assert.ok(idx >= 0, '목록을 안 썼습니다');
  assert.equal(idx, w.writes.length - 1, '★ 목록은 맨 마지막이어야 합니다');
});

test('빈 화면 안내는 payroll_all.json 을 가리킨다 — pilot_payroll.json 이 아니다', () => {
  const w = world({ payIdx: null, file: {} });
  const h = vm.runInContext('screenPayroll()', w);
  assert.match(h, /payroll_all\.json/);
  assert.equal(/pilot_payroll/.test(h), false, '★ 옛 파일을 올리라고 하면 목록이 지워집니다');
});
