'use strict';
/* 옆줄 숫자와 「전체 삭제」 범위 — «실제로 돌려» 본다 (대표 제보 2026-09-13
   「전체 위촉장 삭제했는데 숫자가 남아 있다」)
   ────────────────────────────────────────────────────────────────────────
   ■ 뿌리 ① 숫자를 그리는 곳(buildNav)과 자료가 바뀌는 곳이 «이어져 있지 않았다».
        buildNav 는 즐겨찾기·그룹 고르기·부팅 때만 불렸다 → 99건을 다 지워도 99 로 보인다.
   ■ 뿌리 ② 「전체 삭제」가 창고를 «통째로» 비웠다.
        ⚠★ 한 창고를 두 화면이 나눠 쓴다 — wiccok 에 위촉장과 표창이, cert 에 자격증과
        수료증이 함께 있고 cfg.filter 로 갈린다. 그래서 위촉장 화면의 전체 삭제가
        **화면에 보이지도 않는 표창까지** 데려갔다.
        내보내기·ZIP 은 filter 를 쓰고 있었는데 정작 «지우는» 쪽만 안 쓰고 있었다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}

/* ══════════ ① 옆줄 숫자 ══════════ */

/* 아주 작은 가짜 DOM — 옆줄 한 덩이만 흉내 낸다 */
function 칸(cls, ds) {
  const el = { className: cls || '', dataset: ds || {}, children: [], textContent: '', title: '',
    parentNode: null,
    querySelector: function (q) {
      const want = q.replace('.', '');
      return this.children.filter(function (c) { return (c.className || '').split(' ').indexOf(want) >= 0; })[0] || null;
    },
    insertBefore: function (n, ref) { n.parentNode = this; this.children.splice(Math.max(0, this.children.indexOf(ref)), 0, n); },
    appendChild: function (n) { n.parentNode = this; this.children.push(n); },
    removeChild: function (n) { const i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); } };
  return el;
}

