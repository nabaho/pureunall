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
const AUTH = require(path.join(ROOT, 'js', 'pu-gcal-auth.js'));

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

/* ── 일정 상세 창도 구글 «일정 팝업» 꼴 (2026-10-10) ── */
test('상세 창 — 위 아이콘 줄 · 선 아이콘 줄 · 「오후 2:00~오후 3:00」 · 아래 단추 줄 없음', () => {
  const 상세 = 함수몸('function detailHtml(){');
  assert.match(상세, /class="dtool"/, '위 아이콘 줄이 없습니다');
  for (const 속성 of ['data-gedit="1"', 'data-gdel="1"', 'data-dgo="1"', 'data-close="1"']) {
    assert.ok(상세.includes(속성), '아이콘 줄에 빠진 단추: ' + 속성);
  }
  assert.match(상세, /도구단추\('data-route="'/, '이날 동선 단추가 없습니다');
  assert.ok(!/class="mbtns"/.test(상세), '구글 팝업에는 아래 단추 줄이 없습니다');
  assert.match(상세, /시각글\(d\.time\)/, '시간이 구글 꼴(오후 2:00)이 아닙니다');
  assert.match(함수몸('function 행아이콘(그림){'), /선아이콘\(행그림\[그림\]\)/, '줄 앞 이모지를 선 아이콘으로 바꾸지 않습니다');
  for (const 이모지 of ['👤', '📍', '≡', '✉', '🕒', '⏱', '👥', '🔔', '🔁', '🎥', '📎']) {
    assert.ok(캘린더.includes('"' + 이모지 + '":"'), '행그림에 없는 이모지: ' + 이모지);
  }
});

/* ── 「반복 안 함」·「알림 추가」 줄 (구글 입력 화면, 2026-10-11) ── */
test('반복·알림 — 구글 몸(recurrence·reminders)이 화면과 서버에서 같다', () => {
  const 경우 = [
    { date: '2026-10-14', time: '14:00', endTime: '15:00', summary: '매주 회의', repeat: 'WEEKLY', remindMin: 30 },
    { date: '2026-10-14', time: '', summary: '종일 매년', repeat: 'YEARLY', remindMin: 0 },
    { date: '2026-10-14', time: '09:00', summary: '알림만', repeat: '', remindMin: 1440 },
    { date: '2026-10-14', time: '09:00', summary: '이상한 값', repeat: 'HOURLY; BYDAY=MO', remindMin: -5 },
  ];
  for (const e of 경우) assert.deepStrictEqual(P.bodyOf(e), AUTH.bodyOf(e), e.summary);
  const 첫 = P.bodyOf(경우[0]);
  assert.deepStrictEqual(첫.recurrence, ['RRULE:FREQ=WEEKLY']);
  assert.deepStrictEqual(첫.reminders, { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] });
  assert.ok(!('reminders' in P.bodyOf(경우[1])), '알림 0 은 보내지 않는다(구글 기본 알림을 따른다)');
  const 이상 = P.bodyOf(경우[3]);
  assert.ok(!('recurrence' in 이상) && !('reminders' in 이상), '허용 밖 값이 구글 규칙에 섞였다(주입)');
});

test('반복·알림 — 서버 대신 넣기가 우리 표의 값을 구글로 넘긴다', () => {
  const ev = P.eventOf({ id: 's1', sid: 'P-005', date: '2026-10-14', time: '10:00', title: '회의', repeat: 'MONTHLY', remindMin: 60 }, 's1', () => '박한별');
  assert.strictEqual(ev.repeat, 'MONTHLY'); assert.strictEqual(ev.remindMin, 60);
  assert.deepStrictEqual(P.bodyOf(ev).recurrence, ['RRULE:FREQ=MONTHLY']);
  const 없음 = P.eventOf({ id: 's2', date: '2026-10-14', title: 't', repeat: 'x', remindMin: 'a' }, 's2');
  assert.strictEqual(없음.repeat, ''); assert.strictEqual(없음.remindMin, 0);
});

