/* 남은 빈칸을 더 채운다 — 날짜·서명·주소·「노동조합대표자」
 *
 * 대표 지시 2026-09-19
 *   「남은것도 자동으로」
 *   「노동조합 대표자는 다 모두 근로자 대표 이다. 정관에 내용 바꿔라」
 *   「기금출연확인서는 회사마다 1장씩 넣는 것이다」
 *
 * 다섯 단계 30종을 «자료가 다 있는» 가짜 기금으로 실제로 그려 빈칸을 세니 67곳이었다.
 * 그중 서른두 곳이 «자료는 있는데 안 이어진» 자리였다.
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 여기 이름·번호는 전부 가짜다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
const grabLine = (n) => {
  const m = SRC.match(new RegExp('var ' + n + '=[^\\n]*?;'));
  assert.ok(m, 'fund.html 에 상수가 없다: ' + n);
  return m[0];
};
/* 여러 줄짜리 값({·[ 로 시작) — 괄호를 세어 끝을 찾는다 */
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('상수 끝을 못 찾음: ' + name);
}

/* ══════════ ① 「노동조합대표자」 → 「근로자대표」 ══════════ */

const LBL = (() => {
  const box = {};
  new Function([
    'var D=null;',
    'function T(s){ return {nodeType:3, nodeValue:s}; }',
    grabDecl('WREP_LBL'), grabFn('fillWrepLabel'),
    'this.run=function(txts){',
    '  var kids=txts.map(T);',
    '  var root={nodeType:1, childNodes:kids};',
    '  D={createTreeWalker:function(){ var i=0; return {nextNode:function(){ return kids[i++]||null; }}; }};',
    '  fillWrepLabel(root);',
    '  return kids.map(function(k){ return k.nodeValue; });',
    '};',
    'this.setDoc=function(d){ D=d; };',
  ].join('\n').replace(/document\.createTreeWalker/g, 'D.createTreeWalker')).call(box);
  return box;
})();

test('★ 「노동조합대표자」가 «근로자대표»로 바뀐다', () => {
  assert.deepEqual(
    LBL.run(['가나기계 노동조합대표자 ○○○ (인)', '다라전자 노동조합 대표자 ○○○ (인)']),
    ['가나기계 근로자대표 ○○○ (인)', '다라전자 근로자대표 ○○○ (인)']);
});

test('그 밖의 글은 건드리지 않는다', () => {
  assert.deepEqual(LBL.run(['각 참여회사 근로자측 위 원', '노동조합 및 노동관계조정법']),
    ['각 참여회사 근로자측 위 원', '노동조합 및 노동관계조정법']);
});

test('왜 바꿨는지 까닭이 코드에 남아 있다', () => {
  /* grabFn 은 함수 «몸통»만 준다 — 까닭은 주석에 있다. 주석 머리를 «직접» 찾는다.
     ⚠ 「함수 앞 700자」로 잡았더니, 사이에 다른 함수가 끼면서 창 밖으로 밀려났다. */
  const i = SRC.indexOf('══ 「노동조합대표자」는 «근로자대표»다 ══');
  assert.ok(i >= 0, '왜 바꿨는지 적어 둔 주석 머리가 없다');
  const around = SRC.slice(i, i + 700);
  assert.ok(around.indexOf('노동조합이 «없는» 곳이 많고') >= 0, '노조 없는 회사 이야기가 없다');
  /* 2026-09-19: 「근로자측대표」도 함께 바꾼다 — 그 까닭도 곁에 적혀 있어야 한다 */
  const near = SRC.slice(Math.max(0, SRC.indexOf('var WREP_LBL=') - 400), SRC.indexOf('var WREP_LBL=') + 200);
  assert.ok(near.indexOf('정관과 설립합의서가 같은 말을 써야 한다') >= 0, '왜 합의서도 바꿨는지 안 적혀 있다');
  assert.ok(around.indexOf('제55조제2항') >= 0, '법 근거가 안 적혀 있다');
  assert.ok(around.indexOf('fillPartyList «앞»에서') >= 0, '차례가 왜 중요한지 안 적혀 있다');
});

test('★ fillWrepLabel 이 fillPartyList «앞»에서 돈다 — 늘어난 줄도 새 말이어야 한다', () => {
  const h = grabFn('hwpFormHTML');
  const a = h.indexOf('fillWrepLabel(d)');
  const b = h.indexOf('fillPartyList(d,f,sites)');
  assert.ok(a >= 0 && b > a, '뒤에 돌면 늘어난 줄에 「노동조합대표자」가 남는다');
});

/* ══════════ ② 홀로 선 날짜 자리 ══════════ */

const DATE = (() => {
  const box = {};
  new Function([grabLine('DATE_CTX'), grabFn('_dateSlot'),
    'this.slot=_dateSlot; this.ctx=DATE_CTX;'].join('\n')).call(box);
  return box;
})();

test('★ 밑줄만 든 마디를 «날짜 자리»로 알아본다', () => {
  ['＿＿＿＿＿', '  ＿＿＿＿＿  ', '＿＿＿＿＿ 년 월 일', '_____'].forEach((s) => {
    assert.equal(DATE.slot(s), true, s + ' 를 날짜 자리로 안 본다');
  });
});

test('★★ 글이 섞인 마디는 날짜 자리가 아니다 — 아무 밑줄이나 날짜로 만들면 안 된다', () => {
  ['소 재 지 : ＿＿＿＿＿', '＿＿＿＿＿ 대표이사', '금 액 : ＿＿＿＿＿', '＿＿', ''].forEach((s) => {
    assert.equal(DATE.slot(s), false, s + ' 를 날짜 자리로 본다');
  });
});

