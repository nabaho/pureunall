/* 취업규칙 「🏢 사업장」 — 폰에서 촘촘하게, 그리고 이름이 보이게 (대표 지시 2026-10-18
   「UI 컴팩트하게 다시 정리해라. 글자 너무 안 보인다」 · 「새 버전 있으면 누르기가 너무 위에 있다 … 조금 낮게」)

   그날 폰 갈무리: 사업장 이름이 전부 「삼…」「농…」 한 글자만 남아 있었다.
   표는 table-layout:fixed 라 폭 없는 칸(사업장 이름)은 «남는 자리»만 받는데,
   표의 min-width(800)가 다른 칸 폭 합(754)과 거의 같아 이름 몫이 46px 뿐이었다.
   폰·좁은 PC 처럼 표가 min-width 로 줄어드는 곳에서 모두 그렇다.

   ★ 못 박는 것은 규칙이다(값이 아니다):
     ① 표의 min-width − 다른 칸 폭 합 ≥ 이름 한 칸 몫(회사 이름이 읽히는 폭)
     ② (PC 표) 이름 칸 고정(sticky)의 left 는 # 칸 폭과 같다 — 다르면 겹치거나 틈이 난다.
        폰(900px 이하)은 두 줄 카드(CLAUDE.md 「폰 화면」)라 고정을 걸지 않는다
     ③ 폰에서 새로고침은 ↻ 만 남는다(글자는 접을 뿐 title 에 있다)
     ④ 「새로보기」 단추는 이 앱 폰 화면에서 공용 높이보다 낮다 — 공용 값은 건드리지 않는다
   실행: node --test tests/rules-sites-compact.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

global.PuRulesV2Order = require('../js/rules-v2/lib-order.js');
global.PuRulesV2Sites = require('../js/rules-v2/lib-sites.js');
global.PuRulesV2SiteCols = require('../js/rules-v2/lib-sitecols.js');
global.PuRulesV2Lib = require('../js/rules-v2/view-library.js');
const V = require('../js/rules-v2/view-sites.js');

const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const CSS = stripComments(R('rules-v2.html').split('</style>')[0]);
const SHELL = stripComments(R('css/rules-shell.css'));
const NAME_MIN = 140;   // 「(주)가나다라상사」 정도가 13px 굵은 글씨로 읽히는 폭 — 이보다 좁으면 이름이 잘린다

const st = () => ({ data: { docs: {}, human: {}, rounds: {} }, companies: [], sites: { f: 'all', q: '', sel: '' }, busy: '' });
/* @media (max-width:N) 묶음마다 안쪽 글 — 한 줄짜리든 여러 줄이든 괄호를 세어 끝을 찾는다 */
function mediaBlocks(css, kind) {
  const out = [], re = new RegExp('@media\\s*\\(' + (kind || 'max') + '-width:\\s*(\\d+)px\\)\\s*\\{', 'g');
  let m;
  while ((m = re.exec(css))) {
    let d = 1, i = re.lastIndex;
    for (; i < css.length && d > 0; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out.push({ w: Number(m[1]), body: css.slice(re.lastIndex, i - 1) });
  }
  return out;
}
/* colgroup 의 칸 폭 — 폭 없는 칸(이름)은 null */
function cols() {
  const h = V.listHtml(st(), []);
  const g = h.match(/<colgroup>([\s\S]*?)<\/colgroup>/);
  assert.ok(g, '표에 colgroup 이 없다');
  return [...g[1].matchAll(/<col([^>]*)>/g)].map((m) => {
    const w = m[1].match(/width:\s*(\d+)px/);
    return w ? Number(w[1]) : null;
  });
}

test('① 사업장 이름 칸이 «읽히는 폭»을 받는다 — 표 min-width 가 다른 칸 합보다 넉넉하다', () => {
  const c = cols();
  assert.equal(c.filter((w) => w === null).length, 1, '폭 없는 칸(남는 자리를 받는 이름 칸)은 하나여야 한다');
  const fixed = c.reduce((a, w) => a + (w || 0), 0);
  const m = CSS.match(/\.sites\{[^}]*min-width:\s*(\d+)px/);
  assert.ok(m, '.sites 에 min-width 가 없다');
  const nameW = Number(m[1]) - fixed;
  assert.ok(nameW >= NAME_MIN,
    '★ 좁은 화면에서 사업장 이름 칸이 ' + nameW + 'px 뿐이다 — 「삼…」 한 글자만 보인다. '
    + '.sites 의 min-width 를 «다른 칸 합(' + fixed + ') + ' + NAME_MIN + '» 이상으로 올리거나 다른 칸을 줄일 것');
});

test('② PC 표를 옆으로 밀어도 # · 이름은 남는다 — 이름 칸 left 는 # 칸 폭과 같고, 폰 카드에는 안 건다', () => {
  const c = cols();
  assert.ok(c[0] > 0 && c[1] === null, '첫 칸은 #(폭 있음), 둘째 칸은 이름(폭 없음)이어야 한다');
  const pc = mediaBlocks(CSS, 'min').filter((b) => b.w >= 901).map((b) => b.body).join('\n');
  const first = pc.match(/\.sites td:nth-child\(1\),\.sites th:nth-child\(1\)\{([^}]*)\}/);
  const second = pc.match(/\.sites td:nth-child\(2\),\.sites th:nth-child\(2\)\{([^}]*)\}/);
  assert.ok(first && second, '# · 이름 칸 고정 규칙이 없다');
  assert.match(first[1], /position:sticky/); assert.match(first[1], /left:0/);
  assert.match(second[1], /position:sticky/);
  const left = Number((second[1].match(/left:\s*(\d+)px/) || [])[1]);
  assert.equal(left, c[0], '★ 이름 칸 left(' + left + ')와 # 칸 폭(' + c[0] + ')이 다르다 — 겹치거나 틈이 난다');
  // 폰 카드에 고정이 새면 카드 안에 세로 줄금이 그어진다 — 묶음 밖(모든 폭)에 두지 않는다
  const outside = mediaBlocks(CSS, 'min').concat(mediaBlocks(CSS, 'max')).reduce((t, b) => t.split(b.body).join(''), CSS);
  assert.doesNotMatch(outside, /\.sites td:nth-child\(2\)[^{]*\{[^}]*position:sticky/, '이름 칸 고정이 폰 카드에도 걸린다');
  // collapse 면 고정 칸의 줄금이 따라오지 않는다
  assert.doesNotMatch(CSS.match(/\.sites\{[^}]*\}/)[0], /border-collapse:\s*collapse/);
});

