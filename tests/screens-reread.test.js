'use strict';
/* 서버 자료가 내려오면 목록을 다시 읽는다 — 계약관리 말고도 (대표 「1번」 2026-10-05)
   ── 무엇이 있었나
     계약관리가 목록을 처음 열 때 한 번 dbGet 으로 받아 useState 에 얼려 두어, 그 순간 자료가 덜 와 있으면
     화면이 그 사진에 멈췄다(36건 · 실제 167건 — 대표 신고 「상담접수·계약확정 사라졌다」). #1989 는 계약관리만 고쳤다.
     같은 꼴이 업체·사건·컨설팅·기금·기타사업·수입·지출·종료·근태·휴가·급여에 더 있었다.
   ── 못 박는 것(규칙)
   ① 공용 훅 useDbReread — 그 화면의 열쇠가 바뀌었거나 첫 받기가 끝났거나 묶음·수동일 때만 다시 읽고, 남의 표엔 안 움직인다
   ② 여러 사람이 함께 고치는 업무 표를 useState(dbGet(…)) 로 얼리는 화면은 반드시 다시 읽는 길을 갖는다 — 새 화면도 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function cut(head) {
  const at = SRC.indexOf(head); assert.ok(at >= 0, head + ' 없음');
  let i = SRC.indexOf('{', at), d = 0;
  for (; i < SRC.length; i++) { if (SRC[i] === '{') d++; else if (SRC[i] === '}') { d--; if (d === 0) break; } }
  return SRC.slice(at, i + 1);
}

test('① ★★ 훅은 «내 열쇠»·첫 받기·묶음·수동·내 저장에만 다시 읽는다', () => {
  const listeners = {};
  const ctx = {
    window: { addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener() {} },
    useRef: (v) => ({ current: v }),
    useEffect: (f) => { f(); },
  };
  vm.createContext(ctx);
  vm.runInContext(cut('function useDbReread('), ctx);
  let n = 0;
  ctx.useDbReread(['cases'], () => { n++; });
  const fire = (type, detail) => listeners[type]({ type, detail });
  fire('fb_data_changed', 'companies'); assert.equal(n, 0, '남의 표가 바뀌었는데 다시 읽었다');
  fire('fb_data_changed', 'cases'); assert.equal(n, 1, '내 표가 바뀌었는데 안 읽었다');
  fire('fb_data_changed', 'batch'); assert.equal(n, 2, '묶음 변경을 놓쳤다');
  fire('fb_data_changed', 'manual'); assert.equal(n, 3, '수동 동기화를 놓쳤다');
  fire('fb_initial_done', 7); assert.equal(n, 4, '★★ 첫 받기가 끝났는데 안 읽었다 — 바로 이것이 «덜 받은 목록에 멈춤»이다');
  fire('pureun-saved', { key: 'cases' }); assert.equal(n, 5);
  fire('pureun-saved', { key: 'funds' }); assert.equal(n, 5);
  assert.ok(listeners.fb_data_changed && listeners.fb_initial_done && listeners['pureun-saved'], '세 알림을 다 들어야 한다');
});

/* 화면 → [그 화면이 다시 읽는 열쇠, 다시 읽는 함수(그 화면 안에 있어야 한다)] */
const WIRED = {
  CompanyManagement: [/useDbReread\(\['companies'\]/, 'function refreshCompanies('],
  CaseManagement: [/useDbReread\(\['cases'\]/, 'function refreshCases('],
  ProjectManagementShared: [/useDbReread\(\[props\.storageKey\]/, 'function refreshItems('],
  IncomeListTab: [/useDbReread\(\['finance_income'\]/, 'function refreshIncomes('],
  IncomeCompanyTab: [/useDbReread\(\['finance_income'\]/, 'function refreshIncomes('],
  FinanceExpense: [/useDbReread\(\['finance_expense'\]/, 'function refreshExpenses('],
  ClosedManagement: [/useDbReread\(\['closed_archive'\]/, null],
  AttendanceManagement: [/useDbReread\(\['attendance_records'\]/, 'function refreshAtt('],
  LeaveManagement: [/useDbReread\(\['attendance_records', 'leave_promotion'\]/, null],
  PayrollLedger: [/useDbReread\(\['payroll_monthly'\]/, 'function refreshRecs('],
  PayrollIrregular: [/useDbReread\(\['payroll_irregular'\]/, 'function refreshIrr('],
};
test('① 화면 열한 곳이 제 열쇠로 다시 읽는다', () => {
  for (const [name, [re, fn]] of Object.entries(WIRED)) {
    const body = stripJs(cut('function ' + name + '('));
    assert.match(body, re, name + ' 가 서버 자료가 와도 다시 안 읽는다');
    if (fn) assert.ok(body.includes(fn), name + ' 안에 ' + fn + ' 가 없다 — 훅이 없는 함수를 부른다');
  }
});

/* ② 새 화면도 — 함께 고치는 업무 표를 얼리면 다시 읽는 길이 있어야 한다 */
const SHARED = ['companies', 'cases', 'consultings', 'funds', 'other_projects', 'contracts', 'finance_income',
  'finance_expense', 'finance_invoice', 'closed_archive', 'attendance_records', 'payroll_monthly', 'payroll_irregular', 'leave_promotion'];
test('② ★★ 함께 고치는 업무 표를 useState 에 얼리는 화면은 반드시 다시 읽는다', () => {
  const B = stripJs(SRC);
  const lines = B.split('\n');
  const starts = [];
  lines.forEach((l, i) => { const m = l.match(/^function ([A-Z][A-Za-z0-9_]*)\(/); if (m) starts.push({ name: m[1], line: i }); });
  const bad = [];
  let checked = 0;
  for (let k = 0; k < starts.length; k++) {
    const body = lines.slice(starts[k].line, k + 1 < starts.length ? starts[k + 1].line : lines.length).join('\n');
    const dbVars = {};
    for (const m of body.matchAll(/var\s+([A-Za-z_$][\w$]*)\s*=\s*dbGet\(\s*'([^']+)'/g)) dbVars[m[1]] = m[2];
    const keys = new Set();
    for (const m of body.matchAll(/useState\(\s*\(?\s*dbGet\(\s*'([^']+)'/g)) keys.add(m[1]);
    for (const m of body.matchAll(/useState\(\s*([A-Za-z_$][\w$]*)\s*\)/g)) if (dbVars[m[1]]) keys.add(dbVars[m[1]]);
    const shared = [...keys].filter((x) => SHARED.includes(x));
    if (!shared.length) continue;
    checked++;
    const rereads = /useDbReread\(/.test(body) || /addEventListener\(\s*'(fb_data_changed|fb_initial_done)'/.test(body);
    if (!rereads) bad.push(starts[k].name + '(' + shared.join(',') + ')');
  }
  assert.ok(checked >= 10, '검사가 화면을 못 찾았다 — 헛돈다(' + checked + ')');
  assert.deepEqual(bad, [], '★★ 서버 자료가 와도 다시 안 읽는 화면: ' + bad.join(', ') + '\n  → useDbReread([열쇠], 다시읽기) 를 목록 상태 바로 뒤에 붙이세요');
});
