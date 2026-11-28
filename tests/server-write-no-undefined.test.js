/* 서버로 보내는 값 «어디에도» undefined 가 없어야 한다 — 한 칸 때문에 저장 전체가 거절된다 (2026-11-28)
 *
 * ■ 실제로 있었던 일 (2026-11-28 운영 화면)
 *   재무관리 → 입금관리 → «미입금 대기»에서 입금확정을 누르면 첫 건은 서버에 올라가고
 *   두 번째부터는 입금 기록(finance_income)이 안 올라갔다. 콘솔 —
 *     update failed: values argument contains undefined in property
 *     'data.finance_income.v.<id>.perfSettleType'
 *   원장의 «받음»·통장 «처리됨»은 올라가서 «받음인데 입금 기록·성과급은 없는» 반쪽이 남았고,
 *   입금 기록은 이 PC 사본에만 있다가 다음 동기화 때 사라졌다.
 *
 * ■ 왜 첫 건만 됐나
 *   dbSet 은 맨 앞에서 JSON 왕복으로 undefined 를 걷는다(tests/db-undefined-guard.test.js).
 *   한 번 저장해 서버 형식이 정해지면 dbUpsert·dbPatch·dbUpsertMany 는 dbSet 을 거치지 않고
 *   «바로 가는 길»(_recServerWrite)로 간다. 그 길은 맨 위 값만 null 로 바꿔서,
 *   새 레코드를 통째로 보낼 때 «안쪽 칸»의 undefined 를 그대로 실어 보냈다.
 *
 * ■ 못 박는 것 — pu-erp.html 의 실제 저장 함수를 떠서 «실시간DB 처럼 깐깐한» 가짜 서버로 돌린다
 *   ① 바로 가는 길(새 레코드 통째·칸 고치기·여러 건) — update 에 넘긴 값 어디에도 undefined 가 없다
 *   ② 서버로 간 값은 이 PC 사본과 같은 모양이다(배열 안 undefined 는 null 로 자리를 지킨다)
 *   ③ undefined 가 없던 저장은 내용이 바뀌지 않는다 · 고친 칸이 undefined 면 예전처럼 null(지우기)
 *   ④ dbSet 건별 길도 undefined 를 안 보낸다(맨 앞 JSON 왕복이 걷는다 — 그 왕복을 빼면 여기서 걸린다)
 *
 * ⚠ 업체·사람 이름은 지어낸 것만 쓴다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

function between(a, b) {
  const i = SRC.indexOf(a), j = SRC.indexOf(b, i);
  assert.ok(i >= 0 && j > i, '검사할 코드 조각을 찾을 수 없습니다: ' + a);
  return SRC.slice(i, j);
}
function oneLine(re, what) {
  const m = re.exec(SRC);
  assert.ok(m, what + ' 줄을 못 찾았다');
  return m[0];
}

/* 실시간DB 처럼 깐깐하게 — 값 «어디에든» undefined 가 있으면 그 자리를 돌려준다(없으면 빈 글) */
function undefinedAt(v, where) {
  if (v === undefined) return where;
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      const hit = undefinedAt(v[k], where + '.' + k);
      if (hit) return hit;
    }
  }
  return '';
}
function fakeFbDb(box) {
  return {
    ref() {
      return {
        update(u) {
          box.sent.push(u);
          const bad = undefinedAt(u, 'values argument');
          return bad
            ? Promise.reject(new Error("update failed: values argument contains undefined in property '" + bad + "'"))
            : Promise.resolve();
        }
      };
    }
  };
}
const tick = () => new Promise((r) => setTimeout(r, 5));
const J = (v) => JSON.stringify(v);

