'use strict';
/* 공공임단협(aliounion) — 푸른통합시스템 별개 독립 프로그램(pu-alio-union.html) + 중앙(ALIO)·지방공공기관·지방산하단체(클린아이) 통합 + 기관 클릭 시 별개 창(openOrganWindow) + 기관 연혁·과거임단협 비교·유사기관 비교·비동기 인증키 경합 방어 검증 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const enterSrc = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
const appbarSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-appbar.js'), 'utf8');
const standaloneSrc = fs.readFileSync(path.join(ROOT, 'pu-alio-union.html'), 'utf8');
const uiSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-alio-union.js'), 'utf8');
const dataMod = require('../js/pu-alio-data.js');

test('① 포털(enter.html) 자료함(store) 줄과 앱바(pu-appbar.js)에 별개 독립 프로그램으로 「공공임단협(pu-alio-union.html)」이 등록되어 있다', () => {
  assert.match(enterSrc, /\{\s*key:'aliounion',\s*name:'공공임단협'[^}]*icon:'🤝',\s*url:'pu-alio-union\.html',\s*roles:null,\s*row:'store'\s*\}/);
  assert.match(appbarSrc, /\{\s*key:\s*'aliounion',\s*row:\s*'store',\s*name:\s*'공공임단협',\s*icon:\s*'🤝',\s*url:\s*'pu-alio-union\.html'/);
  assert.doesNotMatch(enterSrc, /app\.key === 'aliounion' && typeof window !== 'undefined' && window\.PuAlioUnion/);
});

test('② 독립 프로그램 화면(pu-alio-union.html)은 푸른통합시스템 표준 부품(pu-gate, pu-authsync, pu-appbar, pu-whoami, pu-back)을 갖추고 마운트한다', () => {
  assert.match(standaloneSrc, /<title>푸른노무법인 공공임단협<\/title>/);
  assert.match(standaloneSrc, /<script src="js\/pu-gate\.js\?v=\d+"><\/script>/);
  assert.match(standaloneSrc, /<script src="js\/pu-authsync\.js\?v=\d+"><\/script>/);
  assert.match(standaloneSrc, /<script src="js\/pu-appbar\.js\?v=\d+"><\/script>/);
  assert.match(standaloneSrc, /<script src="js\/pu-whoami\.js\?v=\d+"><\/script>/);
  assert.match(standaloneSrc, /PuWhoami\.mount\('#who'\)/);
  assert.match(standaloneSrc, /window\.PuAlioUnion\.mount\(rootEl,\s*\{\s*isModal:\s*false\s*\}\)/);
  assert.match(standaloneSrc, /window\.PuAlioUnion\.setAuthUser\(u \|\| null\)/);
});

test('③ 하나의 기관 클릭 시 별개의 독립 창(openOrganWindow)으로 열리며, 연혁 달력 유효성 검증·21021 분류·과거A/현행B 비교·유사기관 추천·배열 내 null 방어를 수행한다', () => {
  assert.match(uiSrc, /전 기관 노조·타임오프 현황/);
  assert.match(uiSrc, /기관별 연혁·과거임단협·유사기관 비교/);
  assert.match(uiSrc, /13대 핵심 쟁점 기관간 비교·원문 대조/);
  assert.match(uiSrc, /단체협약 조문 통합 검색/);
  assert.match(uiSrc, /기관별 공시·별도합의·내부규정 원문/);
  assert.match(uiSrc, /공공·법령 API 실시간 연동 센터/);
  assert.match(uiSrc, /function openOrganWindow\(aid/);
  assert.doesNotMatch(uiSrc, /\.slice\(0,\s*600\)/, '기관 선택 드롭다운이 600개로 잘리지 않아야 합니다');

  const openedCalls = [];
  const sandbox = {
    window: {},
    open: (url, name, specs) => {
      openedCalls.push({ url, name, specs });
      return { closed: false, opener: {} };
    },
    document: { addEventListener: () => {}, getElementById: () => null, head: { appendChild: () => {} } },
    URL
  };
  sandbox.window = sandbox;
  vm.runInNewContext(uiSrc, sandbox);

  // 기관 클릭 시 팝업 오버레이 대신 별개의 브라우저 창(pu-alio-union.html?organ=...)을 연다
  sandbox.PuAlioUnion.openOrganWindow('C0005');
  assert.equal(openedCalls.length, 1);
  assert.equal(openedCalls[0].url, 'pu-alio-union.html?organ=C0005');
  assert.equal(openedCalls[0].name, 'pureun-alio-organ-C0005');

  // 지방공공기관 클릭 시도 별개의 독립 창을 연다
  sandbox.PuAlioUnion.openOrganDetailModal('L_2007100231');
  assert.equal(openedCalls.length, 2);
  assert.equal(openedCalls[1].url, 'pu-alio-union.html?organ=L_2007100231');
  assert.equal(openedCalls[1].name, 'pureun-alio-organ-L_2007100231');

  // ① 기관 연혁 타임라인 생성 검증 (21021 가입정보는 STATUS로 분류됨)
  const c0005Timeline = sandbox.PuAlioUnion.buildOrganTimeline(dataMod, 'C0005');
  assert.ok(c0005Timeline.length >= 4, '강원랜드(C0005)의 연혁별 타임라인이 생성되어야 합니다');
  for (const item of c0005Timeline) {
    assert.match(item.date, /^(\d{4}-\d{2}-\d{2}|미상)$/, `타임라인 날짜(${item.date})가 YYYY-MM-DD 또는 미상이어야 합니다 (${item.title})`);
    if (item.ccode === '21021') {
      assert.equal(item.catGroup, 'STATUS', '21021(노동조합 가입정보)은 STATUS로 분류되어야 합니다');
    }
  }
  const c0005Agreements = c0005Timeline.filter((t) => t.catGroup === 'AGREEMENT');
  assert.ok(c0005Agreements.length >= 2, 'C0005의 단체협약·임금협약(AGREEMENT) 연혁이 2건 이상이어야 합니다');
  assert.ok(c0005Agreements[0].date >= c0005Agreements[1].date, '현행(index 0)이 과거(index 1)보다 최신이거나 같은 날짜여야 합니다');

  // ‘2026년도 10월 7일’ 정상 파싱, 무효 날짜(‘2026년 13월 99일’, ‘2026-02-31’) 거부 및 날짜 없는 항목 ‘미상’ 처리 검증
  const customTl = sandbox.PuAlioUnion.buildOrganTimeline({
    unions: [null],
    disclosures: [
      null,
      {
        dno: 'T1',
        aid: 'TEST',
        ccode: '21110',
        cname: '내부규정',
        title: '내부규정',
        edate: '2026년도 10월 7일',
        files: [
          { name: '인사규정.pdf', url: 'https://www.alio.go.kr/download/file.json?f=1' },
          { name: '보수규정_2024년 5월 3일.pdf', url: 'https://www.alio.go.kr/download/file.json?f=2' }
        ]
      },
      {
        dno: 'T2',
        aid: 'TEST',
        ccode: '21026',
        cname: '단체협약',
        title: '날짜오류 협약',
        edate: '2026년 13월 99일',
        rdate: '2026-02-31',
        files: []
      }
    ]
  }, 'TEST');
  assert.equal(customTl.length, 3);
  assert.equal(customTl[0].date, '2026-10-07');
  assert.equal(customTl[1].date, '2024-05-03');
  assert.equal(customTl[2].date, '미상', '존재하지 않는 달력 날짜(13월 99일, 2월 31일)는 거부되어 미상으로 처리되어야 합니다');

  // 배열 내 null 원소가 섞여 있어도 findSimilarOrgans가 예외 없이 동작
  const nullSafePeers = sandbox.PuAlioUnion.findSimilarOrgans({
    institutions: [null, ...dataMod.institutions.slice(0, 30)],
    unions: [null, ...dataMod.unions.slice(0, 40)],
    disclosures: [null, ...dataMod.disclosures.slice(0, 40)],
    metrics: [null]
  }, dataMod.institutions[0].apba_id, 'ALL');
  assert.ok(Array.isArray(nullSafePeers));

  // 첨부파일 URL 안전 검증(alio.go.kr 및 cleaneye.go.kr 허용, javascript: 차단)
  assert.equal(sandbox.PuAlioUnion.safeHttpUrl('https://www.alio.go.kr/download/file.json?f=1'), 'https://www.alio.go.kr/download/file.json?f=1');
  assert.equal(sandbox.PuAlioUnion.safeHttpUrl('https://www.cleaneye.go.kr/file/FileDownload.do?UPLOAD_FILENAME=a.pdf'), 'https://www.cleaneye.go.kr/file/FileDownload.do?UPLOAD_FILENAME=a.pdf');
  assert.equal(sandbox.PuAlioUnion.safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(sandbox.PuAlioUnion.safeHttpUrl('https://evil.example.com/phish.pdf'), '');
});

test('④ 데이터 스크립트 로드 실패 후 다시 시도(retry) 시 실패한 스크립트를 제거하고 정상 재요청하며, 계정 전환/로그아웃/Firebase 저장 비동기 경합을 안전하게 처리한다', async () => {
  const pendingCallbacks = {};
  let setPromiseReject = null;
  const headChildren = [];

  function makeEl(tag) {
    const listeners = {};
    const attrs = {};
    const el = {
      tagName: (tag || 'DIV').toUpperCase(),
      innerHTML: '',
      textContent: '',
      value: '',
      style: {},
      dataset: {},
      parentNode: null,
      classList: { toggle: () => {} },
      setAttribute: (k, v) => { attrs[k] = v; },
      getAttribute: (k) => attrs[k] || '',
      appendChild: (c) => {
        c.parentNode = el;
        headChildren.push(c);
      },
      removeChild: (c) => {
        const idx = headChildren.indexOf(c);
        if (idx >= 0) headChildren.splice(idx, 1);
        c.parentNode = null;
      },
      addEventListener: (ev, fn) => {
        listeners[ev] = fn;
      },
      trigger: (ev, arg) => {
        if (listeners[ev]) listeners[ev](arg);
      },
      focus: () => {},
      querySelector: (sel) => {
        if (sel === '[data-pau-body]') return bodyEl;
        if (sel === '[data-pau-retry]') return retryBtn;
        if (sel === '[data-api-key-in]') return keyInputEl;
        if (sel === '[data-api-key-save]') return saveBtnEl;
        return makeEl('DIV');
      },
      querySelectorAll: (sel) => {
        if (sel === '.pau-tab') return [tabApiBtn];
        return [];
      }
    };
    return el;
  }

  const bodyEl = makeEl('DIV');
  const retryBtn = makeEl('BUTTON');
  const keyInputEl = makeEl('INPUT');
  const saveBtnEl = makeEl('BUTTON');
  const tabApiBtn = makeEl('BUTTON');
  tabApiBtn.setAttribute('data-tab', 'apihub');

  const lsMap = {};
  const sandbox = {
    window: {},
    PU_ALIO_DATA: null,
    localStorage: {
      getItem: (k) => lsMap[k] || null,
      setItem: (k, v) => { lsMap[k] = String(v); },
      removeItem: (k) => { delete lsMap[k]; }
    },
    firebase: {
      apps: [{}],
      database: () => ({
        ref: (p) => ({
          once: () => ({
            then: (fn) => {
              pendingCallbacks[p] = fn;
              return { catch: () => {} };
            }
          }),
          set: () => new Promise((_, reject) => {
            setPromiseReject = reject;
          })
        })
      })
    },
    document: {
      head: makeEl('HEAD'),
      body: makeEl('BODY'),
      createElement: (t) => makeEl(t),
      getElementById: () => null,
      querySelector: (sel) => {
        if (sel === 'script[data-pu-alio-data="1"]') {
          return headChildren.find((c) => c.dataset && c.dataset.puAlioData === '1') || null;
        }
        return null;
      },
      addEventListener: () => {}
    },
    fetch: () => Promise.resolve({ ok: false }),
    URL,
    URLSearchParams
  };
  sandbox.window = sandbox;
  vm.runInNewContext(uiSrc, sandbox);

  const root = makeEl('DIV');
  // 1) 초기 마운트 시 데이터 스크립트 에러 발생 시뮬레이션
  sandbox.PuAlioUnion.mount(root, { isModal: false });
  const firstScript = headChildren.find((c) => c.dataset && c.dataset.puAlioData === '1');
  assert.ok(firstScript, '첫 번째 데이터 스크립트 태그가 생성되어야 합니다');
  firstScript.onerror();
  assert.match(root.innerHTML, /다시 시도/, '로드 실패 시 다시 시도 버튼이 표시되어야 합니다');
  assert.equal(headChildren.includes(firstScript), false, '실패한 스크립트는 DOM에서 제거되어야 합니다');

  // 2) 다시 시도 클릭 시 새 스크립트로 정상 로드
  sandbox.PU_ALIO_DATA = {
    updatedAt: '2026-11-12',
    institutions: dataMod.institutions.slice(0, 5),
    unions: dataMod.unions.slice(0, 5),
    disclosures: dataMod.disclosures.slice(0, 5),
    metrics: dataMod.metrics.slice(0, 5),
    articles: dataMod.articles.slice(0, 5),
    revisions: {}
  };
  retryBtn.trigger('click');
  assert.match(root.innerHTML, /공공임단협/, '재시도 성공 후 본 화면이 렌더링되어야 합니다');

  // 3) 계정 A 조회 → 계정 B 전환 → B 응답 → A 지연 응답 경합 시 화면 DOM 및 localStorage 검증
  sandbox.PuAlioUnion.setAuthUser({ uid: 'userA_123456' });
  const cbA = pendingCallbacks['gov/userA_123456/key_data'];
  sandbox.PuAlioUnion.setAuthUser({ uid: 'userB_654321' });
  const cbB = pendingCallbacks['gov/userB_654321/key_data'];

  cbB({ val: () => 'KEY_OF_USER_B' });
  cbA({ val: () => 'SECRET_KEY_OF_USER_A' });

  tabApiBtn.trigger('click');
  assert.match(bodyEl.innerHTML, /KEY_OF_USER_B/, 'API 탭에 현재 계정 B의 키만 표시되어야 합니다');
  assert.doesNotMatch(bodyEl.innerHTML, /SECRET_KEY_OF_USER_A/, '이전 계정 A의 지연 응답 키가 화면에 노출되면 안 됩니다');

  // 4) 로그아웃 시 진행 중 응답 무효화 및 키 초기화
  sandbox.PuAlioUnion.setAuthUser(null);
  assert.doesNotMatch(bodyEl.innerHTML, /KEY_OF_USER_B/, '로그아웃 후에는 화면에 이전 인증키가 남아있지 않아야 합니다');

  // 5) Firebase set() 실패 시 동기화 완료로 오표시하지 않고 실패 안내
  sandbox.PuAlioUnion.setAuthUser({ uid: 'userB_654321' });
  tabApiBtn.trigger('click');
  keyInputEl.value = 'NEW_KEY_B';
  saveBtnEl.trigger('click');
  assert.ok(setPromiseReject, 'Firebase set Promise가 생성되어야 합니다');
  setPromiseReject(new Error('PERMISSION_DENIED'));
  await new Promise((r) => setTimeout(r, 10));
  assert.match(bodyEl.innerHTML, /서버 동기화 실패/, 'Firebase 저장 거부 시 서버 동기화 실패 상태가 표시되어야 합니다');
});

test('⑤ 내장된 공공임단협 데이터(pu-alio-data.js)에 중앙공공기관(355곳) + 지방공공기관·지방산하단체(1,332곳) 및 과거 임단협 비교 데이터(revisions)가 모두 수록되어 있다', () => {
  assert.ok(dataMod && dataMod.updatedAt, '데이터 갱신일 정보가 없습니다');
  assert.ok(Array.isArray(dataMod.institutions) && dataMod.institutions.length >= 1680, '중앙+지방 공공기관·산하단체 목록이 1,680개 이상이어야 합니다');

  const centralInsts = dataMod.institutions.filter((i) => !String(i.apba_id || '').startsWith('L_'));
  const localInsts = dataMod.institutions.filter((i) => String(i.apba_id || '').startsWith('L_'));
  const localCorps = localInsts.filter((i) => String(i.inst_type || '').startsWith('지방공사') || String(i.inst_type || '').startsWith('지방공단'));
  const localAffils = localInsts.filter((i) => String(i.inst_type || '').startsWith('지방출자') || String(i.inst_type || '').startsWith('지방출연'));

  assert.ok(centralInsts.length >= 350, '중앙공공기관(ALIO)이 350개 이상이어야 합니다');
  assert.ok(localInsts.length >= 1300, '지방공공기관·지방산하단체(클린아이)가 1,300개 이상이어야 합니다');
  assert.ok(localCorps.length >= 150, '지방공사·지방공단이 150개 이상 포함되어야 합니다');
  assert.ok(localAffils.length >= 850, '지방출자·출연기관(산하단체)이 850개 이상 포함되어야 합니다');

  assert.ok(Array.isArray(dataMod.unions) && dataMod.unions.length >= 1900, '중앙+지방 노동조합 행이 1,900개 이상이어야 합니다');
  assert.ok(Array.isArray(dataMod.disclosures) && dataMod.disclosures.length >= 4000, '중앙+지방 공시·협약·규정 목록이 4,000건 이상이어야 합니다');
  assert.ok(Array.isArray(dataMod.metrics) && dataMod.metrics.length >= 900, '단체협약 13대 핵심 쟁점 지표가 900건 이상이어야 합니다');
  assert.ok(Array.isArray(dataMod.articles) && dataMod.articles.length >= 900, '구조화 단협 조문 데이터가 900건 이상이어야 합니다');
  assert.ok(dataMod.revisions && Object.keys(dataMod.revisions).length >= 300, '과거 임단협 vs 현행 임단협 비교(revisions) 대상 기관이 300곳 이상이어야 합니다');
});
