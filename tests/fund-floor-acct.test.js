'use strict';
/* 바닥 공사 ① 회계 — 사람 눈을 거치지 않은 승인을 막고, 누가·언제·무엇이 골랐는지 남긴다 (대표 지시 2026-10-05 「바닥공사부터 진행」)
 * · 통장 가져오기가 «확실한» 이체 짝을 묻지 않고 승인까지 하던 길을 막는다 — 고른 짝만 상계
 * · 승인에 누가·언제, 학습 규칙에 누가, 분개 제안에 출처(배운 것/규칙/사업장 이름)
 * · 계산한 추정 출연금을 빈 자료 표에 «추정»으로 드러낸다
 * 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

/* 가짜 Firebase — update 로 들어온 것을 모아 둔다 */
function 상자(extra) {
  const W = { updates: [], audits: [], modal: null, toasts: [] };
  const box = {};
  new Function('W', [
    "var NS='fund_erp'; var S={user:'김가람', fundId:'F1', year:'2025', txns:{}, txnsFor:'F1/2025'};",
    "var fbDb={ ref:function(p){ return { update:function(o){ W.updates.push({p:p,o:o}); return Promise.resolve(); }, set:function(v){ W.updates.push({p:p,set:v}); return Promise.resolve(); } }; } };",
    "function num(v){ var n=Number(String(v==null?'':v).replace(/,/g,'')); return isFinite(n)?n:0; }",
    "function esc(v){ return String(v==null?'':v); }",
    "function hlp(){ return ''; } function toast(m){ W.toasts.push(m); } function renderFund(){} function closeM(){}",
    "function showModal(h){ W.modal=h; } function _audit(fid,what,detail){ W.audits.push([fid,what,detail]); }",
    "function _nowStamp(){ return '2026-10-05 09:00:00'; }",
    "function txnLocked(){ return false; } function _lockStop(){} function _monthOf(){ return ''; }",
    "function _txnDone(){ return true; } function _splitsOf(){ return []; } var _learned={};",
    "var LEARNED=[]; function learnAcct(){ LEARNED.push([].slice.call(arguments)); }",
    "var $=function(){ return null; }; var window={};",
    fnSrc('applyTransfers'), fnSrc('_xferModal'), fnSrc('approveTxn'), fnSrc('setTxnAcct'),
    extra || '',
    'this.S=S; this.applyTransfers=applyTransfers; this.xferModal=_xferModal; this.approveTxn=approveTxn; this.setTxnAcct=setTxnAcct;',
  ].join(String.fromCharCode(10))).call(box, W);
  return { box, W };
}
const PAIRS = [
  { inId: 'a1', outId: 'a2', date: '2025-03-02', amount: 1000000, kind: 'sure', inMemo: '이체', outMemo: '이체' },
  { inId: 'b1', outId: 'b2', date: '2025-04-02', amount: 200000, kind: 'guess', inMemo: '이체', outMemo: '이체' },
];

