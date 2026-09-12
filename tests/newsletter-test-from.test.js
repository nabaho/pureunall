/* 시험 발송도 «진짜와 같은 주소»로 나간다
   ═══════════════════════════════════════════════════════════════════════════
   대표 화면 2026-09-12(첫 시험 발송): 알림이 「보낸 곳 370-6@daum.net」이었다.
   그런데 설정의 보내는주소는 370-6@hanmail.net 이고, 진짜 발송은 그쪽으로 나간다.

   ★ 왜 같아야 하나 — 「시험도 진짜와 똑같이 나가야 시험이다」(2026-09-06 대표 화면).
     그때는 {추적열쇠}와 링크들이 달라 시험 편지의 링크가 다 튕겼다. 보내는 주소는
     받는 쪽이 «누구한테서 왔나»를 보는 자리이고 스팸 판정도 그것으로 한다 —
     시험에서 다른 주소로 나가면 정작 봐야 할 것을 안 본 셈이 된다.

   ⚠ 아무 주소나 받으면 «남의 이름으로 보내는 길»이 된다. 그래서 대량 발송과
     «같은 조이기»를 지난다 — 사서함 이름이 계정과 같고, 도메인은 다음/한메일만. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');
const MB = require('../functions/mail-bulk.js');
const MD = require('../functions/mail-deliver.js');

const ROOT = path.join(__dirname, '..');
const idx = stripComments(fs.readFileSync(path.join(ROOT, 'functions/index.js'), 'utf8')
  .replace(/\r\n/g, '\n'));
const news = stripComments(fs.readFileSync(path.join(ROOT, 'pu-news.html'), 'utf8')
  .replace(/\r\n/g, '\n'));

function 시험함수몸() {
  const i = idx.indexOf('exports.sendMaterialMail');
  assert.ok(i >= 0, 'sendMaterialMail 이 없다');
  const j = idx.indexOf('exports.', i + 10);
  return idx.slice(i, j > 0 ? j : idx.length);
}

test('★★ 시험 발송이 «바라는 주소»를 받아 준다 — 계정 주소로만 나가지 않는다', () => {
  const 몸 = 시험함수몸();
  assert.match(몸, /보내는주소고르기\(body\.from/,
    '부르는 쪽이 바라는 주소를 안 본다 — 시험만 다른 주소로 나간다');
});

test('★★ 아무 주소나 받지 않는다 — 대량 발송과 «같은 조이기»를 지난다', () => {
  /* 조이기를 안 거치면 화면에 아무 주소나 넣어 «남의 이름»으로 보내는 길이 열린다. */
  const 몸 = 시험함수몸();
  assert.ok(!/const from = String\(body\.from/.test(몸),
    '바라는 주소를 그대로 쓴다 — 조이기를 안 지난다');
  assert.match(몸, /mailUserAsync\(\)/, '계정 주소를 안 읽는다 — 무엇과 견줄지가 없다');
});

test('조이기는 «같은 사서함»만 통과시킨다', () => {
  const 계정 = '370-6@daum.net';
  assert.equal(MB.보내는주소고르기('370-6@hanmail.net', 계정), '370-6@hanmail.net',
    '같은 사서함의 다른 별칭이 막혔다 — 뉴스레터가 예전 주소로 못 나간다');
  assert.equal(MB.보내는주소고르기('남의계정@daum.net', 계정), 계정,
    '사서함 이름이 다른데 통과했다 — 남의 이름으로 보내는 길이다');
  assert.equal(MB.보내는주소고르기('370-6@gmail.com', 계정), 계정,
    '다른 도메인이 통과했다');
  assert.equal(MB.보내는주소고르기('', 계정), 계정, '안 주면 계정 주소여야 한다');
});

test('★ 한메일과 다음메일은 «같은 열쇠»를 쓴다 — 주소를 바꿔도 비밀번호가 그대로다', () => {
  /* 이것이 아니면 주소만 바꿨다가 535(인증 실패)로 발송이 통째로 멎는다. */
  const a = MD.우체국고르기('370-6@daum.net');
  const b = MD.우체국고르기('370-6@hanmail.net');
  assert.equal(a.열쇠이름, b.열쇠이름, '같은 사서함인데 열쇠 이름이 다르다');
  assert.equal(a.host, b.host, '보내는 서버가 다르다');
});

test('★ 화면은 시험에도 보내는 주소를 «실어 보낸다»', () => {
  const i = news.indexOf('async function 시험발송');
  assert.ok(i >= 0, '시험발송 을 못 찾았다');
  const 몸 = news.slice(i, news.indexOf('\nasync function ', i + 10));
  assert.match(몸, /from:\s*보내는주소\(\)/,
    '시험 요청에 보내는 주소를 안 싣는다 — 서버가 알 길이 없다');
});
