/* 직원 명부 — 공개 명부만 읽고, 휴직을 퇴사와 따로 본다 (대표 결정 2026-10-04 ㉮)

   ★ 알아낸 것
     ① 화면이 「주민번호·계좌는 읽지도 않습니다」라고 적고 있었는데, 코드는 인사 명부
        (data/user_accounts)를 «통째로» 먼저 읽었다. 이름·직급만 쓰면서도 관리자 PC 로
        주민번호·계좌·급여가 내려왔다 — 문구가 사실이 아니었다.
     ② 김석우 님이 «퇴사했는데» ERP 에는 휴직(leave)·퇴사일 없음으로 남아 있었다.
        화면은 retired 만 퇴사로 읽어 휴직을 «재직»으로 취급했고, 그래서 「구성원 넣기」
        목록에 그대로 올라왔다.

   ★ 이 검사가 지키는 것
     ⓐ 인사 명부(user_accounts)를 «코드로» 읽지 않는다 — 문구(주석)로는 통과 못 한다
     ⓑ 퇴사일을 도로 가져오지 않는다
     ⓒ 휴직은 퇴사가 «아니다» — 내릴 것으로 재촉하지 않는다
     ⓓ 휴직자는 넣을 수 없다 — 단추도, 함수도
     ⓔ 화면의 문구가 사실이다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(R, 'pu-home.html'), 'utf8');
const DIFF = fs.readFileSync(path.join(R, 'js', 'pu-home-diff.js'), 'utf8');
/* 주석을 걷는다 — 잘 쓴 주석이 검사를 통과시키면 아무것도 안 지킨다 */
const 알맹이 = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const H = 알맹이(RAW);