/* ── 바로 가는 길: 실제 _recServerWrite + 실제 dbUpsert·dbPatch·dbUpsertMany ── */
function directWorld(store) {
  const box = {
    console: { log() {}, warn() {}, error() {} },
    PuWork: { LOCK_TABLES: {} },
    KEY: 'pureun_v6_',
    localStorage: { getItem: () => '0', setItem() {} },
    sent: [], fails: [], viaDbSet: [],
    store: store || {},
    dbGet: (k, d) => (box.store[k] || d),
    dbSet: (k, v) => { box.viaDbSet.push(k); box.store[k] = v; return true; },
    _recCanDirect: () => true,                         /* 서버 형식이 정해진 뒤 — 사고가 난 길 */
    _recLocalSave: (k, next) => { box.store[k] = JSON.parse(J(next)); return true; },  /* 이 PC 사본은 JSON 으로 적힌다 */
    _recStamp: (x) => x,
    _conflictNet() {},
    coIsTomb: () => false,
    showToast() {},
    fbSyncFail: (e) => { box.fails.push(String(e && e.message || e)); }
  };
  box.fbDb = fakeFbDb(box);
  box.window = box;
  vm.createContext(box);
  vm.runInContext(oneLine(/var _REC_BADKEY = [^\n]*/, '_REC_BADKEY'), box);
  vm.runInContext(between('function _recServerWrite(', '\nfunction _recCanDirect('), box);
  vm.runInContext(between('var _FIELD_BADKEY = ', '// 여러 건 삭제 — 한 번의 요청에 건별 null'), box);
  return box;
}
function mine(box, k, id) {
  return (box.store[k] || []).filter((x) => x && x.id === id)[0];
}

test('★★ 입금확정 «두 번째» — 새 레코드 안쪽 칸이 undefined 여도 update 에 undefined 가 없다', async () => {
  const B = directWorld({ finance_income: [{ id: 'fi-1', amount: 110000 }] });   /* 첫 건은 이미 올라감 */
  const newFi = {
    id: 'fi-2', sourceKind: 'consulting', company: '예시업체', amount: 330000,
    perfSettleType: undefined,                                   /* 사고 난 칸 — settleType || undefined */
    perfShares: [{ sid: 'P-001', ratio: 1, memo: undefined }],   /* 배열 안 객체의 칸 */
    bank: { memo: undefined, date: '2026-11-28' }                /* 객체 안의 칸 */
  };
  assert.equal(B.dbUpsert('finance_income', newFi), true);
  await tick();
  assert.equal(B.viaDbSet.length, 0, '검사가 헛돈다 — 바로 가는 길이 아니라 dbSet 으로 갔다');
  assert.equal(B.sent.length, 1, '서버로 한 번 보내야 한다');
  assert.equal(undefinedAt(B.sent[0], 'values argument'), '',
    '★★ update 에 undefined 가 실렸다 — 실시간DB 가 입금 기록 저장 «전체»를 거절한다');
  assert.deepEqual(B.fails, [], '★★ 서버가 거절했다 — 입금 기록이 이 PC 에만 남았다가 사라진다');
  const rec = B.sent[0]['data/finance_income/v/fi-2'];
  assert.ok(rec, '새 레코드가 서버로 안 갔다');
  assert.equal(J(rec), J(mine(B, 'finance_income', 'fi-2')),
    '★ 서버로 간 값이 이 PC 사본과 다르다 — 두 기기가 다른 것을 보게 된다');
  assert.equal(rec.amount, newFi.amount, '멀쩡한 칸까지 없애면 안 된다');
  assert.equal(rec.perfShares[0].sid, newFi.perfShares[0].sid, '배열 안 객체의 멀쩡한 칸까지 없앴다');
});

