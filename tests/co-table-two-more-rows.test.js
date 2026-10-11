/* 업체관리 표 — «한 화면 안에서» 최대로 (대표 지시 2026-10-11)
   「디자인은 그대로하고 아래 사업장정보가 2개정도 더 보이게」 → 두 줄을 그냥 늘렸더니 쪽 번호가 화면 밖으로 밀렸다 →
   「한화면안에서 쪽 번호가 나오게」. 그래서 빈 자리(안내 줄·여백)를 걷고 표 높이를 «실제 바닥 여백까지» 빼서 잰다.
   규칙: ① 업체관리는 exact 로 잰다 ② exact 는 아래 줄 높이·여백과 .page·.main 의 바닥 안쪽 여백을 모두 뺀다
   ③ 안내 두 줄은 쪽 번호와 같은 줄에 있다 ④ exact 를 안 주는 다른 화면은 예전 셈 그대로. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function cutFn(h) { const i = src.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); }

function sandbox(innerHeight, pads) {
  const ctx = { Math };
  const styles = new Map();
  ctx.window = { innerHeight, getComputedStyle: (el) => styles.get(el) || { position: 'static', marginTop: '0px', marginBottom: '0px', paddingBottom: '0px' } };
  const main = {}; styles.set(main, { paddingBottom: pads.main + 'px' });
  ctx.document = { getElementById: (id) => (id === 'main-scroll-area' ? main : null) };
  const page = {}; styles.set(page, { paddingBottom: pads.page + 'px' });
  const pager = { getBoundingClientRect: () => ({ height: 34 }), nextElementSibling: null };
  styles.set(pager, { position: 'static', marginTop: '0px', marginBottom: '0px' });
  const box = { getBoundingClientRect: () => ({ top: 218 }), nextElementSibling: pager, parentElement: page };
  vm.createContext(ctx);
  vm.runInContext(cutFn('function erpFillHeight('), ctx);
  return { ctx, box };
}

test('exact: 표 + 쪽 번호 줄 + 바닥 여백이 창 높이 안에 꼭 들어간다', () => {
  const { ctx, box } = sandbox(920, { page: 4, main: 0 });
  const h = ctx.erpFillHeight(box, null, true);
  assert.ok(218 + h + 34 + 4 <= 920, '쪽 번호가 화면 밖으로 밀린다');
  assert.ok(920 - (218 + h + 34 + 4) <= 4, '아래에 빈 자리가 너무 남는다');
});

test('exact: 바닥 안쪽 여백이 크면 그만큼 표가 줄어든다(쪽 번호는 늘 화면 안)', () => {
  const a = sandbox(920, { page: 4, main: 0 }); const b = sandbox(920, { page: 14, main: 24 });
  assert.equal(a.ctx.erpFillHeight(a.box, null, true) - b.ctx.erpFillHeight(b.box, null, true), 34);
});

test('업체관리는 exact 로 재고, 안내 두 줄은 쪽 번호와 같은 줄에 둔다', () => {
  const cm = cutFn('function CompanyManagement(');
  assert.match(cm, /useFillHeight\(\s*[^,()]*,\s*[^,()]*,\s*true\s*\)/);
  const i = cm.indexOf('h(PaginationBar');
  const row = cm.slice(Math.max(0, i - 700), i + 700);
  assert.match(row, /주황 테두리/);
  assert.match(row, /셀 더블클릭/);
});

test('exact 를 안 주면 예전 셈(아래 줄 + 10px + 16px)', () => {
  const { ctx, box } = sandbox(920, { page: 14, main: 24 });
  assert.equal(ctx.erpFillHeight(box, null), 920 - 218 - (34 + 10) - 16);
});
