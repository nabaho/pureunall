/* 조문 머리를 «두 번» 찍지 않는다 (대표 제보 2026-09-13 「조문이 바뀐것인데 왜 이렇게
   엉망으로 정리하나?」)

   ■ 무엇이 문제였나
   「변경 결과(개정안 전문)」 창이 카드 머리에는 «새» 번호를 찍고, 본문에는 `it.after` 를
   «그대로» 찍었다. `it.after` 는 `a.body` 에서 온 것이라 **옛 조 머리를 품고 있다**
   (`buildItems`: `const before=a.body…; it.after=before`).
   그래서 이렇게 나왔다 —
     머리 : 제18조 (영리행위 및 겸직 금지)
     본문 : 제15조(영리행위 및 겸직 금지) 사원은 회사의 허가 없이 …
   조문이 하나인데 번호가 둘이고, 그나마 하나는 옛 번호다.

   ★★ 문서를 만드는 셋(한글 전문·대조표·미리보기 글)은 모두 `articleText(v)` 로
     «옛 머리를 떼고 새 번호를 붙여» 쓴다. **화면 하나만** 제 잣대를 안 썼다.
     오늘 아침 최종 확인 ①에서 잡은 것과 «같은 종류»다 — 잣대가 둘이면 갈린다.

   ■ 지키는 규칙
     ① 머리를 따로 찍는 자리는 본문에서 머리를 «뗀다»
     ② 떼는 일은 «한 자리»에서 한다 — 화면마다 다른 정규식을 두지 않는다
     ③ 문서 쪽(articleText)은 그대로 — 새 번호를 붙여 쓴다
   실행: node --test tests/rules-revision-head.test.js */
'use strict';
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
function 문장(decl) {
  const at = RAW.indexOf(decl);
  assert.ok(at > 0, decl + ' 을 못 찾았습니다');
  let i = at;
  for (let 줄 = 0; 줄 < 20; 줄++) {
    const j = RAW.indexOf('\n', i);
    if (RAW.slice(i, j).trimEnd().endsWith(';')) return RAW.slice(at, j);
    i = j + 1;
  }
  throw new Error(decl + ' 이 너무 깁니다');
}
function 판() {
  const ctx = {};
  vm.createContext(ctx);
  ['const BR_OPEN=', 'const BR_CLOSE=', 'const RE_HEAD_STRIP='].forEach(function (d) {
    vm.runInContext(문장(d), ctx);
  });
  vm.runInContext(cut('function articleBody('), ctx);
  vm.runInContext(cut('function articleText('), ctx);
  vm.runInContext(cut('function afterHead('), ctx);
  return ctx;
}

/* 실제 모양 — 옛 머리를 품은 본문 */
const 본문 = '제15조(영리행위 및 겸직 금지) 사원은 회사의 허가 없이 직접 또는 타인을 대리하여 '
  + '영리를 목적으로 한 취업이나 기타의 영업 행위에 종사할 수 없다.';

/* ══════ ① 떼는 일은 한 자리에서 ══════ */

test('★★★ 옛 조 머리를 «뗀다» — 본문만 남는다', () => {
  const c = 판();
  const b = c.articleBody({ after: 본문 });
  assert.match(b, /^사원은 회사의 허가 없이/, '★★★ 옛 머리가 남았습니다: ' + b.slice(0, 30));
  assert.ok(!/제15조/.test(b), '★★★ 옛 번호가 본문에 남았습니다');
  assert.match(b, /영업 행위에 종사할 수 없다/, '뒷부분을 잃었습니다');
});

test('머리가 없는 본문은 그대로 둔다 — 없는 것을 떼면 안 된다', () => {
  const c = 판();
  assert.equal(c.articleBody({ after: '사원은 품위를 손상하여서는 아니 된다.' }),
    '사원은 품위를 손상하여서는 아니 된다.');
});

test('빈 값·없는 칸에도 안 터진다', () => {
  const c = 판();
  [undefined, null, {}, { after: '' }, { after: null }].forEach(function (it) {
    assert.equal(typeof c.articleBody(it), 'string');
  });
});

test('가지번호 머리(제15조의2)도 뗀다', () => {
  const c = 판();
  const b = c.articleBody({ after: '제15조의2(개인정보의 보호) ① 회사는 …' });
  assert.match(b, /^① 회사는/, '가지번호 머리가 남았습니다: ' + b);
});

/* ══════ ② 문서 쪽은 그대로 — 새 번호를 붙인다 ══════ */

