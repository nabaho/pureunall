'use strict';
/* 푸른 메일 — 폰 화면 (폰화면관리 2026-10-18 · 대표 지시 「폰화면관리」)
   실행: node --test tests/mail-phone-screens.test.js

   폰 폭(360·411)에서 가짜 로그인으로 실제로 그려 재 보니(tools/phone-audit) 이랬다.
   ① 메일 문(?view=mail)이 「읽고 있습니다…」에서 «영영» 멈췄다 — 오류 「openMailBox is not defined」.
      로그인 답이 페이지(2.7MB)를 다 읽기 «전»에 와서, 맨 아래 덩어리의 함수를 아직 못 만났다.
      먼저 「한 번 했다」 표를 세운 뒤 터져서, 명함이 다 와 다시 불러도 그냥 지나갔다.
   ② 기업정보함의 주황 ＋(명함 촬영)가 메일 «쓰기» ✏️ 를 정확히 덮어, ✏️ 를 누르면 카메라가 열렸다.
   ③ ☑ 고르기 칸이 줄 너비만큼 늘어 보낸이 이름 한가운데 떠 있었다(#mmBody input{width:100%}).
      쓰기 창의 「한명씩 발송」도 같은 까닭으로 한 글자씩 세로로 쌓였다.
   ④ 읽기·쓰기·보낸·수신기록 화면은 PC 의 «흰 종이» 차림을 그대로 그리는데 폰 바탕이 검정이라
      메일 제목·본문이 검은 글씨로 묻혀 «안 보였다».
   ⑤ 읽기 화면 단추가 네 줄로 접혀 제목이 화면 3분의 1 아래에서 시작했다.
   ⑥ 서랍의 「📎 자료함」을 누르면 폰에서는 «명함 목록»이 떴다(폰 render 에 'mat' 갈래가 없었다).

   ⚠ px 값이 아니라 «규칙»을 본다 — 몇 px 로 적든, 선택자를 어떻게 묶든 통과한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const fn = (name) => sliceFn(app, 'function ' + name + '(');
const css = app.slice(app.indexOf('<style>'), app.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 폰 구간(@media max-width ≤ 760px) 안의 글만 모은다 */
function phoneCss() {
  const out = [];
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let d = 1, i = re.lastIndex;
    for (; i < css.length && d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    if (Number(m[1]) <= 760) out.push(css.slice(re.lastIndex, i - 1));
  }
  return out.join('\n');
}
/* 「선택자{…}」 덩이 가운데 선택자 목록에 want(정규식)에 맞는 것이 하나라도 있는 것 */
function rules(src, want) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const sels = m[1].split(',').map((s) => s.trim());
    if (sels.some((s) => want.test(s))) out.push({ sel: m[1].trim(), body: m[2].replace(/\s+/g, '') });
  }
  return out;
}
/* 빛깔이 어두운가 (#rgb / #rrggbb) */
function dark(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 0.5;
}

/* ── ① 페이지를 다 읽기 전에 불려도 메일함이 열린다 ── */
function boot(readyState) {
  const opened = [];
  const listeners = {};
  const ctx = {
    JSON, Object, String, URLSearchParams,
    myUid: 'uid-A', myEmail: '',
    location: { search: '?view=mail' },
    state: { view: 'mail', tab: 'card', mailSent: 'box' },
    _compose: null,
    localStorage: { getItem: () => null, setItem: () => {} },
    document: {
      readyState,
      addEventListener: (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); },
    },
    openMailBox: (id) => opened.push('box:' + (id || '')),
    openMailPage: () => opened.push('write'),
    mailComposeOpen: () => opened.push('compose'),
    openCoThread: () => opened.push('co'), openWhoPage: () => opened.push('who'),
    openMnewPage: () => opened.push('mnew'), openMatPage: () => opened.push('mat'),
    switchTab: (t) => opened.push('tab:' + t), openCoMobile: () => opened.push('co-m'),
    setTimeout: () => 0,
  };
  vm.createContext(ctx);
  vm.runInContext("var _lastScreenSig = ''; var _lastScreenDone = false;", ctx);
  vm.runInContext(app.match(/const LASTV_PREFIX = [^\n]*/)[0].replace(/^const /, 'var '), ctx);
  vm.runInContext("var MAIL_WHO_TABS = ['succ','addr','end','notco'];", ctx);
  ['lastScreenKey', 'mailToFromUrl', 'mailCoFromUrl', 'mailWhoFromUrl', 'mailMnewFromUrl', 'urlWantsMail',
    'composeTouched', 'restoreLastScreen'].forEach((n) => vm.runInContext(fn(n), ctx));
  ctx.__fire = (ev) => (listeners[ev] || []).splice(0).forEach((cb) => cb());
  ctx.__opened = opened;
  return ctx;
}

