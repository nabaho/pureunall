'use strict';
/* ══════════════════════════════════════════════════════════════════════════
 * 💬 푸른포털 시스템 길잡이 채팅방 · 간소화 UI · 자동 개선요청-답변-승인 폐루프 검증
 *    (tests/portal-chatbot.test.js)
 *
 * 검증 범위:
 *   1. 지식베이스·연결도 지도(PORTAL_FLOWS 6선 · PORTAL_ROWS_GUIDE 4대 영역 24개 앱) 및 RAG 정확도
 *   2. 개인·기업 식별정보 자동 마스킹(현재 질문 + 멀티턴 대화 맥락 + 자동 개선요청 티켓 본문·제목)
 *   3. 코딩·문제해결 필요 의도 자동 판별(detectImproveIntent — 단순 질문 오탐 차단 + 오류/개선 감지)
 *   4. 간소화 UI(PuChatbotUI) — 비사전 모드 범주줄 숨김, 우측하단 단추 비간섭 배치, 압축 연결도 칩
 *   5. 폐루프(자동 개선요청 접수 ➔ 실시간 개선 결과 답변 수신 ➔ 채팅자 승인 완성 / 미해결 재요청)
 *   6. enter.html portalChatImprove 다리(경로 이탈 차단·3중 기록·승인·재요청) 및 27색 팔레트·폰 16px
 * ══════════════════════════════════════════════════════════════════════════ */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PALETTE, colorOf, contrast } = require('./lib-palette');

const ROOT = path.join(__dirname, '..');
const readUtf8 = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const enterHtml = readUtf8('enter.html');
const fundHtml = readUtf8('fund.html');
const kbSrc = readUtf8('js/pu-chatbot-kb.js');
const uiSrc = readUtf8('js/pu-chatbot.js');
const fundKbSrc = readUtf8('fund_kb.js');

const PuChatbot = require(path.join(ROOT, 'js', 'pu-chatbot-kb.js'));

function loadWithFundKb() {
  const ctx = { console };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fundKbSrc, ctx);
  vm.runInContext(kbSrc, ctx);
  return ctx;
}

/* ── 1. 통합 지식베이스 · 연결도 지도 · RAG 검색 정확도 ── */
test('통합 지식베이스 & 연결도 지도: 4대 범주·6대 실무 연결도(PORTAL_FLOWS)·4대 영역 24개 앱 가이드(PORTAL_ROWS_GUIDE)가 완비되어 있다', () => {
  const ctx = loadWithFundKb();
  const C = ctx.PuChatbot;
  assert.ok(C, 'PuChatbot 전역 객체가 생성되어야 합니다');
  const all = C.allItems();
  assert.ok(all.length >= 70, '내장 항목 + 기금 유권해석 합계가 70건 이상이어야 합니다: ' + all.length);

  for (const cat of ['system', 'labor', 'govaid', 'fund']) {
    const sub = C.filter(cat, '');
    assert.ok(sub.length >= 6, cat + ' 범주 항목이 충분해야 합니다: ' + sub.length);
  }

  assert.equal(C.PORTAL_FLOWS.length, 6);
  for (const flow of C.PORTAL_FLOWS) {
    assert.ok(flow.id && flow.title && Array.isArray(flow.steps) && flow.steps.length >= 3);
    assert.equal(C.findFlowById(flow.id).id, flow.id);
    for (const st of flow.steps) {
      assert.ok(st.key && st.name && st.role && st.ask, flow.id + ' 단계 필드가 모두 채워져 있어야 합니다');
    }
  }
  assert.equal(C.findFlowById('NON-EXISTENT'), null);

  assert.deepEqual(Array.from(C.PORTAL_ROWS_GUIDE.map((r) => r.id)), ['client', 'store', 'sales', 'inside']);
  const totalRowApps = C.PORTAL_ROWS_GUIDE.reduce((sum, r) => sum + r.apps.length, 0);
  assert.equal(totalRowApps, 24, '포털 4대 영역 24개 앱 전체가 수록되어야 합니다');
  for (const r of C.PORTAL_ROWS_GUIDE) {
    for (const ap of r.apps) {
      assert.ok(ap.key && ap.name && ap.when && ap.from && ap.to && ap.ask, ap.key + ' 입출력 설명이 모두 있어야 합니다');
    }
  }
});

