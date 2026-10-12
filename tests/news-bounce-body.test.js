'use strict';
/* 반송 안내 메일의 «본문»까지 읽어 갈래·실패 주소를 판정 — 실행: node --test tests/news-bounce-body.test.js
   (대표 「추천대로」 2026-10-12 — 직전 제안 «본문까지 자동으로 읽게 만들 수 있는데, 만들까요?»)

   ■ 이 검사가 지키는 «규칙»
     ① 기존 판정은 그대로 — 이미 갈래와 주소가 풀린 반송은 본문을 «읽지 않는다»(메일함을 두드리지 않는다)
     ② 후보만 읽는다 — 보낸 뒤 온 것 · 이미 기록한 메일 아님 · 대기열 줄 아님 · 사람 회신·자동회신 아님 · «반송 같다» · 한도까지
     ③ 사유가 본문 HTML 에 있는 반송(하이웍스 용량 초과 · 「발송실패」 붙여 쓴 고객사 서버)을 알아본다 — 알아보고 «주소»를 명단에 붙인다
     ④ ★ 자동으로 명단에서 «빼는» 것은 확실한 근거가 있을 때만 — 안내 문구(「…계정이 없거나 용량이 초과되었을 수 있습니다」)에 걸린
        애매한 «없는 주소»는 «모름»으로 내려 사람이 본다(잘못 빼는 쪽이 못 빼는 쪽보다 나쁘다)
     ⑤ 인용·원본 표지에서 자른다 — 반송이 되돌려 준 우리 편지 글(「정책」·「차단」·「용량」)에 낚이지 않는다
     ⑥ 읽기가 어떻게 되든 스캔은 그대로 — 던지지 않고 «원래 메일들»을 돌려준다
     ⑦ 읽기만 한다 — 읽음 표시·이동·삭제·쓰기로 여는 길이 «없다» · 주소를 로그에 안 적는다
     ⑧ 반송모으기는 줄에 «판정»이 실려 있으면 그것을 쓴다(없으면 예전 그대로) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = path.join(__dirname, '..');
const BB = require(path.join(R, 'functions', 'news-bounce-body.js'));
const W = require(path.join(R, 'functions', 'news-watch.js'));
const C = require(path.join(R, 'js', 'pu-news-core.js'));
const { 주석걷기 } = require('./helpers/strip-comments.js');

const 서버원본 = fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8');
const 모듈원본 = fs.readFileSync(path.join(R, 'functions', 'news-bounce-body.js'), 'utf8');

/* ── 가짜 자료 — 이름·주소는 전부 가짜 ── */
const 명단 = [
  { email: 'ceo@dara.example', company: '다라정밀', 누구: '대표자', 유형: '급여', 사업장: 'co-2' },
  { email: 'yju@maba.example', company: '마바물산', 누구: '대표자', 유형: '자문', 사업장: 'co-3' },
  { email: 'hr@saa.example', company: '사아건설', 누구: '담당자', 유형: '자문', 사업장: 'co-4' },
  { email: 'old@gana.example', company: '가나상사', 누구: '담당자', 유형: '자문', 사업장: 'co-1' },
];
const 보낸때 = Date.parse('2026-10-12T06:00:00+09:00');
/* 반송이 미리보기에 싣는 것은 «우리 편지 첫머리» — 사유 낱말이 없다(실측: 코디스·충남 모두 그랬다) */
const 우리편지 = '푸른노무법인 2026년 10월 2주차 주간뉴스레터 입니다. 이번 주 노동 소식을 한눈에 전해 드립니다.';

