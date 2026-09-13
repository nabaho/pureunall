'use strict';
/* 휴지통 — 틀고정 · 골라서 한꺼번에 되살리기 · 끌어서 고르기 · 종류로 걸러 보기
   (대표 지시 2026-09-13 「캡쳐1 틀고정 · ㅁ 넣어서 선택해서 되살리기」
    → 「표창건 모두 살리고 마우스로 클릭 하나씩 안하고 드레그로 선택가능하게」)
   ────────────────────────────────────────────────────────────────────────
   ■ 왜  위촉장 99건을 «일부러» 지우셨는데 같은 창고의 표창 7건이 딸려 가 휴지통이 130건이 됐다.
        한 줄씩 되살리려면 130번을 눌러야 하고, 내려 보다 보면 단추도 머리줄도 사라졌다.
   ■ 네 가지
     ① 틀고정 — 탭줄 · 도구 줄 · 표 머리줄이 «세 층»으로 붙는다(높이는 재서 알려 준다).
     ② 줄마다 체크칸 + 「↩ 선택 되살리기 · 🗑 선택 완전삭제」.
     ③ 끌어서 고르기 — 얼개는 목록 화면과 «하나»(bindDragSel).
     ④ ★ 종류 딱지 + 찾기칸 — 내용에는 「표창」이라는 낱말이 «없다»(수여 사유만 적힌다).
        종류를 안 보여 주면 130줄에서 표창 7건을 눈으로 골라낼 수가 없다.
   ⚠ vm 밖 배열과 vm 안 배열은 «틀»이 달라 deepEqual 이 안 맞는다 → Array.from 으로 옮긴다. */
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
const 고른것 = (m) => Array.from(vm.runInContext('trashSelIds()', m.ctx));

/* 아주 작은 가짜 DOM — 줄 하나에 체크칸 하나 */
function 줄(e) {
  const chk = { checked: false, dataset: { id: e.tid },
    classList: { contains: function (c) { return c === 'row-chk'; } } };
  const tr = { style: { display: '' }, dataset: { q: String(e.q || '').toLowerCase() },
    classList: { _on: false, toggle: function (c, on) { this._on = !!on; } },
    querySelector: function (q) { return q === '.row-chk' ? chk : null; } };
  chk.closest = function () { return tr; };
  return { chk: chk, tr: tr };
}

