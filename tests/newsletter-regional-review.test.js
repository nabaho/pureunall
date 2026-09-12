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

test('수동 등록도 온톨로지 계약과 출처를 빠짐없이 갖는다', () => {
  const x = Review.수동뉴스({ 지역:'충남/서산시', 제목:'서산 안내',
    링크:'https://www.seosan.go.kr/a', 출처Id:'seosan-city', 언론사:'서산시', 우리말:'직접 쓴 설명' },
    'admin@test', 1234);
  assert.equal(x.id, 'manual-regional-1234');
  assert.equal(x.entityType, 'Message');
  assert.equal(x.schemaVersion, 1);
  assert.equal(x.contractVersion, 1);
  assert.equal(x.revision, 1);
  assert.equal(x.sourceKind, 'regionalNewsSource');
  assert.equal(x.sourceId, 'seosan-city');
  assert.equal(x.상태, '활성');
});

test('지역뉴스 철회는 물리 삭제하지 않고 사유와 감사이력을 남긴다', () => {
  const x = Review.승인뉴스(후보, '직접 쓴 설명', [], 100);
  const y = Review.철회(x, '이번 회차와 맞지 않음', 'admin@test', 200);
  assert.equal(y.상태, '철회');
  assert.equal(y.revision, 2);
  assert.equal(y.철회사유, '이번 회차와 맞지 않음');
  assert.equal(y.철회자, 'admin@test');
  assert.equal(y.철회일, 200);
  assert.equal(y.링크, x.링크);
  assert.equal(Review.활성인가(y), false);
  assert.equal(Review.철회(y, '다시', 'other@test', 300), null);
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

test('회차에서 빼기는 배열 삭제가 아니라 건별 트랜잭션 철회다', () => {
  const i = 화면.indexOf('function 지역뉴스빼기');
  const body = 화면.slice(i, i + 1800);
  assert.match(body, /\/지역뉴스/);
  assert.match(body, /\.transaction\(/);
  assert.match(body, /지역검토\.철회/);
  assert.doesNotMatch(body, /\.splice\(/);
  assert.match(화면, /철회 이력/);
  assert.match(화면, /철회사유/);
  assert.match(화면, /철회자/);
});

test('중단된 승인이 회차에 있으면 승인 완료로 복구한다', () => {
  const c = Review.검토변경(후보, '승인처리중', 'admin@test', 100, '');
  const issues = { '2026-09-w2':{ 지역뉴스:[{ 후보Id:후보.id, 상태:'활성' }] } };
  const x = Review.복구판정(c, issues, 1000000, 600000);
  assert.equal(x.상태, '승인');
  assert.equal(x.승인회차, '2026-09-w2');
  assert.equal(x.revision, 3);
  assert.equal(x.복구결과, '회차 저장 확인');
});

test('회차에 없는 오래된 승인 잠금만 검토대기로 복구한다', () => {
  const c = Review.검토변경(후보, '승인처리중', 'admin@test', 100, '');
  assert.equal(Review.복구판정(c, {}, 500000, 600000), null, '10분 전에는 건드리지 않는다');
  const x = Review.복구판정(c, {}, 1000000, 600000);
  assert.equal(x.상태, '검토대기');
  assert.equal(x.검토자, '');
  assert.equal(x.revision, 3);
  assert.equal(x.복구결과, '회차 저장 없음 — 잠금 해제');
});

test('승인 중단 복구도 revision을 확인하는 건별 트랜잭션이다', () => {
  const i = 화면.indexOf('function 지역후보복구');
  const body = 화면.slice(i, i + 2300);
  assert.match(body, /regionalCandidates/);
  assert.match(body, /\.transaction\(/);
  assert.match(body, /cur\.상태!=='승인처리중'/);
  assert.match(body, /cur\.revision/);
  assert.match(body, /10\*60\*1000/);
  assert.ok(화면.indexOf('지역후보복구();') > 화면.indexOf('App.지역후보 ='));
});
