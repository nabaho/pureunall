'use strict';
/* ERP 가 «옛 주소·새 주소 양쪽에서» 똑같이 도는가 — 2026-11-15 대표 지시 「모두 옮겨달라」(주소 이사 1단계)
   ═══════════════════════════════════════════════════════════════════════════
   옛: https://nabaho.github.io/pureunall/…   새: https://erp.pureunlabor.co.kr/… (앞머리 /pureunall 없음)
   GitHub 에서 도메인을 켜는 «순간» 옛 주소는 301 로 새 주소로 넘어간다 — 두 주소가 함께 서 있는 날이 없다.
   그래서 화면은 «미리» 양쪽에서 돌아야 한다. 이 검사가 못 박는 규칙:
     ① 화면이 /pureunall/… 절대경로로 부르지 않는다(새 주소에서 404) — 상대주소로
     ② 앱 설치 정보(manifest)의 scope 가 절대경로가 아니다
     ③ 알림 워커는 «지금 출처의 앱 뿌리»에 맞춰 연다 — 새 주소에서는 서버가 보낸 옛 꼴 앞머리를 뗀다
     ④ 404 쪽은 새 주소로 들어온 옛 꼴(/pureunall/…)을 앞머리 떼고 넘긴다 — 옛 주소에서는 안 넘긴다
     ⑤ 뿌리 주소(index.html)는 포털 입구로 넘긴다(쿼리·해시 유지)
     ⑥ 배포가 .well-known(플레이스토어 앱 주소 확인)을 실제로 싣는다
     ⑦ 도구(리멤버 확장·폰 미러)가 새 주소도 받는다
   ⚠ 새 주소 이름(erp.pureunlabor.co.kr)은 대표가 정한 «규칙 값»이다 — 검사고정-허용 (주소 자체가 규칙)
   실행: node --test tests/erp-dual-origin.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const NEW_HOST = 'erp.pureunlabor.co.kr'; // 검사고정-허용 — 대표가 정한 새 주소(주소 자체가 규칙)
const 주석빼기 = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

/* ══ ① 절대경로 ══ */
test('① 뿌리의 화면들이 /pureunall/… 절대경로로 부르지 않는다 — 새 주소에서는 404 가 된다', () => {
  const 화면 = fs.readdirSync(R).filter((f) => /\.html$/.test(f));
  assert.ok(화면.length >= 20, '화면을 못 읽었다 — 검사가 아무것도 안 지킨다');
  const 걸림 = [];
  const 꼴 = [
    /\b(?:href|src|action)\s*=\s*["']\/pureunall\//g,
    /serviceWorker\.register\(\s*["']\/pureunall\//g,
    /location\.(?:href\s*=|replace\(|assign\()\s*["']\/pureunall\//g,
  ];
  화면.forEach((f) => {
    const s = 주석빼기(read(f));
    꼴.forEach((re) => { const m = s.match(re); if (m) 걸림.push(f + ' → ' + m[0]); });
  });
  assert.deepEqual(걸림, [], '★★ /pureunall/ 절대경로가 남았다 (상대주소로 바꿀 것): ' + 걸림.slice(0, 5).join(' · '));
});

/* ══ ② manifest ══ */
test('② 앱 설치 정보의 scope 는 상대주소다 — /pureunall/ 로 박으면 새 주소에서 앱 범위가 틀어진다', () => {
  const 목록 = fs.readdirSync(R).filter((f) => /manifest.*\.json$/.test(f));
  assert.ok(목록.length >= 5, 'manifest 를 못 읽었다');
  목록.forEach((f) => {
    const m = JSON.parse(read(f));
    if (m.scope !== undefined) assert.ok(!/^\//.test(m.scope), '★★ ' + f + ' 의 scope 가 절대경로다: ' + m.scope);
    if (m.start_url !== undefined) assert.ok(!/^\/pureunall\//.test(m.start_url), '★★ ' + f + ' 의 start_url 이 옛 절대경로다');
  });
});

/* ══ ③ 알림 워커 ══ */
function 워커(origin, swPath) {
  const 띄운것 = [];
  const 귀 = {};
  const ctx = {
    importScripts() {}, URL, String,
    firebase: { initializeApp() {}, messaging: () => ({ onBackgroundMessage(fn) { 귀.bg = fn; } }) },
    self: {
      location: { origin, pathname: swPath },
      addEventListener: (n, fn) => { 귀[n] = fn; },
      registration: { showNotification: (t, o) => 띄운것.push(o) },
      clients: { matchAll: async () => [], openWindow: async () => {} },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(read('firebase-messaging-sw.js'), ctx);
  return { ctx, 귀, 띄운것 };
}

test('③ 알림 워커 — 새 주소에서는 서버가 보낸 옛 꼴(/pureunall/…)을 앞머리 떼고 열고, 아이콘도 뿌리에서 찾는다', () => {
  const w = 워커('https://' + NEW_HOST, '/firebase-messaging-sw.js');
  w.귀.bg({ data: { title: 't', url: '/pureunall/pu-cards.html?view=mail' } });
  const o = w.띄운것[0];
  assert.ok(o, '알림을 못 띄웠다');
  assert.equal(o.data.url, 'https://' + NEW_HOST + '/pu-cards.html?view=mail', '★★ 새 주소에서 알림을 누르면 404 로 간다');
  assert.ok(!/\/pureunall\//.test(o.icon) && !/\/pureunall\//.test(o.badge), '★★ 새 주소에서 알림 아이콘이 404 다: ' + o.icon + ' ' + o.badge);
  assert.ok(o.icon.charAt(0) === '/' && o.badge.charAt(0) === '/', '아이콘 길이 뿌리 기준이 아니다');
});

test('③ 알림 워커 — 옛 주소에서는 지금처럼 /pureunall/ 안쪽으로 연다', () => {
  const w = 워커('https://nabaho.github.io', '/pureunall/firebase-messaging-sw.js');
  w.귀.bg({ data: { url: '/pureunall/pu-erp.html?x=1' } });
  const o = w.띄운것[0];
  assert.equal(o.data.url, 'https://nabaho.github.io/pureunall/pu-erp.html?x=1');
  assert.ok(/^\/pureunall\//.test(o.icon) && /^\/pureunall\//.test(o.badge), '옛 주소에서 아이콘 길이 틀렸다');
});

/* ══ ④ 404 ══ */
function 첫스크립트(html) {
  const m = /<script>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(m, '스크립트를 못 찾았다');
  return m[1];
}
function 사사(html, host, pathname, search, hash) {
  let 간곳 = null;
  const ctx = { location: { hostname: host, pathname, search: search || '', hash: hash || '', replace: (u) => { 간곳 = u; } } };
  vm.createContext(ctx);
  vm.runInContext(첫스크립트(html), ctx);
  return 간곳;
}

test('④ 404 — 새 주소로 들어온 옛 꼴 주소는 앞머리를 떼고 넘긴다(쿼리·해시 유지)', () => {
  const h = read('404.html');
  assert.equal(사사(h, NEW_HOST, '/pureunall/sign-contract.html', '?t=abc', '#k=xyz'), '/sign-contract.html?t=abc#k=xyz',
    '★★ 고객에게 이미 보낸 서명 링크(옛 꼴)가 새 주소에서 막힌다');
  assert.equal(사사(h, NEW_HOST, '/pureunall'), '/');
  assert.equal(사사(h, NEW_HOST, '/pureunall/'), '/');
});

test('④ 404 — «//» 로 시작하게 되는 주소는 다른 집으로 못 가게 뿌리로', () => {
  const h = read('404.html');
  assert.equal(사사(h, NEW_HOST, '/pureunall//evil.example/x'), '/', '★★ 프로토콜 없는 바깥 주소(//evil)로 넘긴다');
});

test('④ 404 — 옛 주소에서는 아무 데도 넘기지 않는다(옛 주소 동작 그대로)', () => {
  const h = read('404.html');
  assert.equal(사사(h, 'nabaho.github.io', '/pureunall/없는쪽.html'), null);
  assert.equal(사사(h, NEW_HOST, '/없는쪽.html'), null, '새 주소의 진짜 없는 쪽은 안내만 한다');
});

/* ══ ⑤ 뿌리 주소 ══ */
test('⑤ 뿌리 주소(index.html)는 포털 입구로 넘긴다 — 쿼리·해시 유지', () => {
  const h = read('index.html');
  assert.equal(사사(h, NEW_HOST, '/', '?sg=1', '#x'), 'enter.html?sg=1#x');
  assert.match(h, /<meta name="robots" content="noindex/, '넘기기 쪽이 검색에 실리면 안 된다');
});

/* ══ ⑥ 배포 ══ */
test('⑥ 배포가 숨은 폴더(.well-known)를 실제로 싣고, 없으면 멈춘다', () => {
  const wf = read('.github/workflows/deploy-pages.yml');
  const 올리기 = wf.slice(wf.indexOf('upload-pages-artifact'));
  assert.match(올리기.slice(0, 600), /include-hidden-files:\s*true/,
    '★★ upload-pages-artifact 는 점(.)으로 시작하는 것을 기본으로 뺀다 — assetlinks.json 이 404 가 된다');
  const 필수 = /for keep in ([\s\S]*?); do/.exec(wf);
  assert.ok(필수 && /\.well-known\/assetlinks\.json/.test(필수[1]), '★ 필수 파일 확인에 assetlinks.json 이 없다');
  assert.ok(필수 && /\bindex\.html\b/.test(필수[1]) && /\b404\.html\b/.test(필수[1]), '★ 필수 파일 확인에 index.html·404.html 이 없다');
  assert.ok(fs.existsSync(path.join(R, '.well-known', 'assetlinks.json')), '저장소에 assetlinks.json 이 없다');
});

/* ══ ⑦ 도구 ══ */
test('⑦ 리멤버 확장 — 받는 화면을 새 주소에서도 잇는다', () => {
  const man = JSON.parse(read('tools/remember-ext/manifest.json'));
  const 받는화면 = man.content_scripts.find((c) => c.js.includes('intake-relay.js'));
  assert.ok(받는화면.matches.some((u) => u.indexOf('https://' + NEW_HOST + '/remember-intake.html') === 0), '★★ 새 주소의 받는 화면에 다리가 안 깔린다');
  assert.ok(받는화면.matches.some((u) => /nabaho\.github\.io\/pureunall\/remember-intake/.test(u)), '옛 주소를 벌써 뺐다(이사 전까지 필요)');
  assert.ok(man.host_permissions.some((u) => u.indexOf('https://' + NEW_HOST + '/remember-intake.html') === 0), '★ 새 주소 권한이 없다');
  const bg = read('tools/remember-ext/bg.js');
  assert.match(bg, /findOrOpen\(INTAKE_ANY,/, '★ 이미 열린 새 주소 탭을 못 찾고 하나 더 연다');
});

test('⑦ 폰 미러 — 새 주소 화면도 잰다, 흉내 낸 주소는 안 잰다', () => {
  const M = require('../tools/phone-mirror.js');
  assert.equal(M.허용주소('https://' + NEW_HOST + '/pu-erp.html?sso=1'), true, '★ 새 주소 화면을 못 잰다');
  assert.equal(M.허용주소('https://' + NEW_HOST + '.evil.com/'), false, '이름을 흉내 낸 주소');
  assert.equal(M.허용주소('http://' + NEW_HOST + '/'), false, 'https 가 아니다');
});
