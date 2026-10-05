'use strict';
/* AI 검토 단계 (대표 지시 2026-10-05 「랭그래프나 랭체인 같이 보낸것 자동으로 점검하고 수리하고 검토할 수 있나?」
   → 추천(틀은 그대로, AI «검토 단계»만) → 목업 → 「추천대로」)

   ■ 이 검사가 지키는 «규칙»
     ① AI 는 «읽고 의견만» — 명단에서 빼기·수신거부·갈래 확정·편지 고치기·보내기를 서버에서 하지 않는다
     ② AI 답은 닫힌 갈래로만 받고, 원문에 없는 «근거»는 버린다(지어낸 인용을 막는다)
     ③ 법 조문은 서버가 법제처 원문을 읽어 «함께» 넘긴다 — 원문 없는 조문은 판단하지 말라고 못 박는다
        · 법령 목록은 한 법령씩 잘라 읽는다(이름 뒤의 번호를 잡으면 시행령을 가져온다 — 2026-10-05 실제로 그랬다)
        · 「같은 법 제61조」 는 바로 앞의 법 · 가운뎃점(· ㆍ) 모양은 같게 본다
     ④ 결과 숫자는 서버가 센다 — AI 는 세 줄 요약만, 새 숫자를 만들지 말라고 못 박는다
     ⑤ AI 가 실패해도 규칙 점검·결과 메일은 그대로 간다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../functions/news-watch.js');
const { stripJs, stripComments } = require('./strip-comments.js');
const 서버원 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
const 서버 = stripJs(서버원).replace(/\r\n/g, '\n');
const 화면 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8')).replace(/\r\n/g, '\n');
const 몸 = (이름) => { const i = 서버.indexOf('exports.' + 이름 + ' '); return 서버.slice(i, 서버.indexOf('\nexports.', i + 10)); };
const 화함 = (이름) => { const i = 화면.indexOf('function ' + 이름 + '('); return 화면.slice(i, 화면.indexOf('\n}\n', i) + 2); };

test('② 반송 AI 답 — 닫힌 갈래만, 원문에 없는 근거는 버린다', () => {
  assert.deepStrictEqual(W.반송AI답읽기('```json {"갈래":"없는주소","근거":"550 No such user"}```', 'x 550 No such user y'),
    { 갈래: '없는주소', 근거: '550 No such user' });
  assert.strictEqual(W.반송AI답읽기('{"갈래":"수신거부하세요","근거":""}', '').갈래, '모름', '닫힌 갈래 밖의 답을 받았다');
  assert.strictEqual(W.반송AI답읽기('{"갈래":"서버거부","근거":"지어낸 인용"}', '원문은 다른 말').근거, '', '원문에 없는 근거를 남겼다');
  assert.throws(() => W.반송AI답읽기('모르겠습니다', ''), /JSON/);
  assert.match(W.반송AI지시({ 원문: 'x' }, { s: '제목', p: '본문' }), /지어내지 마라/);
});

test('③ 조문 뽑기 — 같은 법은 앞의 법, 다섯 개까지', () => {
  assert.deepStrictEqual(W.조문들뽑기('근로기준법 제60조 제2항과 같은 법 제61조, 남녀고용평등과 일·가정 양립 지원에 관한 법률 제18조의2'), [
    { 법: '근로기준법', 조: 60, 의: 0 }, { 법: '근로기준법', 조: 61, 의: 0 },
    { 법: '남녀고용평등과 일·가정 양립 지원에 관한 법률', 조: 18, 의: 2 }]);
  const 많이 = Array.from({ length: 9 }, (_, i) => '근로기준법 제' + (i + 1) + '조').join(' ');
  assert.strictEqual(W.조문들뽑기(많이).length, 5);
});

test('③ 법제처 원문 — 한 법령씩 잘라 읽는다 (시행령 번호를 집지 않는다)', async () => {
  const i = 서버원.indexOf('async function 법조문원문');
  const 법조문원문 = new Function('fetch', 서버원.slice(i, 서버원.indexOf('\n}\n', i) + 2) + '; return 법조문원문;');
  /* 진짜 목록과 같은 꼴 — 일련번호가 이름보다 «앞» */
  const 목록 = '<LawSearch><law id="1"><법령일련번호>111</법령일련번호><법령명한글><![CDATA[근로기준법]]></법령명한글></law>'
    + '<law id="2"><법령일련번호>222</법령일련번호><법령명한글><![CDATA[근로기준법 시행령]]></법령명한글></law>'
    + '<law id="3"><법령일련번호>333</법령일련번호><법령명한글><![CDATA[남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률]]></법령명한글></law></LawSearch>';
  const 부른 = [];
  const 가짜 = async (u) => {
    부른.push(u);
    if (/lawSearch/.test(u)) return { ok: true, text: async () => 목록 };
    const mst = (u.match(/MST=(\d+)/) || [])[1], jo = (u.match(/JO=(\d+)/) || [])[1];
    return { ok: true, text: async () => '<조문단위><조문내용><![CDATA[MST' + mst + ' JO' + jo + ' 본문]]></조문내용></조문단위>' };
  };
  const r = await 법조문원문(가짜)([{ 법: '근로기준법', 조: 60, 의: 0 }, { 법: '남녀고용평등과 일·가정 양립 지원에 관한 법률', 조: 18, 의: 2 }]);
  assert.strictEqual(r.length, 2);
  assert.match(r[0].원문, /MST111 JO006000/, '시행령(222)의 번호를 집었다');
  assert.match(r[1].원문, /MST333 JO001802/, '가운뎃점 모양이 달라 못 찾았거나 «의» 번호를 잘못 붙였다');
});