test('RAG 검색 & 간결 요약: 4대 영역·연결도·수임 순서·노동법·지원금·기금 질문을 정확히 연결하고 로컬 답변을 간결하게 요약한다', () => {
  const ctx = loadWithFundKb();
  const C = ctx.PuChatbot;

  const pConn = C.pick('푸른통합시스템에서 앱끼리 연결도가 어떻게 되어 있나요?');
  assert.ok(pConn.length > 0 && pConn[0].id === 'SYS-connect-01');
  assert.equal(pConn[0].flowId, 'flow-core');

  const pClient = C.pick('의뢰인 업무 줄에 있는 프로그램들은 각각 언제 어떻게 사용하고 연결되어 있나요?');
  assert.ok(pClient.length > 0 && pClient[0].id === 'SYS-row-client');

  const pStore = C.pick('자료함 줄에 있는 사진첩 기업정보함 업무관리 푸른 메일은 어떻게 연결해서 쓰나요?');
  assert.ok(pStore.length > 0 && pStore[0].id === 'SYS-row-store');

  const pSales = C.pick('영업관리 줄의 뉴스레터 홈페이지 회생광고 전광판 정부사업신청 사용법과 연결도');
  assert.ok(pSales.length > 0 && pSales[0].id === 'SYS-row-sales');
  assert.equal(pSales[0].flowId, 'flow-sales');

  const pInside = C.pick('내부관리 줄 인사관리 재무관리 컨설팅정산 경력관리 연결도');
  assert.ok(pInside.length > 0 && pInside[0].id === 'SYS-row-inside');

  const pNewco = C.pick('신규 거래처 맡았을 때 어떤 앱부터 어떤 순서로 입력하면 되나요?');
  assert.ok(pNewco.length > 0 && pNewco[0].id === 'SYS-onboard-newco');

  const pDiff = C.pick('정부사업일정이랑 컨설팅보고서, 정부사업신청 차이가 뭐야?');
  assert.ok(pDiff.length > 0 && pDiff[0].id === 'SYS-consult-01');
  assert.equal(pDiff[0].flowId, 'flow-gov');

  // 멀티턴 연속 대화 맥락 보조
  const pFollow = C.pick('그럼 거기서 초안 수정은 어떻게 해?', {
    history: [{ q: '컨설팅보고서와 정부사업일정 연결 방식은?' }]
  });
  assert.ok(pFollow.some((x) => x.id === 'SYS-consult-01' || x.flowId === 'flow-gov'));

  // 간결한 로컬 요약 답변 확인 (과도한 장문 방지)
  const loc = C.localAnswer(pSales, '영업관리 줄 설명해줘');
  assert.ok(loc.answer.length < 450, '로컬 답변은 한눈에 읽히도록 간결해야 합니다: ' + loc.answer.length);
  assert.match(loc.answer, /뉴스레터/);

  const pWage = C.pick('재직조건 붙은 정기상여금도 통상임금에 들어가나요?');
  assert.ok(pWage.length > 0 && pWage[0].id === 'LAB-wage-01');
  assert.match(pWage[0].a, /고정성.*폐기|전원합의체/);

  const pFund = C.pick('기금 감사가 복지기금협의회 위원이나 이사를 겸직할 수 있나요?');
  assert.ok(pFund.length > 0 && pFund[0].cat === 'fund');
});

/* ── 2. 코딩·문제해결 의도 판별(detectImproveIntent) 및 개인정보 마스킹 ── */
test('개선요청 자동 판별 & 개인정보 가림: 단순 사용법 질문은 오탐하지 않고 실제 오류·수정 요청만 잡아내며 개인정보를 가린다', () => {
  // 단순 사용법·법령 질문 → needed: false (오탐 방지)
  assert.equal(PuChatbot.detectImproveIntent('업무관리에 거래처 메일이 안 보일 때는 어떻게 연결해?').needed, false);
  assert.equal(PuChatbot.detectImproveIntent('푸른이알피에서 입금 매칭 오류 내역은 어디서 어떻게 확인하나요?').needed, false);
  assert.equal(PuChatbot.detectImproveIntent('기금 감사가 이사를 겸직할 수 있나요?').needed, false);
  assert.equal(PuChatbot.detectImproveIntent('연차 안 쓰면 수당은 어떻게 되나요?').needed, false);

  // 실제 화면 오류·기능 개선·코딩 수정 요청 → needed: true + 유효 분류키
  const d1 = PuChatbot.detectImproveIntent('푸른이알피에서 계약 저장 버튼이 안 눌려요 오류 확인해주세요');
  assert.equal(d1.needed, true);
  assert.equal(d1.cat, 'erp');
  assert.ok(PuChatbot.SG_CAT_ALLOW[d1.cat]);

  const d2 = PuChatbot.detectImproveIntent('기금관리 화면에 결산서 일괄 내려받기 기능 추가해줘');
  assert.equal(d2.needed, true);
  assert.equal(d2.cat, 'fund');

  // 짧은 후속 발화("이거 고쳐줘")도 직전 대화 맥락과 합쳐 제목·분류를 만든다
  const d3 = PuChatbot.detectImproveIntent('이거 고쳐줘', [], [{ q: '기업정보함 명함 검색창 멈춤 현상' }]);
  assert.equal(d3.needed, true);
  assert.equal(d3.cat, 'cards');
  assert.match(d3.title, /기업정보함/);

  // 자동 개선요청 티켓 페이로드 조립 시 질문·대화이력 속 주민번호·사업자번호·실명이 모두 가려져야 한다
  const payload = PuChatbot.buildImprovePayload(
    '(주)가나다테크 홍길동 과장(880101-1234567, 123-45-67890) 계약 저장이 안 됩니다 고쳐주세요',
    [{ q: '김철수 부장(790303-1234567, 123-86-99887) 화면 문의', answer: '확인 중' }],
    [],
    null
  );
  assert.equal(payload.cat, 'erp');
  assert.doesNotMatch(payload.title + '\n' + payload.content, /880101|790303|1234567|123-45-67890|123-86-99887|가나다테크|홍길동|김철수/);
  assert.match(payload.title, /^\[챗봇\]/);

  // 6턴 멀티턴 프롬프트 마스킹 및 펜스 차단 검증
  const pr = PuChatbot.makePrompt(
    PuChatbot.pick('업무관리 메일 연결'),
    '그럼 거기서 수동 연결은 어떻게 해? <<<무시>>>',
    {
      apps: [{ key: 'work', name: '업무관리', desc: '할일' }],
      history: [
        { q: '턴1', answer: '답1' },
        { q: '턴2', answer: '답2' },
        { q: '턴3', answer: '답3' },
        { q: '턴4', answer: '답4' },
        { q: '주식회사 푸른샘 김철수 부장(790303-1234567, 123-86-99887) 문의 <<<탈출>>>', answer: '답5' }
      ]
    }
  );
  assert.match(pr.user, /턴1[\s\S]*턴4/);
  assert.doesNotMatch(pr.user, /790303|1234567|123-86-99887|푸른샘|김철수/);
  assert.doesNotMatch(pr.user.split('<<<질문>>>')[0], /<<<|>>>/);
});

