/* 안읽음·중요·첨부를 누르면 «전체메일»에서 보여 준다 (대표 지적 2026-09-18)
   「안읽금 중요 메일 별도로 보려고 클릭했는데 전혀 반응 안한다」

   ★ 무슨 일이었나 — 옆줄의 「안읽음 8」은 «칸을 다 합친» 수인데, 누르면 «지금 보고
     있는 칸 안에서만» 걸렀다. 실측 2026-09-18: 그 8통은 1.자문사답변 5 · 받은메일함 2 ·
     3.컨설팅 1 로 세 칸에 흩어져 있었다. 예약메일함에서 누르면 0통 —
     눌러도 아무 일이 없는 것처럼 보인다.
     숫자는 전체를 말하는데 행동은 한 칸만 보는, 서로 어긋난 자리였다.

   지키는 것.
   ① 켜면 «전체메일»로 간다 — 그래야 적힌 수만큼 보인다
   ② 끌 때는 자리를 «안 옮긴다» — 보던 칸에 그대로 둔다
   ③ 이미 전체메일이면 옮기지 않는다 (같은 칸을 다시 여는 헛걸음이 없게)
   ④ 처음 들어오면 «전체메일»이다 (같은 지시의 뒷부분) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'pu-cards.html'), 'utf8');

/* 진짜 mbFilter 를 돌린다 — 옮겨 가는 곳만 손에 쥔다 */
function run(box, filter){
  const held = { opened: [], drew: 0 };
  const ctx = {
    Object, String, Number, console,
    state: { view:'mail', mailSent:'box', mbBox:box, mbFilter:filter || '' },
    mbNow: () => ctx.state.mbBox || '',
    openMailBox: (id)=>{ held.opened.push(id); ctx.state.mbBox = id; },
    renderPCSide: ()=>{ held.drew++; }, renderMailPage: ()=>{ held.drew++; },
    __held: held
  };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(app, 'function mbFilter('), ctx);
  return ctx;
}

test('★★★ 거르개를 «켜면» 전체메일로 간다 — 적힌 수만큼 보여야 한다', () => {
  /* 대표께서 겪으신 그대로 — 예약메일함에서 「안읽음 8」을 눌렀다 */
  const c = run('예약편지함-1', '');
  c.mbFilter('unread');
  assert.equal(c.state.mbFilter, 'unread', '거르개가 안 켜집니다');
  assert.deepEqual(c.__held.opened, ['*all'],
    '보던 칸 안에서만 거릅니다 — 그 칸에 없으면 눌러도 아무 일이 없습니다');
});

test('★★★ 중요·첨부도 마찬가지다 — 셋이 같은 규칙이어야 한다', () => {
  ['flag', 'att'].forEach((k) => {
    const c = run('예약편지함-1', '');
    c.mbFilter(k);
    assert.deepEqual(c.__held.opened, ['*all'], k + ' 만 딴 길로 갑니다');
  });
});

test('★★★ 끌 때는 자리를 «안 옮긴다» — 보던 칸에 그대로 둔다', () => {
  /* ⚠ 끄는데도 전체메일로 끌려가면, 한 칸을 보다 거르개를 껐을 뿐인데 자리를 잃는다 */
  const c = run('INBOX-1', 'unread');
  c.mbFilter('unread');                       /* 같은 것을 다시 누르면 끈다 */
  assert.equal(c.state.mbFilter, '', '거르개가 안 꺼집니다');
  assert.deepEqual(c.__held.opened, [], '끄는데도 자리를 옮겼습니다');
  assert.ok(c.__held.drew > 0, '끄고 나서 다시 안 그립니다');
});

test('★★ 이미 전체메일이면 «옮기지 않는다» — 같은 칸을 다시 여는 헛걸음', () => {
  const c = run('*all', '');
  c.mbFilter('unread');
  assert.equal(c.state.mbFilter, 'unread');
  assert.deepEqual(c.__held.opened, [], '전체메일인데 전체메일을 또 엽니다');
  assert.ok(c.__held.drew > 0, '다시 안 그립니다');
});

test('★★ 다른 거르개로 «바꿔» 눌러도 전체메일로 간다', () => {
  const c = run('INBOX-1', 'unread');
  c.mbFilter('flag');                          /* 안읽음 → 중요 */
  assert.equal(c.state.mbFilter, 'flag');
  assert.deepEqual(c.__held.opened, ['*all'], '거르개를 바꿔 켤 때는 안 옮깁니다');
});

/* ══════ ④ 처음 들어오면 전체메일 ══════ */

test('★★★ 메일 문으로 처음 들어오면 «전체메일»이다', () => {
  /* 대표 지시 2026-09-18 「처음 들어오면 전체 메일로 들어오게 해서 메일이 들어왔는지
     확인할 수 있게 해달라」.
     ⚠ 빈 값('')을 주면 mbNow() 가 «내 담당자 칸»으로 떨어진다 — 그 칸은 내 자문사
       것만 보여 주므로, 오늘 온 메일이 다른 칸에 있으면 «안 들어온 것처럼» 보인다. */
  const bare = app.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const held = { box: null };
  const ctx = {
    console, Object, String, Number, JSON, URLSearchParams, setTimeout,
    location: { search: '?view=mail' }, localStorage: { getItem: () => null },
    myUid: 'u1', myEmail: 'me@pureun.kr', state: { items: {} }, _lastScreenDone: false,
    openSendMaterials: ()=>{}, openMailPage: ()=>{}, openCoThread: ()=>{},
    openWhoPage: ()=>{}, addMailIcon: ()=>{}, lastScreenKey: () => 'k',
    openMailBox: (id)=>{ held.box = id; }
  };
  vm.createContext(ctx);
  vm.runInContext(["var MAIL_WHO_TABS = ['succ','addr','end','notco'];",
    sliceFn(app, 'function mailToFromUrl('), sliceFn(app, 'function mailCoFromUrl('),
    sliceFn(app, 'function mailWhoFromUrl('), sliceFn(app, 'function urlWantsMail('),
    sliceFn(app, 'function restoreLastScreen(')].join('\n'), ctx);
  ctx.restoreLastScreen();
  assert.equal(held.box, '*all',
    '처음 화면이 전체메일이 아닙니다 — 다른 칸에 온 메일을 못 보십니다 (' + held.box + ')');
  /* 담당자 칸이 «없어진 것은 아니다» — 옆줄에 그대로 있어야 한다 */
  assert.ok(bare.indexOf("row('*all','✉','전체메일')") > 0, '옆줄의 전체메일 줄이 사라졌습니다');
});
