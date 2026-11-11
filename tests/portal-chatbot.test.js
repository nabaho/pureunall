'use strict';
/* ══════════════════════════════════════════════════════════════════════════
 * 🤖 푸른포털 통합 AI 챗봇 검증 (tests/portal-chatbot.test.js)
 *
 * 검증 범위:
 *   1. 지식베이스·RAG 정확도 (포털 시스템 24개 앱 · 노동법 · 정부지원금 · 기금 fund_kb.js 통합)
 *   2. 개인·기업 식별정보 자동 마스킹 및 프롬프트 펜스(<<< >>>) 탈출 차단
 *   3. AI 응답 파서 환각 인용번호 제거 및 무권한 앱 키 차단(빈 배열 포함)
 *   4. 플로팅 메신저 UI(PuChatbotUI) 동작 — 열기/닫기, 중복 전송 차단, 로그아웃 초기화(epoch),
 *      권한·준비중·PC전용 앱 우회 실행 차단, 한도 초과 시 로컬 근거 답변 유지, 원문 모달
 *   5. enter.html · fund.html 배선 및 27색 팔레트·모바일 입력 확대 방지 준수
 * ══════════════════════════════════════════════════════════════════════════ */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PALETTE } = require('./lib-palette');

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

/* ── 1. 통합 지식베이스 & RAG 검색 정확도 ── */
test('통합 지식베이스: 4대 범주(system·labor·govaid·fund)와 fund_kb.js 유권해석이 모두 병합된다', () => {
  const ctx = loadWithFundKb();
  const C = ctx.PuChatbot;
  assert.ok(C, 'PuChatbot 전역 객체가 생성되어야 합니다');
  const all = C.allItems();
  assert.ok(all.length >= 65, '내장 항목 + 기금 유권해석 합계가 65건 이상이어야 합니다: ' + all.length);

  for (const cat of ['system', 'labor', 'govaid', 'fund']) {
    const sub = C.filter(cat, '');
    assert.ok(sub.length >= 6, cat + ' 범주 항목이 충분해야 합니다: ' + sub.length);
  }
});

test('RAG 검색: 시스템·노동법·정부지원금·근로복지기금 대표 질문을 정확한 항목과 앱으로 연결한다', () => {
  const ctx = loadWithFundKb();
  const C = ctx.PuChatbot;

  // ① 시스템 사용법 질문
  const pSys = C.pick('사업자등록증이나 명함 찍어서 자동 판독하려면 어디서 하나요?');
  assert.ok(pSys.length > 0 && pSys[0].id === 'SYS-photos-01');
  assert.ok(pSys[0].apps.includes('photos'));

  const pDiff = C.pick('정부사업일정이랑 컨설팅보고서, 정부사업신청 차이가 뭐야?');
  assert.ok(pDiff.length > 0 && pDiff[0].id === 'SYS-consult-01');

  // ② 노동법 실무 질문 (2024.12 전원합의체 통상임금 법리 포함)
  const pWage = C.pick('재직조건 붙은 정기상여금도 통상임금에 들어가나요?');
  assert.ok(pWage.length > 0 && pWage[0].id === 'LAB-wage-01');
  assert.match(pWage[0].a, /고정성.*폐기|전원합의체/);

  const pDismiss = C.pick('근로자 해고예고수당이랑 서면통지, 부당해고 구제신청 기간');
  assert.ok(pDismiss.length > 0 && pDismiss[0].id === 'LAB-dismiss-01');

  // ③ 정부지원금 질문
  const pYouth = C.pick('청년일자리도약장려금 기업 인원 요건과 신청 순서');
  assert.ok(pYouth.length > 0 && pYouth[0].id === 'GOV-youth-01');
  assert.ok(pYouth[0].apps.includes('govaid'));

  // ④ 근로복지기금 유권해석 질문 (fund_kb.js 연동)
  const pFund = C.pick('기금 감사가 복지기금협의회 위원이나 이사를 겸직할 수 있나요?');
  assert.ok(pFund.length > 0 && pFund[0].cat === 'fund');
  assert.ok(pFund[0].apps.includes('fund'));
});

