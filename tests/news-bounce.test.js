'use strict';
/* 반송·수신거부 자동 감지 (대표 지시 2026-10-05 「수신거부가 되거나 반송되는것은 자동으로 뉴스레터에서 감지하고
   어떤문제가 발생했는지 체크해서 없는 메일이면 자동으로 삭제하고 거부 메일의 경우 어떻게 처리해야할지
   검토의견 팝업으로 각사업장마다 달라」 → 목업 → 「원장의 주소 그대로 지우지 않는다. 추천대로」)

   ■ 이 검사가 지키는 «규칙»
     ① 갈래 — 기계 반송과 사람 회신을 먼저 가른다. 반송 원문의 「수신 거부되었습니다」는 «서버가 막음»이지
        사람의 수신거부가 아니다(2026-10-05 실메일). 광고 메일 바닥의 「수신거부」 글자에는 안 걸린다.
     ② 없는 주소 → «뉴스레터 명단에서만» 뺀다(newsletter/blocked). 업체관리 원장은 절대 안 건드린다.
     ③ 같은 메일은 두 번 안 센다 · 횟수는 «회차 수» · 보낸 뒤의 메일만 · 명단 밖 주소는 안 건드린다
     ④ 사람 몫 — 서버거부·수신거부·모름은 바로, 일시는 세 번 내리 · 처리한 것은 다시 안 센다
     ⑤ 검토의견은 사업장마다(유형·받는 분·횟수) 다르다 · 수신거부엔 확인한 법 조문만
     ⑥ 수신거부 회신은 문안을 보여 주고 «누르면» 나간다 — 보내기에 실패하면 수신거부 처리도 안 한다
     ⑦ 보낸 결과 화면이 «진짜 받은메일함»을 읽는다(옛 'mailbox/msgs/inbox' 는 빈 자리였다) */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/pu-news-core.js');
const W = require('../functions/news-watch.js');
const { stripJs, stripComments } = require('./strip-comments.js');
const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');
const 화면 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8')).replace(/\r\n/g, '\n');
const 몸 = (이름) => { const i = 서버.indexOf('exports.' + 이름 + ' '); return 서버.slice(i, 서버.indexOf('\nexports.', i + 10)); };
const 화함 = (이름) => { const i = 화면.indexOf('function ' + 이름 + '('); return 화면.slice(i, 화면.indexOf('\n}\n', i) + 2); };

/* 실메일 꼴(주소는 가상) */
const 메일 = {
  없음: { e: 'mailer-daemon@googlemail.com', s: 'Delivery Status Notification (Failure)',
    p: "** Address not found ** Your message wasn't delivered to old@gana.example because the address couldn't be found" },
  막힘: { e: 'mailer-daemon@dara.example', s: 'Undeliverable Mail: ?�른?�무',
    p: '메일 발송이 실패하였습니다. 받는사람 주소: <ceo@dara.example> 실패 사유: 스팸방지 시스템의 [발신 IP 주소] 설정에 의해 수신 거부되었습니다.' },
  모름: { e: 'noreply@hiworks.com', s: "failure notice: To - 'yju@maba.example'", p: '푸른노무법인 주간뉴스레터 2026년 10월 1주차 …' },
  가득: { e: 'postmaster@saa.example', s: 'Delivery failure', p: 'mailbox full — hr@saa.example quota exceeded' },
  거부: { e: 'hr@aja.example', s: 'RE: 푸른노무법인 주간뉴스레터', p: '앞으로 뉴스레터는 보내지 마세요' },
  광고: { e: 'ad@shop.example', s: '가을 맞이 세일', p: '더 받고 싶지 않으시면 수신거부를 누르세요' },
  부재: { e: 'boss@cha.example', s: '자동 회신: 휴가 중입니다', p: '10/10 까지 부재' }
};

test('① 갈래 — 기계 반송과 사람 회신을 먼저 가른다', () => {
  const g = (k) => C.반송갈래(메일[k]).갈래;
  assert.strictEqual(g('없음'), '없는주소');
  assert.strictEqual(g('막힘'), '서버거부', '반송 원문의 «수신 거부되었습니다»를 사람의 수신거부로 읽었다');
  assert.strictEqual(g('모름'), '모름');
  assert.strictEqual(g('가득'), '일시');
  assert.strictEqual(g('거부'), '수신거부');
  assert.strictEqual(g('광고'), '', '광고 메일 바닥의 «수신거부»에 걸렸다');
  assert.strictEqual(g('부재'), '자동회신');
  assert.ok(C.반송갈래(메일.없음).주소들.includes('old@gana.example'), '반송 원문에서 죽은 주소를 못 뽑았다');
});

