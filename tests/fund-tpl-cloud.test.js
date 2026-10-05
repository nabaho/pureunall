'use strict';
/* 기금관리(fund.html) — 원본 서식(엑셀·HWP)이 «그 브라우저에만» 있지 않게 (대표 지시 2026-10-05)
   「다른모든 프로그램에서도 데이터가 분리되지 않게 처리해라」

   ■ 무엇이었나
     [원본 등록]한 엑셀 원본(setup·subsidy·contribx)과 원본 HWP(hwp:*)가 IndexedDB(fundErpTpl) 에만 있었다.
     다른 PC·다른 브라우저에서 열면 「원본 없음」 — 같은 법인 자료가 기기마다 갈라졌다.
   ■ 지금
     등록하면 클라우드 fund_erp/tpl_orig/{열쇠} 에도 올리고(있는지는 tpl_orig_index 만 본다),
     이 기기에 없거나 다른 판이면 클라우드에서 받아 온다. 이 기기에만 있던 옛 원본은 켤 때 저절로 올린다.

   ⚠ 진짜 함수를 vm 에서 «두 기기»로 돌린다(같은 가짜 클라우드, 서로 다른 IndexedDB).

   node --test tests/fund-tpl-cloud.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const src = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const START = "var TPL_ORIG='tpl_orig'";
const END = "window.addEventListener('online',function(){ setTimeout(tplSyncUp,3000); });";
function tplBlock() {
  const i = src.indexOf(START), j = src.indexOf(END, i);
  assert.ok(i > 0 && j > i, '원본 서식 클라우드 묶음을 못 찾았습니다 — 이름이 바뀌었나요?');
  return src.slice(i, j + END.length);
}

/* 가짜 클라우드 — 경로 문자열 그대로 담는다 */
function fakeCloud() {
  const data = {};
  const subs = [];
  const opt = { failRead: false, failWrite: false };
  function under(p) { const o = {}; Object.keys(data).forEach((k) => { if (k.startsWith(p + '/')) o[k.slice(p.length + 1)] = data[k]; }); return o; }
  function ref(p) {
    return {
      set: (v) => { if (opt.failWrite) return Promise.reject(new Error('offline')); data[p] = JSON.parse(JSON.stringify(v)); subs.forEach((s) => p.startsWith(s.p + '/') && s.cb({ val: () => under(s.p) })); return Promise.resolve(); },
      remove: () => { if (opt.failWrite) return Promise.reject(new Error('offline')); delete data[p]; subs.forEach((s) => p.startsWith(s.p + '/') && s.cb({ val: () => under(s.p) })); return Promise.resolve(); },
      once: () => Promise.resolve({ val: () => (data[p] === undefined ? null : JSON.parse(JSON.stringify(data[p]))) }),
      on: (ev, cb, err) => {
        if (opt.failRead) { err(new Error('permission_denied')); return; }
        subs.push({ p, cb });
        const o = under(p);
        cb({ val: () => (Object.keys(o).length ? o : null) });
      }
    };
  }
  return { ref, data, opt };
}

function device(cloud) {
  const idb = new Map();
  const ls = new Map();
  const toasts = [];
  const ctx = {
    console: { warn() {}, info() {}, log() {} },
    Promise, JSON, Object, Array, String, Uint8Array, Date, Math,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    localStorage: { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) },
    window: { addEventListener() {} }, setTimeout() {},
    idbPut: async (k, v) => { idb.set(k, v); },
    idbGet: async (k) => (idb.has(k) ? idb.get(k) : null),
    idbDel: async (k) => { idb.delete(k); },
    fbDb: cloud, firebase: { auth: () => ({ currentUser: { uid: 'u' } }) },
    NS: 'fund_erp', S: {}, DOC_ALL: [['inka'], ['charter']],
    ymd: () => '2026-10-05', toast: (m, k) => toasts.push([m, k]), _formsRerender() {}
  };
  vm.createContext(ctx);
  const api = vm.runInContext([
    cutFn(src, 'function _bytesToB64('),
    cutFn(src, 'function _b64ToBytes('),
    tplBlock(),
    ';({tplPut,tplGet,tplHas,tplDel,tplSyncUp})'
  ].join('\n'), ctx);
  return { ctx, api, idb, ls, toasts };
}
const buf = (...b) => new Uint8Array(b).buffer;
const bytes = (ab) => Array.from(new Uint8Array(ab || new ArrayBuffer(0)));

