/* 푸른 캘린더 — 한 화면에 담고, 못 담는 것은 «펼쳐» 본다
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-19 「한화면에 나오게하고 달력안에 모든 내용 안보여도 된다.
                        펼서 볼수 있게 하면 된다」

   ★ 어떻게 여기까지 왔나 (되돌리기 전에 «이 차례»를 읽을 것)
     ① 처음 — 한 칸에 넷까지 보이고 나머지는 접었다(이알피와 같은 MAX_SHOW=4).
     ② 「맞다 늘려라」 — 9월 실측으로 56건이 접혀 있어 아무것도 안 접게 했다.
     ③ 「너무 내려왔다 … 드래그해서 아래로 내려가면 안된다」 — 그랬더니 바쁜 달이
        화면 밖으로 내려갔다. 그래서 «한 화면»이 먼저고, 못 담는 것은 펼쳐 본다.
     ⇒ 지금은 ①처럼 접되, 접는 수가 «못 박은 넷»이 아니라 «화면을 재서 나온 수»다.

   ★ 지키려는 것
     ① 칸이 넘치지 않는다 — 용량이 넷이면 넷을 안 넘게 그린다
     ② 접었으면 «몇 개인지» 말한다 (「+N개 더」)
     ③ 누르면 그 날이 «전부» 펼쳐진다 — 다른 화면으로 데려가지 않는다
     ④ 공휴일 칩도 한 줄을 먹는다(안 빼면 접었는데도 넘친다)
     ⑤ 여섯 줄을 «남은 높이»로 나눈다 — 줄이 제멋대로 늘면 화면을 넘긴다
     ⑥ 용량을 «못 박지 않는다» — 그려 놓은 것을 재서 정한다
     ⑦ 머리는 «두 줄»이다 — 탭+사람칩 · 달바+검색 */
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
     2026-09-19 에 실제로 그렇게 샜다. 칸 나누기가 함께 있는 덩이가 넓은 화면 것이다. */
function 넓은화면줄() {
  const m = 캘린더.match(/\.calgrid\{[^}]*grid-template-columns[^}]*\}/);
  assert.ok(m, '넓은 화면 .calgrid 를 못 찾았습니다');
  return m[0];
}

/* ── 달력을 «실제로» 그려 본다 ──
   글자 찾기가 아니다. 하루에 몇 건을 넣고 칸에 몇 개가 그려지는지 센다.
   칸 용량은 검사가 쥐여 준다(화면이 없으므로) — 그 수를 안 넘기는지가 규칙이다. */
function 그려본다(하루, 건수, 공휴일, 용량) {
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
    S: { filter: null, q: '', scope: 'month', ym: 하루.slice(0, 7), view: 'month', date: 하루, open: null }
  };
  vm.createContext(상자);

  const 이름들 = ['function esc(s){', 'function arr(v){', 'function todayYMD(){',
    'function allUsers(){', 'function users(){', 'function userOf(sid){', 'function nameOf(sid){',
    'function externalOf(id){', 'function colorOf(sid){', 'function holidayOf(ymd){',
    'function gcalMailKey(m){', 'function gcalMailMap(){', 'function gcalSidByMail(mail){',
    'function gcalPalette(){', 'function gcalMailColor(mail){', 'function gcalToEvent(ev){',
    'function eventsOn(ymd, eumOnly){', 'function passFilter(ev){', 'function matchSearch(e){',
    'function lunarDay(ymd){', 'function textOn(bg){', 'function monthGrid(ym){',
    'function ymdOf(y, m, d){', 'function mixHex(hexA, hexB, t){', 'function chipHtml(e, ymd){',
    'function 펼침Html(eumOnly){',
    'function calendarHtml(eumOnly){'];
  let 조각 = 'var _lunar = {}; var GCAL = { evs:[], ym:"", loading:false, err:"" };\n'
    + 'function gcalLoad(){ return Promise.resolve(); }\n'
    + 'function weekHtml(){ return ""; }\n'
    + 'function dayHtml(){ return ""; }\n'
    /* ★ 용량은 검사가 쥐여 준다 — 화면이 없으니 잴 수가 없다.
         잰 값을 «쓰는지»가 규칙이고, 잘 재는지는 따로 본다(⑥). */
    + 'function 칸용량(){ return ' + 용량 + '; }\n';
  이름들.forEach((h) => { 조각 += 함수몸(캘린더, h) + '\n'; });
  조각 += (캘린더.match(/var ATT_SHOW = \[[\s\S]*?\];/) || [''])[0] + '\n';
  vm.runInContext(조각 + '\nvar __html = calendarHtml(false);', 상자);

  const html = 상자.__html;
  /* 그 하루의 칸만 떼어 낸다 */
  const i = html.indexOf('data-day="' + 하루 + '"');
  assert.ok(i >= 0, 하루 + ' 칸을 못 찾았습니다');
  const 끝 = html.indexOf('data-day="', i + 10);
  const 칸 = html.slice(i, 끝 > 0 ? 끝 : html.length);
  const 더 = 칸.match(/class="more"[^>]*>\+(\d+)개 더</);
  return {
    상자, 전체: html, 칸,
    일정칩: (칸.match(/class="ev"/g) || []).length,
    공휴칩: (칸.match(/class="ev hol"/g) || []).length,
    더줄: (칸.match(/class="more"/g) || []).length,
    접힌수: 더 ? Number(더[1]) : 0
  };
}

