'use strict';
/* 자동개발 — 공개 GitHub 로 개인정보가 나가지 않는다 (대표 지시 2026-09-11)

   대표 지시: 「깃허브에는 모두 공개하면 안된다 데이터들 개인정보가 많이 있다」

   ■ 무엇이 문제였나 (2026-09-11 실측)
     저장소는 PUBLIC 이고 이슈도 켜져 있는데, 자동개발이 **건의 원문과 대표 지시를
     이슈 본문에 그대로** 실었다. 가림망(redactSensitive)이 지우는 것은 이메일·주민·
     전화·금융번호 «넷뿐»이라 **실명·업체명·사건번호는 그대로 남았다.**
     실제 건의가 「○○○ 님 임금체불사건(사건번호 …)」이었다.
     유일한 방어가 대표의 체크칸 하나였는데, 그 건의는 체크할 수 없는 것이었다.

   ■ 이 검사가 지키는 것
     ① 공개 이슈에 건의 «내용»이 한 조각도 안 들어간다 (제목에도)
     ② 그것을 코드가 «스스로» 확인한다 — 나중에 누가 되살려도 그 자리에서 막힌다
     ③ 돈 세는 말이 「낮은 위험」으로 새지 않는다
     ④ 올라갈 코드에 개인정보가 섞이면 밀어 올리기 전에 멈춘다
     ⑤ 검문이 «헛걸리지» 않는다 — 늘 걸리는 검문은 아무도 안 본다 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');

const R = path.join(__dirname, '..');
const S = require(path.join(R, 'functions', 'dev-automation.js'));
const G = require(path.join(R, 'scripts', 'autodev-privacy-gate.js'));
const WF = fs.readFileSync(path.join(R, '.github/workflows/codex-issue-implementation.yml'), 'utf8').replace(/\r\n/g, '\n');
const FETCH = fs.readFileSync(path.join(R, 'scripts/fetch-autodev-task.mjs'), 'utf8').replace(/\r\n/g, '\n');
const ENTER = fs.readFileSync(path.join(R, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');

/* 실제 건의 모양 — 이름만 바꾼 것이다(저장소에 진짜 이름을 적지 않는다) */
const 건의 = {
  suggestionId: 'abc_123',
  title: '2025년 수임 사건, 2026년에 보수가 들어오면 매칭이 안 됩니다',
  content: '25/12/12 수임한 홍길동 님 임금체불사건(사건번호 임금체불-2025-001) 성공보수가 '
    + '26/02/02 입금됐는데 ㈜나래산업 거래내역에서 후보로 안 뜹니다. 010-9876-5432',
  instruction: '홍길동 님 건처럼 해가 바뀐 성공보수가 후보에 뜨게 고쳐 주세요',
};

test('① ★★ 공개 이슈에 건의 내용이 «한 조각도» 없다', function () {
  const issue = S.buildIssue(Object.assign({ risk: 'auto', autoDeploy: false, imageIndexes: [], imageCount: 0 }, 건의));
  const 공개 = issue.title + '\n' + issue.body;
  ['홍길동', '나래산업', '임금체불-2025-001', '010-9876-5432', '성공보수', '거래내역']
    .forEach(function (w) {
      assert.ok(공개.indexOf(w) < 0, '★★ 「' + w + '」 이 공개 이슈에 그대로 실립니다');
    });
  assert.ok(공개.indexOf(건의.title.slice(0, 12)) < 0, '★★ 건의 «제목»이 공개됩니다');
  assert.ok(공개.indexOf(건의.instruction.slice(0, 12)) < 0, '★★ 대표 지시가 공개됩니다');
});

test('② ★ 공개되어도 되는 것은 그대로 남는다 — 쓸모까지 없애지 않는다', function () {
  const issue = S.buildIssue(Object.assign({ risk: 'auto', autoDeploy: false, imageIndexes: [0], imageCount: 2 }, 건의));
  /* ⚠ 「- 건의 ID: `…`」 줄의 모양은 fetch-autodev-task.mjs 가 읽는다 — 바뀌면 통로가 끊긴다 */
  assert.match(issue.body, /- 건의 ID: `abc_123`/, '★★ 보호된 통로가 ID 를 못 찾습니다');
  assert.match(FETCH, /- 건의 ID:/, '★ 통로 쪽이 그 줄을 안 읽습니다');
  assert.match(issue.body, /위험도/);
  assert.match(issue.body, /비공개 참고 캡처: `1개`/);
  assert.match(issue.title, /^\[자동개발\] 건의 abc_123$/, '제목이 번호 하나로 정리되지 않았습니다');
});

