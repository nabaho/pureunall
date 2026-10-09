'use strict';
// 📱 업무관리 폰 보기 — 줄은 한 가지, 묶기만 바뀐다 — node --test tests/work-phone-view.test.js
//
// 대표 지시 2026-10-09 「업무관리 폰에서 보기 너무 힘들다」 → 목업 넷 → 「네가지를 섞어서」 → 「폰 진행」
//
// ■ 무엇이 나빴나 (갤럭시 S25 사진 실측)
//   조종칸이 «세 줄»이라 표가 시작되기도 전에 화면 위 4분의 1을 먹었고,
//   표를 폰에 넣어 칸을 둘만 켜 두고도 업무 이름이 오른쪽에서 잘렸다. 한 화면에 여덟 줄.
//
// ■ 이 검사가 지키는 것 — «규칙»이지 지금 값이 아니다
//   ①★ 줄 모양은 «한 가지» — 묶기를 바꿔도 ☐·번호·회사·업무·기한 자리가 안 바뀐다
//   ②  맨 왼쪽은 ☐ + 번호 (대표 지시 2026-10-05 · 모든 프로그램)
//   ③★ 묶기 고르개는 «지금 몇 건인지»를 미리 적는다 — 빈 칸인 줄 모르고 고르지 않게
//   ④  빈 묶기는 «왜 비었는지»를 말한다 — 빈 화면만 보여 주지 않는다
//   ⑤  사업장 묶기는 접을 값어치가 있을 때만 접는다(업무 하나인 곳은 그냥 한 줄)
//   ⑥★ 한 줄에서 넘치는 글은 «자르지 않고» … 로 줄인다 (「한 칸은 한 줄」)
//   ⑦  넓은 화면은 예전 그대로다 — 폰에서만 기본이 바뀐다
//   ⑧  고른 묶기는 이 기기에만 남는다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}
function grabVar(name) {
  const i = W.indexOf('var ' + name + '=');
  assert.ok(i >= 0, '못 찾음: var ' + name);
  let d = 0, j = i;
  for (;; j++) { const c = W[j];
    if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') d--;
    else if (c === ';' && d === 0) return W.slice(i, j + 1); }
}
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const DAY = 864e5;
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const inDays = (n) => ymd(Date.now() + n * DAY);

