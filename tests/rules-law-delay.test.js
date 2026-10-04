/* 법 시행 전에 미리 고친 조문은 «법 시행일부터» 시행한다 — 부칙 단서 (대표 지시 2026-10-04)

   「취업규칙 시행령(부칙)에 아직 시행되지 않는 것은 법 시행날에 시행된다는 별도 규정 만들어라.
    앞으로 개정 전에 만드는 모든 규정은 그렇게 해라」

   예) 규칙 시행일 2026-10-15 · 성희롱 예방교육 대상(D13, 법 시행 2026-11-27)을 미리 고친 제84조
     → 부칙 「… 2026년 10월 15일부터 시행한다. 다만, 제84조의 개정규정은 2026년 11월 27일부터 시행한다.」

   ★ 지키는 규칙
     ① 바뀐 조 가운데, 그 조를 고친 까닭이 «아직 시행 전인 법»뿐일 때만 단서에 넣는다
     ②★★ 그 조를 «지금 법»으로도 고쳐야 하면(현행 기준이 위반의심·누락) 미루지 않는다 — 미루면 지금 법 위반이 남는다
     ③★ 한 조에 시행일이 여럿이면 «가장 이른 날» — 늦은 날로 미루면 이른 법을 어긴다
     ④ 날짜가 다르면 「…부터, …부터 각각 시행한다」
     ⑤ 규칙 시행일이 법 시행일과 같거나 뒤면 단서가 없다
     ⑥ 부칙을 짓는 곳(composeAddendum)은 하나 — 전문·대조표·미리보기·한글이 모두 그것을 쓴다
   실행: node --test tests/rules-law-delay.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8').replace(/\r\n/g, '\n');
function cut(decl) {
  const at = RAW.indexOf(decl);
  assert.ok(at > 0, decl + ' 을 못 찾았습니다');
  let i = RAW.indexOf('{', at + decl.length), d = 0;
  for (; i < RAW.length; i++) { if (RAW[i] === '{') d++; else if (RAW[i] === '}') { d--; if (!d) return RAW.slice(at, i + 1); } }
  throw new Error(decl + ' 끝 없음');
}
function 판() {
  const ctx = {};
  vm.createContext(ctx);
  const line = RAW.split('\n').find((l) => l.startsWith('const TPLS = '));
  vm.runInContext(line.replace(/^const TPLS = /, 'var TPLS = '), ctx);
  vm.runInContext(cut('function fmtKDate('), ctx);
  vm.runInContext(cut('function lawDelayGroups('), ctx);
  vm.runInContext(cut('function lawDelayText('), ctx);
  return ctx;
}
const R = (id, effective) => ({ id, effective: effective || '' });
const F = (id, eff, status, label) => ({ rule: R(id, eff), status, hit: label ? { label } : null });
const V = (no, id) => ({ no, it: { id } });
const ASOF = '2026-10-15';

test('★★★ 미리 고친 조는 법 시행일부터 — D13 제84조', () => {
  const c = 판();
  const g = c.lawDelayGroups([V('제84조', 'art_제84조')], [F('D13', '2026-11-27', '시행예정', '제84조')], ASOF, c.TPLS);
  assert.equal(c.lawDelayText(g), '다만, 제84조의 개정규정은 2026년 11월 27일부터 시행한다.');
});

test('★★ 그 조를 지금 법으로도 고쳐야 하면 미루지 않는다', () => {
  const c = 판();
  // 제21조: D10(4일, 11.27)과 B19(현행 6일·유급 2일)가 함께 걸렸다 — 미루면 B19 위반이 남는다
  const g = c.lawDelayGroups([V('제21조', 'art_제21조')],
    [F('D10', '2026-11-27', '위반의심', '제21조'), F('B19', '2025-02-23', '위반의심', '제21조')], ASOF, c.TPLS);
  assert.equal(g.length, 0, '★★ 지금 법 위반을 미뤘다');  // vm 의 배열은 다른 세계 것이라 deepEqual([]) 이 안 맞는다
  assert.equal(c.lawDelayText(g), '');
});

test('지금 법 기준이 «적합»이면 막지 않는다 — 걸린 것만 본다', () => {
  const c = 판();
  const g = c.lawDelayGroups([V('제84조', 'art_제84조')],
    [F('D13', '2026-11-27', '시행예정', '제84조'), F('B15', '', '적합', '제84조')], ASOF, c.TPLS);
  assert.equal(g.length, 1);
});

test('★ 한 조에 시행일이 여럿이면 가장 이른 날', () => {
  const c = 판();
  const g = c.lawDelayGroups([V('제9조', 'art_제9조')],
    [F('X2', '2027-06-10', '시행예정', '제9조'), F('X1', '2026-12-10', '수동확인', '제9조')], ASOF, c.TPLS);
  assert.equal(c.lawDelayText(g), '다만, 제9조의 개정규정은 2026년 12월 10일부터 시행한다.');
});

test('날짜가 다르면 「각각」 · 같은 날은 「및」으로 묶는다', () => {
  const c = 판();
  const g = c.lawDelayGroups([V('제9조', 'art_제9조'), V('제21조', 'art_제21조'), V('제84조', 'art_제84조')],
    [F('D11', '2026-12-10', '수동확인', '제9조'), F('D10', '2026-11-27', '위반의심', '제21조'), F('D13', '2026-11-27', '시행예정', '제84조')],
    ASOF, c.TPLS);
  assert.equal(c.lawDelayText(g),
    '다만, 제21조 및 제84조의 개정규정은 2026년 11월 27일부터, 제9조의 개정규정은 2026년 12월 10일부터 각각 시행한다.');
});

test('셋 이상은 쉼표와 「및」', () => {
  const c = 판();
  const g = c.lawDelayGroups([V('제1조', 'art_제1조'), V('제2조', 'art_제2조'), V('제3조', 'art_제3조')],
    ['제1조', '제2조', '제3조'].map((l) => F('D13', '2026-11-27', '시행예정', l)), ASOF, c.TPLS);
  assert.equal(c.lawDelayText(g), '다만, 제1조, 제2조 및 제3조의 개정규정은 2026년 11월 27일부터 시행한다.');
});

test('규칙 시행일이 법 시행일과 같거나 뒤면 단서가 없다', () => {
  const c = 판();
  ['2026-11-27', '2026-12-01'].forEach((asof) => {
    const g = c.lawDelayGroups([V('제84조', 'art_제84조')], [F('D13', '2026-11-27', '위반의심', '제84조')], asof, c.TPLS);
    assert.equal(g.length, 0, asof);
  });
});

test('법과 상관없이 고친 조는 안 넣는다', () => {
  const c = 판();
  assert.equal(c.lawDelayGroups([V('제5조', 'art_제5조')], [F('D13', '2026-11-27', '시행예정', '제84조')], ASOF, c.TPLS).length, 0);
});

test('신설 조문 — 문안(ins_TPL)·문안 없는 신설(miss_·chkins_)도 그 기준의 시행일을 따른다', () => {
  const c = 판();
  const t = c.TPLS.find((x) => x.ruleIds.includes('D13'));
  const g = c.lawDelayGroups([V('제84조의2', 'ins_' + t.tid), V('제30조의2', 'miss_D12')],
    [F('D13', '2026-11-27', '시행예정', null), F('D12', '2027-06-10', '시행예정', null)], ASOF, c.TPLS);
  assert.equal(c.lawDelayText(g),
    '다만, 제84조의2의 개정규정은 2026년 11월 27일부터, 제30조의2의 개정규정은 2027년 6월 10일부터 각각 시행한다.');
});

/* ══════ 부칙에 실제로 붙는가 ══════ */

