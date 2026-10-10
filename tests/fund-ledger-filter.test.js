'use strict';
/* 장부 거르기 · 한꺼번에 정리 (2026-10-10, 목업 승인 «진행») — 이름은 전부 가짜. */
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
  varSrc('CF_FINANCE'), varSrc('WAGE_LIKE_RE'), fnSrc('_txnDone'),
  varSrc('LED_KINDS'), varSrc('LED_ISSUE'), varSrc('LED_BIG'), fnSrc('_ledIssues'), fnSrc('_ledMatch'),
  'this.iss=_ledIssues; this.match=_ledMatch;',
].join('\n')).call(box);

test('★ 손볼 것 — 이미 있는 잣대와 같다', () => {
  const T = (o) => Object.assign({ _id: 'a', date: '2024-01-05', deposit: 0, withdraw: 0 }, o);
  assert.deepEqual(box.iss(T({ withdraw: 57000 })).slice(0, 2), ['unclass', 'unappr'], '미분류·미승인');
  const w = box.iss(T({ memo: '김가람_상여금', withdraw: 20000000, debit: '격려금', credit: '현금성자산' }));
  assert.ok(w.includes('wage') && w.includes('big') && w.includes('noev') && !w.includes('unclass'));
  assert.ok(box.iss(T({ deposit: 5000000, debit: '현금성자산', credit: '단기차입금', approved: true })).includes('borrow'), '차입 의심');
  assert.ok(box.iss(T({ deposit: 1, debit: '현금성자산', credit: '현금성자산' })).includes('same'), '차·대 같음');
  assert.ok(!box.iss(T({ deposit: 1, debit: '현금성자산', credit: '현금성자산', xfer: 1 })).includes('same'), '이체 상계는 정상');
  assert.ok(box.iss(T({ withdraw: 3000, debit: '지급수수료', credit: '현금성자산', approved: true, scan: { id: 'x' } })).length === 0, '멀쩡한 줄에 딱지');
  assert.ok(box.iss(T({ deposit: 9, debit: '현금성자산', credit: '이자수익', sug: 'rule' })).includes('sug'));
  assert.ok(box.iss(T({ deposit: 1 }), { a: 1 }).includes('xfer'));
});

test('★ 거르기 — «문제만»은 결산을 막는 줄과 법 위반 의심만(증빙 없음·100만↑은 따로)', () => {
  assert.equal(box.match(['noev', 'big'], 'issues'), false);
  assert.equal(box.match(['unappr'], 'issues'), true);
  assert.equal(box.match(['wage'], 'issues'), true);
  assert.equal(box.match([], 'all'), true);
  assert.equal(box.match(['noev'], 'noev'), true);
});

test('★ 배선 — 맨 왼쪽 □·#, 잠긴 줄 🔒, 손볼 것 칸, 칩, 한꺼번에 띠', () => {
  const ct = fnSrc('closingTab');
  assert.ok(ct.includes("(lk?'🔒':'<input type=\"checkbox\"'"), '잠긴 줄도 고를 수 있다');
  assert.ok(ct.includes("+(_i+1)+'</td>"), '번호가 없다');
  assert.ok(ct.includes('_ledTags(x._iss)'));
  assert.ok(ct.includes('S._ledVis=_vis.filter(function(x){ return !(_yl||monthLocked(_monthOf(x.date))); })'), '잠긴 줄이 «모두 고르기»에 들어간다');
  const cb = fnSrc('closeBodyHTML');
  assert.ok(cb.includes('_ledChips()+\'<div class="ledgerwrap"><table><thead><tr><th style="width:34px"><input type="checkbox" onchange="ledPickAll(this.checked)"'));
  assert.ok(cb.includes('<th style="width:40px">#</th>') && cb.includes('<th>손볼 것</th>'));
  assert.ok(cb.includes('<div id="ledBulk">'));
  assert.match(SRC, /'led\.filter':\{t:'장부 거르기 · 한꺼번에 정리'/);
});

test('★ 한꺼번에 승인 — 차·대 미정·100만↑·임금성·차입·잠긴 달은 빼고, 누가·언제·배우기·신뢰 셈·기록', () => {
  const a = fnSrc('ledBulkApprove');
  assert.ok(a.includes("if(txnLocked(id)){ sk.lock++; return; }"));
  assert.ok(a.includes("if(iss.indexOf('big')>=0||iss.indexOf('wage')>=0||iss.indexOf('borrow')>=0){ sk.risky++; return; }"), '위험한 줄을 한꺼번에 승인한다');
  assert.ok(a.includes("up[b+'approved_by']=who; up[b+'approved_at']=at; up[b+'ok_via']='bulk'"));
  assert.ok(a.indexOf('_trTxnEv(x,fid,names)') < a.indexOf('learnAcct('), '배운 뒤에 세면 늘 «맞음»이 된다');
  assert.ok(a.includes("_audit(fid,'분개 한꺼번에 승인'"));
});

test('★ 계정 한꺼번에 — 승인한 줄·잠긴 달·쪼갠 거래·이체는 빼고, 바꾸기 전 값은 묶음(되돌리기)', () => {
  const b = fnSrc('ledBulkAcct');
  assert.ok(b.includes('if(x.approved||txnLocked(id)||_splitsOf(x).length||x.xfer){ skip++; return; }'));
  assert.ok(b.includes("bc[fid+'|t|'+yr+'|'+id+'|'+side]=c;") && b.includes("up['batches/'+bid]={meta:"), '되돌릴 묶음이 안 남는다');
  assert.ok(b.indexOf("up['batches/'+bid]") < b.indexOf('fbDb.ref(NS).update(up)'), '묶음이 장부 변경과 같은 저장이 아니다');
  assert.ok(SRC.includes("var PROV_ROOT={funds:'f',sites:'s',site_years:'y',subsidy_chk:'c'};"), '장부에 칸 출처를 두면 안 된다(바닥 공사 결정)');
  assert.ok(SRC.includes("var JL_ROOT={f:'funds', s:'sites', y:'site_years', c:'subsidy_chk', t:'txns'};"), '일지가 장부 묶음을 되돌리지 못한다');
});

test('★ 다른 업무 목록도 맨 왼쪽 □·# (분개장·계정별원장·변경 기록·서류함·목적사업·기본재산 변동)', () => {
  assert.ok(fnSrc('_ckTh').includes('onclick="_ckAll(this)"') && fnSrc('_ckTd').includes('event.stopPropagation()'), '□ 를 누르면 줄이 열린다');
  for (const fn of ['journalView', 'ledgerView', 'openAudit', 'subsidyDocsPanel', 'welfareTab', 'f15View']) {
    const s = fnSrc(fn);
    assert.ok(s.includes("'+_ckTh()+'") && s.includes("'+_ckTd()+'"), fn + ' 에 □ 가 없다');
    assert.ok(s.includes('<td class="no">'), fn + ' 에 번호가 없다');
  }
  assert.ok(fnSrc('ledgerView').includes('<td class="ckcol"></td><td colspan="3">합계 / 기말잔액</td>'), '합계 줄 칸이 밀린다');
  assert.ok(fnSrc('f15View').includes('<td colspan="7" class="muted">기본재산 변동'), '빈 줄 칸이 모자란다');
  assert.ok(fnSrc('printLedger').includes('.ckcol{display:none}'), '인쇄에 □ 가 나간다');
  assert.ok(fnSrc('journalView').includes("_n(daySum)+'</td><td class=\"mo\"></td></tr>'"), '분개장 소계 줄이 한 칸 모자란다');
});
