'use strict';
/* 정부컨설팅 일정관리 — 폰 정리 (대표 지시 2026-10-05
   「폰화면에 정부컨설팅일정 너무정리가 안된다 깔끔하게 불필요한부분은 정리하고 볼수 있게」 → 목업 「이대로 고쳐라」)

   지키는 것
   ① PC 는 그대로 — 폰 전용 줄(.m-only)은 넓은 화면에서 안 보이고, 바꾸는 규칙은 768px 이하에만 산다
   ② ⋯ 줄은 원래 단추를 «눌러 준다» — 같은 일을 두 벌 만들지 않는다
   ③ 달력을 덮던 떠 있는 것(백업·복구·새로보기·🏠·즐겨찾기 손잡이)은 폰에서 숨기고, ⋯ 안에 같은 길이 있다
   ④ 사업장 목록은 아래 판 — 창(.mb, z 500)보다 아래에 깔린다(안 그러면 판이 창을 덮는다)
   ⑤ 폰에서는 판이 접힌 채 시작한다 — 펼친 채 저장돼 있어도 달력이 가려지지 않게
   ⑥ 손잡이에 «마감·주의» 수가 붙는다 — 접어 두어도 급한 곳은 보인다
   ⑦ 연도 칸을 숨긴 대신 「2026년 10월」 글자를 누르면 연도 고르개가 열린다 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripJs } = require('./strip-comments.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
const CSS = SRC.slice(0, SRC.indexOf('</style>'));
const MARK = '폰 정리 (대표 지시 2026-10-05';

/* 폰 정리 덩이: 표시 뒤 첫 «.m-only…{display:none}» 줄과 그다음 @media 블록 */
function phoneBlock() {
  const at = CSS.indexOf(MARK);
  assert.ok(at > 0, '폰 정리 덩이를 찾지 못했습니다');
  const mq = CSS.indexOf('@media (max-width:768px){', at);
  assert.ok(mq > 0, '폰 정리 덩이가 768px 이하 매체 질의 안에 있지 않습니다');
  let d = 0, i = CSS.indexOf('{', mq);
  for (; i < CSS.length; i++) { if (CSS[i] === '{') d++; else if (CSS[i] === '}') { d--; if (!d) break; } }
  /* ⚠ 주석을 걷는다 — 머리말 주석에 「.m-only 는 넓은 화면에서 안 보이고」가 있어,
       규칙을 지워도 주석 글자에 걸려 검사가 초록이었다(돌연변이로 확인) */
  const bare = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
  /* 표시는 주석 «안»에 있다 — 주석 머리(/*)부터 잘라야 주석째 걷힌다 */
  const top = CSS.lastIndexOf('/*', at);
  return { head: bare(CSS.slice(top, mq)), body: bare(CSS.slice(mq, i + 1)) };
}
function cut(name) {
  const at = SRC.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 이 없습니다');
  let d = 0;
  for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
    if (SRC[i] === '{') d++; else if (SRC[i] === '}') { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error(name);
}

test('① PC 는 그대로 — 폰 전용 줄은 넓은 화면에서 숨고, 바꾸는 규칙은 768px 이하에만', () => {
  const B = phoneBlock();
  assert.match(B.head, /\.m-only[^{]*\{display:none;\}/, '폰 전용 줄이 PC 에서도 보입니다');
  assert.match(B.body, /\.m-only\{display:initial;\}/);
  assert.match(B.body, /#hdrLogout,#statsBtn,#fbStatus\{display:none!important;\}/);
  /* 덩이 밖(넓은 화면 규칙)에서 로그아웃·통계를 숨기면 PC 머리줄이 깨진다 */
  assert.ok(!/#hdrLogout[^{]*\{display:none/.test(B.head), 'PC 에서 로그아웃을 숨겼습니다');
});

test('② ⋯ 줄은 원래 단추를 눌러 준다', () => {
  const clicked = [];
  const els = {};
  ['statsBtn', 'dashSettingsBtn', 'pu-backup-admin-button', 'pu-version-fab'].forEach((id) => { els[id] = { click() { clicked.push(id); } }; });
  const calls = [];
  const ctx = {
    document: { getElementById: (id) => els[id] || null },
    q: () => ({ classList: { remove() {} } }),
    toast: (m) => calls.push('toast:' + m), openPwChange: () => calls.push('pw'), doLogout: () => calls.push('logout'),
    location: { href: '', reload: () => calls.push('reload') }, sessionStorage: { setItem() {} }, window: {},
    PuAppBar: { open: (el) => calls.push('fav:' + (el && el.n)) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(cut('mMenu'), ctx);
  ['stats', 'settings', 'backup', 'version'].forEach((k) => ctx.mMenu(k));
  assert.equal(clicked.join(','), 'statsBtn,dashSettingsBtn,pu-backup-admin-button,pu-version-fab');
  ctx.mMenu('pw'); ctx.mMenu('logout'); ctx.mMenu('fav', { n: 'me' });
  assert.equal(calls.join(','), 'pw,logout,fav:me');
  ctx.mMenu('portal');
  assert.match(ctx.location.href, /^enter\.html\?v=\d+$/, '🏠 포털로 — 떠 있던 🏠 와 같은 곳으로 가야 합니다');
  delete els['pu-backup-admin-button'];
  ctx.mMenu('backup');
  assert.ok(calls.some((c) => /^toast:/.test(c)), '백업 단추가 없는 사람(관리자 아님)에게는 말해 줘야 합니다');
});

test('③ 떠 있던 것은 폰에서 숨고, ⋯ 안에 같은 길이 있다', () => {
  const B = phoneBlock().body;
  ['#pu-backup-admin-button', '#pu-version-fab', '#mHomeFab', '[data-pu-appbar-tab]'].forEach((sel) => {
    assert.ok(B.includes(sel), sel + ' 이 폰에서 숨지 않습니다');
  });
  ['backup', 'version', 'portal', 'fav', 'stats', 'settings', 'pw', 'logout'].forEach((k) => {
    assert.ok(SRC.includes("mMenu('" + k + "'"), '⋯ 안에 「' + k + '」 줄이 없습니다 — 숨긴 것을 꺼낼 길이 없습니다');
  });
  assert.match(SRC, /b\.id='mHomeFab';/, '떠 있는 🏠 에 이름이 없으면 숨길 수가 없습니다');
});

test('④ 사업장 판은 창(.mb)보다 아래에 깔린다', () => {
  const mb = CSS.match(/\.mb\{[^}]*z-index:(\d+)/);
  assert.ok(mb, '.mb 의 z-index 를 찾지 못했습니다');
  const B = phoneBlock().body;
  const dash = B.match(/\.dash\{position:fixed;[^}]*z-index:(\d+)/);
  assert.ok(dash, '폰에서 사업장 목록이 아래 판이 아닙니다');
  assert.ok(Number(dash[1]) < Number(mb[1]), '판(' + dash[1] + ')이 창(' + mb[1] + ')을 덮습니다');
  const dim = B.match(/#dashMDim\{[^}]*z-index:(\d+)/);
  assert.ok(dim && Number(dim[1]) < Number(dash[1]), '어두운 막이 판 위에 올라앉습니다');
});

test('⑤·⑥ 폰에서는 접힌 채 시작하고, 손잡이에 마감·주의 수', () => {
  const js = stripJs(SRC);
  assert.match(js, /localStorage\.getItem\('p_dashMCollapsed'\)==='1'\|\|window\.innerWidth<=768\)/, '폰에서 판이 펼친 채로 열립니다');
  assert.match(SRC, /id="dashMRisk"/);
  assert.match(js, /activeItems\.filter\(x=>x\.risk&&x\.risk\.isRisk\)\.length/, '손잡이 딱지가 마감·주의 수를 안 셉니다');
  assert.match(phoneBlock().body, /\.dash-m-risk:empty\{display:none!important;\}/, '0곳일 때 빈 딱지 테두리가 남습니다');
});

test('⑦ 연도는 「2026년 10월」 글자를 눌러 고른다', () => {
  const B = phoneBlock().body;
  assert.match(B, /#calControls \.year-wrap\{display:none!important;\}/);
  assert.match(SRC, /class="year-wrap"/);
  const nav = stripJs(cut('bindCalNav'));
  assert.match(nav, /ct\.onclick=/, '연도 칸을 숨겼는데 고를 길이 없습니다');
  assert.match(nav, /ys\.showPicker\(\)/);
});
