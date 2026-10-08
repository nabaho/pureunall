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
    grabDecl('RESERVE_ACCTS'), grabDecl('RSV_AUTO_ID'), grabDecl('RSV1_FIFO_FROM'),
    'var funds={}, S={fundId:"F1", year:2025};',
    grabFn('num'),
    grabFn('acctType'), grabFn('isDrAcct'), grabFn('_openingOf'), grabFn('_splitsOf'), grabFn('expandSplits'),
    grabFn('journalOf'), grabFn('acctMoves'), grabFn('openingMoves'), grabFn('tbRowsOf'), grabFn('computeFin'),
    grabFn('useRate'), grabFn('bizIncomeOnly'), grabFn('bizUseRate'), grabFn('_reserveRate'), grabFn('_contribOf'), grabFn('_rsvSwapOf'), grabFn('_rsvRoles'),
    grabFn('_reserveAcct'), grabFn('reserveAdjust'), grabFn('_reserveEntry'), grabFn('_reserveEntries'),
    grabFn('_rsvIsAuto'), grabFn('_rsvWhtOf'), grabFn('_whtEntry'), grabFn('accruedOf'), grabFn('_accEntry'), grabFn('closeArr'), grabFn('annexRows'), grabFn('rsv1Ledger'), grabFn('rsv1UseOf'),
    grabFn('carryOpening'), grabFn('f15PrevCheck'),
    'this.carry=carryOpening; this.prevCheck=f15PrevCheck;',
    'this.funds=funds; this.useRate=useRate; this.computeFin=computeFin; this.closeArr=closeArr;',
    'this.reserveAdjust=reserveAdjust; this.isAuto=_rsvIsAuto; this.accruedOf=accruedOf; this.annex=annexRows; this.ledger=rsv1Ledger; this.useOf=rsv1UseOf;',
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

test('★★ 전년 기말에서 전기이월 가져오기 — 준비금2 잔액이 넘어와 다음 해 지출을 덮는다(결손 없음)', () => {
  /* 2025: 출연 5천만·지출 780만·이자 9,520 → 결산 조정(준비금2 설정 4천만·환입) */
  fresh({ fund_type: '사내', years: {} });
  const prevC = B.closeArr(TX, 'F1', 2025);
  const prevFin = B.computeFin(prevC, 'F1', 2025);
  const r = B.carry(prevC, {}, prevFin);
  assert.equal(r.op.basic, Math.round(prevFin.basic), '기본재산');
  assert.equal(r.op.reserve2, Math.round(prevFin.res2), '준비금2 잔액이 넘어온다');
  assert.equal(r.op.cash, Math.round(prevFin.cash), '현금');
  assert.equal(r.op.retained, Math.round(prevFin.retained), '이월잉여금');
  assert.deepEqual(r.missing, []);
  /* 2026: 출연 없이 300만 지출 — 넘어온 준비금2로 덮여 결손이 없어야 한다 */
  B.funds.F1.years[2026] = { opening: r.op };
  const tx26 = [{ _id: 'b1', date: '2026-05-01', memo: '경조', withdraw: 3000000, debit: '경조사비', credit: '현금성자산', approved: true }];
  const f26 = B.computeFin(B.closeArr(tx26, 'F1', 2026), 'F1', 2026);
  assert.ok(f26.balanced, '이월한 기초로 대차가 맞는다');
  assert.equal(Math.round(f26.net), 0, '전년 준비금2로 덮여 당기순이익 0');
  assert.equal(Math.round(f26.retained), 0, '결손 없음');
});

test('이월할 칸이 없는 계정에 잔액이 남으면 알린다(조용히 버리지 않는다)', () => {
  fresh({ fund_type: '사내', years: {} });
  const arr = TX.concat([{ _id: 'm1', date: '2025-12-30', memo: '미지급', amount: 50000, nocash: 1, debit: '지급수수료', credit: '미지급금', approved: true }]);
  const pc = B.closeArr(arr, 'F1', 2025);
  assert.deepEqual(B.carry(pc, {}, B.computeFin(pc, 'F1', 2025)).missing, ['미지급금']);
});

