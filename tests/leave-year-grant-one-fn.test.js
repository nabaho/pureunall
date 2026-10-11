/* 휴가관리 연차 «목록 = 상세 = 이력» — 부여 합은 erpLeaveYearGrant 한 함수로 (2026-10-11 검토 A1·A2)
   예전: 목록·대시보드·근태는 수기 부여에 판결식 보정분을 «더했고», 선택 직원 상세·연도별 이력은 빼먹었다
   → 2021-06-01 전 입사자 중 수기 부여가 있는 사람이 목록 18일, 상세·이력 17일로 보였다.
   또 이력만 시간연차를 8시간으로 나눠 1일 4시간 근로자의 4시간이 0.5일이었다.
   규칙:
   ① 수기 부여가 있으면 보정분을 «위에 더한다», 없으면 자동(발생 장부) 값 + 이월
   ② 목록(lvRow)·상세·이력·CSV·대시보드·getLeaveRemain 이 모두 이 함수를 부른다 — 직접 합치는 자리가 없다
   ③ 같은 입력이면 목록 경로와 상세 경로가 같은 수를 낸다 (실제 코드 조각을 돌려 견준다)
   ④ 연차 사용일수는 어디서나 그 사람의 소정근로시간으로 나눈다 (PuWork.leaveUsed 에 둘째 인자) */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function box() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(cutFn(src, 'function erpRulingFixDays(') + '\n' + cutFn(src, 'function erpLeaveYearGrant('), ctx);
  return ctx;
}
const GY = { days: 17, list: [{ days: 16, label: '5년 근속' }, { days: 1, label: '판결 전환 보정' }] };

test('① 수기 부여가 있으면 보정분을 위에 더한다 · 이월도 더한다', () => {
  const c = box();
  const fix = c.erpRulingFixDays(GY.list);
  assert.ok(fix > 0);
  const r = c.erpLeaveYearGrant({ total: 17, carryOver: 2 }, GY);
  assert.equal(r.total, 17 + fix);
  assert.equal(r.granted, 17 + fix + 2);
  assert.equal(r.manual, true);
});

test('① 수기 부여가 없으면 자동 값(보정분은 이미 들어 있다)', () => {
  const c = box();
  const r = c.erpLeaveYearGrant(null, GY);
  assert.equal(r.total, GY.days);
  assert.equal(r.granted, GY.days);
  assert.equal(c.erpLeaveYearGrant({ carryOver: 3 }, GY).granted, GY.days + 3, '이월만 있는 해');
});

test('① 문자로 저장된 값도 숫자로 더한다 — 이어 붙이지 않는다', () => {
  const c = box();
  const r = c.erpLeaveYearGrant({ total: '15', carryOver: '2' }, { days: 15, list: [] });
  assert.equal(r.granted, 17);
});

test('② 연차 부여 합을 보여 주는 자리가 모두 이 함수를 부른다', () => {
  const S = strip(src);
  assert.ok((S.match(/erpLeaveYearGrant\(/g) || []).length >= 7, '정의 1 + 대시보드·getLeaveRemain·목록·상세·CSV·이력');
  /* 상세·이력 쪽(변수 이름 override)에도 직접 합치는 자리가 없다 */
  assert.doesNotMatch(S, /override ?&& ?(override\.total ?!= ?null|typeof override\.total ?=== ?'number') ?\? ?override\.total/);
  assert.doesNotMatch(S, /ov ?&& ?ov\.total ?!= ?null ?\?/, '화면이 수기 부여를 직접 합친다');
});

/* ③ 목록(lvRow 의 «연도별» 갈래)과 상세 줄을 실제로 잘라 같은 입력으로 돌린다 */
function sliceBetween(from, to) {
  const i = src.indexOf(from); assert.ok(i >= 0, from + ' 없음');
  const j = src.indexOf(to, i); assert.ok(j > i, to + ' 없음');
  return src.slice(i, j);
}
test('③ 같은 사람·같은 해 — 목록 값 = 상세 값', () => {
  const c = box();
  Object.assign(c, {
    selYear: '2026', selSid: 'A-001',
    grants: { 'A-001': { '2026': { total: 17, carryOver: 1 } } },
    calcGrantDays: () => GY,
  });
  /* 목록: lvRow 의 연도별 갈래 */
  const list = sliceBetween('    var a = calcGrantDays(u.hireDate, selYear', '    var us = calcUsed(u.sid, selYear);');
  vm.runInContext('var u = { sid:"A-001", hireDate:"2019-07-18" };\n' + list + '\nthis.LIST = t + co;', c);
  /* 상세: 선택 직원 줄 */
  const det = sliceBetween('  var auto = selUser ? calcGrantDays(', '  var used  = selUser ? calcUsed(');
  vm.runInContext('var selUser = { sid:"A-001", hireDate:"2019-07-18" };\n' + det + '\nthis.DETAIL = grant;', c);
  assert.equal(c.DETAIL, c.LIST);
  assert.equal(c.LIST, 17 + c.erpRulingFixDays(GY.list) + 1);
});

test('④ 연차 사용일수는 어디서나 소정근로시간으로 나눈다 — 인자 하나짜리 PuWork.leaveUsed 가 없다', () => {
  const S = strip(src);
  const calls = S.match(/PuWork\.leaveUsed\([^()]*(\([^()]*\))?[^()]*\)/g) || [];
  assert.ok(calls.length >= 5);
  calls.forEach((k) => assert.match(k, /,/, '소정근로시간 없이 부른다: ' + k));
});
