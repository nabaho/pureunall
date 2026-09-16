/* 늦게 온 되부름이 «보고 있는 화면»을 낚아채지 않는다
   (대표 지적 2026-09-16 「메일함에 갑자기 메일쓰기로 나온다 클릭도 안 했는데」)

   ★ 무슨 일이 있었나 — 자료함을 아직 못 읽었으면 openMailPage 는 «읽어 온 뒤에»
     자기를 다시 부른다. 그 사이 몇 초 동안 화면은 그대로라, 누른 사람은
     「안 눌렸네」 하고 메일함을 계속 본다. 그러다 자료함이 도착하는 순간
     쓰기 화면이 저절로 열린다 — 누른 적 없는 사람에게는 고장으로 보인다.

   지키는 것.
   ① 누른 뒤 «자리를 옮겼으면» 늦게 온 것은 버린다
   ② 그대로 기다리고 있었으면 «잇는다» (안 그러면 눌러도 영영 안 열린다)
   ③ 「어디인가」에 화면·갈래·읽는 중·칸을 다 넣는다 — 하나라도 빠지면 그만큼 샌다
   ④ 기다리는 동안 한마디 한다 — 아무 일도 없으면 또 누르고, 되부름이 쌓인다
   ⑤ openMailPage·openSendMaterials 둘 다 이 길로 간다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'pu-cards.html'), 'utf8');
const bare = app.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 진짜로 돌려 본다 — loadMaterials 만 가짜로 두고 «되부름을 손에 쥔다» */
function run(){
  const held = { cb: null, toasts: [] };
  const ctx = {
    Object, String, Number, Array, JSON, console,
    state: { view:'mail', mailSent:'box', mbOpen:null, mbBox:'INBOX-1' },
    toast: (m)=>held.toasts.push(String(m)),
    loadMaterials: (cb)=>{ held.cb = cb; },     /* 아직 안 온 척 — 손에 들고 있는다 */
    __held: held
  };
  vm.createContext(ctx);
  ['screenSig', 'matLater'].forEach(n =>
    vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  return ctx;
}

/* ══════ ① 자리를 옮겼으면 버린다 ══════ */

test('★★★ 누른 뒤 «자리를 옮겼으면» 늦게 온 쓰기 화면을 안 연다', () => {
  /* 대표께서 겪으신 그대로 — 눌렀는데 아무 일이 없어 메일함을 계속 보다가,
     자료함이 도착하는 순간 쓰기 화면이 저절로 열렸다. */
  const c = run();
  let opened = 0;
  c.matLater(()=>{ opened++; });
  c.state.mbOpen = { u: 7 };            /* 그 사이 메일 한 통을 열었다 */
  c.__held.cb();                        /* 이제야 자료함이 도착한다 */
  assert.equal(opened, 0, '보고 있던 화면을 늦게 온 되부름이 빼앗았습니다');
});

test('★★★ 그대로 기다리고 있었으면 «잇는다» — 안 그러면 눌러도 영영 안 열린다', () => {
  const c = run();
  let opened = 0;
  c.matLater(()=>{ opened++; });
  c.__held.cb();
  assert.equal(opened, 1, '기다린 사람에게 아무것도 안 열립니다 — 단추가 죽습니다');
});

/* ══════ ③ 「어디인가」에 무엇이 들어가나 ══════ */

test('★★★ 화면·갈래·읽는 중·칸이 «모두» 자리의 일부다', () => {
  /* ⚠ 하나라도 빠지면 그만큼 샌다 — 같은 메일함 안에서 한 통을 열거나 칸을 옮긴 것도
       「자리를 옮긴 것」이다. 여기서 네 값을 하나씩 바꿔 본다. */
  [['view', 'list'], ['mailSent', 'set'], ['mbOpen', { u: 3 }], ['mbBox', 'SENT-9']]
    .forEach(([k, v]) => {
      const c = run();
      let opened = 0;
      c.matLater(()=>{ opened++; });
      c.state[k] = v;
      c.__held.cb();
      assert.equal(opened, 0, k + ' 이(가) 바뀌었는데도 화면을 빼앗습니다');
    });
});

test('★★ 아무것도 안 바뀌었으면 네 값 모두 그대로여야 한다', () => {
  const c = run();
  const a = c.screenSig();
  assert.equal(c.screenSig(), a, '가만히 있는데 자리가 달라집니다');
  assert.ok(a.indexOf('mail') >= 0 && a.indexOf('box') >= 0 && a.indexOf('INBOX-1') >= 0,
    '자리에 화면·갈래·칸이 안 담겼습니다: ' + a);
});

/* ══════ ④ 기다리는 동안 한마디 ══════ */

test('★★ 기다리는 동안 «한마디 한다» — 아무 일도 없으면 또 누르게 된다', () => {
  const c = run();
  c.matLater(()=>{});
  assert.ok(c.__held.toasts.length >= 1, '누른 사람에게 아무 말이 없습니다');
  assert.match(c.__held.toasts[0], /자료함/, '무엇을 기다리는지 안 알려 줍니다');
});

/* ══════ ⑤ 두 길이 «다» 이리로 온다 ══════ */

test('★★★ openMailPage·openSendMaterials 가 «직접» 되부름을 걸지 않는다', () => {
  /* ⚠ 여기가 흠의 뿌리였다. 둘 다 loadMaterials(()=>자기자신) 로 되불렀고,
       그 되부름에는 「아직 거기 계십니까」를 묻는 자리가 없었다. */
  ['openMailPage', 'openSendMaterials'].forEach((n) => {
    const f = sliceFn(app, 'function ' + n + '(').replace(/\/\*[\s\S]*?\*\//g, ' ');
    assert.ok(!/loadMaterials\(\s*\(\s*\)\s*=>\s*open/.test(f),
      n + ' 이 자료함 되부름을 «그대로» 걸고 있습니다 — 늦게 오면 화면을 빼앗습니다');
    assert.match(f, /matLater\(/, n + ' 이 자리 지킴이를 안 거칩니다');
  });
});

test('★★ 자리 지킴이가 «한 자리»에만 있다 — 두 벌이면 한쪽만 고쳐진다', () => {
  ['screenSig', 'matLater'].forEach((n) => {
    const c = (bare.match(new RegExp('function\\s+' + n + '\\s*\\(', 'g')) || []).length;
    assert.equal(c, 1, n + ' 이 ' + c + '번 선언돼 있습니다');
  });
});
