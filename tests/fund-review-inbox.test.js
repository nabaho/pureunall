'use strict';
/* ✅ 확인함 — 기계가 넣고 아직 사람이 원본과 대조하지 않은 것만 한곳에 (대표 지시 2026-10-05 「추천대로」, 자동화 확인 목업 1·2번)
 * 이름·번호는 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); return SRC.slice(i, SRC.indexOf(';', i) + 1); };

function 상자(FUNDS) {
  const box = {};
  new Function('FUNDS', [
    "var S={year:2025,user:'김가람'}; var funds=FUNDS;",
    "function num(v){ var n=Number(String(v==null?'':v).replace(/,/g,'')); return isFinite(n)?n:0; }",
    "function isTrashed(f){ return !!(f&&f.deleted); }",
    "function docZoneLabel(k){ return ({inka:'설립인가증'})[k]||k; }",
    varSrc('XFER_MIN'), fnSrc('siteContribOf'), fnSrc('findTransfers'), fnSrc('_rvItems'), fnSrc('_rvSrcLabel'), fnSrc('_rvHowText'), fnSrc('_rvMine'),
    'this.items=_rvItems; this.src=_rvSrcLabel; this.how=_rvHowText; this.mine=_rvMine;',
  ].join(String.fromCharCode(10))).call(box, FUNDS);
  return box;
}
const FUNDS = { F1: { short_name: '한빛 1호', contrib_per_worker: 100000, mgr_main: { name: '김가람' } }, F2: { short_name: '새솔 2호' }, FX: { deleted: true } };

test('★ 칸 값 — 기계가 넣고 확인 안 된 것만. 원본 옆에서 넣은 것(dialog)·확인된 것·사람 것은 빠진다', () => {
  const b = 상자(FUNDS);
  const D = { prov: {
    F1: { 'f|agree_date': { m: 1, src: 'scan:inka', how: 'list' }, 'f|inka_no': { m: 1, src: 'scan:inka', how: 'dialog' },
      'f|chairman': { m: 1, src: 'card', how: '', ok: { by: '김가람', at: 'x' } }, 'f|phone': { m: 0, src: 'hand' },
      's|S1|wrep_name': { m: 1, src: 'scan:wrep', how: 'list' } },
    FX: { 'f|address': { m: 1, src: 'card', how: '' } } }, sites: {}, txns: {}, sy: {} };
  const it = b.items(D, 2025).filter((x) => x.t === 'prov').map((x) => x.fid + ' ' + x.key);
  assert.deepEqual(it, ['F1 f|agree_date', 'F1 s|S1|wrep_name']);
});

test('★ 추정 출연금 — 적은 값(그 해·기본)이 없고 사람수×단가로만 정해지는 사업장, 탈퇴는 빼고', () => {
  const b = 상자(FUNDS);
  const D = { prov: {}, txns: {}, sites: { F1: {
    S1: { name: '가나기계', company_size: 10 },
    S2: { name: '다라전자', company_size: 10, contrib: 3000000 },
    S3: { name: '마바산업', company_size: 10 },
    S4: { name: '사아식품', company_size: 10, status: 'closed' },
    S5: { name: '자차물산' } } },
    sy: { F1: { 2025: { S3: { contrib: 2500000 } } } } };
  const est = b.items(D, 2025).filter((x) => x.t === 'est');
  assert.deepEqual(est.map((x) => x.sid + ' ' + x.v), ['S1 1000000']);
});

test('★ 이체 짝·분개 승인 — 기금·연도마다 한 줄, 이체로 보이는 줄은 분개 승인 수에서 뺀다', () => {
  const b = 상자(FUNDS);
  const T = {
    a: { date: '2025-03-02', deposit: 1000000, withdraw: 0, acct: '111', sug: 'xfer', debit: '현금성자산', credit: '현금성자산' },
    b: { date: '2025-03-02', deposit: 0, withdraw: 1000000, acct: '222', sug: 'xfer', debit: '현금성자산', credit: '현금성자산' },
    c: { date: '2025-04-01', deposit: 50000, withdraw: 0, sug: 'rule', debit: '현금성자산', credit: '이자수익' },
    d: { date: '2025-04-02', deposit: 0, withdraw: 30000 },
    e: { date: '2025-05-01', deposit: 70000, withdraw: 0, approved: true },
  };
  const out = b.items({ prov: {}, sites: {}, sy: {}, txns: { F1: { 2025: T } } }, 2025);
  assert.deepEqual(out.find((x) => x.t === 'xfer'), { t: 'xfer', fid: 'F1', yr: '2025', n: 1 });
  assert.deepEqual(out.find((x) => x.t === 'txn'), { t: 'txn', fid: 'F1', yr: '2025', n: 2, sug: 1 });
});

test('출처 말 — 사람이 읽는 말로', () => {
  const b = 상자(FUNDS);
  assert.equal(b.src('scan:inka'), '설립인가증 판독');
  assert.equal(b.src('card'), '기업정보함');
  assert.equal(b.src('import:xlsx'), '엑셀 등록');
  assert.match(b.how({ src: 'guess:office' }), /추정/);
  assert.match(b.how({ src: 'card', how: 'list' }), /원본과 대조하지 않았습니다/);
});

test('내 기금만 — 주담당·부담당 이름으로', () => {
  const b = 상자(FUNDS);
  assert.equal(b.mine({ fid: 'F1' }), true);
  assert.equal(b.mine({ fid: 'F2' }), false);
});

test('★ 「맞음」 — 칸 값은 확인 표시만(값은 그대로), 추정 출연금은 그 금액을 적고 출처에 확인까지', () => {
  const ok = fnSrc('_rvOkMany');
  assert.match(ok, /up\['prov\/'\+it\.fid\+'\/'\+it\.key\+'\/ok'\]=\{by:by,at:at\}/);
  assert.match(ok, /up\['sites\/'\+it\.fid\+'\/'\+it\.sid\+'\/contrib'\]=it\.v/);
  assert.match(ok, /_track\(cells,\{what:'추정 출연금 확정\(확인함\)', ok:true\}\)/);
  assert.match(fnSrc('_track'), /if\(meta\.ok\) pv\.ok=\{by:by, at:at\}/);
  assert.ok(!/\/funds\/|\/sites\/[^']*\/(?!contrib)/.test(ok.replace(/'sites\/'\+it\.fid\+'\/'\+it\.sid\+'\/contrib'/g, '')), '칸 값을 «맞음»에서 바꾸면 안 된다');
});

test('★ 배선 — 메뉴 맨 위 · 길 · □·# · ⓘ · 키(한글 입력 중·창 떠 있으면 안 먹음)', () => {
  assert.match(SRC, /id="nav-review" onclick="go\(\\'review\\'\)"/);
  assert.ok(SRC.indexOf('id="nav-review"') < SRC.indexOf('id="nav-home-wrap"'), '확인함이 맨 위가 아니다');
  assert.match(fnSrc('route'), /else if\(S\.view==='review'\) renderReview\(\);/);
  assert.match(fnSrc('route'), /\['home','billing','forms','review'\]/);
  assert.match(fnSrc('renderReview'), /<th style="width:34px">□<\/th><th style="width:40px">#<\/th>/);
  assert.match(SRC, /'review\.inbox':\{t:'확인함 — 기계가 넣은 것을 사람 눈으로'/);
  const k = fnSrc('_rvBindKeys');
  assert.match(k, /ev\.isComposing/); assert.match(k, /modalbg'\)\|\|document\.getElementById\('confirmbg/);
  assert.match(SRC, /xfer:'계좌 간 이체로 보이는 짝/);
});
