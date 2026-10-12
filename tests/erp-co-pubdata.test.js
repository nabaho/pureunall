/* 🏢 이알피 업체 상세 — 공단·국세청 자료 두 줄 (대표 「진행」 2026-10-12, 목업 승인)

   ★ 못 박는 것
     ① 사람이 적은 「4대보험」과 공단 숫자가 다르면 «다름» 표만 — 이알피 업체 자료에 저장하지 않는다
     ② 폐업은 빨강·휴업은 노랑으로 가른다
     ③ 국민연금은 «고른 사업장»의 숫자(nowSeq 가 있는 것)만 보인다
     ④ 회사는 사업자번호로만 찾는다
   ⚠ 예시는 가짜다(가나상사).
   node --test tests/erp-co-pubdata.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').split('\r\n').join('\n');
const fnOf = (head) => { const a = ERP.indexOf('\n' + head); assert.ok(a >= 0, head + ' 없음'); return ERP.slice(a + 1, ERP.indexOf('\n}\n', a) + 2); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
function sum(pub, co) {
  const ctx = { Number, String, Date, Math };
  vm.createContext(ctx);
  vm.runInContext(fnOf('function erpPubCoSummary('), ctx);
  return JSON.parse(JSON.stringify(ctx.erpPubCoSummary(pub, co)));
}

test('★★★ ① 공단 숫자와 업체 기록이 다르면 «다름» 표만', () => {
  const pub = { ei: { at: Date.UTC(2026, 9, 11), rows: [{}], gy: 32, sj: 30, n: 2 } };
  let s = sum(pub, { employmentInsuredCount: 30 });
  assert.equal(s.work.n, 32); assert.equal(s.work.sites, 2); assert.equal(s.work.kind, '고용보험');
  assert.match(s.diff, /2명 다름/, '★★★ 다른데 표가 없습니다');
  assert.equal(sum(pub, { employmentInsuredCount: 32 }).diff, '', '같은데 다름 표가 붙었습니다');
  assert.equal(sum(pub, {}).diff, '', '업체 기록이 비었는데 다름 표가 붙었습니다');
  assert.ok(sum({ ei: { at: 1, rows: null, gy: 0 } }, {}).work.none, '공단에 없는 번호를 «없음»으로 말하지 않습니다');
  assert.equal(sum(null, {}).work, null);
});

test('★★ ② 사업 상태 — 폐업 빨강·휴업 노랑', () => {
  assert.equal(sum({ nts: { state: '폐업자', at: '2026-10-01' } }, {}).nts.tone, 'bad');
  assert.equal(sum({ nts: { state: '휴업자' } }, {}).nts.tone, 'warn');
  assert.equal(sum({ nts: { state: '계속사업자' } }, {}).nts.tone, 'ok');
});

test('★★ ③ 국민연금은 고른 사업장 숫자만', () => {
  const ei = { at: 1, rows: [{}], gy: 5, n: 1 };
  assert.equal(sum({ ei, nps: { now: { cnt: 7 }, nowSeq: '13' } }, {}).work.nps, 7);
  assert.equal(sum({ ei, nps: { now: { cnt: 7 } } }, {}).work.nps, null, '★★ 고른 표시(nowSeq) 없는 숫자를 보입니다');
});

test('★★★ ④ 읽기만 — 업체 자료에 저장하지 않고, 사업자번호로만 찾는다', () => {
  const hook = strip(fnOf('function useErpPubCo('));
  assert.match(hook, /PuPubdata\.watch\(key/, '공용 자리를 구독하지 않습니다');
  assert.match(hook, /replace\(\/\\D\/g, ''\)/, '사업자번호 숫자로 찾지 않습니다');
  const modal = strip(fnOf('function CompanyDetailModal('));
  const a = modal.indexOf('erpPubCoSummary(pubCo, co)'), part = modal.slice(a, modal.indexOf('})()', a));
  assert.ok(a > 0, '업체 상세가 두 줄을 그리지 않습니다');
  assert.ok(!/dbSet|dbPatch|dbUpsert|employmentInsuredCount\s*=/.test(part), '★★★ 공단 숫자를 업체 자료에 적습니다');
  assert.match(part, /PuPubdata\.ask\(co\.bizNo, 'ei'/, '아직 안 받은 회사에 «받아 오기»가 없습니다');
  assert.match(ERP, /<script src="js\/pu-pubdata\.js\?v=\d+"><\/script>/);
});
