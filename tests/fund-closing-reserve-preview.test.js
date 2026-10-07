'use strict';
/* 결산 조정(준비금2 설정·환입)을 «확정 전에도» 재무제표에 얹는다 — 결손이 나면 안 된다
 * 대표 지시 2026-10-06: 「사내기금 또는 공동기금에는 고유목적사업준비금2는 항상 기업등에서 출연한 금액에서
 *   최대 사용할 수 있는 금액 80% 또는 90%로 한다 그리고 기금에는 결손이 나서 손해가 있으면 안된다」
 * 전에는 설정·환입 분개가 [🔒 결산 확정] 때만 장부에 적혀, 확정 전 재무제표가 목적사업비만큼 결손으로 보였다.
 * 그리고 사내기금은 중소기업 여부가 비어 있으면 50%로 셈했다(사내 기금이 모두 비어 있었다).
 *
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금 이름·금액은 전부 지어낸 것이다.
 * node --test tests/fund-closing-reserve-preview.test.js */
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
  throw new Error('함수 끝을 못 찾음: ' + name);
}
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  const eq = SRC.indexOf('=', i), c0 = SRC[eq + 1];
  if (c0 !== '{' && c0 !== '[') return SRC.slice(i, SRC.indexOf(';', i) + 1);
  let d = 0, on = false;
  for (let j = eq; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('상수 끝을 못 찾음: ' + name);
}

const B = (() => {
  const box = {};
  new Function([
    grabDecl('ACCT_CHART'), grabDecl('PURPOSE_ACCTS'), grabDecl('OPEN_ACCT'), grabDecl('ADMIN_ACCTS'),
    grabDecl('RESERVE_ACCTS'), grabDecl('RSV_AUTO_ID'),
    'var funds={}, S={fundId:"F1", year:2025};',
    grabFn('num'),
    grabFn('acctType'), grabFn('isDrAcct'), grabFn('_openingOf'), grabFn('_splitsOf'), grabFn('expandSplits'),
    grabFn('journalOf'), grabFn('acctMoves'), grabFn('openingMoves'), grabFn('tbRowsOf'), grabFn('computeFin'),
    grabFn('useRate'), grabFn('_reserveRate'), grabFn('_contribOf'), grabFn('_rsvSwapOf'), grabFn('_rsvRoles'),
    grabFn('_reserveAcct'), grabFn('reserveAdjust'), grabFn('_reserveEntry'), grabFn('_reserveEntries'),
    grabFn('_rsvIsAuto'), grabFn('_rsvWhtOf'), grabFn('_whtEntry'), grabFn('closeArr'),
    'this.funds=funds; this.useRate=useRate; this.computeFin=computeFin; this.closeArr=closeArr;',
    'this.reserveAdjust=reserveAdjust; this.isAuto=_rsvIsAuto;',
  ].join('\n')).call(box);
  return box;
})();

/* 가짜 사내기금 첫해 — 출연 5천만, 목적사업 700만 + 관리비 80만, 이자 9,520 */
const TX = [
  { _id: 'a1', date: '2025-02-03', memo: '가나기계 출연', deposit: 50000000, debit: '현금성자산', credit: '기본재산', approved: true },
  { _id: 'a2', date: '2025-05-02', memo: '체육대회', withdraw: 7000000, debit: '체육문화비', credit: '현금성자산', approved: true },
  { _id: 'a3', date: '2025-06-30', memo: '수수료', withdraw: 800000, debit: '지급수수료', credit: '현금성자산', approved: true },
  { _id: 'a4', date: '2025-12-20', memo: '결산이자', deposit: 9520, debit: '현금성자산', credit: '이자수익', approved: true },
];
const fresh = (fund) => { Object.keys(B.funds).forEach((k) => delete B.funds[k]); B.funds.F1 = fund; };

test('★★ 사내기금 사용한도는 80% — 중소기업 여부가 비어 있어도(「중소기업 아님」만 50%)', () => {
  assert.equal(B.useRate({ fund_type: '사내' }), 0.8);
  assert.equal(B.useRate({ fund_type: '사내', sme: '중소기업' }), 0.8);
  assert.equal(B.useRate({ fund_type: '사내', sme: '중소기업 아님' }), 0.5);
  assert.equal(B.useRate({ fund_type: '공동' }), 0.9);
});

