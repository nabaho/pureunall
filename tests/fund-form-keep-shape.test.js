/* 서식을 화면에 올릴 때 «원본 한글의 모양»이 살아남는가
 *
 * 대표 지시 2026-09-23
 *   「편집하려고 하면 계속 문제가 발생하고 글자나 줄간격등이 계속 엉망이 된다.
 *    이부분 어떻게 근본적으로 해결이 안될까 서식 전체에 대해서 검토해달라.」
 *   → 전·후 비교를 보고 「네, 고쳐라」
 *
 * 무엇이 잘못돼 있었나 (시험대에서 실제로 잰 값)
 *   화면에 올리는 단계(sanitizeDocHTML → _docTypeset → typesetForm)가 문단을 «글자만 남기고»
 *   새로 만들었다. 그 바람에
 *     · 원본 한글에서 옮겨 온 줄간격·정렬(style)이 — 회의록 78줄, 정관 114줄 — 전부 사라졌고
 *     · 의안·경과보고를 새 장에서 시작하게 하는 표시(data-newpage)가 — 회의록 4곳 — 전부 사라졌고
 *     · 「Ⅰ. 개 회」「Ⅳ. 폐 회」처럼 자간을 벌린 제목을 서명란으로 잘못 보고 두 칸(fmcols)으로 쪼갰다.
 *   화면에 오기 «전»의 일이라 어느 서식에서나 똑같이 일어났다.
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 여기 글은 전부 원본 양식(빈 서식)이거나 가짜다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
/* 줄째로 꺼내기 — 정규식 상수 안의 [ 에 걸리지 않게 */
function grabLine(n) {
  const m = SRC.match(new RegExp('var ' + n + '=[^\\n]*?;'));
  assert.ok(m, 'fund.html 에 상수가 없다: ' + n);
  return m[0];
}

let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

/* 화면에 올리는 단계만 싣는다 — 서식을 «채우는» 일과는 떼어서 본다 */
const TYPESET = ['DG_MARK', 'DG_BULLET', 'FM_TITLE', 'FM_SPACED', 'FM_DATE', 'FM_DATE2', 'FM_TO', 'FM_SIGN',
  'FM_JO', 'FM_HANG', 'FM_HO', 'FM_MOK', 'FM_BUL', 'FM_LAW', 'FM_SENT'];
const TYPESET_FN = ['_fmSpacedTitle', '_fmCols', '_fmClean', '_fmText', '_fmBlock', '_fmHwpAttrs',
  'typesetForm', '_docTypeset', 'sanitizeDocHTML'];

function boot() {
  const dom = new JSDOM('<!doctype html><body></body>');
  global.window = dom.window; global.document = dom.window.document; global.NodeFilter = dom.window.NodeFilter;
  global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  (0, eval)(fs.readFileSync(path.join(ROOT, 'fund_forms.js'), 'utf8'));
  (0, eval)(TYPESET.map(grabLine).concat(TYPESET_FN.map(grabFn)).join('\n'));
  return dom;
}
const el = (dom, html) => { const d = dom.window.document.createElement('div'); d.innerHTML = html; return d; };
/* 표 밖 문단 가운데 원본 줄간격·정렬을 달고 있는 것 */
const styledBlocks = (root) => [].filter.call(root.querySelectorAll('p,div,h1'),
  (e) => !e.closest('table') && /line-height|text-align/.test(e.getAttribute('style') || ''));

/* ══════════ ① 원본 모양이 살아남는다 ══════════ */

['minutes', 'charter', 'charter_sane', 'bizplan'].forEach((kind) => {
  test('★★ ' + kind + ' — 원본 한글의 줄간격·정렬이 화면에서 하나도 안 사라진다', (t) => {
    if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
    const dom = boot();
    const raw = window.HWP_FORMS[kind];
    assert.ok(raw, kind + ' 원본이 fund_forms.js 에 없다');
    const before = styledBlocks(el(dom, raw)).length;
    const after = styledBlocks(el(dom, sanitizeDocHTML(raw))).length;
    assert.ok(before > 0, kind + ' 원본에 줄간격이 달린 문단이 있어야 시험이 뜻이 있다');
    /* ⚠ 여러 줄이 <br> 로 묶인 문단은 줄마다 갈라지므로 «늘 수는» 있다 — 줄면 안 된다 */
    assert.ok(after >= before, kind + ': 원본 줄간격·정렬 ' + before + '줄 → 화면 ' + after + '줄 (사라졌다)');
  });
});