const 줄 = {
  /* 가비아 하이웍스 — 제목에 받는 곳 주소, 미리보기엔 우리 편지, 사유는 본문 HTML(메일함 용량 초과 → 일시) */
  하이웍스: { u: 1001, e: 'noreply@hiworks.com', f: '하이웍스', s: "failure notice: To - 'ceo@dara.example'", p: 우리편지, d: 보낸때 + 1e6, a: 1, an: ['original-message.eml'] },
  /* 고객사 메일서버 — 「발송실패」를 붙여 쓴다(Core 낱말은 「발송 실패」) · 받는 주소·사유는 본문 → 없는 주소(확실) */
  고객사: { u: 1002, e: 'mailadmin@maba.example', f: '관리자', s: '[발송실패 안내] 푸른노무법인 2026년 10월 2주차 주간뉴스레터 입니다.', p: '', d: 보낸때 + 2e6, a: 1, an: ['original-message.eml'] },
  /* 안내 문구에 걸리는 모호한 반송 → 모름 */
  모호: { u: 1003, e: 'postmaster@saa.example', f: '', s: 'Mail delivery failed: returning message to sender', p: '', d: 보낸때 + 3e6, a: 0 },
  /* 사람 회신 — 용량 이야기를 하지만 반송이 아니다 */
  회신: { u: 1004, e: 'hr@saa.example', f: '홍길동', s: 'RE: 푸른노무법인 주간뉴스레터', p: '저희 메일함 용량이 가득 차서 못 받았나 봅니다', d: 보낸때 + 4e6, a: 0 },
  /* 이미 풀린 반송 — 구글(제목·미리보기에 갈래와 주소가 다 있다) */
  구글: { u: 1005, e: 'mailer-daemon@googlemail.com', f: '', s: 'Delivery Status Notification (Failure)', p: "** Address not found ** Your message wasn't delivered to old@gana.example because the address couldn't be found", d: 보낸때 + 5e6, a: 0 },
};
const 파싱 = {
  하이웍스: { html: '<html><body><table><tr><td>수신자</td><td>ceo@dara.example</td></tr><tr><td>실패 사유</td><td>할당된 메일 용량이 없습니다. (User\'s Disk Quota Exceeded)</td></tr></table></body></html>', text: '' },
  고객사: { html: '<div>메일 발송에 실패하였습니다.</div><div>수신자 yju@maba.example</div><div>응답 501 RCPT TO: user unknown</div>', text: '' },
  모호: { html: '<p>메일 발송에 실패하였습니다. 받는 사람: hr@saa.example</p><p>수신자 계정이 없거나 메일함 용량이 초과되었을 수 있습니다.</p>', text: '' },
};
const 메일들 = (...이름들) => Object.assign({}, ...이름들.map((n) => ({ [String(줄[n].u)]: Object.assign({}, 줄[n]) })));
const 열쇠 = (n) => String(줄[n].u);
/* 가짜 «읽기» — 불린 열쇠를 적어 둔다 */
function 읽개(맵 = 파싱) {
  const 불림 = [];
  const 읽기 = async (열쇠들) => { 불림.push(열쇠들.slice()); const o = {}; 열쇠들.forEach((k) => { const 이름 = Object.keys(줄).find((n) => String(줄[n].u) === k); o[k] = (이름 && 맵[이름]) || null; }); return o; };
  return { 읽기, 불림 };
}

/* ══════════════════ 반송 «같은가» (읽기 전 눈치) ══════════════════ */

test('제목 낱말·시스템 보낸이·.eml 첨부 중 하나면 «반송 같다» — 붙여 쓴 「발송실패」도', () => {
  assert.equal(BB.반송같은가({ s: '[발송실패 안내] 뉴스레터' }), true, '붙여 쓴 「발송실패」를 못 알아본다 — Core 낱말은 「발송 실패」(띄어 씀)');
  assert.equal(BB.반송같은가({ s: '메일 발송 실패' }), true);
  assert.equal(BB.반송같은가({ s: 'failure notice: To - x' }), true);
  assert.equal(BB.반송같은가({ s: '안녕하세요', e: 'postmaster@x.example' }), true);
  assert.equal(BB.반송같은가({ s: '안녕하세요', e: 'mailadmin@x.example' }), true);
  assert.equal(BB.반송같은가({ s: '안녕하세요', e: 'a@x.example', an: ['원본.EML'] }), true);
});

test('사람·광고 메일은 «반송 같다»가 아니다 — admin·noreply 같은 흔한 이름만으로는 안 본다', () => {
  assert.equal(BB.반송같은가({ s: 'RE: 푸른노무법인 주간뉴스레터', e: 'hr@saa.example' }), false);
  assert.equal(BB.반송같은가({ s: '가을 맞이 세일', e: 'noreply@shop.example' }), false);
  assert.equal(BB.반송같은가({ s: '안내', e: 'admin@client.example' }), false, '사람이 쓰는 admin 주소까지 반송으로 읽는다');
  assert.equal(BB.반송같은가({ s: '안내', e: 'a@x.example', an: ['공문.pdf'] }), false);
  assert.equal(BB.반송같은가({}), false);
});

/* ══════════════════ 확실한 «없는 주소» 근거 ══════════════════ */

test('★ 확실한 근거 — user unknown · no such user · 5.1.1 · RCPT TO … unknown · 사유 칸의 한국어', () => {
  ['501 RCPT TO: user unknown', 'No such user here', 'Address not found', '550 5.1.1 The email account does not exist',
   'Recipient address rejected: User unknown in virtual mailbox table', 'The user does not exist', '5.1.2 Bad destination system address']
    .forEach((s) => assert.equal(BB.확실한없는주소(s), true, s));
  assert.equal(BB.확실한없는주소('실패 사유: 존재하지 않는 사용자입니다'), true, '사유 칸의 한국어');
  assert.equal(BB.확실한없는주소('실패 사유 받는 사람 계정이 없습니다'), true);
  /* 낱말 하나만 있을 때 — 다른 근거가 대신 걸어 주지 않게 «그 낱말만» 든 글로 */
  assert.equal(BB.확실한없는주소('Diagnostic: User unknown'), true, '「user unknown」 낱말이 근거로 안 쳐진다');
  assert.equal(BB.확실한없는주소('550 No such user here'), true);
  assert.equal(BB.확실한없는주소('Status: 5.1.1'), true);
});

test('★★ 한국어 근거는 «사유 표지» 근처에서만 — 표지 없이 글 어디에 있어도 근거가 되면 안내 문구에 걸린다', () => {
  assert.equal(BB.확실한없는주소('메일 발송에 실패하였습니다. 참고: 존재하지 않는 사용자에게 보낸 메일은 반송될 수 있습니다.'), false,
    '사유 표지 없는 안내 문구(존재하지 않는 사용자에게 …)를 근거로 읽었다');
  assert.equal(BB.확실한없는주소('메일 발송에 실패하였습니다. 사유: 존재하지 않는 사용자입니다.'), true);
});

