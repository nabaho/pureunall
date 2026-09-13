const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Region = require('../functions/news-region.js');
const BrowserSources = require('../js/pu-news-regional-sources.js');

const 화면 = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');
const 함수 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');

const xml = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[노사문화 대상 후보사업장 공개검증]]></title>
<link>https://www.moel.go.kr/news/notice/noticeView.do?bbs_seq=1</link>
<pubDate>Thu, 10 Sep 2026 09:00:00 +0900</pubDate><description>복제하면 안 되는 본문</description></item>
<item><title>고용노동부 공무원 채용 공고</title>
<link>https://www.moel.go.kr/news/notice/noticeView.do?bbs_seq=2</link></item>
</channel></rss>`;

test('서버와 화면의 RSS 공식 출처가 영구 ID·주소까지 같다', () => {
  const browser = BrowserSources.목록.filter(x=>x.방식==='rss').map(x=>[x.id,x.목록주소]);
  const server = Region.출처들.filter(x=>x.방식!=='board').map(x=>[x.id,x.목록주소]);
  assert.deepEqual(server, browser);
});

test('★ 서버가 읽는 «게시판» 출처도 화면 등록부에 똑같이 있다', () => {
  /* ⚠ 예전에는 서버가 rss 만 읽었다. 2026-09-13 부터 지방고용노동관서 게시판도 읽는다
       (대표 물음 「다른지역 정보 가지고 오는건 어떻게 되었나」).
     ★ 두 등록부가 어긋나면 화면은 「이 출처에서 온 것」이라 적는데 그런 출처가 없다. */
  const 화면것 = new Map(BrowserSources.목록.map(x=>[x.id,x.목록주소]));
  Region.출처들.filter(x=>x.방식==='board').forEach((s) => {
    assert.equal(화면것.get(s.id), s.목록주소,
      '★ 화면 등록부에 없거나 주소가 다르다: ' + s.id);
  });
});

test('★★ 「전국이 아닌» 출처를 서버가 실제로 읽는다 — 등록만 해 두면 한 건도 안 온다', () => {
  /* ⚠⚠ 실측 2026-09-13: 지자체 셋이 화면 등록부에 있었지만 서버는 rss 만 읽어
       «지역 정보가 한 건도» 안 들어오고 있었다. 후보 20건이 전부 「전국」이었다.
       기계가 도는 것과 일이 되는 것은 다르다. */
  const 읽는지역것 = Region.출처들.filter(x=>String(x.지역||'전국') !== '전국');
  assert.ok(읽는지역것.length >= 1,
    '★★ 서버가 읽는 출처가 전부 「전국」이다 — 지역뉴스가 아니다');
});

test('RSS에서 쓸모 있는 제목·공식 링크만 검토후보로 만든다', () => {
  const out = Region.후보만들기(xml, Region.출처들[0], {}, 1788998400000);
  assert.equal(out.length, 1);
  assert.equal(out[0].상태, '검토대기');
  assert.equal(out[0].entityType, 'Message');
  assert.equal(out[0].출처Id, 'moel-notice');
  assert.equal(out[0].지역, '전국');
  assert.equal(Object.hasOwn(out[0], '본문'), false);
  assert.equal(JSON.stringify(out[0]).includes('복제하면 안 되는 본문'), false);
});

test('같은 공식 링크는 다시 후보로 만들지 않는다', () => {
  const existing = { old:{ 링크:'https://www.moel.go.kr/news/notice/noticeView.do?bbs_seq=1' } };
  assert.equal(Region.후보만들기(xml, Region.출처들[0], existing, 1788998400000).length, 0);
});

test('후보 레코드는 온톨로지 저장계약과 수정차수를 갖는다', () => {
  const x = Region.후보만들기(xml, Region.출처들[0], {}, 1788998400000)[0];
  assert.match(x.id, /^regional-news-/);
  assert.equal(x.schemaVersion, 1);
  assert.equal(x.contractVersion, 1);
  assert.equal(x.revision, 1);
  assert.equal(x.sourceKind, 'regionalNewsSource');
  assert.equal(x.sourceId, 'moel-notice');
});

test('매일 수집기는 검토대기함에만 쓰고 회차나 발송을 건드리지 않는다', () => {
  const body = 함수.slice(함수.indexOf('exports.dailyRegionalNewsCollect'),
    함수.indexOf('exports.dailyRegionalNewsCollect') + 5000);
  assert.match(body, /newsletter\/regionalCandidates/);
  assert.doesNotMatch(body, /newsletter\/issues|sendBulkMail|weeklyReady/);
});

test('공공기관 RSS 기본 연결 실패 시 IPv4로 재시도하고 원인을 기록한다', () => {
  assert.match(함수, /function IPv4로글자받기/);
  assert.match(함수, /family:\s*4/);
  assert.match(함수, /return await IPv4로글자받기\(url\)/);
  assert.match(함수, /기본 연결:[\s\S]*IPv4 연결:/);
});

test('뉴스레터 화면은 검토대기 후보를 읽어 지역뉴스 화면에서 보여 준다', () => {
  assert.match(화면, /newsletter\/regionalCandidates/);
  assert.match(화면, /지역후보/);
  assert.match(화면, /검토대기/);
});
