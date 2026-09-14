'use strict';
/* 설립준비위원회 위원 명단을 별지로 (대표 지시 2026-09-14)
 *
 *   「기금 설립준비위원회 위원이 60명 이상 근로자 사용자로 되는경우가 많다.
 *    따라서 성명을 별도의 페이지로 분리할 필요가 있다.」
 *
 * ★ 원본 별지 제7호의 위원 격자는 «측마다 세 줄»뿐이다.
 * ⚠ 종전에는 _prepCommittee 가 .slice(0,3) 을 했다 — 예순 명이어도 서식에는 셋만 나가고
 *   나머지가 «말없이» 빠졌다. 그대로 관청에 내면 위원회 구성이 틀린 서류가 된다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
/* ⚠ 글자로 훑을 때는 주석을 먼저 걷는다 — 이 파일 주석이 지시를 그대로 인용하고 있다 */
const 코드만 = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
const 줄수 = (m) => (/var COMMITTEE_ROWS=(\d+);/.exec(SRC) || [])[1];

function 상자() {
  const box = {};
  new Function([
    'function esc(s){ return String(s==null?"":s); }',
    'function _officersOf(f){ return (f&&f.officers)||[]; }',
    (/var COMMITTEE_ROWS=\d+;/.exec(SRC) || [''])[0],
    grabFn('_isCommittee'), grabFn('_prepCommittee'), grabFn('_cmOver'),
    grabFn('_cmAnnexNeeded'), grabFn('_cmSeeAnnex'), grabFn('committeeAnnexHTML'),
    'this.prep=_prepCommittee; this.over=_cmOver; this.need=_cmAnnexNeeded;',
    'this.see=_cmSeeAnnex; this.annex=committeeAnnexHTML; this.ROWS=COMMITTEE_ROWS;'
  ].join('\n')).call(box);
  return box;
}
const 많은기금 = {
  name: '가짜공동근로복지기금',
  officers: [].concat(
    Array.from({ length: 62 }, (_, i) => ({ role: '근로자측 이사', name: '노' + i,
      birth: '', title: '대리', company: '가나산업' })),
    Array.from({ length: 58 }, (_, i) => ({ role: '사용자측 이사', name: '사' + i,
      birth: '', title: '이사', company: '다라전자' })),
    [{ role: '이사장', name: '홍길동' }, { role: '근로자측 감사', name: '감사람' }])
};
const 적은기금 = { name: '작은기금',
  officers: [{ role: '근로자측 이사', name: '노가', title: '대리' },
    { role: '사용자측 이사', name: '사가', title: '이사' }] };

/* ══ ① 자르지 않는다 ═══════════════════════════════════════════════ */

test('★★ ① 세는 쪽은 «전부»를 본다 — 예순둘이면 예순둘이다', () => {
  const b = 상자();
  assert.equal(b.prep(많은기금, '근로자측').length, 62,
    '★ 또 잘랐습니다 — 서식에 셋만 나가고 나머지가 말없이 빠집니다.');
  assert.equal(b.prep(많은기금, '사용자측').length, 58);
  /* 감사는 위원이 아니고, 이사장은 «측»이 자료에 없어 넣지 않는다 — 종전 규칙 그대로 */
  assert.ok(!b.prep(많은기금, '근로자측').some((o) => /감사/.test(o.name)), '★ 감사가 위원에 들어갔습니다.');
  assert.ok(!b.prep(많은기금, '사용자측').concat(b.prep(많은기금, '근로자측'))
    .some((o) => o.name === '홍길동'), '★ 이사장을 한쪽에 밀어 넣었습니다.');
});

test('★★ ② 격자 줄 수는 «한 곳»에 적혀 있다 — 서식과 검사가 따로 셋을 알면 갈린다', () => {
  assert.equal(줄수(), '3', '원본 격자는 측마다 세 줄이다');
  assert.equal(상자().ROWS, 3);
  /* 그리는 쪽이 그 값을 «쓰는지» — 3 을 손으로 박아 두면 격자가 바뀔 때 어긋난다 */
  assert.match(코드만(grabFn('fillCommittee')), /k<COMMITTEE_ROWS/, '★ 줄 수를 손으로 박았습니다.');
  assert.match(코드만(grabFn('docBody')), /list\.length>COMMITTEE_ROWS/, '★ 초안이 다른 잣대를 씁니다.');
});