test('★★ 새 장 표시(data-newpage)가 화면에 오기 전에 사라지지 않는다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  /* fillMinutesPages 가 의안·경과보고 문단에 다는 표시 그대로 — 원본 style 도 달려 있다 */
  const raw = '<p style="text-align:center;line-height:160%">가나 회의록</p>'
    + '<p style="line-height:160%">본문 한 줄</p>'
    + '<p style="line-height:160%" data-newpage="1" data-kept="1">- 의안 2호 이사 선임(안)</p>'
    + '<p style="line-height:160%" data-newpage="1" data-kept="1">경     과     보     고</p>';
  const out = el(dom, sanitizeDocHTML(raw));
  assert.equal(out.querySelectorAll('[data-newpage]').length, 2, '의안·경과보고의 새 장 표시가 사라졌다');
  assert.equal(out.querySelectorAll('[data-kept]').length, 2, '걷어내기를 비껴가는 표시(data-kept)도 남아야 한다');
});

test('★ 여러 줄로 갈라져도 새 장 표시는 «첫 줄»에만 — 줄마다 붙으면 줄마다 새 장이 생긴다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const out = el(dom, sanitizeDocHTML('<p style="line-height:180%" data-newpage="1">첫 줄<br>둘째 줄<br>셋째 줄</p>'));
  const blocks = [].filter.call(out.children, (e) => e.textContent.trim());
  assert.equal(blocks.length, 3, '<br> 로 묶인 줄은 줄마다 갈라진다(종전과 같다)');
  assert.equal(out.querySelectorAll('[data-newpage]').length, 1);
  assert.ok(blocks[0].hasAttribute('data-newpage'), '새 장 표시는 첫 줄에 있어야 한다');
  blocks.forEach((b) => assert.match(b.getAttribute('style') || '', /line-height:180%/, '줄간격은 갈라진 줄마다 남아야 한다'));
});

/* ══════════ ② 자간 벌린 제목을 두 칸으로 쪼개지 않는다 ══════════ */

test('★★ 「Ⅰ. 개 회」 처럼 원본에서 온 줄은 두 칸(fmcols)으로 쪼개지 않는다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const out = el(dom, sanitizeDocHTML(window.HWP_FORMS.minutes));
  const cols = [].map.call(out.querySelectorAll('.fmcols'), (e) => e.textContent.replace(/\s+/g, ' ').trim());
  assert.deepEqual(cols, [], '원본 줄이 두 칸으로 쪼개졌다: ' + cols.join(' / '));
});

test('원본에서 «안 온» 줄(모양 표시가 없는 줄)은 종전처럼 칸을 나눈다 — 서명란이 그렇다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const out = el(dom, sanitizeDocHTML('<p>근로자대표 박근로 (인)          대표이사 김대표 (인)</p>'));
  assert.equal(out.querySelectorAll('.fmcols').length, 1, '모양 표시가 없는 서명란은 두 칸으로 앉혀야 한다');
});

/* ══════════ ③ 제목 강조는 그대로 ══════════ */

test('★ 제목은 여전히 제목(h1.fmtitle)이다 — 원본 모양을 지키느라 제목 강조를 잃으면 안 된다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const out = el(dom, sanitizeDocHTML('<p style="text-align:center;line-height:150%">기 금 출 연 확 인 서</p><p style="line-height:160%">본문</p>'));
  const h = out.querySelector('h1.fmtitle');
  assert.ok(h, '자간 벌린 서식명은 제목이어야 한다');
  assert.match(h.getAttribute('style') || '', /text-align:center/, '제목에도 원본 정렬이 남아야 한다');
});

/* ══════════ ④ 여러 번 올려도 같다 ══════════ */

test('★★ 두 번 올려도 결과가 같다 — 저장본을 다시 열 때마다 모양이 바뀌면 안 된다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  ['minutes', 'charter', 'agreement', 'inka'].forEach((k) => {
    const once = sanitizeDocHTML(window.HWP_FORMS[k]);
    assert.equal(sanitizeDocHTML(once), once, k + ' 은 두 번째에 모양이 또 바뀐다');
  });
});

/* ══════════ ⑤ 배선 ══════════ */

test('원본 모양을 옮겨 다는 일은 한 곳(_fmHwpAttrs)에서만 한다', () => {
  const fn = grabFn('typesetForm');
  assert.match(fn, /_fmHwpAttrs\(/, 'typesetForm 이 원본 모양을 옮겨 달아야 한다');
  assert.equal((SRC.match(/function _fmHwpAttrs\(/g) || []).length, 1);
});
