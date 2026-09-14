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
    grabFn('_siteWrep'), grabFn('_siteUrep'),
    grabFn('_isCommittee'), grabFn('_siteCommittee'), grabFn('_prepCommittee'), grabFn('_cmOver'),
    grabFn('_cmAnnexNeeded'), grabFn('_cmSeeAnnex'), grabFn('committeeAnnexHTML'),
    'this.prep=_prepCommittee; this.over=_cmOver; this.need=_cmAnnexNeeded;',
    'this.see=_cmSeeAnnex; this.annex=committeeAnnexHTML; this.ROWS=COMMITTEE_ROWS;',
    'this.fromSites=_siteCommittee; this.urep=_siteUrep;'
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

/* ══ ①-2 참여사업장의 대표가 그대로 위원이다 (대표 지시 2026-09-14) ══════
   「사용자대표와 근로자 대표를 입력하면 자동으로 서류작성에서 이 사람들의 이름이
    자동으로 동기화되게 해라」
   ★ 종전에는 등기임원명부에만 있는 사람이 위원이었다 — 사업장마다 대표를 적어 두고도
     명부에 «또» 옮겨 적어야 서식에 나왔다(열여섯 곳이면 서른두 번이다). */

const 사업장들 = [
  { name: '가나산업', ceo: '홍길동', urep_name: '사용자가', urep_title: '상무',
    wrep_name: '근로자가', wrep_title: '대리', wrep_birth: '1980-01-01' },
  { name: '다라전자', ceo: '김철수', urep_same: true, urep_title: '대표이사',
    wrep_name: '근로자나', wrep_title: '과장' },
  { name: '마바디자인', ceo: '이영희', wrep_name: '', urep_name: '' },       /* 안 적은 곳 */
  { name: '나간회사', ceo: '박대표', status: 'closed', urep_name: '나간사람', wrep_name: '나간노측' }
];

test('★★ ①-2 사업장에 적은 사용자대표·근로자대표가 그대로 위원이 된다', () => {
  const b = 상자();
  const u = b.prep({}, '사용자측', 사업장들).map((o) => o.name);
  const w = b.prep({}, '근로자측', 사업장들).map((o) => o.name);
  assert.deepEqual(u, ['사용자가', '김철수'],
    '★ 사업장 대표가 서식에 안 들어갑니다 — 명부에 또 옮겨 적어야 합니다.');
  assert.deepEqual(w, ['근로자가', '근로자나']);
  /* 「대표자와 같음」을 켜 둔 곳은 대표자 이름이 들어간다 */
  assert.equal(b.urep(사업장들[1]).name, '김철수', '★ 대표자와 같음이 안 따라갑니다.');
});

test('★★ ①-3 안 적은 곳·나간 곳은 «세지 않는다» — 빈 위원이 생기면 명수가 틀린다', () => {
  const b = 상자();
  assert.ok(!b.prep({}, '사용자측', 사업장들).some((o) => !o.name), '★ 이름 없는 위원이 생겼습니다.');
  assert.ok(!b.prep({}, '사용자측', 사업장들).some((o) => o.name === '나간사람'),
    '★ 탈퇴한 사업장 사람이 위원으로 들어갑니다.');
  assert.ok(!b.prep({}, '근로자측', 사업장들).some((o) => o.name === '나간노측'));
  assert.equal(b.fromSites(null, '사용자측').length, 0, '★ 사업장이 없으면 터집니다.');
  /* ⚠ 「_prepCommittee 가 어차피 거른다」에 기대지 않는다 — _siteCommittee 자체가
     빈 사람을 내놓으면, 이것을 따로 쓰는 다음 자리에서 빈 줄이 생긴다. */
  assert.ok(!b.fromSites(사업장들, '사용자측').some((o) => !o.name),
    '★ 이름 없는 사람을 내놓습니다.');
  assert.equal(b.fromSites(사업장들, '사용자측').length, 2);
  assert.equal(b.fromSites(사업장들, '근로자측').length, 2);
});

test('★★ ①-4 명부와 사업장에 «다 있는» 사람은 한 번만 센다 — 두 줄이면 명수가 부푼다', () => {
  const b = 상자();
  const f = { officers: [{ role: '근로자측 이사', name: '근로자가', title: '대리' },
    { role: '근로자측 이사', name: '따로적은이', title: '차장' }] };
  const w = b.prep(f, '근로자측', 사업장들).map((o) => o.name);
  assert.deepEqual(w, ['근로자가', '따로적은이', '근로자나'],
    '★ 같은 사람이 두 번 셉니다 — 「이사 선임 : 각 ○ 명」이 틀린 채로 나갑니다.');
  /* 빈칸이 섞인 이름도 같은 사람으로 본다 */
  assert.equal(b.prep({ officers: [{ role: '근로자측 이사', name: '근로 자가' }] },
    '근로자측', 사업장들).length, 2, '★ 빈칸 하나로 같은 사람이 둘이 됩니다.');
});

