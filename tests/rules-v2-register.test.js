/* 취업규칙(새) 온톨로지 등록 — Task 7.
   새 프로그램은 포털에 걸리기 «전에» 사전·등록부에 있어야 하고, 쓰는 자리를 스스로 선언해야 한다
   (선언 없이는 관문이 enforce 로 저장을 거절한다). 포털 APPS 줄은 앱 파일이 생기는 Task 10 에서 걸었다가,
   두 앱 합치기(2026-10-04)로 다시 걷었다 — 타일은 rules 하나, 이 앱은 portal:false 로 «등록만» 남는다
   (tests/rules-merge.test.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../js/pu-ontology.js');

test('새 개체 둘이 사전에 있다', () => {
  assert.ok(O.TERMS.entityTypes.RulesDocument);
  assert.ok(O.TERMS.entityTypes.RulesRound);
});

test('새 앱이 등록돼 있고 쓰는 자리를 선언했다', () => {
  const p = O.PROGRAMS.rulesv2;
  assert.equal(p.file, 'rules-v2.html');
  const paths = p.writeContracts.map((w) => w.path);
  assert.ok(paths.includes('rules_mgmt/library/human/{id}'));
  assert.ok(paths.includes('rules_mgmt/library/rounds/{id}'));
  assert.ok(!paths.some((x) => /library\/(docs|text|seen|run)/.test(x)), '★ 서버 칸을 화면이 쓰겠다고 선언했다');
});

test('읽기 어댑터는 in_app — 고객사 규칙 원문을 통합 진단이 읽지 않는다', () => {
  const a = O.READ_ADAPTERS.rulesv2_core;
  assert.equal(a.program, 'rulesv2');
  assert.equal(a.strategy, 'in_app');
});
