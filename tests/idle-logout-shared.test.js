'use strict';
/* 60분 자동 로그아웃이 «일하는 중에» 걸리지 않는다 (대표 지시 2026-09-30
   「화면에서 잠시 나갔다 들어오거나 화면이 로그아웃된것처럼 이 화면이 자꾸 나오고 앱으로 넘어간다.
    이유가 뭔지 검토하고 해결해라」)

   뿌리 둘:
   ㉠ 「마지막으로 움직인 때」(pu_last_active)를 다섯 앱만 적었다 — 캘린더·사진첩 등에서 한 시간 일해도
      뒤에 열린 포털·이알피가 «60분 동안 아무것도 안 했다» 며 전체 로그아웃을 걸었다.
   ㉡ 자동 로그아웃이 로그아웃을 «시작만 하고» 0.2초 뒤 포털로 떠났다 — 덜 끝난 채 포털이 열리면
      남은 로그인을 보고 다시 들여보냈다.

   못 박는 것(규칙 — 앱 «개수»·이름을 박지 않는다. 앱 목록은 공용 상단바의 APPS 에서 읽는다):
   ① 로그인이 필요한 앱은 모두 움직임을 적는다(공용 부품 pu-active.js 이든 제 코드이든)
   ② 공용 부품은 적되, 이미 시간이 다 된 시계는 되살리지 않는다(공용 PC) — 「로그인 유지」 기기는 예외
   ③ 자동 로그아웃은 로그아웃이 끝난 뒤에 떠난다 — 안 끝나도 영영 멎지는 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');

/* 포털에 걸린 앱 — 공용 상단바의 APPS 가 원본이다 */
function appPages() {
  const bar = read('js/pu-appbar.js');
  const urls = [...bar.matchAll(/url:\s*'([a-z0-9-]+\.html)/g)].map((m) => m[1]);
  return [...new Set(urls)].filter((f) => fs.existsSync(path.join(R, f)));
}

test('① ★★ 로그인이 필요한 앱은 모두 «움직였다» 를 적는다', () => {
  const pages = appPages();
  assert.ok(pages.length >= 10, '앱 목록을 못 읽었습니다(' + pages.length + ') — 검사가 헛돕니다');
  const miss = pages.filter((f) => {
    const s = stripJs(read(f));
    return !/<script src="js\/pu-active\.js\?v=\d+"><\/script>/.test(s) && !/localStorage\.setItem\(\s*AKEY/.test(s);
  });
  assert.deepEqual(miss, [], '★★ 이 앱에서 일해도 «안 움직였다» 로 쳐서 60분 뒤 전체 로그아웃이 걸립니다: ' + miss.join(', '));
});

function 부품상자(저장, cfg) {
  const 들은 = {};
  const g = {
    Date, parseInt, String,
    localStorage: { getItem: (k) => (k in 저장 ? 저장[k] : null), setItem: (k, v) => { 저장[k] = String(v); } },
    addEventListener: (ev, fn) => { 들은[ev] = fn; },
    PU_CFG: cfg || null
  };
  g.window = g; g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(read('js/pu-active.js'), g);
  return { g, 들은, 저장 };
}

test('② ★★ 공용 부품 — 움직이면 적고, 5초 안에 또 오면 건너뛴다', () => {
  const now = Date.now();
  const { g, 들은, 저장 } = 부품상자({ pu_last_active: String(now - 60 * 1000) });
  assert.ok(들은.pointerdown && 들은.keydown, '누르기·치기를 안 듣습니다');
  들은.pointerdown();
  assert.ok(Number(저장.pu_last_active) >= now, '★★ 움직였는데 안 적었습니다');
  저장.pu_last_active = String(now - 1000);        // 적은 값을 바꿔 두고 곧바로 또 움직인다
  들은.keydown();
  assert.equal(저장.pu_last_active, String(now - 1000), '5초 안에 또 적었습니다 — 저장이 무겁습니다');
});

test('② ★★ 이미 시간이 다 된 시계는 되살리지 않는다 — 자리를 비운 PC 를 지나가던 사람이 살리면 안 된다', () => {
  const 옛 = String(Date.now() - 61 * 60 * 1000);
  const a = 부품상자({ pu_last_active: 옛 });
  a.들은.pointerdown();
  assert.equal(a.저장.pu_last_active, 옛, '★★ 60분이 지난 시계를 되살렸습니다 — 자동 로그아웃이 영영 안 걸립니다');
  // 「로그인 유지」 를 켠 기기는 떠나 있는 동안 원래 멈추므로 적는다
  const b = 부품상자({ pu_last_active: 옛, pu_portal_auto: '1' });
  b.들은.pointerdown();
  assert.notEqual(b.저장.pu_last_active, 옛, '「로그인 유지」 기기에서 돌아와 움직였는데 안 적었습니다');
  // 포털 설정의 시간을 따른다(10~480분)
  const c = 부품상자({ pu_last_active: String(Date.now() - 20 * 60 * 1000) }, { idleMinutes: '15' });
  assert.equal(c.g.PuActive._limitMs(), 15 * 60 * 1000, '포털 설정의 자동 로그아웃 시간을 안 따릅니다');
});

/* 자동 로그아웃을 떼어 내 돌린다 — signOut 이 «늦게» 끝나는 세상 */
function 로그아웃세상(file) {
  const src = stripJs(read(file));
  const fn = cutFn(src, 'function doAutoLogout(');
  assert.ok(fn, file + ' 에서 doAutoLogout 를 못 찾았습니다');
  let 끝내기 = null; const 간곳 = []; const 시계 = [];
  const ctx = {
    now: () => 1, saveBeforeLogout() {},
    firebase: { auth: () => ({ currentUser: { email: 'p001@pureun.kr' }, signOut: () => new Promise((r) => { 끝내기 = r; }) }) },
    sessionStorage: { removeItem() {} }, localStorage: { removeItem() {} },
    document: { createElement: () => ({ style: {} }), body: { appendChild() {} } },
    location: { pathname: '/x.html', replace: (u) => 간곳.push(u), reload: () => 간곳.push('reload') },
    setTimeout: (f, ms) => { 시계.push({ f, ms }); return 시계.length; }
  };
  vm.createContext(ctx);
  vm.runInContext(fn + '\ndoAutoLogout();', ctx);
  return { ctx, 간곳, 시계, 끝: () => 끝내기 && 끝내기() };
}

test('③ ★★ 자동 로그아웃은 로그아웃이 «끝난 뒤에» 포털로 간다', async () => {
  for (const file of ['pu-erp.html', 'gov-consulting.html', 'pu-cards.html', 'rules.html']) {
    const w = 로그아웃세상(file);
    // 3초 안전장치를 뺀 짧은 시계만 돌려 본다 — signOut 이 안 끝났으면 떠나면 안 된다
    w.시계.filter((t) => t.ms < 3000).forEach((t) => t.f());
    assert.deepEqual(w.간곳, [], '★★ ' + file + ' 가 로그아웃이 끝나기 전에 포털로 떠납니다 — 포털이 다시 들여보냅니다');
    w.끝(); await new Promise((r) => setImmediate(r));
    w.시계.filter((t) => t.ms <= 200).forEach((t) => t.f());
    assert.equal(w.간곳.length, 1, file + ' 가 로그아웃이 끝났는데 안 떠납니다');
    assert.match(w.간곳[0], /^enter\.html\?v=/, file + ' 가 포털로 안 갑니다');
    // 안 끝나도 3초 안전장치가 있다
    const 멎음 = 로그아웃세상(file);
    const 안전 = 멎음.시계.find((t) => t.ms >= 3000);
    assert.ok(안전, '★ ' + file + ' 는 로그아웃이 영영 안 끝나면 화면이 멎습니다');
  }
});