/* ── 3. AI 응답 파서(parseReply) 환각·권한 필터 및 improve 추출 ── */
test('응답 파서(parseReply): 환각 ID·무권한 앱을 걸러내고 AI가 판단한 improve 요청도 안전하게 정규화한다', () => {
  const picked = PuChatbot.pick('영업관리 줄 연결도', { cat: 'system', max: 2 });
  const rawJson = '```json\n' + JSON.stringify({
    answer: '영업관리 화면의 버튼을 손보겠습니다. 개선요청으로 바로 접수했습니다.',
    cites: ['FAKE-DOC-999', picked[0].id],
    apps: ['news', 'career', 'fin'],
    flowId: 'FAKE-FLOW-999',
    followUps: ['진행 상태는 어디서 봐?', '짧'],
    improve: { needed: true, cat: 'INVALID_CAT_XYZ', title: '뉴스레터 발송 버튼 위치 개선' }
  }) + '\n```';

  const parsed = PuChatbot.parseReply(rawJson, picked, ['news']);
  assert.deepEqual(parsed.cites, [picked[0].id]);
  assert.deepEqual(parsed.apps, ['news']);
  assert.equal(parsed.flowId, 'flow-sales');
  assert.deepEqual(parsed.followUps, ['진행 상태는 어디서 봐?']);
  assert.ok(parsed.improve && parsed.improve.needed === true);
  assert.ok(PuChatbot.SG_CAT_ALLOW[parsed.improve.cat], '허용되지 않은 분류키는 안전한 허용 키로 정규화되어야 합니다');

  const parsedNone = PuChatbot.parseReply(rawJson, picked, []);
  assert.deepEqual(parsedNone.apps, []);
});

