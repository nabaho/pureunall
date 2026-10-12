'use strict';
/* 뉴스레터 폰 «콤팩트» — 한 화면에 가급적 모두 보이게 (대표 지시 2026-10-11, 목업 7장 승인 2026-10-12)
   ═══════════════════════════════════════════════════════════════════════════
   「폰화면 콤팩트하게 한화면에서 가급적 모두 보게 정리」

   ■ 무엇이 문제였나 (대표 폰 캡처 6장, 폭 ≈ 360px)
     · 탭 줄이 두 줄로 꺾였다 · 이번 회차 첫 화면에 기사 줄이 0개(머리·단추·담는 법이 화면을 다 먹었다)
     · 지난 회차·보낸 결과 표가 옆으로 넘쳐 열이 잘렸다 · 안내문 탭은 오른쪽이 잘렸다
     · 받는 곳은 탭·거르개가 5~6줄이라 업체가 5줄뿐 · 설정은 칸 높이가 커 한 화면에 4개

   ■ 이 검사가 지키는 «규칙» (값이 아니다 — CLAUDE.md 「지금 값이 아니라 규칙」)
     ① 폰 규칙은 «폰 미디어쿼리 안»에만 있다 — 넓은 화면은 한 글자도 안 바뀐다
     ② 앱바는 올라가고 «탭 줄만» 붙는다 — 그 높이를 «재서» 아래 붙는 머리(--tophi)에 넘긴다
     ③ 표는 «옆으로 굴리지 않고» 카드로 바꾼다 — 칸 이름은 칸마다(data-l) 달려 있다(렌더 함수는 한 벌)
     ④ 접는 것은 «눌러서» 편다 — 아무것도 감추지 않는다(줄·한 줄 글·미리보기)
     ⑤ 목록의 맨 왼쪽은 ☐ 와 번호다 — 카드가 되어도 그 두 칸이 왼쪽 끝에 남는다(CLAUDE.md 2026-10-05)
     ⑥ CSS 가 겨냥하는 이름(클래스·탭 열쇠)이 마크업·본 스크립트에 «있다» — 오타 하나로 규칙이 조용히 안 걸리는 것을 막는다

   ⚠ 폰 화면의 «실제 모양»(가로 넘침 0 · 탭 한 줄 · 첫 화면 줄 수)은 진짜 브라우저로 쟀다 — 기록은 status/2026-10-11-news-phone-compact.md.
     여기서는 그 결과를 지키는 «규칙»만 본다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');
const { 함수몸 } = require('./helpers/strip-comments.js');
const { 화면올리기 } = require('./helpers/news-screen-vm.js');

const 원문 = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8').replace(/\r\n/g, '\n');
const 화면 = stripComments(원문);                           /* 본 스크립트·마크업 — 주석을 걷은 글 */
/* 머리 <style> 만 — CSS 주석을 걷고 줄바꿈을 눌러 한 줄로 */
const 꾸밈 = (원문.slice(0, 원문.indexOf('</head>')).match(/<style>[\s\S]*?<\/style>/g) || [])
  .join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '');

/* @media / @container 블록을 «바깥 규칙»과 가른다 (바깥 몸은 이어 붙여 «폰 아닌 곳»의 규칙을 본다) */
function 블록들(css, 머리) {
  const 나온 = [];
  let i = 0;
  while ((i = css.indexOf(머리, i)) >= 0) {
    const 열 = css.indexOf('{', i);
    let 깊이 = 1, k = 열 + 1;
    for (; k < css.length && 깊이; k++) { if (css[k] === '{') 깊이++; else if (css[k] === '}') 깊이--; }
    나온.push({ 조건: css.slice(i + 머리.length, 열).trim(), 몸: css.slice(열 + 1, k - 1), 시작: i, 끝: k });
    i = k;
  }
  return 나온;
}
function 바깥만(css) {
  let 밖 = '', 자리 = 0;
  블록들(css, '@media').forEach(function (b) { 밖 += css.slice(자리, b.시작); 자리 = b.끝; });
  return 밖 + css.slice(자리);
}
const 폰들 = 블록들(꾸밈, '@media').filter((b) => /max-width:\s*560px/.test(b.조건));
const 폰 = 폰들.map((b) => b.몸).join('');
const 밖규칙 = 바깥만(꾸밈);

/* App.tab 이 가질 수 있는 열쇠 — 본 스크립트가 «허락한 목록»에서 읽는다(손으로 적으면 새 탭을 빠뜨린다) */
const 탭열쇠들 = (function () {
  const m = /\['now','past','note'[^\]]*\]\.indexOf\(t\)/.exec(화면);
  assert.ok(m, 'App.tab 이 가질 수 있는 열쇠 목록을 못 찾았다');
  return m[0].match(/'([a-z]+)'/g).map((s) => s.slice(1, -1));
})();

/* ══════ ① 폰 규칙은 폰 미디어쿼리 안에만 있다 ══════ */

