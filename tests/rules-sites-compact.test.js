/* 취업규칙 「🏢 사업장」 — 폰에서 촘촘하게, 그리고 이름이 보이게 (대표 지시 2026-10-18
   「UI 컴팩트하게 다시 정리해라. 글자 너무 안 보인다」 · 「새 버전 있으면 누르기가 너무 위에 있다 … 조금 낮게」)

   그날 폰 갈무리: 사업장 이름이 전부 「삼…」「농…」 한 글자만 남아 있었다.
   표는 table-layout:fixed 라 폭 없는 칸(사업장 이름)은 «남는 자리»만 받는데,
   표의 min-width(800)가 다른 칸 폭 합(754)과 거의 같아 이름 몫이 46px 뿐이었다.
   폰·좁은 PC 처럼 표가 min-width 로 줄어드는 곳에서 모두 그렇다.

   ★ 못 박는 것은 규칙이다(값이 아니다):
     ① 표의 min-width − 다른 칸 폭 합 ≥ 이름 한 칸 몫(회사 이름이 읽히는 폭)
     ② (PC 표) 이름까지의 앞 칸(☐ · #) 고정(sticky) — 칸마다 left 는 앞 칸 폭의 합. 다르면 겹치거나 틈이 난다.
        폰(900px 이하)은 두 줄 카드(CLAUDE.md 「폰 화면」)라 고정을 걸지 않는다
     ③ 폰에서 새로고침은 ↻ 만 남는다(글자는 접을 뿐 title 에 있다)
     (「새 버전」 단추를 폰에서 낮게 — 처음엔 여기서 박았으나 쪽 막대를 덮어 모든 앱 한 곳으로 옮겼다:
      tests/version-fab-phone-low.test.js)
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
/* colgroup 의 칸 폭 — 폭 없는 칸은 null (지금은 모든 칸에 폭이 있다 — ①) */
function cols() {
  const h = V.listHtml(st(), []);
  const g = h.match(/<colgroup>([\s\S]*?)<\/colgroup>/);
  assert.ok(g, '표에 colgroup 이 없다');
  return [...g[1].matchAll(/<col([^>]*)>/g)].map((m) => {
    const w = m[1].match(/width:\s*(\d+)px/);
    return w ? Number(w[1]) : null;
  });
}

/* 사업장 이름 칸의 자리 — 머리의 「사업장」이 몇째 칸인지 그림에서 찾는다(칸이 늘어도 따라간다) */
function nameIndex() {
  const h = V.listHtml(st(), []);
  const th = [...h.match(/<thead>([\s\S]*?)<\/thead>/)[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]*>/g, '').trim());
  const i = th.findIndex((t) => t === '사업장');
  assert.ok(i >= 0, '머리에 「사업장」이 없다');
  return i;
}

test('① 모든 칸에 폭이 있다 — 폭 없는 칸이 남는 화면을 다 먹지 않는다 · 사업장은 읽히는 폭(NAME_MIN)을 받고 표 min-width 가 칸 폭 합이다', () => {
  const c = cols();
  /* 폭 없는 칸이 하나 있으면 넓은 화면에서 남는 폭을 그 칸(사업장)이 다 먹는다 — 1920px 에서 사업장 480px · 업태 「도매 …」·자료 「후보 1…」 잘림
     (2026-11-02 대표 「사업장 열 넓이 너무 넓다 줄여라 · 규모부터 취업규칙 자료 셀 좌우 조정」). 모두 폭이 있으면 남는 폭은 폭 비율대로 나뉜다 */
  assert.equal(c.filter((w) => w === null).length, 0, '폭 없는 칸이 있다 — 넓은 화면에서 그 칸이 남는 자리를 다 먹는다');
  const nameW = c[nameIndex()];
  assert.ok(nameW >= NAME_MIN, '★ 사업장 칸 기본 폭이 ' + nameW + 'px 뿐이다 — 좁은 화면에서 「삼…」 한 글자만 보인다');
  const sum = c.reduce((a, w) => a + w, 0);
  const m = CSS.match(/\.sites\{[^}]*min-width:\s*(\d+)px/);
  assert.ok(m, '.sites 에 min-width 가 없다');
  assert.ok(Number(m[1]) >= sum, '★ .sites min-width(' + m[1] + ')가 칸 폭 합(' + sum + ')보다 작다 — 좁은 화면에서 칸이 줄어 이름이 짓눌린다');
  // 사업장이 «표의 절반»을 넘게 가져가면 넓은 화면에서 다시 지나치게 넓어진다
  assert.ok(nameW / sum <= 0.25, '사업장 칸 비율이 ' + Math.round(nameW / sum * 100) + '% 다 — 다른 칸 몫이 너무 작다');
});