test('★★ 안내 문구는 근거가 아니다 — 「계정이 없거나 용량이 초과되었을 수 있습니다」는 사유가 아니라 «가능성»', () => {
  assert.equal(BB.확실한없는주소('메일 발송에 실패하였습니다. 수신자 계정이 없거나 메일함 용량이 초과되었을 수 있습니다.'), false,
    '사유 표지 없는 한국어 문구에 걸려 멀쩡한 주소를 뺀다');
  assert.equal(BB.확실한없는주소('주소가 없는 경우에는 다시 확인해 주세요'), false);
  assert.equal(BB.확실한없는주소('할당된 메일 용량이 없습니다 (Disk Quota Exceeded)'), false, '용량 초과를 없는 주소로 읽었다');
  assert.equal(BB.확실한없는주소(''), false);
  assert.equal(BB.확실한없는주소(undefined), false);
});

/* ══════════════════ 본문 글 ══════════════════ */

test('HTML 만 있는 반송의 본문을 글로 — text 가 비어도 읽는다', () => {
  const 글 = BB.윗글(파싱.하이웍스);
  assert.match(글, /수신자/);
  assert.match(글, /ceo@dara\.example/);
  assert.match(글, /Disk Quota Exceeded/);
  assert.doesNotMatch(글, /<[a-z]/i, '태그가 남았다');
});

test('★ 인용·원본 표지에서 자른다 — 되돌려 준 우리 편지 글에 낚이지 않는다', () => {
  const 글 = BB.윗글({ text: '실패 사유: 용량 초과 (quota exceeded)\n\n-----Original Message-----\n정책 변경과 차단 규정 — user unknown no such user', html: '' });
  assert.match(글, /quota exceeded/);
  assert.doesNotMatch(글, /정책|차단|user unknown/, '원본 표지 아래 글까지 읽었다');
  const 머리 = BB.윗글({ text: '발송 실패 안내\n수신자 a@x.example\nReporting-MTA: dns; x.example\nFinal-Recipient: rfc822; a@x.example', html: '' });
  assert.doesNotMatch(머리, /Reporting-MTA|Final-Recipient/i);
  const 영문 = BB.윗글({ text: 'Delivery failed\n--- Original message headers ---\nSubject: 정책 차단', html: '' });
  assert.doesNotMatch(영문, /정책/);
});

test('앞 1500자만 · 첨부(원본 .eml)는 읽지 않는다', () => {
  const 길게 = BB.윗글({ text: '가'.repeat(5000), html: '' });
  assert.ok(길게.length <= BB.윗글자수, '본문 전체를 읽는다');
  const 첨부 = BB.윗글({ text: '발송 실패', html: '', attachments: [{ contentType: 'message/rfc822', filename: 'original-message.eml', content: Buffer.from('user unknown 정책 차단') }] });
  assert.doesNotMatch(첨부, /정책|user unknown/, '첨부(우리 편지 원본)까지 읽는다');
  assert.equal(BB.윗글(null), '');
  assert.equal(BB.윗글({}), '');
});

/* ══════════════════ 실패한 «받는 곳» 주소 고르기 ══════════════════ */

test('받는 곳 표지 뒤의 명단 주소가 먼저 — 우리 보내는 주소·다른 주소가 섞여도', () => {
  const 명 = { 'ceo@dara.example': 1, 'hr@saa.example': 1 };
  const 글 = '보낸 사람 hr@saa.example 이(가) 보낸 편지를 수신자 ceo@dara.example 에게 전달하지 못했습니다. 370-6@hanmail.net';
  const 낸 = BB.명단주소앞으로(글, ['hr@saa.example', 'ceo@dara.example', '370-6@hanmail.net'], 명);
  assert.equal(낸[0], 'ceo@dara.example', '「수신자」 뒤의 주소가 먼저여야 한다');
  assert.equal(낸[낸.length - 1], '370-6@hanmail.net', '명단 밖 주소는 맨 뒤');
});

test('「photo 」·「auto 」 속의 to 를 받는 곳 표지로 읽지 않는다', () => {
  const 명 = { 'a@x.example': 1, 'b@x.example': 1 };
  const 낸 = BB.명단주소앞으로('see photo a@x.example and 수신자 b@x.example', ['a@x.example', 'b@x.example'], 명);
  assert.equal(낸[0], 'b@x.example');
});

/* ══════════════════ 판정 ══════════════════ */

const 판 = (이름) => BB.판정하기(줄[이름], BB.윗글(파싱[이름]), 명단집합());
function 명단집합() { const 명 = {}; 명단.forEach((x) => { 명[x.email] = x; }); return 명; }

