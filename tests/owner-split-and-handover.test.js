'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const ROOT = path.join(__dirname, '..');
const CARDS_SRC = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const ERP_SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const SRV = require('../functions/mail-owner.js');

function makeMailCtx(opts) {
  opts = opts || {};
  const GANA = {
    id: 'co-gana',
    company: '가나상사',
    main: '홍길동',
    subs: opts.coSubs || [],
    left: false,
    bizNo: '123-45-67890'
  };
  const bins = {
    b_pay: { id: 'b_pay', name: '2.급여+사무대행' },
    b_cons: { id: 'b_cons', name: '3.컨설팅(정부사업)' },
    b_adv: { id: 'b_adv', name: '1.자문사답변' }
  };
  const ctx = {
    Object, String, Number, Array, JSON, Map, RegExp, Date, Math,
    digits: (s) => String(s || '').replace(/\D/g, ''),
    esc: (s) => String(s == null ? '' : s),
    _mbOwner: opts.owner || {},
    _mbWhoMsg: opts.whoMsg || {},
    _mbCo: opts.coMap || {},
    _mbCoSplit: opts.coSplit || {},
    _mbWork: null,
    _mbWorkLink: opts.workLink || {},
    _mbWkAddr: opts.wkAddr || {},
    _mbWkMsgAddr: null,
    _mbWkMsg: null,
    _mbNoWho: {},
    _mbBoxWho: {},
    _mbBizSubs: opts.bizSubs || {},
    MB_RAW_P: '~',
    MB_WHO_P: '@',
    MB_PUB_DOM: ['naver.com', 'daum.net', 'hanmail.net', 'gmail.com'],
    MB_PUB_TAIL: /(^|\.)(go\.kr|or\.kr|re\.kr|ac\.kr)$/,
    mbNow: () => '#bin',
    mbSentBox: () => false,
    mbMemoOf: () => ({}),
    mbWhoKey: (s) => String(s || '').trim().toLowerCase().replace(/\./g, ',').replace(/[#$/[\]]/g, '_'),
    mbDomOf: (e) => { const i = String(e || '').lastIndexOf('@'); return i < 0 ? '' : String(e).slice(i + 1).toLowerCase(); },
    mbRetired: (w) => !!(opts.retired || {})[w],
    mbSuccOf: (w) => (opts.succ || {})[w] || '',
    mbPerson: (s) => s,
    mbBinOfRow: (v) => bins[v && v._bin] || null,
    mbTaxRecOfRow: () => null,
    ErpMatch: {
      ready: true,
      _norm: (s) => String(s || '').replace(/\s/g, ''),
      companies: [{ id: 'co-gana', name: '가나상사', bizNo: '123-45-67890', status: 'active', managerMain: 'P-006' }],
      byId: { 'co-gana': GANA },
      byBiz: { '1234567890': GANA },
      byName: { '가나상사': GANA },
      nameBySid: { 'P-006': '홍길동', 'P-002': '이몽룡', 'P-004': '성춘향' }
    },
    mbWhoIndex: () => ({
      byAddr: opts.byAddr || { 'hr@gana.example': '홍길동' },
      byDom: opts.byDom || { 'gana.example': '홍길동' },
      coAddr: opts.coAddr || { 'hr@gana.example': '가나상사' },
      rawCo: {}
    })
  };
  vm.createContext(ctx);
  const consts = [
    'const MB_WORK_KIND =',
    'const MB_PROJ_CONS_RE =',
    'const MB_PROJ_CASE_RE =',
    'const MB_PROJ_FUND_RE =',
    'const MB_ROUTINE_CO_RE ='
  ];
  consts.forEach((prefix) => {
    const idx = CARDS_SRC.indexOf(prefix);
    assert.ok(idx > 0, prefix + ' 상수를 찾지 못했습니다');
    const end = CARDS_SRC.indexOf('\n', idx);
    vm.runInContext('var ' + CARDS_SRC.slice(idx + 'const '.length, end), ctx);
  });
  [
    'mbCoValName', 'mbCoOf', 'mbCoRec', 'mbWhoLive',
    'mbHqMap', 'mbHqRec', 'mbCoRecOfAddr', 'mbCoNameOf',
    'mbWkMsgOf', 'mbNoWhoBox', 'mbBoxWhoList', 'mbBoxWhoOfRow',
    'mbWorkLive', 'mbWorkBuild', 'mbWorkHandOf', 'mbWorkMgrOfAddr', 'mbWorkOfRow', 'mbWorkMgrs',
    'mbCoIdOfAddr', 'mbCoSplitParseRule', 'mbCoSplitRuleOf', 'mbCoSingleWorkMgr',
    'mbRowProjectKind', 'mbSplitPrimaryOfRow',
    'mbWhoWhy', 'mbWhoWhyOf', 'mbWhoOfRow', 'mbSubsOfRow', 'mbWhoAllOfRow'
  ].forEach((fn) => vm.runInContext(sliceFn(CARDS_SRC, 'function ' + fn + '('), ctx));

  const recs = opts.recs || [];
  ctx._mbWork = ctx.mbWorkBuild(
    { byBiz: {}, byName: { x: recs } },
    ctx.ErpMatch.nameBySid,
    ctx.ErpMatch.byId,
    ctx.ErpMatch.byBiz
  );
  return ctx;
}

test('① 유형 B (mode: split) — 같은 사업장이라도 컨설팅 메일은 을에게만, 급여·자문 메일은 갑에게만 분리되어 중복 연결을 막는다', () => {
  const c = makeMailCtx({
    coSubs: ['성춘향'],
    bizSubs: { '가나상사': ['이몽룡'] },
    coSplit: {
      'co-gana': { coId: 'co-gana', coName: '가나상사', mode: 'split', ex: [] }
    },
    recs: [{
      _kind: 'consulting',
      id: 'cons-1',
      status: 'progress',
      companyId: 'co-gana',
      bizNo: '123-45-67890',
      companyName: '가나상사',
      title: '석유화학 협력업체 컨설팅',
      managerMain: 'P-002',
      primaryContactEmail: 'hr@gana.example'
    }]
  });

  /* 1) 컨설팅 메일: 컨설팅 담당(이몽룡)에게만 배정되고 과거/자문 담당(홍길동) 메일함에는 중복되지 않는다 */
  const consMail = {
    e: 'hr@gana.example',
    s: 'RE: [푸른노무법인] 협력업체 컨설팅 진행을 위한 인터뷰 양식 송부의 건',
    p: '인터뷰 설문지 송부드립니다',
    _bin: 'b_cons'
  };
  assert.equal(c.mbWhoOfRow(consMail), '이몽룡');
  assert.deepEqual(Array.from(c.mbSubsOfRow(consMail)), []);
  assert.deepEqual(Array.from(c.mbWhoAllOfRow(consMail)), ['이몽룡']);

  /* 2) 급여·4대보험 일상 메일: 같은 인사담당자 주소(hr@gana.example)에서 와도 업체 주담당(홍길동)에게만 가고 컨설팅 담당(이몽룡)에게는 안 섞인다 */
  const payMail = {
    e: 'hr@gana.example',
    s: '5월 급여대장 및 4대보험 취득신고 요청',
    p: '근태기록부 보내드려요',
    _bin: 'b_pay'
  };
  assert.equal(c.mbWhoOfRow(payMail), '홍길동');
  assert.deepEqual(Array.from(c.mbSubsOfRow(payMail)), ['성춘향']);
  assert.ok(!Array.from(c.mbWhoAllOfRow(payMail)).includes('이몽룡'), '급여 메일에 컨설팅 담당이 중복 합산되면 안 됩니다');
});

test('② 유형 A (과거 담당자 제외 ex + workOnly) — 수동 고정(mailWho)이 남아 있어도 화면과 서버 알림 모두에서 과거 담당자(갑) 재연결을 차단한다', async () => {
  const splitTbl = {
    'co-gana': { coId: 'co-gana', coName: '가나상사', mode: 'workOnly', ex: ['홍길동'], toName: '이몽룡' }
  };
  const c = makeMailCtx({
    owner: { 'hr@gana,example': '홍길동' },
    coSplit: splitTbl,
    recs: [{
      _kind: 'consulting',
      id: 'cons-2',
      status: 'progress',
      companyId: 'co-gana',
      bizNo: '123-45-67890',
      companyName: '가나상사',
      title: '노무진단 컨설팅',
      managerMain: 'P-002',
      primaryContactEmail: 'hr@gana.example'
    }]
  });

  const anyMail = { e: 'hr@gana.example', s: '자료 송부드립니다', p: '', _bin: 'b_adv' };
  assert.equal(c.mbWhoOfRow(anyMail), '이몽룡');
  assert.ok(!c.mbWhoAllOfRow(anyMail).includes('홍길동'), '제외된 과거 담당자(홍길동)가 다시 연결되면 안 됩니다');

  /* 서버 푸시 알림 판정(functions/mail-owner.js)도 동일하게 홍길동을 차단하고 이몽룡에게 보낸다 */
  const dbTree = {
    'data/user_dir': {
      v: [
        { sid: 'P-006', name: '홍길동', status: 'active' },
        { sid: 'P-002', name: '이몽룡', status: 'active' }
      ]
    },
    'data/companies': {
      v: [{ id: 'co-gana', name: '가나상사', bizNo: '123-45-67890', status: 'active', managerMain: 'P-006', email: 'hr@gana.example' }]
    },
    'pucards/config/mailWho': { 'hr@gana,example': '홍길동' },
    'pucards/mailCoSplit': splitTbl,
    'data/consultings/v': [
      { id: 'cons-2', status: 'progress', companyId: 'co-gana', bizNo: '123-45-67890', managerMain: 'P-002', primaryContactEmail: 'hr@gana.example' }
    ]
  };
  const mockDb = {
    ref: (p) => ({ once: async () => ({ val: () => (dbTree[p] !== undefined ? dbTree[p] : null) }) })
  };
  const srvTables = await SRV.loadTables(mockDb);
  const srvRes = SRV.whoOf('hr@gana.example', srvTables);
  assert.equal(srvRes.who, '이몽룡');
  assert.deepEqual(SRV.whoAll('hr@gana.example', 'inbox', srvTables).all, ['이몽룡']);
});

test('③ 일괄 변경 신청 및 승인 (푸른이알피 coMgrRequest + coMgrDecide + coMgrApplyScope) — 갑은 빠지고 을만 단독 담당으로 업체·부담당·진행사업을 한 번에 전환한다', () => {
  const store = {
    co_mgr_requests: [],
    companies: [{
      id: 'co-gana',
      name: '가나상사',
      bizNo: '123-45-67890',
      managerMain: 'P-006',
      managerSubs: ['P-006', 'P-004']
    }],
    consultings: [
      { id: 'cons-live', companyId: 'co-gana', status: 'progress', managerMain: 'P-006', managerSubs: ['P-006'] },
      { id: 'cons-done', companyId: 'co-gana', status: 'closed', closedDate: '2025-12-31', managerMain: 'P-006' },
      { id: 'cons-xfer', companyId: 'co-gana', status: 'transferred', managerMain: 'P-006' }
    ],
    cases: [
      { id: 'case-live', bizNo: '123-45-67890', status: '진행중', managerMain: 'P-006' }
    ],
    funds: [],
    other_projects: [],
    user_dir: [
      { sid: 'P-001', name: '성춘향' },
      { sid: 'P-002', name: '이몽룡' },
      { sid: 'P-004', name: '변학도' },
      { sid: 'P-006', name: '홍길동' }
    ]
  };
  const patches = [];
  const ctx = {
    Object, String, Number, Array, Date, JSON, Math, isNaN, RegExp, Promise,
    CURRENT_USER: { sid: 'P-002', name: '이몽룡', isAdmin: false },
    dbGet: (k, d) => (store[k] !== undefined ? store[k] : d),
    dbUpsert: (k, rec) => {
      const a = store[k] || (store[k] = []);
      const i = a.findIndex((x) => x.id === rec.id);
      if (i >= 0) a[i] = rec; else a.push(rec);
      return true;
    },
    dbPatch: (k, id, p) => {
      patches.push({ k, id, p });
      const rec = (store[k] || []).find((x) => x.id === id);
      if (rec) Object.assign(rec, p);
      return true;
    },
    uid: (p) => p + '-1',
    showToast: () => {},
    confirm: () => true,
    fbDb: null
  };
  vm.createContext(ctx);
  vm.runInContext("var CO_MGR_REQ_KEY = 'co_mgr_requests'; var CO_MGR_HOT_DAYS = 90;", ctx);
  [
    'coMgrCanDirect', 'coMgrNeedsOk', 'coMgrName', 'coMgrHistAdd', 'coMgrRecent', 'coMgrDay',
    'coMgrReqs', 'coMgrPending', 'coMgrPendingAll', 'coMgrRequest', 'coMgrScopeText', 'coMgrApplyScope', 'coMgrDecide'
  ].forEach((fn) => vm.runInContext(sliceFn(ERP_SRC, 'function ' + fn + '('), ctx));

  /* 직원이 일괄 단독 전환 신청 */
  const req = ctx.coMgrRequest(store.companies[0], 'P-002', '이몽룡 단독 담당 전환', '', {
    fromSid: 'P-006',
    scope: { cleanSubs: true, works: true, workSheet: true, mailClean: true }
  });
  assert.ok(req);
  assert.equal(req.status, 'wait');
  assert.equal(ctx.coMgrScopeText(req.scope), '[부담당제외+진행사업+업무시트+메일정리]');

  /* 관리자가 승인하면 업체 주담당 + 부담당 제거 + 진행 중 컨설팅·사건이 한 번에 전환되고 종료된 건은 보존된다 */
  ctx.CURRENT_USER = { sid: 'P-001', name: '성춘향', isAdmin: true };
  assert.equal(ctx.coMgrDecide(store.co_mgr_requests[0], true, ''), true);

  assert.equal(store.companies[0].managerMain, 'P-002');
  assert.deepEqual(Array.from(store.companies[0].managerSubs), ['P-004']);
  assert.equal(store.consultings[0].managerMain, 'P-002');
  assert.deepEqual(Array.from(store.consultings[0].managerSubs), []);
  assert.equal(store.consultings[1].managerMain, 'P-006', '이미 종료된 과거 컨설팅 이력은 건드리지 않아야 합니다');
  assert.equal(store.consultings[2].managerMain, 'P-006', '이관(transferred)된 컨설팅 건은 건드리지 않아야 합니다');
  assert.equal(store.cases[0].managerMain, 'P-002');

  /* fromSid 가 비어 있으면 제3자 담당 건을 건드리지 않는다 */
  store.cases.push({ id: 'case-third', companyId: 'co-gana', status: '진행중', managerMain: 'P-004' });
  ctx.coMgrApplyScope(store.companies[0], { from: '', to: 'P-002', scope: { works: true } });
  assert.equal(store.cases.find((x) => x.id === 'case-third').managerMain, 'P-004', 'fromSid 없이 다른 노무사 건이 일괄 변경되면 안 됩니다');
});

test('④ 보안 규칙 및 XSS 방어 — mailCoSplit 쓰기는 관리자·위임관리인(MGR)만 허용하고 화면 단추는 data-id 속성을 쓴다', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;
  assert.ok(rules.pucards.mailCoSplit, 'pucards/mailCoSplit 보안 규칙이 없습니다');
  const wExpr = rules.pucards.mailCoSplit['.write'];
  assert.match(wExpr, /isAdmin/);
  assert.match(wExpr, /isSubAdmin/);
  assert.ok(!rules.pucards.config, 'pucards/config 를 따로 풀어 quoteWatch ADMIN 잠금을 건드리면 안 됩니다');

  const sumFn = sliceFn(CARDS_SRC, 'function mbSplitSummaryHtml(');
  assert.ok(!/onclick="mbTransferOpen\('\$\{/.test(sumFn), 'mbSplitSummaryHtml 에 JS 문자열 보간 XSS 위험이 남아 있습니다');
  assert.match(sumFn, /data-id="\$\{esc\(r\.coId\)\}"/);

  /* co_mgr_requests 승인(ok)·반려(no) 상태는 관리자·위임관리인(MGR)만 쓸 수 있고, 끝난 기록 삭제·되살리기는 일반 직원에게 차단된다 */
  const reqNode = rules.data.co_mgr_requests;
  assert.match(reqNode['.write'], /newData\.exists\(\)/, '일반 직원이 co_mgr_requests 를 통째 삭제하지 못해야 합니다');
  const reqVal = reqNode.v.$id.status['.validate'];
  assert.match(reqVal, /isAdmin/);
  assert.match(reqVal, /isSubAdmin/);
  assert.match(reqVal, /data\.exists\(\) && newData\.val\(\) === data\.val\(\)/, '배열 재저장 시 기존 ok 줄이 막히지 않아야 합니다');
  assert.match(reqNode.v.$id['.validate'], /data\.child\('status'\)\.val\(\) === 'wait'/, '이미 승인·반려된 요청을 일반 직원이 되살리지 못해야 합니다');

  /* 모달 마크업 클래스(.mbtr-card, .mbtr-fld, .mbtr-pill, .mbtr-tab, .mbtr-chip.ex)가 CSS 에 모두 정의되어 있다 */
  ['.mbtr-card', '.mbtr-fld', '.mbtr-pill', '.mbtr-tab', '.mbtr-chip.ex'].forEach((cls) => {
    assert.ok(CARDS_SRC.includes(cls), 'pu-cards.html CSS 에 ' + cls + ' 스타일이 없습니다');
  });
});