test('③ 폰 거르개 — 새로고침은 ↻ 만, 글자는 접고 title 에 남긴다', () => {
  const h = V.filterHtml(st(), { has: 1, wait: 0, all: 2 });
  const b = h.match(/<button[^>]*data-act="reload"[^>]*>[\s\S]*?<\/button>/);
  assert.ok(b, '새로고침 단추가 없다');
  assert.match(b[0], /title="새로고침"/);
  assert.match(b[0], /<span class="rl-t">[^<]*새로고침<\/span>/);
  const phone = mediaBlocks(CSS).filter((b) => b.w <= 768).map((b) => b.body).join('\n');
  assert.match(phone, /#sites \.flt \.rl-t\{display:none\}/, '폰에서 「새로고침」 글자를 안 접는다');
});

test('④ 「새로보기」 단추 — 이 앱 폰 화면에서만 공용 높이보다 낮다', () => {
  const shared = Number((R('js/pu-version.js').match(/id = 'pu-version-fab'[\s\S]*?bottom:(\d+)px/) || [])[1]);
  assert.ok(shared > 0, 'pu-version.js 에서 공용 bottom 을 못 읽었다');
  const m = SHELL.match(/@media\(max-width:(\d+)px\)\{#pu-version-fab\{bottom:([^}]*)!important\}\}/);
  assert.ok(m, 'css/rules-shell.css 에 폰용 #pu-version-fab 자리가 없다');
  assert.ok(Number(m[1]) <= 768, '폰 폭에서만 낮춰야 한다(PC 는 공용 그대로)');
  const px = Number((m[2].match(/(\d+)px/) || [])[1]);
  assert.ok(px > 0 && px < shared, '★ 공용(' + shared + 'px)보다 낮지 않다: ' + m[2]);
  // 두 파일 모두 이 한 벌을 싣는다 — 한쪽만 실으면 갈래를 오갈 때 단추가 뛴다
  ['rules.html', 'rules-v2.html'].forEach((f) => assert.match(R(f), /css\/rules-shell\.css\?v=\d+/, f));
});