function 무대(목록, opts) {
  opts = opts || {};
  const 줄들 = 목록.map(줄);
  const 칸들 = 줄들.map(function (x) { return x.chk; });
  const 띠 = { style: { display: 'none' } }, 세기 = { textContent: '' }, 머리칸 = { checked: false };
  const 찾기 = { value: opts.q || '' }, 찾기알림 = { textContent: '' };
  const 알림 = [], 되살림 = [], 완전삭제 = [];
  let 물음 = null;
  const body = { dataset: {}, addEventListener: function () {},
    querySelectorAll: function (sel) {
      return sel === 'tbody tr' ? 줄들.map(function (x) { return x.tr; }) : 칸들;
    } };
  const ctx = {
    console: { warn: function () {}, log: function () {} },
    document: { getElementById: function (id) {
      if (id === 'trashBody') return body;
      if (id === 'trashSelBar') return 띠;
      if (id === 'trashSelCnt') return 세기;
      if (id === 'trashChkAll') return 머리칸;
      if (id === 'trashQ') return 찾기;
      if (id === 'trashFiltInfo') return 찾기알림;
      return null;
    } },
    toast: function (m) { 알림.push(m); },
    escapeHtml: function (s) { return String(s == null ? '' : s); },
    kcTrashList: function () { return 목록.slice(); },
    kcTrashRestore: async function (tid, quiet) {
      되살림.push({ tid: tid, quiet: quiet });
      if (opts.없는것 === tid) return null;
      return { store: 'wiccok', id: 'X', oldId: 'X', renamed: (opts.이름바뀜 || []).indexOf(tid) >= 0 };
    },
    kcTrashPurge: function (tid) { 완전삭제.push(tid); },
    kcAskDelete: function (btn, o, go) { 물음 = o; ctx._진행 = go; },
    renderTrash: function () { ctx._다시그림 = (ctx._다시그림 || 0) + 1; },
    _trashSticky: function () {},
  };
  vm.createContext(ctx);
  vm.runInContext([떼기('function _trashChks('), 떼기('function _trashShown('),
    떼기('function trashSelIds('), 떼기('function trashSelAll('), 떼기('function trashFilter('),
    떼기('function trashSelSync('), 떼기('async function trashRestoreSel('),
    떼기('function trashPurgeSel(')]
    .join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return { ctx: ctx, 칸: 칸들, 줄: 줄들, 띠: 띠, 세기: 세기, 머리칸: 머리칸,
           찾기: 찾기, 찾기알림: 찾기알림,
           알림: 알림, 되살림: 되살림, 완전삭제: 완전삭제, 물음: function () { return 물음; } };
}

const 셋 = [{ tid: 't1', label: '위촉장 가', q: '위촉장 위촉장 가' },
            { tid: 't2', label: '위촉장 나', q: '위촉장 위촉장 나' },
            { tid: 't3', label: '표창 다', q: '표창 지역 노사민정 협력 증진' }];

/* ══════ 고르기 ══════ */

test('★★ 고른 만큼 띠가 나오고 건수를 말한다 — 안 고르면 띠가 없다', () => {
  const m = 무대(셋);
  vm.runInContext('trashSelSync()', m.ctx);
  assert.equal(m.띠.style.display, 'none', '안 골랐는데 띠가 떠 있습니다');
  m.칸[0].checked = true; m.칸[2].checked = true;
  vm.runInContext('trashSelSync()', m.ctx);
  assert.equal(m.띠.style.display, 'flex');
  assert.equal(m.세기.textContent, '2건 선택');
  assert.deepEqual(고른것(m), ['t1', 't3']);
});

test('★★ 「전체 선택」·「선택 해제」가 한 번에 먹는다 — 130건을 하나씩 누를 수 없다', () => {
  const m = 무대(셋);
  vm.runInContext('trashSelAll(true)', m.ctx);
  assert.deepEqual(고른것(m), ['t1', 't2', 't3']);
  assert.equal(m.머리칸.checked, true, '머리칸도 따라와야 합니다');
  vm.runInContext('trashSelAll(false)', m.ctx);
  assert.deepEqual(고른것(m), []);
  assert.equal(m.머리칸.checked, false);
});

test('★ 고른 줄에 표시가 남는다 — 어느 줄을 골랐는지 눈으로 보여야 한다', () => {
  const m = 무대(셋);
  m.칸[1].checked = true;
  vm.runInContext('trashSelSync()', m.ctx);
  assert.equal(m.줄[1].tr.classList._on, true);
  assert.equal(m.줄[0].tr.classList._on, false);
});

/* ══════ ★ 종류로 걸러 보기 — 「표창건 모두」 ══════ */

test('★★★ 「표창」이라 치면 표창만 남고, 전체 선택은 «보이는 것»만 고른다', () => {
  const m = 무대(셋);
  m.찾기.value = '표창';
  vm.runInContext('trashFilter()', m.ctx);
  assert.equal(m.줄[0].tr.style.display, 'none', '위촉장은 숨어야 합니다');
  assert.equal(m.줄[2].tr.style.display, '', '★★★ 표창이 안 보입니다');
  assert.match(m.찾기알림.textContent, /1건 보임/, '몇 건 보이는지 말해야 합니다');
  vm.runInContext('trashSelAll(true)', m.ctx);
  assert.deepEqual(고른것(m), ['t3'],
    '★★★ 안 보이는 줄까지 골랐습니다 — 무엇을 되살렸는지 알 수 없게 됩니다');
});

test('★★★ 걸러서 안 보이게 된 줄은 «체크가 풀린다»', () => {
  /* ⚠ 고른 채 숨으면 보이지도 않는 것이 함께 되살아난다 */
  const m = 무대(셋);
  vm.runInContext('trashSelAll(true)', m.ctx);
  assert.equal(고른것(m).length, 3);
  m.찾기.value = '표창';
  vm.runInContext('trashFilter()', m.ctx);
  assert.deepEqual(고른것(m), ['t3'], '★★★ 숨은 줄이 고른 채로 남아 있습니다');
});

test('★★ 걸러 놓고 다 고르면 머리칸도 «켜진다» — 보이는 것 기준으로 센다', () => {
  /* ⚠ 안 보이는 줄까지 세면, 보이는 것을 다 골라도 머리칸이 꺼진 채라
     「아직 덜 골랐나」 싶어 또 누르게 된다(고장넣기로 확인). */
  const m = 무대(셋);
  m.찾기.value = '표창';
  vm.runInContext('trashFilter()', m.ctx);
  vm.runInContext('trashSelAll(true)', m.ctx);
  assert.equal(m.머리칸.checked, true, '★★ 보이는 것을 다 골랐는데 머리칸이 꺼져 있습니다');
  assert.equal(m.세기.textContent, '1건 선택');
});

test('★ 찾을 글자를 지우면 모두 다시 보인다', () => {
  const m = 무대(셋);
  m.찾기.value = '표창'; vm.runInContext('trashFilter()', m.ctx);
  m.찾기.value = '';    vm.runInContext('trashFilter()', m.ctx);
  m.줄.forEach(function (x) { assert.equal(x.tr.style.display, ''); });
  assert.equal(m.찾기알림.textContent, '', '안 거를 때는 말할 것이 없습니다');
});

test('★ 내용으로도 찾는다 — 종류만으로 걸러지면 안 된다', () => {
  const m = 무대(셋);
  m.찾기.value = '노사민정';
  vm.runInContext('trashFilter()', m.ctx);
  assert.equal(m.줄[2].tr.style.display, '');
  assert.equal(m.줄[0].tr.style.display, 'none');
});

/* ══════ 되살리기 ══════ */

test('★★★ 고른 것을 한꺼번에 되살린다 — 알림은 «끝에 한 번»', async () => {
  const m = 무대(셋);
  vm.runInContext('trashSelAll(true)', m.ctx);
  await vm.runInContext('trashRestoreSel(null)', m.ctx);
  assert.deepEqual(m.되살림.map(function (x) { return x.tid; }), ['t1', 't2', 't3']);
  m.되살림.forEach(function (x) {
    assert.equal(x.quiet, true, '★★★ 조용히 되살려야 합니다 — 130건이면 알림이 130번 뜹니다');
  });
  assert.equal(m.알림.length, 1, '★★ 알림이 ' + m.알림.length + '번 떴습니다');
  assert.match(m.알림[0], /3건/, '몇 건 되살렸는지 말해야 합니다');
  assert.equal(m.ctx._다시그림, 1, '★ 끝나고 한 번만 다시 그립니다');
});

test('★★★ 번호가 겹쳐 «새 번호»로 들어간 건이 있으면 반드시 밝힌다', async () => {
  /* ⚠ 조용히 넘기면 대표님이 옛 번호로 찾다가 「안 돌아왔다」고 아신다 */
  const m = 무대(셋, { 이름바뀜: ['t2'] });
  vm.runInContext('trashSelAll(true)', m.ctx);
  await vm.runInContext('trashRestoreSel(null)', m.ctx);
  assert.match(m.알림[0], /1건은 번호가/, '★★★ 번호가 바뀐 것을 안 알립니다');
});

test('★ 하나가 없어도 나머지를 끝까지 되살린다 — 중간에 멈추면 안 된다', async () => {
  const m = 무대(셋, { 없는것: 't2' });
  vm.runInContext('trashSelAll(true)', m.ctx);
  await vm.runInContext('trashRestoreSel(null)', m.ctx);
  assert.equal(m.되살림.length, 3, '세 건 다 시도해야 합니다');
  assert.match(m.알림[0], /2건/, '실제로 된 건수를 말해야 합니다');
});

test('★ 고른 것이 없으면 그렇다고 말한다', async () => {
  const m = 무대(셋);
  await vm.runInContext('trashRestoreSel(null)', m.ctx);
  assert.equal(m.되살림.length, 0);
  assert.match(m.알림.join(' '), /고른 것이 없습니다/);
});

/* ══════ 완전삭제 — 되돌릴 수 없다 ══════ */

test('★★★ 「선택 완전삭제」는 묻기 «전»에 아무것도 지우지 않는다', () => {
  const m = 무대(셋);
  vm.runInContext('trashSelAll(true)', m.ctx);
  vm.runInContext('trashPurgeSel(null)', m.ctx);
  assert.equal(m.완전삭제.length, 0, '★★★ 묻지도 않고 지웠습니다 — 되돌릴 수 없습니다');
  assert.ok(m.물음(), '물어야 합니다');
  assert.match(m.물음().title, /3건/, '몇 건인지 세어 말해야 합니다');
  assert.match(m.물음().detail, /위촉장 가/, '★★ 무엇이 가는지 보여 줘야 합니다');
  assert.match(m.물음().detail, /되돌릴 수 없습니다/);
  vm.runInContext('_진행()', m.ctx);
  assert.deepEqual(m.완전삭제, ['t1', 't2', 't3']);
});

test('★ 다섯 건이 넘으면 앞의 넷만 보여 주고 나머지는 세어 말한다', () => {
  const 많음 = []; for (let i = 1; i <= 7; i++) 많음.push({ tid: 't' + i, label: '서류 ' + i, q: '서류' });
  const m = 무대(많음);
  vm.runInContext('trashSelAll(true)', m.ctx);
  vm.runInContext('trashPurgeSel(null)', m.ctx);
  assert.match(m.물음().detail, /그리고 3건/);
});

/* ══════ 종류 딱지 ══════ */

test('★★★ 종류를 보여 준다 — 내용에는 「표창」이라는 낱말이 없다', () => {
  const ctx = { TRASH_KIND: null };
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(SRC.indexOf('var TRASH_KIND='), SRC.indexOf('function _trashKind(')) +
    떼기('function _trashKind('), ctx);
  ctx.보기 = function (e) { return ctx._trashKind(e); };
  assert.equal(vm.runInContext('_trashKind({store:"wiccok",rec:{type:"표창"}})', ctx), '표창',
    '★★★ 기록의 종류를 그대로 보여 줘야 합니다');
  assert.equal(vm.runInContext('_trashKind({store:"wiccok",rec:{type:"위촉장"}})', ctx), '위촉장');
  assert.equal(vm.runInContext('_trashKind({store:"cert",rec:{}})', ctx), '자격·수료',
    '종류가 없으면 창고 이름을 사람 말로');
  assert.equal(vm.runInContext('_trashKind({fileOnly:true,store:"wiccok"})', ctx), '원본만');
  assert.equal(vm.runInContext('_trashKind(null)', ctx), '');
});