test('★★ ① 페이지를 다 읽기 «전»에 불리면 기다렸다가, 다 읽은 뒤 메일함을 «한 번» 연다', () => {
  const c = boot('loading');
  c.restoreLastScreen();
  c.restoreLastScreen();              // 명함이 와서 또 불려도
  assert.deepEqual(Array.from(c.__opened), [],
    '★★ 맨 아래 덩어리(openMailBox)를 아직 못 읽었는데 열려고 합니다 — 폰에서 「openMailBox is not defined」로 멈춥니다');
  c.document.readyState = 'interactive';
  c.__fire('DOMContentLoaded');
  assert.equal(c.__opened.filter((x) => x.indexOf('box:') === 0).length, 1,
    '★★ 다 읽은 뒤에 메일함이 «한 번» 열려야 합니다: ' + JSON.stringify(c.__opened));
  c.restoreLastScreen();
  assert.equal(c.__opened.length, 1, '한 번 연 뒤에는 다시 열지 않습니다');
});

test('① 다 읽은 뒤라면 예전 그대로 «바로» 연다 — 늦어지는 것이 없다', () => {
  const c = boot('complete');
  c.restoreLastScreen();
  assert.equal(c.__opened.length, 1, '다 읽은 뒤인데 기다립니다');
});

test('① 포털 배지(?cnt=1)로 건너온 연락처 정리도 다 읽은 뒤에 연다 — try 가 「없다」를 삼키지 않게', () => {
  const at = app.indexOf('cntFromUrl()){');
  assert.ok(at > 0, '포털 배지로 건너오는 자리를 못 찾았습니다');
  const seg = app.slice(at, app.indexOf('PuRulesHistory', at));
  assert.match(seg, /openCntPage/, '연락처 정리를 여는 자리가 사라졌습니다');
  assert.match(seg, /readyState/, '★ 페이지를 다 읽었는지 안 봅니다 — 다 읽기 전이면 조용히 안 열립니다');
  assert.match(seg, /DOMContentLoaded/, '★ 다 읽은 뒤에 다시 여는 길이 없습니다');
});

/* ── ② ✏️ 쓰기 단추를 덮지 않는다 ── */
test('★★ ② 메일 화면에서는 명함 촬영 ＋(#fab)를 접는다 — ✏️ 메일 쓰기를 덮는다', () => {
  const ph = phoneCss();
  for (const who of ['body', 'html']) {
    const r = rules(ph, new RegExp('^' + who + '\\.mailview\\s+#fab$')).filter((x) => /display:none/.test(x.body));
    assert.ok(r.length, '★★ ' + who + '.mailview 에서 #fab 을 접는 폰 규칙이 없습니다 — ✏️ 를 누르면 카메라가 열립니다');
  }
});

