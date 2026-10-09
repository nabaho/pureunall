'use strict';
/* 사건계약 — 이알피 환경설정 사건 유형 · 근로자측/사용자측 · 위임장 {{공인노무사명단}} (대표 지시 2026-10-09) — 가짜 자료만 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/pu-contract-forms.js'), 'utf8').replace(/\r\n/g, '\n');
const CF = require('../js/pu-form-cardfill.js');
const D = require('../js/esign-docs.js');
const T = require('../js/esign-hwp-tpl.js');
global.window = global.window || {};
require('../js/pu-contract-forms.js');
const C = global.window.PuContractForms;
const TYPES = [{ code: 'case-a1', short: '부해등', name: '부당해고등노동위원회대리(노사)', sortOrder: 40 },
  { code: 'case-a2', short: '임금체불', name: '임금퇴직금기타체불노동부대리(노사)', sortOrder: 10 },
  { code: 'case-a3', short: '대지급금', name: '간이등대지급금대리', sortOrder: 20 }];

test('ⓐ 사건 유형은 이알피 설정을 따른다', () => {
  assert.deepStrictEqual(C.setCaseTypes({ v: TYPES }), ['임금체불', '대지급금', '부해등'], 'sortOrder 차례 · 약어');
  assert.equal(C.caseShortOf('부당해고등노동위원회대리(노사)'), '부해등');
  assert.equal(C.caseShortOf('case-a2'), '임금체불');
  assert.equal(C.caseShortOf('체당금'), '대지급금', '옛 이름');
  const forms = [{ id: 'x1', kind: 'case', name: '위임약정서', groupName: '체당금' }, { id: 'x2', kind: 'case', name: '부해 위임', groupName: '부해등' },
    { id: 'x3', kind: 'case', name: '공통 위임장' }];
  const fc = C.facetCounts(forms, 'case', 'all');
  assert.deepStrictEqual(fc.groups.map((g) => g.name + ':' + g.count), ['임금체불:0', '대지급금:1', '부해등:1', '(미지정):1'], '유형은 모두 칩(0개도) · 옛 체당금 → 대지급금');
  assert.deepStrictEqual(C.contractPick(forms, { kinds: ['case'], caseName: '부당해고등노동위원회대리(노사)' }), ['x2'], '이알피 사건 유형 이름으로 갈래를 찾는다');
  assert.deepStrictEqual(C.contractPick(forms, { kinds: ['case'], caseName: '간이등대지급금대리' }), ['x1']);
  C.setCaseTypes([]);
  assert.deepStrictEqual(C.caseTypeList(), C.CASE_TYPES, '못 읽으면 옛 기본');
  assert.match(SRC, /soft\('data\/biz_case_types'\), soft\('data\/user_dir'\)/, '화면이 이알피 설정·명부를 읽는다(못 읽어도 뜬다)');
});

test('ⓑ 근로자측 · 사용자측', () => {
  assert.match(SRC, /if \(k\.v === 'case'\) \[\['worker', '👷 근로자측'\], \['employer', '🏢 사용자측'\]\]\.forEach/);
  assert.match(SRC, /setFilter\(\{ side: sd\[0\], grp: 'all' \}\)/);
});

test('ⓒ 재직 공인노무사 전원', () => {
  const dir = { a: { sid: 'P-003', name: '박한별', title: '노무사', status: 'active' }, b: { sid: 'P-001', name: '권 형 하', title: '대표노무사', status: 'active' },
    c: { sid: 'P-002', name: '퇴직자', title: '노무사', status: 'retired' }, d: { sid: 'A-001', name: '직원', title: '노무사보', status: 'active' },
    e: { sid: 'T-009', name: '옛노무사', title: '노무사', status: 'retired' }, f: { sid: 'P-009', name: '휴직자', position: '노무사', status: 'leave' } };
  assert.equal(CF.lawyersLine(dir), '대표 공인노무사 권형하, 공인노무사 박한별·휴직자', '대표 먼저 · 퇴직·직원 빼고 · 휴직은 재직');
  assert.equal(CF.lawyersLine([]), '');
  CF.setLawyers('');
  assert.equal(CF.valuesFrom({}).공인노무사명단, CF.LAWYERS_FALLBACK, '명부를 못 읽으면 기본 명단');
  CF.setLawyers(dir);
  assert.equal(CF.valuesFrom({}).공인노무사명단, '대표 공인노무사 권형하, 공인노무사 박한별·휴직자');
  assert.equal(CF.valuesFrom({ lawyers: '가' }).공인노무사명단, '가');
  assert.equal(T.valuesOf({}, {}, {}).공인노무사명단, CF.lawyersNow ? T.valuesOf({}, {}, {}).공인노무사명단 : '');
  assert.equal(T.valuesOf({}, { _lawyers: '나' }, {}).공인노무사명단, '나');
  assert.match(D.ESIGN_FORMS.delegation.body, /성         명 : \{\{공인노무사명단\}\}\n/, '위임장 기본 문구 — 이름을 박아 두지 않는다');
  assert.doesNotMatch(D.ESIGN_FORMS.delegation.body, /권 형 하|박 한 별/);
  const seed = C.CHEDANG.filter((f) => f.id === 'fm-case-cd-02')[0];
  assert.match(seed.body, /\{\{공인노무사명단\}\}/, '체당금 위임장 시드도');
  assert.ok(C.VARS.some((v) => v.code === '{{공인노무사명단}}'), '표지 목록에');
  CF.setLawyers('');
});
