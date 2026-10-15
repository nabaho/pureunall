/* 이알피 저장 «입구»가 근로자 주민번호·계좌·예금주를 떼는가 (대표 결정 2026-10-15)
 *
 * ■ 왜 입구인가 — 사건·계약을 저장하는 화면이 수십 곳이다. 입구 넷(dbUpsert·dbPatch·dbUpsertMany·dbSet)
 *   맨 앞에서 떼면 어느 화면이 저장하든 공개 덩어리와 이 PC 사본에 안 실린다.
 * ■ 무엇을 보나 — pu-erp.html 의 실제 저장 함수를 떠서 가짜 서버로 «돌려» 본다.
 *   ① 서버로 가는 값에 셋이 없다  ② 이 PC 사본에도 없다  ③ 담당자 칸으로는 간다
 *   ④ 저장이 실패하면 담당자 칸에도 안 쓴다  ⑤ 다른 표는 건드리지 않는다
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const WS = fs.readFileSync(path.join(ROOT, 'js', 'pu-worker-secret.js'), 'utf8');

function 실어보기(opts) {
  const o = Object.assign({ localOk: true, store: {} }, opts);
  const box = {
    console: { log() {}, warn() {}, error() {} }, JSON, Object, Array, String, Date, Math, Promise, setTimeout,
    store: o.store, served: [], secretWrites: [], toasts: [],
    PuWork: { LOCK_TABLES: {} },
    fbDb: {
      ref: () => ({ update: async (paths) => { box.secretWrites.push(paths); }, once: async () => ({ val: () => null }) })
    },
    dbGet: (k, d) => (box.store[k] || d),
    dbSet: (k, v) => { box.store[k] = v; box.served.push({ via: 'dbSet', k, v }); return true; },
    _recCanDirect: () => true,
    _recLocalSave: (k, next) => { if (!o.localOk) return false; box.store[k] = next; return true; },
    _recServerWrite: (k, cp) => { box.served.push({ via: 'direct', k, cp }); },
    _recStamp: (x) => x,
    _conflictNet: () => {},
    _REC_BADKEY: /[.#$\[\]\/]/,
    coIsTomb: () => false,
    showToast: (m) => box.toasts.push(m)
  };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(WS, box);
  const a = ERP.indexOf('var _FIELD_BADKEY = ');
  const b = ERP.indexOf('// 여러 건 삭제 — 한 번의 요청에 건별 null');
  assert.ok(a > 0 && b > a, '저장 함수 구역을 못 찾았습니다');
  vm.runInContext(ERP.slice(a, b), box);
  return box;
}

const 흔적 = (v) => /"(rrn|account|holder)"\s*:/.test(JSON.stringify(v));
const 잠깐 = () => new Promise((r) => setTimeout(r, 5));

const 계약 = () => ({ id: 'ct-1', managerMain: 'P-001',
  company: { name: '가나상사', workers: [{ id: 'w1', name: '김예시', rrn: '900101-1000000', account: '123-45', holder: '김예시' }] } });

test('★★ dbUpsert(계약) — 서버·사본에는 없고, 담당자 칸으로는 간다', async () => {
  const B = 실어보기();
  assert.equal(B.dbUpsert('contracts', 계약()), true);
  assert.equal(흔적(B.served), false, '★★ 공개 덩어리로 주민번호·계좌가 나갑니다');
  assert.equal(흔적(B.store.contracts), false, '★★ 이 PC 사본에 주민번호가 남습니다');
  assert.equal(B.store.contracts[0].company.workers[0].hasRrn, true, '「있다」 표시가 없습니다');
  await 잠깐();
  assert.equal(B.secretWrites.length, 1, '★★ 담당자 칸으로 안 갑니다 — 주민번호를 잃습니다');
  assert.equal(B.secretWrites[0]['worker_secret/contracts/ct-1/w1/rrn'], '900101-1000000');
});

test('★★ dbPatch(사건 workers) — 같은 규칙', async () => {
  const B = 실어보기({ store: { cases: [{ id: 'c-1', managerMain: 'P-001', workers: [] }] } });
  assert.equal(B.dbPatch('cases', 'c-1', { workers: [{ id: 'w2', name: '박샘플', rrn: '850715-2000000' }] }), true);
  assert.equal(흔적(B.served), false);
  assert.equal(흔적(B.store.cases), false);
  await 잠깐();
  assert.equal(B.secretWrites[0]['worker_secret/cases/c-1/w2/rrn'], '850715-2000000');
});

test('★ dbUpsertMany — 여러 건도', async () => {
  const B = 실어보기();
  assert.equal(B.dbUpsertMany('cases', [
    { id: 'c-1', workers: [{ id: 'w1', rrn: '1' }] },
    { id: 'c-2', workers: [{ id: 'w2', name: '칸 없음' }] }]), true);
  assert.equal(흔적(B.served), false);
  await 잠깐();
  assert.equal(B.secretWrites.length, 1, '칸 없는 건까지 담당자 칸에 씁니다');
});

test('★ 저장이 실패하면 담당자 칸에도 안 쓴다', async () => {
  const B = 실어보기({ localOk: false });
  assert.equal(B.dbUpsert('contracts', 계약()), false);
  await 잠깐();
  assert.equal(B.secretWrites.length, 0, '건은 저장 안 됐는데 담당자 칸만 남습니다');
});

test('다른 표(업체)는 그대로 — 셋 이름의 칸이 있어도', () => {
  const B = 실어보기();
  B.dbUpsert('companies', { id: 'co-1', name: 'A', account: '법인계좌' });
  assert.equal(JSON.stringify(B.served).indexOf('법인계좌') >= 0, true);
});

test('★ 통째 저장(dbSet)·휴지통도 뗀다 — 떼기만, 담당자 칸에는 안 쓴다', () => {
  const at = ERP.indexOf('function dbSet(k, v){');
  const head = ERP.slice(at, at + 6000).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(head, /_wsOn\(k\)[^\n]*PuWorkerSecret\.split\(k, x\)\.record/, '★ 통째 저장이 주민번호를 공개 덩어리로 올립니다');
  assert.match(head, /k === 'trash_bin'[^\n]*_wsTrashStrip/, '★ 휴지통에 든 사건·계약의 주민번호가 남습니다');
  assert.doesNotMatch(head.slice(0, head.indexOf('_wsTrashStrip') + 40), /_wsSend/, '통째 저장이 옛 사본 값을 담당자 칸에 씁니다');
});

test('스크립트를 싣는다', () => {
  assert.match(ERP, /<script src="js\/pu-worker-secret\.js\?v=\d+"><\/script>/);
});
