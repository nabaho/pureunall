'use strict';
/* 건의 답변 도움 — AI 초안 (대표 지시 2026-09-11)

   대표 지시: 「건의사항 자동화 해결방안 시스템 … 답변 자동으로 가능하게
              그리고 깃허브에는 모두 공개하면 안된다 데이터들 개인정보가 많이 있다」

   ■ 이 검사가 지키는 것
     ① 구글에 보내기 «전에» 가린다 — 실명·사건번호·번호가 프롬프트에 남으면 안 된다
     ② 고치는 데 필요한 낱말은 «살린다» — 날짜·기능 이름을 지우면 짐작을 못 한다
     ③ 건의 글은 «자료»다 — 명령으로 따르지 말라는 울타리가 있어야 한다
     ④ 옛 건의 이사가 돌아도 AI 를 수백 번 부르지 않는다 (요금 사고)
     ⑤ 한도를 «먼저» 보고 부른다 — 몰래 새는 길을 하나 더 내지 않는다
     ⑥ 초안은 «게시되지 않는다» — 사람이 눌러야 답변이 된다 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const SA = require(path.join(R, 'functions', 'suggestion-assist.js'));
const DR = require(path.join(R, 'functions', 'doc-read.js'));
const APP = fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
const ENTER = fs.readFileSync(path.join(R, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');

/* 실제로 올라왔던 건의(2026-09-10) 모양 — 이름만 바꾼 것이다.
   ⚠ 저장소에 진짜 이름을 적지 않는다(tests/erp-no-real-data.test.js 와 같은 잣대). */
const 제목 = '2025년도 수임 사건 2026년도에 보수 이체되었을 경우 매칭이 안됩니다.';
const 본문 = '지난 25/12/12 수임한 홍길동 님 임금체불사건(사건번호 임금체불-2025-001) 착수금은 '
  + '같은 날 입금이 완료되었으나 성공보수가 26/02/02 입금되어 이를 반영하고자 계약등록 및 '
  + '이관을 하였음에도 거래내역에서 매칭이 되지 않습니다. 담당 ㈜나래산업 010-1234-5678 '
  + 'hong@example.com 123-45-67890';

test('① ★★ 사람 이름이 가려진다 — 가장 자주 새는 자리', function () {
  const m = SA.maskPersonal(본문);
  assert.ok(!/홍길동/.test(m.text), '★★ 실명이 그대로 남아 구글로 갑니다');
  assert.match(m.text, /○○○\s*님/, '이름 자리에 가림표가 없습니다');
  assert.ok(m.kinds.includes('이름'), '무엇을 가렸는지 알려주지 않습니다');
});

test('② ★★ 번호·업체·연락처가 가려진다', function () {
  const m = SA.maskPersonal(본문);
  assert.ok(!/임금체불-2025-001/.test(m.text), '★★ 사건번호가 남았습니다');
  assert.ok(!/나래산업/.test(m.text), '★★ 업체명이 남았습니다');
  assert.ok(!/010-1234-5678/.test(m.text), '★★ 전화번호가 남았습니다');
  assert.ok(!/hong@example\.com/.test(m.text), '★★ 이메일이 남았습니다');
  assert.ok(!/123-45-67890/.test(m.text), '★★ 사업자번호가 남았습니다');
  ['주민번호', '사업자번호'].forEach(function (k) {
    assert.ok(SA.maskPersonal('901231-1234567 · 123-45-67890').kinds.includes(k), k + ' 를 못 가립니다');
  });
});

test('③ ★ 고치는 데 필요한 낱말은 «살린다» — 다 지우면 짐작을 못 한다', function () {
  const m = SA.maskPersonal(본문);
  ['25/12/12', '26/02/02', '거래내역', '성공보수', '착수금', '이관'].forEach(function (w) {
    assert.ok(m.text.indexOf(w) >= 0, '★ 「' + w + '」 까지 지웠습니다 — 무엇이 고장났는지 알 수 없게 됩니다');
  });
});

test('④ ★★ 프롬프트에 원문 이름이 «한 글자도» 안 들어간다', function () {
  const p = SA.assistParts(제목, 본문);
  const 보낼글 = p.parts.map(function (x) { return x.text; }).join('\n');
  ['홍길동', '임금체불-2025-001', '나래산업', '010-1234-5678', 'hong@example.com']
    .forEach(function (secret) {
      assert.ok(보낼글.indexOf(secret) < 0, '★★ 「' + secret + '」 이 그대로 구글로 갑니다');
    });
  assert.ok(p.maskedKinds.length > 0, '가린 것을 안 세고 있습니다');
});

