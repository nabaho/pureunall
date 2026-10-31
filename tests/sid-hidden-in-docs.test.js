'use strict';
/* 🙈 문서(급여명세서·급여대장·인사기록카드)에도 사번이 안 찍힌다 (대표 결정 2026-10-31 「사번은 숨겨라」)

   ■ 왜 생겼나
   2026-10-25 에 화면에서 사번을 걷을 때(tests/sid-never-shown.test.js) 문서(출력·PDF·엑셀·메일)는 «법적 기재 사항 확인 전»이라 남겨 뒀다.
   10/31 대표가 「문서도 숨겨라」 — 국가법령정보센터 원문(시행 2025.10.23)을 직접 읽어 확인했다:
     · 근로기준법 시행령 제27조의2 제1호(임금명세서): «근로자의 성명, 생년월일, 사원번호 등 근로자를 특정할 수 있는 정보»
     · 같은 시행령 제27조 제1항(임금대장): 제1호 «성명» · 제2호 «생년월일, 사원번호 등 근로자를 특정할 수 있는 정보»
     → 사원번호는 «예시»다. 사번을 빼도 성명 + 생년월일이면 요건이 유지된다. 그래서 사번 자리를 생년월일(직원 정보 u.birthDate)로 채운다.

   ★ 규칙 (값이 아니라 규칙)
     ① 임금명세서(PDF·메일·시험·일괄 출력·글·한글 파일·화면)와 급여대장 CSV 에 사번이 «글자로» 없다 — 그 자리는 생년월일(erpDocBirth)
     ② 인사기록카드 머리·급여 겹친 달 화면에도 사번 글자가 없다(이름만)
     ③ 생년월일이 비면 «빈 글자»다 — 사번·이메일·이름으로 대신 채우지 않는다
     ④ ⚠ 급여 CSV «가져오기»의 열쇠는 그대로 사번이다(사번 칸이 «있으면» 사번만). 사번 칸이 없는 파일(내려받은 급여대장.csv)만
        이름 + 생년월일이 «둘 다» 같은 «한 사람»으로 맞춘다 — 이름만·생년월일 빈 것·둘 이상은 맞추지 않는다(동명이인 사고 방지) */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const ERP = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8'));
const count = (s, re) => (s.match(re) || []).length;

