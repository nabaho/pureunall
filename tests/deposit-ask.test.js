// 💬 누구 입금인가요? (대표 「시안대로」 2026-10-24)
// 「아직 정리 안 된 건은 담당 직원이 한 번에 체크해서 정리 가능하게」
// 「개인이 입금하는 경우(체불·대지급금) 이알피에 대표자만 있고 개인은 없는 경우가 많다」
// 전: 짝 찾기가 사건 근로자 명단·대표자 이름을 안 봐서, 명단에 있는 근로자 입금도 «후보 없음»이었다.
//     후보 없는 입금은 재무만 볼 수 있어, 누구 건인지 아는 담당 직원에게 물을 길이 없었다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripComments } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const SRC = stripComments(RAW);
function take(name){
  const i = RAW.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 를 못 찾았습니다');
  let d = 0; const j = RAW.indexOf('{', i);
  for(let k = j; k < RAW.length; k++){ if(RAW[k] === '{') d++; else if(RAW[k] === '}'){ d--; if(!d) return RAW.slice(i, k + 1); } }
}
const line = re => { const m = RAW.match(re); assert.ok(m, String(re)); return m[0]; };

function load(store){
  const ctx = { console, Math, JSON, Object, String, parseInt, window:{} };
  vm.createContext(ctx);
  vm.runInContext([
    line(/var ERP_MEMO_NOISE = \[[^\]]*\];/), line(/var ERP_BANK_WORDS = \[[^\]]*\];/), 'var _erpCleanCache = {};',
    line(/var DEP_ASK_KEY = '[^']+';/), line(/var DEP_ASK_STORES = \[[^\n]*\];/),
    ...['_erpStripNoiseWord', 'erpNormName', 'erpCleanMemo', 'erpLcsLen', '_erpNameCmp', 'erpMemoPayerName', 'erpPayerPeople',
      'erpMatchScore', 'erpBankRowKey', 'erpDepAskId', 'erpDepAskWanted', 'erpDepAskMake', 'erpDepAskOpenFor', 'erpDepAskMyItems',
      'erpDepAskGuess', 'erpDepAskAnswerFields', 'erpDepAskNeedsWorker', 'erpDepAskSync'].map(take),
    'function erpAliasEvidence(){ return null; } function erpAmountFingerprint(){ return null; } function erpInvoiceMatch(){ return null; }',
    'function erpIsCmsMemo(m){ return /더빌|CMS|집금/.test(String(m)); }',
    /* 받을 돈 셈은 이 검사의 몫이 아니다 — 착수금 하나만 «안 받음»으로 돌려준다 */
    'function erpUnpaidParts(it){ return it.retainerFee && !it.retainerPaidDate ? [{ kind:"retainer", kindLabel:"착수금", fee:it.retainerFee, taxType:"", paid:0 }] : []; }',
    'function erpExpectAmount(fee){ return fee; }',
    'var STORE = ' + JSON.stringify(store || {}) + '; function dbGet(k, d){ return STORE[k] || d; }'
  ].join('\n'), ctx);
  return ctx;
}
const J = x => JSON.parse(JSON.stringify(x));   // 다른 realm 의 객체를 견줄 수 있게

test('① 적요에서 «보낸 사람» 이름만 — 계좌 끝자리·안내 글은 뺀다', () => {
  const c = load();
  assert.equal(c.erpMemoPayerName('계좌번호 680******45904 홍길동'), '홍길동');
  assert.equal(c.erpMemoPayerName('입금 165,000원 계좌번호 680******45904 적요 주식회사가나'), '주식회사가나');
  assert.doesNotMatch(c.erpMemoPayerName('계좌번호 680******45904 홍길동'), /\d{3,}|\*/, '★★ 직원에게 계좌 자리가 보입니다');
});

test('② ★★ 사건 근로자 명단·대표자 이름이 꼭 같으면 후보 — 금액까지 같으면 초록(90 이상)', () => {
  const c = load();
  const txn = { date:'2026-08-24', amount:655100, memo:'계좌번호 680******45904 홍길동' };
  const withList = c.erpMatchScore(txn, { companyName:'가나엔지니어링', expect:655100, item:{ workers:[{ name:'홍길동' }] } });
  const without  = c.erpMatchScore(txn, { companyName:'가나엔지니어링', expect:655100, item:{ workers:[] } });
  assert.ok(withList.score >= 90, '★★ 명단에 있는데도 초록이 아닙니다 — 받음 ' + withList.score);
  assert.ok(withList.reasons.indexOf('근로자 명단 일치') >= 0, '★ 왜 짝인지 말하지 않습니다');
  assert.ok(without.score < withList.score, '명단이 없을 때와 차이가 없습니다');
  const ceo = c.erpMatchScore({ date:'2026-09-01', amount:77000, memo:'계좌번호 680******45904 김대표(가나의원' },
    { companyName:'가나의원', expect:77000, item:{ ceo:'김대표' } });
  assert.ok(ceo.reasons.indexOf('대표자 이름 일치') >= 0, '★ 대표자 이름을 안 봅니다');
});

