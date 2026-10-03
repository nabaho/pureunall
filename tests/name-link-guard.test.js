'use strict';
/* 이름으로 잇는 길 막기 (대표 지시 2026-10-03 「근본적으로」 → 2단계)

   못 박는 것(규칙):
   ① 새 사건 저장 — 업체 번호·사업자번호로만 업체를 붙인다. 이름만 맞으면 붙이지 않는다
      (그 사건은 「🔗 업체 연결」에 올라가 사람이 확정한다).
   ② 보수총액 엑셀 — 사업자번호가 먼저. 이름은 «딱 하나»일 때만. 둘 이상이면 건너뛰고 센다.
   ③ 계약창 명함 고르기 — 같은 이름에 사업자번호가 다른 등록증이 둘 이상이면 사업자번호를 미리 채우지 않는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function block(startText) {
  const at = SRC.indexOf(startText);
  assert.ok(at >= 0, startText + ' 를 못 찾았다');
  let i = SRC.indexOf('{', at), d = 0;
  for (; i < SRC.length; i++) { if (SRC[i] === '{') d++; else if (SRC[i] === '}') { d--; if (d === 0) break; } }
  return SRC.slice(at, i + 1);
}
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

function refBox(companies, archive) {
  const b = { String, Object, dbGet: (k, d) => (k === 'companies' ? companies : k === 'closed_archive' ? (archive || []) : d) };
  vm.createContext(b);
  vm.runInContext(block('var CompanyRef = {') + ';\nthis.CompanyRef = CompanyRef;', b);
  return b.CompanyRef;
}

test('★★ 새 사건 — 이름만 맞으면 업체를 붙이지 않는다', () => {
  const R = refBox([{ id: 'co-1', name: '㈜가나상사', bizNo: '123-45-67890' }]);
  const c = R.attachId({ companyName: '가나상사' });
  assert.equal(c.companyId, undefined, '이름만 보고 업체 번호를 붙였다');
  assert.equal(c.bizNo, undefined, '이름만 보고 사업자번호를 붙였다');
});

test('★ 새 사건 — 사업자번호가 맞으면 붙이고, 이미 있는 번호는 그대로', () => {
  const R = refBox([{ id: 'co-1', name: '가나상사', bizNo: '123-45-67890' }]);
  assert.equal(R.attachId({ companyName: '전혀 다른 이름', bizNo: '1234567890' }).companyId, 'co-1');
  assert.equal(R.attachId({ companyId: 'co-9', companyName: '가나상사' }).companyId, 'co-9');
  /* 종료 보관함도 «이름으로»는 안 붙는다 */
  const R2 = refBox([], [{ id: 'arc-1', companyName: '가나상사', original: { name: '가나상사' } }]);
  assert.equal(R2.attachId({ companyName: '가나상사' }).companyId, undefined);
});

test('★ 사건 저장 길은 여전히 attachId 를 거친다(번호로는 이어지게)', () => {
  assert.match(bare(SRC), /CompanyRef\.attachId\(newCase\);/);
});

function fnBox(name) {
  const b = { String, Object };
  vm.createContext(b);
  vm.runInContext(block('function ' + name + '('), b);
  return b[name];
}

test('★★ 보수총액 — 사업자번호가 이름보다 먼저다', () => {
  const m = fnBox('coWageRowMatch');
  const agents = [{ id: 'a', name: '가나상사', bizNo: '111-11-11111' }, { id: 'b', name: '다라상사', bizNo: '222-22-22222' }];
  /* 이름은 가나상사인데 번호는 다라상사 — 번호가 이긴다 */
  assert.equal(m(agents, '가나상사', '2222222222').co.id, 'b', '이름을 먼저 봤다');
  assert.equal(m(agents, '가나상사', '').co.id, 'a');
});

test('★★ 보수총액 — 같은 이름이 둘 이상이면 건너뛰고 «건너뜀»을 알린다', () => {
  const m = fnBox('coWageRowMatch');
  const agents = [{ id: 'a', name: '㈜가나상사' }, { id: 'b', name: '가나상사' }];
  const r = m(agents, '가나상사', '');
  assert.equal(r.co, null, '같은 이름 중 하나를 골랐다');
  assert.equal(r.amb, true);
  assert.equal(m(agents, '없는회사', '').amb, false);
  const imp = bare(block('function importWageXlsx('));
  assert.match(imp, /coWageRowMatch\(agents,\s*nm,\s*bz\)/, '엑셀 가져오기가 새 잣대를 안 쓴다');
  assert.match(imp, /ambN/, '건너뛴 줄 수를 안 알린다');
});

test('★★ 계약창 — 같은 이름에 다른 사업자번호의 등록증이 둘이면 그 이름은 비운다', () => {
  const f = fnBox('pcBizByName');
  const norm = (s) => String(s || '').replace(/\s|㈜/g, '');
  const r = f({
    a: { k: 'biz', c: '가나상사', bz: '1111111111' },
    b: { k: 'biz', c: '㈜가나상사', bz: '2222222222' },
    c: { k: 'biz', c: '다라상사', bz: '3333333333' },
    d: { k: 'biz', c: '다라상사', bz: '333-33-33333' },
    e: { k: 'card', c: '마바상사', bz: '4444444444' },
  }, norm);
  assert.equal(r.by['가나상사'], undefined, '사업자번호가 다른 같은 이름 중 하나를 골랐다');
  assert.equal(r.amb['가나상사'], true);
  assert.equal(r.by['다라상사'].bz, '3333333333', '같은 번호의 등록증 여러 장은 같은 회사다');
  assert.equal(r.idOf['다라상사'], 'c');
  assert.equal(r.by['마바상사'], undefined, '명함 줄을 등록증으로 쳤다');
});

test('★ 계약창 두 곳 모두 새 표를 쓴다 — 옛 «마지막 것이 이김» 표가 남지 않았다', () => {
  const s = bare(SRC);
  assert.equal((s.match(/pcBizByName\(idx,/g) || []).length >= 2, true, '두 곳 중 한 곳이 새 표를 안 쓴다');
  assert.doesNotMatch(s, /bizByCo\[normCo\(r\.c\)\]\s*=\s*r/);
  assert.doesNotMatch(s, /bizByCo\[pcNormCo\(r\.c\)\]\s*=\s*r/);
});
