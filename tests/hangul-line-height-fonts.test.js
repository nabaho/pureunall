'use strict';
/* 한글 편집기 — 줄 높이·글꼴 폭이 한컴과 어긋나던 세 곳 (2026-11-08, 대표 «줄칸 높이 넓이 선겹침 등이 이상하다»)
   ① 글꼴에 어울리는 줄 높이(문단 모양 fontLineHeight=1)를 무시해 함초롬바탕·맑은 고딕 문단의 줄 간격이 23~33% 좁았다.
      한컴이 .hwp 에 저장한 줄 정보(LINE_SEG)로 확인: 바탕화면 .hwp 1,400개·27만 줄 — 옵션이 꺼져 있으면 줄 높이 = 글자 크기(모든 글꼴),
      켜져 있으면 글꼴 고유 배율(함초롬바탕 1.300 · 맑은 고딕 1.331 · 휴먼명조 1.055 …, 바탕·굴림·돋움 같은 옛 글꼴은 1.000).
      글이 없는 문단은 켜져 있어도 글자 크기 그대로.
   ② 기본 글꼴(함초롬바탕)을 «재는 글꼴 목록»과 «그리는 글꼴 목록»이 달랐다 — 함초롬바탕이 PC 에 없으면 그리기는 '바탕', 재기는 브라우저 기본 글꼴이라
      빈칸 보정(word-spacing)이 어긋나 빈칸이 9.5px(한컴 8px)로 글이 4~5% 넓어지고 줄이 더 접혔다.
   ③ 함초롬바탕이 없을 때 한글 글자 폭: 대체 글꼴(1em)이 아니라 한글의 0.968em (한컴 줄 정보·rhwp 로 확인: 0.967~0.979).
   함수를 떠서 «돌려» 본다(되풀이된 실수 ②). ⚠ 값(배율)은 규칙 자체라 박는다.
   node --test tests/hangul-line-height-fonts.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'hangul/js/dom.js'), 'utf8').replace(/\r\n/g, '\n');
const CSS = fs.readFileSync(path.join(R, 'hangul/app.css'), 'utf8').replace(/\r\n/g, '\n');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\n\s*\/\/[^\n]*/g, '\n');
const CODE = strip(SRC);
const constLine = name => { const m = new RegExp('\\n\\s*(const ' + name + ' = [^\\n]*)').exec(CODE); assert.ok(m, name + ' 선언을 못 찾았습니다'); return m[1]; };

/* 줄 높이 계산(lineCss)을 가짜 환경에서 돌린다 */
function loadLineCss() {
  const code = [
    constLine('NATURAL_FACTOR'), 'const naturalFactor = font => NATURAL_FACTOR[font] || 1;',
    constLine('FLH_ON'), constLine('fontLineHeightOn'),
    cutFn(CODE, 'function naturalRunHeight('), cutFn(CODE, 'function lineCss('),
  ].join('\n');
  const g = { PureunHwpx: { parseLangs: () => ({ f: null }) } };
  return new Function('g', 'DEFAULT_FONT', 'LATIN_CH', 'NON_LATIN_CH', 'wordMode',
    code + '\nreturn lineCss;')(g, '함초롬바탕', /[\x21-\x7e¡-ɏ]/, /[^\x00-ɏ]/, false);
}
const para = (font, size, ls, extra) => Object.assign({ runs: [{ text: '근로계약서 내용입니다', font, size }], lineSpacing: ls, pp: '{"fontLineHeight":1}' }, extra || {});
const pt = css => parseFloat(/line-height:([\d.]+)pt/.exec(css)[1]);

test('★★★ 글꼴에 어울리는 줄 높이: 함초롬바탕 12pt 130% → 줄 간격 20.28pt (=27.04px, 한컴이 저장한 27.0px)', () => {
  const lineCss = loadLineCss();
  const css = lineCss(para('함초롬바탕', 12, 130));
  assert.ok(Math.abs(pt(css) - 12 * 1.3 * 1.3) < 0.01, '함초롬바탕 12pt 130% 는 12×1.3×1.3 = 20.28pt 여야 합니다: ' + css); // 검사고정-허용: 한컴 줄 정보로 잰 글꼴 배율 1.300
  assert.ok(Math.abs(pt(css) * 96 / 72 - 27.04) < 0.02, '한컴이 저장한 줄 간격 27.0px 과 같아야 합니다');
});

