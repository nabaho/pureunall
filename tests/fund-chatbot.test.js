/* 고용노동부 유권해석 · 근로복지공단 지침 · 법령 챗봇 및 자기거래·겸직 점검 검사
 *
 * 지켜야 하는 것
 *  ① 지식베이스(fund_kb.js)는 근로복지기본법령, 고용노동부 예규 제169호, 근로복지공단 업무처리규정(제1375호),
 *    행정해석·국민신문고 회신을 빠짐없이 갖추고, 모든 항목에 법령·문서번호 근거를 둔다.
 *  ② 챗봇 검색 엔진(PuFundAsk)은 핵심 실무 질의에 정확한 유권해석·지침 항목을 최상위로 찾고,
 *    RAG 절 단위 발췌(extractRelevantChunk)로 질문에 필요한 절만 깔끔하게 뽑아내며,
 *    AI 응답에 없는 인용번호(환각)는 걸러낸다.
 *  ③ 챗봇 창(openFundChat)은 드래그 이동 가능한 플로팅 메신저 창(#kbChatWin)으로 열리고,
 *    초기 화면에 질문 버튼 목록이나 불필요한 원문 카드 더미를 나열하지 않는다.
 *  ④ 등기임원 명부(officerPanel)는 감사 겸직 금지(예규 제169호 제8조④)를, 대부 대장(loanTab)은
 *    이사의 자기거래 금지(법 제78조)를 현장에서 짚어 준다.
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

function loadKb() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(KB_SRC, ctx);
  return ctx.window;
}

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

test('★★ 지식베이스(FUND_KB)는 8개 세부 분류·40건 이상의 법령·예규·공단 지침·유권해석을 갖춘다', () => {
  const W = loadKb();
  assert.ok(Array.isArray(W.FUND_KB_CATS) && W.FUND_KB_CATS.length >= 9, '전체 + 8개 세부 분류가 있어야 한다');
  assert.ok(Array.isArray(W.FUND_KB) && W.FUND_KB.length >= 40, '최소 40건 이상의 심층 해석·지침이 수록되어야 한다');
  assert.ok(Array.isArray(W.FUND_KB_QUICK) && W.FUND_KB_QUICK.length >= 12, '빠른 질문 칩이 있어야 한다');

  const catIds = new Set(W.FUND_KB_CATS.map(c => c[0]).filter(k => k !== 'all'));
  const seenIds = new Set();
  W.FUND_KB.forEach(it => {
    assert.ok(it.id && !seenIds.has(it.id), '고유 ID가 있어야 한다: ' + it.id);
    seenIds.add(it.id);
    assert.ok(catIds.has(it.cat), '유효한 분류여야 한다: ' + it.cat);
    ['title', 'q', 'a', 'law', 'docNo', 'source'].forEach(k => {
      assert.ok(typeof it[k] === 'string' && it[k].trim().length > 2, it.id + ' 에 ' + k + ' 필드가 비어 있다');
    });
    assert.ok(Array.isArray(it.points) && it.points.length >= 2, it.id + ' 에 실무 체크포인트가 있어야 한다');
    assert.ok(Array.isArray(it.tags) && it.tags.length >= 2, it.id + ' 에 검색 태그가 있어야 한다');
  });

  /* 분류마다 최소 3건 이상 수록 */
  catIds.forEach(cid => {
    const cnt = W.FUND_KB.filter(x => x.cat === cid).length;
    assert.ok(cnt >= 3, cid + ' 분류 항목이 부족하다: ' + cnt);
  });
});

