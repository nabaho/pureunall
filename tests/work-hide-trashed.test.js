/* 업무관리는 이알피 휴지통(_deleted)에 든 것을 보이지 않는다 (2026-10-01)
   이알피 TrashBin 은 딱지만 붙이고 지우지 않는다 — 업무관리가 그 딱지를 안 보면
   지운 사건·계약이 업무관리에 «진행중»으로 계속 남는다(중복 사건을 휴지통에 넣고 알았다). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8');
function cutFn(h) { const i = src.indexOf(h); assert.ok(i >= 0, h); let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); }

test('_peLive 는 휴지통에 든 줄을 뺀다', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(cutFn('function _peArr(') + cutFn('function _peLive('), ctx);
  const out = ctx._peLive(ctx._peArr({ a: { id: 'a' }, b: { id: 'b', _deleted: true }, c: null }));
  assert.equal(out.length, 1); assert.equal(out[0].id, 'a');
  assert.equal(ctx._peLive(null), null, '읽기 실패(null)는 그대로');
});
test('★ 이알피 원본을 읽는 두 길(서버·캐시) 모두 _peLive 를 지난다', () => {
  assert.match(src, /return \[d\[0\],_peLive\(_peArr\(s\.val\(\)\)\)\];/);
  assert.match(src, /return \[d\[0\],_peLive\(_ls\(PE_KEYS\[d\[0\]\]\)\)\];/);
});
