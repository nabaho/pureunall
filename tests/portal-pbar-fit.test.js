'use strict';
// 🖥 포털 머리줄 «맞춤» — 태블릿·PC(폰보다 넓은 폭)에서 머리줄 오른쪽 끝(로그아웃·내 메뉴)이 화면 밖으로 밀리지 않는다 (2026-11-28)
// node --test tests/portal-pbar-fit.test.js
//
// ■ 무엇이 나빴나 (tools/phone-audit portal 실측)
//   11-21 «📋 내 업무» 단추(#3228)가 머리줄에 들어온 뒤 1024px 에서 로그아웃·내 메뉴가 화면 밖으로 나갔다(화면밖 2).
//   11-22 TypeSafe 단추를 걷어 지어낸 자료로는 잠시 들어왔지만, 대표 PC 처럼 내 메뉴 단추 안에 «₩000,000 이번 달»이 붙으면
//   1100·1024·960·920·901px 에서 다시 넘쳤다. 머리줄은 «한 줄»(대표 2026-08-20)이라 접히지 않고 옆으로 넘친다.
//   태블릿도 768px 에서 사용액 + «○ 서버 연결 끊김»이 함께 뜨면 로그아웃이 화면 밖으로 밀렸다(외부 점검 지적).
//   그 뒤에도 600·521px(작은 태블릿·나눈 창)은 접을 것이 모자라 로그아웃·내 메뉴가 화면 밖이었다 →
//   대표 2026-11-28 「후보 2 — 한 줄, 브랜드 글자부터」: 브랜드 글자 → 건의하기 글자 → (마지막) 로그아웃을 내 메뉴로.
//
// ■ 이 검사가 지키는 것 — «규칙»이지 지금 px 값이 아니다
//   ① 맞춤 단계 CSS 는 폰보다 넓은 구간(min-width)에만 있다 — 줄이 접히는 폰 머리줄은 안 바꾼다. JS 도 같은 경계.
//      태블릿에 닿는 맞춤 규칙은 «감추기» · «평소 감춰 둔 대역 꺼내기»(display 만) · «접은 칸의 빈 자리 밀개 넘겨받기»만 —
//      틈·여백을 PC 값으로 덮으면 태블릿이 오히려 넓어진다. PC 구간 경계는 태블릿 규칙과 맞물린다
//   ② 마지막 단계의 머리줄 단추 모양은 태블릿과 «같다» — 두 벌로 갈라져 한쪽만 고쳐지지 않게
//   ③ 접는 것은 «다른 데 같은 말이 있는 글자»뿐 — 내 메뉴·이름·건의하기·챗봇 단추·금액·로고는 어느 단계에서도 안 감춘다.
//      로그아웃은 «같은 단계에서 내 메뉴 안 로그아웃이 보일 때»만 머리줄에서 빠진다(폰과 같은 자리) — 로그아웃이 안 닿는 순간이 없게.
//      글자를 접은 단추는 이름(aria-label)이 남는다 · 건의하기는 «💬 건의하기» 한 흐름을 감추고 이름 있는 💬 대역을 꺼낸다(안을 쪼개면 기본 모양이 바뀐다)
//   ④ 맞춤은 «재서» 고른다 — 머리줄의 보이는 직계 자식 전부(목록을 박지 않는다)를 화면 오른쪽 끝과 견준다 · 바뀔 때마다 다시 잰다
//   ⑤ 실제로 돌려 본다 — 가짜 머리줄로 «넘치지 않으면 그대로 · 넘치면 가장 덜 접는 단계 · 다 접어도 넘치면 가장 좁은 단계»
//   ⑥ 점검 씨앗은 «가장 넓은 머리줄»로 잰다 — 사용액이 붙고, 연결이 끊긴 화면도 잰다
//   ⑦ 접는 차례(대표 2026-11-28 후보 2) — 기능 없는 브랜드 글자가 건의하기 글자보다 먼저 · 로그아웃은 맨 마지막 단계에서만

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