test('③ ★★ 코드가 «스스로» 확인한다 — 되살려 놓아도 그 자리에서 막힌다', function () {
  assert.throws(function () {
    S.assertNoLeak('## 자동개발\n### 사용자 건의\n' + 건의.content, [건의.content]);
  }, /건의 내용/, '★★ 새는 것을 스스로 못 잡습니다');
  assert.equal(S.assertNoLeak('건의 ID: abc_123 · 위험도: low', [건의.content, 건의.title]), true);
  assert.equal(S.assertNoLeak('아무 글', [null, undefined, '']), true, '빈 값에서 넘어집니다');
  /* 짧게 겹치는 것은 우연일 수 있다 — 열두 글자가 겹치는 것은 우연이 아니다 */
  assert.equal(S.assertNoLeak('건의', ['건의 내용입니다']), true, '★ 한두 글자에 걸려 아무것도 못 올립니다');
  /* ⚠ 함수가 «있는» 것만으로는 아무것도 안 지킨다 — buildIssue 가 실제로 불러야 한다.
     부르는 줄을 지워도 지금 본문에는 내용이 없어 ① 이 통과한다(2026-09-11 되돌림
     검사에서 드러났다). 그러니 «부르는지»를 따로 못 박는다. */
  const src = fs.readFileSync(path.join(R, 'functions', 'dev-automation.js'), 'utf8');
  const 몸 = src.slice(src.indexOf('function buildIssue('), src.indexOf('function validateExecute('));
  assert.match(몸.replace(/\/\*[\s\S]*?\*\//g, ' '), /assertNoLeak\(/,
    '★★ 이슈를 지으면서 스스로 확인하지 않습니다 — 나중에 한 줄만 되살아나도 그대로 샙니다');
});

test('④ ★★ 돈 세는 말이 「낮은 위험」으로 새지 않는다', function () {
  ['입금 매칭을 고쳐 주세요', '거래내역 후보', '자문료 합계', '미수금 화면',
   '세금계산서 발행', '월말 마감', '성과급 반영', '계약 이관', '성공보수 계산', '부가세 예상']
    .forEach(function (i) {
      assert.equal(S.riskLevel({ instruction: i }), 'high',
        '★★ 「' + i + '」 이 낮은 위험으로 분류돼 사람 눈 없이 배포됩니다');
    });
  assert.equal(S.riskLevel({ instruction: '단추 문구와 여백을 다듬어 주세요' }), 'low',
    '★ 아무것도 아닌 것까지 중요로 올리면 승인이 뜻을 잃습니다');
});

/* ── 공개 전 검문 ─────────────────────────────────────────────────────── */

test('⑤ ★★ 건의에서 온 낱말이 코드에 섞이면 멈춘다', function () {
  const secrets = G.extractSecrets([건의.title, 건의.content, 건의.instruction].join('\n'));
  ['홍길동', '나래산업', '임금체불-2025-001', '010-9876-5432'].forEach(function (w) {
    assert.ok(secrets.indexOf(w) >= 0, '★★ 「' + w + '」 을 비밀로 안 챙깁니다');
  });
  const diff = '+  /* 홍길동 님 사건처럼 해가 바뀐 건 */\n+  var x = 1;';
  assert.equal(G.scanDiff(diff, secrets).ok, false, '★★ 주석에 적힌 이름을 못 잡습니다');
  assert.equal(G.scanDiff('+  var x = 1;', secrets).ok, true, '★ 멀쩡한 바뀜을 막습니다');
});

test('⑥ ★ 흔한 말을 비밀로 삼지 않는다 — 그러면 모든 바뀜이 막힌다', function () {
  const secrets = G.extractSecrets('우리 대표 님과 담당 과장, 해당 노무사가 (주) 대표이사와 함께');
  ['우리', '대표', '담당', '해당', '관련'].forEach(function (w) {
    assert.ok(secrets.indexOf(w) < 0, '★★ 흔한 말 「' + w + '」 을 비밀로 삼았습니다 — 검문이 늘 걸립니다');
  });
});

test('⑦ ★★ 이미 저장소에 있던 낱말은 통과시킨다 — 새로 새는 것만 막는다', function () {
  const diff = '+  var 업체 = "나래산업";';
  assert.equal(G.scanDiff(diff, ['나래산업'], function () { return true; }).ok, true,
    '★★ 이미 있던 낱말까지 막습니다 — 검문이 늘 걸리면 사람이 꺼 버립니다');
  assert.equal(G.scanDiff(diff, ['나래산업'], function () { return false; }).ok, false,
    '★ 새로 들어온 낱말을 안 막습니다');
});

test('⑧ ★ 꼴이 분명한 것은 건의와 상관없이 막는다', function () {
  const r = G.scanDiff('+  var a = "880304-2019283", b = "041-556-3656";', []);
  assert.equal(r.ok, false, '★★ 주민번호·전화번호를 그냥 올립니다');
  assert.deepEqual(r.hits.map(function (h) { return h.kind; }).sort(), ['전화번호', '주민번호'],
    '무엇에 걸렸는지 안 알려 줍니다');
  assert.match(G.report(r), /밀어 올리지 않습니다/, '★ 왜 막혔는지 사람에게 안 말해 줍니다');
});

test('⑨ ★ 빈 서식값은 통과한다 — 검사 자료를 못 쓰게 만들지 않는다', function () {
  ['+  phone: "010-0000-0000"', '+  biz: "000-00-00000"', '+  mail: "a@example.com"',
   '+  tel: "010-1234-5678"'].forEach(function (line) {
    assert.equal(G.scanDiff(line, []).ok, true, '★ 빈 서식값 「' + line.trim() + '」 을 막습니다');
  });
});

test('⑩ ★ 더한 줄만 본다 — 원래 있던 줄까지 보면 첫 검문에서 통째로 걸린다', function () {
  assert.deepEqual(G.addedLines('+++ b/x.js\n+새 줄\n-지운 줄\n 그대로'), ['새 줄']);
  assert.equal(G.scanDiff('-  var a = "880304-2019283";', []).ok, true, '★ 지운 줄에 걸립니다');
});

/* ── 배선 — 만들어만 두고 «안 부르는» 일이 없게 ─────────────────────────── */

test('⑪ ★★ 워크플로가 «밀어 올리기 전에» 검문한다', function () {
  const 검문 = WF.indexOf('scripts/autodev-privacy-gate.js');
  const 밀기 = WF.indexOf('git push --set-upstream');
  assert.ok(검문 > 0, '★★ 검문을 아예 안 부릅니다');
  assert.ok(검문 < 밀기, '★★ 밀어 올린 «뒤»에 검문합니다 — 이미 이력에 남은 뒤입니다');
  assert.match(WF, /rm -rf[^\n]*\.codex-guard\.json/, '★ 비밀 낱말 파일을 안 지웁니다');
  assert.match(FETCH, /extractSecrets\(/, '★★ 검문에 넘길 낱말을 안 챙깁니다');
  assert.ok(!/--title "자동개발: \$ISSUE_TITLE"/.test(WF),
    '★★ PR 제목에 이슈 제목을 그대로 씁니다 — 제목에 업체명이 들어가는 일이 흔합니다');
});

test('⑫ ★ 화면에서 「개인정보 없음 확인」 체크를 없앴다', function () {
  assert.ok(!/id="sgDevPrivacy"/.test(ENTER),
    '★ 사람 눈에 기댄 체크칸이 되살아났습니다 — 기계가 지키게 두세요');
  assert.ok(!/privacyConfirmed/.test(ENTER), '★ 뜻 없는 값을 아직 보냅니다');
  assert.match(ENTER, /GitHub에 공개되는 것은 이것뿐입니다/, '★ 무엇이 공개되는지 안 알려 줍니다');
});
