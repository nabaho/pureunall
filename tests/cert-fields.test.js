'use strict';
/* 재직·경력증명서 보완 (2026-10-11 대표 「재직증명서나 경력증명서에 있어야할 내용들 더 있으면 체크해라」 → 시안 → 「시안대로」)
   발급번호·회사정보(대표자·사업자번호·주소)·소속·담당업무·근속기간·용도/제출처를 넣고,
   주소·퇴직사유는 근로자가 요구한 경우만(근로기준법 제39조②) 넣는다.
   실행: node --test tests/cert-fields.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const SRC = stripJs(RAW);

test('근속기간 셈 — 입사일부터 기준일까지 «n년 n개월» (일이 못 찬 달은 빼고)', () => {
  const m = RAW.match(/function tenureText\(a, b\)\{[\s\S]*?\n    \}/);
  assert.ok(m, 'tenureText 를 못 찾았습니다');
  const f = new Function(m[0] + '; return tenureText;')();
  assert.equal(f('2023-11-20', '2026-10-11'), '2년 10개월');
  assert.equal(f('2026-03-16', '2026-10-14'), '6개월');
  assert.equal(f('2026-03-16', '2026-10-15'), '7개월', '첫날·마지막날을 모두 센다 — 03-16~10-15 는 꽉 찬 7개월');
  assert.equal(f('', '2026-10-11'), '');
});

test('종이에 발급번호가 찍히고, 발급대장과 같은 셈(nextCertNo)을 쓴다', () => {
  assert.match(SRC, /'제 ' \+ nextCertNo\(\) \+ ' 호'/);
  assert.match(SRC, /certNo: nextCertNo\(\),/);
});

test('회사 대표자·사업자등록번호·주소가 문서에 · 소속·담당업무(재직증명서)·용도/제출처 칸', () => {
  assert.match(SRC, /'사업자등록번호  ' \+ \(company\.bizNum \|\| company\.bizNo\)/);
  assert.match(SRC, /'대표노무사  ' \+ company\.ceo/);
  assert.match(SRC, /label:'소속', value: u\.branch/);
  assert.match(SRC, /if\(kind === 'employment'\)\{\s*bodyRows\.push\(\{ label:'담당업무'/);
  assert.match(SRC, /label:'용도 \/ 제출처'/);
});

test('주소·퇴직사유는 «요청 시만» — 기본 끔 (근로기준법 제39조②)', () => {
  assert.match(SRC, /var iaS = useState\(false\); var incAddr/);
  assert.match(SRC, /var irS = useState\(false\); var incReason/);
  assert.match(SRC, /incAddr && h\('div'/);
  assert.match(SRC, /if\(incReason && u\.retireDate && u\.leaveReason\)/);
});
