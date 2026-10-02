'use strict';
/* ⑤ 지원금 여덟(필요서류·지원신청서·복지사업계획서·재산목록표·지급신청서·자율체크리스트·출연확인서·서약서)의
 * 원본 한글 틀 값 — _hwpSubValues (2026-09-27 「계속」). HTML 지원금 서식과 같은 곳(_docRok 장부·목적사업,
 * f.years[yr].subsidy, 연도별 출연금)에서 온다. 틀은 저장소에 없다. 이름·금액은 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const gV = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('=', i); k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) return SRC.slice(i, SRC.indexOf(';', k) + 1); } } };

const A = (() => {
  const box = {};
  new Function([
    'var S={year:2026, formFund:"X", _docR:null};',
    'function num(v){ if(v===""||v==null) return ""; var n=Number(String(v).replace(/,/g,"")); return isFinite(n)?n:""; }',
    gV('_KOR_D'), gV('_KOR_P'), gV('_KOR_U'), gF('korWon'),
    gF('_officersOf'), gF('_boss'), gF('_dotDate'), gF('_hwpKoDate'), gF('_hwpKoDate2'), gF('_hwpTodayIso'), gF('_dashPhone'),
    gF('_docRok'), gV('SUB_ROWS'), gF('subAmounts'), gV('DOC_NEEDS_LEDGER'), gF('_hwpSubValues'), gV('HWP_TPL_KINDS'),
    /* 2026-09-29 체크리스트 「특수관계인 해당여부」 — 특수관계 점검 판정을 함께 싣는다 */
    gF('_siteUrep'), gF('_siteWrep'), gF('_relNm'), gF('_relAddrKey'), gF('_relAddrMask'), gF('relatedPeople'), gF('relatedScan'), gF('_relKey'), gF('_relJudge'),
    'this.sub=_hwpSubValues; this.S=S; this.K=HWP_TPL_KINDS;',
  ].join('\n')).call(box);
  return box;
})();

const F = { _id: 'X', name: '가나다공동근로복지기금', fund_type: '공동', chairman: '홍길동', inka_no: '7210-2026-1',
  inka_date: '2026-04-10', region: '서울', corp_reg_no: '110171-0000000',
  officers: [{ role: '이사장', name: '홍길동' }], years: { 2026: { subsidy: { request_amount: 30000000, decided_amount: 20000000 } } } };
const SITES = [
  { _id: 's1', name: '가나기계 주식회사', ceo: '김대표', company_size: 120, biz_type: '제조업', status: 'active' },
  { _id: 's2', name: '다라전자 주식회사', ceo: '이대표', company_size: 40, biz_type: '제조업', status: 'active' },
  { _id: 's3', name: '문닫은 주식회사', ceo: '박대표', company_size: 9, status: 'closed' },
];
const DOCR = { fid: 'X', yr: 2026, R: { run: { deposit: 30000000, trust: 0, secu: 0, own: 0, reit: 0, etc: 0, loan: 10000000 }, bfEnd: 40000000 },
  fin: { totalAssets: 52000000 }, sy: { s1: { contrib: 50000000 }, s2: { contrib: 0 } },
  welf: [{ name: '경조사비 지원', category: '경조사비', budget: 6000000, beneficiaries: 160 },
    { name: '체육대회', category: '체육문화비', budget: 4000000 }, { name: '주택자금 대부', category: '대부사업', budget: 10000000 }] };

test('여덟 다 한글 틀 목록에 있고 값 함수는 _hwpSubValues', () => {
  const VAL = gV('HWP_TPL_VALUES');
  ['sub_required', 'subsidy', 'sub_welfare_plan', 'sub_assets', 'sub_payment', 'sub_checklist', 'sub_contrib', 'sub_oath'].forEach((k) => {
    assert.equal(A.K[k], '공동', k); assert.match(VAL, new RegExp(k + ':_hwpSubValues[,}]'), k);
  });
  assert.match(SRC, /fn\(x\.f,sites\|\|\[\],kind\)/, '값 함수에 서식 종류를 넘긴다(서식별 안내)');
});

