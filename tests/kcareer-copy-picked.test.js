'use strict';
/* 📋 골라서 복사 (대표 지시 2026-09-13 「목업대로」)
   ─────────────────────────────────────────────────────────────
   대표 물음: 「특정 단어나 위촉인·발급일 등을 발췌해서 복사·붙여넣기 해야 할 수 있는데
   이런 부분은 어떻게 하면 쉽게 가능할까?」

   목록에서 줄을 고르면 할 수 있는 일이 «지우기뿐»이었다. 위촉인·발급일만 뽑아
   한글·엑셀·메일에 붙이려면 CSV 를 내려받아 엑셀에서 다시 복사해야 했다.

   ■ 얼개 — 표를 «보이는 대로» 읽는다
   화면에 그려진 칸 글자를 그대로 집는다. 그래서 검색·연도·유형으로 거른 것이
   그대로 따라오고(「특정 낱말 발췌」가 이 길이다), 화면마다 칸이 달라도
   사전을 따로 둘 일이 없다.

   여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ① 「№」·「관리」는 복사하지 않는다 — 번호는 화면용, 관리는 단추다
     ② 고른 게 없으면 «보이는 것 전부» — 체크를 안 했다고 헛걸음이면 안 된다
     ③ 칸을 끄면 그 칸이 빠지고, 그 선택을 기억한다
     ④ 한 줄씩·쉼표는 «빈 칸을 빼고» 잇는다
     ⑤ 클립보드가 막혀도 복사가 된다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
const CODE = stripComments(SRC);

function cutFn(s, decl) {
  const head = s.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = s.indexOf('{', head + decl.length), depth = 0;
  for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (!depth) break; } }
  return s.slice(head, i + 1);
}

/* 화면에 그려진 표를 흉내 낸다 — 머리줄 이름과 줄 글자, 그리고 체크 상태 */
function 세상(머리, 줄들, 체크) {
  const 칩 = () => ({ classList: { _s: {}, toggle(c, on) { if (on === undefined) on = !this._s[c]; if (on) this._s[c] = 1; else delete this._s[c]; return !!this._s[c]; }, add() {}, remove() {} } });
  const th = (nm) => ({ textContent: nm });
  const td = (t) => ({ textContent: t });
  const tr = (v, on) => ({
    children: v.map(td),
    querySelector: (sel) => (sel === '.row-chk' ? { checked: !!on } : null)
  });
  const rows = 줄들.map((v, i) => tr(v, 체크 && 체크[i]));
  const tbl = {
    querySelectorAll: (sel) => (sel === 'thead th' ? 머리.map(th)
      : sel === 'tbody tr' ? rows : [])
  };
  const 담김 = {};
  const els = {};
  ['cpCols', 'cpWho', 'cpPrev', 'cpCnt', 'modalCopyPick'].forEach((id) => {
    els[id] = { innerHTML: '', textContent: '', dataset: {},
      classList: { _s: {}, add(c) { this._s[c] = 1; }, remove(c) { delete this._s[c]; }, contains(c) { return !!this._s[c]; } } };
  });
  const ctx = {
    console, String, Array, Object, Number, JSON, RegExp,
    document: { getElementById: (id) => els[id] || null },
    escapeHtml: (x) => String(x == null ? '' : x),
    toast: (m) => { 담김.알림 = String(m); },
    NS: 'cm3_',
    LS: { get: (k) => 담김[k] || null, set: (k, v) => { 담김[k] = v; }, remove: (k) => { delete 담김[k]; } },
    navigator: {},
    _selBox: () => ({ querySelector: (sel) => (sel === 'table' ? tbl : null) }),
    _담김: 담김, _els: els, _칩: 칩
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext('var _cpName="", _cpFmt="tab", _cpHead=true, _cpOff={};', ctx);
  ['function _cpKey(', 'function _cpLoadOff(', 'function _cpSaveOff(', 'function _cpGrid(',
   'function copyPickOpen(', 'function closeCopyPick(', 'function copyPickCol(',
   'function copyPickHead(', 'function copyPickText(', 'function copyPickDraw(']
    .forEach((d) => vm.runInContext(cutFn(CODE, d), ctx));
  return ctx;
}

const 머리 = ['№', 'ID', '유형', '위촉내용(직책)', '발급기관', '위촉인', '발급일', '관리'];
const 줄들 = [
  ['1', '위촉장2026-007', '위촉장', '노동정책 심의위원', '가나도', '가나도지사', '2026.08.14', '보기·편집 저장 삭제'],
  ['2', '위촉장2026-010', '위촉장', '노사분쟁 조정위원', '가나도', '가나도지사', '2026.07.30', '보기·편집 저장 삭제'],
  ['3', '위촉장2026-011', '위촉장', '컨설턴트', '가나경제진흥원', '진흥원장', '2026.04.29', '보기·편집 저장 삭제']
];

test('★ 「№」와 「관리」는 복사하지 않는다 — 번호는 화면용, 관리는 단추다', () => {
  const ctx = 세상(머리, 줄들, [true, false, false]);
  vm.runInContext('copyPickOpen("wiccok")', ctx);
  const t = vm.runInContext('copyPickText()', ctx);
  assert.equal(t.indexOf('보기·편집'), -1, '관리 칸의 단추 글자가 복사됐습니다: ' + t);
  assert.equal(t.split('\n')[0].split('\t')[0], 'ID', '머리줄이 ID 로 시작해야 합니다: ' + t.split('\n')[0]);
});

test('★ 고른 줄이 있으면 «고른 것만»', () => {
  const ctx = 세상(머리, 줄들, [true, false, true]);
  vm.runInContext('copyPickOpen("wiccok")', ctx);
  const t = vm.runInContext('copyPickText()', ctx);
  assert.equal(t.split('\n').length, 3, '머리줄 + 2건이어야 합니다: ' + t);
  assert.ok(t.indexOf('노사분쟁') < 0, '안 고른 줄이 들어갔습니다');
  assert.ok(ctx._els.cpWho.textContent.indexOf('고른') >= 0, '무엇을 담는지 안 말해 줍니다');
});

test('★★ 고른 게 «하나도 없으면» 보이는 것 전부 — 체크를 안 했다고 헛걸음이면 안 된다', () => {
  const ctx = 세상(머리, 줄들, [false, false, false]);
  vm.runInContext('copyPickOpen("wiccok")', ctx);
  const t = vm.runInContext('copyPickText()', ctx);
  assert.equal(t.split('\n').length, 4, '머리줄 + 3건이어야 합니다: ' + t);
  assert.ok(ctx._els.cpWho.textContent.indexOf('보이는 것 전부') >= 0,
    '전부를 담는다고 안 말해 줍니다: ' + ctx._els.cpWho.textContent);
});

test('★ 칸을 끄면 그 칸이 빠지고, 그 선택을 «기억»한다', () => {
  const ctx = 세상(머리, 줄들, [true, false, false]);
  vm.runInContext('copyPickOpen("wiccok")', ctx);
  /* 칸 0 = ID 를 끈다 (머리줄의 № 를 뺀 뒤의 첫 칸) */
  vm.runInContext('copyPickCol(0, _칩())', ctx);
  const t = vm.runInContext('copyPickText()', ctx);
  assert.equal(t.indexOf('위촉장2026-007'), -1, '끈 칸이 그대로 나옵니다: ' + t);
  /* 담긴 것은 «끈 칸»뿐이어야 한다 — 칸이 늘면 새 칸은 켜진 채 나와야 하기 때문이다 */
  const 담김 = JSON.parse(ctx._담김['cm3_copypick_wiccok'] || '[]');
  assert.deepEqual(담김, ['ID'], '끈 칸을 기억하지 않습니다: ' + JSON.stringify(담김));

  /* 새 창을 열면 그대로 꺼져 있어야 한다 */
  const ctx2 = 세상(머리, 줄들, [true, false, false]);
  ctx2._담김['cm3_copypick_wiccok'] = JSON.stringify(['ID']);
  vm.runInContext('copyPickOpen("wiccok")', ctx2);
  assert.equal(vm.runInContext('copyPickText()', ctx2).indexOf('위촉장2026-007'), -1,
    '다음에 열 때 기억한 대로 안 나옵니다');
});

test('★ 칸이 늘어나면 새 칸은 «켜진 채»로 나온다 — 끈 것만 기억하기 때문이다', () => {
  const ctx = 세상(머리.concat(['비고']), 줄들.map((r) => r.concat(['메모'])), [true, false, false]);
  ctx._담김['cm3_copypick_wiccok'] = JSON.stringify(['ID']);
  vm.runInContext('copyPickOpen("wiccok")', ctx);
  assert.ok(vm.runInContext('copyPickText()', ctx).indexOf('메모') >= 0,
    '새로 생긴 칸이 꺼진 채 나옵니다');
});

test('★ 표 모양은 탭으로 가른다 — 엑셀에 붙으면 칸이 갈라져야 한다', () => {
  const ctx = 세상(머리, 줄들, [true, false, false]);
  vm.runInContext('copyPickOpen("wiccok")', ctx);
  const t = vm.runInContext('copyPickText()', ctx);
  assert.ok(t.indexOf('\t') >= 0, '탭이 없습니다 — 엑셀에서 한 칸에 다 들어갑니다');
  assert.equal(t.split('\n')[1].split('\t').length, t.split('\n')[0].split('\t').length,
    '머리줄과 값 줄의 칸 수가 다릅니다');
});

test('★ 머리줄을 끄면 값만 나온다', () => {
  const ctx = 세상(머리, 줄들, [true, false, false]);
  vm.runInContext('copyPickOpen("wiccok")', ctx);
  vm.runInContext('copyPickHead(_칩())', ctx);
  const t = vm.runInContext('copyPickText()', ctx);
  assert.equal(t.split('\n').length, 1, '머리줄을 껐는데 남아 있습니다: ' + t);
  assert.equal(t.indexOf('발급기관'), -1, '머리줄 이름이 남아 있습니다');
});

test('★ 한 줄씩·쉼표는 «빈 칸을 빼고» 잇는다 — 「가나도 /  / 2026」이 되면 안 된다', () => {
  const 빈것 = [['1', 'W1', '위촉장', '', '가나도', '', '2026.08.14', '삭제']];
  const ctx = 세상(머리, 빈것, [true]);
  vm.runInContext('copyPickOpen("wiccok")', ctx);
  vm.runInContext('_cpFmt="line"; _cpHead=false;', ctx);
  const t = vm.runInContext('copyPickText()', ctx);
  assert.equal(t.indexOf('/  /'), -1, '빈 칸이 사이에 남았습니다: ' + t);
  assert.equal(t.indexOf('//'), -1, '빈 칸이 사이에 남았습니다: ' + t);
  vm.runInContext('_cpFmt="comma";', ctx);
  const c = vm.runInContext('copyPickText()', ctx);
  assert.equal(c.indexOf('\n'), -1, '쉼표 모양은 한 덩어리여야 합니다: ' + c);
});

test('★ 칸을 다 끄면 «빈 글자»를 주고, 무엇을 해야 하는지 적어 준다', () => {
  const ctx = 세상(머리, 줄들, [true, false, false]);
  vm.runInContext('copyPickOpen("wiccok")', ctx);
  vm.runInContext('_cpOff={ID:1,"유형":1,"위촉내용(직책)":1,"발급기관":1,"위촉인":1,"발급일":1}; copyPickDraw();', ctx);
  assert.equal(vm.runInContext('copyPickText()', ctx), '');
  assert.ok(ctx._els.cpPrev.textContent.indexOf('칸을 하나는') >= 0,
    '무엇을 해야 하는지 안 알려 줍니다: ' + ctx._els.cpPrev.textContent);
});

test('★ 단추가 «선택 줄»에 있고 손잡이가 이어져 있다 — 한 곳에 달면 모든 목록에 달린다', () => {
  const bar = CODE.slice(CODE.indexOf("const selBar='<div class=\"sel-bar\""),
                         CODE.indexOf("const selBar='<div class=\"sel-bar\"") + 900);
  assert.match(bar, /copyPickOpen\(/, '선택 줄에 복사 단추가 없습니다');
  assert.match(bar, /careerDelSelected\(/, '전제: 선택 줄을 찾은 것이 맞습니다');
  ['copyPickOpen', 'copyPickText', 'copyPickDo', 'copyPickCol', 'copyPickFmt', 'copyPickHead']
    .forEach((fn) => assert.ok(CODE.indexOf('function ' + fn + '(') >= 0, fn + ' 이 없습니다'));
});

test('★ 클립보드가 막혀도 복사가 된다 — 「눌렀는데 아무 일이 없다」를 막는다', () => {
  const 하기 = cutFn(CODE, 'function copyPickDo(');
  assert.match(하기, /_cpFallback\(/, '예비 길이 없습니다');
  const 예비 = cutFn(CODE, 'function _cpFallback(');
  assert.match(예비, /execCommand\('copy'\)/, '예비 길이 실제로 복사하지 않습니다');
  assert.match(예비, /removeChild/, '만든 칸을 치우지 않습니다 — 화면에 쌓입니다');
});

test('칸 사전을 «따로» 두지 않았다 — 화면마다 칸이 달라도 보이는 대로 읽는다', () => {
  const 읽기 = cutFn(CODE, 'function _cpGrid(');
  assert.match(읽기, /thead th/, '머리줄을 화면에서 안 읽습니다');
  assert.match(읽기, /tbody tr/, '값 줄을 화면에서 안 읽습니다');
  assert.doesNotMatch(읽기, /CAREER_CFG/,
    '칸 사전을 따로 보고 있습니다 — 화면이 늘면 한쪽만 고쳐져 어긋납니다');
});
