/* 푸른 캘린더가 «이알피와 같은 자료»를 본다
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-18: 「이미 퇴사자는 정리해라 … 데이터도 가지고 오고
   구글 캘린더 연결된것도 모두 가지고 와라」

   ★ 무엇이 있었나 — 배포된 화면이 «텅 비어» 보였다.
     ① 사람 칩이 서른셋 나왔다. 명부 32명 가운데 현직은 열뿐인데 그만둔 스물둘이 섞였다.
     ② 달력이 거의 비었다. 이알피 달력을 채우는 것은 «구글 캘린더»(그 달 126건)인데
        우리는 그것을 아예 안 읽고 있었다. 우리 서버의 일정(my_schedules)에는
        2026-06 에 멈춘 25건뿐이다.

   ★ 무엇을 지키나
     ① 칩·고르는 목록은 «현직만» (이알피 getActiveUsers 와 같은 기준: status === 'active')
     ② 이름은 «그만둔 사람까지» 찾는다 — 지나간 근무에 사번만 뜨면 못 읽는다
     ③ 구글 달력 주소·열쇠가 이알피와 «같다» — 다르면 다른 달력을 본다
     ④ 구글 일정의 색 고르는 차례가 이알피와 같다
     ⑤ 못 받았으면 «조용히 비우지» 않는다 — 빈 달력은 「일정이 없다」는 거짓말이다

   ⚠ 이 검사는 규칙을 본다. 색값·글자 크기는 안 본다(다듬어도 안 깨지게). */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 주석걷기 } = require('./helpers/strip-comments.js');

const ROOT = path.join(__dirname, '..');
const 이알피 = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const 캘린더원문 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
const 캘린더 = 주석걷기(캘린더원문);

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

/* pu-cal.html 의 명부 함수를 떼어 와 실제로 돌린다 */
function 명부(자료) {
  const 상자 = { D: { user_accounts: 자료 }, Object, Array, String };
  vm.createContext(상자);
  vm.runInContext(함수몸(캘린더원문, 'function allUsers(){') + '\n'
    + 함수몸(캘린더원문, 'function users(){') + '\n'
    + 'var __act = users(); var __all = allUsers();', 상자);
  return { 현직: JSON.parse(JSON.stringify(상자.__act)), 전부: JSON.parse(JSON.stringify(상자.__all)) };
}

// ── ① 퇴사자 정리 ─────────────────────────────────────────────────────
test('칩·고르는 목록은 «현직만» — 그만둔 사람이 섞이면 안 된다', () => {
  const r = 명부([
    { sid: 'P-001', name: '홍길동', status: 'active' },
    { sid: 'P-002', name: '김퇴사', status: 'retired' },
    { sid: 'P-003', name: '이휴직', status: 'leave' },
    { sid: 'P-004', name: '박미상' }                       // status 가 아예 없는 줄
  ]);
  assert.deepStrictEqual(r.현직.map((u) => u.name), ['홍길동'],
    '현직이 아닌 사람이 목록에 들어 있습니다');
  assert.strictEqual(r.전부.length, 4, '전부 목록에서 사람이 사라졌습니다');
});

