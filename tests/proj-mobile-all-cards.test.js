'use strict';
/* 폰 업무 목록은 «전부» 보인다 (대표 지시 2026-10-22 「폰에서 사업장 20개밖에 못 본다
   모든 데이터 다 보게 해달라」)
   ─────────────────────────────────────────────────────────────────────────
   ProjectManagementShared(컨설팅·기금·기타)는 한 쪽에 20건씩 자른다(usePagination).
   쪽 넘김(PaginationBar)과 개수 고르기(PageSizeSelector)는 «PC 표 쪽»에만 있다 —
   그래서 폰은 첫 20건에서 끝나고 21번째부터는 갈 길이 없었다(전체 58건인데 20장).

   ★ 못 박는 것 — 규칙
     ① 폰 카드 목록은 잘린 쪽(.paged)이 아니라 거른 전부(filtered)를 그린다
     ② 묶음 머리(현장클리닉 · 9건)를 다는 «앞 줄» 비교도 같은 목록에서 한다
        — 다른 목록과 견주면 묶음 머리가 엉뚱한 자리에 붙는다
     ③ PC 표는 그대로 쪽을 나눈다(2천 개 요소 멈춤을 막으려고 둔 것이다) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const fn = stripJs(cutFn(src, 'function ProjectManagementShared('));

/* 폰 카드 목록 — 「m-card」 카드를 만드는 map 이 든 폰 갈래 */
function mobileList(){
  const card = fn.indexOf("className:'m-card'");
  assert.ok(card > 0, '폰 카드를 찾지 못했습니다');
  const at = fn.lastIndexOf('innerWidth <= 768', card);
  assert.ok(at > 0, '폰 갈래를 찾지 못했습니다');
  const end = fn.indexOf("_projGroupHeader(it, 'card')", card);
  assert.ok(end > card, '폰 묶음 머리를 찾지 못했습니다');
  return fn.slice(at, end);
}

test('①★★ 폰 카드는 잘린 쪽이 아니라 «전부»를 그린다', () => {
  const m = mobileList();
  assert.ok(!/\.paged\.map\(/.test(m),
    '★ 폰이 한 쪽(기본 20건)만 그립니다 — 폰에는 쪽 넘김 단추가 없어 나머지를 못 봅니다');
  assert.match(m, /filtered\.map\(/, '폰이 거른 목록을 안 그립니다');
});

test('② 묶음 머리 비교는 그리는 목록과 같은 목록에서', () => {
  const m = mobileList();
  const cmp = m.match(/grpKeyOf\(([A-Za-z_$][\w$.]*)\[idx-1\]/);
  assert.ok(cmp, '묶음 머리 비교를 찾지 못했습니다');
  const drawn = m.match(/:\s*([A-Za-z_$][\w$.]*)\.map\(function\(it, idx\)/);
  assert.ok(drawn, '그리는 목록을 찾지 못했습니다');
  assert.equal(cmp[1], drawn[1], '★ 그리는 목록과 다른 목록으로 앞 줄을 견줍니다 — 묶음 머리가 엉뚱하게 붙습니다');
});

test('③ PC 표는 그대로 쪽을 나눈다', () => {
  assert.match(fn, /usePagination\(filtered,/, 'PC 쪽 나누기가 사라졌습니다');
  assert.match(fn, /h\(PaginationBar,/, 'PC 쪽 넘김 단추가 사라졌습니다');
});
