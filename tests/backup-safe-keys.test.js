/* 서버 백업이 칸 이름 하나(「…14:10#1」) 때문에 통째로 거절되던 것 (2026-10-11)
   실시간DB 는 칸 이름에 . # $ / [ ] 를 받지 않는다. 백업에 실을 때만 이름을 바꾸고(~k~ 머리),
   되살릴 때 원래대로 푼다. 규칙: ① 바꾼 뒤엔 나쁜 글자가 칸 이름에 하나도 없다 ② 풀면 원본과 같다
   ③ 두 백업 길이 지나는 erpSealSnap 이 바꾸고, 되살리는 erpUnsealSnap 이 푼다. */
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
  const m = src.match(/var ERP_FB_BAD_KEY = [^\n]*/); assert.ok(m, 'ERP_FB_BAD_KEY 가 있어야 한다');
  vm.runInContext(m[0] + '\n' + cutFn('function erpFbSafeKeys(') + cutFn('function erpFbUnsafeKeys('), ctx);
  return ctx;
}
function badKeys(v, out) {
  out = out || [];
  if (v && typeof v === 'object') Object.keys(v).forEach(k => { if (/[.#$\/\[\]]/.test(k)) out.push(k); badKeys(v[k], out); });
  return out;
}

test('나쁜 글자가 든 칸 이름은 바꾸고, 풀면 원본 그대로', () => {
  const ctx = box();
  const data = { bank_ledger_draft: { expCat: { 'bank|expense|2026-04-06|800|03월문자수수료 14:10#1': '통신비', 'a.b': 1, 'x/y': [ { 'p$q': 2 } ], '[z]': 3, ok: 4, '~k~raw': 5 } },
                 companies: [ { id: 'co-1', name: '가나상사' } ] };
  const safe = ctx.erpFbSafeKeys(data);
  assert.deepEqual(badKeys(safe), [], '바꾼 뒤에도 나쁜 칸 이름이 남았다');
  assert.equal(JSON.stringify(ctx.erpFbUnsafeKeys(safe)), JSON.stringify(data));
  assert.equal(safe.bank_ledger_draft.expCat.ok, 4, '멀쩡한 이름은 그대로');
});

test('잠그기가 바꾸고 되살리기가 푼다 — 두 백업 길이 모두 지나는 자리', () => {
  assert.match(cutFn('function erpSealSnap('), /erpFbSafeKeys\(/);
  assert.match(cutFn('function erpUnsealSnap('), /erpFbUnsafeKeys\(/);
});

test('서버가 저장을 거절하면 «주민번호 잠금» 이 아니라 «서버 저장» 실패로 알린다', () => {
  const b = cutFn('function serverBackupWrite(');
  assert.match(b, /서버가 백업 저장을 거절했습니다/);
});
