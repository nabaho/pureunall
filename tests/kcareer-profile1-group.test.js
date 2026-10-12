/* 프로필 1장 — 컨설팅 실적은 «사업별»로 묶고 「외 N건」 줄은 그리지 않는다 (대표 지시 2026-10-12)
   모델(more·show)은 그대로 — 건수는 칸 제목 옆 «(최근 N · 전체 M)» 이 말한다. */
const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/kcareer-profile1.js');

function src(n) {
  const consult = [];
  for (let i = 0; i < n; i++) consult.push({ id: 'c' + i, year: i % 2 ? '2026' : '2025', date: (i % 2 ? '2026' : '2025') + '.0' + (1 + (i % 9)) + '.01', type: i % 3 ? '일터혁신컨설팅' : '산업일자리전환컨설팅', org: '회사' + i, project: '' });
  const wiccok = [];
  for (let i = 0; i < 30; i++) wiccok.push({ id: 'w' + i, org: '기관' + i, titleVal: '위원', issueDate: '2026.01.' + String(1 + (i % 28)).padStart(2, '0') });
  return { fields: { name: '홍길동' }, consult, wiccok, edu: [], cert: [], work: [], lecture: [] };
}

test('① 컨설팅 실적은 같은 사업끼리 한 줄로 묶는다', () => {
  const m = P.build(src(10), { use: 'consultant', on: { perf: true } });
  const html = P.toHtml(m, '');
  const perf = m.sections.find((x) => x.key === 'perf');
  const rows = P.perfByBiz(perf.rows);
  assert.ok(rows.length >= 1 && rows.length < perf.rows.length, '사업 줄 수가 실적 줄 수보다 적다');
  const sum = rows.reduce((a, r) => a + Number(/\((\d+)건\)/.exec(r[1])[1]), 0);
  assert.equal(sum, perf.rows.length, '묶어도 건수 합은 그대로');
  assert.ok(/일터혁신컨설팅 \(\d+건\)/.test(html), '사업명 옆에 건수');
});

test('② 「외 N건」 줄은 그리지 않는다 — 제목 옆 (최근 N · 전체 M) 은 남는다', () => {
  const m = P.build(src(10), { use: 'general', on: { perf: true } });
  assert.ok(m.sections.some((x) => x.more > 0), '줄인 칸이 있어야 시험이 된다');
  const html = P.toHtml(m, '');
  assert.ok(!/외\s*\d+건/.test(html), '외 N건 줄 없음');
  assert.ok(/전체\s*\d+/.test(html), '전체 건수는 제목 옆에');
});

test('③ 사업 묶음은 없는 값을 지어내지 않는다', () => {
  const rows = P.perfByBiz([['', '', ''], ['2026', '', '(주)가']]);
  assert.equal(rows.length, 1);
  assert.ok(/기타 \(2건\)/.test(rows[0][1]));
  assert.equal(rows[0][2], '(주)가');
});
