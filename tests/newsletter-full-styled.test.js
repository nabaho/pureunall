'use strict';
/* 판례·행정해석 「전문 보기」— 클릭이 «어떻게 됐든» 법제처 원본이 아니라 «우리 양식»으로
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20:
     「판례등 전문보기는 판례정보를 그대로 넣지말고 푸른양식으로 정리해라」
   (직접 눌러 보시고 법제처 원본 쪽(law.go.kr)으로 새 탭이 넘어간 뒤 하신 말씀)

   ★ 자바스크립트로 「그 자리에서 편다」(2026-09-18)는 이미 있었다 — 정상 클릭이면
     지금도 편지 안에서 펴진다. ⚠⚠ 그런데 그 손잡이의 «href 자체»가 여전히
     law.go.kr 원문이었다 — 가운데 클릭·Ctrl+클릭·마우스 오른쪽 「새 탭에서 열기」
     처럼 클릭 손잡이(click)를 «거치지 않는» 열기는 그대로 법제처로 간다.
     대표께서 실제로 그렇게 열어 보시고 겪으신 것이 이것이다.

   ★ 그래서 손잡이 자체(href)를 «우리 쪽»(functions/newsFullPage)으로 바꾼다.
     ① 정상 클릭 — 그대로 그 자리에서 편다(안 바뀜, data-full 을 그대로 본다)
     ② 그 밖의 모든 열기 — 이제 «우리 서버가 우리 양식으로 그린 쪽»이 열린다.
        law.go.kr 은 그 쪽 «맨 아래» 「법제처에서 원문 보기」로만 남는다.
     ③ 추적밑주소가 없으면(옛 설정) «예전처럼» — 나빠지지 않는다.

   ⚠ 여기서 못 박는 것은 «값»이 아니라 «규칙»이다. */

const test = require('node:test');
const assert = require('node:assert');

const NF = require('../functions/news-full.js');
const Core = require('../js/pu-news-core.js');
const Tpl = require('../js/pu-news-tpl.js');

/* ══════════════════════════════════════════════════════════════════════════
   ① 편지 쪽 — 손잡이(href)가 «우리 서버」를 가리킨다
   ══════════════════════════════════════════════════════════════════════════ */

function 판례편지(링크, 설) {
  const d = { 열쇠: '2026-09-w2', 상태: '초안', 범위: '자문중', 회차: Core.회차('2026-09-10'),
    우리글: '', 지역뉴스: [], 안: { news: [], policy: [], hr: [],
      case: [{ 갈래: '판례', 딱지: '[판례]', 제목: '판례 하나', 우리말: '우리 정리',
        인용: '대법원 2026다1', 링크: 링크 }] } };
  return Tpl.편지짓기(d, Object.assign({ 회사이름: '푸른노무법인' }, 설 || {}),
    { 요약: false, 미리보기: true, 넓이: Tpl.전문넓이 }).서식;
}

const 밑주소 = 'https://asia-northeast3-pureun-erp.cloudfunctions.net';
const 법제처링크 = 'https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111';

test('★★★ 추적밑주소가 있으면 손잡이가 «우리 쪽»(newsFullPage)을 가리킨다', () => {
  /* ⚠⚠ 이것이 이번 지시의 핵심이다 — 클릭이 어떤 방식으로 열리든(새 탭·Ctrl+클릭 포함)
       법제처가 아니라 우리 쪽이 열려야 한다. 그러려면 «href 자체»가 우리 주소여야 한다.
       data-full 만 있고 href 가 그대로 법제처면, 인터셉트를 벗어나는 모든 열기가
       여전히 법제처로 간다 — 실제로 그렇게 겪으셨다. */
  const h = 판례편지(법제처링크, { 추적밑주소: 밑주소 });
  const m = /<a href="([^"]+)"[^>]*data-full="prec:622111"/.exec(h);
  assert.ok(m, '★★★ data-full 이 달린 손잡이를 못 찾았다');
  /* ⚠ href 속성 «안»이라 &amp; 로 씻겨 있다 — 그게 맞다(HTML 속성값 규칙). */
  const 실제주소 = m[1].replace(/&amp;/g, '&');
  assert.ok(실제주소.indexOf(밑주소) === 0,
    '★★★ 손잡이가 우리 서버를 안 가리킨다 — 여전히 ' + 실제주소);
  assert.match(실제주소, /\/newsFullPage\?t=prec&id=622111/,
    '★★★ 우리 쪽 주소 모양이 아니다: ' + 실제주소);
  assert.ok(h.indexOf('href="' + 법제처링크) < 0,
    '★★★ 손잡이가 여전히 법제처 원문 그대로다 — 새 탭으로 열면 그리로 간다');
});

