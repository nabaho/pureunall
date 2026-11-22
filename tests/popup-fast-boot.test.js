/* 괴롭힘·성희롱 조사 및 정부지원사업 앱 팝업·초기 화면 즉시 표시(Fast-Boot) 검증 테스트 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const FastBoot = require(path.join(ROOT, 'js', 'pu-fast-boot.js'));
const HarassCore = require(path.join(ROOT, 'js', 'pu-harass-core.js'));
const IlteoCat = require(path.join(ROOT, 'js', 'pu-ilteo-catalog.js'));
const IlteoIntake = require(path.join(ROOT, 'js', 'pu-ilteo-intake.js'));
const IlteoReport = require(path.join(ROOT, 'js', 'pu-ilteo-report.js'));
const JobtransCat = require(path.join(ROOT, 'js', 'pu-jobtrans-catalog.js'));
const JobtransIntake = require(path.join(ROOT, 'js', 'pu-jobtrans-intake.js'));
const JobtransReport = require(path.join(ROOT, 'js', 'pu-jobtrans-report.js'));

function makeFakeIdb() {
  const storeData = new Map();
  const makeReq = (runner) => {
    const r = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
    queueMicrotask(() => runner(r));
    return r;
  };
  const dbObj = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => ({}),
    close() {},
    transaction(_name, _mode) {
      const tx = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore() {
          return {
            get(k) {
              const req = { result: undefined, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                req.result = storeData.get(k);
                if (req.onsuccess) req.onsuccess();
                if (tx.oncomplete) tx.oncomplete();
              });
              return req;
            },
            put(v, k) {
              storeData.set(k, JSON.parse(JSON.stringify(v)));
              queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
            },
            clear() {
              storeData.clear();
              queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
            },
            delete(k) {
              storeData.delete(k);
              queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
            }
          };
        }
      };
      return tx;
    }
  };
  return {
    storeData,
    indexedDB: {
      open() {
        return makeReq((r) => {
          r.result = dbObj;
          if (r.onsuccess) r.onsuccess();
        });
      }
    }
  };
}

test('① PuFastBoot — UID 별 스냅샷 격리·로그아웃 즉시 폐기·비허용 외부 스크립트 차단 검증', async () => {
  const fake = makeFakeIdb();
  const lsMap = {};
  const ctx = vm.createContext({
    indexedDB: fake.indexedDB,
    localStorage: {
      getItem: (k) => (k in lsMap ? lsMap[k] : null),
      setItem: (k, v) => { lsMap[k] = String(v); },
      removeItem: (k) => { delete lsMap[k]; }
    },
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Number,
    Object
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-fast-boot.js'), 'utf8'), ctx);

  await ctx.PuFastBoot.writeSnap('harass', 'uid-alpha', { marker: '가상사건목록A' });
  const hitA = await ctx.PuFastBoot.readSnap('harass', 'uid-alpha');
  const missB = await ctx.PuFastBoot.readSnap('harass', 'uid-beta');
  assert.equal(hitA && hitA.marker, '가상사건목록A', '본인 UID 스냅샷은 정상 복원되어야 한다');
  assert.equal(missB, null, '다른 계정 UID 로는 스냅샷이 절대 조회되지 않아야 한다');

  await ctx.PuFastBoot.clearAll();
  const afterClear = await ctx.PuFastBoot.readSnap('harass', 'uid-alpha');
  assert.equal(afterClear, null, '로그아웃(clearAll) 직후 모든 캐시 스냅샷이 폐기되어야 한다');

  /* 비동기 writeSnap 도중 로그아웃(clearAll)이 먼저 일어난 경우 잔류 저장이 차단되어야 한다 */
  const raceWrite = ctx.PuFastBoot.writeSnap('harass', 'uid-race', { marker: '잔류금지' });
  await ctx.PuFastBoot.clearAll();
  const raceSaved = await raceWrite;
  assert.equal(raceSaved, false, '로그아웃 이후 뒤늦게 도착한 스냅샷 쓰기는 거부되어야 한다');
  assert.equal(await ctx.PuFastBoot.readSnap('harass', 'uid-race'), null, '경합 상황에서도 이전 사용자 스냅샷이 남지 않아야 한다');

  /* 포털·다른 탭에서 pu_auth_logout_at 시각이 찍힌 뒤에는 이전 스냅샷을 읽지 않고 폐기해야 한다 */
  await ctx.PuFastBoot.writeSnap('harass', 'uid-portal', { marker: '포털로그아웃전' });
  lsMap.pu_auth_logout_at = String(Date.now() + 50);
  assert.equal(await ctx.PuFastBoot.readSnap('harass', 'uid-portal'), null, '포털 전체 로그아웃 이후에는 이전 스냅샷이 무효화되어야 한다');

  await assert.rejects(
    () => FastBoot.loadScriptOnce('https://evil.example/payload.js'),
    /허용되지 않은 스크립트 경로/,
    '외부 도메인 스크립트 동적 적재 시도는 거부되어야 한다'
  );
  await assert.rejects(
    () => FastBoot.loadScriptOnce('../secret.js'),
    /허용되지 않은 스크립트 경로/,
    '상위 경로 이탈 스크립트 적재 시도는 거부되어야 한다'
  );
  await assert.rejects(
    () => FastBoot.loadScriptOnce('vendor/../../secret.js'),
    /허용되지 않은 스크립트 경로/,
    '허용 접두사 내부의 상대경로(..) 우회 시도도 거부되어야 한다'
  );
});

