'use strict';
/* 법인세·지방소득세 신고 준비표 + 대부이자수익 계정
 * 대표 지시 2026-10-07 「국세청 신고관련 내용도 한번에 처리할 수 있게 여기에서 자료 바로 넘길수 있게」·「추천대로 완벽히 최종까지」.
 * 신고 자체는 홈택스·위택스(인증서 로그인)라 앱은 서식 판정·칸별 값·엑셀까지 만든다.
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금·금액은 전부 지어낸 것이다.
 * node --test tests/fund-tax-prep.test.js */
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
const B = (() => {
  const box = {};
  new Function([
    "var RESERVE_ACCTS=['고유목적사업준비금1','고유목적사업준비금2'];",
    grabFn('num'), grabFn('_splitsOf'), grabFn('expandSplits'),
    grabFn('accruedOf'), grabFn('rsv1Ledger'), grabFn('rsv1UseOf'), grabFn('taxCalc'), grabFn('taxRateTxt'), grabFn('taxPrep'), grabFn('taxText'),
    'this.calc=taxCalc; this.prep=taxPrep; this.text=taxText;',
  ].join('\n')).call(box);
  return box;
})();

const F = { name: '가나다공동근로복지기금', tax_id_no: '000-00-00000', tax_office: '○○세무서' };
const tbOf = (o) => { const t = {}; Object.keys(o).forEach((k) => { t[k] = { debit: o[k][0], credit: o[k][1] }; }); return t; };
/* 이자 총액 1,000,000 = 통장 846,000 + 원천징수(법인세 140,000·지방 14,000) */
const INT = [
  { _id: 't1', approved: true, deposit: 846000, debit: '현금성자산', credit: '이자수익' },
  { _id: 'rsvwht2025', approved: true, amount: 154000, nocash: 1, wht: 1, debit: '선납세금', credit: '이자수익' },
  { _id: 'rsv1set2025', approved: true, amount: 1000000, nocash: 1, debit: '고유목적사업준비금전입액', credit: '고유목적사업준비금1' },
  { _id: 'rsv1in2025', approved: true, amount: 1000000, nocash: 1, debit: '고유목적사업준비금1', credit: '고유목적사업준비금환입' },
];
const WHT = { corp: 140000, local: 14000 };

test('★ 세율 — 사업연도로 고른다(2026년부터 10/20/22/25%, 2023~2025 9/19/21/24%, 지방은 1/10)', () => {
  assert.equal(B.calc(0, 2026), 0);
  assert.equal(B.calc(200000, 2026), 20000);
  assert.equal(B.calc(300000000, 2026), 40000000, '2억×10% + 1억×20%');
  assert.equal(B.calc(300000000, 2025), 37000000, '2억×9% + 1억×19%');
  assert.equal(B.calc(300000000, 2026, true), 4000000, '지방 1%·2%');
  assert.equal(B.calc(200000, 2025, true), 1800);
  assert.equal(B.calc(-5, 2026), 0, '음수 과세표준은 0');
});

test('★★ 예금이자만 — 별지 제56호, 준비금 100% 손금산입 → 과세표준 0, 떼인 세금 환급', () => {
  const P = B.prep(INT, { tb: tbOf({ 이자수익: [0, 1000000], 선납세금: [154000, 0] }), resvExp: 1000000 }, WHT, 2025, F, '고유목적사업준비금1');
  assert.equal(P.kind, '56');
  assert.equal(P.intCash, 1000000, '이자는 원천징수 전 총액');
  assert.equal(P.income, 1000000); assert.equal(P.limit, 1000000); assert.equal(P.deduct, 1000000);
  assert.equal(P.base, 0); assert.equal(P.tax, 0);
  assert.equal(P.pay, -140000, '법인세 원천납부 140,000 환급');
  assert.equal(P.lpay, -14000, '지방소득세 특별징수 14,000 환급');
  assert.equal(P.rsvUsed, 1000000); assert.equal(P.remain, 0, '그 해 다 썼다 — 5년 기한 걱정 없음');
  assert.ok(P.forms[0].includes('제56호')); assert.ok(P.lforms[0].includes('제43호의6'));
  assert.deepEqual([P.due.corp, P.due.local], ['2026-03-31', '2026-04-30']);
  assert.match(P.decision, /돌려받습니다/);
  const r = Object.fromEntries(P.rows.map((x) => [x[0], x[1]]));
  assert.equal(r['과세표준'], 0); assert.equal(r['환급받을 세액'], 140000); assert.equal(r['고유번호(사업자번호 칸)'], '000-00-00000');
});

