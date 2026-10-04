'use strict';
/* 휴지통은 「데이터 급감 차단」에서 뺀다 (대표 지시 2026-10-04 「고쳐라」)
   ── 무엇이 있었나: 돈 기록 270건을 trash_fin 으로 나누자 서버 trash_bin 이 271건 → 1건이 됐고,
      옛 목록(181건)을 든 PC 에 「서버에서 받은 trash_bin 데이터가 크게 줄었습니다」 창이 떴다.
      직원 PC 에서 「현재 데이터 유지」를 누르면 옛 돈 기록을 든 채로 남아 다시 올릴 수 있다.
   ── 휴지통은 «원본 표의 사본»이라 줄어드는 것이 정상이다.

   못 박는 것(규칙):
   ① 휴지통(trash_bin)이 크게 줄어 들어와도 «묻지 않고» 받아 적는다 (실제 함수를 돌려 본다)
   ② 다른 표는 그대로 묻는다 — 면제가 «너무 넓지» 않다 (재무 휴지통·업체·수입 …)
   ③ 이 기기가 보낼 때의 건수 비교(dbSet)도 같은 면제를 쓴다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const B = stripJs(fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const fn = (n) => { const f = cutFn(B, 'function ' + n + '('); assert.ok(f, n + ' 를 못 찾았습니다'); return f; };
const listVar = (name) => { const m = B.match(new RegExp('var ' + name + ' = (\\[[^\\]]*\\]);')); assert.ok(m, name + ' 없음'); return m[0]; };

/* 서버에서 새 값이 «줄어서» 들어온 순간을 실제 받기 함수로 돌린다 */
function 받기(key, 로컬건수, 서버건수) {
  const 질문 = [];
  const store = {};
  const ctx = {
    KEY: 'k_', _fbObjForm: {}, _FB_HIDE_DELETED: {}, _dbCache: {},
    localStorage: { getItem: (x) => (x in store ? store[x] : null), setItem: (x, v) => { store[x] = String(v); } },
    fbShouldSync: () => true,
    normalizeFbValue: (v) => (Array.isArray(v) ? v : Object.values(v || {})),
    _fbLocalCountForShrink: () => 로컬건수,
    _handleShrinkSync: (k, o, n) => { 질문.push({ k, o, n }); },
    _fbOpsEmpty: () => true, _scheduleFbChanged: () => {}, dbGet: () => [], dbSet: () => true,
    showToast: () => {}, setTimeout: () => {},
    window: { _erpErrLog: (e) => { throw e; } },
    console, parseInt, String, Array, Object, JSON, Date,
  };
  vm.createContext(ctx);
  vm.runInContext([listVar('SHRINK_EXEMPT_KEYS'), fn('_shrinkExempt'), fn('_fbApplyRecordInner')].join('\n'), ctx);
  const 줄 = Array.from({ length: 서버건수 }, (_, i) => ({ id: 'r' + i }));
  const 돌려줌 = ctx._fbApplyRecordInner(key, { v: 줄, u: 2000 }, { notify: false });
  return { 질문, 돌려줌, 받아적음: ctx._dbCache[key] };
}

test('① ★★ 휴지통은 크게 줄어 들어와도 묻지 않고 받아 적는다', () => {
  const r = 받기('trash_bin', 181, 1);
  assert.deepEqual(r.질문, [], '★★ 휴지통이 줄었다고 직원에게 「데이터 급감 차단」 창을 띄웁니다');
  assert.equal(r.돌려줌, true, '받아 적지 않았습니다');
  assert.equal(r.받아적음.length, 1, '★★ 서버의 1건으로 바뀌지 않았습니다 — 옛 돈 기록이 이 PC 에 남습니다');
});

test('② ★★ 다른 표는 그대로 묻는다 — 면제가 너무 넓지 않다', () => {
  ['companies', 'finance_income', 'trash_fin', 'consultings'].forEach((k) => {
    const r = 받기(k, 181, 1);
    assert.equal(r.질문.length, 1, '★★ ' + k + ' 의 급감 경고까지 꺼졌습니다 — 옛 데이터가 조용히 덮입니다');
    assert.equal(r.돌려줌, false);
    assert.equal(r.받아적음, undefined, k + ' 가 묻기 전에 받아 적혔습니다');
  });
});

test('③ 면제는 이름으로만 — 휴지통 하나', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext([listVar('SHRINK_EXEMPT_KEYS'), fn('_shrinkExempt')].join('\n'), ctx);
  assert.equal(ctx._shrinkExempt('trash_bin'), true);
  ['trash_fin', 'companies', 'finance_income', 'backup', ''].forEach((k) =>
    assert.equal(ctx._shrinkExempt(k), false, '★ ' + JSON.stringify(k) + ' 까지 면제입니다'));
  assert.equal(vm.runInContext('SHRINK_EXEMPT_KEYS.length', ctx), 1, '면제 목록이 늘었습니다 — 이 경고가 지키는 것은 «표 원본»입니다');
});

test('④ 이 기기가 보낼 때의 건수 비교(dbSet)도 같은 면제를 쓴다', () => {
  const body = fn('dbSet');
  assert.match(body, /prev\.length >= 10 && v\.length < prev\.length \* 0\.5 && !_shrinkExempt\(k\)\)/,
    '★★ 보내는 쪽 급감 차단이 휴지통을 막습니다 — 재무 기기의 정리(돈 기록 옮기기)가 「서버 전송을 차단」 경고로 걸립니다');
  assert.match(body, /_pushWithSrvCheck/, '서버 건수 대비 검사(근본 급감 차단)가 사라졌습니다 — 옛 데이터가 서버를 덮습니다');
});