/* ── 4. 간소화 UI & 폐루프(자동 개선요청 ➔ 결과 답변 ➔ 채팅자 승인 완성 / 재요청) 검증 ── */
function makeFakeDom(tileDefs) {
  const byId = {};
  const listeners = {};
  const launched = [];

  function makeEl(tag) {
    const attrs = {};
    const cls = new Set();
    const elListeners = {};
    const children = [];
    const el = {
      tagName: String(tag || 'DIV').toUpperCase(),
      id: '',
      className: '',
      value: '',
      disabled: false,
      textContent: '',
      style: {},
      dataset: {},
      children,
      parentNode: null,
      scrollTop: 0,
      scrollHeight: 240,
      classList: {
        add: (...names) => names.forEach((n) => cls.add(n)),
        remove: (...names) => names.forEach((n) => cls.delete(n)),
        contains: (n) => cls.has(n),
        toggle: (n, force) => {
          const on = force === undefined ? !cls.has(n) : !!force;
          if (on) cls.add(n); else cls.delete(n);
          return on;
        }
      },
      setAttribute(k, v) {
        attrs[k] = String(v);
        if (k === 'id') { el.id = String(v); byId[el.id] = el; }
        if (k.startsWith('data-')) {
          const dk = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          el.dataset[dk] = String(v);
        }
      },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
      appendChild(ch) {
        ch.parentNode = el;
        children.push(ch);
        if (ch.id) byId[ch.id] = ch;
        return ch;
      },
      addEventListener(ev, fn) { (elListeners[ev] = elListeners[ev] || []).push(fn); },
      dispatchEvent(evObj) { (elListeners[evObj.type] || []).forEach((fn) => fn(evObj)); },
      focus() { el._focused = true; },
      getBoundingClientRect: () => ({ left: 420, top: 140, width: 400, height: 500 }),
      closest: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    };
    let _html = '';
    Object.defineProperty(el, 'innerHTML', {
      configurable: true,
      get: () => _html,
      set: (v) => {
        el._innerHtmlSets = (el._innerHtmlSets || 0) + 1;
        _html = String(v || '');
        const re = /<([a-z0-9]+)\b([^>]*)>/gi;
        let m;
        while ((m = re.exec(_html))) {
          const idMatch = /\bid="([^"]+)"/.exec(m[2]);
          if (idMatch && !byId[idMatch[1]]) {
            const sub = makeEl(m[1]);
            sub.id = idMatch[1];
            byId[sub.id] = sub;
          }
        }
      }
    });
    return el;
  }

  const head = makeEl('head');
  const body = makeEl('body');
  const fab = makeEl('button');
  fab.setAttribute('id', 'chatFab');
  fab.style.display = 'inline-flex';
  const fabBadge = makeEl('span');
  fabBadge.setAttribute('id', 'chatFabBadge');
  fabBadge.style.display = 'none';
  fab.appendChild(fabBadge);
  body.appendChild(fab);

  const appRows = makeEl('div');
  appRows.setAttribute('id', 'appRows');
  const tiles = (tileDefs || []).map((td) => {
    const a = makeEl('a');
    a.className = 'tile';
    a.dataset.key = td.key;
    a.setAttribute('href', td.href || (td.key + '.html?sso=1'));
    a.setAttribute('title', td.name + ' — ' + (td.desc || ''));
    if (td.hidden) a.style.display = 'none';
    if (td.disabled) a.setAttribute('aria-disabled', 'true');
    a.querySelector = (sel) => (sel === '.tx b' ? { textContent: td.name } : null);
    a.click = () => launched.push({ key: td.key, via: 'click' });
    return a;
  });
  appRows.querySelectorAll = () => tiles;
  appRows.querySelector = (sel) => {
    const m = /data-key="([^"]+)"/.exec(sel);
    return m ? tiles.find((t) => t.dataset.key === m[1]) || null : null;
  };
  body.appendChild(appRows);

  const doc = {
    readyState: 'complete',
    head,
    body,
    documentElement: makeEl('html'),
    getElementById: (id) => byId[id] || null,
    createElement: (tag) => makeEl(tag),
    querySelectorAll: (sel) => (sel.includes('.tile') ? tiles : []),
    querySelector: (sel) => appRows.querySelector(sel),
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit: (ev, obj) => { (listeners[ev] || []).forEach((fn) => fn(obj)); }
  };

  const win = {
    document: doc,
    innerWidth: 1280,
    innerHeight: 800,
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    setTimeout,
    clearTimeout,
    Promise,
    portalLaunchApp: (key, extra) => {
      const t = tiles.find((x) => x.dataset.key === key);
      if (!t || t.style.display === 'none' || t.getAttribute('aria-disabled') === 'true' || t.getAttribute('href') === '#') return false;
      launched.push({ key, extra });
      return true;
    }
  };
  win.window = win;
  win.globalThis = win;
  return { win, doc, byId, launched };
}

