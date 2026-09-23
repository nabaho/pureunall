/* 캘린더 칩 — «내 일이 먼저 눈에 들어오게», 사람 색은 겹치지 않게
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 「본인의 업무가 구분되게 색조정」+ 「각 사람마다의 색을
   어떻게 중복되지 않게 할 것인가」. 견본 셋(구글식 채움·내 것만 채움·조용하게)을
   9월 실제 일정으로 그려 보여 드리고 「1」(구글식 채움 — 모두 채우되 내 일은
   원색으로, 남의 일은 옅게+왼쪽 띠)을 골랐다.

   ★ 뿌리 — 실측으로 확인한 문제 둘
     ① 글자색에 74%를 섞어 쓰던 예전 판은 18명 색이 «어두운 구석으로 다 뭉쳤다»
       (가장 닮은 두 사람 ΔE 7.1 → 2.7, 사실상 같은 색).
     ② 직원 색(구글이 정함)과 외부 협력자 색(사람이 손으로 넣음)이 «따로 자란
       색표»라, 장한돌·박병훈이 ΔE 7.1로 거의 같은 보라였다.
   ★ 지금 — 채우는 판으로 되돌리되(①), 외부 협력자를 새로 넣을 때는
     «지금 쓰이는 모든 색과 가장 먼 색»을 준다(②, pu-erp.html의 extNextColor). */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
const 이알피 = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