/* 칸이 «몇 줄»을 쓰는가 — 일정 칩 + 공휴일 칩 + 「+N개 더」 줄 */
function 쓴줄(r) { return r.일정칩 + r.공휴칩 + r.더줄; }

test('① 칸이 넘치지 않는다 — 용량이 넷이면 넷을 안 넘게 그린다', () => {
  [[10, 4], [10, 6], [3, 4], [20, 5], [1, 2]].forEach(([건수, 용량]) => {
    const r = 그려본다('2026-09-21', 건수, false, 용량);
    assert.ok(쓴줄(r) <= 용량,
      건수 + '건 · 용량 ' + 용량 + ' 인데 ' + 쓴줄(r) + '줄을 썼습니다 — 칸이 넘칩니다');
  });
});

test('② 접었으면 «몇 개인지» 말한다 — 말없이 감추지 않는다', () => {
  const r = 그려본다('2026-09-21', 10, false, 4);
  assert.strictEqual(r.더줄, 1, '접었는데 「+N개 더」가 없습니다');
  assert.strictEqual(r.일정칩 + r.접힌수, 10,
    '보인 것(' + r.일정칩 + ') + 접힌 것(' + r.접힌수 + ') 이 10건과 안 맞습니다');
});

test('③ 다 들어가면 «접지 않는다» — 쓸데없이 한 번 더 누르게 만들지 않는다', () => {
  const r = 그려본다('2026-09-21', 4, false, 4);
  assert.strictEqual(r.일정칩, 4, '넷이 다 들어가는데 ' + r.일정칩 + '개만 그렸습니다');
  assert.strictEqual(r.더줄, 0, '다 보이는데 「+N개 더」가 붙었습니다');
});

test('④ 공휴일 칩도 한 줄을 먹는다 — 안 빼면 접었는데도 넘친다', () => {
  const r = 그려본다('2026-09-25', 8, true, 4);
  assert.strictEqual(r.공휴칩, 1, '공휴일 칩이 안 보입니다');
  assert.ok(쓴줄(r) <= 4, '공휴일이 있는 날에 ' + 쓴줄(r) + '줄을 썼습니다');
  assert.strictEqual(r.일정칩 + r.접힌수, 8, '접힌 수가 안 맞습니다');
});

test('⑤ 「+N개 더」를 누르면 그 날이 «전부» 펼쳐진다', () => {
  const r = 그려본다('2026-09-21', 10, false, 4);
  /* 펼친 채로 다시 그려 본다 — 펼침 창에는 열 건이 다 있어야 한다 */
  vm.runInContext('S.open = "2026-09-21"; var __pop = 펼침Html(false);', r.상자);
  const pop = r.상자.__pop;
  assert.ok(pop && pop.indexOf('class="pop"') >= 0, '펼침 창이 안 그려졌습니다');
  assert.strictEqual((pop.match(/class="ev"/g) || []).length, 10,
    '펼쳤는데 열 건이 다 안 보입니다');
  assert.ok(pop.indexOf('data-popclose') >= 0, '펼침 창에 닫는 길이 없습니다');
});

