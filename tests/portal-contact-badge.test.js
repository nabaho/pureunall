'use strict';
/* 포털 타일에 「📥 연락처 정리」 할 일 배지 (대표 결정 2026-10-04 「추천대로」)

   ■ 왜 — 그 화면은 기업정보함 옆줄에만 있어 «거기 들어가야만» 눈에 띄었다.
     포털 첫 화면에서 「정할 것이 남았다」를 알 길이 없었다.

   ■ 고른 것과 «까닭»
     · 기업정보함 타일에 단다 — 그 화면이 기업정보함 «창 안»에 산다(state.view='cnt').
       메일 타일에 달면 타일과 열리는 창이 어긋나고, 둘 다 달면 같은 일을 두 번 알린다.
     · 색은 호박 — 뉴스레터의 빨강은 «경고»이고 이것은 «할 일»이다. 같은 색이면 섞인다.
     · 직원에게도 보인다 — 옆줄의 그 칸이 이미 직원에게 보인다. 화면은 보이는데 배지만
       안 보이면 잣대가 두 벌이 된다.
     · 숫자는 기업정보함이 세어 적어 둔 것을 «한 번» 읽는다 — 포털이 메일함을 훑으면
       첫 화면이 그만큼 늦어진다.

   ■ 지키는 것
     ① 0 이면 «아예» 안 그린다 — 늘 켜진 등은 아무것도 못 알린다
     ② 있으면 수·말풍선·갈 길(?cnt=1)이 함께 붙는다
     ③ 기업정보함 타일이다 (메일 타일 아님)
     ④ 색이 경고(빨강)와 «다르다» — 자리·크기는 같다
     ⑤ 타일을 다 그린 «뒤»에 부른다
     ⑥ 기업정보함은 ?cnt=1 로 오면 그 화면을 연다
     ⑦ 숫자는 «바뀔 때만» 적는다 — 그릴 때마다 적으면 쓰기가 쏟아진다 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments.js');
const { sliceFn } = require('./fnslice.js');

const R = path.join(__dirname, '..');
const 포털원문 = fs.readFileSync(path.join(R, 'enter.html'), 'utf8');
const 포털 = stripComments(포털원문).replace(/\r\n/g, '\n');
const 명함원문 = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8');
const 명함 = stripComments(명함원문).replace(/\r\n/g, '\n');

/* 포털 쪽은 즉시 실행 함수 «안»에 두 칸 들여 있다 — 끝도 두 칸 들인 } 로 찾는다 */
const 배지정의 = (() => {
  const i = 포털.indexOf('function 연락처배지달기');
  assert.ok(i > 0, '연락처배지달기 를 못 찾았습니다');
  return 포털.slice(i, 포털.indexOf('\n  }\n', i) + 4);
})();

/* 진짜로 돌려 본다 — 가짜 타일과 가짜 실시간DB */
async function 돌려(값, o){
  const opt = o || {};
  const 붙은것 = [];
  const 칸 = { dataset: {}, title: '', href: opt.href || 'pu-cards.html?sso=1',
    querySelector: () => null, appendChild: (x) => 붙은것.push(x) };
  const 찾은열쇠 = [];
  const 짐 = {
    document: {
      querySelector: (sel) => { 찾은열쇠.push(sel); return opt.없는타일 ? null : 칸; },
      createElement: () => ({ className: '', textContent: '' }),
    },
    db: { ref: (p) => { 짐._읽은자리 = p; return { once: () => Promise.resolve({ val: () => 값 }) }; } },
    Number, String,
  };
  vm.createContext(짐);
  vm.runInContext(배지정의 + '\n연락처배지달기();', 짐);
  await new Promise((r) => setImmediate(r));
  return { 칸, 붙은것, 찾은열쇠, 읽은자리: 짐._읽은자리 };
}

test('★★★ 0 이면 «아예» 안 그린다 — 늘 켜진 등은 아무것도 못 알린다', async () => {
  for (const v of [{ n: 0 }, {}, null]) {
    const r = await 돌려(v);
    assert.equal(r.붙은것.length, 0, '★★★ 할 일이 없는데 배지를 달았습니다: ' + JSON.stringify(v));
    assert.equal(r.칸.href.indexOf('cnt='), -1, '갈 길까지 붙였습니다');
  }
});