const 명단 = [
  { email: 'old@gana.example', company: '가나상사', 누구: '담당자', 유형: '자문', 사업장: 'co-1' },
  { email: 'ceo@dara.example', company: '다라정밀', 누구: '대표자', 유형: '급여', 사업장: 'co-2' },
  { email: 'yju@maba.example', company: '마바물산', 누구: '대표자', 유형: '자문', 사업장: 'co-3' },
  { email: 'hr@saa.example', company: '사아건설', 누구: '담당자', 유형: '자문', 사업장: 'co-4' },
  { email: 'hr@aja.example', company: '아자식품', 누구: '담당자', 유형: '', 사업장: '' }];
const 보낸때 = Date.parse('2026-10-05T06:00:00+09:00');
const 메일함 = (더) => Object.assign({}, ...Object.keys(메일).map((k, i) => ({ ['m' + i]: Object.assign({ d: 보낸때 + 1000 * (i + 1) }, 메일[k]) })), 더);

test('② 없는 주소 → 뉴스레터 명단에서만 뺀다 · 나머지는 사람 몫', () => {
  const r = W.반송모으기({ 메일들: 메일함(), 명단, 보낸때, 회차: '2026-10-w1', 기존: {}, now: 보낸때 + 9e6 });
  const 열 = C.주소열쇠('old@gana.example');
  assert.strictEqual(r.쓸[열].상태, '자동처리');
  assert.strictEqual(r.막을[열].자동, true);
  assert.strictEqual(r.막을[열].까닭, '없는 주소');
  assert.strictEqual(Object.keys(r.막을).length, 1, '없는 주소 말고도 명단에서 뺐다');
  assert.strictEqual(r.쓸[C.주소열쇠('ceo@dara.example')].상태, '열림');
  assert.strictEqual(r.쓸[C.주소열쇠('hr@aja.example')].갈래, '수신거부');
  assert.ok(!r.쓸[C.주소열쇠('ad@shop.example')], '명단 밖 주소를 건드렸다');
  /* 서버도 원장(data/companies)에 안 쓴다 */
  const b = 몸('newsletterBounceScan');
  assert.ok(!/data\/companies[^"]*"\)\.(set|update|remove|push)|upd\["data\//.test(b), '업체관리 원장에 쓴다');
  assert.match(b, /newsletter\/blocked\/" \+ k/);
});

test('③ 같은 메일은 두 번 안 센다 · 횟수는 회차 수 · 보낸 뒤 메일만', () => {
  const 첫 = W.반송모으기({ 메일들: 메일함(), 명단, 보낸때, 회차: '2026-10-w1', 기존: {}, now: 1 });
  const 열 = C.주소열쇠('ceo@dara.example');
  const 또 = W.반송모으기({ 메일들: 메일함(), 명단, 보낸때, 회차: '2026-10-w1', 기존: 첫.쓸, now: 2 });
  assert.ok(!또.쓸[열], '같은 메일을 또 셌다');
  const 다음주 = W.반송모으기({ 메일들: { n1: Object.assign({ d: 보낸때 + 7 * 864e5 }, 메일.막힘) }, 명단,
    보낸때: 보낸때 + 7 * 864e5 - 1000, 회차: '2026-10-w2', 기존: 첫.쓸, now: 3 });
  assert.strictEqual(다음주.쓸[열].횟수, 2);
  const 전 = W.반송모으기({ 메일들: { o1: Object.assign({ d: 보낸때 - 1000 }, 메일.막힘) }, 명단, 보낸때, 회차: 'x', 기존: {}, now: 4 });
  assert.strictEqual(Object.keys(전.쓸).length, 0, '보내기 전 메일을 셌다');
  /* 이번 주에 이미 처리한 것은 같은 회차의 새 반송이 와도 다시 안 연다 */
  const 처리 = Object.assign({}, 첫.쓸); 처리[열] = Object.assign({}, 처리[열], { 상태: '처리' });
  const 같은주 = W.반송모으기({ 메일들: { z9: Object.assign({ d: 보낸때 + 99999 }, 메일.막힘) }, 명단, 보낸때, 회차: '2026-10-w1', 기존: 처리, now: 5 });
  assert.strictEqual(같은주.쓸[열].상태, '처리');
});

test('④ 사람 몫 — 일시는 세 번 내리, 처리한 것은 안 센다', () => {
  assert.strictEqual(C.반송사람몫인가({ 갈래: '서버거부', 상태: '열림' }), true);
  assert.strictEqual(C.반송사람몫인가({ 갈래: '수신거부', 상태: '열림' }), true);
  assert.strictEqual(C.반송사람몫인가({ 갈래: '모름', 상태: '열림' }), true);
  assert.strictEqual(C.반송사람몫인가({ 갈래: '일시', 상태: '열림', 횟수: 2 }), false);
  assert.strictEqual(C.반송사람몫인가({ 갈래: '일시', 상태: '열림', 횟수: 3 }), true);
  assert.strictEqual(C.반송사람몫인가({ 갈래: '없는주소', 상태: '자동처리' }), false);
  assert.strictEqual(C.반송사람몫인가({ 갈래: '수신거부', 상태: '처리' }), false);
  /* 경고판도 센다 — 반송만 있으면 받는 곳 › 반송·거부로 */
  const 판 = W.경고판짓기({ 열쇠: '2026-10-w1', 발송: { 상태: 'ok' } }, { a: { 갈래: '서버거부', 상태: '열림' }, b: { 갈래: '없는주소', 상태: '자동처리' } });
  assert.strictEqual(판.경고수, 1);
  assert.strictEqual(판.탭, 'bounce');
  assert.match(판.말들.join(' '), /반송·수신거부 검토 1건/);
});

test('⑤ 검토의견은 사업장마다 — 유형·받는 분·횟수에 따라', () => {
  const 거래 = C.반송검토의견({ 갈래: '서버거부', 유형: '자문', 누구: '대표자', 횟수: 1 });
  const 비거래 = C.반송검토의견({ 갈래: '서버거부', 유형: '', 누구: '담당자', 횟수: 1 });
  assert.notStrictEqual(거래.의견, 비거래.의견);
  assert.match(거래.의견, /허용 등록/);
  assert.match(C.반송검토의견({ 갈래: '서버거부', 유형: '자문', 누구: '대표자', 횟수: 2 }).의견, /담당자 메일/, '두 번째엔 다른 주소를 권해야 한다');
  const 거부 = C.반송검토의견({ 갈래: '수신거부', 유형: '급여', 누구: '담당자' });
  assert.match(거부.근거, /정보통신망법 제50조 제2항/);
  assert.match(거부.근거, /제7항/);
  assert.match(거부.의견, /급여 업무 안내/);
  assert.deepStrictEqual(거부.단추, ['거부회신', '거부만', '주소바꾸기']);
  assert.match(C.반송검토의견({ 갈래: '없는주소', 누구: '담당자' }).의견, /원장의 주소는 그대로/);
  const 회신 = C.수신거부회신문안({ 주소: 'hr@aja.example' }, { 회사이름: '푸른노무법인', 전화: '041-000-0000' });
  assert.match(회신.본문, /hr@aja\.example/);
  assert.match(회신.본문, /중단/);
});

test('⑥ 수신거부 회신 — 문안을 보여 주고 누르면 나가고, 실패하면 처리도 안 한다', () => {
  const 처리 = 화함('반송처리');
  assert.match(처리, /무엇 === '거부회신'[\s\S]*?Core\.수신거부회신문안/, '문안을 보여 주지 않는다');
  assert.ok(처리.indexOf('fetch(') < 0, '문안을 보여 주기 전에 보낸다');
  const 보냄 = 화함('반송회신보내기');
  assert.match(보냄, /confirm\(/);
  assert.ok(보냄.indexOf('fetch(시험즉시URL') < 보냄.indexOf('반송막기('), '보내기 전에 수신거부부터 처리한다');
  assert.match(보냄, /if\(!res\.ok \|\| !j \|\| !j\.ok\) throw/, '보내기 실패를 삼킨다');
  /* 화면 어디에서도 원장에 안 쓴다 */
  ['반송처리', '반송기록', '반송막기', '반송회신보내기', '반송복사'].forEach((n) => {
    assert.ok(!/data\/companies/.test(화함(n)), n + ' 가 업체관리 원장을 건드린다');
  });
  assert.match(화면, /\{ t:'bounce', 이름:'반송·거부'/);
});

test('⑦ 보낸 결과·서버 모두 «진짜 받은메일함»(폴더 kind:inbox)을 읽는다', () => {
  assert.ok(화면.indexOf("db.ref('mailbox/msgs/inbox')") < 0, '빈 자리(mailbox/msgs/inbox)를 아직 읽는다');
  assert.match(화면, /kind === 'inbox'/);
  const b = 몸('newsletterBounceScan');
  assert.match(b, /kind === "inbox"/);
  assert.match(b, /\.pubsub\.schedule\("every day 09:00"\)/);
});
