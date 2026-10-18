/* 경력관리 — 폰화면관리 (대표 지시 2026-10-18 「폰화면관리」)

   360·411px 폰으로 «로그인한 채» 그려 본 것(tools/phone-audit, 지어낸 자료)에서 나온 셋:
     ① 목록 카드에 ☐ 와 번호가 «없었다» — 폰 구간이 번호 칸(td.rownum)을 통째로 접어서,
        폰에서는 줄을 고를 길(골라서 복사·선택 삭제)이 아예 없었다.
        → 대표 지시 2026-10-05 「모든 프로그램에 가장 왼쪽에 ㅁ 표시와 넘버링」 — 폰에서도 빼지 않는다.
     ② 머리줄의 🚪 로그아웃이 화면 밖(360px 에서 364~400px)으로 밀렸다 — 머리줄 칸이 하나도 안 줄어서.
     ③ 프로필 1장 — 설정 칸 500px 고정 때문에 폰에서 옆으로 밀리고 A4 그림 칸은 폭 0 이었다.

   지키는 규칙(값이 아니라 뜻):
     · ☐ № 는 폰 카드에서도 보이고, 카드 «첫 줄»(ID·번호와 같은 줄)에 선다 — 카드가 길어지지 않는다
     · 첫 줄의 값이 아래 줄 값들과 세로로 맞는다 — 이름표 칸 폭 = 격자 첫 칸 폭
     · 폰 ☐ 는 PC ☐ 보다 크다(손가락)
     · 머리줄에서 «로그인한 사람» 글만 줄어든다 — 단추는 그대로
     · 프로필 1장은 폰에서 한 줄로 쌓인다(인라인 500px 를 이긴다)
     · 모두 폰 구간(@media max-width:520px) 안에만 있다 — PC 는 그대로
   실행: node --test tests/career-phone-select.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const kc = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const css = kc.slice(0, kc.indexOf('</style>'));

/* @media(max-width:Npx){ … } 덩이를 다 모은다 — N 이 폰 폭(≤520)인 것과 아닌 것을 가른다 */
function 미디어덩이() {
  const out = [];
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let d = 0, i = css.indexOf('{', m.index);
    const s = i;
    for (; i < css.length; i++) {
      if (css[i] === '{') d++;
      else if (css[i] === '}' && --d === 0) break;
    }
    out.push({ w: Number(m[1]), body: css.slice(s + 1, i), from: m.index, to: i + 1 });
  }
  return out;
}
const 덩이 = 미디어덩이();
const 폰 = 덩이.filter(b => b.w <= 520).map(b => b.body).join('\n');
/* 어떤 @media 에도 안 든 «바탕» CSS — PC 가 보는 것 */
const 바탕 = (() => {
  let s = '', at = 0;
  덩이.forEach(b => { if (b.from >= at) { s += css.slice(at, b.from); at = b.to; } });
  return s + css.slice(at);
})();
/* 그 선택자 «하나만» 쓴 규칙의 몸 — 같은 선택자 규칙이 여럿이면 이어 붙인다(뒤의 것이 이긴다) */
function 규칙(덩어리, 선택자) {
  const esc = 선택자.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ms = [...덩어리.matchAll(new RegExp('(?:^|[\\s}])' + esc + '\\{([^}]*)\\}', 'g'))];
  return ms.length ? ms.map(m => m[1]).join(';') : null;
}
const px = (s, k) => { const m = (s || '').match(new RegExp('(?:^|;)\\s*' + k + ':\\s*([\\d.]+)px')); return m ? Number(m[1]) : null; };

test('① 폰 카드에서도 ☐ 와 번호가 보인다 — 번호 칸을 접지 않는다', () => {
  assert.ok(폰.length > 500, '폰 구간을 못 찾았습니다');
  assert.doesNotMatch(폰, /td\.rownum[^{}]*\{[^}]*display:\s*none/,
    '★ 폰에서 번호 칸(☐ + №)을 접었습니다 — 폰에서는 줄을 고를 길이 없어집니다 (대표 지시 2026-10-05)');
  /* 그 칸이 실제로 ☐ 를 품고 그려지는가 — 목록 화면 전부가 한 곳(renderCareer)에서 만든다 */
  assert.match(kc, /<td class="rownum"><label class="rn-chk"><input type="checkbox" class="row-chk"/,
    '목록 줄의 번호 칸에 ☐ 가 없습니다');
});

test('① ☐ № 는 카드 «첫 줄»에, 바로 뒤 칸(ID·번호)과 같은 줄에 선다 — 카드가 길어지지 않는다', () => {
  const rn = 규칙(폰, '.dt td.rownum');
  assert.ok(rn, '폰 구간에 번호 칸 자리 규칙이 없습니다');
  assert.match(rn, /grid-row:\s*1(?![\d/])/, '번호 칸이 첫 줄에 서지 않습니다');
  const 뒤 = 규칙(폰, '.dt td.rownum + td');
  assert.ok(뒤, '번호 칸 뒤 칸(ID·번호)의 자리 규칙이 없습니다');
  assert.match(뒤, /grid-row:\s*1(?![\d/])/, '★ ID·번호가 ☐ № 와 다른 줄로 내려가 카드가 한 줄 길어집니다');
  /* 둘이 «같은 칸»에 겹치지 않는다 */
  const c1 = (rn.match(/grid-column:\s*([^;]+)/) || [])[1];
  const c2 = (뒤.match(/grid-column:\s*([^;]+)/) || [])[1];
  assert.ok(c1 && c2 && c1.trim() !== c2.trim(), '☐ № 와 ID 가 같은 칸에 겹쳐 그려집니다');
});

