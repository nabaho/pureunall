/* 주주·사업주 주식 출연 일괄 등록 · 보안 판독 · 별지 제10호/제15호 연동 · 보유주식 소각(현금 유입) 회계·법령 검사
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 실제 기금명·주주명·주민번호·주소·실제 숫자는 단 한 글자도 금지.
 *   여기에 적힌 회사명·성명·주식수·금액·번호는 전부 시험용 가상 데이터다.
 *
 * 지켜야 하는 것
 *  ① 인감증명서·본인서명사실확인서·주민등록등초본 등 신분증명 페이지는 감지 즉시 원천 차단·폐기되고,
 *    주민등록번호·운전면허번호·자택 상세 동·호수는 추출 전 정규식으로 소거된다.
 *  ② 다수 주주의 「기금출연확인서」 묶음과 「주주명부」, 엑셀·표 붙여넣기를 한 번에 읽어
 *    주주별 주식종류·액면가·주식수·지분율·평가가액과 출연일+21일(3주) 법정기한을 정확히 계산한다.
 *  ③ 주식 현물출연 대체분개(nocash:1, 차변 매도가능증권 / 대변 기본재산)는 통장 현금 대사와
 *    당해연도 현금출연 사용한도(_contribOf)를 건드리지 않으면서,
 *    재무제표(fin.secu, fin.basic)·별지 제15호(⑮ 출연, ⑳ 기본재산 총액, ㉓ 유가증권)·별지 제10호(변경 전·후·사유)에
 *    단일 원천으로 일치 반영된다.
 *  ④ 보유주식 유상소각·이익소각·감자로 현금이 유입될 때:
 *    - 원칙(gain_mode='revenue'): 원금은 매도가능증권→현금성자산 전환(기본재산 총액 불변, 보고 비대상),
 *      초과 차익은 잡수익(기금운용 수익금, 퇴직연금복지과-871)으로 한도 제한 없이 목적사업 재원이 된다.
 *    - 예외(gain_mode='basic'): 협의회 의결로 차익을 기본재산에 편입하면 기본재산 총액이 증가하므로
 *      3주 이내 별지 제10호 변경보고 대상이 된다.
 *    - 감자·저가소각 손실(loss > 0): 기본재산 총액이 감소하므로 3주 이내 별지 제10호 변경보고 대상이 된다.
 *    - 의제배당 원천징수세액(wht_tax)이 있으면 선납세금 분개와 통장 실입금액(net_cash)이 정확히 대사된다.
 *  ⑤ 법령·해석 챗봇(fund_kb.js)은 주식 출연 기본재산 변경보고와 보유주식 소각 현금 유입 질의에 정확히 답한다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'fund.html'), 'utf8');
const KB_SRC = fs.readFileSync(path.join(ROOT, 'fund_kb.js'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
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
  throw new Error('상수 끝을 못 찾음: ' + name);
}

function loadEngine() {
  const box = {};
  new Function([
    grabDecl('ACCT_CHART'), grabDecl('PURPOSE_ACCTS'), grabDecl('OPEN_ACCT'),
    grabDecl('ADMIN_ACCTS'), grabDecl('RESERVE_ACCTS'), grabDecl('F15_ROWS'),
    grabDecl('BF_KINDS'), grabDecl('STOCK_RETIRE_KINDS'),
    'var funds={}, S={fundId:"F_TEST", year:2026};',
    grabFn('num'), grabFn('esc'),
    grabFn('dsDue'),
    grabFn('scrubStockPii'), grabFn('isStockSensitivePage'), grabFn('maskHolderName'),
    grabFn('_stockNum'), grabFn('_stockIsoDate'), grabFn('_stockSliceAfter'), grabFn('_stockPickMoney'),
    grabFn('parseStockCertPage'), grabFn('parseStockRosterPage'), grabFn('parseStockPages'),
    grabFn('parseStockPaste'), grabFn('calcStockBatch'), grabFn('calcStockRetire'),
    grabFn('acctType'), grabFn('isDrAcct'), grabFn('_openingOf'),
    grabFn('_splitsOf'), grabFn('expandSplits'), grabFn('journalOf'), grabFn('acctMoves'),
    grabFn('openingMoves'), grabFn('computeFin'), grabFn('guessBfKind'), grabFn('_k1000'),
    grabFn('_txnDone'), grabFn('_splitSum'), grabFn('_contribOf'),
    grabFn('_openAssets'), grabFn('bfMovesOf'), grabFn('bfDays'), grabFn('bfReason'), grabFn('_dotDate'),
    grabFn('buildF15'),
    'this.o={scrubStockPii,isStockSensitivePage,maskHolderName,parseStockCertPage,parseStockRosterPage,',
    '  parseStockPages,parseStockPaste,calcStockBatch,calcStockRetire,',
    '  expandSplits,journalOf,computeFin,guessBfKind,_contribOf,bfMovesOf,bfDays,bfReason,buildF15,',
    '  setFund:function(id,o){funds[id]=o;}};'
  ].join('\n')).call(box);
  return box.o;
}

function loadKb() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(KB_SRC, ctx);
  return ctx.window;
}

test('보안 차단 — 인감증명서·신분증명 페이지는 즉시 차단되고 주민등록번호·상세호수는 완전 소거된다', () => {
  const E = loadEngine();

  const piiSample = '성명 홍길동 주민등록번호 800101-1234567 / 820305 2345678 주소 가나시 다라구 행복아파트 105동 1203호 면허 11-22-333333-44';
  const scrubbed = E.scrubStockPii(piiSample);
  assert.ok(!scrubbed.includes('800101-1234567'), '하이픈 주민등록번호가 남아 있으면 안 된다');
  assert.ok(!scrubbed.includes('820305 2345678'), '공백 주민등록번호가 남아 있으면 안 된다');
  assert.ok(!scrubbed.includes('11-22-333333-44'), '운전면허번호가 남아 있으면 안 된다');
  assert.ok(!scrubbed.includes('1203호'), '아파트 상세 동·호수가 남아 있으면 안 된다');

  const sealPage = `
    인 감 증 명 서 (개인)
    성명: 홍길동   주민등록번호: 800101-1234567
    주소: 가나시 다라구 행복아파트 105동 1203호
    발급번호: A1234-5678   증명청: 가나시장   인감증명법에 따라 증명합니다.
  `;
  assert.equal(E.isStockSensitivePage(sealPage), true, '인감증명서 페이지는 민감 서류로 감지되어야 한다');
  assert.equal(E.parseStockCertPage(sealPage), null, '인감증명서에서는 어떤 데이터도 추출하면 안 된다');

  /* 주주 실명 가림: 개인 주주는 가운데 글자를 가리고 법인명은 유지한다 */
  assert.equal(E.maskHolderName('홍길동', true), '홍○동');
  assert.equal(E.maskHolderName('김철', true), '김○');
  assert.equal(E.maskHolderName('남궁길동', true), '남○○동');
  assert.equal(E.maskHolderName('가나주식회사', true), '가나주식회사');
  assert.equal(E.maskHolderName('홍길동', false), '홍길동');
});

