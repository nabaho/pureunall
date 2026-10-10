/* 푸른 캘린더 — 일정 입력 창은 구글 캘린더 «앱» 입력 화면과 같은 꼴 (2026-10-10)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-10 「완벽하게 구글 캘린더와 똑같이 … 색디자인 크기 글자모양 등 날짜에 데이터 입력형태 등
   모든 것 똑같이」.

   ★ 이 검사가 지키는 것
     ① 날짜는 「10월 10일 (토)」(올해가 아니면 연도 포함) · 시간은 「오후 9:00」 — 24시 「21:00」·「2026-10-10」 입력칸이 아니다
     ② 줄 앞 아이콘은 머티리얼 «선 아이콘»(SVG) — 이모지(🕒📍👤📅🏢)가 아니다
     ③ 「종일」 스위치 · 시작 줄 · 끝 줄(끝나는 날을 따로) — 새 일정은 «시간 일정»이 기본(다음 정각)
     ④ 시작 날을 옮기면 하루짜리는 끝도 따라가고, 여러 날은 «길이»를 지킨다 · 끝이 시작보다 앞서면 시작에 맞춘다
     ⑤ 시작 시각을 옮기면 끝 시각도 같은 길이만큼 따라간다(끝을 직접 고쳤으면 그대로)
     ⑥ 끝나는 날은 구글(createEvent)·우리 표(item.endDate)·서버 대신 넣기(eventOf)까지 간다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
const P = require(path.join(ROOT, 'functions', 'gcal-proxy.js'));

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

function 상자(extra) {
  const b = Object.assign({ console, String, Object, Array, JSON, Math, Date, Number, RegExp,
    todayYMD: () => '2026-10-10' }, extra || {});
  vm.createContext(b);
  ['function 날짜글(ymd){', 'function 시각글(hm){', 'function 한시간뒤(hm){', 'function 새시각(ymd){']
    .forEach((h) => vm.runInContext(함수몸(h), b));
  return b;
}

test('① 날짜·시간 글자 — 구글 앱 꼴', () => {
  const b = 상자();
  const 날 = (v) => vm.runInContext('날짜글(' + JSON.stringify(v) + ')', b);
  const 시 = (v) => vm.runInContext('시각글(' + JSON.stringify(v) + ')', b);
  const 연 = new Date().getFullYear();
  assert.strictEqual(날(연 + '-10-10'), '10월 10일 (' + ['일','월','화','수','목','금','토'][new Date(연, 9, 10).getDay()] + ')');
  assert.match(날('2025-12-31'), /^2025년 12월 31일 \(수\)$/, '올해가 아니면 연도가 붙어야 한다');
  assert.strictEqual(날(''), '날짜 선택');
  assert.deepStrictEqual(['00:00', '09:05', '12:00', '13:30', '23:59'].map(시),
    ['오전 12:00', '오전 9:05', '오후 12:00', '오후 1:30', '오후 11:59']);
  assert.strictEqual(시(''), '');
});

test('③ 한 시간 뒤 · 새 일정의 처음 시각(다음 정각, 오늘이 아니면 아침 9시)', () => {
  const b = 상자();
  const 뒤 = (v) => vm.runInContext('한시간뒤(' + JSON.stringify(v) + ')', b);
  assert.strictEqual(뒤('09:30'), '10:30');
  assert.strictEqual(뒤('23:10'), '23:59', '밤을 넘기지 않는다');
  assert.strictEqual(뒤(''), '');
  assert.strictEqual(vm.runInContext('새시각("2026-10-14")', b), '09:00');
  const h = new Date().getHours() + 1;
  assert.strictEqual(vm.runInContext('새시각("2026-10-10")', b), h > 23 ? '23:00' : ('0' + h).slice(-2) + ':00');
});

test('② 줄 앞은 선 아이콘(SVG) — 이모지 아이콘이 아니다 · ③ 종일 스위치와 시작·끝 줄', () => {
  const 창 = 함수몸('function modalHtml(){');
  assert.ok(!/줄\("(🕒|📍|👤|📅|🏢|👥)"/.test(창), '줄 앞에 이모지 아이콘이 남아 있습니다');
  assert.match(창, /<svg class="gic"/, 'SVG 선 아이콘이 없습니다');
  for (const k of ['schedule', 'place', 'person', 'notes', 'group', 'calendar', 'business', 'close', 'map']) {
    assert.match(캘린더, new RegExp('\\b' + k + ':"M'), '아이콘 길이 없습니다: ' + k);
  }
  assert.match(창, /role="switch"/, '「종일」 스위치가 없습니다');
  assert.match(창, /data-mtime="/, '스위치가 시간·종일 전환을 못 합니다');
  assert.match(창, /날짜칸\("date"/); assert.match(창, /날짜칸\("endDate"/, '끝 줄이 없습니다');
  assert.match(창, /시간칸\("time"/); assert.match(창, /시간칸\("endTime"/);
  assert.match(창, /placeholder="제목 추가"/, '구글 안내 글 「제목 추가」');
  const 새 = 함수몸('function openNew(ymd){');
  assert.match(새, /timed:true, time:새시각\(ymd\)/, '새 일정이 시간 일정으로 시작하지 않습니다');
});

/* modalRead 를 가짜 화면(입력칸 값)으로 돌린다 */
function 읽기(상태, 칸값) {
  const els = {};
  Object.keys(칸값).forEach((k) => { els[k] = { value: 칸값[k] }; });
  const b = 상자({
    S: { modal: 상태 },
    document: { querySelector: (sel) => { const m = /data-m='(\w+)'/.exec(sel); return m && els[m[1]] ? els[m[1]] : null; } },
    shiftDay: (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10),
  });
  vm.runInContext(함수몸('function modalRead(){'), b);
  vm.runInContext('modalRead()', b);
  return JSON.parse(JSON.stringify(b.S.modal));
}
const 기본 = () => ({ mode: 'new', kind: 'sch', date: '2026-10-14', endDate: '2026-10-14', timed: true, time: '09:00', endTime: '' });

