'use strict';
/* 한 엔진 · 세 앱 — 푸른이알피 / 직원 인사 / 재무 (대표 지시 2026-10-09
   「완벽히 분리해서 별도앱으로 만들어라 니가한 목업과 같이 만들어라 분리시킬때 오류나 문제가 발생하면 안된다.
    그리고 파이어베이스와 나스 등 연결되어있는부분도 각자 데이터를 잘 관리할 수 있도록 해야된다.」)

   ■ 왜 «한 엔진»인가 — 코드를 두 벌로 떼면 같은 자료(입금·직원 명부·마감 잠금)를 «다른 코드»가 고친다.
     그래서 앱은 주소 꼬리표(pu-erp.html?app=hr·fin)로 가르고, 창·메뉴·환경설정·저장 기록·백업 목차를 따로 둔다.

   못 박는 것(규칙):
   ① 메뉴 묶음과 환경설정 탭은 «정확히 한 앱»의 것이다(환경설정 메뉴만 셋 다)
   ② 다른 앱의 화면으로 가는 길은 selectMenu 한 곳에서 그 앱 창으로 넘긴다 — 이 창에 남의 화면이 뜨지 않는다
   ③ 앱 창이 이미 있으면 다시 읽지 않고 그 화면만 고른다 · 없으면 연다 · 팝업이 막히면 이 창에서 간다
   ④ 앱마다 따로 적는 것: 마지막 본 화면 · 환경설정 탭 · 못 보낸 저장 기록(이알피 열쇠는 예전 그대로)
   ⑤ 같은 PC 의 다른 창이 새 판을 받으면 이 창도 서버에서 받아 맞춘다(force) — 낡은 화면 위 저장이 남의 변경을 덮지 않게
   ⑥ 접속표시 — 다른 창이 닫히며 지운 내 자리는 곧바로 되살린다
   ⑦ 포털 — 내외관리 줄에 두 타일, 권한(uid_roles)이 있을 때만 · 입금 알림은 재무 타일 · 거래내역은 재무 앱
   ⑧ 등록부 — 두 앱의 자료 목록이 한 곳에 있고, 저장 관문은 이알피와 같은 모드다
   ⑨ 백업 — 앱별 목차(표 이름만)를 그 목록에서 만들어 함께 적는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const erp = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const portal = fs.readFileSync(path.join(R, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');
const O = require(path.join(R, 'js', 'pu-ontology.js'));
const W = require(path.join(R, 'js', 'pu-ontology-write.js'));

/* PU_APPS 덩어리를 떼어 «주소»를 바꿔 가며 돌린다 */
const APPS_SRC = (() => {
  const a = erp.indexOf('var PU_APPS = {');
  const b = erp.indexOf('/* 앱마다 탭 이름·탭 그림·설치 정보는', a);
  assert.ok(a > 0 && b > a, 'PU_APPS 덩어리를 못 찾음');
  return erp.slice(a, b);
})();
function appsWorld(search, opts) {
  opts = opts || {};
  const opened = [];
  const c = {
    URLSearchParams, String,
    window: { location: { search: search || '', href: '' }, IS_MOBILE: !!opts.mobile,
      open: (u, n) => { opened.push({ u, n }); return opts.win === undefined ? null : opts.win; } },
  };
  vm.createContext(c);
  vm.runInContext(APPS_SRC, c);
  c._opened = opened;
  return c;
}
const MENU_GROUPS = (() => {
  const m = erp.slice(erp.indexOf('var MENUS = ['), erp.indexOf('];', erp.indexOf('var MENUS = [')));
  return [...m.matchAll(/gid:'(\w+)'/g)].map((x) => x[1]);
})();
const ENV_TAB_IDS = (() => {
  const a = erp.indexOf('var ENV_TABS');
  return [...erp.slice(a, erp.indexOf('];', a)).matchAll(/id:'(\w+)'/g)].map((x) => x[1]);
})();