test('★★ 근로자 대부이자 — 일반 신고(제1호), 한도 100%(제29조①1호다목), 개시신고·제56호 여부는 확인 필요', () => {
  const arr = INT.concat([{ _id: 't2', approved: true, deposit: 300000, debit: '현금성자산', credit: '대부이자수익' }]);
  const P = B.prep(arr, { tb: tbOf({ 이자수익: [0, 1000000], 대부이자수익: [0, 300000] }), resvExp: 1300000 }, WHT, 2025, F, '고유목적사업준비금1');
  assert.equal(P.kind, '1');
  assert.equal(P.income, 1300000); assert.equal(P.limit, 1300000); assert.equal(P.base, 0);
  assert.ok(P.forms.some((x) => x.includes('제1호'))); assert.ok(P.forms.some((x) => x.includes('제27호')));
  assert.ok(P.notes.some((x) => x.includes('제75호의4')), '수익사업 개시신고 확인');
  assert.match(P.decision, /반드시 신고/);
});

test('★ 잡수익 — 한도 50%, 남는 소득에 세금', () => {
  const P = B.prep(INT, { tb: tbOf({ 이자수익: [0, 1000000], 잡수익: [0, 200000] }), resvExp: 1000000 }, WHT, 2026, F, '고유목적사업준비금1');
  assert.equal(P.kind, '1');
  assert.equal(P.limit, 1100000); assert.equal(P.deduct, 1000000); assert.equal(P.base, 200000);
  assert.equal(P.tax, 20000); assert.equal(P.ltax, 2000);
  assert.equal(P.pay, 20000 - 140000);
  assert.ok(P.notes.some((x) => x.includes('잡수익')));
});

test('★ 미수이자는 익금에서 뺀다 · 원천징수 미입력이면 장부 선납세금으로 [추정]', () => {
  const arr = INT.concat([{ _id: 'acc', approved: true, amount: 50000, nocash: 1, debit: '미수수익', credit: '이자수익' }]);
  const P = B.prep(arr, { tb: tbOf({ 이자수익: [0, 1050000], 선납세금: [154000, 0] }), resvExp: 1000000 }, {}, 2025, F, '고유목적사업준비금1');
  assert.equal(P.intBook, 1050000); assert.equal(P.intCash, 1000000); assert.equal(P.accrued, 50000);
  assert.equal(P.whtSrc, 'book'); assert.equal(P.corp, 140000); assert.equal(P.local, 14000);
  assert.ok(P.notes.some((x) => x.includes('[추정]')));
  assert.ok(P.notes.some((x) => x.includes('미수이자')));
});

