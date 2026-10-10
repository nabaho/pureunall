'use strict';
/* 인사관리 0단계 — 사고를 막는 다섯 가지 (대표 지시 2026-10-10 「인사관리 전체 검토」 → 「0단계부터 시작」)
   ═══════════════════════════════════════════════════════════════════════════
   검토에서 «돈이 잘못 나가거나 법적 효력이 사라지는» 자리를 먼저 막았다.
     ① 퇴사 처리 화면의 연차수당 — 일급(기본급÷30)에 다시 ×8 을 곱해 «약 7배»
        퇴직금 — 기본급÷30×30×근속(수당·상여 빠짐), 근속을 365.25 로 나눠 정확히 1년이 «1년 미만»
     ② 퇴직자에게 재직증명서(「~ 현재」)가 직인과 함께 나갔다
     ③ 연차사용촉진 «시기» — 2차 칸이 뜨는 순간이 이미 법정 기한이 지난 때였다(제61조)
     ④ 연차 계산이 퇴직일을 leaveDate 에서 찾았다 — 명부에 그 칸을 쓰는 곳이 없다(실측 0건)
     ⑤ 근태 마감·연장근로·휴직·연차 부여·근로계약서·법인 정보가 «직원 누구나 쓰기»였다

   ★ 검사는 «지금 값»이 아니라 «규칙»을 본다 (CLAUDE.md).
     법정 날짜(6개월 전·10일·2개월 전)는 그 자체가 법이라 박는다 — 그 줄에 까닭을 적었다.
   실행: node --test tests/hr-stage0.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

/* 주석을 걷는다 — 주석 속 옛 식(「×8」 등)에 검사가 속지 않게. 함수 «조각»이라 stripJs(공용 걷개) */
const { stripJs } = require('./strip-comments.js');
/* 맨 앞 칸의 function 하나를 잘라 온다 — 다음 맨 앞 칸 function 앞까지 */
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다 — 이름이 바뀌었다면 이 검사도 함께 고치십시오');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
/* 오늘을 고정한 Date — vm 안의 new Date() 만 이 날짜가 된다 */
function fixedDate(y, m, d){
  const T = new Date(y, m - 1, d).getTime();
  return class extends Date {
    constructor(...a){ if (a.length === 0) super(T); else super(...a); }
    static now(){ return T; }
  };
}
const ymd = d => d ? (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')) : null;

/* ── ① 퇴사 처리 화면 ── */
test('① 퇴사 화면의 연차수당은 «통상임금 1일분 × 남은 일수» — 일급에 ×8 을 또 곱하지 않는다', () => {
  const body = stripJs(fnSrc('RetireModal'));
  const m = body.match(/var\s+annualPay\s*=\s*([^;]+);/);
  assert.ok(m, 'annualPay 를 셈하는 줄이 없습니다');
  assert.doesNotMatch(m[1], /\*\s*8\b/, '연차수당 식에 «×8» 이 다시 들어왔습니다 — 하루치를 시급처럼 쓰면 약 7배가 됩니다');
  assert.match(body, /calcOrdinaryDailyWage\s*\(/, '통상일급은 급여 기록(calcOrdinaryDailyWage)에서 찾아야 합니다');
  assert.match(body, /\/\s*209\s*\*\s*8/, '급여 기록이 없을 때의 통상일급은 «월 통상임금 ÷ 209 × 8» 이어야 합니다');
});

test('① 퇴사 화면의 퇴직금은 법정 계산(calcLegalSeverance)을 쓰고, DC 가입자는 금액 대신 안내한다', () => {
  const body = stripJs(fnSrc('RetireModal'));
  assert.match(body, /calcLegalSeverance\s*\(/, '퇴직금은 평균임금으로 세는 calcLegalSeverance 를 불러야 합니다');
  assert.doesNotMatch(body, /daily\s*\*\s*30\s*\*\s*years/, '옛 식(기본급÷30×30×근속)이 남아 있습니다');
  assert.match(body, /getStaffPension\s*\(/, 'DC 가입 여부를 보지 않습니다 — DC 가입자에게 법정 퇴직금을 또 잡으면 이중 지급입니다');
  assert.doesNotMatch(body, /365\.25/, '근속을 365.25 로 나누면 정확히 1년 다닌 사람이 «1년 미만»이 됩니다');
});

/* ── ② 증명서 ── */
test('② 퇴직자에게는 재직증명서를 «뽑는 값» 자체가 경력증명서로 바뀐다 (고르개만 막지 않는다)', () => {
  const body = stripJs(fnSrc('Certificate'));
  assert.match(body, /var\s+kind\s*=\s*\(\s*isRetiredSel\s*&&[^;]*'employment'[^;]*\)\s*\?\s*'career'/,
    '퇴직자 + 재직증명서 조합이 그대로 통과합니다 — 「~ 현재」 문서가 직인과 함께 나갑니다');
  assert.match(body, /disabled\s*:\s*isRetiredSel\s*&&\s*k\.v\s*===\s*'employment'/, '고르개에서도 퇴직자 재직증명서를 막아야 합니다');
  assert.match(body, /status\s*===\s*'leave'/, '휴직자도 재직 중입니다 — 증명서 목록에 들어야 합니다');
  assert.doesNotMatch(body, /재직하였음/, '재직증명서 문구가 과거형입니다 — 「재직하고 있음」이어야 합니다');
});

/* ── ③ 연차사용촉진 시기 ── */
function promoStage(today, hireDate){
  const ctx = { Date: fixedDate(...today), dbGet: () => ({ basis: 'joinDate' }), Math, Number, isNaN };
  vm.createContext(ctx);
  vm.runInContext(fnSrc('calcLeavePromoStage') + '\nthis.f = calcLeavePromoStage;', ctx);
  return ctx.f(hireDate, today[0]);
}

test('③ 1차 촉구는 «만료 6개월 전 기준 10일» 창, 2차는 «만료 2개월 전까지» — 제61조①', () => {
  /* 검사고정-허용: 날짜는 근로기준법 제61조①의 기한 그 자체다.
     2020-03-04 입사 → 2026-03-04 에 생긴 연차의 마지막 사용일 2027-03-03
     → 1차 창 2026-09-03 ~ 09-12, 2차 마감 2027-01-03 */
  const H = '2020-03-04';
  const s0 = promoStage([2026, 9, 3], H);
  assert.equal(ymd(s0.expiry), '2027-03-03', '만료일은 «쓸 수 있는 마지막 날» = 입사 기념일 전날이어야 합니다'); // 검사고정-허용: 법정 소멸일
  assert.equal(s0.stage, '1차 통보 시기');
  assert.equal(promoStage([2026, 9, 12], H).stage, '1차 통보 시기', '10일째(기준일 포함)까지는 1차 창입니다');
  assert.equal(promoStage([2026, 9, 13], H).stage, '2차 통보 시기',
    '1차 창(10일)이 지났는데도 「1차 시기」로 보입니다 — 예전처럼 2개월 전까지 1차로 보이면 촉진 효력이 없습니다');
  assert.equal(promoStage([2027, 1, 3], H).stage, '2차 통보 시기', '2개월 전 «당일»까지는 2차를 보낼 수 있습니다');
  const late = promoStage([2027, 1, 4], H).stage;
  assert.notEqual(late, '2차 통보 시기', '2차 마감(2개월 전)이 지났는데도 「2차 시기」로 보입니다 — 예전 결함 그대로입니다');
  assert.equal(promoStage([2026, 9, 2], H).stage, '대기');
});

test('③ 1년 미만 연차는 «3개월 전 기준 10일» / «1개월 전까지» — 제61조②', () => {
  /* 검사고정-허용: 2026-03-16 입사 → 1년 미만 연차 마지막 사용일 2027-03-15, 1차 창 2026-12-15~24, 2차 마감 2027-02-15 */
  const H = '2026-03-16';
  const s = promoStage([2026, 12, 15], H);
  assert.equal(s.isFirstYear, true);
  assert.equal(ymd(s.expiry), '2027-03-15'); // 검사고정-허용: 법정 소멸일
  assert.equal(s.stage, '1차 통보 시기');
  assert.equal(promoStage([2026, 12, 25], H).stage, '2차 통보 시기');
  assert.notEqual(promoStage([2027, 2, 16], H).stage, '2차 통보 시기', '1개월 전 마감이 지났습니다');
});

test('③ 화면은 새 단계(촉진 기한 지남)에서도 통보 단추를 숨기지 않는다 — 기록은 남길 수 있어야 한다', () => {
  /* 단계 이름을 바꾸면 화면의 «도달했나» 판정이 조용히 어긋난다 — 두 화면 모두 새 단계를 안다 */
  const n = (SRC.match(/stage\s*===\s*'촉진 기한 지남'/g) || []).length;
  assert.ok(n >= 4, '연차 목록·상세의 1차·2차 판정 모두가 「촉진 기한 지남」을 알아야 합니다 (지금 ' + n + '곳)');
});

/* ── ④ 퇴직일 칸 ── */
test('④ 연차 잔여는 퇴직일(retireDate)에서 멈춘다 — 퇴직자 연차가 연말까지 붙지 않는다', () => {
  const users = [{ sid: 'X-1', hireDate: '2026-03-16', retireDate: '2026-06-30' }];
  const ctx = {
    Date: fixedDate(2026, 10, 10), Math, Number, String, parseInt, isNaN,
    dbGet: (k, d) => k === 'user_accounts' ? users : k === 'policy_leave' ? { monthlyForFirstYear: true } : d,
    USERS_SEED: [], PuWork: { leaveUsed: () => 0 }
  };
  vm.createContext(ctx);
  /* 2단계(2026-10-10)부터 getLeaveRemain 은 발생 장부(erpLeaveGrants)를 거친다 — 장부 도우미를 함께 싣는다.
     localYMD 는 js/utils.js 에 있다 */
  const LOCAL_YMD = (fs.readFileSync(path.join(R, 'js', 'utils.js'), 'utf8').match(/function localYMD\([^\n]*/) || [''])[0];
  vm.runInContext(LOCAL_YMD + '\n' + ['_lvYmd', '_lvParse', '_lvAddMonths', '_lvDayBefore', '_lvGrantsFrom', 'erpLeaveGrants', 'erpLeaveGrantedInYear'].map(fnSrc).join('\n')
    + '\n' + fnSrc('getLeaveStartDate') + '\n' + fnSrc('getLeaveRemain')
    + '\nvar PUREUN_5IN_DATE = "2021-06-01";\nthis.f = getLeaveRemain;', ctx);
  const r = ctx.f('X-1', 2026);
  /* 3월 16일 입사 → 6월 30일 퇴직: 개근한 달은 4/16·5/16·6/16 셋. 연말까지 세면 9가 나온다 */
  assert.ok(r.total <= 3, '퇴직 뒤의 달까지 연차가 붙었습니다 (' + r.total + '일) — retireDate 를 안 읽는 것입니다');
});

test('④ 휴가관리 화면의 부여 계산도 모두 retireDate 를 넘긴다', () => {
  const body = stripJs(fnSrc('LeaveManagement'));
  const calls = body.match(/calcGrantDays\([^)]*\)/g) || [];
  assert.ok(calls.length >= 2, 'calcGrantDays 부르는 곳을 못 찾았습니다');
  const bad = calls.filter(c => !/retireDate/.test(c) && !/^calcGrantDays\(hireDate/.test(c));
  assert.deepEqual(bad, [], '퇴직일을 안 넘기는 부여 계산이 있습니다');
});

/* ── 사번정리 콘솔 백업에 주민번호를 안 찍는다 ── */
test('사번정리·명부 가져오기의 콘솔 백업은 주민번호·계좌·비밀번호를 뺀다', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fnSrc('erpNoPiiUsers') + '\nthis.f = erpNoPiiUsers;', ctx);
  const out = ctx.f([{ sid: 'X-1', name: '가', rrn: '000000-0000000', accountNo: '1', loginPw: 'p', hireDate: '2020-01-01' }])[0];
  for (const k of ['rrn', 'accountNo', 'loginPw']) assert.equal(k in out, false, k + ' 가 콘솔에 찍힙니다');
  assert.equal(out.sid, 'X-1', '사번은 되돌리기에 필요합니다');
  const code = stripJs(SRC);
  assert.doesNotMatch(code, /console\.log\('\[사번정리 백업\] user_accounts',\s*JSON\.stringify\(curUsers\)\)/);
  assert.doesNotMatch(code, /console\.log\('\[근로자명부 가져오기 백업\]',\s*JSON\.stringify\(users\)\)/);
});

/* ── ⑤ 규칙 ── */
const rulesData = JSON.parse(fs.readFileSync(path.join(R, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules.data;
const LOGIN_WRITE = rulesData.$other['.write'];   // 직원 누구나

test('⑤ 인사 자료·설정은 «직원 누구나 쓰기»가 아니다 — 재무 권한자·관리자만', () => {
  const keys = ['locked_payroll_months', 'locked_irregular_months', 'locked_attend_months', 'overtime_records',
    'comp_leave_records', 'leave_of_absence', 'leave_grants', 'employment_contracts', 'cert_log', 'company_info',
    'insurance_rates', 'min_wage', 'withholding_brackets', 'pension_policy', 'policy_leave', 'policy_special_leave', 'policy_loa'];
  for (const k of keys){
    const r = rulesData[k];
    assert.ok(r, 'data/' + k + ' 에 이름이 없습니다 — $other(직원 누구나 쓰기)로 떨어집니다');
    assert.notEqual(r['.write'], LOGIN_WRITE, 'data/' + k + ' 를 직원 누구나 씁니다');
    assert.match(r['.write'], /'fin'/, 'data/' + k + ' — 재무 권한자가 못 쓰게 되면 인사 화면이 조용히 멈춥니다');
    assert.match(r['.write'], /'isAdmin'/, 'data/' + k + ' — 관리자가 못 쓰게 되면 복원·설정이 멈춥니다');
  }
});

test('⑤ 근로계약서(임금 칸)·증명서 발급대장은 읽기도 좁다 / 캘린더가 읽는 자리는 읽기를 그대로 둔다', () => {
  for (const k of ['employment_contracts', 'cert_log'])
    assert.notEqual(rulesData[k]['.read'], rulesData.$other['.read'], 'data/' + k + ' 를 직원 누구나 읽습니다');
  /* 좁히면 조용히 비는 쪽 — 캘린더(pu-cal)·업무관리(work)·대시보드·경력관리 */
  for (const k of ['leave_of_absence', 'locked_attend_months', 'leave_grants', 'company_info'])
    assert.equal(rulesData[k]['.read'], rulesData.$other['.read'], 'data/' + k + ' 읽기를 좁히면 다른 앱 화면이 빕니다');
});

test('⑤ 규칙 만들개의 data 칸에 같은 열쇠가 두 번 적히지 않는다 — 뒤의 것이 «조용히» 이긴다', () => {
  /* 2026-10-10 실제로 겪었다: 다른 방이 leave_of_absence 를 «권한 그대로» 적은 사이에
     이 방이 같은 열쇠를 좁혀 적었다. JS 객체는 오류 없이 뒤의 줄을 쓴다 — 어느 쪽이 살았는지 아무도 모른다. */
  const src = fs.readFileSync(path.join(R, 'scripts', 'make-firebase-rules.js'), 'utf8').replace(/\r\n/g, '\n');
  const i = src.indexOf('rules.data = {');
  assert.ok(i >= 0, 'rules.data 를 못 찾았습니다');
  const body = src.slice(i, src.indexOf('\n};', i)).replace(/\/\*[\s\S]*?\*\//g, '');
  const seen = {}, dup = [];
  for (const l of body.split('\n')){
    const k = (l.match(/^  ([A-Za-z_$][\w$]*)\s*:/) || [])[1];
    if (!k) continue;
    if (seen[k]) dup.push(k); seen[k] = 1;
  }
  assert.deepEqual(dup, [], '두 번 적힌 열쇠 — 한 곳으로 합치십시오: ' + dup.join(', '));
});
