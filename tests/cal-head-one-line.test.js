/* 푸른 캘린더 — 달력 위의 «머리»는 한 줄이다
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-19 「한줄로 정리해라」 · 「캡쳐1은 캡쳐2 줄에 넣어라」
   대표 지시 2026-09-27 「캡쳐3 이부분 1줄로 정렬 … 중복되는부분 합치고」 → 「이음합치고 추천대로」

   ★ 무슨 일이 있었나
     처음엔 네 줄(머리줄 · 탭 · 사람 칩 · 달 이동)이었다. 2026-09-19 에 칩을 탭 줄에 얹어
     세 줄이 됐고, 2026-09-27 에 구글 캘린더처럼 «한 줄»로 합쳤다:
       이름 · 탭 · [오늘] ‹ › 2026년 9월 … 사람 칩 · 푸른/구글 · 🔍 · 월|주|일 · 🌙 · 즐겨찾기 · (나)
   ★ 겹치던 것을 합쳤다
     ① 「← 푸른이알피」 → 내 동그라미 창 안으로(즐겨찾기와 겹쳤다)
     ② 연결됨 · 메일 · 로그아웃 → 내 동그라미 하나
     ③ 「🔐 구글 로그인」 → 구글 칩 옆 자물쇠 + 동그라미 창
     ④ 캘린더 안 「이음」 거르개 → 「이음 근무」 탭 하나
     ⑤ 늘 떠 있던 검색칸 → 돋보기(누르면 펼침)
     ⑥ 탭 묶음 글자(법인·이음센터)·그림글자 → 이름만

   ⚠ 글자 찾기가 아니다 — $ 를 가짜로 주고 renderTabs 를 «실제로 그려» 본다.
     그릇만 만들고 밖에 두면 글자 찾기는 통과한다(2026-09-19 이빨 확인에서 그렇게 샜다). */
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

/* 머리줄을 실제로 그려 본다 — $ 는 innerHTML 만 받아 두는 가짜를 준다 */
function 머리그려본다(탭, 더) {
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
    S: Object.assign({ filter: null, q: '', scope: 'month', ym: '2026-09', view: 'month', date: '2026-09-18', tab: 탭 }, 더 || {})
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
    'function 관리자인가(){', 'function 잇기할수있나(){', 'function 색단추Html(){',
    'function 메일줄들(){', 'function 안이은수(){',
    'function 이어진건있나(){', 'function 구글단추Html(){', 'function 잇기단추Html(){',
    'function monthbarHtml(){', 'function segHtml(){', 'function srchHtml(){', 'function chipsHtml(eumOnly){',
    'function calheadHtml(eumOnly){', 'function 창도구Html(){', 'function renderTabs(){'];
  let 조각 = 'var _lunar = {}; var GCAL = { evs:[], ym:"", loading:false, err:"" };\n'
    + 'var ME = { sid:"P-001" };\n'
    + (캘린더.match(/var TABS = \[[\s\S]*?\n\];/) || [''])[0] + '\n';
  이름들.forEach((h) => { 조각 += 함수몸(캘린더, h) + '\n'; });
  조각 += (캘린더.match(/var ATT_SHOW = \[[\s\S]*?\];/) || [''])[0] + '\n';
  vm.runInContext(조각 + '\nrenderTabs();', 상자);
  return 담기.innerHTML;
}

test('⑦ 탭 · 달 이동 · 사람 칩 · 도구가 «한 그릇(#tabs)»에 차례대로 든다 — 구글 머리줄 차례', () => {
  const h = 머리그려본다('cal');
  const 자리 = ['data-t="cal"', 'class="monthbar"', 'class="chips"', 'data-srch', 'class="seg"']
    .map((부품) => {
      const i = h.indexOf(부품);
      assert.ok(i >= 0, 부품 + ' 가 머리줄에 없습니다(따로 줄에 있으면 그게 두 줄이다)');
      return i;
    });
  const 차례 = 자리.slice().sort((a, b) => a - b);
  assert.deepStrictEqual(자리, 차례, '차례가 구글과 다릅니다(탭 → 달 이동 → 사람 칩 → 🔍 → 월|주|일)');
});

test('⑦-2 그 그릇은 맨 위 머리줄(#topbar) «안»에 있다 — 따로 한 줄을 차지하지 않는다', () => {
  const i = 캘린더.indexOf('<div id="topbar">');
  assert.ok(i >= 0, '#topbar 가 없습니다');
  /* 머리줄이 닫히기 전에 #tabs 가 들어 있어야 한다 */
  let d = 0, k = i, 끝 = -1;
  while (k < 캘린더.length) {
    if (캘린더.startsWith('<div', k)) d++;
    else if (캘린더.startsWith('</div>', k)) { d--; if (d === 0) { 끝 = k; break; } }
    k++;
  }
  const 머리 = 캘린더.slice(i, 끝);
  assert.ok(/id="tabs"/.test(머리), '탭 그릇이 머리줄 밖에 있습니다 — 그만큼 줄이 늘어납니다');
  assert.strictEqual((캘린더.match(/id="tabs"/g) || []).length, 1, '탭 그릇이 둘입니다');
});

