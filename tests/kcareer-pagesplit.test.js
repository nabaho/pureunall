'use strict';
/* 「여러 장 PDF 를 서류마다 갈라 읽기」 (대표 지시 2026-09-12
   「한번에 여러장 pdf를 넣어도 모두 인식할수있게해라」)
   ────────────────────────────────────────────────────────────────────────
   ■ 여태 왜 한 건만 담겼나 — 고장이 아니라 «짜임»이었다
     `_ocrPayload` 가 PDF 를 쪽마다 그림으로 바꿔 넘기고, 판독층(pu-doc-read.js)의
     `readWithPrompt` 는 그 여러 장을 **「한 문서의 여러 쪽」**으로 읽는다.
     2장짜리 경력증명서 때문에 그 짜임 자체는 옳다.
     빠져 있던 것은 **「이 묶음에 서류가 몇 개인가」를 묻는 일**이었다.
   ■ 그래서 여기서 하는 일
     ① 부르는 쪽 사전은 «그대로» 두고 「쪽을 서류별로 묶어 달라」를 덧붙인다
     ② AI 가 docs[] 로 답하면 검사해서 서류 목록으로 돌려준다(담는 것은 결정적 코드)
   ⚠★ 「갈라 주세요」라고 «권하면» 안 먹힌다(옆 앱 실측). 꼴을 «못 박고», 그 꼴이 아니면
     아예 안 쓴다 — 부르는 쪽이 옛 길로 물러선다. 되던 것이 멈추면 안 된다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/kcareer-pagesplit.js');

const 사전 = '이 위촉장을 읽어 JSON 으로만 답하세요.\n{"org":"발급기관","titleVal":"직책","issueDate":"YYYY.MM.DD"}';

/* ══════ 물음 ══════ */

test('★★ 부르는 쪽 사전을 «그대로» 안고 간다 — 두 벌이 되면 한쪽만 고쳐진다', () => {
  const p = S.buildPrompt(사전, 5);
  assert.ok(p.indexOf(사전) === 0, '★★ 사전이 통째로 앞에 있어야 합니다');
  assert.match(p, /"org"/, '칸 이름이 살아 있어야 합니다');
});

