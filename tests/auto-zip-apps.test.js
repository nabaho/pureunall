'use strict';
/* 📮 우편번호 저절로 넣기 — 이알피 밖의 앱들 (대표 지시 2026-10-17 「우편번호찾기 기능있는데 자동으로 니가 찾아서 항상 입력해라」)
   이알피(pu-erp.html)는 tests/erp-auto-zip.test.js 가 본다. 여기는 문자열로 화면을 그리는 앱 — 기금·경력관리 —
   과 그 둘이 함께 쓰는 js/pu-zip.js 를 본다.

   ★ 이 검사가 못 박는 것은 «규칙»이다:
     ① 우편번호 칸(다음 위젯의 zonecode 를 받는 칸)이 있는 화면은 저절로 넣기도 단다 —
        새 앱·새 칸이 생겨도 빠지면 여기서 걸린다. (기업정보함은 지금 우편번호 칸이 없다 — 생기면 걸린다.)
     ② 넣기 직전에 «그때 주소가 지금도 같은가·우편번호가 아직 비었나·칸이 아직 있나» 다시 본다.
     ③ 서버로는 주소 글자(q·key·alt)만 가고 로그인 증표를 붙인다 · 같은 주소는 한 번만 · 그물 실패는 안 굳힌다.
     ④ 경력관리는 «우편번호 한 칸»만 저장한다 — 저장된 주소가 같고 저장된 우편번호가 빌 때만.
        폼 전체 저장·다시 그리기를 하면 치던 칸이 담기거나 날아간다.
     ⑤ 기금은 칸에 채우기만 한다(저장은 사람의 [저장]) · 기계가 넣은 값이라 출처를 «사람»으로 남기지 않는다.
   주소·우편번호는 지어낸 것이다(저장소가 공개다). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\r\n').join('\n');
const FUND = stripJs(read('fund.html'));
const KC = stripJs(read('kcareer.html'));
const ZIP_SRC = read('js/pu-zip.js');
const PuAddr = require('../js/pu-addr.js');

/* 그 자리를 품은 «맨 바깥 함수» 이름 (줄 첫머리의 function/async function) */
function ownerFn(src, at) {
  const re = /\n(?:async )?function ([A-Za-z_$][\w$]*)\(/g;
  let m, name = '';
  while ((m = re.exec(src)) && m.index < at) name = m[1];
  return name;
}
function allAt(src, needle) {
  const out = [];
  let at = -1;
  while ((at = src.indexOf(needle, at + 1)) >= 0) out.push(at);
  return out;
}

/* ── ① 우편번호 칸이 있는 화면은 저절로 넣기도 단다 ── */

test('①★ 다음 우편번호(zonecode)를 받는 앱은 모두 저절로 넣기를 단다 — 새 앱이 생겨도', () => {
  const tops = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  const takers = tops.filter((f) => /\bzonecode\b/.test(stripJs(read(f))));
  assert.ok(takers.length >= 3, '우편번호를 받는 화면을 못 찾았다 — 검사가 헛돈다: ' + takers.join(', '));
  const missing = takers.filter((f) => {
    const s = stripJs(read(f));
    return !/\bPuZip\.bind\(/.test(s) && !/\n[ \t]+useAutoZip\(/.test(s);   // 이알피는 훅(useAutoZip), 나머지는 PuZip.bind
  });
  assert.deepEqual(missing, [], '★ 우편번호 찾기는 있는데 저절로 넣기가 없는 앱: ' + missing.join(', '));
});

test('①★ 기업정보함 — 지금은 우편번호 칸이 없다 · 생기면 저절로 넣기도 함께', () => {
  const S = stripJs(read('pu-cards.html'));
  const hasZipField = /\bzonecode\b|placeholder="우편번호"|data-k="zip/.test(S);
  if (hasZipField) assert.match(S, /\bPuZip\.bind\(/, '★ 기업정보함에 우편번호 칸이 생겼는데 저절로 넣기가 없다');
});

test('①★ 기금 — 우편번호 칸은 _addrStack 한 곳에서만 그리고, 그것을 부르는 화면마다 fundAutoZip(같은 앞말)', () => {
  const owners = new Set(allAt(FUND, 'placeholder="우편번호"').map((at) => ownerFn(FUND, at)));
  assert.deepEqual([...owners], ['_addrStack'], '★ _addrStack 밖에서 우편번호 칸을 그린다 — 거기도 fundAutoZip 을 달아야 한다');
  const prefixes = [...FUND.matchAll(/_addrStack\('([\w-]+)'/g)].map((m) => m[1]);
  assert.ok(prefixes.length >= 2, '소재지 칸(_addrStack) 부르는 자리를 못 찾았다 — 검사가 헛돈다');
  const missing = prefixes.filter((p) => FUND.indexOf("fundAutoZip('" + p + "')") < 0);
  assert.deepEqual(missing, [], '★ 소재지 칸은 있는데 저절로 넣기를 안 단 화면(앞말): ' + missing.join(', '));
  const fn = cutFn(FUND, 'function fundAutoZip(prefix)');
  assert.match(fn, /PuZip\.bind\(\$\(prefix\+'address'\),/, '★ 그 화면의 소재지 칸에 달지 않는다');
  assert.match(fn, /\$\(prefix\+'zipcode'\)/, '★ 그 화면의 우편번호 칸에 넣지 않는다');
});

test('①★ 경력관리 — 「📮 찾기」 단추를 그리는 화면은 같은 자리에서 저절로 넣기를 단다', () => {
  const owners = new Set();
  for (const at of allAt(KC, 'ZipFind(')) {
    const tail = KC.slice(Math.max(0, at - 40), at);
    if (/onclick="[\w$]*$/.test(tail)) owners.add(ownerFn(KC, at));   // 단추의 onclick 만 센다(정의·부르는 자리는 빼고)
  }
  assert.ok(owners.size >= 2, '우편번호 찾기 단추를 못 찾았다 — 검사가 헛돈다: ' + [...owners].join(', '));
  const missing = [...owners].filter((n) => !/\b\w+AutoZip\(\)/.test(cutFn(KC, 'function ' + n + '(')));
  assert.deepEqual(missing, [], '★ 📮 찾기 단추만 있고 저절로 넣기가 없는 화면: ' + missing.join(', '));
  for (const n of ['piAutoZip', 'firmAutoZip'])
    assert.match(cutFn(KC, 'function ' + n + '('), /PuZip\.bind\(/, '★ ' + n + ' 가 칸에 달지 않는다');
});

test('① 두 앱이 js/pu-zip.js 를 캐시 번호와 함께 싣는다 (찾을 말을 만드는 pu-addr.js 도)', () => {
  for (const f of ['fund.html', 'kcareer.html']) {
    const S = read(f);
    assert.match(S, /<script src="js\/pu-zip\.js\?v=\d+"><\/script>/, '★ ' + f + ' 가 js/pu-zip.js 를 안 싣는다');
    assert.match(S, /<script src="js\/pu-addr\.js\?v=\d+"><\/script>/, '★ ' + f + ' 가 js/pu-addr.js 를 안 싣는다');
  }
});

/* ── js/pu-zip.js 를 상자에서 돌린다 ── */

function timers() {
  let n = 0;
  const q = new Map();
  return {
    setTimeout(fn) { q.set(++n, fn); return n; },
    clearTimeout(id) { q.delete(id); },
    run() { const fs2 = [...q.values()]; q.clear(); fs2.forEach((f) => f()); },
  };
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
const okRes = (zip) => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, zip }) });
const user = { getIdToken: () => Promise.resolve('시험증표') };

function load({ fetch, signedIn = true }) {
  const T = timers();
  const win = { PuAddr, firebase: { auth: () => ({ currentUser: signedIn ? user : null }) } };
  const sb = { window: win, fetch, setTimeout: T.setTimeout, clearTimeout: T.clearTimeout,
    console: { warn() {}, log() {} }, JSON, Promise, String, Object };
  vm.runInNewContext(ZIP_SRC, sb);
  assert.ok(win.PuZip, 'PuZip 이 창에 안 붙었다');
  return { Z: win.PuZip, T };
}
function input(value) {
  return { value, isConnected: true, on: {},
    addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); },
    fire(t) { (this.on[t] || []).forEach((f) => f()); } };
}
const ADDR = '충남 가나시 다라읍 마바1길 27 (2층)';

test('③★ 서버로는 주소 글자(q·key·alt)만 가고, 로그인 증표를 붙인다', async () => {
  let sent = null, headers = null, url = '';
  const { Z } = load({ fetch: (u, opt) => { url = u; sent = JSON.parse(opt.body); headers = opt.headers; return okRes('12345'); } });
  assert.equal(await Z.lookup(ADDR), '12345');
  assert.match(url, /\/zipLookup$/, '이미 배포된 zipLookup 이 아닌 곳을 부른다');
  assert.equal(JSON.stringify(Object.keys(sent).sort()), JSON.stringify(['alt', 'key', 'q']));
  assert.equal(sent.key, '마바1길 27');
  assert.equal(headers.Authorization, 'Bearer 시험증표');
});

test('③-2 다섯 자리가 아니거나 ok 가 아니면 빈 값 · 로그인 전이면 묻지도 않는다', async () => {
  const bad = (j) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(j) });
  assert.equal(await load({ fetch: bad({ ok: true, zip: '123' }) }).Z.lookup(ADDR), '');
  assert.equal(await load({ fetch: bad({ ok: false, zip: '12345' }) }).Z.lookup(ADDR), '');
  let asked = 0;
  const { Z } = load({ fetch: () => { asked++; return okRes('12345'); }, signedIn: false });
  assert.equal(await Z.lookup(ADDR), '');
  assert.equal(asked, 0, '로그인 전인데 서버를 불렀다');
});

test('③★ 같은 주소는 한 번만 묻고, 그물 실패는 «없음»으로 굳히지 않고 다시 묻는다', async () => {
  let asked = 0, fail = true;
  const { Z } = load({ fetch: () => { asked++; return fail ? Promise.reject(new Error('그물')) : okRes('12345'); } });
  assert.equal(await Z.lookup(ADDR), '');
  fail = false;
  assert.equal(await Z.lookup(ADDR), '12345', '★ 그물 실패를 굳혔다 — 다시 안 묻는다');
  await Z.lookup(ADDR);
  assert.equal(asked, 2, '같은 주소를 또 물었다 — 화면을 그릴 때마다 카카오 한도를 쓴다');
});

test('②★ 빈 우편번호를 채우고, 그 뒤에 앱이 할 일(done)을 «넣은 우편번호·그때 주소»로 부른다', async () => {
  const { Z, T } = load({ fetch: () => okRes('12345') });
  const a = input(ADDR), z = input('');
  const got = [];
  Z.bind(a, z, (zip, addr) => got.push([zip, addr]));
  T.run(); await flush();
  assert.equal(z.value, '12345');
  assert.equal(JSON.stringify(got), JSON.stringify([['12345', ADDR.trim()]]));
  assert.equal(a.value, ADDR, '★ 주소 칸을 고쳤다 — 우편번호만 넣어야 한다');
});

test('②★ 기다리는 사이 주소를 고쳤거나·우편번호를 적었거나·칸이 사라졌으면 그대로 둔다', async () => {
  for (const meddle of [
    (a) => { a.value = '충남 가나시 마바2길 3'; },
    (a, z) => { z.value = '54321'; },
    (a, z) => { z.isConnected = false; },
  ]) {
    let release;
    const { Z, T } = load({ fetch: () => new Promise((r) => { release = () => r({ ok: true, json: () => Promise.resolve({ ok: true, zip: '12345' }) }); }) });
    const a = input(ADDR), z = input('');
    let done = 0;
    Z.bind(a, z, () => done++);
    T.run(); await flush();
    meddle(a, z);
    release(); await flush();
    assert.notEqual(z.value, '12345', '★ 그사이 바뀐 것을 덮고 옛 주소의 우편번호를 넣었다: ' + meddle);
    assert.equal(done, 0, '★ 안 넣었는데 저장·알림(done)을 불렀다');
  }
});

test('② 우편번호가 이미 있으면 묻지 않고 · 주소를 나중에 적으면 그때 찾는다', async () => {
  let asked = 0;
  const { Z, T } = load({ fetch: () => { asked++; return okRes('12345'); } });
  Z.bind(input(ADDR), input('99999'), () => {});
  T.run(); await flush();
  assert.equal(asked, 0, '★ 적힌 우편번호가 있는데 서버를 불렀다');
  const a = input(''), z = input('');
  Z.bind(a, z, () => {});
  T.run(); await flush();
  assert.equal(asked, 0);
  a.value = ADDR; a.fire('input');
  T.run(); await flush();
  assert.equal(z.value, '12345', '★ 주소를 적은 뒤에 찾지 않는다');
});

/* ── ④ 경력관리 — 우편번호 한 칸만 저장 ── */

function kcBox(fnName, extra) {
  const sb = Object.assign({ String, Object, JSON, Date, console: { warn() {} }, toast() {} }, extra);
  sb.window = sb;
  sb.PuZip = { bind: (aEl, zEl, done) => { sb._binds.push({ aEl, zEl, done }); } };
  sb._binds = [];
  const head = fnName === 'piAutoZip' ? (KC.match(/const PI_ZIP_OF=\{[^}]*\};/) || [''])[0] : '';
  assert.ok(fnName !== 'piAutoZip' || head, 'PI_ZIP_OF 줄을 못 찾았다');
  vm.runInNewContext(head + '\n' + cutFn(KC, 'function ' + fnName + '(') + '\nthis.' + fnName + '=' + fnName + ';', sb);
  sb[fnName]();
  return sb;
}

