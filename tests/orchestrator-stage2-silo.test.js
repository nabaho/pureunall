'use strict';
/* ══════════════════════════════════════════════════════════════════════════
 * 병목 해소 2단계 — 오케스트레이터 5개 미연결 앱 · 4개 비-in_app 경량 거울 검증
 *   1. STAGES · APP_META 에 safety · edulib · rulesv2 · pubsearch · datahub 연결
 *   2. consultings 안전보건 수임 ➔ safety 바통 연동
 *   3. paydata/arrivals · payroll_os/inbox · edulib_inbox · datahub_board 바통 생성
 *   4. 비관리자 권한 분리(edulib_inbox · datahub_board) 및 원본 무변경 보장
 * ══════════════════════════════════════════════════════════════════════════ */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const readUtf8 = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const O = require('../js/pu-ontology.js');
const Core = require('../js/pu-orchestrator-core.js');

test('① STAGES와 APP_META에 safety · edulib · rulesv2 · pubsearch · datahub 5개 앱이 모두 연결된다', () => {
  const stageApps = new Set(Core.STAGES.flatMap((st) => st.apps));
  for (const k of ['safety', 'edulib', 'rulesv2', 'pubsearch', 'datahub']) {
    assert.ok(Core.APP_META[k], `APP_META.${k} 가 있어야 합니다`);
    assert.ok(stageApps.has(k), `STAGES 에 ${k} 가 포함되어야 합니다`);
  }
  assert.equal(Core.APP_META.safety.url, 'safety.html');
  assert.equal(Core.APP_META.edulib.url, 'pu-edulib.html');
  assert.equal(Core.APP_META.rulesv2.url, 'rules-v2.html');
  assert.equal(Core.APP_META.pubsearch.url, 'pu-pubsearch.html');
  assert.equal(Core.APP_META.datahub.url, 'pu-datahub.html');
  assert.equal(Core.APP_META.datahub.adminOnly, true);

  assert.equal(Core.appCanAccess('safety', { role: 'staff' }), true);
  assert.equal(Core.appCanAccess('edulib', { role: 'staff' }), true);
  assert.equal(Core.appCanAccess('rulesv2', { role: 'staff' }), true);
  assert.equal(Core.appCanAccess('pubsearch', { role: 'staff' }), true);
  assert.equal(Core.appCanAccess('datahub', { role: 'staff', isAdmin: false }), false);
  assert.equal(Core.appCanAccess('datahub', { role: 'admin', isAdmin: true }), true);

  for (const root of ['paydata/arrivals', 'payroll_os/inbox', 'edulib_inbox', 'datahub_board']) {
    assert.ok(O.PROGRAMS.orch.sharedRoots.includes(root), `PuOntology orch sharedRoots 에 ${root} 가 있어야 합니다`);
  }
});

test('② 안전보건 수임 · 급여도착타임스탬프 · 강의정리함 · 현황판 바통 생성과 권한 분리·무변경을 지킨다', () => {
  const now = Date.UTC(2026, 10, 28, 3, 0, 0);
  const raw = {
    companies: [
      { id: 'co-1', name: '(주)한빛테크', bizNo: '111-81-00001', puNo: 10501, status: 'active', managerMain: 'P-010' },
      { id: 'co-closed', name: '(주)종료기업', bizNo: '111-81-00002', puNo: 10502, status: 'closed', managerMain: 'P-010' }
    ],
    userDir: [{ sid: 'P-010', name: '이노무', status: 'active' }],
    consultings: [
      { id: 'cs-safe-1', companyId: 'co-1', bizName: '산재예방 안전보건관리체계 구축', status: 'progress' }
    ],
    paydataArrivals: {
      'co-1': {
        '202611': {
          attend: { a1: now - 3600000, a2: now - 1800000 },
          ledger: { l1: now - 900000 },
          last: now - 900000
        }
      },
      'co-closed': {
        '202611': { attend: { x1: now - 1000 }, last: now - 1000 }
      }
    },
    payrollInbox: {},
    edulibInbox: {
      q: {
        q1: { key: 'q1', att: '법정의무교육.pdf' },
        q2: { key: 'q2', _deleted: true }
      }
    },
    datahubBoard: {
      fin: { state: 'na', n: [], at: now - 1000, why: 'noPerm' },
      work: { state: 'ok', n: [{ label: '진행', v: 4 }], at: now - 1000 }
    }
  };
  const snapBefore = JSON.stringify(raw);

  const staffRep = Core.analyzeWorkspace(raw, {
    now, uid: 'u-s', sid: 'P-010', role: 'staff', isAdmin: false, perms: {}
  });
  assert.equal(JSON.stringify(raw), snapBefore, '분석기는 입력 원본을 절대 변경하면 안 됩니다');

  assert.ok(staffRep.batons.some((b) => b.id === 'cons-safety:cs-safe-1' && b.toApp === 'safety'));
  const pdBaton = staffRep.batons.find((b) => b.id === 'paydata-arr:co-1:202611');
  assert.ok(pdBaton, 'paydata/arrivals 경량 타임스탬프로 급여 바통이 생성되어야 합니다');
  assert.equal(pdBaton.toApp, 'payroll');
  assert.equal(pdBaton.severity, 'warn');
  assert.doesNotMatch(pdBaton.title + ' ' + pdBaton.reason, /홍길동|P-010/);
  assert.equal(staffRep.batons.some((b) => b.companyId === 'co-closed'), false, '종결 업체는 제외해야 합니다');
  assert.equal(staffRep.batons.some((b) => b.ruleCode === 'edulib_inbox_pending'), false, '일반 직원은 edulib_inbox 바통을 보지 못합니다');
  assert.equal(staffRep.batons.some((b) => b.ruleCode === 'datahub_board_alert'), false, '일반 직원은 datahub_board 바통을 보지 못합니다');

  const adminRep = Core.analyzeWorkspace({
    ...raw,
    payrollInbox: {
      in1: { companyId: 'co-1', 월: '2026-11', ts: now }
    }
  }, {
    now, uid: 'u-a', sid: 'P-001', role: 'admin', isAdmin: true, perms: { fin: true }
  });
  const syncedPdBaton = adminRep.batons.find((b) => b.id === 'paydata-arr:co-1:202611');
  assert.ok(syncedPdBaton);
  assert.equal(syncedPdBaton.severity, 'normal', '급여 수신함이 이미 연결된 경우 일반 등급으로 내려갑니다');
  assert.ok(adminRep.batons.some((b) => b.ruleCode === 'edulib_inbox_pending' && b.toApp === 'edulib'));
  assert.ok(adminRep.batons.some((b) => b.ruleCode === 'datahub_board_alert' && b.toApp === 'datahub'));
});