/* ══════ 앱에 이어져 있나 ══════ */

test('★★ 휴지통 표에 체크칸·종류 칸·찾기칸이 있다', () => {
  const fn = SRC.slice(SRC.indexOf('function renderTrash(){'), SRC.indexOf('var TRASH_KIND='));
  assert.match(fn, /class="row-chk" data-id=/, '★★ 줄마다 체크칸이 없습니다');
  assert.match(fn, /id="trashChkAll" onclick="trashSelAll\(this\.checked\)"/, '★ 머리칸 전체 선택이 없습니다');
  assert.match(fn, /'지운 날','남은 기간','어디서','종류','내용','원본','되살리기'/, '★★ 종류 칸이 없습니다');
  assert.match(fn, /data-q="/, '★★ 찾을 글자를 줄에 적어 둬야 걸러집니다');
  assert.match(fn, /_trashKind\(e\)/, '종류를 읽어야 합니다');
  assert.match(SRC, /id="trashQ"[\s\S]{0,200}oninput="trashFilter\(\)"/, '★★ 찾기칸이 없습니다');
  /* ⚠ 그릴 때마다 듣는 사람을 붙이면 그린 횟수만큼 쌓인다 */
  assert.match(fn, /if\(!box\.dataset\.selBound\)/, '★★ 듣는 사람이 그릴 때마다 쌓입니다');
  assert.match(fn, /bindDragSel\(box, trashSelSync\)/, '★★ 끌어서 고르기를 안 묶었습니다');
  assert.match(fn, /trashFilter\(\);/, '★ 다시 그린 뒤 걸러 둔 글자를 다시 적용해야 합니다');
  assert.match(fn, /trashSelSync\(\); _trashSticky\(\); return;/, '★ 비면 띠가 남습니다');
});

test('★★★ 끌어서 고르기 — 얼개는 목록 화면과 «하나»다', () => {
  assert.match(SRC, /function bindDragSel\(box, sync\)/, '★★ 공용 끌기 얼개가 없습니다');
  const b = 떼기('function bindDragSel(box, sync){');
  assert.match(b, /if\(!box \|\| box\.dataset\.dragBound\) return;/,
    '★★ 다시 그릴 때마다 묶으면 지나간 줄이 여러 번 뒤집힙니다');
  assert.match(b, /mousedown/); assert.match(b, /mouseover/);
  assert.match(b, /userSelect='none'/, '★ 끌 때 글자가 파랗게 번지면 지저분합니다');
  /* 목록 화면도 «그것»을 쓴다 — 두 벌이 되면 한쪽만 고쳐진다 */
  const c = 떼기('function careerDragSel(name){');
  assert.match(c, /bindDragSel\(/, '★★★ 목록 화면이 제 나름의 끌기를 씁니다');
  assert.ok(!/addEventListener\('mousedown'/.test(c), '★ 옛 끌기가 남아 있습니다');
});

test('★★ 틀고정 — 탭줄·도구 줄·표 머리줄이 «세 층»으로 붙는다', () => {
  assert.match(SRC, /#page-settings>\.page>\.tabrow\{position:sticky;top:0/, '★★ 탭줄이 안 붙습니다');
  assert.match(SRC, /#page-settings \.stick-bar\{position:sticky;top:var\(--stTab,0px\)/,
    '★★ 도구 줄이 탭줄 아래에 안 붙습니다');
  assert.match(SRC, /#page-settings \.dt thead th\{top:var\(--stAll,0px\)!important/,
    '★★ 표 머리줄이 둘 아래에 안 붙습니다 — 겹칩니다');
  assert.match(SRC, /id="trashStick"/, '고정될 칸이 있어야 합니다');
  /* ⚠ .tabrow 는 이력서관리·보관함도 쓴다 — #page-settings 안으로 좁혀야 한다 */
  assert.ok(!/^\.tabrow\{[^}]*position:sticky/m.test(SRC),
    '★★★ .tabrow 를 통째로 고정하면 다른 화면까지 바뀝니다');
});

test('★★ 높이를 «재서» 알려 준다 — 고정값을 박으면 두 줄로 접힐 때 어긋난다', () => {
  const fn = 떼기('function _trashSticky(){');
  /* ⚠ 「재는 글자가 어딘가 있나」로는 모자란다 — 둘 중 하나만 박아도 통과했다(고장넣기로 확인). */
  assert.equal((fn.match(/getBoundingClientRect\(\)\.height/g) || []).length, 2,
    '★★ 탭줄·도구 줄 «둘 다» 실제 높이를 재야 합니다');
  assert.match(fn, /tabrow\?Math\.round\(tabrow\.getBoundingClientRect\(\)\.height\)/, '★ 탭줄 높이');
  assert.match(fn, /stick\?Math\.round\(stick\.getBoundingClientRect\(\)\.height\)/, '★ 도구 줄 높이');
  assert.match(SRC, /window\.addEventListener\('resize', function\(\)\{ _safe\(_trashSticky\); \}\)/,
    '★ 창 크기가 바뀌면 다시 재야 합니다');
});

test('★ 줄마다 있던 «한 건» 단추는 그대로 둔다 — 한 건만 만질 때가 더 많다', () => {
  const fn = SRC.slice(SRC.indexOf('function renderTrash(){'), SRC.indexOf('var TRASH_KIND='));
  assert.match(fn, /trashRestore\(/, '줄마다 되살리기가 있어야 합니다');
  assert.match(fn, /trashPurgeOne\(/, '줄마다 완전삭제가 있어야 합니다');
});