test('③ ★★ 사람 이름은 «꼭 같을 때만» — 「홍길」이 「홍길동」에 걸리면 남의 돈이 된다', () => {
  const c = load();
  const r = c.erpMatchScore({ date:'2026-08-24', amount:1000, memo:'계좌번호 680******45904 홍길동' },
    { companyName:'다른회사', expect:0, item:{ workers:[{ name:'홍길' }], ceo:'길' } });
  assert.equal(r.reasons.indexOf('근로자 명단 일치'), -1, '★★ 부분 일치로 근로자 짝을 지었습니다');
  assert.equal(r.nameScore, 0);
});

test('④ 묻는 줄은 «후보 없음»만 — CMS·보류·이미 처리·취소는 묻지 않는다', () => {
  const c = load();
  const row = { _k:'k1', date:'2026-10-16', amount:20000, memo:'계좌번호 680******45904 박민수' };
  assert.equal(c.erpDepAskWanted(row, { state:'none' }, {}), true);
  assert.equal(c.erpDepAskWanted(row, { state:'check' }, {}), false, '★ 후보가 있는 줄까지 묻습니다');
  assert.equal(c.erpDepAskWanted(row, { state:'none' }, { k1:1 }), false, '★ 보류함 줄을 묻습니다');
  assert.equal(c.erpDepAskWanted(Object.assign({}, row, { _dup:true }), { state:'none' }, {}), false);
  assert.equal(c.erpDepAskWanted(Object.assign({}, row, { memo:'더빌이체3572' }), { state:'none' }, {}), false, '★ CMS 를 사람에게 묻습니다');
});

test('⑤ ★★ 물음에는 날짜·금액·이름만 — 잔액·적요 전문을 싣지 않는다(직원 누구나 읽는다)', () => {
  const c = load();
  const rec = J(c.erpDepAskMake({ _k:'bank|income|x', date:'2026-10-16 14:25', amount:20000, balance:35976775,
    memo:'계좌번호 680******45904 박민수', note:'하나은행 문자', originId:'abc' }, { sid:'A-1', name:'재무' }, '2026-10-24T00:00:00Z'));
  assert.equal(rec.payer, '박민수'); assert.equal(rec.date, '2026-10-16'); assert.equal(rec.status, 'ask');
  ['balance', 'memo', 'note', 'originId'].forEach(k => assert.ok(!(k in rec), '★★ 물음에 ' + k + ' 가 실렸습니다'));
  ['id', 'entityType', 'createdAt', 'updatedAt'].forEach(k => assert.ok(rec[k], '온톨로지 필수 칸 ' + k + ' 이 없습니다'));
  assert.equal(c.erpDepAskId('same'), c.erpDepAskId('same'), '같은 줄을 두 번 물으면 두 줄이 됩니다');
});

test('⑥ 내 건 짐작 — 이름·금액이 같은 것을 위로, 자문료는 «입금한 달»로 답한다', () => {
  const c = load({
    cases:[{ id:'c1', companyName:'가나산업', title:'임금체불', managerMain:'P-1', retainerFee:220000, workers:[{ name:'홍길동' }] },
           { id:'c2', companyName:'남의사건', managerMain:'P-9', retainerFee:220000 }],
    companies:[{ id:'co1', name:'다라상회', status:'active', managerMain:'P-1', monthlyAdvisoryFee:110000 }]
  });
  const items = c.erpDepAskMyItems('P-1');
  assert.ok(items.every(i => i.sourceId !== 'c2'), '★ 남의 담당 건이 내 목록에 섞입니다');
  const g1 = c.erpDepAskGuess({ payer:'홍길동', amount:220000 }, items);
  assert.equal(g1.item.pid, 'c1-r'); assert.equal(g1.score, 3);
  assert.equal(c.erpDepAskGuess({ payer:'모르는이', amount:5 }, items), null, '★ 아무것도 안 닮았는데 내 건이라 합니다');
  const adv = items.find(i => i.advisory);
  const f = J(c.erpDepAskAnswerFields({ date:'2026-09-30' }, adv, { sid:'P-1', name:'직원' }, false, 'T'));
  assert.equal(f.answer.pid, 'adv-co1-2026-09', '★ 자문료 답이 거래내역 후보 번호 꼴이 아닙니다');
  assert.equal(f.status, 'answered');
});

