/* 계약서등관리 — 폰에서 «누를 것»이 손가락으로 눌리는가 (대표 지시 2026-10-18 「폰화면관리」)
 *
 * ★ 가짜 자료로 폰(360·411px)에서 다시 재 보니 (어제 2026-10-17 폰 정리 뒤 남은 흠)
 *   ① 채우기·보내기·서명 창의 «×» 닫기가 글자 하나 폭(12×23px)이었다 — 손가락이 옆 제목을 눌렀다
 *   ② 양식 목록 ☐(20px)·채울 자리 ☐(18px)가 손끝보다 작았다 — 「작은단추」 8건이 전부 이것
 *   ③ 집단체불 사건 목록의 「🔗 링크」 단추가 좁은 칸에서 두 줄로 접혔다(56×53px)
 *
 * ★ 무엇을 못 박나 — 지금 px 이 아니라 규칙
 *   · 폰 구간에서 창 닫기 단추(aria-label 닫기)는 누르는 자리를 넓힌다 — 그리고 «모든» 창의 × 가 그 이름표를 단다
 *   · 폰 고르기 칸은 누를 수 있는 최소 크기(WCAG 2.5.8 «최소 24px» — 그 수 자체가 규칙이다) 이상
 *   · 채울 자리 표의 첫 칸(☐ 자리)은 ☐ 보다 좁지 않다(☐ 를 키우고 칸을 안 넓히면 옆 번호를 덮는다)
 *   · 사건 목록 단추 글자는 한 줄
 *   ⚠ 넓은 화면은 그대로 — 모두 폰 구간(700px 아래)에서만 바꾼다
 *
 * 실행: node --test tests/docs-phone-taps.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const JS = read('js/pu-contract-forms.js');
const HTML = read('docs-esign.html');
const MIN_TAP = 24;   // WCAG 2.5.8 «누를 것의 최소 크기» — 이 수 자체가 규칙이다(지금 값이 아니다)

/* 모듈 CSS — 이어 붙인 글자 식을 그대로 계산한다 */
function moduleCss() {
  const m = JS.match(/var CSS = ('' *\n[\s\S]*?);\n\n {2}var _toastT/);
  assert.ok(m, 'js/pu-contract-forms.js 에서 CSS 묶음(var CSS = …;)을 못 찾았습니다 — 이 검사의 찾는 법을 고쳐 주세요');
  return new Function('return ' + m[1])();
}
/* «폰» 구간 — max-width 가 760px 이하인 @media 덩어리만 모은다(괄호 짝을 세어 자른다) */
function phoneOf(css) {
  let phone = '';
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let d = 1, j = re.lastIndex;
    for (; j < css.length && d; j++) { if (css[j] === '{') d++; else if (css[j] === '}') d--; }
    if (+m[1] <= 760) phone += css.slice(re.lastIndex, j - 1) + '\n';
    re.lastIndex = j;
  }
  return phone;
}
const MP = phoneOf(moduleCss());
const PP = phoneOf(((HTML.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '').replace(/\/\*[\s\S]*?\*\//g, ''));
/* 선택자에 «꼭 맞는» 규칙 몸통들(여러 번 적혀 있으면 이어 붙인다) */
function bodyOf(css, test) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((r) => r[1].split(',').some((s) => test(s.trim()))).map((r) => r[2]).join(';');
}
const px = (body, prop) => { const m = body.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*(\\d+(?:\\.\\d+)?)px')); return m ? +m[1] : 0; };

test('① 폰에서 창 «×» 닫기는 누르는 자리를 넓힌다 — 그리고 모든 창의 × 가 그 이름표(닫기)를 단다', () => {
  const b = bodyOf(MP, (s) => /^\.pcf-mh\s*>?\s*button\[aria-label="?닫기"?\]$/.test(s));
  assert.ok(b, '폰 구간에 창 닫기 단추(.pcf-mh button[aria-label=닫기]) 규칙이 없습니다 — × 가 글자 하나 폭으로 돌아갑니다');
  assert.ok(px(b, 'min-width') >= MIN_TAP && px(b, 'min-height') >= MIN_TAP, '창 닫기 단추의 누르는 자리가 ' + MIN_TAP + 'px 보다 작습니다');
  /* 창 머리의 × (class 없는 맨 단추) — 첨부 빼기 같은 표 안의 × (class pcf-b)는 창 닫기가 아니다 */
  const xs = [...JS.matchAll(/el\('button', \{([^}]*)text: '×'/g)].map((m) => m[1]).filter((a) => !/'class'/.test(a));
  assert.ok(xs.length >= 3, '창의 × 단추를 못 찾음 — 이 검사의 찾는 법을 고쳐 주세요');
  xs.forEach((a) => assert.match(a, /'aria-label': '닫기'/, '이름표(aria-label 닫기)가 없는 × 단추가 있습니다 — 폰에서 그 창만 × 가 작게 남습니다'));
});

test('② 폰 고르기 칸(양식 목록 ☐ · 채울 자리 ☐)은 손가락으로 누를 최소 크기 이상', () => {
  const list = bodyOf(MP, (s) => s === '.pcf-lt .pcf-lc input');
  assert.ok(px(list, 'width') >= MIN_TAP && px(list, 'height') >= MIN_TAP, '양식 목록 ☐ 가 ' + MIN_TAP + 'px 보다 작습니다');
  const fill = bodyOf(MP, (s) => s === '.pcf-vrow input[type=checkbox]');
  assert.ok(px(fill, 'width') >= MIN_TAP && px(fill, 'height') >= MIN_TAP, '채울 자리 ☐ 가 ' + MIN_TAP + 'px 보다 작습니다');
});

test('③ 채울 자리 표의 첫 칸(☐ 자리)은 ☐ 보다 좁지 않다', () => {
  const grid = bodyOf(MP, (s) => s === '.pcf-vrow');
  const first = +((grid.match(/grid-template-columns\s*:\s*(\d+)px/) || [])[1] || 0);
  const box = px(bodyOf(MP, (s) => s === '.pcf-vrow input[type=checkbox]'), 'width');
  assert.ok(first && box, '폰 채울 자리 표의 칸 나누기·☐ 크기를 못 찾음');
  assert.ok(first >= box, '첫 칸(' + first + 'px)이 ☐(' + box + 'px)보다 좁습니다 — ☐ 가 옆 번호를 덮습니다');
});

test('④ 집단체불 사건 목록의 단추 글자는 한 줄', () => {
  const b = bodyOf(PP, (s) => /^#caseRows\s+\.btn$/.test(s));
  assert.match(b, /white-space\s*:\s*nowrap/, '폰에서 사건 목록 「🔗 링크」 단추가 두 줄로 접힙니다');
});

test('⑤ 모듈을 고쳤으면 싣는 두 화면(계약서등관리·이알피)의 캐시 번호가 같다', () => {
  const v = (f) => (read(f).match(/js\/pu-contract-forms\.js\?v=(\d+)/) || [])[1];
  assert.ok(v('docs-esign.html') && v('pu-erp.html'), '두 화면 가운데 하나가 모듈을 캐시 번호 없이 싣습니다');
  assert.equal(v('docs-esign.html'), v('pu-erp.html'), '두 화면의 캐시 번호가 다릅니다 — 한쪽은 옛 모듈을 씁니다');
});
