/* 캘린더 — 「오늘」·「공휴일」 칸도 «칸 배경은 흰색 그대로» (구글과 완벽하게 같게)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 「구글 캘린더와 똑같이 색모서리 관리 공휴일 색 당일 표시
   셀의 디자인 만들어라 완벽하게 같게 다시 만들어라」.

   ★ 실제 구글 캡처를 픽셀로 재서 확인했다 — 「오늘」 칸도 「공휴일」이 든 칸도
     배경은 (255,255,255), 옆 칸과 똑같은 흰색이다. 「오늘」은 날짜 숫자의
     파란 동그라미(.dnum.today) 하나로 충분히 표난다. 「공휴일」은 칸을 물들이지
     않고 칸 옆까지 꽉 채운 «띠»(.ev.hol) 하나로 보여 준다 — 색은 그대로
     (#fecaca·#991b1b, tests/cal-same-as-erp.test.js 가 못 박는다), «모양»만
     둥근 칩에서 옆까지 닿는 띠로 바꿨다.
   ★ 이 앱만의 기능(「찾음」 — 검색으로 걸린 칸을 옅게 표시)은 구글에 없는 것이므로
     그대로 둔다. 오늘·공휴일과 헷갈리지 않게 배경(#fffbeb)+outline을 함께 쓴다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

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

test('① 월 보기 — 「오늘」·「공휴일」 칸 배경에 더 이상 노랑·분홍을 안 쓴다', () => {
  const fn = 함수몸(캘린더, 'function calendarHtml(eumOnly){');
  const i = fn.indexOf('var bg = 어둠 ?');
  assert.ok(i >= 0, '칸 배경 셈을 못 찾았습니다');
  const 밝은판갈래 = fn.slice(i, fn.indexOf(';', fn.indexOf(':', i + 20)) + 1);
  assert.strictEqual(/오늘\s*\?\s*"#fffbeb"/.test(밝은판갈래), false,
    '「오늘」 칸에 아직 노랑 칠이 남아 있습니다: ' + 밝은판갈래);
  assert.strictEqual(/hol\s*\?\s*"#fef2f2"/.test(밝은판갈래), false,
    '「공휴일」 칸에 아직 분홍 칠이 남아 있습니다: ' + 밝은판갈래);
  /* 「찾음」은 이 앱만의 기능이라 그대로 둔다 */
  assert.match(밝은판갈래, /찾음\s*\?\s*"#fffbeb"/, '「찾음」 표시까지 지워졌습니다 — 검색 결과가 안 보입니다');
});

test('② 주 보기 — 같은 규칙(칸 배경은 흰색)', () => {
  const fn = 함수몸(캘린더, 'function weekHtml(eumOnly){');
  const m = fn.match(/var wbg = [^;]+;/);
  assert.ok(m, '주 보기 칸 배경 셈을 못 찾았습니다');
  assert.strictEqual(/fffbeb|fef2f2/.test(m[0]), false, '주 보기에 아직 칠이 남아 있습니다: ' + m[0]);
});