test('★★ 핵심 실무 질의 14가지에 대해 정확한 유권해석·지침을 최상위로 찾는다', () => {
  const W = loadKb();
  const cases = [
    ['적자 결손 기업도 사내근로복지기금을 설립할 수 있나요?', 'MOEL-setup-01'],
    ['기금 감사가 복지기금협의회 위원이나 이사를 겸직할 수 있나요?', 'MOEL-council-01'],
    ['기금 이사가 기금에서 근로자 대부를 받으면 자기거래 금지 위반인가요?', 'MOEL-council-02'],
    ['당해연도 출연금 사용한도 50% 80% 90% 기준은?', 'MOEL-contrib-01'],
    ['근로복지공단 지원금이나 보조금도 10% 기본재산 적립 의무가 있나요?', 'MOEL-contrib-02'],
    ['하계휴가비 체력단련비 차량유류비를 전 직원에게 일률 지급해도 되나요?', 'MOEL-welfare-01'],
    ['선택적 복지포인트 학자금 지원 시 근로소득세 증여세 과세 기준은?', 'MOEL-welfare-05'],
    ['근로자 개인형 퇴직연금 IRP 계좌에 기금이 추가 부담금을 지원할 수 있나요?', 'MOEL-welfare-02'],
    ['공동근로복지기금 지원금 심사점수별 지원율과 규모별 지원한도는?', 'COMWEL-sub-01'],
    ['특수관계인이나 기업분할 회사가 세운 공동기금도 공단 지원금을 받나요?', 'COMWEL-sub-02'],
    ['고유목적사업준비금1과 준비금2 차이 및 5년 사용기한은?', 'MOEL-closing-02'],
    ['예금이자 원천징수 환급 시 별지56호 간이신고와 별지1호 일반신고 차이는?', 'MOEL-closing-03'],
    ['사내기금이 공동기금 설립으로 해산할 때 모회사 귀속 재산 회계과목 구분승계(1AA-2410-0478013)', 'MOEL-dissolve-04'],
    ['공동기금 참여기업 개별 중간탈퇴 법정 사유와 별지 제14호의2 3주 기한은?', 'MOEL-dissolve-05']
  ];
  cases.forEach(([q, expectedId]) => {
    const picked = W.PuFundAsk.pick(W.FUND_KB, q, { max: 3 });
    assert.ok(picked.length >= 1, '검색 결과가 없다: ' + q);
    const ids = picked.map(x => x.id);
    assert.ok(ids.includes(expectedId), `질문 "${q}" 에 ${expectedId} 가 상위 3건 안에 없다 (결과: ${ids.join(',')})`);
  });
});

test('★★ PuFundAsk.localAnswer · extractRelevantChunk · makePrompt · parseReply 가 필요한 절만 발췌하고 환각 인용을 걸러낸다', () => {
  const W = loadKb();
  const picked = W.PuFundAsk.pick(W.FUND_KB, '감사 겸직 금지', { max: 2 });
  const loc = W.PuFundAsk.localAnswer(picked, '감사 겸직 금지');
  assert.equal(loc.none, false);
  assert.ok(loc.cites.includes('MOEL-council-01'));
  assert.match(loc.answer, /감사/);

  const emptyLoc = W.PuFundAsk.localAnswer([], '아무상관없는질문');
  assert.equal(emptyLoc.none, true);

  const pr = W.PuFundAsk.makePrompt(picked, '감사 겸직이 가능한가요?');
  assert.match(pr.system, /근로복지기금/);
  assert.match(pr.user, /MOEL-council-01/);

  /* AI 응답에 picked 에 없는 가짜 ID(MOEL-FAKE-99)가 섞여도 걸러내야 한다 */
  const parsed = W.PuFundAsk.parseReply('{"answer":"감사는 겸직할 수 없습니다.","cites":["MOEL-council-01","MOEL-FAKE-99"],"none":false}', picked);
  assert.deepEqual(Array.from(parsed.cites), ['MOEL-council-01']);
  assert.match(parsed.answer, /감사는 겸직할 수 없습니다/);

  /* RAG 절(①·②·③) 단위 정밀 발췌: 질문과 관련된 절만 발췌하고 무관한 절·타 항목은 노출하지 않는다 */
  const loanQ = '공단 지원금으로 근로자 대부사업을 할 수 있나요?';
  const loanPicked = W.PuFundAsk.pick(W.FUND_KB, loanQ, { max: 2 });
  assert.equal(loanPicked[0].id, 'COMWEL-sub-05');
  const loanAns = W.PuFundAsk.localAnswer(loanPicked, loanQ);
  assert.match(loanAns.answer, /대부사업/);
  assert.doesNotMatch(loanAns.answer, /사업계획서 변경 사전신고 의무/, '질문과 무관한 ②절이 섞여 나오면 안 된다');
  assert.doesNotMatch(loanAns.answer, /점검 후 사후관리/, '질문과 무관한 ③절이 섞여 나오면 안 된다');
  assert.doesNotMatch(loanAns.answer, /심사점수 구간별 지원율/, '무관한 타 항목이 섞여 나오면 안 된다');
});

