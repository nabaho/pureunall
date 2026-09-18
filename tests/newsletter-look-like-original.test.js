/* 뉴스레터 «생김새» — 받으신 원본처럼 (대표 지시 2026-09-14 「뉴스레터 디자인 이렇게 좀해달라」)

   우리 편지를 찍어 원본과 견줬다. 뼈대(Best·ISSUE·Attention·Trend)는 같은데 «느낌»이 달랐다:
     ① 차림표 — 꼭지 이름이 길어 한 칸이 두 줄로 꺾였다(원본은 한 줄)
     ② 판례 — 짙은 갈색 «채운 상자» 세 덩이(원본은 테두리 딱지 + 제목 한 줄 + 점선)
     ③ 표지 — 베이지 상자에 글자(원본은 흰 종이 표지)
     ④ Trend — 살구 판 + 짙은 단추(원본은 흰 바탕 + 세로 나눔선)
   ⚠ 여기서 못 박는 것은 «규칙»이다 — 색값·픽셀을 박지 않는다. */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');

const 설정 = { 회사이름: '푸른노무법인', 회신주소: 'a@b.kr', 꼬리한줄: '대표노무사 권형하' };
const 자료 = (i) => ({ 갈래: '자료', 제목: '자료 ' + i, 발행처: '고용노동부', 발행일: '2026-09-0' + i, 목차: ['개요', '범위'],
  파일: 'https://www.moel.go.kr/' + i + '.pdf', 확장자: 'pdf', 파일크기: 700000, 링크: 'https://www.moel.go.kr/d' + i });
function 편지(안) {
  return T.편지짓기({ 회차: C.회차('2026-09-14'), 안: 안, 우리글: '한마디', 범위: '전부' }, 설정).서식;
}
/* ⚠ 2026-09-17 꼭지 머리가 «알약 딱지 + 19px span» 에서 «영문 표시 + 17px div» 로
     바뀌었다(대표 지시 「전문보기도 맞춰라」). 이름으로 찾고, 다음 꼭지의 «영문 표시»
     앞까지 자른다 — 글자 크기를 못 박으면 다음에 또 여기서 깨진다. */
function 꼭지조각(h, 이름) {
  const i = h.indexOf('>' + 이름 + '</div>');
  assert.ok(i > 0, '★ 꼭지 «' + 이름 + '»를 못 찾았다');
  const j = h.indexOf('letter-spacing:2px', i + 10);   // 다음 꼭지 머리
  return h.slice(i, j < 0 ? undefined : j);
}

test('★★ 차림표는 «짧은 이름»으로 «한 줄»이다 — 긴 꼭지 이름이 두 줄로 꺾이지 않게', () => {
  C.꼭지들.forEach((g) => {
    assert.ok(g.차림표이름 && g.차림표이름.length <= 8, '★ «' + g.이름 + '»의 차림표 이름이 없거나 길다');
  });
  const h = 편지({ news: [{ 갈래: '기사', 제목: 'ㄱ', 우리말: '우리 말', 링크: 'https://n.kr/1' }] });
  const i = h.indexOf('data-stick="1"');
  const 차림 = h.slice(i, h.indexOf('</table>', i));
  C.꼭지들.forEach((g) => assert.ok(차림.indexOf(g.차림표이름) >= 0, '차림표에 «' + g.차림표이름 + '»이 없다'));
  assert.match(차림, /white-space:nowrap/, '★★ 한 줄로 못 박지 않으면 좁은 폰에서 또 꺾인다');
});

