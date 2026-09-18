'use strict';
/* 🔍 다시 넣기 — 더 큰 캡처로 바꾸고 다시 읽기 (대표 결정 2026-09-18 「이대로」)
   실행: node --test tests/photos-repaste-popup.test.js
   목업 docs/mockups/photos-repaste-popup.html

   ■ 무엇이 없었나
   대표: 「화면인식이 잘 안 되는 경우 다시 한번 더 여기에 넣어서 수정했으면 좋겠는데
         그 기능 만들어 달라. 캡쳐2는 팝업 형태로 내용이 나와서 확인하게 해라」
   「원본이 작습니다」 상자는 **더 크게 받는 법만** 알려 주고 정작 «넣는 자리»가 없었다.
   정부포털 화면은 그것이 원본이라 앱 안에서 더 큰 것을 받을 길이 아예 없었다.

   ■ ★★ 못 박는 것
   ① 사진 번호(id)가 «안 바뀐다» — 있는 자리에 본문만 새로 쓴다(replaceImage).
      바뀌면 기업정보함 연결·서류 묶음·보낸 기록이 통째로 끊기고,
      「같은 서류를 다시 읽은 것」이 아니게 되어 기업 상세도 안 고쳐진다.
   ② 다시 읽기는 **요금이 든다** — 「사진만 바꾸기」(0원)와 반드시 갈라 둔다.
   ③ 더 «작은» 것으로 바꿀 때는 묻는다 — 모르고 나쁘게 바꾸면 되돌릴 길이 없다.
   ④ 한 창을 여러 일에 돌려 쓰므로 닫을 때 반드시 되돌린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripComments, stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const PHOTOS = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
const 몸통 = stripComments(PHOTOS);

/* ══════ ① 한 줄로 접고, 누르면 팝업 ═══════════════════════════════ */

test('★★★ 「원본이 작습니다」가 «한 줄»이고 누르면 팝업이 열린다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function smallBox(') || '');
  assert.ok(fn, 'smallBox 가 없습니다');
  assert.match(fn, /onclick="openRepaste\(/,
    '★★★ 안내만 있고 «넣는 자리»가 없으면, 더 큰 캡처를 받을 길이 앱 안에 없습니다');
  assert.match(fn, /다시 넣기 →/, '★★ 누를 수 있다는 것이 보여야 합니다');
});

test('★★★ 안내는 «사라지지 않는다» — 팝업 안에 그대로 있다', () => {
  assert.match(몸통, /function biggerTipsHtml\(\)/,
    '★★★ 접으면서 안내까지 없애면 「어떻게 크게 받나」를 알 길이 사라집니다');
  const tips = stripJs(cutFn(PHOTOS, 'function biggerTipsHtml(') || '');
  assert.match(tips, /PDF로 저장해 올리기/);
  assert.match(tips, /150~200%/);
  const paint = stripJs(cutFn(PHOTOS, 'function paintRepaste(') || '');
  assert.match(paint, /biggerTipsHtml\(\)/, '★★ 팝업이 그 안내를 안 부르면 어디에도 안 남습니다');
});

test('★★ 안내를 «한 곳에서만» 만든다 — 두 곳에 적으면 서로 다른 말을 한다', () => {
  const n = (몸통.match(/PDF로 저장해 올리기/g) || []).length;
  assert.equal(n, 1, '★★ 안내가 ' + n + '곳에 적혀 있습니다 — 한쪽만 고쳐집니다');
});

test('★★ 남의 사진에는 «다시 넣기»를 안 낸다 — 눌러도 안 되는 단추다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function smallBox(') || '');
  assert.match(fn, /mayTouch\(it\.id\)/);
  const open = stripJs(cutFn(PHOTOS, 'function openRepaste(') || '');
  assert.match(open, /blockedIfOther\(id\)/, '★★ 창을 여는 쪽에서도 막아야 합니다');
});

/* ══════ ② 넣는 자리 — 붙여넣기·끌어다 놓기·파일 ═══════════════════ */

