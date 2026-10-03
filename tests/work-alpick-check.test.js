'use strict';
// 🔗 고를 것 — □·# 와 「고른 것 업무 아님」 — node --test tests/work-alpick-check.test.js
//
// 대표 지시 2026-10-03 「ㅁ 와 넘버링 항상 해라」 (목록에는 늘 맨 앞에 □ 체크칸과 # 번호, 한꺼번에 단추).
// 「고를 것」은 한 주에 스무 건이 넘게 쌓였다(실측 2026-W38 22건).
//
// 이 검사가 지키는 것
//   ①  줄마다 □ 와 # 가 있다 · 「모두」 와 「고른 것 업무 아님」 이 있다
//   ②★ 한꺼번에 적는다 — 고른 것만, 그리고 그사이 남이 정한 줄은 덮지 않는다
//   ③  아무것도 안 골랐으면 아무것도 안 적는다
//   ④  □ 를 눌러도 목록을 다시 그리지 않는다(긴 목록에서 맨 위로 튀지 않게)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}

function box(alBox) {
  const writes = [];
  const b = {
    console, String, Object, Array, Promise, JSON, writes, toasts: [], redraw: 0, closed: 0, routed: 0,
    NS: 'work_erp', S: { me: { sid: 'S1', name: '박한별' } },
    items: { I1: { company: '가나', mgr_main: { sid: 'S1', name: '박한별' } }, I2: { company: '가나', mgr_main: { sid: 'S2' } } },
    alBox: JSON.parse(JSON.stringify(alBox)),
    fbDb: { ref: () => ({ update: (up) => { writes.push(up); return Promise.resolve(); } }) },
    $: () => null
  };
  vm.createContext(b);
  vm.runInContext(
    'var alSel={};\n'
    + 'function toast(t){ toasts.push(t); }\nfunction route(){ routed++; }\nfunction closeM(){ closed++; }\n'
    + 'function alPickModal(){ redraw++; }\n'
    + 'function _mlkWho(){ return {by:"S1",byName:"박한별",at:"2026-10-03T00:00:00Z"}; }\n'
    + ['isOf', 'isMine', 'alAmbList', 'alSelKey', 'alSelOne', 'alSelAll', 'alNoneSel'].map(grab).join('\n'), b);
  return b;
}
const AMB = { amb: { I1: 1, I2: 1 }, d: '2026-09-15', t: '✉ 메일', sourceKind: 'mail', sourceId: 'x' };
const flush = () => new Promise((r) => setTimeout(r, 0));

test('① 줄마다 □ 와 # · 「모두」 · 「고른 것 업무 아님」', () => {
  const m = grab('alPickModal');
  assert.match(m, /type="checkbox" class="alck"/, '줄에 □ 가 없습니다');
  assert.match(m, /class="aln">'\+\(i\+1\)/, '줄에 # 번호가 없습니다');
  assert.match(m, /onchange="alSelAll\(this\.checked\)"/, '「모두」가 없습니다');
  assert.match(m, /onclick="alNoneSel\(\)"/, '한꺼번에 단추가 없습니다');
});

test('★ 고른 것만 한 번에 「업무 아님」 — 그사이 남이 정한 줄은 덮지 않는다', async () => {
  const b = box({ '2026-W38': { 'a|1': AMB, 'a|2': AMB, 'a|3': AMB, 'g|9': { item: 'I1', lid: 'AL_g|9' } } });
  b.alSelOne(b.alSelKey('2026-W38', 'a|1'), true);
  b.alSelOne(b.alSelKey('2026-W38', 'a|3'), true);
  b.alSelOne(b.alSelKey('2026-W38', 'g|9'), true);   // 이미 정해진 줄 — 덮으면 안 된다
  b.alNoneSel();
  await flush();
  assert.equal(b.writes.length, 1, '한 번에 적지 않았습니다(반만 적힐 수 있습니다)');
  const ks = Object.keys(b.writes[0]).sort();
  assert.deepEqual(ks, ['work_erp/autolog/2026-W38/a|1', 'work_erp/autolog/2026-W38/a|3']);
  assert.equal(b.writes[0]['work_erp/autolog/2026-W38/a|1'].none, 1);
  assert.equal(b.alBox['2026-W38']['g|9'].item, 'I1', '정해진 줄을 「아님」으로 덮었습니다');
  assert.equal(b.alBox['2026-W38']['a|2'].amb ? 1 : 0, 1, '안 고른 줄까지 치웠습니다');
  assert.equal(Object.keys(b.alSel).length, 0, '고른 것이 남아 있습니다');
  assert.match(b.toasts.pop(), /2건 업무 아님/);
});

test('③ 아무것도 안 골랐으면 아무것도 안 적는다', () => {
  const b = box({ '2026-W38': { 'a|1': AMB } });
  b.alNoneSel();
  assert.equal(b.writes.length, 0);
  assert.match(b.toasts.pop(), /□/);
});

test('「모두」는 내 업무가 걸린 고를 것만 고른다', () => {
  const b = box({ '2026-W38': { 'a|1': AMB, 'a|2': { amb: { I2: 1, I3: 1 }, d: 'x' } } });
  b.alSelAll(true);
  assert.deepEqual(Object.keys(b.alSel), ['2026-W38~a|1'], '남의 업무만 걸린 것까지 골랐습니다');
  b.alSelAll(false);
  assert.equal(Object.keys(b.alSel).length, 0);
});

test('④ □ 를 눌러도 목록을 다시 그리지 않는다', () => {
  const b = box({ '2026-W38': { 'a|1': AMB } });
  b.alSelOne('2026-W38~a|1', true);
  assert.equal(b.redraw, 0);
});

test('열쇠 — 원천에 ~ 가 있어도 «첫 ~» 에서 주를 가른다', async () => {
  const b = box({ '2026-W38': { 'a|x~y': AMB } });
  b.alSelOne(b.alSelKey('2026-W38', 'a|x~y'), true);
  b.alNoneSel();
  await flush();
  assert.ok(b.writes[0]['work_erp/autolog/2026-W38/a|x~y']);
});
