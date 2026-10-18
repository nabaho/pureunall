/* 기업별 계약서 — 폰 한눈에 (대표 2026-10-18 「UI 가 너무 아래까지 내려온다. 이 부분 깔끔하게 정리」)
 *
 * ★ 대표 폰 캡처에서 실제로 보인 것
 *   ① 한 회사를 보려면 1,700px 를 내려가야 했다 — 칩 세 줄 · 회사 줄 세 줄 · 회사 목록 상자(30vh) ·
 *      갈래 카드 · 계약 기록 표 · 계약서 파일 표. 같은 계약이 «세 번» 나왔다(갈래 카드·기록 표·파일 표)
 *   ② 갈래 카드 오른쪽 「✓ 서명본」·「+ 기록 만들기」가 잘렸다 — grid 칸이 줄 글자(nowrap)만큼 넓어졌다.
 *      ★ PC 에서도 같은 까닭으로 상태·단추가 안 보이고 있었다
 *   ③ 계약 기록 표는 「금액」 대신 「지급일·EDI」가 보였다 — 다섯째 칸을 숨기는 옛 규칙이 엉뚱한 표에 걸렸다
 *   ④ 계약서 파일 표는 페이지의 table{min-width:640px} 때문에 제목만 보이고 계약일·📥 는 옆으로 밀렸다
 *
 * ★ 무엇을 못 박나 — 픽셀값이 아니라 «규칙»
 *   폰(700px 아래)에서: 회사 목록은 접혀 있다가 「회사 바꾸기」·칩으로 펼친다 · 표는 접혀 있다가 건수로 펼친다 ·
 *   펼친 표는 화면 폭에 맞는다 · ☐·번호는 그대로 · 숨긴 단추는 다른 길이 있다 · 넓은 화면은 그대로다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const JS = read('js/pu-office-docs.js');
const HTML = read('docs-esign.html');

/* 모듈 CSS — 이어 붙인 글자 식을 그대로 계산한다(주석이 섞여 있어 글자로 자르면 틀린다) */
function moduleCss() {
  const m = JS.match(/var CSS = ('' *\n[\s\S]*?);\n {2}function css\(\)/);
  assert.ok(m, 'js/pu-office-docs.js 에서 CSS 묶음(var CSS = …; function css())을 못 찾았습니다 — 이 검사의 찾는 법을 고쳐 주세요');
  return new Function('return ' + m[1])();
}
/* «폰» 구간 — max-width 가 760px 이하인 @media 덩어리만 모은다(괄호 짝을 세어 자른다) */
function split(css) {
  let phone = '', wide = '', i = 0;
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    wide += css.slice(i, m.index);
    let d = 1, j = re.lastIndex;
    for (; j < css.length && d; j++) { if (css[j] === '{') d++; else if (css[j] === '}') d--; }
    if (+m[1] <= 760) phone += css.slice(re.lastIndex, j - 1) + '\n';
    i = j; re.lastIndex = j;
  }
  wide += css.slice(i);
  return { phone, wide };
}
const M = split(moduleCss());
const P = split(((HTML.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '').replace(/\/\*[\s\S]*?\*\//g, ''));
const rule = (css, sel) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\#:]/g, '\\$&');
  return (css.match(new RegExp('(?:^|[}\\s,])' + esc + '\\{([^}]*)\\}', 'g')) || []).join(' ');
};
const coPane = (() => {
  const a = JS.indexOf('function mountCompanies(');
  assert.ok(a >= 0, 'mountCompanies 를 못 찾았습니다');
  return JS.slice(a, JS.indexOf('function drawDocPreview(', a));
})();

test('② 갈래 카드 줄 글자가 카드를 넓히지 않는다 — 오른쪽 상태·단추가 잘리지 않는다 (PC·폰 모두)', () => {
  assert.match(rule(M.wide, '.pod-kbox'), /grid-template-columns:minmax\(0,\s*1fr\)/,
    '★ .pod-kbox 가 그냥 grid 면 칸이 줄 글자(nowrap)만큼 넓어져 「✓ 서명본」·「+ 기록 만들기」가 잘립니다(대표 캡처 2026-10-18 · PC 도 같았다)');
});

test('① 폰에서 회사 목록은 접혀 있다 — 「회사 바꾸기」·칩으로 펼치고, 고르면 접힌다', () => {
  assert.match(M.phone, /\.pod-co:not\(\.pick\) \.pod-co-l\{display:none/, '폰에서 회사 목록이 늘 펼쳐져 첫 화면을 먹습니다');
  assert.doesNotMatch(M.wide, /\.pod-co:not\(\.pick\)/, '넓은 화면의 회사 목록까지 접었습니다 — 왼쪽 목록은 늘 보여야 합니다');
  assert.match(coPane, /'class': 'pod-co' \+ \(S\.pickOpen \? ' pick' : ''\)/, '목록 펼침 상태가 .pod-co 에 안 붙습니다');
  assert.match(coPane, /'pod-b pod-pickbtn'[^]*?onclick: function \(\) \{ S\.pickOpen = !S\.pickOpen; draw\(\); \}/, '「회사 바꾸기」 단추가 목록을 여닫지 않습니다');
  assert.match(rule(M.wide, '.pod-pickbtn,.pod-ftog'), /display:none/, '넓은 화면에 폰 전용 단추(회사 바꾸기·표 펼치기)가 보입니다');
  assert.match(coPane, /S\.sel = c\.key; S\.pickOpen = false;/, '회사를 골라도 목록이 안 접힙니다 — 고른 회사 내용이 목록 밑에 묻힙니다');
  /* 칩으로 거르면 걸러진 회사 목록을 «보여 줘야» 한다 — 접힌 채면 칩을 눌러도 아무 일이 없어 보인다 */
  const chips = coPane.slice(coPane.indexOf('function kindChips('), coPane.indexOf('function recForDoc('));
  assert.ok((chips.match(/S\.pickOpen = true/g) || []).length >= 2, '갈래·대조 칩을 눌러도 회사 목록이 안 펼쳐집니다');
});

test('④ 폰에서 계약 기록·계약서 파일 표는 접어 두고 건수로 펼친다 (넓은 화면은 늘 펼침)', () => {
  assert.match(M.phone, /\.pod-fold:not\(\.open\) \.pod-fbody\{display:none/, '폰에서 표를 접지 않습니다 — 같은 계약이 갈래 카드·기록 표·파일 표에 세 번 나옵니다');
  assert.doesNotMatch(M.wide, /\.pod-fold:not\(\.open\)/, '넓은 화면의 표까지 접었습니다');
  assert.match(coPane, /foldBtn\('recs', S\.recs\.length/, '계약 기록 머리에 건수 펼치기 단추가 없습니다');
  assert.match(coPane, /foldBtn\('docs', S\.docs\.length/, '계약서 파일 머리에 건수 펼치기 단추가 없습니다');
  assert.match(coPane, /'class': 'pod-rt pod-recs pod-fbody'/, '계약 기록 표가 접히는 몸통(pod-fbody)이 아닙니다');
  assert.match(coPane, /var grid = el\('div', \{ 'class': 'pod-fbody' \}/, '계약서 파일 표가 접히는 몸통(pod-fbody)이 아닙니다');
  /* 접어도 «보내기»는 남는다 — 이 화면의 주 용도(사업장에 바로 보내기, 대표 2026-10-17) */
  const docsHead = coPane.slice(coPane.indexOf("foldBtn('docs'"), coPane.indexOf("foldBtn('docs'") + 400);
  assert.match(docsHead, /✉ 파일 골라 보내기/, '계약서 파일을 접으면 「✉ 파일 골라 보내기」까지 사라집니다 — 머리줄에 둡니다');
  /* 펼침 기억이 막혀도(사생활 창 등) 단추는 돈다 */
  assert.match(coPane, /S\.open\[k\] = !open; try \{ w\.localStorage\.setItem/, '펼침을 기기에 못 적으면 단추가 안 듭니다 — 화면 상태(S.open)를 먼저 바꿉니다');
});

test('③④ 폰에서 펼친 표는 화면 폭에 맞고, 보여야 할 칸이 보인다', () => {
  if (/(^|[}\s])table\{[^}]*min-width\s*:\s*[1-9]/.test(P.phone)) {
    assert.match(rule(M.phone, '.pod-co .pod-rt'), /min-width:0/,
      '★ docs-esign.html 폰 구간이 모든 표에 최소폭을 거는데 기업별 계약서 표가 풀지 않습니다 — 계약일·📥 가 옆으로 밀립니다');
  }
  assert.match(M.phone, /\.pod \.pod-recs td:nth-child\(5\)\{display:table-cell/, '★ 계약 기록 표에서 「금액」(다섯째 칸)이 옛 규칙에 숨겨집니다');
  assert.match(M.phone, /\.pod \.pod-recs td:nth-child\(n\+6\)\{display:none/, '폰 계약 기록 표가 지급일·담당·출처까지 펼쳐 화면을 넘습니다');
  assert.match(coPane, /'class': 'pod-rt pod-docs'/, '계약서 파일 표에 폰 규칙(pod-docs)이 안 걸립니다');
  assert.match(M.phone, /\.pod-docs \.pod-ed\{display:none/, '폰 파일 표의 ✏ 를 숨기지 않으면 한 줄에 안 들어갑니다');
  /* ✏ 를 숨겨도 고칠 길은 남는다 — 줄을 누르면 여는 미리보기 머리에 ✏ 가 있다 */
  const prev = JS.slice(JS.indexOf('function drawDocPreview('), JS.indexOf('function drawDocPreview(') + 1500);
  assert.match(prev, /text: '✏', onclick: function \(\) \{ openDoc\(d\); \}/, '★ 파일 표의 ✏ 를 숨겼는데 미리보기에도 ✏ 가 없습니다 — 폰에서 고칠 길이 사라집니다');
});

test('⑤ 폰에서도 ☐ 고르기 칸 + 번호는 그대로 (CLAUDE.md 2026-10-05)', () => {
  ['pod-recs', 'pod-docs'].forEach((t) => {
    assert.doesNotMatch(M.phone, new RegExp('\\.' + t + ' t[hd]:nth-child\\((1|2)\\)\\{display:none'), t + ' 의 고르기 칸·번호를 폰에서 숨겼습니다');
    assert.doesNotMatch(M.phone, new RegExp('\\.' + t + ' t[hd]:nth-child\\(n\\+[12]\\)'), t + ' 의 첫 두 칸까지 숨기는 규칙입니다');
  });
});

test('⑥ 폰 한 줄 정리 — 칩은 한 줄, 회사 줄은 한 줄(숨긴 글자는 단추 이름표로 남는다)', () => {
  assert.match(rule(M.phone, '.pod-kchips'), /flex-wrap:nowrap/, '폰에서 갈래 칩이 여러 줄로 쌓입니다');
  assert.match(rule(M.phone, '.pod-kchips'), /overflow-x:auto/, '한 줄로 둔 칩을 옆으로 밀 수 없습니다');
  assert.match(M.phone, /\.pod-cohd\{flex-wrap:nowrap/, '폰에서 회사 줄이 여러 줄로 쌓입니다');
  assert.match(coPane, /'aria-label': '다른 회사를 여기로 합치기'/, '「다른 회사를 여기로」 글자를 숨겼는데 단추 이름(aria-label)이 없습니다 — 🔗 만 남아 무슨 단추인지 모릅니다');
});

test('⑦ 폰에서 회사를 바꾸거나 파일을 누르면 그 자리로 데려간다 — 눌러도 화면이 그대로인 일이 없다', () => {
  assert.match(coPane, /if \(isPhone\(\)\) \{[^}]*cohd\.scrollIntoView/, '회사를 골라도 화면이 목록 밑에 머뭅니다');
  assert.match(coPane, /prev\.scrollIntoView/, '파일 줄을 눌러도 맨 아래 미리보기로 안 갑니다');
  assert.match(coPane, /matchMedia\('\(max-width:700px\)'\)/, '폰 판단이 CSS 폰 구간(700px)과 다릅니다');
});
