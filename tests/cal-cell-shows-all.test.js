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

/* 넓은 화면 쪽 .calgrid 한 덩이만 떼어 온다.
   ⚠ 그냥 /\.calgrid\{/ 로 찾으면 «손전화 규칙»이 먼저 걸려 통과해 버린다 —
     2026-09-19 에 실제로 그렇게 새고 있었다. 칸 나누기(grid-template-columns)가
     함께 있는 덩이가 넓은 화면 것이다. */
function 넓은화면줄() {
  const m = 캘린더.match(/\.calgrid\{[^}]*grid-template-columns[^}]*\}/);
  assert.ok(m, '넓은 화면 .calgrid 를 못 찾았습니다');
  const v = m[0].match(/grid-auto-rows:([^;}]+)/);
  assert.ok(v, '.calgrid 에 grid-auto-rows 가 없습니다');
  return v[1].trim();
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
  const 줄 = 넓은화면줄();
  assert.match(줄, /,\s*auto\)\s*$/, '줄이 늘 수 없습니다(뚜껑이 auto 가 아닙니다): ' + 줄);
  const px = (줄.match(/(\d+)px/) || [])[1];
  assert.ok(px && Number(px) >= 60, '줄 바닥값이 없거나 너무 낮습니다: ' + 줄);
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

/* ── 머리줄 (대표 지시 2026-09-19 「달력 늘려라」 · 「한줄로 정리해라」) ──
   여태는 두 줄이었다: 사람 칩 한 줄 + 달·보기·검색 한 줄. 오른쪽에 빈 자리가
   넉넉한데 세로로 쌓으니 달력이 그만큼 아래로 밀렸다.
   ⚠ 「.calhead 가 있다」를 글자로 찾지 않는다 — 실제로 그려서 «셋이 한 그릇에»
     들었는지 본다. 그릇만 만들고 밖에 두면 글자 찾기는 통과한다. */
function 머리줄그려본다() {
  const 상자 = {
    D: {
      my_schedules: [{ id: 's1', date: '2026-09-18', sid: 'P-001', type: 'meet', title: '가나상사 면담' }],
      attendance_records: [], external_staff: [], staff_colors: [], holidays: [],
      user_accounts: [{ sid: 'P-001', name: '홍길동', status: 'active' }]
    },
    PuWork: require(path.join(ROOT, 'js', 'pu-work-core.js')),
    console, String, Object, Array, JSON, Math, Date, Intl,
    parseInt, parseFloat, isFinite, encodeURIComponent,
    window: { _gcalColors: {} }, fbDb: null,
    S: { filter: null, q: '', scope: 'month', ym: '2026-09', view: 'month', date: '2026-09-18' }
  };
  vm.createContext(상자);
  const 이름들 = ['function esc(s){', 'function arr(v){', 'function todayYMD(){',
    'function allUsers(){', 'function users(){', 'function userOf(sid){', 'function nameOf(sid){',
    'function externalOf(id){', 'function colorOf(sid){', 'function holidayOf(ymd){',
    'function gcalMailKey(m){', 'function gcalMailMap(){', 'function gcalSidByMail(mail){',
    'function gcalPalette(){', 'function gcalMailColor(mail){', 'function gcalToEvent(ev){',
    'function eventsOn(ymd, eumOnly){', 'function monthDates(){', 'function ymOf(d){',
    'function monthGrid(ym){', 'function passFilter(ev){',
    'function shiftDay(ymd, n){', 'function ymdOf(y, m, d){', 'function lunarDay(ymd){',
    'function lunarRange(ym){', 'function weekDays(ymd){', 'function ieumPeople(){',
    'function monthbarHtml(){', 'function srchHtml(){', 'function chipsHtml(eumOnly){',
    'function calheadHtml(eumOnly){'];
  let 조각 = 'var _lunar = {}; var GCAL = { evs:[], ym:"", loading:false, err:"" };\n'
    + 'var ME = { sid:"P-001" };\n';
  이름들.forEach((h) => { 조각 += 함수몸(캘린더, h) + '\n'; });
  조각 += (캘린더.match(/var ATT_SHOW = \[[\s\S]*?\];/) || [''])[0] + '\n';
  vm.runInContext(조각 + '\nvar __h = calheadHtml(false);', 상자);
  return 상자.__h;
}