test('③ 교정 지시 — 원문을 나란히 주고, 원문 없는 것은 판단하지 말라고 못 박는다', () => {
  const 회차 = { 우리글: '근로기준법 제60조에 따라 연차를 …', 안: { case: [{ 갈래: '판례', 사건번호: '2025다202901', 법원: '대법원',
    선고일: '2026-05-14', 판시사항: '소정근로시간 …', 우리말: '대법원은 2026. 5. 12. 선고한 판결에서 …' }] } };
  const 거리 = W.교정거리(회차);
  assert.match(거리, /사건번호: 2025다202901/);
  assert.match(거리, /선고일: 2026-05-14/);
  assert.match(거리, /우리가 쓴 말: 대법원은 2026\. 5\. 12\./);
  const 지 = W.교정지시(거리, [{ 이름: '근로기준법 제60조', 원문: '제60조(연차 유급휴가) …' }]);
  assert.match(지, /원문이 없는 것은 판단하지 마라/);
  assert.match(지, /기억으로 조문·판례를 말하지 마라/);
  assert.match(지, /근로기준법 제60조\n제60조\(연차 유급휴가\)/);
  assert.strictEqual(W.교정답읽기('[' + Array.from({ length: 8 }, (_, i) => '{"제목":"t' + i + '","설명":"d"}').join(',') + ']').length, 5);
});

test('④ 결과 — 숫자는 서버가 센다, AI 는 요약만', () => {
  /* 열쇠는 실제 열람 기록과 같은 꼴(Core.주소열쇠 — 점만 밑줄, @ 는 그대로) */
  const 열람표 = { 'a@x_kr': { 보냄: true, 열람: true, 클릭: true }, 'b@x_kr': { 보냄: true }, 'c@x_kr': { 보냄: true, 열람: true }, 'd@x_kr': { 보냄: true } };
  const 명단 = [{ email: 'a@x.kr', 유형: '자문' }, { email: 'b@x.kr', 유형: '자문' }, { email: 'c@x.kr', 유형: '급여' }, { email: 'd@x.kr', 유형: '급여' }];
  const 셈 = W.결과셈하기({ 회차: '2026-10-w1', 받는수: 4, 전달: { 실패: 1, 확인필요: 0 }, 열람표, 명단,
    반송들: { r1: { 회차: '2026-10-w1', 갈래: '서버거부' }, r2: { 회차: '2026-09-w4', 갈래: '모름' } }, 지난열람표: null });
  assert.strictEqual(셈.나감, 3);
  assert.strictEqual(셈.반송, 1, '다른 회차 반송까지 셌다');
  assert.strictEqual(셈.열람률, 50);
  assert.strictEqual(셈.클릭, 1);
  assert.strictEqual(셈.지난열람률, null);
  assert.deepStrictEqual(셈.유형별.map((x) => x.유형 + x.열람률).sort(), ['급여50', '자문50']);
  assert.match(W.결과요약지시(셈), /새 숫자를 만들거나 짐작하지 마라/);
  const 메일 = W.결과메일짓기(셈, [], '10월 1주차', 'https://x.test/pu-news.html');
  assert.match(메일.subject, /3곳 나감 · 반송 1 · 열람 50%/);
  assert.match(메일.html, /AI 요약을 못 붙였습니다/, '요약이 없을 때 숨기지 않는다');
});

test('① ⑤ 서버 — AI 는 의견만, 실패해도 나머지는 간다', () => {
  const 일 = 몸('newsletterWatchSunday');
  assert.match(일, /법조문원문\(NWatch\.조문들뽑기\(/);
  assert.match(일, /ai: true/);
  assert.match(일, /catch \(e\) \{\s*점검\.항목들\.push\(\{ 수준: "ok", 제목: "🤖 AI 교정을 못 했습니다"/, 'AI 실패가 점검을 멈춘다');
  assert.match(일, /secrets: \[[^\]]*GEMINI_KEY/);
  const 반 = 몸('newsletterBounceScan');
  const ai = 반.slice(반.indexOf('let AI수'), 반.indexOf('const upd = {}'));
  assert.match(ai, /b\.갈래 !== "모름"/, '까닭 모를 반송 말고도 AI 를 부른다');
  assert.ok(!/막을|blocked|b\.갈래 =|b\.상태 =/.test(ai), 'AI 답으로 서버가 갈래·상태·명단을 바꾼다 — 확정은 사람 몫이다');
  const 전 = 몸('newsletterWatchDelivery');
  assert.match(전, /NWatch\.결과셈하기\(/);
  assert.match(전, /try \{ 요약 = NWatch\.결과요약읽기/, 'AI 요약 실패가 결과 메일을 막는다');
  /* 화면 — AI 확정은 사람이 누르고, 없는 주소면 묻는다 */
  assert.match(화함('반송AI확정'), /confirm\(/);
  assert.ok(!/data\/companies/.test(화함('반송AI확정')), 'AI 확정이 원장을 건드린다');
});
