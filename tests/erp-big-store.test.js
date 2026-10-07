'use strict';
/* 이알피의 큰 사본 여섯 칸은 IndexedDB 에 둔다 (2026-10-07 — localStorage 한도 5MB 가 차서
   경력관리가 목록을 못 적었다. 이알피 혼자 계약서 양식 1.3MB·급여 0.36MB … 약 2.4MB 를 먹고 있었다)

   지키는 것
   ① 켜진 뒤 큰 칸은 localStorage 가 꽉 차도 적힌다 — 다른 칸은 예전 그대로(던지고 메모리에 쥔다)
   ② 켤 때 옛 자리 것을 옮기고, 어느 자리에도 없는 칸은 «받은 시각»을 지운다
      (시각만 남으면 서버를 다시 안 받아 빈 표가 최신인 줄 안다)
   ③ 백업(NAS·내려받기)이 새 자리 것도 담는다 — localStorage 만 훑으면 급여·장부가 백업에서 빠진다
   ④ 앱 그리기·첫 동기화는 창고 켜짐을 기다린다
   ⑤ 다른 앱이 localStorage 로 «빌려 읽는» 칸은 큰 칸에 넣지 않는다 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Big = require('../js/pu-big-store.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
function body(head) {
  const at = SRC.indexOf(head);
  assert.ok(at >= 0, head + ' 이 없습니다');
  let d = 0;
  for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
    if (SRC[i] === '{') d++; else if (SRC[i] === '}') { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error(head);
}
function stmt(re) { const m = SRC.match(re); assert.ok(m, re + ' 을 못 찾았습니다'); return m[0]; }
const BIG = JSON.parse(stmt(/var ERP_BIG_KEYS = (\[[^\]]*\]);/).replace(/^var ERP_BIG_KEYS = /, '').replace(/;$/, '').replace(/'/g, '"'));

function lsFake(cap) {
  const m = {};
  const size = () => Object.keys(m).reduce((a, k) => a + k.length + m[k].length, 0);
  return {
    _m: m,
    get length() { return Object.keys(m).length; },
    key: (i) => Object.keys(m)[i] || null,
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => {
      const old = k in m ? m[k] : null; m[k] = String(v);
      if (cap && size() > cap) { if (old === null) delete m[k]; else m[k] = old; const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    },
    removeItem: (k) => { delete m[k]; },
  };
}
function storeFake() {
  const m = new Map();
  return { _m: m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, del: async (k) => { m.delete(k); } };
}
function box(cap, st) {
  const ls = lsFake(cap), toasts = [];
  const store = st || storeFake();
  const ctx = {
    localStorage: ls, sessionStorage: lsFake(0), Object, Date, Math, JSON, Promise, console: { info() {}, warn() {}, log() {} },
    showToast: (t) => toasts.push(t),
    PuBigStore: { mirror: (o) => Big.mirror(Object.assign({}, o, { open: async () => store })) },
  };
  vm.createContext(ctx);
  vm.runInContext(['var _dbStoreFailed = {}; var _dbCache = {};',
    stmt(/var KEY = 'pureun_v6_';/),
    stmt(/var ERP_BIG_KEYS = \[[^\]]*\];/),
    stmt(/var _erpBig = \(typeof PuBigStore[\s\S]*?\}\) : null;/),
    stmt(/var _erpBigBooting = null;/),
    body('function _erpBigBoot('), body('function erpLocalKeys('), body('function erpLocalRaw('),
    stmt(/var _erpMemStore = \{\};/), body('function _erpMemFlush('), stmt(/var _erpQuotaToldAt = 0;/),
    body('function erpQuotaNotice('), body('function _erpStoreGet('), body('function _erpStoreSet('), body('function _erpStoreRemove('),
  ].join('\n'), ctx);
  return { ctx, ls, store, toasts };
}

test('① 켜진 뒤 큰 칸은 localStorage 가 꽉 차도 적힌다 · 다른 칸은 예전 그대로', async () => {
  const { ctx, ls } = box(200);
  await ctx._erpBigBoot();
  assert.equal(vm.runInContext('_erpBig.state', ctx), 'on');
  const big = 'X'.repeat(5000);
  ctx._erpStoreSet('contract_forms', big);                     // 한도 200자를 크게 넘는다
  assert.equal(ctx._erpStoreGet('contract_forms'), big);
  assert.equal(ls._m.pureun_v6_contract_forms, undefined, '큰 칸이 localStorage 에 들어가면 이번 고침이 헛것입니다');
  assert.throws(() => ctx._erpStoreSet('contracts', 'Y'.repeat(500)), /full/,
    '다른 칸의 공간 부족 처리(메모리에 쥐고 서버로)는 예전 그대로여야 합니다');
  assert.equal(ctx._erpStoreGet('contracts'), 'Y'.repeat(500));
  ctx._erpStoreRemove('contract_forms');
  assert.equal(ctx._erpStoreGet('contract_forms'), null);
});

test('② 켤 때 옛 자리 것을 옮기고, 아무 데도 없는 칸은 받은 시각을 지운다', async () => {
  const st = storeFake();
  st._m.set('pureun_v6_cms_ledger', '[2]');
  const { ctx, ls } = box(0, st);
  ls._m.pureun_v6_payroll_monthly = '[1]';
  ls._m.pureun_v6__meta_payroll_monthly = '111';
  ls._m.pureun_v6__meta_cms_ledger = '222';
  ls._m.pureun_v6__meta_trash_fin = '333';          // 값은 어디에도 없고 시각만 남았다
  ls._m.pureun_v6__meta_contracts = '444';          // 큰 칸이 아니다 — 건드리지 않는다
  vm.runInContext('_dbCache.payroll_monthly = []; _dbCache.contracts = [9];', ctx);
  await ctx._erpBigBoot();
  assert.equal(ctx._erpStoreGet('payroll_monthly'), '[1]');
  assert.equal(ls._m.pureun_v6_payroll_monthly, undefined, '옮긴 뒤 옛 자리를 비워야 자리가 생깁니다');
  assert.equal(await st.get('pureun_v6_payroll_monthly'), '[1]');
  assert.equal(ctx._erpStoreGet('cms_ledger'), '[2]');
  assert.equal(ls._m.pureun_v6__meta_trash_fin, undefined,
    '★★ 값 없이 시각만 남으면 서버를 다시 안 받아 «빈 표가 최신»이 됩니다');
  assert.equal(ls._m.pureun_v6__meta_payroll_monthly, '111');
  assert.equal(ls._m.pureun_v6__meta_cms_ledger, '222');
  assert.equal(ls._m.pureun_v6__meta_contracts, '444');
  assert.equal(vm.runInContext("'payroll_monthly' in _dbCache", ctx), false, '켜지기 전에 읽어 둔 «빈 것»을 버려야 합니다');
  assert.equal(vm.runInContext("'contracts' in _dbCache", ctx), true);
});

test('② IndexedDB 를 못 쓰면 예전 그대로 · 비어 있는 큰 칸은 받은 시각을 지운다', async () => {
  const ls = lsFake(0);
  const ctx = { localStorage: ls, sessionStorage: lsFake(0), Object, Date, Math, JSON, Promise, console: { info() {}, warn() {} }, showToast() {},
    PuBigStore: { mirror: (o) => Big.mirror(Object.assign({}, o, { open: async () => null })) } };
  vm.createContext(ctx);
  vm.runInContext(['var _dbStoreFailed = {}; var _dbCache = {};', stmt(/var KEY = 'pureun_v6_';/), stmt(/var ERP_BIG_KEYS = \[[^\]]*\];/),
    stmt(/var _erpBig = \(typeof PuBigStore[\s\S]*?\}\) : null;/), stmt(/var _erpBigBooting = null;/), body('function _erpBigBoot('),
    stmt(/var _erpMemStore = \{\};/), body('function _erpStoreGet('), body('function _erpStoreSet(')].join('\n'), ctx);
  ls._m.pureun_v6_ledger_batches = '[1]';
  ls._m.pureun_v6__meta_ledger_batches = '5';
  ls._m.pureun_v6__meta_trash_fin = '6';
  await ctx._erpBigBoot();
  assert.equal(vm.runInContext('_erpBig.state', ctx), 'off');
  assert.equal(ctx._erpStoreGet('ledger_batches'), '[1]');
  assert.equal(ls._m.pureun_v6__meta_ledger_batches, '5');
  assert.equal(ls._m.pureun_v6__meta_trash_fin, undefined, '새 자리에만 있던 것을 못 읽으면 서버에서 다시 받아야 합니다');
});

test('③ 백업이 새 자리 것도 담는다', async () => {
  const { ctx, ls } = box(0);
  ls._m.pureun_v6_companies = '[1]';
  await ctx._erpBigBoot();
  ctx._erpStoreSet('payroll_monthly', '[7]');
  const keys = vm.runInContext('erpLocalKeys()', ctx);
  assert.ok(keys.includes('pureun_v6_companies'));
  assert.ok(keys.includes('pureun_v6_payroll_monthly'), '★★ 급여가 NAS 백업에서 빠집니다');
  assert.equal(ctx.erpLocalRaw('pureun_v6_payroll_monthly'), '[7]');
  assert.ok(!keys.includes('pureun_v6_trash_fin'), '없는 칸까지 «빈 값»으로 담지는 않습니다');
});

test('③ localStorage 를 훑어 백업 꾸러미에 담는 자리는 모두 erpLocalKeys 로 훑는다', () => {
  const lines = SRC.split('\n');
  const 옛길 = [];
  lines.forEach(function (ln, i) {
    if (!/localStorage\.key\(/.test(ln)) return;
    const 몸통 = lines.slice(i, i + 8).join('\n');
    if (/\bdata\[k\]\s*=/.test(몸통)) 옛길.push(i + 1);
  });
  assert.deepEqual(옛길, [], '이 자리들은 localStorage 만 훑어 큰 사본(급여·장부·계약서 양식)을 백업에서 빠뜨립니다 — erpLocalKeys()·erpLocalRaw() 로');
  const 새길 = (SRC.match(/var _lk = erpLocalKeys\(\);/g) || []).length;
  assert.ok(새길 >= 4, '백업 자리(NAS·NAS 자동·내려받기·이사 전)를 ' + 새길 + '곳만 찾았습니다');
});

test('④ 앱 그리기와 첫 동기화는 창고 켜짐을 기다린다', () => {
  const at = SRC.indexOf('.render(h(App))');
  assert.ok(at > 0);
  assert.equal(SRC.indexOf('.render(h(App))', at + 1), -1, '그리는 자리는 한 곳이어야 합니다');
  const 둘레 = SRC.slice(at - 600, at + 600);
  assert.match(둘레, /_erpBigBoot\(\)/, '창고를 다 읽기 전에 그리면 급여·장부가 빈 표로 한 번 보입니다');
  assert.match(둘레, /\.then\(\s*그리기\s*,\s*그리기\s*\)/, '창고가 실패해도 그려야 합니다(안 그리면 앱이 영영 안 뜹니다)');
  const fn = body('function fbInitialSync(');
  assert.match(fn, /_erpBig\.state === 'wait'[\s\S]{0,120}_erpBigBoot\(\)\.then/, '켜지기 전에 받으면 «받은 시각»과 «이 PC 값»이 어긋납니다');
  assert.ok(SRC.indexOf('js/pu-big-store.js') > 0 && SRC.indexOf('js/pu-big-store.js') < SRC.indexOf('function _erpStoreGet('),
    'pu-big-store.js 를 이알피 본문보다 먼저 실어야 합니다');
  assert.match(SRC, /<script src="js\/pu-big-store\.js\?v=\d+"><\/script>/, '캐시 번호(?v=)를 붙여야 고친 판이 바로 갑니다');
});

test('⑤ 다른 앱이 localStorage 로 빌려 읽는 칸은 큰 칸이 아니다', () => {
  assert.ok(BIG.length >= 1);
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && f !== 'pu-erp.html')
    .map((f) => path.join(ROOT, f))
    .concat(fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, 'js', f)));
  const bad = [];
  files.forEach(function (f) {
    const t = fs.readFileSync(f, 'utf8');
    BIG.forEach(function (k) {
      if (t.indexOf('pureun_v6_' + k) >= 0) bad.push(path.basename(f) + ' → pureun_v6_' + k);
      /* 'pureun_v6_'+열쇠 로 읽는 앱이 그 열쇠 이름을 들고 있으면 빌려 읽는 것이다 */
      const 빌려읽기 = /localStorage\.getItem\(\s*(?:'pureun_v6_'|"pureun_v6_"|ERP_LS_PREFIX)\s*\+/.test(t);
      if (빌려읽기 && new RegExp("['\"]" + k + "['\"]").test(t)) bad.push(path.basename(f) + ' → ' + k);
    });
  });
  assert.deepEqual(bad, [], '이 앱들이 localStorage 에서 읽는데 그 칸이 IndexedDB 로 갔습니다 — ERP_BIG_KEYS 에서 빼거나 그 앱을 고치세요');
});
