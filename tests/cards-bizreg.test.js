/* 🧾 새로 들어온 사업자등록증 — 기업정보함 창 (대표 지시 2026-10-12, 목업 승인)

   ★ 못 박는 것
     ① 노란 줄(사람 확인) = 검토가 «확인 필요»라 했고 아직 「확인함」을 안 누른 줄. 새것이 위.
     ② 꼬리표가 결과를 바르게 가른다 — 폐업 빨강·대조 다름·4대보험 없음·옛 번호·기존/새 회사
     ③ 「옛 번호에 새 번호 적기」는 새 번호가 계속사업자일 때만, 국세청 «새 번호» 칸만 적는다(합치지 않는다)
     ④ 최근 30일만 at 색인으로 추려 읽는다(통째로 받지 않는다)
   ⚠ 예시는 가짜다(가나상사).
   node --test tests/cards-bizreg.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
function box(extra) {
  const ctx = Object.assign({ String, Number, Object, Array, Date, JSON, esc: (v) => String(v == null ? '' : v) }, extra || {});
  vm.createContext(ctx);
  vm.runInContext([SRC.match(/const BZR_DAYS = [^\n]*/)[0], 'let _bzr = null;',
    sliceFn(SRC, 'function bzrRows('), sliceFn(SRC, 'function bzrTags('), sliceFn(SRC, 'function bzrNewNo(')].join('\n'), ctx);
  return ctx;
}

test('★★★ ① 노란 줄은 «확인 필요»이고 아직 확인 안 한 것 · 새것이 위', () => {
  const c = box();
  const rows = JSON.parse(JSON.stringify(c.bzrRows({
    a: { no: '1', at: 1, need: true }, b: { no: '2', at: 3, need: true, done: { at: 9, by: '가' } },
    c: { no: '3', at: 2, need: false }, d: { at: 5 } })));
  assert.deepEqual(rows.map((x) => x.key), ['b', 'c', 'a'], '새것이 위가 아니거나 번호 없는 줄이 섞였다');
  assert.deepEqual(rows.map((x) => x.todo), [false, false, true], '★★★ 확인한 줄·다 맞는 줄이 노란 줄로 남았다');
});

test('★★ ② 꼬리표', () => {
  const c = box();
  const t = c.bzrTags({ nts: { state: '폐업자', end: '2024-01-31' }, match: 'bad', ei: { none: 1 }, old: [{ no: '1' }], conflicts: ['ceo'] });
  assert.match(t, /bzr-c no">🏛 폐업자 2024-01-31/); assert.match(t, /대표자·개업일 다름/);
  assert.match(t, /4대보험 사업장 없음/); assert.match(t, /옛 번호 1곳/); assert.match(t, /다른 칸 1/);
  const ok = c.bzrTags({ nts: { state: '계속사업자' }, match: 'ok', ei: { n: 7 }, link: 'existing' });
  assert.match(ok, /bzr-c ok">🏛 계속사업자/); assert.match(ok, /상시 7명/); assert.match(ok, /기존 회사에 붙음/);
  assert.match(c.bzrTags({ nts: { state: '국세청에 등록되지 않은 사업자등록번호입니다.' } }), /국세청에 없는 번호/);
});

test('★★★ ③ 옛 번호에 새 번호 — 계속사업자일 때만, 새 번호 칸만(합치지 않는다)', () => {
  const saved = [], toasts = [];
  const c = box({ confirm: () => true, toast: (m) => toasts.push(m), todayYmd: () => '2026-10-13', bzrDone: () => {},
    coSaveInfoPatch: (k, p) => saved.push({ k, p }) });
  vm.runInContext("_bzr = { r1: { no:'2222222222', nts:{ state:'폐업자' }, old:[{ no:'1111111111', state:'폐업자' }] }, r2: { no:'3333333333', nts:{ state:'계속사업자' }, old:[{ no:'1111111111' }] } };", c);
  c.bzrNewNo('r1');
  assert.equal(saved.length, 0, '★★★ 새 번호가 폐업인데 적었다');
  c.bzrNewNo('r2');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].k, '1111111111', '옛 번호 쪽에 적어야 한다');
  assert.deepEqual(Object.keys(saved[0].p).sort(), ['ntsNewAt', 'ntsNewNo', 'ntsNewState'], '★★★ 새 번호 칸 말고 다른 칸(합치기·sameAs)을 건드렸다');
  assert.equal(saved[0].p.ntsNewNo, '3333333333');
});

test('★★ ④ 최근 30일만 색인으로 · 옆줄·폰 메뉴에 문이 있다', () => {
  const ld = sliceFn(SRC, 'function bzrLoad(');
  assert.match(ld, /orderByChild\('at'\)\.startAt\(/, '★★ 통째로 받는다');
  assert.match(SRC, /onclick="bzrOpen\(\)"[^>]*>🧾<em>새 등록증<\/em>/, 'PC 옆줄 문이 없다');
  assert.match(SRC, /goneOpen\(\)">🏚 없어진 듯한 곳[\s\S]{0,200}bzrOpen\(\)">🧾 새 등록증/, '폰 메뉴 문이 없다');
});
