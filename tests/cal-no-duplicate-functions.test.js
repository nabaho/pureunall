/* 푸른 캘린더 — 같은 이름 함수가 둘이면 «뒤에 온 것이 이긴다» (2026-11-22)
   ════════════════════════════════════════════════════════════════════
   까닭: pu-cal.html 에 `반복글` 이 둘이었다 — 위쪽은 RRULE 글(「매주 월·수요일 반복」), 아래쪽은 입력 창의 반복 고르기 글(객체).
   한 <script> 안의 같은 이름 함수 선언은 «뒤의 것이 앞의 것을 덮는다». 그래서 구글 반복 일정 상세의 「🔁」 줄이
   RRULE 글 대신 객체를 받아 [object Object] 로 나왔다. 시험은 함수를 «하나씩 떼어» 돌려서 이 겹침을 못 잡았다.

   ★ 이 검사가 지키는 것
     ① pu-cal.html 의 «맨 앞 칸에서 시작하는» function 선언 이름이 하나도 겹치지 않는다
     ② RRULE 글(반복글)과 입력 창 반복 고르기 글(반복고르기글)이 따로 있고, 부르는 곳이 각자 제 것을 부른다
     ③ «겹침이 실제로 일으키는 일»을 돌려서 본다 — 두 함수를 «같은 상자에 함께» 올려도 RRULE 글이 문자열로 나온다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');

function 함수몸(head) {
  const i = 캘린더.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = 캘린더.indexOf('{', i); k < 캘린더.length; k++) {
    if (캘린더[k] === '{') d++;
    else if (캘린더[k] === '}') { d--; if (d === 0) return 캘린더.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

test('① pu-cal.html 의 맨 앞 칸 function 선언 이름이 겹치지 않는다 — 겹치면 뒤의 것이 앞의 것을 덮는다', () => {
  const 이름들 = [...캘린더.matchAll(/^function ([^\s(]+)\s*\(/gm)].map((m) => m[1]);
  assert.ok(이름들.length >= 100, '함수를 제대로 못 읽었습니다(' + 이름들.length + '개) — 이 검사가 헛돌고 있습니다');
  const 센 = new Map();
  이름들.forEach((n) => 센.set(n, (센.get(n) || 0) + 1));
  const 겹침 = [...센].filter(([, c]) => c > 1).map(([n, c]) => n + ' ×' + c);
  assert.deepStrictEqual(겹침, [], '★ 같은 이름 함수가 둘 이상입니다(뒤의 것이 이깁니다): ' + 겹침.join(', '));
});

test('② RRULE 글(반복글)과 입력 창 반복 고르기 글(반복고르기글)이 따로 있고, 부르는 곳이 각자 제 것을 부른다', () => {
  assert.match(캘린더, /^function 반복글\(규칙\)\{/m, 'RRULE 글 반복글(규칙) 이 없습니다');
  assert.match(캘린더, /^function 반복고르기글\(ymd\)\{/m, '입력 창 반복 고르기 글 반복고르기글(ymd) 이 없습니다');
  assert.match(함수몸('function 구글더줄(ev, 반복){'), /반복글\(규칙\)/, '구글 상세 줄은 RRULE 글(반복글)을 불러야 합니다');
  assert.match(함수몸('function 반복알림줄(m){'), /반복고르기글\(m\.date\)/, '입력 창 반복 줄은 반복고르기글 을 불러야 합니다');
});

test('③ 두 함수를 «같은 상자에 함께» 올려도 구글 반복 일정의 「🔁」 줄이 글자로 나온다 (예전엔 [object Object])', () => {
  const 상자 = {};
  vm.createContext(상자);
  ['function 구글더줄(ev, 반복){', 'function 반복글(규칙){', 'function 반복고르기글(ymd){', 'function 알림글(r){']
    .forEach((h) => vm.runInContext(함수몸(h), 상자));
  const 줄 = 상자.구글더줄({}, ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE']);
  const 반복줄 = Array.from(줄).filter((r) => r.i === '🔁');
  assert.strictEqual(반복줄.length, 1, '「🔁」 줄이 하나여야 합니다');
  assert.strictEqual(typeof 반복줄[0].t, 'string', '★ 「🔁」 줄의 글이 글자가 아닙니다(' + typeof 반복줄[0].t + ') — 함수 이름이 겹쳤을 때의 증상');
  assert.match(반복줄[0].t, /매주 월·수요일 반복/);
  /* 입력 창 쪽도 그대로 — 고른 날(2026-10-14 = 수요일)을 글자에 보여 준다 */
  const 고르기 = JSON.parse(JSON.stringify(상자.반복고르기글('2026-10-14')));
  assert.deepStrictEqual(고르기, { D: '매일', W: '매주 (수요일)', M: '매월 14일', Y: '매년 10월 14일' });
});
