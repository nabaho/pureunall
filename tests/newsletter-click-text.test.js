/* 글자를 눌러도 «단추와 같은 곳»으로 간다 (대표 지시 2026-09-27)
   「원문 내려받기 전문보기를 클릭하면 각각의 자료가 나온다 이 단어 외에 내용을 클릭해도
    다운받을 수 있게 해달라」

   ■ 이 검사가 지키는 «규칙»
     ① 기사 — 한 줄 제목·우리 말을 누르면 「원문 ↗」과 같은 곳
     ② 자료 — 제목·설명을 누르면 「내려받기」와 같은 곳 (붙임 없으면 「자세히 보기」와 같은 곳)
     ③ 판례 — 제목을 누르면 「전문 보기」와 같은 곳, 그 자리에서 펴는 표(data-law)까지 같다
     ④ 새 목적지를 만들지 않는다 — 추적 목록(링크들)이 안 는다
     ⑤ 대문 주소면 글자도 안 건다 (「원문 ↗」을 안 다는 잣대와 같다)
     ⑥ 글자 링크는 색을 적는다 — 파란 밑줄 밭이 안 된다
     ⑦ 발송기를 지난 뒤에도 산다 */

const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');
const MS = require('../functions/mail-send.js');

const 밑 = 'https://example.test/fn';
function 짓기(안, 추적) {
  const d = { 회차: C.회차('2026-09-21'), 우리글: '', 안: 안 };
  d.회차.열쇠 = '2026-09-w4';
  return T.편지짓기(d, { 회사이름: '푸른노무법인', 추적밑주소: 추적 === false ? '' : 밑 },
    { 요약: false, 미리보기: 추적 === false });
}
/* 글자 «바로 앞»의 링크 주소 — <a href="…" …>글자 */
function 글앞주소(서식, 글자) {
  const i = 서식.indexOf(글자);
  assert.ok(i > 0, '「' + 글자 + '」를 못 찾았다 — 검사가 헛돈다');
  const 앞 = 서식.slice(Math.max(0, i - 700), i);
  const m = /<a href="([^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*$/.exec(앞);
  return m ? m[1] : '';
}
function 단추주소(서식, 단추글) {
  const i = 서식.indexOf(단추글);
  const 앞 = 서식.slice(Math.max(0, i - 700), i);
  const m = /<a href="([^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*$/.exec(앞);
  return m ? m[1] : '';
}

const 기사 = { 갈래: '기사', 제목: '매체 제목', 한줄: '홍길동 사건 한 줄 제목',
  우리말: '가나상사 사례로 본 연차 수당 정리입니다.', 링크: 'https://news.example.kr/article/123', 언론사: '가나일보' };
const 자료 = { 갈래: '자료', 제목: '가나상사 교육 안내 자료', 발행처: '고용노동부', 발행일: '20260901',
  파일: 'https://www.moel.go.kr/files/f1.pdf', 링크: 'https://www.moel.go.kr/view/1', 우리말: '연차 관리 요령을 정리한 안내서입니다.' };
const 판례 = { 갈래: '판례', 딱지: '[판례]', 제목: '가나상사 사건 판시사항 제목',
  인용: '대법원 2026. 5. 21. 선고 2018다296229', 링크: 'https://www.law.go.kr/LSW/precInfoP.do?target=prec&ID=622111' };

test('★★★ 기사 — 한 줄 제목·우리 말을 누르면 「원문 ↗」과 같은 곳', () => {
  const s = 짓기({ news: [기사] }).서식;
  const 원문 = 단추주소(s, '원문 ↗');
  assert.ok(원문, '원문 단추를 못 찾았다 — 검사가 헛돈다');
  assert.strictEqual(글앞주소(s, '홍길동 사건 한 줄 제목'), 원문, '★★★ 한 줄 제목을 눌러도 원문이 안 열린다');
  assert.strictEqual(글앞주소(s, '가나상사 사례로 본 연차'), 원문, '★★★ 우리 말을 눌러도 원문이 안 열린다');
});

