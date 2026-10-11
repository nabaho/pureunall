/* 푸른 캘린더 — 폰 보기 전환(월·일정·주·일)과 「일정」 목록 보기 (2026-10-11)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-10 「/goal 완벽하게 구글 캘린더와 똑같이」 — 구글 폰 앱처럼:
     ① 폰은 어느 보기든 위젯 꼴 머리(제목 ▾ · ‹ › · ＋) — 예전엔 월에서만 그랬고 주·일은 PC 머리줄이 그대로 떴다
     ② 제목을 누르면 보기 고르기(월·일정·주·일)
     ③ 「일정」 보기: 그 달에서 일정 있는 날(오늘은 늘)만, 날짜 열 + 색 카드, 「종일」·「오후 2:00 – 오후 3:00」
     ④ 일정 보기에 들어오면 오늘로 내려가고, 빈 자리를 눌러도 새 일정이 안 생긴다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const 캘린더 = fs.readFileSync(path.join(__dirname, '..', 'pu-cal.html'), 'utf8');
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

function 상자(S, 일정들) {
  const b = { console, String, Object, Array, Number, Math, Date, parseInt, RegExp, JSON, S,
    todayYMD: () => '2026-10-11', 공휴칩: (ds) => (ds === '2026-10-09' ? { kind: 'hol', text: '한글날', color: '#d81b60', store: '', id: 'h' } : null),
    eventsOn: (ds) => (일정들[ds] || []), passFilter: () => true, matchSearch: () => true,
    esc: (v) => String(v == null ? '' : v), 선아이콘: (n) => '<svg data-ic="' + n + '"></svg>', 목록순: () => 0,
    lunarRange: () => '병오년8월 – 9월', weekDays: (d) => ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'] };
  vm.createContext(b);
  ['function 날짜글(ymd){', 'function 시각글(hm){', 'function 시분(ms){', 'function 폰일정Html(eumOnly){', 'function 폰머리Html(){']
    .forEach((h) => vm.runInContext(함수몸(h), b));
  return b;
}
const GLINK = 'var GLINK = { st: "ok", why: "" };';

test('③ 일정 보기 — 일정 있는 날(오늘은 늘)만, 날짜 열 + 색 카드 + 시각 글자', () => {
  const b = 상자({ ym: '2026-10', view: 'sched' }, {
    '2026-10-14': [
      { kind: 'gcal', store: 'gcal', id: 'g1', text: '1000 에스에이씨', time: '14:00', endAt: Date.parse('2026-10-14T15:00:00+09:00'), color: '#039be5' },
      { kind: 'gcal', store: 'gcal', id: 'g2', text: '종일 행사', time: '', color: '#f6bf26' },
    ],
    '2026-10-20': [{ kind: 'gcal', store: 'gcal', id: 'g3', text: '여러 날', time: '', end: '2026-10-22', color: '#616161' }],
  });
  const html = vm.runInContext('폰일정Html(false)', b);
  const 날 = [...html.matchAll(/class="sday[^"]*" data-day="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
  assert.deepStrictEqual(날, ['2026-10-09', '2026-10-11', '2026-10-14', '2026-10-20'], '일정 없는 날이 끼었거나 오늘·공휴일이 빠졌습니다');
  assert.match(html, /class="sday today" data-day="2026-10-11"/, '오늘 칸이 표시되지 않습니다');
  assert.match(html, /일정 없음/, '오늘에 일정이 없으면 「일정 없음」');
  assert.match(html, /오후 2:00 – 오후 3:00/, '시각 글자가 구글 꼴이 아닙니다');
  assert.match(html, /<span>종일<\/span>/);
  assert.match(html, /종일 \(~10\/22\)/, '여러 날 일정의 끝날이 없습니다');
  assert.match(html, /data-ev="gcal:g1"/, '눌러 여는 길이 칩과 다릅니다');
  assert.match(html, /data-holday="2026-10-09"/, '공휴일이 눌리지 않습니다');
  assert.match(html, /background:#f6bf26;color:#1f1f1f/, '밝은 카드에 어두운 글자를 안 씁니다');
  assert.match(html, /background:#039be5;color:#ffffff/, '어두운 카드에 흰 글자를 안 씁니다');
});

test('①② 폰 머리 — 보기마다 제목, 제목을 누르면 보기 고르기', () => {
  const 머리 = (S) => { const b = 상자(S, {}); vm.runInContext(GLINK, b); return vm.runInContext('폰머리Html()', b); };
  const 월 = 머리({ ym: '2026-10', view: 'month', date: '2026-10-14', vmenu: false });
  assert.match(월, /data-vmenu="1"/); assert.match(월, /<b>10월<\/b><i class="mcar">/); assert.match(월, /병오년8월 – 9월/);
  assert.ok(!/class="vmenu"/.test(월), '메뉴가 닫혀 있어야 합니다');
  const 주 = 머리({ ym: '2026-10', view: 'week', date: '2026-10-14', vmenu: false });
  assert.match(주, /11일 – 17일/, '주 보기의 제목 줄이 범위가 아닙니다');
  const 일 = 머리({ ym: '2026-10', view: 'day', date: '2026-10-14', vmenu: false });
  assert.match(일, /14일 \(수\)/, '일 보기의 제목 줄');
  const 열림 = 머리({ ym: '2026-10', view: 'sched', date: '2026-10-14', vmenu: true });
  for (const v of ['month', 'sched', 'week', 'day']) assert.ok(열림.includes('data-view="' + v + '"'), '보기 메뉴에 없음: ' + v);
  assert.match(열림, /data-view="sched" class="on"/, '지금 보기에 표시가 없습니다');
  assert.match(열림, /data-vclose="1"/, '바깥을 눌러 닫는 길이 없습니다');
});

test('④ 처리 — 폰은 모든 보기가 폰 머리 · 일정 보기는 오늘로 내려가고 빈 자리는 조용하다', () => {
  assert.match(캘린더, /var 폰달력 = 달력 && 폰\(\);/, '폰 꼴이 아직 월에만 걸려 있습니다');
  assert.match(함수몸('function calendarHtml(eumOnly){'), /if\(S\.view === "sched"\) return 폰머리 \+ 폰일정Html\(eumOnly\)/);
  assert.match(캘린더, /if\(S\.view === 'sched' && 이전보기 !== 'sched'\) S\.schedScroll = true;/, '들어올 때 오늘로 안 내려갑니다');
  assert.match(캘린더, /if\(S\.view === 'sched'\) return;\s+\/\* 일정 보기의 빈 자리/, '일정 보기의 빈 자리를 눌러도 새 일정이 생깁니다');
  assert.match(캘린더, /S\.view!=='month' && S\.view!=='sched'\)\{/, '일정 보기에서 ‹ › 가 달 단위가 아닙니다');
  assert.match(캘린더, /\[\["month","월"\],\["sched","일정"\],\["week","주"\],\["day","일"\]\]\.map/, 'PC 머리줄에도 「일정」이 있어야 합니다');
});