test('★★ 하이웍스 — 메일함 용량 초과는 «일시», 받는 곳은 제목에서', () => {
  const r = 판('하이웍스');
  assert.equal(r.갈래, '일시');
  assert.equal(r.주소들[0], 'ceo@dara.example');
  assert.equal(r.본문읽음, true);
  assert.equal(r.반송, true);
  assert.match(r.원문, /Quota Exceeded|용량/, '표에 「까닭 모름」 대신 실제 사유가 한 줄로 보여야 한다');
});

test('★★ 고객사 서버 — 붙여 쓴 「발송실패」·본문의 RCPT TO: user unknown 은 «확실한 없는 주소»', () => {
  const r = 판('고객사');
  assert.equal(r.갈래, '없는주소');
  assert.equal(r.확실, true);
  assert.equal(r.주소들[0], 'yju@maba.example', '본문에서 받는 곳 주소를 못 뽑았다');
});

test('★★★ 안내 문구에 걸린 «없는 주소»는 «모름»으로 내린다 — 자동으로 빼지 않는다', () => {
  const r = 판('모호');
  assert.equal(r.갈래, '모름', '「계정이 없거나 … 있습니다」 문구로 멀쩡한 주소를 뺄 판이다');
  assert.equal(r.확실, false);
  assert.equal(r.주소들[0], 'hr@saa.example', '사람이 볼 수 있게 받는 곳은 붙인다');
});

test('사람 회신은 판정하지 않는다(null) — 용량 이야기를 해도 반송이 아니다', () => {
  assert.equal(BB.판정하기(줄.회신, '저희 메일함 용량이 가득 차서 못 받았나 봅니다', 명단집합()), null);
});

test('제목이 낯선 안내는 «제목 눈치 + 본문의 반송 낱말» 둘 다 있어야 반송으로 본다', () => {
  const 낯선 = { s: '확인 부탁드립니다', e: 'mailadmin@zeta.example', p: '', d: 보낸때 + 1 };
  assert.equal(BB.판정하기(낯선, '수신자 ceo@dara.example 응답 501 RCPT TO: user unknown', 명단집합()).갈래, '없는주소');
  assert.equal(BB.판정하기(낯선, '안녕하세요 회의 일정입니다. 용량이 가득 찼습니다', 명단집합()), null,
    '반송 낱말(수신자·발송 실패 …)이 없는데 반송으로 읽었다');
  assert.equal(BB.판정하기({ s: '일정 안내', e: 'a@zeta.example', p: '' }, '수신자 ceo@dara.example user unknown', 명단집합()), null,
    '보낸이·제목에 반송 눈치가 없는데 본문 낱말만으로 반송으로 읽었다');
});

test('읽은 글이 비면 판정하지 않는다 — 기계 반송이어도(예전 판정을 «모름»으로 덮어쓰지 않게)', () => {
  assert.equal(BB.판정하기(줄.고객사, '', 명단집합()), null);
  assert.equal(BB.판정하기(줄.고객사, undefined, 명단집합()), null);
  assert.equal(BB.판정하기(줄.하이웍스, '', 명단집합()), null, '기계 반송인데 본문이 비었다고 «모름»으로 덮어쓴다');
});

test('★ 사유 낱말이 없는 반송은 «모름» — 표의 원문 한 줄은 «본문»에서(제목만 되풀이하지 않는다)', () => {
  const 글 = '메일 발송에 실패하였습니다. 받는 사람 hr@saa.example 에게 전달하지 못했습니다.';
  const r = BB.판정하기(줄.모호, 글, 명단집합());
  assert.equal(r.갈래, '모름');
  assert.match(r.원문, /전달하지 못/, '「까닭 모름」 줄의 원문이 제목뿐이면 사람이 원문을 열어 봐야 한다');
  assert.equal(r.주소들[0], 'hr@saa.example');
});

/* ══════════════════ 후보 고르기 ══════════════════ */

const 후보열쇠 = (맵, 덧) => BB.후보고르기(맵, Object.assign({ 명단, 보낸때, 기존: {} }, 덧 || {})).map((c) => c.k);

test('★ 후보 — 까닭 모름·못 알아본 것만. 이미 풀린 반송(구글)·사람 회신은 읽지 않는다', () => {
  const 키들 = 후보열쇠(메일들('하이웍스', '고객사', '모호', '회신', '구글'));
  assert.deepEqual(키들.sort(), [열쇠('하이웍스'), 열쇠('고객사'), 열쇠('모호')].sort());
  assert.ok(!키들.includes(열쇠('구글')), '이미 갈래와 주소가 풀린 반송까지 본문을 읽는다 — 메일함을 괜히 두드린다');
  assert.ok(!키들.includes(열쇠('회신')));
});

test('후보 — 보낸 뒤 온 것만 · 이미 기록한 메일 · 대기열 줄 · 이미 판정한 줄은 뺀다', () => {
  const 전 = 메일들('고객사'); 전[열쇠('고객사')].d = 보낸때 - 1;
  assert.deepEqual(후보열쇠(전), [], '보내기 전 메일을 읽었다');
  const 기존 = { k1: { 메일: { [열쇠('고객사')]: true } } };
  assert.deepEqual(후보열쇠(메일들('고객사'), { 기존 }), [], '이미 기록한 메일을 또 읽는다(매일 되풀이)');
  const 대기 = { q_a: { e: 'mailer-daemon@발송서버', s: '발송 실패: x@y.example', p: '550 5.1.1', d: 보낸때 + 1 } };
  assert.deepEqual(후보열쇠(대기), [], '대기열 줄(q_)은 이미 사유가 다 있다');
  const 끝 = 메일들('고객사'); 끝[열쇠('고객사')].판정 = { 갈래: '일시' };
  assert.deepEqual(후보열쇠(끝), [], '이미 판정한 줄을 또 읽는다');
});

