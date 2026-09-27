/* 규정관리 — 해설판 읽기 · 표준 문안 조사 (2026-09-26 대표 「오류 고쳐라」)
   ① 노동부 표준취업규칙은 큰 표(왼쪽 조문 · 오른쪽 「작성시 착안사항」)라, 글로 뽑으면 해설이 그 조 원문에 섞였다
      (제24조 원문 끝에 「[필수] 휴게시간은 …」「☞ (참고) …」). 해설까지 검토되고, 원본 살려 고치기는
      「글자 다름」 으로 멈췄다. 해설판일 때만 해설 칸을 떼고 읽는다.
   ② 표준 문안 「{근로자}가」를 받침 있는 「사원」으로 채워 「회사는 사원가 …」가 됐다. 조사를 받침에 맞춘다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
function grab(from, to) {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  assert.ok(a > 0 && b > a, '토막을 찾지 못했습니다: ' + from);
  return html.slice(a, b);
}
/* 조사 채우기 + 해설 떼기 토막 — 화면의 것을 그대로 떼어 돌린다 */
const src = grab('const JOSA=', 'let CMT_CUT=0;');
const M = new Function(src + '; return { fillTpl, stripCommentary, hasBatchim };')();

const STD = [
  '◈ 이 자료는 주40시간제가 적용되는 제조업체를 가정하여 작성한 것입니다.',
  '취업규칙(안)', '(작성시 착안사항)',
  '제1장 총칙', '',
  '제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.', '',
  '[필수] 목적을 적는다', '', '   ☞ (참고) 사업장 이름을 쓴다', '',
  '제2장 채용 및 근로계약', '',
  '◈ 채용 관련 사항은 필수적 기재사항은 아니지만 두는 것이 일반적임', '',
  '제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.', '', '  ② 휴게시간은 자유롭게 이용할 수 있다.', '',
  '[필수] 휴게시간은 근로기준법의 취지에 위배되지 않게', '', '   ☞ (참고) 4시간이면 30분 이상', '', '   - 예) 교대근무',
  '',
  '제3조(연차) 15일을 준다.', '', '[선택] 연차', '', '[필수, 선택] 연차 촉진', '', '[선택] 반차', '', '[필수] 끝',
  '', '부   칙', '', '1. 이 규칙은 2020년 1월 1일부터 시행한다.'
].join('\n');

test('해설판 — 해설 칸(꼬리표·☞·◈ 줄)을 떼고, 조문·장 머리·부칙은 남긴다', () => {
  const r = M.stripCommentary(STD);
  assert.ok(r.cut >= 5);
  const t = r.text;
  ['제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.', '제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.',
    '  ② 휴게시간은 자유롭게 이용할 수 있다.', '제3조(연차) 15일을 준다.', '제2장 채용 및 근로계약', '부   칙',
    '1. 이 규칙은 2020년 1월 1일부터 시행한다.'].forEach(l => assert.ok(t.includes(l), '★ 조문을 잘라 먹었다: ' + l));
  ['[필수]', '☞', '◈', '- 예)', '[선택]'].forEach(m => assert.ok(!t.includes(m), '★ 해설이 남았다: ' + m));
  /* 제2조 원문 바로 뒤가 다음 조 머리여야 한다 — 해설이 끼면 그 조 원문에 섞인다 */
  const i = t.indexOf('  ② 휴게시간은 자유롭게 이용할 수 있다.');
  assert.match(t.slice(i).split('\n').filter(Boolean)[1], /^제3조/);
});

test('보통 취업규칙은 건드리지 않는다 — 「작성시 착안사항」 머리가 없으면 그대로', () => {
  const plain = STD.replace('(작성시 착안사항)', '');
  assert.deepEqual(M.stripCommentary(plain), { text: plain, cut: 0 });
  /* 머리가 있어도 꼬리표 줄이 몇 개뿐이면 해설판이 아니다(본문에 「[필수]」 가 한두 번 나오는 규칙도 있다) */
  const few = ['(작성시 착안사항)', '제1조(목적) 목적.', '[필수] 하나', '제2조(휴게) 휴게.'].join('\n');
  assert.equal(M.stripCommentary(few).cut, 0);
});

test('표준 문안 조사 — 받침 있는 말(사원·직원)이면 이/은/을/과', () => {
  const T = '회사는 {근로자}가 요청하면 {근로자}는 쓸 수 있고, 회사는 {근로자}를 {근로자}와 함께 {근로자}에게 알린다. {근로자}의 권리.';
  assert.equal(M.fillTpl(T, { 회사: '회사', 근로자: '사원' }),
    '회사는 사원이 요청하면 사원은 쓸 수 있고, 회사는 사원을 사원과 함께 사원에게 알린다. 사원의 권리.');
  assert.ok(M.fillTpl(T, { 회사: '회사', 근로자: '직원' }).startsWith('회사는 직원이 요청하면 직원은 쓸 수 있고, 회사는 직원을 직원과'));
  assert.equal(M.fillTpl(T, { 회사: '회사', 근로자: '근로자' }),
    '회사는 근로자가 요청하면 근로자는 쓸 수 있고, 회사는 근로자를 근로자와 함께 근로자에게 알린다. 근로자의 권리.', '받침 없는 말은 그대로');
  assert.equal(M.fillTpl('{회사}는 {회사}와', { 회사: '회사', 근로자: '사원' }), '회사는 회사와');
  /* 조사 뒤에 한글이 이어지면 조사가 아니다 — 「가족」의 「가」를 「이」로 바꾸면 안 된다 */
  assert.equal(M.fillTpl('{근로자}가족수당', { 회사: '회사', 근로자: '사원' }), '사원가족수당');
  assert.equal(M.hasBatchim('사원'), true);
  assert.equal(M.hasBatchim('근로자'), false);
});

test('규정관리가 원본을 글로 읽는 길은 모두 해설 떼기를 지난다 — 올리기·은행·서고·보관함 다시 열기', () => {
  const bare = html.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const raw = [...bare.matchAll(/await extractDocText\(/g)].length;
  assert.equal(raw, 1, '★ 해설을 안 떼고 읽는 길이 있다 — readRulesText 를 쓸 것');
  assert.match(bare, /async function readRulesText\(buf\)\{ const r=stripCommentary\(await extractDocText\(buf\)\)/);
  assert.ok([...bare.matchAll(/await readRulesText\(/g)].length >= 5);
  /* 보관함에서 다시 여는 두 길 — 예전에 해설이 섞인 채 담긴 원문도 뗀다 */
  assert.ok([...bare.matchAll(/const c=stripCommentary\(o\.text\|\|""\); SAMPLES\[key\]=c\.text;/g)].length >= 2);
  /* 말없이 떼지 않는다 — 몇 곳을 뗐는지 미리보기 머리에 */
  assert.match(bare, /cmtTag\(key\)/);
});