test('③ pu-orchestrator-view 는 datahub_board 권한 없음 시 perm_skip 처리하고 v 캐시버스팅이 동기화된다', async () => {
  const viewSrc = readUtf8('js/pu-orchestrator-view.js');
  const enterHtml = readUtf8('enter.html');
  const orchHtml = readUtf8('pu-orchestrator.html');

  assert.match(enterHtml, /<script src="js\/pu-orchestrator-core\.js\?v=\d+"><\/script>/);
  assert.match(orchHtml, /<script src="js\/pu-orchestrator-core\.js\?v=\d+"><\/script>/);
  assert.match(orchHtml, /<script src="js\/pu-orchestrator-view\.js\?v=\d+"><\/script>/);
  assert.match(enterHtml, /'edulib_inbox'/);

  const els = {};
  const mkEl = (id) => (els[id] = els[id] || {
    id, hidden: false, textContent: '', innerHTML: '', className: '', value: '',
    options: [], style: {}, dataset: {}, children: [],
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, appendChild() {}, querySelectorAll() { return []; },
    getBoundingClientRect() { return { height: 0 }; }
  });
  const sandbox = {
    window: null,
    document: {
      readyState: 'loading',
      body: { style: {}, classList: { toggle() {}, add() {}, remove() {} }, appendChild() {} },
      documentElement: { style: { setProperty() {} } },
      getElementById: (id) => mkEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {}
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    Promise, Date, Object, Array, Number, String, Boolean, Math, JSON, Error, RegExp, setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.window.PuOrchestratorCore = Core;
  vm.createContext(sandbox);
  vm.runInContext(viewSrc, sandbox);

  let denyCases = false;
  const mockFirebase = {
    auth: () => ({
      currentUser: { uid: 'u-admin2' },
      onAuthStateChanged(fn) {
        fn({ uid: 'u-admin2' });
      }
    }),
    database: () => ({
      ref(p) {
        return {
          once() {
            if (p === 'uid_roles/u-admin2') {
              return Promise.resolve({ exists: () => true, val: () => ({ role: 'admin', isAdmin: true, status: 'active', sid: 'P-002', name: '김대표' }) });
            }
            if (p === 'datahub_board') {
              return Promise.reject({ code: 'PERMISSION_DENIED', message: 'permission_denied' });
            }
            if (denyCases && p === 'data/cases/v') {
              return Promise.reject({ code: 'PERMISSION_DENIED', message: 'permission_denied' });
            }
            return Promise.resolve({ val: () => ({}) });
          }
        };
      }
    })
  };
  sandbox.window.PuOrchestratorView.boot(mockFirebase);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(mkEl('loadNote').hidden, true, '선택적 datahub_board 권한 없음은 perm_skip 으로 처리되어 경고가 뜨지 않아야 합니다');
  assert.equal(mkEl('loadNote').textContent, '');

  denyCases = true;
  sandbox.window.PuOrchestratorView.boot(mockFirebase);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(mkEl('loadNote').hidden, false, '일반 경로 실패 시에는 부분 수집 안내가 표시되어야 합니다');
});
