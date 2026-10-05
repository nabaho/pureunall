'use strict';
/* 🎯 골라 승인 — 규칙과 같은 분개만 골라, 표본을 먼저 보고 한꺼번에 (대표 지시 2026-10-05, 자동화 확인 목업 3번)
 * 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); return SRC.slice(i, SRC.indexOf(';', i) + 1); };

const box = {};
new Function([
  "function num(v){ var n=Number(String(v==null?'':v).replace(/,/g,'')); return isFinite(n)?n:0; }",
  "var LOCKED={}; function monthLocked(m){ return !!LOCKED[m]; } function _monthOf(d){ return String(d||'').slice(5,7); }",
  "function _splitsOf(x){ return (x&&x.splits)||[]; }",
  varSrc('SAMPLE_WD_MAX'), fnSrc('_sampleGreen'), fnSrc('_samplePick'), fnSrc('_sampleSize'),
  'this.green=_sampleGreen; this.pick=_samplePick; this.size=_sampleSize; this.LOCKED=LOCKED;',
].join(String.fromCharCode(10))).call(box);

const R = { 이자: { d: '현금성자산', c: '이자수익' }, 가나기계: { d: '현금성자산', c: '기본재산' }, 수수료: { d: '지급수수료', c: '현금성자산' } };
const propose = (x) => R[x.memo] || { d: '', c: '' };
const T = (id, o) => Object.assign({ _id: id, date: '2025-03-01', deposit: 0, withdraw: 0 }, o);

test('★ 초록 — 규칙이 고르는 계정과 같은 것만', () => {
  const arr = [
    T('a', { memo: '이자', deposit: 4000, debit: '현금성자산', credit: '이자수익' }),             // 같음 → 초록
    T('b', { memo: '이자', deposit: 4000, debit: '현금성자산', credit: '잡수익' }),               // 사람이 바꿈 → 하나씩
    T('c', { memo: '모름', withdraw: 9000, debit: '복리후생비', credit: '현금성자산' }),          // 규칙 없음 → 하나씩
    T('d', { memo: '수수료', withdraw: 1500000, debit: '지급수수료', credit: '현금성자산' }),     // 100만 넘는 출금 → 빼기
    T('e', { memo: '가나기계', deposit: 5000000, debit: '현금성자산', credit: '기본재산' }),      // 큰 입금은 괜찮다
    T('f', { memo: '이자', deposit: 4000, debit: '현금성자산', credit: '이자수익', approved: true }),
    T('g', { memo: '이자', deposit: 4000, debit: '현금성자산', credit: '현금성자산', sug: 'xfer' }),
    T('h', { memo: '이자', deposit: 4000, debit: '현금성자산', credit: '이자수익', splits: [{}, {}] }),
    T('i', { memo: '이자', deposit: 4000, debit: '현금성자산', credit: '이자수익', date: '2025-06-30' }),
  ];
  box.LOCKED['06'] = true;
  assert.deepEqual(box.green(arr, propose).map((x) => x._id), ['a', 'e']);
  delete box.LOCKED['06'];
});

test('★ 표본 — 수만큼, 계정 짝마다 하나는 꼭, 날짜가 고루', () => {
  assert.equal(box.size(3), 3); assert.equal(box.size(40), 5); assert.equal(box.size(400), 10);
  const list = [];
  for (let i = 0; i < 40; i++) list.push(T('x' + i, { date: '2025-' + String(1 + (i % 12)).padStart(2, '0') + '-01', debit: i === 33 ? '지급수수료' : '현금성자산', credit: i === 33 ? '현금성자산' : '이자수익' }));
  const s = box.pick(list, 5, () => 0);
  assert.equal(s.length, 5);
  assert.ok(s.some((x) => x._id === 'x33'), '드문 계정 짝이 표본에 안 들어갔다');
  assert.equal(new Set(s.map((x) => x._id)).size, 5, '같은 줄이 두 번');
  const months = new Set(s.map((x) => x.date.slice(5, 7)));
  assert.ok(months.size >= 3, '한 달에 몰렸다');
});

test('★ 배선 — 다 맞아야 승인 · 하나라도 틀리면 멈춤 · 누가·언제·표본으로 · 기록', () => {
  const show = fnSrc('_sampleShow');
  assert.match(show, /<th style="width:34px">□<\/th><th style="width:40px">#<\/th>/);
  assert.match(show, /bad\.length\?'':'<button class="primary" onclick="_sampleApply\(\)"'\+\(allOk\?'':' disabled'\)/, '틀린 게 있어도 승인 단추가 남는다');
  const ap = fnSrc('_sampleApply');
  assert.match(ap, /_SA\.mark\[x\._id\]!=='ok'/);
  assert.match(ap, /up\[b\+'approved_by'\]=who; up\[b\+'approved_at'\]=at; up\[b\+'ok_via'\]='sample'/);
  assert.match(ap, /cur\.debit!==x\.debit\|\|cur\.credit!==x\.credit/, '그 사이 바뀐 줄을 승인한다');
  assert.match(ap, /_audit\(A\.fid,'분개 골라 승인'/);
  assert.match(SRC, /onclick="sampleApprove\(\)"/);
  assert.match(SRC, /'sample\.approve':\{t:'골라 승인 — 표본을 먼저 보고 한꺼번에'/);
  assert.match(fnSrc('rvGo'), /else sampleApprove\(\)/, '확인함에서 바로 못 간다');
});
