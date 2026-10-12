'use strict';
/* ⑳ 기본재산 ≠ 재무상태표 기본재산 — 특별적립금 힌트와 확정 때 경고 (2026-10-12). 이름·숫자는 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

const box = {};
new Function(['function num(v){ var n=Number(String(v==null?"":v).replace(/,/g,"")); return isNaN(n)?"":n; }',
  'function _k1000(v){ return Math.round((Number(v)||0)/1000); }',
  fnSrc('spresvOf'), fnSrc('f15Checks'), 'this.sp=spresvOf; this.ck=f15Checks;'].join('\n')).call(box);

const R = (end, book) => ({ fin: { basic: book }, bfEnd: end, bfOpen: 0, bfInc: 0, bfDec: 0, bf: {}, run: {}, src: {}, items: [], subAmt: 0, loanAmt: 0, admin: 0, rest: 0, total: 0 });

test('★ 특별적립금 분개 — 승인된 것만 건수·금액', () => {
  const arr = [
    { approved: true, debit: '기본재산', credit: '손실대비특별적립금', amount: 106108000 },
    { approved: true, debit: '손실대비특별적립금', credit: '이월잉여금', amount: 2000 },
    { approved: false, debit: '기본재산', credit: '손실대비특별적립금', amount: 999 },
    { approved: true, debit: '현금성자산', credit: '출연금', amount: 5 },
  ];
  assert.deepEqual(box.sp(arr), { n: 2, sum: 106110000 });
  assert.deepEqual(box.sp([]), { n: 0, sum: 0 }); assert.deepEqual(box.sp(null), { n: 0, sum: 0 });
});

test('★ ⑳이 재무상태표와 다르면 k:bf20 경고 — 특별적립금이 있으면 힌트가 붙고, 없으면 안 붙는다', () => {
  const a = box.ck(R(599740000, 493638000), { n: 1, sum: 106108000 }).filter((c) => c.k === 'bf20');
  assert.equal(a.length, 1); assert.equal(a[0].lv, 'err');
  assert.match(a[0].d, /손실대비특별적립금» 분개가 1건\(106,108천원\)/); assert.match(a[0].d, /세무사 확인/);
  const b = box.ck(R(599740000, 493638000), { n: 0, sum: 0 }).filter((c) => c.k === 'bf20');
  assert.equal(b.length, 1); assert.ok(!/특별적립금/.test(b[0].d), '분개가 없는데 특별적립금 얘기를 한다');
  const c = box.ck(R(599740000, 493638000)).filter((x) => x.k === 'bf20');
  assert.equal(c.length, 1, '두 번째 인자 없이도 부를 수 있어야 한다(옛 호출)');
});

test('★ 같으면 조용 — 천원 단위 반올림 안에서', () => {
  assert.equal(box.ck(R(493638300, 493638000), { n: 1, sum: 1 }).filter((c) => c.k === 'bf20').length, 0);
});

test('★ 배선 — 운영상황보고서 탭과 결산 확정 창 모두에서 부른다', () => {
  assert.ok(/f15Checks\(R,spresvOf\(/.test(SRC), '운영상황보고서 탭이 분개를 안 넘긴다');
  const lc = fnSrc('lockClosing');
  assert.ok(lc.includes("f15Checks(_R,spresvOf(arr))") && lc.includes("c.k==='bf20'"), '확정 창에 ⑳ 경고가 안 뜬다');
});
