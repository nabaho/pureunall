/* 기금출연확인서의 「금 액」 — 참여사업장의 그 해 출연금에서 받아 넣는다
 *
 * 대표 지시 2026-09-19
 *   「한페이지에 한개 회사 이다. 그리고 금액은 기금정보에서 받아서 넣는다.」
 *   (물어보고 정한 것: 사업장별 출연금 · 참여사업장 전부 한 장씩)
 *
 * 왜 비어 나갔나: siteContribOf 는 «기본 출연금»과 «사람수 × 단가»만 봤다.
 * 이미 세운 기금은 출연금을 해마다 참여사업장 › 연도별 기록에 적는데, 확인서가
 * 그 칸을 안 봐서 열여섯 곳 금액을 다 적어 두고도 밑줄로 나갔다.
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 여기 이름·금액은 전부 가짜다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'fund.html'), 'utf8');

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

/* ══════════ ① 금액 셈하기 ══════════ */

const AMT = (() => {
  const box = {};
  new Function([
    'var _ROK=null;',
    'function num(v){ if(v===""||v==null) return ""; var n=Number(String(v).replace(/,/g,"")); return isFinite(n)?n:""; }',
    'function _docRok(){ return _ROK; }',
    grabFn('siteContribOf'),
    grabFn('siteContribNow'),
    'this.set=function(r){ _ROK=r; };',
    'this.now=siteContribNow;',
    'this.base=siteContribOf;',
  ].join('\n')).call(box);
  return box;
})();

test('★ 그 해 출연금이 «가장 먼저»다 — 열여섯 곳 금액을 적어 두고도 밑줄로 나갔다', () => {
  AMT.set({ sy: { s1: { contrib: 30000000 } } });
  assert.equal(AMT.now({ _id: 's1', contrib: 10000000 }, {}), 30000000);
});

test('그 해 기록이 없으면 사업장 명부의 기본 출연금', () => {
  AMT.set({ sy: { s9: { contrib: 5000000 } } });
  assert.equal(AMT.now({ _id: 's1', contrib: 10000000 }, {}), 10000000);
});

test('둘 다 없으면 상시근로자수 × 1인당 출연단가', () => {
  AMT.set(null);
  assert.equal(AMT.now({ _id: 's1', company_size: 20 }, { contrib_per_worker: 50000 }), 1000000);
});

test('★ 아무것도 없으면 0 — 금액을 지어내지 않는다', () => {
  AMT.set(null);
  assert.equal(AMT.now({ _id: 's1' }, {}), 0);
  assert.equal(AMT.now(null, null), 0);
});

test('★ 장부를 못 읽었으면 조용히 약정액으로 내려간다 — 화면이 멎지 않는다', () => {
  AMT.set(null);                                    // _docRok() 가 null 인 상태
  assert.equal(AMT.now({ _id: 's1', contrib: 7000000 }, {}), 7000000);
});

test('★ 남의 기금·남의 해 숫자를 쓰지 않는다 — 대조는 _docRok 이 한다', () => {
  const fn = grabFn('siteContribNow');
  assert.match(fn, /_docRok\(\)/, '기금·연도를 대조하는 _docRok 을 거쳐야 한다');
  assert.ok(!/S\._docR\b/.test(fn), 'S._docR 을 바로 보면 대조를 건너뛴다');
});

test('종전 함수(siteContribOf)는 그대로 둔다 — 엑셀본이 같은 것을 본다', () => {
  assert.equal(AMT.base({ contrib: 10000000 }, {}), 10000000);
  assert.equal(AMT.base({ company_size: 20 }, { contrib_per_worker: 50000 }), 1000000);
});

/* ══════════ ② 배선 — 안 이으면 조용히 빈 채로 나간다 ══════════ */

test('★★ 확인서가 장부를 읽도록 DOC_NEEDS_LEDGER 에 들어 있다', () => {
  const decl = grabDecl('DOC_NEEDS_LEDGER');
  assert.match(decl, /contrib:1/, '여기 없으면 site_years 를 아예 안 읽는다 — 금액이 늘 밑줄이다');
});