test('★ ⑫(올해 기초 기본재산)와 작년에 보고한 ⑳을 천원 단위로 견준다', () => {
  assert.deepEqual(B.prevCheck(10000000, null), { known: false }, '전년 확정이 없으면 모름');
  assert.equal(B.prevCheck(10000400, { bf_end: 10000100 }).off, false, '천원 단위가 같으면 같다');
  const c = B.prevCheck(10000000, { bf_end: 12000000 });
  assert.ok(c.known && c.off && c.cur === 10000 && c.prev === 12000);
  assert.match(SRC, /f15PrevCheck\(R\.bfOpen,S\.f15PrevFin\)/, '운영상황보고서 화면에 붙어 있다');
  assert.match(SRC, /closing\/'\+fid\+'\/'\+\(yr-1\)\+'\/fin'/, '전년 확정 스냅샷을 읽는다');
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

/* ★★ 미수수익 (책 대조 D2 — 김승훈 2014 p.170~192, 2026-10-08) — 첫해 이익으로 남기고, 다음 해 역분개해 상계한다 */
test('★★ 미수수익 첫해 — 미수이자는 준비금으로 메우지 않는다 → 그만큼 당기순이익으로 남는다', () => {
  fresh({ fund_type: '사내', years: {} });
  const T1 = TX.concat([{ _id: 'acc1', date: '2025-12-31', memo: '정기예금 미수이자', amount: 50000, nocash: 1, debit: '미수수익', credit: '이자수익', approved: true }]);
  const ac = B.accruedOf(T1);
  assert.deepEqual(ac, { acc: 50000, revInc: 0, revCash: 0, credit: 0 });
  const fin = B.computeFin(B.closeArr(T1, 'F1', 2025), 'F1', 2025);
  assert.equal(Math.round(fin.net), 50000, '미수이자만큼 이익(책: 그 해 이익 → 이월)');
  const rc = B.reserveAdjust(T1, 'F1', 2025);
  assert.equal(rc.interestCash, 9520, '준비금1 기준은 받은 이자뿐 — 미수이자 제외');
});
test('★★ 미수수익 다음 해 — 전기 미수를 결산 때 지워(역분개) 그만큼 손실, 전기이월이익잉여금과 상계해 0', () => {
  fresh({ fund_type: '사내', years: { 2026: { opening: { cash: 5000000, accrued: 50000, reserve2: 4950000, basic: 50000, retained: 50000 } } } });
  const T2 = [
    { _id: 'b1', date: '2026-01-05', memo: '정기예금 이자(전기 미수 포함)', deposit: 80000, debit: '현금성자산', credit: '이자수익', approved: true },
    { _id: 'b2', date: '2026-05-02', memo: '체육대회', withdraw: 1000000, debit: '체육문화비', credit: '현금성자산', approved: true },
  ];
  const arrC = B.closeArr(T2, 'F1', 2026);
  const acc = arrC.filter((x) => x._id === 'rsvacc2026')[0];
  assert.ok(acc, '전기 미수수익 회수 분개가 얹힌다');
  assert.equal(acc.amount, 50000); assert.equal(acc.debit, '이자수익'); assert.equal(acc.credit, '미수수익');
  assert.ok(B.isAuto(acc), '자동 분개로 알아본다(두 번 얹지 않게)');
  const fin = B.computeFin(arrC, 'F1', 2026);
  assert.equal(Math.round(fin.net), -50000, '전기 미수만큼 손실');
  assert.equal(Math.round(fin.retained), 0, '전기이월이익잉여금 50,000 과 상계 → 0(책 p.180~183)');
  assert.ok(fin.balanced, '대차가 맞는다');
  assert.equal(B.reserveAdjust(arrC.filter((x) => !String(x._id).startsWith('rsv1') && !/^rsv2026/.test(x._id)), 'F1', 2026).interestCash, 80000, '준비금1 기준은 받은 이자 전부(전기 미수분 포함)');
  /* 사람이 이미 미수수익을 지웠으면 다시 지우지 않는다 */
  const T3 = T2.concat([{ _id: 'b3', date: '2026-01-05', memo: '전기 미수 정리', amount: 50000, nocash: 1, debit: '이자수익', credit: '미수수익', approved: true }]);
  assert.equal(B.closeArr(T3, 'F1', 2026).filter((x) => x._id === 'rsvacc2026').length, 0, '이미 지운 것은 또 지우지 않는다');
});

/* ★ 부속명세서 세 장 (책 대조 D3 — 김승훈 2014 p.124~127, 2026-10-08) */
test('★★ 이자수입명세서 — 원천징수 두 갈래(영수증 합계 / 통장 출금 줄) 모두 총액·실수령액이 맞다', () => {
  fresh({ fund_type: '사내', years: {} });
  const A = [{ _id: 'i1', date: '2025-06-30', memo: '정기예금 이자', deposit: 423000, debit: '현금성자산', credit: '이자수익', approved: true },
    { _id: 'i2', date: '2025-12-31', memo: '정기예금 이자', deposit: 423000, debit: '현금성자산', credit: '이자수익', approved: true },
    { _id: 'rsvwht2025', date: '2025-12-31', amount: 154000, nocash: 1, wht: 1, debit: '선납세금', credit: '이자수익', approved: true }];
  const a = B.annex(A, B.computeFin(A, 'F1', 2025), {}, {});
  assert.equal(a.interest.length, 2); assert.equal(a.deposits, 846000); assert.equal(a.wht, 154000);
  assert.equal(a.gross, 1000000); assert.equal(a.received, 846000); assert.equal(a.whtFrom, 'receipt');
  const L = [{ _id: 'j1', date: '2025-12-31', memo: '이자', deposit: 1000000, debit: '현금성자산', credit: '이자수익', approved: true },
    { _id: 'j2', date: '2025-12-31', memo: '법인세 원천징수', withdraw: 154000, debit: '선납세금', credit: '현금성자산', approved: true }];
  const b = B.annex(L, B.computeFin(L, 'F1', 2025), {}, {});
  assert.equal(b.gross, 1000000, '통장 이자가 이미 총액'); assert.equal(b.wht, 154000); assert.equal(b.received, 846000); assert.equal(b.whtFrom, 'line');
});
test('★★ 준비금명세서·기본재산명세서 — 기초+설정−사용 = 기말이 재무제표와 맞물린다', () => {
  fresh({ fund_type: '사내', years: {} });
  const arrC = B.closeArr(TX, 'F1', 2025), fin = B.computeFin(arrC, 'F1', 2025);
  const R = { bfOpen: 0, bfEnd: Math.round(fin.basic), bf: { employer: 50000000, use: 40000000 }, run: { deposit: Math.round(fin.basic), loan: 0, total: Math.round(fin.basic) } };
  const x = B.annex(arrC, fin, R, {});
  assert.equal(x.rsv.r2.set, 40000000, '준비금2 설정 = 출연 × 80%');
  assert.equal(x.rsv.r2.end, Math.round(fin.res2)); assert.equal(x.rsv.r1.end, Math.round(fin.res1));
  assert.deepEqual(x.chk, { r1: true, r2: true, basic: true });
  assert.equal(x.basic.end, 10000000);
});

/* ★★ 준비금1 선입선출 (책 대조 D1·D4 — 김승훈 2014 p.41·111·209, 법인세법 제29조③⑤4호), 2026 사업연도부터 */
test('★★ 2026~ 이자가 지출보다 많으면 남은 이자는 준비금1에 남는다 — 준비금2로 넘기지 않는다', () => {
  fresh({ fund_type: '공동', years: {} });
  const T = [{ _id: 'i', date: '2026-06-30', memo: '이자', deposit: 1000000, debit: '현금성자산', credit: '이자수익', approved: true },
    { _id: 'e', date: '2026-07-01', memo: '경조사비', withdraw: 300000, debit: '경조사비', credit: '현금성자산', approved: true }];
  const arrC = B.closeArr(T, 'F1', 2026), fin = B.computeFin(arrC, 'F1', 2026);
  assert.equal(Math.round(fin.net), 0, '순이익 0');
  assert.equal(Math.round(fin.res1), 700000, '쓰고 남은 이자 70만이 준비금1 에');
  assert.equal(Math.round(fin.res2), 0, '준비금2 로 넘기지 않는다');
  assert.equal(arrC.filter((x) => x._id === 'rsv1in2026').length, 0, '같은 금액을 바로 되돌리지 않는다');
  assert.deepEqual(B.useOf(arrC, '고유목적사업준비금1'), { set: 1000000, use: 300000 });
  const T5 = T.map((x) => Object.assign({}, x, { date: x.date.replace('2026', '2025') }));
  const f5 = B.computeFin(B.closeArr(T5, 'F1', 2025), 'F1', 2025);
  assert.equal(Math.round(f5.res1), 0, '2025 이전은 옛 방식(제출본과 맞춘다)'); assert.equal(Math.round(f5.res2), 700000);
});
test('★★ 2026~ 지출이 이자보다 많을 때 — 준비금1(이월 포함) 먼저, 모자란 만큼 준비금2', () => {
  fresh({ fund_type: '공동', years: { 2026: { opening: { cash: 5000000, reserve: 200000, reserve2: 4800000 } } } });
  const T = [{ _id: 'i', date: '2026-06-30', memo: '이자', deposit: 100000, debit: '현금성자산', credit: '이자수익', approved: true },
    { _id: 'e', date: '2026-07-01', memo: '경조사비', withdraw: 1000000, debit: '경조사비', credit: '현금성자산', approved: true }];
  const fin = B.computeFin(B.closeArr(T, 'F1', 2026), 'F1', 2026);
  assert.equal(Math.round(fin.net), 0);
  assert.equal(Math.round(fin.res1), 0, '이월 20만 + 올해 10만 모두 사용');
  assert.equal(Math.round(fin.res2), 4800000 - 700000, '나머지 70만은 준비금2');
});
test('★★ 준비금1 연도별 원장 — 먼저 설정한 것부터 쓰고, 5년이 되는 해까지 못 쓰면 기한 지남', () => {
  const L1 = B.ledger(null, 2026, 1000000, 300000, 0);
  assert.deepEqual(L1.save, [{ y: '2026', set: 1000000, used: 300000 }]);
  assert.equal(L1.rows[0].due, '2031');
  const L2 = B.ledger(L1.save, 2027, 500000, 900000, 0);
  assert.deepEqual(L2.rows.map((r) => [r.y, r.usedNow, r.left]), [['2026', 700000, 0], ['2027', 200000, 300000]], '2026 분부터');
  assert.deepEqual(L2.save, [{ y: '2027', set: 500000, used: 200000 }], '다 쓴 해는 넘기지 않는다');
  const L3 = B.ledger([{ y: '2026', set: 1000000, used: 0 }], 2031, 0, 400000, 0);
  assert.equal(L3.rows[0].left, 600000); assert.equal(L3.rows[0].over, true, '2031 = 2026 + 5 — 익금산입 대상');
  assert.equal(B.ledger([{ y: '2026', set: 1000000, used: 0 }], 2030, 0, 0, 0).rows[0].soon, true, '한 해 전에 알린다');
  const L5 = B.ledger(null, 2026, 100000, 250000, 200000);
  assert.deepEqual(L5.rows.map((r) => [r.y, r.usedNow, r.left]), [['이월', 200000, 0], ['2026', 50000, 50000]], '원장이 없으면 기초 잔액을 이월로');
});
