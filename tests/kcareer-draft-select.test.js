'use strict';
/* 작성 중 목록 — 한 줄로 길게 · № 넘버링 · ㅁ 골라서 한꺼번에
   (대표 지시 2026-09-18 「작성중인 이력서 관리 한줄로 길게 넘버링해서 확인하기 쉽게
    길게 정리해주고 ㅁ 표시해서 선택가능하게 해라」)
   ────────────────────────────────────────────────────────────────────────
   ■ 무엇이 문제였나 — 이름 칸에 `max-width:330px` 이 박혀 있어, 자리가 넉넉한데도
     「노무고문 위촉 모집공고문, 지원서, 수행계획서, 개인정보 동의…」로 늘 잘렸다.
     무엇이 무엇인지 알 수 없고, 가리킬 번호도 없고, 한 건씩만 버릴 수 있었다.
   ■ ⚠★ 그래도 «줄바꿈»은 안 한다 — 이름이 길어도 줄을 밀지 않고 …으로 줄이며 전체는
     title 로 본다(옛 규칙 그대로). 바뀐 것은 «얼마나 넓게 쓰느냐»뿐이다.
   ■ ⚠★ 고정 배치(table-layout:fixed)의 대가 — 좁은 화면에서 이름 칸이 «0px 로 사라진다».
     실측 375px 폰에서 통째로 0 이었다 → 표에 min-width 를 주고 좌우로 민다.
   ■ ⚠ 옷은 목록 화면·휴지통과 같다(.rownum · .row-chk · .sel-bar · .sel-on),
     끌기 얼개는 공용 하나(bindDragSel).
   ⚠ 글자만 찾는 검사는 기능을 꺼도 통과한다 — 그래서 vm 에 올려 돌린다. */
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

const 긴이름 = '노무고문 위촉 모집공고문, 지원서, 수행계획서, 개인정보 동의서, 평가기준표.hwp';
const 자리넷 = [
  { id: 'rh_draft_1', name: 긴이름, at: 1, done: false, hasBase: false, cells: { done: 0, total: 53 } },
  { id: 'rh_draft_2', name: '[지방공기업평가원] 위촉직이사 지원서류.hwp', at: 2, done: false, hasBase: true, cells: { done: 12, total: 36 } },
  { id: 'rh_draft_3', name: '충청남도 추천서.hwpx', at: 3, done: false, hasBase: true, cells: { done: 5, total: 18 } },
  { id: 'rh_draft_9', name: '2026 코레일유통 지원서(제출본).hwp', at: 4, done: true, hasBase: true, cells: { done: 36, total: 36 } }
];

/* ══════ ① 그리기 — № · ㅁ · 한 줄로 길게 ══════ */

function 그리기무대(목록, 지금) {
  const box = { innerHTML: '', dataset: {} };
  const 방 = { textContent: '' };
  const 묶임 = [];
  const ctx = {
    console: { warn: function () {} },
    document: { getElementById: function (id) {
      if (id === 'rhDraftRows') return box;
      if (id === 'rhDraftRoom') return 방;
      return null;
    } },
    escapeHtml: function (s) { return String(s == null ? '' : s); },
    _jsAttr: function (s) { return String(s == null ? '' : s); },
    _rhWhen: function () { return '방금'; },
    bindDragSel: function (b, sync) { 묶임.push({ box: b, sync: typeof sync }); },
    rhDraftSelSync: function () { ctx._맞춤 = (ctx._맞춤 || 0) + 1; },
    rhDraftAll: function () { return 목록.slice(); },
    _rhDraftId: 지금 || null,
    RH_DRAFT_MAX: 10
  };
  vm.createContext(ctx);
  vm.runInContext(떼기('function rhDraftDraw(').replace(/^(\s*)const /gm, '$1var '), ctx);
  vm.runInContext('rhDraftDraw()', ctx);
  return { ctx: ctx, html: box.innerHTML, box: box, 방: 방, 묶임: 묶임 };
}

test('★★★ 줄마다 № 가 붙고 «중·지난»을 통틀어 이어 센다', () => {
  const m = 그리기무대(자리넷);
  const 번호 = [...m.html.matchAll(/<span>(\d+)<\/span>/g)].map((x) => x[1]);
  assert.deepEqual(번호, ['1', '2', '3', '4'],
    '★ 두 자리에 1번이 둘이면 「몇 번을 버려라」가 통하지 않습니다');
});