test('이알피와 같은 기준이다 — status === "active"', () => {
  const 몸 = 함수몸(캘린더원문, 'function users(){');
  assert.match(몸, /status\s*===\s*["']active["']/, '이알피(getActiveUsers)와 다른 기준을 씁니다');
  assert.match(이알피, /status===['"]active['"]/, '이알피 쪽 기준을 못 찾았습니다');
});

test('이름은 «그만둔 사람까지» 찾는다 — 지나간 근무에 사번만 뜨면 못 읽는다', () => {
  const 몸 = 함수몸(캘린더원문, 'function userOf(sid){');
  assert.match(몸, /allUsers\(\)/,
    'userOf 가 현직만 뒤집니다 — 그만둔 사람의 지나간 이음 근무가 사번으로 뜹니다');
});

// ── ③ 구글 달력 ───────────────────────────────────────────────────────
test('구글 달력 주소·열쇠가 이알피와 같다 — 다르면 다른 달력을 본다', () => {
  const 뽑기 = (src, 이름) => {
    const m = src.match(new RegExp(이름 + "\\s*=\\s*'([^']+)'"));
    assert.ok(m, 이름 + ' 을 못 찾았습니다');
    return m[1];
  };
  const 뽑기2 = (src, 이름) => {
    const m = src.match(new RegExp(이름 + '\\s*=\\s*"([^"]+)"'));
    assert.ok(m, 이름 + ' 을 못 찾았습니다');
    return m[1];
  };
  assert.strictEqual(뽑기2(캘린더, 'GCAL_CAL_ID'), 뽑기(이알피, 'GCAL_CAL_ID'),
    '두 앱이 서로 «다른 달력»을 봅니다');
  assert.ok(뽑기2(캘린더, 'GCAL_API_KEY').length > 20, '구글 열쇠가 없습니다');
});

test('구글에서 받아 오는 조건이 이알피와 같다', () => {
  const 몸 = 함수몸(캘린더원문, 'function gcalLoad(force){');
  ['singleEvents=true', 'orderBy=startTime', 'maxResults=500', 'timeMin=', 'timeMax=']
    .forEach((x) => assert.ok(몸.indexOf(x) >= 0, '받아 오는 조건에 ' + x + ' 가 없습니다'));
  assert.ok(이알피.indexOf('singleEvents=true&orderBy=startTime&maxResults=500') >= 0,
    '이알피 쪽 조건을 못 찾았습니다');
});

test('보는 달의 «42칸» 어치를 받는다 — 앞뒤 달에 걸친 줄도 채워야 한다', () => {
  const 몸 = 함수몸(캘린더원문, 'function gcalLoad(force){');
  assert.match(몸, /monthGrid\(/, '그 달의 칸을 안 보고 있습니다');
  assert.match(몸, /shiftDay\([^)]*,\s*1\)/, '마지막 날 다음날까지 안 받습니다(그날이 통째로 빕니다)');
});

// ── ④ 색 고르는 차례 ──────────────────────────────────────────────────
function 구글칩(ev, 자료) {
  자료 = 자료 || {};
  const 상자 = {
    D: { user_accounts: 자료.명부 || [], staff_colors: 자료.색 || {}, gcal_mail_sid: 자료.메일표 || {} },
    window: { _gcalColors: 자료.구글색표 || {} },
    Object, Array, String, JSON, Math, parseInt
  };
  vm.createContext(상자);
  vm.runInContext([
    함수몸(캘린더원문, 'function allUsers(){'),
    함수몸(캘린더원문, 'function users(){'),
    함수몸(캘린더원문, 'function userOf(sid){'),
    함수몸(캘린더원문, 'function colorOf(sid){'),
    함수몸(캘린더원문, 'function gcalMailKey(m){'),
    함수몸(캘린더원문, 'function gcalMailMap(){'),
    함수몸(캘린더원문, 'function gcalSidByMail(mail){'),
    함수몸(캘린더원문, 'function gcalPalette(){'),
    함수몸(캘린더원문, 'function gcalMailColor(mail){'),
    함수몸(캘린더원문, 'function gcalToEvent(ev){'),
    'var __r = gcalToEvent(' + JSON.stringify(ev) + ');'
  ].join('\n'), 상자);
  return JSON.parse(JSON.stringify(상자.__r));
}

test('색 ① — 구글에서 «고른» 색이 가장 먼저다 (그래야 구글 화면과 같다)', () => {
  const c = 구글칩(
    { id: 'g1', summary: '홍길동 상담', colorId: '5', start: { dateTime: '2026-09-11T14:00:00+09:00' } },
    { 구글색표: { 5: '#fbd75b' }, 명부: [{ sid: 'P-001', name: '홍길동', status: 'active' }], 색: { 'P-001': '#16a34a' } });
  assert.strictEqual(c.color, '#fbd75b', '구글에서 고른 색을 앱 색으로 덮었습니다');
});

test('색 ② — 이어 준 메일이 있으면 «그 직원 색»', () => {
  const c = 구글칩(
    { id: 'g2', summary: '상담', start: { dateTime: '2026-09-11T14:00:00+09:00' }, creator: { email: 'a.b@gmail.com' } },
    { 메일표: { 'a,b@gmail,com': 'P-001' }, 명부: [{ sid: 'P-001', name: '홍길동', status: 'active' }], 색: { 'P-001': '#16a34a' } });
  assert.strictEqual(c.sid, 'P-001', '이어 준 사람을 못 찾았습니다');
  assert.strictEqual(c.color, '#16a34a');
});

test('색 ③ — 제목에 현직 이름이 있으면 그 직원. 다만 만든이가 이미 찾아졌으면 안 덮는다', () => {
  const 같이 = { 명부: [{ sid: 'P-002', name: '김노무', status: 'active' }], 색: { 'P-002': '#dc2626', 'P-001': '#16a34a' } };
  const a = 구글칩({ id: 'g3', summary: '김노무 연차', start: { date: '2026-09-11' } }, 같이);
  assert.strictEqual(a.sid, 'P-002', '제목의 이름으로 사람을 못 찾았습니다');
  const b = 구글칩({ id: 'g4', summary: '김노무 연차', start: { date: '2026-09-11' }, creator: { email: 'x@y.com' } },
    Object.assign({ 메일표: { 'x@y,com': 'P-001' } }, 같이));
  assert.strictEqual(b.sid, 'P-001',
    '만든이가 이미 찾아졌는데 제목의 이름으로 덮었습니다 — 「권형하에게 보고」는 남의 이름일 수 있습니다');
});

test('메일을 열쇠로 바꾸는 셈이 이알피와 같다 — 다르면 이어 둔 사람이 안 찾아진다', () => {
  const 몸 = 함수몸(캘린더원문, 'function gcalMailKey(m){');
  const 이알피몸 = 함수몸(이알피, 'function gcalMailKey(m){');
  /* ⚠ 따옴표 «모양»(' vs ")까지 박지 않는다 — 그것은 셈이 아니라 글씨체다.
     지키는 것은 «같은 것을 같게 바꾸는가»이므로, 실제로 돌려 맞대는 것이 가장 확실하다. */
  const 씻기 = (x) => x.replace(/\s+/g, '').replace(/['"]/g, '"')
    .replace(/^function.*?\{/, '').replace(/\}$/, '');
  assert.strictEqual(씻기(몸), 씻기(이알피몸), '메일 → 열쇠 셈이 두 앱에서 다릅니다');
  /* 그리고 실제로 돌려서도 같은지 본다 — 글자가 같아도 결과가 다르면 소용없다 */
  const 돌리기 = (src) => {
    const 상자 = { String, out: null };
    vm.createContext(상자);
    vm.runInContext(함수몸(src, 'function gcalMailKey(m){')
      + '\nout = ["A.B@Gmail.COM", " x#y[z]/w ", ""].map(gcalMailKey);', 상자);
    return JSON.parse(JSON.stringify(상자.out));
  };
  assert.deepStrictEqual(돌리기(캘린더원문), 돌리기(이알피),
    '글자는 같은데 돌려 보니 결과가 다릅니다');
});

test('종일 일정은 시각을 안 적고, 00:00 도 안 적는다 (이알피와 같다)', () => {
  const a = 구글칩({ id: 'g5', summary: '연차', start: { date: '2026-09-11' } });
  assert.strictEqual(a.time, '', '종일 일정에 시각이 붙었습니다');
  const b = 구글칩({ id: 'g6', summary: '0930 일터', start: { dateTime: '2026-09-11T00:00:00+09:00' } });
  assert.strictEqual(b.time, '', '00:00 을 시각으로 적었습니다');
  const c = 구글칩({ id: 'g7', summary: '상담', start: { dateTime: '2026-09-11T14:30:00+09:00' } });
  assert.strictEqual(c.time, '1430', '시각을 이알피처럼 「1430」 꼴로 안 적습니다');
});

// ── ⑤ 못 받았을 때 ────────────────────────────────────────────────────
test('구글을 못 받으면 «조용히 비우지» 않는다 — 빈 달력은 거짓말이다', () => {
  const 몸 = 함수몸(캘린더원문, 'function gcalLoad(force){');
  /* ⚠ 그냥 「GCAL.err 이 어딘가 있나」로 보면 이빨이 없다 — 첫머리의 GCAL.err = "" 가
     통과시킨다(2026-09-18 에 실제로 그래서 못 잡았다). «실패를 받는 자리»만 떼어 본다. */
  const i = 몸.lastIndexOf('.catch(');
  assert.ok(i >= 0, '못 받았을 때를 받는 자리가 없습니다');
  const 실패자리 = 몸.slice(i);
  assert.match(실패자리, /GCAL\.err\s*=\s*\(?\s*e/,
    '못 받았는데 까닭을 안 남깁니다 — 화면이 조용히 비어 보입니다');
  assert.match(캘린더, /구글 못 받음/, '화면에 못 받았다고 안 적습니다');
  assert.match(캘린더, /data-gcalretry/, '다시 받아 볼 길이 없습니다');
});

test('구글 일정은 «구글에서» 고친다 — 우리가 손대면 두 곳이 갈린다', () => {
  assert.match(캘린더, /openGcal/, '구글 일정을 눌렀을 때 갈 곳이 없습니다');
  const 몸 = 함수몸(캘린더원문, 'function openGcal(id){');
  assert.match(몸, /gcalUrl/, '구글 달력 주소로 안 보냅니다');
});

test('이음 보기에는 구글을 안 섞는다 — 거기는 이음 근무만 보는 자리다', () => {
  const 몸 = 함수몸(캘린더원문, 'function eventsOn(ymd, eumOnly){');
  /* 섞는 자리를 떼어 와 «그 조건에 !eumOnly 가 들어 있나»를 본다.
     ⚠ 조건 전체를 글자로 박지 않는다 — 조건이 늘어도(거르개 규칙 등) 안 깨지게. */
  const i = 몸.indexOf('GCAL.evs');
  assert.ok(i >= 0, '구글 일정을 아예 안 섞습니다');
  const 조건 = 몸.slice(Math.max(0, i - 320), i);
  const j = 조건.lastIndexOf('if(');
  assert.ok(j >= 0, '구글을 섞는 조건문이 없습니다');
  assert.match(조건.slice(j), /!eumOnly/,
    '이음 보기에도 구글 일정이 섞입니다');
});

test('구글을 섞는 «때»가 이알피와 같다 — 전체·구글 거르개일 때만', () => {
  /* 이알피: if(calFilter === null || calFilter === 'gcal') { gcalEvList.forEach(push) }
     ⚠ 사람을 고른 채로 구글까지 섞으면 칩의 「겹친 날」 숫자가 두 앱에서 달라진다. */
  const 몸 = 함수몸(캘린더원문, 'function eventsOn(ymd, eumOnly){');
  assert.match(몸, /S\.filter\s*===\s*null\s*\|\|\s*S\.filter\s*===\s*["']gcal["']/,
    '구글을 섞는 때가 이알피와 다릅니다');
  assert.match(이알피, /calFilter === null \|\| calFilter === 'gcal'/,
    '이알피 쪽 규칙을 못 찾았습니다');
});
