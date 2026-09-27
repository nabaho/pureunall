'use strict';
/* 금요일 13시 자동 준비 → 검토 메일 → 월요일 발송 (대표 지시 2026-09-27)
   「매주 금요일 13시에 자동으로 기사와 내용을 정리해서 저장하고 월요일에 자동으로 보낼수 있게」
   「금요일에 370-6 메일로 보내서 월요일 보낼것이라는 알림 주고 검토해달라고 해라」

   ■ 이 검사가 지키는 «규칙» — 가짜 DB·가짜 AI·가짜 메일로 «끝까지» 돌린다
     ①★ 금요일이 만든 확정본을 월요일 문지기가 «받아들인다» (도장이 DB 에서 읽은 것과 같다)
        ⚠ 가짜 DB 는 파이어베이스처럼 빈 목록을 버린다 — 그래야 hr:[] 고장이 숨지 않는다
     ② 만드는 것은 «월요일에 나갈 회차»다 (금요일이 든 주)
     ③ 사람이 쓴 것은 덮지 않는다 — 우리 말 · 한마디
     ④ AI 가 쓴 줄에는 자동옮김 표가 남고, 검토 메일이 그것을 따로 적는다
     ⑤ 검토 메일은 370-6@hanmail.net 으로, 날짜·곳 수와 «편지 그대로»를 싣는다
        — 편지는 추적 없는 꼴(검토하며 누른 것이 자문사 열람으로 세이면 안 된다)
     ⑥ 자동발송이 꺼져 있으면 «안 나간다»고 말한다 · 금요일 준비를 끄면 아무것도 안 한다
     ⑦ AI 가 실패해도 담은 것은 간다 — 까닭을 메일에 적는다
     ⑧ 주말에 고치면 월요일에 «고친 내용으로» 다시 봉인한다 (자동 확정본만)
     ⑨ AI 지시에 법률 글의 선이 다 있다 — 화면과 같은 선
     ⑩ 줄 세우기·한마디 거리는 화면과 «같은 셈»이다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const NF = require('../functions/news-friday.js');
const NR = require('../functions/news-ready.js');
const NW = require('../functions/newsletter-weekly.js');
const C = require('../js/pu-news-core.js');
const FakeDB = require('./helpers/fake-rtdb.js');
const { 주석걷기, 함수몸 } = require('./helpers/strip-comments.js');

const 화면 = 주석걷기(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8'));
const 서버 = 주석걷기(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8'));

/* 2026-10-02(금) 13:00 서울 = 04:00Z */
const 금요일 = Date.parse('2026-10-02T04:00:00Z');
const 월요일 = '2026-10-05';

function 씨앗(더) {
  return Object.assign({
    newsletter: {
      config: { 자동발송: true, 범위: '자문중', 보내는주소: '370-6@hanmail.net', 대표자도: true,
        추적밑주소: 'https://news.example.test', 회사이름: '푸른노무법인' },
      blocked: { 'nope@example,test': true }
    },
    data: { companies: { v: {
      a: { id: 'co-1', name: '가나상사', status: 'active', typeCode: '자문',
        primaryContactName: '홍길동', primaryContactEmail: 'hong@ganasangsa.example' },
      b: { id: 'co-2', name: '다라상사', status: 'active', typeCode: '자문',
        primaryContactName: '김철수', primaryContactEmail: 'kim@darasangsa.example' },
      c: { id: 'co-3', name: '끝난상사', status: 'closed', typeCode: '자문',
        primaryContactName: '이영희', primaryContactEmail: 'lee@end.example' }
    } } },
    homepage: {
      newsBrief: { 모음: {
        k1: { 제목: '가나상사 사례로 본 연차수당 정산', 링크: 'https://news.example.kr/a/1', 언론사: '가나일보',
          모은날: '2026-09-29', 요약: '연차수당 정산 기준을 다룬 기사다.' },
        k2: { 제목: '최저임금 위반 사업장 감독 강화', 링크: 'https://news.example.kr/a/2', 언론사: '가나일보',
          모은날: '2026-09-30' }
      }, 법령: [] },
      newsDocs: { 모음: {
        d1: { 제목: '홍길동과 함께 보는 육아휴직 안내서', 발행처: '고용노동부', 발행일: '20260929',
          파일: 'https://www.moel.go.kr/files/f1.pdf', 링크: 'https://www.moel.go.kr/view/1',
          모은날: '2026-09-29', 값어치: 4 }
      } },
      newsPrec: { 모음: {
        p1: { 제목: '포괄임금 약정보다 실제 기록이 앞선다', 인용: '대법원 2026. 8. 27. 선고 2025다301142',
          딱지: '[판례]', 링크: 'https://www.law.go.kr/LSW/precInfoP.do?target=prec&ID=622111',
          모은날: '2026-09-30' }
      } }
    }
  }, 더 || {});
}

