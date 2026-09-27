/* 푸른 캘린더 — 폰에서는 구글 캘린더 «위젯»과 같은 꼴
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-27 「구글 캘린더 같이 폰에 똑같이 해달라」(대표 폰의 구글 위젯 캡처).

   ★ 규칙
     ① 폰이면 머리가 「10월 / 음력」 · ‹ › · ＋ 한 줄이고, 요일 줄이 따로 있다
     ② 그 달에 필요한 줄만 그린다(마지막 줄이 통째로 다음 달이면 뺀다)
     ③ 칩은 모두 색을 꽉 채운다(점 꼴 없음), 제목만(시각을 앞에 안 붙인다)
     ④ 넘치면 「•••」
     ⑤ 넓은 화면은 그대로 — 폰 판정이 없으면(검사 상자 등) 넓은 화면으로 친다 */
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

function 칩(폰이다, e) {
  const b = { console, String, Object, Array, JSON, Math, Date, S: { theme: 'light' },
    todayYMD: () => '2026-09-27', esc: (s) => String(s == null ? '' : s),
    window: { matchMedia: () => ({ matches: 폰이다 }) } };
  vm.createContext(b);
  ['function 폰(){', 'function mixHex(hexA, hexB, t){', 'function chipHtml(e, ymd){']
    .forEach((h) => vm.runInContext(함수몸(캘린더, h), b));
  b.__e = e;
  return vm.runInContext('chipHtml(__e, "2026-10-05")', b);
}
const 시각일정 = { store: 'gcal', id: 'a', sid: 'P-1', date: '2026-10-05', end: '2026-10-05', time: '10:30',
  color: '#33b679', text: '1030 가나상사 방문', tip: '' };

test('③ 폰에서는 시각 일정도 색을 꽉 채우고, 제목만 쓴다', () => {
  const h = 칩(true, 시각일정);
  assert.strictEqual(/data-g="t"/.test(h), false, '폰에서 점 꼴로 그립니다');
  assert.match(h, /background:#33b679/, '색을 채우지 않았습니다');
  assert.match(h, />1030 가나상사 방문</, '제목만이어야 합니다(시각을 앞에 붙임): ' + h);
});

test('⑤ 넓은 화면은 그대로 — 점 · 시각 · 제목', () => {
  const h = 칩(false, 시각일정);
  assert.match(h, /data-g="t"/, '넓은 화면의 점 꼴이 사라졌습니다');
  assert.match(h, />10:30</);
});

test('⑤ 폰 판정이 없으면(matchMedia 없음) 넓은 화면으로 친다 — 검사 상자가 안 죽는다', () => {
  const b = { window: {} };
  vm.createContext(b);
  vm.runInContext(함수몸(캘린더, 'function 폰(){'), b);
  assert.equal(vm.runInContext('폰()', b), false);
});

test('①②④ 달 그리기 — 폰 머리·요일 줄·필요한 줄만·「•••」', () => {
  const 몸 = 함수몸(캘린더, 'function calendarHtml(eumOnly){');
  assert.match(몸, /폰머리Html\(\)/, '폰 머리를 안 그립니다');
  assert.match(몸, /class="mhd"/, '요일 줄이 따로 없습니다');
  assert.match(몸, /grid\.slice\(grid\.length - 7\)\.every\(function\(c\)\{ return c\.other; \}\)/,
    '마지막 줄이 통째로 다음 달이어도 그립니다');
  assert.match(몸, /폰판 \? '•••'/, '폰에서 「•••」로 안 접습니다');
  const 머리 = 함수몸(캘린더, 'function 폰머리Html(){');
  ['data-mv="-1"', 'data-mv="1"', 'data-mnew'].forEach((x) => assert.ok(머리.indexOf(x) >= 0, x + ' 가 폰 머리에 없습니다'));
});
