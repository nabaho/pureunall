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
  assert.equal(CF.lawyersLine(dir), '대표 공인노무사 권형하, 공인노무사 박한별', '대표 먼저 · 퇴직·직원·휴직(명부 상태) 빼고');
  assert.equal(CF.lawyersLine([]), '');
  CF.setLawyers('');
  assert.equal(CF.valuesFrom({}).공인노무사명단, CF.LAWYERS_FALLBACK, '명부를 못 읽으면 기본 명단');
  CF.setLawyers(dir);
  assert.equal(CF.valuesFrom({}).공인노무사명단, '대표 공인노무사 권형하, 공인노무사 박한별');
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

/* ⓓ 퇴사·휴직하면 자동으로 빠진다 · 이름표 없는 위임장도 (대표 지시 2026-10-10) */
test('ⓓ 휴직 · 이름표 없는 위임장 · 회사 계약', () => {
  const dir = [{ sid: 'P-001', name: '권형하', title: '대표노무사', status: 'active' }, { sid: 'P-003', name: '박한별', title: '노무사', status: 'active' },
    { sid: 'P-004', name: '김혜민', title: '노무사', status: 'active' }];
  const loa = [{ sid: 'P-004', status: 'active', startDate: '2026-10-01', endDate: '2027-03-31' }, { sid: 'P-003', status: 'active', startDate: '2026-01-01', endDate: '2026-06-30' },
    { sid: 'P003', status: 'pending', startDate: '2026-10-01' }];
  assert.equal(CF.lawyersLine(dir, loa, '2026-10-10'), '대표 공인노무사 권형하, 공인노무사 박한별', '오늘 휴직 중이면 빠진다(지난 휴직·신청 중은 아니다)');
  assert.equal(CF.lawyersLine(dir, loa, '2027-04-01'), '대표 공인노무사 권형하, 공인노무사 박한별·김혜민', '복직하면 다시 들어간다');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(CF.onLeaveSet([{ sid: 'P-009', status: 'active', startDate: '2026-10-01' }], '2026-10-10'))), { P009: 1 }, '끝 날짜 없으면 계속 휴직');
  const L = '대표 공인노무사 권형하, 공인노무사 박한별';
  const e = JSON.parse(JSON.stringify(T.lawyerLineEdits([{ key: 5, text: '  성        명 : 대표 / 공인노무사   권 형 하' }, { key: 6, text: '                 공인노무사  장 한 돌' },
    { key: 7, text: '                 공인노무사 박 성 수' }, { key: 8, text: '' }, { key: 9, text: '상기인을 공인노무사법 제2조' }], L)));
  assert.deepStrictEqual(e, [{ key: 5, text: '  성        명 : ' + L }, { key: 6, text: '' }, { key: 7, text: '' }], '이름 줄은 명단으로, 밑의 옛 이름 줄은 비운다');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLineEdits([{ key: 1, text: '성 명 : 공인노무사 권 형 하' }], L))).map((x) => x.text), ['성 명 : ' + L]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLineEdits([{ key: 1, text: '대리인 성명 : 홍길동' }], L))), [], '노무사 줄이 아니면 건드리지 않는다');
  const H = fs.readFileSync(path.join(__dirname, '..', 'docs-esign.html'), 'utf8');
  assert.match(H, /EsignHwpTpl\.applyLawyerLine\(doc, lawLine\); r = EsignHwpTpl\.fillDoc\(doc, V\);/, '계약서 양식 채우기에서');
  assert.match(H, /EsignHwpTpl\.applyLawyerLine\(doc, V\.공인노무사명단\);/, '집단체불 서류에서');
  assert.match(H, /softGet\('data\/user_dir'\), softGet\('data\/leave_of_absence'\)/);
  assert.match(SRC, /soft\('data\/user_dir'\), soft\('data\/leave_of_absence'\)/);
  const list = [{ id: 'c1', contractNo: 'C-1', companyName: '(주)가나상사', signDate: '2025-01-01' }, { id: 'c2', contractNo: 'C-2', bizNo: '123-45-67890', companyName: '다른이름', signDate: '2026-01-01' },
    { id: 'c3', contractNo: 'C-3', companyName: '라마', signDate: '2026-05-01' }];
  assert.deepStrictEqual(C.contractsForCo(list, { c: '가나상사', bz: '1234567890' }).map((x) => x.id), ['c2', 'c1'], '사업자번호나 이름으로 · 최근 먼저');
  assert.deepStrictEqual(C.contractsForCo(list, {}), []);
  assert.match(SRC, /drawContacts\(\); drawVals\(\); loadCtPick\(r\);/, '회사를 고르면 그 회사 이알피 계약을 보여 준다');
  assert.match(SRC, /function ctxOf\(\) \{ return st\.ct \|\| host\.contractCtx \|\| null; \}/);
});