function 가짜AI(기록) {
  return async (글) => {
    기록.push(글);
    if (/JSON 배열만/.test(글)) {
      const 목 = JSON.parse(글.slice(글.lastIndexOf('\n\n') + 2));
      return JSON.stringify(목.map((x) => ({ 번호: x.번호, 초안: 'AI가 정리한 ' + x.제목 + ' 이야기입니다.' })));
    }
    return '대법원은 __실제 근로시간 기록이 약정보다 앞선다__고 보았습니다. 사업장에서는 기록을 다시 보셔야 합니다.';
  };
}
function 가짜메일(보낸것) { return async (편) => { 보낸것.push(편); return { ok: true }; }; }

/* 월요일 문지기가 보는 그대로 — 확정본과 «DB 에서 읽은» 회차의 바탕 칸 */
function 월요일문지기(db) {
  const ready = db.읽기('newsletter/weeklyReady');
  const 회 = db.읽기('newsletter/issues/' + ready.회차열쇠) || {};
  const 바탕 = { 회차: 회.회차, 범위: 회.범위, 우리글: 회.우리글, 안: 회.안, 지역뉴스: 회.지역뉴스 };
  return { ready, 문: NW.check(db.읽기('newsletter/config'), ready, 월요일), 도장: NR.내보낼까(ready, 바탕), 회 };
}

async function 금요일돌리기(씨, 옵) {
  const db = FakeDB.만들기(씨 || 씨앗());
  const 물음 = [], 보낸것 = [];
  const 보고 = await NF.금요일준비(Object.assign({ db, ai: 가짜AI(물음), 메일: 가짜메일(보낸것), now: 금요일,
    무작위: (() => { let i = 0; return () => ((i++ * 0.6180339) % 1); })() }, 옵 || {}));
  return { db, 물음, 보낸것, 보고 };
}

test('★★★ 금요일이 만든 확정본을 월요일 문지기가 «받아들인다» — 도장이 DB 와 같다', async () => {
  const { db, 보고 } = await 금요일돌리기();
  assert.ok(보고.확정본됨, '확정본을 못 만들었다: ' + 보고.못한까닭);
  const m = 월요일문지기(db);
  assert.ok(m.문.ok, '★★★ 월요일 문지기가 막는다: ' + m.문.reason);
  assert.ok(m.도장.ok, '★★★ 월요일에 «준비한 뒤 바뀌었다»로 안 보낸다 — ' + m.도장.까닭);
  assert.strictEqual(m.ready.자동, true, '자동 확정본 표가 없다 — 월요일 다시 봉인이 안 된다');
  assert.strictEqual(m.ready.to.length, 2, '받는 곳이 틀렸다(끝난 곳은 빠지고 둘)');
  assert.ok(m.ready.to.every((x) => x.track && x.regionHtml !== undefined), '추적 번호·지역판이 안 붙었다');
});

test('★★★ 빈 꼭지 하나로 도장이 어긋나지 않는다 — 기억 속 [] 와 DB 의 «없음»은 같다', () => {
  const x = { 제목: '가', 우리말: '나' };
  const 기억 = { 회차: { 이름: 'a' }, 범위: '자문중', 우리글: '', 안: { news: [x], hr: [], policy: [] }, 지역뉴스: [] };
  const DB에서 = { 회차: { 이름: 'a' }, 범위: '자문중', 우리글: '', 안: { news: [x] } };
  assert.strictEqual(C.바탕도장(기억), NR.바탕도장(DB에서), '★★★ 화면 도장과 서버 도장이 빈 목록 하나로 다르다');
  /* 두 벌은 «같은 입력»에도 같은 답이어야 한다 — 한쪽만 빈 목록을 세면 언젠가 어긋난다 */
  assert.strictEqual(NR.바탕도장(기억), C.바탕도장(기억), '★★ 서버 도장이 빈 목록을 센다 — 두 벌이 다르다');
  assert.strictEqual(C.바탕도장(DB에서), C.바탕도장(기억), '화면 도장이 빈 목록을 센다');
  assert.notStrictEqual(NR.바탕도장(DB에서), NR.바탕도장({ 회차: { 이름: 'a' }, 범위: '자문중', 우리글: '',
    안: { news: [{ 제목: '가', 우리말: '다' }] } }), '내용이 바뀌어도 도장이 같다 — 눈을 감았다');
});

