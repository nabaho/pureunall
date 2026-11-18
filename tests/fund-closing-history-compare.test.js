'use strict';
/* 과거 결산·운영상황보고서(별지 제15호)·사업계획서 백데이터 복원 호환 및 연도별 비교 검증
 * ⚠ 공개 저장소 규칙: 실기금명·실상호·실인명·실금액 절대 사용 금지 — 오직 가상 테스트 데이터만 사용.
 * node --test tests/fund-closing-history-compare.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + name);
}

function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('끝을 못 찾음: ' + name);
}

const B = (() => {
  const box = {};
  new Function([
    'var S={fundId:"FUND-T1",year:2025,ysFor:"FUND-T1",ys:null,ysMode:"fin",ysUnit:"k",cb:{}};',
    'var funds={"FUND-T1":{name:"가상공동근로복지기금",short_name:"가상공동",fund_type:"공동",reg_date:"2019-06-01",labor_office:"○○지방고용노동청",years:{}}};',
    'function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}',
    'function num(v){if(v==null||v==="")return 0;var n=+String(v).replace(/,/g,"");return isNaN(n)?0:n;}',
    'function _n(v){return Math.round(num(v)||0).toLocaleString("en-US");}',
    'function _nz(v){var x=Math.round(num(v)||0);return x?x.toLocaleString("en-US"):"—";}',
    'function _k1000(n){return Math.round((n||0)/1000);}',
    'function _retLabel(v){return (num(v)||0)<0?"이월결손금":"이월잉여금";}',
    'function hlp(k){return "<i data-h=\\""+k+"\\"></i>";}',
    'function loadingHTML(){return "...";}',
    'function _ckTh(){return "<th class=\\"ckcol\\"><input type=\\"checkbox\\"></th>";}',
    'function _ckTd(){return "<td class=\\"ckcol\\"><input type=\\"checkbox\\"></td>";}',
    'function scrubStockPii(s){return String(s||"");}',
    'function loadYearSeries(){return !!S.ys;}',
    grabDecl('PURPOSE_ACCTS'),
    grabDecl('ADMIN_ACCTS'),
    grabDecl('RESERVE_ACCTS'),
    grabDecl('F15_ROWS'),
    grabDecl('YS_ROWS'),
    grabDecl('ARCHIVE_DOC_KINDS'),
    'var ARCHIVE_EXT_RE=/\\.(pdf|hwp|hwpx|xlsx|xls|docx|csv)$/i;',
    grabFn('hasStockRawRrn'),
    grabFn('_safeArchiveKey'),
    grabFn('_activeArchiveDocs'),
    grabFn('_safeArchiveMails'),
    grabFn('_f15n'),
    grabFn('_f15date'),
    grabFn('_f15to'),
    grabFn('fundYearsOf'),
    grabFn('stmtBS'),
    grabFn('stmtIS'),
    grabFn('stmtRE'),
    grabFn('stmtChk'),
    grabFn('finFromSnap'),
    grabFn('f15FromSnap'),
    grabFn('f15Pages'),
    grabFn('buildF15CompareRows'),
    grabFn('buildPlanCompareRows'),
    grabFn('checkF15Chain'),
    grabFn('_ysYearTh'),
    grabFn('yearsView'),
    grabFn('archiveYearBarHTML'),
    grabFn('checkArchiveDocSafe'),
    grabFn('guessArchiveDocKind'),
    grabFn('_extractArchiveTextForCheck'),
    'this.S=S; this.funds=funds; this.fundYearsOf=fundYearsOf;',
    'this.finFromSnap=finFromSnap; this.stmtBS=stmtBS; this.stmtIS=stmtIS; this.stmtRE=stmtRE; this.stmtChk=stmtChk;',
    'this.f15FromSnap=f15FromSnap; this.f15Pages=f15Pages;',
    'this.buildF15CompareRows=buildF15CompareRows; this.buildPlanCompareRows=buildPlanCompareRows; this.checkF15Chain=checkF15Chain;',
    'this.yearsView=yearsView; this.archiveYearBarHTML=archiveYearBarHTML;',
    'this._safeArchiveKey=_safeArchiveKey; this._activeArchiveDocs=_activeArchiveDocs;',
    'this.checkArchiveDocSafe=checkArchiveDocSafe; this.guessArchiveDocKind=guessArchiveDocKind; this._extractArchiveTextForCheck=_extractArchiveTextForCheck;',
  ].join('\n')).call(box);
  return box;
})();

test('1. fundYearsOf — 설립등기일·과거 결산 스냅샷·사업계획 연도를 빠짐없이 포함한다', () => {
  B.funds['FUND-T1'].reg_date = '2018-05-10';
  B.funds['FUND-T1'].years = { 2018: { budget: { exp_purpose: 10000000 } } };
  const ys = B.fundYearsOf('FUND-T1', { 2018: { locked: true }, 2019: { locked: true } }, false);
  assert.ok(ys.includes(2018) && ys.includes(2019), '2018·2019 과거 연도가 포함되어야 한다');
  assert.ok(ys[0] > ys[ys.length - 1], '최신 연도부터 내림차순 정렬');
});

test('2. finFromSnap — 분개 없는 과거 스냅샷에서 허위 세부 계정을 지어내지 않고 대분류 재무제표를 정합하게 구성한다', () => {
  const snap = {
    cash: 80000000, savings: 20000000, loan: 0, secu: 50000000, otherAsset: 0,
    assets: 150000000, res1: 1000000, res2: 38000000, liab: 40000000,
    basic: 110000000, retained: 0, equity: 110000000, liabEq: 150000000,
    revenue: 1000000, purpose: 20000000, admin: 500000, nonopRev: 20500000, otherExp: 1000000, net: 0, txn_n: 0
  };
  const fin = B.finFromSnap(snap, { retained: 0 });
  assert.equal(fin.balanced, true);
  assert.deepEqual(fin.tb, {}, '스냅샷에 없는 세부 계정명을 지어내지 않는다');
  assert.deepEqual(B.stmtChk(fin), []);
  const bs = B.stmtBS(fin, B.finFromSnap({}));
  assert.equal(bs.find((r) => r.lbl === 'Ⅰ. 유동부채').cur, 1000000, 'liab - (res1+res2) = 유동부채 1,000,000원');
  assert.equal(bs.find((r) => r.lbl === '자 산 총 계').cur, 150000000);
  assert.equal(bs.find((r) => r.lbl === '부채와 자본총계').cur, 150000000);
});

test('3. f15FromSnap + f15Pages + buildF15CompareRows — 천원 저장 항목(⑪·71·74)과 원 저장 항목의 단위가 화면·비교표에서 100% 일치한다', () => {
  const snap = {
    cash: 60000000, savings: 0, loan: 10000000, secu: 0, assets: 70000000,
    liab: 20000000, basic: 50000000, retained: 0, equity: 50000000, liabEq: 70000000,
    revenue: 500000, purpose: 30000000, admin: 1000000, otherExp: 500000, net: 0,
    has_f15: true, capital: 5000, sel_amt: 8000, estate_amt: 0,
    bf_open: 30000000, contrib_employer: 40000000, contrib_other: 10000000,
    bf_use: 30000000, bf_end: 50000000,
    run_deposit: 50000000, run_loan: 10000000, run_total: 60000000,
    f15_src_income: 500000, f15_src_contrib: 30000000, f15_src_carry: 20000000, f15_src_total: 50500000,
    f15_sub_amt: 30000000, benef: 25, loan_amt: 10000000, loan_benef: 2,
    f15_admin: 1000000, f15_rest: 19500000, f15_total: 60500000,
    f15_items: { 60: { amt: 10000000, cnt: 5 }, 66: { amt: 20000000, cnt: 20 } }
  };
  const R = B.f15FromSnap(snap, 'FUND-T1', 2023, {}, []);
  assert.equal(R.ratio, 50, 'buildF15 기본 비율(50)과 일치');
  assert.equal(R.head.capital, 5000);
  assert.equal(R.sel.amt, 8000);
  const P = B.f15Pages(R);
  assert.match(P.p1, /5,000/, '⑪ 납입자본금 5,000천원');
  assert.match(P.p1, /20,000/, '㉞ 이월금 20,000천원');

  const rowsK = B.buildF15CompareRows([2023], { 2023: { fin: snap } }, 'k');
  const rowsWon = B.buildF15CompareRows([2023], { 2023: { fin: snap } }, 'won');
  assert.deepEqual(rowsK.find((r) => !r.sec && r.lbl.includes('⑪')).vals, [5000]);
  assert.deepEqual(rowsWon.find((r) => !r.sec && r.lbl.includes('⑪')).vals, [5000000]);
  assert.deepEqual(rowsK.find((r) => !r.sec && r.lbl.startsWith('71.')).vals, [8000]);
  assert.deepEqual(rowsWon.find((r) => !r.sec && r.lbl.startsWith('71.')).vals, [8000000]);
});

test('4. checkF15Chain — 인접 연도(y-1 → y)만 대조하며 bf_open 미상 시 거짓 일치 배지를 띄우지 않는다', () => {
  // (a) 중간 연도(2020)가 비어 있는 비인접 쌍(2019, 2021)은 비교하지 않아 거짓 경고가 없다
  const gap = B.checkF15Chain([2019, 2021], {
    2019: { fin: { bf_end: 100000000 } },
    2021: { fin: { bf_open: 150000000, bf_end: 200000000 } }
  });
  assert.equal(gap.checked, 0);
  assert.deepEqual(gap.issues, []);

  // (b) bf_open 이 없는 해는 checked=0 이라 거짓 안심 배지가 뜨지 않는다
  const noOpen = B.checkF15Chain([2022, 2023], {
    2022: { fin: { basic: 100000000 } },
    2023: { fin: { basic: 900000000 } }
  });
  assert.equal(noOpen.checked, 0);

  // (c) 인접 연도에서 실제로 어긋나면 정확히 잡아낸다
  const bad = B.checkF15Chain([2022, 2023], {
    2022: { fin: { bf_end: 40000000 } },
    2023: { fin: { bf_open: 55000000, bf_end: 80000000 } }
  });
  assert.equal(bad.checked, 1);
  assert.equal(bad.issues.length, 1);
});

test('5. yearsView · XSS 차단 · 무덤 표식(_deleted) · 마감연도 삭제 버튼 숨김 · 로딩 중 가드', () => {
  // 로딩 중(S.ys === null)일 때 TypeError 없이 로딩 화면 반환
  B.S.ys = null;
  assert.match(B.yearsView(), /\.\.\./);

  const xssKey = "d'1\"><img src=x onerror=alert(1)>";
  const D = {
    2022: {
      locked: true,
      fin: { assets: 100000000, basic: 40000000, bf_open: 0, contrib_employer: 100000000, bf_use: 60000000, bf_end: 40000000, purpose: 20000000, f15_sub_amt: 20000000, benef: 15, admin: 500000, f15_rest: 39500000, f15_total: 60000000 },
      archive_docs: {
        d1: { name: '2022_결산서_운영상황보고서.pdf', kind: 'closing_report', kind_label: '결산·운영상황보고서', ext: '.pdf', size: 204800 },
        d_del: { name: '삭제된초안.pdf', kind: 'closing_report', ext: '.pdf', size: 1024, _deleted: true },
        [xssKey]: { name: '악성키.pdf', kind: 'closing_report', ext: '.pdf', size: 1024 }
      },
      archive_mails: { m1: { date_str: '2023-03-15', subject: '2022년도 결산서 송부', from: '담당자', att_names: ['결산서.pdf'] } }
    },
    2023: {
      locked: true,
      fin: { assets: 120000000, basic: 60000000, bf_open: 40000000, contrib_employer: 50000000, bf_use: 30000000, bf_end: 60000000, purpose: 25000000, f15_sub_amt: 25000000, benef: 20, admin: 500000, f15_rest: 44000000, f15_total: 69500000 },
      archive_docs: {},
      archive_mails: {}
    }
  };
  B.funds['FUND-T1'].years = {
    2022: { budget: { rev_contrib: 100000000, exp_purpose: 25000000, exp_admin: 1000000 } },
    2023: { budget: { rev_contrib: 50000000, exp_purpose: 25000000, exp_admin: 1000000 } }
  };
  B.S.ys = { years: [2023, 2022], data: D, cl: D };
  B.S.ysMode = 'f15';
  const htmlF15 = B.yearsView();
  assert.match(htmlF15, /연속성 일치 확인됨/);
  assert.match(htmlF15, /ysJumpYear\(2022,'f15'\)/, '연도 머리글 버튼이 해당 연도 화면으로 이동');

  B.S.ysMode = 'plan';
  const htmlPlan = B.yearsView();
  assert.match(htmlPlan, /2022_결산서_운영상황보고서\.pdf/);
  assert.doesNotMatch(htmlPlan, /삭제된초안\.pdf/, '무덤 표식(_deleted) 문서는 표시되지 않는다');
  assert.doesNotMatch(htmlPlan, /onerror=alert/, '비정상 RTDB 키는 렌더링에서 원천 차단된다');
  assert.doesNotMatch(htmlPlan, /deleteArchiveDoc\('FUND-T1',2022/, '확정(locked) 연도 서류에는 삭제 단추를 노출하지 않는다');
});

test('6. checkArchiveDocSafe — 확장자 허용목록·파일명 주민번호·하이픈 없는 주민번호 차단', () => {
  assert.equal(B.checkArchiveDocSafe('악성스크립트.html', '').ok, false, '허용 외 확장자 차단');
  assert.equal(B.checkArchiveDocSafe('홍길동_인감증명서.pdf', '').ok, false);
  assert.equal(B.checkArchiveDocSafe('문서_900101-1234567.pdf', '').ok, false, '파일명 내 주민번호 차단');
  assert.equal(B.checkArchiveDocSafe('접수증.csv', '성명 홍길동 9001011234567').ok, false, '하이픈 없는 13자리 주민번호 차단');
  assert.equal(B.checkArchiveDocSafe('2025년_결산서 및 사업계획서.xlsx', '').ok, true);
  assert.equal(B.guessArchiveDocKind('2025년 사업계획서(안).hwp')[0], 'business_plan');
});

test('7. _extractArchiveTextForCheck — 판독기 부재·손상 파일 시 fail-open 없이 거부하고 구형 HWP는 unreadable 로 표시한다', async () => {
  await assert.rejects(() => B._extractArchiveTextForCheck('손상.xlsx', new Uint8Array([1, 2, 3])), /점검 실패|미지원/);
  await assert.rejects(() => B._extractArchiveTextForCheck('문서.pdf', new Uint8Array([1, 2, 3])), /PDF 판독 모듈/);
  const hwpRes = await B._extractArchiveTextForCheck('사업계획서.hwp', new Uint8Array([0xd0, 0xcf]));
  assert.equal(hwpRes.status, 'unreadable');
  const csvRes = await B._extractArchiveTextForCheck('예산표.csv', new TextEncoder().encode('항목,금액\n장학금,1000000'));
  assert.equal(csvRes.status, 'ok');
  assert.match(csvRes.text, /장학금/);
});
