'use strict';
/* 계약서 성공보수 비율(%) 자동 당겨오기·확인·출력 서식 치환 규칙 검증
   - 괄호 안 비율·전각 ％·퍼센트·백분의 N·할/푼·지연이자(연 12%) 분리 파싱
   - 사진첩 계약서 찾기(erpContractPhotoApplyPatch)·자동 수집(processPhotoContractRequest)·메일 수집기(mailContractSweep) % 자동 반영
   - 계약서 출력(fillContractVars)·계약서등관리 묶음 채우기(CONTRACT_WINS) {{성공보수율}}·{{착수금}} 자동 치환 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
require('../js/pu-doc-read.js');
const DOC_READ = globalThis.PuDocRead;
const CONTRACT_VARS = require('../js/pu-contract-vars.js');
const SWEEP = require('../functions/mail-contract-sweep.js');

const plain = (v) => JSON.parse(JSON.stringify(v));

test('① erpParseSuccessFee — 다양한 계약서 % 표기를 비율(percent)로 읽고 부가세·지연이자 %와 혼동하지 않는다', () => {
  const ctx = { String, Number, parseInt, parseFloat, Math };
  vm.createContext(ctx);
  vm.runInContext(
    cutFn(ERP, 'function erpParseContractMoney(') + '\n' +
    cutFn(ERP, 'function erpParseSuccessFee(') + '\nthis.parse = erpParseSuccessFee;',
    ctx
  );
  const parse = ctx.parse;

  assert.deepEqual(plain(parse('총 수령금의 15%(부가세포함)')), { type: 'percent', fee: 15 });
  assert.deepEqual(plain(parse('성공보수 (승소금액의 15%)')), { type: 'percent', fee: 15 }, '괄호 안에 적힌 성공보수율도 놓치지 않는다');
  assert.deepEqual(plain(parse('결정 급여액의 7.5％')), { type: 'percent', fee: 7.5 }, '전각 ％ 및 소수점 요율 지원');
  assert.deepEqual(plain(parse('인용 금액의 10퍼센트')), { type: 'percent', fee: 10 }, '한글 퍼센트 표기 지원');
  assert.deepEqual(plain(parse('경제적 이익의 백분의 20')), { type: 'percent', fee: 20 }, '백분의 N 표기 지원');
  assert.deepEqual(plain(parse('수령금의 1할 5푼')), { type: 'percent', fee: 15 }, '할·푼 표기 지원');
  assert.deepEqual(plain(parse('15')), { type: 'percent', fee: 15 }, '원·만 단위 없는 단독 요율 숫자는 비율로 판정');
  assert.deepEqual(plain(parse('총 수령금의 15% (미지급 시 7일 경과 후부터 연 12%의 이자)')), { type: 'percent', fee: 15 }, '지연이자 연 12%가 아닌 본문 성공보수율을 읽는다');
  assert.deepEqual(plain(parse('금 3,300,000원 (부가세 10% 별도)')), { type: 'amount', fee: 3300000 }, '부가세 10%를 성공보수율로 오인하지 않는다');
});

test('② erpContractPhotoApplyPatch — 계약서 찾기에서 착수금과 성공보수 %를 자동으로 당겨오고 미리보기 확인 줄을 만든다', () => {
  const ctx = { String, Object, Array, Number, parseInt, BRIEF_MAX: 40 };
  vm.createContext(ctx);
  const cmsAt = ERP.indexOf('var ERP_CMS_WORDS =');
  vm.runInContext(
    ERP.slice(cmsAt, ERP.indexOf('];', cmsAt) + 2) + '\n' +
    cutFn(ERP, 'function erpDocText(') + '\n' +
    cutFn(ERP, 'function erpCmsFromDoc(') + '\n' +
    cutFn(ERP, 'function erpVatTextToFlag(') + '\n' +
    cutFn(ERP, 'function erpTypeNameTidy(') + '\n' +
    cutFn(ERP, 'function erpNameRun(') + '\n' +
    cutFn(ERP, 'function erpConsTypeByDocName(') + '\n' +
    cutFn(ERP, 'function erpContractPhotoApplyPatch('),
    ctx
  );
  const apply = ctx.erpContractPhotoApplyPatch;

  const baseCase = { amounts: { case: 0 }, briefs: { case: '' }, company: { name: '가나수산' } };
  const rCase = apply({
    retainer: '1,650,000원',
    success: '총 수령금의 15%(부가세포함)',
    scope: '체불임금 진정 사건 대리',
    vat: '포함'
  }, 'case', baseCase);

  assert.equal(rCase.patch.amounts.case, 1650000, '사건 계약 착수금 자동 반영');
  assert.equal(rCase.patch.successFee, 15, '사건 계약 성공보수 % 숫자 반영');
  assert.equal(rCase.patch.successFeeType, 'percent', '성공보수 단위가 자동으로 % 모드로 전환');
  assert.equal(rCase.patch.balanceFeeVatIncluded, true, '성공보수 원문의 부가세포함 여부도 반영');
  assert.ok(rCase.previewLines.some((l) => /성공보수 15%/.test(l)), '확인 창에 당겨온 %를 명시');

  const rPairs = apply({
    pairs: [{ k: '성공보수율', v: '수령액의 12.5%' }]
  }, 'case', baseCase);
  assert.equal(rPairs.patch.successFee, 12.5, 'pairs 에만 담긴 성공보수율도 당겨온다');
  assert.equal(rPairs.patch.successFeeType, 'percent');
});

test('③ PuDocRead.healRead — 계약서 판독 pairs 의 성공보수율·성과보수를 fields.success 로 되메운다', () => {
  const readObj = {
    kind: 'contract',
    fields: {
      company: '다라산업',
      success: '',
      retainer: '',
      pairs: [
        { k: '착수보수', v: '금 1,100,000원' },
        { k: '성공보수율(제3조)', v: '총 수령금의 15%' }
      ]
    }
  };
  DOC_READ.healRead(readObj);
  assert.equal(readObj.fields.retainer, '금 1,100,000원');
  assert.equal(readObj.fields.success, '총 수령금의 15%');
});

test('④ mailContractSweep.extractContractFeesFromText — 약정서 본문에서 착수금과 성공보수 %를 추출하고 지연이자는 배제한다', () => {
  const sample = [
    '위 임 약 정 서',
    '제2조[보수] ① 본인은 사건처리를 위임함에 있어 착수금으로 금 1,650,000원(부가세포함)을 선지급한다.',
    '제3조[성공보수] ① 사건처리결과 성공한 때에는 총 수령금의 15%(부가세포함)을 성공보수로 지급한다.',
    '제9조[성공보수 미지급시] 금품을 지급받은 다음날로부터 7일 후부터 연 12%의 이자를 지급한다.'
  ].join('\n');
  const fees = SWEEP.extractContractFeesFromText(sample);
  assert.match(fees.retainer, /1,650,000원/);
  assert.match(fees.success, /^15%/);
  assert.equal(fees.vat, '부가세 포함');
});

test('⑤ fillContractVars — 계약서 출력 시 {{성공보수}}와 {{성공보수율}}·{{착수금}}·{{근로자명}}에 %와 금액이 자동 치환된다', () => {
  const ctx = {
    PuContractVars: CONTRACT_VARS,
    CompanyRef: { findCompany: () => null },
    dbGet: () => [],
    USERS_SEED: [],
    numToKorMoney: () => '일백육십오만',
    todayYMD: () => '2026-11-24'
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(ERP, 'function fillContractVars(') + '\nthis.fill = fillContractVars;', ctx);

  const contract = {
    contractNo: '계약-2026-900',
    companyName: '가나수산',
    company: {
      name: '가나수산',
      workers: [{ name: '홍길동', rrn: '900101-1234567', isPrimary: true }]
    },
    kinds: ['case'],
    amounts: { case: 1650000 },
    successFee: 15,
    successFeeType: 'percent',
    vatType: 'inclusive',
    signDate: '2026-11-24'
  };
  const tpl = '위임인 {{근로자명}}({{주민번호}}) / 착수금 금 {{착수금}}원 / 성공보수 총 수령금의 {{성공보수율}} ({{성공보수}})';
  const rendered = ctx.fill(tpl, contract);
  assert.ok(!/\{\{/.test(rendered), '치환되지 않은 {{토큰}}이 남지 않아야 한다: ' + rendered);
  assert.match(rendered, /홍길동/);
  assert.match(rendered, /1,650,000원/);
  assert.match(rendered, /총 수령금의 15% \(15%\)/);
});

test('⑥ 계약 창·출력 창 UI — 원 모드에서 % 입력 자동 전환 및 출력 미리보기 확인 바가 갖춰져 있다', () => {
  const modalSrc = stripJs(cutFn(ERP, 'function ContractModal(props)'));
  assert.match(modalSrc, /onPercentDetected/, '원 모드 입력칸에 15%를 치면 % 모드로 즉시 전환한다');
  assert.match(modalSrc, /%로 전환/, '100 이하 원 단위 오입력 시 원클릭 % 전환 배지를 띄운다');
  const printBody = stripJs(cutFn(ERP, 'function ContractFormPrintBody(props)'));
  assert.match(printBody, /자동 당겨온 조건/, '계약서 출력 모달 상단에 자동 당겨온 착수금·성공보수율 확인 바를 표시한다');
  assert.match(printBody, /치환 결과 확인/, '실제 %가 치환된 계약서 본문을 인쇄 전에 바로 확인할 수 있다');
});