function 옆줄무대(창고) {
  const 상위 = 칸('g-title top', { g: '경력관리' });
  상위.appendChild(칸('gcnt'));
  const 위촉 = 칸('nav-item sub', { id: 'page-wiccok' }); 위촉.appendChild(칸('star'));
  const 표창 = 칸('nav-item sub', { id: 'page-award' }); 표창.appendChild(칸('star'));
  const 없는것 = 칸('nav-item sub', { id: 'page-resume-hub' }); 없는것.appendChild(칸('star'));
  /* ⚠ 즐겨찾기 줄도 .nav-item 이다 — «펼친 그룹»(.g-open) 안만 칠하는지 함께 본다 */
  const 즐겨 = 칸('nav-item sub', { id: 'page-wiccok' }); 즐겨.appendChild(칸('star'));
  const 펼친칸 = 칸('nav-group g-open', { g: '경력관리' });
  펼친칸.querySelectorAll = function () { return [위촉, 표창, 없는것]; };
  const 즐겨칸 = 칸('nav-group', {});
  즐겨칸.querySelectorAll = function () { return [즐겨]; };
  const nav = {
    querySelectorAll: function (q) {
      if (q.indexOf('.g-title.top') === 0) return [상위];
      if (q.indexOf('.nav-group.g-open') === 0) return [펼친칸];
      return [];
    }
  };
  const ctx = {
    console: { warn: function () {}, log: function () {} },
    document: { getElementById: function (id) { return id === 'nav' ? nav : null; },
                createElement: function () { return 칸(''); } },
    get: function (k) { return (창고[k] || []).slice(); },
    isAwardType: function (t) { return /표창|포상|감사|공로|상장/.test(String(t || '')); },
    CAREER_CFG: {
      wiccok: { store: 'wiccok', filter: function (r) { return !ctx.isAwardType(r.type); } },
      award: { store: 'wiccok', filter: function (r) { return ctx.isAwardType(r.type); } }
    },
    navItemsOf: function () { return [['page-wiccok', '위촉장'], ['page-award', '표창 및 포상']]; },
    setTimeout: setTimeout, clearTimeout: clearTimeout,
  };
  vm.createContext(ctx);
  vm.runInContext([떼기('function navCount(id){'), 떼기('function navGroupCount(g){'),
    떼기('function navPaintCounts(){'), 'var _navCntT=null;', 떼기('function navCountsSoon(){')]
    .join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return { ctx: ctx, 상위: 상위, 위촉: 위촉, 표창: 표창, 없는것: 없는것, 즐겨: 즐겨,
           숫자: function (el) { const s = el.querySelector('.ncnt'); return s ? s.textContent : null; } };
}

const 자료 = { wiccok: [{ id: 'W1', type: '위촉장' }, { id: 'W2', type: '위촉장' }, { id: 'A1', type: '표창' }] };

test('★★ 옆줄 숫자를 자료 그대로 칠한다', () => {
  const m = 옆줄무대(자료);
  vm.runInContext('navPaintCounts()', m.ctx);
  assert.equal(m.숫자(m.위촉), '2');
  assert.equal(m.숫자(m.표창), '1');
  assert.equal(m.상위.querySelector('.gcnt').textContent, '3', '상위는 합계입니다');
});

test('★★★ 전부 지우면 숫자가 «0 으로» 바뀐다 — 대표가 보신 그 증상', () => {
  const 창고 = { wiccok: [{ id: 'W1', type: '위촉장' }, { id: 'W2', type: '위촉장' }] };
  const m = 옆줄무대(창고);
  vm.runInContext('navPaintCounts()', m.ctx);
  assert.equal(m.숫자(m.위촉), '2');
  창고.wiccok = [];                       /* 전체 삭제가 일어난 셈 */
  vm.runInContext('navPaintCounts()', m.ctx);
  assert.equal(m.숫자(m.위촉), '0', '★★★ 다 지웠는데 옛 숫자가 그대로 남습니다');
  assert.equal(m.상위.querySelector('.gcnt').textContent, '0');
});

test('★★ 통이 «없는» 화면에는 숫자를 안 붙인다 — 0 을 그리면 「비었다」로 읽힌다', () => {
  const m = 옆줄무대(자료);
  vm.runInContext('navPaintCounts()', m.ctx);
  assert.equal(m.숫자(m.없는것), null, '★★ 서류 만들기 같은 화면에 0 이 붙었습니다');
});

test('★★ 즐겨찾기 줄에는 숫자를 안 붙인다 — buildNav 도 안 붙인다(둘이 어긋나면 안 된다)', () => {
  const m = 옆줄무대(자료);
  vm.runInContext('navPaintCounts()', m.ctx);
  assert.equal(m.숫자(m.즐겨), null,
    '★★ 즐겨찾기에 숫자가 붙었습니다 — 다시 그리면 사라져 깜빡입니다');
});

test('★★ 셀 수 없게 된 줄은 «옛 숫자를 지운다» — 남겨 두면 거짓말이 굳는다', () => {
  const m = 옆줄무대(자료);
  vm.runInContext('navPaintCounts()', m.ctx);
  assert.equal(m.숫자(m.표창), '1');
  delete m.ctx.CAREER_CFG.award;              /* 더는 셀 수 없는 줄이 되었다 */
  vm.runInContext('navPaintCounts()', m.ctx);
  assert.equal(m.숫자(m.표창), null, '★★ 옛 숫자가 그대로 남습니다 — 지우는 일까지 해야 합니다');
});

test('★ 옆줄이 아직 없을 때 «조용히» 물러선다 — 부팅마다 경고가 쌓이면 안 된다', () => {
  const m = 옆줄무대(자료);
  const 경고 = [];
  m.ctx.console.warn = function () { 경고.push(1); };
  m.ctx.document.getElementById = function () { return null; };
  vm.runInContext('navPaintCounts()', m.ctx);
  /* ⚠ try/catch 가 삼켜 주기는 하지만, 그러면 자료가 바뀔 때마다 콘솔에 경고가 쌓인다
     (set 은 부팅 중에도 여러 번 불린다). 먼저 «없으면 돌아선다». */
  assert.equal(경고.length, 0, '★ 터진 것을 catch 로 덮고 있습니다 — 먼저 돌아서야 합니다');
});

test('★ 여러 번 칠해도 숫자가 겹쳐 늘어나지 않는다', () => {
  const m = 옆줄무대(자료);
  vm.runInContext('navPaintCounts();navPaintCounts();navPaintCounts()', m.ctx);
  assert.equal(m.위촉.children.filter(function (c) { return c.className === 'ncnt'; }).length, 1,
    '★ 칠할 때마다 숫자 칸이 늘어납니다');
  assert.equal(m.숫자(m.위촉), '2');
});

test('★ 옆줄이 아직 없어도 터지지 않는다 — 부팅 때 자료가 먼저 들어온다', () => {
  const m = 옆줄무대(자료);
  m.ctx.document.getElementById = function () { return null; };
  assert.doesNotThrow(function () { vm.runInContext('navPaintCounts()', m.ctx); });
});

test('★★ 한꺼번에 여러 번 바뀌어도 «한 번만» 칠한다 — 스캔·일괄등록에서 느려지면 안 된다', async () => {
  const m = 옆줄무대(자료);
  let n = 0;
  m.ctx.navPaintCounts = function () { n++; };
  vm.runInContext('navCountsSoon();navCountsSoon();navCountsSoon()', m.ctx);
  assert.equal(n, 0, '곧바로 칠하지 않습니다');
  await new Promise(function (r) { setTimeout(r, 350); });
  assert.equal(n, 1, '★★ ' + n + '번 칠했습니다');
});

/* ══════════ ② 「전체 삭제」 범위 ══════════ */

function 삭제무대(창고) {
  const 휴지통 = [], 알림 = [];
  let 물음 = null;
  const ctx = {
    console: { warn: function () {}, log: function () {} },
    get: function (k) { return JSON.parse(JSON.stringify(창고[k] || [])); },
    set: function (k, a) { 창고[k] = JSON.parse(JSON.stringify(a)); },
    toast: function (m) { 알림.push(m); },
    isAwardType: function (t) { return /표창|포상|감사|공로|상장/.test(String(t || '')); },
    TRASH_DAYS: 30,
    kcTrashPut: function (store, page, r) { 휴지통.push({ store: store, page: page, id: r.id }); },
    kcUndoBar: function () {},
    renderCareer: function () {},
    kcAskDelete: function (btn, o, go) { 물음 = o; ctx._진행 = go; },
    CAREER_CFG: {
      wiccok: { store: 'wiccok', filter: function (r) { return !ctx.isAwardType(r.type); } },
      award: { store: 'wiccok', filter: function (r) { return ctx.isAwardType(r.type); } },
      edu: { store: 'edu' }
    },
  };
  vm.createContext(ctx);
  vm.runInContext(떼기('function careerDelAll(').replace(/^(\s*)const /gm, '$1var '), ctx);
  return { ctx: ctx, 창고: 창고, 휴지통: 휴지통, 알림: 알림, 물음: function () { return 물음; } };
}

test('★★★ 위촉장 「전체 삭제」가 표창을 데려가지 않는다 — 보이지도 않는 자료가 사라졌다', () => {
  const 창고 = { wiccok: [
    { id: 'W1', type: '위촉장' }, { id: 'W2', type: '위촉장' },
    { id: 'A1', type: '표창' }, { id: 'A2', type: '포상' }] };
  const m = 삭제무대(창고);
  vm.runInContext('careerDelAll("wiccok", null)', m.ctx);
  assert.match(m.물음().title, /2건/, '★★ 이 화면 건수(2)로 물어야 합니다');
  vm.runInContext('_진행()', m.ctx);
  assert.deepEqual(창고.wiccok.map(function (r) { return r.id; }), ['A1', 'A2'],
    '★★★ 표창까지 지웠습니다 — 화면에 보이지도 않던 자료입니다');
  assert.deepEqual(m.휴지통.map(function (x) { return x.id; }), ['W1', 'W2'],
    '★★ 휴지통에도 이 화면 것만 가야 합니다');
});

test('★★★ 표창 화면에서 지우면 위촉장이 남는다 — 반대쪽도 같다', () => {
  const 창고 = { wiccok: [{ id: 'W1', type: '위촉장' }, { id: 'A1', type: '표창' }] };
  const m = 삭제무대(창고);
  vm.runInContext('careerDelAll("award", null)', m.ctx);
  vm.runInContext('_진행()', m.ctx);
  assert.deepEqual(창고.wiccok.map(function (r) { return r.id; }), ['W1']);
});

test('★★ 같은 통을 쓰는 다른 화면이 있으면 «남는다»고 미리 말한다', () => {
  const 창고 = { wiccok: [{ id: 'W1', type: '위촉장' }, { id: 'A1', type: '표창' }] };
  const m = 삭제무대(창고);
  vm.runInContext('careerDelAll("wiccok", null)', m.ctx);
  assert.match(m.물음().detail, /다른 화면/, '★★ 말 안 하면 「표창도 지워졌나」 걱정합니다');
  assert.match(m.물음().detail, /1건은 그대로/);
});

test('★ 통을 혼자 쓰는 화면은 그대로 다 지운다', () => {
  const 창고 = { edu: [{ id: 'E1' }, { id: 'E2' }] };
  const m = 삭제무대(창고);
  vm.runInContext('careerDelAll("edu", null)', m.ctx);
  vm.runInContext('_진행()', m.ctx);
  assert.deepEqual(창고.edu, []);
  assert.ok(!/다른 화면/.test(m.물음().detail), '남는 것이 없으면 그 말을 안 합니다');
});

test('★ 이 화면에 지울 것이 없으면 «묻지도 않는다» — 옆 화면 것만 있을 때', () => {
  const 창고 = { wiccok: [{ id: 'A1', type: '표창' }] };
  const m = 삭제무대(창고);
  vm.runInContext('careerDelAll("wiccok", null)', m.ctx);
  assert.equal(m.물음(), null, '★ 표창만 있는데 위촉장 전체 삭제를 물었습니다');
  assert.match(m.알림.join(' '), /지울 자료가 없습니다/);
  assert.equal(창고.wiccok.length, 1, '★★ 아무것도 안 지워야 합니다');
});

/* ══════════ 이어져 있나 ══════════ */

test('★★★ 자료가 바뀌는 «한 곳»에서 숫자를 고친다 — 화면마다 부르면 반드시 빠뜨린다', () => {
  const fn = SRC.slice(SRC.indexOf('function set(key,arr){'), SRC.indexOf('function escapeHtml('));
  assert.match(fn, /navCountsSoon\(\)/,
    '★★★ set 에서 안 부르면 어느 길로 지우든 옛 숫자가 남습니다');
});

test('★★ 칠하는 곳은 한 곳이다 — buildNav 가 따로 칠하지 않는다', () => {
  const fn = SRC.slice(SRC.indexOf('function buildNav(){'), SRC.indexOf('function navTile('));
  /* ⚠ 「navPaintCounts」 글자만 찾으면 안 된다 — 주석에도 그 이름이 적혀 있어
     실제로 부르는 줄을 지워도 통과했다(고장넣기로 확인). «부르는 줄»을 짚는다. */
  assert.match(fn, /_safe\(navPaintCounts\)/, '★★ 다 그린 뒤 한 번 «불러» 칠해야 합니다');
  assert.ok(!/\.gcnt'\)\.textContent=/.test(fn), '★ buildNav 가 상위 숫자를 따로 칠합니다');
  assert.ok(!/className='ncnt'/.test(fn), '★ buildNav 가 하위 숫자를 따로 만듭니다');
});

test('★★ 「원본 파일만 전체 삭제」가 «없는 이름»을 가리켜 눌러도 안 되던 것', () => {
  /* ⚠ 부르는 자리가 purgePageFiles(cfg.store) 였는데 그 자리에 cfg 라는 이름이 없다
     → 누를 때마다 조용히 터져 아무 일도 안 났다(막다른 길). */
  /* ⚠ 주석에도 그 글자가 적혀 있으니 «부르는 자리»(bindCareer)만 본다 */
  const bind = SRC.slice(SRC.indexOf('function bindCareer(){'), SRC.indexOf('/* ===== OCR 자동등록'));
  assert.ok(!/purgePageFiles\(cfg\.store\)/.test(bind), '★★ 없는 이름을 그대로 가리킵니다');
  assert.match(bind, /purgePageFiles\(name\)/, '화면 이름을 넘겨야 합니다');
  const fn = SRC.slice(SRC.indexOf('function purgePageFiles('), SRC.indexOf('function closeStorageMgr('));
  assert.match(fn, /CAREER_CFG\[page\]/, '화면 설정을 찾아야 합니다');
  assert.match(fn, /cfg\.filter/, '★★★ 걸러내지 않으면 옆 화면 원본까지 지웁니다 — 되살릴 수 없습니다');
  assert.match(fn, /confirm\(/, '★★ 되살릴 수 없는 일은 반드시 물어야 합니다');
  assert.match(fn, /r\.src!=='fs'/, '★ 폴더 원본은 앱이 지울 것이 없습니다');
});
