/* 구글 «늘 연결» — 화면 쪽(js/pu-gcal-auth.js · pu-cal.html) 약속
   대표 지시 2026-10-04 「항상 구글로 로그인되어 있어야 한다 그래야 혼란이 없다」 · 「제안대로 해라」.

   지키는 것
     ① 서버 함수가 아직 없으면(배포 전) «꺼짐» — 직원 모두에게 «연결하세요» 헛 창을 띄우지 않는다
     ② 진짜 고장은 «꺼짐»으로 감추지 않는다(거절)
     ③ 표는 창 메모리에만 — 저장소(localStorage 등)에 넣지 않는다
     ④ 끝나기 전에 다시 받는다(keepAlive) — 켜 둔 채 하루를 보내도 안 풀린다
     ⑤ 구글에서 돌아온 주소의 번호는 «우리 것(gl.)»만 꺼내고 주소를 지운다 · 취소도 알아듣는다
     ⑥ 상세 창 — 참석자·회의·첨부·반복·알림을 사람 말로, 빈 칸은 줄 없이, 링크는 https 만
     ⑦ 연결 창은 «연결 안 됨»일 때만 — 꺼짐·퇴사·닫음·다른 창이 떠 있을 때는 안 뜬다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const AUTH_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-gcal-auth.js'), 'utf8');
const CAL = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

/* 모듈을 매번 새로 — 창(window) 자리에 빈 상자를 준다 */
function 새모듈() {
  const win = {};
  const box = { window: win, globalThis: win, URLSearchParams, setTimeout: (f, ms) => { box.걸린.push(ms); return 1; },
    clearTimeout() {}, Date, Promise, JSON, Math, Number, String, Error, Object, Array, console, 걸린: [] };
  box.module = { exports: {} };
  vm.createContext(box);
  vm.runInContext(AUTH_SRC, box);
  return { A: box.module.exports, win, box };
}
function 가짜fetch(답) {
  return async (url, opts) => {
    const 이름 = String(url).split('/').pop();
    const a = 답[이름];
    if (a === 'net') throw new TypeError('Failed to fetch');
    if (!a) return { status: 404, ok: false, json: async () => ({}) };
    return { status: a.status || 200, ok: (a.status || 200) < 400, json: async () => a.body };
  };
}

test('①★ 서버 함수가 없으면(404·그물 끊김) «꺼짐» — 연결 창을 띄우지 않는다', async () => {
  const { A } = 새모듈();
  assert.equal((await A.fromServer('ID', { fetch: 가짜fetch({}) })).off, true);
  assert.equal((await A.fromServer('ID', { fetch: 가짜fetch({ gcalToken: 'net' }) })).off, true);
  /* 올렸지만 공개 호출 권한을 아직 안 켠 때 — 구글이 HTML 403 을 준다 */
  const 권한전 = async () => ({ status: 403, ok: false, json: async () => { throw new SyntaxError('html'); } });
  assert.equal((await A.fromServer('ID', { fetch: 권한전 })).off, true, '★ 권한 켜기 전 403 에 «고장» 표시가 뜹니다');
});

test('② 진짜 고장(500)은 감추지 않는다 · «연결 안 됨»은 need', async () => {
  const { A } = 새모듈();
  await assert.rejects(A.fromServer('ID', { fetch: 가짜fetch({ gcalToken: { status: 500, body: { ok: false, error: '비밀값 없음' } } }) }), /비밀값/);
  const r = await A.fromServer('ID', { fetch: 가짜fetch({ gcalToken: { body: { ok: false, need: 'link', why: 'revoked' } } }) });
  assert.equal(r.need, 'link');
  assert.equal(r.why, 'revoked');
});

test('③ 받은 표는 창 메모리에만 — 저장소에 안 넣는다', async () => {
  const { A, win } = 새모듈();
  const r = await A.fromServer('ID', { fetch: 가짜fetch({ gcalToken: { body: { ok: true, access_token: 'AT', expires_at: Date.now() + 3600e3, email: 'hong@gmail.com' } } }) });
  assert.equal(r.ok, true);
  assert.equal(A.hasToken(), true);
  assert.equal(win._gcalToken, 'AT');
  assert.equal(A.email(), 'hong@gmail.com');
  const 맨몸 = AUTH_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(맨몸), '★ 구글 표를 저장소에 넣습니다 — 남의 PC 에 남습니다');
});

