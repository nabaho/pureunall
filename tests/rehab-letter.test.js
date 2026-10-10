/* 회생광고 안내문·라벨 — 글만 만드는 부품(js/rehab-letter.js)을 노드에서 그대로 돌려 본다.
   지키는 것: ① 회사명이 들어가고, 글자가 HTML 로 해석되지 않는다 ② 비용(자부담)을 안내한다
   ③ 이메일·문자 발송 안내가 아니다(우편 + 수신거부 한 줄) ④ 라벨은 본점 주소 · 16칸마다 쪽을 나눈다
   실행: node --test tests/rehab-letter.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/rehab-letter.js');

const co = (n, extra) => Object.assign({ debtorName: n, zip: '06771', address: '서울 서초구 매헌로 16, 1312호', dlvAddress: '서울 송파구 법원로 96, 806호' }, extra || {});

test('① 안내문에 회사명이 들어가고, 이름 속 태그는 글자로 나온다', () => {
  const h = L.buildLetter(co('주식회사 <b>가나</b> & 다'));
  assert.match(h, /주식회사 &lt;b&gt;가나&lt;\/b&gt; &amp; 다 대표이사님 귀하/);
  assert.ok(!/<b>가나<\/b>/.test(h), '회사명이 태그로 해석되면 안 된다');
});

test('② 핵심 두 가지 — 대지급금 1개월, 회사 부담 12만원(+부가가치세) · 비용 근거와 «공고에 따른다» 단서', () => {
  const h = L.buildLetter(co('주식회사 가나'));
  assert.match(h, /간이대지급금·대지급금/); assert.match(h, /빠르면 1개월 내/);
  assert.match(h, /회사는 12만원\(\+부가가치세\)만 부담/);
  assert.match(h, /정부 지원 90% · 기업 자부담 10% \+ 부가가치세/);
  assert.match(h, /120만원 → 기업 자부담 12만원 \+ 부가가치세 12만원/);
  assert.match(h, /해당 연도 공고에 따라 달라질 수 있어/);
  assert.match(h, /2024년 혁신바우처 지원계획 공고/);
});

test('②-2 사무소 네 곳 주소, 전화는 천안·서산만', () => {
  const h = L.buildLetter(co('주식회사 가나'));
  ['천안본사', '서산지사', '세종지사', '대전지사'].forEach(n => assert.match(h, new RegExp(n)));
  assert.match(h, /041-556-0035/); assert.match(h, /041-429-0123/);
  assert.ok(!/042-488-5211/.test(h), '대전 전화번호는 싣지 않는다');
  assert.match(h, /둔산서로 79/); assert.match(h, /한누리대로 312/);
  assert.equal(L.OFFICES.filter(o => o.tel).length, 2);
});

test('③ 이메일·문자 안내가 아니라 우편이다 — 수신거부 한 줄이 있다', () => {
  const h = L.buildLetter(co('주식회사 가나'));
  assert.match(h, /원하지 않으시면 알려 주십시오 — 다시 보내지 않겠습니다/);
  assert.match(h, /1회 안내/);
});

test('④ 초안 표시는 draft 일 때만 붙는다', () => {
  assert.ok(!/초안/.test(L.buildLetter(co('가'))));
  assert.match(L.buildLetter(co('가'), { draft: true }), /초안 — 담당 노무사 최종 검토 필요/);
});

test('⑤ 라벨은 «본점 주소»로 만들고 16칸마다 쪽을 나눈다', () => {
  const l = L.buildLabel(co('주식회사 가나'));
  assert.match(l, /서울 서초구 매헌로 16/);
  assert.ok(!/법원로 96/.test(l), '송달주소(대리인 사무실)로 만들면 우편이 엉뚱한 곳으로 간다');
  assert.match(l, /주식회사 가나 귀중/);
  const sheets = L.buildLabelSheets(Array.from({ length: 33 }, (_, i) => co('회사' + i)));
  assert.equal((sheets.match(/class="sheet"/g) || []).length, 3, '33칸 = 16 + 16 + 1');
});

test('⑥ 문서 한 통 — 안내문은 회사마다 한 쪽, 인쇄 창을 부른다', () => {
  const d = L.buildDocument([co('가'), co('나')], 'both');
  assert.equal((d.match(/class="letter"/g) || []).length, 2);
  assert.equal((d.match(/class="sheet"/g) || []).length, 1);
  assert.match(d, /window\.print\(\)/);
  assert.match(d, /<title>안내문과 라벨 2곳<\/title>/);
  assert.ok(!/class="sheet"/.test(L.buildDocument([co('가')], 'letters')));
});

test('⑦ 메일 본문(글자 판) — 회사명·대표자·비용·수신거부, 거래 관계면 첫 인사가 다르다', () => {
  const p = L.buildPlainText(co('주식회사 가나'), { ceo: '홍길동' });
  assert.match(p, /^주식회사 가나 홍길동 대표이사님께/);
  assert.match(p, /회사는 12만원\(\+부가가치세\)만 부담/);
  assert.match(p, /빠르면 1개월 내/);
  assert.match(p, /120만원 → 기업 자부담 12만원 \+ 부가가치세 12만원/);
  assert.match(p, /원하지 않으시면 알려 주십시오 — 다시 보내지 않겠습니다/);
  assert.ok(!/평소 .*거래해 주셔서/.test(p));
  assert.match(L.buildPlainText(co('주식회사 가나'), { existing: true }), /평소 푸른노무법인과 거래해 주셔서 감사드립니다/);
  assert.ok(!/<[a-z]+/.test(p), '글자 판에 태그가 섞이면 안 된다');
  assert.match(L.MAIL_SUBJECT, /회생절차 중 근로자 임금\(대지급금\) 및 노무 상담 안내/);
});

test('⑧ 화면 안 미리보기는 인쇄 창을 부르지 않는다(noPrint)', () => {
  const d = L.buildDocument([co('가')], 'letters', { noPrint: true });
  assert.ok(!/window\.print/.test(d));
  assert.match(d, /class="letter"/);
});
test('⑨ 대표자 이름을 알면 안내문·라벨에 넣는다', () => {
  assert.match(L.buildLetter(co('주식회사 가나', { ceoName: '홍길동' })), /주식회사 가나 홍길동 대표이사님 귀하/);
  assert.match(L.buildLabel(co('주식회사 가나', { ceoName: '홍길동' })), /대표이사 홍길동 님 앞/);
  assert.match(L.buildLabel(co('주식회사 가나')), /대표이사님 앞/);
});

test('⑩ 메일 쓰기 창에 주소줄로 넣는 본문은 짧다 — 인코딩해도 7000자 안', () => {
  const body = L.buildMailBody(co('주식회사 아주아주긴회사이름이름이름 가나다'), { ceo: '홍길동', existing: true });
  const url = 'pu-cards.html?view=mail&to=' + encodeURIComponent('someone@company.co.kr') + '&name=' + encodeURIComponent('주식회사 아주아주긴회사이름이름이름 가나다') +
    '&subject=' + encodeURIComponent(L.MAIL_SUBJECT) + '&body=' + encodeURIComponent(body);
  assert.ok(url.length < 7000, '주소줄이 너무 길다: ' + url.length);
  assert.match(body, /평소 거래해 주셔서/);
  assert.match(body, /원하지 않으시면 알려 주십시오/);
});