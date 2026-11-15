'use strict';
/* 종료·삭제·되돌림 불변 규칙 및 부활·중복 원천 차단 검사 (2026-11-11 대표 지시)
   ★ 글자만 보지 않고 실제 함수를 vm 에서 돌려 검증한다 (STATUS.md §4 #2).
   ★ 지어낸 시험 자료(가나상사·다라테크·123- 접두 사업자번호)만 쓴다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { finRuleSrc } = require('./fin-one-rule-src');
const audit = require('../scripts/erp-integrity-audit');

const ROOT = path.resolve(__dirname, '..');
const ERP_SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

test('① 정적 코드·에이전트 문서 동기화 점검기(erp-integrity-audit)가 이상 없이 통과한다', () => {
  const codeRes = audit.auditCode(ERP_SRC);
  assert.equal(codeRes.ok, true, '코드 불변 안전장치 누락: ' + JSON.stringify(codeRes.blockers));
  const docRes = audit.auditDocs(ROOT);
  assert.equal(docRes.ok, true, '에이전트 .md 불변 규칙 누락: ' + JSON.stringify(docRes));
});

test('② _fbUnknownBaseUpserts — 서버의 삭제(_deleted)·되돌림(undoneDate)·종결(closed/transferred)을 옛 사본이 되살리지 못한다', () => {
  const ctx = { JSON, Object, Array, String, Number, window: {} };
  vm.createContext(ctx);
  vm.runInContext(cutFn(ERP_SRC, 'function _fbUnknownBaseUpserts('), ctx);

  const srvMap = {
    'del-1': { id: 'del-1', name: '가나상사', _deleted: true, _deletedAt: '2026-11-10T00:00:00.000Z' },
    'undo-1': { id: 'undo-1', companyName: '다라테크', amount: 1100000, undoneDate: '2026-11-11T08:00:00.000Z' },
    'closed-1': { id: 'closed-1', no: '현장클리닉-2026-014', status: 'closed', updatedAt: 200 },
    'open-1': { id: 'open-1', no: '현장클리닉-2026-015', status: 'ongoing', note: '전' },
  };
  const staleClient = [
    { id: 'del-1', name: '가나상사' }, // _deleted 없는 옛 사본
    { id: 'undo-1', companyName: '다라테크', amount: 1100000 }, // undoneDate 없는 옛 사본
    { id: 'closed-1', no: '현장클리닉-2026-014', status: 'ongoing', updatedAt: 100 }, // 종결 전 옛 사본
    { id: 'open-1', no: '현장클리닉-2026-015', status: 'ongoing', note: '후' }, // 정상 수정된 열린 건
  ];

  const u = ctx._fbUnknownBaseUpserts('consultings', staleClient, srvMap, 5000);
  assert.ok(u, '열린 건 변경은 반영되어야 한다');
  assert.equal(u['data/consultings/v/del-1'], undefined, '휴지통 건이 옛 사본 때문에 되살아나면 안 된다');
  assert.equal(u['data/consultings/v/undo-1'], undefined, '확정 되돌린 입금이 옛 사본 때문에 되살아나면 안 된다');
  assert.equal(u['data/consultings/v/closed-1'], undefined, '종결된 건이 옛 사본 때문에 진행중으로 되돌아가면 안 된다');
  assert.ok(u['data/consultings/v/open-1'], '정상 열린 건 수정은 그대로 올라가야 한다');

  // 명시적 휴지통 복원(_restoredAt 이 _deletedAt 이후)은 정상 허용되어야 한다
  const restoredClient = [
    { id: 'del-1', name: '가나상사', _restoredAt: '2026-11-11T09:00:00.000Z' },
  ];
  const uRestore = ctx._fbUnknownBaseUpserts('consultings', restoredClient, srvMap, 6000);
  assert.ok(uRestore && uRestore['data/consultings/v/del-1'], '사람이 휴지통에서 명시적으로 복원한 건은 허용되어야 한다');
});

test('③ reorderConsultingNos — 휴지통(_deleted) 건은 빼고, 종결(closed/cancelled) 건의 관리번호는 절대 바꾸지 않는다', () => {
  const rows = [
    { id: 'c-del', no: '현장클리닉-2026-001', startDate: '2026-01-02', status: 'wait', _deleted: true },
    { id: 'c-closed', no: '현장클리닉-2026-002', startDate: '2026-05-10', status: 'closed', closeDate: '2026-09-01' },
    { id: 'c-retro', no: '현장클리닉-2026-005', startDate: '2026-02-01', status: 'ongoing' },
    { id: 'c-later', no: '현장클리닉-2026-006', startDate: '2026-08-01', status: 'wait' },
  ];
  let upserted = [];
  let cascaded = [];
  const ctx = {
    Array, Object, String, Number, parseInt,
    dbGet: () => rows,
    dbUpsertMany: (_k, list) => { upserted = list.slice(); return true; },
    bizNoCascade: (_kind, olds) => { cascaded = olds.slice(); },
  };
  vm.createContext(ctx);
  vm.runInContext(
    cutFn(ERP_SRC, 'function erpIsTerminalRecord(') + '\n' + cutFn(ERP_SRC, 'function reorderConsultingNos('),
    ctx
  );

  ctx.reorderConsultingNos();
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(byId['c-del'].no, '현장클리닉-2026-001', '휴지통 건은 건드리지 않는다');
  assert.equal(byId['c-closed'].no, '현장클리닉-2026-002', '종결된 컨설팅의 관리번호는 소급 입력이 들어와도 고정되어야 한다');
  assert.equal(byId['c-retro'].no, '현장클리닉-2026-001', '열린 건이 빈 앞번호(001)를 받는다');
  assert.equal(byId['c-later'].no, '현장클리닉-2026-003', '종결 건이 잠근 002번을 건너뛰고 003번을 받는다');
  assert.ok(upserted.every((x) => x.id !== 'c-closed' && x.id !== 'c-del'));
  assert.ok(cascaded.length >= 1);
});

test('④ renumberContracts2026 — 휴지통(_deleted) 제외 및 이관·종료(transferred/closed/cancelled) 계약번호 동결', () => {
  const contracts = [
    { id: 'ct-del', contractNo: '계약-2026-001', status: 'consult', _deleted: true },
    { id: 'ct-tr', contractNo: '계약-2026-002', status: 'transferred' },
    { id: 'ct-cl', contractNo: '계약-2026-004', status: 'closed' },
    { id: 'ct-op1', contractNo: '계약-2026-007', status: 'consult' },
    { id: 'ct-op2', contractNo: '계약-2026-009', status: 'review' },
  ];
  const store = {
    contracts,
    consultings: [{ id: 'cs-1', sourceContractNo: '계약-2026-002' }, { id: 'cs-2', sourceContractNo: '계약-2026-007' }],
    funds: [],
    other_projects: [],
    cases: [],
  };
  const ctx = {
    Array, Object, String, Number, parseInt,
    dbGet: (k) => store[k] || [],
    dbSet: (k, v) => { store[k] = v; return true; },
    dbUpsertMany: (k, changed) => {
      const m = Object.fromEntries(changed.map((x) => [x.id, x]));
      store[k] = (store[k] || []).map((x) => m[x.id] || x);
      return true;
    },
  };
  vm.createContext(ctx);
  vm.runInContext(
    cutFn(ERP_SRC, 'function erpIsTerminalRecord(') + '\n' + cutFn(ERP_SRC, 'function renumberContracts2026('),
    ctx
  );

  const res = ctx.renumberContracts2026();
  assert.ok(res.changed >= 2);
  const byId = Object.fromEntries(store.contracts.map((c) => [c.id, c]));
  assert.equal(byId['ct-tr'].contractNo, '계약-2026-002', '이관 완료된 계약번호는 바뀌면 안 된다');
  assert.equal(byId['ct-cl'].contractNo, '계약-2026-004', '종결된 계약번호는 바뀌면 안 된다');
  assert.equal(byId['ct-op1'].contractNo, '계약-2026-001', '열린 계약이 001번을 채운다');
  assert.equal(byId['ct-op2'].contractNo, '계약-2026-003', '이관된 002번을 건너뛰고 003번을 채운다');
  assert.equal(store.consultings[0].sourceContractNo, '계약-2026-002');
  assert.equal(store.consultings[1].sourceContractNo, '계약-2026-001');
});

test('⑤ erpUndoIncome · erpPerfCounts · erpInvoiceMatchAll — 되돌린/지운 입금 차단 + 기타사업(other_projects) 롤백', () => {
  const store = {
    finance_income: [
      { id: 'fi-other', date: '2026-11-05', amount: 1100000, companyName: '가나상사',
        sourceKind: 'other', sourceId: 'op-1', kind: '기타(계약금)',
        perfShares: [{ sid: 'P-1', name: '홍길동', amount: 165000 }] },
    ],
    other_projects: [
      { id: 'op-1', companyName: '가나상사', contractPaid: true, contractPaidDate: '2026-11-05', contractPaidAmount: 1100000 },
    ],
    locked_payroll_months: [],
  };
  const ctx = {
    Math, JSON, Date, parseInt, parseFloat, String, Number, Object, Array, isNaN, console,
    showToast() {},
    todayYMD: () => '2026-11-11',
    isIncomeLocked: () => false,
    isPayrollLocked: () => false,
    erpNormName: (s) => String(s || '').trim(),
    dbGet: (k, d) => (store[k] === undefined ? d : store[k]),
    dbPatch: (k, id, patch) => {
      if (!store[k]) throw new Error('없는 표에 패치 시도: ' + k);
      store[k] = store[k].map((x) => (x && x.id === id ? Object.assign({}, x, patch) : x));
      return true;
    },
    CURRENT_USER: { sid: 'P-9', name: '검사' },
    window: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const fns = [
    'function erpPerfMonthOf(', 'function erpPerfCounts(', 'function erpNextOpenYM(',
    'function erpPerfLockInfo(', 'function erpRoutePerfDelta(', 'function erpUndoIncome(',
    'function erpInvoiceMatchAll(',
  ];
  vm.runInContext(finRuleSrc(ERP_SRC) + '\n' + fns.map((d) => cutFn(ERP_SRC, d)).join('\n'), ctx);

  // 1) 기타사업(sourceKind='other') 입금을 되돌리면 없는 표('others')가 아니라 'other_projects'가 미입금으로 롤백된다
  assert.equal(ctx.erpUndoIncome(store.finance_income[0]), true);
  assert.ok(store.finance_income[0].undoneDate, '되돌림 시각이 찍혀야 한다');
  assert.equal(store.other_projects[0].contractPaid, false, 'other_projects 의 계약금 완납이 미입금으로 돌아가야 한다');

  // 2) 되돌린 입금과 휴지통 입금은 성과 계산·세금계산서 완납 대조에서 모두 빠진다
  assert.equal(ctx.erpPerfCounts(store.finance_income[0], false), false, '되돌린 입금은 실적에서 빠져야 한다');
  assert.equal(ctx.erpPerfCounts({ id: 'fi-del', amount: 500000, _deleted: true }, false), false, '휴지통 입금은 실적에서 빠져야 한다');

  const invRes = ctx.erpInvoiceMatchAll(
    [{ id: 'iv-1', companyName: '가나상사', amount: 1100000, issueDate: '2026-11-01', status: '발행' }],
    store.finance_income.concat([{ id: 'fi-del2', companyName: '가나상사', amount: 1100000, date: '2026-11-06', _deleted: true }]),
    '2026-11-11'
  );
  assert.equal(invRes.paid.length, 0, '되돌리거나 삭제된 입금으로 세금계산서가 입금완료 처리되면 안 된다');
  assert.equal(invRes.unpaid.length, 1);
});

test('⑥ 자동 계약 요청(erpQuoteLanePlan · processPhotoContractRequest) — 이미 closed/cancelled 된 계약을 중복 생성하지 않는다', async () => {
  const ctx = {
    Math, JSON, Date, parseInt, parseFloat, String, Number, Object, Array, RegExp, Promise, isNaN,
    erpSameCompany: (a, b) => a && b && a.company && b.company && a.company.bizNo === b.company.bizNo,
    erpBlankContractForm: () => ({ company: {}, kinds: [], typeCodes: {}, amounts: {}, briefs: {} }),
    getActiveUsers: () => [{ sid: 'P-1', name: '홍길동' }],
    getKindTypes: () => [],
    erpGuessContractFromFields: () => ({ kind: 'consulting', typeCode: '' }),
    erpCmsFromDoc: () => null,
    erpVatTextToFlag: () => null,
    erpDeferCoLinkIfNew: (x) => x,
    persistOne: () => { throw new Error('중복 계약이 저장되면 안 된다'); },
    dbGet: (k) => {
      if (k === 'companies') return [{ id: 'co-1', name: '가나상사', bizNo: '123-82-15423' }];
      if (k === 'contracts') {
        return [
          { id: 'ct-closed', status: 'closed', companyId: 'co-1', companyName: '가나상사',
            company: { name: '가나상사', bizNo: '123-82-15423' },
            srcPhoto: { id: 'ph-77' }, srcMails: ['Sent|777'] },
        ];
      }
      return [];
    },
    fbDb: {
      ref: () => ({
        remove: () => Promise.resolve(),
        update: () => Promise.resolve(),
      }),
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const fns = [
    'function erpQuoteDay(', 'function erpQuoteNote(', 'function erpQuoteLanePlan(',
    'function erpParseContractMoney(', 'function erpParseSuccessFee(', 'function erpCoNameKey(',
    'async function processPhotoContractRequest(',
  ];
  vm.runInContext(fns.map((d) => cutFn(ERP_SRC, d)).join('\n'), ctx);

  // advance 신호가 이미 closed 카드만 있는 사업장에 들어오면 새로 만들지 않고 noop 처리
  const plan = ctx.erpQuoteLanePlan(
    { kind: 'advance', docKind: 'contract', companyId: 'co-1', managerMain: 'P-1', srcKey: 'Sent|888' },
    [{ id: 'co-1', name: '가나상사', bizNo: '123-82-15423' }],
    [{ id: 'ct-closed', status: 'closed', company: { name: '가나상사', bizNo: '123-82-15423' }, srcMails: [] }],
    [{ sid: 'P-1', name: '홍길동' }]
  );
  assert.equal(plan.action, 'noop', '종결된 계약이 있는 사업장에 advance 신호로 빈 카드가 재생성되면 안 된다');

  // 사진첩 계약 요청이 이미 closed 처리된 계약과 같은 srcPhoto.id 로 다시 들어오면 noop 처리
  const photoRes = await ctx.processPhotoContractRequest('req-1', {
    srcPhoto: { id: 'ph-77' },
    company: { name: '가나상사', bizNo: '123-82-15423' },
    managerMain: 'P-1',
  });
  assert.ok(photoRes && photoRes.noop, '종결된 계약과 같은 사진 요청은 중복 생성 없이 noop 이어야 한다');
});

test('⑦ 스냅샷 점검기(auditSnapshot · compareTerminalImmutability)가 부활·중복·번호변경을 정확히 잡아낸다', () => {
  const dirtySnap = {
    consultings: {
      v: {
        0: { id: 'c-1', no: '현장클리닉-2026-001' },
        'c-1': { id: 'c-1', no: '현장클리닉-2026-001' },
        'c-2': { id: 'c-2', no: '현장클리닉-2026-001' },
        'c-del': { id: 'c-del', no: '현장클리닉-2026-099', _deleted: true },
      },
    },
    other_projects: [
      { id: 'op-1', no: '기타-2026-001', contractPaid: true },
    ],
    finance_income: [
      { id: 'fi-zombie', sourceKind: 'consulting', sourceId: 'c-del', kind: '컨설팅(계약금)', amount: 500000 },
      { id: 'fi-undone', sourceKind: 'other', sourceId: 'op-1', kind: '기타(계약금)', amount: 300000, undoneDate: '2026-11-11' },
    ],
  };

  const snapAudit = audit.auditSnapshot(dirtySnap);
  assert.equal(snapAudit.ok, false);
  const kinds = new Set(snapAudit.issues.map((i) => i.kind));
  assert.ok(kinds.has('mixed_numeric_and_id_keys'), '배열 숫자키+ID키 혼재 감지');
  assert.ok(kinds.has('duplicate_id'), '중복 ID 감지');
  assert.ok(kinds.has('duplicate_management_no'), '살아 있는 관리번호 중복 감지');
  assert.ok(kinds.has('live_income_points_to_deleted_source'), '삭제된 원본에 연결된 살아 있는 입금 감지');
  assert.ok(kinds.has('undone_income_source_still_marked_paid'), '되돌린 입금인데 원본이 완납으로 남은 상태 감지');

  const beforeSnap = {
    consultings: [
      { id: 'c-closed', no: '현장클리닉-2026-014', status: 'closed' },
      { id: 'c-trash', no: '현장클리닉-2026-015', status: 'wait', _deleted: true },
    ],
    finance_income: [
      { id: 'fi-u', amount: 1100000, undoneDate: '2026-11-11T00:00:00Z' },
    ],
  };
  const badAfterSnap = {
    consultings: [
      { id: 'c-closed', no: '현장클리닉-2026-013', status: 'closed' }, // 종결 건 번호 변경!
      { id: 'c-trash', no: '현장클리닉-2026-015', status: 'wait' }, // 복원 표식 없이 _deleted 해제!
    ],
    finance_income: [
      { id: 'fi-u', amount: 1100000 }, // undoneDate 증발!
    ],
  };
  const diffRes = audit.compareTerminalImmutability(beforeSnap, badAfterSnap);
  assert.equal(diffRes.ok, false);
  const vKinds = new Set(diffRes.violations.map((v) => v.kind));
  assert.ok(vKinds.has('terminal_record_mutated'));
  assert.ok(vKinds.has('deleted_record_resurrected'));
  assert.ok(vKinds.has('undone_income_resurrected_or_removed'));
});
