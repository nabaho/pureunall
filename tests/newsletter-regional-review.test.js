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

test('승인은 회차와 후보를 한 트랜잭션으로 저장한다', () => {
  assert.match(화면, /지역후보승인\(/);
  assert.match(화면, /지역후보제외\(/);
  const i = 화면.indexOf('async function 지역후보승인');
  const body = 화면.slice(i, 화면.indexOf('function 공식출처고르기',i));
  assert.ok(body.indexOf('.transaction(') >= 0);
  assert.match(body, /지역검토\.원자승인/);
  assert.doesNotMatch(body, /회차저장\(/);
});

test('일반 본문 저장이 서버 지역뉴스를 덮어쓰지 않는다', () => {
  const body=화면.slice(화면.indexOf('function 회차저장'),화면.indexOf('function render'));
  assert.doesNotMatch(body, /지역뉴스\s*:/);
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

test('오래된 잠금도 지연된 저장 여부를 알 수 없으면 자동 해제하지 않는다', () => {
  const c = Review.검토변경(후보, '승인처리중', 'admin@test', 100, '');
  assert.equal(Review.복구판정(c, {}, 500000, 600000), null, '10분 전에는 건드리지 않는다');
  const x = Review.복구판정(c, {}, 1000000, 600000);
  assert.equal(x, null);
});

test('승인 중단 복구는 회차와 후보의 같은 서버 스냅샷으로 판정한다', () => {
  const i = 화면.indexOf('function 지역후보복구');
  const body = 화면.slice(i, 화면.indexOf('async function 지역후보제외',i));
  assert.match(body, /regionalCandidates/);
  assert.match(body, /\.transaction\(/);
  assert.match(body, /cur\.issues/);
  assert.doesNotMatch(body, /App\.회차들/);
  assert.ok(화면.indexOf('지역후보복구();') > 화면.indexOf('App.지역후보 ='));
});

test('두 관리자의 다른 후보 승인은 재시도 후 모두 남고 원본은 불변이다', () => {
  const b={...후보,id:'regional-news-b'};
  const root={regionalCandidates:{[후보.id]:후보,[b.id]:b},issues:{w:{지역뉴스:[],우리글:'유지'}},config:{keep:true}};
  const draft={열쇠:'w',회차:{열쇠:'w'}};
  const one=Review.원자승인(root,후보.id,draft,'설명 A','담당A',100);
  const two=Review.원자승인(one,b.id,draft,'설명 B','담당B',200);
  assert.deepEqual(two.issues.w.지역뉴스.map(x=>x.후보Id),[후보.id,b.id]);
  assert.equal(two.issues.w.우리글,'유지');
  assert.deepEqual(two.config,root.config);
  assert.equal(root.issues.w.지역뉴스.length,0);
  assert.equal(root.regionalCandidates[후보.id].상태,'검토대기');
  assert.equal(two.regionalCandidates[b.id].상태,'승인');
  assert.equal(Review.원자승인(two,후보.id,draft,'중복','담당C',300),null);
});

test('철회 후 늦게 도착한 추가는 철회를 보존하고 발송 회차는 바꾸지 않는다', () => {
  const old=Review.승인뉴스(후보,'설명',[],100);
  const withdrawn=Review.철회(old,'철회','담당A',200);
  const news={...old,id:'new',후보Id:'new-candidate'};
  const issue={지역뉴스:[withdrawn],상태:'초안',우리글:'본문'};
  const next=Review.회차추가(issue,news,{},'담당B',300);
  assert.deepEqual(next.지역뉴스[0],withdrawn);
  assert.equal(next.지역뉴스.length,2);
  assert.equal(Review.회차추가({...issue,상태:'발송'},news,{},'담당B',300),null);
});

test('잘못된 승인 입력은 후보나 회차 어느 쪽도 변경하지 않는다', () => {
  const root={regionalCandidates:{[후보.id]:후보},issues:{}};
  const before=structuredClone(root);
  assert.equal(Review.원자승인(root,후보.id,{열쇠:'w'},'','담당A',100),null);
  assert.deepEqual(root,before);
});