test('④★ 기본정보 — 저장된 주소가 같고 우편번호가 빌 때만, «우편번호 한 칸»만 저장한다', () => {
  const run = (stored, addrKey, zip, addr) => {
    const sets = [];
    const sb = kcBox('piAutoZip', {
      document: { getElementById: (id) => ({ id }) },
      piObj: () => JSON.parse(JSON.stringify(stored)),
      set: (k, o) => { sets.push([k, JSON.stringify(o)]); },
    });
    const b = sb._binds.find((x) => x.aEl.id === 'pi-' + addrKey);
    assert.ok(b, '★ ' + addrKey + ' 주소 줄에 달지 않았다');
    b.done(zip, addr);
    return sets;
  };
  const stored = { name: '가나다', addrHome: '가나시 마바1길 27', zipHome: '', addr: '가나시 사아로 5', zipWork: '' };
  let s = run(stored, 'addrHome', '12345', '가나시 마바1길 27');
  assert.equal(s.length, 1);
  assert.equal(s[0][0], 'profile_info');
  assert.equal(s[0][1], JSON.stringify(Object.assign({}, stored, { zipHome: '12345' })), '★ 우편번호 말고 다른 칸까지 바꿔 저장했다');
  s = run(stored, 'addr', '23456', '가나시 사아로 5');
  assert.equal(s[0][1], JSON.stringify(Object.assign({}, stored, { zipWork: '23456' })), '★ 사무실 주소의 우편번호가 제자리에 안 갔다');
  assert.equal(run(stored, 'addrHome', '12345', '가나시 마바9길 1').length, 0,
    '★ 아직 저장 안 한 주소로 찾은 우편번호를 «저장된 옛 주소»에 붙여 저장했다');
  assert.equal(run(Object.assign({}, stored, { zipHome: '99999' }), 'addrHome', '12345', '가나시 마바1길 27').length, 0,
    '★ 저장된 우편번호를 덮었다');
});