test('다수 주주 기금출연확인서 + 주주명부 + 인감증명서 혼합 묶음 판독 및 엑셀 붙여넣기 파싱', () => {
  const E = loadEngine();

  const pages = [
    {
      label: '1쪽',
      text: `
        기 금 출 연 확 인 서
        1. 소유주식의 종류 : 기명식 보통주식
        2. 1주당 액면가액 : 금 500원 (₩500)
        3. 출연주식의 수 : 1,200주 (6.0%)
        4. 1주당 주식가치 평가금액 : 금 25,000원
        5. 출연주식의 금액 : 금 30,000,000원
        위 가나주식회사 주식을 가나사내근로복지기금에 무상 출연함을 확인합니다.
        2026년 04월 10일
        주 주 : 홍 길 동 (인)
        가나사내근로복지기금 귀하
      `
    },
    {
      label: '2쪽',
      text: `
        인 감 증 명 서
        성명 홍길동  주민등록번호 800101-1234567  발급번호 2026-0001  인감증명법 시행령
      `
    },
    {
      label: '3쪽',
      text: `
        기금출연확인서
        소유주식의 종류: 보통주
        1주당 액면가액: ₩500
        출연주식수: 800주 (4.0%)
        1주당 평가가액: ₩25,000
        출연주식 금액: ₩20,000,000
        가나주식회사 주식을 기금에 출연합니다.
        2026. 04. 10.
        주주 김 철 수 (인)
      `
    },
    {
      label: '4쪽',
      text: `
        주 주 명 부 (가나주식회사)
        발행주식의 총수: 20,000주
        1주의 금액: 500원
        자본금의 액: 10,000,000원
      `
    }
  ];

  const parsed = E.parseStockPages(pages);
  assert.deepEqual(parsed.blocked, ['2쪽'], '인감증명서 쪽만 정확히 차단 목록에 기록되고 폐기되어야 한다');
  assert.equal(parsed.rows.length, 2, '기금출연확인서 2건만 추출되어야 한다');
  assert.equal(parsed.rows[0].holder, '홍길동');
  assert.equal(parsed.rows[0].kind, '보통주식');
  assert.equal(parsed.rows[0].par_price, 500);
  assert.equal(parsed.rows[0].shares, 1200);
  assert.equal(parsed.rows[0].ratio, 6);
  assert.equal(parsed.rows[0].eval_price, 25000);
  assert.equal(parsed.rows[0].eval_amount, 30000000);
  assert.equal(parsed.rows[0].date, '2026-04-10');
  assert.equal(parsed.rows[0].issuer, '가나주식회사');
  assert.equal(parsed.rows[1].holder, '김철수');
  assert.equal(parsed.rows[1].shares, 800);
  assert.equal(parsed.rows[1].eval_amount, 20000000);
  assert.ok(parsed.roster, '주주명부 요약 정보가 보조 추출되어야 한다');
  assert.equal(parsed.roster.total_shares, 20000);
  assert.equal(parsed.roster.par_price, 500);

  /* 엑셀·표 붙여넣기(주민번호 열이 섞여 있어도 자동 차단) */
  const tsv = [
    '연번\t주주명\t주민등록번호\t주식종류\t출연주식수\t지분율\t액면가\t평가단가\t평가금액',
    '1\t박영희\t850505-2345678\t보통주식\t600\t3.0%\t500\t25,000\t15,000,000',
    '2\t이순신\t790909-1234567\t보통주식\t400\t2.0%\t500\t25,000\t10,000,000',
    '합계\t\t\t\t1,000\t5.0%\t\t\t25,000,000'
  ].join('\n');
  const pasted = E.parseStockPaste(tsv);
  assert.equal(pasted.length, 2, '머리글·합계 줄과 주민등록번호 열을 걸러내고 주주 2명만 추출해야 한다');
  assert.equal(pasted[0].holder, '박영희');
  assert.equal(pasted[0].shares, 600);
  assert.equal(pasted[0].eval_amount, 15000000);
  assert.equal(pasted[1].holder, '이순신');
  assert.equal(pasted[1].shares, 400);
  assert.equal(pasted[1].eval_amount, 10000000);
});

