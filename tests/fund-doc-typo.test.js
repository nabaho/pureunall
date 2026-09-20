'use strict';
/* 서식마다 «제 글자 크기»  (대표 지시 2026-09-20
 *   「나머지 서류들도 서식 다시확인하고 글자크기 줄간격 모두 검토 다시해라」 → 목업 승인 「추천대로 해라」)
 * 목업: docs/목업-인가서식-글자간격-2026-09-20.html
 *
 * ▣ 왜 필요했나 — 한글을 HTML 로 옮기는 변환기(fund-erp/tools/hwp2html.py 의 _style())는
 *   정렬·줄간격·칸 높이만 옮기고 «글자 크기는 아예 안 옮긴다». 그래서 원본이 8pt 든
 *   14pt 든 전부 바탕 글자 하나(13.5px)로 눌렸다.
 *
 * ▣ 값의 근거 — 원본 .hwp 를 .hwpx 로 풀어 header.xml 의 charPr height(1/100pt)·
 *   paraPr lineSpacing 을 직접 읽었다. 용지는 여섯 종 모두 210×297mm, 여백 20mm.
 *
 * ⚠⚠ 원본이 «두 벌»이다 — 이 검사는 «빈 양식» 쪽을 못박는다.
 *   빈 양식(03_과거자료\설립관련과거자료\1. 노동부인가시필요서류)은 build_forms.py 가
 *   fund_forms.js 를 만들 때 쓴 바로 그 파일이다 — 우리 HTML 이 곧 이 문서다.
 *   2024 제출본(대표 첨부)은 실제로 낸 한 건이다. 같은 잣대로 재면 본문 글자가
 *     신청서 10 ↔ 10(같다)   합의서 13 ↔ 12   정관 11 ↔ 12
 *     회의록 13 ↔ 14          사업계획서 12 ↔ 14
 *   1~2pt 차이다. 우리가 그리는 글이 빈 양식이므로 빈 양식을 따른다.
 *
 * ⚠ 잣대를 맞춰 재라 — 처음엔 빈 양식만 표 안/밖을 갈라 재고 제출본은 통째로 재어
 *   견줬다가, 실제보다 훨씬 크게 갈리는 것처럼 봤다(사업계획서가 11 ↔ 12 로 보였는데
 *   갈라 재니 둘 다 본문 12pt·칸 11pt 였다). 잣대가 다르면 없는 차이가 보인다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
const 코드만 = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/* 빈 양식(템플릿의 원본) 실측값 — 96dpi 에서 1pt = 4/3 px.
   ⚠ 표 «안»과 «밖»을 따로 쟀다. 서식에 따라 글의 대부분이 표 안에 있어서
     (사업계획서는 표 안 3,504자 / 표 밖 584자) 칸 크기가 곧 본문 크기가 된다. */
const PT = 4 / 3;
const 원본 = {
  inka:      { pt: 10, td: 8,  ls: 1.4 },
  agreement: { pt: 13, td: 12, ls: 1.6 },
  charter:   { pt: 11, td: 11, ls: 1.6 },   // 표 없음 — 칸도 본문과 같게 둔다
  minutes:   { pt: 13, td: 11, ls: 2.2 },
  contrib:   { pt: 14, td: 14, ls: 2.2 },
  bizplan:   { pt: 12, td: 11, ls: 1.6 },
};
/* 2024 제출본 본문 값 — «따르지 않기로 한» 쪽. 빈 양식과 «같은 잣대»(표 밖 본문)로 잰 값이다.
   신청서(10pt)·출연확인서(칸 14pt)는 두 원본이 같아 다툼이 없으므로 여기 없다. */
const 제출본 = { agreement: 12, charter: 12, minutes: 14, bizplan: 14 };

