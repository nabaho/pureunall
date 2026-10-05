'use strict';
/* 업무유형 정리 2단계 (대표 2026-10-05 「순서대로」) — 현장클리닉·기술보호를 «이름 글자»가 아니라
   유형의 «역할 칸(role)»으로 알아본다. 이름을 고쳐도 일수표·회차표·단가가 그 유형을 찾는다.

   못 박는 것(규칙):
   ① role 이 적혀 있으면 이름과 상관없이 그 역할이다 · 'none' 은 사람의 결정이라 짐작하지 않는다
   ② role 이 없는 옛 사전은 씨앗 번호 → 이름 순으로 «짐작»한다(지금까지의 모습 그대로)
   ③ 굳히기(bizTypeStampRoles)는 role 이 없고 짐작이 서는 항목에만 찍는다 · 원본은 안 바꾼다
   ④ 일수표·회차표·단가·단위·「현장클리닉 건인가」 판정이 모두 역할로 알아본다 — 이름 정규식이 남지 않는다
   ⑤ 기업정보함의 사건 이름은 사전(번호)에서 «지금 이름»을 읽고, 못 찾을 때만 복사본을 쓴다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const erp = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const cards = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function body(s, head) {
  const i = s.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = s.indexOf('{', i); k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); }
  }
  throw new Error('괄호가 안 닫힘: ' + head);
}
function line(s, re) { const m = re.exec(s); assert.ok(m, '못 찾음: ' + re); return m[0]; }

function roleCtx(types) {
  const c = { Object, String, dbGet: (k, d) => (k === 'biz_cons_types' ? types : d), BIZ_CONS_SEED: [] };
  vm.createContext(c);
  vm.runInContext([
    line(erp, /var CONS_ROLE_SEED = \{[^}]*\};/),
    line(erp, /var CONS_ROLE_LABEL = \{[^}]*\};/),
    body(erp, 'function consNameKey('),
    body(erp, 'function consTypeRole('),
    body(erp, 'function consRoleOf('),
    body(erp, 'function bizTypeStampRoles('),
    body(erp, 'function clinicIsType('),
    body(erp, 'function techIsType('),
  ].join('\n'), c);
  return c;
}

test('①★ role 이 적혀 있으면 이름을 고쳐도 그 역할이다', () => {
  const c = roleCtx([]);
  assert.equal(c.consTypeRole({ code: 'k1', name: '클리닉(이름 고침)', role: 'clinic' }), 'clinic');
  assert.equal(c.consTypeRole({ code: 'k2', name: '통합지원단', role: 'tech' }), 'tech');
});
test('① role 이 none 이면 이름이 현장클리닉이어도 짐작하지 않는다', () => {
  const c = roleCtx([]);
  assert.equal(c.consTypeRole({ code: 'k', name: '현장클리닉', role: 'none' }), '');
});
test('② role 이 없는 옛 사전은 씨앗 번호 → 이름으로 짐작한다(지금까지와 같다)', () => {
  const c = roleCtx([]);
  assert.equal(c.consTypeRole({ code: 'cons-clinic', name: '아무 이름' }), 'clinic');
  assert.equal(c.consTypeRole({ code: 'consulting-mp0w1084', name: '현장클리닉' }), 'clinic');
  assert.equal(c.consTypeRole({ code: 'consulting-mp0wogrl', name: '통합기술보호지원단' }), 'tech');
  assert.equal(c.consTypeRole({ code: 'x', name: '일터혁신상생컨설팅' }), '');
});
test('③ 굳히기는 role 없고 짐작이 서는 항목에만 찍고, 원본은 안 바꾼다', () => {
  const c = roleCtx([]);
  const list = [{ code: 'a', name: '현장클리닉' }, { code: 'b', name: '일터' }, { code: 'c', name: '현장클리닉', role: 'none' }];
  const out = c.bizTypeStampRoles(list);
  assert.equal(out[0].role, 'clinic');
  assert.equal(out[1].role, undefined);
  assert.equal(out[2].role, 'none');
  assert.equal(list[0].role, undefined, '원본은 안 바꾼다');
});
test('④★ 일수표·회차표는 역할로 알아본다 — 이름을 고친 유형도 찾는다', () => {
  const types = [{ code: 'k1', name: '클리닉', role: 'clinic' }, { code: 'k2', name: '지원단', role: 'tech' }];
  const c = roleCtx(types);
  assert.equal(c.clinicIsType('k1', types), true);
  assert.equal(c.techIsType('k2', types), true);
  assert.equal(c.clinicIsType('k2', types), false);
  assert.equal(c.clinicIsType('cons-clinic', []), true, '씨앗 번호는 사전이 없어도 안다');
});
test('④★ 단가·단위·「현장클리닉 건인가」 판정에 이름 정규식이 남지 않는다', () => {
  for (const fn of ['function consTypeDayFee(', 'function consTypeDayOpt(', 'function clinicIsType(', 'function techIsType(']) {
    const b = strip(body(erp, fn));
    assert.doesNotMatch(b, /\/기술보호\/|=== '현장클리닉'/, fn + ' 가 아직 이름 글자로 알아본다');
  }
  const isClinic = strip(body(erp, 'function erpIsClinicItem('));
  assert.match(isClinic, /consRoleOf\(/, '유형 번호가 있으면 역할로 본다');
  const card = strip(body(erp, 'function BizTypeCard('));
  assert.doesNotMatch(card, /\/기술보호\/\.test/, '유형 카드의 단위 칩도 역할로 본다');
});
test('④ 환경설정 ✏ 에서 셈 묶음(역할)을 정할 수 있다', () => {
  const ed = strip(body(erp, 'async function editType('));
  assert.match(ed, /nx\.role\s*=\s*roleIn/);
});

function cardsCtx() {
  const c = { Object, String, Array };
  vm.createContext(c);
  vm.runInContext([
    line(cards, /const ERP_TYPE_KEYS = \{[^}]*\};/),
    body(cards, 'function erpTypeCodeOf('),
    body(cards, 'function erpTypeNameFrom('),
    'const ERP_CONTRACT_KIND = {};',
    body(cards, 'function erpHistName('),
  ].join('\n'), c);
  return c;
}
test('⑤★ 기업정보함 사건 이름은 사전의 «지금 이름» — 환경설정에서 고친 이름이 따라온다', () => {
  const c = cardsCtx();
  const rec = { _kind: 'case', typeCode: 'case-1', typeName: '옛 이름' };
  assert.equal(c.erpHistName(rec, { case: [{ code: 'case-1', name: '새 이름' }] }), '새 이름');
});
test('⑤ 사전에 없으면(옛 기록·사전 못 읽음) 복사된 이름을 쓴다', () => {
  const c = cardsCtx();
  assert.equal(c.erpHistName({ _kind: 'case', typeCode: 'gone', typeName: '옛 이름' }, { case: [] }), '옛 이름');
  assert.equal(c.erpHistName({ _kind: 'case', typeName: '번호 없음' }, {}), '번호 없음');
});
test('⑤ 기업정보함이 사건 사전을 읽는다', () => {
  assert.match(cards, /kind:'case',\s*store:'cases',\s*types:'biz_case_types'/);
});