test('주식출연 일괄 계산 및 단일 원천 연동 — 현금한도는 건드리지 않고 재무제표·별지15호·별지10호를 일치시킨다', () => {
  const E = loadEngine();
  E.setFund('F_TEST', {
    name: '가나사내근로복지기금', fund_type: '사내',
    inka_no: '제 0000-2026-99 호', reg_date: '2025-12-20',
    chairman: '홍길동',
    years: { 2026: { opening: { cash: 10000000, basic: 10000000 } } }
  });

  const holders = [
    { holder: '홍길동', kind: '보통주식', par_price: 500, shares: 1200, ratio: 6.0, eval_price: 25000, eval_amount: 30000000 },
    { holder: '김철수', kind: '보통주식', par_price: 500, shares: 800, ratio: 4.0, eval_price: 25000, eval_amount: 20000000 }
  ];

  const evalCalc = E.calcStockBatch(holders, { date: '2026-04-10', basis: 'eval', par_price: 500 });
  assert.equal(evalCalc.holder_count, 2);
  assert.equal(evalCalc.total_shares, 2000);
  assert.equal(evalCalc.ratio_sum, 10);
  assert.equal(evalCalc.par_total, 1000000);
  assert.equal(evalCalc.eval_total, 50000000);
  assert.equal(evalCalc.book_amount, 50000000);
  assert.equal(evalCalc.due_date, '2026-05-01', '출연일(2026-04-10) + 21일(3주) 기한이 계산되어야 한다');

  const parCalc = E.calcStockBatch(holders, { date: '2026-04-10', basis: 'par', par_price: 500 });
  assert.equal(parCalc.book_amount, 1000000, '액면가 기준 선택 시 액면총액이 장부가액이 된다');

  /* 주식 현물출연 대체분개(nocash:1) 생성 */
  const stockTxn = {
    _id: 'st_b1',
    date: '2026-04-10',
    memo: '가나주식회사 주주(2명) 주식출연 2,000주',
    deposit: 0,
    withdraw: 0,
    amount: evalCalc.book_amount,
    nocash: 1,
    manual: 1,
    debit: '매도가능증권',
    credit: '기본재산',
    approved: true
  };
  const txns = [stockTxn];
  const rep = { use_ratio: '50', bf: { st_b1: 'other' } };

  /* ① 당해연도 현금 출연금 사용한도(_contribOf)에는 현물 주식이 섞이지 않아야 한다 */
  assert.equal(E._contribOf(txns), 0, '비현금 주식출연은 당해연도 현금 사용한도 모수에 산입되면 안 된다');
  assert.equal(E.guessBfKind({ id: 'x', memo: stockTxn.memo, debit: '매도가능증권', credit: '기본재산' }), 'other', '주주 주식출연 적요는 사업주 외 출연(other)으로 자동 추정된다');

  /* ② 재무제표: 기초 예금 1,000만 + 유가증권 5,000만 = 기본재산 6,000만 */
  const fin = E.computeFin(txns, 'F_TEST', 2026);
  assert.equal(fin.cash, 10000000);
  assert.equal(fin.secu, 50000000);
  assert.equal(fin.basic, 60000000);
  assert.equal(fin.balanced, true);

  /* ③ 별지 제15호: ⑫ 전기말 1,000만 / ⑮ 사업주 외 출연 5,000만 / ⑳ 기말 기본재산 6,000만 / ㉑ 예입 1,000만 / ㉓ 유가증권 5,000만 / ㉘ 합계 6,000만 */
  const f15 = E.buildF15(txns, 'F_TEST', 2026, rep, [{ name: '가나주식회사', company_size: 50 }], []);
  assert.equal(f15.bfOpen, 10000000);
  assert.equal(f15.bf.other, 50000000);
  assert.equal(f15.bfEnd, 60000000);
  assert.equal(f15.run.deposit, 10000000);
  assert.equal(f15.run.secu, 50000000);
  assert.equal(f15.run.total, f15.bfEnd, '별지15호 ㉘ 운용합계는 ⑳ 기본재산 총액과 일치해야 한다');

  /* ④ 별지 제10호: 변경 전 1,000만 → 변경 후 6,000만 (+5,000만) */
  const jr = E.journalOf(txns);
  const mv = E.bfMovesOf(jr, rep);
  const days = E.bfDays(10000000, mv);
  assert.equal(days.length, 1);
  assert.equal(days[0].date, '2026-04-10');
  assert.equal(days[0].before, 10000000);
  assert.equal(days[0].after, 60000000);
  assert.equal(days[0].diff, 50000000);
  assert.match(E.bfReason(days[0].items), /사업주 외의 자 출연 50,000,000원|사업주 외 출연 50,000,000원/);
});