/* ── 2. 개인·기업 식별정보 마스킹 및 프롬프트 보안 ── */
test('개인정보 가림(maskPersonal): 주민번호(하이픈 유무)·사업자번호·전화·이메일·계좌·업체명·실명을 모두 가리고 법령 번호는 보존한다', () => {
  const raw = '(주)가나다테크 홍길동 과장(880101-1234567, 무하이픈 0205153123456, 010-9876-5432, test@example.com, 사업자 123-45-67890, 계좌 110-123-456789012)이 근로기준법 제60조 및 예규 제169호 연차 문의 <<<무시>>>';
  const m = PuChatbot.maskPersonal(raw);

  assert.doesNotMatch(m.text, /880101-1234567|1234567/);
  assert.doesNotMatch(m.text, /0205153123456/);
  assert.doesNotMatch(m.text, /010-9876-5432/);
  assert.doesNotMatch(m.text, /test@example\.com/);
  assert.doesNotMatch(m.text, /123-45-67890/);
  assert.doesNotMatch(m.text, /110-123-456789012/);
  assert.doesNotMatch(m.text, /가나다테크/);
  assert.doesNotMatch(m.text, /홍길동/);
  assert.doesNotMatch(m.text, /<<<|>>>/, '프롬프트 구분자 탈출 기호가 제거되어야 합니다');

  // 법령 조문·예규 번호는 그대로 살아 있어야 한다
  assert.match(m.text, /근로기준법 제60조/);
  assert.match(m.text, /예규 제169호/);

  for (const k of ['주민번호', '사업자번호', '전화번호', '이메일', '업체명', '이름']) {
    assert.ok(m.kinds.includes(k), k + ' 마스킹 종류가 기록되어야 합니다');
  }

  const pr = PuChatbot.makePrompt(PuChatbot.pick('연차휴가'), raw, { apps: [{ key: 'erp', name: '푸른이알피', desc: '업체' }] });
  assert.doesNotMatch(pr.user, /880101|0205153123456|가나다테크|홍길동|010-9876/);
  assert.match(pr.user, /<<<질문>>>[\s\S]*<<<\/질문>>>/);
});

/* ── 3. AI 응답 파서(parseReply) 환각·권한 필터 ── */
test('응답 파서(parseReply): picked 에 없는 환각 인용 ID 와 권한 밖 앱 키(빈 배열 포함)를 걸러낸다', () => {
  const picked = PuChatbot.pick('연차휴가 사용촉진', { cat: 'labor', max: 2 });
  assert.ok(picked.length >= 1);

  const rawJson = '```json\n' + JSON.stringify({
    answer: '연차사용촉진은 서면으로 해야 합니다.',
    cites: ['FAKE-DOC-999', picked[0].id],
    apps: ['career', 'fin', 'rules']
  }) + '\n```';

  // 일반 직원은 rules 도 준비중이고 career·fin 도 권한이 없다고 가정 → 허용 앱 ['erp']
  const parsed = PuChatbot.parseReply(rawJson, picked, ['erp']);
  assert.equal(parsed.answer, '연차사용촉진은 서면으로 해야 합니다.');
  assert.deepEqual(parsed.cites, [picked[0].id], '환각 ID FAKE-DOC-999 는 제거되어야 합니다');
  assert.deepEqual(parsed.apps, [], '허용 목록에 없는 career·fin·rules 는 제거되어야 합니다');

  // 허용 앱이 빈 배열([])일 때도 모든 앱 키가 차단되어야 한다
  const parsedNone = PuChatbot.parseReply(rawJson, picked, []);
  assert.deepEqual(parsedNone.apps, [], '허용 앱이 [] 이면 어떤 앱 키도 통과하면 안 됩니다');
});

