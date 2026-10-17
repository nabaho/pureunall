/* 계약서등관리 — 폰 한눈에 (대표 지시 2026-10-17)
 *
 * 「항상 폰에서 자유롭게 사업장 바로 계약서나 견적서를 보낼 수 있게 해야 되는데,
 *   지금 폰 화면은 직접 보기 좀 힘들다 … 폰 화면 한눈에 볼 수 있게 깔끔하게 모두 정리해달라」
 *
 * ★ 대표 캡처(411px)에서 실제로 보인 것
 *   ① 양식 목록 표가 옆으로 밀렸다 — 페이지의 `table{min-width:640px}`(위임장 사건표용)가
 *      양식 목록에까지 걸려 이름이 잘리고 「원본」 칸이 화면 밖으로 나갔다(아래 가로 스크롤바)
 *   ② 목록이 40vh 상자 안에서 한 번, 페이지에서 또 한 번 굴렀다
 *   ③ 줄을 눌러도 「📝 찾아서 채우기」가 목록 밑 화면 밖에 있어 아무 일도 안 난 것처럼 보였다
 *   ④ 채우기 창 아래 단추 줄이 한 줄로 넘쳐 왼쪽 단추(닫기·본문 복사·미리보기)가 잘려 못 눌렀다
 *   ⑤ 메뉴 줄이 옆으로 밀리고(「🗂 사무관리서류」 이름표), 그 아래 경로줄이 같은 말을 또 했다
 *
 * ★ 무엇을 못 박나 — 픽셀값이 아니라 «규칙»
 *   폰(700px 아래)에서: 목록 표는 화면 폭에 맞는다 · 목록은 페이지 하나로만 구른다 ·
 *   고른 양식 막대는 화면에 붙어 늘 보인다 · 창의 단추는 감겨서 모두 보인다 ·
 *   폰에서 숨긴 단추는 ⋯ 안에 같은 일이 있다 · 넓은 화면은 그대로다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const JS = read('js/pu-contract-forms.js');
const HTML = read('docs-esign.html');

/* 모듈 CSS — 이어 붙인 글자 식을 그대로 계산한다(주석·줄바꿈이 섞여 있어 글자로 자르면 틀린다) */
function moduleCss() {
  const m = JS.match(/var CSS = ('' *\n[\s\S]*?);\n\n {2}var _toastT/);
  assert.ok(m, 'js/pu-contract-forms.js 에서 CSS 묶음(var CSS = …;)을 못 찾았습니다 — 이 검사의 찾는 법을 고쳐 주세요');
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
    if (+m[1] <= 760) phone += css.slice(re.lastIndex, j - 1) + '\n'; else wide += css.slice(m.index, j);
    i = j; re.lastIndex = j;
  }
  wide += css.slice(i);
  return { phone, wide: wide.replace(/@media[^{]*\{[^{}]*(\{[^}]*\}[^{}]*)*\}/g, '') };
}
const M = split(moduleCss());
const pageStyle = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const P = split(pageStyle.replace(/\/\*[\s\S]*?\*\//g, ''));
const rule = (css, sel) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&');
  return (css.match(new RegExp('(?:^|[}\\s,])' + esc + '\\{([^}]*)\\}', 'g')) || []).join(' ');
};

test('① 폰에서 양식 목록 표는 화면 폭에 맞는다 — 페이지의 표 최소폭이 양식 목록에 걸리지 않는다', () => {
  const pageForcesTables = /(^|[}\s])table\{[^}]*min-width\s*:\s*[1-9]/.test(P.phone);
  if (pageForcesTables) {
    assert.match(rule(M.phone, '.pcf-lt'), /min-width:0/,
      '★ docs-esign.html 폰 구간이 모든 표에 최소폭을 거는데, 양식 목록(.pcf-lt)이 그것을 풀지 않습니다 — 이름이 잘리고 「원본」 칸이 화면 밖으로 밀립니다(대표 캡처 2026-10-17)');
  }
});

