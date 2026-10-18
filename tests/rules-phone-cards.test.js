'use strict';
/* 취업규칙 — 폰에서 사업장 표·모은 자료 표가 «두 줄 카드», 고른 사업장은 «화면을 덮는 판» (폰화면관리 2026-10-18)

   무엇이 문제였나 (지어낸 업체 40곳·서류 90건, 360·411px 크로미움):
     · 🏢 사업장 표가 min-width:800px 이라 폰에서는 다른 칸 폭을 다 빼고 남은 «사업장» 칸이 46px 남짓 —
       머리는 「사···」, 이름은 「(주…」 로만 보였다. 가장 중요한 칸이 가장 좁았다.
     · 줄을 누르면 이력이 표 «아래»(최대 50줄 뒤)에 그려져, 폰에서는 눌러도 아무 일이 없는 것처럼 보였다.
     · 📥 모은 자료는 머리(요약·거르개)가 첫 화면 460px 을 먹고, 사업장·판·최종본이 화면 밖이었다.
     · ✏️ 검토·개정의 「원본 미리보기」 머리가 「원/본/미/리/보/기」 한 글자씩 세로로 쌓였다.

   지키는 규칙 (px 값은 박지 않는다 — «그런 모양인가» 만 본다):
     ① 폰 구간에서 사업장 표는 최소 폭을 풀고, 줄은 접히는 flex(두 줄 카드)다 — 줄 바꿈 조각이 있다
     ② ★ CSS 가 기대는 칸 차례(사업장 이름 칸 · 취업규칙 자료 칸)가 실제 그림과 맞다 — 어긋나면 엉뚱한 칸이 커진다.
        맨 앞 둘은 ☐ · № (CLAUDE.md 「맨 왼쪽은 ☐ 고르기 칸 + 번호」 — 카드로 접어도 왼쪽 끝)
     ③ 고른 사업장은 폰에서 화면을 덮는 판(fixed)이고, 판에는 「← 목록」(고른 것 비우기)이 있다 · PC 에서는 그 단추가 숨는다
     ④ 폰 뒤로가기는 판이 떠 있을 때 «판만» 닫는다 — 실제로 돌려서 본다
     ⑤ 📥 메일 순 표만 카드로 접는 이름표가 있고, 폰의 고르기 칸은 손가락 크기다
     ⑥ ✏️ 판 머리는 폰에서 접어 내리고 단추 글자는 한 줄이다
   실행: node --test tests/rules-phone-cards.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'rules-v2.html'), 'utf8');
const RULES = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8');
/* 그리기 부품이 찾는 이웃 부품 — rules-v2-view-sites 검사와 같은 방식으로 꽂는다 */
global.PuRulesV2Order = require('../js/rules-v2/lib-order.js');
global.PuRulesV2Sites = require('../js/rules-v2/lib-sites.js');
global.PuRulesV2SiteCols = require('../js/rules-v2/lib-sitecols.js');
global.PuRulesV2Lib = require('../js/rules-v2/view-library.js');
const VS = require('../js/rules-v2/view-sites.js');
const VL_SRC = fs.readFileSync(path.join(ROOT, 'js/rules-v2/view-library.js'), 'utf8');