test('★★★ 붙여넣기(Ctrl+V)로 받는다 — 「여기에 넣어서」가 이 기능의 알맹이다', () => {
  assert.match(몸통, /addEventListener\('paste'/,
    '★★★ 캡처는 대개 «복사»로 옵니다 — 붙여넣기가 없으면 파일로 저장부터 해야 합니다');
  /* ⚠ 사진첩에는 붙여넣기 길이 «둘»이다 — 아무 데나 붙여넣어 올리는 window 쪽과,
     다시 넣기 창이 받는 document 쪽. 창 쪽을 콕 집어 본다. */
  const i = 몸통.indexOf("document.addEventListener('paste'");
  assert.ok(i >= 0, '창 쪽 붙여넣기를 못 찾았습니다');
  const 덩이 = 몸통.slice(i, i + 700);
  assert.match(덩이, /if \(!_repaste \|\| !kindPopupOpen\(\)\) return;/,
    '★★★ 창이 닫혀 있을 때도 받으면, 사진첩 아무 데서나 붙여넣은 것이 엉뚱한 사진을 바꿉니다');
  assert.match(덩이, /takeRepasteFile\(\[f\]\)/, '★★ 붙여넣은 것을 받는 자리가 없습니다');
});

test('★★ 끌어다 놓기와 파일 고르기도 된다', () => {
  const paint = stripJs(cutFn(PHOTOS, 'function paintRepaste(') || '');
  assert.match(paint, /ondrop = function/);
  assert.match(paint, /repasteInput[^)]*\)\.click\(\)/, '★★ 파일로 고르는 길이 없습니다');
  assert.match(몸통, /id="repasteInput"/, '★★ 파일 칸이 없습니다');
});

test('★★★ 받는 칸을 «따로» 둔다 — 본문 다시 올리기는 받자마자 올린다', () => {
  assert.match(몸통, /id="repasteInput"[^>]*onchange="onRepasteFile/);
  assert.match(몸통, /id="reuploadInput"[^>]*onchange="onReuploadFile/,
    '★★★ 한 칸을 같이 쓰면, 다시 넣기가 크기를 보여 주기도 전에 올려 버립니다');
});

test('★★ 그림이 아니면 안 받는다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function takeRepasteFile(') || '');
  assert.match(fn, /\^image\\\//, '★★ PDF·문서를 넣으면 그림이 아니라고 말해야 합니다');
});

test('★★★ 파일을 «그대로» 쥔다 — 글자로 바꾸면 줄이는 층이 깨진다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function takeRepasteFile(') || '');
  assert.match(fn, /_repaste\.file = f;/,
    '★★★ decodeImage 는 Blob 을 받습니다 — dataURL 을 넘기면 그 층이 통째로 깨집니다');
  assert.match(fn, /URL\.revokeObjectURL\(url\)/,
    '★★ 잰 뒤 주소를 안 놓으면 큰 캡처가 메모리에 쌓입니다');
  const apply = stripJs(cutFn(PHOTOS, 'async function repasteApply(') || '');
  assert.match(apply, /shrinkMany\(r\.file,/);
});

test('★★★ 아무 데나 붙여넣기가 이 창을 «덮치지 않는다» — 사진이 한 장 더 쌓인다', () => {
  /* ⚠ 사진첩에는 「아무 데나 붙여넣으면 새 사진으로 올린다」는 길이 먼저 있었다.
     창이 열린 채로 붙여넣으면 그 길이 먼저 받아, 바꾸려던 캡처가 **새 사진으로
     한 장 더 쌓이고** 정작 바꾸려던 사진은 그대로 남는다. */
  const i = 몸통.indexOf("window.addEventListener('paste'");
  assert.ok(i >= 0, '아무 데나 붙여넣기 길을 못 찾았습니다');
  const 덩이 = 몸통.slice(i, i + 700);
  assert.match(덩이, /if \(_repaste && kindPopupOpen\(\)\) return;/,
    '★★★ 창이 열려 있을 때 여기가 안 비키면, 붙여넣을 때마다 사진이 한 장씩 더 생깁니다');
  /* 차례에도 기대지 않는다 — 창 쪽이 전파를 끊는다 */
  const j = 몸통.indexOf("document.addEventListener('paste'");
  assert.match(몸통.slice(j, j + 700), /e\.stopPropagation\(\)/,
    '★★ 전파를 안 끊으면 두 길이 같은 붙여넣기를 두 번 처리합니다');
});

/* ══════ ③ 바꾸는 방법 — 요금과 되돌릴 수 없음 ═══════════════════ */