/* <div class="calhead"> 가 «닫히는 자리»를 찾아 그 안쪽만 돌려준다.
   ⚠ 「calhead 뒤에 나오면 된다」로 보면 그릇 «밖»에 붙여 둔 것도 통과한다 —
     2026-09-19 이빨 확인에서 실제로 그렇게 샜다. 여는 div 를 세어 짝을 찾는다. */
function 머리줄안쪽(h) {
  const i = h.indexOf('<div class="calhead"');
  assert.ok(i >= 0, '머리줄 그릇(.calhead)이 없습니다');
  let d = 0, k = i;
  while (k < h.length) {
    if (h.startsWith('<div', k)) d++;
    else if (h.startsWith('</div>', k)) { d--; if (d === 0) return h.slice(i, k); }
    k++;
  }
  throw new Error('머리줄 그릇이 안 닫혔습니다');
}

test('⑦ 달 이동·보기·검색이 «한 줄»에 있다 — 쌓으면 달력이 그만큼 밀린다', () => {
  const h = 머리줄그려본다();
  /* 그릇이 «하나»여야 한다 — 둘이면 그게 두 줄이다 */
  assert.strictEqual((h.match(/class="calhead"/g) || []).length, 1, '머리줄 그릇이 둘 이상입니다');
  const 안 = 머리줄안쪽(h);
  ['class="monthbar"', 'class="srch"'].forEach((부품) => {
    assert.ok(안.indexOf(부품) >= 0, 부품 + ' 가 머리줄 «안»에 없습니다(밖에 붙어 있으면 그게 두 줄이다)');
  });
  /* ★ 사람 칩은 여기 있으면 «안 된다» — 탭 줄로 올렸다(대표 지시 2026-09-19).
     되돌아오면 줄이 하나 다시 생기고 달력이 그만큼 내려간다. */
  assert.strictEqual(h.indexOf('class="chips"') >= 0, false,
    '사람 칩이 달력 머리줄로 되돌아왔습니다 — 탭 줄에 있어야 합니다');
});

/* 탭 줄을 실제로 그려 본다 — $ 는 innerHTML 만 받아 두는 가짜를 준다 */
function 탭줄그려본다(탭) {
  const 담기 = { innerHTML: '' };
  const 상자 = {
    D: {
      my_schedules: [{ id: 's1', date: '2026-09-18', sid: 'P-001', type: 'meet', title: '가나상사 면담' }],
      attendance_records: [], external_staff: [], staff_colors: [], holidays: [],
      user_accounts: [{ sid: 'P-001', name: '홍길동', status: 'active' }]
    },
    PuWork: require(path.join(ROOT, 'js', 'pu-work-core.js')),
    console, String, Object, Array, JSON, Math, Date, Intl,
    parseInt, parseFloat, isFinite, encodeURIComponent,
    window: { _gcalColors: {} }, fbDb: null,
    $: () => 담기,
    S: { filter: null, q: '', scope: 'month', ym: '2026-09', view: 'month', date: '2026-09-18', tab: 탭 }
  };
  vm.createContext(상자);
  const 이름들 = ['function esc(s){', 'function arr(v){', 'function todayYMD(){',
    'function allUsers(){', 'function users(){', 'function userOf(sid){', 'function nameOf(sid){',
    'function externalOf(id){', 'function colorOf(sid){', 'function holidayOf(ymd){',
    'function gcalMailKey(m){', 'function gcalMailMap(){', 'function gcalSidByMail(mail){',
    'function gcalPalette(){', 'function gcalMailColor(mail){', 'function gcalToEvent(ev){',
    'function eventsOn(ymd, eumOnly){', 'function monthDates(){', 'function monthGrid(ym){',
    'function ymdOf(y, m, d){', 'function ieumPeople(){', 'function chipsHtml(eumOnly){',
    'function renderTabs(){'];
  let 조각 = 'var _lunar = {}; var GCAL = { evs:[], ym:"", loading:false, err:"" };\n'
    + 'var ME = { sid:"P-001" };\n'
    + (캘린더.match(/var TABS = \[[\s\S]*?\n\];/) || [''])[0] + '\n';
  이름들.forEach((h) => { 조각 += 함수몸(캘린더, h) + '\n'; });
  조각 += (캘린더.match(/var ATT_SHOW = \[[\s\S]*?\];/) || [''])[0] + '\n';
  vm.runInContext(조각 + '\nrenderTabs();', 상자);
  return 담기.innerHTML;
}

