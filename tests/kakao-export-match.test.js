/* 카톡 진행 기록 정리 — 업무 맞추기 (2026-10-24, 2026-10-26 main 위로 다시 얹으며 파일·쌍둥이는 걷어냄)
   설계서: docs/superpowers/specs/2026-10-24-카톡-법인방-업무정리-design.md (4장)
   ⚠ 예시 이름·사건번호는 모두 가짜다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const X = require('../js/pu-kakao-export.js');

const grp = (caseNos, companyKeys) => ({ day: '2026-10-23', caseNos: caseNos || [], companyKeys: companyKeys || [], msgs: [], files: [], media: 0,
  anchor: (caseNos && caseNos.length) ? 'case' : (companyKeys && companyKeys.length) ? 'company' : 'none' });
const item = (id, no, key, open, stageNos) => ({ id, no, company: key, key, stageNos: stageNos || [], open: open !== false });

test('사건번호가 업무관리 번호와 «글자 그대로» 같으면 확실(띄어쓰기·하이픈은 무시)', () => {
  const [m] = X.matchGroups([grp(['경기2026부해9001'])], [item('i1', '경기 2026-부해9001', 'c1'), item('i2', '경기2026부해9002', 'c1')]);
  assert.deepStrictEqual({ b: m.basis, id: m.itemId, c: m.candidates }, { b: 'sure', id: 'i1', c: ['i1'] });
});

test('심급 사건번호(stageNos)가 같아도 확실', () => {
  const [m] = X.matchGroups([grp(['경기2026부해9001'])], [item('i1', '부해-2026-003', 'c1', true, ['경기2026부해9001'])]);
  assert.strictEqual(m.basis, 'sure');
  assert.strictEqual(m.itemId, 'i1');
});

test('같은 번호가 업무 둘에 있으면 자동으로 정하지 않는다 — 후보만', () => {
  const [m] = X.matchGroups([grp(['경기2026부해9001'])], [item('i1', '경기2026부해9001', 'c1'), item('i2', '경기2026부해9001', 'c2')]);
  assert.strictEqual(m.basis, 'guess');
  assert.strictEqual(m.itemId, '', '같은 번호가 둘인데 하나를 골라 버렸다');
  assert.deepStrictEqual(m.candidates.slice().sort(), ['i1', 'i2']);
});

test('업무관리에 없는 번호는 «없는 번호», 종결된 업무도 번호가 같으면 확실(후속 대화도 기록돼야 한다)', () => {
  const [a] = X.matchGroups([grp(['경기2026부노9100'])], [item('i1', '경기2026부해9001', 'c1')]);
  assert.deepStrictEqual({ b: a.basis, no: a.caseNo, id: a.itemId }, { b: 'newno', no: '경기2026부노9100', id: '' });
  const [b] = X.matchGroups([grp(['경기2026부해9001'])], [item('i1', '경기2026부해9001', 'c1', false)]);
  assert.strictEqual(b.basis, 'sure');
});

test('업체명만 있으면 짐작 — 진행 업무가 하나뿐이면 미리 고르되 그래도 짐작, 여럿이면 비워 둔다, 종결 업무는 후보가 아니다', () => {
  const one = X.matchGroups([grp([], ['c1'])], [item('i1', 'a', 'c1'), item('i9', 'b', 'c1', false), item('i2', 'c', 'c2')])[0];
  assert.deepStrictEqual({ b: one.basis, id: one.itemId, c: one.candidates }, { b: 'guess', id: 'i1', c: ['i1'] });
  const many = X.matchGroups([grp([], ['c1'])], [item('i1', 'a', 'c1'), item('i3', 'd', 'c1')])[0];
  assert.strictEqual(many.basis, 'guess');
  assert.strictEqual(many.itemId, '');
  assert.strictEqual(many.candidates.length, 2);
});

test('근거가 없으면 «없음»이고, 같은 길이로 하나씩 돌려준다', () => {
  const r = X.matchGroups([grp([], []), grp(['경기2026부해9001'])], [item('i1', '경기2026부해9001', 'c1')]);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].basis, 'none');
  assert.strictEqual(r[0].itemId, '');
  assert.strictEqual(r[1].basis, 'sure');
});
