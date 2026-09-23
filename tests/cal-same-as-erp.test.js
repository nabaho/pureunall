/* ══ 2026-09-20 — 맞댈 상대가 사라졌다. 규칙이 «홀로 선다» ═══════════
   4걸음에서 이알피 법인 대시보드를 걷어냈다. 이 파일은 그때까지 푸른 캘린더를
   «이알피 소스에서 떠 온 표»와 맞대 보았는데, 그 소스가 없어졌다.
   ★ 그래서 값을 여기에 «적어 둔다». 지금 값을 베낀 것이 아니라 —
     이알피가 몇 달 쓰며 굳힌 것을 옮겨 적은 것이고, 이제 이것이 «규칙»이다.
     (지운 코드에서 실제로 떠 왔다 — 4걸음 직전의 pu-erp.html)
   ⚠ 값을 못 박은 까닭을 줄마다 적어 둔다 — 「지금 값」과 「규칙」은 다르다.
     대표님이 색을 바꾸라 하시면 여기도 함께 고치는 것이 맞다. 그때 «왜»가 남아 있어야 한다.
   ════════════════════════════════════════════════════════════════════ */
/* 푸른 캘린더의 달력이 이알피와 «똑같다»
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-18 「대시보드 제외한 화면은 똑같이 만들어라」.

   ★ 왜 검사가 필요한가
     두 화면이 한 달 동안 «나란히» 돈다(2걸음). 그 사이 한쪽만 고치면 대표님은
     같은 날을 두 모양으로 보시게 된다 — 그러면 어느 쪽이 맞는지 아무도 모른다.
     그래서 「같다」를 말로 적지 않고 «이알피 소스에서 규칙을 떼어 와» 맞대 본다.

   ★ 무엇을 맞대나 — 칩에 «무슨 글자»가 뜨고 «무슨 색»이 칠해지는가.
     자리잡기·여백은 안 본다(다듬어도 안 깨지게). 사람이 눈으로 알아보는 것만 본다.

   ⚠ 걸리면: 값을 바꿀 «까닭»이 있는지 먼저 본다. 있으면 이 표와 pu-cal.html 을 함께 고친다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

/* 이름 붙은 함수 하나의 몸만 떼어 온다 (중괄호를 센다 — 글자 수로 자르지 않는다) */
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

/* 푸른 캘린더의 eventsOn 을 떼어 와 실제로 돌린다 */
function 캘린더칩(rec, 자료) {
  자료 = 자료 || {};
  const 상자 = {
    D: Object.assign({ my_schedules: [], attendance_records: [rec] }, 자료),
    arr: (v) => (Array.isArray(v) ? v : []),
    colorOf: (sid) => (자료.__색 || {})[sid] || null,
    nameOf: (sid) => (자료.__이름 || {})[sid] || '',
    externalOf: (id) => (자료.__외부 || {})[id] || null,
    String, Object, Array, JSON
  };
  vm.createContext(상자);
  /* 구글 일정은 이 검사가 보는 것이 아니다 — 빈 채로 둔다(따로 cal-gcal-and-active 가 본다) */
  vm.runInContext('var GCAL = { evs:[] }; var S = { filter:null };', 상자);
  vm.runInContext(함수몸(캘린더, 'function eventsOn(ymd, eumOnly){')
    + '\n' + (캘린더.match(/var ATT_SHOW = \[[\s\S]*?\];/) || [''])[0]
    + '\nvar __r = eventsOn(' + JSON.stringify(rec.date) + ');', 상자);
  return JSON.parse(JSON.stringify(상자.__r))[0];
}

/* 유형 → 칩 글자.  검사고정-허용 — 이것이 «규칙»이다.
   사람은 달력을 «훑어본다». 글자가 달라지면 같은 것을 다른 것으로 읽는다.
   그림글자를 앞에 두는 것도 규칙이다 — 글자를 다 안 읽어도 무엇인지 안다. */
const 칩글자 = {
  'leave': '🏖️ 연차',
  'halfday-am': '🌅 오전반차',
  'halfday-pm': '🌇 오후반차',
  'leave-hour': '⏱️ 시간연차',
  'special-leave': '🎁 특별휴가',
  'maternity': '🤱 출산휴가',
  'parental-leave': '👶 육아휴직',
  'sick': '🤒 병가',
  'trip': '🚗 출장',
  'telework': '🏠 재택'
};
function 이알피글자() { return 칩글자; }