test('④ 시작 날을 옮기면 — 하루짜리는 끝도 따라가고, 여러 날은 길이를 지킨다', () => {
  assert.deepStrictEqual(
    ((m) => [m.date, m.endDate])(읽기(기본(), { date: '2026-10-20', endDate: '2026-10-14' })), ['2026-10-20', '2026-10-20']);
  const 여럿 = Object.assign(기본(), { endDate: '2026-10-17' });                        /* 사흘 길이 */
  assert.deepStrictEqual(((m) => [m.date, m.endDate])(읽기(여럿, { date: '2026-10-20', endDate: '2026-10-17' })),
    ['2026-10-20', '2026-10-23']);
  /* 끝나는 날을 «직접» 고르면 그대로(시작은 안 바뀜) */
  assert.deepStrictEqual(((m) => [m.date, m.endDate])(읽기(기본(), { date: '2026-10-14', endDate: '2026-10-18' })),
    ['2026-10-14', '2026-10-18']);
  /* 끝이 시작보다 앞서면 시작에 맞춘다 */
  assert.deepStrictEqual(((m) => [m.date, m.endDate])(읽기(기본(), { date: '2026-10-14', endDate: '2026-10-10' })),
    ['2026-10-14', '2026-10-14']);
});

test('⑤ 시작 시각을 옮기면 끝 시각도 같은 길이만큼 — 끝을 직접 고쳤으면 그대로', () => {
  const 잡음 = Object.assign(기본(), { time: '09:00', endTime: '11:00' });
  assert.strictEqual(읽기(잡음, { time: '13:00', endTime: '11:00' }).endTime, '15:00');
  const 비움 = 기본();                                                            /* 끝을 비워 두면 따라갈 것이 없다 */
  assert.strictEqual(읽기(비움, { time: '13:00', endTime: '' }).endTime, '');
  const 직접 = Object.assign(기본(), { time: '09:00', endTime: '11:00' });
  assert.strictEqual(읽기(직접, { time: '09:00', endTime: '18:00' }).endTime, '18:00', '끝을 직접 고친 것을 덮었다');
  const 밤 = Object.assign(기본(), { time: '09:00', endTime: '11:00' });
  assert.strictEqual(읽기(밤, { time: '23:00', endTime: '11:00' }).endTime, '23:59', '밤을 넘기지 않는다');
});

test('⑥ 끝나는 날은 구글·우리 표·서버 대신 넣기까지 간다', () => {
  assert.match(함수몸('function 구글에넣기(m){'), /endDate: String\(m\.endDate\|\|""\)/);
  assert.match(함수몸('function doSave(){'), /item\.endDate = 여러날 \? m\.endDate : ""/);
  assert.match(함수몸('function 개인에넣기(m){'), /endDate:\(m\.endDate && m\.endDate > m\.date\)/);
  const ev = P.eventOf({ id: 's1', sid: 'P-005', date: '2026-10-12', endDate: '2026-10-14', time: '', title: '출장 사흘' }, 's1', () => '박한별');
  assert.strictEqual(ev.endDate, '2026-10-14');
  assert.deepStrictEqual(P.bodyOf(ev).end, { date: '2026-10-15' }, '종일 사흘은 끝 다음 날(끝 안 듦)');
  assert.strictEqual(P.eventOf({ id: 's2', date: '2026-10-12', title: 't' }, 's2').endDate, '', '끝나는 날 없으면 하루짜리');
});

test('날짜·시간을 고르면 다시 그려 글자를 맞춘다 · 저장 단추 색은 구글 파랑', () => {
  assert.match(캘린더, /f !== 'date' && f !== 'endDate' && f !== 'time' && f !== 'endTime'\) return;\s+modalRead\(\); render\(\);/);
  assert.match(캘린더, /\.gform \.gsave\{[^}]*background:var\(--gtoday\)/, '저장 단추가 구글 파랑이 아닙니다');
});