test('★★★ 한 브라우저에서 등록한 원본이 다른 브라우저에서도 열린다 — 「원본 없음」이 안 뜬다', async () => {
  const cloud = fakeCloud();
  const A = device(cloud), B = device(cloud);
  await A.api.tplPut('setup', buf(1, 2, 3), '설립서식.xlsx');
  await A.api.tplPut('hwp:inka', buf(9, 8), '인가신청서.hwp');
  await new Promise((r) => setImmediate(r));
  assert.ok(cloud.data['fund_erp/tpl_orig/setup'], '★ 엑셀 원본이 클라우드에 안 올라갔다');
  assert.ok(cloud.data['fund_erp/tpl_orig/hwp__inka'], '★ 원본 HWP 가 클라우드에 안 올라갔다');
  assert.ok(!cloud.data['fund_erp/tpl_orig_index/setup'].b64, '색인에는 파일을 넣지 않는다(30개를 다 받지 않게)');
  assert.equal(await B.api.tplHas('setup'), true, '★ 다른 브라우저에서 「원본 없음」');
  assert.deepEqual(bytes(await B.api.tplGet('setup')), [1, 2, 3]);
  assert.deepEqual(bytes(await B.api.tplGet('hwp:inka')), [9, 8]);
  assert.ok(B.idb.has('setup'), '받아 온 것은 이 기기에도 넣어 둔다(다음에는 빠르게)');
});

test('★★ 다른 기기가 바꾸면 이 기기의 옛 판 대신 새 판을 쓴다', async () => {
  const cloud = fakeCloud();
  const A = device(cloud), B = device(cloud);
  await A.api.tplPut('subsidy', buf(1), 'a.xlsx'); await new Promise((r) => setImmediate(r));
  assert.deepEqual(bytes(await B.api.tplGet('subsidy')), [1]);
  await new Promise((r) => setTimeout(r, 3));
  await A.api.tplPut('subsidy', buf(2), 'b.xlsx'); await new Promise((r) => setImmediate(r));
  assert.deepEqual(bytes(await B.api.tplGet('subsidy')), [2], '★ B 가 옛 원본으로 서식을 채운다');
});

test('★★★ 이 기기에만 있던 옛 원본은 켤 때 «저절로» 클라우드로 — 먼저 옮긴 기기 것은 덮지 않는다', async () => {
  const cloud = fakeCloud();
  const A = device(cloud), B = device(cloud);
  A.idb.set('contribx', buf(5)); A.idb.set('hwp:charter', buf(6));     // 고침 전부터 이 PC 에만 있던 것
  B.idb.set('contribx', buf(7));
  assert.equal(await A.api.tplSyncUp(), 2);
  assert.ok(cloud.data['fund_erp/tpl_orig_index/hwp__charter']);
  assert.equal(await B.api.tplSyncUp(), 0, '★ 뒤에 옮긴 기기가 먼저 옮긴 원본을 덮었다');
  assert.deepEqual(bytes(await B.api.tplGet('contribx')), [5], '기준은 클라우드');
  assert.deepEqual(bytes(B.idb.get('prev:contribx')), [7], '★ 이 기기 옛 원본을 말없이 버렸다 — prev: 로 남겨야 한다');
  assert.ok(A.toasts.some(([m]) => /올렸습니다/.test(m)), '옮긴 것은 알린다');
});

