'use strict';
/* 계약서 양식 보내기·인쇄 고침 (대표 「진행」 2026-10-09, 다른 방 작업 검토 결과) — 가짜 자료만
   ⓐ 18MB 를 넘으면 PDF 만 뺀다 — 묶음의 나머지 서류를 버리고 «보냄»으로 적던 것
   ⓑ 공단에 낸 서류 — 받는 분은 기관 이름, 회사 📬 서명본 대기에 올리지 않는다
   ⓒ 채우기 창 인쇄 — 고른 원본(「채울 원본」·대체 원본)으로, 빈 양식 인쇄는 한글 원본 먼저
   ⓓ 공단 지사 — 「고객센터」는 지사가 아니다 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const CF = require('../js/pu-form-cardfill.js');
const SRC = read('js/pu-contract-forms.js');

test('ⓐ 18MB — PDF 만 빼고, 첫 서류만 남기지 않는다', () => {
  const a = SRC.indexOf('function send() {'), m = SRC.slice(a, SRC.indexOf('var m = el(', a));
  assert.doesNotMatch(m, /fs = fs\.slice\(0, 1\)/, '묶음 나머지를 버리지 않는다');
  assert.match(m, /pdfCk\.checked && fs\.length > 1 && fs\[fs\.length - 1\]\.name === pdfName\(\) \? fs\.slice\(0, -1\)/);
  assert.match(m, /noPdf && left <= MAX && w\.confirm/, 'PDF 를 빼도 넘으면 묻지 않고 막는다');
  assert.match(m, /서류를 나눠 보내 주세요/);
});

test('ⓑ 공단 주소 → 기관 이름, 서명본 대기 아님', () => {
  assert.equal(CF.agencyOrgOf('Kim1@KCOMWEL.or.kr '), '근로복지공단');
  assert.equal(CF.agencyOrgOf('a@nhis.or.kr'), '국민건강보험공단');
  assert.equal(CF.agencyOrgOf('a@nps.or.kr'), '국민연금공단');
  assert.equal(CF.agencyOrgOf('test@example.com'), '');
  assert.equal(CF.agencyOrgOf(''), '');
  const a = SRC.indexOf('function after(fs, how) {'), m = SRC.slice(a, a + 1500);
  assert.match(m, /var ag = CF\.agencyOrgOf \? CF\.agencyOrgOf\(toAddr\(\)\) : ''/);
  assert.match(m, /who: ag \|\| V\.담당자 \|\| '', await: !ag/);
});

test('ⓒ 인쇄 — 고른 원본으로', () => {
  assert.match(SRC, /function fillForPrint\(fm, V, host, src\) \{\n    var CF = w\.PuFormCardFill;\n    src = src \|\| printSrc\(fm\);/);
  assert.match(SRC, /function printSrc\(fm\) \{ var l = hwpSources\(fm \|\| \{\}\); return l\.filter\(function \(s\) \{ return !isXlsxName\(s\.name\); \}\)\[0\] \|\| l\[0\] \|\| null; \}/);
  assert.match(SRC, /function printForms\(fms, V, host, title, onStep, srcs\)[\s\S]{0,300}fillForPrint\(fm, V, host, srcs && srcs\[i\]\)/);
  const a = SRC.indexOf('function doPrint() {'), m = SRC.slice(a, SRC.indexOf('function copyText()', a));
  assert.match(m, /items\.map\(function \(x\) \{ return x\.src; \}\)/, '채우기 창이 고른 원본을 넘긴다');
});

test('ⓓ 공단 지사 — 고객센터는 건너뛴다', () => {
  const b = JSON.parse(JSON.stringify(CF.agencyBook([
    { e: 'kim1@kcomwel.or.kr', f: '김가나', d: 2, s: '근로복지공단 고객센터 안내', p: '천안지사 가입지원부입니다' },
    { e: 'lee2@kcomwel.or.kr', f: '이다라', d: 1, s: '고객센터', p: '' }])));
  assert.deepStrictEqual(b.map((x) => [x.email, x.branch]), [['kim1@kcomwel.or.kr', '천안지사'], ['lee2@kcomwel.or.kr', '']]);
});
