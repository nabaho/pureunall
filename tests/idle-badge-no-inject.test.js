/* 남은시간 배지(⏱ 59:xx)가 헤더를 «깜빡이게» 하던 뿌리
   ─────────────────────────────────────────────────────────────────────────
   대표 제보 2026-09-16 「여전히 계속 깜빡인다 이분제 반드시 해결해라 근본적인 문제 찾아라」

   ■ 무엇이 있었나
     자동 로그아웃 «남은시간 배지»가 매초 로그아웃 단추를 찾아 그 앞에 span 을
     insertBefore 했다. 헤더는 Preact 가 그리는 자리다 — 개선요청 수·연결 상태가 바뀌어
     헤더가 다시 그려질 때마다 Preact 가 제 자식 차례를 맞추며 그 이물질을 밀어냈고,
     다음 초에 배지가 다시 만들어져 끼워졌다. 로그아웃 단추까지 자리를 바꿨다.
     그것이 «계속 깜빡임»이었다. 게다가 mousemove 마다 localStorage 에 썼다.

   ★ 못 박는 것
     ① 배지는 Preact 나무 «안»에 끼우지 않는다 — body 에 떠 있는(fixed) 것 하나
     ② 자리는 로그아웃 단추의 좌표를 재어 맞춘다 (없으면 숨긴다)
     ③ 매초 다시 만들지 않는다 — 있으면 그대로 쓴다
     ④ 활동 기록은 묶어서 적는다 (5초 안에 또 오면 건너뜀) — 경고 띠는 즉시 걷는다
     ⑤ 글자가 같으면 다시 적지 않는다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const S = stripJs(SRC);

/* 자동 로그아웃 토막만 잘라 낸다 — 다른 검사(portal-auto-login)와 같은 잣대 */
function idleBlock() {
  const key = S.lastIndexOf("'pu_last_active'");
  const start = S.lastIndexOf('(function(){', key);
  const end = S.indexOf('})();', key);
  return S.slice(start, end + 5);
}
const BLOCK = idleBlock();