test('★★ 행정해석(expc)도 같은 규칙이다', () => {
  const 링크 = 'https://www.law.go.kr/DRF/lawService.do?OC=test&target=expc&type=HTML&ID=340383';
  const h = 판례편지(링크, { 추적밑주소: 밑주소 });
  assert.match(h, new RegExp('href="' + 밑주소.replace(/[.]/g, '\\.')
    + '/newsFullPage\\?t=expc&amp;id=340383"[^>]*data-full="expc:340383"'));
});

test('★ 추적밑주소가 없으면 «예전처럼» 법제처 원문이다 — 나빠지지 않는다', () => {
  /* ⚠ 밑주소를 아직 안 넣은 설정(옛 설정)에서는 우리 쪽 주소를 지을 수 없다.
       그때는 손잡이가 그대로 법제처다 — data-full 이 있으니 정상 클릭은 여전히
       그 자리에서 펴진다. */
  const h = 판례편지(법제처링크);
  assert.match(h, /<a href="https:\/\/www\.law\.go\.kr[^"]*"[^>]*data-full="prec:622111"/,
    '★ 밑주소가 없는데도 손잡이가 바뀌었다');
});

test('★ 법제처가 아닌 링크는 그대로다 — 우리 쪽 주소를 지어내지 않는다', () => {
  const h = 판례편지('https://www.scourt.go.kr/x?ID=1', { 추적밑주소: 밑주소 });
  assert.ok(h.indexOf('newsFullPage') < 0,
    '★ 법제처가 아닌 주소에도 우리 쪽 링크를 지었다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ② 서버 쪽 — «우리 양식»으로 정리해서 편다 (판례정보를 그대로 넣지 않는다)
   ══════════════════════════════════════════════════════════════════════════ */

test('★★★ 서버에 «쪽을 짓는» 자리가 있다', () => {
  assert.equal(typeof NF.쪽, 'function', '★★★ NF.쪽 이 없다 — 우리 양식으로 지을 곳이 없다');
  assert.equal(typeof NF.오류쪽, 'function', '★★ NF.오류쪽 이 없다 — 못 받아 온 때를 못 다룬다');
});

const 판례것 = {
  ok: true, 갈래: 'prec', 제목: '단체교섭청구의소', 인용: '대법원 2018다296229 (2026. 5. 21.)',
  칸들: [
    { 이름: '판시사항', 글: '사용자의 범위가 유지되는지 여부(적극)', 잘림: false },
    { 이름: '판결요지', 글: '[다수의견] <script>alert(1)</script> 종전 법리가 유지되어야 한다.', 잘림: false }
  ],
  잘림: false
};
const 법제처주소 = 'https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111';

test('★★★ 쪽이 «판시사항·인용·제목»을 담는다 — 값을 지어내지 않는다', () => {
  const 쪽 = NF.쪽(판례것, 법제처주소);
  assert.ok(쪽.indexOf('단체교섭청구의소') >= 0, '제목이 없다');
  assert.ok(쪽.indexOf('대법원 2018다296229') >= 0, '인용이 없다');
  assert.ok(쪽.indexOf('사용자의 범위가 유지되는지') >= 0, '판시사항이 없다');
});

test('★★★ 판례정보를 «그대로 넣지 않는다» — 남의 태그를 그대로 심지 않는다', () => {
  /* ⚠⚠ 법제처 XML 안에 <script> 가 실려 와도(실제로 이런 사고가 난 적이 이 코드베이스에
       있다 — 태그가 글자로 남아야 한다) 그대로 심으면 우리 쪽에서 스크립트가 돈다.
       «그대로 넣지 말라»는 지시에는 이 뜻도 있다 — 날것을 다듬어서 낸다. */
  const 쪽 = NF.쪽(판례것, 법제처주소);
  assert.ok(쪽.indexOf('<script>alert(1)</script>') < 0,
    '★★★ 남의 글에 든 태그가 그대로 심어졌다 — 화면에서 돈다');
  assert.ok(쪽.indexOf('&lt;script&gt;') >= 0, '글자로 씻지도 않았다');
});

test('★★ 우리 «양식»을 쓴다 — 법제처의 파란 정부 사이트 모양이 아니다', () => {
  /* 값이 아니라 «우리 색·마크가 있는가»를 본다. 법제처가 색을 바꿔도 이 검사는 옳다. */
  const 쪽 = NF.쪽(판례것, 법제처주소);
  assert.match(쪽, /PUREUN|푸른노무법인/, '★★ 우리 이름·마크가 안 보인다');
  assert.match(쪽, /#6f5a48|#241a13/, '★★ 우리 색(편지와 같은 갈색)을 안 쓴다');
});

test('★ 법제처 원문은 «맨 아래 한 줄»로만 남는다 — 숨기지 않는다', () => {
  /* ⚠ 없애는 게 아니다. 우리 양식이 «먼저」고, 원할 때 원본도 볼 수 있어야 한다.
     ⚠ href 속성 안이라 &amp; 로 씻겨 있다 — 그대로 찾으면 & 에서 끊긴다. */
  const 쪽 = NF.쪽(판례것, 법제처주소);
  assert.ok(쪽.indexOf(법제처주소.replace(/&/g, '&amp;')) >= 0,
    '★ 법제처 원문으로 가는 길이 아예 없다');
  assert.match(쪽, /법제처에서.*원문|원문.*법제처/, '무엇으로 가는 링크인지 안 밝힌다');
});

test('★ 못 받아 온 때도 «우리 양식» 오류 쪽을 낸다 — 법제처 빈 화면이 아니다', () => {
  const 쪽 = NF.오류쪽('지금 법제처에서 받아 오지 못했습니다.', 법제처주소);
  assert.ok(쪽.indexOf('지금 법제처에서 받아 오지 못했습니다') >= 0, '까닭 말이 없다');
  assert.ok(쪽.indexOf(법제처주소.replace(/&/g, '&amp;')) >= 0, '물러설 길(법제처 원문)이 없다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ③ 서버 문 — newsFull 과 «같은 문지기»를 쓴다 (SSRF·회원 자료 안 읽기)
   ══════════════════════════════════════════════════════════════════════════ */

const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments');
const ROOT = path.join(__dirname, '..');

test('★★★ newsFullPage 도 «우리 자료»를 하나도 안 읽는다', () => {
  const idx = stripJs(fs.readFileSync(path.join(ROOT, 'functions/index.js'), 'utf8'));
  const i = idx.indexOf('exports.newsFullPage');
  assert.ok(i > 0, '★★★ newsFullPage 를 내보내지 않는다');
  const 몫 = idx.slice(i, idx.indexOf('\nexports.', i + 10));
  ['getDatabase', 'newsletter/', '받는이'].forEach((말) => {
    assert.ok(몫.indexOf(말) < 0, 'newsFullPage 가 「' + 말 + '」 을 만진다');
  });
  assert.match(몫, /NF\.읽기\(req\.query\)/, '★★★ 물음을 안 걸러 받는다 — 갈래·번호가 새는 문');
  assert.match(몫, /max-age=86400/, '하루 안 굳힌다');
});
