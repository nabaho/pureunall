'use strict';
/* 「⚠ 동기화 충돌 의심」 거짓 경보 (대표 폰 화면 2026-10-18 「고쳐라」)

   화면: 「동기화 충돌 의심: bank_processed」·「… expense_cat_aliases」 큰 갈색 경보 둘이 화면을 덮었다.
   까닭이 둘 겹쳤다 —
     ① 출금을 한꺼번에 등록하면 «줄마다» 배운 카테고리(expense_cat_aliases)·처리 표시(bank_processed)를
        저장했다. 35건이면 두 표가 35번씩 바뀐다(입금 「모두 확정」도 처리 표시를 줄마다 저장했다).
     ② 감지기는 「1분에 6번 바뀜」만 보고 «구버전 PC 의 되돌림»이라 외쳤다 — 한 사람이 일한 것뿐인데.
   고친 것 —
     ① 배우기·처리 표시를 «한 번»에 저장(erpLearnExpenseCatMany · erpMarkBankRowsProcessed)
     ② 감지기는 받은 값의 «꼴·건수» 지문이 «앞서 본 것으로 되돌아올 때»(A…B…A)만 경보,
        사람 손으로 안 나오는 1분 20번 넘김은 꼴과 상관없이 경보 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* 함수 하나를 괄호 짝으로 떼어 온다 */
function cut(src, head) {
  const at = src.indexOf(head);
  assert.ok(at >= 0, head + ' 를 못 찾았습니다');
  let d = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  return src.slice(at, i + 1);
}
function load(heads, extra) {
  const ctx = Object.assign({ window: {}, Object, String, Array, JSON, Date, parseInt }, extra || {});
  vm.createContext(ctx);
  vm.runInContext(heads.map((h) => cut(ERP, h)).join('\n'), ctx);
  return ctx;
}

/* ══ ② 감지기 ══ */
const S = load(['function erpStormSig(', 'function erpStormBack(']);

test('★★ 늘기만 하는 표(한꺼번에 등록)는 «되돌림»이 아니다', () => {
  const sigs = [];
  for (let n = 100; n < 135; n++) sigs.push(S.erpStormSig({ v: Object.fromEntries([...Array(n)].map((_, i) => ['k' + i, 1])) }));
  assert.equal(S.erpStormBack(sigs), false, '★★ 처리 표시가 35건 느는 것을 되돌림으로 읽는다 — 그것이 거짓 경보였다');
});

test('★★ 건수는 그대로 값만 바뀌는 표(학습 횟수 +1)도 되돌림이 아니다', () => {
  assert.equal(S.erpStormBack(['O50', 'O50', 'O50', 'O50', 'O50', 'O50', 'O51', 'O51']), false);
});

test('★★ 진짜 핑퐁 — 꼴(배열↔객체)이나 건수가 «앞뒤로» 가면 잡는다', () => {
  assert.equal(S.erpStormBack(['A10', 'O10', 'A10', 'O10', 'A10', 'O10']), true, '★★ 옛 PC 의 배열 덮어쓰기를 못 잡는다');
  assert.equal(S.erpStormBack(['O100', 'O95', 'O100', 'O95', 'O100', 'O95']), true, '★★ 옛 건수로 되돌리는 PC 를 못 잡는다');
  assert.equal(S.erpStormBack(['O100', 'O100', 'O95', 'O95', 'O100']), true, '같은 지문이 잇달아 와도 되돌림은 되돌림이다');
});

test('지문은 꼴과 건수를 가른다', () => {
  assert.equal(S.erpStormSig({ v: [1, 2, 3] }), 'A3');
  assert.equal(S.erpStormSig({ v: { a: 1, b: 2 } }), 'O2');
  assert.notEqual(S.erpStormSig({ v: [1, 2] }), S.erpStormSig({ v: { a: 1, b: 2 } }), '★ 배열↔객체 다툼을 같은 지문으로 본다');
  assert.equal(typeof S.erpStormSig(null), 'string', '빈 값에서 죽지 않는다');
});

