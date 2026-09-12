const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/pu-news-core.js');
const Tpl = require('../js/pu-news-tpl.js');
const MB = require('../functions/mail-bulk.js');
const fs = require('node:fs');
const path = require('node:path');
const 화면 = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');

test('주소를 표준 지역코드로 바꾼다 — 충남 시군과 광역시', () => {
  assert.equal(Core.지역코드('충청남도 서산시 남부순환로 1035'), '충남/서산시');
  assert.equal(Core.지역코드('(31100) 충남 천안시 서북구 원두정8길 6'), '충남/천안시');
  assert.equal(Core.지역코드('서울특별시 강남구 테헤란로 1'), '서울/강남구');
  assert.equal(Core.지역코드(''), '전국');
});

test('지역뉴스는 전국·도·시군 계층에 맞는 것만 고른다', () => {
  const 뉴스 = [
    { 제목:'전국', 지역:'전국' }, { 제목:'충남', 지역:'충남' },
    { 제목:'서산', 지역:'충남/서산시' }, { 제목:'천안', 지역:'충남/천안시' }
  ];
  assert.deepEqual(Core.지역뉴스고르기(뉴스, '충남/서산시').map(x=>x.제목), ['전국','충남','서산']);
  assert.deepEqual(Core.지역뉴스고르기(뉴스, '전국').map(x=>x.제목), ['전국']);
});

test('철회된 지역뉴스는 어느 지역판에도 들어가지 않는다', () => {
  const 뉴스 = [
    { 지역:'전국', 제목:'살아 있음', 상태:'활성' },
    { 지역:'전국', 제목:'철회됨', 상태:'철회', 철회사유:'오류' },
    { 지역:'충남/서산시', 제목:'서산 철회', 상태:'철회' }
  ];
  assert.deepEqual(Core.지역뉴스고르기(뉴스, '충남/서산시').map(x=>x.제목), ['살아 있음']);
});

test('사업장 명단에 업체 주소 기반 지역을 함께 나른다', () => {
  const r = Core.사업장에서명단({ a:{ id:'a', status:'active', name:'서산회사',
    address:'충남 서산시 예천동 1', primaryContactEmail:'a@example.com' } }, '자문중');
  assert.equal(r.줄들[0].지역, '충남/서산시');
  assert.equal(Core.명단다듬기(r.줄들, {}).ok[0].지역, '충남/서산시');
});

test('지역뉴스 조각은 그 지역 기사만 그리고 출처·원문 링크를 밝힌다', () => {
  const h = Tpl.지역뉴스조각([
    { 제목:'서산 지원사업', 우리말:'서산 사업장이 확인할 지원사업입니다.', 지역:'충남/서산시',
      언론사:'서산시', 링크:'https://www.seosan.go.kr/a' },
    { 제목:'천안 지원사업', 우리말:'천안 전용입니다.', 지역:'충남/천안시',
      언론사:'천안시', 링크:'https://www.cheonan.go.kr/b' }
  ], '충남/서산시');
  assert.match(h, /서산 사업장이 확인할 지원사업입니다/);
  assert.match(h, /서산시/);
  assert.match(h, /https:\/\/www\.seosan\.go\.kr\/a/);
  assert.doesNotMatch(h, /천안 전용/);
});

test('대량발송기는 받는 업체별 지역뉴스를 각 통에만 넣는다', () => {
  const v = MB.validateBulk({
    to:[
      { email:'s@example.com', region:'충남/서산시', regionHtml:'<b>서산 소식</b>', regionText:'서산 소식' },
      { email:'c@example.com', region:'충남/천안시', regionHtml:'<b>천안 소식</b>', regionText:'천안 소식' }
    ], subject:'소식', body:'공통\n{지역뉴스평문}', html:'<main>공통{지역뉴스}</main>'
  });
  assert.equal(v.ok, true);
  const q = MB.buildQueue(v, 1000, '관리자', 'b1');
  assert.match(q[0].payload.html, /서산 소식/);
  assert.doesNotMatch(q[0].payload.html, /천안 소식/);
  assert.match(q[1].payload.body, /천안 소식/);
});

test('지역뉴스 HTML·평문에는 크기 상한이 있다', () => {
  const v = MB.validateBulk({ to:[{ email:'a@example.com', regionHtml:'가'.repeat(30000) }],
    subject:'소식', body:'본문', html:'<p>본문</p>' });
  assert.equal(v.ok, false);
  assert.match(v.error, /지역뉴스/);
});

test('시험메일도 지역뉴스 치환문구를 남기지 않고 전국판을 만든다', () => {
  assert.match(화면, /function 지역판씌우기\(/);
  assert.match(화면, /편\s*=\s*지역판씌우기\(편, 지금회차\(\), '전국'\)/);
});

test('실제·예약 발송 전에 주소별 지역판 분포를 보여 준다', () => {
  assert.match(화면, /function 지역판요약\(/);
  assert.equal((화면.match(/지역판.*지역판요약\(r\.ok\)/g)||[]).length, 2);
});
