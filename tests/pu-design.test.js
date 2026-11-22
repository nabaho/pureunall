/* 공용 디자인(css/pu-design.css) — 제미나이 판 «모양 값»을 «켠 앱에만», «값만» (대표 「추천대로 시작」 2026-11-19)

   ■ 왜
     데이터관리 목업(제미나이 판)의 모양을 다른 앱에 넓힌다. 계획서:
     docs/superpowers/plans/2026-11-19-제미나이-디자인-다른앱-계획서.md
     2026-11-15 푸른 캘린더를 «구글처럼» 바꾸며 탭·거르개를 숨겼다가 대표가 «다 사라졌다»고 해 되돌렸다.
     디자인 일은 «값만» 바꾸고, 켜지 않은 앱은 한 점도 안 바뀌어야 한다.

   ■ 지키는 규칙
     ① 모든 규칙은 body.pu-design 아래에만 먹는다(:where 로 감싼 앞머리) — 켜지 않은 앱은 안 바뀐다
     ② 변수는 --pu- 를 붙인다 — 앱마다 같은 이름(--acc·--line) 변수가 따로 있다
     ③ 색은 저장소 팔레트(5계열 27색 + 흰색) 안에서만, 바깥 그림·글꼴·@import 없음
     ④ 숨기거나 옮기지 않는다 — display·visibility·order·position 을 쓰지 않는다(앱 안 디자인 덩어리도 같다)
     ⑤ 입력칸 글자 크기는 건드리지 않는다 — 폰 16px 규칙은 앱이 지킨다
     ⑥ 켠 앱은 파일을 자기 <style> «뒤»에 싣고 <body> 에 pu-design 을 단다 — 둘은 함께 다닌다
     ⑥-2 기기 «어두운 모드»를 따르는 앱은 pu-dark-auto 도 단다(안 달면 어두운 카드 위에 밝은 판 값이 얹힌다) — 거꾸로도
     ⑦ 글자 대비 — 파랑 위 흰 글자, 바탕 위 회색 글자, 옅은 파랑 위 짙은 파랑이 4.5:1 이상 (어두운 판도 같다 ⑦-2)
     ⑧ 켜기 전·뒤 대조 도구(tools/phone-audit/design-diff.js)가 «줄어든 것»과 «새로 화면 밖»을 잡는다
   실행: node --test tests/pu-design.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PALETTE, norm, contrast } = require('./lib-palette');

const ROOT = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const CSS_FILE = 'css/pu-design.css';
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
/* 검정은 어두운 판 바탕(앱의 어두운 모드 바탕과 같은 색)으로만 쓴다 — 저장소 색 검사(color-palette-apps)도 검정을 받는다 */
const ALLOWED = new Set([].concat(...Object.values(PALETTE), '#ffffff', '#000000'));
/* 어두운 판 덩어리(@media (prefers-color-scheme:dark) 안의 body.pu-design.pu-dark-auto 값) */
function darkBlock(css) {
  const m = noComments(css).match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:where\(body\.pu-design\.pu-dark-auto\)\s*\{([^{}]*)\}/);
  return m ? m[1] : '';
}
/* 기기 어두운 모드를 «자기 스타일»에서 따르는 앱인가 — 공용 파일을 실은 줄은 빼고 본다 */
const followsDark = (h) => /prefers-color-scheme:\s*dark/.test(h.slice(0, Math.max(0, h.indexOf('</head>'))));