test('PuChatbotUI: 간결한 첫 화면·범주줄 접기·자동 개선요청 접수 ➔ 실시간 결과 답변 수신 ➔ 채팅자 승인 완성·재요청이 정확히 동작한다', async () => {
  const { win, doc, byId } = makeFakeDom([
    { key: 'erp', name: '푸른이알피', desc: '업체·계약' },
    { key: 'fund', name: '기금관리', desc: '근로복지기금' },
    { key: 'fin', name: '재무관리', desc: '입출금', hidden: true }
  ]);

  // 가짜 portalChatImprove 다리 연결
  const submittedTickets = [];
  const approvedIds = [];
  const reopenedCalls = [];
  let subListener = null;
  let stopped = false;
  const liveResolved = {};

  win.portalChatImprove = {
    submit: async (opts) => {
      const id = 'IMP_' + (submittedTickets.length + 1);
      const rec = { id, ...opts, status: 'new', at: Date.now() };
      submittedTickets.push(rec);
      liveResolved[id] = { title: opts.title, cat: opts.cat, status: 'new', at: rec.at, seen: true, source: 'chatbot' };
      return rec;
    },
    approve: async (id) => {
      approvedIds.push(id);
      if (liveResolved[id]) {
        liveResolved[id] = { ...liveResolved[id], seen: true, resolvedOk: true, resolvedAt: Date.now() };
      }
      return { ok: true, id };
    },
    reopen: async (id, txt) => {
      const newId = 'IMP_RE_' + (reopenedCalls.length + 1);
      reopenedCalls.push({ id, txt, newId });
      if (liveResolved[id]) {
        liveResolved[id] = { ...liveResolved[id], seen: true, resolvedOk: false, feedback: txt };
      }
      liveResolved[newId] = { title: '↩ 재요청: ' + id, cat: 'erp', status: 'new', at: Date.now(), seen: true, source: 'chatbot', relatedId: id };
      return { ok: true, id: newId, relatedId: id, title: liveResolved[newId].title, cat: 'erp' };
    },
    subscribe: (fn) => {
      subListener = fn;
      fn(liveResolved, 'u1');
      return () => { subListener = null; };
    },
    stop: () => { stopped = true; },
    isAdmin: () => false
  };

  let aiCalls = 0;
  win.firebase = { auth: () => ({ currentUser: { uid: 'u1' } }) };
  win.PuAiCall = {
    ask: async () => {
      aiCalls++;
      return {
        text: JSON.stringify({
          answer: '푸른이알피 계약 저장 버튼 오류를 확인해 바로 개선요청으로 접수했습니다. 수정 결과가 오면 이 채팅방에서 알려드리겠습니다.',
          cites: [],
          apps: ['erp', 'fin'],
          flowId: 'flow-contract',
          followUps: ['저장 전 임시보관도 되나요?'],
          improve: { needed: true, cat: 'erp', title: '푸른이알피 계약 저장 버튼 클릭 먹통 수정' }
        })
      };
    },
    textOf: (r) => r.text
  };

  vm.createContext(win);
  vm.runInContext(fundKbSrc, win);
  vm.runInContext(kbSrc, win);
  vm.runInContext(uiSrc, win);

  // 1) 간결한 첫 화면: 채팅 모드에서는 #puChatCats 범주줄을 숨기고 한눈에 들어오는 알약 칩만 노출
  win.PuChatbotUI.open();
  assert.ok(byId.puChatWin && byId.puChatWin.parentNode === doc.body);
  assert.equal(byId.puChatCats.style.display, 'none', '채팅 모드에서는 범주 줄이 숨겨져 화면이 간결해야 합니다');
  assert.match(byId.puChatBody.innerHTML, /의뢰인 업무/);
  assert.match(byId.puChatBody.innerHTML, /전체 연결도/);

  // 사전 모드에서만 범주줄이 열린다
  win.PuChatbotUI.setMode('dict');
  assert.equal(byId.puChatCats.style.display, 'flex', '사전 모드에서는 범주 필터 줄이 열려야 합니다');
  win.PuChatbotUI.setMode('chat');
  assert.equal(byId.puChatCats.style.display, 'none');

  // 2) 대화 중 코딩·문제해결이 필요한 질문 전송 → 자동으로 개선요청 티켓 접수!
  await win.PuChatbotUI.ask('홍길동 과장(880101-1234567) 푸른이알피에서 계약 저장 버튼이 안 눌려요 고쳐주세요');
  assert.equal(aiCalls, 1);
  assert.equal(submittedTickets.length, 1, '코딩·오류 해결 필요 질문 시 자동으로 개선요청이 접수되어야 합니다');
  assert.equal(submittedTickets[0].cat, 'erp');
  assert.doesNotMatch(submittedTickets[0].content, /880101-1234567|홍길동/, '접수된 티켓 본문에서도 개인정보가 가려져야 합니다');
  assert.match(byId.puChatBody.innerHTML, /개선요청 접수됨/, '채팅 말풍선 안에 접수 상태 카드가 표시되어야 합니다');
  assert.doesNotMatch(byId.puChatBody.innerHTML, /data-chat-app="fin"/, '권한 숨김 앱은 노출되면 안 됩니다');

  // 이어서 다른 일반 대화를 계속 진행한 뒤 개선 결과가 도착하는 상황 시뮬레이션
  win.PuAiCall.ask = async () => ({
    text: JSON.stringify({
      answer: '자문계약서는 계약서등관리에서 전자서명 링크로 발송하실 수 있습니다. 위임장도 함께 보내시나요?',
      cites: [],
      apps: ['erp'],
      followUps: ['위임장 양식도 있어?'],
      improve: null
    })
  });
  await win.PuChatbotUI.ask('계약서 전자서명은 어디서 보내?');
  assert.equal(submittedTickets.length, 1, '일반 사용법 질문에는 개선요청이 자동 접수되면 안 됩니다');

  // 3) 개발·수정 완료되어 결과 답변이 실시간 도착 → 채팅방에 결과 말풍선 + 승인/재요청 단추 + 배지 점등!
  const ticketId = submittedTickets[0].id;
  liveResolved[ticketId] = {
    title: submittedTickets[0].title,
    cat: 'erp',
    status: 'done',
    reply: '원인: 계약 저장 단추의 중복 잠금이 풀리지 않던 문제를 고쳐 배포했습니다. 새로고침 후 저장해 보세요.',
    at: Date.now(),
    seen: false,
    source: 'chatbot'
  };
  subListener(liveResolved, 'u1');

  assert.equal(byId.chatFabBadge.style.display, 'inline-flex', '미승인 개선 결과 도착 시 머리줄 챗봇 배지가 켜져야 합니다');
  assert.equal(byId.chatFabBadge.textContent, '1');
  assert.match(byId.puChatBody.innerHTML, /개선 결과 도착 · 승인 대기/);
  assert.match(byId.puChatBody.innerHTML, /중복 잠금이 풀리지 않던 문제를 고쳐 배포했습니다/);
  assert.match(byId.puChatBody.innerHTML, /개선 확인 · 승인 \(완성\)/);

  // 4) 채팅자가 결과를 보고 개선되었다고 판단하여 승인 → 최종 완성 처리 및 배지 소거!
  await win.PuChatbotUI.approveTicket(ticketId);
  assert.deepEqual(approvedIds, [ticketId]);
  assert.equal(byId.chatFabBadge.style.display, 'none', '채팅자 승인 완료 시 미확인 배지가 꺼져야 합니다');
  assert.match(byId.puChatBody.innerHTML, /최종 완성되었습니다/);
  assert.match(byId.puChatBody.innerHTML, /승인 완료 · 최종 완성/);

  // 5) 또 다른 개선 건이 완료됐으나 채팅자가 보고 미해결로 판단해 보완 재요청하는 흐름 검증
  liveResolved.IMP_SECOND = {
    title: '[챗봇] 사진첩 목록 정렬 개선',
    cat: 'cards',
    status: 'done',
    reply: '최신순 정렬을 기본값으로 바꿨습니다.',
    at: Date.now(),
    seen: false,
    source: 'chatbot'
  };
  subListener(liveResolved, 'u1');
  assert.equal(byId.chatFabBadge.textContent, '1');

  await win.PuChatbotUI.reopenTicket('IMP_SECOND', '폰 화면에서는 아직 옛날 순서로 나옵니다');
  assert.equal(reopenedCalls.length, 1);
  assert.equal(reopenedCalls[0].id, 'IMP_SECOND');
  assert.match(reopenedCalls[0].txt, /폰 화면/);
  assert.equal(byId.chatFabBadge.style.display, 'none');
  assert.match(byId.puChatBody.innerHTML, /보완 재요청을 접수했습니다/);

  // 6) 로그아웃 시 대화·구독·배지 즉시 폐기
  win.PuChatbotUI.resetOnLogout();
  assert.equal(win.PuChatbotUI._state.logs.length, 0);
  assert.equal(stopped, true);
  assert.equal(byId.chatFab.style.display, 'none');
});