test('★ 준비금이 남으면 5년 기한을 알린다 · 수입이 없으면 신고할 소득 없음', () => {
  const arr = INT.filter((x) => x._id !== 'rsv1in2025');
  const P = B.prep(arr, { tb: tbOf({ 이자수익: [0, 1000000] }), resvExp: 1000000 }, WHT, 2025, F, '고유목적사업준비금1');
  assert.equal(P.remain, 1000000);
  assert.ok(P.notes.some((x) => x.includes('5년이 되는 해까지')));
  /* 제27호(을) 원장 — 2025 설정분, 기한 2030(설정 연도 + 5) */
  assert.deepEqual(P.ledger.rows.map((r) => [r.y, r.set, r.left, r.due]), [['2025', 1000000, 1000000, '2030']]);
  /* 전년 원장이 있으면 그 해 것부터 쓴다 */
  const Q = B.prep(INT, { tb: tbOf({ 이자수익: [0, 1000000] }), resvExp: 1000000 }, WHT, 2025, F, '고유목적사업준비금1', [{ y: '2021', set: 300000, used: 0 }], 0);
  assert.deepEqual(Q.ledger.rows.map((r) => [r.y, r.usedNow, r.left]), [['2021', 300000, 0], ['2025', 700000, 300000]]);
  assert.ok(Q.notes.some((x) => x.includes('2021년 설정분')) === false, '다 쓴 해는 경고하지 않는다');
  const O = B.prep(arr, { tb: tbOf({ 이자수익: [0, 1000000] }), resvExp: 1000000 }, WHT, 2026, F, '고유목적사업준비금1', [{ y: '2021', set: 300000, used: 0 }], 0);
  assert.ok(O.notes.some((x) => x.includes('2021년 설정분') && x.includes('기한')), '5년 지난 잔액은 익금산입 경고');
  const N = B.prep([], { tb: {}, resvExp: 0 }, {}, 2025, F, '고유목적사업준비금1');
  assert.equal(N.kind, 'none'); assert.equal(N.rows.length, 11);
  assert.match(B.text(B.prep(INT, { tb: tbOf({ 이자수익: [0, 1000000] }), resvExp: 1000000 }, WHT, 2025, F), F), /\[법인지방소득세\]/);
});

test('★ 대부이자수익 계정 — 수익, 자동분류는 «이자» 규칙보다 먼저, 준비금1 기준·손익·수입지출에 들어간다', () => {
  assert.match(SRC, /'이자수익':'수익','대부이자수익':'수익'/);
  const i = SRC.indexOf("{kw:['대부이자'"), j = SRC.indexOf("{kw:['이자','예금이자']");
  assert.ok(i > 0 && i < j, '대부이자 규칙이 이자 규칙보다 먼저');
  assert.match(SRC, /x\.credit!=='이자수익'&&x\.credit!=='대부이자수익'/);
  assert.match(SRC, /\['이자수익','대부이자수익','잡수익'\]\.forEach/);
  assert.match(SRC, /accts:\['이자수익','대부이자수익','잡수익'\]/);
  assert.match(SRC, /'대부이자수익':413/);
  assert.match(SRC, /x\.credit==='근로자대부금'\)\?'대부이자수익'/, '대부 상환 쪼개기 둘째 조각');
});

test('★ 대부 대장 — 해마다 이자 칸, 장부 대부이자수익과 대조', () => {
  const ls = grabFn('loanSum');
  const box = {}; new Function(grabFn('num') + '\n' + ls + '\nthis.f=loanSum;').call(box);
  const t = box.f([{ amount: 1000000, paid: { 2025: 200000 }, int: { 2025: 30000, 2024: 10000 } }, { amount: 500000, int: { 2025: 5000 } }], 2025);
  assert.equal(t.intYr, 35000); assert.equal(t.balance, 1300000);
  assert.match(SRC, /function loanIntSet\(id,v\)/);
  assert.match(SRC, /대부이자가 장부와 다릅니다/);
});

