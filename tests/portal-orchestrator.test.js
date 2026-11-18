'use strict';
/* ══════════════════════════════════════════════════════════════════════════
 * 🔄 푸른통합시스템 — 업무 오케스트레이션(enter.html · pu-orchestrator.html) 계약 및 동작 검증
 *
 * 지키는 규칙:
 *   1. 포털(enter.html)·온톨로지(PuOntology)·앱바(pu-appbar.js)·챗봇(pu-chatbot-kb.js)·폰 시드(seeds/orch.js) 동기화
 *   2. 원본 무변경(sourceMutation:'never')·강제 저장 관문(enforce)·in_app 민감 본문 비수집(READ_ADAPTERS 준수)
 *   3. 영구 열쇠(companyId · 고유번호 5자리 몸통 · 사업자번호 10자리) 확정 매칭 vs 상호명 추정 분리
 *   4. 개인정보·사번(sid)·이메일·카드번호·계좌번호 비노출 및 권한별(fin·settle·career) 바통 분리
 *   5. 앱 간 바통(packBaton/unpackBaton · 앱바 수신 띠 · 복귀 단추 · 창 이름 · 필수 uidTag 검증) 검증
 *   6. 긴급도 정렬(urgent ➔ warn ➔ normal), 프로토타입 오염 방어, 이관 제외, 목록 ☐ + № 규칙 검증
 * ══════════════════════════════════════════════════════════════════════════ */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const readUtf8 = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const O = require('../js/pu-ontology.js');
const W = require('../js/pu-ontology-write.js');
const Core = require('../js/pu-orchestrator-core.js');
const ChatbotKb = require('../js/pu-chatbot-kb.js');
const { load: loadAppBar } = require('./lib-appbar-load');

