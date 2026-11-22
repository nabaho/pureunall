/* 재심사청구 설명 (대표 지시 2026-09-30 「재심사 넣어라」)
   시드는 목록이 비었을 때만 쓰인다 — 시드만 고치면 이미 저장된 대표 화면엔 안 닿는다.
   그래서 caseStageFillSeedNotes 가 «빈 칸만, 한 번만» 옮긴다. 그것을 실제 코드로 돌려 본다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function slice(a, b) { const i = src.indexOf(a); assert.ok(i >= 0, a); const j = src.indexOf(b, i); assert.ok(j > i, b); return src.slice(i, j); }

function box(stored) {
  const store = { biz_case_stages: stored };
  let writes = 0;
  const c = { console, Object, Array, String, JSON, Math,
    window: {}, dbGet: (k, d) => (k in store ? store[k] : d), dbSet: (k, v) => { store[k] = v; writes++; } };
  vm.createContext(c);
  vm.runInContext(slice('var BIZ_CASE_STAGE_KEY', 'var BIZ_CASE_STAGE_SEED = ['), c);
  vm.runInContext(slice('var BIZ_CASE_STAGE_SEED = [', '// 기관 종류별 색'), c);
  vm.runInContext(slice('var CASE_STAGE_SEED_NOTE_V', '// 이 사건유형에서 고를 수 있는 단계'), c);
  return { c, store, writes: () => writes };
}
const note = (arr, code) => (arr.find((x) => x.code === code) || {}).dueNote;

test('시드: 재심사청구 설명이 법 조문과 함께 있다', () => {
  const { c } = box(null);
  const s = c.BIZ_CASE_STAGE_SEED.find((x) => x.code === 'wc-rereview');
  assert.match(s.dueNote, /재결서 정본을 송달받은 날부터 90일/);
  assert.match(s.dueNote, /행정소송법 제20조/);
  assert.match(s.dueNote, /산재보험법 제111조/);
  assert.equal(s.dueDays, 90);
});

test('★ 이미 저장된 목록의 «빈» 설명에 한 번 옮겨 적는다', () => {
  const { c, store, writes } = box([{ code: 'wc-rereview', name: '재심사청구', orgKind: 'wc', dueDays: 90, dueNote: '' }]);
  const out = c.getCaseStagesAll(true);
  assert.match(note(out, 'wc-rereview'), /행정소송법 제20조/);
  assert.match(note(store.biz_case_stages, 'wc-rereview'), /행정소송법 제20조/, '저장까지 돼야 다음에도 보인다');
  assert.equal(writes(), 1);
  c.getCaseStagesAll(true);
  assert.equal(writes(), 1, '★ 두 번째부터는 쓰지 않는다 — 읽을 때마다 쓰면 동기화가 끝없이 돈다');
});

test('★ 대표가 적은 설명은 덮지 않는다', () => {
  const { c } = box([{ code: 'wc-rereview', dueNote: '대표가 쓴 설명' }]);
  assert.equal(note(c.getCaseStagesAll(true), 'wc-rereview'), '대표가 쓴 설명');
});

test('★ 한 번 채운 뒤 대표가 일부러 비우면 다시 살아나지 않는다', () => {
  const { c } = box([{ code: 'wc-rereview', dueNote: '', seedNoteV: 1 }]);
  assert.equal(note(c.getCaseStagesAll(true), 'wc-rereview'), '');
});

test('시드에 없는(대표가 만든) 단계는 건드리지 않는다', () => {
  const { c, writes } = box([{ code: 'stage-abc', name: '조정', dueNote: '' }]);
  c.getCaseStagesAll(true);
  assert.equal(writes(), 0);
});

/* ── 2판(2026-11-15) — 산재 두 단계 설명을 법 원문(«결정이 있음을 안 날»)으로 (대표 「모든 단계 한번에 진행해라」) ── */
test('2판: 산재 시드 설명이 법 원문 — «안 날»·제103조③·제106조 단서', () => {
  const { c } = box(null);
  const apply = c.BIZ_CASE_STAGE_SEED.find((x) => x.code === 'wc-apply');
  const review = c.BIZ_CASE_STAGE_SEED.find((x) => x.code === 'wc-review');
  assert.match(apply.dueNote, /안 날/); assert.match(apply.dueNote, /제103조③/); assert.match(apply.dueNote, /제106조① 단서/);
  assert.match(review.dueNote, /안 날/); assert.match(review.dueNote, /제106조③/);
  assert.doesNotMatch(apply.dueNote + review.dueNote, /통보받은 날/, '법 원문은 «통보받은 날»이 아니라 «안 날»');
});

test('★ 2판: 옛 시드 글자 «그대로»인 설명만 새 글로 — 대표가 고친 글은 그대로', () => {
  const { c, store } = box([
    { code: 'wc-apply', dueNote: '결정 통보받은 날부터 90일 이내 심사청구', seedNoteV: 1 },
    { code: 'wc-review', dueNote: '심사 결정 통보받은 날부터 90일 이내 재심사청구 — 대표 덧붙임', seedNoteV: 1 }]);
  const out = c.getCaseStagesAll(true);
  assert.match(note(out, 'wc-apply'), /안 날/, '옛 시드 그대로면 새 글로');
  assert.equal(note(out, 'wc-review'), '심사 결정 통보받은 날부터 90일 이내 재심사청구 — 대표 덧붙임', '★ 대표가 고친 글을 덮었습니다');
  assert.match(note(store.biz_case_stages, 'wc-apply'), /안 날/, '저장까지 돼야 다른 PC 에도');
});
