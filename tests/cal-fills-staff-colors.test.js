/* 푸른 캘린더가 «빠진 사람 색»을 채운다 — 캘린더 한 곳으로 모으기 1걸음
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 「0부터 순서대로」. 0걸음(일정 표 지도형)에 이어 1걸음.

   ★ 왜 필요한가
     data/staff_colors 를 «쓰는 곳»이 이알피 법인 대시보드 한 곳뿐이었다.
     그 화면을 걷어내면 새로 온 직원에게 색이 영영 안 생기고, 컨설팅일정까지
     같은 자리를 읽으므로 두 앱이 함께 회색이 된다.

   ★ 이알피와 «다른» 방식을 일부러 골랐다 — 통째로 다시 셈하지 않고 «빠진 사람만» 채운다.
     이알피는 그 PC 에만 있는 손수 고른 색(localStorage)을 섞어 셈하므로, 같은 셈을
     흉내 내 통째로 올리면 다른 자리에서 고른 색을 덮는다. 없는 칸만 채우면
     두 앱이 함께 돌아도 서로 안 싸운다.

   ★ 지키려는 것 (tests/staff-colors-no-fallback-push.test.js 가 이알피에 건 것과 같은 규칙)
     ① 이미 색이 있는 사람은 «절대» 안 건드린다
     ② 새 사람에게는 «아직 아무도 안 쓰는» 색을 준다
     ③ 구글 색표가 안 왔으면 아무것도 안 한다(되돌아갈 색으로 진짜 색을 덮지 않는다)
     ④ 관리자만 · 현직만 · 채울 사람 없으면 안 올린다
     ⑤ 저장 문이 빈 지도·이상한 색·이상한 사번을 막는다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

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

/* 고르는 셈을 «진짜로» 돌린다 */
function 채우기() {
  const 상자 = { console, Object, Array, String };
  vm.createContext(상자);
  vm.runInContext(함수몸(캘린더, 'function 빠진색채우기(있는색, 사람들, 색표){'), 상자);
  return (있는색, 사람들, 색표) => {
    상자.__a = 있는색; 상자.__b = 사람들; 상자.__c = 색표;
    vm.runInContext('var __r = 빠진색채우기(__a, __b, __c);', 상자);
    return 상자.__r;
  };
}
const 구글색표 = ['#a4bdfc', '#7ae7bf', '#dbadff', '#ff887c', '#fbd75b'];
const 사람 = (sid) => ({ sid: sid, name: '홍길동', status: 'active' });

test('① 이미 색이 있는 사람은 건드리지 않는다', () => {
  const f = 채우기();
  const 새로 = f({ 'P-001': '#a4bdfc', 'P-003': '#7ae7bf' },
    [사람('P-001'), 사람('P-003')], 구글색표);
  /* ⚠ 상자(vm) 안에서 «만들어진» 것이라 deepStrictEqual 이 늘 튕긴다 — 값으로 견준다
     (memory: vm-realm-breaks-deepequal) */
  assert.strictEqual(Object.keys(새로).length, 0,
    '있는 사람 색을 다시 칠하려 합니다 — 대표님이 고른 색이 덮입니다: ' + JSON.stringify(새로));
});

test('② 새 사람에게는 «아직 아무도 안 쓰는» 색을 준다', () => {
  const f = 채우기();
  const 있는색 = { 'P-001': '#a4bdfc', 'P-003': '#7ae7bf' };
  const 새로 = f(있는색, [사람('P-001'), 사람('P-003'), 사람('A-009')], 구글색표);
  assert.strictEqual(Object.keys(새로).join(','), 'A-009', '새 사람만 채워야 합니다: ' + JSON.stringify(새로));
  const 쓰던색 = Object.values(있는색).map((c) => c.toLowerCase());
  assert.ok(쓰던색.indexOf(새로['A-009'].toLowerCase()) < 0,
    '옆자리와 같은 색을 줬습니다: ' + 새로['A-009']);
  assert.ok(구글색표.indexOf(새로['A-009']) >= 0, '색표 밖의 «새 색»을 만들었습니다: ' + 새로['A-009']);
});

test('③ 여러 명이 한꺼번에 들어와도 서로 안 겹친다', () => {
  const f = 채우기();
  const 새로 = f({ 'P-001': '#a4bdfc' },
    [사람('A-009'), 사람('A-010'), 사람('A-011')], 구글색표);
  const 색들 = Object.values(새로);
  assert.strictEqual(색들.length, 3, '셋 다 안 채웠습니다');
  assert.strictEqual(new Set(색들.map((c) => c.toLowerCase())).size, 3, '새로 넣은 셋끼리 겹칩니다');
  assert.ok(색들.every((c) => c.toLowerCase() !== '#a4bdfc'), '이미 쓰는 색과 겹칩니다');
});

