'use strict';
/* 🛡 신뢰 장부 — 규칙마다 맞음·틀림을 세고, 연속 30번이면 올릴 수 있음, 틀리면 멈춤 (자동화 확인 목업 6, 2026-10-09)
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
  "function _splitsOf(x){ return (x&&x.splits)||[]; }",
  "var R={이자:{d:'현금성자산',c:'이자수익'}, 가나기계:{d:'현금성자산',c:'기본재산'}};",
  "function proposeAcct(m){ return R[m]||{d:'',c:''}; }",
  varSrc('TR'), 'var TR_RUN=30, TR_WIN=50, TR_AMT_MAX=1000000;', varSrc('TR_FIXED_FIELDS'),
  fnSrc('_trEsc'), fnSrc('_trSrc'), fnSrc('_trProvRk'), fnSrc('_trTxnRk'), fnSrc('_trXferRk'), fnSrc('_trFixed'), fnSrc('_trOn'),
  fnSrc('_trStat'), fnSrc('_trState'), fnSrc('_trTxnEv'), fnSrc('_provState'),
  'this.TR=TR; this.src=_trSrc; this.prk=_trProvRk; this.trk=_trTxnRk; this.xrk=_trXferRk; this.fixed=_trFixed; this.on=_trOn;',
  'this.stat=_trStat; this.state=_trState; this.tev=_trTxnEv; this.pstate=_provState;',
].join('\n')).call(box);

test('★ 규칙 열쇠 — 서류 종류는 살리고, 그때그때 적은 설명은 앞말만 · 금지 글자는 _', () => {
  assert.equal(box.src('scan:bizreg'), 'scan:bizreg');
  assert.equal(box.src('list:대표 표·푸른메일함'), 'list');
  assert.equal(box.src('mail:재무현황(고객)·2025 결산서 전기'), 'mail');
  assert.equal(box.prk('scan:bizreg', 's|S1|biz_no'), 'p~scan:bizreg~biz_no');
  assert.equal(box.trk('FUND-0001', true, '이자수익'), 't~FUND-0001~입~이자수익');
  assert.equal(box.xrk('FUND-0001', 'sure'), 'x~FUND-0001~sure');
  assert.ok(!/[.#$\[\]\/'"]/.test(box.prk("scan:a.b", "f|x'y")), 'RTDB 열쇠·onclick 에 못 쓰는 글자가 남았다');
});

test('★ 고정 — 사람 이름·돈 칸·추정·계좌번호 없는 이체 짝은 켜 둬도 자동 확정 안 됨', () => {
  for (const rk of ['p~scan:wrep~wrep_name', 'p~card~ceo', 'p~calc:rate~contrib', 'p~guess:office~address', 'p~import:xlsx~contrib', 'x~F1~guess'])
    assert.ok(box.fixed(rk), rk + ' 이 고정이 아니다');
  for (const rk of ['p~scan:bizreg~biz_no', 't~F1~입~이자수익', 'x~F1~sure']) assert.ok(!box.fixed(rk), rk);
  box.TR.rules = { 'p~card~ceo': { auto: true }, 'p~scan:bizreg~biz_no': { auto: true }, 't~F1~입~이자수익': { stop: {} } };
  assert.equal(box.on('p~card~ceo'), false, '고정 칸이 켜졌다');
  assert.equal(box.on('p~scan:bizreg~biz_no'), true);
  assert.equal(box.on('t~F1~입~이자수익'), false, '멈춘 규칙이 켜진 것으로 보인다');
});

test('★ 셈 — 최근 50건 맞음 · 연속은 끝에서부터 · 30번이면 올릴 수 있음 · 틀리면 처음부터', () => {
  const ev = {}; let i = 0; const add = (o) => { ev['k' + String(i++).padStart(4, '0')] = { o, at: '2026-10-09' }; };
  add(1); add(0); for (let k = 0; k < 29; k++) add(1);
  let st = box.stat(ev);
  assert.equal(st.run, 29); assert.equal(st.total, 31); assert.equal(st.bad.length, 1);
  assert.equal(box.state('t~F1~입~이자수익', st, null), 'human');
  add(1); st = box.stat(ev);
  assert.equal(box.state('t~F1~입~이자수익', st, null), 'ready');
  assert.equal(box.state('t~F1~입~이자수익', st, { auto: true }), 'auto');
  assert.equal(box.state('p~card~ceo', st, null), 'fix');
  add(0); st = box.stat(ev);
  assert.equal(st.run, 0);
  assert.equal(box.state('t~F1~입~이자수익', st, { stop: { at: 'x' } }), 'stop');
  for (let k = 0; k < 60; k++) add(1);
  st = box.stat(ev); assert.equal(st.n, 50); assert.equal(st.ok, 50);
});

test('★ 분개 한 줄 — 기계가 고를 계정과 같으면 맞음, 다르면 그 «기계 계정» 규칙에 틀림', () => {
  const T = (o) => Object.assign({ date: '2026-03-02', deposit: 0, withdraw: 0 }, o);
  let e = box.tev(T({ memo: '이자', deposit: 4000, debit: '현금성자산', credit: '이자수익' }), 'F1', []);
  assert.deepEqual([e.rk, e.o], ['t~F1~입~이자수익', 1]);
  e = box.tev(T({ memo: '이자', deposit: 4000, debit: '현금성자산', credit: '잡수익' }), 'F1', []);
  assert.deepEqual([e.rk, e.o], ['t~F1~입~이자수익', 0], '사람이 바꾼 것이 기계 규칙의 틀림으로 안 잡혔다');
  e = box.tev(T({ memo: '모름', withdraw: 9000, debit: '복리후생비', credit: '현금성자산', sug: 'learned' }), 'F1', []);
  assert.deepEqual([e.rk, e.o], ['t~F1~출~복리후생비', 1], '가져올 때 기계가 고른 그대로면 맞음');
  assert.equal(box.tev(T({ memo: '모름', withdraw: 9000, debit: '복리후생비', credit: '현금성자산' }), 'F1', []), null, '기계가 못 고른 줄을 셌다');
  assert.equal(box.tev(T({ memo: '이자', xfer: 1 }), 'F1', []), null, '이체를 분개 규칙으로 셌다');
  e = box.tev(T({ memo: '이자', deposit: 4000, debit: '현금성자산', credit: '이자수익' }), 'F1', [], 0);
  assert.equal(e.o, 0, '표본 «틀림»이 안 먹었다');
});

test('★ 자동 확정한 칸 값 — 규칙이 켜져 있을 때만 ✓, 멈추면 다시 🤖', () => {
  const p = { m: 1, src: 'scan:bizreg', how: 'list', ok: { by: '자동 확정', at: 'x', rule: 'p~scan:bizreg~biz_no' } };
  box.TR.rules = { 'p~scan:bizreg~biz_no': { auto: true } };
  assert.equal(box.pstate(p), 'o');
  box.TR.rules = { 'p~scan:bizreg~biz_no': { stop: { at: 'x' } } };
  assert.equal(box.pstate(p), 'a', '멈춘 규칙이 확정한 값이 확인된 것으로 남았다');
  assert.equal(box.pstate({ m: 1, src: 'card', ok: { by: '김가람', at: 'x' } }), 'o', '사람 확인이 풀렸다');
});

test('★ 배선 — 세는 자리·자동 확정 자리·멈춤', () => {
  assert.match(fnSrc('_rvOkMany'), /ev\.push\(\{rk:_trProvRk\(it\.p\.src,it\.key\), o:1/);
  assert.match(fnSrc('_rvOkMany'), /_trEv\(ev\)/);
  assert.match(fnSrc('provOkOne'), /_trEv\(\[\{rk:_trProvRk\(_p\.src,'f\|'\+k\), o:1/);
  const tr = fnSrc('_track');
  assert.match(tr, /if\(_trOn\(_rk\)\) pv\.ok=\{by:'자동 확정', at:at, rule:_rk\}/, '켜진 규칙이 칸 값에 안 먹는다');
  assert.match(tr, /_trSeeHuman\(chk\)\.then\(_send,_send\)/, '사람이 고친 것을 쓰기 전에 안 본다');
  const ap = fnSrc('approveTxn');
  assert.match(ap, /var _e=_trTxnEv\(x,_fid,_trSiteNames\(_fid\)\); if\(_e\) _tr=function\(\)\{ _trEv\(\[_e\]\); \}/);
  assert.match(ap, /_trEv\(\[\{rk:_rk, o:0, f:_fid, r:_r\}\]\); _trDemote\(_rk,/, '자동 승인을 풀어도 규칙이 안 멈춘다');
  assert.match(ap, /learnAcct\([^\n]*\n\s*_tr\(\);/, '저장이 되기 전에 센다');
  assert.match(fnSrc('_sampleApply'), /_trEv\(A\.sample\.map\(function\(x\)\{ return _trTxnEv\(x,A\.fid,A\.names,1\)/, '표본 말고 초록 전부를 «맞음»으로 센다');
  assert.match(fnSrc('_sampleMark'), /_trTxnEv\(x,_SA\.fid,_SA\.names,0\)/);
  assert.match(fnSrc('_applyXfer'), /o:on\?1:0/);
  const ib = fnSrc('importBank');
  assert.match(ib, /_trOn\(_rk\)&&Math\.max\(num\(x\.deposit\)\|\|0,num\(x\.withdraw\)\|\|0\)<=TR_AMT_MAX/, '100만 원 넘는 것도 자동 승인한다');
  assert.match(ib, /obj\[key\]\.ok_via='rule'; obj\[key\]\.ok_rule=_rk/);
  assert.match(ib, /applyTransfers\(_sure,_fid,_yr,true,_xrk\)/);
  assert.match(fnSrc('applyTransfers'), /if\(rule\)\{ up\[b\+'ok_via'\]='rule'; up\[b\+'ok_rule'\]=rule; \}/);
  const un = fnSrc('_trUnapprove');
  assert.match(un, /if\(c\.locked\|\|\(c\.months\|\|\{\}\)\[_monthOf\(x\.date\)\]\)\{ skip\+\+; return; \}/, '마감한 달의 승인을 푼다');
  assert.match(fnSrc('trSetAuto'), /if\(!_isBoss\(\)\)/, '대표가 아니어도 켠다');
  assert.match(fnSrc('renderTrust'), /<th style="width:34px">□<\/th><th style="width:40px">#<\/th>/);
  assert.match(SRC, /'trust\.ledger':\{t:'자동 규칙 — 어디까지 기계에 맡길지'/);
  assert.match(fnSrc('start'), /_trSub\(\)/, '켜진 규칙을 안 읽는다');
});
