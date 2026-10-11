/* createdAt 이 숫자여도 이알피 화면이 멎지 않는다 (2026-10-11 검토 A-2)
   공용 저장 관문이 옛 레코드에 Date.now()(숫자)를 채운 적이 있다 → 업체관리 정렬이 멎었다(10/10).
   #2369 는 한 곳만 막았고 「이번 달 신규」·「이번 달만」 등 같은 꼴이 더 있었다.
   규칙: ① (… createdAt … || '').slice/.localeCompare 같은 «날것 글자 다루기»가 남아 있지 않다
   ② erpDateStr 는 숫자를 ISO 글자로, 없으면 빈 글자로 준다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function cutFn(h) { const i = src.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); }

test('createdAt 을 «글자인 줄 알고» 바로 자르거나 견주는 자리가 없다', () => {
  const bad = src.match(/(?<![A-Za-z0-9_$])\([^()]*createdAt[^()]*\|\|\s*''\s*\)\.(slice|substr|substring|localeCompare|indexOf|split|replace)\(/g) || [];
  assert.deepEqual(bad, [], 'erpDateStr(…) 로 감쌀 것');
});

test('erpDateStr — 숫자는 ISO 글자, 글자는 그대로, 없으면 빈 글자', () => {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(cutFn('function erpDateStr('), ctx);
  const t = Date.parse('2026-10-10T06:26:38.013Z');
  assert.equal(ctx.erpDateStr(t), '2026-10-10T06:26:38.013Z');
  assert.equal(ctx.erpDateStr('2026-01-05'), '2026-01-05');
  assert.equal(ctx.erpDateStr(undefined), '');
  assert.equal(ctx.erpDateStr(''), '');
  assert.equal(ctx.erpDateStr(t).slice(0, 7), '2026-10');
});
