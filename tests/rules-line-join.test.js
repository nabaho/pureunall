/* 낱말 한가운데서 끊긴 줄 잇기 (대표 승인 목업 docs/mockups/2026-09-13-줄잇기.html)

   ■ 무엇이 문제였나
   한글에서 글자를 뽑으면 «눈에 보이는 줄바꿈»이 진짜 줄바꿈으로 딸려 들어온다.
   한글은 낱말 한가운데서도 줄을 끊으므로 「배포·게⏎시」·「배상하여야 한⏎다」가 된다.
   ★★ 화면만의 일이 아니다 — 그대로 신구대조표·전문에 실려 노동청에 내는 서류에도
     낱말이 잘려 나간다. 대표님 실제 파일(101조·24,014자)에서 **206곳**이었다.

   ■ 잣대는 «문서 자신»이다 — 바깥 사전을 쓰지 않는다
     ㉠ 붙인다  「근로조건」이 있고 「근」이 혼자 쓰인 적이 없다      (실측 54곳)
     ㉡ 띄운다  「외출로」가 혼자 쓰이는 완성된 낱말이다             (실측 105곳)
     ㉢ 묻는다  둘 다 쓰여 문서가 답을 안 준다                      (실측 47곳)

   ■ 지키는 규칙
     ① ★★ 글자를 «잃지 않는다» — 잇기는 줄바꿈을 없애거나 빈칸으로 바꿀 뿐이다
     ② ★★ 조문 구역 «밖»은 안 건드린다 — 표지의 개정이력 표와 부칙이 거기 있다.
        잘못 이으면 표가 한 줄로 뭉친다(대표가 걱정하신 그것이다)
     ③ 항(①②③)·호(1. 2.)·목(가. 나.)·조·장·절 머리는 안 잇는다 — 진짜 구분이다
     ④ 문장이 끝난 줄은 안 잇는다
     ⑤ ★ 모르면 «묻는다». 기본은 «그대로»다 — 사람이 안 보면 한 글자도 안 바뀐다
   실행: node --test tests/rules-line-join.test.js */
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
  ['function lineJoinMarks(', 'function lineJoinApply(', 'function lineJoinCount(']
    .forEach(function (d) { vm.runInContext(cut(d), ctx); });
  return ctx;
}
const 이어라 = (c, t) => c.lineJoinApply(t, c.lineJoinMarks(t));

/* 실제 파일과 «같은 모양»으로 손수 지은 글 — 업체 자료를 쓰지 않는다.
   표지(개정이력 표) → 조문 → 부칙 의 세 구역이 다 들어 있다. */
const 글 = [
  '취업규칙',
  'No. 제(개)정일 시행일 개정이력',
  '001 2011 년 10',                                   /* 표 — 건드리면 안 된다 */
  '월 01 일 제정',
  '제1장 총칙',
  '제1조(목적) 이 규칙은 사원의 채용·복무 및 근',      /* ㉠ 붙임 — 아래에 「근로조건」이 또 있다 */
  '로조건 등에 관한 사항을 정함을 목적으로 한다.',
  '제2조(적용범위) 이 규칙은 근로조건에 관하여 다음 각 호와 같이 적용한다.',
  '① 정규직 사원',
  '② 단시간 사원',
  '제3조(외출) 허가 없이 회사를 떠나는 경우 무단 외출로',   /* ㉡ 띄움 — 「외출로」가 혼자 쓰인다 */
  '간주한다. 외출로 인한 책임은 사원이 진다.',
  '제4조(책임) 사원은 그 손해를 배상하여야 한',        /* ㉠ 붙임 — 「한다」가 딴 곳에 있다 */
  '다.',
  '부  칙',
  '이 규칙은 2026 년 1 월 1',                          /* 부칙 뒤 — 건드리면 안 된다 */
  '일부터 시행한다.'
].join('\n');

/* ══════ ① 글자를 잃지 않는다 ══════ */

test('★★★ 이어 붙여도 «글자를 잃지 않는다» — 줄바꿈만 없어지거나 빈칸이 된다', () => {
  const c = 판();
  const 뒤 = 이어라(c, 글);
  const 셈 = (s) => s.replace(/[\s]/g, '');
  assert.equal(셈(뒤), 셈(글), '★★★ 글자가 바뀌었습니다 — 잇기는 줄바꿈만 건드려야 합니다');
});

/* ══════ ② 조문 구역 밖은 안 건드린다 ══════ */

test('★★★ 표지의 개정이력 «표»는 안 건드린다 — 이으면 표가 한 줄로 뭉친다', () => {
  const c = 판();
  const 뒤 = 이어라(c, 글);
  assert.match(뒤, /001 2011 년 10\n월 01 일 제정/,
    '★★★ 표가 이어졌습니다 — 제1조 앞은 손대면 안 됩니다');
});

test('★★ 부칙 뒤도 안 건드린다', () => {
  const c = 판();
  const 뒤 = 이어라(c, 글);
  assert.match(뒤, /2026 년 1 월 1\n일부터 시행한다/, '부칙 뒤가 이어졌습니다');
});

/* ══════ ③ 진짜 줄바꿈은 그대로 ══════ */

test('★★ 항(①②③)으로 시작하는 줄은 «안» 잇는다 — 이으면 항이 뭉친다', () => {
  const c = 판();
  const 뒤 = 이어라(c, 글);
  assert.match(뒤, /① 정규직 사원\n② 단시간 사원/, '항이 이어졌습니다');
});

test('★ 조·장 머리는 «안» 잇는다', () => {
  const c = 판();
  const 뒤 = 이어라(c, 글);
  assert.match(뒤, /\n제1장 총칙\n/, '장 머리가 이어졌습니다');
  assert.match(뒤, /\n제2조\(적용범위\)/, '조 머리가 이어졌습니다');
});