test('반복·알림 — 줄은 «새 일정»에만 · 글자는 고른 날을 보여 준다 · 저장 길마다 넘긴다', () => {
  const b = 상자();
  vm.runInContext(함수몸('function 반복글(ymd){'), b);
  const 글 = vm.runInContext('반복글("2026-10-14")', b);          /* 2026-10-14 = 수요일 */
  assert.deepStrictEqual(JSON.parse(JSON.stringify(글)), { D: '매일', W: '매주 (수요일)', M: '매월 14일', Y: '매년 10월 14일' });
  assert.match(함수몸('function modalHtml(){'), /일정 && 새것 \? 반복알림줄\(m\)/, '반복·알림 줄이 새 일정에만 있어야 합니다');
  assert.match(함수몸('function 반복알림줄(m){'), /m\.timed \? '<div class="grow">/, '알림은 시간 일정에만');
  assert.match(함수몸('function 구글에넣기(m){'), /repeat: String\(m\.repeat\|\|""\), remindMin: m\.timed \? \(\+m\.remind \|\| 0\) : 0/);
  assert.match(함수몸('function doSave(){'), /item\.repeat = String\(m\.repeat\)/);
  assert.match(함수몸('function 개인에넣기(m){'), /repeat:\(m\.mode === "new" && m\.repeat\)/);
  assert.match(캘린더, /"vis","repeat","remind"(?:,"guests")?\]\.forEach/, '반복·알림 칸을 읽지 않습니다');
});

/* ── 「참석자 추가」·「Google Meet 화상 회의 추가」 줄 (구글 입력 화면, 2026-10-11) ── */
test('참석자·Meet — 구글 몸이 화면과 서버에서 같고, 허용 밖 값은 안 섞인다', () => {
  const 기본 = { date: '2026-10-14', time: '14:00', endTime: '15:00', summary: '회의' };
  const 경우 = [
    Object.assign({}, 기본, { attendees: ['A@B.com', 'c@d.co.kr'], meet: true, meetId: 'pu-abc' }),
    Object.assign({}, 기본, { attendees: [], meet: true, meetId: '' }),
    Object.assign({}, 기본, { attendees: ['not-an-email', 'a b@c.d', 'x@y', 'ok@ok.com', 7, null], meet: false, meetId: 'pu-x' }),
  ];
  for (const e of 경우) assert.deepStrictEqual(P.bodyOf(e), AUTH.bodyOf(e));
  const 첫 = P.bodyOf(경우[0]);
  assert.deepStrictEqual(첫.attendees, [{ email: 'a@b.com' }, { email: 'c@d.co.kr' }], '메일은 소문자로');
  assert.deepStrictEqual(첫.conferenceData, { createRequest: { requestId: 'pu-abc', conferenceSolutionKey: { type: 'hangoutsMeet' } } });
  assert.ok(!('conferenceData' in P.bodyOf(경우[1])), '번호(meetId) 없는 Meet 은 보내지 않는다');
  assert.deepStrictEqual(P.bodyOf(경우[2]).attendees, [{ email: 'ok@ok.com' }], '메일 꼴이 아닌 것이 섞였다');
  const 많음 = P.bodyOf(Object.assign({}, 기본, { attendees: Array.from({ length: 30 }, (_, i) => 'u' + i + '@x.com') }));
  assert.strictEqual(많음.attendees.length, 20, '스무 명까지');
});

test('참석자·Meet — 서버 대신 넣기: 우리 표의 값을 넘기고, Meet 을 구글이 거절하면 일정만', async () => {
  const ev = P.eventOf({ id: 's1', sid: 'P-005', date: '2026-10-14', time: '10:00', title: '회의', guests: ['a@b.com'], meet: true }, 's1', () => '박한별');
  assert.deepStrictEqual(ev.attendees, ['a@b.com']); assert.strictEqual(ev.meet, true); assert.strictEqual(ev.meetId, 'pu-s1');
  assert.deepStrictEqual(P.eventOf({ id: 's2', date: '2026-10-14', title: 't', guests: 'x', meet: 'yes' }, 's2').attendees, []);
  assert.strictEqual(P.eventOf({ id: 's2', date: '2026-10-14', title: 't', meet: 'yes' }, 's2').meet, false);
  /* 구글이 Meet 을 거절하는 경우는 tests/gcal-proxy.test.js «Meet 거절 대비» 가 서버를 돌려 본다 */
});