test('보유주식 유상·이익소각 현금 유입 (원칙: 수익금 처리) — 원금은 현금 전환되고 초과 차익은 잡수익이 되며 기본재산 총액은 불변이다', () => {
  const E = loadEngine();
  E.setFund('F_TEST', {
    name: '가나사내근로복지기금', fund_type: '사내',
    years: { 2026: { opening: { cash: 10000000, secu: 50000000, basic: 60000000 } } }
  });

  const batch = {
    issuer: '가나주식회사',
    total_shares: 2000,
    book_amount: 50000000,
    remain_shares: 2000,
    remain_book: 50000000
  };

  /* 2,000주 중 1,000주(장부원금 2,500만원) 유상소각 → 세전 4,000만원, 원천징수 231만원, 통장 실입금 3,769만원 */
  const ret = E.calcStockRetire(batch, {
    date: '2026-09-15',
    kind: 'profit_retire',
    shares: 1000,
    gross_cash: 40000000,
    wht_tax: 2310000,
    gain_mode: 'revenue'
  });

  assert.equal(ret.principal_book, 25000000, '절반 소각이므로 장부원금 2,500만원이 회수된다');
  assert.equal(ret.gain, 15000000, '장부가 초과 소각차익은 1,500만원이다');
  assert.equal(ret.net_cash, 37690000, '원천세 차감 실입금액은 3,769만원이다');
  assert.equal(ret.after_shares, 1000);
  assert.equal(ret.after_book, 25000000);
  assert.equal(ret.bf_delta, 0, '수익금(잡수익) 처리 원칙에서는 기본재산 총액 변동이 0원이다');
  assert.equal(ret.report_required, false, '기본재산 총액 불변이므로 의무 변경보고 비대상이다');

  const txns = ret.txns.map((t, i) => Object.assign({ _id: 'sr_' + (i + 1) }, t));
  const fin = E.computeFin(txns, 'F_TEST', 2026);
  assert.equal(fin.cash, 10000000 + 37690000, '현금성자산이 실입금액만큼 늘어난다');
  assert.equal(fin.secu, 25000000, '매도가능증권 장부가액이 회수원금만큼 줄어든다');
  assert.equal(fin.tb['선납세금'].bal_d, 2310000, '의제배당 원천징수세액은 선납세금 자산으로 잡힌다');
  assert.equal(fin.bizRev, 15000000, '소각차익 1,500만원 전액이 기금수익(잡수익)으로 계상된다');
  assert.equal(fin.basic, 60000000, '기본재산 총액 6,000만원은 그대로 보전된다');
  assert.equal(fin.balanced, true, '재무상태표 차변(자산)과 대변(부채+자본)이 정확히 일치해야 한다');

  const f15 = E.buildF15(txns, 'F_TEST', 2026, { use_ratio: '50', bf: {} }, [{ name: '가나주식회사', company_size: 50 }], []);
  assert.equal(f15.bfEnd, 60000000, '별지15호 기본재산 총액 불변(6,000만원)');
  assert.equal(f15.run.secu, 25000000, '㉓ 유가증권은 잔여 2,500만원으로 감소');
  assert.equal(f15.run.deposit, 35000000, '㉑ 금융회사 예입 운용액이 1,000만 → 3,500만원으로 자동 이동');
  assert.equal(f15.src.income, 15000000, '㉙ 기금운용 수익금에 소각차익 1,500만원 반영');
});