test('★ 확인서가 siteContribNow 로 금액을 셈한다', () => {
  const fn = grabFn('fillFoundContribDoc');
  assert.match(fn, /siteContribNow\(c,f\)/, '금액 자리');
  assert.match(fn, /siteContribNow\(x,f\)/, '몇 곳이 비었는지 세는 자리도 같은 함수여야 한다');
  assert.ok(!/siteContribOf\(/.test(fn), '한 서식 안에서 두 가지로 셈하면 안 된다');
});

test('★ 빈 곳이 있으면 «어느 칸»을 채우면 되는지 짚어 준다', () => {
  const fn = grabFn('fillFoundContribDoc');
  assert.match(fn, /연도별 기록/, '그 해 출연금 칸을 알려 줘야 한다');
  assert.match(fn, /1인당 출연단가/, '단가 칸도 알려 줘야 한다');
});

test('★ 지원신청서는 «사람수 × 단가»로 내려가지 않는다 — 공단이 셈하는 근거다', () => {
  const h = grabFn('docBody');
  const at = h.indexOf("if(kind==='subsidy')");
  assert.ok(at >= 0, '지원신청서 가지를 못 찾았다');
  const blk = h.slice(at, at + 1200);
  assert.match(blk, /var _c2=function\(s\)\{ return num\(\(_sy2\[s\._id\]\|\|\{\}\)\.contrib\)\|\|num\(s\.contrib\)\|\|0; \};/,
    '어림한 수를 지원신청서에 적으면 안 된다');
});

/* ══════════ ③ 한 장에 한 회사 ══════════ */

test('★ 사업장마다 한 장 — 둘째 장부터 쪽을 나눈다', () => {
  const fn = grabFn('fillFoundContribDoc');
  assert.match(fn, /made\.forEach\(function\(x,i\)\{ if\(i\) x\.setAttribute\('data-newpage','1'\); \}\);/,
    '첫 장에 붙이면 맨 앞에 빈 장이 하나 생긴다');
  assert.match(fn, /list\.length\?list\.map\(one\):\[one\(null\)\]/, '탈퇴하지 않은 사업장 전부다');
});

test('금액이 없어도 장을 만든다 — 회사·대표자만이라도 찍어 준다', () => {
  const fn = grabFn('fillFoundContribDoc');
  assert.ok(!/filter\([^)]*siteContrib[^)]*\)\.map\(one\)/.test(fn), '금액 있는 곳만 고르면 안 된다');
});

/* ══════════ ④ 검사기에도 실렸는가 ══════════ */

test('★★ jsdom 검사도 새 함수를 실어야 한다 — 없으면 CI 에서만 통째로 죽는다', () => {
  ['check_derived.js', 'check_forms.js'].forEach((f) => {
    const t = fs.readFileSync(path.join(ROOT, 'fund-erp', 'tools', f), 'utf8');
    assert.ok(t.indexOf("gF('siteContribNow')") >= 0, f + ' 에 siteContribNow 가 없다');
    assert.ok(t.indexOf("gF('_docRok')") >= 0, f + ' 에 _docRok 이 없다 — siteContribNow 가 부른다');
  });
});

test('★ 엑셀본도 같은 자로 셈한다 — 한쪽만 옮기면 두 확인서의 금액이 달라진다', () => {
  const fn = grabFn('fillContribXls');
  assert.match(fn, /siteContribNow\(s,f\)/);
  assert.ok(!/siteContribOf\(/.test(fn), '엑셀본이 옛 셈법에 남아 있다');
});

test('★ 설립 빈칸 표도 그 해 출연금을 인정한다 — 채워 둔 것을 「비었다」고 하면 안 된다', () => {
  const decl = grabDecl('ESTAB_NEED_SITE');
  assert.match(decl, /siteContribNow\(s,f\)<=0/);
});

test('같은 이름 함수를 두 번 선언하지 않았다', () => {
  const c = (SRC.match(/function siteContribNow\(/g) || []).length;
  assert.equal(c, 1, 'siteContribNow 가 ' + c + '번 선언돼 있다');
});
