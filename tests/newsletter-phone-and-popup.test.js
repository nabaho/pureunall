'use strict';
/* 폰에서 글자가 작지 않게 · 팝업에서 오른쪽이 안 잘리게 (대표 지시 2026-09-26)
   ═══════════════════════════════════════════════════════════════════════════
   「폰에서 글자가 작다. 그리고 팝업에는 오른쪽까지 확장해서 전체가 다 보이게 해라.」

   ■ 왜 생겼나
     편지를 700 → 980 으로 넓히면서 두 가지가 따라오지 못했다.
     ① 폰: 980px 고정 표라 폰 메일 앱이 통째로 «줄여» 보여 준다 — 글자가 38% 가 된다.
     ② 팝업: 미리보기 틀 폭이 700 에 굳어 있어 980 편지의 오른쪽이 잘렸다.
        ⚠ 2026-09-12 에도 같은 일이 있었다(680 → 780). 숫자를 두 곳에 적으면 되풀이된다.

   ■ 이 검사가 지키는 것
     ㉠ 편지에 «화면 크기별 규칙»이 실린다 — 폰에서 줄이지 않고 칸을 쌓는다
     ㉡★ 그 규칙이 «발송기를 지나도» 살아남는다 (지워지면 폰은 예전 그대로다)
     ㉢★ 남의 <style> 은 여전히 «하나도» 안 통과한다 — 문을 넓힌 것이 아니다
     ㉣ CSS 가 «글자로» 새지 않는다 — 편지 맨 위에 @media 가 보이면 안 된다
     ㉤ 데스크톱은 한 글자도 안 바뀐다 — @media 는 아웃룩이 모른다
     ㉥ 미리보기 틀 폭을 «편지에서 읽는다» — 숫자를 두 곳에 적지 않는다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 주석걷기 } = require('./helpers/strip-comments.js');

const 뿌리 = path.join(__dirname, '..');
const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');
const MS = require('../functions/mail-send.js');
const 화면 = 주석걷기(fs.readFileSync(path.join(뿌리, 'pu-news.html'), 'utf8'));

const 설 = { 회사이름: '푸른노무법인' };
const 거리 = () => ({
  회차: C.회차('2026-09-21'), 우리글: '한마디입니다.',
  안: {
    news: [1, 2, 3].map((n) => ({ 갈래: '기사', 한줄: 'ㄱ' + n, 우리말: '우리 글 ' + n,
      언론사: '매일노동뉴스' })),
    policy: [1, 2, 3, 4, 5, 6].map((n) => ({ 갈래: '자료', 제목: '자료 ' + n, 발행처: '고용노동부' })),
    case: [], hr: []
  }
});
const 메일 = () => T.편지짓기(거리(), 설, { 요약: false, 미리보기: true }).서식;
const 규칙뽑기 = (h) => (h.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];

/* ═══ ㉠ 화면 크기별 규칙이 실린다 ═══════════════════════════════════ */
test('★★★ 편지에 «화면 크기별 규칙»이 실린다 — 폰에서 줄여 보이지 않게', () => {
  const 규칙 = 규칙뽑기(메일());
  assert.ok(규칙, '★★★ @media 규칙이 없다 — 폰이 편지를 통째로 줄여 글자가 38% 가 된다');
  assert.match(규칙, /@media[^{]*max-width\s*:\s*\d{2,4}px/, '화면 폭을 보는 규칙이 아니다');
  assert.match(규칙, /\.pu-w\{[^}]*width\s*:\s*100%/, '폰에서 편지 폭을 100% 로 안 편다');
  assert.match(규칙, /\.pu-c\{[^}]*display\s*:\s*block/, '폰에서 칸을 안 쌓는다');
});

test('★★ 규칙이 붙잡을 «손잡이»가 편지에 있다 — 반 이름', () => {
  const h = 메일();
  assert.ok(/<table[^>]*class="pu-w"[^>]*width="980"/.test(h), '편지 표에 pu-w 가 없다');
  assert.ok((h.match(/class="pu-c[ "]/g) || []).length >= 6,
    '쌓을 칸(pu-c)이 모자라다 — 자료 카드·두 칸 표·차림표에 다 붙어야 한다');
  /* 두 칸 표는 «안쪽 여백»으로 칸을 벌린다 — 쌓이고 나면 그 여백을 지워야 줄이 맞는다 */
  assert.ok(h.indexOf('pu-c2') >= 0, '두 칸 표에 여백 지우는 반 이름이 없다');
  assert.match(규칙뽑기(h), /\.pu-c2\{[^}]*padding-left\s*:\s*0/, '쌓인 뒤 왼쪽 여백을 안 지운다');
});

/* ═══ ㉡ 발송기를 지나도 살아남는다 ═════════════════════════════════
   ⚠⚠ 여기가 핵심이다. 발송기가 <style> 을 통째로 버리면 폰은 예전 그대로다. */
test('★★★ 발송기를 지난 뒤에도 규칙이 «그대로» 있다', () => {
  const 씻긴 = MS.sanitizeHtml(메일());
  const 규칙 = 규칙뽑기(씻긴);
  assert.ok(규칙, '★★★ 발송기가 규칙을 통째로 버렸다 — 폰에서 글자가 그대로 작다');
  assert.match(규칙, /\.pu-w\{[^}]*width:100% !important/, '폭 규칙이 씻기며 사라졌다');
  assert.match(규칙, /\.pu-c\{[^}]*display:block !important/, '쌓기 규칙이 씻기며 사라졌다');
  /* 손잡이(반 이름)도 살아남아야 한다 — 규칙만 있고 손잡이가 없으면 아무 일도 안 한다 */
  assert.ok(씻긴.indexOf('class="pu-w"') >= 0, '발송기가 pu-w 를 지웠다');
  assert.ok(씻긴.indexOf('pu-c') >= 0, '발송기가 pu-c 를 지웠다');
});

