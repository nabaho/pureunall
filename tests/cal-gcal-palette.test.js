/* 푸른 캘린더 — 구글 «색표»를 받고 쓰는 규칙 (3걸음: 검사를 캘린더로 옮기기)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 「0부터 순서대로」 → 3걸음.

   ★ 왜 이 파일이 생겼나
     「구글과 같게」를 지키던 규칙들이 `tests/cal-google-look.test.js` 에 모여 있는데,
     그 검사는 **이알피(pu-erp.html)를 본다**. 4걸음에서 이알피 달력을 걷어내면
     그 서른일곱 규칙이 «갈 곳을 잃는다» — 지우기만 하면 아무도 안 지키는 상태가 된다.

   ★ 그래서 무엇을 옮겼나 — «이알피에만 있던 것»만 골랐다
     이미 푸른 캘린더 쪽에서 지키고 있는 것은 옮기지 않았다(두 벌이 되면 어긋난다):
       · 색 고르는 차례·메일 열쇠·종일 일정·못 받았을 때 → tests/cal-gcal-and-active
       · 글자색을 실제 대비로 고르기              → tests/cal-mine-first ③
       · 오늘·공휴일 칸                            → tests/cal-google-cell-design
       · 요일 줄·머리글                            → tests/cal-google-chrome
       · 계정 잇기                                 → tests/cal-mail-map
     여기 남은 것은 «색표를 받아 오는 길»과 «색값을 코드에 안 적기» 다.

   ⚠ 4걸음에서 cal-google-look.test.js 를 지울 때, 이 파일이 그 자리를 잇는다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const CAL = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

function 함수몸(head) {
  const i = CAL.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = CAL.indexOf('{', i); k < CAL.length; k++) {
    if (CAL[k] === '{') d++;
    else if (CAL[k] === '}') { d--; if (d === 0) return CAL.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

/* ── 색표를 받아 오는 길 ── */

test('① 색표를 «한 번만» 받는다 — 달을 넘길 때마다 다시 받지 않는다', () => {
  const fn = 함수몸('function gcalLoadColors(){');
  assert.match(fn, /if\(window\._gcalColors\) return Promise\.resolve/,
    '달을 옮길 때마다 색표를 다시 받습니다 — 쓸데없는 통신이 늡니다');
});