test('★★ 글꼴마다 한컴이 잰 배율을 쓴다 — 맑은 고딕 1.331 · 휴먼명조 1.055 · 굴림·바탕·돋움 1.000', () => {
  const lineCss = loadLineCss();
  const v = (font, ls) => pt(lineCss(para(font, 10, ls)));
  assert.ok(Math.abs(v('맑은 고딕', 160) - 10 * 1.331 * 1.6) < 0.02);   // 검사고정-허용: 한컴 줄 정보 1,201줄에서 1.331
  assert.ok(Math.abs(v('휴먼명조', 160) - 10 * 1.055 * 1.6) < 0.02);   // 검사고정-허용: 한컴 줄 정보 1,968줄에서 1.055
  assert.ok(Math.abs(v('굴림', 160) - 10 * 1.6) < 0.01, '옛 글꼴은 배율 1.0');
  assert.ok(Math.abs(v('바탕', 130) - 10 * 1.3) < 0.01);
  assert.ok(Math.abs(v('돋움체', 160) - 16) < 0.01);
});

test('★★ 옵션이 꺼져 있으면 예전 그대로다 — 함초롬바탕이어도 글자 크기 × 줄 간격 %', () => {
  const lineCss = loadLineCss();
  assert.strictEqual(lineCss(para('함초롬바탕', 12, 130, { pp: '{"snapToGrid":0}' })), 'line-height:1.3');
  assert.strictEqual(lineCss(para('함초롬바탕', 12, 130, { pp: undefined })), 'line-height:1.3');
  assert.strictEqual(lineCss(para('함초롬바탕', 12, 160, { pp: '{"fontLineHeight":0}' })), '');
});

test('★★ 글이 없는 문단은 옵션이 켜져 있어도 글자 크기 그대로다 (한컴 줄 정보: 빈 문단 줄 높이 = 글자 크기)', () => {
  const lineCss = loadLineCss();
  const css = lineCss({ runs: [], mark: { font: '함초롬바탕', size: 12 }, lineSpacing: 130, pp: '{"fontLineHeight":1}' });
  assert.strictEqual(css, 'line-height:1.3');
});

test('★★ 줄 간격이 «고정값·최소·여백만»이면 건드리지 않는다 — 비율 줄 간격만 바꾼다', () => {
  const lineCss = loadLineCss();
  assert.strictEqual(lineCss(para('함초롬바탕', 12, 160, { lineType: 'FIXED', lineValue: 18 })), 'line-height:18pt');
  assert.strictEqual(lineCss(para('함초롬바탕', 12, 160, { lineType: 'AT_LEAST', lineValue: 10 })), 'line-height:12pt');
  assert.strictEqual(lineCss(para('함초롬바탕', 12, 160, { lineType: 'BETWEEN_LINES', lineValue: 4 })), 'line-height:16pt');
});

test('★★ 글자 크기가 섞이면 가장 높은 글자가 줄 높이를 정한다', () => {
  const lineCss = loadLineCss();
  const b = para('함초롬바탕', 10, 130); b.runs.push({ text: '큰 글자', font: '맑은 고딕', size: 14 });
  assert.ok(Math.abs(pt(lineCss(b)) - 14 * 1.331 * 1.3) < 0.02);
});

test('★★★ 재는 글꼴 목록 = 그리는 글꼴 목록 — 기본 글꼴(함초롬바탕)의 목록이 app.css 의 .doc 글꼴 목록과 같다', () => {
  const m = /\n\.doc \{[^}]*?font-family:\s*([^;]+);/.exec(CSS);
  assert.ok(m, 'app.css 의 .doc font-family 를 못 찾았습니다');
  const norm = s => s.replace(/['"]/g, '').split(',').map(x => x.trim()).filter(Boolean);
  const stack = /const DEFAULT_STACK = `([^`]+)`/.exec(CODE);
  assert.ok(stack, 'DEFAULT_STACK 선언을 못 찾았습니다');
  assert.deepStrictEqual(norm(stack[1].replace('${DEFAULT_FONT}', '함초롬바탕')), norm(m[1]), '재는 목록과 그리는 목록이 다르면 글꼴이 PC 에 없을 때 빈칸·글자 폭 보정이 어긋납니다');
  const fn = cutFn(CODE, 'function fontList(');
  assert.match(fn, /font === DEFAULT_FONT\) return DEFAULT_STACK/, 'fontList 가 기본 글꼴에 같은 목록을 돌려줘야 합니다');
});

test('★★ 기본 글꼴 목록은 실제로 돌려준다 — fontList(기본 글꼴) = CSS 목록, 다른 글꼴은 예전처럼 «대체 글꼴 + 한컴바탕»', () => {
  const code = [constLine('MISSING_FONT'), 'const DEFAULT_STACK = `\'${DEFAULT_FONT}\',\'HCR Batang\',\'바탕\',\'Batang\',serif`;', cutFn(CODE, 'function fontList(')].join('\n');
  const fontList = new Function('DEFAULT_FONT', 'hftSubst', 'fontAvail', 'FONT_ALT', code + '\nreturn fontList;')('함초롬바탕', new Map(), () => true, {});
  assert.strictEqual(fontList('함초롬바탕'), "'함초롬바탕','HCR Batang','바탕','Batang',serif");
  assert.strictEqual(fontList('굴림'), "'굴림','한컴바탕'");
});

