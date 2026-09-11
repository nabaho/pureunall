const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Sources = require('../js/pu-news-regional-sources.js');

const 화면 = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');

test('지역뉴스 공식 출처는 영구 열쇠·지역·공식 HTTPS 주소를 갖는다', () => {
  const seen = new Set();
  assert.ok(Sources.목록.length >= 6);
  Sources.목록.forEach((x) => {
    assert.match(x.id, /^[a-z0-9-]+$/);
    assert.equal(seen.has(x.id), false); seen.add(x.id);
    assert.ok(x.기관 && x.지역 && x.목록주소);
    assert.match(x.목록주소, /^https:\/\//);
    assert.equal(Sources.공식주소인가(x.목록주소), true);
  });
});

test('수집 가능한 RSS와 사람이 확인할 게시판을 구분한다', () => {
  const rss = Sources.목록.filter(x => x.방식 === 'rss');
  const board = Sources.목록.filter(x => x.방식 === 'board');
  assert.ok(rss.length >= 3);
  assert.ok(board.length >= 3);
  assert.ok(rss.every(x => /\.do(?:\?|$)/.test(x.목록주소)));
});

test('출처 추천은 받는 지역의 전국·시도·시군 출처만 돌려준다', () => {
  const 서산 = Sources.지역출처('충남/서산시');
  assert.ok(서산.some(x => x.지역 === '전국'));
  assert.ok(서산.some(x => x.지역 === '충남'));
  assert.ok(서산.some(x => x.지역 === '충남/서산시'));
  assert.equal(서산.some(x => x.지역 === '충남/천안시'), false);
});

test('저작권 원칙은 원문·사진 복제가 아니라 자체 요약과 출처 링크다', () => {
  assert.equal(Sources.저작권.본문복제, false);
  assert.equal(Sources.저작권.사진복제, false);
  assert.equal(Sources.저작권.자체요약필수, true);
  assert.equal(Sources.저작권.원문링크필수, true);
});

test('뉴스레터 화면이 공식 출처 등록부를 캐시번호와 함께 싣고 입력에 사용한다', () => {
  assert.match(화면, /js\/pu-news-regional-sources\.js\?v=\d+/);
  assert.match(화면, /PuNewsRegionalSources/);
  assert.match(화면, /공식출처고르기\(/);
});