test('★★★ 사진 번호가 «안 바뀐다» — 새 항목을 만들지 않는다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'async function repasteApply(') || '');
  assert.ok(fn, 'repasteApply 가 없습니다');
  assert.match(fn, /PuPhotoStore\.replaceImage\(/,
    '★★★ 새 사진으로 올리면 기업정보함 연결·서류 묶음·보낸 기록이 통째로 끊깁니다');
  assert.ok(!/addFiles\(|savePhoto\(/.test(fn),
    '★★★ 새 항목을 만들면 「같은 서류를 다시 읽은 것」이 아니게 되어 기업 상세도 안 고쳐집니다');
});

test('★★★ 「사진만 바꾸기」와 «갈라» 둔다 — 다시 읽기는 요금이 든다', () => {
  const paint = stripJs(cutFn(PHOTOS, 'function paintRepaste(') || '');
  assert.match(paint, /repasteApply\(false\)/, '★★★ 요금 0원 길이 없으면 눈으로 대조만 할 때도 요금이 납니다');
  assert.match(paint, /요금 0원/, '★★ 요금이 안 든다는 것을 말해야 그 길을 씁니다');
  const open = stripJs(cutFn(PHOTOS, 'function openRepaste(') || '');
  assert.match(open, /repasteApply\(true\)/);
  const apply = stripJs(cutFn(PHOTOS, 'async function repasteApply(') || '');
  assert.match(apply, /if \(!reread\)/, '★★ 두 길이 갈라지지 않습니다');
});

test('★★★ 더 «작은» 것으로 바꿀 때는 묻는다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'async function repasteApply(') || '');
  assert.match(fn, /Math\.max\(r\.w, r\.h\) < 지금긴변[\s\S]{0,120}confirm\(/,
    '★★★ 모르고 작은 것으로 바꾸면 글자가 더 안 읽히는데 되돌릴 길이 없습니다');
});

test('★★★ 바꾼 «새 크기»를 적는다 — 안 적으면 바꾸고도 계속 「작습니다」가 뜬다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'async function repasteApply(') || '');
  assert.match(fn, /w: sized\[0\]\.w, h: sized\[0\]\.h, srcW: r\.w, srcH: r\.h/,
    '★★★ 판정이 옛 크기를 보면 방금 바꾼 사진에도 「원본이 작습니다」가 그대로 뜹니다');
});

/* ══════ ④ 다시 읽은 뒤 — 달라진 것만 ═══════════════════════════ */

test('★★★ 다시 읽은 뒤 «달라진 칸만» 보여 준다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function showRepasteDiff(') || '');
  assert.ok(fn, 'showRepasteDiff 가 없습니다');
  assert.match(fn, /달라진 = 이름\.filter/,
    '★★★ 스무 칸을 다 늘어놓으면 무엇이 바뀌었는지 안 보입니다');
  assert.match(fn, /readRows\(옛판독\)/, '★★ 전·후를 견주려면 옛 판독을 들고 있어야 합니다');
});

test('★★ 하나도 안 달라졌으면 «그렇다고 말한다» — 빈 창은 고장으로 보인다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function showRepasteDiff(') || '');
  assert.match(fn, /하나도 달라지지 않았습니다/);
  assert.match(fn, /✎/, '★★ 다음에 무엇을 하면 되는지 길을 줘야 합니다');
});

test('★★ 다시 읽기 «전»에 옛 판독을 챙겨 둔다 — 읽고 나면 못 본다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'async function repasteApply(') || '');
  const i = fn.indexOf('const 옛판독'), j = fn.indexOf('readPhoto(id)');
  assert.ok(i >= 0 && j >= 0 && i < j,
    '★★ 판독이 끝난 뒤에 챙기면 「전」이 「후」와 같아져 아무것도 안 달라져 보입니다');
});

/* ══════ ⑤ 한 창을 여러 일에 돌려 쓴다 ═══════════════════════════ */

test('★★★ 창을 닫으면 쥐고 있던 것을 버리고 단추를 되돌린다', () => {
  const fn = stripJs(cutFn(PHOTOS, 'function closeKindPopup(') || '');
  assert.match(fn, /_repaste = null;/,
    '★★★ 안 버리면 다음에 붙여넣은 것이 엉뚱한 사진을 바꿉니다');
  assert.match(fn, /\$\('kindPopupOk'\)\.disabled = false;/,
    '★★★ 안 되돌리면 다음 창의 확인 단추가 «꺼진 채» 뜹니다');
  assert.match(fn, /\$\('kindPopupOk'\)\.onclick = null;/,
    '★★★ 안 되돌리면 다음 창의 확인이 사진 바꾸기를 합니다');
});

test('★ 넣기 전에는 «바꾸고 다시 읽기»를 못 누른다', () => {
  const paint = stripJs(cutFn(PHOTOS, 'function paintRepaste(') || '');
  assert.match(paint, /\$\('kindPopupOk'\)\.disabled = !r\.file;/,
    '★ 빈 채로 누르면 아무 일도 안 일어나는 단추가 됩니다');
});