test('참석자·Meet — 화면: 줄은 새 일정에만 · 메일 검사 · 초대 메일 안 보냄을 말한다 · 클라이언트 Meet 실패 대비', () => {
  assert.match(함수몸('function modalHtml(){'), /반복알림줄\(m\) \+ 참석자줄\(m\)/);
  assert.match(함수몸('function 참석자줄(m){'), /초대 메일은 보내지 않습니다/, '초대 메일이 안 간다는 말이 없습니다');
  assert.match(함수몸('function doSave(){'), /참석자 메일이 올바르지 않습니다/, '틀린 메일을 막지 않습니다');
  assert.match(함수몸('function 구글에넣기(m){'), /attendees: 참석자목록\(m\.guests\)\.메일, meet: !!m\.meet, meetId:/);
  assert.match(함수몸('function doSave(){'), /item\.guests = 참석자목록\(m\.guests\)\.메일/);
  assert.match(함수몸('function doSave(){'), /item\.meet = true/);
  const 가 = fs.readFileSync(path.join(ROOT, 'js', 'pu-gcal-auth.js'), 'utf8');
  assert.match(가, /conferenceDataVersion=1/, 'Meet 을 만들려면 conferenceDataVersion 이 필요합니다');
  assert.match(가, /meet: false \}\), opt\)\.then\(function \(r\) \{ r\.meetFailed = true/, 'Meet 을 거절당했을 때 일정만 다시 넣지 않습니다');
  assert.match(fs.readFileSync(path.join(ROOT, 'functions', 'gcal-proxy.js'), 'utf8'), /Google Meet 을 구글이 거절해 일정만 넣었습니다/);
});

/* ── 글꼴은 구글 캘린더와 같은 차례 (2026-10-11) ── */
test('글꼴 — Roboto 가 한글보다 앞(숫자·영문은 구글 앱과 같게) · 불러오지도 않는 Pretendard 는 앞에 없다', () => {
  const 줄 = 캘린더.match(/\n\s*body\{margin:0;font-family:([^;]+);/);
  assert.ok(줄, 'body 글꼴 줄을 못 찾았습니다');
  const 차례 = 줄[1].split(',').map((x) => x.trim().replace(/['"]/g, ''));
  assert.ok(차례.indexOf('Roboto') >= 0 && 차례.indexOf('Noto Sans KR') > 차례.indexOf('Roboto'), 'Roboto → Noto Sans KR 차례가 아닙니다: ' + 차례.join(' > '));
  assert.ok(차례.indexOf('Malgun Gothic') > 차례.indexOf('Noto Sans KR'), '맑은 고딕이 Noto Sans KR 앞에 있습니다');
  assert.strictEqual(차례.indexOf('Pretendard'), -1, '불러오지 않는 Pretendard 가 다시 들어왔습니다');
  assert.strictEqual(차례[차례.length - 1], 'sans-serif');
});

/* ── 일정 칩은 구글 공식 화면 실측 크기 (2026-10-11) ── */
test('칩 크기 — 구글 실측(글자 12px · 굵기 500 · 줄 20px · 모서리 6px), 칩 사이 틈 2px(= 24px 간격)', () => {
  const 칩 = 캘린더.match(/\n\s*\.ev\{padding:([^;]+);border-radius:(\d+)px;font-size:(\d+)px;font-weight:(\d+);line-height:(\d+)px;/);
  assert.ok(칩, '.ev 규칙을 못 찾았습니다');
  assert.deepStrictEqual([칩[2], 칩[3], 칩[4], 칩[5]], ['6', '12', '500', '20'], '구글 실측(6px·12px·500·20px)과 다릅니다: ' + 칩.slice(1).join(' / '));
  assert.match(캘린더, /\.evs\{display:flex;flex-direction:column;gap:2px\}/, '칩 사이 틈이 2px 이 아닙니다');
  /* 폰 위젯 칩(캡처 실측)은 따로다 — 월 위젯 규칙이 그대로여야 한다 */
  assert.match(캘린더, /body\.mob \.ev\{font-size:9\.5px;line-height:12px;height:12px;padding:0 3px;border-radius:3px/);
});
