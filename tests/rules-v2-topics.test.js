const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/rules-v2/lib-topics.js');
const W = require('../js/pu-rules-filecmp.js').wordDiff;

const DOC = [
  '취업규칙', '목차', '제1조(목적) ........ 1', '제1장 총칙',
  '제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.',
  '제2조(적용범위) 이 규칙은 사원에게 적용한다.',
  '제4장 휴가',
  '제33조(연차휴가) ① 1년간 80퍼센트 이상 출근한 사원은 15일의 유급휴가를 받는다.',
  '제33조의2(연차 사용촉진) 회사는 사용을 촉진할 수 있다.',
  '부칙', '제1조(시행일) 이 규칙은 2026년 1월 1일부터 시행한다.'
].join('\n');

test('조 쪼개기 — 목차 줄을 거르고, 장 머리를 떼고, 부칙 앞까지', () => {
  const a = T.splitArticles(DOC);
  assert.deepEqual(a.map((x) => x.label), ['제1조', '제2조', '제33조', '제33조의2']);
  assert.equal(a[0].title, '목적');
  assert.ok(/가나상사 사원/.test(a[0].body));
  assert.ok(!/제4장/.test(a[1].body), '★ 다음 장 머리가 앞 조 본문에 붙었다');
});

test('주제 열쇠 — 같은 뜻 제목은 한 열쇠', () => {
  assert.equal(T.topicKey('연차휴가'), T.topicKey('연차 유급휴가'));
  assert.equal(T.topicKey('연차유급휴가'), T.topicKey('연차휴가'));
  assert.notEqual(T.topicKey('연차유급휴가'), T.topicKey('연차 사용촉진'));
  assert.equal(T.topicKey('휴게시간'), T.topicKey('휴게'));
});

test('표준 차례 — 장 아래 조 차례', () => {
  const o = T.topicOrder(DOC);
  assert.deepEqual(o.map((x) => x.title), ['목적', '적용범위', '연차휴가', '연차 사용촉진']);
  assert.equal(o[0].chapter, '제1장 총칙');
  assert.equal(o[2].chapter, '제4장 휴가');
});

test('같은 글 — 회사 이름·호칭·조사·띄어쓰기·조 번호만 다르면 같은 열쇠', () => {
  const a = '제33조(연차휴가) ① 1년간 80퍼센트 이상 출근한 사원은 15일의 유급휴가를 받는다.';
  const b = '제30조(연차유급휴가) ①  1년간 80퍼센트 이상  출근한 근로자는 15일의 유급휴가를 받는다.';
  const c = '제33조(연차휴가) ① 1년간 80퍼센트 이상 출근한 사원은 12일의 유급휴가를 받는다.';
  assert.equal(T.normKey(a, '가나상사'), T.normKey(b, '나다물산'));
  assert.notEqual(T.normKey(a, '가나상사'), T.normKey(c, '가나상사'), '★ 15일과 12일을 같은 글로 묶었다');
  assert.equal(T.normText('이 규칙은 가나상사 직원에게 적용한다.', '가나상사'), '이 규칙은 {회사} {근로자}에게 적용한다.');
});

test('묶기 차례 — 최종본 많은 것 → 회사 많은 것 → 최근', () => {
  const E = (docId, co, final, date, body) => ({ docId, companyId: co, companyName: '', final, date, label: '제33조', title: '연차휴가', body });
  const A = '15일의 유급휴가를 준다.', B = '15일의 유급휴가를 준다. 청구한 시기에 준다.', C2 = '12일의 유급휴가를 준다.';
  const g = T.groupVariants([
    E('d1', 'c1', false, 5, A), E('d2', 'c2', false, 6, A), E('d3', 'c3', false, 7, A),
    E('d4', 'c4', true, 4, B), E('d5', 'c5', false, 9, C2),
  ]);
  assert.deepEqual(g.map((x) => x.members.length), [1, 3, 1]);
  assert.equal(g[0].finals, 1, '최종본 있는 덩어리가 맨 앞');
  assert.equal(g[1].members.length, 3);
  assert.equal(g[1].members[0].docId, 'd3', '덩어리 안은 최종본 → 최근');
  assert.equal(g[2].last, 9);
});