test('★ 결산 후 진행에 붙는다 — 8단계 단추·홈 일괄·제출 묶음 안 엑셀, 신고는 사람이(홈택스·위택스 열기만)', () => {
  assert.match(SRC, /onclick="taxPrepOpen\(\)"/);
  assert.match(SRC, /taxPrepMany\('\+yr\+'\)/);
  assert.match(SRC, /06\. 법인세·지방소득세 신고 준비표/);
  assert.match(SRC, /'close\.tax':\{/);
  assert.match(SRC, /https:\/\/www\.hometax\.go\.kr/); assert.match(SRC, /https:\/\/www\.wetax\.go\.kr/);
  const body = grabFn('taxPrepShow') + grabFn('taxPrepOpen');
  assert.doesNotMatch(body, /password|인증서 비밀번호|fetch\(/, '인증정보를 다루거나 어디로 보내지 않는다');
});

test('★★ 미수수익이 있으면 제56호 간편신고가 아니라 제1호 + 세무조정(책 대조 D2 — p.170·312·340)', () => {
  const acc = INT.concat([{ _id: 'acc', approved: true, amount: 50000, nocash: 1, debit: '미수수익', credit: '이자수익' }]);
  const P = B.prep(acc, { tb: tbOf({ 이자수익: [0, 1050000] }), resvExp: 1000000 }, WHT, 2025, F, '고유목적사업준비금1');
  assert.equal(P.kind, '1');
  assert.equal(P.income, 1000000, '세법상 이자 = 받은 이자(미수 제외)');
  assert.equal(P.base, 0);
  assert.ok(P.notes.some((x) => x.includes('익금불산입(△유보)')));
  assert.match(P.decision, /제56호 간편신고는 쓸 수 없습니다/);
  /* 다음 해 — 전기 미수를 받은 해: 받은 이자 전부가 세법상 이자, 익금산입(유보 추인) */
  const nxt = [{ _id: 'n1', approved: true, deposit: 846000, debit: '현금성자산', credit: '이자수익' },
    { _id: 'rsvacc2026', approved: true, amount: 50000, nocash: 1, debit: '이자수익', credit: '미수수익' }];
  const Q = B.prep(nxt, { tb: tbOf({ 이자수익: [50000, 846000] }), resvExp: 846000 }, {}, 2026, F, '고유목적사업준비금1');
  assert.equal(Q.kind, '1'); assert.equal(Q.intCash, 846000); assert.equal(Q.accRev, 50000);
  assert.ok(Q.notes.some((x) => x.includes('익금산입(유보 추인)')));
});

test('★★ 일반 신고 — 재무제표·세무조정계산서 첨부, 수입 3억원 이상이면 외부세무조정 대상 경고(책 대조 D6 — 법 제60조⑤⑨, 시행령 제97조의2①)', () => {
  const big = [{ _id: 'b1', approved: true, deposit: 350000000, debit: '현금성자산', credit: '대부이자수익' }];
  const P = B.prep(big, { tb: tbOf({ 대부이자수익: [0, 350000000] }), resvExp: 350000000 }, {}, 2026, F, '고유목적사업준비금1');
  assert.equal(P.kind, '1');
  assert.ok(P.notes.some((x) => x.includes('제60조⑤')), '첨부 안 하면 무신고');
  assert.equal(P.extAdj, true);
  const n = P.notes.find((x) => x.includes('외부세무조정'));
  assert.ok(n && n.includes('준비금 손금산입(2호)') && n.includes('[확인 필요]'));
  /* 준비금을 안 쌓고 설립도 오래됐으면 3억원이 넘어도 2·3·4호 어디에도 안 걸린다 */
  const P2 = B.prep(big, { tb: tbOf({ 대부이자수익: [0, 350000000] }), resvExp: 0 }, {}, 2026, Object.assign({ inka_date: '2015-03-01' }, F), '고유목적사업준비금1');
  assert.equal(P2.extAdj, false);
  /* 설립 2년 안이면 4호 */
  const P3 = B.prep(big, { tb: tbOf({ 대부이자수익: [0, 350000000] }), resvExp: 0 }, {}, 2026, Object.assign({ inka_date: '2025-06-01' }, F), '고유목적사업준비금1');
  assert.equal(P3.extAdj, true); assert.ok(P3.notes.some((x) => x.includes('설립 2년 안(4호)')));
  /* 3억원 미만은 조용하다 · 제56호(이자만)에는 붙이지 않는다 */
  const small = B.prep(INT.concat([{ _id: 't2', approved: true, deposit: 300000, debit: '현금성자산', credit: '대부이자수익' }]),
    { tb: tbOf({ 이자수익: [0, 1000000], 대부이자수익: [0, 300000] }), resvExp: 1300000 }, WHT, 2026, F, '고유목적사업준비금1');
  assert.equal(small.extAdj, false); assert.ok(!small.notes.some((x) => x.includes('외부세무조정')));
  const only = B.prep(INT, { tb: tbOf({ 이자수익: [0, 1000000], 선납세금: [154000, 0] }), resvExp: 1000000 }, WHT, 2025, F, '고유목적사업준비금1');
  assert.ok(!only.notes.some((x) => x.includes('제60조⑤')));
});
