'use strict';
// 🖥 포털 머리줄 «맞춤» — PC(태블릿보다 넓은 폭)에서 머리줄 오른쪽 끝(로그아웃·내 메뉴)이 화면 밖으로 밀리지 않는다 (2026-11-28)
// node --test tests/portal-pbar-fit.test.js
//
// ■ 무엇이 나빴나 (tools/phone-audit portal 실측)
//   11-21 «📋 내 업무» 단추(#3228)가 머리줄에 들어온 뒤 1024px 에서 로그아웃·내 메뉴가 화면 밖으로 나갔다(화면밖 2).
//   11-22 TypeSafe 단추를 걷어 지어낸 자료로는 잠시 들어왔지만, 대표 PC 처럼 내 메뉴 단추 안에 «₩000,000 이번 달»이 붙으면
//   1100·1024·960·920·901px 에서 다시 넘쳤다. 머리줄은 «한 줄»(대표 2026-08-20)이라 접히지 않고 옆으로 넘친다.
//
// ■ 이 검사가 지키는 것 — «규칙»이지 지금 px 값이 아니다
//   ① 맞춤 단계 CSS 는 PC 구간 안에만 있다 — 폰·태블릿 모양을 바꾸지 않는다. PC 구간의 경계는 태블릿 규칙의 경계와 맞물린다(JS 도 같은 경계)
//   ② 마지막 단계의 머리줄 단추 모양은 태블릿과 «같다» — 두 벌로 갈라져 한쪽만 고쳐지지 않게
//   ③ 접는 것은 «다른 데 같은 말이 있는 글자»뿐 — 로그아웃·내 메뉴·이름·건의하기·챗봇 단추·금액은 어느 단계에서도 안 감춘다
//   ④ 맞춤은 «재서» 고른다 — 머리줄의 보이는 직계 자식 전부(목록을 박지 않는다)를 화면 오른쪽 끝과 견준다 · 바뀔 때마다 다시 잰다
//   ⑤ 실제로 돌려 본다 — 가짜 머리줄로 «넘치지 않으면 그대로 · 넘치면 가장 덜 접는 단계 · 다 접어도 넘치면 가장 좁은 단계»
//   ⑥ 점검 씨앗은 «가장 넓은 머리줄»로 잰다 — 사용액이 붙고, 연결이 끊긴 화면도 잰다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTER = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').replace(/\r\n/g, '\n');
const SEED = fs.readFileSync(path.join(__dirname, '..', 'tools', 'phone-audit', 'seeds', 'portal.js'), 'utf8').replace(/\r\n/g, '\n');