test('PuChatbotUI: AI 한도 초과(429) 시에도 코딩·오류 해결 질문이면 로컬 감지기로 개선요청을 자동 접수한다', async () => {
  const { win, byId } = makeFakeDom([{ key: 'erp', name: '푸른이알피', desc: '업체' }]);
  const submitted = [];
  win.firebase = { auth: () => ({ currentUser: { uid: 'u1' } }) };
  win.PuAiCall = {
    ask: () => Promise.reject(Object.assign(new Error('한도 초과'), { status: 429, overBudget: true })),
    textOf: () => ''
  };
  win.portalChatImprove = {
    submit: async (p) => {
      submitted.push(p);
      return { id: 'IMP_OFFLINE_1', ...p, status: 'new', at: Date.now() };
    },
    subscribe: () => () => {},
    stop: () => {}
  };

  vm.createContext(win);
  vm.runInContext(kbSrc, win);
  vm.runInContext(uiSrc, win);

  win.PuChatbotUI.open();
  await win.PuChatbotUI.ask('푸른이알피 업체 목록 화면이 깨져서 안 열려요');
  assert.equal(submitted.length, 1, 'AI 한도 초과 상태에서도 로컬 감지기로 개선요청이 자동 접수되어야 합니다');
  assert.equal(submitted[0].cat, 'erp');
  assert.match(byId.puChatBody.innerHTML, /개선요청 접수됨/);
});