test('★ ③ 넘치는지 아는 길이 하나다', () => {
  const b = 상자();
  assert.equal(b.over(많은기금, '근로자측'), true);
  assert.equal(b.over(적은기금, '근로자측'), false);
  assert.equal(b.need(많은기금), true);
  assert.equal(b.need(적은기금), false, '★ 두 명뿐인데 별지를 붙입니다.');
  assert.equal(b.need({}), false, '★ 명부가 없는데 별지를 붙입니다.');
});

/* ══ ② 별지 ══════════════════════════════════════════════════════ */

test('★★ ④ 별지에 «한 사람도 빠짐없이» 나온다 — 여기가 진짜 명단이다', () => {
  const ax = 상자().annex(많은기금);
  assert.ok(ax.includes('>노0<') && ax.includes('>노61<'), '★ 근로자측 끝 사람이 빠졌습니다.');
  assert.ok(ax.includes('>사0<') && ax.includes('>사57<'), '★ 사용자측 끝 사람이 빠졌습니다.');
  const n = (ax.match(/<tr>/g) || []).length - 1;              // 머리줄 제외
  assert.equal(n, 120, '★ 별지에 ' + n + '줄뿐입니다 — 120명이어야 합니다.');
  /* 측마다 번호를 새로 매긴다 — 관청이 측별로 센다 */
  assert.match(ax, /<td class='center'>근로자측<\/td><td class='center'>1<\/td>/, '★ 번호를 측마다 안 매깁니다.');
  assert.match(ax, /<td class='center'>사용자측<\/td><td class='center'>1<\/td>/, '★ 사용자측 번호가 이어집니다.');
  assert.match(ax, /근로자측 62명 · 사용자측 58명/, '★ 몇 명인지 적지 않습니다.');
  assert.ok(ax.indexOf('가짜공동근로복지기금') >= 0, '★ 어느 기금의 명단인지 안 적었습니다.');
});

test('★★ ⑤ 없는 값을 «지어내지 않는다» — 이 명단이 그대로 노동청에 간다', () => {
  const ax = 상자().annex(많은기금);
  /* 생년월일이 명부에 없으면 빈칸이다(개인정보라 안 담는 곳이 있다) */
  assert.ok(!/19\d\d|20\d\d-/.test(ax.replace(/62명|58명/g, '')), '★ 생년월일을 지어냈습니다.');
  const fn = 코드만(grabFn('committeeAnnexHTML'));
  assert.ok(fn.indexOf('BAKE_BLANK') < 0 && !/dgV\(/.test(fn),
    '★ 빈칸을 밑줄로 채웠습니다 — 명단은 있는 것만 적습니다.');
  /* 한쪽이 비어도 터지지 않고, 비었다고 말한다 */
  const 한쪽 = 상자().annex({ name: 'x', officers: 많은기금.officers.filter((o) => /근로자측 이사/.test(o.role)) });
  assert.match(한쪽, /명부에 등록된 위원이 없습니다/, '★ 사용자측이 비었는데 아무 말이 없습니다.');
});

/* ══ ③ 앞장 ══════════════════════════════════════════════════════ */

/* ★ 원본 별지 제7호의 위원 격자를 «그대로» 세우고 fillCommittee 를 진짜로 돌린다.
   글자로 훑으면 「어느 줄 어느 칸에 무엇이 들어갔는지」를 끝내 알 수 없다. */
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }
function 격자채우기(f) {
  const 줄 = (라벨) => '<tr><td>' + (라벨 || '') + '</td><td>성명</td><td></td><td>생년월일</td><td></td><td>직책</td><td></td></tr>';
  const dom = new JSDOM('<table><tbody>'
    + 줄('근로자측') + 줄('') + 줄('')
    + 줄('사용자측') + 줄('') + 줄('') + '</tbody></table>');
  const doc = dom.window.document, root = doc.body;
  const box = {};
  new Function('document', 'root', 'f', [
    'function esc(s){ return String(s==null?"":s); }',
    'function _officersOf(x){ return (x&&x.officers)||[]; }',
    (/var COMMITTEE_ROWS=\d+;/.exec(SRC) || [''])[0],
    grabFn('_isCommittee'), grabFn('_prepCommittee'), grabFn('_cmOver'),
    grabFn('_cmAnnexNeeded'), grabFn('_cmSeeAnnex'), grabFn('committeeAnnexHTML'),
    grabFn('fillCommittee'),
    'fillCommittee(root,f);'
  ].join('\n')).call(box, doc, root, f);
  return { root, 줄들: [].slice.call(root.querySelectorAll('tr')) };
}