test('★★ 확정 전에도 결손이 없다 — 준비금2 설정(출연 × 80%)과 환입이 얹혀 당기순이익 0', () => {
  fresh({ fund_type: '사내', years: {} });
  const raw = B.computeFin(TX, 'F1', 2025);
  assert.ok(raw.net < 0, '조정 전에는 손실로 보인다(이것이 고칠 대상)');
  const arrC = B.closeArr(TX, 'F1', 2025);
  const f = B.computeFin(arrC, 'F1', 2025);
  assert.equal(Math.round(f.net), 0, '당기순이익 0');
  assert.equal(Math.round(f.retained), 0, '결손금이 남지 않는다');
  assert.equal(Math.round(f.basic), 10000000, '기본재산 = 출연 × 20%');
  assert.equal(Math.round(f.res2), 50000000 * 0.8 - (7800000 - 9520), '준비금2 = 설정 4천만 − 환입');
  assert.ok(f.balanced, '대차 일치');
  assert.ok(arrC.filter((x) => x._pending).length >= 3, '설정·환입·이자 준비금 분개가 미리 얹혔다');
  assert.ok(arrC.every((x) => !x._pending || B.isAuto(x)), '얹은 분개는 확정 때 쓰는 자리(id)와 같다');
});

test('★ 원본 배열은 건드리지 않는다 — 장부 표는 통장 그대로', () => {
  fresh({ fund_type: '사내', years: {} });
  const before = JSON.stringify(TX);
  B.closeArr(TX, 'F1', 2025);
  assert.equal(JSON.stringify(TX), before);
});

test('★★ 이미 확정한 해(자동 분개가 장부에 있음)는 두 번 얹지 않는다', () => {
  fresh({ fund_type: '사내', years: {} });
  const arrC = B.closeArr(TX, 'F1', 2025);
  const saved = arrC.map((x) => { const o = Object.assign({}, x); delete o._pending; return o; });
  const again = B.closeArr(saved, 'F1', 2025);
  assert.equal(again, saved, '그대로 돌려준다');
  assert.equal(Math.round(B.computeFin(again, 'F1', 2025).net), 0);
});

test('준비금 자동조정을 끈 기금은 손대지 않는다', () => {
  fresh({ fund_type: '사내', years: { 2025: { reserve_auto: false } } });
  assert.equal(B.closeArr(TX, 'F1', 2025), TX);
});

test('★ 협의회가 정한 설정액이 있으면 그것을 쓴다', () => {
  fresh({ fund_type: '사내', years: { 2025: { reserve_setup: 20000000 } } });
  const f = B.computeFin(B.closeArr(TX, 'F1', 2025), 'F1', 2025);
  assert.equal(Math.round(f.basic), 30000000);
  assert.equal(Math.round(f.net), 0);
});

test('재원이 정말 모자라면(사용한도를 넘은 지출) 결손으로 남고, 알린다', () => {
  fresh({ fund_type: '사내', years: {} });
  const big = TX.concat([{ _id: 'a5', date: '2025-11-01', memo: '과다 지출', withdraw: 40000000, debit: '체육문화비', credit: '현금성자산', approved: true }]);
  const arrC = B.closeArr(big, 'F1', 2025);
  assert.ok(arrC._rc.deficit > 0, '모자란 만큼을 deficit 으로 남긴다');
  assert.match(grabFn('_rsvPendingNote'), /재원 부족/);
});

