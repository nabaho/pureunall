'use strict';
/* 「새 버전 있음 · 누르기」 — 폰에서는 바닥 가까이, 바닥 막대가 있으면 그 위 (대표 지시 2026-10-18
   「새 버전 있으면 누르기가 너무 위에 있다 … 위치를 조금 낮게」 → 「추천대로」(모든 앱에))

   ■ 그날 있었던 일
   취업규칙에서만 24px 로 박았더니(css/rules-shell.css) 폰 «쪽 막대»(sticky, 바닥에 붙는다)를 덮었다 —
   사업장이 50곳을 넘으면 「1 2 3 … 다음 ›」 위에 단추가 앉았다. 쪽 막대는 폰 폭에 따라 두세 줄로 접혀
   높이가 화면마다 달라 숫자 하나로는 못 비킨다. 그래서 «모든 앱 한 곳»(js/pu-appbar.js)에서 그 자리를 «재서» 정한다.

   ★ 못 박는 것은 규칙이다(값이 아니다):
     ① 폰 구간에서만 공용 높이(pu-version.js, PC·앱바 없는 화면용)보다 낮게 — 변수 하나(--pu-fab-bottom)로
     ② 바닥에 붙은 막대가 그 자리에 있으면 막대 위로 · 없으면 바닥 · 화면 거의 전부인 fixed(앱 몸통)는 막대가 아니다 ·
        평소(숨어 있을 때)는 재지 않는다
     ③ 앱 화면이 이 단추 자리를 따로 박지 않는다(두 곳이 정하면 한쪽만 고쳐진다)
     ④ 단추 상태가 바뀔 때·스크롤·폭 바뀜에 다시 잰다
   실행: node --test tests/version-fab-phone-low.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./lib-appbar-load');

const R = path.join(__dirname, '..');
const 앱바 = fs.readFileSync(path.join(R, 'js', 'pu-appbar.js'), 'utf8');
const 버전 = fs.readFileSync(path.join(R, 'js', 'pu-version.js'), 'utf8');
const 공용 = Number((버전.match(/id = 'pu-version-fab'[\s\S]*?bottom:(\d+)px/) || [])[1]);

/* 폰 화면 하나를 지어 fabLift 를 돌린다 — bars: 화면에 떠 있는 상자 [{pos, top, bottom, left, right}] (화면 좌표) */
function lift(opt) {
  const W = 411, H = 800, o = opt || {};
  const set = {};
  const fabRect = { left: W - 14 - 145, right: W - 14, top: H - 24 - 29, bottom: H - 24, width: 145, height: 29 };
  const fab = { pos: 'fixed', display: o.hidden ? 'none' : 'inline-flex', style: { visibility: '' }, getBoundingClientRect: () => fabRect };
  const body = { pos: 'static' }, html = { pos: 'static', style: { setProperty: (k, v) => { set[k] = v; } } };
  const rectOf = (b) => ({ top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.right - b.left, height: b.bottom - b.top });
  const shell = { pos: 'fixed', parentElement: body, getBoundingClientRect: () => rectOf({ top: 0, bottom: H, left: 0, right: W }) };
  const boxes = (o.bars || []).map((b) => {
    const box = { pos: b.pos, cssBottom: b.cssBottom, getBoundingClientRect: () => rectOf(b) };
    // inShell: 화면 전부인 fixed 몸통 안(메일) · scroller: 그 사이에 스크롤 상자가 있다
    const scroller = { pos: 'static', overflowY: 'auto', scrollHeight: 2000, clientHeight: H, parentElement: shell };
    box.parentElement = b.inShell ? (b.scroller ? scroller : shell) : body;
    const inner = { pos: 'static', parentElement: box };              // 눌린 것은 상자 «안»의 단추
    return { b, inner };
  });
  const B = load({
    role: 'admin',
    setup(ctx, win) {
      win.innerWidth = W; win.innerHeight = H;
      win.matchMedia = () => ({ matches: o.pc ? false : true });
      win.getComputedStyle = (e) => ({ position: e.pos || 'static', display: e.display || 'block', overflowY: e.overflowY || 'visible', bottom: e.cssBottom || '0px' });
      ctx.document.getElementById = (id) => (id === 'pu-version-fab' ? fab : null);
      ctx.document.documentElement = html;
      ctx.document.body = Object.assign(body, { appendChild() { } });
      ctx.document.elementFromPoint = (x, y) => {
        // 단추가 «보이면» 단추가 잡힌다 — 밑을 보려면 감춰야 한다
        if (fab.style.visibility !== 'hidden' && x >= fabRect.left && x <= fabRect.right && y >= fabRect.top && y <= fabRect.bottom) return fab;
        for (const { b, inner } of boxes) if (y >= b.top && y <= b.bottom && x >= b.left && x <= b.right) return inner;
        return body;
      };
    },
  });
  B._fabLift();
  return { val: set['--pu-fab-bottom'], low: B.FAB_LOW, H, W, fabVisibility: fab.style.visibility };
}