test('★★ ⑥ 앞장에는 이름을 «흘리지 않는다» — 셋만 찍히면 다 찬 것처럼 보인다', (t) => {
  assert.equal(상자().see(많은기금, '근로자측'), '별지 명단과 같음(근로자측 62명)');
  if (!JSDOM) return t.skip('jsdom 없음');
  const { 줄들, root } = 격자채우기(많은기금);
  /* ⚠ 칸 사이 빈칸이 섞이므로 빈칸을 걷고 견준다 — 기대값에서도 걷는다 */
  const 글 = (tr) => (tr.textContent || '').replace(/\s/g, '');
  const 같음 = (side, n) => new RegExp(('별지 명단과 같음(' + side + ' ' + n + '명)').replace(/\s/g, '')
    .replace(/[()]/g, (c) => '\\' + c));
  assert.match(글(줄들[0]), 같음('근로자측', 62), '★ 첫 줄에 「별지 명단과 같음」이 없습니다.');
  /* ★ 둘째·셋째 줄은 «비어» 있어야 한다 — 여기에 이름이 흘러들면 예순둘 중 셋만 찍힌 채
       서식이 다 찬 것처럼 보인 채로 관청에 나간다. */
  [1, 2].forEach((k) => {
    assert.ok(!/노\d/.test(글(줄들[k])), '★ ' + (k + 1) + '째 줄에 이름이 흘러들었습니다: ' + 글(줄들[k]));
  });
  assert.match(글(줄들[3]), 같음('사용자측', 58), '★ 사용자측 첫 줄이 비었습니다.');
  [4, 5].forEach((k) => assert.ok(!/사\d/.test(글(줄들[k])), '★ 사용자측에도 이름이 흘렀습니다.'));
  /* 위원 격자에는 표를 남겨 아래 라벨 채우기가 덮어쓰지 않게 한다(종전 규칙) */
  [0, 1, 2, 3, 4, 5].forEach((k) => assert.equal(줄들[k].getAttribute('data-cm'), '1',
    '★ 위원 격자 표시가 빠졌습니다 — 「생년월일」 라벨이 대표자란 값으로 덮입니다.'));
  /* 별지가 붙었는가 */
  assert.match(root.innerHTML, /설립준비위원회 위원 명단/, '★ 별지가 안 붙었습니다.');
  assert.ok(root.innerHTML.indexOf('노61') >= 0, '★ 별지에 끝 사람이 없습니다.');
});

test('★★ ⑥-2 격자에 «들어가는» 수면 종전처럼 이름을 그대로 적는다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const { 줄들, root } = 격자채우기(적은기금);
  const 글 = (tr) => (tr.textContent || '').replace(/\s/g, '');
  assert.match(글(줄들[0]), /노가/, '★ 두 명뿐인데 이름이 안 들어갑니다.');
  assert.match(글(줄들[0]), /대리/, '★ 직책이 빠졌습니다.');
  assert.match(글(줄들[3]), /사가/, '★ 사용자측 이름이 안 들어갑니다.');
  assert.ok(!/별지/.test(글(줄들[0])), '★ 두 명뿐인데 「별지와 같음」이라 적었습니다.');
  assert.ok(root.innerHTML.indexOf('설립준비위원회 위원 명단') < 0,
    '★ 두 명뿐인데 별지를 붙였습니다 — 쓸데없는 장이 한 장 더 나갑니다.');
});

