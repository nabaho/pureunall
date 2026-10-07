'use strict';
/* 이 PC 저장 공간이 가득 차도 «고친 내용은 서버로 간다» (대표 지시 2026-10-07
   「계약관리에서 이관했는데 계속 남아 있다 전체적오류가 있는거 같다 모든것 고쳐달라 근본고침 해라」)

   무슨 일이 있었나 — nabaho.github.io 저장 공간(통합 프로그램 전부가 나눠 쓰는 약 10MB)이 차자
   dbSet 이 «이 PC 에 못 썼으니 멈춘다»로 서버에도 안 보냈다. 10/7 13:19 이관에서 업체 둘은 만들어졌는데
   계약 «이관완료»는 서버에 못 올라가 계약관리에 남았고, 실패 알림이 저장마다 떠 화면 아래가 깜빡였다.

   지키는 것
   ① 못 쓴 값은 메모리에 쥐고, 읽을 때 먼저 본다 · 던지는 것은 예전 그대로
   ② 공간이 차면 «이 PC 자동 스냅샷»부터 비우고 다시 쓴다
   ③ dbSet 은 공간 부족으로 멈추지 않는다 — 공간 부족이 아닌 실패만 멈춘다
   ④ 알림은 10분에 한 번 — 저장마다 띄우지 않는다
   ⑤ 서버로 보내기 앞 «마지막 동기화 시각» 적기가 실패해도 보내기를 막지 않는다
   ⑥ 자동 스냅샷은 한 벌만, 공간이 모자란 PC 에서는 쥐지 않는다 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripJs } = require('./strip-comments.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function body(head) {
  const at = SRC.indexOf(head);
  assert.ok(at >= 0, head + ' 이 없습니다');
  let d = 0;
  for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
    if (SRC[i] === '{') d++; else if (SRC[i] === '}') { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error(head);
}
/* 크기 한도가 있는 가짜 저장소 — 한도를 넘으면 진짜 브라우저처럼 QuotaExceededError */
function store(cap) {
  const m = {};
  const size = () => Object.keys(m).reduce((a, k) => a + k.length + m[k].length, 0);
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => {
      const old = k in m ? m[k] : null; m[k] = String(v);
      if (size() > cap) { if (old === null) delete m[k]; else m[k] = old; const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    },
    removeItem: (k) => { delete m[k]; }, _m: m,
  };
}
function box(cap) {
  const ls = store(cap), toasts = [];
  const ctx = { KEY: 'pureun_v6_', localStorage: ls, sessionStorage: store(1e9), Object, Date, showToast: (t) => toasts.push(t) };
  vm.createContext(ctx);
  vm.runInContext('var _dbStoreFailed = {};\n'
    + SRC.match(/var _erpMemStore = \{\};/)[0] + '\n'
    + body('function _erpMemFlush(') + '\n' + SRC.match(/var _erpQuotaToldAt = 0;/)[0] + '\n'
    + body('function erpQuotaNotice(') + '\n' + body('function _erpStoreGet(') + '\n'
    + body('function _erpStoreSet(') + '\n' + body('function _erpStoreRemove('), ctx);
  return { ctx, ls, toasts };
}

test('① 못 쓴 값은 메모리에 쥐고 먼저 읽는다 · 던지는 것은 예전 그대로', () => {
  const { ctx } = box(50);
  assert.throws(() => ctx._erpStoreSet('contracts', '[{"id":"a","status":"transferred"}]'));
  assert.equal(vm.runInContext('_dbStoreFailed.contracts', ctx), true);
  assert.equal(ctx._erpStoreGet('contracts'), '[{"id":"a","status":"transferred"}]',
    '못 쓴 값을 안 쥐면 다음 저장이 옛 사본과 견주어 «바뀐 것 없음»이나 엉뚱한 차이를 만든다');
  ctx._erpStoreRemove('contracts');
  assert.equal(ctx._erpStoreGet('contracts'), null);
});

test('② 공간이 차면 자동 스냅샷부터 비우고 다시 쓴다', () => {
  const { ctx, ls } = box(400);
  ls.setItem('__erp_snap__', 'x'.repeat(300));
  ctx._erpStoreSet('contracts', 'y'.repeat(200));
  assert.equal(ls.getItem('__erp_snap__'), null, '스냅샷을 안 비웠습니다');
  assert.equal(ls.getItem('pureun_v6_contracts'), 'y'.repeat(200));
  assert.equal(vm.runInContext('_dbStoreFailed.contracts', ctx), undefined);
  assert.equal(vm.runInContext('Object.keys(_erpMemStore).length', ctx), 0);
});

test('다시 잘 쓰이면 메모리 것을 놓는다', () => {
  const { ctx, ls } = box(60);
  try { ctx._erpStoreSet('cases', 'z'.repeat(100)); } catch (_) {}
  ls.removeItem('dummy');
  ctx._erpStoreSet('cases', 'short');
  assert.equal(vm.runInContext("Object.prototype.hasOwnProperty.call(_erpMemStore,'cases')", ctx), false);
  assert.equal(ctx._erpStoreGet('cases'), 'short');
});

test('④ 알림은 10분에 한 번', () => {
  const { ctx, toasts } = box(10);
  ctx.erpQuotaNotice(); ctx.erpQuotaNotice(); ctx.erpQuotaNotice();
  assert.equal(toasts.length, 1, '저장마다 띄우면 화면 아래가 깜빡입니다');
});

test('③ dbSet 은 공간 부족으로 멈추지 않는다', () => {
  const fn = stripJs(body('function dbSet('));
  const at = fn.indexOf('try { _erpStoreSet(k, newJson); }');
  assert.ok(at > 0, '저장 자리를 못 찾았습니다');
  const c = fn.slice(at, fn.indexOf('_dbCache[k] = v;', at));
  assert.match(c, /if\(!_quota\)\{[\s\S]{0,120}return false;\s*\}/, '공간 부족이 아닌 실패만 멈춰야 합니다');
  assert.equal((c.match(/return false/g) || []).length, 1, '★★ 공간 부족 길에서 멈추면 서버에도 안 갑니다(이관 반쪽 사고)');
  assert.match(c, /erpQuotaNotice\(\)/, '알림은 한 곳(10분에 한 번)으로');
  assert.ok(!/dbSet\(_pk/.test(c), '정리 뒤 dbSet 을 다시 부르면 같은 것을 두 번 보냅니다');
});

test('⑤ 마지막 동기화 시각을 못 적어도 보내기는 간다', () => {
  const fn = stripJs(body('function dbSet('));
  assert.match(fn, /try \{ localStorage\.setItem\(KEY\+'_meta_'\+k, String\(ts\)\); \} catch\(_\)\{\}/,
    '시각 적기가 던지면 서버로 보내는 길 전체가 멈춥니다');
});

test('⑥ 자동 스냅샷은 한 벌만, 모자란 PC 에서는 쥐지 않는다', () => {
  const fn = stripJs(body('function scheduleAutoSnap('));
  assert.match(fn, /if\(snaps\.length > 1\) snaps = snaps\.slice\(0,1\);/);
  assert.match(fn, /Object\.keys\(_erpMemStore\)\.length/);
  assert.match(fn, /catch\(e\) \{ try \{ localStorage\.removeItem\('__erp_snap__'\); \}/);
});