test('다른 곳 한 줄 요약', () => {
  assert.equal(T.diffSummary(W('15일의 유급휴가', '12일의 유급휴가')), '15 → 12');
  assert.match(T.diffSummary(W('준다.', '준다. ④ 청구한 시기에 준다.')), /^덧붙임: /);
  assert.match(T.diffSummary(W('준다. ④ 청구한 시기에 준다.', '준다.')), /^빠짐: /);
});

// ── 검토 1차 고침: 날것으로 새던 구멍들 ──
test('줄 머리 상호참조(제5조에 따라…)는 새 조가 아니다 — 앞 조를 자르지도, 진짜 조를 덮지도 않는다', () => {
  const doc = [
    '제5조(복무) 근로자는 성실히 근무한다.',
    '제9조(휴가) 회사는 휴가를 준다. 다만 아래의 경우에는',
    '제5조에 따라 15일을 준다. 이 경우 근로자가 청구한 시기에 주며 사용하지 못한 휴가는 보상한다.',
    '제5조의 규정에 따른다.',
    '제33조의2에 따른 촉진을 한다.',
    '제10조(퇴직) 근로자가 퇴직한다.',
  ].join('\n');
  const a = T.splitArticles(doc);
  assert.deepEqual(a.map((x) => x.label), ['제5조', '제9조', '제10조']);
  assert.ok(/제5조에 따라 15일을 준다/.test(a[1].body), '★ 제9조가 상호참조 줄에서 잘렸다');
  assert.ok(/제33조의2에 따른 촉진/.test(a[1].body));
  assert.equal(a[0].title, '복무');
  assert.ok(!/15일/.test(a[0].body), '★ 상호참조 줄이 진짜 제5조를 덮었다');
});

test('진짜 조 머리는 그대로 — 제목 없이 바로 본문이 와도, 의N 조도', () => {
  const doc = ['제1조 이 규칙은 목적이다.', '제2조의2(추가) 추가 조문이다.', '제3조 (띄움) 띄운 제목이다.'].join('\n');
  assert.deepEqual(T.splitArticles(doc).map((x) => x.label), ['제1조', '제2조의2', '제3조']);
});

test('회사 이름 뒤 조사도 호칭처럼 모양을 맞춘다 — 가나상사는 = 나다물산은', () => {
  const a = '가나상사는 휴가를 준다. 가나상사가 정하며 가나상사를 따른다. 가나상사와 협의한다.';
  const b = '나다물산은 휴가를 준다. 나다물산이 정하며 나다물산을 따른다. 나다물산과 협의한다.';
  assert.equal(T.normKey(a, '가나상사'), T.normKey(b, '나다물산'));
  assert.notEqual(T.normKey(a, '가나상사'), T.normKey(b.replace('휴가를', '휴일을'), '나다물산'));
});

test('(주)·주식회사·띄어쓰기를 걷어 낸 회사 이름으로 찾는다', () => {
  assert.equal(T.normText('가나상사는 휴가를 준다.', '(주)가나상사'), '{회사}는 휴가를 준다.');
  assert.equal(T.normText('가나상사 휴가', '주식회사 가나상사'), '{회사} 휴가');
  assert.equal(T.normText('가나상사 휴가', '㈜ 가나상사'), '{회사} 휴가');
  assert.equal(T.normText('주 휴가를 준다.', '(주)'), '주 휴가를 준다.', '걷고 나서 두 글자 미만이면 바꾸지 않는다');
});

test('호칭 뒤 조사 — 뒤에 한글이 이어지면 조사가 아니다', () => {
  assert.equal(T.normText('사원이 간다. 사원은 간다.', ''), '{근로자}가 간다. {근로자}는 간다.');
  assert.equal(T.normText('직원이다', ''), '{근로자}이다', '「이다」의 이는 글자가 이어지므로 가로 바꾸지 않는다');
  assert.equal(T.normText('사원을 본다', ''), T.normText('직원를 본다', ''));
});

test('호칭 뒤 한글이 이어지면 은/는·을/를·과/와도 조사가 아니다 (복합어의 호칭은 일부러 {근로자}로 맞춘다)', () => {
  assert.equal(T.normText('사원은행 사원을지 사원과목 사원증', ''), '{근로자}은행 {근로자}을지 {근로자}과목 {근로자}증');
});