function fnSource(name) {
  const re = new RegExp('(?:^|\\n)(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(RAW);
  assert.ok(m, name + ' 를 화면에서 찾지 못했습니다');
  const start = m.index + (m[0][0] === '\n' ? 1 : 0);
  let mode = null, depth = 0;
  for (let i = RAW.indexOf('{', start); i < RAW.length; i++) {
    const c = RAW[i], n = RAW[i + 1];
    if (mode === '/*') { if (c === '*' && n === '/') { mode = null; i++; } continue; }
    if (mode === '//') { if (c === '\n') mode = null; continue; }
    if (mode) { if (c === '\\') { i++; continue; } if (c === mode) mode = null; continue; }
    if (c === '/' && n === '*') { mode = '/*'; i++; continue; }
    if (c === '/' && n === '/') { mode = '//'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { mode = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return RAW.slice(start, i + 1); }
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}
const 함수 = (n) => 알맹이(fnSource(n));
const constLine = (name) => {
  const m = new RegExp('\\nconst ' + name + ' = [^\\n]*;').exec(RAW);
  assert.ok(m, 'const ' + name + ' 을 찾지 못했습니다');
  return m[0].replace(/\nconst /, '\nvar ');
};

/* 부품(PuHomeDiff)을 진짜로 싣는다 */
function 부품() {
  const ctx = { window: undefined, console: { warn() {}, log() {} } };
  vm.createContext(ctx);
  vm.runInContext(DIFF, ctx);
  return ctx.PuHomeDiff;
}
const 밖으로 = (o) => JSON.parse(JSON.stringify(o));

/* ══════ ⓐ 인사 명부를 «코드로» 읽지 않는다 ══════ */
test('★★★ 인사 명부(user_accounts)를 코드로 읽지 않는다 — 주석을 걷고 본다', () => {
  assert.ok(H.indexOf('user_accounts') < 0,
    '★★★ pu-home.html 이 인사 명부를 코드에서 부릅니다 — 주민번호·계좌·급여가 관리자 PC 로 내려옵니다');
  /* 읽는 길(readRosterSource)은 공개 명부 하나다 */
  const s = 함수('readRosterSource');
  assert.match(s, /data\/user_dir/, '★ 공개 명부를 안 읽습니다');
  assert.ok(s.indexOf('accounts') < 0, '★★★ 읽는 길에 인사 명부가 남아 있습니다');
});

test('★★ 명부를 읽는 «모든» 길이 공개 명부로만 간다', () => {
  /* readRosterAt 를 부르는 자리를 전부 모아, 넘기는 경로가 user_dir 뿐인지 본다 */
  const 부름 = [...H.matchAll(/readRosterAt\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]);
  assert.ok(부름.length >= 1, '명부를 읽는 자리를 못 찾았습니다');
  부름.forEach(경로 => assert.equal(경로, 'data/user_dir',
    '★★ 공개 명부가 아닌 곳을 읽습니다: ' + 경로));
});

test('★★ 읽는 칸이 «개인정보»가 아니다 — 이름·직급·재직 상태뿐', () => {
  const s = 함수('staffFromRoster');
  ['rrn', 'accountNo', 'bankName', 'baseSalary', 'phone', 'address', 'birthDate', 'email', 'retireDate']
    .forEach(칸 => assert.ok(s.indexOf(칸) < 0, '★★ 명부의 «' + 칸 + '» 를 꺼냅니다'));
});

/* ══════ ⓑ 퇴사일을 도로 가져오지 않는다 ══════ */
test('★★ 퇴사 판정은 「퇴사」 표시(status)로 한다 — 날짜 없이도 도는 길', () => {
  const ctx = { console: { warn() {} } };
  vm.createContext(ctx);
  vm.runInContext(fnSource('staffFromRoster'), ctx);
  const r = 밖으로(ctx.staffFromRoster([
    { name: '나간사람', status: 'retired', retireDate: '2026-07-31' },
    { name: '다니는사람', status: 'active' }], 'dir'));
  assert.equal(r.staff[0].left, true);
  assert.equal(r.staff[0].leftAt, '', '★★ 퇴사일을 도로 들고 옵니다');
  assert.equal(r.staff[1].left, false);
});

/* ══════ ⓒ 휴직은 퇴사가 아니다 ══════ */
test('★★ 휴직(leave)을 따로 든다 — retired 와 «다른 것»이다', () => {
  const ctx = { console: { warn() {} } };
  vm.createContext(ctx);
  vm.runInContext(fnSource('staffFromRoster'), ctx);
  const r = 밖으로(ctx.staffFromRoster([
    { name: '김휴직', status: 'leave', title: '사무직' },
    { name: '박퇴사', status: 'retired' },
    { name: '이재직', status: 'active' }], 'dir')).staff;
  assert.equal(r[0].onLeave, true, '★★ 휴직을 못 알아봅니다');
  assert.equal(r[0].left, false, '★★★ 휴직을 퇴사로 읽습니다 — 멀쩡한 글을 내리게 됩니다');
  assert.equal(r[1].onLeave, false);
  assert.equal(r[1].left, true);
  assert.equal(r[2].onLeave, false);
});

test('★★★ 휴직자는 「내릴 것」이 되지 않는다 — «확인 필요»로만 알린다', () => {
  const D = 부품();
  const 명부 = [{ name: '김휴직', title: '사무직', left: false, onLeave: true, leftAt: '' }];
  const 딱지 = 밖으로(D.rosterMark('김휴직', 명부, '2026-10-04'));
  assert.equal(딱지.kind, 'leave', '★★ 휴직 딱지가 안 붙습니다');
  assert.equal(딱지.label, '휴직');
  assert.match(딱지.detail, /퇴사가 아닙니다/, '★ 왜 퇴사가 아닌지 안 적습니다');
  /* 대조(홈페이지에 남았나)가 휴직자를 «내릴 것»으로 판정하면 안 된다 */
  const 대조 = 밖으로(D.memberStatus(
    [{ key: '1', name: '김휴직', srl: '1', careers: [] }],
    [{ srl: '1', name: '김휴직', careers: [] }], 명부, '2026-10-04'));
  assert.notEqual(대조[0].status, 'toRemove',
    '★★★ 휴직자를 내릴 것으로 잡습니다 — 돌아올 분 글을 내리게 됩니다');
});

test('퇴사는 그대로 「퇴사」다 — 휴직을 넣었다고 퇴사 판정이 약해지지 않는다', () => {
  const D = 부품();
  const 딱지 = 밖으로(D.rosterMark('박퇴사',
    [{ name: '박퇴사', left: true, onLeave: false, leftAt: '' }], '2026-10-04'));
  assert.equal(딱지.kind, 'left');
  assert.equal(D.rosterMark('이재직',
    [{ name: '이재직', left: false, onLeave: false, leftAt: '' }], '2026-10-04'), null,
    '재직인데 딱지가 붙습니다');
});

test('★ 휴직 딱지에 한국어 이름과 «퇴사와 다른 색»이 있다', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(constLine('OWN_LABEL') + constLine('OWN_CLS'), ctx);
  const 이름 = 밖으로(ctx.OWN_LABEL), 색 = 밖으로(ctx.OWN_CLS);
  assert.ok(이름.leave && !/^[a-z]+$/.test(이름.leave), '휴직 이름이 없거나 영문 열쇠입니다');
  assert.ok(색.leave, '휴직 색이 없습니다');
  assert.notEqual(색.leave, 색.left,
    '★★ 휴직이 퇴사와 같은 색입니다 — 같은 색이면 퇴사로 읽고 내리려 듭니다');
  assert.match(RAW, /(?:^|\n)\.pill\.lv\{/, '휴직 색 꾸밈(.pill.lv)이 없습니다');
});

/* ══════ ⓓ 휴직자는 넣을 수 없다 ══════ */
function 창상자(명부) {
  const 한것 = [];
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    App: { staff: 명부, members: {}, group: 'members', pick: null, render() {} },
    MEMBER_KINDS: [{ key: 'labor', label: '노무사' }, { key: 'staff', label: '직원' }],
    memberKind: (m) => (/노무사/.test(String(m.position1 || '')) ? 'labor' : 'staff'),
    modalHead: (t) => '<h2>' + t + '</h2>',
    modalFoot: () => '', openModal(h) { ctx.그린것 = h; },
    말한것: [], say(t, b) { ctx.말한것.push(String(t) + ' ' + String(b || '')); return Promise.resolve(); },
    saveRecord() { 한것.push('save'); return Promise.resolve(); },
    closeModal() {}, loadDraft() {}, toast() {},
    한것: 한것
  };
  vm.createContext(ctx);
  vm.runInContext([fnSource('직급의갈래'), fnSource('명부재직자'), fnSource('openRosterAdd'),
    fnSource('addFromRoster')].join('\n'), ctx);
  return ctx;
}
const 명부샘플 = [
  { name: '이재직', title: '대리', left: false, onLeave: false },
  { name: '김휴직', title: '사무직', left: false, onLeave: true },
  { name: '박퇴사', title: '주임', left: true, onLeave: false }
];

test('★★ 휴직자는 「넣기」 단추가 «꺼져» 있고 까닭이 적힌다', () => {
  const ctx = 창상자(명부샘플);
  ctx.openRosterAdd();
  const h = ctx.그린것;
  assert.match(h, /휴직 중 1명 — 넣을 수 없습니다/, '★★ 휴직자를 따로 모아 알리지 않습니다');
  assert.match(h, /<button class="btn" disabled>넣기<\/button>/, '★★ 휴직자의 넣기 단추가 켜져 있습니다');
  assert.match(h, /직원관리/, '★ 어디서 정리해야 하는지 안 적습니다');
  /* 재직자는 그대로 넣을 수 있다 */
  assert.match(h, /addFromRoster\('이재직'/, '재직자의 넣기가 사라졌습니다');
  /* 퇴사자는 아예 안 뜬다 */
  assert.ok(h.indexOf('박퇴사') < 0, '퇴사자가 목록에 뜹니다');
});

test('★★ 휴직자는 넣을 수 있는 자리(갈래 목록)에 «섞이지» 않는다', () => {
  const ctx = 창상자(명부샘플);
  ctx.openRosterAdd();
  const h = ctx.그린것;
  /* 김휴직 줄은 «넣기 단추가 켜진 줄»로 나오면 안 된다 */
  assert.ok(h.indexOf("addFromRoster('김휴직'") < 0,
    '★★★ 휴직자를 넣는 단추가 켜져 있습니다');
});

test('★★★ 단추를 껐어도 함수가 «직접 불려도» 막는다 — 안전망', async () => {
  const ctx = 창상자(명부샘플);
  await ctx.addFromRoster('김휴직', '사무직');
  assert.deepEqual(ctx.한것, [], '★★★ 휴직자를 구성원에 저장했습니다');
  assert.ok(ctx.말한것.some(t => /휴직/.test(t)), '왜 안 되는지 말하지 않습니다');
});

test('재직자는 그대로 들어간다 — 막는 것이 너무 넓지 않다', async () => {
  const ctx = 창상자(명부샘플);
  await ctx.addFromRoster('이재직', '대리');
  assert.deepEqual(ctx.한것, ['save']);
});

test('★ 동명이인 중 «한 분이라도» 재직이면 막지 않는다 — 전부 휴직일 때만 막는다', async () => {
  const ctx = 창상자([
    { name: '홍동명', title: '대리', left: false, onLeave: true },
    { name: '홍동명', title: '과장', left: false, onLeave: false }]);
  await ctx.addFromRoster('홍동명', '과장');
  assert.deepEqual(ctx.한것, ['save'], '재직 중인 동명이인까지 막았습니다');
});

/* ══════ ⓔ 화면의 문구가 사실이다 ══════ */
test('★★ 「읽지도 않습니다」라는 거짓 문구가 «없다»', () => {
  /* ⚠ 주석을 걷은 «코드»로 본다 — 주석에는 옛 문구를 «설명하려고» 적어 두었다 */
  const s = 함수('openRosterAdd');
  assert.ok(!/읽지도 않습니다/.test(s),
    '★★ 사실이 아니던 「읽지도 않습니다」가 도로 있습니다 — 인사 명부를 읽던 때의 문구입니다');
  assert.match(s, /공개 직원 명부/, '★ 어디서 읽는지 안 밝힙니다');
  assert.match(s, /인사 명부는 읽지 않습니다/, '★ 안 읽는다는 말이 없습니다');
});

test('★ 휴직 카드가 할 일에 뜬다 — «내리라»가 아니라 «확인하라»', () => {
  const s = 함수('jobsOf');
  assert.match(s, /ms\.own\.leave/, '★★ 휴직 중인 분을 할 일에 안 올립니다');
  assert.match(s, /휴직 중인 분이 구성원에 있습니다/);
  assert.match(s, /자동으로 내리지 않습니다/, '★★ 자동으로 내리는 줄 오해합니다');
  assert.match(s, /own:leave/, '★ 「보기」 단추가 휴직으로 못 걸러 갑니다');
});

test('★ 부품 캐시 번호가 올랐다 — 안 올리면 옛 부품이 휴직을 모른다', () => {
  const m = /js\/pu-home-diff\.js\?v=(\d+)/.exec(RAW);
  assert.ok(m, '부품 불러오기에 캐시 번호가 없습니다');
  assert.ok(Number(m[1]) >= 10, '캐시 번호가 안 올랐습니다 — 배포돼도 브라우저가 옛 부품을 씁니다: v=' + m[1]);
});
