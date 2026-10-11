/* 폰에서 편하게 보이는가 (대표 지시 2026-09-12 「폰화면에서 편하게 보게 깔끔히 정리해라」)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 375px 짜리 화면에서 재 보고 고친 자리들이다. 값(px)이 아니라 «규칙»을 못 박는다.

   ■ 실측으로 드러난 것 (2026-09-12, 375×812)
     · 「이번 회차」 한 장이 2,058px — 단추 넷이 세 줄, 담는 법 다섯이 세 줄
     · 줄마다 ▲▼ 와 매체 이름이 가로를 먹어 제목이 «네 줄»로 쏟아졌다
     · 탭 다섯이 469px 라 오른쪽 둘(보낸 결과·설정)이 화면 밖에 있었다
     · 받는 명단 표가 회사 이름을 «한 글자씩 세로로» 쏟아 23,345px 가 되었다
     · 바둑판 칸이 안 줄어들어(min-width:auto) 칸이 665px 로 벌어졌다 —
       겉으로는 가로 스크롤도 안 생겨 「글이 짧아진 것」처럼 보였다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');
const { 함수몸 } = require('./helpers/strip-comments.js');

const ROOT = path.join(__dirname, '..');
const 원본 = fs.readFileSync(path.join(ROOT, 'pu-news.html'), 'utf8').replace(/\r\n/g, '\n');
const news = stripComments(원본);

/* 폰 규칙 덩이들만 떼어 본다 — 다른 미디어쿼리(넓은 화면·태블릿)의 규칙이 섞여 통과하면 안 된다 */
function 폰규칙() {
  /* ⚠ 「@media(max-width:560px)」 는 «여럿»이다(설정 칸·접는 줄·폰 정리 2026-09-12·폰 콤팩트 2026-10-12 …).
       예전에는 «마지막» 덩이만 봤다(첫 것은 설정 칸 같은 작은 덩이라서). 그런데 2026-10-12 에 콤팩트 덩이가 «마지막»이 되어
       이 검사가 일제히 엉뚱한 덩이를 보고 깨졌다 — 규칙은 «어느 덩이에 있나»가 아니라 «폰 규칙 어디엔가 있나»다. 그래서 전부 이어 붙여 본다. */
  let 모음 = '', i = -1;
  while ((i = news.indexOf('@media(max-width:560px){', i + 1)) >= 0) {
    /* 중괄호를 세어 그 덩이만 */
    let d = 0, k = news.indexOf('{', i);
    for (; k < news.length; k++) {
      if (news[k] === '{') d++;
      else if (news[k] === '}') { d--; if (!d) break; }
    }
    모음 += news.slice(i, k + 1) + '\n';
  }
  assert.ok(모음, '폰 규칙 덩이가 없다');
  return 모음;
}
const 폰 = 폰규칙();

/* ══════ ① 탭이 다 보인다 ══════ */

test('★★ 폰에서 탭이 «다 보인다» — 굴려서 찾게 두지 않는다', () => {
  /* 폰에서는 가로로 굴릴 수 있다는 것이 눈에 안 띈다 — 없는 탭으로 여기게 된다. */
  assert.match(폰, /#tabs button\{[^}]*flex:1/,
    '탭이 남는 자리를 나눠 갖지 않는다 — 다섯째가 화면 밖으로 나간다');
  assert.match(폰, /#tabs button\{[^}]*min-width:0/,
    '탭이 안 줄어든다 — 글자 폭만큼 벌어져 또 넘친다');
});

