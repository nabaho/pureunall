/* 업체관리 표 — 창 바닥보다 «두 줄 더» (대표 지시 2026-10-11 「디자인은 그대로하고 아래 사업장정보가 2개정도 더 보이게」)
   규칙: ① 업체관리는 useFillHeight 에 «2줄 이상 더» 를 준다 ② 더하는 높이는 표의 실제 한 줄 높이 × 줄 수
   ③ 안 주면 예전과 같다(다른 화면 17곳은 그대로). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function cutFn(h) { const i = src.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); }

test('업체관리는 표를 창 바닥보다 두 줄 이상 더 늘린다', () => {
  const cm = cutFn('function CompanyManagement(');
  const m = cm.match(/useFillHeight\(\s*[^,()]*,\s*(\d+)\s*\)/);
  assert.ok(m, '업체관리 useFillHeight 에 «몇 줄 더» 인자가 있어야 한다');
  assert.ok(Number(m[1]) >= 2);
});

test('더하는 높이 = 표 한 줄 높이 × 줄 수, 줄 수를 안 주면 0', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(cutFn('function erpFillExtra('), ctx);
  const el = { querySelector: () => ({ getBoundingClientRect: () => ({ height: 36 }) }) };
  assert.equal(ctx.erpFillExtra(el, 2), 72);
  assert.equal(ctx.erpFillExtra(el, 0), 0);
  assert.equal(ctx.erpFillExtra(el, undefined), 0);
  assert.ok(ctx.erpFillExtra({ querySelector: () => null }, 2) > 0, '줄이 아직 없어도 어림값으로 늘린다');
});

test('useFillHeight 는 그 높이를 창 바닥 높이에 더한다', () => {
  assert.match(cutFn('function useFillHeight('), /want\s*\+=\s*erpFillExtra\(/);
});
