/* 📍 기업정보함과 주소가 다르면 알린다 — 이알피 계약 창 · 업체관리 · 기업정보함 상세
   (대표 지시 2026-10-02 「반드시 연결이 제대로 될 수 있게 모두 시스템 개선해라」 → 목업 A·B·C → 「진행」)
   ★ 못 박는 것
     ① 사업자번호로 기업정보함 등록증 주소를 찾는다 — 이름으로 찾지 않는다
     ② 도·구 표기만 다른 것은 같은 곳 · 도로명·번호가 다르면 다른 곳 · 「이대로 둠」은 그 주소일 때만 조용하다
     ③ 계약 창이 같은 잣대로 한 줄 알리고, 「기업정보함 주소로」는 «검색»을 연다(글자를 베끼지 않는다)
     ④ 업체관리는 색인을 «받게 만들지 않는다» — 이미 받았을 때만 센다
     ⑤ 기업정보함 상세: 있지 않은 구 이름 → 「구 이름 확인」 + 바로잡기 · 등록증과 명함 주소가 같은 곳인지 한 줄
   ⚠ 주소·회사는 모두 지어낸 것이다(tests/no-real-client-data.test.js).
   node --test tests/co-addr-mismatch.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\r\n').join('\n');
const ERP = read('pu-erp.html'), CARDS = read('pu-cards.html');
const PuAddr = require(path.join(ROOT, 'js', 'pu-addr.js'));

function erp(idx) {
  const ctx = { window: { PuAddr, pucardsIdx: idx, addEventListener() {} }, Object, String };
  vm.createContext(ctx);
  vm.runInContext(['var _pcBizAd = null; var _pcIdx = window.pucardsIdx;',
    ...['function pcBizAddrByNo(', 'function erpAddrMismatch(', 'function coAddrMismatchList(', 'function coAddrIdxLoaded(']
      .map(f => cutFn(ERP, f))].join('\n'), ctx);
  return ctx;
}
const IDX = {
  b1: { k: 'biz', bz: '123-45-67890', c: '가나상사', ad: '충청남도 가나시 서구 다라읍 마바1길 27' },
  b2: { k: 'biz', bz: '123-45-67891', c: '가나상사', ad: '충남 가나시 사아로 5' },
  c1: { k: 'card', c: '가나상사', ad: '충남 가나시 자차로 9' }
};

test('★★★ ① 사업자번호로 찾는다 — 이름이 같아도 번호가 다르면 다른 회사', () => {
  const c = erp(IDX);
  assert.equal(c.pcBizAddrByNo('1234567890').ad, IDX.b1.ad);
  assert.equal(c.pcBizAddrByNo('123-45-67891').ad, IDX.b2.ad, '★★★ 같은 이름 다른 회사의 주소를 가져왔다');
  assert.equal(c.pcBizAddrByNo(''), null);
  assert.equal(c.pcBizAddrByNo('9990000000'), null);
});

test('★★★ ② 표기만 다르면 같은 곳 · 길이 다르면 다른 곳 · 「이대로 둠」', () => {
  const c = erp(IDX);
  assert.equal(c.erpAddrMismatch({ bizNo: '1234567890', address: '충남 가나시 서북구 다라읍 마바1길 27' }), null,
    '★ 구 표기만 다른데 다르다고 했다');
  assert.ok(c.erpAddrMismatch({ bizNo: '1234567890', address: '충남 가나시 동남구 자차1길 5' }), '★★★ 다른 동네를 못 잡았다');
  const list = [
    { id: 'x1', bizNo: '1234567890', address: '충남 가나시 자차1길 5' },
    { id: 'x2', bizNo: '1234567890', address: '충남 가나시 자차1길 5', addrKeep: '충남 가나시 자차1길 5' },
    { id: 'x3', bizNo: '1234567890', address: '충남 가나시 자차1길 7', addrKeep: '충남 가나시 자차1길 5' },
    { id: 'x4', bizNo: '1234567890', address: '충남 가나시 자차1길 5', _deleted: true }
  ];
  assert.deepEqual(c.coAddrMismatchList(list).map(r => r.co.id), ['x1', 'x3'],
    '★ 「이대로 둠」은 그 주소일 때만 조용해야 한다 — 주소가 또 바뀌면 다시 묻는다');
});

test('★★★ ③ 계약 창 — 같은 잣대로 한 줄 · 「기업정보함 주소로」는 검색을 연다', () => {
  const i = ERP.indexOf("sec6('📍 주소'");
  const sec = ERP.slice(i, ERP.indexOf("sec6('☎ 대표연락처'", i));
  assert.match(sec, /erpAddrMismatch\(f\.company\)/, '★ 계약 창이 다른 잣대로 본다');
  assert.match(sec, /addrKeep === f\.company\.address/, '★ 「이대로 둠」을 기억하지 않는다');
  assert.match(sec, /openAddressSearch\(function\(r\)\{[\s\S]*?\}, mis\.ad\)/, '★★ 등록증 글자를 그대로 베낀다 — 우편번호가 비고 판독 오타가 따라온다');
  assert.match(cutFn(ERP, 'function ContractModal('), /usePucardsIdxReady\(\);/, '★ 창을 열 때 색인을 안 받아 견줄 수가 없다');
});

test('★★★ ④ 업체관리는 색인을 받게 만들지 않는다 — 받은 뒤에만 센다', () => {
  const cm = cutFn(ERP, 'function CompanyManagement(');
  assert.match(cm, /coAddrIdxLoaded\(\) \? coAddrMismatchList\(companies\)\.length : -1/);
  assert.ok(!/usePucardsIdxReady\(\)|ensurePucardsIdx\(\)/.test(cm), '★★ 업체관리를 열기만 해도 1.36MB 를 받는다');
  assert.match(cm, /h\(CoAddrModal,/, '★ 목록 창이 안 붙었다');
  assert.match(cutFn(ERP, 'function CoAddrModal('), /usePucardsIdxReady\(\);/, '★ 「주소 대조」를 눌러도 색인을 안 받는다');
  assert.match(cutFn(ERP, 'function CoAddrModal('), /addrKeep: r\.co\.address/);
});

test('★★★ ⑤ 기업정보함 상세 — 있지 않은 구 · 명함 주소와 같은 곳인가', () => {
  const ctx = { window: { PuAddr }, Object, String,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    digits: s => String(s || '').replace(/\D/g, ''),
    _norm: s => String(s || '').replace(/\s|\(주\)|주식회사|㈜/g, '').toLowerCase(),
    state: { items: {
      k1: { id: 'k1', kind: 'card', company: '(주)가나상사', companyAddr: '충남 천안시 서북구 다라읍 마바1길 27' },
      k2: { id: 'k2', kind: 'card', company: '다른회사', companyAddr: '충남 천안시 동남구 자차로 1' } } } };
  vm.createContext(ctx);
  vm.runInContext(['var ADDR_KEY_OF = { biz:"address", card:"companyAddr" };',
    cutFn(CARDS, 'function addrCardOf('), cutFn(CARDS, 'function addrNoteHtml(')].join('\n'), ctx);
  const biz = { id: 'b1', kind: 'biz', company: '가나상사', bizno: '', address: '충청남도 천안시 서구 다라읍 마바1길 27' };
  const h = ctx.addrNoteHtml(biz, 'address');
  assert.match(h, /구 이름 확인/, '★★★ 있지 않은 구 이름을 못 잡았다');
  assert.match(h, /addrFixOpen\('b1'\)/, '★ 바로잡는 단추가 없다');
  assert.match(h, /같은 곳 ✓/, '★ 명함 주소와 같은 곳인지 안 보인다');
  assert.equal(ctx.addrNoteHtml(biz, 'ceo'), '', '★ 주소가 아닌 칸에 붙었다');
  assert.equal(ctx.addrNoteHtml({ id: 'b2', kind: 'biz', company: '없는회사', address: '충남 천안시 서북구 마바로 3' }, 'address'), '',
    '★ 맞는 주소에 군말을 붙였다');
  for (const f of ['function openDetail(', 'function openPcDetail(']) {
    assert.match(cutFn(CARDS, f), /v \+= addrNoteHtml\(it, k\);/, '★ ' + f + ' 에 주소 확인이 없다 — 폰·PC 한쪽만 보인다');
  }
  const fix = cutFn(CARDS, 'function addrFixOpen(');
  assert.match(fix, /PA\.query\(before\)/, '★ 바로잡기가 틀린 주소를 통째로 검색한다');
  assert.match(fix, /PA\.key\(before\)/, '★ 다른 곳을 골라도 묻지 않는다');
  assert.match(CARDS, /<script src="js\/pu-addr\.js\?v=\d+"><\/script>/);
});
