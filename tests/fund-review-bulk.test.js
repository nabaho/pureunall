'use strict';
/* 확인함 — 모든 줄에 □, 고른 분개 묶음 한꺼번에 승인(안전한 줄만) (2026-10-10). 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); return SRC.slice(i, SRC.indexOf(';\n', i) + 1); };

const box = {};
new Function([
  "function num(v){ var n=Number(String(v==null?'':v).replace(/,/g,'')); return isFinite(n)?n:0; }",
  "function _splitsOf(x){ return (x&&x.splits)||[]; }",
  "function _splitSum(x){ return _splitsOf(x).reduce(function(s,p){ return s+(num(p.amount)||0); },0); }",
  varSrc('CF_FINANCE'), varSrc('WAGE_LIKE_RE'), fnSrc('_txnDone'), fnSrc('_monthOf'),
  varSrc('LED_KINDS'), varSrc('LED_ISSUE'), varSrc('LED_BIG'), fnSrc('_ledIssues'), fnSrc('_rvTxnSafe'),
  'this.safe=_rvTxnSafe;',
].join('\n')).call(box);

const T = (o) => Object.assign({ date: '2024-03-05', deposit: 0, withdraw: 0 }, o);
const OPEN = { locked: false, months: {} };

test('★ 안전한 줄만 — 장부 거르기와 같은 잣대', () => {
  assert.equal(box.safe(T({ withdraw: 3000, debit: '지급수수료', credit: '현금성자산' }), OPEN), '');
  assert.equal(box.safe(T({ withdraw: 3000, debit: '지급수수료', credit: '현금성자산', approved: true }), OPEN), 'done');
  assert.equal(box.safe(T({ withdraw: 57000 }), OPEN), 'undone', '계정 없는 줄을 승인한다');
  assert.equal(box.safe(T({ deposit: 1, debit: '현금성자산', credit: '현금성자산' }), OPEN), 'undone', '차·대 같음');
  assert.equal(box.safe(T({ withdraw: 2000000, debit: '지급수수료', credit: '현금성자산' }), OPEN), 'risky', '100만↑');
  assert.equal(box.safe(T({ memo: '가나_상여금', withdraw: 9000, debit: '격려금', credit: '현금성자산' }), OPEN), 'risky', '임금성');
  assert.equal(box.safe(T({ deposit: 9000, debit: '현금성자산', credit: '단기차입금' }), OPEN), 'risky', '차입');
  assert.equal(box.safe(T({ deposit: 1, xfer: 'p1', debit: '현금성자산', credit: '현금성자산' }), OPEN), 'xfer', '이체는 짝으로');
});

test('★ 마감한 달·확정한 해·마감 여부를 못 읽음 → 안 건드린다', () => {
  const x = T({ withdraw: 3000, debit: '지급수수료', credit: '현금성자산' });
  assert.equal(box.safe(x, { locked: false, months: { '03': { at: '2024-04-01' } } }), 'lock');
  assert.equal(box.safe(x, { locked: true, months: {} }), 'lock');
  assert.equal(box.safe(x, null), 'lock', '못 읽었는데 승인한다');
  assert.equal(box.safe(x, { locked: false, months: { '04': 1 } }), '');
});

test('★ 배선 — 모든 줄 □, 갈래마다 단추, 승인은 누가·언제·bulk·배우기 전 신뢰 셈·기록', () => {
  const rr = fnSrc('renderReview');
  assert.ok(rr.includes('onclick="event.stopPropagation()"><input type="checkbox"\'+(RV.picked[i]?'), '분개·이체 줄에 □ 가 없다');
  assert.ok(!rr.includes("(it.t==='prov'||it.t==='est')?'<input"), '□ 를 칸 값 줄에만 단다');
  const bb = fnSrc('_rvBulkBar');
  assert.ok(bb.includes('rvOkPicked()') && bb.includes('rvApprovePicked()') && bb.includes('이체 짝'));
  const a = fnSrc('rvApprovePicked');
  assert.ok(a.includes("_rvTxnSafe(x,closes[i])"));
  assert.ok(a.includes("up[b+'approved_by']=who; up[b+'approved_at']=at; up[b+'ok_via']='bulk'"));
  assert.ok(a.indexOf('_trTxnEv(x,p.it.fid,names)') < a.indexOf('learnAcct('), '배운 뒤에 세면 늘 «맞음»이 된다');
  assert.ok(a.includes("_audit(p.it.fid,'분개 한꺼번에 승인'"));
  assert.ok(a.includes("rd(p+'/locked'),rd(p+'/months')"), '마감 여부를 안 읽는다');
  assert.ok(a.indexOf('confirmM(') < a.indexOf('fbDb.ref(NS).update(up)'), '묻지 않고 쓴다');
});
