/* 컨설팅정산 — 온톨로지 등록부·사전·저장 계약·포털 타일 (2026-10-31)
   ★ 새 앱은 관문이 강제(enforce)다. 등록이 빠지면 화면의 저장이 전부 거절된다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const O = require('../js/pu-ontology.js');
const W = require('../js/pu-ontology-write.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('컨설팅정산이 등록부에 있고 쓰는 자리 다섯(규칙·연결·안내·정산표·이월)을 선언한다', () => {
  const g = O.PROGRAMS.settle;
  assert.ok(g, 'PROGRAMS.settle 가 없다');
  assert.equal(g.file, 'pu-settle.html');
  assert.deepEqual(g.primaryRoots, ['settle']);
  const paths = g.writeContracts.map((w) => w.path);
  ['rules/', 'links/', 'notices/', 'runs/', 'adjusts/'].forEach((k) => assert.ok(paths.some((p) => p.indexOf('settle/' + k) === 0), k + ' 쓰기 계약이 없다'));
  g.writeContracts.forEach((w) => assert.ok(g.entityTypes.indexOf(w.entityType) >= 0, w.path));
});

test('개체 종류 다섯이 사전에 있다', () => {
  ['SettleRule', 'SettleLink', 'SettleNotice', 'SettleRun', 'SettleAdjust'].forEach((k) => assert.ok(O.TERMS.entityTypes[k], k));
});

test('화면이 관문에 넘기는 개체 종류는 모두 등록된 것이다', () => {
  const html = read('pu-settle.html');
  const used = [...new Set([...html.matchAll(/'(Settle[A-Z][A-Za-z]+)'/g)].map((m) => m[1]))];
  assert.ok(used.length >= 5, used.join(','));
  used.forEach((t) => assert.ok(O.PROGRAMS.settle.entityTypes.indexOf(t) >= 0, t + ' 가 등록부에 없다'));
});

test('통합 진단은 이 자리를 읽지 않는다 — 앱 안에서만(in_app)', () => {
  const a = Object.values(O.READ_ADAPTERS).find((x) => x.program === 'settle');
  assert.ok(a, 'READ_ADAPTERS 에 settle 이 없다');
  assert.equal(a.strategy, 'in_app');
});

test('모든 새 프로그램의 저장 계약이 갖춰져 있다', () => {
  assert.equal(W.auditProgramContracts(O.PROGRAMS).ok, true);
});

test('정산표·규칙 레코드가 강제 관문을 통과한다', () => {
  ['SettleRule', 'SettleLink', 'SettleNotice', 'SettleRun', 'SettleAdjust'].forEach((t) => {
    const r = W.prepareRecord({ id: 'x1' }, { entityType: t, now: 1, actor: 'A-001', expectedRevision: -1 });
    assert.equal(r.ok, true, t + ' ' + JSON.stringify(r.issues));
  });
});

test('포털 타일과 앱 막대가 짝이다 — «내부관리» 줄, 재무관리와 같은 권한(perm fin)', () => {
  const tile = read('enter.html').split('\n').find((l) => /key:'settle'/.test(l));
  assert.ok(tile, 'enter.html 에 타일이 없다');
  assert.match(tile, /row:'inside'/); assert.match(tile, /url:'pu-settle\.html'/); assert.match(tile, /perm:'fin'/);
  const bar = read('js/pu-appbar.js').split('\n').find((l) => /key: 'settle'/.test(l));
  assert.ok(bar, 'pu-appbar.js 에 항목이 없다');
  assert.match(bar, /row: 'inside'/); assert.match(bar, /perm: 'fin'/);
});
