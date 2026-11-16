/* 주식출연·보유주식 소각 쉬운 질의응답(easy 요약·세무·평가·신고반려) 및 과거 비식별 증빙·푸른메일 연결 검사
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 실제 기금명·사업장명·주주 실명·주민등록번호·주소·실제 숫자는 단 1글자도 금지.
 *   이 파일에 나오는 모든 상호·성명·주식수·금액·메일 정보는 100% 시험용 가상 데이터다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'fund.html'), 'utf8');
const FUND_KB_SRC = fs.readFileSync(path.join(ROOT, 'fund_kb.js'), 'utf8');
const PORTAL_KB_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-chatbot-kb.js'), 'utf8');

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

function loadKbBundle() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(FUND_KB_SRC, ctx);
  vm.runInContext(PORTAL_KB_SRC, ctx);
  return ctx.window;
}

function loadStockHistoryEngine() {
  const box = {};
  new Function([
    grabDecl('ACCT_CHART'), grabDecl('PURPOSE_ACCTS'), grabDecl('OPEN_ACCT'),
    grabDecl('ADMIN_ACCTS'), grabDecl('RESERVE_ACCTS'), grabDecl('F15_ROWS'),
    grabDecl('BF_KINDS'), grabDecl('STOCK_RETIRE_KINDS'), grabDecl('STOCK_DOC_KINDS'),
    'var funds={}, S={fundId:"F_MOCK", year:2026, closeSub:"stocks", stocksFor:"F_MOCK", stocks:{}};',
    'function hlp(k){ return "<span data-hlp=\\""+k+"\\"></span>"; }',
    'function loadingHTML(m){ return "<div>"+m+"</div>"; }',
    grabFn('num'), grabFn('esc'), grabFn('_n'), grabFn('won'),
    grabFn('_ckTh'), grabFn('_ckTd'), grabFn('dsDue'),
    grabFn('scrubStockPii'), grabFn('isStockSensitivePage'), grabFn('maskHolderName'),
    grabFn('_stockNum'), grabFn('_stockListOf'),
    grabFn('stockEasyGuideHTML'), grabFn('stockSummaryPanel'), grabFn('stockAsOfYear'),
    grabFn('isStockTxn'), grabFn('_stockJrKindOf'), grabFn('stockJournalRows'),
    grabFn('_stockListModalHTML'), grabFn('stocksCloseView'),
    grabFn('checkStockCleanText'), grabFn('hasStockRawRrn'), grabFn('stockMailHtmlToText'),
    grabFn('_jpegPagesToPdfBytes'),
    grabFn('scoreStockMailCandidate'), grabFn('_fmtStockMailDate'),
    grabFn('acctType'), grabFn('isDrAcct'), grabFn('_openingOf'),
    grabFn('_splitsOf'), grabFn('expandSplits'), grabFn('journalOf'), grabFn('acctMoves'),
    grabFn('openingMoves'), grabFn('computeFin'),
    'this.o={S,stockEasyGuideHTML,stockSummaryPanel,stockAsOfYear,stocksCloseView,_stockListModalHTML,',
    '  scrubStockPii,checkStockCleanText,hasStockRawRrn,stockMailHtmlToText,_jpegPagesToPdfBytes,scoreStockMailCandidate,computeFin,',
    '  setFund:function(id,o){funds[id]=o;}, setStocks:function(st){S.stocks=st;S.stocksFor=S.fundId;}};'
  ].join('\n')).call(box);
  return box.o;
}

test('쉬운 질의응답 — 주식출연·보유주식 소각·세금·상증세법 평가·신고반려 질의 시 평이한 요약(easy)이 최상단에 표시된다', () => {
  const W = loadKbBundle();
  const fkb = W.PuFundAsk;
  const pkb = W.PuChatbot;

  // 1) 주주 주식출연 절차 질의
  const r1 = fkb.pick(W.FUND_KB, '우리 회사 주주들이 기금에 주식을 무상으로 출연했는데 어떻게 신고하나요?');
  assert.ok(r1.length > 0 && r1[0].id === 'MOEL-contrib-06');
  const ans1 = fkb.localAnswer(r1, '주주 주식출연 기본재산 변경보고 쉽게 설명해줘');
  assert.match(ans1.answer, /쉽게 말하면/);
  assert.match(ans1.answer, /21일\(3주\)/);

  // 2) 주식소각 현금 유입 질의 (예시 금액 포함 쉬운 설명)
  const r2 = fkb.pick(W.FUND_KB, '출연받은 주식을 소각해서 기금 통장에 현금이 들어왔을 때 어떻게 처리하나요?');
  assert.ok(r2.some(x => x.id === 'MOEL-contrib-07'));
  const ans2 = fkb.localAnswer(r2, '주식 소각으로 현금이 입금된 경우 원금과 차익 처리');
  assert.match(ans2.answer, /쉽게 말하면/);
  assert.match(ans2.answer, /초과 차익/);
  assert.match(ans2.answer, /별지 제10호/);

  // 3) 세금·원천징수 15.4%·환급 질의
  const r3 = fkb.pick(W.FUND_KB, '주주가 주식을 기금에 출연하거나 유상소각할 때 증여세 양도세 원천징수 15.4% 세금 환급은?');
  assert.ok(r3.length > 0 && r3[0].id === 'MOEL-contrib-08');
  assert.ok(r3[0].easy && r3[0].easy.includes('비과세'));
  assert.ok(r3[0].easy.includes('15.4%') && r3[0].easy.includes('환급'));

  // 4) 비상장주식 평가가액·50%/80% 사용 불가·미이행 변경신고 반려 질의
  const r4 = fkb.pick(W.FUND_KB, '비상장주식 평가가액 기준과 주식을 팔기 전에 50% 80% 쓸 수 있는지, 미이행 시 변경신고 반려는?');
  assert.ok(r4.length > 0 && r4[0].id === 'MOEL-contrib-09');
  assert.ok(r4[0].easy && r4[0].easy.includes('상증세법'));
  assert.ok(r4[0].easy.includes('반려'));

  // 5) 포털 통합 챗봇(PuChatbot) 연동 확인
  const pr = pkb.pick('기금관리앱에서 과거 주식출연 서류와 푸른메일 확인 방법 및 주식소각 세금');
  assert.ok(pr.some(x => x.id === 'SYS-fund-stock-01' || x.id.startsWith('MOEL-contrib-0')));
  const pans = pkb.localAnswer(pr, '주식소각 현금 입금 세금 쉽게 설명');
  assert.match(pans.answer, /쉽게 말하면/);
});

test('회계·결산 전용 탭 상단 쉬운 설명 가이드(stockEasyGuideHTML)와 원클릭 챗봇 질문이 작동한다', () => {
  const E = loadStockHistoryEngine();
  const gOpen = E.stockEasyGuideHTML();
  assert.match(gOpen, /주식출연 · 보유주식 소각 · 현금유입 · 세금 한눈에 쉬운 설명/);
  assert.match(gOpen, /openFundChat\(/);
  assert.match(gOpen, /7억/);

  E.S._hideStockGuide = true;
  const gClosed = E.stockEasyGuideHTML();
  assert.match(gClosed, /펼치기/);
  assert.ok(!gClosed.includes('7억은 예금 원금으로'));
  E.S._hideStockGuide = false;
});

test('신고반려·미이행(withdrawn) 이력보존 묶음은 과거 주주·자료·메일 이력을 유지하되 재무상태표 장부 대사에서는 정확히 제외된다', () => {
  const E = loadStockHistoryEngine();
  E.setFund('F_MOCK', { name: '가나사내근로복지기금', years: { '2026': { opening: { secu: 0 } } } });
  E.setStocks({
    B_ACTIVE: {
      date: '2026-05-10',
      issuer: '가나주식회사',
      bf_kind: 'other',
      filing_status: 'completed',
      total_shares: 10000,
      remain_shares: 10000,
      book_amount: 500000000,
      remain_book: 500000000,
      holders: [{ holder: '김가나', kind: '보통주식', shares: 10000, ratio: 20, par_price: 5000, eval_price: 50000, eval_amount: 500000000 }],
      docs: { D1: { kind: 'cert', title: '출연확인서 클린본' } },
      mails: { M1: { source: 'imap', subject: '주식출연 서류 송부' } }
    },
    B_WITHDRAWN: {
      date: '2025-11-20',
      issuer: '다라건설주식회사',
      bf_kind: 'other',
      filing_status: 'withdrawn',
      note: '명의개서 미이행으로 관할 노동지청 변경신고 반려 요청 공문 제출(이력보존)',
      total_shares: 20000,
      remain_shares: 0,
      book_amount: 800000000,
      remain_book: 0,
      holders: [{ holder: '박다라', kind: '보통주식', shares: 20000, ratio: 30, par_price: 5000, eval_price: 40000, eval_amount: 800000000 }],
      docs: { D2: { kind: 'reject', title: '변경신고 반려 요청 공문' } },
      mails: { M2: { source: 'imap', subject: '변경신고 반려 요청의 건' } }
    }
  });

  const sum = E.stockAsOfYear([
    Object.assign({ _id: 'B_ACTIVE' }, E.S.stocks.B_ACTIVE),
    Object.assign({ _id: 'B_WITHDRAWN' }, E.S.stocks.B_WITHDRAWN)
  ], 2026);
  assert.equal(sum.asOfShares, 10000, '정상 보유분만 기말 보유주식수에 합산되어야 한다');
  assert.equal(sum.asOfBook, 500000000, '신고반려분(8억)은 기말 장부가에서 제외되어야 한다');
  assert.equal(sum.withdrawnCount, 1, '신고반려 이력 건수가 집계되어야 한다');

  const txns = [{
    _id: 'st_B_ACTIVE', date: '2026-05-10', amount: 500000000, nocash: 1, manual: 1,
    debit: '매도가능증권', credit: '기본재산', approved: true, stock_batch: 'B_ACTIVE'
  }];
  const viewHtml = E.stocksCloseView(txns);
  assert.match(viewHtml, /매도가능증권 장부·원장 대사 일치/);
  assert.match(viewHtml, /신고반려·미이행\(이력보존\)/);
  assert.match(viewHtml, /📎 자료 1/);
  assert.match(viewHtml, /📨 메일 1/);
  assert.match(viewHtml, /명의개서 미이행으로 관할 노동지청 변경신고 반려 요청/);
});

test('클린 증빙서류 보안 검증(checkStockCleanText)과 푸른메일 매칭 점수(scoreStockMailCandidate)가 정확히 동작한다', () => {
  const E = loadStockHistoryEngine();

  // 1) 인감증명서 파일명 차단
  const badName = E.checkStockCleanText([], '주주_인감증명서_스캔.pdf');
  assert.equal(badName.ok, false);

  // 2) 페이지 본문 내 인감증명서 또는 주민등록번호 포함 시 차단
  const badSeal = E.checkStockCleanText([
    { page: 1, text: '기금출연확인서 보통주식 5,000주' },
    { page: 2, text: '인 감 증 명 서 발행번호 제1234호 사용용도 기금출연' }
  ], '출연확인서묶음.pdf');
  assert.equal(badSeal.ok, false);
  assert.equal(badSeal.blocked[0].page, 2);

  const badRrn = E.checkStockCleanText([
    { page: 1, text: '주주명부 홍길동 790304-1234567 보통주 5,000주' }
  ], '주주명부.pdf');
  assert.equal(badRrn.ok, false);
  assert.match(badRrn.blocked[0].reason, /주민등록번호/);

  // 3) 비식별 마스킹 완료된 클린 문서는 통과
  const cleanDoc = E.checkStockCleanText([
    { page: 1, text: '기 금 출 연 확 인 서 소유주식의 종류 보통주식 출연주식의 수 5,000주' },
    { page: 2, text: '주 주 명 부 성명 홍길동 생년월일 790304-******* 주식수 5,000주' }
  ], '클린_출연확인서_및_비식별주주명부.pdf');
  assert.equal(cleanDoc.ok, true);
  assert.equal(cleanDoc.blocked.length, 0);

  // 4) 푸른메일 매칭 점수 검증
  const hitScore = E.scoreStockMailCandidate(
    { s: '[가나사내근로복지기금] 주주 주식출연 확인서 및 상증법 평가보고서 송부', p: '기본재산 변경보고 첨부서류', f: '김담당', a: 2 },
    ['가나', '가나주식회사']
  );
  const missScore = E.scoreStockMailCandidate(
    { s: '타사 연말정산 안내', p: '주식출연 문의', f: '박담당', a: 1 },
    ['가나', '가나주식회사']
  );
  assert.ok(hitScore >= 7, '기금명과 주식출연 키워드·첨부가 모두 있으면 높은 점수를 받는다');
  assert.equal(missScore, 0, '해당 기금·발행회사 키워드가 없으면 연결 후보에서 제외된다');
});

test('묶음 삭제(delStockBatch) 및 설립중 기금 삭제(_deleteSetupFund) 시 stock_blobs 보안 노드도 함께 정리된다', () => {
  const delBatchSrc = grabFn('delStockBatch');
  assert.match(delBatchSrc, /stock_blobs\/'\+fid\+'\/'\+did/);
  const delSetupSrc = grabFn('_deleteSetupFund');
  assert.match(delSetupSrc, /stock_blobs\/'\+fid/);
});

test('보안 회귀 — 비구분 13자리·공백구분 주민번호, 미판독 페이지, HWP·판독실패·31쪽 이후 민감정보를 모두 fail-closed 로 차단하고 비식별 PDF를 재합성한다', async () => {
  const E = loadStockHistoryEngine();

  // 1) 하이픈 없는 13자리, 공백 구분, 점 구분 주민등록번호 및 운전면허번호 차단 + 마스킹 통일 + 빈 스캔 차단
  assert.equal(E.checkStockCleanText([{ page: 1, text: '홍길동 7903041234567 보통주' }], '주주명부.pdf').ok, false);
  assert.equal(E.checkStockCleanText([{ page: 1, text: '홍길동 790304 2234567 보통주' }], '주주명부.pdf').ok, false);
  assert.equal(E.checkStockCleanText([{ page: 1, text: '홍길동 790304.1234567 보통주' }], '주주명부.pdf').ok, false);
  assert.equal(E.checkStockCleanText([{ page: 1, text: '면허 11-22-333333-44' }], '확인서.pdf').ok, false);
  assert.equal(E.checkStockCleanText([{ page: 1, text: '   ' }], '빈스캔.jpg', 1).ok, false, '문자 판독 불가 빈 이미지는 차단되어야 한다');
  assert.doesNotMatch(E.scrubStockPii('주주 790304.1234567'), /790304\.1234567/, '마침표 구분 주민번호도 마스킹되어야 한다');

  // 1-b) 포털 챗봇 동적 fund_kb.js 캐시 버전이 fund.html 과 일치해야 한다
  const chatbotSrc = fs.readFileSync(path.join(ROOT, 'js/pu-chatbot.js'), 'utf8');
  const fundKbTagVer = (SRC.match(/fund_kb\.js\?v=(\d+)/) || [])[1];
  const dynKbTagVer = (chatbotSrc.match(/fund_kb\.js\?v=(\d+)/) || [])[1];
  assert.ok(fundKbTagVer && fundKbTagVer === dynKbTagVer, `fund_kb.js 캐시 버전 일치 필요: fund.html(${fundKbTagVer}) vs js/pu-chatbot.js(${dynKbTagVer})`);

  // 1-c) 회계·결산 주식출연·소각 탭 분개 표가 1280px 에서 넘치지 않도록 overflow-x:auto 래퍼를 사용한다
  const closeViewSrc = grabFn('stocksCloseView');
  assert.doesNotMatch(closeViewSrc, /class="ledgerwrap"/, 'stocksCloseView 분개 표는 넓은 화면에서 풀리는 ledgerwrap 대신 overflow-x:auto tblwrap 을 사용한다');

  // 2) expectedPages 보다 판독된 페이지가 적거나 0쪽이면 fail-closed 차단
  assert.equal(E.checkStockCleanText([], '빈문서.pdf', 2).ok, false);
  assert.equal(E.checkStockCleanText([{ page: 1, text: '출연확인서' }], '일부누락.pdf', 2).ok, false);

  // 3) 외부 메일 HTML 본문 추출 시 이벤트 속성(img onerror 등) 실행 없이 순수 텍스트만 안전 추출
  let domCreated = false;
  const xssHtml = '<div>안녕하세요<style>.x{color:red}</style><script>window.pwn=1</script><img src="https://evil.example/x" onerror="window.pwn=2"><p>주식출연 안내드립니다.</p></div>';
  const safeTxt = E.stockMailHtmlToText(xssHtml);
  assert.equal(domCreated, false);
  assert.match(safeTxt, /안녕하세요/);
  assert.match(safeTxt, /주식출연 안내드립니다/);
  assert.doesNotMatch(safeTxt, /onerror|script|evil\.example/);
  const fetchMailSrc = grabFn('fetchLiveStockMail');
  assert.doesNotMatch(fetchMailSrc, /innerHTML\s*=\s*String\(j\.html\)/, '실제 document 요소 innerHTML에 외부 메일 HTML을 직접 대입하지 않는다');

  // 4) 단일 이미지 PDF 재합성(_jpegPagesToPdfBytes) 구조 검증
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdfBytes = E._jpegPagesToPdfBytes([{ bytes: fakeJpeg, width: 1080, height: 1520 }]);
  const pdfHeader = Buffer.from(pdfBytes.slice(0, 8)).toString('ascii');
  const pdfTail = Buffer.from(pdfBytes.slice(-16)).toString('ascii');
  assert.match(pdfHeader, /^%PDF-1\.4/);
  assert.match(pdfTail, /%%EOF\s*$/);

  // 5) uploadStockCleanDocs VM 통합 검증: HWP 거부 · OCR 실패 거부 · 34쪽 민감정보 차단 · 35쪽 클린본 저장
  const writes = [];
  const toasts = [];
  let ocrShouldFail = false;
  let page34Sensitive = false;
  let simTotalPages = 35;
  const domMap = {};
  const ctx = {
    STOCK_DOC_KINDS: [['cert', '출연확인서']],
    STOCK_DOC_MAX_PAGES: 50,
    _stockBlobUrl: '', _stockMailSearchHits: [], _stockLiveMailAtts: {},
    _stockModalBusy: false, _stockPrevFocus: null, _stockModalKeyFn: null,
    NS: 'fund_erp',
    funds: { F_TEST: { name: '테스트사내기금', short_name: '테스트사내' } },
    S: { fundId: 'F_TEST', user: 'tester', stocksFor: 'F_TEST', stocks: { b1: { issuer: '가나(주)', date: '2026-01-10', docs: {}, mails: {} } } },
    $: (id) => domMap[id] || null,
    document: {
      activeElement: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({
        id: '', style: {}, setAttribute() {}, querySelectorAll: () => [],
        remove() {}
      }),
      body: { appendChild(el) { domMap.modalbg = el; domMap.modalbox = { style: {}, innerHTML: '', querySelectorAll: () => [] }; } }
    },
    showModal: (html) => {
      if (!domMap.modalbg) domMap.modalbg = { setAttribute() {}, remove() { delete domMap.modalbg; delete domMap.modalbox; } };
      domMap.modalbox = { style: {}, innerHTML: html, querySelectorAll: () => [] };
    },
    closeM: () => { if (domMap.modalbg) domMap.modalbg.remove(); },
    toast: (m, lv) => toasts.push({ m, lv }),
    hlp: () => '',
    loadingHTML: (m) => m || '',
    ymd: () => '2026-11-11',
    renderFund: () => {},
    _loadStocks: async () => {},
    _b64ToBytes: (b64) => new Uint8Array(Buffer.from(b64, 'base64')),
    _bytesToB64: (u8) => Buffer.from(u8).toString('base64'),
    _pdfPagesText: async () => ({
      total: simTotalPages,
      texts: Array.from({ length: simTotalPages }, () => '')
    }),
    pdfPageCanvases: async (_buf, total) => Array.from({ length: total }, () => ({
      width: 600, height: 800,
      toDataURL: () => 'data:image/jpeg;base64,/9j/2w=='
    })),
    imgCanvas: async () => ({
      width: 600, height: 800,
      toDataURL: () => 'data:image/jpeg;base64,/9j/2w=='
    }),
    ocrCanvases: async () => {
      if (ocrShouldFail) throw new Error('OCR 엔진 오류');
      return '기금출연확인서 보통주식 1,000주';
    },
    fbDb: {
      ref: () => ({
        push: () => ({ key: 'doc_new_1' }),
        update: async (up) => { writes.push(up); }
      })
    }
  };
  vm.createContext(ctx);
  vm.runInContext([
    grabFn('esc'), grabFn('_ckTh'), grabFn('_ckTd'),
    grabFn('isStockSensitivePage'), grabFn('scrubStockPii'),
    grabFn('_revokeStockBlobUrl'), grabFn('_stockDocKindLabel'),
    grabFn('hasStockRawRrn'), grabFn('checkStockCleanText'),
    grabFn('_jpegPagesToPdfBytes'), grabFn('_canvasToJpegBytes'),
    grabFn('_scanAndRebuildStockCleanDoc'),
    grabFn('_detachStockModalA11y'), grabFn('_attachStockModalA11y'), grabFn('_openOrRefreshStockModal'),
    grabFn('_renderStockDocsModal'), grabFn('_renderStockMailsModal'),
    grabFn('_fmtStockMailDate'), grabFn('searchStockMailsFromBox'),
    grabFn('uploadStockCleanDocs')
  ].join('\n'), ctx);

  // (a) HWP 파일 업로드 시 저장 거부 (writes === 0)
  await ctx.uploadStockCleanDocs('b1', [{ name: '출연확인서.hwp', size: 1024, type: '', arrayBuffer: async () => new ArrayBuffer(8) }]);
  assert.equal(writes.length, 0, 'HWP 미검증 포맷은 저장되지 않아야 한다');

  // (b) OCR 판독 오류 발생 시 빈 배열로 우회하지 않고 저장 거부 (writes === 0)
  ocrShouldFail = true;
  await ctx.uploadStockCleanDocs('b1', [{ name: '출연확인서.pdf', size: 2048, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(16) }]);
  assert.equal(writes.length, 0, 'OCR 판독 실패 시 저장되지 않아야 한다');
  ocrShouldFail = false;

  // (c) 31쪽 이후(34쪽)에 인감증명서가 포함된 35쪽 PDF 차단 (기존 30쪽 절단 한계 해소 검증)
  ctx._pdfPagesText = async () => ({
    total: 35,
    texts: Array.from({ length: 35 }, (_, idx) => (idx === 33 && page34Sensitive)
      ? '인 감 증 명 서 발행번호 제9988호 증명청 구청장 사용용도 제출용 주민등록번호 포함 본 문서는 인감증명법에 따라 발급됨 충분한길이확보텍스트'
      : '기금출연확인서 보통주식 1,000주 출연을 확인합니다 본 문서는 개인정보가 전혀 없는 깨끗한 확인서 페이지입니다 충분한길이확보텍스트입니다')
  });
  page34Sensitive = true;
  await ctx.uploadStockCleanDocs('b1', [{ name: '대량묶음.pdf', size: 4096, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(16) }]);
  assert.equal(writes.length, 0, '34쪽 민감정보도 전 페이지 검사로 차단되어야 한다');

  // (d) 35쪽 모두 깨끗한 PDF는 비식별 단일 이미지 PDF로 재합성되어 정상 저장 (writes === 1)
  page34Sensitive = false;
  await ctx.uploadStockCleanDocs('b1', [{ name: '클린대량묶음.pdf', size: 4096, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(16) }]);
  assert.equal(writes.length, 1, '전 페이지 통과 시에만 비식별 재합성본이 저장된다');

  // (e) 자료 ↔ 메일 모달 전환 및 일반 showModal(openStockModal) 이후 전환 시에도 중복 생성 없이 포커스 트랩이 등록된다
  let showModalCount = 0;
  let keydownRegistered = 0;
  ctx.document.addEventListener = (ev) => { if (ev === 'keydown') keydownRegistered++; };
  ctx.showModal = (html) => {
    showModalCount++;
    domMap.modalbg = { setAttribute() {}, remove() { delete domMap.modalbg; delete domMap.modalbox; } };
    domMap.modalbox = { style: {}, innerHTML: html, querySelectorAll: () => [] };
  };
  ctx.closeM();
  ctx._detachStockModalA11y();
  // 일반 showModal 로 먼저 모달이 열린 상태(openStockModal('list') 시뮬레이션)에서 자료 모달로 전환
  ctx.showModal('<div>기존 모달</div>');
  assert.equal(ctx._stockModalKeyFn, null);
  ctx._renderStockDocsModal('b1');
  assert.ok(ctx._stockModalKeyFn, '기존 모달 재사용 전환 시에도 포커스 트랩(_stockModalKeyFn)이 등록되어야 한다');
  assert.equal(keydownRegistered, 1);
  ctx._renderStockMailsModal('b1');
  ctx._renderStockDocsModal('b1');
  assert.equal(showModalCount, 1, '모달 전환·재렌더 시 중복 #modalbg 를 쌓지 않고 기존 모달을 갱신해야 한다');

  // (f) 푸른메일함 조회 권한 실패 시 검색 결과 없음으로 오안내하지 않고 오류 배너를 표시한다
  domMap.stMailDetail = { innerHTML: '' };
  ctx.fbDb = {
    ref: () => ({
      once: () => Promise.reject(new Error('PERMISSION_DENIED'))
    })
  };
  await ctx.searchStockMailsFromBox('b1');
  assert.match(domMap.stMailDetail.innerHTML, /푸른메일함 조회 실패.*PERMISSION_DENIED/);
});
