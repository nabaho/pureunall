/* 최종 확인 ①「기존 취업규칙」이 글자를 잃지 않는다 + 장·절 제목이 본문에 안 섞인다
   (대표 제보 2026-09-13 「글자 빠지고 제0장은 작은 글씨로 확인도 안 되고 내용도 엉망이다」)

   ■ 무엇이 문제였나 — 실제 파일(101조)로 재어 본 것
   ① ★★★ `finSec1` 이 조 머리가 아니라 «첫 줄 통째»를 지우고 있었다.
        `a.body.replace(/^제\s*\d+\s*조[^\n]*\n?/,"")`
      한글에서 뽑은 글은 «보이는 줄바꿈»이 진짜 줄바꿈으로 들어온다. 그래서 조 머리와
      본문 첫 줄이 «같은 줄»에 있고, 그 줄을 통째로 지우면 본문이 함께 사라진다.
      실측: 조 101개에서 **4,459자**가 사라졌다.
        제22조 49자 → **2자**(「다.」) · 제18조 73자 → 25자 · 제29조 362자 → 312자
      ⚠ 다른 화면(원본 미리보기·조문 검색·서고)은 `RE_HEAD_STRIP` 으로 «머리만» 뗀다 —
        그래서 왼쪽 미리보기는 멀쩡했고 이 창만 엉망이었다. 잣대가 두 개였던 것이 뿌리다.
   ② `.slice(0,400)` 으로 긴 조문을 «말없이» 잘랐다 — 실측 8개 조.
      여기는 **최종 확인** 창이다. 못 본 글을 「확인했다」로 처리하면 안 된다.
   ③ 장·절 제목이 «두 줄»이면(제4장 인사 / 제1절 총칙) 마지막 한 줄만 떼어,
      「제4장 인사」가 앞 조문 본문에 남았다. 실측 3곳.

   ■ 지키는 규칙
     ① 조 머리를 뗄 때는 «머리만» 뗀다 — 줄 단위로 지우지 않는다
     ② 최종 확인 창은 글을 «말없이 자르지» 않는다
     ③ 장·절 제목은 «몇 줄이든» 다 뗀다
     ④ 잣대는 한 자리(`RE_HEAD_STRIP`) — 화면마다 다른 잣대를 두면 또 갈린다
   실행: node --test tests/rules-final-full-text.test.js */
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
/* ⚠ 「한 줄」로 자르면 안 된다 — RE_TOC_LINE 처럼 «여러 줄로 쓴 선언»이 있어
     반 토막이 나고 `SyntaxError: missing )` 로 죽는다(여기서 한 번 걸렸다).
   문장이 끝나는 줄(`;` 로 끝나는 줄)까지 가져온다. */
function 문장(decl) {
  const at = RAW.indexOf(decl);
  assert.ok(at > 0, decl + ' 을 못 찾았습니다');
  let i = at;
  for (let 줄 = 0; 줄 < 20; 줄++) {
    const j = RAW.indexOf('\n', i);
    assert.ok(j > 0, decl + ' 의 끝을 못 찾았습니다');
    if (RAW.slice(i, j).trimEnd().endsWith(';')) return RAW.slice(at, j);
    i = j + 1;
  }
  throw new Error(decl + ' 이 너무 깁니다 — 검사가 잘못 짚었습니다');
}

/* 파싱을 «실제로 돌려» 본다 */
function 판() {
  const ctx = {};
  vm.createContext(ctx);
  ['const BR_OPEN=', 'const BR_CLOSE=', 'const RE_HEAD=', 'const RE_TITLE=',
   'const RE_HEAD_STRIP=', 'const RE_TOC_LINE=', 'const stripWs ='].forEach(function (d) {
    vm.runInContext(문장(d), ctx);
  });
  vm.runInContext(cut('function stripToc('), ctx);
  vm.runInContext(cut('function parseArticles('), ctx);
  /* ⚠ `const` 로 선언한 것은 vm 바깥에서 «ctx 의 칸으로 안 보인다»(전역 렉시컬이라
     스크립트끼리는 보이는데 밖에서는 안 보인다). 여기서 한 번 걸렸다 — 값이
     undefined 라 `replace(undefined,'')` 가 조용히 아무것도 안 하고 지나갔다. */
  ctx.RE_HEAD_STRIP = vm.runInContext('RE_HEAD_STRIP', ctx);
  return ctx;
}

/* 실제 파일과 «같은 모양»의 글 — 한글에서 뽑으면 보이는 줄바꿈이 그대로 들어온다.
   ⚠ 업체 자료를 쓰지 않는다. 모양만 같게 손으로 지었다. */
const 글 = [
  '제1장 총칙',
  '제1조(목적) 이 규칙은 회사 사원의 복무 및 근로조건에 관한 사항을 정함을 목',
  '적으로 한다.',
  '제2조(적용범위) 이 규칙은 회사에 근무하는 모든 사원에게 적용한다.',
  '제3장 복무',
  '제1절 총칙',
  '제18조(집회 등의 금지) 사원은 회사의 허가 없이 회사 내에서 업무 외의 집회, 문서의 배포·게',
  '시 그 밖에 이에 유사한 행위를 하지 못한다.',
  '제22조(종업원의 책임) 사원은 고의 또는 중대한 과실로 회사에 손해를 입힌 때에는 그 손해를 배상하여야 한',
  '다.'
].join('\n');

