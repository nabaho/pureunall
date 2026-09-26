'use strict';
/* ② 법인설립 여덟 가지(설립등기신청서·취임승낙서·협의회 명부·인감신고서·인감대지·인감카드·위임장·등록면허세)의
 * 원본 한글 틀 값 — _hwpRegValues (2026-09-26 「계속」). 값은 HTML 등기 서식이 쓰던 같은 곳에서 온다
 * (_boss·_prepDirectors·_prepCommittee·foundContrib·registry_office). 틀은 저장소에 없다. 이름·주소는 가짜. */
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
    gS('COMMITTEE_ROWS'), gF('_officersOf'), gF('_boss'), gF('_siteWrep'), gF('_siteUrep'), gF('_isCommittee'), gF('_siteCommittee'),
    gF('_prepCommittee'), gF('estabSites'), gF('siteContribOf'), gF('foundContribOf'), gF('foundContrib'),
    gF('_hwpKoDate'), gF('_hwpKoDate2'), gF('_hwpTodayIso'), gF('_dashPhone'), gF('_prepDirectors'), gF('_hwpRegValues'),
    gV('HWP_TPL_KINDS'), gV('FTYPE_SKIP'), gF('ftypeSkipDoc'),
    'this.reg=_hwpRegValues; this.K=HWP_TPL_KINDS; this.skip=ftypeSkipDoc;',
  ].join('\n')).call(box);
  return box;
})();

const F = { _id: 'X', name: '가나다공동근로복지기금', fund_type: '공동', chairman: '홍길동', phone: '02-123-4567',
  address: '서울특별시 종로구 세종대로 1길 11', meeting_date: '2026-03-02', inka_date: '2026-04-10', registry_office: '서울중앙지방법원 등기국',
  officers: [{ role: '이사장', name: '홍길동', addr: '서울 종로구 가상로 1' }, { role: '근로자측 주임이사', name: '박노측', addr: '수원 가상구 2' },
    { role: '사용자측 이사', name: '최사측' }, { role: '감사', name: '정감사' }] };
const SITES = [
  { _id: 's1', name: '가나기계 주식회사', ceo: '김대표', wrep_name: '박근로', urep_same: true, contrib: 100000000, status: 'active' },
  { _id: 's2', name: '다라전자 주식회사', ceo: '이대표', wrep_name: '최근로', urep_same: true, contrib: 20000000, status: 'active' },
];

test('여덟 가지가 다 한글 틀 목록에 있고 값 함수는 하나(_hwpRegValues)', () => {
  const kinds = ['reg_apply', 'reg_accept', 'reg_roster', 'reg_seal', 'reg_sealpaper', 'reg_sealcard', 'reg_proxy', 'reg_license'];
  const VAL = gV('HWP_TPL_VALUES');
  kinds.forEach((k) => { assert.equal(A.K[k], '공동', k); assert.match(VAL, new RegExp(k + ':_hwpRegValues[,}]'), k); });
});

test('기금·대표 이사·등기소·기본재산 — HTML 등기 서식과 같은 곳에서', () => {
  const v = A.reg(F, SITES);
  assert.equal(v.기금명, F.name); assert.equal(v.기금소재지, F.address); assert.equal(v.전화, '02-123-4567');
  assert.equal(v.대표자, '홍길동'); assert.equal(v.대표자주소, '서울 종로구 가상로 1');
  assert.equal(v.등기소, '서울중앙지방법원 등기국');
  assert.equal(v.기본재산, (120000000).toLocaleString(), '기본재산 = 설립 출연금 합(foundContrib)');
  assert.equal(v.인가도달일, '2026년   04월  10일'); assert.equal(v.선임일, '2026년  3월  2일');
});

test('★ 이사 목록 — 대표 이사는 따로(첫 칸), 나머지 이사만 반복 · 감사는 이사가 아니다', () => {
  const v = A.reg(F, SITES);
  assert.deepEqual(v.이사, [{ 이름: '박노측', 주소: '수원 가상구 2' }, { 이름: '최사측', 주소: '' }]);
  assert.deepEqual(v.승낙, [{ 이름: '박노측' }, { 이름: '최사측' }], '취임승낙서 둘째 장 — 이사마다 한 장');
});

test('★ 주민등록번호는 어떤 값에도 없다 — 틀의 자리표(______-_______)가 그대로 나간다', () => {
  const f = Object.assign({}, F, { officers: F.officers.map((o) => Object.assign({ rrn: '700101-1234567' }, o)) });
  const s = JSON.stringify(A.reg(f, SITES));
  assert.ok(!/\d{6}-\d{7}/.test(s), s);
});

test('명부 — 위원 줄과 여유 빈 줄(합쳐 여섯 줄), 많으면 빈 줄·여백을 걷는다', () => {
  const v = A.reg(F, SITES.slice(0, 1));
  assert.equal(v.근로자위원.length + v.사용자위원.length + v.빈줄, 6);
  assert.equal(v.여백, 1);
  const many = A.reg(F, SITES.concat([{ _id: 's3', name: '마바', ceo: '박대표', wrep_name: '정근로', urep_same: true, status: 'active' },
    { _id: 's4', name: '사아', ceo: '오대표', wrep_name: '한근로', urep_same: true, status: 'active' }]));
  assert.ok(many.근로자위원.length + many.사용자위원.length > 6);
  assert.equal(many.빈줄, 0); assert.equal(many.여백, 0);
});

test('날짜를 모르면(인가 전) 손으로 적을 「년 월 일」 자리 · 등기소를 모르면 빈칸 자리', () => {
  const v = A.reg(Object.assign({}, F, { inka_date: '', meeting_date: '', registry_office: '' }), SITES);
  [v.인가도달일, v.설립인가일, v.선임일, v.명부일].forEach((d) => assert.equal(d.trim(), '년    월    일'));
  assert.match(v.등기소, /^\s+지방법원\s+등기소$/);
  assert.equal(v.기본재산, (120000000).toLocaleString());
});

test('등기 서식은 공동/사내 말을 기금 유형 쪽으로 바꾼다(ftypeSkipDoc 아님) — 등록면허세의 「사내근로복지기금법인」', () => {
  ['reg_apply', 'reg_accept', 'reg_roster', 'reg_license'].forEach((k) => assert.ok(!A.skip(k), k));
});
