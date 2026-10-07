'use strict';
/* 임금명세서 「구성항목별 금액」·「연장·야간·휴일 시간 수」 (2026-10-07)
 *
 * ■ 왜
 *   근로기준법 시행령 제27조의2(임금명세서 기재사항 — 원문 대조 전, 2차 자료로 확인)는 기본급·각종 수당·
 *   상여 등 «구성항목별 금액»과 연장·야간·휴일 «시간 수»(상시 4명 이하 제외)를 적게 한다.
 *   실측: 직원 줄의 85.6%가 명세서에 「그 외 지급」 한 줄로 뭉쳐 나갔다(지급액의 35%) — 파서가 수당 열을 버렸다.
 *   이제 파서가 「지급항목」·「근로시간」을 읽어 오고, 명세서(slipRows)가 한 줄씩 적는다.
 *
 * ■ 못 박는 것 — slipRows 를 잘라 와 실제로 돌린다
 *   ① 수당이 한 줄씩 나온다 ② 모자란 몫은 「그 외 지급(차액)」 ③ ★ 넘치면 잘못 읽은 것이라 안 쓴다
 *   ④ 어느 경우든 임금총액 − 공제총액 = 실수령 ⑤ 시간 열이 있으면 근로시간 줄 ⑥ 예전 자료(항목 없음)는 예전 그대로
 * 실행: node --test tests/payslip-pay-items.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'payroll-os.html'), 'utf8');
function cut(name) {
  const m = HTML.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}
const sb = { JSON, Number, Object, String };
vm.createContext(sb);
new vm.Script('function won(n){ return (n==null)?"-":Number(n).toLocaleString(); }\n' + cut('slipRows') + '\nglobalThis.S = slipRows;').runInContext(sb);
const S = sb.S;
const labels = r => Array.from(r.pay, p => p[0]);
const tie = r => assert.equal(r.gross - r.dedTotal, r.net, '임금총액 − 공제 ≠ 실수령');

test('★ 수당이 한 줄씩 나온다 — 기본급+항목 = 임금총액', () => {
  const r = S({ 성명: '갑', 기본급: 2500000, 지급항목: { 식대: 200000, 고정연장수당: 300000 }, 실수령: 2700000, 공제총액: 300000 });
  assert.deepEqual(labels(r), ['기본급', '식대', '고정연장수당']);
  assert.equal(r.gross, 3000000);
  tie(r);
});

test('모자란 몫은 「그 외 지급(차액)」으로 남긴다', () => {
  const r = S({ 성명: '을', 기본급: 2000000, 지급항목: { 식대: 200000 }, 실수령: 2400000, 공제총액: 100000 });
  assert.deepEqual(labels(r), ['기본급', '식대', '그 외 지급(차액)']);
  assert.equal(r.pay[2][1], 300000);
  tie(r);
});

test('★ 기본급+항목이 임금총액을 넘으면 잘못 읽은 것 — 쓰지 않고 예전처럼 뭉친다', () => {
  const r = S({ 성명: '병', 기본급: 2000000, 지급항목: { 연장수당: 500000, 합계잘못읽음: 2500000 }, 실수령: 2300000, 공제총액: 200000 });
  assert.deepEqual(labels(r), ['기본급', '그 외 지급(수당·비과세 등)']);
  tie(r);
});

test('연장·야간·휴일 시간 열이 있으면 근로시간 줄', () => {
  const r = S({ 성명: '정', 기본급: 2000000, 근로시간: { 연장시간: 12, '휴일근로 시간': 8 }, 실수령: 1900000, 공제총액: 100000 });
  assert.equal(r.hours, '연장시간 12시간 · 휴일근로 시간 8시간');
});

test('예전 자료(항목 없음)는 예전 그대로 — 일당제 계산식도 그대로', () => {
  const r = S({ 성명: '무', 기본급: 2000000, 실수령: 2300000, 공제총액: 200000 });
  assert.deepEqual(labels(r), ['기본급', '그 외 지급(수당·비과세 등)']);
  assert.equal(r.hours, '');
  const d = S({ 성명: '기', 일당: 100000, 근무일수: 5, 실수령: 495500, 공제총액: 4500 });
  assert.deepEqual(labels(d), ['노무비(일당제)']);
  assert.match(d.calc, /일당 100,000원 × 5일/);
});

test('명세서 화면·한글 파일에 근로시간 줄이 실제로 들어간다', () => {
  assert.match(cut('slipHTML'), /r\.hours\?'<div class="calc">근로시간: '/);
  assert.match(cut('exportPayrollSlipsHwpx'), /근로시간: '\+r\.hours/);
});