test('② PC 표를 옆으로 밀어도 앞 칸들(☐ · # · 이름)은 남는다 — 칸마다 left 는 앞 칸 폭의 합, 폰 카드에는 안 건다', () => {
  const c = cols();
  const name = nameIndex();                                         // 「사업장」 머리의 자리 = 사업장 이름 칸
  assert.ok(name >= 1 && c.slice(0, name).every((w) => w > 0), '이름 앞 칸들은 폭이 있어야 고정 자리를 셀 수 있다');
  const pc = mediaBlocks(CSS, 'min').filter((b) => b.w >= 901).map((b) => b.body).join('\n');
  let sum = 0;
  for (let i = 0; i <= name; i++) {
    const n = i + 1;
    const m = pc.match(new RegExp('\\.sites td:nth-child\\(' + n + '\\),\\.sites th:nth-child\\(' + n + '\\)\\{([^}]*)\\}'));
    assert.ok(m, n + '째 칸 고정 규칙이 없다 — 이름까지의 앞 칸은 모두 고정해야 옆으로 밀 때 이름이 남는다');
    assert.match(m[1], /position:sticky/);
    const left = Number((m[1].match(/left:\s*(\d+)(px)?/) || [])[1]);
    assert.equal(left, sum, '★ ' + n + '째 칸 left(' + left + ')가 앞 칸 폭의 합(' + sum + ')과 다르다 — 겹치거나 틈이 난다');
    sum += c[i] || 0;
  }
  // collapse 면 고정 칸의 줄금이 따라오지 않는다
  assert.doesNotMatch(CSS.match(/\.sites\{[^}]*\}/)[0], /border-collapse:\s*collapse/);
  // 폰 카드에 고정이 새면 카드 안에 세로 줄금이 그어진다 — 묶음 밖(모든 폭)에 두지 않는다
  const outside = mediaBlocks(CSS, 'min').concat(mediaBlocks(CSS, 'max')).reduce((t, b) => t.split(b.body).join(''), CSS);
  assert.doesNotMatch(outside, /\.sites td:nth-child\(\d\)[^{]*\{[^}]*position:sticky/, '앞 칸 고정이 폰 카드에도 걸린다');
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

/* ④ 자료 칸은 격자 — 규칙·노사·단협 · 확정 · 후보 · 맞음 이 줄마다 «같은 자리»에 선다 (대표 지시 2026-11-02 「취업규칙자료 안에 셀들 열을 정렬해라」)
   값이 없는 자리는 비워 둔다 — 자리 번호(ds4·ds5·ds6)가 칸에 못 박혀 있어 앞 칸이 비어도 뒤 칸이 앞으로 밀리지 않는다 */
test('④ 자료 칸 — 줄마다 같은 자리 번호에 서고, 격자 칸 수가 그림의 자리 수와 같다', () => {
  const row = (extra) => Object.assign({ id: 'c1', name: '점검가나상사', bizNo: '', size: 12, band: '10~29인', bizType: '제조업', closed: false,
    linked: 0, cand: 0, candIds: [], candMails: 0, last: 0, groups: [], fin: { state: '' }, mgr: '', subs: [] }, extra || {});
  const rows = [row({ id: 'a', linked: 7 }), row({ id: 'b', cand: 1, candMails: 1 }), row({ id: 'c', linked: 3, cand: 2, candMails: 1 }), row({ id: 'd' })];
  const h = V.listHtml(st(), rows);
  const cell = (id) => (h.match(new RegExp('<tr data-act="siteSel" data-co="' + id + '"[\\s\\S]*?<span class="dc">([\\s\\S]*?)</span></td></tr>')) || [])[1] || '';
  const slotsOf = (id) => [...cell(id).matchAll(/<span class="ds ds(\d)">/g)].map((m) => Number(m[1]));
  assert.deepEqual(slotsOf('a'), [4], '확정만 — 넷째 자리');
  assert.deepEqual(slotsOf('b'), [5, 6], '후보만 — 확정 자리를 비우고 다섯째·여섯째 자리 (앞으로 밀리면 줄마다 어긋난다)');
  assert.deepEqual(slotsOf('c'), [4, 5, 6], '확정·후보·맞음 — 세 자리');
  assert.deepEqual(slotsOf('d'), [4], '자료 없음 — 넷째 자리부터 걸쳐 놓는다');
  assert.match(cell('d'), /ds-all/);
  // 체크 단추 셋(규칙·노사·단협)은 어느 줄에나 같은 차례로 앞 세 자리를 채운다
  ['a', 'b', 'c', 'd'].forEach((id) => {
    const sh = [...cell(id).matchAll(/<button class="sck[^"]*"[^>]*data-set="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(sh, ['취업규칙', '노사협의회', '단체협약'], id + ' 줄의 체크 단추 차례');
  });
  // CSS — 자리 번호마다 격자 칸이 있고, 격자는 여섯 칸이다
  const g = CSS.match(/#sites \.dc\{[^}]*grid-template-columns:([^;}]*)/);
  assert.ok(g, '자료 칸 격자(.dc)에 grid-template-columns 가 없다');
  let n = 0;
  const rest = g[1].replace(/repeat\((\d+),\s*minmax\([^)]*\)\)/g, (m0, k) => { n += Number(k); return ' '; });
  n += (rest.match(/minmax\([^)]*\)/g) || []).length;
  assert.equal(n, 6, '격자 칸이 여섯(체크 셋 + 확정·후보·맞음)이어야 한다: ' + n);
  [4, 5, 6].forEach((n) => assert.match(CSS, new RegExp('#sites \\.dc \\.ds' + n + '\\{grid-column:' + n + '\\}'), n + '째 자리의 격자 칸 지정이 없다'));
});