test('★★ 감지기가 실제로 «되돌림 또는 멈추지 않는 고리»일 때만 경보한다', () => {
  const src = bare(ERP);
  const at = src.indexOf('function _stormCheck(k, v){');
  assert.ok(at > 0, '★ 감지기가 받은 값(v)을 안 본다 — 횟수만 세면 거짓 경보가 돌아온다');
  const fn = cut(src, 'function _stormCheck(k, v){');
  assert.match(fn, /if\(!erpStormBack\(s\.sig\) && n < ERP_STORM_LOOP\) return;/, '★★ 되돌림도 고리도 아닌데 경보한다');
  assert.match(fn, /now - s\.told < ERP_STORM_WIN/, '★ 한 번 알린 뒤 같은 1분 안에 또 띄운다');
  assert.match(src, /if\(opts\.storm\)\{ try \{ opts\.storm\(k, v\); \}/, '★ 받은 값을 감지기에 안 넘긴다');
  /* 고리 문턱은 «최소 문턱»보다 커야 한다 — 같으면 되돌림 판정이 아무 뜻이 없다 */
  const m = src.match(/var ERP_STORM_MIN = (\d+), ERP_STORM_LOOP = (\d+)/);
  assert.ok(m && Number(m[2]) > Number(m[1]) * 2, '★ 고리 문턱이 너무 낮다 — 사람이 빨리 일해도 경보가 뜬다');
});

/* ══ ① 한 번에 저장 ══ */
test('★★ 여러 줄 배우기는 dbSet «한 번» — 결과는 한 줄씩 배운 것과 같다', () => {
  function mk() {
    const store = { db: {} }, sets = [];
    const ctx = load(['function erpExpCatStore(', 'function _erpExpCatApply(', 'function erpLearnExpenseCat(', 'function erpLearnExpenseCatMany('], {
      EXP_CAT_ALIAS_KEY: 'expense_cat_aliases',
      dbGet: (k, def) => (store.db[k] === undefined ? def : JSON.parse(JSON.stringify(store.db[k]))),
      dbSet: (k, v) => { sets.push(k); store.db[k] = JSON.parse(JSON.stringify(v)); return true; },
      erpExpCatKey: (s) => String(s).replace(/\d+/g, '').replace(/\s+/g, ''),
    });
    return { ctx, store, sets };
  }
  const pairs = [
    { memo: '급여 홍길동', category: 'exp-salary' }, { memo: '급여 김철수', category: 'exp-salary' },
    { memo: 'KT 통신요금', category: 'exp-tel' }, { memo: 'KT 통신요금 10월', category: 'exp-tel' },
    { memo: '', category: 'exp-tel' },                                   // 적요 없음 → 안 배운다
  ];
  const A = mk(); const n = A.ctx.erpLearnExpenseCatMany(pairs);
  const B = mk(); pairs.forEach((p) => B.ctx.erpLearnExpenseCat(p.memo, p.category));
  assert.equal(n, 4);
  assert.deepEqual(A.sets, ['expense_cat_aliases'], '★★ 여러 줄을 배우는데 표를 여러 번 저장한다 — 다른 기기에 충돌 경보가 뜬다');
  const strip = (st) => JSON.parse(JSON.stringify(st, (k, v) => (k === 'lastAt' ? undefined : v)));
  assert.deepEqual(strip(A.store.db.expense_cat_aliases), strip(B.store.db.expense_cat_aliases), '★ 한꺼번에 배운 결과가 한 줄씩과 다르다');
  assert.equal(A.ctx.erpLearnExpenseCatMany([]), 0);
  assert.deepEqual(A.sets, ['expense_cat_aliases'], '배울 것이 없으면 저장하지 않는다');
});

test('★ 여러 줄 처리 표시는 출금도 받는다 — 표시 없이 부르던 곳(CMS 자동)은 그대로 입금', () => {
  const store = {}, sets = [];
  const ctx = load(['function erpBankProcessedStore(', 'function erpMarkBankRowsProcessed('], {
    BANK_PROCESSED_KEY: 'bank_processed', BANK_PROCESSED_MAX: 3000,
    dbGet: (k, def) => (store[k] === undefined ? def : store[k]),
    dbSet: (k, v) => { sets.push(k); store[k] = v; return true; },
    erpBankRowKey: (r) => r.date + '|' + r.amount,
  });
  const n = ctx.erpMarkBankRowsProcessed([
    { row: { date: '2026-10-01', amount: 1 }, kind: 'expense', label: '급여' },
    { row: { date: '2026-10-02', amount: 2 }, label: 'CMS' },
  ]);
  assert.equal(n, 2);
  assert.deepEqual(sets, ['bank_processed'], '★ 한 번에 저장하지 않는다');
  assert.equal(store.bank_processed['2026-10-01|1'].kind, 'expense', '★ 출금 줄이 입금으로 적힌다');
  assert.equal(store.bank_processed['2026-10-02|2'].kind, 'income', '★ 옛 부름(kind 없음)이 입금이 아니게 됐다');
});

test('★★ 한꺼번에 하는 자리 넷은 줄마다 저장하지 않는다', () => {
  const src = bare(ERP);
  const FL = src.slice(src.indexOf('function FinanceLedger('), src.indexOf('function FinanceIncome'));
  /* 등록 한 벌 · 저절로 등록 · 고르는 자리 · 입금 모두 확정 */
  const reg = cut(FL, 'function registerExpRows(');
  assert.doesNotMatch(reg, /erpLearnExpenseCat\(|erpMarkBankRowProcessed\(/, '★★ 등록 한 벌이 줄마다 배우거나 표시한다');
  assert.match(reg, /erpLearnExpenseCatMany\(learn\)/);
  assert.match(reg, /erpMarkBankRowsProcessed\(marks\)/);

  const autoAt = FL.indexOf("if(!rows || ldTabEff!=='exp' || !expAutoReg) return;");
  assert.ok(autoAt > 0, '저절로 등록하는 효과를 못 찾았습니다');
  const auto = FL.slice(autoAt, FL.indexOf('}, [rows, ldTabEff, _ldSrc, expAutoReg, expCat]);', autoAt));
  assert.doesNotMatch(auto, /erpLearnExpenseCat\(|erpMarkBankRowProcessed\(|saveExpense\(/, '★★ 저절로 등록이 줄마다 저장한다');
  assert.match(auto, /registerExpRows\(/);

  const selAt = FL.indexOf("h('select',{value:cat||'',onChange:function(e){");
  const sel = FL.slice(selAt, FL.indexOf("},style:{flex:'1 1 auto'", selAt));
  assert.doesNotMatch(sel, /erpLearnExpenseCat\(|erpMarkBankRowProcessed\(/, '★★ 고르는 자리(같은 적요 함께)가 줄마다 저장한다');

  const conf = cut(FL, 'function confirmReadyList(');
  assert.doesNotMatch(conf, /erpMarkBankRowProcessed\(/, '★★ 입금 「모두 확정」이 처리 표시를 줄마다 저장한다');
  assert.match(conf, /erpMarkBankRowsProcessed\(marks\)/);
});

/* ══ 경보 창 — 폰에서 한 치수 작게 ══ */
test('★ 경보 창에 폰 손잡이가 있고, 폰에서도 제목·대응책·닫기는 남는다', () => {
  ['erp-alert', 'erp-alert-t', 'erp-alert-d', 'erp-alert-a', 'erp-alert-tm', 'erp-alert-bar'].forEach((c) => {
    assert.match(ERP, new RegExp("className='" + c + "'"), c + ' 손잡이가 없다');
  });
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'pu-erp.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const at = css.indexOf('#erp-alert-wrap{');
  assert.ok(at > 0, '경보 창 폰 규칙이 없다');
  const head = css.slice(0, at);
  assert.ok((head.match(/\{/g) || []).length > (head.match(/\}/g) || []).length, '★ 경보 창 규칙이 폰 구간 밖에 있다 — PC 경보까지 줄어든다');
  ['erp-alert-t', 'erp-alert-a', 'erp-alert-bar'].forEach((c) => {
    assert.doesNotMatch(css, new RegExp('\\.' + c + '\\{[^}]*display:\\s*none'), '★ ' + c + ' 를 접으면 경보의 알맹이가 사라진다');
  });
});
