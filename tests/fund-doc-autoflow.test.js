'use strict';
/* 타이핑하다 쪽을 넘기면 «한글 프로그램처럼» 저절로 다음 장으로 넘어간다
 * (대표 지시 2026-09-20 「다음페이지로 넘어가야되는데 왜 안되나 한글 프로그램
 *   편집하듯이 그렇게 가능하게 해달라 전체서식들」 — 페이지가 크게 넘쳐 빈
 *   자리가 생긴 화면을 첨부, [다시 나누기]를 사람이 눌러야 하는 것을 지적)
 *
 * ▣ 무엇이 문제였나 — 종전엔 쪽이 넘치면 빨간 배지("이 쪽을 넘칩니다 — [다시
 *   나누기]")만 뜨고, 사람이 그 단추를 «직접 눌러야» 다시 나뉘었다. 자동으로
 *   되지 않았다.
 *
 * ▣ 왜 그냥 자동으로 돌리면 안 됐나 — paginateDoc() 은 #doced 를 «통째로 다시
 *   그린다»(innerHTML 을 새로 씀). 타이핑 중에 이걸 그냥 자동으로 돌리면 «커서
 *   자리가 사라져» 다음 글자가 엉뚱한 곳에 써지는, 자동으로 되니 «더 나쁜»
 *   경험이 될 뻔했다.
 *
 * ▣ 어떻게 고쳤나 — 다시 나누기 «전» 커서 자리에 빈 <span id="__caretMark__">
 *   를 심어 둔다. paginateDoc 은 문단을 «통째로» 옮기지(글자를 하나씩 다시
 *   쓰지 않는다) 그 표시도 문단과 함께 새 장으로 따라간다. 다시 나눈 뒤 그
 *   표시를 찾아 커서를 그 자리로 되돌리고 표시는 지운다.
 *
 * ▣ 전체서식들 — 이 자동 다시 나누기는 «입력창(#doced) 하나»에 걸려 있다.
 *   서식마다 따로 만들지 않았으니 모든 서식이 같이 이 혜택을 받는다.
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

/* ══ ① 배선 — 자동으로 걸려 있는가, 알림이 시끄럽지 않은가 ══════════ */