test('★★★ 줄마다 ㅁ 체크칸이 있고 «그 자리 번호»를 들고 있다', () => {
  const m = 그리기무대(자리넷);
  const ids = [...m.html.matchAll(/class="row-chk" data-id="([^"]+)"/g)].map((x) => x[1]);
  assert.deepEqual(ids, ['rh_draft_1', 'rh_draft_2', 'rh_draft_3', 'rh_draft_9']);
  assert.equal((m.html.match(/class="rownum"/g) || []).length, 4, '№ 칸이 줄마다 있어야 합니다');
  assert.match(m.html, /class="rn-chk"/, '목록 화면과 «같은 옷»을 입습니다');
});

test('★★★ 이름을 «가로폭으로 잘라 두지» 않는다 — 한 줄로 길게 쓴다', () => {
  const m = 그리기무대(자리넷);
  assert.ok(m.html.indexOf(긴이름) >= 0, '이름이 통째로 들어 있어야 합니다');
  /* ⚠ 이것이 이번에 고친 바로 그 자리다 — 자리가 넉넉한데도 330px 에서 잘렸다 */
  assert.ok(!/max-width:\s*\d+px[^"]*"\s*title=/.test(m.html),
    '★ 이름 칸에 픽셀 폭을 다시 박지 마세요 — 남는 폭을 다 써야 합니다');
  const 이름칸 = m.html.slice(m.html.indexOf('color:var(--navy)'), m.html.indexOf(긴이름));
  assert.ok(이름칸.indexOf('max-width') < 0, '이름 칸에 max-width 가 남아 있습니다: ' + 이름칸);
});

test('★★ 그래도 «줄을 밀지는» 않는다 — …으로 줄이고 전체는 title 로 본다', () => {
  /* ⚠ 옛 규칙(kcareer-onerow-nopopup)을 그대로 지킨다. 넓게 쓰는 것과 줄바꿈은 다른 일이다.
     ⚠★ «이름 칸 안»만 본다 — 옆 칸(마지막 담김·친 칸)에도 nowrap 이 있어, 온 문서를
       뒤지면 이름 칸에서 빼도 통과한다(고장넣기로 실제로 새어 나갔다). */
  const m = 그리기무대(자리넷);
  const 이름칸 = m.html.slice(m.html.indexOf('color:var(--navy)'), m.html.indexOf(긴이름));
  assert.match(이름칸, /white-space:nowrap/, '줄바꿈하면 줄 높이가 들쭉날쭉해집니다');
  assert.match(이름칸, /text-overflow:ellipsis/);
  assert.match(이름칸, /title="/, '전체 이름을 볼 길이 있어야 합니다');
});

test('★★ 빈 줄·구분줄의 칸 수가 표와 «같다»(다섯) — 어긋나면 표가 틀어진다', () => {
  const m = 그리기무대(자리넷);
  const 머리 = SRC.slice(SRC.indexOf('id="rhDraftChkAll"'), SRC.indexOf('id="rhDraftRows"'));
  const th = (머리.match(/<th/g) || []).length + 1;   /* 머리칸 자신이 잘려 하나 더한다 */
  assert.equal(th, 5, '표 머리칸이 다섯이어야 합니다');
  [...m.html.matchAll(/colspan="(\d+)"/g)].forEach((x) => {
    assert.equal(x[1], '5', '구분줄 칸 수가 표와 다릅니다');
  });
  const 빈 = 그리기무대([]);
  assert.match(빈.html, /colspan="5"[^>]*>작성 중인 것이 없습니다/);
});

test('★★ 「지금 하는 것」·「⚠ 원본 없음」 표시는 그대로 살아 있다', () => {
  const m = 그리기무대(자리넷, 'rh_draft_2');
  assert.match(m.html, /지금 하는 것/, '어느 것을 열어 두었는지 알아야 합니다');
  assert.match(m.html, /원본 없음/, '원본이 없으면 값이 겹칠 수 있다고 밝혀야 합니다');
  assert.match(m.html, /✅ 지난 작성 1건/);
});

test('★★★ 끌어서 고르기는 «공용 얼개»를 쓴다 — 화면마다 따로 만들지 않는다', () => {
  const m = 그리기무대(자리넷);
  assert.equal(m.묶임.length, 1, 'bindDragSel 을 부르지 않았습니다');
  assert.equal(m.묶임[0].box, m.box, '그 목록 칸에 묶어야 합니다');
  assert.equal(m.묶임[0].sync, 'function', '고른 것을 다시 맞출 길을 함께 넘겨야 합니다');
  assert.ok(m.ctx._맞춤 >= 1, '다시 그린 뒤 체크 상태를 맞추지 않았습니다');
});

test('★ 자리 수를 알려 준다 — 다 차면 그렇다고 말한다', () => {
  assert.match(그리기무대(자리넷).방.textContent, /자리 3 \/ 10/);
  const 꽉 = [];
  for (let i = 0; i < 10; i++) 꽉.push({ id: 'd' + i, name: '가', at: 1, done: false, cells: {} });
  assert.match(그리기무대(꽉).방.textContent, /다 찼습니다/);
});

/* ══════ ② 골라서 한꺼번에 ══════ */

function 고르기무대(목록, opts) {
  opts = opts || {};
  const 칸들 = 목록.map(function (d) {
    const chk = { checked: false, dataset: { id: d.id },
      classList: { contains: function (c) { return c === 'row-chk'; } } };
    const tr = { classList: { _on: false, toggle: function (c, on) { this._on = !!on; } } };
    chk.closest = function () { return tr; };
    chk._tr = tr;
    return chk;
  });
  const box = { dataset: {}, addEventListener: function () {},
    querySelectorAll: function () { return 칸들; } };
  const 띠 = { style: { display: 'none' } }, 세기 = { textContent: '' }, 머리칸 = { checked: false };
  const 알림 = [], 담긴것 = [];
  let 자리 = 목록.slice(), 물음 = null;
  const ctx = {
    console: { warn: function () {} },
    String: String, Number: Number,
    document: { getElementById: function (id) {
      if (id === 'rhDraftRows') return box;
      if (id === 'rhDraftSelBar') return 띠;
      if (id === 'rhDraftSelCnt') return 세기;
      if (id === 'rhDraftChkAll') return 머리칸;
      return null;
    } },
    toast: function (m) { 알림.push(String(m)); },
    confirm: function (m) { 물음 = String(m); return opts.예 !== false; },
    TRASH_DAYS: 30,
    RH_DRAFTS: 'rh_drafts',
    _rhDraftId: opts.지금 || null,
    rhDraftAll: function () { return 자리.slice(); },
    rhDraftPut: function (a) { 자리 = a; },
    rhDraftFind: function (id) { return 자리.filter(function (x) { return x.id === id; })[0] || null; },
    kcTrashPut: function (store, page, rec, what) {
      담긴것.push({ store: store, page: page, id: rec && rec.id, what: what });
      return { tid: 'T' + 담긴것.length };
    },
    rhDraftDraw: function () { ctx._다시그림 = (ctx._다시그림 || 0) + 1; },
    rhDraftCheck: function () { ctx._딱지 = (ctx._딱지 || 0) + 1; }
  };
  vm.createContext(ctx);
  vm.runInContext([떼기('function _rhDraftChks('), 떼기('function rhDraftSelIds('),
    떼기('function rhDraftSelAll('), 떼기('function rhDraftSelSync('),
    떼기('function rhDraftTrashSel(')]
    .join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return { ctx: ctx, 칸: 칸들, 띠: 띠, 세기: 세기, 머리칸: 머리칸,
           알림: 알림, 담긴것: 담긴것, 물음: function () { return 물음; },
           남은: function () { return 자리.map(function (d) { return d.id; }); } };
}
const 고른것 = (m) => Array.from(vm.runInContext('rhDraftSelIds()', m.ctx));

test('★★★ 고르면 파란 줄이 뜨고 «몇 건인지» 말한다', () => {
  const m = 고르기무대(자리넷);
  assert.equal(m.띠.style.display, 'none', '고르기 전에는 안 보여야 합니다');
  m.칸[0].checked = true; m.칸[2].checked = true;
  vm.runInContext('rhDraftSelSync()', m.ctx);
  assert.equal(m.띠.style.display, 'flex');
  assert.equal(m.세기.textContent, '2건 선택');
  assert.deepEqual(고른것(m), ['rh_draft_1', 'rh_draft_3']);
  assert.equal(m.칸[0]._tr.classList._on, true, '고른 줄은 눈에 띄어야 합니다');
  assert.equal(m.칸[1]._tr.classList._on, false);
  assert.equal(m.머리칸.checked, false, '일부만 골랐는데 머리칸이 켜졌습니다');
});

test('★★ 전체 선택 / 선택 해제', () => {
  const m = 고르기무대(자리넷);
  vm.runInContext('rhDraftSelAll(true)', m.ctx);
  assert.equal(고른것(m).length, 4);
  assert.equal(m.머리칸.checked, true, '다 골랐으면 머리칸도 켜져야 합니다');
  vm.runInContext('rhDraftSelAll(false)', m.ctx);
  assert.equal(고른것(m).length, 0);
  assert.equal(m.띠.style.display, 'none');
  assert.equal(m.칸[0]._tr.classList._on, false, '풀었는데 줄 색이 남았습니다');
});

test('★★★ 고른 것을 한꺼번에 버린다 — 휴지통으로 가고 목록에서 빠진다', () => {
  const m = 고르기무대(자리넷);
  m.칸[0].checked = true; m.칸[3].checked = true;
  vm.runInContext('rhDraftTrashSel()', m.ctx);
  assert.equal(m.담긴것.length, 2, '휴지통에 담기지 않았습니다');
  assert.deepEqual(m.담긴것.map(function (x) { return x.id; }), ['rh_draft_1', 'rh_draft_9']);
  assert.equal(m.담긴것[0].store, 'rh_drafts', '되살릴 때 어디로 돌아갈지 적어야 합니다');
  assert.equal(m.담긴것[0].what, '작성 중 서류');
  assert.deepEqual(m.남은(), ['rh_draft_2', 'rh_draft_3']);
  assert.ok(m.ctx._다시그림 >= 1 && m.ctx._딱지 >= 1, '화면을 다시 그려야 합니다');
});

test('★★★ 버리기 전에 «몇 건인지 세고 무엇이 가는지 보여 주고» 묻는다', () => {
  const m = 고르기무대(자리넷);
  vm.runInContext('rhDraftSelAll(true)', m.ctx);
  vm.runInContext('rhDraftTrashSel()', m.ctx);
  const q = m.물음();
  assert.ok(q, '묻지 않고 버렸습니다');
  assert.match(q, /4건/, '몇 건인지 말해야 합니다');
  assert.ok(q.indexOf('충청남도 추천서.hwpx') > 0, '무엇이 가는지 보여 줘야 합니다');
  assert.match(q, /휴지통/, '★ 되살리는 길을 말하지 않으면 잃은 것과 같습니다');
  assert.match(q, /30일/);
});

test('★★ 많이 고르면 이름은 «넷까지»만 — 열 건이면 묻는 창이 화면을 넘는다', () => {
  const 여섯 = [];
  for (let i = 1; i <= 6; i++) 여섯.push({ id: 'd' + i, name: '서식 ' + i + '.hwp', at: i, done: false, cells: {} });
  const m = 고르기무대(여섯);
  vm.runInContext('rhDraftSelAll(true)', m.ctx);
  vm.runInContext('rhDraftTrashSel()', m.ctx);
  const q = m.물음();
  assert.match(q, /6건/);
  assert.equal((q.match(/^· /gm) || []).length, 4, '이름은 넷까지만 보여 줍니다');
  assert.match(q, /그 밖 2건/, '다섯째부터는 「그 밖 N건」으로 줄여야 합니다');
  assert.equal(m.담긴것.length, 6, '보여 준 것만 버리면 안 됩니다 — 고른 것을 다 버립니다');
});

test('★★★ 「아니오」면 «한 건도» 건드리지 않는다', () => {
  const m = 고르기무대(자리넷, { 예: false });
  vm.runInContext('rhDraftSelAll(true)', m.ctx);
  vm.runInContext('rhDraftTrashSel()', m.ctx);
  assert.equal(m.담긴것.length, 0);
  assert.equal(m.남은().length, 4);
  assert.equal(m.ctx._다시그림, undefined, '아무 일도 안 했는데 다시 그렸습니다');
});

test('★★ 알림은 «끝에 한 번»이고 되살리는 길을 말한다', () => {
  const m = 고르기무대(자리넷);
  vm.runInContext('rhDraftSelAll(true)', m.ctx);
  vm.runInContext('rhDraftTrashSel()', m.ctx);
  assert.equal(m.알림.length, 1, '⚠ 자리마다 알리면 열 건이면 열 번 뜹니다: ' + m.알림.join(' / '));
  assert.match(m.알림[0], /4건/);
  assert.match(m.알림[0], /휴지통/);
});

test('★★ 고른 것이 없으면 «말해 준다» — 조용히 넘기면 고장으로 읽힌다', () => {
  const m = 고르기무대(자리넷);
  vm.runInContext('rhDraftTrashSel()', m.ctx);
  assert.equal(m.담긴것.length, 0);
  assert.equal(m.물음(), null, '고른 것이 없는데 물었습니다');
  assert.match(m.알림.join(' '), /고른 것이 없습니다/);
});

test('★★ 지금 열어 둔 자리를 버리면 «열린 표시»를 놓는다', () => {
  /* ⚠ 안 놓으면 없는 자리를 가리킨 채로 남아, 다음 임시저장이 사라진 자리에 담긴다 */
  const m = 고르기무대(자리넷, { 지금: 'rh_draft_2' });
  m.칸[1].checked = true;
  vm.runInContext('rhDraftTrashSel()', m.ctx);
  assert.equal(vm.runInContext('_rhDraftId', m.ctx), null);
});

test('★ 안 고른 자리는 «열린 표시»를 건드리지 않는다', () => {
  const m = 고르기무대(자리넷, { 지금: 'rh_draft_2' });
  m.칸[0].checked = true;
  vm.runInContext('rhDraftTrashSel()', m.ctx);
  assert.equal(vm.runInContext('_rhDraftId', m.ctx), 'rh_draft_2');
});

/* ══════ ③ 좁은 화면 ══════ */

test('★★★ 좁은 화면에서 이름 칸이 «0px 로 사라지지» 않는다', () => {
  /* ⚠ 실측 375px 폰에서 통째로 0 이었다 — 고정 배치는 다른 칸(52+82+62+214=410)을
     먼저 주고 «남는 것»을 이름에 준다. 표에 최소 폭이 없으면 남는 것이 0 이 된다. */
  const 구역 = SRC.slice(SRC.indexOf('id="rhDraftSelBar"'), SRC.indexOf('id="rhDraftRows"'));
  /* ⚠★ «진짜 태그»만 본다 — 바로 위 주석에 같은 낱말이 적혀 있어, 구역을 통째로 뒤지면
     style 에서 빼도 통과한다(고장넣기로 실제로 새어 나갔다). */
  const tag = /<table style="([^"]+)"/.exec(구역);
  assert.ok(tag, '작성 중 표를 찾지 못했습니다');
  assert.match(tag[1], /table-layout:fixed/, '이름 칸이 남는 폭을 쓰려면 고정 배치가 필요합니다');
  const mw = /min-width:(\d+)px/.exec(tag[1]);
  assert.ok(mw, '★ 표에 최소 폭이 없으면 좁은 화면에서 이름 칸이 사라집니다');
  assert.ok(Number(mw[1]) >= 520,
    '최소 폭이 너무 작습니다(' + mw[1] + ') — 다른 칸만으로 410px 을 씁니다');
  assert.match(구역, /<div style="overflow-x:auto">\s*<table/, '좁으면 좌우로 밀 수 있어야 합니다');
});

test('★★ 머리줄에도 «전체 선택» 체크칸이 있다', () => {
  const 머리 = SRC.slice(SRC.indexOf('id="rhDraftChkAll"') - 260, SRC.indexOf('id="rhDraftRows"'));
  assert.match(머리, /rhDraftSelAll\(this\.checked\)/);
  assert.match(머리, /class="rownum-h"/, '목록 화면과 같은 옷을 입습니다');
});
