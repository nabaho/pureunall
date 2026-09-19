/* 푸른 캘린더 — 한 칸에 «다» 보인다 (대표 지시 2026-09-19 「맞다 늘려라」)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 무슨 일이 있었나
     달력은 한 칸에 넷까지만 보이고 나머지를 「N개 더보기」로 접었다(구글이 그렇고
     이알피도 그렇다). 2026년 9월을 «진짜 자료»로 재 보니 42칸 가운데 18칸이 넷을
     넘었고, 그렇게 접혀 안 보이던 일정이 «56건»이었다.
     달력을 펴는 까닭이 바로 그 56건인데, 보려면 칸마다 한 번 더 눌러야 했다.

   ★ 지키려는 것
     ① 칸에 든 일정을 하나도 안 접는다 — 열 개가 들어오면 열 개가 다 그려진다
     ② 「N개 더보기」를 다시 만들지 않는다
     ③ 줄(주)은 늘 수 있되 바닥값이 있다 — 한가한 주가 납작해지면 달력이 표가 된다
     ④ 공휴일 칩이 일정 자리를 깎지 않는다

   ⚠ 이 하나는 이알피와 «다르다». 「대시보드 제외한 화면은 똑같이 만들어라」 뒤에
     온 지시라 이것이 이긴다 — 되돌리려면 그 지시부터 확인할 것. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

/* 이름 붙은 함수 하나의 몸만 떼어 온다 (중괄호를 센다) */
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

/* 달력을 «실제로» 그려 본다 — 글자 찾기가 아니라 나온 HTML 을 센다.
   하루에 일정 몇 건을 넣고, 그 칸에 칩이 몇 개 그려지는지 본다. */
function 그려본다(하루, 건수, 공휴일) {
  const 일정 = [];
  for (let i = 0; i < 건수; i++) {
    일정.push({ id: 's' + i, date: 하루, sid: 'P-001', type: 'meet', title: '가나상사 면담 ' + (i + 1) });
  }
  const 상자 = {
    D: {
      my_schedules: 일정,
      attendance_records: [],
      user_accounts: [{ sid: 'P-001', name: '홍길동', status: 'active' }],
      external_staff: [],
      staff_colors: [],
      holidays: 공휴일 ? [{ date: 하루, name: '추석' }] : []
    },
    PuWork: require(path.join(ROOT, 'js', 'pu-work-core.js')),
    console, String, Object, Array, JSON, Math, Date, Intl,
    parseInt, parseFloat, isFinite, encodeURIComponent,
    window: { _gcalColors: {} },
    fbDb: null,                       /* 구글은 안 부른다 — 여기서 보는 것이 아니다 */
    S: { filter: null, q: '', scope: 'month', ym: 하루.slice(0, 7), view: 'month', date: 하루 }
  };
  vm.createContext(상자);

  const 이름들 = ['function esc(s){', 'function arr(v){', 'function todayYMD(){',
    'function allUsers(){', 'function users(){', 'function userOf(sid){', 'function nameOf(sid){',
    'function externalOf(id){', 'function colorOf(sid){', 'function holidayOf(ymd){',
    'function gcalMailKey(m){', 'function gcalMailMap(){', 'function gcalSidByMail(mail){',
    'function gcalPalette(){', 'function gcalMailColor(mail){', 'function gcalToEvent(ev){',
    'function eventsOn(ymd, eumOnly){', 'function passFilter(ev){', 'function matchSearch(e){',
    'function lunarDay(ymd){', 'function textOn(bg){', 'function monthGrid(ym){',
    'function ymdOf(y, m, d){', 'function chipHtml(e, ymd){', 'function calendarHtml(eumOnly){'];
  let 조각 = 'var _lunar = {}; var GCAL = { evs:[], ym:"", loading:false, err:"" };\n'
    + 'function gcalLoad(){ return Promise.resolve(); }\n'
    + 'function weekHtml(){ return ""; }\n'
    + 'function dayHtml(){ return ""; }\n';
  이름들.forEach((h) => { 조각 += 함수몸(캘린더, h) + '\n'; });
  조각 += (캘린더.match(/var ATT_SHOW = \[[\s\S]*?\];/) || [''])[0] + '\n';
  vm.runInContext(조각 + '\nvar __html = calendarHtml(false);', 상자);

  const html = 상자.__html;
  /* 그 하루의 칸만 떼어 낸다 */
  const i = html.indexOf('data-day="' + 하루 + '"');
  assert.ok(i >= 0, 하루 + ' 칸을 못 찾았습니다');
  const 끝 = html.indexOf('data-day="', i + 10);
  const 칸 = html.slice(i, 끝 > 0 ? 끝 : html.length);
  return {
    전체: html,
    일정칩: (칸.match(/class="ev"/g) || []).length,
    공휴칩: (칸.match(/class="ev hol"/g) || []).length,
    더보기: (칸.match(/class="more"/g) || []).length
  };
}