test('보유주식 소각 예외 케이스 — ① 협의회 의결 기본재산 편입(증가 보고) · ② 감자손실(감소 보고)', () => {
  const E = loadEngine();
  E.setFund('F_TEST', {
    name: '가나사내근로복지기금', fund_type: '사내',
    years: { 2026: { opening: { secu: 30000000, basic: 30000000 } } }
  });

  const batch = {
    issuer: '가나주식회사',
    total_shares: 1000,
    book_amount: 30000000,
    remain_shares: 1000,
    remain_book: 30000000
  };

  /* 케이스 B: 전량(1,000주) 4,200만원 소각 + 소각차익 1,200만원을 기본재산 편입 의결 */
  const retBasic = E.calcStockRetire(batch, {
    date: '2026-10-01',
    kind: 'profit_retire',
    shares: 1000,
    gross_cash: 42000000,
    wht_tax: 0,
    gain_mode: 'basic'
  });
  assert.equal(retBasic.bf_delta, 12000000);
  assert.equal(retBasic.report_required, true, '차익을 기본재산에 편입하면 별지 제10호 보고 필수');
  assert.equal(retBasic.due_date, '2026-10-22', '소각일(2026-10-01) + 21일 기한 산출');

  const txBasic = retBasic.txns.map((t, i) => Object.assign({ _id: 'srb_' + (i + 1) }, t));
  const repBasic = { bf: { 'srb_1#2': 'income' } };
  const finBasic = E.computeFin(txBasic, 'F_TEST', 2026);
  assert.equal(finBasic.cash, 42000000);
  assert.equal(finBasic.secu, 0);
  assert.equal(finBasic.basic, 42000000);
  assert.equal(finBasic.balanced, true);
  const daysBasic = E.bfDays(30000000, E.bfMovesOf(E.journalOf(txBasic), repBasic));
  assert.equal(daysBasic.length, 1);
  assert.equal(daysBasic[0].before, 30000000);
  assert.equal(daysBasic[0].after, 42000000);

  /* 케이스 C: 유상감자로 장부가(3,000만원)보다 적은 1,800만원만 회수되어 감자손실 1,200만원 발생 */
  const retLoss = E.calcStockRetire(batch, {
    date: '2026-10-05',
    kind: 'cap_reduce',
    shares: 1000,
    gross_cash: 18000000,
    wht_tax: 0
  });
  assert.equal(retLoss.loss, 12000000);
  assert.equal(retLoss.bf_delta, -12000000);
  assert.equal(retLoss.report_required, true, '감자손실로 기본재산 총액이 줄면 별지 제10호 보고 필수');

  const txLoss = retLoss.txns.map((t, i) => Object.assign({ _id: 'srl_' + (i + 1) }, t));
  const finLoss = E.computeFin(txLoss, 'F_TEST', 2026);
  assert.equal(finLoss.cash, 18000000);
  assert.equal(finLoss.secu, 0);
  assert.equal(finLoss.basic, 18000000);
  assert.equal(finLoss.balanced, true, '감자손실 처리 후에도 대차대조표 균형이 맞아야 한다');
});