test('★★★ 있으면 «수·말풍선·갈 길»이 함께 붙는다', async () => {
  const r = await 돌려({ n: 16 });
  assert.equal(r.붙은것.length, 1, '★★★ 할 일이 있는데 배지가 없습니다');
  assert.equal(r.붙은것[0].textContent, '16', '수가 틀립니다');
  assert.match(r.칸.title, /연락처 정리/, '무엇인지 말풍선이 말해 주지 않습니다');
  assert.match(r.칸.title, /16건/, '몇 건인지 말풍선에 없습니다');
  assert.match(r.칸.href, /cnt=1/, '★★★ 눌러도 그 화면으로 안 갑니다');
});

test('★★ 갈 길을 «두 번» 붙이지 않는다 — 다시 그려도 주소가 늘어나면 안 된다', async () => {
  const r = await 돌려({ n: 3 }, { href: 'pu-cards.html?sso=1&cnt=1' });
  assert.equal((r.칸.href.match(/cnt=1/g) || []).length, 1, '★★ 주소에 cnt=1 이 두 번입니다: ' + r.칸.href);
});

test('★★★ «기업정보함» 타일에 단다 — 메일 타일이 아니다', async () => {
  const r = await 돌려({ n: 2 });
  assert.ok(r.찾은열쇠.some(s => /data-key="cards"/.test(s)),
    '★★★ 기업정보함 타일을 안 찾습니다: ' + JSON.stringify(r.찾은열쇠));
  assert.ok(!r.찾은열쇠.some(s => /data-key="mail"/.test(s)),
    '★★ 메일 타일에 답니다 — 타일과 열리는 창이 어긋납니다');
});

test('★★ 숫자는 «기업정보함이 적어 둔 한 칸»만 읽는다 — 포털이 직접 세지 않는다', async () => {
  const r = await 돌려({ n: 1 });
  assert.equal(r.읽은자리, 'pucards/config/mailNewCount', '읽는 자리가 다릅니다: ' + r.읽은자리);
  /* 메일함을 훑는 흔적이 없어야 한다 — 첫 화면이 그만큼 늦어진다 */
  assert.ok(배지정의.indexOf('mailbox') < 0, '★★ 포털이 메일함을 읽습니다');
});

test('★★ 타일이 없으면 «조용히» 넘어간다 — 포털 첫 화면이 멎으면 안 된다', async () => {
  const r = await 돌려({ n: 5 }, { 없는타일: true });
  assert.equal(r.붙은것.length, 0);
});

test('★★ 색이 «경고와 다르다» — 자리·크기는 같다', () => {
  /* 자리·크기는 뉴스레터 경고를 그대로 쓴다(한 벌로 두면 둘이 어긋나지 않는다) */
  assert.match(배지정의, /nl-warn cn-todo/, '★★ 경고와 같은 자리·크기를 안 씁니다');
  const css = 포털.match(/\.tile \.nl-warn\.cn-todo\{[^}]*\}/);
  assert.ok(css, '★★ 할 일 배지의 색 규칙이 없습니다');
  assert.ok(css[0].indexOf('#dc2626') < 0,
    '★★ 할 일을 «경고 빨강»으로 칠했습니다 — 급한 것과 안 급한 것이 섞입니다');
  assert.match(css[0], /background:#d97706/, '팔레트 밖 색입니다 — 호박(#d97706)이어야 합니다');
});

test('★★ 타일을 다 그린 «뒤»에 부른다 — 먼저 부르면 붙일 타일이 없다', () => {
  assert.match(포털, /hideEmptyRows\(\);\s*뉴스레터경고달기\(\);\s*연락처배지달기\(\);/,
    '★★ 타일을 그리기 전에 부르거나, 아예 안 부릅니다');
});

/* ══════ 기업정보함 쪽 — ?cnt=1 로 오면 그 화면을 연다 ══════ */

/* 선언을 그대로 돌린 뒤 이름을 돌려받는다 — 괄호로 감싸면 «식»이 되어 이름이 안 생긴다 */
const cntFromUrl = vm.runInNewContext(sliceFn(명함원문, 'function cntFromUrl(') + '\ncntFromUrl');

