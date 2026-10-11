'use strict';
/* 이알피는 계약서 양식을 «실시간»으로 받지 않는다 — 「📄 계약서 출력」 창을 열 때만 (2026-10-11)

   ■ 무엇이 있었나
     대표 「비용이 너무 많이 증가」. 문서관리에서 양식 한 장을 저장할 때마다 열려 있는 이알피 창 7~8개가
     양식 목록 통째(1.8~3.4MB, 첨부 원본 base64)를 다시 받았다 — 88초에 29장 저장 → 211MB.
     이알피는 양식을 출력 창 한 곳에서만 쓴다.
   ■ 규칙
     ⓐ 부팅 키 명단(서버 명단·굳은 명단 둘 다)에서 contract_forms 를 뺀다.
     ⓑ 열 때 받기(erpFreshForms)는 판(u)을 먼저 보고 같으면 안 받는다 · 다르면 한 번 받아 얹는다 · 구독(on)은 안 한다.
     ⓒ 출력 창 껍데기는 받기 «전에» getContractForms 를 부르지 않는다(빈 사본이면 기본 양식으로 서버를 덮는다).
     ⓓ 서버 백업은 받기를 기다린다 · 전체 올리기는 양식을 빼고 올린다 · 다른 창 따라 받기도 안 한다.
   가짜 자료만 쓴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');
const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const src = stripComments(ERP);

function coldOnceList() {
  const m = src.match(/var FB_COLD_ONCE_KEYS\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'FB_COLD_ONCE_KEYS 가 없습니다');
  return (m[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
}

test('ⓐ 계약서 양식은 «열 때만» 받는 키다', () => {
  assert.ok(coldOnceList().includes('contract_forms'));
});

test('ⓐ 부팅 키 명단 두 곳 모두 차가운 키를 뺀다', () => {
  const plan = cutFn(src, 'function _fbFallbackPlan(');
  assert.match(plan, /_fbIsColdKey\(k\)/, '굳은 명단(되돌아갈 길)에서 빼지 않습니다');
  const isCold = cutFn(src, 'function _fbIsColdKey(');
  assert.match(isCold, /FB_COLD_ONCE_KEYS\.indexOf\(k\)/);
  assert.match(isCold, /FB_COLD_KEYS\.indexOf\(k\)/, '로그류 차가운 키도 계속 빠져야 한다');
  const shallowFilter = src.match(/Object\.keys\(shallow\)\.filter\(fbShouldSync\);[\s\S]{0,200}/);
  assert.ok(shallowFilter && /_fbIsColdKey\(k\)/.test(shallowFilter[0]), '서버 명단에서 빼지 않습니다');
});

/* erpFreshForms 를 가짜 DB 로 실제로 돌린다 */
function runFresh(opt) {
  const reads = [];
  const applied = [];
  const ls = Object.assign({}, opt.ls || {});
  const server = opt.server;
  const box = {
    window: {}, FB_COLD_ONCE_KEYS: ['contract_forms'], KEY: 'pureun_v6_', Promise, Number, JSON,
    _fbKeyLive: opt.live || {}, _fbBytesIn: 0,
    fbShouldSync: () => true,
    _erpStoreGet: (k) => (opt.store ? opt.store[k] : null),
    _fbApplyRecord: (k, v, o) => { applied.push({ k, u: v.u, force: !!(o && o.force) }); return true; },
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null) },
    fbDb: {
      ref(p) {
        return {
          once() {
            reads.push(p);
            let v = null;
            if (p === 'data/contract_forms/u') v = server ? server.u : null;
            else if (p === 'data/contract_forms') v = server ? JSON.parse(JSON.stringify(server)) : null;
            return Promise.resolve({ val: () => v });
          },
          on() { throw new Error('구독(on)을 하면 안 된다'); }
        };
      }
    }
  };
  box.window._fbPerKeyMode = opt.perKey !== false;
  if (opt.noDb) box.fbDb = null;
  vm.createContext(box);
  vm.runInContext(cutFn(src, 'window.erpFreshForms = function('), box);
  return box.window.erpFreshForms().then((n) => ({ n, reads, applied }));
}
const srv = (u) => ({ u, v: [{ id: 'f1', name: '가나상사 위임계약서' }] });