test('② 초기 HTML 파싱 차단 제거 — 괴롭힘·일터상생·산업일자리전환 화면이 대용량 PDF·XLSX 번들을 동기 로드하지 않는다', () => {
  for (const file of ['pu-harass.html', 'ilteo.html', 'jobtrans.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(html.includes('js/pu-fast-boot.js?v='), `${file} 에 PuFastBoot 가 배선되어야 한다`);
    assert.ok(!/<script[^>]+src=["']vendor\/pdf\.min\.js/.test(html), `${file} 초기 로드에서 대용량 pdf.min.js 동기 스크립트가 제거되어야 한다`);
    assert.ok(!/<script[^>]+src=["']vendor\/xlsx\.full\.min\.js/.test(html), `${file} 초기 로드에서 대용량 xlsx.full.min.js 동기 스크립트가 제거되어야 한다`);
  }
});

test('③ 괴롭힘·성희롱 조사(pu-harass) — 대용량 메일함이 아직 도착하지 않아도 사건 목록·연도별 자료함이 즉시 먼저 표시된다', async () => {
  const els = {};
  const makeEl = (id) => ({
    id, value: '', textContent: '', innerHTML: '', checked: false, disabled: false,
    style: { display: '' },
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener() {}, getAttribute: () => '', closest: () => null, matches: () => false,
    querySelector: () => null, querySelectorAll: () => [], focus() {}
  });
  const getEl = (id) => (els[id] = els[id] || makeEl(id));

  let resolveSlowMail = null;
  const slowMailPromise = new Promise((r) => { resolveSlowMail = r; });

  const mockDb = {
    'uid_roles/uFast': { sid: 'P001', name: '점검노무', status: 'active', isAdmin: true },
    'data/user_dir': [{ sid: 'P001', name: '점검노무', status: 'active' }],
    'data/companies/v': [{ id: 'co-fast-1', name: '(주)가상즉시표시기업', bizNo: '123-81-99001', email: 'hr@fast1.example' }],
    'harass_invest/cases': {
      'hc-fast-1': {
        id: 'hc-fast-1', erpCaseId: 'ec-fast-1', erpCaseNo: '성,직괴-2026-101', companyId: 'co-fast-1',
        companyName: '(주)가상즉시표시기업', title: '신고인홍길동실명포함 직장 내 괴롭힘 조사',
        category: 'harass', managerMain: 'P001', receiveDate: '2026-10-10',
        verdictSummary: '기밀판정본문_절대저장금지_토큰',
        inspectorName: '외부조사위원성명_비저장',
        steps: { intake: { done: true, date: '2026-10-10', note: '내부상세메모_비저장' } },
        mailLinks: [{ key: 'm1', dir: 'in', date: '2026-10-10', subject: '신고인실명_공문제목_비저장', preview: '기밀메일미리보기_비저장' }]
      }
    },
    'harass_invest/erp_sync': {
      'hc-fast-1': {
        erpCaseId: 'ec-fast-1',
        erpStatus: 'progress',
        erpNoteBlock: '이알피동기화상세노트_절대저장금지',
        harassSummary: { verdictSummary: '동기화판정본문_절대저장금지' }
      }
    },
    'mailbox/folders': { inbox: { slug: 'inbox', name: '받은편지함', kind: 'inbox' } }
  };

  function makeRef(p) {
    return {
      path: p,
      child(s) { return makeRef(p ? p + '/' + s : String(s)); },
      on() {},
      off() {},
      once() {
        if (p === 'mailbox/msgs' || p === 'mailbox/old/msgs') return slowMailPromise;
        return Promise.resolve({ val: () => (mockDb[p] !== undefined ? mockDb[p] : null) });
      }
    };
  }

  let capturedSnap = null;
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, Promise, URLSearchParams,
    PuHarassCore: HarassCore,
    PuFastBoot: {
      readSnap: async () => null,
      writeSnap: async (_k, _u, data) => { capturedSnap = data; return true; },
      clearAll: async () => true
    },
    PuGate: { show() {}, hide() {} },
    PuOntologyWrite: { createGateway: () => ({ async save(r, fn) { const v = typeof fn === 'function' ? fn(null) : fn; return { committed: true, snapshot: { val: () => v } }; } }) },
    location: { search: '?tab=yearly', hash: '', pathname: '/pu-harass.html' },
    history: { replaceState() {} },
    document: {
      activeElement: null, contains: () => false, getElementById: (id) => getEl(id),
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {}
    }
  });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-rrn-mask.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-harass-view.js'), 'utf8'), ctx);

  let authCb = null;
  const curUser = { uid: 'uFast', getIdToken: async () => 'tok' };
  ctx.PuHarassView.boot({
    auth: Object.assign(() => ({ currentUser: curUser, setPersistence() {}, onAuthStateChanged(fn) { authCb = fn; } }), { Auth: { Persistence: { LOCAL: 'local' } } }),
    database: () => ({ ref: (p) => makeRef(p || '') })
  });

  const bootDone = authCb(curUser);
  await new Promise((r) => setTimeout(r, 25));

  /* 메일함(mailbox/msgs · mailbox/old/msgs)이 아직 응답하지 않은 상태에서도 사건 목록이 이미 화면에 표시되어야 한다 */
  assert.ok(
    getEl('yearlyBox').innerHTML.includes('(주)가상즉시표시기업'),
    '대용량 메일함 수신 완료 전에도 핵심 원장만으로 연도별 전체 자료함에 사건이 즉시 표시되어야 한다'
  );
  assert.ok(getEl('syncStateChip').textContent.includes('동기화'), '백그라운드 메일 동기화 중 안내 배지가 표시되어야 한다');

  resolveSlowMail({
    val: () => ({
      u999: { u: '999', f: '신규의뢰 <ask@newcand.example>', t: 'pureun@pureunlabor.co.kr', d: Date.parse('2026-11-01T09:00:00Z'), s: '(주)가상미등록후보 직장 내 성희롱 조사 견적 요청', p: '조사 의뢰 문의' }
    })
  });
  await bootDone;

  assert.equal(getEl('syncStateChip').textContent, '', '백그라운드 메일 동기화가 끝나면 동기화 배지가 닫혀야 한다');
  assert.ok(getEl('yearlyBox').innerHTML.includes('(주)가상미등록후보'), '메일함 도착 후 미등록 후보 묶음까지 자연스럽게 합쳐져 표시되어야 한다');
  assert.ok(capturedSnap && capturedSnap.cases && capturedSnap.cases['hc-fast-1'], '동기화 완료 후 경량 스냅샷이 생성되어야 한다');
  const snapJson = JSON.stringify(capturedSnap);
  assert.ok(!snapJson.includes('기밀판정본문_절대저장금지_토큰'), '기밀 판정 요약(verdictSummary)은 IndexedDB 스냅샷에 저장되면 안 된다');
  assert.ok(!snapJson.includes('동기화판정본문_절대저장금지') && !snapJson.includes('이알피동기화상세노트_절대저장금지'), 'erpSync 내부 판정·상세메모는 IndexedDB 스냅샷에 저장되면 안 된다');
  assert.ok(!snapJson.includes('신고인홍길동실명포함') && !snapJson.includes('신고인실명_공문제목_비저장'), '실명이 섞일 수 있는 사건 원제목·메일 제목은 IndexedDB 스냅샷에 저장되면 안 된다');
  assert.ok(!snapJson.includes('외부조사위원성명_비저장'), '조사위원 성명은 IndexedDB 스냅샷에 저장되면 안 된다');
  assert.ok(!snapJson.includes('기밀메일미리보기_비저장') && !snapJson.includes('조사 의뢰 문의'), '메일 본문 미리보기(preview)는 IndexedDB 스냅샷에 저장되면 안 된다');
});

test('④ 일터상생혁신(ilteo) · 산업일자리전환(jobtrans) — 메일함 지연 중에도 등록 사업장이 먼저 즉시 표시된다', async () => {
  /* 1) 일터상생혁신 */
  {
    const els = {};
    const getEl = (id) => (els[id] = els[id] || {
      id, value: '', textContent: '', innerHTML: '', style: { display: '' },
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      addEventListener() {}, setAttribute() {}, getAttribute: () => '', querySelectorAll: () => [], querySelector: () => null
    });
    let releaseMail = null;
    const mailHold = new Promise((r) => { releaseMail = r; });
    const dbMap = {
      'uid_roles/uIlteo': { sid: 'P001', name: '점검노무', status: 'active', isAdmin: true },
      'scal_ilteo': {
        projects: {
          p_il_1: { id: 'p_il_1', companyId: 'co1', companyName: '(주)가상일터즉시표시', year: 2026, isIlteo: true, programName: '일터혁신 상생컨설팅' }
        }
      }
    };
    const ctx = vm.createContext({
      console, setTimeout, clearTimeout, Promise, URLSearchParams,
      addEventListener() {}, removeEventListener() {},
      PuIlteoCatalog: IlteoCat, PuIlteoIntake: IlteoIntake, PuIlteoReport: IlteoReport,
      PuGate: { show() {}, hide() {} },
      PuOntologyWrite: { createGateway: () => ({ async save() { return { committed: true }; } }) },
      location: { search: '', hash: '', pathname: '/ilteo.html' },
      document: { activeElement: null, getElementById: getEl, querySelectorAll: () => [], querySelector: () => null, addEventListener() {} }
    });
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-ilteo-view.js'), 'utf8'), ctx);
    let authCb = null;
    const u = { uid: 'uIlteo', email: 'test@example.com' };
    ctx.PuIlteoView.boot({
      auth: Object.assign(() => ({ currentUser: u, setPersistence() {}, onAuthStateChanged(fn) { authCb = fn; } }), { Auth: { Persistence: { LOCAL: 'local' } } }),
      database: () => ({
        ref: (p) => ({
          once: () => (p.indexOf('mailbox/') === 0 ? mailHold : Promise.resolve({ val: () => (dbMap[p] || null) }))
        })
      })
    });
    const done = authCb(u);
    await new Promise((r) => setTimeout(r, 25));
    assert.ok(getEl('projectsBox').innerHTML.includes('(주)가상일터즉시표시'), '일터상생혁신은 메일함 응답 전에도 사업장 목록을 먼저 표시해야 한다');
    releaseMail({ val: () => ({}) });
    await done;
  }

  /* 2) 산업일자리전환 */
  {
    const els = {};
    const getEl = (id) => (els[id] = els[id] || {
      id, value: '', textContent: '', innerHTML: '', style: { display: '' },
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      addEventListener() {}, setAttribute() {}, getAttribute: () => '', querySelectorAll: () => [], querySelector: () => null
    });
    let releaseMail = null;
    const mailHold = new Promise((r) => { releaseMail = r; });
    const dbMap = {
      'uid_roles/uJt': { sid: 'P001', name: '점검노무', status: 'active', isAdmin: true },
      'scal_jobtrans': {
        projects: {
          p_jt_1: { id: 'p_jt_1', companyId: 'co2', companyName: '(주)가상전환즉시표시', agency: 'kmac', track: 'kmac_std', year: 2026 }
        }
      }
    };
    const ctx = vm.createContext({
      console, setTimeout, clearTimeout, Promise, URLSearchParams,
      addEventListener() {}, removeEventListener() {},
      PuJobtransCatalog: JobtransCat, PuJobtransIntake: JobtransIntake, PuJobtransReport: JobtransReport,
      PuGate: { show() {}, hide() {} },
      PuOntologyWrite: { createGateway: () => ({ async save() { return { committed: true }; } }) },
      location: { search: '', hash: '', pathname: '/jobtrans.html' },
      document: { activeElement: null, getElementById: getEl, querySelectorAll: () => [], querySelector: () => null, addEventListener() {} }
    });
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-jobtrans-view.js'), 'utf8'), ctx);
    let authCb = null;
    const u = { uid: 'uJt', email: 'test@example.com' };
    ctx.PuJobtransView.boot({
      auth: Object.assign(() => ({ currentUser: u, setPersistence() {}, onAuthStateChanged(fn) { authCb = fn; } }), { Auth: { Persistence: { LOCAL: 'local' } } }),
      database: () => ({
        ref: (p) => ({
          once: () => (p.indexOf('mailbox/') === 0 ? mailHold : Promise.resolve({ val: () => (dbMap[p] || null) }))
        })
      })
    });
    const done = authCb(u);
    await new Promise((r) => setTimeout(r, 25));
    assert.ok(getEl('projectsBox').innerHTML.includes('(주)가상전환즉시표시'), '산업일자리전환은 메일함 응답 전에도 사업장 목록을 먼저 표시해야 한다');
    releaseMail({ val: () => ({}) });
    await done;
  }
});

test('⑤ 대량 메일(8,000통 × 80사건) 반복 스캔 시 WeakMap 캐시로 메인 스레드 멈춤 없이 고속 처리된다', () => {
  const baseTs = Date.parse('2026-10-15T09:00:00Z');
  const mails = [];
  for (let i = 0; i < 8000; i++) {
    const isHit = i === 120 || i === 4500;
    mails.push({
      key: 'i:inbox:' + i,
      slug: 'inbox',
      uid: String(i),
      old: false,
      dir: 'in',
      ts: baseTs + i * 1000,
      date: '2026-10-15',
      fromName: isHit ? '(주)가상고속검증기업 인사팀' : '일반거래처' + (i % 50),
      fromAddr: isHit ? 'hr@speedtest.example' : ('info' + (i % 200) + '@other.example'),
      toAddr: 'pureun@pureunlabor.co.kr',
      toName: '푸른노무법인',
      extAddrs: [isHit ? 'hr@speedtest.example' : ('info' + (i % 200) + '@other.example')],
      subject: isHit ? '[긴급] (주)가상고속검증기업 직장 내 괴롭힘 사실조사 의뢰' : ('2026년 10월 급여명세서 및 4대보험 안내 #' + i),
      preview: isHit ? '직장 내 괴롭힘 신고 접수에 따른 외부 조사 의뢰' : '첨부 급여대장 확인 부탁드립니다.',
      attCount: 1,
      attNames: [isHit ? '조사의뢰공문.pdf' : '급여대장.xlsx']
    });
  }
  const cases = [];
  for (let c = 0; c < 80; c++) {
    cases.push({
      id: 'hc_' + c,
      companyId: 'co_' + c,
      companyName: c === 0 ? '(주)가상고속검증기업' : ('(주)가상별개사업장' + c),
      email: c === 0 ? 'hr@speedtest.example' : ('contact' + c + '@corp' + c + '.example'),
      receiveDate: '2026-10-01',
      mailLinks: []
    });
  }
  const coDir = HarassCore.buildCompanyDirectory(
    cases.map((c) => ({ id: c.companyId, name: c.companyName, email: c.email })),
    {}
  );

  const t0 = Date.now();
  let matchedFirst = [];
  for (let i = 0; i < cases.length; i++) {
    const res = HarassCore.scanMailsForCaseInternal(cases[i], mails, coDir, cases);
    if (i === 0) matchedFirst = res.items;
  }
  const bundles = HarassCore.discoverUnregisteredBundles(mails, [cases[0]], coDir, {});
  const elapsedMs = Date.now() - t0;

  assert.equal(matchedFirst.length, 2, '대상 사업장의 조사 관련 메일 2건이 정확히 매칭되어야 한다');
  assert.equal(bundles.length, 0, '이미 사건에 귀속된 메일은 중복 미등록 후보로 남지 않아야 한다');
  assert.ok(elapsedMs < 1500, `8,000통 × 80사건 스캔이 1.5초 이내에 완료되어야 한다 (실측 ${elapsedMs}ms)`);
});