/* 유형 → 칩 색.  검사고정-허용 — 이것도 «규칙»이다.
   ★ 왜 이 넷만 «정해진 색»인가: 나머지는 «누구의 일인가»가 중요해서 사람 색으로 칠한다.
     이 넷은 «무슨 일인가»가 먼저다 — 자리를 비운다(출장·재택), 아프다(병가),
     여기 사람이 아니다(이음). 그래서 사람 색을 덮는다.
   ⚠ 이음(eum-work)의 회색은 «사람 색이 없을 때»의 색이다. 사번이 있으면 사람 색이 이긴다.
     외부 인원은 사번이 없어 늘 회색이다 — 제 색을 주면 직원과 구별이 안 된다. */
const 칩색 = {
  'trip': '#1e40af',      /* 짙은 남색 — 나가 있다 */
  'telework': '#2563eb',  /* 옅은 남색 — 집에서 일한다(출장과 한 갈래, 한 칸 밝게) */
  'eum-work': '#94a3b8',  /* 회색 — 누구인지 모를 때 */
  'sick': '#dc2626'       /* 빨강 — 아프다. 하나뿐인 빨강이라 훑어도 눈에 띈다 */
};
function 이알피색() { return 칩색; }

// ── ① 칩에 뜨는 글자 ──────────────────────────────────────────────────
test('연차·반차·출장 … 칩 글자가 이알피와 같다', () => {
  const 표 = 이알피글자();
  const 볼것 = ['leave', 'halfday-am', 'halfday-pm', 'leave-hour', 'special-leave', 'maternity', 'parental-leave'];
  볼것.forEach((code) => {
    assert.ok(표[code], '이알피에서 ' + code + ' 글자를 못 뽑았습니다');
    const 칩 = 캘린더칩({ id: 'a1', date: '2026-09-15', sid: 'S001', type: code },
      { __이름: { S001: '홍길동' } });
    assert.ok(칩, code + ' 칩이 아예 안 나왔습니다');
    assert.strictEqual(칩.text, 표[code] + ' (홍길동)',
      code + ' 칩 글자가 이알피와 다릅니다');
  });
});

test('병가·출장·재택은 메모를 뒤에 붙인다 — 이알피와 같은 차례', () => {
  ['sick', 'trip', 'telework'].forEach((code) => {
    const 칩 = 캘린더칩({ id: 'a1', date: '2026-09-15', sid: 'S001', type: code, note: '가나상사' },
      { __이름: { S001: '홍길동' } });
    assert.match(칩.text, /\(홍길동\) 가나상사$/, code + ' 가 메모를 안 붙이거나 차례가 다릅니다');
  });
});

test('이음센터 칩 — 사람 이름 뒤에 「이음센터」', () => {
  const 안 = 캘린더칩({ id: 'a1', date: '2026-09-15', sid: 'S001', type: 'eum-work' },
    { __이름: { S001: '홍길동' } });
  assert.strictEqual(안.text, '🏛️ 홍길동 이음센터');
  const 밖 = 캘린더칩({ id: 'a2', date: '2026-09-15', externalId: 'x1', type: 'eum-work' },
    { __외부: { x1: { id: 'x1', name: '이순신', role: '변호사' } } });
  assert.strictEqual(밖.text, '🏛️ 이순신 이음센터');
});

// ── ② 칩 색 ───────────────────────────────────────────────────────────
test('칩 색이 이알피와 같다 — 출장·재택·병가는 정해진 색', () => {
  const 표 = 이알피색();
  ['trip', 'telework', 'sick'].forEach((code) => {
    assert.ok(표[code], '이알피에서 ' + code + ' 색을 못 뽑았습니다');
    const 칩 = 캘린더칩({ id: 'a1', date: '2026-09-15', sid: 'S001', type: code });
    assert.strictEqual(칩.color, 표[code], code + ' 색이 이알피와 다릅니다');
  });
});

