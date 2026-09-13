'use strict';
/* ⬇ 표 맨 아래 「더 보기」 (대표 지시 2026-09-13)
   ─────────────────────────────────────────────────────────────
   대표 지시: 「가장 아래에 개수가 넘어가면 추가로 더 볼 수 있게 해달라.
   이것은 경력관리 모든 대시보드 탭에 해당되게 해라.」

   목록은 기본 50건만 그린다(2026-09-05 「멈춤」의 약이다 — 373행은 300~500ms,
   50행은 수십 ms). 그런데 그다음을 보려면 «표 꼭대기»의 「표시」 선택칸까지
   되돌아 올라가야 했다. 끝까지 내려간 사람은 위로 안 올라간다.

   여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ① 넘칠 때만 나온다 — 다 본 자리에 죽은 단추가 남지 않는다
     ② 더 보기는 「표시 개수」를 «건드리지 않는다» — 건드리면 위 선택칸이
        20·50·100·200 어디에도 안 맞아 엉뚱한 값이 골라진 것처럼 보인다
     ③ 펼친 판은 저장하지 않는다 — 저장하면 다음에 열 때 375행이 그려져 다시 굳는다
     ④ 표 «아래»에 온다 — 그게 이 지시의 전부다
     ⑤ 목록 화면 하나하나가 아니라 «공통 그리개» 한 곳에서 나온다
        (그래서 회의·비용관리까지 함께 — 대표 상시 지시)
     ⑥ 더 보고 나서도 보던 자리에 그대로 있는다 */
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