test('① 폰에서만 공용 높이보다 낮게 — 변수 하나(--pu-fab-bottom)로, PC 는 그대로', () => {
  assert.ok(공용 > 0, 'pu-version.js 에서 공용 bottom 을 못 읽었다');
  const low = load({ role: 'admin' }).FAB_LOW;
  assert.ok(low > 0 && low < 공용, '★ 폰 바닥 자리(' + low + ')가 공용(' + 공용 + ')보다 낮지 않다');
  const css = 앱바.slice(앱바.indexOf('function phoneCssNow'), 앱바.indexOf('function phoneRows'));
  assert.match(css, /'@media ' \+ PHONE_MQ/, '폰 구간 안에 걸어야 한다 — PC 는 공용 그대로');
  assert.match(css, /#pu-version-fab\{bottom:calc\(var\(--pu-fab-bottom,/, '폰 자리를 변수로 두지 않았다 — 막대 위로 올릴 길이 없다');
});

test('② 단추 자리에 «화면에 박힌 것»이 있으면 그 위로 · 없으면 바닥', () => {
  const none = lift({});
  assert.equal(none.val, none.low + 'px', '아무것도 없으면 바닥 자리');
  assert.equal(none.fabVisibility, '', '잰 뒤 단추를 다시 보이게 해야 한다');

  const above = (r, top, why) => assert.ok(parseInt(r.val, 10) >= 800 - top, '★ ' + why + '을(를) 덮는다 — 단추 바닥이 ' + r.val);
  // 취업규칙 쪽 막대(sticky, 바닥에 붙음) — 두 줄(66)·세 줄로 접힘(98) 어느 쪽이든
  [66, 98].forEach((h) => above(lift({ bars: [{ pos: 'sticky', top: 800 - h, bottom: 800, left: 0, right: 411 }] }), 800 - h, '쪽 막대 ' + h + 'px'));
  // 업무관리 빠른 입력줄 — fixed 인데 바닥에서 14px 떠 있다(바닥에 «닿지» 않아도 비킨다)
  above(lift({ bars: [{ pos: 'fixed', top: 730, bottom: 786, left: 6, right: 405 }] }), 730, '빠른 입력줄');
  // 메일 ✏️ 쓰기 — 화면 전부인 fixed 몸통 «안»의 absolute
  above(lift({ bars: [{ pos: 'absolute', inShell: true, top: 726, bottom: 782, left: 339, right: 395 }] }), 726, '메일 ✏️');
});

test('② 비키지 않을 것 — 앱 몸통 fixed 자체 · 스크롤되는 것 · 화면 높이 판 · 단추 자리 밖', () => {
  // 화면 거의 전부를 덮는 fixed(메일처럼 앱 몸통이 fixed) — 그 안은 스크롤되므로 막대가 아니다
  const shell = lift({ bars: [{ pos: 'fixed', top: 0, bottom: 800, left: 0, right: 411 }] });
  assert.equal(shell.val, shell.low + 'px', '앱 몸통 fixed 를 막대로 보고 단추를 화면 위로 올렸다');
  // 몸통 안이라도 스크롤 상자 안의 absolute(목록 줄의 딱지)는 같이 움직인다
  const inList = lift({ bars: [{ pos: 'absolute', inShell: true, scroller: true, top: 740, bottom: 770, left: 300, right: 400 }] });
  assert.equal(inList.val, inList.low + 'px', '스크롤되는 목록 안의 것 때문에 단추를 올렸다');
  // 몸통 안의 absolute 라도 화면 위까지 닿는 판(메일 서랍)은 막대가 아니다 — 비키면 단추가 화면 밖으로 나간다
  const drawer = lift({ bars: [{ pos: 'absolute', inShell: true, top: 0, bottom: 800, left: 0, right: 300 }] });
  assert.equal(drawer.val, drawer.low + 'px', '서랍(화면 높이 판) 위로 단추를 올렸다 — 화면 밖으로 나간다');
  // 옆으로만 붙는 sticky(업무관리 타임라인 이름칸, bottom:auto) — 위아래로 흘러가니 비키면 스크롤 때 단추가 오르내린다
  const side = lift({ bars: [{ pos: 'sticky', cssBottom: 'auto', top: 740, bottom: 790, left: 0, right: 411 }] });
  assert.equal(side.val, side.low + 'px', '옆으로만 붙는 이름칸 때문에 단추를 올렸다');
  // 단추 자리에 안 걸친 떠 있는 것(가운데 손잡이·위쪽 띠)
  const mid = lift({ bars: [{ pos: 'fixed', top: 300, bottom: 380, left: 0, right: 411 }] });
  assert.equal(mid.val, mid.low + 'px', '단추 자리 밖의 상자 때문에 단추를 올렸다');
});

test('② 평소(숨어 있을 때)·PC 에서는 재지 않는다', () => {
  assert.equal(lift({ hidden: true, bars: [{ pos: 'sticky', top: 734, bottom: 800, left: 0, right: 411 }] }).val, undefined);
  assert.equal(lift({ pc: true, bars: [{ pos: 'sticky', top: 734, bottom: 800, left: 0, right: 411 }] }).val, undefined);
});

test('③ 앱 화면은 이 단추 자리를 따로 박지 않는다 — 앱바 한 곳', () => {
  const skip = new Set(['pu-appbar.js', 'pu-version.js']);
  const files = [];
  (function walk(d) {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      if (/^(node_modules|tests|tools|\.git|docs|fund-erp|status|harness|android|functions|hosting)$/.test(n.name)) continue;
      const f = path.join(d, n.name);
      if (n.isDirectory()) walk(f);
      else if (/\.(html|css|js)$/.test(n.name) && !skip.has(n.name)) files.push(f);
    }
  })(R);
  const bad = files.filter((f) => /#pu-version-fab[^{]*\{[^}]*\b(bottom|top)\s*:/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(bad.map((f) => path.relative(R, f)), [],
    '이 파일들이 「새 버전」 단추 자리를 따로 박았다 — 폰 자리는 js/pu-appbar.js 의 fabLift 한 곳에서 정한다');
});

test('④ 단추 상태가 바뀔 때·스크롤·폭 바뀜에 다시 잰다', () => {
  const w = /function fabWatch\(\)[\s\S]*?\r?\n  }\r?\n/.exec(앱바);
  assert.ok(w, 'fabWatch 가 없다');
  assert.match(w[0], /MutationObserver[\s\S]*attributeFilter:\s*\['data-state'\]/, '새 버전을 찾았을 때(상태 바뀜) 다시 안 잰다');
  assert.match(w[0], /addEventListener\('scroll'/, '스크롤하면 막대가 생기고 없어지는데 다시 안 잰다');
  assert.match(w[0], /addEventListener\('resize'/);
  assert.match(앱바, /function auto\(\)[\s\S]*?fabWatch\(\)/, '앱바가 붙을 때 재기를 안 건다');
});