test('④ 끝나기 전에 다시 받는다 — 타이머가 만료 «앞»에 걸린다', async () => {
  const { A, box } = 새모듈();
  await A.fromServer('ID', { fetch: 가짜fetch({ gcalToken: { body: { ok: true, access_token: 'AT', expires_at: Date.now() + 3600e3 } } }) });
  A.keepAlive(() => Promise.resolve('ID'), () => {});
  assert.equal(box.걸린.length, 1, '다시 받는 타이머를 안 걸었습니다 — 한 시간 뒤 풀립니다');
  assert.ok(box.걸린[0] < 3600e3 && box.걸린[0] > 30e3, '타이머가 만료 앞에 걸려야 합니다: ' + box.걸린[0]);
});

test('⑤ 돌아온 주소 — 우리 번호만 꺼내고 주소를 지운다 · 취소도 알아듣는다', () => {
  const { A } = 새모듈();
  let 지움 = '';
  const hist = { replaceState: (a, b, p) => { 지움 = p; } };
  const r = A.captureCode({ search: '?code=C1&state=gl.123.x.y.z', pathname: '/pureunall/pu-cal.html' }, hist);
  assert.equal(r.code, 'C1');
  assert.equal(지움, '/pureunall/pu-cal.html', '★ 번호가 주소창·방문기록에 남습니다');
  assert.equal(A.captureCode({ search: '?code=K1&state=login.1.a.b', pathname: '/x' }, hist), null, '★ 남(카카오 등)의 번호를 가져갔습니다');
  const 취소 = A.captureCode({ search: '?error=access_denied&state=gl.1.a.b.c', pathname: '/x' }, hist);
  assert.ok(취소 && 취소.error, '동의 화면에서 취소한 것을 못 알아듣습니다');
});

