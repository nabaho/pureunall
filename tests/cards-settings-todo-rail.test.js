/* 🔔 지금 손볼 것 — 환경설정 맨 위 띠 (대표 결정 2026-09-05 「나」= 목업 ㉯)

   ■ 왜 만들었나
   서른 개 단추 가운데 «할 일»은 정리 탭의 여덟뿐인데, 그 탭을 눌러야만 숫자가 보였다.
   대표 화면에는 이미 105묶음·66건·14장·41건이 쌓여 있었는데, 환경설정을 열었을 때
   첫 화면(데이터)에서는 아무것도 안 보였다 — 가장 중요한 숫자가 가장 깊이 숨어 있었다.

   ★ 못 박는 것
     ① 숫자가 «있는 것만» 띠에 오른다 — 「이상 없음」까지 올리면 띠가 배경이 된다
     ② 할 일이 없으면 «그렇게 말한다» — 띠가 그냥 사라지면 고장인지 알 수 없다
     ③ 탭을 옮길 때마다 다시 안 센다 · 정리한 «뒤»에는 반드시 다시 센다
     ④ 하나가 터져도 나머지는 센다
     ⑤ 띠에서 «지우지 않는다» — 정리 탭까지만 데려간다

     node --test tests/cards-settings-todo-rail.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

function fnBody(name) {
  const i = SRC.search(new RegExp('(?:^|\\n)(?:async )?function ' + name + '\\('));
  assert.ok(i >= 0, name + ' 을 찾지 못했습니다');
  const open = SRC.indexOf('{', i);
  let d = 0;
  for (let k = open; k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); }
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}
const bare = s => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
function decls(selector) {
  const i = SRC.indexOf('\n' + selector + '{');
  assert.ok(i > 0, selector + ' 규칙을 못 찾았다');
  const body = SRC.slice(i + selector.length + 2, SRC.indexOf('}', i));
  const out = {};
  body.split(';').forEach(d => { const k = d.indexOf(':'); if (k > 0) out[d.slice(0, k).trim()] = d.slice(k + 1).trim(); });
  return out;
}

/* 알맹이를 통째로 떠서 «돌린다» — 셈만 손으로 쥐여준다 */
const N = (v) => ({ length: v });
function load(counts, extra) {
  const c = Object.assign({ dup: 0, sim: 0, empty: 0, moji: 0, mixed: 0, name: 0, rules: 0, trash: 0 }, counts || {});
  const trash = {};
  for (let i = 0; i < c.trash; i++) trash['t' + i] = {};
  const ctx = Object.assign({
    console,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g,
      c2 => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c2])),
    state: { tab: 'card', trash: trash, setSub: '' },
    /* ⚠ setSub 는 이 토막 «밖»에 있다(21592줄). 흉내만 내되 «무엇을 달라고 했는지»를
         받아 적는다 — 검사가 보는 것은 todoGo 가 고른 이름이다. */
    setSub: v => { ctx._sub = v; ctx.state.setSub = v || ''; ctx.renderSettingsPage(); },
    renderSettingsPage: () => { ctx._drew = (ctx._drew || 0) + 1; },
    findDupGroups: () => { ctx._ran = (ctx._ran || 0) + 1; return N(c.dup); },
    findSimilarGroups: () => N(c.sim),
    emptyTargets: () => N(c.empty),
    mojibakeTargets: () => N(c.moji),
    mixedFixList: () => N(c.mixed),
    /* 2026-09-18 — 휴지통은 «열 때» 읽으므로 건수도 이 함수로 묻는다.
       여기서는 이미 읽어 둔 셈치고 실제 건수를 돌려준다(늦게 읽기는 cards-trash-lazy 가 본다). */
    trashCount: () => Object.keys(trash).length,
    /* 📋 등록증 → 기업상세 (2026-09-18) — 여기서는 셀 것이 없다 */
    bizFillCount: () => 0,
    nameFixList: () => N(c.name),
    classifyPlan: () => ({ targetN: c.rules })
  }, extra || {});
  vm.createContext(ctx);
  const a = SRC.indexOf('let _todoMemo = null;');
  /* ⚠ 2026-09-05: 탭을 없애며 「const SET_TABS=[」 가 사라졌다 — 다음 덩이의 머리로 자른다 */
  const b = SRC.indexOf('/* ══════ ⚙️ 환경설정 — 왼쪽 메뉴');
  assert.ok(a > 0 && b > a, '알맹이를 못 찾았다');
  /* ⚠ 최상위 let/const 는 컨텍스트 값이 되지 않는다 — var 로 바꿔 실어야 꺼내 본다 */
  vm.runInContext(SRC.slice(a, b).replace(/\nlet /g, '\nvar ').replace(/\nconst /g, '\nvar '), ctx);
  return ctx;
}