test('법령·해석 챗봇(fund_kb.js) — 주식 출연 변경보고 및 보유주식 소각 현금 유입 질의에 정확히 답한다', () => {
  assert.match(SRC, /<script src="fund_kb\.js\?v=\d+"><\/script>/, 'fund.html 이 캐시 버전과 함께 fund_kb.js 를 불러와야 한다');
  const W = loadKb();

  const q1 = '주주들이 비상장주식을 기금에 일괄 출연했을 때 기본재산 계상과 별지 제10호 변경보고 기한은?';
  const p1 = W.PuFundAsk.pick(W.FUND_KB, q1, { max: 3 });
  assert.ok(p1.some(x => x.id === 'MOEL-contrib-06'), '주식 출연 질의에 MOEL-contrib-06 항목이 매칭되어야 한다');

  const q2 = '기금이 보유한 출연 주식이 유상소각(이익소각)되어 현금으로 들어오면 회계처리와 기본재산 변경보고는 어떻게 하나요?';
  const p2 = W.PuFundAsk.pick(W.FUND_KB, q2, { max: 3 });
  assert.ok(p2.some(x => x.id === 'MOEL-contrib-07'), '주식 소각 현금 유입 질의에 MOEL-contrib-07 항목이 매칭되어야 한다');

  const ans2 = W.PuFundAsk.localAnswer(p2, q2);
  assert.equal(ans2.none, false);
  assert.match(ans2.answer, /퇴직연금복지과-871|기본재산|수익금/);
});

