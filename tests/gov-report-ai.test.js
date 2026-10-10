'use strict';
/* 정부컨설팅 보고서 3단계 — AI 초안 모듈 (2026-10-10)
 * ★ 지키는 것: 양식이 쓰는 칸만 · 밖으로 나가는 글은 가린다 · 사람이 쓴 칸은 덮지 않는다 · 지어낸 숫자는 경고
 * 공개 저장소다 — 합성 자료만(가나상사·홍길동·김가나·041-000-0000·example.com). */
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/pu-gov-report-ai.js');
const R = require('../js/pu-gov-report.js');

const RK = ['inquiry', 'diagnosis', 'advice', 'result', 'next'];
const SK = ['inquiryDiag', 'review', 'action', 'etc', 'adviceAll', 'overall'];

test('fieldsFor — 양식(파일)이 쓰는 칸만', () => {
  assert.deepEqual(A.fieldsFor('cci-north'), { rounds: RK, summary: ['inquiryDiag', 'review', 'action', 'etc'] });
  assert.deepEqual(A.fieldsFor('cci-seosan', ['visit']), { rounds: ['inquiry', 'diagnosis', 'advice'], summary: [] });
  assert.deepEqual(A.fieldsFor('cci-seosan', ['report']), { rounds: [], summary: ['inquiryDiag', 'adviceAll'] });
  assert.deepEqual(A.fieldsFor('cci-seosan'), { rounds: ['inquiry', 'diagnosis', 'advice'], summary: ['inquiryDiag', 'adviceAll'] });
  assert.deepEqual(A.fieldsFor('techguard'), { rounds: ['diagnosis', 'advice', 'result', 'next'], summary: ['adviceAll', 'overall'] });
  assert.deepEqual(A.fieldsFor('모르는양식'), { rounds: [], summary: [] });
});

test('fieldsFor — pu-gov-report buildValues 가 실제로 쓰는 칸과 같다(지도 대조)', () => {
  for (const fk of Object.keys(R.FORMS)) {
    const report = { company: {}, rounds: [{ date: '2025-09-04' }], summary: {} };
    RK.forEach((k) => { report.rounds[0][k] = 'R_' + k; });
    SK.forEach((k) => { report.summary[k] = 'S_' + k; });
    const out = JSON.stringify(R.buildValues(report, fk));
    const f = A.fieldsFor(fk);
    RK.forEach((k) => assert.equal(out.includes('R_' + k), f.rounds.includes(k), fk + ' 회차 ' + k));
    SK.forEach((k) => assert.equal(out.includes('S_' + k), f.summary.includes(k), fk + ' 종합 ' + k));
  }
});

test('mask — 개인정보 꼴은 [가림], 이름은 자리 표시로, unmask 는 이름만 되돌린다', () => {
  const names = [{ v: '(주)가나상사', as: '[해당 기업]' }, { v: '김가나', as: '[대표자]' }, { v: '홍길동', as: '[담당자]' }];
  const raw = '가나상사 홍길동 대리(041-000-0000, 010-0000-0000, 02-000-0000, 1588-0000, hong@example.com)'
    + ' · 사업자 123-45-67890 · 주민 900101-1234567 · 계좌 123-456789-01-234 · 김가나 대표 · 2025-09-04 3회 · 12명';
  const m = A.mask(raw, names);
  for (const bad of ['가나상사', '홍길동', '김가나', '041-000-0000', '010-0000-0000', '02-000-0000', '1588-0000',
    'hong@example.com', '123-45-67890', '900101-1234567', '123-456789-01-234']) {
    assert.ok(!m.text.includes(bad), bad + ' 이(가) 남았다: ' + m.text);
  }
  assert.match(m.text, /\[해당 기업\] \[담당자\] 대리/);
  assert.ok(m.text.includes('2025-09-04 3회 · 12명'), '날짜·작은 숫자는 남긴다');
  assert.deepEqual(m.back, [{ as: '[해당 기업]', v: '(주)가나상사' }, { as: '[대표자]', v: '김가나' }, { as: '[담당자]', v: '홍길동' }]);
  assert.equal(A.unmask('[해당 기업] [대표자] [담당자] [가림]', m.back), '(주)가나상사 김가나 홍길동 [가림]');
});

test('mask — 빈 이름·한 글자 이름은 건너뛴다(엉뚱한 글자를 지우지 않는다)', () => {
  const m = A.mask('가 나 다 홍길동', [{ v: '', as: '[담당자]' }, { v: '가', as: '[대표자]' }, { v: '홍길동', as: '[담당자]' }]);
  assert.equal(m.text, '가 나 다 [담당자]');
  assert.deepEqual(m.back, [{ as: '[담당자]', v: '홍길동' }]);
});
