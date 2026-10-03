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
    gF('_cmOver'), gF('_cmAnnexNeeded'), gF('_cmToAnnex'), gF('isRegionFund'), gF('_cmPairRows'), gF('_hwpInkaAnnexValues'),
    gF('_hwpInkaValues'), gF('_hwpAgreementValues'), gF('_hwpCharterValues'), gF('_hwpContribValues'),
    gV('HWP_TPL_KINDS'), gV('HWP_TPL_STRICT'), gF('_dkKeyOf'), gF('_hwpTplKey'), gF('_hwpTplFits'),
    gS('GRID_BLANK'), gF('_hwpCharterSaneValues'),
    'this.inka=_hwpInkaValues; this.agr=_hwpAgreementValues; this.charter=_hwpCharterValues; this.contrib=_hwpContribValues;',
    'this.sane=_hwpCharterSaneValues; this.key=_hwpTplKey;',
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
  assert.match(v._note, /근로자측 4명/);
  /* 2026-10-03 별지는 인가신청서 «다음 쪽»에 — 넣을지(참/거짓)와 명단을 같은 값에 싣는다 */
  assert.equal(v.별지명단, true, '★ 넘치는데 별지를 안 붙인다');
  /* 2026-10-03 A안 — 사업장마다 한 줄(근로자측 왼쪽·사용자측 오른쪽): 네 회사 → 네 줄, 여덟 사람 */
  assert.equal(v.위원.length, 4, '★ 사업장마다 한 줄이 아니다');
  assert.deepEqual(v.위원.map((r) => [r.소속, r.근성명, r.사성명]), [1, 2, 3, 4].map((i) => ['회사' + i, '근로' + i, '대표' + i]),
    '★ 같은 회사의 근로자측·사용자측이 한 줄에 마주 보지 않는다');
});

