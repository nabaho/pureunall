'use strict';
/* 인사관리 4·5단계 — 근로자명부 보존·기록 연결 · 근태 (대표 지시 2026-10-10 「모두 다해라」)
   ═══════════════════════════════════════════════════════════════════════════
   4단계 명부: 3년 보존(근로기준법 제42조) · 사번은 영구 번호(T- 재번호 없음) · 복귀해도 퇴직 이력 보존 · 성별 빈칸 ≠ 「여」
              · 휴직은 한 건씩 저장 · 급여 수정 기록에 번호 · 성과급 이름 맞추기는 유일할 때만 · 증명서 용도·발급번호
   5단계 근태: 주 12시간 연장 경고(제53조) · 쓴 보상휴가는 전환 취소 불가 · 휴직 날짜에 맞춰 상태 자동
   실행: node --test tests/hr-stage45.test.js */
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
const inner = (head, len) => { const i = CODE.indexOf(head); assert.ok(i >= 0, head + ' 를 못 찾았습니다'); return CODE.slice(i, i + (len || 3000)); };

test('명부 삭제는 3년 보존을 지킨다 — 재직·휴직·퇴직 3년 이내·기록이 이어진 사람은 못 지운다', () => {
  const c = load(['rosterDeleteBlock'], { todayYMD: () => '2026-10-10' });
  const f = (u, refs) => c.rosterDeleteBlock(u, refs, '2026-10-10');
  assert.ok(f({ status: 'active' }));
  assert.ok(f({ status: 'leave' }));
  assert.ok(f({ status: 'retired', retireDate: '2024-01-31' }), '퇴직 3년이 안 됐습니다');   // 검사고정-허용: 제42조 3년
  assert.equal(f({ status: 'retired', retireDate: '2023-10-09' }), null, '보존기간이 지났으면 지울 수 있어야 합니다');
  assert.ok(f({ status: 'retired', retireDate: '2020-01-01' }, { 급여: 3 }), '이어진 급여 기록이 있으면 고아가 됩니다');
  assert.equal(f({ status: 'retired' }, { 급여: 0, 근태: 0, 성과입금: 0, 업체사건: 0 }), null, '잘못 만든 빈 줄은 지울 수 있다');
});

