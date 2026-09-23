/* 푸른 캘린더 — 달력 위의 «머리»는 두 줄이다
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-19 「한줄로 정리해라」 · 「캡쳐1은 캡쳐2 줄에 넣어라」

   ★ 무슨 일이 있었나
     달력 위가 «세 줄»이었다 — 탭 줄 · 사람 칩 줄 · 달 이동 줄. 그만큼 달력이
     아래로 밀렸다. 그런데 탭 줄은 왼쪽 절반도 안 쓰고 오른쪽이 통째로 비어 있었다.

   ★ 지키려는 것
     ① 달 이동·보기·검색은 «한 줄»이다 (.calhead)
     ② 사람 칩은 거기 없다 — «탭 줄» 오른쪽 끝에 얹는다
     ③ 걸러 낼 것이 없는 탭에는 칩을 안 얹는다 (자리만 먹는다)
     ④ 화면이 그 그릇을 실제로 쓴다 (그릇만 만들어 두면 소용이 없다)

   ⚠ 글자 찾기가 아니다 — $ 를 가짜로 주고 «실제로 그려» 본다.
     그릇만 만들고 밖에 두면 글자 찾기는 통과한다(2026-09-19 이빨 확인에서 그렇게 샜다). */
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
    /* 2026-09-20 — srchHtml 이 「계정 잇기」 단추를 앞에 붙인다(1걸음-나).
       그 단추가 세는 함수들도 함께 넣어야 상자가 돈다. */
    'function 관리자인가(){', 'function 잇기할수있나(){', 'function 색단추Html(){',
    'function 메일줄들(){', 'function 안이은수(){',
    /* 2026-09-20 — srchHtml 이 「구글 로그인」 단추도 앞에 붙인다(3걸음-나) */
    'function 이어진건있나(){', 'function 구글단추Html(){',
    'function 잇기단추Html(){',
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
  /* ⚠ 줄머리에서 시작하는 «그 자체» 규칙만 본다 — #app.fit .calhead{flex:none} 처럼
     덧붙인 규칙이 앞에 있으면 그것이 먼저 걸려 엉뚱한 것을 잰다(2026-09-19 에 그랬다). */
  const m = 캘린더.match(/(?:^|\n)\s*\.calhead\{([^}]*)\}/);
  assert.ok(m, '.calhead 꾸밈이 없습니다');
  assert.match(m[1], /display:flex/, '머리줄이 가로줄이 아닙니다: ' + m[1]);
  assert.strictEqual(/flex-direction:column/.test(m[1]), false, '머리줄이 세로로 쌓입니다');
  /* 안쪽 두 줄의 아래 여백을 지워야 한 줄로 붙는다 */
  /* 안쪽 줄이 제 아래 여백을 들고 있으면 한 줄인데 두 줄만큼 높다.
     ⚠ 사람 칩은 이제 탭 줄에 있으므로 «달바»만 본다. */
  assert.match(캘린더, /\.calhead \.monthbar[^{]*\{[^}]*margin-bottom:0/,
    '안쪽 줄의 아래 여백이 남아 있습니다 — 한 줄인데 두 줄만큼 높습니다');
});