test('★★ 문서용 문안은 «새 번호»를 붙인다 — 옛 번호가 아니다', () => {
  const c = 판();
  const t = c.articleText({ no: '제18조', it: { after: 본문, title: '영리행위 및 겸직 금지' } });
  assert.match(t, /^제18조\(영리행위 및 겸직 금지\) 사원은/,
    '★★ 새 번호로 안 바꿨습니다: ' + t.slice(0, 40));
  assert.ok(!/제15조/.test(t), '★★ 옛 번호가 남았습니다');
});

test('★ 문서용 문안도 «같은 자리»에서 머리를 뗀다 — 잣대를 둘로 만들지 않는다', () => {
  const fn = cut('function articleText(');
  assert.match(fn, /articleBody\(/,
    '★ articleText 가 제 손으로 머리를 뗍니다 — 떼는 일은 articleBody 한 자리입니다');
});

/* ══════ ③ 화면이 실제로 쓴다 ══════ */

test('★★★ 「변경 결과」 창이 본문에서 머리를 «뗀다» — 머리를 두 번 찍으면 안 된다', () => {
  const fn = cut('function showRevision(');
  assert.match(fn, /articleBody\(/,
    '★★★ 변경 결과 창이 it.after 를 그대로 찍습니다 —'
    + ' 카드 머리에 새 번호, 본문에 옛 번호가 함께 나옵니다');
  assert.ok(!/escapeH\(breakHo\(it\.after\)\)/.test(fn),
    '★★★ 옛 방식(it.after 그대로)이 남아 있습니다');
});

test('★ 삭제 행은 그대로 「삭제」다 — 고치면서 딴 것이 넘어가면 안 된다', () => {
  const fn = cut('function showRevision(');
  assert.match(fn, /isDelP\?"삭제"/, '삭제 표기가 사라졌습니다');
});

test('★★ 머리를 따로 찍으면서 본문을 «안 떼는» 자리가 없다', () => {
  /* 주석을 먼저 걷는다 — 「예전엔 이랬다」고 적어 둔 글이 「아직 쓴다」로 읽히면 안 된다. */
  const 코드 = RAW.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
                  .replace(/^[ \t]*\/\/.*$/gm, '');
  const 남은것 = (코드.match(/escapeH\(breakHo\(it\.after\)\)/g) || []);
  assert.deepEqual(남은것, [], '본문을 안 떼고 찍는 자리가 있습니다: ' + JSON.stringify(남은것));
});

/* ══════ ④ 신구대조표 — 노동청에 나가는 문서 ══════ */

test('★★★ 「변경 후」 열의 조 머리는 «새» 번호다 — 옛 번호가 나가면 안 된다', () => {
  /* 2026-09-13 실측: 변경조항 열은 제1조인데 변경 후 열의 머리가 제15조였다.
     개정 뒤에 그 조는 제1조인데 본문이 스스로를 제15조라 부르면 서류가 어긋난다.
     ⚠ 변경 «전» 열은 옛 번호가 맞다 — 그것이 현행이다. */
  const fn = cut('function daejoRows(');
  assert.match(fn, /afterHead\(/,
    '★★★ 변경 후 열이 it.after 를 그대로 씁니다 — 옛 조 번호가 서류에 나갑니다');
  assert.match(fn, /before:it\.orig===""\?"신설":it\.orig/,
    '★ 변경 전 열은 현행 그대로여야 합니다');
});

test('★★ 머리가 «있을 때만» 갈아 끼운다 — 없는 것에 새로 붙이지 않는다', () => {
  const c = 판();
  const v = { no: '제1조', it: { after: 본문, title: '영리행위 및 겸직 금지' } };
  assert.match(c.afterHead(v), /^제1조\(영리행위 및 겸직 금지\) 사원은/,
    '머리를 새 번호로 안 갈았습니다: ' + c.afterHead(v).slice(0, 30));

  const 신설 = { no: '제2조', it: { after: '① 회사는 사원의 개인정보를 …', title: '개인정보의 보호' } };
  assert.equal(c.afterHead(신설), '① 회사는 사원의 개인정보를 …',
    '★★ 머리가 없는 신설 문안에 머리를 새로 붙였습니다 — 양식이 바뀝니다');
});

test('빈 문안에도 안 터진다', () => {
  const c = 판();
  assert.equal(c.afterHead({ no: '제1조', it: { after: '' } }), '');
  assert.equal(typeof c.afterHead({ no: '제1조', it: {} }), 'string');
});
