'use strict';
/* ① 인가 나머지 넷(설립인가신청서·설립합의서·정관·기금출연확인서)의 원본 한글 틀 값 (2026-09-26 「계속」)
 * 값은 HTML 서식이 쓰던 같은 곳(FORM_FILL·fillCommittee·fillFoundContribDoc·_fillWho)에서 온다.
 * 틀(.hwpx)은 저장소에 없다 — «이름 → 값»만 본다. 이름·금액·생년월일은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const gV = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('=', i); k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) return SRC.slice(i, SRC.indexOf(';', k) + 1); } } };
const gS = (n) => { const m = SRC.match(new RegExp('var ' + n + '=[^\\n]*?;')); assert.ok(m, '없음 ' + n); return m[0]; };

const A = (() => {
  const box = {};
  new Function([
    'var S={year:2026, formFund:"X", _docR:null};',
    'function num(v){ if(v===""||v==null) return ""; var n=Number(String(v).replace(/,/g,"")); return isFinite(n)?n:""; }',
    gV('_KOR_D'), gV('_KOR_P'), gV('_KOR_U'), gF('korWon'), gS('COMMITTEE_ROWS'),
    gF('_officersOf'), gF('_boss'), gF('_siteWrep'), gF('_siteUrep'), gF('_isCommittee'), gF('_siteCommittee'), gF('_prepCommittee'),
    gF('_cmSeeAnnex'), gF('estabSites'), gF('siteContribOf'), gF('_docRok'), gF('siteContribNow'), gF('partyNames'), gF('partyJoin'),
    gF('_dotDate'), gF('_hwpKoDate'), gF('_hwpTodayIso'), gF('_hwpSignRows'),
    gF('_hwpInkaValues'), gF('_hwpAgreementValues'), gF('_hwpCharterValues'), gF('_hwpContribValues'),
    gV('HWP_TPL_KINDS'), gV('HWP_TPL_STRICT'), gF('_hwpTplFits'),
    'this.inka=_hwpInkaValues; this.agr=_hwpAgreementValues; this.charter=_hwpCharterValues; this.contrib=_hwpContribValues;',
    'this.fits=_hwpTplFits; this.S=S;',
  ].join('\n')).call(box);
  return box;
})();

const F = { _id: 'X', name: '가나다공동근로복지기금', fund_type: '공동', chairman: '홍길동', phone: '02-123-4567',
  address: '서울특별시 종로구 세종대로 1길 11', labor_office: '서울지방고용노동청', meeting_date: '2026-03-02',
  officers: [{ role: '이사장', name: '홍길동', birth: '1970.01.01.', addr: '서울 종로구 가상로 1', title: '이사장' }] };
const SITES = [
  { _id: 's1', name: '가나기계 주식회사', ceo: '김대표', wrep_name: '박근로', wrep_birth: '1980.02.02', wrep_title: '과장', urep_same: true, contrib: 100000000 },
  { _id: 's2', name: '다라전자 주식회사', ceo: '', urep_name: '이사용', wrep_name: '최근로', contrib: 0 },
];

test('인가신청서 — 대표자는 이사장(명부)에서, 체크는 기금 유형대로, 신청일은 오늘', () => {
  const v = A.inka(F, SITES);
  assert.equal(v.대표자, '홍길동'); assert.equal(v.대표자생년월일, '1970.01.01.'); assert.equal(v.대표자직책, '이사장');
  assert.equal(v.공동표, '[ V]'); assert.equal(v.사내표, '[  ]');
  const s = A.inka(Object.assign({}, F, { fund_type: '사내' }), SITES);
  assert.equal(s.사내표, '[ V]'); assert.equal(s.공동표, '[  ]');
  assert.match(v.신청일, new RegExp('^' + new Date().getFullYear() + '년'));
  assert.equal(v.관할노동청, '서울지방고용노동청');
});

test('★ 인가신청서 위원 격자 — 사업장 대표가 위원(HTML fillCommittee 와 같은 명단), 없는 줄은 «빈 칸», 있는 사람의 모르는 값만 밑줄', () => {
  const v = A.inka(F, SITES);
  assert.equal(v.근측1성명, '박근로'); assert.equal(v.근측1생년월일, '1980.02.02'); assert.equal(v.근측1직책, '과장');
  assert.equal(v.근측2성명, '최근로'); assert.equal(v.근측2생년월일, '', '있는 사람의 모르는 값 → 밑줄');
  assert.equal(v.근측3성명, ' ', '없는 줄은 공백 — 밑줄로 채우면 격자가 원본과 달라진다');
  assert.equal(v.사측2성명, '이사용', '대표자가 없으면 사용자대표');
});

test('★★ 위원이 격자(3줄)를 넘치면 첫 칸에 「별지 명단과 같음」만 — 짧게(좁은 칸이 두 줄로 꺾였다), 사람 수는 안내로', () => {
  const many = [1, 2, 3, 4].map((i) => ({ _id: 'm' + i, name: '회사' + i, ceo: '대표' + i, wrep_name: '근로' + i, urep_same: true }));
  const v = A.inka(F, many);
  assert.equal(v.근측1성명, '별지 명단과 같음');
  assert.equal(v.근측2성명, ' '); assert.equal(v.근측1생년월일, ' ');
  assert.match(v._note, /근로자측 위원 4명/);
});

test('설립합의서 — 참여회사 이어 쓰기·회의일(본문과 끝 날짜가 같은 날)·위원 수는 양쪽이 같을 때만·서명은 회사마다', () => {
  const v = A.agr(F, SITES);
  assert.equal(v.참여회사, '가나기계 주식회사 및 다라전자 주식회사');
  assert.equal(v.회의일, '2026. 3. 2.'); assert.equal(v.합의일, '2026 년 03 월 02 일');
  assert.equal(v.위원수, '2');
  assert.deepEqual(v.서명, [{ 회사: '가나기계 주식회사', 근로자대표: '박근로', 대표이사: '김대표' },
    { 회사: '다라전자 주식회사', 근로자대표: '최근로', 대표이사: '이사용' }]);
  assert.equal(A.agr(Object.assign({}, F, { meeting_date: '' }), SITES).합의일, '', '회의일을 모르면 비운다');
});

test('정관 — 인가 전에는 원본처럼 빈 날짜 줄, 인가일이 있으면 그 날 · 정관일은 회의일', () => {
  assert.equal(A.charter(F, SITES).인가일.trim(), '년    월    일');
  assert.equal(A.charter(Object.assign({}, F, { inka_date: '2026-05-20' }), SITES).인가일, '2026년    5월    20일');
  assert.equal(A.charter(F, SITES).정관일, '2026년     3월    2일');
});

test('★ 정관 틀은 «같은 유형»에만 — 사내 정관은 아예 다른 문서라 HTML 로 둔다', () => {
  assert.equal(A.fits('charter', F), true);
  assert.equal(A.fits('charter', { fund_type: '사내' }), false);
  assert.equal(A.fits('inka', { fund_type: '사내' }), true, '인가신청서는 체크로 두 유형을 다 받는다');
});

test('★★ 출연확인서 — 사업장마다 한 장, 금액은 siteContribNow(그 해 출연금 우선) · 없으면 비우고 알린다', () => {
  const v = A.contrib(F, SITES);
  assert.equal(v.확인서.length, 2);
  assert.equal(v.확인서[0].금액한글, '일억원정'); assert.equal(v.확인서[0].금액숫자, '100,000,000');
  assert.equal(v.확인서[1].금액숫자, '', '금액을 지어내지 않는다');
  assert.equal(v.확인서[1].대표이사, '이사용');
  assert.match(v._note, /2곳 중 1곳/);
  A.S._docR = { fid: 'X', yr: 2026, sy: { s2: { contrib: 50000000 } } };
  assert.equal(A.contrib(F, SITES).확인서[1].금액숫자, '50,000,000', '연도별 기록의 그 해 출연금이 첫째 근거');
  A.S._docR = null;
});
