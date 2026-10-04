/* 입금관리 「fin/income 렌더링 오류 — Cannot read properties of undefined (reading 'date')」 (2026-10-02 대표 보고)

   ★ 까닭: 한 칸이 «받았다»인지는 isPaid 가, 그 입금 한 건은 getItem 이 찾는데 잣대가 달랐다.
     isPaid  — advisoryYm(받을 달) 먼저, 없으면 입금일의 달
     getItem — 입금일의 달로만
     → 3월 자문료가 4월 9일에 들어오면(advisoryYm 2026-03) 3월 칸은 «받음»인데 그 건을 못 찾아
       item.date 에서 업체입금 화면 «전체»가 멈췄다. 실데이터에 이런 건이 17건 있었다.

   이 검사가 박는 것은 «두 함수가 같은 건을 가리킨다»는 규칙이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const erp = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

/* IncomeCompanyTab 안의 함수를 중괄호 짝으로 자른다 */
function sliceFn(head) {
  const tab = erp.indexOf('function IncomeCompanyTab(');
  const at = erp.indexOf(head, tab);
  assert.ok(tab > 0 && at > tab, head + ' 를 찾지 못했습니다');
  let i = erp.indexOf('{', at), d = 0;
  for (; i < erp.length; i++) {
    if (erp[i] === '{') d++;
    else if (erp[i] === '}' && --d === 0) break;
  }
  return erp.slice(at, i + 1);
}

function load(incomes) {
  const ctx = { incomes, selYear: 2026 };
  vm.createContext(ctx);
  /* 「그 회사 줄인가」는 incomeIsCo 한 곳이 정한다(2026-10-04 업체 번호로 견주기) — 탭 밖 함수라 따로 싣는다 */
  const ic = erp.indexOf('function incomeIsCo(');
  let j = erp.indexOf('{', ic), d = 0;
  for (; j < erp.length; j++) { if (erp[j] === '{') d++; else if (erp[j] === '}' && --d === 0) break; }
  vm.runInContext(erp.slice(ic, j + 1) + '\n' + sliceFn('function isPaid(') + '\n' + sliceFn('function getItem('), ctx);
  return ctx;
}

test('★★★ «받음»으로 보이는 달은 getItem 도 그 입금을 찾는다 — 늦게 들어온 자문료', () => {
  const ctx = load([
    { id: 'i1', companyName: '가나상사', sourceKind: 'company', date: '2026-04-09 14:11:11', advisoryYm: '2026-03', amount: 330000 },
    { id: 'i2', companyName: '가나상사', sourceKind: 'company', date: '2026-05-10', amount: 330000 },
  ]);
  for (const m of [1, 2, 3, 4, 5, 6]) {
    if (ctx.isPaid('가나상사', m)) {
      assert.ok(ctx.getItem('가나상사', m), '★★★ ' + m + '월이 «받음»인데 그 입금을 못 찾습니다 — 입금관리 화면이 멈춥니다');
    }
  }
  assert.equal(ctx.getItem('가나상사', 3).id, 'i1', '받을 달(advisoryYm)로 찾는다');
  assert.equal(ctx.getItem('가나상사', 4), undefined, '★ 입금일의 달(4월)에는 3월 몫을 붙이지 않는다');
  assert.equal(ctx.getItem('가나상사', 5).id, 'i2', 'advisoryYm 이 없으면 입금일의 달');
});

test('★★ 칸 말풍선은 item 이 없어도 멈추지 않는다', () => {
  const body = erp.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(body, /:\s*paid\s*\n\s*\?\s*\(item\.date/, '★★ paid 만 보고 item.date 를 읽으면 다시 멈출 수 있습니다 — paid && item 으로');
});