function 함수몸(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

/* ── pu-cal.html chipHtml 을 실제로 돌려 본다 ── */
function 칩상자() {
  const 상자 = {
    console, String, Object, Array, JSON, Math,
    S: { theme: 'light' },
    ME: { sid: 'S001', name: '나' },
    todayYMD: () => '2000-01-01',
    esc: (s) => String(s == null ? '' : s)
  };
  vm.createContext(상자);
  vm.runInContext(함수몸(캘린더, 'function 상대밝기(bg){'), 상자);
  vm.runInContext(함수몸(캘린더, 'function 대비(a, b){'), 상자);
  vm.runInContext(함수몸(캘린더, 'function textOn(bg){'), 상자);
  vm.runInContext(함수몸(캘린더, 'function mixHex(hexA, hexB, t){'), 상자);
  /* chipHtml 이 참조하는 모듈급 상수 둘 — 소스에서 그대로 뽑아 온다(값을 여기서
     다시 못 박지 않는다. 소스가 바뀌면 이 상자도 그 값을 그대로 따라간다). */
  const 어둠누름 = 캘린더.match(/var 칩_어둠_누름 = [^;]+;/);
  const 옅게 = 캘린더.match(/var 칩_옅게\s*= [^;]+;/);
  assert.ok(어둠누름 && 옅게, 'chipHtml 상수(칩_어둠_누름·칩_옅게)를 못 찾았습니다');
  vm.runInContext(어둠누름[0], 상자);
  vm.runInContext(옅게[0], 상자);
  vm.runInContext(함수몸(캘린더, 'function chipHtml(e, ymd){'), 상자);
  return 상자;
}
function 칩그리기(상자, e, ymd) {
  vm.runInContext('var __h = chipHtml(' + JSON.stringify(e) + ', ' + JSON.stringify(ymd || '2099-01-01') + ');', 상자);
  return 상자.__h;
}

test('① 내 일정은 «채운다» — 남의 일정은 옅게 깔고 왼쪽에 원래 색 띠를 남긴다', () => {
  const 상자 = 칩상자();
  const 내것 = 칩그리기(상자, { sid: 'S001', color: '#5484ed', text: '내 미팅', store: 's', id: '1' });
  const 남것 = 칩그리기(상자, { sid: 'S002', color: '#5484ed', text: '남 미팅', store: 's', id: '2' });

  assert.match(내것, /background:#5484ed/i, '내 일정이 원색으로 안 찹니다: ' + 내것);
  assert.strictEqual(/border-left/.test(내것), false, '내 일정에까지 띠를 그립니다 — 채움으로 이미 표가 됩니다');

  assert.match(남것, /border-left:3px solid #5484ed/i, '남의 일정에 원래 색 띠가 없습니다: ' + 남것);
  const 남바탕 = (남것.match(/background:(#[0-9a-fA-F]{6})/) || [])[1];
  assert.ok(남바탕, '남의 일정 바탕색을 못 읽었습니다: ' + 남것);
  assert.notStrictEqual(남바탕.toLowerCase(), '#5484ed', '남의 일정이 원색 그대로입니다 — 내 것과 안 갈라집니다');
});

test('② sid 가 없으면(외부 협력자 등) 아무것도 «내 것»이 아니다', () => {
  const 상자 = 칩상자();
  const 외부것 = 칩그리기(상자, { sid: 'EXT_x1', color: '#7c3aed', text: '외부 일정', store: 's', id: '3' });
  assert.match(외부것, /border-left/, '외부 협력자 일정이 «내 것»처럼 채워집니다: ' + 외부것);
});

test('③ 글자색은 «실제 대비»로 고른다 — 초록처럼 밝은 색도 안 읽히지 않는다', () => {
  /* 옛 textOn(사람 눈 밝기 어림, 0.62 문턱)은 #51b749(초록) 위에 짙은 글자를 놓아
     대비 2.55:1까지 떨어졌다 — 대비를 직접 재는 지금 셈으로는 그런 색이 없어야 한다. */
  const 상자 = 칩상자();
  vm.runInContext('var __c = 대비("#51b749", textOn("#51b749"));', 상자);
  assert.ok(상자.__c >= 4.5, '초록 위 글자 대비가 낮습니다: ' + 상자.__c);
});

test('④ 어두운판에서도 «채운다» 규칙은 같다', () => {
  const 상자 = 칩상자();
  vm.runInContext("S.theme = 'dark';", 상자);
  const 내것 = 칩그리기(상자, { sid: 'S001', color: '#a4bdfc', text: '내 미팅', store: 's', id: '1' });
  assert.match(내것, /background:#/i, '어두운판에서 내 일정이 안 찹니다: ' + 내것);
});

test('⑤ 지난 일정은 여전히 흐리게 표시한다(opacity)', () => {
  const 상자 = 칩상자();
  const 지남 = 칩그리기(상자, { sid: 'S001', color: '#5484ed', text: '지난 일', store: 's', id: '1' }, '1999-01-01');
  assert.match(지남, /opacity:\.65/, '지난 일정 흐림 표시가 없습니다: ' + 지남);
});

/* ── pu-erp.html extNextColor — 외부 협력자 색이 겹치지 않는지 ── */

function 색상자() {
  const 상자 = { console, String, Object, Array, JSON, Math };
  vm.createContext(상자);
  const 후보 = 이알피.match(/var EXT_COLOR_CANDIDATES = \[[\s\S]*?\];/);
  assert.ok(후보, 'EXT_COLOR_CANDIDATES 를 못 찾았습니다');
  vm.runInContext(후보[0], 상자);
  vm.runInContext(함수몸(이알피, 'function extColorDistance(hexA, hexB){'), 상자);
  vm.runInContext(함수몸(이알피, 'function extNextColor(existingColors){'), 상자);
  return 상자;
}

test('⑥ extNextColor — 이미 쓰는 색과 «가장 먼» 새 색을 준다', () => {
  const 상자 = 색상자();
  vm.runInContext('var __c = extNextColor(["#7c3aed"]);', 상자);
  vm.runInContext('var __d = extColorDistance(__c, "#7c3aed");', 상자);
  assert.ok(상자.__d > 30, '이미 쓰는 색과 너무 가깝습니다(ΔE ' + 상자.__d + '): ' + 상자.__c);
});

test('⑦ extNextColor — 실제 문제였던 짝(장한돌 #7c3aed · 박병훈 #9333ea)이 다시 나오지 않는다', () => {
  const 상자 = 색상자();
  vm.runInContext('var __c = extNextColor(["#7c3aed", "#9333ea"]);', 상자);
  vm.runInContext('var __d1 = extColorDistance(__c, "#7c3aed");', 상자);
  vm.runInContext('var __d2 = extColorDistance(__c, "#9333ea");', 상자);
  assert.ok(Math.min(상자.__d1, 상자.__d2) > 20,
    '두 보라와 너무 가까운 색을 골랐습니다: ' + 상자.__c + ' (ΔE ' + 상자.__d1 + ', ' + 상자.__d2 + ')');
});

test('⑧ extNextColor — 직원 열 명 색과도 겹치지 않는다(실제 열 명 값)', () => {
  const 직원색 = ['#a4bdfc', '#7ae7bf', '#dbadff', '#ff887c', '#fbd75b',
    '#ffb878', '#46d6db', '#e1e1e1', '#5484ed', '#51b749'];
  const 상자 = 색상자();
  let 새로 = [];
  let 지금까지 = 직원색.slice();
  for (let i = 0; i < 8; i++) {
    vm.runInContext('var __c = extNextColor(' + JSON.stringify(지금까지) + ');', 상자);
    새로.push(상자.__c);
    지금까지 = 지금까지.concat([상자.__c]);
  }
  /* 새로 뽑힌 여덟 + 직원 열 명 — 어느 두 색을 집어도 ΔE 20 이상이어야 한다 */
  const 전체 = 직원색.concat(새로);
  let 최소 = Infinity, 짝 = null;
  for (let i = 0; i < 전체.length; i++) for (let j = i + 1; j < 전체.length; j++) {
    vm.runInContext('var __d = extColorDistance(' + JSON.stringify(전체[i]) + ',' + JSON.stringify(전체[j]) + ');', 상자);
    if (상자.__d < 최소) { 최소 = 상자.__d; 짝 = [전체[i], 전체[j]]; }
  }
  assert.ok(최소 >= 20, '색 여덟 개를 새로 뽑아도 겹치는 짝이 남습니다(ΔE ' + 최소.toFixed(1) + '): ' + 짝.join(' vs '));
});

test('⑨ extNextColor — 후보가 팔레트 27색 규율 예외로 등록돼 있다(따로 새 색을 안 만든다)', () => {
  /* 색 값 자체가 «규칙»이다 — 24개 후보는 미리 재 둔 값이고, 늘리려면 재보고 늘려야 한다.
     검사고정-허용: 후보 개수는 «지금 값»이 아니라 그 자체가 팔레트다. */
  const m = 이알피.match(/var EXT_COLOR_CANDIDATES = \[([\s\S]*?)\];/);
  assert.ok(m, 'EXT_COLOR_CANDIDATES 를 못 찾았습니다');
  const n = (m[1].match(/#[0-9a-fA-F]{6}/g) || []).length;
  assert.strictEqual(n, 24, '후보 색 개수가 24가 아닙니다(' + n + ') — 늘렸다면 서로 ΔE 20 이상인지 다시 재고 이 숫자를 고치세요');
});