test('★ 문장이 끝난 줄은 «안» 잇는다', () => {
  const c = 판();
  const ms = c.lineJoinMarks(글);
  const 끝난줄 = ms.filter(function (m) { return /목적으로 한다\.$/.test(m.앞 || ''); });
  끝난줄.forEach(function (m) {
    assert.equal(m.뜻, '그대로', '문장이 끝났는데 이으려 합니다');
  });
});

/* ══════ ④ 문서 자신에게 묻는다 ══════ */

test('★★★ 문서가 «붙여 쓴» 낱말이면 붙인다 — 근⏎로조건 → 근로조건', () => {
  const c = 판();
  const 뒤 = 이어라(c, 글);
  assert.match(뒤, /채용·복무 및 근로조건 등에 관한/,
    '★★★ 안 붙었습니다: ' + JSON.stringify(뒤.slice(뒤.indexOf('채용'), 뒤.indexOf('채용') + 40)));
});

test('★★★ 문서가 «띄어 쓴» 낱말이면 띄운다 — 외출로⏎간주한다 → 외출로 간주한다', () => {
  const c = 판();
  const 뒤 = 이어라(c, 글);
  assert.match(뒤, /무단 외출로 간주한다/,
    '★★★ 안 띄었습니다: ' + JSON.stringify(뒤.slice(뒤.indexOf('무단'), 뒤.indexOf('무단') + 30)));
});

test('★★ 문서가 답을 안 주면 «묻는다» — 멋대로 정하지 않는다', () => {
  const c = 판();
  const 묻 = [
    '제1조(목적) 사원은 다음 각 호에 따라 포',
    '함하여 처리한다. 포장 및 포대는 별도로 정한다.'
  ].join('\n');
  const ms = c.lineJoinMarks(묻);
  const 물음 = ms.filter(function (m) { return m.뜻 === '물음'; });
  assert.ok(물음.length >= 1, '답이 갈리는데 혼자 정했습니다: ' + JSON.stringify(ms));
  assert.ok(물음[0].추천, '추천을 안 내놓습니다 — 사람이 맨손으로 고르게 됩니다');
});

test('★★★ 물음은 기본 «그대로» — 사람이 안 보면 한 글자도 안 바뀐다', () => {
  const c = 판();
  const 묻 = [
    '제1조(목적) 사원은 다음 각 호에 따라 포',
    '함하여 처리한다. 포장 및 포대는 별도로 정한다.'
  ].join('\n');
  assert.match(이어라(c, 묻), /따라 포\n함하여/,
    '★★★ 묻지도 않고 바꿨습니다');
});

test('★ 사람이 답을 주면 그대로 따른다', () => {
  const c = 판();
  const 묻 = [
    '제1조(목적) 사원은 다음 각 호에 따라 포',
    '함하여 처리한다. 포장 및 포대는 별도로 정한다.'
  ].join('\n');
  const ms = c.lineJoinMarks(묻);
  ms.forEach(function (m) { if (m.뜻 === '물음') m.뜻 = '붙임'; });
  assert.match(c.lineJoinApply(묻, ms), /따라 포함하여/, '붙임 답을 안 따릅니다');
  const ms2 = c.lineJoinMarks(묻);
  ms2.forEach(function (m) { if (m.뜻 === '물음') m.뜻 = '띄움'; });
  assert.match(c.lineJoinApply(묻, ms2), /따라 포 함하여/, '띄움 답을 안 따릅니다');
});

/* ══════ ⑤ 세기와 견딤 ══════ */

test('★ 몇 곳을 어떻게 했는지 «센다» — 조용히 고치면 아무도 확인 못 한다', () => {
  const c = 판();
  const 셈 = c.lineJoinCount(c.lineJoinMarks(글));
  assert.ok(셈.붙임 >= 2, '붙인 곳을 안 셉니다: ' + JSON.stringify(셈));
  assert.ok(셈.띄움 >= 1, '띄운 곳을 안 셉니다: ' + JSON.stringify(셈));
  assert.ok(셈.그대로 >= 4, '그대로 둔 곳을 안 셉니다: ' + JSON.stringify(셈));
});

test('빈 글·한 줄·null 에도 안 터진다 — 한 파일이 이상하다고 올리기가 멎으면 안 된다', () => {
  const c = 판();
  [null, undefined, '', '한 줄뿐', '\n\n\n'].forEach(function (t) {
    const ms = c.lineJoinMarks(t);
    assert.ok(Array.isArray(ms));
    assert.equal(typeof c.lineJoinApply(t, ms), 'string');
  });
});

test('★ 조문이 하나도 없는 글은 «통째로» 안 건드린다 — 취업규칙이 아닐 수 있다', () => {
  const c = 판();
  const 아무글 = '그냥 글입니다\n이어지는 줄입니다\n또 한 줄';
  assert.equal(이어라(c, 아무글), 아무글);
});

/* ══════ ⑥ 화면이 실제로 쓴다 ══════ */

test('★★ 글을 뽑는 자리에서 «담기기 전에» 돈다', () => {
  const 코드 = RAW.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
                  .replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(코드, /lineJoinApply\([^)]*\)[\s\S]{0,200}SAMPLES\[key\]=/,
    '★★ 올릴 때 줄 정리가 안 돕니다 — 담긴 뒤에 고치면 서류가 이미 나간 뒤입니다');
});

test('★ 이미 담긴 것도 고칠 수 있다 — 「⏎ 줄 정리」 단추가 있다', () => {
  assert.match(RAW, /id="line-join"/, '이미 올린 문서를 고칠 길이 없습니다');
});
