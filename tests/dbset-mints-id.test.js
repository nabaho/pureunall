/* 번호 없는 항목은 저장 «전»에 번호를 받는다 — 표가 통째 저장으로 떨어지는 길을 «쓰는 쪽»에서 막는다
   ─────────────────────────────────────────────────────────────────────────
   대표 지시 2026-09-16 「데이터가 계속 들어갈 때마다 이런 문제가 발생할 수 있고 다른 직원이
   데이터를 넣었을 때마다 이상하게 충돌되거나 … 이거에 대한 해결책까지 한번 전체 검토를 해달라」

   ■ 무엇이 있었나
     건별 저장 표(DIFF_KEYS)에 번호 없는 항목이 «하나라도» 있으면 dbSet 아래쪽에서
     ① 칸 단위 저장이 꺼지고(_fbObjForm) ② 병합 거래가 꺼지고(_canMerge)
     ③ 서버에 배열(옛 꼴)로 «통째» 덮어쓴다 — 나중 사람이 앞사람 것을 지운다.
     #1371 은 «읽는 쪽»(normalizeFbValue)만 고쳤다. 어느 화면이 번호 없는 항목을
     dbSet 으로 밀어 넣으면(부르는 곳이 230군데) 같은 일이 다시 시작된다.

   ★ 못 박는 것
     ① DIFF_KEYS 는 dbSet «밖»에 한 번 — 함수 첫머리 그물이 쓸 수 있어야 한다
     ② 그물은 newJson 을 만들기 «전»에 있다 — 뒤면 이 기기 사본엔 번호가 없다
     ③ 번호 없는(없음·null·빈 글) 항목마다 번호가 붙고, 있던 번호는 그대로
     ④ 두 번째 저장은 번호를 다시 짓지 않는다
     ⑤ 내용이 같은 두 줄은 두 줄로 남는다 — 내용으로 지은 번호(_fbStableId)를 쓰지 않는다
     ⑥ 건별 저장 표가 아니면 안 건드린다
     ⑦ 배열이 아닌 표(leave_grants 같은 사번 묶음)는 그대로 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const S = stripJs(SRC);

const DBSET = cutFn(S, 'function dbSet(');
const GUARD = DBSET.slice(0, DBSET.indexOf('_hadDup'));          /* 함수 첫머리 ~ 겹침 걷기 앞 */

test('① DIFF_KEYS 는 dbSet «밖»에 한 번 — 그물이 쓸 수 있는 자리', () => {
  const decl = S.indexOf('var DIFF_KEYS =');
  assert.ok(decl >= 0, 'DIFF_KEYS 선언이 없다');
  assert.ok(decl < S.indexOf('function dbSet('), 'dbSet 안에 있으면 함수 첫머리에서는 undefined 다(var 끌어올림은 값을 안 올린다)');
  assert.equal(S.split('var DIFF_KEYS =').length - 1, 1, '두 번 선언되면 한쪽이 낡는다');
});

test('② 그물은 newJson 을 만들기 «전»에 있고, uid 로 짓는다', () => {
  const iGuard = GUARD.indexOf('DIFF_KEYS.indexOf(k) >= 0');
  assert.ok(iGuard >= 0, '함수 첫머리에 DIFF_KEYS 를 보는 그물이 없다');
  assert.ok(iGuard < DBSET.indexOf('newJson = JSON.stringify(v)'), 'newJson 뒤면 이 기기 사본에는 번호가 없고 서버에만 있다');
  assert.match(GUARD, /uid\(/, '번호는 uid 로 짓는다');
  assert.ok(!/_fbStableId\(/.test(GUARD), '내용으로 지은 번호는 같은 내용 두 줄을 한 줄로 접는다 — 쓰는 쪽에서는 금지');
});

/* ── 진짜로 돌려 본다 ── */
function makeWorld() {
  const store = {};
  const ctx = {
    console: { warn(){}, log(){}, error(){} },
    JSON, Object, Array, String, Number, Date, Math, parseInt, RegExp,
    _erpStoreGet: k => (k in store ? store[k] : null),
    _erpStoreSet: (k, j) => { store[k] = j; },
    _dbCache: {},
    fbDb: null,
    scheduleAutoSnap(){}, showToast(){},
    window: { dispatchEvent(){}, _erpErrLog: null },
    CustomEvent: function CustomEvent(){},
    setTimeout(){ return 1; }
  };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  const diffLine = /var DIFF_KEYS = \[[^\]]*\];/.exec(S);
  assert.ok(diffLine, 'DIFF_KEYS 줄을 못 찾았다');
  vm.runInContext('var _uidSeq = 0;\n' + cutFn(S, 'function uid(') + '\n' + cutFn(S, 'function _fbStableId(') + '\n' + diffLine[0] + '\n' + DBSET, ctx);
  return { ctx, store, read: k => JSON.parse(store[k]) };
}

test('③ 번호 없는(없음·null·빈 글) 항목마다 번호가 붙고, 있던 번호는 그대로', () => {
  const w = makeWorld();
  const ok = w.ctx.dbSet('finance_income', [{ amt: 1 }, { id: 'a', amt: 2 }, { id: '', amt: 3 }, { id: null, amt: 4 }]);
  assert.equal(ok, true);
  const got = w.read('finance_income');
  assert.equal(got.length, 4, '줄이 사라지면 안 된다');
  got.forEach(x => { assert.equal(typeof x.id, 'string'); assert.ok(x.id.length > 0, '빈 번호가 남았다'); });
  assert.equal(got[1].id, 'a', '있던 번호를 갈아치우면 다른 기기와 어긋난다');
  assert.equal(new Set(got.map(x => x.id)).size, 4, '번호가 겹친다');
  assert.equal(got[0].amt, 1); assert.equal(got[3].amt, 4);
});

test('④ 두 번째 저장은 번호를 다시 짓지 않는다', () => {
  const w = makeWorld();
  w.ctx.dbSet('cases', [{ t: 'x' }, { t: 'y' }]);
  const first = w.read('cases').map(x => x.id);
  const again = w.read('cases').map(x => Object.assign({}, x, { t: x.t + '!' }));
  w.ctx.dbSet('cases', again);
  assert.deepEqual(w.read('cases').map(x => x.id), first, '저장마다 번호가 바뀌면 칸 단위 저장이 영영 못 산다');
});

test('⑤ 내용이 같은 두 줄은 두 줄로 남는다', () => {
  const w = makeWorld();
  w.ctx.dbSet('finance_expense', [{ amt: 5, memo: '가나상사' }, { amt: 5, memo: '가나상사' }]);
  const got = w.read('finance_expense');
  assert.equal(got.length, 2, '사람이 넣은 두 줄이 한 줄로 접혔다 — 내용으로 지은 번호를 썼을 때 생기는 일');
  assert.notEqual(got[0].id, got[1].id);
});

test('⑥ 건별 저장 표가 아니면 안 건드린다', () => {
  const w = makeWorld();
  w.ctx.dbSet('consult_logs', [{ x: 1 }]);
  assert.equal(w.read('consult_logs')[0].id, undefined, '통째로만 저장되는 표에 번호를 붙일 까닭이 없다 — 모양을 바꾸면 그 표를 읽는 옛 코드가 어긋난다');
});

test('⑦ 배열이 아닌 표(사번 묶음)는 그대로', () => {
  const w = makeWorld();
  const g = { S1: { 2026: { total: 15, carryOver: 0 } } };
  w.ctx.dbSet('leave_grants', g);
  assert.deepEqual(w.read('leave_grants'), g);
});
