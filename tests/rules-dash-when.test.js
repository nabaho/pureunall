/* 「사업장 규정 현황」 목록의 날짜 — 연·월·일을 다 적고, «무슨 날짜인지» 말한다.
   (대표 지시 2026-09-13 「검토완료된 날짜 정리해달라. 년도 월 일 모두 포함되어야
    기록이 명확하다」 → 물으니 「갈래에 맞는 날짜 + 이름」으로 답하셨다)

   ■ 무엇이 문제였나
   ① 「07-24」처럼 **월·일만** 적혀 연도를 알 수 없었다. 취업규칙은 몇 해에 걸쳐
      개정되는 기록이라 연도가 빠지면 2024년 것과 2026년 것이 같아 보인다.
   ② ★★ 더 큰 것 — 그 날짜는 **검토완료일이 아니었다.** `dashRows` 가
      `at:(rec.savedAt)||(draft.savedAt)` 로 만들어 «마지막 저장 시각»을 적고 있었다.
      검토완료일(`doneAt`)은 따로 있고 보관함 표에는 이미 보이는데, 이 목록에는
      한 번도 안 나왔다. 연도만 붙였으면 «틀린 날짜»가 더 또렷해질 뻔했다.

   ■ 지키는 규칙
     ① 연-월-일을 다 적는다 (10글자)
     ② 갈래에 맞는 날짜를 고른다 — 신고완료는 신고일, 검토완료·개정중은 검토완료일,
        작성중·미작성은 마지막 저장일
     ③ 고른 날짜가 «무슨 날짜인지» 이름을 붙인다 — 이름이 없으면 ②가 오히려 헷갈린다
     ④ 없으면 «물러나되 이름도 함께 물러난다» — 검토완료일이 없는데 「검토」라 적으면
        그것이 거짓말이다
     ⑤ 시각(HH:MM)은 목록에 안 쓴다 — 줄이 길어져 사업장 이름이 잘린다. 자세히에만.
   실행: node --test tests/rules-dash-when.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8').replace(/\r\n/g, '\n');

function cut(decl) {
  const at = RAW.indexOf(decl);
  assert.ok(at > 0, decl + ' 을 못 찾았습니다');
  let i = RAW.indexOf('{', at + decl.length), d = 0;
  for (; i < RAW.length; i++) {
    if (RAW[i] === '{') d++;
    else if (RAW[i] === '}') { d--; if (!d) return RAW.slice(at, i + 1); }
  }
  throw new Error(decl + ' 의 끝을 못 찾았습니다');
}

function 판() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(cut('function dashWhen('), ctx);
  return ctx;
}
const 줄 = (k, over) => Object.assign({ stage: { k: k } }, over || {});

/* ── ① 연-월-일 ── */

test('★★ 연·월·일을 다 적는다 — 취업규칙은 몇 해에 걸친 기록이다', () => {
  const c = 판();
  const w = c.dashWhen(줄('reviewed', { done: '2026-07-24 14:30' }));
  assert.equal(w.날짜, '2026-07-24');
  assert.match(w.날짜, /^\d{4}-\d{2}-\d{2}$/, '연도가 빠졌습니다: ' + w.날짜);
});

test('★ 시각은 목록에 «안» 쓴다 — 줄이 길어지면 사업장 이름이 잘린다', () => {
  const c = 판();
  const w = c.dashWhen(줄('reviewed', { done: '2026-07-24 14:30' }));
  assert.ok(!/14:30/.test(w.날짜), '목록 날짜에 시각이 섞였습니다: ' + w.날짜);
  assert.match(w.자세히, /14:30/, '자세히에는 시각까지 남겨야 합니다: ' + w.자세히);
});

/* ── ② 갈래에 맞는 날짜 ── */

test('★★ 검토완료·개정중은 «검토완료일»을 쓴다 — 저장 시각이 아니다', () => {
  const c = 판();
  ['reviewed', 'amending'].forEach(function (k) {
    const w = c.dashWhen(줄(k, { done: '2026-07-24 14:30', saved: '2026-08-26 20:55' }));
    assert.equal(w.날짜, '2026-07-24', k + ' 가 저장 시각을 쓰고 있습니다');
    assert.equal(w.뜻, '검토');
  });
});