test('★★ dbPatch — 고친 칸의 값이 객체이고 그 안에 undefined 가 있어도', async () => {
  const B = directWorld({ finance_income: [{ id: 'fi-1', amount: 1, undoneBy: 'P-002' }] });
  assert.equal(B.dbPatch('finance_income', 'fi-1', {
    perfShares: [{ sid: 'P-001', ratio: 1, memo: undefined }],
    undoneBy: undefined
  }), true);
  await tick();
  assert.equal(B.sent.length, 1, '서버로 한 번 보내야 한다');
  assert.equal(undefinedAt(B.sent[0], 'values argument'), '', '★★ update 에 undefined 가 실렸다');
  assert.deepEqual(B.fails, []);
  const shares = B.sent[0]['data/finance_income/v/fi-1/perfShares'];
  assert.ok(Array.isArray(shares) && shares.length >= 1, '고친 칸이 안 갔다');
  assert.equal(J(shares), J(mine(B, 'finance_income', 'fi-1').perfShares), '서버로 간 값이 이 PC 사본과 다르다');
  assert.equal(B.sent[0]['data/finance_income/v/fi-1/undoneBy'], null,
    '★ 맨 위 칸의 undefined 는 예전처럼 null(지우기)로 가야 한다');
});

test('★ dbUpsertMany — 여러 건을 통째로 보낼 때도', async () => {
  const B = directWorld({ cases: [] });
  assert.equal(B.dbUpsertMany('cases', [
    { id: 'c-1', name: '예시사건', managerSubs: undefined, fee: { retainer: 100, memo: undefined } },
    { id: 'c-2', name: '예시사건2', tags: ['a', undefined] }
  ]), true);
  await tick();
  assert.equal(B.sent.length, 1, '서버로 한 번 보내야 한다');
  assert.equal(undefinedAt(B.sent[0], 'values argument'), '', '★★ update 에 undefined 가 실렸다');
  assert.deepEqual(B.fails, []);
  ['c-1', 'c-2'].forEach((id) => {
    assert.ok(B.sent[0]['data/cases/v/' + id], id + ' 가 서버로 안 갔다');
    assert.equal(J(B.sent[0]['data/cases/v/' + id]), J(mine(B, 'cases', id)), id + ' — 서버로 간 값이 이 PC 사본과 다르다');
  });
});

test('★ 배열 안의 undefined 는 null — 자리를 잃지 않는다 (이 PC 사본과 같은 모양)', async () => {
  const B = directWorld({ finance_income: [] });
  const months = ['2026-10', undefined, '2026-12'];
  assert.equal(B.dbUpsert('finance_income', { id: 'fi-9', months }), true);
  await tick();
  const sentMonths = B.sent[0]['data/finance_income/v/fi-9'].months;
  assert.equal(sentMonths.length, months.length, '★ 자리가 밀리면 몇 번째 달인지로 이어 둔 것이 어긋난다');
  assert.equal(sentMonths[months.indexOf(undefined)], null, '빈 자리는 null 로 남아야 한다');
  assert.equal(J(sentMonths), J(mine(B, 'finance_income', 'fi-9').months));
});

test('★ undefined 가 없던 저장은 내용이 바뀌지 않는다', async () => {
  const when = new Date(Date.UTC(2026, 10, 28));
  const clean = { id: 'fi-5', amount: 0, paid: false, memo: '', note: null, perfShares: [{ sid: 'P-001', ratio: 0.5 }, 'x', 3], nest: { a: { b: [] } } };
  const B = directWorld({ finance_income: [] });
  assert.equal(B.dbUpsert('finance_income', Object.assign({}, clean, { when })), true);
  await tick();
  const rec = B.sent[0]['data/finance_income/v/fi-5'];
  const { when: sentWhen, ...rest } = rec;
  assert.equal(J(rest), J(clean), '★ 걷을 것이 없는 값의 내용이 바뀌었다');
  assert.equal(sentWhen, when, '날짜 같은 특수 객체는 손대지 않는다 — 예전과 같은 것을 보낸다');
  assert.deepEqual(Object.keys(rest).sort(), Object.keys(clean).sort(), '빈 글·0·false·null 칸까지 없앴다');
});

test('★ 이미 있는 레코드의 칸이 undefined 가 되면 예전처럼 null(지우기)로 간다', async () => {
  const B = directWorld({ finance_income: [{ id: 'fi-1', amount: 1, perfSettleType: 'personal' }] });
  assert.equal(B.dbUpsert('finance_income', { id: 'fi-1', amount: 1, perfSettleType: undefined }), true);
  await tick();
  const p = 'data/finance_income/v/fi-1/perfSettleType';
  assert.ok(p in B.sent[0], '지운 칸을 안 보내면 서버에 옛 값이 남는다');
  assert.equal(B.sent[0][p], null);
  assert.equal(undefinedAt(B.sent[0], 'values argument'), '');
});