test('★★★ 자료 — 제목·설명을 누르면 「내려받기」와 같은 곳', () => {
  const s = 짓기({ policy: [자료] }).서식;
  const 받기 = 단추주소(s, '내려받기 ↓');
  assert.ok(받기, '내려받기 단추를 못 찾았다 — 검사가 헛돈다');
  assert.strictEqual(글앞주소(s, '가나상사 교육 안내 자료'), 받기, '★★★ 제목을 눌러도 안 받아진다');
  assert.strictEqual(글앞주소(s, '연차 관리 요령'), 받기, '★★★ 설명을 눌러도 안 받아진다');
  /* 붙임이 없으면 «자세히 보기»와 같은 곳 */
  const 없 = 짓기({ policy: [Object.assign({}, 자료, { 파일: '' })] }).서식;
  const 자세히 = 단추주소(없, '자세히 보기 ↗');
  assert.ok(자세히, '자세히 보기 단추를 못 찾았다');
  assert.strictEqual(글앞주소(없, '가나상사 교육 안내 자료'), 자세히, '★★ 붙임 없는 자료의 제목이 딴 데로 간다');
});

test('★★★ 판례 — 제목을 누르면 「전문 보기」와 같은 곳, 그 자리에서 펴는 표까지 같다', () => {
  const s = 짓기({ case: [판례] }).서식;
  const 전문 = 단추주소(s, '전문 보기 ↗');
  assert.ok(전문, '전문 보기 단추를 못 찾았다 — 검사가 헛돈다');
  assert.strictEqual(글앞주소(s, '가나상사 사건 판시사항 제목'), 전문, '★★★ 판례 제목을 눌러도 전문이 안 열린다');
  /* 두 링크의 여는 태그에 붙은 data-* 표가 같아야 웹 쪽에서 똑같이 움직인다 */
  const 태그들 = (s.match(/<a href="[^"]*"[^>]*>/g) || []).filter((a) => a.indexOf(전문.slice(0, 40)) >= 0);
  const 표들 = 태그들.map((a) => (a.match(/\sdata-[\w-]+="[^"]*"/g) || []).join(''));
  assert.ok(태그들.length >= 2, '같은 곳으로 가는 링크가 둘이 아니다');
  assert.ok(표들.every((x) => x === 표들[0]), '★★ 제목과 「전문 보기」가 달리 움직인다 — 펴는 표가 다르다');
});

test('★★ 새 목적지를 만들지 않는다 — 추적 목록이 안 는다', () => {
  const 편 = 짓기({ news: [기사], policy: [자료], case: [판례] });
  const 목록 = (편.링크들 || []).map((v) => (v && typeof v === 'object') ? v.주소 : v);
  assert.ok(목록.length > 0, '추적 목록이 비었다 — 검사가 헛돈다');
  assert.strictEqual(new Set(목록).size, 목록.length, '같은 주소가 목록에 두 번 들었다');
  /* 자료는 붙임이 있으면 «상세 쪽»을 목록에 안 올린다(아무도 안 누를 번호) */
  assert.ok(목록.indexOf('https://www.moel.go.kr/view/1') < 0, '★★ 그리지도 않는 상세 쪽이 목록에 들었다');
});

test('★★ 대문 주소면 글자도 안 건다', () => {
  const s = 짓기({ news: [Object.assign({}, 기사, { 링크: 'https://news.example.kr/' })] }, false).서식;
  assert.ok(s.indexOf('원문 ↗') < 0, '대문인데 원문 단추가 있다 — 검사 앞제가 틀렸다');
  assert.strictEqual(글앞주소(s, '홍길동 사건 한 줄 제목'), '', '★★ 대문 주소로 가는 글자 링크가 생겼다');
});

test('★ 글자 링크는 색을 적는다 — 파란 밑줄 밭이 안 된다', () => {
  const s = 짓기({ news: [기사], policy: [자료], case: [판례] }).서식;
  ['홍길동 사건 한 줄 제목', '가나상사 교육 안내 자료', '가나상사 사건 판시사항 제목'].forEach(function (글) {
    const i = s.indexOf(글);
    const 태그 = /<a [^>]*>$/.exec(s.slice(Math.max(0, i - 400), i));
    assert.ok(태그, 글 + ' 앞에 링크 태그가 없다');
    assert.match(태그[0], /color:#?[0-9a-z]+;text-decoration:none/i, '★ 색·밑줄 없음을 안 적었다: ' + 글);
  });
});

test('★★ 발송기를 지난 뒤에도 산다', () => {
  const 씻 = MS.sanitizeHtml(짓기({ news: [기사], policy: [자료], case: [판례] }).서식);
  ['홍길동 사건 한 줄 제목', '가나상사 교육 안내 자료', '가나상사 사건 판시사항 제목'].forEach(function (글) {
    assert.ok(글앞주소(씻, 글), '★★ 발송기가 글자 링크를 걷었다: ' + 글);
  });
});