test('★★ 등기임원 명부(officerPanel)는 감사와 이사·위원 겸직(예규 제169호 제8조④)을 경고한다', () => {
  const box = {};
  new Function('F', [
    'function esc(s){ return String(s==null?"":s); }',
    'function hlp(k){ return "<i>"+k+"</i>"; }',
    grabDecl('OFFICER_ROLES'),
    grabFn('_officersOf'), grabFn('_auditorsOf'), grabFn('_boss'), grabFn('_offRow'),
    grabFn('officerPanel'),
    'this.run = officerPanel;'
  ].join('\n')).call(box);

  const bad = box.run({
    chairman: '가대표',
    officers: [
      { role: '이사장', name: '가대표' },
      { role: '사용자측 이사', name: '나겸직' },
      { role: '사용자측 감사', name: '나겸직' },
      { role: '근로자측 감사', name: '다감사' }
    ]
  });
  assert.match(bad, /감사 겸직 금지 위반 의심.*나겸직/, '감사가 이사를 겸직했는데 경고가 안 뜬다');

  const good = box.run({
    chairman: '가대표',
    officers: [
      { role: '이사장', name: '가대표' },
      { role: '사용자측 감사', name: '나감사' },
      { role: '근로자측 감사', name: '다감사' }
    ]
  });
  assert.doesNotMatch(good, /감사 겸직 금지 위반 의심/, '겸직이 아닌데 경고가 떴다');
});

test('★★ 대부 대장(loanSelfDealHits)은 등기임원(이사·감사)에게 나간 미상환 대부를 자기거래(법 제78조)로 짚어 준다', () => {
  const box = {};
  new Function([
    grabFn('num'), grabFn('loanBal'), grabFn('_officersOf'), grabFn('loanSelfDealHits'),
    'this.hits = loanSelfDealHits;'
  ].join('\n')).call(box);

  const fund = {
    chairman: '가이사장',
    officers: [
      { role: '이사장', name: '가이사장' },
      { role: '근로자측 이사', name: '나이사' },
      { role: '근로자대표', name: '다위원' }
    ]
  };
  const loans = [
    { name: '나이사', amount: 10000000, paid: { 2025: 2000000 } }, // 미상환 800만 -> 적발
    { name: '가이사장', amount: 5000000, paid: { 2025: 5000000 } }, // 완제(잔액 0) -> 제외
    { name: '다위원', amount: 3000000 }, // 협의회 위원(등기 이사·감사 아님) -> 제외
    { name: '일반근로자', amount: 4000000 }
  ];
  const res = box.hits(loans, fund);
  assert.equal(res.length, 1);
  assert.equal(res[0].name, '나이사');
  assert.equal(res[0].bal, 8000000);
});

test('★★ fund.html 에 드래그 이동형 메신저 챗봇(#kbChatWin)과 자료실 탭이 배선되어 있다', () => {
  assert.match(SRC, /<script src="fund_kb\.js/, 'fund_kb.js 가 로드되지 않았다');
  assert.ok(SRC.includes('id="kbchatbtn"'), '상단바에 챗봇 단추가 없다');
  assert.ok(SRC.includes('function openFundChat('), 'openFundChat 함수가 없다');
  assert.ok(SRC.includes('function closeFundChat('), 'closeFundChat 함수가 없다');
  assert.ok(SRC.includes('function bindKbChatDrag('), '드래그 이동 함수 bindKbChatDrag 가 없다');
  assert.ok(SRC.includes('id="kbChatHead"'), '드래그 헤더(#kbChatHead)가 없다');
  assert.ok(SRC.includes('function askFundBot('), 'askFundBot 함수가 없다');
  assert.ok(SRC.includes('function renderFundKbPanel('), 'renderFundKbPanel 함수가 없다');
  assert.ok(SRC.includes("'lib.chat':{t:"), 'lib.chat 도움말이 없다');
  assert.ok(SRC.includes("hlp('lib.chat')"), 'lib.chat 도움말 단추가 호출되지 않았다');

  /* openFundChat 은 고정 모달(showModal)이나 질문 칩 목록(_kbQuick)을 화면에 깔지 않아야 한다 */
  const openSrc = grabFn('openFundChat');
  assert.doesNotMatch(openSrc, /showModal\(/, 'openFundChat 이 고정 모달을 열면 안 된다');
  assert.doesNotMatch(openSrc, /_kbQuick\(/, 'openFundChat 초기 화면에 질문 목록을 나열하면 안 된다');

  /* _kbTurnHtml 은 불필요한 원문 카드 더미(<details open>)를 자동 펼치지 않아야 한다 */
  const turnSrc = grabFn('_kbTurnHtml');
  assert.doesNotMatch(turnSrc, /<details/, '_kbTurnHtml 이 하단에 원문 카드 더미를 나열하면 안 된다');
});