test('⑦ 근로자 명단에 넣기 — 사건에서, 명단·업체명에 없는 사람 이름일 때만', () => {
  const c = load({ cases:[{ id:'c1', companyName:'가나산업', managerMain:'P-1', retainerFee:1, workers:[{ name:'홍길동' }] }] });
  const it = c.erpDepAskMyItems('P-1')[0];
  assert.equal(c.erpDepAskNeedsWorker({ payer:'이몽룡' }, it), true);
  assert.equal(c.erpDepAskNeedsWorker({ payer:'홍길동' }, it), false, '이미 명단에 있는데 또 넣습니다');
  assert.equal(c.erpDepAskNeedsWorker({ payer:'주식회사가나' }, it), false, '회사 이름을 근로자로 넣습니다');
});

test('⑧ ★★ 재무 쪽 — 답은 «골라 둔 짝»까지만, 처리된 줄은 닫고, 받을 돈이 없어진 답은 확정하지 않는다', () => {
  const c = load();
  const asks = [
    { id:'a1', rowK:'r1', bankKey:'b1', status:'answered', answer:{ pid:'c1-r', by:'P-1', byName:'직원' } },
    { id:'a2', rowK:'r2', bankKey:'b2', status:'ask' },
    { id:'a3', rowK:'r3', bankKey:'b3', status:'answered', answer:{ pid:'gone-r', by:'P-1' } },
    { id:'a4', rowK:'r4', bankKey:'b4', status:'answered', answer:{ pid:'c1-r', by:'P-1' } }
  ];
  const plan = J(c.erpDepAskSync(asks, { r4:{ pid:'x', by:'A' } }, { 'c1-r':{} }, { b2:{} }, 'T'));
  assert.deepEqual(plan.toPick.map(p => p.rowK), ['r1'], '★★ 남이 이미 골라 둔 짝을 덮거나, 답을 짝으로 안 받습니다');
  assert.equal(plan.toPick[0].who.sid, 'P-1', '★ 누가 답했는지 짝에 안 남깁니다');
  const st = Object.fromEntries(plan.toPatch.map(x => [x.id, x.fields.status]));
  assert.equal(st.a2, 'done', '★ 확정된 줄의 물음이 직원 화면에 그대로 남습니다');
  assert.equal(st.a3, 'stale', '★★ 이미 받은 건으로 답한 것을 짝으로 받습니다');
  assert.equal(st.a1, 'picked');
});

test('⑨ 이어 붙임 — 동기화·건별 저장·규칙·나의 업무·거래내역', () => {
  const sync = SRC.match(/var FB_ALL_SYNC_KEYS = \[([\s\S]*?)\];/);
  assert.ok(sync && /'deposit_asks'/.test(sync[1]), '★★ 동기화 목록에 없어 다른 PC 에 물음이 안 갑니다');
  assert.match(SRC.match(/var DIFF_KEYS = \[[^\]]*\]/)[0], /'deposit_asks'/, '★ 건별 저장이 아니라 두 직원이 동시에 답하면 하나가 지워집니다');
  const rules = require('../docs/rules-paste.json');
  assert.ok(rules.rules.data.deposit_asks, '★ 규칙에 이름이 없습니다');
  const desk = SRC.slice(SRC.indexOf('function MyDeskV2('), SRC.indexOf('function MyDeskV2(') + 40000);
  assert.match(desk, /h\(DepositAskBox,/, '★★ 나의 업무에 확인함이 안 뜹니다');
  const box = SRC.slice(SRC.indexOf('function DepositAskBox('), SRC.indexOf('function MyDeskV2('));
  assert.doesNotMatch(box, /LEDGER_PICK_KEY|finance_income|saveIncome/, '★★ 직원 화면이 재무 칸에 직접 씁니다 — 확정은 재무가 합니다');
  assert.match(box, /type:'checkbox'/, '☐ 고르기 칸이 없습니다(대표 지시 2026-10-05)');
  assert.match(SRC, /erpDepAskSync\(_dAsks,/, '★ 거래내역이 직원 답을 안 받습니다');
  assert.match(SRC, /dbUpsertMany\(DEP_ASK_KEY,/, '★ 거래내역에서 물을 길이 없습니다');
  assert.match(SRC, /_erpCanFin\(\)\) return;/, '★★ 재무 권한 없는 기기가 짝 자리를 고치려 합니다');
});