test('★★ 연결 전에 등록한 것은 «다시 올릴 것»으로 남았다가 저절로 올라간다', async () => {
  const cloud = fakeCloud();
  const A = device(cloud);
  cloud.opt.failWrite = true;
  await A.api.tplPut('setup', buf(4), 's.xlsx'); await new Promise((r) => setImmediate(r));
  assert.ok(A.toasts.some(([m, k]) => k === 'warn' && /자동/.test(m)), '못 올렸으면 알리고, 자동으로 다시 한다고 말한다');
  assert.equal(JSON.parse(A.ls.get('fund_tpl_sync')).setup, 'dirty');
  cloud.opt.failWrite = false;
  assert.equal(await A.api.tplSyncUp(), 1);
  assert.ok(cloud.data['fund_erp/tpl_orig/setup']);
});

test('★★ 다른 곳에서 지운 원본을 되살리지 않는다 — 이 기기 것은 지우지 않고 옆(prev:)에 둔다', async () => {
  const cloud = fakeCloud();
  const A = device(cloud), B = device(cloud);
  await A.api.tplPut('setup', buf(1), 'a'); await new Promise((r) => setImmediate(r));
  await B.api.tplGet('setup');
  await A.api.tplDel('setup');
  assert.equal(cloud.data['fund_erp/tpl_orig_index/setup'], undefined, '지우기도 클라우드까지');
  assert.equal(await B.api.tplSyncUp(), 0, '★ B 가 지워진 원본을 다시 올렸다');
  assert.equal(await B.api.tplGet('setup'), null);
  assert.deepEqual(bytes(B.idb.get('prev:setup')), [1]);
});

test('★★ 클라우드 색인을 못 읽으면 아무것도 올리지 않는다 — 모르는 채로 올리면 남의 판을 덮는다', async () => {
  const cloud = fakeCloud();
  cloud.opt.failRead = true;
  const A = device(cloud);
  A.idb.set('setup', buf(1));
  assert.equal(await A.api.tplSyncUp(), 0);
  assert.equal(Object.keys(cloud.data).length, 0);
  assert.deepEqual(bytes(await A.api.tplGet('setup')), [1], '클라우드를 못 읽어도 이 기기 것은 쓴다');
});

test('★★ 끊긴 채 켜도 서식 화면이 멈추지 않는다 — 색인이 안 오면 이 기기 것으로 답한다', async () => {
  const cloud = fakeCloud();
  cloud.ref = (p) => Object.assign(fakeCloud().ref(p), { on() {} });   // 구독이 영영 안 온다(오프라인)
  const A = device(cloud);
  A.ctx.setTimeout = (f) => f();                                        // 기다리는 시간을 건너뛴다
  A.idb.set('setup', buf(3));
  assert.equal(await A.api.tplHas('setup'), true);
  assert.equal(await A.api.tplHas('subsidy'), false);
  assert.deepEqual(bytes(await A.api.tplGet('setup')), [3]);
  assert.equal(await A.api.tplSyncUp(), 0, '색인을 모르면 올리지 않는다');
});

test('★★★ 원본을 읽고 쓰는 자리는 «모두» 클라우드 길(tpl*)을 탄다 — IndexedDB 를 바로 부르면 다시 갈라진다', () => {
  const block = tplBlock();
  const rest = src.replace(block, '');
  const defs = /function idb(Open|Put|Get|Del)\(/g;
  const raw = rest.replace(defs, '').match(/\bidb(Put|Get|Del)\(/g) || [];
  assert.deepEqual(raw, [], '★ 묶음 밖에서 idbGet/idbPut/idbDel 을 바로 부른다 — 그 원본은 이 브라우저에만 남는다');
  ['pickTpl(', 'clearTpl(', 'pickHwp(', 'clearHwp(', 'pickHwpBulk('].forEach((fn) =>
    assert.match(cutFn(src, 'function ' + fn), /tpl(Put|Del)\(/, fn + ' 가 클라우드에 안 올린다'));
  assert.match(cutFn(src, 'function openHwpEditor('), /tplGet\(/);
  assert.match(cutFn(src, 'function _fillWbBuffer('), /tplGet\(/);
  assert.match(cutFn(src, 'function start('), /tplSyncUp/, '★ 켤 때 옛 원본 옮기기가 안 돈다');
});