test('★ 후보 — 갈래는 풀렸는데 «명단 주소»를 못 붙인 반송은 읽는다(주소가 본문에 있다)', () => {
  const 갈래만 = { u: 3001, e: 'mailer-daemon@googlemail.com', s: 'Delivery Status Notification (Failure)', p: "** Address not found ** Your message wasn't delivered because the address couldn't be found", d: 보낸때 + 1e6 };
  assert.equal(C.반송갈래(갈래만).갈래, '없는주소', '이 시험 자료는 갈래가 이미 풀려 있어야 한다');
  assert.deepEqual(후보열쇠({ 3001: 갈래만 }), ['3001'], '갈래만 풀려도 «풀림»으로 치면 주소를 영영 못 붙인다');
});

test('후보 — 사람의 수신거부 회신은 «반송 같은» 보낸이여도 읽지 않는다', () => {
  const 회신 = { u: 3002, e: 'mailadmin@x.example', s: 'RE: 푸른노무법인 주간뉴스레터 수신거부 요청', p: '앞으로 뉴스레터는 보내지 마세요', d: 보낸때 + 1e6 };
  assert.equal(BB.반송같은가(회신), true, '이 시험 자료는 «반송 같은» 눈치를 가져야 한다');
  assert.equal(C.반송갈래(회신).갈래, '수신거부');
  assert.deepEqual(후보열쇠({ 3002: 회신 }), [], '사람의 수신거부 회신을 반송으로 읽었다');
});

test('후보 — 새것부터 한도까지', () => {
  const 맵 = {};
  for (let i = 0; i < 30; i++) 맵[String(2000 + i)] = { u: 2000 + i, e: 'postmaster@x.example', s: '발송실패 안내', p: '', d: 보낸때 + 1000 * (i + 1) };
  const 낸 = BB.후보고르기(맵, { 명단, 보낸때, 기존: {}, 한도: 5 });
  assert.equal(낸.length, 5);
  assert.equal(낸[0].k, '2029', '오래된 것부터 읽는다');
  assert.equal(BB.후보고르기(맵, { 명단, 보낸때, 기존: {}, 한도: 0 }).length, 0);
  assert.ok(BB.한도기본 >= 1 && BB.한도기본 <= 50, '한도가 없으면 반송이 많은 날 메일함을 계속 두드린다');
});

/* ══════════════════ 보강하기 ══════════════════ */

test('★★ 보강 — 후보의 본문을 읽어 줄에 판정을 싣는다 · 나머지 줄은 그대로 · 넘겨받은 지도는 안 고친다', async () => {
  const 원 = 메일들('하이웍스', '고객사', '모호', '회신', '구글');
  const 복사 = JSON.stringify(원);
  const { 읽기 } = 읽개();
  const r = await BB.보강하기({ 메일들: 원, 명단, 보낸때, 기존: {}, 읽기 });
  assert.equal(JSON.stringify(원), 복사, '넘겨받은 지도를 고쳤다 — 호출한 쪽의 «예전 판정» 비교가 깨진다');
  assert.equal(r.후보수, 3);
  assert.equal(r.읽은수, 3);
  assert.equal(r.고친수, 3);
  assert.equal(r.메일들[열쇠('하이웍스')].판정.갈래, '일시');
  assert.equal(r.메일들[열쇠('고객사')].판정.갈래, '없는주소');
  assert.equal(r.메일들[열쇠('모호')].판정.갈래, '모름');
  assert.equal(r.메일들[열쇠('회신')].판정, undefined);
  assert.equal(r.메일들[열쇠('구글')].판정, undefined);
  assert.ok(String(r.메일들[열쇠('하이웍스')].p).length <= BB.넘길글자수, 'AI·표에 본문을 통째로 넘긴다');
});

test('읽을 후보가 없으면 읽기를 «부르지 않는다»', async () => {
  const { 읽기, 불림 } = 읽개();
  const r = await BB.보강하기({ 메일들: 메일들('회신', '구글'), 명단, 보낸때, 기존: {}, 읽기 });
  assert.equal(불림.length, 0, '후보가 없는데 메일함에 접속했다');
  assert.equal(r.후보수, 0);
});

test('읽기는 한 번에 «후보 열쇠들»만 — 한도 안', async () => {
  const { 읽기, 불림 } = 읽개();
  await BB.보강하기({ 메일들: 메일들('하이웍스', '고객사', '모호', '회신', '구글'), 명단, 보낸때, 기존: {}, 읽기 });
  assert.equal(불림.length, 1, '메일함에 여러 번 접속한다');
  assert.deepEqual(불림[0].sort(), [열쇠('하이웍스'), 열쇠('고객사'), 열쇠('모호')].sort());
});

