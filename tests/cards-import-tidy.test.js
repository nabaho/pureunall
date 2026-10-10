/* ══════ 📥 가져오기 전 다듬기 (대표 지시 2026-10-09 「고쳐라」) ══════
   다음 주소록을 가져오자 이름에 회사가 붙은 명함 70장 · 이미 있던 사람 10장 · 두 사람이 섞인 5장이 생겼다.
   ★ 못 박는 것
     ㉠ 「회사_이름」 · 「동원정윤성인」 · 「EVOLVE soft전석정」 — 회사 칸이 비거나 같은 회사면 가른다
     ㉡ 이름 앞 회사가 회사 칸과 «다르면» 가르지 않고 메모에 [가져오기 확인] — 기계가 고르지 않는다
     ㉢ 번호 꼬리표(「3호_소망상사」)·직함(「서독안경원_사무실」)·「/」(두 회사)는 안 가른다
     ㉣ 이미 있는 사람은 회사의 (주)·㈜·띄어쓰기를 걷고 견준다 — 「TTT_김원미」가 「김원미 · TTT」를 찾는다
     ㉤ 가져오기는 실제로 다듬은 줄을 쓴다(파일을 읽은 자리에서 부른다)
   ⚠ 예시는 가짜다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const line = (re) => { const m = SRC.match(re); assert.ok(m, re); return m[0]; };
function box(items) {
  /* ErpMatch._norm 은 파일에서 그대로 떠 온다 — 베끼면 진짜와 어긋난다 */
  const nm = SRC.match(/\n  _norm\(s\)\{([\s\S]*?)\},\n/);
  assert.ok(nm, 'ErpMatch._norm 을 못 찾음');
  const ctx = { state: { items: items || {} }, digits: (s) => String(s || '').replace(/\D/g, '') };
  vm.createContext(ctx);
  vm.runInContext(['var ErpMatch = { _norm(s){' + nm[1] + '} };', line(/const IMP_ROLE_TAIL = [^\n]*/), line(/const IMP_FLAG = [^\n]*/),
    line(/const impCo = [^\n]*/), line(/const IMP_SUR = [^\n]*/), line(/const IMP_TITLE = [^\n]*/), sliceFn(SRC, 'function impPerson('),
    sliceFn(SRC, 'function importTidyRow('), sliceFn(SRC, 'function importKeys('),
    sliceFn(SRC, 'function rowKeys('), sliceFn(SRC, 'function buildKeyMap('), line(/const matchExisting=[^\n]*/)].join('\n'), ctx);
  return ctx;
}
const tidy = (c, r) => JSON.parse(JSON.stringify(vm.runInContext('importTidyRow(' + JSON.stringify(r) + ')', c)));

test('★★★ 회사가 붙은 이름을 가른다 — 회사 칸이 비거나 같은 회사일 때', () => {
  const c = box();
  assert.deepEqual(tidy(c, { name: 'TTT_김원미', company: '' }), { name: '김원미', company: 'TTT' });
  assert.deepEqual(tidy(c, { name: '노무법인 화원_김선애', company: '노무법인 화원' }), { name: '김선애', company: '노무법인 화원' });
  assert.deepEqual(tidy(c, { name: '동원정홍길동', company: '㈜동원정' }), { name: '홍길동', company: '㈜동원정' });
  assert.deepEqual(tidy(c, { name: 'EVOLVE soft홍길동', company: '' }), { name: '홍길동', company: 'EVOLVE soft' });
});

test('★★★ 이름 앞 회사가 회사 칸과 다르면 «가르지 않고» 메모에 확인을 단다', () => {
  const c = box();
  const r = tidy(c, { name: 'EVOLVE soft홍길동', company: '가나상사', memo: '다음 주소록 그룹: 리멤버' });
  assert.equal(r.name, 'EVOLVE soft홍길동');
  assert.equal(r.company, '가나상사');
  assert.match(r.memo, /^다음 주소록 그룹: 리멤버\n\[가져오기 확인\]/);
  assert.match(tidy(c, { name: '다라물류_김철수', company: '가나상사' }).memo, /\[가져오기 확인\]/);
});