test('★★ 만드는 것은 «월요일에 나갈 회차»다 — 금요일이 든 주', async () => {
  const { 보고, db } = await 금요일돌리기();
  assert.strictEqual(보고.보낼날, 월요일);
  assert.strictEqual(보고.열쇠, C.회차(월요일).열쇠, '월요일에 나갈 회차가 아니다');
  assert.strictEqual(db.읽기('newsletter/weeklyReady').보낼날, 월요일);
  const 회 = db.읽기('newsletter/issues/' + 보고.열쇠);
  assert.ok(회 && 회.안 && 회.안.news && 회.안.news.length, '기사를 안 담았다');
  assert.ok(회.안.policy && 회.안.policy.length, '자료를 안 담았다');
  assert.ok(회.안.case && 회.안.case.length, '판례를 안 담았다');
  assert.ok(String(회.전문 || '').length > 100, '웹 전문을 안 담았다 — 「전문 보기」가 빈 쪽을 연다');
});

test('★★★ 사람이 쓴 것은 덮지 않는다 — 우리 말 · 한마디', async () => {
  const 씨 = 씨앗();
  const 열 = C.회차(월요일).열쇠;
  씨.newsletter.issues = { [열]: { 회차: C.회차(월요일), 상태: '초안', 우리글: '홍길동 대표님이 쓰신 한마디입니다.',
    안: { news: [{ 갈래: '기사', 제목: '가나상사 사례로 본 연차수당 정산', 링크: 'https://news.example.kr/a/1',
      우리말: '사람이 쓴 우리 말입니다.', 언론사: '가나일보' }] } } };
  const { db, 물음, 보고 } = await 금요일돌리기(씨);
  const 회 = db.읽기('newsletter/issues/' + 열);
  assert.strictEqual(회.우리글, '홍길동 대표님이 쓰신 한마디입니다.', '★★★ 사람이 쓴 한마디를 덮었다');
  assert.ok(!물음.some((q) => /이번 주 한마디/.test(q) && /노동법률/.test(q)), '★★ 한마디가 있는데 AI 를 불렀다');
  const 사람줄 = 회.안.news.find((x) => x.링크 === 'https://news.example.kr/a/1');
  assert.strictEqual(사람줄.우리말, '사람이 쓴 우리 말입니다.', '★★★ 사람이 쓴 우리 말을 덮었다');
  assert.ok(!사람줄.자동옮김, '사람 글에 자동 표가 붙었다');
  assert.strictEqual(보고.AI한마디, false);
});

test('★★★ AI 가 «묻지 않은 번호»까지 답해도 사람 글은 그대로다', async () => {
  /* 실제 AI 는 번호를 틀리게 답할 수 있다 — 묻지 않은 줄(사람이 쓴 줄)의 번호를 적어 보내면
     그 줄을 덮는다. 받는 쪽에서 한 번 더 막아야 한다. */
  const 씨 = 씨앗();
  const 열 = C.회차(월요일).열쇠;
  씨.newsletter.issues = { [열]: { 회차: C.회차(월요일), 상태: '초안', 우리글: '사람 한마디',
    안: { news: [{ 갈래: '기사', 제목: '가나상사 사례로 본 연차수당 정산', 링크: 'https://news.example.kr/a/1',
      우리말: '사람이 쓴 우리 말입니다.', 언론사: '가나일보' }] } } };
  const 버릇나쁜AI = async (글) => (/JSON 배열만/.test(글)
    ? JSON.stringify([0, 1, 2, 3, 4].map((i) => ({ 번호: i, 초안: '기계가 덮어쓴 글 ' + i })))
    : '한마디');
  const { db } = await 금요일돌리기(씨, { ai: 버릇나쁜AI });
  const 줄 = db.읽기('newsletter/issues/' + 열).안.news.find((x) => x.링크 === 'https://news.example.kr/a/1');
  assert.strictEqual(줄.우리말, '사람이 쓴 우리 말입니다.', '★★★ AI 가 사람 글을 덮었다');
});

