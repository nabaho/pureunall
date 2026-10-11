/* 인센티브 가져오기 — 같은 파일을 두 번 올려도 겹치지 않는다 (2026-10-11 검토 A-1)
   새 줄의 열쇠는 「입금일|업체명_유형|수령인」인데 있던 줄은 「입금일|유형|수령인」으로 세어,
   항목에 밑줄(_)이 든 줄은 걸러지지 않았다 → 2026-06-18 264쌍(3억 325만 원)이 겹쳤다.
   규칙: 있던 줄의 열쇠도 «업체명_유형» 모양으로 만든다(새 줄과 같은 잣대). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

test('있던 인센티브 줄을 «업체명_유형» 열쇠로도 센다 — 두 번 올리면 걸러진다', () => {
  const i = src.indexOf("if(fi.sourceKind==='incentive'){");
  assert.ok(i >= 0, '있던 인센티브 줄을 세는 자리를 못 찾음');
  // 그 자리의 열쇠 만들기 «몸통»을 괄호 세기로 잘라 실제로 돌려 본다
  let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
  const body = src.slice(src.indexOf('{', i), j + 1);
  const ctx = { have: {} }; vm.createContext(ctx);
  vm.runInContext("var fi = { sourceKind:'incentive', date:'2023-01-16', companyName:'가나상사', kind:'체당금수수료', perfShares:[{ sid:'A-001' }] };" + body, ctx);
  const newKey = '2023-01-16|' + '가나상사_체당금수수료' + '|A-001';   // 새 줄이 쓰는 열쇠(date|item|sid)
  assert.equal(ctx.have[newKey], true, '두 번째 가져오기가 이 줄을 «이미 있음»으로 봐야 한다');
});