test('⑥ 펼침은 «그 자리»에 뜬다 — 보던 달을 잃지 않는다', () => {
  /* 「+N개 더」를 누르는 길이 S.view 나 S.ym 을 건드리면 보던 달을 잃는다.
     한때 그 길이 「그 날로 간다(S.view=day)」였다 — 한 칸 보려고 달을 잃었다. */
  const i = 캘린더.indexOf("t.hasAttribute('data-more')");
  assert.ok(i >= 0, '「+N개 더」를 누르는 길이 없습니다');
  const 끝 = 캘린더.indexOf('}', 캘린더.indexOf('{', i));
  const 길 = 캘린더.slice(i, 끝);
  assert.match(길, /S\.open\s*=/, '펼침을 안 켭니다');
  assert.strictEqual(/S\.view\s*=/.test(길), false, '다른 보기로 데려갑니다 — 보던 달을 잃습니다');
  assert.strictEqual(/S\.ym\s*=/.test(길), false, '보던 달을 바꿉니다');
});

test('⑦ 여섯 줄을 «남은 높이»로 나눈다 — 줄이 제멋대로 늘면 화면을 넘긴다', () => {
  const 줄 = 넓은화면줄();
  assert.match(줄, /grid-template-rows:repeat\(6,\s*1fr\)/,
    '여섯 줄을 남은 높이로 나누지 않습니다: ' + 줄);
  /* 바닥값(minmax)을 두면 그 순간 여섯 줄이 화면을 넘긴다 */
  assert.strictEqual(/grid-auto-rows/.test(줄), false,
    '줄 바닥값이 되살아났습니다 — 바쁜 달이 화면 밖으로 내려갑니다: ' + 줄);
  const 격자 = 함수몸(캘린더, 'function monthGrid(ym){');
  assert.match(격자, /grid\.length < 42/, '42칸을 채우지 않습니다');
});

test('⑧ 달력 탭은 문서를 굴리지 않는다 — 판이 화면 안에서 나뉜다', () => {
  assert.match(캘린더, /html,body\{[^}]*height:100%/, '몸통 높이가 화면에 안 묶였습니다');
  assert.match(캘린더, /body\{[^}]*overflow:hidden/, '문서가 굴러갈 수 있습니다');
  const fit = 캘린더.match(/#app\.fit\{([^}]*)\}/);
  assert.ok(fit, '달력 탭 전용 틀(#app.fit)이 없습니다');
  assert.match(fit[1], /overflow:hidden/, '달력 탭이 제 안에서 굴러갑니다');
  /* 판이 «남은 높이»를 받으려면 사이의 그릇마다 flex 가 이어져야 한다 */
  ['\\.calwrap', '\\.cal', '\\.calgrid'].forEach((그릇) => {
    const re = new RegExp('#app\\.fit ' + 그릇 + '\\{[^}]*flex:1[^}]*min-height:0');
    assert.match(캘린더, re, 그릇 + ' 가 남은 높이를 안 받습니다 — 판이 화면을 넘깁니다');
  });
});

test('⑨ 한 칸에 몇 개인지를 «못 박지 않는다» — 그려 놓고 잰다', () => {
  const 재기 = 함수몸(캘린더, 'function 용량재기(){');
  /* 실제 요소의 높이를 봐야 한다. 상수만 쓰면 꾸밈 한 줄에 또 틀어진다 —
     2026-09-19 에 날짜줄을 22 로 어림했다가 칸마다 11px 씩 넘쳤다. */
  /* 재야 할 것이 «둘»이다 — 날짜줄 높이와 칩 하나의 높이.
     하나라도 상수로 바꾸면 꾸밈 한 줄에 또 틀어진다(2026-09-19 에 11px 씩 넘쳤다). */
  const 잰횟수 = (재기.match(/offsetHeight/g) || []).length;
  assert.ok(잰횟수 >= 2, '재는 자리가 ' + 잰횟수 + '곳뿐입니다 — 날짜줄과 칩을 둘 다 재야 합니다');
  assert.match(재기, /clientHeight/, '판의 높이를 안 봅니다');
  const 어림 = 함수몸(캘린더, 'function 칸용량(){');
  assert.match(어림, /innerHeight/,
    '아직 못 쟀을 때의 어림이 화면 높이를 안 봅니다 — 못 박은 수는 작은 화면에서 넘칩니다');
});