test('★ 복지사업계획서 — 대부는 빼고, 개요 표는 원본처럼 천원 단위, 세부계획은 사업마다', () => {
  A.S._docR = DOCR;
  const v = A.sub(F, SITES, 'sub_welfare_plan');
  assert.equal(v.총지출, '10,000원', '600만+400만 = 1,000만원 = 10,000천원(대부 1,000만원은 자산이라 뺀다)');
  assert.equal(v.항목6, '4,000원'); assert.equal(v.항목8, '6,000원', '경조사비는 기타 사업비');
  assert.equal(v.항목1, '원');
  assert.equal(v.사업.length, 2);
  assert.deepEqual([v.사업[0].대상인원, v.사업[0].소요금액, v.사업[0].산출근거], ['160명', '6,000,000원', '160명 × 37,500원']);
  assert.equal(v.사업[1].산출근거, '', '인원을 모르면 산출근거를 지어내지 않는다');
});

test('★ 재산목록표 — 기본재산은 운용 방법별(짧은 이름), 보통재산 = 자산 - 기본재산, 줄 다섯에 맞춘다', () => {
  A.S._docR = DOCR;
  const v = A.sub(F, SITES, 'sub_assets');
  assert.deepEqual(v.기본종류, ['현금', '대부', ' ', ' ', ' ']);
  assert.deepEqual(v.기본금액.slice(0, 2), ['30,000,000', '10,000,000']);
  assert.deepEqual(v.기본구분.slice(0, 2), ['보통예금', '근로자대부']);
  assert.equal(v.기본계, '40,000,000'); assert.equal(v.보통금액, '12,000,000'); assert.equal(v.재산합계, '52,000,000');
  assert.ok(!v._note, '합계가 맞으면 안내 없음');
});

test('출연확인서 — 그 해 출연한 곳만 한 장씩(한글·숫자 나란히), 문 닫은 곳은 뺀다', () => {
  A.S._docR = DOCR;
  const v = A.sub(F, SITES, 'sub_contrib');
  assert.deepEqual(v.확인서, [{ 회사: '가나기계 주식회사', 대표이사: '김대표', 금액한글: '오천만', 금액숫자: '50,000,000' }]);
  const none = A.sub(F, SITES.slice(1), 'sub_contrib');
  assert.deepEqual(none.확인서, []); assert.match(none._note, /출연한 사업장이 없어/);
});

test('지급신청서·체크리스트·지원신청서 — 그 해 지원금 기록과 사업장에서', () => {
  A.S._docR = DOCR;
  const p = A.sub(F, SITES, 'sub_payment');
  assert.deepEqual([p.결정액, p.받은액, p.남은액], ['20,000,000', '0', '20,000,000']);
  assert.match(p._note, /계좌는 통장을 보고/);
  const c = A.sub(F, SITES, 'sub_checklist');
  assert.equal(c.참여회사, '가나기계 주식회사, 다라전자 주식회사');
  assert.equal(c.업종, '제조업', '같은 업종은 한 번'); assert.equal(c.근로자수, '160명');
  assert.equal(c.기금규모, '40,000'); assert.equal(c.출연금액, '50,000,000'); assert.equal(c.신청금액2, '30,000,000');
  assert.equal(c.인가일, '2026. 4. 10.');
  assert.match(c._note, /착안사항/);
  assert.equal(A.sub(F, SITES, 'subsidy').지원신청금액, '30,000,000원');
});

test('★ 장부를 못 읽었으면(남의 기금·다른 해) 숫자를 비우고, 장부가 필요 없는 서식엔 그 안내를 안 띄운다', () => {
  A.S._docR = Object.assign({}, DOCR, { fid: 'OTHER' });
  const v = A.sub(F, SITES, 'sub_assets');
  assert.equal(v.기본계, ''); assert.deepEqual(v.기본종류, [' ', ' ', ' ', ' ', ' ']); assert.match(v._note, /못 읽어/);
  assert.ok(!A.sub(F, SITES, 'sub_oath')._note, '서약서는 장부가 필요 없다');
  assert.equal(A.sub(F, SITES, 'sub_oath').인가번호, '7210-2026-1');
});