/* ═══ ㉢ 문을 넓힌 것이 아니다 ═══════════════════════════════════════
   ⚠⚠ 「받은 것 그대로 전달」로 남의 편지 HTML 이 이 길로 들어온다. */
test('★★★ 남의 <style> 은 여전히 «하나도» 안 통과한다', () => {
  const 남 = '<style>body{display:none}.evil{color:red}'
    + '@media only screen and (max-width:640px){.evil{display:none}}'      /* 남의 반 이름 */
    + '@media print{.pu-w{display:none}}'                                  /* 인쇄 규칙 */
    + '@media only screen and (max-width:640px){.pu-w{background:url(https://evil.test/x.png)}}'
    + '</style><p class="evil pu-w">글</p>';
  const 씻 = MS.sanitizeHtml(남);
  assert.ok(씻.indexOf('<style>') < 0, '★★★ 남의 꾸밈이 통과했다');
  assert.ok(씻.indexOf('evil') < 0, '남의 반 이름이 남았다');
  assert.ok(씻.indexOf('evil.test') < 0, '★★★ 남의 서버 그림 주소가 남았다 — 열람이 샌다');
  assert.ok(씻.indexOf('글') >= 0, '글까지 버렸다');
});

test('★★ 우리 이름이라도 «@media 밖»이면 안 통과한다 — 데스크톱까지 덮는다', () => {
  const 밖 = '<style>.pu-w{display:none}</style><p>글</p>';
  assert.ok(MS.sanitizeHtml(밖).indexOf('<style>') < 0, '@media 밖 규칙이 통과했다');
  /* 안에 있어도 값이 허락한 것이 아니면 버린다 */
  const 나쁜값 = '<style>@media only screen and (max-width:640px){.pu-w{position:fixed}}</style>';
  assert.strictEqual(MS.안전한스타일(나쁜값), '', '허락하지 않은 꾸밈이 통과했다');
});

test('★★ 인쇄·장치 규칙은 안 받는다 — 화면 폭을 보는 것만', () => {
  ['@media print{.pu-w{display:none}}',
   '@media (min-width:640px){.pu-w{display:none}}',
   '@media screen{.pu-w{display:none}}'].forEach((s) => {
    assert.strictEqual(MS.안전한스타일('<style>' + s + '</style>'), '',
      '받으면 안 되는 규칙이 통과했다: ' + s);
  });
});

/* ═══ ㉣ CSS 가 글자로 새지 않는다 ══════════════════════════════════
   ⚠ 2026-09-26 에 실제로 그럴 뻔했다 — 꾸밈을 «태그 거르개 앞»에 붙였더니
     거르개가 <style> 태그만 지우고 속 CSS 를 글자로 남겼다. */
test('★★★ 씻은 편지에 CSS 가 «글자로» 남지 않는다', () => {
  const 씻긴 = MS.sanitizeHtml(메일());
  const 글만 = 씻긴.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  assert.ok(글만.indexOf('@media') < 0, '★★★ @media 가 글자로 편지에 보인다');
  assert.ok(글만.indexOf('!important') < 0, '★★★ CSS 가 글자로 편지에 보인다');
});

/* ═══ ㉤ 데스크톱은 안 바뀐다 ═══════════════════════════════════════ */
test('★★ 데스크톱 모습은 한 글자도 안 바뀐다 — @media 는 아웃룩이 모른다', () => {
  const h = 메일();
  assert.ok(/<table[^>]*width="980"[^>]*style="width:980px/.test(h), '편지 폭이 980 이 아니다');
  assert.ok(h.indexOf('width="33%"') >= 0, '자료가 세 칸이 아니다');
  /* 규칙은 «@media 안»에만 있어야 한다 — 밖에 한 줄이라도 있으면 데스크톱이 바뀐다 */
  const 규칙 = 규칙뽑기(h);
  assert.ok(/^@media[^{]*\{[\s\S]*\}$/.test(규칙.trim()), '@media 밖에 규칙이 있다');
});

/* ═══ ㉥ 팝업이 안 잘린다 ═══════════════════════════════════════════ */
test('★★★ 미리보기 틀 폭을 «편지에서 읽는다» — 숫자를 두 곳에 안 적는다', () => {
  const m = /const 편지폭 = ([^;]+);/.exec(화면);
  assert.ok(m, '편지폭 을 못 찾았다');
  assert.ok(/PuNewsTpl/.test(m[1]),
    '★★★ 편지폭에 숫자를 박아 뒀다 — 편지가 넓어지면 또 오른쪽이 잘린다 (지금: ' + m[1].trim() + ')');
});

test('★★★ 팝업 창이 편지(980)보다 넓다 — 오른쪽이 안 잘리게', () => {
  const m = /#big \.in\{[^}]*width:min\((\d+)px/.exec(화면);
  assert.ok(m, '팝업 창 폭을 못 찾았다');
  assert.ok(Number(m[1]) >= T.전문넓이 + 40,
    '★★★ 팝업이 ' + m[1] + 'px 인데 편지는 ' + T.전문넓이 + 'px 다 — 오른쪽이 잘린다');
});