test('⑪ 걸러 낼 것이 없는 탭에는 칩·달 이동을 안 얹는다 — 자리만 먹는다', () => {
  const h = 머리그려본다('eumppl');
  assert.ok(h.indexOf('data-t="eumppl"') >= 0, '탭이 안 그려졌습니다');
  assert.strictEqual(h.indexOf('class="chips"') >= 0, false, '인원 현황 탭에까지 사람 칩이 붙었습니다');
  assert.strictEqual(h.indexOf('class="monthbar"') >= 0, false, '인원 현황 탭에까지 달 이동이 붙었습니다');
});

test('⑨ 달력 판 위에 따로 줄을 두지 않는다 — 달 이동·칩·검색은 머리줄에서만 그린다', () => {
  const i = 캘린더.indexOf("'<div class=\"calwrap\">'");
  assert.ok(i >= 0, '달력을 그리는 대목을 못 찾았습니다');
  const 줄 = 캘린더.slice(i, 캘린더.indexOf('\n', i));
  ['calheadHtml(', 'chipsHtml(', 'monthbarHtml(', 'srchHtml('].forEach((부품) => {
    assert.strictEqual(줄.indexOf(부품) >= 0, false,
      부품 + ' 를 달력 판 위에서 또 부릅니다 — 줄이 하나 늘어납니다: ' + 줄.trim());
  });
});

test('⑧ 머리줄은 가로로 눕고 «안 접힌다» — 넘치면 줄이지 내리지 않는다', () => {
  const m = 캘린더.match(/(?:^|\n)\s*#topbar\{([^}]*)\}/);
  assert.ok(m, '#topbar 꾸밈이 없습니다');
  assert.match(m[1], /display:flex/, '머리줄이 가로줄이 아닙니다: ' + m[1]);
  assert.match(m[1], /white-space:nowrap/, '머리줄 글자가 접힙니다: ' + m[1]);
  assert.strictEqual(/flex-wrap:\s*wrap/.test(m[1]), false, '머리줄이 두 줄로 접힙니다: ' + m[1]);
  const c = 캘린더.match(/(?:^|\n)\s*\.calhead\{([^}]*)\}/);
  assert.ok(c, '.calhead 꾸밈이 없습니다');
  assert.strictEqual(/flex-wrap:\s*wrap/.test(c[1]), false, '달 이동이 접힙니다: ' + c[1]);
});

/* ── 겹치던 것 합치기 (대표 지시 2026-09-27 「이음합치고 추천대로」) ── */

test('④ 캘린더 안 「이음」 거르개는 없다 — 「이음 근무」 탭 하나로 합쳤다', () => {
  const h = 머리그려본다('cal');
  assert.strictEqual(/data-f="eumwork"/.test(h), false, '「이음」 거르개가 되살아났습니다 — 탭과 겹칩니다');
  assert.ok(/data-t="eumcal"/.test(h), '「이음 근무」 탭이 없습니다 — 이음 근무만 보는 길이 사라졌습니다');
});

test('③⑤ 머리줄에 「구글 로그인」 단추·늘 떠 있는 검색칸이 없다 — 자물쇠·돋보기로 합쳤다', () => {
  const h = 머리그려본다('cal');
  assert.strictEqual(/class="glogin"/.test(h), false, '구글 로그인 단추가 머리줄에 남았습니다');
  assert.strictEqual(/id="calq"/.test(h), false, '찾는 말이 없는데 검색칸이 펼쳐져 있습니다');
  const 찾는중 = 머리그려본다('cal', { q: '가나' });
  assert.ok(/id="calq"/.test(찾는중), '찾는 말이 있는데 검색칸이 접혔습니다 — 무엇으로 걸렀는지 안 보입니다');
});

test('①② 푸른이알피·로그아웃·연결됨은 «내 동그라미» 창 안에 있다 — 길은 그대로 남는다', () => {
  const i = 캘린더.indexOf('id="avamenu"');
  assert.ok(i >= 0, '내 동그라미 창이 없습니다');
  const 창 = 캘린더.slice(i, 캘린더.indexOf('</span>\n</div>', i));
  ['id="goErp"', 'id="logout"', 'id="conn"'].forEach((x) => {
    assert.ok(창.indexOf(x) >= 0, x + ' 가 동그라미 창에 없습니다 — 그 길이 사라졌습니다');
  });
  assert.strictEqual((캘린더.match(/id="goErp"/g) || []).length, 1, '푸른이알피 단추가 두 곳에 있습니다');
  assert.ok(/data-avatar/.test(캘린더), '동그라미를 눌러 창을 여는 길이 없습니다');
});