test('★ 작성중·미작성은 «마지막 저장일» — 아직 검토를 안 마쳤다', () => {
  const c = 판();
  ['draft', 'none'].forEach(function (k) {
    const w = c.dashWhen(줄(k, { saved: '2026-08-26 20:55' }));
    assert.equal(w.날짜, '2026-08-26');
    assert.equal(w.뜻, '저장');
  });
});

test('★ 신고완료는 «신고일»', () => {
  const c = 판();
  const w = c.dashWhen(줄('filed', { filed: '2026-09-01 09:00', done: '2026-07-24 14:30' }));
  assert.equal(w.날짜, '2026-09-01');
  assert.equal(w.뜻, '신고');
});

/* ── ③ 없을 때 ── */

test('★★ 검토완료일이 없으면 저장일로 물러나되 «이름도 함께» 물러난다', () => {
  /* 없는데 「검토」라 적으면 그것이 거짓말이다 — 기록이 명확해지라고 붙인 이름이
     오히려 사람을 속인다. */
  const c = 판();
  const w = c.dashWhen(줄('reviewed', { saved: '2026-08-26 20:55' }));
  assert.equal(w.날짜, '2026-08-26');
  assert.equal(w.뜻, '저장', '검토완료일이 없는데 「검토」라 적습니다');
});

test('아무 날짜도 없으면 «–» — 빈칸을 만들지 않는다', () => {
  const c = 판();
  const w = c.dashWhen(줄('none'));
  assert.equal(w.날짜, '–');
  assert.equal(w.뜻, '');
});

test('줄이 이상해도 안 터진다 — 한 줄 때문에 목록 전체가 비면 안 된다', () => {
  const c = 판();
  [null, undefined, {}, { stage: null }].forEach(function (r) {
    const w = c.dashWhen(r);
    assert.equal(w.날짜, '–');
  });
});

/* ── ④ 자세히에는 둘 다 ── */

test('★ 자세히에는 «검토완료일과 저장일을 나란히» 적는다 — 둘 다 알아야 할 때가 있다', () => {
  const c = 판();
  const w = c.dashWhen(줄('reviewed', { done: '2026-07-24 14:30', saved: '2026-08-26 20:55' }));
  assert.match(w.자세히, /2026-07-24/);
  assert.match(w.자세히, /2026-08-26/);
  assert.match(w.자세히, /검토 완료/);
  assert.match(w.자세히, /저장/);
});

/* ── ⑤ 화면이 실제로 그것을 쓴다 ── */

test('★★ 목록이 dashWhen 을 쓴다 — 옛 자르기(slice)가 남아 있으면 안 된다', () => {
  const md = cut('function renderDashModal(');
  assert.match(md, /dashWhen\(/, '목록이 아직 날짜를 스스로 자릅니다');
  assert.ok(!/\(r\.at\|\|""\)\.slice\(5,\s*10\)/.test(md),
    '★ 옛 「월-일만」 자르기가 남아 있습니다');
});

test('★★ dashRows 가 검토완료일·신고일을 «들고 온다»', () => {
  const fn = cut('function dashRows(');
  assert.match(fn, /done:/, '검토완료일을 안 담아 옵니다 — 담아 오지 않으면 못 씁니다');
  assert.match(fn, /doneAt/, 'doneAt 을 안 읽습니다');
  assert.match(fn, /filed:/, '신고일을 안 담아 옵니다');
});

test('★ 줄에 얹는 설명(dashTip)도 연·월·일을 다 적는다', () => {
  const fn = cut('function dashTip(');
  assert.match(fn, /dashWhen\(/, '설명이 아직 날짜를 스스로 자릅니다');
});

test('★ 차례는 그대로 — 오래 방치된 곳이 앞에 온다(2026-09-07 규칙)', () => {
  const fn = cut('function dashSorted(');
  assert.match(fn, /a\.at/, '오래 방치된 순으로 세우는 잣대가 바뀌었습니다');
});