/* 업무 한 벌 — 기한 있는 것·없는 것, 같은 회사 둘, 할 일 적은 것 하나. 예시는 가나상사·홍길동. */
function seed() {
  return [
    { _id: 'A', company: '가나상사', cat: '사건', title: '부당해고 구제신청', due: inDays(-2) },
    { _id: 'B', company: '가나상사', cat: '컨설팅', title: '현장클리닉', due: inDays(3) },
    { _id: 'C', company: '다라중공업', cat: '컨설팅', title: '일터혁신', due: inDays(40) },
    { _id: 'D', company: '마바테크', cat: '기타', title: '직장 내 괴롭힘 조사' },
    { _id: 'E', company: '사아물산', cat: '기금', title: '기금 설립',
      next: { text: '설립 서류 보내기', date: inDays(5) } }
  ];
}
function box(stored) {
  const b = {
    console, String, Object, Array, Number, Boolean, Date, Math, JSON, isNaN,
    S: { q: '', week: null }, saved: {},
    localStorage: { getItem: (k) => (stored && stored[k]) || null,
                    setItem: (k, v) => { b.saved[k] = v; } },
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    escJ: (s) => String(s == null ? '' : s).replace(/'/g, "\\'"),
    itemName: (it) => String(it.title || it.ptype || '').trim(),
    openDrawer: () => {}, closeM: () => {}, route: () => {},
    showModal: (h) => { b.modal = h; }, modal: '',
    weekLabel: () => '10월 2주', wsCleanCount: () => 7, go: () => {}
  };
  vm.createContext(b);
  vm.runInContext(
    grabVar('MYMODE_KEY') + '\n' + grabVar('MYGRP_KEY') + '\n' + grabVar('PH_GRP') + '\n'
    + ['isPhone', 'myMode', 'setMyMode', 'myGroup', 'setMyGroup', 'itemDue', 'dday',
       'phHasDue', 'phHasTodo', 'phCounts', 'phDue', 'phRowHTML', 'phListHTML',
       'phGroupSheet', 'phHeadHTML'].map(grab).join('\n'), b);
  return b;
}
const run = (b, s) => vm.runInContext(s, b);
/* 줄만 뽑아 본다 */
const rowsOf = (html) => (html.match(/<div class="phr[^"]*"[\s\S]*?<\/div>/g) || []);

// ══════════════════════════════════════════════════════════════════
test('① ★ 줄 모양은 한 가지 — 묶기를 바꿔도 ☐·번호·회사·업무·기한 자리가 안 바뀐다', () => {
  /* «자리»만 센다 — 기한 딱지의 색은 업무마다 다르므로 모양에 넣지 않는다 */
  const shape = (html) => rowsOf(html).map((r) =>
    (r.match(/class="(?:ck|no|co|tt|phd)[^"]*"/g) || [])
      .map((c) => c.replace(/phd [a-z]/, 'phd')).join('|'));
  const got = ['', 'due', 'co', 'todo'].map((g) => {
    const b = box({ work_my_group: g });
    const h = run(b, 'phListHTML(' + JSON.stringify(seed()) + ')');
    return shape(h);
  });
  /* 사업장 묶기만 «회사 이름을 뺀 줄»이 있다 — 머리줄이 이미 말하므로. 그 밖에는 같아야 한다 */
  const plain = got.map((rows) => rows.filter((r) => r.indexOf('"co"') >= 0)[0]);
  plain.forEach((p, i) => assert.equal(p, plain[0],
    '★ 묶기 ' + ['안 묶기', '기한', '사업장', '할 일'][i] + ' 에서 줄 모양이 달라졌습니다'));
  got.forEach((rows, i) => assert.equal(rows.length, 5,
    '★ ' + ['안 묶기', '기한', '사업장', '할 일'][i] + ' 에서 줄 수가 달라졌습니다 — 묶기는 «나누기»지 «거르기»가 아닙니다'));
});

test('② 맨 왼쪽은 ☐ + 번호 (대표 지시 2026-10-05 · 모든 프로그램)', () => {
  const b = box({});
  const r = rowsOf(run(b, 'phListHTML(' + JSON.stringify(seed()) + ')'))[0];
  const ck = r.indexOf('type="checkbox"'), no = r.indexOf('class="no"');
  assert.ok(ck >= 0, '★ 고르기 칸(☐)이 없습니다');
  assert.ok(no >= 0, '★ 번호가 없습니다');
  assert.ok(ck < no, '★ 고르기 칸이 번호보다 뒤에 있습니다 — 맨 왼쪽이 ☐ 입니다');
  /* 번호는 «보는 번호» — 열쇠로 쓰지 않는다 */
  assert.match(r, /data-i="A"/, '줄을 가리키는 것은 업무 번호(id)여야 합니다');
  /* ☐ 를 눌러도 줄이 열리면 안 된다 */
  assert.match(r, /onclick="event\.stopPropagation\(\)"/, '★ ☐ 를 누르면 서랍까지 열립니다');
});

test('③ ★ 묶기 고르개는 «지금 몇 건인지»를 미리 적는다 — 빈 칸인 줄 모르고 고르지 않게', () => {
  const b = box({});
  const c = run(b, 'phCounts(' + JSON.stringify(seed()) + ')');
  assert.equal(c.none, 5);
  assert.equal(c.due, 4, '기한(또는 다음 할 일 날짜)이 있는 것');
  assert.equal(c.co, 4, '사업장 수 — 가나상사가 둘이라 넷');
  assert.equal(c.todo, 1, '다음 할 일을 «글로» 적어 둔 것');
  /* 고르개가 그 수를 실제로 그리는가 */
  run(b, 'S._phList=' + JSON.stringify(seed()) + '; phGroupSheet();');
  const m = b.modal;
  assert.ok(/5건/.test(m) && /4건/.test(m) && /4곳/.test(m) && /1건/.test(m),
    '★ 묶기 고르개에 건수가 없습니다 — 빈 칸인 줄 모르고 고르게 됩니다');
});

test('④ 빈 묶기는 «왜 비었는지»를 말한다 — 빈 화면만 보여 주지 않는다', () => {
  const noDue = seed().map((x) => { const y = Object.assign({}, x); delete y.due; delete y.next; return y; });
  const b1 = box({ work_my_group: 'due' });
  const h1 = run(b1, 'phListHTML(' + JSON.stringify(noDue) + ')');
  assert.match(h1, /기한이 적힌 업무가/, '★ 기한이 없을 때 까닭을 말하지 않습니다');
  assert.equal(rowsOf(h1).length, 5, '말만 하고 업무를 감추면 안 됩니다');
  const b2 = box({ work_my_group: 'todo' });
  const h2 = run(b2, 'phListHTML(' + JSON.stringify(noDue) + ')');
  assert.match(h2, /적어 둔 업무가/, '★ 할 일이 없을 때 까닭을 말하지 않습니다');
  assert.equal(rowsOf(h2).length, 5);
});

test('⑤ 사업장 묶기는 접을 값어치가 있을 때만 접는다 — 업무 하나인 곳은 그냥 한 줄', () => {
  const b = box({ work_my_group: 'co' });
  const h = run(b, 'phListHTML(' + JSON.stringify(seed()) + ')');
  const heads = (h.match(/<div class="phg">([^<]*)</g) || []).map((x) => x.replace(/<[^>]*>/g, ''));
  assert.ok(heads.some((x) => /가나상사/.test(x)), '★ 업무가 둘인 곳은 머리줄로 묶어야 합니다');
  assert.ok(!heads.some((x) => /다라중공업|마바테크|사아물산/.test(x)),
    '★ 업무가 하나뿐인 곳까지 머리줄을 만들면 줄 수가 되레 늡니다');
  /* 묶인 줄에서는 회사 이름을 두 번 말하지 않는다 */
  const ind = rowsOf(h).filter((r) => / ind"/.test(r));
  assert.equal(ind.length, 2, '★ 묶인 줄이 둘이어야 합니다');
  ind.forEach((r) => assert.ok(r.indexOf('class="co"') < 0, '★ 머리줄이 말한 회사를 줄에서 또 말합니다'));
});

test('⑥ ★ 넘치는 글은 «자르지 않고» … 로 줄인다 (「한 칸은 한 줄」)', () => {
  /* 줄 그리개가 글자를 slice 로 잘라 버리면 안 된다 — 보이는 것만 줄이고 값은 그대로 */
  const fn = bare(grab('phRowHTML'));
  assert.ok(!/\.slice\(0\s*,/.test(fn), '★ 글자를 잘라 버리고 있습니다 — 줄이는 것은 CSS 가 합니다');
  /* CSS 가 실제로 … 를 만드는가 */
  assert.match(W, /\.phr \.tt\{[^}]*text-overflow:ellipsis/, '★ 업무 칸에 … 가 없습니다');
  assert.match(W, /\.phr \.co\{[^}]*text-overflow:ellipsis/, '★ 회사 칸에 … 가 없습니다');
  assert.match(W, /\.phr \.tt\{[^}]*white-space:nowrap/, '★ 업무 칸이 두 줄로 접힙니다');
});

test('⑦ 넓은 화면은 예전 그대로 — 폰에서만 기본이 바뀐다', () => {
  assert.equal(box({}).myMode(), 'table', '★ 넓은 화면에서 낯선 화면이 뜹니다');
  const phone = box({});
  phone.window = { innerWidth: 390 };
  assert.equal(run(phone, 'myMode()'), 'phone', '★ 폰에서 폰 보기로 안 열립니다');
  const chose = box({ work_my_mode: 'table' });
  chose.window = { innerWidth: 390 };
  assert.equal(run(chose, 'myMode()'), 'table', '★ 사람이 고른 보기를 안 지킵니다');
  /* 폰 갈래가 PC 머리줄을 «아예 안 만드는가» — 접어 넣으려다 세 줄이 됐던 것이 병이었다 */
  const my = bare(grab('renderMy'));
  const ph = my.indexOf("myMode()==='phone'"), hdr = my.indexOf('row hdr-my');
  assert.ok(ph > 0 && ph < hdr, '★ 폰 갈래가 PC 머리줄보다 뒤에 있습니다 — 헛일을 합니다');
});

test('⑧ 고른 묶기는 이 기기에만 남는다 — 남의 화면은 안 바뀐다', () => {
  const b = box({});
  assert.equal(b.myGroup(), '', '처음에는 안 묶기');
  run(b, 'setMyGroup("co")');
  assert.equal(b.saved[run(b, 'MYGRP_KEY')], 'co', '★ 고른 것을 안 기억합니다');
  assert.equal(box({ work_my_group: 'co' }).myGroup(), 'co', '다음에 올 때도 기억합니다');
  assert.equal(box({ work_my_group: '엉뚱' }).myGroup(), '', '없는 묶기는 안 묶기로 돌아갑니다');
  /* 서버에 보내지 않는다 — 남의 화면이 바뀌면 안 된다 */
  const fn = bare(grab('setMyGroup'));
  assert.ok(!/fbDb|work_erp/.test(fn), '★ 고른 묶기를 서버에 보내고 있습니다');
});

test('⑨ 기한 딱지는 지났나·이레 안인가로만 가른다', () => {
  const b = box({});
  const d = (it) => run(b, 'phDue(' + JSON.stringify(it) + ')');
  assert.match(d({ due: inDays(-3) }), /phd x[^>]*>D\+3/, '지난 것은 빨강');
  assert.match(d({ due: inDays(0) }), /phd x[^>]*>D-Day/, '오늘도 빨강');
  assert.match(d({ due: inDays(5) }), /phd s[^>]*>D-5/, '이레 안은 노랑');
  assert.match(d({ due: inDays(30) }), /phd o[^>]*>D-30/, '더 나중은 초록');
  assert.match(d({}), /phd n[^>]*>—/, '기한이 없으면 — 하나');
});