test('① 첫 줄 값이 아래 줄 값들과 세로로 맞는다 — 격자 첫 칸 = 이름표 폭', () => {
  const 판 = ((폰.match(/\.dt tr\{display:grid!important;grid-template-columns:([^;]*);/) || [])[1] || '').trim();
  assert.ok(판, '카드 격자 규칙이 없습니다');
  const 첫칸 = Number((판.match(/^([\d.]+)px/) || [])[1]);
  const 이름표 = Number((폰.match(/\.dt td::before\{[^}]*flex:0 0 ([\d.]+)px/) || [])[1]);
  assert.ok(첫칸 && 이름표, '격자 첫 칸이나 이름표 폭을 못 읽었습니다');
  assert.equal(첫칸, 이름표, '★ 격자 첫 칸과 이름표 폭이 다르면 첫 줄 값(ID)이 아래 값들과 어긋납니다');
  /* 보통 줄은 이름표 칸 + 값 칸을 가로지른다 */
  assert.match(규칙(폰, '.dt td') || '', /grid-column:\s*1\s*\/\s*3/, '보통 줄이 이름표·값 두 칸을 가로지르지 않습니다');
});

test('① 폰 ☐ 는 PC ☐ 보다 크다 — 손가락으로 누른다', () => {
  const 폰칸 = 규칙(폰, '.dt td.rownum input[type=checkbox]');
  const pc칸 = 규칙(바탕, '.rownum input[type=checkbox],.rownum-h input[type=checkbox]');
  assert.ok(폰칸 && pc칸, '☐ 크기 규칙을 못 찾았습니다');
  assert.ok(px(폰칸, 'width') > px(pc칸, 'width') && px(폰칸, 'height') > px(pc칸, 'height'),
    '★ 폰 ☐ 가 PC 와 같거나 작습니다 — 폰에서는 손가락으로 눌러야 합니다');
  assert.ok(Math.max(px(폰칸, 'width'), px(폰칸, 'height')) >= 20, '★ 폰 ☐ 가 손가락으로 누르기에 너무 작습니다');
});

test('② 머리줄 — «로그인한 사람» 글만 줄어 🚪 로그아웃이 화면 안에 남는다', () => {
  /* 바탕은 «아무 칸도 안 줄어든다»(.topbar>*{flex-shrink:0}) — 그래서 긴 화면 이름이면 끝 단추가 밀린다 */
  assert.match(바탕, /\.topbar>\*\{[^}]*flex-shrink:0/, '머리줄 바탕 규칙이 바뀌었습니다 — 이 검사를 다시 보십시오');
  const who = 규칙(폰, '.topbar>.kc-who') || 규칙(폰, '.topbar > .kc-who');
  assert.ok(who, '★ 폰에서 «로그인한 사람» 글이 줄어들 규칙이 없습니다 — 🚪 가 화면 밖으로 밀립니다');
  assert.match(who, /flex-shrink:\s*[1-9]/);
  assert.match(who, /min-width:\s*0/, 'min-width:0 이 없으면 글이 줄지 않습니다(글 길이가 최소 폭이 된다)');
  /* 단추를 줄이거나 감추지 않는다 */
  assert.doesNotMatch(폰, /#fbLogoutBtn[^{}]*\{[^}]*display:\s*none/, '★ 로그아웃 단추를 감췄습니다');
});

test('③ 프로필 1장 — 폰에서는 설정·그림을 한 줄로 쌓는다(인라인 고정 폭을 이긴다)', () => {
  /* PC 는 두 칸이다(인라인 style) — 이 검사는 «두 칸이 있다»만 본다(폭 값은 안 박는다) */
  const 인라인 = (kc.match(/<div class="p1-wrap" style="[^"]*grid-template-columns:([^;"]+)/) || [])[1] || '';
  assert.ok(인라인.trim().split(/\s+(?![^(]*\))/).length >= 2, 'PC 프로필 1장이 두 칸이 아닙니다');
  const w = 규칙(폰, '.p1-wrap');
  assert.ok(w, '★ 폰에서 프로필 1장을 쌓는 규칙이 없습니다 — 그림 칸이 폭 0 이 됩니다');
  const 폰판 = (w.match(/grid-template-columns:\s*([^;!]+)!important/) || [])[1];
  assert.ok(폰판, '인라인 style 을 이기려면 !important 여야 합니다');
  assert.equal(폰판.trim().split(/\s+(?![^(]*\))/).length, 1, '★ 폰에서 칸이 둘 이상입니다');
  assert.doesNotMatch(폰판, /^\s*\d+px/, '폰 한 칸이 고정 폭이면 다시 옆으로 밀립니다');
  /* 쌓인 설정 칸은 붙지도, 제 안에서 구르지도 않는다 */
  const side = 규칙(폰, '#p1Side') || '';
  assert.match(side, /position:\s*static!important/);
  assert.match(side, /max-height:\s*none!important/);
});

test('폰 규칙은 폰 구간 안에만 — PC 는 그대로다', () => {
  assert.equal(규칙(바탕, '.topbar>.kc-who'), null, '«로그인한 사람» 줄이기가 폰 밖으로 샜습니다');
  assert.equal(규칙(바탕, '.dt td.rownum + td'), null, '카드 첫 줄 규칙이 폰 밖으로 샜습니다');
  assert.ok(!/\.p1-wrap\{[^}]*!important/.test(바탕), '프로필 1장 쌓기가 폰 밖으로 샜습니다');
  /* 목록 툴바 틀고정(2026-08-29)은 그대로다 — 폰에서 풀지는 대표가 정한다 */
  assert.match(바탕, /\.page-view\.active \.toolbar\{position:sticky/);
});