test('★ 화면·서류·워크북·연도별 비교가 «같은» 조정을 본다', () => {
  assert.match(SRC, /closeArr\(arr,S\.fundId,S\.year\)/, '회계·결산 탭');
  assert.match(grabFn('prevArr'), /closeArr\(/, '전기 비교');
  assert.match(grabFn('_docExtra'), /closeArr\(r\[0\],fid,yr\)/, '서류(별지15호 등)');
  assert.match(grabFn('makeClosingWb'), /closeArr\(arr,fid,yr\)/, '결산서 워크북');
  assert.match(grabFn('loadYearSeries'), /closeArr\(a,fid,y\)/, '연도별 비교');
});

test('★ 확정은 옛 자동 분개를 걷고 처음부터 다시 셈한다 — 다시 확정해도 옛 환입이 남지 않는다', () => {
  const f = grabFn('lockClosing');
  assert.match(f, /arr=arr\.filter\(function\(x\)\{ return !_rsvIsAuto\(x\); \}\)/);
  assert.match(f, /_oldAuto\.forEach\(function\(id\)\{ up\['txns\/'\+fid\+'\/'\+yr\+'\/'\+id\]=null; \}\)/);
});

test('★★ 이자 원천징수(원천징수영수증)를 넣으면 이자수익이 총액이 되고 선납세금이 생긴다 — 그래도 당기순이익 0', () => {
  fresh({ fund_type: '사내', years: { 2025: { wht: { corp: 1400, local: 140 } } } });
  const arrC = B.closeArr(TX, 'F1', 2025);
  const f = B.computeFin(arrC, 'F1', 2025);
  assert.equal(arrC._wht, 1540);
  const w = arrC.find((x) => x._id === 'rsvwht2025');
  assert.ok(w && w.debit === '선납세금' && w.credit === '이자수익' && w.nocash && w.wht, '(차)선납세금/(대)이자수익 대체분개');
  assert.equal(Math.round(f.net), 0, '당기순이익 0');
  assert.ok(f.balanced, '대차 일치');
  assert.equal(arrC._rc.interestCash, 9520 + 1540, '준비금1 설정 기준은 이자 «총액»');
  assert.ok(B.isAuto(w), '확정 때 다시 셈할 자동 분개 자리');
});

test('★ 지도점검 두 가지 — 임금성 지급 의심·기본재산 잠식을 센다', () => {
  const box = {};
  new Function([grabFn('num'), grabDecl('WAGE_LIKE_RE'), grabFn('closeRisks'), 'this.f=closeRisks;'].join('\n')).call(box);
  const arr = [
    { approved: true, withdraw: 500000, debit: '격려금', memo: '연말' },
    { approved: true, withdraw: 300000, debit: '기타복지비', memo: '특별상여 지급' },
    { approved: true, withdraw: 70000, debit: '경조사비', memo: '결혼 축의' },
    { approved: false, withdraw: 900000, debit: '격려금', memo: '미승인' },
  ];
  const r = box.f(arr, { retained: -12345 });
  assert.equal(r.wageN, 2); assert.equal(r.wageSum, 800000);
  assert.equal(r.erosion, 12345, '결손이면 그만큼 잠식');
  assert.equal(box.f([], { retained: 0 }).erosion, 0);
  assert.match(SRC, /_rsvPendingNote\(arrC\)\+_closeRiskNote\(arrC\)/, '회계·결산 화면에 붙어 있다');
});

test('원천징수 칸이 비면 아무것도 얹지 않는다', () => {
  fresh({ fund_type: '사내', years: {} });
  assert.ok(!B.closeArr(TX, 'F1', 2025).some((x) => x._id === 'rsvwht2025'));
});

test('★ 「중소기업 아님」 사내기금만 머리에 딱지가 붙는다 — 나머지는 아무것도 안 붙인다', () => {
  const box = {};
  new Function(grabFn('_smeNotTag') + '\nthis.t=_smeNotTag;').call(box);
  assert.match(box.t({ fund_type: '사내', sme: '중소기업 아님' }), /중소기업 아님 · 사용한도 50%/);
  assert.equal(box.t({ fund_type: '사내', sme: '중소기업' }), '');
  assert.equal(box.t({ fund_type: '사내' }), '', '비어 있으면 중소기업으로 본다 — 딱지 없음');
  assert.equal(box.t({ fund_type: '공동', sme: '중소기업 아님' }), '', '공동기금에는 뜻이 없다');
  assert.match(grabFn('renderFund'), /tags\+=_smeNotTag\(f\);/);
});

test('ⓘ 설명이 등록돼 있다', () => {
  assert.ok(SRC.indexOf("'close.rsvpreview':{") >= 0);
  assert.ok(SRC.indexOf("hlp('close.rsvpreview')") >= 0);
});
