'use strict';
/* ⚖ 유사하지만 다른 사건·계약(별건) 자동 판별 · 별건 확인 영구 기억 · 재심/후속사건 원클릭 연결 검사
   - 실제 고객명·사업자번호·전화번호는 쓰지 않고 합성 표본(가나테크, 다라물류, 홍길동, 임꺽정 등)만 쓴다.
   - 소스 문자열 확인에 그치지 않고 pu-erp.html 의 실제 함수를 VM 에 올려 끝까지 돌려 본다. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');

const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

function slice(from, to) {
  const a = ERP.indexOf(from);
  assert.ok(a >= 0, '시작 표지를 못 찾음: ' + from);
  const b = ERP.indexOf(to, a + from.length);
  assert.ok(b > a, '끝 표지를 못 찾음: ' + to);
  return ERP.slice(a, b);
}

const CASE_TYPES = [
  { code: 'case-dismiss', name: '부당해고 등', short: '부해' },
  { code: 'case-wc', name: '산재', short: '산재' },
  { code: 'case-old-hidden', name: '폐지유형', short: '폐지', hidden: true }
];
const CONS_TYPES = [
  { code: 'cons-clinic', name: '현장클리닉', short: '현장클리', role: 'clinic' },
  { code: 'cons-hr', name: '인사노무컨설팅', short: '인사노무' }
];
const CASE_STAGES = [
  { code: 'lrc-local', name: '지방노동위원회 (초심)', short: '지노위' },
  { code: 'lrc-central', name: '중앙노동위원회 (재심)', short: '중노위' },
  { code: 'court-admin', name: '행정법원 (행정소송)', short: '행소' },
  { code: 'wc-apply', name: '요양·보상 신청 (근로복지공단)', short: '신청' },
  { code: 'wc-review', name: '심사청구 (근로복지공단)', short: '심사' },
  { code: 'wc-rereview', name: '재심사청구 (산재재심사위원회)', short: '재심사' }
];

function makeEngineCtx(initialStore) {
  const store = Object.assign({
    biz_case_types: CASE_TYPES.slice(),
    biz_cons_types: CONS_TYPES.slice(),
    biz_fund_types: [],
    biz_other_types: [],
    biz_company_types: [{ code: '자문', name: '자문' }],
    contracts: [],
    cases: [],
    consultings: [],
    funds: [],
    other_projects: [],
    my_work_items: []
  }, JSON.parse(JSON.stringify(initialStore || {})));

  const ssMap = Object.create(null);
  const lsMap = Object.create(null);
  const mkStorage = (m) => ({
    d: m,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; }
  });
  const sessionStorage = mkStorage(ssMap);
  const localStorage = mkStorage(lsMap);
  const toasts = [];
  let navigatedTo = '';

  const ctx = {
    console, Date, Math, Object, JSON, Array, String, Number, parseInt, parseFloat, isNaN, RegExp,
    CURRENT_USER: { sid: 'P-001', name: '홍노무사', isAdmin: true },
    BIZ_CASE_SEED: CASE_TYPES,
    BIZ_CONS_SEED: CONS_TYPES,
    BIZ_FUND_SEED: [],
    BIZ_OTHER_SEED: [],
    COMPANY_TYPE_SEED: [{ code: '자문', name: '자문' }],
    CONTRACT_KINDS: [
      { v: 'consult', label: '상담사항' },
      { v: 'company', label: '업체계약', typesKey: 'biz_company_types' },
      { v: 'case', label: '사건', typesKey: 'biz_case_types' },
      { v: 'consulting', label: '컨설팅', typesKey: 'biz_cons_types' },
      { v: 'fund', label: '기금', typesKey: 'biz_fund_types' },
      { v: 'other', label: '기타', typesKey: 'biz_other_types' }
    ],
    sessionStorage,
    localStorage,
    location: { href: '' },
    window: {
      sessionStorage,
      localStorage,
      navigateTo(menu) { navigatedTo = menu; }
    },
    todayYMD: () => '2026-11-11',
    showToast: (m) => { toasts.push(String(m)); },
    popConfirm: async () => true,
    CompanyRef: { _normBiz: (s) => String(s == null ? '' : s).replace(/\D/g, '') },
    dbGet: (k, def) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : def),
    dbSet: (k, val) => { store[k] = val; return true; },
    dbUpsert: (k, item) => {
      if (!Array.isArray(store[k])) store[k] = [];
      const i = store[k].findIndex((x) => x && x.id === item.id);
      if (i >= 0) store[k][i] = item;
      else store[k].push(item);
      return true;
    },
    dbPatch: (k, id, patch) => {
      if (!Array.isArray(store[k])) return false;
      const i = store[k].findIndex((x) => x && String(x.id) === String(id));
      if (i < 0) return false;
      store[k][i] = Object.assign({}, store[k][i], patch);
      return true;
    },
    dbRemove: (k, id) => {
      if (!Array.isArray(store[k])) return false;
      store[k] = store[k].filter((x) => !x || String(x.id) !== String(id));
      return true;
    },
    getKindTypes: (kv, includeHidden) => {
      const map = {
        case: store.biz_case_types,
        consulting: store.biz_cons_types,
        fund: store.biz_fund_types,
        other: store.biz_other_types,
        company: store.biz_company_types
      };
      const arr = map[kv] || [];
      return includeHidden ? arr : arr.filter((t) => t && !t.hidden);
    },
    getCaseTypes: () => store.biz_case_types.filter((t) => t && !t.hidden),
    caseStageInfo: (code) => CASE_STAGES.find((s) => s.code === code) || null,
    kindInfo: (v) => ctx.CONTRACT_KINDS.find((x) => x.v === v) || null,
    briefTrim: (s) => String(s || '').trim().slice(0, 40),
    arvStamp: (srcLabel, srcNo) => ({ _arvFrom: srcLabel + ':' + srcNo }),
    erpPrepareContractTransfer: (c) => c,
    reorderConsultingNos: () => {},
    _store: store,
    _toasts: toasts,
    _getNavigated: () => navigatedTo
  };

  vm.createContext(ctx);
  const seedVars = (ERP.match(/var ERP_CT_SEED_KEY = [^;]+;\s*var ERP_CT_SEED_TTL = [^;]+;/) || [''])[0];
  vm.runInContext(seedVars, ctx);
  vm.runInContext(slice('function consNameKey(s){', '/* 일수 × 단가'), ctx);
  vm.runInContext(slice('var CONS_ROLE_SEED =', 'function clinicFeeDays('), ctx);
  vm.runInContext(slice('function clinicIsPerf(', 'var CLINIC_PERF_TIP ='), ctx);
  vm.runInContext(slice('var PC_CORP_TOKENS', 'function pcToContact('), ctx);
  vm.runInContext(slice('function isItemClosed(item){', '// ============ 종료 권한'), ctx);
  vm.runInContext(slice('function erpLiveRows(', 'function dbGetLive('), ctx);
  vm.runInContext(cutFn(ERP, 'function dbGetLive('), ctx);
  vm.runInContext(slice('function contractSubtypeCode(c, kindV){', '// ── 지난 자료 중복 훑기 끝 ──'), ctx);
  vm.runInContext([
    cutFn(ERP, 'function contractDupWorst('),
    cutFn(ERP, 'function contractDupNeedsConfirm('),
    cutFn(ERP, 'function contractFormSubtypeFill('),
    cutFn(ERP, 'function erpCoAddrKey('),
    cutFn(ERP, 'function erpSameCompany('),
    cutFn(ERP, 'function erpContractDupBlock('),
    cutFn(ERP, 'function erpBlankContractForm('),
    cutFn(ERP, 'function erpTakeContractSeed('),
    cutFn(ERP, 'function erpSeedCompanyType('),
    cutFn(ERP, 'function erpSeedCaseType('),
    cutFn(ERP, 'function erpSeedContacts('),
    cutFn(ERP, 'function erpContactsBlank('),
    cutFn(ERP, 'function erpContractDraftKey('),
    cutFn(ERP, 'function transferContract('),
    cutFn(ERP, 'function dupSweepSetDistinct('),
    cutFn(ERP, 'function caseNextStageCode('),
    cutFn(ERP, 'function erpCaseToFollowupContract(')
  ].join('\n'), ctx);

  return ctx;
}

// ══════════════════════════════════════════════════════════════════
// 방안 A: 자동 판별 기준 정교화 (심급·관할사건번호·근로자·지점·복제본 방어)
// ══════════════════════════════════════════════════════════════════

test('방안 A-1: 같은 회사·같은 사건유형이어도 심급·단계(초심 vs 재심, 신청 vs 심사)가 서로 다르면 별건으로 구분한다', () => {
  const ctx = makeEngineCtx({
    cases: [
      { id: 'k1', caseNo: '부해-2026-001', companyName: '(주)가나테크', bizNo: '123-45-67890',
        typeCode: 'case-dismiss', receiveDate: '2026-02-01', status: 'pending',
        stages: [{ code: 'lrc-local', caseNo: '' }] },
      { id: 'k2', caseNo: '부해-2026-002', companyName: '(주)가나테크', bizNo: '123-45-67890',
        typeCode: 'case-dismiss', receiveDate: '2026-06-01', status: 'pending',
        stages: [{ code: 'lrc-central', caseNo: '' }] }
    ],
    contracts: [
      { id: 'ct1', contractNo: '계약-2026-010', companyName: '(주)가나테크', bizNo: '123-45-67890',
        kinds: ['case'], typeCodes: { case: 'case-wc' }, stageCode: 'wc-apply', status: 'signed',
        company: { name: '(주)가나테크', bizNo: '123-45-67890' } }
    ]
  });

  const sweep = ctx.dupSweepScan({ kinds: ['case'] });
  assert.equal(sweep.groups.length, 0, '초심과 재심 사건을 중복으로 잡으면 안 된다');
  assert.equal(sweep.distinctGroups.length, 1);
  assert.match(sweep.distinctGroups[0].distinctWhy, /심급·단계 다름/);

  const newForm = {
    kinds: ['case'],
    typeCodes: { case: 'case-wc' },
    stageCode: 'wc-review',
    company: { name: '(주)가나테크', bizNo: '123-45-67890' }
  };
  const v = ctx.contractDupVerdict(ctx._store.contracts[0], newForm);
  assert.equal(v.verdict, 'diff');
  assert.deepEqual(Array.from(v.distinctReasons), ['심급·단계 다름']);
  assert.equal(ctx.erpContractDupBlock(newForm, ctx._store.contracts).length, 0);
});

test('방안 A-2: 관할기관 공식 사건번호(stages[].caseNo)가 다르면 별건이지만, ERP 내부 관리번호(rec.caseNo)만 다른 건 여전히 중복으로 잡는다', () => {
  const ctx = makeEngineCtx({
    cases: [
      { id: 'k1', caseNo: '부해-2026-001', companyName: '다라물류', bizNo: '123-10-00001',
        typeCode: 'case-dismiss', status: 'pending', stages: [{ code: 'lrc-local', caseNo: '충남2026부해219' }] },
      { id: 'k2', caseNo: '부해-2026-002', companyName: '다라물류', bizNo: '123-10-00001',
        typeCode: 'case-dismiss', status: 'pending', stages: [{ code: 'lrc-local', caseNo: '충남2026부해305' }] },
      { id: 'k3', caseNo: '산재-2026-001', companyName: '마바제조', bizNo: '123-10-00002',
        typeCode: 'case-wc', status: 'pending' },
      { id: 'k4', caseNo: '산재-2026-002', companyName: '마바제조', bizNo: '123-10-00002',
        typeCode: 'case-wc', status: 'pending' }
    ]
  });

  const sweep = ctx.dupSweepScan({ kinds: ['case'] });
  assert.equal(sweep.groups.length, 1, '내부 관리번호만 다른 마바제조 2건은 반드시 중복으로 잡혀야 한다');
  assert.equal(sweep.groups[0].coName, '마바제조');
  assert.equal(sweep.distinctGroups.length, 1, '관할 사건번호가 다른 다라물류 2건은 별건으로 분류된다');
  assert.equal(sweep.distinctGroups[0].distinctWhy, '관할 사건번호 다름');
});

test('방안 A-3: 대상 근로자 명단이 둘 다 있고 겹치는 사람이 0명일 때만 별건 — 1명이라도 겹치거나 한쪽이 비어 있으면 중복 유지', () => {
  const ctx = makeEngineCtx({
    cases: [
      // 0명 겹침 → 별건
      { id: 'a1', caseNo: '부해-2026-011', companyName: '가나운수', bizNo: '123-10-00003',
        typeCode: 'case-dismiss', status: 'pending', workers: [{ name: '홍길동' }] },
      { id: 'a2', caseNo: '부해-2026-012', companyName: '가나운수', bizNo: '123-10-00003',
        typeCode: 'case-dismiss', status: 'pending', workers: [{ name: '임꺽정' }] },
      // 일부 겹침 → 중복
      { id: 'b1', caseNo: '부해-2026-021', companyName: '다라택시', bizNo: '123-10-00004',
        typeCode: 'case-dismiss', status: 'pending', workers: [{ name: '홍길동' }, { name: '임꺽정' }] },
      { id: 'b2', caseNo: '부해-2026-022', companyName: '다라택시', bizNo: '123-10-00004',
        typeCode: 'case-dismiss', status: 'pending', workers: [{ name: '임꺽정' }] },
      // 한쪽 비어 있음 → 안전하게 중복 유지
      { id: 'c1', caseNo: '부해-2026-031', companyName: '사아식품', bizNo: '123-10-00005',
        typeCode: 'case-dismiss', status: 'pending', workers: [{ name: '홍길동' }] },
      { id: 'c2', caseNo: '부해-2026-032', companyName: '사아식품', bizNo: '123-10-00005',
        typeCode: 'case-dismiss', status: 'pending', workers: [] }
    ]
  });

  const sweep = ctx.dupSweepScan({ kinds: ['case'] });
  assert.deepEqual(Array.from(sweep.groups, (g) => g.coName).sort(), ['다라택시', '사아식품']);
  assert.equal(sweep.distinctGroups.length, 1);
  assert.equal(sweep.distinctGroups[0].coName, '가나운수');
  assert.equal(sweep.distinctGroups[0].distinctWhy, '대상 근로자 다름');
});

test('방안 A-4: 같은 본사 사업자번호 아래 지점·공장·종사업장번호가 양쪽 모두 다르면 별건, 한쪽이라도 지점이 없으면 중복 유지', () => {
  const ctx = makeEngineCtx({
    consultings: [
      { id: 's1', no: '인사노무-2026-001', companyName: '(주)가나테크 아산공장', bizNo: '123-45-67890',
        typeCode: 'cons-hr', status: 'in_progress' },
      { id: 's2', no: '인사노무-2026-002', companyName: '(주)가나테크 홍성영업소', bizNo: '123-45-67890',
        typeCode: 'cons-hr', status: 'in_progress' },
      // 종사업장번호 구분
      { id: 's3', no: '인사노무-2026-003', companyName: '(주)자차산업', bizNo: '123-10-00006', subBizNo: '0001',
        typeCode: 'cons-hr', status: 'in_progress' },
      { id: 's4', no: '인사노무-2026-004', companyName: '(주)자차산업', bizNo: '123-10-00006', subBizNo: '0002',
        typeCode: 'cons-hr', status: 'in_progress' },
      // 한쪽만 공장 표기 → 실수 중복일 수 있으므로 중복 유지
      { id: 's5', no: '인사노무-2026-005', companyName: '(주)카타전자', bizNo: '123-10-00007',
        typeCode: 'cons-hr', status: 'in_progress' },
      { id: 's6', no: '인사노무-2026-006', companyName: '(주)카타전자 천안공장', bizNo: '123-10-00007',
        typeCode: 'cons-hr', status: 'in_progress' }
    ]
  });

  const sweep = ctx.dupSweepScan({ kinds: ['consulting'] });
  assert.deepEqual(Array.from(sweep.groups, (g) => g.coName), ['(주)카타전자']);
  assert.equal(sweep.distinctGroups.length, 2);
  assert.ok(sweep.distinctGroups.every((g) => g.distinctWhy === '사업장·지점 다름'));
});

test('방안 A-5: 3건 혼합 묶음(홍길동 2건 중복 + 임꺽정 1건 별건)에서 연결 성분 분할로 홍길동 2건 중복을 놓치지 않는다', () => {
  const ctx = makeEngineCtx({
    cases: [
      { id: 'm1', caseNo: '부해-2026-001', companyName: '가나운수', bizNo: '111-22-33333',
        typeCode: 'case-dismiss', status: 'pending', workers: [{ name: '홍길동' }] },
      { id: 'm2', caseNo: '부해-2026-002', companyName: '가나운수', bizNo: '111-22-33333',
        typeCode: 'case-dismiss', status: 'pending', workers: [{ name: '홍길동' }] },
      { id: 'm3', caseNo: '부해-2026-003', companyName: '가나운수', bizNo: '111-22-33333',
        typeCode: 'case-dismiss', status: 'pending', workers: [{ name: '임꺽정' }] }
    ]
  });

  const sweep = ctx.dupSweepScan({ kinds: ['case'] });
  assert.equal(sweep.groups.length, 1, '임꺽정 별건 때문에 홍길동 중복 2건까지 묻히면 안 된다');
  assert.deepEqual(Array.from(sweep.groups[0].rows, (r) => r.rec.id).sort(), ['m1', 'm2']);
  assert.equal(sweep.distinctGroups.length, 1);
});

test('방안 A-6: 관리번호가 같거나 같은 이관 대상을 가리키는 복제본은 어떤 별건 표식이 있어도 절대 면제하지 않는다', () => {
  const ctx = makeEngineCtx({
    contracts: [
      { id: 'c1', contractNo: '계약-2026-131', companyName: '(주)가나테크 아산공장', bizNo: '123-45-67890',
        kinds: ['case'], typeCodes: { case: 'case-dismiss' }, stageCode: 'lrc-local',
        distinctIds: ['c2'], status: 'transferred', transferredTo: 'case:부해-2026-001' },
      { id: 'c2', contractNo: '계약-2026-131', companyName: '(주)가나테크 홍성영업소', bizNo: '123-45-67890',
        kinds: ['case'], typeCodes: { case: 'case-dismiss' }, stageCode: 'lrc-central',
        distinctIds: ['c1'], status: 'transferred', transferredTo: 'case:부해-2026-001' }
    ]
  });

  const sweep = ctx.dupSweepScan({ kinds: ['contract'] });
  assert.equal(sweep.groups.length, 1);
  assert.equal(sweep.groups[0].verdict, 'dup');
  assert.equal(sweep.groups[0].cloneDup, true);
  assert.equal(sweep.distinctGroups.length, 0);

  // 상담(consult) 갈래 복제본도 같은 계약번호이면 지점명이 달라도 contractDupVerdict 에서 절대 면제하지 않는다
  const consultCloneA = {
    id: 'cc1', contractNo: '계약-2026-200', companyName: '(주)가나테크 아산공장',
    kinds: ['consult'], branchName: '아산공장', status: 'signed'
  };
  const consultCloneB = {
    id: 'cc2', contractNo: '계약-2026-200', companyName: '(주)가나테크 홍성영업소',
    kinds: ['consult'], branchName: '홍성영업소', status: 'signed'
  };
  assert.equal(ctx.contractDupVerdict(consultCloneA, consultCloneB).verdict, 'dup',
    '동일 계약번호 복제본 상담 건은 지점명이 달라도 dup 이어야 한다');
});

// ══════════════════════════════════════════════════════════════════
// 방안 B: 「별건 확인」 영구 기억 · 해제 · 이관 승계
// ══════════════════════════════════════════════════════════════════

test('방안 B-1: 중복 훑기에서 「별건 확인」을 누르면 distinctIds 가 저장되어 다음 훑기부터 별건으로 기억하고, 「별건 해제」로 되돌린다', () => {
  const ctx = makeEngineCtx({
    contracts: [
      { id: 'ct-a', contractNo: '계약-2026-001', companyName: '다라테크', bizNo: '123-20-00001',
        kinds: ['case'], typeCodes: { case: 'case-dismiss' }, status: 'signed',
        company: { name: '다라테크', bizNo: '123-20-00001' } },
      { id: 'ct-b', contractNo: '계약-2026-002', companyName: '다라테크', bizNo: '123-20-00001',
        kinds: ['case'], typeCodes: { case: 'case-dismiss' }, status: 'signed',
        company: { name: '다라테크', bizNo: '123-20-00001' } }
    ]
  });

  const first = ctx.dupSweepScan({ kinds: ['contract'] });
  assert.equal(first.groups.length, 1);
  assert.equal(ctx.dupSweepSetDistinct(first.groups[0], true), true);

  const second = ctx.dupSweepScan({ kinds: ['contract'] });
  assert.equal(second.groups.length, 0, '별건 확인 후에는 중복 묶음에서 빠져야 한다');
  assert.equal(second.distinctGroups.length, 1);
  assert.equal(second.distinctGroups[0].manualDistinct, true);
  assert.equal(second.distinctGroups[0].distinctWhy, '별건 확인됨');

  // 계약에서 확인한 별건 관계는 사건관리로 이관된 뒤에도 distinctContractIds 로 승계된다
  const rA = ctx.transferContract(ctx._store.contracts[0]);
  const rB = ctx.transferContract(ctx._store.contracts[1]);
  assert.equal(rA.length, 1);
  assert.equal(rB.length, 1);
  const caseSweep = ctx.dupSweepScan({ kinds: ['case'] });
  assert.equal(caseSweep.groups.length, 0, '계약에서 별건 확인한 두 건은 사건 이관 뒤에도 중복으로 재등장하지 않는다');
  assert.equal(caseSweep.distinctGroups.length, 1);

  // 별건 해제 시 다시 중복 판정 대상으로 돌아온다
  assert.equal(ctx.dupSweepSetDistinct(caseSweep.distinctGroups[0], false), true);
  const afterUnmark = ctx.dupSweepScan({ kinds: ['case'] });
  assert.equal(afterUnmark.groups.length, 1);

  // 중간 행 dbPatch 실패 시 이미 반영한 앞 행도 원복하고 false 를 돌려준다(반쪽 저장 방지)
  let patchCount = 0;
  const origPatch = ctx.dbPatch;
  ctx.dbPatch = (k, id, patch) => {
    patchCount++;
    if (patchCount === 2) return false;
    return origPatch(k, id, patch);
  };
  assert.equal(ctx.dupSweepSetDistinct(afterUnmark.groups[0], true), false,
    '두 번째 레코드 저장 실패 시 전체가 실패(false)로 처리되어야 한다');
  ctx.dbPatch = origPatch;
  const afterRollback = ctx.dupSweepScan({ kinds: ['case'] });
  assert.equal(afterRollback.groups.length, 1, '원복 후에도 반쪽 별건 표식 없이 원래 중복 묶음이 유지된다');

  // 최악 경계: 2번째 dbPatch 가 실패(또는 throw)하고 1번째 원복 dbPatch 마저 연속 실패하더라도,
  // 양방향 상호 표식(fail-closed)이므로 한쪽 distinctIds 만으로는 절대 별건 면제되지 않고 미복구 경고를 띄운다
  ctx._toasts.length = 0;
  let seqCall = 0;
  ctx.dbPatch = (k, id, patch) => {
    seqCall++;
    if (seqCall === 1) return origPatch(k, id, patch); // 첫 행만 반영됨
    if (seqCall === 2) throw new Error('저장 중 예외'); // 둘째 행 실패(예외)
    return false;                                      // 첫 행 롤백도 실패
  };
  assert.equal(ctx.dupSweepSetDistinct(afterRollback.groups[0], true), false);
  ctx.dbPatch = origPatch;
  assert.ok(ctx._toasts.some((m) => m.indexOf('일부 원복에 실패') >= 0),
    '롤백까지 실패했을 때는 원복 성공이라고 거짓 안내하지 않고 일부 원복 실패를 알려야 한다');
  const afterDoubleFail = ctx.dupSweepScan({ kinds: ['case'] });
  assert.equal(afterDoubleFail.groups.length, 1,
    '한쪽 레코드에만 distinctIds 가 남더라도 상호 표식이 아니면 중복 면제되지 않는다(fail-closed)');

  // 2번째 행이 로컬 반영 직후 예외를 던진 경우에도 현재 행(u)까지 포함해 깔끔히 원복된다
  ctx.dbPatch = origPatch;
  // 앞 테스트에서 남은 반쪽 표식 정리
  ctx._store.cases.forEach((c) => { c.distinctIds = []; });
  ctx._toasts.length = 0;
  let mutateThrowCall = 0;
  ctx.dbPatch = (k, id, patch) => {
    mutateThrowCall++;
    const res = origPatch(k, id, patch);
    if (mutateThrowCall === 2) throw new Error('로컬 반영 후 서버 전송 예외');
    return res;
  };
  assert.equal(ctx.dupSweepSetDistinct(ctx.dupSweepScan({ kinds: ['case'] }).groups[0], true), false);
  ctx.dbPatch = origPatch;
  assert.ok(ctx._store.cases.every((c) => !c.distinctIds || c.distinctIds.length === 0),
    '현재 실패 행(2번째)에 반영됐던 distinctIds 까지 모두 빈 배열로 원복되어야 한다');
  assert.ok(ctx._toasts.some((m) => m.indexOf('원래대로 되돌렸습니다') >= 0));

  // 계약에서 연속 실패로 ct-half-1 에만 반쪽 distinctIds 가 남은 채 사건·컨설팅으로 이관해도 fail-closed 유지
  const ctxHalf = makeEngineCtx({
    contracts: [
      { id: 'ct-h1', contractNo: '계약-2026-301', companyName: '마바테크', bizNo: '123-20-00002',
        kinds: ['case', 'consulting'], typeCodes: { case: 'case-dismiss', consulting: 'cons-hr' },
        distinctIds: ['ct-h2'], status: 'signed', company: { name: '마바테크', bizNo: '123-20-00002' } },
      { id: 'ct-h2', contractNo: '계약-2026-302', companyName: '마바테크', bizNo: '123-20-00002',
        kinds: ['case', 'consulting'], typeCodes: { case: 'case-dismiss', consulting: 'cons-hr' },
        distinctIds: [], status: 'signed', company: { name: '마바테크', bizNo: '123-20-00002' } }
    ]
  });
  assert.equal(ctxHalf.dupSweepScan({ kinds: ['contract'] }).groups.length, 2,
    '계약 한 건에 사건+컨설팅 두 갈래가 모두 들어 있으므로 계약 중복 묶음도 2개다');
  ctxHalf.transferContract(ctxHalf._store.contracts[0]);
  ctxHalf.transferContract(ctxHalf._store.contracts[1]);
  assert.equal(ctxHalf.dupSweepScan({ kinds: ['case'] }).groups.length, 1,
    '반쪽 distinctIds 는 사건 이관 뒤에도 별건 면제로 새지 않는다');
  assert.equal(ctxHalf.dupSweepScan({ kinds: ['consulting'] }).groups.length, 1,
    '반쪽 distinctIds 는 컨설팅 이관 뒤에도 별건 면제로 새지 않는다');

  // 반대로 신규 계약 저장 창에서 단건 확인한 confirmedOverlapIds 는 이관 뒤에도 정상 승계된다
  const ctxConf = makeEngineCtx({
    contracts: [
      { id: 'ct-o1', contractNo: '계약-2026-401', companyName: '사아물류', bizNo: '123-20-00003',
        kinds: ['consulting'], typeCodes: { consulting: 'cons-hr' }, status: 'signed',
        company: { name: '사아물류', bizNo: '123-20-00003' } },
      { id: 'ct-o2', contractNo: '계약-2026-402', companyName: '사아물류', bizNo: '123-20-00003',
        kinds: ['consulting'], typeCodes: { consulting: 'cons-hr' }, confirmedOverlapIds: ['ct-o1'], status: 'signed',
        company: { name: '사아물류', bizNo: '123-20-00003' } }
    ]
  });
  assert.equal(ctxConf.dupSweepScan({ kinds: ['contract'] }).groups.length, 0);
  ctxConf.transferContract(ctxConf._store.contracts[0]);
  ctxConf.transferContract(ctxConf._store.contracts[1]);
  assert.equal(ctxConf.dupSweepScan({ kinds: ['consulting'] }).groups.length, 0,
    '신규 계약 저장 시 확인한 confirmedOverlapIds 는 컨설팅 이관 뒤에도 별건으로 유지된다');

  // 묶음 안의 한 행이 저장소에서 이미 삭제된 상태이면 반쪽 저장 없이 즉시 거부한다
  const ctxMissing = makeEngineCtx({
    contracts: [
      { id: 'ct-m1', contractNo: '계약-2026-501', companyName: '아자테크', bizNo: '123-20-00004',
        kinds: ['case'], typeCodes: { case: 'case-dismiss' }, status: 'signed' },
      { id: 'ct-m2', contractNo: '계약-2026-502', companyName: '아자테크', bizNo: '123-20-00004',
        kinds: ['case'], typeCodes: { case: 'case-dismiss' }, status: 'signed' }
    ]
  });
  const staleGroup = ctxMissing.dupSweepScan({ kinds: ['contract'] }).groups[0];
  ctxMissing._store.contracts[1]._deleted = true;
  assert.equal(ctxMissing.dupSweepSetDistinct(staleGroup, true), false);
  assert.equal(ctxMissing._store.contracts[0].distinctIds, undefined, '남은 한 행에도 반쪽 표식을 쓰지 않는다');

  // 원복 dbPatch 가 true 를 돌려주면서 비배열('CORRUPTED')을 남기더라도 sameArrVal 이 불일치를 잡아낸다
  const ctxCorrupt = makeEngineCtx({
    contracts: [
      { id: 'ct-k1', contractNo: '계약-2026-601', companyName: '차카테크', bizNo: '123-20-00005',
        kinds: ['case'], typeCodes: { case: 'case-dismiss' }, status: 'signed' },
      { id: 'ct-k2', contractNo: '계약-2026-602', companyName: '차카테크', bizNo: '123-20-00005',
        kinds: ['case'], typeCodes: { case: 'case-dismiss' }, status: 'signed' }
    ]
  });
  const kGroup = ctxCorrupt.dupSweepScan({ kinds: ['contract'] }).groups[0];
  let kCall = 0;
  const origKPatch = ctxCorrupt.dbPatch;
  ctxCorrupt.dbPatch = (k, id, patch) => {
    kCall++;
    if (kCall === 1) return origKPatch(k, id, patch);
    if (kCall === 2) return false;
    return origKPatch(k, id, { distinctIds: 'CORRUPTED' });
  };
  assert.equal(ctxCorrupt.dupSweepSetDistinct(kGroup, true), false);
  assert.ok(ctxCorrupt._toasts.some((m) => m.indexOf('일부 원복에 실패') >= 0),
    '비배열 오염값이 남으면 원복 성공으로 오안내하지 않고 일부 원복 실패를 알린다');
});

// ══════════════════════════════════════════════════════════════════
// 방안 C-1: 「↪ 재심·후속사건 계약 등록」 원클릭 연결 (초심 → 재심 → 행소)
// ══════════════════════════════════════════════════════════════════

test('방안 C-1: 심급 자동 추천과 원심 사건 → 후속사건 계약 씨앗 → 계약 창 초기값 → 이관 전 과정이 끊김 없이 이어진다', () => {
  const ctx = makeEngineCtx({
    contracts: [
      { id: 'ct-1st', contractNo: '계약-2026-050', companyName: '(주)가나테크', bizNo: '123-45-67890',
        kinds: ['case'], typeCodes: { case: 'case-dismiss' }, status: 'transferred',
        transferredTo: 'case:부해-2026-001',
        company: { name: '(주)가나테크', bizNo: '123-45-67890', workers: [{ name: '홍길동' }] } }
    ],
    cases: [
      { id: 'case-1st', caseNo: '부해-2026-001', typeCode: 'case-dismiss',
        companyName: '(주)가나테크', bizNo: '123-45-67890', companyId: 'co-1', companyLinkStatus: 'linked',
        ceo: '김대표', address: '충남 천안시 서북구 100',
        contacts: [{ id: 'p1', name: '박인사', role: '인사팀장', phone: '010-1111-2222', isPrimary: true }],
        workers: [{ id: 'w1', name: '홍길동', position: '대리', fee: 1100000, paidAmount: 1100000, paidConfirmed: true, paidDate: '2026-04-01' }],
        managerMain: 'P-001', managerSubs: ['P-002'],
        brief: '부당해고 구제신청 대응',
        sourceContractId: 'ct-1st', sourceContractNo: '계약-2026-050',
        stageCode: 'lrc-local',
        // 배열 순서가 뒤섞여 있어도 접수일(filedDate) 기준 최신 단계(lrc-local, 2026-03-10)에서 다음 심급을 계산하는지 검증
        stages: [
          { id: 'st-latest', code: 'lrc-local', caseNo: '충남2026부해100', filedDate: '2026-03-10' },
          { id: 'st-older', code: 'labor-report', caseNo: '', filedDate: '2026-01-05' }
        ],
        status: 'closed' }
    ]
  });

  // 1) 단계 전이 규칙 확인
  assert.equal(ctx.caseNextStageCode('lrc-local'), 'lrc-central');
  assert.equal(ctx.caseNextStageCode('lrc-central'), 'court-admin');
  assert.equal(ctx.caseNextStageCode('wc-apply'), 'wc-review');
  assert.equal(ctx.caseNextStageCode('wc-review'), 'wc-rereview');
  assert.equal(ctx.caseNextStageCode('wc-rereview'), 'court-admin');

  // 2) 원심 사건에서 재심 계약 씨앗 발송
  assert.equal(ctx.erpCaseToFollowupContract(ctx._store.cases[0]), true);
  assert.equal(ctx._getNavigated(), 'biz/contract');

  // 3) 계약관리가 씨앗을 꺼내고 사건 유형 검증
  const rawSeed = ctx.erpTakeContractSeed([ctx.sessionStorage, ctx.localStorage], Date.now());
  assert.ok(rawSeed, 'sessionStorage 에 후속사건 씨앗이 담겨야 한다');
  const verifiedCaseTy = ctx.erpSeedCaseType(rawSeed, ctx.dbGet('biz_case_types', []));
  assert.equal(verifiedCaseTy.code, 'case-dismiss');
  assert.equal(ctx.erpSeedCaseType({ typeCodes: { case: 'case-old-hidden' } }, CASE_TYPES), null,
    '숨긴 사건유형은 자동으로 찍지 않는다');

  // 4) ContractModal 의 실제 seed 병합 코드 실행
  const mergeBlock = slice('  if(!props.cur && props.seed && props.seed.company){', '\n  // 옛 데이터 호환');
  ctx.props = { cur: null, seed: rawSeed };
  vm.runInContext('var init = erpBlankContractForm();\n' + mergeBlock, ctx);
  const sequelForm = JSON.parse(JSON.stringify(ctx.init));

  assert.deepEqual(sequelForm.kinds, ['case']);
  assert.equal(sequelForm.typeCodes.case, 'case-dismiss');
  assert.equal(sequelForm.stageCode, 'lrc-central', '초심(지노위) 다음 단계인 재심(중노위)이 자동 선택된다');
  assert.equal(sequelForm.parentCaseId, 'case-1st');
  assert.equal(sequelForm.parentCaseNo, '부해-2026-001');
  assert.equal(sequelForm.parentContractId, 'ct-1st');
  assert.equal(sequelForm.companyId, 'co-1');
  assert.equal(sequelForm.managerMain, 'P-001');
  assert.equal(sequelForm.company.workers.length, 1);
  assert.equal(sequelForm.company.workers[0].name, '홍길동');
  assert.equal(sequelForm.company.workers[0].fee, undefined, '1심 정산 금액이 재심 계약 근로자에 섞이면 안 된다');
  assert.equal(sequelForm.company.workers[0].paidConfirmed, undefined);

  // 5) 원심 계약(ct-1st)과 재심 계약 폼 비교 → 중복으로 막지 않고 원심·후속사건 연결로 안내
  assert.equal(ctx.erpContractDupBlock(sequelForm, ctx._store.contracts).length, 0);
  const verdict = ctx.contractDupVerdict(ctx._store.contracts[0], sequelForm);
  assert.equal(verdict.verdict, 'diff');
  assert.deepEqual(Array.from(verdict.distinctReasons), ['원심·후속사건 연결']);

  // 6) 재심 계약 저장 후 사건관리로 이관 → 새 사건에 원심 연결 + 초기 심급(중노위) 생성
  const savedSequelCt = Object.assign({}, sequelForm, {
    id: 'ct-2nd',
    contractNo: '계약-2026-099',
    companyName: sequelForm.company.name,
    bizNo: sequelForm.company.bizNo,
    signDate: '2026-08-15',
    amounts: { case: 3300000 },
    status: 'transferred'
  });
  ctx._store.contracts.push(savedSequelCt);
  const xferRes = ctx.transferContract(savedSequelCt);
  assert.equal(xferRes.length, 1);
  const sequelCase = ctx._store.cases.find((c) => c.id === xferRes[0].id);
  assert.ok(sequelCase);
  assert.equal(sequelCase.parentCaseId, 'case-1st');
  assert.equal(sequelCase.parentCaseNo, '부해-2026-001');
  assert.equal(sequelCase.stageCode, 'lrc-central');
  assert.equal(sequelCase.stages.length, 1);
  assert.equal(sequelCase.stages[0].code, 'lrc-central');

  // 7) 전체 중복 훑기에서도 원심·재심 쌍은 계약·사건 어디에서도 중복으로 잡히지 않는다
  const fullSweep = ctx.dupSweepScan();
  assert.equal(fullSweep.groups.length, 0);
  assert.equal(fullSweep.distinctGroups.length, 2, '계약 1쌍 + 사건 1쌍 모두 원심·후속사건 연결로 구분된다');

  // 8) 반대로 같은 원심에서 실수로 재심 계약을 두 번 만든 경우에는 그 두 재심끼리 중복으로 잡는다!
  ctx._store.contracts.push(Object.assign({}, savedSequelCt, {
    id: 'ct-2nd-dup',
    contractNo: '계약-2026-100',
    status: 'signed'
  }));
  const dupSequelSweep = ctx.dupSweepScan({ kinds: ['contract'] });
  assert.equal(dupSequelSweep.groups.length, 1, '같은 원심을 가리키는 두 재심 계약 복제는 놓치지 않고 잡아야 한다');
  assert.deepEqual(Array.from(dupSequelSweep.groups[0].rows, (r) => r.rec.id).sort(), ['ct-2nd', 'ct-2nd-dup']);
});