test('④ 색표를 다 써도 «없는 것»보다 낫게 — 처음부터 다시 돌려 준다', () => {
  const f = 채우기();
  const 짧은색표 = ['#a4bdfc', '#7ae7bf'];
  const 새로 = f({ 'P-001': '#a4bdfc', 'P-003': '#7ae7bf' },
    [사람('A-009'), 사람('A-010')], 짧은색표);
  assert.strictEqual(Object.keys(새로).length, 2, '색이 모자라다고 아무것도 안 주면 안 됩니다');
  Object.values(새로).forEach((c) => assert.ok(짧은색표.indexOf(c) >= 0, '색표 밖 색: ' + c));
});

test('⑤ 부르는 쪽 — 관리자·현직·색표 세 가지를 모두 본다', () => {
  const fn = 함수몸(캘린더, 'function 색채우기(){');
  assert.match(fn, /ME\.role === "admin"/, '관리자인지 안 봅니다 — 서버가 거절해 콘솔만 붉어집니다');
  assert.match(fn, /gcalPalette\(\)/, '구글 색표를 안 봅니다');
  assert.match(fn, /if\(!색표/, '색표가 없을 때 멈추지 않습니다 — 되돌아갈 색이 진짜 색을 덮습니다');
  assert.match(fn, /status === "active"/, '퇴사자까지 색을 만듭니다 — 색이 모자라집니다');
  assert.match(fn, /if\(!Object\.keys\(새로\)\.length\) return/, '채울 사람이 없어도 올립니다 — 쓰기가 폭주합니다');
  assert.match(fn, /Object\.assign\(\{\}, 있는색, 새로\)/, '있던 색과 «합쳐» 올리지 않습니다 — 서버의 색이 날아갑니다');
});

test('⑥ 색표가 온 «뒤»에 부른다 — 그리기가 끝난 다음이다', () => {
  const fn = 함수몸(캘린더, 'function gcalLoad(force){');
  const i = fn.indexOf('GCAL.loading = false; render();');
  const j = fn.indexOf('색채우기()');
  assert.ok(i >= 0 && j > i, '색 채우기를 그리기보다 «먼저» 부릅니다 — 실패하면 달력이 안 뜹니다');
});

/* ── 저장 문 ── */
test('⑦ 저장 문 — 빈 지도는 막는다(서버 색이 통째로 날아간다)', async () => {
  const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
  W.attach({ ref: () => ({ set: () => Promise.resolve() }) }, {});
  const r = await W.saveColors({});
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'empty', '빈 색표를 올리려 합니다: ' + JSON.stringify(r));
});

test('⑧ 저장 문 — 색 꼴·사번 글자를 본다', async () => {
  const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
  W.attach({ ref: () => ({ set: () => Promise.resolve() }) }, {});
  assert.strictEqual((await W.saveColors({ 'P-001': '빨강' })).code, 'bad_color', '이상한 색을 올립니다');
  assert.strictEqual((await W.saveColors({ 'P.001': '#a4bdfc' })).code, 'bad_id', '금지문자 든 사번을 올립니다');
  assert.strictEqual((await W.saveColors([])).ok, false, '배열을 받아들입니다');
});

test('⑨ 저장 문 — 이알피와 «같은 겉꼴»({v,u})로 쓴다', async () => {
  const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
  let 쓴자리 = '', 쓴값 = null;
  W.attach({ ref: (p) => ({ set: (v) => { 쓴자리 = p; 쓴값 = v; return Promise.resolve(); } }) }, {});
  const r = await W.saveColors({ 'P-001': '#a4bdfc' });
  assert.strictEqual(r.ok, true, '멀쩡한 색표를 막습니다: ' + JSON.stringify(r));
  assert.strictEqual(쓴자리, 'data/staff_colors', '엉뚱한 자리에 씁니다: ' + 쓴자리);
  assert.deepStrictEqual(쓴값.v, { 'P-001': '#a4bdfc' }, 'v 안에 색표가 안 들어갑니다');
  assert.strictEqual(typeof 쓴값.u, 'number', 'u(고친 시각)를 안 찍습니다 — 다른 기기가 옛것을 밀어 올립니다');
});
