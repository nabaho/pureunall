'use strict';
/* 업무 기록의 회사 정보는 «업체관리(주인)»에서 읽는다 — 업체 정보 근본 해결 3단계
   (대표 지시 2026-10-04 「마지막으로 진행해라」, 목업 co-read-from-owner 3-가·3-나)

   못 박는 것(규칙 — 회사 이름·칸 개수를 박지 않는다):
   ① 주인은 업체 «번호»로만 찾는다 — 이름이 같아도 번호가 없으면 남이다
   ② 이어졌으면 주인 값이 이기고, 베낀 값과 다르면 옛 값을 남긴다. 주인이 비었으면 베낀 값
   ③ 보여 주기만 한다 — 베낀 기록을 고치지 않는다
   ④ 담당자는 주인의 목록이 먼저다
   ⑤ 근로자 의뢰 사건은 «연결 안 됨»이 아니다
   ⑥ 상세 창·목록이 이 길로 읽고, 연결 안 된 기록은 「연결하기」(기존 🔗 업체 연결)로 보낸다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const B = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const fn = (n) => { const f = cutFn(B, 'function ' + n + '('); assert.ok(f, n + ' 를 못 찾았습니다'); return f; };
const varLine = (name) => { const m = B.match(new RegExp('var ' + name + ' = \\[[\\s\\S]*?\\];')); assert.ok(m, name + ' 없음'); return m[0]; };

function 상자(companies) {
  const ctx = { dbGet: (k, d) => (k === 'companies' ? companies : d), String, Array, Object, JSON };
  vm.createContext(ctx);
  vm.runInContext([varLine('CO_OWNER_FIELDS'), 'var _coOwnerSrc = null, _coOwnerMap = null;',
    fn('coOwnerOf'), fn('_coOwnerNorm'), fn('_coOwnerHas'), fn('coOwnerView'), fn('coShown'), fn('coNeedsOwner')].join('\n'), ctx);
  return ctx;
}
const 가나 = { id: 'co1', name: '가나상사', ceo: '홍길동', address: '천안시 서북구 새주소로 2', phone: '041-000-0000',
  primaryContactName: '이몽룡', primaryContactPhone: '010-1111-1111',
  contacts: [{ name: '이몽룡', phone: '010-1111-1111', isPrimary: true }] };

test('① ★★ 주인은 업체 번호로만 찾는다 — 이름이 같아도 번호가 없으면 잇지 않는다', () => {
  const c = 상자([가나]);
  assert.ok(c.coOwnerOf({ companyId: 'co1' }), '번호로 못 찾습니다');
  assert.equal(c.coOwnerOf({ companyName: '가나상사' }), null, '★★ 이름으로 이었습니다 — 같은 이름 남의 회사에 붙습니다');
  assert.equal(c.coOwnerOf({ companyId: '없는번호', companyName: '가나상사' }), null, '없는 번호를 이름으로 메웠습니다');
  assert.equal(c.coOwnerOf({ companyId: 'co2' }), null);
  // 지운 업체는 주인이 아니다
  const d = 상자([Object.assign({}, 가나, { _deleted: true })]);
  assert.equal(d.coOwnerOf({ companyId: 'co1' }), null, '지운 업체를 주인으로 읽습니다');
});

test('② ★★ 이어졌으면 업체관리 값이 이기고, 다르면 옛 값을 남긴다 · 주인이 비면 베낀 값', () => {
  const c = 상자([가나]);
  const rec = { id: 'k1', companyId: 'co1', companyName: '가나상사', ceo: '홍길동', address: '천안시 동남구 옛주소로 1',
    phone: '041 000 0000', email: 'old@가나상사.kr', primaryContactName: '임꺽정' };
  const v = c.coOwnerView(rec);
  assert.equal(v.linked, true);
  assert.equal(v.val.address, 가나.address, '★★ 업체관리를 고쳤는데 옛 주소를 보여 줍니다');
  assert.equal(v.old.address, '천안시 동남구 옛주소로 1', '옛 값을 안 남겨 «바뀌었다»를 알 수 없습니다');
  assert.equal(v.val.primaryContactName, '이몽룡', '★★ 떠난 담당자를 보여 줍니다');
  assert.equal(v.old.primaryContactName, '임꺽정');
  assert.equal(v.old.phone, undefined, '띄어쓰기만 다른 전화를 «바뀌었다»로 봅니다');
  assert.equal(v.old.ceo, undefined, '같은 대표자를 바뀌었다고 합니다');
  assert.equal(v.val.email, 'old@가나상사.kr', '주인이 비었는데 베낀 값까지 버렸습니다');
  // 이어지지 않았으면 베낀 값 그대로, 옛 값 표시 없음
  const u = c.coOwnerView({ id: 'k2', companyName: '다라상회', address: '아산시 예시로 3' });
  assert.equal(u.linked, false);
  assert.equal(u.val.address, '아산시 예시로 3');
  assert.deepEqual(Object.keys(u.old), []);
  assert.equal(c.coShown(rec, 'address'), 가나.address, '목록 칸도 업체관리 값이어야 합니다');
});

test('③ ★★ 보여 주기만 한다 — 베낀 기록을 고치지 않는다', () => {
  const c = 상자([가나]);
  const rec = { id: 'k1', companyId: 'co1', companyName: '옛이름', address: '옛주소', contacts: [{ name: '임꺽정' }] };
  const 전 = JSON.stringify(rec), 주인전 = JSON.stringify(가나);
  c.coOwnerView(rec); c.coShown(rec, 'name');
  assert.equal(JSON.stringify(rec), 전, '★★ 베낀 기록을 고쳤습니다 — 업체가 지워지면 그때 무엇이었는지 사라집니다');
  assert.equal(JSON.stringify(가나), 주인전, '업체관리 기록을 건드렸습니다');
});

test('④ 담당자는 업체관리 목록이 먼저다', () => {
  const c = 상자([가나]);
  const v = c.coOwnerView({ id: 'k1', companyId: 'co1', contacts: [{ name: '임꺽정' }] });
  assert.ok(v.contacts && v.contacts[0].name === '이몽룡', '★ 베낀 담당자 목록을 보여 줍니다');
  const 빈 = 상자([{ id: 'co1', name: '가나상사' }]);
  assert.equal(빈.coOwnerView({ id: 'k1', companyId: 'co1' }).contacts, null, '주인에게 목록이 없으면 비워 두어야 화면이 다음 차례로 넘어갑니다');
});

test('⑤ 근로자 의뢰 사건은 «연결 안 됨»이 아니다', () => {
  const c = 상자([]);
  assert.equal(c.coNeedsOwner({ companyName: '가나상사', clientType: 'worker' }), false);
  assert.equal(c.coNeedsOwner({ companyName: '' }), false);
  assert.equal(c.coNeedsOwner({ companyName: '가나상사', clientType: 'company' }), true);
});

test('⑥ ★★ 상세 창·목록이 이 길로 읽고, 연결 안 된 기록은 「연결하기」로 보낸다', () => {
  const D = fn('UnifiedDetailModal');
  assert.match(D, /coOwnerView\(c\)/, '★★ 상세 창이 업체관리를 안 봅니다 — 베낀 값만 보입니다');
  assert.doesNotMatch(D, /h\('strong', null, c\.companyName/, '★ 상세 창이 업체명을 베낀 값에서 바로 읽습니다');
  assert.doesNotMatch(D, /\['주소', c\.address\]/, '★ 상세 창이 주소를 베낀 값에서 바로 읽습니다');
  assert.match(D, /coLinkStateOf\(c\)/, '연결 안 된 기록이 이을 수 있는지 안 봅니다');
  assert.match(D, /h\(CoLinkModal,/, '★ 「연결하기」가 업체 연결 창으로 안 갑니다');
  assert.match(D, /h\(CompanyDetailModal, \{ cur:_ov\.co/, '「업체 열기」가 없습니다');
  assert.match(B, /'🏢 ' \+ \(coShown\(c, 'name'\)/, '사건 목록 업체명이 업체관리를 안 봅니다');
  assert.match(B, /title:coShown\(it, 'name'\)/, '사업 목록 업체명이 업체관리를 안 봅니다');
  // 연결 상태 판정은 기존 「🔗 업체 연결」 후보를 그대로 쓴다 — 두 벌이면 어긋난다
  assert.match(fn('coLinkStateOf'), /coLinkCandidates\(\)/, '★ 연결 판정을 따로 셉니다 — 업체 연결 창과 말이 달라집니다');
});
