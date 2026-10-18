'use strict';
/* 경력관리 — 폰에서 본문(main)이 옆으로 구르지 않는다 (폰화면관리 2026-10-18 전수점검)

   ★ 무엇이 있었나 (360px, 가짜 자료로 실측)
     · 환경설정 › 개인정보보관: 입력칸이 화면 오른쪽 밖으로 130px — 본문이 490px 로 늘었다.
       `.pi-two{grid-template-columns:1fr}` 의 1fr 은 «내용보다 작아지지 않는» 칸이라 안쪽의 가장 넓은 것만큼 늘었다.
     · 서류 만들기: 탭 줄이 줄어들지 않게(flex:none) 박혀 「PDF 편집」 탭이 29px 밀고 본문을 굴렸다.
   ★ 지키는 것 — 지금 px 값이 아니라 «폰 구간에서 그 칸들이 0 까지 줄 수 있는가»다.
   실행: node --test tests/career-phone-main-fit.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8').replace(/\r\n/g, '\n');
const css = src.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 폰 구간(max-width ≤ 760px)의 몸통들을 모은다 */
function 폰몸통() {
  const out = [];
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    if (Number(m[1]) > 760) continue;
    let i = m.index + m[0].length, d = 1; const s = i;
    while (i < css.length && d > 0) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; }
    out.push(css.slice(s, i - 1));
  }
  return out.join('\n');
}
const 폰 = 폰몸통();

test('개인정보보관 두 칸 판은 폰에서 «0 까지 줄 수 있는» 한 칸이다', () => {
  assert.match(폰, /\.pi-two\s*\{[^}]*grid-template-columns\s*:\s*minmax\(\s*0\s*,\s*1fr\s*\)/,
    '1fr 만 쓰면 안쪽의 가장 넓은 것만큼 칸이 늘어 본문이 옆으로 구릅니다');
  assert.match(폰, /\.field-grid\s*\{[^}]*grid-template-columns\s*:\s*minmax\(\s*0\s*,\s*1fr\s*\)/,
    '입력칸 격자도 0 까지 줄 수 있어야 합니다');
  assert.match(폰, /\.pi-two\s*>\s*\*[^{]*\{[^}]*min-width\s*:\s*0/, '판의 칸들이 제 내용 폭을 고집하지 않아야 합니다');
});

test('서류 만들기 탭 줄은 폰에서 줄어든다 — 넘치면 제 안에서 민다', () => {
  assert.match(폰, /#rh-tabrow\s*\{[^}]*flex\s*:\s*0 1 auto[^}]*min-width\s*:\s*0/,
    '탭 줄이 줄어들지 않으면 탭 하나가 본문을 옆으로 밉니다');
  /* 줄어든 탭 줄이 «옆으로 밀 수 있어야» 숨은 탭을 누를 수 있다 */
  assert.match(css, /\.tabrow\s*\{[^}]*overflow-x\s*:\s*auto/, '탭 줄이 옆으로 밀리지 않으면 줄어든 만큼 탭이 사라집니다');
});
