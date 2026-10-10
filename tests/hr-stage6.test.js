'use strict';
/* 인사관리 6단계 — 남은 일 (대표 지시 2026-10-10 「모두 다해라」)
   ① 근로계약서: 서면 명시 항목(근로기준법 제17조) · 단시간 근로일별 시간 · 기간제 2년(기간제법 제4조②) · 한 건씩 저장
   ② 근로자명부 저장: 사번 열쇠 지도(번호 = 사번) — 한 사람을 고쳐도 32명을 통째로 쓰던 것
   ③ 출퇴근 시각·휴게(제54조) — 시각으로 근로시간·야간 셈, 휴게 모자람 알림
   ④ 특별휴가 부여·사용 — 배우자 출산휴가 20일·120일·3회 분할(남녀고용평등법 제18조의2)
   ★ 법정 날수·시간은 그 자체가 법이라 박는다(검사고정-허용).
   실행: node --test tests/hr-stage6.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const CODE = stripJs(SRC);
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다 — 이름이 바뀌었다면 이 검사도 함께 고치십시오');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
function load(names, ctx){ vm.createContext(ctx); vm.runInContext(names.map(fnSrc).join('\n'), ctx); return ctx; }
const J = x => JSON.stringify(x);

test('① 근로계약서 — 서면 명시 항목이 비면 알린다, 단시간이면 근로일별 시간도', () => {
  const c = load(['ecMissing'], {});
  /* EC_REQUIRED 는 함수 바깥 표다 — 그 구간을 그대로 싣는다 */
  vm.runInContext(SRC.slice(SRC.indexOf('var EC_REQUIRED'), SRC.indexOf('function ecMissing(')), c);
  const full = { workPlace: '천안', jobDuty: '상담', workHours: '주 40시간', workDays: '월~금', payComposition: '기본급', payMethod: '월급제', payDay: '25일',
    holidays: '일요일', annualLeave: '법대로', deliveredDate: '2026-10-10' };
  assert.equal(c.ecMissing(full).length, 0);
  assert.ok(c.ecMissing(Object.assign({}, full, { payComposition: '' })).some(x => /임금 구성/.test(x)));
  assert.ok(c.ecMissing(Object.assign({}, full, { workHours: '주 20시간' })).some(x => /근로일별/.test(x)), '단시간 근로자의 근로일별 근로시간(기간제법 제17조)');
  assert.match(SRC.slice(SRC.indexOf('var EC_REQUIRED'), SRC.indexOf('var EC_REQUIRED') + 600), /deliveredDate/, '교부일이 필수 목록에 없습니다');
});

test('① 기간제 2년 — 갱신해 이어 붙인 기간을 합쳐 본다 (기간제법 제4조②)', () => {
  const c = load(['ecFixedTermSpan'], {});
  const a = { id: 'a', startDate: '2024-03-01', endDate: '2025-02-28' };
  const b = { id: 'b', startDate: '2025-03-01', endDate: '2026-03-31' };   // 이어짐 → 2024-03-01 부터 2년 넘음
  assert.equal(c.ecFixedTermSpan([a, b], b).over2y, true);
  assert.equal(c.ecFixedTermSpan([a, b], b).start, '2024-03-01');
  assert.equal(c.ecFixedTermSpan([a, b], a).over2y, false);
  const gap = { id: 'g', startDate: '2025-06-01', endDate: '2026-03-31' };   // 사이가 비면 따로 센다
  assert.equal(c.ecFixedTermSpan([a, gap], gap).over2y, false);
});

test('① 근로계약서 저장은 한 건씩 (그 직원 것 빼고 통째 되쓰기 → 남의 계약이 사라지던 것)', () => {
  const m = CODE.slice(CODE.indexOf('function EmploymentContractModal'), CODE.indexOf('function EmploymentContractModal') + 6000);
  assert.match(m, /dbUpsert\('employment_contracts', c\)/);
  assert.match(m, /persistList\(next, \[_rec\]\)/);
  assert.match(m, /ecMissing\(form\)/);
});

