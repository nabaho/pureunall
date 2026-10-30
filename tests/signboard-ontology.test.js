/* 전광판 — 온톨로지 등록부·사전·저장 계약·포털 타일 (2026-10-12)
   ★ 새 앱은 관문이 강제(enforce)다. 등록이 빠지면 화면의 저장이 전부 거절된다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const O = require('../js/pu-ontology.js');
const W = require('../js/pu-ontology-write.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('전광판이 등록부에 있고 쓰는 자리 다섯을 선언한다(광고·올린 판·올린 기록·제어·활동 기록)', () => {
  const g = O.PROGRAMS.signboard;
  assert.ok(g, 'PROGRAMS.signboard 가 없다');
  assert.equal(g.file, 'pu-signboard.html');
  assert.deepEqual(g.primaryRoots, ['signboard']);
  const paths = g.writeContracts.map((w) => w.path);
  ['ads/', 'published', 'history/', 'control', 'log/'].forEach((k) =>
    assert.ok(paths.some((p) => p.indexOf('signboard/' + k) === 0), k + ' 쓰기 계약이 없다'));
  assert.equal(paths.some((p) => /state/.test(p)), false, 'state 는 심부름꾼이 쓴다 — 화면의 쓰기 계약에 없다');
  g.writeContracts.forEach((w) => assert.ok(g.entityTypes.indexOf(w.entityType) >= 0, w.path));
});

test('개체 종류 넷이 사전에 있다', () => {
  ['SignboardAd', 'SignboardPublish', 'SignboardControl', 'SignboardLog'].forEach((k) => assert.ok(O.TERMS.entityTypes[k], k));
});

test('통합 진단은 이 자리를 읽지 않는다 — 앱 안에서만(in_app)', () => {
  const a = Object.values(O.READ_ADAPTERS).find((x) => x.program === 'signboard');
  assert.ok(a, 'READ_ADAPTERS 에 signboard 가 없다');
  assert.equal(a.strategy, 'in_app');
});

test('모든 새 프로그램의 저장 계약이 갖춰져 있다', () => {
  assert.equal(W.auditProgramContracts(O.PROGRAMS).ok, true);
});

test('광고·올린 판·제어 레코드가 강제 관문을 통과한다', () => {
  const ad = W.prepareRecord({ id: 'ad_t1', title: '시험' }, { entityType: 'SignboardAd', now: 1, actor: 'A-001' });
  assert.equal(ad.ok, true, JSON.stringify(ad.issues));
  const pub = W.prepareRecord({ id: 'published', version: 1, ads: [] }, { entityType: 'SignboardPublish', now: 1, actor: 'A-001' });
  assert.equal(pub.ok, true, JSON.stringify(pub.issues));
  const hist = W.prepareRecord({ id: '3', version: 3, ads: [] }, { entityType: 'SignboardPublish', now: 1, actor: 'A-001' });
  assert.equal(hist.ok, true, JSON.stringify(hist.issues));
  const lg = W.prepareRecord({ id: 'lg_00000abc1234', at: 1, action: 'create' }, { entityType: 'SignboardLog', now: 1, actor: 'A-001', expectedRevision: -1 });
  assert.equal(lg.ok, true, JSON.stringify(lg.issues));
  const ctl = W.prepareRecord({ id: 'control', firstReplaceConfirmed: true }, { entityType: 'SignboardControl', now: 1, actor: 'A-001' });
  assert.equal(ctl.ok, true, JSON.stringify(ctl.issues));
});

/* 2026-10-30 대표 지시 「영업관리 … 모든 직원들에게 공개」 — perm·adminOnly 를 둘 다 뺐다(재직 직원 모두). */
test('포털 타일과 앱 막대가 짝이다 — «영업관리» 줄, 재직 직원 모두(perm·adminOnly 없음)', () => {
  const tile = read('enter.html').split('\n').find((l) => /key:'signboard'/.test(l));
  assert.ok(tile, 'enter.html 에 타일이 없다');
  assert.match(tile, /row:'sales'/); assert.match(tile, /url:'pu-signboard\.html'/);
  assert.doesNotMatch(tile, /adminOnly|perm\s*:/, '전광판 타일이 다시 관리자 전용으로 닫혔다');
  const bar = read('js/pu-appbar.js').split('\n').find((l) => /key: 'signboard'/.test(l));
  assert.ok(bar, 'pu-appbar.js 에 항목이 없다');
  assert.match(bar, /row: 'sales'/); assert.doesNotMatch(bar, /adminOnly|perm\s*:/, '앱 막대가 포털 타일과 어긋난다');
});