test('★★ ① 타이핑 입력창이 markA4Overflow 대신 _autoRepaginate 를 쓴다', () => {
  const showDocHTML = 코드만(grabFn('_showDocHTML'));
  assert.match(showDocHTML, /ed\._ovT=setTimeout\(_autoRepaginate,400\)/,
    '★ 타이핑 뒤(디바운스) 자동 다시 나누기를 안 겁니다 — 예전처럼 배지만 뜹니다.');
  assert.ok(!/ed\._ovT=setTimeout\(function\(\)\{ markA4Overflow\(\); fitDocA4\(\); \}/.test(SRC),
    '★ 옛 방식(배지만 띄우고 마는)이 아직 남아 있습니다.');
});

test('★★ ② 자동 쪽에는 알림(toast)이 없다 — 단추를 눌렀을 때만 알린다', () => {
  const auto = 코드만(grabFn('_autoRepaginate'));
  const manual = 코드만(grabFn('repaginateDoc'));
  assert.ok(!/toast\(/.test(auto), '★ 자동 다시 나누기가 타이핑마다 알림을 띄웁니다 — 시끄럽습니다.');
  assert.match(manual, /toast\('쪽을 다시 나눴습니다'\)/, '★ [다시 나누기] 단추를 눌렀을 때 알림이 없습니다.');
  assert.match(auto, /_repaginateCore\(\)/, '★ 자동 쪽이 실제 다시 나누기를 안 부릅니다.');
  assert.match(manual, /_repaginateCore\(\)/, '★ 단추 쪽이 실제 다시 나누기를 안 부릅니다.');
});

test('★★ ③ 안 넘쳤으면 다시 나누지 않는다 — 배율만 다시 맞춘다', () => {
  const auto = 코드만(grabFn('_autoRepaginate'));
  assert.match(auto, /if\(!markA4Overflow\(\)\)\{\s*fitDocA4\(\);\s*return;\s*\}/,
    '★ 안 넘쳤을 때도 다시 나눕니다 — 타이핑마다 쓸데없이 쪽을 새로 그립니다.');
});

test('★★ ④ 다시 나누기 «전»에 커서 자리를 심고, «후»에 되돌린다', () => {
  const auto = 코드만(grabFn('_autoRepaginate'));
  const 심기 = auto.indexOf('_saveCaretMarker'), 나누기 = auto.indexOf('_repaginateCore'), 되돌리기 = auto.indexOf('_restoreCaretMarker');
  assert.ok(심기 >= 0 && 나누기 > 심기 && 되돌리기 > 나누기,
    '★ 「심기 → 다시 나누기 → 되돌리기」 차례가 아닙니다 — 차례가 바뀌면 커서가 엉뚱한 곳에 남습니다.');
});

/* ══ ② 커서 표시 — 진짜 DOM 에서 심고 되찾는지 ══════════════════════ */

test('★★ ⑤ 커서 자리에 표시를 심고, 문단이 «통째로 옮겨져도» 표시로 되찾는다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const dom = new JSDOM('<!doctype html><body><div id="doced" contenteditable="true">'
    + '<p>안녕하세요</p></div></body>');
  const doc = dom.window.document, win = dom.window;
  const box = {};
  new Function('document', 'window', grabFn('_saveCaretMarker') + '\n' + grabFn('_restoreCaretMarker')
    + ';this.save=_saveCaretMarker;this.restore=_restoreCaretMarker;')
    .call(box, doc, win);

  const root = doc.getElementById('doced');
  const p = root.querySelector('p');
  const textNode = p.firstChild;                 // "안녕하세요"
  const range = doc.createRange();
  range.setStart(textNode, 2);                    // "안녕" 다음 자리에 커서
  range.collapse(true);
  win.getSelection().removeAllRanges();
  win.getSelection().addRange(range);

  const marker = box.save(root);
  assert.ok(marker, '★ 커서 표시를 못 심었습니다.');
  assert.equal(marker.id, '__caretMark__');
  assert.ok(p.contains(marker), '★ 표시가 그 문단 안에 없습니다 — 문단과 같이 못 옮겨집니다.');
  /* 글이 정확히 나뉘었는지 — "안녕" + 표시 + "하세요" */
  assert.equal(p.textContent, '안녕하세요', '★ 표시를 심으면서 글자가 달라졌습니다.');

  /* paginateDoc 이 하듯 «문단을 통째로» 다른 자리로 옮긴다(진짜 다시 그리기 흉내) */
  const newHome = doc.createElement('div');
  newHome.appendChild(p);                          // 표시가 든 문단째 옮긴다
  root.innerHTML = '';
  root.appendChild(newHome);

  const ok = box.restore(root);
  assert.ok(ok, '★ 옮긴 뒤 표시를 못 찾았습니다.');
  assert.ok(!root.querySelector('#__caretMark__'), '★ 표시를 안 지웠습니다 — 화면에 흔적이 남습니다.');
  const sel = win.getSelection();
  assert.equal(sel.rangeCount, 1, '★ 커서가 안 돌아왔습니다.');
  assert.equal(sel.getRangeAt(0).collapsed, true, '★ 커서가 아니라 범위가 선택됐습니다.');
});

test('★ 글을 «고른» 채(선택 범위)면 표시를 심지 않는다 — 지우면 안 되는 글이 지워질 수 있다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const dom = new JSDOM('<!doctype html><body><div id="doced" contenteditable="true">'
    + '<p>안녕하세요</p></div></body>');
  const doc = dom.window.document, win = dom.window;
  const box = {};
  new Function('document', 'window', grabFn('_saveCaretMarker') + ';this.save=_saveCaretMarker;')
    .call(box, doc, win);
  const root = doc.getElementById('doced');
  const textNode = root.querySelector('p').firstChild;
  const range = doc.createRange();
  range.setStart(textNode, 0); range.setEnd(textNode, 2);   // "안녕"을 고른 상태(collapsed 아님)
  win.getSelection().removeAllRanges();
  win.getSelection().addRange(range);

  const marker = box.save(root);
  assert.equal(marker, null, '★ 선택 범위가 있는데도 표시를 심었습니다.');
});

test('★ 표시가 없으면 «조용히» 넘어간다 — 되돌릴 것이 없을 때 죽지 않는다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const dom = new JSDOM('<!doctype html><body><div id="doced"><p>글</p></div></body>');
  const box = {};
  new Function('document', 'window', grabFn('_restoreCaretMarker') + ';this.restore=_restoreCaretMarker;')
    .call(box, dom.window.document, dom.window);
  const root = dom.window.document.getElementById('doced');
  assert.equal(box.restore(root), false, '★ 표시가 없을 때 false 를 안 돌려줍니다.');
});