test('① 메뉴 묶음은 «한 앱»의 것 · 환경설정 탭도 «한 앱»의 것', () => {
  const w = appsWorld('');
  const A = JSON.parse(JSON.stringify(w.PU_APPS));
  assert.ok(MENU_GROUPS.length >= 5, '메뉴 묶음을 못 읽음');
  MENU_GROUPS.filter((g) => g !== 'env').forEach((g) => {
    const owners = Object.keys(A).filter((k) => A[k].groups.indexOf(g) >= 0);
    assert.equal(owners.length, 1, g + ' 묶음의 앱이 ' + owners.length + '개 — 하나여야 한다(새 묶음이면 PU_APPS 에 적을 것)');
  });
  Object.keys(A).forEach((k) => assert.ok(A[k].groups.indexOf('env') >= 0, k + ' 앱에 환경설정이 없다'));
  ENV_TAB_IDS.forEach((t) => {
    const owners = Object.keys(A).filter((k) => A[k].env.indexOf(t) >= 0);
    assert.equal(owners.length, 1, '환경설정 «' + t + '» 탭의 앱이 ' + owners.length + '개 — 새 탭이면 PU_APPS.env 에 적을 것');
  });
  assert.deepEqual(A.hr.env, ['hr'], '직원 인사 창 환경설정은 인사관리기준만(목업)');
  assert.deepEqual(A.fin.env, ['fin'], '재무 창 환경설정은 재무관리기준만(목업)');
});

test('② 주소로 앱을 가른다 · 메뉴는 제 앱으로', () => {
  assert.equal(appsWorld('').PU_APP, 'erp');
  assert.equal(appsWorld('?sso=1&app=hr').PU_APP, 'hr');
  assert.equal(appsWorld('?app=fin&v=3').PU_APP, 'fin');
  assert.equal(appsWorld('?app=evil').PU_APP, 'erp', '모르는 꼬리표는 이알피');
  const h = appsWorld('?app=hr');
  assert.equal(h.puAppOfMenu('hr/staff'), 'hr');
  assert.equal(h.puAppOfMenu('fin/ledger'), 'fin');
  assert.equal(h.puAppOfMenu('biz/case'), 'erp');
  assert.equal(h.puAppOfMenu('dash/my'), 'erp');
  assert.equal(h.puAppOfMenu('env/settings'), 'hr', '환경설정은 «지금 앱»의 것');
});

test('③★ 다른 앱 화면 — 그 앱 창이 떠 있으면 다시 읽지 않고 그 화면만 고른다', () => {
  const picked = [];
  const win = { location: { pathname: '/pureunall/pu-erp.html', search: '?sso=1&app=fin' },
    navigateTo: (m) => picked.push(m), focus() {} };
  const w = appsWorld('', { win });
  w.puAppGo('fin/recv');
  assert.deepEqual(w._opened[0], { u: '', n: 'pureun-fin' }, '★ 창 이름이 포털 타일과 같아야 같은 앱이 두 창으로 안 열린다');
  assert.deepEqual(picked, ['fin/recv'], '★ 다시 읽으면 그 창에서 쓰던 것을 잃는다');
});
test('③ 다른 앱 창이 없거나 다른 화면이면 그 앱 주소로 · 팝업이 막히면 이 창에서 · 폰은 이 창에서', () => {
  let replaced = '';
  const blank = { location: { pathname: '', search: '', replace: (u) => { replaced = u; } }, focus() {} };
  const w = appsWorld('?app=hr', { win: blank });
  w.puAppGo('biz/contract');
  assert.equal(replaced, 'pu-erp.html?sso=1#menu=biz%2Fcontract');
  const w2 = appsWorld('', { win: null });
  w2.puAppGo('hr/pay');
  assert.equal(w2.window.location.href, 'pu-erp.html?sso=1&app=hr#menu=hr%2Fpay');
  const w3 = appsWorld('', { mobile: true, win: blank });
  w3.puAppGo('fin/ledger');
  assert.equal(w3._opened.length, 0, '폰에서는 창을 열지 않는다');
  assert.equal(w3.window.location.href, 'pu-erp.html?sso=1&app=fin#menu=fin%2Fledger');
});

