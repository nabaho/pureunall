'use strict';
/* ↶ 통장 가져온 기록 — 잘못 가져온 파일을 통째로 걷어낸다 (2026-10-10, 목업 승인 «진행»). 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

const box = {};
new Function([
  "function num(v){ var n=Number(String(v==null?'':v).replace(/,/g,'')); return isFinite(n)?n:0; }",
  "function _splitsOf(x){ return (x&&x.splits)||[]; }",
  "function _monthOf(d){ var m=String(d||'').slice(5,7); return /^(0[1-9]|1[0-2])$/.test(m)?m:''; }",
  fnSrc('_impRowWhy'), fnSrc('_impSummary'), fnSrc('_impPartners'),
  'this.why=_impRowWhy; this.sum=_impSummary; this.part=_impPartners;',
].join('\n')).call(box);

const OPEN = { locked: false, months: {} };
const R = (o) => Object.assign({ date: '2024-03-05', deposit: 0, withdraw: 1000, imp: 'iA', approved: false }, o);

test('★ 걷어내는 줄 — 미승인·자동 확정만, 사람 승인·증빙·쪼갠 거래·마감은 남김', () => {
  assert.equal(box.why(R(), OPEN), '');
  assert.equal(box.why(R({ approved: true, ok_via: 'rule' }), OPEN), '', '🛡 자동 확정 줄은 기계 일이다');
  assert.equal(box.why(R({ approved: true, approved_by: '담당A' }), OPEN), 'human');
  assert.equal(box.why(R({ approved: true, ok_via: 'bulk' }), OPEN), 'human', '한꺼번에 승인도 사람이 눌렀다');
  assert.equal(box.why(R({ scan: { id: 'x' } }), OPEN), 'ev');
  assert.equal(box.why(R({ splits: [{ acct: '지급수수료', amount: 1 }] }), OPEN), 'split');
  assert.equal(box.why(R(), { locked: false, months: { '03': { at: 'x' } } }), 'lock');
  assert.equal(box.why(R(), { locked: true, months: {} }), 'lock');
  assert.equal(box.why(R(), null), 'lock', '마감 여부를 모르는데 지운다');
});

test('★ 한 가져오기 번호만 센다 — 다른 파일·번호 없는 옛 줄은 건드리지 않는다', () => {
  const T = { a: R(), b: R({ approved: true, approved_by: '담당A' }), c: R({ imp: 'iB' }), d: R({ imp: undefined }), e: R({ date: '2024-04-01' }) };
  const s = box.sum(T, 'iA', { locked: false, months: { '04': 1 } });
  assert.equal(s.have, 3);   // a·b·e (c 는 다른 번호, d 는 번호 없는 옛 줄)
  assert.deepEqual(s.rm, ['a']);
  assert.equal(s.human, 1); assert.equal(s.lock, 1);
});

test('★ 이체 짝 — 걷어내는 줄의 «남는» 상대만, 한 줄은 한 번만', () => {
  const T = {
    o1: R({ withdraw: 5000, xfer: 1 }), i1: { date: '2024-03-05', deposit: 5000, withdraw: 0, xfer: 1, approved: true, imp: 'iOld' },
    o2: R({ withdraw: 5000, xfer: 1 }),
    z: { date: '2024-03-06', deposit: 5000, withdraw: 0, xfer: 1 },
  };
  assert.deepEqual(box.part(T, ['o1']), ['i1'], '남는 짝을 못 찾는다');
  assert.deepEqual(box.part(T, ['o1', 'o2']), ['i1'], '한 줄을 두 번 짝으로 센다');
  assert.deepEqual(box.part(T, ['o1', 'i1', 'o2']), [], '짝이 모두 걷히면 풀 줄이 없다');
  assert.deepEqual(box.part(T, ['o1', 'i1']), ['o2'], 'i1 이 걷히면 짝을 잃은 o2 를 풀어야 한다');
});

test('★ 배선 — 가져올 때 번호·기록을 한 번에, 대표·관리자만, 누르는 순간 다시 읽고, 변경 기록', () => {
  const ib = fnSrc('importBank');
  assert.ok(ib.includes("approved:false,imp:impId}"), '가져오는 줄에 번호가 없다');
  assert.ok(ib.includes("upI['imports/'+_fid+'/'+_yr+'/'+impId]={at:") && ib.includes('fbDb.ref(NS).update(upI)'), '줄과 기록을 한 번에 안 쓴다');
  const u = fnSrc('impUndo');
  assert.ok(u.includes('if(!_isBoss())'), '아무나 되돌린다');
  assert.ok(u.includes("rd('txns/'+fid+'/'+yr),rd('closing/'+fid+'/'+yr+'/locked'),rd('closing/'+fid+'/'+yr+'/months')"), '누르는 순간 다시 안 읽는다');
  assert.ok(u.includes("up['txns/'+fid+'/'+yr+'/'+k]=null") && u.includes("'/undone']={at:at"), '걷어낸 표시가 없다(두 번 눌림)');
  assert.ok(u.includes("what:'통장 가져오기 되돌림'"), '변경 기록이 없다');
  assert.ok(u.indexOf('confirmM(') < u.indexOf('fbDb.ref(NS).update(up)'), '묻지 않고 지운다');
  assert.ok(SRC.includes('onclick="importsPanel()"'), '단추가 없다');
  assert.match(SRC, /'imp\.undo':\{t:'통장 가져온 기록'/);
  const p = fnSrc('_impRender');
  assert.ok(p.includes("'+_ckTh()+'<th style=\"width:36px\">#</th>") && p.includes("_ckTd()+'<td class=\"no\">'"), '목록에 □·# 가 없다');
});