test('★★★ 읽기가 터져도 던지지 않는다 — «원래 메일들»을 그대로 돌려준다(스캔은 계속 돈다)', async () => {
  const 원 = 메일들('하이웍스', '고객사');
  const r = await BB.보강하기({ 메일들: 원, 명단, 보낸때, 기존: {}, 읽기: async () => { throw new Error('IMAP 끊김'); } });
  assert.equal(r.메일들, 원);
  assert.match(r.오류, /IMAP 끊김/);
  assert.equal(r.고친수, 0);
  const 뭉개 = await BB.보강하기({ 메일들: 원, 명단, 보낸때, 기존: {}, 읽기: async () => { throw undefined; } });
  assert.equal(뭉개.메일들, 원);
  const 읽기없음 = await BB.보강하기({ 메일들: 원, 명단, 보낸때, 기존: {} });
  assert.equal(읽기없음.메일들, 원, '읽기를 안 꽂아도 던지지 않는다');
  const 입력없음 = await BB.보강하기();
  assert.deepEqual(입력없음.메일들, {});
});

test('메일 한 통을 못 읽어도(null) 나머지는 보강한다 · 읽었는데 반송이 아니면 그 줄은 그대로', async () => {
  const { 읽기 } = 읽개({ 고객사: 파싱.고객사 });
  const r = await BB.보강하기({ 메일들: 메일들('하이웍스', '고객사'), 명단, 보낸때, 기존: {}, 읽기 });
  assert.equal(r.읽은수, 1);
  assert.equal(r.고친수, 1);
  assert.equal(r.메일들[열쇠('하이웍스')].판정, undefined);
  assert.equal(r.메일들[열쇠('고객사')].판정.갈래, '없는주소', '한 통을 못 읽었다고 읽은 통의 결과까지 버렸다');
  const 비반송 = await BB.보강하기({ 메일들: 메일들('고객사'), 명단, 보낸때, 기존: {},
    읽기: async (k) => ({ [k[0]]: { html: '<p>회의 일정 안내입니다. 내일 만나요.</p>', text: '' } }) });
  assert.equal(비반송.메일들[열쇠('고객사')].판정, undefined, '반송 낱말이 없는 메일에 판정을 달았다');
});

test('보강 결과는 «기존 반송모으기»로 흘러 기록·차단이 된다 — 확실한 것만 명단에서 빠진다', async () => {
  const { 읽기 } = 읽개();
  const r = await BB.보강하기({ 메일들: 메일들('하이웍스', '고객사', '모호', '회신', '구글'), 명단, 보낸때, 기존: {}, 읽기 });
  const 모음 = W.반송모으기({ 메일들: r.메일들, 명단, 보낸때, 회차: '2026-10-w2', 기존: {}, now: 보낸때 + 9e6 });
  const 갈래 = (a) => (모음.쓸[C.주소열쇠(a)] || {}).갈래;
  assert.equal(갈래('ceo@dara.example'), '일시', '코디스형: 「까닭 모름」이 «일시»로');
  assert.equal(갈래('yju@maba.example'), '없는주소', '충남형: 기록조차 안 남던 것이 «없는 주소»로');
  assert.equal(갈래('hr@saa.example'), '모름');
  assert.equal(갈래('old@gana.example'), '없는주소', '구글형(이미 풀린 것)은 예전 그대로');
  assert.deepEqual(Object.keys(모음.막을).sort(), [C.주소열쇠('old@gana.example'), C.주소열쇠('yju@maba.example')].sort(),
    '확실한 근거가 있는 둘만 명단에서 빼야 한다 — 애매한 사아건설까지 뺐다');
  assert.equal(모음.쓸[C.주소열쇠('hr@saa.example')].상태, '열림', '애매한 것은 사람 몫(열림)');
  assert.equal(모음.쓸[C.주소열쇠('yju@maba.example')].상태, '자동처리');
});

test('보강 없이(예전 그대로)는 두 곳이 «모름»·«기록 없음» — 이 기능이 메우는 구멍', () => {
  const 모음 = W.반송모으기({ 메일들: 메일들('하이웍스', '고객사', '구글'), 명단, 보낸때, 회차: '2026-10-w2', 기존: {}, now: 보낸때 + 9e6 });
  assert.equal(모음.쓸[C.주소열쇠('ceo@dara.example')].갈래, '모름');
  assert.equal(모음.쓸[C.주소열쇠('yju@maba.example')], undefined, '붙여 쓴 「발송실패」는 예전엔 아예 안 잡혔다');
});

/* ══════════════════ 반송모으기 — 줄의 «판정»을 쓴다 ══════════════════ */