test('날짜 문맥은 «서류를 내는 말»이다', () => {
  ['위와 같이 신고합니다.', '지급을 신청합니다.', '계획서를 제출합니다.', '위와 같이 확인합니다.',
    '권한을 위임함.', '각 1통씩 보관한다.', '취임을 승낙합니다.', '이행할 것을 서약합니다.',
    '변경 내용을 보고합니다.'].forEach((s) => {
    assert.ok(DATE.ctx.test(s), s + ' 가 날짜 문맥이 아니다');
  });
  ['이 정관은 다음과 같다', '기금법인 대표자'].forEach((s) => {
    assert.ok(!DATE.ctx.test(s), s + ' 를 날짜 문맥으로 본다');
  });
});

test('★★ 덩이에 날짜가 이미 있으면 손대지 않는다 — 두 번 찍힌다', () => {
  const fn = grabFn('fillDerived');
  assert.match(fn, /!\/\\d\{4\}\\s\*\[\.년\]\/\.test\(para\)/,
    '이미 적힌 날짜를 다시 찍는다');
  assert.match(fn, /_dateSlot\(t\)&&DATE_CTX\.test\(para\)/, '문맥을 안 보고 채운다');
});

/* ══════════ ③ 어느 서식에나 도는 규칙('*') ══════════ */

test('★★ \'*\' 규칙이 «정말» 돈다 — 넣어만 두면 죽은 규칙이다', () => {
  const fn = grabFn('fillDerived');
  assert.match(fn, /if\(r\[0\]!=='\*'&&r\[0\]!==kind\) return;/,
    "'*' 를 안 봐서 한 번도 안 도는 규칙이 된다");
  const n = (fn.match(/\['\*',/g) || []).length;
  assert.ok(n >= 6, "'*' 규칙이 " + n + '개뿐이다');
});

/* ══════════ ④ 「작성 예」는 세지 않는다 ══════════ */

const CNT = (() => {
  const box = {};
  new Function([grabFn('_stripSample'), grabFn('_blankCount'),
    'this.n=_blankCount; this.strip=_stripSample;'].join('\n')).call(box);
  return box;
})();

test('★★ 서식의 「작성 예」 안내문은 «채울 자리»가 아니다', () => {
  const s = '(작성 예) ○○동 ○○○○번지 ○○호 ○○상가(빌딩) ○○동 ○○층 ○○○○호';
  assert.equal(CNT.n(s), 0, '안내문을 채울 자리로 센다 — 0 을 목표로 삼을 수 없게 된다');
});

test('진짜 빈칸은 그대로 센다', () => {
  assert.equal(CNT.n('금 액 : ＿＿＿＿＿ 원'), 1);
  assert.equal(CNT.n('주소 ＿＿＿＿＿ 전화 ＿＿＿＿＿'), 2);
  assert.equal(CNT.n('○○주식회사 대표이사'), 1);
});

test('안내문 «뒤»의 진짜 빈칸은 살아 있다', () => {
  assert.equal(CNT.n('금 액 : ＿＿＿＿＿\n(작성 예) ○○동 ○○호\n주소 ＿＿＿＿＿'), 2);
});

/* ══════════ ⑤ 기금출연확인서 — 회사마다 한 장 ══════════ */

test('★★ 확인서가 회사마다 «A4 한 장씩» 나뉜다', () => {
  ['fillFoundContribDoc', 'fillContribDoc'].forEach((n) => {
    const fn = grabFn(n);
    assert.match(fn, /made\.forEach\(function\(x,i\)\{ if\(i\) x\.setAttribute\('data-newpage','1'\); \}\);/,
      n + ' 에서 확인서가 한 장에 이어 붙는다');
  });
});

test('★ 첫 장에는 표를 붙이지 않는다 — 맨 앞에 빈 장이 생긴다', () => {
  assert.match(grabFn('fillFoundContribDoc'), /if\(i\) x\.setAttribute/,
    '첫 장에도 붙이면 빈 장이 하나 생긴다');
});

test('쪽 나누기가 data-newpage 를 실제로 본다', () => {
  assert.ok(SRC.indexOf("nd.getAttribute('data-newpage')") >= 0,
    '표시만 달고 쪽 나누기가 안 보면 아무 일도 안 일어난다');
});

/* ══════════ ⑥ 검사기에도 실렸는가 ══════════ */

test('★★ jsdom 검사도 새 함수를 실어야 한다 — 없으면 CI 에서만 통째로 죽는다', () => {
  ['check_derived.js', 'check_forms.js'].forEach((f) => {
    const t = fs.readFileSync(path.join(__dirname, '..', 'fund-erp', 'tools', f), 'utf8');
    ["gS('DATE_CTX')", "gF('_dateSlot')", "gF('fillWrepLabel')", "gF('_stripSample')"].forEach((k) => {
      assert.ok(t.indexOf(k) >= 0, f + ' 에 ' + k + ' 가 없다');
    });
  });
});

test('같은 이름 함수를 두 번 선언하지 않았다', () => {
  ['fillWrepLabel', '_dateSlot', '_stripSample'].forEach((n) => {
    const c = (SRC.match(new RegExp('function ' + n + '\\(', 'g')) || []).length;
    assert.equal(c, 1, n + ' 이 ' + c + '번 선언돼 있다');
  });
});