test('② 색표가 안 와도 일정은 뜬다 — 색 하나 때문에 달력이 비면 더 큰 사고다', () => {
  const fn = 함수몸('function gcalLoadColors(){');
  assert.match(fn, /\.catch\(/, '색표 실패가 일정까지 죽입니다');
  assert.match(fn, /window\._gcalColors = \{\}/,
    '실패한 뒤 «빈 표»로 표시해 두지 않습니다 — 매번 다시 받게 됩니다');
});

test('③★ 색표를 먼저 채운 «뒤» 일정을 받는다 — 순서가 뒤바뀌면 첫 그림에 색이 빠진다', () => {
  const fn = 함수몸('function gcalLoad(force){');
  const i = fn.indexOf('gcalLoadColors()');
  const j = fn.indexOf('fetch(url)');
  assert.ok(i >= 0, '색표를 안 부릅니다');
  assert.ok(j > i, '색표보다 일정을 먼저 받습니다 — 첫 그림에 색이 빠집니다');
});

/* ── 색값을 코드에 적지 않는다 (팔레트 규율) ── */

test('④★ 색표를 받는 자리에 색값을 «적지 않았다»', () => {
  /* 적어 두면 ①팔레트 규율이 깨지고 ②구글에서 색을 바꿔도 안 따라간다. */
  const fn = 함수몸('function gcalLoadColors(){');
  assert.strictEqual(/#[0-9a-fA-F]{6}/.test(fn), false, '색값을 코드에 적었습니다');
  const pal = 함수몸('function gcalPalette(){');
  assert.strictEqual(/#[0-9a-fA-F]{6}/.test(pal), false, '색 고르개에 색값을 적었습니다');
});

/* ── 색 차례 (사람 색이 흔들리지 않게) ── */

function 색표상자(colors) {
  const 상자 = { console, Object, Array, String, parseInt, window: { _gcalColors: colors } };
  vm.createContext(상자);
  vm.runInContext(함수몸('function gcalPalette(){'), 상자);
  vm.runInContext('var __r = gcalPalette();', 상자);
  return 상자.__r;
}

test('⑤★ 색 차례가 «늘 같다» — 번호 순으로 세운다(글자순이 아니다)', () => {
  /* 색표는 객체로 온다. 열쇠 차례가 브라우저마다 다를 수 있어 번호로 세워야
     같은 사람이 늘 같은 색을 받는다. 글자순이면 11 이 2 보다 앞에 온다. */
  const r = 색표상자({ 11: '#c', 2: '#b', 1: '#a' });
  assert.strictEqual(Array.from(r).join(','), '#a,#b,#c',
    '글자순으로 세웠습니다 — 사람 색이 흔들립니다');
});

test('⑥ 같은 색이 두 번 와도 한 번만 담는다 — 두 사람이 같은 색이 되면 안 된다', () => {
  const r = 색표상자({ 1: '#a', 2: '#a', 3: '#b' });
  assert.strictEqual(Array.from(r).join(','), '#a,#b', '같은 색을 두 번 담습니다');
});

test('⑦ 색표가 «없거나 비었으면» 빈 목록이 아니라 null 을 준다', () => {
  /* 빈 배열은 참(truthy)이라, 받는 쪽이 「색표가 왔다」고 잘못 보고
     되돌아갈 길을 건너뛴다 — 달력이 통째로 회색이 된다. */
  assert.strictEqual(색표상자(null), null, '색표가 없는데 빈 목록을 줍니다');
  assert.strictEqual(색표상자({}), null, '빈 색표에 빈 목록을 줍니다');
});

/* ── 칩 글자 (구글 화면과 같게) ── */

test('⑧★ 칩의 시각을 구글처럼 «1030» 으로 붙여 쓴다 — 콜론을 안 쓴다', () => {
  /* ⚠ 「콜론이 파일 어딘가에 있나」로 보면 안 된다 — 제목이 없는 일정의 «되돌아갈
     이름»(「10:30 일정」)은 글이라 콜론이 있는 게 맞다(이알피도 같다).
     칩에 찍히는 «time 칸»만 본다. */
  /* ⚠ 쉼표까지로 자르면 안 된다 — replace(":", "") «안»에도 쉼표가 있어 중간에 끊긴다.
     다음 칸(color:)이 시작하는 데까지 자른다. */
  const fn = 함수몸('function gcalToEvent(ev){');
  const i = fn.indexOf('time:');
  const j = fn.indexOf('color:', i);
  assert.ok(i >= 0 && j > i, '칩의 time 칸을 못 찾았습니다');
  const 칸 = fn.slice(i, j);
  assert.match(칸, /replace\(":",\s*""\)/, '칩 시각에 콜론이 그대로 붙습니다: ' + 칸.trim());
});

test('⑨ 종일 일정에 「0000」을 붙이지 않는다', () => {
  const fn = 함수몸('function gcalToEvent(ev){');
  assert.match(fn, /timeStr !== "00:00"/, '종일 일정에 0000 이 붙습니다');
});

test('⑩ 구글 일정 이름에 «아이콘을 붙이지 않는다» — 구글 화면에는 없다', () => {
  const fn = 함수몸('function gcalToEvent(ev){');
  const 반환 = fn.slice(fn.indexOf('return {'));
  assert.strictEqual(/text\s*:\s*["'][^"']*[\u{1F300}-\u{1FAFF}]/u.test(반환), false,
    '구글 일정 이름 앞에 그림글자를 붙입니다');
});