test('★★ AI 가 쓴 줄에는 자동옮김 표 — 검토 메일이 따로 적는다', async () => {
  const { db, 보낸것, 보고 } = await 금요일돌리기();
  const 회 = db.읽기('newsletter/issues/' + 보고.열쇠);
  const 자동 = 회.안.news.filter((x) => x.자동옮김 === true);
  assert.ok(자동.length >= 1, 'AI 가 쓴 줄에 표가 없다');
  assert.ok(자동.every((x) => x.우리말 && x.AI초안 === x.우리말), 'AI 초안과 우리 말이 다르다');
  assert.ok(회.우리글 && 회.우리글 === 회.우리글초안, '한마디가 「AI 초안」으로 안 적혔다 — 화면이 못 가린다');
  assert.match(회.우리글, /__[^_]+__/, '한마디에 핵심 밑줄이 없다');
  const 메 = 보낸것[0];
  assert.match(메.html, /AI 가 쓴 글/, '★★ 검토 메일이 AI 글을 따로 안 적는다');
  assert.match(메.html, /안 읽었습니다/, '«사람이 아직 안 읽었다»를 안 말한다');
});

test('★★★ 검토 메일 — 370-6@hanmail.net 으로, 날짜·곳 수·편지 그대로 (추적 없는 꼴)', async () => {
  const { 보낸것 } = await 금요일돌리기();
  assert.strictEqual(보낸것.length, 1, '검토 메일을 안 보냈다');
  const 메 = 보낸것[0];
  assert.deepStrictEqual(메.to, ['370-6@hanmail.net'], '★★★ 받는 곳이 370-6@hanmail.net 이 아니다');
  assert.match(메.subject, /검토/, '제목에 «검토»가 없다');
  assert.match(메.subject, /10월 5일\(월\)/, '제목에 보낼 날이 없다');
  assert.match(메.subject, /2곳/, '제목에 곳 수가 없다');
  assert.match(메.html, /월요일에 나갈 편지 그대로/, '편지를 안 실었다');
  assert.ok(메.html.indexOf('newsClick') < 0, '★★ 검토 편지가 추적 링크를 단다 — 누르면 자문사 클릭으로 세인다');
  assert.ok(메.html.indexOf('{지역뉴스}') < 0 && 메.html.indexOf('{추적열쇠}') < 0, '자리표가 그대로 남았다');
  assert.match(메.html, /멈추시려면/, '멈추는 길을 안 알려 준다');
  assert.match(메.html, /고치시려면/, '고치는 길을 안 알려 준다');
  assert.ok(메.body && 메.body.indexOf('<') < 0, '평문 몫에 태그가 남았다');
});

test('★★ 자동발송이 꺼져 있으면 «안 나간다»고 말한다', async () => {
  const 씨 = 씨앗(); 씨.newsletter.config.자동발송 = false;
  const { 보낸것, 보고 } = await 금요일돌리기(씨);
  assert.strictEqual(보고.확정본됨, true, '꺼져 있어도 확정본은 만들어 둔다(켜면 나간다)');
  assert.match(보낸것[0].subject, /자동발송이 꺼져 있어/, '★★ 꺼져 있는데 «나갑니다»라고 한다');
});

test('★★ 금요일 준비를 끄면 아무것도 안 한다 · 이미 보낸 회차는 건드리지 않는다', async () => {
  const 씨 = 씨앗(); 씨.newsletter.config.금요일준비 = false;
  const r = await 금요일돌리기(씨);
  assert.strictEqual(r.보고.건너뜀, '꺼짐');
  assert.strictEqual(r.보낸것.length, 0, '꺼졌는데 메일을 보냈다');
  assert.strictEqual(r.db.쓴것.length, 0, '★★ 꺼졌는데 DB 를 고쳤다');

  const 씨2 = 씨앗(); const 열 = C.회차(월요일).열쇠;
  씨2.newsletter.issues = { [열]: { 회차: C.회차(월요일), 상태: '발송', 안: { news: [{ 제목: 'ㄱ', 우리말: 'ㄴ' }] } } };
  const r2 = await 금요일돌리기(씨2);
  assert.strictEqual(r2.보고.건너뜀, '이미 보낸 회차');
  assert.strictEqual(r2.db.쓴것.length, 0, '★★ 보낸 회차를 고쳤다');
});