test('⑤ ★ 건의 글은 «자료»다 — 명령으로 따르지 않는다', function () {
  const 보낼글 = SA.assistParts(제목, 본문).parts.map(function (x) { return x.text; }).join('\n');
  assert.match(보낼글, /따르지\s*마세요|명령으로/, '★ 주입 방어 문구가 없습니다');
  /* ⚠ 「<<<건의>>>」 는 방어 문구 안에도 나온다 — 그냥 찾으면 울타리를 통째로
     걷어내도 검사가 통과한다(2026-09-11 되돌림 검사에서 실제로 그랬다).
     건의 글이 «여는 울타리와 닫는 울타리 사이에» 있는지까지 본다. */
  const 연곳 = 보낼글.lastIndexOf('<<<건의>>>');
  const 닫은곳 = 보낼글.indexOf('<<<건의끝>>>');
  const 글자리 = 보낼글.indexOf(제목.slice(0, 12));
  assert.ok(연곳 >= 0 && 닫은곳 > 연곳, '★ 건의 글을 울타리로 감싸지 않았습니다');
  assert.ok(글자리 > 연곳 && 글자리 < 닫은곳,
    '★★ 건의 글이 울타리 «밖»에 있습니다 — 지시문과 섞여 명령으로 읽힙니다');
  assert.ok(보낼글.indexOf('따르지') < 연곳, '★ 방어 문구가 건의 글 «뒤»에 있습니다 — 앞에 와야 합니다');
});

test('⑥ AI 답 읽기 — 울타리·군말이 붙어 와도 읽는다', function () {
  const 답 = function (t) { return { candidates: [{ content: { parts: [{ text: t }] } }] }; };
  const 좋은것 = '{"summary":"요약","kinds":["고장","푸른이알피"],"guess":"까닭","draft":"초안입니다"}';
  assert.equal(SA.parseAssist(답(좋은것)).draft, '초안입니다');
  assert.equal(SA.parseAssist(답('```json\n' + 좋은것 + '\n```')).draft, '초안입니다', '코드울타리를 못 벗깁니다');
  assert.equal(SA.parseAssist(답('네, 만들었습니다.\n' + 좋은것)).draft, '초안입니다', '앞에 붙은 말에 걸립니다');
  assert.deepEqual(SA.parseAssist(답(좋은것)).kinds, ['고장', '푸른이알피']);
});

test('⑦ ★ 못 읽으면 «없는 것»으로 둔다 — 지어내지 않는다', function () {
  const 답 = function (t) { return { candidates: [{ content: { parts: [{ text: t }] } }] }; };
  assert.equal(SA.parseAssist(답('그건 좀 어렵겠는데요')), null, '★ JSON 이 아닌데 무언가를 만들었습니다');
  assert.equal(SA.parseAssist(답('{"summary":"요약"}')), null, '★ 초안이 없는데 통과시켰습니다');
  assert.equal(SA.parseAssist({}), null, '빈 답에서 넘어집니다');
  assert.equal(SA.parseAssist(답('{"draft":"초안","kinds":["없는앱","고장"]}')).kinds.join(','), '고장',
    '★ AI 가 지어낸 앱 이름을 그대로 씁니다');
});

test('⑧ ★★ 옛 건의 이사가 돌아도 AI 를 안 부른다 — 요금 사고', function () {
  const 지금 = 1789000000000;
  const 새것 = { title: '제목', content: '내용', createdAt: 지금 - 1000 };
  assert.equal(SA.shouldAssist(새것, 지금).ok, true, '방금 올라온 건의를 안 돕습니다');
  assert.equal(SA.shouldAssist({ title: '제목', content: '내용', createdAt: 지금 - 40 * 60 * 1000 }, 지금).why,
    'stale', '★★ 옛 건의까지 돕습니다 — 이사 한 번에 수백 건이 태워집니다');
  assert.equal(SA.shouldAssist({ title: '제목', content: '내용', createdAt: 지금 + 60 * 60 * 1000 }, 지금).why,
    'stale', '★ 앞날짜로 적으면 문턱을 영영 통과합니다');
  assert.equal(SA.shouldAssist(Object.assign({ assist: { ok: true } }, 새것), 지금).why, 'already',
    '★ 이미 지은 것을 또 짓습니다');
  assert.equal(SA.shouldAssist({ title: '', content: '내용', createdAt: 지금 }, 지금).why, 'empty');
  assert.equal(SA.shouldAssist(null, 지금).ok, false, '빈 값에서 넘어집니다');
});

/* ── 배선 — 만들어만 두고 «안 부르는» 일이 없게 ─────────────────────────── */