test('★ 부칙 짓는 곳(composeAddendum)이 단서를 붙인다 — 한 곳에서', () => {
  const fn = cut('function composeAddendum(');
  assert.match(fn, /lawDelayGroups\(/);
  assert.match(fn, /lawDelayText\(/);
  assert.match(fn, /inDaejoDoc/, '바뀐 조(대조표에 실리는 조)만 본다');
});

test('검토 결과를 잃은 채 되살린 작업도 단서를 놓치지 않는다 — 다시 판정한다', () => {
  const fn = cut('function lawDelayFindings(');
  assert.match(fn, /PuRulesCriteria\.evaluate\(/);
});

/* ══════ 시행 전 개정을 «만든다» ══════ */

test('★★ 시행예정 기준에 문안이 있으면 고친 안을 만든다 — 개정 전에 미리 만드는 규정', () => {
  const fn = cut('function buildItems(');
  assert.match(fn, /f\.status==="시행예정"&&TPL_BY_RULE\[f\.rule\.id\]/, '★★ 시행예정은 고친 안을 안 만든다');
});

test('난임치료휴가 문안은 유급 4일 (대표 「추천대로」 2026-10-04)', () => {
  const c = 판();
  const t = c.TPLS.find((x) => x.ruleIds.includes('D10'));
  assert.match(t.text, /최초 4일은 유급/);
  assert.doesNotMatch(t.text, /최초 2일/);
  assert.match(t.reason, /2026\.11\.27/);
});