test('★★ ⑦ 별지를 «뒷장»에 붙인다 — 앞장 꼬리에 붙으면 별지가 아니다', () => {
  const fn = 코드만(grabFn('fillCommittee'));
  assert.match(fn, /if\(_cmAnnexNeeded\(f\)\)\{/, '★ 원본 서식 길에 별지가 안 붙습니다.');
  assert.match(fn, /setAttribute\('data-newpage','1'\)/, '★ 새 장에서 시작하지 않습니다.');
  assert.match(fn, /setAttribute\('data-kept','1'\)/,
    '★ 걷어내기가 별지를 도로 지울 수 있습니다.');
  /* 쪽 나누기가 그 표시를 «정말» 아는가 */
  const pg = 코드만(grabFn('paginateDoc'));
  assert.match(pg, /getAttribute\('data-newpage'\) && body\.childNodes\.length/,
    '★ 쪽 나누기가 표시를 모릅니다 — 별지가 앞장 꼬리에 붙습니다.');
  assert.match(pg, /no\+\+; page=_a4Page\(no\)/, '★ 새 장을 안 엽니다.');
});

test('★ ⑧ 이미 빈 장이면 «빈 장을 더 만들지 않는다»', () => {
  assert.match(코드만(grabFn('paginateDoc')), /data-newpage'\) && body\.childNodes\.length\)/,
    '★ 빈 장 뒤에 또 빈 장을 만듭니다.');
});

test('★★ ⑨ 초안(자동생성본)도 같게 — 첨부서류에 별지를 적는다', () => {
  const fn = 코드만(grabFn('docBody'));
  assert.match(fn, /5\. 설립준비위원회 위원 명단 1부\(별지\)/,
    '★ 첨부서류에 안 적습니다 — 붙여 놓고 말하지 않으면 빠뜨립니다.');
  assert.match(fn, /<div data-newpage='1'>"\+committeeAnnexHTML\(f\)/, '★ 초안에 별지가 안 붙습니다.');
  /* 안 넘치면 별지도 첨부서류 줄도 없다 */
  assert.match(fn, /_cmAnnexNeeded\(f\)\?"<br>5\./, '★ 두 명뿐인 기금에도 별지를 적습니다.');
});

test('★★ ⑩ 회의록은 이름 대신 «명수»를 적는다 — 예순 명을 한 줄로 늘어놓을 수 없다', () => {
  const fn = 코드만(grabFn('docBody'));
  assert.match(fn, /L\.length>COMMITTEE_ROWS/, '★ 회의록이 넘침을 안 봅니다.');
  assert.match(fn, /L\.length\+'명\('\+esc\(_cmSeeAnnex\(f,side\)\)\+'\)'/,
    '★ 회의록에 이름 예순 개가 한 줄로 들어갑니다.');
});

test('★★ ⑪ 「이사 선임 : 각 ○ 명」이 진짜 명수로 찍힌다 — 늘 3이었다', () => {
  const box = {};
  new Function([
    'function _officersOf(f){ return (f&&f.officers)||[]; }',
    grabFn('_isCommittee'), grabFn('_prepCommittee'),
    'this.n=function(f,side){ return _prepCommittee(f,side).length; };'
  ].join('\n')).call(box);
  assert.equal(box.n(많은기금, '근로자측'), 62,
    '★ 회의록의 「각 ○ 명」이 또 3으로 찍힙니다.');
  /* 세는 자리가 _prepCommittee 를 쓰는지 */
  const fill = 코드만(SRC.slice(SRC.indexOf('var nSide=function(side)'), SRC.indexOf('var nSide=function(side)') + 260));
  assert.match(fill, /_prepCommittee\(f,side\)\.length/, '★ 다른 곳에서 따로 셉니다.');
});