const CSS = (() => {
  const head = ENTER.slice(0, ENTER.indexOf('</head>'));
  return [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
})();
function mediaBlocks(css) {
  const out = []; const re = /@media([^{]*)\{/g; let m;
  while ((m = re.exec(css))) {
    let d = 1, i = re.lastIndex;
    for (; i < css.length && d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out.push({ cond: m[1].trim(), body: css.slice(re.lastIndex, i - 1), start: m.index, end: i });
    re.lastIndex = i;
  }
  return out;
}
const BLOCKS = mediaBlocks(CSS);
const OUTSIDE = (() => { let s = '', p = 0; BLOCKS.forEach((b) => { s += CSS.slice(p, b.start); p = b.end; }); return s + CSS.slice(p); })();
function rules(css) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) m[1].split(',').forEach((s) => out.push({ sel: s.trim().replace(/\s+/g, ' '), body: m[2] }));
  return out;
}
const norm = (s) => String(s).replace(/\s+/g, '').replace(/;+$/, '').toLowerCase();
const declSet = (body) => body.split(';').map(norm).filter(Boolean).sort().join(';');

/* 맞춤 단계 CSS 를 담은 PC 구간 */
const FIT = (() => {
  const bs = BLOCKS.filter((b) => /\[data-fit/.test(b.body));
  assert.equal(bs.length, 1, '맞춤 단계(.pbar[data-fit…]) CSS 를 담은 @media 가 하나여야 합니다 — 지금 ' + bs.length + '개');
  const m = bs[0].cond.replace(/\s+/g, '').match(/^\(min-width:(\d+)px\)$/);
  assert.ok(m, '★ 맞춤 단계 CSS 가 «PC 구간(min-width 하나)» 이 아닌 조건 안에 있습니다: ' + bs[0].cond);
  return { min: +m[1], rules: rules(bs[0].body) };
})();
/* 태블릿(폰 포함) 머리줄 단추를 그림만 남기는 규칙 — 이름 글자(.hd-tx b)를 감추는 그 구간 */
const TAB = (() => {
  const bs = BLOCKS.filter((b) => rules(b.body).some((r) => r.sel === '.pbar .hd-tx b' && /display:\s*none/.test(r.body)));
  assert.equal(bs.length, 1, '태블릿 머리줄 단추를 그림만 남기는 @media 를 하나로 못 찾았습니다(.pbar .hd-tx b{display:none})');
  const m = bs[0].cond.replace(/\s+/g, '').match(/^\(max-width:(\d+)px\)$/);
  assert.ok(m, '태블릿 머리줄 단추 구간의 조건을 못 읽었습니다: ' + bs[0].cond);
  return { max: +m[1], rules: rules(bs[0].body).filter((r) => /^\.pbar \.hd-/.test(r.sel)) };
})();
/* 맞춤 함수 덩어리 — 상수부터 «한 번에 몰아 재기» 앞까지 */
const FIT_JS = (() => {
  const a = ENTER.indexOf('var PBAR_FIT_EDGE'), b = ENTER.indexOf('function pbarFitSoon(');
  assert.ok(a >= 0 && b > a, '머리줄 맞춤 함수(PBAR_FIT_EDGE … pbarFitSoon)를 못 찾았습니다');
  return ENTER.slice(a, b);
})();
const STEPS = (() => {
  const m = FIT_JS.match(/var PBAR_FIT_STEPS\s*=\s*(\[[^\]]*\])/);
  assert.ok(m, '맞춤 단계 목록(PBAR_FIT_STEPS)을 못 찾았습니다');
  return JSON.parse(m[1].replace(/'/g, '"'));
})();
function fnBody(name) {
  const i = ENTER.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 을 못 찾았습니다');
  const s = ENTER.indexOf('{', i); let d = 1, j = s + 1;
  for (; j < ENTER.length && d; j++) { if (ENTER[j] === '{') d++; else if (ENTER[j] === '}') d--; }
  /* 주석은 걷고 본다 — 부르는 줄을 주석으로 막아 두면 «있는 것»으로 읽히지 않게(줄 주석은 앞이 공백·줄머리일 때만 — 주소 속 // 는 둔다) */
  return ENTER.slice(s, j).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[\s;{}])\/\/[^\n]*/g, '$1');
}

// ══════════════════════════════════════════════════════════════════
test('①★ 맞춤 단계 CSS 는 PC 구간 안에만 — 폰·태블릿 모양을 안 바꾼다 · 경계는 태블릿 규칙과 맞물린다(JS 도 같은 경계)', () => {
  assert.deepEqual(rules(OUTSIDE).filter((r) => /\[data-fit/.test(r.sel)).map((r) => r.sel), [],
    '★ 맞춤 단계 CSS 가 @media 밖에 있습니다 — 폰·태블릿 머리줄까지 바뀝니다');
  assert.equal(FIT.min, TAB.max + 1,
    '★ PC 맞춤 구간(min-width:' + FIT.min + 'px)과 태블릿 머리줄 구간(max-width:' + TAB.max + 'px)이 맞물리지 않습니다 — 사이 폭에서 어느 규칙도 안 타거나 둘 다 탑니다');
  const q = FIT_JS.match(/matchMedia\('\(min-width:\s*(\d+)px\)'\)/);
  assert.ok(q, '★ 맞춤 함수가 PC 판정을 matchMedia(min-width) 로 하지 않습니다');
  assert.equal(+q[1], FIT.min, '★ 맞춤 함수의 PC 경계(' + q[1] + 'px)가 CSS 맞춤 구간(' + FIT.min + 'px)과 다릅니다');
  assert.ok(FIT.rules.length > 0 && FIT.rules.every((r) => /^\.pbar\[data-fit~="[^"]+"\]/.test(r.sel)),
    '맞춤 구간 안 규칙은 모두 .pbar[data-fit~="단계"] 로 시작해야 합니다 — 단계를 안 탄 규칙은 1366px 모양까지 바꿉니다');
});

test('②★ 마지막 단계의 머리줄 단추 모양은 태블릿과 «같다» — 두 벌이 갈라지지 않게', () => {
  const last = STEPS[STEPS.length - 1].split(/\s+/).filter(Boolean);
  assert.ok(last.length > 0, '맞춤 단계가 하나도 없습니다');
  assert.ok(TAB.rules.length > 0, '태블릿 머리줄 단추 규칙을 못 읽었습니다');
  const 빠짐 = TAB.rules.filter((t) => !FIT.rules.some((f) => {
    const m = f.sel.match(/^\.pbar\[data-fit~="([^"]+)"\] (.+)$/);
    return m && last.includes(m[1]) && ('.pbar ' + m[2]) === t.sel && declSet(f.body) === declSet(t.body);
  }));
  assert.deepEqual(빠짐.map((t) => t.sel + '{' + t.body.trim() + '}'), [],
    '★ 태블릿(≤' + TAB.max + 'px) 머리줄 단추 규칙과 같은 것이 마지막 맞춤 단계에 없습니다(또는 값이 다릅니다) — 한쪽만 고치면 PC 를 좁혔을 때 모양이 갈라집니다');
});

test('③★ 접는 것은 «다른 데 같은 말이 있는 글자»뿐 — 로그아웃·내 메뉴·이름·건의하기·챗봇 단추·금액은 안 감춘다', () => {
  const 남길것 = ['#logoutBtn', '#meBtn', '.pmeta', '#userName', '#sgFab', '#chatFab', '.hd-app', '.hd-ico', '#meMoneyAmt', '.me-money b', '.logout'];
  const 감춤 = FIT.rules.filter((r) => /display:\s*none/.test(r.body)).map((r) => r.sel);
  assert.ok(감춤.length > 0, '맞춤 단계가 아무것도 접지 않습니다');
  const 잘못 = 감춤.filter((s) => {
    const parts = s.split(' '), tail1 = parts[parts.length - 1], tail2 = parts.slice(-2).join(' ');
    return 남길것.includes(tail1) || 남길것.includes(tail2);
  });
  assert.deepEqual(잘못, [], '★ 맞춤 단계가 눌러야 하는 것·읽어야 하는 것을 감춥니다 — 글자만 접으세요');
  /* 이름 글자를 접으면 이름은 «접근성 이름·말풍선»에 남아야 한다 */
  if (감춤.some((s) => /#chatFab \.chat-lb$/.test(s))) {
    assert.match(ENTER, /<button id="chatFab"[^>]*aria-label="[^"]+"/, '★ 챗봇 글자를 접는데 단추에 aria-label 이 없습니다');
  }
  if (감춤.some((s) => /\.hd-tx b$/.test(s))) {
    assert.match(fnBody('portalHeadAppLabel'), /setAttribute\('aria-label'/, '★ 머리줄 단추 이름을 접는데 aria-label 을 안 붙입니다');
    assert.match(fnBody('portalMyWorkLabel'), /setAttribute\('aria-label'/, '★ «내 업무» 단추 이름을 접는데 aria-label 을 안 붙입니다');
  }
});

test('④★ 맞춤은 «재서» 고른다 — 보이는 직계 자식 전부 · 떠 있는 창은 뺀다 · 포털을 그릴 때·창 크기·머리줄 안이 바뀔 때 다시 잰다', () => {
  const right = fnBody('pbarFitRight');
  assert.match(right, /\.children\b/, '★ 머리줄 자식을 목록으로 박아 잽니다 — 새 단추가 생기면 못 잽니다(bar.children 을 돌아야 합니다)');
  assert.match(right, /position\s*===\s*'absolute'/, '★ 떠 있는 창(내 메뉴·첫 안내)을 빼지 않습니다 — 넘치지 않는데도 접힙니다');
  assert.match(right, /display\s*===\s*'none'/, '★ 감춰진 자식까지 잽니다');
  assert.match(fnBody('pbarFit'), /documentElement\.clientWidth/, '★ 화면(문서) 오른쪽 끝과 견주지 않습니다');
  assert.match(fnBody('renderPortal'), /pbarFitWatch\(\)/, '★ 포털을 그린 뒤 머리줄을 재지 않습니다');
  const watch = fnBody('pbarFitWatch');
  assert.match(watch, /addEventListener\('resize',\s*pbarFitSoon\)/, '★ 창 크기가 바뀌어도 다시 재지 않습니다');
  assert.match(watch, /new MutationObserver/, '★ 머리줄 안(숫자·사용액·연결 상태)이 바뀌어도 다시 재지 않습니다');
  const f = watch.match(/attributeFilter:\s*\[([^\]]*)\]/);
  assert.ok(f, '★ 지켜볼 속성 목록(attributeFilter)이 없습니다 — 제가 바꾼 data-fit 에 스스로 깨어나 되풀이합니다');
  assert.ok(/'hidden'/.test(f[1]), '★ 머리줄 단추를 켜고 끌 때(hidden) 다시 재지 않습니다');
  assert.ok(!/data-fit/.test(f[1]), '★ data-fit 를 지켜봅니다 — 맞춤이 제 손으로 되풀이됩니다');
  assert.match(watch, /childList:\s*true/, '★ 머리줄에 단추가 붙고 빠질 때 다시 재지 않습니다');
  assert.match(watch, /characterData:\s*true/, '★ 숫자·글자가 바뀔 때 다시 재지 않습니다');
});

/* ── ⑤ 가짜 머리줄로 돌려 본다 ── */
function 돌리기({ vw, rightBy, hidden = false, tip = false, start = '' }) {
  const attrs = start ? { 'data-fit': start } : {};
  const step = () => attrs['data-fit'] || '';
  const kid = (cs, rect) => ({ cs, getBoundingClientRect: rect });
  const bar = {
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    setAttribute: (k, v) => { attrs[k] = String(v); },
    removeAttribute: (k) => { delete attrs[k]; },
    getClientRects: () => (hidden ? [] : [{}]),
    children: [
      kid({ display: 'flex', position: 'static' }, () => ({ width: 30, right: 60 })),                   // 로고
      kid({ display: 'block', position: 'absolute' }, () => ({ width: 380, right: vw * 5 })),           // 떠 있는 창 — 안 센다
      kid({ display: 'none', position: 'static' }, () => ({ width: 0, right: 0 })),                     // 감춘 것 — 안 센다
      kid({ display: 'block', position: 'static' }, () => ({ width: 50, right: rightBy[step()] }))       // 로그아웃(맨 오른쪽)
    ]
  };
  const doc = { querySelector: (s) => (s === '.pbar' ? bar : null), documentElement: { clientWidth: vw } };
  const win = {
    innerWidth: vw,
    matchMedia: (q) => {
      const m = String(q).match(/\((min|max)-width:\s*(\d+)px\)/);
      return { matches: m ? (m[1] === 'min' ? vw >= +m[2] : vw <= +m[2]) : false };
    }
  };
  let 다시 = 0;
  const make = new Function('document', 'window', 'getComputedStyle', '$', 'mwTipPlace',
    '"use strict";\n' + FIT_JS + '\nreturn { pbarFit: pbarFit, EDGE: PBAR_FIT_EDGE };');
  const api = make(doc, win, (el) => el.cs, (id) => (id === 'mwTip' && tip ? {} : null), () => { 다시++; });
  api.pbarFit();
  return { fit: attrs['data-fit'] || '', 다시, EDGE: api.EDGE };
}

test('⑤★ 넘치지 않으면 아무것도 안 바꾼다 · 넘치면 «가장 덜 접는» 단계 · 다 접어도 넘치면 가장 좁은 단계', () => {
  assert.ok(STEPS[0] === '' && STEPS.length >= 2, '맞춤 단계는 «안 접음»부터 시작해 하나 이상 접어야 합니다');
  const PC = FIT.min + 400;
  const by = (...r) => Object.fromEntries(STEPS.map((s, i) => [s, r[Math.min(i, r.length - 1)]]));
  const E = 돌리기({ vw: PC, rightBy: by(0) }).EDGE;
  assert.ok(E >= 0 && E < 40, '화면 끝 여유(PBAR_FIT_EDGE)가 엉뚱합니다: ' + E);

  /* 넉넉한 PC — 떠 있는 창이 화면 밖까지 걸쳐도 안 접는다(그대로) */
  assert.equal(돌리기({ vw: PC, rightBy: by(PC - E - 100, 10, 10) }).fit, '', '★ 넘치지 않는데 접습니다 — PC 넓은 화면 모양이 바뀝니다');
  /* 딱 끝까지는 들어간 것으로 본다 */
  assert.equal(돌리기({ vw: PC, rightBy: by(PC - E, 10) }).fit, '', '★ 화면 끝 여유까지 딱 맞는데 접습니다');
  /* 첫 단계면 들어갈 때 — 첫 단계에서 멈춘다 */
  assert.equal(돌리기({ vw: PC, rightBy: by(PC + 50, PC - E - 1, 10) }).fit, STEPS[1], '★ 한 단계면 들어가는데 더 접습니다(또는 안 접습니다)');
  /* 다 접어도 넘치면 마지막(가장 좁은) 단계 */
  assert.equal(돌리기({ vw: PC, rightBy: by(PC + 300, PC + 200, PC + 100) }).fit, STEPS[STEPS.length - 1], '★ 다 접어도 넘치는데 가장 좁은 모양으로 두지 않습니다');
  /* 접혀 있던 것도 자리가 나면 푼다(창을 넓힘·사용액이 사라짐) */
  assert.equal(돌리기({ vw: PC, rightBy: by(PC - E - 1), start: STEPS[STEPS.length - 1] }).fit, '', '★ 자리가 났는데 접힌 채로 남습니다');
  /* 태블릿·폰 — 맞춤을 지우고 손대지 않는다(CSS 가 따로 접는다) */
  assert.equal(돌리기({ vw: FIT.min - 1, rightBy: by(FIT.min * 3), start: STEPS[1] }).fit, '', '★ 태블릿·폰 폭에서 맞춤 단계가 남습니다');
  /* 포털이 감춰져 있으면(로그인 화면) 재지 않고 그대로 둔다 */
  assert.equal(돌리기({ vw: PC, rightBy: by(PC * 2), hidden: true, start: '' }).fit, '', '★ 감춰진 머리줄을 재서 접습니다(폭 0 으로 잼)');
  /* 첫 안내가 떠 있으면 — 단계가 바뀔 때만 화살표를 다시 맞춘다 */
  assert.equal(돌리기({ vw: PC, rightBy: by(PC + 50, 10), tip: true }).다시, 1, '★ 단계가 바뀌었는데 첫 안내 자리를 다시 안 맞춥니다');
  assert.equal(돌리기({ vw: PC, rightBy: by(10), tip: true }).다시, 0, '단계가 그대로인데 첫 안내 자리를 또 맞춥니다');
});

test('⑥ 점검 씨앗은 «가장 넓은 머리줄»로 잰다 — 사용액이 붙고 · 연결이 끊긴 화면도 잰다', () => {
  assert.match(SEED, /billing:\s*\{\s*current:\s*\{\s*total:\s*\{\s*cost:\s*\d+/,
    '★ 포털 점검 씨앗에 이번 달 사용액이 없습니다 — 대표 머리줄(내 메뉴 단추 안 «₩… 이번 달»)보다 좁게 재어 넘침을 못 봅니다');
  assert.match(SEED, /statusDot[\s\S]{0,200}dataset\.state\s*=\s*'offline'/,
    '★ 연결이 끊긴 머리줄(«서버 연결 끊김» 글자) 화면이 없습니다 — 가장 넓은 머리줄을 못 잽니다');
});
