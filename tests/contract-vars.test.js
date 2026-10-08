'use strict';
/* 계약 자료 → 채울 값 (설계 2026-10-03-계약서류-표준-기록 §4) — 이알피와 문서관리가 «같은 한 벌»을 쓴다.
   ⓐ js/pu-contract-vars.js 의 contractVars 가 이알피 fillContractVars 가 내던 값과 «글자 하나까지» 같다
     (아래 기대값은 옮기기 전 이알피 fillContractVars 를 가짜 계약으로 돌려 받아 적은 것 — 2026-10-03)
   ⓑ 이알피 fillContractVars 는 이제 PuContractVars 를 부른다(두 벌 금지)
   ⓒ 가짜 자료만 — 실제 고객·근로자 이름 금지 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const V = require('../js/pu-contract-vars.js');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const U = fs.readFileSync(path.join(R, 'js/utils.js'), 'utf8').replace(/\r\n/g, '\n');
const korMoney = (function () { const box = {}; new Function('box', U.slice(U.indexOf('function numToKorMoney'), U.indexOf('\n}\n', U.indexOf('function numToKorMoney')) + 2) + '\nbox.f = numToKorMoney;')(box); return box.f; })();

const COMPANIES = [
  { id: 'co1', name: '가나상사(주)', bizNo: '123-45-67890', ceo: '김대표', ceo2: '', address: '충남 천안시 가나로 1', zipcode: '31000',
    phone: '041-000-0000', fax: '041-000-0001', email: 'ceo@example.com', bizType: '제조', bizCategory: '부품', companySize: '소기업',
    employmentInsuredCount: 12, injuryInsuredCount: 13, taxInvoicePaymentDay: '25', pensionNo: '12345678901', healthNo: '1234567',
    employmentNo: '12345678900', injuryNo: '12345678901-0', corpRegNo: '110111-0000000', ceoBirth: '19700101', ceoGender: '1',
    contacts: [{ name: '박담당', phone: '010-0000-0000', email: 'park@example.com', isPrimary: true }],
    workers: [{ name: '홍길동', position: '사원', address: '천안시 다라로 2', phone: '010-1111-1111', rrn: '900101-1234567', isPrimary: true },
              { name: '이몽룡', rrn: '9102021234567' }] }
];
const USERS = [{ sid: 'P001', name: '권노무' }, { sid: 'P002', name: '최노무' }, { sid: 'P003', name: '정노무' }];
const CONTRACT = { id: 'ct1', contractNo: 'C-2026-001', companyId: 'co1', companyName: '가나상사(주)', company: { bizNo: '123-45-67890', name: '가나상사(주)' },
  signDate: '2026-10-01', startDate: '2026-10-01', endDate: '2027-09-30', vatType: 'inclusive', kinds: ['company', 'case'],
  amounts: { company: 440000, case: 1100000 }, successFee: 10, successFeeType: 'percent', managerMain: 'P001', managerSubs: ['P002', 'PX', 'P003'] };
const ctx = () => ({ companies: COMPANIES, users: USERS, korMoney, today: '2026-10-03',
  findCompany: (it) => COMPANIES.find(c => c.id === it.companyId) || null });

/* 옮기기 전 이알피 fillContractVars 가 이 가짜 계약으로 낸 값(⓪ 머리글 참고) */
const GOLD = {
  회사명: '가나상사(주)', 사업자번호: '123-45-67890', 대표자: '김대표', 주소: '충남 천안시 가나로 1', 우편번호: '31000',
  대표전화: '041-000-0000', 대표팩스: '041-000-0001', 대표이메일: 'ceo@example.com', 업태: '제조', 종목: '부품', 규모: '소기업',
  고용가입자수: '12', 산재가입자수: '13', 담당자: '박담당', 담당자연락처: '010-0000-0000', 담당자이메일: 'park@example.com',
  계약번호: 'C-2026-001', 계약일: '2026-10-01', 계약시작일: '2026-10-01', 계약종료일: '2027-09-30', 계약기간: '2026-10-01 ~ 2027-09-30',
  부가세처리: '부가세 포함', 납부일: '25', 국민연금관리번호: '12345678901', 건강보험번호: '1234567', 고용보험번호: '12345678900',
  산재관리번호: '12345678901-0', 법인등록번호: '110111-0000000', 대표생년월일: '19700101', 대표자전체: '김대표', 대표주민번호: '700101-1******',
  계약금액: '1,540,000', 성공보수: '10%', 주담당: '권노무', 부담당: '최노무, 정노무', 오늘날짜: '2026-10-03',
  근로자수: '2', 근로자이름: '홍길동', 근로자명단: '홍길동, 이몽룡', 근로자주민: '900101-1******', 근로자주소: '천안시 다라로 2', 근로자연락처: '010-1111-1111',
  근로자상세: '1. 홍길동 (사원) / 주소: 천안시 다라로 2 / 연락처: 010-1111-1111 / 주민번호: 900101-1******\n2. 이몽룡 / 주민번호: 910202-1******'
};

