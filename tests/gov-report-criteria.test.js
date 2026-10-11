'use strict';
/* 컨설팅보고서 — 회차 기준 점검 (설계 2-B). 수치는 정리본 기준 초안 [노무사 확인]. 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-gov-report-criteria.js');

test('상수', () => {
  assert.deepEqual([C.WP_MIN_MINS, C.WP_MIN_PEOPLE, C.WP_FACE_PCT, C.IND_REMOTE_REPORT_MD, C.IND_REMOTE_RESEARCH_MD], [120, 3, 70, 4, 2]);
  assert.deepEqual(C.KEYS, ['workplace', 'industry']);
});

test('roundCheck(workplace) — 인정 · 미달 사유', () => {
  assert.deepEqual(C.roundCheck('workplace', { mode: 'face', mins: 120, people: 3, photo: true, sign: true }), { state: 'ok', miss: [] });
  const m = C.roundCheck('workplace', { mode: 'face', mins: 119, people: 2, photo: false, sign: false });
  assert.equal(m.state, 'miss');
  assert.deepEqual(m.miss, ['회의 2시간 미만(119분)', '참석 3명 미만(2명)', '시작·종료 사진 없음', '서명지 없음']);
  const blank = C.roundCheck('workplace', { mode: 'remote' });
  assert.equal(blank.state, 'miss');
  assert.deepEqual(blank.miss, ['회의 시간 없음', '참석 인원 없음', '시작·종료 사진 없음', '서명지 없음']);
  assert.deepEqual(C.roundCheck('workplace', null), { state: 'none', miss: [] });
  assert.deepEqual(C.roundCheck('workplace', {}), { state: 'none', miss: [] });
});

test('roundCheck(industry) — MD 와 종류가 있어야 인정', () => {
  assert.deepEqual(C.roundCheck('industry', { mode: 'face', md: 1, kind: 'visit' }), { state: 'ok', miss: [] });
  assert.deepEqual(C.roundCheck('industry', { mode: 'remote', kind: 'report' }).miss, ['MD 없음']);
  assert.deepEqual(C.roundCheck('industry', { mode: 'remote', md: 1 }).miss, ['종류 없음']);
  assert.equal(C.roundCheck('other', { mode: 'face' }).state, 'none', '점검 기준이 없는 사업');
  assert.equal(C.roundCheck('__proto__', { mode: 'face' }).state, 'none');
});

test('summary(workplace) — 대면 비율 70% 경계 · 인정 회차 · 계획 대비', () => {
  const ok = { mode: 'face', mins: 130, people: 4, photo: true, sign: true };
  const list7 = [].concat(Array(7).fill(ok), Array(3).fill({ mode: 'remote', mins: 130, people: 4, photo: true, sign: true }));
  const s = C.summary('workplace', list7, 12);
  assert.deepEqual([s.recorded, s.qualified, s.face, s.remote, s.facePct, s.faceOk, s.planned], [10, 10, 7, 3, 70, true, 12]);
  const f69 = [].concat(Array(69).fill(ok), Array(31).fill({ mode: 'remote' }));
  const s69 = C.summary('workplace', f69, 0);
  assert.equal(s69.facePct, 69);
  assert.equal(s69.faceOk, false);
  assert.equal(s69.qualified, 69);
  assert.deepEqual(C.summary('workplace', [], 5), { key: 'workplace', recorded: 0, qualified: 0, face: 0, remote: 0, facePct: null, faceOk: null, planned: 5 });
  assert.equal(C.summary('other', [ok], 1), null);
});

test('summary(industry) — MD 합계 · 비대면 보고서·자료조사 한도', () => {
  const l = [
    { mode: 'face', md: 1, kind: 'visit' }, { mode: 'remote', md: 2, kind: 'report' }, { mode: 'remote', md: 2.5, kind: 'report' },
    { mode: 'remote', md: 2, kind: 'research' }, { mode: 'remote', md: 0.5, kind: 'research' },
  ];
  const s = C.summary('industry', l, 15);
  assert.deepEqual([s.recorded, s.md, s.remoteReportMd, s.remoteResearchMd, s.reportOk, s.researchOk, s.planned], [5, 8, 4.5, 2.5, false, false, 15]);
  const s2 = C.summary('industry', [{ mode: 'remote', md: 4, kind: 'report' }, { mode: 'remote', md: 2, kind: 'research' }], 0);
  assert.deepEqual([s2.reportOk, s2.researchOk], [true, true], '4MD·2MD 는 한도 안');
  assert.deepEqual(C.summary('industry', [], 0), { key: 'industry', recorded: 0, md: 0, remoteReportMd: 0, remoteResearchMd: 0, reportOk: true, researchOk: true, planned: 0 });
});