/* 폰 폭(max-width ≤ limit, min-width 없음) @media 안의 규칙들을 [선택자, 선언] 으로 모은다 */
function phoneRules(src, limit) {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const out = [];
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(css))) {
    const q = m[1];
    const w = (q.match(/max-width\s*:\s*(\d+)px/) || [])[1];
    if (!w || Number(w) > limit || /min-width/.test(q)) continue;
    let i = m.index + m[0].length, d = 1;
    const s = i;
    while (i < css.length && d > 0) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; }
    const body = css.slice(s, i - 1);
    const r = /([^{}]+)\{([^{}]*)\}/g;
    let x;
    while ((x = r.exec(body))) out.push([x[1].trim(), x[2]]);
  }
  return out;
}
/* 선택자 목록 가운데 하나라도 re 에 맞는 규칙의 선언을 모두 이어 붙인다 */
function decl(rules, re) {
  return rules.filter(([sel]) => sel.split(',').some((one) => re.test(one.trim()))).map(([, d]) => d).join(';');
}
/* @media 밖(PC 에도 걸리는) 규칙 */
function baseRules(src) {
  let css = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const re = /@media[^{]*\{/g;
  let m, out = '', last = 0;
  while ((m = re.exec(css))) {
    out += css.slice(last, m.index);
    let i = m.index + m[0].length, d = 1;
    while (i < css.length && d > 0) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; }
    last = i; re.lastIndex = i;
  }
  return out + css.slice(last);
}
const P = phoneRules(HTML, 900);

test('★① 폰에서 사업장 표는 최소 폭을 풀고, 줄은 접히는 flex 카드다', () => {
  assert.match(decl(P, /^#sites \.sites$/), /min-width\s*:\s*0/, '폰에서도 min-width:800px 이 남으면 사업장 칸이 46px 로 짓눌린다');
  const tr = decl(P, /^#sites \.sites tbody tr$/);
  assert.match(tr, /display\s*:\s*flex/, '줄이 표 줄 그대로면 칸이 옆으로만 늘어선다');
  assert.match(tr, /flex-wrap\s*:\s*wrap/, '두 줄이 되려면 접혀야 한다');
  assert.match(decl(P, /^#sites \.sites tbody tr::after$/), /flex-basis\s*:\s*100%/, '첫 줄과 둘째 줄을 가르는 조각이 없다');
});

test('★② CSS 가 기대는 칸 차례가 실제 그림과 맞다 — 맨 앞 ☐·№, 이름 칸은 남는 자리, 자료 딱지는 안 줄어든다', () => {
  const st = { sites: { sel: '' }, staff: {}, data: { docs: {} } };
  const row = { id: 'c9', name: '점검가나다상사', bizNo: '', size: 12, band: '10~29인', bizType: '제조업', closed: false,
    linked: 2, cand: 1, candIds: ['d1'], candMails: 1, last: Date.UTC(2026, 8, 1), groups: [], fin: { state: 'none' }, mgr: '', subs: [] };
  const h = VS.listHtml(st, [row]);
  const tds = [...h.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
  assert.ok(tds.length >= 8, '칸이 모자란다');
  // 칸 «차례»는 박지 않는다 — 실제 그림에서 찾아 CSS 의 nth-child 와 견준다(칸이 늘어도 둘이 함께 맞으면 된다)
  assert.match(tds[0], /type="checkbox"/, '맨 앞 칸이 ☐ 고르기가 아니다');
  assert.match(tds[1], /^1$/, '둘째 칸이 번호가 아니다');
  const name = tds.findIndex((t) => /점검가나다상사/.test(t)) + 1;
  const docs = tds.findIndex((t) => /확정|후보/.test(t)) + 1;
  assert.ok(name > 0 && docs > 0, '이름·자료 칸을 못 찾았다');
  assert.ok(Number(decl(P, /^#sites \.sites td:nth-child\(1\)$/).match(/order\s*:\s*(\d+)/)[1]) <
    Number(decl(P, new RegExp('^#sites \\.sites td:nth-child\\(' + name + '\\)$')).match(/order\s*:\s*(\d+)/)[1]), '☐ 가 이름보다 앞에 서야 한다');
  assert.match(decl(P, new RegExp('^#sites \\.sites td:nth-child\\(' + name + '\\)$')), /flex\s*:\s*1/,
    '이름 칸(' + name + '째)이 남는 자리를 안 가져간다 — 칸이 늘었으면 폰 CSS 의 nth-child 를 함께 고친다');
  assert.match(decl(P, new RegExp('^#sites \\.sites td:nth-child\\(' + docs + '\\)$')), /flex\s*:\s*none/,
    '자료 딱지 칸(' + docs + '째)이 줄어 잘린다 — 칸이 늘었으면 폰 CSS 의 nth-child 를 함께 고친다');
});

test('★③ 고른 사업장은 폰에서 화면을 덮는 판 — 「← 목록」으로 닫고, PC 에서는 그 단추가 없다', () => {
  assert.match(decl(P, /^#sites \.sside:not\(\.empty\)$/), /position\s*:\s*fixed/, '판이 표 아래에 그려지면 폰에서는 눌러도 아무 일이 없어 보인다');
  assert.match(decl(P, /^#sites \.sside\.empty$/), /display\s*:\s*none/, '고르지 않았을 때 안내 칸이 표 아래 자리만 먹는다');
  const st = { sites: { sel: 'c9' }, staff: {}, data: { docs: {} } };
  const row = { id: 'c9', name: '점검가나다상사', bizNo: '', size: 0, band: '', bizType: '', linked: 0, cand: 0, candIds: [], candMails: 0, last: 0, groups: [], fin: { state: '' } };
  const side = VS.sideHtml(st, row);
  assert.match(side, /<button[^>]*class="[^"]*\bsback\b[^"]*"[^>]*data-act="siteSel"[^>]*data-co=""/, '판을 닫을 단추(고른 것 비우기)가 없다');
  assert.match(baseRules(HTML), /#sites \.sback\s*\{[^}]*display\s*:\s*none/, 'PC 에서는 「← 목록」이 숨어야 한다 — 왼쪽 표가 늘 보인다');
  assert.match(decl(P, /\.sback$/), /display\s*:\s*(inline-)?flex/, '폰에서 「← 목록」이 안 보인다');
});

test('★④ 폰 뒤로가기는 판이 떠 있을 때 판만 닫는다 — 실제로 돌려 본다', () => {
  const at = HTML.indexOf('PuBack.guard(');
  assert.ok(at > 0, '뒤로가기 파수꾼이 없다');
  let i = HTML.indexOf('function', at), d = 0, s = i;
  for (i = HTML.indexOf('{', i); i < HTML.length; i++) { if (HTML[i] === '{') d++; else if (HTML[i] === '}') { d--; if (!d) break; } }
  const fnSrc = HTML.slice(s, i + 1);
  function run(sel, narrow, mode) {
    const calls = [];
    const box = { window: { __rv2Mode: mode, matchMedia: () => ({ matches: narrow }) }, ST: { sites: { sel } }, H: { siteSel: (d) => { calls.push(d.co); box.ST.sites.sel = d.co; } } };
    const ret = vm.runInNewContext('(' + fnSrc + ')()', box);
    return { ret, calls };
  }
  let r = run('c9', true, 'sites');
  assert.equal(r.ret, true, '판이 떠 있는데 뒤로가기가 앱을 나간다');
  assert.deepEqual(r.calls, [''], '판을 닫는 것은 «고른 것 비우기»여야 한다');
  assert.equal(run('', true, 'sites').ret, false, '판이 없으면 공통 층에 넘겨야 한다(앱을 못 나가게 된다)');
  assert.equal(run('c9', false, 'sites').ret, false, 'PC 는 판이 아니다 — 뒤로가기를 가로채지 않는다');
  assert.equal(run('c9', true, 'lib').ret, false, '다른 갈래에서는 가로채지 않는다');
});

test('★⑤ 📥 메일 순 표만 카드로 접는 이름표가 있고, 폰의 고르기 칸은 손가락 크기다', () => {
  assert.match(VL_SRC, /<table class="lib lmail">/, '메일 순 표에 카드 이름표가 없다');
  assert.equal((VL_SRC.match(/\blmail\b/g) || []).length >= 1, true);
  assert.equal((VL_SRC.match(/<table class="lib lmail">/g) || []).length, 1, '사업장별·정리하기 표는 칸이 달라 같은 이름표를 달면 안 된다');
  assert.match(decl(P, /^#lib \.lmail tr$/), /display\s*:\s*flex/);
  const ck = decl(P, /^#lib \.lmail input\[type=checkbox\]$/);
  const w = Number((ck.match(/width\s*:\s*(\d+)px/) || [])[1]);
  assert.ok(w >= 22, '폰의 고르기 칸이 손가락보다 작다(' + w + 'px)');
  assert.match(decl(P, /^#lib>\.flt$/), /flex-wrap\s*:\s*nowrap/, '거르개가 여섯 줄로 접혀 첫 화면을 먹는다');
  assert.match(decl(P, /^#lib>\.flt$/), /overflow-x\s*:\s*auto/, '한 줄로 묶었으면 옆으로 밀 수 있어야 한다');
});

test('★⑥ ✏️ 판 머리는 폰에서 접어 내리고, 단추 글자는 한 줄이다', () => {
  const R = phoneRules(RULES, 760);
  assert.match(decl(R, /^\.pane h3$/), /flex-wrap\s*:\s*wrap/, '판 머리가 한 줄에 우겨 넣어지면 「원/본/미/리/보/기」로 쌓인다');
  assert.match(decl(R, /^\.pane h3 \.btn$/), /white-space\s*:\s*nowrap/, '단추가 「전체/보기」로 접힌다');
});

test('바꾼 부품은 캐시 번호를 단 채로 싣는다', () => {
  ['js/rules-v2/view-sites.js', 'js/rules-v2/view-library.js'].forEach((f) => {
    assert.match(HTML, new RegExp('<script src="' + f.replace(/[.\/]/g, '\\$&') + '\\?v=\\d+"></script>'), f);
  });
});