/* ── ③ 체크 칸은 제 크기 ── */
test('★★ ③ 메일 화면 몸통(#mmBody)의 체크 칸은 줄 너비로 늘지 않는다', () => {
  /* #mmBody input{width:100%} 이 있는 한, 그보다 «센» 선택자로 체크 칸의 너비를 되돌려야 한다 */
  const wide = rules(css, /^#mmBody\s+input$/).filter((x) => /width:100%/.test(x.body));
  const ph = phoneCss();
  const back = rules(ph, /^#mmBody\s+input\[type=["']?checkbox["']?\]$/).filter((x) => /(^|;)width:/.test(x.body) && !/width:100%/.test(x.body));
  if (wide.length) {
    assert.ok(back.length,
      '★★ #mmBody 의 체크 칸이 width:100% 를 받습니다 — ☑ 고르기 칸이 보낸이 이름 위에 뜨고 「한명씩 발송」이 세로로 쌓입니다');
  }
  const pick = rules(ph, /^#mmBody\s+input\.dmm-chk$/).filter((x) => /(^|;)width:/.test(x.body) && !/width:100%/.test(x.body));
  assert.ok(pick.length, '☑ 고르기 칸(.dmm-chk)이 제 너비를 잃었습니다');
});

/* ── ④ 메일함 밖 메일 화면은 PC 와 같은 종이 위에 ── */
test('★★ ④ 폰 메일 화면 몸통은 «밝은 종이 + 짙은 글씨» — PC 차림의 짙은 글씨가 검정 바탕에 묻히지 않게', () => {
  const ph = phoneCss();
  const bg = rules(ph, /mailview\s+#listwrap$/).map((x) => (x.body.match(/background:(#[0-9a-f]{3,6})/i) || [])[1]).filter(Boolean);
  assert.ok(bg.length, '★★ 메일 화면에 종이(밝은 바탕)를 까는 폰 규칙이 없습니다 — 메일 제목·본문이 안 보입니다');
  bg.forEach((c) => assert.ok(!dark(c), '★★ 메일 화면 바탕이 어둡습니다(' + c + ') — PC 차림의 짙은 글씨가 묻힙니다'));
  const ink = rules(ph, /mailview\s+#mmBody$/).map((x) => (x.body.match(/--ink:(#[0-9a-f]{3,6})/i) || [])[1]).filter(Boolean);
  assert.ok(ink.length, '메일 화면 몸통의 글씨 변수(--ink)를 종이에 맞게 돌리지 않았습니다 — 흰 글씨가 흰 종이에 묻힙니다');
  ink.forEach((c) => assert.ok(dark(c), '메일 화면 글씨 변수가 밝습니다(' + c + ') — 흰 종이 위에서 안 보입니다'));
});

test('④ 메일함 목록(.dmm)은 제 빛깔을 스스로 정한다 — 종이 규칙이 덮지 않는다', () => {
  const own = rules(css, /^\.dmm$/).filter((x) => /--ink:/.test(x.body) && /--bg:/.test(x.body));
  assert.ok(own.length, '★ .dmm 이 제 빛깔 변수를 잃었습니다 — 종이 규칙(--ink)이 다음 앱 차림 목록까지 바꿉니다');
});

/* ── ⑤ 읽기 화면 단추는 한 줄 ── */
test('★ ⑤ 폰 읽기 화면의 «이 메일에 하는 일» 단추는 한 줄로 두고 옆으로 민다', () => {
  const r = rules(phoneCss(), /\.dm-read\s+\.rtop\s+\.lft$/);
  assert.ok(r.some((x) => /flex-wrap:nowrap/.test(x.body)), '★ 단추가 여러 줄로 접혀 제목·본문이 화면 아래로 밀립니다');
  assert.ok(r.some((x) => /overflow-x:(auto|scroll)/.test(x.body)), '한 줄로 두었는데 옆으로 밀 수 없으면 뒤 단추를 못 누릅니다');
});

/* ── ⑥ 폰 자료함 ── */
function renderCtx(view) {
  const called = [];
  const cls = { toggle() {}, contains: () => false };
  const ctx = {
    _quiet: false, state: { view },
    document: { body: { classList: cls }, documentElement: { classList: cls } },
  };
  ['saveLastScreen', 'syncMobileTabs', 'syncMobileChrome', 'syncMobileTabCounts', 'renderMailMobile', 'renderMatMobile',
    'renderCoMobileList', 'renderWkMobile', 'renderCntPage', 'renderSubbar', 'renderSidebar', 'renderList']
    .forEach((n) => { ctx[n] = () => called.push(n); });
  vm.createContext(ctx);
  vm.runInContext(fn('render'), ctx);
  ctx.render();
  return called;
}

test('★★ ⑥ 폰에서 📎 자료함(view=mat)을 열면 자료함을 그린다 — 명함 목록으로 흐르지 않는다', () => {
  const called = renderCtx('mat');
  assert.ok(called.indexOf('renderMatMobile') >= 0, '★★ 폰에서 자료함을 그리지 않습니다: ' + called.join(','));
  assert.equal(called.indexOf('renderList'), -1, '★★ 자료함을 눌렀는데 명함 목록이 그려집니다');
});

test('⑥ 자료함 몸은 PC 와 한 벌 — 그릴 자리만 폰/PC 로 가른다', () => {
  assert.doesNotMatch(fn('renderMatPage').slice(0, 200), /\$\(\s*'pcMat'\s*\)/,
    '★ renderMatPage 가 PC 자리(#pcMat)만 봅니다 — 폰에서는 그릴 곳이 없습니다');
  const host = (pc) => {
    const ctx = {
      document: { body: { classList: { contains: (c) => c === 'pc' && pc } } },
      $: (id) => ({ id }),
    };
    vm.createContext(ctx);
    vm.runInContext(fn('matHost'), ctx);
    return ctx.matHost().id;
  };
  assert.equal(host(true), 'pcMat', 'PC 는 예전 자리(#pcMat)에 그려야 합니다');
  assert.notEqual(host(false), 'pcMat', '★ 폰인데 숨은 PC 자리에 그립니다 — 화면에 안 나옵니다');
});

test('⑥ 폰 자료함 화면에서는 명함 갈래 줄·거르개 줄·＋ 를 접는다', () => {
  const ph = phoneCss();
  for (const id of ['#tabs', '#subbar', '#fab']) {
    const r = rules(ph, new RegExp('^body\\.matview\\s+' + id + '$')).filter((x) => /display:none/.test(x.body));
    assert.ok(r.length, '폰 자료함에 ' + id + ' 가 남습니다');
  }
  assert.match(fn('render'), /classList\.toggle\(\s*'matview'/, '자료함 표(matview)를 붙였다 떼는 자리가 없습니다 — 나가도 갈래 줄이 안 돌아옵니다');
});