test('★ 판정이 실린 줄은 그 판정으로 — 같은 메일은 두 번 안 센다 · 명단 밖 주소는 안 건드린다', () => {
  const 줄판 = { e: 'x@y.example', s: '제목', p: '', d: 보낸때 + 1, 판정: { 갈래: '일시', 원문: 'quota', 주소들: ['ceo@dara.example'], 반송: true } };
  const 첫 = W.반송모으기({ 메일들: { k9: 줄판 }, 명단, 보낸때, 회차: 'w', 기존: {}, now: 1 });
  assert.equal(첫.쓸[C.주소열쇠('ceo@dara.example')].갈래, '일시');
  const 또 = W.반송모으기({ 메일들: { k9: 줄판 }, 명단, 보낸때, 회차: 'w', 기존: 첫.쓸, now: 2 });
  assert.equal(Object.keys(또.쓸).length, 0, '같은 메일을 또 셌다');
  const 밖 = W.반송모으기({ 메일들: { k8: Object.assign({}, 줄판, { 판정: Object.assign({}, 줄판.판정, { 주소들: ['stranger@elsewhere.example'] }) }) }, 명단, 보낸때, 회차: 'w', 기존: {}, now: 3 });
  assert.equal(Object.keys(밖.쓸).length, 0, '명단 밖 주소를 건드렸다');
});

test('판정이 비었거나 갈래가 없으면 예전 그대로 Core 가 가른다', () => {
  const 보통 = { e: 'mailer-daemon@googlemail.com', s: 'Delivery Status Notification (Failure)', p: "Address not found: old@gana.example", d: 보낸때 + 1, 판정: {} };
  const r = W.반송모으기({ 메일들: { k7: 보통 }, 명단, 보낸때, 회차: 'w', 기존: {}, now: 1 });
  assert.equal(r.쓸[C.주소열쇠('old@gana.example')].갈래, '없는주소');
});

/* ══════════════════ IMAP 읽개 — 읽기 전용 ══════════════════ */

function 가짜client(메일맵, 옵) {
  const 불림 = [];
  return {
    불림,
    client: {
      fetchOne: async (번호, 질의, 방식) => {
        불림.push({ 번호, 질의, 방식 });
        if (옵 && 옵.던짐) throw new Error('끊김');
        const v = 메일맵[번호];
        return v === undefined ? false : v;
      },
    },
  };
}
const 열기만들기 = (client, 다시 = 0) => async (fn) => { let 남음 = 다시; for (;;) { try { return await fn(client); } catch (e) { if (남음-- > 0) continue; throw e; } } };

test('★ 읽개 — 번호로 «원본»만 받아 풀고, 없는 메일(false)·큰 메일은 null', async () => {
  const { client, 불림 } = 가짜client({ 1: { source: Buffer.from('a') }, 2: { source: Buffer.alloc(BB.메일크기한도 + 1) } });
  const 읽기 = BB.IMAP읽개({ 열기: 열기만들기(client), 풀기: async (s) => ({ 길이: s.length }) });
  const 낸 = await 읽기(['1', '2', '3']);
  assert.deepEqual(낸['1'], { 길이: 1 });
  assert.equal(낸['2'], null, '큰 메일까지 풀다 메모리를 쓴다');
  assert.equal(낸['3'], null, '없는 메일이 오류가 되면 다른 통까지 못 읽는다');
  assert.ok(불림.every((x) => x.방식.uid === true && x.질의.source === true), '번호(uid)로 원본을 받아야 한다');
});

test('★★ 읽개 — 하나도 못 읽었는데 오류가 있었다면 «열기 안에서» 던진다 → 새 연결로 한 번 더', async () => {
  let 시도 = 0;
  const client = { fetchOne: async () => { 시도++; if (시도 <= 2) throw new Error('죽은 연결'); return { source: Buffer.from('ok') }; } };
  const 읽기 = BB.IMAP읽개({ 열기: 열기만들기(client, 1), 풀기: async (s) => s.toString() });
  const 낸 = await 읽기(['1', '2']);
  assert.equal(낸['1'], 'ok', '죽은 연결 한 번에 반송 읽기를 통째로 포기했다');
  assert.equal(낸['2'], 'ok');
});

test('★ 읽개 — 요청한 메일이 «전부 없어도»(지웠다) 던지지 않는다 — 연결이 죽은 것과 다르다', async () => {
  const { client } = 가짜client({});
  const 읽기 = BB.IMAP읽개({ 열기: 열기만들기(client), 풀기: async (s) => s });
  assert.deepEqual(await 읽기(['9']), { 9: null }, '메일이 없는 것을 연결 오류로 읽어 새 연결로 되풀이한다');
});

test('보강 — 본문이 아주 길어도 줄에는 «앞부분»만 싣는다(AI·표에 통째로 넘기지 않는다)', async () => {
  const 긴 = { html: '<p>수신자 yju@maba.example 응답 501 RCPT TO: user unknown</p><p>' + '가나다라마바사 '.repeat(400) + '</p>', text: '' };
  const r = await BB.보강하기({ 메일들: 메일들('고객사'), 명단, 보낸때, 기존: {}, 읽기: async (k) => ({ [k[0]]: 긴 }) });
  assert.ok(String(r.메일들[열쇠('고객사')].p).length <= BB.넘길글자수, '본문 전체가 줄에 실렸다(' + String(r.메일들[열쇠('고객사')].p).length + '자)');
  assert.equal(r.메일들[열쇠('고객사')].판정.갈래, '없는주소');
});

