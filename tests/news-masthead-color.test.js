'use strict';
/* 편지 머리(제호)에 색 (대표 결정 2026-10-10 B안
   「캡쳐2 부분 너무 아무런 색이 없어서 약간 허전해 보인다」 → B)

   ■ 이 검사가 지키는 «규칙» — 빛깔 값은 박지 않는다(팔레트를 손봐도 안 깨지게)
     ① 제호에 흰색이 아닌 바탕이 깔린다 · bgcolor 와 background-color 를 둘 다 건다(아웃룩)
     ② 차림표 띠는 어두운 바탕 · 칸 글자는 그 위에서 «읽힌다»(밝기 차이를 잰다)
     ③ 웹 전문 보기에서 누르고 고른 칸도 글자가 읽힌다 — 밝은 바탕을 깔면 흰 글자가 사라진다
     ④ 요약판(메일)에도 제호 바탕은 깔린다 — 차림표가 없는 쪽이다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');
const { stripJs } = require('./strip-comments.js');

const 설 = { 회사이름: '푸른노무법인' };
const 기사 = { 갈래: '기사', 제목: '기사 제목', 우리말: '우리가 쓴 줄입니다.',
  언론사: '매일노동뉴스', 링크: 'https://www.labortoday.co.kr/news/articleView.html?idxno=1' };
const 판례 = { 갈래: '판례', 딱지: '[판례]', 제목: '판례 제목',
  링크: 'https://www.law.go.kr/LSW/precInfoP.do?target=prec&ID=622111' };
const 편지 = (요약) => T.편지짓기({ 회차: C.회차('2026-10-05'),
  안: { news: [기사], policy: [], case: [판례], hr: [], special: [판례] }, 우리글: '' }, 설,
  { 미리보기: true, 요약: 요약 }).서식;

/* 밝기 (0 어둠 ~ 1 밝음) — WCAG 상대 휘도 */
function 밝기(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  assert.ok(m, '빛깔을 못 읽었다: ' + hex);
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
const 대비 = (a, b) => { const x = 밝기(a), y = 밝기(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* 제호 표 — PUREUN LABOR LAW FIRM 바로 앞의 표 머리 */
function 제호표(h) {
  const i = h.indexOf('PUREUN LABOR LAW FIRM');
  const j = h.lastIndexOf('<table', i);
  return h.slice(j, h.indexOf('>', j) + 1);
}

test('① 제호에 흰색이 아닌 바탕 — bgcolor·background-color 둘 다', () => {
  const 머 = 제호표(편지(false));
  const 가 = /bgcolor="(#[0-9a-f]{6})"/i.exec(머);
  const 나 = /background-color:(#[0-9a-f]{6})/i.exec(머);
  assert.ok(가 && 나, '제호 바탕이 없다(아웃룩은 bgcolor 만 본다) — ' + 머);
  assert.strictEqual(가[1].toLowerCase(), 나[1].toLowerCase(), '두 바탕이 다르다');
  assert.notStrictEqual(가[1].toLowerCase(), '#ffffff', '제호가 다시 흰 바탕이다 — 허전하다던 그것');
  assert.ok(밝기(가[1]) > 0.7, '제호 바탕이 너무 어둡다 — 짙은 이름 글자가 묻힌다');
});

test('② 차림표 띠 — 어두운 바탕, 칸 글자는 그 위에서 읽힌다', () => {
  const h = 편지(false);
  const 띠 = /<tr data-stick="1">([\s\S]*?)<\/tr><\/table>/.exec(h);
  assert.ok(띠, '차림표 띠를 못 찾았다');
  const 바 = /bgcolor="(#[0-9a-f]{6})"/i.exec(띠[1]);
  assert.ok(바, '차림표 띠에 바탕이 없다');
  assert.ok(밝기(바[1]) < 0.2, '차림표 띠가 어둡지 않다');
  const 칸들 = 띠[1].match(/<td align="center"[^>]*>/g) || [];
  assert.ok(칸들.length >= 2, '차림표 칸을 못 찾았다');
  칸들.forEach((t) => {
    const 글 = /;color:(#[0-9a-f]{6})/i.exec(t);
    assert.ok(글, '칸 글자색이 없다: ' + t);
    assert.ok(대비(글[1], 바[1]) >= 4.5, '차림표 글자가 띠 위에서 안 읽힌다(' + 글[1] + ' / ' + 바[1] + ')');
  });
});

test('③ 웹 전문 보기 — 누름·고름 칸도 흰 글자가 읽힌다', () => {
  const 뷰 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'news-view.js'), 'utf8'));
  ['td.nav:hover', 'td.nav.on'].forEach((k) => {
    const i = 뷰.indexOf("#wrap [data-stick] " + k + '{');
    assert.ok(i > 0, k + ' 서식이 없다');
    const 몸 = 뷰.slice(i, 뷰.indexOf('}', i));
    const 글 = /color:(#[0-9a-f]{6})/i.exec(몸), 바 = /background:(#[0-9a-f]{6})/i.exec(몸);
    assert.ok(글 && 바, k + ' 에 글자색·바탕이 둘 다 있어야 한다');
    assert.ok(대비(글[1], 바[1]) >= 4.5, k + ' 에서 글자가 안 읽힌다');
  });
});

test('④ 요약판(메일)에도 제호 바탕', () => {
  assert.match(제호표(편지(true)), /bgcolor="#(?!ffffff)[0-9a-f]{6}"/i);
});