test('사람 색이 있으면 그것이 이긴다 — 대표님이 고른 색이 그대로 보여야 한다', () => {
  const 칩 = 캘린더칩({ id: 'a1', date: '2026-09-15', sid: 'S001', type: 'leave' },
    { __색: { S001: '#16a34a' } });
  assert.strictEqual(칩.color, '#16a34a');
});

test('이음센터 — 사람을 모르면 회색이다 (이알피도 외부 사람 색을 쓰지 않는다)', () => {
  const 표 = 이알피색();
  const 칩 = 캘린더칩({ id: 'a1', date: '2026-09-15', externalId: 'x1', type: 'eum-work' },
    { __외부: { x1: { id: 'x1', name: '이순신', color: '#dc2626' } } });
  assert.strictEqual(칩.color, 표['eum-work'],
    '외부 사람의 제 색으로 칠하고 있습니다 — 이알피는 회색입니다');
});

// ── ③ 달력에 그리는 근태 목록 ─────────────────────────────────────────
test('달력에 «어떤 근태»가 뜨는가 — 빠지면 그 사람은 있는 줄 안다', () => {
  /* 검사고정-허용 — 이 열한 가지가 «규칙»이다.
     ★ 무엇이 들어오나: 그날 «그 사람을 찾을 수 없게 되는» 일.
       쉰다(연차·반차·시간연차·특별휴가·출산·육아) · 아프다(병가) ·
       자리에 없다(출장·재택) · 다른 데 가 있다(이음센터).
     ⚠ 하나 빠지면 그 사람이 «있는 줄 알고» 일이 잡힌다 — 그래서 목록을 지킨다.
     ⚠ 근태에 남는 다른 기록(지각·조퇴 따위)은 일부러 «안» 그린다.
       그 사람은 그날 자리에 있다. 달력은 「찾을 수 있나」를 보는 곳이다. */
  const 그려야할것 = ['leave', 'halfday-am', 'halfday-pm', 'leave-hour', 'special-leave',
    'sick', 'maternity', 'parental-leave', 'trip', 'telework', 'eum-work'];
  const c = 캘린더.match(/var ATT_SHOW = \[([\s\S]*?)\];/);
  assert.ok(c, '푸른 캘린더에서 ATT_SHOW 를 못 찾았습니다');
  const 우리목록 = c[1].match(/"[a-z-]+"/g).map((x) => x.replace(/"/g, ''));
  assert.deepStrictEqual(우리목록.slice().sort(), 그려야할것.slice().sort(),
    '달력에 그리는 근태가 바뀌었습니다 — 빠진 것이 있으면 그 사람은 있는 줄 압니다');
});

// ── ④ 달력의 생김새 규칙 ──────────────────────────────────────────────
test('날짜 옆에 음력을 붙인다 — 단기 달력으로 센다', () => {
  /* 검사고정-허용 — 음력은 «단기(dangi) 달력»으로 센다. 브라우저가 내는 값이라
     우리가 셈하지 않는다. 다른 달력을 쓰면 날짜가 하루씩 어긋난다. */
  assert.match(캘린더, /ko-KR-u-ca-dangi/, '음력을 세지 않습니다');
  // 실제로 맞는 값이 나오는가 — 2026 추석(9/25)은 음력 8월 15일이다.
  // 검사고정-허용: 추석은 «정의상» 음력 8월 15일이다. 지금 값이 아니라 규칙이다.
  const i = 캘린더.indexOf('function lunarDay');
  assert.ok(i >= 0);
  const 상자 = { Intl, Date, String };
  vm.createContext(상자);
  vm.runInContext('var _lunar={};' + 함수몸(캘린더, 'function lunarDay(ymd){')
    + '\nvar __r = lunarDay("2026-09-25");', 상자);
  assert.strictEqual(상자.__r, '15', '추석(2026-09-25)의 음력 날짜가 15가 아닙니다');
});

test('오늘 동그라미는 «숫자에만» — 음력까지 감싸면 알약처럼 길어진다', () => {
  assert.match(캘린더, /\.dnum\.today\{[^}]*border-radius|\.dnum\{[^}]*border-radius:999px/,
    '날짜 숫자에 동그라미가 없습니다');
  assert.ok(캘린더.indexOf('.lun{') >= 0, '음력이 제 칸(.lun)을 갖고 있지 않습니다');
});

test('★ 한 칸에 보이는 개수 — 못 박지 않고 «재서» 정한다', () => {
  /* 접는다는 것 자체는 이알피에서 물려받았다. 다른 것은 «몇 개에서» 접느냐다.
       이알피(걷어냄) : 넷 — 소스에 못 박아 둔 수(MAX_SHOW) 였다.
       푸른 캘린더     : 화면을 재서 나온 수(칸용량) — 큰 화면이면 더 보인다.
     ⚠ 푸른 캘린더에도 못 박은 수를 다시 넣지 말 것. 작은 화면에서 칸이 넘치고,
       큰 화면에서는 빈 자리를 두고도 「+N개 더」가 뜬다.
     (대표 지시 2026-09-19 「한화면에 나오게하고 … 펼서 볼수 있게 하면 된다」) */
  assert.strictEqual(캘린더.indexOf('var MAX = ') , -1,
    '푸른 캘린더에 못 박은 개수 뚜껑(var MAX)이 생겼습니다 — 재서 정해야 합니다');
  assert.ok(캘린더.indexOf('function 칸용량(') >= 0,
    '한 칸에 몇 개인지를 재는 길(칸용량)이 없습니다');
  /* 접은 것을 «말은 하는지» — 말없이 감추면 이알피보다 나쁘다 */
  assert.match(캘린더, /class="more"[^>]*>\+' \+ 숨김 \+ '개 더|개 더</,
    '접었는데 「+N개 더」를 안 씁니다');
});

test('여섯 줄 42칸 — 남은 높이를 여섯으로 나눈다(화면을 안 넘긴다)', () => {
  /* 한때 줄이 내용에 따라 늘어나게 했다가 바쁜 달이 화면 밖으로 내려갔다
     (대표 지시 「너무 내려왔다 … 드래그해서 아래로 내려가면 안된다」).
     이제 판의 높이가 먼저 정해지고 칸이 그 안에 맞춘다.
     ⚠ 넓은 화면 쪽만 본다 — 그냥 찾으면 손전화 규칙이 먼저 걸려 샌다. */
  const 덩이 = 캘린더.match(/\.calgrid\{[^}]*grid-template-columns[^}]*\}/);
  assert.ok(덩이, '넓은 화면 .calgrid 를 못 찾았습니다');
  assert.match(덩이[0], /grid-template-rows:repeat\(6,\s*1fr\)/,
    '여섯 줄을 남은 높이로 안 나눕니다: ' + 덩이[0]);
  assert.strictEqual(/grid-auto-rows/.test(덩이[0]), false,
    '줄 바닥값이 되살아났습니다 — 바쁜 달이 화면을 넘깁니다: ' + 덩이[0]);
  const 격자 = 함수몸(캘린더, 'function monthGrid(ym){');
  assert.match(격자, /grid\.length < 42/, '42칸을 채우지 않습니다');
});

test('공휴일은 칸 맨 위에 «칩»으로 — 오른쪽 위 작은 글씨가 아니다', () => {
  assert.match(캘린더, /\.ev\.hol\{[^}]*background:#fecaca/, '공휴일 칩 색이 이알피와 다릅니다');
});

test('월·주·일 셋을 다 갖춘다 — 이알피에 있는 보기를 없애지 않는다', () => {
  ['month', 'week', 'day'].forEach((v) => {
    assert.ok(캘린더.indexOf('data-view=\\"' + v) >= 0 || 캘린더.indexOf('"' + v + '"') >= 0,
      v + ' 보기가 없습니다');
  });
  assert.ok(캘린더.indexOf('function weekHtml') >= 0 && 캘린더.indexOf('function dayHtml') >= 0,
    '주·일 보기를 그리는 자리가 없습니다');
});

test('일정 검색이 있다 — 이알피 머리줄에 있던 것을 없애지 않는다', () => {
  assert.match(캘린더, /일정 검색/, '검색 칸이 없습니다');
  assert.ok(캘린더.indexOf('function matchSearch') >= 0, '검색이 실제로 거르지 않습니다');
});
