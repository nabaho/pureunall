const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Review = require('../js/pu-news-review.js');

const 화면 = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');
const 후보 = { id:'regional-news-a', entityType:'Message', schemaVersion:1, contractVersion:1,
  revision:1, 상태:'검토대기', 제목:'육아휴직 지원 안내', 링크:'https://www.moel.go.kr/a',
  기관:'고용노동부', 지역:'전국', 출처Id:'moel-policy' };

test('검토상태는 대기 후보만 승인처리중·제외로 바꾸고 수정차수를 올린다', () => {
  const a = Review.검토변경(후보, '승인처리중', 'admin@test', 100, '');
  assert.equal(a.상태, '승인처리중');
  assert.equal(a.revision, 2);
  assert.equal(a.검토자, 'admin@test');
  assert.equal(Review.검토변경(a, '제외', 'other@test', 200, '중복'), null);
});

test('제외에는 사유를 남기되 후보 원문 정보는 보존한다', () => {
  const x = Review.검토변경(후보, '제외', 'admin@test', 100, '사업장과 무관');
  assert.equal(x.제외사유, '사업장과 무관');
  assert.equal(x.제목, 후보.제목);
  assert.equal(x.링크, 후보.링크);
});

test('승인 뉴스는 푸른 자체 설명이 반드시 있어야 한다', () => {
  assert.equal(Review.승인뉴스(후보, '', [], 100), null);
  const x = Review.승인뉴스(후보, '사업주가 지원 요건을 확인할 내용입니다.', [], 100);
  assert.equal(x.우리말, '사업주가 지원 요건을 확인할 내용입니다.');
  assert.equal(x.후보Id, 후보.id);
  assert.equal(x.언론사, '고용노동부');
  assert.equal(x.id, 'approved-' + 후보.id);
  assert.equal(x.entityType, 'Message');
  assert.equal(x.schemaVersion, 1);
  assert.equal(x.contractVersion, 1);
  assert.equal(x.revision, 1);
  assert.equal(x.sourceKind, 'regionalNewsCandidate');
  assert.equal(x.sourceId, 후보.id);
});

test('같은 후보는 회차에 두 번 승인하지 않는다', () => {
  const existing = [{ 후보Id:후보.id, 우리말:'이미 담음' }];
  assert.equal(Review.승인뉴스(후보, '다시 담기', existing, 100), null);
});

test('화면에는 승인·제외 단추가 있고 트랜잭션으로 먼저 선점한다', () => {
  assert.match(화면, /지역후보승인\(/);
  assert.match(화면, /지역후보제외\(/);
  const i = 화면.indexOf('async function 지역후보승인');
  const body = 화면.slice(i, i + 5000);
  assert.ok(body.indexOf('.transaction(') >= 0);
  assert.ok(body.indexOf('.transaction(') < body.indexOf('회차저장('));
  assert.doesNotMatch(body, /return 지역검토\.검토변경/,
    '검토변경 실패의 null을 그대로 반환하면 후보가 물리 삭제됩니다');
});

test('승인 실패 시 자신이 선점한 후보만 검토대기로 복구한다', () => {
  assert.match(화면, /cur\.상태!=='승인처리중'\|\|cur\.검토자!==검토자/);
  assert.match(화면, /상태:'검토대기'/);
  assert.match(화면, /if\(회차저장완료\)/);
});