/* 맞춤 단계 CSS 를 담은 구간들 — 모두 «min-width 하나» 조건이어야 한다 */
const FITS = (() => {
  const bs = BLOCKS.filter((b) => /\[data-fit/.test(b.body));
  assert.ok(bs.length > 0, '맞춤 단계(.pbar[data-fit…]) CSS 를 담은 @media 가 없습니다');
  return bs.map((b) => {
    const m = b.cond.replace(/\s+/g, '').match(/^\(min-width:(\d+)px\)$/);
    assert.ok(m, '★ 맞춤 단계 CSS 가 «min-width 하나» 가 아닌 조건 안에 있습니다(폰까지 닿을 수 있음): ' + b.cond);
    return { min: +m[1], rules: rules(b.body) };
  });
})();
const FIT_RULES = FITS.flatMap((f) => f.rules.map((r) => Object.assign({ min: f.min }, r)));
/* 폰 머리줄 — 줄이 접히는 구간(.pbar{flex-wrap:wrap}). 맞춤은 여기에 닿지 않는다 */
const PHONE = (() => {
  const bs = BLOCKS.filter((b) => rules(b.body).some((r) => r.sel === '.pbar' && /flex-wrap:\s*wrap/.test(r.body)));
  assert.equal(bs.length, 1, '폰 머리줄이 줄을 접는 @media(.pbar{flex-wrap:wrap})를 하나로 못 찾았습니다');
  const m = bs[0].cond.replace(/\s+/g, '').match(/^\(max-width:(\d+)px\)$/);
  assert.ok(m, '폰 머리줄 구간의 조건을 못 읽었습니다: ' + bs[0].cond);
  return { max: +m[1] };
})();
/* 맞춤 규칙을 «단계 · 나머지 고르개»로 가른다 — .pbar[data-fit~="3"] .nm → { step:'3', rest:'.pbar .nm' } */
function fitParts(sel) {
  const m = sel.match(/^\.pbar\[data-fit~="([^"]+)"\]\s*(.*)$/);
  return m ? { step: m[1], rest: ('.pbar ' + m[2]).trim() } : null;
}
const isHide = (r) => declSet(r.body) === 'display:none';
/* 빈 자리 밀개 — 머리줄을 오른쪽으로 미는 margin-right:auto 를 가진 기본 칸(지금은 브랜드 .nm) */
const SPRINGS = rules(OUTSIDE).filter((r) => /^\.pbar /.test(r.sel) && /margin-right:\s*auto/.test(r.body)).map((r) => r.sel);
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
test('①★ 맞춤 단계 CSS 는 폰보다 넓은 구간에만 — 줄이 접히는 폰 머리줄은 안 바꾼다 · JS 도 같은 경계 · 태블릿에 닿는 규칙은 감추기·대역 꺼내기·밀개 넘겨받기만', () => {
  assert.deepEqual(rules(OUTSIDE).filter((r) => /\[data-fit/.test(r.sel)).map((r) => r.sel), [],
    '★ 맞춤 단계 CSS 가 @media 밖에 있습니다 — 폰 머리줄까지 바뀝니다');
  const 폰에닿음 = FITS.filter((f) => f.min <= PHONE.max).map((f) => f.min);
  assert.deepEqual(폰에닿음, [], '★ 맞춤 구간(min-width)이 폰 머리줄 구간(max-width:' + PHONE.max + 'px)까지 닿습니다 — 폰 411·360px 모양이 바뀝니다');
  const q = FIT_JS.match(/matchMedia\('\(min-width:\s*(\d+)px\)'\)/);
  assert.ok(q, '★ 맞춤 함수가 폭 판정을 matchMedia(min-width) 로 하지 않습니다');
  assert.equal(+q[1], PHONE.max + 1, '★ 맞춤 함수의 경계(' + q[1] + 'px)가 폰 머리줄 구간(≤' + PHONE.max + 'px) 바로 위가 아닙니다 — 폰에서 재거나, 태블릿 일부를 빠뜨립니다');
  assert.ok(FITS.every((f) => f.min >= +q[1]), '★ CSS 맞춤 구간이 JS 가 재는 폭보다 좁은 데까지 닿습니다 — 남은 data-fit 가 그 폭에 먹습니다');
  assert.ok(FITS.some((f) => f.min === TAB.max + 1),
    '★ PC 맞춤 구간(min-width:' + (TAB.max + 1) + 'px)이 없습니다 — 태블릿 머리줄 구간(max-width:' + TAB.max + 'px)과 맞물리는 PC 단계(머리줄 단추 접기)를 둘 곳');
  assert.ok(FIT_RULES.length > 0 && FIT_RULES.every((r) => /^\.pbar\[data-fit~="[^"]+"\]/.test(r.sel)),
    '맞춤 구간 안 규칙은 모두 .pbar[data-fit~="단계"] 로 시작해야 합니다 — 단계를 안 탄 규칙은 넘치지 않는 화면 모양까지 바꿉니다');
  /* 태블릿에 닿아도 되는 것: ㉠ 감추기
     ㉡ 평소(맞춤 밖 CSS) display:none 으로 감춰 둔 대역을 display 값 하나로 꺼내기 — 내 메뉴 안 로그아웃(폰이 쓰는 자리)·건의하기 💬 대역
     ㉢ 같은 단계에서 접은 밀개 칸(.nm)의 margin-right:auto 를 다른 칸이 넘겨받기(안 그러면 단추들이 왼쪽으로 쏠린다) */
  const 평소감춤 = rules(OUTSIDE).filter(isHide).map((r) => r.sel);
  const 대역꺼냄 = (r) => {
    const p = fitParts(r.sel), d = declSet(r.body);
    if (!p || !/^display:[a-z-]+$/.test(d) || d === 'display:none') return false;
    return 평소감춤.some((b) => p.rest === b || p.rest.endsWith(' ' + b));
  };
  const 밀개넘김 = (r) => {
    const p = fitParts(r.sel);
    if (!p || declSet(r.body) !== 'margin-right:auto') return false;
    return FIT_RULES.some((h) => { const q = fitParts(h.sel); return q && q.step === p.step && isHide(h) && SPRINGS.includes(q.rest); });
  };
  assert.ok(SPRINGS.length > 0, '머리줄 빈 자리 밀개(.pbar … {margin-right:auto})를 못 찾았습니다');
  const 태블릿덮음 = FIT_RULES.filter((r) => r.min <= TAB.max && !isHide(r) && !대역꺼냄(r) && !밀개넘김(r));
  assert.deepEqual(태블릿덮음.map((r) => r.sel + '{' + r.body.trim() + '}'), [],
    '★ 태블릿까지 닿는 맞춤 규칙이 감추기·평소 감춰 둔 대역 꺼내기·밀개 넘겨받기 말고 다른 값을 덮습니다 — 태블릿은 이미 틈·여백이 더 좁아 PC 값을 덮으면 오히려 넓어집니다');
});

test('②★ 마지막 단계의 머리줄 단추 모양은 태블릿과 «같다» — 두 벌이 갈라지지 않게', () => {
  const last = STEPS[STEPS.length - 1].split(/\s+/).filter(Boolean);
  assert.ok(last.length > 0, '맞춤 단계가 하나도 없습니다');
  assert.ok(TAB.rules.length > 0, '태블릿 머리줄 단추 규칙을 못 읽었습니다');
  const 빠짐 = TAB.rules.filter((t) => !FIT_RULES.some((f) => {
    const m = f.sel.match(/^\.pbar\[data-fit~="([^"]+)"\] (.+)$/);
    return m && last.includes(m[1]) && ('.pbar ' + m[2]) === t.sel && declSet(f.body) === declSet(t.body);
  }));
  assert.deepEqual(빠짐.map((t) => t.sel + '{' + t.body.trim() + '}'), [],
    '★ 태블릿(≤' + TAB.max + 'px) 머리줄 단추 규칙과 같은 것이 마지막 맞춤 단계에 없습니다(또는 값이 다릅니다) — 한쪽만 고치면 PC 를 좁혔을 때 모양이 갈라집니다');
});

test('③★ 접는 것은 «다른 데 같은 말이 있는 글자»뿐 — 내 메뉴·이름·건의하기·챗봇 단추·금액·로고는 안 감추고, 로그아웃은 내 메뉴 안 것이 보일 때만 빠진다', () => {
  const 남길것 = ['#meBtn', '.pmeta', '#userName', '#sgFab', '#chatFab', '.hd-app', '.hd-ico', '#meMoneyAmt', '.me-money b', '.logo'];
  const 로그아웃 = ['#logoutBtn', '.logout'];
  const 꼬리 = (s) => { const parts = s.split(' '); return [parts[parts.length - 1], parts.slice(-2).join(' ')]; };
  const 감춤규칙 = FIT_RULES.filter((r) => /display:\s*none/.test(r.body));
  const 감춤 = 감춤규칙.map((r) => r.sel);
  assert.ok(감춤.length > 0, '맞춤 단계가 아무것도 접지 않습니다');
  const 잘못 = 감춤.filter((s) => 꼬리(s).some((t) => 남길것.includes(t)));
  assert.deepEqual(잘못, [], '★ 맞춤 단계가 눌러야 하는 것·읽어야 하는 것을 감춥니다 — 글자만 접으세요');
  /* 로그아웃 — 머리줄에서 빼는 단계는 «같은 단계»에서 내 메뉴 맨 아래 로그아웃(#meLogout)을 보여야 한다(폰과 같은 자리) */
  const 로그아웃감춤 = 감춤규칙.filter((r) => 꼬리(r.sel).some((t) => 로그아웃.includes(t)));
  const 메뉴로안감 = 로그아웃감춤.filter((r) => {
    const p = fitParts(r.sel);
    return !p || !FIT_RULES.some((q) => { const qp = fitParts(q.sel); return qp && qp.step === p.step && /\.me-menu \.me-logout$/.test(qp.rest) && declSet(q.body) === 'display:block'; });
  });
  assert.deepEqual(메뉴로안감.map((r) => r.sel), [],
    '★ 머리줄 로그아웃을 감추는데 같은 단계에서 내 메뉴 안 로그아웃을 보이지 않습니다 — 로그아웃을 누를 곳이 사라집니다');
  if (로그아웃감춤.length) {
    assert.match(ENTER, /<button[^>]*class="logout me-logout"[^>]*id="meLogout"/, '★ 내 메뉴 안 로그아웃(#meLogout)이 없습니다');
    assert.match(ENTER, /\$\('meLogout'\)[\s\S]{0,120}\$\('logoutBtn'\)\.click\(\)/, '★ 내 메뉴 안 로그아웃이 머리줄 로그아웃과 같은 일을 하지 않습니다');
  }
  /* 이름 글자를 접으면 이름은 «접근성 이름·말풍선»에 남아야 한다 */
  if (감춤.some((s) => /#chatFab \.chat-lb$/.test(s))) {
    assert.match(ENTER, /<button id="chatFab"[^>]*aria-label="[^"]+"/, '★ 챗봇 글자를 접는데 단추에 aria-label 이 없습니다');
  }
  /* 건의하기 글자를 접으면 — «💬 건의하기» 한 흐름(.sg-tx)을 감추고 «같은 단계»에서 이름 있는 💬 대역(.sg-ico)을 꺼낸다.
     ⚠ 글자만 span 으로 쪼개 접지 않는다 — 글자 흐름이 끊겨 넘치지 않는 기본 화면(411·360·768px)까지 몇 점씩 바뀌었다(2026-11-28 갈무리 대조) */
  const 건의감춤 = 감춤규칙.filter((r) => /#sgFab \.sg-tx$/.test(r.sel));
  if (건의감춤.length) {
    const btn = ENTER.match(/<button id="sgFab"[^>]*>([\s\S]*?)<\/button>/);
    assert.ok(btn, '건의하기 단추(#sgFab)를 못 찾았습니다');
    const tx = btn[1].match(/<span class="sg-tx">([\s\S]*?)<\/span>/);
    assert.ok(tx && /💬/.test(tx[1]) && /건의하기/.test(tx[1]), '★ 건의하기 글자 칸(.sg-tx)에 «💬 건의하기»가 다 들어 있지 않습니다');
    assert.ok(!/</.test(tx[1]), '★ «💬 건의하기» 칸 안을 다시 쪼갰습니다 — 글자 흐름이 끊겨 넘치지 않는 화면 모양까지 바뀝니다');
    assert.match(btn[1], /<span class="sg-ico"[^>]*aria-label="[^"]+"[^>]*>💬<\/span>/,
      '★ 건의하기 글자를 접는데 이름(aria-label) 있는 💬 대역(.sg-ico)이 없습니다 — 💬 만 읽힙니다');
    const 대역없음 = 건의감춤.filter((r) => {
      const p = fitParts(r.sel);
      return !FIT_RULES.some((q) => { const qp = fitParts(q.sel); return qp && qp.step === p.step && /#sgFab \.sg-ico$/.test(qp.rest) && /^display:[a-z-]+$/.test(declSet(q.body)) && !isHide(q); });
    });
    assert.deepEqual(대역없음.map((r) => r.sel), [], '★ 건의하기 글자를 감추는 단계가 💬 대역을 꺼내지 않습니다 — 단추가 빈 알약이 됩니다');
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
  const PC = TAB.max + 400;
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
  /* 태블릿도 넘치면 접는다(768px 연결 끊김 + 사용액) */
  const TB = TAB.max - 100;
  assert.equal(돌리기({ vw: TB, rightBy: by(TB + 30, TB - E - 1) }).fit, STEPS[1], '★ 태블릿에서 머리줄이 넘치는데 접지 않습니다');
  assert.equal(돌리기({ vw: TB, rightBy: by(TB - E - 1) }).fit, '', '★ 태블릿에서 넘치지 않는데 접습니다 — 태블릿 기본 모양이 바뀝니다');
  /* 폰 — 맞춤을 지우고 손대지 않는다(폰 머리줄은 줄이 접힌다) */
  assert.equal(돌리기({ vw: PHONE.max, rightBy: by(PHONE.max * 3), start: STEPS[1] }).fit, '', '★ 폰 폭에서 맞춤 단계가 남습니다');
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

test('⑦★ 접는 차례(대표 2026-11-28 후보 2) — 단계는 앞 단계를 다 품고 · 브랜드 글자가 건의하기 글자보다 먼저 · 로그아웃은 맨 마지막 단계에서만', () => {
  /* 단계는 «하나씩 더» 접는다 — 뒤 단계가 앞 단계에서 접은 것을 다시 펴면 재기(가장 덜 접는 단계부터)가 엉킨다 */
  for (let i = 1; i < STEPS.length; i++) {
    const prev = STEPS[i - 1].split(/\s+/).filter(Boolean), cur = STEPS[i].split(/\s+/).filter(Boolean);
    assert.ok(prev.every((t) => cur.includes(t)) && cur.length > prev.length,
      '★ 맞춤 단계 «' + STEPS[i] + '» 가 앞 단계 «' + STEPS[i - 1] + '» 를 다 품고 하나 이상 더 접지 않습니다');
  }
  const 단계 = (re) => {
    const r = FIT_RULES.find((x) => { const p = fitParts(x.sel); return p && isHide(x) && re.test(p.rest); });
    return r ? fitParts(r.sel).step : null;
  };
  const 처음 = (tok) => STEPS.findIndex((s) => s.split(/\s+/).includes(tok));
  const 브랜드 = 단계(/^\.pbar \.nm$/), 건의 = 단계(/#sgFab \.sg-tx$/), 로그아웃 = 단계(/#logoutBtn$/);
  assert.ok(브랜드 && 건의 && 로그아웃,
    '★ 600·521px 을 위한 접기(브랜드 글자 · 건의하기 글자 · 로그아웃을 내 메뉴로)가 빠졌습니다 — 작은 태블릿·나눈 창에서 로그아웃·내 메뉴가 다시 화면 밖으로 나갑니다');
  assert.ok(처음(브랜드) > 0 && 처음(건의) > 0 && 처음(로그아웃) > 0, '★ 접기 단계가 맞춤 단계 목록(PBAR_FIT_STEPS)에 없습니다');
  assert.ok(처음(브랜드) < 처음(건의), '★ 건의하기 글자를 브랜드 글자보다 먼저 접습니다 — 기능 없는 글자(브랜드)부터 접기로 했습니다(대표 2026-11-28 후보 2)');
  assert.ok(처음(건의) < 처음(로그아웃), '★ 로그아웃을 건의하기 글자보다 먼저 내 메뉴로 넣습니다 — 로그아웃은 맨 나중(대표 2026-11-28 후보 2)');
  assert.equal(처음(로그아웃), STEPS.length - 1, '★ 로그아웃이 마지막 단계가 아닌데 머리줄에서 빠집니다 — PC·태블릿은 로그아웃이 머리줄 맨 오른쪽에 늘 보이는 것이 먼저입니다');
});