/* ── ① 숫자가 있는 것만 ── */

test('★ 사업자 탭에서는 명함에만 있는 갈래를 «안 센다»', () => {
  const c = load({ sim: 105, moji: 7 }, { state: { tab: 'biz', trash: {}, setSub: '' } });
  assert.equal(c.todoList().length, 0, '★ 사업자 탭에 명함용 셈이 올라왔다');
});

/* ── ② 없으면 없다고 말한다 ── */

test('★★ 탭을 옮길 때마다 다시 «안» 센다 — 한 번 세고 기억한다', () => {
  const c = load({ sim: 3 });
  c.todoList(); c.todoList(); c.todoAll();
  assert.equal(c._ran, 1, '★ ' + c._ran + '번 셌다 — 탭을 누를 때마다 명함 6,306장을 훑는다');
});

test('★★ 정리한 «뒤»에는 다시 센다 — 안 그러면 방금 치운 것이 그대로 떠 있다', () => {
  const c = load({ sim: 3 });
  c.todoList();
  c.todoBust();
  c.todoList();
  assert.equal(c._ran, 2);
  /* 버리는 자리가 «정리하는 모든 길»에 걸려 있어야 한다 — _refresh 한 곳이면 된다 */
  assert.match(bare(fnBody('_refresh')), /todoBust\(\)/,
    '★ 정리 뒤에 안 버리면 띠가 거짓말을 한다');
});

/* ── ④ 하나가 터져도 ── */

test('★★ 하나가 터져도 나머지는 센다 — 띠가 통째로 사라지면 할 일이 없는 줄 안다', () => {
  const c = load({ name: 66, trash: 41 }, {
    findSimilarGroups: () => { throw new Error('일부러 터뜨림'); }
  });
  const rows = c.todoList();
  assert.equal(rows.map(r => r.label).join(','), '이름 칸에 회사명,휴지통');
});

/* ── ⑤ 띠에서 지우지 않는다 ── */

test('★★ 띠는 «데려가기만» 한다 — 지우는 일을 띠에서 바로 실행하지 않는다', () => {
  /* 2026-09-29: 띠를 걷었다 — 할 일은 환경설정 «정리» 한 곳이다. 그 줄도 데려가기만 한다 */
  const rail = bare(fnBody('renderSettingsPage'));
  assert.ok(!/cleanEmpty\(|openMojibakeCleanup\(|Store\.(del|hardDel)/.test(rail),
    '★ 정리 줄에서 바로 지운다 — 줄은 데려가기만 한다');
  assert.match(rail, /todoGo\('/, '누르면 갈 곳이 없다');
});

test('★ 누르면 «그 화면»을 편다 — 눌러 들어간 것과 같은 자리다', () => {
  const c = load({ sim: 3, trash: 2 });
  c.todoGo('similar');
  assert.equal(c._sub, 'similar', '★ 유사 후보를 눌렀는데 딴 화면을 열었다');
  assert.equal(c.state.setSub, 'similar');
  assert.equal(c._drew, 1, '다시 그리지 않으면 아무 일도 안 일어난 것처럼 보인다');
});

test('★★ 지우는 일(빈 명함·깨진 글자)은 «정리 센터까지만» 데려간다', () => {
  const c = load({ empty: 5, moji: 3 });
  const rows = c.todoList();
  assert.equal(rows.map(r => r.label).join(','), '빈 명함,깨진 글자');
  rows.forEach(r => assert.equal(r.sub, '', r.label + ' 에 제 화면이 생겼다'));
  /* ⚠ 여기가 2026-09-05 에 «구멍»이었다 — 탭이 있던 때는 setTab('clean') 이 받아 줬는데,
       탭을 없애며 setSub(sub||'') 로 두었더니 빈 이름이 목록으로 돌아와 아무 일도
       안 일어난 것처럼 보였다. 제 화면이 없으면 정리 센터로 데려간다. */
  rows.forEach(r => { c._sub = null; c.todoGo(r.sub);
    assert.equal(c._sub, 'clean', '★ ' + r.label + ' 을 눌렀더니 제자리에 머문다'); });
});

/* ── 화면에 붙은 자리 ── */

