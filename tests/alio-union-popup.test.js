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
  assert.ok(Array.isArray(dataMod.articles) && dataMod.articles.length >= 1400, '구조화 단협 조문 데이터가 1,400건 이상이어야 합니다');
  const localArts = dataMod.articles.filter((a) => String(a.apba_id || '').startsWith('L_'));
  assert.ok(localArts.length >= 500, '지방공공기관·유관기관 단협 및 사규 조문이 500개 이상 수록되어야 합니다');
  assert.ok(dataMod.revisions && Object.keys(dataMod.revisions).length >= 380, '과거 임단협 vs 현행 임단협 비교(revisions) 대상 기관이 380곳 이상이어야 합니다');
});

test('⑥ 지방공기업평가원(L_ERC) 및 행안부 산하 지방유관기관(KLID·KRILA·KILF·LOFA·POBA) 6곳이 모두 수록되고, openCleaneyeDirect로 클린아이(지방공기업·출자출연기관) POST 직결 및 평가원 원문 연결이 정확히 작동한다', () => {
  const moisAids = ['L_ERC', 'L_KLID', 'L_KRILA', 'L_KILF', 'L_LOFA', 'L_POBA'];
  for (const maid of moisAids) {
    const inst = dataMod.institutions.find((i) => i && i.apba_id === maid);
    assert.ok(inst, `${maid} 기관이 institutions에 수록되어야 합니다`);
    const uList = dataMod.unions.filter((u) => u && u.apba_id === maid);
    assert.ok(uList.length >= 1, `${maid} 노동조합 현황이 unions에 수록되어야 합니다`);
    const dList = dataMod.disclosures.filter((d) => d && d.aid === maid);
    assert.ok(dList.length >= 2, `${maid} 공시·협약·규정이 disclosures에 2건 이상 수록되어야 합니다`);
    assert.ok(dataMod.revisions[maid] && dataMod.revisions[maid].length >= 1, `${maid} 과거↔현행 개정 비교(revisions)가 수록되어야 합니다`);
    const aList = dataMod.articles.filter((a) => a && a.apba_id === maid);
    assert.ok(aList.length >= 2, `${maid} 조문 데이터가 articles에 수록되어야 합니다`);
  }

  let submittedForms = [];
  let openedUrls = [];
  let shouldThrowOnSubmit = false;
  const sandbox = {
    window: {},
    PU_ALIO_DATA: dataMod,
    open: (url, target, specs) => {
      openedUrls.push({ url, target, specs });
      return { closed: false, opener: {} };
    },
    document: {
      head: { appendChild: () => {} },
      body: {
        appendChild: () => {},
        removeChild: () => {}
      },
      createElement: (tag) => {
        const children = [];
        const el = {
          tagName: String(tag || '').toUpperCase(),
          method: '',
          action: '',
          target: '',
          style: {},
          parentNode: null,
          appendChild: (c) => { children.push(c); },
          submit: () => {
            if (shouldThrowOnSubmit) {
              throw new Error('FORM_SUBMIT_BLOCKED');
            }
            submittedForms.push({
              method: el.method,
              action: el.action,
              target: el.target,
              inputs: Object.fromEntries(children.map((c) => [c.name, c.value]))
            });
          }
        };
        return el;
      },
      getElementById: () => null,
      addEventListener: () => {}
    },
    URL
  };
  sandbox.window = sandbox;
  vm.runInNewContext(uiSrc, sandbox);

  // 1) 지방공기업(광주교통공사 L_2007100231 · 도시철도공사 006001) 클린아이 POST 직결 검증
  const resEmp = sandbox.PuAlioUnion.openCleaneyeDirect('L_2007100231', 'union_info');
  assert.equal(resEmp.mode, 'POST');
  assert.equal(resEmp.url, 'https://www.cleaneye.go.kr/user/empWorkUnionInfo.do');
  assert.equal(resEmp.fields.entId, '2007100231');
  assert.equal(resEmp.fields.entKind, '006001');
  assert.equal(resEmp.fields.itemId, 'workUnionInfo');
  assert.equal(resEmp.fields.itemNo, '14_2');
  assert.equal(submittedForms.length, 1);
  assert.equal(submittedForms[0].action, 'https://www.cleaneye.go.kr/user/empWorkUnionInfo.do');
  assert.equal(submittedForms[0].inputs.entId, '2007100231');

  // 2) 지방출자·출연기관(L_B000013) 클린아이 POST 직결 검증 (내부규정·정관 rules 포함)
  const resIpt = sandbox.PuAlioUnion.openCleaneyeDirect('L_B000013', 'union_info');
  assert.equal(resIpt.mode, 'POST');
  assert.equal(resIpt.url, 'https://www.cleaneye.go.kr/user/iptUnionCnvt.do');
  assert.equal(resIpt.fields.entId, 'B000013');
  assert.equal(resIpt.fields.itemId, 'iptUnionCnvt');
  assert.equal(resIpt.fields.itemNo, '90_25');

  const resIptRules = sandbox.PuAlioUnion.openCleaneyeDirect('L_B000013', 'rules');
  assert.equal(resIptRules.mode, 'POST');
  assert.equal(resIptRules.url, 'https://www.cleaneye.go.kr/user/iptSuOrdinance.do');
  assert.equal(resIptRules.fields.itemNo, '90_40');

  // 3) 지방공기업평가원(L_ERC), 한국지역정보개발원(L_KLID), 대한지방행정공제회(L_POBA) 세부 공시 URL 연결 검증
  const resErc = sandbox.PuAlioUnion.openCleaneyeDirect('L_ERC', 'manual');
  assert.equal(resErc.mode, 'URL');
  assert.match(resErc.url, /erc\.re\.kr.*BBSMSTR_000000000571/);
  const resKlid = sandbox.PuAlioUnion.openCleaneyeDirect('L_KLID', 'union_info');
  assert.equal(resKlid.mode, 'URL');
  assert.match(resKlid.url, /klid\.or\.kr.*workjoin_disc_s2/);
  const resPobaLabor = sandbox.PuAlioUnion.openCleaneyeDirect('L_POBA', 'union_info');
  assert.equal(resPobaLabor.mode, 'URL');
  assert.match(resPobaLabor.url, /poba\.or\.kr\/mno\/mno01\/mno0102\/mno010201#tab1-9/);
  const resPobaRules = sandbox.PuAlioUnion.openCleaneyeDirect('L_POBA', 'rules');
  assert.equal(resPobaRules.mode, 'URL');
  assert.match(resPobaRules.url, /poba\.or\.kr\/mno\/mno01\/mno0106\/mno010601/);

  // 4) 잘못된 기관코드 또는 빈 값 전달 시 ERROR 반환 및 창 미오픈 검증, form.submit 예외 시 ERROR 반환 검증
  const urlCountBeforeErr = openedUrls.length;
  const formCountBeforeErr = submittedForms.length;
  const resEmpty = sandbox.PuAlioUnion.openCleaneyeDirect('', 'union_info');
  assert.equal(resEmpty.mode, 'ERROR');
  const resInvalid = sandbox.PuAlioUnion.openCleaneyeDirect('UNKNOWN_INVALID_ID', 'union_info');
  assert.equal(resInvalid.mode, 'ERROR');
  assert.equal(openedUrls.length, urlCountBeforeErr);
  assert.equal(submittedForms.length, formCountBeforeErr);

  shouldThrowOnSubmit = true;
  const resSubmitFail = sandbox.PuAlioUnion.openCleaneyeDirect('L_2007100231', 'union_info');
  assert.equal(resSubmitFail.mode, 'ERROR');
  assert.match(resSubmitFail.error, /FORM_SUBMIT_BLOCKED/);
  shouldThrowOnSubmit = false;

  // 5) L_ERC 타임라인에서 경영평가편람·인사조직지침이 RULE 분류로 정확히 매핑되는지 검증
  const ercTl = sandbox.PuAlioUnion.buildOrganTimeline(dataMod, 'L_ERC');
  const manualTl = ercTl.find((t) => t.id === 'ERC_DISC_MANUAL_2026');
  const guideTl = ercTl.find((t) => t.id === 'ERC_DISC_GUIDELINE_2026');
  assert.ok(manualTl && manualTl.catGroup === 'RULE', '경영평가편람이 RULE 분류로 매핑되어야 합니다');
  assert.ok(guideTl && guideTl.catGroup === 'RULE', '인사조직지침이 RULE 분류로 매핑되어야 합니다');

  // 6) safeHttpUrl 도메인 허용 검증 (erc.re.kr, klid.or.kr, krila.re.kr, kilf.re.kr, lofa.or.kr, poba.or.kr)
  assert.ok(sandbox.PuAlioUnion.safeHttpUrl('https://www.erc.re.kr/usr/com/prm/ContentView.do?cId=1'));
  assert.ok(sandbox.PuAlioUnion.safeHttpUrl('https://www.klid.or.kr/open/bbsDisc.do?PID=workjoin_disc_s2'));
  assert.ok(sandbox.PuAlioUnion.safeHttpUrl('https://www.krila.re.kr/disclosure/labor.php'));
  assert.ok(sandbox.PuAlioUnion.safeHttpUrl('https://www.kilf.re.kr/cmm/fms/FileDown.do?atchFileId=1'));
  assert.ok(sandbox.PuAlioUnion.safeHttpUrl('https://www.lofa.or.kr/subList/20000000223'));
  assert.ok(sandbox.PuAlioUnion.safeHttpUrl('https://www.poba.or.kr/mno/mno01/mno0102/mno010201#tab1-9'));
});

test('⑦ 기관 중심 마스터 인덱스(1기관=1통합뷰), 기관 내부 6대 핵심 영역 집계, 법정 타임오프 한도 계산 및 SVG 비교 그래프(레이더·산점도)가 정확히 동작한다', () => {
  const sandbox = {
    window: {},
    PU_ALIO_DATA: dataMod,
    document: { addEventListener: () => {}, getElementById: () => null, head: { appendChild: () => {} } },
    URL
  };
  sandbox.window = sandbox;
  vm.runInNewContext(uiSrc, sandbox);

  // 1) 노조법 제24조 근로시간면제 법정 한도 계산 검증
  assert.equal(sandbox.PuAlioUnion.calcLegalTimeoffLimit(0), 0);
  assert.equal(sandbox.PuAlioUnion.calcLegalTimeoffLimit(50), 2000);
  assert.equal(sandbox.PuAlioUnion.calcLegalTimeoffLimit(150), 3000);
  assert.equal(sandbox.PuAlioUnion.calcLegalTimeoffLimit(500), 6000);
  assert.equal(sandbox.PuAlioUnion.calcLegalTimeoffLimit(3200), 14000);

  // 2) 기관 중심 마스터 인덱스(buildOrganMasterIndex) 중복 없는 1기관=1레코드 통합 검증
  const master = sandbox.PuAlioUnion.buildOrganMasterIndex(dataMod);
  assert.equal(master.records.length, dataMod.institutions.length, '전체 기관이 중복 없이 정확히 1기관=1통합레코드로 생성되어야 합니다');
  const seenIds = new Set();
  for (const r of master.records) {
    assert.equal(seenIds.has(r.aid), false, `기관코드 ${r.aid}가 마스터 목록에 중복되면 안 됩니다`);
    seenIds.add(r.aid);
    assert.equal(r.radar.length, 6, `${r.aid}의 6축 프로파일 점수가 6개여야 합니다`);
    assert.equal(Object.keys(r.issueScores).length, 13, `${r.aid}의 13대 핵심 쟁점 표준화 점수가 모두 산출되어야 합니다`);
  }

  // 복수노조 기관(예: 우체국물류지원단)이 여러 줄로 쪼개지지 않고 1개 기관 아래 복수 노조 배열로 묶였는지 검증
  const multiOrgan = master.records.find((r) => r.name.includes('우체국물류지원단'));
  assert.ok(multiOrgan, '우체국물류지원단이 마스터 인덱스에 존재해야 합니다');
  assert.equal(multiOrgan.isMulti, true, '우체국물류지원단은 복수노조 기관으로 분류되어야 합니다');
  assert.ok(multiOrgan.unions.length >= 4, '우체국물류지원단 산하 복수 단위노조들이 하나의 기관 레코드 안에 통합되어야 합니다');
  assert.ok(multiOrgan.memberTotal >= 3000, '산하 복수노조 조합원 수가 기관 단위로 합산되어야 합니다');

  // 지방공기업평가원(L_ERC) 및 강원랜드(C0005)의 내부 6대 핵심 영역 데이터 보유 검증
  const c0005 = master.byId.C0005;
  assert.ok(c0005 && c0005.hasUnion, 'C0005(강원랜드) 마스터 레코드가 존재해야 합니다');
  assert.ok(c0005.domains.caDiscs.length >= 1, 'C0005 단체협약 영역 문서가 집계되어야 합니다');
  assert.ok(c0005.domains.revisions.length >= 1, 'C0005 과거↔현행 개정 비교 데이터가 집계되어야 합니다');

  const erc = master.byId.L_ERC;
  assert.ok(erc && erc.hasUnion, 'L_ERC(지방공기업평가원) 마스터 레코드가 존재해야 합니다');
  assert.ok(erc.domains.ruleDiscs.length >= 2, 'L_ERC 내부규정·경영평가편람 영역 문서가 집계되어야 합니다');

  // 3) 업종별·전체 평균 벤치마크 및 순수 SVG 비교 차트 생성 검증
  assert.ok(master.benchmarks && master.benchmarks.ALL && master.benchmarks.ALL.radar.length === 6);
  const cmpSample = [c0005, multiOrgan, erc];
  const radarHtml = sandbox.PuAlioUnion.renderRadarChartSvg(cmpSample, master.benchmarks.ALL);
  assert.match(radarHtml, /<svg[^>]*aria-label="기관 6축 프로파일 레이더 비교 그래프"/);
  assert.match(radarHtml, /강원랜드/);
  assert.match(radarHtml, /지방공기업평가원/);

  const scatterHtml = sandbox.PuAlioUnion.renderScatterTimeoffSvg(master.records.slice(0, 80), cmpSample);
  assert.match(scatterHtml, /<svg[^>]*aria-label="조합원 규모 대비 타임오프 산점도 및 법정한도선"/);
  assert.match(scatterHtml, /노조법 법정상한/);

  // 4) 빈 배열(institutions: []) 데이터에서도 buildOrganMasterIndex가 예외 없이 동작하는지 검증
  const emptyMaster = sandbox.PuAlioUnion.buildOrganMasterIndex({ institutions: [], unions: [], disclosures: [], metrics: [], articles: [], revisions: {} });
  assert.equal(emptyMaster.records.length, 0);
  assert.equal(emptyMaster.benchmarks.ALL.radar.length, 6);
});

test('⑧ 상단 헤더·탭 중복 제거(4개 핵심 탭 + 우측 API 유틸 탭), 탭 2 3×2 격자 및 서브탭 전환, 조문·원문 통합 토글(docMode), 입력창 플레이스홀더 간결화가 적용되어 있다', () => {
  assert.match(uiSrc, /data-tab="unions"[^>]*>🏛️ 기관 목록<\/button>/);
  assert.match(uiSrc, /data-tab="organ"[^>]*>🔎 기관 상세<\/button>/);
  assert.match(uiSrc, /data-tab="matrix"[^>]*>📊 비교분석<\/button>/);
  assert.match(uiSrc, /data-tab="articles"[^>]*>📚 조문·원문<\/button>/);
  assert.match(uiSrc, /class="pau-tab util[^"]*"[^>]*data-tab="apihub"[^>]*>🔌 API<\/button>/);
  assert.doesNotMatch(uiSrc, /data-tab="detail"/, '기존 5번 원문 탭은 4번 조문·원문 탭 내부 토글(docMode)로 통합되어야 합니다');

  // 탭 2 5+1 고립 카드를 막기 위해 데스크톱 3열 고정 격자가 선언되어 있는지 검증
  assert.match(uiSrc, /\.pau-dom-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(uiSrc, /\.pau-root input::placeholder\{font-size:13px/);
  assert.doesNotMatch(uiSrc, /기관명·시도·부처 빠른 검색\.\.\./, '잘림을 유발하던 긴 검색창 플레이스홀더가 제거되어야 합니다');
  assert.match(uiSrc, /data-doc-mode="ARTICLES"/);
  assert.match(uiSrc, /data-doc-mode="DISC"/);
  assert.match(uiSrc, /data-h-sub="HISTORY"/);
  assert.match(uiSrc, /data-h-sub="PEERS"/);
  assert.match(uiSrc, /data-h-sub="CHART"/);
});

test('⑨ 지자체 약칭·다중어 스마트 검색(충남→천안도시공사 등 105곳), 본청·시군구 소속 분류, 지역·지자체 산하기관 전수 비교(REGION 모드) 및 한글 IME 비파괴 부분 갱신이 동작한다', () => {
  const sandbox = { URL, URLSearchParams };
  sandbox.window = sandbox;
  vm.runInNewContext(uiSrc, sandbox);
  const api = sandbox.PuAlioUnion;

  const master = api.buildOrganMasterIndex(dataMod);
  const localAffils = master.records.filter((r) => !!r.provinceKey);
  assert.ok(localAffils.length >= 1300, '16개 시·도 지방산하기관이 provinceKey로 매핑되어야 합니다');

  // 충청남도 산하기관 및 약칭("충남") 검색 검증
  const chungnamAll = master.records.filter((r) => r.provinceKey === '충청남도');
  assert.ok(chungnamAll.length >= 100, '충청남도 산하기관 100곳 이상이 빠짐없이 분류되어야 합니다');
  const chungnamSearched = master.records.filter((r) => api.matchSmartQuery(r.searchHaystack, '충남'));
  assert.ok(chungnamSearched.length >= chungnamAll.length, '약칭 "충남" 검색 시 천안도시공사 등 충청남도 산하기관 전체가 검색되어야 합니다');

  const cheonanCorp = chungnamAll.find((r) => r.name.includes('천안도시공사'));
  assert.ok(cheonanCorp, '천안도시공사가 충청남도 산하기관에 포함되어야 합니다');
  assert.equal(cheonanCorp.muniName, '천안시', '천안도시공사의 기초지자체는 천안시로 분류되어야 합니다');
  assert.equal(api.matchSmartQuery(cheonanCorp.searchHaystack, '충남 공사'), true, '공백 다중 키워드("충남 공사") AND 검색이 일치해야 합니다');
  assert.equal(api.matchSmartQuery(cheonanCorp.searchHaystack, '충남 수원'), false, '불일치 키워드가 포함되면 제외되어야 합니다');

  // 도립 의료원(천안의료원·전라남도순천의료원) 및 경기·제주·전남·광주 본청/자치구 산하 분류 정밀 검증
  const cheonanMed = chungnamAll.find((r) => r.name.includes('천안의료원'));
  assert.ok(cheonanMed, '천안의료원이 존재해야 합니다');
  assert.equal(cheonanMed.muniName, '충남 본청', '도립 천안의료원은 충남 본청 산하로 분류되어야 합니다');

  const suncheonMed = master.records.find((r) => r.provinceKey === '전남광주통합특별시' && r.name.includes('전라남도순천의료원'));
  assert.ok(suncheonMed, '전라남도순천의료원이 존재해야 합니다');
  assert.equal(suncheonMed.muniName, '전남 본청', '도립 전라남도순천의료원은 전남 본청 산하로 분류되어야 합니다');

  const gangjinMed = master.records.find((r) => r.provinceKey === '전남광주통합특별시' && r.name.includes('전라남도강진의료원'));
  assert.ok(gangjinMed, '전라남도강진의료원이 존재해야 합니다');
  assert.equal(gangjinMed.muniName, '전남 본청', '도립 전라남도강진의료원은 전남 본청 산하로 분류되어야 합니다');

  const jejuDev = master.records.find((r) => r.provinceKey === '제주특별자치도' && r.name.includes('제주특별자치도개발공사'));
  assert.ok(jejuDev, '제주특별자치도개발공사가 존재해야 합니다');
  assert.equal(jejuDev.muniName, '제주 본청', '제주특별자치도개발공사는 제주 본청으로 분류되어야 합니다');

  const gwangjuTraffic = master.records.find((r) => r.provinceKey === '전남광주통합특별시' && r.name.includes('광주교통공사'));
  assert.ok(gwangjuTraffic, '광주교통공사가 존재해야 합니다');
  assert.equal(gwangjuTraffic.muniName, '광주 본청', '광주교통공사는 광주 본청으로 분류되어야 합니다');

  const jeonnamDev = master.records.find((r) => r.provinceKey === '전남광주통합특별시' && r.name.includes('전남개발공사'));
  assert.ok(jeonnamDev, '전남개발공사가 존재해야 합니다');
  assert.equal(jeonnamDev.muniName, '전남 본청', '전남개발공사는 전남 본청으로 분류되어야 합니다');

  const gyeonggiPort = master.records.find((r) => r.provinceKey === '경기도' && r.name.includes('경기평택항만공사'));
  assert.ok(gyeonggiPort, '경기평택항만공사가 존재해야 합니다');
  assert.equal(gyeonggiPort.muniName, '경기 본청', '도립 경기평택항만공사는 경기 본청으로 분류되어야 합니다');

  const suwonWorldcup = master.records.find((r) => r.provinceKey === '경기도' && r.name.includes('경기도수원월드컵경기장'));
  assert.ok(suwonWorldcup, '경기도수원월드컵경기장관리재단이 존재해야 합니다');
  assert.equal(suwonWorldcup.muniName, '경기 본청', '도립 경기도수원월드컵경기장관리재단은 경기 본청으로 분류되어야 합니다');

  const gwangjuDonggu = master.records.find((r) => r.provinceKey === '전남광주통합특별시' && r.name.includes('동구'));
  assert.ok(gwangjuDonggu, '광주 동구 산하기관이 존재해야 합니다');
  assert.equal(gwangjuDonggu.muniName, '광주 동구', '광주광역시 동구 산하기관은 광주 동구로 분류되어야 합니다');

  // 지역별 벤치마크, 보안 URL 제한(https 전용) 및 REGION 모드 UI 구성요소 존재 검증
  assert.ok(master.benchmarks.LOCAL_ALL && master.benchmarks.LOCAL_ALL.totalOrgans >= 1300 && master.benchmarks.LOCAL_ALL.count > 300);
  assert.ok(master.benchmarks.byProvince['충청남도'] && master.benchmarks.byProvince['충청남도'].totalOrgans >= 100 && master.benchmarks.byProvince['충청남도'].count >= 15);
  assert.equal(api.inferProvinceFromQuery('충남 기관'), '충청남도');
  assert.equal(api.safeHttpUrl('http://www.alio.go.kr/test'), '', '비암호화 http:// URL은 차단되어야 합니다');
  assert.match(uiSrc, /data-m-submode="REGION"[^>]*>🗺️ 지역산하비교<\/button>/);
  assert.match(uiSrc, /aria-pressed="/);
  assert.match(uiSrc, /noopener noreferrer/);
  assert.match(uiSrc, /data-m-reg-dyn/);
  assert.match(uiSrc, /compositionend/, '한글 IME 자모 조합 보호를 위한 compositionend 처리가 포함되어야 합니다');

  // 코드 내 issueScores.<key> 참조가 모두 실제 산출된 13대 지표 키와 일치하는지 정적·동적 교차 검증
  const sampleScores = cheonanCorp.issueScores;
  const referencedScoreKeys = [...uiSrc.matchAll(/\.issueScores\.([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
  assert.ok(referencedScoreKeys.length > 0);
  for (const k of referencedScoreKeys) {
    assert.ok(sampleScores[k] && typeof sampleScores[k].tag === 'string', `issueScores.${k} 키가 실제 METRIC_DEFS 산출물에 존재해야 합니다`);
  }
});

test('⑩ URL 딥링크(?region=충남&muni=천안시, ?compare=중복제거, ?tab=articles&doc=DISC) 및 서브모드 전환 시 history.replaceState 상태 동기화가 정확히 동작한다', () => {
  function runWithUrl(initialSearch) {
    const replacedUrls = [];
    const loc = {
      protocol: 'https:',
      pathname: '/pureunall/pu-alio-union.html',
      search: initialSearch,
      hash: ''
    };

    function makeNode(tag) {
      const attrs = {};
      const listeners = {};
      return {
        tagName: String(tag || 'DIV').toUpperCase(),
        innerHTML: '',
        textContent: '',
        value: '',
        style: {},
        dataset: {},
        classList: { toggle: () => {} },
        setAttribute: (k, v) => { attrs[k] = String(v); },
        getAttribute: (k) => attrs[k] || '',
        appendChild: () => {},
        removeChild: () => {},
        addEventListener: (ev, fn) => { listeners[ev] = fn; },
        trigger: (ev, arg) => { if (listeners[ev]) listeners[ev](arg); },
        focus: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
      };
    }

    const bodyEl = makeNode('DIV');
    const cmpTrayEl = makeNode('DIV');
    const subModeAllListBtn = makeNode('BUTTON');
    subModeAllListBtn.setAttribute('data-m-submode', 'ALL_LIST');
    bodyEl.querySelectorAll = (sel) => {
      if (sel === '[data-m-submode]') return [subModeAllListBtn];
      return [];
    };

    const root = makeNode('DIV');
    root.querySelector = (sel) => {
      if (sel === '[data-pau-body]') return bodyEl;
      if (sel === '[data-pau-cmp-tray]') return cmpTrayEl;
      return makeNode('DIV');
    };

    const sandbox = {
      window: {},
      PU_ALIO_DATA: dataMod,
      location: loc,
      history: {
        replaceState: (_st, _tit, url) => {
          replacedUrls.push(url);
          const qIdx = url.indexOf('?');
          loc.search = qIdx >= 0 ? url.slice(qIdx) : '';
        }
      },
      document: {
        head: makeNode('HEAD'),
        body: makeNode('BODY'),
        createElement: (t) => makeNode(t),
        getElementById: () => null,
        querySelector: () => null,
        addEventListener: () => {}
      },
      fetch: () => Promise.resolve({ ok: false }),
      URL,
      URLSearchParams
    };
    sandbox.window = sandbox;
    vm.runInNewContext(uiSrc, sandbox);
    sandbox.PuAlioUnion.mount(root, { isModal: false });
    return { root, bodyEl, subModeAllListBtn, loc, replacedUrls };
  }

  // 1) ?sso=1&region=충남&muni=천안시 진입 시 REGION 모드(충청남도·천안시)로 열리고, ALL_LIST로 전환하면 region/muni가 정리되며 sso=1은 보존됨
  const r1 = runWithUrl('?sso=1&region=%EC%B6%A9%EB%82%A8&muni=%EC%B2%9C%EC%95%88%EC%8B%9C');
  assert.match(r1.bodyEl.innerHTML, /천안도시공사/, '천안시 산하기관이 초기 렌더링되어야 합니다');
  assert.match(decodeURIComponent(r1.loc.search), /sso=1/, '포털 기존 쿼리(sso=1)는 유지되어야 합니다');
  assert.match(decodeURIComponent(r1.loc.search), /region=충청남도/, '약칭 충남이 정규 광역키 충청남도로 URL 동기화되어야 합니다');
  assert.match(decodeURIComponent(r1.loc.search), /muni=천안시/, '유효 기초지자체 천안시가 URL에 유지되어야 합니다');

  r1.subModeAllListBtn.trigger('click');
  const afterAllList = decodeURIComponent(r1.loc.search);
  assert.doesNotMatch(afterAllList, /region=/, 'ALL_LIST 전환 후 이전 region 파라미터가 남아있으면 안 됩니다');
  assert.doesNotMatch(afterAllList, /muni=/, 'ALL_LIST 전환 후 이전 muni 파라미터가 남아있으면 안 됩니다');
  assert.match(afterAllList, /sso=1/, 'ALL_LIST 전환 후에도 sso=1은 보존되어야 합니다');
  assert.match(afterAllList, /mode=ALL_LIST/, 'ALL_LIST 상태가 URL에 기록되어야 합니다');

  // 2) ?compare=C0005,C0005,L_ERC 진입 시 중복 기관코드(C0005)가 자동 제거되어 고유 2개만 반영됨
  const r2 = runWithUrl('?compare=C0005,C0005,L_ERC');
  assert.equal(decodeURIComponent(r2.loc.search), '?compare=C0005,L_ERC', '중복 compare 기관코드가 제거되어야 합니다');

  // 3) ?tab=articles&doc=DISC 진입 시 공시·사규 원문 모드로 직결되고 새로고침 URL도 유지됨
  const r3 = runWithUrl('?tab=articles&doc=DISC');
  assert.match(r3.bodyEl.innerHTML, /공시항목 분류/, 'doc=DISC 진입 시 공시·사규 원문 화면이 렌더링되어야 합니다');
  assert.equal(decodeURIComponent(r3.loc.search), '?tab=articles&doc=DISC');
});

test('⑪ 기관 목록 상단 바 빠른 정렬(data-u-sort) 및 전 목록 표 머리글(data-th-sort) 클릭 오름차순·내림차순(▲/▼) 정렬이 정확히 동작한다', () => {
  function mountTestable(initialSearch) {
    const loc = {
      protocol: 'https:',
      pathname: '/pureunall/pu-alio-union.html',
      search: initialSearch || '',
      hash: ''
    };
    const sortSelectNode = {
      tagName: 'SELECT',
      value: 'members_desc',
      listeners: {},
      addEventListener(ev, fn) { this.listeners[ev] = fn; },
      focus() {}
    };
    function makeNode(tag) {
      const attrs = {};
      const listeners = {};
      return {
        tagName: String(tag || 'DIV').toUpperCase(),
        innerHTML: '',
        textContent: '',
        value: '',
        style: {},
        dataset: {},
        classList: { toggle: () => {} },
        setAttribute: (k, v) => { attrs[k] = String(v); },
        getAttribute: (k) => attrs[k] || '',
        appendChild: () => {},
        removeChild: () => {},
        addEventListener: (ev, fn) => { listeners[ev] = fn; },
        trigger: (ev, arg) => { if (listeners[ev]) listeners[ev](arg); },
        focus: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
      };
    }

    const bodyEl = makeNode('DIV');
    const uDynNode = makeNode('DIV');
    const moreFltBtn = makeNode('BUTTON');
    bodyEl.querySelector = (sel) => {
      if (sel === '[data-u-sort]') return sortSelectNode;
      if (sel === '[data-u-dyn]') return uDynNode;
      if (sel === '[data-toggle-more-flt]') return moreFltBtn;
      return null;
    };
    const cmpTrayEl = makeNode('DIV');
    const root = makeNode('DIV');
    root.querySelector = (sel) => {
      if (sel === '[data-pau-body]') return bodyEl;
      if (sel === '[data-pau-cmp-tray]') return cmpTrayEl;
      return makeNode('DIV');
    };

    const sandbox = {
      window: {},
      PU_ALIO_DATA: dataMod,
      location: loc,
      history: {
        replaceState: (_st, _tit, url) => {
          const qIdx = url.indexOf('?');
          loc.search = qIdx >= 0 ? url.slice(qIdx) : '';
        }
      },
      document: {
        head: makeNode('HEAD'),
        body: makeNode('BODY'),
        createElement: (t) => makeNode(t),
        getElementById: () => null,
        querySelector: () => null,
        addEventListener: () => {}
      },
      fetch: () => Promise.resolve({ ok: false }),
      URL,
      URLSearchParams
    };
    sandbox.window = sandbox;
    vm.runInNewContext(uiSrc, sandbox);
    sandbox.PuAlioUnion.mount(root, { isModal: false });

    function clickHeaderSort(colId) {
      const thBtn = {
        getAttribute: (k) => (k === 'data-th-sort' ? colId : ''),
        focus: () => {}
      };
      bodyEl.trigger('click', {
        preventDefault: () => {},
        target: {
          closest: (sel) => (sel === '[data-th-sort]' ? thBtn : null)
        }
      });
    }

    function extractRowOrganIds(html) {
      const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
      if (!tbodyMatch) return [];
      return [...tbodyMatch[1].matchAll(/data-jump-organ="([^"]+)"/g)].map((m) => m[1].trim());
    }

    return { bodyEl, uDynNode, moreFltBtn, sortSelectNode, clickHeaderSort, extractRowOrganIds };
  }

  const master = (() => {
    const sb = { URL, URLSearchParams };
    sb.window = sb;
    vm.runInNewContext(uiSrc, sb);
    return sb.PuAlioUnion.buildOrganMasterIndex(dataMod);
  })();

  // 1) 탭 1 기관 목록 초기 렌더링 시 상단 바 빠른 정렬(data-u-sort)과 클릭형 열 머리글(data-th-sort) 및 aria-sort="descending" 확인
  const t1 = mountTestable('');
  assert.match(t1.bodyEl.innerHTML, /data-u-sort/, '페이지네이션 상단 바에 빠른 정렬 드롭다운(data-u-sort)이 즉시 노출되어야 합니다');
  assert.match(t1.bodyEl.innerHTML, /aria-sort="descending"[^>]*><button[^>]*data-th-sort="u_members"/, '초기 조합원 열 머리글이 내림차순(descending) 활성 상태여야 합니다');
  const descIds = t1.extractRowOrganIds(t1.bodyEl.innerHTML);
  assert.ok(descIds.length >= 10);
  assert.ok(master.byId[descIds[0]].memberTotal >= master.byId[descIds[1]].memberTotal, '초기 조합원 내림차순이 적용되어야 합니다');

  // 2) 조합원 열 머리글(u_members) 클릭 시 오름차순(members_asc) 전환 — 미설립(—) 기관이 아니라 최소 규모 노조보유 기관이 먼저 나와야 함
  t1.clickHeaderSort('u_members');
  assert.match(t1.bodyEl.innerHTML, /aria-sort="ascending"[^>]*><button[^>]*data-th-sort="u_members"/, 'u_members 클릭 후 오름차순(ascending)으로 전환되어야 합니다');
  const ascIds = t1.extractRowOrganIds(t1.bodyEl.innerHTML);
  assert.notEqual(ascIds[0], descIds[0], '오름차순 전환 시 첫 번째 행 기관이 바뀌어야 합니다');
  const firstAscRec = master.byId[ascIds[0]];
  assert.ok(firstAscRec && firstAscRec.hasUnion && firstAscRec.memberTotal >= 1, '조합원 적은순(▲) 정렬 시 미설립(—)이나 0명 노조가 아닌 실제 1명 이상 노조보유 기관이 상위에 표시되어야 합니다');
  assert.ok(firstAscRec.memberTotal <= master.byId[ascIds[1]].memberTotal, '조합원 오름차순이 정확히 적용되어야 합니다');

  // 3) 기관명 열 머리글(u_name) 클릭 시 가나다 오름차순(▲) → 재클릭 시 역순 내림차순(▼) 전환 검증
  t1.clickHeaderSort('u_name');
  assert.match(t1.bodyEl.innerHTML, /aria-sort="ascending"[^>]*><button[^>]*data-th-sort="u_name"/);
  const nameAscIds = t1.extractRowOrganIds(t1.bodyEl.innerHTML);
  assert.ok(master.byId[nameAscIds[0]].name.localeCompare(master.byId[nameAscIds[1]].name, 'ko') <= 0, '기관명 가나다 오름차순이 적용되어야 합니다');

  t1.clickHeaderSort('u_name');
  assert.match(t1.bodyEl.innerHTML, /aria-sort="descending"[^>]*><button[^>]*data-th-sort="u_name"/);
  const nameDescIds = t1.extractRowOrganIds(t1.bodyEl.innerHTML);
  assert.ok(master.byId[nameDescIds[0]].name.localeCompare(master.byId[nameDescIds[1]].name, 'ko') >= 0, '기관명 재클릭 시 가나다 역순(내림차순)이 적용되어야 합니다');

  // 4) 상단 바 빠른 정렬 드롭다운(data-u-sort) 변경 시 즉시 반영 및 상세필터 배지 동기화 검증
  t1.sortSelectNode.value = 'score_desc';
  t1.sortSelectNode.listeners.change();
  assert.match(t1.uDynNode.innerHTML, /aria-sort="descending"[^>]*><button[^>]*data-th-sort="u_domains"/, '종합점수 높은순 선택 시 6대영역 열 머리글이 내림차순 표시로 동기화되어야 합니다');
  assert.match(t1.moreFltBtn.textContent, /\(1\)/, '상단 빠른 정렬 변경 시 상세필터 활성 개수 배지도 즉시 갱신되어야 합니다');
  const scoreDescIds = t1.extractRowOrganIds(t1.uDynNode.innerHTML);
  assert.ok(master.byId[scoreDescIds[0]].totalScore >= master.byId[scoreDescIds[1]].totalScore, '종합점수 내림차순 정렬이 정확히 적용되어야 합니다');

  // 5) 지역산하비교(REGION), 13대쟁점목록(ALL_LIST), 단협조문(ARTICLES), 공시원문(DISC) 열 머리글 정렬 동작 검증
  const tReg = mountTestable('?region=%EC%B6%A9%EB%82%A8');
  assert.match(tReg.bodyEl.innerHTML, /data-r-sort/);
  tReg.clickHeaderSort('r_score');
  assert.match(tReg.bodyEl.innerHTML, /aria-sort="descending"[^>]*><button[^>]*data-th-sort="r_score"/);

  const tAllList = mountTestable('?tab=matrix&mode=ALL_LIST');
  tAllList.clickHeaderSort('m_name');
  assert.match(tAllList.bodyEl.innerHTML, /aria-sort="ascending"[^>]*><button[^>]*data-th-sort="m_name"/);

  const tArt = mountTestable('?tab=articles');
  tArt.clickHeaderSort('a_no');
  assert.match(tArt.bodyEl.innerHTML, /aria-sort="ascending"[^>]*><button[^>]*data-th-sort="a_no"/);
  const artNos = [...tArt.bodyEl.innerHTML.matchAll(/<td style="font-weight:700;">제?(\d+)조?/g)].map((m) => Number(m[1]));
  assert.ok(artNos.length >= 2 && artNos[0] <= artNos[1], '조문번호 오름차순 정렬 시 숫자 기준(제1조, 제2조...)으로 정렬되어야 합니다');

  const tDisc = mountTestable('?tab=articles&doc=DISC');
  assert.match(tDisc.bodyEl.innerHTML, /data-d-sort/);
  tDisc.clickHeaderSort('d_date');
  assert.match(tDisc.bodyEl.innerHTML, /aria-sort="descending"[^>]*><button[^>]*data-th-sort="d_date"/);
  const discDatesDesc = [...tDisc.bodyEl.innerHTML.matchAll(/\((20\d{2}[^()]{3,18})\)<\/td>/g)]
    .map((m) => {
      const n = m[1].trim().match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
      return n ? `${n[1]}-${n[2].padStart(2, '0')}-${n[3].padStart(2, '0')}` : '';
    })
    .filter(Boolean);
  assert.ok(discDatesDesc.length >= 5);
  for (let i = 1; i < discDatesDesc.length; i++) {
    assert.ok(discDatesDesc[i - 1] >= discDatesDesc[i], `공시 기준연혁일 내림차순이 혼재 날짜 형식에서도 시간순이어야 합니다: ${discDatesDesc[i - 1]} vs ${discDatesDesc[i]}`);
  }
});