test('★★ 지역공동기금은 위원이 적어도 늘 별지 — 격자에는 「별지 명단과 같음」, 명단은 다음 쪽', () => {
  const one = [{ _id: 'm1', name: '회사1', ceo: '대표1', wrep_name: '근로1', urep_same: true }];
  const region = Object.assign({}, F, { fund_type: '공동', region: '○○' });
  const v = A.inka(region, one);
  assert.equal(v.별지명단, true, '★ 지역공동기금인데 별지를 안 붙인다(대표 지시 2026-10-03)');
  assert.equal(v.근측1성명, '별지 명단과 같음');
  assert.ok(v.위원.some((r) => r.근성명 === '근로1'));
  const plain = Object.assign({}, F, { fund_type: '공동', region: '' });
  const w = A.inka(plain, one);
  assert.equal(w.별지명단, false, '지역이 아닌 공동기금은 격자에 들어가면 별지 없이');
  assert.notEqual(w.근측1성명, '별지 명단과 같음');
  assert.deepEqual(w.위원, [], '별지를 안 붙이면 명단 값도 비운다');
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

test('★ 정관 틀은 기금 유형으로 고른다 — 공동은 charter, 사내는 charter_sane(서식 이름은 「정관」 하나)', () => {
  assert.equal(A.fits('charter', F), true);
  assert.equal(A.key('charter', F), 'charter');
  assert.equal(A.key('charter', { fund_type: '사내' }), 'charter_sane');
  assert.equal(A.key('inka', { fund_type: '사내' }), 'inka', '정관 말고는 틀이 하나');
  assert.equal(A.fits('charter', { fund_type: '사내' }), true, '사내 정관도 사내 원본 틀로 받는다');
  assert.equal(A.fits('inka', { fund_type: '사내' }), true, '인가신청서는 체크로 두 유형을 다 받는다');
});

const SANE = Object.assign({}, F, { name: '가나기계사내근로복지기금', fund_type: '사내' });
test('★★ 사내 정관 — 첫 줄은 서식이 부르는 사람(근로자대표·대표이사), 나머지 위원은 짝지어 한 줄씩 (HTML fillSignGrid 와 같다)', () => {
  const v = A.sane(SANE, [SITES[0]]);
  assert.equal(v.기금명, '가나기계사내근로복지기금'); assert.equal(v.참여회사, '가나기계 주식회사');
  assert.equal(v.근대표, '박근로'); assert.equal(v.대표이사, '김대표');
  assert.equal(v.서명, 0, '남는 위원이 없으면 격자 줄을 모두 지운다 — 없는 사람의 날인란이 관청에 간다');
  assert.equal(v.인가일.trim(), '년    월    일');
  assert.equal(v.정관일, '2026년 3월 2일');
  const more = Object.assign({}, SANE, { officers: F.officers.concat([
    { role: '근로자측 이사', name: '정위원', title: '대리' }, { role: '근로자측 이사', name: '한위원', title: '주임' },
    { role: '사용자측 이사', name: '오위원', title: '상무' }]) });
  const w = A.sane(more, [SITES[0]]);
  assert.ok(Array.isArray(w.서명) && w.서명.length === 2, '나머지 위원 수(근로자측 둘)만큼 줄');
  assert.deepEqual(w.서명.map((r) => r.근이름), ['정위원', '한위원'], '첫 줄에 선 근로자대표는 다음 줄에 다시 나오지 않는다');
  assert.equal(w.서명[0].사이름, '오위원'); assert.equal(w.서명[0].사직책, '상무');
  assert.match(w.서명[1].사이름, /^＿+$/, '한쪽이 비면 밑줄 — 이름을 지어내지 않는다');
  assert.equal(w.근대표, '박근로'); assert.equal(w.대표이사, '김대표');
});

test('사내 정관 — 사람을 하나도 모르면 첫 줄도 밑줄(자리표가 틀린 이름보다 낫다)', () => {
  const v = A.sane({ name: '가', fund_type: '사내' }, []);
  assert.match(v.근대표, /^＿+$/); assert.match(v.대표이사, /^＿+$/); assert.equal(v.서명, 0);
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

/* ── [별지] 설립준비위원회 위원 명단 — 한글로도 (2026-09-27 「계속」) ── */
test('★ 별지 명단 — 사업장마다 한 줄, 근로자측 왼쪽·사용자측 오른쪽(2026-10-03 A안), 모르는 칸은 빈칸, 인원수', () => {
  const box = {};
  new Function(['var S={year:2026};', gS('COMMITTEE_ROWS'), gF('_officersOf'), gF('_boss'), gF('_siteWrep'), gF('_siteUrep'),
    gF('_isCommittee'), gF('_siteCommittee'), gF('_prepCommittee'), gF('estabSites'), gF('_cmPairRows'), gF('_hwpInkaAnnexValues'),
    'this.ax=_hwpInkaAnnexValues; this.pair=_cmPairRows;'].join(String.fromCharCode(10))).call(box);
  const v = box.ax(F, SITES);
  assert.equal(v.기금명, F.name);
  assert.deepEqual(v.위원.map((r) => r.순번), v.위원.map((r, i) => String(i + 1)), '번호는 줄마다 1부터');
  const 가나 = v.위원.find((r) => /가나기계/.test(r.소속));
  assert.ok(가나 && 가나.근성명 === '박근로' && 가나.사성명 === '김대표', '★ 같은 회사가 한 줄에 마주 보지 않는다: ' + JSON.stringify(가나));
  assert.ok(v.위원.every((r) => ['소속', '근성명', '근생년월일', '근직책', '사성명', '사생년월일', '사직책'].every((k) => typeof r[k] === 'string' && r[k].length > 0)),
    '빈 값은 밑줄이 아니라 빈칸(" ")');
  assert.ok(!('번호' in v.위원[0]), '엔진이 매기는 {{번호}}(전체 차례)와 겹치지 않게 순번');
  /* 짝짓기 — (주)·㈜·주식회사·빈칸은 같은 회사, 한쪽뿐이면 반대편 빈칸, 한 회사 두 사람은 줄을 더 연다, 소속 없는 사람끼리는 순서대로 */
  const f = { prep_committee: [
    { side: '근로자측', name: '홍길동', company: '(주)가나' }, { side: '근로자측', name: '김철수', company: '다라' },
    { side: '근로자측', name: '최민수', company: '다라' }, { side: '근로자측', name: '무소속근' },
    { side: '사용자측', name: '이담당', company: '가나 주식회사' }, { side: '사용자측', name: '박영희', company: '다라' },
    { side: '사용자측', name: '정수진', company: '마바' }, { side: '사용자측', name: '무소속사' }] };
  const rows = box.pair(f, []).map((r) => [r.co, r.w && r.w.name, r.u && r.u.name]);
  assert.deepEqual(rows, [['(주)가나', '홍길동', '이담당'], ['다라', '김철수', '박영희'], ['다라', '최민수', undefined],
    ['', '무소속근', '무소속사'], ['마바', undefined, '정수진']]);
  assert.equal(box.ax(f, []).근로자측수, '4'); assert.equal(box.ax(f, []).사용자측수, '4');
});

test('★ 별지 배선 — 인가신청서 미리보기의 [⬇ 별지 명단] · 묶음 ZIP 에 인가신청서 바로 뒤', () => {
  const sp = gF('hwpSidePreview');
  /* 2026-10-03 인가신청서 틀 안에 별지가 들어간 뒤로는(r.opts.별지명단) 따로 받는 단추·따로 넣는 파일이 없다 —
     같은 명단이 두 번 나간다. 옛 틀(별지가 없는 것)일 때만 따로 */
  assert.match(sp, /kind==='inka'&&!\('별지명단' in \(r\.opts\|\|\{\}\)\)&&\(S\._hwpTplHas\|\|\{\}\)\.inka_annex&&_cmAnnexNeeded\(f,S\._hwpSideSites\|\|\[\]\)/);
  assert.match(sp, /hwpAnnexDownload\(\)/);
  const bu = gF('estabBundleHwp');
  assert.match(bu, /u\.d\[0\]==='inka'&&!\('별지명단' in \(res\.opts\|\|\{\}\)\)&&\(S\._hwpTplHas\|\|\{\}\)\.inka_annex&&_cmAnnexNeeded\(f,sites\)/);
  assert.match(bu, /-1\. \[별지\] 설립준비위원회 위원 명단\.hwpx/);
  assert.match(gF('hwpAnnexDownload'), /hwpTplFill\('inka_annex',f,sites\)/);
});