test('① 배지를 헤더(Preact 나무) 안에 «끼워 넣지» 않는다', () => {
  const f = cutFn(BLOCK, 'function ensureBadge(');
  assert.ok(!/insertBefore\(/.test(f),
    'insertBefore 로 헤더에 끼우면 헤더가 다시 그려질 때마다 밀려나고 다음 초에 다시 끼워진다 — 그것이 깜빡임이다');
  assert.match(f, /document\.body\.appendChild\(badge\)/, '배지는 body 에 «떠 있는» 것 하나여야 한다');
  assert.match(f, /position:fixed/, '떠 있지 않으면 어딘가의 자식이 되어 다시 그려질 때 밀린다');
});

test('② 자리는 로그아웃 단추의 «좌표»를 재어 맞춘다 — 단추가 없으면 숨긴다', () => {
  const f = cutFn(BLOCK, 'function placeBadge(');
  assert.match(f, /getBoundingClientRect\(\)/);
  assert.match(f, /badge\.style\.display\s*=\s*'none'/, '단추를 못 찾았는데 아무 데나 띄우면 안 된다');
  assert.match(f, /badge\.style\.right\s*=/);
});

test('③ 매초 다시 만들지 않는다 — 있으면 그대로 쓴다', () => {
  const f = cutFn(BLOCK, 'function ensureBadge(');
  assert.match(f, /if\(badge && document\.body\.contains\(badge\)\) return;/);
});

test('④ 활동 기록은 묶어서 적는다 — 마우스 한 획마다 저장하지 않는다', () => {
  const f = cutFn(BLOCK, 'function markActive(');
  assert.match(f, /if\(t - _lastMark < 5000\) return;/, '5초 안에 또 오면 저장을 건너뛴다');
  /* 경고 띠는 저장을 건너뛰어도 «먼저» 걷어야 한다 — 사람이 움직였다는 대답이다 */
  const i걷기 = f.indexOf('hideWarn()'), i건너 = f.indexOf('_lastMark < 5000');
  assert.ok(i걷기 >= 0 && i걷기 < i건너, '경고 띠 걷기가 건너뛰기보다 뒤에 있으면 움직여도 띠가 남는다');
});

test('⑤ 글자가 같으면 다시 적지 않는다 — 같은 글자도 다시 적으면 다시 그림이다', () => {
  const i = BLOCK.indexOf('tick=setInterval(');
  const timer = BLOCK.slice(i);
  assert.match(timer, /if\(badge\.textContent !== txt\) badge\.textContent = txt;/);
  assert.match(timer, /placeBadge\(\)/, '매초 자리를 맞추지 않으면 창 크기가 바뀔 때 어긋난다');
});

/* ── 진짜로 돌려 본다 — 가짜 창에서 헤더를 «다시 그려도» 배지가 밀리지 않는지 ── */
test('⑥ 헤더가 다시 그려져도 배지는 밀리지 않고, 다시 만들어지지도 않는다', async () => {
  /* 아주 작은 DOM — 필요한 것만 흉내낸다 */
  function el(tag){ const e = { tagName:tag, children:[], style:{}, textContent:'', parent:null,
    appendChild(c){ if(c.parent) c.parent.children.splice(c.parent.children.indexOf(c),1); c.parent=this; this.children.push(c); return c; },
    insertBefore(c, ref){ if(c.parent) c.parent.children.splice(c.parent.children.indexOf(c),1); c.parent=this; const i=this.children.indexOf(ref); this.children.splice(i<0?this.children.length:i,0,c); return c; },
    contains(c){ let p=c; while(p){ if(p===this) return true; p=p.parent; } return false; },
    getBoundingClientRect(){ return { left:1000, top:10, width:80, height:28, bottom:38 }; },
    get offsetHeight(){ return 22; } };
    return e; }
  const body = el('BODY'), header = el('HEADER'), userBox = el('DIV');
  const logout = el('BUTTON'); logout.textContent = '🚪 로그아웃';
  body.appendChild(header); header.appendChild(userBox); userBox.appendChild(logout);
  let 만든수 = 0;
  const store = { pureun_v6_session_sid: 'S1' };
  const win = {
    document: {
      body,
      createElement(tag){ 만든수++; return el(tag.toUpperCase()); },
      getElementById(){ return null; },
      querySelectorAll(sel){ return sel === 'button' ? [logout] : []; },
      addEventListener(){}, hidden:false
    },
    localStorage: { getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} },
    sessionStorage: { getItem:k=>(k in store?store[k]:null), removeItem:k=>{delete store[k];} },
    innerWidth: 1280, innerHeight: 800, IS_MOBILE:false,
    addEventListener(){}, setInterval(fn){ win._tick = fn; return 1; }, clearInterval(){},
    setTimeout(){ return 1; }, location:{}, firebase:{ auth(){ return { currentUser:null }; } },
    Date, Math, String, parseInt, console
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(BLOCK, win);

  win._tick();                                  /* 첫 초 — 배지가 생긴다 */
  const badge = body.children.find(c => c.id === 'pu-autologout-badge');
  assert.ok(badge, '배지가 body 에 붙어야 한다');
  assert.ok(!userBox.children.includes(badge), '헤더 안에 끼워졌다 — 다시 그려질 때 밀린다');
  assert.strictEqual(badge.style.display, 'inline-flex');
  assert.match(badge.textContent, /^⏱ \d\d:\d\d$/);

  /* Preact 가 헤더를 다시 그린 셈 — 자식을 통째로 갈아 낀다 */
  userBox.children.length = 0;
  const logout2 = el('BUTTON'); logout2.textContent = '🚪 로그아웃';
  userBox.appendChild(logout2);
  win.document.querySelectorAll = sel => (sel === 'button' ? [logout2] : []);
  const 만든수전 = 만든수;
  win._tick(); win._tick();
  assert.strictEqual(만든수, 만든수전, '헤더를 다시 그렸다고 배지를 «다시 만들면» 그것이 깜빡임이다');
  assert.ok(body.children.includes(badge), '배지는 그대로 body 에 있어야 한다');
  assert.strictEqual(badge.style.display, 'inline-flex');
});
