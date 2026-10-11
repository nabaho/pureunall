'use strict';
/* 서식 탭 사업계획서 — 추정재무상태표의 바탕은 «앞 해 기말» (2026-10-11, 대표 「서식 탭 사업계획서도 고쳐」). 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

const FIN = { cash: 100, savings: 0, secu: 5, loan: 0, otherAsset: 0, res1: 1, res2: 2, basic: 90, retained: 0, liab: 3, totalAssets: 105 };
function make(txns) {
  const box = {};
  new Function([
    'var S={fundId:"F1",formFund:"F1",year:2026,_bizBase:null,_docR:{keep:1}}, NS="fund_erp", reads=[];',
    "function num(v){ var n=Number(v); return isFinite(n)?n:0; }",
    'var fbDb={ref:function(p){ reads.push(p); return {once:function(){ return Promise.resolve({val:function(){ return TXNS; }}); }}; }};',
    'var TXNS=null; function closeArr(a){ return a; } function journalOf(a){ return a.filter(function(x){ return x.approved; }); } function computeFin(a,fid,yr){ return Object.assign({_fid:fid,_yr:yr},FIN); }',
    'var FIN=' + JSON.stringify(FIN) + ';',
    fnSrc('_bizBaseLoad'), fnSrc('_bizFinOf'), fnSrc('_docExtra'),
    'this.S=S; this.reads=reads; this.set=function(t){ TXNS=t; }; this.load=_bizBaseLoad; this.fin=_bizFinOf; this.extra=_docExtra;',
  ].join('\n')).call(box);
  box.set(txns);
  return box;
}

test('★ 앞 해 장부로 바탕을 읽는다 — 서식 해(2026)의 «2025년» 장부, 결산 확정 스냅샷이 아니다', async () => {
  const B = make({ a: { approved: true, debit: '현금성자산', credit: '출연금' } });
  assert.equal(B.fin(), null, '읽기 전에 바탕이 있다');
  await B.load({ name: 'X' });
  assert.deepEqual(B.reads, ['fund_erp/txns/F1/2025'], '앞 해 장부를 안 읽는다');
  assert.equal(B.S._bizBase.yr, 2025); assert.equal(B.S._bizBase.fid, 'F1');
  const fin = B.fin();
  assert.equal(fin.cash, 100); assert.equal(fin.res2, 2); assert.equal(fin.totalAssets, 105);
  B.S.year = 2027; assert.equal(B.fin(), null, '해가 바뀌었는데 옛 바탕을 쓴다');
  B.S.year = 2026; B.S.formFund = 'F2'; assert.equal(B.fin(), null, '기금이 바뀌었는데 남의 숫자를 쓴다');
});

test('★ 앞 해 장부가 없으면 비운다 — 0 을 바탕으로 삼지 않는다', async () => {
  const B = make({ a: { approved: false } });
  await B.load({ name: 'X' });
  assert.equal(B.S._bizBase.fin, null); assert.equal(B.fin(), null);
  const B2 = make(null); await B2.load({ name: 'X' }); assert.equal(B2.fin(), null);
});

test('★ 샘플·기금 없음은 읽지 않는다 / 사업계획서만 앞 해, 나머지 서식은 예전대로', async () => {
  const B = make({});
  assert.equal(await B.load({ _sample: true }), null); assert.equal(B.reads.length, 0);
  B.S.formFund = ''; assert.equal(await B.load({}), null);
  B.S.formFund = 'F1'; B.S._docR = { keep: 1 };
  await B.extra('bizplan', {}); assert.deepEqual(B.S._docR, { keep: 1 }, '사업계획서가 다른 서식이 읽어 둔 장부를 지운다');
  assert.equal(B.S._bizBase.yr, 2025);
});

test('★ 배선 — 서식 한 장·한글 한 장·한글 묶음·HTML 묶음·결산 후 진행이 모두 앞 해를 읽는다', () => {
  assert.ok(fnSrc('_docExtra').startsWith("function _docExtra(kind,f){\n  if(kind==='bizplan') return _bizBaseLoad(f);"), '서식 한 장·한글 한 장 길이 사업계획서 바탕을 안 읽는다');
  assert.ok(fnSrc('estabBundle').includes("return d[0]==='bizplan'; })) _pre=_pre.catch(function(){ return null; }).then(function(){ return _bizBaseLoad(f); });"), 'HTML 묶음이 안 읽는다');
  assert.ok(fnSrc('_estabBundleHwpGo').includes("(u.d[0]==='bizplan'?_bizBaseLoad(f)"), '한글 묶음이 안 읽는다');
  assert.ok(fnSrc('_flowPlanFill').includes('S._bizBase={fid:fid,yr:yr,'), '결산 후 진행이 같은 바탕 자리를 안 쓴다');
  /* 옛 길(지금 보는 해의 확정 스냅샷)로 다시 돌아가면 안 된다 */
  assert.ok(!fnSrc('_bizFinOf').replace(/\/\*[\s\S]*?\*\//g, '').includes('f15Close'), '바탕이 다시 확정 스냅샷으로 돌아갔다');   // 설명 주석은 빼고 코드만
  assert.ok(fnSrc('_bizFinOf').includes('b.yr!==S.year-1'), '바탕의 해를 안 맞춰 본다');
  /* 바탕이 없을 때 왜 비는지 알린다 */
  assert.ok(SRC.includes("그 해 승인된 분개가 없어 비웠습니다"), '왜 비었는지 안 알린다');
  assert.ok(SRC.includes("년 예산이 비어 있어 비웠습니다") && SRC.includes('(fin\n'), '바탕은 있는데 예산이 없을 때를 «분개가 없다»고 잘못 말한다');
});