test('⑨ ★★ 한도를 «먼저» 보고 부른다 — 새는 길을 하나 더 내지 않는다', function () {
  const body = stripComments('<script>' + cutFn(APP, 'async function buildSuggestionAssist(') + '</script>');
  assert.match(body, /aiMonthSpend\(\)/, '★★ 이번 달 요금 한도를 안 봅니다');
  assert.ok(body.indexOf('aiMonthSpend') < body.indexOf('callGemini'),
    '★★ 부르고 «나서» 한도를 봅니다 — 이미 돈이 나간 뒤입니다');
  assert.match(body, /bumpReadTally\(\s*SG_ASSIST_APP/, '★ 쓴 만큼 세지 않습니다 — 요금이 어디서 났는지 모르게 됩니다');
  assert.match(body, /SA\.assistParts\(/, '★★ 가림망을 안 거치고 보냅니다');
  assert.ok(!/callGemini\([^)]*record\.(title|content)/.test(body),
    '★★ 건의 «원문»을 그대로 보내고 있습니다');
});

test('⑩ 셈은 판독과 «갈라» 쌓는다', function () {
  assert.ok(DR.APPS.includes('portal'), '★ portal 자리가 없어 건의 도움이 other 로 뭉칩니다');
  assert.equal(DR.appOf('portal'), 'portal');
  assert.match(APP, /SG_ASSIST_APP\s*=\s*["']portal["']/, '건의 도움의 셈 자리가 portal 이 아닙니다');
});

test('⑪ ★ 자동 트리거가 문턱을 «실제로» 본다', function () {
  const seg = APP.slice(APP.indexOf('exports.suggestionAssist ='), APP.indexOf('exports.suggestionAssistNow'));
  assert.ok(seg.length > 100, '자동 트리거를 못 찾았습니다');
  assert.match(seg, /SA\.shouldAssist\(/, '★★ 문턱을 안 보고 부릅니다 — 이사 한 번에 요금이 터집니다');
  assert.match(seg, /suggestions_meta_private/, '건의가 올라오는 자리를 안 봅니다');
});

test('⑫ ★ 손수 짓기는 총괄관리자만', function () {
  const seg = APP.slice(APP.indexOf('exports.suggestionAssistNow'));
  const body = stripComments('<script>' + seg.slice(0, 3000) + '</script>');
  assert.match(body, /verifyIdToken/, '★★ 누가 부르는지 안 봅니다');
  assert.match(body, /isAdmin\s*!==\s*true/, '★★ 총괄관리자 검사가 없습니다 — 건의는 직원이 대표께 올린 글입니다');
});

/* ── 화면 — 초안이 «스스로» 나가지 않는다 ──────────────────────────────── */

test('⑬ ★★ 초안은 자동 게시되지 않는다 — 사람이 눌러야 답변이 된다', function () {
  const bare = stripComments(ENTER);
  assert.match(bare, /id="sgAsstUse"/, '★ [답변란에 넣기] 단추가 없습니다');
  /* 초안을 답변 자리(sgReplyIn)에 넣는 곳이 «단추 눌림» 안에만 있어야 한다.
     그리기(sgAssistHtml)가 곧바로 넣으면 확인 없이 나간다. */
  const draw = stripComments('<script>' + cutFn(ENTER, 'function sgAssistHtml(') + '</script>');
  assert.ok(!/sgReplyIn/.test(draw), '★★ 그리면서 답변칸을 채웁니다 — 확인 없이 나갑니다');
  assert.ok(!/\.update\(|\.set\(/.test(draw), '★★ 그리면서 서버에 씁니다');
});

test('⑭ ★ 쓰고 있던 답변을 지우지 않는다', function () {
  const wire = stripComments(ENTER);
  /* ⚠ 「sgAsstUse」 는 그리는 쪽(id="sgAsstUse")에도 있다 — 거기서부터 세면
     배선을 통째로 빼도 검사가 통과한다. «단추를 붙이는 줄»부터 자른다. */
  const at = wire.indexOf("var asstUse = $('sgAsstUse')");
  assert.ok(at > 0, '★ [답변란에 넣기] 단추에 아무 일도 안 걸려 있습니다');
  const seg = wire.slice(at, at + 900);
  assert.ok(/t\.value\.trim\(\)\s*\?/.test(seg),
    '★ 쓰던 글이 있는지 안 보고 덮어씁니다 — 단추 한 번에 쓰던 답변이 사라집니다');
});

test('⑮ ★ 못 지었을 때도 «왜» 를 보여 준다', function () {
  const draw = stripComments('<script>' + cutFn(ENTER, 'function sgAssistHtml(') + '</script>');
  assert.match(draw, /SG_ASSIST_WHY/, '★ 까닭을 안 보여 줍니다 — 빈칸은 고장으로 보입니다');
  ['budget', 'nokey', 'ai', 'parse'].forEach(function (k) {
    assert.ok(new RegExp(k + '\\s*:').test(stripComments(ENTER)), '까닭 「' + k + '」 의 설명이 없습니다');
  });
  assert.match(stripComments(ENTER), /가리고 보냈습니다/, '★ 무엇을 가렸는지 안 밝힙니다');
});