test('경계값·모달·원장 삭제 무결성 — 2열 단가/총액 구분 · 도움말 중첩 방지 · 결산잠금 시 삭제 차단 및 소각분개 동시 정리', async () => {
  const E = loadEngine();

  /* 1) 2열 붙여넣기: 주식수+단가(100주, 25,000원) vs 주식수+총액(1,000주, 25,000,000원) */
  const twoColUnit = E.parseStockPaste('홍길동\t100\t25,000');
  assert.equal(twoColUnit[0].shares, 100);
  assert.equal(twoColUnit[0].eval_price, 25000);
  assert.equal(twoColUnit[0].eval_amount, 2500000);

  const twoColTotal = E.parseStockPaste('김철수\t1,000\t25,000,000');
  assert.equal(twoColTotal[0].shares, 1000);
  assert.equal(twoColTotal[0].eval_price, 25000);
  assert.equal(twoColTotal[0].eval_amount, 25000000);

  const headerTotal = E.parseStockPaste('주주명\t주식수\t출연금액\n박영희\t100\t500,000');
  assert.equal(headerTotal[0].shares, 100);
  assert.equal(headerTotal[0].eval_amount, 500000);
  assert.equal(headerTotal[0].eval_price, 5000);

  /* 2) 모달 탭·Ctrl+S 저장 단추 우선순위 및 유상소각 대금 숫자 검증 */
  const renderSrc = grabFn('_stockModalRender');
  assert.doesNotMatch(renderSrc, /class="[^"]*primary[^"]*"[^>]*onclick="stockTabGo/, '상단 탭 단추에 primary 가 붙으면 Ctrl+S 가 탭을 누른다');
  assert.match(renderSrc, /onclose:\s*function\(\)\s*\{\s*S\._stockModalOpen\s*=\s*false;/, '모달 닫힘 콜백에서 _stockModalOpen 을 내려야 한다');
  assert.match(grabFn('showHelp'), /S\._stockModalOpen/, '주식 모달 안에서 도움말(ⓘ)을 열 때 중첩 모달을 막고 복귀해야 한다');
  assert.match(grabFn('_stockRetireHTML'), /var hasCash=\(R\.kind==='free_retire'\)\|\|\(rawCash!==''&&\/\^\[0-9\]/, '소각 대금이 빈칸이거나 숫자가 아닐 때 미리보기·실행 단추가 열리면 안 된다');
  assert.match(SRC, /var sv=mb\.querySelector\('\[data-modal-save\]'\);/, 'Ctrl+S 는 DOM 앞쪽 일반 primary 단추보다 [data-modal-save] 를 먼저 봐야 한다');

  /* 3) delStockBatch: 결산·월마감 잠금 시 원장 삭제를 차단하고, 미잠금 시 출연·소각 분개·이벤트를 함께 지운다 */
  const updatesLog = [], toasts = [];
  let lockedYear = 2026;
  const ctx = {
    NS: 'fund_erp',
    Promise, Object, String, Number,
    S: {
      fundId: 'F1',
      _stockModalOpen: false,
      stocks: {
        b1: {
          issuer: '가나주식회사', date: '2026-04-10', total_shares: 1000,
          txn_id: 'st_b1', txn_yr: 2026, ev_id: 'ev_c1',
          retirements: { r1: { date: '2026-09-15', txn_yr: 2026, txn_ids: ['sr_r1_1', 'sr_r1_2'], ev_id: 'ev_r1' } }
        }
      }
    },
    _stockNum: E.calcStockBatch ? (v => Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0) : null,
    confirmM: () => Promise.resolve(true),
    _checkLedgerOpen: (fid, dt) => {
      const y = +String(dt).slice(0, 4);
      return Promise.resolve(y === lockedYear ? { ok: false, msg: y + '년 결산 잠금' } : { ok: true, yr: y });
    },
    fbDb: { ref: () => ({ update: (u) => { updatesLog.push(u); return Promise.resolve(); } }) },
    _audit: () => {},
    renderFund: () => {},
    _stockModalRender: () => {},
    toast: (m) => { toasts.push(m); }
  };
  vm.createContext(ctx);
  vm.runInContext(grabFn('delStockBatch'), ctx);

  /* 잠금 상태일 때: 원장도 분개도 지우지 않고 경고만 띄운다 */
  ctx.delStockBatch('b1');
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  assert.equal(updatesLog.length, 0, '결산 잠금 상태에서 원장만 지우면 장부와 불일치한다');
  assert.ok(toasts.some(m => /잠금/.test(m)), '결산 잠금 경고를 띄워야 한다');

  /* 잠금 해제 상태일 때: 원장 + 출연분개 + 소각분개(분할 bf 포함) + 이벤트를 한 번에 지운다 */
  lockedYear = 0;
  ctx.delStockBatch('b1');
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  assert.equal(updatesLog.length, 1);
  const up = updatesLog[0];
  assert.equal(up['stocks/F1/b1'], null);
  assert.equal(up['txns/F1/2026/st_b1'], null);
  assert.equal(up['events/F1/ev_c1'], null);
  assert.equal(up['txns/F1/2026/sr_r1_1'], null);
  assert.equal(up['txns/F1/2026/sr_r1_2'], null);
  assert.equal(up['closing/F1/2026/report/bf/sr_r1_1#2'], null);
  assert.equal(up['events/F1/ev_r1'], null);
});