test('★★ 함초롬바탕이 PC 에 없으면 한글 글자 폭은 0.968em, 있으면 재서 나온 값 그대로', () => {
  const code = [constLine('normCh'), cutFn(CODE, 'function charEm(')].join('\n');
  let avail = false;
  const cache = new Map();
  const cx = { font: '', measureText: () => ({ width: 100 }) };
  const charEm = new Function('DEFAULT_FONT', 'hftSymEm', 'fontAvail', 'fontList', 'charCache', 'measCtx', 'document',
    code + '\nreturn charEm;')('함초롬바탕', () => 0, () => avail, f => "'" + f + "'", cache, cx, { createElement: () => ({ getContext: () => cx }) });
  assert.strictEqual(charEm('한', '함초롬바탕', false), 0.968, '없을 때 한글은 0.968em 이어야 합니다'); // 검사고정-허용: 한컴 줄 정보·rhwp 로 잰 함초롬바탕 한글 폭
  assert.strictEqual(charEm('A', '함초롬바탕', false), 1, '한글이 아닌 글자는 잰 값 그대로(여기서는 가짜 100px → 1em)');
  assert.strictEqual(charEm('한', '굴림', false), 1, '다른 글꼴은 잰 값 그대로');
  avail = true; cache.clear();
  assert.strictEqual(charEm('한', '함초롬바탕', false), 1, '글꼴이 있으면 재서 나온 값을 따릅니다');
});

test('★★ 문단 모양 대화상자가 줄 높이를 다시 셀 때: 글 조각마다 크기·글꼴을 보고, 문단 번호(.phead)는 글로 치지 않는다 (자동 검토 «낮음»)', () => {
  const mkHost = (fontSize, family, inPhead) => ({ closest: sel => (sel === '.phead' && inPhead ? {} : null), _c: { fontSize, fontFamily: family } });
  const nodes = [
    { nodeValue: '1.', parentElement: mkHost('13.333px', '"맑은 고딕", sans-serif', true) },   // 문단 번호 — 건너뜀
    { nodeValue: '본문 열 포인트', parentElement: mkHost('13.333px', '"함초롬바탕", serif', false) },
    { nodeValue: '큰 글자', parentElement: mkHost('18.667px', '"맑은 고딕", sans-serif', false) },
    { nodeValue: '', parentElement: mkHost('13.333px', 'x', false) },
  ];
  let i = 0;
  const doc = { createTreeWalker: () => ({ nextNode: () => nodes[i++] || null }) };
  const fn = new Function('document', 'NodeFilter', 'getComputedStyle', cutFn(CODE, 'function paraTextRuns(') + '\nreturn paraTextRuns;')(
    doc, { SHOW_TEXT: 4 }, host => host._c);
  const runs = fn({ closest: () => null });
  assert.deepStrictEqual(runs.map(r => r.text), ['본문 열 포인트', '큰 글자'], '문단 번호·빈 글 조각은 빼야 합니다');
  assert.deepStrictEqual(runs.map(r => Math.round(r.size)), [10, 14]);
  assert.deepStrictEqual(runs.map(r => r.font), ['함초롬바탕', '맑은 고딕'], '글꼴은 따옴표를 벗긴 첫 이름');
  // 가장 높은 조각이 줄 높이를 정한다 → 14pt 맑은 고딕 × 1.331 × 1.3
  const lineCss = loadLineCss();
  assert.ok(Math.abs(pt(lineCss({ runs, lineSpacing: 130, pp: '{"fontLineHeight":1}' })) - 14 * 1.331 * 1.3) < 0.02);
  // 문단 번호뿐인 문단은 글 조각이 없다 → 건드리지 않는 쪽으로
  i = 0; nodes.length = 1;
  assert.deepStrictEqual(fn({ closest: () => null }), []);
});

test('★ 소스에 남아 있다 — 글이 있는 비율 줄 간격 문단만, 워드 호환이 아닐 때', () => {
  const fn = cutFn(CODE, 'function lineCss(');
  assert.match(fn, /!wordMode && fontLineHeightOn\(b\)/);
  assert.match(CODE, /\(!b\.lineType \|\| b\.lineType === 'PERCENT'\) && typeof b\.pp === 'string' && FLH_ON\.test\(b\.pp\) && \(b\.runs \|\| \[\]\)\.some\(r => r\.text\)/);
});