test('ⓐ contractVars — 옮기기 전 이알피 값과 같다', () => {
  const m = V.contractVars(CONTRACT, ctx());
  Object.keys(GOLD).forEach(k => assert.strictEqual(m[k], GOLD[k], k));
  assert.strictEqual(m.계약금액한글, korMoney(1540000));
  assert.deepStrictEqual(Object.keys(m).sort(), Object.keys(GOLD).concat(['계약금액한글']).sort(), '칸 목록이 달라졌습니다');
});
test('ⓐ 빈 계약·별도 부가세·정액 성공보수·금액 하나', () => {
  const m = V.contractVars({ contractAmount: 1000000, vatType: 'exclusive', successFee: 300000, successFeeType: 'fixed', signDate: '2026-01-02' },
    { companies: [], users: [], korMoney, today: '2026-10-03' });
  assert.strictEqual(m.계약금액, '1,000,000');
  assert.strictEqual(m.부가세처리, '부가세 별도');
  assert.strictEqual(m.성공보수, '300,000원');
  assert.strictEqual(m.계약기간, '2026-01-02');
  assert.strictEqual(m.근로자수, '0');
  assert.strictEqual(m.회사명, '');
});
test('ⓑ 이알피 fillContractVars 는 PuContractVars 를 부르고, 같은 판을 싣는다', () => {
  const f = cutFn(stripJs(ERP), 'function fillContractVars(');
  assert.match(f, /PuContractVars\.contractVars\(/);
  assert.ok(!/maskRRN|numToKorMoney\(totalAmount\)/.test(f), '이알피에 옛 계산이 남아 있습니다 — 두 벌이 됩니다');
  assert.match(ERP, /<script src="js\/pu-contract-vars\.js\?v=\d+"><\/script>/);
});

/* 2026-10-08 — 업체관리는 법인등록번호를 corpNo 에 둔다(업체 69곳). 계약 스냅샷 corpRegNo 가 비면 corpNo 를 읽는다 */
test('ⓓ 법인등록번호 — 업체관리 corpNo 도 읽고 000000-0000000 으로', () => {
  const cos = [{ id: 'cx', name: '마바(주)', bizNo: '123-00-00009', corpNo: '1101110000009' }];
  const find = (it) => cos.filter((x) => x.id === it.companyId)[0] || null;
  const base = { id: 'c9', companyId: 'cx', companyName: '마바(주)', company: { bizNo: '123-00-00009', name: '마바(주)' }, kinds: ['company'] };
  assert.strictEqual(V.contractVars(base, { companies: cos }).법인등록번호, '110111-0000009', '사업자번호로 찾은 업체의 corpNo');
  assert.strictEqual(V.contractVars(base, { findCompany: find }).법인등록번호, '110111-0000009', '업체 찾기로 합친 corpNo');
  const snap = Object.assign({}, base, { company: Object.assign({}, base.company, { corpRegNo: '110111-1111111' }) });
  assert.strictEqual(V.contractVars(snap, { companies: cos, findCompany: find }).법인등록번호, '110111-1111111', '계약에 적은 값이 먼저');
  assert.strictEqual(V.contractVars({ company: { corpRegNo: '미등록' } }, {}).법인등록번호, '미등록', '13자리가 아니면 그대로');
});