test('④★ 법인정보 — 이알피가 준 주소(읽기 전용 칸)로도 찾고, 여기 적는 자리에 우편번호 한 칸만 담는다', () => {
  const run = ({ local, erpAddr, a, lsOk = true }) => {
    const ls = [], sched = [];
    const ro = { k: 'ro' }, zipEl = { k: 'zip' };
    const sb = kcBox('firmAutoZip', {
      document: { getElementById: (id) => id === 'firmGrid' ? { querySelector: (sel) =>
        sel === 'input[data-firm="zip"]' ? zipEl : sel === 'input[data-firm-ro="addr"]' ? ro : null } : null },
      firmLocal: () => JSON.parse(JSON.stringify(local)),
      firmInfo: () => ({ addr: erpAddr || local.addr || '' }),
      LS: { set: (k, v) => { ls.push([k, v]); return lsOk; } },
      NS: 'kc_', FIRM_LOCAL: 'firm_local',
      fbScheduleAuto: (k) => sched.push(k),
    });
    assert.equal(sb._binds.length, 1);
    assert.equal(sb._binds[0].aEl, ro, '★ 이알피 주소(읽기 전용 칸)로 찾지 않는다');
    assert.equal(sb._binds[0].zEl, zipEl);
    sb._binds[0].done('12345', a);
    return { ls, sched };
  };
  const local = { tel: '000-0000', savedAt: 1 };
  let r = run({ local, erpAddr: '가나시 마바1길 27', a: '가나시 마바1길 27' });
  assert.equal(r.ls.length, 1);
  assert.equal(r.ls[0][0], 'kc_firm_local');
  const saved = JSON.parse(r.ls[0][1]);
  assert.equal(saved.zip, '12345');
  assert.equal(saved.tel, '000-0000', '★ 여기 적어 둔 다른 칸을 잃었다');
  assert.deepEqual(r.sched, ['firm_local'], '★ 클라우드로 올릴 것 표시를 안 했다 — 이 기기에만 남는다');
  assert.equal(run({ local: { zip: '99999' }, erpAddr: '가나시 마바1길 27', a: '가나시 마바1길 27' }).ls.length, 0, '★ 적힌 우편번호를 덮었다');
  assert.equal(run({ local, erpAddr: '가나시 마바1길 27', a: '가나시 마바9길 1' }).ls.length, 0, '★ 다른 주소로 찾은 것을 저장했다');
  r = run({ local, erpAddr: '가나시 마바1길 27', a: '가나시 마바1길 27', lsOk: false });
  assert.equal(r.sched.length, 0, '★ 이 기기에 못 담았는데 클라우드로 올리라고 했다');
});

