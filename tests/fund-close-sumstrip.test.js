'use strict';
/* 결산 요약 띠 — 좁은 화면·다른 하위 탭용 (2026-10-11, 목업 안 A). 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

let FIN = null;
const box = {};
new Function([
  'var S={fundId:"F1",year:2025,closeSub:"txn"}; var FIN=null;',
  'function closeArr(a){ return a; } function computeFin(){ return FIN; } function won(v){ return Number(v||0).toLocaleString()+"원"; }',
  'function splitPL(f){ return {netP:f.netP||0, netF:f.netF||0}; }',
  fnSrc('_sumStripHTML'),
  'this.S=S; this.html=_sumStripHTML; this.setFin=function(f){ FIN=f; };',
].join('\n')).call(box);

const FIN0 = { appr: 22, totalAssets: 412300000, totalLiabEq: 412300000, balanced: true, res2: 118400000, netP: 0, netF: 0 };
const tx = (n, ap) => Array.from({ length: n }, (_, i) => ({ _id: 'a' + i, approved: i < ap }));

test('★ 숫자 — 승인 기준 건수·미승인 빠짐·자산·부채자본·준비금2·당기순이익', () => {
  box.setFin(FIN0);
  const h = box.html(tx(67, 22));
  assert.match(h, /승인 22건 기준 · 미승인 45건 빠짐/);
  assert.match(h, /자산 <b>412,300,000원<\/b>/); assert.match(h, /부채·자본 <b>412,300,000원<\/b>/);
  assert.match(h, /준비금2 <b>118,400,000원<\/b>/); assert.match(h, /✅ 대차일치/); assert.match(h, /✅ 두 회계 모두 0/);
  assert.match(h, /class="warn">승인 22건/, '미승인이 남았는데 초록색이다');
  const done = box.html(tx(22, 22));
  assert.ok(!/빠짐/.test(done) && /class="ok">승인 22건 기준/.test(done), '미승인이 없으면 «빠짐» 없이 초록');
});

test('★ 틀린 것은 눈에 띄게 — 대차 차이·순이익 0 아님', () => {
  box.setFin(Object.assign({}, FIN0, { totalLiabEq: 412000000, balanced: false, netP: 1200, netF: -300 }));
  const h = box.html(tx(5, 5));
  assert.match(h, /⚠ 대차차이 300,000원/); assert.ok(!/✅ 대차일치/.test(h));
  assert.match(h, /목적사업 1,200 · 기금관리 -300/); assert.ok(!/두 회계 모두 0/.test(h));
});

test('★ 안 그리는 때 — 거래 없음·승인 거래 없음, 그리고 txn 탭만 표시용 클래스', () => {
  box.setFin(FIN0); assert.equal(box.html([]), ''); assert.equal(box.html(null), '');
  box.setFin(Object.assign({}, FIN0, { appr: 0 })); assert.equal(box.html(tx(3, 0)), '', '승인이 없는데 0 요약을 그린다');
  box.setFin(FIN0);
  assert.match(box.html(tx(3, 3)), /class="sumstrip txn"/);
  box.S.closeSub = 'journal'; assert.match(box.html(tx(3, 3)), /class="sumstrip"/, '다른 하위 탭에서는 늘 보여야 한다'); box.S.closeSub = 'txn';
});

test('★ 배선 — 머리 안에 붙고(고정), 넓은 화면의 거래·분개입력에서는 숨기며, 단추는 결산 판으로', () => {
  const ct = fnSrc('closingTab');
  assert.ok(ct.includes("+_sumStripHTML(arr)+closeSubBar()+'</div>'"), '회계 머리(고정) 안에 안 붙었다');
  const a = SRC.indexOf('@media(min-width:1850px){');
  assert.ok(SRC.slice(a, SRC.indexOf('\n  }\n', a)).includes('.sumstrip.txn{display:none}'), '붙박이 결산 판이 있는 화면에서 띠가 또 보인다');
  assert.ok(/\.sumstrip\{display:flex;flex-wrap:wrap/.test(SRC));
  const g = fnSrc('sumGo');
  assert.ok(g.includes("closeSub('fin')") && g.includes('.closeside') && g.includes('scrollIntoView'), '단추가 결산 판으로 안 간다');
});
