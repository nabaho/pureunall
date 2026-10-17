'use strict';
/* 폰·PC 가 서로 고쳐도 «띠 없이 합쳐진다» (대표 지시 2026-10-18 「항상 상단에 다른 기기 데이터 체크 항목이 나온다 — 한 번에 해결」)
   막다른 길이었다: 클라우드가 새것이면 올리기 멈춤 + 안 올린 고침이 있으면 받기 멈춤 → 둘 다 고치면 띠가 영영.
   규칙만 못 박는다: 더하기만 한다(잃지 않는다) · 지운 기록은 되살아나지 않는다 · 고친 것은 늦은 쪽이 이긴다 · 띠는 «합치지 못했을 때만». */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const N = require('../js/kcareer-notices.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const J = JSON.stringify;
const ids = (raw) => JSON.parse(raw).map((r) => r.id).sort();

test('① 한쪽에만 있는 기록은 그대로 더한다 — 폰에만 있던 것도 PC 에만 있던 것도 산다', () => {
  const here = { cert: J([{ id: 'C1' }, { id: 'C2' }]) }, cloud = { cert: J([{ id: 'C1' }, { id: 'C3' }]) };
  const m = N.mergeLs(here, cloud, {});
  assert.deepEqual(ids(m.ls.cert), ['C1', 'C2', 'C3']);
  assert.equal(m.fromLocal, 1);
});

test('② 같은 번호는 저장 시각이 늦은 쪽이 이긴다 — 이 기기 고침이 클라우드에 덮이지 않는다', () => {
  const here = { cert: J([{ id: 'C1', t: '폰', savedAt: '2026-10-18T09:00:00Z' }, { id: 'C2', t: '폰2' }]) };
  const cloud = { cert: J([{ id: 'C1', t: 'PC', savedAt: '2026-10-18T08:00:00Z' }, { id: 'C2', t: 'PC2', savedAt: '2026-10-01T00:00:00Z' }]) };
  const m = N.mergeLs(here, cloud, {});
  const by = Object.fromEntries(JSON.parse(m.ls.cert).map((r) => [r.id, r.t]));
  assert.equal(by.C1, '폰', '이 기기 것이 늦다');
  assert.equal(by.C2, 'PC2', '이 기기 것에 시각이 없으면 클라우드 것(고친 흔적이 없다)');
  assert.equal(m.localWins, 1);
  const rev = N.mergeLs({ cert: J([{ id: 'C1', t: '폰', savedAt: '2026-10-18T07:00:00Z' }]) }, cloud, {});
  assert.equal(JSON.parse(rev.ls.cert).find((r) => r.id === 'C1').t, 'PC', '클라우드가 더 늦으면 클라우드 것');
});

test('③ 지운 기록은 되살아나지 않는다 — 어느 쪽에서 지웠든 · 되살린 것은 산다', () => {
  const here = { cert: J([{ id: 'C1' }, { id: 'C2' }]), _tomb: J({ C3: 100 }) };
  const cloud = { cert: J([{ id: 'C2' }, { id: 'C3' }, { id: 'C4' }]), _tomb: J({ C1: 100 }), _tombrev: J({ C4: 200 }) };
  const m = N.mergeLs(here, cloud, {});
  assert.deepEqual(ids(m.ls.cert), ['C2', 'C4'], 'C1 은 클라우드가 지움 · C3 은 이 기기가 지움');
  assert.deepEqual(Object.keys(JSON.parse(m.ls._tomb)).sort(), ['C1', 'C3'], '기록표도 합친다');
  const live = N.mergeLs({ cert: J([{ id: 'X' }]), _tomb: J({ X: 100 }), _tombrev: J({ X: 300 }) }, { cert: J([]) }, {});
  assert.deepEqual(ids(live.ls.cert), ['X'], '지웠다가 되살린 시각이 더 늦으면 산다');
});

test('④ 안 오가는 열쇠(skip)는 넣지 않고, 설정 한 덩이는 클라우드 것 · 한쪽에만 있으면 그것', () => {
  const m = N.mergeLs({ draft: 'a', info: J({ n: '폰' }), only: 'L' }, { draft: 'b', info: J({ n: 'PC' }), c: 'C' }, { skip: ['draft'] });
  assert.ok(!('draft' in m.ls));
  assert.equal(JSON.parse(m.ls.info).n, 'PC');
  assert.equal(m.ls.only, 'L'); assert.equal(m.ls.c, 'C');
});

test('⑤ 합친 결과는 «줄지 않는다» — 양쪽 어느 쪽 건수보다 적지 않다(지운 기록표로 뺀 것 제외)', () => {
  const a = [], b = [];
  for (let i = 0; i < 40; i++) a.push({ id: 'A' + i });
  for (let i = 0; i < 25; i++) b.push({ id: 'B' + i }); b.push({ id: 'A3' });
  const m = N.mergeLs({ w: J(a) }, { w: J(b) }, {});
  assert.equal(JSON.parse(m.ls.w).length, 40 + 25);
});

test('⑥ 화면 — 안 올린 고침이 있어도 합쳐 받고 올린다 · 창이 열려 있으면 띠 없이 기다린다 · 합치지 못했을 때만 띠', () => {
  const f = strip(떼기('function fbNewerSync('));
  assert.ok(/KcareerNotices\.mergeLs\(/.test(f) && f.indexOf('mergeLs') < f.indexOf('kcApplyRestore') && f.indexOf('kcApplyRestore') < f.indexOf('_fbDoPush'), '합치기 → 이 기기에 쓰기 → 올리기');
  assert.ok(!/_fbPendingNow\(\)\s*\)\s*\{\s*fbShowNotice/.test(f) && !/pending\s*\|\|/.test(f), '안 올린 고침이 있다고 띠를 띄우지 않는다');
  assert.ok(/\.modal-ov\.open/.test(f) && /setTimeout\(fbNewerSync,\s*15000\)/.test(f), '창이 열려 있으면 띠 없이 15초 뒤 다시');
  assert.ok(/_fbMergeFails<5/.test(f) && /fbShowNotice\('newer'\)/.test(f), '여러 번 실패해야 띠');
  assert.ok(/KcareerNotices\.mergeLs\(here, v\.ls, \{ skip:FB_SKIP/.test(f), '안 오가는 열쇠는 넘긴다');
  const push = strip(떼기('function _fbDoPush('));
  assert.ok(/setTimeout\(fbNewerSync/.test(push), '다른 기기가 먼저 올렸으면 띠가 아니라 합치기로');
  assert.ok(!/fbShowNotice\('newer'\)/.test(push), 'push 실패가 곧바로 띠로 가지 않는다');
});