/* ── dbSet 건별 길 — 맨 앞 JSON 왕복이 걷는다 ── */
function dbSetWorld(prevArr) {
  const store = { finance_income: J(prevArr) };
  const box = {
    console: { log() {}, warn() {}, error() {} },
    JSON, Object, Array, String, Number, Date, Math, parseInt, RegExp, Promise,
    KEY: 'pureun_v6_',
    localStorage: { getItem: () => '0', setItem() {} },
    _erpStoreGet: (k) => (k in store ? store[k] : null),
    _erpStoreSet: (k, j) => { store[k] = j; },
    _dbCache: {},
    _fbSynced: true,
    _fbObjForm: { finance_income: true },               /* 서버가 레코드 지도 모양 — 건별 길이 켜진 상태 */
    fbShouldSync: () => true,
    _fbWalOpen: () => null, _fbWalClose() {}, _fbPendRecord() {},
    scheduleAutoSnap() {}, showToast() {},
    CustomEvent: function CustomEvent() {},
    dispatchEvent() {},
    setTimeout() { return 1; },
    sent: [], fails: [], errs: [],
    fbSyncFail: (e) => { box.fails.push(String(e && e.message || e)); },
    _erpErrLog: (e) => { box.errs.push(String(e && e.message || e)); }
  };
  box.fbDb = fakeFbDb(box);
  box.window = box;
  vm.createContext(box);
  vm.runInContext('var _uidSeq = 0;\n' + cutFn(SRC, 'function uid(') + '\n' +
    oneLine(/var DIFF_KEYS = \[[^\]]*\];/, 'DIFF_KEYS') + '\n' +
    cutFn(SRC, 'function computeArrayDiff(') + '\n' +
    cutFn(SRC, 'function dbSet('), box);
  return box;
}

test('★★ dbSet 건별 길(새 레코드 통째·칸 단위·금지문자 통째)도 update 에 undefined 가 없다', async () => {
  const prev = [
    { id: 'fi-1', amount: 1, perfShares: [{ sid: 'P-001' }] },
    { id: 'fi-3', amount: 3, 'a.b': 1 }
  ];
  const B = dbSetWorld(prev);
  assert.equal(B.dbSet('finance_income', [
    { id: 'fi-1', amount: 5, perfShares: [{ sid: 'P-001', ratio: 1, memo: undefined }], perfSettleType: undefined }, /* 칸 단위 */
    { id: 'fi-3', amount: 4, 'a.b': 1, bank: { memo: undefined } },                                                  /* 금지문자 → 통째 */
    { id: 'fi-2', amount: 2, perfSettleType: undefined, bank: { memo: undefined, date: '2026-11-28' } }             /* 신규 → 통째 */
  ]), true);
  await tick();
  assert.deepEqual(B.errs, [], '검사가 헛돈다 — dbSet 이 중간에 터졌다(대역이 모자란가?)');
  assert.equal(B.sent.length, 1, '검사가 헛돈다 — 건별 길로 서버에 한 번 보내야 한다');
  assert.ok(B.sent[0]['data/finance_income/v/fi-2'], '새 레코드가 안 갔다');
  assert.ok(B.sent[0]['data/finance_income/v/fi-3'], '금지문자 레코드가 통째로 안 갔다');
  assert.ok(B.sent[0]['data/finance_income/v/fi-1/perfShares'], '고친 칸이 안 갔다');
  assert.equal(undefinedAt(B.sent[0], 'values argument'), '',
    '★★ dbSet 건별 길에 undefined 가 실렸다 — 맨 앞 JSON 왕복(v = JSON.parse(newJson))이 빠졌나?');
  assert.deepEqual(B.fails, []);
});
