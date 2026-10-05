'use strict';
/* 📥 새 지원 건 — «올해 폴더만» (2026-10-05 대표 폴더 실측)
   제출서류가 비어 있으면 7번 폴더의 지난 10년 건 236개가 전부 «새 지원»이 되어
   띠에는 「외 233건」으로 묻히고, 「등록」 한 번에 236건이 들어갔다. 새로 만든 건은 늘 올해 폴더에 있다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../js/kcareer-cases.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const 건 = (y, n) => ({ yearDir: y, name: n });
const 폴더 = [건('2015년', '2015 가나시청 위원'), 건('2024년', '2024 다라공단 강사'), 건('2025년', '2025 마바재단 위원'),
  건('2026년', '2026 가나상사 고문노무사'), 건('2027년', '2027 사아공사 자문')];

test('sinceYear — 그 해 이후 폴더만 · 최근 해 먼저', () => {
  assert.deepEqual(C.freshCases(폴더, [], [], { sinceYear: 2026 }).map((x) => x.yearDir), ['2027년', '2026년']);
  assert.equal(C.freshCases(폴더, [], []).length, 5, '안 주면 예전처럼 모두');
  assert.equal(C.freshCases(폴더, [], [])[0].yearDir, '2027년', '띠에는 이름 셋만 보인다 — 새 해가 앞에 와야 한다');
});

test('★ 같은 해 안에서는 «최근에 손댄 건 먼저» — 방금 만든 건이 띠의 이름 셋에 들어야 한다', () => {
  const f = (t) => [{ mtime: t }];
  const 줄 = C.newestFirst([
    Object.assign(건('2026년', '2026 가'), { files: f('2026-04-01T00:00:00Z') }),
    Object.assign(건('2026년', '2026 나'), { files: f('2026-10-05T01:00:00Z') }),
    Object.assign(건('2027년', '2027 다'), { files: f('2026-01-01T00:00:00Z') }),
    Object.assign(건('2026년', '2026 라'), { files: [] })]);
  assert.deepEqual(줄.map((x) => x.name), ['2027 다', '2026 나', '2026 가', '2026 라']);
  assert.match(떼기('async function caseCheck('), /KcareerCases\.newestFirst\(fresh\)/, '화면이 줄 세우기를 써야 합니다');
});

/* 진짜 caseCheck 를 고정 시계로 돌린다 */
async function 찾기(지금, ask) {
  const 본 = {};
  const 고정 = new Date(지금);
  class 시계 extends Date { constructor(...a) { if (a.length) super(...a); else super(고정.getTime()); } static now() { return 고정.getTime(); } }
  const ctx = { Date: 시계, console, JSON, KcareerCases: C,
    fsSupported: () => true, fsRoot: async () => ({}), _caseRootQuiet: async () => ({}),
    fsCaseDirs: async () => 폴더.map((d) => Object.assign({ handle: {} }, d)),
    get: () => [], _caseDismissed: () => [], fsCaseFiles: async () => [], toast() {},
    caseBannerDraw() { 본.fresh = ctx._caseFound.fresh.map((x) => x.yearDir); }, _caseFound: null };
  vm.createContext(ctx);
  vm.runInContext('var _caseFound={fresh:[],changed:[]};' + 떼기('async function caseCheck('), ctx);
  await vm.runInContext('caseCheck(' + (ask ? '{ask:true}' : '') + ')', ctx);
  return 본.fresh;
}

test('★★ 앱을 열 때·단추로 찾을 때 모두 올해부터 — 옛 해 236건이 «새 지원»이 되면 안 된다', async () => {
  assert.deepEqual(await 찾기('2026-10-05T09:00:00+09:00'), ['2027년', '2026년']);
  assert.deepEqual(await 찾기('2026-10-05T09:00:00+09:00', true), ['2027년', '2026년']);
});

test('★ 1~2월에는 지난해까지 — 연말에 만든 건을 놓치지 않게', async () => {
  assert.deepEqual(await 찾기('2027-01-20T09:00:00+09:00'), ['2027년', '2026년']);
  assert.deepEqual(await 찾기('2027-03-02T09:00:00+09:00'), ['2027년']);
});