test('⑩ 사람 칩이 «탭 줄»에 얹혀 있다 — 제 줄을 따로 차지하지 않는다', () => {
  const h = 탭줄그려본다('cal');
  assert.ok(h.indexOf('data-t="cal"') >= 0, '탭이 안 그려졌습니다');
  assert.ok(h.indexOf('class="chips"') >= 0,
    '탭 줄에 사람 칩이 없습니다 — 칩이 제 줄을 따로 차지하면 달력이 그만큼 내려갑니다');
  assert.ok(h.indexOf('class="pchip') >= 0, '사람 동그라미가 안 그려졌습니다');
  /* 오른쪽 끝에 붙어야 한다 — 탭 사이에 끼면 어느 것이 탭이고 어느 것이 거르개인지 헷갈린다 */
  const c = 캘린더.match(/.tabchips{([^}]*)}/);
  assert.ok(c, '.tabchips 꾸밈이 없습니다');
  assert.match(c[1], /margin-left:auto/, '칩이 탭 줄 오른쪽 끝에 안 붙습니다: ' + c[1]);
});

test('⑪ 걸러 낼 것이 없는 탭에는 칩을 안 얹는다 — 자리만 먹는다', () => {
  const h = 탭줄그려본다('eumppl');
  assert.ok(h.indexOf('data-t="eumppl"') >= 0, '탭이 안 그려졌습니다');
  assert.strictEqual(h.indexOf('class="chips"') >= 0, false,
    '인원 현황 탭에까지 사람 칩이 붙었습니다 — 거기서는 아무 일도 안 합니다');
});

test('⑨ 화면이 그 그릇을 «실제로» 쓴다 — 그릇만 만들어 두면 소용이 없다', () => {
  /* 달력 탭을 그리는 대목에서 세 부품을 «따로» 부르면 다시 두 줄이 된다.
     그릇(calheadHtml)만 부르고, 부품은 그 안에서만 불러야 한다. */
  const i = 캘린더.indexOf("'<div class=\"calwrap\">'");
  assert.ok(i >= 0, '달력을 그리는 대목을 못 찾았습니다');
  const 줄 = 캘린더.slice(i, 캘린더.indexOf('\n', i));
  assert.match(줄, /calheadHtml\(/, '머리줄 그릇을 안 씁니다: ' + 줄.trim());
  ['chipsHtml(', 'monthbarHtml(', 'srchHtml('].forEach((부품) => {
    assert.strictEqual(줄.indexOf(부품) >= 0, false,
      부품 + ' 를 머리줄 밖에서 따로 부릅니다 — 그만큼 줄이 늘어납니다: ' + 줄.trim());
  });
});

test('⑧ 머리줄은 가로로 눕는다 — 세로로 쌓이면 한 줄이 아니다', () => {
  const m = 캘린더.match(/\.calhead\{([^}]*)\}/);
  assert.ok(m, '.calhead 꾸밈이 없습니다');
  assert.match(m[1], /display:flex/, '머리줄이 가로줄이 아닙니다: ' + m[1]);
  assert.strictEqual(/flex-direction:column/.test(m[1]), false, '머리줄이 세로로 쌓입니다');
  /* 안쪽 두 줄의 아래 여백을 지워야 한 줄로 붙는다 */
  assert.match(캘린더, /\.calhead \.monthbar\s*,\s*\.calhead \.chips\{[^}]*margin-bottom:0/,
    '안쪽 줄의 아래 여백이 남아 있습니다 — 한 줄인데 두 줄만큼 높습니다');
});