function 규칙(prefix) {
  const css = new Function(grabFn('DK_TYPO_CSS') + ';return DK_TYPO_CSS(' + JSON.stringify(prefix) + ');')();
  const out = {};
  for (const m of css.matchAll(/\.dk-([a-z_0-9]+)\{font-size:([\d.]+)px;line-height:([\d.]+)\}/g)) {
    out[m[1]] = { px: +m[2], lh: +m[3] };
  }
  for (const m of css.matchAll(/\.dk-([a-z_0-9]+) td,[^{]*\{font-size:([\d.]+)px\}/g)) {
    if (out[m[1]]) out[m[1]].td = +m[2];
  }
  return { css, map: out };
}

/* ══ ① 값이 원본과 맞는가 ═══════════════════════════════════════ */

test('★★ ① 여섯 서식이 «저마다» 원본 크기를 쓴다 — 한 크기로 눌리지 않는다', () => {
  const { map } = 규칙('.a4');
  Object.keys(원본).forEach((k) => {
    assert.ok(map[k], '★ 이 서식에 글자 크기가 없습니다: ' + k);
    const 기대 = 원본[k].pt * PT;
    assert.ok(Math.abs(map[k].px - 기대) <= 1.0,
      '★ ' + k + ' 본문이 원본과 다릅니다 — 원본 ' + 원본[k].pt + 'pt(≈' +
      기대.toFixed(1) + 'px) 인데 ' + map[k].px + 'px 입니다.');
    /* 표 칸도 «재서» 넣었는지 — 짐작해 넣으면 표가 많은 서식의 본문이 통째로 어긋난다 */
    const 칸기대 = 원본[k].td * PT;
    assert.ok(Math.abs(map[k].td - 칸기대) <= 1.0,
      '★ ' + k + ' 표 칸이 원본과 다릅니다 — 원본 ' + 원본[k].td + 'pt(≈' +
      칸기대.toFixed(1) + 'px) 인데 ' + map[k].td + 'px 입니다.');
    assert.equal(map[k].lh, 원본[k].ls,
      '★ ' + k + ' 줄간격이 원본과 다릅니다 — 원본 ' + (원본[k].ls * 100) + '%.');
  });
});

test('★★ ② 크기가 «서로 다르다» — 전부 같으면 눌린 것과 마찬가지다', () => {
  const { map } = 규칙('.a4');
  const 크기 = Object.keys(원본).map((k) => map[k].px);
  assert.ok(new Set(크기).size >= 4,
    '★ 서식별 글자 크기가 사실상 하나입니다: ' + 크기.join(', '));
  /* 칸이 빽빽한 신청서가 가장 작고, 읽히라는 출연확인서가 가장 크다 */
  assert.ok(map.inka.px < map.charter.px, '★ 신청서가 정관보다 큽니다 — 칸이 넘칩니다.');
  assert.ok(map.contrib.px >= map.charter.px, '★ 출연확인서가 정관보다 작습니다.');
});

test('★★ ②-2 «빈 양식»을 따른다 — 2024 제출본 값으로 흘러가지 않았다', () => {
  const { map } = 규칙('.a4');
  Object.keys(제출본).forEach((k) => {
    const 제출 = 제출본[k] * PT, 빈 = 원본[k].pt * PT;
    /* 두 원본이 갈리는 서식이다. 제출본 쪽에 더 가까우면 원본을 바꿔 탄 것이다. */
    assert.ok(Math.abs(map[k].px - 빈) < Math.abs(map[k].px - 제출),
      '★ ' + k + ' 가 2024 제출본 쪽(' + 제출본[k] + 'pt≈' + 제출.toFixed(1) +
      'px)으로 갔습니다 — 우리 HTML 은 빈 양식(' + 원본[k].pt + 'pt≈' + 빈.toFixed(1) + 'px)입니다.');
  });
});

/* ══ ② 인쇄와 화면이 같은 값을 쓰는가 ═══════════════════════════ */

test('★★ ③ 인쇄판·화면판이 «한 군데»에서 값을 얻는다 — 둘이 어긋날 수 없다', () => {
  const 인쇄 = 코드만(grabFn('dgDocCss'));
  const 화면 = 코드만(grabFn('dgDocCssIn'));
  assert.match(인쇄, /DK_TYPO_CSS\("\.a4"\)/, '★ 인쇄판이 서식별 글자를 안 씁니다.');
  assert.match(화면, /DK_TYPO_CSS\(s\+" \.a4"\)/, '★ 화면판이 서식별 글자를 안 씁니다.');
  /* 값이 두 벌로 적혀 있지 않다 — 적혀 있으면 한쪽만 고치는 사고가 난다 */
  const 값박힘 = (s) => (s.match(/\.dk-[a-z_0-9]+\{font-size:/g) || []).length;
  assert.equal(값박힘(인쇄) + 값박힘(화면), 0,
    '★ 서식별 값이 CSS 함수 안에 또 적혀 있습니다 — 한 군데에만 두세요.');
  /* 실제로 만들어진 두 벌이 «접두사만» 다르다 */
  const a = 규칙('.a4').css, b = 규칙('#doced .a4').css;
  assert.equal(b.split('#doced ').join(''), a, '★ 인쇄판과 화면판이 다릅니다.');
});

/* ══ ③ 이름표가 «장마다» 실제로 붙는가 ══════════════════════════ */

test('★★ ④ 쪽을 나눌 때 장마다 서식 이름표를 단다', () => {
  const pg = 코드만(grabFn('_a4Page'));
  assert.match(pg, /p\.className='a4'\+\(dk\?' '\+dk:''\)/, '★ 장에 이름표를 안 답니다.');
  const pd = 코드만(grabFn('paginateDoc'));
  assert.match(pd, /_a4Page\(no,dk\)/, '★ 쪽 나누기가 이름표를 안 넘깁니다.');
  assert.ok(!/_a4Page\(no\)(?!,)/.test(pd),
    '★ 이름표 없이 장을 만드는 자리가 남았습니다 — 그 장만 바탕 글자로 찍힙니다.');
});

test('★★ ⑤ 묶음 인쇄는 서식마다 «제» 이름표를 쓴다 — 여섯 종이 한 창에 섞인다', () => {
  const eb = 코드만(grabFn('estabBundle'));
  assert.match(eb, /class="a4 dk-'\+esc\(d\[0\]\)\+'"/, '★ 묶음 장에 서식 이름표가 없습니다.');
  /* 들어온 장의 이름표를 물려받는 갈래가 있어야 한다 */
  const pd = 코드만(grabFn('paginateDoc'));
  assert.match(pd, /dk-\[a-z_0-9\]\+/, '★ 들어온 장의 이름표를 읽지 않습니다.');
  assert.match(pd, /blocks\.push\(\{nodes:[^}]*dk:_dkOf\(g\)\}\)/,
    '★ 묶음의 장마다 제 이름표를 쓰지 않습니다 — 전부 마지막에 연 서식 크기가 됩니다.');
});

test('★★ ⑥ 한 서식만 열 때는 지금 열린 서식을 쓴다', () => {
  const pd = 코드만(grabFn('paginateDoc'));
  assert.match(pd, /_dkNow=\(S&&S\._docKind\)\?'dk-'\+S\._docKind:''/,
    '★ 지금 열린 서식을 안 봅니다.');
});

/* ══ ④ 인쇄가 어그러지지 않는가 (내가 낼 뻔한 사고) ═════════════ */

test('★★ ⑦ 인쇄가 «a4 를 낱말로» 찾는다 — 이름표가 붙어도 한 겹 더 안 감싼다', () => {
  const pdoc = 코드만(grabFn('printDoc'));
  assert.ok(!/class\\s\*=\\s\*\["'\]a4\["'\]/.test(pdoc),
    '★ class="a4" 딱 그 모양만 찾습니다 — 이름표가 붙으면 장을 한 겹 더 감쌉니다.');
  assert.match(pdoc, /\\ba4\\b/, '★ a4 를 낱말로 찾지 않습니다.');
  /* 진짜로 그런지 돌려 본다 */
  const re = /class\s*=\s*["'][^"']*\ba4\b/;
  assert.ok(re.test('<div class="a4 dk-charter">'), '★ 이름표가 붙은 장을 못 알아봅니다.');
  assert.ok(re.test('<div class="a4">'), '★ 이름표 없는 장을 못 알아봅니다.');
  assert.ok(!re.test('<div class="a4b">'), '★ a4b 를 a4 로 잘못 봅니다.');
});

/* ══ ⑤ 진짜 DOM 에서 — 이름표가 장에 남는가 ═════════════════════ */

test('★★ ⑦-2 줄간격은 «받침»이다 — 템플릿이 문단마다 단 값이 이긴다', () => {
  /* 실제로 겪은 것: 정관에 line-height:2.0 을 줬는데 화면은 1.6 이었다.
     템플릿이 <p style="line-height:160%"> 를 달고 있고 인라인이 이기기 때문이다.
     그러니 !important 로 억지로 이기려 들면 안 된다 — 템플릿의 문단별 강약(제목 230%,
     차례 100% …)이 통째로 뭉개진다. 이 값은 템플릿이 «아무 말 없는» 문단용이다. */
  const css = 규칙('.a4').css;
  assert.ok(!/!important/.test(css),
    '★ !important 로 템플릿의 문단별 줄간격을 뭉갭니다.');
});

/* ══ ⑥ 설립합의서 — 본문은 문단으로, 서명란은 «건드리지 않는다» ══════════
 * ⚠⚠ 내가 실제로 낸 사고: 설립합의서가 한 덩이(문단 1개)여서 본문을 문단으로 갈랐는데,
 *   서명 네 줄까지 <span> 둘로 갈랐다. 그랬더니 fillSignTable() 이 자리를 못 찾아
 *   서명 표가 아예 안 서고 참여사업장 대표자 이름이 통째로 빠졌다
 *   (check_derived.js 가 7건으로 잡았다).
 *   fillSignTable 은 «한 글토막 안에 근로자측·사용자측 부르는 말이 둘 다 있고
 *   회사 자리표가 있는» 줄을 찾는다 — 그 줄을 쪼개면 못 찾는다.
 * ▣ 그래서 사람이 실제로 보는 설립합의서의 서명란은 이미 «번호 붙인 표»다.
 */
test('★★ ⑦-3 설립합의서 본문은 문단으로 서고, 서명란은 한 글토막으로 남는다', () => {
  const FF = fs.readFileSync(path.join(__dirname, '..', 'fund_forms.js'), 'utf8');
  const line = FF.split('\n').find((l) => l.trim().startsWith('"agreement"'));
  assert.ok(line, 'fund_forms.js 에 agreement 가 없다');
  const html = JSON.parse(/^\s*"agreement":\s*("(?:[^"\\]|\\.)*")/.exec(line)[1]);

  /* 본문이 갈라졌다 — 한 덩이가 아니다 */
  assert.ok((html.match(/<p[\s>]/g) || []).length >= 6,
    '★ 설립합의서가 아직 한 덩이입니다 — 합의 항목이 한 줄씩 서지 않습니다.');
  assert.match(html, /class="fmtitle"/, '★ 제목이 제목으로 서지 않습니다.');
  assert.equal((html.match(/class="fmhang"/g) || []).length, 3,
    '★ 합의 항목 셋이 각각 한 줄로 서지 않습니다.');
  assert.match(html, /class="fmdate"/, '★ 날짜 줄이 없습니다.');

  /* ★ 서명란은 «한 글토막» 그대로여야 한다 — fillSignTable 이 찾는 모양이다 */
  const 서명 = /<p style="text-align:center;line-height:130%">([\s\S]*?)<\/p>\s*$/.exec(html);
  assert.ok(서명, '★ 서명란이 원래 글줄 모양이 아닙니다 — 서명 표가 안 섭니다.');
  const 첫줄 = 서명[1].split(/<br\s*\/?>/)[0];
  assert.match(첫줄, /근로자측대표/, '★ 서명 첫 줄에 근로자측 말이 없습니다.');
  assert.match(첫줄, /대표이사/, '★ 서명 첫 줄에 사용자측 말이 없습니다.');
  assert.match(첫줄, /○○주식회사/, '★ 서명 첫 줄에 회사 자리표가 없습니다.');
  assert.ok(!/<span/.test(서명[1]),
    '★ 서명 줄을 <span> 으로 쪼갰습니다 — fillSignTable 이 자리를 못 찾습니다.');

  /* 말은 한 글자도 안 달라졌다 — 날인 자리 넷, 자리표, 유형 전환이 찾는 말 */
  assert.equal((html.match(/\( 인 \)/g) || []).length, 4, '★ 날인 자리가 넷이 아닙니다.');
  assert.match(html, /\{\{FUND\}\}/, '★ 기금 이름 자리표가 사라졌습니다.');
  assert.match(html, /사내근로복지기금법인/,
    '★ fillFundTypeWords 가 찾는 말이 사라졌습니다 — 공동/사내 전환이 깨집니다.');
});

test('★★ ⑧ 실제로 장을 만들어 보면 이름표가 붙어 있다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const dom = new JSDOM('<!doctype html><body></body>');
  const box = {};
  new Function('document', grabFn('_a4Page') + ';this.mk=_a4Page;').call(box, dom.window.document);
  const 있음 = box.mk(1, 'dk-charter');
  assert.equal(있음.className, 'a4 dk-charter', '★ 이름표가 안 붙었습니다.');
  const 없음 = box.mk(2, '');
  assert.equal(없음.className, 'a4', '★ 이름표가 없을 때 빈칸이 남습니다.');
  assert.ok(있음.querySelector('.a4b'), '★ 본문 칸이 없습니다.');
});
