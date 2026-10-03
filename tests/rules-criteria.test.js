/* 검토 기준을 rules.html 에서 떼어 냈다(설계 §6-3). 판정이 «한 글자도» 바뀌면 안 된다 —
   떼기 전 코드로 만든 고정 자료(tests/fixtures/rules-criteria-golden.json)와 견준다.
   고정 자료는 «사람이 고친 조문 연결(교정 기억)»이 비어 있을 때의 판정이다.
   교정 기억(pin/ban) 길은 따로 고정 자료(rules-criteria-fix.json)로 지킨다 —
   그 길이 끊기면 사람이 📌 지정한 조문이 말없이 무시된다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/pu-rules-criteria.js');
const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'rules-criteria-golden.json'), 'utf8'));
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'rules-criteria-fix.json'), 'utf8'));
// 표준취업규칙 조 쪼개기는 rules.html 과 같은 parseArticles 를 써야 견줄 수 있다 — 떼기 전 그것을 검사도 쓴다
const { parseArticles, STD_TEXT } = require('./lib-rules-std.js');

const 줄이기 = (f) => ({ id: f.rule.id, status: f.status, loc: f.loc, note: f.note });

test('판정이 떼기 전과 같다 — 규모 넷', () => {
  const arts = parseArticles(STD_TEXT);
  assert.ok(G.length >= 4, '고정 자료가 비었다');
  G.forEach((g) => {
    const got = C.evaluate(arts, g.size, new Set(), '2026-10-01').map(줄이기);
    assert.deepEqual(got, g.results, '★ 규모 ' + g.size + ' 판정이 바뀌었다');
  });
});

test('교정 기억(pin/ban)이 떼기 전처럼 판정을 바꾼다 — useMatchFix', () => {
  const arts = parseArticles(STD_TEXT);
  const 기본 = G.find((g) => g.size === FIX.size).results;
  try {
    C.useMatchFix(() => FIX.fix);
    const got = C.evaluate(arts, FIX.size, new Set(), FIX.asof);
    FIX.expect.forEach((e) => {
      const f = got.find((x) => x.rule.id === e.id);
      assert.ok(f, e.id + ' 판정이 없다');
      assert.deepEqual(줄이기(f), e, '★ 교정 기억이 걸린 ' + e.id + ' 판정이 떼기 전과 다르다');
      // 고정 자료가 «교정 없음»과 같으면 이 검사는 아무것도 안 지킨다 — 실제로 갈라지는지 본다
      assert.notDeepEqual(e, 기본.find((x) => x.id === e.id), e.id + ' 의 교정 고정 자료가 교정 없는 판정과 같다 — 이빨이 없다');
    });
  } finally {
    C.useMatchFix(() => ({}));
  }
  // 되돌린 뒤엔 교정 없는 판정으로 돌아온다(읽개가 값을 붙잡아 두지 않는다)
  const back = C.evaluate(arts, FIX.size, new Set(), FIX.asof).map(줄이기);
  assert.deepEqual(back, 기본);
});

test('rules.html 은 새 파일을 싣고, 정의를 두 벌 두지 않는다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
  assert.match(html, /<script src="js\/pu-rules-criteria\.js\?v=\d+"><\/script>/);
  const bare = html.replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.doesNotMatch(bare, /const RULES = \[/, '★ 규칙집이 rules.html 에 또 있다 — 두 벌');
  assert.doesNotMatch(bare, /function evaluate\(/, '★ 판정이 rules.html 에 또 있다 — 두 벌');
  assert.doesNotMatch(bare, /const LAW_SYN\s*=/, '★ 동의어 표가 rules.html 에 또 있다 — 두 벌');
  // 받는 줄이 싣는 줄보다 뒤에 있어야 한다(먼저 받으면 undefined 를 펼치다 화면 전체가 멈춘다)
  const 싣기 = bare.search(/<script src="js\/pu-rules-criteria\.js/);
  const 받기 = bare.search(/=\s*window\.PuRulesCriteria\s*;/);
  assert.ok(받기 > 싣기 && 싣기 >= 0, '★ rules.html 이 PuRulesCriteria 를 싣기 전에 받는다(또는 안 받는다)');
  // 사람이 고친 조문 연결을 판정에 넘기는 줄 — 빠지면 📌 지정이 말없이 무시된다
  assert.match(bare, /PuRulesCriteria\.useMatchFix\(\s*\(\)\s*=>\s*MFIX\s*\)/,
    '★ rules.html 이 교정 기억(MFIX)을 판정에 넘기지 않는다');
});