test('① 열 건이 든 날은 «열 개»가 다 그려진다 — 넷에서 접지 않는다', () => {
  const r = 그려본다('2026-09-21', 10, false);
  assert.strictEqual(r.일정칩, 10,
    '열 건을 넣었는데 ' + r.일정칩 + '개만 그렸습니다 — 다시 접고 있습니다');
});

test('② 「N개 더보기」가 없다 — 한 번 더 누르게 만들지 않는다', () => {
  const r = 그려본다('2026-09-21', 10, false);
  assert.strictEqual(r.더보기, 0, '「더보기」가 ' + r.더보기 + '개 있습니다');
  assert.strictEqual(/개 더보기/.test(r.전체), false, '달력 어딘가에 「더보기」가 남아 있습니다');
});

test('③ 한 건이든 스물이든 그대로 — 뚜껑이 다시 생기지 않았는지', () => {
  assert.strictEqual(그려본다('2026-09-02', 1, false).일정칩, 1);
  assert.strictEqual(그려본다('2026-09-02', 5, false).일정칩, 5);
  assert.strictEqual(그려본다('2026-09-02', 20, false).일정칩, 20);
});

test('④ 공휴일 칩이 일정 자리를 깎지 않는다', () => {
  const r = 그려본다('2026-09-25', 8, true);
  assert.strictEqual(r.공휴칩, 1, '공휴일 칩이 안 보입니다');
  assert.strictEqual(r.일정칩, 8,
    '공휴일이 있는 날에 일정이 ' + r.일정칩 + '개만 그려졌습니다');
});

test('⑤ 줄은 늘되 바닥값이 있다 — 한가한 주가 납작해지면 달력이 표가 된다', () => {
  const m = 캘린더.match(/\.calgrid\{[^}]*grid-auto-rows:minmax\((\d+)px,\s*auto\)/);
  assert.ok(m, '.calgrid 가 늘 수 있게 돼 있지 않습니다');
  assert.ok(Number(m[1]) >= 60, '줄 바닥값이 너무 낮습니다: ' + m[1] + 'px');
  /* 손전화에서도 바닥값이 따로 있어야 한다 — 안 그러면 작은 화면에서 104px 가 이긴다 */
  const 손 = 캘린더.match(/@media \(max-width:700px\)\{[\s\S]*?\n  \}/);
  assert.ok(손, '손전화 규칙 묶음을 못 찾았습니다');
  assert.match(손[0], /\.calgrid\{grid-auto-rows:minmax\(\d+px,auto\)\}/,
    '손전화에서 줄 바닥값을 따로 안 낮췄습니다');
});

test('⑥ 칸을 자르지 않는다 — 늘어난 줄이 다시 잘리면 아무 소용이 없다', () => {
  /* .day 가 제 높이를 넘겨 잘리는 것은 괜찮다(가로로 긴 글자). 줄 자체가
     고정 높이면 세로로 잘린다 — 그것을 막는다. */
  assert.strictEqual(/grid-template-rows:repeat\(6,\s*1fr\)/.test(캘린더), false,
    '여섯 줄을 다시 같은 높이로 눌러 두었습니다 — 넘치는 일정이 잘립니다');
});
