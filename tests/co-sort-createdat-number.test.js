/* 업체관리 정렬이 createdAt 이 «숫자»인 업체에 멎던 것 (2026-10-10)
   공용 저장 관문(js/pu-ontology-write.js)은 createdAt 이 없던 옛 업체를 저장할 때 Date.now()(숫자)를 채운다.
   업체관리의 refreshCompanies 정렬은 글자로만 다뤄 「localeCompare is not a function」으로 멎었다.
   규칙: 글자·숫자가 섞여도 정렬이 멎지 않고, 숫자도 같은 시각의 날짜로 견준다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

function cutFn(s, h) { const i = s.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = s.indexOf('{', i), d = 0;
  for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) break; } return s.slice(i, j + 1); }

test('refreshCompanies 정렬은 숫자 createdAt 이 섞여도 최신순으로 줄 세운다', () => {
  const cm = cutFn(src, 'function CompanyManagement(');
  const fn = cutFn(cm, 'function refreshCompanies(');
  let got = null;
  const ctx = {
    dbGet: () => [
      { id: 'a', name: '가나상사', createdAt: '2026-01-05T00:00:00.000Z' },
      { id: 'b', name: '다라식품', createdAt: Date.parse('2026-10-10T03:46:00Z') },
      { id: 'c', name: '마바건설' },
    ],
    arvSort: (a, b, f) => f(a, b),
    setCompanies: (v) => { got = v; },
  };
  vm.createContext(ctx);
  vm.runInContext(fn, ctx);
  assert.doesNotThrow(() => ctx.refreshCompanies());
  assert.deepEqual(Array.from(got).map(x => x.id), ['b', 'a', 'c']);
});
