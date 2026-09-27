'use strict';
/* 서류종류 판정 — 못 가리면 추측하지 않는다 (spec §4)

   빈칸은 눈에 띄지만 틀린 값을 확신해서 넣으면 아무도 못 찾는다. 수백 건이면
   더욱 그렇다. 그래서 판정 실패는 null(=「확인 필요」)이고, etc 로 조용히
   밀지 않는다. etc 는 «사람이 보고 그렇게 정한 것»만 들어가는 자리다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const CB = require(path.join(__dirname, '..', 'js', 'pu-rules-casebook.js'));

test('★ 대조표가 개정보다 먼저 이긴다 — 「신구대조표(개정안)」은 대조표다', () => {
  assert.equal(CB.roleOf('신구대조표(개정안).hwp'), 'daejo');
  assert.equal(CB.roleOf('취업규칙_신구대조표.hwp'), 'daejo');
  assert.equal(CB.roleOf('신구 대조표.hwp'), 'daejo');
});

test('제출 서류 셋을 가린다', () => {
  assert.equal(CB.roleOf('취업규칙 변경신고서.hwp'), 'report');
  assert.equal(CB.roleOf('근로자 의견청취서.hwp'), 'opinion');
  assert.equal(CB.roleOf('취업규칙 동의서.hwp'), 'consent');
});

test('개정본과 개정 전을 가린다', () => {
  assert.equal(CB.roleOf('취업규칙_개정안.hwp'), 'after');
  assert.equal(CB.roleOf('취업규칙(최종).hwp'), 'after');
  assert.equal(CB.roleOf('취업규칙_현행.hwp'), 'before');
  assert.equal(CB.roleOf('취업규칙(구).hwp'), 'before');
  assert.equal(CB.roleOf('기존 취업규칙.hwp'), 'before');
});

test('★★★ 「개정전」이 「개정본」이 되면 안 된다 — 옛 글이 새 글 자리에 들어간다', () => {
  /* 2026-09-13 실측: 서고에 첫 자료를 넣기 전에 돌려 보니 `개정전_취업규칙.hwp` 가
     «개정본»으로 갈렸다. after 의 단서에 「개정」이 있고 그것이 before 보다 위라서,
     「개정전」의 앞 두 글자에 먼저 걸린 것이다.
     ★ 이것이 왜 큰가 — 개정 «전» 문안이 개정 «본» 자리에 담기면 신구대조표가
       거꾸로 그려지고, 조문 검색·사례집이 옛 문구를 지금 것으로 내놓는다.
       빈칸은 눈에 띄지만 뒤바뀐 값은 아무도 못 찾는다. */
  ['개정전_취업규칙.hwp', '취업규칙(개정 전).hwp', '2022 개정전 취업규칙.hwp',
   '변경전_취업규칙.hwp', '종전 취업규칙.hwp'].forEach(function (n) {
    assert.equal(CB.roleOf(n), 'before', n + ' 를 개정 전으로 안 가립니다');
  });
});

test('★ 그래도 「개정안·개정후」는 개정본이다 — 고치면서 반대로 넘어가면 안 된다', () => {
  ['취업규칙_개정안.hwp', '취업규칙 개정후.hwp', '취업규칙(개정 후).hwp',
   '2026 전부개정 취업규칙.hwp'].forEach(function (n) {
    assert.equal(CB.roleOf(n), 'after', n + ' 를 개정본으로 안 가립니다');
  });
});

test('★ 대조표는 여전히 맨 위다 — 「개정전후 신구대조표」는 대조표다', () => {
  assert.equal(CB.roleOf('개정전후 신구대조표.hwp'), 'daejo');
  assert.equal(CB.roleOf('개정 전 대조표.hwp'), 'daejo');
});

test('★ 단서가 없으면 「확인 필요」(null) — etc 로 밀지 않는다', () => {
  assert.equal(CB.roleOf('취업규칙.hwp'), null);
  assert.equal(CB.roleOf('20220310_규정.hwp'), null);
  assert.equal(CB.roleOf(''), null);
  assert.equal(CB.roleOf(null), null);
});

test('★ 「대구지점」이 개정 전이 되면 안 된다 — 홑글자 「구」는 단서가 아니다', () => {
  assert.equal(CB.roleOf('대구지점 취업규칙.hwp'), null,
    '홑글자 구를 단서로 쓰면 지명·연구소가 전부 개정 전이 됩니다');
  assert.equal(CB.roleOf('연구소 취업규칙.hwp'), null);
});

test('확장자와 폴더는 판정에 끼어들지 않는다', () => {
  assert.equal(CB.roleOf('개정안/취업규칙.hwp'), null,
    '경로가 아니라 파일명만 봐야 합니다 — 경로는 siteOf 가 씁니다');
});

test('★ 파일명으로 못 가리면 본문 첫머리로 보강한다', () => {
  assert.equal(CB.roleOf('규정.hwp', '취업규칙 신구대조표\n제1조 ...'), 'daejo');
  assert.equal(CB.roleOf('규정.hwp', '이 취업규칙은 ...'), null);
});

test('본문은 앞부분만 본다 — 뒤쪽 낱말에 끌려가지 않는다', () => {
  const tail = '가'.repeat(400) + ' 동의서';
  assert.equal(CB.roleOf('규정.hwp', tail), null);
});

test('★ 우선순위 표가 한 곳에 모여 있다 — 사무소 규칙이 다르면 여기만 고친다', () => {
  assert.ok(Array.isArray(CB.DOC_ROLE_HINTS));
  assert.equal(CB.DOC_ROLE_HINTS[0].role, 'daejo', '대조표가 맨 앞이어야 개정보다 먼저 이깁니다');
  const roles = CB.DOC_ROLE_HINTS.map(h => h.role);
  /* ⚠ 2026-09-13: before 가 after «위»로 올라갔다. after 의 단서에 「개정」이 있어
     「개정전_취업규칙」이 앞 두 글자에 먼저 걸려 개정본으로 갈렸기 때문이다.
     ★ 뒤바뀐 값은 빈칸보다 나쁘다 — 개정 전 문안이 개정본 자리에 들어가면
       신구대조표가 거꾸로 그려지고 아무도 못 찾는다. */
  assert.deepEqual(roles, ['daejo', 'report', 'opinion', 'consent', 'before', 'after']);
  const b = CB.DOC_ROLE_HINTS.find(h => h.role === 'before');
  assert.ok(b.words.indexOf('개정전') >= 0, '「개정전」이 before 단서에 있어야 합니다');
});

test('ROLES 에 etc 가 있다 — 사람이 정하는 자리', () => {
  assert.ok(CB.ROLES.includes('etc'));
  assert.equal(CB.ROLES.length, 7);
});
