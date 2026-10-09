'use strict';
/* 분개 학습 — 어느 기금에서 확인했는지 함께 (2026-10-09). 다른 기금에서만 배운 것은 «다른 기금에서 배움», 골라 승인 초록에서 뺀다.
 * 이름은 전부 가짜. */
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
  "var LOCKED={}; function monthLocked(m){ return !!LOCKED[m]; } function _monthOf(d){ return String(d||'').slice(5,7); }",
  "function _splitsOf(x){ return (x&&x.splits)||[]; }",
  "var _learned={}; var ACCT_RULES=[];",
  varSrc('LEARN_SKIP'), fnSrc('_learnKey'), fnSrc('_learnFunds'), fnSrc('_learnOwn'), fnSrc('proposeAcct'),
  varSrc('SAMPLE_WD_MAX'), fnSrc('_sampleGreen'),
  'this.L=function(){ return _learned; }; this.set=function(o){ _learned=o; }; this.funds=_learnFunds; this.own=_learnOwn; this.propose=proposeAcct; this.green=_sampleGreen;',
].join('\n')).call(box);

test('★ 배운 기금 — 같은 짝이면 이어받고, 짝이 바뀌면 새로', () => {
  assert.deepEqual(box.funds(null, '현금성자산', '이자수익'), {});
  assert.deepEqual(box.funds({ d: '현금성자산', c: '이자수익', fund: 'F1', funds: { F2: 1 } }, '현금성자산', '이자수익'), { F1: 1, F2: 1 });
  assert.deepEqual(box.funds({ d: '현금성자산', c: '이자수익', fund: 'F1' }, '현금성자산', '잡수익'), {}, '짝이 바뀌었는데 옛 기금을 이어받았다');
  assert.equal(box.own({ fund: 'F1' }, 'F1'), true);
  assert.equal(box.own({ fund: 'F1', funds: { F3: 1 } }, 'F3'), true);
  assert.equal(box.own({ fund: 'F1' }, 'F2'), false);
  assert.equal(box.own({ fund: 'F1' }, undefined), true, '기금을 안 주면 예전처럼');
});

test('★ 제안 — 이 기금 것은 learned, 다른 기금 것은 learned_other', () => {
  box.set({ i_가나기계: { d: '현금성자산', c: '기본재산', fund: 'F1', funds: { F1: 1 } } });
  assert.equal(box.propose('가나기계 출연', true, [], '', 'F1').src, 'learned');
  assert.equal(box.propose('가나기계 출연', true, [], '', 'F2').src, 'learned_other');
  assert.equal(box.propose('가나기계 출연', true, [], '').src, 'learned');
});

test('★ 골라 승인 초록 — 다른 기금에서만 배운 것은 빼서 하나씩', () => {
  box.set({ i_가나기계: { d: '현금성자산', c: '기본재산', fund: 'F1' } });
  const x = { _id: 'a', date: '2025-03-02', memo: '가나기계', deposit: 5000000, withdraw: 0, debit: '현금성자산', credit: '기본재산' };
  assert.equal(box.green([x], (t) => box.propose(t.memo, true, [], '', 'F1')).length, 1);
  assert.equal(box.green([x], (t) => box.propose(t.memo, true, [], '', 'F2')).length, 0, '다른 기금 학습이 한꺼번에 승인된다');
});

test('★ 배선 — 부르는 곳마다 기금을 넘기고, 학습은 배운 기금을 적고, 표는 □·#', () => {
  assert.match(fnSrc('learnAcct'), /rec\.funds=_learnFunds\(prev,d,c\); if\(f0\) rec\.funds\[f0\]=1;/);
  assert.match(fnSrc('importBank'), /proposeAcct\(x\.memo,x\.deposit>0,_snames,x\.kind,_fid\)/);
  assert.match(fnSrc('sampleApprove'), /proposeAcct\(x\.memo,\(num\(x\.deposit\)\|\|0\)>0,names,x\.kind,fid\)/);
  assert.ok(fnSrc('addTxnSave').includes("}),'',fid);"), '거래 직접 추가가 기금을 안 넘긴다');
  assert.match(fnSrc('_trTxnEv'), /proposeAcct\(x\.memo,dep,names\|\|\[\],x\.kind,fid\)/);
  assert.match(SRC, /learned_other:'다른 기금에서 배운 분개/);
  assert.match(fnSrc('learnedPanel'), /<th style="width:34px">□<\/th><th style="width:40px">#<\/th>/);
});
