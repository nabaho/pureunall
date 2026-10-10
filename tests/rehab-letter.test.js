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

test('② 비용(자부담)을 안내한다 — 비율·부가가치세·예시·근거·«공고에 따른다» 단서', () => {
  const h = L.buildLetter(co('주식회사 가나'));
  assert.match(h, /정부 지원/); assert.match(h, /기업 자부담/);
  assert.match(h, /10% \+ 부가가치세/);
  assert.match(h, /120만원 → 기업 자부담 12만원 \+ 부가가치세 12만원/);
  assert.match(h, /해당 연도 공고에 따라 달라질 수 있어/);
  assert.match(h, /2024년 혁신바우처 지원계획 공고/);
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