test('④ 저절로 넣기가 찾는 칸을 화면이 실제로 그린다 — 이름이 어긋나면 조용히 아무것도 안 한다', () => {
  const pi = cutFn(KC, 'function renderPersonal(');
  assert.ok(pi.includes('id="pi-${zk}"') && pi.includes('id="pi-${k}"'), '★ 기본정보의 주소·우편번호 칸 이름이 piAutoZip 이 찾는 것(pi-주소키·pi-우편키)과 다르다');
  const sel = cutFn(KC, 'function firmAutoZip(').match(/input\[(data-[\w-]+)="addr"\]'\)\s*\|\|\s*[\w.]+\.querySelector\('input\[(data-[\w-]+)="addr"\]/);
  assert.ok(sel, 'firmAutoZip 의 주소 칸 찾기를 못 읽었다');
  const firm = cutFn(KC, 'function renderFirmTab(');
  for (const attr of [sel[1], sel[2]])
    assert.ok(firm.includes(attr + '="\'+k+\'"'), '★ 법인정보 화면이 ' + attr + ' 를 안 단다 — 이알피가 준 주소로 못 찾는다');
});

test('④★ 경력관리 저절로 넣기는 폼 전체를 저장하거나 다시 그리지 않는다 — 치던 칸이 담기거나 날아간다', () => {
  for (const n of ['piAutoZip', 'firmAutoZip'])
    assert.doesNotMatch(cutFn(KC, 'function ' + n + '('), /\b(savePersonalInfo|firmTabSave|renderPersonal|renderFirmTab)\(/,
      '★ ' + n + ' 가 폼 전체 저장·다시 그리기를 부른다');
});

/* ── ⑤ 기금 — 칸에 채우기만, 출처는 기계 ── */

test('⑤★ 기금은 칸에 채우기만 한다 — 저장·「저장 안 한 변경」 표시는 사람이 [저장]을 누를 때', () => {
  const fn = cutFn(FUND, 'function fundAutoZip(prefix)');
  assert.doesNotMatch(fn, /\b(saveInfo|saveSite|markDirty)\(|fbDb|\.(update|set|push|transaction)\(/,
    '★ 우편번호 찾기가 저장하거나 변경 표시를 한다 — 열어 보기만 해도 서버에 쓰거나 나갈 때 경고가 뜬다');
});

test('⑤★ 기금 — 기계가 넣은 우편번호에 출처를 달고, 그 출처가 사람이 읽는 말로 보인다', () => {
  const fn = cutFn(FUND, 'function fundAutoZip(prefix)');
  const m = fn.match(/_provMark\(\s*[\w$]+\s*,\s*'([^']+)'/);
  assert.ok(m, '★ 출처 표시(_provMark)를 안 한다 — 그대로 저장하면 «사람이 씀»으로 남는다');
  const src = m[1];
  const sb = {};
  vm.runInNewContext((FUND.match(/var PV_SRC=\{[^}]*\};/) || [''])[0] + '\n' + cutFn(FUND, 'function _provSrcLabel(src)')
    + '\n' + cutFn(FUND, 'function _rvSrcLabel(src)') + '\nthis.a=_provSrcLabel;this.b=_rvSrcLabel;', sb);
  assert.notEqual(sb.a(src), src, '★ 칸 딱지에 출처가 날글자(' + src + ')로 보인다');
  assert.notEqual(sb.b(src), src, '★ 확인함에 출처가 날글자(' + src + ')로 보인다');
});
