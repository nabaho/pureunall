const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');

function loadWindowManager(open) {
  const start = source.indexOf('var portalAppWindows = Object.create(null);');
  const end = source.indexOf('  function renderPortal', start);
  assert.ok(start >= 0 && end > start, '창 관리자 코드가 있어야 합니다.');
  const context = {
    URL,
    /* ⚠ URLSearchParams 도 넣어 준다 — portalAppUrlKey 가 쓴다(2026-09-08).
       빠뜨리면 브라우저에서는 멀쩡한데 여기서만 견주기가 죽어(try/catch 가 삼킨다)
       「늘 다른 화면」으로 읽혀, 이 아래 두 검사가 «고장이 아닌데» 빨개진다. */
    URLSearchParams,
    location: { href: 'https://nabaho.github.io/pureunall/enter.html' },
    window: { open },
    alert() {},
  };
  vm.runInNewContext(source.slice(start, end), context);
  return context;
}

function appWindow(initialHref = 'about:blank') {
  const state = { navigations: 0, focuses: 0 };
  const ref = {
    closed: false,
    location: {
      href: initialHref,
      replace(url) {
        state.navigations += 1;
        this.href = new URL(url, 'https://nabaho.github.io/pureunall/enter.html').href;
      },
    },
    focus() { state.focuses += 1; },
  };
  return { ref, state };
}

test('모든 포털 프로그램은 프로그램 키 기반의 고정 창 이름을 사용한다', () => {
  assert.match(source, /function portalAppWindowName\(key\)/);
  assert.match(source, /return 'pureun-' \+ String\(key \|\| ''\)/);
  assert.match(source, /a\.target = portalAppWindowName\(app\.key\)/);
});

test('포털을 새로고침한 뒤에도 이름으로 기존 프로그램 창을 복구한다', () => {
  assert.match(source, /window\.open\('', winName\)/);
  assert.equal(source.includes('window.open(url, winName)'), false);
  assert.match(source, /portalAppWindows\[app\.key\] = ref/);
});

test('이미 열린 같은 프로그램은 주소를 다시 넣지 않고 포커스만 이동한다', () => {
  const functionStart = source.indexOf('function openPortalApp(app, url)');
  const functionEnd = source.indexOf('  function renderPortal', functionStart);
  assert.ok(functionStart >= 0 && functionEnd > functionStart, '창 관리자 함수가 있어야 합니다.');
  const body = source.slice(functionStart, functionEnd);

  assert.match(body, /if\(ref && !ref\.closed\)/);
  assert.match(body, /if\(!portalAppUrlMatches\(ref, url\)\) navigatePortalApp\(ref, url\)/);
  assert.match(body, /ref\.focus\(\);\s*return ref/);
});

test('팝업 차단 시 사용자가 원인을 알 수 있다', () => {
  assert.match(source, /팝업이 차단되어 프로그램을 열 수 없습니다/);
});

test('같은 포털에서 기금관리를 두 번 눌러도 창은 한 번만 만들고 재로딩하지 않는다', () => {
  const fund = appWindow();
  let opens = 0;
  const context = loadWindowManager(() => {
    opens += 1;
    return fund.ref;
  });
  const app = { key: 'fund' };
  const url = 'fund.html?sso=1&v=1';

  context.openPortalApp(app, url);
  context.openPortalApp(app, url);

  assert.equal(opens, 1);
  assert.equal(fund.state.navigations, 1);
  assert.equal(fund.state.focuses, 2);
});

test('포털을 새로고침해도 이미 열린 기금관리 창을 이름으로 찾아 포커스만 이동한다', () => {
  const fund = appWindow('https://nabaho.github.io/pureunall/fund.html?sso=1&v=1');
  const names = [];
  const context = loadWindowManager((url, name) => {
    names.push({ url, name });
    return fund.ref;
  });

  context.openPortalApp({ key: 'fund' }, 'fund.html?sso=1&v=2');

  assert.deepEqual(names, [{ url: '', name: 'pureun-fund' }]);
  assert.equal(fund.state.navigations, 0);
  assert.equal(fund.state.focuses, 1);
});

/* 취업규칙은 한 앱·두 화면 파일 — 타일은 rules-v2.html(🏢 사업장)이지만, 그 창이 지금
   rules.html(✏️ 검토·개정, 작업 중)에 가 있으면 «같은 앱»이다. replace 하면 하던 화면을 잃는다. */
test('★ 취업규칙 창이 rules.html(개정 작업 중)이어도 타일(rules-v2.html)은 포커스만 — 화면을 갈아엎지 않는다', () => {
  const rules = appWindow('https://nabaho.github.io/pureunall/rules.html?v=3#open=abc');
  const context = loadWindowManager(() => rules.ref);
  context.openPortalApp({ key: 'rules' }, 'rules-v2.html?sso=1&v=9');
  assert.equal(rules.state.navigations, 0, '★★ 개정 작업 중인 rules.html 창을 사업장 화면으로 갈아엎었다');
  assert.equal(rules.state.focuses, 1);
});

test('같은 앱 식구 견주기는 취업규칙 둘뿐 — 다른 앱·다른 폴더·다른 파일은 그대로 «다른 화면»', () => {
  const base = 'https://nabaho.github.io/pureunall/';
  const ctx = loadWindowManager(() => null);
  const same = (cur, url) => ctx.portalAppUrlMatches({ location: { href: cur } }, url);
  assert.equal(same(base + 'rules-v2.html#sites', 'rules-v2.html?sso=1&v=1'), true);
  assert.equal(same(base + 'rules.html', 'rules-v2.html?sso=1&v=1'), true);
  assert.equal(same(base + 'rules-v2.html', 'rules.html?sso=1&v=1'), true);
  // 다른 앱은 영향 없음 — 기금관리 창에 취업규칙 타일을 눌러도 «같은 화면» 이 아니다
  assert.equal(same(base + 'fund.html', 'rules-v2.html?sso=1&v=1'), false);
  assert.equal(same(base + 'pu-cards.html', 'pu-photos.html'), false);
  // 다른 폴더의 같은 이름은 같은 앱이 아니다
  assert.equal(same('https://nabaho.github.io/other/rules.html', 'rules-v2.html'), false);
  // Object.prototype 이름이 식구로 읽히면 안 된다(hasOwnProperty)
  assert.equal(same(base + 'constructor', 'rules-v2.html'), false);
  assert.equal(same(base + 'constructor', base + 'constructor'), true);
});