/* 셈하는 두 함수만 떼어 실제로 돌린다 */
function 셈() {
  const ctx = { String, Number, _jsAttr: (x) => String(x == null ? '' : x).replace(/'/g, "\\'") };
  vm.createContext(ctx);
  vm.runInContext(cutFn(CODE, 'function pageViewCount('), ctx);
  vm.runInContext(cutFn(CODE, 'function moreRowsBar('), ctx);
  return ctx;
}

/* 「더 보기」를 눌렀을 때 무슨 일이 일어나는지 — 다시 그리는 일은 흉내만 낸다 */
function 눌러보기() {
  const 담김 = {};
  const main = { scrollTop: 0 };
  const 그린것 = [];
  const ctx = {
    String, Number, JSON, console,
    document: { querySelector: (sel) => (sel === '.main' ? main : null) },
    NS: 'cm3_',
    LS: { get: (k) => 담김[k] || null, set: (k, v) => { 담김[k] = v; } },
    /* 다시 그리면 스크롤 상자가 위로 튀는 상황을 그대로 만든다 */
    renderCareer: (n) => { 그린것.push(n); main.scrollTop = 0; },
    _담김: 담김, _main: main, _그린것: 그린것
  };
  vm.createContext(ctx);
  vm.runInContext('var _pageLimit={}, _pageStep={};', ctx);
  ['var _PGLIMIT_KEY', 'function _pgLimitLoad(', 'function pageLimitOf(', 'function setPageLimit(',
    'function pageStepOf(', 'function _pageKeepScroll(', 'function pageMore(', 'function pageAllRows(']
    .forEach((d) => {
      if (d.startsWith('var ')) { vm.runInContext("var _PGLIMIT_KEY='pglimit';", ctx); return; }
      vm.runInContext(cutFn(CODE, d), ctx);
    });
  vm.runInContext('var PAGE_LIMIT_DEFAULT=' + (CODE.match(/PAGE_LIMIT_DEFAULT\s*=\s*(\d+)/) || [0, '50'])[1] + ';', ctx);
  return ctx;
}

test('① 다 보이면 더 보기 줄이 아예 없다 — 죽은 단추를 남기지 않는다', () => {
  const c = 셈();
  assert.equal(c.moreRowsBar('wiccok', 50, 375, 375), '', '다 보이는데도 더 보기가 나왔습니다');
  assert.equal(c.moreRowsBar('wiccok', 50, 12, 12), '');
  assert.equal(c.moreRowsBar('wiccok', -1, 375, 375), '', '「전체」로 볼 때도 안 나와야 합니다');
});

test('② 넘칠 때는 나오고, 남은 건수를 사실대로 적는다', () => {
  const c = 셈();
  const h = c.moreRowsBar('advisory', 50, 50, 375);
  assert.match(h, /more-rows/);
  assert.match(h, /pageMore\('advisory'\)/, '더 보기가 이 화면을 가리켜야 합니다');
  assert.match(h, /pageAllRows\('advisory'\)/, '「전체 보기」 길이 있어야 합니다');
  assert.ok(h.indexOf('325') >= 0, '남은 325건이 적혀 있어야 합니다: ' + h);
  assert.ok(h.indexOf('50 / 375') >= 0, '「지금/전체」가 보여야 합니다: ' + h);
});

test('③ 마지막 판에서는 «남은 만큼만» 권한다 — 「50건 더」인데 25건이면 거짓말이다', () => {
  const c = 셈();
  const h = c.moreRowsBar('advisory', 50, 350, 375);
  assert.match(h, /⬇ 25건 더 보기/, '남은 25건보다 크게 말하면 안 됩니다: ' + h);
});

test('④ 보이는 건수 = 표시 개수 × 펼친 판 (전체를 넘지 않는다)', () => {
  const c = 셈();
  assert.equal(c.pageViewCount(50, 1, 375), 50);
  assert.equal(c.pageViewCount(50, 2, 375), 100, '한 번 더 보면 한 판만큼 늘어야 합니다');
  assert.equal(c.pageViewCount(50, 3, 375), 150);
  assert.equal(c.pageViewCount(50, 99, 375), 375, '전체 건수를 넘으면 안 됩니다');
  assert.equal(c.pageViewCount(-1, 1, 375), 375, '「전체(느림)」은 전부입니다');
  assert.equal(c.pageViewCount(50, 0, 375), 50, '펼친 판이 없으면 한 판입니다');
});

test('⑤ 더 보기는 「표시 개수」를 건드리지 않는다 — 위 선택칸이 어긋나면 안 된다', () => {
  const c = 눌러보기();
  vm.runInContext("setPageLimit('advisory', 50);", c);
  const 담긴것 = JSON.stringify(c._담김);
  vm.runInContext("pageMore('advisory'); pageMore('advisory');", c);
  assert.equal(vm.runInContext("pageLimitOf('advisory')", c), 50, '표시 개수가 바뀌었습니다');
  assert.equal(vm.runInContext("pageStepOf('advisory')", c), 3, '두 번 눌렀으면 세 판이어야 합니다');
  assert.equal(JSON.stringify(c._담김), 담긴것, '펼친 판을 브라우저에 저장했습니다 — 다음에 열 때 다시 굳습니다');
});

test('⑥ 표시 개수를 새로 고르면 펼친 판은 처음으로 돌아간다', () => {
  const c = 눌러보기();
  vm.runInContext("pageMore('advisory'); pageMore('advisory');", c);
  assert.equal(vm.runInContext("pageStepOf('advisory')", c), 3);
  vm.runInContext("setPageLimit('advisory', 100);", c);
  assert.equal(vm.runInContext("pageStepOf('advisory')", c), 1, '개수를 새로 골랐는데 옛 판이 남았습니다');
});

test('⑦ 화면마다 따로 센다 — 위촉장을 펼쳤다고 실적까지 펼쳐지면 안 된다', () => {
  const c = 눌러보기();
  vm.runInContext("pageMore('wiccok');", c);
  assert.equal(vm.runInContext("pageStepOf('wiccok')", c), 2);
  assert.equal(vm.runInContext("pageStepOf('advisory')", c), 1);
});

test('⑧ 「전체 보기」는 한 번에 끝까지 — 375건을 일곱 번 누르게 하지 않는다', () => {
  const c = 눌러보기();
  vm.runInContext("pageAllRows('advisory');", c);
  const step = vm.runInContext("pageStepOf('advisory')", c);
  assert.ok(step * 50 >= 100000, '한 번으로 아주 큰 목록까지 덮어야 합니다 (판=' + step + ')');
});

test('⑨ 더 보고 나서도 보던 자리에 있는다 — 다시 그려도 위로 튀지 않는다', () => {
  const c = 눌러보기();
  c._main.scrollTop = 1840;
  vm.runInContext("pageMore('advisory');", c);
  assert.deepEqual(c._그린것, ['advisory'], '다시 그리기는 해야 합니다');
  assert.equal(c._main.scrollTop, 1840, '더 보기를 눌렀더니 맨 위로 튀었습니다');
});

test('⑩ 표 «아래»에 붙는다 — 지시의 전부가 자리다', () => {
  const fn = cutFn(CODE, 'function renderCareer(');
  /* 표를 조립하는 «그 문장»만 떼어 본다 — 문장 밖을 같이 보면 위에 덧붙여도 통과한다 */
  const 표자리 = fn.indexOf('</tbody></table>');
  assert.ok(표자리 > 0, '표를 그리는 대목을 찾지 못했습니다');
  const 시작 = fn.lastIndexOf('box.innerHTML=', 표자리);
  assert.ok(시작 > 0, '표를 어디에 넣는지 찾지 못했습니다');
  const 끝 = fn.indexOf(';\n', 표자리);
  const 문장 = fn.slice(시작, 끝 > 0 ? 끝 : fn.length);
  const 표끝 = 문장.indexOf('</tbody></table>');
  const 자리들 = [];
  for (let i = 문장.indexOf('moreBar'); i >= 0; i = 문장.indexOf('moreBar', i + 1)) 자리들.push(i);
  assert.ok(자리들.length > 0, '더 보기 줄이 표에 붙어 있지 않습니다');
  자리들.forEach((i) => {
    assert.ok(i > 표끝, '더 보기 줄이 표보다 «위»에 있습니다 (' + i + ' < ' + 표끝 + ')');
  });
});

test('⑪ 공통 그리개 한 곳에서 나온다 — 그래서 모든 탭에 함께 생긴다', () => {
  const fn = cutFn(CODE, 'function renderCareer(');
  assert.ok(fn.indexOf('moreRowsBar(') > 0, '공통 그리개가 더 보기 줄을 만들지 않습니다');
  /* 목록 화면마다 따로 박아 두면 새 탭이 늘 때 한쪽만 고쳐져 어긋난다 */
  const 쓴횟수 = (CODE.match(/moreRowsBar\(/g) || []).length;
  assert.equal(쓴횟수, 2, '만드는 곳 하나 + 부르는 곳 하나여야 합니다 (지금 ' + 쓴횟수 + ')');
});

test('⑫ 보이는 건수도 공통 그리개가 셈 함수로 정한다 — 두 곳이 어긋나지 않게', () => {
  const fn = cutFn(CODE, 'function renderCareer(');
  assert.ok(fn.indexOf('pageViewCount(') > 0, '보이는 건수를 따로 셈하고 있습니다');
});