/* ── 4. 플로팅 메신저 UI (PuChatbotUI) 동작 및 보안 검증 ── */
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
      scrollHeight: 200,
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
      dispatchEvent(evObj) {
        (elListeners[evObj.type] || []).forEach((fn) => fn(evObj));
      },
      focus() { el._focused = true; },
      getBoundingClientRect: () => ({ left: 400, top: 120, width: 430, height: 560 }),
      closest: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    };
    let _html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => _html,
      set: (v) => {
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

test('PuChatbotUI: body 직계 부착, AI 응답 반영, 원문 상세 모달, 중복 요청 차단, 로그아웃 시 대화·진행중 응답 즉시 폐기', async () => {
  const { win, doc, byId } = makeFakeDom([
    { key: 'erp', name: '푸른이알피', desc: '업체·계약' },
    { key: 'fund', name: '기금관리', desc: '근로복지기금' },
    { key: 'fin', name: '재무관리', desc: '입출금', hidden: true },
    { key: 'rules', name: '기업규정집', desc: '취업규칙', disabled: true },
    { key: 'localonly', name: '로컬전용', desc: 'PC전용', href: '#' }
  ]);

  let aiCalls = 0;
  let pendingResolve = null;
  win.firebase = { auth: () => ({ currentUser: { uid: 'u1' } }) };
  win.PuAiCall = {
    ask: (parts, opts) => {
      aiCalls++;
      assert.equal(opts.app, 'portal');
      assert.equal(opts.manual, true);
      // 프롬프트에 마스킹 전 주민번호가 없어야 한다
      assert.doesNotMatch(parts[0].text, /880101-1234567/);
      return new Promise((resolve) => { pendingResolve = resolve; });
    },
    textOf: (r) => r.text
  };

  vm.createContext(win);
  vm.runInContext(fundKbSrc, win);
  vm.runInContext(kbSrc, win);
  vm.runInContext(uiSrc, win);

  // 1) 열기 → #puChatWin 은 document.body 직계 자식이어야 함(backdrop-filter 함정 회피)
  win.PuChatbotUI.open();
  const chatWin = byId.puChatWin;
  assert.ok(chatWin && chatWin.parentNode === doc.body, '#puChatWin 은 document.body 직계에 붙어야 합니다');
  assert.equal(byId.chatFab.getAttribute('aria-expanded'), 'true');

  // 2) 첫 질문 전송 → busy 동안 중복 전송은 무시되어야 함
  const p1 = win.PuChatbotUI.ask('홍길동 과장(880101-1234567) 기금 감사 겸직 가능한가요?');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(aiCalls, 1);
  await win.PuChatbotUI.ask('연속 중복 클릭 질문');
  assert.equal(aiCalls, 1, '응답 대기 중 중복 질문은 차단되어야 합니다');

  // 로컬 답변이 먼저 표시되고 마스킹 안내가 떠야 함
  assert.match(byId.puChatBody.innerHTML, /개인·기업 식별정보/);

  // AI 응답 완료 → 환각 앱(fin/rules/localonly)은 걸러지고 허용된 fund 만 남음
  const topFundId = win.PuChatbotUI._state.logs[0].cites[0];
  pendingResolve({
    text: JSON.stringify({
      answer: '기금 감사는 복지기금협의회 위원이나 이사를 겸직할 수 없습니다.',
      cites: [topFundId, 'HALLUCINATED-99'],
      apps: ['fund', 'fin', 'rules', 'localonly']
    })
  });
  await p1;
  assert.equal(win.PuChatbotUI._state.busy, false);
  assert.deepEqual(Array.from(win.PuChatbotUI._state.logs[0].cites), [topFundId]);
  assert.deepEqual(Array.from(win.PuChatbotUI._state.logs[0].apps), ['fund'], '숨김(fin)·준비중(rules)·PC전용(localonly) 앱은 노출되면 안 됩니다');
  assert.match(byId.puChatBody.innerHTML, /겸직할 수 없습니다/);

  // 3) 근거 원문 상세 모달 열기
  win.PuChatbotUI.openDocDetail(topFundId);
  assert.ok(byId.puChatDocModal && byId.puChatDocModal.classList.contains('on'));
  assert.match(byId.puChatDocBody.innerHTML, /기금 전문 챗봇으로 열기/);

  // 4) 두 번째 질문 진행 중 로그아웃(resetOnLogout) → 새 사용자 질문 진행 중 옛 응답이 도착해도 busy·답변을 오염시키지 않음
  let resolveStale = null;
  let resolveFresh = null;
  win.PuAiCall.ask = () => new Promise((resolve) => {
    if (!resolveStale) resolveStale = resolve;
    else resolveFresh = resolve;
  });
  const p2 = win.PuChatbotUI.ask('연차유급휴가 발생 기준');
  await new Promise((r) => setTimeout(r, 10));
  const staleTurn = win.PuChatbotUI._state.logs[win.PuChatbotUI._state.logs.length - 1];
  assert.equal(staleTurn.q, '연차유급휴가 발생 기준');
  win.PuChatbotUI.resetOnLogout();
  assert.equal(win.PuChatbotUI._state.logs.length, 0);
  assert.ok(!chatWin.classList.contains('on'));
  assert.equal(byId.chatFab.style.display, 'none');

  // 새 사용자가 로그인해 새 질문을 보낸 상태에서 이전 사용자의 지연 응답이 도착함
  win.PuChatbotUI.open();
  const p3 = win.PuChatbotUI.ask('퇴직금 지급 기한');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(win.PuChatbotUI._state.busy, true);

  resolveStale({ text: JSON.stringify({ answer: '로그아웃 뒤 도착한 응답', cites: [], apps: [] }) });
  await p2;
  assert.equal(staleTurn.aiText, '', '폐기된 턴에 지연 AI 응답이 기록되면 안 됩니다');
  assert.equal(win.PuChatbotUI._state.busy, true, '이전 세션 지연 응답이 새 세션의 busy 잠금을 해제하면 안 됩니다');

  resolveFresh({ text: JSON.stringify({ answer: '퇴직일로부터 14일 이내 지급해야 합니다.', cites: [], apps: [] }) });
  await p3;
  assert.equal(win.PuChatbotUI._state.busy, false);
  assert.equal(win.PuChatbotUI._state.logs.length, 1);
});

test('PuChatbotUI: AI 한도 초과(429) 시에도 내장 근거 답변을 유지하고 안내 문구를 표시한다', async () => {
  const { win, byId } = makeFakeDom([{ key: 'govaid', name: '기업정부지원금', desc: '지원금' }]);
  win.firebase = { auth: () => ({ currentUser: { uid: 'u1' } }) };
  win.PuAiCall = {
    ask: () => Promise.reject(Object.assign(new Error('한도 초과'), { status: 429, overBudget: true })),
    textOf: () => ''
  };

  vm.createContext(win);
  vm.runInContext(kbSrc, win);
  vm.runInContext(uiSrc, win);

  win.PuChatbotUI.open();
  await win.PuChatbotUI.ask('청년일자리도약장려금 요건');
  assert.equal(win.PuChatbotUI._state.logs.length, 1);
  assert.match(byId.puChatBody.innerHTML, /청년일자리도약장려금/);
  assert.match(byId.puChatBody.innerHTML, /내장 근거 사전 답변/);
});

test('권한 안전 실행(portalLaunchApp): 허용된 타일만 열고 숨김·준비중·PC전용 타일은 거부한다', () => {
  const start = enterHtml.indexOf('window.portalLaunchApp = function');
  assert.ok(start > 0, 'enter.html 에 window.portalLaunchApp 정의가 있어야 합니다');
  const end = enterHtml.indexOf('};', start) + 2;
  const fnCode = enterHtml.slice(start, end);

  const opened = [];
  const tiles = {
    fund: { style: {}, getAttribute: (k) => (k === 'href' ? 'fund.html?sso=1' : null) },
    finHidden: { style: { display: 'none' }, getAttribute: (k) => (k === 'href' ? 'pu-erp.html?app=fin&sso=1' : null) },
    rulesSoon: { style: {}, getAttribute: (k) => (k === 'aria-disabled' ? 'true' : (k === 'href' ? 'rules-v2.html?sso=1' : null)) },
    pcOnly: { style: {}, getAttribute: (k) => (k === 'href' ? '#' : null) }
  };
  const sandbox = {
    window: {},
    APPS: [
      { key: 'fund', url: 'fund.html' },
      { key: 'finHidden', url: 'pu-erp.html?app=fin' },
      { key: 'rulesSoon', url: 'rules-v2.html' },
      { key: 'pcOnly', url: 'local.html' },
      { key: 'offApp', url: 'off.html', off: true }
    ],
    document: {
      querySelector: (sel) => {
        const m = /data-key="([^"]+)"/.exec(sel);
        return m ? tiles[m[1]] || null : null;
      }
    },
    isMobile: () => false,
    openPortalApp: (app, url) => opened.push({ key: app.key, url }),
    Date,
    Math
  };
  vm.createContext(sandbox);
  vm.runInContext(fnCode, sandbox);

  assert.equal(sandbox.window.portalLaunchApp('finHidden'), false, '권한 숨김 앱은 실행되면 안 됩니다');
  assert.equal(sandbox.window.portalLaunchApp('rulesSoon'), false, '준비중(aria-disabled) 앱은 실행되면 안 됩니다');
  assert.equal(sandbox.window.portalLaunchApp('pcOnly'), false, 'PC전용(href=#) 앱은 폰에서 실행되면 안 됩니다');
  assert.equal(sandbox.window.portalLaunchApp('offApp'), false, 'off 앱은 실행되면 안 됩니다');
  assert.equal(sandbox.window.portalLaunchApp('unknown'), false, '없는 앱은 실행되면 안 됩니다');

  assert.equal(sandbox.window.portalLaunchApp('fund', 'chat=1'), true);
  assert.equal(opened.length, 1);
  assert.match(opened[0].url, /^fund\.html\?sso=1&v=\d+&chat=1$/);
});

