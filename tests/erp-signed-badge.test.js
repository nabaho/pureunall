'use strict';
/* 이알피 「📎 계약서 보관함」 — 🔒 문서관리 서명본 (대표 「추천대로」 2026-10-08) — 가짜 자료만
   ⓐ 회사 열쇠가 문서관리(PuOfficeStore.coKey)와 같다
   ⓑ 「이 계약」 — 서명본 올리기에서 이어 둔 계약번호(또는 계약 id)만, 위로
   ⓒ 읽기만 — pu_docs 두 칸을 once 로, 이알피 계약 자료에 쓰지 않는다 · 보관함 창에 붙어 있다 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const E = read('pu-erp.html');
const cutFn = (start) => { const a = E.indexOf(start); assert.ok(a >= 0, start); return E.slice(a, E.indexOf('\n}\n', a) + 2); };
function erpBox() {
  const b = { String, Object, Array };
  vm.createContext(b);
  vm.runInContext(cutFn('function erpDocCoKey(') + cutFn('function erpSignedFor('), b);
  return b;
}

test('ⓐ 회사 열쇠 — 문서관리와 같다', () => {
  const b = erpBox(), sb = { window: null };
  sb.window = sb; vm.createContext(sb); vm.runInContext(read('js/pu-office-store.js'), sb);
  ['(주) 가나 상사', '주식회사 다라.테크', '㈜마바#1', '사아 [본점]/2', '(유)ABC Co'].forEach((n) => {
    assert.equal(b.erpDocCoKey(n), sb.PuOfficeStore.coKey(n), n);
  });
});

test('ⓑ 이 계약 표시', () => {
  const b = erpBox();
  const docs = { d1: { title: '자문 계약서 (서명본)', date: '2026-10-07', secret: true }, d2: { title: '옛 계약서', date: '2025-01-02' }, d3: { title: '급여', date: '2026-09-01', secret: true } };
  const recs = { r1: { docId: 'd1', note: '이알피 계약 C-2026-0001' }, r2: { docId: 'd3', note: '이알피 계약 ct-xyz' }, r3: { note: '이알피 계약 C-2026-0001' } };
  const out = JSON.parse(JSON.stringify(b.erpSignedFor(docs, recs, 'C-2026-0001', 'ct-abc')));
  assert.deepStrictEqual(out.map((d) => [d.id, d.mine]), [['d1', true], ['d3', false], ['d2', false]]);
  const byId = JSON.parse(JSON.stringify(b.erpSignedFor(docs, recs, '', 'ct-xyz')));
  assert.equal(byId[0].id, 'd3'); assert.equal(byId[0].mine, true, '계약번호가 없으면 계약 id 로');
});

test('ⓒ 읽기만 · 보관함 창에', () => {
  const c = cutFn('function ErpSignedDocs(');
  assert.match(c, /db\.ref\('pu_docs\/co_docs\/' \+ key\)\.once\('value'\)/);
  assert.match(c, /db\.ref\('pu_docs\/co_recs\/' \+ key\)\.once\('value'\)/);
  assert.doesNotMatch(c, /\.(set|push|update|remove|transaction)\(|dbSet\(/, '쓰기가 없어야 한다');
  assert.match(cutFn('function ContractDocVault('), /h\(ErpSignedDocs, \{ companyName:/);
  /* 문서관리 서명본 올리기가 적는 note 와 같은 말 */
  assert.match(read('js/pu-office-docs.js'), /note: ct \? '이알피 계약 ' \+ ct : ''/);
});