test('ⓑ 이 PC 사본과 판이 같으면 13바이트(u)만 읽는다', async () => {
  const r = await runFresh({ server: srv(500), ls: { pureun_v6__meta_contract_forms: '500' }, store: { contract_forms: '[{}]' } });
  assert.deepEqual(r.reads, ['data/contract_forms/u']);
  assert.equal(r.applied.length, 0);
});

test('ⓑ 판이 다르면 한 번 받아 얹는다(force) — 구독은 안 한다', async () => {
  const r = await runFresh({ server: srv(900), ls: { pureun_v6__meta_contract_forms: '500' }, store: { contract_forms: '[{}]' } });
  assert.deepEqual(r.reads, ['data/contract_forms/u', 'data/contract_forms']);
  assert.deepEqual(r.applied, [{ k: 'contract_forms', u: 900, force: true }]);
  assert.equal(r.n, 1);
});

test('ⓑ 이 PC 에 사본이 아예 없으면 판이 같아도 받는다', async () => {
  const r = await runFresh({ server: srv(500), ls: { pureun_v6__meta_contract_forms: '500' }, store: {} });
  assert.equal(r.applied.length, 1);
});

test('ⓑ 통째 모드·이미 실시간인 키·DB 없음이면 아무것도 안 한다', async () => {
  assert.deepEqual((await runFresh({ server: srv(1), perKey: false })).reads, []);
  assert.deepEqual((await runFresh({ server: srv(1), live: { contract_forms: true } })).reads, []);
  assert.equal((await runFresh({ server: srv(1), noDb: true })).n, 0);
});

test('ⓑ 열 때 받기는 구독 함수(erpEnsureKeys·_fbLive·on)를 쓰지 않는다', () => {
  const f = cutFn(src, 'window.erpFreshForms = function(');
  assert.ok(!/\.on\(|_fbLive\(|erpEnsureKeys\(/.test(f));
  assert.ok(!/erpEnsureKeys\(\s*FB_COLD_ONCE_KEYS/.test(src), '열 때만 받는 키를 구독으로 받으면 곱셈이 되살아난다');
});

test('ⓒ 출력 창 껍데기는 받기 전에 getContractForms 를 부르지 않는다 — 본문이 부른다', () => {
  const shell = cutFn(src, 'function ContractFormPrintModal(');
  assert.ok(!/getContractForms\(/.test(shell), '껍데기가 양식을 먼저 읽으면 빈 사본으로 서버를 덮을 수 있다');
  assert.match(shell, /erpFreshForms\(\)/);
  assert.match(shell, /ContractFormPrintBody/);
  const body = cutFn(src, 'function ContractFormPrintBody(');
  assert.match(body, /getContractForms\(\)/);
  /* 화면들은 여전히 껍데기를 부른다(본문을 바로 부르면 받기를 건너뛴다) */
  const direct = (src.match(/h\(ContractFormPrintBody,/g) || []).length;
  assert.equal(direct, 1, '본문은 껍데기 안 한 곳에서만 그린다');
  assert.ok((src.match(/h\(ContractFormPrintModal,/g) || []).length >= 1);
});

test('ⓓ 서버 백업은 열 때 받기를 기다리고, 전체 올리기·다른 창 따라 받기는 양식을 뺀다', () => {
  const bk = cutFn(src, 'function serverBackupDaily(');
  assert.match(bk, /erpFreshForms\(\)/);
  const up = cutFn(src, 'function fbUploadAll(');
  assert.match(up, /FB_COLD_ONCE_KEYS\.indexOf\(k\)\s*<\s*0/);
  const sib = cutFn(src, 'function _fbOnSiblingStorage(');
  assert.match(sib, /FB_COLD_ONCE_KEYS\.indexOf\(k\)\s*>=\s*0\)\s*return/);
});