/* ⚠ 2026-10-10 「3호_소망상사」 를 이 목록에서 뺐다 — 대표 「추천대로」로 번호 꼬리표는 이제 회사 칸으로 옮긴다(아래 검사). */
test('★★ 직함·「/」·두 겹 꼬리표는 안 가른다', () => {
  const c = box();
  [{ name: '서독안경원_사무실', company: '' }, { name: '가나상사/다라물류', company: '' },
    { name: 'CTS_홍이사_급여담당', company: '' }, { name: '홍길동', company: '가나상사' }]
    .forEach((r) => assert.deepEqual(tidy(c, r), r, JSON.stringify(r)));
});

test('★★★ 이미 있는 사람은 회사의 (주)·띄어쓰기를 걷고 찾는다 — 다듬은 뒤의 줄로', () => {
  const c = box({ a: { id: 'a', kind: 'card', name: '김원미', company: '(주) 가나 상사' } });
  vm.runInContext('var M = buildKeyMap()', c);
  const r = tidy(c, { name: '가나상사_김원미', company: '', email: 'new@ganasangsa.example' });
  assert.equal(vm.runInContext('matchExisting(' + JSON.stringify(r) + ', M)', c), 'a');
  assert.equal(vm.runInContext('matchExisting(' + JSON.stringify({ name: '김원미', company: '다라물류' }) + ', M)', c), null, '다른 회사 같은 이름은 다른 사람');
});

test('★ 파일을 읽은 자리에서 다듬고, 미리보기·가져오기가 같은 열쇠를 쓴다 · 중복 정리 열쇠(rowKeys)는 그대로', () => {
  assert.match(sliceFn(SRC, 'async function onImportFile('), /\.map\(importTidyRow\)/);
  assert.match(sliceFn(SRC, 'function previewImport('), /importKeys\(r\)/);
  assert.match(sliceFn(SRC, 'async function runImport('), /importKeys\(r\)/);
  assert.ok(!/impCo/.test(sliceFn(SRC, 'function rowKeys(')), '중복 정리의 잣대까지 바뀌었다');
});

/* ══════ 2026-10-10 「추천대로」 — 「-」·거꾸로·직함·번호 꼬리표 (명함 622장을 손으로 정리한 뒤, 다음부터 안 생기게) ══════ */
test('★★★ 「회사-사람직함」 · 「사람-회사」 를 가르고 직함은 직함 칸으로', () => {
  const c = box();
  assert.deepEqual(tidy(c, { name: '가나상사-홍길동차장', company: '' }), { name: '홍길동', company: '가나상사', title: '차장' });
  assert.deepEqual(tidy(c, { name: '다라물류_김철수주무관', company: '' }), { name: '김철수', company: '다라물류', title: '주무관' });
  assert.deepEqual(tidy(c, { name: '홍길동-가나시청', company: '' }), { name: '홍길동', company: '가나시청' });
  assert.deepEqual(tidy(c, { name: '김철수노무사', company: '' }), { name: '김철수', company: '', title: '노무사' });
  /* 직함 칸에 이미 값이 있으면 안 덮는다 */
  assert.deepEqual(tidy(c, { name: '가나상사-홍길동차장', company: '', title: '팀장' }), { name: '홍길동', company: '가나상사', title: '팀장' });
});

test('★★★ 「-」 는 사람 이름 모양일 때만 — 회사 이름 안의 「-」 나 애매한 것은 그대로', () => {
  const c = box();
  [{ name: '가나-다라테크', company: '' },          // 양쪽 다 사람 아님
    { name: '홍길동-김철수', company: '' },          // 양쪽 다 사람 — 기계가 고르지 않는다
    { name: '가나외과-인사노무', company: '' },      // 사람 이름 없음
    { name: '홍길동-사무실', company: '' }]          // 자리 이름
    .forEach(r => assert.deepEqual(tidy(c, r), r, JSON.stringify(r)));
  /* 회사 칸이 «다른» 회사면 가르지 않고 확인을 단다 — 「_」 와 같은 규칙 */
  assert.match(tidy(c, { name: '다라물류-홍길동', company: '가나상사' }).memo, /\[가져오기 확인\]/);
});

test('★★ 「2호_회사」 는 회사 칸으로, 꼬리표는 메모 맨 앞에 — 회사 칸이 빌 때만', () => {
  const c = box();
  assert.deepEqual(tidy(c, { name: '3호_가나상사', company: '', memo: '다음 주소록 그룹: 지인' }),
    { name: '', company: '가나상사', memo: '3호\n다음 주소록 그룹: 지인' });
  const keep = { name: '3호_가나상사', company: '다라물류' };
  assert.deepEqual(tidy(c, keep), keep, '회사 칸이 있으면 손대지 않는다');
});
