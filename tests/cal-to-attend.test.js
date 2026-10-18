'use strict';
/* 캘린더 휴가·재택 → 근태 (2026-10-17 대표 「캘린더에 넣었던것 인사관리에 자동으로 … 재택근무도 … 신청한것 모두」)
   결정: 워라밸·리프레시는 연차에서 안 뺌(특별휴가) · 앞날짜도 «예정»으로 넣음 · 확실한 줄(제목 이름 = 올린 계정)만 저절로
   실행: node --test tests/cal-to-attend.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
const ctx = { Math, Number, String, Date, Array, Object, JSON };
vm.createContext(ctx);
vm.runInContext(['gcalAttClassify', 'gcalAttDays', 'gcalAttPlan'].map(fnSrc).join('\n') + '\nthis.C = gcalAttClassify; this.D = gcalAttDays; this.P = gcalAttPlan;', ctx);
const J = v => JSON.stringify(v);
const ev = (id, summary, st, en, mail, allDay) => ({ id, summary, creator: { email: mail || '' },
  start: allDay === false ? { dateTime: st + 'T09:00:00+09:00' } : { date: st }, end: allDay === false ? { dateTime: (en || st) + 'T18:00:00+09:00' } : { date: en } });

test('제목 → 근태 종류: 연차·오전/오후 반차·재택(오전/오후)·회사 휴가·공가 · 휴가가 아닌 일정은 뺀다', () => {
  assert.equal(ctx.C('홍길동 연차').type, 'leave');
  assert.equal(ctx.C('홍길동 오후반차').type, 'halfday-pm');
  assert.equal(ctx.C('홍길동 오전 반차').type, 'halfday-am');
  assert.equal(ctx.C('홍길동 반차').unsure, true, '오전/오후를 모르면 사람 확인');
  assert.equal(J(ctx.C('홍길동 오전 재택근무')), J({ type: 'telework', period: 'am', label: '재택(오전)' }));
  assert.equal(ctx.C('홍길동 재택').period, 'full');
  assert.equal(ctx.C('홍길동 워라밸 휴가').type, 'special-leave', '워라밸은 연차에서 안 뺀다(대표 결정)');
  assert.equal(ctx.C('홍길동 리프레시 휴가').type, 'special-leave');
  assert.equal(ctx.C('홍길동 예비군 동원훈련').type, 'public');
  assert.equal(ctx.C('홍길동 예비군 교육').type, 'public', '«교육»에 걸려 빠지면 안 된다');
  assert.equal(ctx.C('0900 가나다 아산(출산육아우수기업심사)'), null);
  assert.equal(ctx.C('홍길동 연차강의- 이음센터 연계'), null);
  assert.equal(ctx.C('홍길동 육아휴직'), null, '휴직은 휴직 기록이 맡는다');
  assert.equal(ctx.C('1500 대한칼소닉 강의'), null);
});

test('날짜 펼치기 — 종일 일정의 끝날(다음 날)은 빼고, 주말·공휴일은 뺀다', () => {
  assert.equal(J(ctx.D(ev('a', 'x', '2026-01-12', '2026-01-17'), {})), J(['2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15', '2026-01-16']));
  assert.equal(J(ctx.D(ev('b', 'x', '2026-10-02', '2026-10-06'), { '2026-10-05': 1 })), J(['2026-10-02']), '토·일·대체공휴일 빼기');
  assert.equal(J(ctx.D(ev('c', 'x', '2026-10-14', '2026-10-14', '', false), {})), J(['2026-10-14']), '시각 일정은 그날 하루');
});

test('★ 확실 = 제목 이름과 올린 계정이 같은 사람 · 아니면 사람 확인 · 이미 있는 날·마감 달은 건너뜀 · 앞날짜는 예정', () => {
  const users = [{ sid: 'A', name: '홍길동' }, { sid: 'B', name: '이영희' }];
  const mail = { 'a@x,kr': 'A', 'b@x,kr': 'B' };
  const evs = [ev('e1', '홍길동 연차', '2026-10-14', '2026-10-15', 'a@x.kr'),
    ev('e2', '이영희 오후반차', '2026-10-13', '2026-10-14', 'a@x.kr'),          // 올린 사람이 다름
    ev('e3', '연차-최', '2026-10-12', '2026-10-13', 'b@x.kr'),                 // 이름 없음
    ev('e4', '홍길동 연차', '2026-10-20', '2026-10-21', 'a@x.kr'),             // 예정
    ev('e5', '이영희 연차', '2026-09-01', '2026-09-02', 'b@x.kr'),             // 근태에 이미 있음
    ev('e6', '이영희 재택', '2026-03-03', '2026-03-04', 'b@x.kr')];            // 마감된 달
  const existing = [{ id: 'att-1', sid: 'B', date: '2026-09-01', type: 'leave' },
    { id: 'gc-old-20260101', sid: 'A', date: '2026-01-01', type: 'leave', sourceKind: 'gcal', sourceId: 'old' }];
  const p = ctx.P(evs, users, mail, existing, {}, '2026-10-17', d => d.slice(0, 7) === '2026-03');
  assert.equal(J(p.sure.map(x => [x.sid, x.date, x.type, x.planned])), J([['A', '2026-10-14', 'leave', false], ['A', '2026-10-20', 'leave', true]]));
  assert.equal(J(p.ask.map(x => x.why).sort()), J(['올린 사람이 다름', '제목에 이름 없음']));
  assert.equal(p.ask.find(x => x.title === '연차-최').sid, 'B', '이름이 없으면 올린 사람을 «제안»만');
  assert.equal(p.dup.length, 1); assert.equal(p.locked.length, 1);
  assert.equal(p.gone.length, 1, '캘린더에서 사라진 일정은 알린다(지우지는 않는다)');
  assert.ok(p.sure.every(x => /^gc-e\d-\d{8}$/.test(x.id)), '일정 번호+날짜로 열쇠를 만들어 두 번 들어가지 않는다');
});

test('근태관리 위에 캘린더 연동 띠가 붙고, 확실한 줄만 저절로 넣는다', () => {
  assert.match(SRC, /h\(GcalAttSync, null\),/);
  assert.match(SRC, /if\(canWrite && p\.sure\.length\)\{/);
  assert.match(SRC, /sourceKind:'gcal', sourceId:item\.evId/);
});

test('달력 읽기는 공용 모듈(listEvents) — 쪽을 넘겨 다 받고, 오류는 거절로', async () => {
  const G = require(path.join(__dirname, '..', 'js', 'pu-gcal-auth.js'));
  const pages = [{ items: [{ id: 'a' }], nextPageToken: 'p2' }, { items: [{ id: 'b' }] }];
  let n = 0;
  const fakeFetch = (u) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(pages[n++]) });
  const all = await G.listEvents('cal@x', 'KEY', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', { fetch: fakeFetch });
  assert.equal(JSON.stringify(all.map(x => x.id)), JSON.stringify(['a', 'b']));
  await assert.rejects(G.listEvents('c', 'k', 'a', 'b', { fetch: () => Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ error: { message: '막힘' } }) }) }), /막힘/);
  assert.match(SRC, /PuGcalAuth\.listEvents\(GCAL_ATT_CAL_ID, GCAL_ATT_KEY,/);
});