/* 앞머리 묶음을 «괄호 밖 쉼표»로만 나눈다 — :where(button,a[href]) 안의 쉼표는 나누지 않는다 */
function splitTop(sel) {
  const out = []; let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
/* 규칙의 앞머리들(@media 줄은 빼고) */
function selectorsOf(css) {
  return [...noComments(css).matchAll(/([^{}]+)\{/g)]
    .map(m => m[1].trim()).filter(s => s && !s.startsWith('@'))
    .flatMap(splitTop);
}
/* 규칙 몸통들 */
function bodiesOf(css) {
  return [...noComments(css).matchAll(/\{([^{}]*)\}/g)].map(m => m[1]);
}
/* 앱 안의 디자인 덩어리(«pu-design 시작» ~ «pu-design 끝») */
function appBlock(html) {
  const a = html.indexOf('pu-design 시작'), b = html.indexOf('pu-design 끝');
  if (a < 0 || b < a) return '';
  return html.slice(html.indexOf('*/', a) + 2, html.lastIndexOf('/*', b));
}
/* 진짜 <body> 태그 — </head> 뒤에서 찾는다(주석·JS 글 속 «<body>» 를 잘못 집지 않게) */
const bodyTag = (h) => (h.slice(Math.max(0, h.indexOf('</head>'))).match(/<body\b[^>]*>/) || [''])[0];
/* 이 파일을 싣는 HTML (저장소 맨 위 폴더) */
const appsUsing = () => fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))
  .filter(f => /<link[^>]+href="css\/pu-design\.css/.test(R(f)));

test('① 모든 규칙은 body.pu-design 아래에서만 먹는다', () => {
  const sels = selectorsOf(R(CSS_FILE));
  assert.ok(sels.length >= 10, '규칙을 못 읽었다');
  /* 화면에서 html 에 data-theme="dark" 를 다는 어두운 판도 body.pu-design 아래다 */
  const bad = sels.filter(s => !s.startsWith(':where(body.pu-design') && !s.startsWith(':where(html[data-theme="dark"] body.pu-design'));
  assert.deepEqual(bad, [], 'body.pu-design 밖에서 먹는 규칙: ' + bad.join(' | '));
});

test('② 공용 파일이 만드는 변수는 모두 --pu- 로 시작한다', () => {
  const defs = [...noComments(R(CSS_FILE)).matchAll(/(?:^|[;{\s])(--[a-z0-9-]+)\s*:/g)].map(m => m[1]);
  assert.ok(defs.length >= 10, '변수를 못 읽었다');
  assert.deepEqual(defs.filter(d => !d.startsWith('--pu-')), []);
});

test('③ 색은 팔레트 안, 바깥 것을 싣지 않는다', () => {
  const css = noComments(R(CSS_FILE));
  const hex = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => norm(m[0]));
  assert.ok(hex.length >= 10);
  assert.deepEqual([...new Set(hex.filter(h => !ALLOWED.has(h)))], [], '팔레트 밖 색');
  /* 반투명 그림자도 팔레트 색에서 빌린다 */
  const rgba = [...css.matchAll(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)]
    .map(m => '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join(''));
  assert.deepEqual([...new Set(rgba.filter(h => !ALLOWED.has(h)))], [], '팔레트 밖 반투명 색');
  assert.ok(!/url\(|@import/i.test(css), '바깥 그림·글꼴·@import 를 싣지 않는다');
});

test('④ 숨기거나 옮기지 않는다 — 공용 파일과 앱 안 디자인 덩어리 모두', () => {
  const HIDE = /(?:^|;)\s*(display|visibility|order|position)\s*:/;
  const blocks = [[CSS_FILE, R(CSS_FILE)]];
  appsUsing().forEach(f => { const b = appBlock(R(f)); if (b) blocks.push([f + ' 디자인 덩어리', b]); });
  blocks.forEach(([name, css]) => {
    const bad = bodiesOf(css).filter(b => HIDE.test(b));
    assert.deepEqual(bad, [], name + ' 에 숨기기·옮기기: ' + bad.join(' | '));
  });
});

test('④-2 앱 안 디자인 덩어리도 body.pu-design 아래에서만 먹는다', () => {
  const apps = appsUsing().filter(f => appBlock(R(f)));
  assert.ok(apps.length >= 1, '앱 안 디자인 덩어리를 하나도 못 읽었다 — 표지(«pu-design 시작»·«pu-design 끝»)가 바뀌었나');
  apps.forEach(f => {
    assert.ok(selectorsOf(appBlock(R(f))).length >= 3, f + ': 덩어리를 못 읽었다');
    const bad = selectorsOf(appBlock(R(f))).filter(s => !s.startsWith(':where(body.pu-design'));
    assert.deepEqual(bad, [], f + ': ' + bad.join(' | '));
  });
});

test('⑤ 입력칸 글자 크기는 건드리지 않는다 — 공용 파일과 앱 안 디자인 덩어리 모두', () => {
  const blocks = [[CSS_FILE, R(CSS_FILE)]];
  appsUsing().forEach(f => { const b = appBlock(R(f)); if (b) blocks.push([f + ' 디자인 덩어리', b]); });
  blocks.forEach(([name, src]) => {
    const bad = [...noComments(src).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(m => /\b(input|select|textarea)\b/.test(m[1]) && /font-size\s*:/.test(m[2]))
      .map(m => m[1].trim());
    assert.deepEqual(bad, [], name);
  });
});

test('⑥ 켠 앱 — 자기 <style> 뒤에 싣고 <body> 에 pu-design 을 단다 (둘은 함께)', () => {
  const using = appsUsing();
  assert.ok(using.length >= 1, '켠 앱이 하나도 없다');
  using.forEach(f => {
    const h = R(f);
    const link = h.search(/<link[^>]+href="css\/pu-design\.css/);
    /* <head> 안의 «마지막» <style> 뒤 — 앱 <style> 이 여럿이어도 모두 뒤에 와야 같은 세기에서 이긴다 */
    const lastStyleEnd = h.slice(0, h.indexOf('</head>')).lastIndexOf('</style>');
    assert.ok(lastStyleEnd > 0 && link > lastStyleEnd, f + ': 자기 <style> 뒤에 실어야 같은 세기에서 이긴다');
    assert.ok(link < h.indexOf('</head>'), f + ': <head> 안에 싣는다');
    const body = bodyTag(h);
    assert.match(body, /class="[^"]*\bpu-design\b/, f + ': <body> 에 pu-design 이 없다 — 실어도 안 먹는다');
  });
  /* 거꾸로 — <body> 에만 달고 파일을 안 실은 앱 */
  fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).forEach(f => {
    const body = bodyTag(R(f));
    if (/\bpu-design\b/.test(body)) assert.ok(using.includes(f), f + ': pu-design 을 달았는데 css/pu-design.css 를 안 싣는다');
  });
});

test('⑥-2 기기 어두운 모드를 따르는 켠 앱은 pu-dark-auto 를 단다 — 어두운 모드가 없는 앱은 안 단다', () => {
  assert.ok(darkBlock(R(CSS_FILE)), '공용 파일에 어두운 판 덩어리가 없다');
  appsUsing().forEach(f => {
    const h = R(f), body = bodyTag(h);
    const dark = /\bpu-dark-auto\b/.test(body);
    if (followsDark(h)) assert.ok(dark, f + ': 기기 어두운 모드를 따르는데 pu-dark-auto 가 없다 — 어두운 카드 위에 흰 숫자 카드·흐린 글자가 얹힌다');
    else assert.ok(!dark, f + ': 어두운 모드가 없는데 pu-dark-auto 를 달았다 — 밝은 화면에 어두운 값만 얹힌다');
  });
});

test('⑦ 글자 대비 4.5:1 이상 — 파랑 위 흰 글자 · 바탕 위 회색 · 옅은 파랑 위 짙은 파랑', () => {
  const css = noComments(R(CSS_FILE));
  const v = (name) => { const m = css.match(new RegExp(name + '\\s*:\\s*(#[0-9a-fA-F]{3,6})\\b')); assert.ok(m, name + ' 없음'); return m[1]; };
  [['#ffffff', v('--pu-acc')], ['#ffffff', v('--pu-acc2')], [v('--pu-sub'), v('--pu-bg')], [v('--pu-acc-ink'), v('--pu-acc-soft')],
   [v('--pu-ink'), v('--pu-card')], [v('--pu-warn'), v('--pu-warn-bg')], [v('--pu-dgi'), v('--pu-dg-bg')], [v('--pu-ok'), v('--pu-ok-bg')]]
    .forEach(([fg, bg]) => assert.ok(contrast(fg, bg) >= 4.5, fg + ' / ' + bg + ' 대비 ' + contrast(fg, bg).toFixed(2)));
});

test('⑦-2 어두운 판도 글자 대비 4.5:1 이상 — 바뀐 값은 어두운 판 값으로, 안 바뀐 값은 밝은 판 값으로 본다', () => {
  const css = noComments(R(CSS_FILE));
  const dark = darkBlock(R(CSS_FILE));
  assert.ok(dark, '어두운 판 덩어리를 못 읽었다');
  /* 화면에서 다는 data-theme="dark" 길도 기기 설정 길과 값이 같아야 한다 — 한쪽만 고치면 두 어두운 판이 달라진다 */
  const byAttr = (css.match(/:where\(html\[data-theme="dark"\] body\.pu-design\.pu-dark-auto\)\s*\{([^{}]*)\}/) || [])[1];
  const vars = (s) => [...String(s).matchAll(/(--pu-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(m => m[1] + ':' + m[2].trim()).sort();
  assert.ok(byAttr, 'data-theme="dark" 어두운 판 덩어리가 없다');
  assert.deepEqual(vars(byAttr), vars(dark), '두 어두운 판 값이 다르다');
  const pick = (src, name) => { const m = src.match(new RegExp(name + '\\s*:\\s*(#[0-9a-fA-F]{3,6})\\b')); return m && m[1]; };
  const v = (name) => { const c = pick(dark, name) || pick(css, name); assert.ok(c, name + ' 없음'); return c; };
  /* 어두운 판에서 «글자»가 되는 값은 모두 바뀌어 있어야 한다 — 밝은 판 짙은 글자가 검정 위에 남으면 안 보인다 */
  ['--pu-ink', '--pu-sub', '--pu-acc-ink', '--pu-card', '--pu-bg', '--pu-line'].forEach(n => assert.ok(pick(dark, n), '어두운 판에 ' + n + ' 가 없다'));
  [['#ffffff', v('--pu-acc')], ['#ffffff', v('--pu-acc2')], [v('--pu-sub'), v('--pu-bg')], [v('--pu-sub'), v('--pu-card')],
   [v('--pu-acc-ink'), v('--pu-acc-soft')], [v('--pu-ink'), v('--pu-card')], [v('--pu-ink'), v('--pu-bg')],
   [v('--pu-warn'), v('--pu-warn-bg')], [v('--pu-dgi'), v('--pu-dg-bg')], [v('--pu-ok'), v('--pu-ok-bg')]]
    .forEach(([fg, bg]) => assert.ok(contrast(fg, bg) >= 4.5, '어두운 판 ' + fg + ' / ' + bg + ' 대비 ' + contrast(fg, bg).toFixed(2)));
});

test('⑧ 켜기 전·뒤 대조 — 줄어든 것과 새로 화면 밖으로 나간 것만 잡는다', () => {
  const { compare } = require('../tools/phone-audit/design-diff.js');
  const before = { seen: { 'button:저장': 2, 'th:이름': 1, 'button:새로고침': 1 }, off: {} };
  const same = compare(before, { seen: { 'button:저장': 2, 'th:이름': 1, 'button:새로고침': 1 }, off: {} });
  assert.deepEqual([same.lost.length, same.newOff.length], [0, 0]);
  const hid = compare(before, { seen: { 'button:저장': 1, 'th:이름': 1 }, off: {} });
  assert.deepEqual(hid.lost.map(x => x.key).sort(), ['button:새로고침', 'button:저장']);
  const pushed = compare(before, { seen: before.seen, off: { 'button:저장': 1 } });
  assert.deepEqual(pushed.newOff.map(x => x.key), ['button:저장']);
  /* 늘어난 것은 문제 삼지 않는다(값만 바꿔도 접힌 글이 펴질 수 있다) */
  const more = compare(before, { seen: Object.assign({ 'button:새것': 1 }, before.seen), off: {} });
  assert.equal(more.lost.length, 0);
  /* 점검 도구가 이 대조를 실제로 부른다 */
  const run = R('tools/phone-audit/run.mjs');
  assert.match(run, /design-diff\.js/);
  assert.match(run, /__paDesignDiff\(/);
  assert.match(run, /process\.exitCode\s*=\s*1/);
});