test('②★ 길은 selectMenu 한 곳 — 권한·모바일 검사 «뒤», 화면을 바꾸기 «전»에 넘긴다', () => {
  const main = cutFn(erp, 'function ERPMain(props)');
  const sel = cutFn(main, 'function selectMenu(id)');
  const iGo = sel.indexOf('if(!_inApp(id) && typeof puAppGo === \'function\'){ puAppGo(id); return; }');
  assert.ok(iGo > 0, 'selectMenu 에서 다른 앱 화면을 넘기지 않는다');
  assert.ok(sel.indexOf('isMenuPermitted(CURRENT_USER, id)') < iGo, '권한 검사가 먼저여야 한다');
  assert.ok(iGo < sel.indexOf('setCurrent(id);'), '★ 넘기기 전에 화면을 바꾸면 이 창에 남의 앱 화면이 뜬다');
  assert.match(main, /window\.navigateTo = selectMenu;/, '깊은 화면의 이동도 같은 길');
  assert.match(main, /var defaultMenu = \(_menuAllowed\(hashMenu\) && _inApp\(hashMenu\)\) \? hashMenu : startMenu;/,
    '★ 옛 링크(#menu=fin/…)로 이알피를 열면 이알피에 재무 화면이 떴다');
  assert.match(main, /if\(hashMenu && !_inApp\(hashMenu\) && _menuAllowed\(hashMenu\) && typeof puAppGo === 'function'\) puAppGo\(hashMenu\);/);
});