test('PuChatbotUI: 사전 한글 IME 입력 중 input 엘리먼트 보존 · 첫 화면 다중 미승인 카드 유지 · 승인/재요청 중복 클릭 잠금', async () => {
  const { win, byId } = makeFakeDom([{ key: 'erp', name: '푸른이알피', desc: '업체' }]);
  let approveCalls = 0;
  let resolveApprove = null;
  let subFn = null;
  const liveMap = {
    IMP_A: { title: '[챗봇] 첫 번째 개선 결과', cat: 'erp', status: 'done', reply: '1번 수정 완료', at: 200, seen: false, source: 'chatbot' },
    IMP_B: { title: '[챗봇] 두 번째 개선 결과', cat: 'portal', status: 'done', reply: '2번 수정 완료', at: 100, seen: false, source: 'chatbot' }
  };

  win.portalChatImprove = {
    submit: async (p) => ({ id: 'IMP_X', ...p, status: 'new', at: Date.now() }),
    approve: (id) => {
      approveCalls++;
      return new Promise((res) => { resolveApprove = () => res({ ok: true, id }); });
    },
    reopen: async (id, txt) => ({ ok: true, id: 'IMP_RE_1', relatedId: id, title: txt, cat: 'erp' }),
    subscribe: (fn) => { subFn = fn; fn(liveMap, 'u1'); return () => {}; },
    stop: () => {}
  };

  vm.createContext(win);
  vm.runInContext(fundKbSrc, win);
  vm.runInContext(kbSrc, win);
  vm.runInContext(uiSrc, win);

  win.PuChatbotUI.open();
  assert.match(byId.puChatBody.innerHTML, /첫 번째 개선 결과/);
  assert.match(byId.puChatBody.innerHTML, /두 번째 개선 결과/);
  assert.match(byId.puChatBody.innerHTML, /안녕하세요! 무엇이 궁금하신가요\?/);

  // 1) 승인 단추 연속 중복 호출 시 1회만 요청되고 처리 중 disabled 표시
  const p1 = win.PuChatbotUI.approveTicket('IMP_A');
  const p2 = win.PuChatbotUI.approveTicket('IMP_A');
  assert.equal(approveCalls, 1, '승인 처리 중 중복 클릭은 차단되어야 합니다');
  assert.match(byId.puChatBody.innerHTML, /data-imp-approve="IMP_A"\s+disabled/);
  resolveApprove();
  await Promise.all([p1, p2]);

  // 2) 첫 화면에서 IMP_A 를 승인해도 아직 승인하지 않은 IMP_B 와 환영 안내 칩이 사라지지 않아야 한다
  assert.match(byId.puChatBody.innerHTML, /두 번째 개선 결과/, '남은 미승인 카드(IMP_B)가 계속 보여야 합니다');
  assert.match(byId.puChatBody.innerHTML, /안녕하세요! 무엇이 궁금하신가요\?/, '질문 전 첫 화면 안내와 빠른 칩이 유지되어야 합니다');
  assert.ok(subFn);

  // 3) 사전 모드에서 검색어를 입력할 때 #puChatBody 전체를 갈아엎지 않아 한글 조합(IME) 중인 #puChatDictInp 가 보존된다
  win.PuChatbotUI.setMode('dict');
  const setsBeforeInput = byId.puChatBody._innerHtmlSets || 0;
  byId.puChatDictInp.value = '연차';
  byId.puChatDictInp.dispatchEvent({ type: 'input', target: byId.puChatDictInp });
  assert.equal(byId.puChatBody._innerHtmlSets, setsBeforeInput, '사전 입력 중에는 #puChatBody.innerHTML 전체 교체가 일어나면 안 됩니다');
  assert.match(byId.puChatDictList.innerHTML, /연차/);
});

/* ── 5. enter.html portalChatImprove 다리 단위 검증 (경로 탈출 차단 · 3중 쓰기 · 승인 · 재요청) ── */
test('enter.html portalChatImprove: 경로 탈출 키를 차단하고 3대 건의 경로(private·meta·resolved)와 정확히 동기화한다', async () => {
  const marker = '/* ══ 💬 길잡이 채팅방 ↔ 건의·개선요청 폐루프 연동 다리 (portalChatImprove) ══';
  const start = enterHtml.indexOf(marker);
  assert.ok(start > 0, 'enter.html 에 portalChatImprove 코드 블록이 있어야 합니다');
  const objPos = enterHtml.indexOf('window.portalChatImprove = {', start);
  assert.ok(objPos > start);
  let idx = enterHtml.indexOf('{', objPos), depth = 0;
  while (idx < enterHtml.length) {
    if (enterHtml[idx] === '{') depth++;
    else if (enterHtml[idx] === '}') { depth--; if (depth === 0) { idx++; break; } }
    idx++;
  }
  const snippet = enterHtml.slice(start, idx) + ';';

  const writes = {};
  let pushSeq = 0;
  const sandbox = {
    window: {},
    SG: { uid: 'uid_staff_1', name: '테스트직원', email: 'staff@example.com', role: 'member' },
    SG_PRIVATE_PATH: 'suggestions_private',
    SG_META_PRIVATE_PATH: 'suggestions_meta_private',
    auth: { currentUser: { uid: 'uid_staff_1' } },
    sgResolvedUidPath: (u) => 'suggestions_resolved_private/' + u,
    sgCatClass: (c) => (['erp', 'portal', 'fund', 'cards'].includes(c) ? c : 'etc'),
    sgCatName: (c) => c,
    sgIsAdmin: () => false,
    sgUpdateBadge: () => { sandbox._badgeUpdated = (sandbox._badgeUpdated || 0) + 1; },
    sgOpen: () => {},
    sgViewDetail: () => {},
    db: {
      ref: (p) => ({
        push: () => {
          const key = 'PUSH_KEY_' + (++pushSeq);
          return {
            key,
            set: async (val) => { writes[p + '/' + key] = val; }
          };
        },
        set: async (val) => { writes[p] = val; },
        update: async (val) => { writes[p] = { ...(writes[p] || {}), ...val }; },
        on: () => {},
        off: () => {}
      })
    },
    Promise,
    Date
  };
  vm.createContext(sandbox);
  vm.runInContext(snippet, sandbox);

  const api = sandbox.window.portalChatImprove;
  assert.ok(api);

  // 1) 정상 접수 → 세 자리 모두 기록
  const res = await api.submit({ cat: 'erp', title: '[챗봇] 저장 버튼 개선', content: '상세 맥락' });
  assert.equal(res.id, 'PUSH_KEY_1');
  assert.equal(writes['suggestions_private/PUSH_KEY_1'].source, 'chatbot');
  assert.equal(writes['suggestions_meta_private/PUSH_KEY_1'].status, 'new');
  assert.equal(writes['suggestions_resolved_private/uid_staff_1/PUSH_KEY_1'].source, 'chatbot');

  // 2) 경로 이탈 문자(../ 등)는 즉시 거부해야 한다
  await assert.rejects(() => api.approve('../other_uid/hack'));
  await assert.rejects(() => api.reopen('bad/key', '내용'));

  // 3) 승인 → resolvedOk: true, seen: true 기록
  await api.approve('PUSH_KEY_1');
  assert.equal(writes['suggestions_resolved_private/uid_staff_1/PUSH_KEY_1'].resolvedOk, true);
  assert.equal(writes['suggestions_resolved_private/uid_staff_1/PUSH_KEY_1'].seen, true);

  // 4) 미해결 재요청 → relatedId 로 새 건의 생성 + 원본 resolvedOk: false 기록
  const re = await api.reopen('PUSH_KEY_1', '아직 클릭이 두 번 걸립니다');
  assert.equal(re.id, 'PUSH_KEY_2');
  assert.equal(writes['suggestions_private/PUSH_KEY_2'].relatedId, 'PUSH_KEY_1');
  assert.equal(writes['suggestions_resolved_private/uid_staff_1/PUSH_KEY_1'].resolvedOk, false);
});