/* ══════ ① 조 머리만 뗀다 ══════ */

test('★★★ 조 머리와 본문이 «같은 줄»이어도 본문을 안 잃는다', () => {
  const c = 판();
  const a = c.parseArticles(글).find(function (x) { return x.num === 18; });
  assert.ok(a, '제18조를 못 찾았습니다');
  const 뗀뒤 = a.body.replace(c.RE_HEAD_STRIP, '').trim();
  assert.match(뗀뒤, /^사원은 회사의 허가 없이/,
    '★★★ 본문 첫 줄이 사라졌습니다: ' + 뗀뒤.slice(0, 30));
  assert.match(뗀뒤, /유사한 행위를 하지 못한다/, '뒷부분도 있어야 합니다');
});

test('★★★ 최종 확인 ①이 «줄 단위로 지우지» 않는다 — 그것이 4,459자를 삼켰다', () => {
  const fn = cut('function finSec1(');
  assert.ok(!/\^제\\s\*\\d\+\\s\*조\[\^\\n\]\*/.test(fn),
    '★★★ 아직 «첫 줄 통째»를 지우고 있습니다 — 조 머리와 본문이 같은 줄이면 본문이 사라집니다');
  assert.match(fn, /RE_HEAD_STRIP/,
    '★ 다른 화면과 «같은 잣대»(RE_HEAD_STRIP)를 써야 합니다 — 잣대가 둘이면 또 갈립니다');
});

test('★★ 최종 확인 ①이 글을 «말없이 자르지» 않는다 — 못 본 것을 확인시키면 안 된다', () => {
  const fn = cut('function finSec1(');
  assert.ok(!/slice\(0,\s*400\)/.test(fn),
    '★★ 400자에서 말없이 잘립니다 — 여기는 최종 확인 창입니다');
});

test('★★ 최종 확인 ②③도 «말없이 자르지» 않는다 — 101조 문서에서 41조가 안 보인 채 확인됐다', () => {
  /* 여기는 «신고 서류를 만들기 직전»에 보는 창이다. 못 본 글을 「확인했다」로
     처리하면, 확인이라는 절차 자체가 거짓이 된다. 길면 창이 구르면 된다. */
  const s2 = cut('function finSec2(');
  assert.ok(!/slice\(0,\s*300\)/.test(s2), '②(신구대조표) 칸이 300자에서 잘립니다');
  const s3 = cut('function finSec3(');
  assert.ok(!/slice\(0,\s*500\)/.test(s3), '③(변경 규칙 전문)이 조마다 500자에서 잘립니다');
  assert.ok(!/shown\.slice\(0,\s*60\)/.test(s3), '③이 60개 조까지만 보입니다');
});

/* ══════ ② 장·절 제목 ══════ */

test('★★ 장·절 제목이 «여러 줄»이어도 다 뗀다 — 두 줄이면 하나만 떼고 있었다', () => {
  const c = 판();
  const a = c.parseArticles(글).find(function (x) { return x.num === 2; });
  assert.ok(a, '제2조를 못 찾았습니다');
  assert.ok(!/제\s*\d+\s*[장절]/.test(a.body),
    '★★ 장·절 제목이 본문에 남았습니다: ' + JSON.stringify(a.body.slice(-40)));
});

test('★ 장 제목을 뗐다고 본문까지 자르지 않는다', () => {
  const c = 판();
  const a = c.parseArticles(글).find(function (x) { return x.num === 2; });
  assert.match(a.body, /모든 사원에게 적용한다/, '본문이 함께 잘렸습니다: ' + a.body);
});

test('★ 장 제목이 없는 조문은 그대로 둔다 — 없는 것을 자르면 안 된다', () => {
  const c = 판();
  const a = c.parseArticles(글).find(function (x) { return x.num === 22; });
  assert.match(a.body, /손해를 배상하여야 한\n다\./,
    '멀쩡한 끝을 잘랐습니다: ' + JSON.stringify(a.body.slice(-30)));
});

/* ══════ ③ 되돌아가지 않게 ══════ */

test('★★ 조 머리를 «줄 끝까지» 지우는 자리가 없다 — 그 모양 하나가 4,459자를 삼켰다', () => {
  /* ⚠ 「손으로 쓴 정규식」을 다 막으면 안 된다 — 문안 은행(bankNormBody)과 서고는
     괄호 «안»까지만 떼는 다른 일이고, 줄을 지우지 않아 안전하다. 처음에 넓게 잡았다가
     그 둘을 물었다. 진짜 위험한 모양은 «조 머리 뒤 [^\n]* » 하나다.
     주석은 먼저 걷는다 — 「예전에 이랬다」고 적어 둔 글이 「아직 쓴다」로 읽히면 안 된다. */
  const 코드 = RAW.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
                  .replace(/^[ \t]*\/\/.*$/gm, '');
  const 줄지우기 = (코드.match(/\^제\\s\*\\d\+\\s\*조[^/\n]*\[\^\\n\]/g) || []);
  assert.deepEqual(줄지우기, [],
    '★★ 조 머리 뒤를 «줄 끝까지» 지우는 자리가 있습니다: ' + JSON.stringify(줄지우기)
    + ' — 한글에서 뽑은 글은 머리와 본문 첫 줄이 같은 줄이라 본문이 함께 사라집니다.'
    + ' RE_HEAD_STRIP 을 쓰세요');
});
