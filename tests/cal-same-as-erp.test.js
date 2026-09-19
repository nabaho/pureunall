/* 푸른 캘린더의 달력이 이알피와 «똑같다»
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-18 「대시보드 제외한 화면은 똑같이 만들어라」.

   ★ 왜 검사가 필요한가
     두 화면이 한 달 동안 «나란히» 돈다(2걸음). 그 사이 한쪽만 고치면 대표님은
     같은 날을 두 모양으로 보시게 된다 — 그러면 어느 쪽이 맞는지 아무도 모른다.
     그래서 「같다」를 말로 적지 않고 «이알피 소스에서 규칙을 떼어 와» 맞대 본다.

   ★ 무엇을 맞대나 — 칩에 «무슨 글자»가 뜨고 «무슨 색»이 칠해지는가.
     자리잡기·여백은 안 본다(다듬어도 안 깨지게). 사람이 눈으로 알아보는 것만 본다.

   ⚠ 걸리면: 이알피를 고쳤으면 pu-cal.html 도 같이 고친다. 이알피가 기준이다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 이알피 = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
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

/* 이알피 소스에서 「유형 → 칩 글자」 짝을 뽑는다 */
function 이알피글자() {
  const m = {};
  const re = /r\.type===['"]([a-z-]+)['"]\s*\?\s*'([^']+)'\+who/g;
  let x;
  while ((x = re.exec(이알피)) !== null) m[x[1]] = x[2];
  return m;
}
/* 이알피 소스에서 「유형 → 칩 색」 짝을 뽑는다 */
function 이알피색() {
  const i = 이알피.indexOf("var col = r.type==='trip'");
  assert.ok(i >= 0, '이알피에서 칩 색 규칙을 못 찾았습니다');
  const 덩이 = 이알피.slice(i, i + 400);
  const m = {};
  const re = /r\.type===['"]([a-z-]+)['"]\s*\?\s*(?:'(#[0-9a-fA-F]{6})'|\(staffColorMap\[r\.sid\] \|\| '(#[0-9a-fA-F]{6})'\))/g;
  let x;
  while ((x = re.exec(덩이)) !== null) m[x[1]] = x[2] || x[3];
  return m;
}

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
test('달력에 그리는 근태 목록이 이알피와 «똑같다»', () => {
  const m = 이알피.match(/\[('(?:leave|[a-z-]+)'(?:,'[a-z-]+')*)\]\.indexOf\(r\.type\) < 0\) return;/);
  assert.ok(m, '이알피에서 달력 근태 목록을 못 찾았습니다');
  const 이알피목록 = m[1].split(',').map((x) => x.replace(/'/g, ''));
  const c = 캘린더.match(/var ATT_SHOW = \[([\s\S]*?)\];/);
  assert.ok(c, '푸른 캘린더에서 ATT_SHOW 를 못 찾았습니다');
  const 우리목록 = c[1].match(/"[a-z-]+"/g).map((x) => x.replace(/"/g, ''));
  assert.deepStrictEqual(우리목록.slice().sort(), 이알피목록.slice().sort(),
    '달력에 그리는 근태가 두 화면에서 다릅니다 — 한쪽에만 뜨는 기록이 생깁니다');
});

// ── ④ 달력의 생김새 규칙 ──────────────────────────────────────────────
test('날짜 옆에 음력을 붙인다 — 이알피와 같은 달력(단기)으로 센다', () => {
  assert.match(캘린더, /ko-KR-u-ca-dangi/, '음력을 세지 않습니다');
  assert.match(이알피, /ko-KR-u-ca-dangi/);
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

test('★ 한 칸에 보이는 개수 — 여기 «한 가지»만 이알피와 다르다(대표 지시 2026-09-19)', () => {
  /* 이 파일의 나머지는 모두 「이알피와 같다」를 본다. 이 하나만 다르고, 다른 것이 «맞다».
       이알피: 넷까지 보이고 나머지는 「N개 더보기」로 접는다.
       푸른 캘린더: 다 보인다 — 접지 않는다.
     2026년 9월 실측으로 56건이 접혀 있었다. 그것을 보자고 여는 달력이었다.
     ⚠ 「똑같이 만들어라」를 보고 되돌리지 말 것 — 그 뒤에 온 지시가 이것이다.
     ⚠ 이알피가 나중에 다 보이게 바뀌면 이 검사는 그때 걸린다. 그때는 «맞춰» 지우면 된다. */
  const m = 이알피.match(/var MAX_SHOW = (\d+);/);
  assert.ok(m, '이알피에서 MAX_SHOW 를 못 찾았습니다 — 이알피가 바뀌었다면 이 검사를 다시 볼 것');
  assert.strictEqual(캘린더.indexOf('var MAX = ') , -1,
    '푸른 캘린더에 다시 개수 뚜껑(var MAX)이 생겼습니다 — 접으면 56건이 다시 숨습니다');
  assert.strictEqual(/class="more"/.test(캘린더), false,
    '「N개 더보기」가 다시 생겼습니다');
});

test('여섯 줄 42칸 — 줄 높이는 바닥값을 두고 «늘어난다»', () => {
  /* 여태는 repeat(6,1fr) 로 여섯 줄을 똑같이 눌렀다. 그러면 바쁜 날이 잘려서
     「N개 더보기」가 필요했다 — 이제 접지 않으므로 줄이 늘 수 있어야 한다.
     ★ 바닥값은 그대로다: 한가한 주가 납작해지면 달력이 표처럼 보인다.
     칸 수(42)는 그대로 못 박는다 — 달마다 줄 수가 들쭉날쭉하면 안 된다. */
  const m = 캘린더.match(/\.calgrid\{[^}]*grid-auto-rows:minmax\((\d+)px,\s*auto\)/);
  assert.ok(m, '줄이 늘 수 없습니다 (.calgrid 의 grid-auto-rows 가 minmax 가 아닙니다)');
  assert.ok(Number(m[1]) >= 60, '줄 바닥값이 너무 낮습니다: ' + m[1] + 'px');
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
