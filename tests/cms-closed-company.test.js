'use strict';
/* 🏦 계약을 끝낸 자문사의 CMS 자동이체도 «알아본다» (건의 · 김보람 2026-10-27)

   ■ 건의 그대로
   「급여아웃소싱 업체 엔타스시가 계약 종료하면서 2개월분 자문료를 자동이체해왔는데 인식을 못하는 현상이 발생합니다.」

   ■ 왜 그랬나
   나이스빌 명세(출금 내역)의 회원명을 ERP 업체로 잇는 색인(erpNicebillCoIndex)이 «자문 중(active)» 업체만 담았다.
   계약을 끝낸 뒤에도 자동이체가 남은 달 몫으로 한두 번 더 나가는데(엔타스시: 4/17 220,000원 = 110,000 × 2개월),
   그 출금은 종료(closed) 업체라 「연결 안 됨」이 되었고 「CMS 내역대로 0곳 확정」이 되어 사람이 업체를 하나하나 찾아야 했다.

   ★ 규칙 (값이 아니라 규칙)
     ① 종료 업체도 «이름 또는 사업자번호가 꼭 같을 때만» 알아본다 — 비슷한 이름·예전 이름·학습 별칭으로는 붙지 않는다
     ② 거래내역 CMS 창(allowClosed)만 그렇다 — 다른 화면·자동 확정은 활성 업체만 잇는다(돈이 걸린 자리를 넓히지 않는다)
     ③ 활성 업체가 있으면 항상 활성이 먼저다 · 합쳐 없앤(mergedInto) 종료 업체는 안 붙는다
     ④ 창은 종료 업체를 «종료 업체»로 말하고, 자문료의 배수면 «몇 개월분»인지 알린다 · 확인 글에도 밝힌다 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const ERP = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8'));

function build(companies) {
  const ctx = {
    dbGet: (k, d) => (k === 'companies' ? companies : d),
    _erpNameCmp: (a, b) => ({ score: a === b ? 100 : (a && b && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) ? 90 : 0) }),   // 가까운 이름은 90 → 활성에서는 붙는다(88↑)
    erpAliasCompany: () => null, erpCleanMemo: (x) => x, erpPrevList: () => [],
    Object, Array, String, parseInt,
  };
  vm.createContext(ctx);
  vm.runInContext([
    cutFn(ERP, 'function erpNormName(s)'),
    cutFn(ERP, 'function _nbDigits(v)'),
    cutFn(ERP, 'function erpNicebillCoIndex()'),
    cutFn(ERP, 'function erpNicebillMatchCo(idx, name, bizNo, out)'),
    'this.idx = erpNicebillCoIndex(); this.match = erpNicebillMatchCo;',
  ].join('\n'), ctx);
  return ctx;
}
const CO = [
  { id: 'a1', name: '(주)활성상사', status: 'active', bizNo: '111-11-11111', monthlyAdvisoryFee: 110000 },
  { id: 'c1', name: '엔타스시', status: 'closed', bizNo: '123-81-20012', monthlyAdvisoryFee: 110000 },
  { id: 'c2', name: '합쳐진옛업체', status: 'closed', bizNo: '999-99-99999', mergedInto: 'a1' },
];

test('①★ 종료 업체는 «꼭 같은 이름»일 때 알아본다 (창이 허용했을 때)', () => {
  const w = build(CO); const out = { allowClosed: true };
  const hit = w.match(w.idx, '엔타스시', '', out);
  assert.ok(hit && hit.id === 'c1', '★ 종료 업체를 못 알아봅니다 — 「연결 안 됨」이 됩니다');
  assert.equal(out.via, 'closed'); assert.equal(hit.closed, true);
});

test('①★ 사업자번호가 꼭 같아도 알아본다 (이름이 달라도)', () => {
  const w = build(CO);
  const hit = w.match(w.idx, '다른표기', '123-81-20012', { allowClosed: true });
  assert.ok(hit && hit.id === 'c1');
});

test('①★ 비슷한 이름으로는 종료 업체에 붙지 않는다 (엉뚱한 업체에 돈이 찍히면 안 된다)', () => {
  const w = build(CO);
  assert.equal(w.match(w.idx, '엔타스시2호점', '', { allowClosed: true }), null, '★ 비슷한 이름이 종료 업체에 붙었다');
  assert.equal(w.match(w.idx, '엔타스', '', { allowClosed: true }), null);
});

test('②★ 허용하지 않은 호출(다른 화면·자동 확정)은 종료 업체를 받지 않는다', () => {
  const w = build(CO);
  assert.equal(w.match(w.idx, '엔타스시', '', {}), null, '★ 허용 없이 종료 업체가 붙었다 — 다른 화면이 넓어졌다');
  assert.equal(w.match(w.idx, '엔타스시', ''), null);
  /* 같은 색인으로 허용 호출 뒤에도 — 캐시가 섞이지 않는다 */
  w.match(w.idx, '엔타스시', '', { allowClosed: true });
  assert.equal(w.match(w.idx, '엔타스시', '', {}), null, '★ 허용 호출의 결과가 캐시로 새어 나왔다');
});

test('③★ 활성 업체가 먼저다 · 합쳐 없앤 종료 업체는 안 붙는다', () => {
  const w = build(CO);
  assert.equal(w.match(w.idx, '(주)활성상사', '', { allowClosed: true }).id, 'a1');
  assert.equal(w.match(w.idx, '합쳐진옛업체', '999-99-99999', { allowClosed: true }), null, '★ 합쳐 없앤 업체에 붙었다');
  const dup = build(CO.concat([{ id: 'a2', name: '엔타스시', status: 'active', bizNo: '123-81-20012' }]));
  const o = { allowClosed: true };
  assert.equal(dup.match(dup.idx, '엔타스시', '', o).id, 'a2', '같은 이름의 활성 업체가 있으면 그쪽이다');
  assert.notEqual(o.via, 'closed');
});

test('④★ 창은 종료 업체를 «종료 업체»로 말하고 몇 개월분인지 알린다 · 확인 글에도 밝힌다', () => {
  const win = cutFn(ERP, 'function CmsMatchModal(props)');
  assert.ok(/allowClosed\s*:\s*true/.test(win), '창이 종료 업체 허용을 안 켠다');
  assert.ok(/종료 업체/.test(win) && /개월분/.test(win), '창이 종료 업체·개월분을 말하지 않는다');
  assert.ok(/종료·해지 업체/.test(win), '확인 글이 종료 업체를 밝히지 않는다');
  assert.ok(/inPool\s*=\s*!!\(cn && \(byName\[cn\] \|\| \(_mv\.via === 'closed' && byNameAll\[cn\]\)\)\)/.test(win), '종료 업체가 목록에 «있는 것»으로 안 센다');
});

test('④★ (이빨) 허용 없이 종료 업체를 색인에 섞는 옛 모양은 ② 검사가 잡는다', () => {
  /* 활성 색인에 종료 업체를 섞은 것을 흉내 — 허용이 없어도 붙으면 위 ② 가 빨갛게 된다 */
  const w = build(CO.map((c) => (c.id === 'c1' ? Object.assign({}, c, { status: 'active' }) : c)));
  assert.ok(w.match(w.idx, '엔타스시', '', {}) !== null, '활성으로 바꾸면 허용 없이도 붙는다 — ② 의 null 기대가 의미 있다');
});