test('★★ AI 가 실패해도 담은 것은 간다 — 까닭을 메일에 적는다', async () => {
  const { 보낸것, 보고, db } = await 금요일돌리기(null, { ai: async () => { throw new Error('이번 달 AI 한도를 다 썼습니다'); } });
  assert.ok(보고.알림들.some((m) => /AI 정리를 못 했습니다/.test(m)), '실패를 안 적었다');
  assert.match(보낸것[0].html, /AI 한도/, '★★ 메일에 실패 까닭이 없다');
  const 회 = db.읽기('newsletter/issues/' + 보고.열쇠);
  assert.ok(회.안.policy && 회.안.policy.length, 'AI 가 실패했다고 담은 것까지 버렸다');
});

test('★★★ AI 가 실패한 주의 알림이 «실제로 일어나는 일»과 같다', async () => {
  /* ⚠⚠ 알림이 「우리 말 없는 기사는 안 실립니다」라고 했었다(2026-09-27 이어받을 때 잡음).
       그런데 2026-09-20 대표 결정으로 우리 말이 없어도 원문 그대로 나간다. 검토 메일이
       사실과 반대로 말하면 대표님은 「안 나가니 괜찮다」고 두셨다가 원문 제목이 나간다.
     ★ 값이 아니라 «알림이 Core.실릴까 와 같은 말을 하는가»를 본다 — 규칙이 또 바뀌어도
       이 검사가 따라간다. */
  const { 보고 } = await 금요일돌리기(null, { ai: async () => { throw new Error('한도'); } });
  const 알림 = 보고.알림들.find((m) => /AI 정리를 못 했습니다/.test(m));
  assert.ok(알림, 'AI 실패 알림이 없다');
  const 우리말없는기사 = { 갈래: '기사', 제목: '원문 제목', 링크: 'https://example.kr/a', 언론사: '가나일보' };
  const 실린다 = C.실릴까(우리말없는기사);
  if (실린다) {
    assert.ok(!/안 실립니다|안 나갑니다/.test(알림),
      '★★★ 실제로는 나가는데 「안 실립니다」라고 한다: ' + 알림);
    assert.match(알림, /원문 그대로/, '★★ 무엇이 나가는지 안 말한다');
  } else {
    assert.match(알림, /안 실립니다|안 나갑니다/, '★★★ 실제로는 안 나가는데 나간다고 한다: ' + 알림);
  }
});

test('★★★ 주말에 고치면 월요일에 «고친 내용으로» 다시 봉인한다', async () => {
  const { db, 보고 } = await 금요일돌리기();
  const 열 = 보고.열쇠;
  /* 대표님이 주말에 한마디를 고치신다 */
  await db.ref('newsletter/issues/' + 열).update({ 우리글: '대표님이 고치신 한마디입니다.' });
  const 앞 = 월요일문지기(db);
  assert.strictEqual(앞.도장.ok, false, '고쳤는데 도장이 같다 — 검사 앞제가 틀렸다');
  assert.strictEqual(앞.도장.다름, true);
  const 새 = await NF.확정본다시짓기({ db, 회차열쇠: 열, 보낼날: 월요일, now: 금요일 + 3 * 864e5 });
  assert.ok(새.ok, '다시 짓지 못했다: ' + 새.까닭);
  const 회 = db.읽기('newsletter/issues/' + 열);
  const 바탕 = { 회차: 회.회차, 범위: 회.범위, 우리글: 회.우리글, 안: 회.안, 지역뉴스: 회.지역뉴스 };
  assert.ok(NR.내보낼까(새.확정본, 바탕).ok, '★★★ 다시 지은 확정본도 문지기가 막는다');
  assert.match(새.확정본.html, /대표님이 고치신 한마디/, '★★★ 고친 내용이 편지에 없다');
  assert.strictEqual(새.확정본.자동, true);
});

test('★★ 월요일 함수 — 다시 봉인은 «자동 확정본»일 때만, 발송잠금 «전»에', () => {
  const 몸 = 서버.slice(서버.indexOf('exports.weeklyNewsletterSend'), 서버.indexOf('exports.weeklyNewsletterPrepare'));
  assert.ok(몸.length > 100, 'weeklyNewsletterSend 를 못 찾았다');
  const i다시 = 몸.indexOf('NF.확정본다시짓기(');
  const i잠금 = 몸.indexOf('발송잠금');
  assert.ok(i다시 > 0, '★★ 월요일에 다시 봉인하지 않는다 — 고치신 것이 안 나간다');
  assert.ok(i잠금 > i다시, '다시 봉인이 발송잠금 뒤에 있다');
  assert.match(몸.slice(Math.max(0, i다시 - 300), i다시), /ready\.자동 === true/,
    '★★ 사람이 준비한 확정본까지 다시 짓는다 — 누르신 그 순간의 편지가 약속이다');
});