test('② 폰에서 목록은 페이지 하나로만 구른다 — 목록 상자 안 스크롤을 푼다', () => {
  const lb = rule(M.phone, '.pcf-lbody');
  assert.match(lb, /max-height:none/, '폰에서 목록 상자(.pcf-lbody)에 높이 한도가 남아 있습니다 — 상자 안에서 한 번, 페이지에서 또 한 번 굴러야 합니다');
  assert.match(lb, /overflow:visible/, '폰에서 목록 상자가 제 몸 안에서 구릅니다');
  /* 넓은 화면은 그대로 — 목록 칸 안에서 구르는 것이 맞다 */
  assert.match(rule(M.wide, '.pcf-lbody'), /overflow-y:auto/, '넓은 화면의 목록 칸 스크롤까지 풀렸습니다 — 폰 구간에서만 풉니다');
});

test('③ 폰에서 고른 양식 막대(📝 찾아서 채우기)는 화면에 붙어 늘 보인다', () => {
  assert.match(rule(M.phone, '.pcf-vp'), /display:contents/,
    '★ .pcf-vp 를 contents 로 풀지 않으면 막대가 목록 칸까지 따라 붙지 못합니다(sticky 는 부모 상자 밖으로 못 나간다)');
  const top = rule(M.phone, '.pcf-vp .pcf-top');
  assert.match(top, /position:sticky/, '폰에서 고른 양식 막대가 붙지 않습니다 — 줄을 눌러도 단추가 화면 밖입니다');
  assert.match(top, /bottom:\d/, '목록을 볼 때 막대가 화면 아래에 붙어야 합니다');
  /* sticky 는 «구르는 조상»이 있으면 그 안에서만 붙는다 — 폰에서 양식 칸 상자의 옆 스크롤을 풀어야 산다 */
  assert.match(rule(P.phone, '#paneForms .card'), /overflow:visible/,
    '★ 폰에서 .card{overflow-x:auto} 가 양식 칸에도 걸려 있으면 막대가 화면이 아니라 상자에 붙어 안 보입니다');
  /* 넓은 화면은 그대로 */
  assert.doesNotMatch(rule(M.wide, '.pcf-vp'), /display:contents/, '넓은 화면의 보기 칸까지 풀었습니다');
});

test('③-2 폰에서 숨긴 막대 단추는 ⋯ 안에 같은 일이 있다 — 숨겨서 못 하게 되는 일이 없다', () => {
  const at = JS.indexOf('function toolbar(fm)');
  assert.ok(at >= 0, 'toolbar 함수를 못 찾았습니다');
  const body = JS.slice(at, JS.indexOf('function printBlank(', at));
  assert.match(M.phone, /\.pcf-top \.pcf-printb\{display:none/, '폰 막대에서 옆 단추를 숨기지 않으면 한 줄에 안 들어갑니다');
  const hidden = [...body.matchAll(/'class': 'pcf-printb'[^}]*text: '([^']+)'/g)].map((x) => x[1]);
  assert.ok(hidden.length >= 1, '막대의 옆 단추(pcf-printb)를 못 찾았습니다 — 이 검사의 찾는 법을 고쳐 주세요');
  hidden.forEach((t) => assert.ok(new RegExp("t: '" + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "', cls: 'pcf-mob'").test(body),
    '「' + t + '」 를 폰에서 숨겼는데 ⋯ 안에 폰 줄(pcf-mob)이 없습니다 — 폰에서 그 일을 할 길이 사라집니다'));
  assert.match(rule(M.wide, '.pcf-menu .pcf-mob'), /display:none/, '넓은 화면 ⋯ 에 폰 전용 줄이 겹쳐 보입니다');
  assert.match(rule(M.phone, '.pcf-menu .pcf-mob'), /display:block/, '폰 ⋯ 에서 폰 전용 줄이 안 보입니다');
});