test('★★ 판례는 «채운 상자»가 아니라 «테두리 딱지 + 한 줄»이다', () => {
  const h = 편지({ case: [
    { 갈래: '판례', 딱지: '[판례]', 제목: '판례 하나', 인용: '대법원 2026다1', 링크: 'https://law.go.kr/1' },
    { 갈래: '판례', 딱지: '[행정해석]', 제목: '해석 하나', 인용: '근로기준정책과-1', 링크: 'https://law.go.kr/2' }
  ] });
  const 조각 = 꼭지조각(h, '판례·재결례·행정해석');
  assert.ok(!/background-color:#6f5a48/.test(조각), '★★ 짙은 갈색 «채운 상자»가 남아 있다 — 편지 한복판의 어두운 벽이다');
  assert.match(조각, /data-tag="판례"[^>]*border:1px solid/, '★ 판례 딱지가 테두리 상자가 아니다');
  assert.match(조각, /data-tag="행정해석"/, '★ 해석 딱지가 없다 — 판례와 갈라 보여야 한다');
  assert.match(조각, /border-bottom:1px dashed/, '★ 줄 사이 점선이 없다');
  assert.ok(!/\[판례\]|\[행정해석\]/.test(조각), '딱지 상자 안에 괄호 글자까지 들어갔다 — 상자가 이미 괄호다');
});

test('★★ «글자 표지»는 없다 — 제목을 두 번 적지 않는다', () => {
  /* 대표 지시 2026-09-18 「더 줄여라」. 그림이 없을 때 그리던 흰 종이 모양 표지는
     바로 옆 제목을 한 번 더 적은 것이었고, 130px 로 «카드 높이를 혼자 정하고» 있었다.
     ⚠ 발행처는 카드 밑줄에 그대로 남는다 — 걷은 것은 «되풀이»지 내용이 아니다. */
  const h = 편지({ policy: [자료(1), 자료(2)] });
  const 조각 = 꼭지조각(h, '고용·노동정책 · 기업지원');
  assert.ok(!/height:98px/.test(조각), '★ 글자 표지 상자가 아직 그려진다');
  const 제목수 = (조각.match(/자료 1/g) || []).length;
  assert.equal(제목수, 1, '★ 같은 제목이 표지에 한 번 더 적혀 있다 (' + 제목수 + '번)');
  assert.match(조각, />고용노동부/, '발행처까지 사라졌다 — 그건 내용이다');
});

test('★ 표지 «그림»을 주면 그때는 그린다 — 우리 홈페이지 것만', () => {
  const 그림자료 = Object.assign(자료(1), { 표지: 'https://nabaho.github.io/pureunall/img/c1.png' });
  const 남의것 = Object.assign(자료(2), { 표지: 'https://evil.example.com/c2.png' });
  const 조각 = 꼭지조각(편지({ policy: [그림자료, 남의것] }), '고용·노동정책 · 기업지원');
  assert.match(조각, /<img src="https:\/\/nabaho\.github\.io\/pureunall\/img\/c1\.png"/, '★ 우리 표지 그림이 안 나온다');
  assert.ok(!/evil\.example\.com/.test(조각), '⚠ 남의 서버 표지가 나갔다 — 열람 추적이 새는 자리다');
});

test('★ Trend(인사·노무관리) 자료 칸은 흰 바탕이고, ISSUE 는 살구 판이다 — 원본이 그렇다', () => {
  const h = 편지({ policy: [자료(1), 자료(2)], hr: [자료(3), 자료(4)] });
  const issue = 꼭지조각(h, '고용·노동정책 · 기업지원');
  const trend = 꼭지조각(h, '인사·노무관리');
  assert.match(issue, /style="background-color:#fbf4ea;"/, '★ ISSUE 살구 판이 없다');
  assert.match(trend, /style="background-color:#ffffff;">/, '★ Trend 가 흰 바탕이 아니다');
});

test('★ 내려받기는 «가벼운» 단추다 — 채운 덩이가 아니라 테두리', () => {
  const h = 편지({ policy: [자료(1), 자료(2)] });
  const m = h.match(/<a href="https:\/\/www\.moel\.go\.kr\/1\.pdf"[^>]*>내려받기/);
  assert.ok(m, '★ 내려받기 단추가 없거나 글귀가 「내려받기」로 시작하지 않는다');
  assert.ok(!/background-color:#6f5a48/.test(m[0]), '★ 채운 갈색 단추다 — 여섯 개가 서면 무겁다');
  assert.match(m[0], /border:1px solid/, '테두리 단추여야 한다');
});

test('★ 주간뉴스 줄은 «표»로 시작하는 목록이다', () => {
  /* ⚠ 표가 «제목 줄 안»에 있어야 한다 — 밖에 두면 제목이 덩이(div)라 표만 윗줄에
       덩그러니 떠서 빈 줄을 차지했다(2026-09-17 대표 화면). 표 글자는 「—」다. */
  const h = 편지({ news: [{ 갈래: '기사', 제목: 'ㄱ', 우리말: '우리 말 한 줄', 링크: 'https://n.kr/1', 언론사: '매일노동뉴스' }] });
  const 조각 = 꼭지조각(h, '주간노동뉴스');
  assert.match(조각, /&#8212;<\/span>&nbsp;우리 말 한 줄/, '★ 표로 시작하지 않는다');

  const h2 = 편지({ news: [{ 갈래: '기사', 제목: 'ㄱ', 한줄: '한 줄 제목입니다',
    우리말: '우리 말 한 줄', 링크: 'https://n.kr/1', 언론사: '매일노동뉴스' }] });
  const 조각2 = 꼭지조각(h2, '주간노동뉴스');
  assert.match(조각2, /&#8212;<\/span>&nbsp;한 줄 제목입니다/,
    '★★ 한 줄 제목이 있으면 표가 «그 줄 안»에 있어야 한다 — 밖이면 점만 뜬다');
});
