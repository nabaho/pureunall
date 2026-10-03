/* 입금관리 › 업체입금 — 사업장 칸에는 «이름만» (대표 지시 2026-10-03)

   「사업자 이름 옆에 자문 금액 입금일 이 두번있다 이미 셀레 구분되어 있는 부분은 모두 빼라
    대신 자문이나 급여 등은 별도 셀을 만들어서 열을 만들어 줄 수 있나?」

   ★ 금액은 「입금액」 칸, 자동이체일은 「CMS」 칸, 납부일은 입금액 옆에 이미 있다.
     이름 옆에 또 그리면 같은 것이 두 번 보이고 이름만 잘린다.
   ★ 업체 종류(자문·급여대행…)는 따로 칸이 없었으므로 「구분」 칸을 둔다.
   이 검사는 글자 크기·폭을 박지 않는다. 박는 것은 «무엇을 어느 칸에» 라는 규칙이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const erp = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const body = erp.replace(/\/\*[\s\S]*?\*\//g, '');
const tab = body.slice(body.indexOf('function IncomeCompanyTab('));
const rowAt = tab.indexOf(':SOURCE_LIST.map(function(co,idx){');
const row = tab.slice(rowAt, tab.indexOf('MONTHS.map(function(m){', rowAt));

test('★★ 사업장 칸에 금액·납부일·CMS 를 덧붙이지 않는다', () => {
  assert.ok(rowAt > 0, '업체입금 줄을 찾지 못했습니다');
  assert.doesNotMatch(row, /'🏦CMS · '|'납부 '\+co\.payDay/, '★★ 이름 옆에 CMS·납부일을 또 그리면 같은 것이 두 번 보입니다');
  assert.doesNotMatch(row, /co\.fee\)\.toLocaleString\(\)\+'원 · '/, '★★ 금액은 「입금액」 칸에 이미 있습니다');
});

test('★★ 업체 종류는 「구분」 칸에 따로 — 머리줄과 몸통 칸 수가 맞는다', () => {
  const head = tab.slice(tab.indexOf("h('thead'"), tab.indexOf("h('tbody'"));
  const ths = head.split("h('th',").length - 1 - 1;              // MONTHS 의 th 한 개 빼기
  assert.match(head, /'구분'/, '★★ 「구분」 머리칸이 없습니다');
  assert.match(row, /TYPE_LABEL\[co\.typeCode\]/, '★★ 구분 칸에 업체 종류를 그려야 합니다');
  const cols = tab.slice(tab.indexOf("h('colgroup'"), tab.indexOf("h('thead'")).split("h('col',").length - 1 - 1;
  assert.equal(cols, ths, '★ 칸 폭(col) 수와 머리칸(th) 수가 어긋나면 칸이 밀립니다');
  const span = (tab.match(/colSpan:(\d+),style:\{textAlign:'center',color:'#94a3b8',padding:'40px'\}/) || [])[1];
  assert.equal(Number(span), ths + 12, '★ 빈 표 안내 칸은 머리칸 수 + 12달');
});
