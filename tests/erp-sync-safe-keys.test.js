/* 동기화 표의 «맨 위 열쇠»에 서버 금지 글자(. # $ / [ ])가 있어도 서버에 올라간다 (2026-10-11 검토 A-3)
   골라 둔 짝(ledger_picks)의 「…14:10#1」, 적요 이름으로 만든 별칭·처리됨 지문의 # $ / 하나가 섞이면
   그 표가 서버에 영영 못 올라갔다(10/11 백업 거절과 같은 뿌리 — 백업만 고쳤었다).
   규칙: ① 보내는 세 길(통째 저장·병합 저장 둘)이 erpFbSafeTopKeys 를 거친다 ② 받는 normalizeFbValue 가 푼다
   ③ 바꾼 뒤엔 맨 위 열쇠에 금지 글자가 없고, 풀면 원래와 같다 ④ 멀쩡한 지도는 «같은 것»을 그대로 준다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function cutFn(h) { const i = src.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); }
function box() {
  const ctx = { window: {} }; vm.createContext(ctx);
  const m = src.match(/var ERP_FB_BAD_KEY = [^\n]*/); assert.ok(m);
  vm.runInContext(m[0] + '\n' + cutFn('function erpFbSafeTopKeys(') + cutFn('function erpFbUnsafeTopKeys('), ctx);
  return ctx;
}

test('맨 위 열쇠를 바꾸고 풀면 원래와 같다', () => {
  const ctx = box();
  const v = { 'bank|expense|2026-04-06|800|03월문자수수료 14:10#1': { pid: 'p1' }, '가나/상사$': { n: 1 }, ok: { n: 2 } };
  const safe = ctx.erpFbSafeTopKeys(v);
  assert.deepEqual(Object.keys(safe).filter((k) => /[.#$\/\[\]]/.test(k)), []);
  assert.equal(JSON.stringify(ctx.erpFbUnsafeTopKeys(safe)), JSON.stringify(v));
});

test('금지 글자가 없으면 같은 것을 그대로 준다(다시 그리기·비교를 흔들지 않게)', () => {
  const ctx = box();
  const v = { a: 1, b: 2 };
  assert.equal(ctx.erpFbSafeTopKeys(v), v);
  assert.equal(ctx.erpFbUnsafeTopKeys(v), v);
  const arr = [{ id: 'x' }];
  assert.equal(ctx.erpFbSafeTopKeys(arr), arr);
});

test('보내는 길은 바꾸고, 받는 길은 푼다', () => {
  assert.match(src, /var fbValue = erpFbSafeTopKeys\(/);
  assert.ok((src.match(/var outV = erpFbSafeTopKeys\(/g) || []).length >= 2, '병합 저장 두 길');
  assert.match(cutFn('function normalizeFbValue('), /erpFbUnsafeTopKeys\(/);
});