test('★★ ①-5 별지에 «어느 사업장 사람»인지 적는다 — 예순 명이면 소속 없이는 못 가린다', () => {
  const ax = 상자().annex({ name: 'x' }, 사업장들);
  assert.ok(ax.indexOf('가나산업') >= 0 && ax.indexOf('다라전자') >= 0, '★ 소속이 빠졌습니다.');
  assert.match(ax, /근로자측 2명 · 사용자측 2명/, '★ 명수가 틀립니다.');
});

test('★★ ①-6 서식을 채우는 자리가 «모두» 사업장을 함께 본다 — 한 곳만 빠져도 그 서식만 비뚤어진다', () => {
  const 코드 = 코드만(SRC);
  const 남은 = (코드.match(/_prepCommittee\(f,[^,)]+\)/g) || [])
    .concat(코드.match(/_cmAnnexNeeded\(f\)/g) || [])
    .concat(코드.match(/_cmSeeAnnex\(f,side\)/g) || [])
    .concat(코드.match(/committeeAnnexHTML\(f\)/g) || []);
  assert.deepEqual(남은, [],
    '★ 사업장을 안 넘기는 자리가 남았습니다: ' + 남은.join(' · '));
  /* ⚠ «빈 것을 넘기는» 것도 안 넘기는 것과 같다 — 원본 .hwp 길만 사업장을 못 보면
     초안에는 사업장 대표가 들어가고 정작 제출본에는 안 들어간다. */
  assert.match(코드, /fillCommittee\(d,f,sites\);/, '★ 원본 .hwp 길이 사업장을 못 봅니다.');
  assert.ok(!/fillCommittee\(d,f,\[\]\)/.test(코드), '★ 빈 목록을 넘깁니다.');
  assert.ok(!/_prepCommittee\(f,side,\[\]\)/.test(코드), '★ 세는 자리가 빈 목록을 넘깁니다.');
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
    grabFn('_siteWrep'), grabFn('_siteUrep'),
    grabFn('_isCommittee'), grabFn('_siteCommittee'), grabFn('_prepCommittee'), grabFn('_cmOver'),
    grabFn('_cmAnnexNeeded'), grabFn('_cmSeeAnnex'), grabFn('committeeAnnexHTML'),
    grabFn('fillCommittee'),
    'fillCommittee(root,f,(f&&f._sites)||[]);'
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
  assert.match(fn, /if\(_cmAnnexNeeded\(f,sites\)\)\{/, '★ 원본 서식 길에 별지가 안 붙습니다.');
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
  assert.match(fn, /<div data-newpage='1'>"\+committeeAnnexHTML\(f,sites\)/, '★ 초안에 별지가 안 붙습니다.');
  /* 안 넘치면 별지도 첨부서류 줄도 없다 */
  assert.match(fn, /_cmAnnexNeeded\(f,sites\)\?"<br>5\./, '★ 두 명뿐인 기금에도 별지를 적습니다.');
});

test('★★ ⑩ 회의록은 이름 대신 «명수»를 적는다 — 예순 명을 한 줄로 늘어놓을 수 없다', () => {
  const fn = 코드만(grabFn('docBody'));
  assert.match(fn, /L\.length>COMMITTEE_ROWS/, '★ 회의록이 넘침을 안 봅니다.');
  assert.match(fn, /L\.length\+'명\('\+esc\(_cmSeeAnnex\(f,side,sites\)\)\+'\)'/,
    '★ 회의록에 이름 예순 개가 한 줄로 들어갑니다.');
});

test('★★ ⑪ 「이사 선임 : 각 ○ 명」이 진짜 명수로 찍힌다 — 늘 3이었다', () => {
  assert.equal(상자().prep(많은기금, '근로자측').length, 62,
    '★ 회의록의 「각 ○ 명」이 또 3으로 찍힙니다.');
  /* 세는 자리가 _prepCommittee 를 쓰는지 — 참여사업장까지 함께 세야 한다 */
  const fill = 코드만(SRC.slice(SRC.indexOf('var nSide=function(side)'), SRC.indexOf('var nSide=function(side)') + 260));
  assert.match(fill, /_prepCommittee\(f,side,sites\)\.length/, '★ 다른 곳에서 따로 셉니다.');
});