/* ── 6. 배선 · 우측하단 비간섭 위치 · 27색 팔레트 · 모바일 16px 규칙 ── */
test('배선·위치·팔레트·모바일 규칙: 우측하단 단추와 겹치지 않는 배치, 27색 팔레트, 모바일 16px, fund.html 딥링크가 지켜진다', () => {
  const chatPos = enterHtml.indexOf('id="chatFab"');
  const sgPos = enterHtml.indexOf('id="sgFab"');
  assert.ok(chatPos > 0 && sgPos > chatPos, '#chatFab 은 머리줄 #sgFab 바로 앞에 위치해야 합니다');
  assert.match(enterHtml, /id="chatFabBadge"/, '#chatFab 안에 개선 결과 알림 배지가 있어야 합니다');
  assert.match(enterHtml, /chatImpStartWatch\(\)/, '로그인 시 개선요청 실시간 감시가 시작되어야 합니다');
  assert.match(enterHtml, /PuChatbotUI\.resetOnLogout\(\)/);

  // 우측 하단 ● 최신 · 📷 카메라 단추와 겹치지 않도록 PC 기본 bottom 여백이 충분히 띄워져 있는지 확인
  const winRule = /#puChatWin\{[^}]+\}/.exec(uiSrc);
  assert.ok(winRule, '#puChatWin 스타일 규칙이 있어야 합니다');
  const bottomMatch = /bottom:(\d+)px/.exec(winRule[0]);
  const zMatch = /z-index:(\d+)/.exec(winRule[0]);
  assert.ok(bottomMatch && Number(bottomMatch[1]) >= 72, '우측하단 단추와 겹치지 않도록 bottom 여백이 충분해야 합니다');
  assert.ok(zMatch && Number(zMatch[1]) >= 90, '하단 배지에 가려지지 않도록 z-index 가 확보되어야 합니다');

  // js/pu-chatbot.js 안의 모든 HEX 색상이 푸른 27색 팔레트 안에 있는지 검사
  const allowedHex = new Set([
    '#fff', '#ffffff', '#000', '#000000',
    ...Object.values(PALETTE).flat().map((c) => c.toLowerCase())
  ]);
  const hexes = uiSrc.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.ok(hexes.length >= 10);
  for (const h of hexes) {
    assert.ok(allowedHex.has(h.toLowerCase()), '푸른 27색 팔레트 밖 색상이 쓰였습니다: ' + h);
  }

  assert.match(uiSrc, /@media\s*\(max-width:768px\)\{#puChatInp,#puChatDictInp,\.puc-reopen-inp\{font-size:16px;\}\}/);
  assert.match(uiSrc, /calc\(100vh[^)]*\)/);
  assert.match(uiSrc, /#puChatHead\s+\.t\{[^}]*flex-shrink:0/);
  assert.match(uiSrc, /\.puc-reopen-send:focus-visible/);
  assert.match(uiSrc, /id="puChatBody"\s+aria-live="polite"/);
  assert.match(enterHtml, /#chatFab:focus-visible/);
  const sWaitRule = /\.puc-imp-st\.s-wait\{[^}]+\}/.exec(uiSrc);
  assert.ok(sWaitRule, '.puc-imp-st.s-wait 규칙이 있어야 합니다');
  assert.ok(
    contrast(colorOf(sWaitRule[0], 'background'), colorOf(sWaitRule[0], 'color')) >= 4.5,
    '.puc-imp-st.s-wait 배지는 WCAG AA 명암비(4.5:1 이상)를 만족해야 합니다'
  );
  assert.match(fundHtml, /openFundChat\(\)/);
});