test('읽개 — 일부만 실패하면 던지지 않고 그 통만 null · 풀기가 터져도 그 통만', async () => {
  const { client } = 가짜client({ 1: { source: Buffer.from('a') }, 2: { source: Buffer.from('b') } });
  const 읽기 = BB.IMAP읽개({ 열기: 열기만들기(client), 풀기: async (s) => { if (s.toString() === 'b') throw new Error('깨진 메일'); return s.toString(); } });
  const 낸 = await 읽기(['1', '2']);
  assert.equal(낸['1'], 'a');
  assert.equal(낸['2'], null);
});

test('읽개 — 끝내 못 읽으면(두 번 다 죽음) 던진다 → 보강하기가 삼켜 «원래 메일들»을 돌려준다', async () => {
  const { client } = 가짜client({}, { 던짐: true });
  const 읽기 = BB.IMAP읽개({ 열기: 열기만들기(client, 1), 풀기: async (s) => s });
  await assert.rejects(() => 읽기(['1']), /끊김/);
  const 원 = 메일들('고객사');
  const r = await BB.보강하기({ 메일들: 원, 명단, 보낸때, 기존: {}, 읽기 });
  assert.equal(r.메일들, 원);
  assert.match(r.오류, /끊김/);
});

/* ══════════════════ 읽기만 한다 · 부르는 쪽 ══════════════════ */

test('★★ 새 모듈에는 메일함을 «바꾸는» 길이 없다 — 읽음 표시·이동·삭제·쓰기로 열기', () => {
  const 코드 = 주석걷기(모듈원본);
  ['messageDelete', 'messageMove', 'messageFlagsAdd', 'messageFlagsSet', 'messageFlagsRemove', 'expunge', 'append(', 'mailboxCreate', 'mailboxDelete', 'mailboxRename', 'write: true', 'write:true']
    .forEach((낱말) => assert.ok(코드.indexOf(낱말) < 0, 낱말 + ' 이 있다 — 반송 읽기는 읽기만 한다'));
  assert.ok(코드.indexOf('fetchOne') > 0, '원본을 받는 길은 있어야 한다');
});

test('새 모듈은 로그를 찍지 않는다(주소가 새지 않게) · 무거운 짐을 맨 위에서 부르지 않는다', () => {
  const 코드 = 주석걷기(모듈원본);
  assert.ok(!/console\./.test(코드), '반송 안내에는 받는 곳 주소가 있다 — 로그에 찍지 않는다');
  assert.ok(!/require\(['"](firebase-admin|firebase-functions|imapflow|mailparser|nodemailer)/.test(코드), '검사 기기에 없는 짐을 부른다');
});

const 스캔몸 = () => {
  const 코드 = 주석걷기(서버원본).replace(/\r\n/g, '\n');
  const i = 코드.indexOf('exports.newsletterBounceScan');
  assert.ok(i >= 0, 'newsletterBounceScan 을 못 찾았다');
  return 코드.slice(i, 코드.indexOf('\nexports.', i + 10));
};

test('★ 스캔 — 본문 읽기는 try 안에서, 읽기 전용으로, 비밀값을 달고', () => {
  const 몸 = 스캔몸();
  assert.match(몸, /secrets: \[[^\]]*"GEMINI_KEY"[^\]]*\]/, 'AI 비밀값이 빠졌다');
  assert.match(몸, /secrets: \[[^\]]*"DAUM_MAIL_PASSWORD"[^\]]*\]/, '메일함 비밀값이 없으면 본문을 못 읽는다');
  const 호출 = 몸.indexOf('BounceBody.보강하기(');
  assert.ok(호출 > 0, '스캔이 본문 읽기를 부르지 않는다');
  const 앞 = 몸.slice(0, 호출);
  assert.ok(앞.lastIndexOf('try {') > 앞.lastIndexOf('} catch'), '본문 읽기가 try 밖에 있다 — 읽기 실패가 스캔 전체를 죽인다');
  assert.match(몸, /MS\.withFolder\(MAIL_DEPS, 받은, fn\)/);
  assert.ok(!/withFolder\([^)]*write/.test(몸), '쓰기로 여는 길이다');
  assert.match(몸, /한도: BounceBody\.한도기본/, '한 번에 읽는 통 수에 한도를 안 건다 — 반송이 몰린 날 메일함을 계속 두드린다');
});

test('★ 스캔 — 보강한 메일들을 반송모으기·AI 에 넘긴다(보강한 것이 버려지면 아무 일도 안 한 것)', () => {
  const 몸 = 스캔몸();
  assert.match(몸, /NWatch\.반송모으기\(\{ 메일들: 보강\.메일들,/);
  assert.match(몸, /const m = 보강\.메일들\[마지막\]/, 'AI 가 본문을 못 본다');
  assert.match(몸, /const 메일들 = Object\.assign\(\{\}, 받은메일, NWatch\.대기열실패를메일로\(/, '받은메일함과 대기열 실패를 함께 읽는 줄은 그대로여야 한다');
  const 로그 = 몸.slice(몸.indexOf('console.log("[반송 확인]"'));
  assert.ok(!/주소|email/.test(로그.slice(0, 300)), '로그에 주소가 든다');
});
