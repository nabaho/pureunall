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

/* ══ ③ 한글 조합(IME) ═════════════════════════════════════════════════
 * 대표 지시 2026-09-20 「이동확인은되는데 «수정이 이상하다»」
 *
 * ▣ 무엇이 문제였나 — 한글은 낱자를 모아 한 글자를 만든다(ㄱ→가→각). 그 «조합»
 *   이 끝나기 전에도 input 이 (isComposing=true 로) 터진다. 400ms 만 멈칫하면
 *   _autoRepaginate 가 돌고, _repaginateCore 는 innerHTML 을 «새로 쓴다» —
 *   조합중이던 글마디(텍스트 노드)가 통째로 버려진다. 브라우저 조합기는 바로
 *   그 마디를 붙들고 있으므로 글자가 겹치거나·사라지거나·엉뚱한 곳에 박힌다.
 *   («쪽 넘김»은 멀쩡한데 «글자 치기»만 이상했던 이유가 이것이다.)
 *
 * ▣ 실제 브라우저에서 재현했다 — 조합중 마디가 isConnected=false 가 되고 쪽이
 *   8→13 장으로 조합 도중에 다시 나뉘었다.
 *
 * ▣ 어떻게 고쳤나 — 조합중엔 미루고(_ime 표), 조합이 «끝난 뒤» 한 번만 돈다.
 */

/* _showDocHTML 안의 «배선 토막»만 떼어내 진짜로 돌려 본다 */
function grabWiring() {
  const s = 코드만(grabFn('_showDocHTML'));
  const i = s.indexOf("if(ed&&!ed._dirtyBound)");
  assert.ok(i >= 0, '입력창 배선 토막을 못 찾았다');
  let d = 0, on = false;
  for (let j = s.indexOf('{', i); j < s.length; j++) {
    const c = s[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return s.slice(i, j + 1); }
  }
  throw new Error('배선 토막 끝을 못 찾음');
}

test('★★ ⑧ 한글 조합중(isComposing)엔 다시 나누기를 «예약조차» 안 한다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const dom = new JSDOM('<!doctype html><body><div id="doced" contenteditable="true"></div></body>');
  const win = dom.window, doc = win.document;
  const 부름 = [];
  const run = new Function('document', 'window', 'setTimeout', 'clearTimeout',
    '$', 'markDirty', '_autoRepaginate', 'ed', grabWiring());
  const timers = new Map(); let seq = 0;
  const st = (fn, ms) => { const id = ++seq; timers.set(id, fn); return id; };
  const ct = (id) => { timers.delete(id); };
  const ed = doc.getElementById('doced');
  run(doc, win, st, ct, (id) => doc.getElementById(id), () => {}, () => 부름.push('돌았다'), ed);
  const 타이머수 = () => timers.size;

  /* 조합 시작 → 조합중 input */
  ed.dispatchEvent(new win.CompositionEvent('compositionstart', { bubbles: true }));
  const e = new win.InputEvent('input', { bubbles: true, isComposing: true, data: 'ㄱ' });
  ed.dispatchEvent(e);
  assert.equal(타이머수(), 0,
    '★ 한글을 조합하는 «도중»에 다시 나누기를 예약했습니다 — 치던 글자가 깨집니다.');

  /* 조합 끝 → 이제는 예약돼야 한다 */
  ed.dispatchEvent(new win.CompositionEvent('compositionend', { bubbles: true, data: '각' }));
  assert.equal(타이머수(), 1, '★ 조합이 «끝난 뒤»에도 다시 나누기를 안 겁니다 — 영영 안 나뉩니다.');
  timers.forEach((fn) => fn());
  assert.deepEqual(부름, ['돌았다'], '★ 조합이 끝났는데 다시 나누기가 안 돌았습니다.');

  /* 조합 끝난 뒤의 보통 타이핑은 여전히 예약된다 */
  timers.clear();
  ed.dispatchEvent(new win.InputEvent('input', { bubbles: true, isComposing: false }));
  assert.equal(타이머수(), 1, '★ 조합이 아닌 보통 타이핑까지 막아버렸습니다.');
});

test('★★ ⑨ 조합이 «시작»되면 이미 걸려 있던 예약을 끈다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const dom = new JSDOM('<!doctype html><body><div id="doced" contenteditable="true"></div></body>');
  const win = dom.window, doc = win.document;
  const timers = new Map(); let seq = 0;
  const run = new Function('document', 'window', 'setTimeout', 'clearTimeout',
    '$', 'markDirty', '_autoRepaginate', 'ed', grabWiring());
  const ed = doc.getElementById('doced');
  run(doc, win, (fn) => { const id = ++seq; timers.set(id, fn); return id; }, (id) => timers.delete(id),
    (id) => doc.getElementById(id), () => {}, () => {}, ed);

  ed.dispatchEvent(new win.InputEvent('input', { bubbles: true, isComposing: false }));
  assert.equal(timers.size, 1, '보통 타이핑은 예약돼야 한다');
  ed.dispatchEvent(new win.CompositionEvent('compositionstart', { bubbles: true }));
  assert.equal(timers.size, 0,
    '★ 조합이 시작됐는데 «앞서 걸린» 예약이 그대로 남아 있습니다 — 조합 도중에 터집니다.');
});

test('★★ ⑩ _autoRepaginate 자체에도 «조합중» 방어턱이 있다', () => {
  const auto = 코드만(grabFn('_autoRepaginate'));
  const i = auto.indexOf('ed._ime'), j = auto.indexOf('markA4Overflow');
  assert.ok(i >= 0, '★ _autoRepaginate 가 조합중인지 안 봅니다 — 다른 데서 부르면 또 깨집니다.');
  assert.ok(i < j, '★ 조합중 검사가 «다시 나누기 전»에 있지 않습니다.');
  assert.match(auto, /if\(ed\._ime\)\{\s*return;\s*\}/,
    '★ 조합중일 때 그냥 돌아가지 않습니다.');
});

test('★★ ⑪ 입력 처리기가 isComposing 과 _ime 를 «둘 다» 본다', () => {
  const w = 코드만(grabWiring());
  assert.match(w, /addEventListener\('compositionstart'/, '★ 조합 시작을 안 듣습니다.');
  assert.match(w, /addEventListener\('compositionend'/, '★ 조합 끝을 안 듣습니다.');
  assert.match(w, /if\(ed\._ime\|\|\(e&&e\.isComposing\)\)\s*return;/,
    '★ 조합중 건너뛰기가 없습니다 — 브라우저마다 둘 중 하나만 맞을 때가 있어 «둘 다» 봐야 합니다.');
  const iSkip = w.indexOf('e.isComposing'), iArm = w.indexOf('_ovT=setTimeout', w.indexOf("'input'"));
  assert.ok(iSkip >= 0 && iSkip < iArm,
    '★ 건너뛰기가 예약보다 «뒤»에 있습니다 — 막아도 이미 예약된 뒤입니다.');
});