/* ── 5. enter.html · fund.html 배선 및 디자인 규칙(27색·폰 16px) ── */
test('배선·팔레트·모바일 규칙: 머리줄 #chatFab, 스크립트 버전, 27색 팔레트, fund.html ?chat=1 딥링크가 연결되어 있다', () => {
  // 1) 머리줄 건의하기 바로 왼쪽에 #chatFab 배치
  const chatPos = enterHtml.indexOf('id="chatFab"');
  const sgPos = enterHtml.indexOf('id="sgFab"');
  assert.ok(chatPos > 0 && sgPos > chatPos, '#chatFab 은 머리줄 #sgFab 바로 앞에 위치해야 합니다');
  assert.match(enterHtml, /\.pbar #chatFab\{order:4;\}/);
  assert.match(enterHtml, /#chatFab\{[^}]*display:none;/, '로그인 전에는 #chatFab 이 숨겨져 있어야 합니다');
  assert.match(enterHtml, /\$\('chatFab'\)\.style\.display\s*=\s*'inline-flex'/, '로그인 후 sgSetUser 에서 #chatFab 을 노출해야 합니다');
  assert.match(enterHtml, /PuChatbotUI\.resetOnLogout\(\)/, '로그아웃 시 챗봇 초기화가 호출되어야 합니다');

  // 2) 스크립트 캐시 버전 배선
  assert.match(enterHtml, /<script src="js\/pu-ai-call\.js\?v=\d+"><\/script>/);
  assert.match(enterHtml, /<script src="js\/pu-chatbot-kb\.js\?v=\d+"><\/script>/);
  assert.match(enterHtml, /<script src="js\/pu-chatbot\.js\?v=\d+"><\/script>/);

  // 3) js/pu-chatbot.js 안의 모든 HEX 색상이 푸른 27색 팔레트 안에 있는지 검사
  const allowedHex = new Set([
    '#fff', '#ffffff', '#000', '#000000',
    ...Object.values(PALETTE).flat().map((c) => c.toLowerCase())
  ]);
  const hexes = uiSrc.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.ok(hexes.length >= 10, '챗봇 스타일 색상이 추출되어야 합니다');
  for (const h of hexes) {
    assert.ok(allowedHex.has(h.toLowerCase()), '푸른 27색 팔레트 밖 색상이 쓰였습니다: ' + h);
  }

  // 4) 모바일 입력칸 자동 확대 방지 (16px) 및 화면 높이 상대식(calc(100vh...))
  assert.match(uiSrc, /@media\s*\(max-width:768px\)\{#puChatInp,#puChatDictInp\{font-size:16px;\}\}/);
  assert.match(uiSrc, /calc\(100vh[^)]*\)/);

  // 5) fund.html ?chat=1 자동 챗봇 열기 및 주소창 정리(새로고침 시 재실행 방지)
  assert.match(fundHtml, /\[?&\]chat=1/);
  assert.match(fundHtml, /searchParams\.delete\('chat'\)/);
  assert.match(fundHtml, /openFundChat\(\)/);
});