test('★★★ ?cnt=1 을 알아본다 — 포털 배지가 이 길로 온다', () => {
  ['?cnt=1', '?sso=1&cnt=1', '?cnt=1&x=2'].forEach(s =>
    assert.equal(cntFromUrl(s), true, '못 알아봅니다: ' + s));
  ['', '?sso=1', '?cnt=0', '?cnt=11', '?xcnt=1', '?cnt=1x'].forEach(s =>
    assert.equal(cntFromUrl(s), false, '★ 아무 주소나 받습니다: ' + s));
});

test('★★★ 그 길로 오면 «연락처 정리»를 연다 — 메일 문일 때는 안 가로챈다', () => {
  const i = 명함.indexOf('cntFromUrl()');
  assert.ok(i > 0, '★★★ 주소를 읽어도 아무 일이 안 납니다 — 부르는 자리가 없습니다');
  const seg = 명함.slice(i - 200, i + 200);
  assert.match(seg, /openCntPage\(\)/, '★★★ 그 화면을 안 엽니다');
  assert.match(seg, /!urlWantsMail\(\)/,
    '★★ 메일 문으로 들어와도 가로챕니다 — 메일 문은 제 화면을 이미 정했습니다');
});

/* ══════ 숫자를 적는 쪽 — «바뀔 때만» ══════ */

function 적개(){
  const 쓴것 = [];
  const 짐 = {
    Date, Store: { mode: 'firebase' }, DB_ROOT: 'pucards',
    MNEW_CNT_DB: 'config/mailNewCount',
    mbAuthOk: () => true,
    firebase: { database: () => ({ ref: (p) => ({ set: (v) => { 쓴것.push({ p, v }); return Promise.resolve(); } }) }) },
    쓴것,
  };
  vm.createContext(짐);
  vm.runInContext('let _mnewCntPut = null;\n' + sliceFn(명함원문, 'function mnewCntStore('), 짐);
  return 짐;
}

test('★★★ 숫자는 «바뀔 때만» 적는다 — 그릴 때마다 적으면 쓰기가 쏟아진다', async () => {
  const c = 적개();
  c.mnewCntStore(16); c.mnewCntStore(16); c.mnewCntStore(16);
  await new Promise(r => setImmediate(r));
  assert.equal(c.쓴것.length, 1, '★★★ 같은 값을 ' + c.쓴것.length + '번 적었습니다');
  c.mnewCntStore(15);
  assert.equal(c.쓴것.length, 2, '★★ 값이 바뀌었는데 안 적었습니다');
  assert.equal(c.쓴것[0].p, 'pucards/config/mailNewCount', '적는 자리가 다릅니다');
  assert.equal(c.쓴것[1].v.n, 15);
  assert.ok(Number(c.쓴것[1].v.at) > 0, '언제 적었는지를 안 남깁니다');
});

test('★★ 로그인 전에는 «안 적는다» — 거절당한 0 이 굳으면 배지가 영영 안 뜬다', async () => {
  const c = 적개();
  c.mbAuthOk = () => false;
  c.mnewCntStore(7);
  assert.equal(c.쓴것.length, 0, '★★ 로그인도 안 됐는데 적었습니다');
  /* 로그인이 붙으면 그때 적는다 */
  c.mbAuthOk = () => true;
  c.mnewCntStore(7);
  assert.equal(c.쓴것.length, 1, '★★ 로그인 뒤에도 안 적습니다 — 한 번 막히면 영영 안 적습니다');
});

test('★ 못 적었으면 «다음에 다시» 해 본다 — 한 번 실패로 포기하면 안 된다', async () => {
  const c = 적개();
  let 터질까 = true;
  c.firebase = { database: () => ({ ref: () => ({
    set: () => 터질까 ? Promise.reject(new Error('막힘')) : (c.쓴것.push({ p:'ok' }), Promise.resolve()) }) }) };
  c.mnewCntStore(9);
  await new Promise(r => setImmediate(r));
  터질까 = false;
  c.mnewCntStore(9);
  await new Promise(r => setImmediate(r));
  assert.equal(c.쓴것.length, 1, '★ 실패한 값을 「적었다」로 치고 다시 안 해 봅니다');
});
