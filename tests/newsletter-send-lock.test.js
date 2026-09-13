/* 같은 회차가 «두 번» 나가지 않는다 — 그리고 열람 표가 조용히 빠지지 않는다
   ═══════════════════════════════════════════════════════════════════════════
   화면의 App.보내는중 은 그 PC 안에서만 산다. 관리자가 둘이면 서로를 못 봐서,
   같은 순간에 누르면 119곳이 편지를 두 통 받는다. 되돌릴 수 없다.

   ★ 이 검사는 «글자가 있나»만 보지 않는다. 잠금 판단을 functions/news-lock.js 로
     빼 두었으므로, 두 사람이 같은 순간에 누른 상황을 실제로 만들어 본다.
   ⚠ 자 대고 자르기(slice(at, at+12000))를 쓰지 않는다 — 함수가 길어지면 옆 함수를
     통째로 삼켜 «있지도 않은 것»을 통과시킨다. 저장소가 그것으로 main 을 이틀 막았다.
   ⚠ 주석을 먼저 걷는다 — 잘 쓴 주석이 검사를 통과시키면 안 된다. */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const NL = require('../functions/news-lock.js');
const NT = require('../functions/news-track.js');

const ROOT = path.join(__dirname, '..');
const 읽기 = (p) => stripComments(fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n'));
const 서버 = 읽기('functions/index.js');
const 화면 = 읽기('pu-news.html');

/* 함수 하나를 «짝지은 이름 사이»로 뽑는다 — 고정 폭으로 자르지 않는다 */
function 함수몸(src, 시작, 끝) {
  const a = src.indexOf(시작);
  assert.ok(a >= 0, '「' + 시작 + '」 을 못 찾았다 — 이름이 바뀌었나?');
  const b = src.indexOf(끝, a + 시작.length);
  assert.ok(b > a, '「' + 끝 + '」 을 못 찾았다 — 함수 끝을 어디로 잡을지 모른다');
  return src.slice(a, b);
}
const 손누름 = () => 함수몸(서버, 'exports.sendBulkMail', 'exports.sendScheduledMail');
const 자동 = () => 함수몸(서버, 'exports.weeklyNewsletterSend', '\nexports.');

/* ══════════════════════════════════════════════════════════════════════════
   ① 잠금 판단 — 실제로 돌려 본다
   ══════════════════════════════════════════════════════════════════════════ */

test('★★ 두 관리자가 같은 순간에 눌러도 «한 쪽만» 통과한다', () => {
  const t = 1_700_000_000_000;
  const 갑 = NL.잠글까(null, 'req-갑', t, '갑@pureun.kr');
  assert.ok(갑, '먼저 누른 쪽이 못 잠갔다');
  const 을 = NL.잠글까(갑, 'req-을', t + 300, '을@pureun.kr');
  assert.equal(을, null, '뒤에 누른 쪽까지 통과했다 — 119곳이 두 통을 받는다');
});

test('★★ «찬 자리»(null)에서 접지 않는다 — 그러면 멀쩡한 발송이 막힌다', () => {
  /* 파이어베이스 거래는 지금 손안에 있는 값으로 먼저 한 번 부른다. 듣고 있지 않은
     자리면 그 값이 null 이다. 거기서 «못 잠근다»고 답하면 서버에 물어보지도 않고
     끝나, 아무도 안 보내고 있는데 「다른 관리자가 보내는 중」이 뜬다. */
  assert.ok(NL.잠글까(null, 'req-1', Date.now(), '나'),
    'null 에서 접는다 — 첫 누름이 통째로 막힌다');
});

test('★ 이미 보낸 회차는 누가 눌러도 다시 안 잠긴다', () => {
  const 끝난 = NL.마쳤다(NL.잠글까(null, 'req-1', 1000, '갑'), 2000, 'b1');
  assert.equal(끝난.상태, '완료');
  assert.equal(NL.잠글까(끝난, 'req-2', 3000, '을'), null,
    '보낸 회차를 다시 잠갔다 — 같은 편지가 두 번 나간다');
});

test('★ 서버가 죽어 «거는중»으로 남아도 한도가 지나면 풀린다', () => {
  const 갑 = NL.잠글까(null, 'req-갑', 1_000_000, '갑');
  const 조금뒤 = NL.잠글까(갑, 'req-을', 1_000_000 + NL.살아있는한도 - 1, '을');
  assert.equal(조금뒤, null, '한도 안인데 풀렸다');
  const 한참뒤 = NL.잠글까(갑, 'req-을', 1_000_000 + NL.살아있는한도 + 1, '을');
  assert.ok(한참뒤, '한도가 지나도 안 풀린다 — 서버가 한 번 죽으면 영영 못 보낸다');
});

test('★ 그물이 끊겨 «같은 요청»을 다시 물으면 통과시킨다', () => {
  const 처음 = NL.잠글까(null, 'req-1', 5000, '갑');
  const 다시 = NL.잠글까(처음, 'req-1', 6000, '갑');
  assert.ok(다시, '같은 요청을 막았다 — 화면이 다시 물으면 영영 못 보낸다');
  assert.equal(다시.요청한때, 5000, '처음 누른 때를 잃었다');
});

test('요청 번호가 없으면 잠그지 않는다', () => {
  assert.equal(NL.잠글까(null, '', Date.now(), '갑'), null);
  assert.equal(NL.잠글까(null, null, Date.now(), '갑'), null);
});

test('★★ «내가 마친 요청»만 알아본다 — 남의 결과를 내 것으로 돌려주지 않는다', () => {
  const 끝난 = NL.마쳤다(NL.잠글까(null, 'req-갑', 1000, '갑'), 2000, 'b1');
  assert.equal(NL.이미마친내요청인가(끝난, 'req-갑'), true);
  assert.equal(NL.이미마친내요청인가(끝난, 'req-을'), false,
    '남의 발송 결과를 내 요청의 답으로 돌려준다 — 안 보내고 보냈다고 한다');
  assert.equal(NL.이미마친내요청인가(null, 'req-갑'), false);
  const 거는중 = NL.잠글까(null, 'req-갑', 1000, '갑');
  assert.equal(NL.이미마친내요청인가(거는중, 'req-갑'), false, '아직 안 끝났는데 끝났다고 한다');
});

test('걸다 터지면 «오류»로 남겨 바로 다시 누를 수 있다', () => {
  const 갑 = NL.잠글까(null, 'req-갑', 1000, '갑');
  const 틀 = NL.틀어졌다(갑, 2000, '다음메일이 막았습니다');
  assert.equal(틀.상태, '오류');
  assert.ok(NL.잠글까(틀, 'req-을', 2500, '을'), '오류인데도 15분을 기다리게 한다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ② 자리 이름 — 손으로 다시 씻지 않는다
   ══════════════════════════════════════════════════════════════════════════ */

test('★★ 「보냄」 표를 «이미 있는 잣대»로 적는다 — 손으로 씻지 않는다', () => {
  /* 열람은 newsOpen 이 NT.주소열쇠 로 씻은 이름에 적는다. 발송 쪽이 손으로 씻으면
     대문자 한 글자에 그분이 미열람 셈에서 영영 빠진다 — 아무도 모르게. */
  const 몸 = 손누름();
  assert.match(몸, /NT\.보냄표\(/, '보냄 표를 NT.보냄표 로 안 적는다');
  assert.ok(!/replace\(\/\[\.#\$\/\[\\\]\]\/g/.test(몸),
    '자리 이름을 손으로 다시 씻는다 — newsOpen 과 어긋난다');
});

test('★★ 씻는 잣대가 «대문자·앞뒤 빈칸»을 실제로 지운다', () => {
  const a = NT.주소열쇠('  Hong.Gil@Daum.NET ');
  assert.equal(a, NT.주소열쇠('hong.gil@daum.net'), '대문자·빈칸이 다른 자리를 만든다');
  assert.ok(!a.includes('.'), '점이 남았다 — 파이어베이스 자리 이름이 될 수 없다');
});

test('★ 화면의 대장도 «같은 잣대»로 씻는다', () => {
  const 몸 = cutFn(화면, 'async function 진짜보내기(');
  const 줄 = 몸.slice(몸.indexOf('const 대장'), 몸.indexOf('전문담기'));
  assert.match(줄, /toLowerCase\(\)/, '대장 열쇠를 소문자로 안 씻는다 — 열람 셈이 어긋난다');
});

test('★★ 서버는 대장(받는이)을 «걸고 나서» 쓰지 않는다', () => {
  /* 대장은 편지가 나가기 «전»에 있어야 한다 — 화면이 걸기 전에 적는다.
     서버가 나중에 또 쓰면, 먼저 열어 본 분의 표가 「모르는 번호」로 버려지고,
     날 주소로 덮으면 열람 자리가 아예 «만들 수 없는 이름»이 된다. */
  const 몸 = 손누름();
  assert.ok(!/받는이\//.test(몸), '손누름 발송이 대장을 덮어쓴다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ③ 잠금은 «한 칸»에, 대기열과 상태는 «한 번»에
   ══════════════════════════════════════════════════════════════════════════ */

test('★ 잠금을 회차 «통째»에 걸지 않는다', () => {
  /* 회차에는 25,000자 전문과 받는 분 주소가 들어 있다. 잠금 한 칸 때문에
     그것을 통째로 읽어 통째로 다시 쓰면, 부딪힐 때마다 그만큼 다시 돈다. */
  const 몸 = 손누름();
  assert.match(몸, /발송잠금"\)\.transaction|lockRef\.transaction/,
    '잠금을 회차 한 칸에 안 건다');
  assert.ok(!/issueRef\.transaction\(/.test(몸), '회차 통째에 거래를 건다');
});

test('★★ 대기열·발송 상태·완료 잠금을 «한 번»에 확정한다', () => {
  const 몸 = 손누름();
  const 대기열 = 몸.indexOf('MD.CARDS_ROOT + "/scheduled/" + key');
  const 상태 = 몸.indexOf('upd[issue + "상태"] = "발송"');
  const 잠금 = 몸.indexOf('NL.마쳤다(');
  const 한번 = 몸.indexOf('await db.ref().update(upd)');
  assert.ok(대기열 >= 0 && 상태 > 대기열 && 잠금 > 상태 && 한번 > 잠금,
    '나눠 쓰면 「걸었는데 상태는 초안」인 회차가 남아 두 번 나간다');
});

test('★ 링크 목록을 «자리가 밀리게» 손대지 않는다', () => {
  /* 링크는 자리 번호로 찾는다(news-track 링크찾기). 걸러 내면 번호가 밀려
     엉뚱한 곳으로 가고, 앞의 몇 개만 옮기면 나머지는 말없이 튕긴다. */
  const 몸 = 손누름();
  const m = /newsletterSend\.links\.slice\(0,\s*(\d+)\)/.exec(몸);
  assert.ok(m, '링크 목록을 옮기는 자리를 못 찾았다');
  assert.ok(Number(m[1]) >= 500,
    '링크를 ' + m[1] + '개에서 자른다 — 넘는 링크가 조용히 튕긴다');
  const 링크줄 = 몸.slice(몸.indexOf('newsletterSend.links'), 몸.indexOf('발송잠금"]'));
  assert.ok(!/\.filter\(/.test(링크줄), '링크를 걸러 낸다 — 자리 번호가 밀린다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ④ 잠금은 «한 벌»이다 — 화면에 또 두지 않는다
   ══════════════════════════════════════════════════════════════════════════ */

test('★★ 화면은 잠그지 않는다 — 두 벌이면 서로 어긋난다', () => {
  const 몸 = cutFn(화면, 'async function 진짜보내기(');
  assert.ok(!/\.transaction\(/.test(몸),
    '화면이 따로 잠근다 — 서버 잠금과 두 벌이 되고, 찬 자리에서 접히면 멀쩡한 발송이 막힌다');
  assert.match(몸, /requestId:\s*발송요청/, '누름을 알아볼 번호를 서버에 안 보낸다');
  const 번호 = 몸.indexOf('발송요청번호()');
  const 걸기 = 몸.indexOf('await 걸기(');
  assert.ok(번호 >= 0 && 걸기 > 번호, '번호를 걸기 전에 안 만든다');
});

test('★★ 서버가 확정한 뒤 화면이 발송 기록을 다시 쓰지 않는다', () => {
  /* 다시 쓰면, 서버는 이미 걸었는데 화면 통신만 끊겼을 때 «안 보냈다»고 거짓말한다. */
  const 몸 = cutFn(화면, 'async function 진짜보내기(');
  const 뒤 = 몸.slice(몸.indexOf('const j = await 걸기('));
  assert.ok(!/newsletter\/issues\/'.*\.update/.test(뒤), '화면이 회차를 다시 쓴다');
  assert.ok(!/newsletter\/opens/.test(뒤), '화면이 보냄 표를 또 쓴다');
});

test('★★ 회차를 «통째로» 읽지 않는다 — 안에 받는 분들의 주소가 있다', () => {
  /* 회차 한 칸에는 25,000자 전문과 119곳의 주소가 들어 있다. 답 세 칸을 주려고
     그것을 통째로 읽어 오지 않는다(같은 까닭으로 newsView 도 칸을 골라 읽는다). */
  const 몸 = 손누름();
  assert.ok(!/issueRef\.once\(/.test(몸), '회차를 통째로 읽는다');
});

test('★ 자동발송도 «손누름과 같은 잠금»을 지난다', () => {
  const 몸 = 자동();
  assert.match(몸, /NL\.잠글까\(/, '자동발송이 다른 잣대로 잠근다 — 손누름과 겹칠 수 있다');
  assert.match(몸, /발송잠금"\)\.transaction|child\("발송잠금"\)/, '회차 한 칸에 안 건다');
  assert.match(몸, /NL\.마쳤다\(/, '자동발송이 완료 잠금을 안 남긴다');
});

test('★ 뉴스레터 발송은 총괄관리자만 — 자료 메일 길로 우회할 수 없다', () => {
  const 몸 = 손누름();
  const 문 = 몸.indexOf('uid_roles/');
  const 잠금 = 몸.indexOf('.transaction(');
  assert.ok(문 >= 0 && 잠금 > 문, '관리자 확인보다 잠금이 먼저다 — 아무나 회차를 잠글 수 있다');
});