test('⑤-2 연결 주소는 구글 로그인 주소만 따라간다', async () => {
  const { A } = 새모듈();
  const loc = { href: '' };
  await A.linkStart('ID', { location: loc, fetch: 가짜fetch({ gcalAuthUrl: { body: { ok: true, url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' } } }) });
  assert.match(loc.href, /^https:\/\/accounts\.google\.com\//);
  const loc2 = { href: '' };
  await assert.rejects(A.linkStart('ID', { location: loc2, fetch: 가짜fetch({ gcalAuthUrl: { body: { ok: true, url: 'https://evil.example/' } } }) }));
  assert.equal(loc2.href, '', '★ 엉뚱한 주소로 보냈습니다');
});

/* ── pu-cal.html — 상세 창 줄 ── */
function 함수몸(head) {
  const i = CAL.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = CAL.indexOf('{', i); k < CAL.length; k++) {
    if (CAL[k] === '{') d++;
    else if (CAL[k] === '}') { d--; if (d === 0) return CAL.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}
function 상자() {
  const box = {};
  vm.createContext(box);
  ['function 구글더줄(ev, 반복){', 'function 반복글(규칙){', 'function 알림글(r){'].forEach((h) => vm.runInContext(함수몸(h), box));
  return box;
}

test('⑥ 참석자 — 회신을 표시로 · 회의실은 따로', () => {
  const b = 상자();
  const 줄 = b.구글더줄({ attendees: [
    { email: 'hong@gmail.com', displayName: '홍길동', organizer: true, responseStatus: 'accepted' },
    { email: 'kim@gmail.com', responseStatus: 'declined' },
    { email: 'lee@gmail.com', responseStatus: 'needsAction', optional: true },
    { email: 'room@resource', displayName: '3층 회의실', resource: true, responseStatus: 'accepted' }] }, []);
  const 사람 = 줄.find((r) => r.i === '👥');
  assert.ok(사람, '참석자 줄이 없습니다');
  assert.match(사람.t, /3명/, '회의실을 사람으로 셌습니다');
  assert.match(사람.t, /홍길동\(주최\) ✔/);
  assert.match(사람.t, /kim@gmail\.com ✕/);
  assert.ok(줄.some((r) => r.i === '🏢' && /3층 회의실/.test(r.t)), '회의실 줄이 없습니다');
});

test('⑥-2 회의·첨부 링크는 https 만 · 첨부는 다섯까지', () => {
  const b = 상자();
  const 줄 = b.구글더줄({ hangoutLink: 'https://meet.google.com/abc-defg-hij',
    attachments: [{ title: 'a.pdf', fileUrl: 'https://drive.google.com/1' }, { title: 'b.pdf', fileUrl: 'javascript:alert(1)' },
      { title: 'c' }, { title: 'd' }, { title: 'e' }, { title: 'f' }, { title: 'g' }] }, []);
  const 회의 = 줄.find((r) => r.i === '🎥');
  assert.equal(회의.href, 'https://meet.google.com/abc-defg-hij');
  const 첨부 = 줄.filter((r) => r.i === '📎');
  assert.equal(첨부[0].href, 'https://drive.google.com/1');
  assert.equal(첨부[1].href, '', '★ https 가 아닌 링크를 걸었습니다');
  assert.ok(첨부.length <= 6 && /더/.test(첨부[첨부.length - 1].t), '첨부가 너무 많으면 «N개 더»로 접어야 합니다');
  const 없음 = b.구글더줄({ hangoutLink: 'http://plain.example' }, []);
  assert.ok(!없음.some((r) => r.i === '🎥'), '★ https 가 아닌 회의 링크를 걸었습니다');
});

test('⑥-3 반복·알림을 사람 말로 · 빈 일정은 줄 없음', () => {
  const b = 상자();
  assert.match(b.반복글('RRULE:FREQ=MONTHLY;BYDAY=1WE'), /매월 첫째 수요일/);
  assert.match(b.반복글('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE'), /2주마다 월·수요일/);
  assert.match(b.반복글('RRULE:FREQ=DAILY;COUNT=5'), /매일.*5번/);
  assert.match(b.반복글('RRULE:FREQ=WEEKLY;UNTIL=20261231T000000Z'), /2026-12-31까지/);
  assert.match(b.반복글('RRULE:FREQ=SECONDLY'), /SECONDLY/, '모르는 꼴은 원문을 보여야 합니다(틀린 말보다 낫다)');
  assert.match(b.알림글({ useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 30 }] }), /30분 전 · 하루 전\(메일\)/);
  assert.match(b.알림글({ useDefault: true }), /기본값/);
  assert.equal(b.구글더줄({}, []).length, 0, '★ 빈 일정에 빈 줄을 만들었습니다');
});

test('⑥-4 상세 창은 https 링크만 «누를 수 있게» 그린다', () => {
  const fn = 함수몸('function detailHtml(){');
  assert.match(fn, /\/\^https:\\\/\\\/\/i\.test\(r\.href/, '링크를 https 로 거르지 않습니다');
  assert.match(fn, /rel="noopener"/);
});

test('⑦ 연결 창 — «연결 안 됨»일 때만 뜬다', () => {
  const box = { S: {}, GLINK: {}, esc: (v) => String(v) };
  vm.createContext(box);
  vm.runInContext(함수몸('function 구글연결창Html(){'), box);
  box.GLINK = { st: 'need', why: 'none' };
  assert.ok(box.구글연결창Html().length > 0, '연결 안 된 사람에게 창이 안 뜹니다');
  box.GLINK = { st: 'off' };
  assert.equal(box.구글연결창Html(), '', '★ 서버 기능이 없는데(배포 전) 연결 창이 뜹니다');
  box.GLINK = { st: 'need', why: 'inactive' };
  assert.equal(box.구글연결창Html(), '', '퇴사·휴직자에게 연결 창이 뜹니다 — 연결해도 서버가 거절합니다');
  box.GLINK = { st: 'need', why: 'none', closed: true };
  assert.equal(box.구글연결창Html(), '', '«나중에»를 눌렀는데 또 뜹니다');
  box.GLINK = { st: 'need', why: 'none' }; box.S = { detail: {} };
  assert.equal(box.구글연결창Html(), '', '다른 창 위에 겹쳐 뜹니다');
});

test('⑧ 화면이 열릴 때 연결을 불러오고 · 구글 일정을 누르면 나머지를 받는다', () => {
  const 시작 = 함수몸('function start(user){');
  assert.match(시작, /구글이어가기\(user\)/, '★ 화면이 열릴 때 서버에서 표를 안 받습니다 — 매번 로그인해야 합니다');
  assert.match(CAL, /openDetail\(구글상세\(_id\)\);\s*구글더받기\(_id\)/, '구글 일정 상세에 나머지(참석자 등)를 안 받습니다');
  assert.match(함수몸('function 구글이어가기(user){'), /keepAlive\(/, '★ 끝나기 전에 다시 받지 않습니다 — 한 시간 뒤 풀립니다');
});