test('★★★ 꼴을 «못 박는다» — 권하기만 하면 안 먹힌다(옆 앱 실측)', () => {
  const p = S.buildPrompt(사전, 5);
  assert.match(p, /"docs"\s*:\s*\[/, '★★★ 답의 «꼴»을 보여 줘야 합니다');
  assert.match(p, /반드시/, '★★ 「반드시」라고 못 박아야 합니다');
  assert.match(p, /5쪽/, '몇 쪽인지 알려 줘야 쪽 번호를 맞게 답합니다');
  assert.match(p, /pages/, 'pages 칸을 설명해야 합니다');
  /* ⚠ 한 서류가 여러 쪽인 경우를 말해 주지 않으면 2장짜리 증명서를 둘로 가른다 */
  assert.match(p, /한 서류가 여러 쪽/, '★★ 2장짜리 한 서류를 둘로 가르게 됩니다');
  assert.match(p, /서류가 하나뿐이면/, '★ 하나뿐일 때를 안 말하면 억지로 가릅니다');
});

/* ══════ 답 읽기 ══════ */

test('★★★ 위촉장 열 장을 한 PDF 로 넣으면 «열 건»이 된다', () => {
  const docs = [];
  for (let i = 1; i <= 10; i++) docs.push({ pages: [i], org: '기관' + i, titleVal: '위원', issueDate: '202' + (i % 10) + '.01.01' });
  const got = S.parseDocs({ docs: docs }, 10);
  assert.ok(got, '★★★ 갈라 읽은 답을 버렸습니다 — 아홉 건이 사라집니다');
  assert.equal(got.docs.length, 10);
  assert.deepEqual(got.docs[0].pages, [1]);
  assert.equal(got.docs[9].fields.org, '기관10');
  assert.ok(!('pages' in got.docs[0].fields), 'pages 는 칸이 아닙니다 — 기록에 들어가면 안 됩니다');
});

test('★★★ 2장짜리 «한 서류»는 가르지 않는다 — 억지로 가르면 더 나쁘다', () => {
  const got = S.parseDocs({ docs: [{ pages: [1, 2], org: '충청남도', titleVal: '위원' }] }, 2);
  assert.equal(got.docs.length, 1, '★★★ 2장짜리 경력증명서를 두 건으로 만들었습니다');
  assert.deepEqual(got.docs[0].pages, [1, 2]);
});

test('★★★ 못 알아들으면 null — 부르는 쪽이 «옛 길»로 간다', () => {
  /* ⚠ 여기서 억지로 만들어 내면, 새 기능 때문에 오늘까지 되던 것이 망가진다 */
  assert.equal(S.parseDocs({ org: '충청남도', titleVal: '위원' }, 3), null, 'docs 가 없습니다');
  assert.equal(S.parseDocs({ docs: [] }, 3), null, 'docs 가 비었습니다');
  assert.equal(S.parseDocs({ docs: '아니오' }, 3), null);
  assert.equal(S.parseDocs(null, 3), null);
  assert.equal(S.parseDocs('그냥 글', 3), null);
});

test('★★ 알맹이 없는 서류는 만들지 않는다 — 빈 줄이 늘면 정리가 더 어렵다', () => {
  const got = S.parseDocs({ docs: [
    { pages: [1], org: '충청남도', titleVal: '위원' },
    { pages: [2], org: '', titleVal: '', issueDate: '' }
  ] }, 2);
  assert.equal(got.docs.length, 1, '★★ 빈 서류까지 담았습니다');
  assert.deepEqual(got.unused, [2], '안 쓴 쪽을 알려 줘야 합니다');
});

test('★★★ 같은 쪽이 두 서류에 들어가면 앞선 것이 이긴다 — 한 원본이 두 줄에 붙으면 안 된다', () => {
  const got = S.parseDocs({ docs: [
    { pages: [1, 2], org: '가', titleVal: '위원' },
    { pages: [2, 3], org: '나', titleVal: '위원' }
  ] }, 3);
  assert.deepEqual(got.docs[0].pages, [1, 2]);
  assert.deepEqual(got.docs[1].pages, [3], '★★★ 2쪽이 두 서류에 다 들어갔습니다');
});

test('★★ 없는 쪽 번호는 버린다 — 0쪽·99쪽·글자', () => {
  const got = S.parseDocs({ docs: [{ pages: [0, 1, 99, 'x'], org: '충청남도', titleVal: '위원' }] }, 3);
  assert.deepEqual(got.docs[0].pages, [1]);
});

test('★ 쪽 번호를 안 준 서류에는 «남은 쪽»을 순서대로 잇는다', () => {
  const got = S.parseDocs({ docs: [
    { pages: [1], org: '가', titleVal: '위원' },
    { org: '나', titleVal: '위원' },
    { org: '다', titleVal: '위원' }
  ] }, 3);
  assert.deepEqual(got.docs.map(function (d) { return d.pages[0]; }), [1, 2, 3]);
});

test('★ 쪽 번호도 없고 남은 쪽도 없으면 그 서류는 버린다 — 어느 쪽인지 모르는 원본은 못 붙인다', () => {
  const got = S.parseDocs({ docs: [
    { pages: [1], org: '가', titleVal: '위원' },
    { org: '나', titleVal: '위원' }
  ] }, 1);
  assert.equal(got.docs.length, 1);
});

test('★ 쪽 순서대로 내놓는다 — 뒤죽박죽이면 사람이 못 견준다', () => {
  const got = S.parseDocs({ docs: [
    { pages: [3], org: '다', titleVal: '위원' },
    { pages: [1], org: '가', titleVal: '위원' },
    { pages: [2], org: '나', titleVal: '위원' }
  ] }, 3);
  assert.deepEqual(got.docs.map(function (d) { return d.fields.org; }), ['가', '나', '다']);
});

test('★ 쪽 뚜껑이 있다 — 없으면 30쪽짜리에 요금과 시간이 함께 튄다', () => {
  assert.ok(S.MAX_PAGES >= 2 && S.MAX_PAGES <= 30, '실제 ' + S.MAX_PAGES);
});

test('빈 것·이상한 것에 터지지 않는다', () => {
  assert.doesNotThrow(function () { S.parseDocs({ docs: [null, 3, 'x'] }, 2); });
  assert.doesNotThrow(function () { S.buildPrompt(null, 0); });
});
