'use strict';
/* 🗂 담당자함 개인별 소분류 · 3단 자동정리 · 원클릭 규칙 학습 · 처리완료 체크 검증
   (대표 지시 2026-11-18 「개인이 들어온 메일을 나눠서 정리하는 기능 · 고객사 노무·급여 기본 첫 화면 + 자동 정리 + 규칙 학습 + 완료 체크」)
   1) 담당자함(@직원) 진입 시 기본 탭은 「⚡ 고객사 노무·급여(work)」이며, 법인회계·청구서(acct)와 법인총무·잡무(ops) 건수는 옆 탭 배지로 표시된다.
   2) 같은 세무회계법인 발신이라도 고객사 원천징수·급여 메일은 「고객사 노무·급여」로, 우리 법인 앞 세금계산서·한전·통신·카드·이카운트 청구서는 「법인회계·청구서」로 정확히 갈린다.
   3) 개인이 메일을 다른 소분류로 옮기면서 발신자·제목 단어 자동규칙을 켜면 과거·신규 메일까지 자동 분류된다.
   4) 처리완료(✓) 체크 시 할 일 탭에서 비워지고 「✅ 처리완료」 탭으로 모이며, 전체 탭 합계는 누락 없이 일치한다.
   5) 개인 맞춤 새 소분류 탭 추가·순서 조정·기본 탭 변경이 정상 동작한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');

function cut(from, to) {
  const i = src.indexOf(from);
  assert.ok(i > 0, from + ' 를 찾지 못했습니다');
  const j = src.indexOf(to, i + from.length);
  assert.ok(j > i, to + ' 를 찾지 못했습니다');
  return src.slice(i, j);
}

function createMailCtx() {
  const wrote = {};
  const state = {
    view: 'mail', mailSent: 'box', mbBox: '*all', tab: 'card', group: 'all', owner: 'all',
    isAdmin: false, groups: {}, pick: {}, matPick: '', sentBox: {}, schedBox: {},
    mbQ: '', mbFilter: '', mbTab: '', mbCursor: -1, mbOpen: null, mbDash: 'who',
    items: {
      c1: { id: 'c1', kind: 'card', name: '박세무', email: 'tax@dara-cpa.kr', company: '가나병원' },
    },
    mbMineOpen: true,
  };
  const domMap = {};
  const el = (id) => {
    if (!domMap[id]) {
      domMap[id] = {
        innerHTML: '', value: '', checked: false, style: {}, offsetHeight: 120, scrollTop: 0,
        focus() {}, select() {}, contains: () => false,
        getBoundingClientRect: () => ({ left: 100, top: 100 }),
        classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      };
    }
    return domMap[id];
  };
  const dbRef = (p) => ({
    once: () => Promise.resolve({ val: () => wrote[p] || null }),
    set: (v) => { wrote[p] = v; return Promise.resolve(); },
    update: (v) => { wrote[p] = Object.assign(wrote[p] || {}, v); return Promise.resolve(); },
    remove: () => { delete wrote[p]; return Promise.resolve(); },
    orderByKey() { return this; },
    limitToLast() { return this; },
  });
  let panelHtml = '';
  const ctx = {
    console, Object, Array, String, Number, Math, JSON, RegExp, Set, Date, Promise,
    setTimeout: () => 0, clearTimeout() {}, atob: () => '',
    state,
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    Store: { mode: 'firebase' },
    DB_ROOT: 'pucards',
    matMailCfg: () => ({ from: '370-6@daum.net' }),
    matList: () => [], matCat: () => '', MAT_CATS_NOW: () => [], _matMeta: {}, _matLoaded: true,
    loadMaterials() {}, schedList: () => [],
    staffName: (e) => (String(e || '') === 'a903@pureun.kr' ? '홍길동' : String(e || '')),
    fmtDate: () => '2026.11.18', fmtMB: (n) => n + 'B',
    allItems: () => state.items, allGroups: () => ({}),
    isPrivGroup: () => false, canSeeGroup: () => true,
    coList: () => [], coTagList: () => [], coFTabList: () => [],
    coFTabCounts: () => ({ all: 0, byTab: {} }), _coFolders: {}, _coTagHidden: {},
    toast() {}, confirm: () => true, prompt: (_m, d) => d, closeFolderMenu() {},
    showPanel: (h) => { panelHtml = h; }, _closeBtn: () => '<button>✕</button>',
    toggleSidebar() {}, openSettingsPage() {}, openMatPage() {}, openMailPage() {},
    openSentBox() {}, openSchedBox() {}, openInbox() {}, closeMailPage() {},
    openPrivateVault() {}, migrateLockedFolders() {}, openWhoPage() {},
    inboxBoxHtml: () => '', schedBoxHtml: () => '', sentBoxHtml: () => '', mailWriteHtml: () => '',
    wireMailWrite() {},
    pickOf: (k) => (state.pick[k] = state.pick[k] || {}),
    pickOn: (sel, id) => !!(sel && sel[id]),
    pickList: (sel, ids) => (ids || []).filter((i) => !!(sel && sel[i])),
    pickAllOn: (sel, ids) => !!(ids && ids.length) && ids.every((i) => !!(sel && sel[i])),
    pickClear: (k) => { state.pick[k] = {}; },
    pickHit: (k, id) => { const s = (state.pick[k] = state.pick[k] || {}); s[id] = !s[id]; },
    pickToggleAll() {}, pickRedraw() {},
    render() {}, renderPCSide() {}, renderMailPage() {}, mbDrawSoon() {},
    window: { innerWidth: 1440, innerHeight: 900 },
    document: {
      getElementById: el, addEventListener() {}, removeEventListener() {},
      body: { classList: { contains: () => true } },
    },
    $: el,
    firebase: {
      auth: () => ({ currentUser: { uid: 'U_KIM', email: 'a903@pureun.kr' } }),
      database: () => ({ ref: dbRef }),
    },
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ ok: true }) }),
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-mail-fill-core.js'), 'utf8') + ';var PuMailFill = this.PuMailFill || (typeof window !== "undefined" && window.PuMailFill);', ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-mgr-watch-core.js'), 'utf8') + ';var PuMgrWatch = this.PuMgrWatch || (typeof window !== "undefined" && window.PuMgrWatch);', ctx);
  vm.runInContext(cut('const ErpMatch = {', '\nfunction autoFolderFlush('), ctx);
  vm.runInContext(cut('function pcItem(attrs', '\nfunction switchTab('), ctx);

  const folders = {
    F_PAY: { slug: 'F_PAY', path: '2.급여+사무대행', name: '2.급여+사무대행', kind: 'custom', order: 2, total: 1, unseen: 1 },
    F_TAX: { slug: 'F_TAX', path: '12. 세금계산서', name: '12. 세금계산서', kind: 'custom', order: 12, total: 2, unseen: 1 },
    F_IN:  { slug: 'F_IN',  path: 'INBOX', name: 'INBOX', kind: 'inbox', order: 1, total: 2, unseen: 1 },
    F_OPS: { slug: 'F_OPS', path: '사무실업무관련', name: '사무실업무관련', kind: 'custom', order: 15, total: 1, unseen: 0 },
  };
  const msgs = {
    F_PAY: {
      '101': { u: 101, f: '박세무 (다라회계법인)', e: 'tax@dara-cpa.kr', t: '370-6@daum.net', s: '가나병원 중도퇴사자 원천징수영수증 송부', d: 1794980005, r: 0, a: 1, an: ['원천징수영수증.pdf'] },
    },
    F_TAX: {
      '201': { u: 201, f: '다라회계법인(분사무소)', e: 'tax@dara-cpa.kr', t: '370-6@daum.net', s: '[다라회계법인 님]으로부터 발행 세금계산서가 도착했습니다.', d: 1794980004, r: 0, a: 0 },
      '202': { u: 202, f: '한국전력공사', e: 'bill@kepco.co.kr', t: '370-6@daum.net', s: '2026년 11월분 전기요금 청구서', d: 1794980003, r: 1, a: 0 },
    },
    F_IN: {
      '301': { u: 301, f: '(주)이카운트', e: 'bill@ecount.com', t: '370-6@daum.net', s: '(주)이카운트에서 청구서가 도착하였습니다.', d: 1794980002, r: 1, a: 0 },
      '302': { u: 302, f: '정인사 (가나병원)', e: 'hr@gana-hosp.kr', t: '370-6@daum.net', s: '11월 급여대장 검토 요청드립니다', d: 1794980001, r: 1, a: 1, an: ['11월급여.xlsx'] },
    },
    F_OPS: {
      '401': { u: 401, f: '보안센터', e: 'alert@portal-sec.kr', t: '370-6@daum.net', s: '새로운 환경 로그인 보안 경고 안내', d: 1794980000, r: 1, a: 0 },
    },
  };

  vm.runInContext(
    '_mbFolders = ' + JSON.stringify(folders) + ';' +
    '_mbMsgs = ' + JSON.stringify(msgs) + ';' +
    '_mbBins = {}; _mbPut = {}; _mbPutBy = {}; _mbHide = {}; _mbSucc = {}; _mbNotCo = {}; _mbNoWho = {};' +
    '_mbNotSpam = {}; _mbSpamOff = false; _mbSub = {}; _mbSubLoadedUid = "pucards_private/U_KIM/mailSub"; _mbWorkLink = {}; _mbPush = {}; _mbBoxWho = {};' +
    '_mbOwner = { "bill@kepco,co,kr": "홍길동", "bill@ecount,com": "홍길동", "alert@portal-sec,kr": "홍길동" };' +
    '_mbCo = { "hr@gana-hosp,kr": "가나병원" };' +
    '_mbWhoMsg = {}; _mbOrder = {}; _mbWhoOrder = {}; _mbCkSkip = {}; _mbMeta = { at: 1, ok: true };',
    ctx
  );
  const EM = vm.runInContext('ErpMatch', ctx);
  EM.byName = { [EM._norm('가나병원')]: { id: 'co1', company: '가나병원', main: '홍길동', subs: [], left: false } };
  EM.byBiz = {};
  EM.byTaxEmail = { 'tax@dara-cpa.kr': [{ id: 'co1', coName: '가나병원', main: '홍길동', subs: [] }] };
  EM.staff = {
    [EM._norm('홍길동')]: { sid: 'A-903', name: '홍길동', ord: 30, role: 'staff', title: '과장', status: 'active' },
  };
  EM.nameByEmail = { 'a903@pureun.kr': '홍길동' };
  EM.companies = [{ id: 'co1', name: '가나병원', managerMain: 'A-903', status: 'active' }];
  EM.ready = true;
  ctx.myEmail = 'a903@pureun.kr';
  ctx._dom = domMap;
  ctx._wrote = wrote;
  ctx._panel = () => panelHtml;
  return ctx;
}

test('★★★ 담당자함 진입 시 「고객사 노무·급여」가 기본 첫 화면이며, 회계·청구서 및 총무·잡무가 정확히 분리된다', () => {
  const c = createMailCtx();
  c.openMailBox('@홍길동');

  assert.equal(c.mbSubActiveTab(), 'work', '처음 담당자함을 열면 고객사 노무·급여(work) 탭이 기본이어야 한다');

  const tally = c.mbSubTally('@홍길동');
  assert.equal(tally.byTab.work, 2, '세무법인의 고객사 원천징수영수증(101)과 고객사 급여대장(302)만 노무·급여 탭에 모여야 한다');
  assert.equal(tally.byTab.acct, 3, '세무법인의 우리 법인 세금계산서(201), 한전 청구서(202), 받은메일함 이카운트 청구서(301)는 법인회계·청구서 탭으로 가야 한다');
  assert.equal(tally.byTab.ops, 1, '로그인 보안 경고(401)는 법인총무·잡무 탭으로 가야 한다');
  assert.equal(tally.byTab.work + tally.byTab.acct + tally.byTab.ops + tally.done, tally.all, '탭별 합계가 전체 메일 수와 정확히 일치해야 한다');

  // 기본 화면 목록에는 긴급 본업(노무·급여) 2건만 노출되어 청구서 더미에 묻히지 않는다
  const workRows = c.mbMatchedRows();
  assert.equal(workRows.length, 2);
  assert.ok(workRows.some((r) => String(r.u) === '101'), '같은 다라회계법인 발신이라도 고객사 원천징수영수증은 노무·급여에 남아야 한다');
  assert.ok(!workRows.some((r) => String(r.u) === '201'), '다라회계법인이 발행한 세금계산서는 노무·급여 화면에서 빠져야 한다');

  // 상단 소분류 바에 옆 탭 건수가 함께 표시된다
  const listHtml = c.mbListHtml();
  assert.match(listHtml, /법인회계·청구서/);
  assert.match(listHtml, /법인총무·잡무/);
});

test('★★★ 처리완료 체크 시 할 일 목록에서 비워져 완료 탭으로 모이고, 자동정리 규칙 학습과 커스텀 탭 추가가 동작한다', () => {
  const c = createMailCtx();
  c.openMailBox('@홍길동');

  // 1) 한 통(101)을 처리완료 체크하면 노무·급여 탭은 1통으로 줄고 완료 탭은 1통이 된다
  c.mbSubToggleDone('F_PAY', '101');
  assert.equal(c.mbMatchedRows().length, 1, '처리완료한 메일은 진행중 본업 탭에서 즉시 비워져야 한다');
  c.mbSubPickTab('done');
  assert.equal(c.mbMatchedRows().length, 1, '처리완료 탭에서 방금 완료한 메일을 볼 수 있어야 한다');

  // 2) 커스텀 소분류 탭(예: 카드·공과금) 추가 후 키워드 자동규칙 학습 적용
  c._dom.mbSubNewIcon = { value: '💳' };
  c._dom.mbSubNewName = { value: '카드·공과금' };
  c.mbSubAddTab();
  const customTab = c.mbSubTabs('홍길동').find((t) => t.name === '카드·공과금');
  assert.ok(customTab, '새 개인 소분류 탭이 생성되어야 한다');

  c.mbSubPickTab('acct');
  c.state.mbSubOne = 'F_TAX:202';
  c._dom.mbSubLearnAddr = { checked: false };
  c._dom.mbSubLearnKw = { value: '전기요금' };
  c._dom.mbSubApplyPast = { checked: true };
  c.mbSubApplyMove(customTab.id, true);

  c.mbSubPickTab(customTab.id);
  const customRows = c.mbMatchedRows();
  assert.equal(customRows.length, 1, '학습된 단어 규칙으로 전기요금 메일이 새 커스텀 탭으로 자동 정리되어야 한다');
  assert.equal(String(customRows[0].u), '202');

  // 3) 탭 순서 조정(mbSubOrderTab) 및 기본 첫 화면 탭 변경(mbSubSetDefTab) 동작 확인
  const beforeOrder = c.mbSubTabs('홍길동').map((t) => t.id);
  const lastIdx = beforeOrder.length - 1;
  c.mbSubOrderTab(customTab.id, -1);
  const afterOrder = c.mbSubTabs('홍길동').map((t) => t.id);
  assert.equal(afterOrder[lastIdx - 1], customTab.id, '탭 위로 이동 시 순서가 한 칸 올라가야 한다');

  c.mbSubSetDefTab('acct');
  assert.equal(c.mbSubDefaultTab('홍길동'), 'acct', '기본 첫 화면 탭 변경이 저장·반영되어야 한다');

  // 4) 과거 메일 적용 체크 해제(mbSubApplyPast=false) 시 기존 과거 메일은 그대로 두고 이후 도착 메일에만 적용된다
  vm.runInContext('_mbMsgs.F_IN["303"] = { u: 303, f: "(주)이카운트", e: "bill@ecount.com", t: "370-6@daum.net", s: "(주)이카운트 옛 청구서 안내", d: 1794970000, r: 1, a: 0 }; mbMemoClear();', c);
  c.state.mbSubOne = 'F_IN:301';
  c._dom.mbSubLearnAddr = { checked: false };
  c._dom.mbSubLearnKw = { value: '이카운트' };
  c._dom.mbSubApplyPast = { checked: false };
  c.mbSubApplyMove(customTab.id, true);

  c.mbSubPickTab('acct');
  assert.ok(c.mbMatchedRows().some((r) => String(r.u) === '303'), '과거 메일 적용을 껐으면 선택하지 않은 과거 메일(303)은 기존 탭(acct)에 남아야 한다');

  const futureTs = Date.now() + 60000;
  vm.runInContext('_mbMsgs.F_IN["304"] = { u: 304, f: "(주)이카운트", e: "bill@ecount.com", t: "370-6@daum.net", s: "(주)이카운트 신규 청구서 안내", d: ' + futureTs + ', r: 0, a: 0 }; mbMemoClear();', c);
  c.mbSubPickTab(customTab.id);
  assert.ok(c.mbMatchedRows().some((r) => String(r.u) === '304'), '규칙 생성 시점 이후에 새로 들어온 메일(304)은 새 탭으로 자동 분류되어야 한다');

  // 5) 드래그앤드롭(mbSubTabDrop)은 숨겨진 메뉴(#folderMenu)의 이전 체크·단어를 읽지 않는다
  c._dom.mbSubLearnAddr = { checked: true };
  c._dom.mbSubLearnKw = { value: '절대등록금지단어' };
  c.state.pick = { mbox: { 'F_IN:302': true } };
  c.mbSubPickTab('work');
  c.state.mbDrag = { kind: 'mail' };
  c.mbSubTabDrop({ preventDefault() {} }, 'ops', null);
  const kwRulesAfterDrop = Object.values(c.mbSubRec('홍길동').kw || {});
  assert.ok(!kwRulesAfterDrop.some((r) => r.kw === '절대등록금지단어'), '드래그앤드롭 시 이전 메뉴의 숨겨진 입력값이 규칙으로 등록되면 안 된다');

  // 6) 서버 격리 경로(pucards_private/$uid/mailSub) 저장 및 악성 탭 ID 필터링 검증
  assert.ok(Object.keys(c._wrote).some((p) => p.startsWith('pucards_private/U_KIM/mailSub/')), '본인 전용 격리 경로(pucards_private/$uid/mailSub)에만 저장되어야 한다');
  vm.runInContext('_mbSub["A-903"].tabs.push({ id: "bad\');alert(1);//", name: "악성탭" }); _mbSubRev++; mbMemoClear();', c);
  assert.ok(!c.mbSubTabs('홍길동').some((t) => t.id.indexOf("'") >= 0 || t.id.indexOf('(') >= 0), '비정상 문자가 섞인 DB 탭 ID는 차단되어야 한다');
});
