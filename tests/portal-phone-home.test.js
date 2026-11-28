'use strict';
/* 포털(enter.html) 폰 홈(★ 추천안: 최근 4 + 핵심 8·편집 + 5폴더 서랍) 회귀 테스트 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const E = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').replace(/\r\n/g, '\n');
const HEAD = E.slice(0, E.indexOf('</head>'));
const BODY = E.slice(E.indexOf('</head>'));

function sliceVar(src, marker, endMarker) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, '목록을 찾지 못했습니다: ' + marker);
  const j = src.indexOf(endMarker, i);
  assert.ok(j > i, '끝을 찾지 못했습니다: ' + marker);
  return src.slice(i, j + endMarker.length);
}

function buildPmBox(storeInit) {
  const store = Object.assign({}, storeInit || {});
  const src = [
    sliceVar(E, 'var APPS = [', '\n  ];'),
    sliceVar(E, 'var APP_ROWS = [', '\n  ];'),
    sliceVar(E, 'var ROW_MOVED_FROM =', ';'),
    E.match(/var PM_CORE_MAX\s*=[^\n]+/)[0],
    E.match(/var PM_DEFAULT_CORE\s*=[^\n]+/)[0],
    E.match(/var PM_DEFAULT_RECENT\s*=[^\n]+/)[0],
    sliceVar(E, 'var PM_FOLDERS = [', '\n  ];'),
    sliceVar(E, 'var PM_FOLDER_MAP = {', '\n  };'),
    cutFn(E, 'function rowExists('),
    cutFn(E, 'function appRowOf('),
    cutFn(E, 'function pmEsc('),
    cutFn(E, 'function pmKnownApp('),
    cutFn(E, 'function pmFolderOf('),
    cutFn(E, 'function pmReadList('),
    cutFn(E, 'function pmWriteList('),
    cutFn(E, 'function pmVisibleApps('),
    cutFn(E, 'function pmVisMap('),
    cutFn(E, 'function pmCoreSplit('),
    cutFn(E, 'function pmToggleCore('),
  ].join('\n');
  const ctx = {
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    origTile: (key) => (ctx.__hiddenKeys && ctx.__hiddenKeys[key] ? null : { style: { display: '' } }),
    tileShown: (t) => !!t && (!t.style || t.style.display !== 'none'),
    pmCoreKey: () => 'pu_phone_core_v1__',
    pmRender: () => {},
    pmShowToast: (m) => { ctx.__lastToast = m; },
    Array, Object, JSON, String, Number, Boolean,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  ctx.__store = store;
  return ctx;
}

test('① 폰 홈 마크업·바텀시트·PC 숨김 규칙이 있고 기존 #pinRow 규칙을 깨지 않는다', () => {
  ['id="phoneHome"', 'id="pmFolderSheet"', 'id="pmEditSheet"', 'id="pmToast"'].forEach((needle) => {
    assert.ok(BODY.includes(needle), needle + ' 요소가 enter.html 에 없습니다');
  });
  assert.match(HEAD, /#phoneHome\{display:none;\}/, 'PC 에서 #phoneHome 이 숨겨져야 합니다');
  assert.match(HEAD, /@media \(max-width:640px\)\{\s*body\.pm-phone-on #phoneHome\{display:block;/, '폰 구간에서 body.pm-phone-on 일 때 #phoneHome 이 보여야 합니다');
  assert.doesNotMatch(HEAD, /#pinRow\{display:none;\}/, '단독 #pinRow{display:none;} 는 기존 테스트와 충돌합니다');
  assert.ok(!BODY.includes('id="appSearch"') && !BODY.includes('fold-search'), '검색칸 금지를 지켰는지 확인합니다');
});

test('② 활성 본문 앱 32개가 5개 폴더에 누락·중복 없이 매핑되며 미등록 앱도 row 로 폴백된다', () => {
  const c = buildPmBox();
  const folderIds = new Set(Array.from(c.PM_FOLDERS, (f) => f.id));
  const activeBody = Array.from(c.APPS).filter((a) => !a.off && !a.head);
  assert.ok(activeBody.length >= 32, '활성 본문 앱 수가 기대보다 적습니다');
  activeBody.forEach((a) => {
    const fid = c.pmFolderOf(a);
    assert.ok(folderIds.has(fid), a.key + ' 앱 폴더가 5개 폴더 안에 없습니다: ' + fid);
  });
  assert.strictEqual(c.pmFolderOf({ key: 'future_store_app', row: 'store' }), 'f_store');
  assert.strictEqual(c.pmFolderOf({ key: 'future_sales_app', row: 'sales' }), 'f_sales');
  assert.strictEqual(c.pmFolderOf({ key: 'future_inside_app', row: 'inside' }), 'f_inside');
  assert.strictEqual(c.pmFolderOf({ key: 'future_client_app', row: 'unknown' }), 'f_client');
});

test('③ pmReadList 는 0개([]) 저장·중복 제거·최대 개수·잘못된 키 걸러내기와 pmEsc 이스케이프를 지킨다', () => {
  const k = 'pu_phone_core_v1_test';
  const c = buildPmBox({
    [k]: JSON.stringify(['erp', 'erp', 'bad_key', 'mail', 'cards', 'photos', 'pbox', 'consult', 'payroll', 'harass', 'fund', 'rules']),
    empty_core: JSON.stringify([]),
  });
  const loaded = Array.from(c.pmReadList(k, c.PM_DEFAULT_CORE, c.PM_CORE_MAX, true));
  assert.strictEqual(loaded.length, 8, '최대 8개 상한이 지켜지지 않았습니다');
  assert.strictEqual(loaded[0], 'erp');
  assert.ok(!loaded.includes('bad_key'), '없는 앱 키가 남았습니다');
  assert.strictEqual(new Set(loaded).size, loaded.length, '중복 키가 남았습니다');

  assert.deepStrictEqual(Array.from(c.pmReadList('empty_core', c.PM_DEFAULT_CORE, 8, true)), [], '0개([]) 저장이 기본값으로 덮였습니다');
  assert.strictEqual(c.pmEsc('<img onerror="x">&\'a\''), '&lt;img onerror=&quot;x&quot;&gt;&amp;&#39;a&#39;');
});

test('④ #phoneHome·시트 영역은 data-key 를 가로채지 않고 refreshFoldUi·broadcastLogout 에 연결된다', () => {
  const pmStart = E.indexOf('var PM_CORE_MAX');
  const pmModule = stripJs(E.slice(pmStart, E.indexOf('// ── 로그아웃 ──', pmStart)));
  assert.ok(pmModule.length > 500, '폰 홈 모듈을 찾지 못했습니다');
  assert.ok(!/setAttribute\(\s*['"]data-key['"]|data-key=/.test(pmModule), '폰 홈에 data-key 가 있으면 알림 딱지가 원본 타일을 못 찾습니다');
  assert.match(pmModule, /origTile\(/, '원본 타일(#appRows)과 단일 진실 공급원으로 연결되어야 합니다');
  assert.match(cutFn(E, 'function refreshFoldUi('), /pmRender\(\)/, 'refreshFoldUi 에서 pmRender 를 부르지 않습니다');
  assert.match(cutFn(E, 'function broadcastLogout('), /pmResetOnLogout\(\)/, 'broadcastLogout 에서 pmResetOnLogout 를 부르지 않습니다');
  assert.match(cutFn(E, 'function pmClickAlert('), /pmCloseSheet\(/, '알림 딱지를 누를 때 열린 바텀시트를 닫아야 알림 창이 시트 뒤에 가려지지 않습니다');
  [
    'function 뉴스레터경고달기(',
    'function portalHanaRemoveBadge(',
    'function portalHanaPaintBadge(',
    'function portalMrSyncPins(',
    'function portalOrchSyncPins(',
  ].forEach((fnSig) => {
    assert.match(cutFn(E, fnSig), /pmRender\(\)/, fnSig + ' 에서 비동기 알림 변화 후 pmRender 를 부르지 않습니다');
  });
});

test('⑤ pmToggleCore 는 지금 보이지 않는(권한 외) 저장 키 때문에 8개 상한에 막히지 않고 숨은 키를 보존한다', () => {
  const c = buildPmBox({
    pu_phone_core_v1__: JSON.stringify(['erp', 'cards', 'mail', 'photos', 'consult', 'pbox', 'payroll', 'career']),
  });
  c.__hiddenKeys = { career: 1 };
  assert.strictEqual(c.pmToggleCore('harass'), true, '숨겨진 키(career)를 제외한 보이는 핵심 앱은 7개이므로 8번째 앱이 추가되어야 합니다');
  const saved = JSON.parse(c.__store.pu_phone_core_v1__);
  assert.ok(saved.includes('harass') && saved.includes('career'), '추가된 harass 와 숨겨진 키 career 가 함께 보존되어야 합니다');
});

test('⑥ 폴더·편집 바텀시트는 닫힌(hidden=true) 상태에서 처음 열 때도 본문이 비지 않고 즉시 렌더링된다', () => {
  const wireFn = stripJs(cutFn(E, 'function pmWire('));
  assert.doesNotMatch(wireFn, /pmRenderFolderSheet\(\);\s*pmOpenSheet\(/, 'hidden 해제 전에 폴더 시트 렌더를 먼저 부르면 첫 열기가 빈 화면이 됩니다');
  assert.doesNotMatch(wireFn, /pmRenderEditSheet\(\);\s*pmOpenSheet\(/, 'hidden 해제 전에 편집 시트 렌더를 먼저 부르면 첫 열기가 빈 화면이 됩니다');

  const els = {
    pmFolderSheet: { hidden: true, querySelector: () => null },
    pmEditSheet: { hidden: true, querySelector: () => null },
    pmAllFilterBar: { hidden: true, querySelectorAll: () => [] },
    pmFolderTitle: { textContent: '' },
    pmFolderBody: { innerHTML: '' },
    pmEditTitle: { textContent: '' },
    pmEditBody: { innerHTML: '' },
  };
  const src = [
    sliceVar(E, 'var APPS = [', '\n  ];'),
    sliceVar(E, 'var APP_ROWS = [', '\n  ];'),
    sliceVar(E, 'var ROW_MOVED_FROM =', ';'),
    E.match(/var PM_CORE_MAX\s*=[^\n]+/)[0],
    E.match(/var PM_DEFAULT_CORE\s*=[^\n]+/)[0],
    E.match(/var PM_DEFAULT_RECENT\s*=[^\n]+/)[0],
    sliceVar(E, 'var PM_FOLDERS = [', '\n  ];'),
    sliceVar(E, 'var PM_FOLDER_MAP = {', '\n  };'),
    E.match(/var PM_PC_MAIN\s*=[^\n]+/)[0],
    'var _pmState = { folderId: "f_gov", filter: "all", lastFocus: null, lastMeta: null, toastTimer: 0 };',
    cutFn(E, 'function rowExists('),
    cutFn(E, 'function appRowOf('),
    cutFn(E, 'function pmEsc('),
    cutFn(E, 'function pmKnownApp('),
    cutFn(E, 'function pmFolderOf('),
    cutFn(E, 'function pmReadList('),
    cutFn(E, 'function pmVisibleApps('),
    cutFn(E, 'function pmVisMap('),
    cutFn(E, 'function pmCoreSplit('),
    cutFn(E, 'function pmIconHtml('),
    cutFn(E, 'function pmGrid3Html('),
    cutFn(E, 'function pmRenderFolderSheet('),
    cutFn(E, 'function pmRenderEditSheet('),
    cutFn(E, 'function pmOpenSheet('),
  ].join('\n');
  const ctx = {
    $: (id) => els[id] || null,
    localStorage: { getItem: () => null, setItem: () => {} },
    origTile: () => ({ style: { display: '' } }),
    tileShown: () => true,
    pmCoreKey: () => 'pu_phone_core_v1__',
    pmTileFlags: () => ({ dim: false, disabled: false, tag: '', title: '', alertEl: null, alertText: '' }),
    pmCaptureMeta: () => null,
    pmRestoreFocusIn: () => {},
    pmSyncInert: () => {},
    document: { activeElement: null },
    requestAnimationFrame: () => {},
    Array, Object, JSON, String, Number, Boolean,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);

  ctx.pmOpenSheet('pmFolderSheet', '.pm-close');
  assert.strictEqual(els.pmFolderSheet.hidden, false, '폴더 시트가 열려야 합니다');
  assert.ok(els.pmFolderBody.innerHTML.includes('pm-grid-3'), '첫 열기 직후 폴더 시트 본문이 비어 있지 않아야 합니다');

  ctx.pmOpenSheet('pmEditSheet', 'input[data-pm-edit]');
  assert.strictEqual(els.pmEditSheet.hidden, false, '편집 시트가 열려야 합니다');
  assert.ok(els.pmEditBody.innerHTML.includes('data-pm-edit='), '첫 열기 직후 편집 시트 체크박스 목록이 비어 있지 않아야 합니다');
});
