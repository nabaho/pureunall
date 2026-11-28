'use strict';
/* 계약관리 자동 수집 중복·기이관·해지·기존자문 차단 및 「❓ 담당자 진행확인」 기능 회귀 검사 (2026-11-16) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const PuQuoteDetect = require('../js/pu-quote-detect.js');
const PuCaseStage = require('../js/pu-case-stage.js');

const ROOT = path.join(__dirname, '..');
const ERP_SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const DOCFILE_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-doc-file.js'), 'utf8');
const DOCREAD_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-doc-read.js'), 'utf8');

const STAGE_SRC = [
  'function erpStagePartsFromContract(',
  'function erpStageMarksMerge('
].map((d) => cutFn(ERP_SRC, d)).filter(Boolean).join('\n');

test('① genContractNo — 동일 루프 연속 호출에서도 계약번호가 절대 겹치지 않는다', () => {
  const ctx = {
    Date, parseInt, RegExp,
    dbGet: () => [{ contractNo: '계약-' + (new Date()).getFullYear() + '-212' }]
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(ERP_SRC, 'function genContractNo('), ctx);
  const first = ctx.genContractNo();
  const second = ctx.genContractNo();
  assert.notEqual(first, second, '연속 호출 시 서로 다른 번호가 발급되어야 한다');
});

test('② PuQuoteDetect — 수습평가기간 연장합의서·양식 검토 요청은 우리 수임 계약서로 오탐하지 않는다', () => {
  assert.equal(PuQuoteDetect.isOurContract('RE: [가나상사] 양식 검토 요청의 件(수습평가기간 연장합의서)', ['수습연장합의서.docx']), false);
  assert.equal(PuQuoteDetect.docOf('RE: [가나상사] 양식 검토 요청의 件(수습평가기간 연장합의서)', []), '');
  assert.equal(PuQuoteDetect.isOurContract('[푸른노무법인] 가나상사 인사노무 컨설팅 위임계약서 송부의 건', ['위임계약서.pdf']), true);
});

test('③ 해지 통보 메일·기이관 업무·활성 자문업체·구분자(:) 메일은 중복 계약 카드로 생성되지 않는다', async () => {
  const FN = [
    'function erpParseContractMoney(', 'function erpParseSuccessFee(', 'function erpGuessContractFromFields(',
    'function erpTypeNameTidy(', 'function erpNameRun(', 'function erpConsTypeByDocName(',
    'function erpVatTextToFlag(', 'function erpDocText(', 'function erpCmsFromDoc(',
    'function erpBlankContractForm(', 'function erpSameCompany(', 'function erpCoAddrKey(',
    'function erpCoNameKey(', 'function erpBiznoClash(', 'async function processPhotoContractRequest('
  ].map((d) => cutFn(ERP_SRC, d)).join('\n') + '\n' + STAGE_SRC;

  let mockCos = [
    { id: 'co-adv-gana', name: '가나자문주식회사', bizNo: '123-82-15423', status: 'active', monthlyFee: 250000 }
  ];
  let mockCts = [
    { id: 'ct-seosan', contractNo: '계약-2026-198', companyName: '다라시설공단', status: 'signed', kinds: ['case'], srcMails: ['1_자문사답변:176155'] }
  ];
  let mockCons = [
    { id: 'cs-tp', no: '인사노무-2026-021', companyName: '(재)마바진흥원', status: 'pending', startDate: '2026-10-26', balanceFee: 880000 }
  ];
  let mockOthers = [
    { id: 'op-union', no: '문서작성-2026-003', companyName: '사아노동조합', status: 'pending', startDate: '2026-10-23', balanceFee: 300000 }
  ];
  const calls = { persist: [], remove: 0 };
  const ctx = {
    console, Date, Object, Array, String, Number, JSON, Math, Promise, parseInt, parseFloat, RegExp,
    ERP_CMS_WORDS: ['CMS', '자동이체'],
    todayYMD: () => '2026-11-16',
    fbDb: { ref: () => ({ remove: () => { calls.remove++; return Promise.resolve(); }, update: () => Promise.resolve() }) },
    dbGet: (k, d) => {
      if (k === 'companies') return mockCos;
      if (k === 'contracts') return mockCts;
      if (k === 'consultings') return mockCons;
      if (k === 'other_projects') return mockOthers;
      if (k === 'finance_income') return [{ id: 'fi-1', companyId: 'co-adv-gana', amount: 275000 }];
      return d;
    },
    getActiveUsers: () => [{ sid: 'P-001', name: '대표가' }],
    getKindTypes: (kv) => {
      if (kv === 'company') return [{ code: '자문', name: '자문' }];
      if (kv === 'consulting') return [{ code: 'cons-1', name: '기초컨설팅' }];
      if (kv === 'case') return [{ code: 'case-1', name: '부당해고구제신청' }];
      return [];
    },
    erpDeferCoLinkIfNew: (f) => Object.assign({}, f, { companyLinkStatus: 'pending' }),
    isContractLocked: () => false,
    genContractNo: () => '계약-2026-300',
    persistOne: (o) => { calls.persist.push(o); return true; },
    PuCaseStage
  };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(DOCREAD_SRC, ctx);
  vm.runInContext(FN + '\nthis.run=processPhotoContractRequest;', ctx);

  // 3-1) 자문계약 종료 통보 메일 첨부 구계약서 차단
  const rTerm = await ctx.run('k-term', {
    source: 'photo_contract', state: 'pending', managerMain: 'P-001',
    mailMeta: { dir: 'recv', subject: '자문계약 종료 의 건_아자산업(주)', srcKey: '1_자문사답변|175896' },
    company: { name: '아자산업(주)' },
    contractFields: { docName: '자문계약서', fee: '15만원' }
  });
  assert.ok(rTerm.noop, '종료 통보 메일은 카드를 생성하지 않고 noop 처리');

  // 3-2) 이미 컨설팅관리에 이관되어 진행 중인 사업장 중복 차단
  const rDupCons = await ctx.run('k-cons', {
    source: 'photo_contract', state: 'pending', managerMain: 'P-001',
    company: { name: '(재)마바진흥원' },
    contractFields: { docName: '위임계약서', scope: '인사노무 컨설팅', fee: '88만원', signDate: '2026-10-26' }
  });
  assert.ok(rDupCons.noop, '이미 컨설팅관리에 이관된 건은 중복 생성하지 않는다');

  // 3-3) 이미 기타사업에 이관되어 진행 중인 사업장(위임계약서 첨부) 중복 차단
  const rDupOther = await ctx.run('k-other', {
    source: 'photo_contract', state: 'pending', managerMain: 'P-001',
    company: { name: '사아노동조합' },
    contractFields: { docName: '위임계약서', scope: '상호협력규정 자문 의견서', fee: '33만원', signDate: '2026-11-03' }
  });
  assert.ok(rDupOther.noop, '이미 기타사업에 이관된 건도 중복 생성하지 않는다');

  // 3-4) 이미 업체관리에 활성 등록·입금 중인 자문업체 중복 차단
  const rDupCo = await ctx.run('k-co', {
    source: 'photo_contract', state: 'pending', managerMain: 'P-001',
    company: { name: '가나자문주식회사', bizNo: '123-82-15423' },
    contractFields: { docName: '자문계약서', scope: '노동관계법령 지도 상담', fee: '275,000원', signDate: '2026-09-08' }
  });
  assert.ok(rDupCo.noop, '이미 업체관리에 활성 운영 중인 자문사는 계약협의 중복 카드를 만들지 않는다');

  // 3-5) srcMails 의 콜론(:)과 파이프(|) 구분자 차이로 인한 중복 차단
  const rColon = await ctx.run('k-colon', {
    source: 'photo_contract', state: 'pending', targetStatus: 'review', managerMain: 'P-001',
    srcMails: ['1_자문사답변|176155'],
    company: { name: '다라시설공단' },
    contractFields: { docName: '위임약정서', scope: '구제신청 사건 대리', fee: '220만원' }
  });
  assert.ok(rColon.noop, '콜론(:)과 파이프(|) 차이를 정규화하여 동일 메일 중복을 차단한다');
  assert.equal(calls.persist.length, 0);

  // 3-6) 생산자(PuDocFile.autoRequestContractFromPhoto)도 해지 통보 메일을 원천 차단한다
  const pCtx = { console, Date, Object, Array, String, Number, JSON, Math, Promise, RegExp, parseInt, parseFloat };
  pCtx.window = pCtx; pCtx.global = pCtx;
  vm.createContext(pCtx);
  vm.runInContext(DOCFILE_SRC, pCtx);
  pCtx.PuDocFile.init({ db: { ref: () => ({ once: () => Promise.resolve({ val: () => null }) }) } });
  const pRes = await pCtx.PuDocFile.autoRequestContractFromPhoto({
    id: 'ph-term', year: '2026',
    fields: { company: '아자산업(주)', docName: '자문계약서' },
    mailMeta: { subject: '자문계약 종료 의 건_아자산업(주)' }
  });
  assert.equal(pRes.ok, false);
  assert.equal(pRes.reason, 'terminated_mail');
});

test('④ erpHasCheckReq 및 계약관리 담당자 진행확인 UI 연동', () => {
  const ctx = { String };
  vm.createContext(ctx);
  vm.runInContext(cutFn(ERP_SRC, 'function erpHasCheckReq('), ctx);
  assert.equal(ctx.erpHasCheckReq(null), false);
  assert.equal(ctx.erpHasCheckReq({ checkReq: { note: '' } }), false);
  assert.equal(ctx.erpHasCheckReq({ checkReq: { note: '회신 대기 확인', resolvedAt: '2026-11-16' } }), false);
  assert.equal(ctx.erpHasCheckReq({ checkReq: { note: '회신 대기 확인' } }), true);
  assert.match(ERP_SRC, /async function openCheckReq\(/);
  assert.match(ERP_SRC, /담당자 진행확인 요청/);
});

test('⑤ 다중 PC·다중 탭 동시 수신 시 RTDB transaction 선점으로 중복 계약 생성을 원천 차단한다', async () => {
  const fnBody = cutFn(ERP_SRC, 'async function runContractRequests(');
  const store = {
    req1: {
      source: 'photo_contract',
      state: 'pending',
      managerMain: 'P-001',
      company: { name: '가나수산' },
      contractFields: { docName: '위임약정서', scope: '체불임금 진정 사건 대리' }
    }
  };
  const madeByTabs = [];
  function makeSharedDb() {
    return {
      ref(p) {
        if (p === 'data/contract_requests') {
          return { once: async () => ({ val: () => JSON.parse(JSON.stringify(store)) }) };
        }
        const key = p.replace(/^data\/contract_requests\//, '');
        return {
          transaction: async (updater) => {
            const cur = store[key] ? JSON.parse(JSON.stringify(store[key])) : null;
            const next = updater(cur);
            if (next === undefined) return { committed: false, snapshot: { val: () => store[key] || null } };
            store[key] = next;
            return { committed: true, snapshot: { val: () => JSON.parse(JSON.stringify(store[key])) } };
          },
          remove: async () => { delete store[key]; },
          update: async (u) => { if (store[key]) Object.assign(store[key], u); }
        };
      }
    };
  }
  function makeTab(tabId) {
    const ctx = {
      console, Date, Object, Array, String, Number, Math, Promise,
      _erpCtReqBusy: false,
      _erpCtReqTabId: tabId,
      fbDb: makeSharedDb(),
      dbGet: () => [],
      erpQuoteLaneReq: () => false,
      showToast: () => {},
      processOneContractRequest: async (k, r) => {
        await new Promise((res) => setTimeout(res, 10));
        delete store[k];
        const m = { id: 'ct-' + tabId, companyName: r.company.name };
        madeByTabs.push(m);
        return { lane: 'photo_contract', made: m };
      }
    };
    vm.createContext(ctx);
    vm.runInContext(fnBody + '\nthis.run = runContractRequests;', ctx);
    return ctx;
  }
  const tabA = makeTab('tab-PC-A');
  const tabB = makeTab('tab-PC-B');
  await Promise.all([tabA.run(), tabB.run()]);
  assert.equal(madeByTabs.length, 1, '두 PC·탭이 동시에 수신해도 선점 잠금으로 정확히 1건만 생성된다');
});

test('⑥ 상담접수 및 견적서 송부 라벨 적용 + 견적서 송부 내용 자동정리 기록(quoteLogs·journals) 보존', () => {
  assert.match(ERP_SRC, /v:'consult',\s*label:'상담접수 및 견적서 송부'/); // 검사고정-허용: 대표 지시 단계 명칭 검증
  const STAGE_FNS = ['function erpStageMarksMerge(', 'function erpStagePartsFromContract(', 'function erpStagePartsFromQuote('];
  const PURE = ['function erpQuoteLaneReq(', 'function erpQuoteDay(', 'function erpQuoteNote(', 'function erpQuoteLanePlan(',
    'function erpBlankContractForm(', 'function erpSameCompany(', 'function erpCoAddrKey(']
    .concat(STAGE_FNS).map((d) => cutFn(ERP_SRC, d)).join('\n');
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, todayYMD: () => '2026-11-18', window: {} };
  vm.createContext(ctx);
  vm.runInContext(PURE + '\nthis.plan = erpQuoteLanePlan;', ctx);

  const users = [{ sid: 'P-001', name: '김대표' }];
  const plan = ctx.plan({
    kind: 'quote',
    state: 'pending',
    deferLink: true,
    companyName: '가나테크',
    folderLabel: '보낸메일함',
    subject: '[푸른노무법인] 가나테크 사내근로복지기금 설립 컨설팅 견적서 송부의 건',
    quoteScope: '사내근로복지기금 설립 컨설팅',
    quoteSummary: '과업: 사내근로복지기금 설립 컨설팅 | 견적내용: 정관 작성 및 인가 대행 | 발송금액 5,500,000원 제외 확인',
    atts: ['견적서_사내근로복지기금_가나테크.pdf'],
    to: ['info@ganatech.example'],
    at: Date.parse('2026-11-18T14:30:00+09:00'),
    srcKey: 'Sent Messages|901',
    inferredKind: 'fund',
    useInferredKind: true,
    managerMain: 'P-001'
  }, [], [], users);

  assert.equal(plan.action, 'create');
  assert.equal(plan.form.status, 'consult');
  assert.equal(plan.form.briefs.fund, '사내근로복지기금 설립 컨설팅');
  assert.equal(plan.form.quoteLogs.length, 1, '견적 송부 기록(quoteLogs) 1건 생성');
  assert.equal(plan.form.quoteLogs[0].scope, '사내근로복지기금 설립 컨설팅');
  assert.ok(plan.form.quoteLogs[0].summary.includes('정관 작성 및 인가 대행'));
  assert.ok(!/5,500,000|5500000/.test(JSON.stringify(plan.form)), '요약에 금액이 섞여 들어와도 카드 기록에서 제거된다');
  assert.equal(plan.form.journals.length, 1, '활동 일지(journals)에도 견적 송부 자동정리 기록이 함께 남는다');
  assert.match(plan.form.journals[0].content, /견적서 송부 자동정리/);
});

test('⑦ 상대방 계약서 회신 시 기존 빈 내용 상담접수·계약협의 중복 카드를 정본 1장으로 합쳐 계약확정(signed)으로 올린다', async () => {
  const FN = [
    'function erpParseContractMoney(', 'function erpParseSuccessFee(', 'function erpGuessContractFromFields(',
    'function erpTypeNameTidy(', 'function erpNameRun(', 'function erpConsTypeByDocName(',
    'function erpVatTextToFlag(', 'function erpDocText(', 'function erpCmsFromDoc(',
    'function erpBlankContractForm(', 'function erpSameCompany(', 'function erpCoAddrKey(',
    'function erpCoNameKey(', 'function erpBiznoClash(', 'async function processPhotoContractRequest('
  ].map((d) => cutFn(ERP_SRC, d)).join('\n') + '\n' + STAGE_SRC;

  const mockCts = [
    {
      id: 'ct-empty-consult',
      contractNo: '계약-2026-206',
      companyName: '가나테크',
      status: 'consult',
      kinds: ['fund'],
      typeCodes: { fund: 'fund-single' },
      amounts: { fund: 0 },
      briefs: { fund: '사내근로복지기금 설립 등 견적서 송부' },
      managerMain: 'P-001',
      company: { name: '가나테크', ceo: '김대표자', address: '충남 아산시 음봉면 1', email: 'master@ganatech.example' },
      quoteLogs: [{ srcKey: 'Sent|601', scope: '사내근로복지기금 설립 등' }],
      journals: [{ id: 'jn-1', content: '견적서 송부' }],
      srcMails: ['Sent|601'],
      checkReq: { note: '견적 회신 대기 중' }
    },
    {
      id: 'ct-draft-review',
      contractNo: '계약-2026-225',
      companyName: '(주)가나테크',
      status: 'review',
      kinds: ['fund'],
      typeCodes: { fund: 'fund-mrenh1dvjx2' },
      amounts: { fund: 3300000 },
      briefs: { fund: '사내근로복지기금 설립과 관련된 제반사항' },
      signDate: '2026-11-24',
      startDate: '2026-11-30',
      managerMain: 'P-001',
      company: { name: '(주)가나테크', ceo: '권형하', address: '충남 천안시 서북구 원두정8길 6' },
      srcMails: ['Sent|602']
    }
  ];
  const saved = [];
  const trashed = [];
  const ctx = {
    console, Date, Object, Array, String, Number, JSON, Math, Promise, parseInt, parseFloat, RegExp,
    ERP_CMS_WORDS: ['CMS', '자동이체'],
    todayYMD: () => '2026-11-24',
    fbDb: { ref: () => ({ remove: () => Promise.resolve(), update: () => Promise.resolve() }) },
    dbGet: (k, d) => (k === 'contracts' ? mockCts : k === 'companies' ? [] : d),
    getActiveUsers: () => [{ sid: 'P-001', name: '담당가' }],
    getKindTypes: (kv) => kv === 'fund'
      ? [{ code: 'fund-mrenh1dvjx2', name: '지역공동근로복지기금' }, { code: 'fund-single', name: '사내근로복지기금' }]
      : [],
    erpDeferCoLinkIfNew: (f) => Object.assign({}, f, { companyLinkStatus: 'pending' }),
    isContractLocked: () => false,
    genContractNo: () => '계약-2026-300',
    persistOne: (o) => { saved.push(o); return true; },
    TrashBin: { remove: (st, id, reason) => { trashed.push({ st, id, reason }); return true; } },
    PuCaseStage
  };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(DOCREAD_SRC, ctx);
  vm.runInContext(FN + '\nthis.run = processPhotoContractRequest;', ctx);

  const res = await ctx.run('mcsc-reply', {
    source: 'photo_contract',
    state: 'pending',
    targetStatus: 'signed',
    senderVerified: true,
    openContractVerified: true,
    mergeEmptyOpen: true,
    signedByClient: true,
    managerMain: 'P-001',
    inferredKind: 'fund',
    srcKey: '8_기금함|911',
    srcMails: ['8_기금함|911'],
    company: { name: '가나테크', bizNo: '', ceo: '권형하', address: '충남 천안시 서북구 원두정8길 6' },
    contractFields: { docName: '계약서_가나테크_푸른 노무법인.pdf', scope: '사내근로복지기금 설립 위임계약서 송부의 건', signDate: '2026-11-24' },
    mailMeta: { dir: 'recv', senderVerified: true, openContractVerified: true, companyName: '가나테크', srcKey: '8_기금함|911' }
  });

  assert.ok(res.made, '병합된 정본 카드 반환');
  assert.equal(res.made.id, 'ct-empty-consult', '견적이력·원본 업체정보가 있는 정본 카드를 살려 계약확정으로 정리한다');
  assert.equal(res.made.status, 'signed', '계약확정(signed)으로 이동되어 즉시 이관 가능 상태가 된다');
  assert.equal(res.made.checkReq, null, '계약확정 승격 시 미회신 진행확인 배지를 해제한다');
  assert.equal(res.made.amounts.fund > 0, true, '초안 계약협의 카드의 계약금액이 정본 카드로 흡수 보존된다');
  assert.equal(res.made.typeCodes.fund, 'fund-single', '사내근로복지기금 세부유형이 정확히 유지·반영된다');
  assert.equal(res.made.company.ceo, '김대표자', '수임인 대표자명(권형하)으로 의뢰인 대표자가 오염되지 않는다');
  assert.ok(!/원두정8길/.test(res.made.company.address), '수임인 본사 주소로 의뢰인 주소가 오염되지 않는다');
  assert.equal(trashed.length >= 1, true, '나뉘어 있던 중복 계약협의 카드는 휴지통 무덤 표식으로 정리된다');
  assert.equal(trashed[0].id, 'ct-draft-review');
  assert.match(ERP_SRC, /function promoteContractToSigned\(/, '수동 계약확정 전환 시에도 빈 진행카드 병합 정리가 배선되어 있다');
});