test('★★ 폰·태블릿에서 위가 «붙는다» — 붙일 것은 #tabs 가 아니라 #top', () => {
  /* ⚠⚠ #tabs 에는 예전부터 position:sticky 가 있었는데 «폰에서는 안 붙었다».
       붙는 것은 «제 부모의 상자 안»에서만이다 — 부모(#top)가 화면 밖으로 밀려 나가면
       그 안의 붙임도 같이 나간다. 실측 2026-09-12: 900px 굴리니 탭이 -858px 였다.
     ⚠ 981px 이상에는 걸지 않는다 — 거기서는 껍데기(flex)가 이미 얼린다. */
  const i = news.lastIndexOf('@media(max-width:980px){');
  assert.ok(i >= 0, '넓은 화면 밖에서 위를 붙이는 덩이가 없다');
  let d = 0, k = news.indexOf('{', i);
  for (; k < news.length; k++) {
    if (news[k] === '{') d++;
    else if (news[k] === '}') { d--; if (!d) break; }
  }
  const 덩이 = news.slice(i, k + 1);
  assert.match(덩이, /#top\{[^}]*position:sticky/,
    '#top 이 안 붙는다 — #tabs 만 붙여 두면 부모가 나갈 때 같이 나간다');
  assert.match(덩이, /#top\{[^}]*top:0/, '붙는 자리가 맨 위가 아니다');
  assert.match(덩이, /#top\{[^}]*z-index:\d+/, '겹침 차례가 없어 내용이 위를 덮는다');
  assert.match(덩이, /#top\{[^}]*background:/,
    '바탕이 없어 붙은 머리 뒤로 글이 비친다');
});

/* ══════ ② 줄 목록 ══════ */

test('★★ 줄 목록이 «우리가 쓴 한 줄»을 보여 준다 — 매체 제목은 네 줄로 쏟아졌다', () => {
  const fn = 함수몸(news, '꼭지칸하나');
  assert.ok(fn, '꼭지칸하나 를 못 찾았다');
  assert.match(fn, /esc\(x\.한줄\s*\|\|\s*x\.제목/,
    '줄에 매체 제목만 그린다 — 우리 한 줄이 있으면 그것이 먼저다');
});

test('★ 폰에서 ▲▼ 를 감추고, 출처는 제목 «아래»로 내린다', () => {
  /* ▲▼ 는 손가락보다 작아 눌러도 안 맞는다. 차례 바꾸기는 PC 에서 한다.
     ⚠ 출처를 «지우지» 않는다 — 어느 매체인지는 남아야 한다. 자리만 옮긴다. */
  assert.match(폰, /\.item \.mv\{display:none\}/, '폰에서 ▲▼ 가 그대로 자리를 먹는다');
  assert.ok(!/\.item \.src\{display:none\}/.test(폰),
    '출처를 아예 감췄다 — 어느 매체인지 알 길이 없어진다');
  assert.match(폰, /\.item \.src\{[^}]*grid-row:2/, '출처가 제목 아래로 안 내려간다');
  assert.match(폰, /\.item\{[^}]*display:grid/, '줄을 바둑판으로 안 짰다');
});

/* ══════ ③ 칸이 줄어든다 ══════ */

test('★★ 바둑판 칸이 «줄어들 수 있다» — 안 줄면 화면 밖으로 벌어진다', () => {
  /* 바둑판 칸은 기본이 min-width:auto 라, 안에 안 접히는 줄이 하나만 있어도
     그 줄의 온폭만큼 칸이 벌어진다. 그러면 오른쪽이 조용히 잘린다. */
  assert.match(폰, /\.cols>\*\{min-width:0\}/, '칸에 줄어들 수 있다는 규칙이 없다');
});

/* ══════ ④ 표 ══════ */

test('★★ 폰에서 표는 «카드»로 바뀐다 — 옆으로 굴려 보게 두지 않는다(2026-10-12 콤팩트)', () => {
  /* 2026-09-12 에는 표를 «옆으로 굴려» 보게 했다(table.list{min-width:620px} + 칸 nowrap). 그랬더니 「실린 것」·담당자·나갔나·열람이
     화면 밖에 있었다(대표 폰 캡처 2026-10-11). 이제는 열을 «카드 한 장의 칸»으로 바꾼다 — 칸이 폭을 다 쓰니 한 글자씩 쏟아지지도 않는다.
     (카드 규칙의 세부는 tests/news-phone-compact.test.js) */
  assert.ok(!/table\.list\s*\{[^}]*min-width:\s*\d+px/.test(폰), '표에 폭 바닥이 남았다 — 옆으로 굴려야만 보인다(열이 잘리던 까닭)');
  assert.match(폰, /#main table\.list\{[^}]*display:\s*block/, '표가 카드로 안 바뀐다');
  assert.match(폰, /#main table\.list td,#main table\.list th\{[^}]*white-space:\s*normal/, '카드 칸이 안 접힌다 — 회사 이름이 한 줄에 못 들어가면 잘린다');
  /* 그물 — 못 줄이는 것이 하나 남아도 쪽 전체가 옆으로 밀리지 않는다 */
  assert.match(폰, /\.box\{overflow-x:auto\}/, '상자 안전판이 없다');
});

/* ══════ ⑤ 단추 ══════ */

test('★ 회차 단추는 한 줄에 나란히, «보내기»만 제 줄을 온전히 쓴다', () => {
  /* 되돌릴 수 없는 일이라 옆 단추와 나란히 두면 엄지로 잘못 누르기 쉽다.
     (2026-10-12 콤팩트: 예전 «두 칸 바둑판»(넷이 세 줄)을 «한 줄에 셋 + 보내기 한 줄»로 줄였다 — 단추는 그대로 다 있다) */
  assert.match(폰, /\.nowtop \.hdbar \.btn\.test[^{]*\{[^}]*flex:1 1 0/,
    '다시 담기·시험 발송·예약 단추가 한 줄에 나란히 서지 않는다 — 넷이 세 줄을 먹는다');
  assert.match(폰, /\.nowtop \.hdbar \.btn\.pri\{[^}]*flex:1 1 100%/,
    '보내기가 제 줄을 안 쓴다 — 잘못 눌리기 쉬운 자리다');
});

/* ══════ ⑥ 얼리기가 폰으로 새지 않는다 ══════ */

test('★★ 위를 얼리는 규칙은 «넓은 화면에만» 있다 — 폰에서 새면 아무것도 못 본다', () => {
  /* 이미 다른 검사가 보는 규칙이지만, 폰 규칙을 만지다 새기 쉬운 자리라 여기서도 본다. */
  /* 쪽 «자체»(html·body·#shell·.wrap·#main)를 안 구르게 하는 overflow:hidden 이 폰 규칙에 들어가면 안 된다.
     ⚠ 이름·기간 같은 «칸 하나»를 말줄임하려고 건 overflow:hidden 은 다르다(2026-10-12 콤팩트) — 쪽을 안 구르게 하지 않는다. */
  assert.ok(!/(?:^|[}\s,])(?:html|body|#shell|\.wrap|#main)(?:\[[^\]]*\])?\s*\{[^}]*overflow(?:-y)?:\s*hidden/.test(폰),
    '폰 규칙 안에 쪽을 안 구르게 하는 것이 들어갔다');
  assert.match(news, /@media\(min-width:981px\)\{[\s\S]{0,200}?html,body\{height:100%;overflow:hidden\}/,
    '얼리기가 넓은 화면 조건 밖으로 나갔다');
});