test('★ 통장 가져오기는 이체 짝을 «묻고» 상계한다 — 확실한 짝도 사람 확인 없이 승인하지 않는다', () => {
  const ib = fnSrc('importBank');
  /* 곧바로 상계는 🛡 «계좌 다른 이체 짝» 규칙을 대표가 켰을 때만(신뢰 장부 2026-10-09) */
  assert.equal(ib.split('applyTransfers(').length - 1, 1, '가져오기가 곧바로 상계·승인을 부른다');
  assert.ok(ib.includes("if(_xrk&&_trOn(_xrk)){ var _sure=pairs.filter(function(pr){ return pr.kind==='sure'; });"), '규칙이 꺼져 있어도 상계한다');
  assert.match(ib, /_xferModal\(pairs,_fid,_yr,/, '짝 확인 창을 띄우지 않는다');
  assert.match(ib, /_audit\(_fid,'통장 가져오기'/, '가져오기가 변경 기록에 안 남는다');
  assert.match(ib, /obj\[key\]\.sug=p\.src/, '기계가 고른 분개라는 표시를 안 남긴다');
});

test('★ 짝 확인 창 — □·# · 확실은 골라 두고 추정은 비워 둔다', () => {
  const { box, W } = 상자();
  box.xferModal(PAIRS, 'F1', '2025');
  assert.match(W.modal, /<th style="width:34px">□<\/th><th style="width:40px">#<\/th>/);
  const boxes = W.modal.match(/<input type="checkbox" class="xfer-pick"[^>]*>/g);
  assert.equal(boxes.length, 2);
  assert.match(boxes[0], /checked/, '확실한 짝이 골라져 있지 않다');
  assert.doesNotMatch(boxes[1], /checked/, '추정 짝이 미리 골라져 있다');
  assert.match(W.modal, />1쌍 상계 처리</, '단추 숫자가 고른 짝 수가 아니다');
});

test('★ 상계·승인은 누가·언제를 남기고 변경 기록에 한 줄', async () => {
  const { box, W } = 상자();
  await box.applyTransfers([PAIRS[0]], 'F1', '2025', true);
  const o = W.updates[0].o;
  assert.equal(o['txns/F1/2025/a1/approved'], true);
  assert.equal(o['txns/F1/2025/a1/approved_by'], '김가람');
  assert.equal(o['txns/F1/2025/a2/approved_at'], '2026-10-05 09:00:00');
  assert.deepEqual(W.audits[0].slice(0, 2), ['F1', '계좌 간 이체 상계']);
});

test('★ 승인 — 누가·언제를 함께 쓰고, 풀면 걷는다', async () => {
  const { box, W } = 상자();
  box.S.txns = { t1: { memo: '가나기계', deposit: 5000000, debit: '현금성자산', credit: '기본재산' } };
  box.approveTxn('t1', true);
  await Promise.resolve();
  assert.deepEqual(W.updates[0], { p: 'fund_erp/txns/F1/2025/t1', o: { approved: true, approved_by: '김가람', approved_at: '2026-10-05 09:00:00' } });
  box.approveTxn('t1', false);
  assert.deepEqual(W.updates[1].o, { approved: false, approved_by: null, approved_at: null, ok_via: null, ok_rule: null });
  assert.ok(!/_audit\(/.test(fnSrc('approveTxn')), '승인 한 줄마다 변경 기록 — 너무 잦다(줄 자체에 누가·언제가 남는다)');
});

test('사람이 계정을 고르면 «기계 제안» 표시(sug)를 걷는다', () => {
  const { box, W } = 상자();
  box.S.txns = { t1: { sug: 'rule' } };
  box.setTxnAcct('t1', 'debit', '복리후생비');
  assert.deepEqual(W.updates[0].o, { debit: '복리후생비', sug: null });
});

test('분개 제안은 어디서 왔는지 말한다 — 배운 것 / 규칙 / 사업장 이름', () => {
  const pa = fnSrc('proposeAcct');
  assert.match(pa, /learned:true,src:_learnOwn\(lr,fid\)\?'learned':'learned_other'/);   // 2026-10-09 다른 기금에서만 배운 것은 따로
  assert.match(pa, /return \{d:r\.d,c:r\.c,src:'rule'\}/);
  assert.equal((pa.match(/src:'site'/g) || []).length, 3, '사업장 이름으로 고른 세 길 모두 출처를 단다');
  assert.match(fnSrc('learnAcct'), /by:\(S\.user\|\|''\)/, '배운 규칙에 누가 가르쳤는지 없다');
  assert.match(fnSrc('addTxnSave'), /rec\.sug=p\.src/);
});

test('장부 줄 — 승인자는 마우스를 올리면, 기계 제안은 🤖 로', () => {
  assert.match(SRC, /'승인 '\+x\.approved_by\+' · '\+\(x\.approved_at\|\|''\)/);
  assert.ok(SRC.includes(`(!x.approved&&x.sug?' <span class="chip" style="font-size:9.5px" title="'+esc(_SUG_LABEL[x.sug]`), '기계 제안 🤖 표시가 없다');
});

test('★ 추정 출연금 — 적은 값이 없고 사람수×단가로만 정해지면 «추정»', () => {
  const box = {};
  new Function([
    "function num(v){ var n=Number(String(v==null?'':v).replace(/,/g,'')); return isFinite(n)?n:0; }",
    'var ROK=null; function _docRok(){ return ROK; }',
    fnSrc('siteContribOf'), fnSrc('_contribIsEst'),
    'this.est=_contribIsEst; this.setRok=function(r){ ROK=r; };',
  ].join(String.fromCharCode(10))).call(box);
  const f = { contrib_per_worker: 100000 };
  assert.equal(box.est({ _id: 's1', company_size: 10 }, f), true, '사람수×단가뿐이면 추정');
  assert.equal(box.est({ _id: 's1', company_size: 10, contrib: 3000000 }, f), false, '기본 출연금을 적었으면 추정 아님');
  box.setRok({ sy: { s1: { contrib: 2500000 } } });
  assert.equal(box.est({ _id: 's1', company_size: 10 }, f), false, '그 해 출연금을 적었으면 추정 아님');
  box.setRok(null);
  assert.equal(box.est({ _id: 's1' }, f), false, '셀 수 없으면(사람수 없음) 추정도 아님 — 빈칸 쪽에서 잡힌다');
  assert.match(fnSrc('estabGaps'), /est:true/);
  assert.match(SRC, /'estab\.est':\{t:'추정 출연금'/);
  assert.match(SRC, /'xfer\.pick':\{t:'계좌 간 이체 — 고른 짝만 상계'/);
});