test('③-3 ⋯ 메뉴는 아래가 좁으면 위로 열린다 — 화면 아래에 붙은 막대에서 밖으로 안 나간다', () => {
  assert.match(JS, /classList\.toggle\('up',[^)]*innerHeight/, '⋯ 메뉴가 열 방향을 «남은 자리»로 고르지 않습니다');
  assert.match(rule(M.wide, '.pcf-menu.up'), /bottom:/, '.pcf-menu.up 이 위로 열지 않습니다');
});

test('④ 폰에서 창(채우기·보내기)의 단추는 감겨서 모두 보이고, 보내기가 맨 위 한 줄이다', () => {
  assert.match(rule(M.phone, '.pcf-mf'), /flex-wrap:wrap/,
    '★ 폰에서 창 아래 단추 줄이 감기지 않습니다 — 넘친 왼쪽 단추가 잘려 못 누릅니다(2026-10-17)');
  const go = rule(M.phone, '.pcf-mf .pcf-go');
  assert.match(go, /order:-/, '보내기 단추가 맨 앞으로 오지 않습니다');
  assert.match(go, /flex-basis:100%/, '보내기 단추가 한 줄 전체가 아닙니다');
  /* 채우기 창 «메일로 보내기» 와 보내기 확인 창 «보내기» 가 주 단추로 표시돼 있어야 위 규칙이 산다 */
  assert.match(JS, /'pcf-b pcf-go'[^}]*메일로 보내기/, '채우기 창의 「메일로 보내기」에 주 단추 표시(pcf-go)가 없습니다');
  assert.match(JS, /btnSend = el\('button', \{[^}]*'pcf-b pcf-go'/, '보내기 확인 창의 「보내기」에 주 단추 표시(pcf-go)가 없습니다');
});

test('⑤ 폰 메뉴 줄 — 묶음 이름표·경로줄을 빼고 옆으로 밀지 않는다 (넓은 화면은 그대로)', () => {
  assert.match(rule(P.phone, '.nav-grp,.nav-chev'), /display:none/, '폰에서 「🗂 사무관리서류」 이름표가 메뉴 줄 자리를 먹습니다');
  assert.match(rule(P.phone, '.crumb'), /display:none/, '폰에서 경로줄이 바로 위 메뉴와 같은 말을 또 합니다');
  assert.doesNotMatch(rule(P.wide, '.nav-grp'), /display:none/, '넓은 화면의 묶음 이름표까지 숨겼습니다');
  assert.doesNotMatch(rule(P.wide, '.crumb'), /display:none/, '넓은 화면의 경로줄까지 숨겼습니다');
});

test('⑥ 목록 이름 칸(td)에 flex 를 걸지 않는다 — 표 칸이 깨져 고른 줄 바탕·줄 선이 어긋난다', () => {
  const all = M.wide + M.phone;
  assert.doesNotMatch(all, /\.pcf-lnm\{[^}]*display:flex/, '★ td.pcf-lnm 에 display:flex 가 걸렸습니다 — 안쪽 div(.pcf-l1)가 한 줄을 맡습니다');
  assert.match(JS, /el\('td', \{ 'class': 'pcf-lnm' \}, \[el\('div', \{ 'class': 'pcf-l1' \}/, '이름 칸 안에 한 줄 상자(.pcf-l1)가 없습니다');
});

test('⑦ 폰에서도 고르기 칸 + 번호는 그대로 — 손가락으로 누를 만큼 넉넉하게 (CLAUDE.md 2026-10-05)', () => {
  assert.doesNotMatch(M.phone, /\.pcf-lc\{[^}]*display:none/, '폰에서 고르기 칸을 숨겼습니다');
  assert.doesNotMatch(M.phone, /\.pcf-ln2\{[^}]*display:none/, '폰에서 번호 칸을 숨겼습니다');
  const ck = rule(M.phone, '.pcf-lt .pcf-lc input');
  const px = +((ck.match(/width:(\d+)px/) || [])[1] || 0);
  assert.ok(px >= 18, '폰 고르기 칸이 손가락으로 누르기에 작습니다 (지금 ' + (px || '기본') + ')');
});