test('명부 삭제 두 길(근로자명부·환경설정) 모두 보존 검사를 거친다', () => {
  assert.ok((CODE.match(/rosterDeleteBlock\(/g) || []).length >= 3, '삭제 길 하나가 보존 검사를 건너뜁니다');
});

test('성별이 비어 있으면 「여」가 아니라 「[확인 필요]」', () => {
  const c = load(['erpGenderLabel'], {});
  assert.equal(c.erpGenderLabel('M'), '남');
  assert.equal(c.erpGenderLabel('F'), '여');
  assert.equal(c.erpGenderLabel(''), '[확인 필요]');
  assert.doesNotMatch(CODE, /gender==='M'\?'남':'여'/);
});

test('복귀해도 앞선 퇴직 연월일·사유가 이력에 남는다 (시행령 제20조)', () => {
  const r = inner('async function reinstate(sid){', 1500);
  assert.match(r, /employmentHistory/);
  assert.ok(r.indexOf('hist.push') >= 0 && r.indexOf('hist.push') < r.indexOf("retireDate:''"), '이력에 옮기기 전에 지웁니다');
});

test('사번정리는 이미 받은 T- 번호를 다시 매기지 않고, 이름으로 사번을 짐작하지 않는다', () => {
  const r = inner('function convertRetiredSids(){', 9000);
  assert.match(r, /maxT/);
  assert.doesNotMatch(r, /'T-'\+\('00'\+\(i\+1\)\)/, '퇴직자 전원을 T-001 부터 다시 매깁니다');
  assert.doesNotMatch(r, /nameToNewT/, '옛 급여를 이름이 같다고 붙입니다');
  for (const k of ['employment_contracts', 'cert_log', 'leave_of_absence', 'dc_contributions', 'leave_grants'])
    assert.ok(r.indexOf("'" + k + "'") >= 0, '사번을 바꿀 때 ' + k + ' 를 빠뜨립니다');
});

test('휴직 날짜에 맞춰 명부 상태를 저절로 — 바꿀 사람이 없으면 아무것도 안 쓴다', () => {
  let wrote = null;
  const store = {
    user_accounts: [{ sid: 'A', status: 'active' }, { sid: 'B', status: 'leave' }, { sid: 'C', status: 'retired' }],
    leave_of_absence: [{ sid: 'A', status: 'active', startDate: '2026-10-01', endDate: '2027-03-31' },
                       { sid: 'B', status: 'active', startDate: '2026-01-01', endDate: '2026-09-30' },
                       { sid: 'C', status: 'active', startDate: '2026-10-01', endDate: '2026-12-31' }]
  };
  const c = load(['getLoaList', 'loaReconcileStatus'], { dbGet: (k, d) => (k in store ? store[k] : d), dbSet: (k, v) => { wrote = v; }, USERS_SEED: [], todayYMD: () => '2026-10-10' });
  assert.equal(c.loaReconcileStatus('2026-10-10'), 2);
  const st = Object.fromEntries(wrote.map(u => [u.sid, u.status]));
  assert.equal(st.A, 'leave', '휴직 기간에 들어섰는데 재직입니다');
  assert.equal(st.B, 'active', '휴직이 끝났는데 휴직입니다');
  assert.equal(st.C, 'retired', '퇴직자를 건드렸습니다');
  store.user_accounts = wrote; wrote = null;
  assert.equal(c.loaReconcileStatus('2026-10-10'), 0);
  assert.equal(wrote, null, '바꿀 것이 없는데 명부를 다시 썼습니다');
});

test('다음 달 시작하는 휴직은 등록 즉시 «휴직»이 되지 않는다 · 휴직은 한 건씩 저장·삭제', () => {
  const s = inner('function syncUserStatus(sid, on, extra){', 800);
  assert.match(s, /extra\.startDate > todayYMD\(\)/);
  const t = CODE.slice(CODE.indexOf('function LeaveOfAbsenceTab'), CODE.indexOf('function leaveLedgerWithIds'));
  assert.match(t, /dbUpsert\('leave_of_absence', it\)/, '휴직 저장이 목록을 통째로 되씁니다');
  assert.match(t, /dbRemoveMany\('leave_of_absence', \[id\]\)/);
  assert.match(t, /loaReconcileStatus\(\)/);
});

test('지난 날짜의 휴직 표시 — 끝난 휴직도 그 날짜면 보인다', () => {
  const store = { leave_of_absence: [{ sid: 'A', status: 'ended', startDate: '2026-03-01', endDate: '2026-12-31', endedDate: '2026-06-30' }] };
  const c = load(['getLoaList', 'getLoaStatus'], { dbGet: (k, d) => (k in store ? store[k] : d), todayYMD: () => '2026-10-10' });
  assert.ok(c.getLoaStatus('A', '2026-04-15'), '지난 달 급여표에서 휴직 표시가 사라집니다');
  assert.equal(c.getLoaStatus('A', '2026-08-01'), null, '일찍 끝난 뒤의 날짜까지 휴직으로 보입니다');
});

test('급여 수정 기록 — 줄마다 번호(id)가 붙는다 (통째 자리번호 배열을 피한다)', () => {
  let saved = null;
  const c = load(['addPayrollAudit'], { dbGet: () => [{ ts: '2026-01-01T00:00:00.000Z', empSid: 'A', field: 'baseSalary' }],
    dbSet: (k, v) => { saved = v; }, CURRENT_USER: { name: '가' }, window: {}, _fbKeyLive: {} });
  c.addPayrollAudit('A', '2026-10', 'legalAllowances.overtimeHours', 1, 2, '');
  assert.equal(saved.length, 2);
  assert.ok(saved.every(x => typeof x.id === 'string' && x.id), '번호 없는 줄이 있습니다');
  assert.notEqual(saved[0].id, saved[1].id);
  assert.doesNotMatch(saved[0].id, /[.#$\[\]\/]/, '번호에 Firebase 금지문자가 들어갔습니다');
});

test('성과급 — 이름으로는 «명부에 하나뿐»이고 «누구의 사번도 아닐» 때만 맞춘다', () => {
  const r = inner('function calcEmpPerf(sid, incomeList){', 4000);
  assert.match(r, /_isSid/);
  assert.doesNotMatch(r, /ps\.name === uName/, '이름이 같으면 무조건 맞춥니다(동명이인 이중 계산)');
  assert.doesNotMatch(r, /recipSid === uName/);
});

test('증명서 — 용도는 정말 필수, 발급번호·받는 사람을 남기고, 담당자를 지어 넣지 않는다', () => {
  const c = CODE.slice(CODE.indexOf('function Certificate()'), CODE.indexOf('function CertLog()'));
  assert.match(c, /function needPurpose\(\)/);
  for (const f of ['function printCert(){', 'function downloadHTML(){', 'function openCertMail(){'])
    assert.ok(c.slice(c.indexOf(f), c.indexOf(f) + 200).indexOf('needPurpose()') >= 0, f + ' 가 용도 없이 발급합니다');
  assert.match(c, /certNo:/);
  assert.match(c, /saveLog\('mail', to\)/);
  assert.doesNotMatch(c, /\(미기재\)/);
  assert.doesNotMatch(c, /company\.contactName \|\| '김보람'/, '특정 직원 이름이 기본 담당자로 박혀 있습니다');
});

test('5단계 — 주 12시간 연장근로(휴일근로 포함, 월~일)를 넘으면 알린다', () => {
  const list = [['2026-10-05', 'overtime', 5], ['2026-10-07', 'overtime', 4], ['2026-10-11', 'holiday', 4], ['2026-10-12', 'overtime', 9], ['2026-10-06', 'night', 3]]
    .map(([date, kind, hours]) => ({ sid: 'A', date, kind, hours }));
  const c = load(['erpWeekOvertime'], { dbGet: () => list });
  const w = c.erpWeekOvertime('A', '2026-10-07');
  assert.equal(w.from, '2026-10-05');   // 월요일
  assert.equal(w.to, '2026-10-11');
  assert.equal(w.hours, 13, '야간(가산만)은 빼고 연장 9 + 휴일 4 = 13');   // 검사고정-허용: 제53조 주 12시간
  assert.match(inner('function addOTRecord(date, kind, hours, note){', 1200), /erpWeekOvertime\(/);
});

test('5단계 — 이미 쓴 보상휴가는 전환 취소 불가 (임금·휴가 이중 보상)', () => {
  assert.match(CODE, /_cb\.raw - \(parseFloat\(r\.compHours\)\|\|0\) < -1e-9/);
  const c = load(['getCompLeaveBalance'], { dbGet: (k) => k === 'overtime_records' ? [{ sid: 'A', convertedToComp: true, compHours: 6 }] : [{ sid: 'A', hours: 8 }] });
  assert.equal(c.getCompLeaveBalance('A').raw, -2, '음수 잔여를 숨깁니다');
});

test('셸에서 역슬래시가 빠진 날짜 정규식(/^d{4}-…/)이 남아 있지 않다', () => {
  /* 2026-10-10 heredoc 로 넣은 패치에서 \\d 가 d 로 바뀌어 「지급 기한」 줄이 늘 비었다 — 같은 실수를 잡는다 */
  assert.doesNotMatch(SRC, /\/\^d\{4\}-d\{2\}/);
  assert.doesNotMatch(SRC, /\(d\{4\}\)-\(d\{2\}\)/, '«(d{4})-(d{2})» — 템플릿 글자 안의 \\d 가 d 로 바뀐 자국입니다');
  assert.doesNotMatch(SRC, /\[\.#\$\[\]\/\]/, 'Firebase 금지문자 정규식의 역슬래시가 빠졌습니다');
});