test('③ 공휴일 띠(.ev.hol) — 칸 옆까지 닿고, 둥글지 않다', () => {
  const i = 캘린더.indexOf('.ev.hol{');
  assert.ok(i >= 0, '.ev.hol 을 못 찾았습니다');
  const rule = 캘린더.slice(i, 캘린더.indexOf('}', i) + 1);
  assert.match(rule, /border-radius:0\b/, '띠가 아직 둥급니다 — 구글은 각진 띠입니다: ' + rule);
  /* .day 의 좌우 여백(4px)을 지워야 «칸 옆까지» 닿는다 */
  assert.match(rule, /margin:0 -4px/, '좌우로 안 번집니다(칸 여백을 안 지웁니다): ' + rule);
  /* 색 값은 그대로 — 팔레트·이알피 견줌 검사가 이미 이 값을 못 박는다 */
  assert.match(rule, /background:#fecaca/, '색 값이 바뀌었습니다 — cal-same-as-erp 가 이 값을 봅니다');
  assert.match(rule, /color:#991b1b/, '글자색이 바뀌었습니다');
});

test('④ 「오늘」은 여전히 숫자의 파란 동그라미로 표난다', () => {
  assert.match(캘린더, /\.dnum\.today\{background:#2563eb;color:#ffffff/,
    '오늘 표시(파란 동그라미)가 사라졌습니다 — 배경 칠을 지웠으니 이것만은 남아야 합니다');
});

test('⑤ 실제로 그려 본다 — 오늘이면서 공휴일인 칸의 style 에 노랑·분홍이 없다', () => {
  const vm = require('node:vm');
  const 상자 = {
    D: {
      my_schedules: [], attendance_records: [],
      user_accounts: [{ sid: 'P-001', name: '홍길동', status: 'active' }],
      external_staff: [], staff_colors: [],
      holidays: [{ date: '2026-10-03', name: '개천절' }]
    },
    PuWork: require(path.join(ROOT, 'js', 'pu-work-core.js')),
    console, String, Object, Array, JSON, Math, Date, Intl,
    parseInt, parseFloat, isFinite, encodeURIComponent,
    window: { _gcalColors: {} }, fbDb: null,
    S: { filter: null, q: '', scope: 'month', ym: '2026-10', view: 'month', date: '2026-10-03', open: null },
    ME: null
  };
  vm.createContext(상자);
  const 이름들 = ['function esc(s){', 'function arr(v){',
    'function allUsers(){', 'function users(){', 'function userOf(sid){', 'function nameOf(sid){',
    'function externalOf(id){', 'function colorOf(sid){', 'function holidayOf(ymd){',
    'function gcalMailKey(m){', 'function gcalMailMap(){', 'function gcalSidByMail(mail){',
    'function gcalPalette(){', 'function gcalMailColor(mail){', 'function gcalToEvent(ev){',
    'function eventsOn(ymd, eumOnly){', 'function passFilter(ev){', 'function matchSearch(e){',
    'function lunarDay(ymd){', 'function 상대밝기(bg){', 'function 대비(a, b){', 'function textOn(bg){',
    'function monthGrid(ym){', 'function ymdOf(y, m, d){', 'function mixHex(hexA, hexB, t){',
    'function chipHtml(e, ymd){', 'function 펼침Html(eumOnly){', 'function calendarHtml(eumOnly){'];
  let 조각 = 'var _lunar = {}; var GCAL = { evs:[], ym:"", loading:false, err:"" };\n'
    + 'function gcalLoad(){ return Promise.resolve(); }\n'
    + 'function weekHtml(){ return ""; }\n'
    + 'function dayHtml(){ return ""; }\n'
    + 'function todayYMD(){ return "2026-10-03"; }\n'
    + (캘린더.match(/var 칩_어둠_누름 = [^;]+;/) || [''])[0] + '\n'
    + (캘린더.match(/var 칩_옅게\s*= [^;]+;/) || [''])[0] + '\n'
    + 'function 칸용량(){ return 5; }\n';
  이름들.forEach((h) => { 조각 += 함수몸(캘린더, h) + '\n'; });
  조각 += (캘린더.match(/var ATT_SHOW = \[[\s\S]*?\];/) || [''])[0] + '\n';
  vm.runInContext(조각 + '\nvar __html = calendarHtml(false);', 상자);

  const html = 상자.__html;
  const i = html.indexOf('data-day="2026-10-03"');
  assert.ok(i >= 0, '2026-10-03 칸을 못 찾았습니다');
  const 끝 = html.indexOf('data-day="', i + 10);
  const 칸 = html.slice(Math.max(0, html.lastIndexOf('<div class="day', i)), 끝 > 0 ? 끝 : html.length);
  const styleAttr = (칸.match(/style="[^"]*"/) || [''])[0];
  assert.strictEqual(/#fffbeb|#fef2f2/.test(styleAttr), false,
    '오늘+공휴일 칸의 실제 style 에 아직 칠이 남아 있습니다: ' + styleAttr);
  assert.match(칸, /class="ev hol"/, '공휴일 띠 자체가 안 그려졌습니다');
});