test('★★ 폰 콤팩트 규칙이 있고, 전부 «폰 미디어쿼리 안»에 있다 — 넓은 화면은 안 바뀐다', () => {
  assert.ok(폰들.length >= 2, '폰 규칙 덩이가 모자란다 — 콤팩트 규칙이 사라졌다');
  assert.match(폰, /#main\[data-tab=[a-z]+\]/, '탭별 폰 규칙(#main[data-tab=…])이 없다');
  /* 어느 탭에도 안 걸리는 «탭별 규칙»이 폰 덩이 밖에 있으면 넓은 화면까지 바뀐다 */
  assert.ok(!/#main\[data-tab=/.test(밖규칙), '★★ 탭별 폰 규칙이 폰 미디어쿼리 «밖»에 새어 나왔다 — 넓은 화면이 바뀐다');
  /* 카드로 바꾸는 규칙(표 → 카드)도 마찬가지 */
  assert.ok(!/#main table\.list\{[^}]*display:\s*block/.test(밖규칙), '★★ 표를 카드로 바꾸는 규칙이 폰 밖으로 새어 나왔다');
});

test('★ 짧은 이름(.sh)은 폰에서만 보인다 — 바깥(넓은 화면)에서는 숨긴다', () => {
  assert.match(밖규칙, /#main \.sh\{display:\s*none\}/, '넓은 화면에서 짧은 이름이 같이 보인다 — 이름이 두 번 나온다');
  assert.match(폰, /#main \.lg\{display:\s*none\}/, '폰에서 긴 이름이 안 접힌다');
  assert.match(폰, /#main \.sh\{display:\s*(inline|block)/, '폰에서 짧은 이름이 안 보인다');
});

/* ══════ ② 앱바는 올라가고 탭만 붙는다 ══════ */

test('★★ 폰에서 «탭 줄만» 붙는다 — #top 은 상자를 잃고(display:contents), #tabs 가 붙는다', () => {
  /* ⚠ 붙는 것(sticky)은 «제 부모의 상자 안»에서만이다. #top 이 상자이면 그 안의 #tabs 는 못 붙는다 — 그래서 상자를 없앤다. */
  assert.match(폰, /#top\{[^}]*display:\s*contents/, '★★ #top 이 상자를 안 잃는다 — #tabs 가 붙을 수 없다');
  assert.match(폰, /#tabs\{[^}]*position:\s*sticky[^}]*top:\s*0[^}]*z-index:\s*\d+/, '★★ 폰에서 #tabs 가 안 붙는다');
  assert.ok(!/#top\{[^}]*position:\s*sticky/.test(폰), '★★ 폰에서 #top 까지 붙는다 — 앱바가 안 올라가고 화면 위를 계속 먹는다');
  /* #top 의 계산값 position 이 sticky 로 남으면 위높이재기가 «#top 이 붙었다»고 읽고 높이 0 을 넣는다 */
  assert.match(폰, /#top\{[^}]*position:\s*static/, '#top 의 position 을 static 으로 되돌리지 않았다 — 붙는 머리 높이를 0 으로 잘못 잰다');
});

test('★★ 탭 여섯이 «한 줄» — 접지 않고 글 길이만큼 자리를 준다', () => {
  assert.match(폰, /#tabs button\{[^}]*white-space:\s*nowrap/, '탭 글이 접힌다 — 「받는 곳 253」이 두 줄이 된다');
  assert.match(폰, /#tabs button\{[^}]*flex:\s*1 1 auto/, '탭이 글 길이만큼 자리를 못 받는다');
  assert.match(폰, /#tabs button\{[^}]*min-width:\s*0/, '탭이 안 줄어든다 — 좁은 폰에서 또 넘친다');
});

test('★★ 붙는 머리 높이를 «재는» 길이 폰의 #tabs 도 안다 — 안 그러면 담는 법 덩이가 탭 «뒤로» 숨는다', () => {
  const 몸 = 함수몸(화면, '위높이재기');
  assert.ok(몸, '위높이재기 를 못 찾았다');
  const 짐 = 화면올리기();
  assert.ok(!짐.올림오류, '화면을 vm 에 못 올렸다: ' + 짐.올림오류);
  const 기록 = {};
  짐.document.documentElement = { style: { setProperty(k, v) { 기록[k] = v; } } };
  const 상자 = (높이) => ({ getBoundingClientRect: () => ({ height: 높이 }) });
  const 장면 = (맨위, 탭, 스타일) => {
    짐.document.getElementById = (id) => (id === 'top' ? 맨위 : id === 'tabs' ? 탭 : null);
    짐.getComputedStyle = (el) => (el === 맨위 ? 스타일.top : el === 탭 ? 스타일.tabs : {});
    delete 기록['--tophi'];
    짐.위높이재기();
    return 기록['--tophi'];
  };
  const 위 = 상자(95), 탭 = 상자(36);
  assert.strictEqual(장면(위, 탭, { top: { position: 'sticky', display: 'block' }, tabs: { position: 'sticky' } }), '95px',
    '태블릿: #top(앱바+탭)이 붙어 있는데 그 높이를 안 넘긴다');
  assert.strictEqual(장면(위, 탭, { top: { position: 'static', display: 'contents' }, tabs: { position: 'sticky' } }), '36px',
    '★★ 폰: #top 이 상자가 없고 #tabs 가 붙는데 #tabs 높이를 안 잰다 — 담는 법 덩이가 탭 뒤로 들어가 안 보인다');
  assert.strictEqual(장면(위, 탭, { top: { position: 'static', display: 'block' }, tabs: { position: 'sticky' } }), '0px',
    '★★ 넓은 화면: #tabs 는 기본이 sticky 로 «계산»되지만 #top 안에서 붙으나 마나다 — 그 높이를 넘기면 덩이 위에 헛자리가 생긴다');
  assert.strictEqual(장면(위, 탭, { top: { position: 'static', display: 'contents' }, tabs: { position: 'static' } }), '0px',
    '탭이 안 붙어 있는데 높이를 넘겼다');
});

test('★ 위높이재기 는 #tabs 가 늘거나 줄 때도 다시 잰다 — #top 은 폰에서 상자가 없어 관찰이 안 된다', () => {
  assert.match(화면, /new ResizeObserver\(위높이재기\)\.observe\(탭\)/, '#tabs 를 관찰하지 않는다 — 탭 높이가 바뀌어도 모른다');
});

test('★ 붙는 머리 밑에 붙는 것들은 «잰 높이»를 따른다 — 보낸 결과 머리·지난 회차 미리보기', () => {
  assert.match(꾸밈, /\.res-head\{[^}]*position:\s*sticky[^}]*top:\s*var\(--tophi/, '보낸 결과 머리가 붙는 자리를 안 잰다 — 태블릿에서 앱바 뒤로 들어간다');
  assert.match(꾸밈, /\.pv\{[^}]*position:\s*sticky[^}]*top:\s*calc\(var\(--tophi/, '지난 회차 미리보기가 붙는 자리를 안 잰다');
});

test('★★ 폰에서만 머리 덩이(.nowtop)를 «붙이지 않는다» — 풀어도 되는 자리는 폰과 낮은 창뿐 (대표 지시 2026-10-12 「추천대로」)', () => {
  /* ⚠ 2026-09-14 「이부분 틀고정」은 «넓은 화면»에서 꼭지를 훑을 때의 일이다. 폰에서는 이 덩이가 ≈ 240px 라
       탭 줄 밑에 붙으면 굴리는 내내 화면의 1/3 을 가린다(진짜 Edge 375×700: 기사 자리 431px → 풀면 664px).
       대표가 «폰에서만 풀기»를 골랐다 — 태블릿·PC 의 틀고정은 그대로다. */
  const 풀리는 = (몸) => !/position:\s*sticky/.test(몸) && /position:\s*(static|relative)/.test(몸);
  const 풀림 = [];
  블록들(꾸밈, '@media').forEach((b) => {
    for (const m of b.몸.matchAll(/\.colL>\.nowtop\{([^}]*)\}/g)) if (풀리는(m[1])) 풀림.push({ 조건: b.조건, 몸: m[1] });
  });
  assert.ok(풀림.some((r) => /max-width:\s*560px/.test(r.조건)),
    '★★ 폰(560px 이하)에서 머리 덩이를 안 푼다 — 굴리는 내내 화면의 1/3 을 가린다');
  /* 풀어도 되는 자리는 «폰»과 «넓지만 낮은 창»(원래 있던 안전판)뿐이다 — 태블릿·PC 의 틀고정이 딸려 풀리면 안 된다 */
  풀림.forEach((r) => assert.ok(/max-width:\s*560px/.test(r.조건) || /min-width:\s*981px\)\s*and\s*\(max-height:\s*620px/.test(r.조건),
    '★★ 폰·낮은 창 밖에서 머리 덩이의 붙임을 푼다(' + r.조건 + ') — 태블릿·PC 의 틀고정(대표 지시 2026-09-14)이 사라진다'));
  /* 바깥(미디어쿼리 없는) 규칙은 계속 «붙는다» — 폰 규칙이 밖으로 새면 넓은 화면의 틀고정이 사라진다 */
  assert.match(밖규칙, /\.colL>\.nowtop\{[^}]*position:\s*sticky/, '★★ 머리 덩이의 기본 규칙이 더는 안 붙는다 — 태블릿·PC 의 틀고정이 사라졌다');
  assert.ok(!/\.colL>\.nowtop\{[^}]*position:\s*(static|relative)/.test(밖규칙),
    '★★ 붙임을 푸는 규칙이 폰 미디어쿼리 «밖»으로 새어 나왔다 — 넓은 화면의 틀고정이 사라진다');
  /* relative 로 풀 때 top 이 붙는 자리(--tophi)로 남으면 덩이가 그만큼 «아래로 밀린다»(실측 36px) — top 을 되돌려야 한다.
     relative 를 쓰는 까닭은 z-index 를 살리기 위해서다(ⓘ 도움말 풀이가 뒤따르는 줄 위로 뜬다) */
  const 폰몸 = 풀림.filter((r) => /max-width:\s*560px/.test(r.조건)).map((r) => r.몸).join(';');
  if (/position:\s*relative/.test(폰몸)) assert.match(폰몸, /top:\s*(auto|0)/, '★★ relative 로 풀면서 top 을 안 되돌렸다 — 붙는 자리(--tophi)만큼 덩이가 아래로 밀린다');
  /* 이 결정이 푸는 것은 «머리 덩이 하나»다 — 탭 줄은 폰에서도 계속 붙는다(위 테스트), 아무것도 감추지 않는다 */
  assert.ok(!/\.colL>\.nowtop\{[^}]*display:\s*none/.test(폰), '★★ 폰에서 머리 덩이를 «감춘다» — 보내기·담는 법을 폰에서는 못 쓰게 된다(풀기만 한다)');
});

/* ══════ ③ 표는 카드로 — 옆으로 굴리지 않는다 ══════ */

test('★★ 폰에서 표는 «카드»로 바뀐다 — 옆으로 굴려야만 보이게 두지 않는다', () => {
  assert.ok(!/table\.list\s*\{[^}]*min-width:\s*\d+px/.test(폰), '★★ 표에 폭 바닥(min-width)이 남았다 — 옆으로 굴려야만 보인다(열이 잘리던 까닭)');
  assert.match(폰, /#main table\.list\{[^}]*display:\s*block/, '표가 칸 쌓기로 안 바뀐다');
  assert.match(폰, /#main table\.list tr:has\(>th\)\{display:\s*none\}/, '머리글 줄이 카드 위에 그대로 남는다 — 칸 이름은 칸마다(data-l) 달려 있다');
  assert.match(폰, /table\.list :where\([^{]*data-l[^{]*\)::before\{content:\s*attr\(data-l\)/, '칸 이름표(data-l)를 그리는 규칙이 없다 — 카드에서 값이 무슨 칸인지 모른다');
  assert.match(폰, /table\.list>tbody>tr:has\(>th\)\{display:\s*none\s*!important\}/,
    '머리글 줄이 tbody 안에 있는 표(지난 회차·해지한 곳)는 카드 줄 규칙이 덮어 머리글이 카드로 그려진다');
  /* 안전판 — 못 줄이는 것이 하나 남아도 쪽 전체가 옆으로 밀리지 않는다 */
  assert.match(폰, /\.box\{overflow-x:\s*auto\}/, '상자 안전판이 없다 — 못 줄이는 줄 하나가 쪽 전체를 오른쪽으로 민다(설정 탭 340px)');
});

test('★★ 표가 있는 탭마다 «카드 줄» 규칙이 있다 — 규칙 하나가 빠지면 그 탭만 옛 표로 돌아간다', () => {
  /* 표를 가진 탭: 지난 회차·받는 명단·지인·잠재·해지한 곳·주소 없는 곳·반송·거부·보낸 결과 */
  ['past', 'who', 'friend', 'closed', 'noaddr', 'bounce', 'res'].forEach(function (k) {
    /* ⚠ 셀렉터에 «tr» 이 들어야 한다 — 같은 탭의 다른 바둑판(보낸 결과의 숫자 칩 등)이 대신 통과하면 이빨이 없다 */
    const 있나 = new RegExp('#main\\[data-tab=' + k + '\\][^{}]*\\btr\\b[^{}]*\\{[^}]*display:\\s*grid').test(폰);
    assert.ok(있나, '★★ ' + k + ' 탭에 카드 줄(display:grid) 규칙이 없다 — 그 탭의 표가 폰에서 옛 모양으로 돌아간다');
  });
});

test('★★ 목록의 맨 왼쪽은 «☐ 와 번호»다 — 카드가 되어도 그 두 칸이 왼쪽 끝 첫 두 칸에 남는다(CLAUDE.md 2026-10-05)', () => {
  /* ☐ 가 있는 목록(받는 명단·지인·주소 없는 곳)은 ☐ → 번호 순서를 지킨다 */
  ['who', 'friend', 'noaddr'].forEach(function (k) {
    assert.match(폰, new RegExp('#main\\[data-tab=' + k + '\\] tr>td\\.ck\\{[^}]*grid-column:\\s*1[;}/ ]'),
      '★★ ' + k + ' 카드에서 ☐ 고르기 칸이 맨 왼쪽(첫 칸)이 아니다');
    assert.match(폰, new RegExp('#main\\[data-tab=' + k + '\\] tr>td\\.n\\{[^}]*grid-column:\\s*2[;}/ ]'),
      '★★ ' + k + ' 카드에서 번호가 ☐ 바로 다음(둘째 칸)이 아니다');
  });
  /* 번호만 있는 목록(지난 회차·해지한 곳)은 번호가 맨 왼쪽 */
  assert.match(폰, /#main\[data-tab=past\] tr\.pick>td\.n\{[^}]*grid-column:\s*1[;}/ ]/, '지난 회차 카드에서 번호가 맨 왼쪽이 아니다');
  assert.match(폰, /#main\[data-tab=closed\] tr>td\.n\{[^}]*grid-column:\s*1[;}/ ]/, '해지한 곳 카드에서 번호가 맨 왼쪽이 아니다');
  /* ☐ 는 손가락으로 누를 만큼 넉넉하게 — 폰에서 입력 칸 크기를 키운다 */
  assert.match(폰, /input\.chk\b[^{]*\{[^}]*width:\s*\d+px[^}]*height:\s*\d+px/, '폰에서 ☐ 를 키우지 않았다 — 손가락으로 누르기 어렵다');
});

test('★★ 카드 줄은 «누르면 펴진다» — 펴졌을 때와 접혔을 때의 모양이 둘 다 있다', () => {
  ['who', 'friend', 'closed', 'noaddr', 'res'].forEach(function (k) {
    assert.match(폰, new RegExp('#main\\[data-tab=' + k + '\\][^{}]*tr\\.open'), '★★ ' + k + ' 탭에 «펴진 줄»(tr.open) 규칙이 없다 — 눌러도 아무 일이 없다');
  });
  assert.match(폰, /#main\[data-tab=who\] tr:not\(\.open\) \.one\.tidy>\*\{display:\s*none\}/,
    '받는 명단 접힌 줄이 이름만 보이게 접히지 않는다 — 한 줄 카드가 아니다');
});

/* ══════ ④ 접는 것은 눌러서 편다 — 손잡이 ══════ */

test('★★ 눌러서 펴는 손잡이(문서 클릭 하나)가 있고, 단추·칸·☐ 를 눌렀을 때는 가로채지 않는다', () => {
  const 몸 = /document\.addEventListener\('click', function\(ev\)\{([\s\S]*?)\n\}\);/.exec(화면);
  assert.ok(몸, '눌러서 펴는 손잡이를 못 찾았다');
  assert.match(몸[1], /t\.closest\('a,button,input,select,textarea,label,summary,\.tipwrap,\.menu'\)\)\s*return/,
    '★★ 단추·입력칸·링크를 눌러도 줄이 펴진다 — 「수신거부」를 누르다 줄이 열린다');
  assert.match(몸[1], /td\.ck/, '☐ 칸 둘레를 눌러도 줄이 펴진다 — 고르다 빗나가면 짜증이 난다');
  assert.match(몸[1], /\[data-f1\]/, '한 줄로 접은 글을 누르면 펴는 길이 없다');
  assert.match(몸[1], /\.phfold>h3/, '접힌 미리보기를 누르면 펴는 길이 없다');
  assert.match(몸[1], /th'\)\)\s*줄\.classList\.toggle\('open'\)/, '머리글 줄까지 펴진다');
});

test('★★ 한 줄로 접는 글의 «목록»은 한 곳에 있고, 그 열쇠(탭)가 실제 탭이다', () => {
  const 목 = /const 한줄접이들 = \[([\s\S]*?)\];/.exec(화면);
  assert.ok(목, '한줄접이들 를 못 찾았다');
  const 선택자들 = 목[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.ok(선택자들.length >= 3, '접을 글이 거의 없다');
  선택자들.forEach(function (sel) {
    const m = /^#main\[data-tab=([a-z]+)\]/.exec(sel);
    assert.ok(m, '접는 글 선택자가 어느 탭의 것인지 안 적혀 있다: ' + sel);
    assert.ok(탭열쇠들.indexOf(m[1]) >= 0, '접는 글 선택자의 탭 열쇠가 없는 탭이다(오타): ' + sel);
  });
  /* 접는 모양은 폰에서만, 한 줄 말줄임으로(-webkit-line-clamp 는 안쪽 여백에 다음 줄이 비쳐 안 쓴다) */
  assert.match(폰, /\[data-f1\]:not\(\.open\)\{[^}]*white-space:\s*nowrap[^}]*text-overflow:\s*ellipsis/, '접힌 글이 한 줄 말줄임이 아니다');
  assert.ok(!/line-clamp/.test(폰), '-webkit-line-clamp 를 썼다 — 안쪽 여백이 있는 상자에서는 잘린 «다음 줄»의 윗부분이 비쳐 보인다');
  assert.match(폰, /\[data-f1\]:not\(\.open\) br\{display:\s*none\}/, '접힌 글 안의 줄바꿈(<br>)이 둘째 줄을 만든다');
  /* 접는 글을 목록에서 붙이는 일은 render() 가 부르는 폰다듬기 에 있다 */
  assert.match(함수몸(화면, '폰다듬기'), /한줄접이달기\(\)/, '폰다듬기 가 접는 글을 안 단다');
  assert.match(함수몸(화면, 'render'), /폰다듬기\(\)/, 'render() 가 폰다듬기 를 안 부른다 — 새로 그려진 화면에 이름표·접이가 없다');
});

test('★★ 안내문: 끌어놓기 상자는 접고, «보내기 전 자료 확인»은 눌러서 편다 — 오른쪽이 잘리던 까닭을 막는다', () => {
  assert.match(폰, /#main\[data-tab=note\] \.notegrid>\*\{min-width:\s*0\}/,
    '★★ 안내문 바둑판 칸이 줄어들 수 없다 — 미리보기 틀(980px)이 칸을 밀어 오른쪽이 잘린다');
  assert.match(폰, /#main\[data-tab=note\] \.dropbox\{display:\s*none\}/, '폰에서 끌어놓기 상자가 안 접힌다');
  assert.match(폰, /#main\[data-tab=note\] \.phfold:not\(\.open\)>\.pad\{display:\s*none\}/, '미리보기가 접혀 있지 않다 — 틀(980px)이 자리를 먹는다');
  assert.match(폰, /\.phfold\.open>h3::after\{content:/, '펴졌을 때 글이 안 바뀐다');
  /* 접어도 «지우지 않는다» — 파일 직접 고르기와 미리보기 틀이 마크업에 남아 있다 */
  const 빈 = 함수몸(화면, '안내빈화면');
  assert.match(빈, /id="ntDrop"/, '넓은 화면의 끌어놓기가 없어졌다');
  assert.match(빈, /id="ntDefaultPreview"/, '미리보기 틀이 없어졌다');
  assert.match(빈, /class="box dropbox"/, '끌어놓기 상자에 이름(.dropbox)이 없다 — 폰 규칙이 안 걸린다');
  assert.match(빈, /class="box notedefault phfold"/, '미리보기 상자에 이름(.phfold)이 없다 — 폰 규칙이 안 걸린다');
  assert.match(함수몸(화면, '안내문화면'), /파일 직접 고르기[\s\S]*type="file"/, '폰에서 파일을 고를 길(파일 직접 고르기)이 없어졌다');
});

/* ══════ ⑤ 이번 회차 ══════ */

test('★★ 이번 회차 머리: 네 줄 — 이름·딱지 / 기간·실린 것·크게 보기 / 단추 셋 / 보내기만 따로 큰 단추', () => {
  assert.match(폰, /\.nowtop \.hdbar::before,\.nowtop \.hdbar::after\{[^}]*flex:\s*0 0 100%/, '줄을 가르는 «줄바꿈 막대»가 없다');
  assert.match(폰, /\.nowtop \.hdbar \.btn\.pri\{[^}]*flex:\s*1 1 100%/, '★★ 보내기가 제 줄을 안 쓴다 — 되돌릴 수 없는 일이라 옆 단추와 나란히 두면 엄지로 잘못 누르기 쉽다');
  assert.match(폰, /\.nowtop \.hdbar \.lnk\.redo,\.nowtop \.hdbar \.btn\.test,\.nowtop \.hdbar \.btn\.rsv\{[^}]*flex:\s*1 1 0/,
    '다시 담기·시험 발송·예약 단추가 한 줄에 나란히 서지 않는다');
  /* 줄 차례(order)가 이름 → 줄바꿈 → 기간 → … → 보내기 순이다 */
  /* ⚠ 「order」 앞에 «{ 또는 ;» 를 둔다 — 안 그러면 「border:1px」 의 order 를 읽는다(탐욕 일치가 뒤에서부터 찾는다) */
  const 차례 = (sel) => { const m = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{(?:[^}]*;)?order:\\s*(\\d+)').exec(폰); return m ? Number(m[1]) : NaN; };
  const 순 = ['.nowtop .hdbar .no', '.nowtop .hdbar .badge', '.nowtop .hdbar::before', '.nowtop .hdbar .meta', '.nowtop .hdbar .lnk.look',
    '.nowtop .hdbar::after', '.nowtop .hdbar .lnk.redo', '.nowtop .hdbar .btn.test', '.nowtop .hdbar .btn.rsv', '.nowtop .hdbar .btn.pri'].map(차례);
  순.forEach((n, i) => assert.ok(!Number.isNaN(n), '머리 줄 차례(order)를 못 찾았다: ' + i));
  for (let i = 1; i < 순.length; i++) assert.ok(순[i] > 순[i - 1], '머리 줄 차례가 거꾸로다 — 보내기가 위로 올라오거나 줄이 섞인다: ' + 순.join(','));
  /* ⚠ 머리 두 덩이(.hdbar·.ways)에 overflow 를 걸지 않는다 — ⓘ 풀이가 줄 밖으로 뜨는 창이라 잘린다 */
  assert.ok(!/\.nowtop \.(hdbar|ways)\{[^}]*overflow/.test(폰), '머리 덩이에 overflow 를 걸었다 — ⓘ 풀이가 잘린다');
});

test('★★ 담는 법: 바둑판 두 줄 — 꼬리의 두 길(연습용 샘플·그대로 전달)과 ⓘ 가 같은 바둑판의 칸이다', () => {
  assert.match(폰, /\.nowtop \.ways\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(\d+,/, '담는 법이 바둑판이 아니다');
  assert.match(폰, /\.nowtop \.ways \.tail\{display:\s*contents\}/, '★★ 꼬리(연습용 샘플·그대로 전달)가 바둑판의 칸이 안 된다 — 폰에서 그 길이 안 보이거나 줄이 늘어난다');
  assert.ok(!/\.nowtop \.ways \.tail\{[^}]*display:\s*none/.test(폰), '★★ 폰에서 연습용 샘플·그대로 전달이 사라진다(removing-a-path)');
  assert.match(폰, /\.nowtop \.ways \.tail \.mid\{display:\s*none\}/, '꼬리 둘 사이의 「·」가 바둑판의 한 칸을 먹는다');
  assert.match(폰, /\.nowtop \.ways \.tipwrap\{[^}]*order:\s*\d+/, 'ⓘ 가 바둑판 «맨 끝»으로 안 간다');
  assert.match(폰, /\.nowtop \.ways \.tipwrap \.ib:after\{content:/, 'ⓘ 가 「도움말」 칸으로 안 보인다');
  /* 칸 안의 글은 «한 덩이»(.wi)로 감싼다 — 칸을 flex 로 가운데 세울 때 글 조각마다 따로 떨어진 칸이 되지 않게(두 줄 글이 어색하게 접힌다) */
  const 이번 = 함수몸(화면, '이번회차화면');
  assert.ok((이번.match(/<button class="wt[^"]*"[^>]*><span class="wi">/g) || []).length >= 5, '담는 법 단추의 글이 한 덩이(.wi)로 안 감싸였다');
  assert.ok((이번.match(/<a onclick="[^"]*"[^>]*><span class="wi">/g) || []).length >= 2, '꼬리 두 길(연습용 샘플·그대로 전달)의 글이 한 덩이(.wi)로 안 감싸였다');
});

test('★★ 꼭지 탭·꼭지 도구줄: 탭은 칸 바둑판, 짧은 이름은 폰에서만, 「모두 싣기·빼기·손으로 담기」는 한 줄', () => {
  const 칸수 = /\.jartabs\{[^}]*grid-template-columns:\s*repeat\((\d+),/.exec(폰);
  assert.ok(칸수 && Number(칸수[1]) >= 3, '꼭지 탭이 세 칸 이상 바둑판이 아니다 — 다섯 탭이 세 줄 이상이 된다');
  assert.match(폰, /\.jarhead \.tool\{[^}]*order:\s*\d+[^}]*flex:\s*1 1 0/, '도구 단추 셋이 한 줄에 나란히 서지 않는다');
  assert.match(폰, /\.jarhead::before\{[^}]*flex:\s*0 0 100%/, '이름·수·AI 단추 줄과 도구 줄을 가르는 막대가 없다');
  /* 짧은 이름 — 이름이 길 때만 .lg/.sh 로 가른다(같으면 갈라 그리지 않는다) */
  const 짐 = 화면올리기();
  const 탭줄 = 짐.꼭지탭줄(짐.지금회차());
  assert.match(탭줄, /<span class="lg">고용·노동정책 · 기업지원<\/span><span class="sh">고용·노동정책<\/span>/, '긴 이름의 꼭지가 긴 이름/짧은 이름으로 안 갈린다');
  assert.ok(!/<span class="lg">주간노동뉴스<\/span>/.test(탭줄), '이름이 같은 꼭지까지 둘로 갈랐다');
  assert.match(탭줄, /title="고용·노동정책 · 기업지원 — 실릴 것/, '원래 이름이 title 에 안 남는다');
});

test('★★ 기사 줄: 딱지는 «한 줄»(넘치면 …)이고, 한 줄로 줄이는 딱지의 전문은 title 에 있다', () => {
  assert.match(폰, /\.item \.wtag\{[^}]*max-width:\s*100%[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/, '딱지가 한 줄로 안 줄어든다 — 줄 하나가 네 줄 높이가 된다');
  assert.match(폰, /\.item \.wtag \.wl\{display:\s*none\}/, '딱지의 긴 꼬리(.wl)를 폰에서 접지 않는다');
  /* 전문이 어디엔가 있어야 한다 — 짧은 딱지(✎ 우리 말 있음)만 title 없이 둔다 */
  const 몸 = 함수몸(화면, '꼭지칸하나');
  const 딱지들 = 몸.match(/<span class="wtag[^"]*"[^>]*>[^<]*(?:<span class="wl">[^<]*<\/span>)?[^<]*<\/span>/g) || [];
  assert.ok(딱지들.length >= 3, '딱지를 못 찾았다 — 검사가 헛돈다');
  딱지들.forEach(function (t) {
    const 글 = t.replace(/<[^>]+>/g, '');
    if (글.length <= 12) return;
    assert.match(t, /\stitle="/, '★★ 긴 딱지에 title 이 없다 — 폰에서 …로 줄면 전문이 어디에도 없다: ' + 글);
  });
});

/* ══════ ⑤-2 받는 곳 머리 · 보낸 결과 머리 · 설정 ══════ */

test('★★ 받는 곳 머리: 작은 탭은 한 줄(짧은 이름), 그 밑에 [단추 · ⓘ · 설명] 한 줄, 거르개는 줄마다 끊긴다', () => {
  assert.match(폰, /#main \.subtabs\.bar::after\{[^}]*flex:\s*0 0 100%/, '작은 탭 줄과 단추 줄을 가르는 막대가 없다 — 탭 다섯이 단추와 한 줄에 섞인다');
  assert.match(폰, /#main \.subtabs\.bar>\.stat\{[^}]*flex:\s*1 1 \d+px/, '설명(.stat)이 «자리가 있으면 같은 줄, 없으면 아래 줄»이 아니다 — 0 폭으로 짜부라지거나 글이 잘린다');
  assert.match(폰, /#main \.chips \.sp1\{[^}]*flex:\s*0 0 100%/, '거르개 줄의 줄바꿈(.sp1)이 없다 — 명함 단추가 이름표와 갈라진다');
  assert.match(폰, /#main \.chips\.filt select\{[^}]*flex:\s*1 1 calc\(/, '지역 고르개 둘이 제 자리를 못 받는다 — 칩 옆에 20px 로 짜부라진다');
  /* 풀이(ⓘ)·내보내기 상자는 단추의 «오른쪽으로»/화면 폭에 맞춰 편다 — 폰에서는 단추가 왼쪽에 있어 옛 맞춤이면 화면 밖으로 나간다 */
  assert.match(폰, /\.tipwrap \.tip\{[^}]*position:\s*fixed[^}]*left:\s*\d+px[^}]*right:\s*\d+px/, 'ⓘ 풀이가 화면 폭에 맞춰 안 열린다 — 가장자리에서 잘린다');
  assert.match(폰, /#main \.menu \.pop\{left:\s*0;\s*right:\s*auto\}/, '내보내기 ▾ 풀이가 왼쪽으로 열려 화면 밖으로 나간다');
});

test('★★ 보낸 결과 머리: 회차 고르기+새로고침 한 줄, 숫자 칩은 바둑판, 폰에서는 붙이지 않는다', () => {
  assert.match(폰, /#main\[data-tab=res\] \.res-one::before\{[^}]*flex:\s*0 0 100%/, '회차 고르기 줄과 기준 시각 줄을 가르는 막대가 없다');
  assert.match(폰, /#main\[data-tab=res\] \.res-one>select\{[^}]*order:\s*1[;!][^}]*flex:\s*1 1 0/, '회차 고르개가 한 줄의 남는 자리를 안 쓴다 — 「1. 202」 로 잘린다');
  assert.match(폰, /#main\[data-tab=res\] \.res-one \.kpis\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(\d+,/, '숫자 칩이 바둑판이 아니다');
  assert.match(폰, /#main\[data-tab=res\] \.kpi\{[^}]*flex-direction:\s*column-reverse/, '숫자 칩에서 숫자가 라벨 «위»에 안 선다');
  assert.match(폰, /#main\[data-tab=res\] \.res-head\{position:\s*static/, '폰에서 보낸 결과 머리가 붙어 화면 위 1/4 을 가린다(원래도 폰에서는 앱바 뒤에 가려 안 붙었다)');
  /* 표 줄: 상태 칩이 업체 오른쪽에 서고 주소는 눌러야 보인다 */
  assert.match(폰, /#main\[data-tab=res\] tr:not\(\.open\)>td:nth-child\(4\)\{display:\s*none\}/, '보낸 결과 카드에서 주소가 안 접힌다');
});

test('★★ 설정: 라벨은 왼쪽·값은 오른쪽 «한 줄» — 긴 풀이는 한 줄로 접고 눌러서 편다', () => {
  assert.match(폰, /#main\[data-tab=cfg\] \.pad\.g2>div:has\(>label\.f\)\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\d+fr\) minmax\(0,\d+fr\)/,
    '설정 한 줄이 «라벨 | 값» 두 칸이 아니다 — 라벨이 위에 따로 서서 칸 하나가 두 줄 높이를 먹는다');
  assert.match(폰, /#main\[data-tab=cfg\] \.pad\.g2>div>label\.f\{[^}]*grid-column:\s*1[;}][^}]*grid-row:\s*1/, '라벨이 첫 칸 첫 줄에 안 선다');
  assert.match(폰, /#main\[data-tab=cfg\] \.pad\.g2>div>select,#main\[data-tab=cfg\] \.pad\.g2>div>input\[type=text\]\{[^}]*grid-column:\s*2[;}][^}]*grid-row:\s*1/,
    '값 칸(고르개·글 칸)이 라벨 «오른쪽 같은 줄»에 안 선다');
  assert.match(폰, /#main\[data-tab=cfg\] \.pad\.g2>div>\.hint\{[^}]*grid-column:\s*1\/-1/, '풀이 글이 칸 «아래 한 줄»(전체 폭)에 안 선다');
  /* 라벨과 칸이 «한 상자의 직계»인 줄만 바꾼다 — 천안 본사·서산지사(.offices)는 제 짜임이 있다 */
  assert.ok(!/#main\[data-tab=cfg\] \.pad\.g2>div\{[^}]*display:\s*grid/.test(폰), '모든 칸을 라벨-값 줄로 바꾼다 — 천안 본사·서산지사 주소 표가 망가진다');
  /* 바둑판 칸이 줄어들 수 있다 — 고르개의 글이 칸을 밀어 쪽이 옆으로 넘치던 것(실측 775px) */
  assert.match(꾸밈, /\.pad\.g2\{grid-template-columns:minmax\(0,1fr\)\}/, '설정 칸 바둑판이 줄어들 수 없다(1fr 은 minmax(auto,1fr)) — 고르개 글이 칸을 밀어 쪽이 옆으로 넘친다');
  /* 자료 자동 가져오기 줄도 상자 밖으로 안 나간다 */
  assert.match(폰, /#main\[data-tab=cfg\] \.arow2\{[^}]*flex-wrap:\s*wrap/, '자동 가져오기 현황 줄이 안 접힌다 — 상자 밖으로 넘친다');
});

test('★★ 지난 회차: 긴 안내는 한 줄로 접고, 미리보기 머리의 글자가 세로로 쪼개지지 않는다', () => {
  assert.match(폰, /#main\[data-tab=past\] \.note\[data-f1\]\{/, '지난 회차의 긴 안내를 접는 모양 규칙이 없다 — 한 화면을 차지한다');
  assert.match(폰, /#main\[data-tab=past\] \.note\[data-f1\]:not\(\.open\)::before\{content:/, '접힌 안내에 「ⓘ」 표시가 없다 — 눌러서 펴는 글인 줄 모른다');
  assert.match(폰, /#main\[data-tab=past\] \.pvhd\{[^}]*flex-wrap:\s*wrap/, '미리보기 머리가 안 접힌다 — 단추 글자가 세로로 쪼개진다');
  assert.match(폰, /#main\[data-tab=past\] \.pvhd \.mini\{[^}]*white-space:\s*nowrap/, '미리보기 단추 글자가 접힌다');
  assert.match(폰, /#main\[data-tab=past\] table\.list tr\.pick\.on/, '고른 회차가 카드에서 안 보인다(선택 표시)');
});

test('★ 접어 두었던 미리보기를 펼 때 틀을 다시 맞춘다 — 접힌 동안 폭이 0 이라 못 줄였다', () => {
  assert.match(함수몸(화면, '접이상자펴기'), /_편지맞추기\(\)/, '펴도 미리보기 틀(980px)을 안 줄인다 — 오른쪽으로 넘친다');
});

/* ══════ ⑥ 탭 줄 · 작은 탭 ══════ */

test('★★ 작은 탭: 폰에서는 짧은 이름 — 다섯이 한 줄에 서고, 원래 이름은 title 에 남는다', () => {
  const 짐 = 화면올리기();
  짐.App.tab = 'who';
  const 줄 = 짐.작은탭();
  assert.match(줄, /<span class="lg">받는 명단<\/span><span class="sh">명단<\/span>/, '받는 명단의 짧은 이름이 없다');
  assert.match(줄, /<span class="lg">주소 없는 곳<\/span><span class="sh">주소없음<\/span>/, '주소 없는 곳의 짧은 이름이 없다');
  assert.match(줄, /<span class="lg">해지한 곳<\/span><span class="sh">해지<\/span>/, '해지한 곳의 짧은 이름이 없다');
  assert.match(줄, /title="받는 명단[^"]*"/, '★★ 짧게 보이는 탭의 원래 이름이 title 에 없다');
  assert.match(줄, /title="주소 없는 곳[^"]*"/, '주소 없는 곳의 원래 이름이 title 에 없다');
  /* 이름이 같은(줄일 게 없는) 탭은 갈라 그리지 않는다 */
  assert.ok(!/<span class="lg">지인·잠재<\/span>/.test(줄), '줄일 게 없는 탭까지 둘로 갈랐다');
  assert.ok(!/<span class="lg">반송·거부<\/span>/.test(줄), '줄일 게 없는 탭까지 둘로 갈랐다');
  assert.match(폰, /#main \.subtabs button:not\(\.mini\):not\(\.btn\)\{[^}]*padding/, '작은 탭 단추가 폰에서 안 좁아진다 — 다섯이 한 줄에 안 들어간다');
});

test('★ 탭 이름표: 큰 탭·작은 탭 모두 원래 이름이 title·aria-label 에 달린다', () => {
  const 몸 = 함수몸(화면, '탭이름달기');
  assert.ok(몸, '탭이름달기 를 못 찾았다');
  assert.match(몸, /#tabs button/, '큰 탭을 안 본다');
  assert.match(몸, /\.subtabs button:not\(\.mini\):not\(\.btn\)/, '작은 탭을 안 본다 — 작은 탭 단추(다시 읽기 등)까지 이름표가 붙는다');
  assert.match(몸, /setAttribute\('aria-label'/, 'aria-label 을 안 단다');
  /* 이미 있는 title(짧은 이름 탭의 원래 이름)을 덮어쓰지 않는다 */
  assert.match(몸, /if\(!b\.getAttribute\('title'\)\)/, '짧은 이름 탭의 원래 이름(title)을 덮어쓴다 — 「받는 명단명단」이 된다');
});

/* ══════ ⑦ 표 칸 이름표(표라벨달기) ══════ */

/* 가짜 DOM — 표라벨달기 가 쓰는 만큼만(tagName·children·textContent·속성·querySelector·querySelectorAll) */
function 노드(tag, 글, 속성, 자식) {
  const n = { tagName: tag.toUpperCase(), children: 자식 || [], attrs: Object.assign({}, 속성 || {}), _글: 글 || '' };
  Object.defineProperty(n, 'textContent', { get() { return n._글 + n.children.map((c) => c.textContent).join(''); } });
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
  n.removeAttribute = (k) => { delete n.attrs[k]; };
  const 모두 = () => n.children.reduce((a, c) => a.concat([c], c.모두 ? c.모두() : []), []);
  n.모두 = 모두;
  n.querySelectorAll = (sel) => { const 태그 = sel.toUpperCase(); return 모두().filter((c) => c.tagName === 태그); };
  n.querySelector = (sel) => { const 태그들 = sel.toUpperCase().split(','); return 모두().find((c) => 태그들.indexOf(c.tagName) >= 0) || null; };
  return n;
}
const 머리칸 = (글, 속성) => 노드('th', 글, 속성);
const 값칸 = (글, 속성, 자식) => 노드('td', 글, 속성, 자식);

test('★★ 표라벨달기: 머리글 이름을 칸마다 달고(센 수는 뗀다), 빈 칸·조용한 칸에 표를 단다', () => {
  const 짐 = 화면올리기();
  /* ① thead 가 있는 표(받는 명단 꼴) */
  const 머리줄 = 노드('tr', '', {}, [머리칸('', { class: 'ck' }), 머리칸('#'), 머리칸('유형'), 머리칸('회사 164곳'), 머리칸('대표자 39'), 머리칸('담당자 203')]);
  const 줄1 = 노드('tr', '', {}, [값칸('', {}, [노드('input')]), 값칸('1'), 값칸('자문'), 값칸('가나상사'), 값칸('—'), 값칸('담당 홍길동')]);
  const 표1 = 노드('table', '', {}, [노드('thead', '', {}, [머리줄]), 노드('tbody', '', {}, [줄1])]);
  /* ② thead 가 없는 표(지난 회차·해지한 곳 꼴) — 머리글 줄이 첫 줄 */
  const 머리2 = 노드('tr', '', {}, [머리칸('#'), 머리칸('회차'), 머리칸('받는 곳')]);
  const 줄2 = 노드('tr', '', {}, [값칸('1'), 값칸('2026년 10월 2주차'), 값칸('표시 없음')]);
  const 줄3 = 노드('tr', '', {}, [값칸('읽는 중…', { colspan: '3' })]);
  /* 앞 칸이 둘을 먹는 줄 — 뒤 칸의 이름은 «셋째 열»이어야 한다(칸 수만큼 건너뛰지 않으면 이름이 밀린다) */
  const 줄4 = 노드('tr', '', {}, [값칸('합계', { colspan: '2' }), 값칸('5곳')]);
  const 표2 = 노드('table', '', {}, [노드('tbody', '', {}, [머리2, 줄2, 줄3, 줄4])]);
  const 루트 = { querySelectorAll: () => [표1, 표2] };
  짐.표라벨달기(루트);
  const 이름 = (줄) => 줄.children.map((c) => c.getAttribute('data-l'));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(이름(줄1))), [null, '#', '유형', '회사', '대표자', '담당자'], '머리글 이름이 칸마다 안 달린다(센 수는 떼야 한다)');
  assert.strictEqual(줄1.children[0].getAttribute('data-empty'), null, '☐ 칸(입력칸이 든 칸)을 «빈 칸»으로 접었다 — 고를 수 없게 된다');
  assert.strictEqual(줄1.children[4].getAttribute('data-empty'), '1', '「—」뿐인 칸을 카드에서 안 접는다 — 빈 줄이 쌓인다');
  assert.strictEqual(줄1.children[5].getAttribute('data-empty'), null, '값이 있는 칸을 접었다');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(이름(줄2))), ['#', '회차', '받는 곳'], 'thead 없는 표(머리글이 첫 줄)에서 이름이 안 달린다');
  assert.strictEqual(줄2.children[2].getAttribute('data-quiet'), '1', '「표시 없음」을 조용한 칸으로 안 단다 — 줄마다 되풀이되어 카드를 어지럽힌다');
  assert.strictEqual(줄2.children[1].getAttribute('data-quiet'), null, '값이 있는 칸을 조용한 칸으로 달았다');
  assert.strictEqual(줄3.children[0].getAttribute('data-l'), null, '한 줄 안내(colspan)에 칸 이름을 달았다');
  assert.strictEqual(줄4.children[0].getAttribute('data-l'), null, '칸을 합친(colspan) 칸에 엉뚱한 칸 이름을 달았다 — 합친 칸은 이름이 없다');
  assert.strictEqual(줄4.children[1].getAttribute('data-l'), '받는 곳', '칸을 합친 줄에서 뒤 칸의 이름이 밀렸다 — 합친 칸 수만큼 건너뛰어야 한다');
  /* 다시 불러도(표 몸통만 다시 그릴 때) 값이 바뀐 칸의 표시가 되돌아간다 */
  줄1.children[4]._글 = '김대표';
  짐.표라벨달기(루트);
  assert.strictEqual(줄1.children[4].getAttribute('data-empty'), null, '값이 채워졌는데 «빈 칸» 표시가 남는다');
});

test('★ 표 몸통만 다시 그리는 두 자리(지인·잠재 찾기 · 주소 없는 곳 찾기)에서도 이름표를 다시 단다', () => {
  assert.match(함수몸(화면, '지인표다시그리기'), /jnBody[\s\S]{0,60}?innerHTML[^;]*;\s*표라벨달기\(\)/, '지인·잠재 표를 다시 그려도 이름표가 안 달린다 — 새 줄이 이름표 없는 카드가 된다');
  assert.match(함수몸(화면, '빈곳찾기'), /naBody[\s\S]{0,60}?innerHTML[^;]*;\s*표라벨달기\(\)/, '주소 없는 곳 표를 다시 그려도 이름표가 안 달린다');
});

/* ══════ ⑧ CSS ↔ 마크업 ↔ 본 스크립트의 «짝» ══════ */

test('★★ CSS 가 겨냥하는 «탭 열쇠»는 실제 탭이다 — 오타 하나로 규칙이 조용히 안 걸리는 것을 막는다', () => {
  const 쓴 = [...new Set([...꾸밈.matchAll(/#main(?::is\()?\[data-tab=([a-z]+)\]/g)].map((m) => m[1]))];
  assert.ok(쓴.length >= 6, '탭별 규칙을 거의 못 찾았다 — 검사가 헛돈다');
  쓴.forEach((k) => assert.ok(탭열쇠들.indexOf(k) >= 0, '★★ CSS 의 [data-tab=' + k + '] 는 없는 탭이다(오타) — 그 규칙은 영영 안 걸린다'));
  /* :is([data-tab=…],…) 로 묶은 것도 같다 */
  [...꾸밈.matchAll(/:is\(([^)]*)\)/g)].forEach((m) => [...m[1].matchAll(/\[data-tab=([a-z]+)\]/g)].forEach((x) =>
    assert.ok(탭열쇠들.indexOf(x[1]) >= 0, '★★ :is(…) 안의 [data-tab=' + x[1] + '] 는 없는 탭이다(오타)')));
  /* 그리고 render() 가 그 열쇠를 #main 에 «적는다» */
  assert.match(함수몸(화면, 'render'), /m\.dataset\.tab\s*=\s*App\.tab/, '★★ render() 가 #main 에 data-tab 을 안 적는다 — 탭별 폰 규칙이 전부 안 걸린다');
});

test('★★ render() 는 어느 탭에서나 #main 의 data-tab 을 그 탭 열쇠로 적는다', () => {
  const 짐 = 화면올리기();
  assert.ok(탭열쇠들.length >= 8, '탭 열쇠를 못 읽었다');
  탭열쇠들.forEach(function (k) {
    짐.App.tab = k;
    try { vm.runInContext('render()', 짐); } catch (e) { /* 이 틀에서 못 그리는 화면이 있어도 data-tab 은 그리기 «전에» 적힌다 */ }
    assert.strictEqual(짐.요소들.main.dataset.tab, k, k + ' 탭에서 data-tab 이 적히지 않았다');
  });
});

test('★★ CSS 가 쓰는 이름(클래스)이 마크업에 «있다» — 이름 하나 어긋나면 그 규칙은 조용히 안 걸린다', () => {
  /* [CSS 에서 겨냥하는 클래스, 그것을 그리는 함수] */
  const 짝 = [
    ['look', '이번회차화면'], ['redo', '이번회차화면'], ['test', '이번회차화면'], ['rsv', '이번회차화면'],
    ['mid', '이번회차화면'], ['tool', '꼭지칸하나'], ['wl', '꼭지칸하나'], ['ful', '꼭지칸하나'],
    ['lg', '작은탭'], ['sh', '작은탭'], ['lg', '꼭지이름'], ['sh', '꼭지이름'], ['lg', '지난회차화면'], ['sh', '지난회차화면'],
    ['dropbox', '안내빈화면'], ['phfold', '안내빈화면']
  ];
  짝.forEach(function ([클래스, 함수]) {
    const 몸 = 함수몸(화면, 함수);
    assert.ok(몸, 함수 + ' 를 못 찾았다');
    assert.match(몸, new RegExp('class="[^"]*\\b' + 클래스 + '\\b'), '★★ ' + 함수 + ' 가 .' + 클래스 + ' 를 안 그린다 — 폰 CSS 가 그 이름을 겨냥한다');
    assert.match(꾸밈, new RegExp('\\.' + 클래스 + '\\b'), '★ CSS 가 .' + 클래스 + ' 를 안 쓴다 — 마크업의 이름이 군더더기다');
  });
});

test('★★ 마크업의 긴 말(.lg)에는 늘 짧은 말(.sh)이 짝으로 있다 — 폰에서 이름이 통째로 사라지지 않게', () => {
  ['작은탭', '꼭지이름', '지난회차화면'].forEach(function (함수) {
    const 몸 = 함수몸(화면, 함수);
    const 긴 = (몸.match(/class="lg"/g) || []).length, 짧 = (몸.match(/class="sh"/g) || []).length;
    assert.ok(긴 >= 1 && 긴 === 짧, '★★ ' + 함수 + ' 의 긴 말(' + 긴 + ')과 짧은 말(' + 짧 + ')이 짝이 아니다');
  });
});

test('★ 지난 회차 줄을 누르면 «미리보기가 불러와진 뒤» 그 자리로 내려간다 — 붙는 상자라 scrollIntoView 를 못 쓴다', () => {
  const 보기 = 함수몸(화면, '회차보기'), 내림 = 함수몸(화면, '미리보기로내려가기'), 그림 = 함수몸(화면, '지난미리보기그리기');
  assert.ok(보기 && 내림 && 그림, '회차보기·미리보기로내려가기·지난미리보기그리기 중 하나를 못 찾았다');
  assert.ok(!/scrollIntoView/.test(보기 + 내림), '★★ scrollIntoView 를 썼다 — 붙는(sticky) 상자에서는 엉뚱한 자리(실측 44px)로 간다');
  assert.match(내림, /matchMedia\('\(max-width:980px\)'\)/, '폭이 넓을 때(미리보기가 옆에 있을 때)도 쪽을 굴린다');
  assert.match(내림, /--tophi/, '붙은 머리 높이를 «재서» 뺀다 — 안 빼면 미리보기 위가 탭 밑에 깔린다');
  assert.match(보기, /미리보기로내려가기\(\)/, '줄을 눌러도 안 내려간다 — 눌러도 아무 일 없는 것처럼 보인다');
  assert.match(그림, /f\.onload[\s\S]*미리보기로내려가기\(\)/, '틀이 불러와진 뒤 다시 안 내려간다 — 불러오기 전에는 쪽이 짧아 가다가 멈춘다(44px)');
  assert.match(그림, /Date\.now\(\) - App\._내려갈때 < \d+/, '오래된 눌림에도 끌려 내려간다 — 딴 데를 보고 있는데 끌어온다');
});
