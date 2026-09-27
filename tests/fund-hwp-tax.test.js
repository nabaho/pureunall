'use strict';
/* ③ 고유번호증 넷(법인설립신고·사업자등록신청서, 부동산 전대 사용동의서, 임대차계약서, 홈택스 이용신청서)의
 * 원본 한글 틀 값 — _hwpTaxValues (2026-09-27 「계속」). HTML fillDerived 의 tax_* 규칙과 같은 곳에서 온다.
 * 틀은 저장소에 없다. 이름·번호·주소는 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const gV = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('=', i); k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) return SRC.slice(i, SRC.indexOf(';', k) + 1); } } };
const gS = (n) => { const m = SRC.match(new RegExp('var ' + n + '=[^\n]*?;')); assert.ok(m, '없음 ' + n); return m[0]; };

const A = (() => {
  const box = {};
  new Function([
    'var S={year:2026, formFund:"X", _docR:null};',
    'function num(v){ if(v===""||v==null) return ""; var n=Number(String(v).replace(/,/g,"")); return isFinite(n)?n:""; }',
    SRC.match(/var _K=[^\n]*/)[0], gF('_officersOf'), gF('_boss'), gF('estabSites'), gF('siteContribOf'), gF('foundContribOf'), gF('foundContrib'),
    gF('_hwpKoDate'), gF('_hwpKoDate2'), gF('_hwpTodayIso'), gF('_dashPhone'), gF('_hwpTaxValues'), gV('HWP_TPL_KINDS'),
    'this.tax=_hwpTaxValues; this.K=HWP_TPL_KINDS; this.today=_hwpTodayIso;',
  ].join('\n')).call(box);
  return box;
})();

const F = { _id: 'X', name: '가나다공동근로복지기금', fund_type: '공동', chairman: '홍길동', phone: '02-123-4567',
  address: '서울특별시 종로구 세종대로 1길 11', corp_reg_no: '110171-0000000', tax_id_no: '123-82-00000',
  lease_lessor: '가나기계 주식회사', lease_from: '2026-05-01', lease_deposit: '0',
  officers: [{ role: '이사장', name: '홍길동', addr: '서울 종로구 가상로 1' }] };
const SITES = [
  { _id: 's1', name: '가나기계 주식회사', contrib: 100000000, company_size: 120, status: 'active' },
  { _id: 's2', name: '다라전자 주식회사', contrib: 20000000, company_size: '30', status: 'active' },
];

test('넷 다 한글 틀 목록에 있고 값 함수는 _hwpTaxValues', () => {
  const VAL = gV('HWP_TPL_VALUES');
  ['tax_bizreg', 'tax_sublease', 'tax_lease', 'tax_hometax'].forEach((k) => {
    assert.equal(A.K[k], '공동', k); assert.match(VAL, new RegExp(k + ':_hwpTaxValues[,}]'), k);
  });
});

test('사업자등록신청서 — 자본금·재무상황=설립 출연금(천원), 종업원수=상시근로자 합, 임대차 기간=시작일부터 2년', () => {
  const v = A.tax(F, SITES);
  assert.equal(v.자본금, '120,000천원'); assert.equal(v.자산, '120,000천원');
  assert.equal(v.종업원수, '150명');
  assert.equal(v.임대기간, '2026. 05. 01. ~ 2028. 04. 30. ');
  assert.equal(v.보증금, '0원', '적어 둔 값은 0 이라도 넣는다');
  assert.equal(v.월세, '원', '안 적었으면 비운다 — 0원인지 우리는 모른다');
  assert.equal(v.법인등록번호, '110171-0000000'); assert.equal(v.고유번호, '123-82-00000'); assert.equal(v.사업연도, '2026');
});

test('임대차계약서 — 임대인·임차 소재지·계약일(시작일), 모르면 손으로 적을 자리', () => {
  const v = A.tax(F, SITES);
  assert.equal(v.임대인, '가나기계 주식회사'); assert.equal(v.임차주소, F.address, '임차 소재지를 안 적었으면 기금 소재지');
  assert.equal(v.임대시작, '2026년 05월 01일'); assert.equal(v.계약일, '2026년 05월 01일');
  const e = A.tax(Object.assign({}, F, { lease_from: '', lease_addr: '서울 중구 가상로 9' }), []);
  assert.equal(e.임대시작.trim(), '년    월    일'); assert.equal(e.임차주소, '서울 중구 가상로 9');
  assert.equal(e.임대기간.replace(/\s/g, ''), '...~...', '시작일이 없으면 점만 남긴 빈 기간');
  assert.equal(e.자본금, '천원'); assert.equal(e.종업원수, '명');
  assert.match(e.계약일, /^\d{4}년 \d{2}월 \d{2}일$/, '시작일이 없으면 오늘');
});

test('★ 주민등록번호·홈택스 아이디·비밀번호는 어떤 값에도 없다', () => {
  const f = Object.assign({}, F, { officers: [{ role: '이사장', name: '홍길동', rrn: '700101-1234567' }], hometax_id: 'abc', hometax_pw: 'x' });
  const s = JSON.stringify(A.tax(f, SITES));
  assert.ok(!/\d{6}-\d{7}/.test(s.replace('110171-0000000', '')), s);
  assert.ok(!/abc|"x"/.test(s));
});
