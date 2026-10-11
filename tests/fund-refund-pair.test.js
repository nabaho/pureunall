'use strict';
/* ↔ 입금 오류·환급 묶기 (2026-10-11, 대표 질문 「입금이 잘못되어 환급되는 경우」) — 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0, on = false;
  for (let k = SRC.indexOf('=', i); k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') { d++; on = true; } else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, k + 1) + ';'; } } };

const box = {};
new Function([
  "function num(v){ var n=Number(String(v==null?'':v).replace(/,/g,'')); return isFinite(n)?n:0; }",
  "function _splitsOf(x){ return (x&&x.splits)||[]; }",
  "function expandSplits(a){ return a; }",
  varSrc('ACCT_CHART'), varSrc('OPEN_ACCT'), fnSrc('_refundPair'), fnSrc('carryOpening'),
  'this.pair=_refundPair; this.carry=carryOpening; this.OPEN=OPEN_ACCT;',
].join('\n')).call(box);

const D = (o) => Object.assign({ date: '2025-01-06', deposit: 0, withdraw: 0, acct: '111' }, o);

test('★ 묶는 조건 — 입금 한 줄과 같은 금액의 출금 한 줄, 같은 통장, 환급이 입금 뒤', () => {
  const dep = D({ deposit: 14230000 }), wd = D({ withdraw: 14230000, date: '2025-01-20' });
  const r = box.pair(wd, dep);   // 순서와 상관없이
  assert.equal(r.ok, true); assert.equal(r.dep, dep); assert.equal(r.wd, wd); assert.equal(r.amt, 14230000);
  assert.equal(box.pair(dep, wd).ok, true, '같은 날 입·출금(이체와 다른 «정정»)도 묶인다');
  assert.equal(box.pair(dep, D({ withdraw: 14230000, date: '2025-01-06' })).ok, true);
});

test('★ 안 묶는 것 — 금액 다름·같은 방향·승인·쪼갠·이체·다른 통장·순서', () => {
  const dep = D({ deposit: 1000 });
  const why = (a, b) => { const r = box.pair(a, b); assert.equal(r.ok, false); return r.why; };
  assert.equal(why(dep, D({ withdraw: 999 })), 'diff', '금액이 다른데 묶인다(차액을 지어낸다)');
  assert.equal(why(dep, D({ deposit: 1000 })), 'dir');
  assert.equal(why(dep, dep), 'dir', '한 줄을 두 번 고른다');
  assert.equal(why(dep, D({ withdraw: 1000, approved: true })), 'appr', '이미 승인한 줄을 덮어쓴다');
  assert.equal(why(dep, D({ withdraw: 1000, splits: [{ acct: '지급수수료', amount: 1 }] })), 'split');
  assert.equal(why(dep, D({ withdraw: 1000, xfer: 1 })), 'xfer');
  assert.equal(why(dep, D({ withdraw: 1000, acct: '222' })), 'acct', '다른 통장은 이체다');
  assert.equal(why(dep, D({ withdraw: 1000, date: '2024-12-31' })), 'order', '환급이 입금보다 앞선다');
  assert.equal(why(D({ deposit: 5, withdraw: 5 }), D({ withdraw: 5 })), 'dir', '입금·출금이 같이 든 줄');
  assert.ok(box.pair(dep, D({ withdraw: 999 })).msg.includes('✂'), '금액이 다를 때 쪼개는 길을 안내하지 않는다');
  assert.equal(box.pair(D({ deposit: 1000, acct: '' }), D({ withdraw: 1000, acct: '222' })).ok, true, '계좌 번호가 없는 쪽은 막지 않는다');
});

test('★ 예수금·미지급금 전기이월 칸 — 해를 넘기는 환급이 이월된다', () => {
  assert.equal(box.OPEN.held, '예수금'); assert.equal(box.OPEN.apay, '미지급금');
  /* 작년에 입금만 있었다 → 올해 전기이월 예수금에 그만큼 */
  const dep = { approved: true, deposit: 7000000, debit: '현금성자산', credit: '예수금' };
  let r = box.carry([dep], {}, { retained: 0 });
  assert.equal(r.op.held, 7000000, '작년 기말 예수금이 안 넘어간다'); assert.deepEqual(r.missing, [], '이월할 칸이 없다고 알린다');
  /* 같은 해에 환급까지 했다 → 0 */
  const wd = { approved: true, withdraw: 7000000, debit: '예수금', credit: '현금성자산' };
  r = box.carry([dep, wd], {}, { retained: 0 });
  assert.equal(r.op.held, 0, '서로 지웠는데 예수금이 남는다');
  /* 올해 환급 — 전기이월 예수금이 있는 해에 출금만 있으면 0 이 된다(음수 부채가 안 생긴다) */
  r = box.carry([wd], { held: 7000000 }, { retained: 0 });
  assert.equal(r.op.held, 0);
});

test('★ 배선 — 두 줄을 골랐을 때만 단추, 확인 뒤에 저장, 되돌리기 묶음을 같은 저장에, 학습·신뢰 셈에는 안 넣는다', () => {
  const bar = fnSrc('_ledBulkHTML');
  assert.ok(bar.includes("ids.length===2?'<button onclick=\"ledRefundPair()\""), '두 줄일 때만 나오는 단추가 아니다');
  const f = fnSrc('ledRefundPair');
  assert.ok(f.includes('if(ids.length!==2)'), '두 줄이 아니어도 돈다');
  assert.ok(f.includes('txnLocked(dId)||txnLocked(wId)'), '마감한 달·확정한 해를 안 막는다');
  assert.ok(f.includes("'현금성자산','예수금'") && f.includes("'예수금','현금성자산'"), '분개가 예수금으로 안 지운다');
  assert.ok(f.includes("put(t[0],'ok_via','refund')") && f.includes("put(t[0],'refund',t[3])"), '환급 표시·승인 근거가 없다');
  assert.ok(f.includes("up['batches/'+bid]={meta:") && f.includes("up['audit/'+fid+'/'"), '되돌리기 묶음·변경 기록이 없다');
  assert.ok(f.indexOf('confirmM(') < f.indexOf('fbDb.ref(NS).update(up)'), '묻지 않고 저장한다');
  assert.ok(!/learnAcct\(|_trTxnEv\(|_trEv\(/.test(f), '환급이 거래처 학습·신뢰 셈에 들어간다');
  assert.ok(f.includes('bc[fid+\'|t|\'+yr+\'|\'+id+\'|\'+field]=c'), '일지가 읽는 칸 열쇠가 아니다');
  assert.ok(SRC.includes("['refund','↔ 입금 오류·환급']") && SRC.includes("refund:['↔ 환급','']") && SRC.includes("if(x.refund) o.push('refund')"), '환급 표시·거르기 칩이 없다');
  assert.match(SRC, /'led\.refund':\{t:'입금 오류·환급 묶기'/);
});