test('★★ 금요일 13시 · 서울 시각으로 걸려 있다', () => {
  const i = 서버.indexOf('exports.weeklyNewsletterPrepare');
  assert.ok(i > 0, '금요일 준비 함수가 없다');
  const 몸 = 서버.slice(i, i + 900);
  assert.match(몸, /schedule\("every friday 13:00"\)/, '★★ 금요일 13시가 아니다');
  assert.match(몸, /timeZone\("Asia\/Seoul"\)/, '서울 시각이 아니다');
  assert.match(몸, /GEMINI_KEY/, 'AI 열쇠를 안 받는다 — 금요일에 AI 가 못 돈다');
  assert.match(몸, /DAUM_MAIL_PASSWORD/, '메일 비밀번호를 안 받는다 — 검토 메일이 못 나간다');
});

test('★★★ AI 지시에 법률 글의 선이 다 있다 — 화면과 같은 선', () => {
  const 한 = NF.한마디지시([{ 꼭지: '판례', 글: 'ㄱ' }]);
  ['노동법률', '지어내', '통째로', '적힌 그대로', '예정', '__'].forEach(function (말) {
    assert.ok(한.indexOf(말) >= 0, '★★★ 서버 한마디 지시에 「' + 말 + '」 선이 없다');
    assert.ok(함수몸(화면, '한마디초안짓기').indexOf(말) >= 0 || 말 === '__',
      '화면 한마디 지시에 「' + 말 + '」 선이 없다 — 두 곳이 달라졌다');
  });
  const 기 = NF.기사초안지시([]);
  ['JSON 배열만', '보태지', '만들지', '복사하지'].forEach(function (말) {
    assert.ok(기.indexOf(말) >= 0, '★★★ 서버 기사 지시에 「' + 말 + '」 선이 없다');
    assert.ok(함수몸(화면, 'AI초안짓기').indexOf(말) >= 0, '화면 기사 지시에 「' + 말 + '」 선이 없다');
  });
});

test('★★ 줄 세우기·한마디 거리는 화면과 «같은 셈»이다', () => {
  const 짐 = { Core: C };
  vm.createContext(짐);
  vm.runInContext(함수몸(화면, '값어치순') + '\n' + 함수몸(화면, '최근것'), 짐);
  const 모음 = { a: { 제목: '가', 값어치: 1, 모은날: '2026-09-29' }, b: { 제목: '나', 값어치: 4, 모은날: '2026-09-28' },
    c: { 제목: '다', 모은날: '2026-09-30' }, d: { 제목: '라', 값어치: 4, 모은날: '2026-09-30' } };
  짐.모음 = 모음;
  assert.strictEqual(JSON.stringify(vm.runInContext('값어치순(모음, 8)', 짐)), JSON.stringify(NF.값어치순(모음, 8)),
    '★★ 자료 줄 세우기가 화면과 다르다 — 금요일 편지와 화면 편지가 다른 자료를 담는다');
  assert.strictEqual(JSON.stringify(vm.runInContext('최근것(모음, 2)', 짐)), JSON.stringify(NF.최근것(모음, 2)),
    '판례 줄 세우기가 화면과 다르다');
  /* 한마디 거리 — 화면 함수 안의 대목을 그대로 돌려 견준다 */
  const 몸 = 함수몸(화면, '한마디초안짓기');
  const i = 몸.indexOf('const 거리 = [];'), j = 몸.indexOf('if(거리.length');
  const 안 = { news: [{ 갈래: '기사', 제목: 'ㄱ', 우리말: '우리 말' }],
    case: [{ 갈래: '판례', 딱지: '[판례]', 제목: '판례', 인용: '대법원 2025다1', 요지: '요지' }] };
  const 짐2 = { Core: C, d: { 안: 안 }, 거리: null };
  vm.createContext(짐2);
  vm.runInContext('const d = this.d;' + 몸.slice(i, j) + 'this.거리 = 거리;', 짐2);
  assert.strictEqual(JSON.stringify(짐2.거리), JSON.stringify(NF.한마디거리({ 안: 안 })),
    '★★ 한마디 거리가 화면과 다르다');
});
