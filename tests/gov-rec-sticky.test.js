'use strict';
/* 정부사업신청 › 컨설턴트 모집 — 하위 탭 줄·단추 줄 틀고정 (대표 지시 2026-10-07 「틀고정」)
   실측(1600×900, 1500px 내림): 머리 0–94 · 하위 탭 94–137 · 단추 줄 137–181 — 겹침·틈 없음.
   ⚠ 높이는 «재서» 알려 준다 — 고정값을 박으면 좁은 화면에서 머리줄이 접힐 때 어긋난다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8').replace(/\r\n/g, '\n');

function fnSrc(name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 가 없다');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error(name + ' 끝을 못 찾음');
}

function run(els, opts = {}) {
  const props = {}, obs = [], listeners = [];
  const ctx = {
    document: { documentElement: { style: { setProperty: (k, v) => { props[k] = v; } } } },
    $: (id) => els[id] || null,
    window: { addEventListener: (ev, f) => listeners.push([ev, f]) },
    ResizeObserver: opts.noRO ? undefined : function (cb) { this.observe = (e) => obs.push(e); this.cb = cb; ctx._ro = this; }
  };
  vm.runInNewContext(fnSrc('recStickySync') + '\n' + fnSrc('recStickyWatch') + '\n;globalThis.__a={recStickySync,recStickyWatch};', ctx);
  return { api: ctx.__a, props, obs, listeners, ctx };
}

test('★★ 머리·하위 탭의 «지금» 높이를 CSS 변수로 알려 준다', () => {
  const r = run({ head: { offsetHeight: 94 }, recSubs: { offsetHeight: 43 } });
  r.api.recStickySync();
  assert.equal(r.props['--headH'], '94px');
  assert.equal(r.props['--rsubH'], '43px');
});

test('★ 숨어 있을 때(높이 0)는 옛 값을 지우지 않는다', () => {
  const r = run({ head: { offsetHeight: 97 }, recSubs: { offsetHeight: 0 } });
  r.api.recStickySync();
  assert.equal(r.props['--headH'], '97px');
  assert.ok(!('--rsubH' in r.props), '0px 을 박으면 단추 줄이 하위 탭을 덮는다');
});

test('★★ 높이가 바뀌면 다시 잰다 — 머리·하위 탭 둘 다 지켜본다 + 창 크기', () => {
  const els = { head: { offsetHeight: 94 }, recSubs: { offsetHeight: 43 } };
  const r = run(els);
  r.api.recStickyWatch();
  assert.equal(r.obs.length, 2, '둘 다 지켜봐야 한다');
  assert.ok(r.obs.includes(els.head) && r.obs.includes(els.recSubs));
  els.head.offsetHeight = 140;                 // 좁아져 머리줄이 두 줄로 접혔다
  r.ctx._ro.cb();
  assert.equal(r.props['--headH'], '140px');
  assert.ok(r.listeners.some(([ev]) => ev === 'resize'));
});

test('ResizeObserver 가 없는 브라우저에서도 멈추지 않는다', () => {
  const r = run({ head: { offsetHeight: 94 }, recSubs: { offsetHeight: 43 } }, { noRO: true });
  r.api.recStickyWatch();
  assert.equal(r.props['--headH'], '94px');
});

test('★★ CSS — 하위 탭은 머리 밑에, 단추 줄은 그 밑에 «재 값»으로 붙는다', () => {
  assert.match(src, /#recSubs\{position:sticky;top:var\(--headH,\d+px\);[^}]*background:var\(--card\)/);
  assert.match(src, /#recPaneHist>\.bar\{position:sticky;top:calc\(var\(--headH,\d+px\) \+ var\(--rsubH,\d+px\)\);[^}]*\n?[^}]*background:var\(--card\)/);
  assert.match(src, /@media \(max-width:640px\)\{ #recPaneHist>\.bar\{position:static/, '폰에서는 세 층이 화면 3분의 1을 먹는다');
});

test('★ 부팅 때 지켜보기 시작하고, 모집 탭을 열 때도 잰다(숨어 있던 동안은 못 쟀다)', () => {
  assert.match(fnSrc('boot'), /^function boot\(\)\{\s*recStickyWatch\(\);/);
  assert.match(fnSrc('setTab'), /if\(t==='rec'\)\{[^}]*recStickySync\(\);/);
});