/* ── ① 임금명세서·급여대장 ── */
test('①★ 급여대장 화면의 문서 만드는 곳(명세서 PDF·메일·일괄 출력·CSV)에 사번 글자가 없다', () => {
  const led = cutFn(ERP, 'function PayrollLedger(props)');
  assert.ok(!/<t[dh][^>]*>\s*사번\s*<\/t[dh]>/.test(led), '★ 명세서 HTML 에 「사번」 칸이 있습니다');
  assert.ok(!/\+\s*u\.sid\s*\+\s*'\s*<\/t[dh]>/.test(led), '★ 명세서 HTML 이 사번 값을 찍습니다');
  assert.ok(!/\[\[\s*'사번'\s*,\s*'이름'/.test(led), '★ 급여대장 CSV 첫 칸이 사번입니다');
  assert.ok(!/rows\.push\(\[\s*u\.sid\b/.test(led), '★ 급여대장 CSV 줄이 사번 값을 씁니다');
  assert.equal(count(led, /<th>생년월일<\/th><td>'\+erpDocBirth\(u\)\+'<\/td>/g), 1, '일괄 출력에 생년월일 칸이 없습니다');
  assert.equal(count(led, /생년월일<\/td><td style="padding:5px 8px">'\+erpDocBirth\(u\)\+'<\/td>/g), 1, 'PDF·메일 명세서에 생년월일 칸이 없습니다');
  assert.ok(/\[\[\s*'생년월일'\s*,\s*'이름'\s*,\s*'직책'/.test(led) && /rows\.push\(\[\s*erpDocBirth\(u\)\s*,\s*u\.name/.test(led), '급여대장 CSV 에 생년월일 칸이 없습니다');
});

test('①★ 명세서 한 장(화면·mailto 글·한글 파일)에도 사번 글자가 없다 — 그 자리는 생년월일', () => {
  const sl = cutFn(ERP, 'function PayrollPayslip(props)');
  assert.ok(!/'사번'/.test(sl), '★ 명세서에 「사번」 라벨이 있습니다');
  assert.ok(!/사번\s*:\s*'/.test(sl), '★ 명세서 글에 「사번: 」 줄이 있습니다');
  assert.ok(!/emp\.sid\s*\|\|\s*''/.test(sl), '★ 명세서가 사번 값을 찍습니다');
  assert.equal(count(sl, /erpDocBirth\(/g), 4, '생년월일 자리(글 2 · 한글 1 · 화면 1)가 빠졌습니다');
  assert.ok(/'성명', d\.emp\.name\|\|'', '생년월일', erpDocBirth\(d\.emp\)/.test(sl), '한글 명세서 칸 짝(성명|생년월일)이 아닙니다');
  /* 글 줄은 «값이 있을 때만» 찍는다 — 비면 줄째 없다(빈 「생년월일: 」 줄을 보내지 않는다) */
  assert.ok(/erpDocBirth\(d\.emp\) \? \['생년월일: '\+erpDocBirth\(d\.emp\)\] : \[\]/.test(sl), '값이 없을 때 줄을 건너뛰지 않습니다');
});

/* ── ② 인사기록카드·관리 화면 ── */
test('②★ 인사기록카드 머리와 급여 겹친 달 화면에 사번 글자가 없다 (이름만)', () => {
  const card = cutFn(ERP, 'function PersonnelCardModal(props)');
  assert.ok(!/\bu\.sid\s*\+\s*'/.test(card) && !/'\s*\+\s*u\.sid\b/.test(card), '★ 인사기록카드가 사번을 글자로 찍습니다');
  assert.ok(/\[u\.title, u\.branch\]\.filter\(Boolean\)\.join\(' · '\)/.test(card), '머리 줄(직책·소속)이 없습니다');
  assert.ok(!/'사번 '\s*\+\s*g\.empSid/.test(ERP), '★ 급여 겹친 달 화면이 사번을 찍습니다');
});

/* ── ③ 생년월일 자리 ── */
function pure() {
  const ctx = { Object, String, Array };
  vm.createContext(ctx);
  vm.runInContext(cutFn(ERP, 'function erpDocBirth(u)') + '\n' + cutFn(ERP, 'function payCsvFindUser(users, idx, cells)') + '\nthis.b = erpDocBirth; this.f = payCsvFindUser;', ctx);
  return ctx;
}
test('③★ 생년월일 자리 — 값이 있으면 날짜만, 없으면 «빈 글자» (사번·이메일·이름으로 대신 채우지 않는다)', () => {
  const { b } = pure();
  assert.equal(b({ sid: 'P-001', name: '홍길동', email: 'p001@example.test', birthDate: '1980-02-03' }), '1980-02-03');
  assert.equal(b({ sid: 'P-001', name: '홍길동', email: 'p001@example.test' }), '', '★ 생년월일이 없는데 다른 값이 들어갑니다');
  assert.equal(b({ sid: 'P-001', birthDate: '' }), '');
  assert.equal(b({ birthDate: ' 1980-02-03T00:00:00Z ' }), '1980-02-03', '날짜 뒤 시각은 자른다');
  assert.equal(b(null), ''); assert.equal(b(undefined), '');
});

/* ── ④ CSV 가져오기 열쇠 ── */
const U = [
  { sid: 'P-001', name: '홍길동', birthDate: '1980-02-03' },
  { sid: 'P-002', name: '김하나', birthDate: '1990-05-06' },
  { sid: 'P-003', name: '이둘', birthDate: '' },
  { sid: 'P-004', name: '박동명', birthDate: '1985-01-01' },
  { sid: 'P-005', name: '박동명', birthDate: '1985-01-01' },
  { sid: 'P-006', name: '최동명', birthDate: '1970-07-07' },
  { sid: 'P-007', name: '최동명', birthDate: '1971-07-07' },
];
const find = (hdr, cells) => { const { f } = pure(); const idx = {}; ['사번', '이름', '생년월일', '기본급'].forEach((k) => { idx[k] = hdr.indexOf(k); }); return f(U, idx, cells); };

test('④★ 사번 칸이 «있으면» 사번만 본다 — 모르는 사번을 이름으로 구제하지 않는다', () => {
  const r = find(['사번', '이름', '기본급'], ['P-002', '아무개', '100']);
  assert.ok(r && r.sid === 'P-002');
  assert.equal(find(['사번', '이름', '생년월일'], ['P-999', '홍길동', '1980-02-03']), null, '★ 모르는 사번인데 이름·생년월일로 맞췄습니다');
  assert.equal(find(['사번', '이름', '생년월일'], ['', '홍길동', '1980-02-03']), null, '★ 사번 칸이 빈 줄을 이름으로 맞췄습니다');
});

test('④★ 사번 칸이 «없는» 파일(내려받은 급여대장.csv)은 이름 + 생년월일이 둘 다 같은 «한 사람»만 맞춘다', () => {
  const hdr = ['생년월일', '이름', '직책', '기본급'];
  const r = find(hdr, ['1980-02-03', '홍길동', '', '3000000']);
  assert.ok(r && r.sid === 'P-001', '내려받은 파일이 다시 안 맞습니다 — 왕복이 깨집니다');
  assert.equal(find(hdr, ['1999-01-01', '홍길동', '', '1']), null, '★ 이름만 같고 생년월일이 다른데 맞췄습니다');
  assert.equal(find(hdr, ['', '이둘', '', '1']), null, '★ 생년월일이 비었는데 이름으로 맞췄습니다');
  assert.equal(find(hdr, ['', '', '', '1']), null);
  assert.equal(find(hdr, ['1985-01-01', '박동명', '', '1']), null, '★ 동명이인(생년월일도 같음) 둘 중 하나로 맞췄습니다 — 남의 급여가 바뀝니다');
  const r2 = find(hdr, ['1970-07-07', '최동명', '', '1']);
  assert.ok(r2 && r2.sid === 'P-006', '이름이 같아도 생년월일이 다르면 한 사람으로 가려져야 합니다');
  assert.equal(find(['이름', '기본급'], ['홍길동', '1']), null, '★ 생년월일 칸도 없는데 이름만으로 맞췄습니다');
});

test('④ 가져오기 화면은 그 함수를 쓰고, 못 맞춘 줄 수를 알린다', () => {
  const led = cutFn(ERP, 'function PayrollLedger(props)');
  assert.ok(/var u=payCsvFindUser\(users, idx, c\); if\(!u\)\{ skipped\+\+; return; \}/.test(led), '가져오기가 payCsvFindUser 를 안 씁니다');
  assert.ok(/건너뜀 '\+skipped\+'줄/.test(led), '못 맞춘 줄을 알리지 않습니다 — 조용히 빠집니다');
  assert.ok(/\['사번','이름','생년월일','기본급'/.test(led), '가져오기가 이름·생년월일 열을 안 읽습니다');
});
