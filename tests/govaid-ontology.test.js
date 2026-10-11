/* 정부지원금 — 온톨로지 등록부·사전·저장 계약 (2026-10-11)
   ★ 새 앱은 관문이 강제(enforce)다. 등록이 빠지면 화면의 저장이 전부 거절된다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../js/pu-ontology.js');
const W = require('../js/pu-ontology-write.js');

test('정부지원금이 등록부에 있고 쓰는 자리 넷을 선언한다', () => {
  const g = O.PROGRAMS.govaid;
  assert.ok(g, 'PROGRAMS.govaid 가 없다');
  assert.equal(g.file, 'pu-govaid.html');
  assert.deepEqual(g.primaryRoots, ['govaid']);
  const paths = g.writeContracts.map((w) => w.path);
  ['programs', 'prospects', 'extras', 'reviews'].forEach((k) =>
    assert.ok(paths.some((p) => p.indexOf('govaid/' + k + '/') === 0), k + ' 쓰기 계약이 없다'));
  g.writeContracts.forEach((w) => assert.ok(g.entityTypes.indexOf(w.entityType) >= 0, w.path));
});

test('새 개체 둘과 관계어가 사전에 있다', () => {
  assert.ok(O.TERMS.entityTypes.SupportProgram);
  assert.ok(O.TERMS.entityTypes.EligibilityReview);
  assert.deepEqual(O.TERMS.predicates.assessesProgram, ['EligibilityReview', 'SupportProgram']);
  assert.ok(O.TERMS.predicates.forOrganization[0].split('|').indexOf('EligibilityReview') >= 0);
});

test('통합 진단은 이 자리를 읽지 않는다 — 앱 안에서만(in_app)', () => {
  const a = Object.values(O.READ_ADAPTERS).find((x) => x.program === 'govaid');
  assert.ok(a, 'READ_ADAPTERS 에 govaid 가 없다');
  assert.equal(a.strategy, 'in_app');
});

test('모든 새 프로그램의 저장 계약이 갖춰져 있다', () => {
  assert.equal(W.auditProgramContracts(O.PROGRAMS).ok, true);
});

test('지원사업 레코드가 강제 관문을 통과한다', () => {
  const p = W.prepareRecord({ id: 'gp-r71', name: '시험' }, { entityType: 'SupportProgram', now: 1, actor: 'A-001' });
  assert.equal(p.ok, true, JSON.stringify(p.issues));
  const r = W.prepareRecord({ id: 'co_c1__gp-r71', companyId: 'c1', programId: 'gp-r71', decision: 'yes' },
    { entityType: 'EligibilityReview', now: 1, actor: 'A-001' });
  assert.equal(r.ok, true, JSON.stringify(r.issues));
});