test('① 옆 메뉴는 이 앱의 묶음만 · 즐겨찾기도 이 앱 것만 보인다(저장은 그대로)', () => {
  const sb = cutFn(erp, 'function Sidebar(props)');
  assert.match(sb, /if\(typeof puAppHasGroup === 'function' && !puAppHasGroup\(grp\.gid\)\) return null;/);
  assert.match(sb, /\.filter\(function\(p\)\{ return typeof puAppHasGroup !== 'function' \|\| puAppHasGroup\(p\.grp\.gid\); \}\)/);
  assert.match(sb, /data-pu-app/, '직원 인사·재무 창에는 이름표(목업)');
  const env = cutFn(erp, 'function EnvSettings()');
  assert.match(env, /ENV_TABS\.filter\(function\(t\)\{ return typeof puAppEnvTabOk !== 'function' \|\| puAppEnvTabOk\(t\.id\); \}\)/);
  assert.doesNotMatch(env.replace(/var _envTabs = ENV_TABS\.filter[^\n]*/, ''), /ENV_TABS\.(find|forEach|slice)\(/,
    '★ 걸러 놓고 다른 자리에서 ENV_TABS 를 통째로 쓰면 남의 앱 탭이 되살아난다');
});

test('④ 앱마다 따로 적는다 — 마지막 화면 · 환경설정 탭 · 못 보낸 저장 기록 (이알피 열쇠는 예전 그대로)', () => {
  const main = cutFn(erp, 'function ERPMain(props)');
  assert.match(main, /var _lastMenuKey = 'pureun_v6_session_last_menu_' \+ \(\(typeof PU_APP !== 'undefined' && PU_APP !== 'erp'\) \? PU_APP \+ '_' : ''\)/);
  assert.match(main, /localStorage\.getItem\(_lastMenuKey\)/);
  assert.match(main, /localStorage\.setItem\(_lastMenuKey, id\)/);
  const env = cutFn(erp, 'function EnvSettings()');
  assert.match(env, /'pureun_v6_env_last_tab' \+ \(\(typeof PU_APP/);
  assert.match(env, /'pureun_v6_env_tabs_order' \+ \(\(typeof PU_APP/);
  /* 못 보낸 저장 기록 — 같이 쓰면 «못 보낸 것이 없는» 앱이 저장할 때 열쇠를 지워 남의 기록이 사라진다 */
  const fn = cutFn(erp, 'function _fbPendLsKey()');
  const run = (app) => {
    const c = { FB_PEND_LS: 'pu_erp_fb_pending_v1', String, getSessionSid: () => 'P-001' };
    if (app) c.PU_APP = app;
    vm.createContext(c); vm.runInContext(fn, c);
    return c._fbPendLsKey();
  };
  assert.equal(run('erp'), 'pu_erp_fb_pending_v1_P-001', '★ 이알피 열쇠가 바뀌면 이미 적힌 못 보낸 기록을 못 읽는다');
  assert.equal(run(undefined), 'pu_erp_fb_pending_v1_P-001');
  assert.equal(run('hr'), 'pu_erp_fb_pending_v1_hr_P-001');
  assert.equal(run('fin'), 'pu_erp_fb_pending_v1_fin_P-001');
});

test('⑤★ 다른 창이 새 판을 받으면 이 창도 서버에서 받아 force 로 얹는다', () => {
  const src = cutFn(erp, 'function _fbSiblingRefresh(k)') + '\n' + cutFn(erp, 'function _fbOnSiblingStorage(e)');
  const timers = [], applied = [], read = [];
  const c = {
    KEY: 'pureun_v6_', _fbSiblingTimers: {}, window: {},
    fbShouldSync: (k) => k !== 'session_x',
    fbDb: { ref: (p) => ({ once: () => { read.push(p); return Promise.resolve({ val: () => ({ v: [1], u: 7 }) }); } }) },
    _fbApplyRecord: (k, v, o) => applied.push({ k, u: v.u, o }),
    setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout() {},
  };
  vm.createContext(c); vm.runInContext(src, c);
  c._fbOnSiblingStorage({ key: 'pureun_v6_finance_income', newValue: '[]' });   // 자료 칸 — 표시가 아니다
  c._fbOnSiblingStorage({ key: 'pureun_v6__meta_session_x', newValue: '5' });  // 서버로 안 가는 칸
  assert.equal(timers.length, 0, '표시가 아닌 칸·서버로 안 가는 칸은 안 받는다');
  c._fbOnSiblingStorage({ key: 'pureun_v6__meta_payroll_monthly', newValue: '7' });
  assert.equal(timers.length, 1);
  timers[0]();
  return new Promise((r) => setImmediate(r)).then(() => {
    assert.deepEqual(read, ['data/payroll_monthly']);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].o.force, true, '★ force 가 아니면 «이미 받은 판»으로 건너뛴다');
    assert.equal(applied[0].o.notify, true, '화면이 다시 그려져야 한다');
  });
});
test('⑤ force — 같은 판은 얹고, 표시보다 «옛» 판은 여전히 안 얹는다(내가 못 보낸 새것이 있다) · 급감 확인을 다시 안 묻는다', () => {
  const fn = cutFn(erp, 'function _fbApplyRecordInner(k, v, opts)');
  assert.match(fn, /if\(v\.u > localTime \|\| \(opts\.force && v\.u >= localTime\)\)\{/);
  assert.match(fn, /if\(!opts\.force && _oldN !== null/);
  assert.match(erp, /window\.addEventListener\('storage', _fbOnSiblingStorage\)/);
});

test('⑥ 접속표시 — 다른 창이 닫히며 지운 «내 자리»는 곧바로 되살린다', () => {
  const fn = cutFn(erp, 'function initPresence(sid, name)');
  assert.match(fn, /if\(s\.key === _presenceKey && _presenceRef && _presencePayload\)\{\s*setTimeout\(function\(\)\{ if\(_presenceRef && _presencePayload\)\{ try \{ _writePresence\(true\); \}/);
});

test('⑦★ 포털 — 내외관리 줄에 직원 인사·재무, 권한이 있을 때만 · 처음엔 감춰 두고 권한표를 읽어 보인다', () => {
  const at = portal.indexOf('var APPS = [');
  const apps = portal.slice(at, portal.indexOf('];', at));
  assert.match(apps, /\{ key:'hr',\s+name:'직원 인사',[^}]*url:'pu-erp\.html\?app=hr',[^}]*perm:'hr',\s*row:'inout' \}/);
  assert.match(apps, /\{ key:'fin',\s+name:'재무',[^}]*url:'pu-erp\.html\?app=fin',[^}]*perm:'fin',\s*row:'inout' \}/);
  assert.match(portal, /var _permHide = !!\(app\.perm && !_isAdm && !\(typeof portalAppPermOk === 'function' && portalAppPermOk\(app\.perm\)\)\);/);
  assert.match(portal, /if\(_permHide\) a\.style\.display = 'none';/);
  assert.match(portal, /portalLoadAppPerm\(\);/);
  /* 권한 잣대를 실제로 돌려 본다 */
  const ok = cutFn(portal, 'function portalAppPermOk(perm)') + '\n' + cutFn(portal, 'function _portalPermCache(uid)');
  const run = (cache, live) => {
    const store = { 'pu_app_perm_U1': cache ? JSON.stringify(cache) : null };
    const c = { JSON, _portalAppPerm: live || null, auth: { currentUser: { uid: 'U1' } },
      localStorage: { getItem: (k) => store[k] || null } };
    vm.createContext(c); vm.runInContext(ok, c);
    return [c.portalAppPermOk('hr'), c.portalAppPermOk('fin')];
  };
  assert.deepEqual(run(null), [false, false], '★ 모르면 감춘다');
  assert.deepEqual(run({ hr: true }), [true, false]);
  assert.deepEqual(run({ isSubAdmin: true }), [true, true], '위임관리인은 둘 다');
  assert.deepEqual(run({ hr: true }, { fin: true }), [false, true], '서버에서 읽은 값이 이 기기 기억보다 앞선다');
  const hide = cutFn(portal, 'function hideEmptyRows()');
  assert.match(hide, /t\.style\.display !== 'none'/, '★ 감춘 타일만 있는 줄은 빈 줄로 접는다');
});
test('⑦ 입금 알림은 재무 타일에 · 거래내역은 재무 앱(재무 창)으로', () => {
  const paint = cutFn(portal, 'function portalHanaPaintBadge()');
  assert.match(paint, /document\.querySelector\('\.tile\[data-key="fin"\]'\) \|\| document\.querySelector\('\.tile\[data-key="erp"\]'\)/);
  const open = cutFn(portal, 'function openHanaLedger()');
  assert.ok(open.indexOf("APPS[i].key === 'fin'") >= 0 && open.indexOf("APPS[i].key === 'fin'") < open.indexOf("APPS[j].key === 'erp'"));
  assert.match(open, /\(app\.url\.indexOf\('\?'\) >= 0 \? '&' : '\?'\) \+ 'sso=1&hanaAlert=1/, '★ ?app=fin 뒤에 ?를 또 붙이면 주소가 깨진다');
});
test('⑦ 다른 앱에서 들어오는 길도 그 앱으로 — 캘린더·기업정보함', () => {
  const cal = fs.readFileSync(path.join(R, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');
  const go = cutFn(cal, 'function goErp(menu)');
  const c = { String, encodeURIComponent, location: { href: '' }, window: {} };
  vm.createContext(c); vm.runInContext(go, c);
  c.goErp('hr/attend'); assert.equal(c.location.href, 'pu-erp.html?sso=1&app=hr#menu=hr%2Fattend');
  c.goErp('biz/case'); assert.equal(c.location.href, 'pu-erp.html?sso=1#menu=biz%2Fcase');
  const cards = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8');
  assert.ok(cards.indexOf("'pu-erp.html#menu=fin/") < 0, '기업정보함이 재무 화면을 이알피로 연다');
});

test('⑦ 앱마다 제 이름·그림·설치 정보 — manifest 와 아이콘이 있고 «제 문»을 연다', () => {
  ['hr', 'fin'].forEach((k) => {
    const mf = JSON.parse(fs.readFileSync(path.join(R, 'pu-' + k + '-manifest.json'), 'utf8'));
    assert.match(mf.start_url, new RegExp('pu-erp\\.html\\?app=' + k + '$'));
    assert.equal(mf.id, mf.start_url, 'id 가 다르면 이알피와 같은 앱으로 깔린다');
    mf.icons.forEach((i) => {
      assert.ok(i.src.indexOf('icon-' + k + '-') === 0);
      assert.ok(fs.statSync(path.join(R, i.src)).size > 500, i.src + ' 가 비었다');
    });
    assert.ok(erp.indexOf("mf:'pu-" + k + "-manifest.json'") > 0, '머리말이 manifest 를 바꿔 달지 않는다');
  });
});

test('⑧★ 등록부 — 두 앱이 있고, 자료 목록이 «한 곳»이며, 저장 관문은 이알피와 같은 모드다', () => {
  ['hr', 'fin'].forEach((k) => {
    const p = O.PROGRAMS[k];
    assert.ok(p, k + ' 이 등록부에 없다');
    assert.equal(p.file, 'pu-erp.html?app=' + k);
    assert.ok(p.primaryRoots.length >= 10);
    assert.equal(W.runtimeMode(k, 'observe'), W.runtimeMode('erp', 'observe'),
      '★★ 같은 저장 엔진인데 한쪽만 막히면 같은 코드가 창에 따라 저장되거나 막힌다');
  });
  const all = O.PROGRAMS.hr.primaryRoots.concat(O.PROGRAMS.fin.primaryRoots);
  assert.equal(new Set(all).size, all.length, '★ 한 표를 두 앱이 맡으면 나스에 두 번 간다');
  ['user_accounts', 'payroll_monthly', 'attendance_records', 'locked_payroll_months'].forEach((k) =>
    assert.ok(O.PROGRAMS.hr.primaryRoots.indexOf('data/' + k) >= 0, k));
  ['finance_income', 'finance_expense', 'ledger_batches', 'locked_income_months'].forEach((k) =>
    assert.ok(O.PROGRAMS.fin.primaryRoots.indexOf('data/' + k) >= 0, k));
});

test('⑨★ 백업 — 앱별 목차(표 이름만)를 등록부 목록에서 만들어 함께 적는다', () => {
  const fn = cutFn(erp, 'function erpBackupAppIndex(data)');
  const c = { window: { PuOntology: O }, Object };
  vm.createContext(c); vm.runInContext(fn, c);
  const idx = JSON.parse(JSON.stringify(c.erpBackupAppIndex({ contracts: 1, payroll_monthly: 1, finance_income: 1, ui_pins: 1, user_accounts: 1 })));
  assert.deepEqual(idx, { erp: ['contracts', 'ui_pins'], hr: ['payroll_monthly', 'user_accounts'], fin: ['finance_income'] });
  const snap = cutFn(erp, 'function buildBackupSnapshot()');
  assert.match(snap, /apps: \(typeof erpBackupAppIndex === 'function'\) \? erpBackupAppIndex\(data\) : null/);
  const raw = cutFn(erp, 'function _serverBackupWriteRaw(id, snap, locked)');
  assert.match(raw, /if\(snap\.apps\) _head\.apps = snap\.apps;/);
  assert.match(raw, /fbDb\.ref\('serverBackups\/' \+ id\)\.set\(_head\)/);
});