test('① 포털·온톨로지·앱바·챗봇에 업무 오케스트레이션(orch)이 일관되게 등록되고 in_app 본문 경로를 읽지 않는다', () => {
  const enterHtml = readUtf8('enter.html');
  const orchHtml = readUtf8('pu-orchestrator.html');
  const viewSrc = readUtf8('js/pu-orchestrator-view.js');

  assert.match(enterHtml, /key:\s*'orch'[\s\S]{0,160}?url:\s*'pu-orchestrator\.html'/);
  assert.match(enterHtml, /id="orchBar"[^>]*\bhidden\b/, '로그인 전에는 포털 오케스트레이션 바가 숨겨져 있어야 합니다');
  assert.match(enterHtml, /<script src="js\/pu-orchestrator-core\.js\?v=\d+"><\/script>/);
  assert.match(enterHtml, /window\.portalLaunchApp\('orch'/, '포털 바는 portalLaunchApp 을 통해 명명된 창을 재사용해야 합니다');

  // READ_ADAPTERS 에서 strategy:'in_app' 으로 선언된 모든 경로(하위 경로 포함)와 pu_sign/open 을 직접 열지 않는지 동적 검증
  const inAppPaths = Object.values(O.READ_ADAPTERS || {})
    .filter((a) => a && a.strategy === 'in_app' && a.path)
    .map((a) => String(a.path));
  assert.ok(inAppPaths.length >= 8, 'READ_ADAPTERS 의 in_app 경로 목록이 비어 있으면 안 됩니다');
  const readPathsInView = Array.from(viewSrc.matchAll(/\[\s*'[A-Za-z0-9_]+'\s*,\s*'([^']+)'/g), (m) => m[1]);
  assert.ok(readPathsInView.length >= 8, '뷰의 수집 경로 목록이 추출되어야 합니다');
  for (const p of [...inAppPaths, 'pu_sign/open', 'data/finance_income']) {
    assert.equal(
      readPathsInView.some((rp) => rp === p || rp.startsWith(p + '/')),
      false,
      `in_app 민감 경로(${p})를 뷰에서 직접 읽으면 안 됩니다`
    );
    assert.equal(
      O.PROGRAMS.orch.sharedRoots.some((sr) => sr === p || sr.startsWith(p + '/')),
      false,
      `sharedRoots 에 in_app 경로(${p})가 포함되면 안 됩니다`
    );
  }

  assert.ok(O.PROGRAMS.orch, 'PuOntology.PROGRAMS 에 orch 가 등록되어야 합니다');
  assert.equal(O.PROGRAMS.orch.localOnly, true, '오케스트레이션은 원본 무변경(localOnly) 지휘소여야 합니다');
  assert.deepEqual(O.PROGRAMS.orch.primaryRoots, []);
  assert.equal(W.runtimeMode('orch', 'observe'), 'enforce', '비유예 앱이므로 런타임 강제 모드로 쓰기가 차단되어야 합니다');

  const bar = loadAppBar({ role: 'admin', pathname: '/pu-orchestrator.html', search: '?sso=1' });
  assert.equal(bar.whoAmI(), 'orch');
  assert.ok(bar._ordered().some((a) => a.key === 'orch'), '공용 앱바 이동 목록에 오케스트레이션이 있어야 합니다');

  const picked = ChatbotKb.pick('오케스트레이션 앱은 28개 프로그램 업무 흐름을 어떻게 자동으로 이어 주나요?');
  assert.ok(picked.length > 0 && picked[0].id === 'SYS-orch-01');

  assert.match(orchHtml, /<script src="js\/pu-whoami\.js\?v=\d+"><\/script>[\s\S]*?<script src="js\/pu-appbar\.js\?v=\d+"><\/script>/);
  assert.match(orchHtml, /<script src="js\/pu-active\.js\?v=\d+"><\/script>/);
  assert.doesNotMatch(orchHtml, /_blank/, '창 재사용 원칙을 위해 _blank 를 쓰지 않습니다');
});

test('② 5대 생애주기 바통 추출은 긴급 순 정렬·확정/추정 분리·이관 제외·프로토타입 방어를 지킨다', () => {
  const now = Date.UTC(2026, 10, 17, 3, 0, 0);
  const raw = {
    companies: [
      { id: 'co-alpha', name: '(주)가나정밀 A-101동', bizNo: '123-81-40011', puNo: 10301, typeCode: '자문', status: 'active', managerMain: 'P-001' },
      { id: 'co-beta',  name: '(주)다라물류',         bizNo: '123-81-40022', puNo: 10302, typeCode: '기금', status: 'active', managerMain: 'P-002' },
      { id: '__proto__', name: 'constructor',         bizNo: '123-81-40099', status: 'active' }
    ],
    userDir: [
      { sid: 'P-001', name: '김푸른', status: 'active' },
      { sid: 'P-002', name: '박성실', status: 'active' }
    ],
    contractRequests: [
      { puNo: '급여-10301', contractType: '자문계약', status: 'pending', createdAt: now - 86400000 * 4, managerMain: 'P-001' },
      { companyName: '(주)둘째요청', contractType: '사건수임', status: 'pending', createdAt: now - 86400000 * 1 }
    ],
    contracts: [
      { id: 'ct-guess', companyName: '주식회사 다라물류', stage: '계약협의', createdAt: now - 86400000 * 2 },
      { id: 'ct-trans', companyName: '(주)이관종결처', status: 'transferred', stage: '계약협의', createdAt: now - 86400000 * 10 },
      { id: 'ct-bill',  companyId: 'co-alpha', type: '노무자문', status: 'active', billingStatus: 'pending', managerMain: 'P-001' }
    ],
    cases: [
      { id: 'cs-overdue', companyId: 'co-alpha', title: '부당해고 장기미종결', status: 'progress', dueDate: '2026-10-25', managerMain: 'P-001' },
      { id: 'cs-harass',  companyId: 'co-alpha', caseType: '직장내 괴롭힘 조사', status: 'progress', managerMain: 'P-001' }
    ],
    consultings: [
      { id: 'cn-1', bizNo: '123-81-40022', bizName: '2026년 일터혁신 상생컨설팅', stage: '정산대기', status: 'progress', managerMain: 'P-002' }
    ],
    cardsOntIdx: {
      '1238155555': { company: '(주)신규서류보관처', docs: ['bizreg', 'card'] }
    },
    workItems: {
      'wk-due': { id: 'wk-due', co_id: 'co-alpha', title: '단체협약 검토 회신', status: 'open', dueDate: '2026-11-17', mgr_main: { sid: 'P-001' } },
      'GA-co-alpha-p1': { id: 'GA-co-alpha-p1', co_id: 'co-alpha', title: '지원금 신청 대행', status: 'open', mgr_main: { sid: 'P-001' } }
    },
    hanaAlertCount: 2
  };

  const snapshotBefore = JSON.stringify(raw);

  const staffReport = Core.analyzeWorkspace(raw, {
    now, uid: 'u-staff', sid: 'P-001', role: 'staff', isAdmin: false, perms: { fin: false }
  });
  assert.equal(staffReport.readOnly, true);
  assert.equal(staffReport.sourceMutation, 'never');
  assert.equal(JSON.stringify(raw), snapshotBefore, '분석기가 입력 원본을 절대 변경해서는 안 됩니다');

  // ★ 긴급도 정렬 검증: urgent(0) ➔ warn(1) ➔ normal(2) 순서를 반드시 지켜야 함
  const rank = { urgent: 0, warn: 1, normal: 2 };
  for (let i = 1; i < staffReport.batons.length; i++) {
    assert.ok(
      rank[staffReport.batons[i - 1].severity] <= rank[staffReport.batons[i].severity],
      `긴급 바통이 주의/일반보다 항상 먼저 정렬되어야 합니다 (${staffReport.batons[i - 1].severity} vs ${staffReport.batons[i].severity})`
    );
  }
  assert.equal(staffReport.batons[0].severity, 'urgent');

  // 위험 키(__proto__·constructor)가 c.key 로 그대로 남지 않아야 함
  assert.equal(staffReport.companyFlows.some((c) => c.key === '__proto__' || c.key === 'constructor'), false);

  // ID 없는 배열 원소도 중복되지 않는 고유 바통 ID 를 가져야 함
  const creqBatons = staffReport.batons.filter((b) => b.ruleCode === 'contract_request_pending');
  assert.equal(creqBatons.length, 2);
  assert.notEqual(creqBatons[0].id, creqBatons[1].id);

  // 고유번호 몸통(10301) 확정 매칭 및 일반 건물 동표기(A-101동) 보존 확인
  const alphaReq = creqBatons.find((b) => b.companyId === 'co-alpha');
  assert.ok(alphaReq);
  assert.equal(alphaReq.linkConfidence, 'confirmed');
  assert.match(alphaReq.companyLabel, /A-101동/);

  // 7일 초과 장기 경과 미종결 사건도 누락되지 않고 urgent 바통으로 잡혀야 함
  const overdueCase = staffReport.batons.find((b) => b.id === 'case-due:cs-overdue');
  assert.ok(overdueCase);
  assert.equal(overdueCase.severity, 'urgent');

  // 이관(transferred) 처리된 계약 제외 확인
  assert.equal(staffReport.batons.some((b) => b.id.includes('ct-trans')), false);

  // 얇은 거울(cardsOntIdx·harassSync) 및 GA-* 할 일 연동 확인
  assert.ok(staffReport.batons.some((b) => b.ruleCode === 'card_ontidx_unlinked'));
  assert.ok(staffReport.batons.some((b) => b.ruleCode === 'harass_erp_sync'));
  assert.ok(staffReport.batons.some((b) => b.ruleCode === 'govaid_agency_in_progress'));

  // 재무 권한 없는 직원에게는 청구·정산·계좌알림 바통 비노출
  assert.equal(staffReport.batons.some((b) => b.toApp === 'fin' || b.toApp === 'settle'), false);

  // 재무 권한 보유자: 계약 청구대기·컨설팅 정산대기·계좌 알림 바통 생성 및 사번 비노출
  const finReport = Core.analyzeWorkspace(raw, {
    now, uid: 'u-fin', sid: 'P-001', role: 'staff', isAdmin: false, perms: { fin: true }
  });
  assert.ok(finReport.batons.some((b) => b.ruleCode === 'contract_billing_followup'));
  assert.ok(finReport.batons.some((b) => b.ruleCode === 'consulting_to_settle'));
  assert.ok(finReport.batons.some((b) => b.ruleCode === 'hana_deposit_alert'));
  assert.equal(finReport.companyFlows.some((c) => c.name === '법인 계좌 실시간 알림'), false);

  const visibleTexts = finReport.batons.map((b) => [b.title, b.reason, b.ownerName, b.companyLabel].join(' ')).join('\n');
  assert.doesNotMatch(visibleTexts, /P-001|P-002/, '화면에 사번이 노출되면 안 됩니다');
});

test('③ 바통 패킹·언패킹·앱바 복귀 단추·창 이름은 필수 계정 바인딩·카드/유선 마스킹·표준 URL 규격을 지킨다', () => {
  const now = 1794900000000;
  const packed = Core.packBaton({
    uid: 'uid-owner-1',
    id: 'b-1',
    stage: 'intake',
    fromApp: 'photos',
    toApp: 'erp',
    fromName: '사진첩',
    toName: '푸른이알피',
    companyLabel: '(주)테스트 9001011234567 user@example.com',
    title: '계약 +82-10-0000-5678 / (02)123-4567 확인 (P-001)',
    reason: '카드 1234.5678.9012.3456 / 3782 822463 10005 / 계좌 123-123456-12-123 / 110 123 456789',
    returnUrl: 'https://evil.example/steal.html'
  }, now);

  assert.equal(packed.returnUrl, 'pu-orchestrator.html');
  assert.match(packed.uidTag, /^[0-9a-f]{8}$/);
  assert.doesNotMatch(JSON.stringify(packed), /uid-owner-1|9001011234567|user@example\.com|123-4567|1234\.5678|822463|123456-12|456789|P-001/);

  // 같은 계정은 언패킹 성공, uid 미전달·다른 계정·위조된 만료시간·TTL 경과 시 모두 null 반환
  assert.ok(Core.unpackBaton(JSON.stringify(packed), now + 60000, 'uid-owner-1'));
  assert.equal(Core.unpackBaton(JSON.stringify(packed), now + 60000, ''), null);
  assert.equal(Core.unpackBaton(JSON.stringify(packed), now + 60000, 'uid-other-user'), null);
  assert.equal(Core.unpackBaton(JSON.stringify(Object.assign({}, packed, { expiresAt: now + 999999999 })), now + 60000, 'uid-owner-1'), null);
  assert.equal(Core.unpackBaton(JSON.stringify(packed), now + Core.BATON_TTL_MS + 1000, 'uid-owner-1'), null);

  // 공용 앱바 수신 배너 마운트 및 [흐름판 복귀] 단추 클릭 시 pu-orchestrator.html 표준 이동 검증
  const bodyKids = [];
  const openedCalls = [];
  const localStore = {
    [Core.BATON_STORAGE_KEY]: JSON.stringify(Core.packBaton({
      uid: 'uid-owner-1', id: 'b-erp', toApp: 'erp', companyLabel: '(주)가나정밀', title: '계약 확정 대기', returnUrl: 'pu-orchestrator.html?tab=batons'
    }, Date.now()))
  };
  const mkEl = (tag) => {
    const listeners = {};
    const el = {
      tag, id: '', style: { cssText: '' }, attrs: {}, children: [], textContent: '', title: '',
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return this.attrs[k] || null; },
      appendChild(c) { this.children.push(c); c.parentNode = el; return c; },
      removeChild(c) { this.children = this.children.filter((x) => x !== c); },
      addEventListener(ev, fn) { listeners[ev] = fn; },
      click() { if (listeners.click) listeners.click({ preventDefault() {}, stopPropagation() {} }); }
    };
    return el;
  };
  const win = {
    innerWidth: 1280, innerHeight: 800,
    location: { pathname: '/pu-erp.html', search: '?sso=1&orchBaton=1', href: '' },
    firebase: { auth: () => ({ currentUser: { uid: 'uid-owner-1' }, onAuthStateChanged(fn) { fn({ uid: 'uid-owner-1' }); } }) },
    localStorage: {
      getItem: (k) => (k in localStore ? localStore[k] : null),
      setItem: (k, v) => { localStore[k] = String(v); },
      removeItem: (k) => { delete localStore[k]; }
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    open: (url, name) => { openedCalls.push({ url, name }); return { focus() {} }; }
  };
  const ctx = {
    window: win,
    document: {
      readyState: 'complete',
      head: { appendChild() {} },
      body: { appendChild(c) { bodyKids.push(c); c.parentNode = this; return c; }, removeChild(c) { const idx = bodyKids.indexOf(c); if (idx >= 0) bodyKids.splice(idx, 1); } },
      createElement: mkEl,
      getElementById: () => null,
      querySelector: (sel) => bodyKids.find((x) => sel === '#' + x.id) || null,
      addEventListener() {},
      removeEventListener() {}
    },
    localStorage: win.localStorage,
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {}
  };
  vm.createContext(ctx);
  vm.runInContext(readUtf8('js/pu-appbar.js'), ctx);
  win.PuAppBar.auto();

  const barEl = bodyKids.find((x) => x.id === 'pu-orch-baton-bar');
  assert.ok(barEl, '도착 앱 화면에 오케스트레이션 바통 안내 띠가 표시되어야 합니다');
  const retBtn = barEl.children.find((c) => c.textContent === '흐름판 복귀');
  assert.ok(retBtn, '흐름판 복귀 단추가 있어야 합니다');
  retBtn.click();
  assert.equal(openedCalls.length, 1);
  assert.match(openedCalls[0].url, /^pu-orchestrator\.html\?tab=batons&sso=1&v=\d+$/);
  assert.equal(openedCalls[0].name, 'pu_pu_orchestrator');

  // PuOrchestratorView.dispatchToApp 도 도착 앱의 표준 창 이름(pu_pu_erp)으로 열어야 함
  win.PuOrchestratorCore = Core;
  vm.runInContext(readUtf8('js/pu-orchestrator-view.js'), ctx);
  openedCalls.length = 0;
  win.PuOrchestratorView.dispatchToApp('erp', 'pu-erp.html#menu=biz/contract', { id: 'b-test', title: '계약 확인' });
  assert.equal(openedCalls.length, 1);
  assert.match(openedCalls[0].url, /^pu-erp\.html\?sso=1&orchBaton=1&v=\d+#menu=biz\/contract$/);
  assert.equal(openedCalls[0].name, 'pu_pu_erp');
});

test('④ 화면 목록은 좌측 ☐ 고르기 칸 + № 순번 · 키보드 탭 이동 · 로컬 확인·보류 필터를 지원한다', () => {
  const viewSrc = readUtf8('js/pu-orchestrator-view.js');
  const htmlSrc = readUtf8('pu-orchestrator.html');

  assert.match(viewSrc, /class="col-ck"><label class="ck-hit"><input type="checkbox"/);
  assert.match(viewSrc, /class="col-no">/);
  assert.match(viewSrc, /ArrowRight/);
  assert.match(htmlSrc, /\.orch-tbl \.col-ck\{width:28px/);
  assert.match(htmlSrc, /\.orch-tbl \.col-no\{width:36px[^}]*tabular-nums/);

  const now = Date.now();
  const rep = Core.analyzeWorkspace({
    contractRequests: { 'r1': { id: 'r1', companyName: '(주)샘플', status: 'pending', createdAt: now } }
  }, {
    now, role: 'staff', localState: { checked: { 'creq:r1': now } }
  });
  assert.equal(Core.filterBatons(rep.batons, { showDone: false }).length, 0);
  assert.equal(Core.filterBatons(rep.batons, { showDone: true }).length, 1);
});
