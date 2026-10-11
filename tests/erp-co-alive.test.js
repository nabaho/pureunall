/* «살아 있는 업체» 판정 하나 — erpCoAlive (2026-10-11 검토 §6)
   실행: node --test tests/erp-co-alive.test.js

   ── 지키는 규칙 ──
   종료(closed)·휴지통(_deleted) 업체는
     · 사무대행·계약 중단 탭과 그 건수(탭 옆·대시보드)에 안 나온다
     · 세무사 «보수총액 신고자료 요청» 메일 명단(buildTaxGroups)에 안 들어간다 — 외부로 나가는 메일
     · 「세무사 메일 없는 곳」 목록, 보수총액 엑셀 맞추기 대상(agents)에 안 들어간다
   그러나 종료할 때 isSuboffice·suspended 를 «지우지 않는다» — 복원하면 원래 자리로 돌아가야 한다.
   종료 탭에는 그대로 보인다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const CM = strip(cutFn(src, 'function CompanyManagement('));

function ctxWith(code, extra){
  const ctx = Object.assign({ console }, extra || {});
  vm.createContext(ctx);
  vm.runInContext(cutFn(src, 'function erpCoAlive(') + '\n' + code, ctx);
  return ctx;
}

test('erpCoAlive — 종료·휴지통은 죽은 업체, 나머지는 산 업체', () => {
  const C = ctxWith('');
  assert.equal(C.erpCoAlive({ status: 'active' }), true);
  assert.equal(C.erpCoAlive({ status: 'suboffice' }), true);
  assert.equal(C.erpCoAlive({ status: 'closed' }), false);
  assert.equal(C.erpCoAlive({ status: 'active', _deleted: true }), false);
  assert.equal(C.erpCoAlive(null), false);
});

test('사무대행·계약 중단 탭 — 종료·휴지통 업체는 안 나오고, 종료 탭에는 그대로', () => {
  const C = ctxWith('var statusTab = "active";\n' + cutFn(src, 'function coInTab(')
    + '\nthis.coInTab = coInTab; this.setTab = function(t){ statusTab = t; };');
  const closedSub = { status: 'closed', isSuboffice: true, suspended: true };
  const trashedSub = { status: 'active', isSuboffice: true, suspended: true, _deleted: true };
  C.setTab('suboffice');
  assert.equal(C.coInTab({ status: 'active', isSuboffice: true }), true);
  assert.equal(C.coInTab(closedSub), false, '★ 종료한 겸업 업체가 사무대행 탭에 남습니다');
  assert.equal(C.coInTab(trashedSub), false, '★ 휴지통 업체가 사무대행 탭에 남습니다');
  C.setTab('suspended');
  assert.equal(C.coInTab({ status: 'active', suspended: true }), true);
  assert.equal(C.coInTab(closedSub), false, '★ 종료 업체가 계약 중단 탭에 남습니다');
  C.setTab('closed');
  assert.equal(C.coInTab(closedSub), true, '종료 탭에서는 그대로 보여야 합니다');
});

test('세무사 메일 명단 — 종료·휴지통 업체는 받는 목록에 안 들어간다', () => {
  const companies = [
    { id: 'a', name: '산 업체', status: 'suboffice', taxEmail: 'tax@x.kr' },
    { id: 'b', name: '종료 업체', status: 'closed', isSuboffice: true, taxEmail: 'tax@x.kr' },
    { id: 'c', name: '휴지통 업체', status: 'suboffice', _deleted: true, taxEmail: 'tax@x.kr' },
    { id: 'd', name: '종료만', status: 'closed', isSuboffice: true, taxEmail: 'only-closed@x.kr' },
  ];
  const C = ctxWith(cutFn(src, 'function buildTaxGroups('), { companies });
  const groups = Array.from(C.buildTaxGroups());
  const names = [].concat.apply([], groups.map((g) => Array.from(g.cos, (c) => c.name)));
  assert.deepEqual(names, ['산 업체'], '★ 끝난 업체 자료를 세무사에게 요청하는 메일이 나갑니다');
  assert.ok(!groups.some((g) => g.email === 'only-closed@x.kr'), '★ 종료 업체만 맡은 세무사에게도 메일이 갑니다');
});

test('건수·엑셀 맞추기·메일 없는 곳 — 사무대행·중단을 세는 자리마다 erpCoAlive 를 먼저 거친다', () => {
  /* isSuboffice / suspended 를 보는 거르기 식에 erpCoAlive 가 함께 있는지 — 자리 수가 늘어도 규칙은 같다 */
  const subFilters = CM.match(/companies\.filter\(function\((\w+)\)\{[^}]*isSuboffice[^}]*\}\)/g) || [];
  assert.ok(subFilters.length >= 3, '사무대행 거르기 자리를 못 찾음(건수·엑셀 agents·메일 없는 곳)');
  subFilters.forEach((f) => assert.match(f, /erpCoAlive\(/, '★ 종료 업체를 세는 자리: ' + f.slice(0, 80)));
  /* «중단인 곳을 센다»(!!x.suspended)만 — «중단이 아닌 곳»을 고르는 식(!x.suspended)은 대상이 아니다 */
  const susFilters = CM.match(/companies\.filter\(function\((\w+)\)\{[^}]*!!\w+\.suspended[^}]*\}\)/g) || [];
  assert.ok(susFilters.length >= 1, '계약 중단 건수 자리를 못 찾음');
  susFilters.forEach((f) => assert.match(f, /erpCoAlive\(/, '★ 종료 업체를 세는 자리: ' + f.slice(0, 80)));
});

test('종료할 때 isSuboffice·suspended 를 지우지 않는다 — 복원 때 원래 자리로', () => {
  const fn = strip(cutFn(src, 'async function confirmCloseCompany('));
  assert.equal(/isSuboffice\s*:/.test(fn), false, '★ 종료가 사무대행 표시를 지웁니다 — 복원하면 사무대행이 사라집니다');
  assert.equal(/suspended\s*:/.test(fn), false, '★ 종료가 계약 중단 표시를 지웁니다');
});
