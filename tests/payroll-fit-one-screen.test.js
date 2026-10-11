'use strict';
/* 급여대장 한 화면 (2026-10-11 대표 「창 늘어나지 않고 한번에 볼수 있게」 → 시안 → 「시안대로」)
   ① 이름 옆 휴직·퇴직은 한 글자 동그라미(전문은 title) ② 그달 모두 0원인 칸은 접는다(기본급은 늘)
   ③ 공제는 기본 «공제계» 한 칸 ④ 이름 칸은 처음부터 왼쪽 고정
   실행: node --test tests/payroll-fit-one-screen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const SRC = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));

test('① 이름 옆 글자표(🏠 육아휴직 · 📤 퇴직)가 이름 칸을 늘리지 않는다 — 한 글자 동그라미', () => {
  assert.doesNotMatch(SRC, /'📤 퇴직'\)/, '퇴직 글자표가 남았습니다');
  assert.doesNotMatch(SRC, /'🏠 '\+\(loaPolicy\?loaPolicy\.name\.slice\(0,4\):'휴직'\)/, '휴직 글자표가 남았습니다');
  assert.match(SRC, /borderRadius:'50%'[^}]*\}\s*\}, '휴'\)/);
  assert.match(SRC, /borderRadius:'50%'[^}]*\}\s*\}, '퇴'\)/);
});

test('② 그달 모두 0원인 칸은 접고(기본급은 늘), 머리줄과 칸이 같은 목록(colShow)을 쓴다', () => {
  assert.match(SRC, /function _payColHas\(cs\)\{\s*if\(cs\.key === 'base'\) return true;/);
  assert.match(SRC, /var colShow = hideZeroCols \? colSpec\.filter\(_payColHas\) : colSpec;/);
  const heads = (SRC.match(/colShow\.map\(function\(c\)\{/g) || []).length;
  assert.ok(heads >= 2, '머리줄·칸 둘 다 colShow 여야 칸이 어긋나지 않습니다');
  assert.doesNotMatch(SRC, /return colSpec\.map\(function\(c\)\{\s*if\(c\.type === 'mapped'\)/, '칸이 아직 colSpec 을 씁니다(머리줄과 어긋남)');
  assert.match(SRC, /'빈 칸 ' \+ colZero\.length \+ '개 숨김/);
});

test('③ 공제는 기본 접힘 · ④ 이름 칸 기본 고정', () => {
  assert.match(SRC, /var sc = useState\(false\); var showDeduct = sc\[0\];/);
  assert.match(SRC, /getItem\('pureun_v6_payroll_freeze_col'\) \|\| 'name'/);
});

test('글자 크기 — 머리 12px 이상 · 숫자 13px 이상 (대표 「급여관리도 글자 더크게」 2026-10-11)', () => {
  const th = SRC.match(/var thStyle = \{[^}]*fontSize:'([\d.]+)px'/);
  const td = SRC.match(/var tdNum = \{[^}]*fontSize:'([\d.]+)px'/);
  assert.ok(th && td, '급여대장 thStyle/tdNum 을 못 찾았습니다');
  assert.ok(parseFloat(th[1]) >= 12, '머리 글자가 작습니다: ' + th[1]);
  assert.ok(parseFloat(td[1]) >= 13, '숫자 글자가 작습니다: ' + td[1]);
});