test('② 근로자명부는 «번호 = 사번»으로 저장 — 지도로 저장해도 읽는 쪽은 같은 배열을 받는다', () => {
  assert.match(CODE, /var DIFF_KEYS = \['user_accounts'/);
  assert.match(CODE, /k === 'user_accounts' && Array\.isArray\(v\)/);
  const c = load(['arrayToIdMap', 'normalizeFbValue'], {});
  const users = [{ sid: 'P-001', name: '가', id: 'P-001' }, { sid: 'A-002', name: '나', id: 'A-002' }];
  const map = c.arrayToIdMap(users);
  assert.equal(J(Object.keys(map).sort()), J(['A-002', 'P-001']));
  const back = c.normalizeFbValue(map);
  assert.ok(Array.isArray(back), '지도를 배열로 못 폈습니다 — 화면의 .find/.filter 가 깨집니다');
  assert.equal(J(back.map(u => u.sid).sort()), J(['A-002', 'P-001']));
});

test('③ 시각으로 근로시간·야간·휴게 — 근로기준법 제54조(4시간 30분·8시간 1시간), 제56조③(22~06시)', () => {
  const c = load(['erpBreakRequired', 'erpClockSpan'], {});
  const day = c.erpClockSpan('09:00', '18:00', 60);
  assert.equal(day.hours, 8);
  assert.equal(day.breakNeed, 60);            // 검사고정-허용: 제54조 8시간 → 1시간
  assert.equal(day.breakShort, false);
  const eve = c.erpClockSpan('18:00', '23:00', 0);
  assert.equal(eve.hours, 5);
  assert.equal(eve.nightHours, 1);
  assert.equal(eve.breakShort, true, '5시간 일하고 쉬지 않았으면 30분이 모자랍니다');
  const late = c.erpClockSpan('22:00', '02:00', 0);
  assert.equal(late.hours, 4, '자정을 넘기면 다음날로 셉니다');
  assert.equal(late.nightHours, 4);
  assert.match(CODE, /addOTRecord\(otAddForm\.date, otAddForm\.kind, otAddForm\.hours, otAddForm\.note, _clk \? otAddForm : null\)/);
});

test('④ 특별휴가 — 기한은 사유 발생일 + 사용기한, 기한 지나면·남은 날 넘으면·배우자 출산휴가 5번째면 막는다', () => {
  const c = load(['spGrantExpiry', 'spGrantUsage', 'spUseBlock'], { dbGet: () => [] });
  vm.runInContext('var SPECIAL_LEAVE_MAX_USES = { "spouse-birth": 4 };', c);
  /* 검사고정-허용: 배우자 출산휴가 — 출산일부터 120일 이내 (남녀고용평등법 제18조의2③) */
  assert.equal(c.spGrantExpiry('2026-10-01', 120), '2027-01-28');
  const g = { id: 'g1', code: 'spouse-birth', eventDate: '2026-10-01', days: 20, expiry: '2027-01-28' };
  const use = n => Array.from({ length: n }, (_, i) => ({ type: 'special-leave', specialGrantId: 'g1', days: 1, date: '2026-10-0' + (i + 2) }));
  assert.equal(c.spUseBlock(g, '2026-10-05', 1, []), null);
  assert.match(c.spUseBlock(g, '2027-02-01', 1, []), /기한/);
  assert.match(c.spUseBlock(g, '2026-09-30', 1, []), /사유 발생일/);
  assert.match(c.spUseBlock(g, '2026-10-20', 1, use(4)), /최대 4번/, '3회 분할(4번) 넘게 나눠 씁니다');
  assert.match(c.spUseBlock(Object.assign({}, g, { code: 'family-care', days: 2 }), '2026-10-20', 1, use(2)), /남은 날/);
});

test('④ 특별휴가 패널이 휴가관리 직원 상세에 붙고, 사용은 근태 기록(special-leave)에 부여 번호와 함께', () => {
  assert.match(CODE, /h\(SpecialLeavePanel, \{ key:'sp-'\+selUser\.sid, user:selUser \}\)/);
  const p = CODE.slice(CODE.indexOf('function SpecialLeavePanel'), CODE.indexOf('function SpecialLeavePanel') + 5000);
  assert.match(p, /dbUpsert\('special_leave_grants', g\)/);
  assert.match(p, /specialGrantId:g\.id/);
  assert.match(p, /spUseBlock\(/);
});

test('규칙 — 특별휴가 부여(사유가 담긴다)는 재무·관리자만 읽고 쓴다', () => {
  const data = JSON.parse(fs.readFileSync(path.join(R, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules.data;
  const r = data.special_leave_grants;
  assert.ok(r, '이름이 없어 직원 누구나 읽고 쓰는 자리로 떨어집니다');
  assert.notEqual(r['.read'], data.$other['.read']);
  assert.match(r['.write'], /'fin'/);
});

test('템플릿 글자 안의 \\d 가 d 로 바뀐 자국이 없다 (6단계 패치에서 두 번 겪음)', () => {
  assert.doesNotMatch(SRC, /\(d\{1,2\}\):\(d\{2\}\)/);
  assert.doesNotMatch(SRC, /\/\^\(d\{4\}\)-\(d\{2\}\)/);
});
